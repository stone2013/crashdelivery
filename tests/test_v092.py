from test_utils import *
from playwright.sync_api import sync_playwright
import json, math
R=[]
def ck(n,v,d=None):
    R.append({'test':n,'passed':bool(v),'details':d}); print(('PASS ' if v else 'FAIL ')+n,'' if v else d,flush=True)
with sync_playwright() as p:
    b=launch(p); c,pg,errors=load(b,mobile=True,size=(390,844)); E=pg.evaluate
    E('__deliveryTest.freeze(true);__deliveryTest.roads09.noTraffic()')
    ck('V0.9.2 edition visible','V0.9.2 ONLINE' in pg.locator('.edition').inner_text(),pg.locator('.edition').inner_text())
    vp=E('__deliveryTest.roads09.viewport()');ck('Measured viewport fills page',abs(vp['game']-844)<2,vp)
    furn=E('__deliveryTest.roads09.furniture()')
    ck('Road furniture poles stay off same-level road',all(not x['onRoad'] for x in furn),[x for x in furn if x['onRoad']])
    ck('Road furniture faces declared traffic flow',all(abs(((x['yaw']-x['travelYaw']+math.pi)%(2*math.pi))-math.pi)<1e-5 for x in furn))
    cols=E('__deliveryTest.roads09.colliders()')
    pillars=[x for x in cols if x['label']=='bridge-pillar']; ramps=[x for x in cols if x['label']=='ramp-side']
    ck('All six bridge pillars have solid colliders',len(pillars)==6,len(pillars))
    ck('Ramp side walls are continuous colliders',len(ramps)>100,len(ramps))
    # Drive directly into a bridge pillar. It must stop outside the pillar instead of passing through.
    E('__deliveryTest.roads09.place(190,-4,Math.PI,7,0);__deliveryTest.advance(1.0)')
    car=E('__deliveryTest.roads09.snapshot().car');stats=E('__deliveryTest.roads09.snapshot().stats')
    ck('Truck cannot pass through bridge pillar',car['p'][2] < .2 and stats['staticHits']>0,{'car':car,'stats':stats})
    # Approach raised ramp from the side/underside; side solid must stop the truck on ground.
    E('__deliveryTest.roads09.place(172,-2,Math.PI,7,0);__deliveryTest.advance(1.2)')
    car=E('__deliveryTest.roads09.snapshot().car');stats=E('__deliveryTest.roads09.snapshot().stats')
    ck('Truck cannot cut through ramp side',car['p'][2] < 1.2 and car['p'][1] < .5 and stats['staticHits']>1,{'car':car,'stats':stats})
    # Grass remains intentionally drivable: no wall snaps the vehicle back to a road.
    E('__deliveryTest.roads09.place(260,104,0,3,0);__deliveryTest.advance(.5)')
    grass=E('__deliveryTest.roads09.snapshot().car')
    ck('Grass remains drivable',grass['p'][2] < 104 and grass['p'][1] < .5,grass)
    # Retain traffic fines and pause exit from V0.9.1.
    E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.roads09.noTraffic();__deliveryTest.forceTime(10);__deliveryTest.roads09.place(258,56,-Math.PI/2,8,0);__deliveryTest.advance(.7)')
    law=E('__deliveryTest.roads09.law()');ck('Red-light fine retained',law['red']==1 and law['fines']==80,law)
    pg.click('#pauseBtn');ck('Exit-to-menu retained',pg.locator('#pauseExit091').is_visible())
    ck('No JavaScript page errors',not errors,errors)
    c.close();b.close()
Path=ROOT/'tests/v092_results.json';Path.write_text(json.dumps(R,ensure_ascii=False,indent=2),encoding='utf8')
print('TOTAL',sum(x['passed'] for x in R),'/',len(R))
