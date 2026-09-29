#!/usr/bin/env python3
"""Reproducible V0.11 build from the supplied NATIVE DOORS baseline."""
from pathlib import Path
import json,re,hashlib,subprocess,tempfile,shutil,argparse
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'src/native-base.html';SHA='cfff10f0c34896b93c7499d52a36da55d4d42379562436de1d9e42a16e6c3fa7'
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=SHA:raise RuntimeError('Baseline integrity mismatch')
s=data.decode('utf8')
def one(a,b):
 global s
 if s.count(a)!=1:raise RuntimeError('Expected one anchor: '+a[:80]+' count '+str(s.count(a)))
 s=s.replace(a,b,1)
one("const NET_PROTOCOL='crash-delivery-mp01051n-1';","const NET_PROTOCOL='crash-delivery-mp011-1';")
s=re.sub(r'<title>.*?</title>','<title>暴力快递 · V0.11 SUBURBAN · 原生住宅更新</title>',s,count=1)
s=re.sub(r'<meta name="description" content="[^"]*">','<meta name="description" content="暴力快递 V0.11：Kenney 白墙绿顶住宅、原生门窗投递、草坪前院；保留工业区、18 单、多人合作、2v2 与 PWA。">',s,count=1)
one("edition.innerHTML='V0.10.5.1 ONLINE <span>NATIVE DOORS</span>'","edition.innerHTML='V0.11 ONLINE <span>SUBURBAN</span>'")
s=s.replace("'整座城，<br>换上新路。'","'开进新街区，<br>把快递送回家。'").replace('住宅、商业、工业与高架，全城统一模块道路。','白墙绿屋顶、草坪前院，住宅区焕然一新。').replace('全城新路 · 单人派送 →','V0.11 · 单人派送 →').replace('SKYWAY / 09','SKYWAY / V0.11')
one("if(style==='works'){h.deliveryMode='industrial';houses.push(h);return h;}","if(style==='works'){h.deliveryMode='industrial';houses.push(h);return h;}if(style==='garden'){h.deliveryMode='native-residential';houses.push(h);return h;}")
s=s.replace("if(h.style==='works')continue;","if(h.style==='works'||h.style==='garden')continue;")
s=s.replace("h.style!=='works'&&Math.abs(h.x-p[0])","h.style==='market'&&Math.abs(h.x-p[0])")
one('industrial012Draw();lighting012Shadows();','industrial012Draw();sub011Draw();lighting012Shadows();v01051NativeDrawAprons();')
one("const v01051Draw3D=draw3D;\ndraw3D=function(){v01051Draw3D();if(state.mode!=='wardrobe')v01051DrawDecals();};","/* Legacy task-door overlay removed. */")
one("const v01051NativeDrawBase=draw3D;draw3D=function(){v01051NativeDrawBase();v01051NativeDrawAprons();};","/* Ground markers now draw inside the world pass. */")
s=s.replace('setTimeout(v01051Finalize,60);','/* No competing task-door startup timer. */')
a=s.index(' const m=h.model,B=',s.index('function ind012Target('));b=s.index('\n return t;',a);s=s[:a]+s[b:]
s=s.replace('t.z=front+.08;t.w=width','t.z=front+.65;t.w=width')
one("if(g.type!=='window')continue;const obj=glass012Texture(g)","if(g.type!=='window'||g.suburban011&&!g.holes012?.length)continue;const obj=glass012Texture(g)")
s=s.replace('z=g.planeZ||4.345,m=','z=(g.planeZ||4.345)+(g.suburban011?.022:0),m=')
one("const all=[...houses.filter(h=>h.style!=='works').map(h=>({x:h.x,z:h.z,yaw:h.yaw,hw:5.7,hd:4.5,height:h.style==='market'?9:7})),...industrial012.placements];","const all=[...houses.filter(h=>h.style==='market').map(h=>({x:h.x,z:h.z,yaw:h.yaw,hw:5.7,hd:4.5,height:9})),...industrial012.placements,...(typeof SUB011!=='undefined'?SUB011.homes:[])];")
for name in ['road092SyncViewport','v0105SyncViewport','v01051Viewport']:
 s,n=re.subn(r'function '+name+r'\(\)\{.*?\n\}','function '+name+'(){ /* superseded by viewport011Sync */\n}',s,count=1,flags=re.S)
 if n!=1:raise RuntimeError(name+' anchor')
for sid in ['v0105Css','v01051Css']:s=re.sub(r'<style id="'+sid+r'">.*?</style>','',s,flags=re.S)
s=s.replace('</head>','<style id="viewport011">\n'+(ROOT/'src/viewport-v011.css').read_text()+'</style>\n</head>',1)
module=(ROOT/'src/suburban-v011.js').read_text()+'\n'+(ROOT/'src/viewport-v011.js').read_text()+'\n'+(ROOT/'src/qa-v011.js').read_text();anchor='\n})();\n</script>';pos=s.rfind(anchor)
if pos<0:raise RuntimeError('Main closure missing')
s=s[:pos]+'\n'+module+s[pos:];s=s.replace("version:'multiplayer-0.7.0'","version:'0.11.0'")
if shutil.which('node'):
 with tempfile.TemporaryDirectory() as d:
  for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',s,re.S)):
   p=Path(d)/f'{i}.js';p.write_text(js);subprocess.run(['node','--check',str(p)],check=True)
a=argparse.ArgumentParser();a.add_argument('--output',type=Path,default=ROOT/'index.html');args=a.parse_args();args.output.write_text(s,encoding='utf8')
sha=hashlib.sha256(s.encode()).hexdigest();(ROOT/'VERSION.json').write_text(json.dumps({'version':'0.11.0','label':'V0.11 SUBURBAN','protocol':'crash-delivery-mp011-1','html_sha256':sha,'base_sha256':SHA},indent=2));shutil.copy2(ROOT/'VERSION.json',ROOT/'VERSION_V09.json')
tmpl=(ROOT/'src/sw-template.js').read_text();paths=[str(p.relative_to(ROOT)).replace('\\','/') for p in sorted((ROOT/'assets').rglob('*')) if p.is_file() and p.suffix in ['.glb','.png','.json']]+['manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png']
tmpl=re.sub(r'const STATIC = .*?\.map\(p=>new URL\(p,ROOT\)\.href\);','const STATIC = '+json.dumps(paths)+'.map(p=>new URL(p,ROOT).href);',tmpl,flags=re.S,count=1);tmpl=tmpl.replace('V0.10.5.1','V0.11');(ROOT/'sw.js').write_text(tmpl.replace('__BUILD_HASH__',sha[:16]))
print('Built V0.11',len(s.encode()),'bytes',sha,'static files',len(paths))
