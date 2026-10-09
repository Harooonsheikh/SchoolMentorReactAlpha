import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AllSchoolsScope from './AllSchoolsScope'
import { EXAM_TERMS, EXAM_STATUS, chainClasses, currentSession } from './data'

/* ═══════════════════════════════════════════════════════════════════
   Exam editor — create or edit a Head Office exam. Field set mirrors the
   School Mentor ERP exam form: name, term, dates, classes. Session comes
   from Academics (read-only here). Saving a draft never changes what
   schools receive; that only happens on Publish.
   ═══════════════════════════════════════════════════════════════════ */
export default function ExamEditor({ exam, actor, onSave, onClose }) {
  const isNew = !exam
  const [form, setForm] = useState(() => ({
    name: exam?.name || '',
    term: exam?.term || EXAM_TERMS[0],
    from: exam?.from || '',
    to: exam?.to || '',
    classIds: exam?.classIds || [],
  }))
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const classes = chainClasses()
  const session = exam?.session || currentSession()
  const livePublished = exam?.status === EXAM_STATUS.PUBLISHED

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const toggleClass = (id) => set('classIds', form.classIds.includes(id)
    ? form.classIds.filter((c) => c !== id)
    : [...form.classIds, id])

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Exam name is required.'
    if (!form.term) e.term = 'Choose a term.'
    if (!form.from) e.from = 'Start date is required.'
    if (!form.to) e.to = 'End date is required.'
    if (form.from && form.to && form.to < form.from) e.to = 'End date cannot be before the start date.'
    if (!form.classIds.length) e.classIds = 'Select at least one class.'
    return e
  }

  const submit = (e) => {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    const err = onSave({ ...form, name: form.name.trim(), session })
    if (err) setSaveError(err)
  }

  return createPortal(
    <div className="exm-ov" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose() }}>
      <form className="exm-modal" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="exm-exam-title">
        <div className="exm-modal-hdr">
          <div className="exm-modal-icon"><i className="fa-solid fa-file-signature" /></div>
          <div className="exm-modal-titles">
            <h2 id="exm-exam-title">{isNew ? 'New Exam' : 'Edit Exam'}</h2>
            <p>Head Office exam · {session || 'No academic session set'}</p>
          </div>
          <button type="button" className="exm-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="exm-modal-body">
          {livePublished && (
            <div className="exm-banner warn">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>This exam is live (version {exam.publishedVersion}). Schools keep seeing that version until you publish again. Your edits stay as a draft revision.</span>
            </div>
          )}

          <div className="exm-grid">
            <label className="exm-field exm-span-2">
              <span className="exm-lbl">Exam name <b>*</b></span>
              <input className={`exm-input${errors.name ? ' err' : ''}`} value={form.name} placeholder="e.g. Final Term Examination"
                onChange={(e) => set('name', e.target.value)} maxLength={80} />
              {errors.name && <span className="exm-field-error">{errors.name}</span>}
            </label>

            <label className="exm-field">
              <span className="exm-lbl">Term <b>*</b></span>
              <select className={`exm-input${errors.term ? ' err' : ''}`} value={form.term} onChange={(e) => set('term', e.target.value)}>
                {EXAM_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.term && <span className="exm-field-error">{errors.term}</span>}
            </label>

            <div className="exm-field">
              <span className="exm-lbl">Academic session</span>
              <div className="exm-readonly"><i className="fa-solid fa-calendar" /> {session || 'Not set in Academics'}</div>
            </div>

            <label className="exm-field">
              <span className="exm-lbl">Start date <b>*</b></span>
              <input type="date" className={`exm-input${errors.from ? ' err' : ''}`} value={form.from} onChange={(e) => set('from', e.target.value)} />
              {errors.from && <span className="exm-field-error">{errors.from}</span>}
            </label>

            <label className="exm-field">
              <span className="exm-lbl">End date <b>*</b></span>
              <input type="date" className={`exm-input${errors.to ? ' err' : ''}`} value={form.to} onChange={(e) => set('to', e.target.value)} />
              {errors.to && <span className="exm-field-error">{errors.to}</span>}
            </label>
          </div>

          <div className="exm-field exm-block">
            <span className="exm-lbl">Applicable classes <b>*</b> <em>{form.classIds.length} selected</em></span>
            {classes.length === 0 ? (
              <div className="exm-empty-inline">No classes are set up in Academics yet. Add classes there before creating an exam.</div>
            ) : (
              <div className="exm-chips">
                {classes.map((c) => {
                  const on = form.classIds.includes(c.id)
                  return (
                    <button type="button" key={c.id} className={`exm-chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleClass(c.id)}>
                      {on && <i className="fa-solid fa-check" />} {c.name}
                    </button>
                  )
                })}
              </div>
            )}
            {errors.classIds && <span className="exm-field-error">{errors.classIds}</span>}
          </div>

          <div className="exm-field exm-block">
            <span className="exm-lbl">Schools</span>
            <AllSchoolsScope />
          </div>
        </div>

        {saveError && <div className="exm-modal-err"><i className="fa-solid fa-circle-exclamation" /> {saveError}</div>}

        <div className="exm-modal-foot">
          <span className="exm-foot-note">Saved as {isNew ? 'a draft' : 'a draft revision'}{actor ? ` by ${actor}` : ''}. Nothing reaches schools until published.</span>
          <div className="exm-foot-btns">
            <button type="button" className="exm-btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="exm-btn primary"><i className="fa-solid fa-floppy-disk" /> {isNew ? 'Save Draft' : 'Save Changes'}</button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  )
}
