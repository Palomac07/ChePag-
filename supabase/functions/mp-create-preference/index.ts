import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { acreedor_id, monto, descripcion } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: perfil } = await supabase
      .from('profiles')
      .select('mp_access_token, nombre')
      .eq('id', acreedor_id)
      .single();

    if (!perfil?.mp_access_token) {
      return new Response(
        JSON.stringify({ error: 'El receptor no tiene Mercado Pago vinculado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${perfil.mp_access_token}`,
      },
      body: JSON.stringify({
        items: [{
          title: descripcion || 'Pago de deuda - ChePaga',
          quantity: 1,
          unit_price: monto,
          currency_id: 'ARS',
        }],
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
