const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { amount, receipt } = JSON.parse(event.body);

    // amount should be in paise (e.g., ₹500 = 50000)
    if (!amount || amount < 100) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid amount. Must be in paise, minimum 100.' })
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
      amount,
      currency: 'INR',
      receipt: receipt || receipt_${Date.now()},  // fallback receipt
      payment_capture: 1
    });

    const auth = Buffer.from(KEY_ID + ':' + KEY_SECRET).toString('base64');

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.razorpay.com',
        path: '/v1/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + auth,
          'Content-Length': Buffer.byteLength(orderData)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({
          status: res.statusCode,
          data: JSON.parse(data)
        }));
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

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
