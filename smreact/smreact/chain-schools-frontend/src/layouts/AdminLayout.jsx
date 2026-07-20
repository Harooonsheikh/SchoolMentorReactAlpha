import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NAV_SECTIONS, NAV_BY_PATH } from '../config/nav'
import { useAuth } from '../auth/useAuth'
import { useView } from '../config/viewContext'
import ErrorBoundary from '../components/ErrorBoundary'
import '../styles/admin.css'

/* Initials from a name, e.g. "Chain Admin" → "CA". */
const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'CA'

export default function AdminLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const { schools, selectedSchool, isViewOnly, switchToSchool, backToHeadOffice } = useView()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('chain-sidebar-collapsed') === '1')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('chain-theme') === 'dark')

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
  const userName = user?.name || 'Chain Admin'
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
          <div className="logo-name">SCHOOL MENTOR<br />CHAIN ADMIN <span>Multi-School Control Panel</span></div>
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
            <div>
              <div className="sf-name">{userName}</div>
              <div className="sf-role">{user?.role || 'Super Administrator'}</div>
            </div>
          </div>
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
                  selectedSchool={selectedSchool}
                  onClose={() => setSwitcherOpen(false)}
                  onPickSchool={(s) => { switchToSchool(s); setSwitcherOpen(false) }}
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
    </div>
  )
}

/* ═══ School switcher dropdown / mobile drawer ═══ */
function SchoolSwitcher({ schools, selectedSchool, onClose, onPickSchool, onHeadOffice }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return schools
    return schools.filter((x) => x.name.toLowerCase().includes(s) || (x.city || '').toLowerCase().includes(s))
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

        <div className="sw-section-lbl">Connected Schools <span className="sw-count">{schools.length}</span></div>
        <div className="sw-list">
          {list.length === 0 ? <div className="sw-empty">No schools match “{q}”.</div>
            : list.map((s) => {
              const active = selectedSchool?.id === s.id
              return (
                <div key={s.id} className={`sw-row${active ? ' active' : ''}`}>
                  <div className="sw-row-ic"><i className="fa-solid fa-school" /></div>
                  <div className="sw-row-info">
                    <div className="sw-row-name">{s.name}</div>
                    <div className="sw-row-sub"><i className="fa-solid fa-location-dot" /> {s.city} <span className="sw-status"><span className="sw-dot" /> {s.status}</span></div>
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
