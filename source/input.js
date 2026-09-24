// Contextual buttons. New UI stays absent until needed, without adding a full panel to play.
$('ordersBtn').addEventListener('click',()=>{$('manifest').classList.contains('hidden')?openOrders():closeOrders();});
$('closeOrdersBtn').addEventListener('click',closeOrders);$('boardBtn').addEventListener('click',mobility);
window.addEventListener('keydown',e=>{
 if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.repeat)return;
 if(e.code==='KeyM'){e.preventDefault();$('manifest').classList.contains('hidden')?openOrders():closeOrders();}
 if(e.code==='Escape')closeOrders();
});
buildManifest();
// QA-only state fixtures for deterministic gameplay and real RTCDataChannel checks.
function extendV06Tests(){if(!window.__deliveryTest)return;Object.assign(window.__deliveryTest,{
 v06:()=>({version:'0.6.0',orders:deliverable.map(h=>({num:h.num,kind:h.kind,done:h.done,status:getOrderStatus(h)})),held:player.held?packBox(player.held):null,inventory:inventory().map(p=>({id:p.id,order:p.order,delivered:!!p.delivered,integrity:p.integrity})),fault:car.fault||'',repair:player.repair,selectedOrder:state.selectedOrder,recovered:state.recovered,repairs:state.repairs,wrong:state.wrong,credits,upgrades:{...upgrades}}),
 outsideAt:(x,z,yaw=0,pitch=-.4)=>{state.view='outside';player.p=[x,WALK_EYE,z];player.yaw=yaw;player.pitch=pitch;player.aimGate=player.aimHouse=null;state.switchUntil=0;player.repair=null;updateCamera(.1);syncButtons();updateHUD();},
 fault:(hp=40,type='tyre')=>{car.hp=clamp(hp,0,100);car.fault=type;},
 selectOrder,mobility,openOrders,closeOrders,
 fixtureParcel:(order,pos,where='world')=>{const h=orderHouse(order);if(!h)throw Error('Unknown order');let p=null;
  for(const array of [cargo,packages]){const i=array.findIndex(p=>p.order===order);if(i>=0)p=array.splice(i,1)[0];}
  if(player.held?.order===order){p=player.held;player.held=null;}if(remoteReady()&&net.remoteActor.held?.order===order){p=net.remoteActor.held;net.remoteActor.held=null;}
  p=p||makeCargo(h.kind,pos);p.order=order;p.p=pos.slice();p.v=[0,0,0];p.pending=null;p.thrown=false;p.delivered=false;p.age=0;
  if(where==='held')player.held=p;else (where==='cargo'?cargo:packages).push(p);syncButtons();return p.id;
 },
 parcelVelocity:(order,v)=>{const p=packages.find(p=>p.order===order);if(!p)throw Error('No world parcel');p.v=v.slice();p.thrown=true;},
 remoteOutside:(x,z,yaw=0,pitch=-.4)=>{if(!remoteReady())throw Error('Host required');inRemote(()=>{state.view='outside';player.p=[x,WALK_EYE,z];player.yaw=yaw;player.pitch=pitch;state.switchUntil=0;player.repair=null;});netSend(netSnapshot());},
 forceTime:t=>{state.time=t;},clearTraffic:()=>{for(const t of traffic){t.phase='damaged';t.p=[-103,.1,-95+t.id*4];t.drift=[0,0,0];t.hp=100;}},
 setCredits:n=>{credits=clamp(n,0,99999999);},buyUpgrade,
});}

/* Shared city navigation / V0.7 overlays. Purely cosmetic routes never steer the van.
 * Selecting a job still uses the V0.6 host-authoritative selectOrder action.
 */
const v07={resetGame,updateHUD,syncButtons,drawOverlay,updateCamera,service,stopNetwork,openOrders,closeOrders};
let routeCache=null,routeClock=-1,cityMapClock=-1,citySelected=null,cityFilter='all',cityMapFrom='menu';
const turnLamp=renderer.mesh(new MeshBuilder().box(.25,.13,.065,'#ffd17b'));
const brakeLamp=renderer.mesh(new MeshBuilder().box(.34,.15,.06,'#fa765f'));
const cityCone=renderer.mesh(new MeshBuilder().cylinder(.23,.64,5,'#e9b768',[0,.32,0],[0,0,0],.06).box(.56,.04,.56,'#55616a',[0,.03,0]));
function drawTrafficLamps(t){if(t.phase==='cleared'||V.len(V.sub(t.p,eye))>76)return;const m=M.model(t.p,[0,t.yaw,0]);
 if(t.braking||t.phase==='normal'&&t.speed<.3)for(const s of [-1,1])renderer.draw(brakeLamp,M.multiply(m,M.model([s*.67,.93,1.92])));
 const blink=Math.floor(state.time*2.5)%2===0,hazard=['damaged','burning','wreck'].includes(t.phase);
 if(blink&&(hazard||t.intent==='left'||t.intent==='right'))for(const s of [-1,1]){if(!hazard&&(s===-1)!==(t.intent==='left'))continue;for(const z of [-1.93,1.95])renderer.draw(turnLamp,M.multiply(m,M.model([s*.80,.96,z])));}
 if(t.phase==='wreck'||t.phase==='damaged')for(const z of [3,-3])renderer.draw(cityCone,M.multiply(m,M.model([0,-.10,z])));
}
function drawCitySignals(){for(const l of lights){if(V.len(V.sub(l.p,eye))>105)continue;const phase=signalPhase(cityNodes[l.node],l.axis),i=phase==='green'?2:phase==='amber'?1:0,m=M.model(l.p,[0,l.yaw,0]);renderer.draw(signalMeshes[i],M.multiply(m,M.model([0,.42-i*.42,.19])));}}
function shortestCityPath(p,target){const start=closestCityRoad(p),end=closestCityRoad(target),dist=Array(cityNodes.length).fill(Infinity),prev=Array(cityNodes.length).fill(-1),used=new Set();
 const penalty=e=>cityBlocked.has(e.key)?160:0;
 const A=cityNodes[start.edge.a],B=cityNodes[start.edge.b];dist[A.id]=Math.hypot(start.q[0]-A.x,start.q[2]-A.z);dist[B.id]=Math.hypot(start.q[0]-B.x,start.q[2]-B.z);
 for(let i=0;i<cityNodes.length;i++){let u=-1,best=Infinity;for(let j=0;j<dist.length;j++)if(!used.has(j)&&dist[j]<best){u=j;best=dist[j];}if(u<0)break;used.add(u);for(const v of cityNodes[u].adj){const e=cityEdgeMap.get(roadKey(u,v)),nd=dist[u]+e.len+penalty(e);if(nd<dist[v]){dist[v]=nd;prev[v]=u;}}}
 let finish=end.edge.a,cost=Infinity;for(const id of [end.edge.a,end.edge.b]){const n=cityNodes[id],d=dist[id]+Math.hypot(end.q[0]-n.x,end.q[2]-n.z);if(d<cost){finish=id;cost=d;}}
 const ids=[];for(let u=finish;u>=0;u=prev[u]){ids.push(u);if(ids.length>cityNodes.length)break;}ids.reverse();
 let points=[start.q,...ids.map(id=>[cityNodes[id].x,0,cityNodes[id].z]),end.q],blocked=ids.slice(1).some((id,i)=>cityBlocked.has(roadKey(ids[i],id)));
 if(start.edge.key===end.edge.key&&!cityBlocked.has(start.edge.key)){points=[start.q,end.q];blocked=false;}
 points=points.filter((q,i)=>!i||V.len(V.sub(q,points[i-1]))>.1);
 let length=start.d+end.d;for(let i=1;i<points.length;i++)length+=V.len(V.sub(points[i],points[i-1]));
 return{points,length,blocked,edges:ids.slice(1).map((id,i)=>roadKey(ids[i],id)),target};
}
function getCityRoute(force=false){const now=performance.now(),h=nextHouse(),p=state.view==='outside'?player.p:car.p;if(!h)return null;
 if(!force&&routeCache&&routeCache.order===h.num&&now-routeClock<450)return routeCache;
 const target=houseWorld(h,[0,0,8]);routeCache={...shortestCityPath(p,target),order:h.num};routeClock=now;return routeCache;
}
function nextCityManeuver(){const route=getCityRoute();if(!route)return '本轮完成';const p=state.view==='outside'?player.p:car.p;
 const h=nextHouse();if(Math.hypot(h.x-p[0],h.z-p[2])<24)return '已到附近 · 核对 #'+h.num;
 const points=route.points;let ahead=null,index=-1;for(let i=1;i<points.length;i++)if(Math.hypot(points[i][0]-p[0],points[i][2]-p[2])>9){ahead=points[i];index=i;break;}
 if(!ahead)return '靠近目标门窗';const f=carForward(),d=V.norm(V.sub(ahead,p)),angle=Math.atan2(f[0]*d[2]-f[2]*d[0],V.dot(f,d));
 if(Math.abs(angle)>2.0)return '注意方向 · 先掉头';
 if(index<points.length-1){const a=V.norm(V.sub(points[index],points[index-1])),b=V.norm(V.sub(points[index+1],points[index])),cross=a[0]*b[2]-a[2]*b[0],dot=V.dot(a,b);if(dot<.85)return Math.round(Math.hypot(ahead[0]-p[0],ahead[2]-p[2]))+'m 后'+(cross>0?'右转':'左转');}
 return '沿道路直行';
}
nextIntersection=function(){const f=carForward();let best=Infinity;for(const n of cityNodes){const dx=n.x-car.p[0],dz=n.z-car.p[2],t=dx*f[0]+dz*f[2],side=Math.abs(dx*f[2]-dz*f[0]);if(t>3&&t<75&&side<6.7)best=Math.min(best,t);}return best;};
function mapMetrics(canvas){const w=canvas.width,h=canvas.height,pad=w<300?13:27,size=Math.min(w,h)-pad*2,scale=size/320;return{w,h,pad,scale,x:x=>w/2+x*scale,z:z=>h/2+z*scale};}
function renderCityMap(canvas,large=false){const c=canvas.getContext('2d'),m=mapMetrics(canvas);c.clearRect(0,0,m.w,m.h);c.fillStyle='#193640';c.fillRect(0,0,m.w,m.h);
 for(let x=-160;x<160;x+=16)for(let z=-160;z<160;z+=16){c.fillStyle=DISTRICTS[districtAt(x+8,z+8)].map;c.fillRect(m.x(x),m.z(z),16*m.scale+1,16*m.scale+1);}
 c.lineCap='round';c.strokeStyle='#8a9e9c';c.lineWidth=large?10:4.2;for(const e of cityEdges){c.beginPath();c.moveTo(m.x(cityNodes[e.a].x),m.z(cityNodes[e.a].z));c.lineTo(m.x(cityNodes[e.b].x),m.z(cityNodes[e.b].z));c.stroke();}
 for(const [key,incident] of cityBlocked){const e=cityEdgeMap.get(key);if(!e)continue;c.strokeStyle='#e99f78';c.lineWidth=large?7:3;c.setLineDash(large?[8,6]:[3,2]);c.beginPath();c.moveTo(m.x(cityNodes[e.a].x),m.z(cityNodes[e.a].z));c.lineTo(m.x(cityNodes[e.b].x),m.z(cityNodes[e.b].z));c.stroke();c.setLineDash([]);}
 const route=getCityRoute();if(route){c.lineWidth=large?4:2;c.strokeStyle='#ffe2a0';c.beginPath();route.points.forEach((p,i)=>i?c.lineTo(m.x(p[0]),m.z(p[2])):c.moveTo(m.x(p[0]),m.z(p[2])));c.stroke();}
 for(const h of houses){const selected=h===nextHouse()||large&&citySelected===h.num,dim=cityFilter!=='all'&&h.district!==cityFilter;
  c.globalAlpha=dim?.25:1;c.fillStyle=h.done?'#9ed8ba':selected?'#ffe29b':h.deliverable?'#e8ded0':'#91a69f';const r=large?(selected?7:5):selected?4:2.3;c.fillRect(m.x(h.x)-r,m.z(h.z)-r,r*2,r*2);
  if(large&&h.deliverable){c.font='bold 13px Arial';c.textAlign='center';c.textBaseline='middle';c.fillStyle=selected?'#ffe5ac':'#e7ece0';c.fillText(String(h.num),m.x(h.x),m.z(h.z)-12);}
 }c.globalAlpha=1;
 for(const t of traffic){if(t.phase==='cleared')continue;c.fillStyle=t.phase==='normal'?'#b4e0df':t.phase==='burning'?'#ffc16e':'#ed9f86';c.beginPath();c.arc(m.x(t.p[0]),m.z(t.p[2]),large?2.8:1.35,0,TAU);c.fill();}
 for(const p of packages){if(!p.order||p.delivered)continue;c.strokeStyle='#f7ba7c';c.lineWidth=1.5;c.strokeRect(m.x(p.p[0])-3,m.z(p.p[2])-3,6,6);}
 c.save();c.translate(m.x(car.p[0]),m.z(car.p[2]));c.rotate(-car.yaw);const s=large?1.35:.72;c.scale(s,s);c.beginPath();c.moveTo(0,-8);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fillStyle='#fff7cf';c.fill();c.strokeStyle='#142f3a';c.lineWidth=1.5;c.stroke();c.restore();
 for(const a of [localAvatar(),otherAvatar()]){if(!a||a.view!=='outside')continue;c.fillStyle=a.id===1?'#83dbef':'#ffd16d';c.beginPath();c.arc(m.x(a.p[0]),m.z(a.p[2]),large?4:2.5,0,TAU);c.fill();}
 if(large){c.font='bold 13px Arial';c.textAlign='left';c.fillStyle='#f7e1a8';c.fillText('N ↑',16,17);}
}
drawMap=function(){const now=performance.now();if(now-lastMapDraw<170)return;lastMapDraw=now;renderCityMap($('minimap'));};
function syncCityMap(){const canvas=$('cityMap'),h=orderHouse(citySelected)||nextHouse();renderCityMap(canvas,true);
 $('cityMapRoute').textContent=h?'#'+h.num+' · '+DISTRICTS[h.district].name:'派送已完成';
 $('cityMapDetail').textContent=h?parcelType(h.kind).name+' / '+h.item+' · '+getOrderStatus(h)+'。'+DISTRICTS[h.district].tip:'所有任务包裹已签收。';
 $('cityNavigateBtn').disabled=!h||h.done||state.mode==='menu';$('cityNavigateBtn').textContent=state.mode==='menu'?'进入派送后可设导航':'设为团队下一单 →';$('cityMapTraffic').textContent=traffic.filter(t=>t.phase==='normal').length+' 辆行驶中 · '+cityBlocked.size+' 段事故路 · '+cityTrafficStats.cleared+' 辆已清障';
 const route=getCityRoute();$('cityRouteSummary').textContent=route?'团队导航 #'+route.order+' · 约 '+Math.round(route.length)+'m'+(route.blocked?' · 需经过事故路段':' · 已避让可绕行的事故路'):'选择未完成订单开始导航';
 for(const b of $('cityDistricts').querySelectorAll('button'))b.classList.toggle('active',b.dataset.district===cityFilter);
}
function openCityMap(){if(!['menu','playing','paused'].includes(state.mode))return;clearInputs();closeOrders();citySelected=nextHouse()?.num||null;cityMapFrom=state.mode;$('cityScreen').classList.remove('hidden');syncCityMap();$('closeCityMapBtn').focus({preventScroll:true});}
function closeCityMap(){$('cityScreen').classList.add('hidden');if(state.mode==='playing')world.focus({preventScroll:true});}
$('mapOpenBtn').addEventListener('click',openCityMap);$('cityMenuBtn').addEventListener('click',openCityMap);$('closeCityMapBtn').addEventListener('click',closeCityMap);
$('cityNavigateBtn').addEventListener('click',()=>{const h=orderHouse(citySelected);if(!h||h.done)return;if(state.mode==='menu'){netText('进入游戏后，在「订单」中选择 #'+h.num+'，开始派送。');closeCityMap();return;}selectOrder(h.num);routeCache=null;closeCityMap();});
for(const b of $('cityDistricts').querySelectorAll('button'))b.addEventListener('click',()=>{cityFilter=b.dataset.district;syncCityMap();});
$('cityMap').addEventListener('click',e=>{const canvas=$('cityMap'),rect=canvas.getBoundingClientRect(),m=mapMetrics(canvas),x=((e.clientX-rect.left)*canvas.width/rect.width-m.w/2)/m.scale,z=((e.clientY-rect.top)*canvas.height/rect.height-m.h/2)/m.scale;let hit=null,dist=18;for(const h of deliverable){if(cityFilter!=='all'&&h.district!==cityFilter)continue;const d=Math.hypot(x-h.x,z-h.z);if(d<dist){dist=d;hit=h;}}if(hit){citySelected=hit.num;syncCityMap();}});
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.repeat)return;if(!$('cityScreen').classList.contains('hidden')&&!['KeyN','Escape'].includes(e.code)){if(e.code.startsWith('Key')||e.code.startsWith('Arrow')||e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();}return;}if(e.code==='KeyN'){e.preventDefault();e.stopImmediatePropagation();$('cityScreen').classList.contains('hidden')?openCityMap():closeCityMap();}if(e.code==='Escape'&&!$('cityScreen').classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();closeCityMap();}},true);
// Map is an information panel; it does not pause the shared world. Stop locomotion while open.
const cityStepPlayer=stepPlayer,cityStepCar=stepCar;
stepPlayer=function(dt){if(!net.executing&&!$('cityScreen').classList.contains('hidden'))return;cityStepPlayer(dt);};
stepCar=function(dt){if(!net.executing&&!$('cityScreen').classList.contains('hidden')){const old=inputs;inputs=blankInput();try{cityStepCar(dt);}finally{inputs=old;}}else cityStepCar(dt);};
resetGame=function(toMenu=false){v07.resetGame(toMenu);routeCache=null;routeClock=-1;cityMapClock=-1;citySelected=null;closeCityMap();if(!toMenu)showHint('V0.7：18 单 / 三个城区。点右上地图看路线和事故。NPC 会转弯、等灯及让行；砖头仍不会转向。',8);};
stopNetwork=function(toMenu=true){v07.stopNetwork(toMenu);closeCityMap();};
openOrders=function(){closeCityMap();v07.openOrders();};
service=function(){v07.service();if(net.mode==='guest')return;const q=closestCityRoad(car.p),e=q.edge,A=cityNodes[e.a],B=cityNodes[e.b];let from=e.a,to=e.b;if(B.z>A.z){from=e.b;to=e.a;}const d=edgeDirection(from,to),p=[q.q[0]-d[2]*CITY.lane,.12,q.q[2]+d[0]*CITY.lane];car.p=p;car.yaw=Math.atan2(-d[0],-d[2]);routeCache=null;};
updateHUD=function(){v07.updateHUD();if(net.executing)return;const p=state.view==='outside'?player.p:car.p,dist=DISTRICTS[districtAt(p[0],p[2])];$('districtChip').textContent=dist.short+' · 建议 '+dist.speed;
 const route=getCityRoute();$('routeGuide').textContent=nextCityManeuver();if(route)$('routeGuide').title='沿道路约 '+Math.round(route.length)+'m'+(route.blocked?'，前方有事故':'' );
 const nearby=traffic.find(t=>['damaged','wreck'].includes(t.phase)&&Math.hypot(t.p[0]-p[0],t.p[2]-p[2])<22);
 if(nearby&&$('risk').classList.contains('hidden')){$('risk').textContent='事故堵塞 · 清障约 '+Math.ceil(Math.max(0,nearby.phase==='wreck'?22-nearby.wreckAge:28-(nearby.incidentAge||0)))+'s · 查看地图绕行';$('risk').classList.remove('hidden');}
 if(!$('cityScreen').classList.contains('hidden')&&performance.now()-cityMapClock>250){cityMapClock=performance.now();syncCityMap();}
};
// City labels are a bounded overlay, not hundreds of DOM nodes updated every frame.
drawOverlay=function(){v07.drawOverlay();if(state.mode!=='playing'||state.view==='cargo'&&!net.watch)return;let count=0;for(const h of deliverable){if(count>=5)break;const d=Math.hypot(h.x-eye[0],h.z-eye[2]);if(d>45||h.done||h===nextHouse())continue;const p=renderer.project([h.x,7.4,h.z]);if(!p||p.x<30||p.x>width-30||p.y<175||p.y>height-150)continue;label('#'+h.num+' · '+DISTRICTS[h.district].short,p.x,p.y,h===nextHouse()?'#ffe1a1':'#d0e4df',coarse()?9:11);count++;}};
function extendV07Tests(){if(!window.__deliveryTest)return;Object.assign(window.__deliveryTest,{
 city:()=>({version:'0.7.0',nodes:cityNodes.map(n=>({id:n.id,x:n.x,z:n.z,adj:n.adj})),edges:cityEdges.map(e=>({...e})),buildings:houses.length,orders:deliverable.length,districts:deliverable.map(h=>({num:h.num,district:h.district})),blocked:[...cityBlocked],claims:[...cityClaims],stats:{...cityTrafficStats},traffic:traffic.map(t=>({id:t.id,from:t.from,to:t.to,next:t.next,progress:t.progress,pathLen:t.path?.len,motion:t.motion,intent:t.intent,speed:t.speed,wait:t.wait,p:t.p,phase:t.phase,braking:t.braking})),route:getCityRoute(true),batches:cityWorld.meshes.length,visibleBatches:cityVisibleBatches,visibleTriangles:cityVisibleTriangles}),
 cityTrafficAt:(id,x,z,nx,nz,progress=0,next=null)=>{const a=cityNode(x,z),b=cityNode(nx,nz),t=traffic[id];if(!a||!b||!a.adj.includes(b.id)||!t)throw Error('Invalid directed edge');initializeTraffic(t,a.id,b.id,progress);if(next!==null){const n=cityNode(...next);if(!n||!b.adj.includes(n.id)||n.id===a.id)throw Error('Invalid exit');t.next=n.id;}trafficPosition(t);cityAIClock=0;},
 cityClearTraffic:()=>{for(const t of traffic){t.phase='cleared';t.clearAge=-1e8;t.p=[190+t.id*4,.1,190];t.speed=0;t.drift=[0,0,0];}cityClaims.clear();refreshBlockedEdges();},
 cityTime:t=>{state.time=t;cityAIClock=0;},
 cityTrafficAdvance:s=>{for(let i=0;i<Math.round(Math.min(240,s)*120);i++){state.time+=1/120;stepTraffic(1/120);}drawMap();draw3D();},
 citySignal:(x,z,axis,t)=>signalPhase(cityNode(x,z),axis,t),
 cityPath:(x,z,nx,nz,tx,tz)=>makeJunctionPath(cityNode(x,z).id,cityNode(nx,nz).id,cityNode(tx,tz).id),
 cityRoute:(a,b)=>shortestCityPath(a,b),
 cityIncident:(id,p,phase='wreck')=>{const t=traffic[id];Object.assign(t,{phase,p:p.slice(),drift:[0,0,0],spin:0,hp:phase==='wreck'?0:30,burn:2.25,wreckAge:0,incidentAge:0,hitCooldown:0,speed:0});refreshBlockedEdges();cityAIClock=0;},
 openCityMap,closeCityMap,cityReset:resetCityTraffic,
 renderView:(e,a)=>{eye=e;at=a;draw3D();},
 clearTraffic:()=>{for(const t of traffic){t.phase='cleared';t.clearAge=-1e8;t.p=[190+t.id*4,.1,190];t.speed=0;t.drift=[0,0,0];}cityClaims.clear();refreshBlockedEdges();},
 snapshotBytes:()=>new TextEncoder().encode(JSON.stringify(netSnapshot())).length,
 });}


let freezeSimulation=false;
const pointerStreams=new Map();let joyPointer=null;
function capture(el,id){try{el.setPointerCapture(id);}catch(e){}}
function holdControl(id,key,view){const el=$(id);el.addEventListener('pointerdown',e=>{if(state.mode!=='playing'||(state.view!==view&&!(view==='cargo'&&state.view==='outside')))return;e.preventDefault();capture(el,e.pointerId);inputs[key].add(e.pointerId);el.classList.add('pressed');initAudio();});const up=e=>{inputs[key].delete(e.pointerId);if(!inputs[key].size)el.classList.remove('pressed');};for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,up);}
for(const [id,k] of [['leftBtn','left'],['rightBtn','right'],['gasBtn','gas'],['brakeBtn','brake']])holdControl(id,k,'drive');
for(const [id,k] of [['walkForward','forward'],['walkBack','back'],['walkLeft','walkLeft'],['walkRight','walkRight']])holdControl(id,k,'cargo');
world.addEventListener('contextmenu',e=>e.preventDefault());
world.addEventListener('pointerdown',e=>{if(state.mode!=='playing'||e.button>2)return;e.preventDefault();capture(world,e.pointerId);const p={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button,mouse:e.pointerType==='mouse',view:state.view,moved:false};pointerStreams.set(e.pointerId,p);if(state.view!=='drive'&&p.mouse&&e.button===0&&player.held)startCharge('canvas'+e.pointerId);});
world.addEventListener('pointermove',e=>{const p=pointerStreams.get(e.pointerId);if(!p||state.mode!=='playing'||p.view!==state.view)return;e.preventDefault();const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>4)p.moved=true;if(state.view!=='drive')turnLook(dx,dy);else driveOrbitGoal=clamp(driveOrbitGoal-dx*.006,-2.6,2.6);});
world.addEventListener('pointerup',e=>{const p=pointerStreams.get(e.pointerId);if(!p)return;finishCharge('canvas'+e.pointerId);if(!p.moved&&p.mouse&&p.button===0&&p.view!=='drive'&&!player.held&&state.cooldown===0)interact();pointerStreams.delete(e.pointerId);});
function cancelCanvasPointer(e){pointerStreams.delete(e.pointerId);if(state.chargeSource==='canvas'+e.pointerId)cancelCharge();}
world.addEventListener('pointercancel',cancelCanvasPointer);world.addEventListener('lostpointercapture',cancelCanvasPointer);
const stick=$('joystick');
function updateStick(e){const r=stick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.36),y=(e.clientY-r.top-r.height/2)/(r.height*.36),len=Math.max(1,Math.hypot(x,y));inputs.stickX=clamp(x/len,-1,1);inputs.stickY=clamp(y/len,-1,1);$('stickThumb').style.transform='translate('+inputs.stickX*27+'px,'+inputs.stickY*27+'px)';}
stick.addEventListener('pointerdown',e=>{if(e.target.closest('button')||state.mode!=='playing'||state.view==='drive'||joyPointer!==null)return;e.preventDefault();joyPointer=e.pointerId;capture(stick,e.pointerId);updateStick(e);});
stick.addEventListener('pointermove',e=>{if(e.pointerId!==joyPointer||state.view==='drive'||state.mode!=='playing')return;e.preventDefault();updateStick(e);});
function stopStick(e){if(e.pointerId!==joyPointer)return;joyPointer=null;inputs.stickX=inputs.stickY=0;$('stickThumb').style.transform='';}
for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,stopStick);
$('throwBtn').addEventListener('pointerdown',e=>{if(state.mode!=='playing'||state.view==='drive')return;e.preventDefault();capture($('throwBtn'),e.pointerId);startCharge('throw'+e.pointerId);});
$('throwBtn').addEventListener('pointerup',e=>finishCharge('throw'+e.pointerId));for(const type of ['pointercancel','lostpointercapture'])$('throwBtn').addEventListener(type,e=>{if(state.chargeSource==='throw'+e.pointerId)cancelCharge();});
const gameKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyB','KeyV','KeyE','KeyG','KeyF','KeyR','KeyC','Space','Escape','KeyP']);
window.addEventListener('keydown',e=>{if(!gameKeys.has(e.code)||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
 if(e.code==='Escape'||e.code==='KeyP'){if(e.repeat)return;e.preventDefault();if(!$('helpScreen').classList.contains('hidden')){closeHelp();return;}if(state.mode==='playing')pause();else if(state.mode==='paused')resume();return;}
 if(state.mode!=='playing')return;e.preventDefault();inputs.keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyB')toggleBrick();else if(e.code==='KeyV')(state.view==='outside'||state.view==='cargo'&&player.p[2]>1.45?mobility():setView(state.view==='drive'?'cargo':'drive'));else if(e.code==='KeyE')interact();else if(e.code==='KeyG')toggleBothDoors();else if(e.code==='KeyF')lockTarget();else if(e.code==='KeyR')dropPackage();else if(e.code==='KeyC'){if(state.view==='drive')driveOrbitGoal=0;else{player.yaw=Math.PI;player.pitch=-.15;player.aimGate=player.aimHouse=null;}}else if(e.code==='Space')startCharge('space');
});
window.addEventListener('keyup',e=>{inputs.keys.delete(e.code);if(e.code==='Space'){if(state.mode==='playing')e.preventDefault();finishCharge('space');}});
$('startBtn').addEventListener('click',()=>{stopNetwork(false);resetGame();});$('hostBtn').addEventListener('click',hostRoom);$('joinBtn').addEventListener('click',joinRoom);$('againBtn').addEventListener('click',()=>resetGame());$('backMenuBtn').addEventListener('click',()=>stopNetwork(true));$('restartBtn').addEventListener('click',()=>resetGame());$('pauseBtn').addEventListener('click',pause);$('resumeBtn').addEventListener('click',resume);$('serviceBtn').addEventListener('click',service);
$('cargoBtn').addEventListener('click',()=>setView('cargo'));$('brickBtn').addEventListener('click',toggleBrick);$('interactBtn').addEventListener('click',interact);$('leftDoorBtn').addEventListener('click',()=>toggleDoor(0));$('rightDoorBtn').addEventListener('click',()=>toggleDoor(1));$('dropBtn').addEventListener('click',dropPackage);$('assistAimBtn').addEventListener('click',()=>lockTarget());
$('qualityBtn').addEventListener('click',()=>{quality={auto:'high',high:'low',low:'auto'}[quality];adaptiveScale=2;qualityWait=slowTime=fastTime=0;syncButtons();save();});$('assistBtn').addEventListener('click',()=>{assist=!assist;syncButtons();save();});$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;initAudio();syncButtons();save();});$('motionBtn').addEventListener('click',()=>{motion=!motion;syncButtons();save();});
function openHelp(){state.helpFrom=state.mode;if(state.mode==='playing')pause();$('helpScreen').classList.remove('hidden');$('closeHelpBtn').focus({preventScroll:true});}
function closeHelp(){$('helpScreen').classList.add('hidden');if(state.helpFrom==='menu')$('helpBtn').focus({preventScroll:true});else $('resumeBtn').focus({preventScroll:true});}
$('helpBtn').addEventListener('click',openHelp);$('pauseHelpBtn').addEventListener('click',openHelp);$('closeHelpBtn').addEventListener('click',closeHelp);$('reloadBtn').addEventListener('click',()=>location.reload());
function resize(){const r=$('game').getBoundingClientRect();width=Math.max(1,Math.round(r.width));height=Math.max(1,Math.round(r.height));clearInputs();pointerStreams.clear();joyPointer=null;}
window.addEventListener('resize',resize);if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);
window.addEventListener('blur',()=>{if(qaBackground)return;if(state.mode==='playing')pause();else clearInputs();pointerStreams.clear();joyPointer=null;});document.addEventListener('visibilitychange',()=>{if(qaBackground)return;if(document.hidden&&state.mode==='playing')pause();last=performance.now();});
world.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('errorText').textContent='3D 图形上下文被系统回收。请重新加载；随后可在暂停菜单切换省电画质。';$('errorScreen').classList.remove('hidden');});
let qaBackground=false;let last=performance.now(),hudAccumulator=0;
function frame(now){const rawdt=clamp((now-last)/1000,.001,.2),dt=Math.min(rawdt,.05);last=now;
 try{
  if(state.mode==='playing'&&!freezeSimulation&&net.mode!=='guest'){const fixed=coarse()&&networked()?1/90:1/120;simAccumulator=Math.min(simAccumulator+dt,.10);while(simAccumulator>=fixed&&state.mode==='playing'){step(fixed);simAccumulator-=fixed;}updateQuality(rawdt);}
  if(net.mode==='guest'&&net.connected)tickGuest(dt);
  if(state.mode==='playing'||state.mode==='menu')updateCamera(dt);netTick();
  hudAccumulator+=dt;if(hudAccumulator>.07){if(state.mode!=='menu'&&state.mode!=='wardrobe'){updateHUD();drawMap();}else updateNetHUD();hudAccumulator=0;}
  if(engineVoice&&audio){const s=state.mode==='playing'?Math.abs(car.speed):0;engineVoice.o.frequency.setTargetAtTime(38+s*3.8,audio.currentTime,.1);engineVoice.g.gain.setTargetAtTime(s>.2?(state.view!=='drive'?.10:.18):0,audio.currentTime,.10);windVoice.g.gain.setTargetAtTime(state.mode==='playing'&&state.view!=='drive'&&doors.some(d=>d.angle>.5)?Math.min(.27,s*.016):0,audio.currentTime,.12);}
  draw3D();
 }catch(e){console.error(e);state.mode='error';$('errorText').textContent='游戏运行遇到问题：'+e.message;$('errorScreen').classList.remove('hidden');return;}
 requestAnimationFrame(frame);
}
// QA fixtures are opt-in and call the same physics / interaction functions as play.
if(new URLSearchParams(location.search).has('test'))window.__deliveryTest={
 snapshot:()=>({version:'multiplayer-0.7.0',state:{...state},car:JSON.parse(JSON.stringify(car)),player:{p:player.p.slice(),yaw:player.yaw,pitch:player.pitch,held:player.held?{id:player.held.id,kind:player.held.kind}:null,focus:player.focus?.type||null},doors:doors.map(d=>({...d})),cargo:cargo.map(c=>({id:c.id,kind:c.kind,p:c.p.slice(),v:c.v.slice(),thrown:c.thrown})),packages:packages.map(p=>({id:p.id,p:p.p.slice(),v:p.v.slice(),delivered:p.delivered,spilled:p.spilled,pending:p.pending?.h.num||null})),traffic:traffic.map(t=>({id:t.id,p:t.p.slice(),hp:t.hp,phase:t.phase,burn:t.burn})),houses:deliverable.map(h=>({num:h.num,x:h.x,z:h.z,yaw:h.yaw,done:h.done,gates:h.gates.map(g=>({index:g.index,type:g.type,broken:g.broken,center:g.center.slice(),screen:renderer.project(g.center)}))})),debris:debris.length,effects:effects.length,staticTriangles,render:{width:world.width,height:world.height,dpr:actualDPR(),cssWidth:width,cssHeight:height,quality},soundOn,assist,stock:physicalStock()}),
 reset:()=>resetGame(),menu:()=>resetGame(true),freeze:b=>{freezeSimulation=b;simAccumulator=0;},
 advance:seconds=>{for(let i=0,n=Math.ceil(clamp(seconds,0,100)*120);i<n&&state.mode==='playing';i++)step(1/120);updateCamera(.3);updateHUD();drawMap();draw3D();},
 place:(x,z,yaw=0,speed=0)=>{car.p=[x,.12,z];car.yaw=yaw;car.speed=speed;car.velocity=V.mul(carForward(),speed);car.accel=[0,0,0];car.kick=[0,0,0];car.hp=100;car.steer=0;state.hitCooldown=0;state.brick=false;brickBody.placed=false;clearInputs();syncButtons();},
 playerAt:(x,z,yaw=Math.PI,pitch=-.2)=>{if(state.view==='drive')setView('cargo');player.p=[clamp(x,-1.12,1.12),2.38,clamp(z,-1.21,3.35)];player.yaw=yaw;player.pitch=pitch;player.aimGate=player.aimHouse=null;state.switchUntil=0;cameraBlend=0;updateCamera(.3);syncButtons();updateHUD();},
 lookAt:p=>{player.aimGate=player.aimHouse=null;aimCameraAt(p);updateCamera(.3);updateHUD();},
 cargoLook:index=>{const c=cargo[index];if(c){aimCameraAt(vehicleToWorld(c.p));updateCamera(.3);updateHUD();}},
 interact,brick:toggleBrick,door:toggleDoor,bothDoors:toggleBothDoors,view:setView,drop:dropPackage,lock:lockTarget,
 cargoSet:(index,p,v=[0,0,0])=>{const c=cargo[index];if(!c)throw new Error('Missing cargo index');c.p=p.slice();c.v=v.slice();},
 solution:shotSolution,shoot:power=>{startCharge('qa');if(state.charging){state.charge=clamp(power,.1,1);finishCharge('qa');}},
 aimAt:(num,index=0)=>{const h=houses.find(h=>h.num===num);if(!h)throw new Error('Unknown address');player.aimHouse=h;player.aimGate=h.gates[index];aimCameraAt(player.aimGate.center);},
 trafficPlace:(index,x,z,yaw=0,hp=100)=>{const t=traffic[index];Object.assign(t,{p:[x,.1,z],yaw,hp,phase:'damaged',drift:[0,0,0],spin:0,burn:0,hitCooldown:0});},
 damage:(index,amount)=>damageTraffic(traffic[index],amount),
 quality:q=>{if(!['auto','high','low'].includes(q))throw new Error('Invalid quality');quality=q;syncButtons();draw3D();},
 assist:b=>{assist=!!b;syncButtons();}, service,pause,resume,
 controls:()=>({keys:[...inputs.keys],left:[...inputs.left],right:[...inputs.right],gas:[...inputs.gas],brake:[...inputs.brake],stick:[inputs.stickX,inputs.stickY],charging:state.charging}),
 glError:()=>renderer.gl.getError()
};

{const el=$('garageBtn');if(el)el.onclick=openGarage;}{const el=$('closeGarageBtn');if(el)el.onclick=closeGarage;}for(const key of ['engine','brakes','grip','mat']){const el=$('upgrade_'+key);if(el)el.onclick=()=>buyUpgrade(key);}$('wardrobeBtn').onclick=openWardrobe;$('closeWardrobe').onclick=closeWardrobe;
$('watchBtn').onclick=toggleWatch;$('waveBtn').onclick=wave;$('copyRoomBtn').onclick=copyRoom;
$('leaveBtn').onclick=()=>stopNetwork(true);$('cancelNetBtn').onclick=()=>stopNetwork(false);
for(let id=0;id<2;id++)$('crew'+id).onclick=()=>{preview.which=id;$('crewNumber').textContent='COURIER / 0'+(id+1);$('crewName').textContent=id?'蓝帽快递员':'橙帽快递员';$('crew0').classList.toggle('active',!id);$('crew1').classList.toggle('active',!!id);};
document.querySelectorAll('[data-pose]').forEach(b=>b.onclick=()=>setPreviewAction(b.dataset.pose));
world.addEventListener('pointerdown',e=>{if(state.mode!=='wardrobe')return;e.preventDefault();capture(world,e.pointerId);preview.drag={id:e.pointerId,x:e.clientX};});
world.addEventListener('pointermove',e=>{if(state.mode==='wardrobe'&&preview.drag?.id===e.pointerId){preview.yaw+=(e.clientX-preview.drag.x)*.012;preview.drag.x=e.clientX;}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])world.addEventListener(type,e=>{if(preview.drag?.id===e.pointerId)preview.drag=null;});
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.repeat)return;if(state.mode==='wardrobe'&&e.code==='Escape'){closeWardrobe();return;}if(state.mode==='playing'){if(e.code==='KeyT')toggleWatch();if(e.code==='KeyH')wave();}});
const nicknameInput=$('nicknameInput');if(nicknameInput){nicknameInput.value=nickname;const applyNickname=()=>{nickname=cleanNickname(nicknameInput.value);nicknameInput.value=nickname;player.name=nickname;save();updateNetHUD();};nicknameInput.addEventListener('change',applyNickname);nicknameInput.addEventListener('blur',applyNickname);nicknameInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();nicknameInput.blur();}});}
const inviteCode=new URLSearchParams(location.search).get('room');if(/^\d{6}$/.test(inviteCode||'')){$('roomCode').value=inviteCode;netText('已填入邀请房间 '+inviteCode+'，点击「加入」。');}
if(window.__deliveryTest)Object.assign(window.__deliveryTest,{
 background:b=>qaBackground=!!b,
 network:()=>({mode:net.mode,connected:net.connected,room:net.room,watch:net.watch,epoch:net.epoch,ack:net.ack,lastAction:net.lastAction,rtt:net.rtt,status:net.status,remote:net.remoteActor?packActor(net.remoteActor,net.remoteState):net.hostActor}),
 avatar:()=>({local:packActor(player,state),other:otherAvatar()?packActor(otherAvatar(),otherAvatar()):null}),
 gallery:(a='idle',id=0)=>{openWardrobe();preview.which=id;setPreviewAction(a);},
 previewPose:()=>courierPose({...newCourier(0),view:'cargo',move:1,walkPhase:performance.now()/1000*8},performance.now()/1000),
 wave,watch:toggleWatch,leave:()=>stopNetwork(true),
 // Test-only channel adapter: RTCDataChannel or an explicit ordered transport fixture.
 // Test reports must state whether actual WebRTC/ICE or a local message bridge was used.
 attachRTC:(channel,mode,room='246810')=>{stopNetwork(false);net.mode=mode;net.room=room;const handlers={};const c={open:channel.readyState==='open',bufferSize:0,dataChannel:channel,send:m=>channel.send(JSON.stringify(m)),close:()=>channel.close(),on:(key,fn)=>{(handlers[key]??=[]).push(fn);}};
 const fire=(key,arg)=>{for(const fn of handlers[key]||[])fn(arg);};channel.onopen=()=>{c.open=true;fire('open');};channel.onmessage=e=>fire('data',JSON.parse(e.data));channel.onclose=()=>{c.open=false;fire('close');};channel.onerror=e=>fire('error',e);setupConn(c);if(c.open)fire('open');return true;},
 remotePlace:(x,z,yaw=Math.PI,pitch=-.2)=>{if(!remoteReady())throw Error('Host connection required');inRemote(()=>{player.p=[clamp(x,-1.12,1.12),2.38,clamp(z,-1.21,3.35)];player.yaw=yaw;player.pitch=pitch;state.switchUntil=0;});netSend(netSnapshot());},
 publish:()=>netSend(netSnapshot())
});

extendV06Tests();extendV07Tests();const requiredStartupIds=['game','world','overlay','menu','hud','startBtn','hostBtn','joinBtn'];const missingStartup=requiredStartupIds.filter(id=>!$(id));if(missingStartup.length)console.error('Missing startup DOM:',missingStartup);resize();resetGame(true);const start=$('startBtn');if(start){start.disabled=false;start.textContent='单人测试 →';}window.__deliveryBootReady=true;requestAnimationFrame(frame);
})();
