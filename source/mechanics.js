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
