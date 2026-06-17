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
    const { monto, descripcion, return_url } = await req.json();
    const sellerAccessToken = Deno.env.get('MP_SELLER_ACCESS_TOKEN');
    const externalReference = `chepaga-${crypto.randomUUID()}`;
    const mpReturnBase = 'https://kzbzyfdvncufrmcavtlx.supabase.co/functions/v1/mp-return';

    const buildReturnUrl = (resultado: string) => {
      const url = new URL(mpReturnBase);
      url.searchParams.set('resultado', resultado);
      if (typeof return_url === 'string' && return_url.trim()) {
        url.searchParams.set('redirect', return_url);
      }
      return url.toString();
    };

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
        external_reference: externalReference,
        metadata: {
          source: 'chepaga',
          external_reference: externalReference,
        },
        back_urls: {
          success: buildReturnUrl('success'),
          failure: buildReturnUrl('failure'),
          pending: buildReturnUrl('pending'),
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
        external_reference: externalReference,
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
