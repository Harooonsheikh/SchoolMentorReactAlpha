import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { examSession, unitsOf } from './examStore'
import { exportReport } from '../Academics/reportEngine'
import { fetchTermBreakupUnits, saveTermBreakup, deleteTermBreakupDetails } from '../../api/examinationApi'
import { fetchNetworkAcademics, currentNetworkId } from '../../api/academicsSetupApi'
import SpinnerButton from '../../components/SpinnerButton'

/* ═══════════════════════════════════════════════════════════════════
   Term Breakup — opened from the Add Term tab. Mirrors the Academics
   module's Term Breakup: a class card list whose rows expand to a
   term-pill + subject-pill selector and a units/topics view, plus an
   "Update" modal to edit units & topics per term and subject.

   Terms come from this module's Add Term tab (store.terms). Classes
   (grades) & subjects aa rahe hain NETWORK API se — asli IDs ke saath:
     GET /api/LaunchSetup/get-grades-by-network/{networkId}          → grade name + asli gradeID
     GET /api/LaunchSetup/get-subjects-by-network-grade/{nid}/{gid}  → subject name + asli subjectID
   Yahi asli classID (gradeID) aur subjectID term-breakup API ko jati hain.
   The breakup persists on the Chain Management API (gettermbreakups /
   lptermbreakupcrud / lptermbreakupdetailscrud — Academics/ERP jaisa,
   network level) via examinationApi.js, with the examination store
   (store.termBreakups) as a local-first cache/fallback.
   ═══════════════════════════════════════════════════════════════════ */
export default function TermBreakup({ store, commit, flash, onBack }) {
  const session = examSession()
  const networkId = currentNetworkId()
  const [classes, setClasses] = useState([])   // asli grades: [{ id (gradeID), name }]
  const [subjMap, setSubjMap] = useState({})    // { gradeID: [{ id (subjectID), name }] }
  const [loadingCls, setLoadingCls] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [termId, setTermId] = useState(store.terms[0]?.id || null)
  const [subjectId, setSubjectId] = useState(null)
  const [edit, setEdit] = useState(null)

  const subjectsOf = (classId) => subjMap[classId] || []

  /* Network ki asli classes (grades) + har class ke subjects — ek saath
     (get-grades-by-network + get-subjects-by-network-grade). IDs asli hain
     (gradeID / subjectID), isi liye yahi term-breakup API ko pass hoti hain. */
  useEffect(() => {
    let alive = true
    setLoadingCls(true)
    fetchNetworkAcademics(networkId)
      .then(({ classes: cls, subjectRows }) => {
        if (!alive) return
        const m = {}
        for (const s of subjectRows) { (m[s.classId] = m[s.classId] || []).push({ id: s.id, name: s.name }) }
        setClasses(cls)
        setSubjMap(m)
      })
      .catch(() => { if (alive) { setClasses([]); setSubjMap({}) } })
      .finally(() => { if (alive) setLoadingCls(false) })
    return () => { alive = false }
  }, [networkId])

  /* Jab koi class khuli ho aur term+subject chuna ho, us combo ke units API
     se laa kar local store me merge kar do (har combo sirf ek dafa). API fail
     ya khaali ho to local hi dikhta rahe. */
  const loadedRef = useRef(new Set())
  useEffect(() => {
    if (!openId || !termId || !subjectId) return
    const key = `${openId}__${termId}__${subjectId}`
    if (loadedRef.current.has(key)) return
    loadedRef.current.add(key)
    let alive = true
    fetchTermBreakupUnits({ classId: Number(openId), termId: Number(termId), subjectId: Number(subjectId) })
      .then(({ units }) => {
        if (!alive || !units || !units.length) return
        commit({
          ...store,
          termBreakups: {
            ...(store.termBreakups || {}),
            [openId]: {
              ...(store.termBreakups?.[openId] || {}),
              [termId]: { ...(store.termBreakups?.[openId]?.[termId] || {}), [subjectId]: units },
            },
          },
        })
      })
      .catch(() => { /* local-first: API fail → local hi dikhe */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, termId, subjectId])

  const openClass = (c) => {
    if (openId === c.id) { setOpenId(null); return }
    setOpenId(c.id)
    setTermId(store.terms[0]?.id || null)
    setSubjectId(subjectsOf(c.id)[0]?.id || null)
  }

  const classReport = (c) => ({
    title: `Term Breakup — ${c.name}`,
    period: session.academicYear ? `Academic Year ${session.academicYear}` : '',
    filters: [['Class', c.name], ['Terms', String(store.terms.length)], ['Subjects', String(subjectsOf(c.id).length)]],
    sections: store.terms.map((t) => {
      const rows = []
      subjectsOf(c.id).forEach((s) => unitsOf(store, c.id, t.id, s.id).forEach((u) => u.topics.forEach((tp, ti) => rows.push([ti === 0 ? s.name : '', ti === 0 ? u.unitNum : '', ti === 0 ? u.unitName : '', ti === 0 ? u.weeks : '', tp.topic, tp.periods]))))
      return { title: t.name || 'Untitled term', columns: [{ label: 'Subject', a: 'l' }, { label: 'Unit #', a: 'c' }, { label: 'Unit Name', a: 'l' }, { label: 'Weeks', a: 'c' }, { label: 'Topic', a: 'l' }, { label: 'Periods', a: 'c' }], rows, totals: null }
    }),
  })

  const saveBreakup = async (classId, wb) => {
    /* Pehle local save (fallback), phir API par har term+subject jo wb me hai. */
    commit({ ...store, termBreakups: { ...(store.termBreakups || {}), [classId]: wb } })
    setEdit(null)
    let failed = 0
    /* Sirf is class ke CURRENT (real) subjects hi API ko jayein — purane/stale
       local-ID keys (agar localStorage me reh gaye) skip, warna ghalat subjectID jati. */
    const validSubjIds = new Set(subjectsOf(Number(classId)).map((s) => String(s.id)))
    for (const [tId, subs] of Object.entries(wb)) {
      for (const [sId, units] of Object.entries(subs)) {
        if (!validSubjIds.has(String(sId))) continue
        if (!Number(classId) || !Number(sId) || !Number(tId)) continue
        try {
          await saveTermBreakup({ classId: Number(classId), termId: Number(tId), subjectId: Number(sId), units })
        } catch { failed += 1 }
      }
    }
    /* API combo fail hone par bhi local save ho chuka — sync pending ka soft note. */
    loadedRef.current.clear()
    flash(failed ? 'Term breakup saved locally — server sync pending' : 'Term breakup saved', failed ? 'error' : 'success')
  }

  return (
    <div className="exm-panel">
      <div className="exm-panel-hdr">
        <h2><i className="fa-solid fa-table-list" /> Term Breakup</h2>
        {onBack && <button className="exm-btn ghost sm" onClick={onBack}><i className="fa-solid fa-arrow-left" /> Back to Terms</button>}
      </div>
      <div className="exm-note">
        <i className="fa-solid fa-circle-info" />
        <span>Break each term&rsquo;s syllabus into units &amp; topics, class-wise and subject-wise. Terms come from the <strong>Add Term</strong> tab; classes &amp; subjects come from the <strong>network setup</strong>.</span>
      </div>

      {store.terms.length === 0 ? (
        <div className="exm-empty">
          <div className="exm-empty-icon"><i className="fa-solid fa-layer-group" /></div>
          <h3>No terms yet</h3>
          <p>Add academic terms in the <strong>Add Term</strong> tab first — the breakup is organised term by term.</p>
        </div>
      ) : loadingCls ? (
        <div className="exm-empty">
          <div className="exm-empty-icon"><i className="fa-solid fa-spinner fa-spin" /></div>
          <h3>Loading classes…</h3>
          <p>Fetching network grades &amp; subjects.</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="exm-empty">
          <div className="exm-empty-icon"><i className="fa-solid fa-chalkboard-user" /></div>
          <h3>No classes defined</h3>
          <p>Set up classes &amp; subjects in the network&rsquo;s academic setup first.</p>
        </div>
      ) : classes.map((c) => {
        const subjects = subjectsOf(c.id)
        const open = openId === c.id
        return (
          <div className="exm-tb-card" key={c.id}>
            <div className="exm-tb-head" onClick={() => openClass(c)}>
              <div className="exm-tb-ic"><i className="fa-solid fa-chalkboard-user" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="exm-tb-name">{c.name}</div>
                <div className="exm-tb-sub">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</div>
              </div>
              <button className="exm-export pdf" onClick={(e) => { e.stopPropagation(); exportReport(classReport(c), 'pdf', flash) }}><i className="fa-solid fa-file-pdf" /> PDF</button>
              <button className="exm-export word" onClick={(e) => { e.stopPropagation(); exportReport(classReport(c), 'word', flash) }}><i className="fa-brands fa-microsoft" /> Word</button>
              <button className="exm-ex-edit" onClick={(e) => { e.stopPropagation(); setEdit(c) }}><i className="fa-solid fa-pen" /> Update</button>
              <button className={`exm-ex-expand${open ? ' open' : ''}`} title={open ? 'Hide details' : 'Show details'} onClick={(e) => { e.stopPropagation(); openClass(c) }}><i className="fa-solid fa-chevron-down" /></button>
            </div>
            {open && (
              <div className="exm-tb-body">
                <div className="exm-term-chips">
                  {store.terms.map((t) => <button key={t.id} className={`exm-term-chip${termId === t.id ? ' on' : ''}`} onClick={() => setTermId(t.id)}>{t.name || 'Untitled term'}</button>)}
                </div>
                <div className="exm-term-chips">
                  {subjects.length === 0 ? <span className="exm-tb-sub">No subjects assigned to this class.</span>
                    : subjects.map((s) => <button key={s.id} className={`exm-term-chip exm-tb-subj${subjectId === s.id ? ' on' : ''}`} onClick={() => setSubjectId(s.id)}>{s.name}</button>)}
                </div>
                {(() => {
                  const units = unitsOf(store, c.id, termId, subjectId)
                  if (!units.length) return <div className="exm-tb-none"><i className="fa-solid fa-layer-group" />No units added yet. Click <strong>Update</strong> to add.</div>
                  return units.map((u, ui) => (
                    <div className="exm-tb-unit" key={ui}>
                      <div className="exm-tb-unit-hd"><span className="exm-tb-unit-title">Unit {u.unitNum} — {u.unitName}</span><span className="exm-tb-unit-meta">{u.weeks} week(s) · {u.topics.length} topic(s)</span></div>
                      <table className="exm-tb-utable">
                        <thead><tr><th className="c" style={{ width: 60 }}>S/No</th><th>Topic / Sub-topic</th><th className="c" style={{ width: 110 }}>Periods</th></tr></thead>
                        <tbody>{u.topics.map((tp, ti) => <tr key={ti}><td className="c" style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{ti + 1}</td><td>{tp.topic}</td><td className="c" style={{ fontWeight: 700 }}>{tp.periods}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ))
                })()}
              </div>
            )}
          </div>
        )
      })}

      {edit && <BreakupModal cls={edit} subjects={subjectsOf(edit.id)} store={store} session={session} flash={flash} onClose={() => setEdit(null)} onSave={(wb) => saveBreakup(edit.id, wb)} />}
    </div>
  )
}

/* ── Update modal: term tabs + subject tabs + units/topics editor ── */
function BreakupModal({ cls, subjects = [], store, session, flash, onClose, onSave }) {
  const [mTerm, setMTerm] = useState(store.terms[0]?.id || null)
  const [mSubj, setMSubj] = useState(subjects[0]?.id || null)
  const [wb, setWb] = useState(() => JSON.parse(JSON.stringify(store.termBreakups?.[cls.id] || {})))

  /* Jis term+subject par aao, us ke units API se laa kar wb me daal do (har
     combo sirf ek dafa). Khaali/fail par local seed (store) hi rehta hai. */
  const mLoaded = useRef(new Set())
  useEffect(() => {
    if (!mTerm || !mSubj) return
    const key = `${mTerm}__${mSubj}`
    if (mLoaded.current.has(key)) return
    mLoaded.current.add(key)
    let alive = true
    fetchTermBreakupUnits({ classId: Number(cls.id), termId: Number(mTerm), subjectId: Number(mSubj) })
      .then(({ units: apiUnits }) => {
        if (!alive || !apiUnits || !apiUnits.length) return
        setWb((w) => ({ ...w, [mTerm]: { ...(w[mTerm] || {}), [mSubj]: apiUnits } }))
      })
      .catch(() => { /* local-first */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mTerm, mSubj])

  const units = wb[mTerm]?.[mSubj] || []
  const setUnits = (next) => setWb((w) => ({ ...w, [mTerm]: { ...(w[mTerm] || {}), [mSubj]: next } }))
  const addUnit = () => setUnits([...units, { unitNum: String(units.length + 1), unitName: '', weeks: '0', topics: [{ topic: '', periods: '0' }] }])
  const setUnit = (ui, k, val) => setUnits(units.map((u, i) => (i === ui ? { ...u, [k]: val } : u)))
  const rmUnit = (ui) => setUnits(units.filter((_, i) => i !== ui))
  const addTopic = (ui) => setUnits(units.map((u, i) => (i === ui ? { ...u, topics: [...u.topics, { topic: '', periods: '0' }] } : u)))
  const setTopic = (ui, ti, k, val) => setUnits(units.map((u, i) => (i === ui ? { ...u, topics: u.topics.map((t, j) => (j === ti ? { ...t, [k]: val } : t)) } : u)))
  const rmTopic = (ui, ti) => setUnits(units.map((u, i) => (i === ui ? { ...u, topics: u.topics.filter((_, j) => j !== ti) } : u)))

  /* Server se delete (lptermbreakupdetailscrud action:'delete'), phir local remove.
     Jo row server par thi (detailId) sirf us ki API delete jati hai; sirf-local
     (abhi tak save nahi hui) row ho to seedha local remove. */
  const delTopic = async (ui, ti) => {
    const t = units[ui]?.topics?.[ti]
    if (t?.detailId) {
      try { await deleteTermBreakupDetails({ classId: cls.id, subjectId: mSubj, termId: mTerm, detailIds: [t.detailId] }); flash?.('Topic deleted') }
      catch { flash?.('Could not delete on server — removed locally', 'error') }
    }
    rmTopic(ui, ti)
  }
  const delUnit = async (ui) => {
    const ids = (units[ui]?.topics || []).map((t) => t.detailId).filter(Boolean)
    if (ids.length) {
      try { await deleteTermBreakupDetails({ classId: cls.id, subjectId: mSubj, termId: mTerm, detailIds: ids }); flash?.('Unit deleted') }
      catch { flash?.('Could not delete on server — removed locally', 'error') }
    }
    rmUnit(ui)
  }

  const save = () => {
    /* strip empty units/topics so the view & reports stay clean */
    const clean = {}
    Object.entries(wb).forEach(([tid, subs]) => {
      Object.entries(subs).forEach(([sid, us]) => {
        const u2 = us.map((u) => ({ ...u, topics: u.topics.filter((t) => t.topic.trim()) })).filter((u) => u.unitName.trim())
        if (u2.length) { clean[tid] = clean[tid] || {}; clean[tid][sid] = u2 }
      })
    })
    onSave(clean)
  }

  return createPortal(
    <div className="exm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="exm-modal" role="dialog" aria-modal="true">
        <div className="exm-modal-hdr">
          <div className="exm-modal-icon"><i className="fa-solid fa-table-list" /></div>
          <div className="exm-modal-titles">
            <h2>Term Breakup — {cls.name}</h2>
            <p>Edit units &amp; topics per term and subject{session.academicYear ? ` · ${session.academicYear}` : ''}</p>
          </div>
          <button className="exm-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="exm-modal-body">
          <div className="exm-term-chips" style={{ marginBottom: 0 }}>
            {store.terms.map((t) => <button key={t.id} className={`exm-term-chip${mTerm === t.id ? ' on' : ''}`} onClick={() => setMTerm(t.id)}>{t.name || 'Untitled term'}</button>)}
          </div>
          <div className="exm-term-chips" style={{ marginBottom: 0 }}>
            {subjects.length === 0 ? <span className="exm-tb-sub">No subjects assigned to this class.</span>
              : subjects.map((s) => <button key={s.id} className={`exm-term-chip exm-tb-subj${mSubj === s.id ? ' on' : ''}`} onClick={() => setMSubj(s.id)}>{s.name}</button>)}
          </div>

          {units.length === 0 ? <div className="exm-tb-none" style={{ padding: 16 }}>No units yet for this term &amp; subject.</div>
            : units.map((u, ui) => (
              <div className="exm-tb-ed-unit" key={ui}>
                <div className="exm-tb-ed-row">
                  <input className="exm-input" value={u.unitNum} onChange={(e) => setUnit(ui, 'unitNum', e.target.value)} placeholder="No." />
                  <input className="exm-input" value={u.unitName} onChange={(e) => setUnit(ui, 'unitName', e.target.value)} placeholder="Unit name" />
                  <input className="exm-input" value={u.weeks} onChange={(e) => setUnit(ui, 'weeks', e.target.value)} placeholder="Weeks" />
                  <button className="exm-icon-btn danger" style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,.35)' }} title="Remove unit" onClick={() => delUnit(ui)}><i className="fa-solid fa-trash-can" /></button>
                </div>
                <div className="exm-tb-ed-lbl">Topics</div>
                {u.topics.map((tp, ti) => (
                  <div className="exm-tb-ed-topic" key={ti}>
                    <input className="exm-input" value={tp.topic} onChange={(e) => setTopic(ui, ti, 'topic', e.target.value)} placeholder="Topic / sub-topic" />
                    <input className="exm-input" value={tp.periods} onChange={(e) => setTopic(ui, ti, 'periods', e.target.value)} placeholder="Periods" />
                    <button className="exm-icon-btn danger" style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,.35)' }} title="Remove topic" onClick={() => delTopic(ui, ti)}><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
                <button className="exm-btn sm" style={{ marginTop: 4 }} onClick={() => addTopic(ui)}><i className="fa-solid fa-plus" /> Add Topic</button>
              </div>
            ))}

          <button className="exm-btn primary" onClick={addUnit} disabled={!mTerm || !mSubj}><i className="fa-solid fa-plus" /> Add Unit</button>
        </div>

        <div className="exm-modal-foot">
          <span />
          <div className="exm-foot-btns">
            <button className="exm-btn ghost" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
            <SpinnerButton className="exm-btn primary" icon="fa-floppy-disk" onClick={save}>Save Breakup</SpinnerButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
