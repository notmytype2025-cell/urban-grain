const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const entity = payload.payload?.payment?.entity;

    if (payload.event === 'payment.captured' && entity) {
      const notes = entity.notes || {};

      // Save order to Supabase
      const { error } = await supabase.from('orders').insert({
        payment_id: entity.id,
        amount: entity.amount / 100,
        user_email: notes.email || entity.email,
        status: 'paid',
        items: notes.items || null,
        created_at: new Date().toISOString()
      });

      if (error) {
        console.error('Supabase insert error:', error);
        return { statusCode: 500, body: 'DB Error' };
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 500, body: 'Error' };
  }
};
