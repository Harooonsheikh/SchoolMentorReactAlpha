import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  loadNotifications, saveNotifications,
  AUDIENCES, AUD_LABEL, AUD_ICON, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, fmtDate,
} from './data'
import ContentSourceBar from '../../components/ContentSourceBar'
import { loadSource, saveSource } from '../../config/contentSource'
import './Notifications.css'

export default function Notifications() {
  const [list, setList] = useState([])
  const [aud, setAud] = useState('all')      // audience filter pill
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [modal, setModal] = useState(null)   // { mode, item }
  const [del, setDel] = useState(null)
  const [toast, setToast] = useState(null)
  const [source, setSource] = useState('custom')
  const readOnly = source === 'mentor'

  useEffect(() => { setList(loadNotifications()); setSource(loadSource('notifications')) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])

  const fire = (text, type = 'success') => setToast({ text, type })
  const commit = (d) => { setList(d); saveNotifications(d) }
  const changeSource = (v) => {
    setSource(v); saveSource('notifications', v)
    fire(v === 'mentor' ? "Now showing School Mentor's notifications to your schools" : 'Now showing your own notifications to your schools')
  }

  const stats = useMemo(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return {
      total: list.length,
      sent: list.filter((n) => n.status === 'sent').length,
      scheduled: list.filter((n) => n.status === 'scheduled').length,
      month: list.filter((n) => (n.date || n.createdAt || '').startsWith(ym)).length,
    }
  }, [list])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((n) => (aud === 'all' || n.audience === aud)
      && (status === 'all' || n.status === status)
      && (!q || `${n.title}${n.message}`.toLowerCase().includes(q)))
  }, [list, aud, status, search])

  const save = (payload) => {
    if (modal.mode === 'edit') commit(list.map((n) => (n.id === modal.item.id ? { ...n, ...payload } : n)))
    else commit([{ id: Date.now(), createdAt: new Date().toISOString().slice(0, 10), ...payload }, ...list])
    setModal(null); fire('Notification saved')
  }
  const sendNow = (id) => { commit(list.map((n) => (n.id === id ? { ...n, status: 'sent' } : n))); fire('Notification sent to schools') }
  const doDelete = () => { commit(list.filter((n) => n.id !== del.id)); setDel(null); fire('Notification deleted', 'info') }

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-bell" /></div>
          <div>
            <div className="page-title">Notifications</div>
            <div className="page-sub">Create and send announcements to your chain schools — targeted by audience.</div>
          </div>
        </div>
        <TutorialButton />
        <button className="btn-primary" disabled={readOnly} title={readOnly ? 'Switch to Custom to add your own' : ''} onClick={() => setModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> New Notification</button>
      </div>

      <ContentSourceBar kind="notifications" label="Notifications" value={source} onChange={changeSource} />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Stat icon="fa-bell" val={stats.total} lbl="Total Notifications" />
        <Stat cls="s-green" icon="fa-paper-plane" val={stats.sent} lbl="Sent" />
        <Stat icon="fa-clock" iconBg="linear-gradient(135deg,#0369a1,#0284c7)" val={stats.scheduled} lbl="Scheduled" />
        <Stat cls="s-warn" icon="fa-users" val={AUDIENCES.length} lbl="Audiences" />
        <Stat icon="fa-calendar-week" val={stats.month} lbl="This Month" />
      </div>

      {/* Audience filter */}
      <div className="nt-cat-row">
        <button className={`nt-cat-btn${aud === 'all' ? ' active' : ''}`} onClick={() => setAud('all')}><i className="fa-solid fa-border-all" /> All</button>
        {AUDIENCES.filter((a) => a.key !== 'all').map((a) => (
          <button key={a.key} className={`nt-cat-btn${aud === a.key ? ' active' : ''}`} onClick={() => setAud(a.key)}><i className={`fa-solid ${a.icon}`} /> {a.label}</button>
        ))}
      </div>

      <div className="nt-filter-row">
        <div className="nt-search"><i className="fa-solid fa-magnifying-glass" /><input className="sop-input" placeholder="Search by title or message…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="sop-input" style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="nt-empty"><i className="fa-solid fa-bell-slash" /><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No Notifications Found</div><div style={{ fontSize: 13 }}>Create a new notification to get started.</div></div>
      ) : filtered.map((n) => (
        <div className={`nt-card pri-${n.priority}`} key={n.id}>
          <div className="nt-icon"><i className={`fa-solid ${AUD_ICON[n.audience] || 'fa-bell'}`} /></div>
          <div className="nt-body">
            <div className="nt-title">{n.title}</div>
            <div className="nt-meta">
              <span className={`nt-badge nt-aud-${n.audience}`}><i className={`fa-solid ${AUD_ICON[n.audience]}`} style={{ fontSize: 9 }} /> {AUD_LABEL[n.audience]}</span>
              <span className={`nt-badge nt-pri-${n.priority}`}>{PRIORITY_LABEL[n.priority]}</span>
              <span className={`nt-badge nt-st-${n.status}`}>{STATUS_LABEL[n.status]}</span>
              {n.date && <span className="nt-meta-txt"><i className="fa-regular fa-calendar fa-xs" /> {fmtDate(n.date)}{n.time ? ` · ${n.time}` : ''}</span>}
            </div>
            {n.message && <div className="nt-msg">{n.message}</div>}
            {n.link && <a className="nt-meta-txt" style={{ color: 'var(--info)', fontWeight: 700, marginTop: 6 }} href={n.link} target="_blank" rel="noreferrer"><i className="fa-solid fa-link fa-xs" /> Open link</a>}
          </div>
          <div className="nt-actions">
            {!readOnly && n.status !== 'sent' && <button className="nt-action-btn send" onClick={() => sendNow(n.id)}><i className="fa-solid fa-paper-plane" /> Send</button>}
            {!readOnly && <button className="nt-action-btn" onClick={() => setModal({ mode: 'edit', item: n })}><i className="fa-regular fa-pen-to-square" /> Edit</button>}
            {!readOnly && <button className="nt-action-btn danger" onClick={() => setDel({ id: n.id, title: n.title })}><i className="fa-regular fa-trash-can" /></button>}
          </div>
        </div>
      ))}

      {modal && <NotificationModal modal={modal} onClose={() => setModal(null)} onSave={save} onToast={fire} />}
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

function NotificationModal({ modal, onClose, onSave, onToast }) {
  const n = modal.item || {}
  const [v, setV] = useState({ title: n.title || '', message: n.message || '', audience: n.audience || 'all', priority: n.priority || 'normal', status: n.status || 'draft', date: n.date || '', time: n.time || '', link: n.link || '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.title.trim()) return onToast('Please enter a notification title', 'warn')
    if (!v.message.trim()) return onToast('Please enter a message', 'warn')
    if (v.status === 'scheduled' && !v.date) return onToast('Please pick a date for a scheduled notification', 'warn')
    onSave({ ...v, title: v.title.trim(), message: v.message.trim() })
  }
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 600 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av"><i className="fa-solid fa-bell" /></div>
          <div><div className="pay-modal-title">{modal.mode === 'edit' ? 'Edit Notification' : 'New Notification'}</div><div className="pay-modal-sub">Sent to the selected audience across your chain schools</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title *"><input className="sop-input" value={v.title} onChange={set('title')} placeholder="e.g. New Academic Calendar Published" /></Field>
          <Field label="Message *"><textarea className="sop-input" rows={3} value={v.message} onChange={set('message')} placeholder="Write the announcement message…" /></Field>
          <Field label="Audience *">
            <div className="nt-aud-grid">
              {AUDIENCES.map((a) => (
                <div key={a.key} className={`nt-aud-card${v.audience === a.key ? ' sel' : ''}`} onClick={() => setV((s) => ({ ...s, audience: a.key }))}>
                  <div className="nt-aud-card-ic"><i className={`fa-solid ${a.icon}`} /></div>
                  <div><div className="nt-aud-card-t">{a.label}</div><div className="nt-aud-card-s">{a.short}</div></div>
                </div>
              ))}
            </div>
          </Field>
          <div className="sop-grid2">
            <Field label="Priority"><select className="sop-input" value={v.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></Field>
            <Field label="Status"><select className="sop-input" value={v.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
          </div>
          <div className="sop-grid2">
            <Field label={`Date${v.status === 'scheduled' ? ' *' : ''}`}><input className="sop-input" type="date" value={v.date} onChange={set('date')} /></Field>
            <Field label="Time"><input className="sop-input" type="time" value={v.time} onChange={set('time')} /></Field>
          </div>
          <Field label="Link (optional)" hint="Attach a related link schools can open (form, calendar, document, etc.)."><input className="sop-input" value={v.link} onChange={set('link')} placeholder="e.g. https://…" /></Field>
        </div>
        <div className="pay-modal-foot">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Notification</button>
        </div>
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
          <div className="confirm-title">Delete Notification?</div>
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
