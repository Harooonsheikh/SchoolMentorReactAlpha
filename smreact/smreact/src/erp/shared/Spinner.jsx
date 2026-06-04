import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   <Spinner /> — inline brand-coloured spinner.

     <button disabled={saving}>
       {saving ? <Spinner size={14} /> : <i className="fa-solid fa-check" />}
       Save
     </button>

   Sizes:
     - 12 (xs, fits inside text), 14 (sm, inside buttons),
       16 (md, default), 24 (lg, panel-level).
   ═══════════════════════════════════════════════════════════════════ */
export default function Spinner({ size = 16, label }) {
  return (
    <span
      className="erp-spinner"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 8)) }}
      role={label ? 'status' : 'presentation'}
      aria-label={label || undefined}
    />
  );
}

if (typeof document !== 'undefined' && !document.getElementById('erp-spinner-style')) {
  const el = document.createElement('style');
  el.id = 'erp-spinner-style';
  el.textContent = `
.erp-spinner {
  display: inline-block;
  border-style: solid;
  border-color: rgba(30,58,138,.18);
  border-top-color: var(--brand-primary, #1E40AF);
  border-radius: 50%;
  animation: erpSpin .75s linear infinite;
  vertical-align: middle;
}
[data-theme="dark"] .erp-spinner {
  border-color: rgba(59,130,246,.22);
  border-top-color: var(--brand-primary, #3B82F6);
}
@keyframes erpSpin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .erp-spinner { animation-duration: 1.5s; } }
  `;
  document.head.appendChild(el);
}
