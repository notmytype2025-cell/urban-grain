const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user_id,
      user_email,
      amount,
      items,
      address
    } = JSON.parse(event.body);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing fields' })
      };
    }

    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    if (!KEY_SECRET) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Razorpay secret' })
      };
    }

    const expected = crypto.createHmac('sha256', KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(razorpay_signature, 'hex');

    if (expectedBuf.length !== actualBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Signature mismatch' })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { error: dbError } = await supabase.from('orders').insert({
      user_id: user_id,
      user_email: user_email,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      amount: amount,
      items: items,
      address: address,
      status: 'paid',
      created_at: new Date().toISOString()
    });

    if (dbError) {
      console.error('Supabase error:', dbError);
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: process.env.GMAIL_USER,
        subject: '🛍️ New Order - ' + razorpay_order_id,
        html: `
          <h2>New Order Received!</h2>
          <p><b>Order ID:</b> ${razorpay_order_id}</p>
          <p><b>Payment ID:</b> ${razorpay_payment_id}</p>
          <p><b>Amount:</b> ₹${amount}</p>
          <p><b>Customer:</b> ${user_email}</p>
        `
      });
    } catch(emailErr) {
      console.log('Email error:', emailErr);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
