#!/usr/bin/env python3
"""Build V0.9.4 ALL ROADS city-wide Kenney replacement from the verified V0.8/PWA baseline."""
from pathlib import Path
import argparse,base64,hashlib,json,re,subprocess,shutil,tempfile
ROOT=Path(__file__).resolve().parent
BASE_SHA='28f3cfd4a7559c1977c0d383d072b29b895478181d13427bebbbc6fd166779ba'
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'index.html');args=p.parse_args()
data=(ROOT/'src/v08-baseline.html').read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA: raise RuntimeError('Unexpected base: refusing to build from another release')
html=data.decode('utf8')
if 'DeliveryDuel2v2' not in html or len(data)<380000:raise RuntimeError('Wrong game baseline')
def replace(old,new,count=1):
 global html
 if html.count(old)!=count:raise RuntimeError('Patch anchor mismatch: '+old[:100]+'; found '+str(html.count(old)))
 html=html.replace(old,new)
replace('<title>暴力快递 · V0.7.5 ONLINE · MULTIPLAYER</title>','<title>暴力快递 · V0.9.4 ALL ROADS · 全城模块道路</title>')
replace('<meta name="description" content="暴力快递 V0.7 城市交通：住宅、商业、工业三区，18 件任务包裹，路口转弯让行、事故清障及双人同车合作。">',
        '<meta name="description" content="暴力快递 V0.9.4：全城 Kenney 模块道路，住宅、商业、工业三区与高架试验区，18 件订单，单人、多人合作、2v2 和 PWA。">')
replace('V0.7：18 单 / 三个城区。点右上地图看路线和事故。NPC 会转弯、等灯及让行；砖头仍不会转向。',
        'V0.9.4：全城新道路 · 18 单。点右上地图看路线；红灯越线和撞车会罚款，砖头仍不会转向。')
html=html.replace('crash-delivery-mp075-1','crash-delivery-mp094-1').replace('crash-delivery-mp075-','crash-delivery-mp094-')
# Remove the old force-reloading SW registration. It could interrupt an active multiplayer match.
oldreg=re.compile(r'<script>\s*\(function\(\)\{\s*if\(!\(\'serviceWorker\' in navigator\).*?</script>',re.S)
html,n=oldreg.subn('',html)
if n!=1:raise RuntimeError('Expected one legacy SW block, found '+str(n))

# Keep the V0.8 gameplay semantics. Replace city road rendering; preserve SKYWAY and every order.
# Keep large decorative planting clear of the actual drivable graph. Small house-garden trees remain.
replace('function addTree(x,z,scale=1){\n const color=materials.green[Math.floor(rnd()*materials.green.length)];',
'''function addTree(x,z,scale=1){
 if(scale>=1&&typeof closestCityRoad==='function'&&closestCityRoad([x,0,z]).d<CITY.halfRoad+3.8){window.__roadTreeCull091=(window.__roadTreeCull091||0)+1;return;}
 const color=materials.green[Math.floor(rnd()*materials.green.length)];''')
replace('const CITY={limit:148,','const CITY={limit:344,')
# Move cosmetic distant mountains away from the new eastern district (not collision geometry).
replace('dist=236+rnd()*28','dist=440+rnd()*28')
replace("b(740,.5,740,'#a7c98d'","b(1100,.5,1100,'#a7c98d'")
# New geometry belongs in the opaque pass, before view-model depth clearing.
replace('drawCityWorld();','drawCityWorld();if(window.__roads09Draw)window.__roads09Draw();')
# Replace every legacy city road slab, curb and painted junction. Do NOT layer over them.
road_begin=" for(const e of cityEdges){const a=cityNodes[e.a],d=edgeDirection(e.a,e.b),yaw=Math.atan2(d[0],d[2]),mid=V.lerp("
road_end=" // Original addresses retained; six outer-city jobs added."
a=html.index(road_begin,html.index('function buildWorld()'))
z=html.index(road_end,a)
html=html[:a]+" // V0.9.4: road geometry and signals are built from the Kenney road modules.\n"+html[z:]
# Corners/straight degree-2 nodes have no signal: they must not wait for an invisible red lamp.
replace("function signalPhase(n,axis,time=state.time){const t=", "function signalPhase(n,axis,time=state.time){if(n.adj.length<3)return 'green';const t=")
# Preserve the three district identity signs, but place their posts outside the new shoulders.
replace("citySign('GARDEN',12,63,-Math.PI/2);citySign('MARKET',65,12,0);citySign('WORKS',-65,-11,Math.PI);",
        "citySign('GARDEN',12,67,Math.PI/2);citySign('MARKET',67,12,0);citySign('WORKS',-67,-11,Math.PI);")
# Support inclined local->world transforms consistently (car pitch is added by the road adapter).
replace('function vehicleToWorld(p){return V.add(car.p,worldVelocity({yaw:car.yaw},p));}',
'''function vehicleToWorld(p){return M.point(M.model(car.p,[car.roadPitch||0,car.yaw,0]),p);}''')
replace('function vehicleToLocal(p){return localVelocity({yaw:car.yaw},V.sub(p,car.p));}',
'''function vehicleToLocal(p){const m=M.model(car.p,[car.roadPitch||0,car.yaw,0]),d=V.sub(p,car.p);return [m[0]*d[0]+m[1]*d[1]+m[2]*d[2],m[4]*d[0]+m[5]*d[1]+m[6]*d[2],m[8]*d[0]+m[9]*d[1]+m[10]*d[2]];}''')
# Avoid fake cross-floor contacts with city cars. Road adapter handles extra test-zone vehicles.
replace('const hit=overlapVehicles(t);if(!hit)continue;', 'if(Math.abs(car.p[1]-t.p[1])>2.7)continue;const hit=overlapVehicles(t);if(!hit)continue;')
replace("M.model([car.p[0],0,car.p[2]],[0,car.yaw,0]),.40","M.model([car.p[0],car.p[1]-.12,car.p[2]],[0,car.yaw,0]),.40")
# Rendering transform for the physical hollow van and attachments.
if 'const vanM=M.model(car.p,[0,car.yaw,state.view===\'cargo\'?0:car.roll]);' in html:
 replace("const vanM=M.model(car.p,[0,car.yaw,state.view==='cargo'?0:car.roll]);","const vanM=M.model(car.p,[car.roadPitch||0,car.yaw,state.view==='cargo'?0:car.roll]);")
else:raise RuntimeError('Van render anchor missing')
# Pedestrians beneath an elevated van must not collide with its 2D footprint.
replace('p=slideOut(p,car.p[0],car.p[2],car.yaw,1.94,4.28);',
        'if(Math.abs((player.p[1]-WALK_EYE)-(car.p[1]-.12))<2.7)p=slideOut(p,car.p[0],car.p[2],car.yaw,1.94,4.28);')
# View-space courier model follows the same inclined deck.
html=html.replace("M.model(car.p,[0,car.yaw,0]),a.view==='drive'", "M.model(car.p,[car.roadPitch||0,car.yaw,0]),a.view==='drive'")
# The original city boot flag is set before the road pack finishes. Roads have their own ready status.
css=(ROOT/'src/roads-v09.css').read_text()
html=html.replace('</head>','<style>\n'+css+'\n</style>\n</head>',1)
inv=json.loads((ROOT/'assets/kenney-roads/ASSETS.json').read_text())
pack={m['name']:base64.b64encode((ROOT/'assets/kenney-roads'/(m['name']+'.glb')).read_bytes()).decode() for m in inv['models']}
atlas=base64.b64encode((ROOT/'assets/kenney-roads/Textures/colormap.png').read_bytes()).decode()
module=(ROOT/'src/city-roads-v094.js').read_text()+'\n'+(ROOT/'src/roads-v09.js').read_text()
assets='const ROAD09_GLB_PACK='+json.dumps(pack,separators=(',',':'))+';\nconst ROAD09_ATLAS="data:image/png;base64,'+atlas+'";\n'
anchor='\n})();\n</script>'
pos=html.rfind(anchor)
if pos<0:raise RuntimeError('Main closure missing')
html=html[:pos]+'\n/* V0.9.4 city-wide roads runtime; original V0.8 mechanics retained. */\n'+assets+module+html[pos:]
html=html.replace('</body>', '<script>\n'+(ROOT/'src/pwa-v09.js').read_text()+'\n</script>\n</body>',1)
ids=re.findall(r'\bid="([^"\n]+)"',html)
# Dynamic markup is literal as well; require no duplicate static ids in the document parsed before scripts.
static=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S)
ids=re.findall(r'\bid="([^"\n]+)"',static)
if len(ids)!=len(set(ids)):raise RuntimeError('Duplicate static DOM IDs')
if shutil.which('node'):
 with tempfile.TemporaryDirectory() as d:
  for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)):
   f=Path(d)/f'script{i}.js';f.write_text(js);subprocess.run(['node','--check',str(f)],check=True)
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(html,encoding='utf8')
sha=hashlib.sha256(html.encode()).hexdigest()
version={'version':'0.9.4','name':'ALL ROADS / CITY-WIDE KENNEY ROAD REPLACEMENT','protocol':'crash-delivery-mp094-1','base_blob':'8878517981cf87128ec73ecf36e0271f1b50896e','base_sha256':BASE_SHA,'html_sha256':sha,'models':len(inv['models']),'notes':'Replaces every city roadway using Kenney modules while preserving all 38 streets, 25 nodes, 18 delivery addresses, traffic AI, fees, multiplayer and SKYWAY. Original road rendering is removed. Signal faces use actual GLB -X normals; lamps face inward.'}
(ROOT/'VERSION_V09.json').write_text(json.dumps(version,ensure_ascii=False,indent=2))
(ROOT/'sw.js').write_text((ROOT/'src/sw-template.js').read_text().replace('__BUILD_HASH__',sha[:16]),encoding='utf8')
print('Built V0.9.4',args.output,len(html.encode()),'bytes;',len(ids),'DOM IDs;',sha)
