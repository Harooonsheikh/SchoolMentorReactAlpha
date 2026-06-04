import { useCallback, useEffect, useRef, useState } from 'react';

/*
  useAsync — run an async function on mount and surface { data, loading, error }.

    const { data, loading, error, refetch, setData } = useAsync(examService.getExams, []);

  - `deps`     re-runs the fetch when any value changes (like useEffect).
  - `initial`  what `data` is before the first resolution (default: undefined).
  - `setData`  optimistic local mutation without refetching.

  ════════════════════════════════════════════════════════════════════
  STANDARD LOADING PATTERN — follow this for every API-backed view.
  ════════════════════════════════════════════════════════════════════
  Do NOT just destructure { data = [] } and ignore the rest. With a real
  backend, ignoring `loading` shows an empty table for ~500 ms on every
  visit; ignoring `error` silently swallows failures.

  Use either pattern wherever data drives the UI:

    1) Drop-in <DataState /> wrapper (covers loading/error/empty):

         import { useAsyncData } from '../hooks';
         import { DataState }    from '../shared';

         const fee = useAsyncData(feeService.getFeeClasses, []);

         <DataState
           loading={fee.loading}
           error={fee.error}
           isEmpty={fee.isEmpty}
           onRetry={fee.refetch}
           skeleton={<FeeClassesSkeleton />}
         >
           <FeeClassesTable rows={fee.data} />
         </DataState>

    2) Manual handling when you need fine-grained control:

         const { data: rows, loading, error, refetch } = useAsync(...);
         if (loading) return <Skeleton.Row cols={4} />;
         if (error)   return <ErrorState error={error} onRetry={refetch} />;
         if (!rows.length) return <EmptyState title="No data" />;
         return <Table rows={rows} />;

  Skeleton / Spinner / ErrorState / DataState primitives live in src/shared/.
*/
export default function useAsync(asyncFn, deps = [], initial = undefined) {
  const [data, setData]       = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const cancelledRef          = useRef(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      if (!cancelledRef.current) setData(result);
    } catch (err) {
      if (!cancelledRef.current) setError(err);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    cancelledRef.current = false;
    run();
    return () => { cancelledRef.current = true; };
  }, [run]);

  return { data, loading, error, refetch: run, setData };
}
