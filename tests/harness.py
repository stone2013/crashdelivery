from pathlib import Path
import json,base64
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent;QA=Path(__file__).resolve().parent
def html_source():
 s=(ROOT/'index.html').read_text().replace("new URLSearchParams(location.search).has('test')","true")
 assets={str(p.relative_to(ROOT)):base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'assets').rglob('*') if p.is_file()}
 for k,v in assets.items():
  if k.endswith('.png'):s=s.replace("'./"+k+"'","'data:image/png;base64,"+v+"'")
 preload='window.__qaAssetBytes='+json.dumps(assets)+";window.fetch=async function(path){let key=String(path).replace(/^\\.\\//,'');if(!(key in __qaAssetBytes))throw Error('QA offline request: '+key);let raw=atob(__qaAssetBytes[key]);return new Response(Uint8Array.from(raw,c=>c.charCodeAt(0)),{status:200});};"
 return s.replace('<head>','<head><script>'+(QA/'gl_stub.js').read_text()+preload+'</script>',1)
class Browser:
 def __enter__(self):
  self.p=sync_playwright().start();self.b=self.p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);self.page=self.b.new_page(viewport={'width':1280,'height':820});self.errors=[];self.logs=[]
  self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('console',lambda m:self.logs.append([m.type,m.text]));self.page.set_content(html_source(),wait_until='load',timeout=20000);self.page.wait_for_timeout(1600);self.page.evaluate('window.__qaRAF=false');return self
 def __exit__(self,*args):self.b.close();self.p.stop()
