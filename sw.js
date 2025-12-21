/* sw.js - offline cache for Arbeitszeiterfassung PWA */
const CACHE_NAME = 'arbeitszeit-cache-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './export.js',
  './holidays.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))
  );
  // NOTE: no skipWaiting here; we show "Update verfügbar" and activate on user click.
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.map(k=>k===CACHE_NAME?null:caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message', (event)=>{
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if(req.method !== 'GET') return;

  // Same-origin static assets: cache-first with network fallback + runtime cache
  if(url.origin === location.origin){
    event.respondWith(
      caches.match(req).then(cached=>{
        if(cached) return cached;
        return fetch(req).then(res=>{
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(req, copy)).catch(()=>{});
          return res;
        }).catch(()=>cached);
      })
    );
  }
});
