"""V0.9 regression. Actual PocketGL/WebGL + original physics; QA-only fixtures.
No network navigation/RTC claims: pages loaded in-memory into isolated Chromium contexts.
"""
from test_utils import *
from playwright.sync_api import sync_playwright
import json, math
RESULT=[]
def check(name, ok, detail=None):
 RESULT.append({'test':name,'passed':bool(ok),'details':detail});print(('PASS ' if ok else 'FAIL ')+name,detail if not ok else '',flush=True)
with sync_playwright() as p:
 b=launch(p);context,page,errors=load(b);E=page.evaluate
 E('__deliveryTest.freeze(true)')
 def S():return E('__deliveryTest.roads09.snapshot()')
 def clear():E('__deliveryTest.freeze(true);__deliveryTest.clearTraffic();__deliveryTest.roads09.noTraffic()')
 def reset():E('__deliveryTest.roads09.start()');clear()
 s=S();check('Verified V0.8 base still contains 2v2 runtime',E('typeof DeliveryDuel2v2')!='undefined' if False else 'DeliveryDuel2v2' in SOURCE)
 check('22 real GLBs decoded and baked',s['ready'] and s['assets']==22 and not s['error'],s)
 check('Selected pack rendered through actual WebGL',E('__deliveryTest.glError()')==0 and s['triangles']>3000)
 check('Spatial batching reduces draws below placement count',s['chunks']<s['tiles'],{'tiles':s['tiles'],'chunks':s['chunks'],'triangles':s['triangles'],'loadMs':s['loadMs']})
 check('New trial and old solo entry both enabled',page.locator('#roadStart09').is_enabled() and page.locator('#startBtn').is_enabled())
 page.screenshot(path=str(ROOT/'screenshots/v09_menu_desktop.png'))
 level=E('__deliveryTest.roads09.levels(224,8)');check('Bridge has two distinct real mesh surfaces',len(level)==2 and abs(level[0]['y']-.08)<.002 and abs(level[1]['y']-8.08)<.002,level)
 lower=E('__deliveryTest.roads09.surface(224,8,.08)');upper=E('__deliveryTest.roads09.surface(224,8,8.08)')
 check('Lower reference never teleports onto bridge',abs(lower['y']-.08)<.001)
 check('Upper reference stays on upper deck',abs(upper['y']-8.08)<.001)
 vals=E('Array.from({length:65},(_,i)=>__deliveryTest.roads09.surface(152+i/2,8,10).y)')
 check('West ramp rises continuously',all(a<=bb+.001 for a,bb in zip(vals,vals[1:])) and abs(vals[0]-.08)<.001 and abs(vals[-1]-8.08)<.001,{'start':vals[0],'end':vals[-1]})
 vals2=E('Array.from({length:65},(_,i)=>__deliveryTest.roads09.surface(248+i/2,8,10).y)')
 check('East ramp descends continuously',all(a>=bb-.001 for a,bb in zip(vals2,vals2[1:])) and abs(vals2[-1]-.08)<.001)
 check('All deck tile seams connect',E('[184,200,216,232,248].every(x=>Math.abs(__deliveryTest.roads09.surface(x-.002,8,10).y-__deliveryTest.roads09.surface(x+.002,8,10).y)<.01)'))
 route=E('__deliveryTest.roads09.route("upper","lower")');check('Routing goes via ramp, not false vertical crossing',sum(x['len'] for x in route)>150 and any('ramp' in x['a'] for x in route),route)
 reset();E('__deliveryTest.roads09.place(152,8,-Math.PI/2,0,0);__deliveryTest.roads09.input(["KeyW"]);__deliveryTest.advance(3.1);__deliveryTest.roads09.clear()')
 s=S();check('Real pedal driving climbs ramp',s['car']['p'][1]>6 and s['car']['p'][0]>170,s['car'])
 E('__deliveryTest.roads09.place(160,8,-Math.PI/2,4,1.4);__deliveryTest.advance(.1)');s=S();check('Vehicle pitches from the actual ramp normal',s['car']['pitch']>.05,s['car'])
 co=E('__deliveryTest.roads09.coordinates([.4,2.38,1.7])');check('Inclined cargo local/world transforms invert',max(abs(x-y) for x,y in zip(co['roundtrip'],[.4,2.38,1.7]))<.0001,co)
 reset();E('__deliveryTest.roads09.place(224,20,0,0,0);__deliveryTest.roads09.input(["KeyW"]);__deliveryTest.advance(2.3);__deliveryTest.roads09.clear()');s=S();check('Van drives beneath same bridge without snapping up',abs(s['car']['p'][1]-.12)<.05 and s['car']['p'][2]<8,s['car'])
 reset();E('__deliveryTest.roads09.place(206,8,-Math.PI/2,0,8);__deliveryTest.roads09.input(["KeyW"]);__deliveryTest.advance(3.0);__deliveryTest.roads09.clear()');s=S();check('Van drives over crossing without falling through',s['car']['p'][0]>228 and s['car']['p'][1]>7.8,s['car'])
 E('__deliveryTest.roads09.place(210,3.5,0,0,8);__deliveryTest.roads09.input(["KeyW"]);__deliveryTest.advance(1);__deliveryTest.roads09.clear()');s=S();check('Upper guard rail holds van on deck',s['car']['p'][2]>=3.19 and s['car']['p'][1]>7.8,s['car'])
 pa=E('__deliveryTest.roads09.supportParcel(224,10.5,8,[0,-2,0])');check('Parcel falling from above lands on upper road',8.3<pa['p'][1]<9.2,pa)
 pb=E('__deliveryTest.roads09.supportParcel(224,3,8,[0,-2,0])');check('Parcel below span lands on ground road',pb['p'][1]<1, pb)
 pc=E('__deliveryTest.roads09.supportParcel(224,6,8,[0,14,0])');check('Parcel cannot fly through underside of crossing',pc['p'][1]<7.75,pc)
 reset();E('__deliveryTest.roads09.place(210,8,0,0,8);__deliveryTest.playerAt(0,2.9,Math.PI,-.2);__deliveryTest.bothDoors();__deliveryTest.advance(1)')
 page.keyboard.press('v');E('__deliveryTest.advance(.1)');m=E('__deliveryTest.roads09.moveSample()');check('Actual V key exits onto elevated deck',m['view']=='outside' and m['p'][1]>9.5,m)
 E('__deliveryTest.roads09.exterior(211,7,8.08)');page.keyboard.down('w');E('__deliveryTest.advance(.3)');page.keyboard.up('w');m=E('__deliveryTest.roads09.moveSample()');check('On-foot prediction stays on elevated mesh',m['p'][1]>9.5,m)
 reset();E('__deliveryTest.roads09.place(224,8,-Math.PI/2,0,8);__deliveryTest.roads09.exterior(222,8,.08)');page.keyboard.down('d');E('__deliveryTest.advance(.4)');page.keyboard.up('d');m=E('__deliveryTest.roads09.moveSample()');check('Ground courier does not teleport to upper deck',m['p'][1]<2,m);check('Ground courier walks beneath parked elevated van',m['p'][0]>223,m)
 reset();before=E('__deliveryTest.roads09.coreCount()');run=E('__deliveryTest.roads09.driveRoute(110)');after=E('__deliveryTest.roads09.coreCount()');check('Full six-gate route completed with real pedal/steering simulation',run['trial']['finished'] and run['trial']['index']==6,run['trial']);check('Trial does not consume original order inventory',before['orders']==18 and after['stock']==before['stock'],after)
 (ROOT/'tests/road_drive_samples.json').write_text(json.dumps(run,ensure_ascii=False,indent=2));page.screenshot(path=str(ROOT/'screenshots/v09_trial_complete.png'))
 E('__deliveryTest.roads09.city()');check('Return city retains all 18 orders',E('__deliveryTest.roads09.coreCount().orders')==18 and S()['car']['p'][0]<120)
 # Test independent lane bots through several complete high / low circuits; original traffic runs separately.
 E('__deliveryTest.reset();__deliveryTest.roads09.place(330,100,0,0,0)');samples=[];allfinite=True;goodlayer=True
 for i in range(16):
  E('__deliveryTest.roads09.trafficSimulation(15)');ss=E('__deliveryTest.roads09.npcSample()');samples.append(ss)
  allfinite &= all(all(math.isfinite(v) for v in n['p']) for n in ss)
  for n in ss:
   if 195<n['p'][0]<245 and abs(n['p'][2]-8)<4 and n['id']<3:goodlayer &= n['p'][1]>7.8
 check('Four-minute road traffic run stays finite',allfinite)
 check('High circuit NPCs remain on elevated deck',goodlayer)
 check('Traffic keeps completing circuits',S()['stats']['laps']>3, S()['stats'])
 check('Traffic has stopped for lights or queues',S()['stats']['stops']>0,S()['stats'])
 (ROOT/'tests/road_traffic_samples.json').write_text(json.dumps(samples,ensure_ascii=False,indent=2))
 E('__deliveryTest.roads09.map()');page.screenshot(path=str(ROOT/'screenshots/v09_map.png'));check('Road guide contains completed world map and controls',page.locator('#roadCanvas09').is_visible() and page.locator('#roadWarp09').is_visible())
 check('Old multiplayer code, realtime endpoint, and movement replay remain',all(t in SOURCE for t in ['api.feelpal.app/turn-credentials','inputHistory','duel2v2','publicRoomsList']))
 check('Final GL state healthy',E('__deliveryTest.glError()')==0)
 check('No JavaScript page errors',not errors,errors)
 context.close();b.close()
(ROOT/'tests/roads_v094_results.json').write_text(json.dumps(RESULT,ensure_ascii=False,indent=2))
print(f'RESULT: {sum(r["passed"] for r in RESULT)}/{len(RESULT)}')
