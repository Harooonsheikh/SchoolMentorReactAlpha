/* ═══════════════════════════════════════════════════════════════════
   Mentor AI — mock scenario data.

   Read ONLY by src/services/mentorAiService.js (never import this
   directly from UI components — same convention every other mock/*
   file in this project follows).

   Each scenario is a structured response object. Shape mirrors the
   conceptual future backend contract (POST /api/mentor-ai/query):

     {
       type, title, summary,
       metrics:  [{ label, value, sub?, trend?, tone? }],
       sections: [ ...typed section blocks, rendered by
                   MentorAIResponse / MentorAIResponseParts ],
       insight,
       recommendations: [string],
     }

   Section `kind` values in use: 'fields' | 'examTable' | 'subjectTable'
   | 'trendChart' | 'table' | 'list'. MentorAIResponse renders whatever
   kinds it recognizes and skips the rest, so the backend can add new
   kinds later without a frontend rewrite being required immediately.
   ═══════════════════════════════════════════════════════════════════ */

import {
  findFeePayments, getFeeCollectionSummary, getWeakestStudents,
  getAttendanceIssues, getTeachersWithPendingLessonPlans, getTeachersNeedingAttention,
  getExamResultsSummary, getSchoolMonthlyReport, MONTH_LABEL,
} from './mentorAiAgentData';

/* ─── Suggested-questions browser — 8 categories the AI School Operations
   Assistant covers. MENTOR_AI_SUGGESTIONS (below) stays a flat array of
   one pick per category so any existing import of it keeps working
   unchanged. ─── */
export const MENTOR_AI_CATEGORIES = [
  { id: 'fee', label: 'Fee & Finance', icon: 'fa-sack-dollar', questions: [
    'Find students who paid Rs.7000 fee on 13 September',
    'Show complete fee collection report for this month',
    'Who has unpaid fees?',
    "Show this month's outstanding fee position for Grade 7.",
  ] },
  { id: 'students', label: 'Students', icon: 'fa-user-graduate', questions: [
    'Find weakest students in school',
    'Which students need attention?',
    "Analyze Ali Khan's academic performance.",
  ] },
  { id: 'academics', label: 'Academics', icon: 'fa-book-open-reader', questions: [
    'Give me a school-wide academic performance overview.',
    'Which subjects need improvement school-wide?',
  ] },
  { id: 'attendance', label: 'Attendance', icon: 'fa-clipboard-check', questions: [
    'Show attendance issues',
    "Give me today's school-wide attendance analysis.",
  ] },
  { id: 'teachers', label: 'Teachers Performance', icon: 'fa-chalkboard-user', questions: [
    'Which teachers need attention?',
    'Analyze the performance of teacher Sara Ahmed.',
    'Give me a staff performance overview.',
  ] },
  { id: 'lessonPlans', label: 'Lesson Plans', icon: 'fa-file-pen', questions: [
    'Show teachers who have pending lesson plans',
    'Which teachers have pending work?',
  ] },
  { id: 'examination', label: 'Examination', icon: 'fa-file-lines', questions: [
    "Compare Ali Khan's previous examinations.",
    'Show school-wide examination results summary.',
  ] },
  { id: 'reports', label: 'School Reports', icon: 'fa-chart-pie', questions: [
    'Generate monthly school report',
    'Summarize current school accounts.',
  ] },
];

export const MENTOR_AI_SUGGESTIONS = MENTOR_AI_CATEGORIES.map((c) => c.questions[0]);

/* ─── 1 & 2. Student academic analysis + examination comparison ─── */
const studentPerformance = {
  type: 'student_performance',
  title: 'Ali Khan — Academic Analysis',
  summary:
    'Ali Khan is performing above his class average with a consistent upward trend over the last two terms, driven mainly by strong gains in Science and English.',
  metrics: [
    { label: 'Overall Average', value: '82.4%', trend: 'up', tone: 'good' },
    { label: 'Current Grade', value: 'A', sub: 'Grade 8 · Section B', tone: 'good' },
    { label: 'Class Position', value: '3rd', sub: 'of 34 students', tone: 'good' },
    { label: 'Performance Trend', value: 'Improving', trend: 'up', tone: 'good' },
  ],
  sections: [
    {
      kind: 'fields',
      title: 'Student Overview',
      icon: 'fa-user-graduate',
      items: [
        { label: 'Student', value: 'Ali Khan' },
        { label: 'Grade / Class', value: 'Grade 8' },
        { label: 'Section', value: 'B' },
        { label: 'Academic Year', value: '2025–26' },
      ],
    },
    {
      kind: 'examTable',
      title: 'Examination Comparison',
      icon: 'fa-file-lines',
      columns: ['Examination', 'Marks', 'Percentage', 'Trend'],
      rows: [
        { exam: 'Mid Term 1',  marks: '148/200', pct: 74, trend: 'flat' },
        { exam: 'Final Term 1', marks: '156/200', pct: 78, trend: 'up' },
        { exam: 'Mid Term 2',  marks: '160/200', pct: 80, trend: 'up' },
        { exam: 'Final Term 2', marks: '170/200', pct: 85, trend: 'up' },
      ],
    },
    {
      kind: 'trendChart',
      title: 'Marks Trend — Across Examinations',
      chartType: 'area',
      xKey: 'exam',
      series: [{ key: 'pct', label: 'Percentage', color: '#4169E1' }],
      data: [
        { exam: 'Mid T1', pct: 74 },
        { exam: 'Final T1', pct: 78 },
        { exam: 'Mid T2', pct: 80 },
        { exam: 'Final T2', pct: 85 },
      ],
    },
    {
      kind: 'subjectTable',
      title: 'Subject-Wise Analysis',
      icon: 'fa-book-open',
      rows: [
        { subject: 'English',           previous: 76, current: 85, trend: 'up' },
        { subject: 'Mathematics',       previous: 81, current: 73, trend: 'down' },
        { subject: 'Science',           previous: 72, current: 88, trend: 'up' },
        { subject: 'Urdu',              previous: 79, current: 80, trend: 'flat' },
        { subject: 'Computer Science',  previous: 84, current: 87, trend: 'up' },
      ],
    },
    {
      kind: 'list',
      variant: 'strengths',
      title: 'Strengths',
      icon: 'fa-circle-check',
      items: [
        'Strong, consistent improvement in Science across both terms.',
        'English comprehension and writing scores rose 9 points.',
        'Regular class participation and homework completion.',
      ],
    },
    {
      kind: 'list',
      variant: 'attention',
      title: 'Areas Requiring Attention',
      icon: 'fa-triangle-exclamation',
      items: [
        'Mathematics score declined 8 points across the last two assessments.',
        'Occasional inconsistency in Urdu written assignments.',
      ],
    },
  ],
  insight:
    'Ali has demonstrated consistent improvement in Science and English, while Mathematics has declined across the last two assessments — likely tied to the algebra unit introduced this term.',
  recommendations: [
    'Schedule a short diagnostic review of the algebra unit with the Mathematics teacher.',
    'Continue current approach in Science and English — it is working.',
    'Share progress summary with parents ahead of the next PTM.',
  ],
};

/* ─── 3. Teacher performance ─── */
const teacherPerformance = {
  type: 'teacher_performance',
  title: 'Sara Ahmed — Teacher Performance',
  summary:
    'Sara Ahmed maintains strong attendance and above-average student outcomes across her assigned classes, with results trending upward this term.',
  metrics: [
    { label: 'Avg. Student Performance', value: '79%', trend: 'up', tone: 'good' },
    { label: 'Classes Assigned', value: '5', sub: 'Grades 6–8' },
    { label: 'Attendance', value: '96%', tone: 'good' },
    { label: 'Results Trend', value: 'Improving', trend: 'up', tone: 'good' },
  ],
  sections: [
    {
      kind: 'fields',
      title: 'Teacher Overview',
      icon: 'fa-chalkboard-user',
      items: [
        { label: 'Teacher', value: 'Sara Ahmed' },
        { label: 'Subjects', value: 'Science, Biology' },
        { label: 'Classes Assigned', value: 'Grade 6-A, 6-B, 7-A, 7-B, 8-A' },
        { label: 'Experience', value: '6 years' },
      ],
    },
    {
      kind: 'table',
      title: 'Class Performance',
      icon: 'fa-table',
      columns: ['Class', 'Avg. Score', 'Trend'],
      rows: [
        ['Grade 6-A', '81%', '↑ Improved'],
        ['Grade 6-B', '77%', '→ Stable'],
        ['Grade 7-A', '80%', '↑ Improved'],
        ['Grade 7-B', '74%', '↓ Declined'],
        ['Grade 8-A', '82%', '↑ Improved'],
      ],
    },
    {
      kind: 'list',
      variant: 'strengths',
      title: 'Strengths',
      icon: 'fa-circle-check',
      items: [
        'Consistently high attendance and punctuality.',
        'Above-average results in 4 of 5 assigned classes.',
        'Positive feedback from recent classroom observations.',
      ],
    },
    {
      kind: 'list',
      variant: 'attention',
      title: 'Areas Requiring Attention',
      icon: 'fa-triangle-exclamation',
      items: ['Grade 7-B results have declined for two consecutive terms.'],
    },
  ],
  insight:
    'Sara Ahmed\'s teaching outcomes are trending positively overall; Grade 7-B is the one class working against that trend and may need a closer look.',
  recommendations: [
    'Pair with the academic coordinator to review the Grade 7-B lesson plan.',
    'Recognize strong performance in Grade 8-A during the next staff meeting.',
  ],
};

/* ─── 4. Fee outstanding analysis ─── */
const feeAnalysis = {
  type: 'fee_analysis',
  title: 'Grade 7 — Outstanding Fee Analysis',
  summary:
    'Grade 7 fee collection stands at 78% for the current cycle, with 19 students carrying an outstanding balance of Rs. 486,000.',
  metrics: [
    { label: 'Total Students', value: '86' },
    { label: 'Students Paid', value: '67', tone: 'good' },
    { label: 'Students Pending', value: '19', tone: 'bad' },
    { label: 'Collection %', value: '78%', trend: 'flat' },
  ],
  sections: [
    {
      kind: 'fields',
      title: 'Fee Position Summary',
      icon: 'fa-sack-dollar',
      items: [
        { label: 'Total Fee Due', value: 'Rs. 2,210,000' },
        { label: 'Amount Collected', value: 'Rs. 1,724,000' },
        { label: 'Outstanding Amount', value: 'Rs. 486,000' },
        { label: 'Collection Percentage', value: '78%' },
      ],
    },
    {
      kind: 'table',
      title: 'Class / Section Breakdown',
      icon: 'fa-table',
      columns: ['Section', 'Students', 'Paid', 'Pending', 'Outstanding'],
      rows: [
        ['Grade 7-A', '29', '24', '5', 'Rs. 128,000'],
        ['Grade 7-B', '28', '21', '7', 'Rs. 182,000'],
        ['Grade 7-C', '29', '22', '7', 'Rs. 176,000'],
      ],
    },
    {
      kind: 'table',
      title: 'High Priority Outstanding Accounts',
      icon: 'fa-flag',
      columns: ['Student', 'Section', 'Amount Due', 'Days Overdue'],
      rows: [
        ['Bilal Ahmed', '7-B', 'Rs. 42,000', '54'],
        ['Fatima Noor', '7-C', 'Rs. 38,500', '47'],
        ['Hamza Tariq', '7-A', 'Rs. 35,000', '41'],
      ],
    },
    {
      kind: 'list',
      variant: 'recommendations',
      title: 'Recommended Follow-up',
      icon: 'fa-list-check',
      items: [
        'Send payment reminders to the 3 high-priority accounts overdue 40+ days.',
        'Offer an installment plan for accounts overdue beyond 45 days.',
        'Escalate 7-B\'s pending count to the class fee coordinator — highest in the grade.',
      ],
    },
  ],
  insight:
    'Grade 7-B has both the highest pending count and the highest outstanding value in the grade, and is the most urgent follow-up.',
  recommendations: [
    'Prioritize outreach to Grade 7-B pending accounts this week.',
    'Review installment options for accounts overdue 45+ days.',
  ],
};

/* ─── 5. Accounts overview ─── */
const accountsOverview = {
  type: 'accounts_overview',
  title: "This Month's Accounts Overview",
  summary:
    'Net position remains positive this month, with fee collection covering operating expenses and a modest surplus carried forward.',
  metrics: [
    { label: 'Income', value: 'Rs. 8.42M', trend: 'up', tone: 'good' },
    { label: 'Expenses', value: 'Rs. 6.15M', trend: 'flat' },
    { label: 'Net Position', value: 'Rs. 2.27M', tone: 'good' },
    { label: 'Outstanding Receivables', value: 'Rs. 1.08M', tone: 'bad' },
  ],
  sections: [
    {
      kind: 'table',
      title: 'Major Expense Categories',
      icon: 'fa-table',
      columns: ['Category', 'Amount', 'Share'],
      rows: [
        ['Staff Salaries', 'Rs. 4.10M', '67%'],
        ['Utilities', 'Rs. 0.68M', '11%'],
        ['Maintenance', 'Rs. 0.52M', '8%'],
        ['Transport', 'Rs. 0.45M', '7%'],
        ['Other', 'Rs. 0.40M', '7%'],
      ],
    },
    {
      kind: 'trendChart',
      title: 'Income vs. Expenses — Comparison With Previous Month',
      chartType: 'bar',
      xKey: 'month',
      series: [
        { key: 'income', label: 'Income', color: '#3DBA8C' },
        { key: 'expense', label: 'Expenses', color: '#F87171' },
      ],
      data: [
        { month: 'Last Month', income: 7.9, expense: 6.02 },
        { month: 'This Month', income: 8.42, expense: 6.15 },
      ],
    },
    {
      kind: 'list',
      variant: 'attention',
      title: 'Financial Observations',
      icon: 'fa-triangle-exclamation',
      items: [
        'Outstanding receivables grew 6% versus last month.',
        'Staff salaries remain the dominant expense category at 67% of spend.',
      ],
    },
  ],
  insight:
    'Income growth this month is outpacing expense growth, but receivables collection needs attention to sustain the trend.',
  recommendations: [
    'Prioritize receivables follow-up before the next reporting cycle.',
    'No expense category change recommended this month.',
  ],
};

/* ─── 6. Attendance analysis ─── */
const attendanceAnalysis = {
  type: 'attendance_analysis',
  title: 'School-Wide Attendance Analysis',
  summary:
    'Overall attendance is healthy at 93.2% today, though three sections are showing a recurring dip worth flagging.',
  metrics: [
    { label: 'Overall Attendance', value: '93.2%', tone: 'good' },
    { label: 'Present Today', value: '1,142', sub: 'of 1,225' },
    { label: 'Absent Today', value: '61' },
    { label: 'Late Arrivals', value: '22', trend: 'down' },
  ],
  sections: [
    {
      kind: 'trendChart',
      title: 'Attendance Trend — This Week',
      chartType: 'line',
      xKey: 'day',
      series: [{ key: 'pct', label: 'Attendance %', color: '#4169E1' }],
      data: [
        { day: 'Mon', pct: 94 },
        { day: 'Tue', pct: 93 },
        { day: 'Wed', pct: 91 },
        { day: 'Thu', pct: 92 },
        { day: 'Fri', pct: 93.2 },
      ],
    },
    {
      kind: 'table',
      title: 'Sections With Lowest Attendance',
      icon: 'fa-table',
      columns: ['Section', 'Attendance %', 'Trend'],
      rows: [
        ['Grade 9-C', '84%', '↓ Declined'],
        ['Grade 5-A', '87%', '↓ Declined'],
        ['Grade 8-B', '89%', '→ Stable'],
      ],
    },
    {
      kind: 'list',
      variant: 'alerts',
      title: 'Attendance Concerns',
      icon: 'fa-triangle-exclamation',
      items: [
        'Grade 9-C attendance has declined for 3 consecutive weeks.',
        '6 students school-wide have missed 5+ days this month.',
      ],
    },
  ],
  insight:
    'Grade 9-C is the primary concern — a 3-week decline that stands out against an otherwise stable school-wide trend.',
  recommendations: [
    'Have the Grade 9-C class teacher follow up with affected families this week.',
    'Flag the 6 students with 5+ absences to the counseling team.',
  ],
};

/* ─── 7. HR / staff overview ─── */
const hrOverview = {
  type: 'hr_overview',
  title: 'Staff Performance Overview',
  summary:
    'Staff attendance and punctuality remain strong school-wide, with the Academics department carrying the largest headcount.',
  metrics: [
    { label: 'Total Staff', value: '148' },
    { label: 'Present Today', value: '141', tone: 'good' },
    { label: 'Average Attendance', value: '95.1%', tone: 'good' },
    { label: 'Late Arrivals', value: '4', trend: 'down', tone: 'good' },
  ],
  sections: [
    {
      kind: 'table',
      title: 'Department Breakdown',
      icon: 'fa-table',
      columns: ['Department', 'Headcount', 'Avg. Attendance'],
      rows: [
        ['Academics', '96', '95.8%'],
        ['Administration', '18', '97.2%'],
        ['Support Staff', '24', '92.4%'],
        ['Transport', '10', '94.0%'],
      ],
    },
    {
      kind: 'list',
      variant: 'recommendations',
      title: 'Performance Indicators',
      icon: 'fa-chart-line',
      items: [
        'Academics department attendance improved 1.4% versus last month.',
        'Support Staff attendance is the lowest of all departments — worth monitoring.',
        '5 staff members are on approved leave today.',
      ],
    },
  ],
  insight:
    'Staff attendance is trending positively overall, with Support Staff the one department below the school-wide average.',
  recommendations: [
    'Check in with the Support Staff supervisor on recurring absence patterns.',
    'No action needed for Academics or Administration this month.',
  ],
};

/* ─── 8. Fee payment search — parametrized on the amount/date actually
   typed (see mentorAiService.js's extractAmount/extractDay), so "Find
   students who paid Rs.7000 fee on 13 September" reflects the numbers in
   the query instead of a fixed canned table. Falls back to a friendly
   "no matches" shape when nothing in the mock ledger matches. ─── */
export function buildFeePaymentSearch(query, { amount, day, month } = {}) {
  const rows = findFeePayments({ amount, day, month });
  const label = [
    amount != null ? `Rs. ${amount.toLocaleString()}` : null,
    day != null && month != null ? `on ${day} ${MONTH_LABEL[month - 1]}` : null,
  ].filter(Boolean).join(' ');
  return {
    type: 'fee_payment_search',
    title: `Fee Payments${label ? ` — ${label}` : ''}`,
    summary: rows.length
      ? `Found ${rows.length} student${rows.length === 1 ? '' : 's'} matching this payment${label ? ` (${label})` : ''}.`
      : `No fee payments matched${label ? ` (${label})` : ''} in the current records — try a different amount or date.`,
    metrics: [
      { label: 'Students Found', value: String(rows.length) },
      { label: 'Total Amount', value: `Rs. ${rows.reduce((s, r) => s + r.amount, 0).toLocaleString()}` },
    ],
    sections: rows.length ? [
      {
        kind: 'table',
        title: 'Matching Payments',
        icon: 'fa-receipt',
        columns: ['Student Name', 'Registration Number', 'Class', 'Section', 'Payment Date', 'Amount Paid'],
        rows: rows.map((r) => [r.name, r.regNo, r.className, r.section, r.date, `PKR ${r.amount.toLocaleString()}`]),
      },
    ] : [],
    insight: rows.length ? `All ${rows.length} matching payments were fully collected — no partial payments on this date/amount.` : null,
    recommendations: rows.length
      ? ['Export this list for the accounts team\'s daily reconciliation.']
      : ['Try broadening the search — for example, just the amount or just the date.'],
  };
}

/* ─── 9. Fee collection report — whole-school monthly summary ─── */
function buildFeeCollectionReport() {
  const s = getFeeCollectionSummary();
  return {
    type: 'fee_collection_report',
    title: 'Fee Collection Report — This Month',
    summary: `Rs. ${s.collectedAmount.toLocaleString()} collected from ${s.paidCount} of ${s.totalStudents} students this month; ${s.pendingCount} accounts remain pending.`,
    metrics: [
      { label: 'Total Students', value: String(s.totalStudents) },
      { label: 'Generated Challans', value: String(s.generatedChallans) },
      { label: 'Collected Amount', value: `Rs. ${s.collectedAmount.toLocaleString()}`, tone: 'good' },
      { label: 'Pending Amount', value: `Rs. ${s.pendingAmount.toLocaleString()}`, tone: 'bad' },
    ],
    sections: [
      {
        kind: 'table',
        title: 'Defaulters List',
        icon: 'fa-triangle-exclamation',
        columns: ['Student Name', 'Registration Number', 'Class', 'Section', 'Amount Due'],
        rows: s.defaulters.map((d) => [d.name, d.regNo, d.className, d.section, `PKR ${d.amountDue.toLocaleString()}`]),
      },
    ],
    insight: `${s.pendingCount} students (${Math.round((s.pendingCount / s.totalStudents) * 100)}% of the school) have not yet paid this month — prioritize the defaulters list for follow-up.`,
    recommendations: [
      'Send payment reminders to all defaulters listed above.',
      'Flag accounts overdue more than one cycle to the fee coordinator.',
    ],
  };
}

/* ─── 10. Weakest students — school-wide ─── */
function buildWeakestStudents() {
  const rows = getWeakestStudents(8);
  return {
    type: 'weakest_students',
    title: 'Weakest Students — School-Wide',
    summary: `${rows.length} students identified with the lowest overall averages across the school, most also showing attendance-related risk factors.`,
    metrics: [
      { label: 'Students Flagged', value: String(rows.length), tone: 'bad' },
      { label: 'Lowest Average', value: `${rows[0]?.avgPercentage ?? 0}%`, tone: 'bad' },
    ],
    sections: [
      {
        kind: 'table',
        title: 'Students Requiring Support',
        icon: 'fa-user-graduate',
        columns: ['Student Name', 'Class', 'Average %', 'Weak Subjects', 'Attendance', 'Reason'],
        rows: rows.map((r) => [r.name, `${r.className}-${r.section}`, `${r.avgPercentage}%`, r.weakSubjects, `${r.attendancePercentage}%`, r.reason]),
      },
    ],
    insight: 'Most flagged students combine below-average attendance with weak assessment scores — attendance is a leading indicator here, not just an outcome.',
    recommendations: [
      'Set up remedial sessions for the subjects listed against each student.',
      'Loop in class teachers to contact parents of students below 80% attendance.',
    ],
  };
}

/* ─── 11. Attendance issues — specific student-level list (distinct from
   the school-wide trend scenario above) ─── */
function buildAttendanceIssues() {
  const rows = getAttendanceIssues(10);
  return {
    type: 'attendance_issues',
    title: 'Attendance Issues — Students Requiring Action',
    summary: `${rows.length} students have the lowest attendance school-wide this month; ${rows.filter((r) => r.actionRequired.includes('notice')).length} require formal parent notice.`,
    metrics: [
      { label: 'Students Flagged', value: String(rows.length), tone: 'bad' },
      { label: 'Lowest Attendance', value: `${rows[0]?.attendancePercentage ?? 0}%`, tone: 'bad' },
    ],
    sections: [
      {
        kind: 'table',
        title: 'Attendance Issues',
        icon: 'fa-clipboard-check',
        columns: ['Student', 'Class', 'Attendance %', 'Absent Days', 'Action Required'],
        rows: rows.map((r) => [r.name, `${r.className}-${r.section}`, `${r.attendancePercentage}%`, String(r.absentDays), r.actionRequired]),
      },
    ],
    insight: 'Students below 80% attendance are at meaningful academic risk — several already appear on the weakest-students list.',
    recommendations: [
      'Issue formal attendance notices to families flagged above.',
      'Ask class teachers to log the reason for absence going forward.',
    ],
  };
}

/* ─── 12. Teachers with pending lesson plans ─── */
function buildLessonPlanPending() {
  const rows = getTeachersWithPendingLessonPlans();
  return {
    type: 'lesson_plan_pending',
    title: 'Teachers With Pending Lesson Plans',
    summary: `${rows.length} teachers have at least one pending lesson plan submission this term.`,
    metrics: [
      { label: 'Teachers Pending', value: String(rows.length), tone: rows.length ? 'bad' : 'good' },
      { label: 'Total Pending Plans', value: String(rows.reduce((s, r) => s + r.pending, 0)) },
    ],
    sections: [
      {
        kind: 'table',
        title: 'Pending Lesson Plans',
        icon: 'fa-file-pen',
        columns: ['Teacher Name', 'Subject', 'Assigned Lesson Plans', 'Submitted', 'Pending', 'Last Submission Date'],
        rows: rows.map((r) => [r.name, r.subject, String(r.assigned), String(r.submitted), String(r.pending), r.lastSubmissionDate]),
      },
    ],
    insight: rows.length ? 'Lesson plan submission gaps are concentrated in a handful of teachers rather than spread evenly.' : 'All teachers are fully up to date on lesson plan submissions.',
    recommendations: [
      'Send a reminder to teachers with 2+ pending lesson plans.',
      'Escalate to the academic coordinator if plans remain pending past this week.',
    ],
  };
}

/* ─── 13. Teachers needing attention ─── */
function buildTeachersNeedingAttention() {
  const rows = getTeachersNeedingAttention(8);
  return {
    type: 'teachers_needing_attention',
    title: 'Teachers Needing Attention',
    summary: `${rows.length} teachers are trailing the school average across lesson planning, homework checking, or student feedback.`,
    metrics: [
      { label: 'Teachers Flagged', value: String(rows.length), tone: 'bad' },
    ],
    sections: [
      {
        kind: 'table',
        title: 'Performance Breakdown',
        icon: 'fa-chalkboard-user',
        columns: ['Teacher Name', 'Subject', 'Lesson Plan Completion', 'Homework Checking', 'Student Feedback', 'Performance Summary'],
        rows: rows.map((r) => [r.name, r.subject, r.lessonPlanCompletion, r.homeworkChecking, r.studentFeedback, r.performanceSummary]),
      },
    ],
    insight: 'Lesson plan completion is the most common weak point among the flagged teachers — worth a targeted reminder cycle.',
    recommendations: [
      'Schedule a short check-in with each flagged teacher this week.',
      'Pair newer teachers with a strong-performing mentor from the same subject.',
    ],
  };
}

/* ─── 14. Academics — school-wide overview (distinct from a single
   student's exam comparison, which studentPerformance already covers) ─── */
function buildAcademicsOverview() {
  const exam = getExamResultsSummary();
  return {
    type: 'academics_overview',
    title: "School-Wide Academic Performance Overview",
    summary: `Average result across all grades stands at ${exam.schoolAvg}%, with ${exam.gradeRows.length} grades reporting this term.`,
    metrics: [
      { label: 'School Average', value: `${exam.schoolAvg}%`, tone: 'good' },
      { label: 'Grades Reporting', value: String(exam.gradeRows.length) },
    ],
    sections: [
      {
        kind: 'table',
        title: 'Grade-Wise Averages',
        icon: 'fa-table',
        columns: ['Class', 'Students', 'Average %', 'Pass Rate'],
        rows: exam.gradeRows.map((g) => [g.className, String(g.students), `${g.avgPercentage}%`, g.passRate]),
      },
      {
        kind: 'table',
        title: 'Top Performers — School-Wide',
        icon: 'fa-medal',
        columns: ['Student', 'Class', 'Average %'],
        rows: exam.topPerformers.map((s) => [s.name, `${s.className}-${s.section}`, `${s.avgPercentage}%`]),
      },
    ],
    insight: 'Academic performance is broadly consistent across grades, with no single grade significantly underperforming the school average.',
    recommendations: [
      'Recognize the top performers listed above at the next assembly.',
      'Share subject-wise breakdowns with department heads for grades below the school average.',
    ],
  };
}

/* ─── 15. Examination — school-wide results summary (distinct from the
   per-student exam comparison in studentPerformance) ─── */
function buildExamResultsSummary() {
  const exam = getExamResultsSummary();
  return {
    type: 'exam_results_summary',
    title: 'Examination Results Summary — School-Wide',
    summary: `Latest examination cycle shows a school average of ${exam.schoolAvg}% across ${exam.gradeRows.length} grades.`,
    metrics: [
      { label: 'School Average', value: `${exam.schoolAvg}%` },
      { label: 'Top Score', value: `${exam.topPerformers[0]?.avgPercentage ?? 0}%`, tone: 'good' },
    ],
    sections: [
      {
        kind: 'table',
        title: 'Results by Class',
        icon: 'fa-file-lines',
        columns: ['Class', 'Students', 'Average %', 'Pass Rate'],
        rows: exam.gradeRows.map((g) => [g.className, String(g.students), `${g.avgPercentage}%`, g.passRate]),
      },
    ],
    insight: 'Pass rates remain healthy across all grades this cycle.',
    recommendations: [
      'Publish class-wise results to teachers ahead of the next PTM.',
      'Flag any grade below 90% pass rate for a syllabus-pace review.',
    ],
  };
}

/* ─── 16. School Reports — whole-school monthly rollup ─── */
function buildSchoolMonthlyReport() {
  const r = getSchoolMonthlyReport();
  return {
    type: 'school_monthly_report',
    title: 'Monthly School Report',
    summary: `This month: ${r.totalStudents} students, ${r.totalTeachers} teachers, ${r.feeCollectionPercent}% fee collection, ${r.avgAttendance}% average attendance.`,
    metrics: [
      { label: 'Total Students', value: String(r.totalStudents) },
      { label: 'Total Teachers', value: String(r.totalTeachers) },
      { label: 'Fee Collection', value: `${r.feeCollectionPercent}%`, tone: r.feeCollectionPercent >= 75 ? 'good' : 'bad' },
      { label: 'Avg. Attendance', value: `${r.avgAttendance}%`, tone: 'good' },
    ],
    sections: [
      {
        kind: 'fields',
        title: 'School Snapshot',
        icon: 'fa-chart-pie',
        items: [
          { label: 'School Average Result', value: `${r.schoolAvgResult}%` },
          { label: 'Avg. Lesson Plan Completion', value: `${r.avgLessonPlanCompletion}%` },
        ],
      },
    ],
    insight: `Fee collection (${r.feeCollectionPercent}%) is the metric most worth watching this month relative to the others.`,
    recommendations: [
      'Share this snapshot with the leadership team at the next weekly meeting.',
      'Drill into fee collection or attendance individually for a deeper breakdown.',
    ],
  };
}

/* ─── 17. Natural-language fallback (no query matched a known scenario) ─── */
function naturalAnswer(query) {
  return {
    type: 'natural_answer',
    title: 'Mentor AI',
    summary: `Based on available school data, here's a concise answer to "${query}".`,
    metrics: [],
    sections: [
      {
        kind: 'list',
        variant: 'recommendations',
        title: 'Supporting Evidence',
        icon: 'fa-list-check',
        items: [
          'This is demonstration data — Mentor AI is not yet connected to live records.',
          'Try one of the suggested questions below for a fuller structured analysis.',
        ],
      },
    ],
    insight: null,
    recommendations: [
      'Ask about a specific student, teacher, class, or module for a detailed breakdown.',
    ],
  };
}

export const MENTOR_AI_SCENARIOS = {
  studentPerformance,
  teacherPerformance,
  feeAnalysis,
  accountsOverview,
  attendanceAnalysis,
  hrOverview,
  feeCollectionReport: buildFeeCollectionReport(),
  weakestStudents: buildWeakestStudents(),
  attendanceIssues: buildAttendanceIssues(),
  lessonPlanPending: buildLessonPlanPending(),
  teachersNeedingAttention: buildTeachersNeedingAttention(),
  academicsOverview: buildAcademicsOverview(),
  examResultsSummary: buildExamResultsSummary(),
  schoolMonthlyReport: buildSchoolMonthlyReport(),
};

export function getNaturalAnswer(query) {
  return naturalAnswer(query);
}
