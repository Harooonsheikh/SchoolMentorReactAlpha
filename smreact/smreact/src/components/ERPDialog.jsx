import React from 'react';
import { openERP } from '../utils/erp';

export default function ERPDialog({ open, onClose, showToast, onOpenErp }) {
  if (!open) return null;

  const handleRemindLater = () => {
    // launchSetup === 1 → switch to the ERP screen, otherwise toast "not allowed"
    if (!openERP(showToast, onOpenErp)) onClose();
  };
  return (
    <div className={`erp-dialog-overlay ${open ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="erp-dialog">
        <div className="erp-dialog-hero">
          <div className="erp-dialog-icon"><i className="fas fa-th-large"></i></div>
          <div className="erp-dialog-badge"><i className="fas fa-lock" style={{ fontSize: 10 }}></i> Setup Required</div>
        </div>
        <div className="erp-dialog-body">
          <div className="erp-dialog-title">ERP Access Locked</div>
          <div className="erp-dialog-msg">
            The <strong>School Mentor ERP</strong> becomes available once your school setup is complete. Please finish all 6 setup steps to unlock full ERP access.
          </div>
          <div className="erp-dialog-hint">
            <i className="fas fa-info-circle" style={{ color: '#3B82F6', fontSize: 14, flexShrink: 0 }}></i>
            Complete School → Classes → Subjects → Departments → Staff → Students to unlock.
          </div>
        </div>
        <div className="erp-dialog-footer">
          <button className="erp-dlg-btn erp-dlg-btn--primary" onClick={onClose}>
            <i className="fas fa-arrow-left"></i> Continue Setup
          </button>
          <button className="erp-dlg-btn erp-dlg-btn--ghost" onClick={handleRemindLater}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
