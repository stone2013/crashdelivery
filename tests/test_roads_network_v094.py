from test_utils import *
from test_bridge import Bridge
from playwright.sync_api import sync_playwright
import json,math
R=[]
def ck(n,v,d=None):R.append({'test':n,'passed':bool(v),'details':d});print(('PASS 'if v else 'FAIL ')+n,d if not v else '',flush=True)
with sync_playwright() as p:
 b=launch(p);c,h,he=load(b);cc,g,ge=load(b,True,(390,740));H=h.evaluate;G=g.evaluate
 H('__deliveryTest.freeze(true)');G('__deliveryTest.freeze(true)');bridge=Bridge(h,g)
 ck('Both clients joined same V0.9 protocol',H('__deliveryTest.network().connected') and G('__deliveryTest.network().connected'))
 H('__deliveryTest.roads09.start();__deliveryTest.publish()');bridge.pump(.4)
 ck('Host trial selection replicated',G('__deliveryTest.roads09.snapshot().trial.index')==0)
 H('__deliveryTest.roads09.noTraffic();__deliveryTest.clearTraffic();__deliveryTest.roads09.place(211,8,-Math.PI/2,0,8);__deliveryTest.publish()');bridge.pump(.6)
 hs=H('__deliveryTest.roads09.snapshot()');gs=G('__deliveryTest.roads09.snapshot()');ck('Guest van is rendered at authority bridge height',abs(gs['car']['p'][1]-hs['car']['p'][1])<.1,{'h':hs['car'],'g':gs['car']})
 ck('Extra district NPC state replicated',len(gs['npc'])==5 and gs['npc'][0]['phase']==hs['npc'][0]['phase'])
 before=G('__deliveryTest.roads09.moveSample()');g.keyboard.down('w');G('()=>new Promise(resolve=>{let frames=0;function next(){if(++frames>=5)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);})');after=G('__deliveryTest.roads09.moveSample()');ck('Guest walking responds over rendered frames without new authority packet',after['p'][2]!=before['p'][2],{'before':before,'after':after})
 bridge.advance(.5);g.keyboard.up('w');bridge.pump(.12);bridge.advance(.1)
 guest=G('__deliveryTest.roads09.moveSample()');ck('Guest body remains in vehicle-local coordinates',guest['view']=='cargo' and abs(guest['p'][0])<1.3 and -1.5<guest['p'][2]<3.6,guest)
 ck('Cargo local point follows elevated world transform',guest['world'][1]>9,guest)
 # A host snapshot explicitly includes road pitch / layer and state; apply does not re-run the NPC AI on guest.
 H('__deliveryTest.roads09.place(167,8,-Math.PI/2,4,4);__deliveryTest.advance(.1);__deliveryTest.publish()');bridge.pump(.7)
 hs=H('__deliveryTest.roads09.snapshot()');gs=G('__deliveryTest.roads09.snapshot()');ck('Incline pitch replicated to passenger renderer',abs(gs['car']['pitch']-hs['car']['pitch'])<.02,{'h':hs['car'],'g':gs['car']})
 H('__deliveryTest.roads09.place(211,8,-Math.PI/2,0,8);__deliveryTest.publish()');bridge.pump(.7)
 g.screenshot(path=str(ROOT/'screenshots/v09_coop_cargo_phone.png'))
 msg=H('__deliveryTest.roads09.authoritative()');ck('Network packet carries distinct V0.9 metadata',msg['protocol']=='crash-delivery-mp094-1' and msg['roads09']['revision']==2)
 ck('One serialized world packet stays below 64KiB',len(json.dumps(msg).encode())<65536,len(json.dumps(msg).encode()))
 # Verify guest cannot teleport group; local click is rejected and authority stays intact.
 old=H('__deliveryTest.roads09.snapshot().car.p');G('__deliveryTest.roads09.start()');bridge.pump(.3);new=H('__deliveryTest.roads09.snapshot().car.p');ck('Guest cannot relocate the shared vehicle',sum((a-bb)**2 for a,bb in zip(old,new))<.05)
 H('__deliveryTest.roads09.city();__deliveryTest.publish()');bridge.pump(.8);ck('Return to old city synchronized',G('__deliveryTest.roads09.snapshot().car.p[0]')<120 and G('__deliveryTest.roads09.snapshot().trial') is None)
 ck('Both clients retain 18 orders',H('__deliveryTest.roads09.coreCount().orders')==18 and G('__deliveryTest.roads09.coreCount().orders')==18)
 ck('No JS errors in host or guest',not he and not ge,{'host':he,'guest':ge})
 ck('WebGL healthy on both clients',H('__deliveryTest.glError()')==0 and G('__deliveryTest.glError()')==0)
 c.close();cc.close();b.close()
(ROOT/'tests/roads_network_v094_results.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print('TOTAL',sum(x['passed'] for x in R),'/',len(R))
