/* app.js - main UI/logic */
(function(){
  'use strict';

  const APP_MIN_YEAR = 2025;

  const els = (id) => document.getElementById(id);

  const $dayList = els('dayList');
  const $dayEditor = els('dayEditor');
  const $monthLabel = els('monthLabel');
  const $companyName = els('companyName');

  const $statSoll = els('statSoll');
  const $statIst = els('statIst');
  const $statCarry = els('statCarry');
  const $statSaldo = els('statSaldo');

  const $editorTitle = els('editorTitle');
  const $editorWeek = els('editorWeek');
  const $editType = els('editType');
  const $editStart = els('editStart');
  const $editEnd = els('editEnd');
  const $editBreak = els('editBreak');
  const $editPlace = els('editPlace');
  const $editNote = els('editNote');

  const $settingsModal = els('settingsModal');
  const $importModal = els('importModal');
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
  const $setYearStartSaldo = els('setYearStartSaldo');
  const $holidayPreview = els('holidayPreview');
  const $updateInfo = els('updateInfo');

  // Import fields
  const $fileImportCsv = els('fileImportCsv');
  const $importMeta = els('importMeta');
  const $importPreview = els('importPreview');
  const $importMode = els('importMode');

  // state
  let settings = null;
  let current = { year: null, month: null }; // month 1..12
  let selectedDateKey = null;
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

    settings = { company, person, state, assumption: !!assumption, augsburg: !!augsburg, vacationPerYear: parseInt(vacationPerYear,10) || 30 };
  }

  async function saveSettings(){
    settings.company = ($setCompany.value || 'Zaunteam').trim();
    settings.person = ($setPerson.value || '').trim();
    settings.state = $setState.value || 'BY';
    settings.assumption = !!$setAssumption.checked;
    settings.augsburg = !!$setAugsburg.checked;
    settings.vacationPerYear = parseInt($setVacationPerYear.value,10) || 30;

    await AZDB.setSetting('company', settings.company);
    await AZDB.setSetting('person', settings.person);
    await AZDB.setSetting('state', settings.state);
    await AZDB.setSetting('assumption', settings.assumption);
    await AZDB.setSetting('augsburg', settings.augsburg);
    await AZDB.setSetting('vacationPerYear', settings.vacationPerYear);

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

    const ys = await getYearStartSaldo(current.year);
    $setYearStartSaldo.value = ys;

    await refreshHolidayPreview();
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
    const carry = await calcCarryToMonth(current.year, current.month);
    const startSaldo = carry;
    let sumSoll=0, sumIst=0, sumDiff=0;

    // build list
    $dayList.innerHTML = "";
    for(const key of dayKeys){
      const recNorm = normalizeRecord(key, map.get(key));
      const hours = calcDayHours(key, recNorm);
      sumSoll += hours.soll;
      sumIst += hours.ist;
      sumDiff += hours.diff;

      const d = toDateObj(key);
      const wname = WEEKDAYS[d.getDay()];
      const dd = pad2(d.getDate());
      const mm = pad2(d.getMonth()+1);
      const dateLabel = `${wname}, ${dd}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

      const el = document.createElement('div');
      el.className = "day-item";
      el.dataset.date = key;

      const left = document.createElement('div');
      left.className = "day-left";

      const line1 = document.createElement('div');
      line1.className = "d1";
      line1.textContent = dateLabel;

      const badge = document.createElement('span');
      badge.className = "badge";
      badge.textContent = typeLabel(recNorm.type, key);
      line1.appendChild(badge);

      const line2 = document.createElement('div');
      line2.className = "d2";
      if(recNorm.type === 'work'){
        if(recNorm.start && recNorm.end) line2.textContent = `${recNorm.start} - ${recNorm.end}`;
        else line2.textContent = "—";
      }else if(recNorm.type === 'rest'){
        line2.textContent = "Ruhetag";
      }else{
        // holiday/vac/sick/comp
        const hn = recNorm.type === 'holiday' ? getHolidayNameIfAny(key) : null;
        line2.textContent = hn ? hn : typeLabel(recNorm.type, key);
      }

      const line3 = document.createElement('div');
      line3.className = "d3";
      if(recNorm.type === 'work'){
        const p = (recNorm.breakH ?? 0.5);
        line3.textContent = `${p.toFixed(2).replace('.',',')} h Essens-/Pausenzeiten`;
      }else{
        line3.textContent = "";
      }

      left.appendChild(line1);
      left.appendChild(line2);
      if(line3.textContent) left.appendChild(line3);

      const right = document.createElement('div');
      right.className = "day-right";
      const big = document.createElement('div');
      big.className = "hbig";
      big.textContent = `${hours.ist.toFixed(2).replace('.',',')} h`;

      const diff = document.createElement('div');
      diff.className = "hdiff";
      const diffTxt = `(${hours.diff.toFixed(2).replace('.',',')})`;
      diff.textContent = diffTxt;
      if(hours.diff > 0.005) diff.classList.add('good');
      else if(hours.diff < -0.005) diff.classList.add('bad');

      right.appendChild(big);
      right.appendChild(diff);

      el.appendChild(left);
      el.appendChild(right);

      el.addEventListener('click', ()=>openEditor(key));
      $dayList.appendChild(el);
    }

    // update month stats
    const saldo = startSaldo + sumDiff;
    $statSoll.textContent = formatHours(sumSoll);
    $statIst.textContent = formatHours(sumIst);
    $statCarry.textContent = formatHours(startSaldo);
    $statSaldo.textContent = formatHours(saldo);
    setGoodBad($statCarry, startSaldo);
    setGoodBad($statSaldo, saldo);

    // company
    $companyName.textContent = settings.company;

    // keep editor open if selected date within current month
    if(selectedDateKey && selectedDateKey.startsWith(`${current.year}-${pad2(current.month)}-`)){
      await openEditor(selectedDateKey, true);
    }else{
      closeEditor();
    }
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

  async function calcCarryToMonth(year, month){
    const startSaldoYear = await getYearStartSaldo(year);
    if(month <= 1) return startSaldoYear;
    // sum diffs of months 1..month-1
    let carry = startSaldoYear;
    for(let m=1; m<month; m++){
      const {diff} = await calcMonthDiff(year, m);
      carry += diff;
    }
    return carry;
  }

  async function calcMonthDiff(year, month){
    const dim = daysInMonth(year, month);
    const startKey = toKey(year, month, 1);
    const endKey = toKey(year, month, dim);
    const stored = await AZDB.getRange(startKey, endKey);
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

  // ---- Editor ----
  async function openEditor(dateKey, keepFocus=false){
    selectedDateKey = dateKey;
    const rec = await AZDB.getDay(dateKey);
    const norm = normalizeRecord(dateKey, rec);

    const d = toDateObj(dateKey);
    const wname = WEEKDAYS[d.getDay()];
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth()+1);
    $editorTitle.textContent = `${wname} ${dd}.${mm}.${d.getFullYear()}`;
    $editorWeek.textContent = `Woche ${isoWeekNumber(d)}`;

    $editType.value = norm.type;
    $editStart.value = norm.start;
    $editEnd.value = norm.end;
    $editBreak.value = (norm.type === 'work' ? (norm.breakH ?? 0.5) : 0);
    $editPlace.value = norm.place || "";
    $editNote.value = norm.note || "";

    applyEditorTypeRules();

    $dayEditor.classList.remove('hidden');
    if(!keepFocus){
      // avoid scroll jump; just ensure editor visible minimally
      // no auto scroll
    }
  }

  function closeEditor(){
    $dayEditor.classList.add('hidden');
    selectedDateKey = null;
  }

  function applyEditorTypeRules(){
    const t = $editType.value;
    const work = (t === 'work');
    $editStart.disabled = !work;
    $editEnd.disabled = !work;
    $editBreak.disabled = !work;
    if(work){
      if(!$editBreak.value) $editBreak.value = 0.5;
    }else{
      $editStart.value = "";
      $editEnd.value = "";
      $editBreak.value = 0;
    }
  }

  async function saveDay(){
    if(!selectedDateKey) return;
    const t = $editType.value || getDefaultType(selectedDateKey);
    const rec = {
      date: selectedDateKey,
      type: t,
      start: ($editStart.value || "").trim(),
      end: ($editEnd.value || "").trim(),
      breakH: Number($editBreak.value || 0),
      place: ($editPlace.value || "").trim(),
      note: ($editNote.value || "").trim(),
      updatedAt: Date.now()
    };
    if(!Number.isFinite(rec.breakH) || rec.breakH < 0) rec.breakH = 0;
    if(t !== 'work'){ rec.start=""; rec.end=""; rec.breakH = 0; }

    await AZDB.setDay(rec);
    toast("Gespeichert");
    await renderMonth();
  }

  async function copyYesterday(){
    if(!selectedDateKey) return;
    const d = toDateObj(selectedDateKey);
    d.setDate(d.getDate()-1);
    const yKey = toKey(d.getFullYear(), d.getMonth()+1, d.getDate());
    const prev = await AZDB.getDay(yKey);
    const normPrev = normalizeRecord(yKey, prev);
    // copy only times/pause/place; do not force type
    $editStart.value = normPrev.start || "";
    $editEnd.value = normPrev.end || "";
    $editBreak.value = normPrev.breakH ?? 0.5;
    if(normPrev.place) $editPlace.value = normPrev.place;
    toast("Wie gestern übernommen");
  }

  // ---- Year view ----
  async function openYearView(){
    $dayEditor.classList.add('hidden');
    $dayList.classList.add('hidden');
    $yearView.classList.remove('hidden');

    const year = current.year;
    $yearTitle.textContent = `Jahr ${year}`;
    $yearCards.innerHTML = "";

    let ySoll=0, yIst=0, yDiff=0;
    let vacationUsed=0;

    for(let m=1; m<=12; m++){
      const {soll, ist, diff} = await calcMonthDiff(year, m);
      ySoll += soll; yIst += ist; yDiff += diff;

      const carry = await calcCarryToMonth(year, m);
      const saldo = carry + diff;

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
        renderMonth();
      });
      $yearCards.appendChild(card);
    }

    // vacation used
    const all = await AZDB.getRange(toKey(year,1,1), toKey(year,12,31));
    for(const r of all){
      if(r.type === 'vac'){
        const key = r.date;
        if(baseSollHours(key) > 0) vacationUsed++;
      }
    }
    const vacLeft = Math.max(0, settings.vacationPerYear - vacationUsed);
    const startSaldo = await getYearStartSaldo(year);
    const ySaldo = startSaldo + yDiff;

    $yearSummary.innerHTML = `
      <div><b>Jahres-Soll:</b> ${AZExport.formatNum(ySoll)} h</div>
      <div><b>Jahres-Ist:</b> ${AZExport.formatNum(yIst)} h</div>
      <div><b>Jahres-Diff:</b> <span class="${yDiff>0.005?'good':yDiff<-0.005?'bad':''}"><b>${AZExport.formatNum(yDiff)} h</b></span></div>
      <div><b>Startsaldo Jahr:</b> ${AZExport.formatNum(startSaldo)} h</div>
      <div><b>Jahres-Saldo:</b> <span class="${ySaldo>0.005?'good':ySaldo<-0.005?'bad':''}"><b>${AZExport.formatNum(ySaldo)} h</b></span></div>
      <hr />
      <div><b>Urlaub:</b> ${vacationUsed} genommen / ${vacLeft} übrig (von ${settings.vacationPerYear})</div>
    `;
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
          pause_h: AZExport.formatNum(rec.type==='work' ? (rec.breakH ?? 0.5) : 0),
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

  async function exportCsvMonth(){
    const y = current.year, m = current.month;
    const startKey = toKey(y,m,1);
    const endKey = toKey(y,m,daysInMonth(y,m));
    const rows = await buildRowsForRange(startKey, endKey);
    const csv = AZExport.buildCsv(rows);
    AZExport.downloadText(csv, `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_Monat_${y}-${pad2(m)}.csv`, 'text/csv;charset=utf-8');
    toast("CSV Monat exportiert");
  }

  async function exportCsvYear(){
    const y = current.year;
    const startKey = toKey(y,1,1);
    const endKey = toKey(y,12,31);
    const rows = await buildRowsForRange(startKey, endKey);
    const csv = AZExport.buildCsv(rows);
    AZExport.downloadText(csv, `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_Jahr_${y}.csv`, 'text/csv;charset=utf-8');
    toast("CSV Jahr exportiert");
  }

  async function exportPdfMonth(){
    const y = current.year, m = current.month;
    const startKey = toKey(y,m,1);
    const endKey = toKey(y,m,daysInMonth(y,m));
    const rows = await buildRowsForRange(startKey, endKey);
    const title = `Arbeitszeiterfassung – ${settings.company || 'Firma'}`;
    const subtitle = `${MONTHS[m-1]} ${y} – ${settings.person||''}`.trim();
    const lines = rows.map(r=> `${r.datum}  ${r.wochentag}  | ${r.typ} | ${r.start}-${r.ende} | Pause ${r.pause_h} | Soll ${r.soll_h} | Ist ${r.ist_h} | Diff ${r.diff_h} | ${r.ort} | ${r.notiz}` );
    const pdf = AZExport.createSimplePdf(title, subtitle, lines);
    AZExport.downloadBlob(pdf, `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_${y}-${pad2(m)}.pdf`);
    toast("PDF Monat exportiert");
  }

  async function exportPdfYear(){
    const y = current.year;
    const startKey = toKey(y,1,1);
    const endKey = toKey(y,12,31);
    const rows = await buildRowsForRange(startKey, endKey);
    const title = `Arbeitszeiterfassung – ${settings.company || 'Firma'}`;
    const subtitle = `Jahr ${y} – ${settings.person||''}`.trim();
    const lines = rows.map(r=> `${r.datum}  ${r.wochentag}  | ${r.typ} | ${r.start}-${r.ende} | Pause ${r.pause_h} | Soll ${r.soll_h} | Ist ${r.ist_h} | Diff ${r.diff_h} | ${r.ort} | ${r.notiz}` );
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
    AZExport.downloadText(JSON.stringify(out, null, 2), `${settings.person||'Arbeitszeit'}_${settings.company||'Firma'}_Backup.json`, 'application/json;charset=utf-8');
    toast("Backup gespeichert");
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
    pendingImport = { kind:'daily', rows, years, fileName: file.name };
    $importMeta.textContent = `Zeilen: ${rows.length} | Jahre: ${years.join(", ")} | Datei: ${file.name}`;
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
    lines.push(`Stundenübersicht eines Jahres`);
    lines.push(`Name: ${s.person || '—'}`);
    lines.push(`Firma: ${s.company || '—'}`);
    lines.push(`Jahr: ${s.year || '—'}`);
    lines.push(`Startsaldo (aus Januar S. Vormonat): ${AZExport.formatNum(s.yearStartSaldo || 0)} h`);
    lines.push(`Monate gefunden: ${Array.isArray(s.months)?s.months.length:0}`);
    if(Array.isArray(s.months) && s.months.length){
      lines.push("");
      lines.push("Carry pro Monat (S. Vormonat):");
      for(const m of s.months){
        const mn = String(m.name||"").padEnd(10,' ');
        lines.push(`${mn}  ${AZExport.formatNum(m.carry||0)} h`);
      }
    }
    lines.push("");
    lines.push("Hinweis: Diese CSV enthält keine Tages-Zeiten. Es wird nur Name/Firma + Startsaldo übernommen.");
    return lines.join("\n");
  }

  async function confirmImport(){
    if(!pendingImport) return;

    // 1) Jahres-CSV (nur Startsaldo + Name/Firma)
    if(pendingImport.kind === 'year_summary'){
      const s = pendingImport.summary;
      const y = parseInt(String(s.year||''), 10);
      if(!Number.isFinite(y) || y < APP_MIN_YEAR){
        toast("Jahr ungültig (min. 2025)");
        return;
      }

      const ys = Number(s.yearStartSaldo || 0);
      await AZDB.setSetting(getYearStartSaldoKey(y), Number.isFinite(ys) ? ys : 0);

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
    await renderMonth();
  }

  function closeImport(){ $importModal.classList.add('hidden'); pendingImport = null; }

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
      $updateInfo.textContent = "Update-Check fehlgeschlagen (offline?)";
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

      navigator.serviceWorker.addEventListener('controllerchange', ()=>{
        // new version active
        location.reload();
      });
    }).catch(()=>{ /* ignore */ });
  }

  // ---- Navigation ----
  function gotoToday(){
    const d = new Date();
    const y = Math.max(APP_MIN_YEAR, d.getFullYear());
    const m = d.getMonth()+1;
    current.year = y; current.month = m;
    selectedDateKey = toKey(y,m,d.getDate());
    renderMonth();
    // highlight in list
    setTimeout(()=>scrollToDay(selectedDateKey), 50);
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

    $editType.addEventListener('change', applyEditorTypeRules);
    els('btnSaveDay').addEventListener('click', saveDay);
    els('btnCloseDay').addEventListener('click', closeEditor);
    els('btnCopyYesterday').addEventListener('click', copyYesterday);

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
    els('btnBackupJson').addEventListener('click', backupJson);
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
