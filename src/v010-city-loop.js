/* V0.10 CITY LOOP — layout polish + elevated expressway speed system.
 * Keeps V0.9.5 orders/traffic/multiplayer; expands the existing SKYWAY into a gameplay highway loop.
 */
const V010={version:'0.10.0',name:'CITY LOOP',highway:false,enteredAt:0,bonusPeak:0};
function v010HighwaySurface(){
 if(!road09?.ready||road09Duel())return false;
 const g=road09Support(car.p[0],car.p[2],car.p[1]-.04);
 // Elevated Kenney surface only: bridge-under traffic never receives the expressway bonus.
 return !!g.road && g.y>4.0 && Math.abs(car.p[1]-(g.y+.04))<.75;
}
function v010HighwayStep(dt){
 const on=v010HighwaySurface();
 if(on!==V010.highway){
  V010.highway=on;
  if(on){V010.enteredAt=state.time;showHint('🛣️ SKYWAY 高速 · 限速提升至 100 km/h',3);}
  else if(state.time-V010.enteredAt>.8)showHint('驶离 SKYWAY · 恢复城市道路限速',2);
 }
 if(on&&state.view==='drive'&&car.hp>0){
  const gas=inputs.keys.has('KeyW')||inputs.keys.has('ArrowUp')||inputs.gas.size||state.brick;
  const cap=27.8; // 100 km/h
  if(gas&&car.speed>0)car.speed=Math.min(cap,car.speed+4.2*dt);
  V010.bonusPeak=Math.max(V010.bonusPeak,Math.abs(car.speed)*3.6);
 }
}
const v010Step=step;
step=function(dt){v010Step(dt);if(state.mode==='playing'&&!net.executing)v010HighwayStep(dt);};
const v010UpdateHUD=updateHUD;
updateHUD=function(){v010UpdateHUD();const chip=$('districtChip');if(chip&&V010.highway){chip.textContent='SKYWAY · 高速 100';chip.classList.add('on');}};
const v010Reset=resetGame;
resetGame=function(toMenu=false){V010.highway=false;V010.enteredAt=0;V010.bonusPeak=0;v010Reset(toMenu);if(!toMenu)showHint('V0.10 CITY LOOP · 全城道路 + SKYWAY 高速提速',5);};
if(window.__deliveryTest)window.__deliveryTest.v010={
 version:()=>V010.version,
 highway:()=>({active:V010.highway,surface:v010HighwaySurface(),speedKmh:Math.abs(car.speed)*3.6,peak:V010.bonusPeak}),
 highwayProbe:(x,z,ref=8)=>{const old=car.p.slice();car.p=[x,road09Support(x,z,ref).y+.04,z];const r={p:car.p.slice(),active:v010HighwaySurface()};car.p=old;return r;}
};
