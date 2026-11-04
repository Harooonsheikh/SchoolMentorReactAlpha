/* ════════════════════════════════════════════════════════════════════
   useDashboardData — the Dashboard's single admin_dashboard state.

   • One request in flight at a time: a new load aborts the previous one.
   • Sequence guard: a response that is not from the LATEST request is
     dropped, even if it arrives later (no stale overwrite).
   • Unmount-safe: nothing is set after the screen is gone.
   • reload({ silent: true }) refreshes in the background (after a bug save)
     and, on failure, keeps the last VALID response instead of blanking the
     page — the caller shows the error next to the section it refreshed.

   status: 'loading' | 'ok' | 'error'
   ════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDashboard } from '../api/services/dashboard';

export function useDashboardData(fetcher = fetchDashboard) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const seq = useRef(0);
  const ctrl = useRef(null);
  const alive = useRef(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const reload = useCallback(({ silent = false } = {}) => {
    const id = ++seq.current;
    ctrl.current?.abort?.();
    const c = typeof AbortController === 'function' ? new AbortController() : null;
    ctrl.current = c;
    if (!silent) setState({ status: 'loading', data: null, error: null });
    const isCurrent = () => alive.current && id === seq.current;
    return fetchRef.current({ signal: c?.signal }).then(
      (data) => {
        if (!isCurrent()) return { stale: true };
        setState({ status: 'ok', data, error: null });
        return { ok: true, data };
      },
      (error) => {
        if (!isCurrent() || error?.name === 'AbortError') return { stale: true };
        if (!silent) setState({ status: 'error', data: null, error });
        return { error };
      },
    );
  }, []);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => { alive.current = false; ctrl.current?.abort?.(); };
  }, [reload]);

  return { ...state, reload };
}

export default useDashboardData;
