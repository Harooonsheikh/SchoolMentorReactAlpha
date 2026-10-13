// src/erp/pages/MentorAI/services/mentorAIPortalService.js
//
// Bridge between Mentor AI (AI-generated plans) and the SchoolMentor ERP portal
// (Academics → Lesson Plans). Uses the SAME endpoints the ERP Lesson Plans
// screen already uses, with the logged-in user's ERP token, so everything is
// saved under the current user / branch.
//
//   GET  /api/getulpforclassesmaster   → units (unitNo + unitName) for class+section+subject
//   POST /api/ulpforclassmastercrud    → topic row (one per lesson plan)
//   POST /api/ulpforclassdetailcrud    → plan content (SLO, intro, development, recap + minutes)

import { buildUrl, apiMessage } from '../../../../utils/apiConfig';

const erpHeaders = (extra = {}) => ({
    Accept: '*/*',
    Authorization: `bearer ${sessionStorage.getItem('token') || ''}`,
    ...extra,
});

const branchId = () => sessionStorage.getItem('branchID') || '';

// Backend accepts only "English" / "Urdu" (capitalised) for medium.
const apiMedium = (m) => (String(m || 'english').toLowerCase() === 'urdu' ? 'Urdu' : 'English');

/* ─────────────────────────  UNITS  ───────────────────────── */

export async function getPortalUnits({ classID, sectionID, subjectID }) {
    if (!classID || !sectionID || !subjectID) return [];

    const url = buildUrl(
        `/api/getulpforclassesmaster?branchID=${branchId()}&classID=${classID}` +
        `&SectionID=${sectionID}&subjectID=${subjectID}&pageNo=1`
    );
    const res = await fetch(url, { method: 'GET', headers: erpHeaders() });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiMessage(json) || 'Could not load units');

    // One row per lesson topic → group into unique units.
    const rows = Array.isArray(json?.data) ? json.data : [];
    const seen = new Map();
    rows.forEach((r) => {
        const unitNo = r.unitNo ?? r.UnitNo ?? '';
        const unitName = r.unitName ?? r.UnitName ?? '';
        if (!unitName && unitNo === '') return;
        const key = `${unitNo}__${unitName}`;
        if (!seen.has(key)) {
            seen.set(key, { unitNo, unitName, medium: String(r.medium || 'english').toLowerCase() });
        }
    });
    return Array.from(seen.values());
}

/* ─────────────────────  SAVE TO PORTAL  ───────────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The ERP editors store HTML (innerHTML), Mentor AI returns light markdown.
const mdToHtml = (t) =>
    esc(t)
        .replace(/^#{1,6}\s*(.+)$/gm, '<b>$1</b>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\r?\n/g, '<br>');

function sectionToHtml(sec) {
    if (!sec) return '';
    if (sec.type === 'numbered') {
        return `<ol>${(sec.items || []).map((i) => `<li>${mdToHtml(i)}</li>`).join('')}</ol>`;
    }
    return mdToHtml(sec.text || '');
}

async function erpPost(path, payload) {
    const res = await fetch(buildUrl(path), {
        method: 'POST',
        headers: erpHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiMessage(json) || `${path} failed (${res.status})`);
    return json;
}

/**
 * plan : one item from generateLessonPlan().plans  (has .title, .duration, .sections[])
 * unit : { unitNo, unitName, medium }
 * ctx  : { classID, sectionID, subjectID, className, subjectName }
 */
export async function savePlanToPortal({ plan, unit, ctx }) {
    if (!plan) throw new Error('No lesson plan to save.');
    if (!ctx?.classID || !ctx?.sectionID || !ctx?.subjectID) {
        throw new Error('Class, section and subject are required.');
    }
    if (!unit?.unitName) throw new Error('Please select a unit first.');

    const sec = (key) => (plan.sections || []).find((s) => s.key === key);
    const slo = sec('slo');
    const intro = sec('intro');
    const dev = sec('activity');
    const recap = sec('recap');

    // 1) Topic (master) row
    const master = await erpPost('/api/ulpforclassmastercrud', {
        id: 0,
        branchID: String(branchId()),
        classID: String(ctx.classID),
        sectionID: String(ctx.sectionID),
        subjectID: String(ctx.subjectID),
        unitNo: String(unit.unitNo),
        unitName: unit.unitName,
        lessonPlanTopic: plan.title || '',
        medium: apiMedium(unit.medium),
        action: 'insert',
    });
    const masterId = master?.id;
    if (!masterId) throw new Error('Portal did not return a topic id.');

    // 2) Plan content (detail) row
    await erpPost('/api/ulpforclassdetailcrud', {
        id: 0,
        termID: '',
        slot: '',
        classID: String(ctx.classID),
        subjectID: String(ctx.subjectID),
        unitNo: String(unit.unitNo),
        unitName: unit.unitName,
        totalLessonPlans: '',
        timeDuration: plan.duration ? String(plan.duration) : '',
        lessonPlanTopic: plan.title || '',
        learningObjective: sectionToHtml(slo),
        timeForLearning: slo?.mins ? String(slo.mins) : '',
        lessonIntroduction: sectionToHtml(intro),
        timeForLesson: intro?.mins ? String(intro.mins) : '',
        development: sectionToHtml(dev),
        timeForDevelopment: dev?.mins ? String(dev.mins) : '',
        recap: sectionToHtml(recap),
        timeForRecap: recap?.mins ? String(recap.mins) : '',
        rating: '',
        suggestion: '',
        suggestionDescription: '',
        masterClassesID: masterId,
        className: ctx.className || '',
        subjectName: ctx.subjectName || '',
        action: 'insert',
    });

    return { masterId };
}

/* ───────────────────  NOTEBOOK — SAVE TO PORTAL  ─────────────────────
   The Notebook Lesson Plan "Save to Portal" button used to call the Mentor AI
   backend's own /api/notebook-lesson-plans/ endpoint, which is a separate,
   disconnected service — so nothing actually reached the ERP (Academics →
   Lesson Plans → Notebook Plans never showed it, and the call itself errors).
   This mirrors savePlanToPortal above, but targets the ERP's real notebook
   endpoints: one notebook unit (master) row, then one row per question
   through that question type's own CRUD endpoint — the same endpoints the
   ERP's own Notebook Plans "Add Questions" screen uses.
*/

// Mentor AI's notebook type id (NB_QUESTION_TYPES) → ERP question-type key.
const NB_TYPE_TO_PORTAL_API = {
    wordopposites: 'word_opposite',
    wordsynonyms: 'word_synonyms',
    wordsentences: 'word_sentences',
    mcqs: 'mcqs',
    circlecorrect: 'circle_words',
    singularplural: 'singular_plural',
    punctuation: 'punctuation',
    comprehension: 'comprehension',
    paragraph: 'paragraph',
    fillblanks: 'fill_blanks',
    truefalse: 'true_false',
    matchcolumn: 'match_columns',
    shortquestions: 'short_questions',
    longquestion: 'long_question',
    letters: 'letter',
    applications: 'application',
    stories: 'stories',
    essays: 'essays',
};

// Split a single merged letter/application field back into subject + body
// (the ERP stores these as two fields; the AI result carries one).
function splitLetterText(text) {
    const html = mdToHtml(text || '');
    if (!html.trim()) return { subject: '', body: '' };
    const parts = html.split(/<br\s*\/?>/i);
    if (parts.length > 1) return { subject: parts[0].trim(), body: parts.slice(1).join('<br>').trim() };
    return { subject: html.trim(), body: '' };
}

// ERP question-type key → { endpoint, body(row, index) }. `row` is one item
// from the AI result's normalized `rows` array. The ERP requires a Marks
// value on every question row; the AI doesn't produce one, so a sensible
// default is applied centrally below (see DEFAULT_NB_MARKS).
const DEFAULT_NB_MARKS = '1';

// Reads a value the way the notebook result screen does, falling through a
// list of possible source fields — but unlike `a || b`, treats boolean
// `false` and the number `0` as real answers instead of "missing".
const firstVal = (...vals) => {
    for (const v of vals) {
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
};

const NB_PORTAL_API = {
    word_opposite: { endpoint: '/api/ulpnwordoppositecrud', body: (r) => ({ word: r.word || '', opposite: r.opposite || r.answer || '' }) },
    singular_plural: { endpoint: '/api/ulpnsingularpluralcrud', notebookIDString: true, body: (r) => ({ singular: r.singular || '', plural: r.plural || r.answer || '' }) },
    word_synonyms: { endpoint: '/api/ulpnwordSynonymcrud', notebookIDString: true, body: (r) => ({ word: r.word || '', synonym: r.synonym || r.answer || '' }) },
    // Matches the result screen's SentencesRenderer: sentence text is read
    // as `sentence` first, falling back to `question` — not the other way.
    word_sentences: { endpoint: '/api/ulpnwordsentencecrud', body: (r) => ({ word: r.word || '', sentences: String(firstVal(r.sentence, r.question, r.answer)) }) },
    mcqs: {
        endpoint: '/api/ulpnmcqscrud',
        body: (r) => {
            const o = r.options || [];
            return { question: r.question || '', option1: o[0] || '', option2: o[1] || '', option3: o[2] || '', option4: o[3] || '', correctAnswer: r.answer || '' };
        },
    },
    // Matches SentencesRenderer's isFillBlank path: sentence text is read as
    // `sentence` first, falling back to `question`.
    fill_blanks: { endpoint: '/api/ulpnfilltheblankcrud', body: (r) => { const q = String(firstVal(r.sentence, r.question)); const a = String(firstVal(r.answer, r.word)); return { question: q, answer: a, correctAnswer: a }; } },
    // Matches McqRenderer's isTrueFalse path: the statement is read as
    // `statement` first, falling back to `question`/`sentence`. The answer
    // can legitimately be the boolean `false`, so it must not be dropped by
    // a plain `||` fallback.
    true_false: { endpoint: '/api/ulpntruefalsecrud', body: (r) => { const q = String(firstVal(r.statement, r.question, r.sentence)); const a = String(firstVal(r.answer)); return { question: q, answer: a, correctAnswer: a }; } },
    match_columns: { endpoint: '/api/ulpnmatchcolumncrud', body: (r, i) => ({ columnA: r.columnA || '', columnB: r.columnB || '', correctAnswer: '', srNo: String(i + 1) }) },
    short_questions: { endpoint: '/api/ulpnquestionanswercrud', body: (r) => ({ question: r.question || '', answer: r.answer || '', correctAnswer: r.answer || '' }) },
    circle_words: { endpoint: '/api/ulpncirclecorrectwordcrud', body: (r) => ({ question: r.question || r.statement || '', answer: r.answer || '' }) },
    punctuation: { endpoint: '/api/ulpnpunctuationcrud', body: (r) => ({ punctuation: r.question || r.sentence || '', answer: r.answer || '' }) },
    long_question: { endpoint: '/api/ulpnLongQuestioncrud', notebookIDString: true, body: (r) => ({ question: r.question || '', answer: r.answer || '' }) },
    paragraph: { endpoint: '/api/ulpnparagraphcrud', body: (r) => ({ topic: r.title || '', paragraph: mdToHtml(r.body || '') }) },
    comprehension: { endpoint: '/api/ulpncomprehensionquestioncrud', body: (r) => ({ question: r.question || '', answer: r.answer || '', correctAnswer: r.answer || '' }) },
    letter: { endpoint: '/api/ulpnlettercrud', body: (r) => ({ ...splitLetterText(r.body), regards: '' }) },
    application: { endpoint: '/api/ulpnapplicationcrud', body: (r) => ({ ...splitLetterText(r.body), regards: '' }) },
    stories: { endpoint: '/api/ulpnstoriescrud', body: (r) => ({ subject: r.title || r.subject || '', body: mdToHtml(r.body || ''), moral: r.moral || '' }) },
    essays: { endpoint: '/api/ulpnessaycrud', body: (r) => ({ subject: r.title || r.subject || '', body: mdToHtml(r.body || ''), conclusion: r.conclusion || '' }) },
};

/**
 * typeId : the Mentor AI notebook type id (nbType.id, e.g. 'wordopposites')
 * rows   : nbResult.rows — normalized question rows from the AI result
 * unit   : { unitNo, unitName, medium }
 * ctx    : { classID, sectionID, subjectID }
 */
export async function saveNotebookPlanToPortal({ typeId, mainQuestion, statement, rows, unit, ctx }) {
    if (!ctx?.classID || !ctx?.sectionID || !ctx?.subjectID) {
        throw new Error('Class, section and subject are required.');
    }
    if (!unit?.unitName) throw new Error('Please select a unit first.');
    if (!Array.isArray(rows) || !rows.length) throw new Error('No questions to save.');

    const apiType = NB_TYPE_TO_PORTAL_API[typeId] || typeId;
    const api = NB_PORTAL_API[apiType];
    if (!api) throw new Error('This question type is not supported for saving yet.');

    // 1) Notebook unit (master) row — same as the ERP's own Manage Units.
    const master = await erpPost('/api/ulpfornotebookmastercrud', {
        id: 0,
        branchID: String(branchId()),
        classID: String(ctx.classID),
        sectionID: String(ctx.sectionID),
        subjectID: String(ctx.subjectID),
        unitNo: String(unit.unitNo),
        unitName: unit.unitName,
        lessonPlanTopic: '',
        medium: apiMedium(unit.medium),
        action: 'insert',
    });
    const masterId = master?.id;
    if (!masterId) throw new Error('Portal did not return a notebook unit id.');

    // 2) Each question, through its type's own CRUD endpoint.
    const notebookID = api.notebookIDString ? String(masterId) : masterId;
    const mq = (mainQuestion || '').trim();
    const marksField = apiType === 'mcqs' ? { totalMarks: DEFAULT_NB_MARKS } : { marks: DEFAULT_NB_MARKS };
    const calls = rows.map((row, i) => erpPost(api.endpoint, {
        id: 0,
        notebookID,
        branchID: String(branchId()),
        mainQuestion: mq,
        isCheck: true,
        action: 'insert',
        ...marksField,
        ...(apiType === 'comprehension' ? { comprehensionStatement: statement || '' } : {}),
        ...api.body(row, i),
    }));
    await Promise.all(calls);

    return { masterId };
}