import { useMemo, useState } from 'react'
import {
  EXAM_TERMS, EXAM_STATUS, STATUS_META, ABSENT_MODES, POLICY_TYPES, policyTypeMeta, currentSession, hasUnpublishedChanges,
  allSchoolIds, publishableSchools, examStatusByDate, SCOPE_LABEL, actionsFor, ACTION_META,
} from './data'

/* ═══════════════════════════════════════════════════════════════════
   Records table — shared by the Exams and Result Policy tabs. Row
   actions are chosen by lifecycle state, so the table never offers a
   step the data layer would refuse (e.g. Publish on a draft).
   ═══════════════════════════════════════════════════════════════════ */

const fmtDate = (iso) => (iso
  ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')
const fmtStamp = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')

const STATUS_FILTERS = ['all', EXAM_STATUS.DRAFT, EXAM_STATUS.READY, EXAM_STATUS.PUBLISHED, EXAM_STATUS.ARCHIVED]

export default function RecordsTable({ kind, records, onNew, onView, onEdit, onAction }) {
  const isExam = kind === 'exam'
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('all')
  const [session, setSession] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('updated')
  const [ptype, setPtype] = useState('all')

  const sessions = useMemo(() => {
    const set = new Set([currentSession(), ...records.map((r) => r.session)].filter(Boolean))
    return [...set]
  }, [records])

  const rows = useMemo(() => {
    const k = q.trim().toLowerCase()
    const list = records.filter((r) => {
      if (k && !r.name.toLowerCase().includes(k)) return false
      if (isExam && term !== 'all' && r.term !== term) return false
      if (!isExam && ptype !== 'all' && r.type !== ptype) return false
      if (session !== 'all' && r.session !== session) return false
      if (status !== 'all' && r.status !== status) return false
      return true
    })
    const cmp = {
      updated: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
      name: (a, b) => a.name.localeCompare(b.name),
      start: (a, b) => String(a.from || '').localeCompare(String(b.from || '')) || a.name.localeCompare(b.name),
    }[sort]
    return [...list].sort(cmp)
  }, [records, q, term, session, status, sort, isExam, ptype])

  const hasAny = records.length > 0
  const filtersOn = q || term !== 'all' || session !== 'all' || status !== 'all' || ptype !== 'all'
  const clearFilters = () => { setQ(''); setTerm('all'); setSession('all'); setStatus('all'); setPtype('all') }

  const schoolTotal = publishableSchools().length
  const noun = isExam ? 'exam' : 'result policy'

  return (
    <section className="exm-panel" aria-label={isExam ? 'Exams' : 'Result policies'}>
      <div className="exm-toolbar">
        <div className="exm-search">
          <i className="fa-solid fa-magnifying-glass" />
          <input placeholder={isExam ? 'Search exams…' : 'Search result policies…'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </div>
        <div className="exm-filters">
          {isExam && (
            <select className="exm-input sm" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Filter by term">
              <option value="all">All terms</option>
              {EXAM_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {!isExam && (
            <select className="exm-input sm" value={ptype} onChange={(e) => setPtype(e.target.value)} aria-label="Filter by result type">
              <option value="all">All result types</option>
              {POLICY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          )}
          <select className="exm-input sm" value={session} onChange={(e) => setSession(e.target.value)} aria-label="Filter by academic session">
            <option value="all">All sessions</option>
            {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="exm-input sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : STATUS_META[s].label}</option>)}
          </select>
          <select className="exm-input sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="updated">Recently updated</option>
            <option value="name">Name A–Z</option>
            {isExam && <option value="start">Start date</option>}
          </select>
        </div>
        <button type="button" className="exm-btn primary" onClick={onNew}><i className="fa-solid fa-plus" /> New {isExam ? 'Exam' : 'Result Policy'}</button>
      </div>

      {!hasAny ? (
        <div className="exm-empty">
          <div className="exm-empty-icon"><i className={`fa-solid ${isExam ? 'fa-file-signature' : 'fa-square-poll-vertical'}`} /></div>
          <h3>No {isExam ? 'exams' : 'result policies'} yet</h3>
          <p>{isExam
            ? 'Create an exam once here. Nothing reaches schools until you publish it to all schools or to the ones you choose.'
            : 'Define the grading scale once for your chain. Schools receive it only after you publish it.'}</p>
          <button type="button" className="exm-btn primary" onClick={onNew}><i className="fa-solid fa-plus" /> New {isExam ? 'Exam' : 'Result Policy'}</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="exm-empty compact">
          <h3>No matching {noun}s</h3>
          <p>Nothing matches the current search or filters.</p>
          {filtersOn && <button type="button" className="exm-btn ghost" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <div className="exm-table-wrap">
          <table className="exm-table">
            <thead>
              <tr>
                <th>{isExam ? 'Exam' : 'Policy'}</th>
                <th>{isExam ? 'Schedule' : 'Content'}</th>
                <th>Applies to</th>
                <th>Status</th>
                <th>Last updated</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = STATUS_META[r.status]
                const dirty = hasUnpublishedChanges(r)
                const live = r.publishedSnapshot ? r.publishedSnapshot.schoolIds.length : null
                const reach = allSchoolIds().length
                const timing = isExam && r.status === EXAM_STATUS.PUBLISHED ? examStatusByDate(r) : null
                return (
                  <tr key={r.id}>
                    <td>
                      <button type="button" className="exm-name" onClick={() => onView(r.id)}>{r.name}</button>
                      <div className="exm-sub">
                        {isExam ? `${r.term} · ${r.session || 'No session'}` : `${policyTypeMeta(r.type).label} · ${r.session || 'No session'}`}
                      </div>
                    </td>
                    <td>
                      {isExam ? (
                        <>
                          <div>{fmtDate(r.from)} – {fmtDate(r.to)}</div>
                          <div className="exm-sub">{r.classIds.length} class{r.classIds.length === 1 ? '' : 'es'}{timing ? ` · ${timing}` : ''}</div>
                        </>
                      ) : (
                        <>
                          {r.type === 'preschool' ? (
                            <>
                              <div>{r.content.learningAreas.length} learning area{r.content.learningAreas.length === 1 ? '' : 's'}</div>
                              <div className="exm-sub">{r.content.psdFields.length} PSD field{r.content.psdFields.length === 1 ? '' : 's'} · E/M/A/NY scale</div>
                            </>
                          ) : (
                            <>
                              <div>{r.content.grades.length} grade{r.content.grades.length === 1 ? '' : 's'} · {r.content.remarks.length} remark{r.content.remarks.length === 1 ? '' : 's'}</div>
                              <div className="exm-sub">{ABSENT_MODES.find((m) => m.key === r.content.absentMode)?.label}</div>
                            </>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <div>{SCOPE_LABEL}</div>
                      <div className="exm-sub">
                        {r.status === EXAM_STATUS.PUBLISHED
                          ? `Live at ${live} of ${schoolTotal} school${schoolTotal === 1 ? '' : 's'}`
                          : `${reach} of ${schoolTotal} school${schoolTotal === 1 ? '' : 's'} targeted`}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${meta.cls}`}><i className={`fa-solid ${meta.icon}`} /> {meta.label}</span>
                      <div className="exm-sub">
                        {r.status === EXAM_STATUS.PUBLISHED && <>Live v{r.publishedVersion} · </>}
                        Draft v{r.version}
                      </div>
                      {dirty && <span className="exm-chip-warn"><i className="fa-solid fa-pen" /> Unpublished changes</span>}
                    </td>
                    <td>
                      <div>{fmtStamp(r.updatedAt)}</div>
                      <div className="exm-sub">{r.updatedBy}</div>
                    </td>
                    <td className="r">
                      <div className="exm-actions">
                        <button type="button" className="exm-icon-btn" title="View details" aria-label={`View ${r.name}`} onClick={() => onView(r.id)}>
                          <i className="fa-solid fa-eye" />
                        </button>
                        {actionsFor(r).map((a) => {
                          const m = ACTION_META[a]
                          const onClick = a === 'edit' ? () => onEdit(r.id) : () => onAction(r.id, a)
                          return (
                            <button key={a} type="button" className={`exm-icon-btn ${m.cls}`} title={m.label} aria-label={`${m.label}: ${r.name}`} onClick={onClick}>
                              <i className={`fa-solid ${m.icon}`} />
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
