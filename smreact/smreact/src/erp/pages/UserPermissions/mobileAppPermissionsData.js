/* ═══════════════════════════════════════════════════════════════════
   MOBILE APP PERMISSIONS — mock data + constants

   Companion to permissionsData.js, kept in its own file so the ERP
   "Access" category (MODULE_TREE / MODULE_PERMISSIONS) is never
   touched by this feature. Everything here is in-memory, following
   the same pattern as the rest of User Permissions — replace with API
   calls when a backend lands; the shape is stable.

   Two mobile app roles exist today, each with its own flat feature
   list (mirrors the real School Mentor mobile app's Admin / Teacher
   home screens — a set of feature tiles, not a screen×action matrix,
   so permissions here are simple on/off toggles per feature). ─────── */

export const MOBILE_ROLES = [
  { id: 'admin',   label: 'Admin App',   icon: 'fa-user-tie',          desc: 'Principal / school-owner view of the mobile app' },
  { id: 'teacher', label: 'Teacher App', icon: 'fa-chalkboard-user',   desc: 'Classroom teacher view of the mobile app' },
];

/* ─── Admin App — grouped exactly like the real Admin home screen. ─── */
export const ADMIN_APP_GROUPS = [
  { label: 'Academic Operations', items: [
    { id: 'dashboard',    label: 'Dashboard',     icon: 'fa-gauge-high' },
    { id: 'onlinequiz',   label: 'Online Quiz',   icon: 'fa-circle-question' },
    { id: 'lessonplans',  label: 'Lesson Plans',  icon: 'fa-chalkboard' },
    { id: 'submissions',  label: 'Submissions',   icon: 'fa-inbox' },
    { id: 'homework',     label: 'Homework',      icon: 'fa-book-open' },
    { id: 'notebook',     label: 'Notebook',      icon: 'fa-note-sticky' },
    { id: 'datesheet',    label: 'Date Sheet',    icon: 'fa-calendar-check' },
    { id: 'syllabus',     label: 'Syllabus',      icon: 'fa-list-check' },
    { id: 'results',      label: 'Results',       icon: 'fa-chart-simple' },
  ] },
  { label: 'Academic Section', items: [
    { id: 'academics',    label: 'Academics',     icon: 'fa-book-open-reader' },
    { id: 'noticeboard',  label: 'Notice Board',  icon: 'fa-bullhorn' },
  ] },
  { label: 'Administrative Operations', items: [
    { id: 'tasks',        label: 'Tasks',         icon: 'fa-clipboard-list' },
    { id: 'meetings',     label: 'Meetings',      icon: 'fa-video' },
    { id: 'timetable',    label: 'Timetable',     icon: 'fa-calendar-days' },
    { id: 'attendance',   label: 'Attendance',    icon: 'fa-clipboard-check' },
  ] },
  { label: 'Reports Section', items: [
    { id: 'reports',      label: 'Reports',       icon: 'fa-chart-line' },
    { id: 'staffleaves',  label: 'Staff Leaves',  icon: 'fa-umbrella-beach' },
    { id: 'suggestions',  label: 'Suggestions',   icon: 'fa-lightbulb' },
    { id: 'financials',   label: 'Financials',    icon: 'fa-money-bill-wave' },
  ] },
  /* Mentor AI — each tool is independently toggleable. A user may be
     given all four, just the chat assistant, just one generator, or
     any other combination — not an all-or-nothing "Mentor AI" switch. */
  { label: 'Mentor AI', items: [
    { id: 'ai_chat',        label: 'AI Chat Assistant', icon: 'fa-comment-dots' },
    { id: 'ai_lessonplans', label: 'Lesson Plans',      icon: 'fa-wand-magic-sparkles' },
    { id: 'ai_worksheets',  label: 'Worksheets',        icon: 'fa-file-lines' },
    { id: 'ai_designs',     label: 'Designs',           icon: 'fa-palette' },
  ] },
];

/* ─── Teacher App — grouped exactly like the real Teacher home screen. ─── */
export const TEACHER_APP_GROUPS = [
  { label: 'Teaching', items: [
    { id: 'attendance',   label: 'Attendance',    icon: 'fa-clipboard-check' },
    { id: 'lessonplans',  label: 'Lesson Plans',  icon: 'fa-chalkboard' },
    { id: 'homework',     label: 'Homework',      icon: 'fa-book-open' },
    { id: 'academics',    label: 'Academics',     icon: 'fa-book-open-reader' },
    { id: 'noticeboard',  label: 'Notice Board',  icon: 'fa-bullhorn' },
    { id: 'datesheet',    label: 'Date Sheet',    icon: 'fa-calendar-check' },
    { id: 'syllabus',     label: 'Syllabus',      icon: 'fa-list-check' },
    { id: 'results',      label: 'Results',       icon: 'fa-chart-simple' },
  ] },
  { label: 'My Workspace', items: [
    { id: 'timetable',    label: 'Timetable',     icon: 'fa-calendar-days' },
    { id: 'meetings',     label: 'Meetings',      icon: 'fa-video' },
    { id: 'onlinequiz',   label: 'Online Quiz',   icon: 'fa-circle-question' },
    { id: 'tasks',        label: 'Tasks',         icon: 'fa-clipboard-list' },
  ] },
  { label: 'Personal', items: [
    { id: 'myleaves',     label: 'My Leaves',     icon: 'fa-umbrella-beach' },
    { id: 'salaryslip',   label: 'Salary Slip',   icon: 'fa-file-invoice-dollar' },
  ] },
  /* Mentor AI — same independently-toggleable shape as the Admin App
     group above (ids kept identical across both roles so a role that
     grants both apps stays consistent). */
  { label: 'Mentor AI', items: [
    { id: 'ai_chat',        label: 'AI Chat Assistant', icon: 'fa-comment-dots' },
    { id: 'ai_lessonplans', label: 'Lesson Plans',      icon: 'fa-wand-magic-sparkles' },
    { id: 'ai_worksheets',  label: 'Worksheets',        icon: 'fa-file-lines' },
    { id: 'ai_designs',     label: 'Designs',           icon: 'fa-palette' },
  ] },
];

export const MOBILE_APP_GROUPS_BY_ROLE = {
  admin:   ADMIN_APP_GROUPS,
  teacher: TEACHER_APP_GROUPS,
};

/* All items on, per role — the sensible default the first time a role
   is selected (matches how a freshly-installed app would behave: every
   tile visible until an admin deliberately restricts one). */
function allOnFor(groups) {
  const out = {};
  groups.forEach(g => g.items.forEach(it => { out[it.id] = true; }));
  return out;
}

/* Default mobile-app-access record for a user who has never had one
   configured. Access itself defaults OFF — enabling mobile access for
   a user is a deliberate action, not an implicit grant. */
export function defaultMobileAppAccess() {
  return {
    enabled: false,
    role: null,
    screenPermId: 0,
    adminApp: allOnFor(ADMIN_APP_GROUPS),
    teacherApp: allOnFor(TEACHER_APP_GROUPS),
  };
}

/* Read a user's mobile app access record, filling in defaults for any
   user record created before this feature existed — never mutates the
   user object itself. */
export function mobileAppAccessFor(user) {
  const def = defaultMobileAppAccess();
  if (!user?.mobileApp) return def;
  return {
    ...def,
    ...user.mobileApp,
    adminApp: { ...def.adminApp, ...(user.mobileApp.adminApp || {}) },
    teacherApp: { ...def.teacherApp, ...(user.mobileApp.teacherApp || {}) },
  };
}

/* Summary counts for the footer chip — only counts the active role's
   feature set, matching how the ERP side only counts applicable
   permissions. */
export function mobileAppStats(mobileApp) {
  if (!mobileApp?.enabled || !mobileApp.role) return { total: 0, active: 0 };
  const groups = MOBILE_APP_GROUPS_BY_ROLE[mobileApp.role] || [];
  const bag = mobileApp.role === 'admin' ? mobileApp.adminApp : mobileApp.teacherApp;
  let total = 0;
  let active = 0;
  groups.forEach(g => g.items.forEach(it => {
    total += 1;
    if (bag?.[it.id]) active += 1;
  }));
  return { total, active };
}

/* UI feature id → swagger field on /manage-mobileapp-screen-permission.
   API me meetings ka spelling `meatings` hai. Mentor AI Lesson Plans ka
   alag field nahi — `lessonPlans` academic + AI dono share karte hain. */
export const MOBILE_FEATURE_TO_API = {
  dashboard: 'dashboard',
  onlinequiz: 'onlineQuiz',
  lessonplans: 'lessonPlans',
  submissions: 'submissions',
  homework: 'homeWork',
  notebook: 'noteBook',
  datesheet: 'dateSheet',
  syllabus: 'syllabus',
  results: 'results',
  academics: 'academics',
  noticeboard: 'noticeBoard',
  tasks: 'tasks',
  meetings: 'meatings',
  timetable: 'timeTable',
  attendance: 'attendance',
  reports: 'reports',
  staffleaves: 'staffLeaves',
  suggestions: 'suggestions',
  financials: 'financials',
  ai_chat: 'aiChatAssistant',
  ai_lessonplans: 'lessonPlans',
  ai_worksheets: 'workSheets',
  ai_designs: 'designs',
  myleaves: 'myLeaves',
  salaryslip: 'salarySlip',
};

export const MOBILE_API_FLAG_FIELDS = [
  'dashboard', 'onlineQuiz', 'lessonPlans', 'submissions', 'homeWork', 'noteBook',
  'dateSheet', 'syllabus', 'results', 'academics', 'noticeBoard', 'tasks', 'meatings',
  'timeTable', 'attendance', 'reports', 'staffLeaves', 'suggestions', 'financials',
  'aiChatAssistant', 'workSheets', 'designs', 'myLeaves', 'salarySlip',
];

export function mobileAppTypeApi(roleId) {
  if (roleId === 'teacher') return 'Teacher';
  if (roleId === 'admin') return 'Admin';
  return '';
}

export function roleFromAppType(appType) {
  const s = String(appType || '').toLowerCase().replace(/\s+/g, '');
  if (s.includes('teacher')) return 'teacher';
  if (s.includes('admin')) return 'admin';
  return null;
}

export function mobileAccountType(user) {
  const emp = user?._employee || {};
  if (emp.isTeacher && !emp.isPrinciple) return 'Teacher';
  const label = String(user?.roleLabel || user?.designation || '').toLowerCase();
  if (label.includes('teacher')) return 'Teacher';
  if (user?.dashboardType === 'teacher') return 'Teacher';
  return 'Administrator';
}

export function emptyMobileApiFlags() {
  return Object.fromEntries(MOBILE_API_FLAG_FIELDS.map((k) => [k, false]));
}

export function flagsFromFeatureBag(bag = {}) {
  const flags = emptyMobileApiFlags();
  Object.entries(MOBILE_FEATURE_TO_API).forEach(([uiId, apiKey]) => {
    if (bag[uiId]) flags[apiKey] = true;
  });
  return flags;
}

export function featureBagFromFlags(row, groups) {
  const bag = allOnFor(groups);
  Object.keys(bag).forEach((id) => { bag[id] = false; });
  if (!row || typeof row !== 'object') return bag;
  const lower = {};
  Object.keys(row).forEach((k) => { lower[String(k).toLowerCase()] = row[k]; });
  Object.entries(MOBILE_FEATURE_TO_API).forEach(([uiId, apiKey]) => {
    if (!(uiId in bag)) return;
    const v = lower[String(apiKey).toLowerCase()];
    if (v == null || v === '') return;
    bag[uiId] = v === true || v === 1 || String(v).toLowerCase() === 'true';
  });
  return bag;
}
