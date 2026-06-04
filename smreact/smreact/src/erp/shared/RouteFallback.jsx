import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   <RouteFallback /> — Suspense fallback shown while a code-split module
   chunk is being fetched.

   Usage:
     <Suspense fallback={<RouteFallback label="Loading Fee module…" />}>
       <Fee />
     </Suspense>

   The fallback intentionally mirrors the visual language of the ERP
   shell (token-driven colors, soft shadow, brand-blue accent) so the
   loading state feels like part of the page rather than a blank screen.

   No data, no business logic — purely a UI placeholder.
   ═══════════════════════════════════════════════════════════════════ */
export default function RouteFallback({ label = 'Loading…' }) {
  return (
    <div
      className="route-fallback"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="route-fallback-spinner" aria-hidden="true">
        <div className="route-fallback-ring" />
      </div>
      <div className="route-fallback-label">{label}</div>
      <div className="route-fallback-sub">
        Fetching module — this only happens the first time you open it.
      </div>
    </div>
  );
}

/* ─── One-time global stylesheet — appended on first import ─── */
if (typeof document !== 'undefined' && !document.getElementById('erp-route-fallback-style')) {
  const el = document.createElement('style');
  el.id = 'erp-route-fallback-style';
  el.textContent = `
.route-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 80px 32px;
  text-align: center;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E5E7EB);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15,23,42,.04));
  font-family: var(--font-body, 'Plus Jakarta Sans','Segoe UI',Arial,sans-serif);
  min-height: 280px;
}
.route-fallback-spinner {
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
}
.route-fallback-ring {
  width: 44px; height: 44px;
  border: 3px solid rgba(30,58,138,.14);
  border-top-color: var(--brand-primary, #1E40AF);
  border-radius: 50%;
  animation: routeFallbackSpin .85s linear infinite;
}
@keyframes routeFallbackSpin { to { transform: rotate(360deg); } }
.route-fallback-label {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -.01em;
  color: var(--text-primary, #0F172A);
}
.route-fallback-sub {
  font-size: 12.5px;
  color: var(--text-muted, #64748B);
  max-width: 320px;
  line-height: 1.5;
}
[data-theme="dark"] .route-fallback {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .route-fallback-ring {
  border-color: rgba(59,130,246,.18);
  border-top-color: var(--brand-primary, #3B82F6);
}
@media (max-width: 700px) {
  .route-fallback { padding: 48px 18px; min-height: 220px; }
  .route-fallback-ring { width: 36px; height: 36px; }
  .route-fallback-label { font-size: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .route-fallback-ring { animation-duration: 2s; }
}
  `;
  document.head.appendChild(el);
}
