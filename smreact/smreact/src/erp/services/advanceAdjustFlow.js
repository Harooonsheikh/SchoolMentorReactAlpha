/* Advance Adjustment flow (sab branches — isAdvanceAdjustBranch() in Fee.jsx).

   Save (Pay Now with "Adjust From Advance Balance" ticked):
     1. Is challan ki receiving (modal ke per-head amounts) ka total = adjust amount.
     2. Previous month ka challan dhoondo jis par advance (pendingorAdv < 0) hai.
     3. Us challan ki SAB heads ki asli cash yaad rakho, phir receiving reset karo
        BINA account delete (account entry wahi rehti hai — cash ek hi dafa).
     4. Sab heads wapas receive karo BINA account entry: advance wali heads par
        adjust amount utna kam (left-to-right), baqi heads apni asli raqam par.
     5. Is challan ki receiving (per-head) BINA account entry.

   Reverse (is challan ki adjustment receiving delete):
     1. Is challan ki receiving BINA account delete.
     2. Previous challan reset BINA account delete, phir SAB heads ki asli cash par
        dobara receive BINA account — advance wapas aata hai.

   Marker localStorage me (per challan) — reverse ko pata ho ke ye adjustment hai. */
import {
  getStudentChallans,
  getLedgerRange,
  clearReceivingNoAccount,
  receiveNoAccount,
} from './feeService';

const MARK_KEY = (challanId) => `sm_adv_adjust_${Number(challanId) || 0}`;

function readMark(challanId) {
  try { return JSON.parse(localStorage.getItem(MARK_KEY(challanId)) || 'null'); } catch (e) { return null; }
}
function writeMark(challanId, mark) {
  try { localStorage.setItem(MARK_KEY(challanId), JSON.stringify(mark)); } catch (e) { /* ignore */ }
}
function clearMark(challanId) {
  try { localStorage.removeItem(MARK_KEY(challanId)); } catch (e) { /* ignore */ }
}

export function isAdvanceAdjustReceipt(challanId) {
  return !!readMark(challanId);
}


/* Unused advance still sitting on a head: negative pendingorAdv, or cash
   received above that head's own bill. The list shows this as a negative
   previous balance, and it is often older than the immediately previous month. */
function advanceOnRow(r) {
  const received = Number(r.receivedAmount) || 0;
  if (received <= 0) return 0;
  const fromPending = Math.max(0, -(Number(r.pendingorAdv) || 0));
  const net = (Number(r.challanAmount) || 0) - (Number(r.discount) || 0);
  const over = Math.max(0, received - Math.max(0, net));
  const fromField = Math.max(0, Number(r.advanceAmount) || 0);
  return Math.min(received, Math.max(fromPending, over, fromField));
}

function challanAdvance(ch) {
  return (ch.detailRows || []).reduce((a, r) => a + advanceOnRow(r), 0);
}

function challanOrdinal(ch) {
  const y = Number(ch.startYear || ch.year) || 0;
  const m = Number(ch.startMonth || ch.month) || 0;
  return y * 12 + m;
}

function monthOfOrdinal(ord) {
  return { year: Math.floor((ord - 1) / 12), month: ((ord - 1) % 12) + 1 };
}

function pickInList(list, excludeId, adjustTotal, beforeOrd) {
  const ranked = (list || [])
    .filter(ch => (Number(ch.id) || 0) !== excludeId && (!beforeOrd || challanOrdinal(ch) < beforeOrd))
    .map(ch => ({ ch, adv: challanAdvance(ch), ord: challanOrdinal(ch) }))
    .filter(x => x.adv > 0);
  if (!ranked.length) return null;
  const covering = ranked.filter(x => x.adv + 0.5 >= adjustTotal);
  const pool = covering.length ? covering : ranked;
  return pool.sort((a, b) => b.ord - a.ord || b.adv - a.adv)[0];
}

async function findAdvanceChallan(studentID, currentChallan, adjustTotal) {
  const curOrd = challanOrdinal(currentChallan);
  const excludeId = Number(currentChallan?.id) || 0;
  const sid = String(studentID);
  let best = null;
  if (curOrd > 0) {
    const from = monthOfOrdinal(curOrd - 24);
    const to = monthOfOrdinal(curOrd - 1);
    try {
      const rows = await getLedgerRange(from.month, from.year, to.month, to.year);
      const mine = (rows || []).filter(ch => String(ch.studentID) === sid || String(ch.applicantsID || '') === sid);
      const hit = pickInList(mine, excludeId, adjustTotal, curOrd);
      if (hit && hit.adv + 0.5 >= adjustTotal) return hit.ch;
      best = hit;
    } catch (e) { /* month walk below */ }
  }
  let m = Number(currentChallan.startMonth || currentChallan.month) || 0;
  let y = Number(currentChallan.startYear || currentChallan.year) || 0;
  for (let i = 0; i < 18 && m && y; i++) {
    m = m === 1 ? 12 : m - 1;
    if (m === 12) y -= 1;
    const list = await getStudentChallans(studentID, m, y).catch(() => []);
    const hit = pickInList(list, excludeId, adjustTotal, curOrd);
    if (!hit) continue;
    if (!best || hit.adv > best.adv) best = hit;
    if (hit.adv + 0.5 >= adjustTotal) return hit.ch;
  }
  return best ? best.ch : null;
}

/* currentChallan: rec (server challan of this month). perHead: modal ke Received amounts (head name → amount).
   Adjust amount = current challan me jo total receive hua (typed amount) — utna hi advance kam hota hai. */
export async function runAdvanceAdjust({ studentID, currentChallan, perHead, userId, paymentMethod, receivedDate, prevMonth, prevYear }) {
  const curRows = (currentChallan.detailRows || []).map(r => {
    const amt = Math.round(Number(perHead?.[r.subHead || r.head]) || 0);
    return { id: r.id, installmentId: 0, receivedAmount: Math.max(0, amt), discount: 0, pendingorAdv: 0, walletId: 0 };
  }).filter(r => r.receivedAmount > 0);
  const adjustTotal = curRows.reduce((a, r) => a + r.receivedAmount, 0);
  if (!curRows.length || adjustTotal <= 0) throw new Error('The adjust amount could not be applied to any head.');

  const prev = await findAdvanceChallan(studentID, currentChallan, adjustTotal);
  if (!prev) throw new Error('No earlier challan with an unused advance was found.');

  /* Previous challan ki SAB heads (sirf advance wali nahi) — har head ki asli cash
     yaad rakho, taake reset ke baad sab wapas receive ho jayen. */
  const prevAll = (prev.detailRows || []).filter(r => (Number(r.receivedAmount) || 0) > 0);
  const cashOriginal = {};
  prevAll.forEach(r => { cashOriginal[r.id] = Number(r.receivedAmount) || 0; });

  /* Advance wali heads: pendingorAdv < 0 → utna advance (−pendingorAdv).
     Adjust amount inhi se, left-to-right, kaata jata hai. */
  let left = adjustTotal;
  const newReceived = {};
  prevAll.forEach(r => {
    newReceived[r.id] = cashOriginal[r.id];
    const advance = advanceOnRow(r);
    if (advance <= 0 || left <= 0) return;
    const take = Math.min(advance, left);
    newReceived[r.id] = cashOriginal[r.id] - take;
    left -= take;
  });
  if (left > 0) throw new Error(`Not enough advance — ${left} of ${adjustTotal} could not be adjusted.`);

  /* Marker pehle: agar aage kuch fail ho to reverse ko pata ho. */
  const srcMonth = Number(prev.startMonth || prev.month) || prevMonth;
  const srcYear = Number(prev.startYear || prev.year) || prevYear;
  writeMark(currentChallan.id, { prevChallanId: prev.id, prevMonth: srcMonth, prevYear: srcYear, cashOriginal, studentID });

  await clearReceivingNoAccount(prev.id, userId);
  /* Sab heads wapas — advance wali heads utna kam, baqi heads apni asli raqam par. */
  const reReceive = prevAll
    .filter(r => newReceived[r.id] > 0)
    .map(r => ({ id: r.id, installmentId: 0, receivedAmount: newReceived[r.id], discount: 0, pendingorAdv: 0, walletId: 0 }));
  await receiveNoAccount({
    ledgerId: prev.id, paymentMethod: paymentMethod || 'Advance Adjustment', receivedDate, modifiedBy: userId,
    isReceiving: true, walletId: 0, detailRows: reReceive,
  });

  await receiveNoAccount({
    ledgerId: currentChallan.id, paymentMethod: paymentMethod || 'Advance Adjustment', receivedDate, modifiedBy: userId,
    isReceiving: true, walletId: 0, detailRows: curRows,
  });
  return { prevChallanId: prev.id };
}

/* Adjustment receiving delete → advance wapas (sab heads, asli cash par). */
export async function reverseAdvanceAdjust({ currentChallanId, userId }) {
  const mark = readMark(currentChallanId);
  if (!mark) return false;
  await clearReceivingNoAccount(currentChallanId, userId);
  await clearReceivingNoAccount(mark.prevChallanId, userId);
  const detailRows = Object.entries(mark.cashOriginal).map(([rowId, cash]) => ({
    id: Number(rowId), installmentId: 0, receivedAmount: cash, discount: 0, pendingorAdv: 0, walletId: 0,
  }));
  await receiveNoAccount({
    ledgerId: mark.prevChallanId, paymentMethod: 'Advance Adjustment', receivedDate: new Date().toISOString().slice(0, 10), modifiedBy: userId,
    isReceiving: true, walletId: 0, detailRows,
  });
  clearMark(currentChallanId);
  return true;
}

