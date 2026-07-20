/* ═══════════════════════════════════════════════════════════════════
   SCHOOL PERMISSIONS — demo data + permission helpers.
   Ported from the Super Admin design. Schools come from three buckets
   (launch / erp / inactive); per-school permissions are persisted to
   localStorage for now and are ready to be swapped for API calls.
   ═══════════════════════════════════════════════════════════════════ */

export const LAUNCH_SCHOOLS = [
  { id: 1, name: 'Mumtaz School System Madhora kalan', principal: 'Mumtaz Hussian', contact: '03446352668' },
  { id: 2, name: 'STEM Learning Hub', principal: 'Ahmed Khan', contact: '03001234567' },
  { id: 3, name: 'Al Asad College', principal: 'Sara Ali', contact: '03211111111' },
  { id: 4, name: 'Al Asad School System Tangi', principal: 'Bilal Hassan', contact: '03331234567' },
  { id: 5, name: 'MY SCHOOL HARIPUR CAMPUSE', principal: 'Hina Malik', contact: '03451234567' },
  { id: 6, name: 'Nexus', principal: 'Nexus Admin', contact: '03001112222' },
  { id: 7, name: 'Bab-ul-Ilm School System Khushab', principal: 'Bab-ul-Ilm Admin', contact: '03559998888' },
  { id: 8, name: 'defojr school', principal: 'Defojr Admin', contact: '03221234321' },
  { id: 9, name: 'Hamza Education System', principal: 'Hamza Admin', contact: '03009876543' },
  { id: 10, name: 'STARS SCHOOL SYSTEM Nowshera virkan', principal: 'Zainab Noor', contact: '03001111111' },
  { id: 11, name: 'World E Education Islamic School', principal: 'Omar Farooq', contact: '03129999999' },
  { id: 12, name: 'MAH Homeschool and Learning Centre', principal: 'MAH Admin', contact: '03001110000' },
  { id: 13, name: 'The spirit school', principal: 'Spirit Admin', contact: '03221234321' },
]

export const ERP_SCHOOLS = [
  { id: 201, name: 'AES School System', initials: 'AS', principal: 'AES Admin', contact: '03001234001' },
  { id: 202, name: 'Jinnah Educational Complex School', initials: 'JE', principal: 'JE Admin', contact: '03009876543' },
  { id: 203, name: 'The Creative School', initials: 'TC', principal: 'Creative Admin', contact: '03112233445' },
  { id: 204, name: 'Beaconhouse School System Gulberg', initials: 'BG', principal: 'Tariq Mahmood', contact: '03214567890' },
  { id: 205, name: 'The City School Johar Town', initials: 'CJ', principal: 'Sana Malik', contact: '03321122334' },
  { id: 206, name: 'Roots International School F-10', initials: 'RF', principal: 'Faisal Qureshi', contact: '03451234567' },
  { id: 207, name: 'Lahore Grammar School DHA', initials: 'LD', principal: 'Ayesha Raza', contact: '03001112222' },
  { id: 208, name: 'Allied School Gulshan Campus', initials: 'AG', principal: 'Usman Ghani', contact: '03339988776' },
  { id: 209, name: 'Divisional Public School Rawalpindi', initials: 'DR', principal: 'Khalid Mehmood', contact: '03125556677' },
  { id: 210, name: 'Fazaia Inter College Risalpur', initials: 'FR', principal: 'Brig Imran Shah', contact: '03009887766' },
  { id: 211, name: 'Army Public School Nowshera', initials: 'AN', principal: 'Col Asad Khan', contact: '03337654321' },
  { id: 212, name: 'Pak-Turk Maarif International School', initials: 'PT', principal: 'Hasan Yilmaz', contact: '03214433221' },
]

export const INACTIVE_SCHOOLS = [
  { id: 301, name: 'Daffodils School', principal: 'Ali Ahmed', contact: '03001111111' },
  { id: 302, name: 'Saeed Public School (High Section)', principal: 'Saeed Khan', contact: '03012222222' },
  { id: 303, name: 'SPS- Middle Branch', principal: 'Saba Perveen', contact: '03023333333' },
  { id: 304, name: 'SPS- Middle Section', principal: 'Nadia Butt', contact: '03034444444' },
]

/* Combine all buckets, tagging source + a 6-digit code + avatar initials. */
export function getAllSchools() {
  const withMeta = (s, source) => ({
    ...s,
    source,
    schoolCode: String(s.id).padStart(6, '0'),
    initials: (s.initials || s.name.slice(0, 2)).toUpperCase(),
  })
  return [
    ...LAUNCH_SCHOOLS.map((s) => withMeta(s, 'launch')),
    ...ERP_SCHOOLS.map((s) => withMeta(s, 'erp')),
    ...INACTIVE_SCHOOLS.map((s) => withMeta(s, 'inactive')),
  ]
}

/* ── Core toggles + module catalog (drives the modal) ── */
export const CORE_PERMS = [
  { key: 'erpAccess', name: 'ERP Access', icon: 'fa-server', desc: 'Allow this school to log in and use the main ERP system.' },
]

export const MODULE_SECTIONS = [
  { label: '📚 Academics', items: [
    { key: 'academics', name: 'Academics', icon: 'fa-graduation-cap' },
    { key: 'examination', name: 'Examination', icon: 'fa-file-alt' },
    { key: 'papergenerator', name: 'Paper Generator', icon: 'fa-file-pen' },
    { key: 'attendance', name: 'Attendance', icon: 'fa-clipboard-check' },
    { key: 'timetable', name: 'Time Table', icon: 'fa-calendar-days' },
  ] },
  { label: '💰 Accounts', items: [
    { key: 'fee', name: 'Fee', icon: 'fa-money-bill-wave' },
    { key: 'accounts', name: 'Accounts', icon: 'fa-calculator' },
    { key: 'inventory', name: 'Inventory', icon: 'fa-boxes-stacking' },
  ] },
  { label: '🏫 Administration', items: [
    { key: 'admissioncrm', name: 'Admission CRM', icon: 'fa-user-plus' },
    { key: 'students', name: 'Students', icon: 'fa-user-graduate' },
    { key: 'hr', name: 'Human Resource', icon: 'fa-people-group' },
    { key: 'staffappraisals', name: 'Staff Appraisals', icon: 'fa-star-half-stroke' },
  ] },
  { label: '🎓 School Mentor', items: [
    { key: 'schoolsops', name: 'School SOPs', icon: 'fa-book-open' },
    { key: 'teachertrainings', name: 'Teacher Trainings', icon: 'fa-chalkboard-user' },
  ] },
  { label: '⚙️ Core System', items: [
    { key: 'auditlogs', name: 'Audit Logs', icon: 'fa-clock-rotate-left' },
    { key: 'settings', name: 'Settings', icon: 'fa-gear' },
    { key: 'userpermissions', name: 'User Permissions', icon: 'fa-key' },
  ] },
]

export const MODULE_KEYS = MODULE_SECTIONS.flatMap((s) => s.items.map((i) => i.key))

export function getDefaultPerms(school) {
  const erpActive = school.source === 'erp'
  const modules = {}
  MODULE_KEYS.forEach((k) => { modules[k] = erpActive })
  // A few default to off regardless of ERP status (matches the design).
  modules.inventory = false
  modules.staffappraisals = false
  modules.schoolsops = false
  modules.teachertrainings = false
  return { erpAccess: erpActive, transport: false, headFee: false, modules }
}

/* ── localStorage-backed permission store ── */
const STORE_KEY = 'csp_school_permissions'

export function loadPermStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {} } catch { return {} }
}
export function savePermStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

/* Get perms for a school, seeding defaults if absent. */
export function getSchoolPerms(store, school) {
  return store[school.id] || getDefaultPerms(school)
}
