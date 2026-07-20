import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  getAllSchools, getDefaultPerms, getSchoolPerms,
  loadPermStore, savePermStore,
  CORE_PERMS, MODULE_SECTIONS, MODULE_KEYS,
} from './data'
import './SchoolPermissions.css'

const SOURCE_BADGE = {
  erp: { cls: 'b-blue', label: 'ERP' },
  inactive: { cls: 'b-gray', label: 'Inactive' },
  launch: { cls: 'b-warn', label: 'Launch' },
}

export default function SchoolPermissions() {
  const allSchools = useMemo(() => getAllSchools(), [])

  const [search, setSearch] = useState('')
  const [erpFilter, setErpFilter] = useState('')
  const [store, setStore] = useState({})
  const [modalSchool, setModalSchool] = useState(null)
  const [toast, setToast] = useState(null)

  /* Seed defaults for any school missing from the saved store. */
  useEffect(() => {
    const s = loadPermStore()
    let changed = false
    allSchools.forEach((sc) => {
      if (!s[sc.id]) { s[sc.id] = getDefaultPerms(sc); changed = true }
    })
    if (changed) savePermStore(s)
    setStore(s)
  }, [allSchools])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allSchools.filter((s) => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || (s.principal || '').toLowerCase().includes(q) || (s.contact || '').includes(q)
      if (!matchQ) return false
      const perms = store[s.id]
      if (!perms) return true
      if (erpFilter === 'active' && !perms.erpAccess) return false
      if (erpFilter === 'inactive' && perms.erpAccess) return false
      return true
    })
  }, [allSchools, store, search, erpFilter])

  const stats = useMemo(() => {
    const total = allSchools.length
    const active = allSchools.filter((s) => store[s.id]?.erpAccess).length
    return { total, active, inactive: total - active }
  }, [allSchools, store])

  const savePerms = (schoolId, perms) => {
    const next = { ...store, [schoolId]: perms }
    setStore(next)
    savePermStore(next)
    const s = allSchools.find((x) => x.id === schoolId)
    setModalSchool(null)
    setToast({ type: 'success', text: `Permissions saved for ${s ? s.name : 'school'}` })
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-key" /></div>
          <div>
            <div className="page-title">School Permissions</div>
            <div className="page-sub">Control ERP access, feature permissions, and module visibility for each school.</div>
          </div>
        </div>
        <TutorialButton />
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><i className="fa-solid fa-school" /></div>
          <div className="stat-val">{stats.total}</div>
          <div className="stat-lbl">Total Schools</div>
        </div>
        <div className="stat-card s-green">
          <div className="stat-icon"><i className="fa-solid fa-circle-check" /></div>
          <div className="stat-val">{stats.active}</div>
          <div className="stat-lbl">ERP Active</div>
        </div>
        <div className="stat-card s-warn">
          <div className="stat-icon"><i className="fa-solid fa-ban" /></div>
          <div className="stat-val">{stats.inactive}</div>
          <div className="stat-lbl">ERP Inactive</div>
        </div>
      </div>

      {/* Table */}
      <div className="section-card">
        <div className="sp-search-bar">
          <div className="f-field-grow">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass" />
              <input className="search-input" placeholder="Search by school name, owner, or contact…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <select className="f-input" value={erpFilter} onChange={(e) => setErpFilter(e.target.value)} style={{ width: 160, height: 38 }}>
            <option value="">All ERP Status</option>
            <option value="active">ERP Active</option>
            <option value="inactive">ERP Inactive</option>
          </select>
        </div>

        <div className="tbl-wrap">
          <table className="sp-table">
            <thead><tr>
              <th style={{ width: 44 }}>#</th>
              <th>School Name</th>
              <th style={{ width: 90 }}>Code / ID</th>
              <th>Owner &amp; Contact</th>
              <th style={{ width: 120, textAlign: 'center' }}>ERP Status</th>
              <th style={{ width: 130, textAlign: 'center' }}>Permissions</th>
              <th style={{ width: 140, textAlign: 'center' }}>Action</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 28, display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>No schools found</div>
                  </td>
                </tr>
              ) : filtered.map((s, idx) => {
                const perms = store[s.id] || getDefaultPerms(s)
                const erpOn = perms.erpAccess
                const modCount = Object.values(perms.modules).filter(Boolean).length
                const totalMods = Object.keys(perms.modules).length
                const sb = SOURCE_BADGE[s.source]
                return (
                  <tr key={s.id}>
                    <td className="td-bold" style={{ color: 'var(--tm)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>
                        <span className={`badge ${sb.cls}`} style={{ fontSize: 9.5 }}>{sb.label}</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{s.schoolCode}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 12.5 }}>{s.principal || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tm)' }}>{s.contact || '—'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {erpOn
                        ? <span className="badge b-green"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Active</span>
                        : <span className="badge b-red"><i className="fa-solid fa-ban" style={{ fontSize: 8 }} /> Inactive</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>{modCount}/{totalMods}</div>
                      <div style={{ fontSize: 10, color: 'var(--tm)' }}>modules on</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-sm" style={{ height: 30, fontSize: 11.5 }} onClick={() => setModalSchool(s)}>
                        <i className="fa-solid fa-sliders" /> Manage
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalSchool && (
        <PermissionsModal
          school={modalSchool}
          perms={getSchoolPerms(store, modalSchool)}
          onClose={() => setModalSchool(null)}
          onSave={savePerms}
        />
      )}

      {toast && createPortal(
        <div className="sp-toast-wrap">
          <div className={`sp-toast ${toast.type}`}>
            <i className="fa-solid fa-circle-check" /> {toast.text}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/* ── Toggle switch ── */
function Switch({ checked, onChange }) {
  return (
    <label className="sw">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="sw-track" />
      <div className="sw-thumb" />
    </label>
  )
}

/* ── Permissions modal ── */
function PermissionsModal({ school, perms, onClose, onSave }) {
  const [erpAccess, setErpAccess] = useState(perms.erpAccess)
  const [transport, setTransport] = useState(perms.transport)
  const [headFee, setHeadFee] = useState(perms.headFee)
  const [modules, setModules] = useState({ ...perms.modules })

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const activeCount = MODULE_KEYS.filter((k) => modules[k]).length
  const inactiveCount = MODULE_KEYS.length - activeCount

  const setModule = (key, val) => setModules((m) => ({ ...m, [key]: val }))
  const toggleAll = (val) => setModules(Object.fromEntries(MODULE_KEYS.map((k) => [k, val])))

  const core = { erpAccess: [erpAccess, setErpAccess], transport: [transport, setTransport], headFee: [headFee, setHeadFee] }

  return createPortal(
    <div className="perm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="perm-modal">
        {/* Header */}
        <div className="pm-hdr">
          <div className="pm-av">{school.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pm-school-name">{school.name}</div>
            <div className="pm-school-meta">
              <span><i className="fa-solid fa-hashtag" style={{ color: 'var(--brand)' }} />{school.schoolCode}</span>
              <span><i className="fa-solid fa-user" style={{ color: 'var(--brand)' }} />{school.principal || '—'}</span>
              <span><i className="fa-solid fa-phone" style={{ color: 'var(--brand)' }} />{school.contact || '—'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--brand)' }}><i className="fa-solid fa-key" /> School Permissions</div>
            <button className="pm-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="pm-body">
          {/* Core permissions */}
          <div className="pm-top-section">
            <div className="pm-top-title"><i className="fa-solid fa-shield-halved" /> Core Permissions</div>
            <div className="pm-top-grid">
              {CORE_PERMS.map((c) => {
                const [val, set] = core[c.key]
                return (
                  <div className={`pm-top-card${val ? ' enabled' : ''}`} key={c.key}>
                    <div className="pm-top-card-top">
                      <div className="pm-top-card-icon"><i className={`fa-solid ${c.icon}`} /></div>
                      <Switch checked={val} onChange={set} />
                    </div>
                    <div className="pm-top-card-name">{c.name}</div>
                    <div className="pm-top-card-desc">{c.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Module permissions */}
          <div>
            <div className="pm-modules-title">
              <i className="fa-solid fa-grip" /> Module Permissions
              <div className="pm-mod-badges">
                <span className="badge b-green">{activeCount} Active</span>
                <span className="badge b-gray">{inactiveCount} Inactive</span>
              </div>
              <button className="btn-sm" style={{ marginLeft: 8, height: 28, fontSize: 11 }} onClick={() => toggleAll(true)}><i className="fa-solid fa-toggle-on" /> All On</button>
              <button className="btn-sm" style={{ height: 28, fontSize: 11, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => toggleAll(false)}><i className="fa-solid fa-toggle-off" /> All Off</button>
            </div>

            {MODULE_SECTIONS.map((sec) => (
              <div key={sec.label}>
                <div className="pm-section-label">{sec.label}</div>
                <div className="pm-mod-grid">
                  {sec.items.map((m) => (
                    <div className={`pm-mod-card${modules[m.key] ? ' enabled' : ''}`} key={m.key}>
                      <div className="pm-mod-icon"><i className={`fa-solid ${m.icon}`} /></div>
                      <div className="pm-mod-name">{m.name}</div>
                      <Switch checked={!!modules[m.key]} onChange={(v) => setModule(m.key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pm-foot">
          <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" onClick={() => onSave(school.id, { erpAccess, transport, headFee, modules })}><i className="fa-solid fa-floppy-disk" /> Save Permissions</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
