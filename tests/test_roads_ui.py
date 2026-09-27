from test_utils import *
from playwright.sync_api import sync_playwright
import json
R=[]
def ck(n,v,d=None):R.append({'test':n,'passed':bool(v),'details':d});print(('PASS 'if v else 'FAIL ')+n,d if not v else '',flush=True)
with sync_playwright() as p:
 b=launch(p)
 for w,h in [(320,640),(390,740),(844,390),(1280,800)]:
  c,pg,err=load(b,w<1000,(w,h));E=pg.evaluate;E('__deliveryTest.freeze(true)');prefix=f'{w}x{h} '
  ck(prefix+'menu trial accessible',pg.locator('#roadStart09').is_enabled())
  ck(prefix+'no horizontal page overflow',E('document.documentElement.scrollWidth<=innerWidth+1'))
  pg.screenshot(path=str(ROOT/f'screenshots/v09_menu_{w}x{h}.png'))
  pg.click('#roadStart09');E('__deliveryTest.roads09.noTraffic();__deliveryTest.roads09.place(215,8,-Math.PI/2,0,8);__deliveryTest.advance(.1)')
  r=pg.locator('#roadHUD09').bounding_box();ck(prefix+'new HUD inside viewport',r['x']>=0 and r['y']>=0 and r['x']+r['width']<=w and r['y']+r['height']<h,r)
  pg.click('#roadHUDMap09');ck(prefix+'road map opens',pg.locator('#roadMap09').is_visible())
  ck(prefix+'road map has no sideways scroll',E('document.querySelector(".roadPanel09").scrollWidth<=document.querySelector(".roadPanel09").clientWidth+1'))
  pg.locator('#roadCity09').scroll_into_view_if_needed();ck(prefix+'map action reachable by scrolling',pg.locator('#roadCity09').is_visible())
  pg.click('#roadClose09');E('__deliveryTest.playerAt(0,2.9,Math.PI,-.2);__deliveryTest.bothDoors();__deliveryTest.advance(1)')
  pg.screenshot(path=str(ROOT/f'screenshots/v09_cargo_{w}x{h}.png'))
  ck(prefix+'cargo and GL still function',E('__deliveryTest.snapshot().state.view')=='cargo' and E('__deliveryTest.glError()')==0 and not err,err)
  c.close()
 b.close()
(ROOT/'tests/roads_ui_results.json').write_text(json.dumps(R,ensure_ascii=False,indent=2));print('TOTAL',sum(x['passed'] for x in R),'/',len(R))
