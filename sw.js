/* sw.js - Service Worker for offline use + update banner support */
const APP_VERSION = '1.6.4f';
const CACHE_NAME = `az-pwa-${APP_VERSION}`;

// GitHub Pages path-scope fix:
// Android "Installieren" requires that start_url is controlled by the SW.
// We therefore precache absolute URLs inside the current registration scope.
const BASE_PATH = (()=>{
  try{ return new URL(self.registration.scope).pathname; }catch(_e){ return '/'; }
})();

// Minimal precache: must never 404, otherwise SW install fails and Android won't offer "Install".
const PRECACHE_URLS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.webmanifest',
  BASE_PATH + 'version.json',
  BASE_PATH + 'icons/icon-192.png',
  BASE_PATH + 'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith('az-pwa-') && k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if(url.origin !== self.location.origin) return;

  // version.json: always network-first so UI version updates reliably
  if(url.pathname === (BASE_PATH + 'version.json')){
    event.respondWith((async ()=>{
      const cache = await caches.open(CACHE_NAME);
      try{
        const resp = await fetch(req, {cache:'no-store'});
        if(resp && resp.ok) await cache.put(BASE_PATH + 'version.json', resp.clone());
        return resp;
      }catch(_e){
        return (await cache.match(BASE_PATH + 'version.json')) || Response.error();
      }
    })());
    return;
  }


  // Navigations: network-first with cache fallback (stable for updates)
  if(req.mode === 'navigate'){
    event.respondWith((async ()=>{
      const cache = await caches.open(CACHE_NAME);
      try{
        const resp = await fetch(req);
        if(resp && resp.ok) await cache.put(BASE_PATH + 'index.html', resp.clone());
        return resp;
      }catch(_e){
        return (await cache.match(BASE_PATH + 'index.html')) || (await cache.match(BASE_PATH)) || Response.error();
      }
    })());
    return;
  }

  // Static: cache-first, then network
  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if(cached) return cached;
    try{
      const resp = await fetch(req);
      if(resp && resp.ok && req.method === 'GET') await cache.put(req, resp.clone());
      return resp;
    }catch(_e){
      return Response.error();
    }
  })());
});
