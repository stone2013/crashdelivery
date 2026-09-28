/* V0.9 SKYWAY. Additive Kenney road district; no external asset fetch is needed.
 * Geometry comes from the provided 20 GLBs. The same transformed triangles provide
 * drive/walk/parcel support surfaces. Upper and lower graph nodes remain distinct.
 * The original V0.8 game, save keys and room mechanics remain in the surrounding scope.
 */
const road09={ready:false,error:'',assets:new Map(),tiles:[],chunks:[],surfaces:[],grid:new Map(),nodes:new Map(),edges:[],npc:[],colliders:[],furniture:[],visible:0,triangles:0,drawn:0,trial:null,clock:0,warpSerial:0,lastGuestWarp:null,stats:{stops:0,laps:0,contacts:0,staticHits:0},law:{fines:0,red:0,crashes:0,lastRedAt:-99,lastCrashAt:-99,lastRedKey:'',lastCrashId:-1},mapOpen:false,loadMs:0};
const R09={unit:16,y:-.08,ground:.08,center:[224,56],minX:120,maxX:324,minZ:-40,maxZ:106};
const road09Core={stepCar,stepCargo,stepPlayer,stepWorldPackage,step,resetGame,endRound,tickGuest,netSnapshot,applyHostSnapshot,updateHUD,updateCamera,walkCollision,mobility,onRoad,avatarMatrix,drawMap};
const road09Clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const road09Zone=p=>p[0]>138&&p[0]<334&&p[2]>-48&&p[2]<112;
const road09Duel=()=>net.duelMode==='duel2v2'&&networked();
const road09View=()=>state.view==='outside'?player.p:car.p;
function road09Decode64(text){const s=atob(text),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u.buffer;}
class RoadGLB09{
 constructor(pixels,w,h){this.pixels=pixels;this.w=w;this.h=h;}
 load(name,text){
  const bytes=road09Decode64(text),dv=new DataView(bytes);
  if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==bytes.byteLength)throw Error(name+': invalid GLB 2.0');
  let json=null,bin=null,offset=12;
  while(offset+8<=bytes.byteLength){const len=dv.getUint32(offset,true),type=dv.getUint32(offset+4,true);offset+=8;if(offset+len>bytes.byteLength)throw Error('GLB chunk bounds');if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,offset,len)));if(type===0x004e4942)bin=bytes.slice(offset,offset+len);offset+=len;}
  if(!json||!bin)throw Error(name+': missing JSON/BIN');
  const view=new DataView(bin),component={5120:['getInt8',1],5121:['getUint8',1],5122:['getInt16',2],5123:['getUint16',2],5125:['getUint32',4],5126:['getFloat32',4]},num={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  function accessor(id){const a=json.accessors[id],v=json.bufferViews[a.bufferView],spec=component[a.componentType],n=num[a.type];if(!spec||!n||a.sparse||v.buffer!==0)throw Error('Unsupported GLB accessor');const start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||n*spec[1];if(start+(a.count-1)*stride+n*spec[1]>bin.byteLength)throw Error('Accessor outside GLB');const out=[];for(let i=0;i<a.count;i++){const row=[];for(let k=0;k<n;k++){let x=view[spec[0]](start+i*stride+k*spec[1],true);if(a.normalized&&a.componentType!==5126)x=a.componentType===5121?x/255:a.componentType===5123?x/65535:x;if(!Number.isFinite(x))throw Error('Non-finite accessor');row.push(x);}out.push(row);}return out;}
  const b=new MeshBuilder(),verts=[],faces=[];
  const color=(uv,mat)=>{const pbr=mat.pbrMetallicRoughness||{},tr=pbr.baseColorTexture?.extensions?.KHR_texture_transform||{},sc=tr.scale||[1,1],of=tr.offset||[0,0],a=tr.rotation||0,u0=uv[0]*sc[0],v0=uv[1]*sc[1],u=u0*Math.cos(a)-v0*Math.sin(a)+of[0],v=u0*Math.sin(a)+v0*Math.cos(a)+of[1],x=Math.min(this.w-1,Math.max(0,Math.floor(u*this.w))),y=Math.min(this.h-1,Math.max(0,Math.floor(v*this.h))),i=(y*this.w+x)*4,f=pbr.baseColorFactor||[1,1,1,1];return [0,1,2].map(k=>this.pixels[i+k]/255*f[k]);};
  function matrix(node){if(node.matrix)return new Float32Array(node.matrix);if(node.rotation||node.translation||node.scale)throw Error('Selected Kenney pack expected identity node transforms');return M.identity();}
  const visit=(id,parent)=>{const node=json.nodes[id],m=M.multiply(parent,matrix(node));if(node.mesh!==undefined){for(const p of json.meshes[node.mesh].primitives){if(p.mode!==undefined&&p.mode!==4)throw Error('Only TRIANGLES supported');const vs=accessor(p.attributes.POSITION),ns=accessor(p.attributes.NORMAL),uv=accessor(p.attributes.TEXCOORD_0),is=p.indices!==undefined?accessor(p.indices).map(x=>x[0]):vs.map((_,i)=>i),mat=json.materials[p.material]||{};for(let j=0;j<is.length;j+=3){const tri=[];for(let k=0;k<3;k++){const v=is[j+k],pos=M.point(m,vs[v]),normal=M.normal(m,ns[v]);b.a.push(...pos,...normal,...color(uv[v],mat));tri.push(pos);verts.push(pos);}faces.push(tri);}}}for(const child of node.children||[])visit(child,m);};
  for(const id of json.scenes[json.scene||0].nodes)visit(id,M.identity());
  return {name,b,faces,triangles:b.a.length/27};
 }
}
function road09Tile(name,x,z,y=0,yaw=0,scale=16,drive=true){const asset=road09.assets.get(name);if(!asset)throw Error('Missing road asset '+name);const m=scaled(M.model([x,R09.y+y,z],[0,yaw,0]),scale);const tile={id:road09.tiles.length,name,x,z,y,yaw,scale,m,drive:drive&&!name.includes('barrier')};road09.tiles.push(tile);return tile;}
function road092Roadside(name,cx,cz,y,travelYaw,side=1,scale=9,offset=9.2){
 const right=[Math.cos(travelYaw),0,-Math.sin(travelYaw)],x=cx+right[0]*offset*side,z=cz+right[2]*offset*side;
 const tile=road09Tile(name,x,z,y,travelYaw,scale,false);tile.roadFurniture=true;tile.travelYaw=travelYaw;tile.side=side;road09.furniture.push(tile);return tile;
}
function road092FurnitureAt(name,x,z,y,travelYaw,scale=9){const tile=road09Tile(name,x,z,y,travelYaw,scale,false);tile.roadFurniture=true;tile.travelYaw=travelYaw;tile.side=0;road09.furniture.push(tile);return tile;}
function road092Circle(x,z,r,minY=R09.ground,maxY=8.2,label='pillar'){road09.colliders.push({kind:'circle',x,z,r,minY,maxY,label});}
function road092Wall(a,b,minY,maxY,r=.18,label='ramp-side'){road09.colliders.push({kind:'segment',a,b,minY,maxY,r,label});}
function road092AddRampWalls(path,half=6.15){if(!path?.points?.length)return;for(let i=0;i<path.points.length-1;i++){const a=path.points[i],b=path.points[i+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);if(len<.05)continue;const rx=-dz/len,rz=dx/len;for(const side of [-1,1]){const p=[a[0]+rx*half*side,a[2]+rz*half*side],q=[b[0]+rx*half*side,b[2]+rz*half*side];road092Wall(p,q,R09.ground,Math.max(a[1],b[1])+1.1,.12,'ramp-side');}}}
function road092BuildColliders(){road09.colliders.length=0;for(const x of [190,206,242])for(const z of [2,14])road092Circle(x,z,1.15,R09.ground,7.95,'bridge-pillar');const rw=road09Route('rampW','topW')[0]?.path,re=road09Route('topE','rampE')[0]?.path;road092AddRampWalls(rw);road092AddRampWalls(re);}
function road092YOverlap(c){const bottom=car.p[1]-.05,top=bottom+3.75;return top>c.minY&&bottom<c.maxY;}
function road092ResolveStatic(predictionOnly=false){const radius=2.05;for(const c of road09.colliders){if(!road092YOverlap(c))continue;let nx=0,nz=0,depth=0;if(c.kind==='circle'){const dx=car.p[0]-c.x,dz=car.p[2]-c.z,d=Math.hypot(dx,dz),need=radius+c.r;if(d<need){const inv=d>.001?1/d:0;nx=d>.001?dx*inv:1;nz=d>.001?dz*inv:0;depth=need-d;}}else{const ax=c.a[0],az=c.a[1],bx=c.b[0],bz=c.b[1],vx=bx-ax,vz=bz-az,l2=vx*vx+vz*vz,t=l2?road09Clamp(((car.p[0]-ax)*vx+(car.p[2]-az)*vz)/l2,0,1):0,qx=ax+vx*t,qz=az+vz*t,dx=car.p[0]-qx,dz=car.p[2]-qz,d=Math.hypot(dx,dz),need=radius+c.r;if(d<need){const inv=d>.001?1/d:0;nx=d>.001?dx*inv:(-vz/Math.max(.001,Math.sqrt(l2)));nz=d>.001?dz*inv:(vx/Math.max(.001,Math.sqrt(l2)));depth=need-d;}}if(depth>0){car.p[0]+=nx*(depth+.015);car.p[2]+=nz*(depth+.015);car.kick[0]=car.kick[2]=0;const hitSpeed=Math.abs(car.speed);car.speed*=.18;if(!predictionOnly&&hitSpeed>.8){road09.stats.staticHits++;impact(Math.min(8,hitSpeed*.55));}}}}
function road092FurnitureDiagnostics(){return road09.furniture.map(t=>{const g=road09Support(t.x,t.z,t.y+.2);return{name:t.name,x:t.x,z:t.z,yaw:t.yaw,travelYaw:t.travelYaw,onRoad:g.road&&Math.abs(g.y-(R09.y+t.y))<1.0,level:g.y};});}

function road09Surface(tri,tile){const [a,b,c]=tri,ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],den=ux*vz-uz*vx;if(Math.abs(den)<1e-7)return;let n=V.norm(V.cross(V.sub(b,a),V.sub(c,a)));if(n[1]<.60)return;const t={a,b,c,den,minX:Math.min(a[0],b[0],c[0]),maxX:Math.max(a[0],b[0],c[0]),minZ:Math.min(a[2],b[2],c[2]),maxZ:Math.max(a[2],b[2],c[2]),n,tile:tile.id};road09.surfaces.push(t);for(let x=Math.floor(t.minX/16);x<=Math.floor(t.maxX/16);x++)for(let z=Math.floor(t.minZ/16);z<=Math.floor(t.maxZ/16);z++){const key=x+','+z;if(!road09.grid.has(key))road09.grid.set(key,[]);road09.grid.get(key).push(t);}}
function road09Levels(x,z){const out=[];for(const t of road09.grid.get(Math.floor(x/16)+','+Math.floor(z/16))||[]){if(x<t.minX-.0001||x>t.maxX+.0001||z<t.minZ-.0001||z>t.maxZ+.0001)continue;const dx=x-t.a[0],dz=z-t.a[2],u=(dx*(t.c[2]-t.a[2])-dz*(t.c[0]-t.a[0]))/t.den,v=((t.b[0]-t.a[0])*dz-(t.b[2]-t.a[2])*dx)/t.den;if(u>=-.0001&&v>=-.0001&&u+v<=1.0001){const y=t.a[1]+u*(t.b[1]-t.a[1])+v*(t.c[1]-t.a[1]);if(!out.some(q=>Math.abs(q.y-y)<.001))out.push({y,n:t.n,tile:t.tile,road:true});}}return out.sort((a,b)=>a.y-b.y);}
function road09Support(x,z,reference=R09.ground,stepUp=.65){let best={y:R09.ground,n:[0,1,0],road:false,tile:-1};for(const p of road09Levels(x,z))if(p.y<=reference+stepUp&&p.y>=best.y-.001)best=p;return best;}
function road09Bake(){const chunks=new Map();function add(a){const cx=(a[0]+a[9]+a[18])/3,cz=(a[2]+a[11]+a[20])/3,key=Math.floor(cx/40)+','+Math.floor(cz/40);let b=chunks.get(key);if(!b){b=new MeshBuilder();chunks.set(key,b);}b.a.push(...a);}
 for(const tile of road09.tiles){const asset=road09.assets.get(tile.name),raw=asset.b.a;for(let i=0;i<raw.length;i+=27){const row=[],tri=[];for(let k=0;k<3;k++){const o=i+k*9,p=M.point(tile.m,raw.slice(o,o+3)),n=M.normal(tile.m,raw.slice(o+3,o+6));row.push(...p,...n,...raw.slice(o+6,o+9));tri.push(p);}add(row);if(tile.drive)road09Surface(tri,tile);}}
 const deco=new MeshBuilder();
 // Bridge supports stop below the deck; safety rails are real Kenney rail meshes.
 deco.box(64,.22,12.6,'#4e6170',[216,7.78,8]);
 // Central island and a small depot apron, both leave the roundabout approaches clear.
 deco.cylinder(5.0,.18,32,'#b9cab4',[224,.17,56]);deco.cylinder(4.55,.06,32,'#7aa77b',[224,.29,56]);deco.cylinder(2.1,.65,24,'#547d7c',[224,.61,56]);
 deco.box(14,.06,13,'#aebdab',[282,.03,-36]);
 const sm=M.model([159,0,44.5],[0,Math.PI/2,0]);for(const s of [-1,1])deco.box(.14,4.5,.14,'#536775',[s*3.8,2.25,0],[0,0,0],sm);deco.box(9,1.5,.19,'#163e4e',[0,4.1,0],[0,0,0],sm);cityText(deco,'SKYWAY',[0,4.1,.13],.16,'#ffe6aa',sm);
 for(const x of [187,215,243,271]){deco.box(1.4,.05,1.4,'#ffe090',[x,.13,-35]);}
 for(let i=0;i<deco.a.length;i+=27)add(deco.a.slice(i,i+27));
 road09.chunks=[...chunks].map(([key,b])=>{const [x,z]=key.split(',').map(Number);return{mesh:renderer.mesh(b),center:[x*40+20,4,z*40+20],radius:32};});road09.triangles=road09.chunks.reduce((n,c)=>n+c.mesh.count/3,0);
}
function road09Layout(){
 const add=road09Tile,ns=Math.PI/2;
 // City entrance: joins the existing eastern intersection at x=112,z=56.
 for(const x of [128,160,176,192])add('road-straight',x,56);
 add('road-intersection',144,56,0,Math.PI); // north / east / west
 for(const z of [24,40])add('road-straight',144,z,0,ns);
 add('road-bend',144,8,0,ns); // south -> east
 // 32 m smooth ramp + 64 m upper deck; the bridge contains BOTH decks.
 add('road-slant-curve',168,8);add('road-slant-curve-barrier',168,8,0,0,16,false);
 for(const x of [192,208,240]){add('road-straight',x,8,8);add('road-straight-barrier',x,8,8,ns,16,false);}
 add('road-bridge',224,8,0,ns);add('road-straight-barrier',224,8,8,ns,16,false);
 add('road-slant-curve',264,8,0,Math.PI);add('road-slant-curve-barrier',264,8,0,Math.PI,16,false);
 for(const x of [190,206,242])for(const z of [2.0,14.0])add('bridge-pillar',x,z,0,0,15.6,false);
 // Gentle return curve and the four-way ground intersection.
 add('road-curve',296,16);add('road-straight',304,40,0,ns);add('road-intersection',304,56,0,-Math.PI/2);
 for(const x of [256,288])add('road-straight',x,56);
 add('road-crossroad',272,56);add('road-crossing',272,40,0,ns);add('road-end-round',272,24,0,-ns);
 add('road-straight',272,72,0,ns);add('road-intersection',272,88,0,Math.PI);
 add('road-straight',304,72,0,ns);add('road-bend',304,88,0,-ns);
 for(const x of [240,256,288])add('road-straight',x,88);
 add('road-intersection',224,88,0,Math.PI);add('road-end-round',208,88);
 // Roundabout: four exits, radius 24 m tile. No elevated/ground crosslink.
 add('road-roundabout',224,56);
 add('road-straight',224,24,0,ns);add('road-straight',224,-8,0,ns);add('road-intersection',224,-24);
 for(const x of [192,208,240,256,272])add('road-straight',x,-24);
 add('road-end-round',176,-24);add('road-end-round',288,-24,0,Math.PI);
 // Road furniture follows the lane direction and keeps its support on the shoulder.
 for(const x of [144,176,208,240])road092FurnitureAt('light-curved',x,70,0,-Math.PI/2,8.4);
 for(const x of [144,176,208,240,272,304])road092FurnitureAt('light-curved',x,-34,0,Math.PI/2,8.4);
 for(const x of [192,224,240])road092Roadside('light-curved',x,8,8,-Math.PI/2,-1,8.0,10.8);
 // Signals use corner pads: the pole is outside both crossing lanes while the head faces approaching traffic.
 for(const p of [[258,42,0],[286,70,Math.PI],[258,70,-Math.PI/2],[286,42,Math.PI/2]])road092FurnitureAt('traffic-light',p[0],p[1],0,p[2],8.4);
 road092Roadside('sign-highway',194,8,8,-Math.PI/2,-1,8.7,11.8);road092Roadside('sign-highway',250,56,0,-Math.PI/2,1,8.7,11.8);
 road092Roadside('road-sign-stop',254,56,0,Math.PI/2,1,8.2,10.4);road092Roadside('road-sign-stop',224,32,0,0,1,8.2,10.4);
 road092Roadside('road-sign-warning',144,24,0,0,1,8.2,10.8);road092Roadside('road-sign-warning',304,24,0,Math.PI,1,8.2,12.5);
 for(let i=0;i<6;i++)add('construction-cone',282+i*2,-35,0,0,8,false);
 for(const x of [183,199,215])add('construction-barrier',x,-36,0,ns,10,false);
 road09Bake();road09MakeGraph();road092BuildColliders();road09ResetTraffic();
}
// A small explicit lane graph accompanies the modules. Elevation is part of node identity.
function road09MakeGraph(){
 const N=(id,x,z,y=.08)=>road09.nodes.set(id,{id,p:[x,y,z],links:[]});
 N('city',120,56);N('fork',144,56);N('bendW',144,16);N('rampW',152,8);N('topW',184,8,8.08);N('upper',224,8,8.08);N('topE',248,8,8.08);N('rampE',280,8);N('bendE',304,32);N('east',304,56);N('cross',272,56);N('roundE',248,56);N('roundW',200,56);N('roundN',224,32);N('roundS',224,80);N('lower',224,8);N('north',224,-24);N('finish',284,-24);N('south',224,88);N('crossS',272,88);N('southE',304,80);
 for(const [id,x,z] of [['rE',238,56],['rS',224,70],['rW',210,56],['rN',224,42]])N(id,x,z);
 const arc=(cx,cz,r,a,b,y=.08,n=18)=>Array.from({length:n+1},(_,i)=>{const t=a+(b-a)*i/n;return[cx+Math.cos(t)*r,y,cz+Math.sin(t)*r];});
 const edge=(a,b,points=null,oneWay=false)=>{const A=road09.nodes.get(a),B=road09.nodes.get(b),p=points||[A.p,B.p];const path=polyPath(p,'roads09'),e={a,b,path,id:road09.edges.length};road09.edges.push(e);A.links.push(e);if(!oneWay){const rev={a:b,b:a,path:polyPath(p.slice().reverse(),'roads09'),id:road09.edges.length};road09.edges.push(rev);B.links.push(rev);}};
 edge('city','fork');edge('fork','bendW');edge('bendW','rampW',arc(152,16,8,Math.PI,Math.PI*1.5));
 const ramp=(from,to)=>{const A=road09.nodes.get(from).p,B=road09.nodes.get(to).p,pts=[];for(let i=0;i<=48;i++){const p=V.lerp(A,B,i/48);const y=road09Support(p[0],p[2],10).y;pts.push([p[0],y,p[2]]);}return pts;};
 edge('rampW','topW',ramp('rampW','topW'));edge('topW','upper');edge('upper','topE');edge('topE','rampE',ramp('topE','rampE'));edge('rampE','bendE',arc(280,32,24,-Math.PI/2,0));edge('bendE','east');edge('east','cross');edge('cross','roundE');edge('roundW','fork');edge('roundN','lower');edge('lower','north');edge('north','finish');edge('roundS','south');edge('south','crossS');edge('crossS','southE',[[272,.08,88],[296,.08,88],...arc(296,80,8,Math.PI/2,0)]);edge('southE','east');edge('cross','crossS');
 edge('roundE','rE');edge('roundS','rS');edge('roundW','rW');edge('roundN','rN');
 edge('rE','rS',arc(224,56,14,0,Math.PI/2),true);edge('rS','rW',arc(224,56,14,Math.PI/2,Math.PI),true);edge('rW','rN',arc(224,56,14,Math.PI,1.5*Math.PI),true);edge('rN','rE',arc(224,56,14,1.5*Math.PI,2*Math.PI),true);
}
function road09Route(start,goal){const dist=new Map([...road09.nodes.keys()].map(k=>[k,Infinity])),prev=new Map(),todo=new Set(road09.nodes.keys());dist.set(start,0);while(todo.size){let u=null,d=Infinity;for(const k of todo)if(dist.get(k)<d){u=k;d=dist.get(k);}if(u===null||u===goal)break;todo.delete(u);for(const e of road09.nodes.get(u).links){const nd=d+e.path.len;if(nd<dist.get(e.b)){dist.set(e.b,nd);prev.set(e.b,e);}}}if(!Number.isFinite(dist.get(goal)))return[];const out=[];for(let k=goal;k!==start;){const e=prev.get(k);if(!e)return[];out.unshift(e);k=e.a;}return out;}
function road09JoinRoute(stops){const edges=[];for(let i=0;i<stops.length-1;i++)edges.push(...road09Route(stops[i],stops[i+1]));const p=[];for(const e of edges)for(const v of e.path.points){if(!p.length||V.len(V.sub(v,p[p.length-1]))>.0001)p.push(v);}const path=polyPath(p,'road09Circuit');path.stops=stops;return path;}
function road09NPCPoint(n,progress){const q=pathAt(n.path,progress),r=[-q.dir[2],0,q.dir[0]],p=V.add(q.p,V.mul(r,2.65));p[1]=road09Support(p[0],p[2],q.p[1]+.1).y+.02;return{p,yaw:q.yaw,dir:q.dir};}
function road09ResetTraffic(){if(!road09.nodes.size)return;const routes=[['fork','topW','upper','topE','rampE','east','cross','rE','rS','rW','roundW','fork'],['north','lower','rN','rE','cross','crossS','south','rS','rW','rN','lower','north']];const paths=routes.map(road09JoinRoute);road09.npc=[];for(let i=0;i<5;i++){const path=paths[i<3?0:1],t={id:i,path,progress:(i<3?i/3:(i-3)/2)*path.len,speed:5.5,maxSpeed:i<3?8:6.5,wait:'',cooldown:0,stopped:0,hp:100,phase:'normal',p:[0,.1,0],yaw:0,target:null,mesh:traffic[i%traffic.length]?.mesh};Object.assign(t,road09NPCPoint(t,t.progress));road09.npc.push(t);}}
function road09Signal(axis){const t=state.time%18;if(axis==='x')return t<7?'green':t<8?'amber':'red';return t>=9&&t<16?'green':t>=16&&t<17?'amber':'red';}
function road09StepTraffic(dt){for(const n of road09.npc){n.cooldown=Math.max(0,n.cooldown-dt);if(n.phase!=='normal'){n.stopped+=dt;n.speed=0;if(n.stopped>9){n.phase='normal';n.hp=100;n.stopped=0;}continue;}
 const q=road09NPCPoint(n,n.progress),dir=q.dir;let limit=n.maxSpeed,reason='';
 // Same-height following and yielding. A car on the overpass never blocks the underpass.
 for(const o of [car,...road09.npc]){if(o===n||Math.abs(o.p[1]-n.p[1])>2.6)continue;const d=V.sub(o.p,n.p),ahead=V.dot(d,dir),side=Math.abs(d[0]*dir[2]-d[2]*dir[0]);if(ahead>0&&ahead<16&&side<2.5){const desired=Math.max(0,(ahead-(o===car?7.4:5.6))*1.0);if(desired<limit){limit=desired;reason='跟车';}}}
 const dx=272-n.p[0],dz=56-n.p[2],axis=Math.abs(dir[0])>.7?'x':'z',along=dx*dir[0]+dz*dir[2],side=Math.abs(dx*dir[2]-dz*dir[0]);if(n.p[1]<1&&side<5.7&&along>8&&along<24&&road09Signal(axis)!=='green'){const l=Math.max(0,(along-11.1)*.75);if(l<limit){limit=l;reason='红灯';}}
 if(reason==='红灯'&&n.wait!=='红灯')road09.stats.stops++;n.wait=reason;n.speed=limit<n.speed?Math.max(limit,n.speed-8*dt):Math.min(limit,n.speed+2.5*dt);
 n.progress+=n.speed*dt;if(n.progress>=n.path.len){n.progress%=n.path.len;road09.stats.laps++;}Object.assign(n,road09NPCPoint(n,n.progress));
 }}
const ROAD091_FINE_RED=80;
function road091ResetLaw(){Object.assign(road09.law,{fines:0,red:0,crashes:0,lastRedAt:-99,lastCrashAt:-99,lastRedKey:'',lastCrashId:-1});}
function road091UpdateLawUI(){const lawChip=document.getElementById('trafficFine09');if(lawChip){lawChip.classList.toggle('hidden',road09.law.fines<=0);lawChip.textContent='交通罚款 $'+road09.law.fines;}if(state.mode==='paused'&&road09.law.fines>0){const ps=document.getElementById('pauseSummary');if(ps&&!ps.textContent.includes('交通罚款'))ps.textContent+=' · 交通罚款 $'+road09.law.fines;}}
function road091ApplyFine(kind,amount,detail=''){
 if(net.mode==='guest'||state.mode!=='playing'||road09Duel())return false;
 amount=Math.max(0,Math.round(amount));if(!amount)return false;
 state.score-=amount;road09.law.fines+=amount;
 if(kind==='red')road09.law.red++;else if(kind==='crash')road09.law.crashes++;
 const title=kind==='red'?'🚦 闯红灯 -$'+amount:'💥 交通事故 -$'+amount;
 showToast(title,detail||'交通罚款已计入本局结算',2.6);tone(kind==='red'?230:105,.12,'square',.15);road091UpdateLawUI();updateHUD();return true;
}
function road091FineCrash(closing,id=-1,label='城市车辆'){
 if(state.time-road09.law.lastCrashAt<1.15&&id===road09.law.lastCrashId)return false;
 const amount=closing>=9?150:closing>=5?60:20;
 road09.law.lastCrashAt=state.time;road09.law.lastCrashId=id;
 return road091ApplyFine('crash',amount,label+' · 撞击 '+Math.round(closing*3.6)+' km/h');
}
function road091CrossedStop(prev,now,center,dir,stop,lateral){
 const f=V.norm(dir),r=[-f[2],0,f[0]],a=V.sub(prev,center),b=V.sub(now,center),ap=V.dot(a,f),bp=V.dot(b,f),side=Math.min(Math.abs(V.dot(a,r)),Math.abs(V.dot(b,r)));
 return ap<-stop&&bp>=-stop&&side<lateral;
}
function road091CheckRedLight(prev,now){
 if(net.mode==='guest'||road09Duel()||state.view!=='drive'||Math.abs(car.speed)<.8||state.time-road09.law.lastRedAt<1.5)return;
 const delta=V.sub(now,prev);if(V.len(delta)<.002)return;const dir=V.norm(delta);
 // V0.9 test-zone signal at the module crossroad.
 if(car.p[1]<1.2&&Math.hypot(now[0]-272,now[2]-56)<24){const axis=Math.abs(dir[0])>.7?'x':'z',key='skyway-'+axis;if(road091CrossedStop(prev,now,[272,0,56],dir,11.1,5.7)&&road09Signal(axis)==='red'){road09.law.lastRedAt=state.time;road09.law.lastRedKey=key;road091ApplyFine('red',ROAD091_FINE_RED,'立体试验区路口');return;}}
 // Original-city lights: the player may choose to run them, but pays once per crossing.
 if(car.p[1]<1.2)for(const n of cityNodes){if(n.adj.length<3||Math.hypot(now[0]-n.x,now[2]-n.z)>24)continue;const axis=Math.abs(dir[2])>.7?2:0,key='city-'+n.id+'-'+axis;if(road091CrossedStop(prev,now,[n.x,0,n.z],dir,CITY.entry,5.8)&&signalPhase(n,axis)==='red'){road09.law.lastRedAt=state.time;road09.law.lastRedKey=key;road091ApplyFine('red',ROAD091_FINE_RED,DISTRICTS[districtAt(n.x,n.z)].short+'路口');return;}}
}
function road091ExitToMenu(){
 const online=networked(),host=net.mode==='host';
 const msg=online?(host?'退出将关闭当前房间并让其他玩家断开。返回主菜单？':'退出当前联机房间并返回主菜单？'):'退出当前派送并返回主菜单？';
 if(!confirm(msg))return;road09CloseMap();clearInputs();if(online)stopNetwork(true);else resetGame(true);
}
function road09HitNPC(dt,predictionOnly){for(const n of road09.npc){if(Math.abs(n.p[1]-car.p[1])>2.7||Math.hypot(n.p[0]-car.p[0],n.p[2]-car.p[2])>7.8)continue;const hit=overlapVehicles(n);if(!hit)continue;car.p=V.add(car.p,V.mul(hit.normal,hit.depth+.02));const closing=Math.max(0,-V.dot(V.sub(car.velocity,V.mul(n.dir||[0,0,-1],n.speed)),hit.normal));if(!predictionOnly&&closing>2&&n.cooldown<=0){n.cooldown=.65;impact(closing);n.hp-=closing*4;n.phase='damaged';n.stopped=0;road09.stats.contacts++;road091FineCrash(closing,1000+n.id,'试验区车辆');car.speed*=-.13;}}}
function road09ClampVehicle(prev,predictionOnly){
 // Guard rails along the elevated axis: a physical boundary, not a visual-only barrier.
 if(prev[1]>.35&&car.p[0]>153&&car.p[0]<279){const z=clamp(car.p[2],3.2,12.8);if(Math.abs(z-car.p[2])>.0001){car.p[2]=z;car.kick[2]=0;car.speed*=.72;if(!predictionOnly)impact(Math.abs(car.speed)*.32);}}
 road092ResolveStatic(predictionOnly);
 const dx=car.p[0]-224,dz=car.p[2]-56,d=Math.hypot(dx,dz);if(car.p[1]<2&&d<7.05){const dir=d>.01?[dx/d,0,dz/d]:[1,0,0];car.p[0]=224+dir[0]*7.06;car.p[2]=56+dir[2]*7.06;if(!predictionOnly)impact(Math.abs(car.speed)*.6);car.speed*=-.10;}
}
stepCar=function(dt,predictionOnly=false){const prev=car.p.slice(),previousPitch=car.roadPitch||0,preVelocity=car.velocity.slice(),preCooldown=predictionOnly?null:traffic.map(t=>t.hitCooldown||0);road09Core.stepCar(dt,predictionOnly);if(!predictionOnly){for(let i=0;i<traffic.length;i++){const t=traffic[i];if(preCooldown[i]<=0&&t.hitCooldown>preCooldown[i]&&Math.hypot(car.p[0]-t.p[0],car.p[2]-t.p[2])<10){const nv=t.phase==='normal'?V.mul([-Math.sin(t.yaw),0,-Math.cos(t.yaw)],t.speed||0):t.drift||[0,0,0],closing=Math.max(2,V.len(V.sub(preVelocity,nv)));road091FineCrash(closing,t.id,'城市车辆');break;}}road091CheckRedLight(prev,car.p);}if(!road09.ready||road09Duel()||(!road09Zone(car.p)&&!road09Zone(prev))){car.roadPitch=0;return;}
 car.p[1]=prev[1];road09ClampVehicle(prev,predictionOnly);const g=road09Support(car.p[0],car.p[2],prev[1]-.04);
 const target=g.y+.04;if(target<prev[1]-.8){car.roadVy=(car.roadVy||0)-12*dt;car.p[1]=Math.max(target,prev[1]+car.roadVy*dt);}else{car.p[1]=target;car.roadVy=0;}
 road09HitNPC(dt,predictionOnly);const f=carForward(),slope=-(g.n[0]*f[0]+g.n[2]*f[2])/Math.max(.1,g.n[1]);car.roadPitch=mix(previousPitch,Math.atan(slope),1-Math.exp(-dt*15));car.roadLayer=car.p[1]>4?'upper':'ground';car.velocity[1]=(car.p[1]-prev[1])/Math.max(.001,dt);car.accel[1]=clamp(car.velocity[1]/Math.max(.001,dt),-20,20);
 if(g.road&&Math.abs(car.speed)>.5)car.speed-=Math.sin(car.roadPitch)*3.8*dt;
};
onRoad=function(p){if(road09.ready&&road09Zone(p)&&!road09Duel())return road09Support(p[0],p[2],p[1]-.04).road;return road09Core.onRoad(p);};
stepCargo=function(dt){if(road09.ready&&road09Zone(car.p)&&car.roadPitch&&!road09Duel())for(const c of cargo)c.v[2]+=12*Math.sin(car.roadPitch)*dt;road09Core.stepCargo(dt);};
walkCollision=function(pos){const old=player.p?.slice()||pos,desired=road09Core.walkCollision(pos);if(!road09.ready||!road09Zone(desired)||road09Duel())return desired;const g=road09Support(desired[0],desired[2],old[1]-WALK_EYE,.5);desired[1]=g.y+WALK_EYE;const dx=desired[0]-224,dz=desired[2]-56,d=Math.hypot(dx,dz);if(d<5.4&&g.y<1){desired[0]=224+dx/Math.max(.01,d)*5.41;desired[2]=56+dz/Math.max(.01,d)*5.41;}if(old[1]-WALK_EYE>1&&desired[0]>153&&desired[0]<279)desired[2]=clamp(desired[2],1.1,14.9);return desired;};
mobility=function(){const prior=state.view;road09Core.mobility();if(road09.ready&&prior==='cargo'&&state.view==='outside'&&road09Zone(car.p)&&net.mode!=='guest'){const g=road09Support(player.p[0],player.p[2],car.p[1]-.04);player.p[1]=g.y+WALK_EYE;}};
stepPlayer=function(dt){const old=player.p.slice();road09Core.stepPlayer(dt);if(road09.ready&&state.view==='outside'&&road09Zone(player.p)&&!road09Duel()){const g=road09Support(player.p[0],player.p[2],old[1]-WALK_EYE,.6);player.p[1]=g.y+WALK_EYE;}};
stepWorldPackage=function(p,dt){const old=p.p.slice();road09Core.stepWorldPackage(p,dt);if(!road09.ready||!road09Zone(p.p)||road09Duel())return;const levels=road09Levels(p.p[0],p.p[2]);let landed=null;for(const g of levels)if(old[1]-p.r>=g.y-.025&&p.p[1]-p.r<g.y&&p.v[1]<0)landed=g;if(landed){p.p[1]=landed.y+p.r+.003;hurtParcel(p,Math.abs(p.v[1]));p.v[1]=Math.abs(p.v[1])>.9?Math.abs(p.v[1])*.22:0;p.v[0]*=.84;p.v[2]*=.84;p.pending=null;}
 // Underside of the crossing span; a thrown parcel cannot pass through the deck.
 if(Math.abs(p.p[0]-224)<8&&Math.abs(p.p[2]-8)<6.4&&old[1]+p.r<7.75&&p.p[1]+p.r>=7.75&&p.v[1]>0){p.p[1]=7.75-p.r;p.v[1]*=-.2;}
};
avatarMatrix=function(a){if(a.view==='outside'&&road09.ready&&road09Zone(a.p))return M.model([a.p[0],a.p[1]-WALK_EYE,a.p[2]],[0,a.yaw,0]);return road09Core.avatarMatrix(a);};
const road09Gates=[{id:'rampW',name:'01 上坡匝道',p:[168,4.08,8],tip:'从起点向前，在弯角右转上坡。'},{id:'upper',name:'02 高架桥面',p:[224,8.08,8],tip:'沿高架直行，桥面比地面高 8 米。'},{id:'rampE',name:'03 东侧下坡',p:[273,1.4,8],tip:'继续前行下坡，到弯道前减速。'},{id:'rS',name:'04 环岛南侧',p:[224,.08,70],tip:'弯道后到路口右转，进入环岛顺时针绕行。'},{id:'lower',name:'05 桥下通行',p:[224,.08,8],tip:'从环岛北口驶出，从同一座桥下面通过。'},{id:'finish',name:'06 停靠终点',p:[280,.08,-24],tip:'桥下继续前行，到丁字路口右转，停到终点。',stop:true}];
function road09Warp(where='trial'){
 if(!road09.ready){showHint('道路模型仍在准备中。',3);return;}if(net.mode==='guest'){showHint('由房主移动整车；你可以自由步行。',3);return;}if(road09Duel()){showHint('2v2 保留原城市地图；立体试跑请使用单人或合作模式。',5);return;}
 if(networked()&&otherAvatars().some(a=>a.view==='drive')){showHint('先让队友离开驾驶位，再由房主移动整车。',4);return;}
 if(networked()&&otherAvatars().some(a=>a.view==='outside')){showHint('先让全部队友上车，再转移整车。',4);return;}
 if(state.mode==='menu'){resetGame(false);}if(player.held){if(state.view==='outside'){const c=player.held;player.held=null;c.p=[.8,1.2,.6];c.v=[0,0,0];cargo.push(c);}else dropPackage();}
 if(state.mode==='paused')resume();road09.warpSerial++;clearInputs();state.view='drive';state.brick=false;brickBody.placed=false;state.switchUntil=state.time+.35;car.p=where==='city'?[3.2,.12,72]:[144,.12,39];car.yaw=0;car.speed=0;car.velocity=[0,0,0];car.kick=[0,0,0];car.accel=[0,0,0];car.steer=0;car.hp=100;car.fault='';car.roadPitch=0;car.roadVy=0;car.roadLayer='ground';driveOrbit=driveOrbitGoal=0;cameraBlend=0;eye=V.add(car.p,[16,13,21]);at=V.add(car.p,[0,2,0]);
 player.p=[0,2.38,-.9];player.aimGate=player.aimHouse=null;road09.trial=where==='city'?null:{index:0,start:state.time,finished:false,finishTime:0};road09CloseMap();syncButtons();updateHUD();showHint(where==='city'?'已返回原城市，订单与包裹保留。':'试跑开始：先向前，弯角右转上坡。门开着仍会掉货。',7);if(net.mode==='host')netSend(netSnapshot());
}
function road09AdvanceTrial(){const t=road09.trial;if(!t||t.finished||road09Duel())return;const g=road09Gates[t.index];if(Math.hypot(car.p[0]-g.p[0],car.p[2]-g.p[2])<(g.stop?7:8)&&Math.abs(car.p[1]-.04-g.p[1])<(t.index===0||t.index===2?3:1.8)&&(!g.stop||Math.abs(car.speed)<.55)){t.index++;tone(610,.09,'sine',.16);if(t.index>=road09Gates.length){t.finished=true;t.finishTime=state.time-t.start;showToast('立体试跑完成',formatTime(t.finishTime)+' · 上坡 / 高架 / 下坡 / 环岛 / 桥下 / 停靠',5);}else showHint(road09Gates[t.index].tip,6);}}
step=function(dt){road09Core.step(dt);if(road09.ready&&!road09Duel()){road09StepTraffic(dt);road09AdvanceTrial();}};
resetGame=function(toMenu=false){road091ResetLaw();road09Core.resetGame(toMenu);car.roadPitch=0;car.roadVy=0;car.roadLayer='ground';road09.trial=null;road09.lastGuestWarp=null;if(road09.ready)road09ResetTraffic();};
endRound=function(){road09Core.endRound();const el=document.getElementById('endBest');if(el&&road09.law.fines>0)el.textContent+=' · 交通罚款 $'+road09.law.fines+'（红灯 '+road09.law.red+' / 撞车 '+road09.law.crashes+'）';};
netSnapshot=function(target=null){const m=road09Core.netSnapshot(target);m.car.roadPitch=car.roadPitch||0;m.car.roadLayer=car.roadLayer||'ground';m.roads09={revision:2,warpSerial:road09.warpSerial,trial:road09.trial?{...road09.trial}:null,stats:{...road09.stats},law:{fines:road09.law.fines,red:road09.law.red,crashes:road09.law.crashes},npc:road09.npc.map(n=>({id:n.id,p:qvec(n.p),yaw:q3(n.yaw),speed:q3(n.speed),wait:n.wait,hp:n.hp,phase:n.phase}))};return m;};
applyHostSnapshot=function(m){road09Core.applyHostSnapshot(m);if(!m.roads09||net.lastWorldSeq!==m.seq)return;if(road09.lastGuestWarp!==m.roads09.warpSerial){road09.lastGuestWarp=m.roads09.warpSerial;Object.assign(car,m.car,{p:m.car.p.slice(),velocity:m.car.velocity.slice()});net.correction=null;net.prediction=false;net.predictionAccumulator=0;cameraBlend=0;}road09.trial=m.roads09.trial;road09.stats=m.roads09.stats||road09.stats;if(m.roads09.law){Object.assign(road09.law,m.roads09.law);road091UpdateLawUI();}car.roadPitch=m.car.roadPitch||0;car.roadLayer=m.car.roadLayer||'ground';for(const s of m.roads09.npc||[]){const n=road09.npc[s.id];if(n){n.target=s;n.phase=s.phase;n.wait=s.wait;n.speed=s.speed;}}};
tickGuest=function(dt){road09Core.tickGuest(dt);if(road09.ready){for(const n of road09.npc){if(!n.target)continue;const f=1-Math.exp(-dt*15);n.p=V.lerp(n.p,n.target.p,f);n.yaw=wrapAngle(n.yaw+wrapAngle(n.target.yaw-n.yaw)*f);}if(state.view!=='drive')car.roadPitch=net.snapshot?.car?.roadPitch||0;}};
function road09Draw(){if(!road09.ready||state.mode==='wardrobe'||road09Duel())return;road09.visible=0;road09.drawn=0;const f=V.norm(V.sub(at,eye));for(const c of road09.chunks){const d=V.sub(c.center,eye),len=V.len(d);if(len-c.radius>195||V.dot(d,f)<-c.radius)continue;renderer.draw(c.mesh);road09.visible++;road09.drawn+=c.mesh.count/3;}
 for(const n of road09.npc){if(V.len(V.sub(n.p,eye))>140)continue;renderer.draw(n.mesh,M.model(n.p,[0,n.yaw,0]));if(n.wait||n.phase!=='normal'){const m=M.model(n.p,[0,n.yaw,0]);renderer.draw(fireMeshes[n.phase!=='normal'?0:1],scaled(M.multiply(m,M.model([0,1.5,0])),.12));}}
 // Live indicators placed on top of the static traffic light model.
 for(const [x,z,axis] of [[264,48,'x'],[280,64,'x'],[264,64,'z'],[280,48,'z']]){const s=road09Signal(axis),mesh=signalMeshes[s==='green'?2:s==='amber'?1:0];renderer.draw(mesh,M.model([x,4.25,z],[0,axis==='x'?Math.PI/2:0,0]));}
 if(road09.trial&&!road09.trial.finished&&state.mode!=='menu'){const g=road09Gates[road09.trial.index];if(g&&V.len(V.sub([g.p[0],g.p[1]+2,g.p[2]],eye))<120){const s=1+Math.sin(state.time*3)*.07;renderer.draw(beaconMesh,scaled(M.model([g.p[0],g.p[1]+5,g.p[2]],[Math.PI,state.time*.4,0]),s));}}
}
window.__roads09Draw=road09Draw;
function road09DrawMini(){const p=road09View(),c=mapCtx,w=220,scale=1.06;c.clearRect(0,0,w,w);c.fillStyle='#183c44';c.fillRect(0,0,w,w);const x=v=>110+(v-p[0])*scale,z=v=>110+(v-p[2])*scale;for(const e of road09.edges){c.strokeStyle=e.path.points.some(q=>q[1]>3)?'#e6bd70':'#83979d';c.lineWidth=5;c.beginPath();e.path.points.forEach((q,i)=>i?c.lineTo(x(q[0]),z(q[2])):c.moveTo(x(q[0]),z(q[2])));c.stroke();}const t=road09.trial;if(t&&!t.finished){const g=road09Gates[t.index];c.fillStyle='#ffdc7b';c.beginPath();c.arc(x(g.p[0]),z(g.p[2]),6,0,TAU);c.fill();}for(const n of road09.npc){c.fillStyle='#9cd8c8';c.fillRect(x(n.p[0])-2,z(n.p[2])-2,4,4);}c.save();c.translate(110,110);c.rotate(-car.yaw);c.fillStyle='#fff2c3';c.beginPath();c.moveTo(0,-8);c.lineTo(-5,5);c.lineTo(5,5);c.closePath();c.fill();c.restore();}
drawMap=function(){if(road09.ready&&road09Zone(road09View())&&!road09Duel())road09DrawMini();else road09Core.drawMap();};
updateHUD=function(){road09Core.updateHUD();const el=document.getElementById('roadHUD09');if(!el)return;const active=road09.ready&&road09Zone(road09View())&&state.mode!=='menu'&&!road09Duel();el.classList.toggle('hidden',!active);road091UpdateLawUI();if(active){const chip=document.getElementById('districtChip');if(chip)chip.textContent='试验区 · 建议 30';const t=road09.trial,base=t?(t.finished?'路线完成 · '+formatTime(t.finishTime):road09Gates[t.index].name):'立体路网 · 自由试驾';document.getElementById('roadStep09').textContent=base;document.getElementById('roadHeight09').textContent=(car.p[1]>.8?'桥面 / 匝道 ':'地面 ')+Math.max(0,car.p[1]-.12).toFixed(1)+' m';document.getElementById('roadProgress09').style.width=t?(t.index/6*100)+'%':'0%';if(t&&!t.finished){document.getElementById('address').textContent=road09Gates[t.index].name;document.getElementById('distance').textContent=Math.round(Math.hypot(car.p[0]-road09Gates[t.index].p[0],car.p[2]-road09Gates[t.index].p[2]))+' m';const status=document.getElementById('routeGuide');if(status)status.textContent=road09Gates[t.index].tip;const delta=localVelocity({yaw:car.yaw},V.sub(road09Gates[t.index].p,car.p)),a=Math.atan2(delta[0],-delta[2]);$('routeArrow').textContent=['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(a/(Math.PI/4))+8)%8];}}if(road09.mapOpen)road09PaintMap();};
function road09OpenMap(){clearInputs();road09.mapOpen=true;document.getElementById('roadMap09').classList.remove('hidden');road09PaintMap();}
function road09CloseMap(){road09.mapOpen=false;document.getElementById('roadMap09')?.classList.add('hidden');}
function road09PaintMap(){
 const canvas=document.getElementById('roadCanvas09'),c=canvas?.getContext('2d');if(!c)return;const w=840,h=500;canvas.width=w;canvas.height=h;const px=x=>84+(x-120)*3.12,pz=z=>42+(z+40)*3.0;
 c.fillStyle='#112e37';c.fillRect(0,0,w,h);c.strokeStyle='#ffffff09';c.lineWidth=1;for(let x=20;x<w;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let z=20;z<h;z+=40){c.beginPath();c.moveTo(0,z);c.lineTo(w,z);c.stroke();}
 const unique=road09.edges.filter((e,i)=>!road09.edges.slice(0,i).some(q=>q.a===e.b&&q.b===e.a));const line=(e,col,width)=>{c.strokeStyle=col;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.beginPath();e.path.points.forEach((v,i)=>i?c.lineTo(px(v[0]),pz(v[2])):c.moveTo(px(v[0]),pz(v[2])));c.stroke();};
 unique.filter(e=>!e.path.points.some(p=>p[1]>1)).forEach(e=>line(e,'#48616c',31));unique.filter(e=>!e.path.points.some(p=>p[1]>1)).forEach(e=>line(e,'#93b1b5',2));
 unique.filter(e=>e.path.points.some(p=>p[1]>1)).forEach(e=>line(e,'#304e5a',39));unique.filter(e=>e.path.points.some(p=>p[1]>1)).forEach(e=>line(e,'#edc57a',24));unique.filter(e=>e.path.points.some(p=>p[1]>1)).forEach(e=>line(e,'#715a35',1.4));
 c.textAlign='center';c.font='bold 15px Arial,"Microsoft YaHei",sans-serif';
 for(let i=0;i<road09Gates.length;i++){const g=road09Gates[i],x=px(g.p[0]),z=pz(g.p[2]),passed=road09.trial&&i<road09.trial.index;c.fillStyle=passed?'#7ae0b5':'#ffd05b';c.beginPath();c.arc(x,z,13,0,TAU);c.fill();c.fillStyle='#14343d';c.fillText(String(i+1),x,z+5);}
 c.fillStyle='#daece2';c.font='12px Arial,"Microsoft YaHei",sans-serif';c.textAlign='left';c.fillText('旧城入口',12,pz(56)+5);c.fillText('高架 +8m',px(194),pz(8)-26);c.fillText('同一座桥：上层东西 / 下层南北',px(199),pz(8)+33);c.fillText('北侧停靠点',px(258),pz(-24)-17);c.fillText('环岛',px(221)-8,pz(56)+5);c.fillText('红绿灯路口',px(266),pz(56)-24);
 for(const n of road09.npc){c.fillStyle=n.wait?'#f49973':'#7ad9d3';c.beginPath();c.arc(px(n.p[0]),pz(n.p[2]),4,0,TAU);c.fill();}
 if(road09Zone(car.p)){c.save();c.translate(px(car.p[0]),pz(car.p[2]));c.rotate(-car.yaw);c.fillStyle='#fff4d5';c.strokeStyle='#173641';c.lineWidth=2;c.beginPath();c.moveTo(0,-11);c.lineTo(-6,7);c.lineTo(0,4);c.lineTo(6,7);c.closePath();c.fill();c.stroke();c.restore();}
 document.getElementById('roadPerf09').textContent=road09.ready?'20 个 GLB · '+road09.tiles.length+' 个摆放实例 · '+road09.chunks.length+' 个静态批次 · '+road09.npc.length+' 辆试验区交通车':'正在加载道路模型…';
 const blocked=net.mode==='guest'||road09Duel();document.getElementById('roadWarp09').disabled=blocked||!road09.ready;document.getElementById('roadCity09').disabled=blocked;
}
function road09BuildUI(){
 const start=document.createElement('button');start.id='roadStart09';start.className='primary roadStart09';start.disabled=true;start.innerHTML='<span>SKYWAY / 09</span><b>立体路网试跑 ↗</b><small>高架 · 环岛 · 坡道 · 上下层通行</small>';start.onclick=()=>{if(networked()&&!net.connected)stopNetwork(false);road09Warp('trial');};document.getElementById('startBtn').before(start);
 const edition=document.querySelector('.edition');if(edition)edition.innerHTML='V0.9.2 ONLINE <span>COLLISION + SIGN HOTFIX</span>';
 const eyebrow=document.querySelector('.menuCopy h2');if(eyebrow)eyebrow.innerHTML='这次，<br>从桥上送。';
 const p=document.querySelector('.menuCopy>p');if(p)p.innerHTML='20 个真实道路模型，拼出立体试验区。<br>城市派送、多人合作与 2v2 继续保留。';
 const oldStart=document.getElementById('startBtn');if(oldStart)oldStart.textContent='原城市 · 单人派送 →';
 const menuMap=document.createElement('button');menuMap.className='secondary';menuMap.textContent='立体路网导览 · J';menuMap.onclick=road09OpenMap;document.getElementById('helpBtn').before(menuMap);
 const hud=document.createElement('div');hud.id='roadHUD09';hud.className='hidden';hud.innerHTML='<div><b id="roadStep09">立体路网</b><button id="roadHUDMap09" aria-label="打开立体试验区地图">导览 J</button></div><small id="roadHeight09">地面 0.0 m</small><span><i id="roadProgress09"></i></span>';document.getElementById('hud').append(hud);document.getElementById('roadHUDMap09').onclick=road09OpenMap;
 const fineChip=document.createElement('span');fineChip.id='trafficFine09';fineChip.className='warn hidden';fineChip.textContent='交通罚款 $0';document.querySelector('.statuschips')?.append(fineChip);
 const panel=document.createElement('section');panel.id='roadMap09';panel.className='screen modalScreen hidden';panel.innerHTML=`<div class="roadPanel09"><header><div><small>SKYWAY DISTRICT / V0.9</small><h2>一座桥，两条路。</h2></div><button id="roadClose09" aria-label="关闭路网导览">关闭 ×</button></header><p>按 1 → 6 试跑。金色道路在高架层；灰蓝色道路在地面层。地图不暂停世界。</p><canvas id="roadCanvas09" width="840" height="500" aria-label="高架、环岛、坡道与原城市连接路线"></canvas><div class="roadLegend09"><span><i></i>高架 / 匝道</span><span>地面道路</span><span>● 六个试跑检查点</span></div><p id="roadPerf09"></p><footer><button id="roadWarp09" class="primary">整车前往试跑起点 →</button><button id="roadCity09" class="control">整车返回原城市</button></footer><p class="fineprint">合作模式由房主移动整车，队员需先上车。2v2 保留原城市规则，暂不使用试跑传送。试验区 NPC 受撞后停车，9 秒后恢复；原城市事故系统不变。</p></div>`;document.getElementById('game').append(panel);document.getElementById('roadClose09').onclick=road09CloseMap;document.getElementById('roadWarp09').onclick=()=>road09Warp('trial');document.getElementById('roadCity09').onclick=()=>road09Warp('city');
 const pauseMap=document.createElement('button');pauseMap.textContent='立体试验区 / 导览';pauseMap.onclick=road09OpenMap;document.querySelector('#pauseScreen .settings')?.append(pauseMap);
 const pauseExit=document.createElement('button');pauseExit.id='pauseExit091';pauseExit.className='exit091';pauseExit.textContent='退出到主菜单';pauseExit.onclick=road091ExitToMenu;document.querySelector('#pauseScreen .settings')?.append(pauseExit);
 document.getElementById('mapOpenBtn')?.addEventListener('click',e=>{if(road09Zone(road09View())&&!road09Duel()){e.preventDefault();e.stopImmediatePropagation();road09OpenMap();}},true);
 window.addEventListener('keydown',e=>{if(road09.mapOpen&&e.code!=='Escape'&&e.code!=='KeyJ'&&e.code!=='Tab'){if(!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();e.stopImmediatePropagation();}}},true);
 window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.repeat)return;if(e.code==='KeyJ'){e.preventDefault();road09.mapOpen?road09CloseMap():road09OpenMap();}if(e.code==='Escape'&&road09.mapOpen)road09CloseMap();});
}
async function road09Initialize(){const began=performance.now();try{const image=new Image();const palette=await new Promise((resolve,reject)=>{image.onload=()=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);resolve({data:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height});};image.onerror=()=>reject(Error('Palette image failed'));image.src=ROAD09_ATLAS;});const loader=new RoadGLB09(palette.data,palette.w,palette.h);for(const [name,bytes]of Object.entries(ROAD09_GLB_PACK))road09.assets.set(name,loader.load(name,bytes));road09Layout();road09.ready=true;road09.loadMs=performance.now()-began;document.getElementById('roadStart09').disabled=false;window.__roads09Ready=true;
 if(state.mode==='menu'){car.p=[208,8.12,8];car.yaw=-Math.PI/2;car.roadPitch=0;eye=[266,40,100];at=[221,3,29];}
 }catch(e){road09.error=e.message;console.error('Road district:',e);const b=document.getElementById('roadStart09');b.disabled=true;b.textContent='道路加载失败：'+e.message;window.__roads09Ready=false;}}
updateCamera=function(dt){if(road09.debugCamera){eye=road09.debugCamera.eye;at=road09.debugCamera.at;return;}if(road09.ready&&state.mode==='menu'){const t=motion?performance.now()*.000025:0;eye=V.lerp(eye,[264+Math.sin(t)*7,38,106+Math.cos(t)*6],1-Math.exp(-dt*1.7));at=V.lerp(at,[222,3.0,31],1-Math.exp(-dt*1.7));return;}road09Core.updateCamera(dt);};

function road092SyncViewport(){
 const vv=window.visualViewport,standalone=!!navigator.standalone||matchMedia('(display-mode: standalone)').matches;document.documentElement.classList.toggle('pwaStandalone092',standalone);
 let h=vv?.height||window.innerHeight||document.documentElement.clientHeight||1,top=vv?.offsetTop||0,fill=0;
 if(standalone&&screen?.height){const gap=screen.height-(h+top);if(gap>0&&gap<120)fill=gap;}
 const full=Math.ceil(h+top+fill);document.documentElement.style.setProperty('--appViewH',full+'px');
 const game=document.getElementById('game');if(game){game.style.height=full+'px';game.style.minHeight=full+'px';}
 requestAnimationFrame(()=>{try{resize();}catch(e){}});
}
for(const ev of ['orientationchange','pageshow'])window.addEventListener(ev,()=>setTimeout(road092SyncViewport,40));
window.addEventListener('resize',road092SyncViewport,{passive:true});window.visualViewport?.addEventListener('resize',road092SyncViewport,{passive:true});window.visualViewport?.addEventListener('scroll',road092SyncViewport,{passive:true});
setTimeout(road092SyncViewport,0);setTimeout(road092SyncViewport,350);

road09BuildUI();road09Initialize();
if(window.__deliveryTest){Object.assign(window.__deliveryTest,{roads09:{
 snapshot:()=>({ready:road09.ready,error:road09.error,assets:road09.assets.size,tiles:road09.tiles.length,triangles:road09.triangles,chunks:road09.chunks.length,visible:road09.visible,loadMs:road09.loadMs,trial:road09.trial,stats:{...road09.stats},law:{...road09.law},treeCull:window.__roadTreeCull091||0,car:{p:car.p.slice(),yaw:car.yaw,pitch:car.roadPitch,speed:car.speed},npc:road09.npc.map(n=>({p:n.p.slice(),speed:n.speed,wait:n.wait,progress:n.progress,phase:n.phase})),nodes:[...road09.nodes.values()].map(n=>({id:n.id,p:n.p})),edges:road09.edges.map(e=>({a:e.a,b:e.b,len:e.path.len}))}),
 start:()=>road09Warp('trial'),city:()=>road09Warp('city'),map:road09OpenMap,closeMap:road09CloseMap,levels:road09Levels,surface:(x,z,y=0)=>road09Support(x,z,y),route:(a,b)=>road09Route(a,b).map(e=>({a:e.a,b:e.b,len:e.path.len})),
 place:(x,z,yaw=0,speed=0,reference=0)=>{road09.warpSerial++;clearInputs();state.view='drive';state.mode='playing';state.switchUntil=0;car.p=[x,road09Support(x,z,reference).y+.04,z];car.yaw=yaw;car.speed=speed;car.velocity=V.mul(carForward(),speed);car.kick=[0,0,0];car.accel=[0,0,0];car.hp=100;car.fault='';car.roadPitch=0;car.roadVy=0;state.brick=false;brickBody.placed=false;cameraBlend=0;eye=V.add(car.p,[12,10,16]);at=V.add(car.p,[0,2,0]);},
 input:(keys)=>{inputs.keys.clear();for(const k of keys)inputs.keys.add(k);},clear:clearInputs,
 supportParcel:(x,y,z,v)=>{const p=makeCargo(0,[0,0,0]);p.p=[x,y,z];p.v=v;p.pending=null;p.delivered=false;p.r=.265;p.order=0;for(let i=0;i<120;i++)stepWorldPackage(p,1/120);return {p:p.p,v:p.v};},
 enableTraffic:b=>{for(const n of road09.npc){n.maxSpeed=b?(n.id<3?8:6.5):0;n.speed=0;}},
 trafficSimulation:seconds=>{for(let i=0;i<Math.ceil(seconds*60);i++){state.time+=1/60;road09StepTraffic(1/60);}return road09.stats;},
 trialAdvance:road09AdvanceTrial,coreCount:()=>({houses:houses.length,orders:deliverable.length,traffic:traffic.length,stock:physicalStock(),protocol:NET_PROTOCOL}),
 authoritative:()=>netSnapshot(),guestApply:m=>applyHostSnapshot(m),
 coordinates:p=>({world:vehicleToWorld(p),roundtrip:vehicleToLocal(vehicleToWorld(p))}),
 exterior:(x,z,y)=>{state.view='outside';player.p=[x,y+WALK_EYE,z];player.yaw=0;player.pitch=0;state.switchUntil=0;cameraBlend=0;syncButtons();},
 moveSample:()=>({view:state.view,p:player.p.slice(),world:state.view==='outside'?player.p.slice():vehicleToWorld(player.p),avatarFeet:M.point(avatarMatrix(localAvatar()),[0,0,0])}),
 routePoints:stops=>road09JoinRoute(stops).points,
 npcSample:()=>road09.npc.map(n=>({id:n.id,p:n.p.slice(),phase:n.phase,progress:n.progress,len:n.path.len,speed:n.speed,wait:n.wait})),
 noTraffic:()=>{for(const n of road09.npc){n.maxSpeed=0;n.speed=0;n.phase='parked';n.stopped=-1e6;n.p=[320,.1,-40];}},
 pose:(x,z,yaw,ref)=>{car.p=[x,road09Support(x,z,ref).y+.04,z];car.yaw=yaw;car.speed=0;car.velocity=[0,0,0];},
 camera:(e,a)=>{road09.debugCamera=e?{eye:e,at:a}:null;if(e){eye=e;at=a;cameraBlend=0;draw3D();}},
 signal:road09Signal,law:()=>({...road09.law}),exit:road091ExitToMenu,colliders:()=>road09.colliders.map(c=>JSON.parse(JSON.stringify(c))),furniture:road092FurnitureDiagnostics,viewport:()=>({css:getComputedStyle(document.documentElement).getPropertyValue('--appViewH'),innerHeight,screenHeight:screen.height,game:document.getElementById('game').getBoundingClientRect().height}),
 // Test fixture only: steering/pedals feed the unchanged driver controller, not direct transforms.
 driveRoute:seconds=>{const path=road09JoinRoute(['fork','bendW','rampW','topW','upper','topE','rampE','east','cross','rE','rS','rW','rN','roundN','lower','north','finish']);let progress=17,closest=17;const samples=[];state.switchUntil=0;for(let i=0;i<Math.ceil(seconds*120)&&!road09.trial?.finished;i++){
 let best=Infinity;for(let s=Math.max(0,progress-1);s<Math.min(path.len,progress+12);s+=.3){const q=pathAt(path,s),d=Math.hypot(q.p[0]-car.p[0],q.p[2]-car.p[2]);if(d<best){best=d;closest=s;}}progress=Math.max(progress,closest);const target=pathAt(path,Math.min(path.len,progress+5.0)).p,dx=target[0]-car.p[0],dz=target[2]-car.p[2],yaw=Math.atan2(-dx,-dz),err=wrapAngle(yaw-car.yaw);inputs.keys.clear();if(err>.035)inputs.keys.add('KeyA');if(err<-.035)inputs.keys.add('KeyD');const dist=Math.hypot(car.p[0]-280,car.p[2]+24),end=progress>path.len-16;const wanted=end?Math.max(0,(dist-2)*.6):Math.abs(err)>.55?3.2:6.5;if(car.speed<wanted-.25)inputs.keys.add('KeyW');if(car.speed>wanted+.3)inputs.keys.add('KeyS');step(1/120);if(i%120===0)samples.push({t:i/120,p:car.p.slice(),speed:car.speed,index:road09.trial?.index,error:best});if(!Number.isFinite(car.p[0]))throw Error('Nonfinite car');}
 clearInputs();updateCamera(.25);updateHUD();draw3D();return{progress,len:path.len,trial:road09.trial,samples};}


 }});}
