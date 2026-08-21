import React, { useMemo, useState, useEffect } from 'react';
import Tooltip from '../../components/Tooltip';
import UniversalSearch from '../../shared/UniversalSearch';
import {
  AreaChart, Area, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import { useModules } from '../../context/ModuleContext';
import { DASH_CSS } from './Dashboard';
import AnnouncementsModal from './AnnouncementsModal';
import AppPendingReportModal from './AppPendingReportModal';
import useAsync from '../../hooks/useAsync';
import * as feeService from '../../services/feeService';
import * as dashboardService from '../../services/dashboardService';
import {
  MODULE_COLOR,
} from './dashboardData';

/* ═══════════════════════════════════════════════════════════════════
   ADMIN DASHBOARD — refreshed layout.

   AUDIT (sections before this update):
     1. Hero greeting
     2. Priority cards (top 3 critical)
     3. Module tiles (KPI stat row)
     4. Admission Funnel + HR snapshot      ← REMOVED
     5. Academic Operations + Examinations  ← REMOVED (replaced by Lesson Plan)
     6. Fee Collection + Accounts           ← REMOVED (replaced by Fee Analytics + Revenue)
     7. Inventory & POS + Appraisals        ← REMOVED
     8. Audit Log                           ← REMOVED

   FINAL SECTION ORDER (per spec):
     1. Page Header (lives in Dashboard.jsx shell — kept)
     2. Top KPI Stat Cards row              (kept: hero + priority + tiles)
     3. FEE ANALYTICS                       (NEW)
     4. ACADEMICS / LESSON PLAN             (NEW)
     5. PAPER GENERATOR                     (NEW)
     6. ACCOUNTS / REVENUE                  (NEW)
     7. BIRTHDAYS THIS MONTH                (NEW)
     8. UPCOMING ACTIVITIES                 (NEW)
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Mock data for the new sections (matches spec exactly) ─────── */









const TYPE_COLOR = {
  exam:     { bg: 'rgba(220, 38, 38, .12)', fg: '#DC2626' },
  event:    { bg: 'rgba(30, 58, 138, .12)', fg: '#1E40AF' },
  holiday:  { bg: 'rgba(22, 163, 74, .12)', fg: '#16A34A' },
  deadline: { bg: 'rgba(217, 119, 6, .14)', fg: '#D97706' },
};

/* ─── Monthly Financial Summary helpers ─────────────────────────
   Mirrors the exact monthly reduce used by Accounts → Reports
   (src/components/Accounts.jsx), so the numbers shown here always
   match what Accounts reports for the same month. */
const FIN_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtPKR = (n) => `PKR ${(Number(n) || 0).toLocaleString('en-PK')}`;

/* Gradient stat-tile palette — reuses hex values already present
   elsewhere in this file (dash-pri / adm-tc gradients) so the new
   colourful tiles stay inside the existing design system. */
const TILE_GRADIENT = {
  students:   ['#1E3A8A', '#2563EB'],
  hr:         ['#6D28D9', '#7C3AED'],
  crm:        ['#BE123C', '#E11D48'],
  exam:       ['#3730A3', '#4F46E5'],
  activities: ['#B45309', '#D97706'],
  fee:        ['#15803D', '#22C55E'],
  audit:      ['#B91C1C', '#DC2626'],
};

/* ─── Custom tooltip used by every Recharts chart ─────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card, #fff)',
      border: '1px solid var(--border-light, #E2E8F0)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(15, 23, 42, .08)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard({ visibility, toast, navigate = () => {}, openActivityCalendar = () => {} }) {
  const { moduleActive, user, session, ownerName } = visibility;
  const { isActive } = useModules();      /* per-spec: explicit useModules guard for new sections */

  const NAV_LABELS = {
    students: 'Students', hr: 'Human Resource', crm: 'Admission CRM',
    exam: 'Examination', acad: 'Academics', fee: 'Fee', accounts: 'Accounts',
    inventory: 'Inventory', att: 'Attendance', appraisal: 'Staff Appraisals',
    audit: 'Audit Logs', tt: 'Time Table', paper: 'Paper Generator',
  };
  const openModule = (target) => {
    if (!target) return;
    navigate(target);
    toast(`Opening ${NAV_LABELS[target] || target.toUpperCase()}…`, 'info');
  };

  /* ─── Real dashboard data — ek hi API se poora dashboard ────────
     null = loading; fail hone par {} taake koi section crash na ho. */
  const [dash, setDash] = useState(null);
  const [dashErr, setDashErr] = useState(false);
  useEffect(() => {
    let alive = true;
    const { month, year } = dashboardService.currentMonthYear();
    dashboardService.getDashboard(month, year)
      .then(d => { if (alive) setDash(d || {}); })
      .catch(() => { if (alive) { setDash({}); setDashErr(true); } });
    return () => { alive = false; };
  }, []);

  /* Safe accessors — har section 0/[] fallback ke sath real data padhta hai. */
  const D   = dash || {};
  const kpi = D.Kpi || {};
  const snap = D.ModuleSnapshot || {};
  const fee  = D.FeeAnalytics || {};
  const app  = Array.isArray(D.AppAdoption) ? D.AppAdoption : [];
  const appOf = (t) => app.find(a => a.AccountType === t) || { Total: 0, Downloaded: 0, Pending: 0 };
  const todaysAtt = D.TodaysAttendance || { Students: {}, Staff: {} };
  const stuAtt = todaysAtt.Students || {}; const staffAtt = todaysAtt.Staff || {};
  const lessonPlans = Array.isArray(D.LessonPlanAnalytics) ? D.LessonPlanAnalytics : [];
  const paperStats  = Array.isArray(D.PaperGeneratorStats) ? D.PaperGeneratorStats : [];
  const stuBdays   = Array.isArray(D.StudentBirthdays) ? D.StudentBirthdays : [];
  const staffBdays = Array.isArray(D.StaffBirthdays) ? D.StaffBirthdays : [];
  const upActivities = Array.isArray(D.UpcomingActivities) ? D.UpcomingActivities : [];
  const actSummary = D.ActivitiesSummary || {};
  const announcements = Array.isArray(D.Announcements) ? D.Announcements : [];
  const finOverview = D.FinancialOverview || {};
  const revenueStreams = Array.isArray(D.RevenueStreams) ? D.RevenueStreams : [];
  const plTrend = Array.isArray(D.ProfitLossTrend) ? D.ProfitLossTrend : [];
  const pctOf = (n, d) => (Number(d) > 0 ? Math.round((Number(n) / Number(d)) * 100) : 0);

  /* Fee ring/progress percentages — real data se compute. */
  const feePaidPct = pctOf(fee.FeeReceived, fee.CurrentMonthFeePosition);
  const feePendingPct = 100 - feePaidPct;

  /* Previous Dues / Students-with-Dues / Total Net Receivable — sab SEEDHA
     get-dashboard ke FeeAnalytics se (koi extra API nahi). Backend jab in fields
     ko sahi bharega (abhi PreviousDues 0 aata hai) to yahan khud aa jayega. */
  const previousDuesVal = fee.PreviousDues || 0;
  const studentsWithDuesVal = fee.StudentsPending || 0;
  const totalNetReceivableVal = fee.TotalNetReceivable;

  /* Teachers / Parents mobile-app adoption cards.
     Total ab REAL active counts se (Kpi.ActiveStaff / Kpi.ActiveStudents) — wahi jo
     hero KPIs aur report dikhate hain — taake sab consistent rahe (pehle AppAdoption
     ka alag total 10/17 aata tha jo 12 staff / 15 students se match nahi karta tha).
     Downloaded dashboard ki asli value se; Pending = Total − Downloaded. */
  const teacherApp = appOf('Teacher');
  const parentApp  = appOf('Parent');
  const teacherTotal = Number(kpi.ActiveStaff)    || Number(teacherApp.Total) || 0;
  const parentTotal  = Number(kpi.ActiveStudents) || Number(parentApp.Total)  || 0;
  const teacherDl    = Number(teacherApp.Downloaded) || 0;
  const parentDl     = Number(parentApp.Downloaded)  || 0;
  const teacherAppData = { total: teacherTotal, downloaded: teacherDl, pending: Math.max(0, teacherTotal - teacherDl), pct: pctOf(teacherDl, teacherTotal) };
  const parentAppData  = { total: parentTotal,  downloaded: parentDl,  pending: Math.max(0, parentTotal - parentDl),   pct: pctOf(parentDl, parentTotal) };

  /* Today's Attendance — SEEDHA get-dashboard ke TodaysAttendance se (koi extra
     attendance API nahi). Present/Absent/Leave + Total wahi backend deta hai. */
  const studentAttData = {
    total: stuAtt.StudentTotal || 0, present: stuAtt.StudentPresent || 0,
    absent: stuAtt.StudentAbsent || 0, leave: stuAtt.StudentLeave || 0,
    percentage: pctOf(stuAtt.StudentPresent, stuAtt.StudentTotal),
  };
  const staffAttData = {
    total: staffAtt.StaffTotal || 0, present: staffAtt.StaffPresent || 0,
    absent: staffAtt.StaffAbsent || 0, leave: staffAtt.StaffLeave || 0,
    percentage: pctOf(staffAtt.StaffPresent, staffAtt.StaffTotal),
  };

  /* Revenue Streams — API [{Month, Head, Amount}] ko month-wise total me. */
  const revenueChart = useMemo(() => {
    const byMonth = {};
    revenueStreams.forEach(r => { const m = Number(r.Month); byMonth[m] = (byMonth[m] || 0) + (Number(r.Amount) || 0); });
    return Object.keys(byMonth).sort((a, b) => a - b).map(m => ({ m: SHORT_MONTHS[Number(m) - 1] || m, amount: byMonth[m] }));
  }, [revenueStreams]);
  const revenueTotal = useMemo(() => revenueStreams.reduce((s, r) => s + (Number(r.Amount) || 0), 0), [revenueStreams]);

  /* Profit/Loss trend — API [{Month, Income, Expenses, ProfitLoss}]. */
  const profitChart = useMemo(() => plTrend.map(p => ({
    m: SHORT_MONTHS[Number(p.Month) - 1] || p.Month,
    revenue: Number(p.Income) || 0, expense: Number(p.Expenses) || 0, pl: Number(p.ProfitLoss) || 0,
  })), [plTrend]);
  const plNet = useMemo(() => plTrend.reduce((s, p) => s + (Number(p.ProfitLoss) || 0), 0), [plTrend]);

  /* ─── Module tiles — sirf wahi jinke liye API data hai ─────────
     REMOVED: CRM/Active Leads, Exams Scheduled, Today's Activity (audit)
     kyunke get-dashboard in ka data nahi deta. */
  const tiles = [
    moduleActive('students') && { key: 'students', accent: MODULE_COLOR.students, label: 'Students', icon: 'fa-user-graduate',
      value: snap.TotalStudents || 0,
      meta: <><span className="dash-tile-meta-pill">+{snap.NewStudentsThisWeek || 0} this week</span><span>{snap.InactiveStudents || 0} inactive</span></>,
      target: 'students' },
    moduleActive('hr') && { key: 'hr', accent: MODULE_COLOR.hr, label: 'Employees', icon: 'fa-users',
      value: snap.TotalEmployees || 0,
      meta: <><span className="dash-tile-meta-pill">{snap.TotalDepartments || 0} depts</span><span>{snap.InactiveEmployees || 0} inactive</span></>,
      target: 'hr' },
    moduleActive('academics') && { key: 'activities', accent: MODULE_COLOR.academics, label: 'Activities', icon: 'fa-calendar-days',
      value: actSummary.TotalActivities || 0,
      meta: <><span className="dash-tile-meta-pill">{actSummary.UpcomingCount || 0} upcoming</span><span>{actSummary.OngoingCount || 0} ongoing</span></>,
      target: 'acad' },
    moduleActive('fee') && { key: 'fee', accent: MODULE_COLOR.fee, label: 'Fee Collection', icon: 'fa-money-bill-wave',
      value: <>{feePaidPct}<small>%</small></>,
      meta: <><span className="dash-tile-meta-pill">{fee.StudentsPending || 0} pending</span></>,
      target: 'fee' },
  ].filter(Boolean);

  /* Announcements — API array khaali hai to empty-state; pill sirf 'new' par. */
  const latestAnnouncement = announcements[0] || null;
  const newAnnouncementCount = announcements.filter(a => a.status === 'new').length;

  /* Greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });
  /* Greeting me asli logged-in owner ka pehla naam (visibility.ownerName), mock user nahi. */
  const firstName = ((ownerName || user.name || '').replace(/Dr\.|Mr\.|Ms\.|Mrs\./, '').trim().split(' ')[0]) || 'there';

  /* ─── New section local state ──────────────────────────────── */
  const [birthdayTab, setBirthdayTab] = useState('all');

  /* Monthly Financial Summary — reads the same Accounts transaction
     ledger as Accounts → Reports (getAccTxns), so Expenses/Income/
     Net P&L here always match what that module reports. */
  /* Monthly Financial Summary — ab get-dashboard ke FinancialOverview
     se aata hai (current month/year). Label current month ka. */
  const financeSummary = useMemo(() => {
    const cmy = dashboardService.currentMonthYear();
    return {
      label: `${FIN_MONTH_NAMES[cmy.month - 1]} ${cmy.year}`,
      income: Number(finOverview.OverallIncome) || 0,
      expense: Number(finOverview.OverallExpenses) || 0,
      pl: Number(finOverview.NetProfitLoss) || 0,
    };
  }, [finOverview]);

  /* Top-card modals */
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showReport,        setShowReport]        = useState(null); /* 'teachers' | 'parents' | null */

  /* Lesson Plan + Paper Generator — ab poore API arrays se (class-wise
     mock hata diya, kyunke API sirf subject-wise data deta hai). */
  const lpData    = lessonPlans; /* [{SubjectName, ClassworkCount, NotebookCount}] */
  const paperData = paperStats;  /* [{SubjectName, TotalGenerated}] */
  const lpMaxCw = useMemo(() => (lpData.length ? Math.max(...lpData.map(d => Number(d.ClassworkCount) || 0)) : 0), [lpData]);
  const paperTotal = useMemo(() => paperData.reduce((s, p) => s + (Number(p.TotalGenerated) || 0), 0), [paperData]);

  const studentBdays = isActive('students') ? stuBdays : [];
  const teacherBdays = isActive('hr') ? staffBdays : [];
  const showStudents = birthdayTab === 'all' || birthdayTab === 'students';
  const showTeachers = birthdayTab === 'all' || birthdayTab === 'teachers';

  /* Birthday helpers — API item {FirstName, LastName, DateOfBirth, PersonType}. */
  const realTodayDay = new Date().getDate();
  const bdayName  = (b) => `${b.FirstName || ''} ${b.LastName || ''}`.trim() || '—';
  const bdayDay   = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? 0 : d.getDate(); };
  const bdayLabel = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }); };

  /* Current month/year label — banners aur activity headers ke liye. */
  const cmyLabel = (() => { const c = dashboardService.currentMonthYear(); return `${FIN_MONTH_NAMES[c.month - 1]} ${c.year}`; })();

  /* Upcoming Activities helpers — API {Title, StartAt, EndAt}. */
  const actDateLabel = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const actDaysAway  = (iso) => { const d = new Date(iso); if (isNaN(d.getTime())) return 0; return Math.round((d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000); };

  return (
    <>
      <style>{DASH_CSS}</style>
      <style>{ADM_NEW_CSS}</style>

      {/* ═════════ 0. UNIVERSAL SEARCH BAR ═════════
            Sits at the top of the Admin / Principal Dashboard.
            Permission predicate gates each module's results — today the
            admin sees everything, but the prop is wired so the backend
            can clamp it later. Module-activation gating happens inside
            the hook via ModuleContext. */}
      <div className="adm-uvs-row">
        <UniversalSearch
          onNavigate={(target, params) => {
            navigate(target, params);
            toast(`Opening ${NAV_LABELS[target] || target.toUpperCase()}…`, 'info');
          }}
          canAccess={(_moduleId) => true /* TODO: hook into User Permissions when API lands */}
          sessionId={session?.id || null}
          toast={toast}
          placeholder="Search students, employees, lesson plans, exams, fees…"
        />
      </div>

      {/* ═════════ 1. HERO GREETING (Page Header — kept) ═════════ */}
      <div className="dash-hero">
        <div className="dash-hero-l">
          <div className="dash-hero-greet">
            <span className="dash-hero-wave">👋</span>
            {greeting}, {firstName}
          </div>
          <div className="dash-hero-sub">
            <b>{todayLabel}</b> · Session {session.label}.
            {moduleActive('academics') && <> You have <b>{actSummary.UpcomingCount || 0}</b> upcoming activities.</>}
          </div>
        </div>
        <div className="dash-hero-r">
          {moduleActive('students') && (
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{kpi.ActiveStudents || 0}</div>
              <div className="dash-hero-stat-lbl">Active Students</div>
            </div>
          )}
          {moduleActive('hr') && (
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{kpi.ActiveStaff || 0}<small>/{snap.TotalEmployees || 0}</small></div>
              <div className="dash-hero-stat-lbl">Staff Active</div>
            </div>
          )}
          {moduleActive('attendance') && (
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{studentAttData.percentage}<small>%</small></div>
              <div className="dash-hero-stat-lbl">Attendance Today</div>
            </div>
          )}
        </div>
      </div>

      {/* ═════════ TOP CARDS ROW ═════════
          1. School Mentor Announcements
          2. Teachers Mobile App Status
          3. Parents Mobile App Status                            */}
      <div className="adm-top-cards">

        {/* ── Card 1: Announcements ── */}
        <div className="adm-tc adm-tc--announce">
          <div className="adm-tc-h">
            <div className="adm-tc-h-l">
              <div className="adm-tc-ic adm-tc-ic--brand">
                <i className="fa-solid fa-bullhorn" aria-hidden="true"></i>
              </div>
              <div>
                <div className="adm-tc-t">School Mentor Announcements</div>
                <div className="adm-tc-s">{latestAnnouncement ? latestAnnouncement.sender : 'School Mentor — HQ'}</div>
              </div>
            </div>
            {/* Only show pill when there are actual unread items */}
            {newAnnouncementCount > 0 && (
              <Tooltip text={`${newAnnouncementCount} unread message${newAnnouncementCount > 1 ? 's' : ''}`}>
                <span className="adm-tc-pill adm-tc-pill--new">
                  <span className="adm-tc-pill-dot" /> {newAnnouncementCount}
                </span>
              </Tooltip>
            )}
          </div>

          <div className="adm-tc-body">
            {latestAnnouncement ? (
              <>
                <div className="adm-tc-an-title">{latestAnnouncement.title}</div>
                <div className="adm-tc-an-preview">{latestAnnouncement.preview}</div>
              </>
            ) : (
              <>
                <div className="adm-tc-an-title">No announcements yet</div>
                <div className="adm-tc-an-preview">New announcements from School Mentor will appear here.</div>
              </>
            )}
          </div>

          <div className="adm-tc-foot">
            <span className="adm-tc-meta">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>
              {latestAnnouncement ? `${latestAnnouncement.date} · ${latestAnnouncement.time}` : '—'}
            </span>
            <Tooltip text="View all announcements">
              <button
                type="button"
                className="adm-tc-btn"
                onClick={() => setShowAnnouncements(true)}
              >
                View Details <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ── Card 2: Teachers Mobile App ── */}
        <AppStatusCard
          tone="green"
          title="Teachers Mobile App"
          subtitle="Adoption status"
          icon="fa-chalkboard-user"
          data={teacherAppData}
          ctaLabel="Download Report"
          ctaIcon="fa-file-pdf"
          onCta={() => setShowReport('teachers')}
        />

        {/* ── Card 3: Parents Mobile App ── */}
        <AppStatusCard
          tone="amber"
          title="Parents Mobile App"
          subtitle="Adoption status"
          icon="fa-people-roof"
          data={parentAppData}
          ctaLabel="Download Report"
          ctaIcon="fa-file-pdf"
          onCta={() => setShowReport('parents')}
        />
      </div>

      {/* ─── Modals (rendered on demand) ─── */}
      {showAnnouncements && (
        <AnnouncementsModal
          announcements={announcements}
          onClose={() => setShowAnnouncements(false)}
          toast={toast}
        />
      )}
      {showReport && (
        <AppPendingReportModal
          mode={showReport}
          counts={showReport === 'teachers' ? appOf('Teacher') : appOf('Parent')}
          onClose={() => setShowReport(null)}
          toast={toast}
        />
      )}

      {tiles.length > 0 && (
        <div className="dash-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title">
              <i className="fa-solid fa-chart-simple" aria-hidden="true"></i> Live Module Snapshot
            </div>
            <span className="dash-sec-sub">Click any tile to open its module</span>
          </div>
          <div className="dash-tiles">
            {tiles.map(t => {
              const grad = TILE_GRADIENT[t.key];
              return (
              <Tooltip key={t.key} text={`Open ${t.label}`}>
                <div
                  className={`dash-tile${grad ? ' dash-tile--grad' : ''}`}
                  style={{
                    '--tile-accent': t.accent.stroke,
                    '--tile-soft': t.accent.soft,
                    ...(grad ? { '--tile-grad-a': grad[0], '--tile-grad-b': grad[1] } : {}),
                  }}
                  role="button" tabIndex={0}
                  onClick={() => openModule(t.target)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModule(t.target); } }}
                >
                  <div className="dash-tile-row">
                    <div className="dash-tile-ic"><i className={`fa-solid ${t.icon}`} aria-hidden="true"></i></div>
                    <div className="dash-tile-lbl">{t.label}</div>
                    <div className="dash-tile-arrow"><i className="fa-solid fa-arrow-up" aria-hidden="true"></i></div>
                  </div>
                  <div className="dash-tile-val">{t.value}</div>
                  <div className="dash-tile-meta">{t.meta}</div>
                </div>
              </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* ═════════ 3. FEE ANALYTICS ═════════ */}
      {isActive('fee') && (
        <div className="dash-sec adm-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title"><i className="fa-solid fa-coins" aria-hidden="true"></i> Fee Analytics</div>
            <button type="button" className="dash-sec-link" onClick={() => openModule('fee')}>
              Open Fee <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </button>
          </div>

          {/* ═════════ TOP ROW — 3 summary cards ═════════ */}
          <div className="fa-top-grid">

            {/* Card 1 — Current Month Fee Position (primary summary) */}
            <div className="stat-card fee-card fa-card fc-tone--brand fa-card--primary">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-money-check-dollar" aria-hidden="true"></i>
                </div>
                <div className="fc-title">Current Month Fee Position</div>
              </div>
              <div className="fc-amount fa-amount--lg">{fmtPKR(fee.CurrentMonthFeePosition)}</div>
              <div className="fc-divider" />
              <div className="fa-meta-rows">
                <div className="fa-meta-row">
                  <span className="fa-meta-lbl">
                    <i className="fa-solid fa-tag" aria-hidden="true"></i> Discount Given
                  </span>
                  <span className="fa-meta-val fa-meta-val--amber">{fmtPKR(fee.DiscountGiven)}</span>
                </div>
                <div className="fa-meta-row">
                  <span className="fa-meta-lbl">
                    <i className="fa-solid fa-file-invoice" aria-hidden="true"></i> Challans Generated
                  </span>
                  <span className="fa-meta-val">
                    <span className="fc-highlight">{fee.ChallansGenerated || 0}</span><span className="fa-meta-div">/</span><span className="fa-meta-total">{fee.TotalStudentsForChallanRatio || 0}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2 — Previous Dues */}
            <div className="stat-card fee-card fa-card fc-tone--red fc-bordered">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                </div>
                <div className="fc-title fc-title--red">Previous Dues</div>
              </div>
              <div className="fc-amount fc-amount--red fa-amount--lg">{fmtPKR(previousDuesVal)}</div>
              <div className="fc-divider" />
              <div className="fa-meta-rows">
                <div className="fa-meta-row">
                  <span className="fa-meta-lbl">
                    <i className="fa-solid fa-users" aria-hidden="true"></i> Students with Dues
                  </span>
                  <span className="fa-meta-val fa-meta-val--red">{studentsWithDuesVal}</span>
                </div>
                <div className="fa-meta-row fa-meta-row--muted">
                  <i className="fa-solid fa-clock" aria-hidden="true"></i>
                  <span>Carried from past months</span>
                </div>
              </div>
            </div>

            {/* Card 3 — Total Net Receivable */}
            <div className="stat-card fee-card fa-card fc-tone--slate fa-card--total">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-scale-balanced" aria-hidden="true"></i>
                </div>
                <div className="fc-title">Total Net Receivable</div>
              </div>
              <div className="fc-amount fa-amount--lg">{fmtPKR(totalNetReceivableVal)}</div>
              <div className="fa-formula">
                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>Current Month Net Receivable + Previous Dues</span>
              </div>
              <div className="fc-divider" />
              <div className="fa-formula-breakdown">
                <div>
                  <span className="fa-bd-lbl">This Month</span>
                  <span className="fa-bd-val">{fmtPKR(fee.CurrentMonthFeePosition)}</span>
                </div>
                <span className="fa-bd-op">+</span>
                <div>
                  <span className="fa-bd-lbl">Previous</span>
                  <span className="fa-bd-val fa-bd-val--red">{fmtPKR(previousDuesVal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═════════ BOTTOM ROW — 2 LARGE status cards ═════════ */}
          <div className="fa-bottom-grid">

            {/* Card 4 — Fee Received (large with progress) */}
            <div className="stat-card fee-card fa-card fa-large fc-tone--green fc-bordered fc-tint--green">
              <div className="fa-large-row">
                <div className="fa-large-l">
                  <div className="fc-header">
                    <div className="fc-icon-chip">
                      <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
                    </div>
                    <div className="fc-title">Fee Received</div>
                  </div>
                  <div className="fc-amount fc-amount--green fa-amount--xl">{fmtPKR(fee.FeeReceived)}</div>
                  <div className="fa-status-meta">
                    <i className="fa-solid fa-user-check" aria-hidden="true"></i>
                    <span>Students Paid:&nbsp;</span>
                    <span className="fa-status-strong">{fee.StudentsPaid || 0}<span className="fa-meta-div">/</span>{fee.TotalStudentsWithChallan || 0}</span>
                  </div>
                </div>
                <div className="fa-large-r">
                  <div className="fa-ring fa-ring--green" style={{ '--ring-pct': feePaidPct }}>
                    <svg viewBox="0 0 36 36" width="100%" height="100%">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(22,163,74,.15)" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#16A34A" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray="100, 100"
                        strokeDashoffset={100 - feePaidPct}
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <div className="fa-ring-text">
                      <div className="fa-ring-pct">{feePaidPct}%</div>
                      <div className="fa-ring-lbl">Paid</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="fa-progress">
                <div className="fa-progress-h">
                  <span>Collection Progress</span>
                  <span><b>{fee.StudentsPaid || 0}</b> of {fee.TotalStudentsWithChallan || 0} students</span>
                </div>
                <div className="fa-progress-track">
                  <div className="fa-progress-fill fa-progress-fill--green" style={{ width: `${feePaidPct}%` }} />
                </div>
              </div>
            </div>

            {/* Card 5 — Pending Fee (large with progress) */}
            <div className="stat-card fee-card fa-card fa-large fc-tone--red fc-bordered">
              <div className="fa-large-row">
                <div className="fa-large-l">
                  <div className="fc-header">
                    <div className="fc-icon-chip">
                      <i className="fa-solid fa-hourglass-half" aria-hidden="true"></i>
                    </div>
                    <div className="fc-title fc-title--red">Pending Fee</div>
                  </div>
                  <div className="fc-amount fc-amount--red fa-amount--xl">{fmtPKR(fee.FeePending)}</div>
                  <div className="fa-status-meta">
                    <i className="fa-solid fa-user-clock" aria-hidden="true"></i>
                    <span>Students Pending:&nbsp;</span>
                    <span className="fa-status-strong fa-status-strong--red">{fee.StudentsPending || 0}<span className="fa-meta-div">/</span>{fee.TotalStudentsWithChallan || 0}</span>
                  </div>
                </div>
                <div className="fa-large-r">
                  <div className="fa-ring fa-ring--red" style={{ '--ring-pct': feePendingPct }}>
                    <svg viewBox="0 0 36 36" width="100%" height="100%">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(220,38,38,.15)" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#DC2626" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray="100, 100"
                        strokeDashoffset={100 - feePendingPct}
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <div className="fa-ring-text">
                      <div className="fa-ring-pct">{feePendingPct}%</div>
                      <div className="fa-ring-lbl">Pending</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="fa-progress">
                <div className="fa-progress-h">
                  <span>Recovery Action Needed</span>
                  <span><b>{fee.StudentsPending || 0}</b> of {fee.TotalStudentsWithChallan || 0} students</span>
                </div>
                <div className="fa-progress-track">
                  <div className="fa-progress-fill fa-progress-fill--red" style={{ width: `${feePendingPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Download / Print Report link below the grid */}
          <div className="adm-link-row">
            <button
              type="button"
              className="adm-link-btn"
              onClick={() => { openModule('fee'); toast('Fee report opening...', 'info'); }}
            >
              Download/Print Report <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      )}

      <div className="adm-divider" />

      {/* OneLink Payments section hata diya — get-dashboard API OneLink/bank
          payment data nahi deti, is liye dummy card show nahi karte. */}

      {/* ═════════ ACCOUNTS / REVENUE ═════════ */}
      {isActive('accounts') && (
        <div className="dash-sec adm-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title"><i className="fa-solid fa-calculator" aria-hidden="true"></i> Financial Overview</div>
            <span className="adm-h-meta">{cmyLabel}</span>
          </div>

          {/* ─── Monthly Financial Summary (NEW) ───
              Parent card + month selector, 3 sub-cards reading the same
              Accounts ledger (getAccTxns) that Accounts → Reports uses,
              via the identical per-month reduce. No new backend calls. */}
          <div className="fin-summary-card">
            <div className="fin-summary-head">
              <div className="fin-summary-head-l">
                <div className="fin-summary-ic"><i className="fa-solid fa-sack-dollar" aria-hidden="true"></i></div>
                <div>
                  <div className="fin-summary-t">Monthly Financial Summary</div>
                  <div className="fin-summary-s">{financeSummary.label} · financial overview</div>
                </div>
              </div>
              <span className="fin-summary-month-lbl">{financeSummary.label}</span>
            </div>

            <div className="fin-summary-grid">
              <div className="fee-card fa-card fc-tone--red fc-bordered fin-summary-sub">
                <div className="fc-header">
                  <div className="fc-icon-chip"><i className="fa-solid fa-arrow-trend-down" aria-hidden="true"></i></div>
                  <div className="fc-title fc-title--red">Overall Expenses</div>
                </div>
                <div className="fc-amount fc-amount--red fa-amount--lg">{fmtPKR(financeSummary.expense)}</div>
                <div className="fc-support">
                  <i className="fa-solid fa-calendar" aria-hidden="true"></i>
                  <span>{financeSummary.label}</span>
                </div>
              </div>

              <div className="fee-card fa-card fc-tone--green fc-bordered fin-summary-sub">
                <div className="fc-header">
                  <div className="fc-icon-chip"><i className="fa-solid fa-arrow-trend-up" aria-hidden="true"></i></div>
                  <div className="fc-title">Overall Income</div>
                </div>
                <div className="fc-amount fc-amount--green fa-amount--lg">{fmtPKR(financeSummary.income)}</div>
                <div className="fc-support">
                  <i className="fa-solid fa-calendar" aria-hidden="true"></i>
                  <span>{financeSummary.label}</span>
                </div>
              </div>

              <div className={`fee-card fa-card fc-bordered fin-summary-sub ${financeSummary.pl >= 0 ? 'fc-tone--green' : 'fc-tone--red'}`}>
                <div className="fc-header">
                  <div className="fc-icon-chip">
                    <i className={`fa-solid ${financeSummary.pl >= 0 ? 'fa-scale-balanced' : 'fa-triangle-exclamation'}`} aria-hidden="true"></i>
                  </div>
                  <div className={`fc-title${financeSummary.pl < 0 ? ' fc-title--red' : ''}`}>Net Profit / Loss</div>
                </div>
                <div className={`fc-amount fa-amount--lg ${financeSummary.pl >= 0 ? 'fc-amount--green' : 'fc-amount--red'}`}>
                  {financeSummary.pl >= 0 ? '+' : '−'}{fmtPKR(Math.abs(financeSummary.pl))}
                </div>
                <div className="fc-support">
                  <i className="fa-solid fa-calendar" aria-hidden="true"></i>
                  <span>{financeSummary.label}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="adm-2col">
            {/* Revenue Streams */}
            <div className="adm-chart-card">
              <div className="adm-card-h">
                <div className="adm-card-h-t">Revenue Streams</div>
                <span className="adm-card-h-meta">Total: <b>{fmtPKR(revenueTotal)}</b></span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revTuition" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4169E1" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#4169E1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="amount" name="Revenue" stroke="#4169E1" strokeWidth={2.2} fill="url(#revTuition)" dot={{ r: 3, stroke: '#4169E1', fill: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="adm-legend">
                <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#4169E1' }} />Revenue</span>
              </div>
            </div>

            {/* Profit/Loss */}
            <div className="adm-chart-card">
              <div className="adm-card-h">
                <div className="adm-card-h-t">Profit/Loss Overview</div>
                <span className="adm-card-h-meta" style={{ color: plNet >= 0 ? '#16A34A' : '#DC2626', fontWeight: 800 }}>Net Profit / Loss: <b>{plNet >= 0 ? '+' : '−'}{fmtPKR(Math.abs(plNet))}</b></span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={profitChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Bar dataKey="pl"      name="Profit/Loss" fill="#3DBA8C" fillOpacity={0.6} radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="revenue" name="Revenue"   stroke="#4169E1" strokeWidth={2.2} dot={{ r: 3, stroke: '#4169E1', fill: '#fff', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="expense" name="Expenses"  stroke="#F87171" strokeWidth={2.2} dot={{ r: 3, stroke: '#F87171', fill: '#fff', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="adm-legend">
                <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#4169E1' }} />Revenue</span>
                <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#F87171' }} />Expenses</span>
                <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#3DBA8C' }} />Profit/Loss</span>
              </div>
            </div>
          </div>

        </div>
      )}

      <div className="adm-divider" />

      {/* ═════════ TODAY'S ATTENDANCE ═════════
          ATTENDANCE INTEGRATION NOTE:
          These cards currently display mock data sourced from
          dashboardData.js → STUDENT_ATTENDANCE_TODAY / STAFF_ATTENDANCE_TODAY.

          To connect live data:
          1. Import attendance store/context when available
             (e.g. useAttendance from src/services/attendanceService.js)
          2. Replace STUDENT_ATTENDANCE_TODAY / STAFF_ATTENDANCE_TODAY
             with data from useAttendance() hook or API response
          3. Field names used here match the Attendance module schema
             (constants/attendance.js · mock/attendance.js):
             - Student class row: { cls, sec, total, present, absent,
                                    leave, marked, teacher, markedBy,
                                    markedFrom, markedTime }
             - Staff row:         { name, empId, desig, dept, status,
                                    inTime, outTime, from, marked }
             - status values:     'present' | 'absent' | 'leave' | ''
             - status constants:  ATTENDANCE_STATUS.{PRESENT,ABSENT,LEAVE,PENDING}
                                  STAFF_ATTENDANCE_STATUS.{PRESENT,ABSENT,LEAVE}
       */}
      {moduleActive('attendance') && <AttendanceSection openModule={openModule} studentData={studentAttData} staffData={staffAttData} />}

      <div className="adm-divider" />

      {/* ═════════ 4. LESSON PLAN ANALYTICS ═════════ */}
      {isActive('academics') && (
        <div className="dash-sec adm-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title"><i className="fa-solid fa-book-open-reader" aria-hidden="true"></i> Lesson Plan Analytics</div>
            <span className="adm-h-meta">All Subjects</span>
          </div>

          <div className="adm-2col">
            <div className="adm-chart-card">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={lpData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lpClasswork" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1E40AF" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#1E40AF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lpNotebook" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16A34A" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="SubjectName" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="ClassworkCount" name="Classwork" stroke="#1E40AF" strokeWidth={2.2} fill="url(#lpClasswork)" dot={{ r: 3, stroke: '#1E40AF', fill: '#fff', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="NotebookCount"  name="Notebook"  stroke="#16A34A" strokeWidth={2.2} fill="url(#lpNotebook)"  dot={{ r: 3, stroke: '#16A34A', fill: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="adm-legend">
                <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#1E40AF' }} />Classwork</span>
                <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#16A34A' }} />Notebook</span>
              </div>
            </div>

            <div className="adm-side-card">
              <div className="adm-side-title">Subject-wise Completion</div>
              <div className="adm-bars">
                {lpData.length === 0 && (
                  <div className="adm-bar-row"><div className="adm-bar-lbl">No lesson plan data yet</div></div>
                )}
                {lpData.map(d => {
                  const pct = lpMaxCw > 0 ? ((Number(d.ClassworkCount) || 0) / lpMaxCw) * 100 : 0;
                  return (
                    <div key={d.SubjectName} className="adm-bar-row">
                      <div className="adm-bar-lbl">{d.SubjectName}</div>
                      <div className="adm-bar-track">
                        <div className="adm-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="adm-divider" />

      {/* ═════════ 5. PAPER GENERATOR ═════════ */}
      {isActive('paper_generator') && (
        <div className="dash-sec adm-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title"><i className="fa-solid fa-scroll" aria-hidden="true"></i> Question Paper Generator</div>
            <div className="adm-h-right">
              <span className="adm-h-meta">Total: <b>{paperTotal} Papers</b></span>
            </div>
          </div>

          <div className="adm-2col">
            <div className="adm-side-card">
              <div className="adm-side-tag">Recent Question Papers</div>
              <table className="adm-table">
                <thead>
                  <tr><th>Subject</th><th>Total Generated Question Papers</th></tr>
                </thead>
                <tbody>
                  {paperData.length === 0 ? (
                    <tr><td colSpan={2}>No question papers generated yet</td></tr>
                  ) : paperData.map(p => (
                    <tr key={p.SubjectName}>
                      <td><b>{p.SubjectName}</b></td>
                      <td>{p.TotalGenerated} Question Papers</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="adm-chart-card">
              <div className="adm-side-tag">Paper Generation Statistics</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={paperData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="SubjectName" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Bar dataKey="TotalGenerated" name="Papers" radius={[6, 6, 0, 0]} fill="#4169E1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="adm-divider" />

      {/* ═════════ 7. BIRTHDAYS THIS MONTH ═════════ */}
      {(isActive('students') || isActive('hr')) && (
        <div className="dash-sec adm-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title">
              <span className="adm-h-ic adm-h-ic--cake"><i className="fa-solid fa-cake-candles" aria-hidden="true"></i></span>
              Birthdays This Month
            </div>
            <div className="adm-seg" role="tablist" aria-label="Birthday filter">
              {[
                { id: 'students', lbl: 'Students',  hide: !isActive('students') },
                { id: 'teachers', lbl: 'Teachers',  hide: !isActive('hr') },
                { id: 'all',      lbl: 'All' },
              ].filter(t => !t.hide).map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`adm-seg-btn${birthdayTab === t.id ? ' on' : ''}`}
                  onClick={() => setBirthdayTab(t.id)}
                  role="tab"
                  aria-selected={birthdayTab === t.id}
                >{t.lbl}</button>
              ))}
            </div>
          </div>

          <div className="adm-info-banner">
            <i className="fa-solid fa-calendar" aria-hidden="true"></i>
            <span>Showing birthdays for {cmyLabel}</span>
          </div>

          <div className="adm-bday-row">
            {isActive('students') && showStudents && (
              <div className="adm-bday-col">
                <div className="adm-side-tag">
                  Students
                  <span className="adm-pill-blue">{studentBdays.length}</span>
                </div>
                <div className="adm-bday-list">
                  {studentBdays.length === 0 && (
                    <div className="adm-bday-meta">No student birthdays this month</div>
                  )}
                  {studentBdays.map(b => {
                    const day = bdayDay(b.DateOfBirth);
                    const isToday = day === realTodayDay;
                    const isTomorrow = day === realTodayDay + 1;
                    return (
                      <div
                        key={b.ID ?? bdayName(b)}
                        className={`adm-bday-card${isToday ? ' today' : ''}`}
                      >
                        <div className="adm-bday-av">{initials(bdayName(b))}</div>
                        <div className="adm-bday-info">
                          <div className="adm-bday-name">{bdayName(b)}</div>
                          <div className="adm-bday-meta">{b.PersonType || 'Student'}</div>
                        </div>
                        {isToday ? (
                          <span className="adm-pill-green">Today! 🎂</span>
                        ) : isTomorrow ? (
                          <span className="adm-pill-amber">Tomorrow</span>
                        ) : (
                          <span className="adm-pill-blue">{bdayLabel(b.DateOfBirth)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isActive('hr') && showTeachers && (
              <div className="adm-bday-col">
                <div className="adm-side-tag">
                  Teachers &amp; Staff
                  <span className="adm-pill-blue">{teacherBdays.length}</span>
                </div>
                <div className="adm-bday-list">
                  {teacherBdays.length === 0 && (
                    <div className="adm-bday-meta">No staff birthdays this month</div>
                  )}
                  {teacherBdays.map(b => {
                    const day = bdayDay(b.DateOfBirth);
                    const isToday = day === realTodayDay;
                    const isTomorrow = day === realTodayDay + 1;
                    return (
                      <div
                        key={b.ID ?? bdayName(b)}
                        className={`adm-bday-card${isToday ? ' today' : ''}`}
                      >
                        <div className="adm-bday-av adm-bday-av--purple">{initials(bdayName(b))}</div>
                        <div className="adm-bday-info">
                          <div className="adm-bday-name">{bdayName(b)}</div>
                          <div className="adm-bday-meta">{b.PersonType || 'Staff'}</div>
                        </div>
                        {isToday ? (
                          <span className="adm-pill-green">Today! 🎂</span>
                        ) : isTomorrow ? (
                          <span className="adm-pill-amber">Tomorrow</span>
                        ) : (
                          <span className="adm-pill-blue">{bdayLabel(b.DateOfBirth)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="adm-divider" />

      {/* ═════════ 8. UPCOMING ACTIVITIES ═════════ */}
      <div className="dash-sec adm-sec">
        <div className="dash-sec-h">
          <div className="dash-sec-title">
            <span className="adm-h-ic adm-h-ic--star"><i className="fa-solid fa-calendar-day" aria-hidden="true"></i></span>
            Upcoming Activities
          </div>
          <span className="adm-h-meta">{cmyLabel}</span>
        </div>
        <div className="adm-info-banner">
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>School events, exams, and important dates for this month.</span>
        </div>

        {upActivities.length === 0 ? (
          <div className="adm-info-banner">
            <i className="fa-solid fa-calendar-xmark" aria-hidden="true"></i>
            <span>No upcoming activities scheduled.</span>
          </div>
        ) : (
        <div className="adm-act-grid">
          {upActivities.map(a => {
            const c = TYPE_COLOR.event;
            const daysAway = actDaysAway(a.StartAt);
            const daysLabel = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : daysAway > 0 ? `In ${daysAway} days` : 'Past';
            const daysTone = daysAway <= 1 ? 'amber' : (daysAway <= 7 ? 'brand' : 'muted');
            /* Every card now lands on Academics → Scheme of Studies →
               Calendar → Activity Calendar via the openActivityCalendar
               callback hoisted from App.js. */
            const goActivityCalendar = () => {
              openActivityCalendar();
              toast('Opening Activity Calendar…', 'info');
            };
            return (
              <Tooltip key={a.ID} text="Open Academics → Activity Calendar">
                <div
                  className="adm-act-card clickable"
                  style={{ '--act-bar': c.fg }}
                  onClick={goActivityCalendar}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goActivityCalendar(); } }}
                >
                  <div className="adm-act-h">
                    <span className="adm-act-chip" style={{ background: c.bg, color: c.fg }}>
                      <i className="fa-solid fa-calendar-day" aria-hidden="true"></i>
                      {actDateLabel(a.StartAt)}
                    </span>
                    <span className={`adm-act-days adm-act-days--${daysTone}`}>{daysLabel}</span>
                  </div>
                  <div className="adm-act-title">{a.Title}</div>
                  <div className="adm-act-desc">{a.Description}</div>
                  <div className="adm-act-foot">
                    <span className="adm-act-mod">
                      <i className="fa-solid fa-calendar-plus" aria-hidden="true"></i>
                      Activity Calendar
                    </span>
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
        )}
      </div>
    </>
  );
}


/* ─── Today's Attendance section (Student + Staff cards) ───────
   Renders the 2-card row with the same `.fee-card` chrome used by
   the Fee Analytics section. Field names match the Attendance
   module schema (present / absent / leave / total / percentage). */
function AttendanceSection({ openModule, studentData, staffData }) {
  const todayDateLabel = new Date().toLocaleDateString('en-PK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  /* Status colour ladder per spec: >=90 green · >=75 amber · else red */
  const pctColor = (p) => (p >= 90 ? '#16A34A' : p >= 75 ? '#D97706' : '#DC2626');
  const pctTone  = (p) => (p >= 90 ? 'green'   : p >= 75 ? 'amber'   : 'red');

  return (
    <div className="dash-sec adm-sec">
      <div className="dash-sec-h">
        <div className="dash-sec-title">
          <span className="adm-h-ic"><i className="fa-solid fa-clipboard-check" aria-hidden="true"></i></span>
          Today&apos;s Attendance
        </div>
        <div className="adm-h-right">
          <span className="adm-h-meta">{todayDateLabel}</span>
          <button type="button" className="dash-sec-link" onClick={() => openModule('att')}>
            View Full Report <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div className="att-grid">
        {/* Student card */}
        <AttendanceCard
          icon="fa-user-graduate"
          tone="brand"
          title="Student Attendance Today"
          data={studentData}
          unitSingular="student"
          unitPlural="students"
          unitSuffix="enrolled"
          pctColor={pctColor}
          pctTone={pctTone}
        />
        {/* Staff card */}
        <AttendanceCard
          icon="fa-chalkboard-user"
          tone="purple"
          title="Staff Attendance Today"
          data={staffData}
          unitSingular="staff member"
          unitPlural="staff members"
          unitSuffix=""
          pctColor={pctColor}
          pctTone={pctTone}
        />
      </div>
    </div>
  );
}

function AttendanceCard({ icon, tone, title, data, unitSingular, unitPlural, unitSuffix, pctColor, pctTone }) {
  const pct = data.percentage;
  const color = pctColor(pct);
  return (
    <div className={`stat-card fee-card att-card att-card--${tone}`}>
      <div className="fc-header">
        <div className="fc-icon-chip">
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        </div>
        <div className="fc-title">{title}</div>
      </div>

      {/* Hero percentage in the status colour */}
      <div className="att-pct" style={{ color }}>
        {pct}<span className="att-pct-sym">%</span>
        <span className={`att-pct-tag att-pct-tag--${pctTone(pct)}`}>
          {pct >= 90 ? 'Excellent' : pct >= 75 ? 'Watch' : 'Critical'}
        </span>
      </div>

      {/* Pills row — Present · Absent · Leave (leave only if > 0) */}
      <div className="att-pills">
        <span className="att-pill att-pill--green">
          <span className="att-pill-dot" /> {data.present} Present
        </span>
        <span className="att-pill att-pill--red">
          <span className="att-pill-dot" /> {data.absent} Absent
        </span>
        {typeof data.leave === 'number' && data.leave > 0 && (
          <span className="att-pill att-pill--amber">
            <span className="att-pill-dot" /> {data.leave} Leave
          </span>
        )}
      </div>

      {/* Progress bar — width = attendance percentage */}
      <div className="att-bar-track">
        <div className="att-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="fc-support att-support">
        <i className="fa-solid fa-users" aria-hidden="true"></i>
        <span>
          of <span className="fc-highlight">{data.total}</span>
          {' '}{data.total === 1 ? unitSingular : unitPlural}
          {unitSuffix ? ` ${unitSuffix}` : ''}
        </span>
      </div>
    </div>
  );
}

/* ─── OneLink Payments card ───────────────────────────────────
   Reads the same fee receipts ledger (feeService.getReceipts) as
   Fee → Reports → OneLink Payment Report, filtered to
   p.source === 'onelink' (legacy 'bank' alias included), so the
   dashboard figures always match that report. Supports the same
   three period filters — Month / Date Range / Single Date — and
   the download icon opens the identical detailed report. */
const OL_MONTH_NAMES = FIN_MONTH_NAMES;

function OneLinkPaymentSection({ openModule, toast }) {
  const { data: classes = [] }     = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} } = useAsync(feeService.getTransportFee, []);
  const { data: receipts = [] }    = useAsync(feeService.getReceipts, []);

  const [seg, setSeg]     = useState('month');
  const [month, setMonth] = useState('2026-05');
  const [from, setFrom]   = useState('2026-05-01');
  const [to, setTo]       = useState('2026-05-31');
  const today = new Date().toISOString().slice(0, 10);
  const [single, setSingle] = useState(today);

  const studentLookup = useMemo(() => {
    const map = {};
    classes.forEach(c => (studentsMap[c.key] || []).forEach(s => { map[`${c.key}|${s.reg}`] = s; }));
    return map;
  }, [classes, studentsMap]);

  const transactions = useMemo(() => {
    const out = [];
    (receipts || []).forEach(rec => {
      (rec.payments || []).forEach(p => {
        if (p.source !== 'onelink' && p.source !== 'bank') return;
        const d = p.date;
        if (!d) return;
        const inPeriod = seg === 'month' ? d.slice(0, 7) === month
          : seg === 'range' ? (d >= from && d <= to)
          : d === single;
        if (!inPeriod) return;
        out.push({ ...p, classKey: rec.classKey, reg: rec.reg, student: studentLookup[`${rec.classKey}|${rec.reg}`] });
      });
    });
    return out;
  }, [receipts, studentLookup, seg, month, from, to, single]);

  const totalTxns = transactions.length;
  const totalAmt  = transactions.reduce((a, x) => a + (+x.amount || 0), 0);
  const modeBreak = useMemo(() => {
    const map = {};
    transactions.forEach(x => { const k = x.method || 'Bank Transfer'; map[k] = (map[k] || 0) + (+x.amount || 0); });
    return Object.keys(map).map(k => ({ name: k, amt: map[k] }));
  }, [transactions]);

  const periodLabel = seg === 'month'
    ? `${OL_MONTH_NAMES[Number(month.split('-')[1]) - 1]} ${month.split('-')[0]}`
    : seg === 'range' ? `${from} to ${to}` : single;

  const downloadReport = (mode) => {
    const html = buildOneLinkDashboardReportHTML({ transactions, totalTxns, totalAmt, modeBreak, periodLabel });
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); if (mode === 'pdf') w.print(); } catch (e) { /* ignore */ } };
    toast(`OneLink Payment Report — ${mode === 'pdf' ? 'sent to print' : 'preview opened'}.`, 'success');
  };

  return (
    <div className="dash-sec adm-sec">
      <div className="dash-sec-h">
        <div className="dash-sec-title"><i className="fa-solid fa-building-columns" aria-hidden="true"></i> OneLink Payments</div>
        <button type="button" className="dash-sec-link" onClick={() => openModule('fee')}>
          Open Fee <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      </div>

      <div className="fin-summary-card ol-card">
        <div className="fin-summary-head">
          <div className="fin-summary-head-l">
            <div className="fin-summary-ic fin-summary-ic--purple"><i className="fa-solid fa-building-columns" aria-hidden="true"></i></div>
            <div>
              <div className="fin-summary-t">OneLink / Bank Payments</div>
              <div className="fin-summary-s">{periodLabel} · payments received through OneLink</div>
            </div>
          </div>

          <div className="ol-controls">
            <div className="adm-seg" role="tablist" aria-label="OneLink period filter">
              <button type="button" className={`adm-seg-btn${seg === 'month' ? ' on' : ''}`} role="tab" aria-selected={seg === 'month'} onClick={() => setSeg('month')}>Month</button>
              <button type="button" className={`adm-seg-btn${seg === 'range' ? ' on' : ''}`} role="tab" aria-selected={seg === 'range'} onClick={() => setSeg('range')}>From – To</button>
              <button type="button" className={`adm-seg-btn${seg === 'single' ? ' on' : ''}`} role="tab" aria-selected={seg === 'single'} onClick={() => setSeg('single')}>Single Date</button>
            </div>

            {seg === 'month' && (
              <label className="fin-summary-month">
                <span className="fin-summary-month-lbl">Month</span>
                <input type="month" className="fin-summary-month-input" value={month} min="2026-01" max="2026-05" onChange={(e) => setMonth(e.target.value)} aria-label="Select month" />
              </label>
            )}
            {seg === 'range' && (
              <>
                <label className="fin-summary-month">
                  <span className="fin-summary-month-lbl">From</span>
                  <input type="date" className="fin-summary-month-input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                </label>
                <label className="fin-summary-month">
                  <span className="fin-summary-month-lbl">To</span>
                  <input type="date" className="fin-summary-month-input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
                </label>
              </>
            )}
            {seg === 'single' && (
              <label className="fin-summary-month">
                <span className="fin-summary-month-lbl">Date</span>
                <input type="date" className="fin-summary-month-input" value={single} onChange={(e) => setSingle(e.target.value)} aria-label="Select date" />
              </label>
            )}

            <Tooltip text="Download the detailed OneLink payment report for this period">
              <button type="button" className="ol-dl-btn" onClick={() => downloadReport('pdf')} aria-label="Download OneLink payment report">
                <i className="fa-solid fa-download" aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="fin-summary-grid ol-grid">
          <div className="fee-card fa-card fc-tone--purple fc-bordered fin-summary-sub">
            <div className="fc-header">
              <div className="fc-icon-chip"><i className="fa-solid fa-receipt" aria-hidden="true"></i></div>
              <div className="fc-title">OneLink Transactions</div>
            </div>
            <div className="fc-amount fa-amount--lg">{totalTxns}</div>
            <div className="fc-support">
              <i className="fa-solid fa-calendar" aria-hidden="true"></i>
              <span>{periodLabel}</span>
            </div>
          </div>

          <div className="fee-card fa-card fc-tone--green fc-bordered fin-summary-sub">
            <div className="fc-header">
              <div className="fc-icon-chip"><i className="fa-solid fa-sack-dollar" aria-hidden="true"></i></div>
              <div className="fc-title">Total Received</div>
            </div>
            <div className="fc-amount fc-amount--green fa-amount--lg">{fmtPKR(totalAmt)}</div>
            <div className="fc-support">
              <i className="fa-solid fa-calendar" aria-hidden="true"></i>
              <span>{periodLabel}</span>
            </div>
          </div>

          <div className="fee-card fa-card fc-tone--purple fc-bordered fin-summary-sub">
            <div className="fc-header">
              <div className="fc-icon-chip"><i className="fa-solid fa-chart-pie" aria-hidden="true"></i></div>
              <div className="fc-title">Payment Collection Summary</div>
            </div>
            {modeBreak.length === 0 ? (
              <div className="fc-support"><i className="fa-solid fa-circle-info" aria-hidden="true"></i><span>No OneLink payments in this period</span></div>
            ) : (
              <div className="fa-meta-rows">
                {modeBreak.map(m => (
                  <div key={m.name} className="fa-meta-row">
                    <span className="fa-meta-lbl"><i className="fa-solid fa-building-columns" aria-hidden="true"></i> {m.name}</span>
                    <span className="fa-meta-val">{fmtPKR(m.amt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildOneLinkDashboardReportHTML({ transactions, totalTxns, totalAmt, modeBreak, periodLabel }) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rows = transactions.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><small>${esc(x.txn || x.ref || '—')}</small></td>
      <td><b>${esc(x.student?.name || '—')}</b></td>
      <td>${esc(x.reg)}</td>
      <td>${esc(x.date || '—')}${x.time ? `<br><small>${esc(x.time)}</small>` : ''}</td>
      <td>${esc(x.method || 'Bank Transfer')}</td>
      <td style="text-align:right;font-weight:700;color:#16A34A">${(+x.amount || 0).toLocaleString('en-PK')}</td>
    </tr>`).join('');
  const modeKpis = modeBreak.map(m => `<div class="kpi"><div class="l">${esc(m.name)}</div><div class="v">Rs. ${m.amt.toLocaleString('en-PK')}</div></div>`).join('');
  const today = new Date().toLocaleDateString('en-GB');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OneLink Payment Report — ${esc(periodLabel)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
.rep-page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff}
.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #7C3AED;padding-bottom:10px;margin-bottom:10px}
.rep-logo{width:42px;height:42px;border:2px solid #7C3AED;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7C3AED;font-weight:800}
.rep-name{font-size:18px;font-weight:800;color:#7C3AED;line-height:1.1}
.rep-title{font-size:12px;font-weight:600;color:#444;margin-top:3px}
.rep-filters{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:10.5px;color:#333;margin-bottom:12px;background:#F5F3FF;padding:9px 13px;border-radius:6px}
.rep-secttl{font-size:12px;font-weight:800;color:#7C3AED;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #DDD6FE}
.rep-tbl{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px}
.rep-tbl th{background:#7C3AED;color:#fff;padding:6px 7px;text-align:left;font-size:10px;font-weight:700}
.rep-tbl td{padding:5px 7px;border-bottom:1px solid #e5e9f2;vertical-align:top}
.rep-foot{margin-top:16px;text-align:center;font-size:9px;color:#999;border-top:1px solid #e5e9f2;padding-top:8px}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.kpi{border:1px solid #E5E7EB;border-radius:6px;padding:9px 11px;background:#F8FAFF}
.kpi .l{font-size:9.5px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px}
.kpi .v{font-size:14px;font-weight:800;color:#0F172A;margin-top:2px}
@page{size:A4 portrait;margin:14mm}
@media print{.rep-page{width:auto;min-height:0;margin:0;padding:0}body{font-size:10px}}
</style></head><body><div class="rep-page">
  <div class="rep-head">
    <div class="rep-logo">OS</div>
    <div><div class="rep-name">The Oxford System, Lahore Campus</div><div class="rep-title">OneLink Payment Report</div></div>
  </div>
  <div class="rep-filters"><span><b>Period:</b> ${esc(periodLabel)}</span><span><b>Transactions:</b> ${totalTxns}</span><span><b>Total Received:</b> Rs. ${totalAmt.toLocaleString('en-PK')}</span></div>
  <div class="kpi-row">
    <div class="kpi"><div class="l">Total Transactions</div><div class="v">${totalTxns}</div></div>
    <div class="kpi"><div class="l">Total Received</div><div class="v">Rs. ${totalAmt.toLocaleString('en-PK')}</div></div>
    <div class="kpi"><div class="l">Period</div><div class="v">${esc(periodLabel)}</div></div>
    <div class="kpi"><div class="l">Generated</div><div class="v">${esc(today)}</div></div>
  </div>
  ${modeBreak.length ? `<div class="rep-secttl">Payment Collection Summary</div><div class="kpi-row">${modeKpis}</div>` : ''}
  <div class="rep-secttl">Transaction Details</div>
  <table class="rep-tbl">
    <thead><tr><th>Sn.</th><th>Txn / Ref No</th><th>Student</th><th>Reg No</th><th>Date &amp; Time</th><th>Method</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94A3B8;padding:20px">No OneLink payments in this period.</td></tr>'}</tbody>
  </table>
  <div class="rep-foot">Computer generated report — The Oxford System, Lahore Campus · OneLink Payment Report · ${esc(today)}</div>
</div></body></html>`;
}

/* ─── Reusable App-status card (Teachers / Parents variants) ─── */
function AppStatusCard({ tone, title, subtitle, icon, data, ctaLabel, ctaIcon = 'fa-arrow-right', onCta }) {
  return (
    <div className={`adm-tc adm-tc--app adm-tc--${tone}`}>
      <div className="adm-tc-h">
        <div className="adm-tc-h-l">
          <div className={`adm-tc-ic adm-tc-ic--${tone}`}>
            <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
          </div>
          <div>
            <div className="adm-tc-t">{title}</div>
            <div className="adm-tc-s">{subtitle}</div>
          </div>
        </div>
        <span className={`adm-tc-pill adm-tc-pill--${tone}`}>{data.pct}%</span>
      </div>

      <div className="adm-tc-body">
        <div className="adm-tc-stats">
          <div className="adm-tc-stat">
            <div className="adm-tc-stat-lbl">Total</div>
            <div className="adm-tc-stat-val">{data.total.toLocaleString('en-PK')}</div>
          </div>
          <div className="adm-tc-stat">
            <div className="adm-tc-stat-lbl">Downloaded</div>
            <div className="adm-tc-stat-val adm-tc-stat-val--green">{data.downloaded.toLocaleString('en-PK')}</div>
          </div>
          <div className="adm-tc-stat">
            <div className="adm-tc-stat-lbl">Pending</div>
            <div className="adm-tc-stat-val adm-tc-stat-val--amber">{data.pending.toLocaleString('en-PK')}</div>
          </div>
        </div>

        <div className="adm-tc-bar">
          <div className="adm-tc-bar-track">
            <div
              className={`adm-tc-bar-fill adm-tc-bar-fill--${tone}`}
              style={{ width: `${data.pct}%` }}
            />
          </div>
          <div className="adm-tc-bar-meta">
            <span><i className="fa-solid fa-mobile-screen-button" aria-hidden="true"></i> {(data.downloaded || 0).toLocaleString('en-PK')} downloaded</span>
            <span className="adm-tc-bar-pct">{data.pct}% adopted</span>
          </div>
        </div>
      </div>

      <div className="adm-tc-foot">
        <Tooltip text={`Open ${title} report`}>
          <button type="button" className="adm-tc-btn adm-tc-btn--full" onClick={onCta}>
            <i className={`fa-solid ${ctaIcon}`} aria-hidden="true"></i> {ctaLabel}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function initials(name) {
  const clean = name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./g, '').trim();
  return clean.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}

/* ═══════════════════════════════════════════════════════════════════
   New-section CSS — adm-* prefix to avoid clashes with dash-*.
   Uses the same design tokens as the rest of the dashboard.
   ═══════════════════════════════════════════════════════════════════ */
export const ADM_NEW_CSS = `
.adm-sec { margin-bottom: 16px; }

/* Universal Search row sits flush above the hero greeting. */
.adm-uvs-row {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
.adm-uvs-row > * { width: 100%; max-width: 720px; }
@media (max-width: 720px) {
  .adm-uvs-row > * { max-width: 100%; }
}

.adm-divider {
  height: 1px; background: var(--border-light, #E2E8F0);
  margin: 6px 0 18px;
}

/* ─── Top cards row (Announcements + Apps) ──────────────────── */
.adm-top-cards {
  display: grid; gap: 14px; margin-bottom: 18px;
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 1100px) { .adm-top-cards { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 700px)  { .adm-top-cards { grid-template-columns: 1fr; } }

.adm-tc {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
  padding: 16px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  transition: all .18s;
  animation: dashRise .35s ease;
  min-height: 200px;
}
.adm-tc:hover {
  transform: translateY(-2px);
  border-color: #CBD5E1;
  box-shadow: 0 12px 26px rgba(15, 23, 42, .08);
}
[data-theme="dark"] .adm-tc { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .adm-tc:hover { border-color: #2B3E66; box-shadow: 0 12px 26px rgba(0, 0, 0, .4); }
[data-theme="dark"] .adm-tc-stat { background: rgba(96, 165, 250, .06); }
[data-theme="dark"] .adm-tc-foot { border-top-color: #1C2E50; }
.adm-tc::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  opacity: .92;
}
.adm-tc--announce::before { background: linear-gradient(90deg, #1E40AF, #2563EB, #60A5FA); }
.adm-tc--green::before    { background: linear-gradient(90deg, #15803D, #16A34A, #22C55E); }
.adm-tc--amber::before    { background: linear-gradient(90deg, #B45309, #D97706, #F59E0B); }

/* Header row */
.adm-tc-h {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; margin-bottom: 12px;
}
.adm-tc-h-l { display: flex; align-items: center; gap: 10px; min-width: 0; }
.adm-tc-ic {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.adm-tc-ic--brand { background: rgba(30, 64, 175, .14); color: #1E40AF; }
.adm-tc-ic--green { background: rgba(21, 128, 61, .14); color: #15803D; }
.adm-tc-ic--amber { background: rgba(217, 119, 6, .14); color: #92400E; }
.adm-tc-t {
  font: 800 13.5px/1.2 var(--dash-font); color: var(--text-primary);
  letter-spacing: -0.2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.adm-tc-s {
  font: 500 11px/1.2 var(--dash-font); color: var(--text-muted, #64748B);
  margin-top: 3px;
}

/* Status pill */
.adm-tc-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 999px;
  font: 800 11px/1 var(--dash-font);
  white-space: nowrap; flex-shrink: 0;
}
.adm-tc-pill--new {
  background: rgba(220, 38, 38, .12); color: #B91C1C;
}
[data-theme="dark"] .adm-tc-pill--new { background: rgba(248, 113, 113, .18); color: #FCA5A5; }
[data-theme="dark"] .adm-tc-pill--green { background: rgba(74, 222, 128, .18); color: #BBF7D0; }
[data-theme="dark"] .adm-tc-pill--amber { background: rgba(245, 158, 11, .18); color: #FCD34D; }
.adm-tc-pill--new .adm-tc-pill-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #DC2626;
  animation: dashPulse 1.4s ease-in-out infinite;
}
@keyframes dashPulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.adm-tc-pill--green { background: rgba(21, 128, 61, .14); color: #15803D; }
.adm-tc-pill--amber { background: rgba(217, 119, 6, .14); color: #92400E; }

/* Body */
.adm-tc-body { flex: 1; display: flex; flex-direction: column; gap: 10px; }

/* Announcement body */
.adm-tc-an-title {
  font: 800 14px/1.3 var(--dash-font); color: var(--text-primary);
  letter-spacing: -0.2px;
}
.adm-tc-an-preview {
  font: 500 12px/1.5 var(--dash-font); color: var(--text-secondary, #475569);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden;
}

/* App status body */
.adm-tc-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.adm-tc-stat {
  padding: 8px 10px;
  background: var(--bg-muted, #F8FAFF);
  border-radius: 8px;
}
.adm-tc-stat-lbl {
  font: 700 9.5px/1 var(--dash-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .4px;
}
.adm-tc-stat-val {
  font: 800 18px/1 var(--dash-font); color: var(--text-primary);
  margin-top: 4px; letter-spacing: -0.3px;
}
.adm-tc-stat-val--green { color: #15803D; }
.adm-tc-stat-val--amber { color: #92400E; }

/* Progress bar */
.adm-tc-bar { display: flex; flex-direction: column; gap: 5px; }
.adm-tc-bar-track {
  height: 7px; border-radius: 999px;
  background: var(--bg-muted, #F1F5F9);
  overflow: hidden;
}
.adm-tc-bar-fill {
  height: 100%; border-radius: 999px;
  transition: width .6s ease;
}
.adm-tc-bar-fill--green { background: linear-gradient(90deg, #15803D, #22C55E); }
.adm-tc-bar-fill--amber { background: linear-gradient(90deg, #B45309, #F59E0B); }
.adm-tc-bar-meta {
  display: flex; align-items: center; justify-content: space-between;
  font: 600 10.5px/1 var(--dash-font); color: var(--text-muted, #64748B);
}
.adm-tc-bar-meta i { color: #15803D; margin-right: 3px; font-size: 9px; }
.adm-tc-bar-pct { font-weight: 800; color: var(--text-primary); }

/* Footer + buttons */
.adm-tc-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-light, #E2E8F0);
}
.adm-tc-meta {
  display: inline-flex; align-items: center; gap: 5px;
  font: 600 11px/1 var(--dash-font); color: var(--text-muted, #64748B);
}
.adm-tc-meta i { font-size: 10px; }
.adm-tc-btn {
  display: inline-flex; align-items: center; gap: 5px;
  height: 30px; padding: 0 12px;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff; border: none; cursor: pointer;
  border-radius: 8px;
  font: 700 11.5px/1 var(--dash-font);
  transition: all .18s;
}
.adm-tc-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(30, 58, 138, .28);
}
.adm-tc-btn i { font-size: 9px; transition: transform .2s; }
.adm-tc-btn:hover i { transform: translateX(2px); }
.adm-tc-btn--full { width: 100%; justify-content: center; }
.adm-tc--green .adm-tc-btn { background: linear-gradient(135deg, #15803D, #16A34A); }
.adm-tc--green .adm-tc-btn:hover { box-shadow: 0 6px 14px rgba(22, 163, 74, .28); }
.adm-tc--amber .adm-tc-btn { background: linear-gradient(135deg, #B45309, #D97706); }
.adm-tc--amber .adm-tc-btn:hover { box-shadow: 0 6px 14px rgba(217, 119, 6, .28); }

@media (max-width: 700px) {
  .adm-tc-stats { grid-template-columns: 1fr 1fr; }
  .adm-tc-stat:last-child { grid-column: 1 / -1; }
  .adm-tc-foot { flex-direction: column; align-items: stretch; gap: 8px; }
}

/* ═══ Monthly Financial Summary (NEW) — parent card + month picker,
   3 sub-cards reusing the existing .fee-card / .fc-* chrome. ═══ */
.fin-summary-card {
  background: linear-gradient(135deg, var(--bg-card, #fff) 0%, rgba(15, 118, 110, .035) 100%);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: var(--dash-radius, 14px);
  padding: 18px 20px;
  margin-bottom: 16px;
  animation: dashRise .35s ease;
}
[data-theme="dark"] .fin-summary-card {
  background: linear-gradient(135deg, #0E1628 0%, rgba(20, 184, 166, .06) 100%);
  border-color: #1F3158;
}
.fin-summary-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
}
.fin-summary-head-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.fin-summary-ic {
  width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; color: #fff;
  background: linear-gradient(135deg, #0F766E, #14B8A6);
  box-shadow: 0 8px 18px rgba(15, 118, 110, .28);
}
.fin-summary-ic--purple {
  background: linear-gradient(135deg, #6D28D9, #7C3AED);
  box-shadow: 0 8px 18px rgba(124, 58, 237, .28);
}
.fin-summary-t { font: 800 15px/1.2 var(--dash-font); color: var(--text-primary); letter-spacing: -0.2px; }
.fin-summary-s { font: 600 11.5px/1.3 var(--dash-font); color: var(--text-muted, #64748B); margin-top: 3px; }
.fin-summary-month {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 6px 4px 12px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 999px;
  transition: all .15s;
}
.fin-summary-month:hover { border-color: #99D6CB; }
.fin-summary-month:focus-within { border-color: #0F766E; box-shadow: 0 0 0 3px rgba(15, 118, 110, .16); }
.fin-summary-month-lbl {
  font: 800 10.5px/1 var(--dash-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px; white-space: nowrap;
}
.fin-summary-month-input {
  border: none; outline: none; background: transparent;
  font: 700 12.5px/1 var(--dash-font); color: var(--text-primary);
  padding: 7px 4px; cursor: pointer;
}
[data-theme="dark"] .fin-summary-month { background: var(--bg-card, #0E1628); border-color: var(--border-light, #1C2E50); }
[data-theme="dark"] .fin-summary-month-input { color-scheme: dark; }
.fin-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.fin-summary-sub { min-height: 0; padding: 16px 18px; }
.fin-summary-sub .fc-support { margin-top: 10px; }
@media (max-width: 900px) { .fin-summary-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) {
  .fin-summary-grid { grid-template-columns: 1fr; }
  .fin-summary-head { flex-direction: column; align-items: stretch; }
  .fin-summary-month { justify-content: space-between; }
}
@media (max-width: 600px) {
  .fin-summary-card { padding: 14px; }
  .fin-summary-grid { gap: 10px; }
  .fin-summary-sub { padding: 14px; }
}

/* ─── OneLink Payments card — period controls + download icon ─── */
.ol-card { background: linear-gradient(135deg, var(--bg-card, #fff) 0%, rgba(124, 58, 237, .035) 100%); }
[data-theme="dark"] .ol-card { background: linear-gradient(135deg, #0E1628 0%, rgba(124, 58, 237, .07) 100%); }
.ol-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ol-dl-btn {
  width: 34px; height: 34px; flex-shrink: 0;
  border-radius: 999px;
  border: 1.5px solid var(--border-light, #E2E8F0);
  background: var(--bg-card, #fff);
  color: #7C3AED;
  cursor: pointer;
  font-size: 13px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.ol-dl-btn:hover {
  background: linear-gradient(135deg, #6D28D9, #7C3AED);
  border-color: #7C3AED;
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(124, 58, 237, .28);
}
@media (max-width: 640px) { .ol-controls { justify-content: flex-start; } }

/* ─── Generic header helpers ─── */
.adm-h-right { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.adm-h-meta  { font: 600 12.5px/1 var(--dash-font); color: var(--text-muted, #64748B); }
.adm-h-meta b { color: var(--text-primary); font-weight: 800; }
.adm-h-ic {
  width: 32px; height: 32px; border-radius: 9px; display: inline-flex;
  align-items: center; justify-content: center; font-size: 13px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF); color: #fff;
}
.adm-h-ic--cake { background: linear-gradient(135deg, #6D28D9, #7C3AED); }
.adm-h-ic--star { background: linear-gradient(135deg, #1E3A8A, #2563EB); }

.adm-select {
  height: 32px; padding: 0 28px 0 12px;
  font: 600 12px/1 var(--dash-font); color: var(--text-primary);
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 8px;
  appearance: none; -webkit-appearance: none; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2364748B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
}

.adm-ghost-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px;
  font: 700 11.5px/1 var(--dash-font); color: #1E40AF;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 8px; cursor: pointer; transition: all .15s;
}
.adm-ghost-btn:hover { background: rgba(30, 64, 175, .06); border-color: #BFDBFE; }

.adm-link-row { display: flex; justify-content: flex-end; margin-top: 12px; }
.adm-link-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: transparent; border: none; cursor: pointer;
  font: 700 13px/1 var(--dash-font); color: #1E40AF;
  padding: 4px 8px; border-radius: 6px; transition: background .15s;
}
.adm-link-btn:hover { background: rgba(30, 64, 175, .06); }
.adm-link-btn i { font-size: 10px; transition: transform .2s; }
.adm-link-btn:hover i { transform: translateX(3px); }
[data-theme="dark"] .adm-link-btn { color: #93C5FD; }
[data-theme="dark"] .adm-link-btn:hover { background: rgba(96, 165, 250, .12); }

/* ═══ Fee Analytics — 3 + 2 layout ═══ */
.fa-top-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
.fa-bottom-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
@media (max-width: 1024px) {
  .fa-top-grid    { grid-template-columns: repeat(2, 1fr); }
  .fa-top-grid > :last-child { grid-column: span 2; }
  .fa-bottom-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .fa-top-grid, .fa-bottom-grid { grid-template-columns: 1fr; }
  .fa-top-grid > :last-child { grid-column: auto; }
}

/* ─── Card chrome ─── */
.fee-card {
  display: flex; flex-direction: column; gap: 0;
  padding: 18px 20px;
  min-height: 150px;
  position: relative; overflow: hidden;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  transition: all .2s ease;
  animation: dashRise .35s ease;
}
.fee-card:hover {
  transform: translateY(-2px);
  border-color: #CBD5E1;
  box-shadow: 0 10px 22px rgba(15, 23, 42, .08);
}
/* Subtle decorative circle top-right */
.fee-card::before {
  content: ''; position: absolute; right: -14px; top: -14px;
  width: 80px; height: 80px; border-radius: 50%;
  background: rgba(15, 23, 42, .025);
  pointer-events: none;
}
[data-theme="dark"] .fee-card::before { background: rgba(255, 255, 255, .04); }

/* ─── Header ─── */
.fc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.fc-icon-chip {
  width: 30px; height: 30px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
}
.fc-title {
  font-size: 11.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .5px;
  color: var(--text-muted, #64748B);
  line-height: 1.3;
}
.fc-title--red { color: #DC2626; }

/* Tone-coded icon chips */
.fc-tone--teal  .fc-icon-chip { background: rgba(0, 137, 123, .15);  color: #00897B; }
.fc-tone--amber .fc-icon-chip { background: rgba(217, 119, 6, .15);  color: #D97706; }
.fc-tone--slate .fc-icon-chip { background: rgba(71, 85, 105, .15);  color: #475569; }
.fc-tone--red   .fc-icon-chip { background: rgba(220, 38, 38, .15);  color: #DC2626; }
.fc-tone--green .fc-icon-chip { background: rgba(22, 163, 74, .15);  color: #16A34A; }
.fc-tone--brand .fc-icon-chip { background: rgba(30, 64, 175, .14);  color: #1E40AF; }
.fc-tone--purple .fc-icon-chip { background: rgba(124, 58, 237, .15); color: #7C3AED; }

/* ─── Amount ─── */
.fc-amount {
  font-size: 22px; font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.02em;
  line-height: 1.1;
  margin-bottom: 8px;
}
.fc-amount--red   { color: #DC2626; }
.fc-amount--green { color: #16A34A; }

/* Quantity-style amount (Card 1) — split big number + small unit */
.fc-amount--qty { display: flex; align-items: baseline; gap: 8px; }
.fc-amount-n {
  font-size: 26px; font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.02em; line-height: 1;
}
.fc-amount-unit {
  font-size: 14px; font-weight: 700;
  color: var(--text-muted, #64748B);
}

/* ─── Divider ─── */
.fc-divider {
  width: 100%; height: 1px;
  background: var(--border-light, #E2E8F0);
  margin: 8px 0;
}
[data-theme="dark"] .fc-divider { background: rgba(255, 255, 255, .07); }

/* ─── Support row(s) ─── */
.fc-support {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600;
  color: var(--text-muted, #64748B);
  margin-top: auto;
}
.fc-support i { font-size: 11px; flex-shrink: 0; }
.fc-support .fc-highlight {
  font-weight: 800;
  color: var(--text-secondary, #1E3A5F);
}
[data-theme="dark"] .fc-support .fc-highlight { color: var(--text-primary); }
/* Stacked support rows (Card 1 has two lines) */
.fc-support--col {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.fc-support--col > div {
  display: inline-flex; align-items: center; gap: 5px;
  width: 100%;
}

/* ─── Bordered (urgency) variants ─── */
.fc-bordered.fc-tone--red {
  border-color: rgba(220, 38, 38, .25);
}
.fc-bordered.fc-tone--green {
  border-color: rgba(22, 163, 74, .22);
}

/* ─── Subtle background tints ─── */
.fc-tint--green {
  background: linear-gradient(135deg, var(--bg-card, #fff) 0%, rgba(22, 163, 74, .025) 100%);
}
[data-theme="dark"] .fc-tint--green {
  background: linear-gradient(135deg, #0E1628 0%, rgba(22, 163, 74, .055) 100%);
}

/* ─── Dark mode card surface ─── */
[data-theme="dark"] .fee-card {
  background: #0E1628;
  border-color: #1F3158;
}
[data-theme="dark"] .fc-bordered.fc-tone--red   { border-color: rgba(248, 113, 113, .30); }
[data-theme="dark"] .fc-bordered.fc-tone--green { border-color: rgba(74, 222, 128, .28); }

/* ═══ Fee Analytics — new structural classes ═══ */

/* Top-row card — primary (Card 1) gets a brand left accent strip */
.fa-card { min-height: 170px; }
.fa-card--primary {
  background: linear-gradient(135deg, var(--bg-card, #fff) 0%, rgba(30, 64, 175, .035) 100%);
  border-color: rgba(30, 64, 175, .22);
}
.fa-card--primary::after {
  content: ''; position: absolute; top: 14px; bottom: 14px; left: 0;
  width: 3px; border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, #1E3A8A, #1E40AF, #2563EB);
}
[data-theme="dark"] .fa-card--primary {
  background: linear-gradient(135deg, #0E1628 0%, rgba(96, 165, 250, .06) 100%);
  border-color: rgba(96, 165, 250, .26);
}

/* Total Net Receivable — slightly elevated treatment */
.fa-card--total .fc-amount { color: var(--text-primary); }

/* Bigger amounts on top row */
.fa-amount--lg { font-size: 24px; }
.fa-amount--xl { font-size: 32px; letter-spacing: -.025em; }

/* ─── Meta rows (Discount Given, Challans Generated, etc.) ─── */
.fa-meta-rows {
  display: flex; flex-direction: column; gap: 8px;
}
.fa-meta-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  background: var(--bg-muted, #F8FAFF);
  border-radius: 9px;
  font: 600 12px/1.2 var(--dash-font);
}
[data-theme="dark"] .fa-meta-row { background: rgba(96, 165, 250, .05); }
.fa-meta-row--muted {
  background: transparent;
  padding: 4px 0;
  color: var(--text-muted, #64748B);
  gap: 6px;
  justify-content: flex-start;
}
.fa-meta-row--muted i { color: #64748B; font-size: 11px; }
.fa-meta-lbl {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--text-muted, #64748B);
}
.fa-meta-lbl i { font-size: 11px; color: #1E40AF; }
.fc-tone--red .fa-meta-lbl i { color: #B91C1C; }
.fa-meta-val {
  font: 800 12.5px/1 var(--dash-font);
  color: var(--text-primary);
  white-space: nowrap;
}
.fa-meta-val--amber { color: #D97706; }
.fa-meta-val--red   { color: #DC2626; }
.fa-meta-div {
  font-weight: 600;
  color: var(--text-muted, #94A3B8);
  margin: 0 2px;
}
.fa-meta-total {
  color: var(--text-muted, #64748B);
  font-weight: 700;
}

/* ─── Formula block (Card 3 — Total Net Receivable) ─── */
.fa-formula {
  display: flex; align-items: center; gap: 6px;
  font: 500 11px/1.4 var(--dash-font);
  color: var(--text-muted, #64748B);
  margin-bottom: 4px;
  font-style: italic;
}
.fa-formula i { font-size: 10px; color: #1E40AF; }
.fa-formula-breakdown {
  display: flex; align-items: center; justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-muted, #F8FAFF);
  border-radius: 9px;
}
[data-theme="dark"] .fa-formula-breakdown { background: rgba(96, 165, 250, .05); }
.fa-formula-breakdown > div {
  display: flex; flex-direction: column; gap: 2px;
  min-width: 0; flex: 1;
}
.fa-bd-lbl {
  font: 700 9.5px/1 var(--dash-font);
  color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .4px;
}
.fa-bd-val {
  font: 800 12px/1.1 var(--dash-font);
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.fa-bd-val--red { color: #DC2626; }
.fa-bd-op {
  font: 800 18px/1 var(--dash-font);
  color: var(--text-muted, #94A3B8);
  flex-shrink: 0;
}

/* ═══ Bottom-row LARGE cards ═══ */
.fa-large { min-height: 230px; padding: 22px 24px; }
.fa-large-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}
.fa-large-l { flex: 1; min-width: 0; }
.fa-large-r { flex-shrink: 0; }

/* Inline status meta line ("Students Paid: 425/612") */
.fa-status-meta {
  display: flex; align-items: center; gap: 6px;
  margin-top: 12px;
  font: 600 13px/1 var(--dash-font);
  color: var(--text-muted, #64748B);
  flex-wrap: wrap;
}
.fa-status-meta i { font-size: 12px; color: #16A34A; flex-shrink: 0; }
.fc-tone--red .fa-status-meta i { color: #DC2626; }
.fa-status-strong {
  font: 800 14px/1 var(--dash-font);
  color: #16A34A;
}
.fa-status-strong--red { color: #DC2626; }

/* ─── Donut ring (right side of large cards) ─── */
.fa-ring {
  position: relative;
  width: 96px; height: 96px;
  flex-shrink: 0;
}
.fa-ring svg { display: block; transform-origin: center; }
.fa-ring-text {
  position: absolute; inset: 0;
  text-align: center;
}
.fa-ring-pct {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font: 800 15px/1 var(--dash-font);
  color: var(--text-primary);
  letter-spacing: -.02em;
}
.fa-ring--green .fa-ring-pct { color: #16A34A; }
.fa-ring--red   .fa-ring-pct { color: #DC2626; }
.fa-ring-lbl {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, 10px);
  font: 700 9.5px/1 var(--dash-font);
  color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px;
}

/* ─── Progress bar at bottom of large card ─── */
.fa-progress { display: flex; flex-direction: column; gap: 6px; }
.fa-progress-h {
  display: flex; align-items: center; justify-content: space-between;
  font: 700 11px/1 var(--dash-font);
  color: var(--text-muted, #64748B);
}
.fa-progress-h b { color: var(--text-primary); font-weight: 800; }
.fa-progress-track {
  height: 8px; border-radius: 999px;
  background: var(--bg-muted, #F1F5F9);
  overflow: hidden;
}
[data-theme="dark"] .fa-progress-track { background: #1C2E50; }
.fa-progress-fill {
  height: 100%; border-radius: 999px;
  transition: width .6s ease;
}
.fa-progress-fill--green { background: linear-gradient(90deg, #15803D, #16A34A, #22C55E); }
.fa-progress-fill--red   { background: linear-gradient(90deg, #B91C1C, #DC2626, #F87171); }

/* Responsive — stack large-card row on small screens */
@media (max-width: 760px) {
  .fa-large-row { flex-direction: column; align-items: stretch; gap: 12px; }
  .fa-large-r { display: flex; justify-content: center; }
  .fa-amount--xl { font-size: 28px; }
}

/* ═══ Today's Attendance — 2-card grid ═══ */
.att-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 14px;
}
@media (max-width: 760px) { .att-grid { grid-template-columns: 1fr; } }

.att-card { min-height: 220px; }
.att-card--brand .fc-icon-chip {
  background: rgba(30, 58, 138, .15);
  color: #1E40AF;
}
.att-card--purple .fc-icon-chip {
  background: rgba(124, 58, 237, .12);
  color: #7C3AED;
}

/* Hero percentage — the dominant visual element of each card */
.att-pct {
  display: flex; align-items: baseline; gap: 10px;
  font-size: 32px; font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.1;
  margin-bottom: 14px;
}
.att-pct-sym {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  opacity: .85;
  margin-left: -2px;
}
.att-pct-tag {
  font: 800 9.5px/1 var(--dash-font);
  text-transform: uppercase;
  letter-spacing: .6px;
  padding: 4px 9px;
  border-radius: 999px;
  align-self: center;
}
.att-pct-tag--green { background: rgba(22, 163, 74, .14); color: #16A34A; }
.att-pct-tag--amber { background: rgba(217, 119, 6, .14); color: #D97706; }
.att-pct-tag--red   { background: rgba(220, 38, 38, .14); color: #DC2626; }

/* Status pills row */
.att-pills {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-bottom: 12px;
}
.att-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font: 700 12px/1 var(--dash-font);
  white-space: nowrap;
}
.att-pill-dot {
  width: 7px; height: 7px; border-radius: 50%;
  flex-shrink: 0;
}
.att-pill--green {
  background: rgba(22, 163, 74, .08);
  border: 1px solid rgba(22, 163, 74, .22);
  color: #16A34A;
}
.att-pill--green .att-pill-dot { background: #16A34A; }
.att-pill--red {
  background: rgba(220, 38, 38, .08);
  border: 1px solid rgba(220, 38, 38, .22);
  color: #DC2626;
}
.att-pill--red .att-pill-dot { background: #DC2626; }
.att-pill--amber {
  background: rgba(217, 119, 6, .08);
  border: 1px solid rgba(217, 119, 6, .22);
  color: #D97706;
}
.att-pill--amber .att-pill-dot { background: #D97706; }

/* Progress bar */
.att-bar-track {
  height: 8px;
  border-radius: 4px;
  background: var(--bg-muted, #F1F5F9);
  overflow: hidden;
  margin-bottom: 14px;
}
.att-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #1E3A8A 0%, #1E40AF 50%, #16A34A 100%);
  transition: width .6s ease;
}
[data-theme="dark"] .att-bar-track { background: #1C2E50; }

/* Support footer */
.att-support { font-size: 12px; }
.att-support i { font-size: 11px; color: #1E40AF; }
[data-theme="dark"] .att-support i { color: #60A5FA; }

/* Mobile tightening — wrap pills nicely without overflow */
@media (max-width: 640px) {
  .att-card { min-height: auto; }
  .att-pct { font-size: 28px; }
  .att-pct-sym { font-size: 20px; }
}

/* ─── 2-column layout for chart/side panels ─── */
.adm-2col {
  display: grid; gap: 14px;
  grid-template-columns: 1fr 240px;
}
@media (max-width: 900px) { .adm-2col { grid-template-columns: 1fr; } }
.adm-chart-card, .adm-side-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px; padding: 16px;
  animation: dashRise .35s ease;
}
.adm-side-card { padding: 14px 16px; }
.adm-side-title {
  font: 800 13px/1.2 var(--dash-font); color: var(--text-primary);
  margin-bottom: 14px;
}
.adm-side-tag {
  display: inline-flex; align-items: center; gap: 6px;
  font: 800 10.5px/1 var(--dash-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px;
  margin-bottom: 10px;
}

/* Chart legends */
.adm-legend {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-top: 8px; padding-top: 8px;
  border-top: 1px dashed var(--border-light, #E2E8F0);
}
.adm-legend-i {
  display: inline-flex; align-items: center; gap: 5px;
  font: 700 11px/1 var(--dash-font); color: var(--text-secondary, #475569);
}
.adm-legend-dot { width: 10px; height: 10px; border-radius: 50%; }

.adm-card-h {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 10px; flex-wrap: wrap;
}
.adm-card-h-t {
  font: 800 14px/1.2 var(--dash-font); color: var(--text-primary);
  letter-spacing: -0.2px;
}
.adm-card-h-yr {
  color: var(--text-muted, #64748B); font-weight: 700; font-size: 12px;
  margin-left: 4px;
}
.adm-card-h-meta { font: 700 12px/1 var(--dash-font); color: var(--text-muted, #64748B); }
.adm-card-h-meta b { color: var(--text-primary); font-weight: 800; }

/* Subject-wise completion bars */
.adm-bars { display: flex; flex-direction: column; gap: 12px; }
.adm-bar-row { display: flex; flex-direction: column; gap: 4px; }
.adm-bar-lbl { font: 700 12px/1 var(--dash-font); color: var(--text-primary); }
.adm-bar-track {
  height: 6px; border-radius: 3px;
  background: var(--bg-muted, #F1F5F9);
  overflow: hidden;
}
.adm-bar-fill {
  height: 100%; border-radius: 3px;
  background: linear-gradient(90deg, #1E3A8A, #2563EB);
  transition: width .6s ease;
}

/* ─── Paper generator table ─── */
.adm-table {
  width: 100%; border-collapse: collapse;
  font: 600 12px/1.4 var(--dash-font);
}
.adm-table th {
  text-align: left; padding: 8px 10px;
  font: 800 10.5px/1 var(--dash-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .4px;
  background: var(--bg-muted, #F8FAFF);
  border-bottom: 1px solid var(--border-light, #E2E8F0);
}
.adm-table td {
  padding: 10px;
  border-bottom: 1px solid var(--border-light, #F1F5F9);
  color: var(--text-primary);
}

.adm-quick-btns {
  display: flex; gap: 10px; flex-wrap: wrap;
}

/* ─── Birthdays ─── */
.adm-seg {
  display: inline-flex; align-items: center; gap: 0;
  padding: 3px; background: var(--bg-muted, #F8FAFF);
  border: 1px solid var(--border-light, #E2E8F0); border-radius: 9px;
}
.adm-seg-btn {
  height: 28px; padding: 0 12px;
  font: 700 11px/1 var(--dash-font); color: #475569;
  background: transparent; border: none; border-radius: 7px;
  cursor: pointer; transition: all .15s;
}
.adm-seg-btn.on { background: linear-gradient(135deg, #1E40AF, #2563EB); color: #fff; }

.adm-info-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; margin-bottom: 12px;
  background: rgba(30, 64, 175, .06);
  border: 1px solid rgba(30, 64, 175, .18);
  border-radius: 10px;
  font: 600 12px/1.3 var(--dash-font); color: var(--text-primary);
}
.adm-info-banner i { color: #1E40AF; font-size: 13px; }
[data-theme="dark"] .adm-info-banner { background: rgba(96, 165, 250, .08); border-color: rgba(96, 165, 250, .22); }
[data-theme="dark"] .adm-info-banner i { color: #93C5FD; }

.adm-pill-blue, .adm-pill-green, .adm-pill-amber {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  font: 800 11px/1 var(--dash-font);
  margin-left: 8px;
}
.adm-pill-blue   { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.adm-pill-green  { background: rgba(22, 163, 74, .14); color: #15803D; }
.adm-pill-amber  { background: rgba(217, 119, 6, .14); color: #92400E; }
[data-theme="dark"] .adm-pill-blue  { background: rgba(96, 165, 250, .18); color: #BFDBFE; }
[data-theme="dark"] .adm-pill-green { background: rgba(74, 222, 128, .18); color: #BBF7D0; }
[data-theme="dark"] .adm-pill-amber { background: rgba(245, 158, 11, .18); color: #FCD34D; }

.adm-bday-row { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
@media (max-width: 900px) { .adm-bday-row { grid-template-columns: 1fr; } }
.adm-bday-col { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
/* Scroll container — keeps the section compact even with many entries */
.adm-bday-list {
  display: flex; flex-direction: column; gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}
.adm-bday-list::-webkit-scrollbar { width: 6px; }
.adm-bday-list::-webkit-scrollbar-track { background: transparent; }
.adm-bday-list::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, .25);
  border-radius: 999px;
}
.adm-bday-list::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, .45); }
.adm-bday-card {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 11px; transition: all .15s;
}
.adm-bday-card:hover { border-color: #CBD5E1; box-shadow: 0 4px 12px rgba(15,23,42,.06); }
[data-theme="dark"] .adm-bday-card:hover { border-color: #2B3E66; box-shadow: 0 4px 12px rgba(0, 0, 0, .35); }
[data-theme="dark"] .adm-bday-card.today { background: rgba(34, 197, 94, .08); border-left-color: #22C55E; }
.adm-bday-card.today {
  background: rgba(22, 163, 74, .05);
  border-left: 3px solid #16A34A;
}
.adm-bday-av {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff; font: 700 12px/1 var(--dash-font);
}
.adm-bday-av--purple { background: linear-gradient(135deg, #6D28D9, #7C3AED); }
.adm-bday-info { flex: 1; min-width: 0; }
.adm-bday-name { font: 700 12.5px/1.3 var(--dash-font); color: var(--text-primary); }
.adm-bday-meta { font: 500 11px/1.3 var(--dash-font); color: var(--text-muted, #64748B); margin-top: 2px; }

/* ─── Activities ─── */
.adm-act-grid {
  display: grid; gap: 14px;
  grid-template-columns: repeat(3, 1fr);
  /* Keep the section compact — internal scroll instead of long page */
  max-height: 460px;
  overflow-y: auto;
  padding: 2px 6px 4px 2px;
}
.adm-act-grid::-webkit-scrollbar { width: 6px; }
.adm-act-grid::-webkit-scrollbar-track { background: transparent; }
.adm-act-grid::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, .25);
  border-radius: 999px;
}
.adm-act-grid::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, .45); }
@media (max-width: 1000px) { .adm-act-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .adm-act-grid { grid-template-columns: 1fr; max-height: 520px; } }
.adm-act-card {
  position: relative; overflow: hidden;
  padding: 16px 18px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, .03);
  transition: all .18s;
  animation: dashRise .35s ease;
}
.adm-act-card.clickable { cursor: pointer; }
.adm-act-card::before {
  content: ''; position: absolute; top: 12px; left: 6px; bottom: 12px;
  width: 4px; border-radius: 2px;
  background: var(--act-bar, #1E40AF);
}
.adm-act-card.clickable:hover {
  transform: translateY(-2px); border-color: #CBD5E1;
  box-shadow: 0 10px 22px rgba(15, 23, 42, .08);
}
[data-theme="dark"] .adm-act-card.clickable:hover { border-color: #2B3E66; box-shadow: 0 10px 22px rgba(0, 0, 0, .4); }
.adm-act-h {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding-left: 12px;
}
.adm-act-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 999px;
  font: 800 11px/1 var(--dash-font);
}
.adm-act-chip i { font-size: 10px; }
.adm-act-days {
  font: 700 11px/1 var(--dash-font);
}
.adm-act-days--brand  { color: #1E40AF; }
.adm-act-days--amber  { color: #D97706; font-weight: 800; }
.adm-act-days--muted  { color: var(--text-muted, #64748B); }
.adm-act-title {
  font: 800 14px/1.3 var(--dash-font); color: var(--text-primary);
  letter-spacing: -0.2px; padding-left: 12px; margin-top: 10px;
}
.adm-act-desc {
  font: 500 12px/1.5 var(--dash-font); color: var(--text-muted, #64748B);
  padding-left: 12px; margin-top: 6px;
}
.adm-act-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding-left: 12px; margin-top: 12px;
}
.adm-act-cat {
  padding: 3px 9px; border-radius: 999px;
  font: 800 10px/1 var(--dash-font);
}
.adm-act-mod {
  display: inline-flex; align-items: center; gap: 4px;
  font: 700 10.5px/1 var(--dash-font); color: var(--text-muted, #64748B);
}
.adm-act-mod i { font-size: 9px; color: #1E40AF; }

[data-theme="dark"] .adm-fee-card,
[data-theme="dark"] .adm-chart-card,
[data-theme="dark"] .adm-side-card,
[data-theme="dark"] .adm-bday-card,
[data-theme="dark"] .adm-act-card,
[data-theme="dark"] .adm-ghost-btn { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .adm-table th { background: rgba(96, 165, 250, .06); }

/* ═════════ MOBILE RESPONSIVE — admin command center ═════════ */
@media (max-width: 600px) {
  /* Top cards row (Announcements / Notice Board / Reminders) — 1-col handled
     by existing @700px rule. Tighten card chrome. */
  .adm-tc {
    padding: 14px;
    min-height: 0;
    border-radius: 12px;
  }
  .adm-tc-h { gap: 8px; margin-bottom: 10px; }
  .adm-tc-h-l { gap: 8px; min-width: 0; }
  .adm-tc-ic { width: 32px; height: 32px; font-size: 13px; border-radius: 9px; }
  .adm-tc-t { font-size: 12.5px; }
  .adm-tc-s { font-size: 10.5px; }
  .adm-tc-an-title { font-size: 13px; }
  .adm-tc-an-preview { font-size: 11.5px; -webkit-line-clamp: 2; }
  .adm-tc-stats { grid-template-columns: 1fr 1fr; gap: 6px; }
  .adm-tc-stat { padding: 7px 9px; }
  .adm-tc-stat-val { font-size: 16px; }
  .adm-tc-foot { margin-top: 10px; padding-top: 10px; }
  .adm-tc-btn { width: 100%; justify-content: center; height: 32px; }

  /* Section header rows — stack pickers / segmented controls under title */
  .adm-h-right {
    width: 100%;
    flex-wrap: wrap;
    gap: 8px;
  }
  .adm-h-meta { font-size: 11.5px; }
  .adm-select {
    flex: 1 1 auto;
    min-width: 0;
    height: 34px;
    font-size: 11.5px;
  }
  .adm-ghost-btn {
    flex: 1 1 auto;
    justify-content: center;
    height: 34px;
  }
  .adm-seg { width: 100%; }
  .adm-seg-btn { flex: 1; }

  /* KPI / 2-col layouts — 1 col */
  .adm-2col { gap: 10px; }
  .adm-chart-card,
  .adm-side-card { padding: 14px; border-radius: 12px; }
  .adm-card-h {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .adm-card-h-t { font-size: 13px; }
  .adm-card-h-meta { font-size: 11.5px; }

  /* Fee Analytics 3+2 grids — collapse to 1-col */
  .fa-top-grid,
  .fa-bottom-grid {
    gap: 10px;
    margin-bottom: 10px;
  }
  .fee-card {
    padding: 14px 14px;
    min-height: 0;
    border-radius: 12px;
  }

  /* Attendance 2-card grid */
  .att-grid { gap: 10px; margin-bottom: 10px; }
  .att-card { padding: 14px; }
  .att-pct { font-size: 26px; margin-bottom: 10px; gap: 8px; }
  .att-pct-sym { font-size: 18px; }
  .att-pills { gap: 5px; margin-bottom: 10px; }
  .att-pill { padding: 3px 9px; font-size: 11px; }

  /* Subject-wise completion bars — paper table wrap */
  .adm-table-wrap,
  .adm-table-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .adm-table { min-width: 480px; }

  /* Quick action button row */
  .adm-quick-btns {
    gap: 8px;
    flex-wrap: wrap;
  }
  .adm-quick-btns > * { flex: 1 1 auto; justify-content: center; }

  /* Info banner */
  .adm-info-banner {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 10px 12px;
    font-size: 11.5px;
  }

  /* Birthday rows — handled by @900px (1 col). Tighten cards. */
  .adm-bday-row { gap: 10px; }
  .adm-bday-card { padding: 9px 11px; gap: 10px; }
  .adm-bday-av { width: 32px; height: 32px; font-size: 11px; }
  .adm-bday-name { font-size: 12px; }
  .adm-bday-meta { font-size: 10.5px; }
  .adm-bday-list { max-height: 280px; }

  /* Activity grid — already 1 col @600. Tighten cards. */
  .adm-act-card { padding: 14px 14px 14px 16px; }
  .adm-act-title { font-size: 13px; padding-left: 8px; margin-top: 8px; }
  .adm-act-desc { font-size: 11.5px; padding-left: 8px; }
  .adm-act-h { padding-left: 8px; }
  .adm-act-foot {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding-left: 8px;
    margin-top: 10px;
  }
  .adm-act-chip { font-size: 10.5px; }

  /* Adm-link-row → full width */
  .adm-link-row { justify-content: stretch; }
  .adm-link-btn { width: 100%; justify-content: center; }

  /* Pills inside section headers */
  .adm-pill-blue,
  .adm-pill-green,
  .adm-pill-amber {
    margin-left: 0;
    font-size: 10.5px;
  }
}
@media (max-width: 480px) {
  .adm-tc-stats { grid-template-columns: 1fr; }
  .adm-tc-stat:last-child { grid-column: auto; }
  .att-pct { font-size: 22px; }
  .adm-card-h-t { font-size: 12.5px; }
  .adm-bday-card { padding: 8px 10px; }
}
`;
