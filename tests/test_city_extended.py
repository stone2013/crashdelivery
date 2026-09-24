from test_utils import *
from test_bridge import Bridge
from playwright.sync_api import sync_playwright
import json, math
out=[]
def ck(n,ok,d=None):
 out.append({'test':n,'passed':bool(ok),'details':d});print(('PASS ' if ok else 'FAIL ')+n, d if not ok else '',flush=True)
def mapClick(pg,num):
 h=pg.evaluate(f'__deliveryTest.snapshot().houses.find(h=>h.num==={num})')
 r=pg.locator('#cityMap').bounding_box();x=(320+h['x']*586/320)/640;y=(320+h['z']*586/320)/640
 pg.mouse.click(r['x']+r['width']*x,r['y']+r['height']*y)
with sync_playwright() as p:
 b=launch(p);cx,pg,errs=load(b);E=pg.evaluate
 pg.click('#startBtn');E('__deliveryTest.freeze(true);__deliveryTest.place(25,100,0,0)')
 # Extended autonomous traffic simulation, cumulative per-car motion and stall recovery.
 old=E('__deliveryTest.city()');dist=[0.]*14;windows=[]
 for i in range(12):
  E('__deliveryTest.cityTrafficAdvance(20)');c=E('__deliveryTest.city()');windows.append(c['stats']['turns']-old['stats']['turns'])
  for k,(a,o) in enumerate(zip(c['traffic'],old['traffic'])):dist[k]+=math.hypot(a['p'][0]-o['p'][0],a['p'][2]-o['p'][2])
  old=c
 ck('Four-minute city: every traffic car changes position',min(dist)>25,{'distance_lower_bound':dist})
 ck('Four-minute city: throughput in every 20-second window',min(windows)>0,{'junction_completions':windows})
 ck('Four-minute city: no spontaneous wreck / NaN',all(t['phase']=='normal' and all(math.isfinite(v) for v in t['p']) for t in c['traffic']),c)
 # Same-side pedestrian avoidance.
 E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.cityClearTraffic();__deliveryTest.place(25,100);__deliveryTest.outsideAt(3.05,31,0,0);__deliveryTest.cityTrafficAt(0,0,56,0,0,0,[0,-56]);__deliveryTest.cityTrafficAdvance(5)')
 t=E('__deliveryTest.city().traffic[0]');ck('Walking courier causes NPC to stop at safe distance',t['p'][2]>34 and t['wait']=='pedestrian',t)
 # Check new outer region parcel recovery doesn't teleport to old map.
 E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.clearTraffic();__deliveryTest.outsideAt(-130,28,0,-.7);__deliveryTest.fixtureParcel(118,[-130,.5,26]);__deliveryTest.advance(2)')
 inv=E('__deliveryTest.v06().inventory');v=next(x for x in inv if x['order']==118)
 ck('Outer-district parcel survives beyond old map bounds',E('__deliveryTest.snapshot().packages.some(p=>p.p[0]<-120)'),v)
 # Desktop map selection / keyboard interactions, no unintended driving.
 pg.click('#mapOpenBtn');ck('Live city map opens with 18 selectable jobs',pg.locator('#cityScreen').is_visible() and E('__deliveryTest.city().orders')==18)
 mapClick(pg,118);ck('Tap address selects district / order detail', '#118' in pg.locator('#cityMapRoute').inner_text(),pg.locator('#cityMapRoute').inner_text())
 pg.click('#cityNavigateBtn');ck('Map selection sets authoritative task',E('__deliveryTest.v06().selectedOrder')==118 and not pg.locator('#cityScreen').is_visible())
 pg.click('#mapOpenBtn');before=E('__deliveryTest.snapshot().player.p');pg.keyboard.down('w');E('__deliveryTest.advance(.3)');pg.keyboard.up('w');after=E('__deliveryTest.snapshot().player.p')
 ck('Open map suppresses walking keyboard input',before==after,{'before':before,'after':after})
 pg.keyboard.press('Escape');ck('Escape closes map without changing play mode',not pg.locator('#cityScreen').is_visible() and E('__deliveryTest.snapshot().state.mode')=='playing')
 # Compact map layout at 320, landscape; accessible controls shouldn't spill.
 for size in [(320,640),(844,390)]:
  pg.set_viewport_size({'width':size[0],'height':size[1]});E('__deliveryTest.menu();__deliveryTest.openCityMap()');pg.wait_for_timeout(150)
  bounds=E('''()=>{let e=document.querySelector('#cityScreen .citySheet'),r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight,sw:e.scrollWidth,cw:e.clientWidth};}''')
  ck(f'City map stays within {size[0]}x{size[1]} viewport',bounds['l']>=0 and bounds['r']<=bounds['w']+.1 and bounds['b']<=bounds['h']+.1 and bounds['sw']<=bounds['cw']+1,bounds)
  ck(f'Menu map navigation disabled until playing {size}',pg.locator('#cityNavigateBtn').is_disabled())
  pg.locator('#closeCityMapBtn').scroll_into_view_if_needed();pg.click('#closeCityMapBtn');ck(f'Map close works at {size}',not pg.locator('#cityScreen').is_visible())
 ck('Extended city and map have no JS/GL errors',not errs and E('__deliveryTest.glError()')==0,errs)
 cx.close()
 # Two complete game contexts with existing bridge; only message transport substituted.
 hc,h,he=load(b);gc,g,ge=load(b,mobile=True,size=(390,740));br=Bridge(h,g);H=h.evaluate;G=g.evaluate
 H('__deliveryTest.freeze(true);__deliveryTest.place(25,100,0,0)');br.advance(3);br.pump(.8)
 ht=H('__deliveryTest.city().traffic');gt=G('__deliveryTest.city().traffic')
 # Guest interpolation may trail by several frames; health/intent must be exactly shared.
 ck('Both clients retain 14 traffic actors',len(ht)==len(gt)==14)
 ck('Traffic intent and signals use shared authoritative clock',[(t['id'],t['intent'],t['phase']) for t in ht]==[(t['id'],t['intent'],t['phase']) for t in gt] and abs(H('__deliveryTest.snapshot().state.time')-G('__deliveryTest.snapshot().state.time'))<.4)
 delta=max(math.hypot(a['p'][0]-o['p'][0],a['p'][2]-o['p'][2]) for a,o in zip(ht,gt));ck('Guest traffic tracks host positions after interpolation settle',delta<2.5,{'max_position_error':delta})
 G('__deliveryTest.openCityMap()');mapClick(g,118);g.click('#cityNavigateBtn');br.advance(.3)
 ck('Guest city map selection updates both navigators',H('__deliveryTest.v06().selectedOrder')==118 and G('__deliveryTest.v06().selectedOrder')==118)
 H("__deliveryTest.cityIncident(4,[3.05,.1,24],'wreck');__deliveryTest.publish()");br.pump(.5)
 ck('Incident phase and blocked-road map synchronize',G('__deliveryTest.city().traffic[4].phase')=='wreck' and len(G('__deliveryTest.city().blocked'))>0)
 H('__deliveryTest.cityTrafficAdvance(23);__deliveryTest.publish()');br.pump(.5)
 ck('Road clearance is shared without stale wreck',G('__deliveryTest.city().traffic[4].phase')=='cleared' and H('__deliveryTest.city().traffic[4].phase')=='cleared')
 H('__deliveryTest.reset()');br.advance(.5)
 ck('Restart resets city incidents/stats on both peers',not H('__deliveryTest.city().blocked') and not G('__deliveryTest.city().blocked') and G('__deliveryTest.city().stats.cleared')==0)
 ck('Updated network snapshot stays below 64 KiB',br.max_bytes<65536,{'max_bytes':br.max_bytes})
 ck('Two clients city additions have no runtime errors',not he and not ge and H('__deliveryTest.glError()')==G('__deliveryTest.glError()')==0,{'host':he,'guest':ge})
 b.close()
(ROOT/'tests/city_extended_results.json').write_text(json.dumps({'transport':'ordered JSON bridge; not an internet WebRTC connectivity test','checks':out},ensure_ascii=False,indent=2))
print('TOTAL',sum(x['passed'] for x in out),'/',len(out),flush=True)
