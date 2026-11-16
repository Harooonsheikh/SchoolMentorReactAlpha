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


async function findAdvanceChallan(studentID, month, year) {
  const list = await getStudentChallans(studentID, month, year);
  return (list || []).find(ch =>
    (ch.detailRows || []).some(r => (Number(r.pendingorAdv) || 0) < 0 && (Number(r.receivedAmount) || 0) > 0)
  ) || null;
}

/* currentChallan: rec (server challan of this month). perHead: modal ke Received amounts (head name → amount).
   Adjust amount = current challan me jo total receive hua (typed amount) — utna hi advance kam hota hai. */
export async function runAdvanceAdjust({ studentID, currentChallan, perHead, userId, paymentMethod, receivedDate, prevMonth, prevYear }) {
  const curRows = (currentChallan.detailRows || []).map(r => {
    const amt = Math.round(Number(perHead?.[r.subHead || r.head]) || 0);
    return { id: r.id, installmentId: 0, receivedAmount: Math.max(0, amt), discount: 0, pendingorAdv: 0, walletId: 0 };
  }).filter(r => r.receivedAmount > 0);
  const adjustTotal = curRows.reduce((a, r) => a + r.receivedAmount, 0);
  if (!curRows.length || adjustTotal <= 0) throw new Error('Adjust amount kisi head me split nahi hua.');

  const prev = await findAdvanceChallan(studentID, prevMonth, prevYear);
  if (!prev) throw new Error('Previous month me advance wala challan nahi mila.');

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
    const advance = Math.min(Math.max(0, -(Number(r.pendingorAdv) || 0)), cashOriginal[r.id]);
    if (advance <= 0 || left <= 0) return;
    const take = Math.min(advance, left);
    newReceived[r.id] = cashOriginal[r.id] - take;
    left -= take;
  });
  if (left > 0) throw new Error(`Advance kam hai — ${adjustTotal} me se ${left} adjust nahi ho saka.`);

  /* Marker pehle: agar aage kuch fail ho to reverse ko pata ho. */
  writeMark(currentChallan.id, { prevChallanId: prev.id, prevMonth, prevYear, cashOriginal, studentID });

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

