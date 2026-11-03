/* ============================================================================
   prevDuesWorker.js — main-thread client for the ledger Web Worker.

   computePrevOut(prevRows, viewMonth, viewYear) -> Promise<prevOut>
     - Heavy prevOut compute Web Worker me (off main-thread) → UI kabhi freeze nahi.
     - Memoized per (prevRows reference, month|year): save/receive par getLedgerRange
       naya prevRows deta hai → memo khud fresh (Phase-1 jaisa).
     - CANCELLATION: nayi call aane par purana worker TERMINATE → purana compute
       foran chhod diya jata hai, nayi chalti hai. Purani promise 'cancelled' se
       reject hoti hai — loadChallans ka try/catch use nigal leta hai (harmless).
     - FALLBACK: Worker na ho / fail ho → wahi compute main-thread par (ledgerCore)
       → worst case current behavior, kabhi toota hua nahi.
   ============================================================================ */
import { prevOutFromLedgerRows } from './ledgerCore';

let _worker = null;
let _reqSeq = 0;
let _pending = null;                 // { reqId, resolve, reject }
const _memo = new WeakMap();         // prevRows -> Map(`${m}|${y}` -> prevOut base)

function _clone(base) {
  const out = {};
  for (const id in base) out[id] = { ...base[id] };   // fresh entries (caller .fine add karta hai)
  return out;
}

function _spawn() {
  if (_worker) return _worker;
  try {
    _worker = new Worker(new URL('./ledgerWorker.js', import.meta.url));
    _worker.onmessage = (e) => {
      const d = (e && e.data) || {};
      if (!_pending || d.reqId !== _pending.reqId) return;   // stale/cancelled
      const p = _pending; _pending = null;
      if (d.ok) p.resolve(d.prevOut);
      else p.reject(new Error(d.error || 'worker-error'));
    };
    _worker.onerror = () => {
      if (_pending) { const p = _pending; _pending = null; p.reject(new Error('worker-crashed')); }
      try { _worker.terminate(); } catch (e) { /* noop */ }
      _worker = null;
    };
  } catch (e) {
    _worker = null;   // Worker unsupported → fallback path
  }
  return _worker;
}

export async function computePrevOut(prevRows, viewMonth, viewYear) {
  if (!prevRows) return {};
  const vk = `${viewMonth}|${viewYear}`;

  let byKey = _memo.get(prevRows);
  if (byKey && byKey.has(vk)) return _clone(byKey.get(vk));   // memo hit → instant

  /* cancellation: pehle wala in-flight kaam chhod do (new click jeet jaye) */
  if (_pending) {
    const prev = _pending; _pending = null;
    try { if (_worker) _worker.terminate(); } catch (e) { /* noop */ }
    _worker = null;
    prev.reject(new Error('cancelled'));
  }

  const hasWorker = (typeof Worker !== 'undefined') && !!_spawn();

  let base;
  if (!hasWorker) {
    base = prevOutFromLedgerRows(prevRows, viewMonth, viewYear);   // fallback (main-thread)
  } else {
    const reqId = ++_reqSeq;
    try {
      base = await new Promise((resolve, reject) => {
        _pending = { reqId, resolve, reject };
        _worker.postMessage({ reqId, prevRows, viewMonth, viewYear });
      });
    } catch (err) {
      if (String(err && err.message) === 'cancelled') throw err;   // caller ka catch nigal lega
      base = prevOutFromLedgerRows(prevRows, viewMonth, viewYear);  // worker fail → fallback
    }
  }

  if (!byKey) { byKey = new Map(); _memo.set(prevRows, byKey); }
  byKey.set(vk, base);
  return _clone(base);
}
