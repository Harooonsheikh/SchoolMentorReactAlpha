import {
  mockDeAccounts, mockDeVouchers, mockDeSchool, mockDeFiscalYear,
  mockDeNextCode, mockDeVoucherCounters,
} from '../mock/doubleEntryAccounts';
import { delay, clone } from './_http';

/* ═══════════════════════════════════════════════════════════════════
   doubleEntryAccountsService — Double Entry Accounting module.

   Same delay()+clone() / in-memory-mutation contract as
   accountsService.js (single entry). The one structural difference:
   every write here deals in *voucher lines* (debit+credit pairs) that
   must balance to zero, never a single signed amount.

   postFeeReceipt / postStudentSecurityDeposit / postPayrollRun are the
   automation adapters other modules call — Fee.jsx's fee-collection
   flow already calls postFeeReceipt() from feeService.saveReceipt()/
   saveFamilyReceipt() (fire-and-forget, matching how those functions
   already call each other's siblings), and hrService's payroll writes
   call postPayrollRun(). Both are safe no-ops if their inputs don't
   look like a real payment (e.g. amount <= 0), so calling them from an
   incomplete mock flow never throws.
   ═══════════════════════════════════════════════════════════════════ */

export async function getDeAccounts()   { await delay(); return clone(mockDeAccounts); }
export async function getDeVouchers()   { await delay(); return clone(mockDeVouchers); }
export async function getDeSchool()     { await delay(); return clone(mockDeSchool); }
export async function getDeFiscalYear() { await delay(); return clone(mockDeFiscalYear); }
export async function getDeNextCode()   { await delay(); return clone(mockDeNextCode); }

export async function saveDeAccount(payload) {
  await delay();
  const idx = mockDeAccounts.findIndex(a => a.id === payload.id);
  if (idx >= 0) {
    mockDeAccounts[idx] = { ...mockDeAccounts[idx], ...payload };
  } else {
    const id = `a-${payload.code || Date.now()}`;
    mockDeAccounts.push({ isGroup: false, status: 'active', opening: 0, ...payload, id });
    if (payload.type && mockDeNextCode[payload.type] != null) {
      mockDeNextCode[payload.type] = Math.max(mockDeNextCode[payload.type], (Number(payload.code) || 0) + 1);
    }
  }
  return clone(payload);
}

export async function setDeAccountStatus({ id, status }) {
  await delay();
  const a = mockDeAccounts.find(x => x.id === id);
  if (a) a.status = status;
  return clone({ id, status });
}

function nextVoucherNo(prefix) {
  mockDeVoucherCounters[prefix] = (mockDeVoucherCounters[prefix] || 0) + 1;
  return `${prefix}-2026-${String(mockDeVoucherCounters[prefix]).padStart(4, '0')}`;
}
const VOUCHER_PREFIX = { receipt: 'RV', payment: 'PV', journal: 'JV', contra: 'CV', purchase: 'PUV' };

function pushVoucher({ voucherType, date, narration, lines, sourceModule = 'manual', sourceRef = null, createdBy = 'Sana Malik', status = 'posted' }) {
  const prefix = VOUCHER_PREFIX[voucherType] || 'JV';
  const voucher = {
    id: `dv-${prefix}-${Date.now()}`,
    voucherNo: nextVoucherNo(prefix),
    voucherType, date, month: String(date).slice(0, 7), narration,
    sourceModule, sourceRef, status,
    createdBy, createdAt: new Date().toISOString(), updatedBy: null, updatedAt: null,
    lines,
  };
  mockDeVouchers.push(voucher);
  return voucher;
}

/** Generic voucher save — used by every manual voucher form (Receipt,
 *  Payment, Journal, Contra, Purchase). `lines` must already balance
 *  (UI validates this before enabling Save, same as it validates
 *  required fields elsewhere in the app). */
export async function saveDeVoucher(payload) {
  await delay();
  if (payload.id) {
    const idx = mockDeVouchers.findIndex(v => v.id === payload.id);
    if (idx >= 0) {
      mockDeVouchers[idx] = { ...mockDeVouchers[idx], ...payload, updatedBy: payload.updatedBy || 'Sana Malik', updatedAt: new Date().toISOString() };
      return clone({ ...mockDeVouchers[idx], ok: true });
    }
  }
  const voucher = pushVoucher(payload);
  return clone({ ...voucher, ok: true });
}

export async function deleteDeVoucher({ id }) {
  await delay();
  const idx = mockDeVouchers.findIndex(v => v.id === id);
  if (idx >= 0) mockDeVouchers.splice(idx, 1);
  return { id, deleted: true };
}

const findByName = (name) => mockDeAccounts.find(a => a.name === name)?.id;

/* ── Automation adapters ─────────────────────────────────────────── */

/** Called by feeService.saveReceipt()/saveFamilyReceipt() after a fee
 *  installment is recorded. Debits Cash or Bank (by payment method),
 *  credits Tuition Fee Income — the exact "user enters a simple form,
 *  backend generates Debit+Credit" flow from the spec. */
export async function postFeeReceipt({ amount, method, date, reg, classKey, feeType = 'tuition' } = {}) {
  if (!amount || amount <= 0) return null;
  await delay(80);
  const cashOrBank = /cash/i.test(method || '') ? findByName('Cash Account') : findByName('Bank Account');
  const incomeAccount = feeType === 'transport' ? findByName('Transport Fee Income')
    : feeType === 'admission' ? findByName('Admission Fee Income')
    : findByName('Tuition Fee Income');
  if (!cashOrBank || !incomeAccount) return null;
  const voucher = pushVoucher({
    voucherType: 'receipt',
    date: date || new Date().toISOString().slice(0, 10),
    narration: `Fee received — Reg #${reg || '—'}${classKey ? ` (${classKey})` : ''}`,
    lines: [
      { accountId: cashOrBank, debit: amount, credit: 0 },
      { accountId: incomeAccount, debit: 0, credit: amount },
    ],
    sourceModule: 'fee',
    sourceRef: `FEE-${classKey || ''}-${reg || ''}-${date || ''}`,
  });
  return clone(voucher);
}

/** Student security deposit — a dedicated quick-entry Receipt Voucher
 *  inside the Double Entry module itself (Fee.jsx has no "security
 *  deposit" concept today, so this is the entry point rather than a
 *  hook into an existing Fee.jsx handler). */
export async function postStudentSecurityDeposit({ amount, method, date, reg, classKey, narration } = {}) {
  if (!amount || amount <= 0) return null;
  await delay(80);
  const cashOrBank = /cash/i.test(method || '') ? findByName('Cash Account') : findByName('Bank Account');
  const secLiability = findByName('Student Security Deposit Payable');
  const voucher = pushVoucher({
    voucherType: 'receipt',
    date: date || new Date().toISOString().slice(0, 10),
    narration: narration || `Student security deposit received — Reg #${reg || '—'}${classKey ? ` (${classKey})` : ''}`,
    lines: [
      { accountId: cashOrBank, debit: amount, credit: 0 },
      { accountId: secLiability, debit: 0, credit: amount },
    ],
    sourceModule: 'studentSecurity',
    sourceRef: `SEC-${classKey || ''}-${reg || ''}-${date || ''}`,
  });
  return clone(voucher);
}

/** Called by hrService's payroll write path once a run is finalized.
 *  Splits gross pay into: Dr Salary Expense (gross), Cr Bank (net
 *  paid), and — when any employee has securityRetentionDeduct set,
 *  mirroring HumanResource.jsx's existing retention feature — Cr
 *  Employee Security / Retention Payable for the retained portion.
 *  `rows` is optional; if the caller only has totals, pass
 *  { grossTotal, retainedTotal } directly instead of `rows`. */
export async function postPayrollRun({ month, date, rows, grossTotal, retainedTotal, paidVia = 'bank' } = {}) {
  await delay(80);
  let gross = Number(grossTotal) || 0;
  let retained = Number(retainedTotal) || 0;
  if (Array.isArray(rows) && rows.length) {
    gross = rows.reduce((s, r) => s + (Number(r.grossPay ?? r.gross ?? r.netPay ?? 0) || 0), 0);
    retained = rows.reduce((s, r) => s + (Number(r.securityRetentionDeduct) || 0), 0);
  }
  if (gross <= 0) return null;
  const net = Math.max(gross - retained, 0);
  const bankOrCash = paidVia === 'cash' ? findByName('Cash Account') : findByName('Bank Account');
  const lines = [
    { accountId: findByName('Salaries & Wages Expense'), debit: gross, credit: 0 },
    { accountId: bankOrCash, debit: 0, credit: net },
  ];
  if (retained > 0) lines.push({ accountId: findByName('Employee Security / Retention Payable'), debit: 0, credit: retained });
  const voucher = pushVoucher({
    voucherType: 'payment',
    date: date || `${month || new Date().toISOString().slice(0, 7)}-28`,
    narration: `Monthly payroll — ${month || ''}`.trim(),
    lines,
    sourceModule: 'payroll',
    sourceRef: `PR-${month || ''}`,
  });
  return clone(voucher);
}
