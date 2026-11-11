/* ============================================================================
   prevDuesWorker.js — main-thread client for the ledger Web Worker.

   computePrevOut(prevRows, viewMonth, viewYear) -> Promise<prevOut>
     - Heavy prevOut compute Web Worker me (off main-thread) → UI kabhi freeze nahi.
     - Memoized per (prevRows reference, month|year): ek hi computation ka promise
       share hota hai — do components ek hi waqt call karein to dono ko same result.
     - NO CANCELLATION: pehle yeh naya call aane par purana in-flight kaam terminate
       kar deta tha; cancelled caller ka result khali ({}) ho jaata tha, jis se table
       ka figure (stored snapshot) aur preview ka figure alag alag aate the. Ab har
       request apni id se alag resolve hoti hai — kisi ka kaam kisi aur ko nahi todta.
     - FALLBACK: Worker na ho / fail ho → wahi compute main-thread par (ledgerCore).
   ============================================================================ */
import { prevOutFromLedgerRows } from './ledgerCore';

let _worker = null;
let _reqSeq = 0;
const _waiters = new Map();          // reqId -> { resolve, reject }
const _memo = new WeakMap();         // prevRows -> Map(`${m}|${y}` -> Promise<prevOut base>)

function _clone(base) {
  const out = {};
  for (const id in base) out[id] = { ...base[id] };   // fresh entries (caller .fine add karta hai)
  return out;
}

function _failAll(msg) {
  const pending = [..._waiters.values()];
  _waiters.clear();
  pending.forEach(w => w.reject(new Error(msg)));
}

function _spawn() {
  if (_worker) return _worker;
  try {
    const w = new Worker(new URL('./ledgerWorker.js', import.meta.url));
    w.onmessage = (e) => {
      const d = (e && e.data) || {};
      const waiter = _waiters.get(d.reqId);
      if (!waiter) return;
      _waiters.delete(d.reqId);
      if (d.ok) waiter.resolve(d.prevOut);
      else waiter.reject(new Error(d.error || 'worker-error'));
    };
    w.onerror = () => {
      _failAll('worker-crashed');
      try { w.terminate(); } catch (e) { /* noop */ }
      if (_worker === w) _worker = null;
    };
    _worker = w;
  } catch (e) {
    _worker = null;   // Worker unsupported → fallback path
  }
  return _worker;
}

function _run(prevRows, viewMonth, viewYear) {
  const w = (typeof Worker !== 'undefined') ? _spawn() : null;
  if (!w) return Promise.resolve(prevOutFromLedgerRows(prevRows, viewMonth, viewYear));
  const reqId = ++_reqSeq;
  return new Promise((resolve, reject) => {
    _waiters.set(reqId, { resolve, reject });
    try {
      w.postMessage({ reqId, prevRows, viewMonth, viewYear });
    } catch (err) {
      _waiters.delete(reqId);
      reject(err);
    }
  }).catch(() => prevOutFromLedgerRows(prevRows, viewMonth, viewYear));   // worker fail → main-thread
}

export function computePrevOut(prevRows, viewMonth, viewYear) {
  if (!prevRows) return Promise.resolve({});
  const vk = `${viewMonth}|${viewYear}`;

  let byKey = _memo.get(prevRows);
  if (!byKey) { byKey = new Map(); _memo.set(prevRows, byKey); }
  if (!byKey.has(vk)) {
    const p = _run(prevRows, viewMonth, viewYear);
    byKey.set(vk, p);
    p.catch(() => byKey.delete(vk));
  }
  return byKey.get(vk).then(_clone);
}
