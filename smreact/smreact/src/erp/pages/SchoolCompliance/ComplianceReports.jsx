import React, { useMemo, useState } from 'react';
import useAsync from '../../hooks/useAsync';
import * as complianceService from '../../services/complianceService';
import { TODAY_ISO, isoWeekKey, monthKey, isoDaysAgo } from '../../services/complianceService';
import { completionPct, countByStatus, computeAreaCompletion } from './complianceData';
import { Field } from './ComplianceShared';
import { STATUS, ROLE_STAFF, PROBLEM_CATEGORIES, PROBLEM_PRIORITIES } from '../../mock/compliance';
import {
  buildStandardReportHtml, buildReportTableHtml, openReportWindow,
  downloadReportAsWord, downloadReportExcel, reportPalette, reportStatusPill, reportFileName, REPORT_ACADEMIC_YEAR,
} from '../../reports/reportKit';

const ALL_STAFF = [...new Set(Object.values(ROLE_STAFF).flat())];

/* ═══════════════════════════════════════════════════════════════════
   COMPLIANCE REPORTS — 10 report types. Every report shows directly
   on the page, right below its own filters, the moment its tile is
   opened or its filters change (useReportBuilder's previewHtml is a
   live useMemo, not a one-time generated snapshot) — "View Report"
   is there for an explicit affordance, but nothing has to be
   downloaded just to see a report.

   The on-page preview and the downloaded PDF/Word are built from the
   exact same HTML (previewHtml, via reportKit.js's
   buildReportTableHtml) — so what you see on the page is guaranteed
   to be what you get in the file, never a second, independently
   generated version. Excel keeps its own true-.xlsx path
   (downloadReportExcel/ExcelJS) since a spreadsheet can't reuse HTML.
   ═══════════════════════════════════════════════════════════════════ */

function kpiStripHtml(kpis, palette) {
  if (!kpis) return '';
  return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">${kpis.map(k => `
    <div style="flex:1;min-width:120px;border:1px solid ${palette.border};border-radius:8px;padding:10px 12px;background:${palette.rowBaseBg}">
      <div style="font-size:18px;font-weight:800;color:${k.color || palette.textD}">${k.value}</div>
      <div style="font-size:10px;font-weight:700;color:${palette.textM};text-transform:uppercase">${k.label}</div>
    </div>`).join('')}</div>`;
}

function statusText(mode, status, palette) {
  return mode === 'excel' ? status.replace('_', ' ') : reportStatusPill(status.replace('_', ' '), status === 'completed' ? 'green' : status === 'issue_found' ? 'red' : 'gray', palette);
}

/* Builds the live on-page preview HTML plus the PDF/Word/Excel
   download actions from one shared definition, so the preview and
   every exported file always match. */
function useReportBuilder({ title, columns, data, rowMapper, groupKey, kpis, emptyText }) {
  const previewHtml = useMemo(() => {
    const palette = reportPalette(true);
    const rows = data.map(d => rowMapper(d, 'display', palette));
    return kpiStripHtml(kpis, palette) + buildReportTableHtml({ columns, rows, isColor: true, groupKey, groupLabel: groupKey ? (r => r[groupKey]) : undefined, emptyText });
  }, [columns, data, rowMapper, groupKey, kpis, emptyText]);

  const downloadPdf = () => {
    const html = buildStandardReportHtml({ title, format: 'pdf', isColor: true, bodyHtml: previewHtml, subtitleLine: REPORT_ACADEMIC_YEAR });
    openReportWindow(html);
  };
  const downloadWord = () => {
    const html = buildStandardReportHtml({ title, format: 'word', isColor: true, bodyHtml: previewHtml, subtitleLine: REPORT_ACADEMIC_YEAR });
    downloadReportAsWord(html, `${reportFileName(title)}.doc`);
  };
  const downloadExcel = () => {
    const rows = data.map(d => rowMapper(d, 'excel'));
    downloadReportExcel({ title, subtitle: REPORT_ACADEMIC_YEAR, metaLine: `${rows.length} row(s)`, columns, rows, filename: `${reportFileName(title)}.xlsx`, isColor: true, groupKey, groupLabel: groupKey ? (r => r[groupKey]) : undefined });
  };

  return { previewHtml, downloadPdf, downloadWord, downloadExcel };
}

/* "View Report" (shows the preview below) + "Download PDF", plus
   smaller Word/Excel links where the report supports them. The
   preview is already visible by default — View Report mainly exists
   as the explicit, expected affordance and re-confirms/keeps it open. */
function ReportActions({ onView, onDownloadPdf, onDownloadWord, onDownloadExcel, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onView}>
        <i className="fa-solid fa-eye" aria-hidden="true"></i> View Report
      </button>
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={onDownloadPdf}>
        <i className="fa-solid fa-file-pdf" aria-hidden="true"></i> Download PDF
      </button>
      {onDownloadWord && (
        <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onDownloadWord}>
          <i className="fa-brands fa-microsoft" aria-hidden="true"></i> Word
        </button>
      )}
      {onDownloadExcel && (
        <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onDownloadExcel}>
          <i className="fa-solid fa-file-excel" aria-hidden="true"></i> Excel
        </button>
      )}
    </div>
  );
}

/* Small helper so each panel doesn't repeat the view/download wiring.
   `shown` defaults true — the report is already visible as soon as its
   tile is opened; `show()` (wired to the "View Report" button) also
   scrolls it into view, useful after changing filters further down. */
function useReportView() {
  const [shown, setShown] = useState(true);
  const [bump, setBump] = useState(0);
  return { shown, bump, show: () => { setShown(true); setBump(b => b + 1); } };
}

function PreviewBlock({ html, scrollKey }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (scrollKey) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [scrollKey]);
  return <div ref={ref} className="cmp-report-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* Universal week numbering — the same for every month, no matter which
   weekday the 1st falls on: "Week 1" is always the real Monday-Sunday
   week that contains the 1st of the month (this matches the actual
   weekKey Weekly Checks already uses), and Weeks 2-4 are simply the
   next 3 calendar weeks after it. This keeps the report's weekKey
   identical to the real underlying week data — no mismatch between
   what the label says and what the report actually shows. */
function monthWeekStart(mKey, weekNum) {
  const firstWeekStart = isoWeekKey(`${mKey}-01`);
  const d = new Date(`${firstWeekStart}T00:00:00`);
  d.setDate(d.getDate() + (weekNum - 1) * 7);
  return d.toISOString().slice(0, 10);
}
function weekRangeLabel(weekStartIso) {
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ═══ 1-3: Daily / Weekly / Monthly Compliance Report ═══ */
function PeriodReportPanel({ freq, title, icon }) {
  const isWeekly = freq === 'weekly';
  const [dateKey, setDateKey] = useState(freq === 'daily' ? TODAY_ISO : monthKey(TODAY_ISO));
  const [weekNum, setWeekNum] = useState(1);
  const periodKey = isWeekly ? monthWeekStart(dateKey, weekNum) : dateKey;
  const getter = freq === 'daily' ? complianceService.getDailyInstances : freq === 'weekly' ? complianceService.getWeeklyInstances : complianceService.getMonthlyInstances;
  const { data: instances = [] } = useAsync(() => getter(periodKey), [periodKey]);
  const by = countByStatus(instances);
  const view = useReportView();

  const columns = [
    { key: 'area', label: 'Area' }, { key: 'task', label: 'Task' }, { key: 'assigned', label: 'Assigned' }, { key: 'status', label: 'Status' }, { key: 'remark', label: 'Remark' },
  ];
  const rowMapper = (i, mode, palette) => ({ area: i.areaLabel, task: i.label, assigned: i.assignedTo, status: statusText(mode, i.status, palette), remark: i.remark || '—' });
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({
    title, columns, data: instances, rowMapper, groupKey: 'area',
    kpis: [{ label: 'Total', value: instances.length }, { label: 'Completed', value: by[STATUS.COMPLETED], color: '#16A34A' }, { label: 'Pending', value: by[STATUS.NOT_CHECKED], color: '#DC2626' }, { label: 'Completion', value: `${completionPct(instances)}%` }],
    emptyText: 'No records for this period.',
  });

  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}</div>
      <div className="cmp-filter-grid" style={{ margin: '14px 0' }}>
        <Field label={freq === 'daily' ? 'Date' : 'Month'}>
          <input type={freq === 'daily' ? 'date' : 'month'} className="form-input" value={dateKey} onChange={e => setDateKey(e.target.value)} />
        </Field>
        {isWeekly && (
          <Field label="Week">
            <div className="cmp-seg" style={{ marginBottom: 0 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" className={`cmp-seg-btn${weekNum === n ? ' active' : ''}`} onClick={() => setWeekNum(n)}>
                  Week {n} <span style={{ opacity: .75, fontWeight: 500 }}>({weekRangeLabel(monthWeekStart(dateKey, n))})</span>
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>
      <div className="cmp-card-sub" style={{ marginBottom: 12 }}>{instances.length} task(s) &middot; {completionPct(instances)}% complete</div>
      <ReportActions disabled={instances.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 4: Staff-wise Compliance Report ═══ */
function StaffWiseReportPanel() {
  const { data: daily = [] } = useAsync(() => complianceService.getDailyInstances(TODAY_ISO), []);
  const { data: weekly = [] } = useAsync(() => complianceService.getWeeklyInstances(isoWeekKey(TODAY_ISO)), []);
  const { data: monthly = [] } = useAsync(() => complianceService.getMonthlyInstances(monthKey(TODAY_ISO)), []);
  const all = useMemo(() => [...daily, ...weekly, ...monthly], [daily, weekly, monthly]);
  const view = useReportView();

  const rows = useMemo(() => ALL_STAFF.map(staff => {
    const mine = all.filter(i => i.assignedTo === staff);
    const by = countByStatus(mine);
    return { staff, total: mine.length, completed: by[STATUS.COMPLETED], pending: by[STATUS.NOT_CHECKED], issues: by[STATUS.ISSUE_FOUND], pct: completionPct(mine) };
  }).filter(r => r.total > 0), [all]);

  const columns = [{ key: 'staff', label: 'Staff Member' }, { key: 'total', label: 'Total Tasks' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'issues', label: 'Issues Found' }, { key: 'pct', label: 'Completion %' }];
  const rowMapper = (r) => ({ ...r, pct: `${r.pct}%` });
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Staff-wise Compliance Report', columns, data: rows, rowMapper, emptyText: 'No staff activity to report.' });

  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-users" aria-hidden="true"></i> Staff-wise Compliance Report</div>
      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>Today's daily tasks, this week's weekly tasks, and this month's review &mdash; by staff member</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 5: Area-wise Compliance Report ═══ */
function AreaWiseReportPanel() {
  const { data: daily = [] } = useAsync(() => complianceService.getDailyInstances(TODAY_ISO), []);
  const rows = useMemo(() => computeAreaCompletion(daily), [daily]);
  const view = useReportView();
  const columns = [{ key: 'label', label: 'Area' }, { key: 'total', label: 'Total Tasks' }, { key: 'completionPct', label: 'Completion %' }];
  const rowMapper = (r) => ({ label: r.label, total: r.total, completionPct: `${r.completionPct}%` });
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Area-wise Compliance Report', columns, data: rows, rowMapper, emptyText: 'No data to report.' });
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-chart-simple" aria-hidden="true"></i> Area-wise Compliance Report</div>
      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>Today's completion percentage for each of the 6 compliance areas</div>
      <ReportActions onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 6: Pending Tasks Report ═══ */
function PendingTasksReportPanel() {
  const { data: daily = [] } = useAsync(() => complianceService.getDailyInstances(TODAY_ISO), []);
  const { data: weekly = [] } = useAsync(() => complianceService.getWeeklyInstances(isoWeekKey(TODAY_ISO)), []);
  const { data: monthly = [] } = useAsync(() => complianceService.getMonthlyInstances(monthKey(TODAY_ISO)), []);
  const view = useReportView();
  const rows = useMemo(() => [
    ...daily.map(i => ({ ...i, freqLabel: 'Daily' })), ...weekly.map(i => ({ ...i, freqLabel: 'Weekly' })), ...monthly.map(i => ({ ...i, freqLabel: 'Monthly' })),
  ].filter(i => i.status === STATUS.NOT_CHECKED), [daily, weekly, monthly]);

  const columns = [{ key: 'freqLabel', label: 'Frequency' }, { key: 'areaLabel', label: 'Area' }, { key: 'label', label: 'Task' }, { key: 'assignedTo', label: 'Assigned' }];
  const rowMapper = (r) => r;
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Pending Tasks Report', columns, data: rows, rowMapper, groupKey: 'freqLabel', emptyText: 'No pending tasks — everything is up to date.' });
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Pending Tasks Report</div>
      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>{rows.length} task(s) not yet checked, across daily, weekly and monthly</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 7: Overdue Tasks Report ═══ */
function OverdueTasksReportPanel() {
  const { data: yesterday = [] } = useAsync(() => complianceService.getDailyInstances(isoDaysAgo(1)), []);
  const view = useReportView();
  const rows = useMemo(() => yesterday.filter(i => i.status === STATUS.NOT_CHECKED), [yesterday]);
  const columns = [{ key: 'areaLabel', label: 'Area' }, { key: 'label', label: 'Task' }, { key: 'assignedTo', label: 'Assigned' }, { key: 'periodKey', label: 'Date' }];
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Overdue Tasks Report', columns, data: rows, rowMapper: (r) => r, emptyText: 'No overdue tasks from yesterday.' });
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Overdue Tasks Report</div>
      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>{rows.length} task(s) from yesterday that were never checked</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 8: Problems & Follow-ups Report ═══ */
function ProblemsReportPanel() {
  const { data: problems = [] } = useAsync(complianceService.getProblems, []);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const view = useReportView();
  const rows = useMemo(() => problems.filter(p => (!category || p.category === category) && (!priority || p.priority === priority)), [problems, category, priority]);
  const columns = [{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'priority', label: 'Priority' }, { key: 'reportedBy', label: 'Reported By' }, { key: 'assignedTo', label: 'Assigned To' }, { key: 'reportDate', label: 'Report Date' }, { key: 'dueDate', label: 'Due Date' }, { key: 'status', label: 'Status' }];
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Problems & Follow-ups Report', columns, data: rows, rowMapper: (r) => r, emptyText: 'No problems match the selected filters.' });
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Problems &amp; Follow-ups Report</div>
      <div className="cmp-filter-grid" style={{ margin: '14px 0' }}>
        <Field label="Category"><select className="form-input" value={category} onChange={e => setCategory(e.target.value)}><option value="">All</option>{PROBLEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Priority"><select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}><option value="">All</option>{PROBLEM_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
      </div>
      <div className="cmp-card-sub" style={{ marginBottom: 12 }}>{rows.length} problem(s)</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 9: Monthly Staff Review Report — now with staff selection ═══ */
function MonthlyStaffReviewReportPanel() {
  const [mKey, setMKey] = useState(monthKey(TODAY_ISO));
  const [mode, setMode] = useState('all'); // 'all' | 'select'
  const [selected, setSelected] = useState([]);
  const view = useReportView();
  const { data: monthly = [] } = useAsync(() => complianceService.getMonthlyInstances(mKey), [mKey]);
  const staffItems = useMemo(() => monthly.filter(i => i.area === 'staff'), [monthly]);

  const staffPool = mode === 'all' ? ALL_STAFF : (selected.length ? selected : ALL_STAFF);
  const rows = useMemo(() => staffPool.map(staff => {
    const mine = staffItems.filter(i => i.assignedTo === staff);
    if (!mine.length) return null;
    const by = countByStatus(mine);
    return { staff, total: mine.length, completed: by[STATUS.COMPLETED], pending: by[STATUS.NOT_CHECKED], pct: completionPct(mine) };
  }).filter(Boolean), [staffItems, staffPool]);

  const columns = [{ key: 'staff', label: 'Staff Member' }, { key: 'total', label: 'Total Tasks' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'pct', label: 'Completion %' }];
  const rowMapper = (r) => ({ ...r, pct: `${r.pct}%` });
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Monthly Staff Review Report', columns, data: rows, rowMapper, emptyText: 'No staff planning & review data for this selection.' });

  const toggleStaff = (name) => setSelected(sel => sel.includes(name) ? sel.filter(s => s !== name) : [...sel, name]);

  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-user-check" aria-hidden="true"></i> Monthly Staff Review Report</div>
      <div className="cmp-filter-grid" style={{ margin: '14px 0' }}>
        <Field label="Month"><input type="month" className="form-input" value={mKey} onChange={e => setMKey(e.target.value)} /></Field>
        <Field label="Staff">
          <div className="cmp-seg" style={{ marginBottom: 0 }}>
            <button type="button" className={`cmp-seg-btn${mode === 'all' ? ' active' : ''}`} onClick={() => setMode('all')}>All Staff</button>
            <button type="button" className={`cmp-seg-btn${mode === 'select' ? ' active' : ''}`} onClick={() => setMode('select')}>Select Staff</button>
          </div>
        </Field>
      </div>

      {mode === 'select' && (
        <div className="cmp-staff-picker">
          {ALL_STAFF.map(s => (
            <label key={s} className={`cmp-staff-chip${selected.includes(s) ? ' on' : ''}`}>
              <input type="checkbox" checked={selected.includes(s)} onChange={() => toggleStaff(s)} />
              {s}
            </label>
          ))}
          {selected.length === 0 && <div className="cmp-staff-hint">No one selected yet &mdash; showing all staff until you pick someone.</div>}
        </div>
      )}

      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>{rows.length} staff member(s) in this report</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 10: School Compliance Summary Report ═══ */
function SummaryReportPanel() {
  const { data: daily = [] } = useAsync(() => complianceService.getDailyInstances(TODAY_ISO), []);
  const { data: problems = [] } = useAsync(complianceService.getProblems, []);
  const view = useReportView();
  const areaRows = useMemo(() => computeAreaCompletion(daily), [daily]);
  const openProblems = useMemo(() => problems.filter(p => p.status !== 'Resolved' && p.status !== 'Verified and Closed'), [problems]);
  const by = countByStatus(daily);

  const title = 'School Compliance Summary Report';
  const previewHtml = useMemo(() => {
    const palette = reportPalette(true);
    const kpiHtml = kpiStripHtml([
      { label: 'Total Tasks Today', value: daily.length }, { label: 'Completed', value: by[STATUS.COMPLETED], color: '#16A34A' },
      { label: 'Pending', value: by[STATUS.NOT_CHECKED], color: '#DC2626' }, { label: 'Open Problems', value: openProblems.length, color: '#7C3AED' },
      { label: 'Completion', value: `${completionPct(daily)}%` },
    ], palette);
    const areaTable = buildReportTableHtml({ columns: [{ key: 'label', label: 'Area' }, { key: 'completionPct', label: 'Completion %' }], rows: areaRows.map(a => ({ label: a.label, completionPct: `${a.completionPct}%` })), isColor: true });
    const probTable = buildReportTableHtml({ columns: [{ key: 'title', label: 'Problem' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }], rows: openProblems.map(p => ({ title: p.title, priority: p.priority, status: p.status })), isColor: true, emptyText: 'No open problems.' });
    return `${kpiHtml}<div style="${palette.sectionAccent};font-weight:800;margin:16px 0 8px">Compliance by Area</div>${areaTable}<div style="${palette.sectionAccent};font-weight:800;margin:16px 0 8px">Open Problems</div>${probTable}`;
  }, [daily, areaRows, openProblems, by]);

  const downloadPdf = () => openReportWindow(buildStandardReportHtml({ title, format: 'pdf', isColor: true, bodyHtml: previewHtml, subtitleLine: REPORT_ACADEMIC_YEAR }));
  const downloadWord = () => downloadReportAsWord(buildStandardReportHtml({ title, format: 'word', isColor: true, bodyHtml: previewHtml, subtitleLine: REPORT_ACADEMIC_YEAR }), `${reportFileName(title)}.doc`);

  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-file-circle-check" aria-hidden="true"></i> {title}</div>
      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>A single combined overview &mdash; today's KPIs, area completion, and open problems</div>
      <ReportActions onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

const REPORT_TILES = [
  { id: 'daily', icon: 'fa-calendar-day', name: 'Daily Compliance', desc: 'One day’s checklist results' },
  { id: 'weekly', icon: 'fa-calendar-week', name: 'Weekly Compliance', desc: 'One week’s review results' },
  { id: 'monthly', icon: 'fa-calendar-days', name: 'Monthly Compliance', desc: 'One month’s review results' },
  { id: 'staff', icon: 'fa-users', name: 'Staff-wise Compliance', desc: 'Task completion by staff member' },
  { id: 'area', icon: 'fa-chart-simple', name: 'Area-wise Compliance', desc: 'Completion by the 6 compliance areas' },
  { id: 'pending', icon: 'fa-hourglass-half', name: 'Pending Tasks', desc: 'Everything still Not Checked' },
  { id: 'overdue', icon: 'fa-clock-rotate-left', name: 'Overdue Tasks', desc: 'Yesterday’s tasks never checked' },
  { id: 'problems', icon: 'fa-triangle-exclamation', name: 'Problems & Follow-ups', desc: 'Every reported problem and its status' },
  { id: 'staffreview', icon: 'fa-user-check', name: 'Monthly Staff Review', desc: 'Staff planning & review, by month' },
  { id: 'summary', icon: 'fa-file-circle-check', name: 'School Compliance Summary', desc: 'One combined overview report' },
];

export default function ComplianceReports() {
  const [active, setActive] = useState('daily');
  return (
    <>
      <div className="cmp-rep-tiles">
        {REPORT_TILES.map(t => (
          <button key={t.id} type="button" className={`cmp-rep-tile${active === t.id ? ' active' : ''}`} onClick={() => setActive(t.id)}>
            <div className="cmp-rep-tile-icon"><i className={`fa-solid ${t.icon}`}></i></div>
            <div><div className="cmp-rep-tile-name">{t.name}</div><div className="cmp-rep-tile-desc">{t.desc}</div></div>
          </button>
        ))}
      </div>

      {active === 'daily' && <PeriodReportPanel key="daily" freq="daily" title="Daily Compliance Report" icon="fa-calendar-day" />}
      {active === 'weekly' && <PeriodReportPanel key="weekly" freq="weekly" title="Weekly Compliance Report" icon="fa-calendar-week" />}
      {active === 'monthly' && <PeriodReportPanel key="monthly" freq="monthly" title="Monthly Compliance Report" icon="fa-calendar-days" />}
      {active === 'staff' && <StaffWiseReportPanel />}
      {active === 'area' && <AreaWiseReportPanel />}
      {active === 'pending' && <PendingTasksReportPanel />}
      {active === 'overdue' && <OverdueTasksReportPanel />}
      {active === 'problems' && <ProblemsReportPanel />}
      {active === 'staffreview' && <MonthlyStaffReviewReportPanel />}
      {active === 'summary' && <SummaryReportPanel />}
    </>
  );
}
