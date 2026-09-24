# Crash Delivery Cloudflare TURN credential Worker

This Worker keeps the Cloudflare Realtime TURN key and API token server-side. The browser receives only a short-lived `iceServers` response.

## Configure

1. Create a Cloudflare Realtime TURN key.
2. Add secrets without committing them:

```sh
wrangler secret put TURN_KEY_ID
wrangler secret put TURN_API_TOKEN
```

3. The Worker custom domain is `api.feelpal.app`; deploy it after adding the two secrets.
4. The frontend endpoint is `https://api.feelpal.app/turn-credentials` and the allowed game origin is `https://game.feelpal.app`.

The endpoint calls Cloudflare's `generate-ice-servers` API with a one-hour TTL. No long-lived TURN key or API token belongs in the game HTML, repository, or GitHub Pages deployment.
