
/* export.js - CSV / JSON / minimal PDF (offline, no external libs) */
(function(){
  'use strict';

  function pad2(n){ return String(n).padStart(2,'0'); }
  function fmtHoursFromMin(min){
    const h = (min/60);
    return h.toFixed(2).replace('.', ',');
  }
  function fmtHoursWithSuffix(min){
    return `${fmtHoursFromMin(min)} h`;
  }
  function escapeCsv(v){
    if(v === null || v === undefined) return '';
    const s = String(v);
    if(/[;"\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  function downloadBlob(blob, filename){
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function toISODateStr(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function makeCSV(rows){
    const header = [
      'date','weekday','type',
      'start1','end1','start2','end2',
      'pause_h','soll_h','ist_h','diff_h',
      'location','note'
    ];
    const lines = [header.join(';')];
    for(const r of rows){
      lines.push(header.map(k=>escapeCsv(r[k])).join(';'));
    }
    return lines.join('\n');
  }

  function parseCSV(text){
    // simple ; separated CSV with optional quotes
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim().length);
    if(!lines.length) return {header:[], rows:[]};
    const header = splitLine(lines[0]);
    const rows = [];
    for(let i=1;i<lines.length;i++){
      const parts = splitLine(lines[i]);
      const row = {};
      for(let j=0;j<header.length;j++){
        row[header[j]] = parts[j] ?? '';
      }
      rows.push(row);
    }
    return {header, rows};

    function splitLine(line){
      const out = [];
      let cur = '';
      let inQ = false;
      for(let i=0;i<line.length;i++){
        const ch = line[i];
        if(inQ){
          if(ch === '"'){
            if(line[i+1] === '"'){ cur+='"'; i++; }
            else inQ = false;
          }else cur += ch;
        }else{
          if(ch === '"') inQ = true;
          else if(ch === ';'){ out.push(cur); cur=''; }
          else cur += ch;
        }
      }
      out.push(cur);
      return out;
    }
  }

  // ---------- Minimal PDF writer (Type1 Courier) ----------
  function pdfEscape(s){
    return String(s)
      .replace(/\\/g,'\\\\')
      .replace(/\(/g,'\\(')
      .replace(/\)/g,'\\)');
  }

  function buildSimplePDF(pagesLines, title){
    // pagesLines: array of array-of-strings
    const objs = [];
    const offsets = [0]; // dummy for 1-based objects
    const enc = (s)=> new TextEncoder().encode(s);

    function addObj(str){
      objs.push(str);
      return objs.length; // object number
    }

    const fontObj = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`);

    // build page objects later after we know their numbers
    const pageObjs = [];
    const contentObjs = [];

    for(const lines of pagesLines){
      const content = makeContentStream(lines, title);
      const contentObjNum = addObj(content);
      contentObjs.push(contentObjNum);

      const pageObjNum = addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObjNum} 0 R >>`);
      pageObjs.push(pageObjNum);
    }

    const kids = pageObjs.map(n=>`${n} 0 R`).join(' ');
    const pagesObj = addObj(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pageObjs.length} >>`); // will be #2? not necessarily yet.
    // Ensure Pages is object 2 for Page objects parent ref "2 0 R"
    // We used "2 0 R" above. So we must place Pages as object 2.
    // To enforce: rebuild with fixed ordering.
    // We'll rebuild objects with deterministic numbering.

    // Rebuild deterministically:
    const objStrings = [];
    // 1 Catalog, 2 Pages, 3 Font, then alternating content/page from 4 onward.
    // Build content/page objects again:
    const pageObjNums = [];
    const contentObjNums = [];
    let objNo = 3;

    // place font as 3
    objStrings[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`;

    // placeholder for pages as 2
    objStrings[2] = ''; // set later
    // catalog as 1
    objStrings[1] = `<< /Type /Catalog /Pages 2 0 R >>`;

    // pages & content
    for(const lines of pagesLines){
      // content object
      objNo++;
      const cNo = objNo;
      contentObjNums.push(cNo);
      objStrings[cNo] = makeContentStream(lines, title);

      // page object
      objNo++;
      const pNo = objNo;
      pageObjNums.push(pNo);
      objStrings[pNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${cNo} 0 R >>`;
    }

    objStrings[2] = `<< /Type /Pages /Kids [ ${pageObjNums.map(n=>`${n} 0 R`).join(' ')} ] /Count ${pageObjNums.length} >>`;

    // build final PDF
    let out = `%PDF-1.4\n%âãÏÓ\n`;
    const xref = [];
    const maxObj = objStrings.length-1;

    for(let n=1;n<=maxObj;n++){
      if(!objStrings[n]) continue;
      xref[n] = out.length;
      out += `${n} 0 obj\n${objStrings[n]}\nendobj\n`;
    }

    const xrefStart = out.length;
    out += `xref\n0 ${maxObj+1}\n`;
    out += `0000000000 65535 f \n`;
    for(let n=1;n<=maxObj;n++){
      const off = xref[n] ?? 0;
      out += `${String(off).padStart(10,'0')} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${maxObj+1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return new Blob([enc(out)], {type:'application/pdf'});

    function makeContentStream(lines, title){
      const marginLeft = 44;
      const topY = 800;
      const lineH = 12;
      const fontSizeTitle = 12;
      const fontSize = 9;

      const safeTitle = pdfEscape(title || 'Arbeitszeiterfassung');
      let stream = '';
      stream += `BT\n/F1 ${fontSizeTitle} Tf\n${marginLeft} ${topY} Td\n(${safeTitle}) Tj\nET\n`;

      let y = topY - 20;
      stream += `BT\n/F1 ${fontSize} Tf\n`;
      for(const line of lines){
        stream += `${marginLeft} ${y} Td\n(${pdfEscape(line)}) Tj\n`;
        // reset text matrix for next line (relative moves are annoying in raw PDF)
        stream += `ET\nBT\n/F1 ${fontSize} Tf\n`;
        y -= lineH;
      }
      stream += `ET\n`;

      const bytes = new TextEncoder().encode(stream);
      return `<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream`;
    }
  }

  function linesForMonth(monthInfo){
    // monthInfo: {title, rows} rows are already formatted strings
    const lines = [];
    lines.push(monthInfo.headerLine);
    lines.push('-'.repeat(monthInfo.headerLine.length));
    for(const r of monthInfo.rows) lines.push(r);
    return lines;
  }

  function chunkLines(allLines, maxPerPage){
    const pages = [];
    for(let i=0;i<allLines.length;i+=maxPerPage){
      pages.push(allLines.slice(i, i+maxPerPage));
    }
    return pages;
  }

  window.AZ_EXPORT = {
    fmtHoursFromMin,
    fmtHoursWithSuffix,
    downloadBlob,
    makeCSV,
    parseCSV,
    buildSimplePDF,
    linesForMonth,
    chunkLines,
    toISODateStr,
  };
})();
