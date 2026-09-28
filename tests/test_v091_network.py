from test_utils import *
from test_bridge import Bridge
from playwright.sync_api import sync_playwright
import json
R=[]
def ck(n,v,d=None):R.append({'test':n,'passed':bool(v),'details':d});print(('PASS ' if v else 'FAIL ')+n,'' if v else d,flush=True)
with sync_playwright() as p:
 b=launch(p); hc,h,he=load(b,size=(1000,740)); gc,g,ge=load(b,mobile=True,size=(390,740)); br=Bridge(h,g)
 H=h.evaluate;G=g.evaluate
 H('__deliveryTest.freeze(true);__deliveryTest.clearTraffic();__deliveryTest.roads09.noTraffic()');br.advance(.2)
 H('__deliveryTest.forceTime(10);__deliveryTest.roads09.place(258,56,-Math.PI/2,8,0);__deliveryTest.roads09.input([])');br.advance(.8)
 hl=H('__deliveryTest.roads09.law()');gl=G('__deliveryTest.roads09.law()')
 ck('Host-authoritative traffic fine created',hl['red']==1 and hl['fines']==80,hl)
 ck('Traffic fine synchronized to guest',gl['red']==1 and gl['fines']==80,{'host':hl,'guest':gl})
 ck('Score deduction synchronized',H('__deliveryTest.snapshot().state.score')==-80 and G('__deliveryTest.snapshot().state.score')==-80)
 ck('Guest displays traffic-fine chip',g.locator('#trafficFine09').is_visible())
 ck('No runtime errors',not he and not ge,{'host':he,'guest':ge})
 hc.close();gc.close();b.close()
(ROOT/'tests/v091_network_results.json').write_text(json.dumps(R,ensure_ascii=False,indent=2),encoding='utf8')
print('TOTAL',sum(x['passed'] for x in R),'/',len(R))
