# Repository guidance

## Project baseline

- Treat the committed `index.html` as the current playable game and behavioral reference.
- Preserve the existing game design and browser support for desktop and mobile.
- Avoid broad rewrites. Make focused changes that retain the existing game behavior.
- `src/` is the canonical V0.7.2 release source. Run `build.py --output <candidate.html>` for normal verification; `build.py` defaults to writing `index.html`.
- `source/` is a mechanical recovery of the earlier V0.7 bundle from commit `9ca544f`; it is retained for historical recovery and is not the V0.7.2 production build input.
- Never overwrite the current `index.html` with an unverified build. Compare a candidate output first and keep a recoverable copy in version control. Do not target the root output unless the user explicitly requests replacement.
- Do not remove files or push changes unless the user asks.

## Recovery and implementation

- The current `index.html` is generated from `src/release-v071.snapshot.html`. Preserve the V0.7.2 implementation and its Cloudflare TURN integration. Do not replace it with the older files in `source/`.
- Keep the single-file output offline-capable. PeerJS is the documented optional network dependency and has CDN fallback URLs in the current page.
- Keep touch controls, keyboard controls, safe-area handling, and responsive layouts intact.
- Update `CONTINUE.md` when the recovery status or next steps change.

## Verification

- For source restoration, verify that `build.py` can produce a candidate page from `source/` and compare it with the committed `index.html` before replacing anything.
- Do not claim gameplay equivalence from a textual build alone; inspect the diff and run appropriate browser checks when requested and available.
