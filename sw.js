const CACHE='crash-delivery-pwa-v1';
const SHELL=['./','./manifest.webmanifest','./icons/app-icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
const live=u=>u.origin==='https://api.feelpal.app'||u.pathname.includes('turn-credentials')||u.pathname.startsWith('/rooms');
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(live(u))return;if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const y=x.clone();caches.open(CACHE).then(c=>c.put('./',y));return x}).catch(()=>caches.match('./')));return}if(u.origin===self.location.origin)e.respondWith(caches.match(r).then(h=>h||fetch(r).then(x=>{if(x.ok){const y=x.clone();caches.open(CACHE).then(c=>c.put(r,y))}return x})))});
