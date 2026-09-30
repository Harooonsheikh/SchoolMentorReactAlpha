/* ═══════════════════════════════════════════════════════════════════
   Fee Analytics dashboard — "Discount Given During Receiving" and
   "Advance Payments Received" cards.

   Pure computation only (no hooks) so it's easy to call from a
   useMemo in AdminDashboard.jsx. Reads the SAME feeService data every
   other Fee report already reads (getFeeClasses / getTransportFee /
   getFeeHeads / getFeeDiscounts / getGeneratedChallans / getReceipts)
   — no new data fields, no change to any existing Fee write API.

   Both figures are deliberately distinct from the two existing Fee →
   Reports panels that sound similar:
   - "Discount Given Report" (Fee.jsx ReportPanelDiscountGiven) reports
     the APPROVED challan-level discount (feeService.getFeeDiscounts),
     baked into the challan before it's ever paid.
   - This card instead reports discretionary discount given AT THE FEE
     COUNTER while receiving a payment — payments[].discPerHead.
   - "Advance Fee Payment Report" (Fee.jsx ReportPanelAdvanceFee)
     reports the static, pre-existing `student.advance` carried-
     forward credit field.
   - This card instead reports payments received THIS MONTH that
     exceed what was actually payable this month — an amount derived
     from the ledger itself (payments[].amount vs. the same payable
     formula Fee Receiving already uses), not the static field.
   ═══════════════════════════════════════════════════════════════════ */

/* Mirrors Fee.jsx's own `receivedBy` helper (ReportPanel* / FeeReceivingTab) —
   explicit on the payment, otherwise derived from its source. */
function receivedByLabel(p) {
  if (!p) return '—';
  if (p.by) return p.by;
  if (p.source === 'onelink' || p.source === 'bank') return 'OneLink / Bank';
  return 'Front Desk';
}

/* discMap: { [classKey]: { [reg]: { [head]: amount } } } — approved,
   challan-level discount, built once from feeService.getFeeDiscounts(). */
export function buildDiscountMap(discountRows) {
  const map = {};
  (discountRows || []).forEach((d) => {
    const c = (map[d.classKey] ||= {});
    const s = (c[d.reg] ||= {});
    s[d.head] = (+d.amount || 0);
  });
  return map;
}

export function computeFeeDashboardExtras({
  classes = [], studentsMap = {}, headsMap = {}, discMap = {},
  generatedSet = new Set(), receipts = [], advanceLedger = [], monthIdx = 4,
}) {
  const classesByKey = {};
  classes.forEach((c) => { classesByKey[c.key] = c; });

  const studentLookup = {};
  classes.forEach((c) => (studentsMap[c.key] || []).forEach((s) => {
    studentLookup[`${c.key}|${s.reg}`] = s;
  }));

  /* ── Card 6 — Discount Given During Receiving ──
     One row per (payment × fee head) where a receiving-time discount
     was granted, sourced straight from payments[].discPerHead. */
  const discountRows = [];
  receipts.forEach((rec) => {
    if (rec.monthIdx !== monthIdx) return;
    const s = studentLookup[`${rec.classKey}|${rec.reg}`];
    if (!s) return;
    (rec.payments || []).forEach((p) => {
      Object.entries(p.discPerHead || {}).forEach(([head, amt]) => {
        const given = +amt || 0;
        if (given <= 0) return;
        const original = (headsMap[rec.classKey] || []).find((h) => h.name === head)?.amt || 0;
        discountRows.push({
          reg: rec.reg,
          studentName: s.name,
          cls: classesByKey[rec.classKey]?.cls || rec.classKey,
          sec: classesByKey[rec.classKey]?.sec || '',
          head,
          original,
          discountGiven: given,
          finalPayable: Math.max(0, original - given),
          givenBy: receivedByLabel(p),
          date: p.date || '—',
          time: p.time || '—',
        });
      });
    });
  });
  const discountTotal = discountRows.reduce((a, r) => a + r.discountGiven, 0);
  const discountStudentCount = new Set(discountRows.map((r) => r.reg)).size;

  /* ── Card 7 — Advance Payments Received ──
     Per student this month: payable via the same formula Fee
     Receiving itself uses (prev dues + this month's heads − approved
     discount − existing static advance credit), vs. what was actually
     paid. Anything paid beyond payable is this month's new advance. */
  const advanceRows = [];
  classes.forEach((c) => {
    (studentsMap[c.key] || []).forEach((s) => {
      const generated = generatedSet.has(`${c.key}|${s.reg}|${monthIdx}`);
      const discForStudent = discMap[c.key]?.[s.reg];
      const heads = (headsMap[c.key] || []).map((h) => {
        const std = +h.amt || 0;
        const disc = Math.min(+(discForStudent?.[h.name]) || 0, std);
        return { std, disc };
      });
      if (generated && +s.transport > 0) heads.push({ std: +s.transport, disc: 0 });

      const prev = +s.dues || 0;
      const staticAdvance = +s.advance || 0;
      const thisMonth = generated ? heads.reduce((a, h) => a + h.std, 0) : 0;
      const discBaked = generated ? heads.reduce((a, h) => a + h.disc, 0) : 0;
      const payable = Math.max(0, prev + thisMonth - discBaked - staticAdvance);

      const rec = receipts.find((r) => r.classKey === c.key && r.reg === s.reg && r.monthIdx === monthIdx);
      const payments = rec?.payments || [];
      if (!payments.length) return;
      const paid = payments.reduce((a, p) => a + (+p.amount || 0), 0);
      if (paid <= payable) return;

      const last = payments[payments.length - 1];
      advanceRows.push({
        reg: s.reg,
        studentName: s.name,
        cls: c.cls,
        sec: c.sec,
        currentChallanAmount: payable,
        amountReceived: paid,
        advanceAmount: paid - payable,
        method: last?.method || '—',
        receivedBy: receivedByLabel(last),
        date: last?.date || '—',
        time: last?.time || '—',
      });
    });
  });
  const advanceTotal = advanceRows.reduce((a, r) => a + r.advanceAmount, 0);
  const advanceStudentCount = advanceRows.length;

  /* ── Cards 1-3 — Current Month Fee Position / Previous Dues / Net
     Receivable, live for the selected month. "Previous Dues" reads
     student.dues, which isn't month-indexed in this data model, so it
     is naturally the same figure regardless of which month is picked
     — that's expected, not a bug: it's a single carried-forward
     balance, not a per-month ledger. */
  let currentMonthTotal = 0, challansGenerated = 0, totalStudents = 0;
  let previousDuesTotal = 0, studentsWithDues = 0;
  classes.forEach((c) => {
    (studentsMap[c.key] || []).forEach((s) => {
      totalStudents += 1;
      if (generatedSet.has(`${c.key}|${s.reg}|${monthIdx}`)) {
        challansGenerated += 1;
        const headsStd = (headsMap[c.key] || []).reduce((a, h) => a + (+h.amt || 0), 0);
        currentMonthTotal += headsStd + (+s.transport > 0 ? +s.transport : 0);
      }
      const dues = +s.dues || 0;
      if (dues > 0) { previousDuesTotal += dues; studentsWithDues += 1; }
    });
  });
  const netReceivableTotal = currentMonthTotal + previousDuesTotal;

  /* ── Card 4 — Fee Received, live for the selected month. Every
     payment regardless of source (counter / onelink / bank) — the
     OneLink-only breakdown already exists as its own dashboard card. */
  const receivedRows = [];
  receipts.forEach((rec) => {
    if (rec.monthIdx !== monthIdx) return;
    const s = studentLookup[`${rec.classKey}|${rec.reg}`];
    if (!s) return;
    (rec.payments || []).forEach((p) => {
      receivedRows.push({
        reg: rec.reg,
        studentName: s.name,
        cls: classesByKey[rec.classKey]?.cls || rec.classKey,
        sec: classesByKey[rec.classKey]?.sec || '',
        amount: +p.amount || 0,
        method: p.method || '—',
        receivedBy: receivedByLabel(p),
        date: p.date || '—',
        time: p.time || '—',
      });
    });
  });
  const receivedTotal = receivedRows.reduce((a, r) => a + r.amount, 0);
  const receivedStudentCount = new Set(receivedRows.map((r) => r.reg)).size;

  /* ── Card 6.5 — Advance Adjustments ──
     The OPPOSITE movement from Card 6 above: real advance-balance
     CONSUMPTION this month, not new advance being created. Mirrors
     Fee.jsx's own `buildAdvanceAdjustmentData` (behind the "Advance
     Fee Adjustment Report" in Fee → Reports) — built from
     mockAdvanceLedger's 'adjusted' entries, which feeService.
     generateChallan() writes whenever a student's static advance
     balance is applied against a newly generated challan. This is
     deliberately NOT the same figure as `advanceRows`/`advanceTotal`
     above (Card 6, which tracks NEW advance created by overpaying
     this month) — a student can appear in one, the other, both, or
     neither in the same month. Unlike Card 6, this total IS subtracted
     from Pending Fee below, since it's real credit being applied
     against what's owed, not a parallel balance sitting untouched. */
  const monthStart = `2026-${String(monthIdx + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(2026, monthIdx + 1, 0).toISOString().slice(0, 10);
  const advanceAdjustmentRows = [];
  classes.forEach((c) => {
    (studentsMap[c.key] || []).forEach((s) => {
      const entries = advanceLedger.filter((e) => e.classKey === c.key && e.reg === s.reg);
      const opening = Math.max(0, entries
        .filter((e) => e.date < monthStart)
        .reduce((sum, e) => sum + (e.type === 'received' ? e.amount : -e.amount), 0));
      const periodEntries = entries.filter((e) => e.date >= monthStart && e.date <= monthEnd);
      const receivedInPeriod = periodEntries.filter((e) => e.type === 'received').reduce((a, e) => a + e.amount, 0);
      const adjustedEntries = periodEntries.filter((e) => e.type === 'adjusted');
      const adjustedAmount = adjustedEntries.reduce((a, e) => a + e.amount, 0);
      if (adjustedAmount <= 0) return;
      const remainingAdvanceBalance = Math.max(0, opening + receivedInPeriod - adjustedAmount);
      const adjustmentDate = adjustedEntries.reduce((max, e) => (e.date > max ? e.date : max), adjustedEntries[0].date);
      advanceAdjustmentRows.push({
        reg: s.reg,
        studentName: s.name,
        cls: c.cls,
        sec: c.sec,
        previousAdvanceBalance: opening,
        adjustedAmount,
        remainingAdvanceBalance,
        adjustmentDate,
      });
    });
  });
  const advanceAdjustmentTotal = advanceAdjustmentRows.reduce((a, r) => a + r.adjustedAmount, 0);
  const advanceAdjustmentStudentCount = advanceAdjustmentRows.length;

  /* ── Card 7 — Pending Fee, the final outcome. Advance PAYMENTS
     RECEIVED (Card 6) are deliberately NOT subtracted — see
     feeAnalyticsHelpData.js's `pending` entry — but Advance
     ADJUSTMENTS (above) are: that's real credit already applied
     against this month's challans, not cash still owed. */
  const pendingTotal = Math.max(0, netReceivableTotal - receivedTotal - discountTotal - advanceAdjustmentTotal);
  const pendingPct = netReceivableTotal > 0 ? Math.round((pendingTotal / netReceivableTotal) * 100) : 0;
  const receivedPct = netReceivableTotal > 0 ? Math.round((receivedTotal / netReceivableTotal) * 100) : 0;

  return {
    currentMonthTotal, challansGenerated, totalStudents,
    previousDuesTotal, studentsWithDues,
    netReceivableTotal,
    receivedRows, receivedTotal, receivedStudentCount, receivedPct,
    discountRows, discountTotal, discountStudentCount,
    advanceRows, advanceTotal, advanceStudentCount,
    advanceAdjustmentRows, advanceAdjustmentTotal, advanceAdjustmentStudentCount,
    pendingTotal, pendingPct,
  };
}
