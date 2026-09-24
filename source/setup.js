/* CRASH DELIVERY MULTIPLAYER V0.7 ONLINE — original low-poly assets; independent two-player shared-vehicle game.
 * Frame-local cargo physics, independent driver/cargo inputs, swept parcel collision.
 * The lightweight contact model is intentionally arcade-like, not a general rigid-body solver.
 */
'use strict';
(() => {
const $=id=>document.getElementById(id), world=$('world'), overlay=$('overlay');
const ctx=overlay.getContext('2d'), mapCtx=$('minimap').getContext('2d');
let renderer;
try { renderer=new PocketGL(world); } catch(e) { $('errorText').textContent=e.message; $('errorScreen').classList.remove('hidden'); $('reloadBtn').onclick=()=>location.reload(); return; }
const coarse=()=>matchMedia('(pointer:coarse)').matches;
const nativeReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const SAVE_KEY='crash_delivery_mp_v05';
let stored={};
try { stored=JSON.parse(localStorage.getItem(SAVE_KEY)||'null')||JSON.parse(localStorage.getItem('crash_delivery_offline_v01')||'{}')||{}; } catch(e) {}
let best=Number.isFinite(Number(stored.best))?clamp(Number(stored.best),0,99999999):0;
let soundOn=stored.sound!==false, assist=stored.assist!==false, motion=stored.motion!==false&&!nativeReduced;
let quality=['auto','high','low'].includes(stored.quality)?stored.quality:'auto';
function cleanNickname(v){const raw=String(v??'').trim().replace(/[<>\n\r\t]/g,'');return Array.from(raw).slice(0,12).join('')||'快递员';}
let nickname=cleanNickname(stored.nickname||'快递员');
let credits=clamp(Number(stored.credits)||0,0,99999999);
const upgrades={engine:clamp(Number(stored.upgrades?.engine)||0,0,3),brakes:clamp(Number(stored.upgrades?.brakes)||0,0,3),grip:clamp(Number(stored.upgrades?.grip)||0,0,3),mat:clamp(Number(stored.upgrades?.mat)||0,0,3)};
const PACKAGE_TYPES=[
 {name:'普通箱',icon:'📦',mass:1,r:.265,throwMul:1,fragile:0},
 {name:'重箱',icon:'📺',mass:2.8,r:.36,throwMul:.82,fragile:0},
 {name:'小包',icon:'📱',mass:.55,r:.21,throwMul:1.22,fragile:.15},
 {name:'易碎件',icon:'🍷',mass:.9,r:.27,throwMul:.96,fragile:1},
 {name:'圆筒',icon:'🛢',mass:1.25,r:.29,throwMul:1.02,fragile:.25},
 {name:'神秘件',icon:'❓',mass:1.05,r:.28,throwMul:1.08,fragile:.35}
];
const parcelType=k=>PACKAGE_TYPES[k]||PACKAGE_TYPES[0];
let adaptiveScale=2, fpsEMA=60, slowTime=0, fastTime=0, qualityWait=0;
const maxViewport=renderer.gl.getParameter(renderer.gl.MAX_VIEWPORT_DIMS);
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:'0.7.0-online',best,credits,upgrades,sound:soundOn,assist,quality,motion,nickname}));}catch(e){}}
let seed=981;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;}
const state={mode:'menu',view:'drive',time:0,score:0,delivered:0,shots:0,lost:0,explosions:0,combo:0,lastDelivery:-100,brick:false,charge:0,charging:false,chargeSource:null,cooldown:0,toastUntil:0,shake:0,hitCooldown:0,hintUntil:0,switchUntil:0,warnUntil:0,helpFrom:'menu',nextId:1,damageCost:0,trickCount:0,lastBreakdown:''};
const car={p:[3.2,.12,72],yaw:0,speed:0,steer:0,roll:0,wheelAngle:0,hp:100,velocity:[0,0,0],accel:[0,0,0],yawRate:0,lastSpeed:0,kick:[0,0,0],offRoad:0};
// Cargo interior: floor y=.82, walls x=+-1.48, bulkhead z=-1.64, rear z=3.43.
const CAB={half:1.48,front:-1.64,rear:3.43,floor:.82,roof:3.62};
let player={p:[0,2.38,-.85],yaw:Math.PI,pitch:-.19,held:null,walkPhase:0,aimGate:null,aimHouse:null,focus:null};
const doors=[{side:-1,angle:0,vel:0,target:0},{side:1,angle:0,vel:0,target:0}];
const brickBody={p:[.84,.98,-2.47],v:[0,0,0],rot:[0,.15,0],placed:false};
let inputs={keys:new Set(),left:new Set(),right:new Set(),gas:new Set(),brake:new Set(),forward:new Set(),back:new Set(),walkLeft:new Set(),walkRight:new Set(),stickX:0,stickY:0};
const houses=[], packages=[], cargo=[], debris=[], traffic=[], lights=[], effects=[];
// Multiplayer 0.2: one authoritative world, two independent couriers.
// Rendering/prediction never owns parcel inventory, doors, scores or vehicle physics.
const NET_PROTOCOL='crash-delivery-mp070-1';
const net={mode:'solo',peer:null,conn:null,room:'',connected:false,executing:false,applying:false,
 remoteActor:null,remoteInput:null,remoteState:null,hostActor:null,lastInput:0,lastRecv:0,lastSend:0,
 actionSeq:0,ack:0,lastAction:0,epoch:0,seenEpoch:-1,snapshot:null,receivedAt:0,watch:false,
 rtt:0,lastPing:0,token:0,timer:null,status:'创建房间，或输入好友的 6 位房间码。',pauseWho:'',pendingThrow:null,remoteName:'队友'};
const PERSONAL_FIELDS=['view','charge','charging','chargeSource','cooldown','switchUntil'];
const blankInput=()=>({keys:new Set(),left:new Set(),right:new Set(),gas:new Set(),brake:new Set(),forward:new Set(),back:new Set(),walkLeft:new Set(),walkRight:new Set(),stickX:0,stickY:0});
const newCourier=id=>({id,name:id?'蓝帽快递员':'橙帽快递员',p:[id? .42:-.42,2.38,-.9],yaw:Math.PI,pitch:-.20,held:null,walkPhase:0,move:0,aimGate:null,aimHouse:null,focus:null,anim:'idle',animAt:0});
const newPersonal=()=>({view:'cargo',charge:0,charging:false,chargeSource:null,cooldown:0,switchUntil:0});
function remoteReady(){return net.mode==='host'&&net.connected&&net.remoteActor;}
function networked(){return net.mode!=='solo';}
function netText(text){net.status=text;const el=$('netStatus');if(el)el.textContent=text;}
function netSend(m,optional=false){if(!net.connected||!net.conn?.open)return false;try{if(optional&&(net.conn.bufferSize>1||(net.conn.dataChannel?.bufferedAmount||0)>65536))return false;net.conn.send(m);return true;}catch(e){return false;}}
function inRemote(fn){if(!net.remoteActor)return;const oldPlayer=player,oldInput=inputs,oldKind=currentKind,oldExecuting=net.executing,personal={};net.localView=state.view;
 for(const k of PERSONAL_FIELDS){personal[k]=state[k];state[k]=net.remoteState[k];}player=net.remoteActor;inputs=net.remoteInput;net.executing=true;
 try{return fn();}finally{for(const k of PERSONAL_FIELDS){net.remoteState[k]=state[k];state[k]=personal[k];}player=oldPlayer;inputs=oldInput;currentKind=oldKind;net.executing=oldExecuting;}}
function pulse(action){player.anim=action;player.animAt=state.time;}
function localAvatar(){return {...player,name:cleanNickname(player.name||nickname),view:state.view,charge:state.charge,charging:state.charging};}
function otherAvatar(){if(net.mode==='host'&&net.remoteActor)return {...net.remoteActor,...net.remoteState};if(net.mode==='guest')return net.hostActor;return null;}
function hasDriver(){if(state.view==='drive')return true;return otherAvatar()?.view==='drive';}
function roomId(code){return 'crash-delivery-mp070-'+code;}
function makeRoomCode(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(100000+a[0]%900000);}
let peerLoading=null;
function loadPeer(){if(window.Peer)return Promise.resolve();if(peerLoading)return peerLoading;
 peerLoading=new Promise(async(resolve,reject)=>{for(const src of ['https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js','https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js']){
   try{await new Promise((ok,no)=>{const s=document.createElement('script');let done=false;const finish=e=>{if(done)return;done=true;clearTimeout(t);e?(s.remove(),no(e)):ok();};const t=setTimeout(()=>finish(Error('加载超时')),7000);s.src=src;s.async=true;s.onload=()=>finish(window.Peer?null:Error('组件不可用'));s.onerror=()=>finish(Error('下载失败'));document.head.appendChild(s);});resolve();return;}catch(e){}
 }reject(Error('联机组件下载失败。单人及角色预览仍可用；请检查网络后重试。'));}).finally(()=>peerLoading=null);return peerLoading;}
function peerOptions(){// Optional own signaling/TURN settings; no private credentials are bundled.
 const custom=window.CRASH_NETWORK_CONFIG;return custom&&typeof custom==='object'?custom:{debug:0};}
function stopNetwork(toMenu=true){net.token++;clearTimeout(net.timer);net.timer=null;const c=net.conn,p=net.peer;net.connected=false;net.conn=null;net.peer=null;net.mode='solo';net.remoteActor=net.remoteInput=net.remoteState=net.hostActor=null;net.snapshot=null;net.watch=false;net.pendingThrow=null;net.remoteName='队友';
 try{c?.close();p?.destroy();}catch(e){}net.room='';net.pauseWho='';if(toMenu)resetGame(true);$('hostBtn').disabled=$('joinBtn').disabled=false;netText('创建房间，或输入好友的 6 位房间码。');updateNetHUD();}
function roomFailure(text){clearTimeout(net.timer);net.timer=null;netText(text);$('hostBtn').disabled=$('joinBtn').disabled=false;}
function describePeerError(e){return ({'unavailable-id':'房间码已占用，请重新创建。','peer-unavailable':'没有找到房间，请核对房间码和双方版本。','network':'无法连接信令服务，请检查网络。','browser-incompatible':'浏览器不支持此联机方式，请换用新版浏览器。','webrtc':'设备之间未能建立直连，请尝试另一网络。','server-error':'信令服务暂时不可达。'}[e?.type]||('连接错误：'+(e?.type||e?.message||'未知')));}
async function hostRoom(){nickname=cleanNickname($('nicknameInput')?.value||nickname);player.name=nickname;save();stopNetwork(false);const token=net.token;net.mode='host';net.room=makeRoomCode();$('hostBtn').disabled=$('joinBtn').disabled=true;netText('正在连接房间服务…');
 try{await loadPeer();if(token!==net.token)return;const p=net.peer=new Peer(roomId(net.room),peerOptions());
 p.on('open',()=>{if(token!==net.token)return;clearTimeout(net.timer);netText('房间码 '+net.room+' · 等待队友加入 · 双方都需使用V0.7 ONLINE');$('copyRoomBtn').classList.remove('hidden');});
 p.on('connection',c=>{if(token!==net.token)return c.close();if(net.conn||c.metadata?.protocol!==NET_PROTOCOL){c.on('open',()=>{try{c.send({t:'reject',reason:net.conn?'房间已满（最多 2 人）。':'版本不一致，请双方更新到V0.7 ONLINE。'});}catch(e){}setTimeout(()=>c.close(),150);});return;}net.remoteName=cleanNickname(c.metadata?.nickname||'队友');setupConn(c);});
 p.on('error',e=>roomFailure(describePeerError(e)));p.on('disconnected',()=>{if(token===net.token&&!p.destroyed){netText('房间信令暂时断开；已有直连会继续，正在重连。');try{p.reconnect();}catch(e){}}});
 net.timer=setTimeout(()=>{if(!p.open)roomFailure('房间服务连接超时，请检查网络后重试。');},14000);
 }catch(e){if(token===net.token)roomFailure(e.message);}}
async function joinRoom(){nickname=cleanNickname($('nicknameInput')?.value||nickname);player.name=nickname;save();const code=$('roomCode').value.replace(/\D/g,'').slice(0,6);if(code.length!==6){netText('请输入完整的 6 位房间码。');return;}stopNetwork(false);net.mode='guest';net.room=code;const token=net.token;$('hostBtn').disabled=$('joinBtn').disabled=true;netText('正在加入 '+code+'…');
 try{await loadPeer();if(token!==net.token)return;const p=net.peer=new Peer(undefined,peerOptions());p.on('open',()=>{if(token!==net.token)return;setupConn(p.connect(roomId(code),{reliable:true,serialization:'json',metadata:{protocol:NET_PROTOCOL,nickname}}));});p.on('error',e=>roomFailure(describePeerError(e)));
 net.timer=setTimeout(()=>{if(!net.connected)roomFailure('未能建立直连。请核对版本和房间码，或换一个网络；部分网络需要 TURN 中继。');},18000);
 }catch(e){if(token===net.token)roomFailure(e.message);}}
function beginConnection(){clearTimeout(net.timer);net.connected=true;net.lastInput=net.lastRecv=performance.now();net.lastAction=net.actionSeq=net.ack=0;net.lastSend=0;net.pendingThrow=null;net.watch=false;net.snapshot=null;net.seenEpoch=-1;
 net.applying=true;resetGame(false);net.applying=false;
 if(net.mode==='host'){player.id=0;player.name=nickname;net.remoteActor=newCourier(1);net.remoteActor.name=net.remoteName;net.remoteInput=blankInput();net.remoteState=newPersonal();net.epoch++;netSend({t:'hello',protocol:NET_PROTOCOL});netSend(netSnapshot());showHint('你负责驾驶，队友在货箱内独立操作。T /「看队友」切换车内观察。',8);}
 else{player.id=1;player.name=nickname;state.view='cargo';player.p=[.42,2.38,-.9];net.hostActor={...newCourier(0),view:'drive'};showHint('你是 2 号快递员。走到车尾、打开后门、拿箱并投掷。',8);}
 if(net.mode==='guest')netSend({t:'identity',nickname});netText('房间 '+net.room+' · 双人已连接');syncButtons();updateNetHUD();}
function setupConn(c){net.conn=c;c.on('open',()=>{if(c===net.conn)beginConnection();});c.on('data',m=>{if(c===net.conn)onNetData(m);});c.on('close',()=>{if(c===net.conn)connectionLost();});c.on('error',()=>{if(c===net.conn)connectionLost();});}
function connectionLost(){net.connected=false;net.conn=null;netText('队友连接已断开。可退出联机后重新创建 / 加入。');net.pauseWho='连接已断开';
 if(net.mode==='host'&&net.remoteActor?.held){const c=net.remoteActor.held;c.p=[.6,1.4,-.4];c.v=[0,0,0];cargo.push(c);net.remoteActor.held=null;}
 if(net.remoteInput)net.remoteInput=blankInput();if(state.mode==='playing'){net.applying=true;pause();net.applying=false;}updateNetHUD();}
const q3=x=>Math.round(x*1000)/1000;
const qvec=p=>p.map(q3);
function packBox(c){return {id:c.id,kind:c.kind,p:qvec(c.p),rot:qvec(c.rot),v:qvec(c.v||[0,0,0]),delivered:!!c.delivered,order:c.order||0,lossCounted:!!c.lossCounted,wrongAt:c.wrongAt||[],integrity:q3(c.integrity??100),bounces:c.bounces||0,blastBoosted:!!c.blastBoosted,mystery:c.mystery||null};}
function unpackBox(c){return {id:c.id,kind:c.kind,r:parcelType(c.kind).r,mass:parcelType(c.kind).mass,p:c.p.slice(),rot:c.rot.slice(),v:(c.v||[0,0,0]).slice(),spin:[0,0,0],age:0,thrown:false,pending:null,delivered:!!c.delivered,order:c.order||0,lossCounted:!!c.lossCounted,wrongAt:c.wrongAt||[],lastHit:-2,dist:0,vehicleSpeed:0,integrity:c.integrity??100,bounces:c.bounces||0,blastBoosted:!!c.blastBoosted,mystery:c.mystery||null};}
function packActor(a,s){return {id:a.id,name:cleanNickname(a.name||('快递员'+(a.id+1))),p:qvec(a.p),yaw:q3(a.yaw),pitch:q3(a.pitch),walkPhase:q3(a.walkPhase),move:q3(a.move||0),anim:a.anim,animAt:q3(a.animAt||0),held:a.held?packBox(a.held):null,repair:a.repair?{at:a.repair.at}:null,view:s.view,charge:q3(s.charge||0),charging:!!s.charging};}
function netSnapshot(){return {t:'world',protocol:NET_PROTOCOL,epoch:net.epoch,ack:net.lastAction,mode:state.mode,pauseWho:net.pauseWho,
 car:{p:qvec(car.p),yaw:q3(car.yaw),speed:q3(car.speed),hp:q3(car.hp),steer:q3(car.steer),roll:q3(car.roll),wheelAngle:q3(car.wheelAngle),velocity:qvec(car.velocity),fault:car.fault||''},
 upgrades:{...upgrades},state:{time:q3(state.time),score:state.score,delivered:state.delivered,brick:state.brick,shots:state.shots,lost:state.lost,explosions:state.explosions,damageCost:state.damageCost,trickCount:state.trickCount,selectedOrder:state.selectedOrder||0,recovered:state.recovered||0,repairs:state.repairs||0,wrong:state.wrong||0,lastBreakdown:state.lastBreakdown||''},
 doors:doors.map(d=>({angle:q3(d.angle),target:d.target})),brick:{p:qvec(brickBody.p),rot:qvec(brickBody.rot),placed:brickBody.placed},
 houses:houses.map(h=>({num:h.num,done:h.done,g:h.gates.map(g=>g.broken)})),cargo:cargo.map(packBox),packages:packages.map(packBox),
 traffic:traffic.map(t=>({id:t.id,p:qvec(t.p),yaw:q3(t.yaw),hp:q3(t.hp),phase:t.phase,burn:q3(t.burn),wreckAge:q3(t.wreckAge),speed:q3(t.speed),intent:t.intent||'straight',wait:t.wait||'',braking:!!t.braking,incidentAge:q3(t.incidentAge||0),motion:t.motion||'road',from:t.from,to:t.to,v:qvec(t.phase==='normal'?V.mul([-Math.sin(t.yaw),0,-Math.cos(t.yaw)],t.speed):t.drift)})),cityStats:{...cityTrafficStats},
 actors:[packActor(player,state),net.remoteActor?packActor(net.remoteActor,net.remoteState):null]};}
function movementInput(){const k=inputs.keys,keys=[];for(const code of ['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])if(k.has(code))keys.push(code);
 if(inputs.gas.size||inputs.forward.size)keys.push('KeyW');if(inputs.brake.size||inputs.back.size)keys.push('KeyS');if(inputs.left.size||inputs.walkLeft.size)keys.push('KeyA');if(inputs.right.size||inputs.walkRight.size)keys.push('KeyD');
 return {keys,stickX:q3(inputs.stickX),stickY:q3(inputs.stickY),yaw:q3(player.yaw),pitch:q3(player.pitch)};}
function ingestInput(i){if(!i||typeof i!=='object'||!net.remoteInput)return;const allowed=['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];net.remoteInput.keys=new Set(Array.isArray(i.keys)?i.keys.slice(0,12).filter(k=>allowed.includes(k)&&(net.remoteState.view==='drive'||!k.startsWith('Arrow'))):[]);
 for(const k of ['stickX','stickY'])net.remoteInput[k]=Number.isFinite(i[k])?clamp(i[k],-1,1):0;
 if(Number.isFinite(i.yaw))net.remoteActor.yaw=wrapAngle(i.yaw);if(Number.isFinite(i.pitch))net.remoteActor.pitch=clamp(i.pitch,-1.28,1.02);net.lastInput=performance.now();}
function action(name,args={}){if(net.mode!=='guest'||!net.connected)return 0;const seq=++net.actionSeq;netSend({t:'action',name,args,seq,epoch:net.seenEpoch,input:movementInput()});return seq;}
function worldEvent(kind,data){if(net.mode==='host'&&net.connected&&!net.applying)netSend({t:'event',kind,...data});}
function onNetData(m){if(!m||typeof m!=='object')return;net.lastRecv=performance.now();
 if(m.t==='ping'){netSend({t:'pong',at:m.at});return;}if(m.t==='pong'){net.rtt=Math.max(0,Math.round(performance.now()-m.at));return;}
 if(m.t==='hello'&&m.protocol!==NET_PROTOCOL){roomFailure('版本不一致，请双方更新到V0.7 ONLINE。');return;}
 if(m.t==='reject'){roomFailure(m.reason||'无法加入房间。');return;}
 if(net.mode==='host'){
  if(m.t==='identity'){net.remoteName=cleanNickname(m.nickname);if(net.remoteActor)net.remoteActor.name=net.remoteName;return;}
  if(m.t==='input'){ingestInput(m.input);return;}
  if(m.t==='control'){if(m.name==='pause'&&state.mode==='playing'){net.pauseWho='队友暂停了游戏';pause();}else if(m.name==='resume'&&state.mode==='paused'){net.pauseWho='';resume();}return;}
  if(m.t!=='action'||m.epoch!==net.epoch||!Number.isSafeInteger(m.seq)||m.seq<=net.lastAction)return;net.lastAction=m.seq;ingestInput(m.input);if(state.mode!=='playing')return;
  const a=m.args&&typeof m.args==='object'?m.args:{};
  inRemote(()=>{switch(m.name){case 'interact':interact();break;case 'door':if(a.index===0||a.index===1)toggleDoor(a.index);break;case 'doors':toggleBothDoors();break;case 'drop':dropPackage();break;
  case 'charge':startCharge('remote');break;case 'throw':if(state.charging&&player.held){state.charge=clamp(Number.isFinite(a.power)?a.power:.1,.1,Math.min(1,state.charge+.20));throwPackage();cancelCharge();}break;
  case 'mobility':mobility();break;case 'selectOrder':selectOrder(a.num);break;case 'cancel':cancelCharge();break;case 'view':if(['cargo','drive'].includes(a.view))setView(a.view);break;case 'brick':toggleBrick();break;case 'wave':pulse('wave');break;}});syncButtons();return;
 }
 if(net.mode!=='guest')return;
 if(m.t==='world'&&m.protocol===NET_PROTOCOL){applyHostSnapshot(m);return;}
 if(m.t==='event'){net.applying=true;try{if(m.kind==='hint')showHint(String(m.text).slice(0,180),4);else if(m.kind==='toast')showToast(String(m.title).slice(0,80),String(m.sub||'').slice(0,180),m.duration||3);
 else if(m.kind==='gate'){const h=houses.find(h=>h.num===m.num),g=h?.gates[m.index];if(g&&!g.broken)breakGate(h,g,{v:m.v||[0,0,0]});}
 else if(m.kind==='explosion'){const t=traffic[m.id];if(t){if(Array.isArray(m.p))t.p=m.p.slice();explode(t);}}
 }finally{net.applying=false;}}
}
function applyHostSnapshot(m){if(!m.car||!Array.isArray(m.actors)||!m.actors[1])return;
 if(!Number.isSafeInteger(m.epoch)||m.epoch<net.seenEpoch)return;const fresh=net.seenEpoch!==m.epoch;net.applying=true;try{
 if(fresh){resetGame();net.seenEpoch=m.epoch;player.id=1;net.pendingThrow=null;net.hostActor=null;}
 net.snapshot=m;net.receivedAt=performance.now();net.ack=m.ack||0;Object.assign(state,m.state);/* Only host simulates the vehicle; guest's local garage stays private. */net.pauseWho=m.pauseWho||'';
 const a=m.actors[1],changed=state.view!==a.view;if(fresh||changed){state.view=a.view;player.p=a.p.slice();player.yaw=a.yaw;player.pitch=a.pitch;cancelCharge();clearInputs();net.watch=false;cameraBlend=0;}
 else{const error=V.len(V.sub(a.p,player.p)),moving=movementInput().keys.some(k=>['KeyW','KeyS','KeyA','KeyD'].includes(k))||Math.hypot(inputs.stickX,inputs.stickY)>.1;
  if(error>1.8)player.p=a.p.slice();else if(error>.12&&!moving||error>.6)player.p=V.lerp(player.p,a.p,.28);}
 if(net.pendingThrow&&net.ack>=net.pendingThrow.seq)net.pendingThrow=null;
 player.repair=a.repair?{at:a.repair.at,origin:a.p.slice()}:null;player.name=cleanNickname(a.name||player.name||nickname);player.held=a.held&&!(net.pendingThrow&&net.pendingThrow.id===a.held.id)?unpackBox(a.held):null;
 if(a.animAt>=(player.animAt||0)){player.anim=a.anim;player.animAt=a.animAt;}
 const ha=m.actors[0];if(!net.hostActor)net.hostActor={...ha,p:ha.p.slice(),held:ha.held?unpackBox(ha.held):null};
 else{const oldP=net.hostActor.p,oldYaw=net.hostActor.yaw;Object.assign(net.hostActor,ha,{p:oldP,yaw:oldYaw,held:ha.held?unpackBox(ha.held):null});}
 if(fresh){Object.assign(car,m.car,{p:m.car.p.slice(),velocity:m.car.velocity.slice()});}
 car.hp=m.car.hp;car.fault=m.car.fault||'';state.brick=m.state.brick;brickBody.placed=m.brick.placed;
 m.houses.forEach((h,i)=>{if(!houses[i]||houses[i].num!==h.num)return;houses[i].done=h.done;h.g.forEach((broken,j)=>{const g=houses[i].gates[j];if(broken&&!g.broken)breakGate(houses[i],g,{v:[0,0,0]});g.broken=broken;});});
 const oldCargo=new Map(cargo.map(c=>[c.id,c])),oldBoxes=new Map(packages.map(c=>[c.id,c]));cargo.length=packages.length=0;
 for(const c of m.cargo){const p=oldCargo.get(c.id)||unpackBox(c);p.target=c;p.kind=c.kind;p.order=c.order||0;p.integrity=c.integrity??100;p.lossCounted=!!c.lossCounted;cargo.push(p);}
 for(const c of m.packages){const p=oldBoxes.get(c.id)||unpackBox(c);p.target=c;p.delivered=c.delivered;p.order=c.order||0;p.kind=c.kind;p.integrity=c.integrity??100;p.lossCounted=!!c.lossCounted;packages.push(p);}
 m.traffic.forEach((x,i)=>{const t=traffic[i];if(!t)return;if(x.phase==='wreck'&&t.phase!=='wreck'&&!fresh)explode(t);t.target=x;t.hp=x.hp;t.phase=x.phase;t.burn=x.burn;t.wreckAge=x.wreckAge;t.speed=x.speed||0;t.intent=x.intent||'straight';t.wait=x.wait||'';t.braking=!!x.braking;t.incidentAge=x.incidentAge||0;t.motion=x.motion||'road';t.from=x.from;t.to=x.to;});if(m.cityStats)cityTrafficStats={...m.cityStats};refreshBlockedEdges();
 const prev=state.mode;state.mode=['playing','paused','finished'].includes(m.mode)?m.mode:'playing';
 $('pauseScreen').classList.toggle('hidden',state.mode!=='paused');$('menu').classList.add('hidden');$('hud').classList.remove('hidden');
 if(state.mode==='finished'&&prev!=='finished')endRound();if(state.mode!=='finished')$('endScreen').classList.add('hidden');
 if(state.mode!=='playing')clearInputs();syncButtons();
 }finally{net.applying=false;}updateNetHUD();}
function tickGuest(dt){if(!net.snapshot)return;const m=net.snapshot,a=1-Math.exp(-20*dt),lag=m.mode==='playing'?Math.min(.12,(performance.now()-net.receivedAt)/1000):0;
 car.p=V.lerp(car.p,V.add(m.car.p,V.mul(m.car.velocity,lag)),a);car.yaw=wrapAngle(car.yaw+wrapAngle(m.car.yaw-car.yaw)*a);car.velocity=m.car.velocity.slice();
 for(const k of ['speed','steer','roll','wheelAngle'])car[k]=mix(car[k],m.car[k],a);state.time=m.state.time+lag;
 m.doors.forEach((d,i)=>{doors[i].angle=mix(doors[i].angle,d.angle,a);doors[i].target=d.target;});brickBody.p=V.lerp(brickBody.p,m.brick.p,a);brickBody.rot=m.brick.rot.slice();
 for(const c of cargo){if(c.target){c.p=V.lerp(c.p,c.target.p,a);c.rot=V.lerp(c.rot,c.target.rot,a);}}
 for(const c of packages){if(c.target){c.p=V.lerp(c.p,V.add(c.target.p,V.mul(c.target.v,lag)),a);c.rot=V.lerp(c.rot,c.target.rot,a);}}
 for(const t of traffic){if(t.target){t.p=V.lerp(t.p,V.add(t.target.p,V.mul(t.target.v||[0,0,0],Math.min(lag,.09))),a);t.yaw=wrapAngle(t.yaw+wrapAngle(t.target.yaw-t.yaw)*a);}}
 const h=m.actors[0];if(net.hostActor){net.hostActor.p=V.lerp(net.hostActor.p,h.p,a);net.hostActor.yaw=wrapAngle(net.hostActor.yaw+wrapAngle(h.yaw-net.hostActor.yaw)*a);}
 if(state.mode==='playing'){state.cooldown=Math.max(0,state.cooldown-dt);state.shake=Math.max(0,state.shake-dt*.7);if(state.charging)state.charge=Math.min(1,state.charge+dt*.9);stepPlayer(dt);stepEffects(dt);}}
function netTick(){const now=performance.now();if(!net.connected||!net.conn?.open)return;
 const sendEvery=net.mode==='host'?(coarse()?90:70):50;if(now-net.lastSend>=sendEvery){net.lastSend=now;if(net.mode==='host')netSend(netSnapshot(),true);else netSend({t:'input',input:movementInput()},true);}
 if(now-net.lastPing>1800){net.lastPing=now;netSend({t:'ping',at:now},true);}
 if(net.mode==='host'&&now-net.lastInput>700&&net.remoteInput){net.remoteInput.keys.clear();net.remoteInput.stickX=net.remoteInput.stickY=0;}
 if(now-net.lastRecv>6000&&state.mode==='playing'){net.pauseWho='网络等待中，已暂停防止失控';net.applying=true;pause();net.applying=false;}}
function updateNetHUD(){const online=networked(),other=otherAvatar();$('cancelNetBtn').classList.toggle('hidden',!online);$('game').dataset.online=online?'true':'false';$('roomStrip').classList.toggle('hidden',!online);$('leaveBtn').classList.toggle('hidden',!online);$('copyRoomBtn').classList.toggle('hidden',!net.room);
 const myName=cleanNickname(player.name||nickname),otherName=other?cleanNickname(other.name||'队友'):(net.connected?cleanNickname(net.remoteName):'等待队友');const myRole=state.view==='drive'?'驾驶员':'投递员',otherRole=!net.connected?'未连接':other?.view==='drive'?'驾驶员':'投递员';
 const ln=$('localNameHud'),lr=$('localRoleHud'),rn=$('remoteNameHud'),rr=$('remoteRoleHud'),meta=$('roomMetaHud');if(ln)ln.textContent=myName;if(lr)lr.textContent=myRole;if(rn)rn.textContent=otherName;if(rr)rr.textContent=otherRole;if(meta)meta.textContent=(net.room?'#'+net.room:'')+(net.rtt?' · '+net.rtt+'ms':'');
 $('pauseNet').textContent=online?(net.pauseWho||('房间 '+net.room+' · '+myName+' / '+otherName)) :'';
 $('watchBtn').classList.toggle('hidden',!net.connected||state.view!=='drive');$('watchBtn').classList.toggle('active',net.watch);$('watchBtn').textContent=net.watch?'返回路面':'看 '+otherName;
 $('resumeBtn').disabled=networked()&&!net.connected;$('serviceBtn').disabled=$('restartBtn').disabled=net.mode==='guest';
 if(online){$('cargoBtn').querySelector('b').textContent='离开驾驶位';$('autoChip').textContent=state.brick?'砖头压油门':state.view==='cargo'?(hasDriver()?'队友驾驶':'无人掌舵'):'你在驾驶';}}
async function copyRoom(){if(!net.room)return;const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('room',net.room);try{await navigator.clipboard.writeText(u.href);netText('邀请链接已复制 · 房间码 '+net.room);}catch(e){netText('房间码 '+net.room+' · 请将此房间码发给好友。');}}

let eye=[17,13,87],at=[4,2,68], width=innerWidth,height=innerHeight, simAccumulator=0;
let driveOrbit=0, driveOrbitGoal=0, currentKind=0, cameraBlend=0, blendEye=null, blendAt=null;
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const carForward=()=>[-Math.sin(car.yaw),0,-Math.cos(car.yaw)];
const carRight=()=>[Math.cos(car.yaw),0,-Math.sin(car.yaw)];
function vehicleToWorld(p){return V.add(car.p,worldVelocity({yaw:car.yaw},p));}
function vehicleToLocal(p){return localVelocity({yaw:car.yaw},V.sub(p,car.p));}
function viewDirection(){const a=player.yaw+car.yaw,c=Math.cos(player.pitch);return [-Math.sin(a)*c,Math.sin(player.pitch),-Math.cos(a)*c];}
function localDirection(){const c=Math.cos(player.pitch);return[-Math.sin(player.yaw)*c,Math.sin(player.pitch),-Math.cos(player.yaw)*c];}
function doorsOpen(){return doors[0].angle>1.1&&doors[1].angle>1.1;}
function rearPass(x,r=.22){return(x-r>=0||doors[0].angle>1.1)&&(x+r<=0||doors[1].angle>1.1);}
function cameraLocal(){const p=player.p.slice();if(p[2]>2.91&&rearPass(p[0],.25))p[2]+= .64;return p;}
function physicalStock(){return cargo.length+(player.held?1:0)+(net.mode==='host'&&net.remoteActor?.held?1:net.mode==='guest'&&net.hostActor?.held?1:0);}

const materials={wall:['#dd8469','#e6bd63','#88bba6','#a2bcca','#d9a591','#aac19b'],roof:['#486479','#b56d4d','#627b81','#50606a'],green:['#82aa57','#96b857','#6d9b62','#abc669']};
let worldBuilder=new MeshBuilder();
function b(w,h,d,c,p,r=[0,0,0],parent=null){worldBuilder.box(w,h,d,c,p,r,parent);}
function houseLocal(h,p){const dx=p[0]-h.x,dz=p[2]-h.z,c=Math.cos(h.yaw),s=Math.sin(h.yaw);return [c*dx-s*dz,p[1],s*dx+c*dz];}
function houseWorld(h,p){const c=Math.cos(h.yaw),s=Math.sin(h.yaw);return [h.x+c*p[0]+s*p[2],p[1],h.z-s*p[0]+c*p[2]];}
function localVelocity(h,v){const c=Math.cos(h.yaw),s=Math.sin(h.yaw);return[c*v[0]-s*v[2],v[1],s*v[0]+c*v[2]];}
function worldVelocity(h,v){const c=Math.cos(h.yaw),s=Math.sin(h.yaw);return[c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]];}
function shadow(x,z,rx,rz,color='#789b66'){worldBuilder.cylinder(rx,.018,12,color,[x,.014,z],[0,0,0],rx);/* flattened custom ellipse */}
function addTree(x,z,scale=1){
 const color=materials.green[Math.floor(rnd()*materials.green.length)];
 b(3.4*scale,.021,2.4*scale,'#759568',[x+1,.025,z-.5],[0,.4,0]);
 worldBuilder.cylinder(.24*scale,2.9*scale,5,'#97744f',[x,1.45*scale,z]);
 worldBuilder.poly(2.0*scale,color,[x,4.1*scale,z],[.85,1.35,.85]);
 worldBuilder.poly(1.45*scale,color,[x+.65*scale,3.5*scale,z+.5*scale],[1,1.1,1]);
}
