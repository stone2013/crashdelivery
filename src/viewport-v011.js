/* V0.11.1 PWA FIX — one authoritative viewport owner. */
const PWA0111={h:0,w:0,top:0,standalone:false,serial:0};
function pwa0111Standalone(){
 return !!navigator.standalone || matchMedia('(display-mode: standalone)').matches;
}
function pwa0111Measure(){
 const vv=window.visualViewport, standalone=pwa0111Standalone();
 const portrait=matchMedia('(orientation: portrait)').matches;
 const screenH=window.screen ? (portrait?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height)) : 0;
 const visualH=vv ? vv.height + Math.max(0,vv.offsetTop||0) : 0;
 const innerH=window.innerHeight||0, clientH=document.documentElement.clientHeight||0;
 // iOS standalone can report innerHeight/visualViewport shorter than the actual PWA surface.
 // screen.height is in CSS px and is stable for the installed app.
 let h=standalone && screenH ? screenH : Math.max(visualH,innerH,clientH);
 // Never let transient keyboard/browser UI enlarge a browser tab beyond its visual viewport.
 if(!standalone && vv?.height)h=Math.max(vv.height,Math.min(h,vv.height+Math.max(0,vv.offsetTop||0)));
 return Math.max(1,Math.round(h));
}
function pwa0111Apply(){
 const h=pwa0111Measure(), root=document.documentElement, body=document.body, game=document.getElementById('game');
 PWA0111.h=h;PWA0111.w=window.innerWidth;PWA0111.standalone=pwa0111Standalone();PWA0111.serial++;
 root.style.setProperty('--pwaH',h+'px');root.style.setProperty('--appH51',h+'px');root.style.setProperty('--appH',h+'px');
 root.style.setProperty('height',h+'px','important');
 body?.style.setProperty('height',h+'px','important');
 if(game){
   game.style.setProperty('height',h+'px','important');
   game.style.setProperty('min-height',h+'px','important');
   game.style.setProperty('max-height',h+'px','important');
   game.style.setProperty('top','0','important');
   game.style.setProperty('bottom','auto','important');
 }
 try{resize();}catch(e){console.warn('PWA resize',e.message);}
}
let pwa0111RAF=0;
function pwa0111Sync(delay=0){
 const run=()=>{cancelAnimationFrame(pwa0111RAF);pwa0111RAF=requestAnimationFrame(pwa0111Apply);};
 delay?setTimeout(run,delay):run();
}
for(const ev of ['resize','orientationchange','pageshow'])window.addEventListener(ev,()=>pwa0111Sync(ev==='orientationchange'?100:0),{passive:true});
window.visualViewport?.addEventListener('resize',()=>pwa0111Sync(),{passive:true});
window.visualViewport?.addEventListener('scroll',()=>pwa0111Sync(),{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){pwa0111Sync();pwa0111Sync(180);}});
window.addEventListener('focus',()=>pwa0111Sync(40),{passive:true});
pwa0111Sync();pwa0111Sync(250);pwa0111Sync(900);
if(window.__deliveryTest)window.__deliveryTest.pwa0111=()=>({
 height:PWA0111.h,standalone:PWA0111.standalone,serial:PWA0111.serial,
 innerHeight:window.innerHeight,screenHeight:screen.height,visualHeight:visualViewport?.height||0,
 game:document.getElementById('game')?.getBoundingClientRect().height||0,
 bottom:document.getElementById('game')?.getBoundingClientRect().bottom||0
});
