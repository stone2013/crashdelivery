/* V0.10.1 INDUSTRIAL DELIVERY — Kenney City Kit Industrial 2.0
 * Industrial buildings are real GLB assets; package targets remain host-authoritative.
 */
const industrial010={
 ready:false,error:'',assets:new Map(),meshes:new Map(),placements:[],targets:[],colliders:[],loadMs:0,
 models:['building-a','building-f','building-l','building-q','building-r','building-t','water-tower','detail-tank-large','chimney-large','shipping-container-a','shipping-container-b','shipping-container-c','solar-panel-landscape-group']
};
function industrial010Local(h,p){return houseLocal(h,p);}
function industrial010World(h,p){return houseWorld(h,p);}
function industrial010Placement(name,x,z,yaw,scale,h=null){
 const p={name,x,z,yaw,scale,h,m:scaled(M.model([x,.02,z],[0,yaw,0]),scale)};industrial010.placements.push(p);return p;
}
function industrial010Target(h){
 const layouts={
  107:{label:'卷帘门',x:0,z:6.15,w:5.0,d:2.5,color:'#f2b84c'},
  108:{label:'装卸平台',x:2.2,z:6.25,w:3.8,d:2.8,color:'#e69b48'},
  109:{label:'集装箱收货口',x:-2.0,z:6.65,w:3.3,d:3.6,color:'#f0c05d'},
  110:{label:'仓库入口',x:0,z:6.2,w:4.8,d:2.6,color:'#edaa45'},
  111:{label:'货运月台',x:2.0,z:6.2,w:3.9,d:3.0,color:'#e99247'},
  112:{label:'工业收货区',x:0,z:6.3,w:5.2,d:3.2,color:'#f1b34c'}
 };
 const q=layouts[h.num]||{label:'装卸平台',x:0,z:6.2,w:4.5,d:2.8,color:'#efb24e'};
 const c=industrial010World(h,[q.x,.12,q.z]);
 const t={h,label:q.label,x:q.x,z:q.z,w:q.w,d:q.d,color:q.color,center:c};industrial010.targets.push(t);h.deliveryLabel=q.label;h.deliveryMode='industrial';return t;
}
function industrial010Setup(){
 const works=houses.filter(h=>h.style==='works');
 const names=['building-a','building-f','building-l','building-q','building-r','building-t'];
 const scales=[6.1,5.7,5.25,5.7,5.15,6.0];
 for(let i=0;i<works.length;i++){const h=works[i],k=Math.abs(h.num)%names.length;industrial010Placement(names[k],h.x,h.z,h.yaw,scales[k],h);if(h.deliverable)industrial010Target(h);}
 // Landmarks and loading-yard props. Kept away from roads and delivery approach lanes.
 industrial010Placement('water-tower',104,52,0,6.0);
 industrial010Placement('detail-tank-large',98,78,0,4.5);
 industrial010Placement('chimney-large',102,18,0,5.2);
 industrial010Placement('shipping-container-a',102,-73,Math.PI/2,3.0);
 industrial010Placement('shipping-container-b',106,-73,Math.PI/2,3.0);
 industrial010Placement('shipping-container-c',110,-73,Math.PI/2,3.0);
 industrial010Placement('solar-panel-landscape-group',92,68,0,4.0);
 industrial010.colliders.push(
  {x:104,z:52,r:3.2,label:'water-tower'},
  {x:98,z:78,r:3.8,label:'tank'},
  {x:102,z:18,r:3.0,label:'chimney'}
 );
}
function industrial010PadMesh(){
 const b=new MeshBuilder();b.box(1,.08,1,'#eeb44b',[0,.04,0]);b.box(.08,.10,1,'#fff0b5',[-.46,.09,0]);b.box(.08,.10,1,'#fff0b5',[.46,.09,0]);return renderer.mesh(b);
}
let industrial010Pad=null;
function industrial010Draw(){
 if(!industrial010.ready||state.mode==='wardrobe')return;
 for(const p of industrial010.placements){if(V.len(V.sub([p.x,1,p.z],eye))>175)continue;const mesh=industrial010.meshes.get(p.name);if(mesh)renderer.draw(mesh,p.m);}
 if(!industrial010Pad)return;
 for(const t of industrial010.targets){if(t.h.done)continue;if(V.len(V.sub(t.center,eye))>125)continue;const m=M.multiply(t.h.model,M.model([t.x,.02,t.z],[0,0,0]));renderer.draw(industrial010Pad,scaled(m,[t.w,1,t.d]));}
}
function industrial010TryDeliver(p){
 if(p.delivered||net.mode==='guest')return false;
 for(const t of industrial010.targets){if(t.h.done)continue;const q=industrial010Local(t.h,p.p);
  if(Math.abs(q[0]-t.x)<=t.w*.5&&Math.abs(q[2]-t.z)<=t.d*.5&&q[1]>=p.r*.4&&q[1]<=2.2){
   deliver(t.h,t.h.gates[0],p);showHint('🏭 '+t.label+' · 工业订单已接收',2.5);return true;
  }
 }
 return false;
}
function industrial010ResolveCar(predictionOnly=false){
 const radius=2.05;
 for(const c of industrial010.colliders){if(Math.abs(car.p[1])>2.5)continue;const dx=car.p[0]-c.x,dz=car.p[2]-c.z,d=Math.hypot(dx,dz),need=radius+c.r;if(d>=need)continue;
  const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0,depth=need-d;car.p[0]+=nx*(depth+.03);car.p[2]+=nz*(depth+.03);const sp=Math.abs(car.speed);car.speed*=-.08;if(!predictionOnly&&sp>1)impact(Math.min(9,sp*.55));
 }
}
async function industrial010Initialize(){
 const began=performance.now();
 try{
  const img=new Image();const pal=await new Promise((resolve,reject)=>{img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);resolve({data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height});};img.onerror=()=>reject(Error('Industrial palette failed'));img.src='./assets/kenney-industrial/variation-a.png';});
  const loader=new RoadGLB09(pal.data,pal.w,pal.h);
  for(const name of industrial010.models){const res=await fetch('./assets/kenney-industrial/'+name+'.glb');if(!res.ok)throw Error('Industrial asset '+name+' '+res.status);const u=new Uint8Array(await res.arrayBuffer());let raw='';for(let i=0;i<u.length;i+=0x8000)raw+=String.fromCharCode(...u.subarray(i,i+0x8000));const a=loader.load(name,btoa(raw));industrial010.assets.set(name,a);industrial010.meshes.set(name,renderer.mesh(a.b));}
  industrial010Pad=industrial010PadMesh();industrial010Setup();industrial010.ready=true;industrial010.loadMs=performance.now()-began;window.__industrial010Ready=true;
 }catch(e){industrial010.error=e.message;console.error('Industrial district:',e);window.__industrial010Ready=false;}
}
const industrial010DrawBase=draw3D;draw3D=function(){industrial010DrawBase();industrial010Draw();};
const industrial010PackageBase=stepWorldPackage;stepWorldPackage=function(p,dt){industrial010PackageBase(p,dt);if(industrial010.ready)industrial010TryDeliver(p);};
const industrial010CarBase=stepCar;stepCar=function(dt,predictionOnly=false){industrial010CarBase(dt,predictionOnly);if(industrial010.ready)industrial010ResolveCar(predictionOnly);};
const industrial010HudBase=updateHUD;updateHUD=function(){industrial010HudBase();const h=nextHouse();if(h?.deliveryMode==='industrial'&&h.deliveryLabel){$('routeGuide').textContent='工业区 · 将包裹投到 '+h.deliveryLabel;}}
industrial010Initialize();
if(window.__deliveryTest)window.__deliveryTest.industrial010=()=>({ready:industrial010.ready,error:industrial010.error,assets:industrial010.assets.size,placements:industrial010.placements.map(p=>({name:p.name,x:p.x,z:p.z,house:p.h?.num||0})),targets:industrial010.targets.map(t=>({num:t.h.num,label:t.label,done:t.h.done,center:t.center})),loadMs:industrial010.loadMs});
