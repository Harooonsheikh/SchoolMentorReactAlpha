/* ═══════════════════════════════════════════════════════════════════
   EXAMINATION — chain (head office) ki examination setup, Chain
   Management API par. UI wahi redesigned Examination page
   (pages/Examination) — ye file sirf us ki shakal (terms / exams /
   result grading) me data lati aur save karti hai.

   Controller (POST sab CRUD, GET reads). Base: {CHAIN_API_BASE}/api/Examination
     POST   /termscrud              { id, branchID, networkID, term,
                                      sessionYearID, action, startDate, endDate }
     POST   /addexamcrud            mdlAddExam
     POST   /gradinguploadercrud    mdlExaminationResultGradingUploader
     POST   /overallgradingcrud     mdlExaminationResultOverAllGradingSetup
     GET    /gettermsbynetworkid    ?networkID&branchID&term&pageNo&pageCount
     GET    /getexams, /getexamsbyclass, /getexamsfordropdown …
     DELETE /deleteexamdata         ?networkID&id

   Live test (2026-10-13) se maaloom hua:
     • action sirf: insert | update | delete | get.
     • Model me startDate/endDate (aur exam me TermID/ClassID/ExamName…)
       `[Required]` hain — "get"/"delete" ke liye bhi bhejna parta hai,
       warna 400 validation error. Is liye get/delete me placeholder
       date chali jati hai.
     • branchID / sessionYearID network level par 0 (activityCalendarApi
       jaisa) — head office kisi ek school ka nahi.
     • ABHI backend ki stored procedures deploy NAHI hui
       (usp_Net_AddTerms_Crud / _GetPaged, usp_Net_Grades_GetWithSections
       "Could not find stored procedure" deti hain). Is liye caller ko
       localStorage fallback rakhna chahiye (HR payroll jaisa): API fail
       ho to UI local par chalti rahe, SP deploy hote hi sync ho jaye.
     • Response wrapper { success, message, data } maana gaya hai (baqi
       chain APIs jaisa) — SP aane par tasdeeq kar lena.
   Auth header nahi lagta (hrApi / academicsSetupApi jaisa).
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { currentNetworkId } from './networkSchoolsApi'

export { currentNetworkId }

const BASE = `${CHAIN_API_BASE}/api/Examination`

/* Head office = network level — in dono ki jagah 0 jata hai. */
export const NETWORK_BRANCH_ID = 0
export const NETWORK_SESSION_YEAR_ID = 0

/* Response wrapper: { success, message, data }. success:false 200 ke saath
   bhi aa sakta hai, is liye dono check. */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Accept: '*/*', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || `Request failed (${res.status})`)
  }
  return json
}

const rows = (json) => (Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [])
const pick = (o, ...keys) => { for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v } return undefined }
const dateOnly = (v) => String(v || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ''
/* Date-only ("YYYY-MM-DD") → UTC-midnight ISO (timezone-safe). Required
   fields ke liye khaali par aaj ki date (placeholder) bhej dete hain. */
const toIso = (v) => {
  const d = dateOnly(v)
  if (d) return `${d}T00:00:00.000Z`
  return new Date().toISOString()
}

/* ════════════════════════════ TERMS ════════════════════════════ */

/* UI term shape: { id, name, start, end }. API row se wahi banata hai —
   casing/field naam pakka nahi, is liye pick() kai variants par girta hai. */
export function mapTerm(r = {}) {
  return {
    id: Number(pick(r, 'id', 'ID', 'termID', 'TermID')) || 0,
    name: String(pick(r, 'term', 'Term', 'termName', 'TermName') || '').trim(),
    start: dateOnly(pick(r, 'startDate', 'StartDate', 'startAt', 'StartAt', 'start')),
    end: dateOnly(pick(r, 'endDate', 'EndDate', 'endAt', 'EndAt', 'end')),
    sessionYearID: pick(r, 'sessionYearID', 'SessionYearID'),
  }
}

/* UI term → termscrud body. */
const termBody = (action, t = {}, networkId) => ({
  id: Number(t.id) || 0,
  branchID: NETWORK_BRANCH_ID,
  networkID: Number(networkId) || 0,
  term: String(t.name ?? t.term ?? '').trim(),
  sessionYearID: String(t.sessionYearID ?? NETWORK_SESSION_YEAR_ID),
  action,
  startDate: toIso(t.start),   // required — khaali par placeholder
  endDate: toIso(t.end),       // required — khaali par placeholder
})

/** Poore network ke terms. */
export async function fetchTerms(networkId = currentNetworkId()) {
  const json = await call('/termscrud', { method: 'POST', body: termBody('get', {}, networkId) })
  return rows(json).map(mapTerm).filter((t) => t.id)
}

/** Term add (id 0) / update (id > 0). Response se naya id wapas. */
export async function saveTerm(term, networkId = currentNetworkId()) {
  const action = Number(term.id) > 0 ? 'update' : 'insert'
  const json = await call('/termscrud', { method: 'POST', body: termBody(action, term, networkId) })
  const d = json?.data ?? json
  const id = Array.isArray(d) ? Number(d[0]?.id ?? d[0]?.ID) : Number(d?.id ?? d?.ID ?? d)
  return { id: id || Number(term.id) || 0, raw: json }
}

/** Term delete. */
export async function deleteTerm(id, networkId = currentNetworkId()) {
  return call('/termscrud', { method: 'POST', body: termBody('delete', { id }, networkId) })
}

/* Save response se naya id (data: 12 | {id} | [{id}] | bare []). */
const idOf = (json) => {
  const d = json?.data ?? json
  if (Array.isArray(d)) return Number(d[0]?.id ?? d[0]?.ID) || 0
  if (d && typeof d === 'object') return Number(d.id ?? d.ID) || 0
  return Number(d) || 0
}

/* ════════════════════════════ EXAMS ════════════════════════════
   API row EK class (+ section) ki hoti hai; chain UI ka exam multi-class
   hai (sections nahi). Is liye: ek UI exam → har class ki ek row.
     • Read  : addexamcrud `get` (network ki saari rows) → examName+dates par
               group kar ke { name, from, to, termId, classIds[], serverIds }.
     • Write : har classId ki insert/update; hataye gaye class ki row delete.
     • Model me TermID/ClassID/ExamName/TermName/GradeName/SectionID `[Required]`
       (khaali "" bhi 400) — chain me section/grade nahi, is liye placeholder
       ('0' / '-') jata hai.
   Live (2026-10-13): getexams/addexamcrud-get kaam karte hain (SP deployed). */

/* get action ke liye required fields ka placeholder body. */
const examGetBody = (networkId) => ({
  id: 0, classID: '0', branchID: NETWORK_BRANCH_ID, networkID: Number(networkId) || 0,
  sectionID: '0', termID: '0', sectionName: '-', selectExam: '-',
  dateFrom: toIso(), dateTo: toIso(), termName: '-', examName: '-',
  gradeName: '-', action: 'get', createdOn: new Date().toISOString(),
})

const examBody = (action, ex, classId, networkId, term) => ({
  id: Number(ex.serverIds?.[classId]) || 0,
  classID: String(classId),                 // asli grade id (e.g. 8189065)
  branchID: NETWORK_BRANCH_ID,
  networkID: Number(networkId) || 0,
  sectionID: '0',                            // network level par sections nahi
  termID: String(ex.termId ?? term?.id ?? 0),
  sectionName: '-',
  /* selectExam = examID (ERP jaisa): naya exam insert par '0' (backend id
     deta hai), update par us exam ki id. Ye exam ka NAAM nahi — naam examName
     me jata hai. Pehle galti se yahan ex.name ja raha tha. */
  selectExam: String(Number(ex.examId) || 0),
  dateFrom: toIso(ex.from),
  dateTo: toIso(ex.to),
  termName: String(term?.name || '').trim() || '-',
  examName: String(ex.name || '').trim() || '-',
  gradeName: '-',
  action,
  createdOn: new Date().toISOString(),
})

export function mapExamRow(r = {}) {
  return {
    rowId: Number(pick(r, 'id', 'ID', 'examID', 'ExamID')) || 0,
    /* selectExam read par asal examID hota hai (sab classes me common) —
       deleteexambyclass isi ko examID ke taur par maangti hai. examName se
       alag: examName = "1st Term Exam", selectExam = 2938. */
    examId: Number(pick(r, 'selectExam', 'SelectExam')) || 0,
    name: String(pick(r, 'examName', 'ExamName', 'name') || '').trim(),
    classId: String(pick(r, 'classID', 'ClassID', 'classId') ?? ''),
    termId: String(pick(r, 'termID', 'TermID') ?? ''),
    from: dateOnly(pick(r, 'dateFrom', 'DateFrom', 'startDate', 'StartDate')),
    to: dateOnly(pick(r, 'dateTo', 'DateTo', 'endDate', 'EndDate')),
  }
}

/** Poore network ke exams → UI shape [{ name, from, to, termId, classIds[], serverIds }]. */
export async function fetchExams(networkId = currentNetworkId()) {
  const json = await call('/addexamcrud', { method: 'POST', body: examGetBody(networkId) })
  const map = new Map()
  for (const raw of rows(json)) {
    const r = mapExamRow(raw)
    if (!r.name) continue
    const key = `${r.termId}__${r.name}__${r.from}__${r.to}`
    if (!map.has(key)) map.set(key, { examId: r.examId, name: r.name, from: r.from, to: r.to, termId: r.termId, classIds: [], serverIds: {} })
    const ex = map.get(key)
    if (!ex.examId && r.examId) ex.examId = r.examId
    if (r.classId && !ex.classIds.includes(r.classId)) { ex.classIds.push(r.classId); ex.serverIds[r.classId] = r.rowId }
  }
  return [...map.values()]
}

export async function deleteExamRow(id, networkId = currentNetworkId()) {
  return call(`/deleteexamdata?networkID=${Number(networkId) || 0}&id=${Number(id) || 0}`, { method: 'DELETE' })
}

/* Ek class ko exam se hatana (swagger: deleteexambyclass). Ye tab chalti hai
   jab edit/update modal me se koi class remove ki jaye — Update par us class ki
   row server se is API se hatti hai. examID = exam ka selectExam (read response
   wala id), classID = us row ki server class id; branchID/sectionID 0. */
export async function deleteExamByClass(examId, classId, networkId = currentNetworkId()) {
  const q = `networkID=${Number(networkId) || 0}&examID=${Number(examId) || 0}&classID=${Number(classId) || 0}&branchID=${NETWORK_BRANCH_ID}&sectionID=0`
  return call(`/deleteexambyclass?${q}`, { method: 'DELETE' })
}

/** Exam save — ERP jaisa: (1) pehle hataye gaye classes ko deleteexambyclass se
    hatao, (2) phir baqi/nayi classes insert/update karo.
    `ex`: { examId, name, from, to, termId, classIds[], serverIds }, `term`: { id, name }.
    Har step apne try/catch me — ek fail ho to baqi phir bhi chalein; kitne fail
    hue + aakhri error wapas, taake caller user ko dikha sake.
    Return: { serverIds, failed, lastErr }. */
export async function saveExam(ex, term, networkId = currentNetworkId()) {
  const serverIds = { ...(ex.serverIds || {}) }
  const classIds = (ex.classIds || []).map(String)
  let failed = 0
  let lastErr = ''

  /* 1) Hataai gayi classes (jo serverIds me thi par ab select me nahi) →
        deleteexambyclass (examID = selectExam, classID = us class ki id).
        Agar koi class remove nahi hui to ye loop kuch nahi karta — sirf
        addexamcrud update chalega (examName/date waghera). */
  for (const [classId, rowId] of Object.entries(ex.serverIds || {})) {
    if (!classIds.includes(String(classId)) && Number(rowId) > 0) {
      try { await deleteExamByClass(ex.examId, classId, networkId); delete serverIds[classId] }
      catch (e) { failed += 1; lastErr = e?.message || 'class delete failed' }
    }
  }

  /* 2) Baqi/nayi classes insert/update (addexamcrud). */
  for (const classId of classIds) {
    const action = Number(serverIds[classId]) > 0 ? 'update' : 'insert'
    try {
      const json = await call('/addexamcrud', { method: 'POST', body: examBody(action, { ...ex, serverIds }, classId, networkId, term) })
      const newId = idOf(json)
      if (newId) serverIds[classId] = newId
    } catch (e) { failed += 1; lastErr = e?.message || 'exam save failed' }
  }

  return { serverIds, failed, lastErr }
}

/** Pura exam delete — deleteexamdata?networkID&id, jahan id = examID
    (selectExam). Ek hi call us exam ki saari classes hata deti hai (row PK
    nahi — examID jata hai). networkID aur id dono required (0 par API 400).
    Sirf-local exam (examId 0) ho aur server rows hon to row PK se fallback. */
export async function deleteExam(ex, networkId = currentNetworkId()) {
  if (!Number(networkId)) throw new Error('No network selected — cannot delete on server')
  const examId = Number(ex.examId) || 0
  if (examId) {
    await deleteExamRow(examId, networkId) // id = selectExam → pura exam
    return { deleted: 1 }
  }
  /* examId na mila (reload se pehle bana exam) → har class row apne PK se */
  const rowIds = Object.values(ex.serverIds || {}).filter((r) => Number(r) > 0)
  let failed = 0
  let lastErr = ''
  for (const rowId of rowIds) {
    try { await deleteExamRow(rowId, networkId) }
    catch (e) { failed += 1; lastErr = e?.message || 'delete failed' }
  }
  if (failed > 0) throw new Error(`${failed} of ${rowIds.length} class row(s) failed to delete: ${lastErr}`)
  return { deleted: rowIds.length }
}

/* ══════════════════ RESULT — SIGNATURES (gradinguploadercrud) ══════════════════
   UI sig: { id, name, desig, img(base64) } ↔ API { name, designation, signature }.
   NOTE: letter-grade bands (A+/B…) ki koi API nahi — wo local hi rehti hain. */

export function mapSignature(r = {}) {
  return {
    serverId: Number(pick(r, 'id', 'ID')) || 0,
    name: String(pick(r, 'name', 'Name') || ''),
    desig: String(pick(r, 'designation', 'Designation') || ''),
    img: String(pick(r, 'signature', 'Signature') || ''),
  }
}

const sigBody = (action, s = {}, networkId) => ({
  id: Number(s.serverId) || 0,
  branchID: String(NETWORK_BRANCH_ID),
  networkID: Number(networkId) || 0,
  name: String(s.name || '').trim() || '-',
  designation: String(s.desig || '').trim() || '-',
  signature: String(s.img || '') || '-',
  action,
})

export async function fetchSignatures(networkId = currentNetworkId()) {
  const json = await call('/gradinguploadercrud', { method: 'POST', body: sigBody('get', {}, networkId) })
  return rows(json).map(mapSignature)
}

export async function saveSignature(s, networkId = currentNetworkId()) {
  const action = Number(s.serverId) > 0 ? 'update' : 'insert'
  const json = await call('/gradinguploadercrud', { method: 'POST', body: sigBody(action, s, networkId) })
  return { serverId: idOf(json) || Number(s.serverId) || 0 }
}

export async function deleteSignature(serverId, networkId = currentNetworkId()) {
  return call('/gradinguploadercrud', { method: 'POST', body: sigBody('delete', { serverId }, networkId) })
}

/* ══════════════════ RESULT — FINAL REMARKS (overallgradingcrud) ══════════════════
   UI remark: { id, cond, pct, text } ↔ API { percentage, finalRemarks }.
   `cond` (≥ / > …) API me nahi — wo local rehta hai; read par default 'gte'. */

export function mapRemark(r = {}) {
  return {
    serverId: Number(pick(r, 'id', 'ID')) || 0,
    pct: String(pick(r, 'percentage', 'Percentage') ?? ''),
    text: String(pick(r, 'finalRemarks', 'FinalRemarks') || ''),
    cond: 'gte',
  }
}

const remBody = (action, m = {}, networkId) => ({
  id: Number(m.serverId) || 0,
  branchID: String(NETWORK_BRANCH_ID),
  networkID: Number(networkId) || 0,
  percentage: String(m.pct ?? '') || '0',
  finalRemarks: String(m.text || '').trim() || '-',
  action,
})

export async function fetchRemarks(networkId = currentNetworkId()) {
  const json = await call('/overallgradingcrud', { method: 'POST', body: remBody('get', {}, networkId) })
  return rows(json).map(mapRemark)
}

export async function saveRemark(m, networkId = currentNetworkId()) {
  const action = Number(m.serverId) > 0 ? 'update' : 'insert'
  const json = await call('/overallgradingcrud', { method: 'POST', body: remBody(action, m, networkId) })
  return { serverId: idOf(json) || Number(m.serverId) || 0 }
}

export async function deleteRemark(serverId, networkId = currentNetworkId()) {
  return call('/overallgradingcrud', { method: 'POST', body: remBody('delete', { serverId }, networkId) })
}

/* ══════════════════ TERM BREAKUP ══════════════════════════════════
   Academics (ERP LessonPlans) jaisa, magar Chain Management API par
   network level (branchID/sectionID nahi — networkID + sessionID 0):

     GET  /gettermbreakups?networkID&classID&subjectID&termID&sessionID&pageNo&pageCount
          → data[0].id = termBreakupID (ek class+subject+term ka master)
     POST /lptermbreakupcrud        mdlNetLPTermBreakups
          { id, networkID, termID, subjectID, classID, sessionID, action }
     POST /lptermbreakupdetailscrud mdlNetLPTermBreakupsDetails
          { id, networkID, termBreakupID, unitNumber, unitName,
            weekRequired, subTopic, periodRequired, type, action }

   Ek detail row = ek (unit + sub-topic). Chain UI unit shape:
     { unitNum, unitName, weeks, topics:[{ topic, periods, detailId? }] }.
   Flow: master id gettermbreakups se; na mile to lptermbreakupcrud insert;
   phir details crud get/insert/delete. SP deploy na ho (ya class/subject
   id server par na ho) to caller local store par chalta rahe — baqi
   examination module jaisa local-first fallback. */

/* gettermbreakups → master id (0 if none). */
export async function fetchTermBreakupId({ classId, subjectId, termId }, networkId = currentNetworkId()) {
  const params = new URLSearchParams({
    networkID: String(Number(networkId) || 0),
    classID: String(Number(classId) || 0),
    subjectID: String(Number(subjectId) || 0),
    termID: String(Number(termId) || 0),
    sessionID: String(NETWORK_SESSION_YEAR_ID),
    pageNo: '1',
    pageCount: '1',
  })
  const json = await call(`/gettermbreakups?${params.toString()}`)
  const list = rows(json)
  return Number(pick(list[0] || {}, 'id', 'ID', 'termBreakupID', 'TermBreakupID')) || 0
}

/* Saare term breakup masters is network ke — release index (releaseContent)
   ke liye. classID/subjectID/termID 0 bhej kar sab maangte hain; har master me
   classID + subjectID hoti hai (release child2 ki gradeID/subjectID isi se).
   SP list na de (ya khali) to khali array — release bina term breakup ke chalta
   rahe. */
export async function fetchAllNetworkTermBreakups(networkId = currentNetworkId()) {
  const nid = Number(networkId) || 0
  if (!nid) return []
  const params = new URLSearchParams({
    networkID: String(nid), classID: '0', subjectID: '0', termID: '0',
    sessionID: String(NETWORK_SESSION_YEAR_ID), pageNo: '1', pageCount: '1000',
  })
  let json
  try { json = await call(`/gettermbreakups?${params.toString()}`) }
  catch { return [] }
  return rows(json)
    .map((r) => ({
      id: Number(pick(r, 'id', 'ID', 'termBreakupID', 'TermBreakupID')) || 0,
      classID: Number(pick(r, 'classID', 'ClassID', 'gradeID', 'GradeID')) || 0,
      subjectID: Number(pick(r, 'subjectID', 'SubjectID')) || 0,
      termID: Number(pick(r, 'termID', 'TermID')) || 0,
    }))
    .filter((x) => x.id > 0)
}

/* Detail rows → UI units. Rows ko unitNumber+unitName+weekRequired par group. */
function mapBreakupDetails(list) {
  const map = new Map()
  const order = []
  for (const r of list) {
    const unitNum = String(pick(r, 'unitNumber', 'UnitNumber') ?? '')
    const unitName = String(pick(r, 'unitName', 'UnitName') ?? '')
    const weeks = String(pick(r, 'weekRequired', 'WeekRequired') ?? '')
    const subTopic = pick(r, 'subTopic', 'SubTopic')
    const periods = pick(r, 'periodRequired', 'PeriodRequired')
    const detailId = Number(pick(r, 'id', 'ID')) || 0
    const key = `${unitNum}__${unitName}__${weeks}`
    if (!map.has(key)) { map.set(key, { unitNum, unitName, weeks, topics: [] }); order.push(key) }
    if ((subTopic != null && subTopic !== '') || (periods != null && periods !== '')) {
      map.get(key).topics.push({ topic: String(subTopic || ''), periods: String(periods ?? '0'), detailId })
    }
  }
  return order.map((k) => map.get(k))
}

/* Ek class+term+subject ke units API se → { id, units }. id 0 → koi breakup nahi. */
export async function fetchTermBreakupUnits({ classId, subjectId, termId }, networkId = currentNetworkId()) {
  const id = await fetchTermBreakupId({ classId, subjectId, termId }, networkId)
  if (!id) return { id: 0, units: [] }
  const json = await call('/lptermbreakupdetailscrud', {
    method: 'POST',
    body: { id, networkID: Number(networkId) || 0, termBreakupID: id, unitNumber: '', unitName: '', weekRequired: '', subTopic: '', periodRequired: '', type: '', action: 'get' },
  })
  return { id, units: mapBreakupDetails(rows(json)) }
}

/* Master id yaqeeni banao — na ho to lptermbreakupcrud insert. */
export async function ensureTermBreakupId({ classId, subjectId, termId }, networkId = currentNetworkId()) {
  const existing = await fetchTermBreakupId({ classId, subjectId, termId }, networkId)
  if (existing) return existing
  const json = await call('/lptermbreakupcrud', {
    method: 'POST',
    body: { id: 0, networkID: Number(networkId) || 0, termID: Number(termId) || 0, subjectID: Number(subjectId) || 0, classID: Number(classId) || 0, sessionID: NETWORK_SESSION_YEAR_ID, action: 'insert' },
  })
  const id = idOf(json)
  if (!id) throw new Error('Could not create term breakup')
  return id
}

/* Ek detail row ka body (insert/update/delete). */
function detailBody(action, termBreakupID, unit = {}, topic = {}, networkId) {
  return {
    id: Number(topic.detailId) || 0,
    networkID: Number(networkId) || 0,
    termBreakupID: Number(termBreakupID) || 0,
    unitNumber: String(unit.unitNum ?? ''),
    unitName: String(unit.unitName || '').trim(),
    weekRequired: String(unit.weeks ?? '0'),
    subTopic: String(topic.topic || '').trim(),
    periodRequired: String(topic.periods ?? '0'),
    type: '',
    action,
  }
}

/* Ek class+term+subject ka pura breakup save: master ensure → purani rows
   delete → nayi insert (re-save par duplicate na banein). Return { termBreakupID }.
   units: [{ unitNum, unitName, weeks, topics:[{ topic, periods }] }]. */
export async function saveTermBreakup({ classId, subjectId, termId, units = [] }, networkId = currentNetworkId()) {
  const termBreakupID = await ensureTermBreakupId({ classId, subjectId, termId }, networkId)
  /* purani detail rows le kar delete */
  let existing = []
  try {
    const json = await call('/lptermbreakupdetailscrud', {
      method: 'POST',
      body: { id: termBreakupID, networkID: Number(networkId) || 0, termBreakupID, unitNumber: '', unitName: '', weekRequired: '', subTopic: '', periodRequired: '', type: '', action: 'get' },
    })
    existing = rows(json)
  } catch { /* get fail → delete skip, insert phir bhi try */ }
  for (const r of existing) {
    const detailId = Number(pick(r, 'id', 'ID')) || 0
    if (detailId) { try { await call('/lptermbreakupdetailscrud', { method: 'POST', body: detailBody('delete', termBreakupID, {}, { detailId }, networkId) }) } catch { /* ignore */ } }
  }
  /* nayi rows insert — ek topic = ek row */
  for (const u of units) {
    for (const t of (u.topics || [])) {
      if (!String(t.topic || '').trim()) continue
      await call('/lptermbreakupdetailscrud', { method: 'POST', body: detailBody('insert', termBreakupID, u, t, networkId) })
    }
  }
  return { termBreakupID }
}

/* Ek ya ziada detail rows server se delete (lptermbreakupdetailscrud action:'delete')
   — subtopic / unit delete icon ke liye. detailIds = un rows ke server ids (jo
   gettermbreakups se load hue the). Master id khud gettermbreakups se nikaal leta hai. */
export async function deleteTermBreakupDetails({ classId, subjectId, termId, detailIds = [] }, networkId = currentNetworkId()) {
  const ids = (detailIds || []).map(Number).filter((n) => n > 0)
  if (!ids.length) return { deleted: 0 }
  const termBreakupID = await fetchTermBreakupId({ classId, subjectId, termId }, networkId)
  if (!termBreakupID) return { deleted: 0 }
  let deleted = 0
  for (const detailId of ids) {
    await call('/lptermbreakupdetailscrud', { method: 'POST', body: detailBody('delete', termBreakupID, {}, { detailId }, networkId) })
    deleted += 1
  }
  return { deleted }
}

/* Update Weeks (pencil) — dedicated endpoint lpupdateweekrequired.
   Model: { networkID, unitName, weekRequired } (ERP jaisa, magar networkID).
   NOTE: ye API sirf networkID + unitName par chalti hai — is network me ek hi
   naam ki do units hon to dono ke weeks badal jayenge (backend ka faisla). */
export async function updateTermBreakupWeeks({ unit }, networkId = currentNetworkId()) {
  const unitName = String(unit?.unitName || '').trim()
  if (!unitName) throw new Error('Unit Name is required')
  return call('/lpupdateweekrequired', {
    method: 'POST',
    body: { networkID: Number(networkId) || 0, unitName, weekRequired: String(unit.weeks ?? '0') },
  })
}
