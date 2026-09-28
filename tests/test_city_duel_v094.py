"""Four Chromium clients in the real 2v2 runtime, over an ordered JSON test bridge.
Tests mode entry, rendered city roads, shared state and actual driving, not a full match.
"""
from test_utils import *
from playwright.sync_api import sync_playwright
import json,time
R=[]
def ck(n,v,d=None):
 R.append({'test':n,'passed':bool(v),'details':d});print(('PASS ' if v else 'FAIL ')+n,d if not v else '',flush=True)
def link(host,g,slot):
 for page,name,mode in [(host,f'h{slot}','host'),(g,f'g{slot}','guest')]:
  page.evaluate('''([id,mode,slot])=>{window.wires=window.wires||{};const w={readyState:'connecting',bufferedAmount:0,out:[],send:m=>w.out.push(m),close:()=>{w.readyState='closed';w.onclose?.();}};wires[id]=w;__deliveryTest.attachRTC(w,mode,'duel094',slot);}''',[name,mode,slot])
 for page,name in [(host,f'h{slot}'),(g,f'g{slot}')]:page.evaluate('id=>{wires[id].readyState="open";wires[id].onopen?.();}',name)
def pump(h,guests,seconds=.2):
 end=time.monotonic()+seconds
 while True:
  for i,g in enumerate(guests,1):
   for src,dst,sid,did in [(h,g,f'h{i}',f'g{i}'),(g,h,f'g{i}',f'h{i}')]:
    ms=src.evaluate('id=>wires[id].out.splice(0)',sid)
    if ms:dst.evaluate('([id,ms])=>ms.forEach(data=>wires[id].onmessage({data}))',[did,ms])
  if time.monotonic()>=end:break
  h.wait_for_timeout(15)
with sync_playwright() as p:
 b=launch(p);hc,h,he=load(b,size=(800,480));h.evaluate("__deliveryTest.freeze(true);__deliveryTest.quality('low');setCrashDeliveryRoomMode('duel2v2')")
 guests=[];contexts=[hc];errs=[he]
 for slot in range(1,4):
  c,g,e=load(b,mobile=True,size=(390,844) if slot==1 else (480,320));contexts.append(c);errs.append(e);guests.append(g)
  g.evaluate("__deliveryTest.freeze(true);__deliveryTest.quality('low');setCrashDeliveryRoomMode('duel2v2')")
  link(h,g,slot);pump(h,guests,.1)
 h.evaluate('__deliveryTest.advance(.25);__deliveryTest.publish()');pump(h,guests,.45)
 m=h.evaluate('__deliveryTest.networkSnapshot().duel')
 ck('Real 2v2 room starts after fourth client joins',m is not None and m['active'],m)
 ck('Host publishes two distinct team vehicles',m is not None and set(m['trucks'])=={'amber','teal'})
 for i,pg in enumerate([h]+guests):
  pg.evaluate('__deliveryTest.roads09.camera(null)');pg.wait_for_timeout(150)
  draws=pg.evaluate('__deliveryTest.cityRoads094.drawCounts()')
  ck(f'Player {i+1} actually renders renewed city road geometry',draws['visible']>0 and draws['triangles']>0,{'visible':draws['visible'],'triangles':draws['triangles']})
 before=m['trucks']['amber']['vehicle']['p']
 h.keyboard.down('w')
 for i in range(10):h.evaluate('__deliveryTest.advance(.2);__deliveryTest.publish()');pump(h,guests,.05)
 h.keyboard.up('w');h.evaluate('__deliveryTest.publish()');pump(h,guests,.4)
 after=h.evaluate('__deliveryTest.networkSnapshot().duel')
 p2=after['trucks']['amber']['vehicle']['p']
 ck('2v2 driver moves via real input and authority ticks',sum((a-bb)**2 for a,bb in zip(before,p2))>.3,{'before':before,'after':p2})
 # Authority is already delivered; let the guest run its scheduled visual interpolation frames.
 guests[0].evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
 remote=guests[0].evaluate('__deliveryTest.roads09.snapshot().car.p')
 ck('Teammate receives moved team vehicle',sum((a-bb)**2 for a,bb in zip(p2,remote))<.5,{'host':p2,'guest':remote})
 ck('All four clients retain healthy WebGL',all(pg.evaluate('__deliveryTest.glError()')==0 for pg in [h]+guests))
 ck('No 2v2 JavaScript errors',not any(errs),errs)
 h.screenshot(path=str(ROOT/'screenshots/v094_duel_desktop.png'))
 for c in contexts:c.close()
 b.close()
(ROOT/'tests/city_duel_v094_results.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
print('TOTAL',sum(x['passed'] for x in R),'/',len(R))
if not all(x['passed'] for x in R):raise SystemExit(1)
