/* Test-only instrumentation, injected into the game closure by regression.py.
 * Does not change production physics or road geometry. Pose sweeps and input-only
 * drives are reported separately. All geometry is read from the actual GLB meshes.
 */
window.__deliveryTest.qa122=(()=>{
 const api=window.__deliveryTest.city012;
 const flat=p=>[p[0],p[2]];
 function prepare(){window.__deliveryTest.suburban011.reset();api.disableTraffic();clearInputs();car.hp=100;car.fault='';car.steer=0;state.brick=false;state.view='drive';state.mode='playing';state.switchUntil=0;}
 function setPose(q,speed=8){car.p=[q.p[0],q.p[1]+.04,q.p[2]];car.yaw=q.yaw;car.speed=speed;car.kick=[0,0,0];car.velocity=V.mul(q.dir,speed);car.steer=0;car.roadVy=0;const n=road09Support(q.p[0],q.p[2],q.p[1]+.05).n;car.roadPitch=Math.atan(-(n[0]*q.dir[0]+n[2]*q.dir[2])/Math.max(.1,n[1]));car.hp=100;car.fault='';state.switchUntil=0;clearInputs();}
 function lanePath(points,offset=2.65){const path=polyPath(points,'qa-lane');return polyPath(Array.from({length:Math.ceil(path.len)+1},(_,i)=>{const q=pathAt(path,Math.min(i,path.len));return V.add(q.p,V.mul([-q.dir[2],0,q.dir[0]],offset));}),'qa-lane');}
 function turnPath(j,from,to){
  const din=[-from[0],0,-from[1]],dout=[to[0],0,to[1]],p=[j.x,j.y,j.z],r1=[-din[2],0,din[0]],r2=[-dout[2],0,dout[0]],d=12.65,off=2.65;
  const A=V.add(V.sub(p,V.mul(din,d)),V.mul(r1,off)),D=V.add(V.add(p,V.mul(dout,d)),V.mul(r2,off)),cross=din[0]*dout[2]-din[2]*dout[0],dot=V.dot(din,dout);
  const control=dot>.9?d*2/3:(d+(cross>0?-off:off))*.55228475,B=V.add(A,V.mul(din,control)),C=V.sub(D,V.mul(dout,control)),points=[];
  // Flat approach/departure tails let the truck align outside each junction.
  points.push(V.sub(A,V.mul(din,j.legacy?3:10)),A);
  for(let i=1;i<=60;i++){const t=i/60,u=1-t;points.push([0,1,2].map(k=>u*u*u*A[k]+3*u*u*t*B[k]+3*u*t*t*C[k]+t*t*t*D[k]));}
  points.push(V.add(D,V.mul(dout,j.legacy?3:10)));
  for(const q of points){const levels=road09Levels(q[0],q[2]).filter(g=>g.y<j.y+.66);if(levels.length)q[1]=levels.at(-1).y;}
  const path=polyPath(points,'qa-turn');path.label=j.label;path.turn=dot>.9?'straight':cross>0?'right':'left';return path;
 }
 function geometry(){const grid=new Map(),cell=16;let count=0;
  function add(raw,m,label){for(let i=0;i<raw.length;i+=27){const tri=[0,1,2].map(k=>M.point(m,raw.slice(i+k*9,i+k*9+3))),min=[0,1,2].map(k=>Math.min(...tri.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...tri.map(p=>p[k])));if(max[1]<.35)continue;const up=V.norm(V.cross(V.sub(tri[1],tri[0]),V.sub(tri[2],tri[0])))[1];const t={tri,min,max,label,up};count++;for(let x=Math.floor(min[0]/cell);x<=Math.floor(max[0]/cell);x++)for(let z=Math.floor(min[2]/cell);z<=Math.floor(max[2]/cell);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(t);}}}
  for(const t of road09.tiles)add(road09.assets.get(t.name).b.a,t.m,t.name+'#'+t.id);
  for(const t of V0105.gantries)add(road09.assets.get('sign-highway').b.a,t.m||scaled(M.model([t.x,t.y-.08,t.z],[0,t.yaw,0]),16),'gantry@'+t.x+','+t.z);
  return{grid,count};
 }
 let geo=null;
 function triangleBox(tri,p,yaw){const m=M.model(p,[car.roadPitch||0,yaw,0]),half=[1.62,1.60,3.81];const v=tri.map(t=>{const d=V.sub(t,p);return[m[0]*d[0]+m[1]*d[1]+m[2]*d[2],m[4]*d[0]+m[5]*d[1]+m[6]*d[2]-1.9,m[8]*d[0]+m[9]*d[1]+m[10]*d[2]];}),edges=[V.sub(v[1],v[0]),V.sub(v[2],v[1]),V.sub(v[0],v[2])],axes=[[1,0,0],[0,1,0],[0,0,1],V.cross(edges[0],edges[1])];for(const e of edges)for(const axis of [[1,0,0],[0,1,0],[0,0,1]])axes.push(V.cross(e,axis));for(const a of axes){const proj=v.map(p=>V.dot(p,a)),r=half.reduce((sum,h,i)=>sum+h*Math.abs(a[i]),0);if(Math.min(...proj)>r+1e-7||Math.max(...proj)<-r-1e-7)return false;}return true;}
 function geometryHits(p,yaw){if(!geo)geo=geometry();const seen=new Set(),hits=new Set(),support=road09Support(p[0],p[2],p[1]-.04);const ownSurface='#'+support.tile;for(let x=Math.floor((p[0]-4.2)/16);x<=Math.floor((p[0]+4.2)/16);x++)for(let z=Math.floor((p[2]-4.2)/16);z<=Math.floor((p[2]+4.2)/16);z++)for(const t of geo.grid.get(x+','+z)||[]){if(seen.has(t)||t.min[1]>p[1]+5.5||t.max[1]<p[1]-2||t.min[0]>p[0]+4.2||t.max[0]<p[0]-4.2||t.min[2]>p[2]+4.2||t.max[2]<p[2]-4.2)continue;seen.add(t);/* Supporting asphalt is checked by heights/real stepCar, not treated as an obstacle to its own wheels. All other decks, walls, curbs above the chassis, signs and piers remain in the triangle/OBB audit. */if(t.up>.6&&t.label.endsWith(ownSurface))continue;if(triangleBox(t.tri,p,yaw))hits.add(t.label);}return [...hits];}
 function sweep(path,step=1,checkGeometry=true){let samples=0,contacts=0,gaps=0,maxYError=0,minSpeed=8;const failures=[];
  for(let s=1;s<path.len-1;s+=step){const q=pathAt(path,s),levels=road09Levels(q.p[0],q.p[2]),level=levels.filter(g=>g.y<=q.p[1]+.66).at(-1);if(!level){gaps++;if(failures.length<12)failures.push({s,p:q.p,gap:true});continue;}q.p[1]=level.y;setPose(q);const before=car.p.slice();state.time+=1/120;stepCar(1/120,false);samples++;minSpeed=Math.min(minSpeed,car.speed);const moved=Math.hypot(car.p[0]-before[0],car.p[2]-before[2]);maxYError=Math.max(maxYError,Math.abs(car.p[1]-(road09Support(car.p[0],car.p[2],q.p[1]+.3).y+.04)));
   const hit=checkGeometry?geometryHits(before,q.yaw):[];if(moved>.25||car.speed<7.8||hit.length){contacts++;if(failures.length<12)failures.push({s,p:before,after:car.p.slice(),moved,speed:car.speed,hit});}
  }return{samples,contacts,gaps,maxYError,minSpeed,failures};
 }
 function streets(){prepare();return cityEdges.flatMap(e=>[false,true].map(rev=>{const a=cityNodes[rev?e.b:e.a],b=cityNodes[rev?e.a:e.b];return{edge:e.id,reverse:rev,...sweep(lanePath([[a.x,.08,a.z],[b.x,.08,b.z]]))};}));}
 function joins(){const result=cityRoads094.junctions.map(t=>({x:t.x,z:t.z,y:.08,ports:t.ports,label:'city-'+t.nodeId})).concat(ROADS122.joins.filter(j=>j.label!=='city-entry'));
  for(const t of road09.tiles){if(t.city094||t.native122||!['road-intersection','road-crossroad'].includes(t.name)||result.some(j=>j.x===t.x&&j.z===t.z))continue;const raw=t.name==='road-crossroad'?[[-1,0],[1,0],[0,-1],[0,1]]:[[-1,0],[1,0],[0,1]],o=M.point(t.m,[0,0,0]),ports=raw.map(p=>{const a=V.sub(M.point(t.m,[p[0],0,p[1]]),o);return[Math.round(a[0]/16),Math.round(a[2]/16)];});result.push({x:t.x,z:t.z,y:t.y+.08,ports,label:'legacy-'+t.id,legacy:true});}return result;}
 function junctions(){prepare();return joins().flatMap(j=>j.ports.flatMap((a,i)=>j.ports.filter((b,k)=>i!==k).map(b=>({label:j.label,from:a,to:b,...sweep(turnPath(j,a,b),.65)}))));}
 function turnCases(){return joins().flatMap(j=>j.ports.flatMap((a,i)=>j.ports.filter((b,k)=>i!==k).map(b=>({label:j.label,from:a,to:b}))));}
 function driveCase(index){const spec=turnCases()[index],j=joins().find(j=>j.label===spec.label);return{...spec,...drivePath(turnPath(j,spec.from,spec.to),{cruise:4,turnSpeed:3})};}
 function highways(){prepare();return CITY012.roads.flatMap(r=>[false,true].map(rev=>({id:r.id,reverse:rev,...sweep(lanePath(rev?r.points.slice().reverse():r.points),1.5)})));}
 function legacy(){prepare();return road09.edges.map(e=>({id:e.id,from:e.a,to:e.b,...sweep(lanePath(e.path.points),1)}));}

 // Closed-loop autopilot for QA only: writes gas/brake/left/right inputs and calls
 // the unmodified stepCar. Position, yaw and speed are set ONLY at the start.
 function drivePath(path,{cruise=12,turnSpeed=4,timeout=null}={}){
  prepare();const start=pathAt(path,0);setPose(start,0);let s=0,index=1,frames=0,maxTrackError=0,maxHeightError=0,minHp=100,lastProgress=0,stalled=0,geometryContacts=0;const failures=[],trace=[];
  const dt=1/120,maxFrames=Math.ceil((timeout||path.len/Math.max(2,turnSpeed)*2+30)/dt);
  function nearest(){let best=Infinity,bestS=s,bestK=index;
   for(let k=Math.max(1,index-3);k<path.points.length&&k<index+26;k++){const a=path.points[k-1],b=path.points[k],d=V.sub(b,a),l=d[0]*d[0]+d[2]*d[2],t=clamp(((car.p[0]-a[0])*d[0]+(car.p[2]-a[2])*d[2])/(l||1),0,1),p=V.lerp(a,b,t),distance=Math.hypot(car.p[0]-p[0],car.p[2]-p[2]);if(distance<best){best=distance;bestS=mix(path.lens[k-1],path.lens[k],t);bestK=k;}}
   index=bestK;s=Math.max(s,bestS);return best;
  }
  for(frames=0;frames<maxFrames;frames++){
   const error=nearest();maxTrackError=Math.max(maxTrackError,error);if(s>=path.len-1.5)break;
   const q=pathAt(path,s),soon=pathAt(path,Math.min(path.len,s+14)),curved=V.dot(q.dir,soon.dir)<.994,targetSpeed=curved?turnSpeed:cruise;
   const look=Math.max(3.4,Math.min(8,3+Math.abs(car.speed)*.38)),aim=pathAt(path,Math.min(path.len,s+look)),delta=V.sub(aim.p,car.p),angle=wrapAngle(Math.atan2(-delta[0],-delta[2])-car.yaw),dist=Math.max(.5,Math.hypot(delta[0],delta[2])),curvature=2*Math.sin(angle)/dist,steer=clamp(curvature*4.6/Math.tan(.54/(1+Math.abs(car.speed)*.031)),-1,1),keys=[];
   if(steer-car.steer>.01)keys.push('KeyA');else if(steer-car.steer<-.01)keys.push('KeyD');
   if(car.speed<targetSpeed-.2)keys.push('KeyW');else if(car.speed>targetSpeed+.2)keys.push('KeyS');
   inputs.keys=new Set(keys);state.time+=dt;stepCar(dt,false);minHp=Math.min(minHp,car.hp);const g=road09Support(car.p[0],car.p[2],q.p[1]+.3);maxHeightError=Math.max(maxHeightError,Math.abs(car.p[1]-g.y-.04));
   if(frames%30===0){const hit=geometryHits(car.p,car.yaw);geometryContacts+=hit.length?1:0;if(hit.length&&failures.length<8)failures.push({frame:frames,s,p:car.p.slice(),geometry:hit});}
   if(frames%120===0){trace.push({t:frames/120,s,p:car.p.slice(),speed:car.speed,hp:car.hp});if(s-lastProgress<.2)stalled++;else stalled=0;lastProgress=s;}
   if(stalled>8||error>12||car.hp<1){failures.push({frame:frames,s,stalled,error,hp:car.hp,p:car.p.slice()});break;}
  }
  clearInputs();return{completed:s>=path.len-1.5,length:path.len,progress:s,simulatedSeconds:frames*dt,maxTrackError,maxHeightError,minHp,geometryContacts,failures,trace};
 }
 function driveRoad(id,reverse=false){const r=CITY012.roads.find(r=>r.id===id),path=lanePath(reverse?r.points.slice().reverse():r.points);return{id,reverse,...drivePath(path,{cruise:16,turnSpeed:6})};}
 function driveTurn(label,fromIndex,toIndex){const j=ROADS122.joins.find(j=>j.label===label),path=turnPath(j,j.ports[fromIndex],j.ports[toIndex]);return{label,from:j.ports[fromIndex],to:j.ports[toIndex],...drivePath(path,{cruise:4,turnSpeed:3})};}


 function provenance(){return{nativeTriangles:road09.tiles.reduce((n,t)=>n+road09.assets.get(t.name).b.a.length/27,0),drawnTriangles:road09.chunks.reduce((n,c)=>n+c.mesh.count/3,0),driveTiles:road09.tiles.filter(t=>t.drive).length,assetNames:[...road09.assets.keys()],handmadeDeckSurfaces:CITY012.deckSurfaces.length,customHighwayChunks:CITY012.chunks.filter(c=>c.label==='highway').length,missingAssets:road09.tiles.filter(t=>!road09.assets.has(t.name)).map(t=>t.name)};}
 function seams(){const bad=[],rows=[];for(const j of ROADS122.joins)for(const port of j.ports){const a=road09Support(j.x+port[0]*7.995,j.z+port[1]*7.995,j.y+.15),b=road09Support(j.x+port[0]*8.005,j.z+port[1]*8.005,j.y+.15);const error=Math.abs(a.y-b.y),r={label:j.label,port,heightIn:a.y,heightOut:b.y,error,roadIn:a.road,roadOut:b.road};rows.push(r);if(error>.015||!a.road||!b.road)bad.push(r);}return{ports:rows.length,maxStep:Math.max(...rows.map(r=>r.error)),bad,rows};}
 function renderState(){updateHUD();renderCityMap($('minimap'));renderCityMap($('cityMap'),true);return{webglVersion:renderer.gl.getParameter(renderer.gl.VERSION),renderer:renderer.gl.getParameter(renderer.gl.RENDERER),glError:renderer.gl.getError(),title:document.title};}
 function allGeometry(){return geo||(geo=geometry());}
 return{provenance,seams,renderState,driveCase,turnCases,joins,driveRoad,driveTurn,drivePath,prepare,streets,junctions,highways,legacy,sweep,turnPath,lanePath,geometryHits,metadata:()=>({triangles:allGeometry().count,joins:ROADS122.joins.length,nodes:cityRoads094.junctions.length,legacy:road09.edges.map(e=>({id:e.id,a:e.a,b:e.b,path:e.path}))})};
})();
