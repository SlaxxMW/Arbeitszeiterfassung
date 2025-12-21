
/* sw.js - offline cache for Arbeitszeiterfassung PWA */
const CACHE_NAME = 'arbeitszeit-cache-v1';
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
    caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE_NAME?null:caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  const url = new URL(req.url);

  // Navigation: offline fallback to cached index.html
  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put('./index.html', copy)).catch(()=>{});
        return res;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // Same-origin static assets: cache-first
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
