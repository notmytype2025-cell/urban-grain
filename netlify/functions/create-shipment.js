const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const DELHIVERY_KEY = process.env.DELHIVERY_API_KEY;
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Map your Delhivery payload structure directly to your frontend keys
    const shipmentData = {
      shipments: [
        {
          name: body.name,
          add: body.address,
          city: body.city,
          state: body.state,
          pin: body.pin,
          country: 'India',
          phone: body.phone,
          order: body.orderId,
          payment_mode: 'Prepaid',
          return_pin: '600001',
          return_city: 'Chennai',
          return_phone: '7397368873',
          return_add: '32/7 Kasi Chetty Street, CMC Complex, Sowcarpet, Chennai',
          return_state: 'Tamil Nadu',
          return_country: 'India',
          products_desc: body.products || 'Clothing Item',
          hsn_code: '61091000',
          cod_amount: '', // ✅ FIXED: Must be an empty string for Prepaid to avoid API rejection
          order_date: new Date().toISOString().split('T')[0],
          total_amount: String(body.total),
          seller_add: '32/7 Kasi Chetty Street, CMC Complex, Sowcarpet, Chennai',
          seller_name: 'Urban Grain',
          seller_inv: body.orderId,
          quantity: String(body.quantity || 1),
          waybill: '',
          shipment_width: '20',
          shipment_height: '5',
          weight: '400',
          seller_gst_tin: '',
          shipping_mode: 'Surface',
          address_type: 'home'
        }
      ],
      pickup_location: {
        name: 'Urban Grain',
        add: '32/7 Kasi Chetty Street, CMC Complex, Sowcarpet, Chennai',
        city: 'Chennai',
        pin_code: '600001',
        country: 'India',
        phone: '7397368873'
      }
    };

    const formData = 'format=json&data=' + encodeURIComponent(JSON.stringify(shipmentData));
    const https = require('https');

    const result = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'track.delhivery.com',
          path: '/api/cbe/p/create/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Token ' + DELHIVERY_KEY,
            'Content-Length': Buffer.byteLength(formData)
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
        }
      );

      req.on('error', reject);
      req.write(formData);
      req.end();
    });

    // ✅ FIXED: Safely extract real waybill strings without falling back to string error responses from rmk
    let waybill = null;
    if (result.data?.packages?.[0]?.waybill) {
      waybill = result.data.packages[0].waybill;
    } else if (result.data?.package_data?.[0]?.waybill) {
      waybill = result.data.package_data[0].waybill;
    }

    // Double check that we received a valid numeric waybill string and not an error string flag
    const isSuccess = !!waybill && String(waybill).toLowerCase() !== 'failure';

    // Save waybill + update status in Supabase only on absolute success
    if (isSuccess) {
      await supabase
        .from('orders')
        .update({ waybill: waybill, status: 'accepted' })
        .eq('id', body.orderId);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: isSuccess,
        waybill: isSuccess ? waybill : null,
        data: result.data // Kept for Netlify functions log auditing if the API rejects
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
