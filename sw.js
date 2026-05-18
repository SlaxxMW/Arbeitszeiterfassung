/* sw.js - Service Worker for offline use + weekly target-hours + robust default time runtime patches */
const APP_VERSION = '1.6.5-weekly-soll-default-time2';
const CACHE_NAME = `az-pwa-${APP_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

function replaceOnce(html, search, replacement){
  if(!html || html.includes(replacement)) return html;
  return html.includes(search) ? html.replace(search, replacement) : html;
}

function patchWeeklySoll(html){
  if(!html || !html.includes('Arbeitszeiterfassung')) return html;

  if(!html.includes('setWeeklySollHours')){
    html = replaceOnce(html,
`        <div class="form-row">
          <label>Startsaldo Jahr (Stunden)</label>`,
`        <div class="form-row">
          <label>Wöchentliche Sollzeit</label>
          <input type="number" id="setWeeklySollHours" min="0" max="80" step="0.25" />
          <div class="small">Standard: 40 h/Woche. Die App verteilt den Wert auf Montag–Freitag. Beispiel: 30 h/Woche = 6 h Soll pro Werktag. Bereits eingetragene Zeiten werden beim Speichern automatisch neu berechnet, ohne Tagesdaten zu verändern.</div>
        </div>

        <div class="form-row">
          <label>Startsaldo Jahr (Stunden)</label>`);

    html = replaceOnce(html,
"    const $setVacationPerYear = els('setVacationPerYear');",
"    const $setVacationPerYear = els('setVacationPerYear');\n    const $setWeeklySollHours = els('setWeeklySollHours');");

    html = replaceOnce(html,
"    function getYearStartSaldoKey(year){ return `yearStartSaldo_${year}`; }",
"    function getYearStartSaldoKey(year){ return `yearStartSaldo_${year}`; }\n\n    function normalizeWeeklySollHours(value){\n      const n = Number(value);\n      if(!Number.isFinite(n) || n < 0) return 40;\n      return Math.round(n * 4) / 4;\n    }\n\n    function dailySollFromWeekly(){\n      const weekly = settings ? normalizeWeeklySollHours(settings.weeklySollHours) : 40;\n      return Math.round((weekly / 5) * 100) / 100;\n    }");

    html = replaceOnce(html,
"      const vacationPerYear = await AZDB.getSetting('vacationPerYear', 30);\n      const useYearSummaryMonthly = await AZDB.getSetting('useYearSummaryMonthly', true);",
"      const vacationPerYear = await AZDB.getSetting('vacationPerYear', 30);\n      const weeklySollHours = await AZDB.getSetting('weeklySollHours', 40);\n      const useYearSummaryMonthly = await AZDB.getSetting('useYearSummaryMonthly', true);");

    html = replaceOnce(html,
"      settings = { company, person, state, assumption: !!assumption, augsburg: !!augsburg, vacationPerYear: parseInt(vacationPerYear,10) || 30, useYearSummaryMonthly: !!useYearSummaryMonthly };",
"      settings = { company, person, state, assumption: !!assumption, augsburg: !!augsburg, vacationPerYear: parseInt(vacationPerYear,10) || 30, weeklySollHours: normalizeWeeklySollHours(weeklySollHours), useYearSummaryMonthly: !!useYearSummaryMonthly };");

    html = replaceOnce(html,
"      settings.vacationPerYear = parseInt($setVacationPerYear.value,10) || 30;\n      settings.useYearSummaryMonthly = $setUseYearSummaryMonthly ? !!$setUseYearSummaryMonthly.checked : true;",
"      settings.vacationPerYear = parseInt($setVacationPerYear.value,10) || 30;\n      settings.weeklySollHours = normalizeWeeklySollHours($setWeeklySollHours ? $setWeeklySollHours.value : 40);\n      settings.useYearSummaryMonthly = $setUseYearSummaryMonthly ? !!$setUseYearSummaryMonthly.checked : true;");

    html = replaceOnce(html,
"      await AZDB.setSetting('vacationPerYear', settings.vacationPerYear);\n      await AZDB.setSetting('useYearSummaryMonthly', settings.useYearSummaryMonthly);",
"      await AZDB.setSetting('vacationPerYear', settings.vacationPerYear);\n      await AZDB.setSetting('weeklySollHours', settings.weeklySollHours);\n      await AZDB.setSetting('useYearSummaryMonthly', settings.useYearSummaryMonthly);");

    html = replaceOnce(html,
"      $setVacationPerYear.value = settings.vacationPerYear;\n      if($setUseYearSummaryMonthly) $setUseYearSummaryMonthly.checked = !!settings.useYearSummaryMonthly;",
"      $setVacationPerYear.value = settings.vacationPerYear;\n      if($setWeeklySollHours) $setWeeklySollHours.value = normalizeWeeklySollHours(settings.weeklySollHours);\n      if($setUseYearSummaryMonthly) $setUseYearSummaryMonthly.checked = !!settings.useYearSummaryMonthly;");

    html = replaceOnce(html,
"    function baseSollHours(key){\n      return isWeekend(key) ? 0 : 8;\n    }",
"    function baseSollHours(key){\n      return isWeekend(key) ? 0 : dailySollFromWeekly();\n    }");

    html = replaceOnce(html,
"          vacationPerYear: settings.vacationPerYear\n        },",
"          vacationPerYear: settings.vacationPerYear,\n          weeklySollHours: normalizeWeeklySollHours(settings.weeklySollHours)\n        },");

    html = replaceOnce(html,
"        await AZDB.setSetting('vacationPerYear', data.settings.vacationPerYear ?? 30);",
"        await AZDB.setSetting('vacationPerYear', data.settings.vacationPerYear ?? 30);\n        await AZDB.setSetting('weeklySollHours', normalizeWeeklySollHours(data.settings.weeklySollHours ?? 40));");
  }

  if(!html.includes('AZ_DEFAULT_TIME_PATCH_V2')){
    html = replaceOnce(html,
"    function bind(){",
"    function installDefaultTimePatch(){\n      if(window.AZ_DEFAULT_TIME_PATCH_V2) return;\n      window.AZ_DEFAULT_TIME_PATCH_V2 = true;\n      function fillDefaultTimes(el){\n        if(!el || el.tagName !== 'INPUT' || el.type !== 'time') return;\n        const box = el.closest('.day-editor-inline') || el.closest('.day-editor') || document;\n        const start = box.querySelector ? box.querySelector('input.in-start, input[class*=\\\"start\\\"][type=\\\"time\\\"]') : null;\n        const end = box.querySelector ? box.querySelector('input.in-end, input[class*=\\\"end\\\"][type=\\\"time\\\"]') : null;\n        if(start && !start.value && !start.disabled) start.value = '07:00';\n        if(end && !end.value && !end.disabled) end.value = '16:00';\n        if(!start && el.classList.contains('in-start') && !el.value && !el.disabled) el.value = '07:00';\n        if(!end && el.classList.contains('in-end') && !el.value && !el.disabled) el.value = '16:00';\n      }\n      ['pointerdown','touchstart','mousedown','focusin','click'].forEach((name)=>{\n        document.addEventListener(name, (ev)=>fillDefaultTimes(ev.target), true);\n      });\n    }\n\n    function bind(){");

    html = replaceOnce(html,
"      // update banner\n      els('btnUpdateNow').addEventListener('click', updateNow);",
"      installDefaultTimePatch();\n\n      // update banner\n      els('btnUpdateNow').addEventListener('click', updateNow);");
  }

  html = html.replace("const swUrl = baseScope + 'sw.js?ver=1.6.4g';", "const swUrl = baseScope + 'sw.js?ver=1.6.5-weekly-soll-default-time2';");
  html = html.replace("const swUrl = baseScope + 'sw.js?ver=1.6.5-weekly-soll';", "const swUrl = baseScope + 'sw.js?ver=1.6.5-weekly-soll-default-time2';");
  html = html.replace("const swUrl = baseScope + 'sw.js?ver=1.6.5-weekly-soll-default-time';", "const swUrl = baseScope + 'sw.js?ver=1.6.5-weekly-soll-default-time2';");
  return html;
}

async function patchedHtmlResponse(resp){
  const headers = new Headers(resp.headers);
  headers.set('content-type', 'text/html;charset=utf-8');
  headers.set('x-az-version', APP_VERSION);
  const text = await resp.text();
  return new Response(patchWeeklySoll(text), {status: resp.status, statusText: resp.statusText, headers});
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
        const resp = await fetch(req, {cache:'no-store'});
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
