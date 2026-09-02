const https = require('https');

function httpsPost(hostname, path, auth, body) {
  return new Promise(function(resolve, reject) {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: hostname,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + auth,
        'Content-Length': Buffer.byteLength(data)
      }
    }, function(res) {
      let d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { resolve({ status: res.statusCode, data: JSON.parse(d) }); });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise(function(resolve, reject) {
    const req = https.request({
      hostname: hostname,
      path: path,
      method: 'GET',
      headers: headers
    }, function(res) {
      let d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { resolve({ status: res.statusCode, data: JSON.parse(d) }); });
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // cartItems = [{ productId, qty, isVault }]
    const cartItems  = body.cartItems;
    const shipCost   = body.shipCost || 99;
    const discount   = body.discount || 0;
    const receipt    = 'rcpt_' + Date.now();

    if (!cartItems || !cartItems.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Empty cart' }) };
    }

    const SB_URL     = process.env.SUPABASE_URL;
    const SB_KEY     = process.env.SUPABASE_SERVICE_KEY;
    const RZP_ID     = process.env.RAZORPAY_KEY_ID;
    const RZP_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!SB_URL || !SB_KEY || !RZP_ID || !RZP_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    // Split regular vs vault items
    const regularItems = cartItems.filter(function(i) { return !i.isVault; });
    const vaultItems   = cartItems.filter(function(i) { return i.isVault; });

    let subtotal = 0;

    // Fetch regular product prices from Supabase
    if (regularItems.length) {
      const ids = regularItems.map(function(i) { return i.productId; }).join(',');
      const sbHost = SB_URL.replace('https://', '');
      const r = await httpsGet(sbHost,
        '/rest/v1/products?select=id,price&id=in.(' + ids + ')&active=is.true',
        { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
      );
      if (r.status !== 200) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch product prices' }) };
      }
      const products = r.data;
      for (const item of regularItems) {
        const db = products.find(function(p) { return String(p.id) === String(item.productId); });
        if (!db) return { statusCode: 400, body: JSON.stringify({ error: 'Product not found: ' + item.productId }) };
        subtotal += db.price * item.qty;
      }
    }

    // Fetch vault product prices from Supabase
    if (vaultItems.length) {
      const ids = vaultItems.map(function(i) { return i.productId; }).join(',');
      const sbHost = SB_URL.replace('https://', '');
      const r = await httpsGet(sbHost,
        '/rest/v1/vault_products?select=id,price&id=in.(' + ids + ')&active=is.true',
        { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
      );
      if (r.status !== 200) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch vault prices' }) };
      }
      const vaultProds = r.data;
      for (const item of vaultItems) {
        const db = vaultProds.find(function(p) { return String(p.id) === String(item.productId); });
        if (!db) return { statusCode: 400, body: JSON.stringify({ error: 'Vault product not found: ' + item.productId }) };
        subtotal += db.price * item.qty;
      }
    }

    // Server-side total — client cannot influence this
    const shipping      = subtotal >= 1299 ? 0 : shipCost;
    const finalDiscount = Math.min(Math.max(discount, 0), subtotal * 0.5); // cap at 50%
    const total         = Math.max(subtotal + shipping - finalDiscount, 100); // min ₹1
    const amountPaise   = Math.round(total * 100);

    // Create Razorpay order server-side — amount is now locked
    const auth = Buffer.from(RZP_ID + ':' + RZP_SECRET).toString('base64');
    const rzp  = await httpsPost('api.razorpay.com', '/v1/orders', auth, {
      amount: amountPaise,
      currency: 'INR',
      receipt: receipt
    });

    if (rzp.status !== 200) {
      return { statusCode: 500, body: JSON.stringify({ error: rzp.data.error || 'Razorpay error' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://fade07.netlify.app' },
      body: JSON.stringify({
        order_id:  rzp.data.id,
        amount:    total,
        subtotal:  subtotal,
        shipping:  shipping,
        discount:  finalDiscount
      })
    };

  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
