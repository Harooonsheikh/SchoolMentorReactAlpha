/* ═══════════════════════════════════════════════════════════════════
   lessonPlanMapper — Lesson Planner ↔ Mentor AI backend mapping layer.

   Pure functions only (no axios, no React) so the UI never has to know
   the backend's field names, and the backend never has to know the UI's.

   Frontend → backend (multipart form for generate, JSON for edit):
     cls            → grade
     subject        → subject
     unit           → unit_name
     unitNumber     → unit_number
     duration       → time_duration
     count          → number_of_lesson_plans
     instructions   → additional_prompt      (omitted when blank)
     files[]        → files (+ file_type 'image' | 'pdf')
     (constant)     → lessonplan_type = 'classwork'

   Backend → frontend section model used by LessonPlans.jsx:
     { id, title, cls, section, subject, duration, version, sections:[
         { key, title, mins, type:'numbered'|'text', items|text } ] }

   Field names for the plan body come from the Postman "edit lesson plan"
   request (lesson_plan_data): lesson_plan_title, student_learning_objective,
   lesson_introduction, development, recap_consolidation — each
   { content, time }. Sections the backend may add later (assessment,
   homework, resources, differentiation, teacher/student activities…) are
   picked up by alias or by a generic fallback, so nothing is silently lost.
   ═══════════════════════════════════════════════════════════════════ */

export const LESSON_PLAN_TYPE = 'classwork';

/* ─── Errors ─── */

/* kind: validation | auth | token_limit | rate_limit | server | network |
         timeout | empty_response | unknown */
export class LessonPlanError extends Error {
  constructor(message, { kind = 'unknown', status = null, details = null, tokens = null } = {}) {
    super(message);
    this.name = 'LessonPlanError';
    this.kind = kind;
    this.status = status;
    this.details = details;
    this.tokens = tokens;
  }
}

const TOKEN_WORDS = /token|quota|exceed|insufficient|balance|subscription|wallet|usage limit|limit reached|limit exceeded/i;
const RATE_WORDS = /rate|throttl|too many/i;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/* Best human-readable message out of whatever the backend sent. Never
   returns HTML or a raw JSON dump. */
export function pickBackendMessage(data) {
  if (data == null) return '';
  if (typeof data === 'string') {
    const s = data.trim();
    if (!s || s.startsWith('<')) return '';
    return s.length > 300 ? `${s.slice(0, 300)}…` : s;
  }
  if (Array.isArray(data)) return data.map(pickBackendMessage).filter(Boolean).join(' ');
  if (isObj(data)) {
    for (const k of ['error', 'detail', 'message', 'msg', 'non_field_errors']) {
      const m = pickBackendMessage(data[k]);
      if (m) return m;
    }
    // DRF-style field errors: { grade: ["This field is required."] }
    const parts = Object.entries(data)
      .map(([k, v]) => {
        const m = pickBackendMessage(v);
        return m ? `${k}: ${m}` : '';
      })
      .filter(Boolean);
    return parts.join(' · ');
  }
  return '';
}

/* Normalise any thrown value (axios error, LessonPlanError, plain Error)
   into a LessonPlanError with a message that is safe to show to teachers. */
export function toLessonPlanError(err) {
  if (err instanceof LessonPlanError) return err;

  // User pressed Cancel (AbortController) — not a failure to report.
  if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError') {
    return new LessonPlanError('Cancelled.', { kind: 'cancelled' });
  }

  const status = err?.response?.status ?? null;
  const data = err?.response?.data;
  const backendMsg = pickBackendMessage(data);
  const tokens = extractTokenInfo(data, err?.response?.headers);

  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
    return new LessonPlanError(
      'Generating is taking longer than expected. Please try again — fewer lesson plans or a smaller file will be faster.',
      { kind: 'timeout', details: err?.message },
    );
  }

  if (!err?.response) {
    // axios with no response = network/CORS/mixed-content failure; a plain
    // Error thrown by our own code keeps its message.
    if (err?.isAxiosError || err?.request) {
      return new LessonPlanError(
        'Could not reach Mentor AI. Please check your internet connection and try again.',
        { kind: 'network', details: err?.message },
      );
    }
    return new LessonPlanError(err?.message || 'Something went wrong. Please try again.', { kind: 'unknown' });
  }

  const combined = `${backendMsg} ${typeof data === 'string' ? data.slice(0, 500) : ''}`;

  if (status === 402 || ((status === 403 || status === 429 || status === 400) && TOKEN_WORDS.test(combined))) {
    return new LessonPlanError(
      (backendMsg && TOKEN_WORDS.test(backendMsg)) ? backendMsg : 'You have reached your Mentor AI token limit. Please upgrade your plan or wait for your limit to reset.',
      { kind: 'token_limit', status, details: data, tokens },
    );
  }
  if (status === 429) {
    return new LessonPlanError('Too many requests right now. Please wait a moment and try again.', { kind: 'rate_limit', status, details: data });
  }
  if (status === 401) {
    return new LessonPlanError('Your Mentor AI session has expired. Please reload the page and try again.', { kind: 'auth', status, details: data });
  }
  if (status === 403) {
    return new LessonPlanError(backendMsg || 'Your account does not have access to Lesson Plans.', { kind: 'auth', status, details: data });
  }
  if (status === 413) {
    return new LessonPlanError('The uploaded file is too large. Please upload a smaller PDF or fewer photos.', { kind: 'validation', status, details: data });
  }
  if (status === 400 || status === 415 || status === 422) {
    return new LessonPlanError(backendMsg || 'Mentor AI could not process this request. Please check your inputs and try again.', { kind: 'validation', status, details: data });
  }
  if (status >= 500) {
    return new LessonPlanError('Mentor AI is having trouble right now. Please try again in a moment.', { kind: 'server', status, details: data });
  }
  return new LessonPlanError(backendMsg || 'Lesson Plan generation failed. Please try again.', { kind: 'unknown', status, details: data });
}

/* ─── Token usage ─────────────────────────────────────────────────
   The Postman collection has no saved responses, so the token-usage shape
   is unknown. This reads the common spellings from the body or headers
   and returns null when nothing usable is present — the UI shows a token
   line only when this returns a number. */
const REMAINING_KEYS = ['tokens_remaining', 'remaining_tokens', 'tokens_left', 'remaining'];
const LIMIT_KEYS = ['token_limit', 'tokens_limit', 'total_tokens_allowed', 'token_quota'];
const USED_KEYS = ['tokens_used', 'used_tokens'];

const num = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const firstNum = (o, keys) => {
  if (!isObj(o)) return null;
  for (const k of keys) {
    const n = num(o[k]);
    if (n !== null) return n;
  }
  return null;
};

export function extractTokenInfo(data, headers) {
  const pools = [data, data?.data, data?.usage, data?.token_usage, data?.wallet, data?.data?.usage, data?.data?.wallet];
  let remaining = null;
  let limit = null;
  let used = null;
  for (const p of pools) {
    if (remaining === null) remaining = firstNum(p, REMAINING_KEYS);
    if (limit === null) limit = firstNum(p, LIMIT_KEYS);
    if (used === null) used = firstNum(p, USED_KEYS);
  }
  if (remaining === null && headers) {
    const h = (k) => (typeof headers.get === 'function' ? headers.get(k) : headers[k]);
    remaining = num(h('x-tokens-remaining') ?? h('x-token-remaining'));
  }
  if (remaining === null && limit !== null && used !== null) remaining = Math.max(0, limit - used);
  if (remaining === null) return null;
  return { remaining, limit, used };
}

/* ─── Request: generate ─── */

const isPdf = (f) => /\.pdf$/i.test(f?.name || '') || f?.type === 'application/pdf';
const isImage = (f) => (f?.type || '').startsWith('image/') || /\.(png|jpe?g|webp|heic|heif|gif)$/i.test(f?.name || '');

/* input: { cls, subject, unit, unitNumber, duration, count, instructions, files:File[] }
   returns { formData, fileType } */
export function buildGenerateFormData(input = {}) {
  const { cls, subject, unit, unitNumber, duration, count, instructions } = input;
  const files = (input.files || []).filter((f) => typeof File !== 'undefined' && f instanceof File);

  if (!nonEmpty(String(cls ?? ''))) throw new LessonPlanError('Please select a class first.', { kind: 'validation' });
  if (!nonEmpty(String(subject ?? ''))) throw new LessonPlanError('Please select a section and subject first.', { kind: 'validation' });
  if (files.length === 0) throw new LessonPlanError('Please add at least one textbook page (photo or PDF).', { kind: 'validation' });
  if (files.some((f) => f.size === 0)) throw new LessonPlanError('One of the selected files is empty. Please re-upload it.', { kind: 'validation' });

  const pdfs = files.filter(isPdf);
  const images = files.filter((f) => !isPdf(f) && isImage(f));
  if (pdfs.length && images.length) {
    throw new LessonPlanError('Please use either photos or a PDF for one lesson plan, not both.', { kind: 'validation' });
  }
  if (pdfs.length + images.length !== files.length) {
    throw new LessonPlanError('Only photos (JPG, PNG…) and PDF files are supported.', { kind: 'validation' });
  }
  const fileType = pdfs.length ? 'pdf' : 'image';

  const fd = new FormData();
  fd.append('lessonplan_type', LESSON_PLAN_TYPE);
  fd.append('file_type', fileType);
  files.forEach((f) => fd.append('files', f, f.name));
  fd.append('unit_name', String(unit ?? ''));
  fd.append('unit_number', String(unitNumber || 1));
  fd.append('grade', String(cls));
  fd.append('subject', String(subject));
  fd.append('time_duration', String(duration || 40));
  fd.append('number_of_lesson_plans', String(count || 1));
  if (nonEmpty(instructions)) fd.append('additional_prompt', instructions.trim());
  return { formData: fd, fileType };
}

/* ─── Request: edit ─── */
export function buildEditPayload(plan, instruction) {
  const payload = {
    lessonplan_type: LESSON_PLAN_TYPE,
    additional_prompt: String(instruction || '').trim(),
    lesson_plan_data: plan?.raw || {},
  };
if (plan?.documentId != null && plan.documentId !== '') payload.document_id = plan.documentId;
if (plan?.lessonId != null && plan.lessonId !== '') {
  payload.lesson_plan_id = plan.lessonId;
  payload.lesson_id = plan.lessonId;
}
return payload;
}

/* ─── Response: locate the plan objects ─── */

const PLAN_HINT_KEYS = ['lesson_plan_title', 'student_learning_objective', 'lesson_introduction', 'development', 'recap_consolidation'];
const looksLikePlan = (o) => isObj(o) && PLAN_HINT_KEYS.some((k) => k in o);
const WRAPPER_KEYS = ['lesson_plan_data', 'lesson_plan', 'plan', 'data'];
const CONTAINER_KEYS = ['lesson_plans', 'lessonplans', 'plans', 'lesson_plan_data', 'lesson_plan', 'results', 'result', 'data', 'response'];

const docIdOf = (o) => (isObj(o) ? o.document_id ?? o.documentId ?? null : null);

function collectPlans(node, inheritedDoc, depth = 0) {
  if (depth > 4 || node == null) return [];
  if (Array.isArray(node)) {
    const out = [];
    node.forEach((n) => {
      const found = collectPlans(n, inheritedDoc, depth + 1);
      out.push(...found);
    });
    return out;
  }
  if (!isObj(node)) return [];
  const doc = docIdOf(node) ?? inheritedDoc;
  if (looksLikePlan(node)) return [{ raw: node, documentId: docIdOf(node) ?? inheritedDoc }];
  for (const k of WRAPPER_KEYS) {
    if (looksLikePlan(node[k])) return [{ raw: node[k], documentId: docIdOf(node[k]) ?? doc }];
  }
  for (const k of CONTAINER_KEYS) {
    if (node[k] != null) {
      const found = collectPlans(node[k], doc, depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

/* ─── Response: plan body → section model ─── */

const META_KEYS = new Set([
  'id', 'document_id', 'documentid', 'unit_number', 'unit_name', 'grade', 'class', 'subject', 'section',
  'time_duration', 'duration', 'lesson_plan_number', 'lesson_plan_title', 'title', 'version',
  'created_at', 'updated_at', 'lessonplan_type', 'file_type', 'additional_prompt', 'status', 'user', 'branch',
]);

const SECTION_DEFS = [
  { key: 'slo', title: 'Student Learning Objectives (SLOs)', numbered: 'always', aliases: ['student_learning_objective', 'student_learning_objectives', 'learning_objectives', 'learning_objective', 'objectives', 'slo', 'slos'] },
  { key: 'intro', title: 'Lesson Introduction', aliases: ['lesson_introduction', 'introduction', 'lesson_intro', 'warm_up', 'warmup'] },
  { key: 'activity', title: 'Development', aliases: ['development', 'teaching_steps', 'main_activity', 'main_teaching_activity'] },
  { key: 'teacher', title: 'Teacher Activities', aliases: ['teacher_activities', 'teacher_activity'] },
  { key: 'student', title: 'Student Activities', aliases: ['student_activities', 'student_activity'] },
  { key: 'assessment', title: 'Assessment', aliases: ['assessment', 'check_for_understanding', 'evaluation'] },
  { key: 'recap', title: 'Recap & Consolidation', aliases: ['recap_consolidation', 'recap', 'consolidation', 'closure', 'conclusion', 'plenary'] },
  { key: 'homework', title: 'Homework & Activity', aliases: ['homework', 'home_work', 'homework_activity', 'follow_up'] },
  { key: 'resources', title: 'Resources', aliases: ['resources', 'materials', 'teaching_resources'] },
  { key: 'differentiation', title: 'Differentiation', aliases: ['differentiation', 'differentiated_instruction'] },
];

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const humanize = (k) => normKey(k).split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export function parseMinutes(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const m = v.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return undefined;
}

const stringify = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(stringify).filter(Boolean).join('; ');
  if (isObj(v)) {
    const inner = v.content ?? v.text ?? v.description;
    if (inner != null) return stringify(inner);
    return Object.values(v).map(stringify).filter(Boolean).join('; ');
  }
  return '';
};

/* Turn "1. A. 2. B. 3. C." (or newline / bullet lists, or arrays) into
   items. Returns null when the text isn't a list. */
export function splitListItems(content) {
  if (Array.isArray(content)) {
    const items = content.map(stringify).filter(Boolean);
    return items.length ? items : null;
  }
  const s = stringify(content);
  if (!s) return null;

  const lines = s.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  const bullet = /^(?:\d{1,2}[.)]|[-•*])\s+/;
  if (lines.length >= 2 && lines.every((l) => bullet.test(l))) {
    return lines.map((l) => l.replace(bullet, '').trim());
  }

  // Inline "1. … 2. … 3. …" — accept only a clean 1..n sequence with no
  // preamble, so "3.5 cm" or "Step 2. Do X" in prose is never split.
  const re = /(?:^|\s)(\d{1,2})[.)]\s+/g;
  const marks = [];
  let m;
  while ((m = re.exec(s)) !== null) marks.push({ n: parseInt(m[1], 10), start: m.index, end: re.lastIndex });
  if (marks.length >= 2 && marks[0].start === 0 && marks.every((mk, i) => mk.n === i + 1)) {
    return marks
      .map((mk, i) => s.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : s.length).trim())
      .filter(Boolean);
  }
  return null;
}

function toSection(def, value) {
  let content = value;
  let time;
  if (isObj(value)) {
    content = value.content ?? value.text ?? value.description ?? value.items ?? null;
    time = value.time ?? value.duration ?? value.minutes ?? value.mins;
    if (content == null) content = value; // object without content → stringify values
  }
  // Backend "## Learning Objectives" jaisi heading content mein bhejta hai — hata do
  if (typeof content === 'string') {
    content = content.replace(/^\s*#{1,6}\s+.*$/gm, '').replace(/\*\*/g, '').trim();
  }
  const list = splitListItems(content);
  const mins = parseMinutes(time);
  if (list && (def.numbered === 'always' || list.length >= 2)) {
    return { key: def.key, title: def.title, mins, type: 'numbered', items: list };
  }
  const text = stringify(content);
  if (!text) return null;
  if (def.numbered === 'always') return { key: def.key, title: def.title, mins, type: 'numbered', items: [text] };
  return { key: def.key, title: def.title, mins, type: 'text', text };
}

/* raw backend plan body → UI plan. ctx: { cls, section, subject, duration,
   index, documentId, version, id } */
export function mapPlan(raw, ctx = {}) {
  const claimed = new Set();
  const sections = [];

  SECTION_DEFS.forEach((def) => {
    const foundKey = Object.keys(raw).find((k) => def.aliases.includes(normKey(k)) && !claimed.has(k));
    if (!foundKey) return;
    claimed.add(foundKey);
    const sec = toSection(def, raw[foundKey]);
    if (sec) sections.push(sec);
  });

  // Generic fallback: any other non-metadata block the backend adds later.
  Object.keys(raw).forEach((k) => {
    if (claimed.has(k) || META_KEYS.has(normKey(k)) || SECTION_DEFS.some((d) => d.aliases.includes(normKey(k)))) return;
    const v = raw[k];
    if (v == null || (typeof v === 'object' && !Array.isArray(v) && !('content' in v) && !('text' in v))) return;
    const sec = toSection({ key: `x_${normKey(k)}`, title: humanize(k) }, v);
    if (sec) sections.push(sec);
  });

  const index = ctx.index ?? 1;
  const unitName = stringify(raw.unit_name);
  const number = raw.lesson_plan_number ?? index;
  const title =
    stringify(raw.lesson_plan_title) ||
    stringify(raw.title) ||
    (unitName ? `${unitName} — Lesson ${number}` : `Lesson Plan ${number}`);

  return {
    id: ctx.id ?? `lp-${ctx.documentId ?? 'x'}-${index}-${Date.now()}`,
    title,
    cls: stringify(raw.grade) || ctx.cls || '',
    section: ctx.section || '',
    subject: stringify(raw.subject) || ctx.subject || '',
    unit: unitName || ctx.unit || '',
    duration: parseMinutes(raw.time_duration) ?? parseMinutes(ctx.duration) ?? undefined,
    version: ctx.version ?? 1,
    documentId: ctx.documentId ?? null,
    lessonId: ctx.lessonId ?? null,
    raw,
    sections,
  };
}

/* Full generate/edit response → { plans, documentId, tokens }.
   Throws LessonPlanError('empty_response' | 'token_limit') when the body
   holds no usable plan, instead of rendering raw JSON in the UI. */
export function parsePlansResponse(data, ctx = {}, headers) {
  let body = data;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { /* keep string */ }
  }
  const tokens = extractTokenInfo(body, headers);
   const found = collectPlans(body, docIdOf(body) ?? docIdOf(body?.data) ?? null);
  const lessonId =
    body?.lesson_plan_id ?? body?.lesson_id ??
    body?.data?.lesson_plan_id ?? body?.data?.lesson_id ??
    ctx.lessonId ?? null;

  const plans = found
    .map(({ raw, documentId }, i) => mapPlan(raw, { ...ctx, index: i + 1, lessonId, documentId: documentId ?? ctx.documentId ?? null }))
    .filter((p) => p.sections.length > 0);
  if (plans.length === 0) {
    const msg = pickBackendMessage(body);
    if (msg && TOKEN_WORDS.test(msg)) throw new LessonPlanError(msg, { kind: 'token_limit', details: body, tokens });
    throw new LessonPlanError(
      msg || 'Mentor AI returned an empty lesson plan. Please try again, or use clearer textbook pages.',
      { kind: 'empty_response', details: body },
    );
  }
  return { plans, documentId: plans[0].documentId, tokens };
}

/* ─── Edit-preview summary: which sections changed ─── */
export function summarizeChanges(before, after) {
  const changes = [];
  const prev = new Map((before?.sections || []).map((s) => [s.key, s]));
  const sig = (s) => JSON.stringify([s.text || '', s.items || []]);
  (after?.sections || []).forEach((s) => {
    const p = prev.get(s.key);
    if (!p) changes.push(`Added "${s.title}"`);
    else if (sig(p) !== sig(s)) changes.push(`Updated "${s.title}"`);
    prev.delete(s.key);
  });
  prev.forEach((s) => changes.push(`Removed "${s.title}"`));
  if (before?.title && after?.title && before.title !== after.title) changes.push(`Renamed lesson to "${after.title}"`);
  return changes;
}