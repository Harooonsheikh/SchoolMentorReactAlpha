import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import {
  MODULE_OPTIONS,
  formatDate,
  sessionProgress,
  sessionStatusTone,
} from './settingsStore';

/* ═══════════════════════════════════════════════════════════════════
   SESSION DETAILS MODAL — read-only with timeline + meta + modules
   ═══════════════════════════════════════════════════════════════════ */
export default function SessionDetailsModal({ session, onClose, onEdit }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!session) return null;
  const tone = sessionStatusTone(session.status);
  const moduleName = (id) => MODULE_OPTIONS.find(m => m.id === id)?.label || id;
  const progress = sessionProgress(session);

  return createPortal((
    <div
      className="settings-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="settings-session-details-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="settings-modal">
        <div className="settings-modal-head">
          <div className="settings-modal-head-l">
            <div className="settings-modal-icn">
              <i className="fa-solid fa-calendar-alt" aria-hidden="true"></i>
            </div>
            <div>
              <div className="settings-modal-title" id="settings-session-details-title">Session Details</div>
              <div className="settings-modal-sub">{session.name}</div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="settings-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="settings-modal-body">
          {/* Hero card */}
          <div className="settings-details-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="settings-details-title">{session.name}</div>
              <div className="settings-details-sub">
                {formatDate(session.startDate)} → {formatDate(session.endDate)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span className={`settings-badge settings-badge--${tone}`}>
                {session.status === 'current' ? 'Current' : session.status === 'upcoming' ? 'Upcoming' : 'Past'}
              </span>
              <span className={`settings-badge settings-badge--${session.locked ? 'amber' : 'green'}`}>
                <i className={`fa-solid ${session.locked ? 'fa-lock' : 'fa-lock-open'}`} aria-hidden="true"></i>
                {session.locked ? 'Locked' : 'Unlocked'}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="settings-timeline">
            <div className="settings-timeline-h">Session Timeline</div>
            <div className="settings-timeline-bar" aria-label={`Progress ${Math.round(progress * 100)}%`}>
              <div
                className="settings-timeline-fill"
                style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
              />
              <div
                className="settings-timeline-marker"
                style={{ left: `${Math.max(0, Math.min(100, progress * 100))}%` }}
              />
            </div>
            <div className="settings-timeline-labels">
              <span>{formatDate(session.startDate)}</span>
              <span>Today · {Math.round(progress * 100)}%</span>
              <span>{formatDate(session.endDate)}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="settings-meta-grid">
            <div className="settings-meta-item">
              <span className="settings-meta-lbl">Created by</span>
              <span className="settings-meta-val">{session.createdBy || '—'}</span>
            </div>
            <div className="settings-meta-item">
              <span className="settings-meta-lbl">Created date</span>
              <span className="settings-meta-val">{formatDate(session.createdAt)}</span>
            </div>
            <div className="settings-meta-item">
              <span className="settings-meta-lbl">Last updated</span>
              <span className="settings-meta-val">{formatDate(session.updatedAt)}</span>
            </div>
            <div className="settings-meta-item">
              <span className="settings-meta-lbl">Lock status</span>
              <span className="settings-meta-val">
                {session.locked
                  ? <><i className="fa-solid fa-lock" aria-hidden="true" style={{ marginRight: 5, color: '#92400E' }}></i> Locked</>
                  : <><i className="fa-solid fa-lock-open" aria-hidden="true" style={{ marginRight: 5, color: '#15803D' }}></i> Unlocked</>}
              </span>
            </div>
            <div className="settings-meta-item span2">
              <span className="settings-meta-lbl">Notes</span>
              <span className="settings-meta-val">
                {session.notes ? session.notes : <em>No notes recorded.</em>}
              </span>
            </div>
          </div>

          {/* Modules */}
          <div className="settings-meta-grid">
            <div className="settings-meta-item span2">
              <span className="settings-meta-lbl">Applicable modules ({session.modules.length})</span>
              <div className="settings-chip-list" style={{ marginTop: 6 }}>
                {session.modules.length === 0
                  ? <em style={{ color: '#94A3B8' }}>No modules selected.</em>
                  : session.modules.map(id => (
                      <span className="settings-chip" key={id}>
                        <i className="fa-solid fa-circle-check" aria-hidden="true"></i> {moduleName(id)}
                      </span>
                    ))}
              </div>
            </div>
          </div>
        </div>

        <div className="settings-modal-foot">
          <Tooltip text="Close this dialog">
            <button type="button" className="settings-btn settings-btn-ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Open the edit form for this session">
            <button type="button" className="settings-btn settings-btn-primary" onClick={onEdit}>
              <i className="fa-solid fa-pen" aria-hidden="true"></i> Edit Session
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}
