/* Arbeitszeit-Tracker PWA Service Worker */
const CACHE_NAME = 'arbeitszeit-tracker-v4';
const ASSETS = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', (event)=>{event.waitUntil((async()=>{const c=await caches.open(CACHE_NAME);await c.addAll(ASSETS);self.skipWaiting();})());});
self.addEventListener('activate', (event)=>{event.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.map(k=>k===CACHE_NAME?null:caches.delete(k)));self.clients.claim();})());});
self.addEventListener('fetch', (event)=>{
  const req=event.request;
  if(req.method!=='GET') return;
  event.respondWith((async()=>{
    const c=await caches.open(CACHE_NAME);
    const cached=await c.match(req,{ignoreSearch:true});
    if(cached) return cached;
    try{
      const fresh=await fetch(req);
      const url=new URL(req.url);
      if(url.origin===self.location.origin){c.put(req,fresh.clone());}
      return fresh;
    }catch(e){
      const fb=await c.match('./index.html');
      return fb||new Response('Offline',{status:200,headers:{'Content-Type':'text/plain'}});
    }
  })());
});
