from test_utils import *
from playwright.sync_api import sync_playwright
import json
out=[]
def ck(name,ok,details=None):out.append({'test':name,'passed':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,details if not ok else '')
with sync_playwright() as p:
 b=launch(p)
 for size in [(320,640),(390,740),(844,390),(1280,800)]:
  mobile=size!=(1280,800);name=f'{size[0]}x{size[1]}'
  c,pg,errs=load(b,mobile,size)
  ck(name+' boot',pg.locator('#startBtn').is_enabled() and not errs,errs)
  pg.screenshot(path=str(ROOT/f'screenshots/menu_{name}.png'))
  ck(name+' lobby no horizontal overflow',pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  # A scrollable lobby is allowed; all controls must remain reachable.
  for btn in ['#garageBtn','#helpBtn','#startBtn']:
   pg.locator(btn).scroll_into_view_if_needed()
  pg.click('#startBtn');pg.evaluate('__deliveryTest.freeze(true);__deliveryTest.clearTraffic()')
  drive=pg.evaluate('''()=>['leftBtn','rightBtn','gasBtn','brakeBtn','cargoBtn','ordersBtn'].map(id=>{let r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height};})''')
  ck(name+' drive buttons in viewport',all(x['x']>=0 and x['y']>=0 and x['x']+x['w']<=size[0]+1 and x['y']+x['h']<=size[1]+1 for x in drive),drive)
  # Test Pointer Events simultaneous accelerator and steering.
  pg.locator('#gasBtn').dispatch_event('pointerdown',{'pointerId':11,'pointerType':'touch','button':0})
  pg.locator('#leftBtn').dispatch_event('pointerdown',{'pointerId':12,'pointerType':'touch','button':0})
  ctl=pg.evaluate('__deliveryTest.controls()')
  ck(name+' multi-pointer control streams',11 in ctl['gas'] and 12 in ctl['left'])
  pg.locator('#gasBtn').dispatch_event('pointercancel',{'pointerId':11,'pointerType':'touch'})
  ctl=pg.evaluate('__deliveryTest.controls()')
  ck(name+' cancel releases only that pointer',not ctl['gas'] and 12 in ctl['left'])
  pg.locator('#leftBtn').dispatch_event('pointerup',{'pointerId':12,'pointerType':'touch'})
  pg.evaluate('__deliveryTest.openOrders()');pg.wait_for_timeout(40)
  ck(name+' orders rendered',pg.locator('#orderList .job').count()==18 and pg.locator('#manifest').is_visible())
  pg.screenshot(path=str(ROOT/f'screenshots/orders_{name}.png'))
  pg.click('#closeOrdersBtn')
  # Show parcel IDs in the cargo, then an exterior handheld parcel.
  pg.evaluate('__deliveryTest.playerAt(0,-.8,Math.PI,-.6)');pg.wait_for_timeout(80)
  pg.screenshot(path=str(ROOT/f'screenshots/cargo_{name}.png'))
  pg.evaluate("__deliveryTest.outsideAt(8.5,25.1,-Math.PI/2,0);__deliveryTest.fixtureParcel(101,[0,0,0],'held');__deliveryTest.aimAt(101,0)")
  pg.wait_for_timeout(80)
  ck(name+' contextual exterior controls',pg.locator('#throwBtn').is_visible() and pg.locator('#driveUI').is_hidden())
  pg.screenshot(path=str(ROOT/f'screenshots/throw_{name}.png'))
  ck(name+' no runtime or GL errors',not errs and pg.evaluate('__deliveryTest.glError()')==0,errs)
  c.close()
 b.close()
(ROOT/'tests/ui_results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('TOTAL',sum(x['passed'] for x in out),'/',len(out))
