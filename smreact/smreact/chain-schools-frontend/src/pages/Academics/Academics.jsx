import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import { loadAcademics, saveAcademics, className, subjectName, subjectsOfClass, sessionStats, vacationSpan, loadResources, saveResources, RES_CATEGORIES, RES_STATUS, resCategory, nextResourceId } from '../../config/academicsStore'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import { useView } from '../../config/viewContext'
/* Activity Calendar LIVE hai — network ki activities ERP ke API se. */
import { currentNetworkId, activityStatus, fetchNetworkActivities, fetchNetworkActivitiesByMonth, saveNetworkActivity, deleteNetworkActivity } from '../../api/activityCalendarApi'
/* Lesson + Notebook Plans bhi LIVE hain — poori screen ERP ke "Create Lesson
   Plans" jaisi hai aur networkID ki base par chalti hai. */
import CreateLessonPlans from './CreateLessonPlans'
/* Resource Library bhi LIVE hai — network ke PDF resources ERP ke
   /api/manage-resource-library par. Class/subject dropdowns LaunchSetup ki
   ASLI ids se bharte hain (store ki subject id naam se bani hoti hai, wo
   API par nahi chalti — dekhein academicsStore ka subjectIdOf). */
import { fetchNetworkResources, saveNetworkResource, deleteNetworkResource } from '../../api/resourceLibraryApi'
import { fetchNetworkClasses, fetchClassSubjects } from '../../api/academicsSetupApi'
/* Master / Sub Release bhi LIVE hain — dono ek hi endpoint par
   (POST /api/Network_Setup/manage-release, dekhein src/api/releaseApi.js).
   Master me network ke SAB schools ki branchID jati hai, Sub me sirf chuni
   hui; aur child2 me chaaron section ka bana hua content apni ASLI ids ke
   sath (dekhein src/api/releaseContent.js). */
import { fetchReleases, saveRelease, deleteRelease } from '../../api/releaseApi'
import { onAcademicContentChanged } from '../../api/contentEvents'
import { EMPTY_CONTENT, fetchReleaseContent, filterReleaseContent, hasReleasableContent, idSetsOf, releaseItemsOf, summarizeReleaseContent } from '../../api/releaseContent'
/* A4 branded PDF / Word shell — sab Academics reports isi se bante hain. */
import { esc, exportReport } from './reportEngine'
import './Academics.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ACT_STATUS = { upcoming: { label: 'Scheduled', color: '#1E40AF' }, ongoing: { label: 'Ongoing', color: '#D97706' }, completed: { label: 'Completed', color: '#16A34A' } }
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return iso } }
/* Sirf tareekh (YYYY-MM-DD) — MUQAMI waqt par, UTC par nahi.
   `toISOString()` pehle UTC me badalta hai; Pakistan UTC+5 par hai, is liye
   raat 12 se subah 5 baje tak wo PICHLA din deta tha aur Release Date ek din
   peeche dikhti thi. Timezone offset ghata kar wahi din milta hai jo user ke
   apne calendar par hai. (Yehi tareeqa activityCalendarApi me bhi hai.)
   Khali / ghalat value par khali string — fmtDate use "—" dikhata hai. */
const isoDay = (d) => {
  /* Pehle se sirf tareekh ho to jyon ki tyon — `new Date('2026-09-03')` UTC
     aadhi raat banti hai, aur us par muqami offset lagana din badal deta. */
  if (typeof d === 'string') {
    const s = d.trim()
    if (!s) return ''
    if (s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  }
  const t = d === undefined ? new Date() : (d ? new Date(d) : null)
  if (!t || Number.isNaN(t.getTime())) return ''
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const todayISO = () => isoDay()

const GROUPS = {
  scheme: { label: 'Activity Calendar', icon: 'fa-calendar-week', subs: [
    ['act-cal', 'Activity Calendar', 'fa-calendar-week'],
  ] },
  /* Ek hi screen — Lesson Plans aur Notebook Plans ke subtabs uske andar
     hain (bilkul ERP ke Create Lesson Plans jaise), is liye yahan ek sub. */
  lessons: { label: 'Lesson Plans', icon: 'fa-list-ul', subs: [
    ['create-lp', 'Create Lesson Plan', 'fa-list-ul'],
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
  const [detail, setDetail] = useState(null) // "Currently Live" ka View — release ki tafseel
  const relBarRef = useRef(null)             // "Create New Release" isi panel tak scroll karta hai
  const [toast, setToast] = useState(null)
  /* Jo kuch release ho sakta hai — chaaron section ka live content apni asli
     ids ke sath. Release ka payload aur modal ka summary dono isi par bante
     hain, is liye jo screen par dikhta hai wahi server par jata hai. */
  const [relContent, setRelContent] = useState(EMPTY_CONTENT)
  const [relBusy, setRelBusy] = useState(false)
  const [relSynced, setRelSynced] = useState(false)
  /* { [apiId]: content } — release ka APNA content, seedha release GET se.
     Tafseel isi par banti hai, Head Office ke mojooda index par nahi —
     dekhein releaseApi.js ki sharh. */
  const [relApiContent, setRelApiContent] = useState({})
  /* Content tabs (Activity Calendar / Lesson Plans / Resource Library) apni
     apni list KHUD API se laate hain aur apne andar rakhte hain. Release ke
     baad server par content badal jata hai, magar wo tabs ko khud pata nahi
     chalta — screen par purani activities pari rehti thin aur sahi haalat
     sirf page refresh par aati thi.

     Ye ginti unke wrapper ki `key` me lagti hai: release (ya revoke) ke baad
     barhti hai, tab dobara mount hota hai aur apna data khud taza le aata
     hai. Har chhoti tabdeeli par NAHI barhti — warna activity save karte hi
     tab remount ho kar khula hua modal/scroll ura deta. */
  const [contentEpoch, setContentEpoch] = useState(0)

  useEffect(() => { setA(loadAcademics()) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])

  /* Releasable content — modal khulte hi ginti sahi dikhni chahiye. Mount par
     ek dafa, aur uske baad har content change par (neeche wala effect). */
  const reloadRelContent = useCallback(() => (
    fetchReleaseContent().then(setRelContent).catch(() => setRelContent(EMPTY_CONTENT))
  ), [])
  useEffect(() => { reloadRelContent() }, [reloadRelContent])

  /* Content badalte hi index dobara laao — chaaron API (activities,
     class lesson masters, notebook masters, resources) ek saath.

     Pehle ye sirf mount par chalta tha: nayi activity add karne ke baad bhi
     Release Control purani (khali) ginti par khada rehta tha aur "Create
     Master Release" band hi dikhta tha — sahi haalat sirf page refresh par
     aati thi. Ab signal API layer se aata hai (contentEvents.js), is liye
     activity / lesson plan / notebook / resource — kisi bhi jagah se
     add/edit/delete ho, ginti aur button foran theek ho jate hain. */
  useEffect(() => onAcademicContentChanged(() => { reloadRelContent() }), [reloadRelContent])

  /* Server par mojood releases se local record milao — release kisi aur
     browser/session se bhi ho ya wapas liya gaya ho to ye screen sach bole:
       • server par hai, yahan nahi  → adopt kar lo (Currently Live me aa jaye)
       • yahan live hai, server par nahi → wapas liya ja chuka hai (ARCHIVED)
     Sirf kamyab fetch par chalta hai, warna network ki ek jhijhak poori
     release history archive kar deti. */
  useEffect(() => {
    if (!a || relSynced) return undefined
    let alive = true
    fetchReleases()
      .then((apiRels) => {
        if (!alive) return
        setRelSynced(true)
        /* Ye har baar bharta hai — chahe releases ki list na badle. */
        setRelApiContent(Object.fromEntries(apiRels.map((r) => [r.id, r.content])))
        const local = a.releases || []
        const liveIds = new Set(apiRels.map((r) => r.id))
        const known = new Set(local.map((r) => r.apiId).filter(Boolean))
        const kept = local.map((r) => (
          r.apiId && !liveIds.has(r.apiId) && r.releaseStatus !== 'ARCHIVED'
            ? { ...r, releaseStatus: 'ARCHIVED' }
            : r
        ))
        const adopted = apiRels.filter((r) => !known.has(r.id)).map(adoptApiRelease)
        if (adopted.length === 0 && kept.every((r, i) => r === local[i])) return
        const next = { ...a, releases: [...kept, ...adopted] }
        setA(next); saveAcademics(next)
      })
      .catch(() => { if (alive) setRelSynced(true) })
    return () => { alive = false }
  }, [a, relSynced])

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
  /* Release Control ki ginti bhi wahi content dikhaye jo release me jayega:
     Current Draft par poora live content, kisi purane release ke workspace par
     sirf usi ke ids. */
  const workspaceRelContent = filterReleaseContent(relContent, idSetsOf(viewedRelease))
  /* Activity Calendar, Lesson Plans, Notebook Plans aur Resource Library —
     chaaron khali hon to release banta hi nahi. Faisla wahi list dekhti hai jo
     server ko child2 ban kar jati hai, screen par dikhne wali ginti nahi. */
  const canReleaseWorkspace = hasReleasableContent(workspaceRelContent)

  /* "Create New Release" — Current Draft par le aata hai aur Release Control
     tak scroll kar deta hai, jahan se Master ya Sub chuna jata hai.

     Pehle ye `a.lessonPlans / notebookPlans / activityCalendar` khali kar ke
     "New blank release started" ka paighaam deta tha. Wo purane waqt ka amal
     tha jab content local store me banta tha. Ab teenon section LIVE hain
     (Activity Calendar aur Resource Library API se aate hain aur store me
     sirf mirror hote hain, Lesson Plans store ko chhoote hi nahi), is liye
     wo khali karna kuch badalta nahi tha — mirror agle hi render par dobara
     bhar jata tha — magar paighaam ye samajh deta tha ke koi khali release
     ban gayi hai. Ab na kuch mitta hai, na koi ghalat baat kahi jati hai. */
  const createNewRelease = () => {
    setView('current')
    fire('Current Draft selected — choose Master Release or Sub Release below', 'info')
    /* Release Control panel screen par le aao — warna click par kuch hota
       hua dikhta hi nahi. */
    requestAnimationFrame(() => relBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  /* Master = network ke SAB connected schools ki branchID; Sub = sirf chuni
     hui. `connectedSchools[].id` khud branchID hai (dekhein ViewProvider). */
  /* Summary yahan khud bani hai (taza content par), is liye modal ka teesra
     argument nahi liya jata. */
  const applyRelease = async (type, opts) => {
    const { validityDays, dueDate, creationDate, schools, parentReleaseId, content, pickFrom } = opts
    const isMaster = type === 'master'
    const releaseType = isMaster ? 'MASTER_RELEASE' : 'SUB_RELEASE'
    const number = releases.filter((r) => r.releaseType === releaseType).length + 1
    const seq = (a.releaseSeq || 0) + 1
    const nowISO = new Date().toISOString()
    /* Screen ka "Release Date" — server par `creationDate` ban kar jata hai
       aur wahin se har jagah "Released on" bharta hai. */
    const relOn = creationDate || isoDay(nowISO)
    const title = `${isMaster ? 'Master' : 'Sub'} Release ${number}`
    const allIds = connectedSchools.map((s) => s.id)
    const branchIds = isMaster ? allIds : schools

    /* ── Save se THEEK PEHLE taza content ──────────────────────────────
       Modal jo content le kar aaya wo us waqt ka hai jab modal khula tha.
       Beech me content badal sakta hai — nayi activity/lesson/notebook/
       resource ban jaye ya mit jaye — aur phir release ya to purani list le
       kar jata tha ya (agar index us waqt tak load hi na hua ho) KHALI chala
       jata tha.

       Is liye ab chaaron GET (activities, class lesson masters, notebook
       masters, resources) yahan dobara chalti hain aur release WAHI le kar
       jata hai jo abhi server par hai. Fetch fail ho jaye to modal wala
       content hi chal jata hai — release rukta nahi. */
    setRelBusy(true)
    let live = content
    try {
      const fresh = await fetchReleaseContent()
      setRelContent(fresh)
      live = filterReleaseContent(fresh, idSetsOf(pickFrom))
    } catch {
      /* Taza index na mile to modal wala content hi sahi. */
    }

    /* Khali release na banao — na server par, na yahan. Ab jaanch TAZA content
       par hai: schools ko kuch milta nahi aur "Currently Live" me ek khokhli
       tile pari reh jati thi. */
    const items = releaseItemsOf(live)
    if (items.length === 0) {
      setRelBusy(false)
      fire('Nothing to release — add activities, lesson plans, notebook plans or resource files first', 'warn')
      return
    }
    /* Ginti bhi usi content ki jo waqai ja raha hai — modal ka purana summary
       aur asli payload alag na ho jayen. */
    const summary = summarizeReleaseContent(live)

    /* Pehle server par — na chale to local record banta hi nahi, warna screen
       "released" dikhati aur schools ke paas kuch pohanchta hi nahi. */
    let apiId = 0
    try {
      apiId = await saveRelease({
        isMaster,
        dueDate: dueDate || addDaysISO(validityDays),
        creationDate: relOn,
        duration: validityDays,
        branchIds,
        items,
      })
    } catch (err) {
      setRelBusy(false)
      fire(err?.message || 'Could not publish the release', 'warn')
      return
    }
    setRelBusy(false)
    /* Local workspace ka jama kiya hua snapshot — ye sirf is screen ke
       "Releases & Drafts" ke liye hai; server ko jo gaya wo `content` hai. */
    const snapshot = {
      lessonPlans: JSON.parse(JSON.stringify(workspaceContent.a.lessonPlans || [])),
      notebookPlans: JSON.parse(JSON.stringify(workspaceContent.a.notebookPlans || [])),
      activityCalendar: JSON.parse(JSON.stringify(workspaceContent.a.activityCalendar || [])),
      resources: JSON.parse(JSON.stringify(workspaceContent.resources || [])),
    }
    const release = {
      id: `rel-${seq}-${Date.now()}`,
      apiId,                                   // server ka master id — revoke isi se
      releaseType, releaseTitle: title, label: title, releaseNumber: number, version: seq,
      batchId: `${isMaster ? 'MR' : 'SR'}-${new Date().getFullYear()}-${String(number).padStart(3, '0')}`,
      parentReleaseId: parentReleaseId || null, headOfficeId: 'HO-001',
      appliesToAllSchools: isMaster,
      selectedSchoolIds: branchIds,
      schoolCount: branchIds.length,
      releasedAt: relOn, createdAt: nowISO, updatedAt: nowISO, creationDate: relOn,
      /* "Valid until" wahi tareekh hai jo server ko dueDate ban kar gayi —
         warna tile par kuch aur dikhta aur schools ko kuch aur milta. */
      validityDays, validUntil: dueDate || addDaysISO(validityDays), dueDate: dueDate || null,
      releasedBy: 'Head Office', releaseStatus: 'ACTIVE',
      contentSummary: summary.totals, classWiseSummary: summary.classes,
      /* Jo ids WAQAI server ko gayi hain (child2), na ke local snapshot ki. */
      activityIds: live.activities.map((x) => x.id),
      lessonPlanIds: live.lessons.map((x) => x.id),
      notebookPlanIds: live.notebooks.map((x) => x.id),
      resourceLibraryIds: live.resources.map((x) => x.id),
      snapshot,
    }
    commit({ ...a, released: true, releasedAt: relOn, releaseSeq: seq, release, releases: [...releases, release] })
    setModalType(null)
    /* Modal band hone ke baad sab kuch dobara server se — chaaron content GET
       aur releases ki list. Is se screen bina page refresh ke taza rehti hai:
       Release Control ki ginti, "Currently Live" ki tiles aur release ka View
       sab asli data par aa jate hain. */
    reloadRelContent()
    setRelSynced(false)
    /* Content tabs bhi dobara — dekhein contentEpoch ki sharh. */
    setContentEpoch((n) => n + 1)
    fire(`${title} published · ${release.batchId}`, 'success')
  }

  /* Revoke = server par se poora release (master + dono child set) hat jana.
     Ek dafa ka seed record (jiska apiId nahi) sirf yahin archive hota hai. */
  const doRevoke = async () => {
    const id = revoke.id
    if (revoke.apiId) {
      setRelBusy(true)
      try {
        await deleteRelease(revoke.apiId, {
          isMaster: revoke.releaseType !== 'SUB_RELEASE',
          dueDate: revoke.dueDate || revoke.validUntil,
          /* Server delete par bhi CreationDate maangta hai — jo release ke
             sath aayi thi wahi wapas jati hai. */
          creationDate: revoke.creationDate || revoke.releasedAt,
          duration: revoke.validityDays,
        })
      } catch (err) {
        setRelBusy(false)
        fire(err?.message || 'Could not revoke the release', 'warn')
        return
      }
      setRelBusy(false)
    }
    commit({ ...a, releases: releases.map((r) => (r.id === id ? { ...r, releaseStatus: 'ARCHIVED', updatedAt: new Date().toISOString() } : r)) })
    setView(id) // bring it into the editable workspace
    reloadRelContent()
    setRelSynced(false)
    setContentEpoch((n) => n + 1)
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
      <LiveReleasesCard releases={releases} canRelease={canReleaseWorkspace} onView={setDetail} onCreate={setModalType} onRevoke={setRevoke} />

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
      <div ref={relBarRef}>
        <ReleaseBar workspaceName={workspaceName} content={workspaceRelContent} isCurrent={view === 'current'} isLiveView={isLiveView} onCreate={setModalType} />
      </div>

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

      <div key={`${view}-${contentEpoch}`} className={isLiveView ? 'ac-readonly' : undefined}>
        {sub === 'act-cal' && <ActivityCalendar a={aView} commit={commitView} fire={fire} live={!viewedRelease} />}
        {/* LIVE — apna data khud API se lati hai (networkID par), is liye
            release-snapshot wale aView/commitView isay nahi milte. */}
        {sub === 'create-lp' && <CreateLessonPlans toast={fire} />}
        {sub === 'resources' && <OtherResources a={aView} fire={fire} resources={resourcesView} onResources={onResourcesView} />}
        {/* legacy screens (kept for data; no tabs render these now) */}
        {sub === 'textbooks' && <Textbooks a={aView} commit={commitView} fire={fire} />}
        {sub === 'terms' && <TermSettings a={aView} commit={commitView} fire={fire} />}
        {sub === 'session' && <SessionSettings a={aView} commit={commitView} fire={fire} />}
        {sub === 'acad-cal' && <AcademicCalendar a={aView} commit={commitView} fire={fire} />}
        {sub === 'breakup' && <TermBreakups a={aView} commit={commitView} fire={fire} />}
      </div>

      {modalType && <ReleaseModal type={modalType} releases={releases} relContent={relContent} baseRelease={viewedRelease} baseLabel={workspaceName} busy={relBusy} onClose={() => setModalType(null)} onRelease={applyRelease} />}

      {detail && <ReleaseDetailsModal release={detail} relContent={relContent} apiContent={detail.apiId ? relApiContent[detail.apiId] : null} schools={connectedSchools} onClose={() => setDetail(null)} onRevoke={(r) => { setDetail(null); setRevoke(r) }} />}

      {revoke && createPortal(
        <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setRevoke(null) }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '36px 30px' }}>
              <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-ban" /></div>
              <div className="confirm-title">Revoke {revoke.label}?</div>
              <div className="confirm-sub">This release will be taken down immediately. {revoke.appliesToAllSchools ? 'All member schools' : `The ${revoke.schoolCount} selected school${revoke.schoolCount !== 1 ? 's' : ''}`} will no longer be able to pull this content. It stays in your release history and can be re-released later.</div>
              <div className="confirm-btns"><button className="btn-secondary" onClick={() => setRevoke(null)} disabled={relBusy}>Cancel</button><button className="btn-danger" onClick={doRevoke} disabled={relBusy}><i className={`fa-solid ${relBusy ? 'fa-spinner fa-spin' : 'fa-ban'}`} /> {relBusy ? 'Revoking…' : 'Revoke Release'}</button></div>
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
const addDaysISO = (days) => addDaysToISO(todayISO(), days)
/* Kisi tareekh me din jorna — Release Date + Validity Days = Due Date. */
const addDaysToISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + Number(days))
  return isoDay(d)
}
/* Do tareekhon ke darmiyan din — Due Date se Validity Days banane ke liye
   (Release Date, Validity Days aur Due Date teenon jure hue hain, dekhein
   ReleaseModal). */
const daysBetweenISO = (from, to) => {
  if (!from || !to) return NaN
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN
  return Math.round((b - a) / 86400000)
}
function releaseState(a) {
  if (!a.released) return 'CLOSED'
  const vu = a.release?.validUntil
  if (vu && new Date() > new Date(`${vu}T23:59:59`)) return 'EXPIRED'
  return 'OPEN'
}

/* Server ka release row → wahi shape jo ye screen padhti hai.
   Server sirf dueDate + duration rakhta hai (releasedAt ka column nahi), is
   liye "valid until" ke liye dueDate hi chalti hai. Content ka snapshot bhi
   server par nahi hota — us release ki ginti Child2Raw se banti hai. */
const idsOfType = (r, key) => r.items.filter((x) => x.typeKey === key).map((x) => x.typeID)
function adoptApiRelease(r) {
  const type = r.isMaster ? 'MASTER_RELEASE' : 'SUB_RELEASE'
  const title = `${r.isMaster ? 'Master' : 'Sub'} Release ${r.id}`
  return {
    id: `api-${r.id}`,
    apiId: r.id,
    releaseType: type, releaseTitle: title, label: title, releaseNumber: r.id, version: r.id,
    batchId: `${r.isMaster ? 'MR' : 'SR'}-${r.id}`,
    parentReleaseId: null, headOfficeId: 'HO-001',
    appliesToAllSchools: r.isMaster,
    selectedSchoolIds: r.branchIds,
    schoolCount: r.branchIds.length,
    /* Ab server CreationDate rakhta hai — "Released on" wahin se aata hai
       (pehle yahan null tha aur har tile par "—" dikhta tha). */
    releasedAt: isoDay(r.creationDate), createdAt: r.creationDate || null, updatedAt: null,
    creationDate: r.creationDate || null,
    validityDays: Number(r.duration) || 0, validUntil: r.dueDate, dueDate: r.dueDate,
    releasedBy: 'Head Office', releaseStatus: 'ACTIVE',
    contentSummary: {
      classes: 0,
      lessons: r.counts.lessons,
      notebooks: r.counts.notebooks,
      resourceFiles: r.counts.resources,
      activities: r.counts.activities,
    },
    classWiseSummary: [],
    /* `typeKey` releaseApi banata hai — nayi aur purani dono spelling usi
       ek kunji par aati hain, is liye yahan koi string nahi likhi jati. */
    activityIds: idsOfType(r, 'activity'),
    lessonPlanIds: idsOfType(r, 'lesson'),
    notebookPlanIds: idsOfType(r, 'notebook'),
    resourceLibraryIds: idsOfType(r, 'resource'),
    snapshot: { lessonPlans: [], notebookPlans: [], activityCalendar: [], resources: [] },
  }
}

/* Live status of a release (auto-expires past validUntil). */
function releaseStatusOf(r) {
  if (r?.releaseStatus === 'ARCHIVED') return 'ARCHIVED'
  if (r?.validUntil && new Date() > new Date(`${r.validUntil}T23:59:59`)) return 'EXPIRED'
  return 'ACTIVE'
}

/* ── Release Control panel — contextual to the selected workspace ── */
function ReleaseBar({ workspaceName, content, isCurrent, isLiveView, onCreate }) {
  const summary = useMemo(() => summarizeReleaseContent(content), [content])
  const t = summary.totals
  /* Summary sirf class-wale rows ginti hai; release wahi jata hai jo
     releaseItemsOf banata hai. Button ka faisla usi par ho, warna dono me
     farq aane par khali release ban sakta hai. */
  const empty = !hasReleasableContent(content)
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
        <div className="live-row"><span>Released on</span><strong>{fmtDate(isoDay(r.releasedAt))}</strong></div>
        <div className="live-row"><span>Valid until</span><strong>{r.validUntil ? fmtDate(r.validUntil) : '—'}</strong></div>
      </div>
      <div className="live-actions">
        <button className="btn-sm res-keep live-view" onClick={() => onView(r)}><i className="fa-solid fa-eye" /> View</button>
        <button className="btn-sm live-revoke res-keep" onClick={() => onRevoke(r)}><i className="fa-solid fa-ban" /> Revoke</button>
      </div>
    </div>
  )
}

function LiveReleasesCard({ releases, canRelease, onView, onCreate, onRevoke }) {
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
            <div className="live-empty-sub">{canRelease
              ? 'Create a Master Release or Sub Release to make academic content available to member schools.'
              : 'There is nothing to release yet — add activities, lesson plans, notebook plans or resource files first.'}</div>
            <div className="live-empty-btns">
              <button className="btn-primary" disabled={!canRelease} onClick={() => onCreate('master')}><i className="fa-solid fa-globe" /> Create Master Release</button>
              <button className="btn-secondary" disabled={!canRelease} onClick={() => onCreate('sub')}><i className="fa-solid fa-code-branch" /> Create Sub Release</button>
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
function ReleaseModal({ type, releases, relContent, baseRelease, baseLabel, busy, onClose, onRelease }) {
  const isSub = type === 'sub'
  const [source, setSource] = useState('base') // sub: 'base' (selected workspace) | release id
  const sourceRelease = isSub && source !== 'base' ? releases.find((r) => r.id === source) : null
  /* Jo content release hoga: Current Draft par poora live index, kisi purane
     release par sirf usi ki ids. Summary aur child2 dono isi se bante hain. */
  const content = useMemo(
    () => filterReleaseContent(relContent, idSetsOf(sourceRelease || baseRelease)),
    [relContent, sourceRelease, baseRelease],
  )
  const summary = useMemo(() => summarizeReleaseContent(content), [content])
  const t = summary.totals
  /* Chaaron section khali = release ka koi matlab nahi. Ginti ke bajaye wahi
     list dekhi jati hai jo child2 ban kar server tak jati hai. */
  const noContent = useMemo(() => !hasReleasableContent(content), [content])

  /* Schools ab API se aate hain (ViewProvider), is liye list async bharti hai —
     master release ka "sab select" schools aane par set hota hai. */
  const { schools: connectedSchools } = useView()
  const [releaseDate, setReleaseDate] = useState(todayISO)
  const [days, setDays] = useState('30')
  const [dueDate, setDueDate] = useState(() => addDaysISO(30))
  const [schoolSel, setSchoolSel] = useState(() => new Set())
  useEffect(() => {
    if (!isSub) setSchoolSel(new Set(connectedSchools.map((s) => s.id)))
  }, [isSub, connectedSchools])
  const [schoolQ, setSchoolQ] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [open, setOpen] = useState({})

  /* Release Date, Validity Days aur Due Date ek hi cheez ke teen rukh hain —
     ek badle to baqi bhi. Pehle Release Date sirf `todayISO()` ka likha hua
     text tha aur Due Date alag chalti thi, is liye "Valid Until" hilta hi
     nahi tha. Ab Release Date bhi calendar se chunti hai aur server ko
     `creationDate` ban kar jati hai — "Released on" wahin se aata hai. */
  const setReleaseAndDue = (v) => {
    setReleaseDate(v)
    const n = Number(days)
    if (v && Number.isFinite(n) && n >= 1 && n <= 365) setDueDate(addDaysToISO(v, n))
  }
  const setDaysAndDue = (v) => {
    setDays(v)
    const n = Number(v)
    if (v !== '' && Number.isFinite(n) && n >= 1 && n <= 365) setDueDate(addDaysToISO(releaseDate, n))
  }
  const setDueAndDays = (v) => {
    setDueDate(v)
    const n = daysBetweenISO(releaseDate, v)
    if (Number.isFinite(n) && n >= 1) setDays(String(n))
  }

  const today = todayISO()
  const dn = Number(days)
  const dueDays = daysBetweenISO(releaseDate, dueDate)
  const relLag = daysBetweenISO(today, releaseDate)   // release date guzri hui na ho
  const validDays = days !== '' && Number.isFinite(dn) && dn >= 1 && dn <= 365
    && Number.isFinite(dueDays) && dueDays >= 1
    && Number.isFinite(relLag) && relLag >= 0
  const err = !releaseDate ? 'Release date is required.'
    : (!Number.isFinite(relLag) || relLag < 0) ? 'Release date cannot be in the past.'
      : days === '' ? 'Validity days is required.'
        : (!Number.isFinite(dn) || dn < 1) ? 'Enter a positive number of days.'
          : dn > 365 ? 'Maximum recommended is 365 days.'
            : !dueDate ? 'Due date is required.'
              : (!Number.isFinite(dueDays) || dueDays < 1) ? 'Due date must be after the release date.' : ''
  /* Jo tareekhein server ko jati hain wahi yahan dikhti hain — do alag hisaab nahi. */
  const validUntil = validDays ? dueDate : null
  const shortValidity = validDays && dn < 7

  const schoolList = connectedSchools.filter((s) => { const q = schoolQ.trim().toLowerCase(); return !q || s.name.toLowerCase().includes(q) || (s.phone || '').includes(q) })
  const allSchools = connectedSchools.length > 0 && schoolSel.size === connectedSchools.length
  const toggleSchool = (id) => setSchoolSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAllSchools = () => setSchoolSel(allSchools ? new Set() : new Set(connectedSchools.map((s) => s.id)))
  /* Master bhi tab hi ja sakta hai jab chain me koi school ho — child1 khali
     bhejne ka matlab hai release kisi tak pohanchega hi nahi. */
  const canRelease = validDays && confirm && !noContent && (isSub ? schoolSel.size > 0 : connectedSchools.length > 0)
  const nextNo = releases.filter((r) => r.releaseType === (isSub ? 'SUB_RELEASE' : 'MASTER_RELEASE')).length + 1
  const nextBatch = `${isSub ? 'SR' : 'MR'}-${new Date().getFullYear()}-${String(nextNo).padStart(3, '0')}`

  const subjRows = (map) => Object.entries(map).filter(([, n]) => n > 0).map(([sid, n]) => <div className="rel-row" key={sid}><span>{summary.subjectName(sid)}</span><span className="rel-row-n">{n}</span></div>)
  const card = (icon, val, lbl, accent) => <div className={`rel-sum ${accent || ''}`}><div className="rel-sum-ic"><i className={`fa-solid ${icon}`} /></div><div><div className="rel-sum-val">{val}</div><div className="rel-sum-lbl">{lbl}</div></div></div>
  /* `pickFrom` = wo release jis ki ids par content chhana gaya (Current Draft
     par null). applyRelease save se pehle index dobara laata hai aur usi chhaant
     ko dohrata hai — dekhein wahan ki sharh. */
  const submit = () => onRelease(type, { validityDays: dn, dueDate, creationDate: releaseDate, schools: [...schoolSel], parentReleaseId: sourceRelease?.id || null, content, pickFrom: sourceRelease || baseRelease || null }, summary)

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
              <div><div className="rel-type-k">Audience</div><div className="rel-type-v">{isSub ? `Selected Schools Only (${schoolSel.size})` : `All Member Schools (${connectedSchools.length})`}</div></div>
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
                <div className="ac-field" style={{ maxWidth: 180 }}><label>Release Date *</label><input className="ac-input" type="date" min={today} value={releaseDate} onChange={(e) => setReleaseAndDue(e.target.value)} /></div>
                <div className="ac-field" style={{ maxWidth: 160 }}><label>Validity Days *</label><input className="ac-input" type="number" min="1" max="365" value={days} onChange={(e) => setDaysAndDue(e.target.value)} placeholder="e.g. 30" /></div>
                <div className="ac-field" style={{ maxWidth: 180 }}><label>Due Date</label><input className="ac-input" type="date" min={addDaysToISO(releaseDate, 1)} value={dueDate} onChange={(e) => setDueAndDays(e.target.value)} /></div>
                <div className="rel-dates">
                  <div className="rel-date"><div className="rel-date-lbl">Release Date</div><div className="rel-date-val">{fmtDate(releaseDate)}</div></div>
                  <i className="fa-solid fa-arrow-right-long rel-date-arrow" />
                  <div className="rel-date"><div className="rel-date-lbl">Valid Until</div><div className="rel-date-val">{validUntil ? fmtDate(validUntil) : '—'}</div></div>
                </div>
              </div>
              <div className="rel-help">Schools can pull this content for the selected number of days. The due date is the recommended deadline shown to schools.</div>
              {err && <div className="rel-err"><i className="fa-solid fa-circle-exclamation" /> {err}</div>}

              {/* Schools — DONO releases me chain ki poori branch list dikhti hai.
                  Sub par har branch chuni ja sakti hai; Master har branch ko
                  jata hai, is liye wahan sab pehle se lagi hui aur band hain
                  (chhaant ka koi matlab hi nahi) — magar list phir bhi saamne
                  rehti hai taake pata ho release kahan kahan ja raha hai. */}
              <div className="rel-sec-h">
                <i className="fa-solid fa-school" /> {isSub ? 'Selected Schools' : 'Member Schools'}
                <span className="rel-sec-count">{isSub ? `${schoolSel.size} of ${connectedSchools.length} selected` : `all ${connectedSchools.length} included`}</span>
              </div>
              <div className="rel-school-tools">
                {isSub
                  ? <label className="rel-selall"><input type="checkbox" checked={allSchools} onChange={toggleAllSchools} /> <span>Select all schools</span></label>
                  : <span className="rel-help" style={{ margin: 0 }}><i className="fa-solid fa-circle-info" /> A Master Release goes to every school in the chain — the list cannot be narrowed here. Use a Sub Release to pick schools.</span>}
                <div className="res-search" style={{ maxWidth: 240 }}><i className="fa-solid fa-magnifying-glass" /><input value={schoolQ} onChange={(e) => setSchoolQ(e.target.value)} placeholder="Search school…" /></div>
              </div>
              <div className="rel-schools">
                {schoolList.map((s) => (
                  <label key={s.id} className={`rel-school${schoolSel.has(s.id) ? ' on' : ''}${isSub ? '' : ' locked'}`}>
                    <input type="checkbox" checked={schoolSel.has(s.id)} disabled={!isSub} onChange={() => toggleSchool(s.id)} />
                    <span className="rel-school-name">{s.name}</span>
                    <span className="rel-school-city"><i className="fa-solid fa-phone" /> {s.phone || '—'}</span>
                  </label>
                ))}
                {schoolList.length === 0 && (
                  <div className="rel-empty-note">
                    {connectedSchools.length === 0 ? 'No schools have joined this chain yet.' : `No schools match “${schoolQ}”.`}
                  </div>
                )}
              </div>
              {isSub && schoolSel.size === 0 && <div className="rel-err"><i className="fa-solid fa-circle-exclamation" /> Select at least one school for this sub release.</div>}
              {!isSub && connectedSchools.length === 0 && <div className="rel-err"><i className="fa-solid fa-circle-exclamation" /> No connected schools — this master release would not reach anyone.</div>}

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
            <span className="rel-foot-hint"><i className="fa-solid fa-circle-info" /> {!validDays ? 'Enter valid validity days (1–365)' : (isSub && schoolSel.size === 0) ? 'Select at least one school' : (!isSub && connectedSchools.length === 0) ? 'Connect at least one school to this chain' : 'Tick the confirmation checkbox'} to enable release</span>
          )}
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-success" disabled={!canRelease || busy} onClick={submit}>
            {busy ? <><i className="fa-solid fa-spinner fa-spin" /> Releasing…</> : <><i className="fa-solid fa-cloud-arrow-up" /> {isSub ? 'Release to Selected Schools' : 'Release to All Schools'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Release ki tafseel — "Currently Live for Schools" ka View ──
   Pehle View poore page ko read-only snapshot workspace me daal deta tha.
   Snapshot local store se banta hai jabke asal content API se live aata hai,
   is liye wahan kuch dikhta hi nahi tha aur sab kuch greyed-out ho jata tha.
   Ab View us release ki tafseel kholta hai: jo ids WAQAI release hui thin,
   unhi ko live content index me se chhaant kar dikhaya jata hai. */
function ReleaseDetailsModal({ release, relContent, apiContent, schools, onClose, onRevoke }) {
  const [open, setOpen] = useState({})
  const isSub = release.releaseType === 'SUB_RELEASE'
  const status = releaseStatusOf(release)

  /* Pehli tarjeeh SERVER ke apne content ko: release GET har release ke saath
     uski Activity / LessonPlanMaster / NoteBookPlansMaster / ResourceFile rows
     bhejta hai. Class aur subject ke NAAM us me nahi hote — wo LaunchSetup se
     aate hain, is liye sirf wo do listein index se li jati hain.

     Pehle yahan sirf neeche wali chhaant thi: release ki ids Head Office ke
     MOJOODA index me dhoondi jati thin. Jo cheez us index me na mile wo
     tafseel me sifar ban jati thi — "0 Activities" aur saath me "released
     items are no longer available", halanke server par rows maujood thin.
     Ab wo soorat sirf tab aati hai jab server ka content mila hi na ho. */
  const fromApi = !!apiContent
  const content = useMemo(() => (
    apiContent
      ? { ...apiContent, classes: relContent.classes || [], subjects: relContent.subjects || [] }
      : filterReleaseContent(relContent, idSetsOf(release))
  ), [apiContent, relContent, release])
  const summary = useMemo(() => summarizeReleaseContent(content), [content])
  const t = summary.totals

  /* Server ka content mil jaye to "kam" kuch nahi — wahi asal record hai.
     Warna (fallback) jo release me tha aur jo abhi index me hai, dono ki
     ginti alag ho sakti hai. */
  const sent = release.contentSummary || {}
  const missing = fromApi ? 0 : Math.max(0, (Number(sent.activities) || 0) + (Number(sent.lessons) || 0)
    + (Number(sent.notebooks) || 0) + (Number(sent.resourceFiles) || 0)
    - (t.activities + t.lessons + t.notebooks + t.resourceFiles))

  const nameOf = (id) => schools.find((s) => s.id === id)?.name || `Branch #${id}`
  const sentTo = (release.selectedSchoolIds || []).map(nameOf)

  const subjRows = (map) => Object.entries(map).filter(([, n]) => n > 0)
    .map(([sid, n]) => <div className="rel-row" key={sid}><span>{summary.subjectName(sid)}</span><span className="rel-row-n">{n}</span></div>)
  const card = (icon, val, lbl, accent) => <div className={`rel-sum ${accent || ''}`}><div className="rel-sum-ic"><i className={`fa-solid ${icon}`} /></div><div><div className="rel-sum-val">{val}</div><div className="rel-sum-lbl">{lbl}</div></div></div>

  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal rel-modal">
        <div className="pay-modal-hdr" style={{ background: isSub ? 'linear-gradient(135deg,#6D28D9,#7C3AED)' : 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
          <div className="pay-modal-av" style={{ background: 'rgba(255,255,255,.15)' }}><i className={`fa-solid ${isSub ? 'fa-code-branch' : 'fa-globe'}`} /></div>
          <div>
            <div className="pay-modal-title" style={{ color: '#fff' }}>{release.label}</div>
            <div className="pay-modal-sub" style={{ color: 'rgba(255,255,255,.85)' }}>{release.batchId} · {isSub ? 'Sub Release' : 'Master Release'} · currently live for schools</div>
          </div>
          <button className="pay-modal-x" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="pay-modal-body">
          <div className={`rel-type ${isSub ? 'sub' : 'master'}`}>
            <div className="rel-type-row">
              <div><div className="rel-type-k">Release Type</div><div className="rel-type-v">{isSub ? 'Sub Release' : 'Master Release'}</div></div>
              <div><div className="rel-type-k">Audience</div><div className="rel-type-v">{release.appliesToAllSchools ? `All Member Schools (${release.schoolCount})` : `Selected Schools Only (${release.schoolCount})`}</div></div>
              <div><div className="rel-type-k">Status</div><div className="rel-type-v">{status === 'ACTIVE' ? 'Live' : status === 'EXPIRED' ? 'Expired' : 'Revoked'}</div></div>
            </div>
          </div>

          <div className="rel-sec-h"><i className="fa-solid fa-hourglass-half" /> Release Validity</div>
          <div className="rel-validity">
            <div className="rel-dates">
              <div className="rel-date"><div className="rel-date-lbl">Released on</div><div className="rel-date-val">{fmtDate(isoDay(release.releasedAt))}</div></div>
              <i className="fa-solid fa-arrow-right-long rel-date-arrow" />
              <div className="rel-date"><div className="rel-date-lbl">Valid until</div><div className="rel-date-val">{release.validUntil ? fmtDate(release.validUntil) : '—'}</div></div>
            </div>
          </div>
          <div className="rel-help">Validity {release.validityDays ? `${release.validityDays} day${Number(release.validityDays) !== 1 ? 's' : ''}` : '—'}. Schools can pull this content until the due date shown above.</div>

          <div className="rel-sec-h"><i className="fa-solid fa-chart-simple" /> Released Content</div>
          <div className="rel-sum-grid">
            {card('fa-calendar-week', t.activities, 'Activities', 'r-blue')}
            {card('fa-list-ul', t.lessons, 'Lesson Plans', 'r-teal')}
            {card('fa-book-open', t.notebooks, 'Notebook Plans', 'r-purple')}
            {card('fa-folder-open', t.resourceFiles, 'Resource Files', 'r-amber')}
            {card('fa-chalkboard', t.classes, 'Classes', 'r-blue')}
            {card('fa-school', release.schoolCount, 'Schools', 'r-green')}
          </div>
          {missing > 0 && (
            <div className="rel-alert warn"><i className="fa-solid fa-triangle-exclamation" /><span>{missing} released item{missing !== 1 ? 's are' : ' is'} no longer available in the Head Office workspace — schools that already pulled it are unaffected.</span></div>
          )}

          <div className="rel-sec-h">
            <i className="fa-solid fa-school" /> Released To
            <span className="rel-sec-count">{release.schoolCount} school{release.schoolCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="rel-schools">
            {sentTo.map((n, i) => (
              <div key={`${n}-${i}`} className="rel-school on locked">
                <i className="fa-solid fa-school" style={{ fontSize: 11, color: 'var(--tm)', flexShrink: 0 }} />
                <span className="rel-school-name">{n}</span>
              </div>
            ))}
            {sentTo.length === 0 && <div className="rel-empty-note">This release did not reach any school.</div>}
          </div>

          <div className="rel-sec-h"><i className="fa-solid fa-layer-group" /> Class-wise Content</div>
          {summary.classes.length === 0 ? <div className="rel-empty-note">No class-specific content in this release.</div>
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

          <div className="rel-sec-h"><i className="fa-solid fa-calendar-week" /> Activity Calendar</div>
          {content.activities.length === 0 ? <div className="rel-empty-note">No activities in this release.</div> : (
            <div className="rel-cls-body">
              {content.activities.map((x) => (
                <div className="rel-row" key={x.id}>
                  <span>{x.name}</span>
                  <span className="rel-row-n">{x.start === x.end ? fmtDate(x.start) : `${fmtDate(x.start)} → ${fmtDate(x.end)}`}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rel-sec-h"><i className="fa-solid fa-folder-open" /> Resource Files</div>
          {content.resources.length === 0 ? <div className="rel-empty-note">No resource files in this release.</div> : (
            <div className="rel-cls-body">
              {content.resources.map((x) => (
                <div className="rel-row" key={x.id}>
                  <span>{x.title || 'Untitled resource'}</span>
                  <span className="rel-row-n">{RES_CATEGORIES.find((c) => c.key === x.category)?.label || x.category || 'Other'}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rel-alert info"><i className="fa-solid fa-circle-info" /><span>A live release is read-only. Revoke it to move it back into Releases &amp; Drafts, edit the content, and release it again.</span></div>
        </div>

        <div className="pay-modal-foot">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {status === 'ACTIVE' && <button className="btn-danger" onClick={() => onRevoke(release)}><i className="fa-solid fa-ban" /> Revoke Release</button>}
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
    /* Har vacation ki apni window bhi jaanchi jaye — warna ulti (end < start)
       ya session se bahar wali chhutti chupke se save ho jati thi, aur working
       days ka hisaab (sessionStats) ghalat nikalta tha. */
    const named = vacs.filter((x) => x.name.trim())
    for (const vac of named) {
      const label = vac.name.trim()
      if (!vac.start || !vac.end) return onToast(`“${label}” — pick both start and end date`, 'warn')
      if (vac.end < vac.start) return onToast(`“${label}” — vacation end must be on or after start`, 'warn')
      if (v.start && v.end && (vac.start < v.start || vac.end > v.end)) {
        return onToast(`“${label}” — vacation dates must fall within the session period`, 'warn')
      }
    }
    onSave({ ...s, start: v.start, end: v.end, wpw: Number(v.wpw) || 5, vacations: named, perWeek })
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
                  <div className="ss-field"><label className="ss-field-label">Vacation Start</label><input className="ss-input" type="date" value={vac.start} min={v.start || undefined} max={vac.end || v.end || undefined} onChange={(e) => setVac(i, 'start', e.target.value)} /></div>
                  <div className="ss-field" style={{ marginBottom: 6 }}><label className="ss-field-label">Vacation End</label><input className="ss-input" type="date" value={vac.end} min={vac.start || v.start || undefined} max={v.end || undefined} onChange={(e) => setVac(i, 'end', e.target.value)} /></div>
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

/* ── Activity Calendar ──
   Ab localStorage par nahi: chain ki activities ERP ke Activity Calendar API
   par LIVE hain — sab networkID ki base par, har call me branchID aur
   sessionYearID 0 (dekhein src/api/activityCalendarApi.js).

   `live` sirf mojooda draft ke liye true hai. Koi purana release dekhte waqt
   uska snapshot dikhta hai — wo tareekhi record hai, us par API ko haath
   nahi lagaya jata aur purana localStorage rasta hi chalta hai. */
function ActivityCalendar({ a, commit, fire, live = true }) {
  const networkId = live ? currentNetworkId() : 0
  const now = new Date()
  const [calY, setCalY] = useState(now.getFullYear())
  const [calM, setCalM] = useState(now.getMonth())
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [del, setDel] = useState(null)

  const [rows, setRows] = useState([])            // server ki poori list (live mode)
  const [monthRows, setMonthRows] = useState([])  // sirf khule hue mahine ka call
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)             // save/delete ke baad month call dobara

  const acts = live ? rows : (a.activityCalendar || [])

  const reload = useCallback(async () => {
    const list = await fetchNetworkActivities(networkId)
    setRows(list)
    return list
  }, [networkId])

  useEffect(() => {
    if (!live) { setLoading(false); setError(''); return undefined }
    if (!networkId) {
      setLoading(false)
      setError('No network session found — sign in again from the ERP.')
      return undefined
    }
    let alive = true
    setLoading(true)
    setError('')
    reload()
      .catch((err) => { if (alive) setError(err?.message || 'Could not load activities') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [live, networkId, reload])

  /* Grid ke liye us mahine ka apna call — ERP bhi yahi karta hai. Na chale to
     grid poori list se hi ban jata hai, is liye khamoshi se nazarandaz. */
  useEffect(() => {
    if (!live || !networkId) { setMonthRows([]); return undefined }
    let alive = true
    fetchNetworkActivitiesByMonth(calM + 1, calY, networkId)
      .then((list) => { if (alive) setMonthRows(list) })
      .catch(() => { if (alive) setMonthRows([]) })
    return () => { alive = false }
  }, [live, networkId, calY, calM, tick])

  /* Release ka snapshot parent ke `a` se banta hai, is liye server ki list
     wahan mirror karna zaroori hai — warna release khali chala jata. Barabari
     ka check loop rok deta hai: commit ke baad dono aik hi array hote hain. */
  useEffect(() => {
    if (!live || loading || error) return
    if (JSON.stringify(a.activityCalendar || []) === JSON.stringify(rows)) return
    commit({ ...a, activityCalendar: rows })
  }, [live, loading, error, rows, a, commit])

  const stats = useMemo(() => {
    const ym = `${calY}-${String(calM + 1).padStart(2, '0')}`
    return { total: acts.length, upcoming: acts.filter((x) => x.status === 'upcoming').length, month: acts.filter((x) => (x.start || '').startsWith(ym)).length, completed: acts.filter((x) => x.status === 'completed').length }
  }, [acts, calY, calM])

  /* Poori list + month API — jo rows sirf month call me aayen wo bhi grid me
     nazar aayen. Stats aur side-list sirf poori list par rehti hain. */
  const gridActs = useMemo(() => {
    if (!live) return acts
    const seen = new Set(acts.map((x) => x.id))
    return [...acts, ...monthRows.filter((x) => !seen.has(x.id))]
  }, [live, acts, monthRows])

  const save = async (data, id) => {
    if (!live) {
      if (id) commit({ ...a, activityCalendar: acts.map((x) => (x.id === id ? { ...x, ...data } : x)) })
      else commit({ ...a, nextId: a.nextId + 1, activityCalendar: [...acts, { id: a.nextId, ...data }] })
      setModal(null); fire(id ? 'Activity updated' : 'Activity added')
      return
    }
    setBusy(true)
    try {
      await saveNetworkActivity({ ...data, id: id || 0 }, networkId)
      await reload()
      setTick((t) => t + 1)
      setModal(null)
      fire(id ? 'Activity updated' : 'Activity added')
    } catch (err) {
      fire(err?.message || 'Could not save activity', 'warn')
    } finally {
      setBusy(false)
    }
  }

  const doDel = async () => {
    if (!live) { commit({ ...a, activityCalendar: acts.filter((x) => x.id !== del.id) }); setDel(null); fire('Activity removed', 'info'); return }
    setBusy(true)
    try {
      await deleteNetworkActivity(del, networkId)
      await reload()
      setTick((t) => t + 1)
      setDel(null)
      fire('Activity removed', 'info')
    } catch (err) {
      fire(err?.message || 'Could not remove activity', 'warn')
    } finally {
      setBusy(false)
    }
  }

  const prev = () => { if (calM === 0) { setCalM(11); setCalY((y) => y - 1) } else setCalM((m) => m - 1) }
  const next = () => { if (calM === 11) { setCalM(0); setCalY((y) => y + 1) } else setCalM((m) => m + 1) }
  const firstDow = new Date(calY, calM, 1).getDay()
  const dim = new Date(calY, calM + 1, 0).getDate()
  const ym = `${calY}-${String(calM + 1).padStart(2, '0')}`
  const actsOnDay = (day) => gridActs.filter((x) => { const ds = `${ym}-${String(day).padStart(2, '0')}`; return ds >= x.start && ds <= x.end })

  /* Search + status filter (ERP ke Activity Calendar panel jaisa) — status ka
     ek hi "cycle" button hai, chaar alag pills nahi. */
  const q = search.trim().toLowerCase()
  const visible = acts
    .filter((x) => filter === 'all' || x.status === filter)
    .filter((x) => !q || `${x.name} ${x.purpose || ''}`.toLowerCase().includes(q))
    .slice()
    .sort((x, y) => (x.start < y.start ? -1 : 1))

  const cycleFilter = () => {
    const order = ['all', 'upcoming', 'ongoing', 'completed']
    setFilter(order[(order.indexOf(filter) + 1) % order.length])
  }
  const filterLabel = filter === 'all' ? 'All' : (ACT_STATUS[filter]?.label || filter)

  const report = () => ({
    title: 'Activity Calendar', period: a.sessionSettings?.academicYear ? `Academic Year ${a.sessionSettings.academicYear}` : '',
    filters: [['Total Activities', String(acts.length)], ['Scheduled', String(acts.filter((x) => x.status === 'upcoming').length)], ['Completed', String(acts.filter((x) => x.status === 'completed').length)]],
    sections: [{ columns: [{ label: '#', a: 'c' }, { label: 'Activity', a: 'l' }, { label: 'From', a: 'l' }, { label: 'To', a: 'l' }, { label: 'Status', a: 'l' }, { label: 'Purpose', a: 'l' }], rows: acts.slice().sort((x, y) => (x.start < y.start ? -1 : 1)).map((x, i) => [i + 1, x.name, fmtDate(x.start), fmtDate(x.end), ACT_STATUS[x.status]?.label || x.status, x.purpose || '—']), totals: null }],
  })

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--tm)' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, display: 'block', margin: '0 auto 10px' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>Loading activity calendar…</div>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 14, borderRadius: 'var(--r-md)', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.25)', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--err)' }} />
          <div style={{ flex: 1 }}>{error}</div>
          {!!networkId && <button className="btn-sm" style={{ height: 30 }} onClick={() => { setLoading(true); setError(''); reload().catch((err) => setError(err?.message || 'Could not load activities')).finally(() => setLoading(false)) }}><i className="fa-solid fa-rotate-right" /> Retry</button>}
        </div>
      )}

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
          <div className="card-header">
            <div>
              <div className="card-title"><i className="fa-solid fa-list" /> Activities</div>
              <div className="card-sub">{acts.length} activit{acts.length === 1 ? 'y' : 'ies'} scheduled</div>
            </div>
            <button className="btn-primary" onClick={() => setModal({ mode: 'add' })} disabled={busy}><i className="fa-solid fa-plus" /> Add Activity</button>
          </div>

          {/* Search + ek cycling status filter — ERP ke act-search-row jaisa. */}
          <div className="act-search-row">
            <div className="act-search-box">
              <i className="fa-solid fa-magnifying-glass" />
              <input type="text" placeholder="Search activities…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button
              className={`act-filter-btn${filter !== 'all' ? ' on' : ''}`}
              title="Cycle activity filter (All → Scheduled → Ongoing → Completed)"
              onClick={cycleFilter}
            >
              <i className="fa-solid fa-sliders" />
              <span>{filterLabel}</span>
            </button>
          </div>

          <div className="act-events-list">
            {visible.length === 0 ? (
              <div className="act-empty">
                <div className="act-empty-icon"><i className="fa-solid fa-calendar-xmark" /></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>No activities found</div>
                <div style={{ fontSize: 11.5, color: 'var(--tm)' }}>{acts.length ? 'Try adjusting the filter or search' : 'Click “Add Activity” to schedule one'}</div>
              </div>
            ) : visible.map((x) => {
              const st = ACT_STATUS[x.status] || ACT_STATUS.upcoming
              return (
                <div className="act-event-item" key={x.id}>
                  <div className="act-event-strip" style={{ background: st.color }} />
                  <div className="act-event-body">
                    <div className="act-event-name">{x.name}</div>
                    <div className="act-event-dates">
                      <i className="fa-solid fa-calendar" />{fmtDate(x.start)}{x.end !== x.start ? ` — ${fmtDate(x.end)}` : ''}
                    </div>
                    <div className="act-event-badge" style={{ background: `${st.color}1a`, color: st.color }}>
                      <i className={`fa-solid ${x.status === 'completed' ? 'fa-circle-check' : x.status === 'ongoing' ? 'fa-spinner' : 'fa-clock'}`} style={{ fontSize: 9 }} /> {st.label}
                    </div>
                    {x.purpose && <div className="ac-evt-purpose">{x.purpose}</div>}
                  </div>
                  <div className="act-event-actions">
                    <button className="btn-sm" style={{ height: 28 }} title="Edit activity" disabled={busy} onClick={() => setModal({ mode: 'edit', act: x })}><i className="fa-solid fa-pen" /></button>
                    <button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} title="Delete activity" disabled={busy} onClick={() => setDel(x)}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {modal && <ActivityModal modal={modal} busy={busy} ss={a.sessionSettings || {}} onClose={() => setModal(null)} onSave={save} onToast={fire} />}
      {del && <ConfirmModal title="Remove Activity?" body={`“${del.name}” will be removed.`} busy={busy} onClose={() => setDel(null)} onConfirm={doDel} />}
    </>
  )
}

function ActivityModal({ modal, busy, ss = {}, onClose, onSave, onToast }) {
  const x = modal.act
  const [v, setV] = useState({ name: x?.name || '', start: x?.start || '', end: x?.end || '', purpose: x?.purpose || '', development: x?.development || '', resource: x?.resource || '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.name.trim()) return onToast('Enter activity name', 'warn')
    if (!v.start) return onToast('Pick a start date', 'warn')
    const end = v.end || v.start
    if (end < v.start) return onToast('End date must be on or after the start date', 'warn')
    /* Session-window guard (ERP jaisa) — activity academic session ke andar hi
       rehni chahiye. Session set na ho to block nahi karte. */
    if (ss.start && ss.end && (v.start < ss.start || end > ss.end)) {
      return onToast(`Session runs ${ss.start} → ${ss.end}. Pick activity dates within this range.`, 'warn')
    }
    /* Status backend me store nahi hota — dates se banta hai (ERP jaisa hi). */
    onSave({ name: v.name.trim(), start: v.start, end, status: activityStatus(v.start, end), purpose: v.purpose.trim(), development: v.development.trim(), resource: v.resource.trim() }, x?.id)
  }
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 560 }}>
        <div className="pay-modal-hdr"><div className="pay-modal-av"><i className="fa-solid fa-calendar-plus" /></div><div><div className="pay-modal-title">{x ? 'Edit Activity' : 'Add Activity'}</div></div><button className="pay-modal-x" onClick={onClose} disabled={busy}><i className="fa-solid fa-xmark" /></button></div>
        <div className="pay-modal-body">
          <div className="ac-field" style={{ marginBottom: 12 }}><label>Activity Name</label><input className="ac-input" value={v.name} onChange={set('name')} placeholder="e.g. Science Fair" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {/* min/max se picker khud hi ghalat range nahi chunne deta — toast
                sirf aakhri safety net hai (manual typing / purana record). */}
            <div className="ac-field"><label>From</label><input className="ac-input" type="date" value={v.start} min={ss.start || undefined} max={v.end || ss.end || undefined} onChange={set('start')} /></div>
            <div className="ac-field"><label>To</label><input className="ac-input" type="date" value={v.end} min={v.start || ss.start || undefined} max={ss.end || undefined} onChange={set('end')} /></div>
          </div>
          <div className="ac-field" style={{ marginBottom: 12 }}><label>Purpose</label><textarea className="ac-input" rows={2} value={v.purpose} onChange={set('purpose')} placeholder="Purpose of the activity" /></div>
          <div className="ac-field" style={{ marginBottom: 12 }}><label>Development / Plan</label><input className="ac-input" value={v.development} onChange={set('development')} placeholder="Preparation steps" /></div>
          <div className="ac-field"><label>Resources Required</label><input className="ac-input" value={v.resource} onChange={set('resource')} placeholder="Equipment, materials…" /></div>
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {busy ? 'Saving…' : 'Save Activity'}</button></div>
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

/* Resource Library LIVE hai — network ke resources ERP ke
   /api/manage-resource-library par (dekhein src/api/resourceLibraryApi.js).

   Do modes:
     • live (resources prop nahi aaya) → sab kuch API par, class/subject
       dropdowns bhi LaunchSetup ki asli ids se bharte hain.
     • snapshot (release ka frozen copy) → wahi purana local behaviour;
       release ka data jama hua hai, use API par nahi le jate. */
function OtherResources({ a, fire, resources, onResources }) {
  // resources prop + onResources → editable snapshot; resources prop only → read-only; neither → live API
  const snapshot = resources !== undefined
  const live = !snapshot
  const readOnly = snapshot && !onResources
  const [list, setList] = useState(() => (snapshot ? resources : []))
  const [loading, setLoading] = useState(live)
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [fClass, setFClass] = useState('all')
  const [fSubject, setFSubject] = useState('all')
  const [fCat, setFCat] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [modal, setModal] = useState(null)
  const [del, setDel] = useState(null)
  /* Asli server ids — store ki `a.subjects` naam se bana hua id rakhti hai
     (dekhein academicsStore ka subjectIdOf), wo API par nahi chalta. Is liye
     dropdowns LaunchSetup se seedha aate hain, bilkul Create Lesson Plans
     jaise. */
  const [apiClasses, setApiClasses] = useState([])
  const subjCache = useRef({})

  /* Class ke subjects — aik dafa laa kar cache; modal aur filter dono isi se. */
  const loadSubjects = useCallback(async (classId) => {
    const key = Number(classId) || 0
    if (!key) return []
    if (subjCache.current[key]) return subjCache.current[key]
    const subs = await fetchClassSubjects(key).catch(() => [])
    subjCache.current[key] = subs
    return subs
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchNetworkResources()
      setList(rows)
      setLoadErr('')
      /* Local mirror: Releases wali screen resource count synchronously
         padhti hai (loadResources). Rows me file ka sirf path hota hai, is
         liye ye mirror chhota rehta hai — quota ka masla nahi. */
      saveResources(rows)
    } catch (e) {
      setLoadErr(e?.message || 'Could not load resources')
    } finally {
      setLoading(false)
    }
  }, [])

  /* Snapshot ki list initial state se aati hai (aur wahin edit hoti hai) —
     `resources` par depend karna theek nahi, parent har render par nayi
     array deta hai. Live mode hi API se load hota hai. */
  useEffect(() => {
    if (snapshot) return
    reload()
    fetchNetworkClasses().then(setApiClasses).catch(() => setApiClasses([]))
  }, [snapshot, reload])

  /* Snapshot mode ka purana rasta — sab kuch local. */
  const persistLocal = (next) => {
    if (readOnly) return
    setList(next)
    if (onResources) { onResources(next); return }
    if (!saveResources(next)) fire('Kept in memory — file too large to store locally', 'warn')
  }

  const save = async (payload) => {
    if (!live) {
      if (modal.mode === 'edit') { persistLocal(list.map((r) => (r.id === modal.resource.id ? { ...r, ...payload } : r))); fire('Resource updated') }
      else { persistLocal([{ id: nextResourceId(list), uploadDate: todayISO(), ...payload }, ...list]); fire('Resource uploaded') }
      setModal(null)
      return
    }
    const isEdit = modal.mode === 'edit'
    setBusy(true)
    try {
      await saveNetworkResource({ ...payload, id: isEdit ? modal.resource.id : 0 })
      setModal(null)
      fire(isEdit ? 'Resource updated' : 'Resource uploaded')
      await reload()
    } catch (e) {
      fire(e?.message || 'Could not save the resource', 'warn')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!live) { persistLocal(list.filter((r) => r.id !== del.id)); setDel(null); fire('Resource deleted', 'info'); return }
    setBusy(true)
    try {
      await deleteNetworkResource(del)
      setDel(null)
      fire('Resource deleted', 'info')
      await reload()
    } catch (e) {
      fire(e?.message || 'Could not delete the resource', 'warn')
    } finally {
      setBusy(false)
    }
  }

  const counts = useMemo(() => ({
    total: list.length,
    worksheet: list.filter((r) => r.category === 'worksheet').length,
    summer: list.filter((r) => r.category === 'summer').length,
    qpaper: list.filter((r) => r.category === 'qpaper').length,
    other: list.filter((r) => r.category === 'other').length,
  }), [list])

  /* Filter ke options: live me classes LaunchSetup se, aur subjects unhi
     rows se jo mil chuki hain (poore network ka subject master nahi hota —
     har subject kisi class ke neeche hi rehta hai). */
  const classOptions = live ? apiClasses : a.classes
  const subjectOptions = useMemo(() => {
    if (!live) return a.subjects
    const byId = new Map()
    list.forEach((r) => { if (r.subjectId && !byId.has(r.subjectId)) byId.set(r.subjectId, { id: r.subjectId, name: r.subName || subjectName(a, r.subjectId) }) })
    return [...byId.values()].sort((x, y) => x.name.localeCompare(y.name))
  }, [live, list, a])

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

  /* Live rows par server ka URL hota hai, snapshot rows par inline data URI. */
  const viewPdf = (r) => {
    if (r.fileUrl) { if (!window.open(r.fileUrl, '_blank', 'noopener')) fire('Allow pop-ups to view the PDF', 'warn'); return }
    if (r.fileData) { const w = window.open('', '_blank'); if (!w) return fire('Allow pop-ups to view the PDF', 'warn'); w.document.write(`<title>${r.fileName || r.title}</title><iframe src="${r.fileData}" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>`); w.document.close(); return }
    openResourceSample(r, a, fire)
  }
  const downloadPdf = (r) => {
    const href = r.fileUrl || r.fileData
    if (href) { const el = document.createElement('a'); el.href = href; el.download = r.fileName || `${r.title}.pdf`; el.target = '_blank'; el.rel = 'noopener'; document.body.appendChild(el); el.click(); el.remove(); fire('Download started'); return }
    openResourceSample(r, a, fire)
  }

  return (
    <div className="section-card">
      <div className="card-header">
        <div><div className="card-title"><i className="fa-solid fa-folder-open" /> Resource Library</div><div className="card-sub">Upload class-wise &amp; subject-wise PDF resources for connected schools.</div></div>
        {!readOnly && <button className="btn-primary" disabled={live && (loading || busy)} onClick={() => setModal({ mode: 'add' })}><i className="fa-solid fa-upload" /> Add Resource</button>}
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
          <select className="ac-input" value={fClass} onChange={(e) => setFClass(e.target.value)}><option value="all">All Classes</option>{classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="ac-input" value={fSubject} onChange={(e) => setFSubject(e.target.value)}><option value="all">All Subjects</option>{subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="ac-input" value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="all">All Categories</option>{RES_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
          <select className="ac-input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All Status</option>{Object.entries(RES_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <button className="btn-secondary" onClick={reset} disabled={!anyFilter}><i className="fa-solid fa-rotate-left" /> Reset</button>
        </div>

        {loading ? <div className="ac-empty"><i className="fa-solid fa-spinner fa-spin" /><div style={{ fontSize: 13, fontWeight: 700 }}>Loading resources…</div></div>
          : loadErr ? <div className="ac-empty"><i className="fa-solid fa-triangle-exclamation" /><div style={{ fontSize: 13, fontWeight: 700 }}>{loadErr}</div><div style={{ marginTop: 10 }}><button className="btn-secondary" onClick={reload}><i className="fa-solid fa-rotate-right" /> Try again</button></div></div>
          : filtered.length === 0 ? <div className="ac-empty"><i className="fa-solid fa-folder-open" /><div style={{ fontSize: 13, fontWeight: 700 }}>No resources found</div><div style={{ fontSize: 12, marginTop: 4 }}>{anyFilter ? 'Try adjusting the filters.' : 'Click “Add Resource” to upload your first PDF.'}</div></div>
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
                        <div className="res-card-meta"><span><i className="fa-solid fa-chalkboard" /> {r.clsName || className(a, r.classId)}</span><span><i className="fa-solid fa-book" /> {r.subName || subjectName(a, r.subjectId)}</span></div>
                      </div>
                      <span className={`badge ${st.badge}`}>{st.label}</span>
                    </div>
                    <div className="res-badges"><span className={`badge res-cat-badge c-${cat.color}`}><i className={`fa-solid ${cat.icon}`} /> {cat.label}</span></div>
                    {r.desc && <div className="res-card-desc">{r.desc}</div>}
                    <div className="res-card-file"><i className="fa-solid fa-file-pdf" /> <span className="res-file-name">{r.fileName || 'No file attached'}</span>{r.uploadDate && <span className="res-card-date"><i className="fa-regular fa-calendar" /> {fmtDate(r.uploadDate)}</span>}</div>
                    <div className="res-card-actions">
                      <button className="btn-sm res-keep" onClick={() => viewPdf(r)}><i className="fa-solid fa-eye" /> View</button>
                      <button className="btn-sm res-keep" onClick={() => downloadPdf(r)}><i className="fa-solid fa-download" /> Download</button>
                      {!readOnly && <button className="btn-sm" disabled={busy} onClick={() => setModal({ mode: 'edit', resource: r })}><i className="fa-solid fa-pen" /> Edit</button>}
                      {!readOnly && <button className="btn-sm" disabled={busy} style={{ borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(r)}><i className="fa-solid fa-trash-can" /></button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>
      {modal && <ResourceModal a={a} live={live} classes={classOptions} loadSubjects={loadSubjects} busy={busy} modal={modal} onClose={() => { if (!busy) setModal(null) }} onSave={save} onToast={fire} />}
      {del && <ConfirmModal title="Delete Resource?" body={`“${del.title}” will be permanently removed.`} busy={busy} onClose={() => setDel(null)} onConfirm={doDelete} />}
    </div>
  )
}

function ResourceModal({ a, live, classes, loadSubjects, busy, modal, onClose, onSave, onToast }) {
  const r = modal.resource
  const first = classes[0]?.id || ''
  const [classId, setClassId] = useState(String(r?.classId || first || ''))
  /* Live me subjects server se aate hain (asli subjectID chahiye), snapshot
     me store se — wahan wahi purani name-hash wali ids chalti hain. */
  const [subs, setSubs] = useState(() => (live ? [] : subjectsOfClass(a, Number(r?.classId || first))))
  const [subjectId, setSubjectId] = useState(String(r?.subjectId || ''))
  const [category, setCategory] = useState(r?.category || 'worksheet')
  const [title, setTitle] = useState(r?.title || '')
  const [desc, setDesc] = useState(r?.desc || '')
  const status = r?.status || 'published'
  const [fileName, setFileName] = useState(r?.fileName || '')
  const [fileData, setFileData] = useState(r?.fileData || null)
  const [pdfFile, setPdfFile] = useState(null)
  const fileRef = useRef(null)

  /* Class badalte hi uske subjects. Edit par pehli dafa mojooda subject
     rehne dete hain (agar us class me hai), warna pehla chun lete hain. */
  useEffect(() => {
    let alive = true
    const apply = (rows) => {
      if (!alive) return
      setSubs(rows)
      setSubjectId((cur) => (rows.some((s) => String(s.id) === String(cur)) ? cur : String(rows[0]?.id || '')))
    }
    if (!live) { apply(subjectsOfClass(a, Number(classId))); return undefined }
    setSubs([])
    loadSubjects(Number(classId)).then(apply).catch(() => apply([]))
    return () => { alive = false }
  }, [classId, live, a, loadSubjects])

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { onToast('Please select a PDF file', 'warn'); return }
    setFileName(f.name)
    setPdfFile(f)
    /* Snapshot mode file ko inline data URI ki shakal me rakhta hai; live
       mode me asli File upload hoti hai, is liye wahan padhne ki zaroorat
       nahi (aur baray PDF par ye mehnga bhi hai). */
    if (live) { setFileData(null); return }
    const reader = new FileReader()
    reader.onload = () => setFileData(reader.result)
    reader.onerror = () => onToast('Could not read the file', 'warn')
    reader.readAsDataURL(f)
  }
  const save = () => {
    if (!classId) return onToast('Select a class', 'warn')
    if (!subjectId) return onToast('Select a subject', 'warn')
    if (!title.trim()) return onToast('Enter a resource title', 'warn')
    const base = { classId: Number(classId), subjectId: Number(subjectId), category, title: title.trim(), desc: desc.trim(), status, fileName: fileName || null }
    if (!live) return onSave({ ...base, fileData })
    return onSave({
      ...base,
      /* Denormalized naam bhi jate hain — API inhi columns par list wapas
         karti hai, is liye card ko lookup nahi karna parta. */
      clsName: classes.find((c) => String(c.id) === String(classId))?.name || '',
      subName: subs.find((s) => String(s.id) === String(subjectId))?.name || '',
      secName: '',
      pdfFile,
      /* Nayi file na chuni ho to purana path wapas — warna edit par PDF
         gum ho jati hai. */
      filePath: pdfFile ? '' : (r?.filePath || ''),
    })
  }

  return (
    <ModalShell title={r ? 'Edit Resource' : 'Add Resource'} icon="fa-folder-open" maxWidth={560} onClose={onClose} foot={<><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {busy ? 'Saving…' : 'Save Resource'}</button></>}>
      <div className="ac-info-strip" style={{ marginBottom: 14 }}><i className="fa-solid fa-circle-info" /><span>Upload class-wise and subject-wise academic resources such as worksheets, summer vacation work, question papers, or other PDF documents. These resources can later be viewed by connected schools.</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="ac-field"><label>Class *</label><select className="ac-input" value={classId} onChange={(e) => setClassId(e.target.value)}>{classes.length === 0 ? <option value="">No classes</option> : classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="ac-field"><label>Subject *</label><select className="ac-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subs.length === 0 ? <option value="">No subjects</option> : subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="ac-field" style={{ gridColumn: '1/-1' }}><label>Category *</label><select className="ac-input" value={category} onChange={(e) => setCategory(e.target.value)}>{RES_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
      </div>
      <div className="ac-field" style={{ marginBottom: 12 }}><label>Resource Title *</label><input className="ac-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. English Grammar Worksheet — Nouns" /></div>
      <div className="ac-field" style={{ marginBottom: 12 }}><label>Resource Description</label><textarea className="ac-input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description of this resource…" /></div>
      <div className="ac-field"><label>Upload PDF</label>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={onFile} />
        <div className="res-upload" onClick={() => { if (!busy) fileRef.current?.click() }}>
          <i className="fa-solid fa-file-arrow-up" />
          <div>{fileName ? <strong>{fileName}</strong> : 'Click to select a PDF file'}<div className="res-upload-sub">{fileName ? (pdfFile || fileData ? 'Ready to save · click to replace' : 'Existing file') : 'PDF documents only'}</div></div>
        </div>
      </div>
    </ModalShell>
  )
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

function ConfirmModal({ title, body, busy, onClose, onConfirm }) {
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">{title}</div>
          <div className="confirm-sub">{body}</div>
          <div className="confirm-btns"><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-danger" onClick={onConfirm} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} /> {busy ? 'Deleting…' : 'Delete'}</button></div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
