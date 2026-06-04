import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { search as runSearch } from '../services/searchService';
import { registerAllDefaultProviders } from '../services/searchProviders';
import { useModules } from '../context/ModuleContext';

/* ═══════════════════════════════════════════════════════════════════
   useUniversalSearch — owns query state, debouncing, in-memory recents,
   and bridges the React tree to the framework-agnostic searchService.

   This hook never persists anything to localStorage — keep frontend
   API-ready: recent / popular searches live in memory; when the backend
   lands they'll be sourced from an API. The hook returns enough surface
   to render any UI on top.

   Returned shape:
     query                — current input string (controlled by hook)
     setQuery(v)          — write the input
     submit(v?)           — force a search now (skip debounce); also
                            records the query in recents
     clear()              — reset everything
     loading              — true while the latest search is in flight
     results              — flat ranked list (top hits, sorted by score)
     grouped              — per-module groups, sorted by priority
     totalCount           — total flat result count
     recentSearches       — last queries the user actually committed
     popularSearches      — static curated keywords surfaced when empty
     suggestedSearches    — dynamic from popular + last recent
     recordVisit(result)  — call when the user clicks a result; bumps
                            the corresponding query into recents
   ═══════════════════════════════════════════════════════════════════ */

/* In-memory store. A future API hook can replace these with state
   sourced from a /me/search/recent endpoint. */
const _recents = [];                   // strings, most-recent-first
const RECENT_MAX = 8;

/* Curated, ERP-relevant suggestions. Backend can swap this for a real
   "popular keywords" feed without UI changes. */
const POPULAR_SEARCHES = [
  'Active Students',
  'Pending Lesson Plans',
  'Today’s Attendance',
  'Fee Defaulters',
  'Recent Audit Logs',
  'Staff On Leave',
  'Upcoming Exams',
  'New Admissions',
];

const PERMISSION_ALLOW_ALL = () => true;

export function useUniversalSearch({
  debounceMs = 220,
  perModuleLimit = 8,
  canAccess = PERMISSION_ALLOW_ALL,
  sessionId = null,
} = {}) {
  /* Ensure built-in providers are loaded once before the first query. */
  useEffect(() => { registerAllDefaultProviders(); }, []);

  const { moduleState, isActive } = useModules();

  /* Frozen Set of active module ids for the current ModuleContext state.
     Recomputed when the user toggles modules in Launch Setup. */
  const activeModuleIds = useMemo(() => {
    const ids = new Set();
    for (const k of Object.keys(moduleState || {})) {
      if (isActive(k)) ids.add(k);
    }
    return ids;
  }, [moduleState, isActive]);

  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [recentSearches, setRecentSearches] = useState(_recents.slice());

  const timerRef    = useRef(null);
  const reqIdRef    = useRef(0);   /* monotonically increasing — gate stale responses */

  const _doSearch = useCallback(async (q) => {
    const trimmed = (q || '').trim();
    if (!trimmed) {
      setResults([]); setGrouped([]); setTotalCount(0); setLoading(false);
      return;
    }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      const r = await runSearch(trimmed, {
        activeModuleIds,
        canAccess,
        sessionId,
        limit: perModuleLimit,
      });
      if (myReq !== reqIdRef.current) return;  /* a newer query is in flight */
      setResults(r.results);
      setGrouped(r.grouped);
      setTotalCount(r.totalCount);
    } catch (err) {
      if (myReq !== reqIdRef.current) return;
      setResults([]); setGrouped([]); setTotalCount(0);
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, [activeModuleIds, canAccess, sessionId, perModuleLimit]);

  /* Debounced effect on query change. */
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      _doSearch('');
      return;
    }
    timerRef.current = setTimeout(() => _doSearch(query), debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [query, debounceMs, _doSearch]);

  /* Re-run when activation set changes (user disables a module mid-search). */
  useEffect(() => {
    if (query.trim()) _doSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModuleIds]);

  /* ─── Recent-search bookkeeping. */
  const pushRecent = useCallback((raw) => {
    const v = (raw || '').trim();
    if (!v) return;
    /* De-dup case-insensitively */
    const idx = _recents.findIndex(x => x.toLowerCase() === v.toLowerCase());
    if (idx >= 0) _recents.splice(idx, 1);
    _recents.unshift(v);
    if (_recents.length > RECENT_MAX) _recents.length = RECENT_MAX;
    setRecentSearches(_recents.slice());
  }, []);

  const clearRecents = useCallback(() => {
    _recents.length = 0;
    setRecentSearches([]);
  }, []);

  /* Manual submit (Enter key, or external trigger). */
  const submit = useCallback((forced) => {
    const q = (forced != null ? forced : query).trim();
    if (!q) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (forced != null) setQuery(forced);
    pushRecent(q);
    _doSearch(q);
  }, [query, _doSearch, pushRecent]);

  /* Call when the user clicks a result — bumps its query into recents. */
  const recordVisit = useCallback((_result) => {
    if (query.trim()) pushRecent(query);
  }, [query, pushRecent]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setQuery('');
    setResults([]); setGrouped([]); setTotalCount(0);
    setLoading(false);
  }, []);

  /* Suggestions surfaced when the box is focused but empty:
     mix the most recent query (if any) with the curated popular list. */
  const suggestedSearches = useMemo(() => {
    const top = recentSearches[0];
    const seen = new Set();
    const out = [];
    if (top) { out.push(top); seen.add(top.toLowerCase()); }
    for (const p of POPULAR_SEARCHES) {
      if (out.length >= 6) break;
      if (!seen.has(p.toLowerCase())) { out.push(p); seen.add(p.toLowerCase()); }
    }
    return out;
  }, [recentSearches]);

  return {
    query, setQuery,
    submit, clear,
    loading,
    results, grouped, totalCount,
    recentSearches, clearRecents,
    popularSearches:  POPULAR_SEARCHES,
    suggestedSearches,
    recordVisit,
  };
}
