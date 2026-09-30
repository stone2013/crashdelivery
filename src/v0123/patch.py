"""Checked, additive V0.12.3 patches over the reproducible V0.12.2 candidate.
The immutable V0.11.2 snapshot and original GLB files are never modified.
"""
from pathlib import Path
import json,re

def apply(s:str,root:Path)->str:
 def replace(a,b,n=1):
  nonlocal s
  count=s.count(a)
  if count<n:raise RuntimeError('V0123 patch missing: '+a[:130])
  s=s.replace(a,b,n)
 folder=root/'src/v0123'
 # The boot meter counts models after successful parsing plus five init jobs.
 boot=(folder/'boot-v0123.js').read_text();css=(folder/'ui-v0123.css').read_text()
 replace('<head>','<head>\n<script>'+boot+'</script>\n<style>'+css+'</style>')
 meter='''<section id="boot123" role="status" aria-live="polite" aria-busy="true"><div class="row123"><span id="boot123label">读取原生道路和建筑</span><b id="boot123pct">0%</b></div><progress id="boot123bar" max="100" value="0" aria-label="游戏资源加载进度"></progress><small id="boot123count">0 / 140 项 · 模型解析与场景初始化</small><button id="boot123retry" type="button" hidden>重新加载</button></section>'''
 replace('<div class="profileSetup">',meter+'<div class="profileSetup">')
 replace('<button id="startBtn" class="secondary soloLink" disabled>','<button id="startBtn" class="primary soloLink" disabled>')
 replace('constructor(pixels,w,h){this.pixels=pixels;this.w=w;this.h=h;}', 'constructor(pixels,w,h){this.pixels=pixels;this.w=w;this.h=h;this.boot123=++CD123Boot.serial;}')
 replace('return {name,b,faces,triangles:b.a.length/27};',"CD123Boot.mark('model:'+this.boot123+':'+name,'解析模型 · '+name);return {name,b,faces,triangles:b.a.length/27};")
 replace("solo.disabled=false;solo.textContent='V0.12.2 · 开始派送 →';", "solo.disabled=true;solo.textContent='V0.12.3 · 开始派送 →';CD123Boot.paint();")
 replace("document.getElementById('roadStart09').disabled=false;", "document.getElementById('roadStart09').disabled=true;")
 replace('function city012Boot(){','function city012Boot(){CD123Boot.paint();')
 # Complete world preparation before any entry button can become usable.
 replace('city012Decor();city012BuildNav();CITY012.ready=true;', 'city012Decor();city012BuildNav();await world123Init();CD123Boot.finish();if(CD123Boot.error)throw Error(CD123Boot.error);CITY012.ready=true;')
 replace("}catch(e){CITY012.error=e.message;console.error(","}catch(e){CITY012.error=e.message;CD123Boot.fail(e);console.error(")
 # Broad road09Zone is needed for physics, not for overriding the map button.
 replace("document.getElementById('mapOpenBtn')?.addEventListener('click',e=>{if(road09Zone(road09View())&&!road09Duel()){e.preventDefault();e.stopImmediatePropagation();road09OpenMap();}},true);",'// V0123: normal map button retains the full-city handler; no capture interception.')
 replace("document.getElementById('roadHUDMap09').onclick=road09OpenMap;","document.getElementById('roadHUDMap09').onclick=openCityMap;")
 replace('aria-label="打开立体试验区地图">导览 J','aria-label="打开全城地图">地图 J')
 replace("road09.mapOpen?road09CloseMap():road09OpenMap();", "if(road09.mapOpen)road09CloseMap();$('cityScreen').classList.contains('hidden')?openCityMap():closeCityMap();")
 replace("menuMap.textContent='立体路网导览 · J'", "menuMap.textContent='SKYWAY 试跑说明（非全城地图）'")
 replace("document.getElementById('startBtn').before(start);", "document.querySelector('.lobbyLabel').before(document.getElementById('startBtn'));document.getElementById('startBtn').after(start);")
 replace("start.className='primary roadStart09'", "start.className='secondary roadStart09'")
 replace('SKYWAY DISTRICT / V0.9', 'SKYWAY 试跑说明 / V0.12.3')
 replace('城市地图 / 三个街区 ↗','全城地图 / 高速 · 铁路 ↗')
 # World-ray sky: clouds and sun follow world direction, not a screen-fixed wallpaper.
 start=s.index('  const skyFs=`');end=s.index('`;\n',start)+3
 sky='''  const skyFs=`precision mediump float;varying vec2 vUv;uniform float uAspect;uniform vec3 uSkyForward;uniform vec3 uSkyRight;uniform vec3 uSkyUp;uniform float uTanY;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){vec2 uv=vUv*2.-1.;vec3 ray=normalize(uSkyForward+uSkyRight*uv.x*uTanY*uAspect+uSkyUp*uv.y*uTanY);float h=max(0.,ray.y);vec3 horizon=vec3(.78,.85,.84),zenith=vec3(.23,.48,.72);vec3 sky=mix(horizon,zenith,pow(smoothstep(0.,.85,h),.55));sky=mix(vec3(.60,.73,.76),sky,smoothstep(-.28,.02,ray.y));vec2 q=ray.xz/(.28+h)*2.;float n=noise(q*1.5)*.60+noise(q*3.1)*.27+noise(q*6.3)*.13;float cloud=smoothstep(.55,.73,n)*smoothstep(.04,.17,h)*(1.-smoothstep(.64,.95,h));sky=mix(sky,vec3(.97,.96,.90),cloud*.72);vec3 sun=normalize(vec3(-.50,.78,.37));float d=length(ray-sun);sky+=vec3(1.,.70,.40)*exp(-d*9.)*.14;float disk=1.-smoothstep(.012,.022,d);sky=mix(sky,vec3(1.,.95,.78),disk*.95);gl_FragColor=vec4(sky,1.);}`;
'''
 s=s[:start]+sky+s[end:]
 replace("this.skyBuffer=gl.createBuffer();", "this.skyForward=gl.getUniformLocation(this.skyProgram,'uSkyForward');this.skyRight=gl.getUniformLocation(this.skyProgram,'uSkyRight');this.skyUp=gl.getUniformLocation(this.skyProgram,'uSkyUp');this.skyTanY=gl.getUniformLocation(this.skyProgram,'uTanY');this.skyBuffer=gl.createBuffer();")
 replace('gl.uniform1f(this.skyAspect,w/h);', 'gl.uniform1f(this.skyAspect,w/h);gl.uniform3fv(this.skyForward,forward);gl.uniform3fv(this.skyRight,right);gl.uniform3fv(this.skyUp,up);gl.uniform1f(this.skyTanY,tanY);')
 replace('M.perspective(fov,w/h,.045,330)', 'M.perspective(fov,w/h,.045,850)')
 s=s.replace('smoothstep(150.,310.,length(vWorld-uEye))','smoothstep(220.,690.,length(vWorld-uEye))').replace('vec3 haze=vec3(.69,.79,.81)','vec3 haze=vec3(.78,.85,.84)')
 # Correct normals when native terrain is scaled more in X/Z than in Y.
 replace('uniform mat4 uVP;uniform mat4 uModel;varying vec3 vColor;', 'uniform mat4 uVP;uniform mat4 uModel;uniform mat3 uNormal123;varying vec3 vColor;')
 replace('normalize(mat3(uModel)*aNormal)', 'normalize(uNormal123*aNormal)')
 replace("['uVP','uModel','uEye','uAlpha','uShade'].forEach", "['uVP','uModel','uEye','uAlpha','uShade','uNormal123'].forEach")
 replace('gl.uniformMatrix4fv(this.loc.uModel,false,model);', '''gl.uniformMatrix4fv(this.loc.uModel,false,model);const nm=this.normal123||(this.normal123=new Float32Array(9));for(let c=0;c<3;c++){const k=c*4,d=model[k]*model[k]+model[k+1]*model[k+1]+model[k+2]*model[k+2]||1;for(let r=0;r<3;r++)nm[c*3+r]=model[k+r]/d;}gl.uniformMatrix3fv(this.loc.uNormal123,false,nm);''')
 replace("limit=quality==='low'?142:185", "limit=quality==='low'?260:370")
 replace('(tall?285:limit)', "(tall?(quality==='low'?440:610):limit)")
 replace("c.label==='environment'?(quality==='low'?90:135):215", "c.label==='environment'?(quality==='low'?110:165):(quality==='low'?290:420)")
 s=s.replace("'#a7c98d'", "'#9fb78b'")
 # Native gantry local Z is its span, local -X is the face. Width20m,
 # bottom of board >5m; supports are outside the 16m road, not in its centre.
 a=s.index('function v0105AddGantry(');b=s.index('function v0105BuildGantries()',a)
 s=s[:a]+'''function v0105AddGantry(builder,cx,cz,baseY,travelYaw,leftText,rightText){const asset=road09.assets.get('sign-highway');if(!asset)return;const yaw=travelYaw+Math.PI/2,m=scaled(M.model([cx,baseY,cz],[0,yaw,0]),[12,12,20]);w123MeshTransform(asset.b.a,m,builder);const labelM=M.multiply(m,M.model([-.111,.592,0],[0,-Math.PI/2,0]));cityText(builder,leftText,[-.235,0,0],.0065,'#f6f6df',labelM);cityText(builder,rightText,[.235,0,0],.0065,'#f6f6df',labelM);V0105.gantries.push({x:cx,z:cz,y:baseY,yaw,travelYaw,m:Array.from(m),left:leftText,right:rightText});}
'''+s[b:]
 replace("v0105AddGantry(b,84,0,.08,","v0105AddGantry(b,84,-56,.08,") # Old sign stood on a deliberately missing street.
 # Draw opaque world first, then the existing shadows and transparency passes.
 replace('city012Draw();lighting012Shadows();', 'city012Draw();w123Draw();lighting012Shadows();')
 replace('renderer.draw(vanShadow,M.model', "if(typeof WORLD123!=='undefined'&&WORLD123.wreck){renderer.draw(wreckMesh,scaled(M.model(car.p,[0,car.yaw,.12]),[1.6,1.3,1.8]));drawPlayers();}else{renderer.draw(vanShadow,M.model")
 replace('lighting012Brake(vanM);renderer.shade=1;', 'lighting012Brake(vanM);renderer.shade=1;}')
 # Railway layer appears before route, order markers and the player arrow.
 # All occurrences are inside renderCityMap implementations; extension later replaces them.
 replace("const route=getCityRoute();if(route)line(route.points,'#bceee0'", "w123RailMap(canvas,large);const route=getCityRoute();if(route)line(route.points,'#bceee0'")
 replace("c.translate(m.x(car.p[0]),m.z(car.p[2]));c.rotate(-car.yaw);", "const focus=state.view==='outside'?player.p:car.p;c.translate(m.x(focus[0]),m.z(focus[2]));c.rotate(-(state.view==='outside'?player.yaw:car.yaw));",n=s.count("c.translate(m.x(car.p[0]),m.z(car.p[2]));c.rotate(-car.yaw);"))
 world=(folder/'world-v0123.js').read_text().replace('__MODEL_MANIFEST__',(folder/'models.json').read_text())
 # Last call belongs to the city extension, after roads and existing wrapper bindings.
 at=s.rfind('\ncity012Init();')
 if at<0:raise RuntimeError('V0123 initializer insertion missing')
 s=s[:at]+'\n'+world+'\n'+s[at:]
 # Menu, protocol and public identifiers: native-road internal version remains v122.
 s=s.replace('crash-delivery-mp0122','crash-delivery-mp0123').replace('V0.12.2','V0.12.3').replace("version:'0.12.2'","version:'0.12.3'").replace('NATIVE ROADS','WORLD & RAILWAY')
 s=s.replace("document.title='Crash Delivery · V0.12.3 Native Roads'", "document.title='Crash Delivery · V0.12.3 World & Railway'")
 s=s.replace('密集街区、城市天际线与三条高速。下一单，开向更远的地方。','草坡与远山、城市环线与运行中的列车。请在铁路红灯前等候。')
 return s
