/* ═══════════════════════════════════════════════════════════════════
   DOUBLE ENTRY ACCOUNTING — mock data.

   Mirrors the shape/convention of ../mock/accounts.js (single entry)
   but every posting is a real journal entry: an array of `lines`, each
   `{ accountId, debit, credit }`, that must sum to zero. This is the
   one structural fact that makes the new module "double entry" — the
   old system's `mockAccTxns` instead attaches one signed `amount` to
   one head (see accounts.js).

   Seed vouchers below are tagged `sourceModule` so the Ledger/Reports
   can show *why* an entry exists (fee collection, a student security
   deposit, a payroll run) — this is the automation the spec asked for:
   Fee.jsx's saveReceipt() and hrService's payroll writes call the
   posting helpers in ../services/doubleEntryAccountsService.js, which
   push new vouchers onto mockDeVouchers below, live, in addition to
   this seed data.
   ═══════════════════════════════════════════════════════════════════ */

export const mockDeSchool = { name: 'The Oxford System, Lahore Campus', monogram: 'OS' };

export const mockDeFiscalYear = {
  id: 'fy-2026', label: 'FY 2026 (Jan – Dec 2026)',
  startDate: '2026-01-01', endDate: '2026-12-31', isCurrent: true, isClosed: false,
};

/* Type metadata — normal balance side + display info. Mirrors
   Accounts.jsx's ACC_SEG lookup so the visual language (colors, icons)
   matches, extended with `normalBalance` which single-entry has no
   concept of. */
export const DE_TYPE_META = {
  asset:     { label: 'Assets',      short: 'Asset',     normalBalance: 'debit',  icon: 'fa-building-columns',    color: '#0891B2', dark: '#0E7490', bg: 'linear-gradient(135deg,#CFFAFE,#ECFEFF)' },
  liability: { label: 'Liabilities', short: 'Liability',  normalBalance: 'credit', icon: 'fa-file-invoice-dollar', color: '#D97706', dark: '#B45309', bg: 'linear-gradient(135deg,#FEF3C7,#FFFBEB)' },
  equity:    { label: 'Equity',      short: 'Equity',     normalBalance: 'credit', icon: 'fa-piggy-bank',          color: '#4F46E5', dark: '#4338CA', bg: 'linear-gradient(135deg,#E0E7FF,#EEF2FF)' },
  revenue:   { label: 'Revenue',     short: 'Revenue',    normalBalance: 'credit', icon: 'fa-arrow-down-long',     color: '#16A34A', dark: '#15803D', bg: 'linear-gradient(135deg,#DCFCE7,#F0FDF4)' },
  expense:   { label: 'Expenses',    short: 'Expense',    normalBalance: 'debit',  icon: 'fa-arrow-up-long',       color: '#DC2626', dark: '#B91C1C', bg: 'linear-gradient(135deg,#FEE2E2,#FEF2F2)' },
};

export const mockDeAccounts = [
  // ── Assets ──
  { id: 'a-1001', code: '1001', name: 'Cash Account',                     type: 'asset',     category: 'Current Assets', isGroup: false, status: 'active', opening: 150000,  openingDate: '2026-01-01', desc: 'Physical cash held at the school front office.' },
  { id: 'a-1002', code: '1002', name: 'Bank Account',                     type: 'asset',     category: 'Current Assets', isGroup: false, status: 'active', opening: 850000,  openingDate: '2026-01-01', desc: "Money held in the school's primary bank account." },
  { id: 'a-1010', code: '1010', name: 'Student Fee Receivable',           type: 'asset',     category: 'Current Assets', isGroup: false, status: 'active', opening: 0,       openingDate: '2026-01-01', desc: 'Fee that has been earned but not yet collected from students.' },
  { id: 'a-1020', code: '1020', name: 'Employee Loan Receivable',         type: 'asset',     category: 'Current Assets', isGroup: false, status: 'active', opening: 0,       openingDate: '2026-01-01', desc: 'Money given to an employee that is expected to be recovered.' },
  { id: 'a-1101', code: '1101', name: 'Furniture & Equipment',            type: 'asset',     category: 'Fixed Assets',   isGroup: false, status: 'active', opening: 420000,  openingDate: '2026-01-01', desc: 'Classroom & office furniture, computers and lab equipment.' },
  { id: 'a-1102', code: '1102', name: 'Vehicles',                         type: 'asset',     category: 'Fixed Assets',   isGroup: false, status: 'active', opening: 1800000, openingDate: '2026-01-01', desc: 'School transport vehicles.' },
  // ── Liabilities ──
  { id: 'a-2001', code: '2001', name: 'Advance Fee Received',             type: 'liability', category: 'Payables',            isGroup: false, status: 'active', opening: 0,      openingDate: '2026-01-01', desc: 'Fee collected in advance for a future period.' },
  { id: 'a-2002', code: '2002', name: 'Student Security Deposit Payable', type: 'liability', category: 'Payables',            isGroup: false, status: 'active', opening: 0,      openingDate: '2026-01-01', desc: 'Money held by the school that may need to be returned to the student.' },
  { id: 'a-2003', code: '2003', name: 'Employee Security / Retention Payable', type: 'liability', category: 'Payables',       isGroup: false, status: 'active', opening: 0,      openingDate: '2026-01-01', desc: 'Money withheld from staff salary that is payable back to them later.' },
  { id: 'a-2004', code: '2004', name: 'Supplier Payable',                type: 'liability', category: 'Payables',            isGroup: false, status: 'active', opening: 0,      openingDate: '2026-01-01', desc: 'Money the school owes a supplier for goods or services already received.' },
  { id: 'a-2005', code: '2005', name: 'Salaries Payable',                type: 'liability', category: 'Outstanding Expenses', isGroup: false, status: 'active', opening: 0,      openingDate: '2026-01-01', desc: "Staff salary that has been earned but hasn't been paid out yet." },
  { id: 'a-2010', code: '2010', name: 'Bank Loan',                       type: 'liability', category: 'Loans',               isGroup: false, status: 'active', opening: 500000, openingDate: '2026-01-01', desc: 'Term loan from the bank for campus expansion.' },
  // ── Equity ──
  { id: 'a-3001', code: '3001', name: "Owner's Capital",                 type: 'equity',    category: 'Capital', isGroup: false, status: 'active', opening: 2500000, openingDate: '2026-01-01', desc: 'Money introduced into the school by the owner.' },
  { id: 'a-3002', code: '3002', name: 'Additional Capital Introduced',   type: 'equity',    category: 'Capital', isGroup: false, status: 'active', opening: 0,       openingDate: '2026-01-01', desc: 'Further money contributed by the owner(s) after start-up.' },
  { id: 'a-3003', code: '3003', name: 'Retained Earnings',               type: 'equity',    category: 'Capital', isGroup: false, status: 'active', opening: 220000,  openingDate: '2026-01-01', desc: "Profit built up over time that hasn't been withdrawn." },
  { id: 'a-3004', code: '3004', name: 'Drawings / Withdrawals',          type: 'equity',    category: 'Capital', isGroup: false, status: 'active', opening: 0,       openingDate: '2026-01-01', desc: 'Money taken out by the owner for personal use.' },
  // ── Revenue ──
  { id: 'a-4001', code: '4001', name: 'Tuition Fee Income',              type: 'revenue', category: 'Fee Income',   isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'Monthly tuition fee income from students.' },
  { id: 'a-4002', code: '4002', name: 'Admission Fee Income',            type: 'revenue', category: 'Fee Income',   isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'One-time admission fee income from new students.' },
  { id: 'a-4003', code: '4003', name: 'Transport Fee Income',            type: 'revenue', category: 'Fee Income',   isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'Monthly transport/van fee income.' },
  { id: 'a-4004', code: '4004', name: 'Other Income',                    type: 'revenue', category: 'Other Income', isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'Miscellaneous income not tied to a fee head.' },
  // ── Expenses ──
  { id: 'a-5001', code: '5001', name: 'Salaries & Wages Expense',        type: 'expense', category: 'Payroll',  isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'Gross monthly payroll cost for teaching & non-teaching staff.' },
  { id: 'a-5002', code: '5002', name: 'Utilities Expense',               type: 'expense', category: 'Operating', isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'Electricity, gas, water and internet bills.' },
  { id: 'a-5003', code: '5003', name: 'Rent Expense',                    type: 'expense', category: 'Operating', isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'Campus / building rent.' },
  { id: 'a-5004', code: '5004', name: 'Supplies & Stationery Expense',   type: 'expense', category: 'Operating', isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'Stationery, printed material and classroom consumables.' },
  { id: 'a-5005', code: '5005', name: 'Maintenance Expense',             type: 'expense', category: 'Operating', isGroup: false, status: 'active', opening: 0, openingDate: '2026-01-01', desc: 'Repairs & maintenance of building, furniture and vehicles.' },
];

export const mockDeNextCode = { asset: 1103, liability: 2011, equity: 3005, revenue: 4005, expense: 5006 };

const acc = (name) => mockDeAccounts.find(a => a.name === name)?.id;
const CASH = acc('Cash Account'), BANK = acc('Bank Account');
const FEE_INC = acc('Tuition Fee Income'), TRANS_INC = acc('Transport Fee Income'), ADM_INC = acc('Admission Fee Income');
const SAL_EXP = acc('Salaries & Wages Expense'), RENT_EXP = acc('Rent Expense'), UTIL_EXP = acc('Utilities Expense');
const SUPP_EXP = acc('Supplies & Stationery Expense'), MAINT_EXP = acc('Maintenance Expense');
const STU_SEC = acc('Student Security Deposit Payable'), EMP_SEC = acc('Employee Security / Retention Payable');
const SUPPLIER_PAY = acc('Supplier Payable'), FURNITURE = acc('Furniture & Equipment');

let seq = { RV: 0, PV: 0, JV: 0, CV: 0, PUV: 0 };
function nextNo(prefix) { seq[prefix] += 1; return `${prefix}-2026-${String(seq[prefix]).padStart(4, '0')}`; }
function V(prefix, voucherType, date, narration, lines, sourceModule = 'manual', sourceRef = null, createdBy = 'Sana Malik') {
  return {
    id: `dv-${prefix}-${seq[prefix] + 1}`,
    voucherNo: nextNo(prefix),
    voucherType, date, month: date.slice(0, 7), narration,
    sourceModule, sourceRef, status: 'posted',
    createdBy, createdAt: `${date}T10:15:00`, updatedBy: null, updatedAt: null,
    lines,
  };
}
const L = (accountId, debit, credit) => ({ accountId, debit, credit });

const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

const FEE_RECEIPTS = [
  ['01-08', 32000, 'cash', 'Reg #1042 (Class 6-A)'], ['01-14', 28500, 'bank', 'Reg #1108 (Class 4-B)'],
  ['02-05', 45000, 'bank', 'Reg #1021 (Class 8-C)'], ['02-11', 19500, 'cash', 'Reg #1233 (Class 2-A)'],
  ['02-19', 31000, 'bank', 'Reg #1076 (Class 5-B)'], ['03-04', 27500, 'cash', 'Reg #1190 (Class 3-A)'],
  ['03-13', 38000, 'bank', 'Reg #1055 (Class 7-A)'], ['03-22', 21000, 'cash', 'Reg #1301 (Class 1-B)'],
  ['04-07', 33500, 'bank', 'Reg #1042 (Class 6-A)'], ['04-16', 26000, 'cash', 'Reg #1265 (Class 3-B)'],
  ['05-06', 41000, 'bank', 'Reg #1021 (Class 8-C)'], ['05-15', 22500, 'cash', 'Reg #1147 (Class 2-B)'],
  ['05-23', 29500, 'bank', 'Reg #1108 (Class 4-B)'], ['06-05', 36000, 'cash', 'Reg #1076 (Class 5-B)'],
  ['06-18', 24000, 'bank', 'Reg #1233 (Class 2-A)'], ['07-03', 30500, 'cash', 'Reg #1190 (Class 3-A)'],
  ['07-14', 44000, 'bank', 'Reg #1055 (Class 7-A)'], ['07-21', 18500, 'cash', 'Reg #1301 (Class 1-B)'],
  ['08-06', 34500, 'bank', 'Reg #1042 (Class 6-A)'], ['08-19', 27000, 'cash', 'Reg #1265 (Class 3-B)'],
  ['09-04', 39500, 'bank', 'Reg #1021 (Class 8-C)'], ['09-10', 23500, 'cash', 'Reg #1147 (Class 2-B)'],
];
const TRANSPORT_RECEIPTS = [
  ['02-11', 8000, 'cash', 'Reg #1233 (Class 2-A) — Van Fee'], ['05-15', 8500, 'bank', 'Reg #1147 (Class 2-B) — Van Fee'],
  ['08-19', 8500, 'cash', 'Reg #1265 (Class 3-B) — Van Fee'],
];
const SECURITY_DEPOSITS = [
  ['01-05', 20000, 'bank', 'Reg #1108 (Class 4-B) — New Admission Security'],
  ['03-02', 18000, 'cash', 'Reg #1301 (Class 1-B) — New Admission Security'],
  ['05-04', 22000, 'bank', 'Reg #1147 (Class 2-B) — New Admission Security'],
  ['07-01', 20000, 'cash', 'Reg #1265 (Class 3-B) — New Admission Security'],
  ['09-02', 25000, 'bank', 'Reg #1360 (Class 1-A) — New Admission Security'],
];
const ADMISSION_RECEIPTS = [
  ['01-05', 15000, 'bank', 'Reg #1108 (Class 4-B) — Admission Fee'],
  ['03-02', 15000, 'cash', 'Reg #1301 (Class 1-B) — Admission Fee'],
  ['05-04', 15000, 'bank', 'Reg #1147 (Class 2-B) — Admission Fee'],
  ['09-02', 15000, 'bank', 'Reg #1360 (Class 1-A) — Admission Fee'],
];
/* Monthly payroll — gross salary expense, a portion retained (Employee
   Security / Retention, mirroring HumanResource.jsx's own
   `securityRetentionDeduct` concept) rather than paid out, and the net
   remainder paid from the bank. Same three-line shape a real
   hrService.markHrPayrollPaid() hook produces via
   doubleEntryAccountsService.postPayrollRun(). */
const PAYROLL = MONTHS.map((m, i) => ({ month: m, gross: 480000 + i * 4000, retained: 12000 }));
const RENT = MONTHS.map(m => ({ month: m, amount: 60000 }));
const UTILITIES = ['2026-01', '2026-03', '2026-05', '2026-07', '2026-09'].map(m => ({ month: m, amount: 15500 }));

export const mockDeVouchers = [
  // Opening capital / loan context already carried by account `opening` balances — no voucher needed for those.
  ...FEE_RECEIPTS.map(([d, amt, method, who]) => V(
    'RV', 'receipt', `2026-${d}`,
    `Tuition fee received — ${who}`,
    [L(method === 'cash' ? CASH : BANK, amt, 0), L(FEE_INC, 0, amt)],
    'fee', `FEE-${d}`,
  )),
  ...TRANSPORT_RECEIPTS.map(([d, amt, method, who]) => V(
    'RV', 'receipt', `2026-${d}`,
    `Transport fee received — ${who}`,
    [L(method === 'cash' ? CASH : BANK, amt, 0), L(TRANS_INC, 0, amt)],
    'fee', `FEE-${d}`,
  )),
  ...SECURITY_DEPOSITS.map(([d, amt, method, who]) => V(
    'RV', 'receipt', `2026-${d}`,
    `Student security deposit received — ${who}`,
    [L(method === 'cash' ? CASH : BANK, amt, 0), L(STU_SEC, 0, amt)],
    'studentSecurity', `SEC-${d}`,
  )),
  ...ADMISSION_RECEIPTS.map(([d, amt, method, who]) => V(
    'RV', 'receipt', `2026-${d}`,
    `Admission fee received — ${who}`,
    [L(method === 'cash' ? CASH : BANK, amt, 0), L(ADM_INC, 0, amt)],
    'fee', `FEE-${d}`,
  )),
  ...PAYROLL.map(({ month, gross, retained }) => V(
    'PV', 'payment', `${month}-28`,
    `Monthly payroll — ${month} (gross, net-of-retention paid via bank)`,
    [L(SAL_EXP, gross, 0), L(BANK, 0, gross - retained), L(EMP_SEC, 0, retained)],
    'payroll', `PR-${month}`,
  )),
  ...RENT.map(({ month, amount }) => V(
    'PV', 'payment', `${month}-01`,
    `Campus rent — ${month}`,
    [L(RENT_EXP, amount, 0), L(BANK, 0, amount)],
    'manual', null,
  )),
  ...UTILITIES.map(({ month, amount }) => V(
    'PV', 'payment', `${month}-20`,
    `Utility bills — ${month}`,
    [L(UTIL_EXP, amount, 0), L(BANK, 0, amount)],
    'manual', null,
  )),
  V('PUV', 'purchase', '2026-04-10', 'Office furniture purchased on credit from Al-Noor Furnishers',
    [L(FURNITURE, 65000, 0), L(SUPPLIER_PAY, 0, 65000)], 'manual', null),
  V('PUV', 'purchase', '2026-06-15', 'Stationery & printed material purchased — paid via bank',
    [L(SUPP_EXP, 22000, 0), L(BANK, 0, 22000)], 'manual', null),
  V('CV', 'contra', '2026-03-20', 'Cash deposited into bank account',
    [L(BANK, 100000, 0), L(CASH, 0, 100000)], 'manual', null),
  V('JV', 'journal', '2026-07-25', 'Reclassify stationery expense wrongly posted as maintenance in June',
    [L(SUPP_EXP, 5000, 0), L(MAINT_EXP, 0, 5000)], 'manual', null),
];

export const mockDeVoucherCounters = seq;
