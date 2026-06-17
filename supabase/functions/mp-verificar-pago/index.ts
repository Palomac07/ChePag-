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
    const { preference_id, acreedor_id } = await req.json();

    if (!preference_id || !acreedor_id) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: perfil } = await supabase
      .from('profiles')
      .select('mp_access_token')
      .eq('id', acreedor_id)
      .single();

    if (!perfil?.mp_access_token) {
      return new Response(
        JSON.stringify({ aprobado: false, error: 'Sin token del acreedor' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/search?preference_id=${preference_id}`,
      { headers: { 'Authorization': `Bearer ${perfil.mp_access_token}` } }
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
