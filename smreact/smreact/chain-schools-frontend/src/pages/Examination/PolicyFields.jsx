import { useState } from 'react'
import {
  RS_GRADE_LIST, RS_COND_OPTIONS, ABSENT_MODES, deriveCodeFromLabel, copySloFromLevel,
} from './data'
import { PRESCHOOL_LEVELS, PRESCHOOL_TEMPLATES, PRESCHOOL_FINAL_REMARKS } from './defaults'

/* ═══════════════════════════════════════════════════════════════════
   Policy field editors — one per result type, mirroring the School
   Mentor ERP Result Setup screens:
     GradeFields     → Grade 1–12 Result Setup (absent rule, grades, remarks)
     PreschoolFields → Preschool / Montessori Result Setup (learning areas,
                       E/M/A/NY grading scale, SLO statements per level and
                       learning area, PSD fields, card visibility options)
   Each editor is controlled: it receives `content` and calls onChange(patch).
   ═══════════════════════════════════════════════════════════════════ */

const GRADE_COMMENT_MAX = 28 // ERP grade-comment limit
const REMARK_MAX = 200 // ERP final-remarks limit
const nextId = (rows) => Math.max(0, ...rows.map((r) => Number(r.id) || 0)) + 1

/* ── Grade 1–12 ── */

export function GradeFields({ content, onChange, errors }) {
  const setRow = (key, idx, patch) => onChange({ [key]: content[key].map((r, i) => (i === idx ? { ...r, ...patch } : r)) })
  const removeRow = (key, idx) => onChange({ [key]: content[key].filter((_, i) => i !== idx) })
  const nextGrade = () => RS_GRADE_LIST.find((g) => !content.grades.some((r) => r.grade === g)) || ''

  return (
    <>
      <section className="exm-field exm-block">
        <span className="exm-lbl">Absent subjects</span>
        <div className="exm-radio-stack">
          {ABSENT_MODES.map((m) => (
            <label key={m.key} className="exm-radio">
              <input type="radio" name="absentMode" checked={content.absentMode === m.key} onChange={() => onChange({ absentMode: m.key })} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="exm-field exm-block">
        <div className="exm-grades-hdr">
          <span className="exm-lbl">Grades <b>*</b> <em>{content.grades.length} row{content.grades.length === 1 ? '' : 's'}</em></span>
          <button type="button" className="exm-link" disabled={content.grades.length >= RS_GRADE_LIST.length}
            onClick={() => onChange({ grades: [...content.grades, { id: nextId(content.grades), grade: nextGrade(), cond: 'gte', pct: '', comment: '' }] })}>
            <i className="fa-solid fa-plus" /> Add grade
          </button>
        </div>
        {errors.grades && <span className="exm-field-error">{errors.grades}</span>}
        <div className="exm-grade-table">
          <div className="exm-grade-row head">
            <span>Grade</span><span>Condition</span><span>Percentage</span><span>Comment</span><span />
          </div>
          {content.grades.map((g, i) => (
            <div className="exm-grade-row" key={g.id}>
              <span>
                <select className={`exm-input${errors[`grade-${i}`] ? ' err' : ''}`} value={g.grade} aria-label={`Grade ${i + 1}`}
                  onChange={(e) => setRow('grades', i, { grade: e.target.value })}>
                  {RS_GRADE_LIST.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                {errors[`grade-${i}`] && <span className="exm-field-error">{errors[`grade-${i}`]}</span>}
              </span>
              <span>
                <select className="exm-input" value={g.cond} aria-label={`Condition ${i + 1}`} onChange={(e) => setRow('grades', i, { cond: e.target.value })}>
                  {RS_COND_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </span>
              <span>
                <input className={`exm-input${errors[`pct-${i}`] ? ' err' : ''}`} inputMode="numeric" placeholder="0–100" value={g.pct}
                  aria-label={`Percentage ${i + 1}`} onChange={(e) => setRow('grades', i, { pct: e.target.value.replace(/[^\d.]/g, '') })} />
                {errors[`pct-${i}`] && <span className="exm-field-error">{errors[`pct-${i}`]}</span>}
              </span>
              <span>
                <input className="exm-input" value={g.comment} maxLength={GRADE_COMMENT_MAX} placeholder="Optional remark"
                  aria-label={`Comment ${i + 1}`} onChange={(e) => setRow('grades', i, { comment: e.target.value })} />
                <span className="exm-counter">{(g.comment || '').length}/{GRADE_COMMENT_MAX}</span>
              </span>
              <span>
                <button type="button" className="exm-icon-btn danger" aria-label={`Remove grade ${i + 1}`}
                  disabled={content.grades.length === 1} onClick={() => removeRow('grades', i)}>
                  <i className="fa-solid fa-trash-can" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="exm-field exm-block">
        <div className="exm-grades-hdr">
          <span className="exm-lbl">Final remarks by percentage <em>{content.remarks.length} row{content.remarks.length === 1 ? '' : 's'}</em></span>
          <button type="button" className="exm-link"
            onClick={() => onChange({ remarks: [...content.remarks, { id: nextId(content.remarks), grade: RS_GRADE_LIST[0], cond: 'gte', pct: '', text: '' }] })}>
            <i className="fa-solid fa-plus" /> Add remark
          </button>
        </div>
        <div className="exm-grade-table">
          <div className="exm-remark-row head"><span>Grade</span><span>Condition</span><span>Percentage</span><span>Remark</span><span /></div>
          {content.remarks.map((r, i) => (
            <div className="exm-remark-row" key={r.id}>
              <span>
                <select className={`exm-input${errors[`rgrade-${i}`] ? ' err' : ''}`} value={r.grade} aria-label={`Remark grade ${i + 1}`} onChange={(e) => setRow('remarks', i, { grade: e.target.value })}>
                  {RS_GRADE_LIST.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                {errors[`rgrade-${i}`] && <span className="exm-field-error">{errors[`rgrade-${i}`]}</span>}
              </span>
              <span>
                <select className="exm-input" value={r.cond} aria-label={`Remark condition ${i + 1}`} onChange={(e) => setRow('remarks', i, { cond: e.target.value })}>
                  {RS_COND_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </span>
              <span>
                <input className={`exm-input${errors[`rpct-${i}`] ? ' err' : ''}`} inputMode="numeric" placeholder="0–100" value={r.pct}
                  aria-label={`Remark percentage ${i + 1}`} onChange={(e) => setRow('remarks', i, { pct: e.target.value.replace(/[^\d.]/g, '') })} />
                {errors[`rpct-${i}`] && <span className="exm-field-error">{errors[`rpct-${i}`]}</span>}
              </span>
              <span>
                <textarea className={`exm-input area${errors[`rtext-${i}`] ? ' err' : ''}`} rows={2} maxLength={REMARK_MAX} value={r.text}
                  placeholder="Remark printed on the report card" aria-label={`Remark text ${i + 1}`}
                  onChange={(e) => setRow('remarks', i, { text: e.target.value })} />
                <span className="exm-counter">{(r.text || '').length}/{REMARK_MAX}</span>
                {errors[`rtext-${i}`] && <span className="exm-field-error">{errors[`rtext-${i}`]}</span>}
              </span>
              <span>
                <button type="button" className="exm-icon-btn danger" aria-label={`Remove remark ${i + 1}`} onClick={() => removeRow('remarks', i)}>
                  <i className="fa-solid fa-trash-can" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

/* ── Preschool / Montessori ──────────────────────────────────────────
   One editor per card of the ERP Preschool Result Setup, with the same
   behaviour: Learning Areas and PSD fields (add / rename / remove),
   Assessment Criteria (code auto-derived from label until typed over),
   SLO / Activity-Based Assessment (per level and learning area, with
   "Copy from previous level"), and Result Card Options (templates and
   visibility toggles). Removing a learning area leaves its statements
   in place, as the ERP does. */

/* Add-row list card (Learning Areas and PSD fields). */
function PreschoolListCard({ title, sub, items, labelKey, idPrefix, withIcons, placeholder, addError, onChange }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const add = () => {
    const v = text.trim()
    if (!v) { setErr(addError); return }
    const item = withIcons ? { id: `${idPrefix}_${Date.now()}`, name: v, icon: 'fa-book' } : { id: `${idPrefix}_${Date.now()}`, label: v }
    onChange([...items, item])
    setText('')
    setErr('')
  }
  return (
    <section className="exm-field exm-block">
      <div className="exm-grades-hdr">
        <span className="exm-lbl">{title} <em>{items.length}</em></span>
      </div>
      <p className="exm-sub" style={{ margin: 0 }}>{sub}</p>
      <div className="exm-pair-list">
        {items.map((it, i) => (
          <div className="exm-pair-row" key={it.id}>
            <span className="exm-row-lead">
              {withIcons && <i className={`fa-solid ${it.icon || 'fa-book'}`} aria-hidden="true" />}
              <input className="exm-input" value={withIcons ? it.name : it.label} maxLength={60} aria-label={`${title} ${i + 1}`}
                onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, [labelKey]: e.target.value } : x)))} />
            </span>
            <button type="button" className="exm-icon-btn danger" aria-label={`Remove ${i + 1}`} onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
              <i className="fa-solid fa-trash-can" />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="exm-empty-inline">None added yet.</div>}
      </div>
      <div className="exm-pair-row add">
        <input className={`exm-input${err ? ' err' : ''}`} value={text} placeholder={placeholder} maxLength={60}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} aria-label={`Add ${title}`} />
        <button type="button" className="exm-btn ghost sm" onClick={add}><i className="fa-solid fa-plus" /> Add</button>
      </div>
      {err && <span className="exm-field-error">{err}</span>}
    </section>
  )
}

/* Assessment Criteria: four levels, code / label / range / colour. */
function PreschoolGradingScaleCard({ scale, onChange, error }) {
  /* A row's code follows its label until the code is typed directly,
     then it stays as typed (ERP "auto until overridden"). */
  const [manual, setManual] = useState({})
  const setLabel = (idx, label) => onChange(scale.map((g, i) => {
    if (i !== idx) return g
    return { ...g, label, code: manual[idx] ? g.code : deriveCodeFromLabel(label) }
  }))
  const setCode = (idx, code) => {
    setManual((m) => ({ ...m, [idx]: true }))
    onChange(scale.map((g, i) => (i === idx ? { ...g, code: code.toUpperCase() } : g)))
  }
  const setField = (idx, key, val) => onChange(scale.map((g, i) => (i === idx ? { ...g, [key]: val } : g)))
  return (
    <section className="exm-field exm-block">
      <span className="exm-lbl">Assessment criteria</span>
      <p className="exm-sub" style={{ margin: 0 }}>The code is generated from the label as you rename it (e.g. "Excellent Performance" → EP), or type a code directly. Renaming updates every rating button, chip and result card.</p>
      <div className="exm-grade-table">
        <div className="exm-scale-row head"><span>Code</span><span>Label</span><span>Range</span><span>Colour</span></div>
        {scale.map((g, idx) => (
          <div className="exm-scale-row" key={idx}>
            <span className="exm-scale-pair">
              <span className="exm-scale-code" style={{ background: g.color }}>{g.code || '?'}</span>
              <input className="exm-input code" value={g.code} maxLength={6} placeholder="Code" aria-label={`Code ${idx + 1}`}
                onChange={(e) => setCode(idx, e.target.value)} />
            </span>
            <input className="exm-input" value={g.label} maxLength={60} aria-label={`Label ${idx + 1}`} onChange={(e) => setLabel(idx, e.target.value)} />
            <input className="exm-input" value={g.range || ''} maxLength={20} placeholder="e.g. 90% - 100%" aria-label={`Range ${idx + 1}`}
              onChange={(e) => setField(idx, 'range', e.target.value)} />
            <input type="color" className="exm-color" value={g.color} aria-label={`Colour ${idx + 1}`} onChange={(e) => setField(idx, 'color', e.target.value)} />
          </div>
        ))}
      </div>
      {error && <span className="exm-field-error">{error}</span>}
    </section>
  )
}

/* SLO / Activity-Based Assessment: level → learning area → statements. */
function PreschoolSloCard({ content, onChange }) {
  const [level, setLevel] = useState(PRESCHOOL_LEVELS[0].id)
  const [area, setArea] = useState(content.learningAreas[0]?.id || null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const activeArea = content.learningAreas.find((la) => la.id === area) || content.learningAreas[0] || null
  const levelIdx = PRESCHOOL_LEVELS.findIndex((l) => l.id === level)
  const prevLevel = levelIdx > 0 ? PRESCHOOL_LEVELS[levelIdx - 1] : null
  const current = PRESCHOOL_LEVELS[levelIdx]
  const statements = (activeArea && content.slo[level]?.[activeArea.id]) || []

  const setStatements = (list) => onChange({
    slo: { ...content.slo, [level]: { ...(content.slo[level] || {}), [activeArea.id]: list } },
  })
  const add = () => {
    if (!activeArea) return
    const v = text.trim()
    if (!v) { setErr('Enter an assessment statement first'); return }
    setStatements([...statements, { id: `slo_${level}_${activeArea.id}_${Date.now()}`, text: v }])
    setText('')
    setErr('')
  }
  const copyFromPrevious = () => {
    if (!prevLevel) return
    const hasExisting = Object.values(content.slo[level] || {}).some((list) => list?.length)
    if (hasExisting && !window.confirm(`Copy every learning area's SLOs from "${prevLevel.name}" into "${current.name}"? This replaces everything currently set up for ${current.name}.`)) return
    onChange({ slo: copySloFromLevel(content.slo, prevLevel.id, level) })
  }

  return (
    <section className="exm-field exm-block">
      <div className="exm-grades-hdr">
        <span className="exm-lbl">SLO / activity-based assessment</span>
        {prevLevel && (
          <button type="button" className="exm-link" onClick={copyFromPrevious}><i className="fa-solid fa-clone" /> Copy from {prevLevel.name}</button>
        )}
      </div>
      <p className="exm-sub" style={{ margin: 0 }}>Pick a class level, then a learning area, and add the assessment statements teachers rate against.</p>
      <div className="exm-chips" role="tablist" aria-label="Class level">
        {PRESCHOOL_LEVELS.map((l) => (
          <button type="button" key={l.id} role="tab" aria-selected={level === l.id} className={`exm-chip${level === l.id ? ' on' : ''}`} onClick={() => { setLevel(l.id); setText(''); setErr('') }}>{l.name}</button>
        ))}
      </div>
      {content.learningAreas.length === 0 ? (
        <div className="exm-empty-inline">Add a learning area above to write its statements.</div>
      ) : (
        <>
          <div className="exm-chips" role="tablist" aria-label="Learning area">
            {content.learningAreas.map((la) => (
              <button type="button" key={la.id} role="tab" aria-selected={activeArea?.id === la.id}
                className={`exm-chip${activeArea?.id === la.id ? ' on' : ''}`} onClick={() => { setArea(la.id); setText(''); setErr('') }}>{la.name || 'Untitled area'}</button>
            ))}
          </div>
          <div className="exm-pair-list">
            {statements.length === 0 && <div className="exm-empty-inline">No assessment points yet for this learning area.</div>}
            {statements.map((st, i) => (
              <div className="exm-pair-row" key={st.id}>
                <span className="exm-row-lead"><i className="fa-solid fa-circle-dot" aria-hidden="true" /></span>
                <input className="exm-input" value={st.text} maxLength={200} aria-label={`Statement ${i + 1}`}
                  onChange={(e) => setStatements(statements.map((x) => (x.id === st.id ? { ...x, text: e.target.value } : x)))} />
                <button type="button" className="exm-icon-btn danger" aria-label={`Remove statement ${i + 1}`} onClick={() => setStatements(statements.filter((x) => x.id !== st.id))}>
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
            ))}
          </div>
          <div className="exm-pair-row add">
            <input className={`exm-input${err ? ' err' : ''}`} value={text} maxLength={200} placeholder="e.g. Counts objects with one-to-one correspondence"
              aria-label="New statement" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
            <button type="button" className="exm-btn ghost sm" onClick={add}><i className="fa-solid fa-plus" /> Add</button>
          </div>
          {err && <span className="exm-field-error">{err}</span>}
        </>
      )}
    </section>
  )
}

/* Result Card Options: fixed templates (read-only) and visibility toggles. */
function PreschoolCardOptions({ content, onChange }) {
  const toggle = (idx) => onChange({ cardOptions: content.cardOptions.map((o, i) => (i === idx ? { ...o, on: !o.on } : o)) })
  return (
    <section className="exm-field exm-block">
      <span className="exm-lbl">Result card templates</span>
      <div className="exm-template-grid">
        {PRESCHOOL_TEMPLATES.map((t) => (
          <div key={t.id} className="exm-template" style={{ '--acc': t.accent }}>
            <span className="exm-template-icon"><i className={`fa-solid ${t.icon}`} /></span>
            <strong>{t.name}</strong>
            <span className="exm-sub">{t.desc}</span>
          </div>
        ))}
      </div>
      <span className="exm-lbl">Visibility options <em>Monthly, Term &amp; Annual report cards</em></span>
      <div className="exm-toggle-list">
        {content.cardOptions.map((o, i) => (
          <label key={o.label} className="exm-toggle-row">
            <span><i className={`fa-solid ${o.icon}`} /> {o.label}</span>
            <input type="checkbox" checked={!!o.on} onChange={() => toggle(i)} aria-label={o.label} />
          </label>
        ))}
      </div>
    </section>
  )
}

export function PreschoolFields({ content, onChange, errors }) {
  return (
    <>
      <PreschoolListCard
        title="Learning areas / subjects" icon="fa-book-open"
        sub="The subjects children are assessed in — add or remove as needed."
        items={content.learningAreas} labelKey="name" idPrefix="la" withIcons
        placeholder="Add a new learning area…" addError="Enter a name first"
        onChange={(learningAreas) => onChange({ learningAreas })}
      />
      {errors.learningAreas && <span className="exm-field-error">{errors.learningAreas}</span>}

      <PreschoolGradingScaleCard scale={content.gradingScale} error={errors.gradingScale}
        onChange={(gradingScale) => onChange({ gradingScale })} />

      <PreschoolSloCard content={content} onChange={onChange} />

      <PreschoolListCard
        title="Personal & social development fields" icon="fa-people-arrows"
        sub="Configurable behaviour and development fields shown on every Preschool report card."
        items={content.psdFields} labelKey="label" idPrefix="psd"
        placeholder="Add a new field…" addError="Enter a name first"
        onChange={(psdFields) => onChange({ psdFields })}
      />

      <PreschoolCardOptions content={content} onChange={onChange} />

      <section className="exm-field exm-block">
        <span className="exm-lbl">Built into the School Mentor ERP</span>
        <p className="exm-sub" style={{ margin: 0 }}>These are fixed in the ERP and are not edited here. Teachers can still override the final remark for an individual child.</p>
        <ul className="exm-chip-list">
          {['E', 'M', 'A', 'NY'].map((c) => (
            <li key={c}><strong>{c}</strong> {PRESCHOOL_FINAL_REMARKS[c]}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
