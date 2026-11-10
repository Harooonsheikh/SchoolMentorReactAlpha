import * as dashboardService from '../../services/dashboardService';

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

/* ═════ LIVE — /get-inactive-students-fee API ko card/report ki shape mein badlo ═════ */
const lc = (o) => {
  const out = {};
  if (o && typeof o === 'object') Object.keys(o).forEach((k) => { out[k.toLowerCase()] = o[k]; });
  return out;
};
const numOf = (o, names) => {
  for (const n of names) {
    const v = o[n.toLowerCase()];
    if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
};
const strOf = (o, names) => {
  for (const n of names) {
    const v = o[n.toLowerCase()];
    if (v != null && v !== '') return String(v);
  }
  return '';
};

const F = {
  studentsInactivated:       ['StudentsInactivated', 'TotalInactiveStudents', 'InactiveStudents', 'InactiveStudentCount', 'InactiveCount', 'StudentsAffected'],
  totalFeeAmountExcluded:    ['TotalFeeAmountExcluded', 'TotalFeeExcluded', 'TotalAmountExcluded', 'TotalExcluded', 'TotalFeeImpact', 'NetFeeImpact', 'TotalNetImpact'],
  currentChallanExcluded:    ['CurrentChallanExcluded', 'CurrentMonthChallanExcluded', 'CurrentMonthChallans', 'CurrentMonthChallan', 'CurrentChallan', 'CurrentChallans'],
  previousDuesExcluded:      ['PreviousDuesExcluded', 'PreviousDues', 'PrevDues'],
  feeReceivedExcluded:       ['FeeReceivedExcluded', 'FeeReceived', 'ReceivedAmount'],
  receivingDiscountExcluded: ['ReceivingDiscountExcluded', 'ReceivingDiscount', 'ReceivingDiscounts', 'RecvDiscount'],
  advanceAdjustmentExcluded: ['AdvanceAdjustmentExcluded', 'AdvanceAdjustments', 'AdvanceAdjustment', 'AdvanceAdjusted'],
  unusedAdvanceBalance:      ['UnusedAdvanceBalance', 'UnusedAdvance', 'AdvanceBalance', 'RemainingAdvance'],
  netImpact:                 ['NetFeeImpact', 'NetImpact', 'FeeImpact', 'TotalFeeImpact', 'TotalFeeAmountExcluded'],
};

function findRows(d) {
  if (Array.isArray(d)) return d;
  const o = lc(d);
  for (const k of ['students', 'details', 'rows', 'studentlist', 'studentdetails', 'inactivestudents', 'list', 'records', 'data']) {
    if (Array.isArray(o[k])) return o[k];
  }
  return [];
}
function findSummary(d) {
  if (!d || Array.isArray(d)) return {};
  const o = lc(d);
  for (const k of ['summary', 'totals', 'total', 'feeimpact']) {
    if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) return lc(o[k]);
  }
  return o;
}

export function mapInactiveFeeResponse(d) {
  const rows = findRows(d).map((raw, i) => {
    const r = lc(raw);
    const n = (names) => numOf(r, names) || 0;
    const row = {
      id: strOf(r, ['StudentID', 'StudentId', 'Id', 'RegNo', 'AdmissionNo']) || String(i),
      name: strOf(r, ['StudentName', 'Name', 'FullName']) || '—',
      reg: strOf(r, ['AdmissionNo', 'RegNo', 'RegistrationNo', 'Reg', 'GRNo']) || '—',
      father: strOf(r, ['FatherName', 'Father', 'GuardianName']),
      cls: strOf(r, ['ClassName', 'Class', 'GradeName', 'Grade']) || '—',
      sec: strOf(r, ['SectionName', 'Section']) || '—',
      inactiveDate: strOf(r, ['InactiveDate', 'DeactivationDate', 'InactivatedDate', 'InactiveOn', 'StatusChangeDate']).slice(0, 10) || '—',
      reason: strOf(r, ['InactiveReason', 'Reason', 'Remarks']) || '—',
      currentChallanExcluded:    n(F.currentChallanExcluded),
      previousDuesExcluded:      n(F.previousDuesExcluded),
      feeReceivedExcluded:       n(F.feeReceivedExcluded),
      receivingDiscountExcluded: n(F.receivingDiscountExcluded),
      advanceAdjustmentExcluded: n(F.advanceAdjustmentExcluded),
      unusedAdvanceBalance:      n(F.unusedAdvanceBalance),
    };
    const apiNet = numOf(r, F.netImpact);
    row.netImpact = apiNet != null ? apiNet : Math.max(0,
      row.currentChallanExcluded + row.previousDuesExcluded - row.feeReceivedExcluded
      - row.receivingDiscountExcluded - row.advanceAdjustmentExcluded);
    return row;
  });

  const s = findSummary(d);
  const sum = (key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  const tot = (key) => { const v = numOf(s, F[key]); return v != null ? v : sum(key); };

  const currentChallanExcluded    = tot('currentChallanExcluded');
  const previousDuesExcluded      = tot('previousDuesExcluded');
  const feeReceivedExcluded       = tot('feeReceivedExcluded');
  const receivingDiscountExcluded = tot('receivingDiscountExcluded');
  const advanceAdjustmentExcluded = tot('advanceAdjustmentExcluded');
  const unusedAdvanceBalance      = tot('unusedAdvanceBalance');
  const apiTotal = numOf(s, F.totalFeeAmountExcluded);
  const totalFeeAmountExcluded = apiTotal != null ? apiTotal : Math.max(0,
    currentChallanExcluded + previousDuesExcluded - feeReceivedExcluded
    - receivingDiscountExcluded - advanceAdjustmentExcluded);
  const apiCount = numOf(s, F.studentsInactivated);

  return {
    studentsInactivated: apiCount != null ? apiCount : rows.length,
    totalFeeAmountExcluded,
    currentChallanExcluded, previousDuesExcluded, feeReceivedExcluded,
    receivingDiscountExcluded, advanceAdjustmentExcluded, unusedAdvanceBalance,
    rows: rows.sort((a, b) => b.netImpact - a.netImpact),
  };
}

export const EMPTY_INACTIVE_IMPACT = mapInactiveFeeResponse({});

/* q = { filterType: 'Month'|'FromTo'|'SingleDate', month, year, fromDate, toDate, singleDate } */
export async function loadInactiveFeeImpact(q) {
  const d = await dashboardService.getInactiveStudentsFee(sessionStorage.getItem('branchID'), q);
  // eslint-disable-next-line no-console
  console.log('Inactive Students Fee API:', q, d);
  return mapInactiveFeeResponse(d);
}