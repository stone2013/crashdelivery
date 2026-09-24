/* V0.6 CO-OP CHAOS. All shared mutations run on the host, in either courier context.
 * Space conventions: cargo p is van-local eye position; outside p is world eye position.
 * There is exactly ONE physical parcel per unfinished address. No respawn-on-timeout.
 */
const v06 = { nextHouse,loadCargo,resetGame,stepPlayer,stepCar,impact,deliver,stepWorldPackage,
 collectFocus,setView,toggleDoor,toggleBothDoors,updateHUD,syncButtons,updateCamera,draw3D,
 drawOverlay,drawAvatarLabels,stopNetwork,endRound,connectionLost,openGarage };
const WALK_EYE=1.73, BOARD_SPEED=12/3.6, REPAIR_SECONDS=3;
const orderKinds=[0,2,1,3,4,5,0,2,1,3,4,5];
const itemNames=['日用百货','无线耳机','小型家电','玻璃杯组','海报筒','惊喜礼盒'];
let roundPaid=false,manifestSignature='',lastMapDraw=0;
for(let i=0;i<deliverable.length;i++){
 deliverable[i].kind=orderKinds[i%12];
 deliverable[i].item=itemNames[({0:0,2:1,1:2,3:3,4:4,5:5})[deliverable[i].kind]];
}
function isWalking(){return state.view==='cargo'||state.view==='outside';}
function worldEye(){return state.view==='outside'?player.p.slice():vehicleToWorld(cameraLocal());}
function worldYaw(){return (state.view==='outside'?0:car.yaw)+player.yaw;}
function roleLabel(view){return view==='drive'?'驾驶员':view==='outside'?'车外作业':'投递员';}
function activeActors(){return [{a:player,s:state},...(remoteReady()?[{a:net.remoteActor,s:net.remoteState}]:[])];}
function orderHouse(n){return deliverable.find(h=>h.num===n)||null;}
function inventory(){return cargo.concat(packages,player.held?[player.held]:[],remoteReady()&&net.remoteActor.held?[net.remoteActor.held]:[],net.mode==='guest'&&net.hostActor?.held?[net.hostActor.held]:[]);}
function getOrderStatus(h){
 if(h.done)return '已签收';
 if(player.held?.order===h.num)return '你抱着';
 if(otherAvatar()?.held?.order===h.num)return '队友抱着';
 if(cargo.some(p=>p.order===h.num))return '货箱内';
 if(packages.some(p=>p.order===h.num&&!p.delivered))return '车外待回收';
 return '待救援补齐';
}
nextHouse=function(){return deliverable.find(h=>h.num===state.selectedOrder&&!h.done)||deliverable.find(h=>!h.done)||null;};
loadCargo=function(){
 cargo.length=0;player.held=null;
 const remaining=deliverable.filter(h=>!h.done);
 for(let i=0;i<remaining.length;i++){
  const h=remaining[i],side=i%2?1:-1,row=Math.floor((i%12)/2),r=parcelType(h.kind).r;
  const p=makeCargo(h.kind,[side*.96,CAB.floor+r+.02+(i>=12?.82:0),-1.04+row*.78]);
  p.order=h.num;p.lossCounted=false;p.wrongAt=[];cargo.push(p);
 }
};
parcelLabel=function(p){const t=parcelType(p.kind);return (p.order?'#'+p.order+' · ':'')+t.name+' · '+Math.round(p.integrity??100)+'%';};
viewDirection=function(){const a=worldYaw(),c=Math.cos(player.pitch);return[-Math.sin(a)*c,Math.sin(player.pitch),-Math.cos(a)*c];};
aimCameraAt=function(p){const d=V.sub(p,worldEye());player.yaw=wrapAngle(Math.atan2(-d[0],-d[2])-(state.view==='outside'?0:car.yaw));player.pitch=clamp(Math.atan2(d[1],Math.hypot(d[0],d[2])),-1.28,1.02);};
function selectOrder(n){
 if(!Number.isSafeInteger(n)||!orderHouse(n)||orderHouse(n).done)return;
 if(net.mode==='guest'&&!net.applying){action('selectOrder',{num:n});return;}
 state.selectedOrder=n;showHint('团队导航：'+orderHouse(n).address+' · 找 #'+n+' 包裹',3);
 manifestSignature='';
}
function openOrders(){if(!['playing','paused'].includes(state.mode))return;clearInputs();$('manifest').classList.remove('hidden');manifestSignature='';updateManifest();}
function closeOrders(){$('manifest').classList.add('hidden');if(state.mode==='playing')world.focus({preventScroll:true});}
function updateManifest(){
 if($('manifest').classList.contains('hidden'))return;
 const sig=deliverable.map(h=>h.num+':'+getOrderStatus(h)).join('|')+';'+state.selectedOrder;
 if(sig===manifestSignature)return;manifestSignature=sig;
 for(const h of deliverable){const el=$('job_'+h.num);el.disabled=h.done;el.classList.toggle('selected',nextHouse()===h);el.classList.toggle('complete',h.done);el.querySelector('.jobLocation').textContent=getOrderStatus(h);}
 const loose=packages.filter(p=>p.order&&!p.delivered).length;
 $('manifestFooter').textContent=loose?loose+' 件在车外。停车开后门，下车捡回；它们不会定时消失。':TOTAL+' 个地址对应 '+TOTAL+' 个实体包裹。可自行选择派送顺序。';
}
function buildManifest(){
 for(const h of deliverable){
  const el=document.createElement('button');el.type='button';el.id='job_'+h.num;el.className='job';
  const n=document.createElement('strong');n.textContent=String(h.num);
  const text=document.createElement('span');text.className='jobText';
  const title=document.createElement('b');title.textContent=h.item;
  const small=document.createElement('small');small.textContent=parcelType(h.kind).name+' · '+h.address;
  text.append(title,small);const place=document.createElement('span');place.className='jobLocation';
  el.append(n,text,place);el.addEventListener('click',()=>{selectOrder(h.num);closeOrders();});$('orderList').append(el);
 }
}
// Segmented, real geometry labels, shared by order. All four sides and the top carry the address.
const tagMeshes=new Map();
function tagMesh(n,kind){
 const key=n+':'+kind;if(tagMeshes.has(key))return tagMeshes.get(key);
 const b=new MeshBuilder(),r=parcelType(kind).r+.009;
 const segs=[[1,1,1,1,1,1,0],[0,1,1,0,0,0,0],[1,1,0,1,1,0,1],[1,1,1,1,0,0,1],[0,1,1,0,0,1,1],[1,0,1,1,0,1,1],[1,0,1,1,1,1,1],[1,1,1,0,0,0,0],[1,1,1,1,1,1,1],[1,1,1,1,0,1,1]];
 const shape=[[0,.057,.058,.012],[.03,.03,.011,.05],[.03,-.03,.011,.05],[0,-.057,.058,.012],[-.03,-.03,.011,.05],[-.03,.03,.011,.05],[0,0,.056,.01]];
 const planes=[M.model([0,0,r]),M.model([0,0,-r],[0,Math.PI,0]),M.model([r,0,0],[0,Math.PI/2,0]),M.model([-r,0,0],[0,-Math.PI/2,0]),M.model([0,r,0],[-Math.PI/2,0,0])];
 for(const m of planes){b.box(.326,.18,.006,'#f9f0d4',[0,0,0],[0,0,0],m);
  Array.from(String(n)).slice(-3).forEach((c,i)=>{const flags=segs[Number(c)];for(let j=0;j<7;j++)if(flags[j]){const [x,y,w,h]=shape[j];b.box(w,h,.009,'#254952',[x+(i-1)*.089,y,.005],[0,0,0],m);}});
 }
 const mesh=renderer.mesh(b);tagMeshes.set(key,mesh);return mesh;
}
function drawTaggedParcel(p,m){renderer.draw(packageMeshes[p.kind]||packageMeshes[0],m);if(p.order)renderer.draw(tagMesh(p.order,p.kind),m);}
for(const h of deliverable)tagMesh(h.num,h.kind);
// Collision-safe first-person walking; exterior buildings remain solid (no new indoor maps).
function slideOut(pos,cx,cz,yaw,hx,hz){
 const c=Math.cos(yaw),s=Math.sin(yaw),dx=pos[0]-cx,dz=pos[2]-cz,x=c*dx-s*dz,z=s*dx+c*dz;
 if(Math.abs(x)>=hx||Math.abs(z)>=hz)return pos;
 let xx=x,zz=z;if(hx-Math.abs(x)<hz-Math.abs(z))xx=Math.sign(x||1)*(hx+.015);else zz=Math.sign(z||1)*(hz+.015);
 return[cx+c*xx+s*zz,pos[1],cz-s*xx+c*zz];
}
function walkCollision(pos){
 let p=[clamp(pos[0],-CITY.limit+1,CITY.limit-1),WALK_EYE,clamp(pos[2],-CITY.limit+1,CITY.limit-1)];
 for(const h of houses)if(Math.abs(h.x-p[0])<8&&Math.abs(h.z-p[2])<8)p=slideOut(p,h.x,h.z,h.yaw,5.96,4.72);
 p=slideOut(p,-20,43,0,4.94,3.94);
 p=slideOut(p,car.p[0],car.p[2],car.yaw,1.94,4.28);
 for(const t of traffic)if(t.phase!=='cleared'&&Math.hypot(t.p[0]-p[0],t.p[2]-p[2])<4.3)p=slideOut(p,t.p[0],t.p[2],t.yaw,1.35,2.3);
 return p;
}
function clearLine(a,b){
 for(const h of houses){const x=houseLocal(h,a),y=houseLocal(h,b);if(segmentBox(x,y,[-5.64,.2,-4.33],[5.64,5.34,4.31]))return false;}
 return true;
}
function rearDistance(){const lp=vehicleToLocal(player.p);return Math.hypot(lp[0],lp[2]-4.4);}
function atBonnet(){const lp=vehicleToLocal(player.p);return Math.abs(lp[0])<3.2&&Math.abs(lp[2]+4.05)<2.6;}
function mobility(){
 if(state.mode!=='playing'||state.time<state.switchUntil)return;
 if(net.mode==='guest'&&!net.applying){action('mobility');return;}
 if(state.view==='cargo'){
  if(player.p[2]<2.35){showHint('走到货箱后沿，再下车。',3);return;}
  if(!rearPass(player.p[0],.25)){showHint('先打开你身后的后门。',3);return;}
  if(Math.abs(car.speed)>BOARD_SPEED){showHint('先减速到 12 km/h 以下再下车。',3);return;}
  const yaw=wrapAngle(car.yaw+player.yaw),p=vehicleToWorld([player.p[0],0,4.65]);
  state.view='outside';player.p=walkCollision([p[0],WALK_EYE,p[2]]);player.yaw=yaw;
  player.pitch=-.12;player.repair=null;player.aimGate=player.aimHouse=null;state.switchUntil=state.time+.35;
  clearInputs();cameraBlend=0;net.watch=false;showHint('已下车。看向地上的编号箱按 E 回收，空手靠近车头维修。',5);syncButtons();
 }else if(state.view==='outside'){
  if(rearDistance()>2.7){showHint('绕到快递车后门附近上车。',3);return;}
  if(Math.abs(car.speed)>BOARD_SPEED){showHint('请驾驶员减速到 12 km/h 以下。',3);return;}
  if(!doors.some(d=>d.angle>1.1)){showHint('先在车尾打开后门。',3);return;}
  const side=doors[0].angle>1.1?-.55:.55;
  state.view='cargo';player.p=[side,2.38,2.80];player.yaw=0;player.pitch=-.12;player.repair=null;
  player.aimGate=player.aimHouse=null;state.switchUntil=state.time+.35;clearInputs();cameraBlend=0;syncButtons();
  showHint('已回货箱。包裹仍在手中；R 放下，走到前方可接管空驾驶位。',4);
 }
}
setView=function(view){
 if(state.view==='outside'){if(view==='cargo')mobility();else showHint('先从后门上车，再走回驾驶位。',3);return;}
 if(view==='drive'&&networked()&&!net.executing&&net.mode==='host'&&net.remoteState?.view==='drive'){showHint('驾驶位有人，等队友先离座。',3);return;}
 const before=state.view;v06.setView(view);if(state.view!==before)player.repair=null;
};
collectFocus=function(){
 if(state.view!=='outside')return v06.collectFocus();
 const e=worldEye(),d=viewDirection();let chosen=null,best=Infinity;
 if(!player.held)for(const p of packages){
  if(p.delivered||!p.order)continue;
  const v=V.sub(p.p,e),dist=V.len(v),t=V.dot(v,d),perp=V.len(V.sub(v,V.mul(d,t)));
  const near=Math.hypot(p.p[0]-e[0],p.p[2]-e[2]);
  if(dist<2.9&&t>0&&(perp<p.r+.36||near<1.5&&player.pitch<-.15)&&dist<best&&clearLine(e,p.p)){chosen=p;best=dist;}
 }
 if(chosen)return{type:'ground',item:chosen};
 if(atBonnet()&&!player.held&&(car.hp<99.9||car.fault))return{type:'repair'};
 if(rearDistance()<2.7){if(!doors.some(d=>d.angle>1.1))return{type:'rearDoor'};return{type:'board'};}
 return null;
};
interact=function(){
 if(state.mode!=='playing'||!isWalking()||state.time<state.switchUntil)return;
 if(net.mode==='guest'&&!net.applying){action('interact');return;}
 const f=collectFocus();if(!f){showHint(state.view==='outside'?'靠近编号包裹并低头；上车请绕到后门。':'低头对准编号箱，或走到车厢前方驾驶位。',3);return;}
 if(f.type==='ground'&&!player.held){
  const i=packages.indexOf(f.item);if(i<0||f.item.delivered)return;
  player.held=packages.splice(i,1)[0];player.held.pending=null;player.held.thrown=false;player.held.age=0;player.held.v=[0,0,0];
  player.held.r=parcelType(player.held.kind).r;currentKind=player.held.kind;state.recovered=(state.recovered||0)+1;
  cancelCharge();pulse('pick');tone(490,.12);showHint('回收 '+parcelLabel(player.held)+'。拿回货箱或从地面投递。',4);syncButtons();
 }else if(f.type==='board')mobility();
 else if(f.type==='rearDoor')toggleBothDoors();
 else if(f.type==='repair')startRepair();
 else if(f.type==='cab')setView('drive');
 else if(f.type==='door')toggleDoor(f.index);
 else if(f.type==='package'&&!player.held){
  const i=cargo.indexOf(f.item);if(i<0)return;player.held=cargo.splice(i,1)[0];player.held.v=[0,0,0];currentKind=player.held.kind;
  cancelCharge();pulse('pick');tone(245,.1);showHint('拿到 '+parcelLabel(player.held)+'，只送到 '+player.held.order+' 号。',4);syncButtons();
 }
};
toggleDoor=function(index){
 if(index!==0&&index!==1||state.mode!=='playing')return;
 if(state.view==='outside'){
  if(rearDistance()>2.7){showHint('靠近车尾才能开门。',3);return;}
  if(net.mode==='guest'&&!net.applying){action('door',{index});return;}
  const d=doors[index];d.target=d.target>0?0:2.52;d.vel+=d.target?1:-1;pulse('interact');tone(180,.12);syncButtons();
 }else v06.toggleDoor(index);
};
toggleBothDoors=function(){
 if(state.view!=='outside'){v06.toggleBothDoors();return;}
 if(state.mode!=='playing'||rearDistance()>2.7)return;
 if(net.mode==='guest'&&!net.applying){action('doors');return;}
 const target=doors.some(d=>d.target>0)?0:2.52;for(const d of doors){d.target=target;d.vel+=target?1:-1;}
 pulse('interact');tone(220,.1);syncButtons();
};
dropPackage=function(){
 if(!player.held||!isWalking()||state.mode!=='playing')return;
 if(net.mode==='guest'&&!net.applying){action('drop');return;}
 const p=player.held;player.held=null;cancelCharge();p.pending=null;p.delivered=false;p.thrown=false;p.age=0;p.spin=[0,0,0];
 if(state.view==='cargo'){
  p.p=[clamp(player.p[0]+Math.cos(player.yaw)*.4,-CAB.half+p.r,CAB.half-p.r),1.3,clamp(player.p[2],CAB.front+p.r,CAB.rear-p.r)];p.v=[0,-.4,0];cargo.push(p);
 }else{const f=viewDirection();p.p=V.add(worldEye(),V.mul(f,.65));p.p[1]=Math.max(p.r+.15,p.p[1]-.5);p.v=[0,-.4,0];packages.push(p);}
 pulse('pick');syncButtons();
};
lockTarget=function(cycle=true){
 if(state.mode!=='playing'||!isWalking())return;
 const h=nextHouse();if(!h)return;
 if(state.view==='cargo'&&(player.p[2]<2.3||!doors.some(d=>d.angle>1.1))){showHint('先走到打开的后门边。',3);return;}
 if(V.len(V.sub(h.gates[0].center,worldEye()))>65){showHint('先靠近当前地址，65 米内可辅助瞄准。',3);return;}
 let i=cycle&&player.aimHouse===h&&player.aimGate?(player.aimGate.index+1)%3:0;
 player.aimHouse=h;player.aimGate=h.gates[i];aimCameraAt(player.aimGate.center);
 showHint('#'+h.num+' '+(i===1?'大门：用重箱蓄力':'窗户')+(player.held?.order!==h.num?' · 手里的包裹不属于这家':''),3);
};
shotSolution=function(){
 const kind=player.held?.kind??currentKind,dir=viewDirection(),origin=V.add(worldEye(),V.add(V.mul(dir,.56),[0,-.13,0]));
 const power=state.charging?state.charge:.60,base=(18+power*22)*parcelType(kind).throwMul,inherited=state.view==='outside'?[0,0,0]:car.velocity.slice();
 let gate=player.aimGate,house=player.aimHouse,point=null;
 if(!gate){let hit=null;for(const h of houses){const q=rayHouse({o:origin,d:dir},h);if(q&&(!hit||q.t<hit.t))hit=q;}if(hit){gate=hit.gate;house=hit.house;point=hit.p;}}
 let v,flight=1.6;
 if(assist&&gate&&V.len(V.sub(gate.center,origin))<66){const d=V.sub(gate.center,origin);flight=clamp(Math.hypot(d[0],d[2])/base,.17,3);v=[d[0]/flight,d[1]/flight+6*flight,d[2]/flight];point=gate.center.slice();}
 else{v=V.add(V.mul(dir,base),inherited);v[1]+=2;point=V.add(origin,V.mul(dir,35));}
 return{origin,v,flight,kind,point,gate,house};
};
startCharge=function(source){
 if(state.mode!=='playing'||!isWalking()||!player.held||state.charging||state.cooldown>0||state.time<state.switchUntil||player.repair)return;
 state.charging=true;state.charge=.1;state.chargeSource=source;
 if(!net.executing){initAudio();$('throwBtn').classList.add('charging');if(net.mode==='guest'&&!net.applying)action('charge');}
};
throwPackage=function(){
 if(!player.held||!isWalking()||state.mode!=='playing'||state.cooldown>0)return;
 if(net.mode==='guest'&&!net.applying){const id=player.held.id,seq=action('throw',{power:state.charge});net.pendingThrow={id,seq};player.held=null;state.cooldown=.32;pulse('throw');syncButtons();return;}
 const s=shotSolution(),p=player.held;player.held=null;p.thrown=true;p.delivered=false;p.pending=null;p.age=0;p.bounces=0;p.blastBoosted=false;
 p.vehicleSpeed=state.view==='outside'?0:Math.abs(car.speed);p.dist=V.len(V.sub(s.point,s.origin));p.spin=[1.8,2.3,.9];p.rot=[.05,worldYaw(),0];
 state.shots++;state.cooldown=.32;
 if(state.view==='outside'){p.p=s.origin;p.v=s.v;packages.push(p);}
 else{p.p=vehicleToLocal(s.origin);p.v=localVelocity({yaw:car.yaw},V.sub(s.v,car.velocity));p.rot[1]=player.yaw;
  if(p.p[2]>CAB.rear+p.r&&rearPass(p.p[0],p.r))releaseToWorld(p);
  else{p.p[0]=clamp(p.p[0],-CAB.half+p.r,CAB.half-p.r);p.p[1]=clamp(p.p[1],CAB.floor+p.r,CAB.roof-p.r);cargo.push(p);}
 }
 pulse('throw');tone(330,.13,'triangle',.15);syncButtons();
};
releaseToWorld=function(p){
 p.p=vehicleToWorld(p.p);p.v=V.add(worldVelocity({yaw:car.yaw},p.v),car.velocity);
 p.rot=[p.rot[0],p.rot[1]+car.yaw,p.rot[2]];p.pending=null;p.delivered=false;p.age=0;p.lastHit=-2;
 if(!p.thrown&&!p.lossCounted){p.lossCounted=true;state.lost++;state.score=Math.max(0,state.score-25);
  if(state.time>=state.warnUntil){showToast('掉货了 · #'+p.order,'停车后可下车捡回 · 本件首次掉落 -$25',2.5);state.warnUntil=state.time+1.4;}
 }
 packages.push(p);
};
deliver=function(h,g,p){
 if(p.delivered)return;
 if(!h.deliverable||p.order!==h.num){
  p.pending=null;p.wrongAt=p.wrongAt||[];
  if(h.deliverable&&!p.wrongAt.includes(h.num)){p.wrongAt.push(h.num);state.score=Math.max(0,state.score-40);state.wrong=(state.wrong||0)+1;state.combo=0;showToast('送错了！','这是 #'+p.order+' 的包裹 · 已退到门口 · -$40',3);}
  else showHint('地址不符，快递退到门口，可下车回收。',3);
  p.p=houseWorld(h,[g.x,p.r+.15,5.10+p.r]);p.v=worldVelocity(h,[0,.4,1.2]);p.returnToDoor=true;p.age=0;return;
 }
 v06.deliver(h,g,p);manifestSignature='';
};
function startRepair(){
 if(state.mode!=='playing'||state.view!=='outside'||player.held||!atBonnet()||player.repair)return;
 if(Math.abs(car.speed)>.45){showHint('先让车停稳并取下砖头，再维修。',3);return;}
 if(car.hp>=99.9&&!car.fault){showHint('车况正常，不需要维修。',2);return;}
 player.repair={at:state.time,origin:player.p.slice()};pulse('interact');showHint('正在维修，保持原地 3 秒。移动或车辆开走会取消。',3);
}
function stepRepair(){
 if(!player.repair||net.mode==='guest')return;
 if(state.view!=='outside'||player.held||Math.abs(car.speed)>.45||!atBonnet()||V.len(V.sub(player.p,player.repair.origin))>.18){player.repair=null;showHint('维修已取消。站稳并等车停下。',2);return;}
 if(car.hp>=99.9&&!car.fault){player.repair=null;return;}
 if(state.time-player.repair.at>=REPAIR_SECONDS){car.hp=100;car.fault='';state.repairs=(state.repairs||0)+1;player.repair=null;showToast('维修完成','轮胎和发动机恢复 · 没有替你关闭后门',2.7);tone(610,.18);}
}
stepPlayer=function(dt){
 if(state.view!=='outside'){v06.stepPlayer(dt);return;}
 if(state.time<state.switchUntil)return;const k=inputs.keys;
 if(k.has('ArrowLeft'))player.yaw+=1.7*dt;if(k.has('ArrowRight'))player.yaw-=1.7*dt;
 if(k.has('ArrowUp'))player.pitch=clamp(player.pitch+1.2*dt,-1.28,1.02);if(k.has('ArrowDown'))player.pitch=clamp(player.pitch-1.2*dt,-1.28,1.02);
 let fw=(k.has('KeyW')||inputs.forward.size?1:0)-(k.has('KeyS')||inputs.back.size?1:0)-inputs.stickY;
 let right=(k.has('KeyD')||inputs.walkRight.size?1:0)-(k.has('KeyA')||inputs.walkLeft.size?1:0)+inputs.stickX;
 const n=Math.max(1,Math.hypot(fw,right));fw/=n;right/=n;
 const speed=player.held?3.6:4.8,old=player.p.slice(),dx=(-Math.sin(player.yaw)*fw+Math.cos(player.yaw)*right)*speed*dt,dz=(-Math.cos(player.yaw)*fw-Math.sin(player.yaw)*right)*speed*dt;
 player.p=walkCollision([old[0]+dx,WALK_EYE,old[2]+dz]);const move=Math.hypot(player.p[0]-old[0],player.p[2]-old[2]);
 if(move>.0001)player.walkPhase+=dt*8;player.move=mix(player.move||0,clamp(move/(speed*dt),0,1),1-Math.exp(-14*dt));
 if(player.aimGate){if(player.aimHouse.done)player.aimGate=player.aimHouse=null;else aimCameraAt(player.aimGate.center);}
 stepRepair();
};
stepCar=function(dt){v06.stepCar(dt);if(car.fault==='tyre'){car.speed=clamp(car.speed,-4.5,8.6);car.yaw=wrapAngle(car.yaw+car.speed*.0025*dt);}};
impact=function(amount){const accepted=state.hitCooldown<=0;v06.impact(amount);if(accepted&&amount>11&&!car.fault){car.fault='tyre';showHint('轮胎受损，车速受限。停车后，空手到车头维修。',5);}};
service=function(){
 if(net.mode==='guest'){showHint('由房主申请道路救援。',3);return;}
 if(!['playing','paused'].includes(state.mode))return;
 const retained=new Map();for(const p of inventory())if(p.order&&!p.delivered&&!retained.has(p.order))retained.set(p.order,p);
 const rx=nearestRoad(car.p[0]);car.p=[rx+3.1,.12,clamp(car.p[2],-CITY.limit+12,CITY.limit-12)];car.yaw=0;
 car.speed=0;car.velocity=[0,0,0];car.accel=[0,0,0];car.kick=[0,0,0];car.hp=100;car.fault='';car.steer=0;
 state.brick=false;brickBody.placed=false;brickBody.p=[.84,.98,-2.47];brickBody.v=[0,0,0];
 packages.length=cargo.length=0;player.held=null;player.repair=null;state.view='drive';player.p=[0,2.38,-.9];player.aimHouse=player.aimGate=null;
 if(remoteReady()){net.remoteActor=newCourier(1);net.remoteActor.name=net.remoteName;net.remoteState=newPersonal();net.remoteInput=blankInput();}
 let i=0;for(const h of deliverable.filter(h=>!h.done)){const p=retained.get(h.num)||makeCargo(h.kind,[0,0,0]),r=parcelType(h.kind).r;p.order=h.num;p.kind=h.kind;p.r=r;p.p=[i%2?.96:-.96,CAB.floor+r+.02+(i>=12?.82:0),-1.04+Math.floor((i%12)/2)*.78];p.v=[0,0,0];p.thrown=false;p.pending=null;p.delivered=false;p.age=0;cargo.push(p);i++;}
 state.score=Math.max(0,state.score-120);state.time+=20;state.switchUntil=0;cameraBlend=0;clearInputs();closeOrders();
 if(state.mode==='paused')resume();showToast('道路救援已到达','未送订单已回货箱 · 最多扣 $120 · 用时 +20 秒',3);syncButtons();
};
resetGame=function(toMenu=false){
 // Set before reset because loadCargo and updateHUD run inside the original reset.
 roundPaid=false;state.selectedOrder=0;state.recovered=0;state.repairs=0;state.wrong=0;car.fault='';
 player.repair=null;closeOrders();v06.resetGame(toMenu);if(remoteReady())net.remoteActor.name=net.remoteName;
 if(!toMenu&&net.mode==='solo')showHint('每箱认准编号！点「订单」选地址；后门下车、回收、维修都用情境操作。',8);
};
endRound=function(){if(roundPaid)return;roundPaid=true;v06.endRound();};
connectionLost=function(){v06.connectionLost();if(net.mode==='host'&&net.remoteActor)net.remoteActor.repair=null;};
updateCamera=function(dt){
 if(net.watch&&state.view==='drive'&&net.connected&&otherAvatar()?.view==='outside'){const p=otherAvatar().p;eye=V.add(p,[5,3.8,6]);at=V.add(p,[0,-.2,0]);return;}
 if(state.view==='outside'&&state.mode!=='menu'&&state.mode!=='wardrobe'){
  const e=worldEye();if(motion)e[1]+=Math.sin(player.walkPhase)*.014;eye=e;at=V.add(e,V.mul(viewDirection(),10));return;
 }v06.updateCamera(dt);
};
avatarMatrix=function(a){
 if(a.view==='outside')return M.model([a.p[0],.13,a.p[2]],[0,a.yaw,0]);
 return M.multiply(M.model(car.p,[0,car.yaw,0]),a.view==='drive'?M.model([-.79,.335,-2.63]):M.model([a.p[0],CAB.floor,a.p[2]],[0,a.yaw,0]));
};
drawPlayers=function(){
 if(state.mode==='menu'||state.mode==='wardrobe')return;
 if(state.view==='drive'&&!net.watch)drawCourier(localAvatar(),avatarMatrix(localAvatar()),state.time);
 const other=otherAvatar();if(other)drawCourier(other,avatarMatrix(other),state.time);
};
drawAvatarLabels=function(){
 if(!net.connected||state.mode==='menu'||state.mode==='wardrobe')return;
 const a=otherAvatar();if(!a)return;const pos=M.point(avatarMatrix(a),[0,2.04,0]),p=renderer.project(pos);
 if(!p||p.x<40||p.x>width-40||p.y<155||p.y>height-130||V.len(V.sub(pos,eye))>48)return;
 const outside=a.view==='outside';
 if(outside&&!clearLine(eye,pos))return;
 if(!(net.watch||state.view==='outside'&&outside||state.view==='cargo'&&a.view==='cargo'||state.view==='cargo'&&a.view==='drive'&&player.p[2]<.2||state.view==='outside'&&a.view==='drive'||state.view==='drive'&&outside))return;
 label(cleanNickname(a.name)+' · '+(a.repair?'维修中':a.charging?'蓄力中':a.held?'抱着 #'+a.held.order:roleLabel(a.view)),p.x,p.y,a.id===1?'#a5e3f1':'#ffda89',coarse()?10:12);
};
const poseV05=courierPose;
courierPose=function(a,t){const v=poseV05(a,t);if(a.repair){v.arms=[1.13+Math.sin(t*8)*.10,.98];v.elbows=[.24,.45];v.lean=-.10;v.knees=[.1,.1];}return v;};
const wrenchMesh=renderer.mesh(new MeshBuilder().box(.05,.05,.34,'#a8c8c7',[0,0,0]).box(.12,.055,.08,'#e3dec4',[0,0,-.17]).box(.036,.055,.1,'#e3dec4',[-.045,0,-.24]).box(.036,.055,.1,'#e3dec4',[.045,0,-.24]));
draw3D=function(){
 v06.draw3D();
 if(state.mode==='playing'&&state.view==='outside'&&player.repair){
  const f=viewDirection(),r=V.norm(V.cross(f,[0,1,0])),up=V.cross(r,f),s=Math.sin(state.time*7)*.045;
  const p=V.add(eye,V.add(V.mul(f,.62),V.add(V.mul(r,.27),V.mul(up,-.32+s))));
  renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT);renderer.draw(wrenchMesh,M.model(p,[player.pitch,worldYaw(),s*3]));
 }
};
function drawParcelGuides(){
 if(state.mode!=='playing'||!isWalking()||player.held)return;
 const collection=state.view==='outside'?packages:cargo,e=worldEye();let count=0;
 for(const c of collection){
  if(!c.order||c.delivered)continue;
  const p=state.view==='outside'?c.p:vehicleToWorld(c.p),dist=V.len(V.sub(p,e));
  if(dist>4.5||count>=5)continue;const s=renderer.project(V.add(p,[0,c.r+.18,0]));
  if(s&&s.x>24&&s.x<width-24&&s.y>185&&s.y<height-158){label('#'+c.order,s.x,s.y,c.order===nextHouse()?.num?'#ffe08d':'#d7e7e5',10);count++;}
 }
}
drawOverlay=function(){v06.drawOverlay();drawParcelGuides();};
// Minimap needn't redraw at render frequency. Include persistent dropped shipment markers.
const drawMapV05=drawMap;
drawMap=function(){
 const now=performance.now();if(now-lastMapDraw<170)return;lastMapDraw=now;drawMapV05();
 const c=mapCtx;for(const p of packages){if(!p.order||p.delivered)continue;c.fillStyle='#ffc787';c.fillRect(110+p.p[0]*.87-2,110+p.p[2]*.87-2,4,4);}
 if(state.view==='outside'){c.fillStyle='#a6e3f1';c.beginPath();c.arc(110+player.p[0]*.87,110+player.p[2]*.87,3,0,TAU);c.fill();}
};
syncButtons=function(){
 if(net.executing)return;v06.syncButtons();
 $('cargoUI').classList.toggle('hidden',!isWalking());$('viewTag').textContent=roleLabel(state.view);
 $('keyHelp').textContent=state.view==='drive'?'WASD 驾驶 · B 放砖 · V 离座 · M 订单 · Esc 暂停':'WASD 移动 · 拖动/方向键观察 · E 交互 · V 上下车/驾驶 · G 后门 · F 瞄准 · R 放下 · 空格投掷 · M 订单';
};
updateHUD=function(){
 if(net.executing)return;v06.updateHUD();
 const h=nextHouse();$('address').textContent=h?'#'+h.num+' '+h.item:'派送完成';
 const held=player.held,walking=isWalking(),outside=state.view==='outside',f=walking?collectFocus():null;
 $('cargoUI').classList.toggle('hidden',!walking);$('viewTag').textContent=roleLabel(state.view);
 if(h&&outside)$('distance').textContent=Math.round(Math.hypot(h.x-player.p[0],h.z-player.p[2]))+' m';
 $('localRoleHud').textContent=roleLabel(state.view);if(otherAvatar())$('remoteRoleHud').textContent=otherAvatar().repair?'维修中':roleLabel(otherAvatar().view);
 const nearRear=outside?rearDistance()<2.7:state.view==='cargo'&&player.p[2]>2.3;
 $('boardBtn').classList.toggle('hidden',!nearRear||state.mode!=='playing');$('boardBtn').textContent=outside?'上车':'下车';
 $('rearControls').classList.toggle('hidden',!nearRear);$('assistAimBtn').classList.toggle('hidden',!held||!walking||(!outside&&player.p[2]<2.25));
 $('throwBtn').classList.toggle('hidden',!held||!walking);$('dropBtn').classList.toggle('hidden',!held||!walking);$('powerTrack').classList.toggle('hidden',!held||!walking);
 let text='靠近箱子',icon='✋',focusText='';
 if(f?.type==='package'||f?.type==='ground'){text=f.type==='ground'?'回收':'拿起';focusText=parcelLabel(f.item);icon='📦';}
 else if(f?.type==='repair'){text=player.repair?'维修中':'维修';focusText=car.fault?'轮胎受损 · 停稳后维修':'车况 '+Math.round(car.hp)+'% · 停稳后维修';icon='⚒';}
 else if(f?.type==='board'){text='上车';focusText='从后门回到货箱';icon='↥';}
 else if(f?.type==='rearDoor'){text='开后门';focusText='打开后门才能上车';icon='▥';}
 else if(f?.type==='door'){text=doors[f.index].target?'关门':'开门';focusText='后门 · '+text;icon='▥';}
 else if(f?.type==='cab'){text='驾驶';focusText='空位才能接管，请先停稳';icon='↶';}
 $('interactBtn').classList.toggle('hidden',!walking||!!held&&!['cab','board'].includes(f?.type));$('interactBtn').disabled=!f||!!player.repair;
 $('interactText').textContent=text;$('interactIcon').textContent=icon;
 if(held)focusText=parcelLabel(held)+(state.charging?' · 蓄力 '+Math.round(state.charge*100)+'%':'');
 $('focusLabel').textContent=focusText;$('crosshair').classList.toggle('locked',!!player.aimGate);
 $('taskBadge').classList.toggle('hidden',!held||!h);if(held&&h){const match=held.order===h.num;$('taskBadge').classList.toggle('mismatch',!match);$('taskBadge').textContent=match?'✓ 包裹 #'+held.order+' 与目标一致':'手持 #'+held.order+' / 导航 #'+h.num+' · 注意地址';}
 $('workProgress').classList.toggle('hidden',!player.repair);if(player.repair){const t=clamp((state.time-player.repair.at)/REPAIR_SECONDS,0,1);$('workLabel').textContent='维修中 '+Math.round(t*100)+'% · 移动取消';$('workFill').style.width=(t*100)+'%';}
 if(car.fault&&!outside){$('risk').textContent='轮胎受损 · 车速受限 · 停车后到车头维修';$('risk').classList.remove('hidden');}
 else if(outside){$('risk').classList.add('hidden');$('autoChip').textContent=hasDriver()?'队友在驾驶':'车辆无人驾驶';$('stockChip').textContent='车外 '+packages.filter(p=>p.order&&!p.delivered).length+' 件';}
 updateManifest();
};
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
