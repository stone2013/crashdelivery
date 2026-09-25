import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./src/index.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

class MemoryKV {
  values = new Map();
  async get(key, type) {
    const value = this.values.get(key);
    return value === undefined ? null : type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix }) {
    return { keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

const env = { ALLOWED_ORIGIN: 'https://game.feelpal.app', ROOM_DIRECTORY: new MemoryKV() };
const call = (path, method = 'GET', body, token, origin = env.ALLOWED_ORIGIN) => worker.fetch(new Request(`https://api.feelpal.app${path}`, {
  method,
  headers: {
    origin,
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}), env);

const code = '314159';
const registration = await call(`/rooms/${code}`, 'POST', {
  roomCode: code,
  hostName: '测试房主',
  maxPlayers: 4,
  protocol: 'crash-delivery-mp075-1',
});
assert.equal(registration.status, 201);
const { token } = await registration.json();
assert.ok(token.length >= 64);

let response = await call('/rooms');
let body = await response.json();
assert.equal(response.status, 200);
assert.deepEqual(body.rooms[0], {
  roomCode: code,
  hostName: '测试房主',
  players: 1,
  maxPlayers: 4,
  updatedAt: body.rooms[0].updatedAt,
});
assert.equal(JSON.stringify(body).includes(token), false);
assert.equal(JSON.stringify(body).includes('tokenHash'), false);

assert.equal((await call(`/rooms/${code}`, 'PUT', { players: 3 }, 'wrong-token')).status, 401);
assert.equal((await call(`/rooms/${code}`, 'PUT', { players: 5 }, token)).status, 400);
assert.equal((await call(`/rooms/${code}`, 'PUT', { players: 3 }, token)).status, 200);
body = await (await call('/rooms')).json();
assert.equal(body.rooms[0].players, 3);

assert.equal((await call(`/rooms/${code}`, 'POST', { roomCode: code, maxPlayers: 3, protocol: 'crash-delivery-mp075-1' })).status, 409);
assert.equal((await call(`/rooms/${code}`, 'DELETE', undefined, token)).status, 200);
assert.deepEqual((await (await call('/rooms')).json()).rooms, []);
assert.equal((await call('/rooms', 'GET', undefined, undefined, 'https://bad.example')).status, 403);

console.log('PASS Worker room directory create/list/heartbeat/capacity/auth/delete/CORS');
