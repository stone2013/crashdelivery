# V0.9.1 Mobile + Traffic Hotfix

- iPhone/PWA: force game/canvas to dynamic viewport height; safe-area remains on controls.
- Vegetation: large procedural trees are skipped when they overlap the actual city road corridor.
- Traffic law: red-light violation -$80; vehicle collisions -$20 / -$60 / -$150 by impact severity. Host/solo authority only; guests receive synced totals.
- Pause: always-visible “退出到主菜单” with confirmation; host warns that the room will close.
- Settlement: traffic fine total, red-light count and crash count are appended to the round summary.
- Protocol bumped to `crash-delivery-mp091-1`.
