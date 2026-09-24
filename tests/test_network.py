from test_utils import *
from test_bridge import Bridge
from playwright.sync_api import sync_playwright
import json
results=[]
def ck(name,ok,details=None):results.append({'test':name,'passed':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,details if not ok else '')
with sync_playwright() as p:
 b=launch(p)
 hc,h,he=load(b,size=(1000,740));gc,g,ge=load(b,mobile=True,size=(390,740))
 for pg,name in [(h,'司机老石'),(g,'投递小蓝')]:pg.locator('#nicknameInput').fill(name);pg.locator('#nicknameInput').dispatch_event('change')
 br=Bridge(h,g)
 h.evaluate('__deliveryTest.freeze(true);__deliveryTest.clearTraffic()');br.advance(.1)
 H=lambda x:h.evaluate(x);G=lambda x:g.evaluate(x)
 def hs():return H('__deliveryTest.snapshot()')
 def gs():return G('__deliveryTest.snapshot()')
 def hi():return H('__deliveryTest.v06()')
 def gi():return G('__deliveryTest.v06()')
 ck('Host and guest initialize independently',hs()['state']['view']=='drive' and gs()['state']['view']=='cargo')
 ck('Nickname handshake',G('__deliveryTest.avatar().other.name')=='司机老石' and H('__deliveryTest.network().remote.name')=='投递小蓝')
 ck('Eighteen IDs synchronize',[(x['id'],x['order']) for x in hi()['inventory']]==[(x['id'],x['order']) for x in gi()['inventory']])
 G('__deliveryTest.selectOrder(108)');br.advance(.1)
 ck('Guest updates shared order navigation',hi()['selectedOrder']==108 and gi()['selectedOrder']==108)
 # Occupancy and role swap.
 G('__deliveryTest.view("drive")');br.advance(.1)
 ck('Cannot steal occupied driver seat',hs()['state']['view']=='drive' and gs()['state']['view']=='cargo')
 H('__deliveryTest.view("cargo")');br.advance(.6)
 G('__deliveryTest.view("drive")');br.advance(.6)
 ck('Guest can take empty driver seat',gs()['state']['view']=='drive' and hs()['state']['view']=='cargo',{'h':hs()['state']['view'],'g':gs()['state']['view']})
 # Host input should no longer affect steering/vehicle when guest is driver.
 h.keyboard.down('w');br.advance(.3);h.keyboard.up('w')
 ck('Cargo player cannot drive',abs(hs()['car']['speed'])<.02,hs()['car']['speed'])
 g.keyboard.down('w');br.pump(.18);br.advance(.5);g.keyboard.up('w');br.pump(.08)
 ck('Guest gas drives authoritative vehicle',hs()['car']['speed']>2,hs()['car']['speed'])
 # Reset session and confirm old packets can't steal orders.
 H('__deliveryTest.reset();__deliveryTest.clearTraffic()');br.advance(.7)
 ck('Restart preserves nicknames',H('__deliveryTest.network().remote.name')=='投递小蓝' and G('__deliveryTest.avatar().other.name')=='司机老石')
 ck('Host restart syncs epoch and roles',hs()['state']['view']=='drive' and gs()['state']['view']=='cargo' and len(gi()['inventory'])==18)
 # Old epoch action must have no effect.
 G("wire.send(JSON.stringify({t:'action',name:'selectOrder',args:{num:112},seq:100000,epoch:0,input:{keys:[]}}))");br.advance(.1)
 ck('Stale-epoch action rejected',hi()['selectedOrder']!=112)
 # Put guest at rear and interact with doors; sole shared door state.
 H('__deliveryTest.remotePlace(.42,2.8,Math.PI,-.2)');br.pump(.2)
 G('__deliveryTest.bothDoors()');br.advance(1)
 ck('Guest door actions synchronize',all(d['target']>0 for d in hs()['doors']) and all(d['angle']>1.1 for d in gs()['doors']))
 G('__deliveryTest.mobility()');br.advance(.5)
 ck('Guest can exit to world',gs()['state']['view']=='outside' and H('__deliveryTest.network().remote.view')=='outside')
 # Ground pickup is authoritative, preserves metadata.
 H("__deliveryTest.fixtureParcel(104,[8,.5,70]);__deliveryTest.remoteOutside(8,71.1,0,-.85);__deliveryTest.publish()");br.pump(.3)
 G('__deliveryTest.lookAt([8,.5,70]);__deliveryTest.interact()');br.advance(.2)
 ck('Guest recovers a tagged fragile parcel',gi()['held'] is not None and gi()['held']['order']==104 and H('__deliveryTest.network().remote.held.order')==104,gi()['held'])
 ck('Recovery inventory has no duplicate ID',len(hi()['inventory'])==18 and len(set(x['id'] for x in hi()['inventory']))==18)
 G('__deliveryTest.drop()');br.advance(.3)
 ck('Guest exterior drop synchronizes',gi()['held'] is None and any(x['order']==104 for x in hi()['inventory']))
 # Two players trying to take same ground parcel; host wins, guest cannot duplicate it.
 H("__deliveryTest.fixtureParcel(101,[8,.5,70]);__deliveryTest.outsideAt(8,71.1,0,-.85);__deliveryTest.remoteOutside(8,71.1,0,-.85);__deliveryTest.publish()");br.pump(.2)
 G('__deliveryTest.lookAt([8,.5,70])');H('__deliveryTest.interact()');G('__deliveryTest.interact()');br.advance(.2)
 owners=int(hi()['held'] is not None and hi()['held']['order']==101)+int((H('__deliveryTest.network().remote.held') or {}).get('order')==101)
 ck('Simultaneous pickup has only one owner',owners==1 and len(set(x['id'] for x in hi()['inventory']))==18,{'owners':owners,'inv':hi()['inventory']})
 # Rescue whilst guest holding: gather existing parcels and restow exactly once.
 H('__deliveryTest.service()');br.advance(.5)
 ck('Rescue with two couriers preserves uniqueness',len(hi()['inventory'])==18 and len(gi()['inventory'])==18 and len(set(x['order'] for x in hi()['inventory']))==18)
 # Guest throws a correct parcel through a window: send normal charge/release, server simulates trajectory.
 H("__deliveryTest.fixtureParcel(101,[8.5,.5,25.1]);__deliveryTest.remoteOutside(8.5,26.2,0,-.9);__deliveryTest.publish()");br.pump(.3)
 G('__deliveryTest.interact()');br.advance(.2)
 ck('Guest holds matching order before throw',gi()['held'] is not None and gi()['held']['order']==101,gi()['held'])
 G('__deliveryTest.aimAt(101,0)')
 g.keyboard.down('Space');br.pump(.1);br.advance(1);g.keyboard.up('Space');br.pump(.12);br.advance(1.4)
 ck('Guest real throw signs matching order',hs()['state']['delivered']==1 and gs()['state']['delivered']==1,{'h':hs()['state'],'g':gs()['state']})
 ck('Both peers agree on money and damage',hs()['state']['score']==gs()['state']['score'] and hs()['state']['damageCost']==gs()['state']['damageCost'])
 ck('Held item clears after acknowledged throw',gi()['held'] is None and H('__deliveryTest.network().remote.held') is None)
 # Guest repair.
 H("__deliveryTest.fault(22);const p=__deliveryTest.snapshot().car.p;__deliveryTest.remoteOutside(p[0],p[2]-4.9,Math.PI,-.3);__deliveryTest.publish()");br.pump(.3)
 G('__deliveryTest.interact()');br.advance(.3)
 ck('Guest repair progress synchronized',gi()['repair'] is not None and H('__deliveryTest.network().remote.repair') is not None,gi()['repair'])
 br.advance(3)
 ck('Guest repair mutates shared car once',hs()['car']['hp']==100 and gs()['car']['hp']==100 and hi()['repairs']==1 and gi()['repairs']==1)
 # Shared pause.
 G('__deliveryTest.pause()');br.pump(.3)
 ck('Guest pause freezes both',hs()['state']['mode']=='paused' and gs()['state']['mode']=='paused')
 G('__deliveryTest.resume()');br.pump(.3)
 ck('Guest resume returns both',hs()['state']['mode']=='playing' and gs()['state']['mode']=='playing')
 # Capture a real rendered coop repair setup (no screenshot state spoof).
 H('__deliveryTest.reset();__deliveryTest.clearTraffic()');br.advance(.5)
 H("__deliveryTest.place(3.2,72,0,0);__deliveryTest.outsideAt(8,64,-.4,-.08);__deliveryTest.remoteOutside(3.2,67.1,Math.PI,-.3);__deliveryTest.fault(40);__deliveryTest.publish()");br.pump(.4)
 H('__deliveryTest.lookAt([3.2,1.6,68.2])');G('__deliveryTest.lookAt([3.2,1.9,69]);__deliveryTest.interact()');br.advance(.6)
 h.screenshot(path=str(ROOT/'screenshots/cooperation_desktop.png'));g.screenshot(path=str(ROOT/'screenshots/repair_phone.png'))
 ck('No runtime errors in two pages',not he and not ge,{'host':he,'guest':ge})
 ck('WebGL stays valid on both',H('__deliveryTest.glError()')==0 and G('__deliveryTest.glError()')==0)
 ck('World snapshot stays below 64KiB',br.max_bytes<65536,{'max_message_bytes':br.max_bytes,'messages':br.sent})
 # Disconnect recovery prevents unattended simulation and returns held parcel.
 h.evaluate("wire.close()");br.pump(.2)
 ck('Disconnect pauses host',hs()['state']['mode']=='paused')
 b.close()
(ROOT/'tests/network_results.json').write_text(json.dumps({'transport':'ordered JSON bridge; NOT an ICE/P2P connectivity test','checks':results},ensure_ascii=False,indent=2))
print('TOTAL',sum(x['passed'] for x in results),'/',len(results))
