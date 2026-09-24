# Crash Delivery — Continuation Notes

Updated: 2026-09-24

## Goal

Continue the `stone2013/crashdelivery` `main` line and finish V0.7.2 public-network acceptance. Preserve the V0.7.1 gameplay and desktop/mobile layouts. Networking target: P2P first, Cloudflare Realtime TURN fallback, with short-lived TURN credentials served only by the Cloudflare Worker.

## Completed

- Consolidated the full local V0.7.1/V0.7.2 source, generated `index.html`, test suite, test artifacts, screenshots, release metadata, and Cloudflare Worker into this repository while preserving the existing root `CNAME` (`game.feelpal.app`).
- `game.feelpal.app` is configured in Cloudflare DNS as DNS-only CNAME to `stone2013.github.io`; HTTPS returned HTTP 200 when last checked.
- Cloudflare Worker `crashdelivery-turn-credentials` is bound to Production custom domain `api.feelpal.app`.
- Worker `ALLOWED_ORIGIN` is restricted to `https://game.feelpal.app`; TTL is 3600 seconds.
- Game bundle requests `https://api.feelpal.app/turn-credentials` and handles the returned short-lived `iceServers` without embedding a long-lived key.
- Build script passes: 284,844-byte bundle, 151 unique DOM IDs, direct DOM references valid, inline JavaScript syntax checked. Current SHA-256 is `2f3b60a56f46ab44014315ae799f49ef8018057563945f8443c8aad78f4ccf5f`.
- Root `.gitignore` now excludes environment files, Wrangler state, Python caches, and bytecode. No actual `.env`, API token, TURN key, or secret value is included in this commit.

## Current blockers / unverified

- At the last safe endpoint check, `/turn-credentials` returned `worker_not_configured`; Production Worker Secrets `TURN_KEY_ID` and `TURN_API_TOKEN` had not been deployed.
- A screenshot shared during setup visibly exposed a long-lived TURN API credential. Treat that key as compromised: revoke/delete it in Cloudflare Realtime TURN, create a replacement, and only enter the replacement values directly in the Cloudflare Dashboard. Never paste them into chat, repo files, shell history, logs, or GitHub.
- The Python browser tests could not be rerun on the previous computer because `pytest` and `playwright` were not installed. The old `TEST_REPORT.md` is explicitly marked as historical V0.7.1 results.
- The true relay ICE candidate and Mac Wi-Fi ↔ iPhone 5G real-device multiplayer acceptance are still outstanding.
- Before this consolidation, GitHub Pages served an older 266,070-byte page while the local V0.7.2 bundle is 284,844 bytes. Verify Pages finishes deploying this commit and serves the new bundle at `https://game.feelpal.app`.
- Main menu/help copy still identifies the gameplay baseline as V0.7.1; assess whether it should be relabeled V0.7.2 after the release is validated.

## Next steps

1. In Cloudflare Realtime → TURN Server, revoke the credential exposed in the screenshot and create a new production TURN key.
2. In Workers & Pages → `crashdelivery-turn-credentials` → Settings → Runtime variables and secrets, add two Production Secrets: `TURN_KEY_ID` = the new Turn Token ID; `TURN_API_TOKEN` = its API Token. Keep values out of this repo and deploy from the dashboard.
3. Safely check the endpoint response shape/status only; do not print or save temporary ICE `username`/`credential` values.
4. Open the deployed game, select forced relay, and run ICE self-check. Acceptance requires an actual `relay` candidate.
5. Test Mac on Wi-Fi ↔ iPhone on 5G: join the same room, verify sync, HUD transport/RTT, and reconnect after a brief network interruption.
6. Update `VERSION.json`, `TEST_REPORT.md`, and these notes with verified results only.

## Environment and commands

Required for build: Python 3.9+; Node.js is used for inline JavaScript syntax checks when available. Worker deploys use Wrangler 4 and an authenticated Cloudflare account. Browser tests additionally require Python Playwright and Chromium.

```sh
# Build/validate the static game bundle
python3 build.py
node --check turn-worker/src/index.js

# Optional clean test environment
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip playwright
python -m playwright install chromium

# Run browser regression scripts (from repository root)
for test in tests/test_*.py; do python "$test"; done

# Worker deployment after Cloudflare Secrets are configured
cd turn-worker
npx wrangler deploy
```

Do not run `wrangler secret put` with values embedded in commands. Prefer having the owner enter the new credential values directly into Cloudflare's Secret fields. The Worker name/domain, frontend endpoint, and expected variable names are recorded in `turn-worker/wrangler.toml`, `turn-worker/README.md`, and `NETWORK_SETUP.md`; the secret values are intentionally absent.

## Legacy V0.7 source recovery (2026-09-24)

- The 11 files under `source/` were mechanically split from the V0.7 `index.html` baseline at commit `9ca544f`; they preserve that earlier game implementation and are retained as historical recovery material.
- Before the upstream V0.7.2 update, rebuilding those modules reproduced the old V0.7 bundle byte-for-byte (SHA-256 `F3033C9683A6221FA566D4666B017DB46177F37089D2339B1CB5B98C25BA5EE3`). The original authoring structure, comments or files omitted from the bundle cannot be recovered from the compiled page.
- Current `main` is V0.7.2. Its production page is generated from `src/release-v071.snapshot.html`; `source/` is not the current build input. The current root `index.html` remains the V0.7.2 reference and must not be replaced with the legacy V0.7 output.
- Browser checks on the recovered V0.7 candidate confirmed desktop and mobile loading, game entry, and tested gameplay behaviors; those checks do not establish V0.7.2 parity for the legacy source.
- No Cloudflare secrets or credentials were added during source recovery. Continue to keep all TURN keys and API tokens out of files, terminal logs, and Git.
