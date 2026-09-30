import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tooltip from '../../components/Tooltip';
import MentorAISearchBar from './MentorAISearchBar';
import {
  AreaChart, Area, Line, BarChart, Bar, ComposedChart, Cell,
  PieChart, Pie, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import { useModules } from '../../context/ModuleContext';
import { DASH_CSS } from './Dashboard';
import AnnouncementsModal from './AnnouncementsModal';
import AppPendingReportModal from './AppPendingReportModal';
import DailyReceivingReportModal, { DailyAdvancePaymentReportModal, DailyAdvanceAdjustmentReportModal } from './DailyReceivingReport';
import { FeeAnalyticsInfoButton } from './FeeAnalyticsInfo';
import { buildDiscountMap, computeFeeDashboardExtras } from './feeDashboardExtra';
import { effectivePermsForUser } from '../UserPermissions/permissionsData';
import useAsync from '../../hooks/useAsync';
import * as accountsService from './_forked/services/accountsService';
import * as feeService from './_forked/services/feeService';
import { buildStandardReportHtml } from '../../reports/reportKit';
import {
  STUDENT_STATS,
  HR_STATS,
  CRM_STATS,
  EXAM_STATS,
  ACADEMICS_STATS,
  ATTENDANCE_STATS,
  FEE_STATS,
  AUDIT_STATS,
  MODULE_COLOR,
  SCHOOL_MENTOR_ANNOUNCEMENTS,
  TEACHER_APP_STATUS,
  PARENT_APP_STATUS,
  STUDENT_ATTENDANCE_TODAY,
  STAFF_ATTENDANCE_TODAY,
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

const LP_DATA_BY_CLASS = {
  'II-Pre': [
    { subject: 'Math',           classwork: 1,  notebook: 1 },
    { subject: 'English',        classwork: 1,  notebook: 1 },
    { subject: 'Science',        classwork: 3,  notebook: 2 },
    { subject: 'Social Studies', classwork: 13, notebook: 6 },
    { subject: 'Urdu',           classwork: 1,  notebook: 0 },
    { subject: 'DLL',            classwork: 1,  notebook: 1 },
  ],
  'I': [
    { subject: 'Math', classwork: 8, notebook: 6 }, { subject: 'English', classwork: 9, notebook: 7 },
    { subject: 'Science', classwork: 6, notebook: 5 }, { subject: 'Social Studies', classwork: 10, notebook: 8 },
    { subject: 'Urdu', classwork: 7, notebook: 6 }, { subject: 'DLL', classwork: 4, notebook: 3 },
  ],
  'II': [
    { subject: 'Math', classwork: 12, notebook: 10 }, { subject: 'English', classwork: 14, notebook: 11 },
    { subject: 'Science', classwork: 9, notebook: 7 }, { subject: 'Social Studies', classwork: 15, notebook: 12 },
    { subject: 'Urdu', classwork: 11, notebook: 9 }, { subject: 'DLL', classwork: 6, notebook: 4 },
  ],
  'III': [
    { subject: 'Math', classwork: 16, notebook: 13 }, { subject: 'English', classwork: 18, notebook: 15 },
    { subject: 'Science', classwork: 12, notebook: 10 }, { subject: 'Social Studies', classwork: 17, notebook: 14 },
    { subject: 'Urdu', classwork: 14, notebook: 11 }, { subject: 'DLL', classwork: 8, notebook: 6 },
  ],
  'IV': [
    { subject: 'Math', classwork: 18, notebook: 15 }, { subject: 'English', classwork: 19, notebook: 16 },
    { subject: 'Science', classwork: 15, notebook: 12 }, { subject: 'Social Studies', classwork: 18, notebook: 15 },
    { subject: 'Urdu', classwork: 16, notebook: 13 }, { subject: 'DLL', classwork: 9, notebook: 7 },
  ],
  'V':    [{ subject: 'Math', classwork: 19, notebook: 17 }, { subject: 'English', classwork: 20, notebook: 18 }, { subject: 'Science', classwork: 17, notebook: 14 }, { subject: 'Social Studies', classwork: 19, notebook: 17 }, { subject: 'Urdu', classwork: 17, notebook: 14 }, { subject: 'DLL', classwork: 10, notebook: 8 }],
  'VI':   [{ subject: 'Math', classwork: 20, notebook: 18 }, { subject: 'English', classwork: 19, notebook: 16 }, { subject: 'Science', classwork: 18, notebook: 15 }, { subject: 'Social Studies', classwork: 20, notebook: 18 }, { subject: 'Urdu', classwork: 18, notebook: 16 }, { subject: 'DLL', classwork: 11, notebook: 9 }],
  'VII':  [{ subject: 'Math', classwork: 17, notebook: 15 }, { subject: 'English', classwork: 18, notebook: 15 }, { subject: 'Science', classwork: 16, notebook: 13 }, { subject: 'Social Studies', classwork: 17, notebook: 14 }, { subject: 'Urdu', classwork: 15, notebook: 12 }, { subject: 'DLL', classwork: 10, notebook: 8 }],
  'VIII': [{ subject: 'Math', classwork: 14, notebook: 12 }, { subject: 'English', classwork: 16, notebook: 13 }, { subject: 'Science', classwork: 13, notebook: 11 }, { subject: 'Social Studies', classwork: 15, notebook: 12 }, { subject: 'Urdu', classwork: 12, notebook: 10 }, { subject: 'DLL', classwork: 8, notebook: 6 }],
};
const LP_CLASSES = ['II-Pre', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const PAPER_DATA_BY_CLASS = {
  'IV': [{ subject: 'English', count: 14 }, { subject: 'Science', count: 8 }],
  'I':  [{ subject: 'English', count: 6 },  { subject: 'Science', count: 3 }],
  'II': [{ subject: 'English', count: 9 },  { subject: 'Science', count: 5 }],
  'III':[{ subject: 'English', count: 11 }, { subject: 'Science', count: 6 }],
  'V':  [{ subject: 'English', count: 12 }, { subject: 'Science', count: 9 }],
  'VI': [{ subject: 'English', count: 10 }, { subject: 'Science', count: 7 }],
};
const PAPER_CLASSES = ['IV', 'I', 'II', 'III', 'V', 'VI'];

const PROFIT_LOSS_BY_YEAR = {
  2026: [
    { m: 'Jan', revenue: 3.20, expense: -2.80, pl:  0.80 },
    { m: 'Feb', revenue: 1.00, expense: -0.80, pl:  0.20 },
    { m: 'Mar', revenue: 1.05, expense: -0.78, pl:  0.27 },
    { m: 'Apr', revenue: 1.10, expense: -0.85, pl:  0.25 },
    { m: 'May', revenue: 1.02, expense: -0.82, pl:  0.20 },
    { m: 'Jun', revenue: 0.95, expense: -0.80, pl:  0.15 },
    { m: 'Jul', revenue: 0.70, expense: -0.85, pl: -0.15 },
    { m: 'Aug', revenue: 1.08, expense: -0.86, pl:  0.22 },
    { m: 'Sep', revenue: 1.10, expense: -0.88, pl:  0.22 },
    { m: 'Oct', revenue: 1.06, expense: -0.84, pl:  0.22 },
    { m: 'Nov', revenue: 1.02, expense: -0.82, pl:  0.20 },
    { m: 'Dec', revenue: 1.00, expense: -0.80, pl:  0.20 },
  ],
  2025: [
    { m: 'Jan', revenue: 2.80, expense: -2.30, pl:  0.50 }, { m: 'Feb', revenue: 2.90, expense: -2.40, pl:  0.50 },
    { m: 'Mar', revenue: 2.85, expense: -2.35, pl:  0.50 }, { m: 'Apr', revenue: 3.00, expense: -2.45, pl:  0.55 },
    { m: 'May', revenue: 3.10, expense: -2.50, pl:  0.60 }, { m: 'Jun', revenue: 1.40, expense: -1.20, pl:  0.20 },
    { m: 'Jul', revenue: 0.35, expense: -0.45, pl: -0.10 }, { m: 'Aug', revenue: 3.40, expense: -2.70, pl:  0.70 },
    { m: 'Sep', revenue: 3.20, expense: -2.55, pl:  0.65 }, { m: 'Oct', revenue: 3.05, expense: -2.45, pl:  0.60 },
    { m: 'Nov', revenue: 3.00, expense: -2.40, pl:  0.60 }, { m: 'Dec', revenue: 2.85, expense: -2.30, pl:  0.55 },
  ],
  2024: [
    { m: 'Jan', revenue: 2.40, expense: -2.00, pl:  0.40 }, { m: 'Feb', revenue: 2.45, expense: -2.05, pl:  0.40 },
    { m: 'Mar', revenue: 2.50, expense: -2.10, pl:  0.40 }, { m: 'Apr', revenue: 2.60, expense: -2.15, pl:  0.45 },
    { m: 'May', revenue: 2.65, expense: -2.20, pl:  0.45 }, { m: 'Jun', revenue: 1.20, expense: -1.05, pl:  0.15 },
    { m: 'Jul', revenue: 0.28, expense: -0.38, pl: -0.10 }, { m: 'Aug', revenue: 2.95, expense: -2.35, pl:  0.60 },
    { m: 'Sep', revenue: 2.80, expense: -2.25, pl:  0.55 }, { m: 'Oct', revenue: 2.65, expense: -2.15, pl:  0.50 },
    { m: 'Nov', revenue: 2.60, expense: -2.10, pl:  0.50 }, { m: 'Dec', revenue: 2.50, expense: -2.05, pl:  0.45 },
  ],
};

const STUDENT_BIRTHDAYS = [
  { name: 'Ayaan Raza',     grade: 'Grade 2',  date: '01 May', dob: 1  },
  { name: 'Sara Ahmed',     grade: 'Grade 5',  date: '04 May', dob: 4  },
  { name: 'Hassan Ali',     grade: 'Grade 7',  date: '08 May', dob: 8  },
  { name: 'Zara Khan',      grade: 'Grade 3',  date: '12 May', dob: 12 },
  { name: 'Bilal Tariq',    grade: 'Grade 8',  date: '15 May', dob: 15 },
  { name: 'Maha Siddiqui',  grade: 'Grade 1',  date: '18 May', dob: 18 },
  { name: 'Usman Farooq',   grade: 'Grade 6',  date: '22 May', dob: 22 },
  { name: 'Nadia Malik',    grade: 'Grade 4',  date: '25 May', dob: 25 },
  { name: 'Hamza Irfan',    grade: 'Grade 9',  date: '28 May', dob: 28 },
  { name: 'Fatima Saleem',  grade: 'Grade 10', date: '31 May', dob: 31 },
];

const TEACHER_BIRTHDAYS = [
  { name: 'Mr. Usman Khalid',   role: 'Math Teacher',     date: '05 May', dob: 5  },
  { name: 'Ms. Ayesha Raza',    role: 'Science Teacher',  date: '13 May', dob: 13 },
  { name: 'Dr. Hira Noor',      role: 'English Teacher',  date: '19 May', dob: 19 },
  { name: 'Mr. Bilal Ahmed',    role: 'HR Officer',       date: '24 May', dob: 24 },
  { name: 'Ms. Sana Mirza',     role: 'Coordinator',      date: '30 May', dob: 30 },
];

const TODAY_DAY = 31;        /* Mock "today" — matches CURRENT_SESSION's daysLeft pivot */

const ACTIVITIES = [
  { id: 1, date: '01 Jun 2026', title: 'Final Term Exams Begin',
    desc: 'Final term examinations start for all classes Grade 1–10.',
    category: 'Examination',   type: 'exam',     module: 'exam',     daysAway: 1 },
  { id: 2, date: '03 Jun 2026', title: 'PTM — All Classes',
    desc: 'Parent-Teacher Meeting for Q3 result discussion.',
    category: 'School Event',  type: 'event',    module: 'students', daysAway: 3 },
  { id: 3, date: '05 Jun 2026', title: 'World Environment Day Activity',
    desc: 'Tree plantation drive and environment awareness program.',
    category: 'School Event',  type: 'event',    module: null,        daysAway: 5 },
  { id: 4, date: '10 Jun 2026', title: 'Sports Day',
    desc: 'Annual sports day with inter-house competitions.',
    category: 'School Event',  type: 'event',    module: null,        daysAway: 10 },
  { id: 5, date: '15 Jun 2026', title: 'Result Cards Distribution',
    desc: 'Final term result cards distributed to parents.',
    category: 'Examination',   type: 'exam',     module: 'exam',     daysAway: 15 },
  { id: 6, date: '20 Jun 2026', title: 'Summer Vacation Begins',
    desc: 'School closes for summer vacation until August 2026.',
    category: 'Holiday',       type: 'holiday',  module: null,        daysAway: 20 },
  { id: 7, date: '25 Jun 2026', title: 'Staff Training Day',
    desc: 'Professional development session for all teaching staff.',
    category: 'HR',            type: 'event',    module: 'hr',       daysAway: 25 },
  { id: 8, date: '30 Jun 2026', title: 'Monthly Fee Deadline',
    desc: 'Last date for submission of July 2026 fee challans.',
    category: 'Fee',           type: 'deadline', module: 'fee',      daysAway: 30 },
];

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

/* ─── PKR-formatted tooltip for the Fee Analytics Overview charts —
   bars/slices carry a `fill` color (set directly on the Bar/Cell), so
   this reads payload[0].payload.color instead of p.color (Recharts
   doesn't echo a plain <Bar fill> back onto payload[i].color the way
   it does for multi-series charts). Pass `showPct` for the donut so
   each row also shows its share of the total. */
function FeeChartTooltip({ active, payload, showPct }) {
  if (!active || !payload?.length) return null;
  const total = showPct ? payload.reduce((a, p) => a + (p.value || 0), 0) : 0;
  return (
    <div style={{
      background: 'var(--bg-card, #fff)',
      border: '1px solid var(--border-light, #E2E8F0)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 12px rgba(15, 23, 42, .08)',
    }}>
      {payload.map((p, i) => {
        const color = p.payload?.color || p.color || p.fill;
        const pct = showPct && total > 0 ? Math.round((p.value / total) * 100) : null;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {p.name || p.payload?.name}: {fmtPKR(p.value)}{pct !== null ? ` (${pct}%)` : ''}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Count-up number for the Fee Analytics Overview highlight strip ───
   Animates from 0 to `value` on every mount, and re-animates from
   whatever it was showing to a NEW `value` whenever that changes (e.g.
   the month filter). Since AdminDashboard fully unmounts/remounts on
   every dashboard visit (App.js renders it as `{active === 'dashboard'
   && <Dashboard/>}`, not a hidden tab), the mount case alone already
   means this — and every Recharts animation below it — naturally
   replays automatically each time the user comes back to the
   dashboard, with no extra "trigger on visit" logic needed anywhere. */
function AnimatedNumber({ value, prefix = '', suffix = '', duration = 1400, decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const from = fromRef.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic — fast start, gentle settle
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString('en-PK');
  return <>{prefix}{formatted}{suffix}</>;
}

/* ─── Scroll-triggered chart replay ───
   Every chart card on the dashboard re-plays its entrance animation
   every time it scrolls into view — not just once on first page load.
   An IntersectionObserver watches the card's own container; each fresh
   not-visible → visible edge bumps `replayKey`, which callers use as a
   React `key` on the chart's inner tree. Changing that key fully
   unmounts + remounts the chart, so Recharts/AnimatedNumber restart
   from their 0 / empty state exactly like a first mount, instead of
   Recharts' default "animate once per mount" behaviour. Scrolling back
   up and re-entering replays it again, every single time.
   `wasVisibleRef` only allows a new replay after a genuine exit, so a
   still-visible card mid-animation can't be re-triggered by scroll
   jitter, and the 60ms debounce coalesces the flurry of intersection
   callbacks a fast scroll can fire. */
const CHART_ANIM_MS = 1800; // single tunable duration shared by every scroll-triggered chart animation

function useScrollReplay(threshold = 0.25) {
  const ref = useRef(null);
  const [replayKey, setReplayKey] = useState(0);
  /* `inView` is the live in/out state — used by CSS-driven bars (width
     transitions) that can't be reset via a React `key` remount the way
     Recharts/AnimatedNumber are, since a plain div has no "0 state" to
     return to other than re-rendering it at 0 ourselves. */
  const [inView, setInView] = useState(false);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setReplayKey((k) => k + 1);
      setInView(true);
      return undefined;
    }
    let debounceId = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (debounceId) clearTimeout(debounceId);
        debounceId = setTimeout(() => {
          if (entry.isIntersecting && !wasVisibleRef.current) {
            wasVisibleRef.current = true;
            setReplayKey((k) => k + 1);
            setInView(true);
          } else if (!entry.isIntersecting && wasVisibleRef.current) {
            wasVisibleRef.current = false;
            setInView(false);
          }
        }, 60);
      },
      { threshold, rootMargin: '0px 0px -5% 0px' }
    );
    observer.observe(node);
    return () => {
      if (debounceId) clearTimeout(debounceId);
      observer.disconnect();
    };
  }, [threshold]);

  return { ref, replayKey, inView };
}

/* ─── Custom tooltip for the Profit/Loss Overview chart ───
   Reads the same revenue/expense/pl fields already in profitData —
   only formats them for display (Rs. …M, sign, absolute value). */
function ProfitLossTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const find = (key) => payload.find(p => p.dataKey === key)?.value;
  const revenue = find('revenue') ?? 0;
  const expense = find('expense') ?? 0;
  const pl = find('pl') ?? 0;
  return (
    <div className="pl-tooltip">
      <div className="pl-tooltip-month">{label}</div>
      <div className="pl-tooltip-row">
        <span className="pl-tooltip-lbl"><span className="pl-tooltip-dot" style={{ background: '#1E40AF' }} />Revenue</span>
        <b>Rs. {Math.abs(revenue).toFixed(2)}M</b>
      </div>
      <div className="pl-tooltip-row">
        <span className="pl-tooltip-lbl"><span className="pl-tooltip-dot" style={{ background: '#DC2626' }} />Expenses</span>
        <b>Rs. {Math.abs(expense).toFixed(2)}M</b>
      </div>
      <div className="pl-tooltip-row">
        <span className="pl-tooltip-lbl"><span className="pl-tooltip-dot" style={{ background: '#16A34A' }} />Profit/Loss</span>
        <b style={{ color: pl >= 0 ? '#16A34A' : '#DC2626' }}>{pl >= 0 ? '+' : '−'}Rs. {Math.abs(pl).toFixed(2)}M</b>
      </div>
    </div>
  );
}

/* ─── Locked placeholder for a Dashboard card the current role/user
   isn't permitted to view. Shows only the card's name — everything
   else (values, charts, buttons) is withheld — plus an "i" icon
   explaining how to get access. Same footprint class as the real
   card so the grid layout doesn't shift. */
function LockedCard({ title, icon, className = '' }) {
  return (
    <div className={`dash-locked-card ${className}`}>
      <div className="dash-locked-card-h">
        {icon && <i className={`fa-solid ${icon} dash-locked-card-ic`} aria-hidden="true"></i>}
        <span className="dash-locked-card-t">{title}</span>
      </div>
      <Tooltip text="Ask your super admin to give you access of this card">
        <span className="dash-locked-card-i" aria-label={`"${title}" is restricted — ask your super admin to give you access of this card`}>
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
        </span>
      </Tooltip>
    </div>
  );
}

export default function AdminDashboard({ visibility, toast, navigate = () => {}, openActivityCalendar = () => {} }) {
  const { moduleActive, user, session, role } = visibility;
  const { isActive } = useModules();      /* per-spec: explicit useModules guard for new sections */

  /* ─── Per-card dashboard permissions ───
     Reads the same effectivePermsForUser() used by the User Permissions
     module, driven by whatever role/user is currently impersonated via
     the "View dashboard as another user" switcher (Dashboard.jsx). A
     card whose `dashboard.<id>.view` isn't granted renders as a locked
     placeholder instead of being hidden outright. */
  const dashPerms = useMemo(
    () => effectivePermsForUser(user, role ? [role] : []),
    [user, role]
  );
  /* Isolated demo fork: this ERP's permissionsData tree is an older
     version that doesn't define the newer dashboard card nodes
     (fee_analytics_overview, fee_discountgiven, …), so !!dashPerms[...]
     would lock them out. Match the source demo (localhost:3001) where the
     user sees every card: show a card UNLESS it is explicitly denied. */
  const canSeeCard = useCallback(
    (cardId) => dashPerms[`dashboard.${cardId}.view`] !== false,
    [dashPerms]
  );

  /* ─── Fee Analytics — live for the selected month (cards 1-8) ───
     Reads the same feeService data every other Fee report already reads;
     see feeDashboardExtra.js for why cards 5/8 can't reuse the existing
     "Discount Given Report" / "Advance Fee Payment Report" data as-is,
     for how cards 1-4 & 7 are derived from the same ledger, and for how
     card 6 "Advance Adjustments" instead mirrors Fee.jsx's own advance
     ledger (mockAdvanceLedger) behind the Advance Fee Adjustment Report —
     it's in the main calc flow (feeds Pending Fee), while card 8
     "Advance Payments Received" (after Pending Fee) deliberately isn't. */
  const [feeMonthIdx, setFeeMonthIdx] = useState(4); // seed data is May 2026
  const { data: faClasses = [] }        = useAsync(feeService.getFeeClasses, []);
  const { data: faStudentsMap = {} }    = useAsync(feeService.getTransportFee, []);
  const { data: faHeadsMap = {} }       = useAsync(feeService.getFeeHeads, []);
  const { data: faDiscountRows = [] }   = useAsync(feeService.getFeeDiscounts, []);
  const { data: faGeneratedSet }        = useAsync(feeService.getGeneratedChallans, [], new Set());
  const { data: faReceipts = [] }       = useAsync(feeService.getReceipts, []);
  const { data: faAdvanceLedger = [] }  = useAsync(feeService.getAdvanceLedger, []);
  const faDiscMap = useMemo(() => buildDiscountMap(faDiscountRows), [faDiscountRows]);
  const feeExtras = useMemo(() => computeFeeDashboardExtras({
    classes: faClasses, studentsMap: faStudentsMap, headsMap: faHeadsMap,
    discMap: faDiscMap, generatedSet: faGeneratedSet || new Set(), receipts: faReceipts,
    advanceLedger: faAdvanceLedger, monthIdx: feeMonthIdx,
  }), [faClasses, faStudentsMap, faHeadsMap, faDiscMap, faGeneratedSet, faReceipts, faAdvanceLedger, feeMonthIdx]);
  const feeMonthLabel = `${FIN_MONTH_NAMES[feeMonthIdx]} 2026`;

  /* ─── Fee Analytics Overview — graphical summary above the cards.
     Same feeExtras object the 8 cards below already read from (no
     second data-fetch, no duplicate calc) — this just reshapes those
     same totals into the 3 chart datasets + the mini highlight strip.
     Re-derives whenever the month (or feeExtras) changes, same as the
     cards. The detailed card grid stays UNMOUNTED (not just visually
     hidden) until "View Cards" is clicked — `feeCardsRef` then scrolls
     it into view once it renders. */
  const [showFeeCards, setShowFeeCards] = useState(false);
  const feeCardsRef = useRef(null);
  const toggleFeeCards = () => {
    setShowFeeCards(v => !v);
  };
  useEffect(() => {
    if (showFeeCards) feeCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showFeeCards]);
  /* Read once per mount (not reactively watched) — good enough for an
     OS-level preference that essentially never flips mid-session, and
     keeps every chart below from animating for anyone who's asked
     their system to reduce motion. */
  const chartsAnimated = typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  /* One useScrollReplay per chart card so each replays independently on
     scroll re-entry — except the donut + bar pair in .fa-chart-grid,
     which share one so they always start/finish in lockstep. */
  const faHighlightsReplay = useScrollReplay();
  const overviewCompReplay = useScrollReplay();
  const feeGridReplay = useScrollReplay();
  const plOverviewReplay = useScrollReplay();
  const lpChartReplay = useScrollReplay();
  const paperSecReplay = useScrollReplay();
  const subjCompletionReplay = useScrollReplay();
  /* Scroll-replay for every other numeric readout on the dashboard —
     count up from 0 every time it re-enters the viewport, same as the
     Fee Analytics highlight tiles. */
  const heroStatsReplay = useScrollReplay();
  const tilesReplay = useScrollReplay();
  const financeCardsReplay = useScrollReplay();
  const overviewChartData = useMemo(() => ([
    { name: 'Current Month Fee Position', short: 'Curr. Month',    value: feeExtras.currentMonthTotal,      color: '#2563EB' },
    { name: 'Previous Dues',              short: 'Prev. Dues',     value: feeExtras.previousDuesTotal,      color: '#EF4444' },
    { name: 'Total Net Receivable',       short: 'Net Receivable', value: feeExtras.netReceivableTotal,     color: '#1E40AF' },
    { name: 'Fee Received',               short: 'Received',       value: feeExtras.receivedTotal,          color: '#16A34A' },
    { name: 'Discount Given',             short: 'Discount',       value: feeExtras.discountTotal,          color: '#D97706' },
    { name: 'Advance Adjustments',        short: 'Adv. Adjusted',  value: feeExtras.advanceAdjustmentTotal, color: '#7C3AED' },
    { name: 'Pending Fee',                short: 'Pending',        value: feeExtras.pendingTotal,           color: '#DC2626' },
    { name: 'Advance Payments Received',  short: 'Adv. Received',  value: feeExtras.advanceTotal,           color: '#A78BFA' },
  ]), [feeExtras]);
  /* Net Receivable − Received − Discount − Advance Adjustments = Pending —
     the same formula the Pending Fee card itself prints, just charted. */
  const breakdownChartData = useMemo(() => ([
    { name: 'Fee Received',        value: feeExtras.receivedTotal,          color: '#16A34A' },
    { name: 'Discount Given',      value: feeExtras.discountTotal,          color: '#D97706' },
    { name: 'Advance Adjustments', value: feeExtras.advanceAdjustmentTotal, color: '#7C3AED' },
    { name: 'Pending Fee',         value: feeExtras.pendingTotal,           color: '#DC2626' },
  ].filter(d => d.value > 0)), [feeExtras]);
  const collectionsChartData = useMemo(() => ([
    { name: 'Collected',         short: 'Collected',   value: feeExtras.receivedTotal, color: '#16A34A' },
    { name: 'Pending',           short: 'Pending',     value: feeExtras.pendingTotal,  color: '#DC2626' },
    { name: 'Advance Collected', short: 'Adv. Collected', value: feeExtras.advanceTotal, color: '#A78BFA' },
  ]), [feeExtras]);
  /* value is the raw number so AnimatedNumber can count up to it — see
     that component below for why this replays on every dashboard visit. */
  const faHighlights = [
    { label: 'Collection %',           value: feeExtras.receivedPct,                   suffix: '%', icon: 'fa-chart-line',     tone: 'green' },
    { label: 'Pending %',              value: feeExtras.pendingPct,                    suffix: '%', icon: 'fa-hourglass-half', tone: 'red' },
    { label: 'Students Paid',          value: feeExtras.receivedStudentCount,          suffix: '',  icon: 'fa-user-check',     tone: 'green' },
    { label: 'Students With Dues',     value: feeExtras.studentsWithDues,              suffix: '',  icon: 'fa-user-clock',     tone: 'red' },
    { label: 'Students Adjusted',      value: feeExtras.advanceAdjustmentStudentCount, suffix: '',  icon: 'fa-user-gear',      tone: 'purple' },
    { label: 'Students Paid in Advance', value: feeExtras.advanceStudentCount,         suffix: '',  icon: 'fa-user-plus',      tone: 'violet' },
  ];

  const downloadFeeReceivedReport = () => {
    const html = buildFeeReceivedDashboardReportHTML(feeExtras, feeMonthLabel);
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast('Fee Received Report — sent to print.', 'success');
  };
  const downloadFeeDiscountReport = () => {
    const html = buildDiscountGivenDashboardReportHTML(feeExtras, feeMonthLabel);
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast('Discount Given Report — sent to print.', 'success');
  };
  const downloadFeeAdvanceReport = () => {
    const html = buildAdvanceDashboardReportHTML(feeExtras, feeMonthLabel);
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast('Advance Payment Report — sent to print.', 'success');
  };
  const downloadFeeAdvanceAdjustmentReport = () => {
    const html = buildAdvanceAdjustmentDashboardReportHTML(feeExtras, feeMonthLabel);
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast('Advance Adjustment Report — sent to print.', 'success');
  };

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

  /* ─── Existing top sections (kept) ──────────────────────────── */
  const tiles = [
    moduleActive('students') && { key: 'students', accent: MODULE_COLOR.students, label: 'Students', icon: 'fa-user-graduate',
      value: STUDENT_STATS.activeStudents,
      meta: <>
        <span className="dash-tile-meta-pill">+{STUDENT_STATS.recentAdmissions.length} this week</span>
        <span className="dash-tile-meta-pill dash-tile-meta-pill--m">Male: {STUDENT_STATS.maleStudents}</span>
        <span className="dash-tile-meta-pill dash-tile-meta-pill--f">Female: {STUDENT_STATS.femaleStudents}</span>
        <span>{STUDENT_STATS.inactiveStudents} inactive</span>
      </>,
      target: 'students' },
    moduleActive('hr') && { key: 'hr', accent: MODULE_COLOR.hr, label: 'Employees', icon: 'fa-users',
      value: HR_STATS.activeEmployees,
      meta: <><span className="dash-tile-meta-pill">{HR_STATS.departments.length} depts</span><span>{HR_STATS.inactiveEmployees} inactive</span></>,
      target: 'hr' },
    moduleActive('admissions') && { key: 'crm', accent: MODULE_COLOR.admissions, label: 'Active Leads', icon: 'fa-handshake',
      value: CRM_STATS.totalLeads,
      meta: <><span className="dash-tile-meta-pill">{CRM_STATS.followups.today} today</span><span>{CRM_STATS.followups.overdue} overdue</span></>,
      target: 'crm' },
    moduleActive('examination') && { key: 'exam', accent: MODULE_COLOR.examination, label: 'Exams Scheduled', icon: 'fa-file-pen',
      value: EXAM_STATS.totalExams,
      meta: <><span className="dash-tile-meta-pill">{EXAM_STATS.currentTermExams} current term</span><span>{EXAM_STATS.pendingResults} results pending</span></>,
      target: 'exam' },
    moduleActive('academics') && { key: 'activities', accent: MODULE_COLOR.academics, label: 'Activities', icon: 'fa-calendar-days',
      value: ACADEMICS_STATS.activities.completed + ACADEMICS_STATS.activities.ongoing + ACADEMICS_STATS.activities.upcoming,
      meta: <><span className="dash-tile-meta-pill">{ACADEMICS_STATS.activities.upcoming} upcoming</span><span>{ACADEMICS_STATS.activities.ongoing} ongoing</span></>,
      target: 'acad' },
    moduleActive('fee') && { key: 'fee', accent: MODULE_COLOR.fee, label: 'Fee Collection', icon: 'fa-money-bill-wave',
      value: FEE_STATS.collectionPct, suffix: '%',
      meta: <><span className="dash-tile-meta-pill">{FEE_STATS.defaulters} defaulters</span><span>PKR {(FEE_STATS.outstandingTotal / 100000).toFixed(1)}L outstanding</span></>,
      target: 'fee' },
    moduleActive('auditlogs') && { key: 'audit', accent: MODULE_COLOR.auditlogs, label: "Today's Activity", icon: 'fa-clipboard-list',
      value: AUDIT_STATS.today,
      meta: <><span className="dash-tile-meta-pill">{AUDIT_STATS.activeUsersToday} users</span><span>{AUDIT_STATS.thisWeek} this week</span></>,
      target: 'audit' },
  ].filter(Boolean);

  /* Newest announcement surfaces in the top card; sender + count of
     remaining new ones are computed for the pill + footer line. */
  const latestAnnouncement = SCHOOL_MENTOR_ANNOUNCEMENTS[0];
  const newAnnouncementCount = SCHOOL_MENTOR_ANNOUNCEMENTS.filter(a => a.status === 'new').length;

  /* Greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = user.name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./, '').trim().split(' ')[0];

  /* ─── New section local state ──────────────────────────────── */
  const [lpClass,    setLpClass]    = useState('II-Pre');
  const [paperClass, setPaperClass] = useState('IV');
  const [revenueYear, setRevenueYear] = useState(2026);
  const [birthdayTab, setBirthdayTab] = useState('all');

  /* Monthly Financial Summary — reads the same Accounts transaction
     ledger as Accounts → Reports (getAccTxns), so Expenses/Income/
     Net P&L here always match what that module reports. Supports the
     same three period filters as the OneLink Payments card below —
     Month / From–To / Single Date. */
  const { data: financeTxns } = useAsync(accountsService.getAccTxns, [], { rev: [], exp: [] });
  const [financeSeg, setFinanceSeg]     = useState('month'); // 'month' | 'range' | 'single'
  const [financeMonth, setFinanceMonth] = useState('2026-05');
  const [financeFrom, setFinanceFrom]   = useState('2026-05-01');
  const [financeTo, setFinanceTo]       = useState('2026-05-31');
  const [financeSingle, setFinanceSingle] = useState(() => new Date().toISOString().slice(0, 10));
  const financeSummary = useMemo(() => {
    const inPeriod = (x) => {
      const d = x.date;
      if (!d) return false;
      return financeSeg === 'month' ? x.month === financeMonth
        : financeSeg === 'range' ? (d >= financeFrom && d <= financeTo)
        : d === financeSingle;
    };
    const rev = (financeTxns.rev || []).filter(inPeriod).reduce((a, x) => a + Number(x.amount || 0), 0);
    const exp = (financeTxns.exp || []).filter(inPeriod).reduce((a, x) => a + Number(x.amount || 0), 0);
    const [yy, mm] = financeMonth.split('-');
    const label = financeSeg === 'month' ? `${FIN_MONTH_NAMES[Number(mm) - 1]} ${yy}`
      : financeSeg === 'range' ? `${financeFrom} to ${financeTo}`
      : financeSingle;
    return { label, income: rev, expense: exp, pl: rev - exp };
  }, [financeTxns, financeSeg, financeMonth, financeFrom, financeTo, financeSingle]);

  /* Top-card modals */
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showReport,        setShowReport]        = useState(null); /* 'teachers' | 'parents' | null */
  const [showDailyReceiving, setShowDailyReceiving] = useState(false);
  const [showDailyAdvancePayment, setShowDailyAdvancePayment] = useState(false);
  const [showDailyAdvanceAdjustment, setShowDailyAdvanceAdjustment] = useState(false);

  const lpData    = LP_DATA_BY_CLASS[lpClass]    || LP_DATA_BY_CLASS['II-Pre'];
  const paperData = PAPER_DATA_BY_CLASS[paperClass] || PAPER_DATA_BY_CLASS['IV'];
  const profitData  = PROFIT_LOSS_BY_YEAR[revenueYear]  || PROFIT_LOSS_BY_YEAR[2026];
  const plTotal = useMemo(() => profitData.reduce((s, d) => s + d.pl, 0), [profitData]);
  const lpMaxCw = useMemo(() => Math.max(...lpData.map(d => d.classwork)), [lpData]);
  const paperTotal = useMemo(() => paperData.reduce((s, p) => s + p.count, 0), [paperData]);

  const studentBdays = isActive('students') ? STUDENT_BIRTHDAYS : [];
  const teacherBdays = isActive('hr') ? TEACHER_BIRTHDAYS : [];
  const showStudents = birthdayTab === 'all' || birthdayTab === 'students';
  const showTeachers = birthdayTab === 'all' || birthdayTab === 'teachers';

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
        <MentorAISearchBar
          onNavigate={(target, params) => {
            navigate(target, params);
            toast(`Opening ${NAV_LABELS[target] || target.toUpperCase()}…`, 'info');
          }}
          canAccess={(_moduleId) => true /* TODO: hook into User Permissions when API lands */}
          sessionId={session?.id || null}
          toast={toast}
          placeholder="Search students, employees, lesson plans, exams, fees…"
          ctx={{ role: 'admin', sessionId: session?.id || null }}
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
            <b>{todayLabel}</b> · Session {session.label}. You have{' '}
            {moduleActive('admissions') && <><b>{CRM_STATS.followups.overdue + CRM_STATS.followups.today}</b> follow-ups</>}
            {moduleActive('admissions') && moduleActive('academics') && ' and '}
            {moduleActive('academics') && <><b>{ACADEMICS_STATS.lessonPlans.pending}</b> lesson plans pending</>}.
          </div>
        </div>
        <div className="dash-hero-r" ref={heroStatsReplay.ref}>
          {moduleActive('students') && (
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val"><AnimatedNumber key={heroStatsReplay.replayKey} value={STUDENT_STATS.activeStudents} duration={CHART_ANIM_MS} /></div>
              <div className="dash-hero-stat-lbl">Active Students</div>
            </div>
          )}
          {moduleActive('hr') && (
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val"><AnimatedNumber key={heroStatsReplay.replayKey} value={HR_STATS.activeEmployees} duration={CHART_ANIM_MS} /><small>/{HR_STATS.totalEmployees}</small></div>
              <div className="dash-hero-stat-lbl">Staff Active</div>
            </div>
          )}
          {moduleActive('attendance') && (
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val"><AnimatedNumber key={heroStatsReplay.replayKey} value={ATTENDANCE_STATS.todayStudentPct} duration={CHART_ANIM_MS} /><small>%</small></div>
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
        {canSeeCard('announcements') ? (
        <div className="adm-tc adm-tc--announce">
          <div className="adm-tc-h">
            <div className="adm-tc-h-l">
              <div className="adm-tc-ic adm-tc-ic--brand">
                <i className="fa-solid fa-bullhorn" aria-hidden="true"></i>
              </div>
              <div>
                <div className="adm-tc-t">School Mentor Announcements</div>
                <div className="adm-tc-s">{latestAnnouncement.sender}</div>
              </div>
            </div>
            {/* Only show when there are actual unread items — now a real
                button (not just a status pill) so it's both the loudest
                visual cue on the card AND a direct shortcut into the
                unread list, same destination as "View Details" below. */}
            {newAnnouncementCount > 0 && (
              <Tooltip text={`View ${newAnnouncementCount} unread message${newAnnouncementCount > 1 ? 's' : ''}`}>
                <button
                  type="button"
                  className="adm-tc-pill adm-tc-pill--new"
                  onClick={() => setShowAnnouncements(true)}
                  aria-label={`${newAnnouncementCount} unread announcement${newAnnouncementCount > 1 ? 's' : ''} — view all`}
                >
                  <span className="adm-tc-pill-dot" /> {newAnnouncementCount} New
                </button>
              </Tooltip>
            )}
          </div>

          <div className="adm-tc-body">
            <div className="adm-tc-an-title">{latestAnnouncement.title}</div>
            <div className="adm-tc-an-preview">{latestAnnouncement.preview}</div>
          </div>

          <div className="adm-tc-foot">
            <span className="adm-tc-meta">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>
              {latestAnnouncement.date} · {latestAnnouncement.time}
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
        ) : <LockedCard title="School Mentor Announcements" icon="fa-bullhorn" />}

        {/* ── Card 2: Teachers Mobile App ── */}
        {canSeeCard('teacherapp') ? (
        <AppStatusCard
          tone="green"
          title="Teachers Mobile App"
          subtitle="Adoption status"
          icon="fa-chalkboard-user"
          data={TEACHER_APP_STATUS}
          ctaLabel="Download Report"
          ctaIcon="fa-file-pdf"
          onCta={() => setShowReport('teachers')}
        />
        ) : <LockedCard title="Teachers Mobile App Status" icon="fa-chalkboard-user" />}

        {/* ── Card 3: Parents Mobile App ── */}
        {canSeeCard('parentapp') ? (
        <AppStatusCard
          tone="amber"
          title="Parents Mobile App"
          subtitle="Adoption status"
          icon="fa-people-roof"
          data={PARENT_APP_STATUS}
          ctaLabel="Download Report"
          ctaIcon="fa-file-pdf"
          onCta={() => setShowReport('parents')}
        />
        ) : <LockedCard title="Parents Mobile App Status" icon="fa-people-roof" />}
      </div>

      {/* ─── Modals (rendered on demand) ─── */}
      {showAnnouncements && (
        <AnnouncementsModal
          onClose={() => setShowAnnouncements(false)}
          toast={toast}
        />
      )}
      {showReport && (
        <AppPendingReportModal
          mode={showReport}
          onClose={() => setShowReport(null)}
          toast={toast}
        />
      )}
      {showDailyReceiving && (
        <DailyReceivingReportModal
          receipts={faReceipts}
          classes={faClasses}
          studentsMap={faStudentsMap}
          onClose={() => setShowDailyReceiving(false)}
          toast={toast}
        />
      )}
      {showDailyAdvancePayment && (
        <DailyAdvancePaymentReportModal
          receipts={faReceipts}
          classes={faClasses}
          studentsMap={faStudentsMap}
          headsMap={faHeadsMap}
          discMap={faDiscMap}
          generatedSet={faGeneratedSet || new Set()}
          onClose={() => setShowDailyAdvancePayment(false)}
          toast={toast}
        />
      )}
      {showDailyAdvanceAdjustment && (
        <DailyAdvanceAdjustmentReportModal
          advanceLedger={faAdvanceLedger}
          classes={faClasses}
          studentsMap={faStudentsMap}
          onClose={() => setShowDailyAdvanceAdjustment(false)}
          toast={toast}
        />
      )}

      {tiles.length > 0 && (
        !canSeeCard('snapshot') ? (
          <LockedCard title="Live Module Snapshot" icon="fa-chart-simple" />
        ) : (
        <div className="dash-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title">
              <i className="fa-solid fa-chart-simple" aria-hidden="true"></i> Live Module Snapshot
            </div>
            <span className="dash-sec-sub">Click any tile to open its module</span>
          </div>
          <div className="dash-tiles" ref={tilesReplay.ref}>
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
                  <div className="dash-tile-val">
                    <AnimatedNumber key={`${t.key}-${tilesReplay.replayKey}`} value={t.value} suffix={t.suffix || ''} duration={CHART_ANIM_MS} />
                  </div>
                  <div className="dash-tile-meta">{t.meta}</div>
                </div>
              </Tooltip>
              );
            })}
          </div>
        </div>
        )
      )}

      {/* ═════════ 3. FEE ANALYTICS ═════════ */}
      {isActive('fee') && (
        <div className="dash-sec adm-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title"><i className="fa-solid fa-coins" aria-hidden="true"></i> Fee Analytics</div>
            <div className="adm-h-right">
              <span className="adm-h-meta">Month:</span>
              <select
                className="adm-select"
                value={feeMonthIdx}
                onChange={(e) => setFeeMonthIdx(Number(e.target.value))}
                aria-label="Select month for Fee Analytics"
              >
                {FIN_MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m} 2026</option>)}
              </select>
              <button type="button" className="dash-sec-link" onClick={() => openModule('fee')}>
                Open Fee <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {/* ═════════ FEE ANALYTICS OVERVIEW — graphical summary,
              reshaping the SAME feeExtras totals the 8 cards below
              already read (no second fetch). "View Cards" scrolls
              down to feeCardsRef, the top of the existing card grid,
              instead of duplicating it. Gated by its own
              dashboard.fee_analytics_overview.view permission, same
              pattern as every other card here. ═════════ */}
          {canSeeCard('fee_analytics_overview') ? (
          <div className="fa-overview">
            <div className="fa-overview-head">
              <div className="fa-overview-title">
                <i className="fa-solid fa-chart-column" aria-hidden="true"></i> Fee Analytics Overview
                <span className="fa-live-badge"><span className="fa-live-dot" /> Live</span>
              </div>
              <div className="fa-overview-sub">A quick visual read of <b>{feeMonthLabel}</b>&apos;s fee position, before the detailed cards below</div>
            </div>

            <div className="fa-highlight-strip" ref={faHighlightsReplay.ref}>
              {faHighlights.map((h, i) => (
                <div
                  key={h.label}
                  className={`fa-highlight-tile fa-highlight-tile--${h.tone}`}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <i className={`fa-solid ${h.icon}`} aria-hidden="true"></i>
                  <div>
                    <div className="fa-highlight-val">
                      <AnimatedNumber key={faHighlightsReplay.replayKey} value={h.value} suffix={h.suffix} duration={CHART_ANIM_MS} />
                    </div>
                    <div className="fa-highlight-lbl">{h.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="fa-chart-card fa-chart-card--wide" ref={overviewCompReplay.ref}>
              <div className="adm-card-h">
                <div className="adm-card-h-t">Overview Comparison</div>
                <span className="adm-card-h-meta">{feeMonthLabel}</span>
              </div>
              <ResponsiveContainer key={overviewCompReplay.replayKey} width="100%" height={320}>
                <BarChart data={overviewChartData} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="short" width={100} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <RTooltip content={<FeeChartTooltip />} cursor={{ fill: 'rgba(30,64,175,.06)' }} />
                  <Bar
                    dataKey="value" name="Amount" radius={[0, 6, 6, 0]} maxBarSize={20}
                    isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={0}
                  >
                    {overviewChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="fa-chart-grid" ref={feeGridReplay.ref}>
              <div className="fa-chart-card">
                <div className="adm-card-h">
                  <div className="adm-card-h-t">Net Receivable Breakdown</div>
                </div>
                {breakdownChartData.length === 0 ? (
                  <div className="fa-chart-empty">No amounts recorded yet for {feeMonthLabel}.</div>
                ) : (
                  <ResponsiveContainer key={feeGridReplay.replayKey} width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={breakdownChartData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}
                        isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={0}
                      >
                        {breakdownChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <RTooltip content={<FeeChartTooltip showPct />} />
                      <Legend verticalAlign="bottom" height={48} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="fa-chart-card">
                <div className="adm-card-h">
                  <div className="adm-card-h-t">Collections vs Outstanding</div>
                </div>
                <ResponsiveContainer key={`coll-${feeGridReplay.replayKey}`} width="100%" height={260}>
                  <BarChart data={collectionsChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <RTooltip content={<FeeChartTooltip />} cursor={{ fill: 'rgba(30,64,175,.06)' }} />
                    <Bar
                      dataKey="value" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={64}
                      isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={0}
                    >
                      {collectionsChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="fa-viewcards-row">
              <button
                type="button"
                className={`fa-viewcards-btn${showFeeCards ? ' fa-viewcards-btn--open' : ''}`}
                onClick={toggleFeeCards}
                aria-expanded={showFeeCards}
              >
                <i className="fa-solid fa-table-cells-large" aria-hidden="true"></i> {showFeeCards ? 'Hide Cards' : 'View Cards'}
                <i className={`fa-solid fa-chevron-down fa-viewcards-chev${showFeeCards ? ' fa-viewcards-chev--open' : ''}`} aria-hidden="true"></i>
              </button>
            </div>
          </div>
          ) : <LockedCard title="Fee Analytics Overview" icon="fa-chart-column" className="fa-overview-locked" />}

          {/* ═════════ DETAILED FEE ANALYTICS CARDS — hidden until
              "View Cards" is clicked; stays unmounted (not just
              display:none) while collapsed. ═════════ */}
          {showFeeCards && (
          <>
          {/* ═════════ TOP ROW — 3 summary cards ═════════ */}
          <div className="fa-top-grid" ref={feeCardsRef}>

            {/* Card 1 — Current Month Fee Position (primary summary) */}
            {canSeeCard('fee_currentmonth') ? (
            <div className="stat-card fee-card fa-card fc-tone--brand fa-card--primary">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-money-check-dollar" aria-hidden="true"></i>
                </div>
                <div className="fc-title">Current Month Fee Position</div>
                <FeeAnalyticsInfoButton cardKey="currentMonth" />
              </div>
              <div className="fc-amount fa-amount--lg"><AnimatedNumber prefix="PKR " value={feeExtras.currentMonthTotal} duration={CHART_ANIM_MS} /></div>
              <div className="fa-formula">
                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>Generated challans for {feeMonthLabel}</span>
              </div>
              <div className="fc-divider" />
              <div className="fa-meta-rows">
                <div className="fa-meta-row">
                  <span className="fa-meta-lbl">
                    <i className="fa-solid fa-file-invoice" aria-hidden="true"></i> Challans Generated
                  </span>
                  <span className="fa-meta-val">
                    <span className="fc-highlight">{feeExtras.challansGenerated}</span><span className="fa-meta-div">/</span><span className="fa-meta-total">{feeExtras.totalStudents}</span>
                  </span>
                </div>
              </div>
            </div>
            ) : <LockedCard title="Current Month Fee Position" icon="fa-money-check-dollar" />}

            {/* Card 2 — Previous Dues */}
            {canSeeCard('fee_previousdues') ? (
            <div className="stat-card fee-card fa-card fc-tone--red fc-bordered">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                </div>
                <div className="fc-title fc-title--red">Previous Dues</div>
                <FeeAnalyticsInfoButton cardKey="previousDues" />
              </div>
              <div className="fc-amount fc-amount--red fa-amount--lg"><AnimatedNumber prefix="PKR " value={feeExtras.previousDuesTotal} duration={CHART_ANIM_MS} /></div>
              <div className="fc-divider" />
              <div className="fa-meta-rows">
                <div className="fa-meta-row">
                  <span className="fa-meta-lbl">
                    <i className="fa-solid fa-users" aria-hidden="true"></i> Students with Dues
                  </span>
                  <span className="fa-meta-val fa-meta-val--red">{feeExtras.studentsWithDues}</span>
                </div>
                <div className="fa-meta-row fa-meta-row--muted">
                  <i className="fa-solid fa-clock" aria-hidden="true"></i>
                  <span>Carried from past months</span>
                </div>
              </div>
            </div>
            ) : <LockedCard title="Previous Dues" icon="fa-circle-exclamation" />}

            {/* Card 3 — Total Net Receivable */}
            {canSeeCard('fee_netreceivable') ? (
            <div className="stat-card fee-card fa-card fc-tone--slate fa-card--total">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-scale-balanced" aria-hidden="true"></i>
                </div>
                <div className="fc-title">Total Net Receivable</div>
                <FeeAnalyticsInfoButton cardKey="netReceivable" />
              </div>
              <div className="fc-amount fa-amount--lg"><AnimatedNumber prefix="PKR " value={feeExtras.netReceivableTotal} duration={CHART_ANIM_MS} /></div>
              <div className="fa-formula">
                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>Current Month Net Receivable + Previous Dues</span>
              </div>
              <div className="fc-divider" />
              <div className="fa-formula-breakdown">
                <div>
                  <span className="fa-bd-lbl">This Month</span>
                  <span className="fa-bd-val"><AnimatedNumber prefix="PKR " value={feeExtras.currentMonthTotal} duration={CHART_ANIM_MS} /></span>
                </div>
                <span className="fa-bd-op">+</span>
                <div>
                  <span className="fa-bd-lbl">Previous</span>
                  <span className="fa-bd-val fa-bd-val--red"><AnimatedNumber prefix="PKR " value={feeExtras.previousDuesTotal} duration={CHART_ANIM_MS} /></span>
                </div>
              </div>
            </div>
            ) : <LockedCard title="Total Net Receivable" icon="fa-scale-balanced" />}
          </div>

          {/* ═════════ SECOND ROW — 3 cards (Received / Discount / Advance) ═════════ */}
          <div className="fa-second-grid">

            {/* Card 4 — Fee Received */}
            {canSeeCard('fee_received') ? (
            <div className="stat-card fee-card fa-card fc-tone--green fc-bordered">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
                </div>
                <div className="fc-title">Fee Received</div>
                <FeeAnalyticsInfoButton cardKey="received" />
              </div>
              <div className="fc-amount fc-amount--green fa-amount--lg"><AnimatedNumber prefix="PKR " value={feeExtras.receivedTotal} duration={CHART_ANIM_MS} /></div>
              <div className="fa-formula">
                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>Amount actually collected in {feeMonthLabel}</span>
              </div>
              <div className="fc-divider" />
              <div className="fa-progress">
                <div className="fa-progress-h">
                  <span>Collected</span>
                  <span><b>{feeExtras.receivedPct}%</b> of Net Receivable</span>
                </div>
                <div className="fa-progress-track">
                  <div className="fa-progress-fill fa-progress-fill--green" style={{ width: `${feeExtras.receivedPct}%` }} />
                </div>
              </div>
              <div className="fa-meta-rows">
                <div className="fa-meta-row">
                  <span className="fa-meta-lbl">
                    <i className="fa-solid fa-users" aria-hidden="true"></i> Students Paid
                  </span>
                  <span className="fa-meta-val fa-meta-val--green">{feeExtras.receivedStudentCount}</span>
                </div>
              </div>
              <div className="adm-tc-foot adm-tc-foot--row2">
                <Tooltip text="View or download fee receiving transactions for a single day">
                  <button type="button" className="adm-tc-btn adm-tc-btn--half" onClick={() => setShowDailyReceiving(true)} aria-label="Open Daily Receiving Report">
                    <i className="fa-solid fa-calendar-day" aria-hidden="true"></i> Daily Report
                  </button>
                </Tooltip>
                <Tooltip text="Download the student-wise Fee Received report">
                  <button type="button" className="adm-tc-btn adm-tc-btn--half" onClick={downloadFeeReceivedReport} aria-label="Download Fee Received report">
                    <i className="fa-solid fa-download" aria-hidden="true"></i> Download Report
                  </button>
                </Tooltip>
              </div>
            </div>
            ) : <LockedCard title="Fee Received" icon="fa-circle-check" />}

            {/* Card 5 — Discount Given During Receiving */}
            {canSeeCard('fee_discountgiven') ? (
            <div className="stat-card fee-card fa-card fc-tone--amber fc-bordered">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-tags" aria-hidden="true"></i>
                </div>
                <div className="fc-title">Discount Given During Receiving</div>
                <FeeAnalyticsInfoButton cardKey="discountGiven" />
              </div>
              <div className="fc-amount fc-amount--amber fa-amount--lg"><AnimatedNumber prefix="PKR " value={feeExtras.discountTotal} duration={CHART_ANIM_MS} /></div>
              <div className="fa-formula">
                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>Additional discounts provided during payment receiving</span>
              </div>
              <div className="fc-divider" />
              <div className="fa-meta-rows">
                <div className="fa-meta-row">
                  <span className="fa-meta-lbl">
                    <i className="fa-solid fa-users" aria-hidden="true"></i> Students Given Discount
                  </span>
                  <span className="fa-meta-val fa-meta-val--amber">{feeExtras.discountStudentCount}</span>
                </div>
                <div className="fa-meta-row fa-meta-row--muted">
                  <i className="fa-solid fa-arrow-down" aria-hidden="true"></i>
                  <span>Reduces outstanding receivable</span>
                </div>
              </div>
              <div className="adm-tc-foot">
                <Tooltip text="Download the student-wise Discount Given report">
                  <button type="button" className="adm-tc-btn adm-tc-btn--full" onClick={downloadFeeDiscountReport} aria-label="Download Discount Given report">
                    <i className="fa-solid fa-download" aria-hidden="true"></i> Download Report
                  </button>
                </Tooltip>
              </div>
            </div>
            ) : <LockedCard title="Discount Given During Receiving" icon="fa-tags" />}

            {/* Card 6 — Advance Adjustments. Sits in the main calculation
                flow (Fee Received → Discount → Advance Adjustments →
                Pending Fee) since, unlike Advance Payments Received
                below, this figure genuinely reduces Pending Fee. */}
            {canSeeCard('fee_advanceadjustments') ? (
            <div className="stat-card fee-card fa-card fc-tone--purple fc-bordered">
              <div className="fc-header">
                <div className="fc-icon-chip">
                  <i className="fa-solid fa-arrow-right-arrow-left" aria-hidden="true"></i>
                </div>
                <div className="fc-title">Advance Adjustments</div>
                <FeeAnalyticsInfoButton cardKey="advanceAdjustments" />
              </div>
              <div className="fc-amount fc-amount--purple fa-amount--lg"><AnimatedNumber prefix="PKR " value={feeExtras.advanceAdjustmentTotal} duration={CHART_ANIM_MS} /></div>
              <div className="fa-formula">
                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>Previous advance payments adjusted against current fee</span>
              </div>
              <div className="fc-divider" />
              <div className="fa-meta-rows">
                <div className="fa-meta-row">
                  <span className="fa-meta-lbl">
                    <i className="fa-solid fa-users" aria-hidden="true"></i> Students Adjusted
                  </span>
                  <span className="fa-meta-val fa-meta-val--purple">{feeExtras.advanceAdjustmentStudentCount}</span>
                </div>
                <div className="fa-meta-row fa-meta-row--muted">
                  <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                  <span>Amount adjusted from previous advance balances</span>
                </div>
              </div>
              <div className="adm-tc-foot adm-tc-foot--row2">
                <Tooltip text="View or download advance adjustments made on a single day">
                  <button type="button" className="adm-tc-btn adm-tc-btn--half" onClick={() => setShowDailyAdvanceAdjustment(true)} aria-label="Open Daily Advance Adjustment Report">
                    <i className="fa-solid fa-calendar-day" aria-hidden="true"></i> Daily Report
                  </button>
                </Tooltip>
                <Tooltip text="Download the student-wise Advance Adjustments report">
                  <button type="button" className="adm-tc-btn adm-tc-btn--half" onClick={downloadFeeAdvanceAdjustmentReport} aria-label="Download Advance Adjustments report">
                    <i className="fa-solid fa-download" aria-hidden="true"></i> Download Report
                  </button>
                </Tooltip>
              </div>
            </div>
            ) : <LockedCard title="Advance Adjustments" icon="fa-arrow-right-arrow-left" />}
          </div>

          {/* ═════════ THIRD ROW — Pending Fee, final outcome (full width) ═════════ */}
          {canSeeCard('fee_pending') ? (
          <div className="stat-card fee-card fa-card fa-large fa-final fc-tone--red fc-bordered">
            <div className="fc-header">
              <div className="fc-icon-chip">
                <i className="fa-solid fa-hourglass-half" aria-hidden="true"></i>
              </div>
              <div className="fc-title fc-title--red">Pending Fee</div>
              <span className="fa-final-tag">Final Outcome</span>
              <FeeAnalyticsInfoButton cardKey="pending" />
            </div>
            <div className="fc-amount fc-amount--red fa-amount--xl"><AnimatedNumber prefix="PKR " value={feeExtras.pendingTotal} duration={CHART_ANIM_MS} /></div>

            <div className="fa-progress">
              <div className="fa-progress-h">
                <span>Recovery Action Needed</span>
                <span><b>{feeExtras.pendingPct}%</b> of Net Receivable still outstanding</span>
              </div>
              <div className="fa-progress-track">
                <div className="fa-progress-fill fa-progress-fill--red" style={{ width: `${feeExtras.pendingPct}%` }} />
              </div>
            </div>

            <div className="fc-divider" />
            <div className="fa-formula">
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
              <span>{feeMonthLabel}: Net Receivable − Fee Received − Receiving Discount − Advance Adjustments = Pending Fee</span>
            </div>
            <div className="fa-formula-breakdown fa-formula-breakdown--wrap">
              <div>
                <span className="fa-bd-lbl">Net Receivable</span>
                <span className="fa-bd-val"><AnimatedNumber prefix="PKR " value={feeExtras.netReceivableTotal} duration={CHART_ANIM_MS} /></span>
              </div>
              <span className="fa-bd-op">−</span>
              <div>
                <span className="fa-bd-lbl">Received</span>
                <span className="fa-bd-val"><AnimatedNumber prefix="PKR " value={feeExtras.receivedTotal} duration={CHART_ANIM_MS} /></span>
              </div>
              <span className="fa-bd-op">−</span>
              <div>
                <span className="fa-bd-lbl">Receiving Discount</span>
                <span className="fa-bd-val"><AnimatedNumber prefix="PKR " value={feeExtras.discountTotal} duration={CHART_ANIM_MS} /></span>
              </div>
              <span className="fa-bd-op">−</span>
              <div>
                <span className="fa-bd-lbl">Advance Adjustments</span>
                <span className="fa-bd-val"><AnimatedNumber prefix="PKR " value={feeExtras.advanceAdjustmentTotal} duration={CHART_ANIM_MS} /></span>
              </div>
              <span className="fa-bd-op fa-bd-op--eq">=</span>
              <div>
                <span className="fa-bd-lbl">Pending</span>
                <span className="fa-bd-val fa-bd-val--red"><AnimatedNumber prefix="PKR " value={feeExtras.pendingTotal} duration={CHART_ANIM_MS} /></span>
              </div>
            </div>

            <div className="fa-advance-note">
              <div className="fa-advance-note-top">
                <span className="fa-advance-note-lbl">
                  <i className="fa-solid fa-piggy-bank" aria-hidden="true"></i> Advance Available
                </span>
                <span className="fa-advance-note-val"><AnimatedNumber prefix="PKR " value={feeExtras.advanceTotal} duration={CHART_ANIM_MS} /></span>
              </div>
              <div className="fa-advance-note-cap">This amount will be adjusted in future fee payments. It is not part of the Pending Fee above.</div>
            </div>
          </div>
          ) : <LockedCard title="Pending Fee" icon="fa-hourglass-half" />}

          {/* ═════════ Advance Payments Received — a separate
              information card below Pending Fee, not part of the main
              calculation flow above it. This is money collected above
              what was payable, carried forward as a future adjustment
              balance — it deliberately does NOT reduce Pending Fee,
              does NOT appear in Fee Received, and does NOT affect the
              collection percentage (see Card 6 "Advance Adjustments"
              above for the money that DOES reduce Pending Fee, once a
              balance like this is actually applied to a challan). ═════════ */}
          {canSeeCard('fee_advance') ? (
          <div className="stat-card fee-card fa-card fa-large fc-tone--purple fc-bordered">
            <div className="fc-header">
              <div className="fc-icon-chip">
                <i className="fa-solid fa-piggy-bank" aria-hidden="true"></i>
              </div>
              <div className="fc-title">Advance Payments Received</div>
              <FeeAnalyticsInfoButton cardKey="advance" />
            </div>
            <div className="fc-amount fc-amount--purple fa-amount--lg"><AnimatedNumber prefix="PKR " value={feeExtras.advanceTotal} duration={CHART_ANIM_MS} /></div>
            <span className="fa-badge fa-badge--purple">Future Adjustment Balance</span>
            <div className="fa-formula">
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
              <span>Extra amount collected above current payable, carried forward</span>
            </div>
            <div className="fc-divider" />
            <div className="fa-meta-rows">
              <div className="fa-meta-row">
                <span className="fa-meta-lbl">
                  <i className="fa-solid fa-users" aria-hidden="true"></i> Students Paid in Advance
                </span>
                <span className="fa-meta-val fa-meta-val--purple">{feeExtras.advanceStudentCount}</span>
              </div>
              <div className="fa-meta-row fa-meta-row--muted">
                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>Does not reduce current pending dues</span>
              </div>
            </div>
            <div className="adm-tc-foot adm-tc-foot--row2">
              <Tooltip text="View or download advance payments created on a single day">
                <button type="button" className="adm-tc-btn adm-tc-btn--half" onClick={() => setShowDailyAdvancePayment(true)} aria-label="Open Daily Advance Payment Report">
                  <i className="fa-solid fa-calendar-day" aria-hidden="true"></i> Daily Report
                </button>
              </Tooltip>
              <Tooltip text="Download the student-wise Advance Payment report">
                <button type="button" className="adm-tc-btn adm-tc-btn--half" onClick={downloadFeeAdvanceReport} aria-label="Download Advance Payment report">
                  <i className="fa-solid fa-download" aria-hidden="true"></i> Download Report
                </button>
              </Tooltip>
            </div>
          </div>
          ) : <LockedCard title="Advance Payments Received" icon="fa-piggy-bank" />}

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
          </>
          )}
        </div>
      )}

      <div className="adm-divider" />

      {/* ═════════ 3b. ONELINK PAYMENTS ═════════ */}
      {isActive('fee') && (
        canSeeCard('onelink')
          ? <OneLinkPaymentSection openModule={openModule} toast={toast} />
          : <LockedCard title="OneLink Payments" icon="fa-building-columns" />
      )}

      <div className="adm-divider" />

      {/* ═════════ ACCOUNTS / REVENUE ═════════ */}
      {isActive('accounts') && (
        <div className="dash-sec adm-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title"><i className="fa-solid fa-calculator" aria-hidden="true"></i> Financial Overview</div>
            <select
              className="adm-select"
              value={revenueYear}
              onChange={(e) => setRevenueYear(Number(e.target.value))}
              aria-label="Select year"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>

          {/* ─── Monthly Financial Summary (NEW) ───
              Parent card + month selector, 3 sub-cards reading the same
              Accounts ledger (getAccTxns) that Accounts → Reports uses,
              via the identical per-month reduce. No new backend calls. */}
          {!canSeeCard('finsummary') ? (
            <LockedCard title="Monthly Financial Summary" icon="fa-sack-dollar" />
          ) : (
          <div className="fin-summary-card">
            <div className="fin-summary-head">
              <div className="fin-summary-head-l">
                <div className="fin-summary-ic"><i className="fa-solid fa-sack-dollar" aria-hidden="true"></i></div>
                <div>
                  <div className="fin-summary-t">Monthly Financial Summary</div>
                  <div className="fin-summary-s">{financeSummary.label} · from Accounts ledger</div>
                </div>
              </div>
              <div className="ol-controls">
                <div className="adm-seg" role="tablist" aria-label="Financial summary period filter">
                  <button type="button" className={`adm-seg-btn${financeSeg === 'month' ? ' on' : ''}`} role="tab" aria-selected={financeSeg === 'month'} onClick={() => setFinanceSeg('month')}>Month</button>
                  <button type="button" className={`adm-seg-btn${financeSeg === 'range' ? ' on' : ''}`} role="tab" aria-selected={financeSeg === 'range'} onClick={() => setFinanceSeg('range')}>From – To</button>
                  <button type="button" className={`adm-seg-btn${financeSeg === 'single' ? ' on' : ''}`} role="tab" aria-selected={financeSeg === 'single'} onClick={() => setFinanceSeg('single')}>Single Date</button>
                </div>

                {financeSeg === 'month' && (
                  <label className="fin-summary-month">
                    <span className="fin-summary-month-lbl">Month</span>
                    <input
                      type="month"
                      className="fin-summary-month-input"
                      value={financeMonth}
                      min="2026-01"
                      max="2026-05"
                      onChange={(e) => setFinanceMonth(e.target.value)}
                      aria-label="Select month for financial summary"
                    />
                  </label>
                )}
                {financeSeg === 'range' && (
                  <>
                    <label className="fin-summary-month">
                      <span className="fin-summary-month-lbl">From</span>
                      <input type="date" className="fin-summary-month-input" value={financeFrom} onChange={(e) => setFinanceFrom(e.target.value)} aria-label="From date for financial summary" />
                    </label>
                    <label className="fin-summary-month">
                      <span className="fin-summary-month-lbl">To</span>
                      <input type="date" className="fin-summary-month-input" value={financeTo} onChange={(e) => setFinanceTo(e.target.value)} aria-label="To date for financial summary" />
                    </label>
                  </>
                )}
                {financeSeg === 'single' && (
                  <label className="fin-summary-month">
                    <span className="fin-summary-month-lbl">Date</span>
                    <input type="date" className="fin-summary-month-input" value={financeSingle} onChange={(e) => setFinanceSingle(e.target.value)} aria-label="Select date for financial summary" />
                  </label>
                )}
              </div>
            </div>

            <div className="fin-summary-grid" ref={financeCardsReplay.ref}>
              <div className="fee-card fa-card fc-tone--red fc-bordered fin-summary-sub">
                <div className="fc-header">
                  <div className="fc-icon-chip"><i className="fa-solid fa-arrow-trend-down" aria-hidden="true"></i></div>
                  <div className="fc-title fc-title--red">Overall Expenses</div>
                </div>
                <div className="fc-amount fc-amount--red fa-amount--lg">
                  <AnimatedNumber key={financeCardsReplay.replayKey} prefix="PKR " value={financeSummary.expense} duration={CHART_ANIM_MS} />
                </div>
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
                <div className="fc-amount fc-amount--green fa-amount--lg">
                  <AnimatedNumber key={financeCardsReplay.replayKey} prefix="PKR " value={financeSummary.income} duration={CHART_ANIM_MS} />
                </div>
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
                  {financeSummary.pl >= 0 ? '+' : '−'}
                  <AnimatedNumber key={financeCardsReplay.replayKey} prefix="PKR " value={Math.abs(financeSummary.pl)} duration={CHART_ANIM_MS} />
                </div>
                <div className="fc-support">
                  <i className="fa-solid fa-calendar" aria-hidden="true"></i>
                  <span>{financeSummary.label}</span>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Profit/Loss Overview — full width (Revenue Streams removed) */}
          {!canSeeCard('plchart') ? (
            <LockedCard title="Profit/Loss Overview" icon="fa-chart-column" />
          ) : (
          <div className="pl-overview" ref={plOverviewReplay.ref}>
            <div className="adm-card-h">
              <div className="adm-card-h-t">Profit/Loss Overview <span className="fa-live-badge"><span className="fa-live-dot" /> Live</span></div>
              <div className="pl-head-right">
                <select
                  className="adm-select pl-year-select"
                  value={revenueYear}
                  onChange={(e) => setRevenueYear(Number(e.target.value))}
                  aria-label="Select year for Profit/Loss Overview"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
                <span className="adm-card-h-meta" style={{ color: plTotal >= 0 ? '#16A34A' : '#DC2626', fontWeight: 800 }}>
                  Net Profit / Loss: <b>{plTotal >= 0 ? '+' : '−'}Rs. <AnimatedNumber key={plOverviewReplay.replayKey} value={Math.abs(plTotal)} decimals={2} duration={CHART_ANIM_MS} />M</b>
                </span>
              </div>
            </div>
            <div className="pl-chart-scroll">
              <ResponsiveContainer key={plOverviewReplay.replayKey} width="100%" height={360} minWidth={640}>
                <ComposedChart data={profitData} margin={{ top: 12, right: 28, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 12.5, fill: '#64748B', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis domain={[-3, 5]} tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => `${v}M`} />
                  {/* Hidden right axis, scaled to the pl series' own range so the
                      Profit/Loss bars read clearly instead of being squashed
                      against the much wider revenue/expense scale. Display-only —
                      the underlying pl values are unchanged. */}
                  <YAxis yAxisId="pl" orientation="right" domain={[(dataMin) => Math.min(0, dataMin - 0.15), (dataMax) => dataMax + 0.2]} hide />
                  <RTooltip content={<ProfitLossTooltip />} cursor={{ fill: 'rgba(30, 64, 175, .07)' }} />
                  <Bar yAxisId="pl" dataKey="pl" name="Profit/Loss" fillOpacity={0.88} radius={[8, 8, 0, 0]} barSize={30}
                    isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={0}
                  >
                    {profitData.map((d, i) => (
                      <Cell key={i} fill={d.pl >= 0 ? '#16A34A' : '#DC2626'} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="revenue" name="Revenue"   stroke="#1E40AF" strokeWidth={2.6} dot={{ r: 4, stroke: '#1E40AF', fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }}
                    isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={150}
                  />
                  <Line type="monotone" dataKey="expense" name="Expenses"  stroke="#DC2626" strokeWidth={2.6} dot={{ r: 4, stroke: '#DC2626', fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }}
                    isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={300}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="adm-legend pl-legend">
              <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#1E40AF' }} />Revenue</span>
              <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#DC2626' }} />Expenses</span>
              <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#16A34A' }} />Profit/Loss</span>
            </div>
          </div>
          )}

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
      {moduleActive('attendance') && (
        canSeeCard('attendance')
          ? <AttendanceSection openModule={openModule} />
          : <LockedCard title="Today's Attendance" icon="fa-clipboard-check" />
      )}

      <div className="adm-divider" />

      {/* ═════════ 4. LESSON PLAN ANALYTICS ═════════ */}
      {isActive('academics') && (
        !canSeeCard('lessonplananalytics') ? (
          <LockedCard title="Lesson Plan Analytics" icon="fa-book-open-reader" />
        ) : (
        <div className="dash-sec adm-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title"><i className="fa-solid fa-book-open-reader" aria-hidden="true"></i> Lesson Plan Analytics <span className="fa-live-badge"><span className="fa-live-dot" /> Live</span></div>
            <select
              className="adm-select"
              value={lpClass}
              onChange={(e) => setLpClass(e.target.value)}
              aria-label="Select class"
            >
              {LP_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="adm-2col">
            <div className="adm-chart-card" ref={lpChartReplay.ref}>
              <ResponsiveContainer key={lpChartReplay.replayKey} width="100%" height={200}>
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
                  <XAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="classwork" name="Classwork" stroke="#1E40AF" strokeWidth={2.2} fill="url(#lpClasswork)" dot={{ r: 3, stroke: '#1E40AF', fill: '#fff', strokeWidth: 2 }}
                    isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={0}
                  />
                  <Area type="monotone" dataKey="notebook"  name="Notebook"  stroke="#16A34A" strokeWidth={2.2} fill="url(#lpNotebook)"  dot={{ r: 3, stroke: '#16A34A', fill: '#fff', strokeWidth: 2 }}
                    isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={150}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="adm-legend">
                <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#1E40AF' }} />Classwork</span>
                <span className="adm-legend-i"><span className="adm-legend-dot" style={{ background: '#16A34A' }} />Notebook</span>
              </div>
            </div>

            <div className="adm-side-card" ref={subjCompletionReplay.ref}>
              <div className="adm-side-title">Subject-wise Completion</div>
              <div className="adm-bars">
                {lpData.map(d => {
                  const pct = lpMaxCw > 0 ? (d.classwork / lpMaxCw) * 100 : 0;
                  return (
                    <div key={d.subject} className="adm-bar-row">
                      <div className="adm-bar-lbl">{d.subject}</div>
                      <div className="adm-bar-track">
                        <div
                          className="adm-bar-fill"
                          style={{
                            width: `${subjCompletionReplay.inView ? pct : 0}%`,
                            transitionDuration: `${CHART_ANIM_MS}ms`,
                            transitionTimingFunction: 'ease-out',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        )
      )}

      <div className="adm-divider" />

      {/* ═════════ 5. PAPER GENERATOR ═════════ */}
      {isActive('paper_generator') && (
        !canSeeCard('papergenerator') ? (
          <LockedCard title="Question Paper Generator" icon="fa-scroll" />
        ) : (
        <div className="dash-sec adm-sec" ref={paperSecReplay.ref}>
          <div className="dash-sec-h">
            <div className="dash-sec-title"><i className="fa-solid fa-scroll" aria-hidden="true"></i> Question Paper Generator <span className="fa-live-badge"><span className="fa-live-dot" /> Live</span></div>
            <div className="adm-h-right">
              <span className="adm-h-meta">Total: <b><AnimatedNumber key={paperSecReplay.replayKey} value={paperTotal} duration={CHART_ANIM_MS} /> Papers</b></span>
              <select
                className="adm-select"
                value={paperClass}
                onChange={(e) => setPaperClass(e.target.value)}
                aria-label="Select class"
              >
                {PAPER_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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
                  {paperData.map(p => (
                    <tr key={p.subject}>
                      <td><b>{p.subject}</b></td>
                      <td><AnimatedNumber key={`${p.subject}-${paperSecReplay.replayKey}`} value={p.count} duration={CHART_ANIM_MS} /> Question Papers</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="adm-chart-card">
              <div className="adm-side-tag">Paper Generation Statistics</div>
              <ResponsiveContainer key={paperSecReplay.replayKey} width="100%" height={180}>
                <BarChart data={paperData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Papers" radius={[6, 6, 0, 0]} fill="#4169E1"
                    isAnimationActive={chartsAnimated} animationDuration={CHART_ANIM_MS} animationEasing="ease-out" animationBegin={0}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        )
      )}

      <div className="adm-divider" />

      {/* ═════════ 7. BIRTHDAYS THIS MONTH ═════════ */}
      {(isActive('students') || isActive('hr')) && (
        !canSeeCard('birthdays') ? (
          <LockedCard title="Birthdays This Month" icon="fa-cake-candles" />
        ) : (
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
            <span>Showing birthdays for May 2026</span>
          </div>

          <div className="adm-bday-row">
            {isActive('students') && showStudents && (
              <div className="adm-bday-col">
                <div className="adm-side-tag">
                  Students
                  <span className="adm-pill-blue">{studentBdays.length}</span>
                </div>
                <div className="adm-bday-list">
                  {studentBdays.map(b => {
                    const isToday = b.dob === TODAY_DAY;
                    const isTomorrow = b.dob === TODAY_DAY + 1;
                    return (
                      <div
                        key={b.name}
                        className={`adm-bday-card${isToday ? ' today' : ''}`}
                      >
                        <div className="adm-bday-av">{initials(b.name)}</div>
                        <div className="adm-bday-info">
                          <div className="adm-bday-name">{b.name}</div>
                          <div className="adm-bday-meta">{b.grade}</div>
                        </div>
                        {isToday ? (
                          <span className="adm-pill-green">Today! 🎂</span>
                        ) : isTomorrow ? (
                          <span className="adm-pill-amber">Tomorrow</span>
                        ) : (
                          <span className="adm-pill-blue">{b.date}</span>
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
                  {teacherBdays.map(b => {
                    const isToday = b.dob === TODAY_DAY;
                    const isTomorrow = b.dob === TODAY_DAY + 1;
                    return (
                      <div
                        key={b.name}
                        className={`adm-bday-card${isToday ? ' today' : ''}`}
                      >
                        <div className="adm-bday-av adm-bday-av--purple">{initials(b.name)}</div>
                        <div className="adm-bday-info">
                          <div className="adm-bday-name">{b.name}</div>
                          <div className="adm-bday-meta">{b.role}</div>
                        </div>
                        {isToday ? (
                          <span className="adm-pill-green">Today! 🎂</span>
                        ) : isTomorrow ? (
                          <span className="adm-pill-amber">Tomorrow</span>
                        ) : (
                          <span className="adm-pill-blue">{b.date}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        )
      )}

      <div className="adm-divider" />

      {/* ═════════ 8. UPCOMING ACTIVITIES ═════════ */}
      {!canSeeCard('activities') ? (
        <LockedCard title="Upcoming Activities" icon="fa-calendar-day" />
      ) : (
      <div className="dash-sec adm-sec">
        <div className="dash-sec-h">
          <div className="dash-sec-title">
            <span className="adm-h-ic adm-h-ic--star"><i className="fa-solid fa-calendar-day" aria-hidden="true"></i></span>
            Upcoming Activities
          </div>
          <span className="adm-h-meta">May 2026</span>
        </div>
        <div className="adm-info-banner">
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>School events, exams, and important dates for this month.</span>
        </div>

        <div className="adm-act-grid">
          {ACTIVITIES.map(a => {
            const c = TYPE_COLOR[a.type] || TYPE_COLOR.event;
            const daysLabel = a.daysAway === 1 ? 'Tomorrow' : `In ${a.daysAway} days`;
            const daysTone = a.daysAway === 1 ? 'amber' : (a.daysAway <= 7 ? 'brand' : 'muted');
            /* Every card now lands on Academics → Scheme of Studies →
               Calendar → Activity Calendar via the openActivityCalendar
               callback hoisted from App.js. */
            const goActivityCalendar = () => {
              openActivityCalendar();
              toast('Opening Activity Calendar…', 'info');
            };
            return (
              <Tooltip key={a.id} text="Open Academics → Activity Calendar">
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
                      {a.date}
                    </span>
                    <span className={`adm-act-days adm-act-days--${daysTone}`}>{daysLabel}</span>
                  </div>
                  <div className="adm-act-title">{a.title}</div>
                  <div className="adm-act-desc">{a.desc}</div>
                  <div className="adm-act-foot">
                    <span className="adm-act-cat" style={{ background: c.bg, color: c.fg }}>{a.category}</span>
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
      </div>
      )}
    </>
  );
}


/* ─── Today's Attendance section (Student + Staff cards) ───────
   Renders the 2-card row with the same `.fee-card` chrome used by
   the Fee Analytics section. Field names match the Attendance
   module schema (present / absent / leave / total / percentage). */
function AttendanceSection({ openModule }) {
  /* Period filter — same three modes as Financial Overview / OneLink
     Payments below (Day / Month / Custom Range). The underlying present /
     absent / leave figures are a single daily snapshot (mock/attendance.js
     has no per-day history — the Attendance module itself synthesizes its
     own Monthly/Range reports from this same snapshot), so switching
     periods here changes the label the same way choosing a different Day
     already did; it does not fabricate different numbers per period. */
  const [attSeg, setAttSeg]     = useState('day'); // 'day' | 'month' | 'range'
  const [attDate, setAttDate]   = useState(() => new Date().toISOString().slice(0, 10));
  const [attMonth, setAttMonth] = useState('2026-05');
  const [attFrom, setAttFrom]   = useState('2026-05-01');
  const [attTo, setAttTo]       = useState('2026-05-31');

  const attDateLabel = new Date(`${attDate}T00:00:00`).toLocaleDateString('en-PK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const [attMonthYY, attMonthMM] = attMonth.split('-');
  const attPeriodLabel = attSeg === 'day' ? attDateLabel
    : attSeg === 'month' ? `${FIN_MONTH_NAMES[Number(attMonthMM) - 1]} ${attMonthYY}`
    : `${attFrom} to ${attTo}`;

  /* Status colour ladder per spec: >=90 green · >=75 amber · else red */
  const pctColor = (p) => (p >= 90 ? '#16A34A' : p >= 75 ? '#D97706' : '#DC2626');
  const pctTone  = (p) => (p >= 90 ? 'green'   : p >= 75 ? 'amber'   : 'red');

  return (
    <div className="dash-sec adm-sec">
      <div className="dash-sec-h">
        <div className="dash-sec-title">
          <span className="adm-h-ic"><i className="fa-solid fa-clipboard-check" aria-hidden="true"></i></span>
          Attendance
        </div>
        <div className="adm-h-right">
          <button type="button" className="dash-sec-link" onClick={() => openModule('att')}>
            View Full Report <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div className="ol-controls" style={{ marginBottom: 14 }}>
        <div className="adm-seg" role="tablist" aria-label="Attendance period filter">
          <button type="button" className={`adm-seg-btn${attSeg === 'day' ? ' on' : ''}`} role="tab" aria-selected={attSeg === 'day'} onClick={() => setAttSeg('day')}>Day</button>
          <button type="button" className={`adm-seg-btn${attSeg === 'month' ? ' on' : ''}`} role="tab" aria-selected={attSeg === 'month'} onClick={() => setAttSeg('month')}>Month</button>
          <button type="button" className={`adm-seg-btn${attSeg === 'range' ? ' on' : ''}`} role="tab" aria-selected={attSeg === 'range'} onClick={() => setAttSeg('range')}>Custom Range</button>
        </div>

        {attSeg === 'day' && (
          <label className="dash-day-pick">
            <span className="dash-day-pick-lbl">Day</span>
            <input
              type="date"
              className="dash-day-pick-input"
              value={attDate}
              onChange={(e) => setAttDate(e.target.value)}
              aria-label="Select day for attendance"
            />
          </label>
        )}
        {attSeg === 'month' && (
          <label className="fin-summary-month">
            <span className="fin-summary-month-lbl">Month</span>
            <input type="month" className="fin-summary-month-input" value={attMonth} min="2026-01" max="2026-05" onChange={(e) => setAttMonth(e.target.value)} aria-label="Select month for attendance" />
          </label>
        )}
        {attSeg === 'range' && (
          <>
            <label className="fin-summary-month">
              <span className="fin-summary-month-lbl">From</span>
              <input type="date" className="fin-summary-month-input" value={attFrom} onChange={(e) => setAttFrom(e.target.value)} aria-label="From date for attendance" />
            </label>
            <label className="fin-summary-month">
              <span className="fin-summary-month-lbl">To</span>
              <input type="date" className="fin-summary-month-input" value={attTo} onChange={(e) => setAttTo(e.target.value)} aria-label="To date for attendance" />
            </label>
          </>
        )}
        <span className="adm-h-meta">{attPeriodLabel}</span>
      </div>

      <div className="att-grid">
        {/* Student card */}
        <AttendanceCard
          icon="fa-user-graduate"
          tone="brand"
          title={`Student Attendance — ${attSeg === 'day' ? 'Today' : attSeg === 'month' ? 'This Month' : 'This Period'}`}
          data={STUDENT_ATTENDANCE_TODAY}
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
          title={`Staff Attendance — ${attSeg === 'day' ? 'Today' : attSeg === 'month' ? 'This Month' : 'This Period'}`}
          data={STAFF_ATTENDANCE_TODAY}
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
  const barReplay = useScrollReplay();
  return (
    <div className={`stat-card fee-card att-card att-card--${tone}`} ref={barReplay.ref}>
      <div className="fc-header">
        <div className="fc-icon-chip">
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        </div>
        <div className="fc-title">{title}</div>
      </div>

      {/* Hero percentage in the status colour */}
      <div className="att-pct" style={{ color }}>
        <AnimatedNumber key={barReplay.replayKey} value={pct} duration={CHART_ANIM_MS} /><span className="att-pct-sym">%</span>
        <span className={`att-pct-tag att-pct-tag--${pctTone(pct)}`}>
          {pct >= 90 ? 'Excellent' : pct >= 75 ? 'Watch' : 'Critical'}
        </span>
      </div>

      {/* Pills row — Present · Absent · Leave (leave only if > 0) */}
      <div className="att-pills">
        <span className="att-pill att-pill--green">
          <span className="att-pill-dot" /> <AnimatedNumber key={barReplay.replayKey} value={data.present} duration={CHART_ANIM_MS} /> Present
        </span>
        <span className="att-pill att-pill--red">
          <span className="att-pill-dot" /> <AnimatedNumber key={barReplay.replayKey} value={data.absent} duration={CHART_ANIM_MS} /> Absent
        </span>
        {typeof data.leave === 'number' && data.leave > 0 && (
          <span className="att-pill att-pill--amber">
            <span className="att-pill-dot" /> <AnimatedNumber key={barReplay.replayKey} value={data.leave} duration={CHART_ANIM_MS} /> Leave
          </span>
        )}
      </div>

      {/* Progress bar — width = attendance percentage, animated in/reset
          every time this card scrolls into/out of view */}
      <div className="att-bar-track">
        <div
          className="att-bar-fill"
          style={{
            width: `${barReplay.inView ? pct : 0}%`,
            transitionDuration: `${CHART_ANIM_MS}ms`,
            transitionTimingFunction: 'ease-out',
          }}
        />
      </div>

      <div className="fc-support att-support">
        <i className="fa-solid fa-users" aria-hidden="true"></i>
        <span>
          of <span className="fc-highlight"><AnimatedNumber key={barReplay.replayKey} value={data.total} duration={CHART_ANIM_MS} /></span>
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

/* "Payment Collection Summary" tile — display-only labels for the
   payment method breakdown, shown here as the school's own preferred
   channel names instead of the raw payment `method` value (kept as-is
   everywhere else this same data is used). */
const OL_MODE_DISPLAY_NAMES = {
  'Bank Transfer': '1-Link',
  'Online / App': 'Visa / Master Cards',
};

function OneLinkPaymentSection({ openModule, toast }) {
  const { data: classes = [] }     = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} } = useAsync(feeService.getTransportFee, []);
  const { data: receipts = [] }    = useAsync(feeService.getReceipts, []);
  const kpiReplay = useScrollReplay();

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
  /* Display-only relabelling for the "Payment Collection Summary" tile
     (and its matching print report) — the underlying payment `method`
     values ('Bank Transfer' / 'Online / App') are left untouched so
     grouping above and every other screen that shows a payment's
     method still reads the real value. */
  const olModeDisplayName = (name) => OL_MODE_DISPLAY_NAMES[name] || name;

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

        <div className="fin-summary-grid ol-grid" ref={kpiReplay.ref}>
          <div className="fee-card fa-card fc-tone--purple fc-bordered fin-summary-sub">
            <div className="fc-header">
              <div className="fc-icon-chip"><i className="fa-solid fa-receipt" aria-hidden="true"></i></div>
              <div className="fc-title">OneLink Transactions</div>
            </div>
            <div className="fc-amount fa-amount--lg"><AnimatedNumber key={kpiReplay.replayKey} value={totalTxns} duration={CHART_ANIM_MS} /></div>
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
            <div className="fc-amount fc-amount--green fa-amount--lg"><AnimatedNumber key={kpiReplay.replayKey} prefix="PKR " value={totalAmt} duration={CHART_ANIM_MS} /></div>
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
                    <span className="fa-meta-lbl"><i className="fa-solid fa-building-columns" aria-hidden="true"></i> {olModeDisplayName(m.name)}</span>
                    <span className="fa-meta-val"><AnimatedNumber key={`${m.name}-${kpiReplay.replayKey}`} prefix="PKR " value={m.amt} duration={CHART_ANIM_MS} /></span>
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
  const accent = '#7C3AED';
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
  const modeKpis = modeBreak.map(m => `<div class="kpi"><div class="l">${esc(OL_MODE_DISPLAY_NAMES[m.name] || m.name)}</div><div class="v">Rs. ${m.amt.toLocaleString('en-PK')}</div></div>`).join('');
  const today = new Date().toLocaleDateString('en-GB');
  const inner = `
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
    </table>`;
  return feeDashReportHTML({ accent, title: 'OneLink Payment Report', innerHtml: inner });
}

/* ─── Fee Analytics Cards 5, 6 & 7 — Download Report builders ───
   All funnel through feeDashReportHTML below, which delegates its
   header/logo/footer chrome to the shared src/reports/reportKit.js —
   the same ERP-wide standard Academics, Examination, Attendance and
   HR now use — while keeping .rep-tbl/.kpi/.rep-secttl as report BODY
   styling (report-specific `accent` still colors table headers, KPI
   highlights and footer totals, same as before). */
function feeDashBodyCSS(accent) {
  return `
    .rep-filters{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:10.5px;color:#333;margin-bottom:12px;background:#F8FAFF;padding:9px 13px;border-radius:6px}
    .rep-secttl{font-size:12px;font-weight:800;color:${accent};margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #E5E7EB}
    .rep-tbl{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:4px}
    .rep-tbl th{background:${accent};color:#fff;padding:6px 6px;text-align:left;font-size:9.5px;font-weight:700}
    .rep-tbl td{padding:5px 6px;border-bottom:1px solid #e5e9f2;vertical-align:top}
    .rep-tbl tfoot td{font-weight:800;background:#F8FAFF;border-top:2px solid ${accent}}
    .kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
    .kpi{border:1px solid #E5E7EB;border-radius:6px;padding:9px 11px;background:#F8FAFF}
    .kpi .l{font-size:9.5px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px}
    .kpi .v{font-size:14px;font-weight:800;color:#0F172A;margin-top:2px}
  `;
}
export function feeDashReportHTML({ accent, title, innerHtml }) {
  const bodyHtml = `<style>${feeDashBodyCSS(accent)}</style>${innerHtml}`;
  return buildStandardReportHtml({ title, format: 'pdf', isColor: true, bodyHtml });
}

function buildDiscountGivenDashboardReportHTML({ discountRows, discountTotal, discountStudentCount }, monthLabel) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const accent = '#D97706';
  const today = new Date().toLocaleDateString('en-GB');
  const rows = discountRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(r.studentName)}</b></td>
      <td>${esc(r.reg)}</td>
      <td>${esc(r.cls)}</td>
      <td>${esc(r.sec)}</td>
      <td>${esc(r.head)}</td>
      <td style="text-align:right">${r.original.toLocaleString('en-PK')}</td>
      <td style="text-align:right;font-weight:700;color:${accent}">${r.discountGiven.toLocaleString('en-PK')}</td>
      <td style="text-align:right">${r.finalPayable.toLocaleString('en-PK')}</td>
      <td>${esc(r.givenBy)}</td>
      <td>${esc(r.date)}</td>
      <td>${esc(r.time)}</td>
    </tr>`).join('');
  const inner = `
    <div class="rep-filters"><span><b>Month:</b> ${esc(monthLabel)}</span><span><b>Students:</b> ${discountStudentCount}</span><span><b>Rows:</b> ${discountRows.length}</span><span><b>Grand Total Discount:</b> Rs. ${discountTotal.toLocaleString('en-PK')}</span></div>
    <div class="kpi-row">
      <div class="kpi"><div class="l">Students Given Discount</div><div class="v">${discountStudentCount}</div></div>
      <div class="kpi"><div class="l">Grand Total Discount Given</div><div class="v">Rs. ${discountTotal.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Generated</div><div class="v">${esc(today)}</div></div>
    </div>
    <div class="rep-secttl">Discount Given During Receiving: Student-wise, Fee-head-wise</div>
    <table class="rep-tbl">
      <thead><tr><th>Sn.</th><th>Student Name</th><th>Reg No</th><th>Class</th><th>Section</th><th>Fee Head</th><th style="text-align:right">Original Amount</th><th style="text-align:right">Discount Given</th><th style="text-align:right">Final Payable</th><th>Discount Given By</th><th>Date</th><th>Time</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="12" style="text-align:center;color:#94A3B8;padding:20px">No receiving-time discount given yet.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="7" style="text-align:right">Grand Total Discount Given</td><td style="text-align:right;color:${accent}">Rs. ${discountTotal.toLocaleString('en-PK')}</td><td colspan="4"></td></tr></tfoot>
    </table>`;
  return feeDashReportHTML({ accent, title: 'Discount Given During Receiving Report', innerHtml: inner });
}

function buildAdvanceDashboardReportHTML({ advanceRows, advanceTotal, advanceStudentCount }, monthLabel) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const accent = '#7C3AED';
  const today = new Date().toLocaleDateString('en-GB');
  const rows = advanceRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(r.studentName)}</b></td>
      <td>${esc(r.reg)}</td>
      <td>${esc(r.cls)}</td>
      <td>${esc(r.sec)}</td>
      <td style="text-align:right">${r.currentChallanAmount.toLocaleString('en-PK')}</td>
      <td style="text-align:right">${r.amountReceived.toLocaleString('en-PK')}</td>
      <td style="text-align:right;font-weight:700;color:${accent}">${r.advanceAmount.toLocaleString('en-PK')}</td>
      <td>${esc(r.method)}</td>
      <td>${esc(r.receivedBy)}</td>
      <td>${esc(r.date)}</td>
      <td>${esc(r.time)}</td>
    </tr>`).join('');
  const inner = `
    <div class="rep-filters"><span><b>Month:</b> ${esc(monthLabel)}</span><span><b>Students:</b> ${advanceStudentCount}</span><span><b>Grand Total Advance:</b> Rs. ${advanceTotal.toLocaleString('en-PK')}</span></div>
    <div class="kpi-row">
      <div class="kpi"><div class="l">Students Paid in Advance</div><div class="v">${advanceStudentCount}</div></div>
      <div class="kpi"><div class="l">Grand Total Advance Amount</div><div class="v">Rs. ${advanceTotal.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Generated</div><div class="v">${esc(today)}</div></div>
    </div>
    <div class="rep-secttl">Advance Payments Received: Student-wise</div>
    <table class="rep-tbl">
      <thead><tr><th>Sn.</th><th>Student Name</th><th>Reg No</th><th>Class</th><th>Section</th><th style="text-align:right">Current Challan Amount</th><th style="text-align:right">Amount Received</th><th style="text-align:right">Advance Amount</th><th>Payment Method</th><th>Received By</th><th>Date</th><th>Time</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="12" style="text-align:center;color:#94A3B8;padding:20px">No advance payments received this month.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="7" style="text-align:right">Grand Total Advance Amount</td><td style="text-align:right;color:${accent}">Rs. ${advanceTotal.toLocaleString('en-PK')}</td><td colspan="4"></td></tr></tfoot>
    </table>`;
  return feeDashReportHTML({ accent, title: 'Advance Payments Received Report', innerHtml: inner });
}

function buildAdvanceAdjustmentDashboardReportHTML({ advanceAdjustmentRows, advanceAdjustmentTotal, advanceAdjustmentStudentCount }, monthLabel) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const accent = '#7C3AED';
  const today = new Date().toLocaleDateString('en-GB');
  const rows = advanceAdjustmentRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(r.studentName)}</b></td>
      <td>${esc(r.cls)}</td>
      <td>${esc(r.sec)}</td>
      <td style="text-align:right">${r.previousAdvanceBalance.toLocaleString('en-PK')}</td>
      <td style="text-align:right;font-weight:700;color:${accent}">${r.adjustedAmount.toLocaleString('en-PK')}</td>
      <td style="text-align:right">${r.remainingAdvanceBalance.toLocaleString('en-PK')}</td>
      <td>${esc(r.adjustmentDate)}</td>
    </tr>`).join('');
  const inner = `
    <div class="rep-filters"><span><b>Month:</b> ${esc(monthLabel)}</span><span><b>Students Adjusted:</b> ${advanceAdjustmentStudentCount}</span><span><b>Grand Total Adjusted:</b> Rs. ${advanceAdjustmentTotal.toLocaleString('en-PK')}</span></div>
    <div class="kpi-row">
      <div class="kpi"><div class="l">Students Adjusted</div><div class="v">${advanceAdjustmentStudentCount}</div></div>
      <div class="kpi"><div class="l">Grand Total Adjusted</div><div class="v">Rs. ${advanceAdjustmentTotal.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Generated</div><div class="v">${esc(today)}</div></div>
    </div>
    <div class="rep-secttl">Advance Adjustments: Previous Advance Balance Applied Against This Month's Fee</div>
    <table class="rep-tbl">
      <thead><tr><th>Sn.</th><th>Student Name</th><th>Class</th><th>Section</th><th style="text-align:right">Previous Advance Balance</th><th style="text-align:right">Adjusted Amount</th><th style="text-align:right">Remaining Advance Balance</th><th>Adjustment Date</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#94A3B8;padding:20px">No advance adjustments this month.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right">Grand Total Adjusted</td><td style="text-align:right;color:${accent}">Rs. ${advanceAdjustmentTotal.toLocaleString('en-PK')}</td><td colspan="2"></td></tr></tfoot>
    </table>`;
  return feeDashReportHTML({ accent, title: 'Advance Adjustments Report', innerHtml: inner });
}

function buildFeeReceivedDashboardReportHTML({ receivedRows, receivedTotal, receivedStudentCount }, monthLabel) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const accent = '#16A34A';
  const today = new Date().toLocaleDateString('en-GB');
  const rows = receivedRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(r.studentName)}</b></td>
      <td>${esc(r.reg)}</td>
      <td>${esc(r.cls)}</td>
      <td>${esc(r.sec)}</td>
      <td style="text-align:right;font-weight:700;color:${accent}">${r.amount.toLocaleString('en-PK')}</td>
      <td>${esc(r.method)}</td>
      <td>${esc(r.receivedBy)}</td>
      <td>${esc(r.date)}</td>
      <td>${esc(r.time)}</td>
    </tr>`).join('');
  const inner = `
    <div class="rep-filters"><span><b>Month:</b> ${esc(monthLabel)}</span><span><b>Students Paid:</b> ${receivedStudentCount}</span><span><b>Grand Total Received:</b> Rs. ${receivedTotal.toLocaleString('en-PK')}</span></div>
    <div class="kpi-row">
      <div class="kpi"><div class="l">Students Paid</div><div class="v">${receivedStudentCount}</div></div>
      <div class="kpi"><div class="l">Grand Total Received</div><div class="v">Rs. ${receivedTotal.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Generated</div><div class="v">${esc(today)}</div></div>
    </div>
    <div class="rep-secttl">Fee Received: Student-wise, All Payment Sources</div>
    <table class="rep-tbl">
      <thead><tr><th>Sn.</th><th>Student Name</th><th>Reg No</th><th>Class</th><th>Section</th><th style="text-align:right">Amount Received</th><th>Payment Method</th><th>Received By</th><th>Date</th><th>Time</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="10" style="text-align:center;color:#94A3B8;padding:20px">No fee received in this month.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right">Grand Total Received</td><td style="text-align:right;color:${accent}">Rs. ${receivedTotal.toLocaleString('en-PK')}</td><td colspan="4"></td></tr></tfoot>
    </table>`;
  return feeDashReportHTML({ accent, title: 'Fee Received Report', innerHtml: inner });
}

/* ─── Reusable App-status card (Teachers / Parents variants) ─── */
function AppStatusCard({ tone, title, subtitle, icon, data, ctaLabel, ctaIcon = 'fa-arrow-right', onCta }) {
  const replay = useScrollReplay();
  return (
    <div className={`adm-tc adm-tc--app adm-tc--${tone}`} ref={replay.ref}>
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
        <span className={`adm-tc-pill adm-tc-pill--${tone}`}><AnimatedNumber key={replay.replayKey} value={data.pct} suffix="%" duration={CHART_ANIM_MS} /></span>
      </div>

      <div className="adm-tc-body">
        <div className="adm-tc-stats">
          <div className="adm-tc-stat">
            <div className="adm-tc-stat-lbl">Total</div>
            <div className="adm-tc-stat-val"><AnimatedNumber key={replay.replayKey} value={data.total} duration={CHART_ANIM_MS} /></div>
          </div>
          <div className="adm-tc-stat">
            <div className="adm-tc-stat-lbl">Downloaded</div>
            <div className="adm-tc-stat-val adm-tc-stat-val--green"><AnimatedNumber key={replay.replayKey} value={data.downloaded} duration={CHART_ANIM_MS} /></div>
          </div>
          <div className="adm-tc-stat">
            <div className="adm-tc-stat-lbl">Pending</div>
            <div className="adm-tc-stat-val adm-tc-stat-val--amber"><AnimatedNumber key={replay.replayKey} value={data.pending} duration={CHART_ANIM_MS} /></div>
          </div>
        </div>

        <div className="adm-tc-bar">
          <div className="adm-tc-bar-track">
            <div
              className={`adm-tc-bar-fill adm-tc-bar-fill--${tone}`}
              style={{
                width: `${replay.inView ? data.pct : 0}%`,
                transitionDuration: `${CHART_ANIM_MS}ms`,
                transitionTimingFunction: 'ease-out',
              }}
            />
          </div>
          <div className="adm-tc-bar-meta">
            <span><i className="fa-solid fa-arrow-trend-up" aria-hidden="true"></i> +<AnimatedNumber key={replay.replayKey} value={data.newThisMonth} duration={CHART_ANIM_MS} /> this month</span>
            <span className="adm-tc-bar-pct"><AnimatedNumber key={replay.replayKey} value={data.pct} suffix="% adopted" duration={CHART_ANIM_MS} /></span>
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

/* ── Announcement card — deliberately more eye-catching than its
   siblings so a new school-wide announcement doesn't go unnoticed on
   the dashboard: a slow breathing glow on the card, a shimmering
   sweep on its top accent bar, and a periodic "ring" on the bullhorn
   icon. All three loop continuously but stay subtle enough not to be
   annoying at a glance. Disabled for users who've asked the OS for
   reduced motion. ── */
@media (prefers-reduced-motion: no-preference) {
  .adm-tc--announce {
    animation: dashRise .35s ease, annGlow 2.6s ease-in-out infinite;
  }
  .adm-tc--announce::before {
    background-size: 200% 100%;
    animation: annShimmer 2.8s linear infinite;
  }
  .adm-tc--announce .adm-tc-ic--brand {
    animation: annRing 3.2s ease-in-out infinite, annIconGlow 2.6s ease-in-out infinite;
    transform-origin: 50% 20%;
  }
}
@keyframes annGlow {
  0%, 100% {
    border-color: var(--border-light, #E2E8F0);
    box-shadow: 0 0 0 0 rgba(37,99,235,0), 0 0 0 0 rgba(37,99,235,0), 0 1px 2px rgba(15,23,42,.04);
  }
  50% {
    border-color: rgba(37,99,235,.55);
    box-shadow: 0 0 14px 3px rgba(37,99,235,.35), 0 0 34px 10px rgba(37,99,235,.18), 0 10px 26px rgba(30,64,175,.16);
  }
}
@keyframes annIconGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
  50%      { box-shadow: 0 0 12px 4px rgba(37,99,235,.45); }
}
@keyframes annShimmer {
  0%   { background-position: 0% 0; }
  100% { background-position: -200% 0; }
}
@keyframes annRing {
  0%, 78%, 100% { transform: rotate(0deg) scale(1); }
  80%  { transform: rotate(-14deg) scale(1.08); }
  84%  { transform: rotate(11deg) scale(1.08); }
  88%  { transform: rotate(-8deg) scale(1.05); }
  92%  { transform: rotate(5deg) scale(1.02); }
  96%  { transform: rotate(0deg) scale(1); }
}

/* Header row */
.adm-tc-h {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px 10px; margin-bottom: 12px;
  flex-wrap: wrap;
}
/* The unread pill can be wider than the title/sender block on a
   narrow 3-up card — wrap it onto its own row instead of letting the
   two nowrap blocks fight for space and visually collide. */
.adm-tc-h-l { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 auto; }
.adm-tc--announce .adm-tc-h > .adm-tc-pill--new { margin-left: auto; }
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
.adm-tc-pill--green { background: rgba(21, 128, 61, .14); color: #15803D; }
.adm-tc-pill--amber { background: rgba(217, 119, 6, .14); color: #92400E; }
[data-theme="dark"] .adm-tc-pill--green { background: rgba(74, 222, 128, .18); color: #BBF7D0; }
[data-theme="dark"] .adm-tc-pill--amber { background: rgba(245, 158, 11, .18); color: #FCD34D; }

/* Unread-announcements pill — the one real, clickable button on this
   card besides "View Details" (same destination), so it's styled as a
   loud solid CTA rather than a quiet status tint like the pills above. */
.adm-tc-pill--new {
  gap: 5px;
  padding: 5px 11px;
  font-size: 11.5px;
  max-width: 100%;
  background: linear-gradient(135deg, #EF4444, #DC2626);
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(220, 38, 38, .38);
  transition: transform .18s, box-shadow .18s;
}
.adm-tc-pill--new:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(220, 38, 38, .48); }
.adm-tc-pill--new:active { transform: translateY(0); }
.adm-tc-pill--new:focus-visible { outline: 2px solid #FCA5A5; outline-offset: 2px; }
[data-theme="dark"] .adm-tc-pill--new { background: linear-gradient(135deg, #F87171, #DC2626); box-shadow: 0 3px 10px rgba(248, 113, 113, .3); }
[data-theme="dark"] .adm-tc-pill--new:hover { box-shadow: 0 6px 16px rgba(248, 113, 113, .4); }
.adm-tc-pill--new .adm-tc-pill-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #fff;
  animation: dashPulse 1.4s ease-in-out infinite;
}
@keyframes dashPulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
@media (prefers-reduced-motion: no-preference) {
  .adm-tc--announce .adm-tc-pill--new { animation: annPillPulse 1.6s ease-in-out infinite; }
}
@keyframes annPillPulse {
  0%, 100% { box-shadow: 0 3px 10px rgba(220,38,38,.38), 0 0 0 0 rgba(220,38,38,.35); }
  50%      { box-shadow: 0 3px 10px rgba(220,38,38,.38), 0 0 0 6px rgba(220,38,38,0); }
}

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
/* Two equal-width buttons sharing one row in a card footer (e.g. Fee
   Received's "Daily Receiving Report" + "Download Report") instead of
   the usual single full-width button, or single button + meta text. */
.adm-tc-btn--half { flex: 1; justify-content: center; min-width: 0; }
@media (max-width: 420px) {
  .adm-tc-foot--row2 { flex-wrap: wrap; }
  .adm-tc-foot--row2 .adm-tc-btn--half { flex-basis: 100%; }
}
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

/* ─── Generic day picker pill — Fee Received card, Today's Attendance ─── */
.dash-day-pick {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 6px 4px 12px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 999px;
  transition: all .15s;
}
.dash-day-pick:hover { border-color: #93C5FD; }
.dash-day-pick:focus-within { border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(30, 64, 175, .16); }
.dash-day-pick-lbl {
  font: 800 10.5px/1 var(--dash-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px; white-space: nowrap;
}
.dash-day-pick-input {
  border: none; outline: none; background: transparent;
  font: 700 12.5px/1 var(--dash-font); color: var(--text-primary);
  padding: 7px 4px; cursor: pointer;
}
[data-theme="dark"] .dash-day-pick { background: var(--bg-card, #0E1628); border-color: var(--border-light, #1C2E50); }
[data-theme="dark"] .dash-day-pick-input { color-scheme: dark; }
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

/* ═══ Fee Analytics — 3 + 3 + 1 + 1 layout ═══
   Row 1: Current Month / Previous Dues / Net Receivable (inputs)
   Row 2: Received / Discount Given / Advance Adjustments — everything
          that genuinely reduces Pending Fee, in the main calc flow
   Row 3: Pending Fee — single full-width "final outcome" card
   Row 4: Advance Payments Received — single full-width, purely
          informational card AFTER Pending Fee; it's a future balance
          that does NOT reduce Pending Fee (that only happens once it
          becomes an Advance Adjustment in Row 2, a later month) */
.fa-top-grid,
.fa-second-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
@media (max-width: 1024px) {
  .fa-top-grid, .fa-second-grid { grid-template-columns: repeat(2, 1fr); }
  .fa-top-grid > :last-child, .fa-second-grid > :last-child { grid-column: span 2; }
}
@media (max-width: 640px) {
  .fa-top-grid, .fa-second-grid { grid-template-columns: 1fr; }
  .fa-top-grid > :last-child, .fa-second-grid > :last-child { grid-column: auto; }
}

/* Row 3 — Pending Fee "final outcome" card gets extra breathing room
   and a slightly stronger border so it visually reads as the summary. */
.fa-final { margin-bottom: 14px; border-width: 1.5px; }
.fa-final-tag {
  font: 800 9.5px/1 var(--dash-font);
  text-transform: uppercase; letter-spacing: .4px;
  color: #DC2626; background: rgba(220, 38, 38, .1);
  padding: 3px 8px; border-radius: 20px;
  margin-left: 8px;
}
[data-theme="dark"] .fa-final-tag { background: rgba(248, 113, 113, .16); color: #FCA5A5; }

/* Small pill under an amount — used by the Advance card to make the
   "this is not money you can spend against pending" distinction loud. */
.fa-badge {
  display: inline-flex; align-items: center;
  font: 800 10px/1 var(--dash-font);
  text-transform: uppercase; letter-spacing: .3px;
  padding: 4px 10px; border-radius: 20px;
  margin: 6px 0 2px;
}
.fa-badge--purple { background: rgba(124, 58, 237, .12); color: #7C3AED; }
[data-theme="dark"] .fa-badge--purple { background: rgba(167, 139, 250, .18); color: #C4B5FD; }

/* "Advance Available" callout inside the Pending Fee card — purposely
   tinted purple (not red) so it reads as a separate, unrelated figure. */
.fa-advance-note {
  margin-top: 12px; padding: 10px 12px;
  border-radius: 10px;
  background: rgba(124, 58, 237, .06);
  border: 1px solid rgba(124, 58, 237, .18);
}
.fa-advance-note-top {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
.fa-advance-note-lbl {
  font: 700 12px/1.3 var(--dash-font); color: #7C3AED;
  display: inline-flex; align-items: center; gap: 6px;
}
.fa-advance-note-lbl i { font-size: 11px; }
.fa-advance-note-val { font: 800 15px/1.2 var(--dash-font); color: #7C3AED; }
.fa-advance-note-cap {
  margin-top: 4px;
  font: 500 10.5px/1.4 var(--dash-font);
  color: var(--text-muted, #64748B);
}
[data-theme="dark"] .fa-advance-note { background: rgba(167, 139, 250, .08); border-color: rgba(167, 139, 250, .28); }
[data-theme="dark"] .fa-advance-note-lbl,
[data-theme="dark"] .fa-advance-note-val { color: #C4B5FD; }
@media (max-width: 640px) {
  .fa-advance-note-top { flex-direction: column; align-items: flex-start; gap: 2px; }
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
.fc-header { display: flex; align-items: center; flex-wrap: wrap; row-gap: 4px; gap: 8px; margin-bottom: 10px; }
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
.fc-amount--amber  { color: #D97706; }
.fc-amount--purple { color: #7C3AED; }

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
  display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between;
  gap: 6px 10px;
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
.fa-meta-val--purple { color: #7C3AED; }
.fa-meta-val--red   { color: #DC2626; }
.fa-meta-val--green { color: #16A34A; }
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
/* Pending Fee's 4-term formula (Net Receivable − Received − Discount −
   Advance) needs to wrap on narrower cards; the original 2-term
   breakdown (Total Net Receivable) stays single-line as before. */
.fa-formula-breakdown--wrap { flex-wrap: wrap; justify-content: flex-start; }
.fa-formula-breakdown--wrap > div { flex: 1 1 84px; }
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
.fa-bd-op--eq { color: #DC2626; }
[data-theme="dark"] .fa-bd-op--eq { color: #F87171; }

/* ═══ Bottom-row LARGE cards ═══ */
.fa-large { min-height: 230px; padding: 22px 24px; }
.fa-large-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}
.fa-large-l { flex: 1; min-width: 0; }
.fa-large-r { flex-shrink: 0; }

/* Inline status meta line ("Challans Paid: 425/612") */
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

/* ─── Vertical progress bar (right side of large cards) ───
   Replaces the old donut ring, which rendered clipped/half-hidden in
   the constrained right column at some widths. */
.fa-vbar {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; width: 72px; flex-shrink: 0;
}
.fa-vbar-pct {
  font: 800 16px/1 var(--dash-font);
  color: var(--text-primary);
  letter-spacing: -.02em;
}
.fa-vbar-track {
  width: 24px; height: 76px; border-radius: 12px;
  background: var(--bg-muted, #F1F5F9);
  overflow: hidden;
  display: flex; flex-direction: column; justify-content: flex-end;
}
[data-theme="dark"] .fa-vbar-track { background: rgba(255, 255, 255, .06); }
.fa-vbar-fill {
  width: 100%; border-radius: 12px;
  transition: height .5s cubic-bezier(.2, .8, .2, 1);
}
.fa-vbar-fill--green { background: linear-gradient(180deg, #22C55E, #16A34A); }
.fa-vbar-fill--red   { background: linear-gradient(180deg, #F87171, #DC2626); }
.fa-vbar-lbl {
  font: 700 9.5px/1 var(--dash-font);
  color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px;
}

/* ─── Progress bar at bottom of large card ─── */
.fa-progress { display: flex; flex-direction: column; gap: 6px; }
/* Fee Received stacks a meta row right under its progress bar — give
   it breathing room instead of the bar's track touching the row. */
.fa-progress + .fa-meta-rows { margin-top: 12px; }
.fa-progress-h {
  display: flex; align-items: center; flex-wrap: wrap;
  justify-content: space-between; gap: 4px;
  font: 700 11px/1.3 var(--dash-font);
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

/* ─── Locked dashboard card (permission-gated) ─── */
.dash-locked-card {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  min-height: 64px;
  padding: 16px 18px;
  background: var(--bg-muted, #F8FAFF);
  border: 1px dashed var(--border-light, #E2E8F0);
  border-radius: 14px;
  animation: dashRise .35s ease;
}
[data-theme="dark"] .dash-locked-card { background: rgba(255, 255, 255, .03); }
.dash-locked-card-h { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dash-locked-card-ic {
  width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px;
  background: rgba(100, 116, 139, .14); color: #64748B;
}
.dash-locked-card-t {
  font: 700 13px/1.3 var(--dash-font);
  color: var(--text-muted, #64748B);
  letter-spacing: -0.1px;
}
.dash-locked-card-i {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; cursor: help;
  background: rgba(100, 116, 139, .14); color: #64748B;
}
[data-theme="dark"] .dash-locked-card-ic,
[data-theme="dark"] .dash-locked-card-i { background: rgba(148, 163, 184, .16); color: #94A3B8; }

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

/* ─── Profit/Loss Overview — full-width redesign ───
   Now spans the whole content width instead of sharing a 2-col grid
   with the old revenue chart, with a taller chart and a richer
   tooltip/legend. */
.pl-overview {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  padding: 20px 24px 18px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  animation: dashRise .35s ease;
}
[data-theme="dark"] .pl-overview { background: var(--bg-card); border-color: var(--border-light); }
.pl-head-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pl-year-select { height: 30px; min-width: 84px; }
.pl-chart-scroll { overflow-x: auto; margin: 6px 0 2px; }
.pl-legend {
  justify-content: center;
  gap: 26px;
  margin-top: 16px;
  padding-top: 14px;
}
.pl-legend .adm-legend-i { font-size: 12.5px; }
.pl-legend .adm-legend-dot { width: 11px; height: 11px; }

.pl-tooltip {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 10px;
  padding: 10px 14px;
  min-width: 190px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, .14);
}
.pl-tooltip-month {
  font: 800 12.5px/1 var(--dash-font);
  color: var(--text-primary);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border-light, #E2E8F0);
}
.pl-tooltip-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px;
  font: 600 11.5px/1.5 var(--dash-font);
  color: var(--text-secondary, #475569);
  padding: 2px 0;
}
.pl-tooltip-row b { color: var(--text-primary); font-weight: 800; white-space: nowrap; }
.pl-tooltip-lbl { display: inline-flex; align-items: center; gap: 6px; }
.pl-tooltip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

@media (max-width: 700px) {
  .pl-overview { padding: 16px 16px 14px; }
  .pl-legend { gap: 16px; }
}

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
[data-theme="dark"] .pl-overview,
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

  /* Fee Analytics 3+3+1 grids — collapse to 1-col */
  .fa-top-grid,
  .fa-second-grid,
  .fa-final {
    gap: 10px;
    margin-bottom: 10px;
  }
  .fee-card {
    padding: 14px 14px;
    min-height: 0;
    border-radius: 12px;
  }
  /* Cards now show real (potentially 7-digit) live PKR totals — give
     narrow screens extra headroom so a long amount never gets clipped
     by .fee-card's overflow:hidden. */
  .fa-amount--lg { font-size: 20px; }
  .fa-amount--xl { font-size: 24px; }
  .fa-final-tag { font-size: 9px; padding: 2px 7px; }

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

/* ═══ Fee Analytics Overview — graphical summary above the cards ═══
   One outer card (.fa-overview) holding: title, a mini highlight
   strip, one full-width comparison bar chart, a 2-up chart grid
   (donut + collections bar), then the "View Cards" button. Reuses
   .adm-chart-card / .adm-card-h* tokens already defined above so it
   matches every other chart card on this dashboard. */
.fa-overview {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  padding: 20px 22px 18px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  animation: dashRise .35s ease;
}
.fa-overview-locked { margin-bottom: 16px; }
.fa-overview-head { margin-bottom: 14px; }
.fa-overview-title {
  display: inline-flex; align-items: center; gap: 8px;
  font: 800 15px/1.2 var(--dash-font); color: var(--text-primary); letter-spacing: -0.2px;
}
.fa-overview-title i { color: #1E40AF; font-size: 14px; }
[data-theme="dark"] .fa-overview-title i { color: #93C5FD; }
/* Continuous "Live" indicator — unlike the one-time entrance animations
   below, this never stops, so the section always reads as animated no
   matter when you happen to look at it. */
.fa-live-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font: 800 9.5px/1 var(--dash-font); letter-spacing: .5px; text-transform: uppercase;
  color: #16A34A; background: rgba(22, 163, 74, .1);
  border: 1px solid rgba(22, 163, 74, .25);
  padding: 3px 8px; border-radius: 999px;
}
[data-theme="dark"] .fa-live-badge { color: #4ADE80; background: rgba(74, 222, 128, .14); border-color: rgba(74, 222, 128, .3); }
.fa-live-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
@media (prefers-reduced-motion: no-preference) {
  .fa-live-dot { animation: faLivePulse 1.8s ease-in-out infinite; }
}
@keyframes faLivePulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(22,163,74,.45); }
  50%      { opacity: .55; box-shadow: 0 0 0 4px rgba(22,163,74,0); }
}
.fa-overview-sub {
  font: 500 12px/1.4 var(--dash-font); color: var(--text-muted, #64748B);
  margin-top: 4px;
}
.fa-overview-sub b { color: var(--text-primary); font-weight: 700; }

/* Mini highlight strip */
.fa-highlight-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.fa-highlight-tile {
  position: relative; overflow: hidden;
  display: flex; align-items: center; gap: 9px;
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 10px;
  padding: 9px 10px;
  background: var(--bg-muted, #F8FAFC);
}
.fa-highlight-tile i { font-size: 14px; flex-shrink: 0; position: relative; z-index: 1; }
.fa-highlight-val { font: 800 14px/1.15 var(--dash-font); color: var(--text-primary); position: relative; z-index: 1; }
.fa-highlight-lbl { font: 600 10px/1.3 var(--dash-font); color: var(--text-muted, #64748B); white-space: nowrap; position: relative; z-index: 1; }
.fa-highlight-tile--green  i { color: #16A34A; }
.fa-highlight-tile--red    i { color: #DC2626; }
.fa-highlight-tile--purple i { color: #7C3AED; }
.fa-highlight-tile--violet i { color: #A78BFA; }

/* Staggered entrance (animationDelay set inline per tile index), slow
   and generous enough to still be visible even if you glance a beat
   after mount — only for users who haven't asked for reduced motion;
   the base rule above already renders every tile fully visible with
   no JS/CSS dependency either way. */
@media (prefers-reduced-motion: no-preference) {
  .fa-highlight-tile { opacity: 0; animation: faTileIn .8s cubic-bezier(.22, 1.4, .36, 1) forwards; }
  /* Continuous light sweep — unlike the entrance above, this NEVER
     stops, so the strip always reads as "live" no matter when it's
     looked at. Staggered per tile via nth-child so the sweep travels
     across the row like a wave instead of flashing in unison. */
  .fa-highlight-tile::after {
    content: ''; position: absolute; inset: 0; left: -60%; width: 40%;
    background: linear-gradient(115deg, transparent, rgba(255,255,255,.4), transparent);
    transform: skewX(-20deg);
    animation: faShimmer 3.6s ease-in-out infinite;
  }
  [data-theme="dark"] .fa-highlight-tile::after { background: linear-gradient(115deg, transparent, rgba(255,255,255,.14), transparent); }
  .fa-highlight-strip .fa-highlight-tile:nth-child(1)::after { animation-delay: .8s; }
  .fa-highlight-strip .fa-highlight-tile:nth-child(2)::after { animation-delay: 1.2s; }
  .fa-highlight-strip .fa-highlight-tile:nth-child(3)::after { animation-delay: 1.6s; }
  .fa-highlight-strip .fa-highlight-tile:nth-child(4)::after { animation-delay: 2s; }
  .fa-highlight-strip .fa-highlight-tile:nth-child(5)::after { animation-delay: 2.4s; }
  .fa-highlight-strip .fa-highlight-tile:nth-child(6)::after { animation-delay: 2.8s; }
}
@keyframes faTileIn {
  from { opacity: 0; transform: translateY(10px) scale(.94); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes faShimmer {
  0%   { left: -60%; }
  35%  { left: 130%; }
  100% { left: 130%; }
}

/* Chart cards */
.fa-chart-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.fa-chart-card--wide { padding-bottom: 6px; }
.fa-chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 4px;
}
.fa-chart-grid .fa-chart-card { margin-bottom: 0; }
/* Card-level entrance, staggered to land just ahead of each chart's own
   internal draw-in (animationBegin 200 / 500 / 800ms above) so the
   whole section reads as one slow, deliberate cascading reveal rather
   than a blink-and-you-miss-it flash. */
@media (prefers-reduced-motion: no-preference) {
  .fa-chart-card { opacity: 0; animation: faTileIn .7s cubic-bezier(.22, 1.4, .36, 1) forwards; }
  .fa-chart-card--wide { animation-delay: 100ms; }
  .fa-chart-grid .fa-chart-card:nth-child(1) { animation-delay: 400ms; }
  .fa-chart-grid .fa-chart-card:nth-child(2) { animation-delay: 700ms; }
}
.fa-chart-empty {
  display: flex; align-items: center; justify-content: center;
  height: 260px;
  font: 600 12.5px/1.4 var(--dash-font); color: var(--text-muted, #64748B);
  text-align: center;
}

/* View Cards CTA */
.fa-viewcards-row { display: flex; justify-content: center; margin-top: 6px; }
.fa-viewcards-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font: 800 12.5px/1 var(--dash-font); color: #fff;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  border: none; border-radius: 999px;
  padding: 10px 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(30, 64, 175, .25);
  transition: transform .15s, box-shadow .15s;
}
.fa-viewcards-btn:hover { transform: translateY(1px); box-shadow: 0 1px 4px rgba(30, 64, 175, .25); }
.fa-viewcards-btn--open { background: linear-gradient(135deg, #475569, #64748B); }
.fa-viewcards-chev { font-size: 10px; animation: faChevBounce 1.6s ease-in-out infinite; transition: transform .2s; }
.fa-viewcards-chev--open { animation: none; transform: rotate(180deg); }
@keyframes faChevBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(2px); }
}

[data-theme="dark"] .fa-overview { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fa-highlight-tile { background: rgba(255,255,255,.04); border-color: var(--border-light); }
[data-theme="dark"] .fa-chart-card { background: var(--bg-card); border-color: var(--border-light); }

@media (max-width: 1024px) {
  .fa-highlight-strip { grid-template-columns: repeat(3, 1fr); }
  .fa-chart-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .fa-overview { padding: 16px 14px 14px; }
  .fa-highlight-strip { grid-template-columns: repeat(2, 1fr); }
  .fa-highlight-val { font-size: 13px; }
  .fa-overview-title { font-size: 14px; }
  .fa-viewcards-btn { width: 100%; justify-content: center; }
}
`;
