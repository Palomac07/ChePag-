import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve((req) => {
  const url = new URL(req.url);
  const redirect = url.searchParams.get('redirect') || 'chepaga://pago-mp';
  const target = new URL(redirect);

  url.searchParams.forEach((value, key) => {
    if (key !== 'redirect') {
      target.searchParams.set(key, value);
    }
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
    },
  });
});
