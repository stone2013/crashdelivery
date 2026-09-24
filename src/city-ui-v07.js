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
