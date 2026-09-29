#!/usr/bin/env python3
"""Build Crash Delivery V0.10.3 INDUSTRIAL DELIVERY FIX from verified V0.10.2."""
from pathlib import Path
import argparse, hashlib, json, re, shutil, subprocess, tempfile
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'src'/'v0102-baseline.html'
BASE_SHA='afe9181d048069ce6932ee5e015fd266c126bbcccd76ac64d703d40215cc4eec'
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'index.html');args=p.parse_args()
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA: raise RuntimeError('Unexpected V0.10.2 baseline')
html=data.decode('utf-8')
old=(ROOT/'src'/'v0102-industrial.js').read_text(encoding='utf-8').strip()
new=(ROOT/'src'/'v0103-industrial.js').read_text(encoding='utf-8').strip()
if html.count(old)!=1: raise RuntimeError('V0.10.2 industrial module anchor mismatch')
html=html.replace(old,new,1)
replacements={
 '<title>暴力快递 · V0.10.2 INDUSTRIAL+ / GLASS / LIGHTING · CITY LOOP</title>':'<title>暴力快递 · V0.10.3 INDUSTRIAL DELIVERY FIX · CITY LOOP</title>',
 'V0.10.2 ONLINE <span>INDUSTRIAL+</span>':'V0.10.3 ONLINE <span>INDUSTRIAL FIX</span>',
 'V0.10.2：加大厂房 / 密集院区 / 临街收货 / 玻璃破洞 / 柔和光影。':'V0.10.3：大型厂房 / 嵌入式收货口 / 车上投递 / 玻璃破洞 / 柔和光影。',
 'crash-delivery-mp0102-1':'crash-delivery-mp0103-1',
 "console.error('V0.10.2 industrial layout:'":"console.error('V0.10.3 industrial layout:'",
}
for a,b in replacements.items(): html=html.replace(a,b)
# Static HTML ids remain unique.
static=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S)
ids=re.findall(r'\bid="([^"\n]+)"',static)
if len(ids)!=len(set(ids)): raise RuntimeError('Duplicate static DOM IDs')
if shutil.which('node'):
 with tempfile.TemporaryDirectory() as d:
  for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)):
   f=Path(d)/f'script{i}.js';f.write_text(js,encoding='utf-8');subprocess.run(['node','--check',str(f)],check=True)
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(html,encoding='utf-8')
sha=hashlib.sha256(html.encode()).hexdigest()
version={
 'version':'0.10.3','name':'INDUSTRIAL DELIVERY FIX / INTEGRATED RECEIVING FACADES','protocol':'crash-delivery-mp0103-1',
 'parent_release':'0.10.2 INDUSTRIAL+','parent_index_sha256':BASE_SHA,'html_sha256':sha,
 'notes':'Factory receiving targets are flush/integrated into enlarged road-facing Kenney buildings; no free-standing black delivery tunnels. Main factories and infill are scale-normalized. 2.4m facade setback supports drive-by throws. V0.10.2 glass decals, lighting, CITY LOOP, fines, multiplayer and PWA retained.'
}
(ROOT/'VERSION_V09.json').write_text(json.dumps(version,ensure_ascii=False,indent=2),encoding='utf-8')
tmpl=(ROOT/'src'/'sw-template.js').read_text(encoding='utf-8').replace('V0.10.2','V0.10.3')
(ROOT/'sw.js').write_text(tmpl.replace('__BUILD_HASH__',sha[:16]),encoding='utf-8')
print('Built V0.10.3',args.output,len(html.encode()),'bytes',sha)
