"""Actual in-memory WebGL gameplay and ordered JSON synchronization; not a TURN test."""
from pathlib import Path
import sys, json, time, base64
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from browser_helpers import ROOT,offline_html,launch
from playwright.sync_api import sync_playwright
results=[]
def ck(name, ok, detail=None):
 results.append(dict(test=name,passed=bool(ok),detail=detail));print('PASS' if ok else 'FAIL', name, str(detail or '')[:230],flush=True)

def setup(browser):
 page=browser.new_page(viewport={'width':960,'height':640});page.on('dialog',lambda d:d.accept())
 page.set_content(offline_html(ROOT/'index.html').replace('requestAnimationFrame(frame);','window.__qaFrame=frame;'),wait_until='domcontentloaded')
 page.wait_for_function('window.__industrial012Ready===true',timeout=15000)
 page.evaluate('__deliveryTest.v0102.reset()')
 return page

def bridge(host,guest,slot=1):
 for pg,mode in [(host,'host'),(guest,'guest')]:
  pg.evaluate('''a=>{window.wireOut=[];window.wire={readyState:'connecting',bufferedAmount:0,send:s=>wireOut.push(s),close:()=>{wire.readyState='closed';wire.onclose?.();}};__deliveryTest.attachRTC(wire,a.mode,'246810',a.slot);}''',dict(mode=mode,slot=slot))
 host.evaluate("wire.readyState='open';wire.onopen()")
 guest.evaluate("wire.readyState='open';wire.onopen()")
 pump(host,guest,12)
def pump(host,guest,n=3):
 for _ in range(n):
  for src,dst in [(host,guest),(guest,host)]:
   msgs=src.evaluate('wireOut.splice(0)')
   if msgs:dst.evaluate('msgs=>{for(const s of msgs)wire.onmessage({data:s})}',msgs)
  host.wait_for_timeout(10)
def publish(h,g):h.evaluate('__deliveryTest.publish()');pump(h,g)
def panes(pg):return pg.evaluate('__deliveryTest.v0102.panes()')
with sync_playwright() as pw:
 b=launch(pw);h=setup(b);errs=[];h.on('pageerror',lambda e:errs.append(str(e)))
 # Complete full round using actual parcel trajectories; never directly award orders.
 for n in range(101,119):
  opts={'y':2.6} if n in [108,112] else {}
  shot=h.evaluate('a=>__deliveryTest.v0102.fire(a.n,a.opts)',dict(n=n,opts=opts));h.evaluate('__deliveryTest.advance(1.1)')
  snap=h.evaluate('__deliveryTest.snapshot()')
  ck('Complete round, actual throw #'+str(n),next(x for x in snap['houses'] if x['num']==n)['done'],{'total':snap['state']['delivered']})
 ck('All 18 delivered without direct award',snap['state']['delivered']==18)
 ck('Round ends and income is finite',h.evaluate('__deliveryTest.snapshot().state.mode==="finished" && Number.isFinite(__deliveryTest.snapshot().state.score)'))
 h.evaluate('__deliveryTest.v0102.reset()')
 for n in [107,109,111,108,112]:
  h.evaluate('__deliveryTest.v0102.reset()')
  shot=h.evaluate('n=>__deliveryTest.v0102.fire(n,{dx:6,y:2.8})',n);h.evaluate('__deliveryTest.advance(1.4)')
  ck('Miss outside receiving aperture rejected #'+str(n),h.evaluate('__deliveryTest.snapshot().state.delivered')==0)
 # Genuine alpha hole and bounded texture updates at rest.
 h.evaluate('__deliveryTest.v0102.reset();__deliveryTest.v0102.damageWindow(111,0,0,0);__deliveryTest.v0102.glassCamera(111)')
 raw=h.evaluate('__deliveryTest.v0102.texture(111)');from PIL import Image
 import io
 im=Image.open(io.BytesIO(base64.b64decode(raw.split(',')[1]))).convert('RGBA');a=im.getchannel('A')
 ck('Glass texture center is transparent',a.getpixel((im.width//2,im.height//2))==0)
 ck('Glass remains outside the hole',a.getpixel((10,10))>50)
 old=h.evaluate('__deliveryTest.v0102.glass()');h.evaluate('for(let i=0;i<50;i++)__deliveryTest.v0102.glassCamera(111)');new=h.evaluate('__deliveryTest.v0102.glass()')
 ck('No repeated GPU texture upload at unchanged pane',old['uploads']==new['uploads'],[old,new])
 ck('Pane texture cache remains bounded',new['panes']<=90,new['panes'])
 # Two-client transport for host authority and persistent hole state.
 h.evaluate('__deliveryTest.v0102.reset()');g=setup(b);g.on('pageerror',lambda e:errs.append(str(e)))
 bridge(h,g)
 ck('Host and guest connected on ordered JSON transport',h.evaluate('__deliveryTest.network().connected') and g.evaluate('__deliveryTest.network().connected'))
 ck('Layout identical on both clients',h.evaluate('__deliveryTest.v0102.info().audit')==g.evaluate('__deliveryTest.v0102.info().audit'))
 h.evaluate('__deliveryTest.v0102.damageWindow(111,0,.3,-.25)');publish(h,g)
 ck('Glass impact coordinates/radius/seed synchronized',panes(h)==panes(g))
 # Inert guest request cannot create authority-owned hole locally.
 before=panes(g);g.evaluate('__deliveryTest.v0102.damageWindow(101,0,.7,.1)')
 ck('Guest cannot manufacture a glass hole',before==panes(g))
 # Serialize actual host-side package flight and let guest consume authoritative state.
 shot=h.evaluate('__deliveryTest.v0102.fire(107)');h.evaluate('__deliveryTest.advance(1.2)');publish(h,g)
 hs=h.evaluate('__deliveryTest.snapshot()');gs=g.evaluate('__deliveryTest.snapshot()')
 ck('Industrial delivery result reaches guest',hs['state']['delivered']==gs['state']['delivered']==1)
 ck('Industrial score is identical, no double billing',hs['state']['score']==gs['state']['score'])
 publish(h,g);publish(h,g)
 ck('Repeated world snapshots do not duplicate score',g.evaluate('__deliveryTest.snapshot().state.score')==hs['state']['score'])
 # Missed incremental fx recovers using full authoritative snapshot.
 h.evaluate('__deliveryTest.v0102.damageWindow(101,0,-.2,.25);wireOut.length=0')
 publish(h,g);ck('Full snapshot restores missed glass event',panes(h)==panes(g))
 h.evaluate('__deliveryTest.reset();__deliveryTest.publish()');pump(h,g,8)
 ck('Host restart clears cracks on both clients',all(not x['holes'] for x in panes(h)) and all(not x['holes'] for x in panes(g)))
 ck('Open industrial bays survive synchronized restart',h.evaluate('__deliveryTest.v0102.info().targets.length')==g.evaluate('__deliveryTest.v0102.info().targets.length')==6)
 ck('No errors in two-client checks',not errs,errs)
 ck('WebGL contexts healthy',h.evaluate('__deliveryTest.glError()')==g.evaluate('__deliveryTest.glError()')==0)
 (ROOT/'tests/V0102_EXTENDED_RESULTS.json').write_text(json.dumps({'checks':results,'passed':sum(x['passed'] for x in results),'total':len(results),'errors':errs},ensure_ascii=False,indent=2))
 print('SUMMARY',sum(x['passed'] for x in results),'/',len(results),flush=True);b.close()
