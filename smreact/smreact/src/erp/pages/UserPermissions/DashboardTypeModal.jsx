import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD TYPE MODAL — assigns Admin or Teacher dashboard to a
   single user. Surfaces the same chrome as AssignRoleModal so the
   two flows feel identical.
   ═══════════════════════════════════════════════════════════════════ */

const TYPES = [
  {
    id: 'admin',
    label: 'Admin Dashboard',
    icon: 'fa-chart-line',
    desc: 'School-level KPIs, health gauge, ERP adoption, action centre, admission funnel and analytics. For Principals, VPs, Coordinators, HR, Accounts and other school-wide roles.',
  },
  {
    id: 'teacher',
    label: 'Teacher Dashboard',
    icon: 'fa-chalkboard-user',
    desc: 'Personal workspace scoped to the teacher\'s assigned classes, lesson plans, homework, attendance and schedule. Teachers only see their own data.',
  },
];

export default function DashboardTypeModal({ user, onClose, onConfirm }) {
  const initial = user.dashboardType === 'teacher' ? 'teacher' : 'admin';
  const [selected, setSelected] = useState(initial);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const willChange = selected !== initial;

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="up-dash-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal" style={{ width: 'min(560px, 100%)' }}>
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-gauge-high" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="up-dash-title">Set Dashboard — {user.name}</div>
              <div className="up-modal-sub">
                <span>Current:</span>
                <span
                  className="up-badge up-badge--purple"
                  style={{ background: 'rgba(255,255,255,.22)', color: '#fff' }}
                >
                  <i className={`fa-solid ${initial === 'teacher' ? 'fa-chalkboard-user' : 'fa-chart-line'}`} aria-hidden="true"></i>
                  {initial === 'teacher' ? 'Teacher Dashboard' : 'Admin Dashboard'}
                </span>
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
            <label>Select Dashboard Type</label>
          </div>

          <div className="up-role-radios">
            {TYPES.map(t => {
              const on = selected === t.id;
              return (
                <Tooltip key={t.id} text={on ? `${t.label} (currently selected)` : `Choose ${t.label}`}>
                  <button
                    type="button"
                    className={`up-role-radio${on ? ' on' : ''}`}
                    onClick={() => setSelected(t.id)}
                    style={{ alignItems: 'flex-start' }}
                  >
                    <span className="up-role-radio-dot" style={{ marginTop: 4 }} />
                    <span
                      className="up-role-radio-color"
                      style={{ background: t.id === 'teacher' ? '#7C3AED' : '#1E40AF' }}
                    />
                    <div className="up-role-radio-info">
                      <div className="up-role-radio-name">
                        <i className={`fa-solid ${t.icon}`} style={{ marginRight: 8, color: '#1E40AF' }} aria-hidden="true"></i>
                        {t.label}
                      </div>
                      <div className="up-role-radio-desc">{t.desc}</div>
                    </div>
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {willChange && (
            <div className="up-alert" style={{ marginTop: 14 }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              <span>
                <b>{user.name}</b> will see the <b>{selected === 'teacher' ? 'Teacher' : 'Admin'} Dashboard</b> the next time they sign in. Their permissions and role remain unchanged.
              </span>
            </div>
          )}
        </div>

        <div className="up-modal-foot">
          <Tooltip text="Cancel without changing the dashboard">
            <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={!willChange ? 'Pick a different dashboard to enable' : `Set ${selected === 'teacher' ? 'Teacher' : 'Admin'} dashboard for ${user.name}`}>
            <button
              type="button"
              className="up-btn up-btn-primary"
              disabled={!willChange}
              onClick={() => onConfirm(selected)}
            >
              <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Dashboard
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}
