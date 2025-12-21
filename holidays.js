/* holidays.js - Germany holiday engine (offline) with Bundesland selection */
(function(){
  'use strict';

  function pad2(n){ return String(n).padStart(2,'0'); }
  function toDateStr(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function addDays(d, days){
    const x = new Date(d.getTime());
    x.setDate(x.getDate()+days);
    return x;
  }

  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for Easter Sunday
  function easterSunday(year){
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19*a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2*e + 2*i - h - k) % 7;
    const m = Math.floor((a + 11*h + 22*l) / 451);
    const month = Math.floor((h + l - 7*m + 114) / 31); // 3=March,4=April
    const day = ((h + l - 7*m + 114) % 31) + 1;
    return new Date(year, month-1, day);
  }

  function repentanceDay(year){
    // Buß- und Bettag: Wednesday before Nov 23
    const nov23 = new Date(year, 10, 23); // month 10 = November
    const dow = nov23.getDay(); // 0=Sun..6=Sat
    // target Wednesday = 3
    let diff = dow - 3;
    if(diff < 0) diff += 7;
    // subtract diff days to get to Wednesday on/before Nov 23, but we need the Wednesday BEFORE Nov 23 (not on it if it's Wednesday?)
    // Rule says "the Wednesday before November 23". If Nov 23 is Wednesday, then it's Nov 16.
    if(dow === 3) diff = 7;
    return addDays(nov23, -diff);
  }

  const STATES = [
    {code:'BW', name:'Baden-Württemberg'},
    {code:'BY', name:'Bayern'},
    {code:'BE', name:'Berlin'},
    {code:'BB', name:'Brandenburg'},
    {code:'HB', name:'Bremen'},
    {code:'HH', name:'Hamburg'},
    {code:'HE', name:'Hessen'},
    {code:'MV', name:'Mecklenburg-Vorpommern'},
    {code:'NI', name:'Niedersachsen'},
    {code:'NW', name:'Nordrhein-Westfalen'},
    {code:'RP', name:'Rheinland-Pfalz'},
    {code:'SL', name:'Saarland'},
    {code:'SN', name:'Sachsen'},
    {code:'ST', name:'Sachsen-Anhalt'},
    {code:'SH', name:'Schleswig-Holstein'},
    {code:'TH', name:'Thüringen'},
  ];

  function getHolidaysForState(year, stateCode, opts){
    const map = new Map();
    const addFixed = (mm,dd,name)=> map.set(`${year}-${pad2(mm)}-${pad2(dd)}`, name);
    const addMov = (d,name)=> map.set(toDateStr(d), name);

    // Germany (nationwide) fixed
    addFixed(1,1,'Neujahr');
    addFixed(5,1,'Tag der Arbeit');
    addFixed(10,3,'Tag der Deutschen Einheit');
    addFixed(12,25,'1. Weihnachtstag');
    addFixed(12,26,'2. Weihnachtstag');

    // Germany (nationwide) movable (based on Easter)
    const eas = easterSunday(year);
    addMov(addDays(eas, -2), 'Karfreitag');
    addMov(addDays(eas,  1), 'Ostermontag');
    addMov(addDays(eas, 39), 'Christi Himmelfahrt');
    addMov(addDays(eas, 50), 'Pfingstmontag');

    const st = (stateCode || 'BY').toUpperCase();

    // State-specific fixed
    const wantsEpiphany = ['BW','BY','ST'].includes(st);
    const wantsWomensDay = ['BE','MV'].includes(st);
    const wantsAssumption = ['BY','SL'].includes(st);
    const wantsAllSaints = ['BW','BY','NW','RP','SL'].includes(st);
    const wantsReformation = ['BB','BE','HB','HH','MV','NI','SN','ST','SH','TH'].includes(st);
    const wantsWorldChild = (st === 'TH');

    if(wantsEpiphany) addFixed(1,6,'Heilige Drei Könige');
    if(wantsWomensDay) addFixed(3,8,'Internationaler Frauentag');
    if(wantsAllSaints) addFixed(11,1,'Allerheiligen');
    if(wantsReformation) addFixed(10,31,'Reformationstag');
    if(wantsWorldChild) addFixed(9,20,'Weltkindertag');

    // State-specific movable
    const wantsCorpusChristi = ['BW','BY','HE','NW','RP','SL'].includes(st);
    if(wantsCorpusChristi) addMov(addDays(eas, 60), 'Fronleichnam');

    if(st === 'SN') addMov(repentanceDay(year), 'Buß- und Bettag');

    // Options (local/special toggles)
    // Mariä Himmelfahrt is only a full public holiday in the Saarland,
    // and in parts of Bavaria. Keep as opt-in when state is BY (and optional in SL if user wants explicit control).
    if(opts && opts.includeAssumption && wantsAssumption){
      addFixed(8,15,'Mariä Himmelfahrt');
    } else if(st === 'SL' && wantsAssumption){
      // Saarland: Mariä Himmelfahrt is generally a public holiday.
      // Keep it enabled by default for SL unless user explicitly disables (opt can override)
      if(!(opts && opts.forceDisableAssumption)) addFixed(8,15,'Mariä Himmelfahrt');
    }

    // Augsburg Peace Festival is local (Augsburg city). Provide opt-in for BY.
    if(opts && opts.includeAugsburgPeace && st === 'BY'){
      addFixed(8,8,'Augsburger Friedensfest');
    }

    return map; // Map(dateStr => name)
  }

  window.AZ_HOLIDAYS = {
    STATES,
    easterSunday,
    repentanceDay,
    getHolidaysForState,
  };
})();
