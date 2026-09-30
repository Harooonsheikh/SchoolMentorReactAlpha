import {
  mockFeeClasses,
  mockFeeHeads,
  mockTransportFee,
  mockFeeSettings,
  mockChallans,
  mockPartialChallans,
  mockReceipts,
  mockFeeHistory,
  mockGeneratedChallans,
  mockFamilies,
  mockGeneratedFamilyChallans,
  mockFamilyReceipts,
  mockVehicles,
  mockFeeDiscounts,
  mockAdvanceLedger,
} from '../mock/fee';
import { delay, clone } from './_http';
/* Double Entry automation — when a school is on the Double Entry
   Accounts system, every fee installment recorded here should also
   post a balanced Receipt Voucher (Dr Cash/Bank, Cr Fee Income). This
   is a write-side sibling to Accounts.jsx's existing read-only reuse
   of hrService (cross-module service imports are already an
   established pattern in this codebase). Fire-and-forget + swallow
   errors, same as every other saveReceipt() persistence call below —
   a Double Entry posting failure must never block a fee receipt. */
import { postFeeReceipt } from './doubleEntryAccountsService';

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getFeeClasses()   { await delay(); return clone(mockFeeClasses); }
export async function getFeeHeads()     { await delay(); return clone(mockFeeHeads); }
export async function getTransportFee() { await delay(); return clone(mockTransportFee); }
export async function getFeeSettings()  { await delay(); return clone(mockFeeSettings); }
export async function getChallans()     { await delay(); return clone(mockChallans); }
export async function getReceipts()     { await delay(); return clone(mockReceipts); }
export async function getFeeHistory()   { await delay(); return clone(mockFeeHistory); }
export async function getAdvanceLedger() { await delay(); return clone(mockAdvanceLedger); }

/* Approved student-specific discounts — one row per (classKey, reg, head).
   Empty until a Fee Discount approval request is approved (see
   applyApprovedDiscount below). */
export async function getFeeDiscounts() { await delay(); return clone(mockFeeDiscounts); }

/* Generated-challans set is returned as a fresh Set so callers can
   add / delete locally without disturbing the seed. */
export async function getGeneratedChallans() {
  await delay();
  return new Set(mockGeneratedChallans);
}

/* Family-tree challan readers. */
export async function getFamilies() { await delay(); return clone(mockFamilies); }
export async function getGeneratedFamilyChallans() {
  await delay();
  return new Set(mockGeneratedFamilyChallans);
}

/* Transport vehicle fleet — read/write for the Transport Fee Setup
   "Vehicles" sub-tab. */
export async function getVehicles() { await delay(); return clone(mockVehicles); }
export async function saveVehicle(vehicle) {
  await delay();
  return clone({ id: vehicle.id || `veh-${Date.now()}`, ...vehicle });
}
export async function deleteVehicle(id) {
  await delay();
  return { id, deleted: true };
}

/* Write APIs — in-memory only until backend wires real endpoints. */
export async function saveFeeHeads(classKey, heads) {
  await delay();
  mockFeeHeads[classKey] = heads.map(h => ({ ...h }));
  return clone(mockFeeHeads[classKey]);
}
export async function saveTransportFee(classKey, rows) { await delay(); return clone({ classKey, rows }); }
export async function saveStudentTransport(classKey, reg, payload) { await delay(); return clone({ classKey, reg, ...payload }); }
/* Mutates the actual mockFeeSettings binding (same "exported binding
   IS the database" convention as saveReceipt/generateChallan above) —
   every other caller of getFeeSettings() across the Fee Module (Fee
   Challans, Fee Receiving, Reports, Family Tree — each fetches its own
   copy on mount) needs to see a saved change, not just this settings
   screen's own local state. */
export async function saveFeeSettings(payload) {
  await delay();
  Object.assign(mockFeeSettings, payload);
  return clone(mockFeeSettings);
}
const ADV_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* 'YYYY-MM-DD' → "Month YYYY", parsed manually (no Date() construction)
   to avoid timezone-shift-by-a-day bugs. */
function monthLabelFromISODate(iso) {
  const [y, m] = String(iso || '').split('-');
  const idx = (+m || 1) - 1;
  return `${ADV_MONTH_NAMES[idx] || ADV_MONTH_NAMES[0]} ${y || ''}`.trim();
}

/* Generates challans AND — the real behavior the business rule
   describes — auto-adjusts any existing advance balance against this
   month's fee, same formula ReportPanelAdvanceFee/recStudentModel
   already use for "this month's fee" (sum of the class's Fee Heads +
   transport). Real mutation of mockTransportFee (same "exported
   binding IS the database" convention as saveFeeHeads/saveReceipt)
   plus a mockAdvanceLedger 'adjusted' entry per student actually
   adjusted, so it's a real, reportable event — not just the live,
   never-persisted subtraction recStudentModel's `payable` formula
   already did on every render. */
export async function generateChallan(classKey, regs, monthIdx, options) {
  await delay();
  /* Fee Settings → Future Month Challan Printing. Same rule the UI
     (BulkGenerateModal / whole-school generate) already blocks on —
     re-checked here so this holds even if a future caller bypasses
     the UI gate. No year dimension for challans in this app (see
     Fee.jsx's CURRENT_MONTH_IDX comment), so "future" is purely the
     calendar month. */
  if (mockFeeSettings.futureMonthChallan === false && (+monthIdx) > new Date().getMonth()) {
    throw new Error('Future Month Challan Printing is disabled in Fee Settings.');
  }
  const regList = Array.isArray(regs) ? regs : [regs];
  const students = mockTransportFee[classKey] || [];
  const headsTotal = (mockFeeHeads[classKey] || []).reduce((a, h) => a + (+h.amt || 0), 0);
  const issueDate = options?.issueDate || new Date().toISOString().slice(0, 10);
  const monthLabel = monthLabelFromISODate(issueDate);
  const adjustments = [];
  regList.forEach(reg => {
    const student = students.find(s => s.reg === reg);
    if (!student) return;
    const monthlyFee = headsTotal + (+student.transport || 0);
    const advance = +student.advance || 0;
    if (advance > 0 && monthlyFee > 0) {
      const adjusted = Math.min(advance, monthlyFee);
      student.advance = advance - adjusted;
      mockAdvanceLedger.push({
        id: `adv-${Date.now()}-${reg}`,
        classKey, reg, type: 'adjusted', amount: adjusted,
        date: issueDate, note: `${monthLabel} Challan`,
      });
      adjustments.push({ reg, adjusted });
    }
  });
  return clone({ classKey, regs: regList, monthIdx, ...options, adjustments });
}
export async function deleteChallan(classKey, reg, monthIdx) {
  await delay();
  return { classKey, reg, monthIdx, deleted: true };
}
export async function deleteClassChallans(classKey, monthIdx) {
  await delay();
  return { classKey, monthIdx, cleared: true };
}
export async function generateFamilyChallan(famKey, regs, monthIdx, options) {
  await delay();
  return clone({ famKey, regs, monthIdx, ...options });
}
export async function deleteFamilyChallan(famKey, reg, monthIdx) {
  await delay();
  return { famKey, reg, monthIdx, deleted: true };
}
export async function removeFamilyChild(famKey, reg) {
  await delay();
  return { famKey, reg, removed: true };
}

/* Fee Receiving APIs — mockReceipts is the real "database" (same
   mutable-binding convention as every other write API in this app):
   one record per (classKey, reg, monthIdx), holding an ever-growing
   `payments` array. Every caller (Fee Receiving, Fee History, every
   Report panel) reads via getReceipts(), so persisting here is what
   makes a newly-received installment show up consistently everywhere
   instead of only inside the tab that received it.
   `advanceGenerated` (optional, defaults to 0 — existing callers that
   don't pass it are unaffected) is the overpayment amount
   FeeReceivingModal already computes and shows as a "+advance" tag
   when Pay Now exceeds what's owed for a head; this is what actually
   persists that into student.advance + a mockAdvanceLedger 'received'
   entry, instead of it being a display-only number as before.
   `advanceConsumed` (optional, defaults to 0) is the OPPOSITE
   movement — FeeReceivingModal's "Adjust From Advance Balance"
   checkbox, an explicit, separate transaction (never combined with
   advanceGenerated in the same call) that spends down an EXISTING
   advance balance against this challan. Reuses the exact same
   mockAdvanceLedger 'adjusted' entry shape generateChallan() already
   writes when auto-adjusting advance at challan-generation time, so
   both flow into the same Advance Fee Adjustment Report. */
export async function saveReceipt({ classKey, reg, monthIdx, payment, advanceGenerated = 0, advanceConsumed = 0 }) {
  await delay();
  let rec = mockReceipts.find(r => r.classKey === classKey && r.reg === reg && r.monthIdx === monthIdx);
  /* Fee Settings → Multiple Receiving / Advance Payment Receiving.
     Same rules FeeReceivingModal already blocks on in the UI —
     re-checked here as a defensive backstop. */
  if (mockFeeSettings.multipleReceiving === false && rec && rec.payments.length >= 1) {
    throw new Error('Multiple Receiving is disabled in Fee Settings.');
  }
  if (mockFeeSettings.advancePaymentReceiving === false && (advanceGenerated > 0 || advanceConsumed > 0)) {
    throw new Error('Advance Payment Receiving is disabled in Fee Settings.');
  }
  if (!rec) { rec = { classKey, reg, monthIdx, payments: [] }; mockReceipts.push(rec); }
  rec.payments.push(payment);
  if (advanceGenerated > 0) {
    const student = (mockTransportFee[classKey] || []).find(s => s.reg === reg);
    if (student) {
      student.advance = (+student.advance || 0) + advanceGenerated;
      mockAdvanceLedger.push({
        id: `adv-${Date.now()}-${reg}`,
        classKey, reg, type: 'received', amount: advanceGenerated,
        date: payment.date, note: 'Overpayment recorded as advance',
      });
    }
  }
  if (advanceConsumed > 0) {
    const student = (mockTransportFee[classKey] || []).find(s => s.reg === reg);
    if (student) {
      student.advance = Math.max(0, (+student.advance || 0) - advanceConsumed);
      mockAdvanceLedger.push({
        id: `adv-${Date.now()}-${reg}`,
        classKey, reg, type: 'adjusted', amount: advanceConsumed,
        date: payment.date, note: 'Adjusted during Fee Receiving',
      });
    }
  }
  postFeeReceipt({ amount: payment.amount, method: payment.method, date: payment.date, reg, classKey }).catch(() => {});
  return clone(payment);
}

/* ── OneLink Partial Payment Challans ──────────────────────────────────
   A parent can request a challan for LESS than their full remaining
   balance, paid through OneLink's PSID flow — see mock/fee.js's
   mockPartialChallans header comment. This never touches the regular
   monthly challan (mockFeeHeads / mockGeneratedChallans, this app's
   only real challan source of truth); it's purely additive tracking
   alongside it. `computeChallanTotals` mirrors the exact payable
   formula Fee.jsx's own recStudentModel() uses (assumes the regular
   challan is already generated, same precondition the UI gates the
   "Generate Partial Payment Challan" icon on), so this feature's
   totals always agree with what the Fee Challans / Fee Receiving tabs
   already show. */
function computeChallanTotals({ classKey, reg, monthIdx }) {
  const student = (mockTransportFee[classKey] || []).find(s => s.reg === reg);
  const heads = mockFeeHeads[classKey] || [];
  const discByHead = {};
  mockFeeDiscounts
    .filter(d => d.classKey === classKey && d.reg === reg)
    .forEach(d => { discByHead[d.head] = +d.amount || 0; });
  const headsNet = heads.reduce((a, h) => a + Math.max(0, (+h.amt || 0) - (discByHead[h.name] || 0)), 0);
  const transport = +(student?.transport) || 0;
  const prev = +(student?.dues) || 0;
  const advance = +(student?.advance) || 0;
  const totalAmount = Math.max(0, prev + headsNet + transport - advance);

  const rec = mockReceipts.find(r => r.classKey === classKey && r.reg === reg && r.monthIdx === monthIdx);
  const receivedAmount = (rec?.payments || []).reduce((a, p) => a + (+p.amount || 0), 0);
  const remainingAmount = Math.max(0, totalAmount - receivedAmount);
  return { totalAmount, receivedAmount, remainingAmount };
}

export async function getPartialChallans() { await delay(); return clone(mockPartialChallans); }

export async function getChallanSummary({ classKey, reg, monthIdx }) {
  await delay();
  const { totalAmount, receivedAmount, remainingAmount } = computeChallanTotals({ classKey, reg, monthIdx });
  const partialPayments = mockPartialChallans.filter(pc => pc.classKey === classKey && pc.reg === reg && pc.monthIdx === monthIdx);
  return clone({
    original_challan_id: `CH-${classKey}-${reg}-${monthIdx}`,
    student_id: reg,
    total_amount: totalAmount,
    received_amount: receivedAmount,
    remaining_amount: remainingAmount,
    partial_payments: partialPayments,
  });
}

export async function generatePartialChallan({ classKey, reg, monthIdx, amount }) {
  await delay();
  /* Fee Settings → PSID Installment Payments. Same rule the row's
     action-button icon already blocks on in the UI — re-checked here
     as a defensive backstop. */
  if (mockFeeSettings.psidInstallments === false) {
    throw new Error('PSID Installment Payments is disabled in Fee Settings.');
  }
  const amt = +amount || 0;
  if (amt <= 0) throw new Error('Partial payment amount must be greater than zero.');
  const { remainingAmount } = computeChallanTotals({ classKey, reg, monthIdx });
  if (amt > remainingAmount) throw new Error('Partial payment amount cannot exceed the remaining challan balance.');

  const partial = {
    id: `pch-${Date.now()}`,
    psid: `OL-${String(500000 + mockPartialChallans.length + 1)}`,
    classKey, reg, monthIdx,
    originalChallanId: `CH-${classKey}-${reg}-${monthIdx}`,
    amount: amt,
    status: 'pending',
    generatedAt: new Date().toISOString(),
    paidAt: null,
  };
  mockPartialChallans.push(partial);
  return clone(partial);
}

/* Payment status for a partial challan is READ-ONLY from the frontend's
   perspective — there is no manual "Mark as Paid" action. In a real
   deployment, OneLink's payment callback/reconciliation process is what
   flips mockPartialChallans[].status to 'paid' (and would write the
   matching installment into mockReceipts via saveReceipt(), tagged
   source:'onelink', exactly the way every other Fee Receiving payment
   is recorded). This mock app has no real payment gateway/webhook to
   drive that, so partial challans simply stay 'pending' until backend
   integration exists — the UI must never simulate/force a paid state. */

/* Deletes ONE temporary partial challan only — never the original
   monthly challan, its amount, prior Fee Receiving, or any other
   partial challan. Blocked once a challan is paid (defense in depth;
   the UI also disables the delete action in that case). */
export async function deletePartialChallan({ id }) {
  await delay();
  const idx = mockPartialChallans.findIndex(pc => pc.id === id);
  if (idx === -1) throw new Error('Partial challan not found.');
  if (mockPartialChallans[idx].status === 'paid') throw new Error('Paid challans cannot be deleted.');
  const [removed] = mockPartialChallans.splice(idx, 1);
  return clone(removed);
}

/* Edits ONE installment in place — never merges/overwrites siblings. */
export async function updateReceiptPayment({ classKey, reg, monthIdx, paymentId, patch }) {
  await delay();
  const rec = mockReceipts.find(r => r.classKey === classKey && r.reg === reg && r.monthIdx === monthIdx);
  const p = rec?.payments.find(x => x.id === paymentId);
  if (!p) return null;
  Object.assign(p, patch);
  return clone(p);
}
export async function deleteReceiptPayment({ classKey, reg, monthIdx, paymentId }) {
  await delay();
  const rec = mockReceipts.find(r => r.classKey === classKey && r.reg === reg && r.monthIdx === monthIdx);
  if (!rec) return { deleted: false };
  rec.payments = rec.payments.filter(p => p.id !== paymentId);
  return { deleted: true };
}
export async function sendFeeReminder(payload) {
  await delay();
  return clone({ ok: true, sentAt: new Date().toISOString(), ...payload });
}
export async function getFamilyReceipts() { await delay(); return clone(mockFamilyReceipts); }
/* `advanceConsumed` — same "Adjust From Advance Balance" mechanism as
   saveReceipt above, for Family Tree receiving's per-child advance
   balance (mockFamilies[].children[].advance). Ledger entries use
   `famKey` in place of `classKey` (harmless for the class-scoped
   Advance Adjustments dashboard card, which only ever matches real
   classKeys and simply won't surface family-tree adjustments there —
   same as before this feature existed). */
export async function saveFamilyReceipt({ famKey, reg, monthIdx, payment, advanceConsumed = 0 }) {
  await delay();
  let rec = mockFamilyReceipts.find(r => r.famKey === famKey && r.reg === reg && r.monthIdx === monthIdx);
  if (mockFeeSettings.multipleReceiving === false && rec && rec.payments.length >= 1) {
    throw new Error('Multiple Receiving is disabled in Fee Settings.');
  }
  if (mockFeeSettings.advancePaymentReceiving === false && advanceConsumed > 0) {
    throw new Error('Advance Payment Receiving is disabled in Fee Settings.');
  }
  if (!rec) { rec = { famKey, reg, monthIdx, payments: [] }; mockFamilyReceipts.push(rec); }
  rec.payments.push(payment);
  if (advanceConsumed > 0) {
    const fam = mockFamilies.find(f => f.key === famKey);
    const child = fam?.children.find(c => c.reg === reg);
    if (child) {
      child.advance = Math.max(0, (+child.advance || 0) - advanceConsumed);
      mockAdvanceLedger.push({
        id: `adv-${Date.now()}-${reg}`,
        classKey: famKey, famKey, reg, type: 'adjusted', amount: advanceConsumed,
        date: payment.date, note: 'Adjusted during Fee Receiving',
      });
    }
  }
  postFeeReceipt({ amount: payment.amount, method: payment.method, date: payment.date, reg, classKey: famKey }).catch(() => {});
  return clone(payment);
}
export async function updateFamilyReceiptPayment({ famKey, reg, monthIdx, paymentId, patch }) {
  await delay();
  const rec = mockFamilyReceipts.find(r => r.famKey === famKey && r.reg === reg && r.monthIdx === monthIdx);
  const p = rec?.payments.find(x => x.id === paymentId);
  if (!p) return null;
  Object.assign(p, patch);
  return clone(p);
}

/* ── Approval-gated writes ─────────────────────────────────────────────
   Called ONLY by approvalsService's fixed per-actionType handler map,
   after a Super Admin approves the matching request — never invoked
   directly from the UI. Each receives exactly the `payload` that was
   captured at request-creation time (see Fee.jsx's saveDiscount /
   requestDeleteStudentChallan / requestDeleteClassChallans). */

/* payload: { classKey, reg, cls, sec, perHead: { [headName]: amount } }
   perHead reflects the Discount Manager's full per-head state at the
   time the request was raised, so this REPLACES (not merges) any
   previously-approved rows for this student before inserting the new
   ones — otherwise a head cleared back to 0 would never disappear. */
export async function applyApprovedDiscount(payload) {
  await delay();
  const { classKey, reg } = payload || {};
  /* 'Requested Discount' is the same per-head discount map previously
     stored under a flat `perHead` key — renamed so it renders as a
     labeled group in ApprovalDetailModal instead of a raw "perHead"
     section (see Fee.jsx's saveDiscount, which builds this payload). */
  const perHead = payload?.['Requested Discount'] || {};
  /* 'Requested Discount Meta' (approval-routed) / perHeadMeta (direct
     apply) — additive Discount Type info per head: { [head]:
     {discountType, discountValue, discountAmount} }. Absent for every
     discount saved before this feature existed, or if a head has no
     entry — those rows simply store amount only, same as always. */
  const perHeadMeta = payload?.['Requested Discount Meta'] || payload?.perHeadMeta || {};
  for (let i = mockFeeDiscounts.length - 1; i >= 0; i--) {
    if (mockFeeDiscounts[i].classKey === classKey && mockFeeDiscounts[i].reg === reg) {
      mockFeeDiscounts.splice(i, 1);
    }
  }
  Object.entries(perHead || {}).forEach(([head, amount]) => {
    if (+amount > 0) {
      const meta = perHeadMeta[head];
      mockFeeDiscounts.push({
        classKey, reg, head, amount: +amount,
        ...(meta ? { discountType: meta.discountType, discountValue: meta.discountValue } : {}),
      });
    }
  });
  return clone(mockFeeDiscounts.filter(d => d.classKey === classKey && d.reg === reg));
}

/* payload: { classKey, reg, monthIdx } — locates the exact challan via
   the same "classKey|reg|monthIdx" key the Challans list already uses
   (mockGeneratedChallans is the real source of truth for whether a
   challan exists; mockChallans is unused for this). */
export async function applyApprovedChallanDelete(payload) {
  await delay();
  const { classKey, reg, monthIdx } = payload || {};
  mockGeneratedChallans.delete(`${classKey}|${reg}|${monthIdx}`);
  return { ...payload, deleted: true };
}

/* payload: { classKey, heads } — heads is the FULL replacement list for
   this class (adds/edits/removals are all just diffs within it, same
   as the Update Fee Structure modal already worked with locally), so
   this simply overwrites mockFeeHeads[classKey] via the same real
   write saveFeeHeads uses. */
export async function applyApprovedHeadsUpdate(payload) {
  await delay();
  const { classKey, heads } = payload || {};
  mockFeeHeads[classKey] = (heads || []).map(h => ({ ...h }));
  return clone(mockFeeHeads[classKey]);
}
