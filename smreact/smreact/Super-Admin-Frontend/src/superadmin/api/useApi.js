/* ════════════════════════════════════════════════════════════════════
   useApi — tiny data-loading hook for the Super Admin services.

   Usage (pass a STABLE fetcher — memoize it so the effect doesn't loop):
     const load = useCallback(() => usersApi.listUsers({ search }), [search]);
     const { data, loading, error, reload } = useApi(load);

   Returns { data, loading, error, reload, setData }. `reload()` re-runs the
   fetch; `setData` lets a component apply an optimistic update locally.
   ════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';

export function useApi(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    let cancelled = false;
    Promise.resolve().then(fetcher).then(
      (d) => { if (!cancelled) { setData(d); setLoading(false); } },
      (e) => { if (!cancelled) { setError(e); setLoading(false); } },
    );
    return () => { cancelled = true; };
  }, [fetcher]);

  useEffect(() => run(), [run]);

  return { data, loading, error, reload: run, setData };
}

export default useApi;
