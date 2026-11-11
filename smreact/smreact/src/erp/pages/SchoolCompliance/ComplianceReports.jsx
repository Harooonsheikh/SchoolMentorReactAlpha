import React, { createContext, useContext, useMemo, useState } from 'react';
import useAsync from '../../hooks/useAsync';
import * as complianceApi from '../../services/complianceApi';
import { todayIso, weekKeyOf, monthKeyOf, shiftWeekKey } from '../../services/complianceApi';
import { completionPct, countByStatus } from './complianceData';
import { Field } from './ComplianceShared';
import { buildCheckInstances, groupItems } from './useComplianceChecks';
import { STATUS, PROBLEM_CATEGORIES, PROBLEM_PRIORITIES, DAILY_AREA_OPTIONS } from '../../mock/compliance';
import {
  buildStandardReportHtml, buildReportTableHtml, openReportWindow,
  downloadReportAsWord, downloadReportExcel, reportPalette, reportStatusPill, reportFileName, REPORT_ACADEMIC_YEAR,
} from '../../reports/reportKit';
import { useComplianceActions } from './compliancePermissions';

const DAILY_ORDER = DAILY_AREA_OPTIONS.map(a => a.id);
const CLOSED_PROBLEM = ['Resolved', 'Verified and Closed'];

/* ═══════════════════════════════════════════════════════════════════
   COMPLIANCE REPORTS — 10 report types, sab ASLI data se:
   - tasks / areas / employees: SchoolCompliance (parent) se props, wohi
     backend task-list jo Setup + Daily/Weekly/Monthly tabs use karte hain
   - problems: backend problem-list (complianceApi.getProblems)

   Instances buildCheckInstances (useComplianceChecks.js) se bante hain —
   wohi function jo Daily/Weekly/Monthly tabs chalate hain — is liye
   report ka har number bilkul un tabs jaisa hota hai.

   Every report shows directly on the page, right below its own filters
   (previewHtml is a live useMemo). The on-page preview and the
   downloaded PDF/Word are built from the exact same HTML; Excel keeps
   its own true-.xlsx path (downloadReportExcel/ExcelJS).
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Shared report data (parent props + problem-list) ─── */
const ReportDataContext = createContext(null);
const useReportData = () => useContext(ReportDataContext);

/* Ek frequency + period ke instances, tabs jaisi logic se */
function useInstances(frequency, periodKey) {
  const { tasks, areas, employeeNames } = useReportData();
  return useMemo(
    () => buildCheckInstances({ tasks, areas, employeeNames, frequency, periodKey }) || [],
    [tasks, areas, employeeNames, frequency, periodKey],
  );
}

/* Aaj / is hafte / is mahine ke saare instances (frequency label ke saath) */
function useCurrentInstances() {
  const today = todayIso();
  const daily = useInstances('daily', today);
  const weekly = useInstances('weekly', weekKeyOf(today));
  const monthly = useInstances('monthly', monthKeyOf(today));
  return useMemo(() => [
    ...daily.map(i => ({ ...i, freqLabel: 'Daily' })),
    ...weekly.map(i => ({ ...i, freqLabel: 'Weekly' })),
    ...monthly.map(i => ({ ...i, freqLabel: 'Monthly' })),
  ], [daily, weekly, monthly]);
}

const isAssigned = (name) => name && name !== '-' && name !== '—';
const staffNameOf = (i) => (isAssigned(i.assignedTo) ? i.assignedTo : 'Unassigned');

/* Instances ko staff ke naam par group karke summary rows */
function staffRows(items, { only = null } = {}) {
  const map = new Map();
  items.forEach(i => {
    const name = staffNameOf(i);
    if (only && !only.includes(name)) return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(i);
  });
  return [...map.entries()]
    .map(([staff, mine]) => {
      const by = countByStatus(mine);
      return { staff, total: mine.length, completed: by[STATUS.COMPLETED], pending: by[STATUS.NOT_CHECKED], issues: by[STATUS.ISSUE_FOUND], pct: completionPct(mine) };
    })
    .sort((a, b) => (a.staff === 'Unassigned') - (b.staff === 'Unassigned') || a.staff.localeCompare(b.staff));
}

/* Daily instances ko asli areas (backend) par group karke summary rows */
function areaRows(items) {
  return groupItems(items, { order: DAILY_ORDER }).map(g => {
    const by = countByStatus(g.items);
    return { label: g.areaLabel, total: g.items.length, completed: by[STATUS.COMPLETED], pending: by[STATUS.NOT_CHECKED], issues: by[STATUS.ISSUE_FOUND], completionPct: completionPct(g.items) };
  });
}

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

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
   smaller Word/Excel links where the report supports them. */
function ReportActions({ onView, onDownloadPdf, onDownloadWord, onDownloadExcel, disabled }) {
  /* PDF / Word / Excel sirf Download permission par (warna hide). View
     Report har us user ko jo Reports tab dekh sakta hai. */
  const { canDownload } = useComplianceActions('reports');
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onView}>
        <i className="fa-solid fa-eye" aria-hidden="true"></i> View Report
      </button>
      {canDownload && (
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={onDownloadPdf}>
        <i className="fa-solid fa-file-pdf" aria-hidden="true"></i> Download PDF
      </button>
      )}
      {canDownload && onDownloadWord && (
        <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onDownloadWord}>
          <i className="fa-brands fa-microsoft" aria-hidden="true"></i> Word
        </button>
      )}
      {canDownload && onDownloadExcel && (
        <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onDownloadExcel}>
          <i className="fa-solid fa-file-excel" aria-hidden="true"></i> Excel
        </button>
      )}
    </div>
  );
}

function useReportView() {
  const [shown, setShown] = useState(true);
  const [bump, setBump] = useState(0);
  return { shown, bump, show: () => { setShown(true); setBump(b => b + 1); } };
}

function PreviewBlock({ html, scrollKey }) {
  const { loading } = useReportData();
  const ref = React.useRef(null);
  React.useEffect(() => { if (scrollKey) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [scrollKey]);
  if (loading) {
    return <div className="cmp-card-sub" style={{ padding: '18px 0' }}><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Loading report data…</div>;
  }
  return <div ref={ref} className="cmp-report-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* Month ke hafte — har hafta Monday se shuru (Weekly Checks ka weekKey
   bhi yahi hai). Week 1 wo hafta hai jis mein mahine ki 1 tareekh ho,
   aur aakhri wo jis ka Monday abhi isi mahine mein ho. */
function weeksOfMonth(mKey) {
  const weeks = [];
  let wk = weekKeyOf(`${mKey}-01`);
  while (weeks.length < 6 && (weeks.length === 0 || monthKeyOf(wk) === mKey)) {
    weeks.push(wk);
    wk = shiftWeekKey(wk, 1);
  }
  return weeks;
}
function weekRangeLabel(weekStartIso) {
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}
const yesterdayIso = () => {
  const d = new Date(`${todayIso()}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ═══ 1-3: Daily / Weekly / Monthly Compliance Report ═══ */
function PeriodReportPanel({ freq, title, icon }) {
  const isWeekly = freq === 'weekly';
  const [dateKey, setDateKey] = useState(() => (freq === 'daily' ? todayIso() : monthKeyOf(todayIso())));
  const weeks = useMemo(() => (isWeekly ? weeksOfMonth(dateKey) : []), [isWeekly, dateKey]);
  const [weekKey, setWeekKey] = useState(() => weekKeyOf(todayIso()));
  /* Mahina badla aur chuna hua hafta us mein nahi — pehla hafta */
  const activeWeek = weeks.includes(weekKey) ? weekKey : weeks[0];
  const periodKey = isWeekly ? activeWeek : dateKey;

  const instances = useInstances(freq, periodKey);
  const by = countByStatus(instances);
  const view = useReportView();

  const columns = useMemo(() => [
    { key: 'area', label: 'Area' }, { key: 'task', label: 'Task' }, { key: 'assigned', label: 'Assigned' }, { key: 'status', label: 'Status' }, { key: 'remark', label: 'Remark' },
  ], []);
  const rowMapper = (i, mode, palette) => ({ area: i.areaLabel, task: i.label, assigned: i.assignedTo, status: statusText(mode, i.status, palette), remark: i.remark || '—' });
  const kpis = useMemo(() => [
    { label: 'Total', value: instances.length },
    { label: 'Completed', value: by[STATUS.COMPLETED], color: '#16A34A' },
    { label: 'Pending', value: by[STATUS.NOT_CHECKED], color: '#DC2626' },
    { label: 'Issues Found', value: by[STATUS.ISSUE_FOUND], color: '#D97706' },
    { label: 'Completion', value: `${completionPct(instances)}%` },
  ], [instances]); // eslint-disable-line react-hooks/exhaustive-deps
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({
    title, columns, data: instances, rowMapper, groupKey: 'area', kpis,
    emptyText: 'No tasks for this period.',
  });

  const today = todayIso();
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}</div>
      <div className="cmp-filter-grid" style={{ margin: '14px 0' }}>
        <Field label={freq === 'daily' ? 'Date' : 'Month'}>
          <input
            type={freq === 'daily' ? 'date' : 'month'}
            className="form-input"
            value={dateKey}
            onChange={e => setDateKey(e.target.value || (freq === 'daily' ? today : monthKeyOf(today)))}
          />
        </Field>
        {isWeekly && (
          <Field label="Week">
            <div className="cmp-seg" style={{ marginBottom: 0 }}>
              {weeks.map((wk, n) => (
                <button key={wk} type="button" className={`cmp-seg-btn${activeWeek === wk ? ' active' : ''}`} onClick={() => setWeekKey(wk)}>
                  Week {n + 1} <span style={{ opacity: .75, fontWeight: 500 }}>({weekRangeLabel(wk)})</span>
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
const STAFF_COLUMNS = [{ key: 'staff', label: 'Staff Member' }, { key: 'total', label: 'Total Tasks' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'issues', label: 'Issues Found' }, { key: 'pct', label: 'Completion %' }];
const staffRowMapper = (r) => ({ ...r, pct: `${r.pct}%` });

function StaffWiseReportPanel() {
  const all = useCurrentInstances();
  const view = useReportView();
  const rows = useMemo(() => staffRows(all), [all]);
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Staff-wise Compliance Report', columns: STAFF_COLUMNS, data: rows, rowMapper: staffRowMapper, emptyText: 'No staff activity to report.' });

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
const AREA_COLUMNS = [{ key: 'label', label: 'Area' }, { key: 'total', label: 'Total Tasks' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'issues', label: 'Issues Found' }, { key: 'completionPct', label: 'Completion %' }];
const areaRowMapper = (r) => ({ ...r, completionPct: `${r.completionPct}%` });

function AreaWiseReportPanel() {
  const [date, setDate] = useState(todayIso);
  const daily = useInstances('daily', date);
  const rows = useMemo(() => areaRows(daily), [daily]);
  const view = useReportView();
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Area-wise Compliance Report', columns: AREA_COLUMNS, data: rows, rowMapper: areaRowMapper, emptyText: 'No daily tasks for this date.' });
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-chart-simple" aria-hidden="true"></i> Area-wise Compliance Report</div>
      <div className="cmp-filter-grid" style={{ margin: '14px 0' }}>
        <Field label="Date"><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value || todayIso())} /></Field>
      </div>
      <div className="cmp-card-sub" style={{ marginBottom: 12 }}>Completion percentage for each daily compliance area &middot; {rows.length} area(s)</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 6: Pending Tasks Report ═══ */
const PENDING_COLUMNS = [{ key: 'freqLabel', label: 'Frequency' }, { key: 'areaLabel', label: 'Area' }, { key: 'label', label: 'Task' }, { key: 'assignedTo', label: 'Assigned' }];
const identity = (r) => r;

function PendingTasksReportPanel() {
  const all = useCurrentInstances();
  const view = useReportView();
  const rows = useMemo(() => all.filter(i => i.status === STATUS.NOT_CHECKED), [all]);
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Pending Tasks Report', columns: PENDING_COLUMNS, data: rows, rowMapper: identity, groupKey: 'freqLabel', emptyText: 'No pending tasks — everything is up to date.' });
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Pending Tasks Report</div>
      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>{rows.length} task(s) not yet checked &mdash; today's daily, this week's weekly and this month's monthly tasks</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 7: Overdue Tasks Report ═══ */
const OVERDUE_COLUMNS = [{ key: 'areaLabel', label: 'Area' }, { key: 'label', label: 'Task' }, { key: 'assignedTo', label: 'Assigned' }, { key: 'date', label: 'Date' }];
const overdueRowMapper = (r) => ({ ...r, date: fmtDate(`${r.periodKey}T00:00:00`) });

function OverdueTasksReportPanel() {
  const yesterday = useMemo(yesterdayIso, []);
  const items = useInstances('daily', yesterday);
  const view = useReportView();
  const rows = useMemo(() => items.filter(i => i.status === STATUS.NOT_CHECKED), [items]);
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Overdue Tasks Report', columns: OVERDUE_COLUMNS, data: rows, rowMapper: overdueRowMapper, emptyText: 'No overdue tasks from yesterday.' });
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Overdue Tasks Report</div>
      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>{rows.length} task(s) from yesterday ({fmtDate(`${yesterday}T00:00:00`)}) that were never checked</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 8: Problems & Follow-ups Report ═══ */
const PROBLEM_COLUMNS = [{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'priority', label: 'Priority' }, { key: 'reportedBy', label: 'Reported By' }, { key: 'assignedTo', label: 'Assigned To' }, { key: 'reportDate', label: 'Report Date' }, { key: 'dueDate', label: 'Due Date' }, { key: 'status', label: 'Status' }];
const problemRowMapper = (r) => ({ ...r, category: r.category || '—', reportDate: fmtDate(r.reportDate), dueDate: fmtDate(r.dueDate) });
const PROBLEM_STATUS_OPTIONS = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Verified and Closed'];

function ProblemsReportPanel() {
  const { problems } = useReportData();
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const view = useReportView();
  const rows = useMemo(() => problems
    .filter(p => (!category || p.category === category) && (!priority || p.priority === priority) && (!status || p.status === status))
    .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate)), [problems, category, priority, status]);
  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Problems & Follow-ups Report', columns: PROBLEM_COLUMNS, data: rows, rowMapper: problemRowMapper, emptyText: 'No problems match the selected filters.' });
  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Problems &amp; Follow-ups Report</div>
      <div className="cmp-filter-grid" style={{ margin: '14px 0' }}>
        <Field label="Category"><select className="form-input" value={category} onChange={e => setCategory(e.target.value)}><option value="">All</option>{PROBLEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Priority"><select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}><option value="">All</option>{PROBLEM_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
        <Field label="Status"><select className="form-input" value={status} onChange={e => setStatus(e.target.value)}><option value="">All</option>{PROBLEM_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
      </div>
      <div className="cmp-card-sub" style={{ marginBottom: 12 }}>{rows.length} problem(s)</div>
      <ReportActions disabled={rows.length === 0} onView={view.show} onDownloadPdf={downloadPdf} onDownloadWord={downloadWord} onDownloadExcel={downloadExcel} />
      {view.shown && <PreviewBlock html={previewHtml} scrollKey={view.bump} />}
    </div>
  );
}

/* ═══ 9: Monthly Staff Review Report ═══
   Monthly Review ki "Staff Planning & Review" category ke tasks, staff
   ke hisaab se. Staff list wohi log hain jin ko us mahine yeh tasks
   assigned hain. */
const REVIEW_COLUMNS = [{ key: 'staff', label: 'Staff Member' }, { key: 'total', label: 'Total Tasks' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'issues', label: 'Issues Found' }, { key: 'pct', label: 'Completion %' }];

function MonthlyStaffReviewReportPanel() {
  const [mKey, setMKey] = useState(() => monthKeyOf(todayIso()));
  const [mode, setMode] = useState('all'); // 'all' | 'select'
  const [selected, setSelected] = useState([]);
  const view = useReportView();
  const monthly = useInstances('monthly', mKey);
  const staffItems = useMemo(() => monthly.filter(i => i.area === 'staff'), [monthly]);
  const staffNames = useMemo(() => [...new Set(staffItems.map(staffNameOf))].sort(), [staffItems]);

  const picked = selected.filter(s => staffNames.includes(s));
  const only = mode === 'select' && picked.length ? picked : null;
  const rows = useMemo(() => staffRows(staffItems, { only }), [staffItems, only]); // eslint-disable-line react-hooks/exhaustive-deps

  const { previewHtml, downloadPdf, downloadWord, downloadExcel } = useReportBuilder({ title: 'Monthly Staff Review Report', columns: REVIEW_COLUMNS, data: rows, rowMapper: staffRowMapper, emptyText: 'No staff planning & review tasks for this month.' });

  const toggleStaff = (name) => setSelected(sel => sel.includes(name) ? sel.filter(s => s !== name) : [...sel, name]);

  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-user-check" aria-hidden="true"></i> Monthly Staff Review Report</div>
      <div className="cmp-filter-grid" style={{ margin: '14px 0' }}>
        <Field label="Month"><input type="month" className="form-input" value={mKey} onChange={e => setMKey(e.target.value || monthKeyOf(todayIso()))} /></Field>
        <Field label="Staff">
          <div className="cmp-seg" style={{ marginBottom: 0 }}>
            <button type="button" className={`cmp-seg-btn${mode === 'all' ? ' active' : ''}`} onClick={() => setMode('all')}>All Staff</button>
            <button type="button" className={`cmp-seg-btn${mode === 'select' ? ' active' : ''}`} onClick={() => setMode('select')}>Select Staff</button>
          </div>
        </Field>
      </div>

      {mode === 'select' && (
        <div className="cmp-staff-picker">
          {staffNames.map(s => (
            <label key={s} className={`cmp-staff-chip${picked.includes(s) ? ' on' : ''}`}>
              <input type="checkbox" checked={picked.includes(s)} onChange={() => toggleStaff(s)} />
              {s}
            </label>
          ))}
          {staffNames.length === 0 && <div className="cmp-staff-hint">No staff have staff planning &amp; review tasks this month.</div>}
          {staffNames.length > 0 && picked.length === 0 && <div className="cmp-staff-hint">No one selected yet &mdash; showing all staff until you pick someone.</div>}
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
  const { problems } = useReportData();
  const today = todayIso();
  const daily = useInstances('daily', today);
  const weekly = useInstances('weekly', weekKeyOf(today));
  const monthly = useInstances('monthly', monthKeyOf(today));
  const view = useReportView();
  const areas = useMemo(() => areaRows(daily), [daily]);
  const openProblems = useMemo(() => problems.filter(p => !CLOSED_PROBLEM.includes(p.status)), [problems]);

  const title = 'School Compliance Summary Report';
  const previewHtml = useMemo(() => {
    const palette = reportPalette(true);
    const by = countByStatus(daily);
    const kpiHtml = kpiStripHtml([
      { label: 'Total Tasks Today', value: daily.length },
      { label: 'Completed', value: by[STATUS.COMPLETED], color: '#16A34A' },
      { label: 'Pending', value: by[STATUS.NOT_CHECKED], color: '#DC2626' },
      { label: 'Issues Found', value: by[STATUS.ISSUE_FOUND], color: '#D97706' },
      { label: 'Open Problems', value: openProblems.length, color: '#7C3AED' },
      { label: 'Critical Problems', value: openProblems.filter(p => p.priority === 'Critical').length, color: '#B91C1C' },
      { label: 'Completion', value: `${completionPct(daily)}%` },
    ], palette);
    const freqTable = buildReportTableHtml({
      columns: [{ key: 'freq', label: 'Checklist' }, { key: 'period', label: 'Period' }, { key: 'total', label: 'Total Tasks' }, { key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'pct', label: 'Completion %' }],
      rows: [
        { freq: 'Daily Checks', period: fmtDate(`${today}T00:00:00`), list: daily },
        { freq: 'Weekly Checks', period: weekRangeLabel(weekKeyOf(today)), list: weekly },
        { freq: 'Monthly Review', period: new Date(`${today}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), list: monthly },
      ].map(r => {
        const c = countByStatus(r.list);
        return { freq: r.freq, period: r.period, total: r.list.length, completed: c[STATUS.COMPLETED], pending: c[STATUS.NOT_CHECKED], pct: `${completionPct(r.list)}%` };
      }),
      isColor: true,
    });
    const areaTable = buildReportTableHtml({ columns: [{ key: 'label', label: 'Area' }, { key: 'total', label: 'Total Tasks' }, { key: 'completionPct', label: 'Completion %' }], rows: areas.map(a => ({ label: a.label, total: a.total, completionPct: `${a.completionPct}%` })), isColor: true, emptyText: 'No daily tasks today.' });
    const probTable = buildReportTableHtml({ columns: [{ key: 'title', label: 'Problem' }, { key: 'category', label: 'Category' }, { key: 'priority', label: 'Priority' }, { key: 'assignedTo', label: 'Assigned To' }, { key: 'status', label: 'Status' }], rows: openProblems.map(p => ({ title: p.title, category: p.category || '—', priority: p.priority, assignedTo: p.assignedTo, status: p.status })), isColor: true, emptyText: 'No open problems.' });
    const heading = (t) => `<div style="${palette.sectionAccent};font-weight:800;margin:16px 0 8px">${t}</div>`;
    return `${kpiHtml}${heading('Checklist Progress')}${freqTable}${heading("Today's Compliance by Area")}${areaTable}${heading('Open Problems')}${probTable}`;
  }, [daily, weekly, monthly, areas, openProblems, today]);

  const downloadPdf = () => openReportWindow(buildStandardReportHtml({ title, format: 'pdf', isColor: true, bodyHtml: previewHtml, subtitleLine: REPORT_ACADEMIC_YEAR }));
  const downloadWord = () => downloadReportAsWord(buildStandardReportHtml({ title, format: 'word', isColor: true, bodyHtml: previewHtml, subtitleLine: REPORT_ACADEMIC_YEAR }), `${reportFileName(title)}.doc`);

  return (
    <div className="cmp-card">
      <div className="cmp-card-title"><i className="fa-solid fa-file-circle-check" aria-hidden="true"></i> {title}</div>
      <div className="cmp-card-sub" style={{ margin: '10px 0' }}>A single combined overview &mdash; today's KPIs, daily / weekly / monthly progress, area completion, and open problems</div>
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
  { id: 'area', icon: 'fa-chart-simple', name: 'Area-wise Compliance', desc: 'Completion by daily compliance area' },
  { id: 'pending', icon: 'fa-hourglass-half', name: 'Pending Tasks', desc: 'Everything still Not Checked' },
  { id: 'overdue', icon: 'fa-clock-rotate-left', name: 'Overdue Tasks', desc: 'Yesterday’s tasks never checked' },
  { id: 'problems', icon: 'fa-triangle-exclamation', name: 'Problems & Follow-ups', desc: 'Every reported problem and its status' },
  { id: 'staffreview', icon: 'fa-user-check', name: 'Monthly Staff Review', desc: 'Staff planning & review, by month' },
  { id: 'summary', icon: 'fa-file-circle-check', name: 'School Compliance Summary', desc: 'One combined overview report' },
];

const fetchProblems = () => complianceApi.getProblems();

export default function ComplianceReports({ toast = () => {}, areas = [], tasks = null, employees = [] }) {
  const [active, setActive] = useState('daily');

  /* Problems sirf ek dafa — Problems, Summary dono report isi ko use karte hain */
  const { data: problemData, loading: problemsLoading, error: problemsError } = useAsync(fetchProblems, []);
  React.useEffect(() => {
    if (problemsError) toast(problemsError?.message || 'Could not load problems for reports.', 'error');
  }, [problemsError]); // eslint-disable-line react-hooks/exhaustive-deps

  const employeeNames = useMemo(() => new Map((employees || []).map(e => [e.id, e.name])), [employees]);
  const value = useMemo(() => ({
    tasks, areas, employeeNames,
    problems: problemData || [],
    loading: tasks === null || (problemsLoading && !problemData),
  }), [tasks, areas, employeeNames, problemData, problemsLoading]);

  return (
    <ReportDataContext.Provider value={value}>
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
    </ReportDataContext.Provider>
  );
}
