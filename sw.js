/* Crash Delivery V0.10.2. Versioned shell only; no room/token responses are cached. */
'use strict';
const ROOT = new URL('./', self.registration.scope);
const PREFIX = 'crashdelivery-pwa::' + ROOT.pathname + '::';
const CACHE = PREFIX + 'afe9181d048069ce';
const INDEX = new URL('index.html', ROOT).href;
const STATIC = ["manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","assets/kenney-industrial/building-a.glb","assets/kenney-industrial/building-f.glb","assets/kenney-industrial/building-l.glb","assets/kenney-industrial/building-q.glb","assets/kenney-industrial/building-r.glb","assets/kenney-industrial/building-t.glb","assets/kenney-industrial/water-tower.glb","assets/kenney-industrial/detail-tank-large.glb","assets/kenney-industrial/chimney-large.glb","assets/kenney-industrial/shipping-container-a.glb","assets/kenney-industrial/shipping-container-b.glb","assets/kenney-industrial/shipping-container-c.glb","assets/kenney-industrial/solar-panel-landscape-group.glb","assets/kenney-industrial/variation-a.png"].map(p=>new URL(p,ROOT).href);
const SHELL = [INDEX,...STATIC];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
function liveOnly(url){return url.origin!==ROOT.origin||/\/(turn-credentials|rooms)(\/|$)/.test(url.pathname)||url.pathname.includes('/api/');}
async function navigation(request){
 const cache=await caches.open(CACHE);
 try{
  const response=await fetch(request,{cache:'no-store'});
  if(response.ok&&response.headers.get('content-type')?.includes('text/html')){await cache.put(INDEX,response.clone());return response;}
  return (await cache.match(INDEX))||response;
 }catch(e){return (await cache.match(INDEX))||new Response('请联网打开一次《暴力快递》，完成离线缓存。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}
}
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(liveOnly(url))return;
 const isGame=url.pathname===ROOT.pathname||url.pathname===new URL(INDEX).pathname;
 if(request.mode==='navigate'&&isGame){event.respondWith(navigation(request));return;}
 if(STATIC.includes(url.origin+url.pathname))event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;})());
});
