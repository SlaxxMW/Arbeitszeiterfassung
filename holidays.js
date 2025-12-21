
/* holidays.js - Bavaria (Germany) holiday engine (offline) */
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

  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher)
  function easterSunday(year){
    const a = year % 19;
    const b = Math.floor(year/100);
    const c = year % 100;
    const d = Math.floor(b/4);
    const e = b % 4;
    const f = Math.floor((b+8)/25);
    const g = Math.floor((b-f+1)/3);
    const h = (19*a + b - d - g + 15) % 30;
    const i = Math.floor(c/4);
    const k = c % 4;
    const l = (32 + 2*e + 2*i - h - k) % 7;
    const m = Math.floor((a + 11*h + 22*l)/451);
    const month = Math.floor((h + l - 7*m + 114)/31); // 3=March,4=April
    const day = ((h + l - 7*m + 114) % 31) + 1;
    return new Date(year, month-1, day);
  }

  function fixedHolidayMap(year, opts){
    const map = new Map();
    function add(mm,dd,name){
      map.set(`${year}-${pad2(mm)}-${pad2(dd)}`, name);
    }
    // Germany wide (and Bavaria)
    add(1,1,'Neujahr');
    add(1,6,'Heilige Drei Könige');
    add(5,1,'Tag der Arbeit');
    add(10,3,'Tag der Deutschen Einheit');
    add(11,1,'Allerheiligen');
    add(12,25,'1. Weihnachtstag');
    add(12,26,'2. Weihnachtstag');

    if(opts && opts.includeAssumption) add(8,15,'Mariä Himmelfahrt');
    if(opts && opts.includeAugsburgPeace) add(8,8,'Augsburger Friedensfest');

    return map;
  }

  function movableHolidayMap(year){
    const map = new Map();
    const easter = easterSunday(year);
    map.set(toDateStr(addDays(easter,-2)), 'Karfreitag');
    map.set(toDateStr(addDays(easter,1)), 'Ostermontag');
    map.set(toDateStr(addDays(easter,39)), 'Christi Himmelfahrt');
    map.set(toDateStr(addDays(easter,50)), 'Pfingstmontag');
    map.set(toDateStr(addDays(easter,60)), 'Fronleichnam');
    return map;
  }

  function getBavariaHolidays(year, opts){
    const fixed = fixedHolidayMap(year, opts||{});
    const mov = movableHolidayMap(year);
    // merge
    for(const [k,v] of mov.entries()) fixed.set(k,v);
    return fixed; // Map(dateStr => name)
  }

  window.AZ_HOLIDAYS = {
    easterSunday,
    getBavariaHolidays,
  };
})();
