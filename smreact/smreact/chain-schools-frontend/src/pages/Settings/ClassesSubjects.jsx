import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadAcademics, saveAcademics, subjectsOfClass } from '../../config/academicsStore'
import './ClassesSubjects.css'

export default function ClassesSubjects() {
  const [a, setA] = useState(null)
  const [toast, setToast] = useState(null)
  const [subjInput, setSubjInput] = useState('')
  const [editSubj, setEditSubj] = useState(null) // {id, name}
  const [classModal, setClassModal] = useState(null)
  const [assignModal, setAssignModal] = useState(null)
  const [del, setDel] = useState(null)

  useEffect(() => { setA(loadAcademics()) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t) }, [toast])
  const fire = (text, type = 'success') => setToast({ text, type })
  const commit = (next) => { setA(next); saveAcademics(next) }
  if (!a) return null

  /* subjects */
  const addSubject = () => {
    const name = subjInput.trim(); if (!name) return
    if (a.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) return fire('Subject already exists', 'warn')
    const id = a.nextSubjectId; commit({ ...a, nextSubjectId: id + 1, subjects: [...a.subjects, { id, name }] }); setSubjInput(''); fire('Subject added')
  }
  const saveSubjectEdit = () => {
    const name = editSubj.name.trim(); if (!name) return
    commit({ ...a, subjects: a.subjects.map((s) => (s.id === editSubj.id ? { ...s, name } : s)) }); setEditSubj(null); fire('Subject updated')
  }
  const delSubject = (id) => {
    const classSubjects = {}; Object.entries(a.classSubjects).forEach(([cid, ids]) => { classSubjects[cid] = ids.filter((x) => x !== id) })
    commit({ ...a, subjects: a.subjects.filter((s) => s.id !== id), classSubjects }); fire('Subject removed', 'info')
  }

  /* classes */
  const saveClass = (name, id) => {
    if (id) commit({ ...a, classes: a.classes.map((c) => (c.id === id ? { ...c, name } : c)) })
    else { const nid = a.nextClassId; commit({ ...a, nextClassId: nid + 1, classes: [...a.classes, { id: nid, name }], classSubjects: { ...a.classSubjects, [nid]: [] } }) }
    setClassModal(null); fire(id ? 'Class updated' : 'Class added')
  }
  const doDelClass = () => {
    const cs = { ...a.classSubjects }; delete cs[del.id]
    commit({ ...a, classes: a.classes.filter((c) => c.id !== del.id), classSubjects: cs }); setDel(null); fire('Class deleted', 'info')
  }
  const saveAssign = (classId, ids) => { commit({ ...a, classSubjects: { ...a.classSubjects, [classId]: ids } }); setAssignModal(null); fire('Subjects assigned') }

  return (
    <div className="stg-panel">
      <div className="cs-info">
        <i className="fa-solid fa-circle-info" />
        <div>Define your chain's <strong>classes</strong> and the <strong>subjects</strong> taught in each. These drive the entire <strong>Academics</strong> module — textbooks, lesson plans, calendars and more.</div>
      </div>

      {/* Subjects master list */}
      <div className="section-card" style={{ marginBottom: 18 }}>
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-book" /> Subjects</div></div>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input className="cs-input" value={subjInput} onChange={(e) => setSubjInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubject()} placeholder="Add a subject (e.g. Mathematics)" style={{ flex: 1 }} />
            <button className="btn-primary" onClick={addSubject}><i className="fa-solid fa-plus" /> Add Subject</button>
          </div>
          <div className="cs-subj-wrap">
            {a.subjects.length === 0 ? <div style={{ color: 'var(--tm)', fontSize: 13 }}>No subjects yet.</div>
              : a.subjects.map((s) => (
                <span className="cs-subj-chip" key={s.id}>
                  <i className="fa-solid fa-book-open" /> {s.name}
                  <button className="cs-chip-btn" title="Rename" onClick={() => setEditSubj({ id: s.id, name: s.name })}><i className="fa-solid fa-pen" /></button>
                  <button className="cs-chip-btn del" title="Remove" onClick={() => delSubject(s.id)}><i className="fa-solid fa-xmark" /></button>
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Classes + assigned subjects */}
      <div className="section-card">
        <div className="card-header">
          <div className="card-title"><i className="fa-solid fa-chalkboard" /> Classes &amp; Assigned Subjects</div>
          <button className="btn-primary" onClick={() => setClassModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Class</button>
        </div>
        <div style={{ padding: 18 }}>
          {a.classes.length === 0 ? <div style={{ color: 'var(--tm)', fontSize: 13 }}>No classes yet. Click “Add Class”.</div>
            : a.classes.map((c) => {
              const subs = subjectsOfClass(a, c.id)
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
                  <button className="btn-secondary" onClick={() => setAssignModal({ classId: c.id, name: c.name, selected: a.classSubjects[c.id] || [] })}><i className="fa-solid fa-list-check" /> Assign</button>
                  <button className="btn-sm" style={{ height: 36 }} onClick={() => setClassModal({ mode: 'edit', cls: c })}><i className="fa-solid fa-pen" /></button>
                  <button className="btn-sm" style={{ height: 36, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(c)}><i className="fa-solid fa-trash-can" /></button>
                </div>
              )
            })}
        </div>
      </div>

      {editSubj && <SmallModal title="Rename Subject" icon="fa-book" onClose={() => setEditSubj(null)} onSave={saveSubjectEdit}>
        <input className="cs-input" value={editSubj.name} onChange={(e) => setEditSubj((s) => ({ ...s, name: e.target.value }))} style={{ width: '100%' }} autoFocus />
      </SmallModal>}
      {classModal && <ClassModal modal={classModal} onClose={() => setClassModal(null)} onSave={saveClass} onToast={fire} />}
      {assignModal && <AssignModal modal={assignModal} subjects={a.subjects} onClose={() => setAssignModal(null)} onSave={saveAssign} />}
      {del && <Confirm name={del.name} onClose={() => setDel(null)} onConfirm={doDelClass} />}

      {toast && createPortal(<div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>, document.body)}
    </div>
  )
}

function ClassModal({ modal, onClose, onSave, onToast }) {
  const [name, setName] = useState(modal.cls?.name || '')
  const save = () => { if (!name.trim()) return onToast('Enter a class name', 'warn'); onSave(name.trim(), modal.cls?.id) }
  return <SmallModal title={modal.cls ? 'Edit Class' : 'Add Class'} icon="fa-chalkboard" onClose={onClose} onSave={save}>
    <label className="cs-lbl">Class Name</label>
    <input className="cs-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 6" style={{ width: '100%' }} autoFocus />
  </SmallModal>
}

function AssignModal({ modal, subjects, onClose, onSave }) {
  const [sel, setSel] = useState(new Set(modal.selected))
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return <SmallModal title={`Assign Subjects — ${modal.name}`} icon="fa-list-check" onClose={onClose} onSave={() => onSave(modal.classId, [...sel])} wide saveLabel="Save Assignment">
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

function SmallModal({ title, icon, wide, saveLabel, children, onClose, onSave }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: wide ? 560 : 440 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av"><i className={`fa-solid ${icon}`} /></div>
          <div><div className="pay-modal-title">{title}</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">{children}</div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={onSave}><i className="fa-solid fa-floppy-disk" /> {saveLabel || 'Save'}</button></div>
      </div>
    </div>,
    document.body,
  )
}

function Confirm({ name, onClose, onConfirm }) {
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">Delete Class?</div>
          <div className="confirm-sub">“{name}” and its subject assignments will be removed.</div>
          <div className="confirm-btns"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button></div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
