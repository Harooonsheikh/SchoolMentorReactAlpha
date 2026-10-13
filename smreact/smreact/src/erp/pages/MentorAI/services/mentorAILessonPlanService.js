import mentorAiApi from "./mentorAiApi";
import { axiosProgressConfig } from "./aiProgress";
import {
    LessonPlanError,
    buildGenerateFormData,
    buildEditPayload,
    parsePlansResponse,
    summarizeChanges,
    toLessonPlanError,
} from "./lessonPlanMapper";

/* Every generate/edit call accepts an optional last argument
   `opts = { signal, onProgress }` — AbortSignal for Cancel, and a real
   progress reporter (upload bytes → response bytes → parsing) for the
   shared ProgressBar. Callers that omit it behave exactly as before. */
function requestConfig(opts = {}) {
    return {
        timeout: REQUEST_TIMEOUT_MS,
        signal: opts.signal,
        ...axiosProgressConfig(opts.onProgress),
    };
}

/* ═══════════════════════════════════════════════════════════════════
   Lesson Planner + Notebook Lesson Plan service — Mentor AI backend.

   Endpoints:
     POST /ai/api/generate-lesson-plan-openai/   multipart/form-data
     POST /ai/api/edit-lesson-plan-openai/        application/json
     POST /ai/api/generate-notebook-work-openai/  multipart/form-data  (legacy)

   Auth: mentorAiApi's interceptor adds `Authorization: Bearer <access>`
   from localStorage.mentor_ai_access (set by MentorAI.jsx on mount).
   ═══════════════════════════════════════════════════════════════════ */

const GENERATE_URL = "/ai/api/generate-lesson-plan-openai/";
const EDIT_URL = "/ai/api/edit-lesson-plan-openai/";
const NOTEBOOK_WORK_URL = "/ai/api/generate-notebook-work-openai/";
const REQUEST_TIMEOUT_MS = 120000;

/* ── Frontend NB type id → API question_field_type mapping ── */
const NB_TYPE_TO_API = {
    wordopposites:   'word_opposite',
    wordsynonyms:    'word_synonyms',
    wordsentences:   'word_sentences',
    mcqs:            'MCQs',
    circlecorrect:   'circle_the_correct_words',
    singularplural:  'singular_plural',
    punctuation:     'punctuation',
    comprehension:   'comprehension',
    paragraph:       'paragraph_writing',
    fillblanks:      'fill_in_the_blank',
    truefalse:       'true_fals',
    matchcolumn:     'match_the_column',
    shortquestions:  'short_questions',
    longquestion:    'long_questions',
    letters:         'letter',
    applications:    'application',
    stories:         'stories',
    essays:          'essay',
    // Also accept the API ids directly (identity mapping)
    word_opposite:             'word_opposite',
    word_synonyms:             'word_synonyms',
    word_sentences:            'word_sentences',
    word_sentence:             'word_sentences',   // ← FIX: API may use singular form
    MCQs:                      'MCQs',
    circle_the_correct_words:  'circle_the_correct_words',
    singular_plural:           'singular_plural',
    fill_in_the_blank:         'fill_in_the_blank',
    // (duplicate `truefalse: 'true_false'` removed — it overrode the entry
    //  above; the API's value is 'true_fals', per the Postman collection)
    match_the_column:          'match_the_column',
    short_questions:           'short_questions',
    long_questions:            'long_questions',
    paragraph_writing:         'paragraph_writing',
    letter:                    'letter',
    application:               'application',
    mid_liner:                 'mid_liner',
    essay:                     'essay',
};

function assertSession() {
    if (!localStorage.getItem("mentor_ai_access")) {
        throw new LessonPlanError(
            "Mentor AI is not signed in yet. Please reload the page and try again.",
            { kind: "auth" }
        );
    }
}

function reportFailure(label, err) {
    if (err.kind !== "validation") {
        console.error(`${label}:`, err.kind, err.status ?? "", err.details ?? err.message);
    }
}


// ===============================
// GENERATE LESSON PLAN (classwork)
// ===============================

export async function generateLessonPlan(payload = {}, opts = {}) {
    try {
        assertSession();
console.log("CLASSWORK DEBUG:", JSON.stringify((payload.files || []).map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified }))));
        const { formData } = buildGenerateFormData(payload);
        const response = await mentorAiApi.post(
            GENERATE_URL,
            formData,
            requestConfig(opts)
        );
        opts.onProgress?.({ stage: "formatting" });
        return parsePlansResponse(
            response.data,
            {
                cls: payload.cls,
                section: payload.section,
                subject: payload.subject,
                unit: payload.unit,
                duration: payload.duration,
            },
            response.headers
        );
    } catch (error) {
        const err = toLessonPlanError(error);
        reportFailure("Generate Lesson Plan Error", err);
        throw err;
    }
}


// ===============================
// EDIT LESSON PLAN VIA AI (classwork)
// ===============================

export async function editLessonPlanViaAI(plan, instruction, opts = {}) {
    try {
        assertSession();
        const response = await mentorAiApi.post(
            EDIT_URL,
            buildEditPayload(plan, instruction),
            requestConfig(opts)
        );
        opts.onProgress?.({ stage: "formatting" });
        const { plans, tokens } = parsePlansResponse(
            response.data,
            {
                cls: plan.cls,
                section: plan.section,
                subject: plan.subject,
                unit: plan.unit,
                duration: plan.duration,
                          id: plan.id,
                version: (plan.version || 1) + 1,
                documentId: plan.documentId,
                lessonId: plan.lessonId,
            },
            response.headers
        );
        // When the backend returns the whole document (every plan that
        // shares document_id), take the plan that was edited — not blindly
        // plans[0], which overwrote Lesson Plan 2+ with Lesson Plan 1.
        const updated = pickEditedPlan(plan, plans);
        return {
            plan: updated,
            changes: summarizeChanges(plan, updated),
            tokens
        };
    } catch (error) {
        const err = toLessonPlanError(error);
        reportFailure("Edit Lesson Plan Error", err);
        throw err;
    }
}


function pickEditedPlan(original, plans) {
    if (plans.length === 1) return plans[0];
    const num = original?.raw?.lesson_plan_number;
    if (num != null) {
        const byNum = plans.find(p => String(p.raw?.lesson_plan_number) === String(num));
        if (byNum) return byNum;
    }
    const byTitle = plans.find(p => p.title && p.title === original?.title);
    return byTitle || plans[0];
}


// ═══════════════════════════════════════════════════════════════════
// NOTEBOOK LESSON PLAN — GENERATE
// ═══════════════════════════════════════════════════════════════════

export async function generateNotebookLessonPlan(params = {}, opts = {}) {
    try {
        assertSession();

        const formData = new FormData();

        formData.append("lessonplan_type", "notebook");

     const file = params.file || params.files?.[0];
if (file) {
    const isPdf = /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';
    formData.append("file_type", isPdf ? "pdf" : "image");
    const ext = (file.name || '').split('.').pop() || (isPdf ? 'pdf' : 'jpg');
    formData.append("files", file, `upload_${Date.now()}.${ext}`);
}
console.log("UPLOAD DEBUG:", file?.name, file?.size, file?.lastModified, "documentId:", params.documentId);

        formData.append("grade",       params.cls || params.grade || "");
        formData.append("subject",     params.subject || "");
        formData.append("unit_name",   params.unit || params.unitName || "");
        formData.append("unit_number", String(params.unitNumber || 1));

        formData.append("main_question", params.mainQuestion || "");
        formData.append("periods_classes_required", String(params.periodsRequired || 1));
        formData.append("number_of_question_field_required", String(params.count || params.numberOfQuestions || 8));

        const questionTypes = params.questionTypes || params.questionFieldTypes || [];
        if (Array.isArray(questionTypes) && questionTypes.length > 0) {
            questionTypes.forEach(typeId => {
                const apiType = NB_TYPE_TO_API[typeId] || typeId;
                formData.append("question_field_type", apiType);
            });
        } else if (params.typeId) {
            const apiType = NB_TYPE_TO_API[params.typeId] || params.typeId;
            formData.append("question_field_type", apiType);
        }

 if (params.documentId && !file) {
    formData.append("document_id", String(params.documentId));
}
        if (params.instructions?.trim()) {
            formData.append("additional_prompt", params.instructions.trim());
        }

        console.log("=== NOTEBOOK LESSON PLAN GENERATE ===");
        console.log("Endpoint:", GENERATE_URL);
        for (const [k, v] of formData.entries()) {
            console.log(`  ${k}:`, v instanceof File ? `[File: ${v.name}]` : v);
        }

        const response = await mentorAiApi.post(
            GENERATE_URL,
            formData,
            requestConfig(opts)
        );
        opts.onProgress?.({ stage: "formatting" });

        console.log("=== NOTEBOOK LESSON PLAN RESPONSE ===");
        console.log(response.data);

        const parsed = parseNotebookLessonPlanResponse(response.data, params);

        if (!parsed.rows.length) {
            // Don't silently show an empty card — surface it so the caller can warn
            throw new LessonPlanError(
                "The AI responded, but no questions could be read from the response.",
                { kind: "empty", details: response.data }
            );
        }
        return parsed;

    } catch (error) {
        const err = toLessonPlanError(error);
        reportFailure("Generate Notebook Lesson Plan Error", err);
        throw err;
    }
}


// ═══════════════════════════════════════════════════════════════════
// NOTEBOOK LESSON PLAN — EDIT VIA AI
// ═══════════════════════════════════════════════════════════════════

export async function editNotebookLessonPlanViaAI(notebookData, instruction, opts = {}) {
    try {
        assertSession();

        const payload = {
            lessonplan_type: "notebook",
            additional_prompt: String(instruction || "").trim(),
            lesson_plan_data: notebookData.raw || notebookData,
        };

        // Postman "edit notebook lesson plan": { lessonplan_type, additional_prompt,
        // document_id, lesson_plan_data }. Without document_id the server asks for
        // lesson_plan_id instead ("lesson_plan_id is required"), so send both.
        const documentId = notebookData.documentId ?? documentIdOf(notebookData.raw);
        const lessonId = notebookData.lessonId ?? lessonIdOf(notebookData.raw);
        if (documentId != null && documentId !== '') payload.document_id = String(documentId);
        if (lessonId != null && lessonId !== '') {
            payload.lesson_plan_id = lessonId;
            payload.lesson_id = lessonId;
        }
        if (payload.document_id == null && payload.lesson_plan_id == null) {
            console.warn("Notebook edit: the generate response had no document_id / lesson_plan_id.", notebookData);
        }

        const response = await mentorAiApi.post(
            EDIT_URL,
            payload,
            requestConfig(opts)
        );
        opts.onProgress?.({ stage: "formatting" });

        console.log("=== NOTEBOOK EDIT RESPONSE ===");
        console.log(response.data);

        const parsed = parseNotebookLessonPlanResponse(response.data, {
            cls: notebookData.cls,
            subject: notebookData.subject,
            unit: notebookData.unit,
            lessonId,
            documentId,
        });

        parsed.version = (notebookData.version || 1) + 1;
        parsed.documentId = parsed.documentId || notebookData.documentId;

        return {
            notebook: parsed,
            changes: summarizeNotebookChanges(notebookData, parsed),
        };

    } catch (error) {
        const err = toLessonPlanError(error);
        reportFailure("Edit Notebook Lesson Plan Error", err);
        throw err;
    }
}


// ═══════════════════════════════════════════════════════════════════
// NOTEBOOK WORK — GENERATE (legacy endpoint, kept for backward compat)
// ═══════════════════════════════════════════════════════════════════

export async function generateNotebookWork(params, opts = {}) {
    try {
        assertSession();

        const formData = new FormData();

        formData.append("question_type",  params.typeId || "");
        formData.append("grade",          params.cls || "");
        formData.append("subject",        params.subject || "");
        formData.append("unit_name",      params.unit || "");
        formData.append("number_of_questions", String(params.count || 8));
        formData.append("main_question",  params.mainQuestion || "");
        formData.append("additional_prompt", params.instructions || "");

        if (params.file) {
            formData.append("files", params.file);
        }

        const response = await mentorAiApi.post(
            NOTEBOOK_WORK_URL,
            formData,
            {
                headers: { "Content-Type": "multipart/form-data" },
                signal: opts.signal,
                ...axiosProgressConfig(opts.onProgress),
                timeout: REQUEST_TIMEOUT_MS,
            }
        );

        return response.data;

    } catch (error) {
        console.error("Notebook API Error:", error.response?.data || error.message);
        throw error;
    }
}


// ═══════════════════════════════════════════════════════════════════
// SAVE / LIST / GET / DELETE
// ═══════════════════════════════════════════════════════════════════

export async function saveLessonPlan(data) {
    try {
        const response = await mentorAiApi.post("/api/lesson-plans/", data);
        return response.data;
    } catch (error) {
        console.error("Save Lesson Plan Error:", error.response?.data || error.message);
        throw error;
    }
}

export async function saveNotebookLessonPlan(data) {
    try {
        const response = await mentorAiApi.post("/api/notebook-lesson-plans/", data);
        return response.data;
    } catch (error) {
        console.error("Save Notebook Lesson Plan Error:", error.response?.data || error.message);
        throw error;
    }
}

export async function getLessonPlans(params = {}) {
    try {
        const response = await mentorAiApi.get("/api/lesson-plans/", { params });
        return response.data;
    } catch (error) {
        console.error("Get Lesson Plans Error:", error.response?.data || error.message);
        throw error;
    }
}

export async function getLessonPlanById(id) {
    try {
        const response = await mentorAiApi.get(`/api/lesson-plans/${id}/`);
        return response.data;
    } catch (error) {
        console.error("Get Lesson Plan Detail Error:", error.response?.data || error.message);
        throw error;
    }
}

export async function deleteLessonPlan(id) {
    try {
        const response = await mentorAiApi.delete(`/api/lesson-plans/${id}/`);
        return response.data;
    } catch (error) {
        console.error("Delete Lesson Plan Error:", error.response?.data || error.message);
        throw error;
    }
}


// ═══════════════════════════════════════════════════════════════════
// RESPONSE PARSERS — Notebook Lesson Plan (defensive: handles many shapes)
// ═══════════════════════════════════════════════════════════════════

const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

const TEMPLATE_MAP = {
    wordopposite: 'pairs', wordopposites: 'pairs', wordsynonyms: 'pairs', wordsynonym: 'pairs',
    singularplural: 'pairs',
    wordsentences: 'sentences', wordsentence: 'sentences', fillintheblank: 'sentences', fillblanks: 'sentences',
    punctuation: 'sentences', midliner: 'sentences',
    mcqs: 'mcq', mcq: 'mcq', truefals: 'mcq', truefalse: 'mcq', circlethecorrectwords: 'mcq',
    matchthecolumn: 'table2',
    shortquestions: 'shortlong', longquestions: 'shortlong', longquestion: 'shortlong',
    comprehension: 'comprehension',
    paragraphwriting: 'essay', letter: 'essay', application: 'essay',
    essay: 'essay', essays: 'essay',
    stories: 'story', story: 'story',
};

export function mapTypeToTemplate(typeKey) {
    return TEMPLATE_MAP[normKey(typeKey)] || 'shortlong';
}

/* ── Normalise the API type key into a canonical form for rendering hints ── */
const PAIR_SUBTYPE_MAP = {
    wordopposite: 'opposite', wordopposites: 'opposite',
    wordsynonyms: 'synonym', wordsynonym: 'synonym',
    singularplural: 'singular_plural',
};
export function pairSubtype(typeKey) {
    return PAIR_SUBTYPE_MAP[normKey(typeKey)] || 'generic';
}

/* ── Normalise the API type key so renderers know whether it's true/false,
     circle-correct, comprehension, word_sentence, etc. ── */
const MCQ_SUBTYPE_MAP = {
    truefals: 'truefalse', truefalse: 'truefalse',
    circlethecorrectwords: 'circle',
};
export function mcqSubtype(typeKey) {
    return MCQ_SUBTYPE_MAP[normKey(typeKey)] || 'mcq';
}

const SENTENCE_SUBTYPE_MAP = {
    wordsentences: 'word_sentence', wordsentence: 'word_sentence',
    fillintheblank: 'fill_blank', fillblanks: 'fill_blank',
    punctuation: 'punctuation',
    midliner: 'mid_liner',
};
export function sentenceSubtype(typeKey) {
    return SENTENCE_SUBTYPE_MAP[normKey(typeKey)] || 'generic';
}

// Parse a value that may be a JSON string (optionally wrapped in ``` fences)
function tryParseJson(value) {
    if (typeof value !== 'string') return value;
    const cleaned = value.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    if (!cleaned || !/^[\[{]/.test(cleaned)) return value;
    try { return JSON.parse(cleaned); } catch { return value; }
}

// Find the object that holds `questions`, wherever it is nested
/* Depth-first search for the first non-empty value under any of `keys`
   (responses wrap ids differently: top level, data, result, …). */
function findDeep(o, keys, depth = 0) {
    o = tryParseJson(o);
    if (!o || typeof o !== 'object' || depth > 5) return null;
    for (const k of keys) {
        const v = o[k];
        if (v !== undefined && v !== null && v !== '' && typeof v !== 'object') return v;
    }
    for (const v of Object.values(o)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const hit = findDeep(v, keys, depth + 1);
            if (hit != null) return hit;
        }
    }
    return null;
}
function lessonIdOf(o) {
    return findDeep(o, ['lesson_plan_id', 'lessonPlanId', 'lesson_id', 'lessonId']);
}
function documentIdOf(o) {
    return findDeep(o, ['document_id', 'documentId']);
}

function findQuestionsNode(o, depth = 0) {
    o = tryParseJson(o);
    if (!o || typeof o !== 'object' || depth > 6) return null;
    if (o.questions && (typeof o.questions === 'object' || typeof o.questions === 'string')) {
        return { ...o, questions: tryParseJson(o.questions) };
    }
    for (const v of Object.values(o)) {
        const parsed = tryParseJson(v);
        if (parsed && typeof parsed === 'object') {
            const hit = findQuestionsNode(parsed, depth + 1);
            if (hit) return hit;
        }
    }
    return null;
}

function normalizeRow(q, index) {
    if (typeof q === 'string') q = { question: q };
    q = q || {};
    // Options can arrive as: an array, an object {option_1: '..'}, or flat keys
    // on the question itself (option_1, option_2, ... / a, b, c, d).
    const OPT_KEY = /^(option|choice|opt)[\s_-]?(\d+|[a-d])$/i;
    let optionMap = null; // { key: text } so we can resolve answers like "option_2"
    const rawOptions = tryParseJson(q.options || q.choices || null);
    if (Array.isArray(rawOptions)) {
        optionMap = {};
        rawOptions.forEach((o, i) => {
            const text = (o && typeof o === 'object') ? (o.text || o.option || o.value || '') : o;
            optionMap[`option_${i + 1}`] = text;
        });
    } else if (rawOptions && typeof rawOptions === 'object') {
        optionMap = { ...rawOptions };
    } else {
        const flat = Object.keys(q).filter(k => OPT_KEY.test(k)).sort();
        if (flat.length) {
            optionMap = {};
            flat.forEach(k => { optionMap[k] = q[k]; });
        }
    }
    const options = optionMap ? Object.values(optionMap) : [];

let answer =
    q.answer ??
    q.correct_answer ??
    q.correct_option ??
    q.answer_text ??
    q.blank ??
    
    q.correctAnswer ??
    '';
        if (Array.isArray(answer)) answer = answer.join(', ');
    // Resolve "option_2" / "2" / "B" to the actual option text
    if (optionMap && typeof answer === 'string' && answer.trim()) {
        const keys = Object.keys(optionMap);
        const a = answer.trim();
        let hitKey = keys.find(k => k.toLowerCase() === a.toLowerCase());
        if (!hitKey && /^\d+$/.test(a)) hitKey = keys[Number(a) - 1];
        if (!hitKey && /^[a-d]$/i.test(a)) hitKey = keys[a.toLowerCase().charCodeAt(0) - 97];
        if (hitKey != null && optionMap[hitKey] != null) {
            const letter = String.fromCharCode(65 + keys.indexOf(hitKey));
            answer = `${letter}. ${optionMap[hitKey]}`;
        }
    }
    return {
        no: index + 1,
question:
    q.question ||
    q.question_text ||
    q.text ||
    q.item ||
    q.sentence ||
    q.sentences ||
    
    
    '',        answer,
        options,
        word: q.word || q.words || '',
        sentence: q.sentence || q.sentences || '',
        opposite: q.opposite || q.antonym || '',
        synonym: q.synonym || q.synonyms || '',
        singular: q.singular || '',
        plural: q.plural || '',
        columnA: q.columnA || q.column_a || q.left || '',
        columnB: q.columnB || q.column_b || q.right || '',
        title: q.title || q.topic || '',
        body: q.body || q.paragraph || q.content || q.story || q.essay || '',
        moral: q.moral || '',
        conclusion: q.conclusion || '',
        subject: q.subject || '',
        statement: q.statement || q.comprehensionStatement || q.comprehension_statement
                   || q.passage || q.comprehension_passage || '',
    };
}

function parseNotebookLessonPlanResponse(data, ctx = {}) {
    const body = tryParseJson(data);

    const raw = findQuestionsNode(body) || (body && typeof body === 'object' ? body : {});
    const documentId = documentIdOf(body) ?? ctx.documentId ?? null;
    // The edit endpoint requires lesson_plan_id. It sits at the top of the
    // generate response (same as classwork), not inside the questions node,
    // so it was being dropped here — "lesson_plan_id is required".
    const lessonId = lessonIdOf(body) ?? lessonIdOf(raw) ?? ctx.lessonId ?? null;

    const declaredTypes = raw?.question_field_types || raw?.questionFieldTypes || raw?.question_field_type || [];
    const declared = Array.isArray(declaredTypes) ? declaredTypes : [declaredTypes].filter(Boolean);

    // Normalise `questions` into { typeKey: [items] }
    const groupsRaw = {};
    const q = raw?.questions;
    console.log(
    "FULL FILL BLANK DATA:",
    JSON.stringify(
        raw?.questions?.fill_in_the_blank?.[0],
        null,
        2
    )
);
    if (Array.isArray(q)) {
        q.forEach(item => {
            const k = item?.question_field_type || item?.type || declared[0] || 'questions';
            (groupsRaw[k] ||= []).push(item);
        });
    } else if (q && typeof q === 'object') {
        Object.entries(q).forEach(([k, v]) => {
            v = tryParseJson(v);
            if (Array.isArray(v)) {
                groupsRaw[k] = v;
            } else if (v && typeof v === 'object') {
                const inner = Object.values(v).find(Array.isArray);
                groupsRaw[k] = inner || [v]; // story/essay arrive as a single object
            } else if (typeof v === 'string' && v.trim()) {
                groupsRaw[k] = [{ body: v }];
            }
        });
    }

    const questionTypes = Object.keys(groupsRaw);
    const questionGroups = {};
    const allRows = [];
    questionTypes.forEach(k => {
        questionGroups[k] = groupsRaw[k].map((item, i) => {
            const row = normalizeRow(item, i);
            allRows.push(row);
            return row;
        });
    });

    if (!allRows.length) {
        console.error('Notebook parse found NO questions. Raw response:', data);
    }

    const template = mapTypeToTemplate(questionTypes[0] || declared[0] || '');
    const typeName =
        raw?.main_question ||
        questionTypes.map(t => t.replace(/_/g, ' ')).join(', ') ||
        'Notebook Work';

    return {
        raw,
        documentId,
        lessonId,
        cls: raw?.grade || ctx.cls || '',
        subject: raw?.subject || ctx.subject || '',
        unit: raw?.unit_name || ctx.unit || '',
        unitNumber: raw?.unit_number || ctx.unitNumber || 1,
        mainQuestion: raw?.main_question || ctx.mainQuestion || '',
        typeName,
        template,
        questionTypes,
        questionGroups,
        rows: allRows,
        instruction: raw?.main_question || typeName,
        version: raw?.version || 1,
        left: allRows.map(r => r.columnA || r.word || r.singular || ''),
        right: allRows.map(r => r.columnB || r.opposite || r.synonym || r.plural || ''),
        title: allRows[0]?.title || raw?.title || '',
        body: allRows[0]?.body || raw?.body || '',
    };
}


// ── Notebook edit change summary ──
function summarizeNotebookChanges(before, after) {
    const changes = [];
    const bRows = before?.rows?.length || 0;
    const aRows = after?.rows?.length || 0;
    if (aRows !== bRows) {
        changes.push(`Question count changed from ${bRows} to ${aRows}`);
    }
    if (before?.mainQuestion !== after?.mainQuestion) {
        changes.push('Main question updated');
    }
    if (JSON.stringify(before?.rows) !== JSON.stringify(after?.rows)) {
        changes.push('Question content updated');
    }
    if (!changes.length) {
        changes.push('Notebook refreshed based on your request');
    }
    return changes;
}
