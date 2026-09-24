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
