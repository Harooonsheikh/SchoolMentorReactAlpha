import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   <ErrorState /> — inline error block for failed fetches.

     {error && <ErrorState error={error} onRetry={refetch} />}

   The component is intentionally generic about the error shape — it
   shows `error.message` if available, otherwise a stock label. When the
   backend team wires real APIs they can throw structured errors and the
   UI will surface .message automatically.
   ═══════════════════════════════════════════════════════════════════ */
export default function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
}) {
  const msg = (error && (error.message || error.toString())) || 'Please try again.';
  return (
    <div className="erp-errstate" role="alert">
      <div className="erp-errstate-icon" aria-hidden="true">
        <i className="fa-solid fa-circle-exclamation"></i>
      </div>
      <div className="erp-errstate-text">
        <div className="erp-errstate-title">{title}</div>
        <div className="erp-errstate-msg">{msg}</div>
      </div>
      {onRetry && (
        <button
          type="button"
          className="erp-errstate-retry"
          onClick={onRetry}
        >
          <i className="fa-solid fa-rotate-right" aria-hidden="true"></i> {retryLabel}
        </button>
      )}
    </div>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('erp-errstate-style')) {
  const el = document.createElement('style');
  el.id = 'erp-errstate-style';
  el.textContent = `
.erp-errstate {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px;
  background: rgba(220,38,38,.06);
  border: 1.5px solid rgba(220,38,38,.22);
  border-radius: var(--radius-lg, 12px);
  font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
  margin-bottom: 14px;
}
.erp-errstate-icon {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: rgba(220,38,38,.12);
  color: #DC2626;
  font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.erp-errstate-text { flex: 1; min-width: 0; }
.erp-errstate-title { font-size: 13.5px; font-weight: 800; color: var(--text-primary, #0F172A); letter-spacing: -.01em; }
.erp-errstate-msg   { font-size: 12px;   color: var(--text-muted, #64748B); margin-top: 2px; line-height: 1.4; }
.erp-errstate-retry {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  background: #DC2626;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
  flex-shrink: 0;
}
.erp-errstate-retry:hover { background: #B91C1C; transform: translateY(-1px); }
.erp-errstate-retry:focus-visible { outline: 2px solid #fff; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(220,38,38,.3); }
[data-theme="dark"] .erp-errstate { background: rgba(220,38,38,.10); border-color: rgba(220,38,38,.35); }
[data-theme="dark"] .erp-errstate-icon { background: rgba(220,38,38,.18); color: #FCA5A5; }
@media (max-width: 520px) {
  .erp-errstate { flex-wrap: wrap; gap: 10px; padding: 12px 14px; }
  .erp-errstate-retry { width: 100%; justify-content: center; }
}
  `;
  document.head.appendChild(el);
}
