/* ═══════════════════════════════════════════════════════════════════
   TUTORIAL LINKS — central registry of tutorial topics per module.
   Each entry has a friendly title and an items[] array of
   { label, url } pairs. URLs are placeholders for YouTube/video links
   that can be filled in later. An empty url shows a "Coming Soon"
   message inside the TutorialModal instead of opening a new tab.

   Add or extend entries here as new modules ship — the TutorialModal
   reads everything from this file, no UI changes needed.
   ═══════════════════════════════════════════════════════════════════ */
export const TUTORIAL_LINKS = {
  dashboard: {
    title: 'Dashboard Tutorials',
    items: [
      { label: 'Admin Dashboard Overview',   url: '' },
      { label: 'Teacher Dashboard Overview', url: '' },
      { label: 'Quick Stats & KPIs',         url: '' },
      { label: 'Activity Calendar',          url: '' },
    ],
  },
  academics: {
    title: 'Academics Tutorials',
    items: [
      { label: 'Scheme of Studies',               url: 'https://youtu.be/rfX7-vTmTL0' },
      { label: 'Lesson Plan — Session Setting',   url: 'https://youtu.be/ykR3JKIa-Pw' },
      { label: 'Lesson Plan — Term Breakup',      url: 'https://youtu.be/LT4JO0BbeUc' },
      { label: 'Lesson Plan — Create Lesson Plan', url: 'https://youtu.be/0MV6KhL7wGg' },
      { label: 'Lesson Plan — Submission',        url: 'https://youtu.be/FUxY6UWl7P4' },
    ],
  },
  examination: {
    title: 'Examination Tutorials',
    items: [
      { label: 'Exam Setup',                 url: 'https://youtu.be/YLKC4DJTrTM' },
      { label: 'Date Sheet',                 url: 'https://youtu.be/sVabf9oMi7Y' },
      { label: 'Syllabus',                   url: 'https://youtu.be/eCtdYg3ngpg' },
      { label: 'Results',                    url: 'https://youtu.be/PVE-0Q49PmM' },
      { label: 'Result History',             url: 'https://youtu.be/_LVgvMtM2wM' },
      { label: 'Single Assessment Result',   url: 'https://youtu.be/_LVgvMtM2wM' },
      { label: 'Combined Assessment Result', url: 'https://youtu.be/bbyw9yDxosw' },
    ],
  },
  paperGenerator: {
    title: 'Paper Generator Tutorials',
    items: [
      { label: 'Paper Setup',        url: 'https://youtu.be/_wN6BNGM1SQ' },
      { label: 'Paper Generator',    url: 'https://youtu.be/34DXZDBgHdA' },
      { label: 'Download & Preview', url: 'https://youtu.be/8xeFvuNteCQ' },
    ],
  },
  attendance: {
    title: 'Attendance Tutorials',
    items: [
      { label: 'Holiday Setup',      url: 'https://youtu.be/BJLDGo2j6nU' },
      { label: 'Staff Attendance',   url: 'https://youtu.be/15MhiM8nA5k' },
      { label: 'Student Attendance', url: 'https://youtu.be/HEZZxFHf_Qs' },
    ],
  },
  timeTable: {
    title: 'Timetable Tutorials',
    items: [
      { label: 'Auto Generated', url: 'https://youtu.be/K6heCAirzdg' },
      { label: 'Stats',          url: 'https://youtu.be/rps5Cdn80Mo' },
      { label: 'Reports',        url: 'https://youtu.be/JW1RkeZF14A' },
    ],
  },
  fee: {
    title: 'Fee Management Tutorials',
    items: [
      { label: 'Fee Challan',                     url: 'https://youtu.be/6gLaNYaaTLw' },
      { label: 'Fee History',                     url: 'https://youtu.be/3MgbO0ycxw4' },
      { label: 'Fee Receiving — Individual Fee',  url: 'https://youtu.be/8oJJr69-_iU' },
      { label: 'Fee Receiving — Family Tree',     url: 'https://youtu.be/rr6dijHNGAk' },
      { label: 'Setup — Student Fee Setup',       url: 'https://youtu.be/2NRBzvnwxAU' },
      { label: 'Setup — Transport Fee',           url: 'https://youtu.be/x8d85GxNBPE' },
      { label: 'Setup — Challan Setting',         url: 'https://youtu.be/8QnCYWK8n6E' },
      { label: 'Reports',                         url: 'https://youtu.be/ASUbe8uRiS' },
    ],
  },
  accounts: {
    title: 'Accounts Tutorials',
    items: [
      { label: 'Accounts Overview', url: 'https://youtu.be/Ev_HpgCnrKw' },
      { label: 'Chart of Accounts', url: '' },
      { label: 'Transactions',      url: '' },
      { label: 'Account Books',     url: '' },
      { label: 'Reports',           url: '' },
    ],
  },
  inventory: {
    title: 'Inventory Tutorials',
    items: [
      { label: 'Categories',     url: '' },
      { label: 'Items / Stock',  url: '' },
      { label: 'Issue / Return', url: '' },
      { label: 'Reports',        url: '' },
    ],
  },
  admissionCrm: {
    title: 'Admission CRM Tutorials',
    items: [
      { label: 'Active Leads',    url: '' },
      { label: 'Inactive Leads',  url: '' },
      { label: 'Lead Setup',      url: '' },
      { label: 'Reports',         url: '' },
    ],
  },
  students: {
    title: 'Students Tutorials',
    items: [
      { label: 'Active Students',   url: 'https://youtu.be/IWJ5v7hxFtw' },
      { label: 'Inactive Students', url: 'https://youtu.be/J5OIGaq-Q60' },
      { label: 'Family Tree',       url: 'https://youtu.be/yoaTL7MjCKs' },
    ],
  },
  humanResource: {
    title: 'Human Resource Tutorials',
    items: [
      { label: 'Basics',              url: 'https://youtu.be/IAWUptT6Lzo' },
      { label: 'Employee Management', url: 'https://youtu.be/ANcHWr6jV0c' },
      { label: 'Financials',          url: 'https://youtu.be/sVqy-1uV7ME' },
      { label: 'Reports',             url: 'https://youtu.be/ZgFUzGp0ZxM' },
    ],
  },
  staffAppraisal: {
    title: 'Staff Appraisals Tutorials',
    items: [
      { label: 'Setup Framework',   url: '' },
      { label: 'New Appraisal',     url: '' },
      { label: 'View / Edit',       url: '' },
      { label: 'Reports',           url: '' },
    ],
  },
  schoolSops: {
    title: 'Policy Manuals Tutorials',
    items: [
      { label: 'Browse SOPs',  url: '' },
      { label: 'Acknowledge',  url: '' },
      { label: 'Search & Filters', url: '' },
    ],
  },
  teacherTrainings: {
    title: 'Teacher Trainings Tutorials',
    items: [
      { label: 'Browse Trainings', url: '' },
      { label: 'Enroll',           url: '' },
      { label: 'Track Progress',   url: '' },
    ],
  },
  auditLogs: {
    title: 'Audit Logs Tutorials',
    items: [
      { label: 'Filter & Search', url: '' },
      { label: 'Export Reports',  url: '' },
      { label: 'Review Changes',  url: '' },
    ],
  },
  settings: {
    title: 'Settings Tutorials',
    items: [
      { label: 'Academic Session',     url: 'https://youtu.be/0OPZDbZSFP0' },
      { label: 'Signature Management', url: 'https://youtu.be/yjCFkE7ad00' },
    ],
  },
  userPermissions: {
    title: 'User Permissions Tutorials',
    items: [
      { label: 'User Permissions', url: 'https://youtu.be/Cv9QTGZjSCs' },
      { label: 'Roles',            url: 'https://youtu.be/ZzIncYc3oH4' },
    ],
  },
  launchSetup: {
    title: 'Launch Setup Tutorials',
    items: [
      { label: 'Module Activation', url: '' },
      { label: 'School Profile',    url: '' },
      { label: 'Initial Configuration', url: '' },
    ],
  },
  /* Setup app (src/App.js) — the 6 initial-setup tabs (School / Classes /
     Subjects / Departments / Staff Details / Student Details). Passed as
     moduleKey="launch-setup" (hyphen), distinct from the ERP "Activated
     Modules" page above which uses `launchSetup`. */
  'launch-setup': {
    title: 'Launch Setup Tutorials',
    items: [
      { label: 'School',          url: 'https://youtu.be/ltR0mKrSFAY' },
      { label: 'Classes',         url: 'https://youtu.be/1uKofOjox30' },
      { label: 'Subjects',        url: 'https://youtu.be/ZIkVnDsCpvs' },
      { label: 'Departments',     url: 'https://youtu.be/nw6a_et253Q' },
      { label: 'Staff Details',   url: 'https://youtu.be/PQbBtpgSdu0' },
      { label: 'Student Details', url: 'https://youtu.be/hNgS9zmyOPw' },
    ],
  },
};
