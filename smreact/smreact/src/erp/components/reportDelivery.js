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
                becomes "Save as Word". Clicking it converts the rendered
                report to a native .docx via the shared exporter
                (src/utils/wordExport.js): colours, fonts, tables, flex/grid
                layout, borders and logos are written as real Word
                formatting rather than HTML for Word's importer to guess at.
   ═══════════════════════════════════════════════════════════════════ */
import { downloadHtmlAsDocx } from '../../utils/wordExport';

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

/* MathLive rendered math (.ML__ spans) reports ke naye window me by-default render
   nahi hoti (uski static CSS sirf app ke document me hoti ha). App ke injected
   MathLive stylesheet ka text uthaa kar report ke <head> me daal do. */
let __mlCssCache = null;
function getMathliveCss() {
  if (__mlCssCache != null) return __mlCssCache;
  let out = '';
  try {
    for (const sheet of Array.from(document.styleSheets || [])) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; } // cross-origin sheet
      if (!rules || !rules.length) continue;
      let hasML = false;
      for (let i = 0; i < Math.min(rules.length, 80); i++) {
        if (rules[i].cssText && rules[i].cssText.indexOf('.ML__') !== -1) { hasML = true; break; }
      }
      if (!hasML) continue;
      for (const r of rules) out += r.cssText + '\n';
      break;
    }
  } catch (e) { /* ignore */ }
  __mlCssCache = out;
  return out;
}
/* Report HTML me math ho to hi MathLive CSS inject karo (warna skip — fast). */
function injectMathliveCss(html) {
  if (typeof html !== 'string' || html.indexOf('ML__') === -1) return html;
  let css = getMathliveCss();
  if (!css) return html;
  /* Font url() ko absolute karo (naya window about:blank hota ha — root-relative
     /static/… wahan resolve nahi hota). */
  try {
    const origin = window.location.origin;
    css = css.replace(/url\(\s*(['"]?)(\/[^'")]+)\1\s*\)/g, (m, q, p) => `url(${q}${origin}${p}${q})`);
  } catch (e) { /* ignore */ }
  const tag = `<style id="__mathlive_report__">${css}</style>`;
  if (html.includes('</head>')) return html.replace('</head>', `${tag}</head>`);
  if (html.includes('<head>'))  return html.replace('<head>', `<head>${tag}`);
  return tag + html;
}
/* Turn a report's print HTML into the Word preview: same design, but the
   toolbar's print button becomes a "Save as Word" button. */
function buildWordView(name, html) {
  const title = safeFileName(name);
  return html
    .replace(/window\.print\(\)/g, `__saveAsWord('${title}')`)
    .replace(/🖨\s?Print \/ Save as PDF/g, '💾 Save as Word')
    .replace(/Print \/ Save as PDF/g, 'Save as Word');
}

/* "Save as Word" in the preview: the rendered preview document is converted
   to a native .docx by the shared exporter (src/utils/wordExport.js), and the
   download is triggered from the preview window itself. */
function attachWordSaver(w, name) {
  if (!w) return;
  w.__saveAsWord = (title) => {
    if (w.__smSavingWord) return;
    w.__smSavingWord = true;
    const doc = w.document;
    const fileName = title || safeFileName(name);
    const html = (doc.compatMode === 'CSS1Compat' ? '<!DOCTYPE html>' : '') + doc.documentElement.outerHTML;
    downloadHtmlAsDocx(html, fileName, { targetDocument: doc })
      .catch((err) => {
        console.error('Word export failed, falling back to HTML .doc', err);
        const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
        const a = doc.createElement('a');
        a.href = url; a.download = `${fileName}.doc`;
        doc.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      })
      .finally(() => { w.__smSavingWord = false; });
  };
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
  return w;
}

/* Deliver a built report: a PDF print preview, or a Word "Save as Word" preview.
   Pass opts.win to reuse a window the caller already opened (popup-blocker safe). */
export function deliverReport(name, format, html, opts = {}) {
  const safeHtml = injectMathliveCss(injectPrintSafeCss(html)); // print-safe + math (MathLive) render
  const out = format === 'word' ? buildWordView(name, safeHtml) : safeHtml;
  let w = opts.win;
  if (w) writeToWindow(w, out);
  else w = openPreviewWindow(out, opts.width, opts.height);
  if (format === 'word') attachWordSaver(w, name);
}
