/* ═══════════════════════════════════════════════════════════════════
   NETWORK LESSON PLANS + NOTEBOOK PLANS — chain (head office) ke apne
   unit/lesson/notebook plans, sab networkID ki base par.

   Wahi ERP wali ULP tables/API hain (dekhein src/erp/components/
   LessonPlans.js ka "Create Lesson Plans" tab); farq sirf itna hai ke
   school ki rows `branchID` se bandhi hoti hain aur chain ki rows
   `networkID` se. Is liye yahan har call me:

       branchID:  '0'  →  ye row kisi ek school ki nahi
       sectionID: 0    →  network level par sections hote hi nahi
       networkID       →  logged-in network

   ── Master (unit + topic) ──────────────────────────────────────────
     GET  /api/getulpforclassmasterbynetwork?NetworkID
     GET  /api/getulpfornotebookmasterbynetwork?NetworkID
     POST /api/ulpforclassmastercrud            (insert|update|delete)
     POST /api/ulpfornotebookmastercrud         (insert|update|delete)

   Network wale dono GET sirf NetworkID lete hain (branch wale raste
   classID/subjectID bhi lete the) — is liye class/subject ki chhaant
   yahan client par hoti hai.

   ── Lesson plan detail (4 sections + timings) ──────────────────────
     GET  /api/getulpforclassdetailbytermsubjectandclass?MasterClassesID&classID&subjectID&pageNo
     POST /api/ulpforclassdetailcrud            (insert|update|delete)

   Detail row master se MasterClassesID ke zariye bandhi hoti hai, is
   liye us me networkID ki zaroorat nahi.

   ── Notebook questions (18 types) ──────────────────────────────────
     GET  /api/getulpfornotebookdetails?masterNoteBookIDs
     POST /api/ulpn<type>crud                   (insert|update|delete)

   Har question row `notebookID` (notebook master ki id) se bandhi hai,
   is liye in me bhi networkID nahi jata.

   Ye axios client (src/api/client.js) se nahi jata: wo apna base rakhta
   hai aur 401 par logout kar deta hai — bilkul waise hi jaise
   activityCalendarApi aur academicsSetupApi ke calls.
   ═══════════════════════════════════════════════════════════════════ */

import { ERP_API_BASE } from '@/config/env'
import { getToken } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${ERP_API_BASE}/api`

export { currentNetworkId }

/* Network level par ye dono hamesha yehi rehte hain — upar wali sharh dekhein. */
export const NETWORK_BRANCH_ID = '0'
export const NETWORK_SECTION_ID = 0

const authHeaders = (extra = {}) => ({
  Accept: '*/*',
  Authorization: `bearer ${getToken() || ''}`,
  ...extra,
})

/* API hamesha { success, message, data } deti hai — success:false 200 ke
   saath bhi aa sakta hai, is liye dono check hote hain. Server ka message
   `serverMessage` par bhi rakha jata hai taake caller usay toast kar sake. */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? authHeaders({ 'Content-Type': 'application/json' }) : authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    if (res.status === 401) throw new Error('Session expired — sign in again from the ERP.')
    const msg = json?.message || json?.title || 'Request failed'
    const err = new Error(msg)
    err.serverMessage = msg
    throw err
  }
  return json
}

/* Ye endpoints do shakloon me jawab dete hain: branch wale raste `{ success,
   message, data: [...] }` envelope bhejte hain, magar network wale (…bynetwork)
   SEEDHA array bhejte hain. Dono ko handle karo — warna array wale response par
   `json.data` undefined hota hai aur list khaali dikhti hai. */
const rows = (json) => {
  if (Array.isArray(json)) return json
  if (Array.isArray(json?.data)) return json.data
  return []
}
const post = (path, body) => call(path, { method: 'POST', body })

/* Backend `medium` CAPITALIZED chahta hai ("English"/"Urdu") — lowercase par
   500 deta hai. App ke andar hum lowercase rakhte hain (toggle/compare ke liye). */
export const apiMedium = (m) => (String(m || 'english').toLowerCase() === 'urdu' ? 'Urdu' : 'English')
const uiMedium = (m) => (String(m || 'english').toLowerCase() === 'urdu' ? 'urdu' : 'english')

/* Master rows me classID/subjectID string ya number, dono aa sakte hain. */
const same = (a, b) => String(a ?? '') === String(b ?? '')

/* Ek unit ki pehchan unitNo + unitName se banti hai (lesson side par ek unit
   dar-asl kai master rows ka group hai — har lesson ki apni row). */
const unitKey = (r) => `${r.unitNo}__${r.unitName}`

/* ─────────────────────── Lesson Plans — master ─────────────────────── */

/**
 * Is network ke lesson-plan units (unit → uske lessons), ek class+subject ke liye.
 * Network endpoint sirf NetworkID leta hai, is liye class/subject par chhaant
 * yahan hoti hai.
 */
export async function fetchNetworkLessonUnits({ classID, subjectID }, networkId = currentNetworkId()) {
  if (!networkId || !classID || !subjectID) return []
  const json = await call(`/getulpforclassmasterbynetwork?NetworkID=${networkId}`)
  const mine = rows(json).filter((r) => same(r.classID, classID) && same(r.subjectID, subjectID))

  const byUnit = new Map()
  mine.forEach((r) => {
    const key = unitKey(r)
    if (!byUnit.has(key)) {
      byUnit.set(key, { id: key, unitNo: r.unitNo, unitName: r.unitName, medium: uiMedium(r.medium), lessons: [] })
    }
    const unit = byUnit.get(key)
    /* Har master row = ek lesson (ERP jaisa). Manage Units se banaya gaya naya
       unit ek khaali-topic row hoti hai — wo "Untitled" lesson ban kar dikhti
       hai, jise edit kar ke topic diya jata hai. */
    unit.lessons.push({
      id: r.id,
      num: unit.lessons.length + 1,
      topic: r.lessonPlanTopic,
      source: 'manual',
      record: r,
    })
  })
  return Array.from(byUnit.values())
}

const lessonMasterBody = ({ id = 0, classID, subjectID, unitNo, unitName, lessonPlanTopic = '', medium, action }, networkId) => ({
  id: Number(id) || 0,
  branchID: NETWORK_BRANCH_ID,
  networkID: Number(networkId) || 0,
  classID: String(classID ?? ''),
  sectionID: NETWORK_SECTION_ID,
  subjectID: String(subjectID ?? ''),
  unitNo: String(unitNo ?? ''),
  unitName: String(unitName ?? ''),
  lessonPlanTopic: String(lessonPlanTopic ?? ''),
  medium: apiMedium(medium),
  action,
})

/** Ek lesson-master row insert/update/delete. `id` 0 = nayi row. */
export function saveLessonMaster(data, networkId = currentNetworkId()) {
  return post('/ulpforclassmastercrud', lessonMasterBody(data, networkId))
}

/**
 * API 200 de sakti hai magar ASLI natija `data` me chhupa hota hai —
 * `data: 0` ya `data: [{ Success: 0 }]` = fail. Ye helper us ko pakadta hai
 * (ERP me bhi yehi check hai, warna insert "saved" dikhta hai par persist nahi hota).
 */
export function crudFailure(result) {
  /* Envelope ke bagair (seedha array/number) jawab bhi aa sakta hai — dono dekho. */
  const d = (Array.isArray(result) || typeof result === 'number') ? result : result?.data
  const inner = Array.isArray(d) ? d[0] : (d && typeof d === 'object' ? d : null)
  const s = inner ? (inner.Success ?? inner.success) : undefined
  if (s === 0 || s === false || s === '0' || d === 0 || d === '0') {
    return (inner && (inner.Message ?? inner.message)) || result?.message || 'Server could not save the record'
  }
  return null
}

/* ─────────────────── Lesson Plans — detail (sections) ─────────────────── */

/** Ek topic (master row) ka lesson-plan detail. Nahi mila to null. */
export async function fetchLessonDetail(masterId, { classID, subjectID }) {
  if (!masterId) return null
  const json = await call(
    `/getulpforclassdetailbytermsubjectandclass?MasterClassesID=${masterId}&classID=${classID || ''}&subjectID=${subjectID || ''}&pageNo=1`,
  )
  return rows(json)[0] || null
}

/** Lesson-plan detail (4 sections + timings) save. `d.id` 0 = insert. */
export function saveLessonDetail(payload) {
  return post('/ulpforclassdetailcrud', payload)
}

/**
 * Ek lesson master row MEHFOOZ tareeqe se delete: uski child DETAIL row pehle,
 * phir master. Seedha master delete karne par FK REFERENCE error (500) aata hai.
 */
export async function deleteLessonMasterCascade(rec, ctx, networkId = currentNetworkId()) {
  const masterId = rec?.id
  if (masterId == null) return undefined

  let dets = []
  try {
    const json = await call(
      `/getulpforclassdetailbytermsubjectandclass?MasterClassesID=${masterId}&classID=${ctx.classID || ''}&subjectID=${ctx.subjectID || ''}&pageNo=1`,
    )
    dets = rows(json)
  } catch {
    /* Detail fetch fail ho to khaali maan lo — master delete phir bhi try karo. */
  }

  for (const det of dets) {
    if (det?.id == null) continue
    // eslint-disable-next-line no-await-in-loop
    await post('/ulpforclassdetailcrud', {
      ...det,
      masterClassesID: det.masterClassesID ?? masterId,
      classID: det.classID ?? ctx.classID,
      subjectID: det.subjectID ?? ctx.subjectID,
      action: 'delete',
    })
  }

  return saveLessonMaster({
    id: masterId,
    classID: ctx.classID,
    subjectID: ctx.subjectID,
    unitNo: rec?.unitNo ?? '',
    unitName: rec?.unitName ?? '',
    lessonPlanTopic: rec?.lessonPlanTopic ?? '',
    medium: rec?.medium,
    action: 'delete',
  }, networkId)
}

/* ────────────────────── Notebook Plans — master ────────────────────── */

/** Is network ke notebook units (ek unit = ek master row), class+subject ke liye. */
export async function fetchNetworkNotebookUnits({ classID, subjectID }, networkId = currentNetworkId()) {
  if (!networkId || !classID || !subjectID) return []
  const json = await call(`/getulpfornotebookmasterbynetwork?NetworkID=${networkId}`)
  return rows(json)
    .filter((r) => same(r.classID, classID) && same(r.subjectID, subjectID))
    .map((r) => ({
      id: r.id,
      unitNo: r.unitNo,
      unitName: r.unitName,
      lessonPlanTopic: r.lessonPlanTopic || '',
      medium: uiMedium(r.medium),
      questions: [],
      record: r,
    }))
}

/** Ek notebook-master row insert/update/delete. `id` 0 = nayi row. */
export function saveNotebookMaster(data, networkId = currentNetworkId()) {
  return post('/ulpfornotebookmastercrud', lessonMasterBody(data, networkId))
}

/* ───────────────── Notebook Plans — questions (18 types) ───────────────── */

/* Letter / Application: modal me ek hi editor hai, magar backend `subject` aur
   `body` alag maangta hai. Save par pehli line subject ban jati hai, load par
   dono wapas jur kar ek field me aa jate hain — purane records bhi theek khulte hain. */
export function splitLetter(html) {
  const full = String(html || '')
  if (!full.trim()) return { subject: '', body: '' }
  const block = full.match(/^\s*<(p|div|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/i)
  if (block) return { subject: block[2].trim(), body: full.slice(block[0].length).trim() }
  const br = full.split(/<br\s*\/?>/i)
  if (br.length > 1) return { subject: br[0].trim(), body: br.slice(1).join('<br>').trim() }
  return { subject: full.trim(), body: '' }
}

export function mergeLetter(subject, body) {
  const s = String(subject || '').trim()
  const b = String(body || '').trim()
  if (!s) return b
  if (!b) return s
  return /^\s*<(p|div|h[1-6])\b/i.test(s) ? `${s}${b}` : `<p>${s}</p>${b}`
}

/* Per-question-type CRUD endpoints. `body(uiRow, i)` ek modal row ko us type ke
   API fields me badalta hai; common id/branchID/notebookID/mainQuestion/isCheck/
   action wrapper save ke waqt lagta hai. */
export const NB_QTYPE_API = {
  word_opposite:   { endpoint: '/ulpnwordoppositecrud',          body: (r) => ({ word: r.word || '', opposite: r.opposite || '', marks: r.marks || '' }) },
  singular_plural: { endpoint: '/ulpnsingularpluralcrud',        notebookIDString: true, body: (r) => ({ singular: r.singular || '', plural: r.plural || '', marks: r.marks || '' }) },
  word_synonyms:   { endpoint: '/ulpnwordSynonymcrud',           notebookIDString: true, body: (r) => ({ word: r.word || '', synonym: r.synonym || '', marks: r.marks || '' }) },
  word_sentences:  { endpoint: '/ulpnwordsentencecrud',          body: (r) => ({ word: r.word || '', sentences: r.sentence || '', marks: r.marks || '' }) },
  mcqs:            { endpoint: '/ulpnmcqscrud',                  body: (r) => ({ question: r.question || '', option1: r.opt1 || '', option2: r.opt2 || '', option3: r.opt3 || '', option4: r.opt4 || '', correctAnswer: r.correct || '', totalMarks: r.marks || '' }) },
  fill_blanks:     { endpoint: '/ulpnfilltheblankcrud',          body: (r) => ({ question: r.question || '', answer: r.answer || '', correctAnswer: r.answer || '', marks: r.marks || '' }) },
  true_false:      { endpoint: '/ulpntruefalsecrud',             body: (r) => ({ question: r.question || '', answer: r.answer || '', correctAnswer: r.answer || '', marks: r.marks || '' }) },
  match_columns:   { endpoint: '/ulpnmatchcolumncrud',           body: (r, i) => ({ columnA: r.colA || '', columnB: r.colB || '', correctAnswer: '', srNo: String(i + 1), marks: r.marks || '' }) },
  short_questions: { endpoint: '/ulpnquestionanswercrud',        body: (r) => ({ question: r.question || '', answer: r.answer || '', correctAnswer: r.answer || '', marks: r.marks || '' }) },
  circle_words:    { endpoint: '/ulpncirclecorrectwordcrud',     body: (r) => ({ question: r.statement || '', answer: r.answer || '' }) },
  punctuation:     { endpoint: '/ulpnpunctuationcrud',           body: (r) => ({ punctuation: r.question || '', answer: r.answer || '' }) },
  long_question:   { endpoint: '/ulpnLongQuestioncrud',          notebookIDString: true, body: (r) => ({ question: r.question || '', answer: r.answer || '', marks: r.marks || '' }) },
  paragraph:       { endpoint: '/ulpnparagraphcrud',             body: (r) => ({ topic: r.title || '', paragraph: r.body || '', marks: r.marks || '' }) },
  comprehension:   { endpoint: '/ulpncomprehensionquestioncrud', body: (r) => ({ question: r.question || '', answer: r.answer || '', correctAnswer: r.answer || '', marks: r.marks || '' }) },
  letter:          { endpoint: '/ulpnlettercrud',                body: (r) => ({ ...splitLetter(r.body), regards: r.regards || '', marks: r.marks || '' }) },
  application:     { endpoint: '/ulpnapplicationcrud',           body: (r) => ({ ...splitLetter(r.body), regards: r.regards || '', marks: r.marks || '' }) },
  stories:         { endpoint: '/ulpnstoriescrud',               body: (r) => ({ subject: r.title || '', body: r.body || '', moral: r.moral || '', marks: r.marks || '' }) },
  essays:          { endpoint: '/ulpnessaycrud',                 body: (r) => ({ subject: r.title || '', body: r.body || '', conclusion: r.conclusion || '', marks: r.marks || '' }) },
}

/* Notebook detail categories. getulpfornotebookdetails ke har response array ko
   uske UI question-type (AQ_CONFIG id + label) se jodta hai aur har API row ko
   modal wale field shape me normalise karta hai (columnA→colA, option1→opt1…). */
export const NB_DETAIL_CATEGORIES = [
  { key: 'wordOpposite',           typeId: 'word_opposite',   type: 'Word / Opposite',         map: (r) => ({ word: r.word, opposite: r.opposite }) },
  { key: 'singularPlural',         typeId: 'singular_plural', type: 'Singular / Plural',       map: (r) => ({ singular: r.singular, plural: r.plural }) },
  { key: 'wordSynonym',            typeId: 'word_synonyms',   type: 'Word / Synonyms',         map: (r) => ({ word: r.word, synonym: r.synonym }) },
  { key: 'wordSentences',          typeId: 'word_sentences',  type: 'Word Sentences',          map: (r) => ({ word: r.word, sentence: r.sentences }) },
  { key: 'mcQs',                   typeId: 'mcqs',            type: 'MCQs Field',              map: (r) => ({ question: r.question, opt1: r.option1, opt2: r.option2, opt3: r.option3, opt4: r.option4, correct: r.correctAnswers ?? r.correctAnswer }) },
  { key: 'fillTheBlanks',          typeId: 'fill_blanks',     type: 'Fill in the Blanks',      map: (r) => ({ question: r.question, answer: r.answer }) },
  { key: 'trueFalseQuestions',     typeId: 'true_false',      type: 'True / False',            map: (r) => ({ question: r.question, answer: r.answer }) },
  { key: 'matchColumns',           typeId: 'match_columns',   type: 'Match the Columns',       map: (r) => ({ colA: r.columnA, colB: r.columnB }) },
  { key: 'questionAnswers',        typeId: 'short_questions', type: 'Short Questions',         map: (r) => ({ question: r.question, answer: r.answer }) },
  { key: 'longQuestion',           typeId: 'long_question',   type: 'Long Question',           map: (r) => ({ question: r.question, answer: r.answer }) },
  { key: 'comprehensionQuestions', typeId: 'comprehension',   type: 'Comprehension Question',  map: (r) => ({ question: r.question, answer: r.answer, statement: r.comprehensionStatement }) },
  { key: 'punctuation',            typeId: 'punctuation',     type: 'Punctuation',             map: (r) => ({ question: r.punctuation, answer: r.answer }) },
  { key: 'circleCorrectWord',      typeId: 'circle_words',    type: 'Circle the Correct Words', map: (r) => ({ statement: r.question, answer: r.answer }) },
  { key: 'mdlParagraph',           typeId: 'paragraph',       type: 'Paragraph Writing',       map: (r) => ({ title: r.topic, body: r.paragraph }) },
  { key: 'stories',                typeId: 'stories',         type: 'Stories',                 map: (r) => ({ title: r.subject, body: r.body, moral: r.moral }) },
  { key: 'letters',                typeId: 'letter',          type: 'Letter',                  map: (r) => ({ body: mergeLetter(r.subject, r.body) }) },
  { key: 'applications',           typeId: 'application',     type: 'Application',             map: (r) => ({ body: mergeLetter(r.subject, r.body) }) },
  { key: 'essays',                 typeId: 'essays',          type: 'Essays',                  map: (r) => ({ title: r.subject, body: r.body, conclusion: r.conclusion }) },
]

/**
 * Ek notebook unit ka detail → question-type entries. Ek hi main question wali
 * rows ek entry me group hoti hain (comprehension apne statement par bhi), taake
 * list me har distinct main question ki ek qatar bane.
 */
export async function fetchNotebookQuestions(masterId) {
  if (masterId == null) return []
  const res = await fetch(`${BASE}/getulpfornotebookdetails?masterNoteBookIDs=${masterId}`, {
    method: 'GET',
    headers: authHeaders(),
  })
  const json = await res.json().catch(() => null)
  const out = []
  NB_DETAIL_CATEGORIES.forEach((c) => {
    const apiRows = json?.[c.key]
    if (!Array.isArray(apiRows) || apiRows.length === 0) return
    const groups = new Map()
    apiRows.forEach((r) => {
      const mainQuestion = r.mainQuestion || ''
      const statement = c.typeId === 'comprehension' ? (r.comprehensionStatement || '') : ''
      const gkey = `${mainQuestion} ${statement}`
      if (!groups.has(gkey)) groups.set(gkey, { mainQuestion, statement, rows: [] })
      groups.get(gkey).rows.push({ ...c.map(r), recordId: r.id, marks: r.marks ?? r.totalMarks ?? '' })
    })
    let gi = 0
    groups.forEach((g) => {
      out.push({
        id: `${c.key}__${gi}`,
        typeId: c.typeId,
        type: c.type,
        mainQuestion: g.mainQuestion,
        mainQ: g.mainQuestion,
        statement: g.statement,
        rows: g.rows,
        items: g.rows,
        source: 'manual',
      })
      gi += 1
    })
  })
  return out
}

/** Ek question row ka CRUD payload (common wrapper + type-specific fields). */
export function questionPayload({ typeId, row, index = 0, action, notebookID, mainQuestion, statement }) {
  const api = NB_QTYPE_API[typeId]
  if (!api) return null
  const payload = {
    id: action === 'insert' ? 0 : (row?.recordId ?? 0),
    notebookID: api.notebookIDString ? String(notebookID) : notebookID,
    branchID: NETWORK_BRANCH_ID,
    mainQuestion: mainQuestion || '',
    isCheck: true,
    action,
    ...api.body(row || {}, index),
  }
  if (typeId === 'comprehension') payload.comprehensionStatement = statement || ''
  return payload
}

/** Ek question row insert/update/delete. */
export function saveQuestionRow(args) {
  const api = NB_QTYPE_API[args.typeId]
  const payload = questionPayload(args)
  if (!api || !payload) return Promise.reject(new Error('This question type is not supported yet'))
  return post(api.endpoint, payload)
}

/* ───────────── Release ke liye: poore network ke master rows ─────────────
   Upar wale dono fetchers ek class+subject ki screen ke liye hain. Release
   ko poore network ka content chahiye (class/subject ki tafreeq ke baghair),
   aur har row ki ASLI id + classID/subjectID chahiye — manage-release ke
   child2 me typeID/gradeID/subjectID wahi jate hain aur un par foreign key
   lagi hui hai. Is liye yahan wahi network GET bina chhaant ke. */
const masterRow = (r) => ({
  id: Number(r.id) || 0,
  classID: Number(r.classID) || 0,
  subjectID: Number(r.subjectID) || 0,
  unitNo: r.unitNo ?? '',
  unitName: r.unitName ?? '',
  topic: r.lessonPlanTopic || '',
  medium: uiMedium(r.medium),
})

/** Poore network ke classwork (lesson plan) master rows — har row ek lesson. */
export async function fetchAllNetworkLessonMasters(networkId = currentNetworkId()) {
  if (!networkId) return []
  const json = await call(`/getulpforclassmasterbynetwork?NetworkID=${networkId}`)
  return rows(json).map(masterRow).filter((r) => r.id && r.classID && r.subjectID)
}

/** Poore network ke notebook master rows — har row ek notebook plan. */
export async function fetchAllNetworkNotebookMasters(networkId = currentNetworkId()) {
  if (!networkId) return []
  const json = await call(`/getulpfornotebookmasterbynetwork?NetworkID=${networkId}`)
  return rows(json).map(masterRow).filter((r) => r.id && r.classID && r.subjectID)
}
