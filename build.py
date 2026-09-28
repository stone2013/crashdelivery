#!/usr/bin/env python3
"""Build Crash Delivery V0.10.2 INDUSTRIAL+ / GLASS / LIGHTING from the verified V0.10 CITY LOOP baseline."""
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
        "<title>暴力快递 · V0.10.2 INDUSTRIAL+ / GLASS / LIGHTING · CITY LOOP</title>")
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
html=html.replace('crash-delivery-mp010-1','crash-delivery-mp0102-1')
html=html.replace('V0.10 ONLINE <span>CITY LOOP</span>','V0.10.1 ONLINE <span>INDUSTRIAL</span>')
html=html.replace('V0.10 CITY LOOP：北部住宅/工业 · 南部商业 · SKYWAY 高速 · 18 单。',
                  'V0.10.1：北东工业区已换成真实厂房；工业订单投卷帘门、装卸平台与收货区。')
# V0.10.2 shared geometry, new receiving bays, and hole-bearing panes.
# Do not reuse the old residential facade/body colliders for the enlarged GLBs.
replace("for(const h of houses){if(Math.abs(next[0]-h.x)>13", "for(const h of houses){if(h.style==='works')continue;if(Math.abs(next[0]-h.x)>13")
replace("for(const h of houses){if(Math.abs(car.p[0]-h.x)>10", "for(const h of houses){if(h.style==='works')continue;if(Math.abs(car.p[0]-h.x)>10")
replace("for(const h of houses)if(Math.abs(h.x-p[0])<8", "for(const h of houses)if(h.style!=='works'&&Math.abs(h.x-p[0])<8")
replace("for(const h of houses){const x=houseLocal(h,a),y=houseLocal(h,b);", "for(const h of houses){if(h.style==='works')continue;const x=houseLocal(h,a),y=houseLocal(h,b);")
replace("drawCityWorld();if(window.__roads09Draw)window.__roads09Draw();", "drawCityWorld();if(window.__roads09Draw)window.__roads09Draw();industrial012Draw();lighting012Shadows();")
replace("const active=nextHouse();for(const h of houses){if(V.len(V.sub([h.x,0,h.z],eye))>175)", "const active=nextHouse();for(const h of houses){if(h.style==='works')continue;if(V.len(V.sub([h.x,0,h.z],eye))>175)")
replace("if(!g.broken)renderer.draw(g.type==='door'?doorMesh:glassMesh,scaled(m,gs));", "if(g.type==='door'&&!g.broken)renderer.draw(doorMesh,scaled(m,gs));")
replace(" drawCitySignals();\n renderer.draw(vanShadow", " glass012Draw();drawCitySignals();\n renderer.draw(vanShadow")
replace("const vanM=M.model(car.p,[car.roadPitch||0,car.yaw,state.view==='cargo'?0:car.roll]);renderer.draw(vanMesh,vanM);", "const vanM=M.model(car.p,[car.roadPitch||0,car.yaw,state.view==='cargo'?0:car.roll]);renderer.shade=LIGHT012.shade;renderer.draw(vanMesh,vanM);")
replace("drawPlayers();renderer.draw(windshieldMesh,vanM,.35);", "drawPlayers();renderer.draw(windshieldMesh,vanM,.35);lighting012Brake(vanM);renderer.shade=1;")
replace("breakGate(h,g,p);p.pending={h,g};continue;", "if(g.type==='window')glass012Impact(h,g,p,q);else breakGate(h,g,p);p.pending={h,g};continue;")
replace("h.gates.forEach(g=>g.broken=false);", "h.gates.forEach(g=>{g.broken=false;g.holes012=[];});")
replace("houses:houses.map(h=>({num:h.num,done:h.done,g:h.gates.map(g=>g.broken)}))", "houses:houses.map(h=>({num:h.num,done:h.done,g:h.gates.map(g=>g.broken),glass012:h.gates.map(g=>g.type==='window'?(g.holes012||[]).map(v=>({x:v.x,y:v.y,r:v.r,seed:v.seed})):null)}))")
replace("const g=houses[i].gates[j];if(broken&&!g.broken)breakGate(houses[i],g,{v:[0,0,0]});g.broken=broken;", "const g=houses[i].gates[j];if(!g)return;if(g.type==='window'){glass012Apply(g,h.glass012?.[j]);return;}if(broken&&!g.broken)breakGate(houses[i],g,{v:[0,0,0]});g.broken=broken;")
replace("if(g&&!g.broken)breakGate(h,g,{v:m.v||[0,0,0]});", "if(g?.type==='window')glass012Apply(g,m.holes012);else if(g&&!g.broken)breakGate(h,g,{v:m.v||[0,0,0]});")
# Remove stale residential doors and oversized repeated +/- 4.34m receiving assumptions.
html=html.replace("const p=[active.x,8.6,active.z]", "const p=[active.x,active.labelHeight012||8.6,active.z]")
html=html.replace("[active.x,9.25+(motion?Math.sin(state.time*2.8)*.2:0),active.z]", "[active.x,(active.labelHeight012||9.25)+(motion?Math.sin(state.time*2.8)*.2:0),active.z]")
html=html.replace("citySign('GARDEN',12,67,Math.PI/2);citySign('MARKET',67,12,0);citySign('WORKS',-67,-11,Math.PI);", "citySign('GARDEN',12,67,Math.PI/2);citySign('MARKET',12,-67,Math.PI);citySign('WORKS',123,-98,-Math.PI/2);")
# One consistent engine limit in the common simulation, rather than adding speed after the old clamp.
replace("const max=road?(gas?20.5:state.brick?15.5:20.5):6.5;car.speed=clamp(car.speed,-4.5,23);", "const fast=road09.ready&&!road09Duel()&&car.p[1]>4&&road09Support(car.p[0],car.p[2],car.p[1]-.04).y>4;const max=road?(fast?100/3.6:gas?20.5:state.brick?15.5:20.5):6.5;car.speed=clamp(car.speed,-4.5,fast?100/3.6:23);")
html=html.replace("if(gas&&car.speed>0)car.speed=Math.min(27.8,car.speed+4.6*dt);", "if(gas)car.speed=Math.min(100/3.6,car.speed);")
# Independent presentation shaders; original GUI and gameplay renderer interfaces stay intact.
start=html.index('<script>/* PocketGL')+len('<script>')
end=html.index('</script>',start)
html=html[:start]+(ROOT/'src/pocketgl-v0102.js').read_text(encoding='utf-8')+html[end:]
html=html.replace('V0.10.1 ONLINE <span>INDUSTRIAL</span>','V0.10.2 ONLINE <span>INDUSTRIAL+</span>')
html=html.replace('V0.10.1：北东工业区已换成真实厂房；工业订单投卷帘门、装卸平台与收货区。','V0.10.2：加大厂房 / 密集院区 / 临街收货 / 玻璃破洞 / 柔和光影。')

module='\n'.join((ROOT/'src'/name).read_text(encoding='utf-8') for name in ['v0102-industrial.js','v0102-glass.js','v0102-lighting.js','v0102-qa.js'])
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
    'version':'0.10.2',
    'name':'INDUSTRIAL+ / FRONTAGE, DENSITY, GLASS AND LIGHTING',
    'protocol':'crash-delivery-mp0102-1',
    'baseline_sha256':BASE_SHA,
    'parent_release':'0.10.1 INDUSTRIAL DELIVERY',
    'parent_index_sha256':'b09e00bbf39fd33cf16b5f9dca47c1273257ecf395a5afa9df37d7d7b77c222c',
    'html_sha256':sha,
    'notes':'Enlarged street-facing factories, 22 collision-audited infill buildings, 6 real parcel-receiving bays, deterministic glass hole textures, warm sun/cool ambient and approximate contact/projection shadows. Existing road layout and gameplay retained; not a new island-map rebuild.'
}
(ROOT/'VERSION_V09.json').write_text(json.dumps(version,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'sw.js').write_text((ROOT/'src'/'sw-template.js').read_text(encoding='utf-8').replace('__BUILD_HASH__',sha[:16]),encoding='utf-8')
print('Built V0.10.2',args.output,len(html.encode()),'bytes;',sha)
