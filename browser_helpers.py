from pathlib import Path
import base64,json,re,os,shutil
ROOT=Path(__file__).parent
(ROOT/'screenshots').mkdir(exist_ok=True)
(ROOT/'screenshots').mkdir(exist_ok=True)

def offline_html(path):
    s=Path(path).read_text(encoding='utf-8')
    s=s.replace("new URLSearchParams(location.search).has('test')","true")
    # Explicitly feed authorized local bytes, without network navigation or external requests.
    assets={str(p.relative_to(ROOT)):base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'assets').rglob('*') if p.is_file()}
    for name,data in assets.items():
        if name.endswith('.png'):
            s=s.replace('./'+name,'data:image/png;base64,'+data)
    script='<script>window.__testAssets='+json.dumps(assets)+';const nativeFetch=window.fetch;window.fetch=(u,o)=>{const k=String(u).replace(/^[.]\\//, "");const raw=window.__testAssets[k];if(raw){const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));return Promise.resolve(new Response(bytes,{status:200}));}return Promise.reject(new Error("External network disabled in offline QA"));};</script>'
    return s.replace('<head>','<head>'+script,1)

def launch(p):
    return p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
