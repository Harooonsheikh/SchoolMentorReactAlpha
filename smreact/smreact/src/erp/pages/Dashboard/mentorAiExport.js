import { buildUrl, resolveMediaUrl } from '../../../utils/apiConfig';
import { escapeHtml, downloadBlob } from './MentorAIResponse';

const BLUE_DARK = '#1E3A8A';
const BLUE = '#1E40AF';
const TH_BG = '#EEF3FD';

/* ═══════════════ Header data — GET /report-header/{branchID} ═══════════════ */

const headerCache = {};

export async function getReportHeader() {
  const branchID = sessionStorage.getItem('branchID');
  if (!branchID) return null;
  if (headerCache[branchID]) return headerCache[branchID];
  try {
    const token = sessionStorage.getItem('token') || '';
    const res = await fetch(buildUrl(`/report-header/${branchID}`), {
      method: 'GET',
      headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.data) {
      headerCache[branchID] = json.data;
      return json.data;
    }
  } catch { /* header na mile to school name wala fallback chalega */ }
  return null;
}

async function buildMeta(schoolName, format) {
  const h = await getReportHeader();
  const now = new Date();
  return {
    school: h?.branchName || schoolName || 'School Mentor ERP',
    address: h?.address || '',
    session: h?.academicSession || '',
    logo: h?.branchLogo ? resolveMediaUrl(h.branchLogo) : '',
    generated: `${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
    year: now.getFullYear(),
    format,
  };
}

const subtitle = (m) => `${m.session ? `Academic Year ${m.session} · ` : ''}Mentor AI Report`;

const fileBase = (q) =>
  (q || 'Mentor_AI_Report').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 50)
  || 'Mentor_AI_Report';

/* ═══════════════ PDF — sirf report print hoti hai (isolated iframe) ═══════════════
   Header (blue card) content ke shuru me ek baar, footer content ke aakhir me ek baar.
   Page ke upar/neeche ki khali jagah thead/tfoot spacer se aati hai (@page margin 0 —
   is se browser ka apna date/URL header-footer nahi aata). */

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #0F172A; font-size: 11.5px; line-height: 1.55; padding: 0 12mm; }

  table.page { width: 100%; border-collapse: collapse; }
  table.page > thead { display: table-header-group; }
  table.page > tfoot { display: table-footer-group; }
  table.page > thead > tr > td, table.page > tfoot > tr > td,
  table.page > tbody > tr > td { padding: 0; border: 0; vertical-align: top; }
  .sp { height: 11mm; }

  .hero { position: relative; overflow: hidden; border-radius: 10px; padding: 18px 22px 16px; color: #fff;
          background: linear-gradient(135deg, ${BLUE_DARK} 0%, ${BLUE} 55%, #2B5BD7 100%);
          break-inside: avoid; page-break-inside: avoid; margin-bottom: 16px; }
  .hero::before { content: ''; position: absolute; right: -30px; top: -45px; width: 160px; height: 160px; border-radius: 50%; background: rgba(255,255,255,.08); }
  .hero::after  { content: ''; position: absolute; left: 38%; bottom: -60px; width: 120px; height: 120px; border-radius: 50%; background: rgba(255,255,255,.06); }
  .brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
  .logo { width: 46px; height: 46px; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; overflow: hidden; flex-shrink: 0; }
  .logo img { width: 100%; height: 100%; object-fit: contain; }
  .eyebrow { font-size: 7.5px; letter-spacing: .18em; font-weight: 700; opacity: .8; text-transform: uppercase; }
  .school { font-size: 17px; font-weight: 800; line-height: 1.2; }
  .addr { font-size: 9px; opacity: .8; margin-top: 2px; }
  .rule { height: 1px; background: rgba(255,255,255,.28); margin: 13px 0 11px; position: relative; z-index: 1; }
  .title { font-size: 18px; font-weight: 800; position: relative; z-index: 1; }
  .subt { font-size: 9.5px; opacity: .85; margin-top: 3px; position: relative; z-index: 1; }
  .chips { display: flex; gap: 8px; margin-top: 11px; position: relative; z-index: 1; }
  .chip { background: rgba(255,255,255,.16); border-radius: 999px; padding: 4px 11px; font-size: 8.5px; }
  .chip b { font-weight: 700; }

  .sec { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: #1E293B;
         padding-bottom: 7px; border-bottom: 1.5px solid #BFD0F5; margin: 4px 0 12px; }

  .body p { margin: 0 0 8px; }
  .body h3, .body h4, .body h5, .body h6 { color: ${BLUE_DARK}; margin: 14px 0 6px; font-size: 13px; }
  .body ul, .body ol { margin: 0 0 10px; padding-left: 20px; }
  .body li { margin: 3px 0; }
  .body code { background: #F1F5F9; padding: 1px 5px; border-radius: 3px; font-size: 10.5px; }
  .body hr { border: 0; border-top: 1px solid #E2E8F0; margin: 12px 0; }
  .body table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 6px 0 14px;
                border: 1px solid #D6E0F5; border-radius: 8px; overflow: hidden; }
  .body thead { display: table-header-group; }
  .body tr { break-inside: avoid; page-break-inside: avoid; }
  .body th { background: ${TH_BG}; color: #1E293B; text-align: left; padding: 7px 11px; font-size: 9.5px; font-weight: 700;
             text-transform: uppercase; letter-spacing: .04em; border-bottom: 1.5px solid #C7D5F3; }
  .body td { padding: 7px 11px; font-size: 11px; border-bottom: 1px solid #E8EEF9; vertical-align: top; }
  .body tbody tr:last-child td { border-bottom: 0; }

  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding-top: 8px;
          border-top: 1px solid #DDE5F5; font-size: 8.5px; color: #64748B; break-inside: avoid; page-break-inside: avoid; }
`;

const logoHtml = (m) => (m.logo
  ? `<img src="${escapeHtml(m.logo)}" alt="" onerror="this.replaceWith(document.createTextNode('🎓'))">`
  : '🎓');

function buildPrintHtml(m, bodyHtml, title) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>${PRINT_CSS}</style></head><body>
  <table class="page">
    <thead><tr><td><div class="sp"></div></td></tr></thead>
    <tbody><tr><td>
      <div class="hero">
        <div class="brand">
          <div class="logo">${logoHtml(m)}</div>
          <div>
            <div class="eyebrow">School Mentor ERP</div>
            <div class="school">${escapeHtml(m.school)}</div>
            ${m.address ? `<div class="addr">${escapeHtml(m.address)}</div>` : ''}
          </div>
        </div>
        <div class="rule"></div>
        <div class="title">Mentor AI Report</div>
        <div class="subt">${escapeHtml(subtitle(m))}</div>
        <div class="chips">
          <span class="chip"><b>Generated:</b> ${escapeHtml(m.generated)}</span>
          <span class="chip"><b>Format:</b> ${m.format}</span>
        </div>
      </div>

      <div class="body">${bodyHtml}</div>

      <div class="foot">
        <span>${escapeHtml(m.school)}</span>
        <span>School Mentor ERP © ${m.year}</span>
        <span>Mentor AI Report</span>
      </div>
    </td></tr></tbody>
    <tfoot><tr><td><div class="sp"></div></td></tr></tfoot>
  </table>
  </body></html>`;
}

export async function printReport({ schoolName, query, bodyHtml }) {
  const m = await buildMeta(schoolName, 'PDF');
  const html = buildPrintHtml(m, bodyHtml, fileBase(query));

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => setTimeout(() => { try { iframe.remove(); } catch { /* already gone */ } }, 300);
  win.onafterprint = cleanup;

  /* Logo load hone ka intezar (max 2.5s), phir print */
  const pending = [...doc.images]
    .filter((img) => !img.complete)
    .map((img) => new Promise((r) => { img.onload = r; img.onerror = r; }));
  await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 2500))]);

  win.focus();
  win.print();
  setTimeout(cleanup, 120000);   // afterprint na aaye to bhi iframe hat jaye
}

/* ═══════════════ WORD (.doc) ═══════════════ */

export async function exportWord({ schoolName, query, bodyHtml }) {
  const m = await buildMeta(schoolName, 'Word');

  const body = bodyHtml
    .replace(/<table[^>]*>/g,
      '<table border="1" cellspacing="0" cellpadding="6" width="100%" style="border-collapse:collapse;width:100%;border:1px solid #C7D5F3">')
    .replace(/<th>/g,
      `<th bgcolor="${TH_BG}" style="background:${TH_BG};color:#1E293B;border:1px solid #C7D5F3;padding:6pt;text-align:left;font-size:9pt">`)
    .replace(/<td>/g,
      '<td style="border:1px solid #D6E0F5;padding:6pt;font-size:10.5pt;vertical-align:top">');

  const logo = m.logo ? `<img src="${escapeHtml(m.logo)}" width="46" height="46" style="width:46px;height:46px">` : '';

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>Mentor AI Report</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
  <style>
    @page WordSection1 { size: 595.3pt 841.9pt; margin: 40pt 42pt 40pt 42pt; }
    div.WordSection1 { page: WordSection1; }
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0F172A; }
    h3, h4, h5, h6 { color: ${BLUE_DARK}; font-size: 13pt; margin: 12pt 0 4pt; }
    p { margin: 0 0 6pt; }
  </style></head>
  <body><div class="WordSection1">

    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">
      <tr><td bgcolor="${BLUE_DARK}" style="background:${BLUE_DARK};padding:14pt 16pt;color:#FFFFFF">
        <table cellspacing="0" cellpadding="0" style="border-collapse:collapse">
          <tr>
            ${logo ? `<td width="60" style="padding-right:10pt;vertical-align:middle">${logo}</td>` : ''}
            <td style="vertical-align:middle;color:#FFFFFF">
              <p style="margin:0;font-size:7.5pt;letter-spacing:2pt;color:#BFD0F5"><b>SCHOOL MENTOR ERP</b></p>
              <p style="margin:0;font-size:17pt;color:#FFFFFF"><b>${escapeHtml(m.school)}</b></p>
              ${m.address ? `<p style="margin:0;font-size:9pt;color:#DCE6FB">${escapeHtml(m.address)}</p>` : ''}
            </td>
          </tr>
        </table>
        <p style="margin:12pt 0 0;font-size:17pt;color:#FFFFFF"><b>Mentor AI Report</b></p>
        <p style="margin:2pt 0 0;font-size:9.5pt;color:#DCE6FB">${escapeHtml(subtitle(m))}</p>
        <p style="margin:8pt 0 0;font-size:8.5pt;color:#DCE6FB">Generated: ${escapeHtml(m.generated)} &nbsp;|&nbsp; Format: Word</p>
      </td></tr>
    </table>

    ${body}

    <p style="margin:16pt 0 0;border-top:1pt solid #DDE5F5;padding-top:5pt;font-size:8.5pt;color:#64748B">
      ${escapeHtml(m.school)} &nbsp;&nbsp;|&nbsp;&nbsp; School Mentor ERP © ${m.year} &nbsp;&nbsp;|&nbsp;&nbsp; Mentor AI Report
    </p>
  </div></body></html>`;

  downloadBlob(html, `${fileBase(query)}.doc`, 'application/msword');
}

/* ═══════════════ EXCEL (.xls) ═══════════════ */

export async function exportExcel({ schoolName, query, container }) {
  if (!container) return;
  const m = await buildMeta(schoolName, 'Excel');

  let cols = 3;
  container.querySelectorAll('table').forEach((t) => {
    cols = Math.max(cols, t.querySelector('tr')?.children.length || 0);
  });

  const TH = `background:${TH_BG};color:#1E293B;font-weight:bold;border:.5pt solid #C7D5F3;padding:4px 8px;text-align:left`;
  const TD = 'border:.5pt solid #D6E0F5;padding:4px 8px;vertical-align:top';

  const textRow = (txt, style = '', h) => {
    const lines = Math.max(1, Math.ceil(String(txt).length / (cols * 26)));
    return `<tr style="height:${h || lines * 16}pt"><td colspan="${cols}" style="white-space:normal;vertical-align:middle;${style}">${escapeHtml(txt)}</td></tr>`;
  };
  const blank = `<tr><td colspan="${cols}"></td></tr>`;

  const rows = [
    textRow(m.school, `background:${BLUE_DARK};color:#FFFFFF;font-size:16pt;font-weight:bold;padding:6px 10px`, 26),
    m.address ? textRow(m.address, `background:${BLUE_DARK};color:#DCE6FB;font-size:10pt;padding:0 10px 6px`, 18) : '',
    textRow(subtitle(m), `background:${BLUE};color:#FFFFFF;font-size:13pt;font-weight:bold;padding:6px 10px`, 24),
    textRow(`Generated: ${m.generated}     |     Format: Excel`, `background:${BLUE};color:#DCE6FB;font-size:9pt;padding:0 10px 6px`, 18),
    blank,
  ];

  container.childNodes.forEach((node) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();

    if (tag === 'table' || node.querySelector?.('table')) {
      const table = tag === 'table' ? node : node.querySelector('table');
      table.querySelectorAll('tr').forEach((tr) => {
        const isHead = !!tr.querySelector('th');
        const cells = [...tr.children]
          .map((c) => `<${isHead ? 'th' : 'td'} style="${isHead ? TH : TD}">${escapeHtml(c.textContent)}</${isHead ? 'th' : 'td'}>`)
          .join('');
        rows.push(`<tr>${cells}</tr>`);
      });
      rows.push(blank);
    } else if (tag === 'ul' || tag === 'ol') {
      [...node.children].forEach((li, i) =>
        rows.push(textRow(`${tag === 'ol' ? `${i + 1}.` : '•'} ${li.textContent}`)));
      rows.push(blank);
    } else if (/^h[1-6]$/.test(tag)) {
      rows.push(textRow(node.textContent, `font-weight:bold;color:${BLUE}`));
    } else if (tag !== 'hr') {
      rows.push(textRow(node.textContent));
    }
  });

  rows.push(textRow(`${m.school}     |     School Mentor ERP © ${m.year}     |     Mentor AI Report`,
    'color:#64748B;font-size:9pt;border-top:1pt solid #DDE5F5', 18));

  const colGroup = Array.from({ length: cols }, () => '<col width="190" style="width:190px">').join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Mentor AI</x:Name>
  <x:WorksheetOptions><x:DisplayGridlines>false</x:DisplayGridlines></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>td,th{font-family:Calibri,Arial,sans-serif;font-size:11pt}</style></head>
  <body><table>${colGroup}${rows.join('')}</table></body></html>`;

  downloadBlob(html, `${fileBase(query)}.xls`, 'application/vnd.ms-excel');
}