/* sw.js - Service Worker for offline use + update banner support */
const APP_VERSION = '1.6.6';
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

  if(html.indexOf('az-range-defaults-runtime') < 0){
    const css = `
/* az-range-defaults-runtime */
.az-range-defaults-row{display:grid;grid-template-columns:90px 1fr 50px 1fr;gap:8px;align-items:center;margin-bottom:8px}
.az-range-defaults-row label{font-weight:800;color:#222}.az-range-defaults-row .mid{text-align:center;font-weight:900;color:#444}
.az-range-defaults-row input{width:100%;padding:8px 10px;border:1px solid #bbb;border-radius:10px;font-size:15px}
.az-range-defaults-note{font-size:12px;color:#666;margin-top:-4px;margin-left:100px}
@media(max-width:520px){.az-range-defaults-row{grid-template-columns:80px 1fr 40px 1fr}.az-range-defaults-note{margin-left:90px}}
`;
    const script = `
<script id="az-range-defaults-runtime">
(function(){
  'use strict';
  if(window.__AZ_RANGE_DEFAULTS_RUNTIME__) return;
  window.__AZ_RANGE_DEFAULTS_RUNTIME__ = true;

  function pad2(n){ return String(n).padStart(2,'0'); }
  function isISODate(s){ return /^\\d{4}-\\d{2}-\\d{2}$/.test(String(s||'')); }
  function dateFromKey(key){
    if(!isISODate(key)) return null;
    const y = Number(key.slice(0,4));
    const m = Number(key.slice(5,7));
    const d = Number(key.slice(8,10));
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  function keyFromDate(d){ return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()); }
  function normalizeRange(a,b){
    if(!isISODate(a) || !isISODate(b)) return null;
    return a <= b ? {from:a,to:b} : {from:b,to:a};
  }
  function toast(msg){
    const el = document.getElementById('toast');
    if(el){
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(toast._t);
      toast._t = setTimeout(function(){ el.classList.add('hidden'); }, 2200);
      return;
    }
    console.log(msg);
  }
  function ensureRangeControls(editor){
    if(!editor || editor.__azRangeReady) return;
    editor.__azRangeReady = true;
    const card = editor.closest('.day-card');
    const key = card && card.dataset ? card.dataset.date : '';
    const type = editor.querySelector('.in-type');
    const times = editor.querySelector('.inline-row.times');
    if(!card || !key || !type || !times) return;

    const row = document.createElement('div');
    row.className = 'az-range-defaults-row hidden';
    row.innerHTML = '<label>Bereich</label><input type="date" class="az-range-from" /><div class="mid">bis</div><input type="date" class="az-range-to" />';
    times.insertAdjacentElement('afterend', row);

    const note = document.createElement('div');
    note.className = 'az-range-defaults-note hidden';
    note.textContent = 'Für Urlaub/Krank werden alle Tage im Bereich markiert. Bestehende andere Tage bleiben unverändert.';
    row.insertAdjacentElement('afterend', note);

    const from = row.querySelector('.az-range-from');
    const to = row.querySelector('.az-range-to');
    from.value = key;
    to.value = key;

    function syncVisibility(){
      const active = type.value === 'vac' || type.value === 'sick';
      row.classList.toggle('hidden', !active);
      note.classList.toggle('hidden', !active);
      if(active){
        if(!from.value) from.value = key;
        if(!to.value) to.value = key;
      }
    }
    type.addEventListener('change', syncVisibility);
    syncVisibility();
  }

  function attachDefaultTimes(editor){
    if(!editor) return;
    const type = editor.querySelector('.in-type');
    const start = editor.querySelector('.in-start');
    const end = editor.querySelector('.in-end');
    if(!type || !start || !end || start.__azDefaultReady) return;
    start.__azDefaultReady = true;
    end.__azDefaultReady = true;
    function fillOnce(){
      if(type.value !== 'work') return;
      if(!start.value && !end.value){
        start.value = '07:00';
        end.value = '16:00';
      }
    }
    start.addEventListener('focus', fillOnce);
    end.addEventListener('focus', fillOnce);
    start.addEventListener('pointerdown', fillOnce);
    end.addEventListener('pointerdown', fillOnce);
  }

  async function saveRangeFromEditor(editor){
    const card = editor.closest('.day-card');
    const key = card && card.dataset ? card.dataset.date : '';
    const typeEl = editor.querySelector('.in-type');
    const fromEl = editor.querySelector('.az-range-from');
    const toEl = editor.querySelector('.az-range-to');
    if(!key || !typeEl || !fromEl || !toEl || !window.AZDB) return false;
    const type = typeEl.value;
    if(type !== 'vac' && type !== 'sick') return false;
    const range = normalizeRange(fromEl.value || key, toEl.value || key);
    if(!range) return false;
    if(range.from === key && range.to === key) return false;

    const place = ((editor.querySelector('.in-place') || {}).value || '').trim();
    const note = ((editor.querySelector('.in-note') || {}).value || '').trim();
    let d = dateFromKey(range.from);
    const endDate = dateFromKey(range.to);
    if(!d || !endDate) return false;

    let count = 0;
    while(d <= endDate){
      const dk = keyFromDate(d);
      const old = await AZDB.getDay(dk);
      const rec = Object.assign({}, old || {}, {
        date: dk,
        type: type,
        start: '',
        end: '',
        breakH: 0,
        place: place || (old && old.place) || '',
        note: note || (old && old.note) || '',
        updatedAt: Date.now()
      });
      await AZDB.setDay(rec);
      count++;
      d.setDate(d.getDate() + 1);
    }
    toast((type === 'vac' ? 'Urlaub' : 'Krank') + ' gespeichert: ' + count + ' Tage');
    setTimeout(function(){ location.reload(); }, 650);
    return true;
  }

  document.addEventListener('click', function(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest('.in-save') : null;
    if(!btn) return;
    const editor = btn.closest('.day-editor-inline');
    if(!editor) return;
    const fromEl = editor.querySelector('.az-range-from');
    const toEl = editor.querySelector('.az-range-to');
    const card = editor.closest('.day-card');
    const key = card && card.dataset ? card.dataset.date : '';
    const typeEl = editor.querySelector('.in-type');
    if(!fromEl || !toEl || !typeEl || (typeEl.value !== 'vac' && typeEl.value !== 'sick')) return;
    const range = normalizeRange(fromEl.value || key, toEl.value || key);
    if(!range || (range.from === key && range.to === key)) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    saveRangeFromEditor(editor).catch(function(err){ console.error(err); toast('Bereich konnte nicht gespeichert werden'); });
  }, true);

  function scan(){
    document.querySelectorAll('.day-editor-inline').forEach(function(editor){
      ensureRangeControls(editor);
      attachDefaultTimes(editor);
    });
  }
  const mo = new MutationObserver(scan);
  mo.observe(document.documentElement, {childList:true, subtree:true});
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
</script>
`;
    html = html.replace('</style>', css + '</style>');
    html = html.replace('</body>', script + '</body>');
  }

  html = html.replace("const swUrl = baseScope + 'sw.js?ver=1.6.4g';", "const swUrl = baseScope + 'sw.js?ver=1.6.6';");
  html = html.replace("const swUrl = baseScope + 'sw.js?ver=1.6.5';", "const swUrl = baseScope + 'sw.js?ver=1.6.6';");
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