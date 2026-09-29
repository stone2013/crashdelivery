# V0.11.2 Physics Hotfix

- Fixed recovered/rejected parcel state leaking into the next throw.
- Reset return-to-door, rest position, NPC-hit and hit cooldown state whenever a ground parcel is recovered or re-thrown.
- Replaced V0.11 suburban parcel broad-phase endpoint check with swept-segment proximity testing. Fast parcels can no longer skip an entire house between simulation frames.
- Keeps the existing continuous segment/triangle facade collision and delivery rules.

Regression target: wrong-address throw -> parcel rejection -> recover -> throw again; the second flight must collide with suburban facade/portal instead of tunneling through the building.
