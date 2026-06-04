/* ═══════════════════════════════════════════════════════════════════
   STAFF APPRAISAL — seed data + International Standard Framework

   Everything here is plain-English friendly. The framework is a
   reasonable default that schools can keep as-is. The UI exposes
   every knob with helper copy so a school owner can configure it
   without HR training.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Review cycles the school can pick from ─── */
export const APPRAISAL_CYCLES = [
  {
    id:    'monthly',
    label: 'Monthly Performance Tracking',
    icon:  'fa-calendar-day',
    tone:  'blue',
    when:  'Use this if you want to keep a very close eye on staff every single month.',
    pros:  ['Quick feedback', 'Spot issues early', 'Builds an evaluation habit'],
    cons:  ['Higher effort each month', 'Best with smaller teams'],
  },
  {
    id:    'quarterly',
    label: 'Quarterly Review',
    icon:  'fa-calendar-week',
    tone:  'green',
    when:  'Best for most schools — review every 3 months.',
    pros:  ['Balanced effort', 'Aligns with term system', 'Easy to compare quarters'],
    cons:  ['Issues may go unnoticed for a couple of weeks'],
  },
  {
    id:    'biannual',
    label: 'Bi-Annual Review',
    icon:  'fa-calendar-days',
    tone:  'indigo',
    when:  'Use if you want to review twice a year (e.g. mid-year + year-end).',
    pros:  ['Lower workload', 'Time for staff to improve between reviews'],
    cons:  ['Less granular tracking'],
  },
  {
    id:    'annual',
    label: 'Annual Review',
    icon:  'fa-calendar-check',
    tone:  'orange',
    when:  'Use if you only want to evaluate once a year (typically year-end).',
    pros:  ['Minimum admin overhead', 'Industry standard for HR'],
    cons:  ['Issues caught late', 'Harder to course-correct'],
  },
];

/* ─── Default grading scale (editable in Setup) ─── */
export const APPRAISAL_DEFAULT_GRADES = [
  { id: 'aplus', label: 'A+', min: 90, max: 100, tone: 'green',  meaning: 'Outstanding — exceeds expectations across the board.' },
  { id: 'a',     label: 'A',  min: 80, max: 89,  tone: 'blue',   meaning: 'Excellent — consistently strong performance.' },
  { id: 'b',     label: 'B',  min: 70, max: 79,  tone: 'indigo', meaning: 'Good — meets expectations with room to grow.' },
  { id: 'c',     label: 'C',  min: 60, max: 69,  tone: 'orange', meaning: 'Average — needs targeted improvement.' },
  { id: 'd',     label: 'D',  min: 0,  max: 59,  tone: 'red',    meaning: 'Below expectations — formal support needed.' },
];

/* ─── Default eligibility thresholds (minimum overall score) ─── */
export const APPRAISAL_DEFAULT_ELIGIBILITY = [
  { id: 'bonus',       label: 'Bonus Eligibility',                  icon: 'fa-gift',           tone: 'green',  min: 90,
    desc: 'Staff scoring at least this overall mark become eligible for a discretionary bonus.' },
  { id: 'increment',   label: 'Salary Increment Eligibility',       icon: 'fa-arrow-trend-up', tone: 'blue',   min: 80,
    desc: 'Used by HR / Accounts when running annual salary revisions.' },
  { id: 'promotion',   label: 'Promotion Eligibility',              icon: 'fa-arrow-up',       tone: 'indigo', min: 85,
    desc: 'Members at or above this score are considered ready for a higher role.' },
  { id: 'certificate', label: 'Appreciation Certificate Eligibility', icon: 'fa-award',         tone: 'orange', min: 80,
    desc: 'Drives the "Best Performer" appreciation certificate at end of cycle.' },
];

/* ─── The framework. 7 categories × multiple criteria.
   Each criterion declares:
     • autoSource — the existing-ERP source it could pull from
       (null for manual-only).
     • mode — default 'auto' if a source exists, else 'manual'.
       The UI lets schools override.
     • weight — default suggested weight (%). Sum across categories
       intentionally adds to 100 so the math is intuitive.
     • guidance — plain-English markers for what each score band
       looks like, used in the conduct modal.
     • calc — one-line explanation of HOW the auto score is derived
       when mode === 'auto'. Shown in Setup + tooltip on Conduct.
   ─── */
export const APPRAISAL_FRAMEWORK = [
  {
    id: 'professional_practice',
    label: 'Professional Practice',
    icon:  'fa-chalkboard-user',
    tone:  'blue',
    desc:  'How well the teacher plans and runs their daily classroom work.',
    criteria: [
      { id: 'lesson_planning',     name: 'Lesson Planning',       autoSource: 'academics.lesson_plans',         weight: 5,
        calc: '(Lesson plans submitted on time ÷ plans expected) × 100',
        desc: 'Are lesson plans being submitted regularly and on schedule?',
        why:  'Plans show preparation. Students learn more when teachers plan ahead.',
        guidance: { excellent: '95–100% submitted on time', good: '85–94%', average: '70–84%', poor: 'Below 70%' } },
      { id: 'learning_objectives', name: 'Learning Objectives',   autoSource: null, weight: 4,
        desc: 'Are clear learning goals defined for every class and shared with students?',
        why:  'Students perform better when they know what they\'re meant to learn.',
        guidance: { excellent: 'Crisp goals every class, visibly tracked', good: 'Mostly defined', average: 'Sometimes vague', poor: 'Not defined' } },
      { id: 'teaching_methods',    name: 'Teaching Methodologies', autoSource: null, weight: 5,
        desc: 'Variety and effectiveness of teaching techniques.',
        why:  'Different students learn in different ways — variety matters.',
        guidance: { excellent: 'Uses 3+ techniques effectively', good: 'Mix of 2 techniques', average: 'Mostly lecture', poor: 'Single method, low engagement' } },
      { id: 'student_engagement',  name: 'Student Engagement',     autoSource: null, weight: 5,
        desc: 'How attentively and actively students participate.',
        why:  'High engagement = real learning, not just instruction.',
        guidance: { excellent: 'Students consistently active & curious', good: 'Most students engaged', average: 'Mixed engagement', poor: 'Many disengaged' } },
      { id: 'technology_use',      name: 'Use of Technology',      autoSource: 'usage.erp_mobile', weight: 4,
        calc: '(ERP + Mobile app actions per week) → normalised to 0–100',
        desc: 'How well is the teacher using ERP, mobile app and classroom tech?',
        why:  'Faster admin work means more time for actual teaching.',
        guidance: { excellent: 'Daily active', good: '3–4 days/week', average: 'Once a week', poor: 'Rare or never' } },
    ],
  },
  {
    id: 'classroom_environment',
    label: 'Classroom Environment',
    icon:  'fa-people-roof',
    tone:  'green',
    desc:  'The atmosphere and order inside the classroom.',
    criteria: [
      { id: 'classroom_mgmt',  name: 'Classroom Management',  autoSource: null, weight: 4,
        desc: 'Is the classroom orderly, time well-used, transitions smooth?',
        why:  'A well-run classroom is the foundation of every other outcome.',
        guidance: { excellent: 'Calm, focused, time well used', good: 'Generally well managed', average: 'Some disorder', poor: 'Frequently chaotic' } },
      { id: 'student_discipline', name: 'Student Discipline', autoSource: 'attendance.classroom_incidents', weight: 4,
        calc: '100 − (incident reports filed against the class × 5)',
        desc: 'Behaviour standards maintained in the class.',
        why:  'Sets the bar for respectful, productive learning.',
        guidance: { excellent: 'Zero incidents', good: '1–2 incidents', average: '3–4 incidents', poor: '5+ incidents' } },
      { id: 'learning_env',    name: 'Learning Environment',  autoSource: null, weight: 3,
        desc: 'Display work, classroom décor, positive atmosphere.',
        why:  'A welcoming room makes students more likely to participate.',
        guidance: { excellent: 'Inviting, organised, student work on display', good: 'Tidy & neutral', average: 'Plain or cluttered', poor: 'Untidy or uninviting' } },
    ],
  },
  {
    id: 'student_achievement',
    label: 'Student Achievement',
    icon:  'fa-graduation-cap',
    tone:  'indigo',
    desc:  'The learning outcomes students actually achieve.',
    criteria: [
      { id: 'academic_perf',   name: 'Academic Performance', autoSource: 'examination.class_average', weight: 8,
        calc: 'Class average across the teacher\'s subjects, this cycle',
        desc: 'Average marks across the teacher\'s sections.',
        why:  'Marks are the clearest signal of learning outcomes.',
        guidance: { excellent: 'Class avg ≥ 85%', good: '75–84%', average: '60–74%', poor: 'Below 60%' } },
      { id: 'student_progress', name: 'Student Progress',    autoSource: 'examination.progress_delta', weight: 7,
        calc: 'Change in class average vs previous cycle, normalised',
        desc: 'Are students growing compared to the last cycle?',
        why:  'Even strong classes need to keep moving forward.',
        guidance: { excellent: '+10 marks or more', good: '+5 to +9', average: '0 to +4', poor: 'Regression' } },
    ],
  },
  {
    id: 'professional_responsibilities',
    label: 'Professional Responsibilities',
    icon:  'fa-clipboard-check',
    tone:  'orange',
    desc:  'Workplace habits — showing up, on time, with work done.',
    criteria: [
      { id: 'attendance',  name: 'Attendance',  autoSource: 'attendance.staff_presence', weight: 6,
        calc: '(Days present ÷ working days) × 100',
        desc: 'Percentage of working days the teacher was present.',
        why:  'Consistent attendance is essential for student continuity.',
        guidance: { excellent: '95–100%', good: '85–94%', average: '70–84%', poor: 'Below 70%' } },
      { id: 'punctuality', name: 'Punctuality', autoSource: 'attendance.late_minutes',   weight: 4,
        calc: '100 − (avg late minutes per day × 2)',
        desc: 'How often the teacher arrives on time.',
        why:  'Late arrivals lose first-class learning time.',
        guidance: { excellent: 'Always on time', good: 'Rarely late', average: 'Occasionally late', poor: 'Frequently late' } },
      { id: 'compliance',  name: 'Compliance',  autoSource: 'erp.submission_timeliness', weight: 3,
        calc: '(On-time submissions ÷ required submissions) × 100',
        desc: 'Following school policies, deadlines and rules.',
        why:  'Compliance keeps the operation running smoothly.',
        guidance: { excellent: 'Always compliant', good: 'Minor lapses', average: 'Occasional non-compliance', poor: 'Recurring issues' } },
      { id: 'record_keep', name: 'Record Keeping', autoSource: 'erp.records_submitted', weight: 3,
        calc: '(Records submitted ÷ records due) × 100',
        desc: 'Attendance registers, marks, reports — all kept up to date?',
        why:  'Accurate records protect the school in audits and disputes.',
        guidance: { excellent: 'Always up to date', good: 'Generally up to date', average: 'Sometimes behind', poor: 'Frequently incomplete' } },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration & Communication',
    icon:  'fa-handshake-angle',
    tone:  'green',
    desc:  'Working with parents, colleagues and the wider school team.',
    criteria: [
      { id: 'teamwork',    name: 'Teamwork',           autoSource: null, weight: 4,
        desc: 'Plays well with colleagues, supports the team.',
        why:  'A team that works together teaches better together.',
        guidance: { excellent: 'Actively helps colleagues', good: 'Cooperative', average: 'Works in own lane', poor: 'Frequently siloed' } },
      { id: 'parent_comm', name: 'Parent Communication', autoSource: 'mobile.parent_messages', weight: 4,
        calc: '(Parent messages answered ÷ received) × 100',
        desc: 'Speed and clarity of parent communication.',
        why:  'Engaged parents help reinforce learning at home.',
        guidance: { excellent: '≥ 90% replies on time', good: '70–89%', average: '50–69%', poor: 'Below 50%' } },
      { id: 'staff_collab', name: 'Staff Collaboration', autoSource: null, weight: 3,
        desc: 'Shares lesson plans, materials and ideas with peers.',
        why:  'Knowledge sharing raises the whole staff.',
        guidance: { excellent: 'Generous sharing', good: 'Shares when asked', average: 'Rarely shares', poor: 'Withholds' } },
    ],
  },
  {
    id: 'professional_development',
    label: 'Professional Development',
    icon:  'fa-graduation-cap',
    tone:  'indigo',
    desc:  'How the teacher grows their own skills over time.',
    criteria: [
      { id: 'training',  name: 'Training Participation', autoSource: 'hr.trainings_attended', weight: 4,
        calc: 'Trainings attended in this cycle (scaled 0–100)',
        desc: 'Number of trainings attended during the period.',
        why:  'Continuous learning compounds over a career.',
        guidance: { excellent: '3+ trainings', good: '2 trainings', average: '1 training', poor: 'None' } },
      { id: 'skill_growth', name: 'Skill Improvement', autoSource: null, weight: 3,
        desc: 'Visible improvement in teaching, technology or subject mastery.',
        why:  'Schools want teachers who keep getting better.',
        guidance: { excellent: 'Visibly more capable than last cycle', good: 'Notable growth', average: 'Some progress', poor: 'No visible change' } },
    ],
  },
  {
    id: 'school_contribution',
    label: 'School Contribution & Leadership',
    icon:  'fa-flag-checkered',
    tone:  'orange',
    desc:  'Going beyond the classroom to lift the whole school.',
    criteria: [
      { id: 'activities',  name: 'School Activities Participation', autoSource: 'hr.activities_logged', weight: 3,
        calc: 'Activities logged for this teacher (scaled 0–100)',
        desc: 'Participation in sports days, events, clubs and trips.',
        why:  'A school is more than classes — extracurriculars matter.',
        guidance: { excellent: '4+ activities', good: '2–3', average: '1', poor: 'None' } },
      { id: 'event_mgmt',  name: 'Event Management', autoSource: null, weight: 3,
        desc: 'Quality of organising events and programmes.',
        why:  'Great events build the school\'s reputation.',
        guidance: { excellent: 'Owned a successful event', good: 'Helped successfully', average: 'Minor help', poor: 'Avoided' } },
      { id: 'admissions',  name: 'Admissions Support', autoSource: 'crm.admissions_contributed', weight: 3,
        calc: 'Admissions referred / supported (scaled 0–100)',
        desc: 'Supporting open days, demo classes and new admissions.',
        why:  'Helps the school grow its student base.',
        guidance: { excellent: '5+ supports / referrals', good: '3–4', average: '1–2', poor: 'None' } },
      { id: 'leadership',  name: 'Leadership & Initiative', autoSource: null, weight: 8,
        desc: 'Taking initiative without being asked.',
        why:  'Tomorrow\'s coordinators are today\'s self-starters.',
        guidance: { excellent: 'Frequently proposes & owns ideas', good: 'Volunteers when asked', average: 'Does role only', poor: 'Avoids extra work' } },
    ],
  },
];

/* ─── Helper that returns the default Setup object the UI hydrates
   from on first load. Schools can edit + save (overwrites the seed in
   memory; in production this would persist server-side). */
export function defaultAppraisalSetup() {
  /* Flatten the framework into a quick-lookup criterion config keyed
     by criterion id, capturing only the editable bits. */
  const criteria = {};
  const categoryWeights = {};
  APPRAISAL_FRAMEWORK.forEach(cat => {
    let catSum = 0;
    cat.criteria.forEach(c => {
      criteria[c.id] = {
        mode:   c.autoSource ? 'auto' : 'manual',
        weight: c.weight,
        enabled: true,
      };
      catSum += c.weight;
    });
    /* The category's target weight defaults to the sum of its criteria
       weights, so the recommended framework starts perfectly balanced. */
    categoryWeights[cat.id] = catSum;
  });
  return {
    cycle: 'quarterly',
    grades: APPRAISAL_DEFAULT_GRADES.map(g => ({ ...g })),
    eligibility: APPRAISAL_DEFAULT_ELIGIBILITY.map(e => ({ ...e })),
    parentFeedback: false,
    criteria,
    categoryWeights,
  };
}

/* ─── Seed: a couple of completed appraisals so Reports + lists have
   something to render immediately. Period uses YYYY-Qn / YYYY-MM. */
export const mockAppraisals = [
  {
    id: 1,
    empId: 1,                          // Dr. Islahudin
    period: '2026-Q1',
    cycle: 'quarterly',
    conductedBy: 'Mr. Ahmed Khan',
    conductedAt: '2026-04-02',
    status: 'completed',
    scores: {
      lesson_planning:   95, learning_objectives: 92, teaching_methods: 90, student_engagement: 88, technology_use: 96,
      classroom_mgmt:    92, student_discipline:  94, learning_env:     90,
      academic_perf:     90, student_progress:    88,
      attendance:        98, punctuality:         96, compliance:       95, record_keep: 94,
      teamwork:          90, parent_comm:         92, staff_collab:     88,
      training:          90, skill_growth:        88,
      activities:        92, event_mgmt:          88, admissions:       90, leadership: 95,
    },
    comments: {
      lesson_planning: 'Plans are submitted ahead of schedule and align with curriculum.',
      leadership:      'Took the lead on the digital transformation initiative this quarter.',
      academic_perf:   'Sections under his oversight averaged 88% — best in school.',
    },
    parentFeedback: { score: 92, summary: 'Parents consistently report strong leadership and clear communication.' },
  },
  {
    id: 2,
    empId: 4,                          // Pi (Teacher English)
    period: '2026-Q1',
    cycle: 'quarterly',
    conductedBy: 'Dr. Islahudin',
    conductedAt: '2026-04-03',
    status: 'completed',
    scores: {
      lesson_planning:   84, learning_objectives: 80, teaching_methods: 78, student_engagement: 82, technology_use: 70,
      classroom_mgmt:    80, student_discipline:  82, learning_env:     76,
      academic_perf:     78, student_progress:    80,
      attendance:        92, punctuality:         88, compliance:       82, record_keep: 78,
      teamwork:          80, parent_comm:         78, staff_collab:     76,
      training:          70, skill_growth:        72,
      activities:        72, event_mgmt:          70, admissions:       65, leadership: 70,
    },
    comments: {
      teaching_methods: 'Effective with verbal explanations; could mix in more group work.',
      technology_use:   'Could lean on the mobile app more to track classwork.',
    },
    parentFeedback: null,
  },
  {
    id: 3,
    empId: 5,                          // Xi (Teacher SST, contractual)
    period: '2026-Q1',
    cycle: 'quarterly',
    conductedBy: 'Dr. Islahudin',
    conductedAt: '2026-04-04',
    status: 'completed',
    scores: {
      lesson_planning:   62, learning_objectives: 60, teaching_methods: 58, student_engagement: 65, technology_use: 55,
      classroom_mgmt:    60, student_discipline:  62, learning_env:     58,
      academic_perf:     58, student_progress:    52,
      attendance:        78, punctuality:         72, compliance:       66, record_keep: 60,
      teamwork:          65, parent_comm:         60, staff_collab:     58,
      training:          55, skill_growth:        58,
      activities:        50, event_mgmt:          48, admissions:       40, leadership: 50,
    },
    comments: {
      academic_perf: 'Class averages slipping — needs targeted support.',
      training:      'Recommended for the methodology workshop next month.',
    },
    parentFeedback: null,
  },
];
export const mockAppraisalNextId = 4;

/* ─── Mocked "auto" KPIs we'd pull from each existing module.
   In production each entry below would be a real API call. Returning
   a flat lookup per (empId × criterionId) keeps the UI code simple. */
export function mockAutoScore(empId, criterionId) {
  const tbl = {
    1: {
      lesson_planning: 94, technology_use: 96, student_discipline: 96,
      academic_perf: 88, student_progress: 86,
      attendance: 98, punctuality: 95, compliance: 94, record_keep: 92,
      parent_comm: 91, training: 88, activities: 90, admissions: 85,
    },
    2: {
      lesson_planning: 78, technology_use: 70, student_discipline: 82,
      academic_perf: 74, student_progress: 70,
      attendance: 88, punctuality: 82, compliance: 78, record_keep: 76,
      parent_comm: 70, training: 60, activities: 70, admissions: 50,
    },
    3: {
      lesson_planning: 82, technology_use: 76, student_discipline: 84,
      academic_perf: 80, student_progress: 78,
      attendance: 90, punctuality: 86, compliance: 80, record_keep: 78,
      parent_comm: 72, training: 70, activities: 72, admissions: 55,
    },
    4: {
      lesson_planning: 82, technology_use: 70, student_discipline: 80,
      academic_perf: 78, student_progress: 76,
      attendance: 92, punctuality: 88, compliance: 80, record_keep: 78,
      parent_comm: 76, training: 65, activities: 68, admissions: 50,
    },
    5: {
      lesson_planning: 60, technology_use: 52, student_discipline: 60,
      academic_perf: 58, student_progress: 50,
      attendance: 78, punctuality: 70, compliance: 64, record_keep: 60,
      parent_comm: 58, training: 50, activities: 48, admissions: 38,
    },
  };
  return tbl[empId]?.[criterionId] ?? null;
}

/* ─── List of upstream module sources so Setup can show schools
   exactly which modules feed each auto criterion. */
export const APPRAISAL_AUTO_SOURCES = {
  'attendance.staff_presence':    { module: 'Attendance',        what: 'Staff check-in / check-out logs' },
  'attendance.late_minutes':      { module: 'Attendance',        what: 'Late minutes per day' },
  'attendance.classroom_incidents': { module: 'Attendance',      what: 'Classroom incident reports' },
  'academics.lesson_plans':       { module: 'Academics',         what: 'Lesson plan submissions vs schedule' },
  'examination.class_average':    { module: 'Examination',       what: 'Class average across teacher\'s subjects' },
  'examination.progress_delta':   { module: 'Examination',       what: 'Change in class avg vs previous cycle' },
  'erp.submission_timeliness':    { module: 'ERP-wide',          what: 'On-time vs total required submissions' },
  'erp.records_submitted':        { module: 'ERP-wide',          what: 'Records submitted vs records due' },
  'usage.erp_mobile':             { module: 'Usage Telemetry',   what: 'ERP + Mobile app activity per week' },
  'mobile.parent_messages':       { module: 'Mobile App',        what: 'Parent messages replied vs received' },
  'hr.trainings_attended':        { module: 'HR · Tasks',        what: 'Trainings attended in this cycle' },
  'hr.activities_logged':         { module: 'HR · Tasks',        what: 'School activities logged for this staff' },
  'crm.admissions_contributed':   { module: 'Admission CRM',     what: 'Admissions referred / supported' },
};

export const APPRAISAL_REPORT_TYPES = [
  { id: 'individual',  label: 'Individual Staff Appraisal Report', icon: 'fa-user-check',           tone: 'blue',
    desc: 'Full breakdown of one staff member\'s appraisal — every category, every score, every comment.' },
  { id: 'monthly',     label: 'Monthly Reports',                   icon: 'fa-calendar-days',        tone: 'blue',
    desc: 'All appraisals conducted in a chosen month.' },
  { id: 'quarterly',   label: 'Quarterly Reports',                 icon: 'fa-chart-bar',            tone: 'green',
    desc: 'All appraisals conducted in a chosen quarter.' },
  { id: 'biannual',    label: 'Bi-Annual Reports',                 icon: 'fa-chart-line',           tone: 'indigo',
    desc: 'All appraisals conducted in the chosen 6-month window.' },
  { id: 'annual',      label: 'Annual Reports',                    icon: 'fa-calendar-check',       tone: 'orange',
    desc: 'All appraisals for the chosen academic year.' },
  { id: 'ranking',     label: 'Staff Ranking Report',              icon: 'fa-ranking-star',         tone: 'indigo',
    desc: 'Every staff member ranked by overall score for the chosen period.' },
  { id: 'top',         label: 'Top Performers Report',             icon: 'fa-trophy',               tone: 'green',
    desc: 'The top scorers — useful for recognition programmes.' },
  { id: 'low',         label: 'Low Performers Report',             icon: 'fa-triangle-exclamation', tone: 'orange',
    desc: 'Staff who need support or coaching this cycle.' },
  { id: 'bonus',       label: 'Bonus Eligibility Report',          icon: 'fa-gift',                 tone: 'green',
    desc: 'Staff who cross the bonus eligibility threshold you configured.' },
  { id: 'increment',   label: 'Salary Increment Report',           icon: 'fa-arrow-trend-up',       tone: 'blue',
    desc: 'Staff eligible for a salary increment this cycle.' },
  { id: 'promotion',   label: 'Promotion Eligibility Report',      icon: 'fa-star',                 tone: 'indigo',
    desc: 'Staff who are ready to be considered for promotion.' },
  { id: 'training',    label: 'Training Needs Analysis Report',    icon: 'fa-chalkboard-user',      tone: 'orange',
    desc: 'Suggests training areas based on the categories where staff scored lowest.' },
];
