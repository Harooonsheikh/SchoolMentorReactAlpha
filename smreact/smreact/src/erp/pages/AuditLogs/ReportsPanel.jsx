import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import {
  hydrateLog,
  quickRange,
  formatDate,
} from './auditLogsData';
import { getAuditLogsByBranch } from '../../services/auditLogsService';
import {
  loadReportBranch,
  reportSchoolName,
  reportPalette,
  escReportText,
  buildReportTableHtml,
  buildStandardReportHtml,
  openDashReport,
  downloadReportExcel,
  reportFileName,
} from '../../reports/reportKit';

/* Columns per report type — shared by the Print (PDF) and Excel exports. */
const EXPORT_COLUMNS = {
  summary: [
    { key: 'sr',      label: '#',       align: 'center', width: '4%'  },
    { key: 'date',    label: 'Date',    width: '9%'  },
    { key: 'time',    label: 'Time',    width: '7%'  },
    { key: 'user',    label: 'User',    width: '11%' },
    { key: 'role',    label: 'Role',    width: '9%'  },
    { key: 'module',  label: 'Module',  width: '11%' },
    { key: 'action',  label: 'Action',  width: '14%' },
    { key: 'record',  label: 'Record',  width: '14%' },
    { key: 'details', label: 'Details' },
  ],
  user: [
    { key: 'sr',        label: '#',             align: 'center', width: '5%'  },
    { key: 'user',      label: 'User',          width: '20%' },
    { key: 'role',      label: 'Role',          width: '15%' },
    { key: 'total',     label: 'Total Actions', align: 'center', width: '12%' },
    { key: 'breakdown', label: 'Breakdown' },
  ],
  module: [
    { key: 'sr',        label: '#',             align: 'center', width: '5%'  },
    { key: 'module',    label: 'Module',        width: '22%' },
    { key: 'total',     label: 'Total Actions', align: 'center', width: '13%' },
    { key: 'breakdown', label: 'Breakdown' },
  ],
};

function exportRows(type, data) {
  if (type === 'user') {
    return data.byUser.map((r, i) => ({
      sr: i + 1, user: r.name || '—', role: r.role || '—', total: r.total, breakdown: breakdownText(r.byAction),
    }));
  }
  if (type === 'module') {
    return data.byModule.map((r, i) => ({
      sr: i + 1, module: r.label || '—', total: r.total, breakdown: breakdownText(r.byAction),
    }));
  }
  return data.rows.map((r, i) => ({
    sr: i + 1,
    date: formatDate(r.date),
    time: r.time,
    user: r.userName || '—',
    role: r.userRole || '—',
    module: r.moduleLabel || '—',
    action: r.actionLabel || '—',
    record: r.record || '—',
    details: r.details || '—',
  }));
}

/* Report rows are pulled page-by-page from the live API. */
const REPORT_PAGE_SIZE = 500;
const REPORT_MAX_PAGES = 40;   /* safety cap → max 20,000 rows per report */

async function fetchAllReportRows(filters) {
  const all = [];
  let total = 0;
  for (let page = 1; page <= REPORT_MAX_PAGES; page += 1) {
    const res = await getAuditLogsByBranch({ ...filters, pageNumber: page, pageSize: REPORT_PAGE_SIZE });
    const rows = res?.rows ?? [];
    total = res?.totalRecords ?? 0;
    all.push(...rows);
    if (rows.length === 0 || all.length >= total) break;
  }
  return { rows: all, total };
}

/* Group real rows (API gives names, not mock ids). */
function groupRows(rows, keyOf, metaOf) {
  const map = new Map();
  rows.forEach(r => {
    const k = keyOf(r) || '—';
    if (!map.has(k)) map.set(k, { key: k, ...metaOf(r), total: 0, byAction: {} });
    const g = map.get(k);
    g.total += 1;
    const a = r.actionLabel || r.action || '—';
    g.byAction[a] = (g.byAction[a] || 0) + 1;
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}

const breakdownText = (byAction) =>
  Object.entries(byAction)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');

const REPORT_TABS = [
  { id: 'summary', label: 'Audit Summary',  icon: 'fa-file-lines'  },
  { id: 'user',    label: 'User Activity',  icon: 'fa-user-check'  },
  { id: 'module',  label: 'Module Activity', icon: 'fa-grid-2'      },
];

const QUICK_RANGES = [
  { id: 'today',     label: 'Today'        },
  { id: 'last7',     label: 'Last 7 Days'  },
  { id: 'last30',    label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month'   },
];

/* ═══════════════════════════════════════════════════════════════════
   REPORTS PANEL — full-screen XL modal

   Two views:
   • Configure : pick the date range + optional user/module filter.
   • Preview   : A4 sheet rendered server-side (no print iframe) with
                 a "Colorful / Colorless" toggle and Print/Excel
                 export. Print isolation is handled by global CSS.
   ═══════════════════════════════════════════════════════════════════ */
export default function ReportsPanel({ type, filterOpts = {}, onChangeType, onClose, toast = () => {}, canDownload = true, canPrint = true }) {
  const userOptions   = filterOpts.users   || [];
  const moduleOptions = filterOpts.modules || [];
  /* ─── Filter state (configure step). */
  const [fromDate, setFromDate] = useState(quickRange('last30').fromDate);
  const [toDate,   setToDate]   = useState(quickRange('last30').toDate);
  const [userF,    setUserF]    = useState('');
  const [moduleF,  setModuleF]  = useState('');
  const [step,     setStep]     = useState('configure');   /* 'configure' | 'preview' */
  const [tone,     setTone]     = useState('colorful');    /* 'colorful' | 'colorless' */

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const applyQuick = (preset) => {
    const r = quickRange(preset);
    setFromDate(r.fromDate);
    setToDate(r.toDate);
  };

  const apiFilters = useMemo(() => ({
    fromDate, toDate, userId: userF, module: moduleF,
  }), [fromDate, toDate, userF, moduleF]);

  /* ─── Live "Matching Entries" count (configure step) — 1-row API call. */
  const [matchCount,   setMatchCount]   = useState(null);
  const [countLoading, setCountLoading] = useState(false);
  useEffect(() => {
    if (step !== 'configure') return undefined;
    const ctrl = new AbortController();
    setCountLoading(true);
    const t = setTimeout(() => {
      getAuditLogsByBranch({ ...apiFilters, pageNumber: 1, pageSize: 1 }, { signal: ctrl.signal })
        .then(res => setMatchCount(res?.totalRecords ?? 0))
        .catch(err => { if (err.name !== 'AbortError') setMatchCount(null); })
        .finally(() => { if (!ctrl.signal.aborted) setCountLoading(false); });
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [apiFilters, step]);

  /* ─── Full report rows — fetched when "Generate Report" is clicked. */
  const [reportRows,  setReportRows]  = useState([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [generating,  setGenerating]  = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [schoolName,  setSchoolName]  = useState(() => reportSchoolName());

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const [{ rows, total }] = await Promise.all([
        fetchAllReportRows(apiFilters),
        Promise.resolve(loadReportBranch()).catch(() => null),
      ]);
      setSchoolName(reportSchoolName());
      setReportRows(rows);
      setReportTotal(total);
      setGeneratedAt(new Date());
      if (rows.length === 0) {
        toast('No entries match the selected filters', 'error');
        return;
      }
      if (total > rows.length) {
        toast(`Showing first ${rows.length} of ${total} entries — narrow the date range for a complete report`, 'warning');
      }
      setStep('preview');
    } catch (err) {
      console.error('Could not build audit report:', err);
      toast(err.message || 'Could not generate report', 'error');
    } finally {
      setGenerating(false);
    }
  };

  /* ─── Report payload — denormalised for the A4 view. */
  const data = useMemo(() => {
    const rows = reportRows.map(hydrateLog);
    const byAction = groupRows(rows, r => r.actionLabel || r.action, () => ({}))
      .map(g => ({ label: g.key, count: g.total }));
    return {
      rows,
      byAction,
      byUser:   groupRows(rows, r => r.userName, r => ({ name: r.userName, role: r.userRole })),
      byModule: groupRows(rows, r => r.moduleLabel || r.module, r => ({ label: r.moduleLabel || r.module })),
      total:    rows.length,
      grandTotal: reportTotal,
    };
  }, [reportRows, reportTotal]);

  const rangeLabel = useMemo(() => {
    if (fromDate && toDate && fromDate === toDate) return formatDate(fromDate);
    if (fromDate && toDate) return `${formatDate(fromDate)} → ${formatDate(toDate)}`;
    if (fromDate)           return `From ${formatDate(fromDate)}`;
    if (toDate)             return `Until ${formatDate(toDate)}`;
    return 'All Time';
  }, [fromDate, toDate]);

  const userLabel = userF
    ? `${userOptions.find(u => u.id === userF)?.name || ''}`
    : 'All Users';
  const moduleLabel = moduleF || 'All Modules';

  const titleByType = {
    summary: 'Audit Summary Report',
    user:    'User Activity Report',
    module:  'Module Activity Report',
  };

  const filterLine = `${rangeLabel} · ${userLabel} · ${moduleLabel}`;

  /* ─── Excel export — real .xlsx via the shared ERP report kit. */
  const handleExcel = async () => {
    try {
      await downloadReportExcel({
        title:    titleByType[type],
        subtitle: schoolName,
        metaLine: `${filterLine} · ${data.total} entries`,
        columns:  EXPORT_COLUMNS[type],
        rows:     exportRows(type, data),
        filename: `${reportFileName(titleByType[type])}_${fromDate || 'all'}_${toDate || 'all'}.xlsx`,
        isColor:  tone === 'colorful',
      });
      toast('Report downloaded as Excel', 'success');
    } catch (err) {
      console.error('Audit report Excel export failed:', err);
      toast('Could not download Excel report', 'error');
    }
  };

  /* ─── Print / PDF — opens a standalone, paginated report window
         (same chrome as every other ERP report) instead of printing the
         modal, which repeated page 1 and clipped the wide table. */
  const handlePrint = () => {
    const isColor = tone === 'colorful';
    const p = reportPalette(isColor);
    const cols = EXPORT_COLUMNS[type];
    const rows = exportRows(type, data).map(r => {
      const o = {};
      cols.forEach(c => { o[c.key] = escReportText(r[c.key]); });
      return o;
    });
    const stat = (lbl, val) => `
      <div style="flex:1;min-width:120px;border:1px solid ${p.border};border-radius:10px;padding:10px 14px;background:${isColor ? '#F8FAFF' : '#fff'}">
        <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${p.textM}">${lbl}</div>
        <div style="font-size:20px;font-weight:800;color:${p.accent};margin-top:4px">${val}</div>
      </div>`;
    const sectionH = (t) => `<div style="font-size:13px;font-weight:800;color:${p.accent};margin:0 0 10px;${p.sectionAccent}">${t}</div>`;
    const sectionTitle = type === 'user' ? 'Activity by User' : type === 'module' ? 'Activity by Module' : 'Activity Log';
    const bodyHtml = `
      <style>
        table{table-layout:fixed}
        td,th{word-break:break-word;overflow-wrap:anywhere;vertical-align:top}
        thead{display:table-header-group}
        tr{page-break-inside:avoid;break-inside:avoid}
        @media print{.page{width:auto !important}}
      </style>
      <div style="font-size:12px;color:${p.textM};margin-bottom:14px"><strong style="color:${p.textD}">Filters:</strong> ${escReportText(filterLine)}</div>
      ${sectionH('Summary')}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px">
        ${stat('Total Entries', data.total)}
        ${stat('Unique Users', data.byUser.length)}
        ${stat('Modules', data.byModule.length)}
        ${stat('Action Types', data.byAction.length)}
      </div>
      ${sectionH(sectionTitle)}
      ${buildReportTableHtml({ columns: cols, rows, isColor, emptyText: 'No activity in this range.' })}
    `;
    openDashReport(() => buildStandardReportHtml({
      title: titleByType[type],
      isColor,
      bodyHtml,
      schoolName,
      subtitleLine: `Audit Trail · ${filterLine}`,
      orientation: type === 'summary' ? 'landscape' : 'portrait',
    }), { toast });
  };

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="al-rep-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--xl al-rep-print">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-file-export" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="al-rep-title">Audit Logs — Reports</div>
              <div className="up-modal-sub">
                <span>{titleByType[type]}</span>
                {step === 'preview' && (
                  <>
                    <span>·</span>
                    <span>{rangeLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="up-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        {/* Report-type tab strip — shown only in configure step */}
        {step === 'configure' && (
          <div className="al-rep-tabs">
            {REPORT_TABS.map(t => (
              <Tooltip key={t.id} text={`Switch to ${t.label} report`}>
                <button
                  type="button"
                  className={`al-rep-tab${type === t.id ? ' on' : ''}`}
                  onClick={() => onChangeType(t.id)}
                >
                  <i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}
                </button>
              </Tooltip>
            ))}
          </div>
        )}

        {step === 'configure' ? (
          /* ── CONFIGURE STEP ── */
          <div className="up-modal-body">
            <div className="al-rep-info">
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
              <span>Pick a date range and (optionally) a user or module. The report is built on the fly — no log data is mutated.</span>
            </div>

            {/* Quick range pills */}
            <div className="al-quick" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 12 }}>
              {QUICK_RANGES.map(q => (
                <Tooltip key={q.id} text={`Set date range to ${q.label}`}>
                  <button
                    type="button"
                    className="al-quick-pill"
                    onClick={() => applyQuick(q.id)}
                  >{q.label}</button>
                </Tooltip>
              ))}
            </div>

            <div className="al-filter-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <label className="al-field">
                <span>From Date</span>
                <input type="date" className="up-form-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label className="al-field">
                <span>To Date</span>
                <input type="date" className="up-form-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </label>
              <label className="al-field">
                <span>User</span>
                <select className="up-select" value={userF} onChange={(e) => setUserF(e.target.value)}>
                  <option value="">All Users</option>
                  {userOptions.map(u => <option key={u.id} value={u.id}>{u.role ? `${u.name} — ${u.role}` : u.name}</option>)}
                </select>
              </label>
              <label className="al-field">
                <span>Module</span>
                <select className="up-select" value={moduleF} onChange={(e) => setModuleF(e.target.value)}>
                  <option value="">All Modules</option>
                  {moduleOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>

            <div className="al-rep-preview">
              <div>
                <div className="al-rep-preview-lbl">Matching Entries</div>
                <div className="al-rep-preview-val al-rep-preview-val--lg">
                  {countLoading ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> : (matchCount ?? '—')}
                </div>
              </div>
              <div>
                <div className="al-rep-preview-lbl">Range</div>
                <div className="al-rep-preview-val">{rangeLabel}</div>
              </div>
              <div>
                <div className="al-rep-preview-lbl">Filter</div>
                <div className="al-rep-preview-val">{userLabel} · {moduleLabel}</div>
              </div>
            </div>
          </div>
        ) : (
          /* ── PREVIEW STEP ── */
          <>
            <div className="al-rep-toolbar">
              <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tooltip text="Return to filter configuration" placement="bottom">
                  <button type="button" className="up-btn up-btn-ghost up-btn-sm" onClick={() => setStep('configure')}>
                    <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to Filters
                  </button>
                </Tooltip>
                <span className="al-rep-toolbar-meta">
                  {data.total}{data.grandTotal > data.total ? ` of ${data.grandTotal}` : ''} entries · {rangeLabel}
                </span>
              </div>
              <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="al-rep-tone" role="group" aria-label="Report tone">
                  <Tooltip text="Colorful — ERP brand colours" placement="bottom">
                    <button
                      type="button"
                      className={`al-rep-tone-btn${tone === 'colorful' ? ' on' : ''}`}
                      onClick={() => setTone('colorful')}
                    >
                      <i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful
                    </button>
                  </Tooltip>
                  <Tooltip text="Colorless — ink-saving for printing" placement="bottom">
                    <button
                      type="button"
                      className={`al-rep-tone-btn${tone === 'colorless' ? ' on' : ''}`}
                      onClick={() => setTone('colorless')}
                    >
                      <i className="fa-solid fa-droplet-slash" aria-hidden="true"></i> Colorless
                    </button>
                  </Tooltip>
                </div>
                {canDownload && (
                  <Tooltip text="Download as Excel/CSV" placement="bottom">
                    <button type="button" className="up-btn up-btn-ghost up-btn-sm" onClick={handleExcel}>
                      <i className="fa-solid fa-file-excel" aria-hidden="true"></i> Excel
                    </button>
                  </Tooltip>
                )}
                {canPrint && (
                  <Tooltip text="Print report" placement="bottom">
                    <button type="button" className="up-btn up-btn-primary up-btn-sm" onClick={handlePrint}>
                      <i className="fa-solid fa-print" aria-hidden="true"></i> Print
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="al-rep-stage">
              <A4Sheet
                type={type}
                tone={tone}
                data={data}
                rangeLabel={rangeLabel}
                userLabel={userLabel}
                moduleLabel={moduleLabel}
                titleByType={titleByType}
                schoolName={schoolName}
                generatedAt={generatedAt}
              />
            </div>
          </>
        )}

        {step === 'configure' && (
          <div className="up-modal-foot">
            <Tooltip text="Discard and close the reports panel">
              <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text={matchCount === 0 ? 'No entries match the current filters' : 'Preview the report as an A4 sheet'}>
              <button
                type="button"
                className="up-btn up-btn-primary"
                disabled={generating || matchCount === 0}
                onClick={handleGenerate}
              >
                {generating
                  ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating…</>
                  : <><i className="fa-solid fa-eye" aria-hidden="true"></i> Generate Report</>}
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   A4 SHEET — renders one of three report layouts.
   Same DOM for colorful + colorless; the .colorless class flips the
   palette via CSS overrides.
   ═══════════════════════════════════════════════════════════════════ */
function A4Sheet({ type, tone, data, rangeLabel, userLabel, moduleLabel, titleByType, schoolName, generatedAt }) {
  const cls = `al-a4${tone === 'colorless' ? ' colorless' : ''}`;
  const d = generatedAt || new Date();
  const isoDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const generatedLabel = `${formatDate(isoDay)} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  const school = schoolName || 'School';

  return (
    <div className={cls}>
      <div className="al-a4-head">
        <div className="al-a4-head-l">
          <div className="al-a4-logo"><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i></div>
          <div>
            <div className="al-a4-school">{school}</div>
            <div className="al-a4-tagline">Audit Trail · Read-only Activity History</div>
          </div>
        </div>
        <div className="al-a4-head-r">
          <div className="al-a4-title">{titleByType[type]}</div>
          <div className="al-a4-meta">Range: {rangeLabel}</div>
          <div className="al-a4-meta">{userLabel} · {moduleLabel}</div>
          <div className="al-a4-meta">Generated: {generatedLabel}</div>
        </div>
      </div>

      {/* Quick stats panel — shown for every report type */}
      <div className="al-a4-section">
        <div className="al-a4-section-h">Summary</div>
        <div className="al-a4-stats">
          <Stat lbl="Total Entries" val={data.total} />
          <Stat lbl="Unique Users"  val={data.byUser.length} />
          <Stat lbl="Modules"       val={data.byModule.length} />
          <Stat lbl="Action Types"  val={data.byAction.length} />
        </div>
      </div>

      {type === 'summary' && (
        <div className="al-a4-section">
          <div className="al-a4-section-h">Activity Log</div>
          <table className="al-a4-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Module</th>
                <th>Action</th>
                <th>Record</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16 }}>No activity in this range.</td></tr>
              ) : data.rows.map(r => (
                <tr key={r.id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.time}</td>
                  <td>{r.userName}</td>
                  <td>{r.userRole}</td>
                  <td>{r.moduleLabel}</td>
                  <td>{r.actionLabel}</td>
                  <td>{r.record}</td>
                  <td>{r.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {type === 'user' && (
        <div className="al-a4-section">
          <div className="al-a4-section-h">Activity by User</div>
          <table className="al-a4-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Total Actions</th>
                <th>Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {data.byUser.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16 }}>No activity in this range.</td></tr>
              ) : data.byUser.map(row => (
                <tr key={row.key}>
                  <td>{row.name || '—'}</td>
                  <td>{row.role || '—'}</td>
                  <td>{row.total}</td>
                  <td>{breakdownText(row.byAction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {type === 'module' && (
        <div className="al-a4-section">
          <div className="al-a4-section-h">Activity by Module</div>
          <table className="al-a4-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Total Actions</th>
                <th>Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {data.byModule.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 16 }}>No activity in this range.</td></tr>
              ) : data.byModule.map(row => (
                <tr key={row.key}>
                  <td>{row.label || '—'}</td>
                  <td>{row.total}</td>
                  <td>{breakdownText(row.byAction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="al-a4-foot">
        <span>{school} · Audit Logs · Confidential</span>
        <span>{data.total} entries</span>
      </div>
    </div>
  );
}

function Stat({ lbl, val }) {
  return (
    <div className="al-a4-stat">
      <div className="al-a4-stat-lbl">{lbl}</div>
      <div className="al-a4-stat-val">{val}</div>
    </div>
  );
}
