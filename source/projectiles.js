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
