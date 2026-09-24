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
// @include city-world-v07.js

// A hollow, walkable van. No opaque cargo cube and no fake painted rear opening.
function makeVan(){
 const g=new MeshBuilder();
 g.box(3.14,.30,7.48,'#294b54',[0,.55,-.15]);
 g.box(3.05,.16,5.22,'#b9976b',[0,.73,.89]);
 for(let i=0;i<9;i++)g.box(.305,.025,5.15,i%2?'#c9ae7a':'#d3b885',[-1.34+i*.335,.824,.89]);
 g.box(3.08,.14,5.25,'#f1ecda',[0,3.68,.89]);
 for(const s of [-1,1]){
  g.box(.13,2.84,5.18,'#f3ecd8',[s*1.55,2.25,.86]);
  // Interior panels, ribs, timber rubbing rails and exterior orange stripe.
  g.box(.021,2.65,5.03,'#c2d1cc',[s*1.474,2.24,.86]);
  for(const z of [-1.5,-.35,.85,2.05,3.3])g.box(.065,2.73,.052,'#a2b8b8',[s*1.424,2.24,z]);
  g.box(.06,.17,4.92,'#96744f',[s*1.413,1.18,.88]);
  g.box(.06,.13,4.92,'#b79568',[s*1.413,1.9,.88]);
  g.box(.025,.5,5.10,'#eab04d',[s*1.63,1.62,.87]);
  g.box(.027,.58,.64,'#2f6170',[s*1.635,2.56,.7]);
  g.box(.031,.60,.13,'#c3dacb',[s*1.65,2.56,.7]);
  // Cab outer shell with actual see-through windows.
  g.box(.13,.83,1.94,'#e9e9d6',[s*1.5,1.24,-2.61]);
  g.box(.14,1.1,.10,'#eee9d6',[s*1.5,2.13,-3.56]);
  g.box(.14,1.1,.10,'#e5e7d5',[s*1.5,2.13,-1.69]);
  g.box(.12,.13,1.94,'#dcded0',[s*1.51,2.7,-2.63]);
  g.box(.24,.46,.22,'#2d505d',[s*1.75,2.04,-3.21]);
  g.box(.045,.38,1.67,'#e9ac48',[s*1.59,1.30,-2.55]);
 }
 // Cab dash and windshield: geometry at the windshield is intentionally solid blue.
 g.box(3.04,.15,1.97,'#f4ecda',[0,2.81,-2.64]);
 // Windshield is a separate transparent pane in Multiplayer V0.2.
 g.box(3.06,.56,.56,'#ede6cc',[0,1.38,-3.51]);
 g.box(3.03,.26,.22,'#2a4854',[0,.76,-3.92]);
 for(const x of [-1.08,1.08])g.box(.60,.23,.06,'#fff2bf',[x,1.34,-3.81]);
 g.box(.92,.14,.025,'#344d57',[0,1.27,-3.805]);
 g.box(2.83,.28,.40,'#3f626d',[0,1.92,-3.10]);
 for(const x of [-.79,.79]){
  g.box(.69,.27,.67,'#47737e',[x,1.12,-2.68]);g.box(.69,.95,.21,'#355d69',[x,1.58,-2.25],[.04,0,0]);
  g.box(.55,.28,.18,'#4d7780',[x,2.19,-2.22]);
 }
 g.cylinder(.23,.048,10,'#1f424e',[-.77,1.9,-2.94],[Math.PI*.32,0,0]);
 // Front bulkhead: open center aisle into the cab.
 for(const s of [-1,1])g.box(.93,2.67,.10,'#6c9298',[s*1.015,2.19,-1.73]);
 g.box(1.18,.22,.11,'#6b8d93',[0,3.39,-1.73]);
 g.box(1.12,.04,.35,'#edc66a',[0,.85,-1.72]);
 // Actual accelerator and brake, with the brick rendered separately.
 g.box(.27,.12,.52,'#263e45',[-.72,.91,-3.0],[.24,0,0]);
 g.box(.38,.09,.38,'#475e60',[-1.13,.94,-3.0],[.24,0,0]);
 // Rear threshold, reflectors and hazard marks.
 g.box(3.20,.20,.35,'#385762',[0,.57,3.53]);
 g.box(2.99,.06,.18,'#e9ba54',[0,.858,3.36]);
 for(let i=0;i<10;i++)g.box(.13,.063,.18,'#3f5555',[-1.4+i*.3,.86,3.36],[0,.2,0]);
 for(const s of [-1,1]){
  g.box(.20,.58,.14,'#ce6255',[s*1.55,1.17,3.53]);
  g.box(.25,2.74,.20,'#e4e4d2',[s*1.53,2.20,3.47]);
 }
 g.box(.72,.17,.08,'#f6ecc7',[0,.61,3.73]);
 for(const z of [-.6,1.9]){
  g.box(.17,.025,.9,'#547879',[0,3.60,z]);
  g.box(.12,.022,.70,'#fff7ce',[0,3.58,z]);
 }
 return renderer.mesh(g);
}
function makeRearDoor(side){
 const g=new MeshBuilder(),cx=-side*.725;
 g.box(1.44,2.65,.13,'#f0ead8',[cx,2.22,0]);
 g.box(1.28,2.41,.018,'#bdd0ce',[cx,2.22,-.077]);
 g.box(1.46,.45,.025,'#eeb34e',[cx,1.60,.081]);
 g.box(.11,2.43,.13,'#8ea5a5',[-side*.22,2.22,.087]);
 g.box(.25,.06,.13,'#2c5059',[-side*.22,1.91,.14]);
 g.box(.06,.28,.12,'#385b65',[-side*.23,1.94,-.13]);
 for(const y of [1.18,3.23])g.box(.13,.16,.20,'#768e94',[0,y,0]);
 return renderer.mesh(g);
}
function makePackage(kind){const g=new MeshBuilder(),t=parcelType(kind),s=t.r*2,c=['#cfa470','#b28355','#8bb0c5','#d8b98d','#9ca96e','#ad8ac0'][kind]||'#cfa470';g.box(s,s,s,c);g.box(s+.009,s+.012,.105,kind?'#ca7654':'#efdab0');g.box(.19,.14,.013,'#f4eed5',[s*.12,.025,s*.51]);g.box(.02,.10,.014,'#4d6970',[s*.12,.025,s*.523]);g.box(.14,.017,.014,'#4d6970',[s*.12,-.009,s*.524]);return renderer.mesh(g);}
function makeTraffic(color){const g=new MeshBuilder();g.box(1.95,.71,3.72,color,[0,.9,0]);g.box(1.73,.66,1.98,color,[0,1.55,.13]);g.box(1.59,.51,.055,'#345768',[0,1.59,-.85],[.23,0,0]);g.box(1.56,.49,.04,'#486d7b',[0,1.59,1.15],[-.22,0,0]);for(const s of [-1,1]){g.box(.02,.48,1.5,'#507b89',[s*.875,1.61,.10]);g.box(.055,.56,.10,color,[s*.89,1.59,.1]);g.box(.4,.17,.12,'#f3deb0',[s*.62,.95,-1.85]);g.box(.36,.17,.13,'#c2725b',[s*.70,.94,1.87]);for(const z of [-1.18,1.15])g.cylinder(.34,.21,9,'#304550',[s*.97,.46,z],[0,0,Math.PI/2]);}g.box(1.9,.12,.15,'#436370',[0,.64,-1.89]);return renderer.mesh(g);}
function scaled(m,scale){const s=Array.isArray(scale)?scale:[scale,scale,scale];const n=new Float32Array(m);for(let c=0;c<3;c++)for(let r=0;r<3;r++)n[c*4+r]*=s[c];return n;}
function makeMesh(b){return renderer.mesh(b);}
buildWorld();
const cityWorld=bakeCityWorld(worldBuilder),staticTriangles=cityWorld.total;worldBuilder=null;
const vanMesh=makeVan(), rearDoorMeshes=[makeRearDoor(-1),makeRearDoor(1)], packageMeshes=PACKAGE_TYPES.map((_,i)=>makePackage(i));
const wheelBuilder=new MeshBuilder();wheelBuilder.cylinder(.50,.31,12,'#233d46',[0,0,0],[0,0,Math.PI/2]);wheelBuilder.cylinder(.25,.32,8,'#b1c4bd',[0,0,0],[0,0,Math.PI/2]);const wheelMesh=makeMesh(wheelBuilder);
const vanShadow=makeMesh(new MeshBuilder().box(3.8,.007,8,'#557875',[0,.095,0]));
const glassBuilder=new MeshBuilder();glassBuilder.box(2.36,2.10,.09,'#76c5d4');glassBuilder.box(.18,1.5,.025,'#b8e2e2',[-.56,.1,.06],[0,0,-.32]);glassBuilder.box(.08,1.0,.029,'#c6ebdf',[-.25,.27,.061],[0,0,-.32]);const glassMesh=makeMesh(glassBuilder);
const doorBuilder=new MeshBuilder();doorBuilder.box(2,3.1,.15,'#b66952');for(const x of [-.46,.46])for(const y of [-.77,.62])doorBuilder.box(.7,1.04,.025,'#a15b4a',[x,y,.09]);doorBuilder.poly(.07,'#f4d48d',[.73,-.08,.16]);const doorMesh=makeMesh(doorBuilder);
const shardMesh=makeMesh(new MeshBuilder().poly(.20,'#b6e4e5',[0,0,0],[1,.4,.7]));
const woodMesh=makeMesh(new MeshBuilder().box(.20,.14,.11,'#e0b778'));
const dotMesh=makeMesh(new MeshBuilder().poly(.055,'#ffecad'));
const brickBuilder=new MeshBuilder();brickBuilder.box(.43,.18,.30,'#c87452');brickBuilder.box(.026,.02,.31,'#a75640',[-.07,.095,0]);const brickMesh=makeMesh(brickBuilder);
const beaconMesh=makeMesh(new MeshBuilder().cylinder(.46,.85,4,'#ffce69',[0,0,0],[0,Math.PI/4,0],0));
const ringMeshes={};for(const type of ['window','door']){const g=new MeshBuilder(),w=type==='window'?2.7:2.35,h=type==='window'?2.45:3.4;g.box(w,.042,.06,'#ffe68a',[0,-h/2,0]);g.box(w,.042,.06,'#ffe68a',[0,h/2,0]);g.box(.042,h,.06,'#ffe68a',[-w/2,0,0]);g.box(.042,h,.06,'#ffe68a',[w/2,0,0]);ringMeshes[type]=makeMesh(g);}
const signalMeshes=['#e2826d','#dbc474','#93cf9c'].map(c=>makeMesh(new MeshBuilder().cylinder(.18,.045,8,c,[0,0,0],[Math.PI/2,0,0])));
const smokeMesh=makeMesh(new MeshBuilder().poly(1,'#758689'));
const darkSmokeMesh=makeMesh(new MeshBuilder().poly(1,'#3f5259'));
const fireMeshes=['#e77739','#ffae40','#ffe59a'].map(c=>makeMesh(new MeshBuilder().poly(1,c)));
const metalMesh=makeMesh(new MeshBuilder().box(.47,.22,.37,'#64777c'));
const npcDoorMesh=makeMesh(new MeshBuilder().box(.1,.85,1.17,'#b89968'));
const wreckMesh=makeMesh(new MeshBuilder().box(1.87,.62,3.49,'#40545b',[0,.52,0]).box(1.53,.45,1.8,'#566568',[0,1.04,.05]).box(1.3,.25,.5,'#253d44',[0,1.26,-.6],[.2,0,.14]));
const armMesh=makeMesh(new MeshBuilder().box(.16,.16,.48,'#3d7181',[0,0,0]).box(.16,.15,.20,'#e4b282',[0,0,-.31]));
const deliverable=houses.filter(h=>h.deliverable),TOTAL=deliverable.length;
for(let i=0;i<14;i++)traffic.push({id:i,p:[190+i*4,.1,190],yaw:0,speed:0,hp:100,phase:'normal',burn:0,wreckAge:0,hitCooldown:0,drift:[0,0,0],spin:0,smokeClock:0,mesh:makeTraffic(['#db8765','#709a98','#bdae75','#8c9ba8','#c68e87','#8ab087'][i%6])});

let audio=null,audioMaster=null,engineVoice=null,windVoice=null,noiseBuffer=null;
function initAudio(){try{
 if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();audioMaster=audio.createGain();audioMaster.gain.value=soundOn?.16:0;audioMaster.connect(audio.destination);
 const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=40;g.gain.value=0;o.connect(g);g.connect(audioMaster);o.start();engineVoice={o,g};
 noiseBuffer=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);const n=noiseBuffer.getChannelData(0);for(let i=0;i<n.length;i++)n[i]=Math.random()*2-1;
 const src=audio.createBufferSource(),f=audio.createBiquadFilter(),wg=audio.createGain();src.buffer=noiseBuffer;src.loop=true;f.type='lowpass';f.frequency.value=450;wg.gain.value=0;src.connect(f);f.connect(wg);wg.connect(audioMaster);src.start();windVoice={src,f,g:wg};
 }if(audio.state==='suspended')audio.resume().catch(()=>{});
}catch(e){soundOn=false;}}
function tone(freq,dur=.12,type='sine',gain=.22,delay=0){if(!audio||!soundOn)return;try{const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.6),t+dur);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(audioMaster);o.start(t);o.stop(t+dur+.02);o.onended=()=>{o.disconnect();g.disconnect();};}catch(e){}}
function noiseSound(dur=.25,frequency=1800,gain=.3,filter='highpass'){if(!audio||!soundOn||!noiseBuffer)return;try{const src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain(),t=audio.currentTime;src.buffer=noiseBuffer;f.type=filter;f.frequency.value=frequency;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);src.connect(f);f.connect(g);g.connect(audioMaster);src.start(t);src.stop(t+dur);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};}catch(e){}}
function glassSound(){noiseSound(.27,1700,.42);}
function nextHouse(){return deliverable.find(h=>!h.done)||null;}
function formatTime(t){t=Math.max(0,Math.floor(t));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
function showToast(title,sub='',duration=2.8){$('toastTitle').textContent=title;$('toastSub').textContent=sub;$('toast').classList.add('show');state.toastUntil=state.time+duration;}
function showHint(s,t=5){$('hint').textContent=s;state.hintUntil=state.time+t;$('hint').classList.remove('hidden');}
function cancelCharge(){state.charging=false;state.charge=0;state.chargeSource=null;$('throwBtn').classList.remove('charging');}
function clearInputs(){inputs.keys.clear();for(const k of ['left','right','gas','brake','forward','back','walkLeft','walkRight'])inputs[k].clear();inputs.stickX=inputs.stickY=0;document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));$('stickThumb').style.transform='';cancelCharge();}
function loadCargo(){cargo.length=0;player.held=null;
 const kinds=[0,2,3,0,1,4,0,5,2,3,0,1,4,0,5,2,3,0];
 for(let i=0;i<kinds.length;i++){const side=i%2?1:-1,row=Math.floor(i/2),kind=kinds[i],r=parcelType(kind).r,z=-.99+(row%6)*.78,y=CAB.floor+r+.01+(row>=6?r*2+.08:0);cargo.push(makeCargo(kind,[side*1.01,y,z]));}
}
function makeCargo(kind,p){const t=parcelType(kind),mystery=kind===5?(rnd()<.34?'bonus':rnd()<.5?'light':'heavy'):null;return{id:state.nextId++,kind,r:t.r,mass:t.mass,p:p.slice(),v:[0,0,0],rot:[0,(rnd()-.5)*.13,0],spin:[0,0,0],thrown:false,age:0,lastHit:-1,vehicleSpeed:0,dist:0,integrity:100,bounces:0,blastBoosted:false,mystery};}
function parcelLabel(p){const t=parcelType(p.kind);return t.icon+' '+t.name+(p.kind===3?' · '+Math.round(p.integrity??100)+'%':'');}
function hurtParcel(p,impact){const t=parcelType(p.kind);if(!t.fragile)return;const loss=Math.max(0,impact-2.4)*t.fragile*2.4;if(loss>.35)p.integrity=clamp((p.integrity??100)-loss,0,100);}
function toggleBrick(){if(state.mode!=='playing'||state.view!=='drive')return;initAudio();state.brick=!state.brick;brickBody.placed=state.brick;brickBody.p=state.brick?[-.72,1.09,-3.01]:[.84,.98,-2.47];brickBody.v=[0,0,0];brickBody.rot=[.15,0,0];tone(state.brick?185:120,.09,'triangle');showHint(state.brick?'砖头只管油门，不会转向。V /「进货箱」离开驾驶位。':'已取下砖头，松开踏板后车辆会慢慢滑停。',5);syncButtons();}
function dislodgeBrick(){if(!state.brick)return;state.brick=false;brickBody.placed=false;brickBody.v=[2.4,1.2,2.6];showToast('砖头震掉了','回到驾驶位后可重新放砖',2.1);syncButtons();}
function toggleDoor(index){if(state.mode!=='playing'||state.view!=='cargo')return;if(player.p[2]<1.45){showHint('先沿货箱中间通道走到后门旁。',3);return;}const d=doors[index];d.target=d.target>0?0:2.52;d.vel+=d.target>0?1:-1;tone(d.target?240:120,.12,'triangle',.2);showHint(d.target?'后门打开了。拿起包裹，再站到黄色后沿瞄准。':'后门正在关上，确认两扇都关好再继续加速。',3);syncButtons();}
function toggleBothDoors(){if(state.mode!=='playing'||state.view!=='cargo')return;if(player.p[2]<1.45){showHint('走到车尾才能开关后门。',3);return;}const target=doors.some(d=>d.target>0)?0:2.52;doors.forEach(d=>{d.target=target;d.vel+=target?1:-1;});tone(target?235:115,.13);syncButtons();}
function setView(view){if(state.mode!=='playing'||state.time<state.switchUntil)return;
 if(view==='drive'){
  if(player.p[2]>-.47){showHint('先走回货箱前方。前面的座椅才是驾驶位。',4);return;}
  if(player.held)dropPackage();
 }else if(state.view==='drive'){
  player.p=[0,2.38,-.90];player.yaw=Math.PI;player.pitch=-.20;player.aimGate=player.aimHouse=null;
 }
 blendEye=eye.slice();blendAt=at.slice();cameraBlend=1;clearInputs();state.view=view;state.switchUntil=state.time+.48;driveOrbit=driveOrbitGoal=0;car.steer=0;
 showHint(view==='cargo'?'左边走动，拖动画面观察。沿中间通道走到后门。':(doors.some(d=>d.target>0||d.angle>.3)?'后门还开着！加速和转弯都可能掉货。':'已接管驾驶。砖头不会帮你转弯。'),5);tone(170,.09);syncButtons();
}
function collectFocus(){
 if(state.view!=='cargo')return null;const e=cameraLocal(),d=localDirection();
 // A ray finds the box under the reticle; a forgiving near-field fallback helps thumbs.
 let chosen=null,bestT=Infinity;
 if(!player.held)for(const c of cargo){const rel=V.sub(c.p,e),t=V.dot(rel,d),dist=V.len(rel),perp=V.len(V.sub(rel,V.mul(d,t)));if(t>.1&&dist<2.65&&perp<c.r+.22&&t<bestT){chosen=c;bestT=t;}}
 if(chosen)return{type:'package',item:chosen};
 if(player.p[2]<-.48&&d[2]<-.22)return{type:'cab'};
 if(player.p[2]>1.65&&d[2]>.20){const side=e[0]+d[0]*Math.max(0,(CAB.rear-e[2])/d[2]);if(Math.abs(side)<2.2&&player.pitch>-.55&&player.pitch<.6)return{type:'door',index:side<0?0:1};}
 if(!player.held){let near=null,dist=1.55;for(const c of cargo){const ds=Math.hypot(c.p[0]-player.p[0],c.p[2]-player.p[2]);if(ds<dist&&Math.abs(c.p[1]-player.p[1])<2&&player.pitch<-.12){near=c;dist=ds;}}if(near)return{type:'package',item:near};}
 if(player.p[2]<-.60)return{type:'cab'};
 return null;
}
function interact(){if(state.mode!=='playing'||state.view!=='cargo'||state.time<state.switchUntil)return;const focus=collectFocus();if(!focus){showHint(player.held?'站到打开的后门边，拖动画面瞄准，按住投掷。':'低头看一只箱子，靠近后点「拿起」。',3);return;}
 if(focus.type==='cab')setView('drive');
 else if(focus.type==='door')toggleDoor(focus.index);
 else if(focus.type==='package'&&!player.held){const i=cargo.indexOf(focus.item);if(i<0)return;player.held=cargo.splice(i,1)[0];player.held.v=[0,0,0];currentKind=player.held.kind;cancelCharge();tone(245,.09,'triangle',.16);showHint(('拿到 '+parcelLabel(player.held)+(currentKind===1?'，适合撞门。':'，准备投递。'))+'走到打开的后沿再投掷。',4);syncButtons();}
}
function dropPackage(){if(!player.held||state.view!=='cargo')return;const c=player.held;player.held=null;cancelCharge();c.p=[clamp(player.p[0]+Math.cos(player.yaw)*.43,-CAB.half+c.r,CAB.half-c.r),1.30,clamp(player.p[2],CAB.front+c.r,CAB.rear-c.r)];c.v=[0,-.4,0];c.thrown=false;c.spin=[0,0,0];cargo.push(c);syncButtons();tone(160,.09);}
function turnLook(dx,dy){player.yaw=wrapAngle(player.yaw-dx*.0042);player.pitch=clamp(player.pitch-dy*.0036,-1.28,1.02);player.aimGate=player.aimHouse=null;}
function lockTarget(cycle=true){if(state.mode!=='playing'||state.view!=='cargo')return;const h=nextHouse();if(!h)return;if(player.p[2]<2.30){showHint('先走到后门边，再瞄准房屋，避免包裹打到货箱。',4);return;}if(!doors.some(d=>d.angle>1.1)){showHint('先打开后门，不能隔着车门投递。',3);return;}const dist=V.len(V.sub(h.gates[0].center,vehicleToWorld(cameraLocal())));if(dist>65){showHint('目标还在 '+Math.round(dist)+' 米外，先开近一些。',3);return;}
 let index=0;if(cycle&&player.aimHouse===h&&player.aimGate)index=(player.aimGate.index+1)%3;player.aimHouse=h;player.aimGate=h.gates[index];aimCameraAt(player.aimGate.center);tone(490,.05,'sine',.1);showHint(h.num+' 号'+(index===1?'大门：用重箱，蓄满力。':'窗户：准星跟随入口，拖动画面可解除。'),3);
}
function aimCameraAt(p){const delta=V.sub(p,vehicleToWorld(cameraLocal()));player.yaw=wrapAngle(Math.atan2(-delta[0],-delta[2])-car.yaw);player.pitch=clamp(Math.atan2(delta[1],Math.hypot(delta[0],delta[2])),-1.28,1.02);}
function rayHouse(ray,h){const o=houseLocal(h,ray.o),d=localVelocity(h,ray.d);if(d[2]>=-.00001||o[2]<4.3)return null;const t=(4.35-o[2])/d[2];if(t<0||t>80)return null;const p=V.add(o,V.mul(d,t));if(Math.abs(p[0])>5.55||p[1]<.2||p[1]>5.4)return null;return{t,p:houseWorld(h,p),house:h,gate:h.gates.find(g=>Math.abs(p[0]-g.x)<g.w/2&&Math.abs(p[1]-g.y)<g.h/2)||null};}
function shotSolution(){
 const kind=player.held?player.held.kind:currentKind,dir=viewDirection(),origin=V.add(vehicleToWorld(cameraLocal()),V.add(V.mul(dir,.56),[0,-.13,0]));
 const power=state.charging?state.charge:.60,t=parcelType(kind),base=(18+power*22)*t.throwMul,inherited=car.velocity.slice();
 let gate=player.aimGate,house=player.aimHouse,point=null;
 if(!gate){let hit=null;for(const h of houses){const q=rayHouse({o:origin,d:dir},h);if(q&&(!hit||q.t<hit.t))hit=q;}if(hit){gate=hit.gate;house=hit.house;point=hit.p;}}
 let v,flight=1.6;
 if(assist&&gate&&V.len(V.sub(gate.center,origin))<66){const delta=V.sub(gate.center,origin);flight=clamp(Math.hypot(delta[0],delta[2])/base,.17,3);v=[delta[0]/flight,delta[1]/flight+6*flight,delta[2]/flight];point=gate.center.slice();}
 else {v=V.add(V.mul(dir,base),inherited);v[1]+=2.0;point=V.add(origin,V.mul(dir,35));}
 return{origin,v,flight,kind,point,gate,house};
}
function startCharge(source){if(state.mode!=='playing'||state.view!=='cargo'||!player.held||state.charging||state.cooldown>0||state.time<state.switchUntil)return;initAudio();state.charging=true;state.charge=.10;state.chargeSource=source;$('throwBtn').classList.add('charging');}
function finishCharge(source){if(!state.charging||state.chargeSource!==source)return;if(state.mode==='playing')throwPackage();cancelCharge();}
function throwPackage(){if(!player.held||state.view!=='cargo'||state.mode!=='playing'||state.cooldown>0)return;const s=shotSolution(),c=player.held;player.held=null;c.p=vehicleToLocal(s.origin);c.v=localVelocity({yaw:car.yaw},V.sub(s.v,car.velocity));c.thrown=true;c.vehicleSpeed=Math.abs(car.speed);c.dist=V.len(V.sub(s.point,s.origin));c.age=0;c.spin=[1.8,2.3,.9];c.rot=[.05,player.yaw,0];state.shots++;state.cooldown=.32;
 // A parcel starts inside the vehicle and must physically cross its rear aperture.
 if(c.p[2]>CAB.rear+c.r&&rearPass(c.p[0],c.r))releaseToWorld(c);else{c.p[0]=clamp(c.p[0],-CAB.half+c.r,CAB.half-c.r);c.p[1]=clamp(c.p[1],CAB.floor+c.r,CAB.roof-c.r);cargo.push(c);}
 tone(330,.13,'triangle',.15);syncButtons();
}
function releaseToWorld(c){
 const p={id:c.id,p:vehicleToWorld(c.p),v:V.add(worldVelocity({yaw:car.yaw},c.v),car.velocity),r:c.r*.88,mass:c.mass,kind:c.kind,age:0,rot:[c.rot[0],c.rot[1]+car.yaw,c.rot[2]],spin:c.thrown?c.spin.slice():[1.7,1.2,.8],pending:null,delivered:false,vehicleSpeed:c.vehicleSpeed||Math.abs(car.speed),dist:c.dist||0,lastHit:-2,spilled:!c.thrown,integrity:c.integrity??100,bounces:c.bounces||0,blastBoosted:!!c.blastBoosted,mystery:c.mystery||null};
 if(!c.thrown){state.lost++;state.score=Math.max(0,state.score-25);if(state.time>=state.warnUntil){showToast('货物掉出去了！','后门开着 · 掉落累计 '+state.lost+' 件，每件 -$25',2.5);state.warnUntil=state.time+1.4;}tone(135,.10,'triangle',.15);}
 if(packages.length>=60)packages.shift();packages.push(p);
}
function addDebris(mesh,p,v,rot=[0,0,0],life=3,spin=null){if(debris.length>(quality==='low'?45:100))debris.shift();debris.push({mesh,p:p.slice(),v:v.slice(),rot:rot.slice(),spin:spin||[(rnd()-.5)*8,(rnd()-.5)*8,(rnd()-.5)*8],life,age:0});}
function addEffect(mesh,p,v,life,start,end,alpha=1){if(effects.length>(quality==='low'?45:100))effects.shift();effects.push({mesh,p:p.slice(),v:v.slice(),life,age:0,start,end,alpha,rot:[rnd(),rnd(),rnd()]});}
function breakGate(h,g,p){if(g.broken)return;g.broken=true;
 if(g.type==='window'){for(let i=0;i<(quality==='low'?8:16);i++){const lp=[g.x+(rnd()-.5)*g.w,g.y+(rnd()-.5)*g.h,4.42];addDebris(shardMesh,houseWorld(h,lp),V.add(worldVelocity(h,[(rnd()-.5)*5,2+rnd()*4,-1-rnd()*4]),V.mul(p.v,.13)),[rnd()*3,rnd()*3,rnd()*3],2.5+rnd());}glassSound();}
 else{addDebris(doorMesh,houseWorld(h,[g.x,g.y,4.32]),V.add(V.mul(p.v,.38),[0,2.5,0]),[0,h.yaw,0],4.4,[-1.8,1.3,.8]);for(let i=0;i<7;i++)addDebris(woodMesh,g.center,[(rnd()-.5)*7,2+rnd()*5,(rnd()-.5)*7],[0,h.yaw,0],2.7);tone(88,.27,'sawtooth',.30);}
}
function deliver(h,g,p){if(p.delivered)return;p.delivered=true;p.pending=null;p.v=V.mul(p.v,.4);p.spin=V.mul(p.spin,.3);
 if(!h.deliverable||h.done){showHint(!h.deliverable?'这栋不是配送地址，请看黄色标记。':'这家已经收过快递了。',2);return;}
 h.done=true;state.delivered++;state.combo=state.time-state.lastDelivery<16?Math.min(5,state.combo+1):1;state.lastDelivery=state.time;
 const base=g.type==='door'?150:100,velocityBonus=p.vehicleSpeed>4?Math.round(p.vehicleSpeed*4):0,rangeBonus=p.dist>26?40:0,comboBonus=(state.combo-1)*25;const tricks=[];let trickBonus=0;
 if(p.vehicleSpeed>15){tricks.push('高速投递');trickBonus+=50;}if(p.dist>32){tricks.push('LONG SHOT');trickBonus+=60;}if((p.bounces||0)>0){tricks.push('BANK SHOT');trickBonus+=75;}if(p.blastBoosted){tricks.push('EXPLOSIVE DELIVERY');trickBonus+=150;}if(p.kind===5&&p.mystery==='bonus'){tricks.push('神秘加成');trickBonus+=100;}
 state.trickCount+=tricks.length;const integrity=Math.round(p.integrity??100),damagePenalty=Math.round((100-integrity)*(p.kind===3?1.5:.55));state.damageCost+=damagePenalty;const gross=base+velocityBonus+rangeBonus+comboBonus+trickBonus,total=Math.max(20,gross-damagePenalty);state.score+=total;
 state.lastBreakdown='基础 $'+base+(velocityBonus?' · 行驶 +$'+velocityBonus:'')+(rangeBonus?' · 远投 +$'+rangeBonus:'')+(comboBonus?' · 连续 +$'+comboBonus:'')+(trickBonus?' · 特技 +$'+trickBonus:'')+(damagePenalty?' · 损坏 −$'+damagePenalty:'');
 showToast((tricks[0]||'送达！')+' +$'+total,h.num+' 号 · '+parcelLabel(p)+(damagePenalty?' · 货损 -$'+damagePenalty:''),2.8);tone(540,.12,'sine',.26);tone(810,.19,'sine',.26,.11);
 if(player.aimHouse===h){player.aimGate=player.aimHouse=null;}if(state.delivered>=TOTAL){endRound();return;}showHint('下一单 '+nextHouse().address+'。关好后门，回前排接管方向。',5);
}
function impact(amount){if(state.hitCooldown>0)return;state.hitCooldown=.55;state.combo=0;const dmg=Math.max(0,(amount-3)*1.45);car.hp=clamp(car.hp-dmg,0,100);if(amount>7)dislodgeBrick();for(const c of cargo){c.v[0]+=(rnd()-.5)*Math.min(5,amount*.3);c.v[1]+=Math.min(1.5,amount*.1);c.v[2]+=(rnd()-.3)*amount*.18;}doors.forEach(d=>{if(d.target>0)d.vel+=(rnd()-.5)*4;});tone(66,.2,'sawtooth',.27);if(motion)state.shake=state.view==='cargo'?.06:.19;if(car.hp<=0){state.brick=false;showToast('快递车熄火了','暂停菜单 → 道路救援 / 救援 / 补齐订单',3);}syncButtons();}
function damageTraffic(t,damage,impulse=[0,0,0]){if(t.phase==='wreck'||t.phase==='cleared')return;t.hp=clamp(t.hp-damage,0,100);t.drift=V.add(t.drift,impulse);if(damage>15)t.spin+=(rnd()>.5?1:-1)*Math.min(2,damage*.03);if(t.hp<=0&&t.phase!=='burning'){t.phase='burning';t.burn=2.25;showHint('小车起火了，离远一点！即将爆炸。',3);}else if(t.hp<50&&t.phase==='normal')t.phase='damaged';}
function explode(t){if(t.phase==='wreck')return;t.phase='wreck';t.wreckAge=0;state.explosions++;const pos=V.add(t.p,[0,1,0]);
 for(let i=0;i<15;i++){const a=rnd()*TAU,v=[Math.cos(a)*(1+rnd()*4),1+rnd()*4,Math.sin(a)*(1+rnd()*4)];addEffect(fireMeshes[i%3],V.add(pos,[(rnd()-.5),rnd(),(rnd()-.5)]),v,.42+rnd()*.65,.45+rnd()*.5,1.0+rnd()*1.5,1);}
 for(let i=0;i<13;i++)addEffect(i%2?smokeMesh:darkSmokeMesh,pos,[(rnd()-.5)*3,2+rnd()*3,(rnd()-.5)*3],2+rnd()*2,.4+rnd()*.8,2.5+rnd()*1.6,.85);
 for(let i=0;i<16;i++){const a=rnd()*TAU;addDebris(i<4?wheelMesh:i<7?npcDoorMesh:metalMesh,pos,[Math.cos(a)*(3+rnd()*9),3+rnd()*9,Math.sin(a)*(3+rnd()*9)],[rnd()*3,rnd()*3,rnd()*3],5+rnd()*2);}
 noiseSound(.8,220,.75,'lowpass');tone(46,.75,'triangle',.52);
 if(net.mode==='guest')return;
 const delta=V.sub(car.p,t.p),d=V.len(delta);if(d<13){const f=1-d/13,n=V.norm(delta);car.kick=V.add(car.kick,V.mul(n,5.2*f));car.yaw+=n[0]*.17*f;car.hp=Math.max(0,car.hp-21*f);dislodgeBrick();for(const c of cargo){c.v=V.add(c.v,localVelocity({yaw:car.yaw},V.mul(n,4*f)));c.v[1]+=2*f;}if(motion)state.shake=Math.min(state.view==='cargo'?.09:.23,.23*f);}
 for(const other of traffic){if(other===t||other.phase==='wreck'||other.phase==='cleared')continue;const delta=V.sub(other.p,t.p),d=V.len(delta);if(d<10)damageTraffic(other,(1-d/10)*72,V.mul(V.norm(delta),(1-d/10)*4));}
 for(const h of houses)for(const g of h.gates){const delta=V.sub(g.center,pos),d=V.len(delta);if(g.type==='window'&&!g.broken&&d<10)breakGate(h,g,{v:V.mul(V.norm(delta),12)});}
 for(const p of packages){const d=V.len(V.sub(p.p,pos));if(d<12){p.v=V.add(p.v,V.mul(V.norm(V.add(V.sub(p.p,pos),[0,1,0])),(1-d/12)*13));p.blastBoosted=true;}}
 showToast('轰！','小车爆炸 · 车门、轮胎和玻璃受到了冲击',2.1);syncButtons();
}

function service(){if(!['playing','paused'].includes(state.mode))return;const wasPaused=state.mode==='paused';
 const rx=nearestRoad(car.p[0]),rz=nearestRoad(car.p[2]);if(Math.abs(car.p[0]-rx)<Math.abs(car.p[2]-rz)){car.p=[rx+3.1,.12,clamp(car.p[2],-CITY.limit+12,CITY.limit-12)];car.yaw=0;}else{car.p=[clamp(car.p[0],-CITY.limit+12,CITY.limit-12),.12,rz+3.1];car.yaw=-Math.PI/2;}
 car.speed=0;car.velocity=[0,0,0];car.accel=[0,0,0];car.hp=100;car.kick=[0,0,0];car.steer=0;state.brick=false;brickBody.placed=false;brickBody.p=[.84,.98,-2.47];brickBody.v=[0,0,0];clearInputs();loadCargo();state.score=Math.max(0,state.score-120);state.time+=20;state.view='drive';state.switchUntil=0;player.p=[0,2.38,-.9];player.aimGate=player.aimHouse=null;cameraBlend=0;
 if(wasPaused)resume();syncButtons();showToast('道路救援已到达','货物补足 / 车辆修好 · 用时 +20 秒 · 最多扣 $120',3);showHint(doors.some(d=>d.target>0)?'注意：后门仍然开着。先去关门再加速。':'已回到道路，投递进度保留。',5);
}
function upgradeCost(key){const level=upgrades[key]||0;return [300,650,1100][level]??Infinity;}
function upgradeName(key){return {engine:'发动机',brakes:'刹车',grip:'抓地力',mat:'货箱防滑'}[key];}
function updateGarageUI(){const cash=$('garageCredits');if(cash)cash.textContent='$'+credits;for(const key of ['engine','brakes','grip','mat']){const btn=$('upgrade_'+key);if(!btn)continue;const level=upgrades[key]||0,cost=upgradeCost(key),b=btn.querySelector('b'),s=btn.querySelector('span');if(b)b.textContent=upgradeName(key)+' Lv.'+level;if(s)s.textContent=level>=3?'已满级':'升级 $'+cost;btn.disabled=level>=3||credits<cost;}}
function openGarage(){if(networked()){netText('请先退出联机，再调整永久车辆升级。');return;}const el=$('garageScreen');if(!el)return;el.classList.remove('hidden');updateGarageUI();}
function closeGarage(){const el=$('garageScreen');if(el)el.classList.add('hidden');}
function buyUpgrade(key){const cost=upgradeCost(key);if(!Number.isFinite(cost)||credits<cost)return;credits-=cost;upgrades[key]++;save();updateGarageUI();tone(620,.11,'sine',.22);}
function resetGame(toMenu=false){renderer.gl.clearColor(.65,.82,.87,1);renderer.gl.depthMask(true);clearInputs();seed=901;packages.length=debris.length=effects.length=0;houses.forEach(h=>{h.done=false;h.gates.forEach(g=>g.broken=false);});Object.assign(state,{mode:toMenu?'menu':'playing',view:'drive',time:0,score:0,delivered:0,shots:0,lost:0,explosions:0,combo:0,lastDelivery:-100,brick:false,charge:0,charging:false,cooldown:0,toastUntil:0,shake:0,hitCooldown:0,hintUntil:0,switchUntil:0,warnUntil:0,nextId:1,damageCost:0,trickCount:0,lastBreakdown:''});
 Object.assign(car,{p:[3.2,.12,72],yaw:0,speed:0,steer:0,roll:0,wheelAngle:0,hp:100,velocity:[0,0,0],accel:[0,0,0],yawRate:0,kick:[0,0,0],offRoad:0});Object.assign(player,{name:nickname,p:[0,2.38,-.9],yaw:Math.PI,pitch:-.20,held:null,walkPhase:0,aimGate:null,aimHouse:null,focus:null});doors.forEach(d=>{d.angle=d.target=d.vel=0;});Object.assign(brickBody,{p:[.84,.98,-2.47],v:[0,0,0],placed:false,rot:[0,.15,0]});loadCargo();
 resetCityTraffic();
 eye=toMenu?[18,8.8,88]:[16,11,88];at=toMenu?[3.2,1.65,68]:[5,2,65];driveOrbit=driveOrbitGoal=0;cameraBlend=0;simAccumulator=0;
 for(const id of ['pauseScreen','helpScreen','endScreen','garageScreen']){const el=$(id);if(el)el.classList.add('hidden');}$('menu').classList.toggle('hidden',!toMenu);$('hud').classList.toggle('hidden',toMenu);$('toast').classList.remove('show');
 if(!toMenu){initAudio();showHint('先开车靠近目标。B / 🧱 放砖，V /「进货箱」离开驾驶位。',9);world.focus({preventScroll:true});}syncButtons();updateHUD();
}
function pause(){if(state.mode!=='playing')return;clearInputs();state.mode='paused';$('pauseScreen').classList.remove('hidden');syncButtons();$('resumeBtn').focus({preventScroll:true});}
function resume(){if(state.mode!=='paused')return;state.mode='playing';simAccumulator=0;$('pauseScreen').classList.add('hidden');world.focus({preventScroll:true});}
function endRound(){state.mode='finished';clearInputs();const record=state.score>best;best=Math.max(best,state.score);credits=clamp(credits+state.score,0,99999999);save();$('endScore').textContent='$'+state.score;$('endTime').textContent=formatTime(state.time);$('endLost').textContent=state.lost;$('endBest').textContent=(record?'新纪录！':'本机最高 $'+best+' · ')+'特技 '+state.trickCount+' 次 · 货损 $'+state.damageCost+' · 收入已存入车库';$('endScreen').classList.remove('hidden');tone(660,.25,'sine',.25);tone(880,.3,'sine',.23,.2);}

function segmentBox(a,b,min,max){const d=V.sub(b,a);let near=0,far=1,axis=-1,sign=0;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(a[i]<min[i]||a[i]>max[i])return null;continue;}let t1=(min[i]-a[i])/d[i],t2=(max[i]-a[i])/d[i],sgn=-1;if(t1>t2){const q=t1;t1=t2;t2=q;sgn=1;}if(t1>near){near=t1;axis=i;sign=sgn;}far=Math.min(far,t2);if(near>far)return null;}return near>=0&&near<=1&&axis>=0?{t:near,axis,sign}:null;}
function hitWall(p,h,hit,a,b){const lp=V.lerp(a,b,Math.max(0,hit.t-.006));lp[hit.axis]+=hit.sign*.028;p.p=houseWorld(h,lp);let lv=localVelocity(h,p.v);lv[hit.axis]=-lv[hit.axis]*.28;lv=V.mul(lv,.80);p.v=worldVelocity(h,lv);p.pending=null;hurtParcel(p,V.len(p.v));p.bounces=(p.bounces||0)+1;if(p.age-p.lastHit>.15){tone(130,.10,'triangle',.24);p.lastHit=p.age;}return true;}
function stepWorldPackage(p,dt){
 p.age+=dt;const old=p.p.slice(),next=V.add(p.p,V.add(V.mul(p.v,dt),[0,-6*dt*dt,0]));p.v[1]-=12*dt;let collided=false;
 for(const h of houses){if(Math.abs(next[0]-h.x)>13&&Math.abs(old[0]-h.x)>13)continue;if(Math.abs(next[2]-h.z)>13&&Math.abs(old[2]-h.z)>13)continue;
  const a=houseLocal(h,old),b=houseLocal(h,next),r=p.r;
  // An entry is counted only after this parcel crosses the inner facade plane.
  if(p.pending&&p.pending.h===h&&!p.delivered){const g=p.pending.g,inner=4.0-p.r;if(a[2]>=inner&&b[2]<inner){const t=(a[2]-inner)/(a[2]-b[2]),q=V.lerp(a,b,t);if(Math.abs(q[0])<5.35-r&&q[1]>.24+r*.2&&q[1]<5.3-r)deliver(h,g,p);else p.pending=null;if(p.returnToDoor){p.returnToDoor=false;return;}}}
  const inside=Math.abs(a[0])<5.45&&a[2]<4.3&&a[2]>-4.15&&a[1]>.28&&a[1]<5.33;
  if(inside){
   if(b[0]>5.3-r||b[0]<-5.3+r){b[0]=clamp(b[0],-5.3+r,5.3-r);let lv=localVelocity(h,p.v);lv[0]*=-.25;p.v=worldVelocity(h,lv);p.p=houseWorld(h,b);collided=true;}
   else if(b[2]<-4.0+r){b[2]=-4.0+r;let lv=localVelocity(h,p.v);lv[2]*=-.25;p.v=worldVelocity(h,lv);p.p=houseWorld(h,b);collided=true;}
   else if(b[1]<.30+r){b[1]=.30+r;p.v[1]=Math.abs(p.v[1])*.22;p.v[0]*=.80;p.v[2]*=.80;p.p=houseWorld(h,b);collided=true;}
   continue;
  }
  const hit=segmentBox(a,b,[-5.62-r,.19-r,-4.34-r],[5.62+r,5.33+r,4.32+r]);if(!hit)continue;
  if(hit.axis===2&&hit.sign===1){const q=V.lerp(a,b,hit.t),g=h.gates.find(g=>Math.abs(q[0]-g.x)<g.w/2-r*.82&&q[1]>g.y-g.h/2+r*.85&&q[1]<g.y+g.h/2-r*.85);
   if(g){const normalSpeed=Math.abs(localVelocity(h,p.v)[2]);if(!g.broken&&g.type==='door'&&normalSpeed*p.mass<64){collided=hitWall(p,h,hit,a,b);showHint('大门撞不动 · 拿重箱并蓄满力，或改投窗户',4);break;}
    breakGate(h,g,p);p.pending={h,g};continue;
   }
  }
  collided=hitWall(p,h,hit,a,b);break;
 }
 if(!collided)p.p=next;
 if(p.p[1]<p.r+.11){p.p[1]=p.r+.11;if(p.v[1]<-1){hurtParcel(p,Math.abs(p.v[1]));p.bounces=(p.bounces||0)+1;p.v[1]*=-.32;p.v[0]*=.78;p.v[2]*=.78;if(p.age-p.lastHit>.3){tone(105,.065,'triangle',.13);p.lastHit=p.age;}}else{p.v[1]=0;p.v[0]*=Math.exp(-4*dt);p.v[2]*=Math.exp(-4*dt);}p.spin=V.mul(p.spin,.96);p.pending=null;}
 p.rot=V.add(p.rot,V.mul(p.spin,dt));
}

function overlapVehicles(t){const delta=V.sub(car.p,t.p),ra=carRight(),fa=carForward(),rb=[Math.cos(t.yaw),0,-Math.sin(t.yaw)],fb=[-Math.sin(t.yaw),0,-Math.cos(t.yaw)];let depth=Infinity,normal=null;
 for(const axis of [ra,fa,rb,fb]){const a=1.62*Math.abs(V.dot(ra,axis))+3.81*Math.abs(V.dot(fa,axis)),b=1.01*Math.abs(V.dot(rb,axis))+1.92*Math.abs(V.dot(fb,axis)),dist=V.dot(delta,axis),over=a+b-Math.abs(dist);if(over<=0)return null;if(over<depth){depth=over;normal=V.mul(axis,dist<0?-1:1);}}
 return{depth,normal};
}
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
// @include city-traffic-v07.js

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

// Procedural articulated couriers: model-space origin at feet, forward is -Z.
// Each mesh is shared; hierarchy transforms animate shoulders, elbows, hips, knees and head.
function courierParts(index){const jacket=index?'#439fbb':'#efae3f',dark=index?'#286c87':'#b97830',cap=index?'#295b70':'#d78732',skin=index?'#bd825e':'#e2ac80';
 const make=f=>{const b=new MeshBuilder();f(b);return renderer.mesh(b);};
 const part={};
 part.torso=make(b=>{b.box(.57,.55,.34,jacket,[0,1.105,0]);b.box(.43,.16,.30,jacket,[0,1.385,0]);
  for(const s of [-1,1]){b.box(.11,.40,.023,'#f6edcf',[s*.19,1.14,-.182]);b.box(.17,.15,.035,dark,[s*.16,1.01,-.2]);b.box(.18,.025,.04,'#ffd77b',[s*.16,1.08,-.223]);b.box(.13,.07,.032,'#e6e9d6',[s*.08,1.375,-.159],[0,0,s*.36]);}
  b.box(.58,.065,.36,'#ece8c8',[0,.94,0]);b.box(.018,.48,.027,'#345765',[0,1.12,-.202]);b.box(.1,.14,.02,'#f4f3e1',[-.13,1.24,-.206]);
  b.box(.057,.033,.025,'#385e72',[-.13,1.25,-.222]);for(let i=0;i<=index;i++)b.box(.013,.038,.028,'#385e72',[-.149+i*.036,1.201,-.223]);
  b.box(.13,.18,.07,'#2d4b5a',[.31,1.29,.08],[0,0,-.13]);b.box(.03,.18,.03,'#243f47',[.31,1.43,.08]);
  b.box(.56,.07,.35,'#294553',[0,.84,0]);b.box(.11,.08,.025,'#c5cfbf',[0,.84,-.19]);
  b.box(.40,.22,.06,dark,[0,1.21,.20]);b.box(.38,.07,.015,'#f7e3ab',[0,1.24,.238]);});
 part.hips=make(b=>b.box(.47,.17,.30,'#2b485b',[0,.785,0]));
 part.head=make(b=>{b.poly(.292,skin,[0,.045,0],[.88,1.06,.83]);b.cylinder(.087,.15,8,skin,[0,-.22,0]);
  for(const s of [-1,1]){b.poly(.060,skin,[s*.254,.027,0],[.8,1.2,.8]);b.box(.044,.051,.025,'#263d49',[s*.090,.061,-.232]);b.box(.067,.015,.03,'#5a4439',[s*.09,.117,-.212],[0,0,s*.06]);b.box(.052,.018,.01,'#d99376',[s*.135,-.035,-.21]);}
  b.poly(.045,skin,[0,.006,-.245],[.75,.8,1.1]);b.box(.083,.014,.026,'#885945',[0,-.09,-.217]);
  b.poly(.286,'#514b42',[0,.13,.01],[.91,.71,.87]);b.cylinder(.265,.105,12,cap,[0,.224,.006], [0,0,0],.228);
  b.box(.36,.037,.20,cap,[0,.196,-.225],[.04,0,0]);b.box(.09,.065,.023,'#f7e4ae',[0,.238,-.253]);b.box(.027,.039,.025,'#496777',[0,.238,-.267]);});
 part.upperArm=make(b=>{b.cylinder(.096,.26,8,jacket,[0,-.13,0]);b.cylinder(.099,.045,8,'#f4e6c3',[0,-.225,0]);});
 part.foreArm=make(b=>{b.cylinder(.078,.245,8,dark,[0,-.119,0]);b.cylinder(.083,.08,8,jacket,[0,-.021,0]);});
 part.hand=make(b=>{b.box(.135,.13,.13,skin,[0,-.052,0]);b.box(.041,.088,.06,skin,[-.077,-.021,-.035],[0,0,.24]);b.box(.115,.035,.138,'#2a4656',[0,.016,0]);});
 part.thigh=make(b=>{b.cylinder(.115,.34,8,'#304d63',[0,-.17,0]);b.box(.14,.13,.034,'#3c5970',[0,-.25,-.095]);});
 part.shin=make(b=>{b.cylinder(.091,.325,8,'#2d485c',[0,-.162,0]);b.box(.16,.048,.17,'#e3dbbf',[0,-.286,0]);});
 part.shoe=make(b=>{b.box(.22,.115,.34,'#284353',[0,-.007,-.072]);b.box(.226,.035,.355,'#e9e4ce',[0,-.072,-.072]);b.box(.17,.036,.17,index?'#4ea4bc':'#d9a04c',[0,.057,-.107]);b.box(.15,.019,.045,'#efeacf',[0,.08,-.108]);});
 return part;
}
const courierMeshes=[courierParts(0),courierParts(1)];
const fpArmMeshes=['#efae3f','#439fbb'].map((color,id)=>renderer.mesh(new MeshBuilder().box(.16,.16,.48,color,[0,0,0]).box(.164,.164,.05,'#ede3c5',[0,0,-.16]).box(.16,.15,.20,id?'#bd825e':'#e2ac80',[0,0,-.31])));
const courierStage=renderer.mesh(new MeshBuilder().cylinder(1.25,.14,48,'#365d68',[0,-.09,0]).cylinder(1.16,.016,48,'#7fa4a4',[0,-.011,0]).cylinder(1.09,.018,48,'#284a58',[0,.001,0]));
const courierGround=renderer.mesh(new MeshBuilder().box(150,.1,150,'#183641',[0,-.22,0]));
const windshieldMesh=renderer.mesh(new MeshBuilder().box(2.95,1.02,.09,'#83bbc4',[0,2.14,-3.59],[.14,0,0]));
const preview={active:false,action:'idle',which:0,yaw:.1,start:0,drag:null};
const poseNames={idle:'待机呼吸',walk:'走路',carry:'抱箱行走',charge:'蓄力',throw:'投掷',interact:'伸手开门',drive:'坐姿驾驶',wave:'挥手'};
function courierPose(a,t){const elapsed=Math.max(0,t-(a.animAt||0)),drive=a.view==='drive',walking=clamp(a.move||0,0,1),ph=a.walkPhase||0,holding=!!a.held,charge=a.charging?clamp(a.charge||0,0,1):0;
 const v={hip:0,lean:0,head:-clamp(a.pitch||0,-.8,.65)*.65,arms:[.06,.06],elbows:[.12,.12],spread:[-.08,.08],legs:[0,0],knees:[.05,.05],bodyYaw:0};
 v.hip=(Math.sin(t*2.5)*.007+Math.abs(Math.sin(ph))*.025*walking);v.lean=-walking*.055+Math.sin(t*2.5)*.008;
 for(let i=0;i<2;i++){const s=i?1:-1;v.legs[i]=Math.sin(ph)*.52*walking*s;v.knees[i]=Math.max(0,-Math.sin(ph)*s)*.64*walking+.045;v.arms[i]=-.45*Math.sin(ph)*walking*s+.08;}
 if(holding){v.arms=[1.15,1.15];v.elbows=[.23,.23];v.spread=[-.05,.05];v.lean=-.045;}
 if(charge>0){v.arms=[1.22+charge*.32,1.22+charge*.32];v.elbows=[.25+charge*.42,.25+charge*.42];v.lean=.07*charge;}
 if(a.anim==='throw'&&elapsed<.70){const f=elapsed<.16?elapsed/.16:1-clamp((elapsed-.16)/.54,0,1);v.arms=[1.72*f,1.72*f];v.elbows=[.10,.10];v.lean=-.16*f;}
 if(a.anim==='pick'&&elapsed<.55){const f=Math.sin(elapsed/.55*Math.PI);v.arms=[.68*f+.1,.85*f+.1];v.lean=-.20*f;v.knees=[.22*f,.22*f];v.hip-=.07*f;}
 if(a.anim==='interact'&&elapsed<.8){const f=Math.sin(elapsed/.8*Math.PI);v.arms[1]=1.38*f;v.elbows[1]=.15;v.bodyYaw=-.12*f;}
 if(a.anim==='wave'&&elapsed<2.2){v.arms[1]=2.65;v.elbows[1]=.26+Math.sin(elapsed*13)*.23;v.spread[1]=-.24;}
 if(drive){v.hip=0;v.lean=-.03;v.legs=[1.4,1.4];v.knees=[1.23,1.23];v.arms=[1.13+car.steer*.18,1.13-car.steer*.18];v.elbows=[.4,.4];v.head=Math.sin(t*.48)*.05;}
 if(drive&&a.anim==='wave'&&elapsed<2.2){v.arms[1]=2.5;v.elbows[1]=.28+Math.sin(elapsed*13)*.20;v.spread[1]=-.18;}
 return v;
}
function drawCourier(a,parent,t,bodyOnly=false){const meshes=courierMeshes[a.id===1?1:0],v=courierPose(a,t),root=M.multiply(parent,M.model([0,v.hip,0],[v.lean,v.bodyYaw,0]));
 renderer.draw(meshes.hips,root);renderer.draw(meshes.torso,root);
 if(!bodyOnly)renderer.draw(meshes.head,M.multiply(root,M.model([0,1.54,0],[v.head,Math.sin(t*.5+a.id)*.025,0])));
 for(let i=0;i<2;i++){const side=i?1:-1;
  const hip=M.multiply(parent,M.model([side*.155,.765+v.hip,0],[v.legs[i],0,0]));renderer.draw(meshes.thigh,hip);
  const knee=M.multiply(hip,M.model([0,-.34,0],[-v.knees[i],0,0]));renderer.draw(meshes.shin,knee);renderer.draw(meshes.shoe,M.multiply(knee,M.model([0,-.337,0],[v.knees[i]-v.legs[i],0,0])));
  if(bodyOnly)continue;const shoulder=M.multiply(root,M.model([side*.358,1.33,0],[v.arms[i],0,v.spread[i]]));renderer.draw(meshes.upperArm,shoulder);
  const elbow=M.multiply(shoulder,M.model([0,-.265,0],[v.elbows[i],0,0]));renderer.draw(meshes.foreArm,elbow);renderer.draw(meshes.hand,M.multiply(elbow,M.model([0,-.245,0],[0,side*.15,0])));
 }
 if(a.held&&!bodyOnly){const charge=a.charging?a.charge||0:0;drawTaggedParcel(a.held,M.multiply(root,M.model([0,1.09+charge*.23,-.565+charge*.05],[-charge*.3,0,0])));}
}
function avatarMatrix(a){return M.multiply(M.model(car.p,[0,car.yaw,0]),a.view==='drive'?M.model([-.79,.335,-2.63],[0,0,0]):M.model([a.p[0],CAB.floor,a.p[2]],[0,a.yaw,0]));}
function drawPlayers(){if(state.mode==='menu'||state.mode==='wardrobe')return;const other=otherAvatar();
 // V0.2.1: never render the local courier body in gameplay. The cargo camera is
 // physically inside that avatar, so even a torso/legs-only pass can fill the
 // first-person view on phones. Local presentation uses first-person arms only;
 // the remote courier remains a complete articulated model.
 if(other)drawCourier(other,avatarMatrix(other),state.time);
}
function drawNameplate(name,status,x,y,color){ctx.save();ctx.font='700 11px Arial,"PingFang SC",sans-serif';const title=cleanNickname(name),w=Math.max(74,ctx.measureText(title).width+22);const h=31,yy=y-h-9;ctx.fillStyle='#102d35e8';ctx.strokeStyle=color;ctx.lineWidth=1;if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x-w/2,yy,w,h,8);ctx.fill();ctx.stroke();}else{ctx.fillRect(x-w/2,yy,w,h);ctx.strokeRect(x-w/2,yy,w,h);}ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff2c8';ctx.fillText(title,x,yy+10);ctx.font='8px Arial,"PingFang SC",sans-serif';ctx.fillStyle='#a9c5c6';ctx.fillText(status,x,yy+22);ctx.restore();}
function drawAvatarLabels(){if(!net.connected||state.mode==='menu'||state.mode==='wardrobe')return;const a=otherAvatar();if(!a)return;const pos=M.point(avatarMatrix(a),[0,2.10,0]),p=renderer.project(pos);if(!p||p.x<38||p.x>width-38||p.y<80||p.y>height-80)return;const status=a.view==='drive'?'驾驶中':a.charging?'蓄力中':a.held?'抱着包裹':a.move>.1?'移动中':'投递员';drawNameplate(a.name||'队友',status,p.x,p.y,a.id===1?'#70d0e7':'#f2bd62');}
function drawEmptyHands(){if(state.mode!=='playing'||state.view!=='cargo'||player.held)return;const elapsed=state.time-(player.animAt||0),dur=player.anim==='throw'?.70:player.anim==='interact'?.8:player.anim==='pick'?.55:0;if(!dur||elapsed>dur)return;
 const f=viewDirection(),r=V.norm(V.cross(f,[0,1,0])),up=V.cross(r,f),reach=Math.sin(clamp(elapsed/dur,0,1)*Math.PI);renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT);
 for(const s of [-1,1]){if(player.anim==='interact'&&s<0)continue;const p=V.add(eye,V.add(V.mul(f,.52+reach*.28),V.add(V.mul(r,s*.26),V.mul(up,-.28+reach*.05))));renderer.draw(fpArmMeshes[player.id===1?1:0],M.model(p,[player.pitch-.08,car.yaw+player.yaw,s*-.05]));}}
function openWardrobe(){if(networked())stopNetwork(false);state.mode='wardrobe';preview.active=true;preview.start=performance.now()/1000;preview.yaw=.1;clearInputs();$('menu').classList.add('hidden');$('hud').classList.add('hidden');$('wardrobe').classList.remove('hidden');setPreviewAction('idle');}
function closeWardrobe(){preview.active=false;$('wardrobe').classList.add('hidden');renderer.gl.clearColor(.65,.82,.87,1);resetGame(true);}
function setPreviewAction(action){preview.action=action;preview.start=performance.now()/1000;$('poseTitle').textContent=poseNames[action];document.querySelectorAll('[data-pose]').forEach(b=>b.classList.toggle('active',b.dataset.pose===action));}
function drawCharacterPreview(){const now=performance.now()/1000,t=now-preview.start,portrait=height>width;renderer.gl.clearColor(.085,.17,.205,1);
 renderer.begin(portrait?[2.2,2.0,-4.6]:[2.45,1.90,-4.7],[0,1.0,0],(portrait?50:40)*Math.PI/180,width,height,Math.min(actualDPR(),1.5));renderer.draw(courierGround);renderer.draw(courierStage);
 const a={...newCourier(preview.which),view:preview.action==='drive'?'drive':'cargo',p:[0,2.38,0],yaw:0,move:0,pitch:0,walkPhase:0,anim:'idle',animAt:0,held:null};
 if(['walk','carry'].includes(preview.action)){a.move=1;a.walkPhase=t*8;}
 if(['carry','charge'].includes(preview.action))a.held={kind:0};
 if(preview.action==='charge'){a.charging=true;a.charge=(Math.sin(t*2)+1)/2;}
 if(preview.action==='throw'){a.anim='throw';a.animAt=now-(t%1.8);if(t%1.8>.75)a.held={kind:0};}
 if(['wave','interact'].includes(preview.action)){a.anim=preview.action;a.animAt=now-(t%(preview.action==='wave'?2.8:1.6));}
 const m=M.model([0,preview.action==='drive'?.28:0,0],[0,preview.yaw,0]);
 if(preview.action==='drive'){renderer.draw(previewSeatMesh,M.model([0,0,0],[0,preview.yaw,0]));}
 drawCourier(a,m,now);const dpr=Math.min(devicePixelRatio||1,2);if(overlay.width!==Math.round(width*dpr)||overlay.height!==Math.round(height*dpr)){overlay.width=Math.round(width*dpr);overlay.height=Math.round(height*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
}
const previewSeatMesh=renderer.mesh(new MeshBuilder().box(.70,.25,.7,'#466c78',[0,1.03,0]).box(.7,.82,.18,'#375963',[0,1.56,.3]).box(.18,.78,.18,'#263f4a',[0,.50,0]).cylinder(.27,.045,14,'#263f4a',[0,1.56,-.70],[Math.PI*.32,0,0]));

// Integrate the original V0.3 game without sharing the two players' input or cameras.
// Installed before DOM listeners bind function references.
const core={showHint,showToast,syncButtons,updateHUD,clearInputs,cancelCharge,tone,noiseSound,
 interact,toggleDoor,toggleBothDoors,dropPackage,startCharge,throwPackage,toggleBrick,setView,
 pause,resume,resetGame,service,stepPlayer,endRound,breakGate,explode,updateCamera,drawOverlay,draw3D};
showHint=function(text,seconds=5){if(net.executing){worldEvent('hint',{text});return;}core.showHint(text,seconds);};
showToast=function(title,sub='',duration=2.8){worldEvent('toast',{title,sub,duration});core.showToast(title,sub,duration);};
syncButtons=function(){if(net.executing)return;core.syncButtons();updateNetHUD();};
updateHUD=function(){core.updateHUD();updateNetHUD();if(networked()&&state.view==='cargo'&&hasDriver()&&$('risk').textContent.includes('无人掌舵'))$('risk').classList.add('hidden');};
tone=function(...a){if(!net.executing)core.tone(...a);};noiseSound=function(...a){if(!net.executing)core.noiseSound(...a);};
clearInputs=function(){if(net.executing){inputs.keys.clear();for(const k of ['left','right','gas','brake','forward','back','walkLeft','walkRight'])inputs[k].clear();inputs.stickX=inputs.stickY=0;state.charging=false;state.charge=0;state.chargeSource=null;return;}core.clearInputs();};
cancelCharge=function(){if(net.mode==='guest'&&!net.applying&&state.charging&&net.connected)action('cancel');if(net.executing){state.charging=false;state.charge=0;state.chargeSource=null;return;}core.cancelCharge();};
interact=function(){if(state.mode!=='playing')return;if(net.mode==='guest'&&!net.applying){action('interact');return;}const before=player.held,focus=collectFocus();core.interact();if(!before&&player.held)pulse('pick');else if(focus?.type==='door')pulse('interact');};
toggleDoor=function(index){if(net.mode==='guest'&&!net.applying){if(player.p[2]<1.45){showHint('先走到后门旁。',3);return;}action('door',{index});pulse('interact');return;}const before=doors[index]?.target;core.toggleDoor(index);if(doors[index]?.target!==before)pulse('interact');};
toggleBothDoors=function(){if(net.mode==='guest'&&!net.applying){if(player.p[2]<1.45){showHint('走到车尾才能开关后门。',3);return;}action('doors');pulse('interact');return;}const before=doors.map(d=>d.target).join();core.toggleBothDoors();if(before!==doors.map(d=>d.target).join())pulse('interact');};
dropPackage=function(){if(net.mode==='guest'&&!net.applying){if(player.held)action('drop');return;}if(player.held)pulse('pick');core.dropPackage();};
startCharge=function(source){const before=state.charging;if(net.executing){if(state.mode!=='playing'||state.view!=='cargo'||!player.held||state.charging||state.cooldown>0||state.time<state.switchUntil)return;state.charging=true;state.charge=.10;state.chargeSource=source;return;}
 core.startCharge(source);if(!before&&state.charging&&net.mode==='guest'&&!net.applying)action('charge');};
throwPackage=function(){if(net.mode==='guest'&&!net.applying){if(!player.held||state.mode!=='playing')return;const id=player.held.id,seq=action('throw',{power:state.charge});net.pendingThrow={id,seq};player.held=null;state.cooldown=.32;pulse('throw');tone(330,.13,'triangle',.15);syncButtons();return;}
 const before=player.held;core.throwPackage();if(before&&!player.held)pulse('throw');};
toggleBrick=function(){if(net.mode==='guest'&&!net.applying){if(state.view==='drive')action('brick');return;}core.toggleBrick();};
setView=function(view){if(networked()){
 if(net.mode==='guest'&&!net.applying){action('view',{view});return;}
 if(view==='drive'&&state.view!=='drive'){
  if(Math.abs(car.speed)>.65){showHint('先停车，再接管驾驶位。',4);return;}
  const other=net.executing?net.localView:net.remoteState?.view;if(other==='drive'){showHint('驾驶位有人。请队友先离座，空位只能由一人接管。',4);return;}}
 }
 if(net.executing){if(state.mode!=='playing'||state.time<state.switchUntil)return;if(view==='drive'){if(player.p[2]>-.47){showHint('先走回货箱前方，再接管空座位。',4);return;}if(player.held)dropPackage();}else if(state.view==='drive'){player.p=[.42,2.38,-.9];player.yaw=Math.PI;player.pitch=-.2;player.aimGate=player.aimHouse=null;}clearInputs();state.view=view;state.switchUntil=state.time+.48;car.steer=0;return;}
 const before=state.view;core.setView(view);if(before!==state.view){net.watch=false;if(state.view==='cargo')player.p[0]=player.id===1?.42:-.42;}
};
pause=function(){if(net.mode==='guest'&&!net.applying){netSend({t:'control',name:'pause'});net.pauseWho='已请求暂停，两人一起暂停';}
 else if(net.mode==='host'&&!net.pauseWho)net.pauseWho='房主暂停了游戏';core.pause();};
resume=function(){if(networked()&&!net.connected){showHint('连接已断开，请先退出联机再重新加入。',4);return;}
 if(net.mode==='guest'&&!net.applying){netSend({t:'control',name:'resume'});return;}net.pauseWho='';core.resume();};
resetGame=function(toMenu=false){if(net.mode==='guest'&&!net.applying){showHint('由房主重新开始本轮。',4);return;}
 core.resetGame(toMenu);Object.assign(player,{id:net.mode==='guest'?1:0,name:nickname,move:0,anim:'idle',animAt:0});net.watch=false;
 if(net.mode==='host'&&net.connected&&!net.applying){net.epoch++;net.remoteActor=newCourier(1);net.remoteActor.name=net.remoteName;net.remoteInput=blankInput();net.remoteState=newPersonal();net.lastAction=0;}
 net.pendingThrow=null;if(!toMenu&&net.mode==='solo')showHint('单人模式也有订单绑定包裹。点击顶部「订单」找货，车尾可下车回收。',6);
};
service=function(){if(net.mode==='guest')return;core.service();if(remoteReady()){net.remoteActor=newCourier(1);net.remoteActor.name=net.remoteName;net.remoteState=newPersonal();net.remoteInput=blankInput();}syncButtons();};
stepPlayer=function(dt){const old=player.p.slice();core.stepPlayer(dt);const speed=Math.hypot(player.p[0]-old[0],player.p[2]-old[2])/Math.max(.001,dt);player.move=mix(player.move||0,clamp(speed/2.5,0,1),1-Math.exp(-14*dt));};
step=function(dt){state.time+=dt;state.cooldown=Math.max(0,state.cooldown-dt);state.hitCooldown=Math.max(0,state.hitCooldown-dt);state.shake=Math.max(0,state.shake-dt*.7);if(state.charging)state.charge=Math.min(1,state.charge+dt*.9);
 if(remoteReady()&&net.remoteState.view==='drive')inRemote(()=>stepCar(dt));else stepCar(dt);
 stepTraffic(dt);stepCargo(dt);stepPlayer(dt);
 if(remoteReady())inRemote(()=>{state.cooldown=Math.max(0,state.cooldown-dt);if(state.charging)state.charge=Math.min(1,state.charge+dt*.9);stepPlayer(dt);});
 stepParcels(dt);stepEffects(dt);
};
breakGate=function(h,g,p){const was=g.broken;core.breakGate(h,g,p);if(!was&&g.broken)worldEvent('gate',{num:h.num,index:g.index,v:p.v?.slice()||[0,0,0]});};
explode=function(t){const was=t.phase;core.explode(t);if(was!=='wreck')worldEvent('explosion',{id:t.id,p:t.p.slice()});};
updateCamera=function(dt){if(net.watch&&state.view==='drive'&&net.connected){const e=vehicleToWorld([0,3.12,-1.27]),target=vehicleToWorld([0,1.94,2.68]);eye=e;at=target;return;}core.updateCamera(dt);};
drawOverlay=function(){core.drawOverlay();drawAvatarLabels();if(net.watch&&state.view==='drive'){ctx.fillStyle='#162f38dc';ctx.fillRect(width/2-77,65,154,25);ctx.fillStyle='#ffe1a0';ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText((otherAvatar()?.view==='outside'?'车外观察':'货箱观察')+' · 你仍在驾驶',width/2,82);}};
draw3D=function(){if(state.mode==='wardrobe'){drawCharacterPreview();return;}core.draw3D();};
function wave(){if(state.mode!=='playing')return;pulse('wave');if(net.mode==='guest')action('wave');else showHint('你向队友挥了挥手。',2);}
function toggleWatch(){if(state.view!=='drive'||!net.connected)return;net.watch=!net.watch;cameraBlend=0;updateNetHUD();}

// @include coop-v06.js
// @include city-ui-v07.js

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

const requiredStartupIds=['game','world','overlay','menu','hud','startBtn','hostBtn','joinBtn'];const missingStartup=requiredStartupIds.filter(id=>!$(id));if(missingStartup.length)console.error('Missing startup DOM:',missingStartup);resize();resetGame(true);const start=$('startBtn');if(start){start.disabled=false;start.textContent='单人测试 →';}window.__deliveryBootReady=true;requestAnimationFrame(frame);
})();
