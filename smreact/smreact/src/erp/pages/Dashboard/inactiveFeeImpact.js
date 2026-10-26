/* ═══════════════════════════════════════════════════════════════════
   Inactive Students | Fee Impact — computation.

   This card reports the fee impact of students marked as inactive within
   a selected date range. It mirrors the 8 existing Fee Analytics card
   formulas exactly, applying them only to students flagged as inactive.

   The data structure follows the mock example from the source project:
   students have `status: 'inactive'` and `inactiveDate` fields when
   marked inactive through the Students module workflow.
   ═══════════════════════════════════════════════════════════════════ */

export function computeInactiveFeeImpact({
  classes = [], studentsMap = {}, headsMap = {}, discMap = {},
  generatedSet = new Set(), receipts = [], advanceLedger = [],
  monthIdx = 4, from, to,
}) {
  const classesByKey = {};
  classes.forEach((c) => { classesByKey[c.key] = c; });

  /* Find every flagged-inactive student whose inactiveDate falls in the selected range */
  const affected = [];
  classes.forEach((c) => {
    (studentsMap[c.key] || []).forEach((s) => {
      if (s.status !== 'inactive' || !s.inactiveDate) return;
      if (from && s.inactiveDate < from) return;
      if (to && s.inactiveDate > to) return;
      affected.push({ classKey: c.key, cls: c.cls, sec: c.sec, student: s });
    });
  });

  const rows = affected.map(({ classKey, cls, sec, student: s }) => {
    const generated = generatedSet.has(`${classKey}|${s.reg}|${monthIdx}`);
    const discForStudent = discMap[classKey]?.[s.reg];
    const heads = (headsMap[classKey] || []).map((h) => {
      const std = +h.amt || 0;
      const disc = Math.min(+(discForStudent?.[h.name]) || 0, std);
      return { std, disc };
    });
    const headsStd = heads.reduce((a, h) => a + h.std, 0);

    const currentChallanExcluded = generated ? headsStd + (+s.transport > 0 ? +s.transport : 0) : 0;
    const previousDuesExcluded = +s.dues > 0 ? +s.dues : 0;

    const rec = receipts.find((r) => r.classKey === classKey && r.reg === s.reg && r.monthIdx === monthIdx);
    const feeReceivedExcluded = (rec?.payments || []).reduce((a, p) => a + (+p.amount || 0), 0);

    let receivingDiscountExcluded = 0;
    (rec?.payments || []).forEach((p) => {
      Object.values(p.discPerHead || {}).forEach((amt) => { receivingDiscountExcluded += (+amt || 0); });
    });

    const monthStart = `2026-${String(monthIdx + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(2026, monthIdx + 1, 0).toISOString().slice(0, 10);
    const entries = advanceLedger.filter((e) => e.classKey === classKey && e.reg === s.reg);
    const opening = Math.max(0, entries.filter((e) => e.date < monthStart)
      .reduce((sum, e) => sum + (e.type === 'received' ? e.amount : -e.amount), 0));
    const periodEntries = entries.filter((e) => e.date >= monthStart && e.date <= monthEnd);
    const receivedInPeriod = periodEntries.filter((e) => e.type === 'received').reduce((a, e) => a + e.amount, 0);
    const advanceAdjustmentExcluded = periodEntries.filter((e) => e.type === 'adjusted').reduce((a, e) => a + e.amount, 0);
    const unusedAdvanceBalance = Math.max(0, opening + receivedInPeriod - advanceAdjustmentExcluded);

    const netReceivableExcluded = currentChallanExcluded + previousDuesExcluded;
    const netImpact = Math.max(0, netReceivableExcluded - feeReceivedExcluded - receivingDiscountExcluded - advanceAdjustmentExcluded);

    return {
      id: `${classKey}|${s.reg}`,
      reg: s.reg, name: s.name, father: s.father, cls, sec, classKey,
      inactiveDate: s.inactiveDate, reason: s.inactiveReason || '—',
      currentChallanExcluded, previousDuesExcluded, feeReceivedExcluded,
      receivingDiscountExcluded, advanceAdjustmentExcluded, unusedAdvanceBalance,
      netImpact,
    };
  });

  const sum = (key) => rows.reduce((a, r) => a + r[key], 0);
  const currentChallanExcluded = sum('currentChallanExcluded');
  const previousDuesExcluded = sum('previousDuesExcluded');
  const feeReceivedExcluded = sum('feeReceivedExcluded');
  const receivingDiscountExcluded = sum('receivingDiscountExcluded');
  const advanceAdjustmentExcluded = sum('advanceAdjustmentExcluded');
  const unusedAdvanceBalance = sum('unusedAdvanceBalance');

  const netReceivableExcluded = currentChallanExcluded + previousDuesExcluded;
  const totalFeeAmountExcluded = Math.max(0, netReceivableExcluded - feeReceivedExcluded - receivingDiscountExcluded - advanceAdjustmentExcluded);

  return {
    studentsInactivated: rows.length,
    totalFeeAmountExcluded,
    currentChallanExcluded, previousDuesExcluded, feeReceivedExcluded,
    receivingDiscountExcluded, advanceAdjustmentExcluded, unusedAdvanceBalance,
    rows: rows.sort((a, b) => b.netImpact - a.netImpact),
  };
}
