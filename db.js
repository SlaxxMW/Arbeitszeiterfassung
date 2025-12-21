
/* db.js - minimal IndexedDB wrapper (offline-first) */
(function(){
  'use strict';

  const DB_NAME = 'arbeitszeit_db_v1';
  const DB_VERSION = 1;

  function openDB(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e)=>{
        const db = req.result;
        if(!db.objectStoreNames.contains('days')){
          db.createObjectStore('days', { keyPath:'date' });
        }
        if(!db.objectStoreNames.contains('meta')){
          db.createObjectStore('meta', { keyPath:'key' });
        }
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function withStore(storeName, mode, fn){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const res = fn(store);
      tx.oncomplete = ()=> resolve(res);
      tx.onerror = ()=> reject(tx.error);
      tx.onabort = ()=> reject(tx.error);
    });
  }

  async function getSettings(){
    try{
      const db = await openDB();
      return await new Promise((resolve, reject)=>{
        const tx = db.transaction('meta','readonly');
        const store = tx.objectStore('meta');
        const req = store.get('settings');
        req.onsuccess = ()=> resolve(req.result ? req.result.value : null);
        req.onerror = ()=> reject(req.error);
      });
    }catch(e){
      console.warn('IndexedDB not available, fallback to localStorage', e);
      const raw = localStorage.getItem('az_settings_v1');
      return raw ? JSON.parse(raw) : null;
    }
  }

  async function setSettings(value){
    try{
      await withStore('meta','readwrite',(store)=> store.put({key:'settings', value}));
    }catch(e){
      localStorage.setItem('az_settings_v1', JSON.stringify(value));
    }
  }

  async function getDay(date){
    try{
      const db = await openDB();
      return await new Promise((resolve, reject)=>{
        const tx = db.transaction('days','readonly');
        const store = tx.objectStore('days');
        const req = store.get(date);
        req.onsuccess = ()=> resolve(req.result || null);
        req.onerror = ()=> reject(req.error);
      });
    }catch(e){
      const raw = localStorage.getItem('az_day_'+date);
      return raw ? JSON.parse(raw) : null;
    }
  }

  async function setDay(record){
    if(!record || !record.date) throw new Error('Day record needs date');
    try{
      await withStore('days','readwrite',(store)=> store.put(record));
    }catch(e){
      localStorage.setItem('az_day_'+record.date, JSON.stringify(record));
    }
  }

  async function deleteDay(date){
    try{
      await withStore('days','readwrite',(store)=> store.delete(date));
    }catch(e){
      localStorage.removeItem('az_day_'+date);
    }
  }

  async function getDaysInRange(dateFrom, dateTo){
    // inclusive range
    try{
      const db = await openDB();
      return await new Promise((resolve, reject)=>{
        const tx = db.transaction('days','readonly');
        const store = tx.objectStore('days');
        const out = [];
        const req = store.openCursor();
        req.onsuccess = ()=>{
          const cur = req.result;
          if(cur){
            const k = cur.key;
            if(k >= dateFrom && k <= dateTo) out.push(cur.value);
            cur.continue();
          }else{
            resolve(out);
          }
        };
        req.onerror = ()=> reject(req.error);
      });
    }catch(e){
      // localStorage fallback (best-effort)
      const out = [];
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        if(key && key.startsWith('az_day_')){
          const date = key.substring('az_day_'.length);
          if(date >= dateFrom && date <= dateTo){
            try{ out.push(JSON.parse(localStorage.getItem(key))); }catch(_){}
          }
        }
      }
      return out;
    }
  }


  async function deleteDaysBefore(cutoffDateStr){
    // Deletes all day records with date < cutoffDateStr
    try{
      const db = await openDB();
      await new Promise((resolve, reject)=>{
        const tx = db.transaction('days','readwrite');
        const store = tx.objectStore('days');
        const req = store.openCursor();
        req.onsuccess = ()=>{
          const cur = req.result;
          if(cur){
            const k = cur.key;
            if(k < cutoffDateStr){
              cur.delete();
            }
            cur.continue();
          }else{
            resolve();
          }
        };
        req.onerror = ()=> reject(req.error);
      });
    }catch(e){
      // localStorage fallback
      const keys = [];
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        if(key && key.startsWith('az_day_')){
          const date = key.substring('az_day_'.length);
          if(date < cutoffDateStr) keys.push(key);
        }
      }
      keys.forEach(k=>localStorage.removeItem(k));
    }
  }

  // Expose
  window.AZ_DB = {
    getSettings, setSettings,
    getDay, setDay, deleteDay,
    getDaysInRange,
    deleteDaysBefore,
  };
})();
