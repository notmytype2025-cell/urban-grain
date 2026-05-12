const crypto = require('crypto');

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST'){
    return{statusCode:405,body:'Method not allowed'};
  }
  try{
    const{razorpay_order_id,razorpay_payment_id,razorpay_signature} = JSON.parse(event.body);
    if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature){
      return{statusCode:400,body:JSON.stringify({error:'Missing fields'})};
    }
    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    const expected = crypto.createHmac('sha256',KEY_SECRET)
      .update(razorpay_order_id+'|'+razorpay_payment_id)
      .digest('hex');
    if(expected !== razorpay_signature){
      return{statusCode:400,body:JSON.stringify({error:'Signature mismatch'})};
    }
    return{
      statusCode:200,
      headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({success:true})
    };
  }catch(e){
    return{statusCode:500,body:JSON.stringify({error:e.message})};
  }
};
