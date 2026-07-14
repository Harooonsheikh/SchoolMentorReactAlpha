import React, { useMemo, useState } from 'react';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';
import LogDetailsModal from './LogDetailsModal';
import ReportsPanel from './ReportsPanel';
import { usePermissions } from '../../context/PermissionsContext';
import {
  INITIAL_LOGS,
  MODULES,
  ACTIONS,
  USERS,
  hydrateLog,
  filterLogs,
  summaryStats,
  quickRange,
  formatDate,
  initialsOf,
} from './auditLogsData';

/* ═══════════════════════════════════════════════════════════════════
   AUDIT LOGS — central activity tracking screen

   Every entry in `INITIAL_LOGS` is read-only — this component does
   not expose any edit/delete primitives. The page is built out of
   reused ERP design-system patterns (stat cards, filter bar, table,
   tooltips) so it blends with HR / Settings / User Permissions.
   ═══════════════════════════════════════════════════════════════════ */

const QUICK_RANGES = [
  { id: 'today',     label: 'Today'        },
  { id: 'yesterday', label: 'Yesterday'    },
  { id: 'last7',     label: 'Last 7 Days'  },
  { id: 'last30',    label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month'   },
  { id: 'custom',    label: 'Custom Range' },
];

const REPORT_TYPES = [
  { id: 'summary', label: 'Audit Summary Report',  icon: 'fa-file-lines',    desc: 'High-level summary of every activity in the range' },
  { id: 'user',    label: 'User Activity Report',  icon: 'fa-user-check',    desc: 'Per-user breakdown of activities performed' },
  { id: 'module',  label: 'Module Activity Report', icon: 'fa-grid-2',        desc: 'Per-module breakdown of activities performed' },
];

const PAGE_SIZE = 15;

export default function AuditLogs({ toast = () => {} }) {
  /* ─── Logs are append-only and frozen at module load. We don't
         expose a setter to anything below — the only mutation in the
         module is the filter state. */
  const [logs] = useState(INITIAL_LOGS);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* ─── Per-user permissions — the Reports export/print actions are
         gated on the logged-in user's rights. FAIL-OPEN via can(). */
  const { can } = usePermissions();
  const canDownload = can('Audit Logs', 'Activity Logs', 'Download');
  const canPrint    = can('Audit Logs', 'Activity Logs', 'Print');

  /* ─── Filters ─── */
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');
  const [moduleF,  setModuleF]  = useState('');
  const [userF,    setUserF]    = useState('');
  const [actionF,  setActionF]  = useState('');
  const [search,   setSearch]   = useState('');
  const [quick,    setQuick]    = useState('');
  const [page,     setPage]     = useState(1);

  /* ─── Modals / drawers ─── */
  const [selected,    setSelected]    = useState(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportsTab,  setReportsTab]  = useState(null);   /* 'summary' | 'user' | 'module' */
  const [menuOpen,    setMenuOpen]    = useState(false);

  /* ─── Apply a quick-range pill. Custom keeps the existing date
         inputs editable; the other presets snap them to a range. */
  const applyQuick = (preset) => {
    setQuick(preset);
    setPage(1);
    if (preset === 'custom') return;
    const r = quickRange(preset);
    setFromDate(r.fromDate);
    setToDate(r.toDate);
  };

  const clearFilters = () => {
    setFromDate(''); setToDate('');
    setModuleF(''); setUserF(''); setActionF('');
    setSearch(''); setQuick(''); setPage(1);
  };

  /* ─── Filtered list — sorted newest first by date then time. */
  const filtered = useMemo(() => {
    const out = filterLogs(logs, {
      fromDate, toDate,
      module: moduleF, user: userF, action: actionF,
      search,
    }).slice().sort((a, b) => {
      if (a.date === b.date) return a.time < b.time ? 1 : -1;
      return a.date < b.date ? 1 : -1;
    });
    return out;
  }, [logs, fromDate, toDate, moduleF, userF, actionF, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* ─── Summary stats use the *whole* log set, not the filtered view,
         so the cards represent the entire activity. */
  const stats = useMemo(() => summaryStats(logs), [logs]);

  const openReport = (id) => {
    setReportsTab(id);
    setReportsOpen(true);
    setMenuOpen(false);
  };

  const hydratedSelected = selected ? hydrateLog(selected) : null;

  /* Are any filters active? Drives the "active filters" pill row. */
  const hasFilters = !!(fromDate || toDate || moduleF || userF || actionF || search || quick);

  return (
    <>
      <style>{AL_CSS}</style>

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-clipboard-list"></i>
          </div>
          <div>
            <div className="page-title">Audit Logs</div>
            <div className="page-sub">Read-only activity history — who did what, when, and where</div>
          </div>
        </div>
        <div className="al-header-actions">
          {/* Reports — dropdown with three report kinds */}
          <div className="al-menu-wrap">
            <Tooltip text="Generate Report">
              <button
                type="button"
                className="up-btn up-btn-primary"
                onClick={() => setMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <i className="fa-solid fa-file-export" aria-hidden="true"></i> Reports
                <i className={`fa-solid fa-chevron-${menuOpen ? 'up' : 'down'}`} style={{ fontSize: 10, marginLeft: 4 }} aria-hidden="true"></i>
              </button>
            </Tooltip>
            {menuOpen && (
              <>
                <div className="al-menu-back" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div className="al-menu" role="menu">
                  {REPORT_TYPES.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      role="menuitem"
                      className="al-menu-item"
                      onClick={() => openReport(r.id)}
                    >
                      <span className="al-menu-ic">
                        <i className={`fa-solid ${r.icon}`} aria-hidden="true"></i>
                      </span>
                      <span className="al-menu-info">
                        <span className="al-menu-lbl">{r.label}</span>
                        <span className="al-menu-desc">{r.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Tooltip text="Play a short tutorial for the Audit Logs module">
            <button
              className="tutorial-btn page-tutorial-btn"
              onClick={() => setTutorialOpen(true)}
              aria-label="Open Audit Logs tutorials"
            >
              <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
              <span className="tutorial-label">Tutorial</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ── Read-only banner — reminds Super Admins that logs are immutable */}
      <div className="al-banner" role="note" aria-live="polite">
        <i className="fa-solid fa-lock" aria-hidden="true"></i>
        <span>
          <b>Read-only history.</b> Audit Logs cannot be edited or deleted — even by Super Admin — so accountability stays intact.
        </span>
      </div>

      {/* ── Stat strip — 5 cards: Today / Week / Month / Total / Active Today */}
      <div className="al-stats">
        <Stat tone="blue"   icon="fa-bolt"            label="Today's Activities"      value={stats.today} sub="Events recorded today" />
        <Stat tone="indigo" icon="fa-calendar-week"   label="This Week"               value={stats.week}  sub="Last 7 days" />
        <Stat tone="green"  icon="fa-calendar"        label="This Month"              value={stats.month} sub={formatMonthLabel()} />
        <Stat tone="amber"  icon="fa-database"        label="Total Log Entries"       value={stats.total} sub="All-time activity" />
        <Stat tone="purple" icon="fa-user-clock"      label="Active Users Today"      value={stats.activeToday} sub={stats.activeToday === 1 ? '1 user signed in' : `${stats.activeToday} users signed in`} />
      </div>

      {/* ── Filter section ── */}
      <div className="al-filter-card">
        <div className="al-filter-h">
          <div className="al-filter-title">
            <i className="fa-solid fa-filter" aria-hidden="true"></i>
            <span>Filter Logs</span>
            {hasFilters && (
              <span className="al-filter-pill">
                <i className="fa-solid fa-circle" aria-hidden="true"></i> Filters active
              </span>
            )}
          </div>
          {hasFilters && (
            <Tooltip text="Clear all active filters">
              <button type="button" className="up-btn up-btn-ghost up-btn-sm" onClick={clearFilters}>
                <i className="fa-solid fa-broom" aria-hidden="true"></i> Clear All
              </button>
            </Tooltip>
          )}
        </div>

        {/* Quick range pills */}
        <div className="al-quick">
          {QUICK_RANGES.map(q => (
            <Tooltip key={q.id} text={`Filter to ${q.label}`}>
              <button
                type="button"
                className={`al-quick-pill${quick === q.id ? ' on' : ''}`}
                onClick={() => applyQuick(q.id)}
              >
                {q.label}
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Date range + selects + search — 6-column grid that collapses
             to 2 cols on tablets and 1 col on phones. */}
        <div className="al-filter-grid">
          <label className="al-field">
            <span>From Date</span>
            <input
              type="date"
              className="up-form-input"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setQuick(''); setPage(1); }}
            />
          </label>
          <label className="al-field">
            <span>To Date</span>
            <input
              type="date"
              className="up-form-input"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setQuick(''); setPage(1); }}
            />
          </label>
          <label className="al-field">
            <span>Module</span>
            <select
              className="up-select"
              value={moduleF}
              onChange={(e) => { setModuleF(e.target.value); setPage(1); }}
            >
              <option value="">All Modules</option>
              {MODULES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="al-field">
            <span>User</span>
            <select
              className="up-select"
              value={userF}
              onChange={(e) => { setUserF(e.target.value); setPage(1); }}
            >
              <option value="">All Users</option>
              {USERS.map(u => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
            </select>
          </label>
          <label className="al-field">
            <span>Action</span>
            <select
              className="up-select"
              value={actionF}
              onChange={(e) => { setActionF(e.target.value); setPage(1); }}
            >
              <option value="">All Actions</option>
              {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <label className="al-field">
            <span>Search</span>
            <div className="al-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input
                type="text"
                placeholder="Search record, user, details…"
                className="up-form-input"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </label>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="al-table-card">
        <div className="al-table-h">
          <div className="al-table-title">
            <i className="fa-solid fa-list-check" aria-hidden="true"></i>
            <span>Activity History</span>
            <span className="al-count-badge">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="up-empty">
            <div className="up-empty-ic"><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i></div>
            <div className="up-empty-t">No log entries match these filters</div>
            <div className="up-empty-s">Adjust the date range, user, or module filters to widen the search.</div>
            {hasFilters && (
              <Tooltip text="Reset all filters">
                <button type="button" className="up-btn up-btn-ghost" onClick={clearFilters} style={{ marginTop: 12 }}>
                  <i className="fa-solid fa-broom" aria-hidden="true"></i> Clear Filters
                </button>
              </Tooltip>
            )}
          </div>
        ) : (
          <>
            {/* Desktop / Tablet — full table */}
            <div className="al-table-scroll">
              <table className="al-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Module</th>
                    <th>Screen</th>
                    <th>Action</th>
                    <th>Record</th>
                    <th>Details</th>
                    <th style={{ textAlign: 'right' }}>—</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(log => {
                    const h = hydrateLog(log);
                    return (
                      <tr key={log.id}>
                        <td className="al-td-date">{formatDate(h.date)}</td>
                        <td className="al-td-time">{h.time}</td>
                        <td>
                          <div className="al-user-cell">
                            <span className="up-avatar">{initialsOf(h.userName)}</span>
                            <div className="al-user-info">
                              <div className="al-user-name">{h.userName}</div>
                              <div className="al-user-email">{h.userEmail}</div>
                            </div>
                          </div>
                        </td>
                        <td>{h.userRole}</td>
                        <td>
                          <span className="al-module-chip">
                            <i className={`fa-solid ${h.moduleIcon}`} aria-hidden="true"></i> {h.moduleLabel}
                          </span>
                        </td>
                        <td>{h.screen}</td>
                        <td>
                          <span className={`up-badge up-badge--${h.actionTone}`}>{h.actionLabel}</span>
                        </td>
                        <td className="al-td-record">{h.record}</td>
                        <td className="al-td-details">{h.details}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Tooltip text="View Details">
                            <button
                              type="button"
                              className="al-icon-btn"
                              onClick={() => setSelected(log)}
                              aria-label={`View details for log ${log.id}`}
                            >
                              <i className="fa-solid fa-eye" aria-hidden="true"></i>
                            </button>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile — card list (visible only at ≤640 px via CSS) */}
            <div className="al-cards">
              {pageRows.map(log => {
                const h = hydrateLog(log);
                return (
                  <div className="al-card" key={`m-${log.id}`}>
                    <div className="al-card-h">
                      <div className="al-user-cell">
                        <span className="up-avatar">{initialsOf(h.userName)}</span>
                        <div className="al-user-info">
                          <div className="al-user-name">{h.userName}</div>
                          <div className="al-user-email">{h.userRole}</div>
                        </div>
                      </div>
                      <span className={`up-badge up-badge--${h.actionTone}`}>{h.actionLabel}</span>
                    </div>
                    <div className="al-card-row">
                      <span className="al-module-chip">
                        <i className={`fa-solid ${h.moduleIcon}`} aria-hidden="true"></i> {h.moduleLabel}
                      </span>
                      <span className="al-card-time">{formatDate(h.date)} · {h.time}</span>
                    </div>
                    <div className="al-card-record">{h.record}</div>
                    <div className="al-card-details">{h.details}</div>
                    <Tooltip text="View full log details">
                      <button
                        type="button"
                        className="up-btn up-btn-ghost up-btn-sm"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                        onClick={() => setSelected(log)}
                      >
                        <i className="fa-solid fa-eye" aria-hidden="true"></i> View Details
                      </button>
                    </Tooltip>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="al-pager">
                <Tooltip text="Previous page">
                  <button
                    type="button"
                    className="up-btn up-btn-ghost up-btn-sm"
                    disabled={safePage === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <i className="fa-solid fa-chevron-left" aria-hidden="true"></i> Prev
                  </button>
                </Tooltip>
                <div className="al-pager-info">
                  Page <b>{safePage}</b> of <b>{totalPages}</b>
                  <span className="al-pager-hint">  · Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(filtered.length, safePage * PAGE_SIZE)} of {filtered.length}</span>
                </div>
                <Tooltip text="Next page">
                  <button
                    type="button"
                    className="up-btn up-btn-ghost up-btn-sm"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                  </button>
                </Tooltip>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Log details modal (read-only) ── */}
      {hydratedSelected && (
        <LogDetailsModal
          log={hydratedSelected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ── Reports panel — pre-filter + A4 viewer ── */}
      {reportsOpen && (
        <ReportsPanel
          type={reportsTab}
          allLogs={logs}
          onChangeType={setReportsTab}
          onClose={() => setReportsOpen(false)}
          toast={toast}
          canDownload={canDownload}
          canPrint={canPrint}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="auditLogs"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

function Stat({ tone, icon, label, value, sub }) {
  return (
    <Tooltip text={`${label}: ${value}${sub ? ` — ${sub}` : ''}`} placement="top">
      <div className={`al-stat al-stat--${tone}`}>
        <div className="al-stat-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
        <div className="al-stat-lbl">{label}</div>
        <div className="al-stat-val">{value}</div>
        {sub && <div className="al-stat-sub">{sub}</div>}
      </div>
    </Tooltip>
  );
}

function formatMonthLabel() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  /* Fixed demo clock — see auditLogsData.isoToday() */
  return `${months[4]} 2026`;
}

/* ═══════════════════════════════════════════════════════════════════
   Module CSS — self-contained, scoped to .al-* and reuses a handful
   of helper classes from the User Permissions module (.up-btn,
   .up-form-input, .up-select, .up-badge, .up-avatar, .up-empty) so
   visual treatment matches the rest of the ERP.
   ═══════════════════════════════════════════════════════════════════ */
const AL_CSS = `
:root { --al-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif; }
@keyframes alFade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
@keyframes alPop  { from { transform: translateY(8px) scale(.985); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

/* ─── Shared button + form chrome that mirrors UP_CSS — declared here
       so this module renders correctly even when User Permissions
       hasn't been mounted yet. */
.up-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  font: 600 12px/1 var(--al-font);
  border-radius: 9px; border: 1px solid transparent;
  cursor: pointer; transition: all .18s ease;
}
.up-btn-sm { height: 32px; padding: 0 12px; font-size: 11.5px; }
.up-btn:disabled { opacity: .5; cursor: not-allowed; }
.up-btn-primary {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF, #2563EB);
  color: #fff; box-shadow: 0 4px 12px rgba(30, 58, 138, .28);
}
.up-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(30, 58, 138, .38); }
.up-btn-ghost {
  background: #fff; color: #475569; border-color: #E2E8F0;
}
[data-theme="dark"] .up-btn-ghost { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.up-btn-ghost:hover:not(:disabled) { background: #F1F5F9; border-color: #CBD5E1; color: #1E40AF; }

.up-form-input, .up-select {
  width: 100%; height: 36px;
  padding: 0 12px; font: 500 12.5px/1 var(--al-font);
  color: var(--text-primary);
  background: #fff; border: 1px solid #E2E8F0; border-radius: 9px;
  transition: border-color .18s, box-shadow .18s, background .18s;
}
.up-select {
  appearance: none; -webkit-appearance: none;
  padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2364748B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
}
.up-form-input:focus, .up-select:focus {
  outline: none; border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(30, 64, 175, .12);
}
[data-theme="dark"] .up-form-input, [data-theme="dark"] .up-select {
  background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary);
}

.up-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff; font: 700 11px/1 var(--al-font);
  flex-shrink: 0;
}

.up-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px;
  font: 700 10.5px/1 var(--al-font);
  text-transform: uppercase; letter-spacing: .3px;
  white-space: nowrap;
}
.up-badge--blue   { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.up-badge--green  { background: rgba(21, 128, 61, .12); color: #15803D; }
.up-badge--red    { background: rgba(220, 38, 38, .12); color: #B91C1C; }
.up-badge--gray   { background: rgba(100, 116, 139, .14); color: #475569; }
.up-badge--amber  { background: rgba(217, 119, 6, .12); color: #92400E; }
.up-badge--purple { background: rgba(124, 58, 237, .14); color: #6D28D9; }
.up-badge--teal   { background: rgba(15, 118, 110, .14); color: #0F766E; }
[data-theme="dark"] .up-badge--blue   { background: rgba(96, 165, 250, .18); color: #BFDBFE; }
[data-theme="dark"] .up-badge--green  { background: rgba(74, 222, 128, .18); color: #BBF7D0; }
[data-theme="dark"] .up-badge--red    { background: rgba(248, 113, 113, .18); color: #FECACA; }
[data-theme="dark"] .up-badge--gray   { background: rgba(148, 163, 184, .18); color: #CBD5E1; }
[data-theme="dark"] .up-badge--amber  { background: rgba(251, 191, 36, .18); color: #FDE68A; }
[data-theme="dark"] .up-badge--purple { background: rgba(167, 139, 250, .18); color: #DDD6FE; }
[data-theme="dark"] .up-badge--teal   { background: rgba(45, 212, 191, .18); color: #99F6E4; }

.up-empty {
  text-align: center; padding: 60px 24px;
  animation: alFade .3s ease;
}
.up-empty-ic {
  width: 64px; height: 64px; border-radius: 16px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  color: #1E40AF; font-size: 28px; margin-bottom: 14px;
}
.up-empty-t  { font: 700 16px/1.4 var(--al-font); color: var(--text-primary); margin-bottom: 4px; }
.up-empty-s  { font: 500 12.5px/1.5 var(--al-font); color: var(--text-muted, #64748B); }

/* ─── Header actions row (Reports + Tutorial) ─── */
.al-header-actions { display: flex; align-items: center; gap: 10px; }

/* ─── Reports dropdown ─── */
.al-menu-wrap { position: relative; display: inline-block; }
.al-menu-back { position: fixed; inset: 0; z-index: 40; }
.al-menu {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 41;
  min-width: 320px; padding: 6px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0); border-radius: 12px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, .14);
  animation: alPop .22s ease;
}
.al-menu-item {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 10px 12px;
  background: transparent; border: none; border-radius: 9px;
  font: 600 12.5px/1.3 var(--al-font); color: var(--text-primary);
  text-align: left; cursor: pointer; transition: background .15s;
}
.al-menu-item:hover { background: #EFF6FF; color: #1E40AF; }
[data-theme="dark"] .al-menu-item:hover { background: rgba(96, 165, 250, .15); }
.al-menu-ic {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(30, 64, 175, .12); color: #1E40AF; font-size: 14px;
}
.al-menu-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.al-menu-lbl  { font-weight: 700; }
.al-menu-desc { font: 500 11px/1.4 var(--al-font); color: var(--text-muted, #64748B); }

/* ─── Read-only banner ─── */
.al-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; margin-bottom: 18px;
  background: linear-gradient(90deg, rgba(217, 119, 6, .08), rgba(217, 119, 6, .04));
  border: 1px solid rgba(217, 119, 6, .26); border-left: 3px solid #D97706;
  border-radius: 10px;
  font: 500 12.5px/1.5 var(--al-font); color: #92400E;
}
.al-banner i { color: #D97706; font-size: 14px; }
.al-banner b { font-weight: 800; }
[data-theme="dark"] .al-banner {
  background: rgba(217, 119, 6, .14);
  color: #FDE68A;
}

/* ─── Stat strip ─── */
.al-stats {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px;
  margin-bottom: 18px;
}
.al-stat {
  position: relative; padding: 16px 18px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px;
  transition: all .18s ease;
  animation: alFade .3s ease;
}
.al-stat:hover { border-color: #CBD5E1; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15, 23, 42, .06); }
.al-stat-ic {
  width: 36px; height: 36px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px; margin-bottom: 10px;
}
.al-stat--blue   .al-stat-ic { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.al-stat--green  .al-stat-ic { background: rgba(21, 128, 61, .12);  color: #15803D; }
.al-stat--indigo .al-stat-ic { background: rgba(67, 56, 202, .12);  color: #4338CA; }
.al-stat--amber  .al-stat-ic { background: rgba(217, 119, 6, .12);  color: #92400E; }
.al-stat--purple .al-stat-ic { background: rgba(124, 58, 237, .14); color: #6D28D9; }
.al-stat-lbl {
  font: 700 11px/1 var(--al-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px;
}
.al-stat-val {
  font: 800 26px/1 var(--al-font); color: var(--text-primary);
  margin-bottom: 4px;
}
.al-stat-sub { font: 500 11px/1.3 var(--al-font); color: var(--text-muted, #64748B); }

/* ─── Filter card ─── */
.al-filter-card {
  padding: 18px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px;
  margin-bottom: 18px;
}
.al-filter-h {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px; gap: 12px; flex-wrap: wrap;
}
.al-filter-title {
  display: inline-flex; align-items: center; gap: 8px;
  font: 700 13.5px/1 var(--al-font); color: var(--text-primary);
}
.al-filter-title i { color: #1E40AF; font-size: 13px; }
.al-filter-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; margin-left: 4px;
  font: 700 10px/1 var(--al-font); color: #15803D;
  background: rgba(21, 128, 61, .12); border-radius: 999px;
  text-transform: uppercase; letter-spacing: .4px;
}
.al-filter-pill i { font-size: 6px; color: #16A34A; }

/* Quick-range pill row */
.al-quick {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding-bottom: 14px; margin-bottom: 14px;
  border-bottom: 1px dashed var(--border-light, #E2E8F0);
}
.al-quick-pill {
  height: 28px; padding: 0 12px;
  font: 600 11.5px/1 var(--al-font); color: #475569;
  background: #F8FAFF; border: 1px solid #DBEAFE; border-radius: 999px;
  cursor: pointer; transition: all .15s;
}
.al-quick-pill:hover { background: #EFF6FF; color: #1E40AF; border-color: #BFDBFE; }
.al-quick-pill.on   { background: linear-gradient(135deg, #1E40AF, #2563EB); color: #fff; border-color: transparent; }
[data-theme="dark"] .al-quick-pill { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }

/* 6-column field grid */
.al-filter-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;
}
.al-field { display: flex; flex-direction: column; gap: 4px; }
.al-field > span {
  font: 700 10.5px/1 var(--al-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .4px;
}
.al-search { position: relative; }
.al-search i {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: #94A3B8; font-size: 11.5px; pointer-events: none;
}
.al-search .up-form-input { padding-left: 30px; }

/* ─── Table card ─── */
.al-table-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px;
  overflow: hidden;
  margin-bottom: 18px;
}
.al-table-h {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--border-light, #E2E8F0);
}
.al-table-title {
  display: inline-flex; align-items: center; gap: 8px;
  font: 700 13.5px/1 var(--al-font); color: var(--text-primary);
}
.al-table-title i { color: #1E40AF; font-size: 13px; }
.al-count-badge {
  display: inline-flex; align-items: center;
  padding: 3px 9px; margin-left: 4px;
  background: rgba(30, 64, 175, .12); color: #1E40AF;
  border-radius: 999px;
  font: 700 10.5px/1 var(--al-font);
}

.al-table-scroll { overflow-x: auto; }
.al-table {
  width: 100%; border-collapse: collapse;
  font: 500 12.5px/1.4 var(--al-font);
}
.al-table thead th {
  position: sticky; top: 0;
  padding: 10px 12px; text-align: left;
  background: #F8FAFF;
  font: 700 10.5px/1 var(--al-font); color: #475569;
  text-transform: uppercase; letter-spacing: .4px;
  border-bottom: 1px solid var(--border-light, #E2E8F0);
  white-space: nowrap;
}
[data-theme="dark"] .al-table thead th { background: rgba(96, 165, 250, .06); color: var(--text-muted, #94A3B8); }
.al-table tbody tr { border-bottom: 1px solid var(--border-light, #F1F5F9); transition: background .15s; }
.al-table tbody tr:hover { background: #F8FAFF; }
[data-theme="dark"] .al-table tbody tr:hover { background: rgba(96, 165, 250, .06); }
.al-table tbody td { padding: 12px; color: var(--text-primary); vertical-align: middle; }
.al-td-date  { white-space: nowrap; font-weight: 700; }
.al-td-time  { white-space: nowrap; color: var(--text-muted, #64748B); font-variant-numeric: tabular-nums; }
.al-td-record { font-weight: 600; max-width: 240px; }
.al-td-details { color: var(--text-muted, #64748B); max-width: 260px; }

.al-user-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
.al-user-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.al-user-name { font-weight: 700; color: var(--text-primary); }
.al-user-email { font: 500 10.5px/1 var(--al-font); color: var(--text-muted, #64748B); }

.al-module-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 9px;
  background: rgba(30, 64, 175, .08); color: #1E40AF;
  border-radius: 999px;
  font: 700 11px/1 var(--al-font);
  white-space: nowrap;
}
.al-module-chip i { font-size: 9.5px; }
[data-theme="dark"] .al-module-chip { background: rgba(96, 165, 250, .15); color: #BFDBFE; }

.al-icon-btn {
  width: 30px; height: 30px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: #EFF6FF; color: #1E40AF; border: 1px solid #DBEAFE;
  cursor: pointer; transition: all .15s;
}
.al-icon-btn:hover { background: #1E40AF; color: #fff; border-color: #1E40AF; transform: translateY(-1px); }
[data-theme="dark"] .al-icon-btn { background: rgba(96, 165, 250, .12); border-color: rgba(96, 165, 250, .26); }

/* Mobile card list — hidden by default; shown ≤640 px */
.al-cards { display: none; padding: 14px; gap: 12px; flex-direction: column; }
.al-card {
  padding: 12px; border: 1px solid var(--border-light, #E2E8F0); border-radius: 12px;
  background: var(--bg-card, #fff);
}
.al-card-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.al-card-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.al-card-time { font: 500 11px/1.2 var(--al-font); color: var(--text-muted, #64748B); }
.al-card-record { font: 700 13px/1.4 var(--al-font); color: var(--text-primary); margin-bottom: 4px; }
.al-card-details { font: 500 12px/1.4 var(--al-font); color: var(--text-muted, #64748B); }

/* Pagination */
.al-pager {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 12px 16px;
  border-top: 1px solid var(--border-light, #E2E8F0);
  background: #F8FAFF;
}
[data-theme="dark"] .al-pager { background: rgba(96, 165, 250, .04); }
.al-pager-info {
  font: 600 12px/1 var(--al-font); color: var(--text-primary);
}
.al-pager-hint { font-weight: 500; color: var(--text-muted, #64748B); }

/* ═══════════════════════════════════════════════════════════════════
   LOG DETAILS MODAL — declared once in this file so the modal can
   share the same chrome as the other ERP modals (.up-modal-* family).
   ═══════════════════════════════════════════════════════════════════ */
.up-modal-back {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15, 23, 42, .55);
  display: flex; align-items: center; justify-content: center;
  padding: 24px; animation: alFade .2s ease;
  backdrop-filter: blur(2px);
}
.up-modal {
  background: var(--bg-card, #fff);
  border-radius: 16px;
  width: min(640px, 100%);
  max-height: 90vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(15, 23, 42, .22);
  animation: alPop .28s ease;
}
.up-modal--lg { width: min(820px, 100%); }
.up-modal--xl { width: min(1000px, 100%); height: 90vh; }
.up-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF, #2563EB);
  color: #fff;
  flex-shrink: 0;
}
.up-modal-head-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.up-modal-icn {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.18); color: #fff; font-size: 16px;
}
.up-modal-title {
  font: 800 15px/1.2 var(--al-font); color: #fff;
}
.up-modal-sub {
  font: 600 11.5px/1.2 var(--al-font); color: rgba(255,255,255,.85);
  display: flex; align-items: center; gap: 6px; margin-top: 4px;
}
.up-modal-x {
  width: 32px; height: 32px; border-radius: 8px;
  background: rgba(255,255,255,.16); border: none;
  color: #fff; cursor: pointer; transition: all .15s;
}
.up-modal-x:hover { background: rgba(255,255,255,.28); transform: rotate(90deg); }
.up-modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1; min-height: 0;
}
.up-modal-body--row { display: flex; padding: 0; }
.up-modal-foot {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 10px; padding: 12px 20px;
  border-top: 1px solid var(--border-light, #E2E8F0);
  background: #F8FAFF;
  flex-shrink: 0;
}
[data-theme="dark"] .up-modal-foot { background: rgba(96, 165, 250, .04); }
.up-modal-foot--split { justify-content: space-between; }
.up-modal-foot-l, .up-modal-foot-r { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Detail panel inside the modal — 2-column grid */
.al-detail-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px;
  margin-bottom: 16px;
}
.al-detail-cell { display: flex; flex-direction: column; gap: 4px; }
.al-detail-lbl {
  font: 700 10px/1 var(--al-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px;
}
.al-detail-val {
  font: 600 12.5px/1.4 var(--al-font); color: var(--text-primary);
  word-break: break-word;
}
.al-detail-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  margin-bottom: 16px;
}
.al-detail-block {
  padding: 12px;
  background: #F8FAFF; border: 1px solid var(--border-light, #DBEAFE);
  border-radius: 10px;
}
[data-theme="dark"] .al-detail-block { background: rgba(96, 165, 250, .05); border-color: var(--border-light); }
.al-detail-block .al-detail-lbl { margin-bottom: 4px; }
.al-detail-block.before .al-detail-lbl { color: #B91C1C; }
.al-detail-block.after  .al-detail-lbl { color: #15803D; }
.al-detail-readonly {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 11px; border-radius: 999px;
  background: rgba(217, 119, 6, .12); color: #92400E;
  font: 700 10.5px/1 var(--al-font);
  text-transform: uppercase; letter-spacing: .4px;
}
.al-detail-readonly i { font-size: 10px; }

/* ═══════════════════════════════════════════════════════════════════
   REPORTS PANEL — pre-filter form + A4 viewer
   ═══════════════════════════════════════════════════════════════════ */
.al-rep-tabs {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 0 20px; margin: 12px 0 0;
}
.al-rep-tab {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px;
  font: 600 11.5px/1 var(--al-font); color: #475569;
  background: #F8FAFF; border: 1px solid #DBEAFE; border-radius: 9px;
  cursor: pointer; transition: all .15s;
}
.al-rep-tab:hover { color: #1E40AF; }
.al-rep-tab.on   { background: linear-gradient(135deg, #1E40AF, #2563EB); color: #fff; border-color: transparent; }
[data-theme="dark"] .al-rep-tab { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.al-rep-tab i { font-size: 11px; }

/* Toolbar above the A4 preview */
.al-rep-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 10px 16px;
  background: #F8FAFF; border-bottom: 1px solid var(--border-light, #E2E8F0);
  flex-wrap: wrap;
}
[data-theme="dark"] .al-rep-toolbar { background: rgba(96, 165, 250, .04); }
.al-rep-tone {
  display: inline-flex; gap: 0; align-items: center;
  background: #fff; border: 1px solid #E2E8F0; border-radius: 9px; padding: 3px;
}
[data-theme="dark"] .al-rep-tone { background: var(--bg-card); border-color: var(--border-light); }
.al-rep-tone-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; font: 600 11px/1 var(--al-font); color: #475569;
  background: transparent; border: none; border-radius: 7px;
  cursor: pointer; transition: all .15s;
}
.al-rep-tone-btn:hover { color: #1E40AF; }
.al-rep-tone-btn.on   { background: linear-gradient(135deg, #1E40AF, #2563EB); color: #fff; }

/* A4 viewer */
.al-rep-stage {
  flex: 1; min-height: 0;
  overflow: auto; padding: 18px;
  background: linear-gradient(135deg, #F1F5F9, #E2E8F0);
}
[data-theme="dark"] .al-rep-stage { background: #0F172A; }
.al-a4 {
  width: 794px; min-height: 1123px;       /* A4 @ 96 dpi */
  margin: 0 auto;
  padding: 38px 42px;
  background: #fff; color: #0F172A;
  font: 500 11.5px/1.5 var(--al-font);
  box-shadow: 0 12px 32px rgba(15, 23, 42, .22);
  border-radius: 4px;
}
.al-a4 + .al-a4 { margin-top: 14px; }
.al-a4-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  border-bottom: 3px solid #1E40AF; padding-bottom: 14px; margin-bottom: 16px;
}
.al-a4-head-l { display: flex; align-items: center; gap: 12px; }
.al-a4-logo {
  width: 48px; height: 48px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF); color: #fff;
  font-size: 20px;
}
.al-a4-school  { font: 800 17px/1.2 var(--al-font); color: #1E3A8A; }
.al-a4-tagline { font: 600 10.5px/1.2 var(--al-font); color: #64748B; margin-top: 3px; }
.al-a4-head-r  { text-align: right; }
.al-a4-title   { font: 800 16px/1.2 var(--al-font); color: #1E40AF; }
.al-a4-meta    { font: 600 10.5px/1.4 var(--al-font); color: #64748B; margin-top: 4px; }
.al-a4-section { margin-top: 16px; }
.al-a4-section-h {
  font: 800 12.5px/1 var(--al-font); color: #1E40AF;
  padding-bottom: 6px; margin-bottom: 10px;
  border-bottom: 1.5px solid #DBEAFE;
  text-transform: uppercase; letter-spacing: .5px;
}
.al-a4-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.al-a4-stat  {
  padding: 10px 12px;
  border: 1px solid #DBEAFE; border-radius: 8px;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
}
.al-a4-stat-lbl {
  font: 700 9.5px/1 var(--al-font); color: #1E40AF;
  text-transform: uppercase; letter-spacing: .4px;
}
.al-a4-stat-val { font: 800 18px/1 var(--al-font); color: #1E3A8A; margin-top: 4px; }
.al-a4-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
.al-a4-table th, .al-a4-table td {
  padding: 7px 8px; border: 1px solid #E2E8F0; text-align: left; vertical-align: top;
}
.al-a4-table thead th {
  background: #1E40AF; color: #fff;
  font-weight: 800; text-transform: uppercase; letter-spacing: .4px;
  font-size: 9.5px;
}
.al-a4-table tbody tr:nth-child(even) { background: #F8FAFF; }
.al-a4-foot {
  margin-top: 22px; padding-top: 10px;
  border-top: 1px dashed #CBD5E1;
  font: 600 10px/1.4 var(--al-font); color: #64748B;
  display: flex; align-items: center; justify-content: space-between;
}

/* Colorless / ink-saving variant — overrides every coloured surface */
.al-a4.colorless {
  color: #000;
}
.al-a4.colorless .al-a4-head     { border-bottom-color: #000; }
.al-a4.colorless .al-a4-logo     { background: #000; }
.al-a4.colorless .al-a4-school,
.al-a4.colorless .al-a4-title    { color: #000; }
.al-a4.colorless .al-a4-tagline,
.al-a4.colorless .al-a4-meta,
.al-a4.colorless .al-a4-foot     { color: #444; }
.al-a4.colorless .al-a4-section-h { color: #000; border-bottom-color: #666; }
.al-a4.colorless .al-a4-stat {
  background: #fff; border-color: #999;
}
.al-a4.colorless .al-a4-stat-lbl,
.al-a4.colorless .al-a4-stat-val { color: #000; }
.al-a4.colorless .al-a4-table th,
.al-a4.colorless .al-a4-table td { border-color: #666; }
.al-a4.colorless .al-a4-table thead th { background: #fff; color: #000; border-bottom: 2px solid #000; }
.al-a4.colorless .al-a4-table tbody tr:nth-child(even) { background: #fff; }

/* Print isolation — only the A4 sheets print */
@media print {
  body * { visibility: hidden !important; }
  .al-rep-print, .al-rep-print * { visibility: visible !important; }
  .al-rep-print { position: absolute; inset: 0; padding: 0; background: #fff; }
  .al-rep-stage  { padding: 0 !important; background: #fff !important; overflow: visible !important; }
  .al-a4 { box-shadow: none !important; border-radius: 0 !important; page-break-after: always; }
  .al-a4:last-child { page-break-after: auto; }
  .al-rep-toolbar, .up-modal-head, .up-modal-foot, .al-rep-tabs { display: none !important; }
}

/* ─── Reports panel — info banner + preview summary (configure step) ─── */
.al-rep-info {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; margin-bottom: 16px;
  background: rgba(30, 64, 175, .06);
  border: 1px solid rgba(30, 64, 175, .14);
  border-radius: 10px;
  font: 600 12px/1.4 var(--al-font); color: #1E40AF;
}
[data-theme="dark"] .al-rep-info {
  background: rgba(96, 165, 250, .12);
  border-color: rgba(96, 165, 250, .26);
  color: #BFDBFE;
}
.al-rep-preview {
  margin-top: 18px; padding: 12px 14px;
  background: #F8FAFF;
  border: 1px solid var(--border-light, #DBEAFE);
  border-radius: 10px;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  font: 500 12px/1.3 var(--al-font); color: var(--text-primary);
}
[data-theme="dark"] .al-rep-preview {
  background: rgba(96, 165, 250, .06);
  border-color: var(--border-light);
}
.al-rep-preview-lbl {
  font: 800 10px/1 var(--al-font);
  color: #1E40AF; text-transform: uppercase; letter-spacing: .4px;
  margin-bottom: 3px;
}
[data-theme="dark"] .al-rep-preview-lbl { color: #BFDBFE; }
.al-rep-preview-val { font: 700 12px/1.3 var(--al-font); color: var(--text-primary); }
.al-rep-preview-val--lg { font-size: 18px; font-weight: 800; }
.al-rep-toolbar-meta { font: 600 11.5px/1.3 var(--al-font); color: var(--text-muted, #64748B); }
[data-theme="dark"] .al-rep-toolbar-meta { color: var(--text-muted, #94A3B8); }

/* ─── Extra dark-mode coverage for filter & table chrome ─── */
[data-theme="dark"] .al-filter-card,
[data-theme="dark"] .al-table-card,
[data-theme="dark"] .al-stat,
[data-theme="dark"] .al-card { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .al-stat:hover { border-color: var(--border-light); box-shadow: 0 6px 16px rgba(0,0,0,.32); }
[data-theme="dark"] .al-filter-pill { background: rgba(74, 222, 128, .18); color: #BBF7D0; }
[data-theme="dark"] .al-filter-pill i { color: #4ADE80; }
[data-theme="dark"] .al-count-badge { background: rgba(96, 165, 250, .18); color: #BFDBFE; }
[data-theme="dark"] .al-search i { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .al-quick-pill:hover { background: rgba(96, 165, 250, .14); color: #BFDBFE; border-color: rgba(96, 165, 250, .32); }
[data-theme="dark"] .al-icon-btn:hover { background: #2563EB; color: #fff; border-color: #2563EB; }
[data-theme="dark"] .up-btn-ghost:hover:not(:disabled) { background: rgba(96, 165, 250, .12); color: #BFDBFE; border-color: rgba(96, 165, 250, .32); }
[data-theme="dark"] .al-detail-readonly { background: rgba(217, 119, 6, .22); color: #FDE68A; }
[data-theme="dark"] .al-detail-block.before .al-detail-lbl { color: #FECACA; }
[data-theme="dark"] .al-detail-block.after  .al-detail-lbl { color: #BBF7D0; }
[data-theme="dark"] .up-empty-ic { background: rgba(96, 165, 250, .12); color: #BFDBFE; }
[data-theme="dark"] .al-menu-desc { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .al-pager-info { color: var(--text-primary); }
[data-theme="dark"] .al-td-date { color: var(--text-primary); }
[data-theme="dark"] .al-td-time, [data-theme="dark"] .al-td-details { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .al-user-name { color: var(--text-primary); }
[data-theme="dark"] .al-user-email { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .al-card-time, [data-theme="dark"] .al-card-details { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .al-card-record { color: var(--text-primary); }
[data-theme="dark"] .al-filter-title i,
[data-theme="dark"] .al-table-title i { color: #93C5FD; }
[data-theme="dark"] .al-stat-lbl, [data-theme="dark"] .al-stat-sub { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .al-stat-val { color: var(--text-primary); }
[data-theme="dark"] .al-menu { box-shadow: 0 16px 40px rgba(0, 0, 0, .55); }
[data-theme="dark"] .al-menu-ic { background: rgba(96, 165, 250, .18); color: #BFDBFE; }

/* ─── Responsive collapses ─── */
@media (max-width: 1180px) {
  .al-stats { grid-template-columns: repeat(3, 1fr); }
  .al-filter-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 980px) {
  .al-stats { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .al-filter-grid { grid-template-columns: repeat(2, 1fr); }
  .al-rep-toolbar { padding: 10px 12px; gap: 8px; }
  .al-td-record, .al-td-details { max-width: 200px; }
}
@media (max-width: 820px) {
  .al-stats { grid-template-columns: repeat(2, 1fr); }
  .al-filter-grid { grid-template-columns: repeat(2, 1fr); }
  .al-td-record, .al-td-details { max-width: 180px; }
  .al-header-actions { flex-wrap: wrap; gap: 8px; }
  .al-filter-h { flex-direction: column; align-items: flex-start; }
  .al-pager { flex-wrap: wrap; }
}
@media (max-width: 640px) {
  .al-stats { grid-template-columns: 1fr; }
  .al-filter-grid { grid-template-columns: 1fr; }
  .al-table-scroll { display: none; }
  .al-cards { display: flex; }
  .al-detail-grid { grid-template-columns: 1fr; }
  .al-detail-row  { grid-template-columns: 1fr; }
  .al-quick {
    gap: 4px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .al-quick::-webkit-scrollbar { display: none; }
  .al-quick-pill {
    height: 26px;
    padding: 0 10px;
    font-size: 11px;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .al-filter-h { gap: 8px; }
  .al-rep-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .al-rep-tabs::-webkit-scrollbar { display: none; }
  .al-rep-tab { flex-shrink: 0; white-space: nowrap; }
  .up-modal-back { padding: 12px; }
  .up-modal { max-width: 96vw; width: 96vw !important; max-height: 92vh; }
  .up-modal--lg, .up-modal--xl { width: 96vw !important; }
  .up-modal-head { padding: 12px 14px; }
  .up-modal-body { padding: 14px; }
  .up-modal-foot { padding: 10px 14px; flex-wrap: wrap; }
  .al-menu { min-width: 260px; right: -8px; }
  .page-header { flex-wrap: wrap; gap: 10px; }
  .al-banner { font-size: 12px; padding: 10px 12px; }
}
@media (max-width: 480px) {
  .al-rep-toolbar { flex-direction: column; align-items: stretch; }
  .al-rep-tone { width: 100%; justify-content: center; }
  .al-stat-val { font-size: 22px; }
  .al-card-h { flex-wrap: wrap; gap: 6px; }
  .al-pager-hint { display: none; }
  .tutorial-label { display: none; }
}
`;
