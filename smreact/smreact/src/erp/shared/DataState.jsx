import React from 'react';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

/* ═══════════════════════════════════════════════════════════════════
   <DataState /> — the standard wrapper for any view that depends on
   data from useAsync(). Replaces the pattern where we just trust
   `const { data = [] }` and silently render an empty layout while a
   real backend is still responding.

   Usage:

     const { data: rows, loading, error, refetch } = useAsync(
       feeService.getFeeClasses, []
     );

     <DataState
       loading={loading}
       error={error}
       isEmpty={rows && rows.length === 0}
       skeleton={<TableSkeleton rows={6} />}
       empty={<EmptyState title="No classes" />}
       onRetry={refetch}
     >
       <ActualTable rows={rows} />
     </DataState>

   Rules:
     • Loading is shown on the FIRST fetch (data is undefined).
       Refetches keep the existing data on screen so the UI doesn't blank.
     • Errors always win — even with stale data, show the error banner.
     • Empty state shows only after a successful fetch returned nothing.
   ═══════════════════════════════════════════════════════════════════ */
export default function DataState({
  loading,
  error,
  isEmpty,
  skeleton,
  empty,
  onRetry,
  children,
  /* Show "refreshing…" indicator without blanking the screen when
     refetching with data already present. Defaults to true. */
  showRefreshHint = true,
}) {
  // First-time load: nothing on screen yet → render skeleton.
  // `loading && !children-has-data` heuristic: the caller passes a sentinel
  // by checking their own data; we just trust the `loading` flag combined
  // with `isEmpty == null` (data not yet known).
  const firstLoad = loading && isEmpty == null;

  return (
    <div
      className="erp-datastate"
      aria-busy={loading || undefined}
      aria-live="polite"
    >
      {error && (
        <ErrorState
          error={error}
          onRetry={onRetry}
        />
      )}

      {firstLoad && !error && (skeleton || <DefaultSkeleton />)}

      {!firstLoad && !error && isEmpty && (empty || <EmptyState title="No data" />)}

      {!firstLoad && !error && !isEmpty && (
        <>
          {showRefreshHint && loading && (
            <div className="erp-datastate-refresh" role="status" aria-live="polite">
              <span className="erp-datastate-refresh-dot" aria-hidden="true" />
              Refreshing…
            </div>
          )}
          {children}
        </>
      )}
    </div>
  );
}

function DefaultSkeleton() {
  /* A neutral "card-and-rows" placeholder used when no module-specific
     skeleton is supplied. Modules should usually pass their own so the
     loading layout matches the final layout. */
  return (
    <div className="erp-datastate-default-skel" role="presentation">
      <div className="erp-skel erp-datastate-default-skel-title" />
      <div className="erp-skel erp-datastate-default-skel-sub" />
      <div className="erp-datastate-default-skel-rows">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="erp-skel erp-datastate-default-skel-row" key={i} />
        ))}
      </div>
    </div>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('erp-datastate-style')) {
  const el = document.createElement('style');
  el.id = 'erp-datastate-style';
  el.textContent = `
.erp-datastate { position: relative; }

.erp-datastate-refresh {
  position: absolute;
  top: -2px; right: 2px;
  z-index: 4;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E5E7EB);
  border-radius: 999px;
  font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-muted, #64748B);
  box-shadow: 0 2px 6px rgba(15,23,42,.06);
  animation: erpDataRefreshIn .25s ease;
  pointer-events: none;
}
.erp-datastate-refresh-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--brand-primary, #1E40AF);
  animation: erpDataRefreshPulse 1.1s ease-in-out infinite;
}
@keyframes erpDataRefreshIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
@keyframes erpDataRefreshPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.7); } }

[data-theme="dark"] .erp-datastate-refresh {
  background: var(--bg-card);
  border-color: var(--border-light);
  box-shadow: 0 2px 8px rgba(0,0,0,.25);
}

/* Default skeleton — generic shape */
.erp-datastate-default-skel {
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E5E7EB);
  border-radius: var(--radius-lg, 16px);
  padding: 22px 24px;
}
.erp-datastate-default-skel-title { display:block; width: 40%; height: 18px; border-radius: 5px; margin-bottom: 8px; }
.erp-datastate-default-skel-sub   { display:block; width: 60%; height: 11px; border-radius: 4px; margin-bottom: 22px; }
.erp-datastate-default-skel-rows  { display: flex; flex-direction: column; gap: 11px; }
.erp-datastate-default-skel-row   { display:block; height: 36px; border-radius: 8px; }
  `;
  document.head.appendChild(el);
}
