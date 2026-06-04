import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const SIZES = {
  sm: 460,
  md: 640,
  lg: 880,
  xl: 1100,
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  closeOnBackdrop = true,
  footer,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(15,23,42,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'erpModalIn .15s ease-out',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: SIZES[size] || SIZES.md,
          maxHeight: 'calc(100vh - 32px)',
          background: 'var(--bg-card, #fff)',
          borderRadius: 'var(--radius-lg, 14px)',
          boxShadow: '0 20px 60px rgba(15,23,42,.25)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {(title || onClose) && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-light, #E5E7EB)',
            }}
          >
            {icon && (
              <div
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(37,99,235,.1)',
                  color: 'var(--brand-primary, #2563EB)',
                }}
              >
                <i className={`fa-solid ${icon}`} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && (
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #0F172A)' }}>
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted, #9CA3AF)', marginTop: 2 }}>
                  {subtitle}
                </div>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  border: '1px solid var(--border-light, #E5E7EB)',
                  background: 'var(--bg-muted, #F8FAFC)',
                  color: 'var(--text-muted, #9CA3AF)',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>{children}</div>

        {footer && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
              padding: '12px 18px',
              borderTop: '1px solid var(--border-light, #E5E7EB)',
              background: 'var(--bg-muted, #F8FAFC)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

if (typeof document !== 'undefined' && !document.getElementById('erp-modal-style')) {
  const s = document.createElement('style');
  s.id = 'erp-modal-style';
  s.textContent = `@keyframes erpModalIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`;
  document.head.appendChild(s);
}
