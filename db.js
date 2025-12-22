/* db.js - IndexedDB wrapper (offline, stable across updates) */
(function(){
  'use strict';

  const DB_NAME = 'az_pwa_db';
  const DB_VERSION = 1;
  const STORE_DAYS = 'days';
  const STORE_SETTINGS = 'settings';

  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(STORE_DAYS)){
          const s = db.createObjectStore(STORE_DAYS, { keyPath: 'date' }); // date: YYYY-MM-DD
          s.createIndex('byDate', 'date', {unique:true});
        }
        if(!db.objectStoreNames.contains(STORE_SETTINGS)){
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(store, mode, fn){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      Promise.resolve(fn(s)).then(r => { result = r; }).catch(reject);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  function getDateKey(d){ return d; }

  async function getDay(dateKey){
    return tx(STORE_DAYS, 'readonly', (s) => new Promise((res, rej) => {
      const req = s.get(getDateKey(dateKey));
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    }));
  }

  async function setDay(rec){
    // rec: {date, type, start, end, breakH, place, note, updatedAt}
    return tx(STORE_DAYS, 'readwrite', (s) => new Promise((res, rej) => {
      const req = s.put(rec);
      req.onsuccess = () => res(true);
      req.onerror = () => rej(req.error);
    }));
  }

  async function deleteDay(dateKey){
    return tx(STORE_DAYS, 'readwrite', (s) => new Promise((res, rej) => {
      const req = s.delete(getDateKey(dateKey));
      req.onsuccess = () => res(true);
      req.onerror = () => rej(req.error);
    }));
  }

  async function getRange(startKey, endKey){
    // inclusive range [startKey, endKey]
    return tx(STORE_DAYS, 'readonly', (s) => new Promise((res, rej) => {
      const out = [];
      const req = s.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if(cur){
          const k = cur.key;
          if(k >= startKey && k <= endKey) out.push(cur.value);
          cur.continue();
        }else{
          res(out);
        }
      };
      req.onerror = () => rej(req.error);
    }));
  }

  async function getAll(){
    return tx(STORE_DAYS, 'readonly', (s) => new Promise((res, rej) => {
      const req = s.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    }));
  }

  async function getSetting(key, fallback=null){
    return tx(STORE_SETTINGS, 'readonly', (s) => new Promise((res, rej) => {
      const req = s.get(key);
      req.onsuccess = () => res(req.result ? req.result.value : fallback);
      req.onerror = () => rej(req.error);
    }));
  }

  async function setSetting(key, value){
    return tx(STORE_SETTINGS, 'readwrite', (s) => new Promise((res, rej) => {
      const req = s.put({key, value});
      req.onsuccess = () => res(true);
      req.onerror = () => rej(req.error);
    }));
  }

  async function deleteSetting(key){
    return tx(STORE_SETTINGS, 'readwrite', (s) => new Promise((res, rej) => {
      const req = s.delete(key);
      req.onsuccess = () => res(true);
      req.onerror = () => rej(req.error);
    }));
  }

  async function cleanupBefore2025(){
    const cutoff = '2025-01-01';
    // delete day records before cutoff
    await tx(STORE_DAYS, 'readwrite', (s) => new Promise((res, rej) => {
      const req = s.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if(cur){
          if(cur.key < cutoff) cur.delete();
          cur.continue();
        }else res(true);
      };
      req.onerror = () => rej(req.error);
    }));
    // remove yearStartSaldo for years < 2025
    const keysToDelete = [];
    await tx(STORE_SETTINGS, 'readonly', (s) => new Promise((res, rej) => {
      const req = s.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if(cur){
          const k = cur.key;
          if(typeof k === 'string' && k.startsWith('yearStartSaldo_')){
            const yr = parseInt(k.slice('yearStartSaldo_'.length), 10);
            if(Number.isFinite(yr) && yr < 2025) keysToDelete.push(k);
          }
          cur.continue();
        }else res(true);
      };
      req.onerror = () => rej(req.error);
    }));
    for(const k of keysToDelete){
      await deleteSetting(k);
    }
  }

  window.AZDB = {
    openDB,
    getDay,
    setDay,
    deleteDay,
    getRange,
    getAll,
    getSetting,
    setSetting,
    deleteSetting,
    cleanupBefore2025
  };
})();
