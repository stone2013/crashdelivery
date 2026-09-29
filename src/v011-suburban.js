/* V0.11 SUBURBAN UPDATE — Kenney City Kit: Suburban residential district. */
const SUB011={ready:false,error:'',assets:new Map(),meshes:new Map(),placements:[],colliders:[],main:[],loadMs:0,
 names:['building-type-a','building-type-b','building-type-c','building-type-d','building-type-e','building-type-f','building-type-g','building-type-h','building-type-i','building-type-j','building-type-k','building-type-l','building-type-m','building-type-n','building-type-o','building-type-p','building-type-q','building-type-r','building-type-s','building-type-t','building-type-u','driveway-long','driveway-short','fence-low','tree-large','tree-small','planter']};
function sub011Bounds(a){let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.b.a.length;i+=9)for(let k=0;k<3;k++){min[k]=Math.min(min[k],a.b.a[i+k]);max[k]=Math.max(max[k],a.b.a[i+k]);}return{min,max,size:max.map((v,k)=>v-min[k]),center:[(min[0]+max[0])/2,min[1],(min[2]+max[2])/2]};}
function sub011Instance(name,x,z,yaw,scale,role='home',h=null){
 const a=SUB011.assets.get(name),bb=a.bounds,base=M.model([x,.10,z],[0,yaw,0]),m=M.multiply(scaled(base,scale),M.model(V.mul(bb.center,-1))),o={name,x,z,yaw,scale,role,h,m,hw:bb.size[0]*scale*.5,hd:bb.size[2]*scale*.5,height:bb.size[1]*scale};
 SUB011.placements.push(o);SUB011.colliders.push({x,z,yaw,hw:o.hw,hd:o.hd,role,h});return o;
}
function sub011ClosestGroundRoad(p){return cityEdges.map(e=>segmentProjection(p,e)).filter(q=>!ind014ElevatedNear(q.q[0],q.q[2],9)).sort((a,b)=>a.d-b.d)[0]||null;}
function sub011PlaceHome(h,name,scale){
 const a=SUB011.assets.get(name),bb=a.bounds,q=sub011ClosestGroundRoad([h.x,0,h.z]);if(!q)return null;
 const d=edgeDirection(q.edge.a,q.edge.b),right=[-d[2],0,d[0]],delta=V.sub([h.x,0,h.z],q.q),side=V.dot(delta,right)>=0?1:-1,out=V.mul(right,side),front=V.mul(out,-1),yaw=Math.atan2(front[0],front[2]),hw=bb.size[0]*scale*.5,hd=bb.size[2]*scale*.5,setback=3.4,pos=V.add(q.q,V.mul(out,8+setback+hd));
 h.x=pos[0];h.z=pos[2];h.yaw=yaw;h.model=M.model([h.x,0,h.z],[0,yaw,0]);h.suburban011=true;h.suburbanModel=name;h.suburbanSetback=setback;h.suburbanFront=hd;
 const o=sub011Instance(name,h.x,h.z,yaw,scale,'delivery',h);SUB011.main.push(o);
 const frontZ=hd+.04,doorW=Math.min(2.0,Math.max(1.35,o.hw*.32)),windowW=Math.min(2.1,Math.max(1.25,o.hw*.30)),windowY=Math.min(3.1,Math.max(2.15,o.height*.43)),gx=Math.min(o.hw*.55,2.55);
 h.gates=[{x:-gx,y:windowY,w:windowW,h:1.75,type:'window'},{x:0,y:1.55,w:doorW,h:2.75,type:'door'},{x:gx,y:windowY,w:windowW,h:1.75,type:'window'}];
 h.gates.forEach((g,i)=>{g.broken=false;g.index=i;g.house=h;g.planeZ=frontZ;g.center=houseWorld(h,[g.x,g.y,frontZ]);g.holes012=[];});
 return o;
}
function sub011FindPlacement(x,z,name,scale){
 const a=SUB011.assets.get(name),bb=a.bounds,hw=bb.size[0]*scale*.5,hd=bb.size[2]*scale*.5;
 for(const [dx,dz] of [[0,0],[6,0],[-6,0],[0,6],[0,-6],[9,5],[-9,-5]]){
  const px=x+dx,pz=z+dz,q=sub011ClosestGroundRoad([px,0,pz]);if(!q)continue;const d=edgeDirection(q.edge.a,q.edge.b),right=[-d[2],0,d[0]],side=V.dot(V.sub([px,0,pz],q.q),right)>=0?1:-1,out=V.mul(right,side),front=V.mul(out,-1),yaw=Math.atan2(front[0],front[2]),pos=V.add(q.q,V.mul(out,8+4.2+hd)),cand={x:pos[0],z:pos[2],yaw,hw,hd};
  if(ind014ElevatedNear(cand.x,cand.z,8)||SUB011.placements.some(o=>ind012Overlap(cand,o,1.8)))continue;return cand;
 }return null;
}
function sub011RebuildGarden(){
 const jobs=houses.filter(h=>h.style==='garden'&&h.deliverable).sort((a,b)=>a.num-b.num),jobModels=['building-type-b','building-type-d','building-type-f','building-type-n','building-type-t','building-type-u'];
 jobs.forEach((h,i)=>sub011PlaceHome(h,jobModels[i%jobModels.length],[8.3,7.7,7.5,7.4,7.5,7.8][i%6]));
 const fillers=['building-type-a','building-type-c','building-type-e','building-type-g','building-type-h','building-type-i','building-type-j','building-type-k','building-type-l','building-type-m','building-type-o','building-type-p','building-type-q','building-type-r','building-type-s'];
 const pts=[[-100,92],[-78,94],[-54,94],[-30,94],[-6,94],[18,94],[-101,52],[-77,52],[-53,52],[-29,52],[-5,52],[19,52],[-101,10],[-77,10],[-53,10],[-29,10],[-5,10],[19,10],[-101,122],[-65,122],[-25,122],[15,122]];
 let n=0;for(const p of pts){const name=fillers[n%fillers.length],scale=[7.2,7.0,7.4,7.1,7.5][n%5],o=sub011FindPlacement(p[0],p[1],name,scale);if(!o)continue;sub011Instance(name,o.x,o.z,o.yaw,scale,'infill');n++;}
 routeCache=null;routeClock=-1;cityMapClock=-1;manifestSignature='';
}
function sub011Draw(){if(!SUB011.ready||state.mode==='wardrobe')return;for(const o of SUB011.placements){if(V.len(V.sub([o.x,o.height*.5,o.z],eye))>180)continue;renderer.draw(SUB011.meshes.get(o.name),o.m);}}
const sub011DrawBase=draw3D;draw3D=function(){sub011DrawBase();sub011Draw();};
function sub011SAT(c,p=car.p,yaw=car.yaw){const ar=[Math.cos(yaw),0,-Math.sin(yaw)],af=[Math.sin(yaw),0,Math.cos(yaw)],br=[Math.cos(c.yaw),0,-Math.sin(c.yaw)],bf=[Math.sin(c.yaw),0,Math.cos(c.yaw)],delta=V.sub(p,[c.x,p[1],c.z]);let best=Infinity,n=null;for(const axis of [ar,af,br,bf]){const a=1.63*Math.abs(V.dot(ar,axis))+3.83*Math.abs(V.dot(af,axis)),b=c.hw*Math.abs(V.dot(br,axis))+c.hd*Math.abs(V.dot(bf,axis)),dist=V.dot(delta,axis),over=a+b-Math.abs(dist);if(over<=0)return null;if(over<best){best=over;n=V.mul(axis,dist<0?-1:1);}}return{depth:best,n};}
const sub011CarBase=stepCar;stepCar=function(dt,predictionOnly=false){sub011CarBase(dt,predictionOnly);if(!SUB011.ready||predictionOnly)return;for(const c of SUB011.colliders){if(Math.abs(car.p[0]-c.x)>c.hw+c.hd+5||Math.abs(car.p[2]-c.z)>c.hw+c.hd+5)continue;const q=sub011SAT(c);if(!q)continue;const sp=Math.abs(car.speed);car.p=V.add(car.p,V.mul(q.n,q.depth+.015));car.speed=0;car.velocity=[0,0,0];car.kick=[0,0,0];if(sp>1)impact(Math.min(9,sp*.45));}};
async function sub011Init(){const began=performance.now();try{
 const img=new Image(),pal=await new Promise((resolve,reject)=>{img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);resolve({data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height});};img.onerror=()=>reject(Error('Suburban palette failed'));img.src='./assets/kenney-suburban/variation-a.png';});
 const loader=new RoadGLB09(pal.data,pal.w,pal.h);for(const name of SUB011.names){const res=await fetch('./assets/kenney-suburban/'+name+'.glb');if(!res.ok)throw Error(name+' '+res.status);const bytes=new Uint8Array(await res.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=0x8000)raw+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const a=loader.load(name,btoa(raw));a.bounds=sub011Bounds(a);SUB011.assets.set(name,a);SUB011.meshes.set(name,renderer.mesh(a.b));}
 sub011RebuildGarden();SUB011.ready=true;SUB011.loadMs=performance.now()-began;window.__suburban011Ready=true;
 }catch(e){SUB011.error=e.message;console.error('V0.11 suburban:',e);showHint('住宅区素材加载失败：'+e.message,8);}}
sub011Init();
if(window.__deliveryTest)window.__deliveryTest.suburban011=()=>({ready:SUB011.ready,error:SUB011.error,loadMs:SUB011.loadMs,delivery:SUB011.main.map(o=>({num:o.h.num,model:o.name,w:+(o.hw*2).toFixed(2),d:+(o.hd*2).toFixed(2),h:+o.height.toFixed(2),setback:o.h.suburbanSetback})),placements:SUB011.placements.length});
