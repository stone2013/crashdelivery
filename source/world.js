/* V0.7 CITY ROUTES — finite, shared road graph and three handcrafted districts.
 * Geometry and navigation use the SAME edges, including the omitted connections.
 * Units: metres, y up, forward -Z. All content is original procedural geometry.
 */
const CITY={limit:148,lines:[-112,-56,0,56,112],lane:3.05,halfRoad:6.5,entry:9.2,cycle:22};
const DISTRICTS={
 garden:{name:'向阳住宅区',short:'住宅区',en:'GARDEN',color:'#94bf88',map:'#345d55',speed:36,tip:'低窗好投，街边树木较多。适合先练习同车分工。'},
 market:{name:'风铃商业街',short:'商业街',en:'MARKET',color:'#64b6c5',map:'#315b6a',speed:30,tip:'店铺高窗更小，路口密集。先减速，让队友找准入口。'},
 works:{name:'北港工业区',short:'工业区',en:'WORKS',color:'#d7a472',map:'#5d5348',speed:40,tip:'装卸大门适合重箱，T 字路口需要提前看地图选路。'}
};
function districtAt(x,z){return x<-50&&z<48||z<-105&&x<0?'works':x>45&&z<48||z<-105&&x>0?'market':'garden';}
const cityNodes=[],cityEdges=[],cityNodeMap=new Map(),cityEdgeMap=new Map();
function cityNode(x,z){return cityNodeMap.get(x+','+z);}
for(const z of CITY.lines)for(const x of CITY.lines){const n={id:cityNodes.length,x,z,adj:[],offset:((x+112)/56*2+(z+112)/56)*.71};cityNodes.push(n);cityNodeMap.set(x+','+z,n);}
function roadKey(a,b){return Math.min(a,b)+':'+Math.max(a,b);}
function connectCity(a,b){if(!a||!b)return;const key=roadKey(a.id,b.id),e={id:cityEdges.length,key,a:a.id,b:b.id,len:Math.hypot(a.x-b.x,a.z-b.z)};cityEdges.push(e);cityEdgeMap.set(key,e);a.adj.push(b.id);b.adj.push(a.id);}
for(const n of cityNodes){for(const [dx,dz] of [[56,0],[0,56]]){
 const b=cityNode(n.x+dx,n.z+dz);if(!b)continue;
 // Two missing streets produce real T-junctions, not invisible roads through a plaza.
 if(n.x===-112&&n.z===-56&&dx===56||n.x===56&&n.z===0&&dx===56)continue;
 connectCity(n,b);
}}
const cityClaims=new Map(),cityPaths=new Map(),citySolids=[];
let cityBlocked=new Map(),cityTrafficStats={turns:0,left:0,right:0,redStops:0,yields:0,cleared:0},cityAIClock=0,cityIncidentClock=0;
function edgeDirection(a,b){a=cityNodes[a];b=cityNodes[b];const l=Math.hypot(b.x-a.x,b.z-a.z);return[(b.x-a.x)/l,0,(b.z-a.z)/l];}
function roadPoint(a,b,u){const A=cityNodes[a],d=edgeDirection(a,b),r=[-d[2],0,d[0]];return[A.x+d[0]*u+r[0]*CITY.lane,.1,A.z+d[2]*u+r[2]*CITY.lane];}
function signalPhase(n,axis,time=state.time){const t=((time+n.offset)%CITY.cycle+CITY.cycle)%CITY.cycle;
 // Both directions get 8.5s green + 1.5s amber + 1s all-red clearance.
 if(axis===2)return t<8.5?'green':t<10?'amber':'red';
 return t>=11&&t<19.5?'green':t>=19.5&&t<21?'amber':'red';
}
function segmentProjection(p,e){const a=cityNodes[e.a],b=cityNodes[e.b],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p[0]-a.x)*dx+(p[2]-a.z)*dz)/(e.len*e.len),0,1);const q=[a.x+t*dx,0,a.z+t*dz];return{q,t,d:Math.hypot(q[0]-p[0],q[2]-p[2]),edge:e};}
function closestCityRoad(p){let best=null;for(const e of cityEdges){const q=segmentProjection(p,e);if(!best||q.d<best.d)best=q;}return best;}
function roadAxis(v){return Math.min(...CITY.lines.map(q=>Math.abs(q-v)));}
function onRoad(p){return closestCityRoad(p).d<CITY.halfRoad+.1;}
function nearestRoad(v){return CITY.lines.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a,0);}
// Small 5x7 letter meshes for street identity. No downloaded fonts/textures.
const cityFont={
 A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01110'],H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],K:['10001','10010','10100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],
 N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10101','10101','11011','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['10010','10010','10010','11111','00010','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110']};
function cityText(builder,text,p,scale,color,parent=null){const left=-(text.length*6-1)*scale/2;Array.from(text).forEach((ch,i)=>{const glyph=cityFont[ch];if(!glyph)return;glyph.forEach((row,y)=>{for(let x=0;x<5;x++)if(row[x]==='1')builder.box(scale*.92,scale*.92,.023,color,[p[0]+left+(i*6+x)*scale,p[1]+(3-y)*scale,p[2]],[0,0,0],parent);});});}
function addHouse(x,z,yaw,num,colorIndex=0,deliverable=true){
 const m=M.model([x,0,z],[0,yaw,0]),district=districtAt(x,z),style=district;
 const h={x,z,yaw,num,deliverable,done:false,model:m,gates:[],district,style,address:DISTRICTS[district].short+' '+num+' 号'};
 const gates=style==='garden'?[{x:-2.9,y:2.725,w:2.4,h:2.15,type:'window'},{x:0,y:1.775,w:2.05,h:3.15,type:'door'},{x:2.9,y:2.725,w:2.4,h:2.15,type:'window'}]:
 style==='market'?[{x:-3.1,y:3.7,w:1.8,h:1.65,type:'window'},{x:0,y:1.675,w:2.15,h:2.95,type:'door'},{x:3.1,y:3.7,w:1.8,h:1.65,type:'window'}]:
 [{x:-3.65,y:3.58,w:1.6,h:1.4,type:'window'},{x:0,y:1.86,w:3.0,h:3.32,type:'door'},{x:3.65,y:3.58,w:1.6,h:1.4,type:'window'}];
 gates.forEach((g,i)=>{g.broken=false;g.index=i;g.house=h;g.center=houseWorld(h,[g.x,g.y,4.36]);h.gates.push(g);});
 const wall=style==='works'?(colorIndex%2?'#889fa6':'#a7aea4'):style==='market'?['#84babe','#d99073','#dfbd73'][colorIndex%3]:materials.wall[colorIndex%6];
 b(15.5,.10,14,style==='works'?'#a7b2a5':style==='market'?'#c5caba':'#9ebb7b',[0,.02,.3],[0,0,0],m);
 b(11,.22,8.5,'#d4d1b6',[0,.12,0],[0,0,0],m);b(10.5,.08,8,'#b99b75',[0,.27,0],[0,0,0],m);
 b(.24,5.2,8.5,wall,[-5.5,2.72,0],[0,0,0],m);b(.24,5.2,8.5,wall,[5.5,2.72,0],[0,0,0],m);b(11,5.2,.24,wall,[0,2.72,-4.2],[0,0,0],m);
 b(10.7,4.82,.025,'#414c48',[0,2.70,-4.063],[0,0,0],m);b(.025,4.82,8.1,'#4a554c',[-5.363,2.70,0],[0,0,0],m);b(.025,4.82,8.1,'#4a554c',[5.363,2.70,0],[0,0,0],m);b(10.7,.08,8.15,'#3c4c47',[0,5.21,0],[0,0,0],m);
 const xs=[...new Set([-5.5,5.5,...gates.flatMap(g=>[g.x-g.w/2,g.x+g.w/2])])].sort((a,b)=>a-b),ys=[...new Set([.2,5.32,...gates.flatMap(g=>[g.y-g.h/2,g.y+g.h/2])])].sort((a,b)=>a-b);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){const cx=(xs[i]+xs[i+1])/2,cy=(ys[j]+ys[j+1])/2;if(gates.some(g=>Math.abs(cx-g.x)<g.w/2-1e-6&&Math.abs(cy-g.y)<g.h/2-1e-6))continue;b(xs[i+1]-xs[i],ys[j+1]-ys[j],.25,wall,[cx,cy,4.2],[0,0,0],m);}
 for(const g of gates){const c=style==='works'?'#e4bd75':'#f6edda';b(.14,g.h+.28,.25,c,[g.x-g.w/2-.07,g.y,4.4],[0,0,0],m);b(.14,g.h+.28,.25,c,[g.x+g.w/2+.07,g.y,4.4],[0,0,0],m);b(g.w+.28,.14,.25,c,[g.x,g.y+g.h/2+.07,4.4],[0,0,0],m);if(g.type==='window')b(g.w+.35,.15,.42,c,[g.x,g.y-g.h/2-.05,4.43],[0,0,0],m);}
 b(11.6,.23,9.05,'#f0e5ce',[0,5.35,0],[0,0,0],m);
 if(style==='garden'){
  worldBuilder.roof(12,9.35,2.8,materials.roof[colorIndex%4],[0,5.47,0],[0,0,0],m);b(.8,1.6,.8,'#d4c4ab',[3.3,7.2,-1.4],[0,0,0],m);
  for(const side of [-1,1]){for(let k=0;k<6;k++)b(.13,1,.13,'#f2ead5',[side*(2.25+k*.85),.61,7.5],[0,0,0],m);b(4.5,.12,.12,'#e7dfc8',[side*4.3,.7,7.5],[0,0,0],m);}
  b(.15,1.2,.15,'#8a7554',[-1.9,.72,7.8],[0,0,0],m);b(.7,.42,.63,'#d66855',[-1.9,1.35,7.8],[0,0,0],m);
  const tp=houseWorld(h,[6.2,0,-.6]);addTree(tp[0],tp[2],.85);
 }else if(style==='market'){
  b(11.2,.45,8.8,'#486975',[0,5.64,0],[0,0,0],m);b(9.5,.74,.2,'#325768',[0,5.73,4.43],[0,0,0],m);
  cityText(worldBuilder,['MARKET','CAFE','POST'][colorIndex%3],[0,5.74,4.56],.085,'#fff0c7',m);
  // Ground-floor striped canopy stays BELOW the elevated delivery windows.
  for(let k=0;k<12;k++)b(.78,.12,1.15,k%2?'#f5ead2':'#ca7960',[-4.35+k*.79,2.72,4.78],[.12,0,0],m);
  for(const s of [-1,1]){b(1.5,1.35,.06,'#5c8c95',[s*3.15,1.38,4.37],[0,0,0],m);b(.10,1.35,.08,'#eadcca',[s*3.15,1.38,4.42],[0,0,0],m);}
  b(1.9,.75,1.5,'#7c9897',[2.8,6.04,-1.8],[0,0,0],m);
 }else{
  b(11.4,.28,8.9,'#456574',[0,5.60,0],[0,0,0],m);
  for(let k=0;k<15;k++)b(.06,4.5,.06,'#bcc6bb',[-5.18+k*.74,2.7,-4.36],[0,0,0],m);
  for(const s of [-1,1]){b(.18,3.55,.18,'#d5ad67',[s*1.77,1.98,4.4],[0,0,0],m);for(let k=0;k<5;k++)b(.19,.20,.19,'#3a5155',[s*1.77,.6+k*.68,4.43],[0,0,0],m);}
  b(7,.6,.2,'#395e6d',[0,4.92,4.4],[0,0,0],m);cityText(worldBuilder,'WORKS',[0,4.92,4.52],.066,'#efd391',m);
  for(const x of [-3,2.8])worldBuilder.cylinder(.8,1.2,8,'#a7b3aa',[x,6.16,-1.7],[0,0,0],.8,m);
 }
 b(2.6,.12,1.35,'#dfd9bd',[0,.16,4.98],[0,0,0],m);b(2.6,.07,4,'#d7d4b9',[0,.105,7.2],[0,0,0],m);
 b(1.25,.38,.05,'#315461',[0,4.73,4.50],[0,0,0],m);cityText(worldBuilder,String(num),[0,4.73,4.54],.038,'#fff1c2',m);
 b(3,.12,1,'#8d7559',[-2.5,.8,-2.7],[0,0,0],m);for(const x of [-3.7,-1.3])b(.15,.8,.9,'#6d6554',[x,.43,-2.7],[0,0,0],m);
 houses.push(h);return h;
}
function citySign(text,x,z,yaw=0){const m=M.model([x,0,z],[0,yaw,0]);for(const s of [-1,1])b(.14,3.3,.14,'#43636e',[s*1.45,1.65,0],[0,0,0],m);b(4.6,1.05,.14,'#345967',[0,3.10,0],[0,0,0],m);cityText(worldBuilder,text,[0,3.1,.085],.092,'#f7e9be',m);}
function buildWorld(){
 b(740,.5,740,'#a7c98d',[0,-.32,0]);
 // District paving and planting are cosmetic; drivable surfaces come from the graph below.
 b(99,.018,212,'#a4b5a2',[-105,-.035,-42]);b(101,.018,198,'#adc0b2',[107,-.033,-47]);
 for(const e of cityEdges){const a=cityNodes[e.a],d=edgeDirection(e.a,e.b),yaw=Math.atan2(d[0],d[2]),mid=V.lerp([a.x,0,a.z],[cityNodes[e.b].x,0,cityNodes[e.b].z],.5),m=M.model(mid,[0,yaw,0]);
  b(17,.10,e.len+12,'#d9ddc9',[0,-.03,0],[0,0,0],m);b(13,.045,e.len+12,'#626f79',[0,.034,0],[0,0,0],m);
  for(let z=-e.len/2+12;z<e.len/2-10;z+=7){b(.14,.018,2.8,'#f1d795',[0,.081,z],[0,0,0],m);for(const s of [-1,1])b(.075,.012,4.5,'#e4e9dc',[s*5.7,.079,z],[0,0,0],m);}
 }
 for(const n of cityNodes){
  b(13,.05,13,'#626f79',[n.x,.071,n.z]);
  for(const from of n.adj){const d=edgeDirection(from,n.id),r=[-d[2],0,d[0]],axis=Math.abs(d[2])>.5?2:0;
   const m=M.model([n.x,0,n.z],[0,Math.atan2(d[0],d[2]),0]);
   for(let k=0;k<6;k++)b(.64,.014,1.7,'#e7e9dc',[-4.3+k*1.72,.093,-8.1],[0,0,0],m);
   b(5.3,.016,.18,'#f4e7c9',[3.15,.10,-10.7],[0,0,0],m);
   const p=[n.x-d[0]*8.6+r[0]*7.2,4.55,n.z-d[2]*8.6+r[2]*7.2],yaw=Math.atan2(-d[0],-d[2]);
   worldBuilder.cylinder(.095,4.7,6,'#536c74',[p[0],2.35,p[2]]);b(.52,1.46,.30,'#283e48',p,[0,yaw,0]);
   lights.push({p,node:n.id,axis,yaw,dir:d});
  }
 }
 // Original addresses retained; six outer-city jobs added.
 addHouse(20,28,-Math.PI/2,101,1);addHouse(-20,12,Math.PI/2,102,0);addHouse(20,-22,-Math.PI/2,103,2);addHouse(-20,-36,Math.PI/2,104,3);
 addHouse(28,-76,0,105,0);addHouse(76,-26,-Math.PI/2,106,1);addHouse(76,22,-Math.PI/2,107,2);addHouse(30,76,Math.PI,108,3);addHouse(-18,76,Math.PI,109,4);addHouse(-76,25,Math.PI/2,110,2);addHouse(-76,-20,Math.PI/2,111,1);addHouse(-28,-76,0,112,0);
 addHouse(20,-132,0,113,0);addHouse(76,-132,0,114,1);addHouse(-20,-132,0,115,2);addHouse(-76,-132,0,116,0);addHouse(-132,-26,Math.PI/2,117,1);addHouse(-132,28,Math.PI/2,118,2);
 for(const p of [[-36,30,Math.PI,201,4],[35,27,Math.PI,202,2],[35,-32,0,203,4],[-34,-12,0,204,5],[132,-76,-Math.PI/2,205,2],[132,-20,-Math.PI/2,206,0],[132,28,-Math.PI/2,207,1],[132,76,-Math.PI/2,208,3],[-132,76,Math.PI/2,209,2],[-76,132,Math.PI,210,4],[20,132,Math.PI,211,1],[76,132,Math.PI,212,3]])addHouse(...p,false);
 for(const p of [[-42,94],[43,94],[94,90],[-40,101],[-90,94],[14,103],[96,42],[-96,52],[-99,-94],[91,-96],[39,101],[-103,103]])addTree(...p,1.2);
 // Garden square, the depot and industrial stacks. No collision-free solid shop entrances.
 for(const x of [17,42]){b(2,.09,13,'#d8d9b8',[x,.03,47]);for(let z=40;z<51;z+=5){b(1.7,.13,.52,'#957d59',[x,.85,z]);for(const s of [-1,1])b(.13,.8,.45,'#45616b',[x+s*.65,.4,z]);}}
 b(9,4.2,7,'#8299a2',[-20,2.2,43]);b(9.8,.35,7.8,'#425d6c',[-20,4.45,43]);b(.1,3,4.7,'#ffce67',[-15.43,1.72,43]);
 for(let i=0;i<5;i++){const p=[-13.9+(i%2),.55+(i>2?1:0),41.7+Math.floor(i/2)*1.1];b(.9,.9,.9,'#c19b67',p);b(.92,.93,.15,'#e4c793',p);}
 citySign('GARDEN',12,63,-Math.PI/2);citySign('MARKET',65,12,0);citySign('WORKS',-65,-11,Math.PI);
 // Missing-road gardens, clearly marked at T-junction terminations.
 for(const p of [[-90,-56],[90,0]]){b(21,.16,11,'#849c77',[p[0],.12,p[1]]);for(const x of [-7,7]){addTree(p[0]+x,p[1],.85);}b(4,.14,1,'#b19b70',[p[0],.2,p[1]]);}
 for(let i=0;i<30;i++){const a=i/30*TAU,dist=236+rnd()*28,h=20+rnd()*26;worldBuilder.cylinder(22+rnd()*10,h,5,i%2?'#93b5aa':'#aac1af',[Math.cos(a)*dist,h/2-3,Math.sin(a)*dist],[0,rnd()*6,0],0);}
 for(let i=0;i<20;i++){const x=(rnd()-.5)*390,z=(rnd()-.5)*390,y=39+rnd()*20;worldBuilder.poly(8,'#f4f3e5',[x,y,z],[1.8,.30,.60]);}
}
// Spatial batches: fewer far-away triangles while preserving a small number of draw calls.
function bakeCityWorld(builder){const chunks=new Map();let total=0;for(let i=0;i<builder.a.length;i+=27){const a=builder.a,cx=(a[i]+a[i+9]+a[i+18])/3,cz=(a[i+2]+a[i+11]+a[i+20])/3,key=Math.floor(cx/56)+','+Math.floor(cz/56);let g=chunks.get(key);if(!g){g={b:new MeshBuilder(),min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};chunks.set(key,g);}for(let j=0;j<27;j++)g.b.a.push(a[i+j]);for(let j=0;j<3;j++)for(let k=0;k<3;k++){g.min[k]=Math.min(g.min[k],a[i+j*9+k]);g.max[k]=Math.max(g.max[k],a[i+j*9+k]);}total++;}
 const meshes=[...chunks.values()].map(g=>({mesh:renderer.mesh(g.b),min:g.min,max:g.max,center:g.min.map((v,i)=>(v+g.max[i])/2),radius:V.len(V.sub(g.max,g.min))/2}));return{meshes,total};}
let cityVisibleBatches=0,cityVisibleTriangles=0;
function drawCityWorld(){const vp=renderer.vp,planes=[];for(let k=0;k<3;k++)for(const sign of [-1,1]){const p=[vp[3]+sign*vp[k],vp[7]+sign*vp[4+k],vp[11]+sign*vp[8+k],vp[15]+sign*vp[12+k]],n=Math.hypot(p[0],p[1],p[2]);planes.push(p.map(v=>v/n));}
 cityVisibleBatches=cityVisibleTriangles=0;
 for(const g of cityWorld.meshes){const delta=V.sub(g.center,eye),r=g.radius;if(V.len(delta)-r>205||planes.some(p=>p[0]*g.center[0]+p[1]*g.center[1]+p[2]*g.center[2]+p[3]<-r))continue;renderer.draw(g.mesh);cityVisibleBatches++;cityVisibleTriangles+=g.mesh.count/3;}}
