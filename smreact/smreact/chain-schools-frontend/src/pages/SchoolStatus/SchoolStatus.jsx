import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import { INITIAL_ERP, INITIAL_INACTIVE, USERS, MONTHS, getDetailData } from './data'
import './SchoolStatus.css'

const StatusBadge = ({ v }) => (v === 'Entered'
  ? <span className="badge b-green"><i className="fa-solid fa-check" style={{ fontSize: 8 }} /> Entered</span>
  : <span className="badge b-red"><i className="fa-solid fa-xmark" style={{ fontSize: 8 }} /> Not Entered</span>)

const initialsOf = (s) => (s.initials || s.name.slice(0, 2)).toUpperCase()

export default function SchoolStatus() {
  const [mainTab, setMainTab] = useState('erp')
  const [erp, setErp] = useState(INITIAL_ERP)
  const [inactive, setInactive] = useState(INITIAL_INACTIVE)

  const [eColor, setEColor] = useState('')
  const [eUser, setEUser] = useState('')
  const [eMonth, setEMonth] = useState(MONTHS[0])
  const [eQ, setEQ] = useState('')
  const [iQ, setIQ] = useState('')

  const [detail, setDetail] = useState(null)    // { school, isErp }
  const [confirm, setConfirm] = useState(null)   // { action, id }
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const erpFiltered = useMemo(() => {
    const q = eQ.trim().toLowerCase()
    return erp.filter((s) => (!q || s.name.toLowerCase().includes(q)) && (!eColor || s.color === eColor) && (!eUser || s.assigned === eUser))
  }, [erp, eQ, eColor, eUser])

  const inactiveFiltered = useMemo(() => {
    const q = iQ.trim().toLowerCase()
    return inactive.filter((s) => !q || s.name.toLowerCase().includes(q))
  }, [inactive, iQ])

  const assignUser = (id, val) => {
    setErp((prev) => prev.map((s) => (s.id === id ? { ...s, assigned: val } : s)))
    setToast({ type: 'success', text: `Assigned to: ${val}` })
  }

  const runConfirm = () => {
    if (!confirm) return
    const { action, id } = confirm
    if (action === 'deactivate') {
      const s = erp.find((x) => x.id === id)
      if (s) {
        setErp((prev) => prev.filter((x) => x.id !== id))
        setInactive((prev) => [...prev, { ...s, staffSignup: s.staffSignup ?? 0, stuSignup: s.stuSignup ?? 0 }])
      }
      setToast({ type: 'info', text: 'School moved to Inactive' })
    } else {
      const s = inactive.find((x) => x.id === id)
      if (s) {
        setInactive((prev) => prev.filter((x) => x.id !== id))
        // Reactivated schools rejoin the ERP list with a fresh slate.
        setErp((prev) => [...prev, {
          ...s, initials: initialsOf(s), assigned: USERS[0], color: 'Red',
          logins: 0, workTime: '00:00:00', notes: 0, calls: 0, messages: 0,
          onboarding: { completed: 0, total: 15 },
        }])
      }
      setToast({ type: 'success', text: 'School reactivated successfully!' })
    }
    setConfirm(null)
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-chart-line" /></div>
          <div>
            <div className="page-title">School Progress</div>
            <div className="page-sub">Track ERP schools and inactive branches from one place.</div>
          </div>
        </div>
        <TutorialButton />
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="stat-card s-green">
          <div className="stat-icon"><i className="fa-solid fa-server" /></div>
          <div className="stat-val">{erp.length}</div>
          <div className="stat-lbl">ERP Schools</div>
        </div>
        <div className="stat-card s-warn">
          <div className="stat-icon"><i className="fa-solid fa-moon" /></div>
          <div className="stat-val">{inactive.length}</div>
          <div className="stat-lbl">Inactive Schools</div>
        </div>
      </div>

      {/* Main tabs */}
      <div className="app-tabs">
        <button className={`app-tab${mainTab === 'erp' ? ' active' : ''}`} onClick={() => setMainTab('erp')}>
          <i className="fa-solid fa-server" /> ERP Schools <span className="tab-count">{erp.length}</span>
        </button>
        <button className={`app-tab${mainTab === 'inactive' ? ' active' : ''}`} onClick={() => setMainTab('inactive')}>
          <i className="fa-solid fa-moon" /> Inactive Schools <span className="tab-count">{inactive.length}</span>
        </button>
      </div>

      {/* ── ERP SCHOOLS ── */}
      {mainTab === 'erp' && (
        <div className="ss-panel">
          <div className="section-card" style={{ marginBottom: 16 }}>
            <div className="filter-bar">
              <div className="f-field">
                <label className="f-label"><i className="fa-solid fa-palette" style={{ color: 'var(--brand)', fontSize: 10 }} /> Branch Color</label>
                <select className="f-input" value={eColor} onChange={(e) => setEColor(e.target.value)}>
                  <option value="">All Colors</option><option value="Red">Red</option><option value="Green">Green</option>
                </select>
              </div>
              <div className="f-field">
                <label className="f-label"><i className="fa-solid fa-user" style={{ color: 'var(--brand)', fontSize: 10 }} /> User</label>
                <select className="f-input" value={eUser} onChange={(e) => setEUser(e.target.value)}>
                  <option value="">All Users</option>{USERS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="f-field">
                <label className="f-label"><i className="fa-regular fa-calendar" style={{ color: 'var(--brand)', fontSize: 10 }} /> Month</label>
                <select className="f-input" value={eMonth} onChange={(e) => setEMonth(e.target.value)}>
                  {MONTHS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="f-field-grow">
                <label className="f-label"><i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--brand)', fontSize: 10 }} /> Search</label>
                <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search schools…" value={eQ} onChange={(e) => setEQ(e.target.value)} /></div>
              </div>
            </div>
          </div>

          {erpFiltered.length === 0 ? (
            <div className="section-card"><div className="ss-empty"><i className="fa-solid fa-server" /><div className="ss-empty-t">No ERP schools found</div></div></div>
          ) : erpFiltered.map((s) => {
              const pct = s.onboarding.total ? Math.round(s.onboarding.completed / s.onboarding.total * 100) : 0
              return (
                <div className="erp-card" key={s.id}>
                  <div className="erp-top">
                    <div className="erp-avatar">{initialsOf(s)}</div>
                    <div className="erp-name">{s.name}</div>
                    <div className="erp-stat"><div className="erp-stat-val">{s.staff}</div><div className="erp-stat-lbl">Total Staff</div></div>
                    <div className="erp-divider" />
                    <div className="erp-stat"><div className="erp-stat-val">{s.students}</div><div className="erp-stat-lbl">Students</div></div>
                    <div className="erp-divider" />
                    <select className="assign-select" style={{ width: 150 }} value={s.assigned} onChange={(e) => assignUser(s.id, e.target.value)}>
                      {USERS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                    <button className="btn-danger" style={{ height: 34, fontSize: 12, padding: '0 12px', marginLeft: 10 }} onClick={() => setConfirm({ action: 'deactivate', id: s.id })}><i className="fa-solid fa-moon" /> Make InActive</button>
                    <button className="det-btn" style={{ marginLeft: 8 }} onClick={() => setDetail({ school: s, isErp: true })}><i className="fa-solid fa-chevron-down" /></button>
                  </div>
                  <div className="erp-meta">
                    <span className="erp-chip"><i className="fa-solid fa-right-to-bracket" /> {s.logins} Total Logins</span>
                    <span className="erp-chip"><i className="fa-regular fa-clock" /> {s.workTime} Working Time</span>
                    <span className="erp-chip"><i className="fa-regular fa-note-sticky" /> {s.notes} Notes</span>
                    <span className="erp-chip"><i className="fa-solid fa-phone" /> {s.calls} Calls</span>
                    <span className="erp-chip"><i className="fa-regular fa-comment" /> {s.messages} Messages</span>
                  </div>
                  <div className="erp-progress">
                    <div className="erp-prog-info">
                      <div className="erp-prog-icon"><i className="fa-solid fa-list-check" /></div>
                      <div>
                        <div className="erp-prog-lbl">Onboarding Cards</div>
                        <div className="erp-prog-num">{String(s.onboarding.completed).padStart(2, '0')} / {s.onboarding.total}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tm)', whiteSpace: 'nowrap' }}>{s.onboarding.completed} completed</div>
                    <div className="prog-track"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
                    <div style={{ fontSize: 11, color: 'var(--tm)', whiteSpace: 'nowrap' }}>{s.onboarding.total - s.onboarding.completed} remaining</div>
                    <div className="erp-pct">{pct}%</div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* ── INACTIVE SCHOOLS ── */}
      {mainTab === 'inactive' && (
        <div className="ss-panel">
          <div className="section-card">
            <div className="filter-bar">
              <div className="f-field-grow">
                <label className="f-label"><i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--brand)', fontSize: 10 }} /> Search</label>
                <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search inactive schools…" value={iQ} onChange={(e) => setIQ(e.target.value)} /></div>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="mentor-table">
                <thead><tr>
                  <th style={{ width: 48 }}>#</th><th>Branch Name</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Total Staff</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Total Students</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Staff Sign Up</th>
                  <th style={{ width: 120, textAlign: 'center' }}>Student Sign Up</th>
                  <th style={{ width: 130 }}>Action</th>
                  <th style={{ width: 75, textAlign: 'center' }}>Details</th>
                </tr></thead>
                <tbody>
                  {inactiveFiltered.length === 0 ? (
                    <tr><td colSpan={8}><div className="ss-empty"><i className="fa-solid fa-moon" /><div className="ss-empty-t">No inactive schools</div></div></td></tr>
                  ) : inactiveFiltered.map((s, i) => (
                    <tr key={s.id}>
                      <td data-label="#" style={{ fontWeight: 700, color: 'var(--tm)', textAlign: 'center' }}>{i + 1}</td>
                      <td data-label="Branch" className="td-bold">{s.name}</td>
                      <td data-label="Staff" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.staff}</td>
                      <td data-label="Students" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.students}</td>
                      <td data-label="Staff Sign Up" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.staffSignup}</td>
                      <td data-label="Student Sign Up" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.stuSignup}</td>
                      <td data-label="Action"><button className="btn-success" style={{ height: 34, fontSize: 12, padding: '0 12px' }} onClick={() => setConfirm({ action: 'activate', id: s.id })}><i className="fa-solid fa-circle-check" /> Make Active</button></td>
                      <td data-label="Details" style={{ textAlign: 'center' }}><button className="det-btn" onClick={() => setDetail({ school: s, isErp: false })}><i className="fa-solid fa-chevron-down" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {detail && (detail.isErp
        ? <ErpDetailModal school={detail.school} month={eMonth} onToast={(text, type = 'success') => setToast({ text, type })} onClose={() => setDetail(null)} />
        : <BranchDetailModal school={detail.school} onClose={() => setDetail(null)} />)}
      {confirm && <ConfirmModal action={confirm.action} onClose={() => setConfirm(null)} onConfirm={runConfirm} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

/* ── Detail row helper ── */
function Row({ label, val, pill, node }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      {node ? node : pill !== undefined ? <span className="detail-val-pill">{pill}</span> : <span className="detail-val">{val}</span>}
    </div>
  )
}

const TAB_ROWS = [
  ['school', 'School Tab'], ['classes', 'Classes Tab'], ['student', 'Student Tab'], ['dept', 'Department'],
  ['staff', 'Staff'], ['syllabus', 'Syllabus'], ['timetable', 'Time Table'],
]
const COMP_ROWS = [
  ['staffContact', 'Staff Contact'], ['parentContact', 'Parent Contact'],
  ['subjectAssigned', 'Subject Assigned'], ['prevDues', 'Previous Dues'],
]

/* Shared General / Date & State / Compulsions block. */
function DetailSections({ school }) {
  return (
    <>
      <div className="detail-grid">
        <div className="detail-card">
          <div className="detail-card-title"><i className="fa-solid fa-circle-info" /> General Details</div>
          <Row label="Principal Name" val={school.principal || '—'} />
          <Row label="Contact No" pill={school.contact || '—'} />
          <Row label="Total Student" pill={school.students ?? 0} />
          <Row label="Total Staff" pill={school.staff ?? 0} />
          <Row label="Student Sign Up" pill={school.stuSignup ?? 0} />
          <Row label="Staff Sign Up" pill={school.staffSignup ?? 0} />
          <Row label="Sign Up Date" pill={school.signupDate || '—'} />
        </div>
        <div className="detail-card">
          <div className="detail-card-title"><i className="fa-solid fa-calendar-check" /> Date &amp; State</div>
          {TAB_ROWS.map(([k, label]) => <Row key={k} label={label} node={<StatusBadge v={school.tabs?.[k] || 'Not Entered'} />} />)}
        </div>
      </div>
      <div className="detail-card" style={{ marginBottom: 16 }}>
        <div className="detail-card-title"><i className="fa-solid fa-triangle-exclamation" /> Compulsions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          {COMP_ROWS.map(([k, label]) => <Row key={k} label={label} node={<StatusBadge v={school.comp?.[k] || 'Not Entered'} />} />)}
        </div>
      </div>
    </>
  )
}

/* ── Branch Details modal (inactive schools) ── */
function BranchDetailModal({ school, onClose }) {
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal lg">
        <div className="modal-head">
          <div>
            <div className="modal-title"><i className="fa-solid fa-school" /> Branch Details</div>
            <div className="modal-sub">{school.name}</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="modal-body"><DetailSections school={school} /></div>
        <div className="modal-foot"><button className="btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>,
    document.body,
  )
}

/* ── ERP Detail modal (tabbed: Progress / Follow-up / Onboarding) ── */
const SUB_MAP = { note: 'notes', call: 'calls', message: 'messages' }
const ADD_CFG = {
  note: { title: 'Add Note', icon: 'fa-note-sticky', fieldLabel: 'Note', dateLabel: 'Date', saveLabel: 'Save Note', dateType: 'date', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' },
  call: { title: 'Add Call Log', icon: 'fa-phone', fieldLabel: 'Call Detail', dateLabel: 'Date & Time', saveLabel: 'Save Call', dateType: 'datetime-local', grad: 'linear-gradient(135deg,#15803D,#16A34A)' },
  message: { title: 'Add Message', icon: 'fa-comment-dots', fieldLabel: 'Message Detail', dateLabel: 'Date & Time', saveLabel: 'Save Message', dateType: 'datetime-local', grad: 'linear-gradient(135deg,#0369A1,#0284C7)' },
}
const FOLLOW_META = {
  notes: { type: 'note', icon: 'fa-note-sticky', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', title: 'Notes', sub: 'Internal notes and follow-up reminders', addLabel: 'Add Note', textField: 'text', dateField: 'date', tip: 'Add notes to track important information, tasks, or follow-up actions for this school.' },
  calls: { type: 'call', icon: 'fa-phone', grad: 'linear-gradient(135deg,#15803D,#16A34A)', title: 'Calls', sub: 'Call logs and phone interaction history', addLabel: 'Add Call', textField: 'detail', dateField: 'dateTime', tip: 'Log phone calls to keep a record of all communication with this school.' },
  messages: { type: 'message', icon: 'fa-comment-dots', grad: 'linear-gradient(135deg,#0369A1,#0284C7)', title: 'Messages', sub: 'WhatsApp, SMS, and written message logs', addLabel: 'Add Message', textField: 'detail', dateField: 'dateTime', tip: 'Record WhatsApp, SMS, or written messages exchanged with this school.' },
}

function ErpDetailModal({ school, month, onToast, onClose }) {
  const seed = useMemo(() => getDetailData(school), [school])
  const [tab, setTab] = useState('progress')
  const [followSub, setFollowSub] = useState('notes')
  const [follow, setFollow] = useState({ notes: seed.notes, calls: seed.calls, messages: seed.messages })
  const [addType, setAddType] = useState(null)

  const delItem = (sub, id) => {
    setFollow((f) => ({ ...f, [sub]: f[sub].filter((x) => x.id !== id) }))
    onToast('Deleted', 'info')
  }
  const saveAdd = (text, date) => {
    const sub = SUB_MAP[addType]
    const fmt = date ? date.replace('T', ', ').replace(/-/g, '/').slice(0, 16) : '—'
    const item = addType === 'note'
      ? { id: Date.now(), text, date: fmt, user: 'schoolmentoradmin' }
      : { id: Date.now(), detail: text, dateTime: fmt, user: 'schoolmentoradmin' }
    setFollow((f) => ({ ...f, [sub]: [item, ...f[sub]] }))
    onToast(`${ADD_CFG[addType].title.replace('Add ', '')} added`, 'success')
    setAddType(null)
  }
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal lg">
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="erp-avatar">{initialsOf(school)}</div>
            <div>
              <div className="modal-title" style={{ fontSize: 15 }}>{school.name}</div>
              <div className="modal-sub">{school.staff} Staff · {school.students} Students · {school.assigned}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="em-nav">
          <button className={`em-nav-btn${tab === 'progress' ? ' active' : ''}`} onClick={() => setTab('progress')}><i className="fa-solid fa-chart-line" /> School Progress</button>
          <button className={`em-nav-btn${tab === 'followup' ? ' active' : ''}`} onClick={() => setTab('followup')}><i className="fa-solid fa-headset" /> Follow-up Card</button>
        </div>

        <div className="modal-body">
          {tab === 'progress' && <ProgressTab school={school} seed={seed} month={month} />}
          {tab === 'followup' && <FollowupTab follow={follow} sub={followSub} setSub={setFollowSub} onAdd={setAddType} onDel={delItem} />}
        </div>
      </div>

      {addType && <AddPopup type={addType} onClose={() => setAddType(null)} onSave={saveAdd} />}
    </div>,
    document.body,
  )
}

function ProgressTab({ school, seed, month }) {
  const ModRows = ({ mods }) => (
    <div className="ss-mod-grid">
      {mods.map((m) => (
        <div className="ss-mod-row" key={m.key} style={m.l > 0 ? { borderColor: 'var(--bm)' } : undefined}>
          <div className="ss-mod-icon" style={m.l > 0 ? undefined : { background: 'rgba(100,116,139,.45)' }}><i className={`fa-solid ${m.icon}`} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ss-mod-name">{m.name}</div>
            <div className="ss-mod-time"><i className="fa-regular fa-clock" style={{ fontSize: 8, marginRight: 2 }} />{m.t}</div>
          </div>
          <span className="ss-mod-count" style={m.l > 0 ? undefined : { background: 'var(--muted)', color: 'var(--tm)' }}>{m.l} login{m.l !== 1 ? 's' : ''}</span>
        </div>
      ))}
    </div>
  )
  return (
    <>
      <DetailSections school={school} />
      <div className="modal-sect-title"><i className="fa-regular fa-calendar-day" /> Today&apos;s Progress</div>
      <div className="ss-login-grid">
        <div className="ss-login-box"><div className="ss-login-lbl">Logins Today</div><div className="ss-login-val">{seed.todayLogins}</div><div className="ss-login-sub">{seed.todayTime} working time</div></div>
        <div className="ss-login-box"><div className="ss-login-lbl">Working Time</div><div className="ss-login-val">{seed.todayTime}</div><div className="ss-login-sub">total today</div></div>
      </div>
      <ModRows mods={seed.todayMods} />
      <div className="modal-sect-title" style={{ marginTop: 18 }}><i className="fa-regular fa-calendar-check" /> Monthly Progress — {month}</div>
      <div className="ss-login-grid">
        <div className="ss-login-box"><div className="ss-login-lbl">Logins This Month</div><div className="ss-login-val">{seed.monthLogins}</div><div className="ss-login-sub">{seed.monthTime} working time</div></div>
        <div className="ss-login-box"><div className="ss-login-lbl">Working Time</div><div className="ss-login-val">{seed.monthTime}</div><div className="ss-login-sub">total this month</div></div>
      </div>
      <ModRows mods={seed.monthMods} />
    </>
  )
}

function FollowupTab({ follow, sub, setSub, onAdd, onDel }) {
  const meta = FOLLOW_META[sub]
  const list = follow[sub]
  return (
    <>
      <div className="em-sub-tabs">
        {Object.keys(FOLLOW_META).map((k) => (
          <button key={k} className={`em-stab${sub === k ? ' active' : ''}`} onClick={() => setSub(k)}>
            <i className={`fa-solid ${FOLLOW_META[k].icon}`} /> {FOLLOW_META[k].title}
            <span className="em-stab-cnt">{follow[k].length}</span>
          </button>
        ))}
      </div>

      <div className="fu-section-hdr">
        <div className="fu-section-info">
          <div className="fu-section-icon" style={{ background: meta.grad }}><i className={`fa-solid ${meta.icon}`} /></div>
          <div>
            <div className="fu-section-title">{meta.title}</div>
            <div className="fu-section-sub">{meta.sub}</div>
          </div>
        </div>
        <button className="fu-add-btn" onClick={() => onAdd(meta.type)}><i className="fa-solid fa-plus" /> {meta.addLabel}</button>
      </div>

      {list.length === 0 ? (
        <div className="fu-empty">
          <div className="fu-empty-icon"><i className={`fa-solid ${meta.icon}`} /></div>
          <div className="fu-empty-title">No {meta.title} yet</div>
          <div className="fu-empty-sub">{meta.tip}</div>
        </div>
      ) : (
        <div className="fu-list">
          {list.map((item) => (
            <div className="fu-card" key={item.id}>
              <div className={`fu-card-strip${meta.type === 'note' ? '' : ` ${meta.type}`}`} />
              <div className="fu-card-top">
                <div className={`fu-card-avatar ${meta.type}`}><i className={`fa-solid ${meta.icon}`} /></div>
                <div className="fu-card-body">
                  <div className="fu-card-text">{item[meta.textField]}</div>
                  <div className="fu-card-meta">
                    <span className="fu-meta-date"><i className="fa-regular fa-calendar" />{item[meta.dateField]}</span>
                    <span className="fu-meta-user"><i className="fa-solid fa-user" />{item.user}</span>
                  </div>
                </div>
                <div className="fu-card-actions">
                  <button className="fu-act-btn del" title="Delete" onClick={() => onDel(sub, item.id)}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function AddPopup({ type, onClose, onSave }) {
  const cfg = ADD_CFG[type]
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  return (
    <div className="em-add-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="em-add-box">
        <div className="em-add-hdr" style={{ background: cfg.grad }}>
          <div className="em-add-title"><i className={`fa-solid ${cfg.icon}`} /> {cfg.title}</div>
          <button className="em-add-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="em-add-body">
          <div className="em-add-f"><label>{cfg.fieldLabel}</label><textarea placeholder="Write here..." value={text} onChange={(e) => setText(e.target.value)} /></div>
          <div className="em-add-f"><label>{cfg.dateLabel}</label><input type={cfg.dateType} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="em-add-foot">
          <button className="btn-secondary" style={{ height: 34, padding: '0 14px', fontSize: 12.5 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ height: 34, padding: '0 16px', fontSize: 12.5 }} onClick={() => { if (!text.trim()) return; onSave(text.trim(), date) }}><i className="fa-regular fa-floppy-disk" /> {cfg.saveLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Confirm (deactivate / activate) ── */
function ConfirmModal({ action, onClose, onConfirm }) {
  const cfg = action === 'deactivate'
    ? { iconBg: 'rgba(217,119,6,.1)', iconBorder: 'rgba(217,119,6,.25)', iconColor: '#D97706', icon: 'fa-triangle-exclamation', title: 'Are you sure?', sub: 'Do you really want to deactivate this school? It will be moved to Inactive Schools and lose ERP access.', btnClass: 'btn-danger', btnIcon: 'fa-moon', btnLabel: 'OK, Deactivate' }
    : { iconBg: 'rgba(22,163,74,.1)', iconBorder: 'rgba(22,163,74,.25)', iconColor: '#16A34A', icon: 'fa-circle-check', title: 'Reactivate School?', sub: 'This school will be moved back to active ERP schools and regain system access.', btnClass: 'btn-success', btnIcon: 'fa-circle-check', btnLabel: 'Make Active' }

  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: cfg.iconBg, border: `2px solid ${cfg.iconBorder}`, color: cfg.iconColor }}><i className={`fa-solid ${cfg.icon}`} /></div>
          <div className="confirm-title">{cfg.title}</div>
          <div className="confirm-sub">{cfg.sub}</div>
          <div className="confirm-btns">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className={cfg.btnClass} onClick={onConfirm}><i className={`fa-solid ${cfg.btnIcon}`} /> {cfg.btnLabel}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
