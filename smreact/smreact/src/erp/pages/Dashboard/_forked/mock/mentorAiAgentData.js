/* ═══════════════════════════════════════════════════════════════════
   Mentor AI Agent — underlying mock "school records" the ERP Intelligence
   Assistant queries against (students, teachers, fee payments, attendance,
   lesson plans, exam marks). Read ONLY by src/mock/mentorAi.js — mirrors
   that file's own "never import mock/* directly from a UI component"
   convention.

   Deterministic (seeded PRNG, not Math.random) so the same query returns
   the same answer within a session and across reloads — important for a
   UX prototype a principal will click through repeatedly. Structure is
   deliberately close to what a real API response would look like so
   swapping this file for real endpoints later is a data-source-only
   change; nothing here is imported anywhere except mock/mentorAi.js.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── seeded PRNG (mulberry32) — stable across reloads ─── */
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260913);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(min + rand() * (max - min + 1));

const FIRST_NAMES = [
  'Ali', 'Ahmed', 'Bilal', 'Hamza', 'Usman', 'Zain', 'Hassan', 'Hussain', 'Fahad', 'Omar',
  'Fatima', 'Ayesha', 'Sara', 'Zainab', 'Maryam', 'Hira', 'Amna', 'Rabia', 'Sana', 'Noor',
  'Talha', 'Saad', 'Waleed', 'Danish', 'Faizan', 'Rida', 'Areeba', 'Mahnoor', 'Kinza', 'Iqra',
];
const LAST_NAMES = [
  'Khan', 'Ahmed', 'Malik', 'Hassan', 'Raza', 'Iqbal', 'Sheikh', 'Butt', 'Qureshi', 'Farooq',
  'Mahmood', 'Aslam', 'Javed', 'Rafiq', 'Chaudhry', 'Bhatti', 'Anwar', 'Yousaf', 'Tariq', 'Noor',
];
const SUBJECTS = ['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies', 'Computer Science', 'Islamiyat'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SECTIONS = ['A', 'B', 'C'];

function fullName() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }

/* ─── 1. Students (110 records) ───
   avgPercentage/attendancePercentage/weakSubjects are all derived so a
   "weakest students" or "attendance issues" query returns a coherent,
   correlated picture (a genuinely weak student also tends to have lower
   attendance) rather than independently-random, contradictory numbers. */
export const STUDENTS = Array.from({ length: 110 }, (_, i) => {
  const grade = pick(GRADES);
  const section = pick(SECTIONS);
  const band = rand(); // 0=weak .. 1=strong
  const avgPercentage = Math.round(48 + band * 47); // 48–95
  const attendancePercentage = Math.round(70 + band * 28 + rand() * 4); // weak students skew lower attendance too
  const weakSubjects = avgPercentage < 65
    ? Array.from({ length: randInt(1, 2) }, () => pick(SUBJECTS)).filter((v, idx, a) => a.indexOf(v) === idx)
    : [];
  return {
    id: `stu-${i + 1}`,
    name: fullName(),
    regNo: `REG-${1001 + i}`,
    grade,
    section,
    className: `Grade ${grade}`,
    avgPercentage,
    attendancePercentage: Math.min(99, attendancePercentage),
    weakSubjects,
  };
});

/* Seed a handful of exact, memorable fee payments matching the spec's own
   worked example ("paid Rs.7000 fee on 13 September") so that literal demo
   query always returns real, non-empty rows — on top of a broader
   generated month of payments for overall realism. */
const SEEDED_PAYMENTS = [
  { studentId: 'stu-1',  amount: 7000, day: 13, month: 9 },
  { studentId: 'stu-14', amount: 7000, day: 13, month: 9 },
  { studentId: 'stu-27', amount: 7000, day: 13, month: 9 },
];

/* ─── 2. Fee payments — one school month (September 2026) ─── */
export const FEE_PAYMENTS = [
  ...SEEDED_PAYMENTS.map((p, i) => ({ id: `pay-seed-${i}`, ...p, year: 2026 })),
  ...Array.from({ length: 140 }, (_, i) => {
    const student = pick(STUDENTS);
    const amount = pick([4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 9000, 10000]);
    return { id: `pay-${i}`, studentId: student.id, amount, day: randInt(1, 28), month: 9, year: 2026 };
  }),
];

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_LABEL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function findFeePayments({ amount, day, month }) {
  const rows = FEE_PAYMENTS.filter((p) =>
    (amount == null || p.amount === amount) &&
    (day == null || p.day === day) &&
    (month == null || p.month === month));
  return rows.map((p) => {
    const s = STUDENTS.find((st) => st.id === p.studentId);
    return {
      name: s?.name || 'Unknown Student',
      regNo: s?.regNo || '—',
      className: s?.className || '—',
      section: s?.section || '—',
      date: `${String(p.day).padStart(2, '0')} ${MONTH_LABEL[p.month - 1]} ${p.year}`,
      amount: p.amount,
    };
  });
}

export function monthIndexFromText(text) {
  const t = (text || '').toLowerCase();
  const idx = MONTH_NAMES.findIndex((m) => t.includes(m));
  return idx === -1 ? null : idx + 1;
}

/* ─── 3. Fee collection — whole-school monthly summary + defaulters ─── */
export function getFeeCollectionSummary() {
  const totalStudents = STUDENTS.length;
  const generatedChallans = totalStudents;
  const paidStudentIds = new Set(FEE_PAYMENTS.filter((p) => p.month === 9).map((p) => p.studentId));
  const collectedAmount = FEE_PAYMENTS.filter((p) => p.month === 9).reduce((sum, p) => sum + p.amount, 0);
  const defaulters = STUDENTS.filter((s) => !paidStudentIds.has(s.id)).slice(0, 12);
  const avgFee = 7500;
  const pendingAmount = defaulters.length * avgFee;
  return {
    totalStudents, generatedChallans,
    collectedAmount, pendingAmount,
    paidCount: paidStudentIds.size,
    pendingCount: defaulters.length,
    defaulters: defaulters.map((s) => ({ name: s.name, regNo: s.regNo, className: s.className, section: s.section, amountDue: avgFee })),
  };
}

/* ─── 4. Weakest students ─── */
const WEAK_REASONS = [
  'Low attendance + weak assessments', 'Frequent absenteeism affecting continuity',
  'Struggles with foundational concepts', 'Inconsistent homework completion',
  'Needs remedial support in core subjects',
];
export function getWeakestStudents(n = 8) {
  return [...STUDENTS]
    .sort((a, b) => a.avgPercentage - b.avgPercentage)
    .slice(0, n)
    .map((s) => ({
      name: s.name, className: s.className, section: s.section,
      avgPercentage: s.avgPercentage,
      weakSubjects: s.weakSubjects.length ? s.weakSubjects.join(', ') : 'General',
      attendancePercentage: s.attendancePercentage,
      reason: s.attendancePercentage < 82 ? WEAK_REASONS[0] : pick(WEAK_REASONS.slice(1)),
    }));
}

/* ─── 5. Attendance issues (bottom-attendance students) ─── */
export function getAttendanceIssues(n = 10) {
  return [...STUDENTS]
    .sort((a, b) => a.attendancePercentage - b.attendancePercentage)
    .slice(0, n)
    .map((s) => {
      const absentDays = Math.round((100 - s.attendancePercentage) / 100 * 22); // ~22 school days/month
      return {
        name: s.name, className: s.className, section: s.section,
        attendancePercentage: s.attendancePercentage,
        absentDays,
        actionRequired: s.attendancePercentage < 80 ? 'Contact parents — formal notice' : 'Monitor closely',
      };
    });
}

/* ─── 6. Teachers (20 records) + lesson plans + performance ─── */
export const TEACHERS = Array.from({ length: 20 }, (_, i) => {
  const subject = SUBJECTS[i % SUBJECTS.length];
  const classesAssigned = Array.from({ length: randInt(2, 5) }, () => `Grade ${pick(GRADES)}-${pick(SECTIONS)}`)
    .filter((v, idx, a) => a.indexOf(v) === idx);
  const lessonPlansAssigned = randInt(8, 14);
  const band = rand();
  const lessonPlansSubmitted = Math.min(lessonPlansAssigned, Math.round(lessonPlansAssigned * (0.55 + band * 0.45)));
  const lastSubmissionDay = randInt(1, 12);
  const homeworkChecking = Math.round(60 + band * 38);
  const studentFeedback = Math.round(60 + band * 38);
  const lessonPlanCompletion = Math.round((lessonPlansSubmitted / lessonPlansAssigned) * 100);
  const overall = Math.round((lessonPlanCompletion + homeworkChecking + studentFeedback) / 3);
  return {
    id: `tch-${i + 1}`,
    name: fullName(),
    subject,
    classesAssigned,
    lessonPlansAssigned,
    lessonPlansSubmitted,
    lessonPlansPending: lessonPlansAssigned - lessonPlansSubmitted,
    lastSubmissionDate: `${String(lastSubmissionDay).padStart(2, '0')} Sep 2026`,
    lessonPlanCompletion,
    homeworkChecking,
    studentFeedback,
    overallScore: overall,
    performanceSummary: overall >= 80
      ? 'Consistently strong across lesson planning, homework checking, and feedback.'
      : overall >= 65
        ? 'Solid overall, with room to tighten lesson-plan submission timeliness.'
        : 'Needs support — multiple performance indicators below school average.',
  };
});

export function getTeachersWithPendingLessonPlans() {
  return TEACHERS
    .filter((t) => t.lessonPlansPending > 0)
    .sort((a, b) => b.lessonPlansPending - a.lessonPlansPending)
    .map((t) => ({
      name: t.name, subject: t.subject,
      assigned: t.lessonPlansAssigned, submitted: t.lessonPlansSubmitted, pending: t.lessonPlansPending,
      lastSubmissionDate: t.lastSubmissionDate,
    }));
}

export function getTeachersNeedingAttention(n = 8) {
  return [...TEACHERS]
    .sort((a, b) => a.overallScore - b.overallScore)
    .slice(0, n)
    .map((t) => ({
      name: t.name, subject: t.subject,
      lessonPlanCompletion: `${t.lessonPlanCompletion}%`,
      homeworkChecking: `${t.homeworkChecking}%`,
      studentFeedback: `${t.studentFeedback}%`,
      performanceSummary: t.performanceSummary,
    }));
}

/* ─── 7. Examination — school-wide results summary ─── */
export function getExamResultsSummary() {
  const byGrade = {};
  STUDENTS.forEach((s) => {
    byGrade[s.grade] = byGrade[s.grade] || [];
    byGrade[s.grade].push(s.avgPercentage);
  });
  const gradeRows = Object.keys(byGrade).sort((a, b) => a - b).map((g) => {
    const vals = byGrade[g];
    const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    return { className: `Grade ${g}`, students: vals.length, avgPercentage: avg, passRate: `${Math.round((vals.filter((v) => v >= 50).length / vals.length) * 100)}%` };
  });
  const topPerformers = [...STUDENTS].sort((a, b) => b.avgPercentage - a.avgPercentage).slice(0, 5);
  const schoolAvg = Math.round(STUDENTS.reduce((s, v) => s + v.avgPercentage, 0) / STUDENTS.length);
  return { gradeRows, topPerformers, schoolAvg };
}

/* ─── 8. School Reports — whole-school monthly rollup ─── */
export function getSchoolMonthlyReport() {
  const fee = getFeeCollectionSummary();
  const exam = getExamResultsSummary();
  const avgAttendance = Math.round(STUDENTS.reduce((s, v) => s + v.attendancePercentage, 0) / STUDENTS.length);
  const avgLessonPlanCompletion = Math.round(TEACHERS.reduce((s, t) => s + t.lessonPlanCompletion, 0) / TEACHERS.length);
  return {
    totalStudents: STUDENTS.length,
    totalTeachers: TEACHERS.length,
    feeCollectionPercent: Math.round((fee.collectedAmount / (fee.collectedAmount + fee.pendingAmount)) * 100),
    avgAttendance,
    schoolAvgResult: exam.schoolAvg,
    avgLessonPlanCompletion,
  };
}

export { MONTH_LABEL };
