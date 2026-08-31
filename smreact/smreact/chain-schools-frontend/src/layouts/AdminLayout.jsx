import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NAV_SECTIONS, NAV_BY_PATH } from '../config/nav'
import { useAuth } from '../auth/useAuth'
import { useView } from '../config/viewContext'
import { ERP_LOGIN_URL, ERP_URL } from '../config/env'
import { getToken, getStoredUser } from '../auth/tokenStorage'
import ErrorBoundary from '../components/ErrorBoundary'
import '../styles/admin.css'

/* Initials from a name, e.g. "Chain Admin" → "CA". */
const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'CA'

/* "Switch to View" → school ka ERP kholo (View-Only). Network session (token +
   user) aur target branchID ko ERP ke URL hash me bhejte hain; ERP use padh kar
   seedha us branch me View-Only login kar leta hai (dekhein ERP ka index.js
   handoff-in). Koi password/login-API nahi — wahi network token branch ke reads
   ke liye chalta hai. Same tab me jate hain taake Back-to-Chain par chain ka
   apna session (isi origin ki sessionStorage) waise ka waisa mil jaye.
   Dev: ERP :3000 · Prod: VITE_ERP_URL — dono config se (env.js). */
function openSchoolInErp(school) {
  const token = getToken()
  if (!token) { window.location.assign(ERP_LOGIN_URL); return }
  const u = getStoredUser() || {}
  const payload = {
    token,
    branchID:    school.branchId ?? school.id,
    accountType: u.accountType || u.role || 'network',
    displayName: u.displayName || u.name || '',
    userName:    u.userName || '',
    id:          u.id ?? null,
    schoolName:  school.name || '',
  }
  window.location.assign(`${ERP_URL}#sm=${encodeURIComponent(JSON.stringify(payload))}`)
}

export default function AdminLayout() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { schools, schoolsLoading, schoolsError, selectedSchool, isViewOnly, backToHeadOffice } = useView()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('chain-sidebar-collapsed') === '1')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('chain-theme') === 'dark')
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  /* Sign out → session clear karke ERP ke login par wapas. Is portal ka apna
     login form use nahi hota (session ERP se aata hai), is liye /login par
     bhejna user ko ek bemani screen dikhata tha. */
  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      /* Server-side logout fail ho jaye to bhi local session saaf ho chuka —
         user ko yahan rokna bemani hai, aage barho. */
    } finally {
      /* `finally` me: har soorat me ERP par wapas — aur `#logout` ke sath, taake
         agar chain admin kisi school ke ERP me "Switch to View" se gaya tha to us
         ERP-origin ka session bhi saaf ho jaye (dono taraf logout). */
      window.location.replace(`${ERP_LOGIN_URL}#logout`)
    }
  }

  /* Apply + persist theme on the <html> element. */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('chain-theme', dark ? 'dark' : 'light')
  }, [dark])

  /* Persist the desktop sidebar collapsed state. */
  useEffect(() => { localStorage.setItem('chain-sidebar-collapsed', collapsed ? '1' : '0') }, [collapsed])

  /* Close the mobile drawer + switcher whenever the route changes. */
  useEffect(() => { setSidebarOpen(false); setSwitcherOpen(false) }, [location.pathname])

  const current = NAV_BY_PATH[location.pathname]?.label || 'Dashboard'
  /* ERP handoff `displayName` bhejta hai, mock/real API `name` — dono chalein. */
  const userName = user?.displayName || user?.name || 'Chain Admin'
  /* Sidebar ka top: network ka naam. Handoff se aata hai; na mile to
     neutral fallback taake header kabhi khaali na dikhe. */
  const networkName = user?.schoolNetwork || 'School Network'
  const viewingName = isViewOnly ? selectedSchool.name : 'Head Office'

  return (
    <div className={`app-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div
        className={`sidebar-overlay${sidebarOpen ? ' show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon"><i className="fa-solid fa-link" /></div>
          <div className="logo-name" title={networkName}>
            <span className="logo-network">{networkName}</span>
            <span>Chain Admin · Multi-School Control Panel</span>
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setCollapsed(true)} title="Collapse sidebar" aria-label="Collapse sidebar">
            <i className="fa-solid fa-angles-left" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section, i) => (
            <div key={section.label}>
              {i > 0 && <hr className="nav-divider" />}
              <div className="nav-section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  title={item.label}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <div className="nav-iw"><i className={`fa-solid ${item.icon}`} /></div>
                  <div><div className="nav-nm">{item.label}</div></div>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-user">
            <div className="sf-avatar">{initials(userName)}</div>
            <div className="sf-meta">
              <div className="sf-name" title={userName}>{userName}</div>
              <div className="sf-role">{user?.role || 'Super Administrator'}</div>
            </div>
          </div>
          <button className="sf-logout" onClick={() => setLogoutOpen(true)} title="Sign out">
            <i className="fa-solid fa-right-from-bracket" />
            <span className="sf-logout-txt">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="main-content">
        <header className="topbar">
          <div className="tb-left">
            <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu" title="Open menu">
              <i className="fa-solid fa-bars" />
            </button>
            {collapsed && (
              <button className="sidebar-expand-btn" onClick={() => setCollapsed(false)} title="Open sidebar" aria-label="Open sidebar">
                <i className="fa-solid fa-angles-right" />
              </button>
            )}
            <div className="breadcrumb">
              <span className="bc-item">Chain Admin</span>
              <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
              <span className="bc-item cur">{current}</span>
            </div>
            {/* Viewing indicator */}
            <span className={`view-pill${isViewOnly ? ' school' : ''}`} title={`Viewing: ${viewingName}`}>
              <i className={`fa-solid ${isViewOnly ? 'fa-school' : 'fa-building-shield'}`} />
              Viewing: <strong>{viewingName}</strong>
            </span>
          </div>

          <div className="tb-right">
            {isViewOnly && (
              <>
                <span className="vo-badge" title="You are viewing a connected school in read-only mode"><i className="fa-solid fa-lock" /> View Only Mode</span>
                <button className="back-ho-btn" onClick={backToHeadOffice} title="Return to Head Office and restore full access">
                  <i className="fa-solid fa-arrow-left-long" /> Back to Head Office
                </button>
              </>
            )}
            <button className="notif-btn" aria-label="Notifications" title="Notifications">
              <i className="fa-solid fa-bell" /><span className="notif-dot" />
            </button>
            <button className="theme-btn" onClick={() => setDark((d) => !d)} aria-label="Toggle theme" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              <i className={`fa-solid ${dark ? 'fa-sun' : 'fa-moon'}`} />
            </button>

            {/* School switcher */}
            <div className="switcher-wrap">
              <button className={`switcher-btn${isViewOnly ? ' school' : ''}`} onClick={() => setSwitcherOpen((o) => !o)} title={isViewOnly ? `Viewing ${selectedSchool.name} — switch view` : 'Switch into a connected school (view only)'}>
                <span className="sw-ic"><i className={`fa-solid ${isViewOnly ? 'fa-school' : 'fa-building-shield'}`} /></span>
                <span className="sw-txt">{isViewOnly ? selectedSchool.name : 'Head Office'}</span>
                <i className={`fa-solid fa-chevron-down sw-chev${switcherOpen ? ' open' : ''}`} />
              </button>
              {switcherOpen && (
                <SchoolSwitcher
                  schools={schools}
                  schoolsLoading={schoolsLoading}
                  schoolsError={schoolsError}
                  selectedSchool={selectedSchool}
                  onClose={() => setSwitcherOpen(false)}
                  onPickSchool={(s) => { setSwitcherOpen(false); openSchoolInErp(s) }}
                  onHeadOffice={() => { backToHeadOffice(); setSwitcherOpen(false) }}
                />
              )}
            </div>
          </div>
        </header>

        {isViewOnly && (
          <div className="vo-banner">
            <i className="fa-solid fa-circle-info" />
            <span><strong>View Only Mode</strong> — you are viewing <strong>{selectedSchool.name}</strong>. Switch back to Head Office to make changes.</span>
            <button className="vo-banner-btn" onClick={backToHeadOffice}><i className="fa-solid fa-arrow-left-long" /> Back to Head Office</button>
          </div>
        )}

        <div className={`page-content${isViewOnly ? ' view-only' : ''}`}>
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {/* ═══ SIGN-OUT CONFIRM ═══ */}
      {logoutOpen && (
        <div
          className="stg-ov"
          onClick={(e) => { if (e.target === e.currentTarget && !loggingOut) setLogoutOpen(false) }}
        >
          <div className="stg-modal stg-modal-sm" role="dialog" aria-modal="true" aria-label="Sign out">
            <div className="stg-confirm-body">
              <div className="stg-confirm-icon" style={{ background: 'linear-gradient(135deg,#b91c1c,#dc2626)' }}>
                <i className="fa-solid fa-right-from-bracket" />
              </div>
              <div className="stg-confirm-title">Sign out?</div>
              <div className="stg-confirm-sub">
                You’ll be returned to the School Mentor sign-in page. Any unsaved changes will be lost.
              </div>
              <div className="stg-confirm-btns">
                <button className="btn-secondary" onClick={() => setLogoutOpen(false)} disabled={loggingOut}>
                  Cancel
                </button>
                <button className="btn-danger" onClick={handleLogout} disabled={loggingOut}>
                  <i className={`fa-solid ${loggingOut ? 'fa-spinner fa-spin' : 'fa-right-from-bracket'}`} />
                  {loggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ School switcher dropdown / mobile drawer ═══ */
function SchoolSwitcher({ schools, schoolsLoading, schoolsError, selectedSchool, onClose, onPickSchool, onHeadOffice }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return schools
    return schools.filter((x) => x.name.toLowerCase().includes(s) || (x.phone || '').includes(s))
  }, [q, schools])

  return (
    <>
      <div className="switcher-backdrop" onClick={onClose} />
      <div className="switcher-panel" role="dialog" aria-label="Switch school">
        <div className="sw-panel-hdr">
          <div className="sw-panel-title"><i className="fa-solid fa-arrows-rotate" /> Switch View</div>
          <button className="sw-panel-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="sw-search">
          <i className="fa-solid fa-magnifying-glass" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search school or city…" autoFocus />
        </div>

        {/* Head Office option */}
        <div className="sw-section-lbl">Current Mode</div>
        <button className={`sw-row sw-row--ho${!selectedSchool ? ' active' : ''}`} onClick={onHeadOffice}>
          <div className="sw-row-ic ho"><i className="fa-solid fa-building-shield" /></div>
          <div className="sw-row-info">
            <div className="sw-row-name">Head Office</div>
            <div className="sw-row-sub">Chain Admin · Full access</div>
          </div>
          {!selectedSchool ? <span className="sw-row-cur"><i className="fa-solid fa-circle-check" /> Active</span>
            : <span className="sw-row-go">Switch</span>}
        </button>

        <div className="sw-section-lbl">
          Connected Schools
          {!schoolsLoading && !schoolsError && <span className="sw-count">{schools.length}</span>}
        </div>
        <div className="sw-list">
          {schoolsLoading ? <div className="sw-empty"><i className="fa-solid fa-spinner fa-spin" /> Loading schools…</div>
            : schoolsError ? <div className="sw-empty sw-empty--err"><i className="fa-solid fa-triangle-exclamation" /> {schoolsError}</div>
            : list.length === 0 ? <div className="sw-empty">{q ? `No schools match “${q}”.` : 'No schools have joined this network yet.'}</div>
            : list.map((s) => {
              const active = selectedSchool?.id === s.id
              return (
                <div key={s.id} className={`sw-row${active ? ' active' : ''}`}>
                  <div className="sw-row-ic"><i className="fa-solid fa-school" /></div>
                  <div className="sw-row-info">
                    <div className="sw-row-name">{s.name}</div>
                    {/* Phone aur status alag alag line par — aik line me tang lagte the */}
                    <div className="sw-row-sub sw-row-sub--stack">
                      <span><i className="fa-solid fa-phone" /> {s.phone || '—'}</span>
                      <span className="sw-status"><span className="sw-dot" /> {s.status}</span>
                    </div>
                  </div>
                  {active ? <span className="sw-row-cur"><i className="fa-solid fa-eye" /> Viewing</span>
                    : <button className="sw-row-btn" onClick={() => onPickSchool(s)}>Switch to View</button>}
                </div>
              )
            })}
        </div>

        <div className="sw-foot"><i className="fa-solid fa-circle-info" /> Schools open in <strong>View Only Mode</strong>.</div>
      </div>
    </>
  )
}
