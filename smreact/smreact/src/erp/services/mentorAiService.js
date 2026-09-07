import { MENTOR_AI_SCENARIOS, getNaturalAnswer } from '../mock/mentorAi';
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
   ═══════════════════════════════════════════════════════════════════ */

const MATCHERS = [
  {
    test: q => /sara\s*ahmed|teacher\s*perform/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.teacherPerformance,
  },
  {
    test: q => /ali\s*khan|student\s*(perform|analy)|exam(ination)?s?\s*compar/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.studentPerformance,
  },
  {
    test: q => /fee/.test(q) && /(outstanding|due|pending|collection)/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.feeAnalysis,
  },
  {
    test: q => /account|income|expense|financ/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.accountsOverview,
  },
  {
    test: q => /hr\b|staff\s*(perform|overview)/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.hrOverview,
  },
  {
    test: q => /attendance/.test(q),
    scenario: () => MENTOR_AI_SCENARIOS.attendanceAnalysis,
  },
];

export async function askMentorAI(query, ctx = {}) {
  await delay(650); // slightly longer than the ERP-wide default — feels like "thinking"
  const q = (query || '').toLowerCase().trim();

  const match = MATCHERS.find(m => m.test(q));
  const response = match ? match.scenario() : getNaturalAnswer(query);

  return clone({
    ...response,
    query,
    generatedAt: ctx.now || null,
  });
}
