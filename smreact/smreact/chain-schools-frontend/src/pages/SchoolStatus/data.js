/* ═══════════════════════════════════════════════════════════════════
   SCHOOL STATUS (School Progress) — demo data + helpers.
   Ported from the Super Admin design. Only the ERP and Inactive buckets
   are used here (Launch Setup is intentionally omitted). Ready to be
   swapped for API calls later.
   ═══════════════════════════════════════════════════════════════════ */

const tabs = (school, classes, student, dept, staff, syllabus, timetable) => ({ school, classes, student, dept, staff, syllabus, timetable })
const comp = (staffContact, parentContact, subjectAssigned, prevDues) => ({ staffContact, parentContact, subjectAssigned, prevDues })
const E = 'Entered', N = 'Not Entered'

export const INITIAL_ERP = [
  { id: 201, name: 'AES School System', initials: 'AS', staff: 2, students: 4, assigned: 'Dua Rizvi', color: 'Red', logins: 31, workTime: '0:20:30', notes: 0, calls: 0, messages: 0, onboarding: { completed: 0, total: 15 }, principal: 'AES Admin', contact: '03001234001', stuSignup: 4, staffSignup: 2, signupDate: '2025-09-10', tabs: tabs(E, E, E, E, E, N, N), comp: comp(E, E, N, N) },
  { id: 202, name: 'Jinnah Educational Complex School', initials: 'JE', staff: 6, students: 18, assigned: 'Dua Rizvi', color: 'Red', logins: 69, workTime: '4:36:35', notes: 0, calls: 0, messages: 0, onboarding: { completed: 5, total: 15 }, principal: 'JE Admin', contact: '03009876543', stuSignup: 18, staffSignup: 6, signupDate: '2025-10-15', tabs: tabs(E, E, E, E, E, E, N), comp: comp(E, E, E, N) },
  { id: 203, name: 'The Creative School', initials: 'TC', staff: 12, students: 89, assigned: 'Neha Bukhari', color: 'Green', logins: 142, workTime: '12:45:00', notes: 3, calls: 2, messages: 7, onboarding: { completed: 10, total: 15 }, principal: 'Creative Admin', contact: '03112233445', stuSignup: 89, staffSignup: 12, signupDate: '2025-08-01', tabs: tabs(E, E, E, E, E, E, E), comp: comp(E, E, E, E) },
  { id: 204, name: 'Beaconhouse School System Gulberg', initials: 'BG', staff: 18, students: 210, assigned: 'Dua Rizvi', color: 'Green', logins: 95, workTime: '8:10:22', notes: 1, calls: 0, messages: 2, onboarding: { completed: 12, total: 15 }, principal: 'Tariq Mahmood', contact: '03214567890', stuSignup: 210, staffSignup: 18, signupDate: '2025-07-15', tabs: tabs(E, E, E, E, E, E, E), comp: comp(E, E, E, E) },
  { id: 205, name: 'The City School Johar Town', initials: 'CJ', staff: 22, students: 345, assigned: 'Neha Bukhari', color: 'Green', logins: 188, workTime: '15:44:00', notes: 4, calls: 3, messages: 9, onboarding: { completed: 14, total: 15 }, principal: 'Sana Malik', contact: '03321122334', stuSignup: 345, staffSignup: 22, signupDate: '2025-06-01', tabs: tabs(E, E, E, E, E, E, E), comp: comp(E, E, E, E) },
  { id: 206, name: 'Roots International School F-10', initials: 'RF', staff: 15, students: 180, assigned: 'Dua Rizvi', color: 'Green', logins: 72, workTime: '6:30:15', notes: 2, calls: 1, messages: 3, onboarding: { completed: 9, total: 15 }, principal: 'Faisal Qureshi', contact: '03451234567', stuSignup: 180, staffSignup: 15, signupDate: '2025-08-20', tabs: tabs(E, E, E, E, E, E, N), comp: comp(E, E, E, N) },
  { id: 207, name: 'Lahore Grammar School DHA', initials: 'LD', staff: 30, students: 420, assigned: 'Nimra Fatima', color: 'Green', logins: 210, workTime: '22:15:40', notes: 6, calls: 4, messages: 11, onboarding: { completed: 15, total: 15 }, principal: 'Ayesha Raza', contact: '03001112222', stuSignup: 420, staffSignup: 30, signupDate: '2025-05-10', tabs: tabs(E, E, E, E, E, E, E), comp: comp(E, E, E, E) },
  { id: 208, name: 'Allied School Gulshan Campus', initials: 'AG', staff: 11, students: 155, assigned: 'Neha Bukhari', color: 'Red', logins: 44, workTime: '3:50:10', notes: 0, calls: 1, messages: 2, onboarding: { completed: 7, total: 15 }, principal: 'Usman Ghani', contact: '03339988776', stuSignup: 155, staffSignup: 11, signupDate: '2025-09-30', tabs: tabs(E, E, E, E, E, N, N), comp: comp(E, E, N, N) },
  { id: 209, name: 'Divisional Public School Rawalpindi', initials: 'DR', staff: 25, students: 380, assigned: 'Dua Rizvi', color: 'Green', logins: 130, workTime: '11:20:00', notes: 3, calls: 2, messages: 5, onboarding: { completed: 13, total: 15 }, principal: 'Khalid Mehmood', contact: '03125556677', stuSignup: 380, staffSignup: 25, signupDate: '2025-07-01', tabs: tabs(E, E, E, E, E, E, E), comp: comp(E, E, E, E) },
  { id: 210, name: 'Fazaia Inter College Risalpur', initials: 'FR', staff: 20, students: 290, assigned: 'Nimra Fatima', color: 'Green', logins: 88, workTime: '7:45:30', notes: 1, calls: 2, messages: 4, onboarding: { completed: 11, total: 15 }, principal: 'Brig Imran Shah', contact: '03009887766', stuSignup: 290, staffSignup: 20, signupDate: '2025-08-05', tabs: tabs(E, E, E, E, E, E, E), comp: comp(E, E, E, E) },
  { id: 211, name: 'Army Public School Nowshera', initials: 'AN', staff: 14, students: 198, assigned: 'Dua Rizvi', color: 'Green', logins: 61, workTime: '5:10:45', notes: 0, calls: 1, messages: 1, onboarding: { completed: 8, total: 15 }, principal: 'Col Asad Khan', contact: '03337654321', stuSignup: 198, staffSignup: 14, signupDate: '2025-10-01', tabs: tabs(E, E, E, E, E, E, N), comp: comp(E, E, E, N) },
  { id: 212, name: 'Pak-Turk Maarif International School', initials: 'PT', staff: 17, students: 240, assigned: 'Neha Bukhari', color: 'Green', logins: 102, workTime: '9:30:00', notes: 2, calls: 1, messages: 6, onboarding: { completed: 13, total: 15 }, principal: 'Hasan Yilmaz', contact: '03214433221', stuSignup: 240, staffSignup: 17, signupDate: '2025-06-15', tabs: tabs(E, E, E, E, E, E, E), comp: comp(E, E, E, E) },
]

export const INITIAL_INACTIVE = [
  { id: 301, name: 'Daffodils School', staff: 1, students: 0, staffSignup: 0, stuSignup: 0, principal: 'Ali Ahmed', contact: '03001111111', signupDate: '2026-01-10', tabs: tabs(E, N, N, N, N, N, N), comp: comp(N, N, N, N) },
  { id: 302, name: 'Saeed Public School (High Section)', staff: 0, students: 0, staffSignup: 0, stuSignup: 0, principal: 'Saeed Khan', contact: '03012222222', signupDate: '2026-02-05', tabs: tabs(E, N, N, N, N, N, N), comp: comp(N, N, N, N) },
  { id: 303, name: 'SPS- Middle Branch', staff: 0, students: 0, staffSignup: 0, stuSignup: 0, principal: 'Saba Perveen', contact: '03023333333', signupDate: '2026-03-12', tabs: tabs(N, N, N, N, N, N, N), comp: comp(N, N, N, N) },
  { id: 304, name: 'SPS- Middle Section', staff: 0, students: 0, staffSignup: 0, stuSignup: 0, principal: 'Nadia Butt', contact: '03034444444', signupDate: '2026-03-15', tabs: tabs(N, N, N, N, N, N, N), comp: comp(N, N, N, N) },
]

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
      comment: i < completed ? 'Training completed successfully.' : '',
      date: i < completed ? `2026-06-${String(i + 1).padStart(2, '0')}` : '',
    })),
    notes: [
      { id: 1, text: 'Called regarding ERP follow-up and discussed fee module configuration.', date: '06/06/2026', user: 'schoolmentoradmin' },
    ],
    calls: [
      { id: 1, detail: 'Call them for challan payment — no response at 10am.', dateTime: '20/06/2026, 10:28 AM', user: 'Muniba Ijaz' },
      { id: 2, detail: 'No response on call.', dateTime: '22/06/2026, 12:06 PM', user: 'Muniba Ijaz' },
    ],
    messages: [
      { id: 1, detail: 'Discussion via messages regarding ERP onboarding timeline.', dateTime: '06/06/2026, 10:22 AM', user: 'schoolmentoradmin' },
      { id: 2, detail: 'Sent reminder for challan payment and account setup.', dateTime: '20/06/2026, 10:29 AM', user: 'Muniba Ijaz' },
    ],
  }
}
