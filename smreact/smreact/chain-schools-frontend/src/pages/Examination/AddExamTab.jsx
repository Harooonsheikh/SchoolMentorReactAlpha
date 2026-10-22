import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { newId, examClasses, examSession, examStatus, calcDuration, fmtDate } from './examStore'
import { fetchExams, saveExam as apiSaveExam, deleteExam as apiDeleteExam } from '../../api/examinationApi'
import { exportReport } from '../Academics/reportEngine'
import SpinnerButton from '../../components/SpinnerButton'
import ExamConfirm from './ExamConfirm'

/* ═══════════════════════════════════════════════════════════════════
   Add Exam — ERP Exam Setup port: a term-pill selector, an action bar
   (Add Exam + PDF/Word), and a status-badged exam table whose rows
   expand to show class/duration/date tiles. The Add/Edit modal uses a
   class multi-select (tags + searchable dropdown).
   ═══════════════════════════════════════════════════════════════════ */
const off = { opacity: .45, cursor: 'not-allowed' }

export default function AddExamTab({ store, commit, flash, canCreate = true, canEdit = true, canDelete = true, canDownload = true }) {
  const classes = examClasses()
  const session = examSession()
  const [termId, setTermId] = useState(store.terms[0]?.id || null)
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null) // exam object or {} for new
  const [del, setDel] = useState(null)
  const [loading, setLoading] = useState(true) // initial server fetch

  useEffect(() => {
    if (!store.terms.find((t) => t.id === termId)) setTermId(store.terms[0]?.id || null)
  }, [store.terms, termId])

  /* Server se exams lao (addexamcrud · get → per-class rows, group hoke aate
     hain). termID server id hoti hai — local term se serverId par match karke
     local termId par le aate hain. classIds ko local class id par map. Mila to
     store ko unhi se bharo; API band/empty ho to local par chalti rahe. */
  useEffect(() => {
    let alive = true
    fetchExams()
      .then((list) => {
        if (!alive || !list.length) return
        const toLocalClass = (cid) => classes.find((c) => String(c.id) === String(cid))?.id ?? cid
        const mapped = list.map((ex) => {
          const t = store.terms.find((x) => String(x.serverId) === String(ex.termId))
          return { id: newId(), examId: ex.examId, name: ex.name, from: ex.from, to: ex.to, classIds: (ex.classIds || []).map(toLocalClass), termId: t ? t.id : ex.termId, serverIds: ex.serverIds }
        })
        commit({ ...store, exams: mapped })
      })
      .catch(() => { /* backend empty/SP → local fallback */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // sirf mount par
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const term = store.terms.find((t) => t.id === termId) || null
  const list = useMemo(() => store.exams.filter((e) => e.termId === termId), [store.exams, termId])
  const classNames = (ids) => classes.filter((c) => (ids || []).includes(c.id)).map((c) => c.name)

  const saveExam = async (data) => {
    const t = store.terms.find((x) => x.id === termId) || {}
    const existing = data.id ? store.exams.find((e) => e.id === data.id) : null
    /* Server par save: removed classes delete + baqi insert/update. API band
       ho to sirf local save; kuch server op fail ho to user ko toast me batao. */
    let serverIds = existing?.serverIds || {}
    let failed = 0
    let lastErr = ''
    try {
      const r = await apiSaveExam(
        { name: data.name, from: data.from, to: data.to, classIds: data.classIds, termId: t.serverId || t.id, serverIds, examId: existing?.examId },
        { id: t.serverId || t.id, name: t.name },
      )
      serverIds = r.serverIds
      failed = r.failed
      lastErr = r.lastErr
    } catch (e) { failed = 1; lastErr = e?.message || 'save failed' }
    const exams = data.id
      ? store.exams.map((e) => (e.id === data.id ? { ...e, ...data, serverIds } : e))
      : [...store.exams, { ...data, id: newId(), termId, serverIds }]
    commit({ ...store, exams })
    setEditing(null)
    if (failed > 0) flash(`Saved locally — ${failed} server op(s) failed: ${lastErr}`, 'error')
    else flash(data.id ? 'Exam updated' : 'Exam added')
  }

  const doDel = async () => {
    const ex = store.exams.find((e) => e.id === del.id)
    /* server par maujood exam (serverIds hain) → pehle API se delete karo;
       fail ho to local se mat hatao warna refresh par wapas aa jaye ga. Sirf
       local exam (koi serverId nahi) → seedha local se hata do. */
    const hasServer = ex && (Number(ex.examId) > 0 || Object.values(ex.serverIds || {}).some((r) => Number(r) > 0))
    if (ex && hasServer) {
      try { await apiDeleteExam(ex) }
      catch (e) { flash(e?.message || 'Could not delete exam on server', 'error'); setDel(null); return }
    }
    commit({ ...store, exams: store.exams.filter((e) => e.id !== del.id) })
    setDel(null)
    flash('Exam deleted', 'success')
  }

  const period = session.academicYear ? `Academic Year ${session.academicYear}` : ''
  const C = (label, a) => ({ label, a: a || 'l' })
  const pdf = (scope, fmt) => {
    const rows = (scope === 'all' ? list : [scope]).map((e, i) => [i + 1, e.name, classNames(e.classIds).join(', ') || '—', fmtDate(e.from), fmtDate(e.to), examStatus(e).label])
    const report = {
      title: scope === 'all' ? `Exams — ${term?.name || ''}` : scope.name,
      period,
      filters: [['Term', term?.name || '—'], ['Exams', String(scope === 'all' ? list.length : 1)]],
      sections: [{ columns: [C('#', 'c'), C('Exam Name'), C('Classes'), C('Start'), C('End'), C('Status', 'c')], rows }],
    }
    exportReport(report, fmt, flash, false)
  }

  return (
    <>
      {store.terms.length === 0 ? (
        <div className="exm-empty">
          <div className="exm-empty-icon"><i className="fa-solid fa-layer-group" /></div>
          <h3>No terms yet</h3>
          <p>Add academic terms in the <strong>Add Term</strong> tab first — exams are created inside a term.</p>
        </div>
      ) : (
        <>
          <div className="exm-term-chips">
            {store.terms.map((t) => (
              <button key={t.id} className={`exm-term-chip${termId === t.id ? ' on' : ''}`} onClick={() => { setTermId(t.id); setOpenId(null) }}>{t.name || 'Untitled term'}</button>
            ))}
          </div>

          <div className="exm-action-bar">
            <button className="exm-add-btn" disabled={!canCreate} style={!canCreate ? off : undefined} onClick={() => { if (canCreate) setEditing({ name: '', classIds: [], from: '', to: '' }) }}><i className="fa-solid fa-plus" /> Add Exam</button>
            {list.length > 0 && canDownload && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="exm-export pdf" onClick={() => pdf('all', 'pdf')}><i className="fa-solid fa-file-pdf" /> PDF</button>
                <button className="exm-export word" onClick={() => pdf('all', 'word')}><i className="fa-brands fa-microsoft" /> Word</button>
              </div>
            )}
          </div>

          <div className="exm-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="exm-ex-head">
              <div className="exm-ex-th">S. No.</div>
              <div className="exm-ex-th">Exam Name</div>
              <div className="exm-ex-th" style={{ textAlign: 'center' }}>Status</div>
              <div className="exm-ex-th" />
              <div className="exm-ex-th" />
              <div className="exm-ex-th" style={{ textAlign: 'right' }}>Detail</div>
            </div>

            {loading ? (
              <div className="exm-empty-inline" style={{ padding: 28, textAlign: 'center' }}><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading exams…</div>
            ) : list.length === 0 ? (
              <div className="exm-empty-inline" style={{ padding: 28, textAlign: 'center' }}>No exams in this term yet. Click <strong>+ Add Exam</strong> to create one.</div>
            ) : list.map((ex, i) => {
              const st = examStatus(ex)
              const open = openId === ex.id
              return (
                <div key={ex.id} className="exm-ex-row-wrap">
                  <div className={`exm-ex-row${open ? ' open' : ''}`} onClick={() => setOpenId(open ? null : ex.id)}>
                    <div className="exm-ex-td exm-ex-sno"><span style={{ color: 'var(--text-muted)' }}>#</span>&nbsp;{i + 1}</div>
                    <div className="exm-ex-td exm-ex-name">
                      <div className="exm-ex-name-ic"><i className="fa-solid fa-file-pen" /></div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{ex.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{(ex.classIds || []).length} Class{(ex.classIds || []).length !== 1 ? 'es' : ''} · {fmtDate(ex.from)} – {fmtDate(ex.to)}</div>
                      </div>
                    </div>
                    <div className="exm-ex-td" style={{ justifyContent: 'center' }}>
                      <span className={`exm-ex-badge ${st.cls}`}><i className={`fa-solid ${st.icon}`} /> {st.label}</span>
                    </div>
                    <div className="exm-ex-td" onClick={(e) => e.stopPropagation()}>
                      <button className="exm-ex-edit" disabled={!canEdit} style={!canEdit ? off : undefined} onClick={() => { if (canEdit) setEditing({ ...ex }) }}><i className="fa-solid fa-pen-to-square" /> Edit</button>
                    </div>
                    <div className="exm-ex-td" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      {canDownload && <button className="exm-export pdf" title={`PDF for ${ex.name}`} onClick={() => pdf(ex, 'pdf')}><i className="fa-solid fa-file-pdf" /> PDF</button>}
                      {canDownload && <button className="exm-export word" title={`Word for ${ex.name}`} onClick={() => pdf(ex, 'word')}><i className="fa-brands fa-microsoft" /> Word</button>}
                    </div>
                    <div className="exm-ex-td" style={{ justifyContent: 'flex-end', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <button className="exm-ex-del" title={canDelete ? 'Delete exam' : 'No delete permission'} disabled={!canDelete} style={!canDelete ? off : undefined} onClick={() => { if (canDelete) setDel(ex) }}><i className="fa-solid fa-trash" /></button>
                      <button className={`exm-ex-expand${open ? ' open' : ''}`} title={open ? 'Hide details' : 'Show details'} onClick={(e) => { e.stopPropagation(); setOpenId(open ? null : ex.id) }}><i className="fa-solid fa-chevron-down" /></button>
                    </div>
                  </div>

                  <div className={`exm-ex-detail${open ? ' open' : ''}`} style={{ maxHeight: open ? 420 : 0 }}>
                    <div className="exm-ex-detail-in">
                      <div className="exm-ex-drow-top">
                        <div className="exm-ex-ditem">
                          <div className="exm-ex-dicon" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}><i className="fa-solid fa-file-pen" /></div>
                          <div><div className="exm-ex-dlabel">Exam Name</div><div className="exm-ex-dval">{ex.name}</div></div>
                        </div>
                        <div className="exm-ex-ditem">
                          <div className="exm-ex-dicon" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}><i className="fa-solid fa-users-rectangle" /></div>
                          <div>
                            <div className="exm-ex-dlabel">Classes ({(ex.classIds || []).length})</div>
                            <div className="exm-ex-dval" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              {classNames(ex.classIds).length ? classNames(ex.classIds).map((n, k) => <span key={k} className="exm-ex-class-pill">{n}</span>) : <span style={{ color: 'var(--text-muted)' }}>No classes</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="exm-ex-drow-bot">
                        <div className="exm-ex-ditem">
                          <div className="exm-ex-dicon" style={{ background: 'rgba(124,58,237,.1)', color: '#7C3AED' }}><i className="fa-solid fa-hourglass-half" /></div>
                          <div><div className="exm-ex-dlabel">Duration</div><div className="exm-ex-dval">{calcDuration(ex.from, ex.to)}</div></div>
                        </div>
                        <div className="exm-ex-ditem">
                          <div className="exm-ex-dicon" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}><i className="fa-regular fa-calendar-plus" /></div>
                          <div><div className="exm-ex-dlabel">Start Date</div><div className="exm-ex-dval">{fmtDate(ex.from)}</div></div>
                        </div>
                        <div className="exm-ex-ditem">
                          <div className="exm-ex-dicon" style={{ background: 'rgba(220,38,38,.08)', color: '#DC2626' }}><i className="fa-regular fa-calendar-xmark" /></div>
                          <div><div className="exm-ex-dlabel">End Date</div><div className="exm-ex-dval">{fmtDate(ex.to)}</div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {editing && <ExamModal data={editing} classes={classes} session={session} onClose={() => setEditing(null)} onSave={saveExam} flash={flash} />}
      {del && <ExamConfirm title="Delete Exam?" body={`“${del.name || 'this exam'}” will be permanently removed.`} onCancel={() => setDel(null)} onConfirm={doDel} />}
    </>
  )
}

/* ── Add / Edit Exam modal (class multi-select + name + dates) ── */
function ExamModal({ data, classes, session, onClose, onSave, flash }) {
  const isEdit = !!data.id
  const [name, setName] = useState(data.name || '')
  const [selected, setSelected] = useState(data.classIds || [])
  const [from, setFrom] = useState(data.from || '')
  const [to, setTo] = useState(data.to || '')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [onClose])

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const opts = classes.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
  const chosen = classes.filter((c) => selected.includes(c.id))

  const submit = () => {
    if (!name.trim()) return flash('Exam name is required', 'error')
    if (!selected.length) return flash('Select at least one class', 'error')
    if (from && to && to < from) return flash('End date cannot be before the start date', 'error')
    return onSave({ ...(isEdit ? { id: data.id } : {}), name: name.trim(), classIds: selected, from, to })
  }

  return createPortal(
    <div className="exm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="exm-modal" role="dialog" aria-modal="true">
        <div className="exm-modal-hdr">
          <div className="exm-modal-icon"><i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-plus'}`} /></div>
          <div className="exm-modal-titles">
            <h2>{isEdit ? 'Edit Exam' : 'Add Exam'}</h2>
            <p>{isEdit ? 'Update exam details' : 'Create a new examination for selected classes'}{session.academicYear ? ` · ${session.academicYear}` : ''}</p>
          </div>
          <button className="exm-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="exm-modal-body">
          <div className="exm-grid">
            <div className="exm-field" style={{ position: 'relative' }}>
              <span className="exm-lbl">Select classes <b>*</b> <em>{selected.length} selected</em></span>
              <div className="exm-cls-wrap" ref={wrapRef} onClick={() => { setOpen(true); inputRef.current?.focus() }}>
                {chosen.map((c) => (
                  <span key={c.id} className="exm-cls-tag">{c.name}<button type="button" className="exm-cls-tag-x" onClick={(e) => { e.stopPropagation(); toggle(c.id) }}><i className="fa-solid fa-xmark" /></button></span>
                ))}
                <input ref={inputRef} className="exm-cls-input" value={search} placeholder={chosen.length ? '' : 'Search classes…'} onChange={(e) => { setSearch(e.target.value); setOpen(true) }} />
              </div>
              <div className={`exm-cls-drop${open ? ' open' : ''}`}>
                {classes.length === 0 ? <div className="exm-cls-opt" style={{ color: 'var(--text-muted)', cursor: 'default' }}>No classes set up in Academics yet.</div>
                  : opts.length === 0 ? <div className="exm-cls-opt" style={{ color: 'var(--text-muted)', cursor: 'default' }}>No matches</div>
                    : opts.map((c) => (
                      <div key={c.id} className={`exm-cls-opt${selected.includes(c.id) ? ' on' : ''}`} onMouseDown={(e) => { e.preventDefault(); toggle(c.id) }}>
                        <i className={`fa-solid fa-check`} style={{ opacity: selected.includes(c.id) ? 1 : 0 }} /> {c.name}
                      </div>
                    ))}
              </div>
            </div>

            <label className="exm-field">
              <span className="exm-lbl">Exam name <b>*</b></span>
              <input className="exm-input" value={name} placeholder="e.g. 1st Term Exam" maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="exm-field">
              <span className="exm-lbl">Start date</span>
              <input type="date" className="exm-input" value={from} onChange={(e) => { setFrom(e.target.value); if (to && e.target.value && to < e.target.value) setTo('') }} />
            </label>

            <label className="exm-field">
              <span className="exm-lbl">End date</span>
              <input type="date" className="exm-input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="exm-modal-foot">
          <span />
          <div className="exm-foot-btns">
            <button type="button" className="exm-btn ghost" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
            <SpinnerButton className="exm-btn primary" icon="fa-check" onClick={submit}>{isEdit ? 'Save' : 'Submit'}</SpinnerButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
