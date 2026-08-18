import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  toPermissionRows, getSchoolPerms,
  CORE_PERMS, MODULE_SECTIONS, MODULE_KEYS,
} from './data'
import { useView } from '../../config/viewContext'
import {
  fetchModulePermissions, fetchModulePermissionsEach, saveModulePermissions,
  fetchLaunchSetup, fetchLaunchSetupEach, setLaunchSetup,
  cachedPermissions, cachePermissions,
} from '../../api/schoolPermissionsApi'
import './SchoolPermissions.css'

export default function SchoolPermissions() {
  /* Network me shamil ho chuke schools — Chain-Management API se. */
  const { schools: connectedSchools, schoolsLoading, schoolsError } = useView()
  const allSchools = useMemo(() => toPermissionRows(connectedSchools), [connectedSchools])

  const [search, setSearch] = useState('')
  const [erpFilter, setErpFilter] = useState('')
  /* Dono store isi tab ke cache se shuru hote hain — dobara is screen par
     aane par purani values foran dikhti hain, phir background me taza. */
  /* branchID → modules object (Super-Admin API se). */
  const [store, setStore] = useState(() => cachedPermissions().mods)
  /* branchID → ERP access (launch setup: 1 = on, 0 = off). */
  const [erpStore, setErpStore] = useState(() => cachedPermissions().erp)
  const [modalSchool, setModalSchool] = useState(null)
  /* Manage khulte hi us aik school ki permissions aati hain — tab tak loading. */
  const [modalLoading, setModalLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  /* Table sirf schools ki call par render hoti hai — permissions ka intezaar
     nahi karti. ERP access aur modules uske BAAD background me aate hain
     (cache se jo pehle se maloom ho wo foran dikh jaata hai), har school ki
     row apna jawab aate hi bhar jaati hai. Manage khulne par jo abhi tak na
     aaya ho wo foran mangwa liya jaata hai — dekhein openManage. */
  useEffect(() => {
    let alive = true
    if (!allSchools.length) return undefined
    const ids = allSchools.map((s) => s.id)
    fetchLaunchSetupEach(ids, (id, on) => {
      if (alive) setErpStore((prev) => ({ ...prev, [id]: !!on }))
    }).catch((err) => console.error('ERP access load failed:', err))
    fetchModulePermissionsEach(ids, (id, mods) => {
      if (alive) setStore((prev) => ({ ...prev, [id]: mods }))
    }).catch((err) => console.error('Module permissions load failed:', err))
    return () => { alive = false }
  }, [allSchools])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  /* Dono cheezein Super-Admin API se: ERP access launch-setup se, modules
     module-permission se. */
  const erpOnFor = (s) => !!erpStore[s.id]
  const erpKnown = (s) => Object.prototype.hasOwnProperty.call(erpStore, s.id)
  const modsKnown = (s) => Object.prototype.hasOwnProperty.call(store, s.id)
  const permsFor = (s) => getSchoolPerms(store, s, erpOnFor(s))

  /* Manage — is school ki permissions abhi mangwate hain (aik dafa; baad me
     cache se foran khul jaata hai). ERP access bhi agar background abhi tak
     yahan na pohncha ho to sath hi le aate hain. */
  const openManage = async (school) => {
    setModalSchool(school)
    if (modsKnown(school) && erpKnown(school)) return
    setModalLoading(true)
    try {
      const [mods, erp] = await Promise.all([
        modsKnown(school) ? store[school.id] : fetchModulePermissions(school.id),
        erpKnown(school) ? erpStore[school.id] : fetchLaunchSetup(school.id),
      ])
      setStore((prev) => ({ ...prev, [school.id]: mods }))
      setErpStore((prev) => ({ ...prev, [school.id]: !!erp }))
      cachePermissions(school.id, { modules: mods, erpAccess: !!erp })
    } catch (err) {
      console.error('Permissions load failed:', err)
      setToast({ type: 'error', text: 'Could not load permissions for this school' })
      setModalSchool(null)
    } finally {
      setModalLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allSchools.filter((s) => {
      const matchQ = !q
        || s.name.toLowerCase().includes(q)
        || (s.email || '').toLowerCase().includes(q)
        || (s.contact || '').includes(q)
        || String(s.schoolCode).includes(q)
      if (!matchQ) return false
      /* Jis school ka ERP status abhi load ho raha hai, use filter par
         ghalat khane me nahi daalte — jawab aane tak chhupa dete hain. */
      if (erpFilter) {
        const known = Object.prototype.hasOwnProperty.call(erpStore, s.id)
        if (!known) return false
        if (erpFilter === 'active' && !erpStore[s.id]) return false
        if (erpFilter === 'inactive' && erpStore[s.id]) return false
      }
      return true
    })
  }, [allSchools, erpStore, search, erpFilter])

  /* Inactive un hi schools ka ginte hain jin ka jawab aa chuka hai — warna
     background load ke dauran sab "Inactive" dikhne lagte hain. */
  const stats = useMemo(() => {
    const total = allSchools.length
    const known = allSchools.filter((s) => Object.prototype.hasOwnProperty.call(erpStore, s.id))
    const active = known.filter((s) => erpStore[s.id]).length
    return { total, active, inactive: known.length - active }
  }, [allSchools, erpStore])

  /* Dono Super-Admin API par jaate hain:
       modules    → POST save-modulePermission (type: chain)
       ERP access → PUT  toggle-launch-setup?launchSetup=1|0  */
  const savePerms = async (school, perms) => {
    if (saving) return
    setSaving(true)
    try {
      await saveModulePermissions(school.id, perms.modules)
      setStore((prev) => ({ ...prev, [school.id]: { ...perms.modules } }))
      cachePermissions(school.id, { modules: { ...perms.modules } })

      if (perms.erpAccess !== erpOnFor(school)) {
        await setLaunchSetup(school.id, perms.erpAccess)
        setErpStore((prev) => ({ ...prev, [school.id]: !!perms.erpAccess }))
        cachePermissions(school.id, { erpAccess: !!perms.erpAccess })
      }
      setModalSchool(null)
      setToast({ type: 'success', text: `Permissions saved for ${school.name}` })
    } catch (err) {
      console.error('Permissions save failed:', err)
      setToast({ type: 'error', text: err?.message || 'Could not save permissions' })
    } finally {
      setSaving(false)
    }
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
              <th>Email &amp; Contact</th>
              <th style={{ width: 120, textAlign: 'center' }}>ERP Status</th>
              <th style={{ width: 130, textAlign: 'center' }}>Permissions</th>
              <th style={{ width: 140, textAlign: 'center' }}>Action</th>
            </tr></thead>
            <tbody>
              {schoolsLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, display: 'block', margin: '0 auto 12px', color: 'var(--brand)' }} />
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>Loading schools…</div>
                  </td>
                </tr>
              ) : schoolsError ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 44, color: 'var(--err)' }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 26, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{schoolsError}</div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 28, display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>No schools found</div>
                  </td>
                </tr>
              ) : filtered.map((s, idx) => {
                const perms = permsFor(s)
                const erpOn = erpOnFor(s)
                const erpReady = erpKnown(s)
                const modsReady = modsKnown(s)
                const modCount = Object.values(perms.modules).filter(Boolean).length
                const totalMods = MODULE_KEYS.length
                return (
                  <tr key={s.id}>
                    <td className="td-bold" style={{ color: 'var(--tm)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>
                        <span className="badge b-blue" style={{ fontSize: 9.5 }}>Connected</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{s.schoolCode}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 12.5 }}>{s.email || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tm)' }}>{s.contact || '—'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {/* Background load — jawab aate hi asli status. */}
                      {!erpReady
                        ? <span className="badge b-gray"><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 8 }} /> Loading</span>
                        : erpOn
                          ? <span className="badge b-green"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Active</span>
                          : <span className="badge b-red"><i className="fa-solid fa-ban" style={{ fontSize: 8 }} /> Inactive</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {/* Count background load se bharta hai — tab tak spinner. */}
                      {modsReady ? (
                        <>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>{modCount}/{totalMods}</div>
                          <div style={{ fontSize: 10, color: 'var(--tm)' }}>modules on</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tm)' }}>
                            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 10 }} /> /{totalMods}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--tm)' }}>modules on</div>
                        </>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-sm" style={{ height: 30, fontSize: 11.5 }} onClick={() => openManage(s)}>
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

      {modalSchool && modalLoading && createPortal(
        <div className="perm-ov">
          <div className="perm-modal" style={{ maxWidth: 380, padding: 40, textAlign: 'center' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 26, color: 'var(--brand)' }} />
            <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 700 }}>Loading permissions…</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--tm)' }}>{modalSchool.name}</div>
          </div>
        </div>,
        document.body,
      )}

      {modalSchool && !modalLoading && (
        <PermissionsModal
          school={modalSchool}
          perms={permsFor(modalSchool)}
          saving={saving}
          onClose={() => setModalSchool(null)}
          onSave={savePerms}
        />
      )}

      {toast && createPortal(
        <div className="sp-toast-wrap">
          <div className={`sp-toast ${toast.type}`}>
            <i className={`fa-solid ${toast.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} /> {toast.text}
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
function PermissionsModal({ school, perms, saving, onClose, onSave }) {
  const [erpAccess, setErpAccess] = useState(perms.erpAccess)
  const [modules, setModules] = useState({ ...perms.modules })

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const activeCount = MODULE_KEYS.filter((k) => modules[k]).length
  const inactiveCount = MODULE_KEYS.length - activeCount

  const setModule = (key, val) => setModules((m) => ({ ...m, [key]: val }))
  const toggleAll = (val) => setModules(Object.fromEntries(MODULE_KEYS.map((k) => [k, val])))

  const core = { erpAccess: [erpAccess, setErpAccess] }

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
              <span><i className="fa-solid fa-envelope" style={{ color: 'var(--brand)' }} />{school.email || '—'}</span>
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
          <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={() => onSave(school, { erpAccess, modules })}>
            {saving
              ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</>
              : <><i className="fa-solid fa-floppy-disk" /> Save Permissions</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
