from test_utils import *
from test_bridge import Bridge
from playwright.sync_api import sync_playwright
import json
out=[]
def ck(n,ok,d=None):
 out.append({'test':n,'passed':bool(ok),'details':d});print(('PASS ' if ok else 'FAIL ')+n,d if not ok else '',flush=True)
with sync_playwright() as p:
 b=launch(p);hc,h,he=load(b);gc,g,ge=load(b,mobile=True);br=Bridge(h,g);h.evaluate('__deliveryTest.freeze(true)');br.advance(.2)
 for size in [(320,640),(390,740),(844,390),(1280,800)]:
  g.set_viewport_size({'width':size[0],'height':size[1]});br.pump(.4)
  r=g.evaluate('''()=>{const f=s=>{let r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};return {chips:f('.statuschips'),team:f('#roomStrip'),map:f('.mapPanel')};}''')
  ck(f'Online {size}: teammates do not overlap vehicle chips',r['team']['top']>=r['chips']['bottom']+2,r)
  ck(f'Online {size}: team strip fits viewport',r['team']['left']>=0 and r['team']['right']<=size[0]+1,r)
  # Ensure the new map remains functional for a guest after size changes.
  g.click('#mapOpenBtn');ck(f'Online {size}: guest can open live city map',g.locator('#cityScreen').is_visible())
  g.locator('#closeCityMapBtn').scroll_into_view_if_needed();g.click('#closeCityMapBtn');br.pump(.1)
 ck('Online responsive UI has no runtime errors',not he and not ge,{'h':he,'g':ge})
 b.close()
(ROOT/'tests/network_ui_results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('TOTAL',sum(x['passed'] for x in out),'/',len(out))
