import { fetchReportHeader, resolveAcademicSession, formatAcademicYearLabel } from '../../utils/pdfReports';
import { deliverReport } from './reportDelivery';
import {
  buildStandardReportHtml, downloadReportExcel, loadReportBranch, reportFileName,
} from '../reports/reportKit';

/* Shared plumbing for the Academics → Reports tab (AcademicsReports.js and
   AcademicsTeacherPerformanceReport.js): live school name + active academic
   session for the report header (same logic as Academics.js's
   generateReportWindow — no hardcoded school name), and PDF/Word delivery
   through the ERP's deliverReport. */

export async function getAcademicsReportChrome() {
  let schoolName = '';
  let session = '';
  try {
    const header = await fetchReportHeader();
    schoolName = header?.branchName || '';
    session = resolveAcademicSession(header);
  } catch (e) {
    session = resolveAcademicSession(null);
  }
  await loadReportBranch();
  return { schoolName, yearLabel: formatAcademicYearLabel(session) || 'Academic Session' };
}

/* format: 'pdf' | 'word' */
export async function deliverAcademicsHtmlReport({ title, format, isColor, bodyHtml }) {
  const { schoolName, yearLabel } = await getAcademicsReportChrome();
  const html = buildStandardReportHtml({
    title, format, isColor, bodyHtml,
    schoolName: schoolName || undefined,
    subtitleLine: `${yearLabel} · ${isColor ? 'Colorful' : 'Colorless'} Report${isColor ? '' : ' (low-ink)'}`,
  });
  deliverReport(title, format, html);
}

export async function deliverAcademicsExcelReport({ title, columns, rows, isColor, groupKey, groupLabel }) {
  const { schoolName, yearLabel } = await getAcademicsReportChrome();
  return downloadReportExcel({
    title, subtitle: yearLabel,
    metaLine: `${schoolName ? `${schoolName} · ` : ''}${rows.length} row${rows.length === 1 ? '' : 's'}`,
    columns, rows, filename: `${reportFileName(title)}.xlsx`, isColor, groupKey, groupLabel,
  });
}

/* Component CSS (same ACADEMICS_CSS pattern as Academics.js) — rendered via
   <style>{ACADEMICS_REPORTS_CSS}</style> by the tab. The ERP defines no
   --brand-primary-rgb globally, so every use carries a fallback. */
export const ACADEMICS_REPORTS_CSS = `
/* ═══════════════════════════════════════════════════════════════════
   ACADEMICS REPORTS TAB (AcademicsReports.js) — tile selector, filter
   fields and KPI strip. Reuses .section-card / .btn / .form-input,
   defined above / in App.js's global sheet, for everything else.
   ═══════════════════════════════════════════════════════════════════ */
.aca-rep-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:12px; margin-bottom:20px; }
.aca-rep-tile {
  display:flex; align-items:flex-start; gap:10px; text-align:left;
  padding:14px; border-radius:var(--radius-lg);
  border:1.5px solid var(--border-light); background:var(--bg-card);
  cursor:pointer; transition:all .2s ease;
}
.aca-rep-tile:hover { border-color:var(--brand-primary); transform:translateY(-1px); }
.aca-rep-tile.active { border-color:var(--brand-primary); background:rgba(var(--brand-primary-rgb, 30,58,138),.06); box-shadow:var(--shadow-sm); }
.aca-rep-tile-icon {
  width:36px; height:36px; border-radius:10px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:rgba(var(--brand-primary-rgb, 30,58,138),.1); color:var(--brand-solid,#1E3A8A); font-size:14px;
}
.aca-rep-tile.active .aca-rep-tile-icon { background:var(--brand-solid,#1E3A8A); color:#fff; }
.aca-rep-tile-name { font-size:13px; font-weight:800; color:var(--text-primary); margin-bottom:2px; }
.aca-rep-tile-desc { font-size:11px; color:var(--text-muted); line-height:1.4; }

.aca-rep-panel { padding:20px; }
.aca-rep-panel-h { margin-bottom:16px; }
.aca-rep-panel-t { font-size:16px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:9px; margin-bottom:4px; }
.aca-rep-panel-t i { color:var(--brand-solid,#1E3A8A); }
.aca-rep-panel-d { font-size:12.5px; color:var(--text-muted); line-height:1.5; }

.aca-rep-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:18px; }
.aca-rep-kpi { border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:12px 14px; background:var(--bg-muted); }
.aca-rep-kpi-val { font-size:22px; font-weight:800; color:var(--kc, var(--text-primary)); }
.aca-rep-kpi-lbl { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.3px; margin-top:2px; }

.aca-rep-filters {
  display:grid; grid-template-columns:repeat(2,1fr); gap:16px 20px;
  padding:16px; border:1.5px solid var(--border-light); border-radius:var(--radius-lg);
  background:var(--bg-muted); margin-bottom:16px;
}
.aca-rep-field { display:flex; flex-direction:column; gap:7px; }
.aca-rep-flabel { font-size:11.5px; font-weight:700; color:var(--text-secondary); display:flex; align-items:center; gap:6px; }
.aca-rep-flabel i { font-size:11px; color:var(--brand-solid,#1E3A8A); }

.aca-rep-chiprow { display:flex; flex-wrap:wrap; gap:7px; }
.aca-rep-chip {
  padding:6px 12px; border-radius:99px; font-size:11.5px; font-weight:700;
  border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-secondary);
  cursor:pointer; transition:all .15s ease; display:inline-flex; align-items:center; gap:5px;
}
.aca-rep-chip:hover { border-color:var(--brand-primary); }
.aca-rep-chip.active { background:var(--brand-solid,#1E3A8A); border-color:var(--brand-solid,#1E3A8A); color:#fff; }
.aca-rep-chip i { font-size:9px; }

.aca-rep-coltoggles { display:flex; flex-wrap:wrap; gap:10px 16px; }
.aca-rep-coltoggle {
  display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600;
  color:var(--text-secondary); cursor:pointer;
}
.aca-rep-coltoggle.active { color:var(--text-primary); }
.aca-rep-coltoggle input { accent-color:var(--brand-solid,#1E3A8A); cursor:pointer; }

.aca-rep-seg { display:inline-flex; border:1.5px solid var(--border-light); border-radius:var(--radius-md); overflow:hidden; width:fit-content; }
.aca-rep-seg-btn {
  padding:7px 14px; font-size:12px; font-weight:700; color:var(--text-secondary);
  background:var(--bg-card); border:none; cursor:pointer; border-right:1.5px solid var(--border-light);
}
.aca-rep-seg-btn:last-child { border-right:none; }
.aca-rep-seg-btn.active { background:var(--brand-solid,#1E3A8A); color:#fff; }

.aca-rep-daterow { display:flex; align-items:center; gap:8px; }
.aca-rep-daterow input { flex:1; }
.aca-rep-daterow span { font-size:11.5px; color:var(--text-muted); font-weight:600; }

.aca-rep-actions { display:flex; gap:10px; flex-wrap:wrap; }

@media (max-width:1024px) {
  .aca-rep-tiles { grid-template-columns:repeat(3,1fr); }
  .aca-rep-kpis { grid-template-columns:repeat(2,1fr); }
}
@media (max-width:760px) {
  .aca-rep-tiles { grid-template-columns:1fr 1fr; }
  .aca-rep-filters { grid-template-columns:1fr; }
}

/* ═══════════════════════════════════════════════════════════════════
   TEACHER PERFORMANCE & ACTIVITY REPORT (AcademicsTeacherPerformanceReport.js)
   Teacher card grid + search clones the Examination module's Result
   History card pattern under its own "tp-" prefix (no cross-file CSS
   dependency on Examination.jsx). Detail-view sections reuse
   .section-card / .aca-rep-kpis-style chrome via their own ".tp-kpi*"
   (same values, own names, so this file never relies on
   AcademicsReports.js's CSS having been defined first or last).
   ═══════════════════════════════════════════════════════════════════ */
.tp-panel { padding:20px; margin-bottom:16px; }
.tp-sec-h { margin-bottom:14px; }
.tp-sec-title { font-size:15px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:9px; margin-bottom:4px; }
.tp-sec-title i { color:var(--brand-solid,#1E3A8A); }
.tp-sec-sub { font-size:12px; color:var(--text-muted); line-height:1.5; }
.tp-mini-h { font-size:12px; font-weight:800; color:var(--text-secondary); margin:14px 0 8px; text-transform:uppercase; letter-spacing:.3px; }

.tp-search-wrap { position:relative; margin-bottom:16px; }
.tp-search-wrap i { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:13px; }
.tp-search-wrap input { padding-left:38px !important; }

.tp-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; }
.tp-card {
  display:flex; align-items:center; gap:12px; padding:14px;
  border:1.5px solid var(--border-light); border-radius:var(--radius-lg);
  background:var(--bg-card); cursor:pointer; transition:all .2s ease;
}
.tp-card:hover { border-color:var(--brand-primary); transform:translateY(-1px); box-shadow:var(--shadow-sm); }
.tp-card-avatar {
  width:44px; height:44px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF)); color:#fff; font-weight:800; font-size:14px;
}
.tp-card-id { flex:1; min-width:0; }
.tp-card-name { font-size:13.5px; font-weight:800; color:var(--text-primary); }
.tp-card-sub { font-size:11.5px; color:var(--text-secondary); }
.tp-card-sub--muted { color:var(--text-muted); }
.tp-card-pct { text-align:center; flex-shrink:0; }
.tp-card-pct-val { font-size:17px; font-weight:800; color:var(--brand-solid,#1E3A8A); }
.tp-card-pct-lbl { font-size:9.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.3px; }

.tp-back-btn {
  display:inline-flex; align-items:center; gap:8px; margin-bottom:16px;
  padding:8px 14px; border-radius:var(--radius-md); border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--text-secondary); font-size:12.5px; font-weight:700; cursor:pointer;
}
.tp-back-btn:hover { border-color:var(--brand-primary); color:var(--brand-solid,#1E3A8A); }

.tp-profile-card { padding:20px; border:1.5px solid var(--border-light); border-radius:var(--radius-lg); background:var(--bg-card); margin-bottom:16px; }
.tp-banner { display:flex; align-items:center; gap:14px; margin-bottom:16px; }
.tp-banner-avatar {
  width:56px; height:56px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF)); color:#fff; font-weight:800; font-size:18px;
}
.tp-banner-name { font-size:17px; font-weight:800; color:var(--text-primary); }
.tp-banner-sub { font-size:12.5px; color:var(--text-muted); margin-top:2px; }

.tp-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:10px; margin-bottom:4px; }
.tp-kpi { border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:10px 12px; background:var(--bg-muted); }
.tp-kpi-val { font-size:18px; font-weight:800; color:var(--kc, var(--text-primary)); }
.tp-kpi-lbl { font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.3px; margin-top:2px; }

.tp-two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }

.tp-notavail {
  display:flex; align-items:flex-start; gap:9px; padding:12px 14px;
  border-radius:var(--radius-md); background:var(--bg-muted);
  border:1px dashed var(--border-light); color:var(--text-muted);
  font-size:12.5px; line-height:1.5;
}
.tp-notavail i { color:var(--text-muted); font-size:12px; margin-top:2px; flex-shrink:0; }

.tp-table-wrap { overflow-x:auto; border:1.5px solid var(--border-light); border-radius:var(--radius-md); }
.tp-table { width:100%; border-collapse:collapse; font-size:12px; }
.tp-table th { text-align:left; padding:9px 12px; background:var(--bg-muted); color:var(--text-secondary); font-weight:800; white-space:nowrap; border-bottom:1.5px solid var(--border-light); }
.tp-table td { padding:8px 12px; color:var(--text-secondary); border-bottom:1px solid var(--border-light); }
.tp-table tr:last-child td { border-bottom:none; }
.tp-table-empty { padding:16px; text-align:center; color:var(--text-muted); font-size:12.5px; font-style:italic; }

.tp-detail-top { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.tp-detail-top .tp-back-btn { margin-bottom:0; }
.tp-report-actions { display:flex; gap:10px; }

.tp-banner-tenure { font-size:12px; color:var(--text-secondary); margin-top:6px; }
.tp-banner-tenure i { color:var(--brand-solid,#1E3A8A); margin-right:5px; }
.tp-banner-tenure--muted { color:var(--text-muted); font-style:italic; }

.tp-chip {
  display:inline-flex; align-items:center; padding:3px 9px; border-radius:99px;
  font-size:10.5px; font-weight:700;
}
.tp-chip--ok { background:rgba(22,163,74,.12); color:#16A34A; }
.tp-chip--pending { background:rgba(220,38,38,.12); color:#DC2626; }
.tp-chip-row { display:inline-flex; flex-wrap:wrap; gap:5px; }

.tp-marks-class { margin-bottom:18px; }
.tp-marks-class:last-child { margin-bottom:0; }

@media (max-width:760px) {
  .tp-two-col { grid-template-columns:1fr; }
  .tp-detail-top { flex-direction:column; align-items:stretch; }
}
`;
