# Repository guidance

## Project baseline

- Treat the committed `index.html` as the current playable game and behavioral reference.
- Preserve the existing game design and browser support for desktop and mobile.
- Avoid broad rewrites. Make focused changes that retain the existing game behavior.
- The current V0.12 build inputs are `src/v012/base-v0112.html` and `src/v012/city-v012.js`. Run `python build.py --output <candidate.html>` for normal verification; root `build.py` defaults to writing `index.html`, `VERSION.json` and `sw.js`.
- `source/` is a mechanical recovery of the earlier V0.7 bundle from commit `9ca544f`; it is retained for historical recovery and is not the V0.7.2 production build input.
- Never overwrite the current `index.html` with an unverified build. Compare a candidate output first and keep a recoverable copy in version control. Do not target the root output unless the user explicitly requests replacement.
- Do not remove files or push changes unless the user asks.

## Recovery and implementation

- The current `index.html` preserves the V0.11.2 playable snapshot and its Cloudflare TURN integration. The V0.12 extension is additive. Do not replace it with older files in `source/` or rebuild it from `src/native-base.html`.
- Keep the static page and selected local GLB/PNG assets offline-cacheable after a successful first load. PeerJS is the existing optional network dependency and has CDN fallback URLs in the current page.
- Keep touch controls, keyboard controls, safe-area handling, and responsive layouts intact.
- Update `CONTINUE.md` when the recovery status or next steps change.

## Verification

- For source restoration, verify that `build.py` can produce a candidate page from `source/` and compare it with the committed `index.html` before replacing anything.
- Do not claim gameplay equivalence from a textual build alone; inspect the diff and run appropriate browser checks when requested and available.
