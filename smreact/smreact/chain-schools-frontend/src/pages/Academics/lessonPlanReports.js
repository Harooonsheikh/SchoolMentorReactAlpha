/* ═══════════════════════════════════════════════════════════════════
   CREATE LESSON PLAN — REPORTS (Unit / Lesson / Notebook)

   ERP ke Academics ▸ Lesson Plans wale reports ka network version:
     • clpUnitPdfReport   → buildUnitReport      (unit ke sab lessons)
     • ek lesson ka PDF   → buildUnitReport      (sirf wo lesson)
     • nbGeneratePdfHtml  → buildNotebookReport  (unit ke sab question types)
     • ek question type   → buildNotebookReport  (sirf wo type)

   Content ERP jaisa hi hai (4 rich-text sections + timings; har question
   layout ka apna markup). Farq sirf shell ka hai: ERP school ka
   /report-header lagata hai, yahan CHAIN ka header/footer lagta hai —
   reportEngine.js wahi A4 shell deta hai jo baqi chain Academics reports
   use karte hain.

   Lesson ka content units list me nahi hota (wo sirf topic rakhti hai) —
   is liye har lesson ki detail report banate waqt API se load hoti hai,
   wahi call jo Edit modal karta hai.
   ═══════════════════════════════════════════════════════════════════ */

import { fetchLessonDetail, fetchNotebookQuestions } from '@/api/lessonPlansApi'
import { AQ_CONFIG, nbTr, onlyNum } from './lessonPlanConfig'
import { esc, exportReport } from './reportEngine'

const URDU_FONT = "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Alvi Nastaleeq',serif"

const isUrduUnit = (unit) => String(unit?.medium || '').toLowerCase() === 'urdu'

/* Urdu unit ka poora block RTL + Nastaliq me jata hai (ERP jaisa). */
const wrapDir = (html, isUrdu) => (isUrdu
  ? `<div dir="rtl" style="direction:rtl;text-align:right;font-family:${URDU_FONT}">${html}</div>`
  : html)

/* ─────────────────────── Lesson plan (unit / lesson) ─────────────────────── */

const LESSON_SECTIONS = [
  { key: 'slo', icon: '🎯', title: 'Student Learning Objective', bar: '#7C3AED', bg: '#F5F3FF' },
  { key: 'intro', icon: '📖', title: 'Lesson Introduction', bar: '#1E40AF', bg: '#EFF6FF' },
  { key: 'devel', icon: '🔬', title: 'Development / Main Teaching', bar: '#EA580C', bg: '#FFF7ED' },
  { key: 'recap', icon: '✅', title: 'Recap / Consolidation', bar: '#16A34A', bg: '#F0FDF4' },
]

/**
 * Ek lesson ki detail (4 sections + timings) API se. Units list me sirf topic
 * hota hai, is liye report ke liye har lesson ka detail alag load hota hai.
 */
async function loadLessonContent(lesson, ctx) {
  const masterId = lesson?.record?.id
  if (!masterId || !ctx?.classID || !ctx?.subjectID) return lesson
  try {
    const d = await fetchLessonDetail(masterId, ctx)
    if (!d) return lesson
    return {
      ...lesson,
      topic: d.lessonPlanTopic ?? lesson.topic,
      duration: d.timeDuration || lesson.duration || '',
      contentMap: {
        slo: d.learningObjective || '',
        intro: d.lessonIntroduction || '',
        devel: d.development || '',
        recap: d.recap || '',
      },
      secMins: {
        slo: onlyNum(d.timeForLearning),
        intro: onlyNum(d.timeForLesson),
        devel: onlyNum(d.timeForDevelopment),
        recap: onlyNum(d.timeForRecap),
      },
    }
  } catch (e) {
    console.error('Error loading lesson detail for report:', e)
    return lesson
  }
}

function lessonSectionsHtml(lesson, { isColor, isUrdu }) {
  const T = (s) => nbTr(s, isUrdu)
  return LESSON_SECTIONS.map((sec) => {
    const content = lesson?.contentMap?.[sec.key] || ''
    const mins = onlyNum(lesson?.secMins?.[sec.key]) || '—'
    const bar = isColor ? sec.bar : '#333'
    const bg = isColor ? sec.bg : '#fff'
    const border = isColor ? '#BFDBFE' : '#999'
    return `<div style="margin-bottom:12px;break-inside:avoid">
      <div style="background:${bar};color:#fff;padding:6px 12px;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;font-weight:800">${sec.icon} ${esc(T(sec.title))}</span>
        <span style="font-size:10px;background:rgba(255,255,255,.22);padding:1px 9px;border-radius:20px;font-weight:600">⏱ ${esc(mins)} ${esc(T('mins'))}</span>
      </div>
      <div style="background:${bg};border:1px solid ${border};border-top:none;border-radius:0 0 6px 6px;padding:10px 12px;font-size:11px;line-height:1.7;color:#111">${content || '<span style="color:#999;font-style:italic">—</span>'}</div>
    </div>`
  }).join('')
}

function lessonBlockHtml(lesson, index, unit, opts) {
  const { isColor, isUrdu } = opts
  const T = (s) => nbTr(s, isUrdu)
  const head = isColor ? '#1E3A8A' : '#333'
  const totalMins = LESSON_SECTIONS.reduce((a, s) => a + (parseInt(onlyNum(lesson?.secMins?.[s.key]), 10) || 0), 0)
  return wrapDir(`<div style="break-inside:avoid">
    <div style="background:${head};color:#fff;padding:9px 14px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:11px">
      <div style="width:26px;height:26px;background:rgba(255,255,255,.2);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0">${index + 1}</div>
      <div style="flex:1">
        <div style="font-size:12.5px;font-weight:800">${esc(lesson.topic || '(untitled)')}</div>
        <div style="font-size:10px;opacity:.8;margin-top:1px">${esc(T('Lesson'))} ${esc(lesson.num || index + 1)} · ${esc(T('Unit'))} ${esc(unit.unitNo)}${lesson.duration ? ` · ⏱ ${esc(lesson.duration)} ${esc(T('mins'))}` : ''}</div>
      </div>
      ${totalMins ? `<span style="font-size:10px;background:rgba(255,255,255,.2);padding:2px 10px;border-radius:20px;font-weight:700">Σ ${totalMins} ${esc(T('mins'))}</span>` : ''}
    </div>
    <div style="border:1px solid ${isColor ? '#BFDBFE' : '#999'};border-top:none;border-radius:0 0 8px 8px;padding:12px 12px 2px">
      ${lessonSectionsHtml(lesson, opts)}
    </div>
  </div>`, isUrdu)
}

/**
 * Unit (ya sirf ek lesson) ka lesson-plan report object.
 * `lessons` pehle hi detail ke saath load ho chuki hoti hain.
 */
function buildUnitReport({ unit, lessons, className, subjectName, isColor, title }) {
  const isUrdu = isUrduUnit(unit)
  const opts = { isColor, isUrdu }
  return {
    title: title || `Unit ${unit.unitNo} — ${unit.unitName || '(no name)'}`,
    period: `${className || '—'} · ${subjectName || '—'}`,
    filters: [
      ['Class', className || '—'],
      ['Subject', subjectName || '—'],
      ['Unit', `${unit.unitNo} — ${unit.unitName || '(no name)'}`],
      ['Lessons', String(lessons.length)],
      ['Language', isUrdu ? 'Urdu' : 'English'],
    ],
    sections: lessons.length
      ? lessons.map((l, i) => ({ title: '', html: lessonBlockHtml(l, i, unit, opts) }))
      : [{ title: 'Lesson Plans', html: '<div style="color:#999;font-style:italic">No lessons in this unit.</div>' }],
  }
}

/* ───────────────────────── Notebook (unit / type) ───────────────────────── */

/* Har question layout ka apna markup — ERP ke nbGeneratePdfHtml se. */
function questionRowsHtml(typeId, rows, { isColor, isUrdu }) {
  const T = (s) => nbTr(s, isUrdu)
  const cfg = AQ_CONFIG[typeId] || {}
  const layout = cfg.layout || ''
  const bdr = isColor ? '#BAE6FD' : '#ccc'
  const line = isColor ? '#F0F9FF' : '#eee'
  const accent = isColor ? '#0369A1' : '#333'
  const soft = isColor ? '#F8FAFF' : '#fafafa'
  const optColors = ['#0369A1', '#6D28D9', '#0C4A6E', '#92400E']

  const wordIn = (v) => `<span style="display:inline-block;border:1px solid ${bdr};border-radius:5px;padding:3px 9px;font-size:11px;background:${soft}">${v || ''}</span>`
  const arrow = (ch) => `<span style="color:${isColor ? '#0891B2' : '#666'};font-size:14px;text-align:center">${ch}</span>`
  const grid3 = (a, mid, b) => `<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid ${line}">${a}${arrow(mid)}${b}</div>`
  const numbered = (i, body, ans) => `<div style="display:flex;align-items:stretch;border-bottom:1px solid ${line};min-height:32px">
      <div style="width:32px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${accent};border-right:1px solid ${line};flex-shrink:0;background:${soft}">${i + 1}</div>
      <div style="flex:1;padding:6px 11px;font-size:11px">${body || ''}</div>
      ${ans != null ? `<div style="min-width:150px;padding:6px 11px;font-size:11px;color:${accent};border-left:1px solid ${line};font-weight:600;background:${soft}">${ans}</div>` : ''}
    </div>`

  if (layout === 'two-col') {
    const f = cfg.fields || []
    return rows.map((r) => grid3(wordIn(r[f[0]?.key]), cfg.arrow || '↔', wordIn(r[f[1]?.key]))).join('')
  }
  if (layout === 'word-sentence') {
    return rows.map((r) => `<div style="display:grid;grid-template-columns:110px auto 1fr;align-items:start;gap:9px;padding:6px 12px;border-bottom:1px solid ${line}">${wordIn(r.word)}${arrow('→')}<div style="font-size:11px;line-height:1.6;padding-top:3px">${r.sentence || ''}</div></div>`).join('')
  }
  if (layout === 'mcq') {
    return rows.map((r, i) => `<div style="padding:8px 12px;border-bottom:1px solid ${line}">
      <div style="font-size:11px;font-weight:600;margin-bottom:6px">${i + 1}. ${r.question || ''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">
        ${[['opt1', 'A'], ['opt2', 'B'], ['opt3', 'C'], ['opt4', 'D']].map(([k, l], oi) => `<div style="display:flex;align-items:center;border:1px solid ${bdr};border-radius:6px;overflow:hidden;min-height:26px"><span style="width:26px;align-self:stretch;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;background:${isColor ? optColors[oi] : '#555'};flex-shrink:0">${l}</span><span style="flex:1;padding:0 8px;font-size:10.5px">${r[k] || ''}</span></div>`).join('')}
      </div>
      <div style="padding:5px 10px;background:${isColor ? '#F0FDF4' : '#f0f0f0'};border:1px solid ${isColor ? '#BBF7D0' : '#ccc'};border-radius:6px;font-size:10.5px;font-weight:700;color:${isColor ? '#15803D' : '#333'}">✓ ${esc(T('CORRECT ANSWER'))}: ${r.correct || ''}</div>
    </div>`).join('')
  }
  if (layout === 'fill-blanks') return rows.map((r, i) => numbered(i, r.question, `→ ${r.answer || ''}`)).join('')
  if (layout === 'circle') return rows.map((r, i) => numbered(i, r.statement, `⭕ ${r.answer || ''}`)).join('')
  if (layout === 'true_false') {
    return rows.map((r, i) => {
      const yes = String(r.answer).toLowerCase() === 'true'
      const pill = yes
        ? `background:${isColor ? '#DCFCE7' : '#e0e0e0'};color:${isColor ? '#15803D' : '#333'}`
        : `background:${isColor ? '#FEE2E2' : '#e0e0e0'};color:${isColor ? '#B91C1C' : '#333'}`
      return `<div style="display:flex;align-items:center;gap:11px;padding:6px 12px;border-bottom:1px solid ${line}"><span style="flex:1;font-size:11px">${i + 1}. ${r.question || ''}</span><span style="padding:2px 12px;border-radius:20px;font-size:10.5px;font-weight:800;${pill}">${esc(nbTr(yes ? 'True' : 'False', isUrdu))}</span></div>`
    }).join('')
  }
  if (layout === 'match') {
    return `<div style="margin:7px 12px;padding:6px 10px;background:${isColor ? '#F0F9FF' : '#f0f0f0'};border:1px solid ${bdr};border-radius:6px;font-size:10px;color:#64748B">ℹ️ Shuffle Column B when writing on board.</div>`
      + rows.map((r) => grid3(
        `<span style="display:inline-block;border:1px solid ${isColor ? '#BAE6FD' : '#ccc'};border-radius:5px;padding:4px 9px;font-size:10.5px;background:${isColor ? '#F0F9FF' : '#fafafa'}">${r.colA || ''}</span>`,
        '↔',
        `<span style="display:inline-block;border:1px solid ${isColor ? '#C4B5FD' : '#ccc'};border-radius:5px;padding:4px 9px;font-size:10.5px;background:${isColor ? '#F5F3FF' : '#fafafa'};font-weight:600">${r.colB || ''}</span>`,
      )).join('')
  }
  if (layout === 'punctuation') {
    return rows.map((r, i) => `<div style="padding:8px 12px;border-bottom:1px solid ${line}"><div style="font-size:10.5px;color:#64748B;margin-bottom:3px">${i + 1}. ${r.question || ''}</div><div style="font-size:11px;font-weight:600;color:${accent};border-left:3px solid ${isColor ? '#0891B2' : '#999'};padding-left:7px">${r.answer || ''}</div></div>`).join('')
  }
  if (layout === 'short-q' || layout === 'long' || layout === 'comprehension') {
    return rows.map((r, i) => `<div style="padding:8px 12px;font-size:11px;line-height:1.7;border-bottom:1px solid ${line}"><strong>${i + 1}. ${esc(T('Question'))}:</strong> ${r.question || ''}<br><strong style="color:${accent}">${esc(T('Answer'))}:</strong> ${r.answer || ''}</div>`).join('')
  }
  /* vertical-expand (paragraph / letter / application / stories / essays) */
  const fields = cfg.fields || []
  return rows.map((r) => `<div style="padding:8px 12px;font-size:11px;line-height:1.7;border-bottom:1px solid ${line}">${fields.map((f) => `<div style="margin-bottom:4px"><strong>${esc(T(f.label))}:</strong> ${r[f.key] || ''}</div>`).join('')}</div>`).join('')
}

function questionBlockHtml(q, index, opts) {
  const { isColor, isUrdu } = opts
  const cfg = AQ_CONFIG[q.typeId] || {}
  const bdr = isColor ? '#BAE6FD' : '#ccc'
  const rows = q.rows || q.items || []
  const statement = q.typeId === 'comprehension' && q.statement
    ? `<div style="padding:8px 12px;background:${isColor ? '#F8FAFF' : '#fafafa'};border-bottom:1px solid ${bdr};font-size:11px;line-height:1.7">${q.statement}</div>`
    : ''
  return wrapDir(`<div style="border:1.5px solid ${bdr};border-radius:9px;overflow:hidden;break-inside:avoid">
    <div style="background:${isColor ? '#E0F2FE' : '#f0f0f0'};padding:8px 12px;border-bottom:1.5px solid ${bdr};display:flex;align-items:center;gap:9px">
      <div style="width:22px;height:22px;border-radius:6px;background:${isColor ? '#0369A1' : '#333'};color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${index + 1}</div>
      <span style="font-size:10px;font-weight:700;background:${isColor ? '#F0F9FF' : '#fff'};color:${isColor ? '#0369A1' : '#333'};padding:2px 9px;border-radius:20px;white-space:nowrap">${esc(nbTr(cfg.title || q.type || q.typeId, isUrdu))}</span>
      <span style="flex:1;font-size:11.5px;font-weight:600;color:${isColor ? '#0C4A6E' : '#111'}">${q.mainQuestion || q.mainQ || ''}</span>
      <span style="font-size:10px;color:#64748B;white-space:nowrap">${rows.length} item${rows.length !== 1 ? 's' : ''}</span>
    </div>
    ${statement}
    <div>${questionRowsHtml(q.typeId, rows, opts) || '<div style="padding:10px 12px;color:#999;font-style:italic;font-size:11px">No items.</div>'}</div>
  </div>`, isUrdu)
}

function buildNotebookReport({ unit, questions, className, subjectName, isColor, title }) {
  const isUrdu = isUrduUnit(unit)
  const opts = { isColor, isUrdu }
  return {
    title: title || `Unit ${unit.unitNo} — Notebook`,
    period: `${className || '—'} · ${subjectName || '—'}`,
    filters: [
      ['Class', className || '—'],
      ['Subject', subjectName || '—'],
      ['Unit', `${unit.unitNo} — ${unit.unitName || '(no name)'}`],
      ['Sections', String(questions.length)],
      ['Language', isUrdu ? 'Urdu' : 'English'],
    ],
    sections: questions.length
      ? questions.map((q, i) => ({ title: '', html: questionBlockHtml(q, i, opts) }))
      : [{ title: 'Notebook Plan', html: '<div style="color:#999;font-style:italic">No questions saved for this unit.</div>' }],
  }
}

/* ─────────────────────────── Public entry point ─────────────────────────── */

/**
 * Report banao aur download/print karo.
 *
 * @param cfg   { kind: 'unit'|'lesson'|'nb-unit'|'nb-type', unit, lesson, q, name }
 * @param style 'color' | 'bw'
 * @param fmt   'pdf' | 'word'
 * @param meta  { className, subjectName, ctx: { classID, subjectID }, toast }
 */
export async function generateLessonPlanReport(cfg, style, fmt, meta) {
  const isColor = style !== 'bw'
  const { className, subjectName, ctx, toast } = meta
  const { unit } = cfg

  if (cfg.kind === 'unit' || cfg.kind === 'lesson') {
    const src = cfg.kind === 'lesson' ? [cfg.lesson] : (unit.lessons || [])
    const lessons = await Promise.all(src.map((l) => loadLessonContent(l, ctx)))
    const report = buildUnitReport({
      unit,
      lessons,
      className,
      subjectName,
      isColor,
      title: cfg.name,
    })
    exportReport(report, fmt, toast, !isColor)
    return
  }

  /* Notebook — questions units list me nahi hote, unit ki detail API se aate hain. */
  let questions = []
  try {
    questions = await fetchNotebookQuestions(unit.id)
  } catch (e) {
    console.error('Error loading notebook questions for report:', e)
    toast?.('Could not load notebook questions', 'error')
    return
  }
  if (cfg.kind === 'nb-type') {
    /* Group id (`<category>__<n>`) reload par badal sakti hai, is liye id na
       mile to type + main question par match kar lo. */
    const w = cfg.q
    const byId = questions.filter((x) => String(x.id) === String(w.id))
    questions = byId.length ? byId : questions.filter((x) => x.typeId === w.typeId
      && (x.mainQuestion || '') === (w.mainQuestion || w.mainQ || ''))
  }
  const report = buildNotebookReport({ unit, questions, className, subjectName, isColor, title: cfg.name })
  exportReport(report, fmt, toast, !isColor)
}
