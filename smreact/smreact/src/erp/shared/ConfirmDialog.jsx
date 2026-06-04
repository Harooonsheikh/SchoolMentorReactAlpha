import React from 'react';
import Modal from './Modal';
import Button from './Button';

const TONE = {
  danger:  { color: '#DC2626', bg: 'rgba(220,38,38,.1)',  icon: 'fa-trash',     btn: 'danger'  },
  warning: { color: '#D97706', bg: 'rgba(217,119,6,.1)',  icon: 'fa-triangle-exclamation', btn: 'primary' },
  info:    { color: '#2563EB', bg: 'rgba(37,99,235,.1)',  icon: 'fa-circle-info', btn: 'primary' },
  success: { color: '#059669', bg: 'rgba(5,150,105,.1)',  icon: 'fa-circle-check', btn: 'success' },
};

export default function ConfirmDialog({
  open,
  tone = 'danger',
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  loading,
}) {
  const t = TONE[tone] || TONE.danger;

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: t.bg, color: t.color,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, marginBottom: 14,
          }}
        >
          <i className={`fa-solid ${t.icon}`} />
        </div>
        {title && (
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #0F172A)', marginBottom: 6 }}>
            {title}
          </div>
        )}
        {message && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={t.btn} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
