/* ═══════════════════════════════════════════════════════════════════
   docKit / exportPdf — real .pdf download (no print dialog).
   1. Render the document in an off-screen iframe at A4 width (794px).
   2. Rasterise each sheet with html2canvas (2×).
   3. Slice into A4 pages at safe break points (.dk-brk / table rows)
      so a question, list item or table row is never cut in half.
   4. Draw the footer (brand · school · Page X of N) with jsPDF on every
      page and keep links clickable.
   Also exports printDocument() — same HTML, browser print dialog.
   ═══════════════════════════════════════════════════════════════════ */
import { renderStandalone } from './render';

const A4_W_PT = 595.28;
const A4_H_PT = 841.89;
const SHEET_W = 794;                 // CSS px
const PX_TO_PT = A4_W_PT / SHEET_W;
const PAGE_H = Math.floor(A4_H_PT / PX_TO_PT); // ≈1123 px
const FOOT_RESERVE = 54;             // px kept free at the bottom for the footer
const TOP_MARGIN = 36;               // px on continuation pages

function mountFrame(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_W + 20}px;height:${PAGE_H}px;border:0;opacity:0;pointer-events:none`;
    document.body.appendChild(iframe);
    const d = iframe.contentDocument;
    d.open(); d.write(html); d.close();
    const done = async () => {
      try { await Promise.race([d.fonts?.ready, new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* ignore */ }
      const imgs = Array.from(d.images);
      await Promise.all(imgs.map(img => (img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 4000); }))));
      resolve(iframe);
    };
    if (d.readyState === 'complete') done(); else iframe.onload = done;
  });
}

function breakPoints(sheet) {
  const top = sheet.getBoundingClientRect().top;
  const pts = new Set();
  /* never break right after a heading: skip the first item of a block
     (its top sits directly under a section head / note / sub-heading) */
  const HEADISH = /(^|\s)(qp-sec-note|qp-sec-head|dk-sec-h|dk-sub-h|qp-ak-sec-lbl|qp-qtext|dk-h)(\s|$)/;
  sheet.querySelectorAll('.dk-brk, tbody tr, .qp-q, .qp-ak-row, li, p').forEach((el) => {
    const prev = el.previousElementSibling;
    if (!prev || HEADISH.test(prev.className || '')) return;
    if (el.classList.contains('qp-q') && !prev.classList.contains('qp-q')) return;
    /* widow control: never leave a lone last row / item for the next page */
    if (!el.nextElementSibling && /^(TR|LI)$/.test(el.tagName) && el.parentElement && el.parentElement.children.length > 2) return;
    const y = Math.round(el.getBoundingClientRect().top - top);
    if (y > 0) pts.add(y - 4);
  });
  return Array.from(pts).sort((a, b) => a - b);
}

function linkRects(sheet) {
  const top = sheet.getBoundingClientRect().top;
  const left = sheet.getBoundingClientRect().left;
  return Array.from(sheet.querySelectorAll('a[href]')).map((a) => {
    const r = a.getBoundingClientRect();
    return { url: a.getAttribute('href'), x: r.left - left, y: r.top - top, w: r.width, h: r.height };
  }).filter(l => /^https?:/i.test(l.url));
}

/* jsPDF's built-in fonts cannot shape Urdu — Urdu footer text falls back to Latin */
const ar = (t) => /[\u0600-\u06FF]/.test(t || '');

function drawFooter(pdf, info, page, total) {
  const y = A4_H_PT - 30;
  const pal = info.theme === 'ink'
    ? { band: null, line: [17, 17, 17], brand: [17, 17, 17], text: [102, 102, 102] }
    : info.paper
      ? { band: null, line: [184, 136, 42], brand: [15, 31, 61], text: [122, 128, 144] }
      : { band: [15, 31, 61], line: null, brand: [184, 136, 42], text: [169, 177, 194] };
  if (pal.band) { pdf.setFillColor(...pal.band); pdf.rect(0, A4_H_PT - 40, A4_W_PT, 40, 'F'); }
  if (pal.line) { pdf.setDrawColor(...pal.line); pdf.setLineWidth(info.paper && info.theme !== 'ink' ? 2.2 : 1.4); pdf.line(pal.band ? 0 : 36, A4_H_PT - 42, pal.band ? A4_W_PT : A4_W_PT - 36, A4_H_PT - 42); }
  const x0 = 34; const x1 = A4_W_PT - 34;
  pdf.setFont('times', 'bold'); pdf.setFontSize(10.5); pdf.setTextColor(...pal.brand);
  if (!info.paper) pdf.text(ar(info.brand) ? 'Mentor AI' : (info.brand || 'Mentor AI'), x0, y + 4);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...pal.text);
  const center = ar(info.center) ? (ar(info.school) ? '' : info.school) : (info.center || '');
  if (info.paper) pdf.text(center, x0, y + 4);
  else pdf.text(center, A4_W_PT / 2, y + 4, { align: 'center' });
  pdf.text(`Page ${page} of ${total}${info.pageNote && !ar(info.pageNote) ? ` · ${info.pageNote}` : ''}`, x1, y + 4, { align: 'right' });
}

/**
 * downloadPdf(doc, opts, filename) — opts as renderDocument (theme, answers, answerKey).
 * onProgress(0..1) optional.
 */
export async function downloadPdf(doc, opts, filename, onProgress) {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const html2canvas = html2canvasMod.default || html2canvasMod;
  const html = renderStandalone(doc, { ...opts, mode: 'pdf' });
  const iframe = await mountFrame(html);
  try {
    const d = iframe.contentDocument;
    const sheets = Array.from(d.querySelectorAll('.dk-sheet'));
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const info = {
      theme: opts.theme === 'ink' ? 'ink' : 'col',
      paper: doc.kind === 'paper',
      brand: doc.footer?.brand || 'Mentor AI',
      center: doc.footer?.center || doc.school?.name || '',
      school: doc.school?.name || '',
      pageNote: doc.footer?.pageNote || '',
    };
    let pageCount = 0;
    for (let si = 0; si < sheets.length; si++) {
      const sheet = sheets[si];
      const height = Math.ceil(sheet.offsetHeight);
      iframe.style.height = `${height + 40}px`;
      const canvas = await html2canvas(sheet, {
        scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff',
        windowWidth: SHEET_W + 20, logging: false, imageTimeout: 8000,
      });
      const scale = canvas.width / sheet.offsetWidth;
      const pts = breakPoints(sheet);
      const links = linkRects(sheet);
      let start = 0;
      let first = true;
      while (start < height - 2) {
        const offset = first ? 0 : TOP_MARGIN;
        const avail = PAGE_H - FOOT_RESERVE - offset;
        const s0 = start;
        let end;
        if (height - s0 <= avail) end = height;
        else {
          const target = s0 + avail;
          const cands = pts.filter(p => p > s0 + avail * 0.35 && p <= target);
          end = cands.length ? cands[cands.length - 1] : target;
        }
        const e0 = end;
        const sliceH = end - start;
        const c = document.createElement('canvas');
        c.width = canvas.width;
        c.height = Math.max(1, Math.round(sliceH * scale));
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(canvas, 0, Math.round(start * scale), canvas.width, c.height, 0, 0, canvas.width, c.height);
        if (pageCount > 0) pdf.addPage();
        pageCount++;
        pdf.addImage(c.toDataURL('image/jpeg', 0.93), 'JPEG', 0, offset * PX_TO_PT, A4_W_PT, sliceH * PX_TO_PT, undefined, 'FAST');
        links.filter(l => l.y >= s0 && l.y + l.h <= e0).forEach((l) => {
          pdf.link(l.x * PX_TO_PT, (l.y - s0 + offset) * PX_TO_PT, l.w * PX_TO_PT, l.h * PX_TO_PT, { url: l.url });
        });
        start = end;
        first = false;
      }
      if (onProgress) onProgress((si + 1) / sheets.length);
    }
    for (let p = 1; p <= pageCount; p++) { pdf.setPage(p); drawFooter(pdf, info, p, pageCount); }
    pdf.setProperties({ title: filename.replace(/\.pdf$/i, ''), creator: 'Mentor AI · School Mentor ERP' });
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return pageCount;
  } finally {
    iframe.remove();
  }
}

/** printDocument(doc, opts) — opens the browser print dialog (Save as PDF). */
export async function printDocument(doc, opts) {
  const html = renderStandalone(doc, { ...opts, mode: 'print' });
  const iframe = await mountFrame(html);
  iframe.style.height = '1123px';
  const w = iframe.contentWindow;
  w.focus();
  w.print();
  setTimeout(() => iframe.remove(), 60000);
}

export const safeFileName = (s) => String(s || 'document').replace(/<[^>]+>/g, '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 90) || 'document';
