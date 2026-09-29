#!/usr/bin/env python3
from pathlib import Path
import argparse,hashlib,json,re,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'src'/'v01051-native-baseline.html'
BASE_SHA='cfff10f0c34896b93c7499d52a36da55d4d42379562436de1d9e42a16e6c3fa7'
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'index.html');a=p.parse_args()
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA: raise RuntimeError('Unexpected baseline')
html=data.decode('utf8')
html=html.replace('<title>暴力快递 · V0.10.5.1 NATIVE DOORS · PWA FULLSCREEN</title>','<title>暴力快递 · V0.11 SUBURBAN UPDATE · CITY LOOP</title>',1)
html=html.replace("const NET_PROTOCOL='crash-delivery-mp01051n-1';","const NET_PROTOCOL='crash-delivery-mp011-1';",1)
html=html.replace('V0.10.5.1 ONLINE <span>NATIVE DOORS</span>','V0.11 ONLINE <span>SUBURBAN UPDATE</span>',1)
runtime=(ROOT/'src'/'v011-suburban.js').read_text(encoding='utf8').strip()
anchor='\n})();\n</script>';pos=html.rfind(anchor)
if pos<0: raise RuntimeError('main closure not found')
html=html[:pos]+'\n'+runtime+'\n'+html[pos:]
if shutil.which('node'):
  with tempfile.TemporaryDirectory() as d:
    for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)):
      f=Path(d)/f's{i}.js';f.write_text(js,encoding='utf8');subprocess.run(['node','--check',str(f)],check=True)
a.output.write_text(html,encoding='utf8');sha=hashlib.sha256(html.encode()).hexdigest()
(ROOT/'VERSION_V09.json').write_text(json.dumps({'version':'0.11','name':'SUBURBAN UPDATE','protocol':'crash-delivery-mp011-1','parent_index_sha256':BASE_SHA,'html_sha256':sha,'notes':'Kenney City Kit Suburban integrated into the residential district. V0.10.5.1 Native Doors, industrial, PWA, SKYWAY and multiplayer retained.'},ensure_ascii=False,indent=2),encoding='utf8')
tmpl=(ROOT/'src'/'sw-template.js').read_text(encoding='utf8').replace('V0.10.5.1','V0.11')
(ROOT/'sw.js').write_text(tmpl.replace('__BUILD_HASH__',sha[:16]),encoding='utf8')
print('Built V0.11',len(html.encode()),sha)
