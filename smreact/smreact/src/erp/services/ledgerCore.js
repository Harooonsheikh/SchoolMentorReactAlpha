/* ============================================================================
   ledgerCore.js  — PURE, worker-safe ledger helpers (no React / DOM / sessionStorage).
   Fee.jsx aur ledgerWorker.js dono isko use karte hain — EK source, taake drift na ho.
   Yahan sirf wahi functions hain jo prevOutFromLedgerRows ko chahiye.
   NOTE: agar kabhi prevOutFromLedgerRows ki logic Fee.jsx me badlo to yahan bhi update karna.
   ============================================================================ */

export function ledgerCoversMonth(rec, month, year) {
  if (!rec) return false;
  const m = Number(month) || 0;
  const y = Number(year) || 0;
  if (!m || !y) return false;
  const sm = Number(rec.startMonth) || Number(rec.month) || 0;
  const sy = Number(rec.startYear) || Number(rec.year) || 0;
  const em = Number(rec.endMonth) || Number(rec.month) || sm;
  const ey = Number(rec.endYear) || Number(rec.year) || sy;
  if (!sm || !sy) return false;
  const t = y * 12 + m;
  return t >= (sy * 12 + sm) && t <= (ey * 12 + em);
}

export function isMultiMonthChallan(rec) {
  if (!rec) return false;
  if ((Number(rec.totalMonthChallan) || 0) > 1) return true;
  const sm = Number(rec.startMonth) || 0;
  const em = Number(rec.endMonth) || 0;
  const sy = Number(rec.startYear) || 0;
  const ey = Number(rec.endYear) || 0;
  return !!(sm && em && (sm !== em || sy !== ey));
}

export function prevOutFromLedgerRows(prevRows, viewMonth = null, viewYear = null) {
  /* SIRF aggregate carry rows ("Previous Pending" / arrear) — Launch Setup /
     Update Student ka "Previous Due" / "Previous Dues" head yahan NAHI.
     Woh normal billable head hai: pehle regex `/previous|…/` usay skip kar
     deta tha, received minus ho jati thi magar billed running me add nahi —
     partial receive ke baad next month Advance (−ve) dikhta tha, Dues nahi. */
  const isPrev = (r) => /previous\s*pending|arrears?/i.test(String(r.subHead || r.head || ''));
  const byStudent = new Map();
  /* View mahine ko cover karne wale (Sep–Nov ka Nov) challans jo skip hue — student-wise. */
  const skippedCover = new Map();
  (prevRows || []).forEach(r => {
    if (viewMonth != null && viewYear != null && ledgerCoversMonth(r, viewMonth, viewYear)) {
      const sid = String(r.studentID);
      (skippedCover.get(sid) || skippedCover.set(sid, []).get(sid)).push(r);
      return;
    }
    const id = String(r.studentID);
    if (!byStudent.has(id)) byStudent.set(id, []);
    byStudent.get(id).push(r);
  });
  const out = {};
  byStudent.forEach((recs, id) => {
    const sorted = recs.slice().sort(
      (a, b) => (Number(a.year) * 12 + Number(a.month)) - (Number(b.year) * 12 + Number(b.month)));
    let running = 0, first = true;
    /* HEAD-WISE previous: har prior mahine ke non-previous heads ka (billed − disc − received)
       head ke naam se jama — pichhla baqaya apne asli heads me taqseem ho kar carry ho.
       Aggregate "Previous Pending" rows skip (warna double-count). Negative = advance. */
    const headNet = new Map();
    const startOf = (x) => Number(x.startYear || x.year) * 12 + Number(x.startMonth || x.month);
    /* Is student ke multi-month challans (skip hue + shamil dono) — jin ki range me baad wala
       challan ka mahina aata ho (Sep–Nov ke andar Oct) aur wo us ka baqaya carry kare. */
    const covers = [...(skippedCover.get(id) || []), ...recs].filter(isMultiMonthChallan);
    const endOf = (x) => Number(x.endYear || x.startYear || x.year) * 12 + Number(x.endMonth || x.startMonth || x.month);
    sorted.forEach(rec => {
      const rows = rec.detailRows || [];
      /* Skip hue covering challan (Sep–Nov) ka baqaya agar BAAD wala challan (Oct) head-wise
         previousPendingorAdv me CARRY karta hai, to us challan ka carry hi opening balance —
         warna Oct par us baqaye ki wasooli (5,000) bina bill ke gin kar phantom ADVANCE
         (−4,000) banta tha. Per-head bhi usi carry se shuru. */
      const hpOf = (r) => Number(r.previousPendingorAdv ?? r.previousPendingOrAdv) || 0;
      const hpSum = rows.filter(r => !isPrev(r)).reduce((a, r) => a + hpOf(r), 0);
      if (hpSum !== 0 && covers.some(cv => cv !== rec && startOf(cv) < startOf(rec) && startOf(rec) <= endOf(cv))) {
        running = hpSum;
        first = false;
        headNet.clear();
        rows.forEach(r => {
          if (isPrev(r)) return;
          const nm = String(r.subHead || r.head || '').trim();
          if (nm && hpOf(r)) headNet.set(nm, (headNet.get(nm) || 0) + hpOf(r));
        });
      }
      const carry = rows.filter(isPrev).reduce((a, r) => a + ((+r.challanAmount || 0) - (+r.discount || 0)), 0);
      const newBilled = rows.filter(r => !isPrev(r)).reduce((a, r) => a + ((+r.challanAmount || 0) - (+r.discount || 0)), 0);
      const received = rows.reduce((a, r) => a + (+r.receivedAmount || 0), 0);
      rows.forEach(r => {
        if (isPrev(r)) return;
        const nm = String(r.subHead || r.head || '').trim();
        if (!nm) return;
        const net = (+r.challanAmount || 0) - (+r.discount || 0) - (+r.receivedAmount || 0);
        headNet.set(nm, (headNet.get(nm) || 0) + net);
      });
      if (first) { running = carry; first = false; }   // sirf pehle mahine ka carry opening balance
      running += newBilled - received;
    });
    const byHead = {};
    headNet.forEach((v, k) => { const n = Math.round(v); if (n !== 0) byHead[k] = n; });
    /* HAMESHA emit karo (net 0 ho tab bhi) — kyunke ye student ke PRIOR challans hain. Aise
       students ke liye prevOverride = {dues:0, advance:0, byHead:{}} banta hai, jo agle mahine
       ke challan par AUTHORITY hai: agar previous poora pay ho chuka to backend ke STALE
       "Previous Pending" (gross snapshot) ko nazar-andaaz kar ke 0 dikhata hai. */
    out[id] = { dues: running > 0 ? running : 0, advance: running < 0 ? -running : 0, byHead };
  });
  return out;
}
