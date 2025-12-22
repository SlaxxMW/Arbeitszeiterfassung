/* app.js - main UI/logic */
(function(){
  'use strict';

  const APP_MIN_YEAR = 2025;

  const BACKUP_REMINDER_DAYS = 7;
  const KEY_FIRST_RUN_AT = 'firstRunAt';
  const KEY_LAST_BACKUP_AT = 'lastBackupAt';
  const KEY_LAST_BACKUP_PROMPT_AT = 'lastBackupPromptAt';

  const els = (id) => document.getElementById(id);

  const $dayList = els('dayList');
  const $monthLabel = els('monthLabel');
  const $companyName = els('companyName');
  const $personNameHeader = els('personNameHeader');

  const $statSoll = els('statSoll');
  const $statIst = els('statIst');
  const $statCarry = els('statCarry');
  const $statSaldo = els('statSaldo');
  const $statVac = els('statVac');
  const $statSick = els('statSick');

  const $settingsModal = els('settingsModal');
  const $importModal = els('importModal');
  const $backupModal = els('backupModal');
  const $backupHint = els('backupHint');
  const $toast = els('toast');
  const $updateBanner = els('updateBanner');
  const $updateText = els('updateText');
  const $appVersion = els('appVersion');

  const $yearView = els('yearView');
  const $yearCards = els('yearCards');
  const $yearTitle = els('yearTitle');
  const $yearSummary = els('yearSummary');

  // Settings fields
  const $setCompany = els('setCompany');
  const $setPerson = els('setPerson');
  const $setState = els('setState');
  const $setAssumption = els('setAssumption'); // Mariä Himmelfahrt
  const $setAugsburg = els('setAugsburg');
  const $setVacationPerYear = els('setVacationPerYear');
  const $setUseYearSummaryMonthly = els('setUseYearSummaryMonthly');
  const $setYearStartSaldo = els('setYearStartSaldo');
  const $holidayPreview = els('holidayPreview');
  const $updateInfo = els('updateInfo');
  const $lastBackupInfo = els('lastBackupInfo');

  // Import fields
  const $fileImportCsv = els('fileImportCsv');
  const $importMeta = els('importMeta');
  const $importPreview = els('importPreview');
  const $importMode = els('importMode');

  // state
  let settings = null;
  let current = { year: null, month: null }; // month 1..12
  let openDateKey = null;
  let pendingImport = null; // {rows, errors, meta}

  // ---- Utils ----
  function toast(msg){
    $toast.textContent = msg;
    $toast.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> $toast.classList.add('hidden'), 2300);
  }

  function pad2(n){ return String(n).padStart(2,'0'); }
  function parseKey(key){
    const y = parseInt(key.slice(0,4),10);
    const m = parseInt(key.slice(5,7),10);
    const d = parseInt(key.slice(8,10),10);
    return {y,m,d};
  }
  function toDateObj(key){
    const {y,m,d} = parseKey(key);
    return new Date(y, m-1, d, 12,0,0);
  }
  function toKey(y,m,d){
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  function daysInMonth(y,m){
    return new Date(y, m, 0).getDate();
  }
  const WEEKDAYS = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

  function weekdayName(key){
    return WEEKDAYS[toDateObj(key).getDay()];
  }
  function isWeekend(key){
    const wd = toDateObj(key).getDay();
    return wd===0 || wd===6;
  }
  function baseSollHours(key){
    return isWeekend(key) ? 0 : 8;
  }

  function isoWeekNumber(date){
    // ISO week date algorithm
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function formatHours(h){ return AZExport.formatHours(h); }

  function clampYear(y){
    if(y < APP_MIN_YEAR) return APP_MIN_YEAR;
    return y;
  }

  function getYearStartSaldoKey(year){ return `yearStartSaldo_${year}`; }

  // ---- Settings ----
  async function loadSettings(){
    const company = await AZDB.getSetting('company', 'Zaunteam');
    const person = await AZDB.getSetting('person', '');
    const state = await AZDB.getSetting('state', 'BY');
    const assumption = await AZDB.getSetting('assumption', true); // Mariä Himmelfahrt
    const augsburg = await AZDB.getSetting('augsburg', false);
    const vacationPerYear = await AZDB.getSetting('vacationPerYear', 30);
    const useYearSummaryMonthly = await AZDB.getSetting('useYearSummaryMonthly', true);

    settings = { company, person, state, assumption: !!assumption, augsburg: !!augsburg, vacationPerYear: parseInt(vacationPerYear,10) || 30, useYearSummaryMonthly: !!useYearSummaryMonthly };
  }

  async function saveSettings(){
    settings.company = ($setCompany.value || 'Zaunteam').trim();
    settings.person = ($setPerson.value || '').trim();
    settings.state = $setState.value || 'BY';
    settings.assumption = !!$setAssumption.checked;
    settings.augsburg = !!$setAugsburg.checked;
    settings.vacationPerYear = parseInt($setVacationPerYear.value,10) || 30;
    settings.useYearSummaryMonthly = $setUseYearSummaryMonthly ? !!$setUseYearSummaryMonthly.checked : true;

    await AZDB.setSetting('company', settings.company);
    await AZDB.setSetting('person', settings.person);
    await AZDB.setSetting('state', settings.state);
    await AZDB.setSetting('assumption', settings.assumption);
    await AZDB.setSetting('augsburg', settings.augsburg);
    await AZDB.setSetting('vacationPerYear', settings.vacationPerYear);
    await AZDB.setSetting('useYearSummaryMonthly', settings.useYearSummaryMonthly);

    // year start saldo (current year)
    const year = current.year;
    const val = Number($setYearStartSaldo.value || 0);
    await AZDB.setSetting(getYearStartSaldoKey(year), Number.isFinite(val) ? val : 0);

    $companyName.textContent = settings.company;
    toast("Einstellungen gespeichert");
    closeSettings();
    await renderMonth();
  }

  async function getYearStartSaldo(year){
    const v = await AZDB.getSetting(getYearStartSaldoKey(year), 0);
    const num = Number(v);
    return Number.isFinite(num) ? num : 0;
  }

  function fillStateSelect(){
    $setState.innerHTML = "";
    for(const [code, name] of AZHolidays.STATES){
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${name} (${code})`;
      $setState.appendChild(opt);
    }
  }

  async function openSettings(){
    // fill fields
    $setCompany.value = settings.company;
    $setPerson.value = settings.person;
    $setState.value = settings.state;
    $setAssumption.checked = settings.assumption;
    $setAugsburg.checked = settings.augsburg;
    $setVacationPerYear.value = settings.vacationPerYear;
    if($setUseYearSummaryMonthly) $setUseYearSummaryMonthly.checked = !!settings.useYearSummaryMonthly;

    const ys = await getYearStartSaldo(current.year);
    $setYearStartSaldo.value = ys;

    await refreshHolidayPreview();

    // last backup info
    try{
      const ts = await AZDB.getSetting(KEY_LAST_BACKUP_AT, 0) || 0;
      if($lastBackupInfo){
        if(!ts){
          $lastBackupInfo.textContent = "— (noch kein Backup)";
        }else{
          const d = new Date(ts);
          $lastBackupInfo.textContent = d.toLocaleString('de-DE', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
        }
      }
    }catch(_e){ if($lastBackupInfo) $lastBackupInfo.textContent = "—"; }

    $settingsModal.classList.remove('hidden');
  }
  function closeSettings(){ $settingsModal.classList.add('hidden'); }

  async function refreshHolidayPreview(){
    const year = current.year;
    const state = $setState.value || settings.state;
    const opts = { assumption: $setAssumption.checked, augsburg: $setAugsburg.checked };
    const map = AZHolidays.holidaysForYear(year, state, opts);
    const items = Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
    const lines = items.map(([k,v])=>{
      const d = toDateObj(k);
      const dd = pad2(d.getDate());
      const mm = pad2(d.getMonth()+1);
      return `${dd}.${mm}.${d.getFullYear()}  –  ${v}`;
    });
    $holidayPreview.textContent = lines.join("\n") || "—";
  }

  // ---- Day model helpers ----
  function getDefaultType(key){
    // weekend rest, otherwise holiday if in holiday map, else work
    if(isWeekend(key)) return 'rest';
    const name = AZHolidays.getHolidayName(key, settings.state, {assumption: settings.assumption, augsburg: settings.augsburg});
    if(name) return 'holiday';
    return 'work';
  }

  function getHolidayNameIfAny(key){
    return AZHolidays.getHolidayName(key, settings.state, {assumption: settings.assumption, augsburg: settings.augsburg});
  }

  function normalizeRecord(key, rec){
    const defType = getDefaultType(key);
    const out = {
      date: key,
      type: defType,
      start: "",
      end: "",
      breakH: 0.5,
      place: "",
      note: ""
    };
    if(rec){
      out.type = rec.type || defType;
      out.start = rec.start || "";
      out.end = rec.end || "";
      out.breakH = (rec.breakH != null ? Number(rec.breakH) : 0.5);
      if(!Number.isFinite(out.breakH)) out.breakH = 0.5;
      out.place = rec.place || "";
      out.note = rec.note || "";
    }
    // if non-work types, pause should be 0
    if(out.type !== 'work') out.breakH = 0;
    return out;
  }

  function calcNetHours(start, end, breakH){
    if(!start || !end) return 0;
    const m1 = start.split(':'); const m2 = end.split(':');
    if(m1.length<2 || m2.length<2) return 0;
    let s = parseInt(m1[0],10)*60 + parseInt(m1[1],10);
    let e = parseInt(m2[0],10)*60 + parseInt(m2[1],10);
    if(!Number.isFinite(s) || !Number.isFinite(e)) return 0;
    if(e < s) e += 24*60; // over midnight
    let netMin = e - s - Math.round((breakH||0)*60);
    if(netMin < 0) netMin = 0;
    return netMin/60;
  }

  function calcDayHours(key, recNorm){
    const soll = baseSollHours(key);
    let ist = 0;
    if(recNorm.type === 'work'){
      ist = calcNetHours(recNorm.start, recNorm.end, recNorm.breakH);
      return {soll, ist, diff: ist - soll};
    }
    if(recNorm.type === 'rest'){
      return {soll:0, ist:0, diff:0};
    }
    // vacation/sick/holiday/comp -> counts as soll on weekdays, else 0
    return {soll, ist: soll, diff: 0};
  }

  // ---- Month render ----
  async function renderMonth(){
    $yearView.classList.add('hidden');
    $dayList.classList.remove('hidden');
    // clamp year
    current.year = clampYear(current.year);
    if(current.year === APP_MIN_YEAR && current.month === 0) current.month = 1;

    $monthLabel.textContent = `${MONTHS[current.month-1]} ${current.year}`;

    const dayKeys = [];
    const dim = daysInMonth(current.year, current.month);
    for(let d=1; d<=dim; d++){
      dayKeys.push(toKey(current.year, current.month, d));
    }

    // load stored records for this month
    const startKey = dayKeys[0];
    const endKey = dayKeys[dayKeys.length-1];
    const stored = await AZDB.getRange(startKey, endKey);
    const map = new Map(stored.map(r=>[r.date, r]));

    // compute carry within year
    let startSaldo = await calcCarryToMonth(current.year, current.month);

    // Wenn Monats-/Jahres-CSV Werte vorhanden sind (Okt/Nov), soll der "S. Vormonat"
    // auch im Dezember (mit Tagesdaten) auf dieser Basis weiterlaufen – sonst entstehen
    // riesige Negativsalden durch angenommene leere Monate.
    if(settings.useYearSummaryMonthly){
      const ysCarry = await getYearSummary(current.year);
      if(hasImportedCarryBaseline(ysCarry, current.month)){
        startSaldo = deriveImportedCarry(ysCarry, current.month);
      }
    }
    let sumSoll=0, sumIst=0, sumDiff=0;

    // build list (alle Tage + Inline-Editor im Listeneintrag)
    $dayList.innerHTML = "";

    // openDateKey nur behalten, wenn er im aktuellen Monat liegt
    if(openDateKey && !openDateKey.startsWith(`${current.year}-${pad2(current.month)}-`)) openDateKey = null;

    for(const key of dayKeys){
      const recNorm = normalizeRecord(key, map.get(key));
      const hours = calcDayHours(key, recNorm);
      sumSoll += hours.soll;
      sumIst += hours.ist;
      sumDiff += hours.diff;

      const d = toDateObj(key);
      const wname = WEEKDAYS[d.getDay()];
      const dd = pad2(d.getDate());
      const dateLabel = `${wname}, ${dd}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

      const card = document.createElement('div');
      card.className = 'day-card';
      card.dataset.date = key;

      const summary = document.createElement('div');
      summary.className = 'day-item';
      summary.dataset.date = key;

      const left = document.createElement('div');
      left.className = 'day-left';

      const line1 = document.createElement('div');
      line1.className = 'd1';
      line1.textContent = dateLabel;
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = typeLabel(recNorm.type, key);
      line1.appendChild(badge);

      const line2 = document.createElement('div');
      line2.className = 'd2';
      if(recNorm.type === 'work'){
        if(recNorm.start && recNorm.end) line2.textContent = `${recNorm.start} - ${recNorm.end}`;
        else line2.textContent = '—';
      }else if(recNorm.type === 'rest'){
        line2.textContent = 'Ruhetag';
      }else{
        const hn = recNorm.type === 'holiday' ? getHolidayNameIfAny(key) : null;
        line2.textContent = hn ? hn : typeLabel(recNorm.type, key);
      }

      const line3 = document.createElement('div');
      line3.className = 'd3';
      if(recNorm.type === 'work'){
        const p = (recNorm.breakH ?? 0.5);
        line3.textContent = `${p.toFixed(2).replace('.',',')} h Essens-/Pausenzeiten`;
      }

      left.appendChild(line1);
      left.appendChild(line2);
      if(line3.textContent) left.appendChild(line3);

      const right = document.createElement('div');
      right.className = 'day-right';
      const big = document.createElement('div');
      big.className = 'hbig';
      big.textContent = `${hours.ist.toFixed(2).replace('.',',')} h`;
      const diff = document.createElement('div');
      diff.className = 'hdiff';
      diff.textContent = `(${hours.diff.toFixed(2).replace('.',',')})`;
      if(hours.diff > 0.005) diff.classList.add('good');
      else if(hours.diff < -0.005) diff.classList.add('bad');
      right.appendChild(big);
      right.appendChild(diff);

      summary.appendChild(left);
      summary.appendChild(right);

      const editor = document.createElement('div');
      editor.className = 'day-editor-inline';
      if(openDateKey !== key) editor.classList.add('hidden');
      editor.innerHTML = `
        <div class="inline-head">
          <div class="inline-meta">${wname} ${dd}.${pad2(d.getMonth()+1)}.${d.getFullYear()} • Woche ${isoWeekNumber(d)}<\/div>
        <\/div>
        <div class="inline-grid">
          <div class="inline-row">
            <label>Typ<\/label>
            <select class="in-type">
              <option value="work">Arbeitszeit<\/option>
              <option value="vac">Urlaub<\/option>
              <option value="sick">Krank<\/option>
              <option value="holiday">Feiertag<\/option>
              <option value="comp">Zeitausgleich<\/option>
              <option value="rest">Ruhetag<\/option>
            <\/select>
          <\/div>
          <div class="inline-row times">
            <label>Start<\/label>
            <input type="time" class="in-start" />
            <div class="mid">bis<\/div>
            <input type="time" class="in-end" />
          <\/div>
          <div class="inline-row">
            <label>Pause (h)<\/label>
            <input type="number" step="0.25" min="0" class="in-break" />
          <\/div>
          <div class="inline-row">
            <label>Ort<\/label>
            <input type="text" class="in-place" placeholder="Baustelle / Ort" />
          <\/div>
          <div class="inline-row">
            <label>Notiz<\/label>
            <textarea rows="2" class="in-note" placeholder="Bemerkung zum Tag…"><\/textarea>
          <\/div>
          <div class="inline-hint">Tipp: Nicht-Arbeitszeit zählt automatisch als 8,00 h (Mo–Fr).<\/div>
        <\/div>
        <div class="inline-actions">
          <button class="btn btn-light in-copy" type="button">Wie gestern<\/button>
          <div class="spacer"><\/div>
          <button class="btn btn-light in-close" type="button">Schließen<\/button>
          <button class="btn btn-primary in-save" type="button">Speichern<\/button>
        <\/div>
      `;

      const refs = {
        type: editor.querySelector('.in-type'),
        start: editor.querySelector('.in-start'),
        end: editor.querySelector('.in-end'),
        breakH: editor.querySelector('.in-break'),
        place: editor.querySelector('.in-place'),
        note: editor.querySelector('.in-note')
      };

      // init input values
      refs.type.value = recNorm.type;
      refs.start.value = recNorm.start || '';
      refs.end.value = recNorm.end || '';
      refs.breakH.value = String(recNorm.type === 'work' ? (recNorm.breakH ?? 0.5) : 0);
      refs.place.value = recNorm.place || '';
      refs.note.value = recNorm.note || '';
      applyTypeRulesToInputs(refs.type.value, refs.start, refs.end, refs.breakH);

      refs.type.addEventListener('change', ()=>{
        applyTypeRulesToInputs(refs.type.value, refs.start, refs.end, refs.breakH);
      });

      editor.querySelector('.in-copy').addEventListener('click', async (ev)=>{
        ev.stopPropagation();
        await copyYesterdayInto(key, refs);
        applyTypeRulesToInputs(refs.type.value, refs.start, refs.end, refs.breakH);
      });

      editor.querySelector('.in-close').addEventListener('click', (ev)=>{
        ev.stopPropagation();
        openDateKey = null;
        card.classList.remove('open');
        editor.classList.add('hidden');
      });

      editor.querySelector('.in-save').addEventListener('click', async (ev)=>{
        ev.stopPropagation();
        await saveInlineDay(key, refs);
        toast('Gespeichert');
        openDateKey = null;
        await renderMonth();
        // nach dem Speichern wieder zum Tag scrollen
        setTimeout(()=>scrollToDay(key), 40);
      });

      summary.addEventListener('click', async ()=>{
        const isOpen = card.classList.contains('open');
        // close any open card
        const open = $dayList.querySelector('.day-card.open');
        if(open && open !== card){
          open.classList.remove('open');
          open.querySelector('.day-editor-inline')?.classList.add('hidden');
        }
        if(isOpen){
          card.classList.remove('open');
          editor.classList.add('hidden');
          openDateKey = null;
        }else{
          // reload record when opening (in case it changed)
          const fresh = await AZDB.getDay(key);
          await fillInlineInputs(key, fresh, refs);
          card.classList.add('open');
          editor.classList.remove('hidden');
          openDateKey = key;
          setTimeout(()=>editor.scrollIntoView({block:'nearest', behavior:'smooth'}), 0);
        }
      });

      card.appendChild(summary);
      card.appendChild(editor);
      if(openDateKey === key){
        card.classList.add('open');
        editor.classList.remove('hidden');
      }
      $dayList.appendChild(card);
    }

    // update month stats (optional: aus importierter Jahres-CSV übernehmen)
    let saldo = startSaldo + sumDiff;

    // IMPORTANT: Wenn es Tagesdaten für diesen Monat gibt, muss die Berechnung tagesaktuell
    // aus den Einträgen erfolgen. Jahres-/Monats-CSV Werte dienen nur als Fallback,
    // wenn in diesem Monat noch keine Tagesdaten vorhanden sind.
    if(settings.useYearSummaryMonthly && stored.length === 0){
      const ys = await getYearSummary(current.year);
      const im = findImportedMonth(ys, current.month);
      if(im){
        const iSoll = Number(im.soll||0);
        const iIst  = Number(im.ist||0);
        const iDiff = (im.diff!=null) ? Number(im.diff||0) : (iIst - iSoll);
        const iSaldo = (im.saldo!=null) ? Number(im.saldo||0) : (deriveImportedCarry(ys, current.month) + iDiff);
        const iCarry = deriveImportedCarry(ys, current.month);

        sumSoll = iSoll; sumIst = iIst; sumDiff = iDiff;
        startSaldo = iCarry; saldo = iSaldo;
      }
    }

    $statSoll.textContent = formatHours(sumSoll);
    $statIst.textContent = formatHours(sumIst);
    $statCarry.textContent = formatHours(startSaldo);
    $statSaldo.textContent = formatHours(saldo);
    setGoodBad($statCarry, startSaldo);
    setGoodBad($statSaldo, saldo);

    // company + person
    $companyName.textContent = settings.company;
    $personNameHeader.textContent = (settings.person || '');

    // Urlaub/Krank (Jahr)
    const yc = await calcYearCounters(current.year);
    $statVac.textContent = yc.vacUsed + '/' + settings.vacationPerYear;
    $statSick.textContent = yc.sickDays + ' Tg';
  }

  function setGoodBad(el, v){
    el.classList.remove('good','bad');
    if(v > 0.005) el.classList.add('good');
    else if(v < -0.005) el.classList.add('bad');
  }

  function typeLabel(type, key){
    switch(type){
      case 'work': return 'Arbeitszeit';
      case 'vac': return 'Urlaub';
      case 'sick': return 'Krank';
      case 'holiday': return 'Feiertag';
      case 'rest': return 'Ruhetag';
      case 'comp': return 'Zeitausgleich';
      default: return getDefaultType(key);
    }
  }

  
  // ---- Jahres-CSV Monatswerte (Override) ----
  const MONTH_NAME_MAP = {
    'januar':1,'jan':1,
    'februar':2,'feb':2,
    'märz':3,'maerz':3,'mrz':3,'mar':3,
    'april':4,'apr':4,
    'mai':5,
    'juni':6,'jun':6,
    'juli':7,'jul':7,
    'august':8,'aug':8,
    'september':9,'sep':9,'sept':9,
    'oktober':10,'okt':10,'oct':10,
    'november':11,'nov':11,
    'dezember':12,'dez':12,'dec':12
  };

  function monthIndexFromAny(m){
    if(!m) return null;
    if(typeof m.month === 'number' && m.month>=1 && m.month<=12) return m.month;
    if(typeof m.month === 'string'){
      const s = m.month.trim().toLowerCase();
      if(MONTH_NAME_MAP[s]) return MONTH_NAME_MAP[s];
      const n = parseInt(s,10);
      if(Number.isFinite(n) && n>=1 && n<=12) return n;
    }
    if(typeof m.name === 'string'){
      const s = m.name.trim().toLowerCase();
      if(MONTH_NAME_MAP[s]) return MONTH_NAME_MAP[s];
      const s2 = s.replace('ä','ae').replace('ö','oe').replace('ü','ue');
      if(MONTH_NAME_MAP[s2]) return MONTH_NAME_MAP[s2];
    }
    return null;
  }

  async function getYearSummary(year){
    const raw = await AZDB.getSetting('yearSummary_' + year, null);
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(e){ return null; }
  }

  // ---- Data presence helpers (verhindert riesige negative Salden für Monate ohne echte Einträge) ----
  const _firstDataMonthCache = new Map();
  function invalidateYearCache(year){
    _firstDataMonthCache.delete(Number(year));
  }

  async function getFirstDataMonth(year){
    const y = Number(year);
    if(_firstDataMonthCache.has(y)) return _firstDataMonthCache.get(y);
    const start = toKey(y, 1, 1);
    const end = toKey(y, 12, 31);
    const all = await AZDB.getRange(start, end);
    let minMonth = null;
    for(const r of all){
      if(!r || !r.date) continue;
      const mm = parseInt(String(r.date).slice(5,7), 10);
      if(Number.isFinite(mm) && mm >= 1 && mm <= 12){
        if(minMonth == null || mm < minMonth) minMonth = mm;
      }
    }
    _firstDataMonthCache.set(y, minMonth);
    return minMonth;
  }

  function findImportedMonth(ys, month){
    if(!ys || !Array.isArray(ys.months)) return null;
    // try by numeric month
    for(const m of ys.months){
      const mi = monthIndexFromAny(m);
      if(mi === month) return m;
    }
    // fallback: if array is 12 items in order
    if(ys.months.length >= month) return ys.months[month-1];
    return null;
  }

  function deriveImportedCarry(ys, month){
    if(!ys || !Array.isArray(ys.months)) return 0;
    const m = findImportedMonth(ys, month);
    if(m && typeof m.carry === 'number') return m.carry;
    // in CSV: Jan carry = yearStartSaldo, others carry = previous month saldo
    if(month === 1) return Number(ys.yearStartSaldo || 0) || 0;
    const prev = findImportedMonth(ys, month-1);
    if(prev && prev.saldo != null) return Number(prev.saldo || 0) || 0;
    return 0;
  }

  function hasImportedCarryBaseline(ys, month){
    if(!ys || !Array.isArray(ys.months)) return false;
    const m = findImportedMonth(ys, month);
    if(m && typeof m.carry === 'number') return true;
    if(month === 1 && ys.yearStartSaldo != null) return true;
    if(month > 1){
      const prev = findImportedMonth(ys, month-1);
      if(prev && prev.saldo != null) return true;
    }
    return false;
  }


  async function calcCarryToMonth(year, month){
    const startSaldoYear = await getYearStartSaldo(year);
    if(month <= 1) return startSaldoYear;

    // Nur ab dem ersten Monat mit echten Tagesdaten rechnen.
    // Dadurch werden Monate, die nie erfasst wurden (z.B. Jan–Sep), NICHT als -8h/Tag gewertet.
    const firstM = await getFirstDataMonth(year);
    if(!firstM || firstM >= month) return startSaldoYear;

    let carry = startSaldoYear;
    for(let m=firstM; m<month; m++){
      const {diff} = await calcMonthDiff(year, m, { ignoreEmpty: true });
      carry += diff;
    }
    return carry;
  }

  async function calcMonthDiff(year, month, opts){
    const dim = daysInMonth(year, month);
    const startKey = toKey(year, month, 1);
    const endKey = toKey(year, month, dim);
    const stored = await AZDB.getRange(startKey, endKey);
    if(opts && opts.ignoreEmpty && stored.length === 0){
      return {soll:0, ist:0, diff:0, empty:true};
    }
    const map = new Map(stored.map(r=>[r.date, r]));
    let diff=0, soll=0, ist=0;
    for(let d=1; d<=dim; d++){
      const key = toKey(year, month, d);
      const rec = normalizeRecord(key, map.get(key));
      const h = calcDayHours(key, rec);
      soll += h.soll; ist += h.ist; diff += h.diff;
    }
    return {soll, ist, diff};
  }

  async function calcYearToMonth(year, month){
    const m = Math.max(1, Math.min(12, Number(month)||1));
    let soll=0, ist=0, diff=0;
    const firstM = await getFirstDataMonth(year);
    const startM = firstM ? Math.max(1, Math.min(12, firstM)) : 1;
    for(let mm=startM; mm<=m; mm++){
      const r = await calcMonthDiff(year, mm, { ignoreEmpty: true });
      soll += r.soll; ist += r.ist; diff += r.diff;
    }
    return {soll, ist, diff};
  }

  async function calcYearCounters(year){
    const start = toKey(year, 1, 1);
    const end = toKey(year, 12, 31);
    const all = await AZDB.getRange(start, end);
    let vacUsed = 0;
    let sickDays = 0;
    for(const r of all){
      if(!r || !r.date) continue;
      if(r.type === 'vac' && baseSollHours(r.date) > 0) vacUsed++;
      if(r.type === 'sick' && baseSollHours(r.date) > 0) sickDays++;
    }

    // Fallback: wenn noch keine Tagesdaten vorhanden sind, nutze ggf. Jahres-CSV-Import
    if(all.length === 0){
      const raw = await AZDB.getSetting('yearSummary_' + year, null);
      if(raw){
        try{
          const ys = JSON.parse(raw);
          const total = ys && ys.counts && ys.counts.totalByKey ? ys.counts.totalByKey : null;
          if(total){
            if(typeof total.ferien_urlaub === 'number') vacUsed = total.ferien_urlaub;
            if(typeof total.krank === 'number') sickDays = total.krank;
          }
        }catch(e){ /* ignore */ }
      }
    }

    return {vacUsed, sickDays};
  }

  // ---- Inline Editor (im Listen-Eintrag) ----
  function applyTypeRulesToInputs(type, startEl, endEl, breakEl){
    const work = (type === 'work');
    startEl.disabled = !work;
    endEl.disabled = !work;
    breakEl.disabled = !work;
    if(work){
      if(!breakEl.value) breakEl.value = '0.5';
    }else{
      startEl.value = '';
      endEl.value = '';
      breakEl.value = '0';
    }
  }

  async function fillInlineInputs(key, rec, refs){
    const norm = normalizeRecord(key, rec);
    refs.type.value = norm.type;
    refs.start.value = norm.start || '';
    refs.end.value = norm.end || '';
    refs.breakH.value = String(norm.type === 'work' ? (norm.breakH ?? 0.5) : 0);
    refs.place.value = norm.place || '';
    refs.note.value = norm.note || '';
    applyTypeRulesToInputs(norm.type, refs.start, refs.end, refs.breakH);
  }

  async function copyYesterdayInto(key, refs){
    const d = toDateObj(key);
    d.setDate(d.getDate()-1);
    const yKey = toKey(d.getFullYear(), d.getMonth()+1, d.getDate());
    const prev = await AZDB.getDay(yKey);
    const normPrev = normalizeRecord(yKey, prev);
    refs.start.value = normPrev.start || '';
    refs.end.value = normPrev.end || '';
    refs.breakH.value = String(normPrev.breakH ?? 0.5);
    if(normPrev.place) refs.place.value = normPrev.place;
    toast('Wie gestern übernommen');
  }

  async function saveInlineDay(key, refs){
    const t = refs.type.value || getDefaultType(key);
    const rec = {
      date: key,
      type: t,
      start: (refs.start.value || '').trim(),
      end: (refs.end.value || '').trim(),
      breakH: Number(refs.breakH.value || 0),
      place: (refs.place.value || '').trim(),
      note: (refs.note.value || '').trim(),
      updatedAt: Date.now()
    };
    if(!Number.isFinite(rec.breakH) || rec.breakH < 0) rec.breakH = 0;
    if(t !== 'work'){ rec.start=''; rec.end=''; rec.breakH = 0; }
    await AZDB.setDay(rec);
    // Cache für ersten Daten-Monat invalidieren (wichtig)
    try{ invalidateYearCache(parseInt(String(key).slice(0,4),10)); }catch(e){ /* ignore */ }
  }


  // ---- Year view ----
  async function openYearView(){
    $dayList.classList.add('hidden');
    $yearView.classList.remove('hidden');

    const year = current.year;
    $yearTitle.textContent = `Jahr ${year}`;
    $yearCards.innerHTML = "";

    let ySoll=0, yIst=0, yDiff=0;

    for(let m=1; m<=12; m++){
      // Wenn vorhanden: Monatswerte aus importierter Jahres-CSV benutzen
      if(settings.useYearSummaryMonthly){
        const ysImp = await getYearSummary(year);
        const im = findImportedMonth(ysImp, m);
        if(im){
          const carry = deriveImportedCarry(ysImp, m);
          const soll = Number(im.soll||0);
          const ist  = Number(im.ist||0);
          const diff = (im.diff!=null)?Number(im.diff||0):(ist-soll);
          const saldo = (im.saldo!=null)?Number(im.saldo||0):(carry+diff);
          // render card using imported values
          const card = document.createElement('div');
          card.className = 'year-card';
          card.innerHTML = `
        <div>
          <div class="mname">${MONTHS[m-1]}</div>
          <div class="small">S. Vormonat: ${AZExport.formatNum(carry)} h</div>
        </div>
        <div class="vals">
          <div>Soll: <b>${AZExport.formatNum(soll)} h</b></div>
          <div>Ist: <b>${AZExport.formatNum(ist)} h</b></div>
          <div>Diff: <b class="${diff>0.005?'good':diff<-0.005?'bad':''}">${AZExport.formatNum(diff)} h</b></div>
          <div>Saldo: <b class="${saldo>0.005?'good':saldo<-0.005?'bad':''}">${AZExport.formatNum(saldo)} h</b></div>
        </div>
      `;
          card.addEventListener('click', ()=>{
            current.month = m;
            openDateKey = null;
            renderMonth();
          });
          $yearCards.appendChild(card);
          continue;
        }
      }

      const {soll, ist, diff} = await calcMonthDiff(year, m, { ignoreEmpty: true });
      ySoll += soll; yIst += ist; yDiff += diff;

      const carry = await calcCarryToMonth(year, m);
      const saldo = carry + diff;

      const card = document.createElement('div');
      card.className = 'year-card';
      card.innerHTML = `
        <div>
          <div class="mname">${MONTHS[m-1]}<\/div>
          <div class="small">S. Vormonat: ${AZExport.formatNum(carry)} h<\/div>
        <\/div>
        <div class="vals">
          <div>Soll: <b>${AZExport.formatNum(soll)} h<\/b><\/div>
          <div>Ist: <b>${AZExport.formatNum(ist)} h<\/b><\/div>
          <div>Diff: <b class="${diff>0.005?'good':diff<-0.005?'bad':''}">${AZExport.formatNum(diff)} h<\/b><\/div>
          <div>Saldo: <b class="${saldo>0.005?'good':saldo<-0.005?'bad':''}">${AZExport.formatNum(saldo)} h<\/b><\/div>
        <\/div>
      `;
      card.addEventListener('click', ()=>{
        current.month = m;
        openDateKey = null;
        renderMonth();
      });
      $yearCards.appendChild(card);
    }

    const yc = await calcYearCounters(year);
    const vacLeft = Math.max(0, settings.vacationPerYear - yc.vacUsed);
    const startSaldo = await getYearStartSaldo(year);
    const ySaldo = startSaldo + yDiff;

    // Optional: Importierte Jahres-CSV anzeigen
    let importBox = '';
    const raw = await AZDB.getSetting('yearSummary_' + year, null);
    if(raw){
      try{
        const ys = JSON.parse(raw);
        importBox = buildImportedYearBox(ys);
      }catch(e){ /* ignore */ }
    }

    $yearSummary.innerHTML = `
      <div><b>Jahres-Soll:<\/b> ${AZExport.formatNum(ySoll)} h<\/div>
      <div><b>Jahres-Ist:<\/b> ${AZExport.formatNum(yIst)} h<\/div>
      <div><b>Jahres-Diff:<\/b> <span class="${yDiff>0.005?'good':yDiff<-0.005?'bad':''}"><b>${AZExport.formatNum(yDiff)} h<\/b><\/span><\/div>
      <div><b>Startsaldo Jahr:<\/b> ${AZExport.formatNum(startSaldo)} h<\/div>
      <div><b>Jahres-Saldo:<\/b> <span class="${ySaldo>0.005?'good':ySaldo<-0.005?'bad':''}"><b>${AZExport.formatNum(ySaldo)} h<\/b><\/span><\/div>
      <hr />
      <div><b>Urlaub:<\/b> ${yc.vacUsed} genommen / ${vacLeft} übrig (von ${settings.vacationPerYear})<\/div>
      <div><b>Krank:<\/b> ${yc.sickDays} Tage<\/div>
      ${importBox}
    `;
  }

  function escHtml(s){
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function buildImportedYearBox(ys){
    if(!ys || (!ys.months && !ys.counts)) return '';

    let html = `<div class="import-box"><div class="import-title"><b>CSV Jahresübersicht (Import)<\/b><\/div>`;

    if(Array.isArray(ys.months) && ys.months.length){
      html += `<div class="small">Monatswerte aus der Jahres-CSV (Soll/Ist/Diff/Saldo).<\/div>`;
      html += `<div class="table-wrap"><table class="tbl"><thead><tr><th>Monat<\/th><th>Soll<\/th><th>Ist<\/th><th>Diff<\/th><th>Saldo<\/th><\/tr><\/thead><tbody>`;
      for(const m of ys.months){
        if(!m) continue;
        const name = m.name || (typeof m.month==='number'?MONTHS[m.month-1]:String(m.month||''));
        const soll = AZExport.formatNum(Number(m.soll||0));
        const ist  = AZExport.formatNum(Number(m.ist||0));
        const diff = Number(m.diff||0);
        const saldo = Number(m.saldo||0);
        html += `<tr><td>${escHtml(name)}<\/td><td>${soll}<\/td><td>${ist}<\/td><td class="${diff>0.005?'good':diff<-0.005?'bad':''}">${AZExport.formatNum(diff)}<\/td><td class="${saldo>0.005?'good':saldo<-0.005?'bad':''}">${AZExport.formatNum(saldo)}<\/td><\/tr>`;
      }
      html += `</tbody></table></div>`;
    }

    if(ys.counts && ys.counts.totalRaw){
      html += `<hr /><div><b>Tage-Statistik (Total)<\/b><\/div>`;
      html += `<div class="chips">`;
      const entries = Object.entries(ys.counts.totalRaw);
      for(const [k,v] of entries){
        html += `<div class="chip"><span>${escHtml(k)}<\/span><b>${escHtml(v)}<\/b><\/div>`;
      }
      html += `</div>`;

      // pro Monat (vollständige Tabelle, horizontal scrollbar)
      if(Array.isArray(ys.counts.months) && ys.counts.months.length && Array.isArray(ys.counts.headers)){
        html += `<div class="small" style="margin-top:8px">Tage-Statistik pro Monat (aus Jahres-CSV).</div>`;
        html += `<div class="table-wrap"><table class="tbl"><thead><tr>`;
        for(const h of ys.counts.headers){
          html += `<th>${escHtml(h)}</th>`;
        }
        html += `</tr></thead><tbody>`;
        for(const row of ys.counts.months){
          html += `<tr>`;
          for(const h of ys.counts.headers){
            const v = row && row.valuesRaw ? (row.valuesRaw[h] ?? '') : '';
            html += `<td>${escHtml(v)}</td>`;
          }
          html += `</tr>`;
        }
        if(ys.counts.totalRaw){
          html += `<tr>`;
          for(const h of ys.counts.headers){
            const v = ys.counts.totalRaw[h] ?? '';
            html += `<td><b>${escHtml(v)}</b></td>`;
          }
          html += `</tr>`;
        }
        html += `</tbody></table></div>`;
      }
    }

    html += `</div>`;
    return html;
  }

  // ---- Export helpers ----

  function buildRowsForRange(startKey, endKey){
    // returns Promise rows with computed soll/ist/diff for each day in range
    return (async ()=>{
      const stored = await AZDB.getRange(startKey, endKey);
      const map = new Map(stored.map(r=>[r.date, r]));
      const rows = [];
      let cur = startKey;
      while(cur <= endKey){
        const d = toDateObj(cur);
        const key = toKey(d.getFullYear(), d.getMonth()+1, d.getDate());
        const rec = normalizeRecord(key, map.get(key));
        const h = calcDayHours(key, rec);
        rows.push({
          datum: `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`,
          wochentag: WEEKDAYS[d.getDay()],
          typ: typeLabel(rec.type, key),
          start: rec.start||"",
          ende: rec.end||"",
          // Pause nur bei echter Arbeitszeit exportieren
          pause_h: (rec.type==='work') ? AZExport.formatNum((rec.breakH ?? 0.5)) : "",
          soll_h: AZExport.formatNum(h.soll),
          ist_h: AZExport.formatNum(h.ist),
          diff_h: AZExport.formatNum(h.diff),
          ort: rec.place||"",
          notiz: rec.note||""
        });
        // increment day
        d.setDate(d.getDate()+1);
        cur = toKey(d.getFullYear(), d.getMonth()+1, d.getDate());
      }
      return rows;
    })();
  }

  function todayGerman(){
    const d = new Date();
    return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
  }

  function germanDateFromTs(ts){
    try{
      const d = new Date(ts);
      if(!Number.isFinite(d.getTime())) return '—';
      return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
    }catch(_){ return '—'; }
  }

  async function maybeBackupReminder(){
    try{
      const now = Date.now();
      let firstRun = await AZDB.getSetting(KEY_FIRST_RUN_AT, null);
      if(!firstRun){
        await AZDB.setSetting(KEY_FIRST_RUN_AT, now);
        firstRun = now;
      }
      const lastBackup = await AZDB.getSetting(KEY_LAST_BACKUP_AT, 0) || 0;
      const lastPrompt = await AZDB.getSetting(KEY_LAST_BACKUP_PROMPT_AT, 0) || 0;

      const base = lastBackup > 0 ? lastBackup : firstRun;
      const msDay = 86400000;
      const daysSince = Math.floor((now - base) / msDay);
      const daysSincePrompt = Math.floor((now - lastPrompt) / msDay);

      if(daysSince >= BACKUP_REMINDER_DAYS && daysSincePrompt >= BACKUP_REMINDER_DAYS){
        const info = lastBackup > 0
          ? `Letztes Backup: ${germanDateFromTs(lastBackup)}. Bitte sicherheitshalber ein neues Backup speichern.`
          : `Noch kein Backup gespeichert. Bitte einmal ein Backup sichern (JSON).`;
        openBackupModal(info);
        await AZDB.setSetting(KEY_LAST_BACKUP_PROMPT_AT, now);
      }
    }catch(e){
      // never block startup
      console.warn('backup reminder failed', e);
    }
  }

  function buildExportMetaLines(exportLabel){
    // Meta-Header für CSV/PDF (wird beim Import automatisch ignoriert)
    const lines = [];
    lines.push('## Arbeitszeiterfassung Export');
    lines.push(`## Firma: ${settings.company || ''}`);
    lines.push(`## Name: ${settings.person || ''}`);
    lines.push(`## Export-Datum: ${todayGerman()}`);
    lines.push(`## Export-Typ: ${exportLabel}`);
    return lines;
  }

  async function exportCsvMonth(){
    const y = current.year, m = current.month;
    const startKey = toKey(y,m,1);
    const endKey = toKey(y,m,daysInMonth(y,m));
    const rows = await buildRowsForRange(startKey, endKey);
    const exportLabel = `Monat ${MONTHS[m-1]} ${y}`;
    const meta = buildExportMetaLines(exportLabel).join('\n');
    const csv = meta + "\n" + AZExport.buildCsv(rows);
    AZExport.downloadText(csv, `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_Monat_${y}-${pad2(m)}.csv`, 'text/csv;charset=utf-8');
    toast("CSV Monat exportiert");
  }

/* === PATCHPOINT: EXPORT_HANDY_MONTH === */
async function exportHandyMonth(){
  const y = current.year, m = current.month;
  const startKey = toKey(y,m,1);
  const endKey = toKey(y,m,daysInMonth(y,m));
  const rows = await buildRowsForRange(startKey, endKey);
  const exportLabel = `Monat ${MONTHS[m-1]} ${y}`;
  const title = `Arbeitszeiterfassung`;
  const subtitle = `${settings.company || 'Firma'} • ${settings.person || ''} • Export: ${todayGerman()}`.replace(/\s+•\s+•/g,' •').trim();
  const metaLines = buildExportMetaLines(exportLabel);
  const html = AZExport.buildMobileHtmlReport({ title, subtitle, exportLabel, metaLines, rows });
  AZExport.downloadText(html, `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_Monat_${y}-${pad2(m)}.html`, 'text/html;charset=utf-8');
  toast("Handy-Report Monat exportiert");
}

  async function exportCsvYear(){
    const y = current.year;
    const startKey = toKey(y,1,1);
    const endKey = toKey(y,12,31);
    const rows = await buildRowsForRange(startKey, endKey);
    const exportLabel = `Jahr ${y}`;
    const meta = buildExportMetaLines(exportLabel).join('\n');
    const csv = meta + "\n" + AZExport.buildCsv(rows);
    AZExport.downloadText(csv, `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_Jahr_${y}.csv`, 'text/csv;charset=utf-8');
    toast("CSV Jahr exportiert");
  }

  async function exportPdfMonth(){
    const y = current.year, m = current.month;
    const startKey = toKey(y,m,1);
    const endKey = toKey(y,m,daysInMonth(y,m));
    const rows = await buildRowsForRange(startKey, endKey);
    const exportLabel = `Monat ${MONTHS[m-1]} ${y}`;
    const title = `Arbeitszeiterfassung`;
    const subtitle = `${settings.company || 'Firma'} • ${settings.person||''} • ${exportLabel} • Export: ${todayGerman()}`.replace(/\s+•\s+•/g,' •').trim();
    const lines = rows.map(r=>{
  const time = (r.start && r.ende) ? `${r.start}-${r.ende}` : '—';
  const pause = (r.typ === 'Arbeitszeit') ? ` | Pause ${r.pause_h} h` : '';
  const hours = ` | Ist ${r.ist_h} h | Soll ${r.soll_h} h | Diff ${r.diff_h} h`;
  const ort = r.ort ? ` | ${r.ort}` : '';
  const notiz = r.notiz ? ` | ${r.notiz}` : '';
  return `${r.datum}  ${r.wochentag}  | ${r.typ} | ${time}${pause}${hours}${ort}${notiz}`;
});
    const pdf = AZExport.createSimplePdf(title, subtitle, lines);
    AZExport.downloadBlob(pdf, `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_${y}-${pad2(m)}.pdf`);
    toast("PDF Monat exportiert");
  }

  async function exportPdfYear(){
    const y = current.year;
    const startKey = toKey(y,1,1);
    const endKey = toKey(y,12,31);
    const rows = await buildRowsForRange(startKey, endKey);
    const exportLabel = `Jahr ${y}`;
    const title = `Arbeitszeiterfassung`;
    const subtitle = `${settings.company || 'Firma'} • ${settings.person||''} • ${exportLabel} • Export: ${todayGerman()}`.replace(/\s+•\s+•/g,' •').trim();
    const lines = rows.map(r=>{
  const time = (r.start && r.ende) ? `${r.start}-${r.ende}` : '—';
  const pause = (r.typ === 'Arbeitszeit') ? ` | Pause ${r.pause_h} h` : '';
  const hours = ` | Ist ${r.ist_h} h | Soll ${r.soll_h} h | Diff ${r.diff_h} h`;
  const ort = r.ort ? ` | ${r.ort}` : '';
  const notiz = r.notiz ? ` | ${r.notiz}` : '';
  return `${r.datum}  ${r.wochentag}  | ${r.typ} | ${time}${pause}${hours}${ort}${notiz}`;
});
    const pdf = AZExport.createSimplePdf(title, subtitle, lines);
    AZExport.downloadBlob(pdf, `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_${y}.pdf`);
    toast("PDF Jahr exportiert");
  }

  async function backupJson(){
    const days = await AZDB.getAll();
    const out = {
      schema: 1,
      exportedAt: new Date().toISOString(),
      app: { version: window.__AZ_VERSION || "?", build: window.__AZ_BUILD || "?" },
      settings: {
        company: settings.company,
        person: settings.person,
        state: settings.state,
        assumption: settings.assumption,
        augsburg: settings.augsburg,
        vacationPerYear: settings.vacationPerYear
      },
      yearStartSaldo: {},
      days
    };
    // include yearStartSaldo keys >= 2025 found in settings store
    for(let y=APP_MIN_YEAR; y<=APP_MIN_YEAR+10; y++){
      const v = await AZDB.getSetting(getYearStartSaldoKey(y), null);
      if(v != null) out.yearStartSaldo[String(y)] = v;
    }
    try{
      await AZDB.setSetting(KEY_LAST_BACKUP_AT, Date.now());
    }catch(_e){}
    AZExport.downloadText(JSON.stringify(out, null, 2), `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_Backup.json`, 'application/json;charset=utf-8');
    toast("Backup gespeichert");
    closeBackupModal();
  }

  async function restoreJsonFile(file){
    const text = await file.text();
    let data;
    try{ data = JSON.parse(text); }catch(e){ toast("JSON ungültig"); return; }
    if(!data || !Array.isArray(data.days)){ toast("JSON Format falsch"); return; }

    // restore settings
    if(data.settings){
      await AZDB.setSetting('company', data.settings.company ?? 'Zaunteam');
      await AZDB.setSetting('person', data.settings.person ?? '');
      await AZDB.setSetting('state', data.settings.state ?? 'BY');
      await AZDB.setSetting('assumption', !!data.settings.assumption);
      await AZDB.setSetting('augsburg', !!data.settings.augsburg);
      await AZDB.setSetting('vacationPerYear', data.settings.vacationPerYear ?? 30);
    }
    if(data.yearStartSaldo){
      for(const [y,v] of Object.entries(data.yearStartSaldo)){
        const yr = parseInt(y,10);
        if(Number.isFinite(yr) && yr >= APP_MIN_YEAR){
          await AZDB.setSetting(getYearStartSaldoKey(yr), Number(v)||0);
        }
      }
    }
    // restore days (ignore <2025)
    let count=0;
    for(const rec of data.days){
      if(rec && typeof rec.date === 'string' && rec.date >= '2025-01-01'){
        await AZDB.setDay(rec);
        count++;
      }
    }
    toast(`Restore OK (${count} Tage)`);
    await loadSettings();
    $companyName.textContent = settings.company;
    await renderMonth();
  }

  // ---- CSV Import ----
  async function handleCsvFile(file){
    const text = await file.text();
    const parsed = AZExport.parseCsv(text);

    if(parsed.kind === 'year_summary'){
      const s = parsed.summary;
      if(!s){ toast((parsed.errors && parsed.errors[0]) || "CSV nicht erkannt"); return; }
      pendingImport = { kind:'year_summary', summary: s, fileName: file.name };
      $importMeta.textContent = `Jahres-CSV: ${s.year || '—'} | ${s.person || '—'} | ${s.company || '—'} | Datei: ${file.name}`;
      $importPreview.textContent = buildImportPreviewSummary(s);
      $importMode.innerHTML = `<option value="apply">Übernehmen</option>`;
      $importMode.value = 'apply';
      $importModal.classList.remove('hidden');
      return;
    }

    if(parsed.kind === 'month_summary'){
      const s = parsed.summary;
      if(!s){ toast((parsed.errors && parsed.errors[0]) || "CSV nicht erkannt"); return; }
      pendingImport = { kind:'month_summary', summary: s, fileName: file.name };
      const mName = (s.month && MONTHS[s.month-1]) ? MONTHS[s.month-1] : (s.monthRow && s.monthRow.name) || '—';
      $importMeta.textContent = `Monats-CSV: ${mName} ${s.year || '—'} | ${s.person || '—'} | ${s.company || '—'} | Datei: ${file.name}`;
      $importPreview.textContent = buildImportPreviewSummary(s);
      $importMode.innerHTML = `<option value="apply">Übernehmen</option>`;
      $importMode.value = 'apply';
      $importModal.classList.remove('hidden');
      return;
    }

    // daily
    const rows = parsed.rows || [];
    const errors = parsed.errors || [];
    if(errors.length){
      toast(errors[0]);
    }
    if(!rows.length){
      toast("Keine importierbaren Zeilen gefunden");
      return;
    }

    // meta
    const years = [...new Set(rows.map(r=>parseInt(r.date.slice(0,4),10)))].sort((a,b)=>a-b);
    const yms = [...new Set(rows.map(r=>(r.date||'').slice(0,7)).filter(Boolean))].sort();
    pendingImport = { kind:'daily', rows, years, fileName: file.name };
    if(yms.length === 1){
      const yy = parseInt(yms[0].slice(0,4),10);
      const mm = parseInt(yms[0].slice(5,7),10);
      const mName = (Number.isFinite(mm) && mm>=1 && mm<=12) ? MONTHS[mm-1] : yms[0];
      $importMeta.textContent = `Monat: ${mName} ${Number.isFinite(yy)?yy:''} | Zeilen: ${rows.length} | Datei: ${file.name}`;
    }else{
      $importMeta.textContent = `Zeilen: ${rows.length} | Jahre: ${years.join(", ")} | Datei: ${file.name}`;
    }
    $importPreview.textContent = buildImportPreview(rows.slice(0, 25));
    $importMode.innerHTML = `
      <option value="merge">Zusammenführen (empfohlen)</option>
      <option value="replace">Ersetzen</option>
    `;
    $importMode.value = 'merge';
    $importModal.classList.remove('hidden');
  }

  function buildImportPreview(rows){
    const lines = [];
    for(const r of rows){
      lines.push(`${r.date} | ${r.type||''} | ${r.start||''}-${r.end||''} | Pause ${r.breakH ?? ''} | ${r.place||''} | ${r.note||''}`);
    }
    return lines.join("\n");
  }

  function buildImportPreviewSummary(s){
    const lines = [];

    // Monats-CSV Vorschau
    if(s && s.kind === 'month_summary'){
      const mName = (s.month && MONTHS[s.month-1]) ? MONTHS[s.month-1] : (s.monthRow && s.monthRow.name) || '—';
      const r = s.monthRow || {};
      lines.push(`Stundenübersicht eines Monats`);
      lines.push(`Name: ${s.person || '—'}`);
      lines.push(`Firma: ${s.company || '—'}`);
      lines.push(`Monat: ${mName} ${s.year || '—'}`);
      if(s.month === 1){
        lines.push(`Startsaldo (aus S. Vormonat): ${AZExport.formatNum(s.yearStartSaldo || 0)} h`);
      }
      lines.push("");
      lines.push(`Werte (Soll/Ist/Diff/Saldo):`);
      lines.push(`${mName}  Soll ${AZExport.formatNum(r.soll||0)}  Ist ${AZExport.formatNum(r.ist||0)}  Diff ${AZExport.formatNum(r.diff||0)}  Saldo ${AZExport.formatNum(r.saldo||0)}`);
      lines.push("");
      lines.push("Hinweis: Diese Monats-CSV füllt keine Tageszeiten. Sie wird als Monatswert im Jahres-Import gespeichert und in Soll/Ist/Saldo angezeigt.");
      return lines.join("\n");
    }

    lines.push(`Stundenübersicht eines Jahres`);
    lines.push(`Name: ${s.person || '—'}`);
    lines.push(`Firma: ${s.company || '—'}`);
    lines.push(`Jahr: ${s.year || '—'}`);
    lines.push(`Startsaldo (aus Januar S. Vormonat): ${AZExport.formatNum(s.yearStartSaldo || 0)} h`);
    lines.push(`Monate gefunden: ${Array.isArray(s.months)?s.months.length:0}`);
    if(Array.isArray(s.months) && s.months.length){
      lines.push("");
      lines.push("Monatswerte (Soll/Ist/Diff/Saldo):");
      for(const m of s.months){
        const mn = String(m.name||"").padEnd(10,' ');
        lines.push(`${mn}  Soll ${AZExport.formatNum(m.soll||0)}  Ist ${AZExport.formatNum(m.ist||0)}  Diff ${AZExport.formatNum(m.diff||0)}  Saldo ${AZExport.formatNum(m.saldo||0)}`);
      }
      if(s.total){
        lines.push("");
        lines.push(`Total: Soll ${AZExport.formatNum(s.total.soll||0)} | Ist ${AZExport.formatNum(s.total.ist||0)} | Diff ${AZExport.formatNum(s.total.diff||0)} | Saldo ${AZExport.formatNum(s.total.saldo||0)}`);
      }
    }
    if(s.counts && s.counts.totalByKey){
      const t = s.counts.totalByKey;
      const vac = (typeof t.ferien_urlaub==='number') ? t.ferien_urlaub : null;
      const sick = (typeof t.krank==='number') ? t.krank : null;
      lines.push("");
      lines.push(`Tage-Statistik (Total): Urlaub ${vac!=null?vac:'—'} | Krank ${sick!=null?sick:'—'} | Feiertage ${typeof t.feiertag==='number'?t.feiertag:'—'}`);
    }
    lines.push("");
    lines.push("Hinweis: Diese CSV enthält eine Jahresübersicht (Monatswerte + Tages-Statistik). Tageszeiten werden dadurch nicht automatisch befüllt.");
    return lines.join("\n");
  }

  async function confirmImport(){
    if(!pendingImport) return;

    // 1) Jahres-CSV (Jahresübersicht: Monatswerte + Tages-Statistik)
    if(pendingImport.kind === 'year_summary'){
      const s = pendingImport.summary;
      const y = parseInt(String(s.year||''), 10);
      if(!Number.isFinite(y) || y < APP_MIN_YEAR){
        toast("Jahr ungültig (min. 2025)");
        return;
      }

      const ys = Number(s.yearStartSaldo || 0);
      await AZDB.setSetting(getYearStartSaldoKey(y), Number.isFinite(ys) ? ys : 0);

      // komplette Jahresübersicht für Anzeige/Fallback speichern
      try{ await AZDB.setSetting('useYearSummaryMonthly', true); settings.useYearSummaryMonthly = true; }catch(e){ /* ignore */ }

      try{
        await AZDB.setSetting('yearSummary_' + y, JSON.stringify(s));
      }catch(e){ /* ignore */ }

      const curPerson = await AZDB.getSetting('person', '');
      const curCompany = await AZDB.getSetting('company', 'Zaunteam');
      if(!curPerson && s.person){
        await AZDB.setSetting('person', s.person);
      }
      if((!curCompany || curCompany === 'Zaunteam') && s.company){
        await AZDB.setSetting('company', s.company);
      }

      pendingImport = null;
      $importModal.classList.add('hidden');
      toast(`Jahres-CSV übernommen (${y})`);
      try{ invalidateYearCache(y); }catch(e){ /* ignore */ }
      try{ current.year = y; if(current.month < 1 || current.month > 12) current.month = 1; openDateKey = null; }catch(e){ /* ignore */ }
      await loadSettings();
      await renderMonth();
      return;
    }

    // 1b) Monats-CSV (Monatswerte -> wird in yearSummary_<year> gemerged)
    if(pendingImport.kind === 'month_summary'){
      const s = pendingImport.summary;
      const y = parseInt(String(s.year||''), 10);
      const m = parseInt(String(s.month||''), 10);
      if(!Number.isFinite(y) || y < APP_MIN_YEAR){
        toast("Jahr ungültig (min. 2025)");
        return;
      }
      if(!Number.isFinite(m) || m < 1 || m > 12){
        toast("Monat ungültig");
        return;
      }

      let ys = null;
      try{
        const raw = await AZDB.getSetting('yearSummary_' + y, null);
        if(raw) ys = JSON.parse(raw);
      }catch(e){ ys = null; }

      if(!ys || typeof ys !== 'object'){
        ys = { kind:'year_summary', year:y, person:s.person||'', company:s.company||'', yearStartSaldo:0, months:[], total:null, counts:null };
      }
      if(!ys.person && s.person) ys.person = s.person;
      if(!ys.company && s.company) ys.company = s.company;

      const mr = s.monthRow || {};
      const entry = {
        month: m,
        name: mr.name || (MONTHS[m-1] || String(m)),
        soll: Number(mr.soll||0),
        ist: Number(mr.ist||0),
        diff: Number(mr.diff||0),
        carry: Number(mr.carry||0),
        paidOvertime: Number(mr.paidOvertime||0),
        saldo: Number(mr.saldo||0)
      };
      if(!Array.isArray(ys.months)) ys.months = [];
      const idx = ys.months.findIndex(x => Number(x.month) === m);
      if(idx >= 0) ys.months[idx] = {...ys.months[idx], ...entry};
      else ys.months.push(entry);
      ys.months = ys.months
        .filter(x=>Number.isFinite(Number(x.month)) && Number(x.month)>=1 && Number(x.month)<=12)
        .sort((a,b)=>Number(a.month)-Number(b.month));

      if(m === 1){
        const ysSaldo = Number(s.yearStartSaldo || entry.carry || 0);
        ys.yearStartSaldo = Number.isFinite(ysSaldo) ? ysSaldo : 0;
        await AZDB.setSetting(getYearStartSaldoKey(y), ys.yearStartSaldo);
      }

      try{ await AZDB.setSetting('useYearSummaryMonthly', true); settings.useYearSummaryMonthly = true; }catch(e){ /* ignore */ }
      try{ await AZDB.setSetting('yearSummary_' + y, JSON.stringify(ys)); }catch(e){ /* ignore */ }

      const curPerson = await AZDB.getSetting('person', '');
      const curCompany = await AZDB.getSetting('company', 'Zaunteam');
      if(!curPerson && ys.person){ await AZDB.setSetting('person', ys.person); }
      if((!curCompany || curCompany === 'Zaunteam') && ys.company){ await AZDB.setSetting('company', ys.company); }

      pendingImport = null;
      $importModal.classList.add('hidden');
      toast(`Monats-CSV übernommen (${MONTHS[m-1]} ${y})`);
      try{ invalidateYearCache(y); }catch(e){ /* ignore */ }
      try{ current.year = y; current.month = m; openDateKey = null; }catch(e){ /* ignore */ }
      await loadSettings();
      await renderMonth();
      return;
    }

    // 2) Daily CSV
    const mode = $importMode.value;
    const rows = pendingImport.rows;
    const years = pendingImport.years;

    if(mode === 'replace'){
      for(const y of years){
        if(y < APP_MIN_YEAR) continue;
        const startKey = toKey(y,1,1);
        const endKey = toKey(y,12,31);
        const existing = await AZDB.getRange(startKey, endKey);
        for(const rec of existing){
          await AZDB.deleteDay(rec.date);
        }
      }
    }

    let written=0;
    for(const r of rows){
      const key = r.date;
      const tmp = normalizeRecord(key, null);
      const type = r.type || tmp.type;
      const rec = {
        date: key,
        type: type,
        start: (type==='work' ? (r.start||"") : ""),
        end: (type==='work' ? (r.end||"") : ""),
        breakH: (type==='work' ? (Number.isFinite(r.breakH) ? r.breakH : (r.breakH!=null?Number(r.breakH):0.5)) : 0),
        place: r.place || "",
        note: r.note || "",
        updatedAt: Date.now()
      };
      if(type==='work'){
        if(!Number.isFinite(rec.breakH) || rec.breakH<0) rec.breakH = 0.5;
      }else{
        rec.breakH = 0;
      }
      await AZDB.setDay(rec);
      written++;
    }
    pendingImport = null;
    $importModal.classList.add('hidden');
    toast(`Import OK (${written} Tage)`);
    try{
      if(Array.isArray(years)) for(const y of years) invalidateYearCache(y);
    }catch(e){ /* ignore */ }
    // Nach Import automatisch in den importierten Monat springen (damit man sofort etwas sieht)
    try{
      if(Array.isArray(rows) && rows.length){
        const dates = rows.map(r=>r.date).filter(Boolean).sort();
        const dk = dates[0];
        const yy = parseInt(String(dk).slice(0,4),10);
        const mm = parseInt(String(dk).slice(5,7),10);
        if(Number.isFinite(yy) && yy >= APP_MIN_YEAR && Number.isFinite(mm) && mm>=1 && mm<=12){
          current.year = yy;
          current.month = mm;
          openDateKey = null;
        }
      }
    }catch(e){ /* ignore */ }
    await renderMonth();
  }

  function closeImport(){
    $importModal.classList.add('hidden');
    pendingImport = null;
    try{ if($fileImportCsv) $fileImportCsv.value = ""; }catch(_e){}
  }

  function openBackupModal(text){
    if(!$backupModal) return;
    if($backupHint) $backupHint.textContent = text || 'Backup empfohlen';
    $backupModal.classList.remove('hidden');
  }
  function closeBackupModal(){
    if(!$backupModal) return;
    $backupModal.classList.add('hidden');
  }


  // ---- Update / Cache ----
  async function cacheReset(){
    try{
      if('serviceWorker' in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        for(const r of regs) await r.unregister();
      }
      if('caches' in window){
        const keys = await caches.keys();
        for(const k of keys) await caches.delete(k);
      }
      toast("Cache/Update-Reset OK – lade neu…");
      setTimeout(()=>location.reload(), 600);
    }catch(e){
      toast("Reset fehlgeschlagen");
    }
  }

  async function checkUpdate(){
    try{
      const res = await fetch(`version.json?t=${Date.now()}`, {cache:'no-store'});
      if(!res.ok) throw new Error("no version");
      const v = await res.json();
      const curV = window.__AZ_VERSION || "?";
      if(v.version && v.version !== curV){
        $updateInfo.textContent = `Neue Version gefunden: ${v.version} (Build ${v.build||'—'})`;
        $updateBanner.classList.remove('hidden');
        $updateText.textContent = `Update verfügbar: ${v.version}`;
        toast("Update verfügbar");
        // trigger SW update
        const reg = await navigator.serviceWorker.getRegistration();
        if(reg) reg.update();
      }else{
        $updateInfo.textContent = `Aktuell: ${curV} (Build ${window.__AZ_BUILD||'—'})`;
        toast("Kein Update gefunden");
      }
    }catch(e){
      if(!navigator.onLine){
        $updateInfo.textContent = "Offline: Update-Check nicht möglich";
        return;
      }
      $updateInfo.textContent = "Update-Check fehlgeschlagen";
      toast("Update-Check fehlgeschlagen");
    }
  }

  function showUpdateBanner(text){
    $updateText.textContent = text || "Update verfügbar";
    $updateBanner.classList.remove('hidden');
  }

  async function updateNow(){
    if(!('serviceWorker' in navigator)) return location.reload();
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg && reg.waiting){
      reg.waiting.postMessage({type:'SKIP_WAITING'});
      toast("Update wird aktiviert…");
      return;
    }
    // fallback: hard reload
    toast("Neu laden…");
    setTimeout(()=>location.reload(), 400);
  }

  function registerSW(){
    if(!('serviceWorker' in navigator)) return;
    // iOS (and sometimes other browsers) cannot (re)register a SW while fully offline
    // unless a controller is already active. In that case the app may still run from
    // cache, so don't show a scary error.
    const hasController = !!navigator.serviceWorker.controller;
    if(!navigator.onLine && !hasController){
      try{
        const el = document.getElementById('updateInfo');
        if(el && !el.textContent.includes('Offline')){
          el.textContent = (el.textContent ? (el.textContent+' • ') : '') + 'Offline (SW wird beim nächsten Online-Start aktiviert)';
        }
      }catch(_e){}
      return;
    }

    navigator.serviceWorker.register('./sw.js', {scope:'./'}).then((reg)=>{
      // listen for updates
      reg.addEventListener('updatefound', ()=>{
        const nw = reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange', ()=>{
          if(nw.state === 'installed'){
            if(navigator.serviceWorker.controller){
              showUpdateBanner("Update verfügbar");
            }
          }
        });
      });

            // offline-ready indicator
      navigator.serviceWorker.ready.then(()=>{
        window.__AZ_OFFLINE_READY = true;
        try{
          if($updateInfo && !$updateInfo.textContent.includes('Offline')){
            $updateInfo.textContent = ($updateInfo.textContent ? ($updateInfo.textContent + ' • ') : '') + 'Offline bereit';
          }
        }catch(_e){}
        try{
          if($appVersion && !$appVersion.textContent.includes('offline')){
            $appVersion.textContent = ($appVersion.textContent ? ($appVersion.textContent + ' • ') : '') + 'offline';
          }
        }catch(_e){}
      }).catch(()=>{});


navigator.serviceWorker.addEventListener('controllerchange', ()=>{
        // new version active
        location.reload();
      });
    }).catch((err)=>{
      console.warn('SW register failed', err);
      // If we're offline, this is expected on some platforms; don't alarm the user.
      if(!navigator.onLine) return;
      try{ toast('Offline/Cache nicht verfügbar (Service Worker Fehler)'); }catch(_e){}
    });
  }

  // ---- Navigation ----
  function gotoToday(){
    const d = new Date();
    const y = Math.max(APP_MIN_YEAR, d.getFullYear());
    const m = d.getMonth()+1;
    current.year = y; current.month = m;
    const k = toKey(y,m,d.getDate());
    openDateKey = k;
    renderMonth();
    // highlight in list
    setTimeout(()=>scrollToDay(k), 60);
  }

  function scrollToDay(key){
    const el = $dayList.querySelector(`[data-date="${key}"]`);
    if(el) el.scrollIntoView({block:'center', behavior:'smooth'});
  }

  function prevMonth(){
    let y=current.year, m=current.month;
    m -= 1;
    if(m<1){ y -= 1; m=12; }
    if(y < APP_MIN_YEAR){ toast("Vor 2025 ist deaktiviert"); return; }
    current.year=y; current.month=m;
    renderMonth();
  }
  function nextMonth(){
    let y=current.year, m=current.month;
    m += 1;
    if(m>12){ y += 1; m=1; }
    current.year=y; current.month=m;
    renderMonth();
  }

  // ---- Bindings ----
  function bind(){
    els('btnSettings').addEventListener('click', openSettings);
    els('btnCloseSettings').addEventListener('click', closeSettings);
    els('btnSaveSettings').addEventListener('click', saveSettings);

    els('btnPrevMonth').addEventListener('click', prevMonth);
    els('btnNextMonth').addEventListener('click', nextMonth);
    els('btnToday').addEventListener('click', gotoToday);
    els('btnYearView').addEventListener('click', openYearView);
    els('btnBackToMonth').addEventListener('click', ()=>renderMonth());

    // update banner
    els('btnUpdateNow').addEventListener('click', updateNow);

    // settings extras
    els('btnCacheReset').addEventListener('click', cacheReset);
    els('btnCheckUpdate').addEventListener('click', checkUpdate);

    // export
    els('btnExportCsvMonth').addEventListener('click', exportCsvMonth);
    els('btnExportCsvYear').addEventListener('click', exportCsvYear);
    els('btnExportPdfMonth').addEventListener('click', exportPdfMonth);
    els('btnExportPdfYear').addEventListener('click', exportPdfYear);
    els('btnExportHandyMonth').addEventListener('click', exportHandyMonth);
    els('btnBackupJson').addEventListener('click', backupJson);
    // auto-backup reminder modal
    const _bn = els('btnBackupNow'); if(_bn) _bn.addEventListener('click', backupJson);
    const _bl = els('btnBackupLater'); if(_bl) _bl.addEventListener('click', closeBackupModal);
    const _bc = els('btnCloseBackup'); if(_bc) _bc.addEventListener('click', closeBackupModal);

    els('btnRestoreJson').addEventListener('click', ()=>els('fileRestoreJson').click());
    els('fileRestoreJson').addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if(f) await restoreJsonFile(f);
    });

    // CSV import
    $fileImportCsv.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if(f) await handleCsvFile(f);
    });

    // import modal
    els('btnCloseImport').addEventListener('click', closeImport);
    const $btnCancelImport = els('btnCancelImport');
    if($btnCancelImport) $btnCancelImport.addEventListener('click', closeImport);
    els('btnConfirmImport').addEventListener('click', confirmImport);

    // live holiday preview in settings
    $setState.addEventListener('change', refreshHolidayPreview);
    $setAssumption.addEventListener('change', refreshHolidayPreview);
    $setAugsburg.addEventListener('change', refreshHolidayPreview);
  }

  // ---- Init ----
  async function init(){
    // show version
    try{
      const res = await fetch(`version.json?t=${Date.now()}`, {cache:'no-store'});
      if(res.ok){
        const v = await res.json();
        window.__AZ_VERSION = v.version;
        window.__AZ_BUILD = v.build;
        $appVersion.textContent = `v${v.version} • ${v.build}`;
      }else{
        $appVersion.textContent = "";
      }
    }catch(e){
      $appVersion.textContent = "";
    }

    fillStateSelect();
    await AZDB.cleanupBefore2025();
    await loadSettings();

    const now = new Date();
    current.year = Math.max(APP_MIN_YEAR, now.getFullYear());
    current.month = now.getMonth()+1;

    $companyName.textContent = settings.company;

    bind();
    registerSW();
    await renderMonth();
    // remind for backup (weekly)
    setTimeout(()=>{ maybeBackupReminder(); }, 600);
  }

  // global safe init
  init().catch((e)=>{
    console.error(e);
    document.body.innerHTML = `
      <div style="padding:16px;font-family:system-ui">
        <div style="border:3px solid #C31120;border-radius:12px;padding:12px;background:#fff">
          <b>Fehler beim Starten.</b><br/>
          Script error.<br/><br/>
          <button id="hardReload" style="padding:10px 12px;border-radius:10px;border:1px solid #bbb;font-weight:800">Neu laden</button>
          <button id="hardReset" style="padding:10px 12px;border-radius:10px;border:1px solid #8A0F18;background:#C31120;color:#fff;font-weight:800;margin-left:8px">Cache/Update-Reset</button>
          <pre style="white-space:pre-wrap;margin-top:10px;font-size:12px;opacity:.8">${String(e && e.stack || e)}</pre>
        </div>
      </div>
    `;
    setTimeout(()=>{
      const r = document.getElementById('hardReload');
      const rs = document.getElementById('hardReset');
      if(r) r.onclick = ()=>location.reload();
      if(rs) rs.onclick = async ()=>{
        try{
          if('serviceWorker' in navigator){
            const regs = await navigator.serviceWorker.getRegistrations();
            for(const reg of regs) await reg.unregister();
          }
          if('caches' in window){
            const keys = await caches.keys();
            for(const k of keys) await caches.delete(k);
          }
        }catch(_){}
        location.reload();
      };
    }, 50);
  });

})();
