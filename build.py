#!/usr/bin/env python3
"""Reproducible V0.12 builder. No downloads, npm or CDN dependencies."""
from pathlib import Path
import re,json,hashlib,subprocess,tempfile,shutil,argparse
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'src/v012/base-v0112.html'
BASE_SHA='37b2be0ecae7d542eaee0d9f9b5baa64e108073d4a03d3c2694baf6ab9fd66c9'
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA:raise RuntimeError('V0.11.2 baseline integrity mismatch; do not rebuild from an older snapshot.')
s=data.decode('utf-8')
parser=argparse.ArgumentParser(description='Build V0.12 from the preserved V0.11.2 snapshot and additive city extension.')
parser.add_argument('--output',type=Path,default=ROOT/'index.html',help='Use a candidate path for verification; only the root output updates sw.js and VERSION.json.')
args=parser.parse_args()

def patch(a,b,count=1):
 global s
 n=s.count(a)
 if n<count:raise ValueError(f'Patch absent ({n}/{count}): {a[:110]}')
 s=s.replace(a,b,count)
# Native node transforms: glTF column-major T * R * S, preserve wheels and body.
patch("function matrix(node){if(node.matrix)return new Float32Array(node.matrix);if(node.rotation||node.translation)throw Error('Selected Kenney pack only supports identity/uniform-scale node transforms');if(node.scale)return scaled(M.identity(),node.scale);return M.identity();}","""function matrix(node){if(node.matrix)return new Float32Array(node.matrix);const [x,y,z,w]=node.rotation||[0,0,0,1],s=node.scale||[1,1,1],t=node.translation||[0,0,0];return new Float32Array([(1-2*(y*y+z*z))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0,2*(x*y-z*w)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+x*w)*s[1],0,2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(x*x+y*y))*s[2],0,t[0],t[1],t[2],1]);}""")
patch('const CITY={limit:344,lines:[-112,-56,0,56,112],', 'const CITY={limit:416,lines:[-224,-168,-112,-56,0,56,112],zLines:[-224,-168,-112,-56,0,56,112,168,224],')
patch('for(const z of CITY.lines)for(const x of CITY.lines)', 'for(const z of CITY.zLines)for(const x of CITY.lines)')
patch('if(!a||!b)return;const key=roadKey(a.id,b.id),e=', 'if(!a||!b||cityEdgeMap.has(roadKey(a.id,b.id)))return;const key=roadKey(a.id,b.id),e=')
# All commercial rendering/collision delegated to native facade system.
patch("if(style==='garden'){h.deliveryMode='native-residential';houses.push(h);return h;}", "if(style==='garden'){h.deliveryMode='native-residential';houses.push(h);return h;}if(style==='market'){h.deliveryMode='native-commercial';houses.push(h);return h;}")
s=s.replace("if(h.style==='works'||h.style==='garden')continue;", "if(h.style==='works'||h.style==='garden'||h.style==='market')continue;")
# Keep 18 orders but distribute the destinations across the expanded city.
patch('addHouse(-76,76,Math.PI/2,101,1);addHouse(-28,76,Math.PI,102,0);','addHouse(-196,196,Math.PI/2,101,1);addHouse(-84,196,Math.PI,102,0);')
patch('addHouse(-76,-76,0,117,4);addHouse(28,-76,0,118,2);','addHouse(-196,-196,0,117,4);addHouse(28,-196,0,118,2);')
# Traffic brake/turn lamps follow the selected native vehicle dimensions.
patch('[s*.67,.93,1.92]', '[s*(t.hw012||.9)*.75,Math.min(1.05,(t.height012||1.6)*.40),(t.hl012||1.92)+.025]')
patch('for(const z of [-1.93,1.95])renderer.draw(turnLamp,M.multiply(m,M.model([s*.80,.96,z])))', 'for(const z of [-(t.hl012||1.93)-.025,(t.hl012||1.95)+.025])renderer.draw(turnLamp,M.multiply(m,M.model([s*(t.hw012||1)*.8,Math.min(1.1,(t.height012||1.6)*.43),z])))')
# More lots (same safe-footprint allocator, two homes per side where physically possible).
patch('if(SUB011.homes.length>=22)break;', 'if(SUB011.homes.length>=82)break;',2)
patch('for(const side of [-1,1]){if(SUB011.homes.length>=82)break;const x=a.x+d[0]*e.len*.5+r[0]*side*20,z=a.z+d[2]*e.len*.5+r[2]*side*20;', 'for(const side of [-1,1])for(const fraction of [.30,.70]){if(SUB011.homes.length>=82)break;const x=a.x+d[0]*e.len*fraction+r[0]*side*20,z=a.z+d[2]*e.len*fraction+r[2]*side*20;')
# Commercial houses share proven suburban continuous collision / facade / glass implementation.
patch('SUB011_NATIVE[o.name.slice(-1)].portals){', '(o.portals||SUB011_NATIVE[o.name.slice(-1)].portals)){')
patch("h.address='向阳住宅区 '+h.num+' 号';h.gates=[];", "h.address=(h.style==='market'?'中央商业区 ':'向阳住宅区 ')+h.num+' 号';h.gates=[];")
# A segment starting inside the model AABB still needs triangle tests. Eaves and
# balconies put the true wall INSIDE the outer box; the old slab early-out skipped it.
patch('if(!segmentBox(la,lb,bb.min,bb.max))continue;', 'if(!la.every((v,i)=>v>=bb.min[i]-1e-6&&v<=bb.max[i]+1e-6)&&!segmentBox(la,lb,bb.min,bb.max))continue;')
# Model-aware city NPC broad phase, junction clearance, and mass impulses.
patch("if(o===self||o.phase==='cleared')continue;", "if(o===self||o.phase==='cleared'||Math.abs(o.p[1]-first.p[1])>2.6)continue;")
patch('len=o===car?4.2:2.1;', 'len=o===car?4.2:(o.hl012||2.1);')
patch('side<(o===car?2.9:2.4)', 'side<(o===car?2.9:(o.hw012||1.02)+1.35)')
patch('if(dx*dx+dz*dz>19)continue;', 'if(Math.abs(a.p[1]-b.p[1])>2.6||dx*dx+dz*dz>((a.hl012||1.9)+(b.hl012||1.9)+2)**2)continue;')
patch('1.02*(Math.abs(V.dot(A,ax))+Math.abs(V.dot(B,ax)))+1.90*(Math.abs(V.dot(AF,ax))+Math.abs(V.dot(BF,ax)))', '(a.hw012||1.02)*Math.abs(V.dot(A,ax))+(b.hw012||1.02)*Math.abs(V.dot(B,ax))+(a.hl012||1.90)*Math.abs(V.dot(AF,ax))+(b.hl012||1.90)*Math.abs(V.dot(BF,ax))')
patch('damageTraffic(a,closing*closing*1.9,V.mul(normal,closing*.32));damageTraffic(b,closing*closing*1.9,V.mul(normal,-closing*.32));', 'const ma=a.mass012||1.4,mb=b.mass012||1.4,j=closing*1.15/(1/ma+1/mb);damageTraffic(a,closing*closing*1.9*mb/(ma+mb),V.mul(normal,j/ma));damageTraffic(b,closing*closing*1.9*ma/(ma+mb),V.mul(normal,-j/mb));city012Fragments(a,closing);city012Fragments(b,closing);')
# Returned parcels must sit OUTSIDE the full native footprint, including balconies.
patch('p.p=houseWorld(hit.h,[hit.g.x,p.r+.12,hit.g.planeZ+1]);', 'p.p=houseWorld(hit.h,[hit.g.x,p.r+.12,Math.max(hit.g.planeZ+1,(hit.h.suburbanHalf?.[1]||hit.g.planeZ)+.65)]);')
# Proper old-Y preservation BEFORE ground traffic collisions; no phantom impact under overpass.
patch('car.p=V.add(car.p,V.mul(car.velocity,dt));car.p[1]=.12;', 'const planeY=car.p[1];car.p=V.add(car.p,V.mul(car.velocity,dt));car.p[1]=planeY;')
patch('b=1.01*Math.abs(V.dot(rb,axis))+1.92*Math.abs(V.dot(fb,axis))', 'b=(t.hw012||1.01)*Math.abs(V.dot(rb,axis))+(t.hl012||1.92)*Math.abs(V.dot(fb,axis))')
patch('>8.3)continue;if(Math.abs(car.p[1]-t.p[1])', '>5+(t.hl012||1.92))continue;if(Math.abs(car.p[1]-t.p[1])')
patch("impact(closing);damageTraffic(t,Math.max(0,(closing-2.5)*(closing-2.5)*.52),V.mul(hit.normal,-closing*.40));if(t.phase==='normal'&&closing>4)t.phase='damaged';car.speed*=-.13;car.kick=V.add(car.kick,V.mul(hit.normal,Math.min(4,closing*.2)));", "city012Impact(t,hit.normal,closing,false);")
patch('for(let i=0;i<14;i++)traffic.push', 'for(let i=0;i<32;i++)traffic.push')
patch('traffic.forEach((t,i)=>{const e=entries[i%entries.length],a=cityNode(...e[0]),b=cityNode(...e[1]);initializeTraffic(t,a.id,b.id,e[2]);});', "traffic.forEach((t,i)=>{if(i<14){const e=entries[i],a=cityNode(...e[0]),b=cityNode(...e[1]);initializeTraffic(t,a.id,b.id,e[2]);}else{const e=cityEdges[(i*23+11)%cityEdges.length];initializeTraffic(t,i%2?e.a:e.b,i%2?e.b:e.a,3+(i%4)*5);}});")
patch("hl=o===car?3.95:1.95,hw=o===car?1.6:1.02", "hl=o===car?3.95:(o.hl012||1.95),hw=o===car?1.6:(o.hw012||1.02)")
patch("if(o===t||o.phase==='cleared')continue;const delta=", "if(o===t||o.phase==='cleared'||Math.abs(o.p[1]-t.p[1])>2.6)continue;const delta=")
patch('gap=long-halfLong-2.05-1.05;', 'gap=long-halfLong-(t.hl012||2.05)-1.05;')
patch('t.speed+3.2*dt', 't.speed+(t.accel012||3.2)*dt')
patch(')/m.scale,z=((e.clientY', ')/m.scale+(m.cx||0),z=((e.clientY')
patch('canvas.height/rect.height-m.h/2)/m.scale;let hit=', 'canvas.height/rect.height-m.h/2)/m.scale+(m.cz||0);let hit=')
# Reuse actual road height support on the enlarged domain; do NOT clamp all high roads to old bridge Z.
patch("const road09Zone=p=>p[0]>138&&p[0]<334&&p[2]>-48&&p[2]<112", "const road09Zone=p=>Math.abs(p[0])<416&&Math.abs(p[2])<416")
patch('if(prev[1]>.35&&car.p[0]>153&&car.p[0]<279)', 'if(prev[1]>.35&&Math.abs(prev[2]-8)<11&&car.p[0]>153&&car.p[0]<279)')
patch('if(old[1]-WALK_EYE>1&&desired[0]>153&&desired[0]<279)', 'if(old[1]-WALK_EYE>1&&Math.abs(old[2]-8)<11&&desired[0]>153&&desired[0]<279)')
patch('city094Build();road09Bake();road09MakeGraph();road092BuildColliders();', 'city094Build();road09Bake();road09MakeGraph();road092BuildColliders();city012BuildHighways();')
patch('V.mul(r,2.65)', 'V.mul(r,n.lane012||2.65)')
# Road-aware shadow filtering; native commercial buildings are included in SUB011 list already.
s=s.replace("houses.filter(h=>h.style==='market')", "houses.filter(h=>h.style==='market'&&!h.suburban011)")
# Draw extension before shadows and transparent passes; all own assets loaded locally.
patch('industrial012Draw();sub011Draw();lighting012Shadows();','industrial012Draw();sub011Draw();city012Draw();lighting012Shadows();')
# Start buttons stay disabled until the entire new city has loaded.
patch('function sub011RefreshBoot(){', 'function sub011RefreshBoot(){if(typeof CITY012!==\'undefined\'&&!CITY012.ready){city012Boot();return;}')
# Version only metadata / protocol; do not mutate legacy historical comments unnecessarily.
s=s.replace('crash-delivery-mp0111','crash-delivery-mp0120')
s=s.replace("version:'0.11.1'", "version:'0.12.0'")
s=s.replace('V0.11.1','V0.12.0').replace('V0.11 SUBURBAN','V0.12 CITY EXPANSION')
s=s.replace('V0.11 · SUBURBAN','V0.12 · CITY EXPANSION')
s=re.sub(r'<title>.*?</title>', '<title>暴力快递 · V0.12.0 CITY EXPANSION</title>', s, count=1)
s=re.sub(r'<meta name="description" content="[^"]*">','<meta name="description" content="暴力快递 V0.12：城市扩建、密集住宅与商业中心、H1/H2/H3 高速网络、Kenney 车流和可撞环境道具。支持电脑和手机浏览器。">',s,count=1)
s=s.replace("edition.innerHTML='V0.12.0 ONLINE <span>PWA FIX</span>'", "edition.innerHTML='V0.12.0 ONLINE <span>CITY EXPANSION</span>'")
s=s.replace("'开进新街区，<br>把快递送回家。'", "'穿过整座城，<br>快递飞进门。'")
s=s.replace('白墙绿屋顶、草坪前院，住宅区焕然一新。','密集街区、城市天际线与三条高速。下一单，开向更远的地方。')
s=s.replace('V0.11 · 单人派送 →','V0.12 · 开始派送 →').replace('SKYWAY / V0.11','SKYWAY / V0.12')
module=(ROOT/'src/v012/city-v012.js').read_text()
pos=s.rfind('\n})();\n</script>')
if pos<0:raise ValueError('Main closure not found')
s=s[:pos]+'\n'+module+'\n'+s[pos:]
# Parse all executable inline scripts before publishing a candidate.
if shutil.which('node'):
 with tempfile.TemporaryDirectory() as tmp:
  for i,match in enumerate(re.finditer(r'<script\b([^>]*)>(.*?)</script>',s,re.S)):
   attrs,body=match.groups()
   if 'json' in attrs or not body.strip():continue
   p=Path(tmp)/f'inline-{i}.js';p.write_text(body,encoding='utf-8')
   subprocess.run(['node','--check',str(p)],check=True)
else:
 print('WARNING: Node.js is not installed; JavaScript syntax validation was skipped.')
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(s,encoding='utf-8')
sha=hashlib.sha256(s.encode('utf-8')).hexdigest()
if args.output.resolve()==(ROOT/'index.html').resolve():
 paths=[p.relative_to(ROOT).as_posix() for p in sorted((ROOT/'assets').rglob('*')) if p.is_file() and p.suffix in ('.glb','.png','.json')]
 paths+=['manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png']
 for p in paths:
  if not (ROOT/p).is_file():raise RuntimeError('Offline resource missing: '+p)
 template=(ROOT/'src/v012/sw-template.js').read_text(encoding='utf-8')
 template=re.sub(r'const STATIC = .*?\.map\(p=>new URL\(p,ROOT\)\.href\);','const STATIC = '+json.dumps(paths)+'.map(p=>new URL(p,ROOT).href);',template,flags=re.S,count=1)
 (ROOT/'sw.js').write_text(template.replace('__BUILD_HASH__',sha[:16]),encoding='utf-8')
 (ROOT/'VERSION.json').write_text(json.dumps({'version':'0.12.0','label':'V0.12 CITY EXPANSION','protocol':'crash-delivery-mp0120-1','html_sha256':sha,'base_sha256':BASE_SHA,'offline_resources':len(paths)},indent=2)+'\n',encoding='utf-8')
print('Built V0.12.0',len(s.encode('utf-8')),'bytes',sha)
