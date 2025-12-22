/* export.js - CSV/PDF/JSON import-export */
(function(){
  'use strict';

  function pad2(n){ return String(n).padStart(2,'0'); }
  function formatHours(h){
    const sign = h < 0 ? "-" : "";
    const ah = Math.abs(h);
    return sign + ah.toFixed(2).replace(".", ",") + " h";
  }
  function formatNum(h){
    const sign = h < 0 ? "-" : "";
    const ah = Math.abs(h);
    return sign + ah.toFixed(2).replace(".", ",");
  }
  function parseGermanNumber(s){
    if(s==null) return null;
    const t = String(s).trim();
    if(!t) return null;
    const cleaned = t.replace(/\./g,'').replace(',', '.');
    const v = Number(cleaned);
    return Number.isFinite(v) ? v : null;
  }

  function isISODate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function parseDateKey(s){
    const t = String(s||"").trim();
    if(isISODate(t)) return t;
    const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if(m){
      const dd = pad2(parseInt(m[1],10));
      const mm = pad2(parseInt(m[2],10));
      const yy = m[3];
      return `${yy}-${mm}-${dd}`;
    }
    const m2 = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m2){
      const dd = pad2(parseInt(m2[1],10));
      const mm = pad2(parseInt(m2[2],10));
      const yy = m2[3];
      return `${yy}-${mm}-${dd}`;
    }
    return null;
  }

  function detectDelimiter(line){
    const counts = {
      ';': (line.match(/;/g)||[]).length,
      ',': (line.match(/,/g)||[]).length,
      '\t': (line.match(/\t/g)||[]).length
    };
    let best = ';', bestv = -1;
    for(const k of Object.keys(counts)){
      if(counts[k] > bestv){ bestv = counts[k]; best = k; }
    }
    return bestv <= 0 ? ';' : best;
  }

  function splitCsvLine(line, delim){
    const out=[];
    let cur="", inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch === '"'){
        if(inQ && line[i+1] === '"'){ cur += '"'; i++; }
        else inQ = !inQ;
      }else if(ch===delim && !inQ){
        out.push(cur); cur="";
      }else{
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(s=>s.trim());
  }

  function normalizeHeader(h){
    return String(h||"").trim().toLowerCase()
      .replace(/\s+/g,' ')
      .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
  }

  function mapType(v){
    const t = String(v||"").trim().toLowerCase();
    if(!t) return null;
    if(t.includes('urlaub')) return 'vac';
    if(t.includes('krank')) return 'sick';
    if(t.includes('feiert')) return 'holiday';
    if(t.includes('ruhe')) return 'rest';
    if(t.includes('zeitaus')) return 'comp';
    if(t.includes('arbeits')) return 'work';
    if(t === 'work') return 'work';
    return null;
  }

  function parseYearSummary(lines, delim){
    // Example:
    // Stundenübersicht eines Jahres Markus Wolf;2025;Zaunteam
    const first = splitCsvLine(lines[0], delim);
    const rawName = first[0] || "";
    const name = rawName.replace(/^Stundenübersicht eines Jahres/i,'').trim();
    const year = parseInt((first[1]||"").trim(),10);
    const company = (first[2]||"").trim();

    let headerIdx1 = -1;
    for(let i=0;i<lines.length;i++){
      const l = lines[i];
      if(/^Monat/i.test(l) && l.includes("Soll-Stunden") && l.includes("Ist-Stunden") && l.includes("S. Vormonat")){
        headerIdx1 = i;
        break;
      }
    }
    if(headerIdx1 < 0) return {errors:["Jahres-CSV erkannt, aber Monats-Header nicht gefunden."]};

    const header1Raw = splitCsvLine(lines[headerIdx1], delim);
    const header1 = header1Raw.map(normalizeHeader);
    const colMonth = header1.findIndex(h=>h==='monat');
    const colSoll = header1.findIndex(h=>h.includes('soll-stunden'));
    const colIst  = header1.findIndex(h=>h.includes('ist-stunden'));
    const colDiff = header1.findIndex(h=>h==='differenz' || h.includes('differenz'));
    const colCarry = header1.findIndex(h=>h.includes('s. vormonat') || h.includes('s.vormonat'));
    const colPaidOT = header1.findIndex(h=>h.includes('bezahlte') && h.includes('ueberstunden'));
    const colSaldo = header1.findIndex(h=>h==='saldo' || h.includes('saldo'));
    if(colMonth<0 || colSoll<0 || colIst<0 || colCarry<0) return {errors:["Monat/Soll/Ist/S. Vormonat Spalten fehlen."]};

    const monthMap = {
      "januar":1,"februar":2,"maerz":3,"märz":3,"april":4,"mai":5,"juni":6,"juli":7,
      "august":8,"september":9,"oktober":10,"november":11,"dezember":12
    };

    const months = [];
    let total = null;

    for(let i=headerIdx1+1;i<lines.length;i++){
      const l = lines[i];
      // second table begins
      if(/^Monat/i.test(l) && l.includes('Arbeitszeit') && l.includes('Ferien/Urlaub')) break;
      const cols = splitCsvLine(l, delim);
      if(cols.length < 2) continue;
      const mName = normalizeHeader(cols[colMonth]||"");
      const obj = {
        name: cols[colMonth],
        soll: parseGermanNumber(cols[colSoll]) ?? 0,
        ist: parseGermanNumber(cols[colIst]) ?? 0,
        diff: colDiff>=0 ? (parseGermanNumber(cols[colDiff]) ?? 0) : 0,
        carry: parseGermanNumber(cols[colCarry]) ?? 0,
        paidOvertime: colPaidOT>=0 ? (parseGermanNumber(cols[colPaidOT]) ?? 0) : 0,
        saldo: colSaldo>=0 ? (parseGermanNumber(cols[colSaldo]) ?? 0) : 0
      };
      if(mName === 'total'){
        total = obj;
        continue;
      }
      if(!monthMap[mName]) continue;
      obj.month = monthMap[mName];
      months.push(obj);
      if(months.length>=12 && total) break;
    }

    const jan = months.find(m=>m.month===1);
    const yearStartSaldo = jan && jan.carry!=null ? jan.carry : 0;

    // second table: day type counts by month
    let headerIdx2 = -1;
    for(let i=headerIdx1+1;i<lines.length;i++){
      const l = lines[i];
      if(/^Monat/i.test(l) && l.includes('Arbeitszeit') && l.includes('Ferien/Urlaub')){
        headerIdx2 = i;
        break;
      }
    }

    let counts = null;
    if(headerIdx2 >= 0){
      const header2Raw = splitCsvLine(lines[headerIdx2], delim).filter(h=>h!=="");
      const headers = header2Raw;

      const keys = headers.map(h => {
        const n = normalizeHeader(h)
          .replace(/[^a-z0-9]+/g,'_')
          .replace(/^_+|_+$/g,'');
        return n || 'col';
      });

      const months2 = [];
      let totalRaw = null;
      let totalByKey = null;

      for(let i=headerIdx2+1;i<lines.length;i++){
        const cols = splitCsvLine(lines[i], delim);
        if(cols.length < 2) continue;
        const m0 = normalizeHeader(cols[0]||"");
        const valuesRaw = {};
        const valuesByKey = {};
        for(let c=0; c<headers.length; c++){
          const rawVal = (cols[c] ?? '').trim();
          valuesRaw[headers[c]] = rawVal;
          const num = parseGermanNumber(rawVal);
          if(num != null) valuesByKey[keys[c]] = num;
        }

        if(m0 === 'total'){
          totalRaw = valuesRaw;
          totalByKey = valuesByKey;
          continue;
        }
        if(!monthMap[m0]) continue;
        months2.push({month:monthMap[m0], name:cols[0], valuesRaw, valuesByKey});
        if(months2.length>=12 && totalRaw) break;
      }

      counts = {
        headers,
        keys,
        months: months2,
        totalRaw,
        totalByKey
      };
    }

    return {
      summary: { kind:"year_summary", year, person:name, company, yearStartSaldo, months, total, counts },
      errors: []
    };
  }

  function parseDaily(lines, delim){
    const headers = splitCsvLine(lines[0], delim);
    const hnorm = headers.map(normalizeHeader);
    const idx = {
      date: hnorm.findIndex(h => h === 'datum' || h === 'date'),
      type: hnorm.findIndex(h => h === 'typ' || h === 'type' || h.includes('status')),
      start: hnorm.findIndex(h => h === 'start' || h.includes('beginn') || h.includes('von')),
      end: hnorm.findIndex(h => h === 'ende' || h.includes('bis')),
      brk: hnorm.findIndex(h => h.includes('pause')),
      place: hnorm.findIndex(h => h === 'ort' || h.includes('baust') || h.includes('stelle') || h.includes('location')),
      note: hnorm.findIndex(h => h.includes('notiz') || h.includes('bemerk') || h.includes('note')),
      breakH: hnorm.findIndex(h => h.includes('pause_h') || h.includes('pause (h)')),
    };
    if(idx.date < 0) return {rows:[], errors:["Spalte 'Datum' nicht gefunden."]};

    const errors=[];
    const rows=[];
    for(let i=1;i<lines.length;i++){
      const cols = splitCsvLine(lines[i], delim);
      const dk = parseDateKey(cols[idx.date]);
      if(!dk){ errors.push(`Zeile ${i+1}: Datum ungültig`); continue; }
      if(dk < '2025-01-01'){ continue; }

      const rec = { date: dk };
      const t = idx.type>=0 ? mapType(cols[idx.type]) : null;
      if(t) rec.type = t;

      const start = idx.start>=0 ? String(cols[idx.start]||"").trim() : "";
      const end = idx.end>=0 ? String(cols[idx.end]||"").trim() : "";
      if(start) rec.start = start;
      if(end) rec.end = end;

      let brk = null;
      if(idx.brk>=0){
        brk = parseGermanNumber(cols[idx.brk]);
      }else if(idx.breakH>=0){
        brk = parseGermanNumber(cols[idx.breakH]);
      }
      if(brk != null) rec.breakH = brk;

      const place = idx.place>=0 ? String(cols[idx.place]||"").trim() : "";
      if(place) rec.place = place;

      const note = idx.note>=0 ? String(cols[idx.note]||"").trim() : "";
      if(note) rec.note = note;

      rows.push(rec);
    }
    return {rows, errors};
  }

  function parseCsv(text){
    const raw = text.replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/).map(l=>l.trimEnd()).filter(l=>l.trim().length>0);
    if(lines.length<2) return {kind:'unknown', rows:[], errors:["CSV hat zu wenig Zeilen."]};
    const delim = detectDelimiter(lines[0]);

    // Detect "Jahresübersicht" CSV (like user sample)
    if(/^Stundenübersicht eines Jahres/i.test(lines[0])){
      const ys = parseYearSummary(lines, delim);
      if(ys.errors && ys.errors.length) return {kind:'year_summary', summary:null, errors:ys.errors};
      return {kind:'year_summary', summary:ys.summary, errors:[]};
    }

    // Otherwise treat as daily CSV
    const daily = parseDaily(lines, delim);
    return {kind:'daily', rows:daily.rows, errors:daily.errors || []};
  }

  function downloadBlob(blob, filename){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }
  function downloadText(text, filename, mime){
    const blob = new Blob([text], {type: mime || 'text/plain;charset=utf-8'});
    downloadBlob(blob, filename);
  }

  function buildCsv(rows){
    const header = ["Datum","Wochentag","Typ","Start","Ende","Pause_h","Soll_h","Ist_h","Diff_h","Ort","Notiz"].join(";");
    const lines = [header];
    for(const r of rows){
      lines.push([
        r.datum,
        r.wochentag,
        r.typ,
        r.start||"",
        r.ende||"",
        r.pause_h,
        r.soll_h,
        r.ist_h,
        r.diff_h,
        (r.ort||"").replace(/;/g,','),
        (r.notiz||"").replace(/;/g,',')
      ].join(";"));
    }
    return lines.join("\n");
  }

  function escapePdfText(s){
    return String(s||"").replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  }

  function createSimplePdf(title, subtitle, lines){
    const PAGE_W = 595.28, PAGE_H = 841.89;
    const marginX = 36;
    const startY = 785;
    const lineH = 12.5;
    const maxLines = Math.floor((startY - 60) / lineH);
    const pages = [];
    for(let i=0;i<lines.length;i+=maxLines) pages.push(lines.slice(i, i+maxLines));

    const objects = [];
    function addObj(str){ objects.push(str); return objects.length; }
    const fontObjNum = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

    const pageObjs = [];
    for(let p=0;p<pages.length;p++){
      const contentLines = [];
      contentLines.push("q");
      contentLines.push("0.631 0.773 0.114 rg");
      contentLines.push(`0 ${PAGE_H-40} ${PAGE_W} 40 re f`);
      contentLines.push("Q");

      contentLines.push("BT");
      contentLines.push(`/F1 16 Tf`);
      contentLines.push(`${marginX} ${PAGE_H-28} Td`);
      contentLines.push(`(${escapePdfText(title)}) Tj`);
      contentLines.push("ET");

      if(subtitle){
        contentLines.push("BT");
        contentLines.push(`/F1 10 Tf`);
        contentLines.push(`${marginX} ${PAGE_H-46} Td`);
        contentLines.push(`(${escapePdfText(subtitle)}) Tj`);
        contentLines.push("ET");
      }

      let y = startY;
      for(const line of pages[p]){
        contentLines.push("BT");
        contentLines.push(`/F1 10 Tf`);
        contentLines.push(`${marginX} ${y} Td`);
        contentLines.push(`(${escapePdfText(line)}) Tj`);
        contentLines.push("ET");
        y -= lineH;
      }
      const stream = contentLines.join("\n");
      const contentObjNum = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageObjNum = addObj(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>`);
      pageObjs.push(pageObjNum);
    }

    const kids = pageObjs.map(n => `${n} 0 R`).join(" ");
    const pagesObjNum = addObj(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pageObjs.length} >>`);
    for(const n of pageObjs){
      objects[n-1] = objects[n-1].replace("/Parent 0 0 R", `/Parent ${pagesObjNum} 0 R`);
    }
    const catalogObjNum = addObj(`<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`);

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for(let i=0;i<objects.length;i++){
      offsets.push(pdf.length);
      pdf += `${i+1} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefPos = pdf.length;
    pdf += "xref\n";
    pdf += `0 ${objects.length+1}\n`;
    pdf += "0000000000 65535 f \n";
    for(let i=1;i<offsets.length;i++){
      const off = String(offsets[i]).padStart(10,'0');
      pdf += `${off} 00000 n \n`;
    }
    pdf += "trailer\n";
    pdf += `<< /Size ${objects.length+1} /Root ${catalogObjNum} 0 R >>\n`;
    pdf += "startxref\n";
    pdf += `${xrefPos}\n%%EOF`;

    return new Blob([pdf], {type: "application/pdf"});
  }

  window.AZExport = {
    formatHours,
    formatNum,
    parseGermanNumber,
    parseCsv,
    buildCsv,
    downloadText,
    downloadBlob,
    createSimplePdf
  };
})();
