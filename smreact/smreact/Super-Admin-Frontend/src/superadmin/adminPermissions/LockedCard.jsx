import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   LockedCard — same-footprint "no access" placeholder, mirrors the
   ERP's own LockedCard. Renders in place of a gated control/section so
   the page layout never shifts and no data leaks through, just a title
   + lock icon + short reason.
   ═══════════════════════════════════════════════════════════════════ */
export default function LockedCard({ title, hint, height, compact }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center', justifyContent: 'center',
        gap: compact ? 8 : 6, height: height || (compact ? 'auto' : 160),
        padding: compact ? '8px 12px' : 20, borderRadius: 'var(--r-lg)',
        border: '1.5px dashed var(--bl)', background: 'var(--muted)', color: 'var(--tm)', textAlign: 'center',
      }}
      data-tip={hint || 'Ask your Super Admin for access'}
    >
      <i className="fa-solid fa-lock" style={{ fontSize: compact ? 13 : 20, opacity: 0.55 }} />
      <div style={{ fontSize: compact ? 12 : 12.5, fontWeight: 700 }}>{title || 'No access'}</div>
    </div>
  );
}
