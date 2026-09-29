/* Crash Delivery V0.11. Versioned shell only; no room/token responses are cached. */
'use strict';
const ROOT = new URL('./', self.registration.scope);
const PREFIX = 'crashdelivery-pwa::' + ROOT.pathname + '::';
const CACHE = PREFIX + '3edebd0c8fb92ec6';
const INDEX = new URL('index.html', ROOT).href;
const STATIC = ["assets/kenney-industrial/building-a.glb", "assets/kenney-industrial/building-f.glb", "assets/kenney-industrial/building-l.glb", "assets/kenney-industrial/building-q.glb", "assets/kenney-industrial/building-r.glb", "assets/kenney-industrial/building-t.glb", "assets/kenney-industrial/chimney-large.glb", "assets/kenney-industrial/detail-tank-large.glb", "assets/kenney-industrial/shipping-container-a.glb", "assets/kenney-industrial/shipping-container-b.glb", "assets/kenney-industrial/shipping-container-c.glb", "assets/kenney-industrial/solar-panel-landscape-group.glb", "assets/kenney-industrial/variation-a.png", "assets/kenney-industrial/water-tower.glb", "assets/kenney-suburban/ASSETS.json", "assets/kenney-suburban/building-type-a.glb", "assets/kenney-suburban/building-type-b.glb", "assets/kenney-suburban/building-type-c.glb", "assets/kenney-suburban/building-type-d.glb", "assets/kenney-suburban/building-type-e.glb", "assets/kenney-suburban/building-type-f.glb", "assets/kenney-suburban/building-type-g.glb", "assets/kenney-suburban/building-type-h.glb", "assets/kenney-suburban/building-type-i.glb", "assets/kenney-suburban/building-type-j.glb", "assets/kenney-suburban/building-type-k.glb", "assets/kenney-suburban/building-type-l.glb", "assets/kenney-suburban/building-type-m.glb", "assets/kenney-suburban/building-type-n.glb", "assets/kenney-suburban/building-type-o.glb", "assets/kenney-suburban/building-type-p.glb", "assets/kenney-suburban/building-type-q.glb", "assets/kenney-suburban/building-type-r.glb", "assets/kenney-suburban/building-type-s.glb", "assets/kenney-suburban/building-type-t.glb", "assets/kenney-suburban/building-type-u.glb", "assets/kenney-suburban/colormap.png", "assets/kenney-suburban/driveway-short.glb", "assets/kenney-suburban/fence-low.glb", "assets/kenney-suburban/path-short.glb", "assets/kenney-suburban/path-stones-short.glb", "assets/kenney-suburban/planter.glb", "assets/kenney-suburban/tree-large.glb", "assets/kenney-suburban/tree-small.glb", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"].map(p=>new URL(p,ROOT).href);
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
