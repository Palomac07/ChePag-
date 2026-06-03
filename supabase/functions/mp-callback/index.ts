import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const userId = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error || !code || !userId) {
      return Response.redirect(`chepaga://mp-callback?error=${error ?? 'missing_params'}`, 302);
    }

    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/mp-callback`;

    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      const msg = encodeURIComponent(JSON.stringify(tokenData));
      return Response.redirect(`chepaga://mp-callback?error=${msg}`, 302);
    }

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('profiles').update({
      mp_access_token: tokenData.access_token,
      mp_refresh_token: tokenData.refresh_token ?? null,
      mp_user_id: String(tokenData.user_id),
    }).eq('id', userId);

    return Response.redirect(`chepaga://mp-callback?success=true`, 302);
  } catch (e) {
    return Response.redirect(`chepaga://mp-callback?error=${encodeURIComponent(String(e))}`, 302);
  }
});
