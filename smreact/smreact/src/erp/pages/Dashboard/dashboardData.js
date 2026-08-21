/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD DATA — derived from the SAME mock files that power the
   actual ERP modules. Every metric on the dashboard maps to a real
   button, screen, or list in an existing module. Nothing fabricated.

   Source mapping per metric is inlined as a comment so backend devs
   can swap each `getXxx()` reader with a real API call.
   ═══════════════════════════════════════════════════════════════════ */

import { INITIAL_LOGS, hydrateLog } from '../AuditLogs/auditLogsData';
import { INITIAL_USERS, INITIAL_ROLES, INITIAL_GROUPS } from '../UserPermissions/permissionsData';

/* ─── Current academic session (from Settings → Sessions) ──────── */
export const CURRENT_SESSION = {
  id:        'sess-2025-26',
  label:     '2025-26',
  startDate: '2025-08-01',
  endDate:   '2026-07-31',
  daysLeft:  61,
};

/* ─── STUDENTS module — mock/students.js
       7 classes seeded; full population approximated for the demo
       (each section averages ~25-30 students). Inactive list has 3
       seeded rows with pending-dues breakdown. */


/* ─── ADMISSION CRM — mock/admissionCrm.js
       18 leads seeded with status, source, officer, followup. */
export const CRM_STATS = {
  totalLeads:        18,
  byStatus: [
    { label: 'Interested',       count: 7, tone: 'blue'   },
    { label: 'Call Back Later',  count: 4, tone: 'amber'  },
    { label: 'Waiting Decision', count: 3, tone: 'indigo' },
    { label: 'Visit Scheduled',  count: 3, tone: 'green'  },
    { label: 'Admission Done',   count: 1, tone: 'purple' },
  ],
  bySource: [
    { label: 'Facebook',  count: 6 },
    { label: 'WhatsApp',  count: 5 },
    { label: 'Reference', count: 4 },
    { label: 'Walk-in',   count: 3 },
  ],
  followups: {
    overdue: 5,    /* followup === 'overdue' */
    today:   3,    /* followup === 'today'   */
    tomorrow:2,    /* followup === 'tmrw'    */
    normal:  8,    /* followup === 'normal'  */
  },
  officers: [
    { name: 'Sarah Khan', leads: 6 },
    { name: 'Ahmed Raza', leads: 5 },
    { name: 'Maria Ali',  leads: 4 },
    { name: 'Raza Ahmed', leads: 3 },
  ],
};


/* ─── ACADEMICS — mock/academics.js + mock/lessonPlans.js
       25 activity calendar events with status (completed/ongoing/
       upcoming), 5 terms, lesson plan submission rows. */

/* ─── ATTENDANCE — mock/attendance.js
       Weekly off + holidays + per-class attendance records. */

/* ─── ATTENDANCE TODAY — aggregated from the schema used inside
       mock/attendance.js. We mirror the exact field names so the
       dashboard cards can later swap to useAttendance() / API with
       zero structural change.

       Student class shape (mockStudentAttendanceClasses):
         { cls, sec, total, present, absent, leave, marked,
           teacher, markedBy, markedFrom, markedTime }
       Staff shape (mockStaffAttendance):
         { name, empId, desig, dept, status, inTime, outTime, from, marked }
       Status constants (constants/attendance.js):
         PRESENT · ABSENT · LEAVE · PENDING (student)
         PRESENT · ABSENT · LEAVE          (staff)

       Percentages align with the existing ATTENDANCE_STATS values
       (todayStudentPct=91, todayStaffPct=94) so the section header
       totals stay consistent with the rest of the dashboard. */

/* ─── TIME TABLE — mock/timetable.js
       Day-wise periods per class. */

/* ─── FEE — mock/fee.js + audit log entries
       Fee structures, generated challans, receipts. */

/* ─── ACCOUNTS — mock/accounts.js
       Chart of accounts, revenue + expenditure entries. */

/* ─── INVENTORY — mock/inventory.js
       11 items, POS sales, products. */
export const INVENTORY_STATS = {
  totalItems:      11,
  activeItems:     10,
  inactiveItems:    1,
  lowStockCount:    2,        /* items where stock <= low */
  todayPosSales:   34200,     /* PKR */
  productsCount:   24,
  recentSales: [
    { receipt: 'RCP-1019', buyer: 'Walk-in',         total: 1450, time: '11:25 AM' },
    { receipt: 'RCP-1018', buyer: 'Mr. Hamza',       total: 3200, time: '10:30 AM' },
    { receipt: 'RCP-1017', buyer: 'Ms. Sarah',       total:  680, time: '09:50 AM' },
  ],
};

/* ─── APPRAISALS — mock/appraisal.js
       Appraisal records per teacher. */
export const APPRAISAL_STATS = {
  totalAppraisals:    18,
  completed:          14,
  inProgress:          3,
  drafts:              1,
  averageScore:       82,
  topPerformer:    { name: 'Ms. Nadia Iqbal', score: 94 },
};

/* ─── AUDIT LOGS — pages/AuditLogs/auditLogsData.js
       85 seed entries spanning May 2026. We derive live counts
       from that array so the dashboard stays in sync. */
function todayIso() { return '2026-05-31'; }
function weekAgoIso() { return '2026-05-25'; }



/* ─── Per-teacher scope + KPIs (Teacher dashboard) ─────────────
       Built from the same mock vocabulary: classes from Students,
       schedule from TimeTable, lesson plans from Submissions,
       activities from Academics, exams from Examination. */
export const TEACHER_SCOPES = {
  u4: {
    /* Xi — Teacher */
    name:      'Xi',
    role:      'Teacher',
    subject:   'Mathematics',
    department:'Mathematics',
    classes: [
      { id: 'c1', cls: 'Grade 5-A', subject: 'Mathematics', students: 28, room: 'R-12' },
      { id: 'c2', cls: 'Grade 6-B', subject: 'Mathematics', students: 30, room: 'R-14' },
      { id: 'c3', cls: 'Grade 7-A', subject: 'Mathematics', students: 26, room: 'R-19' },
    ],
    todaySchedule: [
      { id: 's1', time: '08:30 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Algebra Recap',          period: 1 },
      { id: 's2', time: '09:30 AM', cls: 'Grade 6-B', room: 'R-14', topic: 'Quadratic Equations',    period: 2 },
      { id: 's3', time: '11:00 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Geometry — Triangles',   period: 4 },
      { id: 's4', time: '01:30 PM', cls: 'Grade 5-A', room: 'R-12', topic: 'Practice Sheet',         period: 6 },
    ],
    lessonPlans: { pending: 2, submitted: 14, approved: 11 },
    homework:    { assigned: 18, pending: 1, submitted: 17 },
    attendance:  { present: 19, absent: 0, leave: 1, pct: 95 },
    upcomingActivities: [
      { name: 'Sports Day',     start: 'May 17',  color: '#7C3AED' },
      { name: 'Mid-Year Exams', start: 'Jun 1',   color: '#DC2626' },
    ],
    upcomingExam:   { name: 'Mid Term — Mathematics', dates: '01–05 May 2026' },
    /* Exam-task reminders (replacing the priority cards) — scoped to
       this teacher's assigned class / section / subject combinations. */
    currentExam: {
      name: 'First Term Examination 2026',
      dates: '01–10 Jun 2026',
      papers: [
        { id: 'pa1', cls: 'Grade 5-A', subject: 'Mathematics', date: '01 Jun 2026', time: '09:00 AM', room: 'R-12' },
        { id: 'pa2', cls: 'Grade 6-B', subject: 'Mathematics', date: '04 Jun 2026', time: '09:00 AM', room: 'R-14' },
        { id: 'pa3', cls: 'Grade 7-A', subject: 'Mathematics', date: '08 Jun 2026', time: '09:00 AM', room: 'R-19' },
      ],
    },
    pendingSyllabusUploads: [
      { id: 'sy1', cls: 'Grade 5-A', section: 'A', subject: 'Mathematics' },
      { id: 'sy2', cls: 'Grade 7-A', section: 'A', subject: 'Mathematics' },
    ],
    pendingMarksUploads: [
      { id: 'mk1', cls: 'Grade 5-A', section: 'A', subject: 'Mathematics' },
      { id: 'mk2', cls: 'Grade 6-B', section: 'B', subject: 'Mathematics' },
    ],
    /* Notebook Plans — unit-level notebook check submissions per teacher. */
    notebookPlans: { total: 24, submitted: 19, pending: 5 },
    /* Weekly schedule by day — same shape as todaySchedule entries.
       The Today's Schedule card lets the teacher pick a day from a
       dropdown and view that day's lessons. */
    scheduleByDay: {
      Monday: [
        { id: 'm1', time: '08:30 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Algebra Recap',          period: 1 },
        { id: 'm2', time: '09:30 AM', cls: 'Grade 6-B', room: 'R-14', topic: 'Quadratic Equations',    period: 2 },
        { id: 'm3', time: '11:00 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Geometry — Triangles',   period: 4 },
        { id: 'm4', time: '01:30 PM', cls: 'Grade 5-A', room: 'R-12', topic: 'Practice Sheet',         period: 6 },
      ],
      Tuesday: [
        { id: 't1', time: '08:30 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Coordinate Geometry',    period: 1 },
        { id: 't2', time: '10:00 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Fractions Review',       period: 3 },
        { id: 't3', time: '11:00 AM', cls: 'Grade 6-B', room: 'R-14', topic: 'Polynomials',            period: 4 },
        { id: 't4', time: '02:00 PM', cls: 'Grade 7-A', room: 'R-19', topic: 'Problem Solving',        period: 7 },
      ],
      Wednesday: [
        { id: 'w1', time: '09:30 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Decimals Worksheet',     period: 2 },
        { id: 'w2', time: '11:00 AM', cls: 'Grade 6-B', room: 'R-14', topic: 'Probability Basics',     period: 4 },
        { id: 'w3', time: '12:00 PM', cls: 'Grade 7-A', room: 'R-19', topic: 'Mensuration',            period: 5 },
      ],
      Thursday: [
        { id: 'th1', time: '08:30 AM', cls: 'Grade 6-B', room: 'R-14', topic: 'Linear Equations',      period: 1 },
        { id: 'th2', time: '10:00 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Multiplication Drills', period: 3 },
        { id: 'th3', time: '11:00 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Statistics Intro',      period: 4 },
        { id: 'th4', time: '02:30 PM', cls: 'Grade 6-B', room: 'R-14', topic: 'Class Test',            period: 7 },
      ],
      Friday: [
        { id: 'f1', time: '08:30 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Weekly Recap',           period: 1 },
        { id: 'f2', time: '11:00 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Mock Quiz',              period: 4 },
        { id: 'f3', time: '01:30 PM', cls: 'Grade 6-B', room: 'R-14', topic: 'Doubt Clearing',         period: 6 },
      ],
      Saturday: [
        { id: 'sa1', time: '09:00 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Remedial Class',        period: 1 },
        { id: 'sa2', time: '10:30 AM', cls: 'Grade 6-B', room: 'R-14', topic: 'Project Discussion',    period: 2 },
      ],
    },
    appraisal:     { status: 'Completed', score: 88, period: 'Q2 2026' },
    /* All appraisal periods for this teacher — shown in the My Appraisal
       card's selector. Each entry has a printable PDF target name (mock). */
    appraisals: [
      { id: 'ap-q3-26', period: 'Q3 2026', status: 'In Progress', score: null, by: 'Ms. Sana Mirza',  date: 'In progress',  pdf: 'appraisal-Q3-2026.pdf' },
      { id: 'ap-q2-26', period: 'Q2 2026', status: 'Completed',   score: 88,   by: 'Ms. Sana Mirza',  date: '15 Apr 2026',  pdf: 'appraisal-Q2-2026.pdf' },
      { id: 'ap-q1-26', period: 'Q1 2026', status: 'Completed',   score: 82,   by: 'Mr. Bilal Ahmed', date: '12 Jan 2026',  pdf: 'appraisal-Q1-2026.pdf' },
      { id: 'ap-q4-25', period: 'Q4 2025', status: 'Completed',   score: 79,   by: 'Mr. Bilal Ahmed', date: '18 Oct 2025',  pdf: 'appraisal-Q4-2025.pdf' },
    ],
    notifications: [
      { id: 'n1', tone: 'amber', icon: 'fa-pen-clip',     title: '1 homework awaits review for Grade 6-B', time: '1 hr ago' },
      { id: 'n2', tone: 'green', icon: 'fa-circle-check', title: 'Your Week 21 lesson plan was approved',   time: 'Yesterday' },
      { id: 'n3', tone: 'blue',  icon: 'fa-calendar-check', title: 'Staff meeting Tuesday 03:30 PM',         time: 'Yesterday' },
    ],
  },
  u5: {
    /* Pi — Teacher */
    name:      'Pi',
    role:      'Teacher',
    subject:   'English',
    department:'English',
    classes: [
      { id: 'c1', cls: 'Grade 5-A', subject: 'English', students: 28, room: 'R-12' },
      { id: 'c2', cls: 'Grade 6-B', subject: 'English', students: 30, room: 'R-14' },
      { id: 'c3', cls: 'Grade 7-A', subject: 'English', students: 26, room: 'R-19' },
    ],
    todaySchedule: [
      { id: 's1', time: '08:30 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Persuasive Writing',     period: 1 },
      { id: 's2', time: '10:00 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Reading Comprehension',  period: 3 },
      { id: 's3', time: '12:00 PM', cls: 'Grade 6-B', room: 'R-14', topic: 'Grammar — Past Perfect', period: 5 },
    ],
    lessonPlans: { pending: 1, submitted: 13, approved: 12 },
    homework:    { assigned: 16, pending: 2, submitted: 14 },
    attendance:  { present: 18, absent: 1, leave: 1, pct: 90 },
    upcomingActivities: [
      { name: 'Book Fair',  start: 'May 26',  color: '#1E40AF' },
      { name: 'Talent Show', start: 'Jun 24', color: '#E11D48' },
    ],
    upcomingExam:   { name: 'Mid Term — English', dates: '01–05 May 2026' },
    currentExam: {
      name: 'First Term Examination 2026',
      dates: '01–10 Jun 2026',
      papers: [
        { id: 'pa1', cls: 'Grade 5-A', subject: 'English', date: '02 Jun 2026', time: '09:00 AM', room: 'R-12' },
        { id: 'pa2', cls: 'Grade 6-B', subject: 'English', date: '05 Jun 2026', time: '09:00 AM', room: 'R-14' },
        { id: 'pa3', cls: 'Grade 7-A', subject: 'English', date: '09 Jun 2026', time: '09:00 AM', room: 'R-19' },
      ],
    },
    pendingSyllabusUploads: [
      { id: 'sy1', cls: 'Grade 6-A', section: 'A', subject: 'English' },
      { id: 'sy2', cls: 'Grade 7-B', section: 'B', subject: 'English' },
    ],
    pendingMarksUploads: [
      { id: 'mk1', cls: 'Grade 6-A', section: 'A', subject: 'English' },
      { id: 'mk2', cls: 'Grade 8-C', section: 'C', subject: 'English' },
    ],
    notebookPlans: { total: 20, submitted: 16, pending: 4 },
    scheduleByDay: {
      Monday: [
        { id: 'pm1', time: '08:30 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Persuasive Writing',     period: 1 },
        { id: 'pm2', time: '10:00 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Reading Comprehension',  period: 3 },
        { id: 'pm3', time: '12:00 PM', cls: 'Grade 6-B', room: 'R-14', topic: 'Grammar — Past Perfect', period: 5 },
      ],
      Tuesday: [
        { id: 'pt1', time: '09:00 AM', cls: 'Grade 6-B', room: 'R-14', topic: 'Vocabulary Drill',       period: 2 },
        { id: 'pt2', time: '10:30 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Picture Composition',    period: 3 },
        { id: 'pt3', time: '01:00 PM', cls: 'Grade 7-A', room: 'R-19', topic: 'Essay Writing',          period: 5 },
      ],
      Wednesday: [
        { id: 'pw1', time: '08:30 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Poetry Recitation',      period: 1 },
        { id: 'pw2', time: '11:00 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Reading Aloud',          period: 4 },
      ],
      Thursday: [
        { id: 'pth1', time: '08:30 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Letter Writing',        period: 1 },
        { id: 'pth2', time: '10:00 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Grammar Test',          period: 3 },
        { id: 'pth3', time: '12:00 PM', cls: 'Grade 6-B', room: 'R-14', topic: 'Story Telling',         period: 5 },
        { id: 'pth4', time: '02:30 PM', cls: 'Grade 7-A', room: 'R-19', topic: 'Debate Practice',       period: 7 },
      ],
      Friday: [
        { id: 'pf1', time: '09:30 AM', cls: 'Grade 6-B', room: 'R-14', topic: 'Comprehension Quiz',     period: 2 },
        { id: 'pf2', time: '11:00 AM', cls: 'Grade 5-A', room: 'R-12', topic: 'Spelling Bee',           period: 4 },
      ],
      Saturday: [
        { id: 'psa1', time: '09:00 AM', cls: 'Grade 7-A', room: 'R-19', topic: 'Doubt Class',           period: 1 },
      ],
    },
    appraisal:     { status: 'In Progress', score: null, period: 'Q2 2026' },
    appraisals: [
      { id: 'ap-q3-26', period: 'Q3 2026', status: 'In Progress', score: null, by: 'Ms. Sana Mirza',  date: 'In progress',  pdf: 'appraisal-Q3-2026.pdf' },
      { id: 'ap-q2-26', period: 'Q2 2026', status: 'In Progress', score: null, by: 'Ms. Sana Mirza',  date: 'In progress',  pdf: 'appraisal-Q2-2026.pdf' },
      { id: 'ap-q1-26', period: 'Q1 2026', status: 'Completed',   score: 76,   by: 'Mr. Bilal Ahmed', date: '12 Jan 2026',  pdf: 'appraisal-Q1-2026.pdf' },
      { id: 'ap-q4-25', period: 'Q4 2025', status: 'Completed',   score: 81,   by: 'Mr. Bilal Ahmed', date: '18 Oct 2025',  pdf: 'appraisal-Q4-2025.pdf' },
    ],
    notifications: [
      { id: 'n1', tone: 'amber', icon: 'fa-pen-clip',     title: '2 homework awaits review',           time: '30 min ago' },
      { id: 'n2', tone: 'green', icon: 'fa-circle-check', title: 'Your Week 21 plan approved',         time: 'Yesterday' },
      { id: 'n3', tone: 'blue',  icon: 'fa-bullhorn',     title: 'Staff meeting Tuesday 03:30 PM',     time: 'Yesterday' },
    ],
  },
};

/* ─── Each module's accent colour for module-coded tiles. */
export const MODULE_COLOR = {
  academics:   { stroke: '#1E40AF', soft: 'rgba(30, 64, 175, .10)',   strong: '#1E40AF' },
  examination: { stroke: '#4F46E5', soft: 'rgba(79, 70, 229, .10)',   strong: '#4F46E5' },
  papers:      { stroke: '#7C3AED', soft: 'rgba(124, 58, 237, .10)',  strong: '#7C3AED' },
  attendance:  { stroke: '#16A34A', soft: 'rgba(22, 163, 74, .10)',   strong: '#16A34A' },
  timetable:   { stroke: '#0891B2', soft: 'rgba(8, 145, 178, .10)',   strong: '#0891B2' },
  fee:         { stroke: '#D97706', soft: 'rgba(217, 119, 6, .10)',   strong: '#D97706' },
  accounts:    { stroke: '#0F766E', soft: 'rgba(15, 118, 110, .10)',  strong: '#0F766E' },
  inventory:   { stroke: '#EA580C', soft: 'rgba(234, 88, 12, .10)',   strong: '#EA580C' },
  admissions:  { stroke: '#E11D48', soft: 'rgba(225, 29, 72, .10)',   strong: '#E11D48' },
  students:    { stroke: '#2563EB', soft: 'rgba(37, 99, 235, .10)',   strong: '#2563EB' },
  hr:          { stroke: '#7C2D92', soft: 'rgba(124, 45, 146, .10)',  strong: '#7C2D92' },
  appraisals:  { stroke: '#B45309', soft: 'rgba(180, 83, 9, .10)',    strong: '#B45309' },
  sops:        { stroke: '#475569', soft: 'rgba(71, 85, 105, .10)',   strong: '#475569' },
  trainings:   { stroke: '#8B5CF6', soft: 'rgba(139, 92, 246, .10)',  strong: '#8B5CF6' },
  auditlogs:   { stroke: '#DC2626', soft: 'rgba(220, 38, 38, .10)',   strong: '#DC2626' },
  permissions: { stroke: '#1E3A8A', soft: 'rgba(30, 58, 138, .10)',   strong: '#1E3A8A' },
  settings:    { stroke: '#64748B', soft: 'rgba(100, 116, 139, .10)', strong: '#64748B' },
};

/* ─── SCHOOL MENTOR ANNOUNCEMENTS ─────────────────────────────
       Sent by head-office to every school. Replace with API once
       backend lands; shape is stable.

       Each row carries both a short `preview` (1-line for the card)
       and a longer `description` (full text for the modal timeline). */
export const SCHOOL_MENTOR_ANNOUNCEMENTS = [
  {
    id:      'an-1',
    title:   'Monthly Teaching Standards Review',
    preview: 'All section heads to submit updated KPI metrics for Q2 by 3 June. New review framework is live.',
    description: 'School Mentor head office has rolled out the Q2 2026 KPI review framework. Section heads must complete the updated framework inside the Appraisals module and submit Q2 metrics by 3 June 2026. Late submissions will be flagged in next week\'s audit summary.',
    date:    '31 May 2026',
    time:    '10:30 AM',
    status:  'new',
    sender:  'School Mentor — HQ',
    category:'Academic',
  },
  {
    id:      'an-2',
    title:   'New Parent App Feature Rolling Out',
    preview: 'Parents can now receive WhatsApp-style fee reminders. Please brief all front-desk staff.',
    description: 'Effective 1 June 2026, parents using the Mobile App will receive automatic WhatsApp-style fee reminders 3 days before the due date. Front-desk staff should be briefed on the new feature and the opt-out toggle inside Parent App → Settings → Notifications.',
    date:    '30 May 2026',
    time:    '04:15 PM',
    status:  'new',
    sender:  'School Mentor — Product',
    category:'Product Update',
  },
  {
    id:      'an-3',
    title:   'Summer Training Workshop Schedule',
    preview: 'Mandatory 3-day refresher for all teaching staff from 15-17 July. Sign-up opens 5 June.',
    description: 'A mandatory 3-day professional development refresher will be conducted from 15-17 July 2026. All teaching staff must sign up via the Teacher Trainings module between 5-12 June. Attendance is compulsory and will be reflected in the Q3 appraisal cycle.',
    date:    '29 May 2026',
    time:    '11:00 AM',
    status:  'new',
    sender:  'School Mentor — Training',
    category:'Training',
  },
  {
    id:      'an-4',
    title:   'Compliance Reminder — Audit Logs',
    preview: 'Reminder: Audit logs are immutable. Any tampering attempts will be flagged automatically.',
    description: 'A reminder from the compliance team — the Audit Logs module enforces an append-only architecture. Any attempts to tamper, edit, or delete entries trigger an automated flag back to School Mentor HQ. This is a legal compliance requirement for our certifying body.',
    date:    '27 May 2026',
    time:    '09:00 AM',
    status:  'read',
    sender:  'School Mentor — Compliance',
    category:'Compliance',
  },
  {
    id:      'an-5',
    title:   'Examination Board Cut-off Dates',
    preview: 'Final-term datesheet must be uploaded by 8 June for board synchronisation.',
    description: 'All final-term examination datesheets must be uploaded into the Examination module by 8 June 2026 for board synchronisation. Any datesheet uploaded after the deadline will need manual board approval and may delay result publication.',
    date:    '26 May 2026',
    time:    '02:30 PM',
    status:  'read',
    sender:  'School Mentor — Examination Board',
    category:'Examination',
  },
  {
    id:      'an-6',
    title:   'Mentor AI Beta Access',
    preview: 'Principals can now apply for Mentor AI beta access for lesson plan generation.',
    description: 'School Mentor is opening beta access for Mentor AI — an AI-powered assistant that drafts lesson plans, quiz questions, and parent communications. Principals may apply via School Mentor Portal → Beta Programs. Limited to 50 schools for this round.',
    date:    '24 May 2026',
    time:    '03:45 PM',
    status:  'read',
    sender:  'School Mentor — AI Team',
    category:'Product Update',
  },
  {
    id:      'an-7',
    title:   'Fee Module Upgrade — Better Reporting',
    preview: 'Improved defaulter reports + GST-ready invoice templates are now available.',
    description: 'The Fee module has been upgraded with improved defaulter reports, configurable late-fee rules, and GST-ready invoice templates. Existing fee structures remain unchanged. Accounts Officers should refresh their browser to pick up the new templates.',
    date:    '22 May 2026',
    time:    '10:15 AM',
    status:  'read',
    sender:  'School Mentor — Product',
    category:'Product Update',
  },
  {
    id:      'an-8',
    title:   'Annual Audit — Document Submission',
    preview: 'Annual audit pack due 30 June. Templates available in Settings → Reports.',
    description: 'The annual audit pack for FY 2025-26 is due 30 June 2026. Required documents: balance sheet, payroll summary, fee collection register, attendance summary. Audit templates are available in Settings → Audit Templates.',
    date:    '20 May 2026',
    time:    '04:00 PM',
    status:  'read',
    sender:  'School Mentor — Compliance',
    category:'Compliance',
  },
];

/* ─── NOTICE BOARD — notices sent by the Principal via the Mobile App
       Notice Board. Replaces the previous "minor notifications" card on
       the Teacher Dashboard. Shape will map 1:1 to a `notice_board` API
       once backend lands. */
export const NOTICE_BOARD_NOTICES = [
  {
    id:      'nb-1',
    title:   'Staff meeting on Tuesday',
    preview: 'All teaching staff to attend the monthly meeting in the conference hall.',
    date:    '31 May 2026',
    time:    '08:30 AM',
    status:  'new',
    sender:  'Principal',
    category:'Meeting',
  },
  {
    id:      'nb-2',
    title:   'Datesheet display schedule',
    preview: 'Final term datesheet will be displayed on classroom boards by Friday.',
    date:    '30 May 2026',
    time:    '02:00 PM',
    status:  'new',
    sender:  'Principal',
    category:'Examination',
  },
  {
    id:      'nb-3',
    title:   'Parent volunteer drive',
    preview: 'Encourage parents to register for the upcoming reading-week volunteer programme.',
    date:    '29 May 2026',
    time:    '11:15 AM',
    status:  'read',
    sender:  'Principal',
    category:'Engagement',
  },
];

/* ─── PRINCIPAL REMINDERS — personal reminders pushed by the Principal
       to this teacher. Backend will scope these per-user via the
       teacher's user id. */
export const PRINCIPAL_REMINDERS = [
  {
    id:      'pr-1',
    title:   'Submit Week 22 lesson plans',
    preview: 'Kindly upload Week 22 lesson plans before tomorrow\'s review meeting.',
    date:    '31 May 2026',
    time:    '09:00 AM',
    status:  'new',
    sender:  'Principal',
    category:'Lesson Plans',
    priority:'high',
  },
  {
    id:      'pr-2',
    title:   'Verify mid-term papers',
    preview: 'Cross-check the moderated mid-term paper set for Grade 6 and confirm before Friday.',
    date:    '30 May 2026',
    time:    '03:45 PM',
    status:  'new',
    sender:  'Principal',
    category:'Examination',
    priority:'medium',
  },
  {
    id:      'pr-3',
    title:   'Update student progress notes',
    preview: 'Add remarks to the progress register for any student you have flagged for parent follow-up.',
    date:    '28 May 2026',
    time:    '12:00 PM',
    status:  'read',
    sender:  'Principal',
    category:'Students',
    priority:'low',
  },
];




/* ─── Pending list for the Parents App report — class-wise.
       Demo subset (40 rows across 8 classes). Real backend would
       return the full 202 pending parents. */


/* ─── Helper: dashboardType from user record. */
export function dashboardTypeFor(user) {
  if (!user) return 'admin';
  return user.dashboardType === 'teacher' ? 'teacher' : 'admin';
}
