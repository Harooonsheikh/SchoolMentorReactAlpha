import { useEffect, useMemo, useRef, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import { loadAcademics, saveAcademics, className, subjectName, subjectsOfClass, LP_SECTIONS, AQ_TYPES, AQ_CONFIG, aqLabel, sessionStats, vacationSpan, loadResources, saveResources, RES_CATEGORIES, RES_STATUS, resCategory, nextResourceId } from '../../config/academicsStore'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import { useView } from '../../config/viewContext'
import './Academics.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ACT_STATUS = { upcoming: { label: 'Scheduled', color: '#1E40AF' }, ongoing: { label: 'Ongoing', color: '#D97706' }, completed: { label: 'Completed', color: '#16A34A' } }
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return iso } }
const todayISO = () => new Date().toISOString().slice(0, 10)

const GROUPS = {
  scheme: { label: 'Activity Calendar', icon: 'fa-calendar-week', subs: [
    ['act-cal', 'Activity Calendar', 'fa-calendar-week'],
  ] },
  lessons: { label: 'Lesson Plans', icon: 'fa-list-ul', subs: [
    ['lesson-plans', 'Lesson Plans', 'fa-list-ul'],
    ['notebook-plans', 'Notebook Plans', 'fa-book-open'],
  ] },
  resources: { label: 'Resource Library', icon: 'fa-folder-open', subs: [
    ['resources', 'Resource Library', 'fa-folder-open'],
  ] },
}

export default function Academics() {
  const { schools: connectedSchools } = useView()
  const [a, setA] = useState(null)
  const [group, setGroup] = useState('scheme')
  const [sub, setSub] = useState('act-cal')
  const [view, setView] = useState('current') // 'current' draft | release id
  const [modalType, setModalType] = useState(null) // 'master' | 'sub'
  const [revoke, setRevoke] = useState(null) // release pending revoke confirmation
  const [toast, setToast] = useState(null)

  useEffect(() => { setA(loadAcademics()) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])
  const fire = (text, type = 'success') => setToast({ text, type })
  const commit = (next) => { setA(next); saveAcademics(next) }
  if (!a) return null

  const switchGroup = (g) => { setGroup(g); setSub(GROUPS[g].subs[0][0]) }
  const releases = a.releases || []
  const draftReleases = releases.filter((r) => releaseStatusOf(r) !== 'ACTIVE') // Releases & Drafts (non-live)

  const viewedRelease = view !== 'current' ? releases.find((r) => r.id === view) : null
  const isLiveView = !!viewedRelease && releaseStatusOf(viewedRelease) === 'ACTIVE'
  const snap = viewedRelease?.snapshot
  const aView = viewedRelease && snap ? { ...a, lessonPlans: snap.lessonPlans || [], notebookPlans: snap.notebookPlans || [], activityCalendar: snap.activityCalendar || [] } : a
  // Editing a non-live release writes back to its snapshot; live = read-only; current = the live draft
  const commitRelease = (relId) => (next) => commit({ ...a, releases: a.releases.map((r) => (r.id === relId ? { ...r, snapshot: { ...r.snapshot, lessonPlans: next.lessonPlans, notebookPlans: next.notebookPlans, activityCalendar: next.activityCalendar }, updatedAt: new Date().toISOString() } : r)) })
  const updateReleaseResources = (relId) => (nextRes) => commit({ ...a, releases: a.releases.map((r) => (r.id === relId ? { ...r, snapshot: { ...r.snapshot, resources: nextRes }, updatedAt: new Date().toISOString() } : r)) })
  const commitView = isLiveView ? () => {} : (viewedRelease ? commitRelease(viewedRelease.id) : commit)
  const resourcesView = viewedRelease ? (snap.resources || []) : undefined
  const onResourcesView = isLiveView || !viewedRelease ? undefined : updateReleaseResources(viewedRelease.id)
  const workspaceContent = viewedRelease ? { a: aView, resources: snap.resources || [] } : { a, resources: (() => { try { return loadResources() } catch { return [] } })() }
  const workspaceName = view === 'current' ? 'Current Draft' : (viewedRelease?.label || 'Workspace')

  const createNewRelease = () => {
    commit({ ...a, lessonPlans: [], notebookPlans: [], activityCalendar: [], released: false, release: null })
    saveResources([])
    setView('current')
    fire('New blank release started — build content for the three sections, then release', 'success')
  }

  const applyRelease = (type, opts, summary) => {
    const { validityDays, dueDate, schools, parentReleaseId, content } = opts
    const releaseType = type === 'master' ? 'MASTER_RELEASE' : 'SUB_RELEASE'
    const number = releases.filter((r) => r.releaseType === releaseType).length + 1
    const seq = (a.releaseSeq || 0) + 1
    const nowISO = new Date().toISOString()
    const title = `${type === 'master' ? 'Master' : 'Sub'} Release ${number}`
    const allIds = connectedSchools.map((s) => s.id)
    const snapshot = {
      lessonPlans: JSON.parse(JSON.stringify(content.a.lessonPlans || [])),
      notebookPlans: JSON.parse(JSON.stringify(content.a.notebookPlans || [])),
      activityCalendar: JSON.parse(JSON.stringify(content.a.activityCalendar || [])),
      resources: JSON.parse(JSON.stringify(content.resources || [])),
    }
    const release = {
      id: `rel-${seq}-${Date.now()}`,
      releaseType, releaseTitle: title, label: title, releaseNumber: number, version: seq,
      batchId: `${type === 'master' ? 'MR' : 'SR'}-${new Date().getFullYear()}-${String(number).padStart(3, '0')}`,
      parentReleaseId: parentReleaseId || null, headOfficeId: 'HO-001',
      appliesToAllSchools: type === 'master',
      selectedSchoolIds: type === 'master' ? allIds : schools,
      schoolCount: (type === 'master' ? allIds : schools).length,
      releasedAt: nowISO, createdAt: nowISO, updatedAt: nowISO,
      validityDays, validUntil: addDaysISO(validityDays), dueDate: dueDate || null,
      releasedBy: 'Head Office', releaseStatus: 'ACTIVE',
      contentSummary: summary.totals, classWiseSummary: summary.classes,
      activityIds: snapshot.activityCalendar.map((x) => x.id),
      lessonPlanIds: snapshot.lessonPlans.map((u) => u.id),
      notebookPlanIds: snapshot.notebookPlans.map((u) => u.id),
      resourceLibraryIds: snapshot.resources.map((r) => r.id),
      snapshot,
    }
    commit({ ...a, released: true, releasedAt: nowISO.slice(0, 10), releaseSeq: seq, release, releases: [...releases, release] })
    setModalType(null)
    fire(`${title} published · ${release.batchId}`, 'success')
  }

  const doRevoke = () => {
    const id = revoke.id
    commit({ ...a, releases: releases.map((r) => (r.id === id ? { ...r, releaseStatus: 'ARCHIVED', updatedAt: new Date().toISOString() } : r)) })
    setView(id) // bring it into the editable workspace
    fire(`${revoke.label} revoked — moved to Releases & Drafts, now editable`, 'info')
    setRevoke(null)
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-graduation-cap" /></div>
          <div><div className="page-title">Academics</div><div className="page-sub">Build your chain's academic content once — release it to member schools when ready.</div></div>
        </div>
        <TutorialButton />
      </div>

      {/* 1 — Currently live */}
      <LiveReleasesCard releases={releases} onView={setView} onCreate={setModalType} onRevoke={setRevoke} />

      {/* 2 — Releases & Drafts (only non-live editable workspaces) */}
      <div className="ac-rel-bar">
        <span className="ac-rel-bar-lbl"><i className="fa-solid fa-layer-group" /> Releases &amp; Drafts</span>
        <div className="ac-rel-btns">
          <button className={`ac-rel-btn${view === 'current' ? ' active' : ''}`} onClick={() => setView('current')}><i className="fa-solid fa-pen-to-square" /> Current Draft</button>
          {draftReleases.map((r) => (
            <button key={r.id} className={`ac-rel-btn ${r.releaseType === 'SUB_RELEASE' ? 'sub' : 'master'}${view === r.id ? ' active' : ''}`} onClick={() => setView(r.id)} title={`${r.batchId} · ${releaseStatusOf(r) === 'EXPIRED' ? 'expired' : 'revoked'} · editable`}><i className={`fa-solid ${r.releaseType === 'SUB_RELEASE' ? 'fa-code-branch' : 'fa-globe'}`} /> {r.label} <span className="ac-rel-st">{releaseStatusOf(r) === 'EXPIRED' ? 'Expired' : 'Revoked'}</span></button>
          ))}
          <button className="ac-rel-btn new" onClick={createNewRelease}><i className="fa-solid fa-plus" /> Create New Release</button>
        </div>
      </div>

      {/* 3 — Release Control panel (contextual to selected workspace) */}
      <ReleaseBar workspaceName={workspaceName} workspaceContent={workspaceContent} isCurrent={view === 'current'} isLiveView={isLiveView} onCreate={setModalType} />

      {/* Live read-only notice */}
      {isLiveView && (
        <div className="ac-rel-viewing">
          <i className="fa-solid fa-eye" /> <span>Viewing live release snapshot of <strong>{viewedRelease.label}</strong> ({viewedRelease.batchId}) — live for {viewedRelease.appliesToAllSchools ? 'all member schools' : `${viewedRelease.schoolCount} selected school${viewedRelease.schoolCount !== 1 ? 's' : ''}`}{viewedRelease.validUntil ? `, valid until ${fmtDate(viewedRelease.validUntil)}` : ''}. Revoke this release if you need to edit and release it again.</span>
          <button className="btn-sm res-keep" onClick={() => setView('current')}><i className="fa-solid fa-arrow-left" /> Back to Current Draft</button>
        </div>
      )}
      {viewedRelease && !isLiveView && (
        <div className="ac-rel-editing">
          <i className="fa-solid fa-pen" /> <span>Editing <strong>{viewedRelease.label}</strong> ({viewedRelease.batchId}) — {releaseStatusOf(viewedRelease) === 'EXPIRED' ? 'expired' : 'revoked'} workspace. Make changes, then release it again from Release Control above.</span>
          <button className="btn-sm res-keep" onClick={() => setView('current')}><i className="fa-solid fa-arrow-left" /> Back to Current Draft</button>
        </div>
      )}

      {/* 4 — Academic content tabs */}
      <div className="ac-l1">
        {Object.entries(GROUPS).map(([g, cfg]) => (
          <button key={g} className={`ac-l1-tab${group === g ? ' active' : ''}`} onClick={() => switchGroup(g)}><i className={`fa-solid ${cfg.icon}`} /> {cfg.label}</button>
        ))}
      </div>

      {GROUPS[group].subs.length > 1 && (
        <div className="ac-subtabs">
          {GROUPS[group].subs.map(([k, lbl, ic]) => (
            <button key={k} className={`ac-subtab${sub === k ? ' active' : ''}`} onClick={() => setSub(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
          ))}
        </div>
      )}

      <div key={view} className={isLiveView ? 'ac-readonly' : undefined}>
        {sub === 'act-cal' && <ActivityCalendar a={aView} commit={commitView} fire={fire} />}
        {sub === 'lesson-plans' && <LessonPlans a={aView} commit={commitView} fire={fire} />}
        {sub === 'notebook-plans' && <NotebookPlans a={aView} commit={commitView} fire={fire} />}
        {sub === 'resources' && <OtherResources a={aView} fire={fire} resources={resourcesView} onResources={onResourcesView} />}
        {/* legacy screens (kept for data; no tabs render these now) */}
        {sub === 'textbooks' && <Textbooks a={aView} commit={commitView} fire={fire} />}
        {sub === 'terms' && <TermSettings a={aView} commit={commitView} fire={fire} />}
        {sub === 'session' && <SessionSettings a={aView} commit={commitView} fire={fire} />}
        {sub === 'acad-cal' && <AcademicCalendar a={aView} commit={commitView} fire={fire} />}
        {sub === 'breakup' && <TermBreakups a={aView} commit={commitView} fire={fire} />}
      </div>

      {modalType && <ReleaseModal type={modalType} a={a} releases={releases} baseContent={workspaceContent} baseLabel={workspaceName} onClose={() => setModalType(null)} onRelease={applyRelease} />}

      {revoke && createPortal(
        <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setRevoke(null) }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '36px 30px' }}>
              <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-ban" /></div>
              <div className="confirm-title">Revoke {revoke.label}?</div>
              <div className="confirm-sub">This release will be taken down immediately. {revoke.appliesToAllSchools ? 'All member schools' : `The ${revoke.schoolCount} selected school${revoke.schoolCount !== 1 ? 's' : ''}`} will no longer be able to pull this content. It stays in your release history and can be re-released later.</div>
              <div className="confirm-btns"><button className="btn-secondary" onClick={() => setRevoke(null)}>Cancel</button><button className="btn-danger" onClick={doRevoke}><i className="fa-solid fa-ban" /> Revoke Release</button></div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {toast && createPortal(<div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>, document.body)}
    </>
  )
}

/* ── Release helpers ── */
const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth']
const ordinalWord = (n) => ORDINALS[n - 1] || `${n}th`
const addDaysISO = (days) => { const d = new Date(); d.setDate(d.getDate() + Number(days)); return d.toISOString().slice(0, 10) }
function releaseState(a) {
  if (!a.released) return 'CLOSED'
  const vu = a.release?.validUntil
  if (vu && new Date() > new Date(`${vu}T23:59:59`)) return 'EXPIRED'
  return 'OPEN'
}
/* Counts releasable academic content class-wise + general (dynamic, from store). */
function computeReleaseSummary(a, resources) {
  const classes = a.classes.map((c) => {
    const lessonsBySubj = {}; let lessons = 0
    a.lessonPlans.filter((u) => u.classId === c.id).forEach((u) => { const n = u.lessons?.length || 0; lessons += n; lessonsBySubj[u.subjectId] = (lessonsBySubj[u.subjectId] || 0) + n })
    const notebooksBySubj = {}
    a.notebookPlans.filter((u) => u.classId === c.id).forEach((u) => { notebooksBySubj[u.subjectId] = (notebooksBySubj[u.subjectId] || 0) + 1 })
    const notebooks = a.notebookPlans.filter((u) => u.classId === c.id).length
    const tbBySubj = {}
    a.textbooks.filter((t) => t.classId === c.id).forEach((t) => { tbBySubj[t.subjectId] = (tbBySubj[t.subjectId] || 0) + 1 })
    const textbooks = a.textbooks.filter((t) => t.classId === c.id).length
    const termBySubj = {}; let termUnits = 0
    Object.values(a.termBreakups[c.id] || {}).forEach((bySubj) => Object.entries(bySubj).forEach(([sid, units]) => { const n = (units || []).length; termUnits += n; termBySubj[sid] = (termBySubj[sid] || 0) + n }))
    const res = resources.filter((r) => r.classId === c.id)
    const resByCat = { worksheet: 0, summer: 0, qpaper: 0, other: 0 }
    res.forEach((r) => { resByCat[r.category] = (resByCat[r.category] || 0) + 1 })
    const resourcesTotal = res.length
    const total = lessons + notebooks + resourcesTotal
    return { classId: c.id, name: c.name, lessons, notebooks, textbooks, termUnits, resourcesTotal, resByCat, lessonsBySubj, notebooksBySubj, tbBySubj, termBySubj, total }
  }).filter((x) => x.total > 0)
  const sum = (k) => classes.reduce((n, c) => n + c[k], 0)
  const activities = a.activityCalendar?.length || 0
  return {
    classes,
    totals: { classes: classes.length, lessons: sum('lessons'), notebooks: sum('notebooks'), resourceFiles: sum('resourcesTotal'), activities },
    general: { activities },
  }
}

/* Live status of a release (auto-expires past validUntil). */
function releaseStatusOf(r) {
  if (r?.releaseStatus === 'ARCHIVED') return 'ARCHIVED'
  if (r?.validUntil && new Date() > new Date(`${r.validUntil}T23:59:59`)) return 'EXPIRED'
  return 'ACTIVE'
}

/* ── Release Control panel — contextual to the selected workspace ── */
function ReleaseBar({ workspaceName, workspaceContent, isCurrent, isLiveView, onCreate }) {
  const summary = useMemo(() => computeReleaseSummary(workspaceContent.a, workspaceContent.resources), [workspaceContent])
  const t = summary.totals
  const empty = (t.lessons + t.notebooks + t.resourceFiles + t.activities) === 0
  const masterLbl = isCurrent ? 'Create Master Release' : 'Release as Master Release'
  const subLbl = isCurrent ? 'Create Sub Release' : 'Release as Sub Release'

  if (isLiveView) {
    return (
      <div className="ac-release rc-panel">
        <div className="ac-release-left">
          <div className="ac-release-ic" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}><i className="fa-solid fa-tower-broadcast" /></div>
          <div style={{ minWidth: 0 }}>
            <div className="ac-release-title">Release Selected Workspace</div>
            <div className="ac-release-desc">This release is <strong>live</strong>. Revoke it from “Currently Live for Schools” to edit and release it again.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ac-release rc-panel">
      <div className="ac-release-left">
        <div className="ac-release-ic"><i className="fa-solid fa-cloud-arrow-up" /></div>
        <div style={{ minWidth: 0 }}>
          <div className="ac-release-title">Release Selected Workspace</div>
          <div className="ac-release-desc">Choose how to release the selected academic workspace to schools.</div>
          <div className="rc-ws"><span className="rc-ws-k">Selected Workspace</span><span className="rc-ws-v"><i className="fa-solid fa-pen-to-square" /> {workspaceName}</span></div>
          <div className="rc-summary">
            <span><i className="fa-solid fa-calendar-week" /> {t.activities} Activities</span>
            <span><i className="fa-solid fa-list-ul" /> {t.lessons} Lesson Plans</span>
            <span><i className="fa-solid fa-book-open" /> {t.notebooks} Notebook Plans</span>
            <span><i className="fa-solid fa-folder-open" /> {t.resourceFiles} Resource Files</span>
          </div>
        </div>
      </div>
      <div className="ac-rel-actions">
        <button className="btn-primary" disabled={empty} onClick={() => onCreate('master')}><i className="fa-solid fa-globe" /> {masterLbl}</button>
        <button className="btn-secondary" disabled={empty} onClick={() => onCreate('sub')}><i className="fa-solid fa-code-branch" /> {subLbl}</button>
      </div>
    </div>
  )
}

/* ── Currently Live for Schools ── */
function LiveReleaseTile({ r, onView, onRevoke }) {
  const isSub = r.releaseType === 'SUB_RELEASE'
  return (
    <div className={`live-tile ${isSub ? 'sub' : 'master'}`}>
      <div className="live-tile-top">
        <div className="live-tile-ic"><i className={`fa-solid ${isSub ? 'fa-code-branch' : 'fa-globe'}`} /></div>
        <div className="live-tile-name">{r.label}</div>
        <span className="badge b-green live-badge"><i className="fa-solid fa-circle" style={{ fontSize: 6 }} /> Live</span>
      </div>
      <div className="live-aud">{r.appliesToAllSchools ? 'All Member Schools' : 'Selected Schools Only'}</div>
      <div className="live-rows">
        <div className="live-row"><span>Released to</span><strong>{r.schoolCount} School{r.schoolCount !== 1 ? 's' : ''}</strong></div>
        <div className="live-row"><span>Released on</span><strong>{fmtDate((r.releasedAt || '').slice(0, 10))}</strong></div>
        <div className="live-row"><span>Valid until</span><strong>{r.validUntil ? fmtDate(r.validUntil) : '—'}</strong></div>
      </div>
      <div className="live-actions">
        <button className="btn-sm res-keep live-view" onClick={() => onView(r.id)}><i className="fa-solid fa-eye" /> View</button>
        <button className="btn-sm live-revoke res-keep" onClick={() => onRevoke(r)}><i className="fa-solid fa-ban" /> Revoke</button>
      </div>
    </div>
  )
}

function LiveReleasesCard({ releases, onView, onCreate, onRevoke }) {
  const live = releases.filter((r) => releaseStatusOf(r) === 'ACTIVE')
  const ordered = [...live.filter((r) => r.releaseType === 'MASTER_RELEASE'), ...live.filter((r) => r.releaseType === 'SUB_RELEASE')]
  return (
    <div className="section-card live-card">
      <div className="card-header">
        <div><div className="card-title"><i className="fa-solid fa-tower-broadcast" /> Currently Live for Schools</div><div className="card-sub">View the releases currently available to member schools.</div></div>
      </div>
      <div style={{ padding: 16 }}>
        {ordered.length === 0 ? (
          <div className="live-empty">
            <i className="fa-solid fa-satellite-dish" />
            <div className="live-empty-title">No live releases currently available to schools</div>
            <div className="live-empty-sub">Create a Master Release or Sub Release to make academic content available to member schools.</div>
            <div className="live-empty-btns">
              <button className="btn-primary" onClick={() => onCreate('master')}><i className="fa-solid fa-globe" /> Create Master Release</button>
              <button className="btn-secondary" onClick={() => onCreate('sub')}><i className="fa-solid fa-code-branch" /> Create Sub Release</button>
            </div>
          </div>
        ) : (
          <div className="live-grid">
            {ordered.map((r) => <LiveReleaseTile key={r.id} r={r} onView={onView} onRevoke={onRevoke} />)}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Master / Sub release modal ── */
function ReleaseModal({ a, type, releases, baseContent, baseLabel, onClose, onRelease }) {
  const isSub = type === 'sub'
  const [source, setSource] = useState('base') // sub: 'base' (selected workspace) | release id
  const sourceRelease = isSub && source !== 'base' ? releases.find((r) => r.id === source) : null
  const content = useMemo(() => (sourceRelease ? {
    a: { ...a, lessonPlans: sourceRelease.snapshot?.lessonPlans || [], notebookPlans: sourceRelease.snapshot?.notebookPlans || [], activityCalendar: sourceRelease.snapshot?.activityCalendar || [] },
    resources: sourceRelease.snapshot?.resources || [],
  } : baseContent), [sourceRelease, baseContent])
  const summary = useMemo(() => computeReleaseSummary(content.a, content.resources), [content])
  const t = summary.totals
  const noContent = (t.lessons + t.notebooks + t.resourceFiles + t.activities) === 0

  /* Schools ab API se aate hain (ViewProvider), is liye list async bharti hai —
     master release ka "sab select" schools aane par set hota hai. */
  const { schools: connectedSchools } = useView()
  const [days, setDays] = useState('30')
  const [dueDate, setDueDate] = useState(() => addDaysISO(30))
  const [schoolSel, setSchoolSel] = useState(() => new Set())
  useEffect(() => {
    if (!isSub) setSchoolSel(new Set(connectedSchools.map((s) => s.id)))
  }, [isSub, connectedSchools])
  const [schoolQ, setSchoolQ] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [open, setOpen] = useState({})

  const dn = Number(days)
  const validDays = days !== '' && Number.isFinite(dn) && dn >= 1 && dn <= 365
  const err = days === '' ? 'Validity days is required.' : (!Number.isFinite(dn) || dn < 1 ? 'Enter a positive number of days.' : dn > 365 ? 'Maximum recommended is 365 days.' : '')
  const releaseDate = todayISO()
  const validUntil = validDays ? addDaysISO(dn) : null
  const shortValidity = validDays && dn < 7

  const schoolList = connectedSchools.filter((s) => { const q = schoolQ.trim().toLowerCase(); return !q || s.name.toLowerCase().includes(q) || (s.phone || '').includes(q) })
  const allSchools = connectedSchools.length > 0 && schoolSel.size === connectedSchools.length
  const toggleSchool = (id) => setSchoolSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAllSchools = () => setSchoolSel(allSchools ? new Set() : new Set(connectedSchools.map((s) => s.id)))
  const canRelease = validDays && confirm && !noContent && (!isSub || schoolSel.size > 0)
  const nextNo = releases.filter((r) => r.releaseType === (isSub ? 'SUB_RELEASE' : 'MASTER_RELEASE')).length + 1
  const nextBatch = `${isSub ? 'SR' : 'MR'}-${new Date().getFullYear()}-${String(nextNo).padStart(3, '0')}`

  const subjRows = (map) => Object.entries(map).filter(([, n]) => n > 0).map(([sid, n]) => <div className="rel-row" key={sid}><span>{subjectName(a, Number(sid))}</span><span className="rel-row-n">{n}</span></div>)
  const card = (icon, val, lbl, accent) => <div className={`rel-sum ${accent || ''}`}><div className="rel-sum-ic"><i className={`fa-solid ${icon}`} /></div><div><div className="rel-sum-val">{val}</div><div className="rel-sum-lbl">{lbl}</div></div></div>
  const submit = () => onRelease(type, { validityDays: dn, dueDate, schools: [...schoolSel], parentReleaseId: sourceRelease?.id || null, content }, summary)

  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal rel-modal">
        <div className="pay-modal-hdr" style={{ background: isSub ? 'linear-gradient(135deg,#6D28D9,#7C3AED)' : 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
          <div className="pay-modal-av" style={{ background: 'rgba(255,255,255,.15)' }}><i className={`fa-solid ${isSub ? 'fa-code-branch' : 'fa-globe'}`} /></div>
          <div><div className="pay-modal-title" style={{ color: '#fff' }}>{isSub ? 'Create Sub Release' : 'Create Master Release'}</div><div className="pay-modal-sub" style={{ color: 'rgba(255,255,255,.85)' }}>Review the content summary before releasing it to {isSub ? 'selected schools' : 'all member schools'}.</div></div>
          <button className="pay-modal-x" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="pay-modal-body">
          {/* Release type + audience */}
          <div className={`rel-type ${isSub ? 'sub' : 'master'}`}>
            <div className="rel-type-row">
              <div><div className="rel-type-k">Release Type</div><div className="rel-type-v">{isSub ? 'Sub Release' : 'Master Release'}</div></div>
              <div><div className="rel-type-k">Audience</div><div className="rel-type-v">{isSub ? 'Selected Schools Only' : 'All Member Schools'}</div></div>
            </div>
            <div className="rel-type-exp"><i className="fa-solid fa-circle-info" /> {isSub
              ? 'This release will be available only to the selected schools. Other schools will not see this sub release, and the Master Release for all schools is not affected.'
              : 'This release will be available to all member schools connected with this Head Office. All schools will be able to access and pull it during the validity period.'}</div>
          </div>

          {noContent ? (
            <div className="ac-empty"><i className="fa-solid fa-folder-open" /><div style={{ fontSize: 14, fontWeight: 700 }}>No academic content is available for release</div><div style={{ fontSize: 12.5, marginTop: 4 }}>Add lesson plans, notebook plans, resources or activities first{isSub ? ', or pick a different content source above' : ''}.</div></div>
          ) : null}

          {/* Sub release content source */}
          {isSub && releases.length > 0 && (
            <>
              <div className="rel-sec-h"><i className="fa-solid fa-clone" /> Content Source</div>
              <div className="ac-field" style={{ maxWidth: 360 }}>
                <label>Build this sub release from</label>
                <select className="ac-input" value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="base">Selected workspace — {baseLabel}</option>
                  {releases.map((r) => <option key={r.id} value={r.id}>{r.label} ({r.batchId})</option>)}
                </select>
              </div>
              <div className="rel-help">Re-release missed or additional content from a past Master/Sub release to selected schools, without disturbing the Master Release.</div>
            </>
          )}

          {!noContent && (
            <>
              {/* Top summary cards */}
              <div className="rel-sec-h"><i className="fa-solid fa-chart-simple" /> Content Summary</div>
              <div className="rel-sum-grid">
                {card('fa-calendar-week', t.activities, 'Activities', 'r-blue')}
                {card('fa-list-ul', t.lessons, 'Lesson Plans', 'r-teal')}
                {card('fa-book-open', t.notebooks, 'Notebook Plans', 'r-purple')}
                {card('fa-folder-open', t.resourceFiles, 'Resource Files', 'r-amber')}
                {card('fa-chalkboard', t.classes, 'Classes', 'r-blue')}
                {card('fa-hourglass-half', validDays ? `${dn}d` : '—', 'Validity', 'r-green')}
              </div>

              {/* Release validity */}
              <div className="rel-sec-h"><i className="fa-solid fa-hourglass-half" /> Release Validity</div>
              <div className="rel-validity">
                <div className="ac-field" style={{ maxWidth: 160 }}><label>Validity Days *</label><input className="ac-input" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. 30" /></div>
                <div className="ac-field" style={{ maxWidth: 180 }}><label>Due Date</label><input className="ac-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                <div className="rel-dates">
                  <div className="rel-date"><div className="rel-date-lbl">Release Date</div><div className="rel-date-val">{fmtDate(releaseDate)}</div></div>
                  <i className="fa-solid fa-arrow-right-long rel-date-arrow" />
                  <div className="rel-date"><div className="rel-date-lbl">Valid Until</div><div className="rel-date-val">{validUntil ? fmtDate(validUntil) : '—'}</div></div>
                </div>
              </div>
              <div className="rel-help">Schools can pull this content for the selected number of days. The due date is the recommended deadline shown to schools.</div>
              {err && <div className="rel-err"><i className="fa-solid fa-circle-exclamation" /> {err}</div>}

              {/* School selection — Sub release only */}
              {isSub && (
                <>
                  <div className="rel-sec-h"><i className="fa-solid fa-school" /> Selected Schools <span className="rel-sec-count">{schoolSel.size} selected</span></div>
                  <div className="rel-school-tools">
                    <label className="rel-selall"><input type="checkbox" checked={allSchools} onChange={toggleAllSchools} /> <span>Select all schools</span></label>
                    <div className="res-search" style={{ maxWidth: 240 }}><i className="fa-solid fa-magnifying-glass" /><input value={schoolQ} onChange={(e) => setSchoolQ(e.target.value)} placeholder="Search school…" /></div>
                  </div>
                  <div className="rel-schools">
                    {schoolList.map((s) => (
                      <label key={s.id} className={`rel-school${schoolSel.has(s.id) ? ' on' : ''}`}>
                        <input type="checkbox" checked={schoolSel.has(s.id)} onChange={() => toggleSchool(s.id)} />
                        <span className="rel-school-name">{s.name}</span>
                        <span className="rel-school-city"><i className="fa-solid fa-phone" /> {s.phone || '—'}</span>
                      </label>
                    ))}
                    {schoolList.length === 0 && <div className="rel-empty-note">No schools match “{schoolQ}”.</div>}
                  </div>
                  {schoolSel.size === 0 && <div className="rel-err"><i className="fa-solid fa-circle-exclamation" /> Select at least one school for this sub release.</div>}
                </>
              )}

              {/* Class-wise content */}
              <div className="rel-sec-h"><i className="fa-solid fa-layer-group" /> Class-wise Content</div>
              {summary.classes.length === 0 ? <div className="rel-empty-note">No class-specific content to release.</div>
                : summary.classes.map((c) => {
                  const isOpen = open[c.classId]
                  return (
                    <div className={`rel-cls${isOpen ? ' open' : ''}`} key={c.classId}>
                      <button className="rel-cls-head" onClick={() => setOpen((o) => ({ ...o, [c.classId]: !o[c.classId] }))}>
                        <div className="rel-cls-ic"><i className="fa-solid fa-chalkboard-user" /></div>
                        <div className="rel-cls-main"><div className="rel-cls-name">{c.name}</div><div className="rel-cls-sub">{c.lessons} Lesson Plans · {c.notebooks} Notebook Plans · {c.resourcesTotal} Resources</div></div>
                        <span className="rel-cls-total">{c.total} items</span>
                        <i className={`fa-solid fa-chevron-down rel-cls-chev${isOpen ? ' open' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="rel-cls-body">
                          {c.lessons > 0 && <div className="rel-grp"><div className="rel-grp-h"><i className="fa-solid fa-list-ul" /> Lesson Plans by subject</div>{subjRows(c.lessonsBySubj)}</div>}
                          {c.notebooks > 0 && <div className="rel-grp"><div className="rel-grp-h"><i className="fa-solid fa-book-open" /> Notebook Plans by subject</div>{subjRows(c.notebooksBySubj)}</div>}
                          {c.resourcesTotal > 0 && <div className="rel-grp"><div className="rel-grp-h"><i className="fa-solid fa-folder-open" /> Resource Library</div>{RES_CATEGORIES.filter((cat) => c.resByCat[cat.key] > 0).map((cat) => <div className="rel-row" key={cat.key}><span>{cat.label}</span><span className="rel-row-n">{c.resByCat[cat.key]}</span></div>)}</div>}
                        </div>
                      )}
                    </div>
                  )
                })}

              {/* Activity Calendar */}
              <div className="rel-sec-h"><i className="fa-solid fa-calendar-week" /> Activity Calendar</div>
              <div className="rel-gen-grid"><div className="rel-gen"><span>{summary.general.activities}</span> Activities Included</div></div>

              {/* Alerts */}
              <div className="rel-alert info"><i className="fa-solid fa-circle-info" /><span>{isSub ? 'Selected schools' : 'Member schools'} can pull this content during the validity period only. After expiry it will no longer be available for new pulls unless released again.</span></div>
              {shortValidity && <div className="rel-alert warn"><i className="fa-solid fa-triangle-exclamation" /><span>You have selected a short validity period. Some schools may miss this release.</span></div>}

              {/* Confirmation */}
              <label className="rel-confirm">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                <span>{isSub ? 'I confirm that this Sub Release will be available only to the selected schools.' : 'I confirm that this Master Release will be available to all member schools.'}</span>
              </label>
              <div className="rel-batch"><i className="fa-solid fa-hashtag" /> Release: <strong>{isSub ? 'Sub' : 'Master'} Release {nextNo} · {nextBatch}</strong></div>
            </>
          )}
        </div>

        <div className="pay-modal-foot">
          {!noContent && !canRelease && (
            <span className="rel-foot-hint"><i className="fa-solid fa-circle-info" /> {!validDays ? 'Enter valid validity days (1–365)' : (isSub && schoolSel.size === 0) ? 'Select at least one school' : 'Tick the confirmation checkbox'} to enable release</span>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-success" disabled={!canRelease} onClick={submit}><i className="fa-solid fa-cloud-arrow-up" /> {isSub ? 'Release to Selected Schools' : 'Release to All Schools'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Textbooks ── */
function Textbooks({ a, commit, fire }) {
  const [fClass, setFClass] = useState('all')
  const [fSubject, setFSubject] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [del, setDel] = useState(null)

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return a.textbooks.filter((t) => (fClass === 'all' || t.classId === Number(fClass)) && (fSubject === 'all' || t.subjectId === Number(fSubject))
      && (!q || `${t.title}${t.author}${t.publisher}`.toLowerCase().includes(q)))
      .sort((x, y) => x.classId - y.classId || x.subjectId - y.subjectId)
  }, [a.textbooks, fClass, fSubject, search])

  const save = (data, id) => {
    if (id) commit({ ...a, textbooks: a.textbooks.map((t) => (t.id === id ? { ...t, ...data } : t)) })
    else { const nid = a.nextId; commit({ ...a, nextId: nid + 1, textbooks: [...a.textbooks, { id: nid, ...data }] }) }
    setModal(null); fire(id ? 'Textbook updated' : 'Textbook added')
  }
  const doDel = () => { commit({ ...a, textbooks: a.textbooks.filter((t) => t.id !== del.id) }); setDel(null); fire('Textbook removed', 'info') }

  return (
    <div className="section-card">
      <div className="card-header">
        <div><div className="card-title"><i className="fa-solid fa-book" /> Textbooks</div><div className="card-sub">Add textbooks class-wise and subject-wise.</div></div>
        <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Textbook</button>
      </div>
      <div style={{ padding: '14px 16px 0' }}>
        <div className="ac-bar">
          <div className="ac-field"><label>Class</label><select className="ac-input" value={fClass} onChange={(e) => { setFClass(e.target.value); setFSubject('all') }}><option value="all">All Classes</option>{a.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="ac-field"><label>Subject</label><select className="ac-input" value={fSubject} onChange={(e) => setFSubject(e.target.value)}><option value="all">All Subjects</option>{(fClass === 'all' ? a.subjects : subjectsOfClass(a, Number(fClass))).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="ac-field" style={{ flex: 1, minWidth: 200 }}><label>Search</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search by title, author or publisher" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="ac-table">
          <thead><tr><th>#</th><th>Class</th><th>Subject</th><th>Book Title</th><th>Author</th><th>Publisher</th><th>Edition</th><th className="c">Action</th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={8}><div className="ac-empty"><i className="fa-solid fa-book" /><div style={{ fontSize: 13, fontWeight: 700 }}>No textbooks found</div><div style={{ fontSize: 12, marginTop: 4 }}>Click “Add Textbook” to add one.</div></div></td></tr>
              : list.map((t, i) => (
                <tr key={t.id}>
                  <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                  <td><span className="badge b-blue">{className(a, t.classId)}</span></td>
                  <td>{subjectName(a, t.subjectId)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--t1)' }}>{t.title}{t.isbn && <div style={{ fontSize: 10.5, color: 'var(--tm)', fontFamily: 'monospace' }}>{t.isbn}</div>}</td>
                  <td>{t.author || '—'}</td>
                  <td>{t.publisher || '—'}</td>
                  <td>{t.edition || '—'}</td>
                  <td className="c"><div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}><button className="btn-sm" style={{ height: 28 }} onClick={() => setModal({ mode: 'edit', book: t })}><i className="fa-solid fa-pen" /></button><button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(t)}><i className="fa-solid fa-trash-can" /></button></div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal && <TextbookModal modal={modal} a={a} onClose={() => setModal(null)} onSave={save} onToast={fire} />}
      {del && <ConfirmModal title="Remove Textbook?" body={`“${del.title}” will be removed.`} onClose={() => setDel(null)} onConfirm={doDel} />}
    </div>
  )
}

function TextbookModal({ modal, a, onClose, onSave, onToast }) {
  const b = modal.book
  const [v, setV] = useState({ classId: b?.classId || a.classes[0]?.id || '', subjectId: b?.subjectId || '', title: b?.title || '', author: b?.author || '', publisher: b?.publisher || '', edition: b?.edition || '', isbn: b?.isbn || '', notes: b?.notes || '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const subs = subjectsOfClass(a, Number(v.classId))
  const save = () => {
    if (!v.classId) return onToast('Select a class', 'warn')
    if (!v.subjectId) return onToast('Select a subject', 'warn')
    if (!v.title.trim()) return onToast('Enter the book title', 'warn')
    onSave({ classId: Number(v.classId), subjectId: Number(v.subjectId), title: v.title.trim(), author: v.author.trim(), publisher: v.publisher.trim(), edition: v.edition.trim(), isbn: v.isbn.trim(), notes: v.notes.trim() }, b?.id)
  }
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 560 }}>
        <div className="pay-modal-hdr"><div className="pay-modal-av"><i className="fa-solid fa-book" /></div><div><div className="pay-modal-title">{b ? 'Edit Textbook' : 'Add Textbook'}</div></div><button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
        <div className="pay-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="ac-field"><label>Class</label><select className="ac-input" value={v.classId} onChange={(e) => setV((s) => ({ ...s, classId: e.target.value, subjectId: '' }))}>{a.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="ac-field"><label>Subject</label><select className="ac-input" value={v.subjectId} onChange={set('subjectId')}><option value="">Select Subject</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          </div>
          <div className="ac-field" style={{ marginBottom: 12 }}><label>Book Title</label><input className="ac-input" value={v.title} onChange={set('title')} placeholder="e.g. My English Book 1" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="ac-field"><label>Author</label><input className="ac-input" value={v.author} onChange={set('author')} placeholder="Author name" /></div>
            <div className="ac-field"><label>Publisher</label><input className="ac-input" value={v.publisher} onChange={set('publisher')} placeholder="Publisher" /></div>
            <div className="ac-field"><label>Edition / Year</label><input className="ac-input" value={v.edition} onChange={set('edition')} placeholder="e.g. 2024" /></div>
            <div className="ac-field"><label>ISBN (optional)</label><input className="ac-input" value={v.isbn} onChange={set('isbn')} placeholder="ISBN" /></div>
          </div>
          <div className="ac-field"><label>Notes (optional)</label><textarea className="ac-input" rows={2} value={v.notes} onChange={set('notes')} placeholder="Any notes" /></div>
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Textbook</button></div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Session Settings (exact ERP card design + modal + reports) ── */
const VAC_DOTS = ['#60A5FA', '#22C55E', '#F59E0B', '#7C3AED', '#EC4899', '#0EA5E9']
function SessionSettings({ a, commit, fire }) {
  const [edit, setEdit] = useState(false)
  const [pwClass, setPwClass] = useState(String(a.classes[0]?.id || ''))
  const s = a.sessionSettings
  const st = sessionStats(s)

  const sessionReport = () => ({
    title: 'Academic Session', period: s.academicYear,
    filters: [['Academic Year', s.academicYear], ['Start', fmtDate(s.start)], ['End', fmtDate(s.end)], ['Working Days / Week', String(s.wpw)]],
    sections: [{ columns: [{ label: 'Metric', a: 'l' }, { label: 'Value', a: 'r' }], rows: [['Session Start', fmtDate(s.start)], ['Session End', fmtDate(s.end)], ['Working Days / Week', s.wpw], ['Gross Working Days', st.onDays], ['Vacation Days', st.vacationDays], ['Net Working Days', st.workingDays], ['Working Weeks', st.workingWeeks]], totals: null }],
  })
  const vacationsReport = () => ({
    title: 'Vacations', period: s.academicYear,
    filters: [['Academic Year', s.academicYear], ['Total Breaks', String((s.vacations || []).length)], ['Vacation Days', String(st.vacationDays)]],
    sections: [{ columns: [{ label: '#', a: 'c' }, { label: 'Vacation', a: 'l' }, { label: 'From', a: 'l' }, { label: 'To', a: 'l' }, { label: 'Days', a: 'c' }], rows: (s.vacations || []).map((v, i) => [i + 1, v.name, fmtDate(v.start), fmtDate(v.end), vacationSpan(v)]), totals: ['', '', '', 'TOTAL', st.vacationDays] }],
  })
  const summaryReport = () => ({
    title: 'Session Summary', period: s.academicYear,
    filters: [['Academic Year', s.academicYear], ['Period', `${fmtDate(s.start)} → ${fmtDate(s.end)}`]],
    sections: [{ columns: [{ label: 'Metric', a: 'l' }, { label: 'Value', a: 'r' }], rows: [['Total (on) Days', st.onDays], ['Working Days', st.workingDays], ['Working Weeks', st.workingWeeks], ['Holiday / Vacation Days', st.vacationDays]], totals: null }],
  })

  const pwSubs = subjectsOfClass(a, Number(pwClass))
  const pwOf = (sid) => s.perWeek?.[pwClass]?.[sid] || 0

  return (
    <div className="ss-cards-grid">
      {/* ① Academic Session */}
      <div className="ss-card ss-card--session">
        <div className="ss-card-orb ss-card-orb--1" /><div className="ss-card-orb ss-card-orb--2" />
        <div className="ss-card-hdr">
          <div className="ss-card-badge"><i className="fa-solid fa-calendar-days" /></div>
          <div><div className="ss-card-hdr-title">Academic Session</div><div className="ss-card-hdr-sub">{s.academicYear}</div></div>
          <button className="ss-card-edit-btn" title="Edit session" onClick={() => setEdit(true)}><i className="fa-solid fa-pen" /></button>
        </div>
        <div className="ss-data-rows">
          <div className="ss-data-row"><div className="ss-data-icon"><i className="fa-solid fa-play" /></div><div className="ss-data-label">Session Start</div><div className="ss-data-val">{s.start}</div></div>
          <div className="ss-data-row"><div className="ss-data-icon"><i className="fa-solid fa-stop" /></div><div className="ss-data-label">Session End</div><div className="ss-data-val">{s.end}</div></div>
          <div className="ss-data-row"><div className="ss-data-icon"><i className="fa-solid fa-briefcase" /></div><div className="ss-data-label">Working Days / Week</div><div className="ss-data-val">{s.wpw}</div></div>
        </div>
        <div className="ss-highlight-banner"><i className="fa-solid fa-circle-check" style={{ color: '#22C55E', fontSize: 15 }} /><span>You have <strong>{st.onDays}</strong> on days in the whole Academic Session</span></div>
        <SsReportBar onColor={() => exportReport(sessionReport(), 'pdf', fire)} onBw={() => exportReport(sessionReport(), 'pdf', fire, true)} />
      </div>

      {/* ② Vacations */}
      <div className="ss-card ss-card--vacations">
        <div className="ss-card-orb ss-card-orb--3" />
        <div className="ss-card-hdr">
          <div className="ss-card-badge"><i className="fa-solid fa-umbrella-beach" /></div>
          <div><div className="ss-card-hdr-title">Vacations</div><div className="ss-card-hdr-sub">{(s.vacations || []).length} scheduled break{(s.vacations || []).length !== 1 ? 's' : ''}</div></div>
          <button className="ss-card-edit-btn" title="Edit vacations" onClick={() => setEdit(true)}><i className="fa-solid fa-pen" /></button>
        </div>
        <div className="ss-vac-list">
          {(s.vacations || []).length === 0 ? <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, padding: '6px 0' }}>No vacations added.</div>
            : (s.vacations || []).map((v, i) => (
              <div className="ss-vac-row" key={v.id || i}>
                <div className="ss-vac-left"><div className="ss-vac-dot" style={{ background: VAC_DOTS[i % VAC_DOTS.length] }} /><div><div className="ss-vac-name">{v.name}</div><div className="ss-vac-range"><i className="fa-solid fa-calendar" /> {v.start} → {v.end}</div></div></div>
                <div className="ss-vac-days">{vacationSpan(v)}<span>days</span></div>
              </div>
            ))}
        </div>
        <SsReportBar onColor={() => exportReport(vacationsReport(), 'pdf', fire)} onBw={() => exportReport(vacationsReport(), 'pdf', fire, true)} />
      </div>

      {/* ③ Session Summary */}
      <div className="ss-card ss-card--summary">
        <div className="ss-card-orb ss-card-orb--4" />
        <div className="ss-card-hdr">
          <div className="ss-card-badge"><i className="fa-solid fa-chart-pie" /></div>
          <div><div className="ss-card-hdr-title">Session Summary</div><div className="ss-card-hdr-sub">Academic year {s.academicYear}</div></div>
        </div>
        <div className="ss-summ-hero">
          <div className="ss-summ-hero-item"><div className="ss-summ-big">{st.workingDays}</div><div className="ss-summ-lbl">Working Days</div></div>
          <div className="ss-summ-divider" />
          <div className="ss-summ-hero-item"><div className="ss-summ-big">{st.workingWeeks}</div><div className="ss-summ-lbl">Working Weeks</div></div>
        </div>
        <div className="ss-summ-pills">
          <div className="ss-summ-pill ss-summ-pill--blue"><div className="ss-summ-pill-val">{st.onDays}</div><div className="ss-summ-pill-lbl"><i className="fa-solid fa-calendar" /> Total Days</div></div>
          <div className="ss-summ-pill ss-summ-pill--green"><div className="ss-summ-pill-val">{st.workingDays}</div><div className="ss-summ-pill-lbl"><i className="fa-solid fa-briefcase" /> Working</div></div>
          <div className="ss-summ-pill ss-summ-pill--amber"><div className="ss-summ-pill-val">{st.vacationDays}</div><div className="ss-summ-pill-lbl"><i className="fa-solid fa-umbrella-beach" /> Holidays</div></div>
        </div>
        <SsReportBar onColor={() => exportReport(summaryReport(), 'pdf', fire)} onBw={() => exportReport(summaryReport(), 'pdf', fire, true)} />
      </div>

      {/* ④ Per-week lesson plans */}
      <div className="ss-card ss-card--lessons">
        <div className="ss-card-orb ss-card-orb--5" />
        <div className="ss-card-hdr">
          <div className="ss-card-badge"><i className="fa-solid fa-book-open" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div className="ss-card-hdr-title">Per week lesson plans</div><div className="ss-card-hdr-sub">{a.classes.length} classes · tap one to view subjects</div></div>
          <button className="ss-card-edit-btn" title="Edit" onClick={() => setEdit(true)}><i className="fa-solid fa-pen" /></button>
        </div>
        <div className="ss-chips">{a.classes.map((c) => <button key={c.id} className={`ss-chip${String(c.id) === pwClass ? ' active' : ''}`} onClick={() => setPwClass(String(c.id))}>{c.name}</button>)}</div>
        <div className="ss-pw-list">
          {pwSubs.length === 0 ? <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, padding: '8px 0' }}>No subjects assigned to this class.</div>
            : pwSubs.map((sub) => <div className="ss-pw-row" key={sub.id}><span>{sub.name}</span><span className="ss-pw-val">{pwOf(sub.id)} <small>/ week</small></span></div>)}
        </div>
      </div>

      {edit && <SsModal a={a} onClose={() => setEdit(false)} onSave={(next) => { commit({ ...a, sessionSettings: next }); setEdit(false); fire('Academic session updated!') }} onToast={fire} />}
    </div>
  )
}

function SsReportBar({ onColor, onBw }) {
  return (
    <div className="ss-card-report-bar">
      <span className="ss-card-report-label"><i className="fa-solid fa-download" /> Report</span>
      <div className="ss-card-report-btns">
        <button className="ss-card-rpt-btn ss-card-rpt-btn--color" onClick={onColor}><i className="fa-solid fa-file-pdf" /> Color PDF</button>
        <button className="ss-card-rpt-btn ss-card-rpt-btn--bw" onClick={onBw}><i className="fa-solid fa-file-pdf" /> B&amp;W</button>
      </div>
    </div>
  )
}

function SsModal({ a, onClose, onSave, onToast }) {
  const [tab, setTab] = useState('term')
  const s = a.sessionSettings
  const [v, setV] = useState({ start: s.start || '', end: s.end || '', wpw: s.wpw || 5 })
  const [vacs, setVacs] = useState(() => JSON.parse(JSON.stringify(s.vacations || [])))
  const [perWeek, setPerWeek] = useState(() => JSON.parse(JSON.stringify(s.perWeek || {})))
  const [pwClass, setPwClass] = useState(String(a.classes[0]?.id || ''))
  const setF = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }))
  const live = sessionStats({ ...v, vacations: vacs })
  const vacId = useRef(Math.max(0, ...((s.vacations || []).map((x) => x.id || 0))) + 1)
  const addVac = () => setVacs((arr) => [...arr, { id: vacId.current++, name: '', start: '', end: '' }])
  const setVac = (i, k, val) => setVacs((arr) => arr.map((x, j) => (j === i ? { ...x, [k]: val } : x)))
  const rmVac = (i) => setVacs((arr) => arr.filter((_, j) => j !== i))
  const dupVac = (i) => setVacs((arr) => { const c = { ...arr[i], id: vacId.current++ }; const n = [...arr]; n.splice(i + 1, 0, c); return n })
  const pwSubs = subjectsOfClass(a, Number(pwClass))
  const setPw = (sid, val) => setPerWeek((p) => ({ ...p, [pwClass]: { ...(p[pwClass] || {}), [sid]: Number(val) || 0 } }))
  const save = () => {
    if (v.start && v.end && new Date(v.end) <= new Date(v.start)) return onToast('Session end must be after start', 'warn')
    onSave({ ...s, start: v.start, end: v.end, wpw: Number(v.wpw) || 5, vacations: vacs.filter((x) => x.name.trim()), perWeek })
  }
  return createPortal(
    <div className="ss-overlay open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ss-modal">
        <div className="ss-topbar"><div className="ss-title"><i className="fa-solid fa-gear" style={{ marginRight: 9, fontSize: 15, opacity: 0.75 }} />Session Setting</div><button className="ss-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
        <div style={{ padding: '0 22px' }}>
          <div className="ss-tabs">
            <button className={`ss-tab${tab === 'term' ? ' active' : ''}`} onClick={() => setTab('term')}>Term setup</button>
            <button className={`ss-tab${tab === 'perweek' ? ' active' : ''}`} onClick={() => setTab('perweek')}>Per Week No. of lesson plans</button>
          </div>
        </div>
        <div className="ss-body">
          {tab === 'term' ? (
            <>
              <div className="ss-section-heading">Academic Session</div>
              <div className="ss-field"><label className="ss-field-label">Session Start</label><input className="ss-input" type="date" value={v.start} onChange={setF('start')} /></div>
              <div className="ss-field"><label className="ss-field-label">Session End</label><input className="ss-input" type="date" value={v.end} onChange={setF('end')} /></div>
              <div className="ss-field"><label className="ss-field-label">Working Days per Week</label><input className="ss-input" type="number" min="1" max="7" value={v.wpw} onChange={setF('wpw')} /></div>
              <div className="ss-info-strip">You have <strong>{live.onDays}</strong> number of working days in the whole Academic Session</div>
              <button className="ss-update-btn" onClick={save}><i className="fa-solid fa-rotate" /> Update</button>
              <div className="ss-divider" />
              <div className="ss-section-heading">Vacations</div>
              {vacs.map((vac, i) => (
                <div className="ss-vacation-block" key={vac.id ?? i}>
                  <div className="ss-field"><label className="ss-field-label">Vacation Name</label><input className="ss-input" value={vac.name} onChange={(e) => setVac(i, 'name', e.target.value)} placeholder="e.g. Eid Holiday" /></div>
                  <div className="ss-field"><label className="ss-field-label">Vacation Start</label><input className="ss-input" type="date" value={vac.start} onChange={(e) => setVac(i, 'start', e.target.value)} /></div>
                  <div className="ss-field" style={{ marginBottom: 6 }}><label className="ss-field-label">Vacation End</label><input className="ss-input" type="date" value={vac.end} onChange={(e) => setVac(i, 'end', e.target.value)} /></div>
                  <div className="ss-vacation-actions">
                    <span className="ss-vac-span">{vacationSpan(vac)} days</span>
                    <button className="ss-vac-btn delete" title="Delete vacation" onClick={() => rmVac(i)}><i className="fa-solid fa-trash" /></button>
                    <button className="ss-vac-btn copy" title="Duplicate" onClick={() => dupVac(i)}><i className="fa-solid fa-copy" /></button>
                  </div>
                </div>
              ))}
              <button className="ss-add-vac" onClick={addVac}><i className="fa-solid fa-plus" /> + Add More Vacation</button>
            </>
          ) : (
            <>
              <div className="ss-section-heading">Per Week No. of Lesson Plans</div>
              <div className="ss-field"><label className="ss-field-label">Select Class</label><select className="ss-input" value={pwClass} onChange={(e) => setPwClass(e.target.value)}>{a.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              {pwSubs.length === 0 ? <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--tm)', fontSize: 13 }}><i className="fa-solid fa-chalkboard-user" style={{ fontSize: 30, opacity: 0.2, display: 'block', marginBottom: 10 }} />No subjects assigned to this class.</div>
                : pwSubs.map((sub) => (
                  <div className="ss-pw-mrow" key={sub.id}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{sub.name}</span>
                    <input className="ss-input" type="number" min="0" style={{ width: 90, height: 40 }} value={perWeek[pwClass]?.[sub.id] || 0} onChange={(e) => setPw(sub.id, e.target.value)} />
                    <span style={{ fontSize: 11, color: 'var(--tm)' }}>/ week</span>
                  </div>
                ))}
            </>
          )}
        </div>
        <div className="ss-footer"><button className="ss-btn cancel" onClick={onClose}>Close</button><button className="ss-btn save" onClick={save}>Save</button></div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Term Settings ── */
function TermSettings({ a, commit, fire }) {
  const [draft, setDraft] = useState({})
  const [del, setDel] = useState(null)
  useEffect(() => {
    setDraft((prev) => { const next = {}; a.terms.forEach((t) => { next[t.id] = prev[t.id] || { name: t.name, start: t.start, end: t.end } }); return next })
  }, [a.terms])
  const setRow = (id, k, val) => setDraft((s) => ({ ...s, [id]: { ...s[id], [k]: val } }))

  const ss = a.sessionSettings || {}
  const addTerm = () => { const id = a.nextId; commit({ ...a, nextId: id + 1, terms: [...a.terms, { id, name: '', start: ss.start || '', end: '' }] }) }
  const saveRow = (id) => {
    const d = draft[id]; if (!d.name.trim()) return fire('Term name cannot be empty', 'warn')
    if (d.start && d.end && d.end < d.start) return fire('Term end must be after start', 'warn')
    if (ss.start && ss.end && d.start && d.end && (d.start < ss.start || d.end > ss.end)) return fire('Term dates must fall within the session period', 'warn')
    commit({ ...a, terms: a.terms.map((t) => (t.id === id ? { ...t, name: d.name.trim(), start: d.start, end: d.end } : t)) }); fire(`“${d.name.trim()}” saved`)
  }
  const doDel = () => { commit({ ...a, terms: a.terms.filter((t) => t.id !== del.id) }); setDel(null); fire('Term deleted', 'info') }

  return (
    <div className="section-card">
      <div className="card-header"><div><div className="card-title"><i className="fa-solid fa-layer-group" /> Term Settings</div><div className="card-sub">Academic terms drive the Academic Calendar, Examinations and Fee Records.</div></div></div>
      <div style={{ padding: 18 }}>
        <div className="ac-info-strip warn"><i className="fa-solid fa-triangle-exclamation" /><span>Terms defined here drive <strong>Academic Calendar</strong>, <strong>Examinations</strong> and <strong>Fee Records</strong>. Deleting a term affects all linked data.</span></div>
        <div className="tbl-wrap" style={{ marginTop: 14 }}>
          <table className="ac-table">
            <thead><tr><th style={{ width: 52 }}>#</th><th>Term Name</th><th style={{ width: 170 }}>Start Date</th><th style={{ width: 170 }}>End Date</th><th className="c" style={{ width: 110 }}>Actions</th></tr></thead>
            <tbody>
              {a.terms.length === 0 ? <tr><td colSpan={5}><div className="ac-empty"><i className="fa-solid fa-list-ol" /><div style={{ fontSize: 13, fontWeight: 700 }}>No terms yet</div><div style={{ fontSize: 12, marginTop: 4 }}>Click “Add new term” below to get started.</div></div></td></tr>
                : a.terms.map((t, i) => { const d = draft[t.id] || {}; return (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                    <td><input className="ac-input" style={{ width: '100%' }} value={d.name || ''} onChange={(e) => setRow(t.id, 'name', e.target.value)} placeholder="Enter term name" /></td>
                    <td><input className="ac-input" type="date" value={d.start || ''} onChange={(e) => setRow(t.id, 'start', e.target.value)} /></td>
                    <td><input className="ac-input" type="date" value={d.end || ''} onChange={(e) => setRow(t.id, 'end', e.target.value)} /></td>
                    <td className="c"><div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button className="btn-sm" style={{ height: 30, borderColor: 'var(--success)', color: 'var(--success)' }} title="Save" onClick={() => saveRow(t.id)}><i className="fa-solid fa-check" /></button>
                      <button className="btn-sm" style={{ height: 30, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} title="Delete" onClick={() => setDel({ id: t.id, name: t.name })}><i className="fa-solid fa-xmark" /></button>
                    </div></td>
                  </tr>
                ) })}
            </tbody>
          </table>
        </div>
        <button className="ac-add-row" onClick={addTerm}><div className="ac-add-ic"><i className="fa-solid fa-plus" /></div><span>Add new term</span><span className="ac-add-hint">Click to add another academic term</span></button>
      </div>
      {del && <ConfirmModal title="Delete Term?" body={`Term “${del.name || 'this term'}” will be removed. Linked calendar entries will be affected.`} onClose={() => setDel(null)} onConfirm={doDel} />}
    </div>
  )
}

/* ── Academic Calendar ── */
function AcademicCalendar({ a, commit, fire }) {
  const [modal, setModal] = useState(null) // { termId, entry? }
  const [del, setDel] = useState(null)
  const cal = a.academicCalendar || {}

  const saveEntry = (termId, data, id) => {
    const list = cal[termId] || []
    const next = id ? list.map((e) => (e.id === id ? { ...e, ...data } : e)) : [...list, { id: a.nextId, ...data }]
    commit({ ...a, nextId: id ? a.nextId : a.nextId + 1, academicCalendar: { ...cal, [termId]: next } })
    setModal(null); fire(id ? 'Key date updated' : 'Key date added')
  }
  const doDel = () => { commit({ ...a, academicCalendar: { ...cal, [del.termId]: (cal[del.termId] || []).filter((e) => e.id !== del.id) } }); setDel(null); fire('Key date removed', 'info') }

  const report = () => ({
    title: 'Academic Calendar', period: a.sessionSettings?.academicYear ? `Academic Year ${a.sessionSettings.academicYear}` : '',
    filters: [['Academic Year', a.sessionSettings?.academicYear || '—'], ['Terms', String(a.terms.length)]],
    sections: a.terms.map((t) => ({ title: `${t.name} (${fmtDate(t.start)} → ${fmtDate(t.end)})`, columns: [{ label: 'Date', a: 'l' }, { label: 'Key Date / Milestone', a: 'l' }], rows: (cal[t.id] || []).slice().sort((x, y) => (x.date < y.date ? -1 : 1)).map((e) => [fmtDate(e.date), e.heading]), totals: null })),
  })

  return (
    <div className="section-card">
      <div className="card-header">
        <div><div className="card-title"><i className="fa-solid fa-calendar-check" /> Academic Calendar — Key Dates</div><div className="card-sub">Important academic dates, by term.</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ac-exp pdf" onClick={() => exportReport(report(), 'pdf', fire)}><i className="fa-solid fa-file-pdf" /> PDF</button>
          <button className="ac-exp word" onClick={() => exportReport(report(), 'word', fire)}><i className="fa-brands fa-microsoft" /> Word</button>
        </div>
      </div>
      <div style={{ padding: 18 }}>
        {a.terms.length === 0 ? <div className="ac-empty"><i className="fa-solid fa-layer-group" /><div style={{ fontSize: 13, fontWeight: 700 }}>No terms defined</div><div style={{ fontSize: 12, marginTop: 4 }}>Add terms in Term Settings first.</div></div>
          : a.terms.map((t) => {
            const entries = (cal[t.id] || []).slice().sort((x, y) => (x.date < y.date ? -1 : 1))
            return (
              <div className="ac-term-card" key={t.id}>
                <div className="ac-term-head">
                  <div className="ac-term-ic"><i className="fa-solid fa-flag" /></div>
                  <div style={{ flex: 1 }}><div className="ac-term-name">{t.name}</div><div className="ac-term-range">{fmtDate(t.start)} → {fmtDate(t.end)}</div></div>
                  <button className="btn-primary" onClick={() => setModal({ termId: t.id })}><i className="fa-solid fa-plus" /> Add Key Date</button>
                </div>
                <div className="ac-term-body">
                  {entries.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--tm)', padding: '4px 2px' }}>No key dates yet.</div>
                    : entries.map((e) => (
                      <div className="ac-kd-row" key={e.id}>
                        <span className="ac-kd-date">{fmtDate(e.date)}</span>
                        <span className="ac-kd-head">{e.heading}</span>
                        <button className="btn-sm" style={{ height: 28 }} onClick={() => setModal({ termId: t.id, entry: e })}><i className="fa-solid fa-pen" /></button>
                        <button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel({ termId: t.id, id: e.id, heading: e.heading })}><i className="fa-solid fa-trash-can" /></button>
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
      </div>
      {modal && <EntryModal modal={modal} onClose={() => setModal(null)} onSave={saveEntry} onToast={fire} />}
      {del && <ConfirmModal title="Remove Key Date?" body={`“${del.heading}” will be removed.`} onClose={() => setDel(null)} onConfirm={doDel} />}
    </div>
  )
}

function EntryModal({ modal, onClose, onSave, onToast }) {
  const e = modal.entry
  const [heading, setHeading] = useState(e?.heading || '')
  const [date, setDate] = useState(e?.date || '')
  const save = () => { if (!heading.trim()) return onToast('Enter a heading', 'warn'); if (!date) return onToast('Pick a date', 'warn'); onSave(modal.termId, { heading: heading.trim(), date }, e?.id) }
  return createPortal(
    <div className="pay-ov" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 440 }}>
        <div className="pay-modal-hdr"><div className="pay-modal-av"><i className="fa-solid fa-calendar-day" /></div><div><div className="pay-modal-title">{e ? 'Edit Key Date' : 'Add Key Date'}</div></div><button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
        <div className="pay-modal-body">
          <div className="ac-field" style={{ marginBottom: 12 }}><label>Heading / Milestone</label><input className="ac-input" value={heading} onChange={(ev) => setHeading(ev.target.value)} placeholder="e.g. First Term Exams Begin" /></div>
          <div className="ac-field"><label>Date</label><input className="ac-input" type="date" value={date} onChange={(ev) => setDate(ev.target.value)} /></div>
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button></div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Activity Calendar ── */
function ActivityCalendar({ a, commit, fire }) {
  const [calY, setCalY] = useState(2026)
  const [calM, setCalM] = useState(4) // May
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [del, setDel] = useState(null)
  const acts = a.activityCalendar || []

  const stats = useMemo(() => {
    const ym = `${calY}-${String(calM + 1).padStart(2, '0')}`
    return { total: acts.length, upcoming: acts.filter((x) => x.status === 'upcoming').length, month: acts.filter((x) => (x.start || '').startsWith(ym)).length, completed: acts.filter((x) => x.status === 'completed').length }
  }, [acts, calY, calM])

  const save = (data, id) => {
    if (id) commit({ ...a, activityCalendar: acts.map((x) => (x.id === id ? { ...x, ...data } : x)) })
    else commit({ ...a, nextId: a.nextId + 1, activityCalendar: [...acts, { id: a.nextId, ...data }] })
    setModal(null); fire(id ? 'Activity updated' : 'Activity added')
  }
  const doDel = () => { commit({ ...a, activityCalendar: acts.filter((x) => x.id !== del.id) }); setDel(null); fire('Activity removed', 'info') }

  const prev = () => { if (calM === 0) { setCalM(11); setCalY((y) => y - 1) } else setCalM((m) => m - 1) }
  const next = () => { if (calM === 11) { setCalM(0); setCalY((y) => y + 1) } else setCalM((m) => m + 1) }
  const firstDow = new Date(calY, calM, 1).getDay()
  const dim = new Date(calY, calM + 1, 0).getDate()
  const ym = `${calY}-${String(calM + 1).padStart(2, '0')}`
  const actsOnDay = (day) => acts.filter((x) => { const ds = `${ym}-${String(day).padStart(2, '0')}`; return ds >= x.start && ds <= x.end })

  const visible = acts.filter((x) => filter === 'all' || x.status === filter).slice().sort((x, y) => (x.start < y.start ? -1 : 1))

  const report = () => ({
    title: 'Activity Calendar', period: a.sessionSettings?.academicYear ? `Academic Year ${a.sessionSettings.academicYear}` : '',
    filters: [['Total Activities', String(acts.length)], ['Scheduled', String(acts.filter((x) => x.status === 'upcoming').length)], ['Completed', String(acts.filter((x) => x.status === 'completed').length)]],
    sections: [{ columns: [{ label: '#', a: 'c' }, { label: 'Activity', a: 'l' }, { label: 'From', a: 'l' }, { label: 'To', a: 'l' }, { label: 'Status', a: 'l' }, { label: 'Purpose', a: 'l' }], rows: acts.slice().sort((x, y) => (x.start < y.start ? -1 : 1)).map((x, i) => [i + 1, x.name, fmtDate(x.start), fmtDate(x.end), ACT_STATUS[x.status]?.label || x.status, x.purpose || '—']), totals: null }],
  })

  return (
    <>
      <div className="ac-stats">
        {[['fa-calendar-days', '#1E40AF', stats.total, 'Total Activities'], ['fa-circle-check', '#16A34A', stats.upcoming, 'Scheduled'], ['fa-clock', '#D97706', stats.month, 'This Month'], ['fa-flag', '#7C3AED', stats.completed, 'Completed']].map(([ic, col, val, lbl]) => (
          <div className="ac-stat" key={lbl}><div className="ac-stat-ic" style={{ background: `${col}1a`, color: col }}><i className={`fa-solid ${ic}`} /></div><div><div className="ac-stat-val">{val}</div><div className="ac-stat-lbl">{lbl}</div></div></div>
        ))}
      </div>

      <div className="ac-act-layout">
        <div className="section-card">
          <div style={{ padding: 16 }}>
            <div className="ac-cal-head">
              <div className="ac-cal-nav">
                <button className="ac-nav-btn" onClick={prev}><i className="fa-solid fa-chevron-left" /></button>
                <div><div className="ac-cal-month">{MONTHS[calM]} {calY}</div>{a.sessionSettings?.academicYear && <div className="ac-cal-month-sub">Academic Year {a.sessionSettings.academicYear}</div>}</div>
                <button className="ac-nav-btn" onClick={next}><i className="fa-solid fa-chevron-right" /></button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="ac-exp pdf" onClick={() => exportReport(report(), 'pdf', fire)}><i className="fa-solid fa-file-pdf" /> PDF</button>
                <button className="ac-exp word" onClick={() => exportReport(report(), 'word', fire)}><i className="fa-brands fa-microsoft" /> Word</button>
              </div>
            </div>
            <div className="ac-dow-row">{DOW.map((d) => <div className="ac-dow" key={d}>{d}</div>)}</div>
            <div className="ac-days">
              {Array.from({ length: firstDow }).map((_, i) => <div className="ac-day empty" key={`e${i}`} />)}
              {Array.from({ length: dim }).map((_, i) => {
                const day = i + 1; const iso = `${ym}-${String(day).padStart(2, '0')}`; const dayActs = actsOnDay(day)
                return (
                  <div className={`ac-day${iso === todayISO() ? ' today' : ''}`} key={day}>
                    <div className="ac-day-num">{day}</div>
                    <div className="ac-day-dots">{dayActs.slice(0, 4).map((x) => <div className="ac-day-dot" key={x.id} style={{ background: ACT_STATUS[x.status]?.color || '#1E40AF' }} title={x.name} />)}</div>
                  </div>
                )
              })}
            </div>
            <div className="ac-legend">
              {[['#1E40AF', 'Scheduled'], ['#16A34A', 'Completed'], ['#D97706', 'Ongoing'], ['#7C3AED', 'Today']].map(([c, l]) => <div className="ac-legend-item" key={l}><div className="ac-legend-dot" style={{ background: c }} />{l}</div>)}
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="card-header"><div className="card-title"><i className="fa-solid fa-list" /> Activities</div><button className="btn-primary" onClick={() => setModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add</button></div>
          <div style={{ padding: 14 }}>
            <div className="ac-evt-filters">
              {['all', 'upcoming', 'ongoing', 'completed'].map((f) => <button key={f} className={`ac-evt-filter${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : ACT_STATUS[f].label}</button>)}
            </div>
            {visible.length === 0 ? <div className="ac-empty"><i className="fa-solid fa-calendar-plus" /><div style={{ fontSize: 13, fontWeight: 700 }}>No activities</div></div>
              : visible.map((x) => (
                <div className="ac-evt" key={x.id} style={{ borderLeftColor: ACT_STATUS[x.status]?.color }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div className="ac-evt-name">{x.name}</div>
                    <span className="badge" style={{ background: `${ACT_STATUS[x.status]?.color}1a`, color: ACT_STATUS[x.status]?.color }}>{ACT_STATUS[x.status]?.label}</span>
                  </div>
                  <div className="ac-evt-date"><i className="fa-regular fa-calendar" /> {fmtDate(x.start)}{x.end !== x.start ? ` → ${fmtDate(x.end)}` : ''}</div>
                  {x.purpose && <div className="ac-evt-purpose">{x.purpose}</div>}
                  <div className="ac-evt-actions"><button className="btn-sm" style={{ height: 28 }} onClick={() => setModal({ mode: 'edit', act: x })}><i className="fa-solid fa-pen" /> Edit</button><button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(x)}><i className="fa-solid fa-trash-can" /></button></div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {modal && <ActivityModal modal={modal} onClose={() => setModal(null)} onSave={save} onToast={fire} />}
      {del && <ConfirmModal title="Remove Activity?" body={`“${del.name}” will be removed.`} onClose={() => setDel(null)} onConfirm={doDel} />}
    </>
  )
}

function ActivityModal({ modal, onClose, onSave, onToast }) {
  const x = modal.act
  const [v, setV] = useState({ name: x?.name || '', start: x?.start || '', end: x?.end || '', status: x?.status || 'upcoming', purpose: x?.purpose || '', development: x?.development || '', resource: x?.resource || '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.name.trim()) return onToast('Enter activity name', 'warn')
    if (!v.start) return onToast('Pick a start date', 'warn')
    const end = v.end || v.start
    if (end < v.start) return onToast('End date must be after start', 'warn')
    onSave({ name: v.name.trim(), start: v.start, end, status: v.status, purpose: v.purpose.trim(), development: v.development.trim(), resource: v.resource.trim() }, x?.id)
  }
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 560 }}>
        <div className="pay-modal-hdr"><div className="pay-modal-av"><i className="fa-solid fa-calendar-plus" /></div><div><div className="pay-modal-title">{x ? 'Edit Activity' : 'Add Activity'}</div></div><button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
        <div className="pay-modal-body">
          <div className="ac-field" style={{ marginBottom: 12 }}><label>Activity Name</label><input className="ac-input" value={v.name} onChange={set('name')} placeholder="e.g. Science Fair" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="ac-field"><label>From</label><input className="ac-input" type="date" value={v.start} onChange={set('start')} /></div>
            <div className="ac-field"><label>To</label><input className="ac-input" type="date" value={v.end} onChange={set('end')} /></div>
          </div>
          <div className="ac-field" style={{ marginBottom: 12 }}><label>Purpose</label><textarea className="ac-input" rows={2} value={v.purpose} onChange={set('purpose')} placeholder="Purpose of the activity" /></div>
          <div className="ac-field" style={{ marginBottom: 12 }}><label>Development / Plan</label><input className="ac-input" value={v.development} onChange={set('development')} placeholder="Preparation steps" /></div>
          <div className="ac-field"><label>Resources Required</label><input className="ac-input" value={v.resource} onChange={set('resource')} placeholder="Equipment, materials…" /></div>
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Activity</button></div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Term Breakups ── */
const unitsOf = (a, classId, termId, subjectId) => a.termBreakups?.[classId]?.[termId]?.[subjectId] || []

function TermBreakups({ a, commit, fire }) {
  const [openId, setOpenId] = useState(null)
  const [termId, setTermId] = useState(a.terms[0]?.id || null)
  const [subjectId, setSubjectId] = useState(null)
  const [edit, setEdit] = useState(null)

  const openClass = (c) => {
    if (openId === c.id) { setOpenId(null); return }
    setOpenId(c.id); setTermId(a.terms[0]?.id || null); setSubjectId(subjectsOfClass(a, c.id)[0]?.id || null)
  }

  const classReport = (c) => ({
    title: `Term Breakup — ${c.name}`, period: a.sessionSettings?.academicYear ? `Academic Year ${a.sessionSettings.academicYear}` : '',
    filters: [['Class', c.name], ['Terms', String(a.terms.length)], ['Subjects', String(subjectsOfClass(a, c.id).length)]],
    sections: a.terms.map((t) => {
      const rows = []
      subjectsOfClass(a, c.id).forEach((s) => unitsOf(a, c.id, t.id, s.id).forEach((u) => u.topics.forEach((tp, ti) => rows.push([ti === 0 ? s.name : '', ti === 0 ? u.unitNum : '', ti === 0 ? u.unitName : '', ti === 0 ? u.weeks : '', tp.topic, tp.periods]))))
      return { title: t.name, columns: [{ label: 'Subject', a: 'l' }, { label: 'Unit #', a: 'c' }, { label: 'Unit Name', a: 'l' }, { label: 'Weeks', a: 'c' }, { label: 'Topic', a: 'l' }, { label: 'Periods', a: 'c' }], rows, totals: null }
    }),
  })

  return (
    <div className="section-card">
      <div className="card-header"><div><div className="card-title"><i className="fa-solid fa-table-list" /> Term Breakup</div><div className="card-sub">Break each term's syllabus into units &amp; topics, class-wise and subject-wise.</div></div></div>
      <div style={{ padding: 18 }}>
        {a.classes.length === 0 ? <div className="ac-empty"><i className="fa-solid fa-chalkboard" /><div style={{ fontSize: 13, fontWeight: 700 }}>No classes defined</div><div style={{ fontSize: 12, marginTop: 4 }}>Add classes in Settings → Classes &amp; Subjects.</div></div>
          : a.classes.map((c) => (
            <div className="tb-class-card" key={c.id}>
              <div className="tb-class-head" onClick={() => openClass(c)}>
                <div className="tb-class-ic"><i className="fa-solid fa-chalkboard-user" /></div>
                <div style={{ flex: 1 }}><div className="tb-class-name">{c.name}</div><div className="ac-term-range">{subjectsOfClass(a, c.id).length} subjects</div></div>
                <button className="ac-exp pdf" onClick={(e) => { e.stopPropagation(); exportReport(classReport(c), 'pdf', fire) }}><i className="fa-solid fa-file-pdf" /> PDF</button>
                <button className="ac-exp word" onClick={(e) => { e.stopPropagation(); exportReport(classReport(c), 'word', fire) }}><i className="fa-brands fa-microsoft" /> Word</button>
                <button className="btn-primary" onClick={(e) => { e.stopPropagation(); setEdit(c) }}><i className="fa-solid fa-pen" /> Update</button>
                <i className={`fa-solid fa-chevron-${openId === c.id ? 'up' : 'down'}`} style={{ color: 'var(--tm)' }} />
              </div>
              {openId === c.id && (
                <div className="tb-class-body">
                  <div className="tb-pills">{a.terms.map((t) => <button key={t.id} className={`tb-pill${termId === t.id ? ' active' : ''}`} onClick={() => setTermId(t.id)}>{t.name}</button>)}</div>
                  <div className="tb-pills">{subjectsOfClass(a, c.id).map((s) => <button key={s.id} className={`tb-pill tb-subj-pill${subjectId === s.id ? ' active' : ''}`} onClick={() => setSubjectId(s.id)}>{s.name}</button>)}</div>
                  {(() => {
                    const units = unitsOf(a, c.id, termId, subjectId)
                    if (!units.length) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--tm)', fontSize: 13 }}><i className="fa-solid fa-layer-group" style={{ fontSize: 22, opacity: 0.25, display: 'block', marginBottom: 8 }} />No units added yet. Click <strong>Update</strong> to add.</div>
                    return units.map((u, ui) => (
                      <div className="tb-unit" key={ui}>
                        <div className="tb-unit-hd"><div className="tb-unit-title">Unit {u.unitNum} — {u.unitName}</div><div className="tb-unit-meta">{u.weeks} week(s) · {u.topics.length} topic(s)</div></div>
                        <table className="tb-topic-table"><thead><tr><th className="c" style={{ width: 60 }}>S/No</th><th>Topic / Sub-topic</th><th className="c" style={{ width: 110 }}>Periods</th></tr></thead>
                          <tbody>{u.topics.map((tp, ti) => <tr key={ti}><td className="c" style={{ color: 'var(--tm)', fontWeight: 700 }}>{ti + 1}</td><td>{tp.topic}</td><td className="c" style={{ fontWeight: 700 }}>{tp.periods}</td></tr>)}</tbody>
                        </table>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          ))}
      </div>
      {edit && <BreakupModal cls={edit} a={a} onClose={() => setEdit(null)} onSave={(wb) => { commit({ ...a, termBreakups: { ...a.termBreakups, [edit.id]: wb } }); setEdit(null); fire('Term breakup saved') }} onToast={fire} />}
    </div>
  )
}

function BreakupModal({ cls, a, onClose, onSave, onToast }) {
  const subjects = subjectsOfClass(a, cls.id)
  const [mTerm, setMTerm] = useState(a.terms[0]?.id || null)
  const [mSubj, setMSubj] = useState(subjects[0]?.id || null)
  const [wb, setWb] = useState(() => JSON.parse(JSON.stringify(a.termBreakups?.[cls.id] || {})))

  const units = wb[mTerm]?.[mSubj] || []
  const setUnits = (next) => setWb((w) => ({ ...w, [mTerm]: { ...(w[mTerm] || {}), [mSubj]: next } }))
  const addUnit = () => setUnits([...units, { unitNum: String(units.length + 1), unitName: '', weeks: '0', topics: [{ topic: '', periods: '0' }] }])
  const setUnit = (ui, k, val) => setUnits(units.map((u, i) => (i === ui ? { ...u, [k]: val } : u)))
  const rmUnit = (ui) => setUnits(units.filter((_, i) => i !== ui))
  const addTopic = (ui) => setUnits(units.map((u, i) => (i === ui ? { ...u, topics: [...u.topics, { topic: '', periods: '0' }] } : u)))
  const setTopic = (ui, ti, k, val) => setUnits(units.map((u, i) => (i === ui ? { ...u, topics: u.topics.map((t, j) => (j === ti ? { ...t, [k]: val } : t)) } : u)))
  const rmTopic = (ui, ti) => setUnits(units.map((u, i) => (i === ui ? { ...u, topics: u.topics.filter((_, j) => j !== ti) } : u)))

  const save = () => {
    // strip empty units/topics
    const clean = {}
    Object.entries(wb).forEach(([tid, subs]) => { Object.entries(subs).forEach(([sid, us]) => { const u2 = us.map((u) => ({ ...u, topics: u.topics.filter((t) => t.topic.trim()) })).filter((u) => u.unitName.trim()); if (u2.length) { clean[tid] = clean[tid] || {}; clean[tid][sid] = u2 } }) })
    onSave(clean)
  }

  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 680 }}>
        <div className="pay-modal-hdr"><div className="pay-modal-av"><i className="fa-solid fa-table-list" /></div><div><div className="pay-modal-title">Term Breakup — {cls.name}</div><div className="pay-modal-sub">Edit units &amp; topics per term and subject</div></div><button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
        <div className="pay-modal-body">
          <div className="tb-ed-tabs">{a.terms.map((t) => <button key={t.id} className={`tb-ed-tab${mTerm === t.id ? ' active' : ''}`} onClick={() => setMTerm(t.id)}>{t.name}</button>)}</div>
          <div className="tb-ed-tabs">{subjects.map((s) => <button key={s.id} className={`tb-ed-tab${mSubj === s.id ? ' active' : ''}`} onClick={() => setMSubj(s.id)} style={mSubj === s.id ? { background: '#0284C7', borderColor: '#0284C7' } : undefined}>{s.name}</button>)}</div>
          {units.length === 0 ? <div style={{ textAlign: 'center', padding: 16, color: 'var(--tm)', fontSize: 13 }}>No units yet for this term &amp; subject.</div>
            : units.map((u, ui) => (
              <div className="tb-ed-unit" key={ui}>
                <div className="tb-ed-unit-row">
                  <input className="ac-input" value={u.unitNum} onChange={(e) => setUnit(ui, 'unitNum', e.target.value)} placeholder="No." />
                  <input className="ac-input" value={u.unitName} onChange={(e) => setUnit(ui, 'unitName', e.target.value)} placeholder="Unit name" />
                  <input className="ac-input" value={u.weeks} onChange={(e) => setUnit(ui, 'weeks', e.target.value)} placeholder="Weeks" />
                  <button className="btn-sm" style={{ height: 38, borderColor: 'var(--err)', color: 'var(--err)' }} onClick={() => rmUnit(ui)}><i className="fa-solid fa-trash-can" /></button>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm)', margin: '6px 0' }}>Topics</div>
                {u.topics.map((tp, ti) => (
                  <div className="tb-ed-topic-row" key={ti}>
                    <input className="ac-input" value={tp.topic} onChange={(e) => setTopic(ui, ti, 'topic', e.target.value)} placeholder="Topic / sub-topic" />
                    <input className="ac-input" value={tp.periods} onChange={(e) => setTopic(ui, ti, 'periods', e.target.value)} placeholder="Periods" />
                    <button className="btn-sm" style={{ height: 38, borderColor: 'var(--err)', color: 'var(--err)' }} onClick={() => rmTopic(ui, ti)}><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
                <button className="btn-secondary" style={{ height: 32, marginTop: 4 }} onClick={() => addTopic(ui)}><i className="fa-solid fa-plus" /> Add Topic</button>
              </div>
            ))}
          <button className="btn-primary" onClick={addUnit}><i className="fa-solid fa-plus" /> Add Unit</button>
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Breakup</button></div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Class + Subject selector (shared) ── */
function ClassSubjectBar({ a, classId, setClassId, subjectId, setSubjectId, children }) {
  const subs = subjectsOfClass(a, Number(classId))
  return (
    <div className="ac-bar">
      <div className="ac-field"><label>Class</label><select className="ac-input" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(String(subjectsOfClass(a, Number(e.target.value))[0]?.id || '')) }}>{a.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="ac-field"><label>Subject</label><select className="ac-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subs.length === 0 ? <option value="">No subjects</option> : subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      {children}
    </div>
  )
}

const SRC = { manual: { label: 'Manual', icon: 'fa-pen-nib' }, ai: { label: 'Mentor AI', icon: 'fa-wand-magic-sparkles' } }

/* ════════ LESSON PLANS (units → lessons → sections) ════════ */
function LessonPlans({ a, commit, fire }) {
  const [classId, setClassId] = useState(String(a.classes[0]?.id || ''))
  const [subjectId, setSubjectId] = useState(String(subjectsOfClass(a, a.classes[0]?.id)[0]?.id || ''))
  const [openId, setOpenId] = useState(null)
  const [unitModal, setUnitModal] = useState(null)
  const [lessonModal, setLessonModal] = useState(null)
  const [view, setView] = useState(null)
  const [del, setDel] = useState(null)

  const units = a.lessonPlans.filter((u) => u.classId === Number(classId) && u.subjectId === Number(subjectId)).map((u) => ({ ...u, lessons: u.lessons || [] }))

  const saveUnit = (data, id) => {
    if (id) commit({ ...a, lessonPlans: a.lessonPlans.map((u) => (u.id === id ? { ...u, ...data } : u)) })
    else { const nid = a.nextId; commit({ ...a, nextId: nid + 1, lessonPlans: [...a.lessonPlans, { id: nid, classId: Number(classId), subjectId: Number(subjectId), lessons: [], ...data }] }) }
    setUnitModal(null); fire(id ? 'Unit updated' : 'Unit added')
  }
  const saveLesson = (unitId, lesson, lessonId) => {
    commit({ ...a, lessonPlans: a.lessonPlans.map((u) => (u.id !== unitId ? u : { ...u, lessons: lessonId ? (u.lessons || []).map((l) => (l.id === lessonId ? { ...l, ...lesson } : l)) : [...(u.lessons || []), { id: Date.now(), num: (u.lessons || []).length + 1, ...lesson }] })) })
    setLessonModal(null); fire(lessonId ? 'Lesson plan updated' : 'Lesson plan added')
  }
  const delUnit = (id) => { commit({ ...a, lessonPlans: a.lessonPlans.filter((u) => u.id !== id) }); setDel(null); fire('Unit removed', 'info') }
  const delLesson = (unitId, lessonId) => { commit({ ...a, lessonPlans: a.lessonPlans.map((u) => (u.id === unitId ? { ...u, lessons: (u.lessons || []).filter((l) => l.id !== lessonId) } : u)) }); setDel(null); fire('Lesson removed', 'info') }

  const lessonReport = (u, l) => ({
    title: 'Lesson Plan', period: `${className(a, Number(classId))} · ${subjectName(a, Number(subjectId))}`,
    filters: [['Class', className(a, Number(classId))], ['Subject', subjectName(a, Number(subjectId))], ['Unit', `${u.unitNo} — ${u.unitName}`], ['Lesson', l.topic], ['Duration', `${l.duration || 45} min`], ['Source', SRC[l.source]?.label || 'Manual']],
    sections: l.sections.map((s) => ({ title: `${s.title}  (${s.mins} min)`, html: s.content || '—' })),
  })
  const unitReport = (u) => ({
    title: `Lesson Plans — Unit ${u.unitNo}`, period: `${className(a, Number(classId))} · ${subjectName(a, Number(subjectId))}`,
    filters: [['Class', className(a, Number(classId))], ['Subject', subjectName(a, Number(subjectId))], ['Unit', u.unitName], ['Lessons', String(u.lessons.length)]],
    sections: u.lessons.map((l) => ({ title: `Lesson ${l.num}: ${l.topic}  (${SRC[l.source]?.label})`, html: l.sections.map((s) => `<h4 style="color:#1E3A8A;margin:8px 0 3px;font-size:11px">${s.title} (${s.mins} min)</h4>${s.content || '—'}`).join('') })),
  })

  return (
    <div className="section-card">
      <div className="card-header"><div><div className="card-title"><i className="fa-solid fa-list-ul" /> Lesson Plans</div><div className="card-sub">Create unit-wise lesson plans for every class and subject.</div></div></div>
      <div style={{ padding: '14px 16px 0' }}>
        <ClassSubjectBar a={a} classId={classId} setClassId={setClassId} subjectId={subjectId} setSubjectId={setSubjectId}>
          <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setUnitModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Unit</button>
        </ClassSubjectBar>
      </div>
      <div style={{ padding: 16 }}>
        {units.length === 0 ? <div className="ac-empty"><i className="fa-solid fa-book-open-reader" /><div style={{ fontSize: 13, fontWeight: 700 }}>No lesson plans yet</div><div style={{ fontSize: 12, marginTop: 4 }}>Click “Add Unit” for {className(a, Number(classId))} · {subjectName(a, Number(subjectId))}.</div></div>
          : units.map((u, ui) => {
            const isOpen = openId === u.id
            const manual = u.lessons.filter((l) => l.source === 'manual').length
            const ai = u.lessons.filter((l) => l.source === 'ai').length
            return (
              <div className={`clpr-unit-card${isOpen ? ' open' : ''}`} key={u.id}>
                <div className="clpr-unit-header" onClick={() => setOpenId(isOpen ? null : u.id)}>
                  <div className="clpr-unit-left">
                    <div className="clpr-unit-sno">{ui + 1}</div>
                    <div className="clpr-unit-icon-wrap"><i className="fa-solid fa-book-open" /></div>
                    <div><div className="clpr-unit-name">{u.unitName}</div><div className="clpr-unit-sub">Unit {u.unitNo}</div></div>
                  </div>
                  <div className="clpr-unit-stats">
                    <span className="clpr-stat clpr-stat--total"><i className="fa-solid fa-book" /> {u.lessons.length} lesson{u.lessons.length !== 1 ? 's' : ''}</span>
                    <span className="clpr-stat-sep">·</span><span className="clpr-stat clpr-stat--manual"><i className="fa-solid fa-pen-to-square" /> {manual} manual</span>
                    <span className="clpr-stat-sep">·</span><span className="clpr-stat clpr-stat--ai"><i className="fa-solid fa-robot" /> {ai} AI</span>
                  </div>
                  <div className="clpr-unit-right" onClick={(e) => e.stopPropagation()}>
                    <button className="clpr-icon-btn clpr-icon-btn--pdf" title="PDF" onClick={() => (u.lessons.length ? exportReport(unitReport(u), 'pdf', fire) : fire('No lessons to export', 'warn'))}><i className="fa-solid fa-file-pdf" /></button>
                    <button className="clpr-icon-btn" title="Edit Unit" onClick={() => setUnitModal({ mode: 'edit', unit: u })}><i className="fa-solid fa-pen" /></button>
                    <button className="clpr-icon-btn clpr-icon-btn--del" title="Delete" onClick={() => setDel({ kind: 'unit', id: u.id, name: u.unitName })}><i className="fa-solid fa-trash-can" /></button>
                    <button className={`clpr-icon-btn clpr-icon-btn--expand${isOpen ? ' open' : ''}`} onClick={() => setOpenId(isOpen ? null : u.id)}><i className="fa-solid fa-chevron-down" /></button>
                  </div>
                </div>
                {isOpen && (
                  <div className="clpr-lessons-panel">
                    {u.lessons.length === 0 ? <div className="clpr-no-lessons"><i className="fa-solid fa-plus-circle" style={{ color: 'var(--brand)', opacity: 0.4 }} /> No lessons yet</div>
                      : u.lessons.map((l, li) => (
                        <div className="clpr-lesson-card" key={l.id}>
                          <div className="clpr-lesson-meta">
                            <span className="clpr-lesson-num">#{li + 1}</span><span className="clpr-lesson-num-tag">{l.num}</span>
                            <i className="fa-regular fa-file-lines clpr-lesson-file-icon" /><span className="clpr-lesson-name">{l.topic}</span>
                          </div>
                          <span className={`clp-src-badge ${l.source}`}><i className={`fa-solid ${SRC[l.source]?.icon}`} /> {SRC[l.source]?.label}</span>
                          <div className="clpr-lesson-actions">
                            <button className="clpr-action-btn" onClick={() => setView({ unit: u, lesson: l })}><i className="fa-solid fa-eye" /> View</button>
                            <button className="clpr-action-btn clpr-action-edit" onClick={() => setLessonModal({ unitId: u.id, lesson: l })}><i className="fa-solid fa-pen" /> Edit</button>
                            <button className="clpr-action-btn clpr-action-pdf" onClick={() => exportReport(lessonReport(u, l), 'pdf', fire)}><i className="fa-solid fa-file-pdf" /> PDF</button>
                            <button className="clpr-action-btn clpr-action-del" onClick={() => setDel({ kind: 'lesson', unitId: u.id, id: l.id, name: l.topic })}><i className="fa-solid fa-trash-can" /></button>
                          </div>
                        </div>
                      ))}
                    <button className="clpr-action-btn clpr-action-edit" style={{ marginTop: 4 }} onClick={() => setLessonModal({ unitId: u.id })}><i className="fa-solid fa-plus" /> Add Lesson Plan</button>
                  </div>
                )}
              </div>
            )
          })}
      </div>
      {unitModal && <UnitModal modal={unitModal} onClose={() => setUnitModal(null)} onSave={saveUnit} onToast={fire} />}
      {lessonModal && <LessonModal modal={lessonModal} onClose={() => setLessonModal(null)} onSave={saveLesson} onToast={fire} />}
      {view && <LessonViewer view={view} a={a} onClose={() => setView(null)} />}
      {del && <ConfirmModal title={`Remove ${del.kind === 'unit' ? 'Unit' : 'Lesson'}?`} body={`“${del.name}” will be removed.`} onClose={() => setDel(null)} onConfirm={() => (del.kind === 'unit' ? delUnit(del.id) : delLesson(del.unitId, del.id))} />}
    </div>
  )
}

function UnitModal({ modal, onClose, onSave, onToast }) {
  const u = modal.unit
  const [unitNo, setUnitNo] = useState(u?.unitNo || '')
  const [unitName, setUnitName] = useState(u?.unitName || '')
  const save = () => { if (!unitName.trim()) return onToast('Enter the unit name', 'warn'); onSave({ unitNo: unitNo.trim() || '1', unitName: unitName.trim() }, u?.id) }
  return (
    <ModalShell title={u ? 'Edit Unit' : 'Add Unit'} icon="fa-layer-group" maxWidth={460} onClose={onClose} foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12 }}>
        <div className="ac-field"><label>Unit No.</label><input className="ac-input" value={unitNo} onChange={(e) => setUnitNo(e.target.value)} placeholder="1" /></div>
        <div className="ac-field"><label>Unit Name</label><input className="ac-input" value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. Fizza's Family" /></div>
      </div>
    </ModalShell>
  )
}

const SEC_DOT = ['#1E40AF', '#0284C7', '#7C3AED', '#16A34A']
function LessonModal({ modal, onClose, onSave, onToast }) {
  const l = modal.lesson
  const [topic, setTopic] = useState(l?.topic || '')
  const [num, setNum] = useState(l?.num || '')
  const [source, setSource] = useState(l?.source || 'manual')
  const [duration, setDuration] = useState(l?.duration || 45)
  const [sections, setSections] = useState(() => l?.sections ? JSON.parse(JSON.stringify(l.sections)) : LP_SECTIONS.map((s) => ({ title: s.title, mins: s.mins, content: '' })))
  const setSec = (i, k, v) => setSections((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const save = () => { if (!topic.trim()) return onToast('Enter the lesson topic', 'warn'); onSave(modal.unitId, { topic: topic.trim(), num: Number(num) || undefined, source, duration: Number(duration) || 45, sections }, l?.id) }
  return (
    <ModalShell title={l ? 'Edit Lesson Plan' : 'Create Lesson Plan'} icon="fa-file-lines" maxWidth={920} onClose={onClose} foot={<><div style={{ fontSize: 12, color: 'var(--tm)', marginRight: 'auto' }}><i className="fa-solid fa-circle-info" /> Fill all sections before saving</div><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save &amp; Close</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 150px', gap: 12, marginBottom: 16 }}>
        <div className="ac-field"><label>Lesson Topic *</label><input className="ac-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter lesson plan topic" /></div>
        <div className="ac-field"><label>Lesson No.</label><input className="ac-input" value={num} onChange={(e) => setNum(e.target.value)} placeholder="auto" /></div>
        <div className="ac-field"><label>Duration (min)</label><input className="ac-input" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
        <div className="ac-field"><label>Source</label><select className="ac-input" value={source} onChange={(e) => setSource(e.target.value)}><option value="manual">Manual</option><option value="ai">Mentor AI</option></select></div>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Lesson Plan Sections</div>
      {sections.map((s, i) => (
        <div className="clp-sec" key={i}>
          <div className="clp-sec-hd">
            <div className="clp-sec-dot" style={{ background: SEC_DOT[i] || '#1E40AF' }} />
            <div><div className="clp-sec-title">{LP_SECTIONS[i]?.icon} {s.title}</div>{LP_SECTIONS[i]?.hint && <div className="clp-sec-hint">{LP_SECTIONS[i].hint}</div>}</div>
            <span className="clp-sec-mins"><i className="fa-regular fa-clock" /><input type="number" value={s.mins} onChange={(e) => setSec(i, 'mins', Number(e.target.value) || 0)} /> mins</span>
          </div>
          <RichEditor value={s.content} onChange={(html) => setSec(i, 'content', html)} placeholder={`Write the ${s.title.toLowerCase()}…`} />
        </div>
      ))}
    </ModalShell>
  )
}

/* ── Rich text editor (contentEditable + toolbar) ── */
function RichEditor({ value, onChange, placeholder, minHeight }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '' }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const cmd = (c, v) => { ref.current?.focus(); document.execCommand(c, false, v); onChange(ref.current.innerHTML) }
  const color = () => { const c = window.prompt('Text colour (name or #hex):', '#DC2626'); if (c) cmd('foreColor', c) }
  const link = () => { const u = window.prompt('Link URL:', 'https://'); if (u) cmd('createLink', u) }
  const table = () => { const r = +window.prompt('Rows:', '2') || 2; const cc = +window.prompt('Columns:', '2') || 2; let h = '<table>'; for (let i = 0; i < r; i += 1) { h += '<tr>'; for (let j = 0; j < cc; j += 1) h += '<td>&nbsp;</td>'; h += '</tr>' } h += '</table>'; cmd('insertHTML', h) }
  return (
    <div className="rte">
      <div className="rte-toolbar" onMouseDown={(e) => e.preventDefault()}>
        <button className="rte-btn" title="Undo" onClick={() => cmd('undo')}><i className="fa-solid fa-rotate-left" /></button>
        <button className="rte-btn" title="Redo" onClick={() => cmd('redo')}><i className="fa-solid fa-rotate-right" /></button>
        <div className="rte-div" />
        <select className="rte-sel" title="Font size" defaultValue="" onChange={(e) => { cmd('fontSize', e.target.value); e.target.value = '' }}><option value="" disabled>Size</option><option value="1">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">X-Large</option></select>
        <div className="rte-div" />
        <button className="rte-btn" title="Bold" onClick={() => cmd('bold')}><b>B</b></button>
        <button className="rte-btn" title="Underline" onClick={() => cmd('underline')}><u>U</u></button>
        <button className="rte-btn" title="Italic" onClick={() => cmd('italic')}><i>I</i></button>
        <button className="rte-btn" title="Strikethrough" onClick={() => cmd('strikeThrough')}><s>S</s></button>
        <button className="rte-btn" title="Text colour" onClick={color} style={{ color: '#DC2626', fontWeight: 800, textDecoration: 'underline' }}>A</button>
        <div className="rte-div" />
        <button className="rte-btn" title="Align left" onClick={() => cmd('justifyLeft')}><i className="fa-solid fa-align-left" /></button>
        <button className="rte-btn" title="Align center" onClick={() => cmd('justifyCenter')}><i className="fa-solid fa-align-center" /></button>
        <button className="rte-btn" title="Align right" onClick={() => cmd('justifyRight')}><i className="fa-solid fa-align-right" /></button>
        <div className="rte-div" />
        <button className="rte-btn" title="Numbered list" onClick={() => cmd('insertOrderedList')}><i className="fa-solid fa-list-ol" /></button>
        <button className="rte-btn" title="Bullet list" onClick={() => cmd('insertUnorderedList')}><i className="fa-solid fa-list-ul" /></button>
        <button className="rte-btn" title="Insert table" onClick={table}><i className="fa-solid fa-table-cells" /></button>
        <button className="rte-btn" title="Insert link" onClick={link}><i className="fa-solid fa-link" /></button>
        <div className="rte-div" />
        <button className="rte-btn" title="Clear formatting" onClick={() => cmd('removeFormat')} style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm)' }}>Clear</button>
      </div>
      <div className="rte-editor" contentEditable suppressContentEditableWarning ref={ref} data-ph={placeholder} style={minHeight ? { minHeight } : undefined} onInput={() => onChange(ref.current.innerHTML)} onBlur={() => onChange(ref.current.innerHTML)} />
    </div>
  )
}

function LessonViewer({ view, a, onClose }) {
  const { unit, lesson } = view
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 680 }}>
        <div className="pay-modal-hdr" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
          <div className="pay-modal-av" style={{ background: 'rgba(255,255,255,.15)' }}><i className="fa-solid fa-book-open" /></div>
          <div><div className="pay-modal-title" style={{ color: '#fff' }}>{lesson.topic}</div><div className="pay-modal-sub" style={{ color: 'rgba(255,255,255,.85)' }}>Unit {unit.unitNo} — {unit.unitName} · {className(a, unit.classId)} · {subjectName(a, unit.subjectId)} · {lesson.duration || 45} min · {SRC[lesson.source]?.label}</div></div>
          <button className="pay-modal-x" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">
          {lesson.sections.map((s, i) => (
            <div className="clp-view-sec" key={i}>
              <div className="clp-view-sec-title">{LP_SECTIONS[i]?.icon} {s.title} <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--tm)', fontSize: 11 }}>{s.mins} min</span></div>
              <div className="clp-view-sec-content" dangerouslySetInnerHTML={{ __html: s.content || '—' }} />
            </div>
          ))}
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>,
    document.body,
  )
}

/* ════════ NOTEBOOK PLANS (units → question sets by type) ════════ */
const stripHtml = (h) => (h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const aqOrdinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
function blankItem(type) {
  const cfg = AQ_CONFIG[type] || {}
  switch (cfg.layout) {
    case 'two': return { a: '', b: '' }
    case 'match': return { colA: '', colB: '' }
    case 'word-sentence': return { word: '', sentence: '' }
    case 'mcq': return { question: '', opt1: '', opt2: '', opt3: '', opt4: '', correct: '' }
    case 'fill-blanks': return { question: '', answer: '' }
    case 'true-false': return { question: '', answer: '' }
    case 'qa-rte': return { question: '', answer: '' }
    case 'circle': return { statement: '', answer: '' }
    case 'punctuation': return { question: '', answer: '' }
    case 'rte': return Object.fromEntries(cfg.fields.map((f) => [f.key, '']))
    default: return { text: '' }
  }
}
function itemPreview(type, it) {
  const cfg = AQ_CONFIG[type] || {}
  switch (cfg.layout) {
    case 'two': return `${it.a || '—'}  ${cfg.arrow}  ${it.b || '—'}`
    case 'match': return `${it.colA || '—'}  ↔  ${it.colB || '—'}`
    case 'word-sentence': return `${it.word || '—'} → ${it.sentence || '—'}`
    case 'mcq': return `${it.question || '—'} (Ans: ${it.correct || '—'})`
    case 'fill-blanks': return `${it.question || '—'} (Ans: ${it.answer || '—'})`
    case 'true-false': return `${it.question || '—'} (Ans: ${it.answer ? (it.answer === 'true' ? 'True' : 'False') : '—'})`
    case 'qa-rte': return `${stripHtml(it.question) || '—'}${stripHtml(it.answer) ? `  →  ${stripHtml(it.answer)}` : ''}`
    case 'circle': return `${it.statement || '—'} (Circle: ${it.answer || '—'})`
    case 'punctuation': return `${it.question || '—'} → ${it.answer || '—'}`
    case 'rte': return stripHtml(it[cfg.fields[0].key]) || '—'
    default: return it.text || '—'
  }
}
const aqRowFilled = (cfg, it) => {
  switch (cfg.layout) {
    case 'two': return it.a.trim() || it.b.trim()
    case 'match': return it.colA.trim() || it.colB.trim()
    case 'word-sentence': return it.word.trim() || it.sentence.trim()
    case 'mcq': return it.question.trim()
    case 'fill-blanks': return it.question.trim()
    case 'true-false': return it.question.trim()
    case 'qa-rte': return stripHtml(it.question) || stripHtml(it.answer)
    case 'circle': return it.statement.trim()
    case 'punctuation': return it.question.trim()
    case 'rte': return cfg.fields.some((f) => stripHtml(it[f.key]))
    default: return (it.text || '').trim()
  }
}

function NotebookPlans({ a, commit, fire }) {
  const [classId, setClassId] = useState(String(a.classes[0]?.id || ''))
  const [subjectId, setSubjectId] = useState(String(subjectsOfClass(a, a.classes[0]?.id)[0]?.id || ''))
  const [openId, setOpenId] = useState(null)
  const [openSet, setOpenSet] = useState({})
  const [unitModal, setUnitModal] = useState(null)
  const [aq, setAq] = useState(null)
  const [del, setDel] = useState(null)

  // Normalise defensively: any unit from older saved data may lack `questions`.
  const units = a.notebookPlans.filter((u) => u.classId === Number(classId) && u.subjectId === Number(subjectId)).map((u) => ({ ...u, questions: u.questions || [] }))
  const saveUnit = (data, id) => {
    if (id) commit({ ...a, notebookPlans: a.notebookPlans.map((u) => (u.id === id ? { ...u, ...data } : u)) })
    else { const nid = a.nextId; commit({ ...a, nextId: nid + 1, notebookPlans: [...a.notebookPlans, { id: nid, classId: Number(classId), subjectId: Number(subjectId), questions: [], ...data }] }) }
    setUnitModal(null); fire(id ? 'Unit updated' : 'Unit added')
  }
  const saveQuestions = (unitId, type, mainQuestion, items, setId) => {
    commit({ ...a, notebookPlans: a.notebookPlans.map((u) => (u.id !== unitId ? u : { ...u, questions: setId ? (u.questions || []).map((q) => (q.id === setId ? { ...q, type, mainQuestion, items } : q)) : [...(u.questions || []), { id: Date.now(), type, mainQuestion, items }] })) })
    setAq(null); fire(setId ? 'Questions updated' : 'Questions added')
  }
  const delUnit = (id) => { commit({ ...a, notebookPlans: a.notebookPlans.filter((u) => u.id !== id) }); setDel(null); fire('Unit removed', 'info') }
  const delSet = (unitId, setId) => { commit({ ...a, notebookPlans: a.notebookPlans.map((u) => (u.id === unitId ? { ...u, questions: (u.questions || []).filter((q) => q.id !== setId) } : u)) }); setDel(null); fire('Question field removed', 'info') }

  const setReport = (u, q) => ({
    title: `Notebook — ${aqLabel(q.type)}`, period: `${className(a, Number(classId))} · ${subjectName(a, Number(subjectId))}`,
    filters: [['Unit', `${u.unitNo} — ${u.unitName}`], ['Question Type', aqLabel(q.type)], ['Items', String(q.items.length)]],
    sections: [{ title: aqLabel(q.type), html: `${q.mainQuestion ? `<p style="font-weight:700;color:#1E3A8A;margin-bottom:6px">${esc(q.mainQuestion)}</p>` : ''}<ol style="padding-left:18px">${q.items.map((it) => `<li style="margin:4px 0">${esc(itemPreview(q.type, it))}</li>`).join('')}</ol>` }],
  })
  const unitReport = (u) => ({
    title: `Notebook Plan — Unit ${u.unitNo}`, period: `${className(a, Number(classId))} · ${subjectName(a, Number(subjectId))}`,
    filters: [['Class', className(a, Number(classId))], ['Subject', subjectName(a, Number(subjectId))], ['Unit', u.unitName], ['Question Fields', String(u.questions.length)]],
    sections: u.questions.map((q) => ({ title: `${aqLabel(q.type)} (${q.items.length})`, html: `${q.mainQuestion ? `<p style="font-weight:700;color:#1E3A8A;margin-bottom:6px">${esc(q.mainQuestion)}</p>` : ''}<ol style="padding-left:18px">${q.items.map((it) => `<li style="margin:4px 0">${esc(itemPreview(q.type, it))}</li>`).join('')}</ol>` })),
  })

  return (
    <div className="section-card">
      <div className="card-header"><div><div className="card-title"><i className="fa-solid fa-book" /> Notebook Plans</div><div className="card-sub">Add notebook question fields, unit-wise, for every class and subject.</div></div></div>
      <div style={{ padding: '14px 16px 0' }}>
        <ClassSubjectBar a={a} classId={classId} setClassId={setClassId} subjectId={subjectId} setSubjectId={setSubjectId}>
          <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setUnitModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Unit</button>
        </ClassSubjectBar>
      </div>
      <div style={{ padding: 16 }}>
        {units.length === 0 ? <div className="ac-empty"><i className="fa-solid fa-book" /><div style={{ fontSize: 13, fontWeight: 700 }}>No notebook plans yet</div><div style={{ fontSize: 12, marginTop: 4 }}>Click “Add Unit”.</div></div>
          : units.map((u, ui) => {
            const isOpen = openId === u.id
            const items = u.questions.reduce((n, q) => n + q.items.length, 0)
            return (
              <div className={`clpr-unit-card${isOpen ? ' open' : ''}`} key={u.id}>
                <div className="clpr-unit-header" onClick={() => setOpenId(isOpen ? null : u.id)}>
                  <div className="clpr-unit-left">
                    <div className="clpr-unit-sno">{ui + 1}</div>
                    <div className="clpr-unit-icon-wrap" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-book" /></div>
                    <div><div className="clpr-unit-name">{u.unitName}</div><div className="clpr-unit-sub">Unit {u.unitNo}</div></div>
                  </div>
                  <div className="clpr-unit-stats">
                    <span className="clpr-stat clpr-stat--total"><i className="fa-solid fa-layer-group" /> {u.questions.length} field{u.questions.length !== 1 ? 's' : ''}</span>
                    <span className="clpr-stat-sep">·</span><span className="clpr-stat clpr-stat--ai"><i className="fa-solid fa-list-ol" /> {items} item{items !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="clpr-unit-right" onClick={(e) => e.stopPropagation()}>
                    <button className="clpr-icon-btn clpr-icon-btn--pdf" title="PDF" onClick={() => (u.questions.length ? exportReport(unitReport(u), 'pdf', fire) : fire('No questions to export', 'warn'))}><i className="fa-solid fa-file-pdf" /></button>
                    <button className="clpr-icon-btn" title="Edit Unit" onClick={() => setUnitModal({ mode: 'edit', unit: u })}><i className="fa-solid fa-pen" /></button>
                    <button className="clpr-icon-btn clpr-icon-btn--del" title="Delete" onClick={() => setDel({ kind: 'unit', id: u.id, name: u.unitName })}><i className="fa-solid fa-trash-can" /></button>
                    <button className={`clpr-icon-btn clpr-icon-btn--expand${isOpen ? ' open' : ''}`} onClick={() => setOpenId(isOpen ? null : u.id)}><i className="fa-solid fa-chevron-down" /></button>
                  </div>
                </div>
                {isOpen && (
                  <div className="clpr-lessons-panel">
                    {u.questions.length === 0 ? <div className="clpr-no-lessons"><i className="fa-solid fa-plus-circle" style={{ color: 'var(--brand)', opacity: 0.4 }} /> No question fields yet</div>
                      : u.questions.map((q) => {
                        const so = openSet[q.id]
                        return (
                          <div className="nbq-row" key={q.id}>
                            <div className="nbq-head" onClick={() => setOpenSet((s) => ({ ...s, [q.id]: !s[q.id] }))}>
                              <div className="nbq-ic"><i className={`fa-solid ${AQ_CONFIG[q.type]?.icon || 'fa-circle-question'}`} /></div>
                              <div style={{ flex: 1, minWidth: 0 }}><div className="nbq-name">{aqLabel(q.type)}</div><div className="nbq-count">{q.mainQuestion ? `${q.mainQuestion} · ` : ''}{q.items.length} item{q.items.length !== 1 ? 's' : ''}</div></div>
                              <button className="clpr-action-btn clpr-action-edit" onClick={(e) => { e.stopPropagation(); setAq({ unitId: u.id, set: q }) }}><i className="fa-solid fa-pen" /> Edit</button>
                              <button className="clpr-action-btn clpr-action-pdf" onClick={(e) => { e.stopPropagation(); exportReport(setReport(u, q), 'pdf', fire) }}><i className="fa-solid fa-file-pdf" /> Report</button>
                              <button className="clpr-action-btn clpr-action-del" onClick={(e) => { e.stopPropagation(); setDel({ kind: 'set', unitId: u.id, id: q.id, name: aqLabel(q.type) }) }}><i className="fa-solid fa-trash-can" /></button>
                              <i className={`fa-solid fa-chevron-${so ? 'up' : 'down'}`} style={{ color: 'var(--tm)', marginLeft: 4 }} />
                            </div>
                            {so && <div className="nbq-body">{q.mainQuestion && <div className="nbq-mainq"><i className="fa-solid fa-quote-left" style={{ fontSize: 9, marginRight: 6, opacity: 0.5 }} />{q.mainQuestion}</div>}{q.items.map((it, i) => <div className="nbq-item" key={i}><span className="nbq-item-num">{i + 1}.</span><span>{itemPreview(q.type, it)}</span></div>)}</div>}
                          </div>
                        )
                      })}
                    <button className="clpr-action-btn clpr-action-edit" style={{ marginTop: 4 }} onClick={() => setAq({ unitId: u.id })}><i className="fa-solid fa-plus" /> Add Questions</button>
                  </div>
                )}
              </div>
            )
          })}
      </div>
      {unitModal && <UnitModal modal={unitModal} onClose={() => setUnitModal(null)} onSave={saveUnit} onToast={fire} />}
      {aq && <AQModal aq={aq} unitName={a.notebookPlans.find((u) => u.id === aq.unitId)?.unitName} onClose={() => setAq(null)} onSave={saveQuestions} onToast={fire} />}
      {del && <ConfirmModal title={`Remove ${del.kind === 'unit' ? 'Unit' : 'Question Field'}?`} body={`“${del.name}” will be removed.`} onClose={() => setDel(null)} onConfirm={() => (del.kind === 'unit' ? delUnit(del.id) : delSet(del.unitId, del.id))} />}
    </div>
  )
}

/* ── Add Questions modal (type grid → per-type form → rows) ── */
function AQModal({ aq, unitName, onClose, onSave, onToast }) {
  const editing = aq.set
  const [type, setType] = useState(editing?.type || null)
  const [mainQ, setMainQ] = useState(editing?.mainQuestion || '')
  const [items, setItems] = useState(() => (editing ? JSON.parse(JSON.stringify(editing.items)) : []))
  const cfg = type ? AQ_CONFIG[type] : null
  const isComp = type === 'comprehension'
  const pickType = (t) => { setType(t); setItems([blankItem(t)]); setMainQ('') }
  const addRow = () => setItems((s) => [...s, blankItem(type)])
  const rmRow = (i) => setItems((s) => s.filter((_, j) => j !== i))
  const setRow = (i, patch) => setItems((s) => s.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const save = () => {
    if (!type) return onToast('Select a question type', 'warn')
    if (!mainQ.trim()) return onToast(isComp ? 'Enter the comprehension statement' : 'Enter the main question', 'warn')
    const clean = items.filter((it) => aqRowFilled(cfg, it))
    if (!clean.length) return onToast('Add at least one item', 'warn')
    onSave(aq.unitId, type, mainQ.trim(), clean, editing?.id)
  }
  const rowTitle = (i) => {
    if (cfg.layout === 'qa-rte') return `${aqOrdinal(i + 1)} Question`
    if (cfg.layout === 'rte') return `${cfg.title} ${i + 1}`
    return `Row ${i + 1}`
  }
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: type && ['rte', 'qa-rte'].includes(cfg.layout) ? 760 : 660 }}>
        <div className="pay-modal-hdr" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}>
          <div className="pay-modal-av" style={{ background: 'rgba(255,255,255,.15)' }}><i className="fa-solid fa-circle-question" /></div>
          <div><div className="pay-modal-title" style={{ color: '#fff' }}>Add Questions</div><div className="pay-modal-sub" style={{ color: 'rgba(255,255,255,.85)' }}>{unitName || 'Select a question type'}</div></div>
          <button className="pay-modal-x" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">
          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Select Question Field</div>
          <div className="aq-types-grid">
            {AQ_TYPES.map((t) => <button key={t.id} className={`aq-type-btn${type === t.id ? ' active' : ''}`} onClick={() => { if (!editing) pickType(t.id) }} disabled={!!editing && editing.type !== t.id}><i className={`fa-solid ${t.icon}`} /> {t.label}</button>)}
          </div>
          {type && (
            <div className="aq-form">
              <div className="aq-form-title"><i className={`fa-solid ${cfg.icon}`} /> {cfg.title}</div>
              <div className="aq-mq">
                <label className="aq-mq-label">{isComp ? 'Comprehension Statement' : 'Main Question'} <span style={{ color: 'var(--err)' }}>*</span></label>
                {isComp
                  ? <textarea className="aq-mq-input" rows={5} value={mainQ} onChange={(e) => setMainQ(e.target.value)} placeholder="Enter the comprehension statement / passage…" />
                  : <input className="aq-mq-input" value={mainQ} onChange={(e) => setMainQ(e.target.value)} placeholder="Enter main question (e.g. Write the opposites of the following words)" />}
              </div>
              <div className="aq-items-label">{isComp ? 'Questions' : 'Items'}</div>
              {items.map((it, i) => (
                <div className="aq-card" key={i}>
                  <div className="aq-card-top">
                    <span className="aq-row-num">{i + 1}</span>
                    <span className="aq-card-ttl">{rowTitle(i)}</span>
                    <button className="aq-card-del" title="Remove" onClick={() => rmRow(i)}><i className="fa-solid fa-trash-can" /></button>
                  </div>

                  {cfg.layout === 'two' && (
                    <div className="aq-two">
                      <div className="aq-fld"><label>{cfg.a}</label><input className="ac-input" value={it.a} onChange={(e) => setRow(i, { a: e.target.value })} placeholder={cfg.a} /></div>
                      <span className="aq-two-arrow">{cfg.arrow}</span>
                      <div className="aq-fld"><label>{cfg.b}</label><input className="ac-input" value={it.b} onChange={(e) => setRow(i, { b: e.target.value })} placeholder={cfg.b} /></div>
                    </div>
                  )}

                  {cfg.layout === 'match' && (<>
                    <div className="aq-two">
                      <div className="aq-fld"><label style={{ color: '#0369A1' }}>Column A</label><input className="ac-input" value={it.colA} onChange={(e) => setRow(i, { colA: e.target.value })} placeholder="e.g. Apple, Cat, Big…" /></div>
                      <span className="aq-two-arrow">↔</span>
                      <div className="aq-fld"><label style={{ color: '#6D28D9' }}>Column B (Correct Match)</label><input className="ac-input" value={it.colB} onChange={(e) => setRow(i, { colB: e.target.value })} placeholder="e.g. Fruit, Animal, Small…" /></div>
                    </div>
                    <div className="aq-note"><i className="fa-solid fa-circle-info" /> Correct matching shown here for setup. While writing on the board, shuffle Column B manually.</div>
                  </>)}

                  {cfg.layout === 'word-sentence' && (
                    <div className="aq-ws">
                      <div className="aq-fld" style={{ flex: '0 0 160px' }}><label>Word</label><input className="ac-input" value={it.word} onChange={(e) => setRow(i, { word: e.target.value })} placeholder="Enter word" /></div>
                      <span className="aq-two-arrow" style={{ alignSelf: 'flex-end', paddingBottom: 9 }}>→</span>
                      <div className="aq-fld" style={{ flex: 1 }}><label>Sentence</label><textarea className="ac-input" rows={2} value={it.sentence} onChange={(e) => setRow(i, { sentence: e.target.value })} placeholder="Write a sentence using this word…" /></div>
                    </div>
                  )}

                  {cfg.layout === 'mcq' && (<>
                    <div className="aq-fld"><label>Question</label><input className="ac-input" value={it.question} onChange={(e) => setRow(i, { question: e.target.value })} placeholder="Enter question text…" /></div>
                    <div className="aq-mcq-grid">
                      {[['opt1', 'A'], ['opt2', 'B'], ['opt3', 'C'], ['opt4', 'D']].map(([key, ltr]) => (
                        <div className="aq-opt" key={key}><span className="aq-opt-badge">{ltr}</span><input value={it[key]} onChange={(e) => setRow(i, { [key]: e.target.value })} placeholder={`Option ${ltr}`} /></div>
                      ))}
                    </div>
                    <div className="aq-correct"><i className="fa-solid fa-circle-check" /><span>CORRECT ANSWER</span><input value={it.correct} onChange={(e) => setRow(i, { correct: e.target.value })} placeholder="A / B / C / D or exact text" /></div>
                  </>)}

                  {cfg.layout === 'fill-blanks' && (<>
                    <div className="aq-fld"><label>Statement (use ___ for blank)</label><textarea className="ac-input" rows={2} value={it.question} onChange={(e) => setRow(i, { question: e.target.value })} placeholder="Write the statement here. Use ___ where the blank should be…" /></div>
                    <div className="aq-answer-strip"><i className="fa-solid fa-key" /><label>Blank Answer:</label><input className="ac-input" style={{ maxWidth: 240 }} value={it.answer} onChange={(e) => setRow(i, { answer: e.target.value })} placeholder="One word…" /></div>
                  </>)}

                  {cfg.layout === 'true-false' && (<>
                    <div className="aq-fld"><label>Statement</label><input className="ac-input" value={it.question} onChange={(e) => setRow(i, { question: e.target.value })} placeholder="Write the statement — students mark True or False…" /></div>
                    <div className="aq-tf">
                      <button className={`aq-tf-btn t${it.answer === 'true' ? ' sel' : ''}`} onClick={() => setRow(i, { answer: 'true' })}><i className="fa-solid fa-check" /> True</button>
                      <button className={`aq-tf-btn f${it.answer === 'false' ? ' sel' : ''}`} onClick={() => setRow(i, { answer: 'false' })}><i className="fa-solid fa-xmark" /> False</button>
                    </div>
                    <div className="aq-tf-hint">{it.answer ? <>Answer marked: <strong>{it.answer === 'true' ? 'True' : 'False'}</strong></> : 'Click True or False to mark the correct answer'}</div>
                  </>)}

                  {cfg.layout === 'qa-rte' && (<>
                    <div className="aq-rte-field"><label>{cfg.qLabel || 'Question'}</label><RichEditor value={it.question} onChange={(html) => setRow(i, { question: html })} placeholder="Write the question here…" minHeight={80} /></div>
                    <div className="aq-rte-field" style={{ marginTop: 12 }}><label>{cfg.aLabel || 'Answer'}</label><RichEditor value={it.answer} onChange={(html) => setRow(i, { answer: html })} placeholder="Write the answer here…" minHeight={80} /></div>
                  </>)}

                  {cfg.layout === 'circle' && (<>
                    <div className="aq-fld"><label>Statement / Sentence with word choices</label><input className="ac-input" value={it.statement} onChange={(e) => setRow(i, { statement: e.target.value })} placeholder="e.g. The cat is (big / small / tall)." /></div>
                    <div className="aq-answer-strip"><i className="fa-regular fa-circle-dot" /><label>Correct Word to Circle:</label><input className="ac-input" style={{ maxWidth: 240 }} value={it.answer} onChange={(e) => setRow(i, { answer: e.target.value })} placeholder="Type the correct word…" /></div>
                  </>)}

                  {cfg.layout === 'punctuation' && (<>
                    <div className="aq-fld"><label>Unpunctuated Sentence</label><textarea className="ac-input" rows={2} value={it.question} onChange={(e) => setRow(i, { question: e.target.value })} placeholder="Write the sentence without punctuation (e.g. the cat sat on the mat it was happy)" /></div>
                    <div className="aq-fld" style={{ marginTop: 10 }}><label><i className="fa-solid fa-pen-nib" style={{ marginRight: 5, color: '#0891B2' }} />Correctly Punctuated (Answer)</label><textarea className="ac-input" rows={2} value={it.answer} onChange={(e) => setRow(i, { answer: e.target.value })} placeholder="Write the correctly punctuated sentence…" /></div>
                  </>)}

                  {cfg.layout === 'rte' && cfg.fields.map((f) => (
                    <div className="aq-rte-field" key={f.key}><label>{f.label}</label><RichEditor value={it[f.key]} onChange={(html) => setRow(i, { [f.key]: html })} placeholder={`Write the ${f.label.toLowerCase()}…`} minHeight={90} /></div>
                  ))}
                </div>
              ))}
              <button className="aq-add-more" onClick={addRow}><i className="fa-solid fa-plus" /> {type === 'stories' ? 'Add More Stories' : type === 'essays' ? 'Add More Essays' : 'Add More'}</button>
            </div>
          )}
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Questions</button></div>
      </div>
    </div>,
    document.body,
  )
}

function ModalShell({ title, icon, maxWidth, foot, children, onClose }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: maxWidth || 560 }}>
        <div className="pay-modal-hdr"><div className="pay-modal-av"><i className={`fa-solid ${icon}`} /></div><div><div className="pay-modal-title">{title}</div></div><button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
        <div className="pay-modal-body">{children}</div>
        <div className="pay-modal-foot">{foot}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ════════ OTHER ACADEMIC RESOURCES (class/subject/category PDFs) ════════ */
function ResStat({ icon, cat, val, lbl }) {
  const c = cat ? resCategory(cat) : null
  return (
    <div className={`res-stat${c ? ` c-${c.color}` : ''}`}>
      <div className="res-stat-ic"><i className={`fa-solid ${c ? c.icon : icon}`} /></div>
      <div><div className="res-stat-val">{val}</div><div className="res-stat-lbl">{c ? c.label : lbl}</div></div>
    </div>
  )
}

function openResourceSample(r, a, onToast) {
  const chain = loadChainProfile()
  const cat = resCategory(r.category)
  const logo = chain.logo ? `<img style="width:54px;height:54px;border-radius:12px;object-fit:cover" src="${chain.logo}">` : `<div style="width:54px;height:54px;border-radius:12px;background:#1E3A8A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">${esc(chainInitials(chain.chainName))}</div>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(chain.chainName)} — ${esc(r.title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{background:#e9eef6}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0f172a}.pg{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:18mm;box-shadow:0 6px 28px rgba(15,23,42,.18)}
.h{display:flex;gap:14px;align-items:center;border-bottom:3px solid #1E3A8A;padding-bottom:16px;margin-bottom:26px}.org{font-size:19px;font-weight:800}.ol{font-size:11px;color:#64748b;margin-top:2px}
.tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#fff;background:#1E3A8A;border-radius:99px;padding:4px 12px;margin-bottom:14px}
.tt{font-size:26px;font-weight:800;color:#0f172a;line-height:1.25;margin-bottom:16px}.meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}.chip{font-size:12px;font-weight:700;color:#1E40AF;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:6px 12px}
.desc{font-size:13px;color:#334155;line-height:1.7;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:24px}.note{font-size:12px;color:#94a3b8;font-style:italic}
@media print{html,body{background:#fff}.pg{width:auto;min-height:auto;margin:0;box-shadow:none}@page{size:A4;margin:16mm}}</style></head>
<body><div class="pg"><div class="h">${logo}<div><div class="org">${esc(chain.chainName)}</div><div class="ol">${esc(chain.address || '')}</div><div class="ol">${esc(chain.contact || '')}</div></div></div>
<div class="tag">${esc(cat.label)}</div><div class="tt">${esc(r.title)}</div>
<div class="meta"><span class="chip">Class: ${esc(className(a, r.classId))}</span><span class="chip">Subject: ${esc(subjectName(a, r.subjectId))}</span><span class="chip">Category: ${esc(cat.label)}</span></div>
${r.desc ? `<div class="desc">${esc(r.desc)}</div>` : ''}
<div class="note">Sample preview — upload a PDF to this resource to attach the real document. File: ${esc(r.fileName || '—')}</div></div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script></body></html>`
  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to view / download the resource', 'warn'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

function OtherResources({ a, fire, resources, onResources }) {
  // resources prop + onResources → editable snapshot; resources prop only → read-only; neither → live store
  const snapshot = resources !== undefined
  const readOnly = snapshot && !onResources
  const [list, setList] = useState(() => (snapshot ? resources : []))
  const [q, setQ] = useState('')
  const [fClass, setFClass] = useState('all')
  const [fSubject, setFSubject] = useState('all')
  const [fCat, setFCat] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [modal, setModal] = useState(null)
  const [del, setDel] = useState(null)

  useEffect(() => { if (!snapshot) setList(loadResources()) }, [snapshot])
  const persist = (next) => {
    if (readOnly) return
    setList(next)
    if (onResources) { onResources(next); return }
    if (!saveResources(next)) fire('Kept in memory — file too large to store locally', 'warn')
  }

  const save = (payload) => {
    if (modal.mode === 'edit') { persist(list.map((r) => (r.id === modal.resource.id ? { ...r, ...payload } : r))); fire('Resource updated') }
    else { persist([{ id: nextResourceId(list), uploadDate: todayISO(), ...payload }, ...list]); fire('Resource uploaded') }
    setModal(null)
  }
  const doDelete = () => { persist(list.filter((r) => r.id !== del.id)); setDel(null); fire('Resource deleted', 'info') }

  const counts = useMemo(() => ({
    total: list.length,
    worksheet: list.filter((r) => r.category === 'worksheet').length,
    summer: list.filter((r) => r.category === 'summer').length,
    qpaper: list.filter((r) => r.category === 'qpaper').length,
    other: list.filter((r) => r.category === 'other').length,
  }), [list])

  const filtered = list.filter((r) => {
    const s = q.trim().toLowerCase()
    if (s && !r.title.toLowerCase().includes(s)) return false
    if (fClass !== 'all' && r.classId !== Number(fClass)) return false
    if (fSubject !== 'all' && r.subjectId !== Number(fSubject)) return false
    if (fCat !== 'all' && r.category !== fCat) return false
    if (fStatus !== 'all' && r.status !== fStatus) return false
    return true
  })
  const anyFilter = q || fClass !== 'all' || fSubject !== 'all' || fCat !== 'all' || fStatus !== 'all'
  const reset = () => { setQ(''); setFClass('all'); setFSubject('all'); setFCat('all'); setFStatus('all') }

  const viewPdf = (r) => {
    if (r.fileData) { const w = window.open('', '_blank'); if (!w) return fire('Allow pop-ups to view the PDF', 'warn'); w.document.write(`<title>${r.fileName || r.title}</title><iframe src="${r.fileData}" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>`); w.document.close() }
    else openResourceSample(r, a, fire)
  }
  const downloadPdf = (r) => {
    if (r.fileData) { const el = document.createElement('a'); el.href = r.fileData; el.download = r.fileName || `${r.title}.pdf`; document.body.appendChild(el); el.click(); el.remove(); fire('Download started') }
    else openResourceSample(r, a, fire)
  }

  return (
    <div className="section-card">
      <div className="card-header">
        <div><div className="card-title"><i className="fa-solid fa-folder-open" /> Resource Library</div><div className="card-sub">Upload class-wise &amp; subject-wise PDF resources for connected schools.</div></div>
        {!readOnly && <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}><i className="fa-solid fa-upload" /> Add Resource</button>}
      </div>
      <div style={{ padding: 16 }}>
        <div className="ac-info-strip"><i className="fa-solid fa-circle-info" /><span>Upload class-wise and subject-wise academic resources such as worksheets, summer vacation work, question papers, or other PDF documents. These resources can later be viewed by connected schools.</span></div>

        <div className="res-stat-grid">
          <ResStat icon="fa-folder-open" val={counts.total} lbl="Total Resources" />
          <ResStat cat="worksheet" val={counts.worksheet} />
          <ResStat cat="summer" val={counts.summer} />
          <ResStat cat="qpaper" val={counts.qpaper} />
          <ResStat cat="other" val={counts.other} />
        </div>

        <div className="res-filters">
          <div className="res-search"><i className="fa-solid fa-magnifying-glass" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" /></div>
          <select className="ac-input" value={fClass} onChange={(e) => setFClass(e.target.value)}><option value="all">All Classes</option>{a.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="ac-input" value={fSubject} onChange={(e) => setFSubject(e.target.value)}><option value="all">All Subjects</option>{a.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="ac-input" value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="all">All Categories</option>{RES_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
          <select className="ac-input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All Status</option>{Object.entries(RES_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <button className="btn-secondary" onClick={reset} disabled={!anyFilter}><i className="fa-solid fa-rotate-left" /> Reset</button>
        </div>

        {filtered.length === 0 ? <div className="ac-empty"><i className="fa-solid fa-folder-open" /><div style={{ fontSize: 13, fontWeight: 700 }}>No resources found</div><div style={{ fontSize: 12, marginTop: 4 }}>{anyFilter ? 'Try adjusting the filters.' : 'Click “Add Resource” to upload your first PDF.'}</div></div>
          : (
            <div className="res-grid">
              {filtered.map((r) => {
                const cat = resCategory(r.category)
                const st = RES_STATUS[r.status] || RES_STATUS.draft
                return (
                  <div className="res-card" key={r.id}>
                    <div className="res-card-top">
                      <div className={`res-cat-ic c-${cat.color}`}><i className={`fa-solid ${cat.icon}`} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="res-card-title">{r.title}</div>
                        <div className="res-card-meta"><span><i className="fa-solid fa-chalkboard" /> {className(a, r.classId)}</span><span><i className="fa-solid fa-book" /> {subjectName(a, r.subjectId)}</span></div>
                      </div>
                      <span className={`badge ${st.badge}`}>{st.label}</span>
                    </div>
                    <div className="res-badges"><span className={`badge res-cat-badge c-${cat.color}`}><i className={`fa-solid ${cat.icon}`} /> {cat.label}</span></div>
                    {r.desc && <div className="res-card-desc">{r.desc}</div>}
                    <div className="res-card-file"><i className="fa-solid fa-file-pdf" /> <span className="res-file-name">{r.fileName || 'No file attached'}</span>{r.uploadDate && <span className="res-card-date"><i className="fa-regular fa-calendar" /> {fmtDate(r.uploadDate)}</span>}</div>
                    <div className="res-card-actions">
                      <button className="btn-sm res-keep" onClick={() => viewPdf(r)}><i className="fa-solid fa-eye" /> View</button>
                      <button className="btn-sm res-keep" onClick={() => downloadPdf(r)}><i className="fa-solid fa-download" /> Download</button>
                      {!readOnly && <button className="btn-sm" onClick={() => setModal({ mode: 'edit', resource: r })}><i className="fa-solid fa-pen" /> Edit</button>}
                      {!readOnly && <button className="btn-sm" style={{ borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(r)}><i className="fa-solid fa-trash-can" /></button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>
      {modal && <ResourceModal a={a} modal={modal} onClose={() => setModal(null)} onSave={save} onToast={fire} />}
      {del && <ConfirmModal title="Delete Resource?" body={`“${del.title}” will be permanently removed.`} onClose={() => setDel(null)} onConfirm={doDelete} />}
    </div>
  )
}

function ResourceModal({ a, modal, onClose, onSave, onToast }) {
  const r = modal.resource
  const [classId, setClassId] = useState(String(r?.classId || a.classes[0]?.id || ''))
  const [subjectId, setSubjectId] = useState(String(r?.subjectId || subjectsOfClass(a, a.classes[0]?.id)[0]?.id || ''))
  const [category, setCategory] = useState(r?.category || 'worksheet')
  const [title, setTitle] = useState(r?.title || '')
  const [desc, setDesc] = useState(r?.desc || '')
  const status = r?.status || 'published'
  const [fileName, setFileName] = useState(r?.fileName || '')
  const [fileData, setFileData] = useState(r?.fileData || null)
  const fileRef = useRef(null)
  const subs = subjectsOfClass(a, Number(classId))

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { onToast('Please select a PDF file', 'warn'); return }
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => setFileData(reader.result)
    reader.onerror = () => onToast('Could not read the file', 'warn')
    reader.readAsDataURL(f)
  }
  const save = () => {
    if (!classId) return onToast('Select a class', 'warn')
    if (!subjectId) return onToast('Select a subject', 'warn')
    if (!title.trim()) return onToast('Enter a resource title', 'warn')
    onSave({ classId: Number(classId), subjectId: Number(subjectId), category, title: title.trim(), desc: desc.trim(), status, fileName: fileName || null, fileData })
  }

  return (
    <ModalShell title={r ? 'Edit Resource' : 'Add Resource'} icon="fa-folder-open" maxWidth={560} onClose={onClose} foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Resource</button></>}>
      <div className="ac-info-strip" style={{ marginBottom: 14 }}><i className="fa-solid fa-circle-info" /><span>Upload class-wise and subject-wise academic resources such as worksheets, summer vacation work, question papers, or other PDF documents. These resources can later be viewed by connected schools.</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="ac-field"><label>Class *</label><select className="ac-input" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(String(subjectsOfClass(a, Number(e.target.value))[0]?.id || '')) }}>{a.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="ac-field"><label>Subject *</label><select className="ac-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subs.length === 0 ? <option value="">No subjects</option> : subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="ac-field" style={{ gridColumn: '1/-1' }}><label>Category *</label><select className="ac-input" value={category} onChange={(e) => setCategory(e.target.value)}>{RES_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
      </div>
      <div className="ac-field" style={{ marginBottom: 12 }}><label>Resource Title *</label><input className="ac-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. English Grammar Worksheet — Nouns" /></div>
      <div className="ac-field" style={{ marginBottom: 12 }}><label>Resource Description</label><textarea className="ac-input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description of this resource…" /></div>
      <div className="ac-field"><label>Upload PDF</label>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={onFile} />
        <div className="res-upload" onClick={() => fileRef.current?.click()}>
          <i className="fa-solid fa-file-arrow-up" />
          <div>{fileName ? <strong>{fileName}</strong> : 'Click to select a PDF file'}<div className="res-upload-sub">{fileName ? (fileData ? 'Ready to save · click to replace' : 'Existing file') : 'PDF documents only'}</div></div>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── A4 branded export (PDF print / Word download) ── */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function buildReportHTML(report) {
  const chain = loadChainProfile()
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const logo = chain.logo ? `<img class="rep-logo-img" src="${chain.logo}" alt="">` : `<div class="rep-logo">${esc(chainInitials(chain.chainName))}</div>`
  const filters = (report.filters || []).map(([l, v]) => `<span><b>${esc(l)}:</b> ${esc(v)}</span>`).join('')
  const sectionsHtml = report.sections.map((sec) => {
    if (sec.html != null) return `<div class="rep-secttl">${esc(sec.title || '')}</div><div class="rep-html">${sec.html}</div>`
    const thead = sec.columns.map((c) => `<th class="${c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}">${esc(c.label)}</th>`).join('')
    const tbody = sec.rows.length ? sec.rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.columns.length}" style="text-align:center;color:#999;padding:14px">No records.</td></tr>`
    return `${sec.title ? `<div class="rep-secttl">${esc(sec.title)}</div>` : ''}<table class="data"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
  }).join('')
  const header = `<div class="rep-head">${logo}<div class="rep-head-txt"><div class="rep-name">${esc(chain.chainName)}</div><div class="rep-org-line">${esc(chain.address || '')}</div><div class="rep-org-line">${esc(chain.contact || '')}${chain.email ? ' · ' + esc(chain.email) : ''}</div></div><div class="rep-meta"><div class="rep-title">${esc(report.title)}</div><div class="rep-period">${esc(report.period || '')}</div></div></div>${filters ? `<div class="rep-filters">${filters}</div>` : ''}`
  const footer = `<div class="rep-foot"><span>${esc(chain.chainName)}${chain.contact ? ' · ' + esc(chain.contact) : ''}</span><span>Computer-generated · ${esc(report.title)} · ${esc(dateStr)}</span></div>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(chain.chainName)} — ${esc(report.title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{background:#e9eef6}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
.a4{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:13mm;box-shadow:0 6px 28px rgba(15,23,42,.18)}
.wrap{width:100%;border-collapse:collapse}.wrap > thead{display:table-header-group}.wrap > tfoot{display:table-footer-group}
.rep-head{display:flex;align-items:flex-start;gap:13px;border-bottom:2.5px solid #1E3A8A;padding-bottom:10px;margin-bottom:10px}
.rep-logo{width:48px;height:48px;border:2px solid #1E3A8A;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#1E3A8A;font-size:15px;flex-shrink:0}
.rep-logo-img{width:48px;height:48px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0}
.rep-head-txt{flex:1}.rep-name{font-size:18px;font-weight:800;color:#1E3A8A;line-height:1.1}.rep-org-line{font-size:10.5px;color:#555;margin-top:2px}
.rep-meta{text-align:right}.rep-title{font-size:13px;font-weight:800;color:#1E3A8A}.rep-period{font-size:11px;color:#555;margin-top:2px}
.rep-filters{display:flex;flex-wrap:wrap;gap:5px 20px;font-size:10.5px;color:#333;margin-bottom:12px;background:#F1F5FB;padding:9px 13px;border-radius:6px}
.rep-secttl{font-size:12px;font-weight:800;color:#1E3A8A;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #cdd7ea}
.data{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px}
.data th{background:#1E3A8A;color:#fff;padding:6px 8px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.data th.r,.data td.r{text-align:right}.data th.c,.data td.c{text-align:center}
.data td{padding:5px 8px;border-bottom:1px solid #e5e9f2;vertical-align:top}.data tbody tr:nth-child(even) td{background:#f8fafc}
.rep-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:14px;font-size:9px;color:#888;border-top:1px solid #e5e9f2;padding-top:8px}
.rep-html{font-size:11px;color:#333;line-height:1.6;margin-bottom:8px}.rep-html ul,.rep-html ol{padding-left:20px;margin:5px 0}.rep-html table{border-collapse:collapse;margin:6px 0;width:100%}.rep-html td,.rep-html th{border:1px solid #cdd7ea;padding:4px 7px;font-size:10px}.rep-html p{margin:4px 0}
@media print{html,body{background:#fff}.a4{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}@page{size:A4 portrait;margin:13mm}}</style></head>
<body><div class="a4"><table class="wrap"><thead><tr><td>${header}</td></tr></thead><tfoot><tr><td>${footer}</td></tr></tfoot><tbody><tr><td>${sectionsHtml}</td></tr></tbody></table></div>__SCRIPT__</body></html>`
}
function exportReport(report, fmt, onToast, bw) {
  let html = buildReportHTML(report)
  if (bw) html = html.replace(/#1E3A8A/g, '#333').replace(/#1E40AF/g, '#555').replace(/#F1F5FB/g, '#f1f1f1').replace(/#cdd7ea/g, '#ccc')
  if (fmt === 'word') {
    const blob = new Blob([html.replace('__SCRIPT__', '')], { type: 'application/msword' })
    const url = URL.createObjectURL(blob); const aEl = document.createElement('a')
    aEl.href = url; aEl.download = `${report.title.replace(/[^\w]+/g, '_')}.doc`; document.body.appendChild(aEl); aEl.click(); document.body.removeChild(aEl)
    setTimeout(() => URL.revokeObjectURL(url), 1500); onToast?.('Word document downloaded', 'success'); return
  }
  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to download / print the report', 'warn'); return }
  w.document.open(); w.document.write(html.replace('__SCRIPT__', '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>')); w.document.close()
}

function ComingNext({ label }) {
  return (
    <div className="section-card">
      <div className="ac-soon">
        <i className="fa-solid fa-screwdriver-wrench" />
        <div className="ac-soon-title">{label}</div>
        <div className="ac-soon-sub">This sub-module is being built next. The Classes &amp; Subjects you defined in Settings and the Textbooks module are ready — {label} will plug into the same data and theme in the next step.</div>
      </div>
    </div>
  )
}

function ConfirmModal({ title, body, onClose, onConfirm }) {
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">{title}</div>
          <div className="confirm-sub">{body}</div>
          <div className="confirm-btns"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button></div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
