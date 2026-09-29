/* V0.11 SUBURBAN. Native Kenney houses and measured native apertures.
 * Authored front is -Z; house front is +Z. No added task doors, windows or number plates.
 * Assets, body colliders, paths, targeting and delivery share one placement transform.
 */
const SUB011={ready:false,error:'',assets:new Map(),meshes:new Map(),placements:[],homes:[],gates:[],colliders:[],yards:null,loadMs:0,draws:0,
 names:[...'abcdefghijklmnopqrstu'].map(x=>'building-type-'+x).concat(['driveway-short','path-short','path-stones-short','fence-low','tree-small','tree-large','planter'])};
// kind,x,y,z,width,height in original GLB coordinates; verified on native facade geometry.
const SUB011_NATIVE={
 a:{scale:9.4,portals:[['door',0,.135,-.344,.14,.27],['window',.4,.20,-.324,.20,.10],['window',-.4,.20,-.324,.20,.10]]},
 b:{scale:8.2,portals:[['door',.256,.135,-.400,.14,.27],['window',-.144,.20,-.380,.20,.10],['window',-.544,.20,-.380,.20,.10],['window',.256,.60,-.380,.20,.10]]},
 d:{scale:8.0,portals:[['garage',-.6418,.135,-.344,.26,.27],['door',.1582,.135,-.344,.14,.27],['window',-.2418,.20,-.324,.10,.10],['window',.5582,.20,-.324,.10,.10]]},
 h:{scale:10.0,portals:[['door',0,.135,-.400,.14,.27],['window',.4,.16,-.380,.10,.18],['window',-.4,.16,-.380,.10,.18]]},
 n:{scale:8.0,portals:[['garage',.6558,.135,-.659,.26,.27],['garage',.2558,.135,-.659,.26,.27],['door',-.1442,.135,-.259,.14,.27],['window',-.5442,.20,-.239,.20,.10]]},
 u:{scale:8.6,portals:[['garage',.456,.135,-.507,.26,.27],['door',.056,.135,-.307,.14,.27],['window',-.344,.20,-.287,.20,.10]]}
};
function sub011Model(o){const bb=SUB011.assets.get(o.name).bounds;return M.multiply(scaled(M.model([o.x,.12,o.z],[0,o.yaw+Math.PI,0]),o.scale),M.model(V.mul(bb.center,-1)));}
function sub011Foot(name,x,z,yaw,scale){const b=SUB011.assets.get(name).bounds;return{name,x,z,yaw,scale,hw:b.size[0]*scale/2,hd:b.size[2]*scale/2,height:b.size[1]*scale,minY:.12,maxY:.12+b.size[1]*scale};}
function sub011Clear(o,main=false){return ind012StreetClear(o,.35)&&ind014ElevatedClear(o,4)&&!industrial012.reserved.some(r=>ind012Overlap(o,r,.8))&&!SUB011.homes.some(r=>ind012Overlap(o,r,main?2:2.4));}
function sub011FindHome(h,name,scale){
 const bb=SUB011.assets.get(name).bounds,original=[h.x,0,h.z],meta=SUB011_NATIVE[name.slice(-1)],ref=meta?meta.portals[0][3]:bb.min[2]+.1;
 const candidates=cityEdges.map(e=>segmentProjection(original,e)).filter(q=>!ind014ElevatedNear(q.q[0],q.q[2],10)).sort((a,b)=>a.d-b.d);
 for(const size of [scale,scale*.96,scale*.92])for(const q of candidates.slice(0,8)){
  const e=q.edge,a=cityNodes[e.a],d=edgeDirection(e.a,e.b),right=[-d[2],0,d[0]],defaultSide=V.dot(V.sub(original,q.q),right)>=0?1:-1;
  for(const side of [defaultSide,-defaultSide])for(const shift of [0,-4,4,-8,8,-12,12]){
   const hw=bb.size[0]*size/2,u=clamp(q.t*e.len+shift,8+hw+2,e.len-8-hw-2);if(8+hw+2>e.len-8-hw-2)continue;
   const road=[a.x+d[0]*u,0,a.z+d[2]*u],out=V.mul(right,side),yaw=Math.atan2(-out[0],-out[2]),doorZ=-(ref-bb.center[2])*size,setback=3.8;
   const pos=V.add(road,V.mul(out,8+setback+doorZ)),o=sub011Foot(name,pos[0],pos[2],yaw,size);
   if(districtAt(o.x,o.z)!=='garden'||!sub011Clear(o,h.deliverable))continue;
   Object.assign(o,{h,role:h.deliverable?'delivery':'infill',frontageEdge:e.id,road,frontage:doorZ,setback});o.m=sub011Model(o);return o;
  }
 }return null;
}
function sub011Adopt(o){
 const h=o.h;Object.assign(h,{x:o.x,z:o.z,yaw:o.yaw,model:M.model([o.x,0,o.z],[0,o.yaw,0]),suburban011:true,nativeModel011:o.name,suburbanSetback:o.setback,frontageEdge:o.frontageEdge,suburbanHalf:[o.hw,o.hd],labelHeight012:o.height+1.2});h.address='向阳住宅区 '+h.num+' 号';h.gates=[];
 if(h.deliverable)for(const [kind,x,y,z,w,hh] of SUB011_NATIVE[o.name.slice(-1)].portals){
  const p=M.point(o.m,[x,y,z]),q=houseLocal(h,p),g={house:h,index:h.gates.length,x:q[0],y:q[1],planeZ:q[2],w:w*o.scale,h:hh*o.scale,type:kind==='window'?'window':'door',nativeKind:kind,broken:false,holes012:[],suburban011:true,center:p};h.gates.push(g);SUB011.gates.push(g);
 }
 SUB011.homes.push(o);SUB011.placements.push(o);SUB011.colliders.push({...o,label:'native-home',house:h.num});
}
function sub011AddProp(name,p,yaw,scale,role,collision=false){
 const bb=SUB011.assets.get(name).bounds,o={name,x:p[0],z:p[2],yaw,scale,role,hw:bb.size[0]*scale/2,hd:bb.size[2]*scale/2,height:bb.size[1]*scale};
 o.m=M.multiply(scaled(M.model(p,[0,yaw,0]),scale),M.model(V.mul(bb.center,-1)));SUB011.placements.push(o);
 if(collision)SUB011.colliders.push({...o,hw:Math.min(o.hw,.28),hd:Math.min(o.hd,.28),minY:.12,maxY:2.6,label:'garden-tree'});return o;
}
function sub011Yards(){const b=new MeshBuilder();let i=0;
 for(const o of SUB011.homes){const h=o.h,m=h.model,ref=h.gates.find(g=>g.nativeKind==='garage')||h.gates[0],dx=ref?.x||0,face=ref?.planeZ||o.frontage,depth=Math.max(2,o.setback+o.frontage-face);
  b.box(o.hw*2+1.4,.025,o.hd*2+1.3,['#94b987','#a3c58b','#9abe8b'][i%3],[0,.026,0],[0,0,0],m);
  const pathW=ref?.nativeKind==='garage'?Math.max(2.2,ref.w+.45):1.3;
  b.box(pathW,.012,depth+.35,'#ced1c2',[dx,.058,face+(depth+.35)/2],[0,0,0],m);
  for(const side of [-1,1])sub011AddProp('fence-low',houseWorld(h,[side*(o.hw+.9),.08,-o.hd*.45]),o.yaw+Math.PI/2,2.6,'fence');
  const tp=houseWorld(h,[(i%2?-1:1)*(o.hw+.6),.07,-o.hd*.72]);if(closestCityRoad(tp).d>10)sub011AddProp(i%3?'tree-small':'tree-large',tp,i*.53,3,'tree',true);i++;
 }SUB011.yards=renderer.mesh(b);
}
function sub011Setup(){
 const residential=houses.filter(h=>h.style==='garden'),jobs=residential.filter(h=>h.deliverable).sort((a,b)=>a.num-b.num),names=['a','b','d','h','n','u'];
 industrial012.reserved=industrial012.reserved.filter(r=>!residential.some(h=>Math.abs(r.x-h.x)<.001&&Math.abs(r.z-h.z)<.001));
 jobs.forEach((h,i)=>{const k=names[i%6],o=sub011FindHome(h,'building-type-'+k,SUB011_NATIVE[k].scale);if(!o)throw Error('No safe residential frontage #'+h.num);sub011Adopt(o);});
 for(const h of residential.filter(h=>!h.deliverable)){const k=['c','e','f','g','i','j','k','l','m','o','p','q','r','s','t'][SUB011.homes.length%15],o=sub011FindHome(h,'building-type-'+k,7.5);if(o)sub011Adopt(o);else{h.suburban011=true;h.gates=[];h.hidden011=true;}}
 let serial=400;
 for(const e of cityEdges){if(SUB011.homes.length>=22)break;const a=cityNodes[e.a],d=edgeDirection(e.a,e.b),r=[-d[2],0,d[0]];
  for(const side of [-1,1]){if(SUB011.homes.length>=22)break;const x=a.x+d[0]*e.len*.5+r[0]*side*20,z=a.z+d[2]*e.len*.5+r[2]*side*20;if(districtAt(x,z)!=='garden')continue;
   const k=['e','g','i','j','k','m','o','p','q','r','s','t'][serial%12],h={x,z,yaw:0,num:serial++,deliverable:false,done:false,district:'garden',style:'garden',gates:[]},o=sub011FindHome(h,'building-type-'+k,7.8);if(!o)continue;houses.push(h);sub011Adopt(o);
  }
 }
 for(const o of SUB011.homes)industrial012.reserved.push({x:o.x,z:o.z,yaw:o.yaw,hw:o.hw+.4,hd:o.hd+.4});
 sub011Yards();ind012RepositionFurniture();routeCache=null;routeClock=-1;cityMapClock=-1;manifestSignature='';lighting012BuildShadows();
}
function sub011Draw(){if(!SUB011.ready||state.mode==='wardrobe')return;SUB011.draws=0;if(SUB011.yards)renderer.draw(SUB011.yards);for(const o of SUB011.placements){if(V.len(V.sub([o.x,o.height*.4,o.z],eye))>180)continue;renderer.draw(SUB011.meshes.get(o.name),o.m);SUB011.draws++;}}
function sub011RayTri(a,b,tri){const d=V.sub(b,a),e1=V.sub(tri[1],tri[0]),e2=V.sub(tri[2],tri[0]),p=V.cross(d,e2),det=V.dot(e1,p);if(Math.abs(det)<1e-10)return null;const inv=1/det,t=V.sub(a,tri[0]),u=V.dot(t,p)*inv;if(u<0||u>1)return null;const q=V.cross(t,e1),v=V.dot(d,q)*inv;if(v<0||u+v>1)return null;const time=V.dot(e2,q)*inv;return time>=0&&time<=1?{t:time,n:V.norm(V.cross(e1,e2))}:null;}
function sub011AssetPoint(o,p){const q=houseLocal(o,p),b=SUB011.assets.get(o.name).bounds;return[-q[0]/o.scale+b.center[0],(q[1]-.12)/o.scale+b.center[1],-q[2]/o.scale+b.center[2]];}
function sub011TargetHit(h,g,old,next,p){const a=houseLocal(h,old),b=houseLocal(h,next),r=p.r||.24,z=g.planeZ+Math.max(.45,r+.08),dz=b[2]-a[2];if(dz>=-1e-6||a[2]<z||b[2]>z)return null;const u=(z-a[2])/dz,q=V.lerp(a,b,u);if(Math.abs(q[0]-g.x)>g.w/2-r*.35||Math.abs(q[1]-g.y)>g.h/2-r*.35)return null;return{t:u,h,g,q};}
function sub011Intercept(p,old,next){let hit=null;
 for(const o of SUB011.homes){if(Math.hypot(old[0]-o.x,old[2]-o.z)>o.hw+o.hd+7)continue;const h=o.h;
  for(const g of h.gates){const v=sub011TargetHit(h,g,old,next,p);if(v&&(!hit||v.t<hit.t))hit={...v,kind:'gate'};}
  const la=sub011AssetPoint(o,old),lb=sub011AssetPoint(o,next),bb=SUB011.assets.get(o.name).bounds;if(!segmentBox(la,lb,bb.min,bb.max))continue;
  for(const tri of SUB011.assets.get(o.name).faces){const v=sub011RayTri(la,lb,tri);if(v&&(!hit||v.t<hit.t))hit={...v,kind:'solid',o};}
 }if(!hit)return false;
 if(hit.kind==='gate'){
  if(hit.g.type==='window')glass012Impact(hit.h,hit.g,p,[hit.q[0],hit.q[1],hit.g.planeZ]);deliver(hit.h,hit.g,p);
  if(p.delivered){p.rest012=houseWorld(hit.h,[hit.g.x,hit.g.y,hit.g.planeZ-.5]);p.p=p.rest012.slice();p.v=[0,0,0];}
  else{p.p=houseWorld(hit.h,[hit.g.x,p.r+.12,hit.g.planeZ+1]);p.v=worldVelocity(hit.h,[0,.6,2]);p.returnToDoor=false;}
 }else{p.p=V.lerp(old,next,Math.max(0,hit.t-.005));const n=worldVelocity(hit.o,[-hit.n[0],hit.n[1],-hit.n[2]]),dot=V.dot(p.v,n);p.v=V.sub(p.v,V.mul(n,dot*1.25));p.pending=null;p.bounces=(p.bounces||0)+1;}return true;
}
const sub011ParcelBase=stepWorldPackage;stepWorldPackage=function(p,dt){if(SUB011.ready&&!p.delivered&&net.mode!=='guest'){const next=V.add(p.p,V.add(V.mul(p.v,dt),[0,-6*dt*dt,0]));if(sub011Intercept(p,p.p.slice(),next)){p.age+=dt;p.v[1]-=12*dt;return;}}sub011ParcelBase(p,dt);};
const sub011CarBase=stepCar;stepCar=function(dt,predictionOnly=false){const n=SUB011.ready?Math.max(1,Math.ceil((Math.abs(car.speed)+2)*dt/.38)):1;for(let j=0;j<n;j++){sub011CarBase(dt/n,predictionOnly);if(!SUB011.ready)continue;for(let pass=0;pass<2;pass++)for(const c of SUB011.colliders){if(Math.hypot(car.p[0]-c.x,car.p[2]-c.z)>c.hw+c.hd+6)continue;const q=ind012SAT(c);if(!q)continue;const sp=Math.abs(car.speed);car.p=V.add(car.p,V.mul(q.n,q.depth+.015));car.speed=0;car.velocity=[0,0,0];car.kick=[0,0,0];if(!predictionOnly&&sp>1)impact(Math.min(9,sp*.4));}}};
const sub011WalkBase=walkCollision;walkCollision=function(p){p=sub011WalkBase(p);if(SUB011.ready)for(const c of SUB011.colliders){if(p[1]<c.minY||p[1]-WALK_EYE>c.maxY)continue;p=slideOut(p,c.x,c.z,c.yaw,c.hw+.32,c.hd+.32);}return p;};
const sub011LineBase=clearLine;clearLine=function(a,b){if(!sub011LineBase(a,b))return false;if(SUB011.ready)for(const c of SUB011.colliders)if(segmentBox(houseLocal(c,a),houseLocal(c,b),[-c.hw,c.minY,-c.hd],[c.hw,c.maxY,c.hd]))return false;return true;};
const sub011RayBase=rayHouse;rayHouse=function(ray,h){if(!h.suburban011)return sub011RayBase(ray,h);const a=houseLocal(h,ray.o),d=localVelocity(h,ray.d);if(d[2]>=-1e-6)return null;let hit=null;for(const g of h.gates){const t=(g.planeZ+.45-a[2])/d[2];if(t<0||t>80)continue;const p=V.add(a,V.mul(d,t));if(Math.abs(p[0]-g.x)<=g.w/2&&Math.abs(p[1]-g.y)<=g.h/2&&(!hit||t<hit.t))hit={t,p:houseWorld(h,p),gate:g,house:h};}return hit;};
// Transparent crack decal and dark hole shading only after impact; intact native pane remains unchanged.
const sub011GlassBase=glass012Texture;glass012Texture=function(g){if(!g.suburban011)return sub011GlassBase(g);const key=g.house.num+':'+g.index,sig='sub011:'+JSON.stringify(g.holes012||[]);let o=GLASS012.panes.get(key);if(o?.signature===sig)return o;if(!o){o={texture:renderer.gl.createTexture()};GLASS012.panes.set(key,o);}const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 for(const hole of g.holes012||[]){const random=glass012Random(hole.seed),px=(.5+hole.x/g.w)*256,py=(.5-hole.y/g.h)*256;x.save();x.translate(px,py);x.scale(256/g.w,256/g.h);const pts=[];for(let i=0;i<17;i++){const a=i/17*TAU,r=hole.r*(.7+random()*.25);pts.push([Math.cos(a)*r,Math.sin(a)*r]);}x.beginPath();pts.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.closePath();x.fillStyle='rgba(22,35,43,.96)';x.fill();x.strokeStyle='rgba(230,244,241,.94)';x.lineWidth=.017;x.stroke();for(const p of pts){x.beginPath();x.moveTo(...p);x.lineTo(p[0]*1.6,p[1]*1.55);x.lineTo(p[0]*2.2+.04,p[1]*2);x.stroke();}x.restore();}
 const gl=renderer.gl;gl.bindTexture(gl.TEXTURE_2D,o.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);o.signature=sig;o.canvas=c;return o;};
function sub011RefreshBoot(){const ok=SUB011.ready&&industrial012.ready&&road09.ready;for(const id of ['startBtn','roadStart09','hostBtn','joinBtn']){const el=$(id);if(el)el.disabled=!ok;}const el=$('suburbanLoad011');if(el)el.textContent=SUB011.error?'住宅加载失败：'+SUB011.error:ok?'住宅区已就绪 · 原生门窗投递':'住宅素材加载中…';if(!ok&&!SUB011.error)setTimeout(sub011RefreshBoot,120);}
async function sub011Init(){const began=performance.now();try{
 const img=new Image(),pal=await new Promise((resolve,reject)=>{img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);resolve({data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height});};img.onerror=()=>reject(Error('Suburban palette missing'));img.src='./assets/kenney-suburban/colormap.png';});
 const loader=new RoadGLB09(pal.data,pal.w,pal.h);for(const name of SUB011.names){const r=await fetch('./assets/kenney-suburban/'+name+'.glb');if(!r.ok)throw Error(name+': '+r.status);const bytes=new Uint8Array(await r.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));const a=loader.load(name,btoa(raw));a.bounds=ind012Bounds(a);SUB011.assets.set(name,a);SUB011.meshes.set(name,renderer.mesh(a.b));}
 for(let i=0;!industrial012.ready&&i<250;i++){if(industrial012.error)throw Error(industrial012.error);await new Promise(r=>setTimeout(r,40));}if(!industrial012.ready)throw Error('工业区尚未就绪');sub011Setup();SUB011.ready=true;SUB011.loadMs=performance.now()-began;window.__suburban011Ready=true;sub011RefreshBoot();
 }catch(e){SUB011.error=e.message;console.error('Suburban V0.11:',e);sub011RefreshBoot();}}
const load011=document.createElement('div');load011.id='suburbanLoad011';load011.style.cssText='font-size:12px;color:#d1e2cd;margin:8px 0';$('startBtn').after(load011);sub011RefreshBoot();sub011Init();
if(window.__deliveryTest)window.__deliveryTest.suburban011={
 info:()=>({ready:SUB011.ready,error:SUB011.error,homes:SUB011.homes.map(o=>({num:o.h.num,role:o.role,name:o.name,x:o.x,z:o.z,yaw:o.yaw,w:o.hw*2,d:o.hd*2,height:o.height,setback:o.setback,road:o.frontageEdge,gates:o.h.gates.map(g=>({x:g.x,y:g.y,z:g.planeZ,w:g.w,h:g.h,kind:g.nativeKind}))})),props:SUB011.placements.length-SUB011.homes.length,draws:SUB011.draws}),
 audit:()=>({overlaps:SUB011.homes.flatMap((a,i)=>SUB011.homes.slice(i+1).filter(b=>ind012Overlap(a,b,0)).map(b=>[a.h.num,b.h.num])),roadConflicts:SUB011.homes.filter(o=>!ind012StreetClear(o,.1)).map(o=>o.h.num)}),
 reset:()=>{stopNetwork(false);resetGame(false);freezeSimulation=true;for(const t of traffic){t.phase='cleared';t.p=[-300,.1,-300];}for(const t of road09.npc){t.phase='parked';t.stopped=-1e8;t.p=[-300,.1,-300];}},
 fire:(num,gate=0,dx=0,dy=0,order=num)=>{const h=houses.find(h=>h.num===num),g=h.gates[gate],p=cargo.find(p=>p.order===order);if(!p)throw Error('Missing parcel');cargo.splice(cargo.indexOf(p),1);const start=[g.x+dx,g.y+dy,g.planeZ+8],time=8/24;p.p=houseWorld(h,start);p.v=worldVelocity(h,[0,6*time,-24]);Object.assign(p,{delivered:false,pending:null,age:0,thrown:true,rot:[0,0,0],spin:[0,0,0],integrity:100,vehicleSpeed:8});packages.push(p);return p.id;},
 camera:num=>{const h=houses.find(h=>h.num===num),o=SUB011.homes.find(o=>o.h===h);road09.debugCamera={eye:houseWorld(h,[-16,10,o.hd+27]),at:houseWorld(h,[0,3,o.hd-2])};updateCamera(.1);draw3D();},
 raw:()=>({state:{score:state.score,delivered:state.delivered,view:state.view},car:{p:car.p,speed:car.speed},parcels:packages.map(p=>({id:p.id,order:p.order,done:p.delivered,p:p.p})),protocol:NET_PROTOCOL}),
 warp:num=>{const h=houses.find(h=>h.num===num),o=SUB011.homes.find(o=>o.h===h);car.p=V.add(o.road,worldVelocity(h,[-3,.12,0]));car.yaw=h.yaw+Math.PI/2;car.speed=0;car.velocity=[0,0,0];car.hp=100;car.fault='';state.view='drive';updateCamera(.1);syncButtons();},
 predict:dt=>stepCar(dt,true),
 releaseCheck:()=>({native:V01051N.ready,textureDoorDrawing:V01051.draws,homes:SUB011.homes.length,orders:TOTAL})
};
