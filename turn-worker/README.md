# Crash Delivery Cloudflare TURN credential Worker

This Worker keeps the Cloudflare Realtime TURN key and API token server-side. The browser receives only a short-lived `iceServers` response. It also hosts a short-lived public room directory; only room code, host nickname, occupancy, and capacity are listed.

## Configure

1. Create a Cloudflare Realtime TURN key.
2. Add secrets without committing them:

```sh
wrangler secret put TURN_KEY_ID
wrangler secret put TURN_API_TOKEN
```

3. The Worker custom domain is `api.feelpal.app`; deploy it after adding the two secrets.
4. The frontend endpoint is `https://api.feelpal.app/turn-credentials` and the allowed game origin is `https://game.feelpal.app`.
5. The `ROOM_DIRECTORY` KV namespace is used for active multiplayer room listings. Entries expire unless the host renews them every 25 seconds and are removed when the host leaves. Keep the KV binding in `wrangler.toml` when deploying.
6. `GET /rooms` lists available rooms and their public mode (`coop` or `duel2v2`). `POST /rooms/{code}` registers a room and returns an ephemeral host token; 2v2 rooms require capacity four. Authenticated `PUT` heartbeats update occupancy and authenticated `DELETE` removes the listing. The token is held in page memory and its hash is stored in KV.

The credential endpoint calls Cloudflare's `generate-ice-servers` API with a one-hour TTL. No long-lived TURN key or API token belongs in the game HTML, repository, or GitHub Pages deployment.
