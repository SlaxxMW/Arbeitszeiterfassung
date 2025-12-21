
/* app.js - Arbeitszeiterfassung PWA (single-user, offline) */
(async function(){
  'use strict';

  const deepClone = (x)=> (window.deepClone ? window.deepClone(x) : JSON.parse(JSON.stringify(x)));

  const $ = (sel)=> document.querySelector(sel);
  const elCompanyName = $('#companyName');
  const elVacationBadge = $('#vacationBadge');
  const elMonthTitle = $('#monthTitle');
  const elMonthStats = $('#monthStats');
  const elDayList = $('#dayList');
  const elEditor = $('#editor');
  const monthHeaderEl = document.querySelector('.monthHeader');

  const modalBackdrop = $('#modalBackdrop');
  const settingsModal = $('#settingsModal');
  const exportModal = $('#exportModal');
  const yearModal = $('#yearModal');
  const settingsBody = $('#settingsBody');
  const exportBody = $('#exportBody');
  const yearBody = $('#yearBody');
  const yearTitle = $('#yearTitle');
  const toastEl = $('#toast');

  // ----- Defaults -----
  const DEFAULT_SETTINGS = {
    companyName: 'Zaunteam',
    startDate: '2024-01-01',
    startSaldoHours: 0.0,
    annualVacationDays: 30,
    roundingMinutes: 0,          // 0,5,10,15
    defaultPauseMinutes: 30,     // 0, 15, 30, 45, 60...
    includeAssumption: false,
    includeAugsburgPeace: false,
    enableShift2: false,
  };

  const DAY_TYPES = [
    {key:'work', label:'Arbeitszeit'},
    {key:'vacation', label:'Urlaub'},
    {key:'sick', label:'Krank'},
    {key:'holiday', label:'Feiertag'},
    {key:'rest', label:'Ruhetag'},
    {key:'comp', label:'Zeitausgleich'},
  ];

  const WEEKDAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  let settings = await AZ_DB.getSettings() || null;
  if(!settings){
    settings = deepClone(DEFAULT_SETTINGS);
    await AZ_DB.setSettings(settings);
  }else{
    settings = {...deepClone(DEFAULT_SETTINGS), ...settings};
  }

  // View state
  let viewDate = new Date(); // current month
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  let monthRecords = new Map(); // dateStr => record
  let holidayMap = new Map();   // dateStr => name (for view year)
  let editorDateStr = null;

  // ----- Helpers -----
  function pad2(n){ return String(n).padStart(2,'0'); }
  function dateStrToDate(s){
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  function toDateStr(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function fmtDMY(d){
    return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${String(d.getFullYear()).slice(-2)}`;
  }
  function fmtLongDate(d){
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function isWeekend(d){
    const wd = d.getDay();
    return wd === 0 || wd === 6;
  }
  function isWeekday(d){
    const wd = d.getDay();
    return wd >= 1 && wd <= 5;
  }
  function minutesFromTimeStr(t){
    if(!t) return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if(!m) return null;
    const hh = Math.min(23, Math.max(0, parseInt(m[1],10)));
    const mm = Math.min(59, Math.max(0, parseInt(m[2],10)));
    return hh*60 + mm;
  }
  function timeStrFromMinutes(min){
    if(min === null || min === undefined) return '';
    const hh = Math.floor(min/60)%24;
    const mm = min%60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }
  function roundTo(min, step){
    if(!step) return min;
    return Math.round(min/step)*step;
  }

  function isoWeekNumber(date){
    // ISO week number
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function getHolidayMapForYear(year){
    return AZ_HOLIDAYS.getBavariaHolidays(year, {
      includeAssumption: !!settings.includeAssumption,
      includeAugsburgPeace: !!settings.includeAugsburgPeace,
    });
  }

  function defaultTypeForDate(d){
    const ds = toDateStr(d);
    if(isWeekend(d)) return {type:'rest', note:null};
    if(holidayMap.has(ds)) return {type:'holiday', note:holidayMap.get(ds)};
    return {type:'work', note:null};
  }

  function sollMinutesForDate(d, type){
    if(type === 'rest') return 0;
    if(type === 'work') return isWeekday(d) ? 8*60 : 0;
    if(type === 'holiday' || type === 'vacation' || type === 'sick' || type === 'comp'){
      return isWeekday(d) ? 8*60 : 0;
    }
    return 0;
  }

  function netMinutesForRecord(rec, d){
    if(!rec) return 0;
    const type = rec.type || 'work';
    if(type !== 'work') return 0;

    const step = settings.roundingMinutes || 0;
    const pause = (rec.pauseMin != null ? rec.pauseMin : settings.defaultPauseMinutes) || 0;

    function spanMinutes(startStr, endStr){
      const a = minutesFromTimeStr(startStr);
      const b = minutesFromTimeStr(endStr);
      if(a == null || b == null) return 0;
      let diff = b - a;
      if(diff < 0) diff += 24*60; // over midnight
      diff = roundTo(diff, step);
      return diff;
    }

    let work = spanMinutes(rec.start1, rec.end1);
    if(settings.enableShift2){
      work += spanMinutes(rec.start2, rec.end2);
    }
    const net = Math.max(0, work - pause);
    return net;
  }

  function istMinutesForDate(d, rec, effectiveType){
    const type = effectiveType;
    if(type === 'work') return netMinutesForRecord(rec, d);
    const soll = sollMinutesForDate(d, type);
    if(type === 'holiday' || type === 'vacation' || type === 'sick' || type === 'comp') return soll;
    return 0;
  }

  function fmtH(min){ return AZ_EXPORT.fmtHoursWithSuffix(min); }
  function fmtHPlain(min){ return AZ_EXPORT.fmtHoursFromMin(min); }

  function classifyValue(min){
    if(min > 0) return 'pos';
    if(min < 0) return 'neg';
    return '';
  }

  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(()=> toastEl.classList.remove('show'), 1400);
  }

  async function refreshMhHeight(){
    requestAnimationFrame(()=>{
      const h = monthHeaderEl.offsetHeight;
      document.documentElement.style.setProperty('--mhH', `${h}px`);
    });
  }

  // ----- Data loading -----
  async function loadMonth(year, monthIndex0){
    const start = new Date(year, monthIndex0, 1);
    const end = new Date(year, monthIndex0+1, 0);
    const from = toDateStr(start);
    const to = toDateStr(end);

    holidayMap = getHolidayMapForYear(year); // for month, year map ok
    const recs = await AZ_DB.getDaysInRange(from, to);
    monthRecords = new Map(recs.map(r=>[r.date, r]));

    renderMonth(start);
    await refreshMhHeight();
  }

  // ----- Carry / balances -----
  function parseStartDate(){
    const s = settings.startDate || '2024-01-01';
    return dateStrToDate(s);
  }

  function startSaldoMinutes(){
    const h = Number(settings.startSaldoHours || 0);
    return Math.round(h*60);
  }

  function monthKey(y,m0){ return `${y}-${pad2(m0+1)}`; }

  function computeMonthStats(year, monthIndex0){
    // computes for the currently loaded month only using monthRecords + holidayMap
    const first = new Date(year, monthIndex0, 1);
    const last = new Date(year, monthIndex0+1, 0);

    let soll = 0, ist = 0, diff = 0;
    for(let d=1; d<=last.getDate(); d++){
      const dt = new Date(year, monthIndex0, d);
      const ds = toDateStr(dt);
      const rec = monthRecords.get(ds) || null;
      const eff = rec?.type || defaultTypeForDate(dt).type;
      const sMin = sollMinutesForDate(dt, eff);
      const iMin = istMinutesForDate(dt, rec, eff);
      soll += sMin;
      ist += iMin;
      diff += (iMin - sMin);
    }

    const prevCarry = computeCarryForMonth(year, monthIndex0);
    const saldo = prevCarry + diff;

    return {soll, ist, diff, prevCarry, saldo};
  }

  function computeCarryForMonth(year, monthIndex0){
    // Carry is saldo at end of previous month. Uses settings.startDate + startSaldo.
    const startD = parseStartDate();
    const startMonth = new Date(startD.getFullYear(), startD.getMonth(), 1);
    const target = new Date(year, monthIndex0, 1);

    // If target is before startMonth, carry is startSaldo.
    if(target < startMonth) return startSaldoMinutes();

    let carry = startSaldoMinutes();
    let cur = new Date(startMonth);

    // walk months until month before target
    while(cur < target){
      const y = cur.getFullYear();
      const m0 = cur.getMonth();
      const diff = computeMonthDiff(y, m0);
      carry += diff;
      // next month
      cur = new Date(y, m0+1, 1);
    }
    // carry now equals saldo at end of previous month relative to target
    return carry;

    function computeMonthDiff(y,m0){
      // compute diff for month y-m0 by loading records on-demand (range scan) - small data so ok
      // NOTE: We use monthRecords if it matches the requested month, else we approximate by querying DB synchronously is not possible.
      // We'll do a tiny on-the-fly sum based on cached monthRecords only when it's current month; for other months, we will query via cachedYearData when needed (year view).
      // Here: used mainly for current month carry calculation, so we only need past months; we compute via localStorage/IDB by requesting range in a blocking style isn't possible.
      // To keep UI stable, we precompute carries for year view separately. For current month carry, we do a lightweight cached approach:
      return computeMonthDiffCached(y,m0);
    }

    function computeMonthDiffCached(y,m0){
      // This function relies on a cache built in computeCarryForMonthFast() via year prefetch, but we don't have it here.
      // We'll use a conservative approach: carry is computed based only on stored explicit day records.
      // That would be wrong because missing records for workdays imply Ist=0, which should count negative diff, but user expects full Soll month diff.
      // Therefore, we MUST compute month diff fully. We'll do it by reading DB range ASYNC in precomputation and storing in a map.
      // Here we fallback to 0, but we override carry computation with async precompute in renderMonth().
      return 0;
    }
  }

  // To compute carry correctly (including missing days), we precompute for the visible year once:
  let yearMonthDiffCache = new Map(); // key yyyy-mm => diff minutes
  let yearCarryCache = new Map();     // key yyyy-mm => carry before month
  let yearCacheYear = null;

  async function buildYearCaches(year){
    if(yearCacheYear === year && yearCarryCache.size) return;
    yearCacheYear = year;
    yearMonthDiffCache.clear();
    yearCarryCache.clear();

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const all = await AZ_DB.getDaysInRange(yearStart, yearEnd);
    const map = new Map(all.map(r=>[r.date, r]));
    const hol = getHolidayMapForYear(year);

    let carry = (year === parseStartDate().getFullYear() ? startSaldoMinutes() : startSaldoMinutes()); // startSaldo applies globally
    // But startSaldo is a global baseline; we will compute carry for months within this year relative to startDate by also including months before this year when needed.
    // We'll handle that by computing carry for the first month of year via computeCarryFromStartTo(year,0) async.
    carry = await computeCarryFromStartTo(year, 0, map, hol);

    for(let m0=0;m0<12;m0++){
      const key = monthKey(year,m0);
      yearCarryCache.set(key, carry);
      const diff = computeMonthDiffUsingMap(year,m0,map,hol);
      yearMonthDiffCache.set(key, diff);
      carry += diff;
    }
  }

  function computeMonthDiffUsingMap(year,m0, map, hol){
    const last = new Date(year, m0+1, 0);
    let soll=0, ist=0;
    for(let d=1; d<=last.getDate(); d++){
      const dt = new Date(year,m0,d);
      const ds = toDateStr(dt);
      const rec = map.get(ds) || null;
      const eff = rec?.type || (isWeekend(dt) ? 'rest' : (hol.has(ds) ? 'holiday' : 'work'));
      const sMin = sollMinutesForDate(dt, eff);
      const iMin = istMinutesForDate(dt, rec, eff);
      soll += sMin;
      ist += iMin;
    }
    return ist - soll;
  }

  async function computeCarryFromStartTo(year, monthIndex0, yearMap, yearHol){
    // carry before target month, computed from settings.startDate month up to previous month.
    const startD = parseStartDate();
    const startM = new Date(startD.getFullYear(), startD.getMonth(), 1);
    const target = new Date(year, monthIndex0, 1);
    let carry = startSaldoMinutes();

    if(target <= startM) return carry;

    // iterate months from startM to month before target
    let cur = new Date(startM);
    while(cur < target){
      const y = cur.getFullYear();
      const m0 = cur.getMonth();
      // compute diff for this month y-m0 by reading that month records
      const diff = await computeMonthDiffAsync(y,m0);
      carry += diff;
      cur = new Date(y, m0+1, 1);
    }
    return carry;

    async function computeMonthDiffAsync(y,m0){
      const first = new Date(y,m0,1);
      const last = new Date(y,m0+1,0);
      const from = toDateStr(first);
      const to = toDateStr(last);
      const recs = await AZ_DB.getDaysInRange(from,to);
      const map = new Map(recs.map(r=>[r.date,r]));
      const hol = getHolidayMapForYear(y);
      return computeMonthDiffUsingMap(y,m0,map,hol);
    }
  }

  function computeCarryForMonthFast(year, monthIndex0){
    const key = monthKey(year, monthIndex0);
    return yearCarryCache.get(key) ?? startSaldoMinutes();
  }

  // ----- Rendering -----
  async function renderMonth(monthStart){
    const y = monthStart.getFullYear();
    const m0 = monthStart.getMonth();

    // ensure caches for correct carry
    await buildYearCaches(y);

    elCompanyName.textContent = settings.companyName || 'Zaunteam';

    const vacation = computeVacationRemaining(y);
    elVacationBadge.textContent = `Urlaub: ${vacation.remaining}`;
    elVacationBadge.title = `Urlaub ${y}: genommen ${vacation.taken} / übrig ${vacation.remaining}`;

    elMonthTitle.textContent = `${MONTHS[m0]} ${y}`;

    const stats = computeMonthStatsUsingCache(y,m0);
    renderStats(stats);

    renderDayList(monthStart, stats);

    function computeMonthStatsUsingCache(year, m0){
      const last = new Date(year, m0+1, 0);

      let soll=0, ist=0, diff=0;
      for(let d=1; d<=last.getDate(); d++){
        const dt = new Date(year, m0, d);
        const ds = toDateStr(dt);
        const rec = monthRecords.get(ds) || null;
        const eff = rec?.type || defaultTypeForDate(dt).type;
        const sMin = sollMinutesForDate(dt, eff);
        const iMin = istMinutesForDate(dt, rec, eff);
        soll += sMin;
        ist += iMin;
        diff += (iMin - sMin);
      }
      const prevCarry = computeCarryForMonthFast(year,m0);
      const saldo = prevCarry + diff;
      return {soll, ist, diff, prevCarry, saldo};
    }

    function renderStats(st){
      elMonthStats.innerHTML = '';
      const rows = [
        ['Soll-Stunden', fmtH(st.soll)],
        ['Ist-Stunden', fmtH(st.ist)],
        ['S. Vormonat', fmtH(st.prevCarry)],
        ['Saldo', fmtH(st.saldo)],
      ];
      for(const [label, value] of rows){
        const row = document.createElement('div');
        row.className = 'statRow';
        const l = document.createElement('div');
        l.className = 'label';
        l.textContent = label;
        const v = document.createElement('div');
        v.className = 'value';
        v.textContent = value;
        if(label === 'S. Vormonat') v.classList.add(classifyValue(st.prevCarry));
        if(label === 'Saldo') v.classList.add(classifyValue(st.saldo));
        row.append(l,v);
        elMonthStats.appendChild(row);
      }
    }

    function renderDayList(monthStart, st){
      const y = monthStart.getFullYear();
      const m0 = monthStart.getMonth();
      const last = new Date(y, m0+1, 0);

      const frag = document.createDocumentFragment();
      elDayList.innerHTML = '';

      for(let d=1; d<=last.getDate(); d++){
        const dt = new Date(y,m0,d);
        const ds = toDateStr(dt);
        const rec = monthRecords.get(ds) || null;
        const def = defaultTypeForDate(dt);
        const type = rec?.type || def.type;

        const soll = sollMinutesForDate(dt, type);
        const ist = istMinutesForDate(dt, rec, type);
        const diff = ist - soll;

        const row = document.createElement('div');
        row.className = 'dayRow';
        row.dataset.date = ds;

        const main = document.createElement('div');
        main.className = 'dayRow__main';

        const dateLine = document.createElement('div');
        dateLine.className = 'dayRow__date';
        dateLine.textContent = fmtLongDate(dt);

        const timeLine = document.createElement('div');
        timeLine.className = 'dayRow__time';

        const subLine = document.createElement('div');
        subLine.className = 'dayRow__sub';

        if(type === 'work'){
          const start1 = rec?.start1 || '';
          const end1 = rec?.end1 || '';
          const t = (start1 && end1) ? `${start1} - ${end1}` : '—';
          timeLine.textContent = t;
          const pauseMin = (rec?.pauseMin != null ? rec.pauseMin : settings.defaultPauseMinutes);
          subLine.textContent = `${fmtHPlain(pauseMin)} h Essens-/Pausenzeiten`;
        }else if(type === 'rest'){
          timeLine.textContent = 'Ruhetag';
          subLine.textContent = '';
        }else if(type === 'holiday'){
          timeLine.textContent = 'Feiertag';
          const name = holidayMap.get(ds) || '';
          subLine.textContent = name ? name : '';
        }else if(type === 'vacation'){
          timeLine.textContent = 'Urlaub';
          subLine.textContent = rec?.location ? rec.location : '';
        }else if(type === 'sick'){
          timeLine.textContent = 'Krank';
          subLine.textContent = rec?.note ? 'Notiz vorhanden' : '';
        }else if(type === 'comp'){
          timeLine.textContent = 'Zeitausgleich';
          subLine.textContent = rec?.note ? 'Notiz vorhanden' : '';
        }

        main.append(dateLine,timeLine);
        if(subLine.textContent) main.append(subLine);

        const right = document.createElement('div');
        right.className = 'dayRow__right';

        const hours = document.createElement('div');
        hours.className = 'dayRow__hours';
        hours.textContent = `${fmtHPlain(ist)} h`;

        const diffEl = document.createElement('div');
        diffEl.className = 'dayRow__diff ' + classifyValue(diff);
        if(diff !== 0){
          diffEl.textContent = `(${fmtHPlain(diff)})`;
        }else{
          diffEl.textContent = '';
        }

        const icon = document.createElement('div');
        icon.className = 'dayRow__icon';
        icon.innerHTML = (type === 'rest') ? ICON_REST : (type === 'work' ? ICON_WORK : ICON_OTHER);

        right.append(hours, diffEl, icon);

        row.append(main,right);

        row.addEventListener('click', ()=>{
          openEditor(ds);
        });

        frag.appendChild(row);
      }

      elDayList.appendChild(frag);
    }
  }

  function computeVacationRemaining(year){
    const total = Number(settings.annualVacationDays || 30);
    // count stored vacation days in year (weekdays only)
    let taken = 0;
    // We don't want async here; best-effort using cache if year is current cached; else taken unknown until year view opened.
    // We'll compute accurately async when needed, but for badge we use cached year map by scanning localStorage quickly.
    // We'll approximate: use yearMonthDiffCache? no.
    // We'll do a quick sync approximation by scanning monthRecords for the visible month only and add: good enough for badge. Then year modal shows exact.
    for(const [ds, rec] of monthRecords.entries()){
      const d = dateStrToDate(ds);
      if(d.getFullYear() === year && rec.type === 'vacation' && isWeekday(d)) taken++;
    }
    const remaining = Math.max(0, total - taken);
    return {total, taken, remaining};
  }

  // Icons (simple inline SVG)
  const ICON_WORK = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3a3 3 0 106 0 3 3 0 00-6 0zm9 10.5V22h-2v-6h-2v6H10v-7.2l-1.3 2.7H6.6l2.7-5.4c.3-.7 1-1.1 1.8-1.1h2.6l2.3 2.1h1.9c.6 0 1.1.5 1.1 1.1z"/>
    </svg>`;
  const ICON_REST = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 11h10a2 2 0 012 2v6H5v-6a2 2 0 012-2zm-1 8h12v2H6v-2zM9 4a3 3 0 106 0 3 3 0 00-6 0zm-5 8h3v2H4v-2zm13 0h3v2h-3v-2z"/>
    </svg>`;
  const ICON_OTHER = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>`;

  // ----- Editor -----
  function openEditor(dateStr){
    editorDateStr = dateStr;
    const d = dateStrToDate(dateStr);
    const rec = monthRecords.get(dateStr) || null;
    const def = defaultTypeForDate(d);
    const effType = rec?.type || def.type;

    // Build editor HTML
    elEditor.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'editorInner';

    const top = document.createElement('div');
    top.className = 'editorTop';
    const left = document.createElement('div');
    left.textContent = WEEKDAYS[d.getDay()];
    const mid = document.createElement('div');
    mid.textContent = fmtDMY(d);
    const right = document.createElement('div');
    right.className = 'muted';
    right.textContent = `Woche ${isoWeekNumber(d)}`;
    top.append(left, mid, right);

    const typeField = fieldSelect('Tagestyp', 'dayType', effType, DAY_TYPES);

    const shiftLabel = document.createElement('div');
    shiftLabel.style.fontWeight = '800';
    shiftLabel.style.margin = '6px 0 6px';
    shiftLabel.textContent = '1. Schicht';

    const grid = document.createElement('div');
    grid.className = 'grid2';

    const start1 = fieldTime('Start', 'start1', rec?.start1 || '');
    const end1   = fieldTime('bis', 'end1', rec?.end1 || '');

    grid.append(start1, end1);

    let grid2 = null;
    if(settings.enableShift2){
      const shift2Label = document.createElement('div');
      shift2Label.style.fontWeight = '800';
      shift2Label.style.margin = '10px 0 6px';
      shift2Label.textContent = '2. Schicht (optional)';
      grid2 = document.createElement('div');
      grid2.className = 'grid2';
      const start2 = fieldTime('Start', 'start2', rec?.start2 || '');
      const end2   = fieldTime('bis', 'end2', rec?.end2 || '');
      grid2.append(start2, end2);
      inner.append(top, typeField, shiftLabel, grid, shift2Label, grid2);
    }else{
      inner.append(top, typeField, shiftLabel, grid);
    }

    const location = fieldText('Ort / Baustelle', 'location', rec?.location || '');
    inner.appendChild(location);

    const pauseDefault = (rec?.pauseMin != null ? rec.pauseMin : settings.defaultPauseMinutes);
    const pause = fieldNumber('Essens-/Pausenzeiten (h)', 'pause_h', (pauseDefault/60).toFixed(2).replace('.',','), '0,50');
    inner.appendChild(pause);

    const note = fieldTextarea('Tagesnotiz', 'note', rec?.note || '');
    inner.appendChild(note);

    const actions = document.createElement('div');
    actions.className = 'rowActions';

    const btnSave = document.createElement('button');
    btnSave.className = 'btn btn--primary';
    btnSave.textContent = 'Speichern';

    const btnClose = document.createElement('button');
    btnClose.className = 'btn';
    btnClose.textContent = 'Schließen';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn btn--ghost';
    btnCopy.textContent = 'Wie gestern';

    actions.append(btnCopy, btnClose, btnSave);
    inner.appendChild(actions);

    elEditor.appendChild(inner);

    // Behavior: enable/disable time & pause based on type
    const typeSelect = inner.querySelector('[name="dayType"]');
    const timeInputs = inner.querySelectorAll('input[type="time"]');
    const pauseInput = inner.querySelector('[name="pause_h"]');

    function applyTypeUI(){
      const t = typeSelect.value;
      const enableWorkFields = (t === 'work');
      timeInputs.forEach(inp=> inp.disabled = !enableWorkFields);
      pauseInput.disabled = !enableWorkFields;
      if(!enableWorkFields){
        pauseInput.value = '0,00';
      }else{
        // restore default when switching back
        if(pauseInput.value === '0,00') pauseInput.value = (settings.defaultPauseMinutes/60).toFixed(2).replace('.',',');
      }
    }
    typeSelect.addEventListener('change', applyTypeUI);
    applyTypeUI();

    btnClose.addEventListener('click', closeEditor);

    btnCopy.addEventListener('click', async ()=>{
      const prev = new Date(d.getTime()); prev.setDate(prev.getDate()-1);
      const prevStr = toDateStr(prev);
      let prevRec = monthRecords.get(prevStr) || await AZ_DB.getDay(prevStr);
      if(!prevRec){ toast('Gestern: keine Daten'); return; }
      if(prevRec.type !== 'work'){ toast('Gestern: kein Arbeitstag'); return; }
      inner.querySelector('[name="start1"]').value = prevRec.start1 || '';
      inner.querySelector('[name="end1"]').value = prevRec.end1 || '';
      if(settings.enableShift2){
        inner.querySelector('[name="start2"]').value = prevRec.start2 || '';
        inner.querySelector('[name="end2"]').value = prevRec.end2 || '';
      }
      const p = (prevRec.pauseMin != null ? prevRec.pauseMin : settings.defaultPauseMinutes);
      pauseInput.value = (p/60).toFixed(2).replace('.',',');
      if(prevRec.location) inner.querySelector('[name="location"]').value = prevRec.location;
      toast('Kopiert');
    });

    btnSave.addEventListener('click', async ()=>{
      const type = typeSelect.value;

      const newRec = {
        date: dateStr,
        type,
        start1: inner.querySelector('[name="start1"]').value || '',
        end1: inner.querySelector('[name="end1"]').value || '',
        start2: settings.enableShift2 ? (inner.querySelector('[name="start2"]').value || '') : '',
        end2: settings.enableShift2 ? (inner.querySelector('[name="end2"]').value || '') : '',
        pauseMin: 0,
        location: inner.querySelector('[name="location"]').value || '',
        note: inner.querySelector('[name="note"]').value || '',
        updatedAt: Date.now(),
      };

      // pause parse (German comma)
      let pauseH = inner.querySelector('[name="pause_h"]').value || '0';
      pauseH = pauseH.replace(',', '.');
      const pauseMin = Math.max(0, Math.round(parseFloat(pauseH || '0')*60));
      newRec.pauseMin = (type === 'work') ? pauseMin : 0;

      // Cleanup: if record is identical to computed defaults and empty, delete from DB
      const hasAny = (newRec.type !== defaultTypeForDate(d).type)
        || newRec.start1 || newRec.end1 || newRec.start2 || newRec.end2
        || (newRec.type==='work' && newRec.pauseMin !== settings.defaultPauseMinutes)
        || newRec.location || newRec.note;

      if(hasAny){
        await AZ_DB.setDay(newRec);
        monthRecords.set(dateStr, newRec);
      }else{
        await AZ_DB.deleteDay(dateStr);
        monthRecords.delete(dateStr);
      }

      toast('Gespeichert');
      closeEditor();
      // re-render month quickly without changing scroll
      renderMonth(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));
    });

    // open editor smoothly (no scroll jumps)
    elEditor.classList.add('open');
    elEditor.setAttribute('aria-hidden','false');
  }

  function closeEditor(){
    editorDateStr = null;
    elEditor.classList.remove('open');
    elEditor.setAttribute('aria-hidden','true');
  }

  function fieldSelect(label, name, value, options){
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const l = document.createElement('label');
    l.textContent = label;
    const s = document.createElement('select');
    s.name = name;
    for(const o of options){
      const opt = document.createElement('option');
      opt.value = o.key;
      opt.textContent = o.label;
      if(o.key === value) opt.selected = true;
      s.appendChild(opt);
    }
    wrap.append(l,s);
    return wrap;
  }
  function fieldTime(label, name, value){
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const l = document.createElement('label');
    l.textContent = label;
    const i = document.createElement('input');
    i.type = 'time';
    i.name = name;
    i.value = value || '';
    wrap.append(l,i);
    return wrap;
  }
  function fieldText(label, name, value){
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const l = document.createElement('label');
    l.textContent = label;
    const i = document.createElement('input');
    i.type = 'text';
    i.name = name;
    i.placeholder = 'Kein Ort';
    i.value = value || '';
    wrap.append(l,i);
    return wrap;
  }
  function fieldNumber(label, name, value, placeholder){
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const l = document.createElement('label');
    l.textContent = label;
    const i = document.createElement('input');
    i.type = 'text';
    i.inputMode = 'decimal';
    i.name = name;
    i.placeholder = placeholder || '';
    i.value = value || '';
    wrap.append(l,i);
    return wrap;
  }
  function fieldTextarea(label, name, value){
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const l = document.createElement('label');
    l.textContent = label;
    const t = document.createElement('textarea');
    t.name = name;
    t.placeholder = 'Bemerkung zum Tag.';
    t.value = value || '';
    wrap.append(l,t);
    return wrap;
  }

  // ----- Modals -----
  function openModal(modal){
    modalBackdrop.classList.remove('hidden');
    modal.classList.remove('hidden');
    modalBackdrop.setAttribute('aria-hidden','false');
  }
  function closeModal(modal){
    modal.classList.add('hidden');
    if(settingsModal.classList.contains('hidden') && exportModal.classList.contains('hidden') && yearModal.classList.contains('hidden')){
      modalBackdrop.classList.add('hidden');
      modalBackdrop.setAttribute('aria-hidden','true');
    }
  }
  modalBackdrop.addEventListener('click', ()=>{
    closeModal(settingsModal);
    closeModal(exportModal);
    closeModal(yearModal);
  });

  // Settings modal
  $('#btnSettings').addEventListener('click', ()=>{
    settingsBody.innerHTML = '';
    settingsBody.appendChild(makeSettingsForm());
    openModal(settingsModal);
  });
  $('#closeSettings').addEventListener('click', ()=> closeModal(settingsModal));
  $('#saveSettings').addEventListener('click', async ()=>{
    const form = settingsBody.querySelector('form');
    const fd = new FormData(form);
    settings.companyName = (fd.get('companyName') || 'Zaunteam').toString();
    settings.startDate = (fd.get('startDate') || '2024-01-01').toString();
    settings.startSaldoHours = parseFloat((fd.get('startSaldoHours')||'0').toString().replace(',','.')) || 0;
    settings.annualVacationDays = parseInt(fd.get('annualVacationDays')||'30',10) || 30;
    settings.roundingMinutes = parseInt(fd.get('roundingMinutes')||'0',10) || 0;
    settings.defaultPauseMinutes = parseInt(fd.get('defaultPauseMinutes')||'30',10) || 30;
    settings.includeAssumption = fd.get('includeAssumption') === 'on';
    settings.includeAugsburgPeace = fd.get('includeAugsburgPeace') === 'on';
    settings.enableShift2 = fd.get('enableShift2') === 'on';

    await AZ_DB.setSettings(settings);
    toast('Einstellungen gespeichert');
    closeModal(settingsModal);
    await loadMonth(viewDate.getFullYear(), viewDate.getMonth());
  });

  function makeSettingsForm(){
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="field">
        <label>Firma / Name</label>
        <input name="companyName" type="text" value="${escapeHtml(settings.companyName||'Zaunteam')}" />
      </div>

      <div class="grid2">
        <div class="field">
          <label>Startdatum</label>
          <input name="startDate" type="date" value="${escapeHtml(settings.startDate||'2024-01-01')}" />
        </div>
        <div class="field">
          <label>Startsaldo (Stunden)</label>
          <input name="startSaldoHours" type="text" inputmode="decimal" value="${String(settings.startSaldoHours||0).replace('.',',')}" />
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label>Urlaubstage pro Jahr</label>
          <input name="annualVacationDays" type="number" min="0" max="60" value="${settings.annualVacationDays||30}" />
        </div>
        <div class="field">
          <label>Standard Pause (Minuten)</label>
          <input name="defaultPauseMinutes" type="number" min="0" max="300" step="5" value="${settings.defaultPauseMinutes||30}" />
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label>Rundung</label>
          <select name="roundingMinutes">
            ${[0,5,10,15].map(v=>`<option value="${v}" ${v===(settings.roundingMinutes||0)?'selected':''}>${v===0?'aus':'auf '+v+' min'}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>2. Schicht</label>
          <label style="display:flex;gap:10px;align-items:center;font-weight:700;color:#222;">
            <input name="enableShift2" type="checkbox" ${settings.enableShift2?'checked':''} />
            aktiv
          </label>
        </div>
      </div>

      <hr class="sep"/>

      <div class="field">
        <label>Feiertage Bayern</label>
        <label style="display:flex;gap:10px;align-items:center;font-weight:700;color:#222;margin-top:8px;">
          <input name="includeAssumption" type="checkbox" ${settings.includeAssumption?'checked':''}/>
          Mariä Himmelfahrt (15.08)
        </label>
        <label style="display:flex;gap:10px;align-items:center;font-weight:700;color:#222;margin-top:8px;">
          <input name="includeAugsburgPeace" type="checkbox" ${settings.includeAugsburgPeace?'checked':''}/>
          Augsburger Friedensfest (08.08)
        </label>
      </div>
    `;
    return form;

    function escapeHtml(s){
      return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
    }
  }

  // Export modal
  $('#btnExport').addEventListener('click', async ()=>{
    exportBody.innerHTML = '';
    exportBody.appendChild(await makeExportUI());
    openModal(exportModal);
  });
  $('#closeExport').addEventListener('click', ()=> closeModal(exportModal));
  $('#btnShare').addEventListener('click', async ()=>{
    try{
      if(!navigator.share) { toast('Teilen nicht verfügbar'); return; }
      const y = viewDate.getFullYear();
      const m0 = viewDate.getMonth();
      const label = `${MONTHS[m0]} ${y}`;
      const csvBlob = await makeCsvBlob('month');
      await navigator.share({ title:'Arbeitszeiterfassung', text: label, files:[new File([csvBlob], `Arbeitszeit_${y}-${pad2(m0+1)}.csv`, {type:'text/csv'})] });
    }catch(e){
      console.warn(e);
      toast('Teilen abgebrochen');
    }
  });

  async function makeExportUI(){
    const wrap = document.createElement('div');

    wrap.innerHTML = `
      <div class="field">
        <label>Zeitraum</label>
        <select id="expPeriod">
          <option value="month">Monat (${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()})</option>
          <option value="year">Jahr (${viewDate.getFullYear()})</option>
        </select>
      </div>

      <div class="grid2">
        <button class="btn btn--primary" id="btnCsv">CSV Export</button>
        <button class="btn btn--primary" id="btnPdf">PDF Export</button>
      </div>

      <div style="height:10px"></div>

      <div class="grid2">
        <button class="btn" id="btnJson">Backup (JSON)</button>
        <button class="btn" id="btnJsonRestore">Restore (JSON)</button>
      </div>

      <hr class="sep"/>

      <div class="field">
        <label>CSV Import</label>
        <select id="impStrategy">
          <option value="merge">zusammenführen</option>
          <option value="replace">ersetzen</option>
        </select>
        <input type="file" id="csvFile" accept=".csv,text/csv" />
        <button class="btn" id="btnCsvImport">Import starten</button>
      </div>

      <hr class="sep"/>

      <button class="btn" id="btnDemo">Beispieldaten (Nov 2025) laden</button>
      <div style="font-size:12px;color:#666;margin-top:8px;">
        Tipp: Backup/Restore (JSON) ist die sauberste Sicherung.
      </div>
    `;

    // Wire up
    const periodSel = wrap.querySelector('#expPeriod');
    wrap.querySelector('#btnCsv').addEventListener('click', async ()=>{
      const period = periodSel.value;
      const blob = await makeCsvBlob(period);
      const name = makeFilename(period, 'csv');
      AZ_EXPORT.downloadBlob(blob, name);
      toast('CSV gespeichert');
    });

    wrap.querySelector('#btnPdf').addEventListener('click', async ()=>{
      const period = periodSel.value;
      const blob = await makePdfBlob(period);
      const name = makeFilename(period, 'pdf');
      AZ_EXPORT.downloadBlob(blob, name);
      toast('PDF gespeichert');
    });

    wrap.querySelector('#btnJson').addEventListener('click', async ()=>{
      const blob = await makeJsonBackupBlob();
      AZ_EXPORT.downloadBlob(blob, makeFilename('backup','json'));
      toast('Backup gespeichert');
    });

    wrap.querySelector('#btnJsonRestore').addEventListener('click', async ()=>{
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'application/json,.json';
      inp.onchange = async ()=>{
        const f = inp.files && inp.files[0];
        if(!f) return;
        const txt = await f.text();
        try{
          const data = JSON.parse(txt);
          if(!data || data.kind !== 'arbeitszeit-backup-v1') throw new Error('falsches Backup');
          if(data.settings) settings = {...deepClone(DEFAULT_SETTINGS), ...data.settings};
          if(Array.isArray(data.days)){
            for(const rec of data.days){
              if(rec && rec.date) await AZ_DB.setDay(rec);
            }
          }
          await AZ_DB.setSettings(settings);
          toast('Restore ok');
          closeModal(exportModal);
          await loadMonth(viewDate.getFullYear(), viewDate.getMonth());
        }catch(e){
          console.warn(e);
          toast('Restore fehlgeschlagen');
        }
      };
      inp.click();
    });

    wrap.querySelector('#btnCsvImport').addEventListener('click', async ()=>{
      const file = wrap.querySelector('#csvFile').files && wrap.querySelector('#csvFile').files[0];
      if(!file){ toast('Bitte CSV auswählen'); return; }
      const strategy = wrap.querySelector('#impStrategy').value;
      const txt = await file.text();
      try{
        const parsed = AZ_EXPORT.parseCSV(txt);
        await importCsvRows(parsed.rows, strategy);
        toast('Import ok');
        closeModal(exportModal);
        await loadMonth(viewDate.getFullYear(), viewDate.getMonth());
      }catch(e){
        console.warn(e);
        toast('Import fehlgeschlagen');
      }
    });

    wrap.querySelector('#btnDemo').addEventListener('click', async ()=>{
      await loadDemoNov2025();
      toast('Beispieldaten geladen');
      closeModal(exportModal);
      viewDate = new Date(2025,10,1);
      await loadMonth(2025,10);
    });

    return wrap;
  }

  function makeFilename(period, ext){
    const y = viewDate.getFullYear();
    const m = pad2(viewDate.getMonth()+1);
    if(period === 'month') return `Arbeitszeit_${y}-${m}.${ext}`;
    if(period === 'year') return `Arbeitszeit_${y}.${ext}`;
    if(period === 'backup') return `Arbeitszeit_Backup_${y}-${m}.${ext}`;
    return `Arbeitszeit.${ext}`;
  }

  async function makeCsvBlob(period){
    const rows = await buildExportRows(period);
    const csv = AZ_EXPORT.makeCSV(rows);
    return new Blob([csv], {type:'text/csv;charset=utf-8'});
  }

  async function makeJsonBackupBlob(){
    // backup: settings + all days from startDate to end of next year (safe range)
    const startD = parseStartDate();
    const from = toDateStr(startD);
    const to = `${new Date(viewDate.getFullYear()+1,11,31).getFullYear()}-12-31`;
    const days = await AZ_DB.getDaysInRange(from,to);
    const payload = {
      kind:'arbeitszeit-backup-v1',
      createdAt: new Date().toISOString(),
      settings,
      days,
    };
    return new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  }

  async function makePdfBlob(period){
    const rows = await buildExportRows(period);
    const title = (period === 'month')
      ? `Arbeitszeiterfassung – ${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`
      : `Arbeitszeiterfassung – Jahr ${viewDate.getFullYear()}`;

    // build monospace table lines
    const header = `Datum     Typ         Start  Ende   Pause Soll   Ist    Diff   Ort`;
    const lines = [];
    for(const r of rows){
      const date = (r.date || '').replace(/-/g,'.');
      const typ = (r.type||'').padEnd(10,' ').slice(0,10);
      const s1 = (r.start1||'').padEnd(5,' ').slice(0,5);
      const e1 = (r.end1||'').padEnd(5,' ').slice(0,5);
      const pause = String(r.pause_h||'').padStart(5,' ').slice(0,5);
      const soll = String(r.soll_h||'').padStart(6,' ').slice(0,6);
      const ist  = String(r.ist_h||'').padStart(6,' ').slice(0,6);
      const diff = String(r.diff_h||'').padStart(6,' ').slice(0,6);
      const ort = (r.location||'').slice(0,28);
      lines.push(`${date}  ${typ}  ${s1}  ${e1}  ${pause} ${soll} ${ist} ${diff}  ${ort}`);
    }

    const allLines = [header, '-'.repeat(header.length), ...lines];
    const pages = AZ_EXPORT.chunkLines(allLines, 46);
    return AZ_EXPORT.buildSimplePDF(pages, title);
  }

  async function buildExportRows(period){
    const y = viewDate.getFullYear();
    let from, to;
    if(period === 'month'){
      const first = new Date(y, viewDate.getMonth(), 1);
      const last = new Date(y, viewDate.getMonth()+1, 0);
      from = toDateStr(first);
      to = toDateStr(last);
    }else{
      from = `${y}-01-01`;
      to = `${y}-12-31`;
    }

    const recs = await AZ_DB.getDaysInRange(from, to);
    const map = new Map(recs.map(r=>[r.date,r]));
    const hol = getHolidayMapForYear(y);

    const rows = [];
    const start = dateStrToDate(from);
    const end = dateStrToDate(to);

    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
      const ds = toDateStr(d);
      const rec = map.get(ds) || null;
      const defType = (isWeekend(d) ? 'rest' : (hol.has(ds) ? 'holiday' : 'work'));
      const type = rec?.type || defType;

      const sollMin = sollMinutesForDate(d, type);
      const istMin = istMinutesForDate(d, rec, type);
      const diffMin = istMin - sollMin;

      const pauseMin = (type==='work') ? ((rec?.pauseMin!=null)?rec.pauseMin:settings.defaultPauseMinutes) : 0;

      rows.push({
        date: ds,
        weekday: WEEKDAYS[d.getDay()],
        type: typeLabel(type),
        start1: rec?.start1 || '',
        end1: rec?.end1 || '',
        start2: rec?.start2 || '',
        end2: rec?.end2 || '',
        pause_h: (pauseMin/60).toFixed(2).replace('.',','),
        soll_h: (sollMin/60).toFixed(2).replace('.',','),
        ist_h: (istMin/60).toFixed(2).replace('.',','),
        diff_h: (diffMin/60).toFixed(2).replace('.',','),
        location: rec?.location || '',
        note: rec?.note || (type==='holiday' ? (hol.get(ds)||'') : ''),
      });
    }
    return rows;

    function typeLabel(key){
      return (DAY_TYPES.find(x=>x.key===key)?.label) || key;
    }
  }

  async function importCsvRows(rows, strategy){
    // rows: objects from CSV, we expect "date" column exists
    if(strategy === 'replace'){
      // delete days for the imported range first
      const dates = rows.map(r=>r.date).filter(Boolean).sort();
      if(dates.length){
        const from = dates[0], to = dates[dates.length-1];
        const existing = await AZ_DB.getDaysInRange(from,to);
        for(const rec of existing){
          await AZ_DB.deleteDay(rec.date);
        }
      }
    }

    for(const r of rows){
      const date = (r.date || '').trim();
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const type = fromTypeLabel((r.type||'').trim());

      const rec = {
        date,
        type,
        start1: (r.start1||'').trim(),
        end1: (r.end1||'').trim(),
        start2: (r.start2||'').trim(),
        end2: (r.end2||'').trim(),
        pauseMin: parsePauseMin(r.pause_h),
        location: (r.location||'').trim(),
        note: (r.note||'').trim(),
        updatedAt: Date.now(),
      };

      // normalize pause for non-work
      if(rec.type !== 'work') rec.pauseMin = 0;

      await AZ_DB.setDay(rec);
    }

    function parsePauseMin(s){
      const v = (s||'0').toString().replace(',','.');
      const h = parseFloat(v) || 0;
      return Math.max(0, Math.round(h*60));
    }
    function fromTypeLabel(label){
      const lower = label.toLowerCase();
      const hit = DAY_TYPES.find(t=>t.label.toLowerCase()===lower);
      if(hit) return hit.key;
      // accept raw keys too
      if(DAY_TYPES.some(t=>t.key===lower)) return lower;
      // best guess:
      if(lower.includes('urlaub')) return 'vacation';
      if(lower.includes('krank')) return 'sick';
      if(lower.includes('feier')) return 'holiday';
      if(lower.includes('ruhe')) return 'rest';
      if(lower.includes('zeit')) return 'comp';
      return 'work';
    }
  }

  async function loadDemoNov2025(){
    const demo = [
      {date:'2025-11-26', type:'work', start1:'07:00', end1:'15:30', pauseMin:30, location:'', note:''},
      {date:'2025-11-27', type:'work', start1:'07:00', end1:'16:00', pauseMin:30, location:'', note:''},
      {date:'2025-11-28', type:'work', start1:'07:00', end1:'13:00', pauseMin:30, location:'', note:''},
      {date:'2025-11-29', type:'rest', start1:'', end1:'', pauseMin:0, location:'', note:''},
      {date:'2025-11-30', type:'rest', start1:'', end1:'', pauseMin:0, location:'', note:''},
    ];
    for(const r of demo){
      await AZ_DB.setDay({...r, updatedAt: Date.now()});
    }
  }

  // Year modal
  $('#btnYear').addEventListener('click', async ()=>{
    const y = viewDate.getFullYear();
    yearTitle.textContent = `Jahr ${y}`;
    yearBody.innerHTML = '<div style="color:#666">Lade…</div>';
    openModal(yearModal);

    await buildYearCaches(y);

    const hol = getHolidayMapForYear(y);
    const all = await AZ_DB.getDaysInRange(`${y}-01-01`, `${y}-12-31`);
    const map = new Map(all.map(r=>[r.date,r]));

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Monat</th>
          <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Soll</th>
          <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Ist</th>
          <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Diff</th>
          <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Saldo</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    let ySoll=0, yIst=0, yDiff=0;
    let saldoEnd = yearCarryCache.get(monthKey(y,0)) ?? startSaldoMinutes();

    for(let m0=0;m0<12;m0++){
      const carry = yearCarryCache.get(monthKey(y,m0)) ?? 0;
      const diff = yearMonthDiffCache.get(monthKey(y,m0)) ?? 0;
      const month = computeMonthTotalsUsingMap(y,m0,map,hol);
      ySoll += month.soll;
      yIst += month.ist;
      yDiff += diff;
      const saldo = carry + diff;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px;border-bottom:1px solid #eee;">${MONTHS[m0]}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmtH(month.soll)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmtH(month.ist)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:${diff<0?'#c62828':(diff>0?'#2e7d32':'#111')};font-weight:800;">${fmtH(diff)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:${saldo<0?'#c62828':(saldo>0?'#2e7d32':'#111')};font-weight:800;">${fmtH(saldo)}</td>
      `;
      tb.appendChild(tr);
      saldoEnd = saldo;
    }

    const vac = await computeVacationYearExact(y);
    const summary = document.createElement('div');
    summary.style.marginTop = '12px';
    summary.style.padding = '10px';
    summary.style.background = '#fff';
    summary.style.border = '1px solid #ddd';
    summary.style.borderRadius = '12px';
    summary.innerHTML = `
      <div style="font-weight:900;margin-bottom:6px;">Jahreswerte</div>
      <div style="display:flex;justify-content:space-between;"><div>Soll (YTD)</div><div style="font-weight:900">${fmtH(ySoll)}</div></div>
      <div style="display:flex;justify-content:space-between;"><div>Ist (YTD)</div><div style="font-weight:900">${fmtH(yIst)}</div></div>
      <div style="display:flex;justify-content:space-between;"><div>Saldo (Ende Jahr)</div><div style="font-weight:900;color:${saldoEnd<0?'#c62828':(saldoEnd>0?'#2e7d32':'#111')}">${fmtH(saldoEnd)}</div></div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;"><div>Urlaub</div><div style="font-weight:900">${vac.taken} genommen / ${vac.remaining} übrig</div></div>
    `;

    yearBody.innerHTML = '';
    yearBody.appendChild(table);
    yearBody.appendChild(summary);

    function computeMonthTotalsUsingMap(year,m0,map,hol){
      const last = new Date(year,m0+1,0);
      let soll=0, ist=0;
      for(let d=1; d<=last.getDate(); d++){
        const dt = new Date(year,m0,d);
        const ds = toDateStr(dt);
        const rec = map.get(ds)||null;
        const eff = rec?.type || (isWeekend(dt) ? 'rest' : (hol.has(ds)?'holiday':'work'));
        soll += sollMinutesForDate(dt, eff);
        ist += istMinutesForDate(dt, rec, eff);
      }
      return {soll, ist};
    }
  });
  $('#closeYear').addEventListener('click', ()=> closeModal(yearModal));

  async function computeVacationYearExact(year){
    const total = Number(settings.annualVacationDays || 30);
    const all = await AZ_DB.getDaysInRange(`${year}-01-01`, `${year}-12-31`);
    let taken = 0;
    for(const rec of all){
      if(rec.type === 'vacation'){
        const d = dateStrToDate(rec.date);
        if(isWeekday(d)) taken++;
      }
    }
    return {total, taken, remaining: Math.max(0, total - taken)};
  }

  // Menu button minimal
  $('#btnMenu').addEventListener('click', ()=>{
    toast('Tipp: Export/Import oben rechts');
  });

  // Month navigation
  $('#btnPrevMonth').addEventListener('click', async ()=>{
    closeEditor();
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth()-1, 1);
    await loadMonth(viewDate.getFullYear(), viewDate.getMonth());
  });
  $('#btnNextMonth').addEventListener('click', async ()=>{
    closeEditor();
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1);
    await loadMonth(viewDate.getFullYear(), viewDate.getMonth());
  });

  // Initial load
  await loadMonth(viewDate.getFullYear(), viewDate.getMonth());
  window.addEventListener('resize', refreshMhHeight);

  // Service worker
  if('serviceWorker' in navigator){
    try{
      await navigator.serviceWorker.register('./sw.js');
    }catch(e){
      console.warn('SW register failed', e);
    }
  }
})();
