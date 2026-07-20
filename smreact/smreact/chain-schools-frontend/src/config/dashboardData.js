/* ═══════════════════════════════════════════════════════════════════
   Head Office dashboard data.

   Static/dummy data for now, grouped exactly the way the UI consumes it
   so it can be swapped for API responses later. Per-school records live
   in SCHOOLS (ids match the connected-school switcher); chain-wide
   aggregates are COMPUTED from those records so numbers never drift.
   ═══════════════════════════════════════════════════════════════════ */

export const SCHOOLS = [
  { id: 1, name: 'Allied Grammar School', city: 'Lahore', status: 'active', erpUsage: 92, loginsMonth: 410, workingHrs: 286, lastLogin: 'Today, 09:14', students: 1320, male: 712, female: 608, activeStudents: 1284, staff: 84, activeStaff: 80, newJoinings: 3, attStudent: 95, attStaff: 97, paymentStatus: 'paid', payable: 1850000, received: 1850000, onboarding: 100, followups: 0, modules: { academics: true, attendance: true, payments: true, accounts: true, inventory: true, trainings: true, hr: true, sops: true } },
  { id: 2, name: 'City Scholars School', city: 'Karachi', status: 'active', erpUsage: 88, loginsMonth: 366, workingHrs: 254, lastLogin: 'Today, 08:51', students: 1180, male: 624, female: 556, activeStudents: 1142, staff: 76, activeStaff: 72, newJoinings: 2, attStudent: 93, attStaff: 96, paymentStatus: 'paid', payable: 1640000, received: 1640000, onboarding: 100, followups: 1, modules: { academics: true, attendance: true, payments: true, accounts: true, inventory: true, trainings: true, hr: true, sops: true } },
  { id: 3, name: 'Green Valley School', city: 'Islamabad', status: 'active', erpUsage: 81, loginsMonth: 298, workingHrs: 221, lastLogin: 'Today, 10:02', students: 940, male: 498, female: 442, activeStudents: 905, staff: 61, activeStaff: 58, newJoinings: 1, attStudent: 91, attStaff: 94, paymentStatus: 'partial', payable: 1280000, received: 820000, onboarding: 86, followups: 2, modules: { academics: true, attendance: true, payments: true, accounts: true, inventory: false, trainings: true, hr: true, sops: true } },
  { id: 4, name: 'The Knowledge Campus', city: 'Faisalabad', status: 'active', erpUsage: 76, loginsMonth: 264, workingHrs: 198, lastLogin: 'Yesterday, 17:40', students: 870, male: 451, female: 419, activeStudents: 838, staff: 55, activeStaff: 52, newJoinings: 2, attStudent: 90, attStaff: 93, paymentStatus: 'paid', payable: 1120000, received: 1120000, onboarding: 92, followups: 1, modules: { academics: true, attendance: true, payments: true, accounts: true, inventory: true, trainings: false, hr: true, sops: true } },
  { id: 5, name: 'Future Stars School', city: 'Rawalpindi', status: 'active', erpUsage: 69, loginsMonth: 212, workingHrs: 164, lastLogin: 'Today, 07:58', students: 760, male: 402, female: 358, activeStudents: 724, staff: 48, activeStaff: 45, newJoinings: 1, attStudent: 88, attStaff: 92, paymentStatus: 'partial', payable: 980000, received: 540000, onboarding: 74, followups: 3, modules: { academics: true, attendance: true, payments: true, accounts: false, inventory: false, trainings: true, hr: true, sops: true } },
  { id: 6, name: 'Bright Learners Academy', city: 'Multan', status: 'active', erpUsage: 64, loginsMonth: 188, workingHrs: 142, lastLogin: 'Yesterday, 14:20', students: 690, male: 360, female: 330, activeStudents: 651, staff: 44, activeStaff: 41, newJoinings: 0, attStudent: 86, attStaff: 90, paymentStatus: 'unpaid', payable: 860000, received: 0, onboarding: 68, followups: 4, modules: { academics: true, attendance: true, payments: false, accounts: false, inventory: false, trainings: true, hr: true, sops: true } },
  { id: 7, name: 'Iqra Model School', city: 'Peshawar', status: 'active', erpUsage: 58, loginsMonth: 156, workingHrs: 118, lastLogin: '3 days ago', students: 620, male: 332, female: 288, activeStudents: 578, staff: 40, activeStaff: 36, newJoinings: 1, attStudent: 84, attStaff: 89, paymentStatus: 'partial', payable: 740000, received: 380000, onboarding: 61, followups: 3, modules: { academics: true, attendance: true, payments: true, accounts: false, inventory: false, trainings: false, hr: true, sops: true } },
  { id: 8, name: 'Smart Kids School', city: 'Sialkot', status: 'inactive', erpUsage: 34, loginsMonth: 72, workingHrs: 48, lastLogin: '11 days ago', students: 480, male: 256, female: 224, activeStudents: 430, staff: 31, activeStaff: 26, newJoinings: 0, attStudent: 79, attStaff: 84, paymentStatus: 'unpaid', payable: 560000, received: 0, onboarding: 42, followups: 5, modules: { academics: true, attendance: false, payments: false, accounts: false, inventory: false, trainings: false, hr: true, sops: true } },
  { id: 9, name: 'National Grammar School', city: 'Gujranwala', status: 'active', erpUsage: 71, loginsMonth: 224, workingHrs: 171, lastLogin: 'Today, 11:36', students: 810, male: 430, female: 380, activeStudents: 776, staff: 51, activeStaff: 48, newJoinings: 2, attStudent: 89, attStaff: 92, paymentStatus: 'paid', payable: 1040000, received: 1040000, onboarding: 88, followups: 1, modules: { academics: true, attendance: true, payments: true, accounts: true, inventory: true, trainings: true, hr: true, sops: true } },
  { id: 10, name: 'Rising Star School', city: 'Hyderabad', status: 'inactive', erpUsage: 28, loginsMonth: 54, workingHrs: 37, lastLogin: '16 days ago', students: 430, male: 232, female: 198, activeStudents: 372, staff: 28, activeStaff: 22, newJoinings: 0, attStudent: 76, attStaff: 82, paymentStatus: 'unpaid', payable: 510000, received: 0, onboarding: 35, followups: 6, modules: { academics: true, attendance: false, payments: false, accounts: false, inventory: false, trainings: false, hr: true, sops: true } },
]

export const schoolById = (id) => SCHOOLS.find((s) => s.id === Number(id))
const sum = (arr, k) => arr.reduce((n, x) => n + (typeof k === 'function' ? k(x) : x[k]), 0)
const avg = (arr, k) => (arr.length ? Math.round(sum(arr, k) / arr.length) : 0)

/* Chain-wide aggregates (computed from SCHOOLS so totals always reconcile). */
export function chainAggregates() {
  const active = SCHOOLS.filter((s) => s.status === 'active')
  const payable = sum(SCHOOLS, 'payable')
  const received = sum(SCHOOLS, 'received')
  const students = sum(SCHOOLS, 'students')
  const activeStudents = sum(SCHOOLS, 'activeStudents')
  const staff = sum(SCHOOLS, 'staff')
  const activeStaff = sum(SCHOOLS, 'activeStaff')
  return {
    totalSchools: SCHOOLS.length,
    erpActive: active.length,
    erpInactive: SCHOOLS.length - active.length,
    loggedInToday: SCHOOLS.filter((s) => s.lastLogin.startsWith('Today')).length,
    loginsMonth: sum(SCHOOLS, 'loginsMonth'),
    workingHrs: sum(SCHOOLS, 'workingHrs'),
    mostActive: [...SCHOOLS].sort((a, b) => b.erpUsage - a.erpUsage)[0],
    leastActive: [...SCHOOLS].sort((a, b) => a.erpUsage - b.erpUsage)[0],
    students,
    male: sum(SCHOOLS, 'male'),
    female: sum(SCHOOLS, 'female'),
    activeStudents,
    inactiveStudents: students - activeStudents,
    staff,
    activeStaff,
    inactiveStaff: staff - activeStaff,
    newJoinings: sum(SCHOOLS, 'newJoinings'),
    payable,
    received,
    pending: payable - received,
    paidSchools: SCHOOLS.filter((s) => s.paymentStatus === 'paid').length,
    unpaidSchools: SCHOOLS.filter((s) => s.paymentStatus !== 'paid').length,
    attStudent: avg(SCHOOLS, 'attStudent'),
    attStaff: avg(SCHOOLS, 'attStaff'),
    highestAtt: [...SCHOOLS].sort((a, b) => b.attStudent - a.attStudent)[0],
    lowestAtt: [...SCHOOLS].sort((a, b) => a.attStudent - b.attStudent)[0],
    fullyOnboarded: SCHOOLS.filter((s) => s.onboarding >= 100).length,
    inProgress: SCHOOLS.filter((s) => s.onboarding < 100).length,
    followups: sum(SCHOOLS, 'followups'),
    avgOnboarding: avg(SCHOOLS, 'onboarding'),
  }
}

/* Module adoption across the chain (how many of the 10 schools use each). */
export const MODULE_USAGE = [
  { key: 'academics', label: 'Academics', icon: 'fa-graduation-cap', visits: 4820, avgTime: '3h 12m' },
  { key: 'attendance', label: 'Attendance', icon: 'fa-user-check', visits: 6240, avgTime: '2h 41m' },
  { key: 'payments', label: 'School Payments', icon: 'fa-credit-card', visits: 3110, avgTime: '1h 58m' },
  { key: 'accounts', label: 'Accounts', icon: 'fa-file-invoice-dollar', visits: 1980, avgTime: '1h 22m' },
  { key: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked', visits: 1240, avgTime: '0h 54m' },
  { key: 'trainings', label: 'Trainings', icon: 'fa-chalkboard-user', visits: 2260, avgTime: '1h 10m' },
  { key: 'hr', label: 'Human Resource', icon: 'fa-users-gear', visits: 2890, avgTime: '1h 36m' },
  { key: 'sops', label: 'Operational SOPs', icon: 'fa-book-open', visits: 1650, avgTime: '0h 47m' },
].map((m) => {
  const using = SCHOOLS.filter((s) => s.modules[m.key]).length
  return { ...m, schoolsUsing: using, usagePct: Math.round((using / SCHOOLS.length) * 100) }
})

/* Trend series (static; ready to be replaced by API time-series). */
export const DAILY_LOGINS = [
  { d: 'Mon', v: 210 }, { d: 'Tue', v: 248 }, { d: 'Wed', v: 232 }, { d: 'Thu', v: 276 },
  { d: 'Fri', v: 261 }, { d: 'Sat', v: 138 }, { d: 'Sun', v: 96 },
]
export const MONTHLY_USAGE = [
  { m: 'Jan', v: 62 }, { m: 'Feb', v: 68 }, { m: 'Mar', v: 74 }, { m: 'Apr', v: 71 }, { m: 'May', v: 79 }, { m: 'Jun', v: 86 },
]
export const CHAIN_GROWTH = [
  { m: 'Jan', schools: 7, students: 6400, staff: 410 },
  { m: 'Feb', schools: 8, students: 6950, staff: 442 },
  { m: 'Mar', schools: 8, students: 7300, staff: 460 },
  { m: 'Apr', schools: 9, students: 7720, staff: 485 },
  { m: 'May', schools: 10, students: 8100, staff: 505 },
  { m: 'Jun', schools: 10, students: 8580, staff: 518 },
]

/* Head-office-managed modules (chain-level). */
export const ACADEMICS_STATS = { classes: 7, subjects: 9, lessonPlans: 24, notebookPlans: 11, termBreakups: 6, calendars: 3, released: true }
export const SOP_STATS = { categories: 8, manuals: 32, pdfs: 28, forms: 14, videos: 19 }
export const TRAINING_STATS = { upcoming: 4, recorded: 17, published: 12, thisMonth: 5, categories: 6, schoolsParticipated: 8 }
export const NOTIFICATION_STATS = { total: 146, sent: 132, scheduled: 9, unread: 5 }
export const USER_PERMISSION_STATS = { total: 38, active: 31, roles: 6, groups: 9, recentChanges: 4 }

export const RECENT_ACTIVITY = [
  { icon: 'fa-right-to-bracket', color: 'info', text: 'Allied Grammar School logged in', time: '8 min ago' },
  { icon: 'fa-credit-card', color: 'success', text: 'Payment received from City Scholars School — Rs. 1,640,000', time: '52 min ago' },
  { icon: 'fa-link', color: 'brand', text: 'New school connected — Rising Star School', time: '2 hours ago' },
  { icon: 'fa-book-open', color: 'warn', text: 'New SOP manual uploaded — “Admissions Process”', time: '4 hours ago' },
  { icon: 'fa-chalkboard-user', color: 'purple', text: 'Training added — “ERP Attendance Workflow”', time: 'Yesterday' },
  { icon: 'fa-bell', color: 'info', text: 'Notification sent to all principals — Fee deadline reminder', time: 'Yesterday' },
]

export const ATTENTION_REASONS = {
  lowErp: { label: 'Low ERP usage', color: 'warn' },
  pendingPay: { label: 'Pending payment', color: 'red' },
  onboarding: { label: 'Incomplete onboarding', color: 'info' },
  lowAtt: { label: 'Low attendance', color: 'red' },
  followups: { label: 'Follow-ups pending', color: 'purple' },
}

/* Schools needing attention — derived from thresholds. */
export function schoolsNeedingAttention() {
  return SCHOOLS.map((s) => {
    const reasons = []
    if (s.erpUsage < 60) reasons.push('lowErp')
    if (s.paymentStatus !== 'paid') reasons.push('pendingPay')
    if (s.onboarding < 80) reasons.push('onboarding')
    if (s.attStudent < 85) reasons.push('lowAtt')
    if (s.followups >= 3) reasons.push('followups')
    return { ...s, reasons }
  }).filter((s) => s.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length || a.erpUsage - b.erpUsage)
}

export const topPerformingSchools = () => [...SCHOOLS].sort((a, b) => b.erpUsage - a.erpUsage).slice(0, 5)
export const fmtMoney = (n) => 'Rs. ' + Number(n).toLocaleString('en-PK')
export const fmtShort = (n) => (n >= 1e7 ? (n / 1e7).toFixed(2) + ' Cr' : n >= 1e5 ? (n / 1e5).toFixed(2) + ' L' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n))
