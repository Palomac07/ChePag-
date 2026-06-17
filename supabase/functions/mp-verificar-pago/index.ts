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
    const { preference_id } = await req.json();
    const sellerAccessToken = Deno.env.get('MP_SELLER_ACCESS_TOKEN');

    if (!preference_id) {
      return new Response(
        JSON.stringify({ error: 'Faltan parametros' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sellerAccessToken) {
      return new Response(
        JSON.stringify({ aprobado: false, error: 'Falta configurar MP_SELLER_ACCESS_TOKEN en Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?preference_id=${preference_id}`,
      { headers: { 'Authorization': `Bearer ${sellerAccessToken}` } }
    );

    const mpData = await mpRes.json();
    const aprobado = Array.isArray(mpData.results) &&
      mpData.results.some((p: any) => p.status === 'approved');

    return new Response(
      JSON.stringify({ aprobado }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ aprobado: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
