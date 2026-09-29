#!/usr/bin/env python3
"""Build Crash Delivery V0.10.4 INDUSTRIAL PLACEMENT FIX from verified V0.10.3."""
from pathlib import Path
import argparse,hashlib,json,re,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'src'/'v0103-baseline.html'
BASE_SHA='afdf9fda8e1dbec8763f96c506d61474a0578b71f507cc531737365938fea7dd'
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'index.html');args=p.parse_args()
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA: raise RuntimeError('Unexpected V0.10.3 baseline')
html=data.decode('utf-8')
start=html.index('/* V0.10.3 — Industrial scale normalization')
end=html.index('/* V0.10.2 — bounded, deterministic glass-hole decals.',start)
new=(ROOT/'src'/'v0104-industrial.js').read_text(encoding='utf-8').strip()
html=html[:start]+new+'\n'+html[end:]
replacements={
 '<title>暴力快递 · V0.10.3 INDUSTRIAL DELIVERY FIX · CITY LOOP</title>':'<title>暴力快递 · V0.10.4 INDUSTRIAL PLACEMENT FIX · CITY LOOP</title>',
 'V0.10.3 ONLINE <span>INDUSTRIAL FIX</span>':'V0.10.4 ONLINE <span>INDUSTRIAL PLACEMENT</span>',
 'V0.10.3：大型厂房 / 嵌入式收货口 / 车上投递 / 玻璃破洞 / 柔和光影。':'V0.10.4：地面临街厂房 / 避开立交与匝道 / 车上投递 / 玻璃破洞 / 柔和光影。',
 'crash-delivery-mp0103-1':'crash-delivery-mp0104-1',
 "console.error('V0.10.3 industrial layout:'":"console.error('V0.10.4 industrial layout:'",
}
for a,b in replacements.items(): html=html.replace(a,b)
static=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S);ids=re.findall(r'\bid="([^"\n]+)"',static)
if len(ids)!=len(set(ids)): raise RuntimeError('Duplicate static DOM IDs')
if shutil.which('node'):
 with tempfile.TemporaryDirectory() as d:
  for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)):
   f=Path(d)/f'script{i}.js';f.write_text(js,encoding='utf-8');subprocess.run(['node','--check',str(f)],check=True)
args.output.write_text(html,encoding='utf-8')
sha=hashlib.sha256(html.encode()).hexdigest()
version={'version':'0.10.4','name':'INDUSTRIAL PLACEMENT FIX / GROUND FRONTAGE ONLY','protocol':'crash-delivery-mp0104-1','parent_release':'0.10.3 INDUSTRIAL FIX','parent_index_sha256':BASE_SHA,'html_sha256':sha,'notes':'Industrial factories now select ground-level city frontage only, reject lots beneath/adjacent to SKYWAY ramps and overpasses, align Kenney facades with receiving bays, and keep 2.4m drive-by delivery setback. V0.10.3 scale normalization, integrated bays, glass decals, lighting, CITY LOOP, fines, multiplayer and PWA retained.'}
(ROOT/'VERSION_V09.json').write_text(json.dumps(version,ensure_ascii=False,indent=2),encoding='utf-8')
tmpl=(ROOT/'src'/'sw-template.js').read_text(encoding='utf-8').replace('V0.10.3','V0.10.4')
(ROOT/'sw.js').write_text(tmpl.replace('__BUILD_HASH__',sha[:16]),encoding='utf-8')
print('Built V0.10.4',args.output,len(html.encode()),'bytes',sha)
