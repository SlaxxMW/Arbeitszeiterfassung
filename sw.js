/* sw.js - Service Worker for offline use + update banner support */
const APP_VERSION = '1.6.5';
const CACHE_NAME = `az-pwa-${APP_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

function applyAppPatch(html){
  if(!html || html.indexOf('Arbeitszeiterfassung') < 0) return html;
  if(html.indexOf('setWeeklySollHours') < 0){
    html = html.replace('        <div class="form-row">\n          <label>Startsaldo Jahr (Stunden)</label>', '        <div class="form-row">\n          <label>Wöchentliche Sollzeit</label>\n          <input type="number" id="setWeeklySollHours" min="0" max="80" step="0.25" />\n          <div class="small">Standard: 40 h/Woche. Die App verteilt den Wert auf Montag–Freitag. Beispiel: 30 h/Woche = 6 h Soll pro Werktag. Bereits eingetragene Zeiten werden automatisch neu berechnet, ohne Tagesdaten zu verändern.</div>\n        </div>\n\n        <div class="form-row">\n          <label>Startsaldo Jahr (Stunden)</label>');
    html = html.replace("    const $setVacationPerYear = els('setVacationPerYear');", "    const $setVacationPerYear = els('setVacationPerYear');\n    const $setWeeklySollHours = els('setWeeklySollHours');");
    html = html.replace('    function getYearStartSaldoKey(year){ return `yearStartSaldo_${year}`; }', '    function getYearStartSaldoKey(year){ return `yearStartSaldo_${year}`; }\n\n    function normalizeWeeklySollHours(value){\n      const n = Number(value);\n      if(!Number.isFinite(n) || n < 0) return 40;\n      return Math.round(n * 4) / 4;\n    }\n\n    function dailySollFromWeekly(){\n      const weekly = settings ? normalizeWeeklySollHours(settings.weeklySollHours) : 40;\n      return Math.round((weekly / 5) * 100) / 100;\n    }');
    html = html.replace("      const vacationPerYear = await AZDB.getSetting('vacationPerYear', 30);\n      const useYearSummaryMonthly = await AZDB.getSetting('useYearSummaryMonthly', true);", "      const vacationPerYear = await AZDB.getSetting('vacationPerYear', 30);\n      const weeklySollHours = await AZDB.getSetting('weeklySollHours', 40);\n      const useYearSummaryMonthly = await AZDB.getSetting('useYearSummaryMonthly', true);");
    html = html.replace('      settings = { company, person, state, assumption: !!assumption, augsburg: !!augsburg, vacationPerYear: parseInt(vacationPerYear,10) || 30, useYearSummaryMonthly: !!useYearSummaryMonthly };', '      settings = { company, person, state, assumption: !!assumption, augsburg: !!augsburg, vacationPerYear: parseInt(vacationPerYear,10) || 30, weeklySollHours: normalizeWeeklySollHours(weeklySollHours), useYearSummaryMonthly: !!useYearSummaryMonthly };');
    html = html.replace("      settings.vacationPerYear = parseInt($setVacationPerYear.value,10) || 30;\n      settings.useYearSummaryMonthly = $setUseYearSummaryMonthly ? !!$setUseYearSummaryMonthly.checked : true;", "      settings.vacationPerYear = parseInt($setVacationPerYear.value,10) || 30;\n      settings.weeklySollHours = normalizeWeeklySollHours($setWeeklySollHours ? $setWeeklySollHours.value : 40);\n      settings.useYearSummaryMonthly = $setUseYearSummaryMonthly ? !!$setUseYearSummaryMonthly.checked : true;");
    html = html.replace("      await AZDB.setSetting('vacationPerYear', settings.vacationPerYear);\n      await AZDB.setSetting('useYearSummaryMonthly', settings.useYearSummaryMonthly);", "      await AZDB.setSetting('vacationPerYear', settings.vacationPerYear);\n      await AZDB.setSetting('weeklySollHours', settings.weeklySollHours);\n      await AZDB.setSetting('useYearSummaryMonthly', settings.useYearSummaryMonthly);");
    html = html.replace("      $setVacationPerYear.value = settings.vacationPerYear;\n      if($setUseYearSummaryMonthly) $setUseYearSummaryMonthly.checked = !!settings.useYearSummaryMonthly;", "      $setVacationPerYear.value = settings.vacationPerYear;\n      if($setWeeklySollHours) $setWeeklySollHours.value = normalizeWeeklySollHours(settings.weeklySollHours);\n      if($setUseYearSummaryMonthly) $setUseYearSummaryMonthly.checked = !!settings.useYearSummaryMonthly;");
    html = html.replace('    function baseSollHours(key){\n      return isWeekend(key) ? 0 : 8;\n    }', '    function baseSollHours(key){\n      return isWeekend(key) ? 0 : dailySollFromWeekly();\n    }');
    html = html.replace('          vacationPerYear: settings.vacationPerYear\n        },', '          vacationPerYear: settings.vacationPerYear,\n          weeklySollHours: normalizeWeeklySollHours(settings.weeklySollHours)\n        },');
    html = html.replace("        await AZDB.setSetting('vacationPerYear', data.settings.vacationPerYear ?? 30);", "        await AZDB.setSetting('vacationPerYear', data.settings.vacationPerYear ?? 30);\n        await AZDB.setSetting('weeklySollHours', normalizeWeeklySollHours(data.settings.weeklySollHours ?? 40));");
  }
  if(html.indexOf('az-update-strong-css') < 0){
    html = html.replace('</style>', '\n/* az-update-strong-css */\n.update-banner{position:fixed!important;left:10px!important;right:10px!important;top:10px!important;z-index:20000!important;background:#fff3cd!important;color:#111!important;border:4px solid #C4111F!important;border-radius:16px!important;box-shadow:0 14px 40px rgba(0,0,0,.28)!important;padding:14px!important;font-size:16px!important}.update-text{font-weight:900!important}.update-banner .btn{font-size:16px!important;padding:12px 14px!important}\n</style>');
    html = html.replace('          $updateText.textContent = `Update verfügbar: ${v.version}`;', '          $updateText.textContent = `⚠️ Update verfügbar: ${v.version} – bitte Backup prüfen und dann aktualisieren`;');
    html = html.replace('      setTimeout(()=>{ maybeBackupReminder(); }, 600);', '      setTimeout(()=>{ maybeBackupReminder(); }, 600);\n      setTimeout(()=>{ try{ checkUpdate(); }catch(_e){} }, 1500);');
  }
  html = html.replace("const swUrl = baseScope + 'sw.js?ver=1.6.4g';", "const swUrl = baseScope + 'sw.js?ver=1.6.5';");
  return html;
}

async function patchedHtmlResponse(resp){
  const headers = new Headers(resp.headers);
  headers.set('content-type', 'text/html;charset=utf-8');
  headers.set('x-az-version', APP_VERSION);
  const text = await resp.text();
  return new Response(applyAppPatch(text), {status: resp.status, statusText: resp.statusText, headers});
}

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
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  if(url.pathname.endsWith('/version.json')){
    event.respondWith((async ()=>{
      const cache = await caches.open(CACHE_NAME);
      try{
        const resp = await fetch(req, {cache:'no-store'});
        if(resp && resp.ok) await cache.put('./version.json', resp.clone());
        return resp;
      }catch(_e){ return (await cache.match('./version.json')) || Response.error(); }
    })());
    return;
  }

  if(req.mode === 'navigate'){
    event.respondWith((async ()=>{
      const cache = await caches.open(CACHE_NAME);
      try{
        const resp = await fetch(req);
        if(resp && resp.ok){
          const patched = await patchedHtmlResponse(resp.clone());
          await cache.put('./index.html', patched.clone());
          return patched;
        }
        return resp;
      }catch(_e){
        const cached = await cache.match('./index.html') || await cache.match('./');
        return cached ? patchedHtmlResponse(cached.clone()) : Response.error();
      }
    })());
    return;
  }

  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if(cached) return cached;
    try{
      const resp = await fetch(req);
      if(resp && resp.ok && req.method === 'GET') await cache.put(req, resp.clone());
      return resp;
    }catch(_e){ return Response.error(); }
  })());
});