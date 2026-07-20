import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  loadRecorded, saveRecorded, loadUpcoming, saveUpcoming,
  TT_CATS, TT_CAT_LABEL, TT_CAT_FULL, TT_STATUS_LABEL, REC_STATUS, UP_STATUS,
  ttInitials, ttFmtDate, toEmbed,
} from './data'
import ContentSourceBar from '../../components/ContentSourceBar'
import { loadSource, saveSource } from '../../config/contentSource'
import './TeacherTrainings.css'

export default function TeacherTrainings() {
  const [tab, setTab] = useState('recorded')
  const [recorded, setRecorded] = useState([])
  const [upcoming, setUpcoming] = useState([])

  const [recCat, setRecCat] = useState('all')
  const [recSearch, setRecSearch] = useState('')
  const [recStatus, setRecStatus] = useState('all')
  const [upSearch, setUpSearch] = useState('')
  const [upCat, setUpCat] = useState('all')
  const [upStatus, setUpStatus] = useState('all')

  const [recModal, setRecModal] = useState(null) // { mode, rec }
  const [upModal, setUpModal] = useState(null)   // { mode, up }
  const [viewRec, setViewRec] = useState(null)
  const [del, setDel] = useState(null)           // { type, id, title }
  const [toast, setToast] = useState(null)
  const [source, setSource] = useState('custom')
  const readOnly = source === 'mentor'

  useEffect(() => { setRecorded(loadRecorded()); setUpcoming(loadUpcoming()); setSource(loadSource('trainings')) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])

  const fire = (text, type = 'success') => setToast({ text, type })
  const commitRec = (d) => { setRecorded(d); saveRecorded(d) }
  const commitUp = (d) => { setUpcoming(d); saveUpcoming(d) }
  const changeSource = (v) => {
    setSource(v); saveSource('trainings', v)
    fire(v === 'mentor' ? "Now showing School Mentor's trainings to your schools" : 'Now showing your own trainings to your schools')
  }

  /* ── stats ── */
  const stats = useMemo(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const month = recorded.filter((r) => r.date?.startsWith(ym)).length + upcoming.filter((u) => u.date?.startsWith(ym)).length
    return {
      total: recorded.length,
      published: recorded.filter((r) => r.status === 'published').length,
      upcoming: upcoming.filter((u) => u.status === 'scheduled').length,
      month,
    }
  }, [recorded, upcoming])

  /* ── filtered lists ── */
  const recList = useMemo(() => {
    const q = recSearch.trim().toLowerCase()
    return recorded.filter((r) => (recCat === 'all' || r.cat === recCat)
      && (recStatus === 'all' || r.status === recStatus)
      && (!q || `${r.title}${r.trainer}${r.cat}`.toLowerCase().includes(q)))
  }, [recorded, recCat, recStatus, recSearch])

  const upList = useMemo(() => {
    const q = upSearch.trim().toLowerCase()
    return upcoming.filter((u) => (upCat === 'all' || u.cat === upCat)
      && (upStatus === 'all' || u.status === upStatus)
      && (!q || `${u.title}${u.trainer}${u.cat}`.toLowerCase().includes(q)))
  }, [upcoming, upCat, upStatus, upSearch])

  /* ── actions ── */
  const saveRec = (payload) => {
    if (recModal.mode === 'edit') commitRec(recorded.map((r) => (r.id === recModal.rec.id ? { ...r, ...payload } : r)))
    else commitRec([{ id: Date.now(), ...payload }, ...recorded])
    setRecModal(null); fire('Recorded training saved')
  }
  const saveUp = (payload) => {
    if (upModal.mode === 'edit') commitUp(upcoming.map((u) => (u.id === upModal.up.id ? { ...u, ...payload } : u)))
    else commitUp([{ id: Date.now(), ...payload }, ...upcoming])
    setUpModal(null); fire('Upcoming training saved')
  }
  const markDone = (id) => { commitUp(upcoming.map((u) => (u.id === id ? { ...u, status: 'completed' } : u))); fire('Marked as completed') }
  const doDelete = () => {
    if (del.type === 'rec') commitRec(recorded.filter((r) => r.id !== del.id))
    else commitUp(upcoming.filter((u) => u.id !== del.id))
    setDel(null); fire('Training deleted', 'info')
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#6D28D9,#7C3AED)' }}><i className="fa-solid fa-chalkboard-user" /></div>
          <div>
            <div className="page-title">Teacher Trainings</div>
            <div className="page-sub">Manage recorded and upcoming teacher training sessions for schools.</div>
          </div>
        </div>
        <TutorialButton />
        {readOnly
          ? <span className="ro-pill"><i className="fa-solid fa-eye" /> View only — School Mentor content</span>
          : (tab === 'recorded'
            ? <button className="btn-primary" onClick={() => setRecModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Recorded Training</button>
            : <button className="btn-primary" onClick={() => setUpModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Upcoming Training</button>)}
      </div>

      <ContentSourceBar kind="trainings" label="Trainings" value={source} onChange={changeSource} />

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Stat icon="fa-video" val={stats.total} lbl="Total Recorded" />
        <Stat cls="s-green" icon="fa-circle-check" val={stats.published} lbl="Published Videos" />
        <Stat icon="fa-calendar-days" iconBg="linear-gradient(135deg,#0369a1,#0284c7)" val={stats.upcoming} lbl="Upcoming Trainings" />
        <Stat cls="s-warn" icon="fa-layer-group" val={TT_CATS.length} lbl="Categories" />
        <Stat icon="fa-calendar-week" val={stats.month} lbl="This Month" />
      </div>

      {/* Tabs */}
      <div className="tt-tabs">
        <button className={`tt-tab${tab === 'recorded' ? ' active' : ''}`} onClick={() => setTab('recorded')}><i className="fa-solid fa-video" /> Recorded Trainings</button>
        <button className={`tt-tab${tab === 'upcoming' ? ' active' : ''}`} onClick={() => setTab('upcoming')}><i className="fa-solid fa-calendar-days" /> Upcoming Trainings</button>
      </div>

      {/* ── RECORDED ── */}
      {tab === 'recorded' && (
        <div>
          <div className="tt-cat-row">
            <button className={`tt-cat-btn${recCat === 'all' ? ' active' : ''}`} onClick={() => setRecCat('all')}><i className="fa-solid fa-border-all" /> All</button>
            {TT_CATS.map((c) => <button key={c.key} className={`tt-cat-btn${recCat === c.key ? ' active' : ''}`} onClick={() => setRecCat(c.key)}><i className={`fa-solid ${c.icon}`} /> {c.label}</button>)}
          </div>
          <div className="tt-filter-row">
            <div className="tt-search"><i className="fa-solid fa-magnifying-glass" /><input className="sop-input" placeholder="Search by topic or trainer name…" value={recSearch} onChange={(e) => setRecSearch(e.target.value)} /></div>
            <select className="sop-input" style={{ width: 160 }} value={recStatus} onChange={(e) => setRecStatus(e.target.value)}>
              <option value="all">All Statuses</option>{REC_STATUS.map((s) => <option key={s} value={s}>{TT_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          {recList.length === 0 ? (
            <div className="tt-empty"><i className="fa-solid fa-video" /><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No Recorded Trainings Found</div><div style={{ fontSize: 13 }}>Add a new recorded training to get started.</div></div>
          ) : recList.map((r) => (
            <div className="tt-card" key={r.id}>
              <div className="tt-card-avatar">{ttInitials(r.trainer)}</div>
              <div className="tt-card-body">
                <div className="tt-card-title">{r.title}</div>
                <div className="tt-card-meta">
                  <span className={`tt-badge tt-badge-${r.cat}`}>{TT_CAT_LABEL[r.cat] || r.cat}</span>
                  <span className={`tt-badge tt-status-${r.status}`}>{TT_STATUS_LABEL[r.status]}</span>
                  <span className="tt-meta-txt"><i className="fa-solid fa-user fa-xs" /> {r.trainer}</span>
                  {r.date && <span className="tt-meta-txt"><i className="fa-regular fa-calendar fa-xs" /> {ttFmtDate(r.date)}</span>}
                  {r.duration && <span className="tt-meta-txt"><i className="fa-regular fa-clock fa-xs" /> {r.duration}</span>}
                </div>
                {r.desc && <div className="tt-card-desc">{r.desc}</div>}
              </div>
              <div className="tt-card-actions">
                <button className="tt-action-btn" onClick={() => setViewRec(r)}><i className="fa-solid fa-play" /> View</button>
                {!readOnly && <button className="tt-action-btn" onClick={() => setRecModal({ mode: 'edit', rec: r })}><i className="fa-regular fa-pen-to-square" /> Edit</button>}
                {!readOnly && <button className="tt-action-btn danger" onClick={() => setDel({ type: 'rec', id: r.id, title: r.title })}><i className="fa-regular fa-trash-can" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── UPCOMING ── */}
      {tab === 'upcoming' && (
        <div>
          <div className="tt-filter-row">
            <div className="tt-search"><i className="fa-solid fa-magnifying-glass" /><input className="sop-input" placeholder="Search by topic or trainer name…" value={upSearch} onChange={(e) => setUpSearch(e.target.value)} /></div>
            <select className="sop-input" style={{ width: 180 }} value={upCat} onChange={(e) => setUpCat(e.target.value)}>
              <option value="all">All Categories</option>{TT_CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select className="sop-input" style={{ width: 160 }} value={upStatus} onChange={(e) => setUpStatus(e.target.value)}>
              <option value="all">All Statuses</option>{UP_STATUS.map((s) => <option key={s} value={s}>{TT_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          {upList.length === 0 ? (
            <div className="tt-empty"><i className="fa-solid fa-calendar-days" /><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No Upcoming Trainings Found</div><div style={{ fontSize: 13 }}>Add a new upcoming training to get started.</div></div>
          ) : upList.map((u) => (
            <div className="tt-card" key={u.id}>
              <div className="tt-card-avatar" style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)' }}>{ttInitials(u.trainer)}</div>
              <div className="tt-card-body">
                <div className="tt-card-title">{u.title}</div>
                <div className="tt-card-meta">
                  <span className={`tt-badge tt-badge-${u.cat}`}>{TT_CAT_LABEL[u.cat] || u.cat}</span>
                  <span className={`tt-badge tt-status-${u.status}`}>{TT_STATUS_LABEL[u.status]}</span>
                  <span className="tt-meta-txt"><i className="fa-solid fa-user fa-xs" /> {u.trainer}</span>
                  {u.date && <span className="tt-meta-txt"><i className="fa-regular fa-calendar fa-xs" /> {ttFmtDate(u.date)}{u.time ? ` · ${u.time}` : ''}</span>}
                  {u.duration && <span className="tt-meta-txt"><i className="fa-regular fa-clock fa-xs" /> {u.duration}</span>}
                </div>
                {u.desc && <div className="tt-card-desc">{u.desc}</div>}
                {u.link && <a className="tt-join" href={u.link} target="_blank" rel="noreferrer"><i className="fa-solid fa-video" /> Join Meeting</a>}
              </div>
              <div className="tt-card-actions">
                {u.link && <a className="tt-action-btn" href={u.link} target="_blank" rel="noreferrer"><i className="fa-solid fa-video" /> Join</a>}
                {!readOnly && <button className="tt-action-btn" onClick={() => setUpModal({ mode: 'edit', up: u })}><i className="fa-regular fa-pen-to-square" /> Edit</button>}
                {!readOnly && u.status === 'scheduled' && <button className="tt-action-btn done" onClick={() => markDone(u.id)}><i className="fa-solid fa-check" /> Done</button>}
                {!readOnly && <button className="tt-action-btn danger" onClick={() => setDel({ type: 'up', id: u.id, title: u.title })}><i className="fa-regular fa-trash-can" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ── */}
      {recModal && <RecordedModal modal={recModal} onClose={() => setRecModal(null)} onSave={saveRec} onToast={fire} />}
      {upModal && <UpcomingModal modal={upModal} onClose={() => setUpModal(null)} onSave={saveUp} onToast={fire} />}
      {viewRec && <ViewModal rec={viewRec} onClose={() => setViewRec(null)} />}
      {del && <DeleteModal title={del.title} onClose={() => setDel(null)} onConfirm={doDelete} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

function Stat({ cls = '', icon, iconBg, val, lbl }) {
  return (
    <div className={`stat-card ${cls}`}>
      <div className="stat-icon" style={iconBg ? { background: iconBg } : undefined}><i className={`fa-solid ${icon}`} /></div>
      <div className="stat-val">{val}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  )
}

/* ── Recorded add/edit modal ── */
function RecordedModal({ modal, onClose, onSave, onToast }) {
  const r = modal.rec || {}
  const [v, setV] = useState({ cat: r.cat || '', status: r.status || 'draft', title: r.title || '', trainer: r.trainer || '', duration: r.duration || '', bio: r.bio || '', desc: r.desc || '', date: r.date || '', video: r.video || '', thumb: r.thumb || '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.title.trim() || !v.cat || !v.trainer.trim()) return onToast('Please fill required fields (Category, Title, Trainer)', 'warn')
    onSave({ ...v, title: v.title.trim(), trainer: v.trainer.trim() })
  }
  return (
    <Shell title={modal.mode === 'edit' ? 'Edit Recorded Training' : 'Add Recorded Training'} icon="fa-video" onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Training</button></>}>
      <div className="sop-grid2">
        <Field label="Training Category *"><select className="sop-input" value={v.cat} onChange={set('cat')}><option value="">Select Category</option>{TT_CATS.map((c) => <option key={c.key} value={c.key}>{c.full}</option>)}</select></Field>
        <Field label="Status"><select className="sop-input" value={v.status} onChange={set('status')}>{REC_STATUS.map((s) => <option key={s} value={s}>{TT_STATUS_LABEL[s]}</option>)}</select></Field>
      </div>
      <Field label="Training Topic / Title *"><input className="sop-input" value={v.title} onChange={set('title')} placeholder="e.g. Effective Lesson Planning & Instructional Design" /></Field>
      <div className="sop-grid2">
        <Field label="Trainer Name *"><input className="sop-input" value={v.trainer} onChange={set('trainer')} placeholder="e.g. Dr. Sarah Ahmed" /></Field>
        <Field label="Duration"><input className="sop-input" value={v.duration} onChange={set('duration')} placeholder="e.g. 52 min" /></Field>
      </div>
      <Field label="Trainer Profile / Short Bio"><input className="sop-input" value={v.bio} onChange={set('bio')} placeholder="e.g. Senior Academic Consultant with 18 years of experience…" /></Field>
      <Field label="Training Description"><textarea className="sop-input" rows={3} value={v.desc} onChange={set('desc')} placeholder="Brief description of what this training covers…" /></Field>
      <Field label="Training Date"><input className="sop-input" type="date" value={v.date} onChange={set('date')} /></Field>
      <Field label="Video URL / Embed Link" hint="Upload the screen-recorded training video that will be visible on the school side."><input className="sop-input" value={v.video} onChange={set('video')} placeholder="e.g. https://www.youtube.com/embed/…" /></Field>
      <Field label="Thumbnail / Cover Image URL"><input className="sop-input" value={v.thumb} onChange={set('thumb')} placeholder="e.g. https://…thumbnail.jpg" /></Field>
    </Shell>
  )
}

/* ── Upcoming add/edit modal ── */
function UpcomingModal({ modal, onClose, onSave, onToast }) {
  const u = modal.up || {}
  const [v, setV] = useState({ cat: u.cat || '', status: u.status || 'scheduled', title: u.title || '', trainer: u.trainer || '', duration: u.duration || '', bio: u.bio || '', desc: u.desc || '', date: u.date || '', time: u.time || '', link: u.link || '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.title.trim() || !v.cat || !v.trainer.trim()) return onToast('Please fill required fields (Category, Title, Trainer)', 'warn')
    onSave({ ...v, title: v.title.trim(), trainer: v.trainer.trim() })
  }
  return (
    <Shell title={modal.mode === 'edit' ? 'Edit Upcoming Training' : 'Add Upcoming Training'} icon="fa-calendar-days" onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Training</button></>}>
      <div className="sop-grid2">
        <Field label="Training Category *"><select className="sop-input" value={v.cat} onChange={set('cat')}><option value="">Select Category</option>{TT_CATS.map((c) => <option key={c.key} value={c.key}>{c.full}</option>)}</select></Field>
        <Field label="Status"><select className="sop-input" value={v.status} onChange={set('status')}>{UP_STATUS.map((s) => <option key={s} value={s}>{TT_STATUS_LABEL[s]}</option>)}</select></Field>
      </div>
      <Field label="Training Topic / Title *"><input className="sop-input" value={v.title} onChange={set('title')} placeholder="e.g. Classroom Management Strategies" /></Field>
      <div className="sop-grid2">
        <Field label="Trainer Name *"><input className="sop-input" value={v.trainer} onChange={set('trainer')} placeholder="e.g. Usman Khalid" /></Field>
        <Field label="Duration"><input className="sop-input" value={v.duration} onChange={set('duration')} placeholder="e.g. 60 min" /></Field>
      </div>
      <Field label="Trainer Profile / Short Bio"><input className="sop-input" value={v.bio} onChange={set('bio')} placeholder="e.g. Lead Trainer, School Mentor" /></Field>
      <Field label="Training Description"><textarea className="sop-input" rows={3} value={v.desc} onChange={set('desc')} placeholder="What will be covered in this training…" /></Field>
      <div className="sop-grid2">
        <Field label="Training Date *"><input className="sop-input" type="date" value={v.date} onChange={set('date')} /></Field>
        <Field label="Training Time"><input className="sop-input" type="time" value={v.time} onChange={set('time')} /></Field>
      </div>
      <Field label="Google Meet / Zoom Link" hint="Schools will see this training schedule and joining link on their side."><input className="sop-input" value={v.link} onChange={set('link')} placeholder="e.g. https://meet.google.com/abc-def-ghi" /></Field>
    </Shell>
  )
}

/* ── View recorded modal ── */
function ViewModal({ rec, onClose }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 700 }}>
        <div className="pay-modal-hdr" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
          <div className="pay-modal-av" style={{ background: 'rgba(255,255,255,.15)' }}>{ttInitials(rec.trainer)}</div>
          <div><div className="pay-modal-title" style={{ color: '#fff' }}>{rec.title}</div><div style={{ marginTop: 4 }}><span className={`tt-badge tt-badge-${rec.cat}`} style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>{TT_CAT_FULL[rec.cat] || rec.cat}</span></div></div>
          <button className="pay-modal-x" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">
          <div style={{ background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 12, padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', color: '#fff', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ttInitials(rec.trainer)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{rec.trainer}</div>
              <div style={{ fontSize: 12, color: 'var(--tm)' }}>{rec.bio || ''}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="tt-badge" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}><i className="fa-regular fa-calendar" /> {ttFmtDate(rec.date)}</span>
                <span className="tt-badge" style={{ background: 'rgba(2,132,199,.1)', color: 'var(--info)' }}><i className="fa-regular fa-clock" /> {rec.duration || '—'}</span>
              </div>
            </div>
          </div>
          {rec.video ? (
            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#0f172a', aspectRatio: '16/9' }}>
              <iframe src={toEmbed(rec.video)} title={rec.title} width="100%" height="100%" style={{ border: 'none', display: 'block', aspectRatio: '16/9' }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
            </div>
          ) : (
            <div style={{ background: 'var(--muted)', border: '2px dashed var(--bl)', borderRadius: 8, padding: 36, textAlign: 'center', color: 'var(--tm)' }}>
              <i className="fa-solid fa-video" style={{ fontSize: 30, opacity: 0.3, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 13, fontWeight: 700 }}>No video uploaded yet</div>
            </div>
          )}
          <div style={{ background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 8, padding: 14, marginTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--tm)', marginBottom: 6 }}>About This Training</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{rec.desc || 'No description provided.'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--tm)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}><i className="fa-solid fa-circle-info" /> Recorded session from {ttFmtDate(rec.date)}</div>
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>,
    document.body,
  )
}

function DeleteModal({ title, onClose, onConfirm }) {
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">Delete Training?</div>
          <div className="confirm-sub">“{title}” will be permanently deleted. This action cannot be undone.</div>
          <div className="confirm-btns">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="sop-field" style={{ margin: 0 }}>
      <label>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 4 }}><i className="fa-solid fa-circle-info" /> {hint}</div>}
    </div>
  )
}

/* Reusable modal shell (reuses the global .pay-modal styles) */
function Shell({ title, icon, foot, children, onClose }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 600 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av"><i className={`fa-solid ${icon}`} /></div>
          <div><div className="pay-modal-title">{title}</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div className="pay-modal-foot">{foot}</div>
      </div>
    </div>,
    document.body,
  )
}
