from test_utils import *
from playwright.sync_api import sync_playwright
import json
import time

results=[]
def ck(name,ok,details=None):
 results.append({'test':name,'passed':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,details if not ok else '',flush=True)

def make_link(host, guest, slot):
 for page, ident, mode, player_slot in [(host,f'h{slot}','host',slot),(guest,f'g{slot}','guest',slot)]:
  page.evaluate('''({ident,mode,slot})=>{window.links=window.links||{};const channel={readyState:'connecting',bufferedAmount:0,out:[],send:s=>channel.out.push(s),close:()=>{channel.readyState='closed';channel.onclose?.();}};links[ident]=channel;__deliveryTest.attachRTC(channel,mode,'four-room',slot);}''',{'ident':ident,'mode':mode,'slot':player_slot})
 host.evaluate('id=>{const c=links[id];c.readyState="open";c.onopen?.();}',f'h{slot}')
 guest.evaluate('id=>{const c=links[id];c.readyState="open";c.onopen?.();}',f'g{slot}')

def pump(host, peers, duration=.25):
 end=time.monotonic()+duration
 while True:
  for index,guest in enumerate(peers,1):
   messages=host.evaluate('id=>links[id].out.splice(0)',f'h{index}')
   if messages:guest.evaluate('args=>args[1].forEach(data=>links[args[0]].onmessage({data}))',(f'g{index}',messages))
   messages=guest.evaluate('id=>links[id].out.splice(0)',f'g{index}')
   if messages:host.evaluate('args=>args[1].forEach(data=>links[args[0]].onmessage({data}))',(f'h{index}',messages))
  if time.monotonic()>=end:break
  host.wait_for_timeout(15)

with sync_playwright() as p:
 browser=launch(p);hc,host,host_errors=load(browser,size=(480,320));host.evaluate('__deliveryTest.roomBrowser.setCapacity(4);__deliveryTest.freeze(true);__deliveryTest.quality("low")')
 pages=[];contexts=[];errors=[]
 for slot in range(1,4):
  print('Creating guest',slot,flush=True)
  context,guest,err=load(browser,True,(320,480));guest.evaluate('__deliveryTest.freeze(true);__deliveryTest.quality("low")');contexts.append(context);pages.append(guest);errors.extend(err)
  print('Attaching guest',slot,flush=True);make_link(host,guest,slot);pump(host,pages,.2);print('Guest attached',slot,flush=True)
 state=host.evaluate("({roster:__deliveryTest.network().roster,actors:__deliveryTest.networkSnapshot().actors.map(a=>a&&a.id)})")
 ck('Four distinct actors admitted',len(state['roster'])==4 and [x for x in state['actors']if x is not None]==[0,1,2,3],state)
 ck('Fourth guest has ID 3',pages[-1].evaluate('__deliveryTest.network().playerId')==3)
 host.evaluate('__deliveryTest.roads09.start();__deliveryTest.publish()');pump(host,pages,.4)
 ck('All four clients share road-trial state',all(g.evaluate('__deliveryTest.roads09.snapshot().trial.index')==0 for g in pages))
 ck('Four-player protocol has no runtime errors',not host_errors and not errors)
 for context in contexts:context.close()
 hc.close();browser.close()
(ROOT/'tests/road_four_player_results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print('TOTAL',sum(x['passed']for x in results),'/',len(results))
