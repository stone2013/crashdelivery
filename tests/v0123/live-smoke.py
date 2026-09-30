#!/usr/bin/env python3
"""Small real-requestAnimationFrame smoke run, with local asset bytes.
This deliberately uses real RAF/rendering, unlike the deterministic physics suite.
It does not represent phone hardware performance or public PWA/network behavior.
"""
from pathlib import Path
import sys,json,hashlib,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from browser_helpers import offline_html
# Local image fixture only: requestAnimationFrame and actual game frame() unchanged.
shim=r"""
const store=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});
const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{get:desc.get,set(v){const k=String(v).replace(/^\.\//,'');if(window.__testAssets?.[k])v='data:image/png;base64,'+__testAssets[k];desc.set.call(this,v);}});
window.__rafFrames123=0;const originalRAF123=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>originalRAF123(t=>{__rafFrames123++;fn(t)});
"""
html=offline_html(ROOT/'index.html').replace('<head>','<head><script>'+shim+'</script>',1)
output=ROOT/'tests/v0123/live-results.json';data={'html_sha256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'rows':[],'limitations':['Software WebGL only','No frame-rate target','Local byte fixture; no HTTP or SW lifecycle']}
with sync_playwright() as p:
 for width,height in [(960,640),(390,844)]:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--js-flags=--max-old-space-size=1024'])
  page=b.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded',timeout=120000);page.wait_for_function('CD123Boot.ready||CD123Boot.error',polling=200,timeout=120000)
  assert page.evaluate('CD123Boot.ready'),page.evaluate('CD123Boot.error')
  page.evaluate('document.getElementById("startBtn").click()')
  begin=page.evaluate('({frames:__rafFrames123,clock:__world123.raw().clock,train:__world123.raw().trains[0].s})');wall=time.monotonic()
  page.wait_for_timeout(8000)
  row=page.evaluate('({mode:__world123.state().mode,frames:__rafFrames123,clock:__world123.raw().clock,train:__world123.raw().trains[0].s,cityHidden:document.getElementById("cityScreen").classList.contains("hidden"),trialHidden:document.getElementById("roadMap09").classList.contains("hidden"),errorHidden:document.getElementById("errorScreen").classList.contains("hidden"),overflow:document.documentElement.scrollWidth>innerWidth,webgl:document.querySelector("canvas").getContext("webgl")?.getError()})')
  row.update({'viewport':[width,height],'before':begin,'wall_seconds':round(time.monotonic()-wall,2),'pageerrors':errors})
  row['pass']=row['mode']=='playing' and row['frames']>begin['frames']+5 and row['clock']>begin['clock'] and row['train']!=begin['train'] and row['trialHidden'] and row['errorHidden'] and not row['overflow'] and not errors
  data['rows'].append(row);output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(row,flush=True)
  page.screenshot(path=str(ROOT/f'tests/v0123/results/live-{width}x{height}.png'));b.close()
data['passed']=all(r['pass'] for r in data['rows']);output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if not data['passed']:raise SystemExit('Live RAF smoke failed')
