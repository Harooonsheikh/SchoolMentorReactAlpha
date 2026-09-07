import { delay, clone } from './_http';
import {
  CHAT_MODES, PLAN_TIERS, NB_QUESTION_TYPES,
} from '../pages/MentorAI/mentorAiStudioData';

/* ═══════════════════════════════════════════════════════════════════
   mentorAiStudioService — Mentor AI Studio (content-generation suite).

   Distinct from src/services/mentorAiService.js (the Dashboard's ERP
   data-analytics assistant) — see mentorAiStudioData.js header for why
   these are two separate "Mentor AI" products living side by side.

   Every exported function here is the ONLY seam UI components touch.
   Today each resolves against localStorage-backed mock state; when a
   real backend lands, replace each function body with the matching
   HTTP call and keep the signature + return shape identical so no UI
   component needs to change (same contract documented in _http.js).
   ═══════════════════════════════════════════════════════════════════ */

const KEY_CHAT_HISTORY = 'msai_chat_history';
const KEY_WALLET_USAGE = 'msai_wallet_usage';
const KEY_PLAN         = 'msai_plan';
const KEY_LIBRARY      = 'msai_library';
const CHAT_HISTORY_LIMIT = 60;

const readJSON = (key, fallback) => {
  try { const raw = localStorage.getItem(key); const v = raw ? JSON.parse(raw) : null; return v ?? fallback; }
  catch { return fallback; }
};
const writeJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

/* ─── Wallet / usage ─── */

function defaultUsage() {
  return { chat: 0, lessonPlans: 0, notebookBanks: 0, worksheets: 0, designPosts: 0 };
}

export async function getWalletUsage() {
  await delay();
  const planId = readJSON(KEY_PLAN, 'pro');
  const plan = PLAN_TIERS[planId] || PLAN_TIERS.pro;
  const used = { ...defaultUsage(), ...readJSON(KEY_WALLET_USAGE, {}) };
  return clone({ plan: plan.id, limits: plan.limits, used });
}

export async function setPlan(planId) {
  await delay();
  if (!PLAN_TIERS[planId]) throw new Error('Unknown plan');
  writeJSON(KEY_PLAN, planId);
  return getWalletUsage();
}

function consume(category, amount = 1) {
  const used = { ...defaultUsage(), ...readJSON(KEY_WALLET_USAGE, {}) };
  used[category] = (used[category] || 0) + amount;
  writeJSON(KEY_WALLET_USAGE, used);
}

/* ─── AI Chat Assistant ─── */

function fallbackChatResponse(query) {
  return [
    { type: 'heading', text: 'Mentor AI' },
    { type: 'text', text: `Here's a starting point for "${query}". This is demonstration content — Mentor AI Studio is not yet connected to a live language model.` },
    { type: 'bullets', items: ['Try selecting a specialist mode above for a more tailored response.', 'Ask about lesson ideas, classroom strategies, or curriculum advice.'] },
  ];
}

export async function sendChatMessage(query, modeId = 'universal', attachments = []) {
  await delay(700);
  const mode = CHAT_MODES.find(m => m.id === modeId);
  const blocks = mode ? [...mode.demo] : fallbackChatResponse(query);
  if (attachments?.length > 0) {
    const names = attachments.map(a => a.name).join(', ');
    blocks.unshift({ type: 'text', text: `I can see you've attached <b>${attachments.length}</b> file${attachments.length === 1 ? '' : 's'} — ${names}. Once document analysis is connected, I'll be able to read and reference these directly.` });
  }
  consume('chat', Math.max(120, Math.round((query || '').length * 3.2)) + attachments.length * 200);
  return clone({ query, modeId: mode ? mode.id : 'universal', blocks, generatedAt: Date.now() });
}

export async function getChatHistory() {
  await delay();
  const list = readJSON(KEY_CHAT_HISTORY, []);
  return clone(Array.isArray(list) ? list : []);
}

export async function saveChatSession(session) {
  await delay();
  const list = readJSON(KEY_CHAT_HISTORY, []);
  const next = [session, ...list.filter(s => s.id !== session.id)].slice(0, CHAT_HISTORY_LIMIT);
  writeJSON(KEY_CHAT_HISTORY, next);
  return clone(next);
}

export async function deleteChatSession(id) {
  await delay();
  const list = readJSON(KEY_CHAT_HISTORY, []);
  const next = list.filter(s => s.id !== id);
  writeJSON(KEY_CHAT_HISTORY, next);
  return clone(next);
}

/* ─── Lesson Plans ─── */

export async function generateLessonPlan(params) {
  await delay(1400);
  const { cls, section, subject, unit, count = 2, duration = 40, instructions } = params;
  const plans = Array.from({ length: count }, (_, i) => buildLessonPlan({ cls, section, subject, unit, duration, index: i + 1, instructions }));
  consume('lessonPlans', count);
  return clone({ cls, section, subject, unit, duration, plans, generatedAt: Date.now() });
}

function buildLessonPlan({ cls, section, subject, unit, duration, index, instructions }) {
  const topicHint = instructions ? ` (focus: ${instructions})` : '';
  return {
    id: `lp-${Date.now()}-${index}`,
    title: `${unit} — Lesson ${index}`,
    cls, section, subject, unit, duration, version: 1,
    sections: [
      { key: 'slo', title: 'Student Learning Objectives (SLOs)', mins: 5, type: 'numbered',
        items: [
          `Students will identify the key concepts of "${unit}"${topicHint}.`,
          `Students will apply the concept through a guided classroom activity.`,
          `Students will demonstrate understanding through a short assessment.`,
        ] },
      { key: 'intro', title: 'Lesson Introduction', mins: 5, type: 'text',
        text: `Begin by asking students what they already know about ${unit.toLowerCase()}. Use a quick show-of-hands or verbal warm-up to gauge prior knowledge before introducing today's topic for ${subject}, ${cls}${section ? ` — Section ${section}` : ''}.` },
      { key: 'activity', title: 'Main Teaching Activity', mins: Math.max(10, duration - 25), type: 'text',
        text: `Introduce the core idea using a worked example on the board, then move into a guided practice segment where students work in pairs. Circulate to check understanding and address misconceptions as they arise.` },
      { key: 'assessment', title: 'Assessment', mins: 10, type: 'text',
        text: `Assign a short 3–5 question check-for-understanding, either verbally or on paper, covering the key objective(s) from this lesson.` },
      { key: 'homework', title: 'Homework & Closure', mins: 5, type: 'text',
        text: `Recap the lesson's main idea in one sentence with the class, then assign a short follow-up task to reinforce today's learning at home.` },
    ],
  };
}

export async function editLessonPlanViaAI(plan, instruction) {
  await delay(1600);
  const updated = clone(plan);
  updated.version = (updated.version || 1) + 1;
  updated.sections = updated.sections.map(s => ({ ...s }));
  const activity = updated.sections.find(s => s.key === 'activity');
  if (activity) activity.text = `${activity.text} (Updated per request: "${instruction}".)`;
  return clone({ plan: updated, changes: [`Applied: "${instruction}"`, 'Kept original objectives and structure intact.'] });
}

/* ─── Notebook Work ─── */

export async function generateNotebookWork(params) {
  await delay(1300);
  const { cls, section, subject, unit, typeId, count = 8, mainQuestion, instructions } = params;
  const type = NB_QUESTION_TYPES.find(t => t.id === typeId) || NB_QUESTION_TYPES[0];
  consume('notebookBanks', 1);
  return clone(buildNotebookResult({ cls, section, subject, unit, type, count, mainQuestion, instructions }));
}

function buildNotebookResult({ cls, section, subject, unit, type, count, mainQuestion, instructions }) {
  const base = { id: `nb-${Date.now()}`, cls, section, subject, unit, type: type.id, typeName: type.name, version: 1,
    instruction: mainQuestion || defaultInstructionFor(type.id) };
  switch (type.template) {
    case 'pairs':
      return { ...base, template: 'pairs', rows: sampleWords(count).map((w, i) => ({ no: i + 1, word: w, answer: '______________' })) };
    case 'mcq':
      return { ...base, template: 'mcq', rows: Array.from({ length: count }, (_, i) => ({
        no: i + 1, question: `Sample question ${i + 1} for ${unit} (${subject}).`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'] })) };
    case 'table2':
      return { ...base, template: 'table2', left: sampleWords(count), right: sampleWords(count).reverse() };
    case 'sentences':
      return { ...base, template: 'sentences', rows: Array.from({ length: count }, (_, i) => ({ no: i + 1, sentence: `Fill in the blank sentence ${i + 1} about ${unit}. ______________.` })) };
    case 'shortlong':
      return { ...base, template: 'shortlong', rows: Array.from({ length: Math.min(count, 6) }, (_, i) => ({ no: i + 1, question: `Short question ${i + 1} on ${unit}.` })) };
    case 'story':
      return { ...base, template: 'story', title: `A Story About ${unit}`, body: `Once upon a time, in a class much like ${cls}${section ? ` ${section}` : ''}, students learned about ${unit.toLowerCase()}. ${instructions || ''}` };
    case 'essay':
    default:
      return { ...base, template: 'essay', title: `${type.name}: ${unit}`, body: `Write about ${unit.toLowerCase()} in the context of ${subject}. ${instructions || ''}` };
  }
}
function defaultInstructionFor(typeId) {
  if (typeId === 'wordopposites') return 'Write the opposite of the following words.';
  if (typeId === 'wordsynonyms') return 'Write a synonym for the following words.';
  if (typeId === 'singularplural') return 'Write the plural form of the following words.';
  if (typeId === 'fillblanks') return 'Fill in the blanks with the correct word.';
  return 'Complete the following.';
}
function sampleWords(count) {
  const pool = ['Happy', 'Big', 'Fast', 'Bright', 'Cold', 'Loud', 'Kind', 'Strong', 'Clean', 'Early', 'Full', 'Soft'];
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

/* ─── Worksheet Generator ─── */

export async function generateWorksheet(params) {
  await delay(1800);
  const { cls, subject, type, difficulty, format, colorStyle, pages = 2, branding, instructions } = params;
  const result = buildWorksheet({ cls, subject, type, difficulty, format, colorStyle, pages, branding, instructions, version: 1 });
  consume('worksheets', 1);
  return clone(result);
}

function buildWorksheet({ cls, subject, type, difficulty, format, colorStyle, pages, branding, instructions, version }) {
  const pageContent = Array.from({ length: pages }, (_, p) => ({
    pageNo: p + 1,
    sections: [
      { heading: `Section ${String.fromCharCode(65 + (p % 4))}`, questions: Array.from({ length: 6 }, (_, i) => ({
        no: i + 1, text: `${difficulty} ${subject} question ${p * 6 + i + 1} — ${instructions ? instructions : 'based on the current unit'}.` })) },
    ],
  }));
  return {
    id: `ws-${Date.now()}`, cls, subject, type, difficulty, format, colorStyle, pages, branding, version,
    title: `${subject} Worksheet — ${cls}`,
    subtitle: `${type} · ${difficulty}`,
    generatedAt: Date.now(),
    pageContent,
  };
}

export async function editWorksheetViaAI(worksheet, instruction) {
  await delay(2000);
  const updated = clone(worksheet);
  updated.version = (updated.version || 1) + 1;
  const firstSection = updated.pageContent?.[0]?.sections?.[0];
  const newQuestions = [];
  if (firstSection) {
    const extra = { no: firstSection.questions.length + 1, text: `New question added per request: "${instruction}".`, isNew: true };
    firstSection.questions.push(extra);
    newQuestions.push(extra);
  }
  return clone({ worksheet: updated, changes: [`Applied: "${instruction}"`, newQuestions.length ? 'Added 1 new question.' : 'Refined existing content.'] });
}

/* ─── Design Studio ─── */

export async function generateDesignPost(params) {
  await delay(1700);
  const { category, categoryName, platform, platformName, prompt, branding, brandColor } = params;
  const result = buildDesignPost({ category, categoryName, platform, platformName, prompt, branding, brandColor, version: 1 });
  consume('designPosts', 1);
  return clone(result);
}

function buildDesignPost({ category, categoryName, platform, platformName, prompt, branding, brandColor, version }) {
  return {
    id: `ds-${Date.now()}`, category, categoryName, platform, platformName, prompt, branding, brandColor, version,
    headline: headlineFor(category, categoryName),
    subtext: prompt ? prompt.slice(0, 140) : 'Generated by Mentor AI based on your prompt.',
    generatedAt: Date.now(),
  };
}
function headlineFor(category) {
  const map = {
    admission: 'Admissions Now Open!',
    jobad: "We're Hiring — Join Our Team",
    event: 'You\'re Invited!',
    result: 'Congratulations to Our Achievers!',
    course: 'New Programme Starting Soon',
    timetable: 'Updated Timetable',
    others: 'School Announcement',
  };
  return map[category] || 'School Announcement';
}

export async function editDesignPostViaAI(post, instruction) {
  await delay(1600);
  const updated = clone(post);
  updated.version = (updated.version || 1) + 1;
  updated.subtext = `${updated.subtext} (Updated: ${instruction})`;
  return clone({ post: updated, changes: [`Applied: "${instruction}"`] });
}

/* ─── Library ─── */

export async function getLibraryItems() {
  await delay();
  const list = readJSON(KEY_LIBRARY, []);
  return clone(Array.isArray(list) ? list : []);
}

export async function saveToLibrary(item) {
  await delay();
  const list = readJSON(KEY_LIBRARY, []);
  const record = { id: item.id || `lib-${Date.now()}`, savedAt: Date.now(), ...item };
  const next = [record, ...list.filter(l => l.id !== record.id)];
  writeJSON(KEY_LIBRARY, next);
  return clone(record);
}

export async function deleteFromLibrary(id) {
  await delay();
  const list = readJSON(KEY_LIBRARY, []);
  const next = list.filter(l => l.id !== id);
  writeJSON(KEY_LIBRARY, next);
  return clone(next);
}
