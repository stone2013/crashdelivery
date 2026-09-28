# V0.9.4 ALL ROADS — continuation

Canonical build: immutable `src/v08-baseline.html` + `src/city-roads-v094.js` + `src/roads-v09.js`, CSS, PWA shell and 22 original GLBs via `build.py`. Never rebuild from the old `source/` or an unrelated HTML.

V0.9.3 was fully reconstructed and verified first. V0.9.4 removes the old city road generation loops at build time. Original graph (25 nodes / 38 edges) and 18 jobs stay intact. City modules: 25 topology-selected junctions + 76 connectors; 76 lamps, 64 signal approaches. Kenney signs face local -X, lamp arms local -Z; use measured model normals, not guessed axes. All city roads must still render in 2v2; the SKYWAY region is the only region excluded there.

Signal phases come from existing signalPhase(node,axis), shared with NPC/fine logic; degree-2 corners are unsignalized. City road contact comes from transformed road mesh at y=.08. Grass remains accessible, and SKYWAY keeps layer-specific support and collisions.

`python build.py` regenerates index.html, sw.js and VERSION_V09.json. Do not edit only index.html. ASSETS.json plus both newly added junction GLBs must be present to build.

247 current assertions passed, including 15,244 geometric sample points inside the 34 new-city checks; see TEST_REPORT_V094.md. Two-minute city traffic and four-client 2v2 start/drive/render tested. Message bridges are not WebRTC; no new public TURN / Safari hardware / full 2v2 match / high-RTT acceptance claimed.

Next: user iPhone playthrough and realtime device test on their existing deployment. No remote repository, Worker or DNS changed in this task. Preserve source provenance and do not commit any credentials.
