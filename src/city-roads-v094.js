/* V0.9.4 ALL ROADS — replaces the original city's asphalt/curb meshes.
 * Road graph, orders, traffic scheduling and multiplayer authority are unchanged.
 * All roadway tiles are decoded from the user's Kenney City Kit Roads 2.1 GLBs.
 * Kenney sign/lamp canonical axes below were measured from GLB vertex normals.
 */
const cityRoads094={ready:false,tiles:[],junctions:[],segments:[],lamps:[],signals:[],surfaceGrid:new Map(),stats:{},baseDrawSignals:drawCitySignals};
const CITY094={module:16,half:8,asphaltHalf:6.4,asphaltY:.08,curbY:.24,postOffset:9.65};
function city094RotatePort(p,yaw){const c=Math.cos(yaw),s=Math.sin(yaw);return[Math.round(c*p[0]+s*p[1]),Math.round(-s*p[0]+c*p[1])];}
function city094PortKey(ports){return ports.map(p=>p.join(',')).sort().join(';');}
function city094PickModule(ports){
 const key=city094PortKey(ports),defs=[
  {name:'road-crossroad-path',ports:[[1,0],[-1,0],[0,1],[0,-1]]},
  {name:'road-intersection-path',ports:[[1,0],[-1,0],[0,1]]},
  {name:'road-straight',ports:[[1,0],[-1,0]]},
  {name:'road-bend',ports:[[-1,0],[0,1]]},
  {name:'road-end-round',ports:[[1,0]]}
 ];
 for(const def of defs)for(let q=0;q<4;q++){const yaw=q*Math.PI/2;if(city094PortKey(def.ports.map(p=>city094RotatePort(p,yaw)))===key)return {...def,yaw};}
 throw new Error('Unmapped city road ports: '+key);
}
function city094Tile(name,x,z,yaw=0,length=16,width=16){
 const tile=road09Tile(name,x,z,0,yaw,16,true);
 // Only connectors are stretched along the road; curb height and roadway width stay identical.
 tile.m=scaled(M.model([x,R09.y,z],[0,yaw,0]),[length,16,width]);
 tile.district=districtAt(x,z);tile.city094=true;tile.span=[length,width];cityRoads094.tiles.push(tile);return tile;
}
function city094PrepareSignals(){
 const asset=road09.assets.get('traffic-light');if(!asset)throw Error('Missing traffic-light GLB');
 // Dim only the three coloured lens faces, not the orange housing or visors.
 const levels=[.47764,.43659,.39553],raw=asset.b.a;
 for(let i=0;i<raw.length;i+=9){const x=raw[i],y=raw[i+1],z=raw[i+2];if(raw[i+3]<-.95&&Math.abs(x+.05)<.0003&&levels.some(h=>Math.hypot(y-h,z)<.0164))raw.splice(i+6,3,.08,.13,.15);}
 cityRoads094.bulbs=['#ff5948','#ffd85d','#68ee8f'].map(c=>renderer.mesh(new MeshBuilder().cylinder(.0148,.0025,12,c)));
}
function city094CanPlacePole(x,z,clearance=.45){
 if(closestCityRoad([x,0,z]).d<CITY094.half+clearance)return false;
 for(const h of houses){const p=localVelocity(h,[x-h.x,0,z-h.z]);if(Math.abs(p[0])<6.3&&Math.abs(p[2])<5.3)return false;}
 return true;
}
function city094Build(){
 if(cityRoads094.ready)return;
 // Every graph node has an exactly matching set of physical/visual exits.
 for(const n of cityNodes){
  const ports=n.adj.map(id=>{const b=cityNodes[id];return[Math.sign(b.x-n.x),Math.sign(b.z-n.z)];});
  if(n.x===112&&n.z===56)ports.push([1,0]); // existing SKYWAY connector continues from this edge
  const choice=city094PickModule(ports),tile=city094Tile(choice.name,n.x,n.z,choice.yaw);
  tile.nodeId=n.id;tile.ports=ports;cityRoads094.junctions.push(tile);
 }
 // 56m node spacing minus the two half-junctions leaves 40m: two 20m connectors, no overlaps.
 for(const e of cityEdges){const a=cityNodes[e.a],b=cityNodes[e.b],d=edgeDirection(e.a,e.b),yaw=Math.abs(d[0])>.5?0:Math.PI/2;
  const gap=e.len-CITY094.module,count=Math.ceil(gap/20),len=gap/count,parts=[];
  for(let j=0;j<count;j++){const u=CITY094.half+(j+.5)*len;const t=city094Tile('road-straight',a.x+d[0]*u,a.z+d[2]*u,yaw,len,16);t.edgeId=e.id;parts.push(t.id);}
  cityRoads094.segments.push({edge:e.id,a:e.a,b:e.b,tiles:parts,length:gap});
  // Opposite verges: lamp arm points inward, neither support sits in a driveway or lane.
  for(const side of [-1,1]){let selected=null;const travelYaw=Math.atan2(-d[0],-d[2]);
   for(const u of [e.len*.5,e.len*.4,e.len*.6]){const center=[a.x+d[0]*u,a.z+d[2]*u],r=road093FlowRight(travelYaw),x=center[0]+r[0]*side*CITY094.postOffset,z=center[1]+r[2]*side*CITY094.postOffset;
    if(city094CanPlacePole(x,z)){selected=road092Roadside('light-curved',center[0],center[1],0,travelYaw,side,9.2,CITY094.postOffset);break;}}
   if(selected){selected.city094=true;cityRoads094.lamps.push(selected);}
  }
 }
 // V0.9.5: paired signs for both traffic directions on ordinary city streets.
 for(const e of cityEdges){
  const a=cityNodes[e.a],d=edgeDirection(e.a,e.b),travelYaw=Math.atan2(-d[0],-d[2]);let center=null;
  for(const u of [e.len*.30,e.len*.70,e.len*.50]){
   const c=[a.x+d[0]*u,a.z+d[2]*u],r=road093FlowRight(travelYaw),off=10.8;
   if(city094CanPlacePole(c[0]+r[0]*off,c[1]+r[2]*off,.45)&&city094CanPlacePole(c[0]-r[0]*off,c[1]-r[2]*off,.45)){center=c;break;}
  }
  if(center){const pair=road095PairedSigns('road-sign-warning',center[0],center[1],0,travelYaw,8.2,10.8);for(const t of pair){t.city094=true;t.edgeId=e.id;cityRoads094.signs095=(cityRoads094.signs095||[]);cityRoads094.signs095.push(t);}}
 }
 city094PrepareSignals();
 // Traffic lights use the SAME node/axis/phase as NPCs and the red-light fine detector.
 lights.length=0;
 for(const n of cityNodes){if(n.adj.length<3)continue;for(const from of n.adj){
  const d=edgeDirection(from,n.id),r=[-d[2],0,d[0]],travelYaw=Math.atan2(-d[0],-d[2]),x=n.x-d[0]*10.8+r[0]*9.65,z=n.z-d[2]*10.8+r[2]*9.65;
  if(!city094CanPlacePole(x,z,.35))throw Error('Traffic light intersects road at node '+n.id);
  const tile=road092FurnitureAt('traffic-light',x,z,0,travelYaw,9.1,1);tile.city094=true;tile.nodeId=n.id;tile.signalAxis=Math.abs(d[2])>.5?2:0;
  const l={p:M.point(tile.m,[-.051,.43659,0]),node:n.id,axis:tile.signalAxis,yaw:travelYaw,dir:d,tile094:tile};lights.push(l);cityRoads094.signals.push(tile);
 }}
 cityRoads094.stats={junctions:cityRoads094.junctions.length,streets:cityRoads094.segments.length,roadTiles:cityRoads094.tiles.length,lamps:cityRoads094.lamps.length,signals:cityRoads094.signals.length,originalSlabs:0};
 cityRoads094.ready=true;window.__cityRoads094Ready=true;
}
function city094Markings(builder){
 for(const l of lights){const n=cityNodes[l.node],d=l.dir,r=[-d[2],0,d[0]],p=[n.x-d[0]*CITY.entry+r[0]*3.15,.088,n.z-d[2]*CITY.entry+r[2]*3.15];builder.box(5.3,.012,.18,'#ecedf4',p,[0,Math.atan2(d[0],d[2]),0]);}
}
drawCitySignals=function(){
 if(!cityRoads094.ready)return;
 for(const l of lights){if(!l.tile094||V.len(V.sub(l.p,eye))>120)continue;const phase=signalPhase(cityNodes[l.node],l.axis),i=phase==='green'?2:phase==='amber'?1:0;
  const local=M.model([-.0512,[.47764,.43659,.39553][i],0],[0,0,Math.PI/2]);renderer.draw(cityRoads094.bulbs[i],M.multiply(l.tile094.m,local));
 }
};
// Build-time/read-only audits use transformed triangles, NOT analytic graph membership, to find gaps.
function city094Audit(){
 const failures=[],samples={roads:0,joins:0,turns:0},tol=.001;
 const test=(p,label,category)=>{samples[category]++;const levels=road09Levels(p[0],p[2]);if(!levels.some(s=>Math.abs(s.y-CITY094.asphaltY)<tol))failures.push({label,p,levels:levels.map(s=>s.y)});};
 for(const e of cityEdges){for(const sign of [-1,1]){const a=sign>0?e.a:e.b,b=sign>0?e.b:e.a;for(let u=8;u<=e.len-8;u+=.5)test(roadPoint(a,b,u),'lane:'+a+'>'+b,'roads');}
  const a=cityNodes[e.a],d=edgeDirection(e.a,e.b);for(const u of [8,28,48])for(const eps of [-.01,.01])for(const lateral of [-5.8,-3.05,3.05,5.8])test([a.x+d[0]*(u+eps)-d[2]*lateral,.08,a.z+d[2]*(u+eps)+d[0]*lateral],'join:'+e.id+':'+u,'joins');
 }
 for(const n of cityNodes)for(const from of n.adj)for(const to of n.adj){if(from===to)continue;const path=makeJunctionPath(from,n.id,to);for(let u=0;u<path.len;u+=.35)test(pathAt(path,u).p,'turn:'+from+'>'+n.id+'>'+to,'turns');}
 return{...cityRoads094.stats,samples,failures};
}
if(window.__deliveryTest)window.__deliveryTest.cityRoads094={
 audit:city094Audit,
 snapshot:()=>({...cityRoads094.stats,ready:cityRoads094.ready,tiles:cityRoads094.tiles.map(t=>({name:t.name,x:t.x,z:t.z,yaw:t.yaw,span:t.span,nodeId:t.nodeId,ports:t.ports,edgeId:t.edgeId})),lamps:cityRoads094.lamps.length,signals:cityRoads094.signals.length}),
 signals:()=>lights.map(l=>({node:l.node,axis:l.axis,p:l.p,phase:signalPhase(cityNodes[l.node],l.axis),travelYaw:l.yaw})),
 roadAt:(x,z)=>road09Levels(x,z),
 poses:()=>({car:car.p.slice(),actor:player.p.slice(),view:state.view}),
 trafficSurface:()=>traffic.filter(t=>t.phase==='normal').map(t=>({id:t.id,p:t.p.slice(),road:road09Levels(t.p[0],t.p[2]).some(s=>Math.abs(s.y-.08)<.001)})),
 orientation:()=>road09.furniture.map(t=>({name:t.name,travelYaw:t.travelYaw,side:t.side,origin:M.point(t.m,[0,0,0]),front:M.normal(t.m,[-1,0,0]),arm:M.normal(t.m,[0,0,-1]),city:!!t.city094})),
 drawCounts:()=>({chunks:road09.chunks.map(c=>({region:c.region,center:c.center,triangles:c.mesh.count/3})),visible:road09.visible,triangles:road09.drawn}),
 simulateDuelView:()=>{net.duelMode='duel2v2';net.mode='host';state.mode='playing';draw3D();return {visible:road09.visible,triangles:road09.drawn};},
 protocol:()=>NET_PROTOCOL
};
