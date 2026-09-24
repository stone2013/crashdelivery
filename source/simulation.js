function stepCar(dt){
 const oldV=car.velocity.slice(),oldYaw=car.yaw,k=inputs.keys,driving=state.view==='drive'&&state.time>=state.switchUntil;
 const left=driving&&(k.has('KeyA')||k.has('ArrowLeft')||inputs.left.size),right=driving&&(k.has('KeyD')||k.has('ArrowRight')||inputs.right.size),gas=driving&&(k.has('KeyW')||k.has('ArrowUp')||inputs.gas.size),brake=driving&&(k.has('KeyS')||k.has('ArrowDown')||inputs.brake.size);
 const steer=(left?1:0)-(right?1:0);car.steer=mix(car.steer,steer,1-Math.exp(-9*dt));const road=onRoad(car.p);
 const brakeMul=1+upgrades.brakes*.16,engineMul=1+upgrades.engine*.12,gripMul=1+upgrades.grip*.18;if(brake){car.speed-=dt*(car.speed>.15?21*brakeMul:5.5*brakeMul);car.speed=Math.max(-4.5,car.speed);}
 else if((gas||state.brick)&&car.hp>0){car.speed+=dt*(car.speed<0?13:gas?8.6*engineMul:6.0*engineMul);}
 else {const drag=(road?.6:2.5)+Math.abs(car.speed)*.085;car.speed=Math.sign(car.speed)*Math.max(0,Math.abs(car.speed)-drag*dt);}
 const max=road?(gas?20.5:state.brick?15.5:20.5):6.5;car.speed=clamp(car.speed,-4.5,23);if(car.speed>max)car.speed=Math.max(max,car.speed-dt*12);
 car.yaw=wrapAngle(car.yaw+car.steer*car.speed/(4.6/gripMul)*Math.tan(.54/(1+Math.abs(car.speed)*.031))*dt);car.yawRate=wrapAngle(car.yaw-oldYaw)/dt;
 car.velocity=V.add(V.mul(carForward(),car.speed),car.kick);car.p=V.add(car.p,V.mul(car.velocity,dt));car.p[1]=.12;car.kick=V.mul(car.kick,Math.exp(-2.5*dt));
 // House and warehouse collisions use local expanded footprints.
 for(const h of houses){if(Math.abs(car.p[0]-h.x)>10||Math.abs(car.p[2]-h.z)>10)continue;const p=houseLocal(h,car.p),rx=7.15,rz=6.05;if(Math.abs(p[0])<rx&&Math.abs(p[2])<rz){const dx=rx-Math.abs(p[0]),dz=rz-Math.abs(p[2]);if(dx<dz)p[0]=Math.sign(p[0]||1)*(rx+.01);else p[2]=Math.sign(p[2]||1)*(rz+.01);car.p=houseWorld(h,p);impact(Math.abs(car.speed));car.speed*=-.16;}}
 if(car.p[0]>-26.5&&car.p[0]<-13.7&&car.p[2]>37&&car.p[2]<49){car.p[0]=-13.69;impact(Math.abs(car.speed));car.speed*=-.16;}
 for(const t of traffic){if(t.phase==='cleared')continue;if(Math.hypot(car.p[0]-t.p[0],car.p[2]-t.p[2])>8.3)continue;const hit=overlapVehicles(t);if(!hit)continue;car.p=V.add(car.p,V.mul(hit.normal,hit.depth+.01));
  if(t.hitCooldown<=0){const npcVelocity=t.phase==='normal'?V.add(V.mul([-Math.sin(t.yaw),0,-Math.cos(t.yaw)],t.speed),t.drift):t.drift;const closing=Math.max(0,-V.dot(V.sub(car.velocity,npcVelocity),hit.normal));if(closing>1.5){t.hitCooldown=.65;impact(closing);damageTraffic(t,Math.max(0,(closing-2.5)*(closing-2.5)*.52),V.mul(hit.normal,-closing*.40));if(t.phase==='normal'&&closing>4)t.phase='damaged';car.speed*=-.13;car.kick=V.add(car.kick,V.mul(hit.normal,Math.min(4,closing*.2)));}}
 }
 if(Math.abs(car.p[0])>CITY.limit||Math.abs(car.p[2])>CITY.limit){car.p[0]=clamp(car.p[0],-CITY.limit,CITY.limit);car.p[2]=clamp(car.p[2],-CITY.limit,CITY.limit);impact(Math.abs(car.speed));car.speed*=-.25;if(state.time>state.warnUntil){showHint('到街区边缘了。回驾驶位掉头，或在暂停菜单救援。',4);state.warnUntil=state.time+4;}}
 car.velocity=V.add(V.mul(carForward(),car.speed),car.kick);car.accel=V.mul(V.sub(car.velocity,oldV),1/dt).map(v=>clamp(v,-30,30));
 car.wheelAngle+=car.speed*dt/.5;car.roll=mix(car.roll,-car.steer*car.speed*.003,1-Math.exp(-6*dt));
 if(car.hp<=0&&state.brick){state.brick=false;brickBody.placed=false;}
}
/* Lane-following traffic: cached distance-parametrized junction curves, shared lights,
 * one reservation per intersection, following distance, exit checks, incident recovery.
 * The host alone runs this system; guests receive positions AND intentions/turn lamps.
 */
function makeRoadPath(a,b){const key='r:'+a+':'+b;if(cityPaths.has(key))return cityPaths.get(key);const A=roadPoint(a,b,CITY.entry),B=roadPoint(a,b,56-CITY.entry),path=polyPath([A,B],'road');cityPaths.set(key,path);return path;}
function polyPath(points,type){const lens=[0];for(let i=1;i<points.length;i++)lens.push(lens[i-1]+V.len(V.sub(points[i],points[i-1])));return{points,lens,len:lens[lens.length-1],type};}
function pathAt(path,d){d=clamp(d,0,path.len);let k=1;while(k<path.lens.length-1&&path.lens[k]<d)k++;const A=path.points[k-1],B=path.points[k],den=path.lens[k]-path.lens[k-1]||1,u=(d-path.lens[k-1])/den,dir=V.norm(V.sub(B,A));return{p:V.lerp(A,B,u),dir,yaw:Math.atan2(-dir[0],-dir[2])};}
function makeJunctionPath(from,at,to){const key='j:'+from+':'+at+':'+to;if(cityPaths.has(key))return cityPaths.get(key);
 const din=edgeDirection(from,at),dout=edgeDirection(at,to),A=roadPoint(from,at,56-CITY.entry),D=roadPoint(at,to,CITY.entry),cross=din[0]*dout[2]-din[2]*dout[0],dot=V.dot(din,dout);
 const control=dot>.9?6:cross>0?5.7:11.5,B=V.add(A,V.mul(din,control)),C=V.sub(D,V.mul(dout,control)),points=[];
 for(let i=0;i<=24;i++){const u=i/24,v=1-u;points.push([0,1,2].map(k=>v*v*v*A[k]+3*v*v*u*B[k]+3*v*u*u*C[k]+u*u*u*D[k]));}
 const path=polyPath(points,'junction');path.turn=dot>.9?'straight':cross>0?'right':'left';cityPaths.set(key,path);return path;
}
function trafficPosition(t){if(!t.path)return;const q=pathAt(t.path,t.progress);t.p=q.p;t.yaw=q.yaw;}
function exitClear(node,to,self){const path=makeRoadPath(node,to),first=pathAt(path,2),d=first.dir;
 for(const o of [car,...traffic]){if(o===self||o.phase==='cleared')continue;const v=V.sub(o.p,first.p),along=V.dot(v,d),side=Math.abs(v[0]*d[2]-v[2]*d[0]),len=o===car?4.2:2.1;if(along>-len-1&&along<8+len&&side<(o===car?2.9:2.4))return false;}
 return true;
}
function chooseCityExit(t,avoidBlocked=true){const n=cityNodes[t.to],candidates=n.adj.filter(id=>id!==t.from);let chosen=candidates[0]??t.from,best=-Infinity;
 for(const id of candidates){const key=roadKey(n.id,id),d=edgeDirection(n.id,id),din=edgeDirection(t.from,t.to),straight=V.dot(d,din)>.9;
  const blocked=avoidBlocked&&cityBlocked.has(key),score=(straight?.35:0)+rnd()*1.7-(blocked?5:0)+(exitClear(n.id,id,t)?1:0);
  if(score>best){best=score;chosen=id;}}
 return chosen;
}
function initializeTraffic(t,from,to,progress=0){
 if(t.claim!==undefined&&cityClaims.get(t.claim)===t.id)cityClaims.delete(t.claim);
 Object.assign(t,{from,to,next:null,progress,speed:0,cruise:6.8+(t.id%5)*.47,path:makeRoadPath(from,to),motion:'road',claim:undefined,intent:'straight',wait:'',waitAge:0,incidentAge:0,clearAge:0,targetSpeed:7.0,braking:false,hp:100,phase:'normal',burn:0,wreckAge:0,hitCooldown:0,drift:[0,0,0],spin:0,smokeClock:0,target:null});
 trafficPosition(t);t.next=chooseCityExit(t,false);t.intent=makeJunctionPath(t.from,t.to,t.next).turn;
}
function resetCityTraffic(){cityClaims.clear();cityBlocked.clear();cityAIClock=cityIncidentClock=0;cityTrafficStats={turns:0,left:0,right:0,redStops:0,yields:0,cleared:0};
 const entries=[[[0,112],[0,56],8],[[0,56],[0,0],8],[[-56,0],[0,0],3],[[56,-56],[56,0],8],[[0,-56],[0,0],4],[[56,56],[0,56],8],[[-56,56],[-56,0],3],[[-56,-56],[0,-56],6],[[112,-56],[56,-56],7],[[-112,0],[-112,-56],8],[[-112,56],[-56,56],5],[[56,112],[56,56],4],[[0,-112],[56,-112],6],[[112,56],[112,0],5]];
 traffic.forEach((t,i)=>{const e=entries[i%entries.length],a=cityNode(...e[0]),b=cityNode(...e[1]);initializeTraffic(t,a.id,b.id,e[2]);});
}
function refreshBlockedEdges(){const blocked=new Map();for(const t of traffic){if(!['damaged','burning','wreck'].includes(t.phase))continue;const q=closestCityRoad(t.p);if(q.d<6.1){const old=blocked.get(q.edge.key);if(!old||t.phase==='burning')blocked.set(q.edge.key,{id:t.id,phase:t.phase,remaining:Math.max(0,t.phase==='wreck'?22-t.wreckAge:28-(t.incidentAge||0))});}}
 cityBlocked=blocked;
}
function canEnterJunction(t){const n=cityNodes[t.to],axis=Math.abs(edgeDirection(t.from,t.to)[2])>.5?2:0;
 if(signalPhase(n,axis)!=='green')return'red';
 const owner=cityClaims.get(n.id);if(owner!==undefined&&owner!==t.id)return'yield';
 if(!exitClear(n.id,t.next,t))return'exit';
 // Player's van is not controlled by signals. NPCs still avoid entering its footprint.
 if(Math.abs(car.p[0]-n.x)<6.6&&Math.abs(car.p[2]-n.z)<6.6)return'crossing';
 return'';
}
function aheadClearance(t){const f=pathAt(t.path,t.progress).dir,look=clamp(6+t.speed*t.speed/9,7,19);let closest=Infinity,kind='queue';
 for(const o of [car,...traffic]){if(o===t||o.phase==='cleared')continue;const delta=V.sub(o.p,t.p),long=V.dot(delta,f);if(long<=0||long>look+6)continue;const lateral=Math.abs(delta[0]*f[2]-delta[2]*f[0]);
  const yaw=o.yaw||0,of=[-Math.sin(yaw),0,-Math.cos(yaw)],or=[Math.cos(yaw),0,-Math.sin(yaw)],hl=o===car?3.95:1.95,hw=o===car?1.6:1.02;
  const halfWidth=hl*Math.abs(of[0]*f[2]-of[2]*f[0])+hw*Math.abs(or[0]*f[2]-or[2]*f[0]);
  if(lateral>1.0+halfWidth+.22)continue;const halfLong=hl*Math.abs(V.dot(of,f))+hw*Math.abs(V.dot(or,f)),gap=long-halfLong-2.05-1.05;
  if(gap<closest){closest=gap;kind=['wreck','burning','damaged'].includes(o.phase)?'incident':'queue';}
 }
 // Walking couriers count as pedestrians, not as a second vehicle at the van origin.
 for(const {a,s} of activeActors()){if(s.view!=='outside')continue;const v=V.sub(a.p,t.p),long=V.dot(v,f),side=Math.abs(v[0]*f[2]-v[2]*f[0]);if(long>0&&long<look&&side<1.55&&long-3.5<closest){closest=long-3.5;kind='pedestrian';}}
 return{gap:closest,kind};
}
function thinkCityTraffic(){refreshBlockedEdges();
 for(const t of traffic){if(t.phase!=='normal')continue;
  const old=t.wait;t.wait='';const limit=DISTRICTS[districtAt(t.p[0],t.p[2])].speed/3.6;
  let target=Math.min(t.cruise,limit),remaining=t.path.len-t.progress;
  if(t.motion==='road'){
   if(t.next===null)t.next=chooseCityExit(t);
   if(t.waitAge>2.4&&remaining<15&&!exitClear(t.to,t.next,t))t.next=chooseCityExit(t);
   t.intent=makeJunctionPath(t.from,t.to,t.next).turn;
   const reason=canEnterJunction(t);if(reason){const stop=Math.sqrt(2*5.0*Math.max(0,remaining-.18));if(stop<target){target=stop;t.wait=reason;}}
   else if(t.intent!=='straight')target=Math.min(target,Math.sqrt(4.2*4.2+2*4*Math.max(0,remaining)));
  }else{target=Math.min(target,t.intent==='straight'?7.5:4.5);}
  const obstacle=aheadClearance(t),followSpeed=Number.isFinite(obstacle.gap)?Math.sqrt(2*4.0*Math.max(0,obstacle.gap)):Infinity;
  if(followSpeed<target){target=followSpeed;t.wait=obstacle.kind;}
  t.targetSpeed=target;t.braking=target<t.speed-.5;
  if(t.wait==='red'&&old!=='red')cityTrafficStats.redStops++;if(t.wait==='yield'&&old!=='yield')cityTrafficStats.yields++;
 }
}
function advanceTrafficRoute(t,dist){let remaining=dist;
 for(let iter=0;iter<3&&remaining>0;iter++){
  const left=t.path.len-t.progress;if(remaining<left){t.progress+=remaining;remaining=0;break;}
  t.progress=t.path.len;trafficPosition(t);
  if(t.motion==='road'){
   const reason=canEnterJunction(t);if(reason){t.speed=0;t.targetSpeed=0;t.wait=reason;remaining=0;break;}
   cityClaims.set(t.to,t.id);t.claim=t.to;t.path=makeJunctionPath(t.from,t.to,t.next);t.intent=t.path.turn;t.motion='junction';t.progress=0;
  }else{
   if(cityClaims.get(t.claim)===t.id)cityClaims.delete(t.claim);t.claim=undefined;
   cityTrafficStats.turns++;if(t.intent==='left')cityTrafficStats.left++;if(t.intent==='right')cityTrafficStats.right++;
   t.from=t.to;t.to=t.next;t.next=null;t.path=makeRoadPath(t.from,t.to);t.motion='road';t.progress=0;t.next=chooseCityExit(t);t.waitAge=0;
  }
  remaining=Math.max(0,remaining-left);
 }
 trafficPosition(t);
}
function clearIncident(t){if(t.claim!==undefined&&cityClaims.get(t.claim)===t.id)cityClaims.delete(t.claim);t.claim=undefined;t.phase='cleared';t.clearAge=0;t.speed=0;t.drift=[0,0,0];cityTrafficStats.cleared++;refreshBlockedEdges();if(Math.hypot(car.p[0]-t.p[0],car.p[2]-t.p[2])<50)showHint('道路救援已清除事故车，车流开始恢复。',3);}
function respawnCityTraffic(t){const start=t.id*5+Math.floor(state.time);
 for(let k=0;k<cityEdges.length;k++){const e=cityEdges[(start+k)%cityEdges.length],a=(t.id%2?e.a:e.b),b=(a===e.a?e.b:e.a),p=roadPoint(a,b,15);
  if(Math.hypot(p[0]-car.p[0],p[2]-car.p[2])<45||Math.hypot(p[0]-eye[0],p[2]-eye[2])<60)continue;
  if(traffic.some(o=>o!==t&&o.phase!=='cleared'&&Math.hypot(o.p[0]-p[0],o.p[2]-p[2])<9))continue;
  initializeTraffic(t,a,b,15-CITY.entry);return true;
 }return false;
}
function stepTraffic(dt){cityAIClock-=dt;if(cityAIClock<=0){cityAIClock=.10;thinkCityTraffic();}
 for(const t of traffic){t.hitCooldown=Math.max(0,t.hitCooldown-dt);
  if(t.phase==='cleared'){t.clearAge+=dt;if(t.clearAge>7){t.clearAge=6.5;respawnCityTraffic(t);}continue;}
  if(t.phase==='normal'){
   if(t.speed<t.targetSpeed)t.speed=Math.min(t.targetSpeed,t.speed+3.2*dt);else t.speed=Math.max(t.targetSpeed,t.speed-8.5*dt);
   t.waitAge=t.speed<.35&&t.wait?t.waitAge+dt:0;
   advanceTrafficRoute(t,t.speed*dt);
  }else{
   if(t.claim!==undefined&&cityClaims.get(t.claim)===t.id&&Math.hypot(t.p[0]-cityNodes[t.claim].x,t.p[2]-cityNodes[t.claim].z)>13){cityClaims.delete(t.claim);t.claim=undefined;}
   t.incidentAge=(t.incidentAge||0)+dt;t.speed=0;t.p=V.add(t.p,V.mul(t.drift,dt));t.p[1]=.1;t.drift=V.mul(t.drift,Math.exp(-1.9*dt));t.yaw=wrapAngle(t.yaw+t.spin*dt);t.spin*=Math.exp(-2.1*dt);t.p[0]=clamp(t.p[0],-CITY.limit+3,CITY.limit-3);t.p[2]=clamp(t.p[2],-CITY.limit+3,CITY.limit-3);
  }
  if(t.phase==='damaged'||t.phase==='burning'){t.smokeClock+=dt;if(t.smokeClock>(quality==='low'?.30:.18)&&V.len(V.sub(t.p,eye))<110){t.smokeClock=0;addEffect(t.phase==='burning'?darkSmokeMesh:smokeMesh,V.add(t.p,[0,1.55,-.4]),[(rnd()-.5)*.5,1.0+rnd(),(rnd()-.5)*.5],2.4,.22,.8,.70);}}
  if(t.phase==='burning'){t.burn-=dt;if(t.burn<=0)explode(t);}
  if(t.phase==='wreck'){t.wreckAge+=dt;if(t.wreckAge<7){t.smokeClock+=dt;if(t.smokeClock>.35){t.smokeClock=0;addEffect(smokeMesh,V.add(t.p,[0,.9,0]),[.15,1.1,.1],2,.28,.95,.55);}}if(t.wreckAge>=22)clearIncident(t);}
  else if(t.phase==='damaged'&&t.incidentAge>=28)clearIncident(t);
 }
 // Collisions between moving/damaged traffic. Stationary queues never accumulate damage.
 for(let i=0;i<traffic.length;i++)for(let j=i+1;j<traffic.length;j++){
  const a=traffic[i],b=traffic[j];if(a.phase==='cleared'||b.phase==='cleared'||a.hitCooldown>0||b.hitCooldown>0)continue;
  const dx=a.p[0]-b.p[0],dz=a.p[2]-b.p[2];if(dx*dx+dz*dz>19)continue;
  const A=[Math.cos(a.yaw),0,-Math.sin(a.yaw)],AF=[-Math.sin(a.yaw),0,-Math.cos(a.yaw)],B=[Math.cos(b.yaw),0,-Math.sin(b.yaw)],BF=[-Math.sin(b.yaw),0,-Math.cos(b.yaw)],delta=[dx,0,dz];let depth=Infinity,normal=null;
  for(const ax of [A,AF,B,BF]){const over=1.02*(Math.abs(V.dot(A,ax))+Math.abs(V.dot(B,ax)))+1.90*(Math.abs(V.dot(AF,ax))+Math.abs(V.dot(BF,ax)))-Math.abs(V.dot(delta,ax));if(over<=0){depth=-1;break;}if(over<depth){depth=over;normal=V.mul(ax,V.dot(delta,ax)<0?-1:1);}}
  if(depth<=0)continue;
  const av=a.phase==='normal'?V.mul(AF,a.speed):a.drift,bv=b.phase==='normal'?V.mul(BF,b.speed):b.drift,closing=-V.dot(V.sub(av,bv),normal);
  if(closing>3.2){a.hitCooldown=b.hitCooldown=.8;damageTraffic(a,closing*closing*1.9,V.mul(normal,closing*.32));damageTraffic(b,closing*closing*1.9,V.mul(normal,-closing*.32));if(a.phase==='normal')a.phase='damaged';if(b.phase==='normal')b.phase='damaged';}
 }
}


function stepCargo(dt){
 const acc=localVelocity({yaw:car.yaw},car.accel),omega=car.yawRate;
 for(const d of doors){d.vel+=((d.target-d.angle)*30-d.vel*8.8)*dt;if(d.target>0)d.vel+=Math.sin(state.time*4.5+d.side)*Math.abs(car.speed)*.012*dt;d.angle=clamp(d.angle+d.vel*dt,0,2.65);if(d.angle===0&&d.vel<0)d.vel=0;}
 for(let i=cargo.length-1;i>=0;i--){const c=cargo[i];c.age+=dt;
  c.v[0]+=clamp(-acc[0]-2*omega*c.v[2]+omega*omega*c.p[0],-32,32)*dt;
  c.v[2]+=clamp(-acc[2]+2*omega*c.v[0]+omega*omega*c.p[2],-32,32)*dt;c.v[1]-=12*dt;
  c.p=V.add(c.p,V.mul(c.v,dt));let contact=false;
  if(c.p[0]<-CAB.half+c.r){c.p[0]=-CAB.half+c.r;if(c.v[0]<0)c.v[0]*=-.22;contact=true;}
  if(c.p[0]>CAB.half-c.r){c.p[0]=CAB.half-c.r;if(c.v[0]>0)c.v[0]*=-.22;contact=true;}
  if(c.p[2]<CAB.front+c.r){c.p[2]=CAB.front+c.r;if(c.v[2]<0)c.v[2]*=-.23;contact=true;}
  if(c.p[1]>CAB.roof-c.r){c.p[1]=CAB.roof-c.r;c.v[1]=-Math.abs(c.v[1])*.25;contact=true;}
  if(c.p[1]<CAB.floor+c.r){c.p[1]=CAB.floor+c.r;if(c.v[1]<-1.8){c.v[1]*=-.20;contact=true;}else c.v[1]=0;
   for(const axis of [0,2]){const f=(3.5+upgrades.mat*.85)*dt;c.v[axis]=Math.sign(c.v[axis])*Math.max(0,Math.abs(c.v[axis])-f);}
   c.rot[0]=mix(c.rot[0],0,1-Math.exp(-8*dt));c.rot[2]=mix(c.rot[2],0,1-Math.exp(-8*dt));c.spin=V.mul(c.spin,Math.exp(-8*dt));
  }
  if(c.p[2]>CAB.rear-c.r&&!rearPass(c.p[0],c.r)){c.p[2]=CAB.rear-c.r;if(c.v[2]>0)c.v[2]*=-.30;contact=true;if(c.thrown&&c.age<.3)showHint('后门挡住了包裹。先开门，再从后沿扔出去。',3);}
  if(c.p[2]>CAB.rear+c.r*.65&&rearPass(c.p[0],c.r)){cargo.splice(i,1);releaseToWorld(c);continue;}
  c.rot=V.add(c.rot,V.mul(c.spin,dt));
  if(contact&&c.age-c.lastHit>.20&&V.len(c.v)>1.4){tone(125,.055,'triangle',.06);c.lastHit=c.age;}
 }
 // Light-weight AABB pair contacts keep a real stack, without an external engine.
 for(let iter=0;iter<2;iter++)for(let i=0;i<cargo.length;i++)for(let j=i+1;j<cargo.length;j++){
  const a=cargo[i],b=cargo[j],delta=V.sub(a.p,b.p),sum=a.r+b.r,over=delta.map(v=>sum-Math.abs(v));if(over.some(v=>v<=0))continue;
  let axis=over.indexOf(Math.min(...over));const sign=Math.sign(delta[axis]||.01),invA=1/a.mass,invB=1/b.mass,weight=invA+invB,depth=over[axis]+.001;
  a.p[axis]+=sign*depth*invA/weight;b.p[axis]-=sign*depth*invB/weight;
  const rel=(a.v[axis]-b.v[axis])*sign;if(rel<0){const impulse=-(1.10)*rel/weight;a.v[axis]+=sign*impulse*invA;b.v[axis]-=sign*impulse*invB;}
  if(axis===1){a.v[0]*=.997;a.v[2]*=.997;b.v[0]*=.997;b.v[2]*=.997;}
 }
 // Pair correction never pushes a box through a closed hull surface.
 for(const c of cargo){c.p[0]=clamp(c.p[0],-CAB.half+c.r,CAB.half-c.r);c.p[1]=clamp(c.p[1],CAB.floor+c.r,CAB.roof-c.r);c.p[2]=Math.max(CAB.front+c.r,c.p[2]);if(!rearPass(c.p[0],c.r))c.p[2]=Math.min(CAB.rear-c.r,c.p[2]);}
 if(!brickBody.placed){brickBody.v[1]-=12*dt;brickBody.p=V.add(brickBody.p,V.mul(brickBody.v,dt));if(brickBody.p[1]<.98){brickBody.p[1]=.98;brickBody.v[1]=Math.abs(brickBody.v[1])*.16;brickBody.v[0]*=.95;brickBody.v[2]*=.95;}brickBody.p[0]=clamp(brickBody.p[0],-1.23,1.23);brickBody.p[2]=clamp(brickBody.p[2],-3.33,-1.92);brickBody.rot[1]+=V.len(brickBody.v)*dt*.13;}
}
function stepPlayer(dt){if(state.view!=='cargo'||state.time<state.switchUntil)return;const k=inputs.keys;
 if(k.has('ArrowLeft')){player.yaw+=1.7*dt;player.aimGate=null;}if(k.has('ArrowRight')){player.yaw-=1.7*dt;player.aimGate=null;}if(k.has('ArrowUp')){player.pitch=clamp(player.pitch+1.2*dt,-1.28,1.02);player.aimGate=null;}if(k.has('ArrowDown')){player.pitch=clamp(player.pitch-1.2*dt,-1.28,1.02);player.aimGate=null;}
 let forward=(k.has('KeyW')||inputs.forward.size?1:0)-(k.has('KeyS')||inputs.back.size?1:0)-inputs.stickY,right=(k.has('KeyD')||inputs.walkRight.size?1:0)-(k.has('KeyA')||inputs.walkLeft.size?1:0)+inputs.stickX;const l=Math.hypot(forward,right);if(l>1){forward/=l;right/=l;}
 const dx=(-Math.sin(player.yaw)*forward+Math.cos(player.yaw)*right)*2.5*dt,dz=(-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*right)*2.5*dt;
 player.p[0]=clamp(player.p[0]+dx,-1.12,1.12);player.p[2]=clamp(player.p[2]+dz,-1.21,3.35);if(l>.05)player.walkPhase+=dt*8;
 // The player is kept aboard; loose boxes get a small sideways push on contact.
 if(l>.05&&net.mode!=='guest')for(const c of cargo){const x=c.p[0]-player.p[0],z=c.p[2]-player.p[2],d=Math.hypot(x,z),r=c.r+.18;if(d<r&&d>.001&&c.p[1]<2.1){c.v[0]+=x/d*(r-d)*9*dt;c.v[2]+=z/d*(r-d)*9*dt;}}
 if(player.aimGate){if(player.aimHouse.done){player.aimGate=player.aimHouse=null;}else aimCameraAt(player.aimGate.center);}
}
function stepParcels(dt){for(let i=packages.length-1;i>=0;i--){const p=packages[i],old=p.p.slice();stepWorldPackage(p,dt);
 // Parcels also hit traffic. A heavy box can finish an already-damaged car.
 if(!p.delivered)for(const t of traffic){if(t.phase==='wreck'||t.phase==='cleared'||p.hitNpc===t.id&&p.age-p.hitNpcAt<.3)continue;const h={x:t.p[0],z:t.p[2],yaw:t.yaw},a=houseLocal(h,old),b=houseLocal(h,p.p);if(Math.abs(a[0])>6||Math.abs(a[2])>6)continue;const hit=segmentBox(a,b,[-1-p.r,.27-p.r,-1.93-p.r],[1+p.r,1.93+p.r,1.93+p.r]);if(hit){const s=V.len(p.v);damageTraffic(t,Math.min(75,p.mass*s*.68),V.mul(p.v,.07));p.p=houseWorld(h,V.lerp(a,b,Math.max(0,hit.t-.01)));p.v=V.mul(p.v,-.26);p.v[1]=Math.abs(p.v[1])+1;p.hitNpc=t.id;p.hitNpcAt=p.age;tone(110,.09,'triangle',.14);break;}}
 if(p.delivered&&p.age>10||!p.order&&p.age>35){packages.splice(i,1);}else if(p.p[1]<-20||Math.abs(p.p[0])>CITY.limit||Math.abs(p.p[2])>CITY.limit){p.p=[clamp(p.p[0],-CITY.limit+3,CITY.limit-3),p.r+.15,clamp(p.p[2],-CITY.limit+3,CITY.limit-3)];p.v=[0,0,0];p.pending=null;}
 }
}
function stepEffects(dt){for(let i=debris.length-1;i>=0;i--){const d=debris[i];d.age+=dt;d.v[1]-=11*dt;d.p=V.add(d.p,V.mul(d.v,dt));d.rot=V.add(d.rot,V.mul(d.spin,dt));const floor=d.mesh===doorMesh?.42:.2;if(d.p[1]<floor){d.p[1]=floor;d.v[1]=Math.abs(d.v[1])*.21;d.v[0]*=.92;d.v[2]*=.92;d.spin=V.mul(d.spin,.92);}if(d.age>=d.life)debris.splice(i,1);}
 for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.age+=dt;e.p=V.add(e.p,V.mul(e.v,dt));if(e.age>=e.life)effects.splice(i,1);}
}
function step(dt){state.time+=dt;state.cooldown=Math.max(0,state.cooldown-dt);state.hitCooldown=Math.max(0,state.hitCooldown-dt);state.shake=Math.max(0,state.shake-dt*.7);if(state.charging)state.charge=Math.min(1,state.charge+dt*.9);stepCar(dt);stepTraffic(dt);stepCargo(dt);stepPlayer(dt);stepParcels(dt);stepEffects(dt);}

function actualDPR(){const native=devicePixelRatio||1;let d=quality==='low'?1:quality==='high'?Math.min(Math.max(native,1.5),2.5):Math.min(Math.max(native,1.25),adaptiveScale);const maxPixels=coarse()?(networked()?2700000:3300000):6500000;if(coarse()&&networked()&&quality==='auto')d=Math.min(d,1.75);d=Math.min(d,Math.sqrt(maxPixels/Math.max(1,width*height)),maxViewport[0]/width,maxViewport[1]/height);return Math.max(.65,d);}
function updateQuality(dt){if(quality!=='auto'||state.mode!=='playing')return;qualityWait+=dt;if(qualityWait<3)return;fpsEMA=mix(fpsEMA,1/Math.max(.005,dt),.03);if(fpsEMA<39){slowTime+=dt;fastTime=0;}else if(fpsEMA>56){fastTime+=dt;slowTime=0;}else{slowTime=Math.max(0,slowTime-dt);fastTime=0;}if(slowTime>3&&adaptiveScale>1.25){adaptiveScale=Math.max(1.25,adaptiveScale-.25);slowTime=0;qualityWait=0;}if(fastTime>16&&adaptiveScale<2){adaptiveScale=Math.min(2,adaptiveScale+.25);fastTime=0;qualityWait=0;}}
function syncButtons(){
 $('hud').dataset.view=state.view;$('driveUI').classList.toggle('hidden',state.view!=='drive');$('cargoUI').classList.toggle('hidden',state.view!=='cargo');$('viewTag').textContent=state.view==='drive'?'驾驶':'货箱 · 第一人称';
 $('brickBtn').classList.toggle('active',state.brick);$('brickLabel').textContent=state.brick?'取砖':'放砖';
 const held=!!player.held;$('throwBtn').classList.toggle('hidden',!held);$('dropBtn').classList.toggle('hidden',!held);$('powerTrack').classList.toggle('hidden',!held);
 $('qualityBtn').textContent='画质：'+({auto:'自动高清',high:'高清锁定',low:'省电'}[quality]);$('assistBtn').textContent='辅助瞄准：'+(assist?'开':'关');$('soundBtn').textContent='音效：'+(soundOn?'开':'关');$('motionBtn').textContent='镜头晃动：'+(motion?'轻微':'关闭');$('bestMenu').textContent='最高收入 $'+best;
 $('keyHelp').textContent=state.view==='drive'?'WASD 驾驶　 B 放砖　 V 进入货箱　拖动画面环顾　 Esc 暂停':'WASD 走动　 右键拖动观察　 E 互动　 G 后门　 F 瞄准　 左键 / 空格投掷　 R 放下　 V 回驾驶位';
 if(audioMaster&&audio)audioMaster.gain.setTargetAtTime(soundOn?.16:0,audio.currentTime,.04);
 for(let i=0;i<2;i++){const d=doors[i],el=$(i===0?'leftDoorBtn':'rightDoorBtn');el.classList.toggle('open',d.target>0);el.textContent=(d.target>0?'关':'开')+(i===0?'左':'右');el.setAttribute('aria-label',(d.target>0?'关闭':'打开')+(i===0?'左':'右')+'后门');}
 if(state.mode==='paused'){$('pauseSummary').textContent='已送 '+state.delivered+' / '+TOTAL+' 单 · 货物 '+physicalStock()+' 件 · 车辆耐久 '+Math.round(car.hp)+'%';$('resolutionLabel').textContent='3D 实际渲染 '+world.width+' × '+world.height+' · '+actualDPR().toFixed(2)+'× 采样 · UI 独立清晰渲染';}
}
function nextIntersection(){const f=carForward();let distance=Infinity;for(const axis of [0,2]){if(Math.abs(f[axis])<.2)continue;for(const q of [-56,0,56]){const t=(q-car.p[axis])/f[axis];if(t<3||t>75)continue;const other=axis===0?2:0,p=car.p[other]+t*f[other];if(roadAxis(p)<9)distance=Math.min(distance,t);}}return distance;}
function updateHUD(){
 $('speed').textContent=Math.round(Math.abs(car.speed)*3.6);$('score').textContent=state.score;$('count').textContent=state.delivered;$('clock').textContent=formatTime(state.time);$('stockChip').textContent='货物 '+physicalStock();$('autoChip').textContent=state.brick?'砖头压油门':state.view==='cargo'?'无人掌舵':'手动油门';$('autoChip').classList.toggle('on',state.brick);const open=doors.some(d=>d.angle>.22||d.target>0);$('doorChip').textContent=open?'后门开着':'后门已关';$('doorChip').classList.toggle('warn',open);
 $('healthFill').style.width=car.hp+'%';$('healthFill').style.background=car.hp<32?'#f39a70':'#afd5b5';$('powerFill').style.width=(state.charging?state.charge*100:0)+'%';
 const h=nextHouse();if(h){$('address').textContent=h.address;$('distance').textContent=Math.round(Math.hypot(h.x-car.p[0],h.z-car.p[2]))+' m';$('nextNum').textContent=h.num;const d=localVelocity({yaw:car.yaw},V.sub([h.x,0,h.z],car.p)),a=Math.atan2(d[0],-d[2]);$('routeArrow').textContent=['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(a/(Math.PI/4))+8)%8];}
 if(state.toastUntil<=state.time)$('toast').classList.remove('show');if(state.hintUntil<=state.time)$('hint').classList.add('hidden');
 const nearFire=traffic.find(t=>t.phase==='burning'&&V.len(V.sub(car.p,t.p))<22);let risk='';
 if(car.hp<=0)risk='车辆已熄火 · 暂停菜单可救援';else if(nearFire)risk='起火车辆 · '+Math.max(0,nearFire.burn).toFixed(1)+' 秒后爆炸';else if(state.view==='cargo'&&Math.abs(car.speed)>2){const dist=nextIntersection();if(dist<62)risk='路口约 '+(dist/Math.max(1,Math.abs(car.speed))).toFixed(1)+' 秒 · 无人掌舵';}else if(state.view==='drive'&&open&&Math.abs(car.speed)>3)risk='后门未关 · 正在冒险驾驶';
 $('risk').textContent=risk;$('risk').classList.toggle('hidden',!risk);
 if(state.view==='cargo'){
  const focus=collectFocus();player.focus=focus;$('rearControls').classList.toggle('hidden',player.p[2]<1.45);$('assistAimBtn').classList.toggle('hidden',!player.held||player.p[2]<2.25);
  $('interactBtn').classList.toggle('hidden',!!player.held&&focus?.type!=='cab');$('interactBtn').disabled=!focus;
  let text='靠近箱子',icon='✋',label='';if(focus?.type==='package'){text='拿起';label=parcelLabel(focus.item)+' · 拿起';icon='📦';}else if(focus?.type==='door'){text=doors[focus.index].target?'关门':'开门';label=(focus.index===0?'左':'右')+'后门 · '+text;icon='▥';}else if(focus?.type==='cab'){text='回驾驶位';label='驾驶位 · 接管车辆';icon='↶';}
  if(player.held){label=player.aimGate?(player.aimGate.type==='door'?'大门':'窗户')+' · '+(state.charging?'蓄力 '+Math.round(state.charge*100)+'%':'按住，再松手'):(state.charging?'蓄力 '+Math.round(state.charge*100)+'%':player.p[2]>2.8?'站稳后沿 · 按住投掷':parcelLabel(player.held)+' · 走到后门');}
  $('interactText').textContent=text;$('interactIcon').textContent=icon;$('focusLabel').textContent=label;$('crosshair').classList.toggle('locked',!!player.aimGate);
 }
 $('vignette').style.boxShadow=state.hitCooldown>.36&&motion?'inset 0 0 70px #d5885526':'none';
}
function drawMap(){const c=mapCtx,w=220;c.clearRect(0,0,w,w);c.fillStyle='#25434a';c.fillRect(0,0,w,w);const sc=.87,px=x=>110+x*sc,pz=z=>110+z*sc;c.fillStyle='#627d80';for(const q of [-56,0,56]){c.fillRect(px(q)-4.6,10,9.2,200);c.fillRect(10,pz(q)-4.6,200,9.2);}for(const h of deliverable){c.fillStyle=h.done?'#8ec9a5':h===nextHouse()?'#ffd15b':'#a8bdb2';c.beginPath();c.arc(px(h.x),pz(h.z),h===nextHouse()?5.5:3.1,0,TAU);c.fill();}for(const t of traffic){if(t.phase==='burning'||t.phase==='wreck'){c.fillStyle=t.phase==='burning'?'#f4a367':'#789095';c.fillRect(px(t.p[0])-2,pz(t.p[2])-2,4,4);}}c.save();c.translate(px(car.p[0]),pz(car.p[2]));c.rotate(-car.yaw);c.beginPath();c.moveTo(0,-8);c.lineTo(5.5,6);c.lineTo(0,3.2);c.lineTo(-5.5,6);c.closePath();c.fillStyle='#fff3ce';c.fill();c.lineWidth=1.2;c.strokeStyle='#22464a';c.stroke();c.restore();}
function label(text,x,y,color='#ffda77',size=11){ctx.font='700 '+size+'px Arial,"PingFang SC","Microsoft YaHei",sans-serif';const w=ctx.measureText(text).width+16;ctx.fillStyle='#17353ce8';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x-w/2,y-12,w,24,6);else ctx.rect(x-w/2,y-12,w,24);ctx.fill();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);}
function cargoCanSee(point){if(state.view!=='cargo')return true;const e=cameraLocal(),t=vehicleToLocal(point),delta=V.sub(t,e);if(e[2]>CAB.rear+.15){if(delta[2]>=0)return true;const u=(CAB.rear-e[2])/delta[2];const x=e[0]+delta[0]*u;return Math.abs(x)>CAB.half||rearPass(x,.1);}
 if(delta[2]<=0)return false;const u=(CAB.rear-e[2])/delta[2];if(u<0||u>1)return false;const q=V.lerp(e,t,u);return Math.abs(q[0])<CAB.half&&q[1]>CAB.floor&&q[1]<CAB.roof&&rearPass(q[0],.05);}
function drawOverlay(){const dpr=Math.min(devicePixelRatio||1,2.5),W=Math.round(width*dpr),H=Math.round(height*dpr);if(overlay.width!==W||overlay.height!==H){overlay.width=W;overlay.height=H;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);if(state.mode==='menu')return;
 const active=nextHouse();if(active){const p=[active.x,8.6,active.z],s=renderer.project(p);if(s&&cargoCanSee(p)&&s.x>50&&s.x<width-50&&s.y>145&&s.y<height-165&&V.len(V.sub(p,car.p))<95)label('↓ '+active.num+' 号 · 下一单',s.x,s.y,'#ffe18b',coarse()?10:12);}
 if(state.view==='cargo'&&player.aimGate&&cargoCanSee(player.aimGate.center)){const p=renderer.project(player.aimGate.center);if(p&&p.x>10&&p.x<width-10&&p.y>120&&p.y<height-145){ctx.strokeStyle='#ffe59a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,21,0,TAU);ctx.stroke();}}
 for(const t of traffic){if(t.phase!=='burning')continue;const p=renderer.project(V.add(t.p,[0,3.0,0]));if(p&&cargoCanSee(t.p)&&p.x>45&&p.x<width-45&&p.y>150&&p.y<height-120)label('⚠ '+t.burn.toFixed(1)+' s',p.x,p.y,'#ffc98e',11);}
}
function updateCamera(dt){
 if(state.mode==='menu'){const t=motion?performance.now()*.00018:0,target=[3.2,1.65,68],desired=[18+Math.sin(t)*2.2,8.8,88+Math.cos(t)*1.8];eye=V.lerp(eye,desired,1-Math.exp(-dt*3.2));at=V.lerp(at,target,1-Math.exp(-dt*3.2));return;}
 let desired,target;
 if(state.view==='cargo'){desired=vehicleToWorld(cameraLocal());if(motion){desired[1]+=Math.sin(player.walkPhase)*.012;}target=V.add(desired,V.mul(viewDirection(),10));}
 else{driveOrbit=mix(driveOrbit,driveOrbitGoal,1-Math.exp(-dt*7));const yaw=car.yaw+driveOrbit,f=[-Math.sin(yaw),0,-Math.cos(yaw)],portrait=height>width;desired=V.add(car.p,V.add(V.mul(f,portrait?-17.8:-15.1),[0,portrait?10.9:8.4,0]));target=V.add(car.p,V.add(V.mul(f,6.0),[0,1.8,0]));if(!cameraBlend){desired=V.lerp(eye,desired,1-Math.exp(-dt*8));target=V.lerp(at,target,1-Math.exp(-dt*8));}}
 if(cameraBlend>0&&blendEye){cameraBlend=Math.max(0,cameraBlend-dt*2.8);const t=1-cameraBlend,ease=t*t*(3-2*t);eye=V.lerp(blendEye,desired,ease);at=V.lerp(blendAt,target,ease);}else{eye=desired;at=target;}
}
function draw3D(){/* Safari/WebGL hotfix: gameplay must not inherit preview/transparent-pass GL state. */const gl=renderer.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.colorMask(true,true,true,true);gl.depthMask(true);gl.disable(gl.SCISSOR_TEST);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.65,.82,.87,1);const shake=motion&&state.mode==='playing'?[Math.sin(state.time*48)*state.shake,Math.cos(state.time*63)*state.shake,0]:[0,0,0];const fov=(state.view==='cargo'?height>width?79:77:height>width?69:58)*Math.PI/180;
 const frameDpr=state.mode==='menu'&&coarse()?Math.min(actualDPR(),1.45):actualDPR();renderer.begin(V.add(eye,shake),V.add(at,shake),fov,width,height,frameDpr);drawCityWorld();
 const active=nextHouse();for(const h of houses){if(V.len(V.sub([h.x,0,h.z],eye))>175)continue;for(const g of h.gates){const m=M.model(houseWorld(h,[g.x,g.y,4.34]),[0,h.yaw,0]),gs=[g.w/(g.type==='door'?2.05:2.4),g.h/(g.type==='door'?3.15:2.15),1];if(!g.broken)renderer.draw(g.type==='door'?doorMesh:glassMesh,scaled(m,gs));if(h===active&&state.mode!=='menu')renderer.draw(ringMeshes[g.type],scaled(M.model(houseWorld(h,[g.x,g.y,4.52]),[0,h.yaw,0]),gs));}}
 drawCitySignals();
 renderer.draw(vanShadow,M.model([car.p[0],0,car.p[2]],[0,car.yaw,0]),.40);
 const vanM=M.model(car.p,[0,car.yaw,state.view==='cargo'?0:car.roll]);renderer.draw(vanMesh,vanM);
 for(const x of [-1.58,1.58])for(const z of [-2.60,2.38])renderer.draw(wheelMesh,M.multiply(vanM,M.model([x,.5,z],[car.wheelAngle, z<0?car.steer*.28:0,0])));
 doors.forEach((d,i)=>renderer.draw(rearDoorMeshes[i],M.multiply(vanM,M.model([d.side*1.48,0,3.48],[0,d.side*d.angle,0]))));
 renderer.draw(brickMesh,M.multiply(vanM,M.model(brickBody.p,brickBody.rot)));
 for(const c of cargo)drawTaggedParcel(c,M.multiply(vanM,M.model(c.p,c.rot)));
 drawPlayers();renderer.draw(windshieldMesh,vanM,.35);
 for(const t of traffic){if(t.phase==='cleared')continue;drawTrafficLamps(t);if(V.len(V.sub(t.p,eye))>150)continue;renderer.draw(t.phase==='wreck'?wreckMesh:t.mesh,M.model(t.p,[0,t.yaw,0]));if(t.phase==='burning'){for(let i=0;i<3;i++){const scale=.65+.20*Math.sin(state.time*10+i*2),p=V.add(t.p,[(i-1)*.45,1.25+i*.23,-.5]);renderer.draw(fireMeshes[i],scaled(M.model(p,[0,state.time*2,0]),[scale,scale*1.7,scale]));}}}
 if(active&&state.mode!=='menu')renderer.draw(beaconMesh,M.model([active.x,9.25+(motion?Math.sin(state.time*2.8)*.2:0),active.z],[Math.PI,Math.PI/4,0]));
 for(const p of packages)drawTaggedParcel(p,M.model(p.p,p.rot));
 for(const d of debris)renderer.draw(d.mesh,M.model(d.p,d.rot),clamp((d.life-d.age)*1.6,0,1));
 renderer.gl.depthMask(false);const sorted=effects.slice().sort((a,b)=>V.len(V.sub(b.p,eye))-V.len(V.sub(a.p,eye)));for(const e of sorted){const t=e.age/e.life,scale=mix(e.start,e.end,t);renderer.draw(e.mesh,scaled(M.model(e.p,e.rot),scale),e.alpha*Math.pow(1-t,.8));}renderer.gl.depthMask(true);
 if(state.mode==='playing'&&state.view!=='drive'&&player.held){const s=shotSolution();if(state.view==='outside'||player.p[2]>2.3&&doors.some(d=>d.angle>1.1)){for(let i=1;i<=24;i++){const t=s.flight*i/24,pos=V.add(s.origin,V.add(V.mul(s.v,t),[0,-6*t*t,0]));if(pos[1]<.15)break;renderer.draw(dotMesh,scaled(M.model(pos),.6));}}
  // First-person view model is a presentation layer; release physics still starts in the hull.
  const f=viewDirection(),r=V.norm(V.cross(f,[0,1,0])),up=V.cross(r,f),bob=motion?Math.sin(player.walkPhase)*.010:0,portrait=height>width,fpScale=Math.min(portrait?.62:.88,(portrait?.15:.22)/parcelType(player.held.kind).r);
  const p=V.add(eye,V.add(V.mul(f,.95-(state.charging?state.charge*.12:0)),V.add(V.mul(r,portrait?.18:.30),V.mul(up,(portrait?-.37:-.33)+bob+(state.charging?state.charge*.09:0)))));
  renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT);drawTaggedParcel(player.held,scaled(M.model(p,[player.pitch*.38,(state.view==='outside'?0:car.yaw)+player.yaw+.08,-.08]),fpScale));
  for(const sign of [-1,1]){const arm=V.add(p,V.add(V.mul(r,sign*parcelType(player.held.kind).r*fpScale),V.add(V.mul(up,-.14),V.mul(f,-.13))));renderer.draw(fpArmMeshes[player.id===1?1:0],scaled(M.model(arm,[player.pitch,(state.view==='outside'?0:car.yaw)+player.yaw,sign*-.08]),portrait?.70:.85));}
 }
 drawEmptyHands();drawOverlay();
}
