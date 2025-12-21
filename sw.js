/* Arbeitszeiterfassung PWA Service Worker */
const CACHE_NAME = 'arbeitszeit-v18';
const ASSETS = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE_NAME);await c.addAll(ASSETS);self.skipWaiting();})());});
self.addEventListener('activate', e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.map(k=>k===CACHE_NAME?null:caches.delete(k)));self.clients.claim();})());});
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE_NAME);
    const cached=await c.match(e.request,{ignoreSearch:true});
    if(cached) return cached;
    try{
      const fresh=await fetch(e.request);
      const u=new URL(e.request.url);
      if(u.origin===self.location.origin) c.put(e.request,fresh.clone());
      return fresh;
    }catch(_){
      const fb=await c.match('./index.html');
      return fb || new Response('Offline',{status:200,headers:{'Content-Type':'text/plain'}});
    }
  })());
});
