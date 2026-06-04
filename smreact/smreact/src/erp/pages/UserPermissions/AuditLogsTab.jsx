import React, { useMemo, useState } from 'react';
import Tooltip from '../../components/Tooltip';
import { auditTone, initialsOf } from './permissionsData';

/* ═══════════════════════════════════════════════════════════════════
   AUDIT LOGS TAB — filter bar + table
   ═══════════════════════════════════════════════════════════════════ */
export default function AuditLogsTab({ auditLog }) {
  const [search, setSearch] = useState('');
  const [fType,  setFType]  = useState('all');
  const [fFrom,  setFFrom]  = useState('');
  const [fTo,    setFTo]    = useState('');

  /* Parse the human-readable date back into a Date so we can compare
     against the filter range. Dates come from `formatDate` so this is
     deterministic. */
  const parseAuditDate = (s) => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLog.filter(a => {
      if (fType !== 'all' && a.type !== fType) return false;
      if (fFrom) {
        const d = parseAuditDate(a.date);
        if (d && d < new Date(fFrom)) return false;
      }
      if (fTo) {
        const d = parseAuditDate(a.date);
        if (d && d > new Date(fTo)) return false;
      }
      if (!q) return true;
      return `${a.user} ${a.action} ${a.detail} ${a.performedBy}`.toLowerCase().includes(q);
    });
  }, [auditLog, search, fType, fFrom, fTo]);

  return (
    <>
      <div className="up-filters up-filters--audit">
        <div className="up-search">
          <i className="fa-solid fa-magnifying-glass up-search-ic" aria-hidden="true"></i>
          <input
            type="text"
            className="up-search-input"
            placeholder="Search by user or action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search audit log"
          />
          {search && (
            <Tooltip text="Clear search">
              <button type="button" className="up-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          )}
        </div>
        <Tooltip text="Filter logs by action type">
          <select className="up-select" value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Filter by action type">
            <option value="all">All Actions</option>
            <option value="assign">Permission Assigned</option>
            <option value="role">Role Changed</option>
            <option value="activate">User Activated</option>
            <option value="deactivate">User Deactivated</option>
            <option value="remove">Permission Removed</option>
          </select>
        </Tooltip>
        <Tooltip text="From date (inclusive)">
          <input
            type="date"
            className="up-input"
            value={fFrom}
            onChange={(e) => setFFrom(e.target.value)}
            aria-label="From date"
          />
        </Tooltip>
        <Tooltip text="To date (inclusive)">
          <input
            type="date"
            className="up-input"
            value={fTo}
            onChange={(e) => setFTo(e.target.value)}
            aria-label="To date"
            min={fFrom || undefined}
          />
        </Tooltip>
      </div>

      {filtered.length === 0 ? (
        <div className="up-empty">
          <div className="up-empty-ic"><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i></div>
          <div className="up-empty-title">No audit events found</div>
          <div className="up-empty-sub">Try adjusting your filters.</div>
        </div>
      ) : (
        <div className="up-table">
          <div className="up-table-head" style={{ gridTemplateColumns: '170px 1fr 160px 2fr 1fr' }}>
            <div className="th">Date &amp; Time</div>
            <div className="th">User</div>
            <div className="th">Action</div>
            <div className="th">Detail</div>
            <div className="th">Performed By</div>
          </div>
          {filtered.map(a => (
            <div key={a.id} className="up-table-row" style={{ gridTemplateColumns: '170px 1fr 160px 2fr 1fr' }}>
              <div className="td up-emp-text" style={{ gap: 2 }}>
                <div className="up-emp-name" style={{ fontSize: 12.5 }}>{a.date}</div>
                <div className="up-emp-meta">{a.time}</div>
              </div>
              <div className="td up-emp">
                <Tooltip text={`Target user: ${a.user}`}>
                  <div className="up-avatar up-avatar--sm">{initialsOf(a.user)}</div>
                </Tooltip>
                <div className="up-emp-text">
                  <div className="up-emp-name" style={{ fontSize: 12.5 }}>{a.user}</div>
                </div>
              </div>
              <div className="td">
                <Tooltip text={`Action type: ${a.action}`}>
                  <span className={`up-badge up-badge--${auditTone(a.type)}`}>{a.action}</span>
                </Tooltip>
              </div>
              <div className="td" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12.5, fontStyle: 'italic', color: '#1E3A5F', lineHeight: 1.5 }}>
                {a.detail}
              </div>
              <div className="td up-emp">
                <Tooltip text={`Performed by: ${a.performedBy}`}>
                  <div className="up-avatar up-avatar--sm" style={{ background: 'linear-gradient(135deg,#475569,#64748B)' }}>
                    {initialsOf(a.performedBy)}
                  </div>
                </Tooltip>
                <div className="up-emp-text">
                  <div className="up-emp-meta" style={{ fontWeight: 600, color: '#334155' }}>{a.performedBy}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
