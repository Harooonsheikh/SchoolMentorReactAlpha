/* ════════════════════════════════════════════════════════════════════
   useApi — tiny data-loading hook for the Super Admin services.

   Usage (pass a STABLE fetcher — memoize it so the effect doesn't loop):
     const load = useCallback(() => usersApi.listUsers({ search }), [search]);
     const { data, loading, error, reload } = useApi(load);

   Returns { data, loading, error, reload, setData }. `reload()` re-runs the
   fetch; `setData` lets a component apply an optimistic update locally.
   ════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /* Every run gets a sequence number; only the LATEST run may set state.
     Previously a manual reload() returned its cancel fn to nobody, so an
     older, slower response could overwrite a newer one. */
  const seq = useRef(0);

  const run = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    Promise.resolve().then(fetcher).then(
      (d) => { if (id === seq.current) { setData(d); setLoading(false); } },
      (e) => { if (id === seq.current) { setError(e); setLoading(false); } },
    );
    return () => { if (id === seq.current) seq.current += 1; };
  }, [fetcher]);

  useEffect(() => run(), [run]);

  return { data, loading, error, reload: run, setData };
}

export default useApi;
