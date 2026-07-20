/* ═══════════════════════════════════════════════════════════════════
   PAYMENTS — schools + billing helpers + localStorage-backed stores.
   Ported from the Super Admin design. Reuses the ERP + Inactive school
   lists from the School Status module.
   ═══════════════════════════════════════════════════════════════════ */
import { INITIAL_ERP, INITIAL_INACTIVE } from '../SchoolStatus/data'

export function getAllSchools() {
  const withMeta = (s) => ({
    ...s,
    schoolCode: String(s.id).padStart(6, '0'),
    initials: (s.initials || s.name.slice(0, 2)).toUpperCase(),
  })
  return [...INITIAL_ERP.map(withMeta), ...INITIAL_INACTIVE.map(withMeta)]
}

/* Seed payment setup for the ERP schools (so the tabs have data to work with). */
const SETUP_SEED = {
  201: { formula: 'lumpsum', lumpAmount: '3000', perStudentRate: '', studentCount: '4', freeTrial: false, trialDays: '', notes: '' },
  202: { formula: 'perstudent', lumpAmount: '', perStudentRate: '25', studentCount: '18', freeTrial: false, trialDays: '', notes: '' },
  203: { formula: 'perstudent', lumpAmount: '', perStudentRate: '30', studentCount: '89', freeTrial: false, trialDays: '', notes: '' },
  204: { formula: 'perstudent', lumpAmount: '', perStudentRate: '30', studentCount: '210', freeTrial: false, trialDays: '', notes: '' },
  205: { formula: 'perstudent', lumpAmount: '', perStudentRate: '25', studentCount: '345', freeTrial: true, trialDays: '30', notes: 'First year discount' },
  206: { formula: 'lumpsum', lumpAmount: '8000', perStudentRate: '', studentCount: '180', freeTrial: false, trialDays: '', notes: '' },
  207: { formula: 'perstudent', lumpAmount: '', perStudentRate: '35', studentCount: '420', freeTrial: false, trialDays: '', notes: 'Premium tier' },
  208: { formula: 'lumpsum', lumpAmount: '5000', perStudentRate: '', studentCount: '155', freeTrial: false, trialDays: '', notes: '' },
  209: { formula: 'perstudent', lumpAmount: '', perStudentRate: '28', studentCount: '380', freeTrial: false, trialDays: '', notes: '' },
  210: { formula: 'perstudent', lumpAmount: '', perStudentRate: '30', studentCount: '290', freeTrial: false, trialDays: '', notes: '' },
  211: { formula: 'lumpsum', lumpAmount: '6000', perStudentRate: '', studentCount: '198', freeTrial: true, trialDays: '15', notes: 'Trial period' },
  212: { formula: 'perstudent', lumpAmount: '', perStudentRate: '40', studentCount: '240', freeTrial: false, trialDays: '', notes: 'International rate' },
}

const KEYS = { setup: 'csp_pay_setup', challan: 'csp_pay_challan', recv: 'csp_pay_recv' }
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {} } catch { return {} } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

export function loadSetup() {
  const s = read(KEYS.setup)
  let changed = false
  Object.entries(SETUP_SEED).forEach(([id, v]) => { if (!s[id]) { s[id] = v; changed = true } })
  if (changed) write(KEYS.setup, s)
  return s
}
export const saveSetup = (s) => write(KEYS.setup, s)
export const loadChallans = () => read(KEYS.challan)
export const saveChallans = (s) => write(KEYS.challan, s)
export const loadRecv = () => read(KEYS.recv)
export const saveRecv = (s) => write(KEYS.recv, s)

export function monthlyCharge(school, setup) {
  if (!setup) return 0
  if (setup.formula === 'lumpsum') return parseFloat(setup.lumpAmount || 0)
  if (setup.formula === 'perstudent') {
    const rate = parseFloat(setup.perStudentRate || 0)
    const count = parseInt(setup.studentCount || school?.students || 0, 10)
    return rate * count
  }
  // 'percentage' (royalty) is collection-based → no fixed monthly figure.
  return 0
}

/* ── Class-wise fee heads per school ──────────────────────────────────
   Each franchise school maintains its OWN fee heads (and can rename
   them), and heads differ by class. This mock returns a school's actual
   class-wise heads so the head office can set royalty % against the real
   heads. (Replace with a GET /schools/:id/fee-heads call later.) */
const FEE_HEAD_TEMPLATES = [
  [
    { name: 'Nursery', heads: ['Tuition Fee', 'Admission Fee', 'Annual Charges', 'Stationery'] },
    { name: 'KG', heads: ['Tuition Fee', 'Admission Fee', 'Annual Charges', 'Stationery'] },
    { name: 'Class 1', heads: ['Tuition Fee', 'Admission Fee', 'Annual Charges', 'Exam Fee'] },
    { name: 'Class 2', heads: ['Tuition Fee', 'Admission Fee', 'Annual Charges', 'Exam Fee'] },
    { name: 'Class 3', heads: ['Tuition Fee', 'Admission Fee', 'Annual Charges', 'Exam Fee'] },
  ],
  [
    { name: 'Play Group', heads: ['Monthly Fee', 'Registration', 'Annual Fund', 'Transport', 'Activity Charges'] },
    { name: 'Prep', heads: ['Monthly Fee', 'Registration', 'Annual Fund', 'Transport'] },
    { name: 'Grade 1', heads: ['Monthly Fee', 'Admission Fee', 'Annual Fund', 'Lab Fee', 'Transport'] },
    { name: 'Grade 2', heads: ['Monthly Fee', 'Admission Fee', 'Annual Fund', 'Lab Fee', 'Transport'] },
  ],
  [
    { name: 'Class 6', heads: ['Tuition Fee', 'Admission Fee', 'Computer Fee', 'Exam Fee', 'Annual Charges'] },
    { name: 'Class 7', heads: ['Tuition Fee', 'Admission Fee', 'Computer Fee', 'Exam Fee', 'Annual Charges'] },
    { name: 'Class 8', heads: ['Tuition Fee', 'Admission Fee', 'Computer Fee', 'Lab Fee', 'Exam Fee'] },
    { name: 'Matric', heads: ['Tuition Fee', 'Admission Fee', 'Board Fee', 'Lab Fee', 'Exam Fee'] },
  ],
]
export function getSchoolFeeHeads(schoolId) {
  return FEE_HEAD_TEMPLATES[schoolId % FEE_HEAD_TEMPLATES.length]
}

/* Count the fee-head/class combinations that have a royalty % > 0. */
export function royaltyCount(setup) {
  if (!setup?.royalty) return 0
  let n = 0
  Object.values(setup.royalty).forEach((heads) => Object.values(heads || {}).forEach((v) => { if (parseFloat(v) > 0) n += 1 }))
  return n
}

export const PKR = (n) => `PKR ${Number(n || 0).toLocaleString()}`
export const todayPlus = (days) => {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
export const PAY_METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'JazzCash / Easypaisa', 'Online']
