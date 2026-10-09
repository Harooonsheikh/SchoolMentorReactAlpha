import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AllSchoolsScope from './AllSchoolsScope'
import { GradeFields, PreschoolFields } from './PolicyFields'
import {
  EXAM_STATUS, POLICY_TYPES, policyTypeMeta, newPolicyContent, currentSession, validateContent,
} from './data'

/* ═══════════════════════════════════════════════════════════════════
   Result policy editor. Two types, exactly like the School Mentor ERP
   Result Setup: Grade 1–12, or Preschool / Montessori. A new policy
   starts with a type choice; the type is fixed once created.
   ═══════════════════════════════════════════════════════════════════ */
export default function ResultPolicyEditor({ policy, onSave, onClose }) {
  const isNew = !policy
  const [type, setType] = useState(policy?.type || null)
  const [form, setForm] = useState(() => ({
    name: policy?.name || '',
    content: policy?.content ? JSON.parse(JSON.stringify(policy.content)) : (policy?.type ? newPolicyContent(policy.type) : null),
  }))
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const session = policy?.session || currentSession()
  const livePublished = policy?.status === EXAM_STATUS.PUBLISHED

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const chooseType = (t) => {
    setType(t)
    setForm((f) => ({ ...f, content: newPolicyContent(t) }))
  }
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const patchContent = (patch) => setForm((f) => ({ ...f, content: { ...f.content, ...patch } }))

  const submit = (ev) => {
    ev.preventDefault()
    const e = { ...validateContent(type, form.content) }
    if (!form.name.trim()) e.name = 'Policy name is required.'
    setErrors(e)
    if (Object.keys(e).length) return
    const err = onSave({ name: form.name.trim(), session, type, content: form.content })
    if (err) setSaveError(err)
  }

  const meta = policyTypeMeta(type)
  const chooser = type === null

  return createPortal(
    <div className="exm-ov" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose() }}>
      <form className="exm-modal wide" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="exm-policy-title">
        <div className="exm-modal-hdr">
          <div className="exm-modal-icon amber"><i className={`fa-solid ${chooser ? 'fa-square-poll-vertical' : meta.icon}`} /></div>
          <div className="exm-modal-titles">
            <h2 id="exm-policy-title">{chooser ? 'New Result Policy' : `${isNew ? 'New' : 'Edit'} ${meta.label} Policy`}</h2>
            <p>{chooser ? 'Choose the result system this policy governs' : `Result Setup · ${session || 'No academic session set'}`}</p>
          </div>
          <button type="button" className="exm-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        {chooser ? (
          <div className="exm-modal-body">
            <div className="exm-type-cards">
              {POLICY_TYPES.map((t) => (
                <button type="button" key={t.key} className="exm-type-card" onClick={() => chooseType(t.key)}>
                  <span className="exm-type-icon"><i className={`fa-solid ${t.icon}`} /></span>
                  <strong>{t.label}</strong>
                  <span className="exm-sub">{t.desc}</span>
                </button>
              ))}
            </div>
            <p className="exm-note">
              <i className="fa-solid fa-circle-info" /> A school can have one live Grade 1–12 policy and one live Preschool / Montessori policy, just like its own Result Setup.
            </p>
          </div>
        ) : (
          <div className="exm-modal-body">
            {livePublished && (
              <div className="exm-banner warn">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>This policy is live (version {policy.publishedVersion}). Schools keep the live version until you publish again.</span>
              </div>
            )}

            <div className="exm-grid">
              <label className="exm-field exm-span-2">
                <span className="exm-lbl">Policy name <b>*</b></span>
                <input className={`exm-input${errors.name ? ' err' : ''}`} value={form.name}
                  placeholder={type === 'preschool' ? 'e.g. Montessori Assessment 2026' : 'e.g. Chain Grading Policy 2026'}
                  onChange={(e) => set('name', e.target.value)} maxLength={80} />
                {errors.name && <span className="exm-field-error">{errors.name}</span>}
              </label>
              <div className="exm-field">
                <span className="exm-lbl">Result type</span>
                <div className="exm-readonly"><i className={`fa-solid ${meta.icon}`} /> {meta.label}</div>
              </div>
              <div className="exm-field">
                <span className="exm-lbl">Academic session</span>
                <div className="exm-readonly"><i className="fa-solid fa-calendar" /> {session || 'Not set in Academics'}</div>
              </div>
            </div>

            {type === 'grade'
              ? <GradeFields content={form.content} onChange={patchContent} errors={errors} />
              : <PreschoolFields content={form.content} onChange={patchContent} errors={errors} />}

            <div className="exm-field exm-block">
              <span className="exm-lbl">Schools</span>
              <AllSchoolsScope />
            </div>
          </div>
        )}

        {saveError && <div className="exm-modal-err"><i className="fa-solid fa-circle-exclamation" /> {saveError}</div>}

        <div className="exm-modal-foot">
          <span className="exm-foot-note">
            {chooser ? 'Pick a type to continue.' : `Saved as ${isNew ? 'a draft' : 'a draft revision'}. Schools receive it only when published.`}
          </span>
          <div className="exm-foot-btns">
            {!chooser && !isNew && <span />}
            <button type="button" className="exm-btn ghost" onClick={onClose}>Cancel</button>
            {!chooser && (
              <button type="submit" className="exm-btn primary"><i className="fa-solid fa-floppy-disk" /> {isNew ? 'Save Draft' : 'Save Changes'}</button>
            )}
          </div>
        </div>
      </form>
    </div>,
    document.body,
  )
}
