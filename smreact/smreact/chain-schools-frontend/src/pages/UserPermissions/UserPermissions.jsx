import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  loadPerms, savePerms, loadAssign, saveAssign,
  UM_MENUS, splitSchools,
} from './data'
import { useView } from '../../config/viewContext'
import { loadHr, fullName } from '../HumanResource/data'
import './UserPermissions.css'

export default function UserPermissions() {
  const [tab, setTab] = useState('assign')
  const [users, setUsers] = useState([])
  const [permStore, setPermStore] = useState({})
  const [assignStore, setAssignStore] = useState({})
  const [toast, setToast] = useState(null)

  /* Staff now come straight from the Human Resource module — no separate
     user registration. Each employee is a manageable user here. */
  useEffect(() => {
    const hr = loadHr()
    setUsers(hr.emps.map((e) => ({ id: e.id, fullName: fullName(e), status: e.status })))
    setPermStore(loadPerms())
    setAssignStore(loadAssign())
  }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])

  const fire = (text, type = 'success') => setToast({ text, type })
  const commitPerms = (d) => { setPermStore(d); savePerms(d) }
  const commitAssign = (d) => { setAssignStore(d); saveAssign(d) }

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-users-gear" /></div>
          <div>
            <div className="page-title">User Permissions</div>
            <div className="page-sub">Assign schools and control module permissions for your staff. Add new staff from the Human Resource module.</div>
          </div>
        </div>
        <TutorialButton />
      </div>

      <div className="um-tabs" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <button className={`um-tab${tab === 'assign' ? ' active' : ''}`} onClick={() => setTab('assign')}><i className="fa-solid fa-school" /> Assign School</button>
        <button className={`um-tab${tab === 'perm' ? ' active' : ''}`} onClick={() => setTab('perm')}><i className="fa-solid fa-shield-halved" /> User Permission</button>
      </div>

      {tab === 'assign' && <AssignTab users={users} assignStore={assignStore} commit={commitAssign} fire={fire} />}
      {tab === 'perm' && <PermissionTab users={users} permStore={permStore} commit={commitPerms} fire={fire} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

/* ════════ ASSIGN SCHOOL ════════ */
function AssignTab({ users, assignStore, commit, fire }) {
  /* Schools API se (connected schools), ERP / Inactive me batay hue. */
  const { schools: connectedSchools, schoolsLoading } = useView()
  const { erp: ERP_SCHOOLS, inactive: INACTIVE_SCHOOLS } = useMemo(() => splitSchools(connectedSchools), [connectedSchools])

  const [userId, setUserId] = useState('')
  const [type, setType] = useState('erp')
  const [search, setSearch] = useState('')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [working, setWorking] = useState(new Set())

  useEffect(() => { setWorking(new Set(assignStore[userId] || [])) }, [userId, assignStore])

  const schools = type === 'erp' ? ERP_SCHOOLS : INACTIVE_SCHOOLS
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return schools.filter((s) => !q || s.name.toLowerCase().includes(q))
  }, [schools, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageSafe = Math.min(page, totalPages)
  const slice = filtered.slice((pageSafe - 1) * perPage, pageSafe * perPage)
  const allOnPage = slice.length > 0 && slice.every((s) => working.has(s.id))

  const toggle = (id) => setWorking((w) => { const n = new Set(w); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (checked) => setWorking((w) => { const n = new Set(w); slice.forEach((s) => (checked ? n.add(s.id) : n.delete(s.id))); return n })
  const save = () => {
    if (!userId) return fire('Please select a user first', 'warn')
    commit({ ...assignStore, [userId]: [...working] }); fire('School assignment saved')
  }

  return (
    <div className="section-card">
      <div className="card-header"><div className="card-title"><i className="fa-solid fa-school" /> Assign School</div></div>
      <div style={{ padding: 20 }}>
        {/* <div style={{ marginBottom: 18 }}>
          <label className="um-label" style={{ display: 'block', marginBottom: 6 }}><i className="fa-solid fa-user" style={{ color: 'var(--brand)', marginRight: 4 }} /> Assign User</label>
          <select className="um-user-select" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1) }}>
            <option value="">Select User</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div> */}

        <div className="um-school-tabs">
          <button className={`um-stab${type === 'erp' ? ' active' : ''}`} onClick={() => { setType('erp'); setPage(1) }}><i className="fa-solid fa-server" /> ERP ({ERP_SCHOOLS.length})</button>
          <button className={`um-stab${type === 'inactive' ? ' active' : ''}`} onClick={() => { setType('inactive'); setPage(1) }}><i className="fa-solid fa-ban" /> Inactive ({INACTIVE_SCHOOLS.length})</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div className="lbl" style={{ fontSize: 13, color: 'var(--tm)' }}>Show <select className="f-input" style={{ width: 70, height: 30, display: 'inline-block', margin: '0 4px' }} value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}><option>10</option><option>25</option><option>50</option><option value={999}>All</option></select> entries</div>
          <div className="search-box" style={{ width: 200 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search school…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div>
        </div>

        <div className="tbl-wrap">
          <table className="um-assign-table">
            <thead><tr><th style={{ width: 60 }}>Sr #</th><th style={{ width: 50 }}><input type="checkbox" checked={allOnPage} onChange={(e) => toggleAll(e.target.checked)} disabled={!userId} /></th><th>School Name</th></tr></thead>
            <tbody>
              {!userId ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>Select a user to assign schools.</td></tr>
              ) : schoolsLoading ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>Loading schools…</td></tr>
              ) : slice.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>No schools found</td></tr>
              ) : slice.map((s, i) => (
                <tr key={s.id}>
                  <td data-label="Sr #" style={{ color: 'var(--tm)', fontWeight: 700 }}>{(pageSafe - 1) * perPage + i + 1}</td>
                  <td data-label="Select"><input type="checkbox" checked={working.has(s.id)} onChange={() => toggle(s.id)} /></td>
                  <td data-label="School" style={{ fontWeight: 600, color: 'var(--t1)' }}>{s.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={userId ? filtered.length : 0} perPage={perPage} page={pageSafe} setPage={setPage} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Assignment</button></div>
      </div>
    </div>
  )
}

/* ════════ USER PERMISSION ════════ */
function PermissionTab({ users, permStore, commit, fire }) {
  const [userId, setUserId] = useState('')
  const [working, setWorking] = useState(new Set())
  useEffect(() => { setWorking(new Set(permStore[userId] || [])) }, [userId, permStore])

  const allChecked = UM_MENUS.every((m) => working.has(m))
  const toggle = (menu) => setWorking((w) => { const n = new Set(w); if (n.has(menu)) n.delete(menu); else n.add(menu); return n })
  const toggleAll = (checked) => setWorking(checked ? new Set(UM_MENUS) : new Set())
  const save = () => { if (!userId) return fire('Please select a user first', 'warn'); commit({ ...permStore, [userId]: [...working] }); fire('Permissions updated') }

  return (
    <div className="section-card">
      <div className="card-header"><div className="card-title"><i className="fa-solid fa-shield-halved" /> User Permission</div></div>
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 18 }}>
          <label className="um-label" style={{ display: 'block', marginBottom: 6 }}><i className="fa-solid fa-user" style={{ color: 'var(--brand)', marginRight: 4 }} /> Select User</label>
          <select className="um-user-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select User</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>

        <div className="tbl-wrap">
          <table className="um-perm-table">
            <thead><tr><th style={{ width: 60 }}>Sr.No</th><th>Menu</th><th style={{ width: 140 }}><label className="um-select-all-th"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} disabled={!userId} /> Select All</label></th></tr></thead>
            <tbody>
              {UM_MENUS.map((menu, i) => (
                <tr key={menu}>
                  <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--t1)' }}>{menu}</td>
                  <td><input type="checkbox" checked={working.has(menu)} onChange={() => toggle(menu)} disabled={!userId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Update Status</button></div>
      </div>
    </div>
  )
}

/* ════════ shared bits ════════ */
function Pagination({ total, perPage, page, setPage }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  if (!total) return null
  if (total <= perPage) return <div className="um-pagination"><div className="um-pag-info">Showing 1 to {total} of {total} entries</div></div>
  const start = (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)
  const pages = []
  for (let p = 1; p <= totalPages; p += 1) { if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p); else if (Math.abs(p - page) === 2) pages.push('…') }
  return (
    <div className="um-pagination">
      <div className="um-pag-info">Showing {start} to {end} of {total} entries</div>
      <div className="um-pag-btns">
        <button className="um-pag-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        {pages.map((p, i) => (p === '…' ? <button key={`e${i}`} className="um-pag-btn" disabled>…</button> : <button key={p} className={`um-pag-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>))}
        <button className="um-pag-btn" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  )
}
