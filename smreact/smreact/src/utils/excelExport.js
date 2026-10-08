/* ═══════════════════════════════════════════════════════════════════
   EXCEL EXPORT — report HTML → native .xlsx (ExcelJS).

   Replaces the old "HTML saved as .xls" export. Excel's HTML importer
   ignored class/descendant CSS rules, rgba()/gradient colours, flex/grid
   layout and padding, and always warned that the file format did not
   match its extension. The report is now laid out by the browser
   (officeRender.js) and written as real cells: fonts, colours, fills,
   borders, alignment, merged cells (colspan/rowspan and full-width
   headings), column widths, row heights, embedded logos and numeric
   cells with their displayed number format.
   ═══════════════════════════════════════════════════════════════════ */
import ExcelJS from 'exceljs';
import { layoutFromHtml, saveBlob, withExt } from './officeRender';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PX_PT = 0.75;
const MAX_ROW_PT = 409;

const argb = (hex) => ({ argb: `FF${hex}` });
const colPxToWidth = (px) => Math.max(0.6, (px - 5) / 7);   // Excel column width units (Calibri 11)

function xFont(f) {
  if (!f) return undefined;
  return {
    name: f.name, size: f.sizePt, bold: f.bold || undefined, italic: f.italic || undefined,
    underline: f.underline || undefined, strike: f.strike || undefined, color: argb(f.color),
  };
}

function xBorder(b) {
  if (!b) return undefined;
  let style;
  if (b.style === 'double') style = 'double';
  else if (b.wPx <= 1.25) style = b.style === 'dashed' ? 'dashed' : b.style === 'dotted' ? 'dotted' : 'thin';
  else if (b.wPx <= 2.5) style = b.style === 'dashed' ? 'mediumDashed' : 'medium';
  else style = 'thick';
  return { style, color: argb(b.color) };
}

const xAlign = (a) => (a === 'justify' ? 'justify' : a || 'left');
const xVAlign = (v) => (v === 'center' ? 'middle' : v === 'bottom' ? 'bottom' : 'top');

/* Text that is plainly a number keeps its look but becomes a real number. */
function numberish(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 24) return null;
  let m = t.match(/^(Rs\.?\s?|PKR\s?|\$\s?)?([-−])?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/i);
  if (m) {
    const [, cur, neg, int, dec] = m;
    const digits = int.replace(/,/g, '');
    if (digits.length > 1 && digits[0] === '0' && !int.includes(',')) return null; // ids, phone numbers
    if (digits.length > 15) return null;
    const decs = dec ? dec.length - 1 : 0;
    let numFmt = (int.includes(',') ? '#,##0' : '0') + (decs ? `.${'0'.repeat(decs)}` : '');
    if (cur) numFmt = `"${cur}"${numFmt}`;
    return { value: Number(`${neg ? '-' : ''}${digits}${dec || ''}`), numFmt };
  }
  m = t.match(/^([-−]?\d+(?:\.\d+)?)\s?%$/);
  if (m) {
    const n = m[1].replace('−', '-');
    const decs = n.includes('.') ? n.split('.')[1].length : 0;
    return { value: Number(n) / 100, numFmt: `0${decs ? `.${'0'.repeat(decs)}` : ''}%` };
  }
  return null;
}

/* Flatten a cell's blocks into rich-text runs (+ images + first alignment). */
function flatten(blocks) {
  const runs = [], images = [];
  let align = null;
  const nl = () => { if (runs.length && runs[runs.length - 1].text !== '\n') runs.push({ text: '\n', font: runs[runs.length - 1].font }); };
  const walk = (list) => list.forEach(b => {
    if (b.t === 'p') {
      if (!b.runs.length) return;
      if (!align) align = b.align;
      nl();
      b.runs.forEach(r => {
        if (r.br) nl();
        else if (r.image) images.push(r.image);
        else if (r.text) runs.push({ text: r.text, font: r.font });
      });
    } else if (b.t === 'tbl') {
      b.rows.forEach(row => {
        nl();
        row.cells.forEach((c, i) => {
          const inner = flatten(c.content);
          images.push(...inner.images);
          if (!inner.runs.length) return;
          if (i && runs.length && runs[runs.length - 1].text !== '\n') runs.push({ text: '   ', font: inner.runs[0].font });
          runs.push(...inner.runs);
        });
      });
    }
  });
  walk(blocks);
  while (runs.length && runs[runs.length - 1].text === '\n') runs.pop();
  while (runs.length && runs[0].text === '\n') runs.shift();
  return { runs, images, align };
}

function cellValue(runs) {
  if (!runs.length) return { value: '', font: null };
  const merged = [];
  runs.forEach(r => {
    const last = merged[merged.length - 1];
    if (last && JSON.stringify(last.font) === JSON.stringify(r.font)) last.text += r.text;
    else merged.push({ text: r.text, font: r.font });
  });
  const firstFont = merged.find(r => r.text.trim())?.font || merged[0].font;
  const uniform = merged.every(r => !r.text.trim() || JSON.stringify(r.font) === JSON.stringify(firstFont));
  if (uniform) return { value: merged.map(r => r.text).join(''), font: firstFont, plain: true };
  return { value: { richText: merged.map(r => ({ text: r.text, font: xFont(r.font) })) }, font: firstFont };
}

/* Column grid: the widest-column-count data table defines the sheet columns
   (so tabular data stays one-value-per-cell for sorting/filtering); other
   content is merged across / allocated onto those columns by position. */
function buildGrid(layout) {
  let best = null;
  const walk = (blocks) => blocks.forEach(b => {
    if (b.t !== 'tbl') return;
    if (b.data) { if (!best || b.cols.length > best.cols.length) best = b; return; }
    b.rows.forEach(r => r.cells.forEach(c => walk(c.content)));
  });
  walk(layout.blocks);
  let origin, widths;
  if (best && best.cols.length >= 2) {
    origin = best.x;
    widths = best.cols.slice();
  } else {
    origin = 0;
    widths = new Array(12).fill(layout.width / 12);
  }
  const B = [origin];
  widths.forEach(w => B.push(B[B.length - 1] + w));
  return { origin, widths, B, n: widths.length };
}

function allocate(xs, B) {
  const n = B.length - 1, m = xs.length - 1;
  if (m < 1 || m > n) return null;
  const nearest = (x) => {
    let bi = 0, bd = Infinity;
    B.forEach((b, i) => { const d = Math.abs(b - x); if (d < bd) { bd = d; bi = i; } });
    return bi;
  };
  const idx = xs.map(nearest);
  for (let i = 0; i <= m; i++) {
    const lo = i === 0 ? 0 : idx[i - 1] + 1;
    const hi = n - (m - i);
    idx[i] = Math.min(Math.max(idx[i], lo), hi);
  }
  return idx;
}

/* Rough height (pt) the runs need when wrapped into `widthPx` — Excel never
   auto-fits merged or explicitly-sized rows, and its fonts run wider than
   the browser's, so the measured browser height alone can clip text. */
function estimateHeightPt(runs, widthPx) {
  if (!runs.length) return 0;
  const usable = Math.max(20, widthPx - 8);
  let lines = 0, w = 0, maxPt = 0;
  const flush = () => { lines += Math.max(1, Math.ceil(w / usable)); w = 0; };
  runs.forEach(r => {
    if (r.font) maxPt = Math.max(maxPt, r.font.sizePt);
    if (r.text === '\n') { flush(); return; }
    const px = (r.font ? r.font.sizePt / 0.75 : 14) * (r.font && r.font.bold ? 0.6 : 0.55);
    w += r.text.length * px;
  });
  flush();
  return lines * (maxPt || 10) * 1.32 + 5;
}

const INDENT_PX = 9; // ≈ one Excel indent level at the default font

function createSheetWriter(wb, ws, grid) {
  let row = 1;
  const headerRows = [];
  let headerLocked = false;
  const merged = [];

  const setHeight = (r, pt) => {
    const rr = ws.getRow(r);
    const h = Math.min(MAX_ROW_PT, Math.max(rr.height || 0, pt));
    rr.height = Math.max(1, Math.round(h * 4) / 4);
  };

  const overlaps = (r1, c1, r2, c2) => merged.some(m => !(r2 < m.r1 || r1 > m.r2 || c2 < m.c1 || c1 > m.c2));

  /* Write one (possibly merged) cell range with full styling; borders go on
     the outer edges of the range as Excel draws them per underlying cell. */
  const range = (r1, c1, r2, c2, { value, font, fill, borders, alignment, numFmt } = {}) => {
    if (c2 < c1 || r2 < r1) return;
    /* Only ranges that carry a value are merged; fills/outlines just paint. */
    if (value !== undefined && (r2 > r1 || c2 > c1) && !overlaps(r1, c1, r2, c2)) {
      try { ws.mergeCells(r1, c1, r2, c2); merged.push({ r1, c1, r2, c2 }); } catch (e) { /* leave unmerged */ }
    }
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = ws.getCell(r, c);
        if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(fill) };
        const b = {};
        if (borders) {
          if (r === r1 && borders.top) b.top = xBorder(borders.top);
          if (r === r2 && borders.bottom) b.bottom = xBorder(borders.bottom);
          if (c === c1 && borders.left) b.left = xBorder(borders.left);
          if (c === c2 && borders.right) b.right = xBorder(borders.right);
          if (Object.keys(b).length) cell.border = { ...(cell.border || {}), ...b };
        }
        if (alignment) cell.alignment = alignment;
        if (font) cell.font = xFont(font);
      }
    }
    if (value !== undefined) {
      const master = ws.getCell(r1, c1);
      master.value = value;
      if (numFmt) master.numFmt = numFmt;
    }
  };

  const fillRow = (r, c1, c2, fill) => { if (fill) range(r, c1, r, c2, { fill }); };

  const spacer = (px, ctx) => {
    if (px < 6) return;
    const r = row++;
    setHeight(r, Math.min(px, 60) * PX_PT);
    fillRow(r, ctx.c1, ctx.c2, ctx.fill);
  };

  const spanPx = (c1, c2) => grid.B[c2] - grid.B[c1 - 1];

  const colAt = (x) => {
    let px = x - grid.origin;
    if (px <= 0) return 0;
    for (let i = 0; i < grid.n; i++) {
      if (px < grid.widths[i]) return i + px / grid.widths[i];
      px -= grid.widths[i];
    }
    return grid.n;
  };

  const placeImage = (im, r) => {
    try {
      const id = wb.addImage({ base64: `data:image/${im.ext};base64,${im.b64}`, extension: im.ext === 'jpeg' ? 'jpeg' : im.ext });
      const col = Math.min(colAt(im.x), Math.max(0, grid.n - 0.5));
      ws.addImage(id, { tl: { col, row: r - 1 + 0.08 }, ext: { width: im.w, height: im.h }, editAs: 'oneCell' });
      setHeight(r, im.h * PX_PT + 6);
    } catch (e) { /* unsupported image — skip */ }
  };

  const para = (p, ctx) => {
    spacer(p.before, ctx);
    const r = row++;
    if (p.rule) {
      setHeight(r, Math.max(3, (p.height || 1) * PX_PT + 2));
      range(r, ctx.c1, r, ctx.c2, { fill: ctx.fill, borders: p.borders });
      return;
    }
    const { runs, images } = flatten([p]);
    const v = cellValue(runs);
    const indent = p.align === 'left' ? Math.min(15, Math.round((p.indL || 0) / 24)) : 0;
    range(r, ctx.c1, r, ctx.c2, {
      value: v.value, font: v.font, fill: ctx.fill, borders: p.borders,
      alignment: { horizontal: xAlign(p.align), vertical: 'middle', wrapText: true, indent: indent || undefined, readingOrder: p.rtl ? 'rtl' : undefined },
    });
    setHeight(r, Math.max(12, (p.height || 14) * PX_PT + 3, estimateHeightPt(runs, spanPx(ctx.c1, ctx.c2) - (p.indL || 0))));
    images.forEach(im => placeImage(im, r));
  };

  const tabular = (t, ctx) => {
    /* Flex/grid rows: empty spacer cells must not use up sheet columns —
       each item simply extends to where the next item starts. */
    if (t.layout && t.rows.length === 1 && t.rows[0].cells.some(c => c.gap)) {
      const starts = [t.x];
      t.cols.forEach(w => starts.push(starts[starts.length - 1] + w));
      const items = t.rows[0].cells.filter(c => !c.gap);
      const cols = [], cells = [];
      const x0 = starts[items[0].col];
      items.forEach((c, i) => {
        const end = i + 1 < items.length ? starts[items[i + 1].col] : starts[starts.length - 1];
        cols.push(end - starts[c.col]);
        cells.push({ ...c, col: i });
      });
      t = { ...t, x: x0, cols, rows: [{ ...t.rows[0], cells }] };
    }
    const xs = [t.x];
    t.cols.forEach(w => xs.push(xs[xs.length - 1] + w));
    const idx = allocate(xs, grid.B);
    const r0 = row;
    t.rows.forEach((tr, ri) => {
      const r = r0 + ri;
      fillRow(r, ctx.c1, ctx.c2, ctx.fill);
      setHeight(r, Math.max(12, tr.height * PX_PT));
      if (!idx) {
        /* More columns than the sheet grid — keep the row on one merged line. */
        const all = flatten([{ t: 'tbl', rows: [tr] }]);
        const v = cellValue(all.runs);
        range(r, ctx.c1, r, ctx.c2, { value: v.value, font: v.font, fill: ctx.fill, alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } });
        all.images.forEach(im => placeImage(im, r));
        return;
      }
      let imageEdge = -Infinity;
      tr.cells.forEach(cell => {
        const c1 = idx[cell.col] + 1;
        const c2 = idx[Math.min(cell.col + (cell.colspan || 1), t.cols.length)];
        const r2 = r + (cell.rowspan || 1) - 1;
        const fl = flatten(cell.content);
        const v = cellValue(fl.runs);
        let value = v.value, numFmt;
        if (t.data && v.plain) {
          const num = numberish(v.value);
          if (num) { value = num.value; numFmt = num.numFmt; }
        }
        const startPx = grid.B[c1 - 1];
        const widthPx = spanPx(c1, c2);
        /* Text in a cell that starts under a logo placed before it is pushed
           clear of the image with an indent. */
        const indent = fl.runs.length && imageEdge > startPx + 2 && (fl.align || 'left') === 'left'
          ? Math.min(15, Math.ceil((imageEdge - startPx + 6) / INDENT_PX)) : 0;
        /* A bordered layout item (e.g. a small logo frame) stretched across
           much wider sheet columns would draw a misleading box. */
        const origPx = t.cols.slice(cell.col, cell.col + (cell.colspan || 1)).reduce((a, w) => a + w, 0);
        const borders = !t.data && widthPx > origPx * 1.6 + 20 ? null : cell.borders;
        range(r, c1, r2, c2, {
          value, numFmt, font: v.font, fill: cell.fill || ctx.fill, borders,
          alignment: { horizontal: xAlign(fl.align), vertical: xVAlign(cell.valign), wrapText: true, indent: indent || undefined },
        });
        if ((cell.rowspan || 1) === 1) setHeight(r, estimateHeightPt(fl.runs, widthPx - indent * INDENT_PX));
        fl.images.forEach(im => { placeImage(im, r); imageEdge = Math.max(imageEdge, im.x + im.w); });
      });
      /* First data table's <thead> rows repeat on every printed page. */
      if (t.data && tr.header && !headerLocked && (!headerRows.length || headerRows[headerRows.length - 1] === r - 1)) headerRows.push(r);
    });
    if (headerRows.length) headerLocked = true;
    row = r0 + t.rows.length;
  };

  function blocks(list, ctx) {
    list.forEach(b => {
      if (b.t === 'pb') { if (row > 1) ws.getRow(row - 1).addPageBreak(); return; }
      if (b.t === 'p') { para(b, ctx); return; }
      if (b.t !== 'tbl') return;
      if (b.layout && b.cols.length === 1) {
        /* Box / page wrapper — its content flows in rows, painted with the
           box background and outlined with the box border. */
        spacer(b.before, ctx);
        b.rows.forEach(tr => tr.cells.forEach(cell => {
          const inner = { ...ctx, fill: cell.fill || ctx.fill };
          const start = row;
          if (cell.pad && cell.pad.t >= 6) spacer(cell.pad.t, inner);
          blocks(cell.content, inner);
          if (cell.pad && cell.pad.b >= 6) spacer(cell.pad.b, inner);
          if (row === start) { const r = row++; setHeight(r, Math.max(3, tr.height * PX_PT)); fillRow(r, ctx.c1, ctx.c2, inner.fill); }
          const bd = cell.borders || {};
          if (bd.top || bd.bottom || bd.left || bd.right) {
            for (let r = start; r < row; r++) {
              range(r, ctx.c1, r, ctx.c2, {
                borders: { left: bd.left, right: bd.right, top: r === start ? bd.top : null, bottom: r === row - 1 ? bd.bottom : null },
              });
            }
          }
        }));
        return;
      }
      spacer(b.before, ctx);
      tabular(b, ctx);
    });
  }

  return {
    blocks,
    get headerRows() { return headerRows; },
  };
}

function sheetName(name) {
  const s = String(name || '').split(/\s+[—–|]\s+/)[0].replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
  return (s || 'Report').slice(0, 31);
}

/* Report HTML → .xlsx Blob. opts.sheetName / opts.landscape are optional. */
export async function htmlToXlsxBlob(html, opts = {}) {
  const { layout, page } = await layoutFromHtml(html, opts);
  const grid = buildGrid(layout);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'School Mentor';
  wb.created = new Date();
  const mm = page.margin || { top: 15, right: 15, bottom: 15, left: 15 };
  const ws = wb.addWorksheet(sheetName(opts.sheetName || layout.title), {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, orientation: page.landscape ? 'landscape' : 'portrait',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      margins: { left: mm.left / 25.4, right: mm.right / 25.4, top: mm.top / 25.4, bottom: mm.bottom / 25.4, header: 0.2, footer: 0.2 },
    },
  });
  grid.widths.forEach((w, i) => { ws.getColumn(i + 1).width = colPxToWidth(w); });
  const W = createSheetWriter(wb, ws, grid);
  W.blocks(layout.blocks, { c1: 1, c2: grid.n, fill: null });
  const hr = W.headerRows;
  if (hr.length) ws.pageSetup.printTitlesRow = `${hr[0]}:${hr[hr.length - 1]}`;
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME });
}

export async function downloadHtmlAsXlsx(html, filename, opts = {}) {
  const blob = await htmlToXlsxBlob(html, opts);
  saveBlob(blob, withExt(filename, '.xlsx'), opts.targetDocument);
  return blob;
}
