/* Test hooks only; never enabled unless the existing ?test flag is present. */
if(window.__deliveryTest)Object.assign(window.__deliveryTest.suburban011,{
 movingThrow:(num,gi=0)=>{
  const h=houses.find(h=>h.num===num),o=SUB011.homes.find(o=>o.h===h),g=h.gates[gi],p=cargo.find(p=>p.order===num);if(!p)throw Error('Parcel not found');
  car.p=houseWorld(h,[g.x-7,.12,o.frontage+3.8+8-3.05]);car.yaw=h.yaw+Math.PI/2;car.speed=7;car.hp=100;car.fault='';car.kick=[0,0,0];car.velocity=V.mul(carForward(),7);car.roadPitch=0;
  state.mode='playing';state.view='cargo';state.switchUntil=0;state.cooldown=0;state.brick=true;brickBody.placed=true;player.p=[0,2.38,3.3];player.repair=null;doors.forEach(d=>{d.target=1.7;d.angle=1.7});
  cargo.splice(cargo.indexOf(p),1);player.held=p;player.aimHouse=null;player.aimGate=null;
  const power=.55,speed=(18+power*22)*parcelType(p.kind).throwMul,eyePos=V.add(worldEye(),[0,-.13,0]),target=houseWorld(h,[g.x,g.y,g.planeZ+.46]);
  const deltaAt=t=>V.sub(V.sub(target,eyePos),V.add(V.mul(car.velocity,t),[0,2*t-6*t*t,0])),f=t=>V.len(deltaAt(t))-(.56+speed*t);
  let lo=.005,hi=.02;while(f(hi)>0&&hi<2)hi+=.01;if(hi>=2)throw Error('Ballistic fixture has no solution');for(let i=0;i<40;i++){const m=(lo+hi)/2;if(f(m)>0)lo=m;else hi=m;}
  const dir=V.norm(deltaAt((lo+hi)/2));player.yaw=wrapAngle(Math.atan2(-dir[0],-dir[2])-car.yaw);player.pitch=Math.asin(dir[1]);
  startCharge('moving-qa');state.charge=power;const solution=shotSolution();finishCharge('moving-qa');return{parcel:p.id,from:solution.origin,v:solution.v,carSpeed:car.speed,view:state.view};
 },
 shared:()=>netSnapshot(),
 applyShared:m=>{net.mode='guest';net.connected=true;applyHostSnapshot(m);},
 host:()=>{net.mode='host';net.connected=false;},
 gates:num=>houses.find(h=>h.num===num).gates.map(g=>({type:g.type,broken:g.broken,holes:g.holes012||[]})),
 geometry:()=>({homes:SUB011.homes.map(o=>({num:o.h.num,name:o.name,m:Array.from(o.m)})),nativePortals:SUB011_NATIVE}),
 collisionParity:num=>{const h=houses.find(h=>h.num===num),o=SUB011.homes.find(o=>o.h===h),run=pred=>{car.p=houseWorld(h,[0,.12,o.hd+10]);car.yaw=h.yaw;car.speed=18;car.kick=[0,0,0];car.velocity=V.mul(carForward(),18);state.view='drive';clearInputs();for(let i=0;i<120;i++)stepCar(1/120,pred);return houseLocal(h,car.p);};return{host:run(false),predicted:run(true)};},
 eye:(eyePos,look)=>{road09.debugCamera={eye:eyePos,at:look};updateCamera(.1);draw3D();},
 redraw:()=>draw3D()
});
