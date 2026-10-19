import { CARD_SIZES, photoRadius, photoBoxAspect, qrPositionCss, scalePx } from './idCardThemes';

/* ═══════════════════════════════════════════════════════════════════
   ID CARD PRINT / PDF BUILDER — static-HTML mirror of IdCardFace.jsx
   for the print window (same convention as every other module in this
   app: window.open + write HTML + window.print() → "Save as PDF", no
   new PDF dependency). Cards print at their true physical CR80 size
   via @page — never scaled/distorted by the browser.
   ═══════════════════════════════════════════════════════════════════ */

const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));

function logoHtml(logoDataUrl, sizePct, round, tone) {
  const size = Math.round(30 * (sizePct / 100));
  if (!logoDataUrl) {
    return `<div style="width:${size}px;height:${size}px;border-radius:${round ? '50%' : '6px'};background:${tone === 'dark' ? 'rgba(255,255,255,.15)' : 'rgba(15,23,42,.08)'};display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fa-solid fa-school" style="font-size:${size * 0.5}px;color:${tone === 'dark' ? '#fff' : '#64748B'}"></i></div>`;
  }
  return `<div style="width:${size}px;height:${size}px;flex-shrink:0;display:flex;align-items:center;justify-content:${round ? 'center' : 'flex-start'}"><img src="${logoDataUrl}" alt="" style="max-width:${size}px;max-height:${size}px;object-fit:contain;border-radius:${round ? '50%' : 0}"/></div>`;
}

function photoHtml(photoDataUrl, shape, orientation, sizePct, theme, show = true) {
  if (!show) return '';
  const base = orientation === 'vertical' ? 108 : 74;
  const size = Math.round(base * (sizePct / 100));
  const w = shape === 'portrait' ? Math.round(size * 0.78) : size;
  const inner = photoDataUrl
    ? `<img src="${photoDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover"/>`
    : `<i class="fa-solid fa-user" style="font-size:${size * 0.32}px;color:${theme.primary};opacity:.5"></i>`;
  return `<div style="width:${w}px;aspect-ratio:${photoBoxAspect(shape)};border-radius:${photoRadius(shape, orientation)};overflow:hidden;flex-shrink:0;background:${theme.surface};border:1.5px solid ${theme.border};display:flex;align-items:center;justify-content:center">${inner}</div>`;
}

function codeHtml(src, size = 46, isBarcode = false) {
  if (!src) return '';
  return `<div style="background:#fff;padding:4px;border-radius:6px;display:inline-flex"><img src="${src}" style="width:${size}px;height:${isBarcode ? size * 0.5 : size}px;object-fit:contain"/></div>`;
}

function rowsHtml(rows, { size = 9.5, gap = 3, color = '#0F172A', muted = '#94A3B8', dense } = {}) {
  return `<div style="display:flex;flex-direction:column;gap:${dense ? 1.5 : gap}px;min-width:0">${rows.map((r) => `
    <div style="min-width:0"><span style="font-size:${size - 2}px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:${muted};margin-right:5px">${esc(r.label)}:</span><span style="font-size:${size}px;font-weight:700;color:${color};word-break:break-word">${esc(r.value)}</span></div>
  `).join('')}</div>`;
}

/* The enclosing .idc2-page/.idc2-cell (buildSingleCardDocument /
   buildBulkSheetDocument below) is already sized in mm to the exact
   physical CR80 dimensions for the current orientation, so the card
   itself just fills it — no aspect-ratio guessing needed at print time
   (unlike the on-screen preview, which has no such fixed container). */
function cardShellOpen(orientation, bg, extra = '') {
  return `<div class="idc2-card" style="position:relative;overflow:hidden;width:100%;height:100%;border-radius:14px;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;display:flex;flex-direction:column;background:${bg};${extra}">`;
}

function backFaceHtml({ theme, orientation, qrSrc, barcodeSrc, idText, branding, school, backOptions = {}, backRows = [], qrPosition = 'center', qrSizePct = 100 }) {
  const c = theme.colors;
  const showBanner = backOptions.showBanner !== false;
  const showIdText = backOptions.showIdText !== false;
  const pos = String(qrPosition || 'center');
  const vAlign = pos.includes('top') ? 'flex-start' : pos.includes('bottom') ? 'flex-end' : 'center';
  const hAlign = pos.includes('left') ? 'flex-start' : pos.includes('right') ? 'flex-end' : 'center';
  const qrCornerCss = '';
  const qrInline = !!qrSrc;
  const qrBackSize = scalePx(pos === 'center' ? 72 : 52, qrSizePct);
  return `${cardShellOpen(orientation, c.bg, `border:1px solid ${c.border}`)}
    ${showBanner ? `<div style="background:${c.primary};color:${c.onPrimary};padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${esc(backOptions.bannerText || 'If found, please return to school office')}</div>` : ''}
<div style="flex:1;display:flex;flex-direction:column;align-items:${hAlign};justify-content:safe ${vAlign};gap:6px;padding:10px 14px;min-height:0;overflow:hidden">
           ${(qrInline || (showIdText && idText)) ? `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0">
${qrInline ? codeHtml(qrSrc, qrBackSize) : ''}
        ${showIdText && idText ? `<div style="font-size:10.5px;font-weight:800;color:${c.ink};letter-spacing:.5px">${esc(idText)}</div>` : ''}
      </div>` : ''}
      ${codeHtml(barcodeSrc, 140, true)}
      ${backRows.length > 0 ? `<div style="width:100%;display:flex;flex-direction:column;gap:3px;margin-top:2px">${backRows.map((r) => `<div style="text-align:center"><span style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#94A3B8;margin-right:4px">${esc(r.label)}:</span><span style="font-size:9px;font-weight:700;color:${c.ink}">${esc(r.value)}</span></div>`).join('')}</div>` : ''}
    </div>
    ${(branding.showAddress || branding.showContact) ? `<div style="padding:8px 14px;font-size:8.5px;color:#64748B;text-align:center;border-top:1px solid ${c.border}">${branding.showAddress ? esc(school?.address || '') : ''}${branding.showAddress && branding.showContact && school?.address && school?.phone ? ' &middot; ' : ''}${branding.showContact ? esc(school?.phone || '') : ''}</div>` : ''}
    ${qrCornerCss ? `<div style="${qrCornerCss}">${codeHtml(qrSrc, scalePx(44, qrSizePct))}</div>` : ''}
  </div>`;
}

export function renderCardFaceHtml({
  theme, orientation, face = 'front', photoShape, photoSizePct, photoDataUrl, logoDataUrl, branding, school, rows, qrSrc, barcodeSrc, idText, showPhoto = true, backOptions, backRows,
  qrShowOn = { front: false, back: true }, barcodeShowOn = { front: false, back: false },
  qrPosition = 'bottom-right', backQrPosition = 'center', qrSizePct = 100,
}) {
  const c = theme.colors;
  if (face === 'back') {
    return backFaceHtml({
      theme, orientation, idText, branding, school, backOptions, backRows,
      qrSrc: qrShowOn.back ? qrSrc : null,
      barcodeSrc: barcodeShowOn.back ? barcodeSrc : null,
      qrPosition: backQrPosition, qrSizePct,
    });
  }
  qrSrc = qrShowOn.front ? qrSrc : null;
  barcodeSrc = barcodeShowOn.front ? barcodeSrc : null;
  const headerName = branding.showSchoolName ? esc(school?.name || '') : '';

  if (theme.layout === 'classic') {
    return `${cardShellOpen(orientation, c.bg, `border:1px solid ${c.border}`)}
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:3px solid ${c.primary}">
        ${branding.showLogo ? logoHtml(logoDataUrl, branding.logoSizePct) : ''}
        <div style="flex:1;min-width:0">
          ${headerName ? `<div style="font-size:12px;font-weight:800;color:${c.primary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${headerName}</div>` : ''}
          <div style="font-size:8.5px;color:#64748B;text-transform:uppercase;letter-spacing:.6px;margin-top:1px">Identity Card</div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:${orientation === 'vertical' ? 'column' : 'row'};align-items:${orientation === 'vertical' ? 'center' : 'flex-start'};gap:10px;padding:12px">
        ${photoHtml(photoDataUrl, photoShape, orientation, photoSizePct, c, showPhoto)}
        ${rowsHtml(rows, { color: c.ink })}
      </div>
      ${qrSrc ? `<div style="${qrPositionCss(qrPosition)}">${codeHtml(qrSrc, scalePx(30, qrSizePct))}</div>` : ''}
    </div>`;
  }

  if (theme.layout === 'gradient') {
    const photoTheme = { ...c, surface: 'rgba(255,255,255,.2)', border: 'rgba(255,255,255,.4)', primary: '#fff' };
    return `${cardShellOpen(orientation, `linear-gradient(135deg, ${c.primary}, ${c.secondary})`)}
      <div style="display:flex;align-items:center;gap:8px;padding:12px 14px 4px">
        ${branding.showLogo ? logoHtml(logoDataUrl, branding.logoSizePct, true, 'dark') : ''}
        ${headerName ? `<div style="font-size:11px;font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${headerName}</div>` : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:${orientation === 'vertical' ? 'column' : 'row'};align-items:${orientation === 'vertical' ? 'center' : 'flex-start'};gap:12px;padding:14px;overflow:hidden">
        ${photoHtml(photoDataUrl, photoShape, orientation, photoSizePct, photoTheme, showPhoto)}
        <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:0">
          ${rows.slice(0, 1).map((r) => `<div style="font-size:14px;font-weight:900;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.value)}</div>`).join('')}
          <div style="display:flex;flex-wrap:wrap;gap:5px;overflow:hidden">
            ${rows.slice(1).map((r) => `<span style="font-size:8.5px;font-weight:700;color:#fff;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:3px 8px;white-space:nowrap">${esc(r.label)}: ${esc(r.value)}</span>`).join('')}
          </div>
        </div>
      </div>
      ${qrSrc ? `<div style="${qrPositionCss(qrPosition)}">${codeHtml(qrSrc, scalePx(34, qrSizePct))}</div>` : ''}
    </div>`;
  }

  if (theme.layout === 'minimal') {
    return `${cardShellOpen(orientation, c.bg, `border:1px solid ${c.border}`)}
      <div style="position:absolute;top:0;left:0;bottom:0;width:4px;background:${c.primary}"></div>
      <div style="flex:1;display:flex;flex-direction:column;padding:12px 14px 10px 18px;gap:10px">
        <div style="display:flex;align-items:center;gap:8px">
          ${branding.showLogo ? logoHtml(logoDataUrl, branding.logoSizePct) : ''}
          ${headerName ? `<div style="font-size:9.5px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${headerName}</div>` : ''}
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;flex:1;overflow:hidden">
          ${photoHtml(photoDataUrl, photoShape, orientation, photoSizePct, c, showPhoto)}
          <div style="height:70%;width:1px;background:${c.border};flex-shrink:0"></div>
          ${rowsHtml(rows, { size: 9, gap: 4, color: c.ink, muted: '#9CA3AF', dense: true })}
        </div>
      </div>
      ${qrSrc ? `<div style="${qrPositionCss(qrPosition)}">${codeHtml(qrSrc, scalePx(26, qrSizePct))}</div>` : ''}
    </div>`;
  }

  if (theme.layout === 'executive') {
    const photoTheme = { ...c, surface: 'rgba(255,255,255,.08)', border: c.primary, primary: c.primary };
    return `${cardShellOpen(orientation, c.bg)}
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 100% 0%, rgba(212,175,55,.12), transparent 55%);pointer-events:none"></div>
      <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid ${c.border};position:relative">
        ${branding.showLogo ? logoHtml(logoDataUrl, branding.logoSizePct, false, 'dark') : ''}
        ${headerName ? `<div style="font-size:11px;font-weight:700;color:${c.primary};letter-spacing:.4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${headerName}</div>` : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:${orientation === 'vertical' ? 'column' : 'row'};align-items:${orientation === 'vertical' ? 'center' : 'flex-start'};gap:12px;padding:14px;position:relative;overflow:hidden">
        ${photoHtml(photoDataUrl, photoShape, orientation, photoSizePct, photoTheme, showPhoto)}
        ${rowsHtml(rows, { color: '#F1F5F9', muted: c.primary })}
      </div>
      <div style="height:2px;background:linear-gradient(90deg, transparent, ${c.primary}, transparent)"></div>
      ${qrSrc ? `<div style="${qrPositionCss(qrPosition)}">${codeHtml(qrSrc, scalePx(30, qrSizePct))}</div>` : ''}
    </div>`;
  }

  if (theme.layout === 'colorful') {
    return `${cardShellOpen(orientation, c.bg, `border:2px solid ${c.border}`)}
      <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:${c.secondary};opacity:.15"></div>
      <div style="position:absolute;bottom:-24px;left:-24px;width:80px;height:80px;border-radius:50%;background:${c.primary};opacity:.15"></div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;position:relative">
        ${branding.showLogo ? logoHtml(logoDataUrl, branding.logoSizePct, true) : ''}
        ${headerName ? `<div style="font-size:11.5px;font-weight:900;color:${c.primary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${headerName}</div>` : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:${orientation === 'vertical' ? 'column' : 'row'};align-items:${orientation === 'vertical' ? 'center' : 'flex-start'};gap:12px;padding:4px 14px 10px;position:relative;overflow:hidden">
        ${photoHtml(photoDataUrl, photoShape, orientation, photoSizePct, c, showPhoto)}
        <div style="display:flex;flex-direction:column;gap:5px;flex:1;min-width:0;overflow:hidden">
          ${rows.map((r, i) => `<div style="display:flex;align-items:center;gap:6px;font-size:9.5px;min-width:0"><span style="width:5px;height:5px;border-radius:50%;background:${i % 2 === 0 ? c.primary : c.secondary};flex-shrink:0"></span><span style="font-weight:700;color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${esc(r.value)}</span></div>`).join('')}
        </div>
      </div>
      ${qrSrc ? `<div style="${qrPositionCss(qrPosition)}">${codeHtml(qrSrc, scalePx(30, qrSizePct))}</div>` : ''}
    </div>`;
  }

  /* vertical */
  const isV = orientation === 'vertical';
  return `${cardShellOpen(orientation, c.bg, `border:1px solid ${c.border}`)}
    <div style="display:flex;flex-direction:${isV ? 'column' : 'row'};height:100%">
      <div style="position:relative;background:${c.surface};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;flex:0 0 ${isV ? '52%' : '40%'};gap:8px">
        ${branding.showLogo ? `<div style="position:absolute;top:8px;left:8px">${logoHtml(logoDataUrl, branding.logoSizePct)}</div>` : ''}
        ${photoHtml(photoDataUrl, photoShape, 'vertical', photoSizePct * 1.3, c, showPhoto)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;padding:12px;gap:8px;min-width:0">
        ${headerName ? `<div style="font-size:9px;font-weight:700;color:${c.primary};text-transform:uppercase;letter-spacing:.5px">${headerName}</div>` : ''}
        ${rows.slice(0, 1).map((r) => `<div style="font-size:13px;font-weight:900;color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.value)}</div>`).join('')}
        ${rowsHtml(rows.slice(1), { size: 9, gap: 3, color: '#0F172A', muted: '#94A3B8', dense: true })}
      </div>
    </div>
    ${qrSrc ? `<div style="${qrPositionCss(qrPosition)}">${codeHtml(qrSrc, scalePx(40, qrSizePct))}</div>` : ''}
  </div>`;
}

const FA_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';

/* One physical card per page — used for a single student/employee's
   download/print. Front + back (if the design's QR/barcode live on
   the back) each get their own exact-size page. */
export function buildSingleCardDocument({ title, sizeId, orientation, frontHtml, backHtml }) {
  const size = CARD_SIZES[sizeId] || CARD_SIZES.cr80;
  const wMm = orientation === 'vertical' ? size.hMm : size.wMm;
  const hMm = orientation === 'vertical' ? size.wMm : size.hMm;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${FA_CDN}">
<style>
*{box-sizing:border-box}
body{margin:0;padding:10mm;background:#EEF2F9;display:flex;flex-direction:column;align-items:center;gap:8mm}
@page{size:${wMm}mm ${hMm}mm;margin:0}
@media print{
  body{padding:0;background:#fff;gap:0}
  .idc2-page{page-break-after:always}
  .idc2-page:last-child{page-break-after:auto}
}
.idc2-page{width:${wMm}mm;height:${hMm}mm;display:flex;align-items:center;justify-content:center;background:#fff}
</style></head><body>
<div class="idc2-page">${frontHtml}</div>
${backHtml ? `<div class="idc2-page">${backHtml}</div>` : ''}
</body></html>`;
}

/* Multiple cards on an A4 sheet, each at its real physical size, with a
   light cut-guide border — never scaled/distorted to "fit" the page.
   `perPage` ('auto' or a number) controls how many land on one sheet
   before a page break: 'auto' just wraps as many real-size cards as
   naturally fit; a specific number groups cards into that many per
   page (fewer per page = more cutting margin, more per page = tighter)
   — the cards themselves are never resized either way.

   `backCardsHtml` (optional, same order/length as `cardsHtml`) prints a
   second block of pages right after the fronts — ALL fronts first, then
   ALL backs, same order in both blocks — so a school printing double-
   sided or laminating front+back separately can match card #N's front
   page to its back page by position, instead of the back page being
   missing entirely. Only added when the design's back actually has
   content (caller decides; an empty array here just omits the block). */
export function buildBulkSheetDocument({ title, sizeId, orientation, cardsHtml, backCardsHtml = [], perPage = 'auto' }) {
  const size = CARD_SIZES[sizeId] || CARD_SIZES.cr80;
  const wMm = orientation === 'vertical' ? size.hMm : size.wMm;
  const hMm = orientation === 'vertical' ? size.wMm : size.hMm;

  const buildSheets = (htmlList) => {
    const cells = htmlList.map((h) => `<div class="idc2-cell">${h}</div>`);
    if (perPage === 'auto' || !perPage) return [`<div class="idc2-sheet">${cells.join('\n')}</div>`];
    const n = Math.max(1, Number(perPage));
    const pages = [];
    for (let i = 0; i < cells.length; i += n) pages.push(cells.slice(i, i + n));
    return pages.map((page) => `<div class="idc2-sheet">${page.join('\n')}</div>`);
  };

  const blocks = [
    { label: 'Front Sides', sheets: buildSheets(cardsHtml) },
    ...(backCardsHtml.length ? [{ label: 'Back Sides', sheets: buildSheets(backCardsHtml) }] : []),
  ];
  const showLabels = blocks.length > 1;
  const sheetsHtml = blocks.map((block, bi) => block.sheets.map((sheet, si) => {
    const isLast = bi === blocks.length - 1 && si === block.sheets.length - 1;
    const label = showLabels && si === 0 ? `<div class="idc2-section-label">${esc(block.label)}</div>` : '';
    return `${label}${sheet.replace('class="idc2-sheet"', `class="idc2-sheet${isLast ? '' : ' idc2-break'}"`)}`;
  }).join('\n')).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${FA_CDN}">
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff}
@page{size:A4;margin:10mm}
.idc2-section-label{font:800 12px/1 'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;text-transform:uppercase;letter-spacing:.6px;color:#475569;margin-bottom:4mm}
.idc2-sheet{display:flex;flex-wrap:wrap;gap:4mm;margin-bottom:4mm}
.idc2-sheet.idc2-break{page-break-after:always}
.idc2-cell{width:${wMm}mm;height:${hMm}mm;outline:1px dashed #CBD5E1;outline-offset:2px;page-break-inside:avoid}
</style></head><body>
${sheetsHtml}
</body></html>`;
}
