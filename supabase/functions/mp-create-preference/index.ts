import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { monto, descripcion } = await req.json();
    const sellerAccessToken = Deno.env.get('MP_SELLER_ACCESS_TOKEN');

    if (!sellerAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Falta configurar MP_SELLER_ACCESS_TOKEN en Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerAccessToken}`,
      },
      body: JSON.stringify({
        items: [{
          title: descripcion || 'Pago de deuda - ChePaga',
          quantity: 1,
          unit_price: monto,
          currency_id: 'ARS',
        }],
        back_urls: {
          success: 'https://chepaga.app/pago-exitoso',
          failure: 'https://chepaga.app/pago-fallido',
        },
        auto_return: 'approved',
      }),
    });

    const prefData = await prefRes.json();
    console.log('MP preference response:', JSON.stringify(prefData));

    if (!prefData.sandbox_init_point && !prefData.init_point) {
      return new Response(
        JSON.stringify({ error: 'No se pudo crear la preferencia', details: prefData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        init_point: prefData.sandbox_init_point ?? prefData.init_point,
        preference_id: prefData.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
