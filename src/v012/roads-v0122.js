/* V0.12.2 — Asset-only roads.
 * Render meshes are unchanged Kenney assets; instances use only T/R/S.
 * Planning curves below are lane/navigation data, NEVER generated road geometry.
 * Port elevations, native support triangles and collider transforms share a source.
 */
var city012BuildHighways;
const ROADS122={version:'0.12.2',tiles:[],joins:[],ramps:[],pieces:[],built:false,assetOnly:true,curves:[],bounds:[-384,384,-384,384]};
function road122GroundPorts(n,ports){
 const exits=[[-224,112,-1,0],[-224,-112,-1,0],[0,224,0,1],[0,-224,0,-1],[112,168,1,0],[112,-224,0,-1],[112,56,1,0]];
 for(const[x,z,dx,dz]of exits)if(n.x===x&&n.z===z&&!ports.some(p=>p[0]===dx&&p[1]===dz))ports.push([dx,dz]);
 return ports;
}
function road122Asset(name,x,z,y=0,yaw=0,scale=[16,16,16],drive=true){
 const t=road09Tile(name,x,z,y,yaw,16,drive);t.m=scaled(M.model([x,R09.y+y,z],[0,yaw,0]),scale);t.scaleXYZ122=scale.slice();t.native122=true;
 t.assetPath='assets/kenney-roads/'+name+'.glb';ROADS122.tiles.push(t);return t;
}
function road122Straight(a,b,y,guard=true){
 const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)return;
 const yaw=Math.atan2(-(b[1]-a[1]),b[0]-a[0]),n=Math.max(1,Math.ceil(len/32));
 for(let i=0;i<n;i++){const t=(i+.5)/n;road122Asset('road-straight',mix(a[0],b[0],t),mix(a[1],b[1],t),y,yaw,[len/n,16,16]);}
 if(guard&&y>1&&len>12){const g=len-8,parts=Math.ceil(g/32);for(let i=0;i<parts;i++){const t=(4+(i+.5)*g/parts)/len;road122Asset('road-straight-barrier',mix(a[0],b[0],t),mix(a[1],b[1],t),y,yaw+Math.PI/2,[16,16,g/parts],false);}}
 ROADS122.pieces.push({kind:'straight',a:[a[0],y+.08,a[1]],b:[b[0],y+.08,b[1]]});
}
function road122Junction(x,z,y,ports,label){
 const choice=city094PickModule(ports),name=choice.name.replace('-path','');
 const t=road122Asset(name,x,z,y,choice.yaw);t.ports=ports;t.joinLabel122=label;
 ROADS122.joins.push({x,z,y:y+.08,ports,label,tile:t.id});return t;
}
function road122Ramp(a,b,baseY=0,label=''){ // endpoints of a single native 2-unit ramp
 const len=Math.hypot(b[0]-a[0],b[1]-a[1]),yaw=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);
 const t=road122Asset('road-slant-curve',(a[0]+b[0])/2,(a[1]+b[1])/2,baseY,yaw,[len/2,16,16]);
 road122Asset('road-slant-curve-barrier',t.x,t.z,baseY,yaw,[len/2,16,16],false);
 ROADS122.ramps.push({a:[a[0],baseY+.08,a[1]],b:[b[0],baseY+8.08,b[1]],tile:t.id,label});return t;
}
function road122Line(a,b){return city012Line(a,b,2);}
function road122Append(out,pts){for(const p of pts)if(!out.length||V.len(V.sub(p,out.at(-1)))>.0001)out.push(p.slice());}
function road122Arc(cx,cz,start,end){return Array.from({length:49},(_,i)=>{const a=mix(start,end,i/48);return[cx+24*Math.cos(a),8.08,cz+24*Math.sin(a)];});}
function road122Edge(axis,fixed,start,end,cuts){
 const p=v=>axis==='x'?[v,fixed]:[fixed,v];let prev=start;
 for(const c of cuts.slice().sort((a,b)=>a.v-b.v)){
  road122Straight(p(prev),p(c.v-8),8);const q=p(c.v);road122Junction(q[0],q[1],8,c.ports,c.label);prev=c.v+8;
 }
 road122Straight(p(prev),p(end),8);
}
function road122ReplaceLegacy(name,x,z,newName,yaw){const t=road09.tiles.find(t=>t.name===name&&t.x===x&&t.z===z&&!t.native122);if(!t)throw Error('Native connector not found: '+name+' '+x+','+z);t.name=newName;t.yaw=yaw;t.m=scaled(M.model([x,R09.y+t.y,z],[0,yaw,0]),16);}
city012BuildHighways=function(){
 if(CITY012.built)return;CITY012.built=true;ROADS122.built=true;
 // H1: an elevated peripheral rectangle with four genuine 32m Kenney curve tiles.
 road122Edge('x',-368,-344,344,[{v:-168,ports:[[-1,0],[1,0],[0,1]],label:'H1-H3 north'},{v:0,ports:[[-1,0],[1,0],[0,1]],label:'H1-R4'},{v:112,ports:[[-1,0],[1,0],[0,1]],label:'H1-R7'}]);
 road122Edge('x',368,-344,344,[{v:-168,ports:[[-1,0],[1,0],[0,-1]],label:'H1-H3 south'},{v:0,ports:[[-1,0],[1,0],[0,-1]],label:'H1-R3'}]);
 road122Edge('z',-368,-344,344,[{v:-168,ports:[[0,-1],[0,1],[1,0]],label:'H1-H2 west'},{v:-112,ports:[[0,-1],[0,1],[1,0]],label:'H1-R2'},{v:112,ports:[[0,-1],[0,1],[1,0]],label:'H1-R1'}]);
 road122Edge('z',368,-344,344,[{v:-168,ports:[[0,-1],[0,1],[-1,0]],label:'H1-H2 east'},{v:168,ports:[[0,-1],[0,1],[-1,0]],label:'H1-R5'}]);
 for(const[x,z,yaw]of [[360,-360,0],[360,360,-Math.PI/2],[-360,360,Math.PI],[-360,-360,Math.PI/2]]){const t=road122Asset('road-curve',x,z,8,yaw);ROADS122.curves.push(t.id);}
 const ring=[];road122Append(ring,road122Line([-344,8.08,-368],[344,8.08,-368]));road122Append(ring,road122Arc(344,-344,-Math.PI/2,0));road122Append(ring,road122Line([368,8.08,-344],[368,8.08,344]));road122Append(ring,road122Arc(344,344,0,Math.PI/2));road122Append(ring,road122Line([344,8.08,368],[-344,8.08,368]));road122Append(ring,road122Arc(-344,344,Math.PI/2,Math.PI));road122Append(ring,road122Line([-368,8.08,344],[-368,8.08,-344]));road122Append(ring,road122Arc(-344,-344,Math.PI,Math.PI*1.5));
 city012Road('H1','H1 外环高速',ring,16);
 // H2 and H3 share ONE native bridge instance at their crossing, not stacked slabs.
 road122Straight([-360,-168],[-176,-168],8);road122Straight([-160,-168],[216,-168],8);
 road122Junction(224,-168,8,[[-1,0],[1,0],[0,1]],'H2-R6');road122Straight([232,-168],[360,-168],8);
 road122Asset('road-bridge',-168,-168,8,0); // local lower X / upper Z
 city012Road('H2','H2 东西快速路',road122Line([-368,8.08,-168],[368,8.08,-168]),16);
 road122Ramp([-168,-360],[-168,-232],8,'H3 north');road122Straight([-168,-232],[-168,-176],16);
 road122Straight([-168,-160],[-168,232],16);road122Ramp([-168,360],[-168,232],8,'H3 south');
 city012Road('H3','H3 南北高架',road122Line([-168,8.08,-368],[-168,8.08,368]),16);
 // Seven rectilinear access routes. No ramp crosses an ordinary street while rising.
 road122Ramp([-232,112],[-360,112],0,'R1');city012Road('R1','R1 住宅西出口',road122Line([-224,.08,112],[-368,8.08,112]),16,'ramp');
 road122Ramp([-232,-112],[-360,-112],0,'R2');city012Road('R2','R2 商业西出口',road122Line([-224,.08,-112],[-368,8.08,-112]),16,'ramp');
 road122Ramp([0,232],[0,360],0,'R3');city012Road('R3','R3 住宅南出口',road122Line([0,.08,224],[0,8.08,368]),16,'ramp');
 road122Ramp([0,-232],[0,-360],0,'R4');city012Road('R4','R4 商业北出口',road122Line([0,.08,-224],[0,8.08,-368]),16,'ramp');
 road122Straight([120,168],[232,168],0,false);road122Ramp([232,168],[360,168],0,'R5');city012Road('R5','R5 工业东出口',road122Line([112,.08,168],[368,8.08,168]),16,'ramp');
 road122ReplaceLegacy('road-intersection',224,-24,'road-crossroad',0);
 road122Ramp([224,-32],[224,-160],0,'R6');city012Road('R6','R6 SKYWAY 快速路入口',road122Line([224,.08,-24],[224,8.08,-168]),16,'ramp');
 road122Ramp([112,-232],[112,-360],0,'R7');city012Road('R7','R7 工业北出口',road122Line([112,.08,-224],[112,8.08,-368]),16,'ramp');
 // Geometry-first: profiles are measured from transformed native triangles after baking.
 road09Bake();
 for(const r of CITY012.roads){for(const p of r.points){const ref=r.id==='H3'?16.5:r.kind==='ramp'?9:8.5;const levels=road09Levels(p[0],p[2]).filter(g=>g.y<ref&&g.y>=-.01);if(!levels.length)throw Error('Road gap '+r.id+' '+p);p[1]=levels.at(-1).y;}r.path=polyPath(r.points,'city012-'+r.id);}
 road122Pillars();road09Bake();road092BuildColliders();road122BarrierColliders();city012LayoutIndex();
 for(const tile of cityRoads094.junctions){const n=cityNodes[tile.nodeId];if(tile.ports.length>n.adj.length)ROADS122.joins.push({x:n.x,z:n.z,y:.08,ports:tile.ports,label:'city-entry',tile:tile.id});}
 ROADS122.joins.push({x:224,z:-24,y:.08,ports:[[-1,0],[1,0],[0,-1],[0,1]],label:'SKYWAY-R6',tile:road09.tiles.find(t=>t.x===224&&t.z===-24&&t.drive).id});
};
function road122Pillars(){
 const b=road093AssetBounds('bridge-pillar');
 for(const r of CITY012.roads.filter(r=>r.id==='H1'||r.id==='H2'||r.id==='H3'))for(let s=32;s<r.path.len-20;s+=64){const q=pathAt(r.path,s);if(q.p[1]<7||Math.abs(q.dir[1])>.015)continue;
  const side=[-q.dir[2],0,q.dir[0]];for(const sign of [-1,1]){const p=V.add(q.p,V.mul(side,sign*7));if(ROADS122.joins.some(j=>Math.hypot(j.x-p[0],j.z-p[2])<17))continue;
   // A support may stand on a verge, never on a lower asphalt lane or its turning envelope.
   let safe=true;for(const dx of [-.8,0,.8])for(const dz of [-.8,0,.8])for(const g of road09Levels(p[0]+dx,p[2]+dz)){if(g.y<q.p[1]-2&&Math.abs((g.y-.08)%8)<.03)safe=false;}
   if(!safe)continue;const h=q.p[1]-.18;const t=road122Asset('bridge-pillar',p[0],p[2],.08,0,[1.15/(b.max[0]-b.min[0]),h/(b.max[1]-b.min[1]),1.15/(b.max[2]-b.min[2])],false);t.pillar122={r:.59,maxY:h};
  }
 }
}
// Correct inverse-transpose normal for the orthogonal T/R/S instance matrix.
// Stretching a stock ramp changes its slope, not its source GLB geometry.
function road122Normal(m,n){const d=[0,4,8].map(k=>m[k]*m[k]+m[k+1]*m[k+1]+m[k+2]*m[k+2]);return V.norm([0,1,2].map(k=>m[k]*n[0]/d[0]+m[k+4]*n[1]/d[1]+m[k+8]*n[2]/d[2]));}
// Replaces the complete old bake: no handmade asphalt, slab, centreline, guardrail or
// roundabout disk is inserted. The grass already below the roundabout is visible.
road09Bake=function(){
 for(const c of road09.chunks)renderer.gl.deleteBuffer(c.mesh.buffer);
 road09.surfaces.length=0;road09.grid.clear();const chunks=new Map();
 for(const tile of road09.tiles){const a=road09.assets.get(tile.name);if(!a)throw Error('Missing native road '+tile.name);const raw=a.b.a;
  for(let i=0;i<raw.length;i+=27){const row=[],tri=[];for(let k=0;k<3;k++){const o=i+k*9,p=M.point(tile.m,raw.slice(o,o+3)),n=road122Normal(tile.m,raw.slice(o+3,o+6));row.push(...p,...n,...raw.slice(o+6,o+9));tri.push(p);}
   const x=(tri[0][0]+tri[1][0]+tri[2][0])/3,z=(tri[0][2]+tri[1][2]+tri[2][2])/3,region=tile.city094?'city':tile.native122?'highway':'skyway',key=region+'|'+Math.floor(x/40)+','+Math.floor(z/40);let builder=chunks.get(key);if(!builder){builder=new MeshBuilder();chunks.set(key,builder);}builder.a.push(...row);if(tile.drive)road09Surface(tri,tile);
  }
 }
 road09.chunks=[...chunks].map(([key,b])=>{const[region,cell]=key.split('|'),[x,z]=cell.split(',').map(Number);return{region,mesh:renderer.mesh(b),center:[x*40+20,region==='highway'?10:4,z*40+20],radius:34};});road09.triangles=road09.chunks.reduce((n,c)=>n+c.mesh.count/3,0);
};
const road122OldColliders=road092BuildColliders;
road092BuildColliders=function(){road122OldColliders();for(const t of ROADS122.tiles)if(t.pillar122){const c=road09.colliders.find(c=>c.label==='bridge-pillar'&&c.x===t.x&&c.z===t.z);if(c){c.r=t.pillar122.r;c.maxY=t.pillar122.maxY;}}};
function road122BarrierColliders(){CITY012.rails.length=0;CITY012.railGrid.clear();
 // Guard segments follow transformed original barrier faces, with no join-crossing end caps.
 for(const t of ROADS122.tiles){if(t.name!=='road-straight-barrier'&&t.name!=='road-slant-curve-barrier')continue;
  const curved=t.name==='road-slant-curve-barrier',steps=curved?48:1;
  for(const sign of [-1,1])for(let i=0;i<steps;i++){
   let a,b;if(curved){const x1=-1+2*i/steps,x2=-1+2*(i+1)/steps;a=M.point(t.m,[x1,0,sign*.495]);b=M.point(t.m,[x2,0,sign*.495]);const ref=t.y+9;a[1]=road09Support(a[0],a[2],ref).y;b[1]=road09Support(b[0],b[2],ref).y;}else{a=M.point(t.m,[sign*.495,0,-.5]);b=M.point(t.m,[sign*.495,0,.5]);a[1]=b[1]=t.y+.08;}
   city012Rail(a,b,Math.min(a[1],b[1]),.07);
  }
 }
}
// Native straight tiles are 16m / two lanes. Old 7.7m "outer lanes" lay on the curb.
const road122ResetHighwayTraffic=road09ResetTraffic;road09ResetTraffic=function(){road122ResetHighwayTraffic();for(const n of road09.npc)if(n.highway012){n.lane012=2.65;Object.assign(n,road09NPCPoint(n,n.progress));}};
// Slow AI before native curve and junction turns; still fast on straight highway sections.
const road122StepTraffic=road09StepTraffic;road09StepTraffic=function(dt){for(const n of road09.npc)if(n.highway012){const a=pathAt(n.path,n.progress),b=pathAt(n.path,(n.progress+25)%n.path.len);n.maxSpeed=V.dot(a.dir,b.dir)<.985?8:20;}road122StepTraffic(dt);};
// Native slab thickness is .16m, not the removed 0.42m custom ribbon thickness.
const road122ParcelBase=stepWorldPackage;stepWorldPackage=function(p,dt){const old=p.p.slice();road122ParcelBase(p,dt);if(!ROADS122.built||p.delivered||net.mode==='guest'||p.p[1]<=old[1])return;const next=p.p.slice(),n=Math.min(128,Math.max(1,Math.ceil(V.len(V.sub(next,old))/.25)));for(let i=1;i<=n;i++){const a=V.lerp(old,next,(i-1)/n),b=V.lerp(old,next,i/n);for(const g of road09Levels(b[0],b[2])){const tile=road09.tiles[g.tile];if(!tile?.native122||g.y<1)continue;const under=g.y-.16-(p.r||.24);if(a[1]<=under&&b[1]>=under){p.p=V.lerp(a,b,(under-a[1])/(b[1]-a[1]));p.p[1]-=.008;p.v[1]=-Math.abs(p.v[1])*.23;p.pending=null;p.bounces=(p.bounces||0)+1;return;}}}};
// The expanded ring is included in both map sizing and its text labels.
mapMetrics=function(canvas){const w=canvas.width,h=canvas.height,pad=w<300?13:27,large=w>=300,scale=large?Math.min((w-pad*2)/800,(h-pad*2)/800):.67,cx=large?0:car.p[0],cz=large?0:car.p[2];return{w,h,pad,scale,cx,cz,x:x=>w/2+(x-cx)*scale,z:z=>h/2+(z-cz)*scale};};
const road122InfoBase=city012Info;city012Info=function(){return{...road122InfoBase(),version:'0.12.2',assetOnlyRoads:true,nativeHighwayTiles:ROADS122.tiles.filter(t=>t.drive).length,nativeRoadTiles:road09.tiles.filter(t=>t.drive).length,roadJoins:ROADS122.joins.length};};
const road122BootBase=city012Boot;city012Boot=function(){road122BootBase();const e=$('suburbanLoad011');if(e&&CITY012.ready)e.textContent='V0.12.2 · 全原生道路 · 3 条高速 / 7 条外围入口';};
if(window.__deliveryTest){window.__deliveryTest.city012.info=city012Info;window.__deliveryTest.roads122={info:()=>({version:ROADS122.version,tiles:road09.tiles.map(t=>({id:t.id,name:t.name,p:[t.x,t.y,t.z],m:Array.from(t.m),drive:t.drive,native:!!t.native122,ports:t.ports,asset:t.assetPath||'assets/kenney-roads/'+t.name+'.glb'})),joins:ROADS122.joins,ramps:ROADS122.ramps,pieces:ROADS122.pieces,roads:CITY012.roads.map(r=>({id:r.id,path:r.path,width:r.width})),colliders:road09.colliders,rails:CITY012.rails}),rebake:()=>{const n=road09.surfaces.length;road09Bake();return{before:n,after:road09.surfaces.length};}};}
