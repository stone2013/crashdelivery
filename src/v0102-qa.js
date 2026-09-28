// Diagnostics exist only with the existing ?test opt-in; never change production authority.
if(window.__deliveryTest)window.__deliveryTest.v0102={
 info:()=>({ready:industrial012.ready,error:industrial012.error,audit:industrial012.audit,placements:industrial012.placements.map(o=>({name:o.name,role:o.role,x:o.x,z:o.z,yaw:o.yaw,hw:o.hw,hd:o.hd,height:o.height,house:o.h?.num||0})),targets:industrial012.targets.map(t=>({num:t.h.num,label:t.label,kind:t.kind,center:t.center,done:t.h.done})),colliders:industrial012.colliders.length,furnitureMoved:industrial012.furnitureMoved,furnitureConflicts:industrial012.furnitureConflicts}),
 overlapAudit:()=>{const bad=[];for(let i=0;i<industrial012.placements.length;i++)for(let j=i+1;j<industrial012.placements.length;j++)if(ind012Overlap(industrial012.placements[i],industrial012.placements[j],0))bad.push([i,j]);return bad;},
 roadAudit:()=>industrial012.placements.map(o=>({name:o.name,x:o.x,z:o.z,ok:ind012StreetClear(o)})),
 reset:()=>{stopNetwork(false);resetGame(false);freezeSimulation=true;simAccumulator=0;for(const t of traffic){t.phase='cleared';t.p=[-320,.1,-320];}for(const t of road09.npc){t.phase='parked';t.stopped=-1e8;t.p=[-320,.1,-320];}return true;},
 fire:(num,opts={})=>{const h=houses.find(x=>x.num===num),t=industrial012.targets.find(t=>t.h===h),g=h.gates[opts.gate??(h.industrial012?0:0)];const order=opts.order||num;let p=cargo.find(p=>p.order===order);if(!p)throw Error('No undelivered parcel '+order);cargo.splice(cargo.indexOf(p),1);
  const plane=t?t.z:4.34,targetZ=t?.kind==='platform'? t.back+t.d*.45:plane-.25,goalY=t?.kind==='platform'?.84:g.y+(opts.dy||0),distance=opts.distance||8,flight=distance/(opts.speed||25),startY=opts.y??goalY;
  const start=[g.x+(opts.dx||0),startY,plane+distance];p.p=houseWorld(h,start);p.v=worldVelocity(h,[0,(goalY-startY+6*flight*flight)/flight,-(start[2]-targetZ)/flight]);p.rot=[0,0,0];p.spin=[0,0,0];p.age=0;p.lastHit=-2;p.thrown=true;p.delivered=false;p.pending=null;p.vehicleSpeed=0;p.dist=0;p.integrity=100;p.returnToDoor=false;packages.push(p);return{id:p.id,order:p.order,from:p.p,v:p.v,gate:g.index};},
 parcel:id=>{const p=packages.find(p=>p.id===id);return p?{id:p.id,p:p.p,v:p.v,delivered:p.delivered,order:p.order,pending:p.pending?.h.num||0,wrong:p.wrongAt}:null;},
 damageWindow:(num,index=0,x=0,y=0,r=.28)=>{const h=houses.find(h=>h.num===num),g=h.gates[index];glass012Impact(h,g,{r,v:[0,0,-20]},[g.x+x,g.y+y,g.planeZ||4.34]);return g.holes012;},
 panes:()=>houses.flatMap(h=>h.gates.filter(g=>g.type==='window').map(g=>({num:h.num,index:g.index,holes:g.holes012||[],w:g.w,h:g.h}))),
 glass:()=>({draws:GLASS012.draws,uploads:GLASS012.uploads,panes:GLASS012.panes.size}),
 texture:(num,index=0)=>{const h=houses.find(h=>h.num===num),g=h.gates[index],o=glass012Texture(g);return o.canvas.toDataURL();},
 glassCamera:(num,index=0)=>{const h=houses.find(h=>h.num===num),g=h.gates[index],z=g.planeZ||4.34;const e=houseWorld(h,[g.x,g.y,z+6]),a=houseWorld(h,[g.x,g.y,z]);road09.debugCamera={eye:e,at:a};eye=e;at=a;draw3D();},
 cameraAt:(num)=>{const h=houses.find(h=>h.num===num),o=industrial012.placements.find(o=>o.h===h),z=(o?.hd||5)+3;const e=houseWorld(h,[14,9.5,z+22]),a=houseWorld(h,[0,4,z-2]);road09.debugCamera={eye:e,at:a};eye=e;at=a;draw3D();},
 lighting:()=>({shade:LIGHT012.shade,cover:lighting012Cover(),mode:LIGHT012.mode,draws:LIGHT012.draws}),
 collide:(num,speed=20,seconds=1.1)=>{const h=houses.find(h=>h.num===num),o=industrial012.placements.find(o=>o.h===h);clearInputs();car.p=houseWorld(h,[o.hw+9,.12,0]);car.yaw=h.yaw+Math.PI/2;car.speed=speed;car.hp=100;car.fault='';car.velocity=V.mul(carForward(),speed);car.kick=[0,0,0];state.view='drive';state.mode='playing';for(let i=0;i<Math.ceil(seconds*120);i++)stepCar(1/120,false);return {p:car.p,local:houseLocal(h,car.p),speed:car.speed,overlap:!!ind012SAT(industrial012.colliders.find(c=>c.house===num&&c.label===o.name))};},
 guestAttempt:num=>{const t=industrial012.targets.find(t=>t.h.num===num),old=net.mode,score=state.score;net.mode='guest';const p={p:t.center.slice(),v:[0,0,-20],r:.2,delivered:false,order:num};try{ind012Parcel(V.add(t.center,[0,0,2]),t.center,p);return{delivered:p.delivered,scoreChanged:state.score!==score};}finally{net.mode=old;}},
 snapshot:()=>netSnapshot(),apply:m=>applyHostSnapshot(m),
 pauseExit:road091ExitToMenu,
 view:mode=>{state.view=mode;state.mode='playing';state.switchUntil=0;syncButtons();updateHUD();},
 render:()=>{updateCamera(.2);updateHUD();drawMap();draw3D();return renderer.gl.getError();}
};
