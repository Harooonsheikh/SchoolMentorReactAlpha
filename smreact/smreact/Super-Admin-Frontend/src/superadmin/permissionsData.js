/* ═══════════════════════════════════════════════════════════════════
   SCHOOL PERMISSIONS — demo data + helpers (frontend only)

   Ported from "User Permission, quiz, SOPs, and PAYMENTS .html". The HTML
   combines three school sources (launch / erp / inactive) into one list;
   here they are merged into a single representative dataset, each tagged
   with its `source`. Mock data only — the integrating developer replaces
   SCHOOLS with API data and wires save() to a real endpoint.
   ═══════════════════════════════════════════════════════════════════ */

/* Core (top) permissions shown as cards at the top of the modal. */
export const CORE_PERMS = [
  { key: 'erpAccess', name: 'ERP Access',              icon: 'fa-server',             desc: 'Allow this school to log in and use the main ERP system.' },
  { key: 'transport', name: 'Transport Fee',           icon: 'fa-bus',                desc: 'Enable transport fee management for this school.' },
  { key: 'headFee',   name: 'Head-wise Fee Receiving', icon: 'fa-money-bill-transfer', desc: 'Enable receiving fee by individual fee heads.' },
];

/* Module permissions, grouped exactly as in the design. */
export const MODULE_GROUPS = [
  { label: 'Academics', modules: [
    { key: 'academics',      name: 'Academics',       icon: 'fa-graduation-cap' },
    { key: 'examination',    name: 'Examination',     icon: 'fa-file-alt' },
    { key: 'papergenerator', name: 'Paper Generator', icon: 'fa-file-pen' },
    { key: 'attendance',     name: 'Attendance',      icon: 'fa-clipboard-check' },
    { key: 'timetable',      name: 'Time Table',      icon: 'fa-calendar-days' },
  ] },
  { label: 'Accounts', modules: [
    { key: 'fee',       name: 'Fee',       icon: 'fa-money-bill-wave' },
    { key: 'accounts',  name: 'Accounts',  icon: 'fa-calculator' },
    { key: 'inventory', name: 'Inventory', icon: 'fa-boxes-stacking' },
  ] },
  { label: 'Administration', modules: [
    { key: 'admissioncrm',   name: 'Admission CRM',    icon: 'fa-user-plus' },
    { key: 'students',       name: 'Students',         icon: 'fa-user-graduate' },
    { key: 'hr',             name: 'Human Resource',   icon: 'fa-people-group' },
    { key: 'staffappraisals', name: 'Staff Appraisals', icon: 'fa-star-half-stroke' },
  ] },
  { label: 'School Mentor', modules: [
    { key: 'schoolsops',       name: 'School SOPs',       icon: 'fa-book-open' },
    { key: 'teachertrainings', name: 'Teacher Trainings', icon: 'fa-chalkboard-user' },
  ] },
  { label: 'Core System', modules: [
    { key: 'auditlogs',       name: 'Audit Logs',       icon: 'fa-clock-rotate-left' },
    { key: 'settings',        name: 'Settings',         icon: 'fa-gear' },
    { key: 'userpermissions', name: 'User Permissions', icon: 'fa-key' },
  ] },
];

/* Flat list of all module keys (active/inactive counts use this). */
export const ALL_MODULE_KEYS = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

/* Source pill meta. */
export const SOURCE_BADGE = {
  erp:      { cls: 'b-blue', label: 'ERP' },
  inactive: { cls: 'b-gray', label: 'Inactive' },
  launch:   { cls: 'b-warn', label: 'Launch' },
};

const ini = (name) => name.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'SM';

/* Combined demo schools (a representative slice of launch / erp / inactive). */
const RAW = [
  // ── ERP (active by default) ──
  { id: 201, name: 'AES School System',                   principal: 'AES Admin',       contact: '03001234001', source: 'erp' },
  { id: 202, name: 'Jinnah Educational Complex School',   principal: 'JE Admin',        contact: '03009876543', source: 'erp' },
  { id: 203, name: 'The Creative School',                 principal: 'Creative Admin',  contact: '03112233445', source: 'erp' },
  { id: 204, name: 'Beaconhouse School System Gulberg',   principal: 'Tariq Mahmood',   contact: '03214567890', source: 'erp' },
  { id: 205, name: 'The City School Johar Town',          principal: 'Sana Malik',      contact: '03321122334', source: 'erp' },
  { id: 206, name: 'Roots International School F-10',      principal: 'Faisal Qureshi',  contact: '03451234567', source: 'erp' },
  { id: 207, name: 'Lahore Grammar School DHA',           principal: 'Ayesha Raza',     contact: '03001112222', source: 'erp' },
  { id: 208, name: 'Allied School Gulshan Campus',        principal: 'Usman Ghani',     contact: '03339988776', source: 'erp' },
  { id: 209, name: 'Divisional Public School Rawalpindi', principal: 'Khalid Mehmood',  contact: '03125556677', source: 'erp' },
  { id: 210, name: 'Fazaia Inter College Risalpur',       principal: 'Brig Imran Shah', contact: '03009887766', source: 'erp' },
  // ── Launch (inactive by default) ──
  { id: 2,  name: 'STEM Learning Hub',            principal: 'Ahmed Khan',  contact: '03001234567', source: 'launch' },
  { id: 4,  name: 'Al Asad School System Tangi',  principal: 'Bilal Hassan', contact: '03331234567', source: 'launch' },
  { id: 10, name: 'STARS SCHOOL SYSTEM Nowshera virkan', principal: 'Zainab Noor', contact: '03001111111', source: 'launch' },
  { id: 11, name: 'World E Education Islamic School', principal: 'Omar Farooq', contact: '03129999999', source: 'launch' },
  { id: 13, name: 'The Spirit School',            principal: 'Spirit Admin', contact: '03221234321', source: 'launch' },
  // ── Inactive ──
  { id: 301, name: 'Daffodils School',                  principal: 'Ali Ahmed',    contact: '03001111111', source: 'inactive' },
  { id: 302, name: 'Saeed Public School (High Section)', principal: 'Saeed Khan',  contact: '03012222222', source: 'inactive' },
  { id: 303, name: 'SPS- Middle Branch',                principal: 'Saba Perveen', contact: '03023333333', source: 'inactive' },
];

export const SCHOOLS = RAW.map((s) => ({
  ...s,
  initials: ini(s.name),
  schoolCode: String(s.id).padStart(6, '0'),
}));

/* Default permissions for a school: ERP schools start active, others off. */
export function defaultPerms(school) {
  const on = school.source === 'erp';
  return {
    erpAccess: on,
    transport: false,
    headFee: false,
    modules: {
      academics: on, examination: on, papergenerator: on, attendance: on, timetable: on,
      fee: on, accounts: on, inventory: false,
      admissioncrm: on, students: on, hr: on, staffappraisals: false,
      schoolsops: false, teachertrainings: false,
      auditlogs: on, settings: on, userpermissions: on,
    },
  };
}

/* Build the initial { schoolId: perms } map for all demo schools. */
export function buildInitialPerms() {
  const map = {};
  SCHOOLS.forEach((s) => { map[s.id] = defaultPerms(s); });
  return map;
}
