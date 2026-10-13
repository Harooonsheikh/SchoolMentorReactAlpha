import { useEffect, useState } from 'react'
import { newId, examSession } from './examStore'
import { fetchTerms, saveTerm, deleteTerm } from '../../api/examinationApi'
import SpinnerButton from '../../components/SpinnerButton'
import ExamConfirm from './ExamConfirm'

/* ═══════════════════════════════════════════════════════════════════
   Add Term — academic terms, styled like Academics' Term Settings:
   a stat-card strip + an editable terms table + "Add new term".
   Terms defined here drive the Add Exam tab's term selector.
   ═══════════════════════════════════════════════════════════════════ */
export default function AddTermTab({ store, commit, flash }) {
  const ss = examSession()
  const [draft, setDraft] = useState({})
  const [del, setDel] = useState(null)
  const [loading, setLoading] = useState(true) // initial server fetch

  /* Server se terms lao (termscrud · get). Mila to local store ko unhi se
     bhar do (id = server id, delete/update isi par); API band ho (SP abhi
     deploy nahi) to local par chalti rahe — koi error toast nahi. */
  useEffect(() => {
    let alive = true
    fetchTerms()
      .then((list) => {
        if (!alive || !list.length) return
        commit({ ...store, terms: list.map((t) => ({ id: t.id, serverId: t.id, name: t.name, start: t.start, end: t.end, sessionYearID: t.sessionYearID })) })
      })
      .catch(() => { /* backend SP abhi nahi — local fallback */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // sirf mount par — load; baqi edits manually sync hote hain
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setDraft((prev) => {
      const next = {}
      store.terms.forEach((t) => { next[t.id] = prev[t.id] || { name: t.name, start: t.start, end: t.end } })
      return next
    })
  }, [store.terms])

  const setRow = (id, k, v) => setDraft((s) => ({ ...s, [id]: { ...s[id], [k]: v } }))

  const addTerm = () => commit({ ...store, terms: [...store.terms, { id: newId(), name: '', start: ss.start || '', end: '' }] })

  const saveRow = async (id) => {
    const d = draft[id] || {}
    if (!d.name?.trim()) return flash('Term name cannot be empty', 'error')
    if (!d.start) return flash('Term start date is required', 'error')
    if (!d.end) return flash('Term end date is required', 'error')
    if (d.end <= d.start) return flash('Term end date must be greater than start date', 'error')
    if (ss.start && ss.end && d.start && d.end && (d.start < ss.start || d.end > ss.end)) return flash('Term dates must fall within the session period', 'error')
    const term = store.terms.find((t) => t.id === id) || {}
    /* Pehle server par (insert/update) — id mile to rakho; API band ho to
       sirf local save (sync tab hoga jab SP deploy ho). */
    let serverId = term.serverId || (typeof id === 'number' ? id : 0)
    try {
      const r = await saveTerm({ id: serverId, name: d.name.trim(), start: d.start, end: d.end, sessionYearID: term.sessionYearID })
      if (r?.id) serverId = r.id
    } catch { /* local fallback */ }
    commit({ ...store, terms: store.terms.map((t) => (t.id === id ? { ...t, name: d.name.trim(), start: d.start, end: d.end, serverId } : t)) })
    flash(`“${d.name.trim()}” saved`)
    return undefined
  }

  const doDel = async () => {
    const term = store.terms.find((t) => t.id === del.id)
    const sid = term?.serverId || (typeof del.id === 'number' ? del.id : 0)
    if (sid) { try { await deleteTerm(sid) } catch { /* local still removes */ } }
    commit({ ...store, terms: store.terms.filter((t) => t.id !== del.id) })
    setDel(null)
    flash('Term deleted', 'success')
  }

  return (
    <>
      <div className="exm-panel">
        <div className="exm-panel-hdr">
          <h2><i className="fa-solid fa-layer-group" /> Term Settings</h2>
        </div>
        <div className="exm-note warn">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>Terms defined here drive the <strong>Add Exam</strong> tab and the academic calendar. Deleting a term affects its linked exams.</span>
        </div>

        <div className="exm-table-wrap">
          <table className="exm-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 52 }}>#</th>
                <th>Term Name</th>
                <th style={{ width: 180 }}>Start Date</th>
                <th style={{ width: 180 }}>End Date</th>
                <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>
                  <div className="exm-empty compact">
                    <div className="exm-empty-icon"><i className="fa-solid fa-spinner fa-spin" /></div>
                    <h3>Loading terms…</h3>
                  </div>
                </td></tr>
              ) : store.terms.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="exm-empty compact">
                    <div className="exm-empty-icon"><i className="fa-solid fa-list-ol" /></div>
                    <h3>No terms yet</h3>
                    <p>Click “Add new term” below to get started.</p>
                  </div>
                </td></tr>
              ) : store.terms.map((t, i) => {
                const d = draft[t.id] || {}
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td><input className="exm-input" value={d.name || ''} placeholder="Enter term name" onChange={(e) => setRow(t.id, 'name', e.target.value)} /></td>
                    <td><input className="exm-input" type="date" value={d.start || ''} onChange={(e) => setRow(t.id, 'start', e.target.value)} /></td>
                    <td><input className="exm-input" type="date" value={d.end || ''} onChange={(e) => setRow(t.id, 'end', e.target.value)} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <SpinnerButton className="exm-icon-btn" title="Save" icon="fa-check" style={{ color: '#16a34a', borderColor: 'rgba(22,163,74,.4)' }} onClick={() => saveRow(t.id)} />
                        <button className="exm-icon-btn danger" title="Delete" onClick={() => setDel({ id: t.id, name: t.name })}><i className="fa-solid fa-xmark" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button className="exm-add-row" onClick={addTerm}>
          <span className="exm-add-ic"><i className="fa-solid fa-plus" /></span>
          <span className="exm-add-main">Add new term</span>
          <span className="exm-add-hint">Click to add another academic term</span>
        </button>
      </div>

      {del && (
        <ExamConfirm
          title="Delete Term?"
          body={`Term “${del.name || 'this term'}” will be removed. Linked exams will be affected.`}
          onCancel={() => setDel(null)}
          onConfirm={doDel}
        />
      )}
    </>
  )
}
