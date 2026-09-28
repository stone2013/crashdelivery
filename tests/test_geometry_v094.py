from test_utils import *
from playwright.sync_api import sync_playwright
import json, math
R=[]
def ck(n,v,d=None):
    R.append({'test':n,'passed':bool(v),'details':d}); print(('PASS ' if v else 'FAIL ')+n,'' if v else d,flush=True)
with sync_playwright() as p:
    b=launch(p); c,pg,errors=load(b,mobile=True,size=(390,844)); E=pg.evaluate
    E('__deliveryTest.freeze(true);__deliveryTest.roads09.noTraffic()')
    ck('V0.9.4 title','V0.9.4' in pg.title(),pg.title())
    vp=E('__deliveryTest.roads09.viewport()'); ck('Fixed game fills iPhone-sized viewport',abs(vp['game']-vp['innerHeight'])<2 and abs(vp['bottom']-vp['innerHeight'])<2,vp)
    furn=E('__deliveryTest.roads09.furniture()')
    ck('Furniture supports stay off drivable road',all(not x['onRoad'] for x in furn),[x for x in furn if x['onRoad']])
    signs=[x for x in furn if x['facingDot'] is not None]
    lamps=[x for x in furn if x['aimDot'] is not None]
    ck('Signs/signals face approaching traffic',len(signs)>0 and all(x['facingDot']>.98 for x in signs),signs)
    ck('Lamp arms point toward roadway',len(lamps)>0 and all(x['aimDot']>.98 for x in lamps),lamps)
    wide=[x for x in furn if x['name']=='sign-highway']
    ck('Wide highway signs clear lane edge',len(wide)==2 and all(x['shoulderOffset']>=13.5 for x in wide),wide)
    cols=E('__deliveryTest.roads09.colliders()')
    labels={}
    for x in cols:labels[x['label']]=labels.get(x['label'],0)+1
    ck('Six bridge pillars are solid',labels.get('bridge-pillar')==6,labels)
    ck('Both ramps have solid side shells',labels.get('ramp-shell')==4,labels)
    ck('Both ramp high ends block ground-level entry',labels.get('ramp-high-cap')==2,labels)
    # Grass-side impact into the western ramp shell.
    E('__deliveryTest.roads09.place(172,-4,Math.PI,7,0);__deliveryTest.advance(1.2)')
    car=E('__deliveryTest.roads09.snapshot().car');stats=E('__deliveryTest.roads09.snapshot().stats')
    ck('Truck cannot enter ramp from side',car['p'][2] < -1.0 and car['p'][1] < .6 and stats['staticHits']>0,{'car':car,'stats':stats})
    # Ground-level approach into high end of ramp must hit solid body instead of entering underneath.
    E('__deliveryTest.roads09.place(190,8,Math.PI/2,7,0);__deliveryTest.advance(1.2)')
    car=E('__deliveryTest.roads09.snapshot().car');stats=E('__deliveryTest.roads09.snapshot().stats')
    ck('Truck cannot enter ramp body from high-end underside',car['p'][0] > 185.5 and car['p'][1] < .6,{'car':car,'stats':stats})
    # Pillar collision.
    E('__deliveryTest.roads09.place(190,-4,Math.PI,7,0);__deliveryTest.advance(1.2)')
    car=E('__deliveryTest.roads09.snapshot().car')
    ck('Truck cannot pass through bridge pillar',car['p'][2] < -.8,car)
    # Grass intentionally remains open driving space.
    E('__deliveryTest.roads09.place(260,104,0,3,0);__deliveryTest.advance(.5)')
    grass=E('__deliveryTest.roads09.snapshot().car')
    ck('Grass remains drivable',grass['p'][2] < 104 and grass['p'][1] < .6,grass)
    E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.roads09.noTraffic();__deliveryTest.forceTime(10);__deliveryTest.roads09.place(258,56,-Math.PI/2,8,0);__deliveryTest.advance(.7)')
    law=E('__deliveryTest.roads09.law()'); ck('V0.9.1 red-light fine retained',law['red']==1 and law['fines']==80,law)
    ck('No JavaScript page errors',not errors,errors)
    c.close();b.close()
(ROOT/'tests/v094_geometry_results.json').write_text(json.dumps(R,ensure_ascii=False,indent=2),encoding='utf8')
print('TOTAL',sum(x['passed'] for x in R),'/',len(R))
