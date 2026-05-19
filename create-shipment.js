exports.handler = async (event) => {
  if(event.httpMethod !== 'POST'){
    return{statusCode:405,body:'Method not allowed'};
  }
  try{
    const DELHIVERY_KEY = process.env.DELHIVERY_API_KEY;
    const body = JSON.parse(event.body);
    const shipmentData = {
      shipments:[{
        name: body.name,
        add: body.address,
        city: body.city,
        state: body.state,
        pin: body.pin,
        country: 'India',
        phone: body.phone,
        order: body.order_id,
        payment_mode: 'Prepaid',
        return_pin: '600001',
        return_city: 'Chennai',
        return_phone: '9999999999',
        return_add: 'Urban Grain HQ, Chennai',
        return_state: 'Tamil Nadu',
        return_country: 'India',
        products_desc: body.products,
        hsn_code: '61091000',
        cod_amount: '0',
        order_date: new Date().toISOString().split('T')[0],
        total_amount: String(body.total),
        seller_add: 'Chennai, Tamil Nadu',
        seller_name: 'Urban Grain',
        seller_inv: body.order_id,
        quantity: String(body.quantity||1),
        waybill: '',
        shipment_width: '20',
        shipment_height: '5',
        weight: '500',
        seller_gst_tin: '',
        shipping_mode: 'Surface',
        address_type: 'home'
      }],
      pickup_location:{
        name:'Urban Grain',
        add:'Chennai, Tamil Nadu',
        city:'Chennai',
        pin_code:'600001',
        country:'India',
        phone:'9999999999'
      }
    };

    const formData='format=json&data='+encodeURIComponent(JSON.stringify(shipmentData));
    const https = require('https');

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'track.delhivery.com',
        path: '/api/cbe/p/create/',
        method: 'POST',
        headers:{
          'Content-Type':'application/x-www-form-urlencoded',
          'Authorization':'Token '+DELHIVERY_KEY,
          'Content-Length': Buffer.byteLength(formData)
        }
      },(res)=>{
        let data='';
        res.on('data',(chunk)=>data+=chunk);
        res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(data)}));
      });
      req.on('error',reject);
      req.write(formData);
      req.end();
    });

    return{
      statusCode:200,
      headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({
        success:true,
        waybill:result.data.packages&&result.data.packages[0]?result.data.packages[0].waybill:null,
        data:result.data
      })
    };
  }catch(e){
    return{statusCode:500,body:JSON.stringify({error:e.message})};
  }
};
