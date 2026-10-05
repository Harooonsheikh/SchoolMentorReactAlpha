/* ═══════════════════════════════════════════════════════════════════
   Fee Analytics — LIVE producer.

   Builds the SAME `feeExtras` shape the dashboard's charts / highlight
   strip / detail cards / report builders already consume, but computed
   from the BranchLedger data using the EXACT functions the Fee → Reports
   panels use (`ledgerModel` via `useLedgerReportData`, plus
   `ledgerPendingAsOf` and `ledgerAdvanceEvents`), all imported from
   Fee.jsx. Because both the dashboard and the Fee reports now run the
   identical code over the identical `/api/BranchLedger/get-with-installments`
   data, every dashboard fee number equals its Fee report — no drift.

   Aggregate mapping (matches Fee → Reports → Defaulter / Collections /
   Summary / Discount Given / Advance):
     netReceivableTotal   = Σ m.payable      (Expected / Net Receivable)
     currentMonthTotal    = Σ m.currBilled   (this period's new bill)
     previousDuesTotal    = Σ m.prevDues     (opening carry)
     receivedTotal        = Σ m.paid         (Total Received)
     discountTotal        = Σ m.disc         (Discount Given)
     pendingTotal         = Σ m.remaining    (Total Outstanding)
     studentsWithDues     = #(m.remaining>0) (Defaulters)
   Advance received / advance adjustments mirror ReportPanelAdvanceFee /
   ReportPanelAdvanceAdjustment respectively.
   ═══════════════════════════════════════════════════════════════════ */
import { ledgerPendingAsOf, ledgerAdvanceEvents } from '../../components/Fee';

const round = (n) => Math.round(Number(n) || 0);

export function computeFeeExtrasFromLedger(allStudents, { month, year, previousMonthOutstanding = null } = {}) {
  const rows = Array.isArray(allStudents) ? allStudents : [];
  const mm = String(month).padStart(2, '0');
  const monthStartISO = `${year}-${mm}-01`;
  const monthEndISO = (() => {
    const d = new Date(Number(year), Number(month), 0); // 0 => last day of `month`
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  let currentMonthTotal = 0, previousDuesTotal = 0, netReceivableTotal = 0;
  let receivedTotal = 0, discountTotal = 0, pendingTotal = 0;
  let challansGenerated = 0, studentsWithDues = 0, receivedStudentCount = 0;
  let advanceTotal = 0, advanceStudentCount = 0;
  let advanceAdjustmentTotal = 0, advanceAdjustmentStudentCount = 0;
  const receivedRows = [], discountRows = [], advanceRows = [], advanceAdjustmentRows = [];
  /* Discount Given During Receiving REPORT — sirf receiving ke waqt di gayi discount
     (installment ka recvDiscount), Discount Manager wala challan discount nahi. Card ki
     raqam get-dashboard ke ReceivedDiscount se aati hai; report isi ke students dikhati hai. */
  const receivingDiscountRows = [];

  rows.forEach(({ c = {}, s = {}, m }) => {
    if (!m || !m.billed) return; // billed students only — same as report totals
    challansGenerated += 1;
    netReceivableTotal += m.payable;
    previousDuesTotal  += (m.prevDues || 0);
    currentMonthTotal  += (m.currBilled != null ? m.currBilled : Math.max(0, m.payable - (m.prevDues || 0)));
    receivedTotal      += m.paid;
    discountTotal      += m.disc;
    pendingTotal       += m.remaining;
    if (m.remaining > 0) studentsWithDues += 1;

    if (m.paid > 0) {
      receivedStudentCount += 1;
      receivedRows.push({
        reg: s.reg, studentName: s.name, cls: c.cls, sec: c.sec,
        amount: round(m.paid), method: '—', receivedBy: '—', date: '', time: '',
      });
    }

    (m.heads || []).forEach((h) => {
      if ((h.disc || 0) > 0) {
        discountRows.push({
          reg: s.reg, studentName: s.name, cls: c.cls, sec: c.sec,
          head: h.sub || h.head, original: round(h.total), discountGiven: round(h.disc),
          finalPayable: Math.max(0, round(h.total - h.disc)), givenBy: '—', date: '', time: '',
        });
      }
    });

    (m.recs || []).forEach((rec) => (rec.detailRows || []).forEach((r) => {
      const give = (row) => Math.max(0, round(row.recvDiscount));
      const insts = Array.isArray(r.installments) ? r.installments.filter((i) => give(i) > 0) : [];
      const head = r.subHead || r.head || '—';
      const original = round(r.challanAmount);
      const finalPayable = Math.max(0, round((Number(r.challanAmount) || 0) - (Number(r.discount) || 0)));
      const push = (amt, inst) => receivingDiscountRows.push({
        reg: s.reg, studentName: s.name, cls: c.cls, sec: c.sec,
        head, original, discountGiven: amt, finalPayable,
        givenBy: '—',
        date: String((inst && inst.receivedDate) || rec.receivedDate || '').slice(0, 10),
        time: String((inst && (inst.modifiedAt || inst.createdAt)) || '').slice(11, 16),
      });
      if (insts.length) insts.forEach((i) => push(give(i), i));
      else if (give(r) > 0) push(give(r), null);
    }));

    /* Advance Payments Received — mirror ReportPanelAdvanceFee: negative net
       across all heads = carried-forward credit. */
    let net = 0;
    try { ledgerPendingAsOf(m.recs, 999999, '9999-12-31').forEach((v) => { net += v; }); } catch { /* ignore */ }
    const adv = Math.max(0, -round(net));
    if (adv > 0) {
      advanceTotal += adv; advanceStudentCount += 1;
      advanceRows.push({
        reg: s.reg, studentName: s.name, cls: c.cls, sec: c.sec,
        currentChallanAmount: round(m.payable), amountReceived: round(m.paid),
        advanceAmount: adv, method: '—', receivedBy: '—', date: '', time: '',
      });
    }

    /* Advance Adjustments — mirror ReportPanelAdvanceAdjustment over the
       selected month: adj-type events whose date falls inside the month. */
    let events = [];
    try { events = (ledgerAdvanceEvents(m.recs) || {}).events || []; } catch { /* ignore */ }
    const opening = events.reduce((a, e) => {
      if (!e.date) return a + (e.type === 'recv' ? e.amount : 0);      // undated opening credit
      return e.date < monthStartISO ? a + (e.type === 'recv' ? e.amount : -e.amount) : a;
    }, 0);
    const inMonth = events.filter((e) => e.date && e.date >= monthStartISO && e.date <= monthEndISO);
    const recvIn = inMonth.filter((e) => e.type === 'recv').reduce((a, e) => a + e.amount, 0);
    const adjIn  = inMonth.filter((e) => e.type === 'adj').reduce((a, e) => a + e.amount, 0);
    if (adjIn > 0) {
      advanceAdjustmentTotal += round(adjIn); advanceAdjustmentStudentCount += 1;
      advanceAdjustmentRows.push({
        reg: s.reg, studentName: s.name, cls: c.cls, sec: c.sec,
        previousAdvanceBalance: Math.max(0, round(opening)), adjustedAmount: round(adjIn),
        remainingAdvanceBalance: Math.max(0, round(opening + recvIn - adjIn)), adjustmentDate: monthEndISO,
      });
    }
  });

  const totalStudents = rows.length;
  /* Previous Dues override — when a previous-month outstanding is supplied
     (dashboard spec: Previous Dues = Monthly Fee Defaulter Total Outstanding
     of current month − 1), use it and recompute Net Receivable = Current Month
     + Previous Dues so the Overview chart identity still holds. */
  const prevDuesFinal = (previousMonthOutstanding != null)
    ? Math.max(0, round(previousMonthOutstanding))
    : round(previousDuesTotal);
  const netFinal = (previousMonthOutstanding != null)
    ? (round(currentMonthTotal) + prevDuesFinal)
    : round(netReceivableTotal);
  /* Pending Fee — derived from the card's own formula so the card always
     reconciles with the numbers it shows:
       Pending = Net Receivable − Fee Received − Receiving Discount − Advance Adjustments
     (same definition as feeDashboardExtra.js's source model). */
  const pendingFinal = Math.max(
    0,
    round(netFinal) - round(receivedTotal) - round(discountTotal) - round(advanceAdjustmentTotal),
  );
  const receivedPct = netFinal > 0 ? Math.round((receivedTotal / netFinal) * 100) : 0;
  const pendingPct  = netFinal > 0 ? Math.round((pendingFinal / netFinal) * 100) : 0;
  const discountStudentCount = new Set(discountRows.map((r) => r.reg)).size;
  const receivingDiscountTotal = receivingDiscountRows.reduce((a, r) => a + r.discountGiven, 0);
  const receivingDiscountStudentCount = new Set(receivingDiscountRows.map((r) => r.reg)).size;

  return {
    currentMonthTotal: round(currentMonthTotal), challansGenerated, totalStudents,
    previousDuesTotal: prevDuesFinal, studentsWithDues,
    netReceivableTotal: netFinal,
    receivedRows, receivedTotal: round(receivedTotal), receivedStudentCount, receivedPct,
    discountRows, discountTotal: round(discountTotal), discountStudentCount,
    receivingDiscountRows, receivingDiscountTotal: round(receivingDiscountTotal), receivingDiscountStudentCount,
    advanceRows, advanceTotal: round(advanceTotal), advanceStudentCount,
    advanceAdjustmentRows, advanceAdjustmentTotal: round(advanceAdjustmentTotal), advanceAdjustmentStudentCount,
    pendingTotal: pendingFinal, pendingPct,
  };
}
