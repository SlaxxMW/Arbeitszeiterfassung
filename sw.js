/* Arbeitszeit-Tracker PWA Service Worker */
const CACHE_NAME = 'arbeitszeit-tracker-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k===CACHE_NAME)?null:caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, {ignoreSearch:true});
    if(cached) return cached;
    try{
      const fresh = await fetch(req);
      const url = new URL(req.url);
      if(url.origin === self.location.origin){
        cache.put(req, fresh.clone());
      }
      return fresh;
    }catch(e){
      const fallback = await cache.match('./index.html');
      return fallback || new Response('Offline', {status:200, headers:{'Content-Type':'text/plain'}});
    }
  })());
});
