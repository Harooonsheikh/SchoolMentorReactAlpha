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




/* ─── Pending list for the Parents App report — class-wise.
       Demo subset (40 rows across 8 classes). Real backend would
       return the full 202 pending parents. */


/* ─── Helper: dashboardType from user record. */
export function dashboardTypeFor(user) {
  if (!user) return 'admin';
  return user.dashboardType === 'teacher' ? 'teacher' : 'admin';
}
