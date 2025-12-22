/* holidays.js - German public holidays by Bundesland (offline) */
(function(){
  'use strict';

  const STATES = [
    ["BW","Baden-Württemberg"],
    ["BY","Bayern"],
    ["BE","Berlin"],
    ["BB","Brandenburg"],
    ["HB","Bremen"],
    ["HH","Hamburg"],
    ["HE","Hessen"],
    ["MV","Mecklenburg-Vorpommern"],
    ["NI","Niedersachsen"],
    ["NW","Nordrhein-Westfalen"],
    ["RP","Rheinland-Pfalz"],
    ["SH","Schleswig-Holstein"],
    ["SL","Saarland"],
    ["SN","Sachsen"],
    ["ST","Sachsen-Anhalt"],
    ["TH","Thüringen"]
  ];

  function pad2(n){ return String(n).padStart(2,'0'); }
  function toKey(d){
    const y = d.getFullYear();
    const m = pad2(d.getMonth()+1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
  }
  function fromYMD(y,m,day){ return new Date(Date.UTC(y, m-1, day, 12,0,0)); } // noon UTC
  function addDays(date, days){
    const d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate()+days);
    return d;
  }

  // Meeus/Jones/Butcher algorithm (Gregorian)
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
    const month = Math.floor((h + l - 7*m + 114) / 31); // 3=March, 4=April
    const day = ((h + l - 7*m + 114) % 31) + 1;
    return fromYMD(year, month, day);
  }

  function bussUndBettag(year){
    // Wednesday before Nov 23
    const d = fromYMD(year, 11, 23);
    // getUTCDay(): 0=Sun..6=Sat, we need previous Wednesday (3)
    const wd = d.getUTCDay();
    let diff = (wd - 3);
    if(diff < 0) diff += 7;
    return addDays(d, -diff - 7); // Wednesday before the week containing 23rd
  }

  function isIn(list, state){ return list.indexOf(state) >= 0; }

  function holidaysForYear(year, state, opts){
    opts = opts || {};
    const map = new Map();

    const easter = easterSunday(year);
    // Common nationwide holidays
    map.set(toKey(fromYMD(year,1,1)), "Neujahr");
    map.set(toKey(fromYMD(year,5,1)), "Tag der Arbeit");
    map.set(toKey(fromYMD(year,10,3)), "Tag der Deutschen Einheit");
    map.set(toKey(fromYMD(year,12,25)), "1. Weihnachtstag");
    map.set(toKey(fromYMD(year,12,26)), "2. Weihnachtstag");

    // Easter-based nationwide
    map.set(toKey(addDays(easter,-2)), "Karfreitag");
    map.set(toKey(addDays(easter,1)), "Ostermontag");
    map.set(toKey(addDays(easter,39)), "Christi Himmelfahrt");
    map.set(toKey(addDays(easter,50)), "Pfingstmontag");

    // State-specific fixed
    if(isIn(["BW","BY","ST"], state)) map.set(toKey(fromYMD(year,1,6)), "Heilige Drei Könige");
    if(isIn(["BE","MV"], state)) map.set(toKey(fromYMD(year,3,8)), "Internationaler Frauentag");
    if(isIn(["TH"], state)) map.set(toKey(fromYMD(year,9,20)), "Weltkindertag");

    // Reformationstag (Oct 31)
    if(isIn(["BB","HB","HH","MV","NI","SN","ST","SH","TH"], state)) map.set(toKey(fromYMD(year,10,31)), "Reformationstag");

    // Allerheiligen (Nov 1)
    if(isIn(["BW","BY","NW","RP","SL"], state)) map.set(toKey(fromYMD(year,11,1)), "Allerheiligen");

    // Buß- und Bettag (SN)
    if(state === "SN") map.set(toKey(bussUndBettag(year)), "Buß- und Bettag");

    // Easter Sunday / Whit Sunday holidays in some states
    if(state === "BB") map.set(toKey(easter), "Ostersonntag");
    if(state === "BB") map.set(toKey(addDays(easter,49)), "Pfingstsonntag");

    // Corpus Christi (Fronleichnam) in some states
    if(isIn(["BW","BY","HE","NW","RP","SL"], state)) map.set(toKey(addDays(easter,60)), "Fronleichnam");

    // Mariä Himmelfahrt (15 Aug): SL always; BY optional
    if(state === "SL") map.set(toKey(fromYMD(year,8,15)), "Mariä Himmelfahrt");
    if(state === "BY" && opts.assumption) map.set(toKey(fromYMD(year,8,15)), "Mariä Himmelfahrt");

    // Augsburger Friedensfest (8 Aug) - only Augsburg (optional)
    if(state === "BY" && opts.augsburg) map.set(toKey(fromYMD(year,8,8)), "Augsburger Friedensfest");

    return map;
  }

  function getHolidayName(dateKey, state, opts){
    const y = parseInt(dateKey.slice(0,4), 10);
    const map = holidaysForYear(y, state, opts);
    return map.get(dateKey) || null;
  }

  window.AZHolidays = {
    STATES,
    easterSunday,
    holidaysForYear,
    getHolidayName
  };
})();
