import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import {
  MODULES,
  USERS,
  ACTIONS,
  hydrateLog,
  filterLogs,
  quickRange,
  formatDate,
  aggregateByUser,
  aggregateByModule,
} from './auditLogsData';

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
export default function ReportsPanel({ type, allLogs, onChangeType, onClose, toast }) {
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

  /* ─── Filtered rows for the report payload. */
  const filtered = useMemo(() => filterLogs(allLogs, {
    fromDate, toDate, user: userF, module: moduleF,
  }), [allLogs, fromDate, toDate, userF, moduleF]);

  /* ─── Report payload — denormalised for the A4 view. */
  const data = useMemo(() => {
    const rows = filtered.map(hydrateLog).sort((a, b) => {
      if (a.date === b.date) return a.time < b.time ? 1 : -1;
      return a.date < b.date ? 1 : -1;
    });
    const byAction = ACTIONS.map(a => ({
      label: a.label,
      count: rows.filter(r => r.action === a.id).length,
    })).filter(r => r.count > 0);
    return {
      rows,
      byAction,
      byUser:   aggregateByUser(rows),
      byModule: aggregateByModule(rows),
      total:    rows.length,
    };
  }, [filtered]);

  const rangeLabel = useMemo(() => {
    if (fromDate && toDate && fromDate === toDate) return formatDate(fromDate);
    if (fromDate && toDate) return `${formatDate(fromDate)} → ${formatDate(toDate)}`;
    if (fromDate)           return `From ${formatDate(fromDate)}`;
    if (toDate)             return `Until ${formatDate(toDate)}`;
    return 'All Time';
  }, [fromDate, toDate]);

  const userLabel = userF
    ? `${USERS.find(u => u.id === userF)?.name || ''}`
    : 'All Users';
  const moduleLabel = moduleF
    ? `${MODULES.find(m => m.id === moduleF)?.label || ''}`
    : 'All Modules';

  /* ─── Excel export — CSV download with .xlsx extension trickery
         (Excel opens CSV happily). Replace with a real xlsx generator
         when wiring backend. */
  const handleExcel = () => {
    const headers = ['Date', 'Time', 'User', 'Role', 'Module', 'Screen', 'Action', 'Record', 'Details', 'Old Value', 'New Value'];
    const csv = [headers.join(',')].concat(
      data.rows.map(r => [
        formatDate(r.date), r.time, r.userName, r.userRole,
        r.moduleLabel, r.screen, r.actionLabel, r.record, r.details,
        r.oldValue || '—', r.newValue || '—',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${type}-${fromDate || 'all'}_${toDate || 'all'}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Report downloaded as CSV', 'success');
  };

  const handlePrint = () => {
    /* Trigger native print; the global @media print rules in AL_CSS
       hide everything except the A4 sheets. */
    window.print();
  };

  const titleByType = {
    summary: 'Audit Summary Report',
    user:    'User Activity Report',
    module:  'Module Activity Report',
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
                  {USERS.map(u => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
                </select>
              </label>
              <label className="al-field">
                <span>Module</span>
                <select className="up-select" value={moduleF} onChange={(e) => setModuleF(e.target.value)}>
                  <option value="">All Modules</option>
                  {MODULES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            </div>

            <div className="al-rep-preview">
              <div>
                <div className="al-rep-preview-lbl">Matching Entries</div>
                <div className="al-rep-preview-val al-rep-preview-val--lg">{filtered.length}</div>
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
                  {data.total} entries · {rangeLabel}
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
                <Tooltip text="Download as Excel/CSV" placement="bottom">
                  <button type="button" className="up-btn up-btn-ghost up-btn-sm" onClick={handleExcel}>
                    <i className="fa-solid fa-file-excel" aria-hidden="true"></i> Excel
                  </button>
                </Tooltip>
                <Tooltip text="Print report" placement="bottom">
                  <button type="button" className="up-btn up-btn-primary up-btn-sm" onClick={handlePrint}>
                    <i className="fa-solid fa-print" aria-hidden="true"></i> Print
                  </button>
                </Tooltip>
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
              />
            </div>
          </>
        )}

        {step === 'configure' && (
          <div className="up-modal-foot">
            <Tooltip text="Discard and close the reports panel">
              <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text={filtered.length === 0 ? 'No entries match the current filters' : 'Preview the report as an A4 sheet'}>
              <button
                type="button"
                className="up-btn up-btn-primary"
                disabled={filtered.length === 0}
                onClick={() => setStep('preview')}
              >
                <i className="fa-solid fa-eye" aria-hidden="true"></i> Generate Report
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
function A4Sheet({ type, tone, data, rangeLabel, userLabel, moduleLabel, titleByType }) {
  const cls = `al-a4${tone === 'colorless' ? ' colorless' : ''}`;
  const generatedAt = '31 May 2026 · 11:45 AM';

  return (
    <div className={cls}>
      <div className="al-a4-head">
        <div className="al-a4-head-l">
          <div className="al-a4-logo"><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i></div>
          <div>
            <div className="al-a4-school">The Oxford System, Lahore Campus</div>
            <div className="al-a4-tagline">Audit Trail · Read-only Activity History</div>
          </div>
        </div>
        <div className="al-a4-head-r">
          <div className="al-a4-title">{titleByType[type]}</div>
          <div className="al-a4-meta">Range: {rangeLabel}</div>
          <div className="al-a4-meta">{userLabel} · {moduleLabel}</div>
          <div className="al-a4-meta">Generated: {generatedAt}</div>
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
                <tr key={row.user?.id}>
                  <td>{row.user?.name || '—'}</td>
                  <td>{row.user?.role || '—'}</td>
                  <td>{row.total}</td>
                  <td>{Object.entries(row.byAction).map(([k, v]) => {
                    const lbl = ACTIONS.find(a => a.id === k)?.label || k;
                    return `${lbl}: ${v}`;
                  }).join(' · ')}</td>
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
                <tr key={row.module?.id}>
                  <td>{row.module?.label || '—'}</td>
                  <td>{row.total}</td>
                  <td>{Object.entries(row.byAction).map(([k, v]) => {
                    const lbl = ACTIONS.find(a => a.id === k)?.label || k;
                    return `${lbl}: ${v}`;
                  }).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="al-a4-foot">
        <span>The Oxford System, Lahore Campus · Audit Logs · Confidential</span>
        <span>Page 1 of 1</span>
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
