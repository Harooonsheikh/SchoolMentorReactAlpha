/* ═══════════════════════════════════════════════════════════════════
   Per-module tutorial videos. Each module shows one short video per main
   tab. Swap the `SAMPLE` URLs with the real YouTube tutorial links — keep
   the `https://www.youtube.com/embed/<id>` (embed) form.
   ═══════════════════════════════════════════════════════════════════ */
const SAMPLE = 'https://www.youtube.com/embed/aqz-KE-bpKQ' // placeholder — replace per tab
const v = (tab, url = SAMPLE) => ({ tab, url })

export const TUTORIALS = {
  '/dashboard': { icon: 'fa-gauge-high', videos: [v('Dashboard Overview')] },
  '/academics': { icon: 'fa-graduation-cap', videos: [v('Scheme of Studies'), v('Lesson Plans')] },
  '/school-permissions': { icon: 'fa-key', videos: [v('Managing School Permissions')] },
  '/school-progress': { icon: 'fa-chart-line', videos: [v('School Progress'), v('Follow-up Cards')] },
  '/school-payments': { icon: 'fa-credit-card', videos: [v('Payment Setup'), v('Challans'), v('Receiving'), v('Reports')] },
  '/sops': { icon: 'fa-book-open', videos: [v('Operational SOPs & Forms')] },
  '/trainings': { icon: 'fa-chalkboard-user', videos: [v('Recorded Trainings'), v('Upcoming Trainings')] },
  '/notifications': { icon: 'fa-bell', videos: [v('Sending Notifications')] },
  '/user-permissions': { icon: 'fa-shield-halved', videos: [v('Assign School'), v('User Permission')] },
  '/accounts': { icon: 'fa-file-invoice-dollar', videos: [v('Chart of Accounts'), v('Transactions'), v('Account Books'), v('Reports')] },
  '/inventory': { icon: 'fa-boxes-stacked', videos: [v('Inventory Management'), v('Point of Sale'), v('Reports')] },
  '/hr': { icon: 'fa-users-gear', videos: [v('HR Basics'), v('Employee Management'), v('Payroll'), v('Reports')] },
  '/attendance': { icon: 'fa-user-check', videos: [v('Holidays Setup'), v('Staff Attendance'), v('Reports')] },
  '/settings': { icon: 'fa-gear', videos: [v('Chain / Franchise Profile'), v('Connected Schools'), v('Classes & Subjects')] },
}

export const DEFAULT_TUTORIAL = { icon: 'fa-circle-play', videos: [v('Module Walkthrough')] }
export const tutorialFor = (path) => TUTORIALS[path] || DEFAULT_TUTORIAL
