/* ═══════════════════════════════════════════════════════════════════
   SCHOOL STATUS (School Progress) — helpers.
   Schools wahi hain jo School Permissions par hain: Chain-Management API
   (network-schools/manage → getbynetwork, accepted rows) se ViewProvider
   ke zariye.

   ERP bucket = launch setup on, Inactive = off — bilkul wahi cheez jo School
   Permissions ke "ERP Access" toggle par chalti hai (Super-Admin API ka
   launchsetup / toggle-launch-setup). Ye value schools wali call me nahi
   aati, is liye screen khud mangwa kar `erpActive` set karti hai (dekhein
   SchoolStatus.jsx) — yahan default off rakhte hain.
   Principal, staff/students, sign-ups, logins, tabs ki state aur compulsions
   AHM_School_Progress/branch-report se aate hain (api/schoolProgressApi.js) —
   yahan sirf khali default rakhte hain, screen unhe branchID par merge kar
   deti hai. Onboarding / working-time / notes-calls-messages ka abhi API
   nahi, wo abhi bhi 0 ya demo hain.
   ═══════════════════════════════════════════════════════════════════ */

const tabs = (school, classes, student, dept, staff, syllabus, timetable) => ({ school, classes, student, dept, staff, syllabus, timetable })
const comp = (staffContact, parentContact, subjectAssigned, prevDues) => ({ staffContact, parentContact, subjectAssigned, prevDues })
const N = 'Not Entered'

/* ISO datetime → YYYY-MM-DD (sign-up date ke liye). */
const dateOnly = (iso) => (typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : '')

/* ViewContext ka connected-school row → School Progress ki row. */
export function toProgressRow(s) {
  const name = s.name || `Branch #${s.id}`
  return {
    id: s.id,                    // branchID
    rowId: s.rowId,              // network-school row id (activate/deactivate isi se)
    branchId: s.id,
    name,
    initials: name.slice(0, 2).toUpperCase(),
    code: s.code || '',
    principal: '',
    contact: s.phone || '',
    email: s.email || '',
    address: s.address || '',
    erpActive: false,            // screen launch setup se bharti hai
    isActive: s.isActive !== false,
    signupDate: dateOnly(s.decidedAt || s.requestedAt),
    /* API se abhi na aane wale metrics. */
    staff: 0, students: 0, staffSignup: 0, stuSignup: 0,
    logins: 0, workTime: '00:00:00', notes: 0, calls: 0, messages: 0,
    color: 'Red',
    onboarding: { completed: 0, total: 15 },
    tabs: tabs(N, N, N, N, N, N, N),
    comp: comp(N, N, N, N),
  }
}

export function toProgressRows(schools) {
  return (schools || []).map(toProgressRow)
}

export const USERS = ['Dua Rizvi', 'Neha Bukhari', 'Nimra Fatima']
export const MONTHS = ['June 2026', 'May 2026', 'April 2026']

/* Onboarding catalog (15 modules) used in the ERP detail modal. */
export const EM_MODULES = [
  { key: 'academics', name: 'Academics', icon: 'fa-graduation-cap' },
  { key: 'exam', name: 'Examination', icon: 'fa-file-alt' },
  { key: 'attendance', name: 'Attendance', icon: 'fa-clipboard-check' },
  { key: 'fee', name: 'Fee', icon: 'fa-money-bill-wave' },
  { key: 'accounts', name: 'Accounts', icon: 'fa-calculator' },
  { key: 'students', name: 'Students', icon: 'fa-user-graduate' },
  { key: 'hr', name: 'Human Resource', icon: 'fa-people-group' },
  { key: 'timetable', name: 'Time Table', icon: 'fa-calendar-days' },
  { key: 'launch', name: 'Launch Setup', icon: 'fa-rocket' },
  { key: 'inventory', name: 'Inventory', icon: 'fa-boxes-stacking' },
  { key: 'admissions', name: 'Admissions CRM', icon: 'fa-user-plus' },
  { key: 'permissions', name: 'User Permissions', icon: 'fa-key' },
  { key: 'sop', name: 'SOPs', icon: 'fa-book-open' },
  { key: 'settings', name: 'Settings', icon: 'fa-gear' },
  { key: 'tt2', name: 'Reports', icon: 'fa-chart-pie' },
]

/* Module-usage rows shown in the ERP detail modal. */
const USAGE_MODULES = [
  { key: 'academics', name: 'Academics', icon: 'fa-graduation-cap' },
  { key: 'exam', name: 'Examination', icon: 'fa-file-alt' },
  { key: 'attendance', name: 'Attendance', icon: 'fa-clipboard-check' },
  { key: 'fee', name: 'Fee', icon: 'fa-money-bill-wave' },
  { key: 'accounts', name: 'Accounts', icon: 'fa-calculator' },
  { key: 'students', name: 'Students', icon: 'fa-user-graduate' },
  { key: 'hr', name: 'Human Resource', icon: 'fa-people-group' },
  { key: 'timetable', name: 'Time Table', icon: 'fa-calendar-days' },
  { key: 'launch', name: 'Launch Setup', icon: 'fa-rocket' },
]

/* Build the per-school detail payload (login analytics + onboarding). */
export function getDetailData(s) {
  const completed = s.onboarding ? s.onboarding.completed : 0
  const monthBase = {
    academics: { l: 1, t: '0:00:10' }, exam: { l: 0, t: '00:00:00' }, attendance: { l: 0, t: '00:00:00' },
    fee: { l: 5, t: '0:06:05' }, accounts: { l: 4, t: '0:00:52' }, students: { l: 2, t: '0:00:23' },
    hr: { l: 0, t: '00:00:00' }, timetable: { l: 2, t: '0:00:12' }, launch: { l: s.logins || 16, t: s.workTime || '0:12:41' },
  }
  return {
    todayLogins: 0,
    todayTime: '00:00:00',
    monthLogins: s.logins || 0,
    monthTime: s.workTime || '00:00:00',
    todayMods: USAGE_MODULES.map((m) => ({ ...m, l: 0, t: '00:00:00' })),
    monthMods: USAGE_MODULES.map((m) => ({ ...m, ...(monthBase[m.key] || { l: 0, t: '00:00:00' }) })),
    onboarding: EM_MODULES.map((m, i) => ({
      ...m,
      done: i < completed,
      comment: '',
      date: '',
    })),
    /* Notes / Calls / Messages ab API se aate hain (followup/onboarding-card-
       action) — modal khud load karta hai, yahan koi list nahi. */
  }
}
