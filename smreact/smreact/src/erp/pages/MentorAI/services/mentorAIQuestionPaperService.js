import mentorAiApi, { secureMentorUrl } from './mentorAiApi';
import { axiosProgressConfig, sleep, stageFromJobStatus } from './aiProgress';
import { sectionsToPages } from './mentorAIWorksheetService';

/* ═══════════════════════════════════════════════════════════════════
   Mentor AI — Question Paper API (Postman collection "QuestionPaper").

     POST   /api/question-papers/generate/             multipart/form-data
     GET    /api/question-papers/generation-status/:id/
     GET    /api/question-papers/                       list
     GET    /api/question-papers/:id/                   detail
     DELETE /api/question-papers/:id/
     POST   /api/question-papers/:id/edit/              { instruction }
     POST   /api/question-papers/:id/save-to-library/

   Collection me response ke examples nahi hain, is liye har jagah response
   defensively padha jata hai (tracking_id ya direct paper, pdf_url ya
   pageContent). generate / edit / status calls optional
   `opts = { signal, onProgress }` leti hain (Cancel + progress bar).
   ═══════════════════════════════════════════════════════════════════ */

const BASE = '/api/question-papers/';
const PAPER_TYPES = ['objective', 'subjective', 'mixed'];
const DIFFICULTIES = ['easy', 'balanced', 'challenging'];
const bool = (v) => (v ? 'True' : 'False');

/* ─── GENERATE ─── */
export async function generateQuestionPaper(params = {}, opts = {}) {
  const grade = String(params.grade || '').trim();
  const subject = String(params.subject || '').trim();
  if (!grade) throw new Error('Please select a class.');
  if (!subject) throw new Error('Please select a subject.');

  const paperType = PAPER_TYPES.includes(params.paperType) ? params.paperType : 'mixed';
  const difficulty = DIFFICULTIES.includes(params.difficulty) ? params.difficulty : 'balanced';

  const fd = new FormData();
  fd.append('grade_label', grade);
  fd.append('subject_label', subject);
  fd.append('paper_type', paperType);
  fd.append('exam_title', String(params.title || '').trim());
  if (paperType !== 'subjective') {
    fd.append('objective_duration', String(params.objDuration ?? ''));
    fd.append('objective_marks', String(params.objMarks ?? ''));
    fd.append('objective_count', String(params.objCount ?? ''));
    fd.append('objective_instructions', String(params.objInstructions || ''));
  }
  if (paperType !== 'objective') {
    fd.append('subjective_duration', String(params.subjDuration ?? ''));
    fd.append('subjective_marks', String(params.subjMarks ?? ''));
    fd.append('subjective_count', String(params.subjCount ?? ''));
    fd.append('subjective_instructions', String(params.subjInstructions || ''));
  }
  fd.append('region', String(params.region || ''));
  fd.append('board', String(params.board || ''));
  fd.append('difficulty', difficulty);
  fd.append('include_answer_key', bool(params.includeAnswerKey));
  fd.append('include_answer_sheet', bool(params.includeAnswerSheet));
  fd.append('include_branch_branding', bool(params.includeBranding !== false));
  fd.append('language', String(params.language || 'English'));

  /* Debug: jo fields server ko ja rahi hain (error aaye to console me dekhein). */
  console.log('Question paper generate request:', Object.fromEntries(fd.entries()));

  const cfg = {
    timeout: 180000,
    signal: opts.signal,
    ...axiosProgressConfig(opts.onProgress, { waitStage: 'queued', downloadStage: 'queued' }),
  };
  try {
    return (await mentorAiApi.post(`${BASE}generate/`, fd, cfg)).data;
  } catch (error) {
    if (error?.response?.status !== 500) throw error;
    /* Server crash (500): ek baar khali optional fields (region / board) hata kar dobara try —
       kuch backends khali string par crash karte hain. Kuch hata nahi to wahi error. */
    const lean = new FormData();
    fd.forEach((v, k) => { if ((k === 'region' || k === 'board') && v === '') return; lean.append(k, v); });
    if ([...lean.keys()].length === [...fd.keys()].length) throw error;
    console.warn('Question paper generate got 500 — retrying without empty region/board');
    return (await mentorAiApi.post(`${BASE}generate/`, lean, cfg)).data;
  }
}

/* ─── Response normalisation ─── */

/* Server kabhi sawal ek flat list me deta hai: [{ number, kind, part, text, marks, options:[{label,text}] }]
   (pageContent / sections nahi). Use dhoondo aur page-wise sections me badlo. */
const looksLikeQuestion = (x) => x && typeof x === 'object' && typeof x.text === 'string' && (x.number != null || x.no != null || x.kind || x.part);
function findQuestionList(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return [];
  if (Array.isArray(obj)) return obj.length && obj.every(looksLikeQuestion) ? obj : [];
  for (const k of ['questions', 'items']) {
    if (Array.isArray(obj[k]) && obj[k].length && obj[k].every(looksLikeQuestion)) return obj[k];
  }
  for (const v of Object.values(obj)) {
    const hit = findQuestionList(v, depth + 1);
    if (hit.length) return hit;
  }
  return [];
}
const KIND_LABEL = {
  mcq: 'Multiple Choice Questions', assertion: 'Assertion & Reason', true_false: 'True or False', truefalse: 'True or False',
  fill_blank: 'Fill in the Blanks', fill_in_the_blank: 'Fill in the Blanks', fill_blanks: 'Fill in the Blanks', matching: 'Match the Following',
  short: 'Short Answer Questions', short_answer: 'Short Answer Questions', long: 'Long Answer Questions', long_answer: 'Long Answer Questions',
  case_study: 'Case Study Questions', passage: 'Passage Based Questions', numerical: 'Numerical Problems', essay: 'Long Answer Questions',
};
const titleCase = (t) => String(t || '').replace(/[_-]+/g, ' ').replace(/(^|\s)\w/g, (c) => c.toUpperCase());
const fmtMarks = (m) => { const n = Number(m); return Number.isFinite(n) ? String(n) : m; };

function questionsToPages(list) {
  const groups = [];
  const find = (part, kind) => groups.find((g) => g.part === part && g.kind === kind);
  list.forEach((q) => {
    const part = String(q.part || '').toLowerCase();
    const kind = String(q.kind || '').toLowerCase();
    let g = find(part, kind);
    if (!g) { g = { part, kind, qs: [] }; groups.push(g); }
    g.qs.push(q);
  });
  const rank = (g) => (g.part === 'objective' ? 0 : g.part === 'subjective' ? 1 : 2);
  groups.sort((a, b) => rank(a) - rank(b));
  const pages = [];
  let cur = { pageNo: 1, sections: [] };
  let weight = 0;
  const flush = () => { if (cur.sections.length) { pages.push(cur); cur = { pageNo: pages.length + 1, sections: [] }; weight = 0; } };
  let lastPart = null;
  groups.forEach((g) => {
    const partLabel = g.part ? `${titleCase(g.part)} Section` : '';
    const total = g.qs.reduce((a, q) => a + (Number(q.marks) || 0), 0);
    const heading = [partLabel !== lastPart ? partLabel : '', KIND_LABEL[g.kind] || titleCase(g.kind)].filter(Boolean).join(' — ') + (total ? ` [${fmtMarks(total)} marks]` : '');
    lastPart = partLabel;
    let sec = { heading, questions: [] };
    cur.sections.push(sec);
    g.qs.forEach((q) => {
      const w = 1 + (Array.isArray(q.options) ? Math.ceil(q.options.length / 2) : 0) + (/long|essay/.test(g.kind) ? 4 : /short/.test(g.kind) ? 2 : 0) + (q.text.length > 160 ? 1 : 0);
      if (weight + w > 16 && sec.questions.length) {
        flush();
        sec = { heading: `${heading.replace(/^.* — /, '')} (continued)`, questions: [] };
        cur.sections.push(sec);
      }
      sec.questions.push({ no: q.number ?? q.no, text: q.text, marks: q.marks != null ? fmtMarks(q.marks) : null, options: q.options || [], kind: g.kind });
      weight += w;
    });
  });
  flush();
  return pages;
}

export function normalizeQuestionPaper(raw) {
  const p = raw?.question_paper || raw?.questionPaper || raw?.paper
    || raw?.data?.question_paper || raw?.data?.paper || raw?.data || raw || {};
  let pages = Array.isArray(p.pageContent) ? p.pageContent : Array.isArray(p.page_content) ? p.page_content : [];
  /* Worksheet v2 ki tarah: PDF na ho to `sections` (sawal + page number) se on-screen pages banao. */
  if (!pages.length && Array.isArray(p.sections)) pages = sectionsToPages(p.sections);
  if (!pages.length) { const qs = findQuestionList(p); if (qs.length) pages = questionsToPages(qs); }
  /* Server answer_key = [{ q_id, answer, explanation }] — q_id ko sawal ke number se jodo. */
  const allQs = (Array.isArray(p.sections) ? p.sections : []).flatMap((s) => (s?.questions || []));
  const byId = new Map(allQs.map((q) => [String(q.q_id), q]));
  const answerKey = (Array.isArray(p.answer_key) ? p.answer_key : []).map((k) => ({
    no: byId.get(String(k?.q_id))?.number ?? k?.number ?? k?.q_id ?? '',
    answer: String(k?.answer ?? ''), explanation: String(k?.explanation ?? ''),
  }));
  const meta = raw?.metadata || p.metadata || {};
  return {
    ...p,
    answerKey,
    includeAnswerSheet: meta.include_answer_sheet ?? p.include_answer_sheet,
    id: p.id ?? p.question_paper_id ?? p.paper_id ?? null,
    title: p.exam_title || p.title || '',
    pdfUrl: secureMentorUrl(p.pdf_url || p.pdfUrl || p.file_url || p.file || p.document_url) || null,
    answerKeyUrl: secureMentorUrl(p.answer_key_pdf_url || p.answer_key_url || p.answerKeyUrl) || null,
    answerSheetUrl: secureMentorUrl(p.answer_sheet_pdf_url || p.answer_sheet_url || p.answerSheetUrl || p.answer_sheet_file || (typeof p.answer_sheet === 'string' ? p.answer_sheet : '')) || null,
    pageContent: pages,
  };
}

/* Paper ki id kahin aur (response ke upar ke level / tracking id / list) se dhoondo.
   Bina id ke Save to Library / Edit / Delete nahi chalte. */
const idKeys = (o) => (o && typeof o === 'object' ? (o.question_paper_id ?? o.questionPaperId ?? o.paper_id ?? o.paperId ?? null) : null);
async function withPaperId(paper, ...sources) {
  if (!paper || paper.id != null) return paper;
  for (const src of sources) {
    const id = idKeys(src) ?? idKeys(src?.data) ?? src?.data?.question_paper?.id ?? src?.question_paper?.id ?? null;
    if (id != null) return { ...paper, id };
  }
  /* Aakhri tareeqa: apni list me se isi title ka sabse naya paper. */
  try {
    const list = await getQuestionPapers();
    const same = list.filter((x) => x.id != null && (!paper.title || x.title === paper.title));
    const newest = same.sort((a, b) => (Date.parse(b.created_at || 0) || 0) - (Date.parse(a.created_at || 0) || 0) || Number(b.id) - Number(a.id))[0];
    if (newest) return { ...paper, id: newest.id };
  } catch { /* list na mile to id khali hi rahe */ }
  return paper;
}

/* Result tayyar hai? (PDF ya pages mil gaye.) */
export function isPaperReady(paper) {
  return !!(paper && (paper.pdfUrl || paper.pageContent.length));
}

export function trackingIdOf(body) {
  return body?.tracking_id || body?.data?.tracking_id || body?.generation_id || body?.job_id
    || body?.question_paper_id || body?.data?.id || body?.id || null;
}

/* ─── STATUS (poll until finished) ─── */
export async function getQuestionPaperStatus(id, opts = {}) {
  const res = await mentorAiApi.get(`${BASE}generation-status/${id}/`, { signal: opts.signal });
  return res.data;
}

export async function waitForQuestionPaper(trackingId, opts = {}) {
  const { signal, onProgress, maxAttempts = 60, delayMs = 3000 } = opts;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await getQuestionPaperStatus(trackingId, { signal });
    const result = response?.data || response;
    const status = String(result?.status || '').toLowerCase();

    if (status === 'failed' || status === 'error') {
      throw new Error(result?.error || result?.message || 'Question paper generation failed on the server.');
    }
    const paper = normalizeQuestionPaper(result);
    if (['completed', 'complete', 'success', 'done'].includes(status) || isPaperReady(paper)) {
      onProgress?.({ stage: 'formatting' });
      const withId = await withPaperId(paper, result, response);
      return withId.id != null ? withId : { ...withId, id: trackingId };
    }
    onProgress?.(stageFromJobStatus(result));
    await sleep(delayMs, signal);
  }
  const err = new Error('Question paper generation timed out. Please try again.');
  err.kind = 'timeout';
  throw err;
}

/* generate / edit response se final paper nikalo: direct result ya tracking id se poll. */
export async function resolvePaper(response, fallbackId, opts = {}) {
  const direct = normalizeQuestionPaper(response);
  if (isPaperReady(direct)) { opts.onProgress?.({ stage: 'formatting' }); return withPaperId(direct, response); }
  const id = trackingIdOf(response) ?? fallbackId;
  if (id == null) throw new Error('Mentor AI did not return a question paper. Please try again.');
  return waitForQuestionPaper(id, opts);
}

/* ─── EDIT VIA AI ─── Resolves { paper, changes }. */
export async function editQuestionPaperViaAI(paper, instruction, opts = {}) {
  if (!paper?.id) throw new Error('This question paper can\'t be edited because its id is missing.');
  const change = String(instruction || '').trim();
  const res = await mentorAiApi.post(`${BASE}${paper.id}/edit/`, { instruction: change }, {
    timeout: 180000,
    signal: opts.signal,
  });
  const updated = await resolvePaper(res.data, paper.id, opts);
  const merged = { ...paper, ...updated, id: updated.id ?? paper.id };
  const changes = [`Updated with: “${change}”`];
  if ((merged.pdfUrl || '') !== (paper.pdfUrl || '')) changes.push('Regenerated PDF');
  return { paper: merged, changes };
}

/* ─── LIST / DETAIL / DELETE / SAVE ─── */
export async function getQuestionPapers(params = {}) {
  const res = await mentorAiApi.get(BASE, { params });
  const body = res.data;
  const list = Array.isArray(body) ? body : (body?.results || body?.data || []);
  return Array.isArray(list) ? list.map(normalizeQuestionPaper) : [];
}

export async function getQuestionPaperById(id) {
  const res = await mentorAiApi.get(`${BASE}${id}/`);
  return normalizeQuestionPaper(res.data);
}

export async function deleteQuestionPaper(id) {
  const res = await mentorAiApi.delete(`${BASE}${id}/`);
  return res.data;
}

export async function saveQuestionPaperToLibrary(id) {
  const res = await mentorAiApi.post(`${BASE}${id}/save-to-library/`);
  return res.data;
}
