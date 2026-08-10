/* ═══════════════════════════════════════════════════════════════════
   HR REPORT GENERATORS — 1:1 port from "Human Resource .html".
   Each generator returns a complete printable HTML document string
   that callers feed into a new browser window.

   The three top-level generators:
     • generateSalarySlipHTML(e, monthKey, style, ctx)
     • generatePayHistoryReportHTML(e, fromKey, toKey, style, ctx)
     • generateLoanReportHTML(e, style, ctx)

   `ctx` carries everything the generators need but cannot derive
   from the employee record alone: empPayroll, empLoans, helper
   functions, etc.
   ═══════════════════════════════════════════════════════════════════ */

/* Local fallbacks — used only when the live /report-header API data is missing.
   The real branch name / logo / session come from ctx.branch (see resolveBranch). */
const SCHOOL = { name: 'School Mentor', tagline: 'Academic Year 2025–2026', monogram: 'SM' };

/* Merge the live branch report-header (fetched from the /report-header API and
   passed in on ctx.branch) over the local SCHOOL defaults. Returns the fields the
   report chrome needs: name, logo URL, address, academic-session line and the
   generated date (yyyy-mm-dd). */
function resolveBranch(ctx) {
  const b = (ctx && ctx.branch) || {};
  return {
    name: b.branchName || SCHOOL.name,
    logo: b.branchLogo || '',
    address: b.address || '',
    session: b.academicSession ? `Academic Year ${b.academicSession}` : SCHOOL.tagline,
    generatedDate: b.generatedDate ? String(b.generatedDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}
/* Embedded auto-print bootstrap. We build the `<script>` tag from
   character codes so the closing tag cannot terminate this module's
   own surrounding template literal. */
const CLOSE_SCRIPT_AFTER_PRINT = (() => {
  const lt = String.fromCharCode(60);
  return `${lt}script>window.onload=()=>setTimeout(()=>window.print(),200);${lt}/script>`;
})();
const SCHOOL_LOGO_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2L1 7l11 5 9-4.09V14h2V7L12 2z" fill="currentColor"/>
  <path d="M5 10v6c0 1.85 4.4 4 7 4s7-2.15 7-4v-6l-7 3.18L5 10z" fill="currentColor"/>
  <path d="M11.5 12.5L4 9v3.5l7.5 3.5L19 12.5V9l-7.5 3.5z" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.55"/>
</svg>`;

function reportColors(style) {
  if (style === 'bw') {
    return {
      brand: '#000', brandLight: '#FFFFFF', headerBg: '#FFFFFF', headerText: '#000',
      headerBorder: '2.5px solid #000', accentBar: '#000',
      headBg: '#FFFFFF', headBorder: '2px solid #000', cellBorder: '1px solid #D1D5DB',
      subtotalBg: '#FFFFFF', subtotalText: '#000', subtotalBorder: '2px solid #000',
      success: '#000', warn: '#000', err: '#000', info: '#000', muted: '#6B7280',
      altRow: '#FFFFFF', panelBg: '#FFFFFF', panelBorder: '1px solid #9CA3AF',
      statusPaidBg: '#FFFFFF', statusPaidText: '#000', statusPaidBorder: '1px solid #000',
      statusGenBg: '#FFFFFF', statusGenText: '#000', statusGenBorder: '1px dashed #6B7280',
      statusPartialBg: '#FFFFFF', statusPartialText: '#000', statusPartialBorder: '1px dotted #000',
      tableHeadBg: '#F9FAFB', tableHeadText: '#000',
      netCardBg: '#FFFFFF', netCardText: '#000', netCardBorder: '2px solid #000',
      sigBorder: '1px solid #6B7280',
    };
  }
  return {
    brand: '#1E3A8A', brandLight: '#F0F4FF', headerBg: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', headerText: '#FFFFFF',
    headerBorder: 'none', accentBar: '#1E40AF',
    headBg: '#F0F4FF', headBorder: '2px solid #BFDBFE', cellBorder: '1px solid #DBEAFE',
    subtotalBg: '#F0F4FF', subtotalText: '#1E3A8A', subtotalBorder: '2px solid #1E40AF',
    success: '#16A34A', warn: '#D97706', err: '#DC2626', info: '#0284C7', muted: '#64748B',
    altRow: '#F8FAFC', panelBg: '#F0F4FF', panelBorder: '1px solid #BFDBFE',
    statusPaidBg: 'rgba(22,163,74,.12)', statusPaidText: '#16A34A', statusPaidBorder: '1px solid rgba(22,163,74,.3)',
    statusGenBg: 'rgba(217,119,6,.12)', statusGenText: '#D97706', statusGenBorder: '1px solid rgba(217,119,6,.3)',
    statusPartialBg: 'rgba(2,132,199,.12)', statusPartialText: '#0284C7', statusPartialBorder: '1px solid rgba(2,132,199,.3)',
    tableHeadBg: '#F0F4FF', tableHeadText: '#1E3A8A',
    netCardBg: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', netCardText: '#FFFFFF', netCardBorder: 'none',
    sigBorder: '1px solid #94A3B8',
  };
}

function reportBaseCSS(C, style, orientation) {
  orientation = orientation || 'portrait';
  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? '297mm' : '210mm';
  const pageH = isLandscape ? '210mm' : '297mm';
  const hPad = isLandscape ? '11mm' : '12mm';
  const vPad = isLandscape ? '10mm' : '14mm';
  const brandColor = style === 'bw' ? '#000' : '#1E3A8A';
  const brandBorder = style === 'bw' ? '2px solid #000' : '2px solid #1E3A8A';
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#fff}
    body{font-family:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif;color:#1A2545;font-size:11px;line-height:1.45}
    .page{width:${pageW};min-height:${pageH};padding:${vPad} ${hPad};margin:0 auto;background:#fff}

    .r-head-wrap{margin-bottom:14px}
    .r-brand-row{display:flex;align-items:center;gap:14px;padding-bottom:11px;border-bottom:${brandBorder};margin-bottom:9px}
    .r-logo{width:50px;height:50px;border:2.5px solid currentColor;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#fff}
    .r-logo svg{width:26px;height:26px;display:block}
    .r-brand-info{flex:1;min-width:0}
    .r-school-name{font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
    .r-report-title{font-size:11.5px;font-weight:600;color:${C.muted};margin-top:3px;letter-spacing:.01em}
    .r-tag-badge{margin-left:auto;display:flex;align-items:center;gap:5px;padding:5px 11px;border-radius:9999px;background:rgba(22,163,74,.1);color:#16A34A;font-size:10.5px;font-weight:700;border:1px solid rgba(22,163,74,.2);flex-shrink:0}
    .r-tag-badge i{font-size:11px}
    .r-meta-bar{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;font-size:10.5px;color:${C.muted};background:${style==='bw'?'#FFFFFF':'#F1F5FB'};border:${style==='bw'?'1px solid #9CA3AF':'1px solid #E1E8F5'};padding:8px 13px;border-radius:${style==='bw'?'4px':'6px'};margin-top:6px}
    .r-meta-bar strong{color:${style==='bw'?'#000':'#1E3A8A'};font-weight:800}

    .r-title{font-size:13.5px;font-weight:800;color:${brandColor};margin:14px 0 8px;padding-bottom:5px;border-bottom:${style==='bw'?'1.5px solid #000':'1.5px solid '+brandColor};text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .r-title .badge{font-size:10px;background:${C.headBg};color:${C.brand};padding:3px 10px;border-radius:9999px;font-weight:800;text-transform:none;letter-spacing:0;border:${style==='bw'?'1px solid #000':'1px solid '+C.brand}}

    .r-emp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:${C.panelBg};border:${C.panelBorder};border-radius:${style==='bw'?'4px':'8px'};padding:11px 14px;margin-bottom:14px}
    .r-emp-grid .f label{font-size:9px;font-weight:800;color:${C.muted};text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:2px}
    .r-emp-grid .f span{font-size:11.5px;font-weight:700;color:#1A2545}

    table{width:100%;border-collapse:collapse;font-size:${isLandscape?'10':'10.5'}px;margin-bottom:10px;table-layout:auto}
    th{background:${style==='bw'?'#FFFFFF':brandColor};color:${style==='bw'?'#000':'#fff'};padding:${isLandscape?'6px 6px':'8px 9px'};text-align:left;border-bottom:${style==='bw'?'2px solid #000':'2px solid '+brandColor};font-size:${isLandscape?'9':'9.5'}px;text-transform:uppercase;letter-spacing:.3px;font-weight:800;white-space:nowrap}
    td{padding:${isLandscape?'5px 6px':'6.5px 9px'};border-bottom:${C.cellBorder};color:#1A2545;vertical-align:middle}
    td.num{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
    td.num.pos{color:${C.success}}
    td.num.neg{color:${C.err}}
    td.nw{white-space:nowrap}
    tr.subtotal{background:${style==='bw'?'#FFFFFF':'#EAF0FA'};font-weight:800;color:${brandColor};border-top:${style==='bw'?'2px solid #000':'2px solid '+brandColor}}
    tr.subtotal td{padding:${isLandscape?'7px 6px':'8.5px 9px'};font-size:${isLandscape?'10.5':'11'}px;white-space:nowrap}
    tr:nth-child(even):not(.subtotal){${style==='bw'?'':'background:'+C.altRow}}

    .status-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:800;letter-spacing:.2px;white-space:nowrap}
    .status-pill.paid{background:${C.statusPaidBg};color:${C.statusPaidText};border:${C.statusPaidBorder}}
    .status-pill.gen{background:${C.statusGenBg};color:${C.statusGenText};border:${C.statusGenBorder}}
    .status-pill.partial{background:${C.statusPartialBg};color:${C.statusPartialText};border:${C.statusPartialBorder}}

    .r-net-card{margin:12px 0;background:${C.netCardBg};color:${C.netCardText};border:${C.netCardBorder};padding:13px 18px;border-radius:${style==='bw'?'4px':'8px'};display:flex;align-items:center;justify-content:space-between;gap:14px}
    .r-net-card .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.5px;opacity:${style==='bw'?'1':'.92'};font-weight:700}
    .r-net-card .amt{font-size:21px;font-weight:800;letter-spacing:-.01em}

    .r-summary-row{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}
    .r-stat{background:${C.panelBg};border:${C.panelBorder};border-radius:${style==='bw'?'4px':'6px'};padding:9px 11px}
    .r-stat label{font-size:9px;font-weight:800;color:${C.muted};text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px}
    .r-stat .v{font-size:14px;font-weight:800;color:${style==='bw'?'#000':C.brand};letter-spacing:-.01em}
    .r-stat.pos .v{color:${C.success}}
    .r-stat.warn .v{color:${C.warn}}

    .r-sig-row{display:grid;gap:50px;padding:18px 0 8px;margin-top:14px}
    .r-sig{text-align:center;border-top:${C.sigBorder};padding-top:5px;font-size:10px;color:${C.muted};font-weight:700}

    .r-footer{padding:8px 0;border-top:1px solid #E5E7EB;font-size:9px;color:${C.muted};text-align:center;line-height:1.55;font-style:italic;margin-top:6px}
    .r-footer strong{color:#1A2545;font-style:normal}
    .empty-msg{padding:30px 14px;text-align:center;color:${C.muted};font-size:12px;font-style:italic;border:1px dashed ${style==='bw'?'#9CA3AF':C.panelBorder.replace('1px solid ','')};border-radius:${style==='bw'?'4px':'8px'}}

    @page{size:A4 ${isLandscape?'landscape':'portrait'};margin:0}
    @media print{
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      body{padding:0;margin:0}
      .page{padding:${vPad} ${hPad};margin:0;min-height:0;width:100%;box-shadow:none}
    }
  `;
}

function reportHeader(C, title, style, extraMeta, ctx) {
  const brandColor = style === 'bw' ? '#000' : '#1E3A8A';
  const b = resolveBranch(ctx);
  const logoInner = b.logo
    ? `<img src="${b.logo}" alt="School logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : SCHOOL_LOGO_SVG;
  return `
    <div class="r-head-wrap">
      <div class="r-brand-row">
        <div class="r-logo" style="color:${brandColor};border-color:${brandColor}">${logoInner}</div>
        <div class="r-brand-info">
          <div class="r-school-name" style="color:${brandColor}">${b.name}</div>
          <div class="r-report-title">Human Resource &middot; Financials &middot; ${title}</div>
          ${b.address?`<div class="r-report-title" style="margin-top:1px">${b.address}</div>`:''}
        </div>
        ${style==='bw'?'':`<div class="r-tag-badge"><i class="fa-solid fa-shield-halved"></i> Official Report</div>`}
      </div>
      <div class="r-meta-bar">
        <span><strong>Issue Date:</strong> ${ctx.fmtDate(b.generatedDate)}</span>
        ${extraMeta?`<span>${extraMeta}</span>`:''}
        <span><strong>${b.session}</strong></span>
        <span style="margin-left:auto;font-style:italic">Confidential &middot; Internal Use Only</span>
      </div>
    </div>`;
}

function reportEmpBlock(C, e, ctx) {
  return `
    <div class="r-emp-grid">
      <div class="f"><label>Employee Name</label><span>${ctx.getFullName(e)}</span></div>
      <div class="f"><label>Employee ID</label><span>${e.eid}</span></div>
      <div class="f"><label>Department</label><span>${ctx.getDeptName(e.dId)||'—'}</span></div>
      <div class="f"><label>Designation</label><span>${ctx.getDesigName(e.desId)||'—'}</span></div>
      <div class="f"><label>CNIC</label><span style="font-size:11px">${e.cnic||'—'}</span></div>
      <div class="f"><label>Joining Date</label><span>${ctx.fmtDate(e.join)||'—'}</span></div>
      <div class="f"><label>Bank / Account</label><span style="font-size:11px">${e.bankName||'—'}${e.bankAcc?' · '+e.bankAcc:''}</span></div>
      <div class="f"><label>Status</label><span style="color:${e.status==='Active'?C.success:C.warn}">${e.status||'—'}</span></div>
    </div>`;
}

function reportSignatures(C) {
  return `
    <div class="r-sig-row" style="grid-template-columns:1fr 1fr;gap:50px;max-width:560px;margin:14px auto 8px">
      <div class="r-sig">Teacher / Employee Signature</div>
      <div class="r-sig">Administrator Signature</div>
    </div>`;
}

function reportFooter(C, note, ctx) {
  const b = resolveBranch(ctx);
  return `<div class="r-footer">${note||''}<br>Generated by <strong>School Mentor ERP</strong> &middot; ${b.name} &middot; ${ctx.fmtDate(b.generatedDate)} &middot; All values in PKR unless stated otherwise.</div>`;
}

/* ════════════════ SALARY SLIP (Single Month) ════════════════ */
export function generateSalarySlipHTML(e, monthKey, style, ctx) {
  const { fmtMoney, fmtDate, getFullName, empPayroll, empLoans, leaveInfo, workInfo } = ctx;
  const C = reportColors(style);
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10);
  const monthNames = ['', 'January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = monthNames[monthIdx] || 'May';
  const year = parseInt(yearStr, 10) || 2026;
  const rec = (empPayroll[e.id] || {})[monthKey];
  /* Earnings shown on the slip come from the payroll SNAPSHOT (rec) so the breakdown
     always sums to rec.totalGross even if the employee's salary changed after the
     payroll was generated. A residual line catches anything the buckets miss, so
     Basic + Allowances + Bonus == Total Gross Earnings exactly. When no payroll exists
     we fall back to the live employee heads (that path only renders the empty state).  */
  const basic = rec ? (+rec.basicPay || 0) : (+e.basicSalary || 0);
  const allowances = rec ? (() => {
    const heads = [
      { name: 'House Allowance',     amount: +rec.houseAllowance     || 0 },
      { name: 'Transport Allowance', amount: +rec.transportAllowance || 0 },
      { name: 'Medical Allowance',   amount: +rec.medicalAllowance   || 0 },
      { name: 'Extra Allowances',    amount: +rec.extraAllowances    || 0 },
      { name: 'Previous Arrears',    amount: +rec.previousArrears    || 0 },
    ].filter(h => h.amount !== 0);
    const residual = (+rec.totalGross || 0) - basic - (+rec.bonus || 0)
                     - heads.reduce((s, h) => s + h.amount, 0);
    if (Math.abs(residual) >= 1) heads.push({ name: 'Other Allowances', amount: residual });
    return heads;
  })() : (e.salaryHeads || []).filter(h => h.type === 'allow');
  const stdDeducts = (e.salaryHeads || []).filter(h => h.type === 'deduct');
  const payMethod = e.payMethod || 'Bank Transfer';

  const slipCSS = `
    .slip-sec{margin-bottom:13px}
    .slip-sec-title{font-size:11px;font-weight:800;${style==='bw'?'color:#000':'color:'+C.brand};text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:5px;border-bottom:${style==='bw'?'1.5px solid #000':'1.5px solid '+C.brand};display:flex;align-items:center;gap:6px}
    .slip-sec-title i{font-size:12px}
    .slip-sec-title .right{margin-left:auto;font-size:10px;color:${C.muted};font-weight:700;text-transform:none;letter-spacing:0;padding:2px 9px;border-radius:9999px;background:${C.panelBg};border:1px solid ${C.panelBorder.replace('1px solid ','')}}
    .slip-fields{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .slip-fields.cols-2{grid-template-columns:repeat(2,1fr)}
    .slip-fields.cols-3{grid-template-columns:repeat(3,1fr)}
    .slip-fields.cols-5{grid-template-columns:repeat(5,1fr)}
    .slip-fields.cols-6{grid-template-columns:repeat(6,1fr)}
    .slip-field{background:${C.panelBg};border:${C.panelBorder};border-radius:${style==='bw'?'4px':'5px'};padding:8px 11px}
    .slip-field label{font-size:9px;font-weight:800;color:${C.muted};text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px}
    .slip-field .v{font-size:12.5px;font-weight:800;color:#1A2545;font-variant-numeric:tabular-nums}
    .slip-field.ded .v{color:${C.err}}
    .slip-field.pos .v{color:${C.success}}
    .slip-field.warn .v{color:${C.warn}}
    .slip-field.compact{padding:6px 9px}
    .slip-field.compact .v{font-size:11px}
    .slip-subtotal{margin-top:8px;display:flex;align-items:center;justify-content:space-between;padding:8px 13px;background:${C.subtotalBg};border:${C.subtotalBorder};border-radius:${style==='bw'?'4px':'5px'};font-size:12px;font-weight:800;color:${C.subtotalText}}
    .slip-subtotal .v{font-size:14px;font-variant-numeric:tabular-nums}
    .slip-net-card{margin:12px 0;background:${C.netCardBg};color:${C.netCardText};border:${C.netCardBorder};padding:15px 22px;border-radius:${style==='bw'?'4px':'8px'};display:flex;align-items:center;justify-content:space-between;gap:14px}
    .slip-net-card .lbl{font-size:12px;text-transform:uppercase;letter-spacing:.5px;opacity:${style==='bw'?'1':'.92'};font-weight:700}
    .slip-net-card .amt{font-size:22px;font-weight:800;letter-spacing:-.01em}
    .slip-net-card .in-words{font-size:10px;font-weight:600;opacity:${style==='bw'?'.85':'.88'};margin-top:2px;font-style:italic}
    .slip-settle{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:12px}
    .slip-settle-tile{background:${C.panelBg};border:1.5px solid ${C.panelBorder.replace('1px solid ','')};border-radius:${style==='bw'?'4px':'6px'};padding:10px 13px;text-align:center}
    .slip-settle-tile label{font-size:9.5px;font-weight:800;color:${C.muted};text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px}
    .slip-settle-tile .v{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
    .slip-settle-tile.net .v{color:${style==='bw'?'#000':C.brand}}
    .slip-settle-tile.paid .v{color:${C.success}}
    .slip-settle-tile.rem .v{color:${C.warn}}
    .slip-settle-tile.rem.zero .v{color:${C.success}}
    .slip-empty{padding:30px 14px;text-align:center;color:${C.muted};font-size:12.5px;font-style:italic;border:1px dashed ${style==='bw'?'#9CA3AF':C.panelBorder.replace('1px solid ','')};border-radius:${style==='bw'?'4px':'8px'};margin:18px 0}
    .slip-empty i{font-size:24px;display:block;margin-bottom:8px;${style==='bw'?'color:#000':'color:'+C.warn};opacity:.6}

    .att-row{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-bottom:8px}
    .att-cell{background:${C.panelBg};border:${C.panelBorder};border-radius:${style==='bw'?'4px':'5px'};padding:8px 10px;text-align:center}
    .att-cell label{font-size:8.5px;font-weight:800;color:${C.muted};text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:3px;line-height:1.2}
    .att-cell .v{font-size:18px;font-weight:800;color:#1A2545;line-height:1}
    .att-cell.pos .v{color:${C.success}}
    .att-cell.neg .v{color:${C.err}}
    .att-cell.warn .v{color:${C.warn}}
    .att-cell.info .v{color:${style==='bw'?'#000':C.brand}}

    .loan-prog{background:${C.panelBg};border:${C.panelBorder};border-radius:${style==='bw'?'4px':'7px'};padding:11px 14px;margin-bottom:8px}
    .loan-prog-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px}
    .loan-prog-row .ttl{font-size:12px;font-weight:800;color:#1A2545}
    .loan-prog-row .meta{font-size:10px;color:${C.muted};font-weight:700}
    .loan-prog-bar-wrap{height:10px;background:${style==='bw'?'#FFFFFF':'#E5E7EB'};border:${style==='bw'?'1px solid #000':'none'};border-radius:9999px;overflow:hidden;margin-bottom:6px}
    .loan-prog-bar{height:100%;background:${style==='bw'?'repeating-linear-gradient(45deg,#000 0,#000 3px,#FFF 3px,#FFF 6px)':'linear-gradient(90deg,#1E3A8A,#1E40AF,#2563EB)'};transition:width .3s}
    .loan-prog-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;font-size:10px}
    .loan-prog-stat{text-align:center}
    .loan-prog-stat label{font-size:8.5px;font-weight:800;color:${C.muted};text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:2px}
    .loan-prog-stat .v{font-weight:800;color:#1A2545;font-size:11px;font-variant-numeric:tabular-nums}
    .loan-prog-stat.pos .v{color:${C.success}}
    .loan-prog-stat.warn .v{color:${C.warn}}

    .ytd-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:8px}
    .ytd-stat{background:${C.panelBg};border:${C.panelBorder};border-radius:${style==='bw'?'4px':'6px'};padding:9px 12px}
    .ytd-stat label{font-size:8.5px;font-weight:800;color:${C.muted};text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:3px}
    .ytd-stat .v{font-size:14px;font-weight:800;color:${style==='bw'?'#000':C.brand};font-variant-numeric:tabular-nums}
    .ytd-stat.pos .v{color:${C.success}}
    .ytd-stat.neg .v{color:${C.err}}

    .slip-remarks{margin-top:8px;padding:9px 13px;background:${C.panelBg};border-left:3px solid ${style==='bw'?'#6B7280':C.info};border-radius:${style==='bw'?'0':'4px'};font-size:10.5px;color:#1A2545;line-height:1.55}
    .slip-remarks strong{color:${style==='bw'?'#000':C.brand};font-weight:800}

    .slip-two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:13px}
    .slip-two-col .slip-sec{margin-bottom:0}
  `;

  let body = '';
  if (!rec) {
    body = `
      <div class="r-title">Salary Slip — ${monthName} ${year}<span class="badge">${e.eid}</span></div>
      ${reportEmpBlock(C, e, ctx)}
      <div class="slip-empty">
        <i class="fa-solid fa-circle-info"></i>
        <strong>No payroll generated for ${monthName} ${year}</strong><br>
        Please generate a payroll for this month from the Financials tab before downloading the salary slip.
      </div>
      ${reportSignatures(C)}
      ${reportFooter(C, `Requested salary slip for <strong>${getFullName(e)}</strong> · <strong>${monthName} ${year}</strong>.`, ctx)}
    `;
  } else {
    const payments = rec.payments || [];
    const totalPaid = payments.reduce((s, p) => s + (+p.amount || 0), 0) || (rec.paidAmount || 0);
    const remaining = Math.max(0, (rec.netPayable || 0) - totalPaid);
    const isFullyPaid = remaining <= 0.01;

    const daysInMonth = new Date(year, monthIdx, 0).getDate();
    /* REAL working days + public holidays (ctx.workInfo — caller ne Attendance ke SAME
       holiday-setup se compute kiya: weekly-off + monthly holidays). workInfo na mile to
       purana fallback (Sundays + guessed holidays). */
    let sundays = 0;
    for (let d = 1; d <= daysInMonth; d++) { if (new Date(year, monthIdx - 1, d).getDay() === 0) sundays++; }
    const workingDays = Number(workInfo?.workingDays) >= 0 && workInfo
      ? Number(workInfo.workingDays)
      : (daysInMonth - sundays);
    const publicHolidays = workInfo
      ? (Number(workInfo.publicHolidays) || 0)
      : ((monthName === 'August' || monthName === 'March' || monthName === 'December') ? 2 : 1);
    const effectiveWorkingDays = workInfo
      ? (Number(workInfo.effectiveWorkingDays) || Math.max(0, workingDays - publicHolidays))
      : (workingDays - publicHolidays);
    const absent = rec.absentCount || 0;
    const leaves = rec.leaveCount || 0;
    const lateDays = (monthName === 'November' || monthName === 'March') ? 2 : 0;
    const daysPresent = Math.max(0, effectiveWorkingDays - absent - leaves);
    const attendancePct = effectiveWorkingDays > 0 ? ((daysPresent / effectiveWorkingDays) * 100).toFixed(1) : '100.0';

    /* REAL per-employee leave figures (ctx.leaveInfo se — caller ne getHrLeaveSettings +
       calculateLeaveAbsentDeduction fetch kiya). Pehle ye hardcoded the (har staff same).
       Settings na mile to sensible defaults par gir jaate hain. */
    const ls   = leaveInfo?.settings || {};
    const calc = leaveInfo?.calc || {};
    const leavesAllotted = {
      casual: Number(ls.casual) || 0,
      sick:   Number(ls.sick)   || 0,
      annual: Number(ls.annual) || 0,
    };
    /* Backend per-type leave USAGE track nahi karta — sirf kul YTD (cumulativeLeavesTakenYTD)
       deta hai. Is liye kul used sirf ANNUAL par lagta hai; casual/sick used 0 rehta hai
       (jab tak backend per-type usage na de). Card ab "USED / allotted" dikhata hai taake
       li gayi leave nazar aaye. */
    const annualUsedYTD = Number(calc.cumulativeLeavesTakenYTD) || 0;
    const leavesUsed = {
      casual: 0,
      sick:   0,
      annual: annualUsedYTD,
    };

    const loanDeductedThisMonth = (Number(rec.loanDeduct) || 0) + (Number(rec.customLoan) || 0);
    const empLoanList = empLoans[e.id] || [];
    const activeLoan  = empLoanList.find(l => l.status === 'active') || empLoanList[0];
    let loanProgressHTML = '';
    if (loanDeductedThisMonth > 0 && activeLoan) {
      const totalLoan      = +activeLoan.amount || 0;
      const repaid         = (activeLoan.received || []).reduce((s, r) => s + (+r.amount || 0), 0);
      const remainingLoan  = +activeLoan.remaining || (totalLoan - repaid);
      const progressPct    = totalLoan > 0 ? Math.min(100, (repaid / totalLoan) * 100) : 0;
      const installmentAmt = +activeLoan.installmentAmount || loanDeductedThisMonth;
      const totalInstallments     = totalLoan > 0 && installmentAmt > 0 ? Math.ceil(totalLoan / installmentAmt) : 0;
      const completedInstallments = installmentAmt > 0 ? Math.floor(repaid / installmentAmt) : 0;
      loanProgressHTML = `
        <div class="slip-sec">
          <div class="slip-sec-title"><i class="fa-solid fa-hand-holding-dollar"></i> Loan / Advance Installment Status<span class="right">Loan #${activeLoan.loanNumber} &middot; ${activeLoan.comment||'Active loan'}</span></div>
          <div class="loan-prog">
            <div class="loan-prog-row">
              <div class="ttl">Installment #${completedInstallments+1} of ${totalInstallments}</div>
              <div class="meta">PKR ${fmtMoney(repaid)} of PKR ${fmtMoney(totalLoan)} repaid &middot; ${progressPct.toFixed(1)}% complete</div>
            </div>
            <div class="loan-prog-bar-wrap"><div class="loan-prog-bar" style="width:${progressPct}%"></div></div>
            <div class="loan-prog-stats">
              <div class="loan-prog-stat"><label>Principal</label><div class="v">PKR ${fmtMoney(totalLoan)}</div></div>
              <div class="loan-prog-stat pos"><label>Repaid Till Date</label><div class="v">PKR ${fmtMoney(repaid)}</div></div>
              <div class="loan-prog-stat warn"><label>Outstanding</label><div class="v">PKR ${fmtMoney(remainingLoan)}</div></div>
              <div class="loan-prog-stat"><label>This Month Deduction</label><div class="v">PKR ${fmtMoney(loanDeductedThisMonth)}</div></div>
            </div>
          </div>
        </div>`;
    }

    const allPayThis = empPayroll[e.id] || {};
    const ytdRecs    = Object.values(allPayThis).filter(r => r.year === year && r.month);
    const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const ytdUntilThis = ytdRecs.filter(r => monthOrder.indexOf(r.month) <= monthOrder.indexOf(monthName));
    const ytd = ytdUntilThis.reduce((s, r) => ({
      gross: s.gross + (r.totalGross || 0),
      ded:   s.ded   + (r.totalDeductions || 0),
      net:   s.net   + (r.netPayable || 0),
      bonus: s.bonus + (r.bonus || 0),
      paid:  s.paid  + (r.paidAmount || 0),
    }), { gross: 0, ded: 0, net: 0, bonus: 0, paid: 0 });

    const numToWords = (n) => {
      n = Math.floor(n);
      if (n === 0) return 'Zero';
      const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      const inWords = (n) => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n/10)] + (n % 10 ? ' ' + a[n%10] : '');
        if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n%100) : '');
        if (n < 100000) return inWords(Math.floor(n/1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n%1000) : '');
        if (n < 10000000) return inWords(Math.floor(n/100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n%100000) : '');
        return inWords(Math.floor(n/10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n%10000000) : '');
      };
      return inWords(n);
    };
    const netInWords = numToWords(rec.netPayable || 0) + ' Pakistani Rupees Only';

    const payRef = `SM-${year}${String(monthIdx).padStart(2,'0')}-${String(e.id).padStart(3,'0')}-${(Math.abs((e.id*7+monthIdx*13+year)%9000)+1000)}`;

    const remarks = [];
    if (rec.bonus > 0)         remarks.push(`Performance bonus of PKR ${fmtMoney(rec.bonus)} approved for ${monthName} ${year} by the administration.`);
    if (rec.fineDeduct > 0)    remarks.push(`Fine deduction of PKR ${fmtMoney(rec.fineDeduct)} applied${rec.fineComment?` — "${rec.fineComment}"`:''}.`);
    if (rec.leaveCount > 0)    remarks.push(`${rec.leaveCount} unpaid leave day${rec.leaveCount>1?'s':''} adjusted${rec.leaveComment?` — "${rec.leaveComment}"`:''}.`);
    if (rec.absentCount > 0)   remarks.push(`${rec.absentCount} unauthorized absent day${rec.absentCount>1?'s':''} deducted from gross.`);
    if (loanDeductedThisMonth > 0) remarks.push(`Monthly loan installment of PKR ${fmtMoney(loanDeductedThisMonth)} adjusted against the active loan ledger.`);
    if (rec.status === 'Paid')          remarks.push(`Net salary disbursed in full on ${fmtDate(rec.paidDate)} via ${payMethod}.`);
    else if (rec.status === 'Partially Paid') remarks.push(`Partial payment of PKR ${fmtMoney(totalPaid)} disbursed; PKR ${fmtMoney(remaining)} balance pending.`);
    if (remarks.length === 0) remarks.push(`Standard salary processed for ${monthName} ${year} with no exceptional adjustments.`);

    /* Keep the deductions breakdown summing to rec.totalDeductions (same idea as the
       earnings residual) so Total Deductions — and therefore Net = Gross − Deductions —
       always reconciles even if the employee's deduction heads changed after generation. */
    const dedShownParts = stdDeducts.reduce((s, h) => s + (+h.amount || 0), 0)
      + (+rec.loanDeduct || 0) + (+rec.customLoan || 0) + (+rec.fineDeduct || 0)
      + (+rec.leaveDeduct || 0) + (+rec.absentDeduct || 0);
    const dedResidual = (+rec.totalDeductions || 0) - dedShownParts;

    body = `
      <div class="r-title">Salary Slip — ${monthName} ${year}<span class="badge">${e.eid}</span></div>
      ${reportEmpBlock(C, e, ctx)}

      <div class="slip-sec">
        <div class="slip-sec-title"><i class="fa-solid fa-calendar-check"></i> Pay Period &amp; Attendance Summary<span class="right">Attendance: ${attendancePct}%</span></div>
        <div class="att-row">
          <div class="att-cell info"><label>Working Days</label><div class="v">${workingDays}</div></div>
          <div class="att-cell warn"><label>Public Holidays</label><div class="v">${publicHolidays}</div></div>
          <div class="att-cell info"><label>Effective Days</label><div class="v">${effectiveWorkingDays}</div></div>
          <div class="att-cell pos"><label>Days Present</label><div class="v">${daysPresent}</div></div>
          <div class="att-cell warn"><label>Leaves Taken</label><div class="v">${leaves}</div></div>
          <div class="att-cell neg"><label>Absent Days</label><div class="v">${absent}</div></div>
        </div>
        <div class="slip-fields cols-3" style="margin-top:7px">
          <div class="slip-field compact"><label>Casual Leave Used</label><div class="v">${leavesUsed.casual} / ${leavesAllotted.casual} days</div></div>
          <div class="slip-field compact"><label>Sick Leave Used</label><div class="v">${leavesUsed.sick} / ${leavesAllotted.sick} days</div></div>
          <div class="slip-field compact"><label>Annual Leave Used</label><div class="v">${leavesUsed.annual} / ${leavesAllotted.annual} days</div></div>
        </div>
        ${lateDays>0?`<div class="slip-remarks" style="margin-top:7px"><strong>Late arrivals this month:</strong> ${lateDays} occasion${lateDays>1?'s':''} (within HR grace policy — no deduction applied).</div>`:''}
      </div>

      <div class="slip-sec">
        <div class="slip-sec-title"><i class="fa-solid fa-coins"></i> Earnings &amp; Salary Structure<span class="right">Per ${monthName} ${year} payroll</span></div>
        <div class="slip-fields">
          <div class="slip-field"><label>Basic Pay</label><div class="v">PKR ${fmtMoney(basic)}</div></div>
          ${allowances.map(h => `<div class="slip-field"><label>${h.name}</label><div class="v">PKR ${fmtMoney(+h.amount||0)}</div></div>`).join('')}
          ${rec.bonus>0 ? `<div class="slip-field pos"><label>Bonus / Incentive</label><div class="v">+ PKR ${fmtMoney(rec.bonus)}</div></div>` : ''}
        </div>
        <div class="slip-subtotal"><span>Total Gross Earnings</span><span class="v">PKR ${fmtMoney(rec.totalGross||0)}</span></div>
      </div>

      <div class="slip-sec">
        <div class="slip-sec-title"><i class="fa-solid fa-minus-circle"></i> Deductions Applied<span class="right">All values in PKR</span></div>
        <div class="slip-fields">
          ${stdDeducts.map(h => `<div class="slip-field ded"><label>${h.name}</label><div class="v">PKR ${fmtMoney(+h.amount||0)}</div></div>`).join('')}
          <div class="slip-field ded"><label>Loan Deduction</label><div class="v">PKR ${fmtMoney(rec.loanDeduct||0)}</div></div>
          ${(rec.customLoan||0) > 0 ? `<div class="slip-field ded"><label>Custom Loan Deduction</label><div class="v">PKR ${fmtMoney(rec.customLoan)}</div></div>` : ''}
          <div class="slip-field ded"><label>Fine${rec.fineComment?' *':''}</label><div class="v">PKR ${fmtMoney(rec.fineDeduct||0)}</div></div>
          <div class="slip-field ded"><label>Leave Deduction${rec.leaveCount?` (${rec.leaveCount}d)`:''}</label><div class="v">PKR ${fmtMoney(rec.leaveDeduct||0)}</div></div>
          <div class="slip-field ded"><label>Absent Deduction${rec.absentCount?` (${rec.absentCount}d)`:''}</label><div class="v">PKR ${fmtMoney(rec.absentDeduct||0)}</div></div>
          ${Math.abs(dedResidual) >= 1 ? `<div class="slip-field ded"><label>Other Deductions</label><div class="v">PKR ${fmtMoney(dedResidual)}</div></div>` : ''}
        </div>
        <div class="slip-subtotal"><span>Total Deductions</span><span class="v">PKR ${fmtMoney(rec.totalDeductions||0)}</span></div>
      </div>

      <div class="slip-net-card">
        <div>
          <div class="lbl"><i class="fa-solid fa-wallet"></i> Net Payable</div>
          <div class="in-words">${netInWords}</div>
        </div>
        <div class="amt">PKR ${fmtMoney(rec.netPayable||0)}</div>
      </div>

      ${loanProgressHTML}

      <div class="slip-sec">
        <div class="slip-sec-title"><i class="fa-solid fa-chart-line"></i> Year-to-Date Summary (${year})<span class="right">${ytdUntilThis.length} month${ytdUntilThis.length!==1?'s':''} processed</span></div>
        <div class="ytd-grid">
          <div class="ytd-stat"><label>YTD Gross Earnings</label><div class="v">PKR ${fmtMoney(ytd.gross)}</div></div>
          <div class="ytd-stat neg"><label>YTD Deductions</label><div class="v">PKR ${fmtMoney(ytd.ded)}</div></div>
          <div class="ytd-stat pos"><label>YTD Net Earned</label><div class="v">PKR ${fmtMoney(ytd.net)}</div></div>
          <div class="ytd-stat pos"><label>YTD Bonus Received</label><div class="v">PKR ${fmtMoney(ytd.bonus)}</div></div>
        </div>
      </div>

      <div class="slip-sec">
        <div class="slip-sec-title"><i class="fa-solid fa-money-bill-wave"></i> Payment Settlement<span class="right">Ref #${payRef}</span></div>
        <div class="slip-settle">
          <div class="slip-settle-tile net"><label>Net Payable</label><div class="v">PKR ${fmtMoney(rec.netPayable||0)}</div></div>
          <div class="slip-settle-tile paid"><label>Paid So Far</label><div class="v">PKR ${fmtMoney(totalPaid)}</div></div>
          <div class="slip-settle-tile rem ${isFullyPaid?'zero':''}"><label>Remaining</label><div class="v">PKR ${fmtMoney(remaining)}</div></div>
        </div>
        <div class="slip-fields cols-3">
          <div class="slip-field compact"><label>Payment Method</label><div class="v">${payMethod}</div></div>
          <div class="slip-field compact"><label>Bank / Account</label><div class="v">${e.bankName||'—'}${e.bankAcc?' &middot; '+e.bankAcc:''}</div></div>
          <div class="slip-field compact"><label>Status</label><div class="v"><span class="status-pill ${rec.status==='Paid'?'paid':(rec.status==='Partially Paid'?'partial':'gen')}">${rec.status||'—'}</span></div></div>
        </div>
      </div>

      ${payments.length ? `
      <div class="slip-sec">
        <div class="slip-sec-title"><i class="fa-solid fa-receipt"></i> Payment Transactions<span class="right">${payments.length} entr${payments.length!==1?'ies':'y'}</span></div>
        <table>
          <thead><tr><th style="width:38px">#</th><th>Date</th><th class="num">Amount</th><th>Reference / Comment</th></tr></thead>
          <tbody>
            ${payments.map((p, i) => `<tr>
              <td>${i+1}</td>
              <td class="nw">${fmtDate(p.date)||'—'}</td>
              <td class="num pos">+ ${fmtMoney(p.amount)}</td>
              <td style="color:${C.muted};font-style:italic">${p.comment||'No comment'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <div class="slip-sec">
        <div class="slip-sec-title"><i class="fa-solid fa-note-sticky"></i> Notes &amp; Remarks</div>
        <div class="slip-remarks">
          ${remarks.map(r => `<div style="margin-bottom:4px"><strong>&bull;</strong> ${r}</div>`).join('')}
        </div>
      </div>

      ${reportSignatures(C)}
      ${reportFooter(C, `Salary slip for <strong>${getFullName(e)}</strong> &middot; <strong>${monthName} ${year}</strong> &middot; Ref #${payRef}.<br>This is a computer-generated document; signatures are required only on the printed copy for official records.`, ctx)}
    `;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Salary Slip — ${getFullName(e)} — ${monthName} ${year}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"><style>${reportBaseCSS(C, style, 'portrait')}${slipCSS}</style></head><body>
    <div class="page">
      ${reportHeader(C, 'Salary Slip', style, `Period: <strong>${monthName} ${year}</strong>`, ctx)}
      ${body}
    </div>
    ${CLOSE_SCRIPT_AFTER_PRINT}
  </body></html>`;
}

/* ════════════════ PAY HISTORY LEDGER ════════════════ */
export function generatePayHistoryReportHTML(e, fromKey, toKey, style, ctx) {
  const { fmtMoney, fmtDate, getFullName, empPayroll } = ctx;
  const C = reportColors(style);
  const allPay = empPayroll[e.id] || {};
  const records = Object.entries(allPay)
    .filter(([k]) => k >= fromKey && k <= toKey)
    .map(([k, r]) => ({ key: k, ...r }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const totals = records.reduce((s, r) => ({
    basic:    s.basic    + (r.basicPay || 0),
    allow:    s.allow    + ((r.totalGross || 0) - (r.basicPay || 0) - (r.bonus || 0)),
    bonus:    s.bonus    + (r.bonus || 0),
    gross:    s.gross    + (r.totalGross || 0),
    deduct:   s.deduct   + (r.totalDeductions || 0),
    loanRec:  s.loanRec  + (r.loanDeduct || 0) + (r.customLoan || 0),
    advRec:   s.advRec   + (r.advanceRecovery || 0),
    otherDed: s.otherDed + (r.fineDeduct || 0) + (r.leaveDeduct || 0) + (r.absentDeduct || 0) + (r.stdDeductions || 0),
    net:      s.net      + (r.netPayable || 0),
    paid:     s.paid     + (r.paidAmount || 0),
  }), { basic:0, allow:0, bonus:0, gross:0, deduct:0, loanRec:0, advRec:0, otherDed:0, net:0, paid:0 });

  const payMethod = e.payMethod || 'Bank Transfer';
  const monthShort = m => ({ January:'Jan', February:'Feb', March:'Mar', April:'Apr', May:'May', June:'Jun', July:'Jul', August:'Aug', September:'Sep', October:'Oct', November:'Nov', December:'Dec' })[m] || m;
  const fmtKey = k => {
    const [y, m] = k.split('-');
    return ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m, 10)] + ' ' + y;
  };

  const tableHTML = records.length ? `
    <table>
      <thead><tr>
        <th>#</th><th>Month</th>
        <th class="num">Gross</th><th class="num">Allow.</th><th class="num">Bonus</th>
        <th class="num">Adv. Recovery</th><th class="num">Loan Recovery</th>
        <th class="num">Net Paid</th><th>Pay Date</th>
      </tr></thead>
      <tbody>
        ${records.map((r, i) => {
          const allow   = (r.totalGross || 0) - (r.basicPay || 0) - (r.bonus || 0);
          const loanRec = (r.loanDeduct || 0) + (r.customLoan || 0);
          const advRec  = (r.advanceRecovery || 0);
          return `<tr>
            <td>${i+1}</td>
            <td class="nw" style="font-weight:700">${monthShort(r.month)} ${r.year}</td>
            <td class="num">${fmtMoney(r.totalGross||0)}</td>
            <td class="num">${fmtMoney(allow)}</td>
            <td class="num ${r.bonus?'pos':''}">${fmtMoney(r.bonus||0)}</td>
            <td class="num ${advRec>0?'neg':''}">${fmtMoney(advRec)}</td>
            <td class="num ${loanRec>0?'neg':''}">${fmtMoney(loanRec)}</td>
            <td class="num" style="font-weight:800;color:${style==='bw'?'#000':C.brand}">${fmtMoney(r.paidAmount||r.netPayable||0)}</td>
            <td class="nw">${fmtDate(r.paidDate)||'—'}</td>
          </tr>`;
        }).join('')}
        <tr class="subtotal">
          <td colspan="2">Totals (${records.length} months)</td>
          <td class="num">${fmtMoney(totals.gross)}</td>
          <td class="num">${fmtMoney(totals.allow)}</td>
          <td class="num">${fmtMoney(totals.bonus)}</td>
          <td class="num">${fmtMoney(totals.advRec)}</td>
          <td class="num">${fmtMoney(totals.loanRec)}</td>
          <td class="num">${fmtMoney(totals.paid)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>` : `<div class="empty-msg">No payroll records found between ${fmtKey(fromKey)} and ${fmtKey(toKey)}.</div>`;

  const deductBreakHTML = records.length ? `
    <div class="r-title" style="margin-top:14px">Deductions Detail by Month<span class="badge">${records.length} entries</span></div>
    <table>
      <thead><tr>
        <th>Month</th>
        <th class="num">Std. Deductions</th><th class="num">Fine</th>
        <th class="num">Leave</th><th class="num">Absent</th>
        <th class="num">Adv. Recovery</th><th class="num">Loan Recovery</th>
        <th class="num">Total Deduct</th>
      </tr></thead>
      <tbody>
        ${records.map(r => `<tr>
          <td class="nw" style="font-weight:700">${monthShort(r.month)} ${r.year}</td>
          <td class="num">${fmtMoney(r.stdDeductions||0)}</td>
          <td class="num ${(r.fineDeduct||0)>0?'neg':''}">${fmtMoney(r.fineDeduct||0)}</td>
          <td class="num ${(r.leaveDeduct||0)>0?'neg':''}">${fmtMoney(r.leaveDeduct||0)}</td>
          <td class="num ${(r.absentDeduct||0)>0?'neg':''}">${fmtMoney(r.absentDeduct||0)}</td>
          <td class="num ${(r.advanceRecovery||0)>0?'neg':''}">${fmtMoney(r.advanceRecovery||0)}</td>
          <td class="num ${((r.loanDeduct||0)+(r.customLoan||0))>0?'neg':''}">${fmtMoney((r.loanDeduct||0)+(r.customLoan||0))}</td>
          <td class="num" style="font-weight:800;color:${C.err}">${fmtMoney(r.totalDeductions||0)}</td>
        </tr>`).join('')}
        <tr class="subtotal">
          <td>Totals</td>
          <td class="num">${fmtMoney(records.reduce((s, r) => s + (r.stdDeductions || 0), 0))}</td>
          <td class="num">${fmtMoney(records.reduce((s, r) => s + (r.fineDeduct  || 0), 0))}</td>
          <td class="num">${fmtMoney(records.reduce((s, r) => s + (r.leaveDeduct || 0), 0))}</td>
          <td class="num">${fmtMoney(records.reduce((s, r) => s + (r.absentDeduct|| 0), 0))}</td>
          <td class="num">${fmtMoney(totals.advRec)}</td>
          <td class="num">${fmtMoney(totals.loanRec)}</td>
          <td class="num">${fmtMoney(totals.deduct)}</td>
        </tr>
      </tbody>
    </table>` : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pay History Ledger — ${getFullName(e)}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"><style>${reportBaseCSS(C, style, 'portrait')}</style></head><body>
    <div class="page">
      ${reportHeader(C, 'Pay History Ledger', style, `Range: <strong>${fmtKey(fromKey)} &rarr; ${fmtKey(toKey)}</strong> &middot; Method: <strong>${payMethod}</strong>`, ctx)}
      <div class="r-title">Employee Details<span class="badge">${e.eid}</span></div>
      ${reportEmpBlock(C, e, ctx)}
      <div class="r-summary-row">
        <div class="r-stat"><label>Total Gross</label><div class="v">${fmtMoney(totals.gross)}</div></div>
        <div class="r-stat pos"><label>Total Net Paid</label><div class="v">${fmtMoney(totals.paid)}</div></div>
        <div class="r-stat warn"><label>Total Deductions</label><div class="v">${fmtMoney(totals.deduct)}</div></div>
        <div class="r-stat"><label>Total Bonus</label><div class="v">${fmtMoney(totals.bonus)}</div></div>
      </div>
      <div class="r-title">Pay History Ledger<span class="badge">${records.length} months &middot; ${fmtKey(fromKey)} → ${fmtKey(toKey)}</span></div>
      ${tableHTML}
      ${deductBreakHTML}
      <div class="r-title" style="margin-top:14px">Final Totals Summary<span class="badge">PKR</span></div>
      <table>
        <thead><tr><th>Description</th><th class="num">Amount (PKR)</th></tr></thead>
        <tbody>
          <tr><td>Total Gross Salary</td><td class="num">${fmtMoney(totals.gross)}</td></tr>
          <tr><td>Total Allowances (computed)</td><td class="num">${fmtMoney(totals.allow)}</td></tr>
          <tr><td>Total Bonus Issued</td><td class="num pos">${fmtMoney(totals.bonus)}</td></tr>
          <tr><td>Total Standard + Other Deductions</td><td class="num neg">${fmtMoney(totals.otherDed)}</td></tr>
          <tr><td>Total Advance Recovery</td><td class="num neg">${fmtMoney(totals.advRec)}</td></tr>
          <tr><td>Total Loan Recovery</td><td class="num neg">${fmtMoney(totals.loanRec)}</td></tr>
          <tr><td>Total Deductions (combined)</td><td class="num neg">${fmtMoney(totals.deduct)}</td></tr>
          <tr class="subtotal"><td>Total Net Paid</td><td class="num">${fmtMoney(totals.paid)}</td></tr>
        </tbody>
      </table>
      ${reportSignatures(C)}
      ${reportFooter(C, `This Pay History Ledger summarises all payroll records issued to <strong>${getFullName(e)}</strong> between <strong>${fmtKey(fromKey)}</strong> and <strong>${fmtKey(toKey)}</strong>.`, ctx)}
    </div>
    ${CLOSE_SCRIPT_AFTER_PRINT}
  </body></html>`;
}

/* ════════════════ LOAN / ADVANCE REPORT ════════════════ */
export function generateLoanReportHTML(e, style, ctx) {
  const { fmtMoney, fmtDate, getFullName, empLoans } = ctx;
  const C = reportColors(style);
  const loans = empLoans[e.id] || [];
  const totalIssued      = loans.reduce((s, l) => s + (+l.amount || 0), 0);
  const totalDeducted    = loans.reduce((s, l) => s + (l.received || []).reduce((a, r) => a + (+r.amount || 0), 0), 0);
  const totalOutstanding = loans.filter(l => l.status === 'active').reduce((s, l) => s + (+l.remaining || 0), 0);

  const loanBlocks = loans.length ? loans.map((l) => {
    const returned = (l.received || []).reduce((s, r) => s + (+r.amount || 0), 0);
    let bal = +l.amount || 0;
    const txRows = [
      `<tr><td>${fmtDate(l.createdAt)||'—'}</td><td><strong>Loan Issued</strong>${l.comment&&l.comment!=='N/A'?' — '+l.comment:''}</td><td class="num">${fmtMoney(+l.amount||0)}</td><td class="num">—</td><td class="num" style="font-weight:800">${fmtMoney(bal)}</td></tr>`,
    ];
    (l.received || []).forEach((r, ri) => {
      bal -= (+r.amount || 0);
      txRows.push(`<tr>
        <td>${fmtDate(r.date)||'—'}</td>
        <td>Repayment #${ri+1}${r.comment?' — '+r.comment:''}</td>
        <td class="num">—</td>
        <td class="num pos">${fmtMoney(r.amount)}</td>
        <td class="num" style="font-weight:800">${fmtMoney(Math.max(0,bal))}</td>
      </tr>`);
    });
    if (!(l.received || []).length) {
      txRows.push(`<tr><td colspan="5" style="text-align:center;color:${C.muted};font-style:italic;padding:11px">No repayment transactions recorded yet</td></tr>`);
    }
    const sp = l.status === 'returned' ? 'paid' : 'gen';
    return `
      <div style="margin-bottom:20px;page-break-inside:avoid">
        <div class="r-title" style="margin-top:0">Loan #${l.loanNumber} — ${l.comment&&l.comment!=='N/A'?l.comment:'Untitled Loan'}<span class="status-pill ${sp}" style="font-size:10px">${l.status==='returned'?'Returned / Closed':'Active'}</span></div>
        <div class="r-emp-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="f"><label>Loan / Advance Type</label><span>${l.repaymentType||'—'}${l.installmentType?' &middot; '+l.installmentType:''}</span></div>
          <div class="f"><label>Opening Balance</label><span>PKR ${fmtMoney(+l.amount||0)}</span></div>
          <div class="f"><label>Issued Amount</label><span>PKR ${fmtMoney(+l.amount||0)}</span></div>
          <div class="f"><label>Monthly Deduction</label><span>${l.repaymentType==='Installment'?'PKR '+fmtMoney(+l.installmentAmount||0):'One-time'}</span></div>
          <div class="f"><label>Deducted Amount</label><span style="color:${C.success}">PKR ${fmtMoney(returned)}</span></div>
          <div class="f"><label>Remaining Balance</label><span style="color:${(+l.remaining||0)>0?C.warn:C.success}">PKR ${fmtMoney(+l.remaining||0)}</span></div>
          <div class="f"><label>Issue Date</label><span>${fmtDate(l.createdAt)||'—'}</span></div>
          <div class="f"><label>Deduction Start Month</label><span>${fmtDate(l.deductDate)||'—'}</span></div>
          <div class="f"><label>Status</label><span style="color:${l.status==='returned'?C.success:C.warn}">${l.status==='returned'?'Fully Returned':'Active'}</span></div>
        </div>
        <table>
          <thead><tr>
            <th style="width:90px">Date</th><th>Description</th>
            <th class="num">Debit / Issued</th><th class="num">Credit / Deducted</th><th class="num">Balance</th>
          </tr></thead>
          <tbody>${txRows.join('')}
            <tr class="subtotal">
              <td colspan="2">Subtotals</td>
              <td class="num">${fmtMoney(+l.amount||0)}</td>
              <td class="num">${fmtMoney(returned)}</td>
              <td class="num">${fmtMoney(+l.remaining||0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join('') : `<div class="empty-msg">No loans or advances recorded for this employee.</div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Loan / Advance Report — ${getFullName(e)}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"><style>${reportBaseCSS(C, style, 'portrait')}</style></head><body>
    <div class="page">
      ${reportHeader(C, 'Loan / Advance Account Statement', style, `Total Loans: <strong>${loans.length}</strong>`, ctx)}
      <div class="r-title">Employee Details<span class="badge">${e.eid}</span></div>
      ${reportEmpBlock(C, e, ctx)}
      <div class="r-summary-row">
        <div class="r-stat"><label>Total Loans</label><div class="v">${loans.length}</div></div>
        <div class="r-stat"><label>Total Issued</label><div class="v">${fmtMoney(totalIssued)}</div></div>
        <div class="r-stat pos"><label>Total Deducted</label><div class="v">${fmtMoney(totalDeducted)}</div></div>
        <div class="r-stat warn"><label>Outstanding</label><div class="v">${fmtMoney(totalOutstanding)}</div></div>
      </div>
      ${loanBlocks}
      <div class="r-title">Final Account Summary<span class="badge">PKR</span></div>
      <table>
        <thead><tr><th>Description</th><th class="num">Amount (PKR)</th></tr></thead>
        <tbody>
          <tr><td>Total Advance / Loan Given</td><td class="num">${fmtMoney(totalIssued)}</td></tr>
          <tr><td>Total Deducted / Repaid</td><td class="num pos">${fmtMoney(totalDeducted)}</td></tr>
          <tr class="subtotal"><td>Remaining Outstanding Balance</td><td class="num">${fmtMoney(totalOutstanding)}</td></tr>
        </tbody>
      </table>
      ${reportSignatures(C)}
      ${reportFooter(C, `This Loan / Advance Account Statement reflects every loan disbursement and repayment recorded for <strong>${getFullName(e)}</strong> in the School Mentor ERP up to <strong>${fmtDate(resolveBranch(ctx).generatedDate)}</strong>.`, ctx)}
    </div>
    ${CLOSE_SCRIPT_AFTER_PRINT}
  </body></html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   HR REPORTS MODULE — module-level reports (Reports tab cards).
   Uses the simpler `rep-*` chrome that mirrors the Accounts module.

   Helpers:
     • hrFmtMoney / hrFmtDate / hrToday
     • hrOpenReport(title, filtersHtml, innerHtml)

   Generators (each returns a complete printable HTML document):
     • generateHrDirectoryReport
     • generateHrSalaryRegister      — needs month / year
     • generateHrLoanSummary
     • generateHrDeptSummary
     • generateHrLeaveRegister
     • generateHrPayrollSummary      — needs month / year
   ═══════════════════════════════════════════════════════════════════ */

const HR_LOGO_SVG = `<svg viewBox="0 0 16 16" fill="none"><path d="M8 1L1 5l7 3.5L15 5 8 1z" stroke="#1E3A8A" stroke-width="1" stroke-linejoin="round"/><path d="M1 9l7 3.5L15 9" stroke="#1E3A8A" stroke-width="0.8" stroke-linecap="round"/><path d="M1 12l7 3.5L15 12" stroke="#1E3A8A" stroke-width="0.5" stroke-linecap="round" opacity="0.5"/></svg>`;

const hrFmtMoney = (n) => (Math.round(+n || 0)).toLocaleString('en-PK');
const hrFmtDate  = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const hrToday = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
/* "Generated" date shown in the report filter bar — the live /report-header
   generatedDate when available, else today. */
const hrGenLabel = (ctx) => {
  const dt = new Date(resolveBranch(ctx).generatedDate);
  return isNaN(dt) ? hrToday() : dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

/* Shared popup shell — Accounts-module style. Returns a full HTML document.
   Honors ctx.style: 'bw' renders a true colorless / low-ink version (white
   backgrounds, black/gray text, light borders) while the default keeps the
   ERP-blue theme. */
function hrBuildReportHTML(fileTitle, title, filtersHtml, innerHtml, ctx) {
  const b = resolveBranch(ctx);
  const sn = b.name;
  const bw = ctx?.style === 'bw';
  const logoInner = b.logo
    ? `<img src="${b.logo}" alt="School logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : (bw ? HR_LOGO_SVG.replace(/#1E3A8A/g, '#000') : HR_LOGO_SVG);
  // Colorless palette vs ERP-blue palette — one token set drives the whole sheet.
  const C = bw ? {
    brand:'#000', headBorder:'2px solid #000',
    filtersBg:'#fff', filtersBorder:'1px solid #9CA3AF', filtersText:'#222',
    secTtl:'#000', secBorder:'1px solid #000',
    thBg:'#fff', thText:'#000', thBorder:'1px solid #000',
    tdBorder:'1px solid #9CA3AF',
    evenBg:'#F2F2F2',
    totBg:'#F2F2F2', totBorder:'2px solid #000',
    grandBg:'#000', grandText:'#fff',
    footText:'#555', footBorder:'1px solid #9CA3AF',
  } : {
    brand:'#1E3A8A', headBorder:'2px solid #1E3A8A',
    filtersBg:'#F1F5FB', filtersBorder:'none', filtersText:'#333',
    secTtl:'#1E3A8A', secBorder:'1px solid #cdd7ea',
    thBg:'#1E3A8A', thText:'#fff', thBorder:'none',
    tdBorder:'1px solid #e5e9f2',
    evenBg:'#F8FAFF',
    totBg:'#EAF0FA', totBorder:'2px solid #1E3A8A',
    grandBg:'#1E3A8A', grandText:'#fff',
    footText:'#999', footBorder:'1px solid #e5e9f2',
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileTitle}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{background:#fff}
      body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4;}
      .rep-page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;}
      .rep-head{display:flex;align-items:center;gap:14px;border-bottom:${C.headBorder};padding-bottom:10px;margin-bottom:10px}
      .rep-logo{width:42px;height:42px;border:2px solid ${C.brand};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .rep-logo svg{width:22px;height:22px}
      .rep-name{font-size:18px;font-weight:800;color:${C.brand};line-height:1.1}
      .rep-title{font-size:12px;font-weight:600;color:#444;margin-top:3px}
      .rep-filters{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:10.5px;color:${C.filtersText};margin-bottom:12px;background:${C.filtersBg};border:${C.filtersBorder};padding:9px 13px;border-radius:6px}
      .rep-secttl{font-size:12px;font-weight:800;color:${C.secTtl};margin:14px 0 6px;padding-bottom:4px;border-bottom:${C.secBorder};}
      .rep-tbl{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px;}
      .rep-tbl thead{display:table-header-group;}
      .rep-tbl th{background:${C.thBg};color:${C.thText};border:${C.thBorder};padding:6px 7px;text-align:left;font-size:10px;font-weight:700}
      .rep-tbl th.r,.rep-tbl td.r{text-align:right}
      .rep-tbl td{padding:5px 7px;border-bottom:${C.tdBorder};vertical-align:top}
      .rep-tbl tr:nth-child(even) td{background:${C.evenBg}}
      .rep-tot td{background:${C.totBg};font-weight:800;border-top:${C.totBorder}}
      .rep-grandtot td{background:${C.grandBg};color:${C.grandText};font-weight:800;padding:7px 7px}
      .rep-foot{margin-top:16px;text-align:center;font-size:9px;color:${C.footText};border-top:${C.footBorder};padding-top:8px}
      @page{size:A4 portrait;margin:14mm}
      @media print{.rep-page{width:auto;min-height:0;margin:0;padding:0;}body{font-size:10px;}}
    </style></head><body>
    <div class="rep-page">
      <div class="rep-head">
        <div class="rep-logo">${logoInner}</div>
        <div><div class="rep-name">${sn}</div><div class="rep-title">${title}</div>${b.address?`<div class="rep-title" style="font-size:10px;color:#666;margin-top:1px">${b.address}</div>`:''}</div>
      </div>
      <div class="rep-filters">${filtersHtml}</div>
      ${innerHtml}
      <div class="rep-foot">Computer generated report — ${sn} · ${title}</div>
    </div>
    ${CLOSE_SCRIPT_AFTER_PRINT}
    </body></html>`;
}

/* ════════ 1. Employee Directory ════════ */
export function generateHrDirectoryReport(ctx) {
  const { emps, depts, getFullName, getDeptName, getDesigName } = ctx;
  const active = emps.filter(e => e.status === 'Active').length;
  const rows = emps.map((e, i) => `<tr>
    <td>${i+1}</td><td><b>${getFullName(e)}</b></td><td>${e.eid}</td>
    <td>${e.gender||'—'}</td><td>${getDeptName(e.dId)||'—'}</td><td>${getDesigName(e.desId)||'—'}</td>
    <td>${e.phone||'—'}</td><td>${e.join?hrFmtDate(e.join):'—'}</td>
    <td>${e.type||'—'}</td><td>${e.status}</td>
  </tr>`).join('');
  const filters = `<span><b>Total Staff:</b> ${emps.length}</span><span><b>Active:</b> ${active}</span><span><b>Inactive:</b> ${emps.length-active}</span><span><b>Departments:</b> ${depts.length}</span><span><b>Generated:</b> ${hrGenLabel(ctx)}</span>`;
  const inner = `<div class="rep-secttl">Full Staff Directory</div>
    <table class="rep-tbl"><thead><tr>
      <th>#</th><th>Full Name</th><th>Emp ID</th><th>Gender</th>
      <th>Department</th><th>Designation</th><th>Phone</th>
      <th>Joining Date</th><th>Type</th><th>Status</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  return hrBuildReportHTML('Employee Directory', 'Human Resource — Employee Directory', filters, inner, ctx);
}

/* ════════ 2. Salary Register ════════ */
export function generateHrSalaryRegister(ctx, monthKey) {
  const { emps, empPayroll, getFullName, getDeptName } = ctx;
  const [yearVal, monthVal] = (monthKey || '2026-05').split('-');
  const MNAMES = ['', 'January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = MNAMES[parseInt(monthVal, 10)];
  const activeEmps = emps.filter(e => e.status === 'Active');
  let gBasic = 0, gAllow = 0, gBonus = 0, gGross = 0, gDed = 0, gNet = 0;
  const rows = activeEmps.map((e, i) => {
    const rec    = (empPayroll[e.id] || {})[monthKey] || {};
    /* When a payroll is generated, use the record's OWN snapshot (basic/bonus/gross/
       deductions) so the row is internally consistent even if the employee's salary
       changed afterwards. When it isn't generated, fall back to the live employee.  */
    const hasRec = !!rec.payrollID;
    const basic  = hasRec ? (+rec.basicPay || 0) : (+e.basicSalary || 0);
    const bonus  = hasRec ? (+rec.bonus || 0)    : 0;
    const gross  = hasRec ? (+rec.totalGross || 0) : ctx.getEmpTotalGross(e, 0);
    /* Derive Allowances from the gross so Basic + Allowances + Bonus == Gross always
       (folds house/transport/medical/extra allowances + previous arrears into one col). */
    const allow  = gross - basic - bonus;
    const ded    = hasRec ? (+rec.totalDeductions || 0) : ctx.getEmpStdDeductions(e);
    /* Net is always Gross − Deductions of the values actually shown in the row.        */
    const net    = gross - ded;
    const status = rec.status || 'Not Generated';
    gBasic += basic; gAllow += allow; gBonus += bonus; gGross += gross; gDed += ded; gNet += net;
    return `<tr><td>${i+1}</td><td><b>${getFullName(e)}</b></td><td>${e.eid}</td>
      <td>${getDeptName(e.dId)||'—'}</td>
      <td class="r">${hrFmtMoney(basic)}</td><td class="r">${hrFmtMoney(allow)}</td>
      <td class="r">${hrFmtMoney(bonus)}</td><td class="r"><b>${hrFmtMoney(gross)}</b></td>
      <td class="r">${hrFmtMoney(ded)}</td><td class="r"><b>${hrFmtMoney(net)}</b></td>
      <td>${e.payMethod||'—'}</td><td>${status}</td></tr>`;
  }).join('');
  const filters = `<span><b>Period:</b> ${monthName} ${yearVal}</span><span><b>Employees:</b> ${activeEmps.length}</span><span><b>Gross:</b> PKR ${hrFmtMoney(gGross)}</span><span><b>Net Payable:</b> PKR ${hrFmtMoney(gNet)}</span><span><b>Generated:</b> ${hrGenLabel(ctx)}</span>`;
  const inner = `<div class="rep-secttl">Monthly Salary Register — ${monthName} ${yearVal}</div>
    <table class="rep-tbl"><thead><tr>
      <th>#</th><th>Name</th><th>ID</th><th>Department</th>
      <th class="r">Basic</th><th class="r">Allowances</th><th class="r">Bonus</th>
      <th class="r">Gross</th><th class="r">Deductions</th><th class="r">Net Pay</th>
      <th>Pay Method</th><th>Status</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot>
      <tr class="rep-tot"><td colspan="4">Grand Totals — ${activeEmps.length} employees</td>
        <td class="r">${hrFmtMoney(gBasic)}</td><td class="r">${hrFmtMoney(gAllow)}</td>
        <td class="r">${hrFmtMoney(gBonus)}</td><td class="r"><b>${hrFmtMoney(gGross)}</b></td>
        <td class="r">${hrFmtMoney(gDed)}</td><td class="r"><b>${hrFmtMoney(gNet)}</b></td>
        <td colspan="2"></td></tr>
      <tr class="rep-grandtot"><td colspan="9">TOTAL NET PAYABLE — ${monthName} ${yearVal}</td>
        <td class="r"><b>PKR ${hrFmtMoney(gNet)}</b></td><td colspan="2"></td></tr>
    </tfoot></table>`;
  return hrBuildReportHTML(`Salary Register — ${monthName} ${yearVal}`, `Human Resource — Salary Register · ${monthName} ${yearVal}`, filters, inner, ctx);
}

/* ════════ 3. Loan & Advance Ledger ════════ */
export function generateHrLoanSummary(ctx) {
  const { emps, empLoans, getFullName, getDeptName } = ctx;
  let gIssued = 0, gDeducted = 0, gOutstanding = 0;
  const rows = emps.map((e, i) => {
    const loans       = empLoans[e.id] || [];
    const issued      = loans.reduce((s, l) => s + (+l.amount || 0), 0);
    const deducted    = loans.reduce((s, l) => s + (l.received || []).reduce((a, r) => a + (+r.amount || 0), 0), 0);
    const outstanding = loans.filter(l => l.status === 'active').reduce((s, l) => s + (+l.remaining || 0), 0);
    gIssued += issued; gDeducted += deducted; gOutstanding += outstanding;
    return `<tr><td>${i+1}</td><td><b>${getFullName(e)}</b></td><td>${e.eid}</td>
      <td>${getDeptName(e.dId)||'—'}</td>
      <td class="r">${loans.length||'—'}</td>
      <td class="r">${loans.length?hrFmtMoney(issued):'—'}</td>
      <td class="r">${loans.length?hrFmtMoney(deducted):'—'}</td>
      <td class="r"><b>${loans.length?hrFmtMoney(outstanding):'—'}</b></td>
      <td>${loans.length?(loans.some(l=>l.status==='active')?'Active':'Cleared'):'No Loan'}</td></tr>`;
  }).join('');
  const empWithLoans = emps.filter(e => (empLoans[e.id] || []).length > 0).length;
  const filters = `<span><b>With Loans:</b> ${empWithLoans}</span><span><b>Total Issued:</b> PKR ${hrFmtMoney(gIssued)}</span><span><b>Recovered:</b> PKR ${hrFmtMoney(gDeducted)}</span><span><b>Outstanding:</b> PKR ${hrFmtMoney(gOutstanding)}</span><span><b>Generated:</b> ${hrGenLabel(ctx)}</span>`;
  const inner = `<div class="rep-secttl">Loan & Advance Ledger — All Employees</div>
    <table class="rep-tbl"><thead><tr>
      <th>#</th><th>Employee Name</th><th>ID</th><th>Department</th>
      <th class="r">Loans</th><th class="r">Total Issued</th>
      <th class="r">Recovered</th><th class="r">Outstanding</th><th>Status</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot>
      <tr class="rep-tot"><td colspan="5">Totals</td>
        <td class="r">${hrFmtMoney(gIssued)}</td><td class="r">${hrFmtMoney(gDeducted)}</td>
        <td class="r"><b>${hrFmtMoney(gOutstanding)}</b></td><td></td></tr>
      <tr class="rep-grandtot"><td colspan="7">TOTAL OUTSTANDING BALANCE</td>
        <td class="r"><b>PKR ${hrFmtMoney(gOutstanding)}</b></td><td></td></tr>
    </tfoot></table>`;
  return hrBuildReportHTML('Loan & Advance Ledger', 'Human Resource — Loan & Advance Ledger', filters, inner, ctx);
}

/* ════════ 4. Department Summary ════════ */
export function generateHrDeptSummary(ctx) {
  const { emps, depts, desigs, getFullName, getDesigName } = ctx;
  let gHead = 0, gCost = 0;
  depts.forEach(d => {
    gHead += emps.filter(e => e.dId === d.id && e.status === 'Active').length;
    gCost += emps.filter(e => e.dId === d.id && e.status === 'Active').reduce((s, e) => s + ctx.getEmpTotalGross(e, 0), 0);
  });
  const overviewRows = depts.map((d, i) => {
    const dEmps = emps.filter(e => e.dId === d.id && e.status === 'Active');
    const cost  = dEmps.reduce((s, e) => s + ctx.getEmpTotalGross(e, 0), 0);
    return `<tr><td>${i+1}</td><td><b>${d.name}</b></td><td>${d.desc||'—'}</td>
      <td class="r">${desigs.filter(x => x.dId === d.id).length}</td>
      <td class="r"><b>${dEmps.length}</b></td>
      <td class="r"><b>${hrFmtMoney(cost)}</b></td>
      <td class="r">${gCost > 0 ? ((cost / gCost) * 100).toFixed(1) + '%' : '—'}</td></tr>`;
  }).join('');
  let detailHTML = '';
  depts.forEach(d => {
    const dEmps = emps.filter(e => e.dId === d.id && e.status === 'Active');
    if (!dEmps.length) return;
    detailHTML += `<div class="rep-secttl">${d.name} — ${dEmps.length} Active Employee${dEmps.length!==1?'s':''}</div>
      <table class="rep-tbl"><thead><tr>
        <th>#</th><th>Name</th><th>ID</th><th>Designation</th><th>Type</th><th>Joining Date</th><th class="r">Gross Salary</th>
      </tr></thead><tbody>${dEmps.map((e, i) => `<tr>
        <td>${i+1}</td><td><b>${getFullName(e)}</b></td><td>${e.eid}</td>
        <td>${getDesigName(e.desId)||'—'}</td><td>${e.type||'Permanent'}</td>
        <td>${e.join?hrFmtDate(e.join):'—'}</td>
        <td class="r"><b>${hrFmtMoney(ctx.getEmpTotalGross(e, 0))}</b></td>
      </tr>`).join('')}</tbody></table>`;
  });
  const filters = `<span><b>Departments:</b> ${depts.length}</span><span><b>Total Headcount:</b> ${gHead}</span><span><b>Monthly Cost:</b> PKR ${hrFmtMoney(gCost)}</span><span><b>Generated:</b> ${hrGenLabel(ctx)}</span>`;
  const inner = `<div class="rep-secttl">Department Overview</div>
    <table class="rep-tbl"><thead><tr>
      <th>#</th><th>Department</th><th>Description</th>
      <th class="r">Designations</th><th class="r">Headcount</th>
      <th class="r">Monthly Cost</th><th class="r">% of Total</th>
    </tr></thead><tbody>${overviewRows}</tbody>
    <tfoot>
      <tr class="rep-tot"><td colspan="4">Grand Total</td>
        <td class="r"><b>${gHead}</b></td><td class="r"><b>${hrFmtMoney(gCost)}</b></td><td class="r">100%</td></tr>
      <tr class="rep-grandtot"><td colspan="5">TOTAL MONTHLY SALARY COST</td>
        <td class="r"><b>PKR ${hrFmtMoney(gCost)}</b></td><td></td></tr>
    </tfoot></table>${detailHTML}`;
  return hrBuildReportHTML('Department Summary', 'Human Resource — Department Summary Report', filters, inner, ctx);
}

/* ════════ 5. Leave & Attendance Register ════════ */
export function generateHrLeaveRegister(ctx) {
  const { emps, getFullName, getDeptName } = ctx;
  const activeEmps = emps.filter(e => e.status === 'Active');
  const rows = activeEmps.map((e, i) => {
    const lv  = e.leaves || {};
    /* Balance = DB ka leaveBalance jab wo asal (>0) ho; warna kul allotted
       (Annual + Casual + Sick). Pehle leaveApiToForm hamesha 0/'' deta tha (kabhi
       undefined nahi), is liye fallback chalta hi nahi tha aur Balance 0 dikhta tha. */
    const totalAllot = (Number(lv.annual) || 0) + (Number(lv.casual) || 0) + (Number(lv.sick) || 0);
    const bal = (Number(lv.balance) > 0) ? Number(lv.balance) : totalAllot;
    return `<tr><td>${i+1}</td><td><b>${getFullName(e)}</b></td><td>${e.eid}</td>
      <td>${getDeptName(e.dId)||'—'}</td><td>${lv.policy||'Standard'}</td>
      <td class="r">${lv.annual||0}</td><td class="r">${lv.casual||0}</td>
      <td class="r">${lv.sick||0}</td><td class="r">${lv.maternity||0}</td>
      <td class="r"><b>${bal}</b></td>
      <td>${lv.deductEn?'Yes':'No'}</td>
      <td class="r">${lv.absentDed?'PKR '+hrFmtMoney(lv.absentDed):'—'}</td></tr>`;
  }).join('');
  const deductCount = activeEmps.filter(e => e.leaves && e.leaves.deductEn).length;
  const filters = `<span><b>Active Employees:</b> ${activeEmps.length}</span><span><b>Deduction Enabled:</b> ${deductCount}</span><span><b>Generated:</b> ${hrGenLabel(ctx)}</span>`;
  const inner = `<div class="rep-secttl">Leave Entitlements & Balances — All Active Employees</div>
    <table class="rep-tbl"><thead><tr>
      <th>#</th><th>Employee Name</th><th>ID</th><th>Department</th><th>Policy</th>
      <th class="r">Annual</th><th class="r">Casual</th><th class="r">Sick</th><th class="r">Maternity</th>
      <th class="r">Balance</th><th>Deduct</th><th class="r">Absent Ded.</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  return hrBuildReportHTML('Leave & Attendance Register', 'Human Resource — Leave & Attendance Register', filters, inner, ctx);
}

/* ════════ 6. Payroll Summary Report ════════ */
export function generateHrPayrollSummary(ctx, monthKey) {
  const { emps, empPayroll, getFullName, getDeptName, getDesigName } = ctx;
  const [yearVal, monthVal] = (monthKey || '2026-05').split('-');
  const MNAMES = ['', 'January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = MNAMES[parseInt(monthVal, 10)];
  const activeEmps = emps.filter(e => e.status === 'Active');

  let gGross = 0, gDed = 0, gNet = 0, gPaid = 0, cPaid = 0, cGen = 0, cNot = 0;
  const rows = activeEmps.map((e, i) => {
    const rec   = (empPayroll[e.id] || {})[monthKey] || {};
    const gross = rec.totalGross || ctx.getEmpTotalGross(e, 0);
    const ded   = rec.totalDeductions || ctx.getEmpStdDeductions(e);
    const net   = rec.netPayable || (gross - ded);
    const paid  = rec.paidAmount || 0;
    const status = rec.status || 'Not Generated';
    gGross += gross; gDed += ded; gNet += net; gPaid += paid;
    if (status === 'Paid') cPaid++;
    else if (status === 'Generated' || status === 'Partially Paid') cGen++;
    else cNot++;
    const sColor = ctx?.style === 'bw'
      ? '#000'
      : (status === 'Paid' ? '#16A34A' : status === 'Generated' ? '#D97706' : status === 'Partially Paid' ? '#0284C7' : '#94A3B8');
    return `<tr>
      <td>${i+1}</td><td><b>${getFullName(e)}</b></td><td>${e.eid}</td>
      <td>${getDeptName(e.dId)||'—'}</td><td>${getDesigName(e.desId)||'—'}</td>
      <td class="r">${hrFmtMoney(gross)}</td>
      <td class="r">${hrFmtMoney(ded)}</td>
      <td class="r"><b>${hrFmtMoney(net)}</b></td>
      <td class="r">${hrFmtMoney(paid)}</td>
      <td style="color:${sColor};font-weight:700">${status}</td>
    </tr>`;
  }).join('');

  const filters = `<span><b>Period:</b> ${monthName} ${yearVal}</span><span><b>Total Employees:</b> ${activeEmps.length}</span><span><b>Paid:</b> ${cPaid}</span><span><b>Pending:</b> ${cGen+cNot}</span><span><b>Net Payable:</b> PKR ${hrFmtMoney(gNet)}</span><span><b>Generated:</b> ${hrGenLabel(ctx)}</span>`;
  const inner = `
    <div class="rep-secttl">Payroll Summary — ${monthName} ${yearVal}</div>
    <table class="rep-tbl">
      <thead><tr>
        <th>#</th><th>Employee Name</th><th>ID</th><th>Department</th><th>Designation</th>
        <th class="r">Gross Pay</th><th class="r">Deductions</th><th class="r">Net Payable</th>
        <th class="r">Paid Amount</th><th>Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="rep-tot">
          <td colspan="5">Grand Totals — ${activeEmps.length} employees</td>
          <td class="r"><b>${hrFmtMoney(gGross)}</b></td>
          <td class="r"><b>${hrFmtMoney(gDed)}</b></td>
          <td class="r"><b>${hrFmtMoney(gNet)}</b></td>
          <td class="r"><b>${hrFmtMoney(gPaid)}</b></td>
          <td></td>
        </tr>
        <tr class="rep-grandtot">
          <td colspan="7">TOTAL NET PAYABLE — ${monthName} ${yearVal}</td>
          <td class="r"><b>PKR ${hrFmtMoney(gNet)}</b></td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>`;
  return hrBuildReportHTML(`Payroll Summary — ${monthName} ${yearVal}`, `Human Resource — Payroll Summary · ${monthName} ${yearVal}`, filters, inner, ctx);
}
