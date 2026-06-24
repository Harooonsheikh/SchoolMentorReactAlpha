import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import SessionFormModal from './SessionFormModal';
import SessionDetailsModal from './SessionDetailsModal';
import {
  MODULE_OPTIONS,
  formatDate,
  sessionStatusTone,
  useSettings,
} from './settingsStore';

/* ═══════════════════════════════════════════════════════════════════
   SESSION MANAGEMENT — info banner, stats, filter bar, table, modals
   ═══════════════════════════════════════════════════════════════════ */
export default function SessionManagement({ toast }) {
  const {
    sessions, currentSession, sessionsLoading,
    setAsCurrent, upsertSession, deleteSession, toggleSessionLock,
  } = useSettings();

  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('all');
  /* Modal controllers — only one open at a time. */
  const [formCfg,    setFormCfg]    = useState(null); // { session? }
  const [viewItem,   setViewItem]   = useState(null); // session being viewed
  const [confirmCfg, setConfirmCfg] = useState(null); // {kind, session}

  const filtered = useMemo(() => sessions.filter(s => {
    if (fStatus !== 'all' && s.status !== fStatus) return false;
    const q = search.trim().toLowerCase();
    if (q && !s.name.toLowerCase().includes(q)) return false;
    return true;
  }), [sessions, search, fStatus]);

  const moduleName = (id) => MODULE_OPTIONS.find(m => m.id === id)?.label || id;

  /* Counts for the stat strip. */
  const counts = useMemo(() => ({
    total:    sessions.length,
    upcoming: sessions.filter(s => s.status === 'upcoming').length,
    past:     sessions.filter(s => s.status === 'past').length,
  }), [sessions]);

  /* Confirm helpers — open / close / commit. */
  const askSetCurrent = (s) => setConfirmCfg({ kind: 'setCurrent', session: s });
  const askDelete = (s) => {
    if (s.status === 'current') {
      toast('Cannot delete the active current session. Set another session as current first.', 'error');
      return;
    }
    setConfirmCfg({ kind: 'delete', session: s });
  };

  const commitConfirm = async () => {
    if (!confirmCfg) return;
    const cfg = confirmCfg;
    setConfirmCfg(null);
    if (cfg.kind === 'setCurrent') {
      setAsCurrent(cfg.session.id);
      toast(`Current session updated to ${cfg.session.name}`, 'success');
    } else if (cfg.kind === 'delete') {
      const { ok, message } = await deleteSession(cfg.session.id);
      toast(message, ok ? 'success' : 'error');
    }
  };

  return (
    <>
      {/* ── Info banner ── */}
      <div className="settings-banner">
        <div className="settings-banner-ic">
          <i className="fa-solid fa-calendar-alt" aria-hidden="true"></i>
        </div>
        <div className="settings-banner-body">
          Use academic sessions to separate records by year. The <b>current session</b> controls data visibility across all applicable ERP modules.
        </div>
      </div>

      {/* ── 4 stat cards ── */}
      <div className="settings-stats">
        <Stat tone="blue"  icon="fa-list-check"   label="Total Sessions"     value={counts.total}
              sub={counts.total ? 'Configured in the ERP' : 'Create one to get started'} />
        <Stat tone="green" icon="fa-circle-check" label="Current Session"    value={currentSession?.name || '—'}
              sub={currentSession ? formatDate(currentSession.startDate) + ' → ' + formatDate(currentSession.endDate) : 'No active session'} />
        <Stat tone="amber" icon="fa-hourglass-half" label="Upcoming Sessions" value={counts.upcoming}
              sub={counts.upcoming === 0 ? 'No future sessions yet' : 'Awaiting activation'} />
        <Stat tone="gray"  icon="fa-clock-rotate-left" label="Past Sessions" value={counts.past}
              sub={counts.past === 0 ? 'No historical sessions' : 'Closed academic years'} />
      </div>

      {/* ── Filter bar ── */}
      <div className="settings-filters">
        <div className="settings-search">
          <i className="fa-solid fa-magnifying-glass settings-search-ic" aria-hidden="true"></i>
          <input
            type="text"
            className="settings-search-input"
            placeholder="Search by session name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search sessions"
          />
          {search && (
            <Tooltip text="Clear search">
              <button type="button" className="settings-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          )}
        </div>
        <select
          className="settings-select"
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All status</option>
          <option value="current">Current only</option>
          <option value="upcoming">Upcoming only</option>
          <option value="past">Past only</option>
        </select>
        <Tooltip text="Create a brand new academic session">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={() => setFormCfg({})}
          >
            <i className="fa-solid fa-plus" aria-hidden="true"></i> Create Academic Session
          </button>
        </Tooltip>
      </div>

      {/* ── Table ── */}
      {sessionsLoading ? (
        <div className="settings-empty">
          <div className="settings-empty-ic"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></div>
          <div className="settings-empty-title">Loading sessions…</div>
          <div className="settings-empty-sub">Fetching academic sessions for this branch.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="settings-empty">
          <div className="settings-empty-ic"><i className="fa-solid fa-calendar-xmark" aria-hidden="true"></i></div>
          <div className="settings-empty-title">
            {sessions.length === 0 ? 'No academic sessions yet' : 'No sessions match this filter'}
          </div>
          <div className="settings-empty-sub">
            {sessions.length === 0
              ? 'Click "Create Academic Session" above to add your first session.'
              : 'Try clearing the search or status filter.'}
          </div>
        </div>
      ) : (
        <div className="settings-table">
          <div className="settings-table-head" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 110px 130px 170px' }}>
            <div className="th">Session Name</div>
            <div className="th">Start Date</div>
            <div className="th">End Date</div>
            <div className="th c">Modules</div>
            <div className="th c">Status</div>
            <div className="th c">Actions</div>
          </div>
          {filtered.map(s => {
            const tone = sessionStatusTone(s.status);
            const isCurrent = s.status === 'current';
            return (
              <div key={s.id} className="settings-table-row" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 110px 130px 170px' }}>
                <div className="td">
                  <div className="settings-emp-text" style={{ gap: 4 }}>
                    <div className="settings-emp-name">
                      {s.name}
                      {isCurrent && (
                        <span className="settings-badge settings-badge--green" style={{ marginLeft: 8, fontSize: 9.5, padding: '3px 8px' }}>
                          <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Current Session
                        </span>
                      )}
                    </div>
                    {s.locked && (
                      <div className="settings-emp-meta">
                        <i className="fa-solid fa-lock" aria-hidden="true" style={{ marginRight: 4, color: '#92400E' }}></i>
                        Locked for editing
                      </div>
                    )}
                  </div>
                </div>
                <div className="td">{formatDate(s.startDate)}</div>
                <div className="td">{formatDate(s.endDate)}</div>
                <div className="td c">
                  <Tooltip text={s.modules.map(moduleName).join(' · ')}>
                    <span className="settings-badge settings-badge--blue">
                      {s.modules.length} modules
                    </span>
                  </Tooltip>
                </div>
                <div className="td c">
                  <span className={`settings-badge settings-badge--${tone}`}>
                    {s.status === 'current' ? 'Current' : s.status === 'upcoming' ? 'Upcoming' : 'Past'}
                  </span>
                  {s.locked && s.status !== 'current' && (
                    <span className="settings-badge settings-badge--amber" style={{ marginLeft: 4 }}>
                      <i className="fa-solid fa-lock" aria-hidden="true"></i> Locked
                    </span>
                  )}
                </div>
                <div className="td c settings-actions">
                  <Tooltip text="View details">
                    <button className="settings-act" onClick={() => setViewItem(s)} aria-label="View session details">
                      <i className="fa-solid fa-eye" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                  <Tooltip text={s.locked ? 'Unlock to edit' : 'Edit session'}>
                    <button
                      className="settings-act"
                      onClick={() => setFormCfg({ session: s })}
                      disabled={s.locked}
                      aria-label="Edit session"
                    >
                      <i className="fa-solid fa-pen" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                  <Tooltip text={isCurrent ? 'This is already the current session' : 'Set as current session'}>
                    <button
                      className="settings-act"
                      onClick={() => askSetCurrent(s)}
                      disabled={isCurrent}
                      aria-label="Set as current"
                    >
                      <i className="fa-solid fa-flag" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                  <Tooltip text={s.locked ? 'Unlock session' : 'Lock session'}>
                    <button
                      className="settings-act"
                      onClick={() => {
                        toggleSessionLock(s.id);
                        toast(s.locked ? 'Session unlocked' : 'Session locked', 'success');
                      }}
                      aria-label="Toggle lock"
                    >
                      <i className={`fa-solid ${s.locked ? 'fa-lock-open' : 'fa-lock'}`} aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                  <Tooltip text="Delete session">
                    <button
                      className="settings-act settings-act--danger"
                      onClick={() => askDelete(s)}
                      aria-label="Delete session"
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {formCfg && (
        <SessionFormModal
          session={formCfg.session}
          existingCurrent={currentSession}
          onClose={() => setFormCfg(null)}
          onSave={async (payload) => {
            const { ok, message } = await upsertSession(payload);
            toast(message, ok ? 'success' : 'error');
            if (ok) setFormCfg(null);
          }}
          toast={toast}
        />
      )}
      {viewItem && (
        <SessionDetailsModal
          session={viewItem}
          onClose={() => setViewItem(null)}
          onEdit={() => {
            setFormCfg({ session: viewItem });
            setViewItem(null);
          }}
        />
      )}
      {confirmCfg && (
        <ConfirmDialog
          cfg={confirmCfg}
          onCancel={() => setConfirmCfg(null)}
          onConfirm={commitConfirm}
        />
      )}
    </>
  );
}

/* ─── Internal: stat card ─── */
function Stat({ tone, icon, label, value, sub }) {
  return (
    <div className={`settings-stat settings-stat--${tone}`}>
      <div className="settings-stat-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
      <div className="settings-stat-lbl">{label}</div>
      <div className="settings-stat-val">{value}</div>
      {sub && <div className="settings-stat-sub">{sub}</div>}
    </div>
  );
}

/* ─── Internal: small confirm dialog (Set-as-Current + Delete) ─── */
function ConfirmDialog({ cfg, onCancel, onConfirm }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const isDelete = cfg.kind === 'delete';
  const session = cfg.session;

  return createPortal((
    <div
      className="settings-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="settings-modal settings-modal--sm">
        <div className="settings-confirm-body">
          <div className={`settings-confirm-ic ${isDelete ? 'settings-confirm-ic--red' : 'settings-confirm-ic--blue'}`}>
            <i className={`fa-solid ${isDelete ? 'fa-triangle-exclamation' : 'fa-flag'}`} aria-hidden="true"></i>
          </div>
          <div className="settings-confirm-title">
            {isDelete ? 'Delete Session?' : 'Set as Current Session?'}
          </div>
          <div className="settings-confirm-text">
            {isDelete
              ? <>This will permanently delete <b>"{session.name}"</b>. This cannot be undone.</>
              : <>Changing the current session to <b>"{session.name}"</b> will affect data visibility across all applicable ERP modules. The previous current session will become inactive.</>}
          </div>
          {!isDelete && (
            <div className="settings-alert" style={{ marginTop: 14, textAlign: 'left' }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              <span>Past sessions are locked for normal editing to protect historical records.</span>
            </div>
          )}
        </div>
        <div className="settings-modal-foot settings-modal-foot--center">
          <button type="button" className="settings-btn settings-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={`settings-btn ${isDelete ? 'settings-btn-danger' : 'settings-btn-primary'}`}
            onClick={onConfirm}
          >
            {isDelete
              ? <><i className="fa-solid fa-trash" aria-hidden="true"></i> Delete</>
              : <><i className="fa-solid fa-flag" aria-hidden="true"></i> Set as Current</>}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
