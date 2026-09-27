# V0.9 continuation

Use `src/v08-baseline.html` plus `src/roads-v09.*` and `build.py`, not legacy `source/` or old artifacts. Current playable file is root `index.html`. This package is a road test district added to the verified V0.8/2v2/PWA mainline; it is not a full 2v2 elevated map.

Roads: 20 real GLBs; plane sampling from actual triangles; local vehicle pitch transforms; layer-dependent collisions; 25 graph nodes, 52 directed edges; five NPC route followers; authoritative road snapshots and relocation serial. Test fixture `driveRoute` only exists behind the opt-in `?test` hook and drives normal controls. Gameplay has no auto-drive feature.

Priority after this preview: user Safari/phone road drive, high-RTT guest hill movement, more junction clearance/NPC incident behaviors, explicitly designed high-level 2v2 map. Do not remove original 18 delivery orders, room directory, short-lived TURN credential flow or local movement replay.

No GitHub push or remote server changes were made. No credentials were added. Cache policy contract tests are not a browser PWA installation test; JSON-message bridge tests are not a public WebRTC test. See TEST_REPORT.md.
