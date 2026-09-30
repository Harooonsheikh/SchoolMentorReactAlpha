import { MENTOR_AI_SCENARIOS, getNaturalAnswer, buildFeePaymentSearch } from '../mock/mentorAi';
import { monthIndexFromText } from '../mock/mentorAiAgentData';
import { delay, clone } from './_http';

/* ═══════════════════════════════════════════════════════════════════
   mentorAiService — Mentor AI ERP Intelligence Assistant.

   askMentorAI(query, ctx?) is the ONLY entry point the UI should call.
   Today it resolves against src/mock/mentorAi.js via simple keyword
   matching (development-only — not a real NLU engine). When the
   backend lands, replace the body of askMentorAI with a call to:

     POST /api/mentor-ai/query
     { query, schoolId, userId, sessionContext }

   ...and keep the return shape identical so no UI component needs to
   change. `ctx` is accepted today for forward-compatibility (role,
   sessionId, etc.) but is not yet used to restrict results — the
   backend will own that once permissions are wired in.

   detectCategory(query) reuses the same MATCHERS table (just returns a
   category id instead of building the full scenario) — the UI calls it
   to pick which 4 "agent is working…" step labels to show, so the
   working animation feels tied to what's actually being asked instead
   of a single generic message.
   ═══════════════════════════════════════════════════════════════════ */

/* Pulls an amount ("Rs.7000", "amount 7000", "7000 rupees") and a day+month
   ("on 13 September") out of free text — good enough for this mock's
   purpose; a real NLU/backend would replace this entirely. */
function extractAmount(q) {
  const m = q.match(/rs\.?\s*([\d,]{3,})/i) || q.match(/amount\s*(?:of\s*)?(?:rs\.?)?\s*([\d,]{3,})/i) || q.match(/([\d,]{3,})\s*(?:rupees|pkr)/i);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}
function extractDay(q) {
  const m = q.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  return m ? parseInt(m[1], 10) : null;
}

const MATCHERS = [
  /* ── Parametrized fee-payment lookup — must come before the generic
     fee matchers below so a query like "Find students who paid Rs.7000
     fee on 13 September" (or the voice-mock equivalent) hits this one. ── */
  {
    category: 'fee',
    test: q => /fee/.test(q) && /(paid|payment)/.test(q) && (extractAmount(q) != null || extractDay(q) != null),
    scenario: (q) => buildFeePaymentSearch(q, { amount: extractAmount(q), day: extractDay(q), month: monthIndexFromText(q) || 9 }),
  },
  {
    category: 'fee',
    test: q => /fee/.test(q) && (/collection/.test(q) && /report|complete/.test(q)),
    scenario: () => MENTOR_AI_SCENARIOS.feeCollectionReport,
  },
  {
    category: 'fee',
    test: q => /unpaid|defaulter/.test(q) && /fee/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.feeCollectionReport,
  },
  {
    category: 'students',
    test: q => /weak(est)?\s*student/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.weakestStudents,
  },
  {
    category: 'students',
    test: q => /student/.test(q) && /(need|require)s?\s*attention/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.weakestStudents,
  },
  {
    category: 'attendance',
    test: q => /attendance/.test(q) && /issue/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.attendanceIssues,
  },
  {
    category: 'lessonPlans',
    test: q => /lesson\s*plan/.test(q) && /pending/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.lessonPlanPending,
  },
  {
    category: 'lessonPlans',
    test: q => /teacher/.test(q) && /pending\s*work|work.*pending/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.lessonPlanPending,
  },
  {
    category: 'teachers',
    test: q => /teacher/.test(q) && /(need|require)s?\s*attention/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.teachersNeedingAttention,
  },
  {
    category: 'reports',
    test: q => /(monthly|school)\s*report|generate.*report/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.schoolMonthlyReport,
  },
  {
    category: 'examination',
    test: q => /exam(ination)?/.test(q) && /(summary|result|overview)/.test(q) && !/ali\s*khan/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.examResultsSummary,
  },
  {
    category: 'academics',
    test: q => /academic/.test(q) && !/ali\s*khan/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.academicsOverview,
  },
  {
    category: 'teachers',
    test: q => /sara\s*ahmed|teacher\s*perform/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.teacherPerformance,
  },
  {
    category: 'students',
    test: q => /ali\s*khan|student\s*(perform|analy)|exam(ination)?s?\s*compar/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.studentPerformance,
  },
  {
    category: 'fee',
    test: q => /fee/.test(q) && /(outstanding|due|pending|collection)/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.feeAnalysis,
  },
  {
    category: 'reports',
    test: q => /account|income|expense|financ/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.accountsOverview,
  },
  {
    category: 'teachers',
    test: q => /hr\b|staff\s*(perform|overview)/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.hrOverview,
  },
  {
    category: 'attendance',
    test: q => /attendance/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.attendanceAnalysis,
  },
];

const CATEGORY_STEPS = {
  fee: ['Understanding request…', 'Checking Fee Records…', 'Analyzing Payment Data…', 'Preparing Report…'],
  students: ['Understanding request…', 'Checking Student Records…', 'Analyzing Student Data…', 'Preparing Report…'],
  academics: ['Understanding request…', 'Checking Academic Records…', 'Analyzing Subject Performance…', 'Preparing Report…'],
  attendance: ['Understanding request…', 'Checking Attendance Records…', 'Analyzing Attendance Patterns…', 'Preparing Report…'],
  teachers: ['Understanding request…', 'Checking Staff Records…', 'Analyzing Teacher Performance…', 'Preparing Report…'],
  lessonPlans: ['Understanding request…', 'Checking Lesson Plan Records…', 'Analyzing Submissions…', 'Preparing Report…'],
  examination: ['Understanding request…', 'Checking Examination Records…', 'Analyzing Results…', 'Preparing Report…'],
  reports: ['Understanding request…', 'Gathering School Data…', 'Compiling Summary…', 'Preparing Report…'],
  general: ['Understanding request…', 'Searching School Data…', 'Analyzing Results…', 'Preparing Report…'],
};

/** Returns a category id (see CATEGORY_STEPS) for a raw query string — used
 *  by the UI to pick the 4 "agent is working…" step labels before the
 *  actual (mock) answer is ready. */
export function detectCategory(query) {
  const q = (query || '').toLowerCase().trim();
  const match = MATCHERS.find(m => m.test(q));
  return match?.category || 'general';
}

export function stepsForQuery(query) {
  return CATEGORY_STEPS[detectCategory(query)] || CATEGORY_STEPS.general;
}

export async function askMentorAI(query, ctx = {}) {
  await delay(650); // slightly longer than the ERP-wide default — feels like "thinking"
  const q = (query || '').toLowerCase().trim();

  const match = MATCHERS.find(m => m.test(q));
  const response = match ? match.scenario(q) : getNaturalAnswer(query);

  return clone({
    ...response,
    query,
    generatedAt: ctx.now || null,
  });
}
