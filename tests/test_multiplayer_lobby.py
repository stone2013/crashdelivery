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
 browser=launch(p)
 # Desktop and phone menu interaction, selection persistence, and public-list rendering.
 for size in [(1280,800),(390,740),(320,640),(844,390)]:
  mobile=size[0]<600 or (size[1]<540)
  ctx,page,errors=load(browser,mobile,size)
  page.click('#multiplayerBtn')
  if size in [(1280,800),(390,740)]:page.screenshot(path=str(ROOT/f'screenshots/multiplayer_lobby_{size[0]}.png'))
  ck(f'{size}: multiplayer menu opens',page.locator('#multiplayerScreen').is_visible())
  ck(f'{size}: create and room-code join share the multiplayer menu',page.locator('#hostBtn').is_visible() and page.locator('#roomCode').is_visible() and page.locator('#joinBtn').is_visible())
  for n in [2,3,4]:
   page.locator(f'[data-room-size="{n}"]').click()
   state=page.evaluate('''n=>({selected:document.querySelector(`[data-room-size="${n}"]`).classList.contains('active'),capacity:__deliveryTest.roomBrowser.capacity()})''',n)
   ck(f'{size}: capacity {n} selection is applied',state['selected'] and state['capacity']==n,state)
  page.evaluate("__deliveryTest.roomBrowser.render([{roomCode:'314159',hostName:'测试车队',players:2,maxPlayers:4,updatedAt:Date.now()}])")
  ck(f'{size}: online room row shows occupancy and join action',page.locator('.publicRoomRow').count()==1 and page.locator('.publicRoomMeta').inner_text()=='2/4 人' and page.locator('.joinPublicRoom').is_visible())
  bounds=page.evaluate('''()=>{const r=document.querySelector('.multiLobby').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,sw:document.documentElement.scrollWidth,iw:innerWidth}}''')
  ck(f'{size}: multiplayer panel stays inside viewport width',bounds['left']>=0 and bounds['right']<=size[0]+1 and bounds['sw']<=bounds['iw'],bounds)
  ck(f'{size}: no JavaScript errors',not errors,errors)
  ctx.close()

 # Route all three independent guest input links into one host to check actor slots and four-player occupancy.
 hc,host,host_errors=load(browser,size=(1000,740))
 pages=[];contexts=[];guest_errors=[]
 host.evaluate('__deliveryTest.roomBrowser.setCapacity(4);__deliveryTest.freeze(true)')
 for slot in range(1,4):
  context,guest,errors=load(browser,mobile=slot==3,size=(390,740))
  contexts.append(context);pages.append(guest);guest_errors.append(errors);guest.evaluate('__deliveryTest.freeze(true)')
  make_link(host,guest,slot);pump(host,pages,.5)
 state=host.evaluate("({roster:__deliveryTest.network().roster,actors:__deliveryTest.networkSnapshot().actors.map(a=>a&&a.id),players:document.querySelectorAll('#playersList .playerRow').length})")
 ck('Four-person room assigns host plus three unique guest slots',len(state['roster'])==4 and [x for x in state['actors'] if x is not None]==[0,1,2,3],state)
 ck('Fourth player is identified as slot 3',pages[2].evaluate('__deliveryTest.network().playerId')==3)
 host.click('#playersBtn')
 host.screenshot(path=str(ROOT/'screenshots/player_list_v075_desktop.png'))
 ck('Four-player in-game roster shows all members and 4/4 capacity',host.locator('#playersPanel').is_visible() and host.locator('#playersList .playerRow').count()==4 and host.locator('#playerCountLabel').inner_text()=='4/4')
 ck('Host and all guests have no runtime errors',not host_errors and all(not errors for errors in guest_errors),{'host':host_errors,'guests':guest_errors})
 for context in contexts:context.close()
 hc.close();browser.close()

Path(ROOT/'tests/multiplayer_lobby_results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('TOTAL',sum(x['passed'] for x in results),'/',len(results))
