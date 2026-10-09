import { useMemo, useState } from 'react'
import { getSchoolPerms, loadAdvancedPerms } from '../SchoolPermissions/data'
import { cachedPermissions } from '../../api/schoolPermissionsApi'
import {
  EXAM_STATUS, STATUS_META, examStatusByDate, hasUnpublishedChanges, publishableSchools,
  buildErpHandoff, byPublishedDesc,
} from './data'

/* ═══════════════════════════════════════════════════════════════════
   Overview — what Head Office sees first: the state of the chain's
   exams and policies, what is live, and the per-school handoff.

   Delivery is NOT tracked automatically in this build (no backend yet).
   The handoff copies each school's package; the UI therefore reports
   "Awaiting school import" rather than a synced/failed status it cannot
   verify.
   ═══════════════════════════════════════════════════════════════════ */

const fmtStamp = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—')

export default function Overview({ store, onOpen, onGoTo, flash }) {
  const schools = publishableSchools()
  const [copiedId, setCopiedId] = useState(null)

  const kpi = useMemo(() => {
    const exams = store.exams.filter((e) => e.status !== EXAM_STATUS.ARCHIVED)
    const policies = store.policies.filter((p) => p.status !== EXAM_STATUS.ARCHIVED)
    const liveExams = store.exams.filter((e) => e.status === EXAM_STATUS.PUBLISHED)
    const livePolicies = store.policies.filter((p) => p.status === EXAM_STATUS.PUBLISHED)
    const affected = new Set([
      ...liveExams.flatMap((e) => e.publishedSnapshot.schoolIds),
      ...livePolicies.flatMap((p) => p.publishedSnapshot.schoolIds),
    ])
    return {
      totalExams: exams.length,
      draftExams: exams.filter((e) => e.status === EXAM_STATUS.DRAFT).length,
      readyExams: exams.filter((e) => e.status === EXAM_STATUS.READY).length,
      publishedExams: liveExams.length,
      scheduled: liveExams.filter((e) => examStatusByDate(e) === 'upcoming').length,
      completed: liveExams.filter((e) => examStatusByDate(e) === 'completed').length,
      schoolsAffected: affected.size,
      totalPolicies: policies.length,
      publishedPolicies: livePolicies.length,
      awaitingImport: liveExams.length + livePolicies.length,
      unpublishedChanges: [...liveExams, ...livePolicies].filter(hasUnpublishedChanges).length,
    }
  }, [store])

  const recent = useMemo(() => [
    ...store.exams.filter((e) => e.publishedAt).map((e) => ({ ...e, kind: 'exam' })),
    ...store.policies.filter((p) => p.publishedAt).map((p) => ({ ...p, kind: 'policy' })),
  ].sort(byPublishedDesc).slice(0, 6), [store])

  const handoffRows = useMemo(() => schools.map((s) => {
    const liveExams = store.exams.filter((e) => e.status === EXAM_STATUS.PUBLISHED && e.publishedSnapshot.schoolIds.includes(s.id))
    const livePolicies = store.policies.filter((p) => p.status === EXAM_STATUS.PUBLISHED && p.publishedSnapshot.schoolIds.includes(s.id))
    const gradePolicy = livePolicies.find((p) => p.type === 'grade') || null
    const preschoolPolicy = livePolicies.find((p) => p.type === 'preschool') || null
    return { school: s, exams: liveExams.length, gradePolicy, preschoolPolicy }
  }), [schools, store])

  const copyHandoff = async (school) => {
    const cached = cachedPermissions()
    const perms = {
      ...getSchoolPerms(cached.mods, school, cached.erp?.[school.id]),
      modulePermissions: loadAdvancedPerms(school.id),
    }
    const text = JSON.stringify(buildErpHandoff(school, perms, store), null, 2)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* clipboard unavailable — user sees the error toast below */ }
      document.body.removeChild(ta)
    }
    setCopiedId(school.id)
    flash('success', `Package copied for ${school.name}. Paste it into the school's ERP → Settings → Chain School.`)
    setTimeout(() => setCopiedId(null), 1800)
  }

  const tiles = [
    { label: 'Total exams', value: kpi.totalExams, icon: 'fa-file-signature', tone: 'blue', go: () => onGoTo('exams') },
    { label: 'Draft exams', value: kpi.draftExams, sub: `${kpi.readyExams} ready to publish`, icon: 'fa-pen', tone: 'gray', go: () => onGoTo('exams') },
    { label: 'Published exams', value: kpi.publishedExams, icon: 'fa-bullhorn', tone: 'green', go: () => onGoTo('exams') },
    { label: 'Upcoming', value: kpi.scheduled, sub: 'Published, not started', icon: 'fa-calendar-day', tone: 'blue', go: () => onGoTo('exams') },
    { label: 'Completed', value: kpi.completed, sub: 'Published, ended', icon: 'fa-circle-check', tone: 'gray', go: () => onGoTo('exams') },
    { label: 'Schools affected', value: kpi.schoolsAffected, sub: `of ${schools.length} in chain`, icon: 'fa-building-columns', tone: 'blue' },
    { label: 'Result policies', value: kpi.totalPolicies, icon: 'fa-square-poll-vertical', tone: 'amber', go: () => onGoTo('policies') },
    { label: 'Published policies', value: kpi.publishedPolicies, icon: 'fa-stamp', tone: 'green', go: () => onGoTo('policies') },
    { label: 'Awaiting school import', value: kpi.awaitingImport, sub: 'Live items, delivery not tracked', icon: 'fa-hourglass-half', tone: 'amber' },
    { label: 'Unpublished changes', value: kpi.unpublishedChanges, sub: 'Edited since last publish', icon: 'fa-pen-to-square', tone: 'amber' },
  ]

  return (
    <div className="exm-overview">
      <div className="exm-kpis">
        {tiles.map((t) => (
          <button type="button" key={t.label} className={`exm-kpi ${t.tone}${t.go ? ' clickable' : ''}`} onClick={t.go} disabled={!t.go}>
            <span className="exm-kpi-icon"><i className={`fa-solid ${t.icon}`} /></span>
            <span className="exm-kpi-val">{t.value}</span>
            <span className="exm-kpi-lbl">{t.label}</span>
            {t.sub && <span className="exm-kpi-sub">{t.sub}</span>}
          </button>
        ))}
      </div>

      <div className="exm-two-col">
        <section className="exm-panel">
          <header className="exm-panel-hdr">
            <h2><i className="fa-solid fa-clock-rotate-left" /> Recently published</h2>
          </header>
          {recent.length === 0 ? (
            <div className="exm-empty compact">
              <h3>Nothing published yet</h3>
              <p>Publish an exam or result policy and it will appear here.</p>
            </div>
          ) : (
            <ul className="exm-recent">
              {recent.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button type="button" className="exm-recent-row" onClick={() => onOpen(r.kind, r.id)}>
                    <span className={`exm-recent-kind ${r.kind}`}><i className={`fa-solid ${r.kind === 'exam' ? 'fa-file-signature' : 'fa-square-poll-vertical'}`} /></span>
                    <span className="exm-recent-main">
                      <strong>{r.name}</strong>
                      <span className="exm-sub">
                        {r.kind === 'exam' ? 'Exam' : 'Result policy'} · v{r.publishedVersion} · {r.publishedSnapshot.schoolIds.length} school{r.publishedSnapshot.schoolIds.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="exm-recent-when">
                      {fmtStamp(r.publishedAt)}
                      <span className="exm-sub">{r.publishedBy}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="exm-panel">
          <header className="exm-panel-hdr">
            <h2><i className="fa-solid fa-building-columns" /> Status by lifecycle</h2>
          </header>
          <ul className="exm-legend">
            {Object.entries(STATUS_META).map(([key, m]) => (
              <li key={key}><span className={`badge ${m.cls}`}><i className={`fa-solid ${m.icon}`} /> {m.label}</span></li>
            ))}
          </ul>
          <p className="exm-note">
            <i className="fa-solid fa-circle-info" /> Head Office edits stay drafts until you publish. A school only ever receives the last published version.
          </p>
        </section>
      </div>

      <section className="exm-panel">
        <header className="exm-panel-hdr">
          <h2><i className="fa-solid fa-share-from-square" /> School handoff</h2>
          <span className="exm-sub">Exams and result policy currently live for each school</span>
        </header>
        <p className="exm-note warn">
          <i className="fa-solid fa-triangle-exclamation" /> Delivery is manual in this build. Copy a school's package and paste it into that school's ERP (Settings → Chain School). Head Office cannot yet see whether a school has imported it.
        </p>

        {schools.length === 0 ? (
          <div className="exm-empty compact">
            <h3>No schools in this chain</h3>
            <p>Add schools in School Permissions before publishing.</p>
          </div>
        ) : (
          <div className="exm-table-wrap">
            <table className="exm-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Live exams</th>
                  <th>Grade 1–12 policy</th>
                  <th>Preschool policy</th>
                  <th className="r">Package</th>
                </tr>
              </thead>
              <tbody>
                {handoffRows.map(({ school, exams, gradePolicy, preschoolPolicy }) => (
                  <tr key={school.id}>
                    <td>
                      <div className="exm-school-cell">
                        <span className="exm-school-av sm">{school.initials}</span>
                        <div>
                          <div>{school.name}</div>
                          <div className="exm-sub">{school.schoolCode}</div>
                        </div>
                      </div>
                    </td>
                    <td>{exams ? <span className="badge b-green">{exams}</span> : <span className="exm-sub">None</span>}</td>
                    <td>{gradePolicy ? <span className="badge b-warn">{gradePolicy.name}</span> : <span className="exm-sub">None</span>}</td>
                    <td>{preschoolPolicy ? <span className="badge b-warn">{preschoolPolicy.name}</span> : <span className="exm-sub">None</span>}</td>
                    <td className="r">
                      <button type="button" className="exm-btn ghost sm" onClick={() => copyHandoff(school)}>
                        <i className={`fa-solid ${copiedId === school.id ? 'fa-check' : 'fa-copy'}`} /> {copiedId === school.id ? 'Copied' : 'Copy package'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
