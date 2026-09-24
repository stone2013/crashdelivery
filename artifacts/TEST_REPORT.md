# V0.7.2 Network Diagnostics Hotfix — Test Report

Date: 2026-09-24  
Build: `V0.7.2-Network-Diagnostics-Hotfix.html`  
Size: 291,241 bytes  
SHA-256: `5A6896A56566E663C3FB4F8A7D16A3B23032F681BB752DED947DB22FD65E814C`

## Build and Chromium regression

The release builder passed: 151 unique DOM IDs, all direct element references resolve, and inline JavaScript syntax checks pass.

| Area | Passed |
|---|---:|
| Solo gameplay and garage | 31 / 31 |
| Responsive lobby and touch controls | 32 / 32 |
| Full 18-delivery round and settlement | 21 / 21 |
| Two-client shared gameplay bridge | 30 / 30 |
| City graph, lights, and traffic | 24 / 24 |
| Extended traffic, map, and two-client city sync | 26 / 26 |
| Online HUD and city-map UI | 13 / 13 |
| Network settings, P2P policy, and relay policy | 24 / 24 |
| TURN diagnostics harness | 10 / 10 |
| **Total** | **211 / 211** |

The TURN diagnostics harness uses synthetic credentials and simulated ICE candidates. It verifies six independent `RTCPeerConnection` instances, one TURN URL per connection, `iceTransportPolicy: 'relay'`, DataChannel/offer/local-description setup, candidate-error and gathering-timeout handling, accepting only `typ relay`, fastest-route selection, the saved route preference, diagnostics while direct mode is selected, and absence of the synthetic short-lived credentials from UI and local storage.

## Not yet accepted

- No real Cloudflare `relay` candidate was observed in this test environment. TCP port reachability is not TURN allocation evidence.
- The deployed `game.feelpal.app` page has not been replaced or tested with this candidate.
- Cross-network Windows/Mac Wi-Fi ↔ iPhone 5G multiplayer and reconnect acceptance remain outstanding.

Final acceptance requires opening the deployed hotfix, using forced TURN to observe at least one actual `relay` candidate, then completing a two-device room test across Wi-Fi and cellular networks.
