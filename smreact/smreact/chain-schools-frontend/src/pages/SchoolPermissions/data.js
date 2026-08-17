/* ═══════════════════════════════════════════════════════════════════
   SCHOOL PERMISSIONS — permission helpers.
   Schools ab Chain-Management API se aate hain (network-schools/manage,
   action: getbynetwork → accepted rows) — ViewProvider ke zariye. Yahan
   sirf unhe screen ki shape me dhalte hain. Module permissions Super-Admin
   API se aati/jaati hain (dekhein api/schoolPermissionsApi.js).
   ═══════════════════════════════════════════════════════════════════ */

import { emptyModules } from '../../api/schoolPermissionsApi'

/* ViewContext ka connected-school row → is screen ki row.
   (ViewProvider `id` par branchID rakhta hai, `rowId` par network-school id.) */
export function toPermissionRow(s) {
  const name = s.name || `Branch #${s.id}`
  return {
    id: s.id,                                   // branchID — module perms isi se store hoti hain
    rowId: s.rowId,                             // network-school row id — update call ke liye
    branchId: s.id,
    name,
    schoolCode: s.code || String(s.id ?? ''),   // branchCode
    email: s.email || '',
    contact: s.phone || '',
    address: s.address || '',
    initials: name.slice(0, 2).toUpperCase(),
    /* ERP status API se: network ne is school ko access di hui hai ya nahi. */
    networkPermission: !!s.networkPermission,
    isActive: s.isActive !== false,
    branchIsActive: s.branchIsActive !== false,
  }
}

export function toPermissionRows(schools) {
  return (schools || []).map(toPermissionRow)
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

/* Aik school ki poori permissions — dono Super-Admin API se:
   erpAccess launch-setup se aata hai, modules module-permission se. */
export function getSchoolPerms(moduleStore, school, erpAccess) {
  return {
    erpAccess: !!erpAccess,
    modules: moduleStore[school.id] || emptyModules(),
  }
}
