import { buildSuperAdminUrl } from '../../utils/apiConfig';
import { fetchBranchNetworkId } from './chainBranch';

/* ═══════════════════════════════════════════════════════════════════
   BILLING — School Mentor subscription data for the ERP Billing screen
   (Accounts → Billing). Two SuperAdmin endpoints feed the SAME original
   UI (no layout change): the challan ledger (history + current) and the
   payment setup (billing basis / formula).

   Ledger:  GET .../api/AHM_School_Payments/get_payment_ledger
              ?branchId=&challanType=Monthly&networkId=
            → data[] : { id, paymentID, dueDate, creationDate, challanType,
                         credit, debit, totalAmount, … }
   Setup:   GET .../api/AHM_School_Payments/summary?branchId=&type=admin
            → data   : { isLumpSum, amount, totalStudents, totalAmount, … }

   networkId natije ko filter nahi karta magar param lazmi hai; challanType
   bhi lazmi. Charges (late surcharge / service charge) in APIs me nahi hain,
   is liye wo screen par static dikhte hain.
   ═══════════════════════════════════════════════════════════════════ */

const day = (v) => String(v || '').slice(0, 10);

/** This branch's billing ledger rows, newest-first. */
export async function getPaymentLedger({ challanType = 'Monthly' } = {}) {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchId) return [];
  const networkId = await fetchBranchNetworkId().catch(() => 0);
  const qs = new URLSearchParams({
    branchId: String(branchId), challanType, networkId: String(networkId || 0),
  });
  const res = await fetch(
    buildSuperAdminUrl(`/api/AHM_School_Payments/get_payment_ledger?${qs.toString()}`),
    { method: 'GET', headers: { Accept: '*/*' } },
  );
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const json = await res.json().catch(() => null);
  const rows = Array.isArray(json?.data) ? json.data : [];
  /* API jo challan de, sab dikhte hain (koi filter / merge nahi — user ki
     hidayat 2026-10-30), chahe challanType "monthly-2026-10" ho ya amount kuch bhi. */
  return rows
    .map((r) => {
      const debit = Number(r.debit) || 0;
      const credit = Number(r.credit) || 0;
      const total = Number(r.totalAmount) || debit;
      const status = total <= 0 || credit >= total ? 'Paid' : 'Overdue';
      return {
        id: r.id,
        paymentID: r.paymentID,
        challanType: r.challanType || 'Monthly',
        issueDate: day(r.creationDate),
        dueDate: day(r.dueDate),
        createdAt: String(r.createdAt || ''),
        debit, credit, total, status,
      };
    })
    /* Sab se taaza challan pehle — wahi top card par aata hai. Pehle
       creationDate; same din ho to jo challan baad me bana (createdAt). */
    .sort((a, b) => {
      const ka = a.issueDate || a.dueDate; const kb = b.issueDate || b.dueDate;
      if (ka !== kb) return ka < kb ? 1 : -1;
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
}

/* Receiving (Super Admin ne jo payment darj ki) — Payment History.
   Primary: GET .../api/AHM_School_Payments/get_payment_receiving?branchId=
            (month/year optional; na bhejo = saare mahine; month=0 → 400)
            → data[] : { id, paymentLedgerID, currentBranchID, month, year,
                         payableAmount, discount, netPayable, receivingAmount,
                         remainingAmount, receivingDate, paymentVia, … }

   Sirf yahi GET (user ki hidayat — manage_payment_receiving yahan NAHI).
   API jo rows de wahi dikhti hain (user ki hidayat, 2026-10-30). NOTE: sandbox
   par GET ka filter backend me ghalat hai — branchId=1 par branch 220997 ki
   receiving aati hai (schoolPaymentID ↔ ledger id join). Theek backend karega. */
export async function getPaymentReceivings() {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchId) return [];
  const res = await fetch(
    buildSuperAdminUrl(`/api/AHM_School_Payments/get_payment_receiving?branchId=${branchId}`),
    { method: 'GET', headers: { Accept: '*/*' } },
  );
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const json = await res.json().catch(() => null);
  return (Array.isArray(json?.data) ? json.data : [])
    .filter((r) => r && r.id)
    .map((r) => ({
      id: r.id,
      ledgerId: r.paymentLedgerID,
      month: Number(r.month) || 0,
      year: Number(r.year) || 0,
      payable: Number(r.payableAmount) || 0,
      discount: Number(r.discount) || 0,
      netPayable: Number(r.netPayable) || 0,
      received: Number(r.receivingAmount) || 0,
      remaining: Number(r.remainingAmount) || 0,
      date: day(r.receivingDate),
      via: r.paymentVia || '—',
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** This branch's subscription payment setup (billing formula / basis). */
export async function getBillingSetup() {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchId) return null;
  try {
    const res = await fetch(
      buildSuperAdminUrl(`/api/AHM_School_Payments/summary?branchId=${branchId}&type=admin`),
      { method: 'GET', headers: { Accept: '*/*' } },
    );
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const d = json?.data;
    if (!d) return null;
    const totalStudents = Number(d.totalStudents) || 0;
    const totalAmount = Number(d.totalAmount) || Number(d.amount) || 0;
    return {
      id: Number(d.id) || 0,              // = ledger row paymentID
      isLumpSum: !!d.isLumpSum,
      amount: Number(d.amount) || 0,
      totalStudents,
      totalAmount,
      perStudent: totalStudents > 0 ? Math.round(totalAmount / totalStudents) : 0,
    };
  } catch {
    return null;
  }
}
