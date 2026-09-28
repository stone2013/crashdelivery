from pathlib import Path
import sys,json,time,math
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from browser_helpers import ROOT,offline_html,launch
from playwright.sync_api import sync_playwright
checks=[]
def ck(n,v,d=None):checks.append(dict(test=n,passed=bool(v),detail=d));print('PASS' if v else 'FAIL',n,str(d or '')[:300],flush=True)
with sync_playwright() as pw:
 b=launch(pw);p=b.new_page(viewport={'width':640,'height':400});errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('dialog',lambda d:d.accept())
 p.set_content(offline_html(ROOT/'index.html'),wait_until='domcontentloaded');p.wait_for_function('window.__industrial012Ready===true',timeout=15000)
 p.evaluate('__deliveryTest.quality("low")');p.wait_for_timeout(600);p.screenshot(path=str(ROOT/'screenshots/menu.png'))
 p.locator('#startBtn').click();p.evaluate('__deliveryTest.freeze(false);__deliveryTest.background(true)');before=p.evaluate('__deliveryTest.snapshot().state.time');p.wait_for_function('(t)=>__deliveryTest.snapshot().state.time>t+.5',arg=before,timeout=30000);after=p.evaluate('__deliveryTest.snapshot().state.time')
 ck('Production animation loop advances time',after>before+.25,dict(before=before,after=after));ck('No runtime error overlay',not p.locator('#errorScreen').is_visible())
 p.keyboard.down('KeyW');old=p.evaluate('__deliveryTest.snapshot().car.p');p.wait_for_function('(old)=>Math.hypot(...__deliveryTest.snapshot().car.p.map((v,i)=>v-old[i]))>1',arg=old,timeout=30000);p.keyboard.up('KeyW');cur=p.evaluate('__deliveryTest.snapshot().car.p');ck('Live keyboard input moves van',math.dist(old,cur)>.2,dict(old=old,new=cur))
 p.evaluate('__deliveryTest.v0102.reset();__deliveryTest.roads09.place(184,11,-Math.PI/2,0,8);__deliveryTest.roads09.input(["KeyW"])')
 peak=0;levels=[]
 for _ in range(34):
  p.evaluate('__deliveryTest.advance(.1)');s=p.evaluate('__deliveryTest.snapshot().car');peak=max(peak,s['speed']*3.6);levels.append([s['p'],s['speed']])
 ck('Real highway simulation reaches 98-100 km/h',98<peak<100.2,{'peakKmh':peak,'end':levels[-1]})
 p.evaluate('__deliveryTest.v0102.reset();__deliveryTest.roads09.place(224,8,Math.PI,20.5,0);__deliveryTest.roads09.input(["KeyW"]);__deliveryTest.advance(.3)')
 s=p.evaluate('__deliveryTest.snapshot().car');ck('Underpass receives no high-speed mode',s['p'][1]<1 and abs(s['speed'])*3.6<80,s)
 p.set_viewport_size({'width':1280,'height':800});p.evaluate('__deliveryTest.quality("high")');p.evaluate('__deliveryTest.v0102.reset();__deliveryTest.place(58,19,Math.PI);__deliveryTest.v0102.render();__deliveryTest.roads09.camera([37,13,47],[78,4,29])');p.screenshot(path=str(ROOT/'screenshots/industrial-truck.png'))
 p.evaluate('__deliveryTest.roads09.camera([184,160,190],[81,0,21])');p.screenshot(path=str(ROOT/'screenshots/industrial-aerial.png'))
 p.set_viewport_size({'width':390,'height':844});p.evaluate('__deliveryTest.roads09.camera([42,12,44],[77,4,28]);__deliveryTest.v0102.render()');p.screenshot(path=str(ROOT/'screenshots/phone-industrial-truck.png'))
 ck('Drive jump hidden in actual animation loop',not p.locator('#boardBtn').is_visible());ck('No runtime page errors',not errors,errors);ck('Live WebGL healthy',p.evaluate('__deliveryTest.glError()')==0)
 (ROOT/'tests/V0102_LIVE_RESULTS.json').write_text(json.dumps(dict(checks=checks,passed=sum(x['passed'] for x in checks),total=len(checks),errors=errors),ensure_ascii=False,indent=2));print('SUMMARY',sum(x['passed'] for x in checks),'/',len(checks));b.close()
