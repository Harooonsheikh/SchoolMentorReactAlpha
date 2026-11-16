import React, { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   ResetPasswordModal — the ONLY place a password is ever set/changed
   in this app. Super Admin only: there is no self-service "change my
   password" screen anywhere, by design (spec: "ONLY Super Admin can
   create/change/reset ANY password").

   Structural precedent: OperationalSops.jsx's CategoryModal / the
   existing UserManagement.jsx EditUserModal (.um-edit-ov/.um-edit-modal
   shell, .sop-modal-hdr/.sop-modal-foot chrome) — reused as-is, no new
   modal system introduced.
   ═══════════════════════════════════════════════════════════════════ */
export default function ResetPasswordModal({ user, onClose, onSave, toast }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const save = () => {
    if (!pw.trim() || pw.trim().length < 6) { toast?.('Password must be at least 6 characters', 'warn'); return; }
    if (pw.trim() !== confirm.trim()) { toast?.('Passwords do not match', 'warn'); return; }
    onSave(pw.trim());
  };

  return (
    <div className="um-edit-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="um-edit-modal">
        <div className="sop-modal-hdr" style={{ borderRadius: 'var(--r-xl) var(--r-xl) 0 0' }}>
          <div className="sop-modal-icon" style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)' }}><i className="fa-solid fa-key" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>Reset Password</div>
            <div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>{user?.name || user?.fullName}</div>
          </div>
          <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div style={{ padding: 22 }}>
          <div className="ap-banner">
            <i className="fa-solid fa-shield-halved" />
            <span>Only a Super Admin can set or reset a user's password. The user will not see this password or be able to change it themselves.</span>
          </div>
          <div className="um-field" style={{ marginBottom: 14 }}>
            <label className="um-label">New Password</label>
            <div className="um-pw-wrap">
              <input className="um-input" type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter new password" autoFocus />
              <button className="um-pw-eye" type="button" data-tip="Show password" onClick={() => setShowPw((s) => !s)}><i className={`fa-regular ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
            </div>
          </div>
          <div className="um-field">
            <label className="um-label">Confirm Password</label>
            <input className="um-input" type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" />
          </div>
        </div>
        <div className="sop-modal-foot">
          <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)', boxShadow: '0 4px 14px rgba(220,38,38,.28)' }} onClick={save}><i className="fa-solid fa-key" /> Set Password</button>
        </div>
      </div>
    </div>
  );
}
