import React, { useEffect, useRef, useState } from 'react';
import { SA_CSS } from './saStyles';
import Dashboard from './Dashboard';
import MentorAI from './MentorAI';
import ETube from './ETube';
import SchoolPermissions from './SchoolPermissions';
import SchoolStatus from './SchoolStatus';
import SchoolPayment from './SchoolPayment';
import OperationalSops from './OperationalSops';
import QuizContent from './QuizContent';
import TeacherTrainings from './TeacherTrainings';
import UserManagement from './UserManagement';
import Notifications from './Notifications';
import AgentSupport from '../components/AgentSupport';
import { INITIAL_USERS, INITIAL_PERMS } from './userMgmtData';

/* ═══════════════════════════════════════════════════════════════════
   SUPER ADMIN SHELL

   Self-contained full-screen surface (mounted at #superadmin) ported
   from "Super Admin Support .html". Hosts two modules in the main nav:

     • Mentor AI  — frontend-only screens (Plan Management + Payments)
     • Support    — the existing agent console reused here, framed with
                    Mentor-AI-style inner tabs (Overview + Agent Inbox).
                    Its realtime/backend wiring lives in src/support.

   Light/dark theme is driven by the data-theme attribute on .sa-root.
   ═══════════════════════════════════════════════════════════════════ */

const NAV = [
  { section: 'Overview', items: [
    { id: 'dashboard', name: 'Dashboard', icon: 'fa-gauge-high' },
  ] },
  { section: 'Interface', items: [
    { id: 'etube',       name: 'E-Tube',             icon: 'fa-play-circle', sub: 'HO Video Studio' },
    { id: 'permissions', name: 'School Permissions', icon: 'fa-key' },
    { id: 'status',      name: 'Schools Progress',   icon: 'fa-chart-line' },
    { id: 'payments',    name: 'Schools Payment',    icon: 'fa-credit-card' },
    { id: 'sops',        name: 'Operational SOPs',   icon: 'fa-book-open' },
    { id: 'mentorAI',    name: 'Mentor AI',          icon: 'fa-robot', sub: 'Active module' },
    { id: 'support',     name: 'Support',            icon: 'fa-headset' },
    { id: 'trainings',   name: 'Teachers Training',  icon: 'fa-chalkboard-user' },
    { id: 'quiz',        name: 'Quiz Content',       icon: 'fa-circle-question' },
    { id: 'notifications', name: 'Notifications',    icon: 'fa-bell' },
    { id: 'users',       name: 'User Management',    icon: 'fa-users-gear' },
  ] },
];

const SUPPORT_TABS = [
  { id: 'overview', name: 'Overview',    icon: 'fa-gauge-high' },
  { id: 'inbox',    name: 'Agent Inbox', icon: 'fa-inbox' },
];

const CRUMB = {
  dashboard:   'Dashboard',
  mentorAI:    'Mentor AI Management',
  support:     'Customer Support',
  etube:       'E-Tube',
  permissions: 'School Permissions',
  status:      'Schools Progress',
  payments:    'Schools Payment',
  sops:        'Operational SOPs',
  quiz:        'Quiz Content',
  trainings:     'Teacher Trainings',
  notifications: 'Notifications',
  users:         'User Management',
};

const TOAST_ICON = { success: 'fa-circle-check', info: 'fa-circle-info', warn: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };

export default function SuperAdminShell() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('sa-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch { /* storage blocked — fall back to light */ }
    return 'light';
  });
  const [active, setActive] = useState('dashboard');      // landing module; see NAV for others
  const [supportTab, setSupportTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const seq = useRef(1);

  /* Shared across User Management (edits them) and Dashboard (reads them
     to gate sections by each user's active menu permissions). */
  const [users, setUsers] = useState(INITIAL_USERS);
  const [perms, setPerms] = useState(INITIAL_PERMS);

  const toast = (msg, type = 'info') => {
    const id = seq.current++;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  /* Remember the theme choice across reloads. */
  useEffect(() => { try { localStorage.setItem('sa-theme', theme); } catch { /* ignore */ } }, [theme]);

  const onNav = (id) => {
    if (id === 'dashboard' || id === 'mentorAI' || id === 'support' || id === 'etube' || id === 'permissions' || id === 'status' || id === 'payments' || id === 'sops' || id === 'quiz' || id === 'trainings' || id === 'notifications' || id === 'users') setActive(id);
    else toast(NAV.flatMap((s) => s.items).find((i) => i.id === id)?.name || 'Coming soon', 'info');
    setSidebarOpen(false);
  };

  return (
    <div className="sa-root" data-theme={theme === 'dark' ? 'dark' : undefined}>
      <style>{SA_CSS}</style>

      <div className="app-layout">
        {/* ═════════ SIDEBAR ═════════ */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-logo">
            <div className="logo-icon"><i className="fa-solid fa-shield-halved" /></div>
            <div className="logo-name">SCHOOL MENTOR<br />SUPER ADMIN</div>
          </div>
          <nav className="sidebar-nav">
            {NAV.map((sec) => (
              <React.Fragment key={sec.section}>
                <div className="nav-section-label">{sec.section}</div>
                {sec.items.map((it) => {
                  const isActive = active === it.id;
                  return (
                    <button key={it.id} className={`nav-item${isActive ? ' active' : ''}`} onClick={() => onNav(it.id)}>
                      <div className="nav-iw"><i className={`fa-solid ${it.icon}`} /></div>
                      <div>
                        <div className="nav-nm">{it.name}</div>
                        {isActive ? <div className="nav-st">Active module</div> : it.sub && <div className="nav-st">{it.sub}</div>}
                      </div>
                    </button>
                  );
                })}
                <hr className="nav-divider" />
              </React.Fragment>
            ))}
            <div className="nav-section-label">Account</div>
            <button className="nav-item" onClick={() => toast('Logging out…', 'info')}>
              <div className="nav-iw"><i className="fa-solid fa-arrow-right-from-bracket" /></div>
              <div><div className="nav-nm">Log Out</div></div>
            </button>
          </nav>
        </aside>

        {/* ═════════ MAIN ═════════ */}
        <main className="main-content">
          <header className="topbar">
            <div className="tb-left">
              <button className="hamburger" data-tip="Toggle menu" data-tip-pos="bottom" onClick={() => setSidebarOpen((o) => !o)}><i className="fa-solid fa-bars" /></button>
              <div className="breadcrumb">
                <span className="bc-item">Super Admin</span>
                <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
                <span className="bc-item cur">{CRUMB[active] || 'Super Admin'}</span>
              </div>
            </div>
            <div className="tb-right">
              <button className="theme-btn" data-tip={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} data-tip-pos="bottom" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
                <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
              </button>
              <div className="tb-user" data-tip="Account" data-tip-pos="bottom">
                <div className="tb-avatar">SA</div>
                <span className="tb-uname">Super Admin</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: 10, color: 'var(--tm)' }} />
              </div>
            </div>
          </header>

          {active === 'dashboard' && <Dashboard toast={toast} users={users} perms={perms} />}

          {active === 'mentorAI' && <MentorAI toast={toast} />}

          {active === 'etube' && <ETube toast={toast} />}

          {active === 'permissions' && <SchoolPermissions toast={toast} />}

          {active === 'status' && <SchoolStatus toast={toast} />}

          {active === 'payments' && <SchoolPayment toast={toast} />}

          {active === 'sops' && <OperationalSops toast={toast} />}

          {active === 'quiz' && <QuizContent toast={toast} />}

          {active === 'trainings' && <TeacherTrainings toast={toast} />}

          {active === 'notifications' && <Notifications toast={toast} />}

          {active === 'users' && <UserManagement toast={toast} users={users} setUsers={setUsers} perms={perms} setPerms={setPerms} />}

          {active === 'support' && (
            <div className="page-content">
              <div className="page-header">
                <div className="page-title-row">
                  <div className="page-icon" style={{ background: 'linear-gradient(135deg,#0F766E,#14B8A6)' }}>
                    <i className="fa-solid fa-headset" />
                  </div>
                  <div>
                    <div className="page-title">Customer Support</div>
                    <div className="page-sub">Support console for all schools · Overview &amp; Agent Inbox</div>
                  </div>
                </div>
              </div>

              <div className="app-tabs">
                {SUPPORT_TABS.map((t) => (
                  <button key={t.id} className={`app-tab${supportTab === t.id ? ' active' : ''}`} onClick={() => setSupportTab(t.id)}>
                    <i className={`fa-solid ${t.icon}`} /> {t.name}
                  </button>
                ))}
              </div>

              <div className="sa-support-embed">
                <AgentSupport embedded tab={supportTab} onTab={setSupportTab} />
              </div>
            </div>
          )}
        </main>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setSidebarOpen(false)} />}
      </div>

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}><i className={`fa-solid ${TOAST_ICON[t.type] || TOAST_ICON.info}`} /> {t.msg}</div>
        ))}
      </div>
    </div>
  );
}
