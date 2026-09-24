const corsHeaders = (origin, allowed) => ({
  'access-control-allow-origin': allowed || origin || 'null',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'vary': 'Origin',
  'cache-control': 'no-store',
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || '';
    const cors = corsHeaders(origin, allowedOrigin || origin || 'null');
    if (allowedOrigin && origin && origin !== allowedOrigin) return json({ error: 'origin_not_allowed' }, 403, corsHeaders(origin, allowedOrigin));
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'access-control-max-age': '86400' } });
    if (request.method !== 'GET' || url.pathname !== '/turn-credentials') {
      return json({ error: 'not_found' }, 404, cors);
    }
    if (!env.TURN_KEY_ID || !env.TURN_API_TOKEN) {
      return json({ error: 'worker_not_configured' }, 500, cors);
    }
    const ttl = Math.min(Math.max(Number(env.TURN_TTL_SECONDS || 3600), 300), 172800);
    const upstream = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.TURN_API_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ttl, customIdentifier: 'crashdelivery' }),
      },
    );
    const body = await upstream.text();
    return new Response(body, { status: upstream.status, headers: { ...cors, 'content-type': 'application/json' } });
  },
};

function json(value, status = 200, cors = corsHeaders('', 'null')) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'content-type': 'application/json' } });
}
