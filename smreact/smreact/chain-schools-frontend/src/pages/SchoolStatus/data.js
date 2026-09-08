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

/* Module-usage rows shown in the ERP detail modal (screen-time API). */
export const USAGE_MODULES = [
  { key: 'dashboard', name: 'Dashboard', icon: 'fa-house' },
  { key: 'mentorai', name: 'Mentor AI', icon: 'fa-wand-magic-sparkles' },
  { key: 'academics', name: 'Academics', icon: 'fa-graduation-cap' },
  { key: 'exam', name: 'Examination', icon: 'fa-file-alt' },
  { key: 'paper', name: 'Paper Generator', icon: 'fa-file-circle-check' },
  { key: 'attendance', name: 'Attendance', icon: 'fa-clipboard-check' },
  { key: 'timetable', name: 'Timetable', icon: 'fa-calendar-days' },
  { key: 'fee', name: 'Fee', icon: 'fa-money-bill-wave' },
  { key: 'accounts', name: 'Accounts', icon: 'fa-calculator' },
  { key: 'inventory', name: 'Inventory', icon: 'fa-boxes-stacking' },
  { key: 'admissions', name: 'Admission CRM', icon: 'fa-user-plus' },
  { key: 'students', name: 'Students', icon: 'fa-user-graduate' },
  { key: 'hr', name: 'Human Resource', icon: 'fa-people-group' },
  { key: 'appraisal', name: 'Staff Appraisals', icon: 'fa-star' },
  { key: 'sop', name: 'School SOPs', icon: 'fa-book-open' },
  { key: 'trainings', name: 'Teacher Trainings', icon: 'fa-chalkboard-user' },
  { key: 'etube', name: 'e-Tube', icon: 'fa-play' },
  { key: 'chat', name: 'Chat', icon: 'fa-comments' },
  { key: 'notifications', name: 'Notifications', icon: 'fa-bell' },
  { key: 'launch', name: 'Launch Setup', icon: 'fa-rocket' },
  { key: 'settings', name: 'Settings', icon: 'fa-gear' },
  { key: 'permissions', name: 'User Permissions', icon: 'fa-key' },
  { key: 'audit', name: 'Audit Logs', icon: 'fa-clipboard-list' },
]

export const MOBILE_FEATURES = [
  { key: 'dashboard', name: 'Dashboard', category: 'academic', icon: 'fa-gauge-high' },
  { key: 'quiz', name: 'Quiz', category: 'academic', icon: 'fa-circle-question' },
  { key: 'lessonplan', name: 'Lesson Plan', category: 'academic', icon: 'fa-chalkboard' },
  { key: 'dlp', name: 'DLP Submission', category: 'academic', icon: 'fa-file-arrow-up' },
  { key: 'academics', name: 'Academics', category: 'academic', icon: 'fa-graduation-cap' },
  { key: 'homework', name: 'Home Work', category: 'academic', icon: 'fa-book' },
  { key: 'worksheet', name: 'Worksheet', category: 'academic', icon: 'fa-file-lines' },
  { key: 'datesheet', name: 'Date Sheet', category: 'academic', icon: 'fa-calendar-day' },
  { key: 'syllabus', name: 'Syllabus', category: 'academic', icon: 'fa-list-ol' },
  { key: 'results', name: 'Results', category: 'academic', icon: 'fa-chart-simple' },
  { key: 'notebookwork', name: 'Notebook Work', category: 'academic', icon: 'fa-book-open' },
  { key: 'timetable', name: 'Time Table', category: 'academic', icon: 'fa-calendar-days' },
  { key: 'noticeboard', name: 'Notice Board', category: 'engage', icon: 'fa-bullhorn' },
  { key: 'suggestions', name: 'Suggestions', category: 'engage', icon: 'fa-lightbulb' },
  { key: 'etube', name: 'E-Tube', category: 'engage', icon: 'fa-play-circle' },
  { key: 'notifications', name: 'Notifications', category: 'engage', icon: 'fa-bell' },
  { key: 'chats', name: 'Chats', category: 'engage', icon: 'fa-comments' },
  { key: 'reports', name: 'Reports', category: 'admin', icon: 'fa-chart-bar' },
  { key: 'meetings', name: 'Meetings', category: 'admin', icon: 'fa-video' },
  { key: 'tasks', name: 'Tasks', category: 'admin', icon: 'fa-clipboard-list' },
  { key: 'attendance', name: 'Attendance', category: 'admin', icon: 'fa-clipboard-check' },
  { key: 'financials', name: 'Financials', category: 'admin', icon: 'fa-sack-dollar' },
  { key: 'staffleaves', name: 'Staff Leaves', category: 'admin', icon: 'fa-plane-departure' },
  { key: 'fee', name: 'Fee', category: 'admin', icon: 'fa-money-bill-wave' },
  { key: 'aichat', name: 'AI Chat', category: 'ai', icon: 'fa-robot' },
  { key: 'ailessonplan', name: 'AI Lesson Plan', category: 'ai', icon: 'fa-wand-magic-sparkles' },
  { key: 'notebooklp', name: 'Notebook Lesson Plan AI', category: 'ai', icon: 'fa-pen-fancy' },
  { key: 'aiworksheet', name: 'AI Worksheets', category: 'ai', icon: 'fa-file-circle-plus' },
  { key: 'aidesignstudio', name: 'AI Design Studio', category: 'ai', icon: 'fa-palette' },
]

export const MOBILE_CATEGORIES = {
  academic: { label: 'Academic Tools', color: '#1E40AF', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' },
  engage: { label: 'Engagement & Communication', color: '#0284C7', grad: 'linear-gradient(135deg,#0369A1,#0284C7)' },
  admin: { label: 'Administrative', color: '#B45309', grad: 'linear-gradient(135deg,#B45309,#D97706)' },
  ai: { label: 'AI-Powered Tools', color: '#7C3AED', grad: 'linear-gradient(135deg,#6D28D9,#7C3AED)' },
}

export function emptyMobileMods() {
  const blank = () => ({ l: 0, t: '00:00:00' })
  return Object.fromEntries(MOBILE_FEATURES.map((m) => [m.key, blank()]))
}

/* Build the per-school detail payload (login analytics + onboarding). */
export function getDetailData(s) {
  const completed = s.onboarding ? s.onboarding.completed : 0
  const zeroMods = USAGE_MODULES.map((m) => ({ ...m, l: 0, t: '00:00:00' }))
  return {
    todayLogins: 0,
    todayTime: '00:00:00',
    monthLogins: s.logins || 0,
    monthTime: s.workTime || '00:00:00',
    todayMods: zeroMods,
    monthMods: zeroMods,
    todayMobileLogins: 0,
    todayMobileTime: '00:00:00',
    monthMobileLogins: 0,
    monthMobileTime: '00:00:00',
    todayMobileMods: emptyMobileMods(),
    monthMobileMods: emptyMobileMods(),
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
