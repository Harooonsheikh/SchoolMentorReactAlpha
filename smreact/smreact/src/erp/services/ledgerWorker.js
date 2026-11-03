/* ============================================================================
   ledgerWorker.js — Web Worker: previous-dues (prevOut) compute off main-thread.
   Bas prevOutFromLedgerRows chalata hai (sabse bhaari nested-loop) aur result
   wapas bhejta hai. Pure logic ledgerCore.js me hai (Fee.jsx se shared).
   ============================================================================ */
import { prevOutFromLedgerRows } from './ledgerCore';

/* eslint-disable no-restricted-globals */
self.onmessage = (e) => {
  const { reqId, prevRows, viewMonth, viewYear } = (e && e.data) || {};
  try {
    const prevOut = prevOutFromLedgerRows(prevRows, viewMonth, viewYear);
    self.postMessage({ reqId, ok: true, prevOut });
  } catch (err) {
    self.postMessage({ reqId, ok: false, error: String((err && err.message) || err) });
  }
};
