/* ═══════════════════════════════════════════════════════════════════
   HUMAN RESOURCE — departments, designations, employees, payroll.
   Ported from the ERP design and adapted: the class/subject/attendance
   ASSIGNMENT feature is intentionally omitted (head-office employees are
   not assigned classes or attendance). localStorage-backed demo store.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_hr'

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const EMP_TYPES = ['Permanent', 'Contractual', 'Probation', 'Part-time']
export const PAY_METHODS = ['Bank Transfer', 'Cash', 'Cheque']

const heads = (h, t, m) => ({ name: h, type: t, amount: m })
const defaultHeads = () => [heads('House Allowance', 'allow', 8000), heads('Transport Allowance', 'allow', 4000), heads('Medical Allowance', 'allow', 2500), heads('Income Tax', 'deduct', 1500)]
const defaultLeaves = () => ({ annual: 20, casual: 8, sick: 6, balance: 18, policy: 'Standard', absentDed: 150, unpaidDed: 1200 })
const defaultFin = () => ({ salaryAdvance: 0, loanBalance: 0, securityDeposit: 0, clearanceStatus: 'pending' })

const SEED = {
  nextDeptId: 5, nextDesigId: 9, nextEmpId: 7, nextLoanId: 1002,
  depts: [
    { id: 1, name: 'Administration', desc: 'School administration and management' },
    { id: 2, name: 'Academics', desc: 'Teaching and curriculum' },
    { id: 3, name: 'Security', desc: 'Campus security and safety' },
    { id: 4, name: 'Quality Control', desc: 'Quality assurance and audits' },
  ],
  desigs: [
    { id: 1, dId: 1, name: 'Principal', qual: 'MSc', desc: 'Head of institution' },
    { id: 2, dId: 1, name: 'Vice Principal', qual: 'MSc', desc: 'Deputy head' },
    { id: 3, dId: 1, name: 'Accountant', qual: 'B.Com', desc: 'Financial accounts' },
    { id: 4, dId: 2, name: 'Teacher English', qual: 'BA', desc: 'English teacher' },
    { id: 5, dId: 2, name: 'Teacher SST', qual: 'BEd', desc: 'Social studies teacher' },
    { id: 6, dId: 2, name: 'Teacher Science', qual: 'BSc', desc: 'Science teacher' },
    { id: 7, dId: 3, name: 'Security Guard', qual: 'Matric', desc: 'Campus guard' },
    { id: 8, dId: 4, name: 'QA Officer', qual: 'MBA', desc: 'Quality auditor' },
  ],
  emps: [
    { id: 1, eid: 'EMP-001', firstName: 'Dr. Islahudin', lastName: '', fn: 'M. Khan', cnic: '35101-1234567-1', dob: '1990-05-12', gender: 'Male', marital: 'Single', phone: '03119456045', email: 'islahudin@school.com', blood: 'A+', emergency: '03001234567', address: 'Sector G-9, Islamabad', dId: 1, desId: 1, join: '2025-04-29', type: 'Permanent', status: 'Active', manager: 'Mr. Ahmed Khan', qual: 'MSc Education', exp: '10 yrs', shift: '8:00 AM – 2:00 PM', city: 'Islamabad', role: 'Overall school administration & academic leadership', basicSalary: 80000, payMethod: 'Bank Transfer', bankName: 'HBL', bankAcc: 'PK00HABB0012345678', salaryHeads: [heads('House Allowance', 'allow', 15000), heads('Transport Allowance', 'allow', 5000), heads('Medical Allowance', 'allow', 3000), heads('Income Tax', 'deduct', 4000)], leaves: { annual: 25, casual: 10, sick: 8, balance: 23, policy: 'Senior Staff', absentDed: 200, unpaidDed: 1500 }, financial: { salaryAdvance: 0, loanBalance: 100000, securityDeposit: 50000, clearanceStatus: 'pending' } },
    { id: 2, eid: 'EMP-002', firstName: 'Ayesha', lastName: 'Siddiqui', fn: 'Imran', cnic: '35202-2233445-6', dob: '1992-03-15', gender: 'Female', marital: 'Married', phone: '03001234500', email: 'ayesha@school.com', blood: 'B+', emergency: '', address: 'F-8, Islamabad', dId: 1, desId: 3, join: '2024-08-15', type: 'Permanent', status: 'Active', manager: 'Dr. Islahudin', qual: 'B.Com', exp: '5 yrs', shift: '8:00 AM – 4:00 PM', city: 'Islamabad', role: 'Accounts & finance', basicSalary: 60000, payMethod: 'Bank Transfer', bankName: 'UBL', bankAcc: '', salaryHeads: defaultHeads(), leaves: defaultLeaves(), financial: defaultFin() },
    { id: 3, eid: 'EMP-003', firstName: 'Bilal', lastName: 'Ahmed', fn: 'Rashid', cnic: '', dob: '', gender: 'Male', marital: 'Single', phone: '03007654321', email: '', blood: 'B+', emergency: '', address: '', dId: 1, desId: 2, join: '2024-03-01', type: 'Permanent', status: 'Active', manager: 'Dr. Islahudin', qual: 'MA', exp: '7 yrs', shift: '', city: '', role: '', basicSalary: 55000, payMethod: 'Bank Transfer', bankName: '', bankAcc: '', salaryHeads: defaultHeads(), leaves: defaultLeaves(), financial: defaultFin() },
    { id: 4, eid: 'EMP-004', firstName: 'Sara', lastName: 'Malik', fn: 'Naveed', cnic: '', dob: '', gender: 'Female', marital: 'Single', phone: '03331122334', email: '', blood: 'O+', emergency: '', address: '', dId: 2, desId: 4, join: '2023-09-01', type: 'Permanent', status: 'Active', manager: 'Bilal Ahmed', qual: 'BA', exp: '3 yrs', shift: '', city: '', role: '', basicSalary: 40000, payMethod: 'Bank Transfer', bankName: '', bankAcc: '', salaryHeads: defaultHeads(), leaves: defaultLeaves(), financial: defaultFin() },
    { id: 5, eid: 'EMP-005', firstName: 'Hamza', lastName: 'Raza', fn: 'Tariq', cnic: '', dob: '', gender: 'Male', marital: 'Single', phone: '03445566778', email: '', blood: 'A+', emergency: '', address: '', dId: 2, desId: 5, join: '2024-01-10', type: 'Contractual', status: 'Active', manager: 'Bilal Ahmed', qual: 'BEd', exp: '2 yrs', shift: '', city: '', role: '', basicSalary: 38000, payMethod: 'Bank Transfer', bankName: '', bankAcc: '', salaryHeads: defaultHeads(), leaves: defaultLeaves(), financial: defaultFin() },
    { id: 6, eid: 'EMP-006', firstName: 'Mr. Tariq', lastName: 'Mahmood', fn: 'Abdul Rahman', cnic: '35202-7891234-5', dob: '1985-07-20', gender: 'Male', marital: 'Married', phone: '03001112233', email: 'tariq@school.com', blood: 'O+', emergency: '03009998877', address: 'F-10, Islamabad', dId: 2, desId: 6, join: '2023-01-15', type: 'Permanent', status: 'Inactive', inactiveDate: '2025-12-10', inactiveReason: 'Resignation', manager: 'Dr. Islahudin', qual: 'MSc Physics', exp: '8 yrs', shift: '', city: 'Islamabad', role: 'Senior Science Teacher', basicSalary: 55000, payMethod: 'Bank Transfer', bankName: 'UBL', bankAcc: '', salaryHeads: defaultHeads(), leaves: defaultLeaves(), financial: { salaryAdvance: 25000, loanBalance: 10000, securityDeposit: 50000, clearanceStatus: 'pending' } },
  ],
  loans: {
    1: [{ id: 1001, loanNumber: 1, amount: 100000, comment: 'Wedding Loan', repaymentType: 'Installment', deductDate: '2026-06-01', installmentType: 'Monthly', installmentAmount: 5000, status: 'active', received: [], remaining: 100000, createdAt: '2026-05-30' }],
  },
  payroll: {}, // `${empId}-${year}-${month0}` -> full record
}

export function loadHr() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.emps) return d } catch { /* reseed */ }
  localStorage.setItem(KEY, JSON.stringify(SEED))
  return JSON.parse(JSON.stringify(SEED))
}
export const saveHr = (d) => localStorage.setItem(KEY, JSON.stringify(d))

export const rs = (n) => 'Rs ' + Number(n || 0).toLocaleString()
export const num = (n) => Number(n || 0).toLocaleString()
export function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d } }
export const fullName = (e) => `${e.firstName || ''} ${e.lastName || ''}`.trim()
export const initials = (e) => (fullName(e).split(' ').map((w) => w[0]).join('') || 'E').slice(0, 2).toUpperCase()

export const deptName = (hr, id) => hr.depts.find((d) => d.id === id)?.name || '—'
export const desigName = (hr, id) => hr.desigs.find((d) => d.id === id)?.name || '—'

export const allowances = (e) => (e.salaryHeads || []).filter((h) => h.type === 'allow').reduce((a, h) => a + Number(h.amount || 0), 0)
export const deductions = (e) => (e.salaryHeads || []).filter((h) => h.type === 'deduct').reduce((a, h) => a + Number(h.amount || 0), 0)
export const gross = (e) => Number(e.basicSalary || 0) + allowances(e)
export const netPay = (e) => gross(e) - deductions(e)

/* ── loan helpers ── */
export const empLoans = (hr, id) => hr.loans?.[id] || []
export const loanRemaining = (hr, id) => empLoans(hr, id).filter((l) => l.status === 'active').reduce((s, l) => s + (Number(l.remaining) || 0), 0)
export const loanTotalReturned = (hr, id) => empLoans(hr, id).reduce((s, l) => s + (l.received || []).reduce((a, r) => a + (Number(r.amount) || 0), 0), 0)
export const activeLoanCount = (hr, id) => empLoans(hr, id).filter((l) => l.status === 'active').length
export const monthlyLoanDeduct = (hr, id) => empLoans(hr, id).filter((l) => l.status === 'active' && l.repaymentType === 'Installment').reduce((s, l) => s + (Number(l.installmentAmount) || 0), 0)

export const payKey = (id, year, month0) => `${id}-${year}-${month0}`
export const PAY_STATUS_LABEL = { Generated: 'Generated', 'Partially Paid': 'Partially Paid', Paid: 'Paid' }
