import React, { useEffect, useRef, useState } from 'react';
import { SA_CSS } from './saStyles';
import Dashboard from './Dashboard';
import MentorAI from './MentorAI';
import ETube from './ETube';
import NetworkPermissions from './NetworkPermissions';
import SchoolPermissions from './SchoolPermissions';
import SchoolStatus from './SchoolStatus';
import SchoolPayment from './SchoolPayment';
import OperationalSops from './OperationalSops';
import QuizContent from './QuizContent';
import TeacherTrainings from './TeacherTrainings';
import UserManagement from './UserManagement';
import Notifications from './Notifications';
import AgentSupport from '../components/AgentSupport';
import TechModule from './TechModule';
import { PermissionsProvider } from './adminPermissions/AdminPermissionsContext';
import { SaPermsProvider, useSaPerms } from './saPerms';
import { effectivePermsFromRows, isHeadUser } from './permissionModel';
import { INITIAL_USERS, INITIAL_PERMS, UM_MENUS } from './userMgmtData';
import { authApi, moduleAccessApi } from './api';
import { installSessionGuard, setSessionGuardActive } from './api/sessionGuard';
import SupportBackgroundListener from '../support/SupportBackgroundListener';
import { requestSupportNotificationPermission } from '../support/notification';
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
    { id: 'networkPermissions', name: 'Network Permissions', icon: 'fa-network-wired' },
    { id: 'permissions', name: 'School Permissions', icon: 'fa-key' },
    { id: 'status',      name: 'Schools Progress',   icon: 'fa-chart-line' },
    { id: 'payments',    name: 'Schools Payment',    icon: 'fa-credit-card' },
    { id: 'sops',        name: 'Policy Manuals',     icon: 'fa-book-open' },
    { id: 'mentorAI',    name: 'Mentor AI',          icon: 'fa-robot', sub: 'Active module' },
    { id: 'support',     name: 'Support',            icon: 'fa-headset' },
    { id: 'techModule',  name: 'Tech Module',        icon: 'fa-list-check', sub: 'Bugs & new development' },
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

/* Support tab strip + embedded console. A child of <SaPermsProvider> so it can read the
   logged-in user's User Permission matrix: tabs without View are hidden, and a hidden
   current tab falls back to the first visible one. */
function SupportTabsBody({ supportTab, setSupportTab }) {
  const P = useSaPerms('support');
  const tabs = SUPPORT_TABS.filter((t) => P.canView(t.id));
  const active = tabs.some((t) => t.id === supportTab) ? supportTab : (tabs[0]?.id || null);
  if (!active) {
    return <div className="db-block"><i className="fa-solid fa-lock" /><div className="db-block-ttl">You don't have permission to view this</div></div>;
  }
  return (
    <>
      <div className="app-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`app-tab${active === t.id ? ' active' : ''}`} onClick={() => setSupportTab(t.id)}>
            <i className={`fa-solid ${t.icon}`} /> {t.name}
          </button>
        ))}
      </div>

      <div className="sa-support-embed">
        <AgentSupport embedded tab={active} onTab={(id) => { if (P.canView(id)) setSupportTab(id); }} />
      </div>
    </>
  );
}

const CRUMB = {
  dashboard:   'Dashboard',
  mentorAI:    'Mentor AI Management',
  support:     'Customer Support',
  etube:       'E-Tube',
  networkPermissions: 'Network Permissions',
  permissions: 'School Permissions',
  status:      'Schools Progress',
  payments:    'Schools Payment',
  sops:        'Policy Manuals',
  quiz:        'Quiz Content',
  trainings:     'Teacher Trainings',
  notifications: 'Notifications',
  users:         'User Management',
  techModule:    'Tech Module',
};

const TOAST_ICON = { success: 'fa-circle-check', info: 'fa-circle-info', warn: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };

/* "Aisha Khan" → "AK", "Super Admin" → "SA". */
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SA';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/* `user`/`onLogout` come from App when the console runs standalone behind its
   own sign-in. Embedded in a host app both are absent — the header falls back
   to the generic label and the Log Out item is hidden. */
export default function SuperAdminShell({ user, onLogout }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('sa-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch { /* storage blocked — fall back to light */ }
    return 'light';
  });
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [active, setActive] = useState('dashboard');      // landing module; see NAV for others
  const [supportTab, setSupportTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const seq = useRef(1);

  /* Shared across User Management (edits them) and Dashboard (reads them
     to gate sections by each user's active menu permissions). */
  const [users, setUsers] = useState(INITIAL_USERS);
  const [perms, setPerms] = useState(INITIAL_PERMS);

  /* Asli users — GET /api/Auth/get-all-users. API na chale to demo list rehti hai.
     Naye ids ke liye (abhi permission API nahi) poora menu access seed karo,
     warna Dashboard "view as" me un ke saare sections chhup jate. */
  const reloadUsers = async () => {
    try {
      const rows = await authApi.listUsers();
      const mapped = rows.map((u) => ({
        id: u.id, fullName: u.name, firstName: u.firstName, lastName: u.lastName,
        userName: u.userName, phone: u.userName, address: '',
        active: u.isActive !== false, pic: '', isAdmin: u.isAdmin, signUpDateTime: u.signUpDateTime,
      }));
      setUsers(mapped);
      setPerms((prev) => {
        const next = { ...prev };
        mapped.forEach((u) => { if (!next[u.id]) next[u.id] = [...UM_MENUS]; });
        return next;
      });
      return mapped;
    } catch (err) {
      console.warn('[superadmin] get-all-users failed — keeping current list', err);
      return null;
    }
  };
  useEffect(() => { reloadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sidebar access — logged-in user ki saved permissions (Auth get-superadmin-module-permission).
     null = koi record nahi / host-embedded → saare modules (full access by default). */
  const [navAllowed, setNavAllowed] = useState(null);
  /* Pehla get chalne tak sidebar khali (loader) — warna login ke baad ek pal ke
     liye saare modules dikh kar phir chhupte. */
  const [accessLoading, setAccessLoading] = useState(true);
  /* Screen × action permissions of the logged-in user (null = full access). */
  const [myPerms, setMyPerms] = useState(null);
  const meIsHead = useRef(false);
  const loadMyAccess = async () => {
    const me = user?.id ? Number(user.id) : authApi.currentUserId();
    if (!me) { setNavAllowed(null); setAccessLoading(false); return; }
    /* Head (login ka isAdmin = true) → hamesha poori access; User Permission lagu nahi. */
    let headFlag = null;
    try { headFlag = sessionStorage.getItem('superadminisadmin'); } catch { /* ignore */ }
    if (String(headFlag).toLowerCase() === 'true') {
      setNavAllowed(null); setMyPerms(null); setAccessLoading(false); return;
    }
    try {
      const rec = await moduleAccessApi.getModuleAccess(me);
      if (meIsHead.current) return;   // Head — users list ne pehle hi poori access de di
      setNavAllowed(moduleAccessApi.allowedNavIds(rec?.flags || null));
      setMyPerms(rec ? effectivePermsFromRows(rec.flags, rec.rows) : null);
    } catch (err) {
      console.warn('[superadmin] module access load failed — showing all modules', err);
      setNavAllowed(null);
      setMyPerms(null);
    } finally {
      setAccessLoading(false);
    }
  };
  /* Fallback: login response me isAdmin na aaya ho to get-all-users se — Head → poori access. */
  useEffect(() => {
    const me = user?.id ? Number(user.id) : authApi.currentUserId();
    const mine = users.find((u) => Number(u.id) === me);
    meIsHead.current = Boolean(mine && isHeadUser(mine));
    if (meIsHead.current) { setNavAllowed(null); setMyPerms(null); setAccessLoading(false); }
  }, [users, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Login ke baad (aur reload par) — GET /api/Auth/get-superadmin-module-permission-byuserid/{id}. */
  useEffect(() => { setAccessLoading(true); loadMyAccess(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* User Permission save hua aur woh khud logged-in user tha → sidebar foran taza. */
  const onPermsSaved = (uid) => {
    const me = user?.id ? Number(user.id) : authApi.currentUserId();
    if (Number(uid) === me) loadMyAccess();
  };
  const canSee = (id) => !accessLoading && (!navAllowed || navAllowed.has(id));
  /* Page sirf tab render ho jab access load ho chuka aur module allowed ho. */
  const view = canSee(active) ? active : null;
  const visibleNav = NAV
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => canSee(it.id)) }))
    .filter((sec) => sec.items.length);

  /* Khula module ab allowed nahi → pehle allowed module par le jao. */
  useEffect(() => {
    if (!navAllowed || navAllowed.has(active)) return;
    const first = NAV.flatMap((s) => s.items).find((it) => navAllowed.has(it.id));
    if (first) setActive(first.id);
  }, [navAllowed]); // eslint-disable-line react-hooks/exhaustive-deps

  const toast = (msg, type = 'info') => {
    const id = seq.current++;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  /* Remember the theme choice across reloads. */
  useEffect(() => { try { localStorage.setItem('sa-theme', theme); } catch { /* ignore */ } }, [theme]);

  /* Session guard (bilkul ERP jaisa): login ke baad agar sessionStorage se
     superadminid / superadmintoken ghaayab ho jayein — ya server 401 de — to
     "session ended" toast dikha kar seedha login screen. Shell unmount hone
     par pehredaari band, kyunke login screen par session hoti hi nahi.
     Toast ko ~1.4s milta hai us se pehle ke onLogout shell ko utha le. */
  const logoutRef = useRef(onLogout);
  logoutRef.current = onLogout;
  useEffect(() => {
    if (!onLogout) return undefined;          // host-embedded: token host deta hai
    const stop = installSessionGuard({
      onExpired: () => {
        toast('Your session has ended. Please log in again.', 'error');
        setTimeout(() => { try { logoutRef.current?.(); } catch { /* ignore */ } }, 1400);
      },
    });
    return () => { setSessionGuardActive(false); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(onLogout)]);

const onNav = (id) => {
  if (!canSee(id)) { toast('You do not have access to this module', 'warn'); return; }
  if (id === 'support') {
    requestSupportNotificationPermission();
  }

  if (
    id === 'dashboard' ||
    id === 'mentorAI' ||
    id === 'support' ||
    id === 'etube' ||
    id === 'networkPermissions' ||
    id === 'permissions' ||
    id === 'status' ||
    id === 'payments' ||
    id === 'sops' ||
    id === 'quiz' ||
    id === 'trainings' ||
    id === 'notifications' ||
    id === 'users' ||
    id === 'techModule'
  ) {
    setActive(id);
  } else {
    toast(
      NAV.flatMap((s) => s.items).find((i) => i.id === id)?.name ||
        'Coming soon',
      'info'
    );
  }

  setSidebarOpen(false);
};

  return (
    <PermissionsProvider>
    <SaPermsProvider perms={myPerms}>
    <div className="sa-root" data-theme={theme === 'dark' ? 'dark' : undefined}>
      <SupportBackgroundListener
  enabled={true}
  onUnreadChange={setSupportUnreadCount}
/>
      <style>{SA_CSS}</style>
<style>{SA_CSS}</style>

<style>{`
  .support-notification-badge {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #ef4444;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    box-shadow: 0 0 0 2px #ffffff;
  }
`}</style>
      <div className="app-layout">
        {/* ═════════ SIDEBAR ═════════ */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-logo">
            <div className="logo-icon"><i className="fa-solid fa-shield-halved" /></div>
            <div className="logo-name">SCHOOL MENTOR<br />SUPER ADMIN</div>
          </div>
          <nav className="sidebar-nav">
            {accessLoading && (
              <div style={{ padding: '18px 16px', fontSize: 12, color: 'var(--tm)' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} /> Loading modules…
              </div>
            )}
            {visibleNav.map((sec) => (
              <React.Fragment key={sec.section}>
                <div className="nav-section-label">{sec.section}</div>
                {sec.items.map((it) => {
                  const isActive = active === it.id;
                  return (
                    <button key={it.id} className={`nav-item${isActive ? ' active' : ''}`} onClick={() => onNav(it.id)}>
                      <div className="nav-iw"><i className={`fa-solid ${it.icon}`} /></div>
                    <div style={{ flex: 1 }}>
  <div
    className="nav-nm"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    }}
  >
    <span>{it.name}</span>

    {it.id === 'support' && supportUnreadCount > 0 && (
      <span className="support-notification-badge">
        {supportUnreadCount > 99 ? '99+' : supportUnreadCount}
      </span>
    )}
  </div>

  {isActive ? (
    <div className="nav-st">Active module</div>
  ) : (
    it.sub && <div className="nav-st">{it.sub}</div>
  )}
</div>
                    </button>
                  );
                })}
                <hr className="nav-divider" />
              </React.Fragment>
            ))}
            {onLogout && (
              <>
                <div className="nav-section-label">Account</div>
                <button className="nav-item" onClick={onLogout}>
                  <div className="nav-iw"><i className="fa-solid fa-arrow-right-from-bracket" /></div>
                  <div><div className="nav-nm">Log Out</div></div>
                </button>
              </>
            )}
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
                <div className="tb-avatar">{initials(user?.name)}</div>
                <span className="tb-uname">{user?.name || 'Super Admin'}</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: 10, color: 'var(--tm)' }} />
              </div>
            </div>
          </header>

          {view === 'dashboard' && <Dashboard toast={toast} users={users} perms={perms} />}

          {view === 'mentorAI' && <MentorAI toast={toast} />}

          {view === 'etube' && <ETube toast={toast} />}

          {view === 'networkPermissions' && <NetworkPermissions toast={toast} />}

          {view === 'permissions' && <SchoolPermissions toast={toast} />}

          {view === 'status' && <SchoolStatus toast={toast} />}

          {view === 'payments' && <SchoolPayment toast={toast} />}

          {view === 'sops' && <OperationalSops toast={toast} />}

          {view === 'quiz' && <QuizContent toast={toast} />}

          {view === 'trainings' && <TeacherTrainings toast={toast} />}

          {view === 'notifications' && <Notifications toast={toast} />}

          {view === 'users' && <UserManagement toast={toast} users={users} setUsers={setUsers} reloadUsers={reloadUsers} setPerms={setPerms} onPermsSaved={onPermsSaved} />}

          {view === 'techModule' && <TechModule toast={toast} users={users} />}

          {view === 'support' && (
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

              <SupportTabsBody supportTab={supportTab} setSupportTab={setSupportTab} />
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
    </SaPermsProvider>
    </PermissionsProvider>
  );
}
