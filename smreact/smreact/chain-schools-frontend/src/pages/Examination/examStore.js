/* ═══════════════════════════════════════════════════════════════════
   EXAMINATION — redesigned Head Office store.

   Three tabs drive this module, mirroring the School Mentor ERP:
     • Add Term   → academic terms (like Academics' Term Settings)
     • Add Exam   → exams per term (ERP Exam Setup)
     • Add Result → grades / signatures / final remarks (ERP Result Setup)

   Everything is kept in localStorage, like every other Chain module.
   Session + classes are read from the shared Academics store so the
   term/exam UI stays in sync with what Academics defines.
   ═══════════════════════════════════════════════════════════════════ */

import { loadAcademics, subjectsOfClass } from '../../config/academicsStore'

const KEY = 'csp_examination_v2'

/* ── Result Setup vocabulary (same values as the ERP Result Setup) ── */
export const RS_GRADE_LIST = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F']
export const RS_GRADE_COLORS = {
  'A+': '#16A34A', A: '#0284C7', 'B+': '#2563EB', B: '#6366F1',
  'C+': '#7C3AED', C: '#D97706', 'D+': '#EA580C', D: '#EA580C',
  'E+': '#9333EA', E: '#9333EA', F: '#DC2626',
}
export const RS_COND_LIST = [
  { v: 'gte', l: 'Greater than or equal to (≥)' },
  { v: 'gt', l: 'Greater than (>)' },
  { v: 'lte', l: 'Less than or equal to (≤)' },
  { v: 'lt', l: 'Less than (<)' },
  { v: 'eq', l: 'Equal to (=)' },
]
export const RS_COND_MAP = { gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=' }

/* termBreakups[classId][termId][subjectId] = [{ unitNum, unitName, weeks, topics:[{topic, periods}] }] */
const EMPTY = { terms: [], exams: [], result: { grades: [], signatures: [], remarks: [] }, termBreakups: {} }
const clone = (o) => JSON.parse(JSON.stringify(o))

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function loadExam() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    if (!d) return clone(EMPTY)
    return {
      terms: Array.isArray(d.terms) ? d.terms : [],
      exams: Array.isArray(d.exams) ? d.exams : [],
      result: {
        grades: Array.isArray(d.result?.grades) ? d.result.grades : [],
        signatures: Array.isArray(d.result?.signatures) ? d.result.signatures : [],
        remarks: Array.isArray(d.result?.remarks) ? d.result.remarks : [],
      },
      termBreakups: (d.termBreakups && typeof d.termBreakups === 'object') ? d.termBreakups : {},
    }
  } catch {
    return clone(EMPTY)
  }
}

export function saveExam(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* ignore */ }
}

/* ── Chain context from Academics ── */
export const examSession = () => loadAcademics().sessionSettings || {}
export const examClasses = () => loadAcademics().classes || []
/* Subjects assigned to a class (from Academics' classSubjects map). */
export const examSubjectsOfClass = (classId) => subjectsOfClass(loadAcademics(), classId)
/* Units saved for a class/term/subject in the Term Breakup. */
export const unitsOf = (store, classId, termId, subjectId) => store.termBreakups?.[classId]?.[termId]?.[subjectId] || []

/* ── Exam helpers ── */
export function examStatus(ex) {
  const today = new Date().toISOString().slice(0, 10)
  if (!ex.from) return { label: 'Upcoming', cls: 'upcoming', icon: 'fa-clock' }
  if (today < ex.from) return { label: 'Upcoming', cls: 'upcoming', icon: 'fa-clock' }
  if (!ex.to || today <= ex.to) return { label: 'Current', cls: 'current', icon: 'fa-circle-dot' }
  return { label: 'Past', cls: 'past', icon: 'fa-flag-checkered' }
}

export function calcDuration(from, to) {
  if (!from || !to) return '—'
  const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1
  return days > 0 ? `${days} Day${days === 1 ? '' : 's'}` : '—'
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!d) return iso
  return `${d}/${m}/${y}`
}
