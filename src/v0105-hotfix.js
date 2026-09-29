/* V0.10.5 — industrial frontage / concrete / gantry / contact-shadow / iOS PWA hotfix. */
const V0105={ready:false,concrete:null,facade:null,gantry:null,viewport:{height:0,top:0,standalone:false},gantries:[],industrialBounds:null};

function v0105BuildConcreteAndFacades(){
 if(!industrial012.ready||V0105.concrete)return;
 const placements=industrial012.placements.filter(o=>o.role==='main'||o.role==='infill'||o.role==='prop');
 if(!placements.length)return;
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const o of placements){minX=Math.min(minX,o.x-o.hw);maxX=Math.max(maxX,o.x+o.hw);minZ=Math.min(minZ,o.z-o.hd);maxZ=Math.max(maxZ,o.z+o.hd);}
 // Extend to the industrial block boundary so factories no longer sit on isolated grass patches.
 minX=Math.min(minX-8,66);maxX=Math.max(maxX+8,204);minZ=Math.min(minZ-8,-112);maxZ=Math.max(maxZ+8,112);
 V0105.industrialBounds={minX,maxX,minZ,maxZ};
 const ground=new MeshBuilder(),cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,w=maxX-minX,d=maxZ-minZ;
 ground.box(w,.045,d,'#8d9698',[cx,.050,cz]);
 // Subtle concrete expansion joints; road decks remain above this layer at ~0.08m.
 for(let x=Math.ceil(minX/16)*16;x<maxX;x+=16)ground.box(.045,.008,d,'#747f82',[x,.076,cz]);
 for(let z=Math.ceil(minZ/16)*16;z<maxZ;z+=16)ground.box(w,.008,.045,'#747f82',[cx,.076,z]);
 V0105.concrete=renderer.mesh(ground);

 const facade=new MeshBuilder();
 for(const o of industrial012.placements.filter(o=>o.role==='main'&&o.h)){
  const h=o.h,t=industrial012.targets.find(t=>t.h===h);if(!t)continue;
  const m=h.model,doorW=Math.min(o.hw*1.55,Math.max(8.2,t.w+2.2)),doorH=Math.max(4.9,t.maxY-t.minY+.9),frontZ=o.hd+.12;
  // A real road-facing facade masks whichever side of the Kenney model was originally the back.
  facade.box(doorW+1.2,doorH+1.25,.30,'#737e84',[0,(doorH+1.25)/2+.12,frontZ],[0,0,0],m);
  facade.box(doorW,doorH,.11,'#26383f',[0,doorH/2+.28,frontZ+.18],[0,0,0],m);
  for(let y=.65;y<doorH-.1;y+=.42)facade.box(doorW-.22,.035,.07,'#7e8c90',[0,y,frontZ+.245],[0,0,0],m);
  facade.box(doorW+1.25,.68,.14,'#24454a',[0,doorH+.76,frontZ+.20],[0,0,0],m);
  cityText(facade,String(h.num),[0,doorH+.78,frontZ+.29],.105,'#ffdc73',m);
  // Small but explicit 2–4m loading forecourt between garage and curb.
  const apron=clamp(h.setback012||2.4,2.0,4.0);
  facade.box(doorW+2.1,.042,apron,'#a1a8a9',[0,.105,o.hd+apron*.5],[0,0,0],m);
  facade.box(doorW+1.2,.018,.11,'#f1cc57',[0,.135,o.hd+apron-.08],[0,0,0],m);
  for(const side of [-1,1])facade.box(.11,.018,apron,'#f1cc57',[side*(doorW/2+.5),.135,o.hd+apron*.5],[0,0,0],m);
 }
 V0105.facade=renderer.mesh(facade);
}

function v0105AddGantry(builder,cx,cz,baseY,travelYaw,leftText,rightText){
 const m=M.model([cx,baseY,cz],[0,travelYaw,0]),B=(w,h,d,c,p)=>builder.box(w,h,d,c,p,[0,0,0],m);
 const pole=10.45,clear=5.45,panelY=7.05;
 B(.34,clear+.25,.34,'#73848b',[-pole,(clear+.25)/2,0]);B(.34,clear+.25,.34,'#73848b',[pole,(clear+.25)/2,0]);
 B(pole*2+.35,.26,.32,'#73848b',[0,clear,0]);
 for(const [x,text] of [[-5.05,leftText],[5.05,rightText]]){B(9.25,2.20,.22,'#2d704f',[x,panelY,.08]);B(9.55,.14,.28,'#d9e5d9',[x,panelY+1.15,.08]);cityText(builder,text,[x,panelY+.07,.22],.090,'#f2f7ed',m);}
 V0105.gantries.push({x:cx,z:cz,y:baseY,yaw:travelYaw,left:leftText,right:rightText});
}
function v0105BuildGantries(){
 if(V0105.gantry||!road09.ready)return;
 const b=new MeshBuilder();
 // Ground-city approaches and one actual elevated SKYWAY span.
 v0105AddGantry(b,28,56,.08,-Math.PI/2,'CITY','INDUSTRY');
 v0105AddGantry(b,84,0,.08,-Math.PI/2,'INDUSTRY','SKYWAY');
 v0105AddGantry(b,224,8,8.08,-Math.PI/2,'SKYWAY','CITY');
 V0105.gantry=renderer.mesh(b);
}

const v0105IndustrialDraw=industrial012Draw;
industrial012Draw=function(){
 if(V0105.concrete)renderer.draw(V0105.concrete);
 if(V0105.gantry)renderer.draw(V0105.gantry);
 v0105IndustrialDraw();
 if(V0105.facade)renderer.draw(V0105.facade);
};

function v0105SyncViewport(){
 const doc=document.documentElement,body=document.body,game=document.getElementById('game'),vv=window.visualViewport;
 const standalone=!!navigator.standalone||matchMedia('(display-mode: standalone)').matches;
 const inner=Math.round(window.innerHeight||doc.clientHeight||1),visual=vv?Math.round(vv.height+(vv.offsetTop||0)):0;
 const h=Math.max(1,inner,visual),top=0;
 V0105.viewport={height:h,top,standalone};
 doc.classList.toggle('pwaStandalone0105',standalone);
 doc.style.setProperty('--appH',h+'px');doc.style.setProperty('--appTop',top+'px');
 doc.style.setProperty('height',h+'px','important');body.style.setProperty('height',h+'px','important');
 game?.style.setProperty('height',h+'px','important');game?.style.setProperty('min-height',h+'px','important');game?.style.setProperty('max-height',h+'px','important');game?.style.setProperty('top','0px','important');game?.style.setProperty('bottom','auto','important');
 requestAnimationFrame(()=>{try{resize();}catch(e){}});
}
for(const ev of ['pageshow','orientationchange'])window.addEventListener(ev,()=>setTimeout(v0105SyncViewport,60));
window.addEventListener('resize',v0105SyncViewport,{passive:true});window.visualViewport?.addEventListener('resize',v0105SyncViewport,{passive:true});window.visualViewport?.addEventListener('scroll',v0105SyncViewport,{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(v0105SyncViewport,60);});
setTimeout(v0105SyncViewport,0);setTimeout(v0105SyncViewport,320);setTimeout(v0105SyncViewport,900);

function v0105FinishInit(){
 if(V0105.ready)return;if(!road09.ready||!industrial012.ready){if(!industrial012.error)setTimeout(v0105FinishInit,60);return;}
 v0105BuildConcreteAndFacades();v0105BuildGantries();V0105.ready=true;lighting012BuildShadows();
}
setTimeout(v0105FinishInit,40);

if(window.__deliveryTest)window.__deliveryTest.v0105=()=>({ready:V0105.ready,viewport:{...V0105.viewport},industrialBounds:V0105.industrialBounds,gantries:V0105.gantries,frontages:industrial012.audit.map(x=>({num:x.num,frontDot:x.frontDot,setback:x.frontSetback,kerb:x.apertureFromKerb,ground:x.groundFrontage,elevated:x.elevatedClear})),shadow:'wheel-contact+underbody'});
