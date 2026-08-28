import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  buildAcademicStructure, mirrorAcademicStructure,
  loadSubjectCatalog, saveSubjectCatalog, subjectKey, subjectIdOf,
} from '../../config/academicsStore'
import {
  currentNetworkId, fetchNetworkAcademics,
  saveNetworkClass, deleteNetworkClass,
  saveNetworkSubject, deleteNetworkSubject,
} from '../../api/academicsSetupApi'
import './ClassesSubjects.css'

/* ═══════════════════════════════════════════════════════════════════
   CLASSES & SUBJECTS — ab localStorage par nahi, ERP ke LaunchSetup par
   networkID ki base par (dekhein src/api/academicsSetupApi.js).

     • Class   = grade row   → save-grade / get-grades-by-network / delete-grade
     • Subject = grade ka subject row → save-subject /
                 get-subjects-by-network-grade / delete-subject

   API me subject hamesha kisi class (gradeID) ke neeche hota hai — network
   level par "sirf subject" rakhne ki koi table nahi. Is liye upar wali
   Subjects list poore network ke subject naamon ka jorr hai (har class ke
   rows se banti hai), aur jo naam abhi kisi class ko assign nahi hua wo
   local catalog me intezar karta hai — Assign karte hi asli row ban jata hai.

   Load ke baad ye dhancha academicsStore me mirror ho jata hai, taake baqi
   Academics module (lesson plans, textbooks…) wahi classes/subjects dekhe.
   ═══════════════════════════════════════════════════════════════════ */

export default function ClassesSubjects() {
  const networkId = currentNetworkId()

  const [classes, setClasses] = useState([])
  const [subjectRows, setSubjectRows] = useState([])   // [{ id, name, classId }] — server rows
  const [staged, setStaged] = useState([])             // abhi kisi class ko assign na hue naam
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [toast, setToast] = useState(null)
  const [subjInput, setSubjInput] = useState('')
  const [editSubj, setEditSubj] = useState(null)       // { name, value }
  const [classModal, setClassModal] = useState(null)
  const [assignModal, setAssignModal] = useState(null)
  const [del, setDel] = useState(null)

  const fire = (text, type = 'success') => setToast({ text, type })
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const reload = useCallback(async () => {
    const data = await fetchNetworkAcademics(networkId)
    setClasses(data.classes)
    setSubjectRows(data.subjectRows)
    return data
  }, [networkId])

  useEffect(() => {
    let alive = true
    setStaged(loadSubjectCatalog(networkId))
    if (!networkId) {
      setLoading(false)
      setError('No network session found — sign in again from the ERP.')
      return () => { alive = false }
    }
    setLoading(true)
    setError('')
    reload()
      .catch((err) => { if (alive) setError(err?.message || 'Could not load classes & subjects') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [networkId, reload])

  /* Server rows + local catalog → wahi { subjects, classSubjects } shape jo
     screen aur Academics module dono samajhte hain. */
  const { subjects, classSubjects } = useMemo(
    () => buildAcademicStructure({ classes, subjectRows, staged }),
    [classes, subjectRows, staged],
  )

  /* Mirror sirf kamyab load ke baad — warna khali initial state store saaf
     kar deti. */
  useEffect(() => {
    if (loading || error) return
    mirrorAcademicStructure({ classes, subjects, classSubjects })
  }, [loading, error, classes, subjects, classSubjects])

  const subsOf = (classId) =>
    (classSubjects[classId] || []).map((id) => subjects.find((s) => s.id === id)).filter(Boolean)

  /* Har write ke baad server se hi taza data uthta hai — id ya dedup ka
     faisla kabhi client par nahi hota. */
  const runOp = async (fn, okMsg) => {
    setBusy(true)
    try {
      await fn()
      await reload()
      if (okMsg) fire(okMsg.text || okMsg, okMsg.type)
      return true
    } catch (err) {
      fire(err?.message || 'Request failed', 'warn')
      return false
    } finally {
      setBusy(false)
    }
  }

  /* ─────────────── subjects ─────────────── */
  const addSubject = () => {
    const name = subjInput.trim()
    if (!name) return
    if (subjects.some((s) => subjectKey(s.name) === subjectKey(name))) return fire('Subject already exists', 'warn')
    const next = [...staged, name]
    setStaged(next)
    saveSubjectCatalog(networkId, next)
    setSubjInput('')
    fire('Subject added — assign it to a class to save it')
  }

  const saveSubjectEdit = async () => {
    const name = editSubj.value.trim()
    if (!name) return
    const from = subjectKey(editSubj.name)
    if (subjectKey(name) !== from && subjects.some((s) => subjectKey(s.name) === subjectKey(name))) {
      return fire('Subject already exists', 'warn')
    }
    const affected = subjectRows.filter((r) => subjectKey(r.name) === from)
    const ok = await runOp(async () => {
      /* Aik hi subject kai classes me ho sakta hai — subject ki pehchaan naam
         hai, is liye har row ka naam badalna parta hai. */
      for (const r of affected) {
        await saveNetworkSubject({ id: r.id, name, classId: r.classId }, networkId)
      }
      const next = staged.map((n) => (subjectKey(n) === from ? name : n))
      setStaged(next)
      saveSubjectCatalog(networkId, next)
    }, 'Subject updated')
    if (ok) setEditSubj(null)
  }

  const delSubject = (name) => {
    const from = subjectKey(name)
    const affected = subjectRows.filter((r) => subjectKey(r.name) === from)
    runOp(async () => {
      for (const r of affected) await deleteNetworkSubject(r.id)
      const next = staged.filter((n) => subjectKey(n) !== from)
      setStaged(next)
      saveSubjectCatalog(networkId, next)
    }, { text: 'Subject removed', type: 'info' })
  }

  /* ─────────────── classes ─────────────── */
  const saveClass = async (name, id) => {
    const orderBy = id ? (classes.find((c) => c.id === id)?.orderBy || 0) : classes.length + 1
    const ok = await runOp(
      () => saveNetworkClass({ id: id || 0, name, orderBy }, networkId),
      id ? 'Class updated' : 'Class added',
    )
    if (ok) setClassModal(null)
  }

  const doDelClass = async () => {
    const ok = await runOp(async () => {
      /* Pehle is class ke subject rows — grade par FK hoti hai, warna delete
         reject ho jati hai. */
      for (const r of subjectRows.filter((x) => x.classId === del.id)) await deleteNetworkSubject(r.id)
      await deleteNetworkClass(del.id)
    }, { text: 'Class deleted', type: 'info' })
    if (ok) setDel(null)
  }

  const saveAssign = async (classId, selectedIds) => {
    const wanted = new Set(selectedIds)
    const current = subjectRows.filter((r) => r.classId === classId)
    const have = new Set(current.map((r) => subjectIdOf(r.name)))
    const toAdd = subjects.filter((s) => wanted.has(s.id) && !have.has(s.id))
    const toRemove = current.filter((r) => !wanted.has(subjectIdOf(r.name)))
    if (!toAdd.length && !toRemove.length) { setAssignModal(null); return }
    const ok = await runOp(async () => {
      for (const s of toAdd) await saveNetworkSubject({ id: 0, name: s.name, classId }, networkId)
      for (const r of toRemove) await deleteNetworkSubject(r.id)
    }, 'Subjects assigned')
    if (ok) setAssignModal(null)
  }

  const toastEl = toast && createPortal(
    <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
    document.body,
  )

  if (loading) {
    return (
      <div className="stg-panel">
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--tm)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>Loading classes &amp; subjects…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="stg-panel">
      <div className="cs-info">
        <i className="fa-solid fa-circle-info" />
        <div>Define your chain&apos;s <strong>classes</strong> and the <strong>subjects</strong> taught in each. They are saved against your <strong>network</strong> and drive the entire <strong>Academics</strong> module — textbooks, lesson plans, calendars and more.</div>
      </div>

      {error && (
        <div className="cs-info" style={{ background: 'rgba(220,38,38,.06)', borderColor: 'rgba(220,38,38,.25)' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--err)' }} />
          <div>{error}</div>
        </div>
      )}

      {/* Subjects master list */}
      <div className="section-card" style={{ marginBottom: 18 }}>
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-book" /> Subjects</div></div>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input className="cs-input" value={subjInput} onChange={(e) => setSubjInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubject()} placeholder="Add a subject (e.g. Mathematics)" style={{ flex: 1 }} disabled={busy} />
            <button className="btn-primary" onClick={addSubject} disabled={busy}><i className="fa-solid fa-plus" /> Add Subject</button>
          </div>
          <div className="cs-subj-wrap">
            {subjects.length === 0 ? <div style={{ color: 'var(--tm)', fontSize: 13 }}>No subjects yet.</div>
              : subjects.map((s) => (
                <span className="cs-subj-chip" key={s.id}>
                  <i className="fa-solid fa-book-open" /> {s.name}
                  <button className="cs-chip-btn" title="Rename" disabled={busy} onClick={() => setEditSubj({ name: s.name, value: s.name })}><i className="fa-solid fa-pen" /></button>
                  <button className="cs-chip-btn del" title="Remove" disabled={busy} onClick={() => delSubject(s.name)}><i className="fa-solid fa-xmark" /></button>
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Classes + assigned subjects */}
      <div className="section-card">
        <div className="card-header">
          <div className="card-title"><i className="fa-solid fa-chalkboard" /> Classes &amp; Assigned Subjects</div>
          <button className="btn-primary" onClick={() => setClassModal({ mode: 'add' })} disabled={busy}><i className="fa-solid fa-plus" /> Add Class</button>
        </div>
        <div style={{ padding: 18 }}>
          {classes.length === 0 ? <div style={{ color: 'var(--tm)', fontSize: 13 }}>No classes yet. Click “Add Class”.</div>
            : classes.map((c) => {
              const subs = subsOf(c.id)
              return (
                <div className="cs-class-row" key={c.id}>
                  <div className="cs-class-ic"><i className="fa-solid fa-chalkboard-user" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cs-class-name">{c.name}</div>
                    <div className="cs-class-subs">
                      {subs.length === 0 ? <span style={{ color: 'var(--tm)', fontSize: 12 }}>No subjects assigned</span>
                        : subs.map((s) => <span className="cs-mini-chip" key={s.id}>{s.name}</span>)}
                    </div>
                  </div>
                  <span className="badge b-blue">{subs.length} subject{subs.length !== 1 ? 's' : ''}</span>
                  <button className="btn-secondary" disabled={busy} onClick={() => setAssignModal({ classId: c.id, name: c.name, selected: classSubjects[c.id] || [] })}><i className="fa-solid fa-list-check" /> Assign</button>
                  <button className="btn-sm" style={{ height: 36 }} disabled={busy} onClick={() => setClassModal({ mode: 'edit', cls: c })}><i className="fa-solid fa-pen" /></button>
                  <button className="btn-sm" style={{ height: 36, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} disabled={busy} onClick={() => setDel(c)}><i className="fa-solid fa-trash-can" /></button>
                </div>
              )
            })}
        </div>
      </div>

      {editSubj && <SmallModal title="Rename Subject" icon="fa-book" busy={busy} onClose={() => setEditSubj(null)} onSave={saveSubjectEdit}>
        <input className="cs-input" value={editSubj.value} onChange={(e) => setEditSubj((s) => ({ ...s, value: e.target.value }))} style={{ width: '100%' }} autoFocus />
      </SmallModal>}
      {classModal && <ClassModal modal={classModal} busy={busy} onClose={() => setClassModal(null)} onSave={saveClass} onToast={fire} />}
      {assignModal && <AssignModal modal={assignModal} subjects={subjects} busy={busy} onClose={() => setAssignModal(null)} onSave={saveAssign} />}
      {del && <Confirm name={del.name} busy={busy} onClose={() => setDel(null)} onConfirm={doDelClass} />}

      {toastEl}
    </div>
  )
}

function ClassModal({ modal, busy, onClose, onSave, onToast }) {
  const [name, setName] = useState(modal.cls?.name || '')
  const save = () => { if (!name.trim()) return onToast('Enter a class name', 'warn'); onSave(name.trim(), modal.cls?.id) }
  return <SmallModal title={modal.cls ? 'Edit Class' : 'Add Class'} icon="fa-chalkboard" busy={busy} onClose={onClose} onSave={save}>
    <label className="cs-lbl">Class Name</label>
    <input className="cs-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 6" style={{ width: '100%' }} autoFocus />
  </SmallModal>
}

function AssignModal({ modal, subjects, busy, onClose, onSave }) {
  const [sel, setSel] = useState(new Set(modal.selected))
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return <SmallModal title={`Assign Subjects — ${modal.name}`} icon="fa-list-check" busy={busy} onClose={onClose} onSave={() => onSave(modal.classId, [...sel])} wide saveLabel="Save Assignment">
    <div className="cs-assign-grid">
      {subjects.length === 0 ? <div style={{ color: 'var(--tm)', fontSize: 13 }}>Add subjects first.</div>
        : subjects.map((s) => (
          <label key={s.id} className={`cs-assign-item${sel.has(s.id) ? ' on' : ''}`}>
            <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} /> {s.name}
          </label>
        ))}
    </div>
  </SmallModal>
}

function SmallModal({ title, icon, wide, saveLabel, busy, children, onClose, onSave }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: wide ? 560 : 440 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av"><i className={`fa-solid ${icon}`} /></div>
          <div><div className="pay-modal-title">{title}</div></div>
          <button className="pay-modal-x" onClick={onClose} disabled={busy}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">{children}</div>
        <div className="pay-modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={onSave} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {busy ? 'Saving…' : (saveLabel || 'Save')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Confirm({ name, busy, onClose, onConfirm }) {
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">Delete Class?</div>
          <div className="confirm-sub">“{name}” and its subjects will be removed from your network.</div>
          <div className="confirm-btns">
            <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-danger" onClick={onConfirm} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} /> {busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
