import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { PRESCHOOL_LEVELS } from './defaults'
import {
  EXAM_STATUS, STATUS_META, ABSENT_MODES, RS_COND_MAP, chainClasses, publishableSchools,
  allSchoolIds, hasUnpublishedChanges, actionsFor, ACTION_META, SCOPE_LABEL, policyTypeMeta,
} from './data'

/* ═══════════════════════════════════════════════════════════════════
   Record detail — full picture of one exam or result policy: draft vs
   live version, exactly which schools have the live version (and which
   do not), and the audit trail.
   ═══════════════════════════════════════════════════════════════════ */

const fmtDate = (iso) => (iso
  ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')
const fmtStamp = (iso) => (iso
  ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—')

/* Read-only content of a result policy, per type. */
function PolicyBody({ content, type }) {
  if (type === 'preschool') {
    const cardOn = content.cardOptions.filter((o) => o.on).length
    return (
      <>
        <div className="exm-detail-section">
          <span className="exm-lbl">Learning areas</span>
          <ul className="exm-chip-list">{content.learningAreas.map((la) => <li key={la.id}>{la.name}</li>)}</ul>
        </div>
        <div className="exm-detail-section">
          <span className="exm-lbl">Grading scale</span>
          <div className="exm-grade-table compact">
            <div className="exm-grade-row head"><span>Code</span><span>Label</span><span>Range</span><span /></div>
            {content.gradingScale.map((g) => (
              <div className="exm-grade-row" key={g.code}>
                <span><strong>{g.code}</strong></span><span>{g.label}</span><span>{g.range}</span><span />
              </div>
            ))}
          </div>
        </div>
        <div className="exm-detail-section">
          <span className="exm-lbl">SLO statements per level</span>
          <div className="exm-grade-table compact">
            <div className="exm-grade-row head"><span>Level</span><span>Statements</span><span>Areas covered</span><span /></div>
            {PRESCHOOL_LEVELS.map((l) => {
              const byArea = content.slo[l.id] || {}
              const total = Object.values(byArea).reduce((n, list) => n + list.length, 0)
              const areas = Object.values(byArea).filter((list) => list.length).length
              return (
                <div className="exm-grade-row" key={l.id}>
                  <span>{l.name}</span><span>{total}</span><span>{areas} of {content.learningAreas.length}</span><span />
                </div>
              )
            })}
          </div>
        </div>
        <div className="exm-detail-section">
          <span className="exm-lbl">Personal &amp; social development fields</span>
          <ul className="exm-chip-list">{content.psdFields.map((f) => <li key={f.id}>{f.label}</li>)}</ul>
        </div>
        <div className="exm-detail-section">
          <span className="exm-lbl">Report card visibility <em>{cardOn} of {content.cardOptions.length} shown</em></span>
          <ul className="exm-chip-list">
            {content.cardOptions.map((o) => <li key={o.label} className={o.on ? '' : 'off'}>{o.on ? '✓' : '—'} {o.label}</li>)}
          </ul>
        </div>
      </>
    )
  }
  return (
    <>
      <div className="exm-kv"><span>Absent subjects</span><strong>{ABSENT_MODES.find((m) => m.key === content.absentMode)?.label}</strong></div>
      <div className="exm-detail-section">
        <span className="exm-lbl">Grades</span>
        <div className="exm-grade-table compact">
          <div className="exm-grade-row head"><span>Grade</span><span>Condition</span><span>Percentage</span><span>Comment</span></div>
          {content.grades.map((g) => (
            <div className="exm-grade-row" key={g.id}>
              <span><strong>{g.grade}</strong></span>
              <span>{RS_COND_MAP[g.cond] || '≥'}</span>
              <span>{g.pct}%</span>
              <span>{g.comment || '—'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="exm-detail-section">
        <span className="exm-lbl">Final remarks</span>
        <div className="exm-grade-table compact">
          <div className="exm-remark-row head"><span>Grade</span><span>Condition</span><span>Percentage</span><span>Remark</span><span /></div>
          {content.remarks.map((r) => (
            <div className="exm-remark-row" key={r.id}>
              <span><strong>{r.grade}</strong></span><span>{RS_COND_MAP[r.cond] || '≥'}</span><span>{r.pct}%</span><span>{r.text}</span><span />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default function RecordDetail({ kind, record, onClose, onEdit, onAction }) {
  const isExam = kind === 'exam'
  const schools = publishableSchools()
  const meta = STATUS_META[record.status]
  const isLive = record.status === EXAM_STATUS.PUBLISHED

  /* While published, the live snapshot defines reach. Otherwise show the
     current scope so Head Office can see what the next publish would hit. */
  const reachIds = new Set(isLive && record.publishedSnapshot ? record.publishedSnapshot.schoolIds : allSchoolIds())
  const reached = schools.filter((s) => reachIds.has(s.id))
  const notReached = schools.filter((s) => !reachIds.has(s.id))

  const classNames = useMemo(() => {
    const byId = new Map(chainClasses().map((c) => [c.id, c.name]))
    return (record.classIds || []).map((id) => byId.get(id)).filter(Boolean)
  }, [record.classIds])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const actions = actionsFor(record)

  return createPortal(
    <div className="exm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="exm-modal wide" role="dialog" aria-modal="true" aria-labelledby="exm-detail-title">
        <div className="exm-modal-hdr">
          <div className={`exm-modal-icon ${isExam ? '' : 'amber'}`}>
            <i className={`fa-solid ${isExam ? 'fa-file-signature' : 'fa-square-poll-vertical'}`} />
          </div>
          <div className="exm-modal-titles">
            <h2 id="exm-detail-title">{record.name}</h2>
            <p>
              <span className={`badge ${meta.cls}`}><i className={`fa-solid ${meta.icon}`} /> {meta.label}</span>
              {' '}{isExam ? `${record.term} · ` : `${policyTypeMeta(record.type).label} · `}{record.session || 'No session'}
            </p>
          </div>
          <button type="button" className="exm-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="exm-modal-body">
          {hasUnpublishedChanges(record) && (
            <div className="exm-banner warn">
              <i className="fa-solid fa-pen" />
              <span>Draft v{record.version} has changes that schools have not received. Live is v{record.publishedVersion}.</span>
            </div>
          )}

          <div className="exm-detail-grid">
            <div className="exm-detail-card">
              <span className="exm-lbl">Versions</span>
              <div className="exm-kv"><span>Draft</span><strong>v{record.version}</strong></div>
              <div className="exm-kv"><span>Live</span><strong>{isLive ? `v${record.publishedVersion}` : 'Not live'}</strong></div>
              {isLive && <div className="exm-kv"><span>Published</span><strong>{fmtStamp(record.publishedAt)}</strong></div>}
              {isLive && <div className="exm-kv"><span>Published by</span><strong>{record.publishedBy}</strong></div>}
            </div>
            <div className="exm-detail-card">
              <span className="exm-lbl">Ownership</span>
              <div className="exm-kv"><span>Created</span><strong>{fmtStamp(record.createdAt)}</strong></div>
              <div className="exm-kv"><span>Created by</span><strong>{record.createdBy}</strong></div>
              <div className="exm-kv"><span>Last edited</span><strong>{fmtStamp(record.updatedAt)}</strong></div>
              <div className="exm-kv"><span>Edited by</span><strong>{record.updatedBy}</strong></div>
            </div>
          </div>

          <div className="exm-detail-section">
            <span className="exm-lbl">{isExam ? 'Exam details' : 'Policy details'}</span>
            {isExam ? (
              <div className="exm-detail-grid">
                <div className="exm-kv"><span>Term</span><strong>{record.term}</strong></div>
                <div className="exm-kv"><span>Dates</span><strong>{fmtDate(record.from)} – {fmtDate(record.to)}</strong></div>
                <div className="exm-kv full"><span>Classes ({classNames.length})</span><strong>{classNames.join(', ') || '—'}</strong></div>
              </div>
            ) : (
              <PolicyBody content={record.content} type={record.type} />
            )}
          </div>

          <div className="exm-detail-section">
            <div className="exm-scope-head">
              <span className="exm-lbl">
                {isLive ? 'Live at' : 'Targets'} {reached.length} of {schools.length} school{schools.length === 1 ? '' : 's'}
              </span>
              <span className="exm-sub">Applies to: {SCOPE_LABEL}</span>
            </div>
            <div className="exm-reach">
              <div className="exm-reach-col yes">
                <h4><i className="fa-solid fa-circle-check" /> {isLive ? 'Published to' : 'Will publish to'}</h4>
                {reached.length === 0 ? <p className="exm-sub">No schools selected yet.</p> : (
                  <ul>{reached.map((s) => <li key={s.id}>{s.name}<span className="exm-sub"> · {s.schoolCode}</span></li>)}</ul>
                )}
              </div>
              <div className="exm-reach-col no">
                <h4><i className="fa-solid fa-circle-minus" /> Not published to</h4>
                {notReached.length === 0 ? <p className="exm-sub">Every school in the chain is included.</p> : (
                  <ul>{notReached.map((s) => <li key={s.id}>{s.name}<span className="exm-sub"> · {s.schoolCode}</span></li>)}</ul>
                )}
              </div>
            </div>
          </div>

          <div className="exm-detail-section">
            <span className="exm-lbl">History</span>
            {(record.history || []).length === 0 ? <p className="exm-sub">No activity yet.</p> : (
              <ol className="exm-timeline">
                {[...record.history].reverse().map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    <span className="exm-tl-dot" />
                    <div>
                      <strong>{h.by}</strong> <span>{h.action}</span>{h.detail ? <span className="exm-sub"> · {h.detail}</span> : null}
                      <div className="exm-sub">{fmtStamp(h.at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="exm-modal-foot">
          <div className="exm-foot-btns wrap">
            {actions.filter((a) => a !== 'edit').map((a) => (
              <button key={a} type="button" className={`exm-btn ${ACTION_META[a].cls === 'primary' ? 'primary' : ACTION_META[a].cls === 'danger' ? 'danger' : 'ghost'}`} onClick={() => onAction(a)}>
                <i className={`fa-solid ${ACTION_META[a].icon}`} /> {ACTION_META[a].label}
              </button>
            ))}
          </div>
          <div className="exm-foot-btns">
            {actions.includes('edit') && (
              <button type="button" className="exm-btn ghost" onClick={onEdit}><i className="fa-solid fa-pen-to-square" /> Edit</button>
            )}
            <button type="button" className="exm-btn ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
