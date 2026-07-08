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
      { label: 'Subject Setup',  url: '' },
      { label: 'Term Settings',  url: '' },
      { label: 'Term Breakups',  url: '' },
      { label: 'Textbooks',      url: '' },
    ],
  },
  examination: {
    title: 'Examination Tutorials',
    items: [
      { label: 'Exam Setup',           url: '' },
      { label: 'Date Sheet',           url: '' },
      { label: 'Syllabus',             url: '' },
      { label: 'Single Assessment',    url: '' },
      { label: 'Combined Assessment',  url: '' },
      { label: 'Result History',       url: '' },
    ],
  },
  paperGenerator: {
    title: 'Paper Generator Tutorials',
    items: [
      { label: 'Paper Setup',        url: '' },
      { label: 'Choose Template',    url: '' },
      { label: 'Class Format & Lines', url: '' },
      { label: 'Generate Paper',     url: '' },
      { label: 'Download & Preview', url: '' },
    ],
  },
  attendance: {
    title: 'Attendance Tutorials',
    items: [
      { label: 'Holidays Setup',     url: '' },
      { label: 'Student Attendance', url: '' },
      { label: 'Staff Attendance',   url: '' },
      { label: 'Reports',            url: '' },
    ],
  },
  timeTable: {
    title: 'Timetable Tutorials',
    items: [
      { label: 'Class Timetable',     url: '' },
      { label: 'Weekly Auto-Generate', url: '' },
      { label: 'Day-wise Update',     url: '' },
      { label: 'Download Reports',    url: '' },
    ],
  },
  fee: {
    title: 'Fee Management Tutorials',
    items: [
      { label: 'Fee Setup & Settings', url: '' },
      { label: 'Fee Challans',         url: '' },
      { label: 'Fee Receiving',        url: '' },
      { label: 'Fee History',          url: '' },
      { label: 'Reports',              url: '' },
    ],
  },
  accounts: {
    title: 'Accounts Tutorials',
    items: [
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
      { label: 'Active Students',   url: '' },
      { label: 'Inactive Students', url: '' },
      { label: 'Family Tree',       url: '' },
    ],
  },
  humanResource: {
    title: 'Human Resource Tutorials',
    items: [
      { label: 'Departments & Designations', url: '' },
      { label: 'Staff Records',              url: '' },
      { label: 'Attendance & Leave',         url: '' },
      { label: 'Payroll',                    url: '' },
      { label: 'Reports',                    url: '' },
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
    title: 'School SOPs Tutorials',
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
      { label: 'Academic Sessions',    url: '' },
      { label: 'Signature Management', url: '' },
    ],
  },
  userPermissions: {
    title: 'User Permissions Tutorials',
    items: [
      { label: 'Users',             url: '' },
      { label: 'Roles',             url: '' },
      { label: 'Permission Groups', url: '' },
      { label: 'Audit Log',         url: '' },
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
};
