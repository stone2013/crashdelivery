from test_utils import *
from test_bridge import Bridge
from playwright.sync_api import sync_playwright
import json,math
results=[]
def ck(n,ok,detail=None):results.append({'test':n,'passed':bool(ok),'details':detail});print(('PASS ' if ok else 'FAIL ')+n,detail if not ok else '')
with sync_playwright() as p:
 b=launch(p)
 hc,h,he=load(b,size=(900,620));gc,g,ge=load(b,size=(700,620))
 br=Bridge(h,g);h.evaluate('__deliveryTest.freeze(true);__deliveryTest.clearTraffic()');br.advance(.1)
 for house in h.evaluate('__deliveryTest.snapshot().houses'):
  x,y,z=house['gates'][0]['center'];yaw=house['yaw'];num=house['num'];x+=7*math.sin(yaw);z+=7*math.cos(yaw)
  h.evaluate('''q=>{__deliveryTest.outsideAt(q.x,q.z,0,0);__deliveryTest.fixtureParcel(q.num,[0,0,0],'held');__deliveryTest.aimAt(q.num,0);__deliveryTest.shoot(1);}''',{'x':x,'z':z,'num':num})
  br.advance(1.6)
  done=h.evaluate('__deliveryTest.snapshot().houses.find(h=>h.num=='+str(num)+').done')
  ck('Shipment '+str(num)+' complete through actual facade',done)
 ck('Both players reach end of eighteen-job round',h.evaluate('__deliveryTest.snapshot().state.mode')=='finished' and g.evaluate('__deliveryTest.snapshot().state.mode')=='finished')
 before=[pg.evaluate('__deliveryTest.v06().credits') for pg in [h,g]]
 for i in range(5):h.evaluate('__deliveryTest.publish()');br.pump(.06)
 after=[pg.evaluate('__deliveryTest.v06().credits') for pg in [h,g]]
 ck('Repeated final snapshots cannot double-pay',before==after and before[0]>0 and before[1]>0,{'before':before,'after':after})
 ck('Full round has no JS or GL errors',not he and not ge and h.evaluate('__deliveryTest.glError()')==0 and g.evaluate('__deliveryTest.glError()')==0,{'h':he,'g':ge})
 h.screenshot(path=str(ROOT/'screenshots/complete_round.png'))
 b.close()
(ROOT/'tests/finish_results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
