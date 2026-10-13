import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { newId, RS_GRADE_LIST, RS_GRADE_COLORS, RS_COND_LIST, RS_COND_MAP } from './examStore'
import { fetchSignatures, saveSignature, deleteSignature, fetchRemarks, saveRemark, deleteRemark } from '../../api/examinationApi'
import { exportReport } from '../Academics/reportEngine'
import SpinnerButton from '../../components/SpinnerButton'
import ExamConfirm from './ExamConfirm'

/* ═══════════════════════════════════════════════════════════════════
   Add Result — ERP Result Setup port. Three read-only section cards
   (Grade · Signature · Final Remarks) with a single Edit modal that
   edits all three via inner tabs.
   ═══════════════════════════════════════════════════════════════════ */
export default function AddResultTab({ store, commit, flash }) {
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(true) // initial server fetch
  const r = store.result
  const grades = r.grades || []
  const sigs = r.signatures || []
  const remarks = r.remarks || []

  /* Server se signatures (gradinguploadercrud) + remarks (overallgradingcrud)
     lao; mila to store me unhi se (serverId sath) bharo. Grades ki koi API
     nahi — wo local hi rehti hain. API band ho to local fallback. */
  useEffect(() => {
    let alive = true
    Promise.allSettled([fetchSignatures(), fetchRemarks()]).then(([sg, rm]) => {
      if (!alive) return
      const next = { grades: store.result.grades || [], signatures: store.result.signatures || [], remarks: store.result.remarks || [] }
      let changed = false
      if (sg.status === 'fulfilled' && sg.value.length) { next.signatures = sg.value.map((s) => ({ id: newId(), ...s })); changed = true }
      if (rm.status === 'fulfilled' && rm.value.length) { next.remarks = rm.value.map((m) => ({ id: newId(), ...m })); changed = true }
      if (changed) commit({ ...store, result: next })
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // sirf mount par
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pct = (row) => `${RS_COND_MAP[row.cond] || '≥'} ${row.pct}`

  const C = (label, a) => ({ label, a: a || 'l' })
  const downloadPdf = (fmt) => {
    const report = {
      title: 'Result Setup',
      period: '',
      filters: [['Grades', String(grades.length)], ['Signatories', String(sigs.length)], ['Remarks', String(remarks.length)]],
      sections: [
        { title: 'Grade', columns: [C('#', 'c'), C('Grade'), C('Percentage'), C('Comment')], rows: grades.map((g, i) => [i + 1, g.grade, pct(g), g.comment || '—']) },
        { title: 'Signatures', columns: [C('#', 'c'), C('Name'), C('Designation')], rows: sigs.map((s, i) => [i + 1, s.name || '—', s.desig || '—']) },
        { title: 'Final Remarks', columns: [C('#', 'c'), C('Percentage'), C('Remarks')], rows: remarks.map((m, i) => [i + 1, pct(m), m.text || '—']) },
      ],
    }
    exportReport(report, fmt, flash, false)
  }

  /* Save: Signature → gradinguploadercrud, Final Remarks → overallgradingcrud
     (insert/update + hataye gaye delete). Grades ki chain swagger par koi API
     nahi — wo local. API ka natija toast me saaf dikhta hai. */
  const save = async (next) => {
    const prev = store.result || {}
    let attempted = 0; let failed = 0; let lastErr = ''
    const outSigs = []
    for (const s of next.signatures || []) {
      attempted += 1
      let serverId = s.serverId || 0
      try { serverId = (await saveSignature(s)).serverId } catch (e) { failed += 1; lastErr = e?.message || 'sync failed' }
      outSigs.push({ ...s, serverId })
    }
    for (const s of prev.signatures || []) {
      if (s.serverId && !(next.signatures || []).some((x) => x.serverId === s.serverId)) {
        attempted += 1
        try { await deleteSignature(s.serverId) } catch (e) { failed += 1; lastErr = e?.message || 'delete failed' }
      }
    }
    const outRems = []
    for (const m of next.remarks || []) {
      attempted += 1
      let serverId = m.serverId || 0
      try { serverId = (await saveRemark(m)).serverId } catch (e) { failed += 1; lastErr = e?.message || 'sync failed' }
      outRems.push({ ...m, serverId })
    }
    for (const m of prev.remarks || []) {
      if (m.serverId && !(next.remarks || []).some((x) => x.serverId === m.serverId)) {
        attempted += 1
        try { await deleteRemark(m.serverId) } catch (e) { failed += 1; lastErr = e?.message || 'delete failed' }
      }
    }
    /* insert response naya id wapas nahi karta (id:0) — is liye server se dobara
       fetch kar ke asli serverIds le aate hain, warna agli save par duplicate
       insert ho jata. Fetch fail ho to local (outSigs/outRems) rakho. */
    let resultState = { grades: next.grades, signatures: outSigs, remarks: outRems }
    try {
      const [sg, rm] = await Promise.all([fetchSignatures(), fetchRemarks()])
      resultState = {
        grades: next.grades,
        signatures: sg.length ? sg.map((s) => ({ id: newId(), ...s })) : outSigs,
        remarks: rm.length ? rm.map((m) => ({ id: newId(), ...m })) : outRems,
      }
    } catch { /* server se re-read fail → local state */ }
    commit({ ...store, result: resultState })
    setEditOpen(false)
    if (failed > 0) flash(`Saved locally — ${failed} failed to sync: ${lastErr}`, 'error')
    else if (attempted > 0) flash('Result setup saved & synced to server')
    else flash('Saved locally — grades have no chain API (add a Signature or Remark to sync)')
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button className="exm-export pdf" onClick={() => downloadPdf('pdf')}><i className="fa-solid fa-file-pdf" /> PDF</button>
        <button className="exm-btn primary" onClick={() => setEditOpen(true)}><i className="fa-solid fa-pen-to-square" /> Edit</button>
      </div>

      {loading ? (
        <div className="exm-rs-card" style={{ textAlign: 'center', padding: 40 }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>Loading result setup…</div>
        </div>
      ) : (<>
      {/* Grade */}
      <div className="exm-rs-card">
        <div className="exm-rs-head"><div className="exm-rs-icon"><i className="fa-solid fa-chart-bar" /></div><span className="exm-rs-title">Grade</span></div>
        <div className="exm-rs-cols grade"><div>Sr.no</div><div>Grade</div><div>Percentage</div><div>Comment</div></div>
        {grades.length ? grades.map((g, i) => (
          <div key={g.id} className="exm-rs-row grade">
            <div>{i + 1}</div>
            <div><span className="exm-grade-chip" style={{ background: RS_GRADE_COLORS[g.grade] || '#1E3A8A' }}>{g.grade}</span></div>
            <div><span className="exm-pct-pill">{pct(g)}</span></div>
            <div>{g.comment || '—'}</div>
          </div>
        )) : <div className="exm-rs-empty">No grades configured</div>}
      </div>

      {/* Signature */}
      <div className="exm-rs-card">
        <div className="exm-rs-head"><div className="exm-rs-icon"><i className="fa-solid fa-signature" /></div><span className="exm-rs-title">Signature</span></div>
        <div className="exm-rs-cols sig"><div>Sr.no</div><div>Name</div><div>Designation</div><div>Signature</div></div>
        {sigs.length ? sigs.map((s, i) => (
          <div key={s.id} className="exm-rs-row sig">
            <div>{i + 1}</div>
            <div>{s.name || '—'}</div>
            <div>{s.desig || '—'}</div>
            <div>{s.img ? <img src={s.img} alt="" style={{ maxHeight: 36, maxWidth: 110, objectFit: 'contain' }} /> : <div className="exm-sig-initial">{(s.name || '?').charAt(0).toUpperCase()}</div>}</div>
          </div>
        )) : <div className="exm-rs-empty">No signatures added</div>}
      </div>

      {/* Final Remarks */}
      <div className="exm-rs-card">
        <div className="exm-rs-head"><div className="exm-rs-icon"><i className="fa-solid fa-comment-dots" /></div><span className="exm-rs-title">Final Remarks</span></div>
        <div className="exm-rs-cols rem"><div>Sr.no</div><div>Percentage</div><div>Remarks</div></div>
        {remarks.length ? remarks.map((m, i) => (
          <div key={m.id} className="exm-rs-row rem">
            <div>{i + 1}</div>
            <div><span className="exm-pct-pill">{pct(m)}</span></div>
            <div>{m.text || '—'}</div>
          </div>
        )) : <div className="exm-rs-empty">No remarks configured</div>}
      </div>
      </>)}

      {editOpen && <ResultEditModal result={r} onClose={() => setEditOpen(false)} onSave={save} flash={flash} />}
    </>
  )
}

/* ── Edit modal: Grade / Signature / Final Remarks tabs ── */
function ResultEditModal({ result, onClose, onSave, flash }) {
  const [tab, setTab] = useState('grades')
  const [grades, setGrades] = useState(() => JSON.parse(JSON.stringify(result.grades || [])))
  const [sigs, setSigs] = useState(() => JSON.parse(JSON.stringify(result.signatures || [])))
  const [remarks, setRemarks] = useState(() => JSON.parse(JSON.stringify(result.remarks || [])))
  const [del, setDel] = useState(null) // { kind, id }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const upGrade = (id, k, v) => setGrades((rows) => rows.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const upSig = (id, k, v) => setSigs((rows) => rows.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const upRem = (id, k, v) => setRemarks((rows) => rows.map((x) => (x.id === id ? { ...x, [k]: v } : x)))

  const addGrade = () => {
    const used = grades.map((g) => g.grade)
    const next = RS_GRADE_LIST.find((g) => !used.includes(g)) || ''
    setGrades((r) => [...r, { id: newId(), grade: next, cond: 'gte', pct: '', comment: '' }])
  }
  const addSig = () => setSigs((r) => [...r, { id: newId(), name: '', desig: '', img: '' }])
  const addRem = () => setRemarks((r) => [...r, { id: newId(), cond: 'gte', pct: '', text: '' }])

  const uploadSig = (id, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => upSig(id, 'img', reader.result)
    reader.readAsDataURL(file)
  }

  const clampPct = (v) => { if (v === '') return ''; let n = Number(v); if (n > 100) n = 100; if (n < 0) n = 0; return String(n) }

  const runDel = () => {
    if (del.kind === 'grade') setGrades((r) => r.filter((x) => x.id !== del.id))
    if (del.kind === 'sig') setSigs((r) => r.filter((x) => x.id !== del.id))
    if (del.kind === 'rem') setRemarks((r) => r.filter((x) => x.id !== del.id))
    setDel(null)
  }

  const submit = () => {
    for (const g of grades) { if (!g.grade) return flash('Choose a grade for every grade band', 'error'); if (g.pct === '') return flash('Enter a percentage for every grade band', 'error') }
    for (const m of remarks) { if (m.pct === '') return flash('Enter a percentage for every remark', 'error'); if (!m.text.trim()) return flash('Remark text is required', 'error') }
    return onSave({ grades, signatures: sigs, remarks })
  }

  const TABS = [
    { k: 'grades', l: 'Grade', icon: 'fa-chart-bar' },
    { k: 'signatures', l: 'Signature', icon: 'fa-signature' },
    { k: 'remarks', l: 'Final Remarks', icon: 'fa-comment-dots' },
  ]

  return createPortal(
    <div className="exm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="exm-modal wide" role="dialog" aria-modal="true">
        <div className="exm-modal-hdr">
          <div className="exm-modal-icon"><i className="fa-solid fa-pen-to-square" /></div>
          <div className="exm-modal-titles">
            <h2>Edit Result Setup</h2>
            <p>Configure grades, signatures &amp; final remarks</p>
          </div>
          <button className="exm-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="exm-rm-tabs">
          {TABS.map((t) => <button key={t.k} className={`exm-rm-tab${tab === t.k ? ' on' : ''}`} onClick={() => setTab(t.k)}><i className={`fa-solid ${t.icon}`} /> {t.l}</button>)}
        </div>

        <div className="exm-modal-body">
          {tab === 'grades' && (
            <div className="exm-rm-list">
              {grades.length === 0 && <div className="exm-rs-empty">No grades configured. Click “Add Grade”.</div>}
              {grades.map((g, i) => (
                <div key={g.id} className="exm-rm-grade-row">
                  <div className="exm-rm-sno">{i + 1}</div>
                  <select className="exm-input" value={g.grade || ''} onChange={(e) => upGrade(g.id, 'grade', e.target.value)}>
                    <option value="" disabled>Grade…</option>
                    {RS_GRADE_LIST.filter((o) => o === g.grade || !grades.some((x) => x.id !== g.id && x.grade === o)).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select className="exm-input" value={g.cond || 'gte'} onChange={(e) => upGrade(g.id, 'cond', e.target.value)}>
                    {RS_COND_LIST.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                  <input className="exm-input" type="number" min={0} max={100} placeholder="Value" value={g.pct} onChange={(e) => upGrade(g.id, 'pct', clampPct(e.target.value))} />
                  <input className="exm-input" placeholder="Comment (max 28)" maxLength={28} value={g.comment || ''} onChange={(e) => upGrade(g.id, 'comment', e.target.value)} />
                  <button className="exm-rm-del" title="Remove" onClick={() => setDel({ kind: 'grade', id: g.id })}><i className="fa-solid fa-trash-can" /></button>
                </div>
              ))}
              <button className="exm-rm-add" onClick={addGrade}><i className="fa-solid fa-plus" /> Add Grade</button>
            </div>
          )}

          {tab === 'signatures' && (
            <div className="exm-rm-list">
              {sigs.length === 0 && <div className="exm-rs-empty">No signatures added. Click “Add Signature”.</div>}
              {sigs.map((s, i) => (
                <div key={s.id} className="exm-rm-sig-row">
                  <div className="exm-rm-sno">{i + 1}</div>
                  <input className="exm-input" placeholder="Name" value={s.name || ''} onChange={(e) => upSig(s.id, 'name', e.target.value)} />
                  <input className="exm-input" placeholder="Designation" value={s.desig || ''} onChange={(e) => upSig(s.id, 'desig', e.target.value)} />
                  <label className="exm-sig-upload">
                    <input type="file" accept="image/*" onChange={(e) => uploadSig(s.id, e.target.files[0])} />
                    {s.img ? <img src={s.img} alt="" /> : <span className="exm-sig-upload-ph"><i className="fa-solid fa-plus" /> Upload</span>}
                  </label>
                  <button className="exm-rm-del" title="Remove" onClick={() => setDel({ kind: 'sig', id: s.id })}><i className="fa-solid fa-trash-can" /></button>
                </div>
              ))}
              <button className="exm-rm-add" onClick={addSig}><i className="fa-solid fa-plus" /> Add Signature</button>
            </div>
          )}

          {tab === 'remarks' && (
            <div className="exm-rm-list">
              {remarks.length === 0 && <div className="exm-rs-empty">No remarks configured. Click “Add Remark”.</div>}
              {remarks.map((m, i) => (
                <div key={m.id} className="exm-rm-rem-row">
                  <div className="exm-rm-rem-top">
                    <div className="exm-rm-sno">{i + 1}</div>
                    <select className="exm-input" value={m.cond || 'gte'} onChange={(e) => upRem(m.id, 'cond', e.target.value)}>
                      {RS_COND_LIST.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                    <input className="exm-input" type="number" min={0} max={100} placeholder="Percentage" value={m.pct} onChange={(e) => upRem(m.id, 'pct', clampPct(e.target.value))} />
                    <button className="exm-rm-del" title="Remove" onClick={() => setDel({ kind: 'rem', id: m.id })}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                  <input className="exm-input" placeholder="Final remarks — max 200 characters" maxLength={200} value={m.text || ''} onChange={(e) => upRem(m.id, 'text', e.target.value)} />
                </div>
              ))}
              <button className="exm-rm-add" onClick={addRem}><i className="fa-solid fa-plus" /> Add Remark</button>
            </div>
          )}
        </div>

        <div className="exm-modal-foot">
          <span />
          <div className="exm-foot-btns">
            <button type="button" className="exm-btn ghost" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
            <SpinnerButton className="exm-btn primary" icon="fa-floppy-disk" onClick={submit}>Save</SpinnerButton>
          </div>
        </div>
      </div>

      {del && <ExamConfirm title="Remove this row?" body="It will be removed from the result setup when you save." confirmLabel="Remove" onCancel={() => setDel(null)} onConfirm={runDel} />}
    </div>,
    document.body,
  )
}
