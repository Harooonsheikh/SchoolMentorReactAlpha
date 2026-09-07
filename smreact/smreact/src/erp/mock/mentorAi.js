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

export const MENTOR_AI_SUGGESTIONS = [
  "Analyze Ali Khan's academic performance.",
  "Compare Ali Khan's previous examinations.",
  'Analyze the performance of teacher Sara Ahmed.',
  "Show this month's outstanding fee position for Grade 7.",
  'Summarize current school accounts.',
  'Give me a staff performance overview.',
];

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

/* ─── 8. Natural-language fallback (no query matched a known scenario) ─── */
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
};

export function getNaturalAnswer(query) {
  return naturalAnswer(query);
}
