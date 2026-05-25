import React from 'react';

export function SuccessDialog({ open, title, msg, detail, onClose }) {
  if (!open) return null;
  return (
    <div className={`success-dialog-overlay ${open ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="success-dialog">
        <div className="dialog-icon success"><i className="fas fa-check-circle"></i></div>
        <div className="dialog-title">{title}</div>
        <div className="dialog-msg">{msg}</div>
        {detail && <div className="dialog-detail" dangerouslySetInnerHTML={{ __html: detail }} />}
        <button className="btn btn-primary btn-md" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
          <i className="fas fa-check"></i> Got it!
        </button>
      </div>
    </div>
  );
}

export function ErrorDialog({ open, fields, onClose }) {
  if (!open) return null;
  return (
    <div className={`error-dialog-overlay ${open ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="error-dialog">
        <div className="dialog-icon error"><i className="fas fa-exclamation-triangle"></i></div>
        <div className="dialog-title">Missing Required Fields</div>
        <div className="dialog-msg">Please fill in all required fields before saving:</div>
        <ul className="error-list">
          {fields.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
        <button className="btn btn-secondary btn-md" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
          <i className="fas fa-arrow-left"></i> Go back and fix
        </button>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, msg, onConfirm, onCancel, confirmLabel = 'Confirm', confirmClass = 'btn-danger' }) {
  if (!open) return null;
  return (
    <div className={`confirm-dialog-overlay ${open ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-dialog">
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>{title}</div>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>{msg}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-md" onClick={onCancel}>Cancel</button>
          <button className={`btn ${confirmClass} btn-md`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
