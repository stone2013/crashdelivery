#!/usr/bin/env python3
"""Build Crash Delivery V0.10.1 INDUSTRIAL DELIVERY from the verified V0.10 CITY LOOP baseline."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess,shutil,tempfile
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'src'/'v010-baseline.html'
BASE_SHA='5fc6ed22395276d21e9c29e04603dec6999f8bc351e3dc83bce6b524162c9826'
p=argparse.ArgumentParser()
p.add_argument('--output',type=Path,default=ROOT/'index.html')
args=p.parse_args()
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA:
    raise RuntimeError('Unexpected V0.10 baseline; refusing to build')
html=data.decode('utf-8')
def replace(old,new,count=1):
    global html
    found=html.count(old)
    if found!=count:
        raise RuntimeError(f'Patch anchor mismatch: {found} != {count} for {old[:100]!r}')
    html=html.replace(old,new,count)

replace("<title>暴力快递 · V0.10 ONLINE · CITY LOOP</title>",
        "<title>暴力快递 · V0.10.1 INDUSTRIAL DELIVERY · CITY LOOP</title>")
replace("function matrix(node){if(node.matrix)return new Float32Array(node.matrix);if(node.rotation||node.translation||node.scale)throw Error('Selected Kenney pack expected identity node transforms');return M.identity();}",
        "function matrix(node){if(node.matrix)return new Float32Array(node.matrix);if(node.rotation||node.translation)throw Error('Selected Kenney pack only supports identity/uniform-scale node transforms');if(node.scale)return scaled(M.identity(),node.scale);return M.identity();}")
replace("function districtAt(x,z){if(z>=28)return x>=42?'works':'garden';if(z<=-28)return 'market';return x>=58?'works':x<=-58?'garden':'market';}",
        "function districtAt(x,z){if(x>=100)return 'works';if(z>=28)return x>=42?'works':'garden';if(z<=-28)return 'market';return x>=58?'works':x<=-58?'garden':'market';}")
replace(""" const gates=style==='garden'?[{x:-2.9,y:2.725,w:2.4,h:2.15,type:'window'},{x:0,y:1.775,w:2.05,h:3.15,type:'door'},{x:2.9,y:2.725,w:2.4,h:2.15,type:'window'}]:
 style==='market'?[{x:-3.1,y:3.7,w:1.8,h:1.65,type:'window'},{x:0,y:1.675,w:2.15,h:2.95,type:'door'},{x:3.1,y:3.7,w:1.8,h:1.65,type:'window'}]:
 [{x:-3.65,y:3.58,w:1.6,h:1.4,type:'window'},{x:0,y:1.86,w:3.0,h:3.32,type:'door'},{x:3.65,y:3.58,w:1.6,h:1.4,type:'window'}];
 gates.forEach((g,i)=>{g.broken=false;g.index=i;g.house=h;g.center=houseWorld(h,[g.x,g.y,4.36]);h.gates.push(g);});
 const wall=""",
""" const gates=style==='garden'?[{x:-2.9,y:2.725,w:2.4,h:2.15,type:'window'},{x:0,y:1.775,w:2.05,h:3.15,type:'door'},{x:2.9,y:2.725,w:2.4,h:2.15,type:'window'}]:
 style==='market'?[{x:-3.1,y:3.7,w:1.8,h:1.65,type:'window'},{x:0,y:1.675,w:2.15,h:2.95,type:'door'},{x:3.1,y:3.7,w:1.8,h:1.65,type:'window'}]:
 [{x:0,y:2.1,w:4.8,h:3.8,type:'door',industrial:true}];
 gates.forEach((g,i)=>{g.broken=style==='works';g.index=i;g.house=h;g.center=houseWorld(h,[g.x,g.y,4.36]);h.gates.push(g);});
 if(style==='works'){h.deliveryMode='industrial';houses.push(h);return h;}
 const wall=""")
html=html.replace('crash-delivery-mp010-1','crash-delivery-mp0101-1')
html=html.replace('V0.10 ONLINE <span>CITY LOOP</span>','V0.10.1 ONLINE <span>INDUSTRIAL</span>')
html=html.replace('V0.10 CITY LOOP：北部住宅/工业 · 南部商业 · SKYWAY 高速 · 18 单。',
                  'V0.10.1：北东工业区已换成真实厂房；工业订单投卷帘门、装卸平台与收货区。')
module=(ROOT/'src'/'v0101-industrial.js').read_text(encoding='utf-8')
anchor='\n})();\n</script>'
pos=html.rfind(anchor)
if pos<0: raise RuntimeError('Main closure missing')
html=html[:pos]+'\n'+module+'\n'+html[pos:]
static=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S)
ids=re.findall(r'\bid="([^"\n]+)"',static)
if len(ids)!=len(set(ids)): raise RuntimeError('Duplicate static DOM IDs')
if shutil.which('node'):
    with tempfile.TemporaryDirectory() as d:
        for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)):
            f=Path(d)/f'script{i}.js';f.write_text(js,encoding='utf-8')
            subprocess.run(['node','--check',str(f)],check=True)
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(html,encoding='utf-8')
sha=hashlib.sha256(html.encode()).hexdigest()
version={
    'version':'0.10.1',
    'name':'INDUSTRIAL DELIVERY / KENNEY FACTORY DISTRICT',
    'protocol':'crash-delivery-mp0101-1',
    'baseline_sha256':BASE_SHA,
    'html_sha256':sha,
    'notes':'Kenney City Kit Industrial 2.0 replaces procedural industrial buildings. Industrial package delivery uses host-authoritative loading dock/platform target zones. CITY LOOP, SKYWAY 100 km/h, paired signs, traffic fines, multiplayer and PWA are retained.'
}
(ROOT/'VERSION_V09.json').write_text(json.dumps(version,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'sw.js').write_text((ROOT/'src'/'sw-template.js').read_text(encoding='utf-8').replace('__BUILD_HASH__',sha[:16]),encoding='utf-8')
print('Built V0.10.1',args.output,len(html.encode()),'bytes;',sha)
