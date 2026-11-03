import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmt } from './dashboardData';
import { pkr2 } from './transactionData';
import { DASHBOARD_GATES } from './userMgmtData';
import { fetchDashboard, dashboardApi, schoolPermissionsApi, paymentsApi, schoolProgressApi } from './api';
import SchoolListReport from './SchoolListReport';
import OneLinkOverviewSection, { Modal } from './OneLinkSection';
import { BugFormModal, BugReportsSection, BUG_SCOPE } from './BugManager';
import { ImprovementFormModal, ImprovementReportsSection, IMP_SCOPE } from './ImprovementManager';
import { BUG_STATUS, IMP_STATUS } from './api/services/dashboard';

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD — platform overview (permission-aware)

   Ported from "dashboard.html". Every figure is derived live from the
   other Super Admin modules (see dashboardData.js) rather than hardcoded.

   The "Viewing as" selector lets you preview the dashboard as any admin
   user. A user only sees the sections their menu permissions allow
   (User Management ▸ User Permission): when a menu tab is inactive for a
   user, every dashboard section that depends on it is hidden for them.
   Super Admin (default) sees everything.
   ═══════════════════════════════════════════════════════════════════ */

/* "Jun 25, 2026" for the badge dates. */
const todayLabel = () => {
  const d = new Date();
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

/* "August 2026" — admin_dashboard hamesha CHALTE mahine ka overview deta hai,
   is liye heading bhi wahi mahina dikhati hai (pehle "June 2026" jama hua
   tha aur data kisi aur mahine ka hota tha). */
const monthLabel = () => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/* ── Bugs / Improvements ka period filter ────────────────────────────
   Pehle yahan do saade <select> thay jinki options hardcoded thin
   ("June 2026", "May 2026", "April 2026") aur jinhen badalne se kuch
   hota hi nahi tha — cards hamesha ek hi aankra dikhate rehte thay.

   Ab yeh asal filter hai: admin_dashboard ke jawab me poori `Bugs` list
   aati hai (har entry par `Date`), aur cards usi list ko chune hue
   arse par gin kar dikhate hain. */
const BI_PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
];
const biLabel = (id) => (BI_PERIODS.find((p) => p.id === id) || BI_PERIODS[2]).label;

/* Fee ka apna period bar. Challan / receiving MAHAANA hote hain (ledger par
   ek mahina = ek challan), is liye sirf mahine wale options. "Today" /
   "Yesterday" pehle yahan thay magar un par cards 0 dikhate thay — wo
   aankra jhoota tha, kyunke us din ka koi alag fee hisaab hota hi nahi. */
const FEE_PERIODS = BI_PERIODS.filter((p) => p.id === 'thisMonth' || p.id === 'lastMonth');

/* ── Pakistan ka waqt ─────────────────────────────────────────────────
   Mahina / din hamesha Asia/Karachi me — browser kisi aur timezone me ho
   tab bhi "This Month" wahi mahina ho jo backend aur School Payments ginte hain. */
const PK_TZ = 'Asia/Karachi';
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function pkToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: PK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return isoOf(new Date());
  }
}
const shiftDay = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };

/* Fee period id → { month, year } (School Payments ka period shape). */
function feePeriodOf(id) {
  const ym = id === 'lastMonth' ? shiftMonth(pkToday().slice(0, 7), -1) : pkToday().slice(0, 7);
  return { month: Number(ym.slice(5, 7)), year: Number(ym.slice(0, 4)), key: ym };
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const periodName = (p) => `${MONTH_NAMES[p.month - 1]} ${p.year}`;

/* null / undefined = abhi maloom nahi (load ho raha / fail) → '—', 0 nahi. */
const fmtOrDash = (n) => (n == null ? '—' : fmt(n));

/* usertimespend-report har school ki alag call hai — ek waqt me itni hi. */
const LOGIN_POOL = 6;

function countSchoolsCreatedThisMonth(rows = []) {
  const currentMonth = pkToday().slice(0, 7);

  return rows.filter((school) => {
    const signupDate = String(school.signupDate || '').trim();

    return (
      /^\d{4}-\d{2}-\d{2}/.test(signupDate) &&
      signupDate.slice(0, 7) === currentMonth
    );
  }).length;
}

/* API ki Bugs list → { total, resolved, pending } for one kind + period.
   `kind` mapping api/services/dashboard.js me hoti hai: jis entry ka
   BugDetail "[Improvement] …" se shuru ho wo improvement hai, baqi bug. */
function countBi(list, kind, periodId) {
  const isInPeriod = (date) => {
    if (periodId === 'all') return true;
    if (!date) return false;

    const today = pkToday();
    const dateStr = String(date).slice(0, 10);

    if (periodId === 'today') return dateStr === today;
    if (periodId === 'yesterday') return dateStr === shiftDay(today, -1);
    if (periodId === 'thisMonth') return dateStr.slice(0, 7) === today.slice(0, 7);
    if (periodId === 'lastMonth') return dateStr.slice(0, 7) === shiftMonth(today.slice(0, 7), -1);

    return false;
  };

  const rows = (list || []).filter(
    (b) => b.kind === kind && isInPeriod(b.date)
  );

  const resolved = rows.filter((b) => b.solved).length;

  return {
    total: rows.length,
    resolved,
    pending: rows.length - resolved,
    rows
  };
}


export default function Dashboard({ toast, users = [], perms = {} }) {
  const [d, setD] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewAs, setViewAs] = useState('');   // '' = Super Admin; else a user id
  const [feePeriod, setFeePeriod] = useState('thisMonth');
  const [schoolReport, setSchoolReport] = useState(null);
  /* School directory (dashboardApi.loadSchoolDirectory): { launch, erp,
     inactive, enriched } — status + ERP/Launch group branch directory se,
     students/staff branch-report se. Saare school cards isi ek list par. */
  const [progress, setProgress] = useState(null);
  const [progressErr, setProgressErr] = useState(null);
  /* branchId → IS MAHINE ke ERP logins (usertimespend-report, type 'erp').
     Value null = us school ki call fail hui (maloom nahi), 0 nahi. */
  const [monthLogins, setMonthLogins] = useState(null);
  const [branchNames, setBranchNames] = useState(null);
  /* Fee ledger har mahine ke liye alag: { [YYYY-MM]: { status, rows, totals, error } }.
     Period badalne par purane mahine ke aankre kabhi naye label ke neeche nahi aate. */
  const [feeByPeriod, setFeeByPeriod] = useState({});
  /* Default "All Time" — is par cards API ki apni BugSummary dikhate hain. */
  const [bugPeriod, setBugPeriod] = useState('all');
  const [impPeriod, setImpPeriod] = useState('all');
  const today = todayLabel();

  /* Overview (students / staff / onboarding / videos / bugs): admin_dashboard. */
  const loadOverview = useCallback(() => {
    setLoadErr(null);
    return fetchDashboard().then(setD).catch((e) => { setLoadErr(e); });
  }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  /* Har school ke IS MAHINE (Pakistan time) ke ERP logins. Ek waqt me
     LOGIN_POOL calls (pehle saari ~300 ek saath jati thin), ek dafa hi chalti
     hai (in-flight ref), aur fail hui call ko ek baar dobara koshish — phir bhi
     fail ho to null ("maloom nahi"), 0 nahi. */
  const loginsJob = useRef(null);
  const loadMonthLogins = useCallback((prog) => {
    if (loginsJob.current) return loginsJob.current;
    const all = [...prog.launch, ...prog.erp, ...prog.inactive];
    const month = pkToday().slice(0, 7);
    const fetchOne = (id) => schoolProgressApi
      .listUserTimeSpendReport({ branchId: id, month, type: 'erp' })
      .then((rep) => Number(rep?.totalEntries) || 0);
    const out = {};
    let next = 0;
    const worker = async () => {
      while (next < all.length) {
        const id = all[next++].id;
        out[id] = await fetchOne(id).catch(() => fetchOne(id)).catch(() => null);
      }
    };
    loginsJob.current = Promise.all(Array.from({ length: Math.min(LOGIN_POOL, all.length) }, worker))
      .then(() => setMonthLogins(out));
    return loginsJob.current;
  }, []);

  const loadSchools = useCallback(() => {
    setProgressErr(null);
    return dashboardApi.loadSchoolDirectory()
      .then((p) => {
        setProgress(p);
        /* Wahi directory reports ke "School" column aur Add Bug ke dropdown ko bhi. */
        setBranchNames((cur) => cur || Object.fromEntries([...p.launch, ...p.erp, ...p.inactive].map((s) => [s.id, s.name])));
        loadMonthLogins(p);
      })
      .catch((e) => setProgressErr(e));
  }, [loadMonthLogins]);
  useEffect(() => { loadSchools(); }, [loadSchools]);

  /* Fee Analytics + Current Month Details — School Payments ki wahi ledger
     (paymentsApi.loadFeeLedger) chune hue mahine ke liye. */
  const feePeriodInfo = feePeriodOf(feePeriod);
  const feeKey = feePeriodInfo.key;
  useEffect(() => {
    if (!progress || feeByPeriod[feeKey]) return;
    const p = feePeriodOf(feePeriod);
    const schools = [...progress.launch, ...progress.erp, ...progress.inactive]
      .map((s) => ({ id: s.id, name: s.name, students: s.students }));
    setFeeByPeriod((cur) => ({ ...cur, [p.key]: { status: 'loading' } }));
    paymentsApi.loadFeeLedger(schools, p)
      .then((res) => setFeeByPeriod((cur) => ({ ...cur, [p.key]: { status: 'ok', ...res } })))
      .catch((e) => setFeeByPeriod((cur) => ({ ...cur, [p.key]: { status: 'error', error: e?.message || 'Could not load School Payments records' } })));
  }, [progress, feePeriod, feeKey, feeByPeriod]);
  const retryFee = () => setFeeByPeriod((cur) => { const n = { ...cur }; delete n[feeKey]; return n; });

  const bugStats = useMemo(() => countBi(d?.bugList, 'bug', bugPeriod), [d, bugPeriod]);
  const impStats = useMemo(() => countBi(d?.bugList, 'improvement', impPeriod), [d, impPeriod]);

  /* Report kholte hi (pehli baar) branch directory — wahi live list jo
     School Permissions screen dikhati hai. Na mile to report BranchID par
     gir jati hai, khulti phir bhi hai. */
  const ensureBranchNames = useCallback(() => {
    setBranchNames((cur) => {
      if (cur) return cur;
      schoolPermissionsApi.listPermissionBranches()
        .then(({ schools }) => {
          const map = {};
          schools.forEach((s) => { map[s.id] = s.name; });
          setBranchNames(map);
        })
        .catch(() => setBranchNames({}));
      return cur;
    });
  }, []);

  /* ── Bug Manager ── Add/Edit modal ka bug (null = band, {} = naya). Har
     save / status / delete ke baad SIRF admin_dashboard dobara — cards aur
     Bug Reports table dono usi `Bugs` list se bante hain. */
  const [bugForm, setBugForm] = useState(null);
  /* Bug Reports table ka status daayra — Bugs Summary cards ke "View Report"
     isi ko set karte hain (alag report dataset nahi, wahi table). */
  const [bugScope, setBugScope] = useState(BUG_SCOPE.all);
  const bugTableRef = useRef(null);
  const showBugReport = useCallback((scope) => {
    setBugScope(scope);
    bugTableRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);
  /* Improvement Manager — bilkul usi tarah, apni alag entity ("[Improvement]"). */
  const [impForm, setImpForm] = useState(null);
  const [impScope, setImpScope] = useState(IMP_SCOPE.all);
  const impTableRef = useRef(null);
  const openImpForm = useCallback((item) => { setImpForm(item || {}); ensureBranchNames(); }, [ensureBranchNames]);
  const showImpReport = useCallback((scope) => {
    setImpScope(scope);
    impTableRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);
  const [bugsBusy, setBugsBusy] = useState(false);
  const [bugsErr, setBugsErr] = useState(null);
  const openBugForm = useCallback((bug) => { setBugForm(bug || {}); ensureBranchNames(); }, [ensureBranchNames]);
  const reloadBugs = useCallback(async () => {
    setBugsBusy(true);
    setBugsErr(null);
    try {
      const dash = await fetchDashboard();
      setD((prev) => (prev ? { ...prev, bugs: dash.bugs, bugList: dash.bugList } : prev));
    } catch (e) {
      setBugsErr(e?.message || 'Could not refresh bugs');
    } finally {
      setBugsBusy(false);
    }
  }, []);
  const bugSchools = useMemo(() => Object.entries(branchNames || {})
    .map(([id, name]) => ({ id: Number(id), name: name || `Branch ${id}` }))
    .filter((s) => s.id > 0)
    .sort((a, b) => a.name.localeCompare(b.name)), [branchNames]);

  /* Report modal sirf wahi list dikhata hai jo card ginta hai — data mount par
     hi load ho chuka hota hai (loadSchools), yahan koi nayi call nahi. */
  const openSchoolReport = useCallback((key, title, description) => {
    setSchoolReport({ key, title, description });
  }, []);

  const schoolLists = useMemo(() => {
    if (!progress) return null;
    const toRow = (r) => ({
      id: r.id, name: r.name, date: r.signupDate || '',
      note: progress.enriched ? `Students: ${r.students} · Staff: ${r.staff}` : 'Students / staff unavailable',
    });
    const all = [...progress.launch, ...progress.erp, ...progress.inactive];
    return {
      active: [...progress.launch, ...progress.erp].map(toRow),
      erp: progress.erp.map(toRow),
      launch: progress.launch.map(toRow),
      inactive: progress.inactive.map(toRow),
      /* Login wali dono lists sirf IS MAHINE ke logins par (monthLogins).
         Jab tak load na ho, undefined → report "Loading" dikhati hai. Jin
         schools ki call fail hui (null) wo dono lists se bahar — unhe na 0
         login wala kaha ja sakta hai na active. */
      zeroLogin: monthLogins
        ? all.filter((r) => monthLogins[r.id] === 0).map((r) => ({ ...toRow(r), logins: 0 }))
        : undefined,
      activeLogin: monthLogins
        ? all.filter((r) => monthLogins[r.id] > 0)
          .sort((a, b) => monthLogins[b.id] - monthLogins[a.id])
          .map((r) => ({ ...toRow(r), logins: monthLogins[r.id] }))
        : undefined,
      /* branch-report na aaye to students/staff maloom nahi → undefined. */
      students: progress.enriched ? all.filter((r) => r.students > 0).map((r) => ({ ...toRow(r), note: `Students: ${r.students}` })) : undefined,
      staff: progress.enriched ? all.filter((r) => r.staff > 0).map((r) => ({ ...toRow(r), note: `Staff: ${r.staff}` })) : undefined,
    };
  }, [progress, monthLogins]);

  /* "New this month" — usi list ki signup date (Pakistan ka mahina) se, taake
     card, report aur This Month Progress teeno ek hi aankra dein. */
  const newErpThisMonth = progress ? countSchoolsCreatedThisMonth(progress.erp) : null;
  const newLaunchThisMonth = progress ? countSchoolsCreatedThisMonth(progress.launch) : null;

  /* Card ka number = report list ka length. List load na hui ho / fail ho to
     '—' (pehle yahan admin_dashboard ka alag aankra aa jata tha, jo list load
     hote hi badal jata tha). */
  const listCount = (key) =>
    (schoolLists && Array.isArray(schoolLists[key])) ? schoolLists[key].length : null;

  /* Inactive / Active Login cards ka ERP + Launch Setup batwara — bilkul wahi
     qaida jo zeroLogin / activeLogin lists ka hai, aur group branch directory
     ke launchSetup se. `unknown` = jin schools ki login call fail hui. */
  const loginSplit = useMemo(() => {
    if (!progress || !monthLogins) return null;
    const out = { zero: { erp: 0, launch: 0 }, active: { erp: 0, launch: 0 }, unknown: 0 };
    [...progress.launch, ...progress.erp, ...progress.inactive].forEach((r) => {
      const n = monthLogins[r.id];
      if (n == null) { out.unknown += 1; return; }
      out[n > 0 ? 'active' : 'zero'][r.setupType === 'erp' ? 'erp' : 'launch'] += 1;
    });
    return out;
  }, [progress, monthLogins]);

  /* Current Month Details ki rows — chune hue mahine ki fee ledger, phir search. */
  const fee = useMemo(() => feeByPeriod[feeKey] || { status: 'loading' }, [feeByPeriod, feeKey]);
  const filtered = useMemo(() => {
    const rows = fee.status === 'ok' ? fee.rows : [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [fee, search]);

  /* ── Resolve the viewer and which sections their permissions allow ── */
  const viewUser = viewAs ? users.find((u) => String(u.id) === String(viewAs)) : null;
  const isSuper = !viewUser;
  const granted = isSuper ? null : (perms[viewUser.id] || []);
  const has = (menu) => isSuper || granted.includes(menu);
  const hasAny = (menus) => isSuper || menus.some((m) => granted.includes(m));

  const accountInactive = !!viewUser && !viewUser.active;
  const canDashboard = has('Dashboard');
  const canPay = hasAny(DASHBOARD_GATES.pay);
  const canProgress = hasAny(DASHBOARD_GATES.progress);
  const canVideo = hasAny(DASHBOARD_GATES.video);

  const hidden = [];
  if (canDashboard && !accountInactive) {
    if (!canPay) hidden.push('Fee Analytics', '1LINK Overview');
    if (!canProgress) hidden.push('School Overview & Details');
    if (!canVideo) hidden.push('Video Details');
  }

  /* ── "Viewing as" control (shared by every render branch) ── */
  const viewBar = (
    <div className="db-viewbar">
      <i className="fa-solid fa-eye" />
      <span className="db-viewbar-lbl">Viewing as</span>
      <select data-tip="Preview the dashboard with another user's permissions" data-tip-pos="bottom" value={viewAs} onChange={(e) => setViewAs(e.target.value)}>
        <option value="">Super Admin (full access)</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.fullName}{u.active ? '' : ' — inactive'}</option>
        ))}
      </select>
      {viewUser && <span className="db-viewbar-tag">Previewing this user's access</span>}
    </div>
  );

  const header = (
    <div className="page-header">
      <div className="page-title-row">
        <div className="page-icon"><i className="fa-solid fa-gauge-high" /></div>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Platform overview &amp; analytics — {monthLabel()}</div>
        </div>
      </div>
      {viewBar}
    </div>
  );

  /* ── Data fetch failed ── */
  if (loadErr) {
    return (
      <div className="page-content">
        {header}
        <div className="db-block">
          <i className="fa-solid fa-triangle-exclamation" />
          <div className="db-block-ttl">Couldn't load the dashboard</div>
          <div className="db-block-sub">{loadErr.message || 'The dashboard service is unavailable.'}</div>
          <button className="db-retry" onClick={() => { setD(null); loadOverview(); }}>
            <i className="fa-solid fa-rotate-right" /> Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Still loading the overview ── */
  if (!d) {
    return (
      <div className="page-content">
        {header}
        <div className="db-skeleton">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="db-skel-card" />)}
        </div>
      </div>
    );
  }

  /* Table pagination (derived once data is present). */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const start = (curPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const pageTotals = filtered.reduce((t, r) => ({
    prevDues: t.prevDues + r.prevDues, challan: t.challan + r.challan, discount: t.discount + r.discount,
    receivable: t.receivable + r.receivable, received: t.received + r.received, pending: t.pending + r.pending,
  }), { prevDues: 0, challan: 0, discount: 0, receivable: 0, received: 0, pending: 0 });

  /* Fee Analytics cards = chune hue mahine ki School Payments ledger ka jama
     (search se mustaqil). Load ho raha ho ya fail ho to '—', 0 kabhi nahi. */
  const feeTotals = fee.status === 'ok' ? fee.totals : {};
  const feeErr = fee.status === 'error' ? fee.error : '';
  const feeVal = (v) => (fee.status === 'ok' ? pkr2(v) : '—');
  const feeMonthWord = feePeriod === 'lastMonth' ? 'Last Month' : 'This Month';
  const totalStudents = d.students.total, totalStaff = d.staff.total;

  /* Bugs Summary ke cards:
       • "All Time" par API ki APNI BugSummary chhapti hai — bilkul wahi
         teen aankre jo jawab me aate hain (TotalBugs / ResolvedBugs /
         PendingBugs). Yeh default hai, taake screen kholte hi wo dikhe
         jo API kehti hai.
       • Kisi doosre arse par BugSummary kaam nahi de sakti (us par koi
         period hai hi nahi), is liye aankre `Bugs` list se tareekh par
         chhaan kar nikale jate hain.
     Dono ke beech ka farq waja rakhta hai: BugSummary improvements ko
     bhi bug ginti hai, chhani hui list nahi. */
  /* Har period par (All Time bhi) saved bug records se — wahi rows jo Bug
     Reports table dikhati hai. API ki BugSummary improvements ko bhi bug
     ginti thi, is liye wo table se mel nahi khati thi. */
  const bugCards = bugStats;

  /* ── Account inactive → nothing is shown ── */
  if (accountInactive) {
    return (
      <div className="page-content">
        {header}
        <div className="db-block">
          <i className="fa-solid fa-user-slash" />
          <div className="db-block-ttl">{viewUser.fullName}'s account is inactive</div>
          <div className="db-block-sub">An inactive user cannot sign in, so no dashboard is shown. Re-activate the account in User Management ▸ User Registration.</div>
        </div>
      </div>
    );
  }

  /* ── No Dashboard menu permission → whole dashboard blocked ── */
  if (!canDashboard) {
    return (
      <div className="page-content">
        {header}
        <div className="db-block">
          <i className="fa-solid fa-lock" />
          <div className="db-block-ttl">{viewUser.fullName} has no Dashboard access</div>
          <div className="db-block-sub">The “Dashboard” menu is inactive for this user. Enable it in User Management ▸ User Permission to let them see this screen.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {header}

      {/* Which sections are hidden for the previewed user */}
      {viewUser && hidden.length > 0 && (
        <div className="db-locked">
          <i className="fa-solid fa-circle-info" />
          <span>Hidden for <b>{viewUser.fullName}</b> (menu inactive): {hidden.join(' · ')}</span>
        </div>
      )}
      {viewUser && hidden.length === 0 && (
        <div className="db-locked db-locked-ok">
          <i className="fa-solid fa-circle-check" />
          <span><b>{viewUser.fullName}</b> has access to all dashboard sections.</span>
        </div>
      )}

      {/* ─── FEE ANALYTICS ─── */}
      {canPay && (
        <>
          <div className="section-hdr" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="section-hdr-icon"><i className="fa-solid fa-chart-bar" /></div>
              <div className="section-hdr-title">Fee Analytics</div>
            </div>
            <div className="bi-period-bar">
              <span className="bi-period-lbl">PERIOD:</span>
              <select className="bi-period-sel" value={feePeriod} onChange={(e) => { setFeePeriod(e.target.value); setPage(1); }}>
                {FEE_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="fee-grid">
            <FeeCard tone="red" icon="fa-circle-exclamation" label="Previous Dues" val={feeVal(feeTotals.prevDues)} />
            <FeeCard tone="teal" icon="fa-file-invoice" label={`Fee Challan ${feeMonthWord}`} val={feeVal(feeTotals.challan)} />
            <FeeCard tone="orange" icon="fa-percent" label={`Fee Discount ${feeMonthWord}`} val={feeVal(feeTotals.discount)} />
          </div>
          <div className="fee-grid-2">
            <FeeCard tone="slate" icon="fa-percent" label="Fee Challan After Discount" val={feeVal(feeTotals.receivable)} />
            <FeeCard tone="green" icon="fa-money-bill-wave" label="Fee Received" val={feeVal(feeTotals.received)} />
            <FeeCard tone="red2" icon="fa-circle-exclamation" label="Total Pending" val={feeVal(feeTotals.pending)} />
          </div>
          {feeErr && (
            <div className="db-locked" style={{ marginTop: -8, marginBottom: 14, borderColor: 'rgba(220,38,38,.35)', color: '#B91C1C' }}>
              <i className="fa-solid fa-triangle-exclamation" />
              <span>Fee figures unavailable for {periodName(feePeriodInfo)} — {feeErr}.</span>
              <button className="db-retry" style={{ marginLeft: 8 }} onClick={retryFee}><i className="fa-solid fa-rotate-right" /> Retry</button>
            </div>
          )}
          {fee.status === 'ok' && (
            <div className="db-locked db-locked-ok" style={{ marginTop: -8 }}>
              <i className="fa-solid fa-circle-check" />
              <span>{periodName(feePeriodInfo)} — same records and formula as <b>School Payments → Receiving</b>: previous dues = last month's unpaid balance, challan = this month's charge. After discount = previous dues + challan − discount. Pending = that − received.</span>
            </div>
          )}
        </>
      )}

      {/* ─── SCHOOL OVERVIEW ─── */}
      {canProgress && (
        <>
          <div className="section-hdr">
            <div className="section-hdr-icon"><i className="fa-solid fa-school" /></div>
            <div className="section-hdr-title">School Overview</div>
          </div>
          {progressErr && (
            <div className="db-locked" style={{ marginTop: -8, marginBottom: 14, borderColor: 'rgba(220,38,38,.35)', color: '#B91C1C' }}>
              <i className="fa-solid fa-triangle-exclamation" />
              <span>School figures unavailable — {progressErr.message || 'could not load the branch directory'}.</span>
              <button className="db-retry" style={{ marginLeft: 8 }} onClick={loadSchools}><i className="fa-solid fa-rotate-right" /> Retry</button>
            </div>
          )}
          <div className="overview-grid" style={{ marginBottom: 14 }}>
            <OvCard label="Active Schools" val={listCount('active')} sub={<><b>↑ {progress ? fmt(newErpThisMonth + newLaunchThisMonth) : '—'}</b> &nbsp;New this month</>} badge="blue" icon="fa-circle-check"
              onClick={() => openSchoolReport('active', 'Active Schools', 'ERP + Launch Set-Up schools')} />
            <OvCard label="ERP Schools" val={listCount('erp')} sub={<><b>↑ {fmtOrDash(newErpThisMonth)}</b> &nbsp;New this month</>} badge="teal" icon="fa-database"
              onClick={() => openSchoolReport('erp', 'ERP Schools', 'Active schools running on ERP')} />
            <OvCard label="Launch Set-Up Schools" val={listCount('launch')} sub={<><b>↑ {fmtOrDash(newLaunchThisMonth)}</b> &nbsp;New this month</>} badge="purple" icon="fa-rocket"
              onClick={() => openSchoolReport('launch', 'Launch Set-Up Schools', 'Active schools in launch set-up')} />
          </div>
          <div className="overview-grid" style={{ marginBottom: 28 }}>
            <div className="ov-card" style={{ cursor: 'pointer' }} title="Click to view schools"
              onClick={() => openSchoolReport('zeroLogin', 'Inactive Schools', 'Registered schools with 0 ERP logins this month')}>
              <div className="ov-lbl red">Inactive Schools</div>
              <OvSplit tone="red" erp={loginSplit?.zero.erp} launch={loginSplit?.zero.launch} />
              <div className="ov-sub">Registered but <b className="red">0 logins</b> from 1st of this month to today{loginSplit?.unknown ? ` · ${loginSplit.unknown} couldn't be checked` : ''}</div>
              <div className="ov-badge ov-badge-red"><i className="fa-solid fa-user-slash" /></div>
            </div>
            <div className="ov-card" style={{ cursor: 'pointer' }} title="Click to view schools"
              onClick={() => openSchoolReport('activeLogin', 'Active Login Schools', 'Schools with at least one ERP login this month')}>
              <div className="ov-lbl green">Active Login Schools</div>
              <OvSplit tone="green" erp={loginSplit?.active.erp} launch={loginSplit?.active.launch} />
              <div className="ov-sub">Logged in <b style={{ color: '#16A34A' }}>at least once</b> from 1st of this month to today{loginSplit?.unknown ? ` · ${loginSplit.unknown} couldn't be checked` : ''}</div>
              <div className="ov-badge ov-badge-green"><i className="fa-solid fa-user-check" /></div>
            </div>
            {/* Onboarding status */}
            <div className="onboard-card">
              <div className="ov-lbl">School Onboarding Status</div>
              <div className="onboard-nums">
                <div className="onboard-num-block" style={{ textAlign: 'left' }}>
                  <div className="onboard-num-val" style={{ color: 'var(--t1)' }}>{d.onboarding.fullyTrained}</div>
                  <div className="onboard-num-lbl">Fully Trained</div>
                </div>
                <div className="onboard-num-divider" />
                <div className="onboard-num-block">
                  <div className="onboard-num-val" style={{ color: 'var(--brand)' }}>{d.onboarding.inProcess}</div>
                  <div className="onboard-num-lbl">In Process</div>
                </div>
                <div className="onboard-num-divider" />
                <div className="onboard-num-block" style={{ textAlign: 'right' }}>
                  {/* admin_dashboard sirf FullyTrained/InProcess deti hai —
                      Total Modules us jawab me hai hi nahi, is liye "—". */}
                  <div className="onboard-num-val" style={{ color: 'var(--t1)' }}>
                    {d.onboarding.totalModules == null ? '—' : d.onboarding.totalModules}
                  </div>
                  <div className="onboard-num-lbl">Total Modules</div>
                </div>
              </div>
              <div className="onboard-bar"><div className="onboard-bar-fill" style={{ width: `${d.onboarding.pct}%` }} /></div>
              <div className="onboard-progress-row">
                <span>0%</span><span>{d.onboarding.pct}% Complete</span><span>100%</span>
              </div>
            </div>
          </div>

          {/* Total Students + Total Staff */}
          <div className="detail-2col" style={{ marginBottom: 28 }}>
            <UserCard label="Total Students" iconTone="teal" icon="fa-user-graduate"
              overall={totalStudents} newSignup={d.students.newSignup} signupColor="#DC2626"
              onClick={() => openSchoolReport('students', 'Total Students — school wise', 'Students per school', totalStudents)} />
            <UserCard label="Total Staff" iconTone="blue" icon="fa-user-tie"
              overall={totalStaff} newSignup={d.staff.newSignup} signupColor="#D97706"
              onClick={() => openSchoolReport('staff', 'Total Staff — school wise', 'Staff per school', totalStaff)} />
          </div>

        </>
      )}

      {/* ─── 1LINK / 1BILL TRANSACTION MONITORING & REVENUE ─── */}
      {canPay && <OneLinkOverviewSection toast={toast} />}

      {canProgress && (
        <>
          {/* ─── BUGS SUMMARY ─── */}
          <div className="section-hdr" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="section-hdr-icon" style={{ background: 'linear-gradient(135deg,#B91C1C,#DC2626)' }}><i className="fa-solid fa-bug" /></div>
              <div className="section-hdr-title">Bugs Summary</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Likhne ka haq sirf Super Admin ko — "Viewing as" preview me nahi. */}
              {isSuper && (
                <button className="btn-primary bm-add-btn" onClick={() => openBugForm(null)}>
                  <i className="fa-solid fa-plus" /> Add New Bug
                </button>
              )}
              <div className="bi-period-bar">
                <span className="bi-period-lbl">PERIOD:</span>
                <select className="bi-period-sel" value={bugPeriod} onChange={(e) => setBugPeriod(e.target.value)}>
                  {BI_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="bi-grid" style={{ marginBottom: 28 }}>
            <BiCard tone="red" icon="fa-bug" label="Total Bug(s)" val={bugCards.total} date={today} hi="red" hiText="reported" pre="Total bugs " post={` — ${biLabel(bugPeriod)}`} onReport={() => showBugReport(BUG_SCOPE.all)} />
            <BiCard tone="green" icon="fa-circle-check" label="Total Resolved Bug(s)" val={bugCards.resolved} date={today} hi="green" hiText="resolved & closed" pre="Bugs successfully " post={` — ${biLabel(bugPeriod)}`} onReport={() => showBugReport(BUG_STATUS.resolved)} />
            <BiCard tone="orange" icon="fa-clock" label="Total Pending Bug(s)" val={bugCards.pending} date={today} hi="orange" hiText="awaiting resolution" pre="Bugs currently " post={` — ${biLabel(bugPeriod)}`} onReport={() => showBugReport(BUG_SCOPE.open)} />
          </div>

          {/* ─── BUG REPORTS (all entries) ─── */}
          <div ref={bugTableRef} style={{ scrollMarginTop: 16 }}>
          <BugReportsSection rows={bugStats.rows} periodLabel={biLabel(bugPeriod)}
            scope={bugScope} onScope={setBugScope}
            schoolName={(id) => (branchNames && branchNames[id]) || ''}
            canEdit={isSuper} loading={bugsBusy} error={bugsErr} onRetry={reloadBugs}
            onEdit={openBugForm} onChanged={reloadBugs} toast={toast} />
          </div>
          {bugForm && (
            <BugFormModal bug={bugForm} schools={bugSchools} toast={toast}
              onSaved={reloadBugs} onClose={() => setBugForm(null)} />
          )}

          {/* ─── IMPROVEMENTS SUMMARY ─── */}
          <div className="section-hdr" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="section-hdr-icon" style={{ background: 'linear-gradient(135deg,#B45309,#D97706)' }}><i className="fa-solid fa-lightbulb" /></div>
              <div className="section-hdr-title">Improvements Summary</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {isSuper && (
                <button className="btn-primary bm-add-btn" onClick={() => openImpForm(null)}>
                  <i className="fa-solid fa-plus" /> Add Improvement
                </button>
              )}
              <div className="bi-period-bar">
                <span className="bi-period-lbl">PERIOD:</span>
                <select className="bi-period-sel" value={impPeriod} onChange={(e) => setImpPeriod(e.target.value)}>
                  {BI_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="bi-grid" style={{ marginBottom: 28 }}>
            <BiCard tone="blue" icon="fa-arrow-up" label="Total New Improvements" val={impStats.total} date={today} hi="blue" hiText="submitted" pre="New improvements " post={` — ${biLabel(impPeriod)}`} onReport={() => showImpReport(IMP_SCOPE.all)} />
            <BiCard tone="green" icon="fa-circle-check" label="Total Completed Improvements" val={impStats.resolved} date={today} hi="green" hiText="completed & deployed" pre="Improvements " post={` — ${biLabel(impPeriod)}`} onReport={() => showImpReport(IMP_STATUS.completed)} />
            <BiCard tone="orange" icon="fa-hourglass-half" label="Total Pending Improvements" val={impStats.pending} date={today} hi="orange" hiText="pending implementation" pre="Improvements " post={` — ${biLabel(impPeriod)}`} onReport={() => showImpReport(IMP_SCOPE.open)} />
          </div>

          {/* ─── IMPROVEMENT REPORTS (all entries) ─── */}
          <div ref={impTableRef} style={{ scrollMarginTop: 16 }}>
          <ImprovementReportsSection rows={impStats.rows} periodLabel={biLabel(impPeriod)}
            scope={impScope} onScope={setImpScope}
            schoolName={(id) => (branchNames && branchNames[id]) || ''}
            canEdit={isSuper} loading={bugsBusy} error={bugsErr} onRetry={reloadBugs}
            onEdit={openImpForm} onChanged={reloadBugs} toast={toast} />
          </div>
          {impForm && (
            <ImprovementFormModal item={impForm} schools={bugSchools} toast={toast}
              onSaved={reloadBugs} onClose={() => setImpForm(null)} />
          )}
        </>
      )}

      {/* ─── CURRENT MONTH DETAILS TABLE ─── */}
      {canPay && (
        <div className="section-card">
          <div className="card-header">
            <div>
              <div className="card-title"><i className="fa-solid fa-table-list" /> Current Month Details</div>
              <div className="card-sub" style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 3 }}>{biLabel(feePeriod)} · Fee Analytics ke period selector se chalti hai</div>
            </div>
            <div className="card-header-right">
              <div className="tbl-show-row">
                Show <select className="tbl-show-sel" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  <option>10</option><option>25</option><option>50</option>
                </select> entries
              </div>
              <div className="tbl-search">
                <i className="fa-solid fa-magnifying-glass" />
                <input type="text" placeholder="Search school..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
            </div>
          </div>
          <div className="tbl-wrap">
            <table className="mentor-table">
              <thead>
                <tr>
                  <th>School Name <i className="fa-solid fa-sort sort-icon" /></th>
                  <th>Previous Dues <i className="fa-solid fa-sort sort-icon" /></th>
                  <th>Fee Challan <i className="fa-solid fa-sort sort-icon" /></th>
                  <th>Fee Discount <i className="fa-solid fa-sort sort-icon" /></th>
                  <th>Receivable <i className="fa-solid fa-sort sort-icon" /></th>
                  <th>Received Amount <i className="fa-solid fa-sort sort-icon" /></th>
                  <th>Total Pending <i className="fa-solid fa-sort sort-icon" /></th>
                </tr>
              </thead>
              <tbody>
                {fee.status === 'error' ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--err)', padding: '24px' }}>
                    <i className="fa-solid fa-triangle-exclamation" /> Fee details unavailable — {feeErr}.
                  </td></tr>
                ) : fee.status !== 'ok' ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: '24px' }}>
                    <i className="fa-solid fa-spinner fa-spin" /> Loading School Payments records…
                  </td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: '24px' }}>
                    {search.trim()
                      ? 'No schools match your search.'
                      : `No challans, receivings or previous dues for ${periodName(feePeriodInfo)}.`}
                  </td></tr>
                ) : pageRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{fmt(r.prevDues)}</td>
                    <td>{fmt(r.challan)}</td>
                    <td>{fmt(r.discount)}</td>
                    <td>{fmt(r.receivable)}</td>
                    <td>{fmt(r.received)}</td>
                    <td>{fmt(r.pending)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL :</td>
                  <td>{fmt(pageTotals.prevDues)}</td>
                  <td>{fmt(pageTotals.challan)}</td>
                  <td>{fmt(pageTotals.discount)}</td>
                  <td>{fmt(pageTotals.receivable)}</td>
                  <td>{fmt(pageTotals.received)}</td>
                  <td>{fmt(pageTotals.pending)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="pag-bar">
            <div className="pag-info">
              {filtered.length === 0 ? 'Showing 0 entries' : `Showing ${start + 1} to ${Math.min(start + pageSize, filtered.length)} of ${filtered.length} entries`}
            </div>
            <div className="pag-btns">
              <button className="pag-btn" disabled={curPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`pag-btn${n === curPage ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className="pag-btn" disabled={curPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SCHOOL DETAILS + USER DETAILS ─── */}
      {canProgress && (
        <div className="detail-2col">
          {/* School Details */}
          <div className="db-detail-card">
            <div className="db-detail-card-hdr">
              <div className="db-detail-card-icon"><i className="fa-solid fa-school" /></div>
              <div className="db-detail-card-title">School Details</div>
            </div>
            {/* Status ke hisaab se (branch directory ka isActive) — Total =
                Active + In Active. Pehle "In Active" yahan 0-login wali list
                thi, jo status nahi, is liye teeno aapas me jud-te nahi thay. */}
            <DetailRow label="Total Schools:" val={progress ? progress.launch.length + progress.erp.length + progress.inactive.length : null} />
            <DetailRow label="In Active Schools:" val={listCount('inactive')} tone="red" />
            <DetailRow label="Active Schools:" val={listCount('active')} tone="green" />
            <DetailRow label="Launch Set-up Schools:" val={listCount('launch')} />
            <DetailRow label="ERP Schools:" val={listCount('erp')} />
          </div>
          {/* User Details */}
          <div className="db-detail-card">
            <div className="db-detail-card-hdr">
              <div className="db-detail-card-icon"><i className="fa-solid fa-users" /></div>
              <div className="db-detail-card-title">User Details</div>
            </div>
            <DetailRow label="Total Active Users:" val={totalStudents + totalStaff} />
            <DetailRow label="Total Staff:" val={totalStaff} />
            <DetailRow label="Total Students:" val={totalStudents} />
          </div>
        </div>
      )}

      {/* Video Details + This Month Progress */}
      {(canVideo || canProgress) && (
        <div className="detail-2col" style={{ marginBottom: 20 }}>
          {/* Video Details */}
          {canVideo && (
            <div className="db-detail-card">
              <div className="db-detail-card-hdr">
                <div className="db-detail-card-icon" style={{ background: 'linear-gradient(135deg,#B91C1C,#DC2626)' }}><i className="fa-solid fa-video" /></div>
                <div className="db-detail-card-title">Video Details</div>
              </div>
              <VideoRow label="Total Videos:" val={d.videos.total} />
              {/* Categories ab E-Tube ki asal categories hain (API ka
                  VideoCategories), pehle saat naam yahan hardcoded thay. */}
              {Object.keys(d.videos.byCat || {}).length === 0 ? (
                <div className="db-detail-row" style={{ color: 'var(--tm)' }}>No video categories yet.</div>
              ) : Object.entries(d.videos.byCat).map(([c, n]) => (
                <VideoRow key={c} label={`${c}:`} val={n} />
              ))}
            </div>
          )}
          {/* This Month Progress */}
          {canProgress && (
            <div className="month-progress-card">
              <div className="db-detail-card-hdr">
                <div className="db-detail-card-icon" style={{ background: 'linear-gradient(135deg,#0F766E,#0D9488)' }}><i className="fa-solid fa-calendar-check" /></div>
                <div className="db-detail-card-title">This Month Progress</div>
              </div>
              <MonthRow label="New Schools in Launch Set-Up Tab:" val={newLaunchThisMonth} tone="blue" />
              <MonthRow label="New Schools in ERP Tab:" val={newErpThisMonth} tone="blue" />
              <MonthRow label="Total New Staff Sign Up:" val={d.staff.newSignup} tone="orange" />
              <MonthRow label="Total New Student Sign Up:" val={d.students.newSignup} tone="red" />
            </div>
          )}
        </div>
      )}

      {schoolReport && (
        <Modal title={schoolReport.title} sub={schoolReport.description} icon="fa-school" large
          bodyStyle={{ padding: 0, background: '#F0F4FF' }} onClose={() => setSchoolReport(null)}
          footer={<>
            <button className="btn-secondary" onClick={() => setSchoolReport(null)}>Close</button>
            <button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print" /> Print / Save</button>
          </>}>
          <div style={{ padding: 20 }}>
            {progressErr ? (
              <div className="db-block" style={{ margin: 0 }}>
                <i className="fa-solid fa-triangle-exclamation" />
                <div className="db-block-ttl">Couldn't load schools</div>
                <div className="db-block-sub">{progressErr.message}</div>
                <button className="db-retry" onClick={loadSchools}>Retry</button>
              </div>
            ) : (progress && !progress.enriched && (schoolReport.key === 'students' || schoolReport.key === 'staff')) ? (
              <div className="db-block" style={{ margin: 0 }}>
                <i className="fa-solid fa-triangle-exclamation" />
                <div className="db-block-ttl">School-wise counts unavailable</div>
                <div className="db-block-sub">The School Status branch report did not load, so per-school students / staff can't be listed.</div>
                <button className="db-retry" onClick={loadSchools}>Retry</button>
              </div>
            ) : (!schoolLists || schoolLists[schoolReport.key] === undefined) ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" /> Loading schools…</div>
            ) : (
              <SchoolListReport title={schoolReport.title} description={schoolReport.description}
                count={schoolLists[schoolReport.key].length}
                rows={schoolLists[schoolReport.key]} />
            )}
          </div>
        </Modal>
      )}

    </div>
  );
}

/* ── small presentational pieces ── */
function FeeCard({ tone, icon, label, val }) {
  return (
    <div className={`fee-card fee-card-${tone}`}>
      <div className="fee-card-lbl">{label}</div>
      <div className="fee-card-val">{val}</div>
      <i className={`fa-solid ${icon} fee-card-icon`} />
    </div>
  );
}

function OvCard({ label, val, sub, badge, icon, onClick }) {
  return (
    <div className="ov-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined} title={onClick ? 'Click to view schools' : undefined}>
      <div className="ov-lbl">{label}</div>
      <div className="ov-val">{fmtOrDash(val)}</div>
      <div className="ov-sub">{sub}</div>
      <div className={`ov-badge ov-badge-${badge}`}><i className={`fa-solid ${icon}`} /></div>
    </div>
  );
}

/* Card ke andar ERP | Launch Setup — wahi jagah jo pehle ek bara number leta
   tha (ov-val ki unchaai), taake card ka size na badle. */
function OvSplit({ tone, erp, launch }) {
  const v = (n) => (n == null ? '—' : fmt(n));
  return (
    <div className={`ov-split ov-split-${tone}`}>
      <div className="ov-split-col"><div className="ov-split-lbl">ERP</div><div className="ov-split-val">{v(erp)}</div></div>
      <div className="ov-split-col"><div className="ov-split-lbl">Launch Setup</div><div className="ov-split-val">{v(launch)}</div></div>
    </div>
  );
}

function UserCard({ label, iconTone, icon, overall, newSignup, signupColor, onClick }) {
  return (
    <div className="user-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined} title={onClick ? 'Click to view school-wise report' : undefined}>
      <div className="user-card-hdr">
        <div className="user-card-lbl">{label}</div>
        <div className={`user-card-icon user-card-icon-${iconTone}`}><i className={`fa-solid ${icon}`} /></div>
      </div>
      <div className="user-card-row">
        <span className="user-card-field">Overall</span>
        <div className="user-card-vals"><span className="user-card-bigval">{fmt(overall)}</span></div>
      </div>
      <div className="user-card-row">
        <span className="user-card-field">New Sign Up <span style={{ fontSize: 10, color: 'var(--brand)' }}>(This Month)</span></span>
        <div className="user-card-vals"><span className="user-card-bigval" style={{ color: signupColor }}>{fmt(newSignup)}</span></div>
      </div>
    </div>
  );
}

function BiCard({ tone, icon, label, val, date, hi, hiText, pre, post, onReport }) {
  return (
    <div className={`bi-card bi-card-${tone}`}>
      <div className={`bi-icon bi-icon-${tone}`}><i className={`fa-solid ${icon}`} /></div>
      <div className="bi-lbl">{label}</div>
      <div className="bi-val">{fmt(val)}</div>
      <div className="bi-sub">{pre}<span className={`hi-${hi}`}>{hiText}</span>{post}</div>
      <div className="bi-date">{date}</div>
      <button className={`bi-btn bi-btn-${tone}`} onClick={onReport}><i className="fa-solid fa-file-lines" /> View Report</button>
    </div>
  );
}

function DetailRow({ label, val, tone }) {
  return (
    <div className="db-detail-row">
      <span className="db-detail-row-lbl">{label}</span>
      <span className={`db-detail-row-val${tone ? ` ${tone}` : ''}`}>{fmtOrDash(val)}</span>
    </div>
  );
}

function VideoRow({ label, val }) {
  return (
    <div className="video-detail-row">
      <span className="video-detail-lbl">{label}</span>
      <span className="video-detail-pill">{fmt(val)}</span>
    </div>
  );
}

function MonthRow({ label, val, tone }) {
  return (
    <div className="month-row">
      <span className="month-row-lbl">{label}</span>
      <span className={`month-row-val month-val-${tone}`}>{fmtOrDash(val)}</span>
    </div>
  );
}
