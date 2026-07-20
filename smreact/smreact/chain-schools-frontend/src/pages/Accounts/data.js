/* ═══════════════════════════════════════════════════════════════════
   ACCOUNTS — chart of accounts, transactions, account books & reports.
   Ported from the ERP design; localStorage-backed demo store.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_accounts'

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const SEED = {
  nextHeadNo: 220,
  month: '2026-05',
  types: [
    {
      key: 'exp', name: 'Expenses', icon: 'fa-arrow-trend-down',
      heads: [
        { no: 203, name: 'Building Rent (Upper)', desc: 'Upper portion building rent' },
        { no: 204, name: 'Plumber', desc: 'Plumbing & repairs' },
        { no: 205, name: 'Utilities', desc: 'Electricity, gas & water bills' },
        { no: 206, name: 'Salary Payment', desc: 'Staff salary disbursement' },
        { no: 208, name: 'Stationery & Printing', desc: 'Office and classroom stationery' },
      ],
    },
    {
      key: 'rev', name: 'Revenue', icon: 'fa-arrow-trend-up',
      heads: [
        { no: 219, name: 'Fee Payment', desc: 'Student fee collection head' },
        { no: 218, name: 'Admission Fee', desc: 'New admission charges' },
      ],
    },
  ],
  txns: {
    rev: [
      { id: 'r1', headNo: 219, head: 'Fee Payment', date: '2026-05-06', month: '2026-05', detail: 'Fee collected — Class 1A (193,700 of 193,700, discount 1,100)', amount: 193700, chqNo: '', chqDate: '', createdBy: 'Sana Malik', createdAt: '2026-05-06T10:24:00', updatedBy: null, updatedAt: null },
      { id: 'r2', headNo: 219, head: 'Fee Payment', date: '2026-05-07', month: '2026-05', detail: 'Fee collected — Class III (27,800 of 40,000)', amount: 27800, chqNo: '', chqDate: '', createdBy: 'Front Desk', createdAt: '2026-05-07T13:45:00', updatedBy: 'Sana Malik', updatedAt: '2026-05-09T09:12:00' },
      { id: 'r3', headNo: 219, head: 'Fee Payment', date: '2026-05-08', month: '2026-05', detail: 'Fee collected — Class 1A (221,420 of 221,420)', amount: 221420, chqNo: '', chqDate: '', createdBy: 'Ali Khan', createdAt: '2026-05-08T08:55:00', updatedBy: null, updatedAt: null },
      { id: 'r4', headNo: 218, head: 'Admission Fee', date: '2026-05-10', month: '2026-05', detail: 'New admission charges — 3 students', amount: 45000, chqNo: '', chqDate: '', createdBy: 'Front Desk', createdAt: '2026-05-10T11:30:00', updatedBy: null, updatedAt: null },
    ],
    exp: [
      { id: 'e1', headNo: 206, head: 'Salary Payment', date: '2026-05-03', month: '2026-05', detail: 'Monthly salary disbursement — teaching staff', amount: 185000, chqNo: 'CHQ-44120', chqDate: '2026-05-03', createdBy: 'Ali Khan', createdAt: '2026-05-03T11:10:00', updatedBy: null, updatedAt: null },
      { id: 'e2', headNo: 203, head: 'Building Rent (Upper)', date: '2026-05-05', month: '2026-05', detail: 'Upper portion building rent for May', amount: 45000, chqNo: 'CHQ-44135', chqDate: '2026-05-05', createdBy: 'Front Desk', createdAt: '2026-05-05T09:30:00', updatedBy: 'Ali Khan', updatedAt: '2026-05-06T14:02:00' },
      { id: 'e3', headNo: 204, head: 'Plumber', date: '2026-05-09', month: '2026-05', detail: 'Plumbing repair — ground floor washrooms', amount: 6500, chqNo: '', chqDate: '', createdBy: 'Sana Malik', createdAt: '2026-05-09T16:45:00', updatedBy: null, updatedAt: null },
      { id: 'e4', headNo: 205, head: 'Utilities', date: '2026-05-11', month: '2026-05', detail: 'Electricity bill — May', amount: 38500, chqNo: '', chqDate: '', createdBy: 'Sana Malik', createdAt: '2026-05-11T10:05:00', updatedBy: null, updatedAt: null },
    ],
  },
  users: ['Sana Malik', 'Ali Khan', 'Front Desk', 'Online Portal'],
  currentUser: 'Sana Malik',
  books: [
    { id: 'bk1', name: 'Owner / Investor Account', party: 'Mr. Muaz (Owner)', desc: 'Operational funding contributed by the school owner. Cash physically held by the school.', type: 'payable', opening: 300000, openDate: '2026-01-10', status: 'active', includeInCash: true, createdBy: 'Sana Malik', txns: [
      { id: 'bt1', type: 'returned', amount: 60000, date: '2026-02-05', notes: 'Repaid to owner — installment 1', enteredBy: 'Sana Malik', at: '2026-02-05T11:20:00' },
      { id: 'bt2', type: 'received', amount: 100000, date: '2026-03-18', notes: 'Further contribution for new branch setup', enteredBy: 'Sana Malik', at: '2026-03-18T09:45:00' },
      { id: 'bt3', type: 'returned', amount: 40000, date: '2026-04-22', notes: 'Repaid to owner — installment 2', enteredBy: 'Ali Khan', at: '2026-04-22T15:10:00' },
    ] },
    { id: 'bk2', name: 'Crescent Uniforms — Supplier', party: 'Crescent Uniforms & Tailors', desc: 'Running payable account with the uniform supplier. Bought on credit, paid in installments.', type: 'payable', opening: 0, openDate: '2026-02-12', status: 'active', includeInCash: false, createdBy: 'Front Desk', txns: [
      { id: 'bt10', type: 'received', amount: 120000, date: '2026-02-12', notes: 'Summer uniforms on credit (120 sets + 40 sports kits)', enteredBy: 'Front Desk', at: '2026-02-12T10:30:00' },
      { id: 'bt11', type: 'returned', amount: 60000, date: '2026-04-18', notes: 'Part payment to supplier — bank transfer', enteredBy: 'Sana Malik', at: '2026-04-18T13:05:00' },
      { id: 'bt12', type: 'received', amount: 35000, date: '2026-05-06', notes: 'Winter uniforms on credit', enteredBy: 'Front Desk', at: '2026-05-06T12:00:00' },
    ] },
    { id: 'bk3', name: 'Ilm Books & Stationers — Supplier', party: 'Ilm Books & Stationers (Pvt) Ltd', desc: 'Main textbook supplier. Goods purchased on credit and settled in partial payments.', type: 'payable', opening: 0, openDate: '2026-03-05', status: 'active', includeInCash: false, createdBy: 'Sana Malik', txns: [
      { id: 'bt20', type: 'received', amount: 180000, date: '2026-03-05', notes: 'Textbooks Grade 1-5 (500) + workbooks (300) on credit', enteredBy: 'Sana Malik', at: '2026-03-05T09:15:00' },
      { id: 'bt21', type: 'returned', amount: 50000, date: '2026-03-20', notes: 'Partial payment — cheque #44120', enteredBy: 'Ali Khan', at: '2026-03-20T14:40:00' },
      { id: 'bt23', type: 'returned', amount: 80000, date: '2026-04-15', notes: 'Partial payment — bank transfer', enteredBy: 'Sana Malik', at: '2026-04-15T10:25:00' },
      { id: 'bt26', type: 'adjustment', amount: -5000, date: '2026-05-12', notes: 'Discount adjustment for damaged stock returned', enteredBy: 'Sana Malik', at: '2026-05-12T13:30:00' },
      { id: 'bt28', type: 'returned', amount: 40000, date: '2026-05-22', notes: 'Partial payment — pending balance carried forward', enteredBy: 'Sana Malik', at: '2026-05-22T15:00:00' },
    ] },
    { id: 'bk4', name: 'Al-Madina Stationery — Vendor', party: 'Al-Madina Stationery Mart', desc: 'Day-to-day office and classroom stationery supplier.', type: 'payable', opening: 0, openDate: '2026-04-10', status: 'settled', includeInCash: false, createdBy: 'Front Desk', txns: [
      { id: 'bt40', type: 'received', amount: 18000, date: '2026-04-10', notes: 'Office stationery & registers on credit', enteredBy: 'Front Desk', at: '2026-04-10T10:00:00' },
      { id: 'bt41', type: 'returned', amount: 18000, date: '2026-05-02', notes: 'Full payment — cash, account cleared', enteredBy: 'Sana Malik', at: '2026-05-02T12:30:00' },
    ] },
    { id: 'bk5', name: 'Canteen Contractor — Receivable', party: 'Bismillah Caterers', desc: 'Monthly canteen rent receivable from the canteen contractor.', type: 'receivable', opening: 50000, openDate: '2026-03-01', status: 'active', includeInCash: false, createdBy: 'Sana Malik', txns: [
      { id: 'bt50', type: 'returned', amount: 25000, date: '2026-04-05', notes: 'Rent received for March', enteredBy: 'Sana Malik', at: '2026-04-05T10:15:00' },
    ] },
  ],
  booksNextId: 6, booksTxnNextId: 60,
}

export function loadAcc() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.types) return d } catch { /* reseed */ }
  localStorage.setItem(KEY, JSON.stringify(SEED))
  return JSON.parse(JSON.stringify(SEED))
}
export const saveAcc = (d) => localStorage.setItem(KEY, JSON.stringify(d))

/* ── formatting ── */
export const rs = (n) => 'Rs ' + Number(n || 0).toLocaleString()
export const num = (n) => Number(n || 0).toLocaleString()
export function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d } }
export function fmtStamp(s) { if (!s) return '—'; try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return s } }
export function periodLabel(m) { if (!m) return '—'; const [y, mo] = m.split('-'); return `${MONTHS[Number(mo) - 1]} ${y}` }

/* ── compute helpers ── */
export function bookCalc(b) {
  const sorted = [...(b.txns || [])].sort((a, c) => (a.date < c.date ? -1 : 1))
  let bal = b.opening || 0
  let received = 0
  let returnedAll = 0
  const withBal = sorted.map((t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'received') { bal += amt; received += amt }
    else if (t.type === 'returned') { bal -= amt; returnedAll += amt }
    else { bal += amt } // adjustment (signed)
    return { ...t, runningBalance: bal }
  })
  return { received, returnedAll, balance: bal, withBal }
}

export function monthsBetween(fromM, toM) {
  const out = []
  if (!fromM || !toM) return out
  let [fy, fm] = fromM.split('-').map(Number)
  const [ty, tm] = toM.split('-').map(Number)
  while (fy < ty || (fy === ty && fm <= tm)) { out.push(`${fy}-${String(fm).padStart(2, '0')}`); fm += 1; if (fm > 12) { fm = 1; fy += 1 } if (out.length > 60) break }
  return out
}
export function plForMonth(acc, m) {
  const rev = acc.txns.rev.filter((x) => x.month === m).reduce((a, x) => a + Number(x.amount || 0), 0)
  const exp = acc.txns.exp.filter((x) => x.month === m).reduce((a, x) => a + Number(x.amount || 0), 0)
  return { rev, exp, pl: rev - exp }
}
