const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const amount = body.amount;
    const receipt = body.receipt || 'receipt_' + Date.now();

    if (!amount || amount < 100) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount' })
      };
    }

    const KEY_ID = process.env.RAZORPAY_KEY_ID;
    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!KEY_ID || !KEY_SECRET) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Razorpay credentials' })
      };
    }

    const orderData = JSON.stringify({
      amount: amount,
      currency: 'INR',
      receipt: receipt
    });

    const auth = Buffer.from(KEY_ID + ':' + KEY_SECRET).toString('base64');

    const result = await new Promise(function(resolve, reject) {
      const req = https.request({
        hostname: 'api.razorpay.com',
        path: '/v1/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + auth,
          'Content-Length': Buffer.byteLength(orderData)
        }
      }, function(res) {
        let data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        });
      });

      req.on('error', reject);
      req.write(orderData);
      req.end();
    });

    if (result.status !== 200) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: result.data.error || 'Razorpay error' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        order_id: result.data.id,
        amount: result.data.amount,
        currency: result.data.currency
      })
    };

  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
