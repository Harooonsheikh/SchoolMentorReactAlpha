import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { findRole } from './permissionsData';

/* ═══════════════════════════════════════════════════════════════════
   ASSIGN ROLE MODAL — radio-card list of roles + warning
   ═══════════════════════════════════════════════════════════════════ */
export default function AssignRoleModal({ user, roles, onClose, onConfirm }) {
  const currentRole = findRole(roles, user.role);
  const [selected, setSelected] = useState(user.role);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const willChange = selected !== user.role;
  const newRole = findRole(roles, selected);

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="up-assign-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal" style={{ width: 'min(520px, 100%)' }}>
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-user-tag" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="up-assign-title">Assign Role — {user.name}</div>
              <div className="up-modal-sub">
                <span>Current:</span>
                {currentRole ? (
                  <span
                    className="up-role-pill"
                    style={{ background: `${currentRole.color}33`, color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}
                  >
                    <span className="up-role-dot" style={{ background: currentRole.color }} />
                    {currentRole.name}
                  </span>
                ) : '—'}
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
          <div className="up-field" style={{ marginBottom: 10 }}>
            <label>Select New Role</label>
          </div>
          <div className="up-role-radios">
            {roles.map(r => {
              const on = selected === r.id;
              return (
                <Tooltip key={r.id} text={on ? `${r.name} (currently selected)` : `Select ${r.name}`}>
                  <button
                    type="button"
                    className={`up-role-radio${on ? ' on' : ''}`}
                    onClick={() => setSelected(r.id)}
                  >
                    <span className="up-role-radio-dot" />
                    <span className="up-role-radio-color" style={{ background: r.color }} />
                    <div className="up-role-radio-info">
                      <div className="up-role-radio-name">{r.name}</div>
                      <div className="up-role-radio-desc">{r.description}</div>
                    </div>
                    <span className="up-role-radio-count">
                      {r.userCount} {r.userCount === 1 ? 'user' : 'users'}
                    </span>
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {willChange && (
            <div className="up-alert" style={{ marginTop: 14 }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              <span>
                Changing this role will modify what <b>{user.name}</b> can access in the ERP. Any custom permissions you've previously applied will be reset to the new role's defaults.
              </span>
            </div>
          )}
        </div>

        <div className="up-modal-foot">
          <Tooltip text="Cancel without changing the role">
            <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={!willChange ? 'Pick a different role to enable' : `Assign ${newRole?.name || ''} to ${user.name}`}>
            <button
              type="button"
              className="up-btn up-btn-primary"
              disabled={!willChange || !newRole}
              onClick={() => onConfirm(selected)}
            >
              <i className="fa-solid fa-user-check" aria-hidden="true"></i> Assign Role
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}
