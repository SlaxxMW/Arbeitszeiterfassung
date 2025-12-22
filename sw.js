/* sw.js - Service Worker for offline use + update banner support */
const APP_VERSION = "1.5.1";
const CACHE_NAME = `az-pwa-${APP_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './holidays.js',
  './export.js',
  './manifest.webmanifest',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
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

  // Only handle same-origin
  if(url.origin !== self.location.origin) return;

  // Navigations -> stale-while-revalidate for index
  if(req.mode === 'navigate'){
    event.respondWith((async ()=>{
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('./index.html', {ignoreSearch:true});
      const fetchPromise = fetch(req).then(async (resp)=>{
        // update cache with fresh index
        if(resp && resp.ok) await cache.put('./index.html', resp.clone());
        return resp;
      }).catch(()=>null);

      return cached || (await fetchPromise) || Response.error();
    })());
    return;
  }

  // Static assets -> cache-first, then network, then cache fallback
  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, {ignoreSearch:true});
    if(cached) return cached;
    try{
      const resp = await fetch(req);
      if(resp && resp.ok){
        // cache only GET
        if(req.method === 'GET') await cache.put(req, resp.clone());
      }
      return resp;
    }catch(e){
      // last resort: try matching by pathname
      const fallback = await cache.match(url.pathname, {ignoreSearch:true});
      return fallback || Response.error();
    }
  })());
});
