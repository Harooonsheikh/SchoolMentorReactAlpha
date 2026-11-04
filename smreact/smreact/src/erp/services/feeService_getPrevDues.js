/* ============================================================================
   feeService.js — 2 additions (getLedgerRange / getFeeDefaulters ke paas)
   Lean previous-dues: 12-mahine poora-branch ledger laane ke bajaye server se
   seedha per-student running balance. Return shape prevOutFromLedgerRows se
   BILKUL identical -> { [studentID]: { dues, advance, byHead:{ [name]: signedInt } } }
   taake Fee.jsx ke call-sites jyun ke tyun chalein.
   ============================================================================ */

/* ---- ADDITION 1 ----------------------------------------------------------
   invalidateMonthChallans(...) ke andar, `ledgerRangeCache.clear();` ke SAATH
   ye line bhi add karo (write hone par prev-dues bhi badal sakti hai):

       prevDuesCache.clear();
   -------------------------------------------------------------------------- */


/* ---- ADDITION 2 ----------------------------------------------------------
   getLedgerRange ke neeche (ya getFeeDefaulters ke paas) ye poora block add karo.
   -------------------------------------------------------------------------- */

const prevDuesCache = new Map();   // `${branchID}|${month}|${year}` -> promise

/* View-mahine se PEHLE ke challans ka per-student running balance (server-computed).
   usp_AHM_Branch_Prev_Dues -> RS1 (dues/advance per student), RS2 (per-head signed).
   client prevOutFromLedgerRows ka exact mirror; return shape bhi wahi.
   GET /api/BranchLedger/prev-dues?branchId=&month=&year=  (month 1-based) */
export async function getPrevDues(month, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const key = `${branchID}|${month}|${year}`;
  if (prevDuesCache.has(key)) return prevDuesCache.get(key);

  const promise = (async () => {
    const res = await fetch(
      buildUrl(`/api/BranchLedger/prev-dues?branchId=${branchID}&month=${month}&year=${year}`),
      { headers: { Accept: '*/*' } },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) {
      throw new Error(apiMessage(json) || 'Could not load previous dues');
    }
    const data = json?.data || {};
    const students = Array.isArray(data.students) ? data.students : [];
    const heads    = Array.isArray(data.heads)    ? data.heads    : [];

    const out = {};
    // RS1 -> har prior-challan student (net 0 bhi) — prevOutFromLedgerRows jaisa
    students.forEach(s => {
      const id = String(s.studentID ?? s.StudentID);
      out[id] = {
        dues:    Math.round(Number(s.dues    ?? s.Dues)    || 0),
        advance: Math.round(Number(s.advance ?? s.Advance) || 0),
        byHead:  {},
      };
    });
    // RS2 -> byHead key = subHead || head (trim), signed, round (client jaisa)
    heads.forEach(h => {
      const id = String(h.studentID ?? h.StudentID);
      const e = out[id] || (out[id] = { dues: 0, advance: 0, byHead: {} });
      const name = String((h.subHead ?? h.SubHead) || (h.head ?? h.Head) || '').trim();
      if (!name) return;
      e.byHead[name] = (e.byHead[name] || 0) + Math.round(Number(h.amount ?? h.Amount) || 0);
    });
    // zero byHead entries drop (client bhi 0 nahi rakhta)
    Object.values(out).forEach(e => {
      Object.keys(e.byHead).forEach(k => { if (!e.byHead[k]) delete e.byHead[k]; });
    });
    return out;
  })();

  prevDuesCache.set(key, promise);
  promise.catch(() => { prevDuesCache.delete(key); });
  return promise;
}
