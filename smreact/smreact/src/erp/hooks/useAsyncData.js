import { useMemo } from 'react';
import useAsync from './useAsync';

/*
  useAsyncData — thin convenience layer on top of useAsync().

  Adds two ergonomic fields tailored to the <DataState /> wrapper:

    - isEmpty:  null while data is undefined, then true/false after the
                first response. Lets <DataState> distinguish "first
                load in progress" from "loaded with empty array".
    - rows:     alias of data — purely a readability nicety so we can
                write `rows.length` even when the response is a list.

  Usage:

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

  The full useAsync API is forwarded — `setData` for optimistic
  mutations and `refetch` for retry/refresh both work.
*/
export default function useAsyncData(asyncFn, deps = [], options = {}) {
  const { initial, isEmpty: customIsEmpty } = options;
  const inner = useAsync(asyncFn, deps, initial);

  const isEmpty = useMemo(() => {
    if (inner.data === undefined) return null;          // first load not finished
    if (typeof customIsEmpty === 'function') return customIsEmpty(inner.data);
    if (Array.isArray(inner.data)) return inner.data.length === 0;
    if (inner.data && typeof inner.data === 'object') return Object.keys(inner.data).length === 0;
    return inner.data == null;
  }, [inner.data, customIsEmpty]);

  return {
    ...inner,
    rows: inner.data,
    isEmpty,
  };
}
