import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchNetworkClasses, fetchClassSubjects } from '@/api/academicsSetupApi'
import {
  fetchNetworkLessonUnits, fetchNetworkNotebookUnits, fetchNotebookQuestions,
  fetchLessonDetail, deleteLessonMasterCascade, saveNotebookMaster, saveQuestionRow,
  currentNetworkId,
} from '@/api/lessonPlansApi'
import LpUnitMgrModal from './LpUnitMgrModal'
import LpLessonEditModal from './LpLessonEditModal'
import LpNbAQModal from './LpNbAQModal'
import LpReportPicker from './LpReportPicker'
import { generateLessonPlanReport } from './lessonPlanReports'
import './CreateLessonPlans.css'

/* ═══════════════════════════════════════════════════════════════════
   CREATE LESSON PLAN — chain (head office) ka apna Lesson Plans +
   Notebook Plans screen. UI aur flow ERP ke Academics ▸ Lesson Plans ▸
   Create Lesson Plans se hu-ba-hu liya gaya hai.

   Farq sirf do hain, aur dono chain ke dhanche ki wajah se hain:
     • SECTION nahi — network level par classes ke sections hote hi
       nahi (dekhein academicsSetupApi), is liye filter me sirf Class
       aur Subject hain aur API me sectionID hamesha 0 jata hai.
     • Data networkID par chalta hai, branchID par nahi — dekhein
       src/api/lessonPlansApi.js.

   Flow (ERP jaisa):
     Class + Subject chuno → Fetch → Lesson Plans / Notebook Plans tab
     → Add Unit (Manage Units) → unit expand → lesson edit / questions add.
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────── Confirm ─────────────────────────── */

function LpConfirm({ cfg, busy, onClose }) {
  if (!cfg) return null
  return createPortal(
    <div className="lp-overlay open" style={{ zIndex: 6000 }} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="lp-modal" style={{ maxWidth: 420 }}>
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-icon" style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)' }}><i className={`fa-solid ${cfg.icon || 'fa-trash'}`} /></div>
            <div>
              <div className="lp-modal-title">{cfg.title}</div>
              {cfg.hint && <div className="lp-modal-sub">{cfg.hint}</div>}
            </div>
          </div>
          <button className="lp-modal-close" title="Close" onClick={onClose} aria-label="Close" disabled={busy}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="lp-modal-body">
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{cfg.message}</div>
        </div>
        <div className="lp-modal-footer">
          <button className="lp-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="lp-btn primary" style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)' }} onClick={cfg.onConfirm} disabled={busy}>
            <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-trash'}`} /> {busy ? 'Working…' : (cfg.confirmLabel || 'Yes, Delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ─────────────────── Empty state (no units yet) ─────────────────── */

function EmptyUnits({ label, onAdd }) {
  return (
    <div className="clp2-empty-state" style={{ background: 'transparent', border: 'none' }}>
      <div className="clp2-empty-icon"><i className="fa-solid fa-layer-group" /></div>
      <div className="clp2-empty-title">No units yet</div>
      <div className="clp2-empty-sub">{label}</div>
      <button className="lp-btn primary" title="Add the first unit" style={{ marginTop: 16 }} onClick={onAdd}>
        <i className="fa-solid fa-plus" /> Add Unit
      </button>
    </div>
  )
}

/* ─────────────────── Lesson-plans unit row (lessons) ─────────────────── */

function UnitRow({ unit, index, onReport, onDeleteUnit, onEditLesson, onDeleteLesson }) {
  const [open, setOpen] = useState(false)
  const manualCount = unit.lessons.filter((l) => l.source === 'manual').length
  const aiCount = unit.lessons.filter((l) => l.source === 'mentorai').length

  return (
    <div className="clpr-unit">
      <div className="clpr-unit-row">
        <div className="clpr-unit-sno">{index + 1}</div>
        <div className="clpr-unit-no">Unit {unit.unitNo}</div>
        <div className="clpr-unit-name">
          {unit.unitName || '(no name)'}
          {unit.medium === 'urdu' && <span className="clp-lang-tag" title="This unit is in Urdu">اردو</span>}
        </div>
        <div className="clpr-unit-stats">
          <span className="clpr-stat clpr-stat--total" title="Total lesson plans in this unit">
            <i className="fa-solid fa-book" /> {unit.lessons.length} lesson{unit.lessons.length !== 1 ? 's' : ''}
          </span>
          <span className="clpr-stat-sep">·</span>
          <span className="clpr-stat clpr-stat--manual" title="Lessons added manually">
            <i className="fa-solid fa-pen-to-square" /> {manualCount} manual
          </span>
          <span className="clpr-stat-sep">·</span>
          <span className="clpr-stat clpr-stat--ai" title="Lessons generated by Mentor AI">
            <i className="fa-solid fa-robot" /> {aiCount} AI
          </span>
        </div>
        <div className="clpr-unit-actions">
          <button className="export-btn pdf" title="Download unit lesson plan as PDF" onClick={() => onReport('pdf')}>
            <i className="fa-solid fa-file-pdf" /> PDF
          </button>
          <button className="export-btn word" title="Download unit lesson plan as Word" onClick={() => onReport('word')}>
            <i className="fa-brands fa-microsoft" /> Word
          </button>
          <button className="lp-icon-del" title="Delete unit" onClick={onDeleteUnit} aria-label="Delete unit">
            <i className="fa-solid fa-trash" />
          </button>
          <button
            className={`expand-btn${open ? ' open' : ''}`} title={open ? 'Collapse unit' : 'Expand unit'}
            onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse unit' : 'Expand unit'}
          >
            <i className="fa-solid fa-chevron-down" />
          </button>
        </div>
      </div>

      {open && (
        <div className="clpr-lessons-panel">
          {unit.lessons.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, fontStyle: 'italic' }}>
              No lessons in this unit
            </div>
          ) : unit.lessons.map((l, li) => (
            <div key={l.id} className="clpr-lesson-card">
              <div className="clpr-lesson-top">
                <div className="clpr-lesson-meta">
                  <span className="clpr-lesson-num">#{li + 1}</span>
                  <span className="clpr-lesson-num-tag">{l.num}</span>
                  <i className="fa-regular fa-file-lines clpr-lesson-file-icon" />
                  <span className="clpr-lesson-name">
                    {l.topic || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Untitled</span>}
                  </span>
                </div>
                <span className={`clp-src-badge ${l.source === 'mentorai' ? 'ai' : 'manual'}`}>
                  {l.source === 'mentorai'
                    ? <><i className="fa-solid fa-wand-magic-sparkles" /> Mentor AI</>
                    : <><i className="fa-solid fa-pen-nib" /> Manual</>}
                </span>
                <div className="clpr-lesson-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="clpr-action-btn clpr-action-edit" title="Edit this lesson" onClick={() => onEditLesson(l)}>
                    <i className="fa-solid fa-pen" /> <span>Edit</span>
                  </button>
                  <button className="clpr-action-btn clpr-action-pdf" title="Download lesson as PDF" onClick={() => onReport('pdf', l)}>
                    <i className="fa-solid fa-file-pdf" /> <span>PDF</span>
                  </button>
                  <button className="clpr-action-btn clpr-action-del" title="Delete this lesson" onClick={() => onDeleteLesson(l)}>
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────── Notebook unit row (question types) ─────────────────── */

function NbUnitRow({ unit, onReport, onDeleteUnit, onAddType, onEditType, onDeleteType, reloadKey }) {
  const [open, setOpen] = useState(false)
  /* Question types unit khulne se PEHLE hi load ho jate hain taake counts
     row par dikhein; null = abhi load nahi hua. */
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)

  /* Bahar se refresh (question add/edit/delete ke baad) — cache gira do. */
  useEffect(() => { setDetail(null) }, [reloadKey])

  useEffect(() => {
    if (detail !== null || unit.id == null) return undefined
    let cancelled = false
    setLoading(true)
    fetchNotebookQuestions(unit.id)
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch((e) => { console.error('Error loading notebook detail:', e); if (!cancelled) setDetail([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [detail, unit.id])

  const questions = detail ?? unit.questions ?? []
  const total = questions.length
  const manual = questions.filter((q) => q.source === 'manual').length

  return (
    <div className={`clpr-unit-card${open ? ' open' : ''}`}>
      <div className="clpr-unit-header" onClick={() => setOpen((o) => !o)}>
        <div className="clpr-unit-left">
          <div className="clpr-unit-icon-wrap"><i className="fa-solid fa-book-open" /></div>
          <div className="clpr-unit-info">
            <div className="clpr-unit-name">
              {unit.unitName || '(no name)'}
              {unit.medium === 'urdu' && <span className="clp-lang-tag" title="This unit is in Urdu">اردو</span>}
            </div>
            <div className="clpr-unit-sub">Unit {unit.unitNo}</div>
          </div>
        </div>

        <div className="clpr-unit-stats">
          <span className="clpr-stat clpr-stat--total">
            <i className="fa-solid fa-circle-question" /> {total} type{total !== 1 ? 's' : ''}
          </span>
          <span className="clpr-stat-sep">·</span>
          <span className="clpr-stat clpr-stat--manual">
            <i className="fa-solid fa-pen-to-square" /> {manual} manual
          </span>
        </div>

        <div className="clpr-unit-right" onClick={(e) => e.stopPropagation()}>
          <button className="nb-aq-pill" title="Add Questions" onClick={onAddType}>
            <i className="fa-solid fa-plus nb-aq-icon" />
            <span className="nb-aq-label">Add Questions</span>
          </button>
          <button className="clpr-icon-btn clpr-icon-btn--pdf" title="Download PDF" onClick={() => onReport('pdf')} aria-label="Download notebook PDF">
            <i className="fa-solid fa-file-pdf" />
          </button>
          <button className="clpr-icon-btn clpr-icon-btn--del" title="Delete unit" onClick={onDeleteUnit} aria-label="Delete unit">
            <i className="fa-solid fa-trash-can" />
          </button>
          <button
            className={`clpr-icon-btn clpr-icon-btn--expand${open ? ' open' : ''}`} title={open ? 'Collapse unit' : 'Expand unit'}
            onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse unit' : 'Expand unit'}
          >
            <i className="fa-solid fa-chevron-down" />
          </button>
        </div>
      </div>

      {open && (
        <div className="clpr-lessons-panel">
          {loading ? (
            <div className="clpr-no-lessons">
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 18, color: 'var(--brand-primary)' }} />
              <span>Loading question types…</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="clpr-no-lessons">
              <i className="fa-solid fa-circle-question" style={{ fontSize: 20, color: 'var(--brand-primary)', opacity: 0.4 }} />
              <span>No questions yet — click <strong>Add Questions</strong> to begin</span>
            </div>
          ) : questions.map((q, idx) => {
            const rowsCount = (q.rows && q.rows.length) || (q.items && q.items.length) || 0
            return (
              <div key={q.id} className="clpr-lesson-card">
                <div className="clpr-lesson-top">
                  <div className="clpr-lesson-meta" style={{ cursor: 'pointer' }} onClick={() => onEditType(q)} title="Click to view / edit this question type">
                    <span className="clpr-lesson-num">#{idx + 1}</span>
                    <span className="clpr-lesson-num-tag" style={{ background: 'rgba(8,145,178,.12)', color: '#0E7490', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{q.type}</span>
                    <i className="fa-regular fa-file-lines clpr-lesson-file-icon" />
                    <span className="clpr-lesson-name">{q.mainQuestion || q.mainQ || '(No main question)'}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0E7490', background: 'rgba(8,145,178,.08)', border: '1px solid rgba(8,145,178,.2)', padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <i className="fa-solid fa-list" style={{ fontSize: 9 }} /> {rowsCount} item{rowsCount !== 1 ? 's' : ''}
                  </span>
                  <span className="clp-src-badge manual"><i className="fa-solid fa-pen-nib" /> Manual</span>
                  <div className="clpr-lesson-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="clpr-action-btn clpr-action-edit" title="Edit this question type" onClick={() => onEditType(q)}>
                      <i className="fa-solid fa-pen" /> <span>Edit</span>
                    </button>
                    <button className="clpr-icon-btn clpr-icon-btn--pdf" title="Download PDF" onClick={() => onReport('pdf', q)} aria-label="Download question type PDF">
                      <i className="fa-solid fa-file-pdf" />
                    </button>
                    <button className="clpr-icon-btn clpr-icon-btn--del" title="Delete" onClick={() => onDeleteType(q)}>
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════ MAIN SCREEN ═══════════════════════════ */

export default function CreateLessonPlans({ toast }) {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')

  const [fetched, setFetched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [subtab, setSubtab] = useState('lesson') // 'lesson' | 'notebook'

  const [units, setUnits] = useState([])
  const [nbUnits, setNbUnits] = useState([])
  /* Notebook rows apna detail khud load karte hain — modal band hone par ye
     bump hota hai taake wo dobara load karein. */
  const [nbReload, setNbReload] = useState(0)

  const [unitMgrSource, setUnitMgrSource] = useState(null) // 'lesson' | 'notebook' | null
  const [lessonEdit, setLessonEdit] = useState(null)
  const [nbAddCtx, setNbAddCtx] = useState(null)
  const [nbEdit, setNbEdit] = useState(null)
  const [confirmCfg, setConfirmCfg] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  /* Download Report modal — { kind, unit, lesson?, q?, name, format } */
  const [reportCfg, setReportCfg] = useState(null)
  const [reportBusy, setReportBusy] = useState(false)

  const className = classes.find((c) => String(c.id) === String(classId))?.name || ''
  const subjectName = subjects.find((s) => String(s.id) === String(subjectId))?.name || ''
  const ctx = { classID: classId ? String(classId) : '', subjectID: subjectId ? String(subjectId) : '' }

  /* Network ki classes ek dafa load — Settings ▸ Classes & Subjects wahi list. */
  useEffect(() => {
    let cancelled = false
    fetchNetworkClasses()
      .then((rows) => { if (!cancelled) setClasses(rows) })
      .catch((e) => { console.error('Error loading classes:', e); if (!cancelled) setClasses([]) })
    return () => { cancelled = true }
  }, [])

  const onClassChange = async (e) => {
    const id = e.target.value
    setClassId(id)
    setSubjectId('')
    setSubjects([])
    setFetched(false)
    if (!id) return
    try {
      setSubjects(await fetchClassSubjects(Number(id)))
    } catch (err) {
      console.error('Error loading subjects:', err)
      setSubjects([])
    }
  }

  /* Lesson + Notebook dono masters ek saath. Notebook ki khata lesson list ko
     nahi rokti (aur ulta bhi) — dono alag try me hain. */
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!currentNetworkId()) { if (!silent) toast('No network session — sign in again from the ERP', 'error'); return }
    if (!classId) { if (!silent) toast('Please select a class', 'error'); return }
    if (!subjectId) { if (!silent) toast('Please select a subject', 'error'); return }

    setLoading(true)
    const key = { classID: String(classId), subjectID: String(subjectId) }

    try { setNbUnits(await fetchNetworkNotebookUnits(key)) } catch (e) { console.error('Error fetching notebook units:', e) }

    try {
      setUnits(await fetchNetworkLessonUnits(key))
      setFetched(true)
      setNbReload((n) => n + 1)
      if (!silent) toast(`Loaded plans for ${className} · ${subjectName}`, 'success')
    } catch (e) {
      console.error('Error fetching lesson plans:', e)
      if (!silent) toast(e.message || 'Could not load lesson plans', 'error')
    } finally {
      setLoading(false)
    }
  }, [classId, subjectId, className, subjectName, toast])

  const reload = () => { if (fetched) load({ silent: true }) }

  /* ─────────────────────────── Delete ─────────────────────────── */

  const runConfirm = (fn) => async () => {
    setConfirmBusy(true)
    try {
      await fn()
      setConfirmCfg(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  const removeUnit = (u) => setConfirmCfg({
    title: 'Delete Unit?',
    message: `Unit "${u.unitName || u.unitNo}" and all its ${u.lessons?.length || u.questions?.length || 0} item(s) will be permanently removed.`,
    hint: 'This cannot be undone.',
    confirmLabel: 'Yes, Delete',
    onConfirm: runConfirm(async () => {
      if (subtab === 'lesson') {
        /* Unit ki har master row (topic) delete — child detail pehle. */
        const recs = (u.lessons || []).map((l) => l.record).filter((r) => r && r.id != null)
        try {
          await Promise.all(recs.map((r) => deleteLessonMasterCascade(r, ctx)))
        } catch (e) {
          console.error('Error deleting unit topics:', e)
          toast(e.serverMessage || e.message || 'Could not delete unit', 'error')
          return
        }
        setUnits((us) => us.filter((x) => x.id !== u.id))
      } else {
        const recId = u.record?.id ?? u.id
        try {
          await saveNotebookMaster({ ...ctx, id: recId, unitNo: '', unitName: '', lessonPlanTopic: '', medium: u.medium, action: 'delete' })
        } catch (e) {
          console.error('Error deleting notebook unit:', e)
          toast(e.serverMessage || 'Could not delete unit', 'error')
          return
        }
        setNbUnits((us) => us.filter((x) => x.id !== u.id))
      }
      toast('Unit deleted', 'success')
    }),
  })

  const removeLesson = (unitId, lesson) => setConfirmCfg({
    title: 'Delete Lesson?',
    message: `Lesson "${lesson.topic || `Lesson ${lesson.num}`}" will be permanently removed.`,
    hint: 'This cannot be undone.',
    confirmLabel: 'Yes, Delete',
    onConfirm: runConfirm(async () => {
      if (lesson.record?.id) {
        try {
          await deleteLessonMasterCascade(lesson.record, ctx)
        } catch (e) {
          console.error('Error deleting lesson topic:', e)
          toast(e.serverMessage || e.message || 'Could not delete lesson', 'error')
          return
        }
      }
      setUnits((us) => us.map((u) => (u.id !== unitId ? u : { ...u, lessons: u.lessons.filter((l) => l.id !== lesson.id) })))
      toast('Lesson deleted', 'success')
    }),
  })

  const removeQuestionType = (unitId, q) => setConfirmCfg({
    title: 'Delete Question Type?',
    message: `Question type "${q.type}" (${(q.rows || q.items || []).length} items) will be permanently removed.`,
    hint: 'This cannot be undone.',
    confirmLabel: 'Yes, Delete',
    onConfirm: runConfirm(async () => {
      /* Is group ki har saved row apne type ke CRUD se delete hoti hai. */
      const ids = (q.rows || q.items || []).map((r) => r.recordId).filter(Boolean)
      if (ids.length) {
        try {
          await Promise.all(ids.map((id) => saveQuestionRow({
            typeId: q.typeId, row: { recordId: id }, index: 0, action: 'delete',
            notebookID: unitId, mainQuestion: q.mainQuestion || q.mainQ || '', statement: q.statement,
          })))
        } catch (e) {
          console.error('Error deleting question type:', e)
          toast(e.serverMessage || 'Could not delete question type', 'error')
          return
        }
      }
      setNbReload((n) => n + 1)
      toast('Question type deleted', 'success')
    }),
  })

  /* ─────────────────────────── Reports ─────────────────────────── */

  /* Har PDF/Word button pehle picker kholta hai (style + format), phir
     lessonPlanReports.js report banata hai — chain ke A4 shell me. */
  /* Lesson side: `lesson` diya to us ek lesson ka, warna poore unit ka. */
  const lessonReportFor = (u) => (format, lesson) => setReportCfg(lesson
    ? { kind: 'lesson', unit: u, lesson, format, name: `Lesson ${lesson.num} — ${lesson.topic || 'Untitled'} · Unit ${u.unitNo}` }
    : { kind: 'unit', unit: u, format, name: `Unit ${u.unitNo} — ${u.unitName || '(no name)'}` })

  /* Notebook side: `q` diya to us ek question type ka, warna poore unit ka. */
  const nbReportFor = (u) => (format, q) => setReportCfg(q
    ? { kind: 'nb-type', unit: u, q, format, name: `${q.type} — Unit ${u.unitNo}` }
    : { kind: 'nb-unit', unit: u, format, name: `Unit ${u.unitNo} — Notebook` })

  const runReport = async (style, fmt) => {
    setReportBusy(true)
    try {
      await generateLessonPlanReport(reportCfg, style, fmt, { className, subjectName, ctx, toast })
      setReportCfg(null)
    } catch (e) {
      console.error('Error generating report:', e)
      toast(e.message || 'Could not generate the report', 'error')
    } finally {
      setReportBusy(false)
    }
  }

  /* ─────────────────── Lesson edit (detail pre-load) ─────────────────── */

  const openLessonEditor = async (unit, lesson) => {
    let detail = null
    const masterId = lesson?.record?.id
    if (masterId && ctx.classID && ctx.subjectID) {
      try { detail = await fetchLessonDetail(masterId, ctx) } catch (e) { console.error('Error loading lesson detail:', e) }
    }
    setLessonEdit({ unitId: unit.id, lessonId: lesson.id, lesson, unit, className, subjectName, ...ctx, detail })
  }

  /* ─────────────────────────── Render ─────────────────────────── */

  return (
    <>
      {/* Hero filter card */}
      <div className="clp2-hero-card">
        <div className="clp2-hero-inner">
          <div className="clp2-hero-text">
            <div className="clp2-hero-title">
              <i className="fa-solid fa-book-open-reader clp2-hero-icon" />
              Create Lesson Plan
            </div>
            <div className="clp2-hero-sub">Select class and subject to manage units &amp; lessons for your chain</div>
          </div>

          <div className="clp2-filter-row">
            <div className="clp2-field">
              <div className="sub-field">
                <label className="sub-field-label"><i className="fa-solid fa-school" /> Class</label>
                <div className="sub-select-wrap">
                  <select className="sub-select" value={classId} onChange={onClassChange}>
                    <option value="">Select Class</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down sub-select-arrow" />
                </div>
              </div>
            </div>

            <div className="sub-field">
              <label className="sub-field-label"><i className="fa-solid fa-book" /> Subject</label>
              <div className="sub-select-wrap">
                <select
                  className="sub-select" value={subjectId} disabled={!classId}
                  onChange={(e) => { setSubjectId(e.target.value); setFetched(false) }}
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down sub-select-arrow" />
              </div>
            </div>

            <button className="clp2-fetch-btn" title="Load lesson plans for the selected class and subject" onClick={() => load()} disabled={loading}>
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} />
              <span>{loading ? 'Loading…' : 'Fetch'}</span>
            </button>
          </div>
        </div>
      </div>

      {fetched ? (
        <>
          {/* Toolbar — subtabs + Add Unit */}
          <div className="clp2-toolbar">
            <div className="clp2-subtabs">
              <button className={`clp2-subtab${subtab === 'lesson' ? ' active' : ''}`} title="Switch to Lesson Plans" onClick={() => setSubtab('lesson')}>
                <i className="fa-solid fa-list-ul" /> Lesson Plans
              </button>
              <button className={`clp2-subtab${subtab === 'notebook' ? ' active' : ''}`} title="Switch to Notebook Plans" onClick={() => setSubtab('notebook')}>
                <i className="fa-solid fa-book" /> Notebook Plans
              </button>
            </div>
            <button className="clp2-add-btn" title="Manage units (add, rename, reorder)" onClick={() => setUnitMgrSource(subtab)}>
              <i className="fa-solid fa-plus" /><span>Add Unit</span>
            </button>
          </div>

          <div className="clp2-table-card">
            {subtab === 'lesson' ? (
              units.length === 0 ? (
                <EmptyUnits label="Click 'Add Unit' to create your first unit" onAdd={() => setUnitMgrSource('lesson')} />
              ) : units.map((u, i) => (
                <UnitRow
                  key={u.id}
                  unit={u}
                  index={i}
                  onReport={lessonReportFor(u)}
                  onDeleteUnit={() => removeUnit(u)}
                  onEditLesson={(l) => openLessonEditor(u, l)}
                  onDeleteLesson={(l) => removeLesson(u.id, l)}
                />
              ))
            ) : (
              nbUnits.length === 0 ? (
                <EmptyUnits label="Click 'Add Unit' to create your first notebook unit" onAdd={() => setUnitMgrSource('notebook')} />
              ) : nbUnits.map((u) => (
                <NbUnitRow
                  key={u.id}
                  unit={u}
                  onReport={nbReportFor(u)}
                  onDeleteUnit={() => removeUnit(u)}
                  onAddType={() => setNbAddCtx({ unitId: u.id })}
                  onEditType={(q) => setNbEdit({ unitId: u.id, qId: q.id, existing: q })}
                  onDeleteType={(q) => removeQuestionType(u.id, q)}
                  reloadKey={nbReload}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <div className="clp2-empty-state">
          <div className="clp2-empty-icon"><i className="fa-solid fa-book-open-reader" /></div>
          <div className="clp2-empty-title">No lesson plans loaded</div>
          <div className="clp2-empty-sub">Select a class and subject above, then click <strong>Fetch</strong></div>
        </div>
      )}

      {/* ─── modals ─── */}
      <LpUnitMgrModal
        open={unitMgrSource !== null}
        source={unitMgrSource}
        units={unitMgrSource === 'lesson' ? units : nbUnits}
        ctx={ctx}
        confirm={setConfirmCfg}
        toast={toast}
        onSave={() => { setUnitMgrSource(null); reload(); toast('Units saved', 'success') }}
        onClose={() => { setUnitMgrSource(null); reload() }}
      />

      {lessonEdit && (
        <LpLessonEditModal
          ctx={lessonEdit}
          toast={toast}
          onSave={() => { setLessonEdit(null); reload(); toast('Lesson plan saved', 'success') }}
          onClose={() => { setLessonEdit(null); reload() }}
        />
      )}

      {nbAddCtx && (
        <LpNbAQModal
          ctx={nbAddCtx}
          unit={nbUnits.find((u) => u.id === nbAddCtx.unitId)}
          toast={toast}
          onSave={() => { setNbAddCtx(null); setNbReload((n) => n + 1); toast('Questions saved', 'success') }}
          onClose={() => setNbAddCtx(null)}
        />
      )}

      {nbEdit && (
        <LpNbAQModal
          ctx={nbEdit}
          unit={nbUnits.find((u) => u.id === nbEdit.unitId)}
          toast={toast}
          onSave={() => { setNbEdit(null); setNbReload((n) => n + 1); toast('Questions updated', 'success') }}
          onClose={() => setNbEdit(null)}
        />
      )}

      <LpReportPicker
        cfg={reportCfg}
        busy={reportBusy}
        onClose={() => setReportCfg(null)}
        onGenerate={runReport}
      />

      <LpConfirm cfg={confirmCfg} busy={confirmBusy} onClose={() => setConfirmCfg(null)} />
    </>
  )
}
