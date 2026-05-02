const crypto = require('crypto');
exports.handler = async (event) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(event.body);
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  if (expected === razorpay_signature) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }
  return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) };
};
