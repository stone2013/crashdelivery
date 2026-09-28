/* V0.10.2 — Industrial frontage, dense lots, real receiving bays.
 * All asset transforms use the measured, centred GLB bounds. Road edge, facade,
 * bay, parcel triggers and body collider share one transform. Units are metres.
 */
const industrial012={ready:false,error:'',assets:new Map(),meshes:new Map(),placements:[],targets:[],colliders:[],chunks:[],reserved:[],audit:[],loadMs:0,
 models:['building-a','building-f','building-l','building-q','building-r','building-t','water-tower','detail-tank-large','chimney-large','shipping-container-a','shipping-container-b','shipping-container-c','solar-panel-landscape-group']};
function ind012Bounds(a){let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.b.a.length;i+=9)for(let k=0;k<3;k++){min[k]=Math.min(min[k],a.b.a[i+k]);max[k]=Math.max(max[k],a.b.a[i+k]);}return{min,max,size:max.map((v,k)=>v-min[k]),center:[(min[0]+max[0])/2,min[1],(min[2]+max[2])/2]};}
function ind012Local(o,p){return houseLocal(o,p);}
function ind012World(o,p){return houseWorld(o,p);}
function ind012Corners(o,pad=0){return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>ind012World(o,[a*(o.hw+pad),0,b*(o.hd+pad)]));}
function ind012Overlap(a,b,pad=0){const ac=ind012Corners(a),bc=ind012Corners(b);for(const o of [a,b])for(const axis of [[Math.cos(o.yaw),0,-Math.sin(o.yaw)],[Math.sin(o.yaw),0,Math.cos(o.yaw)]]){const av=ac.map(v=>V.dot(v,axis)),bv=bc.map(v=>V.dot(v,axis));if(Math.max(...av)+pad<=Math.min(...bv)||Math.max(...bv)+pad<=Math.min(...av))return false;}return true;}
function ind012StreetClear(o,pad=.6){
 // Use actual triangle-supported roads, including the SKYWAY, not an axis-aligned city guess.
 for(let x=-o.hw-pad;x<=o.hw+pad+.01;x+=Math.max(.7,(o.hw+pad)/6))for(let z=-o.hd-pad;z<=o.hd+pad+.01;z+=Math.max(.7,(o.hd+pad)/6)){
  const w=ind012World(o,[x,.1,z]);if(road09Levels(w[0],w[2]).some(g=>g.y<(o.height||30)+.15&&g.y>-.1))return false;
 }
 return true;
}
function ind012LotClear(o,pad=1.6){if(!ind012StreetClear(o))return false;return !industrial012.reserved.some(r=>ind012Overlap(o,r,pad));}
function ind012Instance(name,x,z,yaw,scale,role='building',h=null){
 const asset=industrial012.assets.get(name),bb=asset.bounds,hw=bb.size[0]*scale*.5,hd=bb.size[2]*scale*.5;
 const o={name,x,z,yaw,hw,hd,height:bb.size[1]*scale,scale,role,h,baseY:.12};
 const base=M.model([x,.12,z],[0,yaw,0]);const modelYaw=name.startsWith('building-')?Math.PI:0;o.m=M.multiply(M.multiply(scaled(base,scale),M.model([0,0,0],[0,modelYaw,0])),M.model(V.mul(bb.center,-1)));
 industrial012.placements.push(o);return o;
}
function ind012Collider(o,label=o.name){industrial012.colliders.push({x:o.x,z:o.z,yaw:o.yaw,hw:o.hw,hd:o.hd,minY:.12,maxY:o.height+.12,label,house:o.h?.num||0});}
function ind012Reserve(o,pad=0){industrial012.reserved.push({x:o.x,z:o.z,yaw:o.yaw,hw:o.hw+pad,hd:o.hd+pad});}
function ind012Frontage(h,name,desiredScale){
 const bb=industrial012.assets.get(name).bounds,original=[h.x,0,h.z],edges=cityEdges.map(e=>segmentProjection(original,e)).sort((a,b)=>a.d-b.d);
 for(const scale of [desiredScale,desiredScale*.95,desiredScale*.90])for(const q of edges.slice(0,5)){
  const e=q.edge,a=cityNodes[e.a],d=edgeDirection(e.a,e.b),right=[-d[2],0,d[0]],delta=V.sub(original,q.q),side=V.dot(delta,right)>=0?1:-1,out=V.mul(right,side),front=V.mul(out,-1),yaw=Math.atan2(front[0],front[2]);
  const hw=bb.size[0]*scale/2,hd=bb.size[2]*scale/2;
  for(const shift of [0,-4,4,-8,8]){
   const u=clamp(q.t*e.len+shift,8+hw+1,e.len-8-hw-1);if(u<8+hw)continue;
   const center=V.add([a.x,0,a.z],V.mul(d,u)),setback=3.25,dist=8+setback+hd;
   const pos=V.add(center,V.mul(out,dist)),o={x:pos[0],z:pos[2],yaw,hw,hd};
   if(!ind012LotClear(o,1))continue;
   Object.assign(h,{x:o.x,z:o.z,yaw,model:M.model([o.x,0,o.z],[0,yaw,0]),industrial012:true,facadeZ:hd,deliveryMode:'industrial',frontageEdge:e.id,setback012:setback});
   const inst=ind012Instance(name,o.x,o.z,yaw,scale,'main',h);h.labelHeight012=Math.min(inst.height,12)+1.8;ind012Collider(inst);ind012Reserve(inst);
   return{h,inst,road:center,out,front};
  }
 }
 throw Error('No safe enlarged frontage for #'+h.num);
}
function ind012Box(builder,w,h,d,c,p,m){builder.box(w,h,d,c,p,[0,0,0],m);}
function ind012Target(frontage,i,builder){
 const {h,inst}=frontage,styles=[['卷帘装卸口','bay'],['装卸平台','platform'],['开放集装箱','container'],['仓库收货门','bay'],['玻璃收货窗','window'],['货运月台','platform']], [label,kind]=styles[i];
 const width=kind==='container'?4.6:kind==='window'?4.9:5.8,depth=2.7,frontZ=inst.hd+depth;
 const t={h,label,kind,x:0,z:frontZ,w:width,d:depth,minY:kind==='window'?1.55:.45,maxY:kind==='window'?4.3:4.9,center:ind012World(h,[0,2.5,frontZ]),back:inst.hd+.15};
 h.deliveryLabel=label;h.gates=[{x:0,y:(t.minY+t.maxY)/2,w:width-.7,h:t.maxY-t.minY,planeZ:frontZ,center:ind012World(h,[0,(t.minY+t.maxY)/2,frontZ]),house:h,index:0,type:kind==='window'?'window':'door',broken:kind!=='window',industrial:true,holes012:[]}];t.gate=h.gates[0];industrial012.targets.push(t);
 const m=h.model,B=(w,hh,d,c,p)=>ind012Box(builder,w,hh,d,c,p,m);
 // Visible open receiving structure, never a closed GLB wall painted as a magic target.
 B(width+1,.18,depth+.7,'#718388',[0,.22,inst.hd+depth*.5]);
 B(width+.9,4.85,.22,'#25383f',[0,2.62,inst.hd+.10]);
 if(kind==='platform'){
  B(width,.48,depth,'#526974',[0,.52,inst.hd+depth*.5]);
  B(width+1,.26,depth+.9,'#344c58',[0,5.2,inst.hd+depth*.5]);
 }else{
  B(.42,5.15,depth,'#bac3bd',[-width/2-.20,2.70,inst.hd+depth*.5]);B(.42,5.15,depth,'#bac3bd',[width/2+.20,2.70,inst.hd+depth*.5]);
  B(width+.85,.36,depth+.4,'#485865',[0,5.23,inst.hd+depth*.5]);
  if(kind==='container')for(let x=-width/2;x<width/2;x+=.30)B(.07,.22,depth,'#6593a3',[x,5.45,inst.hd+depth*.5]);
  if(kind==='bay')for(let y=4.78;y<5.16;y+=.1)B(width,.05,.20,'#9ca5a2',[0,y,frontZ]);
 }
 if(kind==='window'){
  B(width,1.45,.25,'#7e929b',[0,.99,frontZ]);B(.14,2.86,.2,'#e1e5d4',[-width/2+.26,2.92,frontZ+.07]);B(.14,2.86,.2,'#e1e5d4',[width/2-.26,2.92,frontZ+.07]);
 }
 // Marker begins 0.35m behind the pavement edge. Front-to-kerb clearance is 3.25m.
 B(width+.55,.025,.16,'#ffcd57',[0,.342,frontZ+.08]);
 for(const side of [-1,1]){B(.12,.025,depth,'#ffd365',[side*(width/2-.1),.343,inst.hd+depth*.5]);
  B(.30,1.35,.30,'#ffd15b',[side*(width/2+.64),.82,frontZ-.22]);B(.31,.22,.31,'#263f48',[side*(width/2+.64),1.1,frontZ-.22]);
 }
 const entrance={x:ind012World(h,[0,0,inst.hd+depth*.5])[0],z:ind012World(h,[0,0,inst.hd+depth*.5])[2],yaw:h.yaw,hw:width*.5+1.15,hd:depth*.5+.35};ind012Reserve(entrance);
 // Side posts/roof have collision. The aperture remains open to parcels and pedestrians.
 for(const side of [-1,1]){const p=ind012World(h,[side*(width/2+.22),0,inst.hd+depth*.5]);industrial012.colliders.push({x:p[0],z:p[2],yaw:h.yaw,hw:.20,hd:depth/2,minY:.22,maxY:5.4,label:'bay-side',house:h.num});}
 for(const side of [-1,1]){const p=ind012World(h,[side*(width/2+.64),0,frontZ-.22]);industrial012.colliders.push({x:p[0],z:p[2],yaw:h.yaw,hw:.16,hd:.16,minY:.12,maxY:1.5,label:'bollard',house:h.num});}
 if(kind==='window'){const p=ind012World(h,[0,0,frontZ]);industrial012.colliders.push({x:p[0],z:p[2],yaw:h.yaw,hw:width/2,hd:.13,minY:.1,maxY:1.7,label:'dispatch-sill',house:h.num});}
 
 B(width+1,.92,.22,'#284751',[0,5.68,frontZ+.04]);cityText(builder,String(h.num),[0,5.68,frontZ+.18],.11,'#ffdd79',m);
 return t;
}
function ind012Bake(name,builder){if(!builder.a.length)return;const mesh=renderer.mesh(builder);industrial012.chunks.push({name,mesh});}
function ind012RepositionFurniture(){
 let moved=0;const forbidden=industrial012.reserved;
 const inside=(x,z)=>forbidden.some(r=>{const q=houseLocal(r,[x,0,z]);return Math.abs(q[0])<r.hw+.48&&Math.abs(q[2])<r.hd+.48;});
 for(const t of road09.furniture){if(t.y>1||!inside(t.x,t.z))continue;const f=road093FlowForward(t.travelYaw),right=road093FlowRight(t.travelYaw);let pos=null;
  for(const sideStep of [0,-1.4,-2,1.7,3.2]){for(const k of [6,-6,10,-10,14,-14,19,-19,24,-24]){const x=t.x+f[0]*k+right[0]*sideStep*(t.side||1),z=t.z+f[2]*k+right[2]*sideStep*(t.side||1);
   if(inside(x,z)||road09Levels(x,z).some(g=>g.y<1))continue;const near=closestCityRoad([x,0,z]);if(near.d<8.5||(t.city094&&near.d>17))continue;
   if(road09.furniture.some(o=>o!==t&&o.y<1&&Math.hypot(o.x-x,o.z-z)<1.1))continue;pos=[x,z];break;}if(pos)break;}
  if(!pos)continue;t.x=pos[0];t.z=pos[1];t.m=scaled(M.model([t.x,R09.y+t.y,t.z],[0,t.yaw,0]),t.scale);t.moved012=true;moved++;
  for(const l of lights)if(l.tile094===t)l.p=M.point(t.m,[-.051,.43659,0]);
 }
 // A single rebake updates visuals; release old GPU buffers, then rebuild the same surface grid.
 if(moved){for(const c of road09.chunks)renderer.gl.deleteBuffer(c.mesh.buffer);road09.surfaces.length=0;road09.grid.clear();road09Bake();}
 industrial012.furnitureMoved=moved;industrial012.furnitureConflicts=road09.furniture.filter(t=>t.y<1&&inside(t.x,t.z)).map(t=>({name:t.name,x:t.x,z:t.z}));
}
function ind012Setup(){
 const b=new MeshBuilder();
 // Existing duplicated decorative industrial addresses are replaced by a validated lot fill.
 for(const h of houses){if(h.style!=='works')industrial012.reserved.push({x:h.x,z:h.z,yaw:h.yaw,hw:7.9,hd:7.1});else h.industrial012=true;}
 const jobs=houses.filter(h=>h.deliverable&&h.style==='works').sort((a,b)=>a.num-b.num);
 const names=['building-r','building-a','building-f','building-q','building-t','building-l'],scales=[9,10,10.3,9.5,10.8,9.3];
 jobs.forEach((h,i)=>{const f=ind012Frontage(h,names[i%6],scales[i%6]);ind012Target(f,i,b);});
 // Repeated parcels are deliberately NOT created: filler factories have no delivery ID.
 const fillNames=['building-a','building-r','building-q','building-f','building-t'];let count=0;
 const candidates=[];for(const x of [78,96,137,155,172])for(const z of [-93,-73,-38,-19,20,40,75,96])candidates.push([x,z]);
 // Tall back-of-lot buildings behind the frontages, with minimum spacing and ground-road clearance.
 for(const [x,z] of candidates){if(count>=22)break;const name=fillNames[count%fillNames.length],scale=[6.6,6.3,6.8,6.4,7.2][count%5],bb=industrial012.assets.get(name).bounds;
  const road=closestCityRoad([x,0,z]),v=V.sub(road.q,[x,0,z]),yaw=Math.atan2(v[0],v[2]),o={x,z,yaw,hw:bb.size[0]*scale/2,hd:bb.size[2]*scale/2};
  if(!ind012LotClear(o,1.8))continue;
  const inst=ind012Instance(name,x,z,yaw,scale,'infill');ind012Collider(inst);ind012Reserve(inst);count++;
 }
 // Fill residual yards with industrial props, not trees; never place a tank on a crossing.
 const props=[['water-tower',9.0],['chimney-large',8.6],['detail-tank-large',4.8],['shipping-container-a',7.2],['shipping-container-b',7.2],['shipping-container-c',7.2],['solar-panel-landscape-group',4.5]];let pc=0;
 for(const x of [88,100,143,165,180])for(const z of [-99,-81,-42,-12,18,38,69,94]){
  if(pc>=20)break;const [name,scale]=props[pc%props.length],bb=industrial012.assets.get(name).bounds,yaw=pc%2?Math.PI/2:0,o={x,z,yaw,hw:bb.size[0]*scale/2,hd:bb.size[2]*scale/2};
  if(!ind012LotClear(o,1.2))continue;const inst=ind012Instance(name,x,z,yaw,scale,'prop');ind012Collider(inst);ind012Reserve(inst);pc++;
 }
 // Neutral hardstanding ties neighbours together; limited to buildable footprints.
 for(const o of industrial012.placements){const m=M.model([o.x,0,o.z],[0,o.yaw,0]);ind012Box(b,o.hw*2+1.1,.04,o.hd*2+1.1,'#93a5a2',[0,.095,0],m);}
 ind012Bake('receiving-bays-and-hardstand',b);
 industrial012.audit=jobs.map(h=>{const o=industrial012.placements.find(x=>x.h===h),t=industrial012.targets.find(t=>t.h===h),q=closestCityRoad(t.center),front=[Math.sin(h.yaw),0,Math.cos(h.yaw)],toRoad=V.norm([q.q[0]-t.center[0],0,q.q[2]-t.center[2]]);return{num:h.num,model:o.name,width:+(o.hw*2).toFixed(2),depth:+(o.hd*2).toFixed(2),height:+o.height.toFixed(2),frontDot:+V.dot(front,toRoad).toFixed(4),frontSetback:h.setback012,apertureFromKerb:+(q.d-8).toFixed(2),roadClear:ind012StreetClear(o),x:h.x,z:h.z,yaw:h.yaw,target:t.center};});
 routeCache=null;routeClock=-1;cityMapClock=-1;manifestSignature='';
}
function industrial012Draw(){if(!industrial012.ready||state.mode==='wardrobe')return;
 for(const o of industrial012.placements){if(V.len(V.sub([o.x,o.height*.5,o.z],eye))>195)continue;renderer.draw(industrial012.meshes.get(o.name),o.m);}
 for(const c of industrial012.chunks)renderer.draw(c.mesh);
}
function ind012SAT(c,p=car.p,yaw=car.yaw){
 if(p[1]+3.5<=c.minY||p[1]-.1>=c.maxY)return null;
 const ar=[Math.cos(yaw),0,-Math.sin(yaw)],af=[Math.sin(yaw),0,Math.cos(yaw)],br=[Math.cos(c.yaw),0,-Math.sin(c.yaw)],bf=[Math.sin(c.yaw),0,Math.cos(c.yaw)],delta=V.sub(p,[c.x,p[1],c.z]);let best=Infinity,n=null;
 for(const axis of [ar,af,br,bf]){const a=1.63*Math.abs(V.dot(ar,axis))+3.83*Math.abs(V.dot(af,axis)),b=c.hw*Math.abs(V.dot(br,axis))+c.hd*Math.abs(V.dot(bf,axis)),dist=V.dot(delta,axis),over=a+b-Math.abs(dist);if(over<=0)return null;if(over<best){best=over;n=V.mul(axis,dist<0?-1:1);}}
 return{depth:best,n};
}
function ind012Resolve(predictionOnly){for(let pass=0;pass<3;pass++){let hit=false;for(const c of industrial012.colliders){if(Math.abs(car.p[0]-c.x)>c.hw+c.hd+5||Math.abs(car.p[2]-c.z)>c.hw+c.hd+5)continue;const q=ind012SAT(c);if(!q)continue;const sp=Math.abs(car.speed);car.p=V.add(car.p,V.mul(q.n,q.depth+.012));car.kick=[0,0,0];car.speed=0;car.velocity=[0,0,0];if(!predictionOnly&&sp>1)impact(Math.min(10,sp*.5));hit=true;}if(!hit)break;}}
function ind012TargetHit(t,old,next,p){const a=ind012Local(t.h,old),b=ind012Local(t.h,next),r=p.r||.2;
 if(t.kind==='platform'){
  if(p.v[1]>1||b[1]>1.1||a[1]<.5)return null;
  const q=segmentBox(a,b,[-t.w/2+r,.5, t.back],[t.w/2-r,1.0,t.z]);return q?{t:q.t,g:t.gate}:null;
 }
 const dz=b[2]-a[2];if(dz>=-.00001||a[2]<t.z||b[2]>t.z)return null;const u=(t.z-a[2])/dz,q=V.lerp(a,b,u);
 if(Math.abs(q[0])>t.w/2-r*.9||q[1]<t.minY+r*.7||q[1]>t.maxY-r*.7)return null;
 return{t:u,g:t.gate,point:q};
}
function ind012Parcel(old,next,p){if(p.delivered||net.mode==='guest')return;
 const hits=[];for(const t of industrial012.targets){const hit=ind012TargetHit(t,old,next,p);if(hit)hits.push({...hit,target:t,type:'target'});}
 for(const c of industrial012.colliders){const a=ind012Local(c,old),b=ind012Local(c,next),r=p.r||.2,q=segmentBox(a,b,[-c.hw-r,c.minY-r,-c.hd-r],[c.hw+r,c.maxY+r,c.hd+r]);if(q)hits.push({...q,c,type:'solid'});}
 hits.sort((a,b)=>a.t-b.t);const hit=hits[0];if(!hit)return;
 if(hit.type==='target'){
  const t=hit.target;if(t.kind==='window')glass012Impact(t.h,t.gate,p,hit.point);
  deliver(t.h,t.gate,p);
  if(p.delivered){p.p=ind012World(t.h,[0,(t.kind==='platform'?.76:.31)+p.r+.02,t.back+.55]);p.rest012=p.p.slice();p.v=[0,0,0];showHint('🏭 #'+t.h.num+' '+t.label+' · 包裹已收到',2.8);}
  else {p.p=ind012World(t.h,[0,p.r+.3,t.z+1]);p.v=worldVelocity(t.h,[0,.5,2]);}
 }else{const c=hit.c,q=V.lerp(old,next,Math.max(0,hit.t-.002)),v=localVelocity(c,p.v);v[hit.axis]=-v[hit.axis]*.28;p.p=q;p.v=worldVelocity(c,v);p.pending=null;p.bounces=(p.bounces||0)+1;}
}
const ind012BaseCar=stepCar;stepCar=function(dt,predictionOnly=false){const n=industrial012.ready?Math.max(1,Math.min(12,Math.ceil((Math.abs(car.speed)+3)*dt/.45))):1;for(let i=0;i<n;i++){ind012BaseCar(dt/n,predictionOnly);if(industrial012.ready)ind012Resolve(predictionOnly);}};
const ind012BaseWalk=walkCollision;walkCollision=function(p){p=ind012BaseWalk(p);if(industrial012.ready)for(const c of industrial012.colliders){if(p[1]<c.minY||p[1]-1.7>c.maxY)continue;p=slideOut(p,c.x,c.z,c.yaw,c.hw+.33,c.hd+.33);}return p;};
const ind012BaseLine=clearLine;clearLine=function(a,b){if(!ind012BaseLine(a,b))return false;for(const c of industrial012.colliders)if(segmentBox(ind012Local(c,a),ind012Local(c,b),[-c.hw,c.minY,-c.hd],[c.hw,c.maxY,c.hd]))return false;return true;};
const ind012BaseParcel=stepWorldPackage;stepWorldPackage=function(p,dt){if(p.delivered&&p.rest012){p.p=p.rest012.slice();p.v=[0,0,0];return;}const old=p.p.slice();ind012BaseParcel(p,dt);if(industrial012.ready)ind012Parcel(old,p.p,p);};
const ind012BaseHud=updateHUD;updateHUD=function(){ind012BaseHud();const h=nextHouse();if(h?.industrial012&&h.deliveryLabel)$('routeGuide').textContent='#'+h.num+' · '+h.deliveryLabel+' · 向黄色边框内投递';};
async function industrial012Initialize(){const began=performance.now();try{
 const img=new Image(),pal=await new Promise((resolve,reject)=>{img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);resolve({data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height});};img.onerror=()=>reject(Error('Industrial palette failed'));img.src='./assets/kenney-industrial/variation-a.png';});
 const loader=new RoadGLB09(pal.data,pal.w,pal.h);
 for(const name of industrial012.models){const res=await fetch('./assets/kenney-industrial/'+name+'.glb');if(!res.ok)throw Error(name+' '+res.status);const bytes=new Uint8Array(await res.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=0x8000)raw+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const a=loader.load(name,btoa(raw));a.bounds=ind012Bounds(a);
  // Vertex tint approximates local contact darkening. It is not a screen-space AO effect.
  for(let j=0;j<a.b.a.length;j+=9){const h=a.b.a[j+1]-a.bounds.min[1],ao=.80+.20*clamp(h/.24,0,1);for(let k=6;k<9;k++)a.b.a[j+k]*=ao;}
  industrial012.assets.set(name,a);industrial012.meshes.set(name,renderer.mesh(a.b));}
 for(let n=0;!road09.ready&&n<200;n++)await new Promise(r=>setTimeout(r,20));if(!road09.ready)throw Error('Road surfaces not ready');
 ind012Setup();ind012RepositionFurniture();industrial012.ready=true;window.__industrial012Ready=true;industrial012.loadMs=performance.now()-began;lighting012BuildShadows();
 }catch(e){industrial012.error=e.message;window.__industrial012Ready=false;console.error('V0.10.2 industrial layout:',e);showHint('工业区加载失败：'+e.message,8);}}
industrial012Initialize();
