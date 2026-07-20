/* ═══════════════════════════════════════════════════════════════════
   Sidebar navigation + module metadata. One source of truth for the
   sidebar, breadcrumb and the route table.
   ═══════════════════════════════════════════════════════════════════ */

export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' }],
  },
  {
    label: 'Academics & ERP',
    items: [
      { key: 'academics', path: '/academics', label: 'Academics', icon: 'fa-graduation-cap' },
      { key: 'permissions', path: '/school-permissions', label: 'School Permissions', icon: 'fa-key' },
      { key: 'progress', path: '/school-progress', label: 'School Progress', icon: 'fa-chart-line' },
      { key: 'payments', path: '/school-payments', label: 'School Payments', icon: 'fa-credit-card' },
      { key: 'sops', path: '/sops', label: 'Operational SOPs', icon: 'fa-book-open' },
    ],
  },
  {
    label: 'HR & Finance',
    items: [
      { key: 'hr', path: '/hr', label: 'Human Resource', icon: 'fa-users-gear' },
      { key: 'accounts', path: '/accounts', label: 'Accounts', icon: 'fa-coins' },
      { key: 'attendance', path: '/attendance', label: 'Attendance', icon: 'fa-calendar-check' },
      { key: 'inventory', path: '/inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
    ],
  },
  {
    label: 'Training & Admin',
    items: [
      { key: 'trainings', path: '/trainings', label: 'Trainings', icon: 'fa-chalkboard-user' },
      { key: 'notifications', path: '/notifications', label: 'Notifications', icon: 'fa-bell' },
      { key: 'userpermissions', path: '/user-permissions', label: 'User Permissions', icon: 'fa-shield-halved' },
      { key: 'settings', path: '/settings', label: 'Settings', icon: 'fa-sliders' },
    ],
  },
]

/* Flat lookup for the breadcrumb (path → label). */
export const NAV_BY_PATH = Object.fromEntries(
  NAV_SECTIONS.flatMap((s) => s.items).map((i) => [i.path, i]),
)

/* Modules that are placeholders for now — rendered with <ComingSoon />.
   Settings + Dashboard are real and excluded here. */
export const COMING_SOON_MODULES = [
  { path: '/academics', title: 'Academics', icon: 'fa-graduation-cap', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', sub: 'Manage academic structures, calendars, lesson planning and academic monitoring.', emptySub: 'This module will be designed in the next step. Academic structures, lesson plans, calendars and monitoring will be managed here.' },
  { path: '/school-permissions', title: 'School Permissions', icon: 'fa-key', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', sub: 'Control ERP access, module visibility and feature permissions for each school.', emptySub: 'This module will be designed in the next step. ERP module toggles, access control and feature permissions per school will be configured here.' },
  { path: '/school-progress', title: 'School Progress', icon: 'fa-chart-line', grad: 'linear-gradient(135deg,#0369a1,#0284c7)', sub: 'Track school onboarding, ERP usage, follow-ups, progress and training status.', emptySub: 'This module will be designed in the next step. Onboarding status, ERP usage tracking, follow-up logs and training progress will be displayed here.' },
  { path: '/school-payments', title: 'School Payments', icon: 'fa-credit-card', grad: 'linear-gradient(135deg,#15803d,#16a34a)', sub: 'Manage payment setup, challans, receiving, reports and school payment records.', emptySub: 'This module will be designed in the next step. Payment setup, challan generation, fee receiving and financial reports will be managed here.' },
  { path: '/sops', title: 'Operational SOPs', icon: 'fa-book-open', grad: 'linear-gradient(135deg,#b45309,#d97706)', sub: 'Upload, manage and organize SOP manuals, forms and tutorial videos.', emptySub: 'This module will be designed in the next step. SOP manuals, downloadable forms and training video links will be organized and managed here.' },
  { path: '/hr', title: 'Human Resource', icon: 'fa-users-gear', grad: 'linear-gradient(135deg,#1E3A8A,#2563EB)', sub: 'Manage departments, designations, employees, payroll support and HR records.', emptySub: 'This module will be designed in the next step. Departments, designations, employee records, payroll and HR management will be available here.' },
  { path: '/accounts', title: 'Accounts', icon: 'fa-coins', grad: 'linear-gradient(135deg,#15803d,#16a34a)', sub: 'Manage financial entries, ledgers, account books and financial reports.', emptySub: 'This module will be designed in the next step. Financial entries, ledgers, account books and detailed financial reports will be managed here.' },
  { path: '/attendance', title: 'Attendance', icon: 'fa-calendar-check', grad: 'linear-gradient(135deg,#0369a1,#0284c7)', sub: 'Monitor student and staff attendance, holidays and attendance reports.', emptySub: 'This module will be designed in the next step. Student and staff attendance tracking, holiday management and attendance reports will be available here.' },
  { path: '/inventory', title: 'Inventory', icon: 'fa-boxes-stacked', grad: 'linear-gradient(135deg,#b45309,#d97706)', sub: 'Manage school assets, stock, issue records and inventory reports.', emptySub: 'This module will be designed in the next step. Asset management, stock tracking, issue records and inventory reports will be managed here.' },
  { path: '/trainings', title: 'Trainings', icon: 'fa-chalkboard-user', grad: 'linear-gradient(135deg,#6D28D9,#7C3AED)', sub: 'Manage recorded trainings, upcoming trainings, trainers and training categories.', emptySub: 'This module will be designed in the next step. Recorded sessions, upcoming training schedules, trainer profiles and training categories will be managed here.' },
  { path: '/notifications', title: 'Notifications', icon: 'fa-bell', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', sub: 'Create and manage announcements, alerts and school-wide notifications.', emptySub: 'This module will be designed in the next step. Announcements, SMS/app alerts and school-wide notification management will be available here.' },
  { path: '/user-permissions', title: 'User Permissions', icon: 'fa-shield-halved', grad: 'linear-gradient(135deg,#b91c1c,#dc2626)', sub: 'Manage users, roles, access levels, permissions and audit visibility.', emptySub: 'This module will be designed in the next step. User roles, access level management, permission matrices and audit visibility will be configured here.' },
]
