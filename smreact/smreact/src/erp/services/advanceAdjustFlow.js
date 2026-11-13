/* Advance Adjustment flow (sab branches — isAdvanceAdjustBranch() in Fee.jsx).

   Save (Pay Now with "Adjust From Advance Balance" ticked):
     1. Previous month ka challan dhoondo jis par advance (pendingorAdv < 0) hai.
     2. Us challan ki asli receiving (cash) yaad rakho, phir receiving reset karo
        BINA account delete (account entry wahi rehti hai — cash ek hi dafa).
     3. Us challan ko sirf owed amount (challan − discount) par dobara receive karo,
        BINA account entry — yahi advance "consume" hota hai.
     4. Is challan ki receiving (modal ke per-head amounts) BINA account entry.

   Reverse (is challan ki adjustment receiving delete):
     1. Is challan ki receiving BINA account delete.
     2. Previous challan reset BINA account delete, phir asli cash par dobara receive
        BINA account — advance wapas aata hai.

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

/* currentChallan: rec (server challan of this month). perHead: modal ke Received amounts (head name → amount). */
export async function runAdvanceAdjust({ studentID, currentChallan, perHead, userId, paymentMethod, receivedDate, prevMonth, prevYear }) {
  const prev = await findAdvanceChallan(studentID, prevMonth, prevYear);
  if (!prev) throw new Error('Previous month me advance wala challan nahi mila.');

  const prevRows = (prev.detailRows || []).filter(r => (Number(r.pendingorAdv) || 0) < 0 && (Number(r.receivedAmount) || 0) > 0);
  const cashOriginal = {};
  const reReceive = [];
  (prev.detailRows || []).forEach(r => {
    if (!prevRows.includes(r)) return;
    cashOriginal[r.id] = Number(r.receivedAmount) || 0;
    const owed = Math.max(0, (Number(r.challanAmount) || 0) - (Number(r.discount) || 0));
    reReceive.push({ id: r.id, installmentId: 0, receivedAmount: owed, discount: 0, pendingorAdv: 0, walletId: 0 });
  });

  /* Marker pehle: agar aage kuch fail ho to reverse ko pata ho. */
  writeMark(currentChallan.id, { prevChallanId: prev.id, prevMonth, prevYear, cashOriginal, studentID });

  await clearReceivingNoAccount(prev.id, userId);
  await receiveNoAccount({
    ledgerId: prev.id, paymentMethod: paymentMethod || 'Advance Adjustment', receivedDate, modifiedBy: userId,
    isReceiving: true, walletId: 0, detailRows: reReceive,
  });

  const curRows = (currentChallan.detailRows || []).map(r => {
    const amt = Math.round(Number(perHead?.[r.subHead || r.head]) || 0);
    return { id: r.id, installmentId: 0, receivedAmount: Math.max(0, amt), discount: 0, pendingorAdv: 0, walletId: 0 };
  }).filter(r => r.receivedAmount > 0);
  if (!curRows.length) throw new Error('Adjust amount kisi head me split nahi hua.');
  await receiveNoAccount({
    ledgerId: currentChallan.id, paymentMethod: paymentMethod || 'Advance Adjustment', receivedDate, modifiedBy: userId,
    isReceiving: true, walletId: 0, detailRows: curRows,
  });
  return { prevChallanId: prev.id };
}

/* Adjustment receiving delete → advance wapas. */
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

