const Razorpay = require('razorpay');
exports.handler = async (event) => {
  const { amount, receipt } = JSON.parse(event.body);
  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  try {
    const order = await rzp.orders.create({
      amount: amount,
      currency: 'INR',
      receipt: receipt,
    });
    return {
      statusCode: 200,
      body: JSON.stringify({ order_id: order.id, amount: order.amount }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
