const corsHeaders = (origin, allowed) => ({
  'access-control-allow-origin': allowed || origin || 'null',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
  'vary': 'Origin',
  'cache-control': 'no-store',
});

const ROOM_PROTOCOL = 'crash-delivery-mp075-1';
const ROOM_TTL_SECONDS = 75;
const roomKey = (code) => `room:${code}`;

async function digestToken(token) {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicRoom(room) {
  return {
    roomCode: room.roomCode,
    hostName: room.hostName,
    players: room.players,
    maxPlayers: room.maxPlayers,
    gameMode: room.gameMode === 'duel2v2' ? 'duel2v2' : 'coop',
    updatedAt: room.updatedAt,
  };
}

async function listRooms(directory) {
  const result = [];
  let cursor;
  do {
    const page = await directory.list({ prefix: 'room:', limit: 1000, cursor });
    const values = await Promise.all(page.keys.map(({ name }) => directory.get(name, 'json')));
    for (const room of values) {
      if (room && room.protocol === ROOM_PROTOCOL && room.expiresAt > Date.now()
          && room.players < room.maxPlayers) result.push(publicRoom(room));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  result.sort((a, b) => b.updatedAt - a.updatedAt);
  return result.slice(0, 100);
}

async function handleRooms(request, env, url, cors) {
  const directory = env.ROOM_DIRECTORY;
  if (!directory) return json({ error: 'room_directory_unavailable' }, 503, cors);
  if (request.method === 'GET' && url.pathname === '/rooms') {
    return json({ rooms: await listRooms(directory) }, 200, cors);
  }

  const match = url.pathname.match(/^\/rooms\/(\d{6})$/);
  if (!match) return json({ error: 'not_found' }, 404, cors);
  const code = match[1];

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, cors); }
    if (body.protocol !== ROOM_PROTOCOL || body.roomCode !== code
        || ![2, 3, 4].includes(Number(body.maxPlayers))
        || !['coop', 'duel2v2'].includes(body.gameMode || 'coop')
        || (body.gameMode === 'duel2v2' && Number(body.maxPlayers) !== 4)) return json({ error: 'invalid_room' }, 400, cors);
    const prior = await directory.get(roomKey(code), 'json');
    if (prior && prior.expiresAt > Date.now()) return json({ error: 'room_code_in_use' }, 409, cors);
    const maxPlayers = Number(body.maxPlayers);
    const token = crypto.randomUUID() + crypto.randomUUID();
    const now = Date.now();
    const room = {
      protocol: ROOM_PROTOCOL,
      roomCode: code,
      hostName: String(body.hostName || '快递员').slice(0, 36),
      players: 1,
      maxPlayers,
      gameMode: body.gameMode === 'duel2v2' ? 'duel2v2' : 'coop',
      updatedAt: now,
      expiresAt: now + ROOM_TTL_SECONDS * 1000,
      tokenHash: await digestToken(token),
    };
    await directory.put(roomKey(code), JSON.stringify(room), { expirationTtl: ROOM_TTL_SECONDS });
    return json({ ok: true, token }, 201, cors);
  }

  const existing = await directory.get(roomKey(code), 'json');
  if (!existing || existing.expiresAt <= Date.now()) return json({ error: 'room_not_found' }, 404, cors);
  const supplied = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!supplied || await digestToken(supplied) !== existing.tokenHash) return json({ error: 'unauthorized' }, 401, cors);

  if (request.method === 'DELETE') {
    await directory.delete(roomKey(code));
    return json({ ok: true }, 200, cors);
  }
  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, cors); }
    const players = Number(body.players);
    if (!Number.isInteger(players) || players < 1 || players > existing.maxPlayers) {
      return json({ error: 'invalid_player_count' }, 400, cors);
    }
    const now = Date.now();
    existing.players = players;
    existing.updatedAt = now;
    existing.expiresAt = now + ROOM_TTL_SECONDS * 1000;
    await directory.put(roomKey(code), JSON.stringify(existing), { expirationTtl: ROOM_TTL_SECONDS });
    return json({ ok: true }, 200, cors);
  }
  return json({ error: 'method_not_allowed' }, 405, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || '';
    const cors = corsHeaders(origin, allowedOrigin || origin || 'null');
    if (allowedOrigin && origin && origin !== allowedOrigin) return json({ error: 'origin_not_allowed' }, 403, corsHeaders(origin, allowedOrigin));
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'access-control-max-age': '86400' } });
    if (url.pathname === '/rooms' || /^\/rooms\//.test(url.pathname)) {
      return handleRooms(request, env, url, cors);
    }
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
