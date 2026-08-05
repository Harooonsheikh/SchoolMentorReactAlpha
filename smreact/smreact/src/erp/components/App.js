import React, { lazy, Suspense, useEffect, useState } from 'react';
import Tooltip from './Tooltip';
import RouteFallback from '../shared/RouteFallback';
// eslint-disable-next-line no-unused-vars
import ComingSoon from '../shared/ComingSoon';
import { SettingsProvider, TopbarSessionPill } from '../pages/Settings/settingsStore';
import { useModules } from '../context/ModuleContext';
import { usePermissions } from '../context/PermissionsContext';
import { NAV_TO_MODULE_MAP, MODULE_REGISTRY } from '../config/moduleConfig';
import { logout, goToLaunchSetup } from '../utils/auth';
import { buildUrl, installSessionGuard, setSessionGuardActive, registerSessionToast, resolveMediaUrl } from '../../utils/apiConfig';
import * as profileService from '../services/profileService';
import SupportWidget from '../../components/SupportWidget';
import erpExtraCss from './erpExtraCss';

/* Registry module id → uska label (API menuName se match karta hai). */
const MODULE_ID_TO_LABEL = Object.fromEntries(MODULE_REGISTRY.map((m) => [m.id, m.label]));

/* Extra modules that are shown ONLY on the master branch (branchID === 1) and
   stay hidden on every other branch. On branch 1 they still respect the user's
   role/permission. Keyed by sidebar nav id. */
const BRANCH1_ONLY_NAV = new Set(['inventory', 'crm', 'audit', 'appraisal', 'sops', 'trainings', 'etube', 'chat', 'notifications']);

/* ─── Code-split each ERP module ─────────────────────────────────────
   React.lazy() wraps each module so its JS chunk is fetched only when
   the user navigates to that module. Combined with the <Suspense
   fallback={…}> wrappers below this keeps the initial bundle small
   while the rest of the app loads on demand. The chunk naming comment
   (/* webpackChunkName */ /*) gives each chunk a stable name in the
   build output so the backend team can later configure caching /
   pre-fetching per module without UI changes.
   ──────────────────────────────────────────────────────────────────── */
const Academics      = lazy(() => import(/* webpackChunkName: "mod-academics" */     './Academics'));
const Examination    = lazy(() => import(/* webpackChunkName: "mod-examination" */   './Examination.jsx'));
const PaperGenerator = lazy(() => import(/* webpackChunkName: "mod-papergen" */      './PaperGenerator.jsx'));
const Attendance     = lazy(() => import(/* webpackChunkName: "mod-attendance" */    './Attendance.jsx'));
const TimeTable      = lazy(() => import(/* webpackChunkName: "mod-timetable" */     './TimeTable.jsx'));
const Fee            = lazy(() => import(/* webpackChunkName: "mod-fee" */           './Fee.jsx'));
const Accounts       = lazy(() => import(/* webpackChunkName: "mod-accounts" */      './Accounts.jsx'));
const Inventory      = lazy(() => import(/* webpackChunkName: "mod-inventory" */     './Inventory.jsx'));
const AdmissionCrm   = lazy(() => import(/* webpackChunkName: "mod-admissioncrm" */  './AdmissionCrm.jsx'));
const Students       = lazy(() => import(/* webpackChunkName: "mod-students" */      './Students.jsx'));
const HumanResource  = lazy(() => import(/* webpackChunkName: "mod-hr" */            './HumanResource.jsx'));
const StaffAppraisalPage = lazy(() => import(/* webpackChunkName: "mod-appraisal" */ './StaffAppraisalPage.jsx'));
const SettingsModule = lazy(() => import(/* webpackChunkName: "mod-settings" */      '../pages/Settings/SettingsModule.jsx'));
const SchoolSOPs     = lazy(() => import(/* webpackChunkName: "mod-sops" */          '../pages/SchoolMentor/SchoolSOPs.jsx'));
const TeacherTrainings = lazy(() => import(/* webpackChunkName: "mod-trainings" */    '../pages/SchoolMentor/TeacherTrainings.jsx'));
const ETube          = lazy(() => import(/* webpackChunkName: "mod-etube" */         '../pages/SchoolMentor/ETube.jsx'));
const Chat           = lazy(() => import(/* webpackChunkName: "mod-chat" */          '../pages/SchoolMentor/Chat.jsx'));
const Notifications  = lazy(() => import(/* webpackChunkName: "mod-notifications" */ '../pages/SchoolMentor/Notifications.jsx'));
const UserPermissions  = lazy(() => import(/* webpackChunkName: "mod-permissions" */  '../pages/UserPermissions/UserPermissions.jsx'));
const AuditLogs        = lazy(() => import(/* webpackChunkName: "mod-auditlogs"   */  '../pages/AuditLogs/AuditLogs.jsx'));
const LaunchSetup      = lazy(() => import(/* webpackChunkName: "mod-launchsetup" */  '../pages/LaunchSetup/LaunchSetup.jsx'));
const Dashboard        = lazy(() => import(/* webpackChunkName: "mod-dashboard"   */  '../pages/Dashboard/Dashboard.jsx'));

/* ProfileModal is only mounted when the user opens "My Profile" from
   the avatar menu. Lazy-loading keeps its ~630 lines out of the initial
   shell bundle until the modal is actually requested. */
const ProfileModal   = lazy(() => import(/* webpackChunkName: "mod-profile" */       './ProfileModal'));

const NAV_LABELS = {
  dashboard: 'Dashboard',
  acad: 'Academics',
  exam: 'Examination',
  att: 'Attendance',
  tt: 'Timetable',
  paper: 'Paper Generator',
  fee: 'Fee',
  accounts: 'Accounts',
  inventory: 'Inventory',
  students: 'Students',
  hr: 'Human Resource',
  appraisal: 'Staff Appraisals',
  crm: 'Admission CRM',
  sops: 'School SOPs',
  trainings: 'Teacher Trainings',
  etube: 'e-Tube',
  chat: 'Chat',
  notifications: 'Notifications',
  launch: 'Launch Setup',
  settings: 'Settings',
  perm: 'User Permissions',
  audit: 'Audit Logs',
  feedback: 'Feedback',
};

const NAV_SECTIONS = [
  {
    /* Dashboard sits at the very top — no section heading, no divider above */
    label: '',
    items: [
      { id: 'dashboard', name: 'Dashboard', icon: 'fa-house' },
    ],
  },
  {
    label: 'Academics',
    items: [
      { id: 'acad',  name: 'Academics',       icon: 'fa-book-open-reader' },
      { id: 'exam',  name: 'Examination',     icon: 'fa-file-pen' },
      { id: 'paper', name: 'Paper Generator', icon: 'fa-file-circle-check' },
      { id: 'att',   name: 'Attendance',      icon: 'fa-calendar-check' },
      { id: 'tt',    name: 'Timetable',      icon: 'fa-clock' },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { id: 'fee',       name: 'Fee',       icon: 'fa-money-bill-wave' },
      { id: 'accounts',  name: 'Accounts',  icon: 'fa-landmark' },
      { id: 'inventory', name: 'Inventory', icon: 'fa-boxes-stacked' },   /* branchID 1 only */
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'crm',       name: 'Admission CRM',  icon: 'fa-user-plus' },   /* branchID 1 only */
      { id: 'students',  name: 'Students',       icon: 'fa-user-graduate' },
      { id: 'hr',        name: 'Human Resource', icon: 'fa-users' },
      { id: 'appraisal', name: 'Staff Appraisals', icon: 'fa-star' },     /* branchID 1 only */
    ],
  },
  {
    label: 'School Mentor',
    items: [
      { id: 'sops',          name: 'School SOPs',       icon: 'fa-book-open' },          /* branchID 1 only */
      { id: 'trainings',     name: 'Teacher Trainings', icon: 'fa-chalkboard-user' },   /* branchID 1 only */
      { id: 'etube',         name: 'e-Tube',            icon: 'fa-play-circle' },        /* branchID 1 only */
      { id: 'chat',          name: 'Chat',              icon: 'fa-comments' },           /* branchID 1 only */
      { id: 'notifications', name: 'Notifications',     icon: 'fa-bell' },               /* branchID 1 only */
      // Feedback has no route block yet — keep hidden until it's wired.
      // { id: 'feedback',  name: 'Feedback',          icon: 'fa-comment-dots' },
    ],
  },
  {
    label: 'Basics',
    items: [
      { id: 'launch',   name: 'Launch Setup',     icon: 'fa-rocket' },
      { id: 'audit',    name: 'Audit Logs',       icon: 'fa-clipboard-list' },   /* branchID 1 only */
      { id: 'settings', name: 'Settings',         icon: 'fa-gear' },
      { id: 'perm',     name: 'User Permissions', icon: 'fa-shield-halved' },
    ],
  },
];

export default function App() {
  const [theme, setTheme] = useState('light');
  /* Active ERP module localStorage me yaad rakho — refresh par usi module par wapas
     aao (default 'acad' = Academics). */
  const [active, setActive] = useState(() => {
    try { return sessionStorage.getItem('erp_active_module') || 'acad'; }
    catch (e) { return 'acad'; }
  });
  /* Jab bhi module badle, sessionStorage me save — agli refresh isay padh legi.
     (sessionStorage: sirf isi tab ke liye, tab band hote hi apne aap clear.) */
  useEffect(() => {
    try { sessionStorage.setItem('erp_active_module', active); } catch (e) { /* ignore */ }
  }, [active]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  /* Branch header (name, logo, address) for the sidebar top — same API the
     reports use. */
  const [branchInfo, setBranchInfo] = useState(null);
  useEffect(() => {
    const branchId = sessionStorage.getItem('branchID');
    if (!branchId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(buildUrl(`/report-header/${branchId}`), { headers: { Accept: '*/*' } });
        const json = await res.json();
        if (!cancelled && json?.success) setBranchInfo(json.data || null);
      } catch (e) { console.error('Error loading branch header:', e); }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Logged-in user for the sidebar footer. */
  const userName = sessionStorage.getItem('displayName') || sessionStorage.getItem('userName') || 'User';
  const userRole = sessionStorage.getItem('accountType') || 'User';
  const userInitials = userName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

  /* The user's profile photo (empImage) for the sidebar avatar — same source as
     the My Profile dialog. Empty / failed → the initials fallback shows. */
  const [userPhoto, setUserPhoto] = useState('');
  useEffect(() => {
    let cancelled = false;
    profileService.getProfile()
      .then(p => { if (!cancelled && p?.photo) setUserPhoto(p.photo); })
      .catch(() => { /* keep initials */ });
    return () => { cancelled = true; };
  }, []);

  /* ─── Module activation engine ───
     Sidebar nav items + section headings are filtered through this.
     Items without a backing module registry entry (e.g. 'dashboard',
     'feedback') always render — only registry-backed nav ids are
     gated. Core-locked modules (Settings / Launch Setup / Audit
     Logs / User Permissions) always render regardless of state
     because ModuleContext.toggleModule() refuses to flip them off. */
  const { isActive: isModuleActive, ready: modulesReady } = useModules();
  /* Logged-in user ki module-level access (School Head → sab allowed; warna API
     permissions ke hisaab se). Jis module me koi access nahi, wo nav se hat jata hai. */
  const { canModule, fullAccess, ready: permsReady } = usePermissions();
  const navItemVisible = (navId) => {
    /* Jab tak school ka module-activation aur user ki permissions dono na
       aa jayen, koi bhi nav item render nahi hota. Warna jo module off hai
       wo pehle paint par ek pal ke liye dikh kar phir ghayab hota hai. */
    if (!modulesReady || !permsReady) return false;
    /* Master-branch-only extras: hidden on every branch except branchID 1. On
       branch 1 they still follow the user's permission (registry-backed ones)
       or simply show (non-permission extras like Chat / e-Tube / Notifications). */
    if (BRANCH1_ONLY_NAV.has(navId)) {
      if (String(sessionStorage.getItem('branchID')) !== '1') return false;
      const gmod = NAV_TO_MODULE_MAP[navId];
      const glabel = gmod ? MODULE_ID_TO_LABEL[gmod] : null;
      return glabel ? (fullAccess || canModule(glabel)) : true;
    }
    const modId = NAV_TO_MODULE_MAP[navId];
    if (!modId) {
      /* Registry-backed nahi (Dashboard/Feedback). Dashboard ab role/user
         permission se bhi mil sakta hai (MODULE_TREE me "Dashboard" module
         hai), is liye: full-access users ko hamesha, aur baqi users ko tab
         jab unki permissions me Dashboard granted ho. Granted na ho to
         chhupa rahega — pehle jaisa. */
      if (navId === 'dashboard') return fullAccess || canModule('Dashboard');
      return true;
    }
    if (!isModuleActive(modId)) return false; /* school ne module off kiya hua */
    const label = MODULE_ID_TO_LABEL[modId];
    return label ? canModule(label) : true;   /* user ki permission ke hisaab se */
  };

  /* Permissions load hone ke baad, agar current/persisted module is user ko
     visible hi nahi (e.g. default 'acad' but Academics ki access nahi), to
     pehle visible nav item par bhej do — warna sidebar me hidden module ka
     content khul jata hai. */
  useEffect(() => {
    /* Dono cheezein aa jayen — user permissions aur school ka module
       activation — warna hum aise module par redirect kar dete hain jo
       response aane ke baad khud hidden ho jata hai. */
    if (!permsReady || !modulesReady) return;
    if (navItemVisible(active)) return;
    for (const section of NAV_SECTIONS) {
      const found = section.items.find((it) => navItemVisible(it.id));
      if (found) { setActive(found.id); return; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsReady, modulesReady, active]);

  /* ── Academics tab state (lifted so the topbar breadcrumb stays in sync) ── */
  const [l1, setL1] = useState('sos');      // 'sos' | 'lp'
  const [l2, setL2] = useState('tb');       // 'tb'  | 'terms' | 'cal'
  const [l3, setL3] = useState('ac');       // 'ac'  | 'act'

  const L2_LABELS = { tb: 'Text Books', terms: 'Term Settings', cal: 'Calendars' };
  const L3_LABELS = { ac: 'Academic Calendar', act: 'Activity Calendar' };
  const currentScreen =
    l1 === 'lp' ? 'Lesson Plans'
      : l2 === 'cal' ? L3_LABELS[l3]
      : L2_LABELS[l2];

  const pushToast = (msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  /* Session guard: if the login session is cleared (token / branchID removed
     from sessionStorage), the next API action anywhere in the ERP shows a
     "session ended" toast and bounces the user to the login screen. Installed
     once — it wraps window.fetch, so every module is covered without changes.
     The toast is given ~1.4s to show before logout() unmounts the ERP. */
  useEffect(() => {
    registerSessionToast(pushToast);
    installSessionGuard({
      onExpired: () => {
        pushToast('Your session has ended. Please log in again.', 'error');
        setTimeout(() => { try { logout(); } catch (e) { /* ignore */ } }, 1400);
      },
    });
    // Disable enforcement when the ERP unmounts (login/signup screens have no
    // session yet and must not be blocked).
    return () => setSessionGuardActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // On unmount (leaving the ERP screen), reset the theme so the ERP's dark
    // mode doesn't leak onto the setup/login screen.
    return () => { document.documentElement.setAttribute('data-theme', 'light'); };
  }, [theme]);

  useEffect(() => {
    document.body.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    document.body.style.margin = '0';
    document.body.style.background = 'var(--bg-base)';
    document.body.style.color = 'var(--text-primary)';
    // While the ERP screen is shown, the tab title reads "ERP".
    document.title = 'School Mentor - ERP';
    // Clear the inline body styles on unmount so the setup/login screen's own
    // stylesheet (globals.css) controls the body again.
    return () => {
      document.body.style.fontFamily = '';
      document.body.style.background = '';
      document.body.style.color = '';
      document.title = 'School Mentor';
    };
  }, []);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  return (
    <SettingsProvider>
      <style>{CSS}</style>
      <style>{erpExtraCss}</style>

      <div className="app-layout">
        {/* ═════════ SIDEBAR ═════════ */}
        <aside className={`sidebar${mobileOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
          <div className="sidebar-logo">
            <div className="logo-icon" style={branchInfo?.branchLogo ? { overflow: 'hidden', background: '#fff' } : undefined}>
              {branchInfo?.branchLogo ? (
                <img src={resolveMediaUrl(branchInfo.branchLogo)} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect width="36" height="36" fill="url(#smg1)" />
                <defs>
                  <linearGradient id="smg1" x1="0" y1="0" x2="36" y2="36">
                    <stop stopColor="#1a237e" />
                    <stop offset="1" stopColor="#283593" />
                  </linearGradient>
                </defs>
                <path d="M18 10C14 10 10 11.5 10 11.5L10 26C10 26 14 24.5 18 24.5C22 24.5 26 26 26 26L26 11.5C26 11.5 22 10 18 10Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
                <path d="M18 10L18 24.5" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
                <path d="M13 9L15 6L18 8L21 6L23 9" stroke="#FCD34D" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="15" x2="17" y2="14.2" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
                <line x1="12" y1="18" x2="17" y2="17.2" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
                <line x1="19" y1="14.2" x2="24" y2="15" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
                <line x1="19" y1="17.2" x2="24" y2="18" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
              </svg>
              )}
            </div>
            <div className="logo-name">
              <div>{branchInfo?.branchName || 'The Oxford System, Lahore Campus'}</div>
              {branchInfo?.address && (
                <div style={{ fontSize: 9.5, fontWeight: 500, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{branchInfo.address}</div>
              )}
            </div>
            <Tooltip text={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
              <button
                className="sidebar-collapse-btn"
                onClick={() => setCollapsed(c => !c)}
                aria-label="Toggle sidebar"
              >
                <i className="fa-solid fa-chevron-left" id="collapseIcon"></i>
              </button>
            </Tooltip>
          </div>

          <nav className="sidebar-nav">
            {/* Modules/permissions load hone tak halka placeholder — khaali
                sidebar se behtar, aur off-module ka flash bhi nahi hota. */}
            {(!modulesReady || !permsReady) && (
              <div className="nav-loading" aria-busy="true" aria-label="Loading modules">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="nav-skel" />
                ))}
              </div>
            )}
            {NAV_SECTIONS.map((section, sIdx) => {
              /* Filter to only the items whose backing module is
                 active. Items without a registry mapping (e.g.
                 Dashboard, Feedback) always pass through. */
              const visibleItems = section.items.filter(it => navItemVisible(it.id));
              if (visibleItems.length === 0) return null;
              return (
              <React.Fragment key={section.label || `sec-${sIdx}`}>
                {sIdx > 0 && <div className="nav-divider"></div>}
                {section.label && <div className="nav-section-lbl">{section.label}</div>}
                {visibleItems.map(item => {
                  /* Show "Active" under whichever module is currently open;
                     fall back to any static sub-label the item defines. */
                  const isActive = active === item.id;
                  const subLabel = isActive ? 'Active' : item.sub;
                  return (
                  <button
                    key={item.id}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    data-tooltip={item.name}
                    onClick={() => {
                      // "Launch Setup" lives in the separate setup app (port 3000)
                      if (item.id === 'launch') { goToLaunchSetup(); return; }
                      setActive(item.id); setMobileOpen(false);
                    }}
                  >
                    <div className="nav-iw"><i className={`fa-solid ${item.icon}`}></i></div>
                    {subLabel ? (
                      <div>
                        <div className="nav-nm">{item.name}</div>
                        <div className="nav-st">{subLabel}</div>
                      </div>
                    ) : (
                      <div className="nav-nm">{item.name}</div>
                    )}
                    {item.badge && (
                      <div className={`nav-bx ${item.badge.tone}`}>
                        {item.badge.iconClass
                          ? <i className={`fa-solid ${item.badge.iconClass}`}></i>
                          : item.badge.text}
                      </div>
                    )}
                  </button>
                  );
                })}
              </React.Fragment>
              );
            })}
          </nav>

          <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="user-av" style={{ overflow: 'hidden', position: 'relative' }}>
              {/* Initials are the base; the photo (if any) overlays them and, if it
                  fails to load, hides itself so the initials show through. */}
              {userInitials}
              {userPhoto && (
                <img
                  src={resolveMediaUrl(userPhoto)}
                  alt={userName}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </div>
              <div style={{ fontSize: 9.5, color: '#9CA3AF' }}>{userRole}</div>
            </div>
          </div>

          <div className="quick-bar">
            <Tooltip text="Open your profile to view or update details">
              <button className="qb-btn" onClick={() => setProfileOpen(true)}>
                <i className="fa-solid fa-user-pen" style={{ fontSize: 11 }}></i> My Profile
              </button>
            </Tooltip>
            <Tooltip text="Sign out of the ERP">
              <button className="qb-btn danger" onClick={() => setLogoutOpen(true)}>
                <i className="fa-solid fa-right-from-bracket" style={{ fontSize: 11 }}></i> Sign Out
              </button>
            </Tooltip>
          </div>
        </aside>

        {/* ═════════ MAIN ═════════ */}
        <div className={`main-content${collapsed ? ' collapsed' : ''}`}>
          {/* TOPBAR */}
          <header className="topbar">
            <div className="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tooltip text={mobileOpen ? 'Close menu' : 'Open menu'} placement="bottom">
                <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)}>
                  <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
                </button>
              </Tooltip>
              <span className="bc-item">Home</span>
              {active === 'acad' && <>
                <i className="fa-solid fa-chevron-right bc-sep"></i>
                <span className="bc-item">Academics</span>
                {l1 === 'sos' && (
                  <>
                    <i className="fa-solid fa-chevron-right bc-sep"></i>
                    <span className="bc-item">Scheme of Studies</span>
                  </>
                )}
                <i className="fa-solid fa-chevron-right bc-sep"></i>
                <span className="bc-current">{currentScreen}</span>
              </>}
              {active !== 'acad' && (() => {
                const lbl = NAV_LABELS[active] || 'Page';
                return <>
                  <i className="fa-solid fa-chevron-right bc-sep"></i>
                  <span className="bc-current">{lbl}</span>
                </>;
              })()}
            </div>
            <div className="topbar-right" style={{ gap: 10 }}>
              <TopbarSessionPill />
              {/* Global Customer Support chat — trigger on every ERP screen; the
                  chat window + attachment modals portal to <body> (bottom-right). */}
              <SupportWidget />
              <Tooltip text={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} placement="bottom">
                <button className="tb-btn theme-btn" onClick={toggleTheme}>
                  <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                </button>
              </Tooltip>
            </div>
          </header>

          {/* PAGE CONTENT —
              Each lazy module is rendered inside its own <Suspense>
              boundary so a slow chunk fetch never blanks the rest of
              the shell. The fallback's label is module-specific so the
              user sees what is being loaded. */}
          <main className="page-content">
            {active === 'acad' && (
              <Suspense fallback={<RouteFallback label="Loading Academics…" />}>
                <Academics
                  l1={l1} setL1={setL1}
                  l2={l2} setL2={setL2}
                  l3={l3} setL3={setL3}
                  toast={pushToast}
                />
              </Suspense>
            )}
            {active === 'exam' && (
              <Suspense fallback={<RouteFallback label="Loading Examination…" />}>
                <Examination toast={pushToast} />
              </Suspense>
            )}
            {active === 'paper' && (
              <Suspense fallback={<RouteFallback label="Loading Paper Generator…" />}>
                <PaperGenerator toast={pushToast} />
              </Suspense>
            )}
            {active === 'att' && (
              <Suspense fallback={<RouteFallback label="Loading Attendance…" />}>
                <Attendance onToast={pushToast} />
              </Suspense>
            )}
            {active === 'tt' && (
              <Suspense fallback={<RouteFallback label="Loading Timetable…" />}>
                <TimeTable toast={pushToast} />
              </Suspense>
            )}
            {active === 'fee' && (
              <Suspense fallback={<RouteFallback label="Loading Fee…" />}>
                <Fee toast={pushToast} />
              </Suspense>
            )}
            {active === 'accounts' && (
              <Suspense fallback={<RouteFallback label="Loading Accounts…" />}>
                <Accounts toast={pushToast} />
              </Suspense>
            )}
            {active === 'inventory' && (
              <Suspense fallback={<RouteFallback label="Loading Inventory…" />}>
                <Inventory toast={pushToast} />
              </Suspense>
            )}
            {active === 'crm' && (
              <Suspense fallback={<RouteFallback label="Loading Admission CRM…" />}>
                <AdmissionCrm toast={pushToast} />
              </Suspense>
            )}
            {active === 'students' && (
              <Suspense fallback={<RouteFallback label="Loading Students…" />}>
                <Students toast={pushToast} />
              </Suspense>
            )}
            {active === 'hr' && (
              <Suspense fallback={<RouteFallback label="Loading Human Resource…" />}>
                <HumanResource toast={pushToast} />
              </Suspense>
            )}
            {active === 'appraisal' && (
              <Suspense fallback={<RouteFallback label="Loading Staff Appraisals…" />}>
                <StaffAppraisalPage toast={pushToast} />
              </Suspense>
            )}
            {active === 'settings' && (
              <Suspense fallback={<RouteFallback label="Loading Settings…" />}>
                <SettingsModule toast={pushToast} />
              </Suspense>
            )}
            {active === 'sops' && (
              <Suspense fallback={<RouteFallback label="Loading School SOPs…" />}>
                <SchoolSOPs toast={pushToast} />
              </Suspense>
            )}
            {active === 'trainings' && (
              <Suspense fallback={<RouteFallback label="Loading Teacher Trainings…" />}>
                <TeacherTrainings toast={pushToast} />
              </Suspense>
            )}
            {active === 'etube' && (
              <Suspense fallback={<RouteFallback label="Loading e-Tube…" />}>
                <ETube toast={pushToast} />
              </Suspense>
            )}
            {active === 'chat' && (
              <Suspense fallback={<RouteFallback label="Loading Chat…" />}>
                <Chat toast={pushToast} onUnreadChange={() => {}} />
              </Suspense>
            )}
            {active === 'notifications' && (
              <Suspense fallback={<RouteFallback label="Loading Notifications…" />}>
                <Notifications toast={pushToast} />
              </Suspense>
            )}
            {active === 'perm' && (
              <Suspense fallback={<RouteFallback label="Loading User Permissions…" />}>
                <UserPermissions toast={pushToast} />
              </Suspense>
            )}
            {active === 'audit' && (
              <Suspense fallback={<RouteFallback label="Loading Audit Logs…" />}>
                <AuditLogs toast={pushToast} />
              </Suspense>
            )}
            {active === 'launch' && (
              <Suspense fallback={<RouteFallback label="Loading Launch Setup…" />}>
                <LaunchSetup toast={pushToast} />
              </Suspense>
            )}
            {active === 'dashboard' && (
              <Suspense fallback={<RouteFallback label="Loading Dashboard…" />}>
                <Dashboard
                  toast={pushToast}
                  navigate={setActive}
                  /* Drop the user straight onto Academics → Scheme of
                     Studies → Calendar → Activity Calendar so the
                     Upcoming Activities cards land in context. */
                  openActivityCalendar={() => {
                    setL1('sos');
                    setL2('cal');
                    setL3('act');
                    setActive('acad');
                  }}
                />
              </Suspense>
            )}
            {active !== 'acad' && active !== 'exam' && active !== 'paper' && active !== 'att' && active !== 'tt' && active !== 'fee' && active !== 'accounts' && active !== 'inventory' && active !== 'crm' && active !== 'students' && active !== 'hr' && active !== 'appraisal' && active !== 'settings' && active !== 'sops' && active !== 'trainings' && active !== 'etube' && active !== 'chat' && active !== 'notifications' && active !== 'perm' && active !== 'audit' && active !== 'launch' && active !== 'dashboard' && (
              <NavComingSoon label={NAV_LABELS[active] || 'This module'} />
            )}
          </main>
        </div>

        {/* Mobile sidebar backdrop */}
        <div
          className={`mobile-overlay${mobileOpen ? ' open' : ''}`}
          onClick={() => setMobileOpen(false)}
        ></div>

        {/* Toast container */}
        <div className="toast-container">
          {toasts.map(t => <Toast key={t.id} {...t} />)}
        </div>

        {/* ═════════ PROFILE MODAL (lazy-loaded on first open) ═════════ */}
        {/* The lazy ProfileModal chunk is fetched only when the user
            first opens the My Profile dialog. We keep <Suspense> mounted
            so that subsequent open/close cycles re-use the already-fetched
            chunk without re-suspending. The fallback is intentionally a
            no-op fragment because the modal is overlay-only — there is
            nothing visible to fall back into while the chunk loads. */}
        {profileOpen && (
          <Suspense fallback={null}>
            <ProfileModal
              open={profileOpen}
              onClose={() => setProfileOpen(false)}
              toast={pushToast}
            />
          </Suspense>
        )}

        {/* ═════════ LOGOUT DIALOG ═════════ */}
        <div
          className={`modal-overlay${logoutOpen ? ' open' : ''}`}
          onClick={e => { if (e.target === e.currentTarget) setLogoutOpen(false); }}
        >
          <div className="modal modal-sm">
            <div className="modal-header">
              <div>
                <div className="modal-title" style={{ color: 'var(--error)' }}>
                  <i className="fa-solid fa-right-from-bracket" style={{ marginRight: 8 }}></i>
                  Sign out?
                </div>
                <div className="modal-sub">Confirm before leaving your workspace</div>
              </div>
              <button className="modal-close" onClick={() => setLogoutOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="logout-card">
                <div className="logout-icon">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                  <div className="logout-heading">You are about to sign out</div>
                  <div className="logout-sub">
                    You'll be returned to the sign-in screen. Any unsaved work in open
                    tabs will be lost.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setLogoutOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { setLogoutOpen(false); logout(); }}>
                <i className="fa-solid fa-right-from-bracket"></i> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </SettingsProvider>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   COMING SOON — placeholder for nav items that aren't ported yet.
   Uses design-system tokens via .nav-coming-soon class (see CSS block
   at the bottom of this file) so dark mode + responsive padding behave
   consistently with the rest of the ERP shell.
   ───────────────────────────────────────────────────────────────────────── */
function NavComingSoon({ label }) {
  return (
    <section
      className="nav-coming-soon"
      role="status"
      aria-live="polite"
      aria-label={`${label} — coming soon`}
    >
      <div className="nav-cs-icon" aria-hidden="true">
        <i className="fa-solid fa-clock-rotate-left"></i>
      </div>
      <h1 className="nav-cs-title">{label} — Coming Soon</h1>
      <p className="nav-cs-desc">
        This module will be ported in a future sprint. For now, the navigation entry is reserved.
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────────────────────────── */
function Toast({ msg, type }) {
  const icons = { success: 'fa-check', error: 'fa-xmark', info: 'fa-circle-info' };
  const bg = { success: 'rgba(22,163,74,.1)', error: 'rgba(239,68,68,.1)', info: 'rgba(59,130,246,.1)' };
  const fg = { success: '#16A34A', error: '#DC2626', info: '#0284C7' };
  return (
    <div className="toast">
      <div className="toast-icon" style={{ background: bg[type], color: fg[type] }}>
        <i className={`fa-solid ${icons[type]}`}></i>
      </div>
      <span style={{ flex: 1 }}>{msg}</span>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────
   Styles — extracted verbatim from
   ~/Desktop/ERP-html/Complete Academics and Examination.html
   (sidebar, topbar, modals, dark theme, responsive breakpoints) and
   ~/Desktop/Rough Work/school-mentor-phase2 (14).html
   (sidebar collapse + .prof-* / .pwd-* / .otp-* / .pass-* profile modal)
   ───────────────────────────────────────────────────────────────────────── */
const CSS = `
:root {
  --brand-primary:   #1E3A8A;
  --brand-dark:      #1E40AF;
  --brand-deeper:    #1D4ED8;
  --brand-light:     #DBEAFE;
  --brand-mid:       #2563EB;
  --bg-base:         #F0F4FF;
  --bg-card:         #FFFFFF;
  --bg-muted:        #EFF6FF;
  --text-primary:    #0F172A;
  --text-secondary:  #1E3A5F;
  --text-muted:      #64748B;
  --success:         #16A34A;
  --warning:         #D97706;
  --error:           #DC2626;
  --info:            #0284C7;
  --border-light:    #BFDBFE;
  --border-med:      #93C5FD;
  --shadow-xs:       0 1px 2px rgba(0,0,0,.06);
  --shadow-sm:       0 2px 6px rgba(30,58,138,.18), 0 1px 2px rgba(0,0,0,.05);
  --shadow-md:       0 4px 14px rgba(30,58,138,.20), 0 2px 4px rgba(0,0,0,.06);
  --shadow-lg:       0 10px 30px rgba(30,58,138,.22), 0 4px 8px rgba(0,0,0,.07);
  --shadow-xl:       0 20px 50px rgba(30,58,138,.20), 0 8px 16px rgba(0,0,0,.08);
  --radius-sm:       6px;
  --radius-md:       10px;
  --radius-lg:       14px;
  --radius-xl:       20px;
  --radius-full:     9999px;
  --font-display:    'Instrument Serif', serif;
  --font-body:       'Plus Jakarta Sans', sans-serif;
  --tr:              all .2s cubic-bezier(.4,0,.2,1);
  --input-bg:        #FFFFFF;
  --sidebar-w:       240px;
  --topbar-h:        60px;
}

[data-theme="dark"] {
  --bg-base:      #080D1A;
  --bg-card:      #0E1628;
  --bg-muted:     #131F38;
  --bg-sidebar:   #080D1A;
  --input-bg:     #0E1628;
  --text-primary:   #E2E8F8;
  --text-secondary: #B8C8E8;
  --text-muted:     #6B82A8;
  --brand-primary:  #3B82F6;
  --brand-dark:     #2563EB;
  --brand-light:    #1E3A6A;
  --brand-mid:      #3B82F6;
  --border-light:   #1C2E50;
  --border-med:     #243858;
  --shadow-xs: 0 1px 3px rgba(0,0,0,.5);
  --shadow-sm: 0 2px 8px rgba(0,0,0,.4), 0 1px 2px rgba(0,0,0,.3);
  --shadow-md: 0 4px 16px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.3);
  --shadow-lg: 0 10px 32px rgba(0,0,0,.55), 0 4px 8px rgba(0,0,0,.3);
  --shadow-xl: 0 20px 56px rgba(0,0,0,.6), 0 8px 16px rgba(0,0,0,.4);
}

* { box-sizing: border-box; }
body { margin:0; font-family:var(--font-body); background:var(--bg-base); color:var(--text-primary); }
[data-theme="dark"] body { background:var(--bg-base); }
[data-theme="dark"] .page-content { background:#070C19; }

button { font-family:var(--font-body); }

/* ═══ LAYOUT ═══ */
.app-layout { display:flex; min-height:100vh; overflow-x:hidden; }
.main-content { margin-left: var(--sidebar-w); flex:1; display:flex; flex-direction:column; min-height:100vh; min-width:0; max-width:100%; overflow-x:hidden; }
.page-content { padding:24px 28px; flex:1; background:#F8FAFC; min-height:calc(100vh - var(--topbar-h)); overflow-x:hidden; }

/* ═══ TOPBAR ═══ */
.topbar {
  background: rgba(255,255,255,.98); border-bottom:1px solid #E8EEFF;
  padding:0 28px; height:var(--topbar-h);
  display:flex; align-items:center; justify-content:space-between;
  position:sticky; top:0; z-index:100;
  backdrop-filter:blur(8px); box-shadow:0 1px 0 #F0F4FF;
}
.breadcrumb { display:flex; align-items:center; gap:7px; font-size:12.5px; }
.bc-item { color:var(--text-muted); cursor:pointer; }
.bc-item:hover { color:var(--brand-primary); }
.bc-sep { color:var(--border-light); font-size:9px; }
.bc-current { color:var(--text-primary); font-weight:600; }
.topbar-right { display:flex; align-items:center; gap:8px; }
.topbar-school {
  display:flex; align-items:center; gap:10px; padding:6px 14px;
  border-radius:var(--radius-full); background:var(--bg-muted);
  border:1px solid var(--border-light); cursor:pointer;
}
.school-av { width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#1a237e,#283593);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;flex-shrink:0; }
.school-name { font-size:12.5px;font-weight:800;color:var(--text-primary);white-space:nowrap; }
.school-yr { font-size:10px;color:var(--text-muted); }
.tb-btn {
  height:34px; border-radius:9px; border:1px solid var(--border-light);
  background:transparent; color:var(--text-secondary);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer; font-size:12px; font-family:var(--font-body);
  font-weight:600; gap:6px; padding:0 12px; transition:var(--tr);
}
.tb-btn:hover { background:var(--bg-muted); color:var(--brand-primary); border-color:rgba(30,58,138,.3); }
.tb-btn.theme-btn { font-size:14px; padding:0; width:34px; }

[data-theme="dark"] .topbar {
  background:rgba(8,13,26,.96);
  border-color:var(--border-light);
  box-shadow:0 1px 0 #131F38;
}
[data-theme="dark"] .topbar-school {
  background:var(--bg-muted);
  border-color:var(--border-light);
}
[data-theme="dark"] .tb-btn {
  border-color:var(--border-light);
  color:var(--text-secondary);
}
[data-theme="dark"] .tb-btn:hover {
  background:var(--bg-muted);
  color:var(--brand-primary);
}
[data-theme="dark"] .mobile-menu-btn {
  border-color:var(--border-light);
  background:var(--bg-muted);
  color:var(--text-secondary);
}

/* Tutorial button (outlined blue, animated play dot) */
.tutorial-btn {
  display:flex; align-items:center; gap:10px;
  background:rgba(30,64,175,.15);
  border:2px solid #1E40AF; border-radius:var(--radius-full);
  padding:8px 18px 8px 8px; color:#1E40AF; font-size:13px; font-weight:700;
  cursor:pointer; font-family:var(--font-body); letter-spacing:.01em;
  box-shadow:0 2px 10px rgba(30,58,138,.12);
  transition:all .25s cubic-bezier(.4,0,.2,1);
  position:relative; overflow:hidden;
  white-space:nowrap; flex-shrink:0;
}
.tutorial-label { line-height:1; }
.tutorial-btn::before {
  content:''; position:absolute; inset:0;
  background:linear-gradient(105deg,transparent 30%,rgba(30,64,175,.08) 50%,transparent 70%);
  transform:translateX(-100%); transition:transform .5s ease;
}
.tutorial-btn:hover::before { transform:translateX(100%); }
.tutorial-btn:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(30,58,138,.22); background:rgba(30,64,175,.05); }
.tutorial-btn:active { transform:scale(.97) translateY(0); }

.play-dot {
  width:28px; height:28px; border-radius:50%;
  background:rgba(30,64,175,.1);
  display:flex; align-items:center; justify-content:center;
  font-size:9px; flex-shrink:0; position:relative;
}
.play-dot::before {
  content:''; position:absolute; inset:-4px;
  border-radius:50%;
  border:2px solid rgba(30,64,175,.3);
  animation:playRingPulse 2s ease infinite;
}
.play-dot::after {
  content:''; position:absolute; inset:-9px;
  border-radius:50%;
  border:1.5px solid rgba(30,64,175,.12);
  animation:playRingPulse 2s ease .4s infinite;
}
@keyframes playRingPulse {
  0%   { transform:scale(.85); opacity:1; }
  60%  { transform:scale(1.3);  opacity:0; }
  100% { transform:scale(1.3);  opacity:0; }
}
.play-dot i { animation:playIconBounce 1.8s ease infinite; position:relative; z-index:1; }
@keyframes playIconBounce {
  0%,100% { transform:scale(1) translateX(0); }
  40%     { transform:scale(1.15) translateX(1px); }
  70%     { transform:scale(.95) translateX(0); }
}
.page-tutorial-btn { flex-shrink:0; }

/* Dark mode */
body.dark .tutorial-btn {
  background:rgba(59,130,246,.12);
  border-color:#3B82F6; color:#3B82F6;
  box-shadow:0 2px 10px rgba(59,130,246,.15);
}
body.dark .tutorial-btn:hover {
  background:rgba(59,130,246,.08);
  box-shadow:0 8px 22px rgba(59,130,246,.25);
}
body.dark .play-dot { background:rgba(59,130,246,.15); }
body.dark .play-dot::before { border-color:rgba(59,130,246,.35); }
body.dark .play-dot::after  { border-color:rgba(59,130,246,.15); }

/* ═══ SIDEBAR ═══ */
.sidebar {
  width:var(--sidebar-w); background:var(--bg-card);
  border-right:1px solid #E8EEFF;
  display:flex;flex-direction:column;
  position:fixed;top:0;left:0;bottom:0;z-index:200;
  overflow:visible; box-shadow:2px 0 16px rgba(30,58,138,.06);
  transition: width .25s cubic-bezier(.4,0,.2,1);
}
.sidebar-logo { padding:14px 16px;border-bottom:1px solid #F0F4FF;display:flex;align-items:center;gap:10px;position:relative; }
.logo-icon { width:36px;height:36px;border-radius:10px;overflow:hidden;flex-shrink:0; }
.logo-name { font-size:11.5px;font-weight:800;color:var(--text-primary);line-height:1.3; }
.sidebar-nav { flex:1;padding:6px 8px;overflow-y:auto; }
.nav-section-lbl { font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:#C0CADD;padding:10px 10px 4px;font-weight:700; }
.nav-divider { height:1px;background:#F0F4FF;margin:4px 0; }
/* Sidebar skeleton — modules/permissions load hone tak. */
.nav-loading { padding:6px 2px; }
.nav-skel {
  height:34px;border-radius:var(--radius-md);margin-bottom:6px;
  background:linear-gradient(90deg,#F1F5FB 25%,#E7EDF7 37%,#F1F5FB 63%);
  background-size:400% 100%;animation:navSkel 1.2s ease-in-out infinite;
}
@keyframes navSkel { 0%{background-position:100% 50%} 100%{background-position:0 50%} }
@media (prefers-reduced-motion: reduce) { .nav-skel { animation:none; } }
[data-theme="dark"] .nav-skel {
  background:linear-gradient(90deg,var(--bg-hover) 25%,var(--border-light) 37%,var(--bg-hover) 63%);
  background-size:400% 100%;
}
.nav-item {
  display:flex;align-items:center;gap:9px;padding:8px 10px;
  border-radius:var(--radius-md);cursor:pointer;transition:var(--tr);
  margin-bottom:1px;position:relative;border:none;width:100%;
  background:transparent;text-align:left;
}
.nav-item:hover .nav-iw { background:#DBEAFE;color:#1E40AF; }
.nav-item:hover .nav-nm { color:#1E40AF; }
.nav-item.active { background:linear-gradient(135deg,#EEF4FF,#DBEAFE); }
.nav-item.active::before { content:'';position:absolute;left:0;top:18%;bottom:18%;width:3px;background:linear-gradient(180deg,#1E40AF,#1E3A8A);border-radius:0 3px 3px 0; }
.nav-item.active .nav-iw { background:linear-gradient(135deg,#DBEAFE,#BFDBFE);color:#1E40AF; }
.nav-item.active .nav-nm { color:#1E40AF;font-weight:700; }
.nav-iw { width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#F3F4F6;font-size:12px;color:#9CA3AF;flex-shrink:0;transition:var(--tr); }
.nav-nm { font-size:12.5px;font-weight:500;color:#374151;white-space:nowrap;transition:color .2s; }
.nav-st { font-size:9.5px;color:#9CA3AF;margin-top:1px; }
.nav-bx { min-width:18px;height:18px;border-radius:50%;font-size:8.5px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:auto; }
.nav-bx.blue { background:linear-gradient(135deg,#2563EB,#1E3A8A);color:#fff;box-shadow:0 2px 8px rgba(30,58,138,.4); }
.nav-bx.red  { background:linear-gradient(135deg,#EF4444,#DC2626);color:#fff; }
.nav-bx.green{ background:rgba(22,163,74,.12);color:#16A34A;font-size:7px; }
.sidebar-footer { padding:10px 12px;border-top:1px solid #F0F4FF;background:#FAFBFF;cursor:pointer; }
.user-av { width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1a237e,#283593);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex-shrink:0; }
.quick-bar { display:flex;gap:6px;padding:8px 12px 12px;background:#FAFBFF;border-top:1px solid #F0F4FF; }
.qb-btn { flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;border-radius:var(--radius-md);border:1.5px solid var(--border-light);background:var(--bg-card);color:var(--text-secondary);font-family:var(--font-body);font-size:11.5px;font-weight:600;cursor:pointer;transition:var(--tr); }
.qb-btn:hover { background:var(--brand-light);border-color:var(--brand-primary);color:var(--brand-primary); }
.qb-btn.danger { border-color:rgba(220,38,38,.2);background:rgba(220,38,38,.04);color:var(--error); }
.qb-btn.danger:hover { background:rgba(220,38,38,.1);border-color:var(--error); }

/* ═══ SIDEBAR COLLAPSE BUTTON ═══ */
.sidebar-collapse-btn {
  position:absolute; right:10px; top:18px;
  width:26px; height:26px; border-radius:7px;
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  color:var(--text-muted);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:9px; z-index:10;
  transition:var(--tr);
}
.sidebar-collapse-btn:hover {
  background:var(--brand-light); color:var(--brand-primary);
  border-color:var(--border-med);
}
.sidebar-collapse-btn i { transition: transform .25s cubic-bezier(.4,0,.2,1); }
[data-theme="dark"] .sidebar-collapse-btn {
  background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted);
}

/* ═══ COLLAPSED SIDEBAR STATE ═══ */
.sidebar.collapsed { width:62px; }
.sidebar.collapsed .logo-name,
.sidebar.collapsed .nav-nm,
.sidebar.collapsed .nav-st,
.sidebar.collapsed .nav-bx,
.sidebar.collapsed .nav-section-lbl,
.sidebar.collapsed .nav-divider,
.sidebar.collapsed .quick-bar,
.sidebar.collapsed .sidebar-footer > div:last-child { display:none !important; }
.sidebar.collapsed .sidebar-logo {
  flex-direction:column; align-items:center; justify-content:center;
  padding:12px 0; gap:8px;
}
.sidebar.collapsed .sidebar-collapse-btn {
  position:static; width:28px; height:28px; border-radius:8px;
}
.sidebar.collapsed .sidebar-collapse-btn i { transform:rotate(180deg); }
.sidebar.collapsed .nav-item { padding:9px; justify-content:center; gap:0; }
.sidebar.collapsed .nav-item > div:not(.nav-iw) { display:none; }
.sidebar.collapsed .nav-iw { width:34px; height:34px; border-radius:10px; margin:0; }
.sidebar.collapsed .sidebar-nav { padding:6px 7px; }
.sidebar.collapsed .sidebar-footer { padding:10px; justify-content:center; }
.sidebar.collapsed .user-av { width:34px; height:34px; }
.main-content.collapsed { margin-left:62px; }
.main-content { transition: margin-left .25s cubic-bezier(.4,0,.2,1); }

/* Tooltip in collapsed mode */
.sidebar.collapsed .nav-item { position:relative; }
.sidebar.collapsed .nav-item::after {
  content: attr(data-tooltip);
  position:absolute; left:100%; top:50%; transform:translateY(-50%);
  background:#1E3A8A; color:#fff;
  font-size:11px; font-weight:600;
  padding:5px 10px; border-radius:7px;
  white-space:nowrap; opacity:0; pointer-events:none;
  margin-left:10px;
  box-shadow:var(--shadow-md);
  transition:opacity .15s ease;
  z-index:999;
}
.sidebar.collapsed .nav-item.active::before { content:none !important; }
.sidebar.collapsed .nav-item:hover::after { opacity:1; }

[data-theme="dark"] .sidebar {
  background:var(--bg-card);
  border-color:var(--border-light);
  box-shadow:2px 0 20px rgba(0,0,0,.4);
}
[data-theme="dark"] .sidebar-logo { border-color:var(--border-light); }
[data-theme="dark"] .nav-divider  { background:var(--border-light); }
[data-theme="dark"] .nav-section-lbl { color:#2A3E60; }
[data-theme="dark"] .nav-item:hover:not(.active) { background:rgba(59,130,246,.08); }
[data-theme="dark"] .nav-item:hover:not(.active) .nav-iw { background:rgba(59,130,246,.14); color:#3B82F6; }
[data-theme="dark"] .nav-item:hover:not(.active) .nav-nm { color:#93C5FD; }
[data-theme="dark"] .nav-item.active { background:linear-gradient(135deg,rgba(30,58,138,.35),rgba(30,64,175,.2)); }
[data-theme="dark"] .nav-item.active::before { background:linear-gradient(180deg,#3B82F6,#2563EB); }
[data-theme="dark"] .nav-item.active .nav-iw { background:rgba(59,130,246,.2); color:#93C5FD; }
[data-theme="dark"] .nav-item.active .nav-nm { color:#93C5FD; }
[data-theme="dark"] .nav-iw { background:#131F38; color:#4A6080; }
[data-theme="dark"] .nav-nm { color:#B8C8E8; }
[data-theme="dark"] .sidebar-footer { background:#0B1222; border-color:var(--border-light); }
[data-theme="dark"] .quick-bar { background:#0B1222; border-color:var(--border-light); }
[data-theme="dark"] .qb-btn {
  background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted);
}
[data-theme="dark"] .qb-btn:hover { background:#1C2E50; color:#93C5FD; border-color:#3B82F6; }
[data-theme="dark"] .qb-btn.danger { border-color:rgba(239,68,68,.25); background:rgba(239,68,68,.08); }

/* ═══ PAGE HEADER ═══ */
.page-header {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:22px; flex-wrap:wrap; gap:12px;
}
.page-title-row { display:flex; align-items:center; gap:14px; }
.page-title-icon {
  width:46px; height:46px; border-radius:13px;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  display:flex;align-items:center;justify-content:center;
  font-size:20px;color:#fff;
  box-shadow:0 6px 18px rgba(30,58,138,.35);
  flex-shrink:0;
}
.page-title {
  font-family:var(--font-body);
  font-size:27px;
  font-weight:800;
  color:var(--text-primary);
  line-height:1.15;
  letter-spacing:-.03em;
}
.page-sub { font-size:12px; color:var(--text-muted); margin-top:3px; font-weight:500; }
[data-theme="dark"] .page-title { color:#E2E8F8; }
[data-theme="dark"] .page-sub   { color:var(--text-muted); }

/* ═══ MODALS ═══ */
.modal-overlay {
  position:fixed;inset:0;background:rgba(10,22,40,.55);
  backdrop-filter:blur(5px);z-index:1000;
  display:none;align-items:center;justify-content:center;padding:20px;
}
.modal-overlay.open { display:flex; }
.modal {
  background:var(--bg-card);border-radius:var(--radius-xl);
  width:100%;max-height:90vh;overflow-y:auto;
  box-shadow:var(--shadow-xl);border:1px solid var(--border-light);
  animation:modalIn .28s cubic-bezier(.34,1.26,.64,1) both;
}
@keyframes modalIn { from { opacity:0; transform:translateY(8px) scale(.98); } to { opacity:1; transform:none; } }
.modal-sm { max-width:440px; }
.modal-md { max-width:680px; }
.modal-header {
  display:flex;align-items:flex-start;justify-content:space-between;
  padding:20px 24px 0;position:sticky;top:0;background:var(--bg-card);z-index:5;
}
.modal-title { font-size:16.5px;font-weight:800;color:var(--brand-primary);letter-spacing:-.02em; }
.modal-sub { font-size:12px;color:var(--text-muted);margin-top:2px; }
.modal-close { width:30px;height:30px;border-radius:8px;border:none;background:var(--bg-muted);color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;transition:var(--tr);flex-shrink:0; }
.modal-close:hover { background:rgba(220,38,38,.1);color:var(--error); }
.modal-body { padding:18px 24px 24px; }
.modal-footer { display:flex;gap:9px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border-light); }

[data-theme="dark"] .modal-overlay { background:rgba(0,5,15,.7); }
[data-theme="dark"] .modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .modal-title { color:#3B82F6; }
[data-theme="dark"] .modal-sub   { color:var(--text-muted); }
[data-theme="dark"] .modal-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .modal-close:hover { background:rgba(239,68,68,.15); color:#F87171; }
[data-theme="dark"] .modal-footer { border-color:var(--border-light); }

/* Form elements inside modals */
.form-group  { display:flex;flex-direction:column;gap:5px;margin-bottom:14px; }
.form-label  { font-size:11.5px;font-weight:600;color:var(--text-secondary);letter-spacing:.2px; }
.form-input  {
  height:42px;border:1.5px solid var(--border-light);border-radius:var(--radius-md);
  padding:0 12px;font-family:var(--font-body);font-size:13px;color:var(--text-primary);
  background:var(--input-bg);outline:none;transition:var(--tr);width:100%;
}
.form-input:focus { border-color:var(--brand-primary);box-shadow:0 0 0 3px rgba(30,58,138,.1); }
[data-theme="dark"] .form-label   { color:#93C5FD; }
[data-theme="dark"] .form-input   { background:var(--input-bg); border-color:var(--border-light); color:#E2E8F8; }
[data-theme="dark"] .form-input:focus  { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.12); }

/* Buttons */
.btn { display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:var(--radius-md);font-family:var(--font-body);font-weight:600;cursor:pointer;transition:var(--tr);border:none;font-size:13px; }
.btn-primary { background:linear-gradient(135deg,#1E40AF,#1E3A8A);color:#fff;padding:0 20px;height:40px;box-shadow:0 4px 14px rgba(30,58,138,.28); }
.btn-primary:hover { transform:translateY(-1px);box-shadow:0 8px 20px rgba(30,58,138,.38); }
.btn-secondary { background:transparent;color:var(--text-secondary);border:1.5px solid var(--border-light);padding:0 18px;height:40px; }
.btn-secondary:hover { background:var(--bg-muted); }
.btn-danger { background:linear-gradient(135deg,#DC2626,#B91C1C);color:#fff;padding:0 20px;height:40px;box-shadow:0 4px 14px rgba(220,38,38,.28); }
.btn-danger:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(220,38,38,.38); }
[data-theme="dark"] .btn-primary { box-shadow:0 4px 14px rgba(30,58,138,.4); }
[data-theme="dark"] .btn-secondary { border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .btn-secondary:hover { background:var(--bg-muted); color:#E2E8F8; }

/* ═══ PROFILE MODAL (phase2) ═══ */
.prof-overlay {
  position:fixed; inset:0;
  background:rgba(10,22,40,.55); backdrop-filter:blur(6px);
  z-index:2000; display:none;
  align-items:center; justify-content:center; padding:20px;
}
.prof-overlay.open { display:flex; }
.prof-modal {
  background:var(--bg-card); border-radius:22px;
  width:100%; max-width:820px; max-height:90vh; overflow-y:auto;
  box-shadow:var(--shadow-xl); border:1px solid var(--border-light);
  animation:modalIn .3s cubic-bezier(.34,1.26,.64,1) both;
}
.prof-modal-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  padding:22px 26px 18px; border-bottom:1px solid var(--border-light);
  background:var(--bg-card);
  position:sticky; top:0; z-index:10; backdrop-filter:blur(8px);
}
.prof-modal-title-row { display:flex; align-items:center; gap:13px; }
.prof-modal-icon {
  width:42px; height:42px; border-radius:12px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; font-size:18px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.prof-modal-title { font-size:17px; font-weight:800; color:var(--text-primary); letter-spacing:-.02em; }
.prof-modal-sub   { font-size:12px; color:var(--text-muted); margin-top:2px; }
.prof-close-btn {
  width:32px; height:32px; border-radius:9px;
  border:none; background:var(--bg-muted); color:var(--text-muted);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:13px; transition:var(--tr); flex-shrink:0;
}
.prof-close-btn:hover { background:rgba(220,38,38,.1); color:var(--error); }
.prof-modal-body { display:grid; grid-template-columns:220px 1fr; min-height:500px; }
.prof-left { border-right:1px solid var(--border-light); padding:24px 20px; display:flex; flex-direction:column; gap:16px; }
.prof-avatar-card { display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; }
.prof-avatar-wrap { position:relative; width:88px; height:88px; border-radius:50%; cursor:pointer; }
.prof-avatar-circle {
  width:88px; height:88px; border-radius:50%;
  background:linear-gradient(135deg,#1a237e,#283593);
  display:flex; align-items:center; justify-content:center;
  font-size:28px; font-weight:800; color:#fff; letter-spacing:-1px;
  box-shadow:0 6px 20px rgba(26,35,126,.35); border:3px solid #fff;
}
.prof-avatar-img { width:88px; height:88px; border-radius:50%; overflow:hidden; border:3px solid #fff; box-shadow:0 6px 20px rgba(26,35,126,.25); }
.prof-avatar-img img { width:100%; height:100%; object-fit:cover; }
.prof-avatar-overlay {
  position:absolute; inset:0; border-radius:50%;
  background:rgba(10,22,40,.55); display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:3px;
  opacity:0; transition:opacity .2s ease; color:#fff; font-size:11px; font-weight:600;
  border:none; cursor:pointer; padding:0; font-family:inherit;
}
.prof-avatar-overlay i { font-size:16px; }
.prof-avatar-wrap:hover .prof-avatar-overlay,
.prof-avatar-overlay:focus-visible { opacity:1; }
.prof-avatar-overlay:focus-visible { outline:2px solid #fff; outline-offset:-4px; }
.prof-avatar-name { font-size:13.5px; font-weight:800; color:var(--text-primary); margin-top:8px; }
.prof-role-badge {
  display:inline-flex; align-items:center; gap:4px; padding:3px 10px;
  border-radius:var(--radius-full); font-size:10px; font-weight:700;
  background:linear-gradient(135deg,rgba(30,58,138,.1),rgba(30,64,175,.08));
  color:var(--brand-primary); border:1px solid rgba(30,58,138,.2);
}
.prof-role-badge i { font-size:8px; }
.prof-avatar-campus { font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:5px; }
.prof-avatar-actions { display:flex; flex-direction:column; gap:6px; width:100%; margin-top:10px; }
.prof-pic-btn {
  display:flex; align-items:center; justify-content:center; gap:6px;
  width:100%; padding:8px 12px; border-radius:var(--radius-md);
  font-family:var(--font-body); font-size:11.5px; font-weight:600;
  cursor:pointer; transition:var(--tr); border:1.5px solid var(--border-light);
  background:var(--bg-muted); color:var(--text-secondary);
}
.prof-pic-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.prof-pic-btn--remove { background:rgba(220,38,38,.06); color:var(--error); border-color:rgba(220,38,38,.2); }
.prof-pic-btn--remove:hover { background:rgba(220,38,38,.12); border-color:var(--error); }
.prof-pic-hint { font-size:10px; color:var(--text-muted); opacity:.7; }
.prof-stats-card {
  background:var(--bg-muted); border:1px solid var(--border-light);
  border-radius:var(--radius-md); padding:14px;
  display:flex; flex-direction:column; gap:12px;
}
.prof-stat-row { display:flex; align-items:center; gap:10px; }
.prof-stat-row i { font-size:14px; flex-shrink:0; width:20px; text-align:center; }
.prof-stat-val { font-size:11px; font-weight:700; color:var(--text-primary); line-height:1.4; }
.prof-stat-lbl { font-size:10px; color:var(--text-muted); }
.prof-right { padding:20px 24px; display:flex; flex-direction:column; }
.prof-tabs {
  display:flex; gap:4px; background:var(--bg-muted);
  border:1px solid var(--border-light); border-radius:var(--radius-md);
  padding:4px; margin-bottom:22px;
}
.prof-tab {
  flex:1; display:flex; align-items:center; justify-content:center; gap:7px;
  padding:9px 14px; border-radius:8px; border:none; background:transparent;
  font-family:var(--font-body); font-size:12.5px; font-weight:600;
  color:var(--text-muted); cursor:pointer; transition:var(--tr);
}
.prof-tab:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }
.prof-tab.active { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; box-shadow:0 3px 10px rgba(30,58,138,.28); }
.prof-tab:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(30,64,175,.25); }
[data-theme="dark"] .prof-tab:focus-visible { box-shadow:0 0 0 3px rgba(59,130,246,.32); }
.prof-tab i { font-size:11px; }
/* Hide the focus outline on tabpanels while still keeping them keyboard-reachable. */
.prof-tab-panel:focus { outline:none; }
.prof-close-btn:focus-visible { outline:2px solid var(--brand-primary); outline-offset:2px; }
.prof-eye-btn:focus-visible { outline:2px solid var(--brand-primary); outline-offset:2px; }
.prof-tab-panel { display:none; flex-direction:column; flex:1; }
.prof-tab-panel.active { display:flex; }
.prof-section-label {
  font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
  color:var(--text-muted); margin-bottom:14px; padding-bottom:8px;
  border-bottom:1px solid var(--border-light);
}
.prof-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.prof-form-group { display:flex; flex-direction:column; gap:5px; }
.prof-label { font-size:11.5px; font-weight:600; color:var(--text-secondary); letter-spacing:.2px; }
.req-star { color:var(--error); }
.prof-input-wrap { position:relative; }
.prof-input-icon {
  position:absolute; left:12px; top:50%; transform:translateY(-50%);
  color:var(--text-muted); font-size:12px; pointer-events:none; transition:var(--tr);
}
.prof-input-wrap:focus-within .prof-input-icon { color:var(--brand-primary); }
.prof-input {
  width:100%; height:42px; padding:0 12px 0 36px;
  border:1.5px solid var(--border-light); border-radius:var(--radius-md);
  font-family:var(--font-body); font-size:13px; color:var(--text-primary);
  background:var(--input-bg); outline:none; transition:var(--tr);
}
.prof-input:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.1); }
.prof-field-hint { font-size:10.5px; color:var(--text-muted); display:flex; align-items:center; gap:5px; }
.prof-field-hint i { color:var(--info); font-size:10px; }
.prof-eye-btn {
  position:absolute; right:10px; top:50%; transform:translateY(-50%);
  border:none; background:transparent; color:var(--text-muted);
  cursor:pointer; font-size:12px; padding:4px; transition:var(--tr);
}
.prof-eye-btn:hover { color:var(--brand-primary); }
.prof-footer-row {
  display:flex; align-items:center; padding-top:18px;
  border-top:1px solid var(--border-light); margin-top:20px;
}
.prof-unsaved { display:flex; align-items:center; gap:7px; font-size:11.5px; color:var(--warning); font-weight:600; }
.autosave-dot { width:7px;height:7px;border-radius:50%;background:var(--warning);animation:pulse-dot 2s infinite; }
@keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
.prof-btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:0 18px; height:40px; border-radius:var(--radius-md);
  font-family:var(--font-body); font-size:13px; font-weight:600;
  cursor:pointer; transition:var(--tr); border:none;
}
.prof-btn--primary { background:linear-gradient(135deg,#1E40AF,#1E3A8A); color:#fff; box-shadow:0 4px 14px rgba(30,58,138,.28); }
.prof-btn--primary:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(30,58,138,.38); }
.prof-btn--ghost { background:transparent; color:var(--text-secondary); border:1.5px solid var(--border-light); }
.prof-btn--ghost:hover { background:var(--bg-muted); }

/* Password steps */
.pwd-steps { display:flex; align-items:center; margin-bottom:28px; }
.pwd-step { display:flex; flex-direction:column; align-items:center; gap:5px; flex:none; }
.pwd-step-num {
  width:30px; height:30px; border-radius:50%;
  background:var(--bg-muted); border:2px solid var(--border-light);
  display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:800; color:var(--text-muted); transition:all .3s ease;
}
.pwd-step.active .pwd-step-num { background:linear-gradient(135deg,#1E40AF,#1E3A8A); border-color:#1E40AF; color:#fff; box-shadow:0 3px 10px rgba(30,58,138,.35); }
.pwd-step.done  .pwd-step-num  { background:var(--success); border-color:var(--success); color:#fff; }
.pwd-step-label { font-size:10px; font-weight:600; color:var(--text-muted); white-space:nowrap; }
.pwd-step.active .pwd-step-label { color:var(--brand-primary); }
.pwd-step.done  .pwd-step-label { color:var(--success); }
.pwd-step-line { flex:1; height:2px; background:var(--border-light); border-radius:2px; margin:0 8px; margin-bottom:18px; transition:background .4s ease; }
.pwd-step-line.done { background:var(--success); }
.pwd-panel { display:flex; flex-direction:column; align-items:center; text-align:center; }
.pwd-panel-icon { width:64px; height:64px; border-radius:18px; display:flex; align-items:center; justify-content:center; font-size:26px; margin-bottom:14px; }
.pwd-panel-title { font-size:17px; font-weight:800; color:var(--text-primary); margin-bottom:6px; letter-spacing:-.02em; }
.pwd-panel-sub   { font-size:12.5px; color:var(--text-muted); line-height:1.6; max-width:340px; }
.pwd-action-btn {
  display:flex; align-items:center; justify-content:center; gap:8px;
  width:100%; max-width:320px; height:46px; border-radius:var(--radius-md);
  border:none; cursor:pointer; font-family:var(--font-body); font-size:14px; font-weight:700;
  background:linear-gradient(135deg,#1D4ED8,#1E3A8A); color:#fff;
  box-shadow:0 4px 16px rgba(30,58,138,.32), inset 0 1px 0 rgba(255,255,255,.2);
  transition:all .2s ease; margin-top:18px;
}
.pwd-action-btn:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(30,58,138,.45); }
.pwd-action-btn:active { transform:translateY(0) scale(.97); }
.pwd-back-btn {
  display:flex; align-items:center; gap:6px; background:transparent; border:none;
  cursor:pointer; font-family:var(--font-body); font-size:12px; font-weight:600;
  color:var(--text-muted); margin-top:10px; transition:color .2s ease;
}
.pwd-back-btn:hover { color:var(--brand-primary); }

/* OTP */
.otp-boxes { display:flex; gap:10px; margin-top:20px; }
.otp-box {
  width:48px; height:56px; border-radius:var(--radius-md);
  border:2px solid var(--border-light); background:var(--input-bg);
  text-align:center; font-family:var(--font-body);
  font-size:22px; font-weight:800; color:var(--text-primary);
  outline:none; transition:var(--tr); caret-color:var(--brand-primary);
}
.otp-box:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.12); }
.otp-box.filled { border-color:var(--brand-primary); background:rgba(30,58,138,.04); color:var(--brand-primary); }
.otp-box.error  { border-color:var(--error)!important; box-shadow:0 0 0 3px rgba(220,38,38,.1)!important; animation:shake .4s ease; }
.otp-timer-row { display:flex; align-items:center; justify-content:space-between; width:100%; max-width:300px; margin-top:12px; }
.otp-timer-txt { font-size:12px; color:var(--text-muted); }
.otp-timer-txt strong { color:var(--brand-primary); }
.otp-resend-btn { font-family:var(--font-body); font-size:12px; font-weight:700; background:none; border:none; cursor:pointer; color:var(--brand-primary); }
.otp-resend-btn:disabled { opacity:.35; cursor:not-allowed; }
.otp-error {
  display:flex; align-items:center; gap:6px;
  font-size:12px; font-weight:600; color:var(--error);
  background:rgba(220,38,38,.06); border:1px solid rgba(220,38,38,.2);
  border-radius:var(--radius-md); padding:9px 14px;
  margin-top:12px; width:100%; max-width:300px; animation:fadeSlide .2s ease;
}
@keyframes fadeSlide { from { opacity:0; transform:translateY(-3px);} to { opacity:1; transform:none;} }

/* Password strength + rules */
.pass-strength-bar { height:4px; border-radius:2px; background:var(--border-light); overflow:hidden; margin-top:6px; }
.pass-strength-fill { height:100%; border-radius:2px; transition:all .4s ease; }
.pass-strength-txt { font-size:10.5px; font-weight:700; margin-top:4px; }
.pass-rules { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:4px; }
.pass-rule { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-muted); transition:color .2s ease; }
.pass-rule i { font-size:7px; transition:all .2s ease; }
.pass-rule.ok { color:var(--success); }
.pass-rule.ok i { font-size:10px; }
.pass-match-msg { font-size:11px; margin-top:3px; font-weight:600; }
.pass-match-msg.ok  { color:var(--success); }
.pass-match-msg.err { color:var(--error); }
.pwd-success-anim {
  width:80px; height:80px; border-radius:50%;
  background:linear-gradient(135deg,rgba(22,163,74,.12),rgba(16,185,129,.12));
  display:flex; align-items:center; justify-content:center;
  font-size:34px; color:var(--success); margin-bottom:16px; position:relative;
  animation:successPop .5s cubic-bezier(.34,1.56,.64,1) both;
}
.pwd-success-anim::before { content:''; position:absolute; inset:-5px; border-radius:50%; border:2px solid rgba(22,163,74,.25); animation:ring-pulse 1.5s ease infinite; }
@keyframes successPop  { from{opacity:0;transform:scale(.5)} to{opacity:1;transform:scale(1)} }
@keyframes ring-pulse  { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.1);opacity:.4} }
@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }

[data-theme="dark"] .prof-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .prof-modal-header { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .prof-modal-title { color:#E2E8F8; }
[data-theme="dark"] .prof-modal-icon { background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(30,64,175,.12)); color:#93C5FD; }
[data-theme="dark"] .prof-close-btn { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .prof-close-btn:hover { background:rgba(239,68,68,.15); color:#F87171; }
[data-theme="dark"] .prof-left { border-color:var(--border-light); }
[data-theme="dark"] .prof-avatar-name { color:#E2E8F8; }
[data-theme="dark"] .prof-pic-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .prof-pic-btn:hover { background:rgba(59,130,246,.1); border-color:#3B82F6; color:#93C5FD; }
[data-theme="dark"] .prof-stats-card { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .prof-stat-val { color:#E2E8F8; }
[data-theme="dark"] .prof-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .prof-tab { color:var(--text-muted); }
[data-theme="dark"] .prof-tab:hover:not(.active) { background:var(--bg-card); color:#E2E8F8; }
[data-theme="dark"] .prof-section-label { color:#4A6080; border-color:var(--border-light); }
[data-theme="dark"] .prof-label { color:#93C5FD; }
[data-theme="dark"] .prof-input { background:var(--input-bg); border-color:var(--border-light); color:#E2E8F8; }
[data-theme="dark"] .prof-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.12); }
[data-theme="dark"] .prof-btn--ghost { border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .prof-btn--ghost:hover { background:var(--bg-muted); color:#E2E8F8; }
[data-theme="dark"] .pwd-step-num { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .pwd-panel-title { color:#E2E8F8; }
[data-theme="dark"] .otp-box { background:var(--input-bg); border-color:var(--border-light); color:#E2E8F8; }
[data-theme="dark"] .otp-box:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.12); }

/* ═══ TOASTS ═══ */
.toast-container {
  position:fixed; top:70px; right:16px; z-index:9999;
  display:flex; flex-direction:column; gap:8px; pointer-events:none;
}
.toast {
  display:flex; align-items:center; gap:10px;
  background:var(--bg-card);
  border:1px solid var(--border-light);
  border-radius:10px; padding:11px 15px;
  box-shadow:var(--shadow-lg);
  min-width:240px; max-width:320px;
  pointer-events:auto;
  font-family:var(--font-body);
  font-size:13px; font-weight:500;
  color:var(--text-primary);
  animation:toastIn .28s cubic-bezier(.34,1.56,.64,1) both;
}
.toast-icon {
  width:28px; height:28px; border-radius:7px;
  display:flex; align-items:center; justify-content:center;
  font-size:12px; flex-shrink:0;
}
@keyframes toastIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

/* Logout dialog */
.logout-card {
  display:flex; gap:14px; align-items:flex-start;
  background:rgba(220,38,38,.06);
  border:1px solid rgba(220,38,38,.2);
  border-radius:var(--radius-md);
  padding:14px 16px;
}
.logout-icon {
  width:40px;height:40px;border-radius:10px;
  background:linear-gradient(135deg,#EF4444,#DC2626);
  color:#fff;display:flex;align-items:center;justify-content:center;
  font-size:16px;flex-shrink:0;
  box-shadow:0 6px 18px rgba(220,38,38,.35);
}
.logout-heading { font-weight:800;font-size:14px;color:var(--text-primary); }
.logout-sub { font-size:12.5px;color:var(--text-muted);margin-top:4px;line-height:1.45; }
[data-theme="dark"] .logout-card { background:rgba(239,68,68,.08); border-color:rgba(239,68,68,.25); }
[data-theme="dark"] .logout-heading { color:#E2E8F8; }

/* ═══ MOBILE TRIGGERS ═══ */
.mobile-menu-btn {
  display:none; width:36px; height:36px; border-radius:10px;
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  color:var(--text-secondary); align-items:center; justify-content:center;
  cursor:pointer; font-size:15px; transition:var(--tr); flex-shrink:0;
}
.mobile-menu-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.mobile-overlay {
  display:none; position:fixed; inset:0;
  background:rgba(10,22,40,.55); backdrop-filter:blur(5px);
  z-index:290;
}
.mobile-overlay.open { display:block; }
[data-theme="dark"] .mobile-overlay { background:rgba(0,5,15,.7); }

/* ═══ RESPONSIVE ═══ */
@media (max-width:1100px) {
  :root { --sidebar-w:210px; }
  .topbar { padding:0 18px; }
  .page-content { padding:20px; }
}

@media (max-width:900px) {
  :root { --sidebar-w:72px; }
  .logo-name, .nav-nm, .nav-st, .nav-bx, .quick-bar,
  .sidebar-footer > div:last-child { display:none !important; }
  .sidebar-logo { justify-content:center; padding:14px 10px; }
  .logo-icon { margin:0; }
  .nav-item { justify-content:center; padding:10px; }
  .nav-iw { margin:0; }
  .sidebar-footer { justify-content:center; padding:10px; }
  .topbar { padding:0 16px; gap:8px; }
  .topbar-school .school-name { font-size:11px; }
  .topbar-school .school-yr   { display:none; }
  .page-content { padding:16px; }
}

@media (max-width:768px) {
  :root { --sidebar-w:0px; }
  .sidebar-collapse-btn { display:none; }
  .sidebar {
    width:280px !important;
    transform:translateX(-100%);
    transition:transform .3s cubic-bezier(.4,0,.2,1);
    z-index:300; box-shadow:none;
  }
  .sidebar.open {
    transform:translateX(0);
    box-shadow:8px 0 40px rgba(10,22,40,.22);
  }
  .sidebar.open .logo-name  { display:block !important; }
  .sidebar.open .nav-nm     { display:block !important; }
  .sidebar.open .nav-st     { display:block !important; }
  .sidebar.open .nav-bx     { display:flex  !important; }
  .sidebar.open .quick-bar  { display:flex  !important; }
  .sidebar.open .sidebar-footer > div:last-child { display:flex !important; }
  .sidebar.open .sidebar-logo { justify-content:flex-start; padding:14px 16px; }
  .sidebar.open .nav-item   { justify-content:flex-start; padding:8px 10px; }
  .sidebar.open .sidebar-footer { justify-content:flex-start; padding:10px 12px; }
  .main-content { margin-left:0 !important; }
  .mobile-menu-btn { display:flex; }
  .topbar { padding:0 10px; gap:0; height:56px; overflow:visible; }
  .breadcrumb { flex:1; min-width:0; gap:4px; overflow:hidden; padding-right:8px; }
  .bc-item    { display:none; }
  .bc-sep     { display:none; }
  .bc-current { font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .topbar-right { flex-shrink:0; gap:6px; align-items:center; display:flex; }
  .topbar-school { display:none; }
  .page-content { padding:12px 12px 24px; overflow-x:hidden; }
  .modal-overlay { padding:0; align-items:flex-end; }
  .modal { border-radius:22px 22px 0 0; max-height:92vh; width:100%; max-width:100%; }
  .modal-header { padding:16px 18px 0; }
  .modal-body   { padding:14px 18px 16px; }
  .modal-footer { padding:12px 18px 18px; }
}

@media (max-width:700px) {
  .prof-modal-body { grid-template-columns:1fr; }
  .prof-left { border-right:none; border-bottom:1px solid var(--border-light); }
  .prof-form-grid { grid-template-columns:1fr; }
  .pass-rules { grid-template-columns:1fr; }
  .otp-box { width:40px; height:48px; font-size:18px; }
  .otp-boxes { gap:7px; }
}

/* ─── Nav placeholder ("Coming Soon") — shared across modules that
   aren't ported yet, including Dashboard/Home. Token-driven so the
   look stays consistent with the rest of the ERP shell. ─── */
.nav-coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 80px 32px;
  text-align: center;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15,23,42,.04));
  font-family: var(--font-body, 'Plus Jakarta Sans','Segoe UI',Arial,sans-serif);
}
.nav-cs-icon {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(30,58,138,.12), rgba(30,58,138,.22));
  color: var(--brand-primary, #1E40AF);
  font-size: 28px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 18px rgba(30,58,138,.2);
}
.nav-cs-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -.02em;
  color: var(--text-primary);
  line-height: 1.25;
}
.nav-cs-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  max-width: 380px;
  line-height: 1.5;
}
[data-theme="dark"] .nav-coming-soon {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .nav-cs-icon {
  background: linear-gradient(135deg, rgba(59,130,246,.18), rgba(59,130,246,.30));
  color: var(--brand-primary, #3B82F6);
  box-shadow: 0 4px 18px rgba(59,130,246,.25);
}
@media (max-width: 700px) {
  .nav-coming-soon { padding: 56px 18px; }
  .nav-cs-icon { width: 60px; height: 60px; font-size: 24px; }
  .nav-cs-title { font-size: 16px; }
  .nav-cs-desc { font-size: 12.5px; }
}
`;
