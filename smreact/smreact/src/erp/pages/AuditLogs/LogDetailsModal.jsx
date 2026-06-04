import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { formatDate } from './auditLogsData';

/* ═══════════════════════════════════════════════════════════════════
   LOG DETAILS MODAL — read-only

   Surfaces every field on a log entry. There are no edit / delete
   actions anywhere; the only footer button is Close.
   ═══════════════════════════════════════════════════════════════════ */
export default function LogDetailsModal({ log, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="al-detail-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--lg">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-circle-info" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="al-detail-title">Log Entry — {log.id}</div>
              <div className="up-modal-sub">
                <span className={`up-badge up-badge--${log.actionTone}`} style={{ background: 'rgba(255,255,255,.22)', color: '#fff' }}>
                  {log.actionLabel}
                </span>
                <span>{formatDate(log.date)} · {log.time}</span>
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="up-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="up-modal-body">
          {/* ─── Read-only banner inside the modal so it stays visible
                 even after the user scrolls the form. */}
          <div style={{ marginBottom: 16 }}>
            <Tooltip text="Audit log entries cannot be edited or deleted">
              <span className="al-detail-readonly" tabIndex={0}>
                <i className="fa-solid fa-lock" aria-hidden="true"></i> Read-only entry
              </span>
            </Tooltip>
          </div>

          {/* ─── Identity block — who + role ─── */}
          <div className="al-detail-grid">
            <div className="al-detail-cell">
              <span className="al-detail-lbl">User Name</span>
              <span className="al-detail-val">{log.userName}</span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Role</span>
              <span className="al-detail-val">{log.userRole}</span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Module</span>
              <span className="al-detail-val">
                <span className="al-module-chip">
                  <i className={`fa-solid ${log.moduleIcon}`} aria-hidden="true"></i> {log.moduleLabel}
                </span>
              </span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Screen</span>
              <span className="al-detail-val">{log.screen}</span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Action Type</span>
              <span className="al-detail-val">
                <span className={`up-badge up-badge--${log.actionTone}`}>{log.actionLabel}</span>
              </span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Record Name</span>
              <span className="al-detail-val">{log.record}</span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Date</span>
              <span className="al-detail-val">{formatDate(log.date)}</span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Time</span>
              <span className="al-detail-val">{log.time}</span>
            </div>
          </div>

          {/* ─── Details narrative ─── */}
          <div style={{ marginBottom: 16 }}>
            <span className="al-detail-lbl" style={{ display: 'block', marginBottom: 4 }}>Activity Details</span>
            <span className="al-detail-val">{log.details}</span>
          </div>

          {/* ─── Old / New value ─── */}
          <div className="al-detail-row">
            <div className="al-detail-block before">
              <div className="al-detail-lbl">Old Value</div>
              <div className="al-detail-val">{log.oldValue || '—'}</div>
            </div>
            <div className="al-detail-block after">
              <div className="al-detail-lbl">New Value</div>
              <div className="al-detail-val">{log.newValue || '—'}</div>
            </div>
          </div>

          {/* ─── Forensics placeholders (IP + Device) ─── */}
          <div className="al-detail-grid" style={{ marginBottom: 0 }}>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">IP Address</span>
              <span className="al-detail-val">
                {log.ipAddress !== '—' ? log.ipAddress : (
                  <span style={{ color: 'var(--text-muted, #94A3B8)', fontStyle: 'italic', fontWeight: 600 }}>
                    Will be captured when wired to backend
                  </span>
                )}
              </span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Device Information</span>
              <span className="al-detail-val">
                {log.device !== '—' ? log.device : (
                  <span style={{ color: 'var(--text-muted, #94A3B8)', fontStyle: 'italic', fontWeight: 600 }}>
                    Will be captured when wired to backend
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="up-modal-foot">
          <Tooltip text="Close this log entry (Esc)">
            <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>
              <i className="fa-solid fa-xmark" aria-hidden="true"></i> Close
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}
