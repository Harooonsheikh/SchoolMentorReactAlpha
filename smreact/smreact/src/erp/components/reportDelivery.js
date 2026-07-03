/* ═══════════════════════════════════════════════════════════════════
   SHARED REPORT DELIVERY

   Every Academics / Lesson-Plan report builds a full HTML document that
   ends with a toolbar (class "no-print" or "np") holding Print / Close
   buttons. This helper decides what to do with that HTML based on the
   chosen format — and, crucially, BOTH formats open the same on-screen
   preview first so the user reviews the report, then clicks a button to
   save:

     • 'pdf'  → preview window with a "Print / Save as PDF" button
                (browser print → Save as PDF). Unchanged.
     • 'word' → the SAME preview (identical design) but the toolbar button
                becomes "Save as Word". Clicking it serialises the rendered
                report and downloads it as a real Word file (.docx — the
                modern OOXML format):
                  – logos (both <img> and inline <svg>) are rasterised to
                    PNG and embedded, so the picture shows in Word;
                  – CSS gradients get a solid background-color fallback so
                    coloured headers don't drop out;
                  – decorative absolutely-positioned shapes are removed.
                The rendered HTML is packed as an OOXML "altChunk" inside a
                hand-built .docx ZIP (see buildDocx), so no library is
                required and Word imports it on open.
   ═══════════════════════════════════════════════════════════════════ */

/* Make a filesystem-safe file name (also safe to embed in an onclick attr). */
function safeFileName(name) {
  return String(name || 'report')
    .replace(/\s*[—–-]\s*/g, ' ')    // dashes → space
    .replace(/['"\\/:*?<>|]+/g, '')   // illegal filename / quote chars
    .replace(/\s+/g, ' ')
    .trim() || 'report';
}
/* ═══════════════════════════════════════════════════════════════════
   UNIVERSAL PRINT-SAFE CSS — automatically injected into EVERY report.
   Fixes "content/footer cut at page break" across ALL tabs, without
   touching each report's own code individually.
   ═══════════════════════════════════════════════════════════════════ */
const PRINT_SAFE_CSS = `<style id="__print_safe__">
@media print {
  [class*="section"], [class*="row"], [class*="card"], [class*="item"],
  [class*="pair"], [class*="unit"], [class*="footer"], [class*="header"],
  [class*="hdr"], [class*="mcq-opts"], [class*="rte-block"], [class*="block"] {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  h1, h2, h3, h4, [class*="sec-head"], [class*="unit-row"] {
    page-break-after: avoid;
    break-after: avoid;
  }
  .footer, .rpt-footer, [class*="footer"] {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
</style>`;

/* Injects PRINT_SAFE_CSS into any report's HTML — works for every tab/report
   without editing each one individually. */
function injectPrintSafeCss(html) {
  if (typeof html !== 'string' || !html) return html;
  if (html.includes('</head>')) return html.replace('</head>', `${PRINT_SAFE_CSS}</head>`);
  if (html.includes('<head>'))  return html.replace('<head>', `<head>${PRINT_SAFE_CSS}`);
  return PRINT_SAFE_CSS + html;
}
/* Self-contained script injected into the Word preview window. It defines
   __saveAsWord(), run when the user clicks "Save as Word" in the preview.
   It works on the live, fully-rendered document so images and SVG logos can
   be rasterised to PNG (Word renders neither remote SVG nor relative URLs
   reliably). */
const WORD_SAVE_SCRIPT = `<script>
(function(){
  function gradientToSolid(html){
    return html.replace(/background:\\s*linear-gradient\\(([^;"']*)\\)/g, function(m, inner){
      var c=(inner.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgba?\\([^)]*\\)/)||['#1E40AF'])[0];
      return 'background-color:'+c+';'+m;
    });
  }
  function fetchAsDataURL(url){
    return fetch(url).then(function(r){ if(!r.ok) throw 0; return r.blob(); }).then(function(blob){
      return new Promise(function(res,rej){
        var fr=new FileReader();
        fr.onloadend=function(){ res(fr.result); };
        fr.onerror=function(){ rej(); };
        fr.readAsDataURL(blob);
      });
    });
  }
  function canvasData(img){
    try{
      var c=document.createElement('canvas');
      c.width=img.naturalWidth||img.width||64;
      c.height=img.naturalHeight||img.height||64;
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      return c.toDataURL('image/png');
    }catch(e){ return null; }
  }
  function svgToData(svg){
    return new Promise(function(res){
      try{
        var w=parseInt(svg.getAttribute('width'),10)||64;
        var h=parseInt(svg.getAttribute('height'),10)||64;
        var xml=new XMLSerializer().serializeToString(svg);
        var src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(xml)));
        var im=new Image();
        im.onload=function(){
          try{
            var c=document.createElement('canvas'); c.width=w; c.height=h;
            c.getContext('2d').drawImage(im,0,0,w,h);
            res({data:c.toDataURL('image/png'),w:w,h:h});
          }catch(e){ res(null); }
        };
        im.onerror=function(){ res(null); };
        im.src=src;
      }catch(e){ res(null); }
    });
  }
  /* ── Real .docx builder ─────────────────────────────────────────────
     A .docx is an OOXML ZIP. We embed the rendered report HTML as an
     "altChunk" part; Word imports it on open (same technique html-docx-js
     uses), so no library is needed. Vanilla ZIP writer below stores parts
     uncompressed with a CRC-32. */
  function utf8Bytes(str){
    var s=unescape(encodeURIComponent(str)), a=new Uint8Array(s.length);
    for(var i=0;i<s.length;i++) a[i]=s.charCodeAt(i);
    return a;
  }
  function crc32(bytes){
    var crc=0xFFFFFFFF;
    for(var i=0;i<bytes.length;i++){
      crc^=bytes[i];
      for(var k=0;k<8;k++){ crc=(crc>>>1)^(0xEDB88320 & -(crc & 1)); }
    }
    return (crc^0xFFFFFFFF)>>>0;
  }
  function zipDocx(files){
    var u16=function(n){return [n&255,(n>>8)&255];};
    var u32=function(n){return [n&255,(n>>8)&255,(n>>16)&255,(n>>24)&255];};
    var parts=[], central=[], offset=0;
    files.forEach(function(f){
      var name=utf8Bytes(f.name), data=f.data, crc=crc32(data);
      var lh=[].concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0));
      var lhb=new Uint8Array(lh);
      parts.push(lhb,name,data);
      var ch=[].concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset));
      central.push({h:new Uint8Array(ch),n:name});
      offset+=lhb.length+name.length+data.length;
    });
    var cStart=offset, cParts=[], cSize=0;
    central.forEach(function(c){ cParts.push(c.h,c.n); cSize+=c.h.length+c.n.length; });
    var end=new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cSize),u32(cStart),u16(0)));
    return new Blob(parts.concat(cParts).concat([end]),{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  function buildDocx(htmlDoc){
    var CT='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      +'<Default Extension="xml" ContentType="application/xml"/>'
      +'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      +'<Override PartName="/word/afchunk.html" ContentType="text/html"/>'
      +'</Types>';
    var rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      +'</Relationships>';
    var doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      +'<w:body><w:altChunk r:id="htmlChunk"/>'
      +'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
      +'</w:body></w:document>';
    var docRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      +'<Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>'
      +'</Relationships>';
    return zipDocx([
      {name:'[Content_Types].xml', data:utf8Bytes(CT)},
      {name:'_rels/.rels', data:utf8Bytes(rels)},
      {name:'word/document.xml', data:utf8Bytes(doc)},
      {name:'word/_rels/document.xml.rels', data:utf8Bytes(docRels)},
      {name:'word/afchunk.html', data:utf8Bytes(htmlDoc)}
    ]);
  }
  window.__saveAsWord=function(title){
    var clone=document.documentElement.cloneNode(true);
    /* Drop the on-screen toolbar(s) and absolutely-positioned decorations. */
    clone.querySelectorAll('.np,.no-print').forEach(function(el){ el.remove(); });
    clone.querySelectorAll('[style*="position:absolute"],[style*="position: absolute"]').forEach(function(el){ el.remove(); });
    var jobs=[];
    /* Embed every <img> as a base64 data-URI so the logo travels inside the
       .doc. Prefer fetch (keeps original bytes, no canvas taint); fall back
       to canvas, then to the absolute URL. */
    var liveImg=document.querySelectorAll('img'), clImg=clone.querySelectorAll('img');
    for(var i=0;i<clImg.length;i++){
      (function(idx){
        var live=liveImg[idx];
        var src=(live && live.src) || clImg[idx].getAttribute('src') || '';
        if(!src || src.indexOf('data:')===0) return;
        jobs.push(
          fetchAsDataURL(src)
            .catch(function(){ return canvasData(live); })
            .then(function(d){ clImg[idx].setAttribute('src', d || src); })
        );
      })(i);
    }
    /* Rasterise inline <svg> logos to <img> (Word cannot render SVG). */
    var liveSvg=document.querySelectorAll('svg'), clSvg=clone.querySelectorAll('svg');
    for(var j=0;j<clSvg.length;j++){
      (function(idx){
        jobs.push(svgToData(liveSvg[idx]).then(function(r){
          if(r && clSvg[idx] && clSvg[idx].parentNode){
            var im=document.createElement('img');
            im.setAttribute('src', r.data);
            im.setAttribute('width', r.w); im.setAttribute('height', r.h);
            im.setAttribute('style','display:block');
            clSvg[idx].parentNode.replaceChild(im, clSvg[idx]);
          }
        }));
      })(j);
    }
    Promise.all(jobs).then(function(){
      var inner=gradientToSolid(clone.innerHTML);
      var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">'+inner+'</html>';
      html=html.replace('</head>','<style>@page{size:21cm 29.7cm;margin:1.5cm}body{width:auto!important}.page{width:auto!important;max-width:100%!important;margin:0!important}img{max-width:100%}</style></head>');
      var blob=buildDocx(html);
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=(title||'report')+'.docx';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    });
  };
})();
<\/script>`;

/* Turn a report's print HTML into the Word preview: same design, but the
   toolbar's print button becomes a "Save as Word" button. */
function buildWordView(name, html) {
  const title = safeFileName(name);
  let view = html
    .replace(/window\.print\(\)/g, `__saveAsWord('${title}')`)
    .replace(/🖨\s?Print \/ Save as PDF/g, '💾 Save as Word')
    .replace(/Print \/ Save as PDF/g, 'Save as Word');
  view = view.includes('</body>')
    ? view.replace('</body>', `${WORD_SAVE_SCRIPT}</body>`)
    : view + WORD_SAVE_SCRIPT;
  return view;
}

/* Write `html` into an already-open preview window (used when the caller had to
   open the popup early — e.g. after an async fetch — to dodge popup blockers). */
function writeToWindow(w, html) {
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

/* Open `html` in a new window (the preview the user reviews before saving). */
function openPreviewWindow(html, width = 900, height = 700) {
  const w = window.open('', '_blank', `width=${width},height=${height}`);
  if (w) {
    writeToWindow(w, html);
  } else {
    alert('Popup blocked! Please allow popups for this site.');
  }
}

/* Deliver a built report: a PDF print preview, or a Word "Save as Word" preview.
   Pass opts.win to reuse a window the caller already opened (popup-blocker safe). */
export function deliverReport(name, format, html, opts = {}) {
  const safeHtml = injectPrintSafeCss(html);              // ← single fix point for ALL reports
  const out = format === 'word' ? buildWordView(name, safeHtml) : safeHtml;
  if (opts.win) writeToWindow(opts.win, out);
  else openPreviewWindow(out, opts.width, opts.height);
}
