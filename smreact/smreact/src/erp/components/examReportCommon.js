/* ═══════════════════════════════════════════════════════════════════
   EXAM REPORT COMMON — shared helpers for the Examination report exports
   (Download All Cards, Comparison Report, Report Preview).

   Everything here is pure / presentation-only. Branding (school name, logo,
   session) always comes from the live /report-header branch passed in as
   `branch` — nothing is hardcoded.
   ═══════════════════════════════════════════════════════════════════ */
import { buildStandardReportHtml, reportAcademicYear, reportFileName, downloadReportHtmlAsExcel } from '../reports/reportKit';
import { deliverReport } from './reportDelivery';
import { formatAcademicYearLabel, resolveAcademicSession } from '../../utils/pdfReports';

export const examEsc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const examR1 = n => Math.round((Number(n) || 0) * 10) / 10;
export const examSigned = n => `${n > 0 ? '+' : ''}${n}`;
export const examTrend = delta => (delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat');

/* 'DD-MM-YYYY' | 'DD/MM/YYYY' | ISO → timestamp (0 when unparseable). */
export function examParseDate(d) {
  if (!d) return 0;
  const s = String(d).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime();
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]).getTime();
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}
/* → "10 Mar 2026"; falls back to the original text when it is not a date. */
export function examFormatDate(d) {
  const t = examParseDate(d);
  if (!t) return d ? String(d) : '—';
  return new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* Fallback grade scale — callers should pass the branch's own `gradeFn`
   (Examination's rcGetGrade: (obt, tot) → { grade, comment } | null). */
const FALLBACK_BANDS = [
  { min: 90, grade: 'A+', comment: 'Excellent Work Done' },
  { min: 80, grade: 'A', comment: 'Very Good Work Done' },
  { min: 70, grade: 'B', comment: 'Good Work Done' },
  { min: 60, grade: 'C', comment: 'Satisfactory Work Done' },
  { min: 50, grade: 'D', comment: 'Needs Improvement' },
  { min: 0, grade: 'F', comment: 'Unsatisfactory' },
];
export function examDefaultGrade(obt, tot) {
  if (!tot || !obt) return null;
  const pct = (obt / tot) * 100;
  return FALLBACK_BANDS.find(g => pct >= g.min) || FALLBACK_BANDS[FALLBACK_BANDS.length - 1];
}
export function examGradeColor(g, isColor = true) {
  if (!isColor || !g) return '#475569';
  return g === 'A+' ? '#16A34A' : g === 'A' ? '#15803D' : g === 'B' ? '#1D4ED8'
    : g === 'C' ? '#B45309' : g === 'D' ? '#EA580C' : '#DC2626';
}

/* Palette used by the report bodies (colorful / colorless). */
export function examPalette(isColor) {
  return {
    accent: isColor ? '#1E40AF' : '#374151',
    accBg: isColor ? '#EFF6FF' : '#F5F5F5',
    accBdr: isColor ? '#BFDBFE' : '#DDD',
    tMuted: isColor ? '#64748B' : '#666',
    rowEv: isColor ? '#F8FAFF' : '#F7F7F7',
    grn: isColor ? '#16A34A' : '#000',
    amb: isColor ? '#D97706' : '#000',
    red: isColor ? '#DC2626' : '#000',
    pur: isColor ? '#7C3AED' : '#444',
  };
}

/* Header strings from the live /report-header branch. */
export const examSchoolName = branch => (branch && (branch.name || branch.schoolName || branch.branchName)) || '';
export const examYearLabel = branch => formatAcademicYearLabel(resolveAcademicSession(branch || {})) || reportAcademicYear();

export const EXAM_TABLE_CSS = '<style>table{width:100%;table-layout:fixed}td,th{overflow-wrap:anywhere;word-break:break-word}</style>';

/* Body HTML → full report document inside the ERP report-kit chrome. */
export function examWrapReport({ title, subline, bodyHtml, branch, format = 'pdf', isColor = true, orientation = 'portrait', includeToolbar = true }) {
  return buildStandardReportHtml({
    title,
    format,
    isColor,
    bodyHtml: EXAM_TABLE_CSS + bodyHtml,
    subtitleLine: [examEsc(examYearLabel(branch)), subline].filter(Boolean).join(' &middot; '),
    schoolName: examSchoolName(branch) ? examEsc(examSchoolName(branch)) : undefined,
    orientation,
    includeToolbar,
  });
}

/* Small inline-SVG trend chart (percent per exam) — printable, no deps. */
export function examTrendChartSvg(points, p) {
  const W = 640, H = 170, padL = 34, padR = 16, padT = 20, padB = 40;
  const n = points.length;
  const x = i => (n === 1 ? (padL + (W - padR)) / 2 : padL + (i * (W - padL - padR)) / (n - 1));
  const y = v => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - padT - padB);
  const grid = [0, 25, 50, 75, 100].map(g => `<line x1="${padL}" x2="${W - padR}" y1="${y(g)}" y2="${y(g)}" stroke="${p.accBdr}" stroke-width="1"/><text x="${padL - 6}" y="${y(g) + 3}" font-size="9" fill="${p.tMuted}" text-anchor="end">${g}</text>`).join('');
  const line = points.map((pt, i) => `${i ? 'L' : 'M'}${x(i)},${y(pt.pct)}`).join(' ');
  const dots = points.map((pt, i) => `<circle cx="${x(i)}" cy="${y(pt.pct)}" r="4.5" fill="${p.accent}" stroke="#fff" stroke-width="1.5"/>
    <text x="${x(i)}" y="${y(pt.pct) - 9}" font-size="10" font-weight="700" fill="${p.accent}" text-anchor="middle">${pt.pct}%</text>
    <text x="${x(i)}" y="${H - 22}" font-size="9.5" font-weight="700" fill="#334155" text-anchor="middle">${examEsc(String(pt.label).slice(0, 18))}</text>
    ${pt.sub ? `<text x="${x(i)}" y="${H - 9}" font-size="8.5" fill="${p.tMuted}" text-anchor="middle">${examEsc(pt.sub)}</text>` : ''}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${grid}${n > 1 ? `<path d="${line}" fill="none" stroke="${p.accent}" stroke-width="2.5"/>` : ''}${dots}</svg>`;
}

/* Deliver a built report in the chosen format through the ERP's own pipeline:
   pdf → print preview, word → "Save as Word" preview (deliverReport),
   excel → native .xlsx of the same HTML (downloadReportHtmlAsExcel). */
export function examDeliver(name, format, html, opts = {}) {
  if (format === 'excel') {
    if (opts.win) { try { opts.win.close(); } catch (e) { /* ignore */ } }
    return downloadReportHtmlAsExcel(html, `${reportFileName(String(name || 'Report').replace(/\s*-\s*/g, ' '))}.xlsx`);
  }
  return deliverReport(name, format, html, opts);
}
