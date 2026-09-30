#!/usr/bin/env python3
"""Real software-WebGL tests using authorized local HTML/GLB bytes, not HTTP.
Does not verify mobile hardware, SW installation or public WebRTC.
"""
from pathlib import Path
import sys,json,hashlib,math
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];OUT=R/'tests/v0123/results';OUT.mkdir(parents=True,exist_ok=True);sys.path.insert(0,str(R))
from browser_helpers import offline_html
SHIM=r"""
window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};
const store=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});
const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{get:desc.get,set(v){const k=String(v).replace(/^\.\//,'');if(window.__testAssets?.[k])v='data:image/png;base64,'+__testAssets[k];desc.set.call(this,v);}});
"""
html=offline_html(R/'index.html').replace('<head>','<head><script>'+SHIM+'</script>',1)
pos=html.rfind('\n})();\n</script>')
hook=r"""
window.__qa123={
 prepare(){__deliveryTest.suburban011.reset();clearInputs();road09.debugCamera=null;state.mode='playing';state.view='drive';state.switchUntil=0;car.hp=100;car.fault='';car.speed=0;car.velocity=[0,0,0];car.kick=[0,0,0];__deliveryTest.city012.disableTraffic();for(const t of traffic)t.clearAge=-100000;for(const t of road09.npc)t.stopped=-100000;WORLD123.wreck=null;WORLD123.clock=0;for(const t of WORLD123.trains)t.s=t.start;w123Positions();$('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('cityScreen').classList.add('hidden');road09CloseMap();},
 pose(p,yaw=0){car.p=p.slice();car.yaw=yaw;car.speed=0;car.velocity=[0,0,0];car.kick=[0,0,0];car.roadPitch=0;},
 shift(s){WORLD123.trains[0].s=w123mod(s,WORLD123.rail.len);WORLD123.trains[1].s=w123mod(s+WORLD123.rail.len/2,WORLD123.rail.len);w123Positions();},
 drive(seconds,keys=[]){inputs.keys=new Set(keys);for(let i=0;i<seconds*120;i++)step(1/120);clearInputs();return{p:car.p.slice(),speed:car.speed,hp:car.hp,wreck:!!WORLD123.wreck};},
 inputs(keys){inputs.keys=new Set(keys);},
 camera(e,a){eye=e;at=a;draw3D();},
 draw(){updateHUD();draw3D();},
 mode(mode){state.mode=mode;},
 gl(){return {version:renderer.gl.getParameter(renderer.gl.VERSION),error:renderer.gl.getError()};},
 allBuildings(){return SUB011.homes.concat(industrial012.placements).map(o=>({x:o.x,z:o.z,hw:o.hw,hd:o.hd,yaw:o.yaw,minY:o.minY,maxY:o.maxY}));},
 signAudit(){const out=[];const raw=road09.assets.get('sign-highway').b.a;for(const g of V0105.gantries){const flow=[-Math.sin(g.travelYaw),0,-Math.cos(g.travelYaw)],span=V.norm([g.m[8],g.m[9],g.m[10]]),face=V.norm([-g.m[0],-g.m[1],-g.m[2]]);let minLeg=1000,minBoard=1000,blocked=0;for(let i=0;i<raw.length;i+=9){const p=M.point(g.m,raw.slice(i,i+3)),delta=V.sub(p,[g.x,g.y,g.z]),lateral=Math.abs(V.dot(delta,span));if(p[1]-g.y<1.4)minLeg=Math.min(minLeg,lateral);if(lateral<7.5)minBoard=Math.min(minBoard,p[1]-g.y);if(lateral<7.5&&p[1]-g.y>.3&&p[1]-g.y<3.7)blocked++;}out.push({x:g.x,z:g.z,dot:V.dot(flow,span),faceDot:V.dot(flow,face),minLeg,minBoard,blocked});}return out;},
 terrainAudit(){let onRoad=0,missing=0,maxTop=0;for(const o of WORLD123.terrain){if(!city012LotRoads(o,2))onRoad++;for(const x of [-.2,0,.2])for(const z of [-.2,0,.2]){const p=[o.x+x*o.hw,0,o.z+z*o.hd],ls=w123TerrainLevels(p[0],p[2]);if(!ls.length)missing++;else maxTop=Math.max(maxTop,...ls.map(l=>l.y));}}return{onRoad,missing,maxTop,count:WORLD123.terrain.length};},
 signDrive(){const oldPos=car.p.slice();const rows=[];for(const g of V0105.gantries)for(const reverse of [false,true]){__qa123.prepare();const yaw=g.travelYaw+(reverse?Math.PI:0),dir=[-Math.sin(yaw),0,-Math.cos(yaw)],right=[-dir[2],0,dir[0]];__qa123.pose(V.add([g.x,g.y+.04,g.z],V.add(V.mul(dir,-18),V.mul(right,2.7))),yaw);const before=car.p.slice();let r;for(let i=0;i<600;i++){r=__qa123.drive(1/120,['KeyW']);if(V.dot(V.sub(car.p,before),dir)>=36)break;}rows.push({...r,from:before,advance:V.dot(V.sub(car.p,before),dir),x:g.x,z:g.z});}return rows;},
 crossingDrive(){const rows=[];for(const x of [152,216])for(const reverse of [false,true]){__qa123.prepare();const c=WORLD123.crossings.find(c=>c.x===x);__qa123.shift(c.s-140);w123Crossings(2);__qa123.pose([x+(reverse?20:-20),.12,168+(reverse?-2.7:2.7)],reverse?Math.PI/2:-Math.PI/2);const r=__qa123.drive(4.8,['KeyW']);rows.push({...r,crossed:reverse?car.p[0]<x-5:car.p[0]>x+5,x,reverse});}return rows;},
 inventory(){return {cargo:cargo.length,ground:packages.filter(p=>!p.delivered).length,ids:[...cargo,...packages.filter(p=>!p.delivered),...(player.held?[player.held]:[])].map(p=>p.id)};},
 headingArrows(){const canvas=$('minimap'),ctx=canvas.getContext('2d'),old=ctx.rotate,seen=[];ctx.rotate=function(a){seen.push(a);return old.call(this,a);};state.view='drive';for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){car.yaw=a;renderCityMap(canvas);}state.view='outside';player.yaw=.7;player.p=[300,2.5,220];renderCityMap(canvas);ctx.rotate=old;return {seen,center:mapMetrics(canvas),player:player.p.slice()};}
};
"""
html=html[:pos]+hook+html[pos:]
result={'html_sha256':hashlib.sha256((R/'index.html').read_bytes()).hexdigest(),'checks':{},'data':{},'limitations':['SwiftShader, not physical-phone GPU','Local-byte fixture, not HTTP/SW lifecycle','Snapshot structure, not public networking']}
def save():
 (OUT/'release-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=True)+'\n')
def check(name,ok,data=None):
 result['checks'][name]=bool(ok)
 if data is not None:result['data'][name]=data
 print(('PASS ' if ok else 'FAIL ')+name,flush=True);save()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 result['browser']=browser.version
 page=browser.new_page(viewport={'width':1280,'height':800});errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',e,flush=True)))
 page.set_content(html,timeout=120000,wait_until='domcontentloaded');page.wait_for_function('CD123Boot.ready||CD123Boot.error',polling=200,timeout=100000)
 info=page.evaluate('__world123.info()');result['info']=info
 check('real_resource_boot',info['boot']['ready'] and info['boot']['done']==140 and not info['boot']['error'])
 check('model_progress_monotonic', [r['n'] for r in info['boot']['history']]==list(range(1,141)))
 check('18_models_parse', info['models']==18 and info['ready'])
 check('rail_loop_two_trains_two_crossings',info['trains']==2 and info['units']==7 and len(info['crossings'])==2 and 480<info['railLength']<510)
 page.screenshot(path=str(OUT/'menu-desktop.png'))
 page.evaluate('__qa123.prepare();__qa123.draw()')
 signs=page.evaluate('__qa123.signAudit()');check('native_gantry_axes_and_clearance',len(signs)==3 and all(abs(r['dot'])<1e-5 and r['faceDot']<-.99 and r['minLeg']>8.5 and r['minBoard']>4.5 and r['blocked']==0 for r in signs),signs)
 rows=page.evaluate('__qa123.signDrive()');check('gantry_six_input_only_drives',len(rows)==6 and all(r['advance']>36 and r['hp']==100 for r in rows),rows)
 rows=page.evaluate('__qa123.crossingDrive()');check('four_open_crossing_drives',len(rows)==4 and all(r['crossed'] and r['hp']==100 and not r['wreck'] for r in rows),rows)
 terrain=page.evaluate('__qa123.terrainAudit()');check('terrain_outside_road_support_exists',terrain['count']>50 and terrain['onRoad']==0 and terrain['maxTop']<.5,terrain)
 # Full map uses the actual button's event listeners at every requested district.
 mapRows=[]
 for p in [[0,.12,56],[-196,.12,-196],[224,8.12,8],[216,.12,168],[360,8.12,200]]:
  row=page.evaluate('p=>{__qa123.prepare();__qa123.pose(p);document.getElementById("mapOpenBtn").click();return{p,city:!document.getElementById("cityScreen").classList.contains("hidden"),trial:!document.getElementById("roadMap09").classList.contains("hidden")}}',p);mapRows.append(row)
 check('map_button_five_regions_opens_city',all(r['city'] and not r['trial'] for r in mapRows),mapRows)
 page.screenshot(path=str(OUT/'full-city-map.png'));page.evaluate('__qa123.prepare()')
 arrows=page.evaluate('__qa123.headingArrows()');check('minimap_vehicle_and_onfoot_heading',len(arrows['seen'])==5 and all(abs(a-b)<1e-6 for a,b in zip(arrows['seen'],[0,-math.pi/2,-math.pi,math.pi/2,-.7])) and arrows['center']['cx']==300 and arrows['center']['cz']==220,arrows)
 # Warning lead time / caboose occupancy / re-opening use actual train progress.
 warning=page.evaluate('''()=>{__qa123.prepare();const w=__world123.raw(),c=w.crossings[0];__qa123.shift(c.s-50);__world123.crossings(2);const before={warning:c.warning,closed:c.closed};__qa123.shift(c.s+20);__world123.crossings(2);const tail={warning:c.warning,closed:c.closed};__qa123.shift(c.s+90);__world123.crossings(2);return{before,tail,after:{warning:c.warning,closed:c.closed}}}''');check('crossing_warning_tail_and_reopen',warning['before']['warning'] and warning['tail']['closed'] and not warning['after']['warning'],warning)
 # Actual train crossing hits a stationary truck; not directly calling wreck().
 blast=page.evaluate('''()=>{__qa123.prepare();const w=__world123.raw(),c=w.crossings[1];__qa123.pose([c.x,.12,c.z+2.7],-Math.PI/2);__qa123.shift(c.s-14);const inv=__qa123.inventory(),before=w.trains[0].s;for(let i=0;i<240&&!w.wreck;i++)__world123.railStep(1/120);for(let i=0;i<12;i++)__world123.railStep(1/120);const hit=!!w.wreck,after=__qa123.inventory();return{hit,hp:__world123.car().hp,remaining:w.wreck?.remaining,inventoryBefore:inv,inventoryAfter:after,trainAdvanced:w.trains[0].s-before}}''')
 check('train_immediate_wreck_and_scatter',blast['hit'] and blast['hp']==0 and blast['inventoryAfter']['cargo']==0 and len(blast['inventoryBefore']['ids'])==len(blast['inventoryAfter']['ids']) and len(set(blast['inventoryAfter']['ids']))==len(blast['inventoryAfter']['ids']) and blast['trainAdvanced']>9,blast)
 page.evaluate('__qa123.drive(.12,[]);__qa123.camera([194,13,190],[216,2,168]);__qa123.draw()');page.screenshot(path=str(OUT/'train-impact.png'))
 rescue=page.evaluate('''()=>{const before=__qa123.inventory(),w=__world123.raw();for(let i=0;i<6*120;i++)__world123.step(1/120);return{wreck:!!w.wreck,hp:__world123.car().hp,p:__world123.car().p,idsBefore:before.ids,idsAfter:__qa123.inventory().ids,score:__world123.state().score}}''');check('rescue_preserves_inventory_and_progress',not rescue['wreck'] and rescue['hp']==100 and sorted(rescue['idsBefore'])==sorted(rescue['idsAfter']),rescue)
 overpass=page.evaluate('''()=>{__qa123.prepare();const w=__world123.raw(),c=w.crossings[1];__qa123.pose([c.x,8.12,c.z+2.7],-Math.PI/2);__qa123.shift(c.s-10);for(let i=0;i<2*120;i++)__world123.railStep(1/120);return{wreck:!!w.wreck,hp:__world123.car().hp}}''');check('height_separation_no_train_ghost_hit',not overpass['wreck'] and overpass['hp']==100,overpass)
 sweep=page.evaluate('''()=>{__qa123.prepare();const w=__world123.raw(),c=w.crossings[1];__qa123.shift(c.s);const old={p:[c.x-20,.12,c.z],yaw:-Math.PI/2};__qa123.pose([c.x+20,.12,c.z],-Math.PI/2);__world123.railStep(.016,old);return{wreck:!!w.wreck,hp:__world123.car().hp}}''');check('high_speed_relative_sweep_hits_train',sweep['wreck'] and sweep['hp']==0,sweep)
 snap=page.evaluate('''()=>{const a=__world123.snapshot();return{data:a.world123,models:a.city012.trafficModels.length,protocol:NET_PROTOCOL}}'''.replace('protocol:NET_PROTOCOL','protocol:document.title'))
 check('host_snapshot_has_trains_and_wreck',len(snap['data']['progress'])==2 and snap['data']['wreck'] is not None and snap['models']==32,snap)
 page.evaluate('__qa123.prepare();__qa123.pose([133,.12,170.7],-Math.PI/2);const c=__world123.raw().crossings[0];__qa123.shift(c.s-12);__world123.crossings(2);__qa123.draw();__qa123.camera([119,19,198],[154,2,165])');page.screenshot(path=str(OUT/'crossing.png'))
 page.evaluate('__qa123.camera([310,86,336],[198,0,204])');page.screenshot(path=str(OUT/'east-district.png'))
 page.evaluate('__qa123.prepare();__qa123.pose([207,8.12,10.7],-Math.PI/2);__qa123.camera([198,14,20],[226,13,8])');page.screenshot(path=str(OUT/'sign.png'))
 page.evaluate('__qa123.camera([-96,28,124],[-80,15,-65])');page.screenshot(path=str(OUT/'skyline.png'))
 layouts=[]
 for width,height in [(1280,800),(390,844),(844,390)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(300);page.evaluate('__qa123.prepare();__qa123.pose([133,.12,170.7],-Math.PI/2);__qa123.draw();__qa123.camera([119,13,189],[151,2,167])');layouts.append(page.evaluate('({width:innerWidth,height:innerHeight,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth})'));page.screenshot(path=str(OUT/f'game-{width}x{height}.png'))
 check('responsive_three_sizes',all(x['doc']<=x['width'] and x['body']<=x['width'] for x in layouts),layouts)
 gl=page.evaluate('__qa123.gl()');check('real_webgl_no_errors',gl['error']==0 and 'WebGL' in gl['version'],gl);check('no_page_errors',not errors,errors)
 # Offline-byte failure injection: a missing new GLB must not permit play or fake 100%.
 bad=browser.new_page(viewport={'width':390,'height':844});inject="""const originalFetch123=window.fetch;window.fetch=(url,...args)=>String(url).includes('train-diesel-a.glb')?Promise.resolve(new Response('missing',{status:404})):originalFetch123(url,...args);"""
 badHTML=html[:pos]+inject+html[pos:] if False else html.replace('\ncity012Init();','\n'+inject+'\ncity012Init();')
 bad.set_content(badHTML,timeout=120000,wait_until='domcontentloaded');bad.wait_for_function('CD123Boot.error',polling=200,timeout=100000)
 failure=bad.evaluate('({error:CD123Boot.error,ready:CD123Boot.ready,pct:document.getElementById("boot123bar").value,disabled:document.getElementById("startBtn").disabled,retry:!document.getElementById("boot123retry").hidden})');check('missing_asset_blocks_start_and_exposes_retry',failure['error'] and not failure['ready'] and failure['pct']<100 and failure['disabled'] and failure['retry'],failure);bad.screenshot(path=str(OUT/'load-failure-phone.png'));bad.close()
 browser.close()
result['summary']={'passed':sum(result['checks'].values()),'groups':len(result['checks'])};save();print(result['summary'],flush=True)
if not all(result['checks'].values()):raise SystemExit('Failed: '+','.join(k for k,v in result['checks'].items() if not v))
