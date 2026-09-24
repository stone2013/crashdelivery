# Crash Delivery — Continuation Notes

Updated: 2026-09-24

## Goal

Continue the `stone2013/crashdelivery` `main` line. V0.7.3.1 ONLINE focuses on locally predicted courier movement, bounded reconciliation, and smooth teammate snapshots while preserving host authority. Public acceptance remains P2P first, Cloudflare Realtime TURN fallback, with short-lived credentials served only by the Worker.

## Completed

- V0.7.3 candidate adds locally predicted driving, sequenced input/acks, adaptive reconciliation, bounded teammate interpolation/extrapolation, and actual P2P/TURN RTT HUD.
- V0.7.3.1 candidate adds guest courier prediction/replay for on-foot movement, render correction offsets, cargo-local actor coordinates, immediate joystick input/release, and remote actor pose interpolation. The production bundle retains all V0.7.3 vehicle/ICE features.
- Browser movement checks cover 0/100/250/400ms with 22ms jitter and deterministic 2% replaceable-message loss; a 308-second two-client 400ms run converged after release. Detailed results: `artifacts/V0.7.3.1-TEST_REPORT.md`.
- V0.7.3 ICE route selection now filters out timed-out/late relays and uses one route for the row marker and saved recommendation.
- Chromium latency simulation: 0/80/150/250/400ms with 20ms jitter and 1% replaceable-packet loss; at 400ms hard correction after authority relocation and critical action uniqueness were checked. Results: `artifacts/V0.7.3-TEST_REPORT.md`.
- Reviewed release `index.html`, ZIP, CHANGELOG, raw movement results, and test report are available in the root and `artifacts/`; deployment/live TURN acceptance remains outstanding.

- Consolidated the full local V0.7.1/V0.7.2 source, generated `index.html`, test suite, test artifacts, screenshots, release metadata, and Cloudflare Worker into this repository while preserving the existing root `CNAME` (`game.feelpal.app`).
- `game.feelpal.app` is configured in Cloudflare DNS as DNS-only CNAME to `stone2013.github.io`; HTTPS returned HTTP 200 when last checked.
- Cloudflare Worker `crashdelivery-turn-credentials` is bound to Production custom domain `api.feelpal.app`.
- Worker `ALLOWED_ORIGIN` is restricted to `https://game.feelpal.app`; TTL is 3600 seconds.
- Game bundle requests `https://api.feelpal.app/turn-credentials` and handles the returned short-lived `iceServers` without embedding a long-lived key.
- User confirmed the deployed credentials endpoint returns one STUN server and six TURN routes with temporary credentials. TCP reachability checks succeeded for 3478, 5349, and 443; these checks do not prove a TURN relay allocation.
- V0.7.2 Network Diagnostics Hotfix now builds a separate candidate HTML and ZIP under `artifacts/`; the committed root `index.html` is intentionally not replaced.
- Chromium regression was rerun against the candidate: 211 checks passed across solo, responsive UI, full delivery round, two-client gameplay, city traffic, network UI, and the six-route diagnostics harness. The diagnostics harness uses synthetic credentials and relay candidates, so it verifies application behavior but not Cloudflare allocation.
- The ICE inspector now tests each Cloudflare TURN URL in its own relay-only PeerConnection, accepts only `typ relay`, stores only the best route URL, and keeps temporary credentials in page memory. Corrected the candidate-type parser that previously failed to recognize `typ relay`.
- The root `index.html` and unrelated pre-existing edit `turn-worker/wrangler.toml` were left untouched.
- Root `.gitignore` now excludes environment files, Wrangler state, Python caches, and bytecode. No actual `.env`, API token, TURN key, or secret value is included in this commit.

## Current blockers / unverified

- Actual production TURN relay allocation has not yet been observed in a real Chrome session. Browser simulation does not count as endpoint/relay acceptance.
- A screenshot shared during setup visibly exposed a long-lived TURN API credential. Treat that key as compromised: revoke/delete it in Cloudflare Realtime TURN, create a replacement, and only enter the replacement values directly in the Cloudflare Dashboard. Never paste them into chat, repo files, shell history, logs, or GitHub.
- `tests/TEST_REPORT.md` remains a historical report pointer; the current release report is in `artifacts/V0.7.3.1-TEST_REPORT.md`.
- The true relay ICE candidate and Mac Wi-Fi ↔ iPhone 5G real-device multiplayer acceptance are still outstanding.
- Before this consolidation, GitHub Pages served an older page. Verify the normal release process deploys the reviewed V0.7.3 candidate to `https://game.feelpal.app` only after acceptance.

## Next steps

1. Deploy the reviewed root `index.html` through the existing Pages workflow only after review; do not publish this build automatically.
2. On `https://game.feelpal.app`, select forced TURN and run the six-route self-check. Acceptance requires at least one actual `relay` candidate.
3. Test Windows/Mac Wi-Fi ↔ iPhone 5G in a two-client room; verify sync, HUD transport/RTT, and reconnect after a brief network interruption.
4. Update release metadata only after those live deployment and device checks pass.

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
- The local baseline before this candidate was V0.7.2. Production page source is `src/release-v071.snapshot.html`; `source/` is not the current build input. The root `index.html` remains the prior release reference until the candidate is reviewed and deployed.
- Browser checks on the recovered V0.7 candidate confirmed desktop and mobile loading, game entry, and tested gameplay behaviors; those checks do not establish V0.7.2 parity for the legacy source.
- No Cloudflare secrets or credentials were added during source recovery. Continue to keep all TURN keys and API tokens out of files, terminal logs, and Git.
