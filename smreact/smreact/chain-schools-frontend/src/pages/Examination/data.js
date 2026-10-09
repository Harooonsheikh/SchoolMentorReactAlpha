/* ═══════════════════════════════════════════════════════════════════
   EXAMINATION — Head Office data model + lifecycle.

   Vocabulary mirrors the School Mentor ERP (src/constants/exam.js and
   src/components/Examination.jsx): exam terms, grade list, grade
   condition map, and the { name, classes, from, to, term } exam shape.

   Lifecycle (per record):
     draft ──markReady──▶ ready ──publish──▶ published
                                      │
                                      └──archive (drafts/ready only)──▶ archived

   Versioning: every content edit bumps `version`. Publishing stores a
   frozen `publishedSnapshot` and sets `publishedVersion`. Edits to a
   published record never change what schools receive until it is
   published again (`version !== publishedVersion` ⇒ unpublished changes).

   Storage: localStorage for now, like every Chain module. Nothing here
   reaches a school by itself — the school package is built on demand
   and handed over through the existing "Copy ERP Payload" step.
   ═══════════════════════════════════════════════════════════════════ */

import { loadAcademics } from '../../config/academicsStore'
import { getDefaultSubPermissions } from '../SchoolPermissions/data'
import { DEFAULT_GRADE_CONTENT, DEFAULT_PRESCHOOL_CONTENT } from './defaults'

const KEY = 'csp_examination'
const HISTORY_CAP = 50

export const EXAM_TERMS = ['2nd', '3rd Term', '5th Term', 'testing', 'combined']

export const EXAM_STATUS = {
  DRAFT: 'draft',
  READY: 'ready',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
}

export const STATUS_META = {
  draft: { label: 'Draft', cls: 'b-gray', icon: 'fa-pen' },
  ready: { label: 'Ready to publish', cls: 'b-blue', icon: 'fa-flag-checkered' },
  published: { label: 'Published', cls: 'b-green', icon: 'fa-bullhorn' },
  archived: { label: 'Archived', cls: 'b-gray', icon: 'fa-box-archive' },
}

/* Result policy types. Mirrors the ERP Result Setup toggle: Grade 1–12
   and Preschool / Montessori are separate systems, so a school can hold
   one live policy of each type. */
export const POLICY_TYPES = [
  { key: 'grade', label: 'Grade 1–12', icon: 'fa-graduation-cap', desc: 'Marks-based grade table, remarks and the absent-subject rule.' },
  { key: 'preschool', label: 'Preschool / Montessori', icon: 'fa-shapes', desc: 'Learning areas, E/M/A/NY grading scale, SLO statements per level, PSD fields and card options.' },
]

export const policyTypeMeta = (type) => POLICY_TYPES.find((t) => t.key === type) || POLICY_TYPES[0]

/* Fresh, independent copy of a type's default content. */
export const newPolicyContent = (type) => JSON.parse(JSON.stringify(
  type === 'preschool' ? DEFAULT_PRESCHOOL_CONTENT : DEFAULT_GRADE_CONTENT,
))

/* Grade vocabulary — same values as the ERP Result Setup. */
export const RS_GRADE_LIST = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'E', 'F']
export const RS_COND_OPTIONS = [
  { key: 'gte', label: '≥ (at least)' },
  { key: 'gt', label: '> (more than)' },
  { key: 'lte', label: '≤ (at most)' },
  { key: 'lt', label: '< (less than)' },
  { key: 'eq', label: '= (exactly)' },
]
export const RS_COND_MAP = { gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=', between: '~' }
export const ABSENT_MODES = [
  { key: 'exclude', label: 'Exclude absent subjects from result' },
  { key: 'zero', label: 'Count absent subjects as zero' },
]

/* ── Store ── */

const EMPTY_STORE = { exams: [], policies: [] }

/* Policies saved before the Grade / Preschool split were grade-only and
   kept their fields at the top level. Move them into `type` + `content`,
   including any live snapshot, so nothing already saved is lost. */
const migratePolicy = (p) => {
  if (p.content && p.type) return p
  const legacy = { grades: p.grades || [], absentMode: p.absentMode || 'exclude', remarks: DEFAULT_GRADE_CONTENT.remarks }
  const snap = p.publishedSnapshot
  return {
    ...p,
    type: 'grade',
    content: legacy,
    publishedSnapshot: snap && !snap.type
      ? { name: snap.name, session: snap.session, type: 'grade', content: legacy, version: snap.version, schoolIds: snap.schoolIds }
      : snap,
  }
}

export function loadExamStore() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    return {
      exams: Array.isArray(d?.exams) ? d.exams : [],
      policies: Array.isArray(d?.policies) ? d.policies.map(migratePolicy) : [],
    }
  } catch {
    return { ...EMPTY_STORE }
  }
}

export function saveExamStore(store) {
  localStorage.setItem(KEY, JSON.stringify(store))
}

/* ── Chain context (single source: Academics + connected schools) ── */

export const currentSession = () => loadAcademics().sessionSettings?.academicYear || ''
export const chainClasses = () => loadAcademics().classes || []

/* Connected schools come from ViewProvider (Chain-Management API).
   Examination.jsx writes them here before any child reads the list.
   Inactive branches stay visible in the scope note but are never a
   publish target. */
let connectedSchools = []

export function setConnectedSchools(schools) {
  connectedSchools = (schools || []).map((s) => ({
    id: s.id,
    name: s.name || `Branch #${s.id}`,
    schoolCode: s.code || s.schoolCode || String(s.id ?? ''),
    isActive: s.isActive !== false && s.branchIsActive !== false,
  }))
}

export const publishableSchools = () => connectedSchools.filter((s) => s.isActive)
export const inactiveSchoolCount = () => connectedSchools.filter((s) => !s.isActive).length

/* Every exam and result policy applies to ALL publishable schools in the
   chain. The school list is resolved at publish time, so the snapshot
   records exactly which schools received that version. */
export const allSchoolIds = () => publishableSchools().map((x) => x.id)
export const SCOPE_LABEL = 'All schools'

/* ── Dates: ISO in the Chain portal, DD/MM/YYYY in the ERP ── */

export function toErpDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function examStatusByDate(exam, today = new Date().toISOString().slice(0, 10)) {
  if (!exam.from || !exam.to) return 'upcoming'
  if (today < exam.from) return 'upcoming'
  if (today > exam.to) return 'completed'
  return 'ongoing'
}

/* ── Record helpers ── */

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

const nowIso = () => new Date().toISOString()

const CONTENT_FIELDS = {
  exam: ['name', 'term', 'session', 'from', 'to', 'classIds'],
  policy: ['name', 'session', 'type', 'content'],
}

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function withHistory(record, entry) {
  const history = [...(record.history || []), entry].slice(-HISTORY_CAP)
  return { ...record, history }
}

const listKey = (kind) => (kind === 'exam' ? 'exams' : 'policies')

function replaceIn(store, kind, record) {
  return { ...store, [listKey(kind)]: store[listKey(kind)].map((r) => (r.id === record.id ? record : r)) }
}

export function findRecord(store, kind, id) {
  return store[listKey(kind)].find((r) => r.id === id) || null
}

/* True when a published record has edits that schools have not received. */
export const hasUnpublishedChanges = (r) => r.status === 'published' && r.version !== r.publishedVersion

/* ── Presentation helpers shared by the tables and the detail view ── */

export function actionsFor(r) {
  switch (r.status) {
    case EXAM_STATUS.DRAFT: return ['edit', 'ready', 'archive']
    case EXAM_STATUS.READY: return ['edit', 'publish', 'archive']
    case EXAM_STATUS.PUBLISHED: return ['edit', hasUnpublishedChanges(r) ? 'publish' : null].filter(Boolean)
    default: return []
  }
}

export const ACTION_META = {
  edit: { icon: 'fa-pen-to-square', label: 'Edit', cls: '' },
  ready: { icon: 'fa-flag-checkered', label: 'Mark ready to publish', cls: '' },
  publish: { icon: 'fa-bullhorn', label: 'Publish', cls: 'primary' },
  archive: { icon: 'fa-box-archive', label: 'Archive', cls: 'danger' },
}


/* ── Lifecycle actions. Each returns { store, error } — pure, no UI. ── */

export function createRecord(store, kind, fields, actor) {
  const at = nowIso()
  const base = {
    id: newId(),
    ...fields,
    status: EXAM_STATUS.DRAFT,
    version: 1,
    publishedVersion: null,
    publishedSnapshot: null,
    publishedAt: null,
    publishedBy: null,
    createdAt: at,
    createdBy: actor,
    updatedAt: at,
    updatedBy: actor,
  }
  const record = withHistory(base, { at, by: actor, action: 'created' })
  return { store: { ...store, [listKey(kind)]: [...store[listKey(kind)], record] }, record }
}

export function updateRecord(store, kind, id, fields, actor) {
  const current = findRecord(store, kind, id)
  if (!current) return { store, error: 'This item no longer exists.' }

  const next = { ...current, ...fields }
  const changed = CONTENT_FIELDS[kind].some((k) => !sameValue(current[k], next[k]))
  if (!changed) return { store, record: current }

  const at = nowIso()
  const reopened = current.status === EXAM_STATUS.READY ? EXAM_STATUS.DRAFT : next.status
  const updated = withHistory(
    { ...next, status: reopened, version: current.version + 1, updatedAt: at, updatedBy: actor },
    { at, by: actor, action: 'edited', detail: `Revision ${current.version + 1}` },
  )
  return { store: replaceIn(store, kind, updated), record: updated }
}

export function markReady(store, kind, id, actor) {
  const r = findRecord(store, kind, id)
  if (!r) return { store, error: 'This item no longer exists.' }
  if (r.status !== EXAM_STATUS.DRAFT) return { store, error: 'Only drafts can be marked ready.' }
  if (!allSchoolIds().length) return { store, error: 'This chain has no schools to publish to.' }
  const at = nowIso()
  const updated = withHistory({ ...r, status: EXAM_STATUS.READY, updatedAt: at, updatedBy: actor }, { at, by: actor, action: 'marked ready' })
  return { store: replaceIn(store, kind, updated), record: updated }
}

/* Publishing a result policy is blocked when another live policy already
   reaches one of the same schools — a school must never have two. */
export function publish(store, kind, id, actor) {
  const r = findRecord(store, kind, id)
  if (!r) return { store, error: 'This item no longer exists.' }
  if (r.status !== EXAM_STATUS.READY && r.status !== EXAM_STATUS.PUBLISHED) {
    return { store, error: 'Mark the item ready before publishing.' }
  }
  const schoolIds = allSchoolIds()
  if (!schoolIds.length) return { store, error: 'This chain has no schools to publish to.' }

  if (kind === 'policy') {
    const clash = store.policies.find((p) => p.id !== r.id && p.type === r.type && p.status === EXAM_STATUS.PUBLISHED)
    if (clash) {
      return { store, error: `"${clash.name}" (${policyTypeMeta(r.type).label}) is already live for one or more of these schools. Edit that policy and publish the new version instead — a school can only have one live policy of each type.` }
    }
  }

  const at = nowIso()
  const snapshot = kind === 'exam'
    ? {
      name: r.name, term: r.term, session: r.session, from: r.from, to: r.to,
      classes: chainClasses().filter((c) => r.classIds.includes(c.id)).map((c) => c.name),
      version: r.version, schoolIds,
    }
    : {
      name: r.name, session: r.session, type: r.type, content: JSON.parse(JSON.stringify(r.content)),
      version: r.version, schoolIds,
    }

  const updated = withHistory(
    {
      ...r,
      status: EXAM_STATUS.PUBLISHED,
      publishedVersion: r.version,
      publishedSnapshot: snapshot,
      publishedAt: at,
      publishedBy: actor,
      updatedAt: at,
      updatedBy: actor,
    },
    { at, by: actor, action: 'published', detail: `Version ${r.version} to ${schoolIds.length} school${schoolIds.length === 1 ? '' : 's'}` },
  )
  return { store: replaceIn(store, kind, updated), record: updated }
}

export function archive(store, kind, id, actor) {
  const r = findRecord(store, kind, id)
  if (!r) return { store, error: 'This item no longer exists.' }
  if (r.status === EXAM_STATUS.PUBLISHED) return { store, error: 'Live items cannot be archived. Edit and publish a new version instead.' }
  const at = nowIso()
  const updated = withHistory({ ...r, status: EXAM_STATUS.ARCHIVED, updatedAt: at, updatedBy: actor }, { at, by: actor, action: 'archived' })
  return { store: replaceIn(store, kind, updated), record: updated }
}

/* ── School package: what one school's ERP receives ──────────────────
   Only live (published) snapshots that reached this school.
   Exam shape matches the ERP's exam records; dates are converted to the
   ERP's DD/MM/YYYY. Result policy shape matches the ERP's Result Setup
   grade rows (grade / cond / pct / comment).                          */

export function buildSchoolPackage(schoolId, store) {
  const examinations = store.exams
    .filter((e) => e.status === EXAM_STATUS.PUBLISHED && e.publishedSnapshot?.schoolIds.includes(schoolId))
    .map((e) => {
      const s = e.publishedSnapshot
      return {
        id: `hq-${e.id}`,
        name: s.name,
        term: s.term,
        session: s.session,
        classes: s.classes,
        from: toErpDate(s.from),
        to: toErpDate(s.to),
        managedBy: 'head-office',
        version: s.version,
        publishedAt: e.publishedAt,
      }
    })

  /* One live policy per type (grade / preschool), each delivered under its own key. */
  const resultPolicies = { grade: null, preschool: null }
  store.policies
    .filter((p) => p.status === EXAM_STATUS.PUBLISHED && p.publishedSnapshot?.schoolIds.includes(schoolId))
    .forEach((p) => {
      const snap = p.publishedSnapshot
      resultPolicies[snap.type] = {
        id: `hq-${p.id}`,
        name: snap.name,
        session: snap.session,
        type: snap.type,
        ...snap.content,
        managedBy: 'head-office',
        version: snap.version,
        publishedAt: p.publishedAt,
      }
    })

  return { examinations, resultPolicies }
}

/* Full ERP handoff for one school. The School Mentor ERP replaces its
   whole `sm_chain_permissions` store on paste, so module permissions and
   the exam package must travel together — otherwise pasting one would
   wipe the other. `perms` = { modules, modulePermissions }. */
export function buildErpHandoff(school, perms, store) {
  return {
    source: 'chain-school-portal',
    version: 1,
    generatedAt: nowIso(),
    schoolId: school.id,
    schoolName: school.name,
    schoolCode: school.schoolCode,
    modules: { academics: !!perms.modules?.academics, examination: !!perms.modules?.examination },
    modulePermissions: {
      academics: perms.modulePermissions?.academics || getDefaultSubPermissions('academics') || {},
      examination: perms.modulePermissions?.examination || getDefaultSubPermissions('examination') || {},
    },
    ...buildSchoolPackage(school.id, store),
  }
}

/* Sort helper: most recently published first. */
export const byPublishedDesc = (a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))

/* Validation for one content type. Returns an errors map keyed by field. */
export function validateContent(type, content) {
  const e = {}
  if (type === 'grade') {
    if (!content.grades.length) e.grades = 'Add at least one grade.'
    const seen = new Set()
    content.grades.forEach((g, i) => {
      if (!RS_GRADE_LIST.includes(g.grade)) e[`grade-${i}`] = 'Choose a grade.'
      else if (seen.has(g.grade)) e[`grade-${i}`] = `${g.grade} is already in this policy.`
      seen.add(g.grade)
      const n = Number(g.pct)
      if (g.pct === '' || Number.isNaN(n) || n < 0 || n > 100) e[`pct-${i}`] = 'Enter a percentage from 0 to 100.'
    })
    content.remarks.forEach((r, i) => {
      if (!RS_GRADE_LIST.includes(r.grade)) e[`rgrade-${i}`] = 'Choose a grade for this remark.'
      const n = Number(r.pct)
      if (r.pct === '' || Number.isNaN(n) || n < 0 || n > 100) e[`rpct-${i}`] = 'Enter a percentage from 0 to 100.'
      if (!r.text.trim()) e[`rtext-${i}`] = 'Remark text is required.'
    })
  } else {
    if (!content.learningAreas.length) e.learningAreas = 'Add at least one learning area.'
    content.learningAreas.forEach((la, i) => {
      if (!la.name.trim()) e[`la-${i}`] = 'Name is required.'
    })
    const codes = content.gradingScale.map((g) => (g.code || '').trim())
    if (codes.some((c) => !c)) e.gradingScale = 'Every grading level needs a code. Rename the label to generate one.'
    else if (new Set(codes).size !== codes.length) e.gradingScale = 'Two grading levels have the same code. Make each code unique.'
  }
  return e
}

/* Preschool helpers — same rules as the ERP Preschool setup cards. */

/* Achievement code from a label: "Excellent Performance" → "EP". */
export function deriveCodeFromLabel(label) {
  const words = (label || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  return words.map((w) => w[0].toUpperCase()).join('')
}

/* Copy every learning area's statements from one level to another,
   replacing the target level (ERP copyLevelSlo). New ids keep the copies
   independent of the source level. */
export function copySloFromLevel(slo, fromLevel, toLevel) {
  const source = slo[fromLevel] || {}
  const copy = {}
  Object.keys(source).forEach((laId) => {
    copy[laId] = (source[laId] || []).map((st, i) => ({ id: `slo_${toLevel}_${laId}_${i}`, text: st.text }))
  })
  return { ...slo, [toLevel]: copy }
}
