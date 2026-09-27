const CACHE='crash-delivery-v080-pwa-20260927';
const SHELL=['./','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
function realtime(u){
  return u.origin==='https://api.feelpal.app' ||
         u.pathname.includes('turn-credentials') ||
         u.pathname.startsWith('/rooms');
}
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET') return;
  const u=new URL(r.url);
  if(realtime(u)) return; // TURN credentials / room directory are never cached.
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./',copy));}
      return res;
    }).catch(()=>caches.match('./')));
    return;
  }
  if(u.origin===self.location.origin){
    e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy));}
      return res;
    })));
  }
});
