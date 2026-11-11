import React, { useEffect, useRef, useState } from 'react';
import Tooltip from '../../components/Tooltip';
// import Overview from './Overview';   // Overview tab abhi hidden hai
import DailyChecks from './DailyChecks';
import WeeklyChecks from './WeeklyChecks';
import MonthlyReview from './MonthlyReview';
import Problems from './Problems';
import ComplianceReports from './ComplianceReports';
import ComplianceSetup from './ComplianceSetup';
import { ensureAreas, ensureTasks, getAreas, getTasks, getBranchEmployees, getProblems, SEED_AREA_NAMES } from '../../services/complianceApi';
import { useComplianceTabs } from './compliancePermissions';
import { EmptyState } from './ComplianceShared';


/* ═══════════════════════════════════════════════════════════════════
   SCHOOL COMPLIANCE — module shell.

   7 sections (Overview / Daily Checks / Weekly Checks / Monthly
   Review / Problems & Follow-ups / Reports / Compliance Setup) behind
   one L1 tab bar, same pattern as every other multi-section ERP
   module (Fee.jsx's FEE_TABS / .fee-subtabs).

   Compliance Setup, Daily / Weekly / Monthly Checks aur Problems &
   Follow-ups — sab asli backend se chalte hain
   (src/erp/services/complianceApi.js -> AHM_Branch_Compliance_Area).
   Areas + task list ek dafa yahan load hoti hai aur chaaron tabs ko
   props se jati hai, is liye Setup mein kiya hua add/edit foran check
   tabs mein bhi dikhta hai (aur ulta bhi).

   Reports tab bhi isi areas + task list + employees aur backend ki
   problem-list se banta hai — koi mock data nahi.
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'setup',    icon: 'fa-sliders',           label: 'Compliance Setup' },
  // { id: 'overview', icon: 'fa-gauge-high',       label: 'Overview' },   // abhi hidden — wapas lana ho to uncomment karein
  { id: 'daily',    icon: 'fa-list-check',        label: 'Daily Checks' },
  { id: 'weekly',   icon: 'fa-calendar-week',     label: 'Weekly Checks' },
  { id: 'monthly',  icon: 'fa-calendar-days',     label: 'Monthly Review' },
  { id: 'problems', icon: 'fa-triangle-exclamation', label: 'Problems & Follow-ups' },
  { id: 'reports',  icon: 'fa-chart-column',      label: 'Reports' },
];

export default function SchoolCompliance({ toast = () => {} }) {
const [tab, setTab] = useState('setup');
const [areas, setAreas] = useState([]);
const [tasks, setTasks] = useState(null);
const [loadError, setLoadError] = useState('');
/* Branch ke employees — module khulne par SIRF ek dafa load hote hain aur
   saare tabs (Setup, Daily, Weekly, Monthly, Problems) ko props se milte
   hain, ta ke tab badalne par API dobara na chale. Module se bahar ja kar
   wapas aane par (remount) hi dobara load honge. */
const [employees, setEmployees] = useState([]);
const [employeesLoading, setEmployeesLoading] = useState(true);

/* Tab level permission — jis tab ka View granted nahi wo hide. Active tab
   hide ho jaye (ya default 'setup' allowed na ho) to pehle visible par snap. */
const { ready: permsReady, canOpen } = useComplianceTabs();
const visibleTabs = TABS.filter(t => canOpen(t.id));
const tabAllowed = visibleTabs.some(t => t.id === tab);
useEffect(() => {
  if (permsReady && !tabAllowed && visibleTabs[0]) setTab(visibleTabs[0].id);
}, [permsReady, tabAllowed, visibleTabs]);

const load = () => {
  setLoadError('');
  ensureAreas(SEED_AREA_NAMES)
    .then((a) => {
      setAreas(a);
      return ensureTasks(a).then(setTasks);
    })
    .catch((err) => {
      console.error('School Compliance load failed:', err);
      const msg = err?.message || 'Compliance data load failed.';
      setLoadError(msg);
      toast(msg, 'error');
      setTasks((prev) => prev ?? []);   // "Loading…" par atka na rahe
    });
};

useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  let alive = true;
  getBranchEmployees()
    .then((list) => { if (alive) setEmployees(list); })
    .catch((e) => { if (alive) toast(e?.message || 'Could not load employees.', 'error'); })
    .finally(() => { if (alive) setEmployeesLoading(false); });
  return () => { alive = false; };
}, []); // eslint-disable-line react-hooks/exhaustive-deps

/* Problems list — Problems tab pehli dafa khulne par load hoti hai aur
   module band hone tak yahin rehti hai, ta ke tab badal kar wapas aane
   par API dobara na chale. problems === null => abhi load nahi hui. */
const [problems, setProblems] = useState(null);
const problemsReq = useRef(null);
const mounted = useRef(true);
/* Mount par true bhi set karna zaroori hai — StrictMode (dev) mein React
   mount → unmount → mount karta hai; sirf cleanup ho to ye false hi reh
   jata aur response kabhi state mein na aata ("Loading…" par atak jata) */
useEffect(() => {
  mounted.current = true;
  return () => { mounted.current = false; };
}, []);

const loadProblems = () => {
  if (problemsReq.current) return problemsReq.current;   // ek waqt mein ek hi call
  problemsReq.current = getProblems()
    .then((list) => { if (mounted.current) setProblems(list); })
    .catch((e) => {
      if (!mounted.current) return;
      toast(e?.message || 'Could not load problems.', 'error');
      setProblems((prev) => prev ?? []);
    })
    .finally(() => { problemsReq.current = null; });
  return problemsReq.current;
};

useEffect(() => {
  if (tab === 'problems' && problems === null) loadProblems();
}, [tab, problems]); // eslint-disable-line react-hooks/exhaustive-deps

/* Daily/Weekly/Monthly se naya problem report hua — list purani ho gayi,
   agli dafa Problems tab khulne par dobara load hogi */
const markProblemsStale = () => setProblems(null);

/* Task list dobara lana — Setup aur teeno check tabs isi ko use karte hain */
const refreshTasks = () => getTasks().then(setTasks);
const refreshAreas = () => getAreas().then(setAreas);


  return (
    <>
      <style>{CMP_CSS}</style>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF))' }}>
            <i className="fa-solid fa-clipboard-check"></i>
          </div>
          <div>
            <div className="page-title">School Compliance</div>
            <div className="page-sub">Daily, weekly and monthly checks to keep your school running smoothly</div>
          </div>
        </div>
      </div>

      <div className="cmp-tabs">
        {loadError && (
  <div className="cmp-critical-banner">
    <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
    <span style={{ flex: 1 }}>{loadError}</span>
    <button type="button" className="btn btn-secondary" onClick={load}>Retry</button>
  </div>
)}
        {visibleTabs.map(t => (
          <Tooltip key={t.id} text={`Open ${t.label}`}>
            <button type="button" className={`cmp-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              <i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {permsReady && visibleTabs.length === 0 && (
        <EmptyState
          icon="fa-lock"
          title="You don't have access to School Compliance"
          sub="Please contact your school admin to get permission."
        />
      )}
      {permsReady && tabAllowed && (<>
      {/* {tab === 'overview' && <Overview toast={toast} onNavigate={setTab} />} */}
      {/* Daily / Weekly / Monthly — Setup wala hi backend task list
          (areas + tasks) in teeno ko jata hai, is liye Setup mein
          banaya/badla hua task foran yahan bhi nazar aata hai. */}
      {tab === 'daily'    && <DailyChecks   toast={toast} areas={areas} tasks={tasks} onTasksChange={refreshTasks} employees={employees} employeesLoading={employeesLoading} onProblemsChange={markProblemsStale} />}
      {tab === 'weekly'   && <WeeklyChecks  toast={toast} areas={areas} tasks={tasks} onTasksChange={refreshTasks} employees={employees} employeesLoading={employeesLoading} onProblemsChange={markProblemsStale} />}
      {tab === 'monthly'  && <MonthlyReview toast={toast} areas={areas} tasks={tasks} onTasksChange={refreshTasks} employees={employees} employeesLoading={employeesLoading} onProblemsChange={markProblemsStale} />}
      {tab === 'problems' && <Problems toast={toast} employees={employees} employeesLoading={employeesLoading} problems={problems} onProblemsChange={loadProblems} />}
      {tab === 'reports'  && <ComplianceReports toast={toast} areas={areas} tasks={tasks} employees={employees} />}
     {tab === 'setup' && (
  <ComplianceSetup
    toast={toast}
    areas={areas}
    tasks={tasks}
    onAreasChange={refreshAreas}
    onTasksChange={refreshTasks}
    employees={employees}
    employeesLoading={employeesLoading}
  />
)}
      </>)}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Module CSS — self-contained, scoped to .cmp-*. Tab bar mirrors
   Fee.jsx's .fee-subtabs/.fee-subtab exactly (same gradient, radius,
   shadow) per explicit feedback that every module's tabs/buttons
   should look like Fee's. Buttons reuse the global .btn/.btn-primary/
   .btn-secondary and .form-input/.form-group/.form-label (App.js) —
   everything else below is new chrome this module alone needs
   (summary cards, status/priority badges, checklist rows/groups,
   filter bar, photo attach).
   ═══════════════════════════════════════════════════════════════════ */
const CMP_CSS = `
.cmp-tabs {
  display: flex; gap: 6px;
  background: var(--bg-card); border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg); padding: 5px;
  margin-bottom: 20px; box-shadow: var(--shadow-sm);
  overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch;
}
.cmp-tab {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  flex: 1; padding: 11px 14px; border: none; border-radius: var(--radius-md);
  background: transparent; font-family: var(--font-body); font-size: 12.5px; font-weight: 600;
  color: var(--text-muted); cursor: pointer; transition: var(--tr); white-space: nowrap;
}
.cmp-tab:hover:not(.active) { background: var(--bg-muted); color: var(--text-primary); }
.cmp-tab.active {
  background: var(--brand-gradient, linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%));
  color: #fff;
  box-shadow: var(--shadow-flatten, 0 6px 20px rgba(var(--brand-primary-rgb), .4), inset 0 1px 0 rgba(255,255,255,.2));
}

/* ─── Summary cards ─── */
.cmp-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 20px; }
.cmp-stat { background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: var(--radius-lg); padding: 14px; box-shadow: var(--shadow-sm); }
.cmp-stat-ic { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-bottom: 8px; }
.cmp-stat-val { font-size: 22px; font-weight: 800; color: var(--text-primary); line-height: 1; }
.cmp-stat-lbl { font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: .3px; }
.cmp-stat-sub { font-size: 10.5px; color: var(--text-muted); margin-top: 3px; }
.cmp-stat--brand .cmp-stat-ic { background: rgba(var(--brand-primary-rgb), .12); color: var(--brand-solid, #1E3A8A); }
.cmp-stat--green .cmp-stat-ic { background: rgba(22,163,74,.12); color: #16A34A; }
.cmp-stat--amber .cmp-stat-ic { background: rgba(217,119,6,.12); color: #D97706; }
.cmp-stat--red   .cmp-stat-ic { background: rgba(220,38,38,.12); color: #DC2626; }
.cmp-stat--purple .cmp-stat-ic { background: rgba(124,58,237,.12); color: #7C3AED; }
.cmp-stat--teal  .cmp-stat-ic { background: rgba(13,148,136,.12); color: #0D9488; }

/* ─── Section cards ─── */
.cmp-card { background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 18px; box-shadow: var(--shadow-sm); }
.cmp-card-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.cmp-card-title { font-size: 15px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 9px; }
.cmp-card-title i { color: var(--brand-solid, #1E3A8A); }
.cmp-card-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.cmp-mini-h { font-size: 11.5px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .3px; margin: 14px 0 8px; }

/* ─── Badges ─── */
.cmp-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font: 700 10.5px/1 var(--font-body); text-transform: uppercase; letter-spacing: .3px; white-space: nowrap; }
.cmp-badge--green  { background: rgba(21,128,61,.12);  color: #15803D; }
.cmp-badge--red    { background: rgba(220,38,38,.12);  color: #B91C1C; }
.cmp-badge--amber  { background: rgba(217,119,6,.12);  color: #B45309; }
.cmp-badge--blue   { background: rgba(var(--brand-primary-rgb),.12); color: var(--brand-solid,#1E40AF); }
.cmp-badge--purple { background: rgba(124,58,237,.12); color: #7C3AED; }
.cmp-badge--teal   { background: rgba(13,148,136,.12); color: #0D9488; }
.cmp-badge--gray   { background: rgba(100,116,139,.14); color: #475569; }

/* ─── Filter bar ─── */
.cmp-filter-card { background: var(--bg-card); border: 1.5px solid var(--border-light); border-radius: var(--radius-lg); padding: 14px 16px; margin-bottom: 18px; box-shadow: var(--shadow-sm); }
.cmp-filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items: end; }
.cmp-field { margin-bottom: 0 !important; }
.cmp-filter-actions { display: flex; gap: 10px; margin-top: 12px; }

/* ─── Checklist group / row ─── */
.cmp-group { border: 1.5px solid var(--border-light); border-radius: var(--radius-lg); margin-bottom: 12px; overflow: hidden; background: var(--bg-card); }
.cmp-group-h { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; background: var(--bg-muted); border: none; cursor: pointer; }
.cmp-group-h-l { display: flex; align-items: center; gap: 10px; }
.cmp-group-h-l i { font-size: 11px; color: var(--text-muted); }
.cmp-group-title { font-size: 13.5px; font-weight: 800; color: var(--text-primary); }
.cmp-group-count { font-size: 11.5px; font-weight: 700; color: var(--text-muted); }
.cmp-group-body { padding: 4px 0; }

.cmp-row { border-top: 1px solid var(--border-light); }
.cmp-row:first-child { border-top: none; }
.cmp-row-main { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; cursor: pointer; }
.cmp-row-main:hover { background: var(--bg-muted); }
.cmp-row-main-l { flex: 1; min-width: 0; }
.cmp-row-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.cmp-row-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 5px; }
.cmp-row-assignee { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-muted); }
.cmp-row-main-r { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.cmp-row-chev { font-size: 11px; color: var(--text-muted); }
.cmp-row-body { padding: 4px 16px 16px; background: var(--bg-muted); }
.cmp-row.open .cmp-row-main { background: var(--bg-muted); }

.cmp-avatar { width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--brand-gradient, linear-gradient(135deg,#1E40AF,#2563EB)); color: #fff; font: 700 9px/1 var(--font-body); flex-shrink: 0; }

.cmp-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font: 700 10px/1.2 var(--font-body); }
.cmp-chip--safety { background: rgba(var(--brand-primary-rgb),.12); color: var(--brand-solid,#1E40AF); }
.cmp-chip--warn { background: rgba(217,119,6,.14); color: #B45309; }

.cmp-seg { display: inline-flex; border: 1.5px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden; margin-bottom: 14px; }
.cmp-seg-4 { width: 100%; }
.cmp-seg-btn { flex: 1; padding: 8px 10px; font: 600 11.5px/1 var(--font-body); color: var(--text-secondary); background: var(--bg-card); border: none; border-right: 1.5px solid var(--border-light); cursor: pointer; }
.cmp-seg-btn:last-child { border-right: none; }
.cmp-seg-btn.active { background: var(--brand-solid, #1E3A8A); color: #fff; }
.cmp-row-fields { display: flex; gap: 16px; align-items: stretch; flex-wrap: wrap; }
.cmp-row-remark { flex: 1 1 280px; margin-bottom: 0 !important; display: flex; flex-direction: column; }
.cmp-row-remark .cmp-textarea { flex: 1; }

/* Evidence photo + Save — ek hi column mein, photo ke neeche Save */
.cmp-row-side { display: flex; flex-direction: column; gap: 8px; width: 176px; flex-shrink: 0; }
.cmp-row-side .form-label { margin-bottom: 0; }
.cmp-row-side .cmp-photo, .cmp-row-side .cmp-photo-upload { width: 100%; }
.cmp-row-side .cmp-photo-upload { flex-direction: row; gap: 6px; justify-content: center; }
.cmp-row-side .cmp-photo-upload i { font-size: 16px; }
.cmp-row-side .cmp-photo-preview { width: 100%; height: 86px; }
.cmp-textarea { width: 100%; min-height: 60px; padding: 8px 12px; border: 1.5px solid var(--border-light); border-radius: var(--radius-md); font: 500 12.5px/1.4 var(--font-body); color: var(--text-primary); background: var(--bg-card); resize: vertical; }
.cmp-field-err { display: flex; align-items: center; gap: 6px; margin-top: 8px; font: 600 11.5px/1.3 var(--font-body); color: #DC2626; }
.cmp-verified { display: flex; align-items: center; gap: 6px; margin-top: 10px; font: 700 11.5px/1 var(--font-body); color: #16A34A; }
.cmp-verify-btn { margin-top: 10px; height: 32px; padding: 0 14px; font-size: 11.5px; }

/* Checklist row ka Save (remark + photo) */
.cmp-save-btn { height: 36px; width: 100%; justify-content: center; font-size: 12px; }
.cmp-row-side .cmp-save-btn { margin-top: auto; }   /* photo ho ya na ho, Save hamesha neeche */
.cmp-row-state { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 14px; font: 600 10.5px/1.2 var(--font-body); color: var(--text-muted); text-align: center; }
.cmp-row-state.unsaved { color: #B45309; }

/* Save shuda photo — click par poori khulti hai; load na ho to link */
.cmp-photo-preview a { display: block; width: 100%; height: 100%; }
.cmp-photo-failed { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 100%; background: var(--bg-muted); color: var(--brand-solid, #1E40AF); font: 600 10.5px/1.2 var(--font-body); text-decoration: none; text-align: center; padding: 6px; }
.cmp-photo-failed i { font-size: 15px; }
.cmp-photo-saved { position: absolute; bottom: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #16A34A; color: #fff; font-size: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,.3); }

.cmp-photo-upload { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border: 1.5px dashed var(--border-light); border-radius: var(--radius-md); color: var(--text-muted); font: 600 11.5px/1 var(--font-body); cursor: pointer; }
.cmp-photo-upload:hover { border-color: var(--brand-primary); color: var(--brand-solid, #1E40AF); }
.cmp-photo-preview { position: relative; width: 64px; height: 64px; border-radius: var(--radius-md); overflow: hidden; border: 1.5px solid var(--border-light); }
.cmp-photo-preview img { width: 100%; height: 100%; object-fit: cover; }
.cmp-photo-remove { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; background: rgba(0,0,0,.6); color: #fff; border: none; font-size: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

/* ─── Tables (reused across Overview/Problems/Reports) ─── */
.cmp-table-wrap { overflow-x: auto; border: 1.5px solid var(--border-light); border-radius: var(--radius-md); }
.cmp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.cmp-table th { text-align: left; padding: 10px 12px; background: var(--bg-muted); color: var(--text-secondary); font-weight: 800; white-space: nowrap; border-bottom: 1.5px solid var(--border-light); }
.cmp-table td { padding: 9px 12px; color: var(--text-secondary); border-bottom: 1px solid var(--border-light); vertical-align: top; }
.cmp-table tr:last-child td { border-bottom: none; }
.cmp-table tr:hover td { background: var(--bg-muted); }

/* ─── Area completion bars ─── */
.cmp-area-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
.cmp-area-row:not(:last-child) { border-bottom: 1px solid var(--border-light); }
.cmp-area-label { width: 180px; flex-shrink: 0; font-size: 12.5px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
.cmp-area-label i { color: var(--brand-solid, #1E3A8A); width: 16px; }
.cmp-area-bar-track { flex: 1; height: 8px; border-radius: 99px; background: var(--bg-muted); overflow: hidden; }
.cmp-area-bar-fill { height: 100%; border-radius: 99px; background: var(--brand-gradient, linear-gradient(90deg,#1E3A8A,#2563EB)); transition: width .4s ease; }
.cmp-area-pct { width: 44px; text-align: right; flex-shrink: 0; font-size: 12.5px; font-weight: 800; color: var(--text-primary); }

/* ─── Critical problem banner ─── */
.cmp-critical-banner { display: flex; align-items: center; gap: 10px; background: rgba(220,38,38,.08); border: 1.5px solid rgba(220,38,38,.3); border-radius: var(--radius-lg); padding: 12px 16px; margin-bottom: 18px; color: #B91C1C; font-weight: 700; font-size: 13px; }
.cmp-critical-banner i { font-size: 16px; }

/* ─── Empty state ─── */
.cmp-empty { text-align: center; padding: 36px 20px; }
.cmp-empty-ic { width: 52px; height: 52px; border-radius: 50%; background: var(--bg-muted); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: 20px; margin: 0 auto 12px; }
.cmp-empty-t { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.cmp-empty-s { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

/* ─── Confirm dialog content (shell is the global .modal-*) ─── */
.cmp-confirm-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; margin: 0 auto 12px; }
.cmp-confirm-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.cmp-confirm-msg { font-size: 12.5px; color: var(--text-secondary); margin-top: 6px; line-height: 1.5; }
.cmp-confirm-hint { font-size: 11.5px; color: var(--text-muted); margin-top: 8px; font-style: italic; }

/* ─── Report tiles (Reports tab) ─── */
.cmp-rep-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 20px; }
.cmp-rep-tile { display: flex; align-items: flex-start; gap: 10px; text-align: left; padding: 14px; border-radius: var(--radius-lg); border: 1.5px solid var(--border-light); background: var(--bg-card); cursor: pointer; transition: all .2s ease; }
.cmp-rep-tile:hover { border-color: var(--brand-primary); transform: translateY(-1px); }
.cmp-rep-tile.active { border-color: var(--brand-primary); background: rgba(var(--brand-primary-rgb),.06); box-shadow: var(--shadow-sm); }
.cmp-rep-tile-icon { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(var(--brand-primary-rgb),.1); color: var(--brand-solid,#1E3A8A); font-size: 13px; }
.cmp-rep-tile.active .cmp-rep-tile-icon { background: var(--brand-solid,#1E3A8A); color: #fff; }
.cmp-rep-tile-name { font-size: 12.5px; font-weight: 800; color: var(--text-primary); }
.cmp-rep-tile-desc { font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }

/* ─── On-page report preview — same HTML the PDF/Word downloads use,
   wrapped in a light frame so it visually reads as "a document shown
   on the page", not just more page content. ─── */
.cmp-report-preview {
  margin-top: 16px; padding: 18px;
  border: 1.5px solid var(--border-light); border-radius: var(--radius-lg);
  background: var(--bg-card); box-shadow: var(--shadow-sm);
  overflow-x: auto;
}
.cmp-report-preview table { width: 100%; }

/* ─── Monthly Staff Review's staff picker ─── */
.cmp-staff-picker { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.cmp-staff-chip {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 12px; border-radius: 999px;
  border: 1.5px solid var(--border-light); background: var(--bg-card);
  font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: var(--tr);
}
.cmp-staff-chip:hover { border-color: var(--brand-primary); }
.cmp-staff-chip.on { background: var(--brand-solid, #1E3A8A); border-color: var(--brand-solid, #1E3A8A); color: #fff; }
.cmp-staff-chip input { accent-color: #fff; }
.cmp-staff-hint { font-size: 11.5px; color: var(--text-muted); font-style: italic; width: 100%; }

/* ─── Compliance Setup's plain-English intro ─── */
.cmp-intro { background: rgba(var(--brand-primary-rgb), .04); border-color: rgba(var(--brand-primary-rgb), .2); }
.cmp-intro-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 8px; }
.cmp-intro-item-h { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 6px; }
.cmp-intro-item-h i { color: var(--brand-solid, #1E3A8A); }
.cmp-intro-item p { font-size: 12px; line-height: 1.6; color: var(--text-secondary); margin: 0; }

/* ─── Toggle switch (Compliance Setup's Active column) ─── */
.cmp-switch { position: relative; display: inline-block; width: 38px; height: 22px; }
.cmp-switch input { opacity: 0; width: 0; height: 0; }
.cmp-switch span { position: absolute; inset: 0; background: var(--border-light); border-radius: 999px; cursor: pointer; transition: var(--tr); }
.cmp-switch span::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: var(--tr); box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.cmp-switch input:checked + span { background: var(--brand-solid, #1E3A8A); }
.cmp-switch input:checked + span::before { transform: translateX(16px); }

@media (max-width: 1024px) {
  .cmp-stats { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .cmp-stats { grid-template-columns: repeat(2, 1fr); }
  .cmp-area-label { width: 130px; font-size: 11.5px; }
}
`;
