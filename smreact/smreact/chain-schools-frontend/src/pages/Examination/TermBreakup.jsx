import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { examSession, unitsOf } from './examStore'
import { exportReport } from '../Academics/reportEngine'
import { fetchTermBreakupUnits, saveTermBreakup, deleteTermBreakupDetails, updateTermBreakupWeeks } from '../../api/examinationApi'
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
export default function TermBreakup({ store, commit, flash, onBack, canCreate = true, canEdit = true, canDelete = true, canDownload = true }) {
  const session = examSession()
  const networkId = currentNetworkId()
  const [classes, setClasses] = useState([])   // asli grades: [{ id (gradeID), name }]
  const [subjMap, setSubjMap] = useState({})    // { gradeID: [{ id (subjectID), name }] }
  const [loadingCls, setLoadingCls] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [termId, setTermId] = useState(store.terms[0]?.id || null)
  const [subjectId, setSubjectId] = useState(null)
  const [edit, setEdit] = useState(null)
  /* Khuli class ke units HAMESHA API se — localStorage se nahi. */
  const [viewUnits, setViewUnits] = useState([])
  const [viewLoading, setViewLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

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

  /* Jab koi class khuli ho aur term+subject chuna ho, us combo ke units SIRF API
     se laa kar dikhao (localStorage/store se nahi). viewReqRef se race aur
     StrictMode-double-invoke dono safe — sirf latest request ka result lagta hai.
     refreshTick badalne par (modal band/save ke baad) dobara fetch hota hai.
     Export ke liye store bhi sync kar dete hain, magar display viewUnits se. */
  const viewReqRef = useRef(0)
  useEffect(() => {
    if (!openId || !termId || !subjectId) { setViewUnits([]); setViewLoading(false); return }
    const myReq = ++viewReqRef.current
    const c = openId, t = termId, s = subjectId
    setViewLoading(true)
    fetchTermBreakupUnits({ classId: Number(c), termId: Number(t), subjectId: Number(s) })
      .then(({ units }) => {
        if (viewReqRef.current !== myReq) return
        const list = units || []
        setViewUnits(list)
        commit({
          ...store,
          termBreakups: {
            ...(store.termBreakups || {}),
            [c]: { ...(store.termBreakups?.[c] || {}), [t]: { ...(store.termBreakups?.[c]?.[t] || {}), [s]: list } },
          },
        })
      })
      .catch(() => { if (viewReqRef.current === myReq) setViewUnits([]) })
      .finally(() => { if (viewReqRef.current === myReq) setViewLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, termId, subjectId, refreshTick])

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
    setRefreshTick((x) => x + 1)   // list ko server se dobara fetch karao
    flash(failed ? 'Term breakup saved locally — server sync pending' : 'Term breakup saved', failed ? 'error' : 'success')
  }

  /* Ek class+term+subject ka breakup foran persist (modal band kiye baghair) —
     per-unit save (pencil/floppy) ke liye. Local store me merge + API par save. */
  const persistCombo = async (classId, termId, subjectId, units) => {
    commit({
      ...store,
      termBreakups: {
        ...(store.termBreakups || {}),
        [classId]: {
          ...(store.termBreakups?.[classId] || {}),
          [termId]: { ...(store.termBreakups?.[classId]?.[termId] || {}), [subjectId]: units },
        },
      },
    })
    if (!Number(classId) || !Number(subjectId) || !Number(termId)) { flash('Saved locally', 'success'); return }
    try {
      await saveTermBreakup({ classId: Number(classId), termId: Number(termId), subjectId: Number(subjectId), units })
      setRefreshTick((x) => x + 1)   // list ko server se dobara fetch karao
      flash('Unit saved')
    } catch {
      flash('Saved locally — server sync pending', 'error')
    }
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
              <button className="exm-export pdf" disabled={!canDownload} title={!canDownload ? 'No permission to download' : undefined} style={!canDownload ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={(e) => { e.stopPropagation(); exportReport(classReport(c), 'pdf', flash) }}><i className="fa-solid fa-file-pdf" /> PDF</button>
              <button className="exm-export word" disabled={!canDownload} title={!canDownload ? 'No permission to download' : undefined} style={!canDownload ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={(e) => { e.stopPropagation(); exportReport(classReport(c), 'word', flash) }}><i className="fa-brands fa-microsoft" /> Word</button>
              <button className="exm-ex-edit" disabled={!(canCreate || canEdit || canDelete)} title={!(canCreate || canEdit || canDelete) ? 'No permission' : undefined} style={!(canCreate || canEdit || canDelete) ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={(e) => { e.stopPropagation(); setEdit(c) }}><i className="fa-solid fa-pen" /> Update</button>
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
                  if (viewLoading) return <div className="exm-tb-none"><i className="fa-solid fa-spinner fa-spin" /> Loading units…</div>
                  const units = viewUnits
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

      {edit && <BreakupModal cls={edit} subjects={subjectsOf(edit.id)} store={store} session={session} flash={flash} onClose={() => { setEdit(null); setRefreshTick((x) => x + 1) }} onSave={(wb) => saveBreakup(edit.id, wb)} onPersist={persistCombo} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />}
    </div>
  )
}

/* ── Update modal: term tabs + subject tabs + units/topics editor ── */
function BreakupModal({ cls, subjects = [], store, session, flash, onClose, onSave, onPersist, canCreate = true, canEdit = true, canDelete = true }) {
  const [mTerm, setMTerm] = useState(store.terms[0]?.id || null)
  const [mSubj, setMSubj] = useState(subjects[0]?.id || null)
  /* Units/topics HAMESHA API se — localStorage/store se seed nahi karte.
     Khaali se shuru; har term+subject ka data server se laate hain. */
  const [wb, setWb] = useState({})
  const [loadingKey, setLoadingKey] = useState(null)
  const [saving, setSaving] = useState(false)

  /* Jis term+subject par aao, us ke units sirf API se laa kar wb me daal do
     (har combo sirf ek dafa). Koi local fallback nahi — API jo de (khaali bhi)
     wahi final hai. */
  const mLoaded = useRef(new Set())
  useEffect(() => {
    if (!mTerm || !mSubj) return
    const key = `${mTerm}__${mSubj}`
    if (mLoaded.current.has(key)) return
    mLoaded.current.add(key)
    /* term+subject ko closure me capture karo (async resolve tak stable rahe).
       Note: koi `alive` cancel flag nahi — StrictMode ke double-invoke me cleanup
       usko false kar deta aur result + loading-clear discard ho jaate the. Har
       result apni hi key par likhta hai, is liye race ka masla nahi. */
    const t = mTerm, s = mSubj
    setLoadingKey(key)
    fetchTermBreakupUnits({ classId: Number(cls.id), termId: Number(t), subjectId: Number(s) })
      .then(({ units: apiUnits }) => {
        /* Server hi source of truth hai — jo aaye (khaali bhi) wahi dikhao. */
        setWb((w) => ({ ...w, [t]: { ...(w[t] || {}), [s]: apiUnits || [] } }))
      })
      .catch(() => {
        /* API error — koi localStorage fallback nahi; is combo ko khaali rakho. */
        setWb((w) => ({ ...w, [t]: { ...(w[t] || {}), [s]: [] } }))
      })
      .finally(() => { setLoadingKey((k) => (k === key ? null : k)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mTerm, mSubj])

  const units = wb[mTerm]?.[mSubj] || []
  const loading = loadingKey === `${mTerm}__${mSubj}`
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
    const u = units[ui]
    const t = u?.topics?.[ti]
    if (t?.detailId) {
      try {
        await deleteTermBreakupDetails({
          classId: cls.id, subjectId: mSubj, termId: mTerm,
          details: [{ detailId: t.detailId, unitNum: u.unitNum, unitName: u.unitName, weeks: u.weeks, topic: t.topic, periods: t.periods }],
        })
        flash?.('Topic deleted')
      }
      catch { flash?.('Could not delete on server — removed locally', 'error') }
    }
    /* Agar ye is unit ka aakhri topic tha to poora unit (row) hata do —
       sirf sub-topic row nahi. Warna sirf ye topic nikaalo (baaki topics rahen). */
    if ((u?.topics?.length || 0) <= 1) rmUnit(ui)
    else rmTopic(ui, ti)
  }
  const delUnit = async (ui) => {
    const u = units[ui]
    const details = (u?.topics || []).filter((t) => t.detailId).map((t) => ({ detailId: t.detailId, unitNum: u.unitNum, unitName: u.unitName, weeks: u.weeks, topic: t.topic, periods: t.periods }))
    if (details.length) {
      try { await deleteTermBreakupDetails({ classId: cls.id, subjectId: mSubj, termId: mTerm, details }); flash?.('Unit deleted') }
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

  /* Mojooda term+subject ka breakup foran persist (per-unit save — floppy).
     Save ke baad server se dobara laa kar wb update (taake detailId aa jaye —
     phir pencil se weeks update ho sake). Modal khula rehta hai. */
  const persistCurrent = async () => {
    if (!mTerm || !mSubj) return
    const cleanUnits = units
      .map((u) => ({ ...u, topics: (u.topics || []).filter((t) => String(t.topic || '').trim()) }))
      .filter((u) => String(u.unitName || '').trim())
    setSaving(true)
    try {
      await onPersist?.(cls.id, mTerm, mSubj, cleanUnits)
      try {
        const { units: fresh } = await fetchTermBreakupUnits({ classId: Number(cls.id), termId: Number(mTerm), subjectId: Number(mSubj) })
        if (fresh && fresh.length) setWb((w) => ({ ...w, [mTerm]: { ...(w[mTerm] || {}), [mSubj]: fresh } }))
      } catch { /* re-fetch fail — local hi rahe */ }
    } finally { setSaving(false) }
  }

  /* Pencil = Update weeks: unit pehle SAVE honi chahiye (koi topic ki detailId ho),
     warna "Save the unit first" toaster. Saved ho to SIRF weeks update —
     lptermbreakupdetailscrud action:'update' (full re-save nahi). */
  const updateWeeks = async (ui) => {
    const u = units[ui]
    if (!String(u?.unitName || '').trim()) { flash?.('Unit Name is required', 'error'); return }
    if (Number(u?.weeks) <= 0) { flash?.('Weeks Required must be greater than 0', 'error'); return }
    const saved = (u.topics || []).some((t) => Number(t.detailId) > 0)
    if (!saved) { flash?.('Save the unit first, then update weeks', 'error'); return }
    setSaving(true)
    try {
      await updateTermBreakupWeeks({ classId: Number(cls.id), termId: Number(mTerm), subjectId: Number(mSubj), unit: u })
      flash?.('Weeks required updated')
    } catch { flash?.('Could not update weeks — please try again', 'error') }
    finally { setSaving(false) }
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

          {loading ? <div className="exm-tb-none" style={{ padding: 16 }}><i className="fa-solid fa-spinner fa-spin" /> Loading units…</div>
            : units.length === 0 ? <div className="exm-tb-none" style={{ padding: 16 }}>No units yet for this term &amp; subject.</div>
            : units.map((u, ui) => {
              const unitReady = String(u.unitNum || '').trim() && String(u.unitName || '').trim() && Number(u.weeks) > 0
              return (
              <div className="tbm-unit-block" key={ui}>
                {/* Unit header: Unit Number / Unit Name / Weeks Required + Save unit (pencil) */}
                <div className="tbm-unit-top">
                  <div>
                    <label className="tbm-label">Unit Number</label>
                    <input className="exm-input" value={u.unitNum} onChange={(e) => setUnit(ui, 'unitNum', e.target.value)} placeholder="Enter unit number" />
                  </div>
                  <div>
                    <label className="tbm-label">Unit Name</label>
                    <input className="exm-input" value={u.unitName} onChange={(e) => setUnit(ui, 'unitName', e.target.value)} placeholder="Enter unit name" />
                  </div>
                  <div>
                    <label className="tbm-label">Weeks Required</label>
                    <input className="exm-input" type="number" min="0" value={u.weeks} style={{ textAlign: 'center' }} onChange={(e) => setUnit(ui, 'weeks', e.target.value)} placeholder="Weeks" />
                  </div>
                  <div className="tbm-unit-top-btns">
                    <button className="tbm-unit-save-btn" title={!canEdit ? 'No permission to edit' : (unitReady ? 'Update weeks' : 'Unit number, name & weeks (> 0) required')} disabled={saving || !unitReady || !canEdit} style={!canEdit ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={() => updateWeeks(ui)}>
                      <i className="fa-solid fa-pen" />
                    </button>
                  </div>
                </div>

                {/* Sub topics: har row me Sub Topic / Total Period Required + Save (floppy) + Delete (trash) */}
                <div className="tbm-topics-area">
                  {u.topics.map((tp, ti) => (
                    <div className="tbm-topic-row" key={ti}>
                      <div>
                        <label className="tbm-label">Sub Topic</label>
                        <input className="exm-input" value={tp.topic} onChange={(e) => setTopic(ui, ti, 'topic', e.target.value)} placeholder="Enter sub topic" />
                      </div>
                      <div>
                        <label className="tbm-label">Total Period Required</label>
                        <input className="exm-input" type="number" min="0" value={tp.periods} style={{ textAlign: 'center' }} onChange={(e) => setTopic(ui, ti, 'periods', e.target.value)} placeholder="0" />
                      </div>
                      <div className="tbm-topic-action-cell">
                        <button className="tbm-unit-save-btn" title={!(canCreate || canEdit) ? 'No permission to save' : (unitReady ? 'Save unit' : 'Unit number, name & weeks (> 0) required')} disabled={saving || !unitReady || !(canCreate || canEdit)} style={!(canCreate || canEdit) ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={persistCurrent}>
                          <i className="fa-solid fa-floppy-disk" />
                        </button>
                        <button className="tbm-topic-del-btn" title={!canDelete ? 'No permission to delete' : 'Delete topic'} disabled={saving || !canDelete} style={!canDelete ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={() => delTopic(ui, ti)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '0 2px 6px' }}>
                  <button className="tbm-topic-add-btn" disabled={!canCreate} title={!canCreate ? 'No permission to add' : undefined} style={!canCreate ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={() => addTopic(ui)}><i className="fa-solid fa-plus" /> Add Topic</button>
                </div>
              </div>
              )
            })}

          <button className="exm-btn primary tb-add-units" onClick={(e) => { addUnit(); e.currentTarget.blur() }} disabled={!mTerm || !mSubj || !canCreate} title={!canCreate ? 'No permission to add' : undefined} style={!canCreate ? { opacity: .45, cursor: 'not-allowed' } : undefined}><i className="fa-solid fa-plus" /> Add More Units</button>
        </div>

        <div className="exm-modal-foot">
          <span />
          <div className="exm-foot-btns">
            <button className="exm-btn ghost" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
            <SpinnerButton className="exm-btn primary" icon="fa-floppy-disk" disabled={!(canCreate || canEdit)} title={!(canCreate || canEdit) ? 'No permission to save' : undefined} style={!(canCreate || canEdit) ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={save}>Save Breakup</SpinnerButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
