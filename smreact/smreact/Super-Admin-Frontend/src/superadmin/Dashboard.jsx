import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DASHBOARD_GATES } from './userMgmtData';
import { dashboardApi, schoolPermissionsApi, schoolProgressApi } from './api';
import SchoolListReport from './SchoolListReport';
import Pagination from './Pagination';
import { paginate, PAGE_SIZE_OPTIONS } from './pageMath';
import OneLinkOverviewSection, { Modal } from './OneLinkSection';
import { BugFormModal, BugReportsSection, BUG_SCOPE } from './BugManager';
import { ImprovementFormModal, ImprovementReportsSection, IMP_SCOPE } from './ImprovementManager';
import { BUG_STATUS, IMP_STATUS, bugCountsFor, bugRowsFor, sumFeeRows } from './api/services/dashboard';
import { useDashboardData } from './dashboard/useDashboardData';
import { METRIC_BY_ID } from './dashboard/metrics';
import { metricsAffectedBy } from './dashboard/contract';
import { PERIODS, periodLabel, pkToday, monthOfPeriod, monthName } from './dashboard/periods';
import { fmtCount, fmtPKR, fmtAmount, fmtPct, MISSING } from './format';

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD — platform overview (permission-aware)

   DATA RULE (DASHBOARD_DATA_STANDARD.md): every figure on this screen is an
   API value read through the metric registry (dashboard/metrics.js) —
     admin_dashboard      → fee, schools, onboarding, users, bugs, videos,
                            this-month progress
     get_onelink_Report   → 1LINK Overview (OneLinkSection.jsx)
     Inactive / Active Login cards (ERP | Launch Setup) → see loginSplit:
                            per-school ERP logins this month
                            (usertimespend-report) × the school's
                            classification in the branch directory
   The component does NO business arithmetic. A value the API did not send
   is shown as '—' (never 0), and contract problems are listed in a banner.
   Each rendered value carries data-metric="<registry id>" so the API-vs-UI
   tests can read it back from the DOM.

   School-wise drill-down lists (the card modals) are DETAIL data from other
   endpoints, loaded only when a modal opens; if a list's size differs from
   the API card value the modal says so instead of hiding it.

   The "Viewing as" selector previews the dashboard with another admin user's
   menu permissions; Super Admin (default) sees everything.
   ═══════════════════════════════════════════════════════════════════ */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* "Nov 4, 2026" — Pakistan date (same calendar the API counts in). */
const todayLabel = () => { const [y, m, d] = pkToday().split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`; };

const BI_PERIODS = PERIODS;
/* admin_dashboard (the fee source) is CURRENT-MONTH only; Last Month stays
   selectable but shows "not provided by the API" — see metric.periods. */
const FEE_PERIODS = PERIODS.filter((p) => p.id === 'thisMonth' || p.id === 'lastMonth');

/* usertimespend-report is one call per school — at most this many at once. */
const LOGIN_POOL = 6;

/* Card key → the API metric its drill-down list should agree with. */
const LIST_METRIC = {
  active: 'schools.active', erp: 'schools.erp', launch: 'schools.launch',
  students: 'students.total', staff: 'staff.total',
};
/* Cards whose number IS the drill-down list (counted from it) — no API note. */
const CARD_IS_LIST = new Set(['zeroLogin', 'activeLogin']);
const LIST_SOURCE = {
  active: 'branch directory (get-branches-with-permissions)',
  erp: 'branch directory (get-branches-with-permissions)',
  launch: 'branch directory (get-branches-with-permissions)',
  zeroLogin: 'per-school ERP screen time (usertimespend-report)',
  activeLogin: 'per-school ERP screen time (usertimespend-report)',
  students: 'School Status branch report (branch-report)',
  staff: 'School Status branch report (branch-report)',
};

export default function Dashboard({ toast, users = [], perms = {} }) {
  const { status, data, error: loadErr, reload } = useDashboardData();
  const values = useMemo(() => data?.values || {}, [data]);
  const v = (id) => (values[id] === undefined ? null : values[id]);

  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewAs, setViewAs] = useState('');   // '' = Super Admin; else a user id
  const [feePeriod, setFeePeriod] = useState('thisMonth');
  const [schoolReport, setSchoolReport] = useState(null);
  const [bugPeriod, setBugPeriod] = useState('all');
  const [impPeriod, setImpPeriod] = useState('all');
  const today = todayLabel();

  /* ── Drill-down detail data (loaded on demand, never feeds a card) ── */
  const [progress, setProgress] = useState(null);
  const [progressErr, setProgressErr] = useState(null);
  const [monthLogins, setMonthLogins] = useState(null);
  const [branchNames, setBranchNames] = useState(null);

  const schoolsJob = useRef(null);
  const loadSchools = useCallback(() => {
    if (schoolsJob.current) return schoolsJob.current;
    setProgressErr(null);
    schoolsJob.current = dashboardApi.loadSchoolDirectory()
      .then((p) => {
        setProgress(p);
        setBranchNames((cur) => cur || Object.fromEntries([...p.launch, ...p.erp, ...p.inactive].map((s) => [s.id, s.name])));
        return p;
      })
      .catch((e) => { schoolsJob.current = null; setProgressErr(e); return null; });
    return schoolsJob.current;
  }, []);

  /* Each school's ERP logins THIS MONTH (Pakistan time) — only for the two
     login drill-down lists. Failed call → null ("unknown"), not 0. */
  const loginsJob = useRef(null);
  const loadMonthLogins = useCallback((prog) => {
    if (loginsJob.current || !prog) return loginsJob.current;
    const all = [...prog.launch, ...prog.erp, ...prog.inactive];
    const month = pkToday().slice(0, 7);
    const fetchOne = (id) => schoolProgressApi
      .listUserTimeSpendReport({ branchId: id, month, type: 'erp' })
      /* Not a number = unknown (null) → the school is left out of both lists. */
      .then((rep) => (typeof rep?.totalEntries === 'number' && Number.isFinite(rep.totalEntries) ? rep.totalEntries : null));
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

  /* Branch names for the Bug / Improvement tables' "School" column and the
     Add Bug dropdown — one directory call, once. */
  const namesJob = useRef(false);
  const ensureBranchNames = useCallback(() => {
    if (namesJob.current) return;
    namesJob.current = true;
    schoolPermissionsApi.listPermissionBranches()
      .then(({ schools }) => {
        const map = {};
        schools.forEach((s) => { map[s.id] = s.name; });
        setBranchNames((cur) => ({ ...map, ...(cur || {}) }));
      })
      .catch(() => { namesJob.current = false; setBranchNames((cur) => cur || {}); });
  }, []);
  useEffect(() => { ensureBranchNames(); }, [ensureBranchNames]);

  const openSchoolReport = useCallback((key, title, description) => {
    setSchoolReport({ key, title, description });
    loadSchools().then((p) => { if (p && (key === 'zeroLogin' || key === 'activeLogin')) loadMonthLogins(p); });
  }, [loadSchools, loadMonthLogins]);

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
      zeroLogin: monthLogins
        ? all.filter((r) => monthLogins[r.id] === 0).map((r) => ({ ...toRow(r), logins: 0 }))
        : undefined,
      activeLogin: monthLogins
        ? all.filter((r) => monthLogins[r.id] > 0)
          .sort((a, b) => monthLogins[b.id] - monthLogins[a.id])
          .map((r) => ({ ...toRow(r), logins: monthLogins[r.id] }))
        : undefined,
      students: progress.enriched ? all.filter((r) => r.students > 0).map((r) => ({ ...toRow(r), note: `Students: ${r.students}`, qty: r.students })) : undefined,
      staff: progress.enriched ? all.filter((r) => r.staff > 0).map((r) => ({ ...toRow(r), note: `Staff: ${r.staff}`, qty: r.staff })) : undefined,
    };
  }, [progress, monthLogins]);

  /* Inactive / Active Login cards: ERP | Launch Setup. Same records and rule
     as the zeroLogin / activeLogin lists — each school once (directory is
     de-duplicated by id), on the side its branch directory launchSetup says
     (1 = ERP, 0 = Launch Setup), by its ERP logins this month (0 → Inactive,
     ≥1 → Active Login, however many logins). A school whose login call
     failed is counted on neither card (`unknown`). Loaded with the page. */
  useEffect(() => { loadSchools().then((p) => { if (p) loadMonthLogins(p); }); }, [loadSchools, loadMonthLogins]);
  const loginSplit = useMemo(() => {
    if (!progress || !monthLogins) return null;
    const out = { zero: { erp: 0, launch: 0 }, active: { erp: 0, launch: 0 }, unknown: 0 };
    [...progress.launch, ...progress.erp, ...progress.inactive].forEach((r) => {
      const n = monthLogins[r.id];
      if (n == null || (r.setupType !== 'erp' && r.setupType !== 'launch')) { out.unknown += 1; return; }
      out[n > 0 ? 'active' : 'zero'][r.setupType] += 1;
    });
    /* Nothing could be checked → unknown, not "0 schools". */
    return out.unknown && out.unknown === progress.launch.length + progress.erp.length + progress.inactive.length ? null : out;
  }, [progress, monthLogins]);
  const splitTitle = loginSplit?.unknown ? `Click to view schools · ${loginSplit.unknown} school(s) could not be checked` : 'Click to view schools';

  /* ── Bug Manager / Improvement Manager ── */
  const [bugForm, setBugForm] = useState(null);
  const [bugScope, setBugScope] = useState(BUG_SCOPE.all);
  const bugTableRef = useRef(null);
  const showBugReport = useCallback((scope) => {
    setBugScope(scope);
    bugTableRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);
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
  /* After a save: re-fetch admin_dashboard (background) — EVERY card is then
     from that one fresh response, not just the bug list. */
  const reloadBugs = useCallback(async () => {
    setBugsBusy(true);
    setBugsErr(null);
    const r = await reload({ silent: true });
    if (r?.error) setBugsErr(r.error.message || 'Could not refresh bugs');
    setBugsBusy(false);
  }, [reload]);
  const bugSchools = useMemo(() => Object.entries(branchNames || {})
    .map(([id, name]) => ({ id: Number(id), name: name || `Branch ${id}` }))
    .filter((s) => s.id > 0)
    .sort((a, b) => a.name.localeCompare(b.name)), [branchNames]);

  const bugCards = useMemo(() => (data ? bugCountsFor(data.raw, bugPeriod) : {}), [data, bugPeriod]);
  const impCards = useMemo(() => (data ? bugCountsFor(data.raw, impPeriod) : {}), [data, impPeriod]);
  const bugRows = useMemo(() => bugRowsFor(data?.bugList, 'bug', bugPeriod), [data, bugPeriod]);
  const impRows = useMemo(() => bugRowsFor(data?.bugList, 'improvement', impPeriod), [data, impPeriod]);

  /* ── Fee: the API's current-month rows; another month = not provided ── */
  const feeMonth = monthOfPeriod(feePeriod);
  const feeAvailable = METRIC_BY_ID['fee.prevDues'].periods.includes(feePeriod);
  const feeRows = useMemo(() => (feeAvailable && data ? data.feeRows : []), [feeAvailable, data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? feeRows.filter((r) => r.name.toLowerCase().includes(q)) : feeRows;
  }, [feeRows, search]);
  const feeVal = (id) => (feeAvailable ? fmtPKR(v(id)) : MISSING);

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
          <div className="page-sub">Platform overview &amp; analytics — {monthName(monthOfPeriod('thisMonth'))}</div>
        </div>
      </div>
      {viewBar}
    </div>
  );

  if (status === 'error') {
    return (
      <div className="page-content">
        {header}
        <div className="db-block">
          <i className="fa-solid fa-triangle-exclamation" />
          <div className="db-block-ttl">Couldn't load the dashboard</div>
          <div className="db-block-sub">{loadErr?.message || 'The dashboard service is unavailable.'}</div>
          <button className="db-retry" onClick={() => reload()}>
            <i className="fa-solid fa-rotate-right" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (status !== 'ok' || !data) {
    return (
      <div className="page-content">
        {header}
        <div className="db-skeleton">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="db-skel-card" />)}
        </div>
      </div>
    );
  }

  const pg = paginate(filtered.length, page, pageSize);
  const pageRows = filtered.slice(pg.start, pg.end);
  const tableTotals = sumFeeRows(filtered);
  const feeMonthWord = feePeriod === 'lastMonth' ? 'Last Month' : 'This Month';

  const errors = data.violations.filter((x) => x.severity === 'error');
  const warnings = data.violations.filter((x) => x.severity === 'warning');
  const affected = [...new Set(metricsAffectedBy(data.violations))];

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

  /* Drill-down list vs its API card. */
  const report = schoolReport && schoolLists ? schoolLists[schoolReport.key] : undefined;
  let listNote = null;
  if (schoolReport && Array.isArray(report)) {
    const metricId = LIST_METRIC[schoolReport.key];
    const isQty = schoolReport.key === 'students' || schoolReport.key === 'staff';
    const listValue = isQty ? report.reduce((t, r) => t + r.qty, 0) : report.length;
    const apiValue = metricId ? v(metricId) : null;
    if (CARD_IS_LIST.has(schoolReport.key)) {
      listNote = null;
    } else if (!metricId) {
      listNote = `School-wise list from ${LIST_SOURCE[schoolReport.key]}. The dashboard API does not provide this figure, so the card shows “—”.`;
    } else if (apiValue !== listValue) {
      listNote = `This list comes from ${LIST_SOURCE[schoolReport.key]} and totals ${fmtCount(listValue)}; the dashboard API (admin_dashboard) reports ${fmtCount(apiValue)}. The card shows the API value.`;
    }
  }

  return (
    <div className="page-content">
      {header}

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

      {/* API contract problems — never hidden, never turned into 0. */}
      {data.violations.length > 0 && (
        <div className="db-locked" data-testid="contract-banner"
          style={errors.length ? { borderColor: 'rgba(220,38,38,.35)', color: '#B91C1C' } : { borderColor: 'rgba(217,119,6,.35)', color: '#B45309' }}>
          <i className="fa-solid fa-triangle-exclamation" />
          <span>
            {errors.length > 0 && <>Dashboard API returned {errors.length} missing / invalid field{errors.length === 1 ? '' : 's'} — affected values show “—”{affected.length ? ` (${affected.slice(0, 6).join(', ')}${affected.length > 6 ? ', …' : ''})` : ''}. </>}
            {warnings.length > 0 && <>{warnings.length} data warning{warnings.length === 1 ? '' : 's'} from the API (values shown as sent). </>}
            <details style={{ display: 'inline' }}>
              <summary style={{ cursor: 'pointer', display: 'inline' }}>Details</summary>
              <ul style={{ margin: '6px 0 0 16px' }}>
                {data.violations.slice(0, 25).map((x) => <li key={`${x.path}|${x.issue}`}><code>{x.path}</code>: {x.issue}</li>)}
              </ul>
            </details>
          </span>
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
              <select className="bi-period-sel" data-testid="fee-period" value={feePeriod} onChange={(e) => { setFeePeriod(e.target.value); setPage(1); }}>
                {FEE_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="fee-grid">
            <FeeCard tone="red" icon="fa-circle-exclamation" label="Previous Dues" metric="fee.prevDues" val={feeVal('fee.prevDues')} />
            <FeeCard tone="teal" icon="fa-file-invoice" label={`Fee Challan ${feeMonthWord}`} metric="fee.challan" val={feeVal('fee.challan')} />
            <FeeCard tone="orange" icon="fa-percent" label={`Fee Discount ${feeMonthWord}`} metric="fee.discount" val={feeVal('fee.discount')} />
          </div>
          <div className="fee-grid-2">
            <FeeCard tone="slate" icon="fa-percent" label="Fee Challan After Discount" metric="fee.receivable" val={feeVal('fee.receivable')} />
            <FeeCard tone="green" icon="fa-money-bill-wave" label="Fee Received" metric="fee.received" val={feeVal('fee.received')} />
            <FeeCard tone="red2" icon="fa-circle-exclamation" label="Total Pending" metric="fee.pending" val={feeVal('fee.pending')} />
          </div>
          {feeAvailable ? (
            <div className="db-locked db-locked-ok" style={{ marginTop: -8 }}>
              <i className="fa-solid fa-circle-check" />
              <span>{monthName(feeMonth)} — figures exactly as returned by the dashboard API (<b>admin_dashboard ▸ CurrentMonthDetails</b>), summed across {fmtCount(data.feeRows.length)} school{data.feeRows.length === 1 ? '' : 's'}.</span>
            </div>
          ) : (
            <div className="db-locked" data-testid="fee-unavailable" style={{ marginTop: -8, marginBottom: 14 }}>
              <i className="fa-solid fa-circle-info" />
              <span>Fee figures for {monthName(feeMonth)} are not provided by the backend — the dashboard API returns the current month only. They are not recalculated in the browser.</span>
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
          <div className="overview-grid" style={{ marginBottom: 14 }}>
            <OvCard label="Active Schools" metric="schools.active" val={v('schools.active')}
              sub={<><b>↑ <span data-metric="schools.newThisMonth">{fmtCount(v('schools.newThisMonth'))}</span></b> &nbsp;New this month</>} badge="blue" icon="fa-circle-check"
              onClick={() => openSchoolReport('active', 'Active Schools', 'ERP + Launch Set-Up schools')} />
            <OvCard label="ERP Schools" metric="schools.erp" val={v('schools.erp')}
              sub={<><b>↑ <span data-metric="schools.erpNew">{fmtCount(v('schools.erpNew'))}</span></b> &nbsp;New this month</>} badge="teal" icon="fa-database"
              onClick={() => openSchoolReport('erp', 'ERP Schools', 'Active schools running on ERP')} />
            <OvCard label="Launch Set-Up Schools" metric="schools.launch" val={v('schools.launch')}
              sub={<><b>↑ <span data-metric="schools.launchNew">{fmtCount(v('schools.launchNew'))}</span></b> &nbsp;New this month</>} badge="purple" icon="fa-rocket"
              onClick={() => openSchoolReport('launch', 'Launch Set-Up Schools', 'Active schools in launch set-up')} />
          </div>
          <div className="overview-grid" style={{ marginBottom: 28 }}>
            <div className="ov-card" style={{ cursor: 'pointer' }} title={splitTitle}
              onClick={() => openSchoolReport('zeroLogin', 'Inactive Schools', 'Registered schools with 0 ERP logins this month')}>
              <div className="ov-lbl red">Inactive Schools</div>
              <OvSplit tone="red" id="inactive" erp={loginSplit?.zero.erp} launch={loginSplit?.zero.launch} />
              <div className="ov-sub">Registered but <b className="red">0 logins</b> from 1st of this month to today</div>
              <div className="ov-badge ov-badge-red"><i className="fa-solid fa-user-slash" /></div>
            </div>
            <div className="ov-card" style={{ cursor: 'pointer' }} title={splitTitle}
              onClick={() => openSchoolReport('activeLogin', 'Active Login Schools', 'Schools with at least one ERP login this month')}>
              <div className="ov-lbl green">Active Login Schools</div>
              <OvSplit tone="green" id="activeLogin" erp={loginSplit?.active.erp} launch={loginSplit?.active.launch} />
              <div className="ov-sub">Logged in <b style={{ color: '#16A34A' }}>at least once</b> from 1st of this month to today</div>
              <div className="ov-badge ov-badge-green"><i className="fa-solid fa-user-check" /></div>
            </div>
            <div className="onboard-card">
              <div className="ov-lbl">School Onboarding Status</div>
              <div className="onboard-nums">
                <div className="onboard-num-block" style={{ textAlign: 'left' }}>
                  <div className="onboard-num-val" data-metric="onboarding.fullyTrained" style={{ color: 'var(--t1)' }}>{fmtCount(v('onboarding.fullyTrained'))}</div>
                  <div className="onboard-num-lbl">Fully Trained</div>
                </div>
                <div className="onboard-num-divider" />
                <div className="onboard-num-block">
                  <div className="onboard-num-val" data-metric="onboarding.inProcess" style={{ color: 'var(--brand)' }}>{fmtCount(v('onboarding.inProcess'))}</div>
                  <div className="onboard-num-lbl">In Process</div>
                </div>
                <div className="onboard-num-divider" />
                <div className="onboard-num-block" style={{ textAlign: 'right' }}>
                  {/* Not in the admin_dashboard response. */}
                  <div className="onboard-num-val" data-metric-unavailable="onboarding.totalModules" style={{ color: 'var(--t1)' }}>{MISSING}</div>
                  <div className="onboard-num-lbl">Total Modules</div>
                </div>
              </div>
              <div className="onboard-bar"><div className="onboard-bar-fill" style={{ width: `${v('onboarding.pct') ?? 0}%` }} /></div>
              <div className="onboard-progress-row">
                <span>0%</span><span><span data-metric="onboarding.pct">{fmtPct(v('onboarding.pct'))}</span> Complete</span><span>100%</span>
              </div>
            </div>
          </div>

          <div className="detail-2col" style={{ marginBottom: 28 }}>
            <UserCard label="Total Students" iconTone="teal" icon="fa-user-graduate"
              overall={v('students.total')} overallMetric="students.total"
              newSignup={v('students.new')} newMetric="students.new" signupColor="#DC2626"
              onClick={() => openSchoolReport('students', 'Total Students — school wise', 'Students per school')} />
            <UserCard label="Total Staff" iconTone="blue" icon="fa-user-tie"
              overall={v('staff.total')} overallMetric="staff.total"
              newSignup={v('staff.new')} newMetric="staff.new" signupColor="#D97706"
              onClick={() => openSchoolReport('staff', 'Total Staff — school wise', 'Staff per school')} />
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
              {isSuper && (
                <button className="btn-primary bm-add-btn" onClick={() => openBugForm(null)}>
                  <i className="fa-solid fa-plus" /> Add New Bug
                </button>
              )}
              <div className="bi-period-bar">
                <span className="bi-period-lbl">PERIOD:</span>
                <select className="bi-period-sel" data-testid="bug-period" value={bugPeriod} onChange={(e) => setBugPeriod(e.target.value)}>
                  {BI_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="bi-grid" style={{ marginBottom: 28 }}>
            <BiCard tone="red" icon="fa-bug" label="Total Bug(s)" metric="bugs.total" val={bugCards['bugs.total']} date={today} hi="red" hiText="reported" pre="Total bugs " post={` — ${periodLabel(bugPeriod)}`} onReport={() => showBugReport(BUG_SCOPE.all)} />
            <BiCard tone="green" icon="fa-circle-check" label="Total Resolved Bug(s)" metric="bugs.resolved" val={bugCards['bugs.resolved']} date={today} hi="green" hiText="resolved & closed" pre="Bugs successfully " post={` — ${periodLabel(bugPeriod)}`} onReport={() => showBugReport(BUG_STATUS.resolved)} />
            <BiCard tone="orange" icon="fa-clock" label="Total Pending Bug(s)" metric="bugs.pending" val={bugCards['bugs.pending']} date={today} hi="orange" hiText="awaiting resolution" pre="Bugs currently " post={` — ${periodLabel(bugPeriod)}`} onReport={() => showBugReport(BUG_SCOPE.open)} />
          </div>

          <div ref={bugTableRef} style={{ scrollMarginTop: 16 }}>
          <BugReportsSection rows={bugRows} periodLabel={periodLabel(bugPeriod)}
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
                <select className="bi-period-sel" data-testid="imp-period" value={impPeriod} onChange={(e) => setImpPeriod(e.target.value)}>
                  {BI_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="bi-grid" style={{ marginBottom: 28 }}>
            <BiCard tone="blue" icon="fa-arrow-up" label="Total New Improvements" metric="improvements.total" val={impCards['improvements.total']} date={today} hi="blue" hiText="submitted" pre="New improvements " post={` — ${periodLabel(impPeriod)}`} onReport={() => showImpReport(IMP_SCOPE.all)} />
            <BiCard tone="green" icon="fa-circle-check" label="Total Completed Improvements" metric="improvements.completed" val={impCards['improvements.completed']} date={today} hi="green" hiText="completed & deployed" pre="Improvements " post={` — ${periodLabel(impPeriod)}`} onReport={() => showImpReport(IMP_STATUS.completed)} />
            <BiCard tone="orange" icon="fa-hourglass-half" label="Total Pending Improvements" metric="improvements.pending" val={impCards['improvements.pending']} date={today} hi="orange" hiText="pending implementation" pre="Improvements " post={` — ${periodLabel(impPeriod)}`} onReport={() => showImpReport(IMP_SCOPE.open)} />
          </div>

          <div ref={impTableRef} style={{ scrollMarginTop: 16 }}>
          <ImprovementReportsSection rows={impRows} periodLabel={periodLabel(impPeriod)}
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
        <div className="section-card" data-testid="fee-table">
          <div className="card-header">
            <div>
              <div className="card-title"><i className="fa-solid fa-table-list" /> Current Month Details</div>
              <div className="card-sub" style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 3 }}>{periodLabel(feePeriod)} · Fee Analytics ke period selector se chalti hai</div>
            </div>
            <div className="card-header-right">
              <div className="tbl-show-row">
                Show <select className="tbl-show-sel" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
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
                {!feeAvailable ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: '24px' }}>
                    Not provided by the dashboard API for {monthName(feeMonth)}.
                  </td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: '24px' }}>
                    {search.trim() ? 'No schools match your search.' : `No fee rows returned for ${monthName(feeMonth)}.`}
                  </td></tr>
                ) : pageRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.name}</td>
                    <td>{fmtAmount(r.prevDues)}</td>
                    <td>{fmtAmount(r.challan)}</td>
                    <td>{fmtAmount(r.discount)}</td>
                    <td>{fmtAmount(r.receivable)}</td>
                    <td>{fmtAmount(r.received)}</td>
                    <td>{fmtAmount(r.pending)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL :</td>
                  {['prevDues', 'challan', 'discount', 'receivable', 'received', 'pending'].map((k) => (
                    <td key={k} data-fee-total={k}>{feeAvailable ? fmtAmount(tableTotals[k]) : MISSING}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination {...pg} onPageChange={setPage} />
        </div>
      )}

      {/* ─── SCHOOL DETAILS + USER DETAILS ─── */}
      {canProgress && (
        <div className="detail-2col">
          <div className="db-detail-card">
            <div className="db-detail-card-hdr">
              <div className="db-detail-card-icon"><i className="fa-solid fa-school" /></div>
              <div className="db-detail-card-title">School Details</div>
            </div>
            <DetailRow label="Total Schools:" metric="details.totalSchools" val={v('details.totalSchools')} />
            <DetailRow label="In Active Schools:" metric="details.inactiveSchools" val={v('details.inactiveSchools')} tone="red" />
            <DetailRow label="Active Schools:" metric="details.activeSchools" val={v('details.activeSchools')} tone="green" />
            <DetailRow label="Launch Set-up Schools:" metric="details.launchSchools" val={v('details.launchSchools')} />
            <DetailRow label="ERP Schools:" metric="details.erpSchools" val={v('details.erpSchools')} />
          </div>
          <div className="db-detail-card">
            <div className="db-detail-card-hdr">
              <div className="db-detail-card-icon"><i className="fa-solid fa-users" /></div>
              <div className="db-detail-card-title">User Details</div>
            </div>
            <DetailRow label="Total Active Users:" metric="details.totalUsers" val={v('details.totalUsers')} />
            <DetailRow label="Total Staff:" metric="details.totalStaff" val={v('details.totalStaff')} />
            <DetailRow label="Total Students:" metric="details.totalStudents" val={v('details.totalStudents')} />
          </div>
        </div>
      )}

      {(canVideo || canProgress) && (
        <div className="detail-2col" style={{ marginBottom: 20 }}>
          {canVideo && (
            <div className="db-detail-card">
              <div className="db-detail-card-hdr">
                <div className="db-detail-card-icon" style={{ background: 'linear-gradient(135deg,#B91C1C,#DC2626)' }}><i className="fa-solid fa-video" /></div>
                <div className="db-detail-card-title">Video Details</div>
              </div>
              <VideoRow label="Total Videos:" metric="videos.total" val={v('videos.total')} />
              {data.videoCategories.length === 0 ? (
                <div className="db-detail-row" style={{ color: 'var(--tm)' }}>No video categories yet.</div>
              ) : data.videoCategories.map((c) => (
                <VideoRow key={`${c.id}:${c.name}`} label={`${c.name}:`} category={c.name} val={c.count} />
              ))}
            </div>
          )}
          {canProgress && (
            <div className="month-progress-card">
              <div className="db-detail-card-hdr">
                <div className="db-detail-card-icon" style={{ background: 'linear-gradient(135deg,#0F766E,#0D9488)' }}><i className="fa-solid fa-calendar-check" /></div>
                <div className="db-detail-card-title">This Month Progress</div>
              </div>
              <MonthRow label="New Schools in Launch Set-Up Tab:" metric="month.newLaunch" val={v('month.newLaunch')} tone="blue" />
              <MonthRow label="New Schools in ERP Tab:" metric="month.newErp" val={v('month.newErp')} tone="blue" />
              <MonthRow label="Total New Staff Sign Up:" metric="month.newStaff" val={v('month.newStaff')} tone="orange" />
              <MonthRow label="Total New Student Sign Up:" metric="month.newStudents" val={v('month.newStudents')} tone="red" />
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
                <button className="db-retry" onClick={() => openSchoolReport(schoolReport.key, schoolReport.title, schoolReport.description)}>Retry</button>
              </div>
            ) : (progress && !progress.enriched && (schoolReport.key === 'students' || schoolReport.key === 'staff')) ? (
              <div className="db-block" style={{ margin: 0 }}>
                <i className="fa-solid fa-triangle-exclamation" />
                <div className="db-block-ttl">School-wise counts unavailable</div>
                <div className="db-block-sub">The School Status branch report did not load, so per-school students / staff can't be listed.</div>
              </div>
            ) : report === undefined ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" /> Loading schools…</div>
            ) : (
              <>
                {listNote && (
                  <div className="db-locked" data-testid="list-mismatch" style={{ marginBottom: 12 }}>
                    <i className="fa-solid fa-circle-info" /><span>{listNote}</span>
                  </div>
                )}
                <SchoolListReport title={schoolReport.title} description={schoolReport.description}
                  count={report.length} rows={report} />
              </>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
}

/* ── small presentational pieces (values arrive already from the API) ── */
function FeeCard({ tone, icon, label, val, metric }) {
  return (
    <div className={`fee-card fee-card-${tone}`}>
      <div className="fee-card-lbl">{label}</div>
      <div className="fee-card-val" data-metric={metric}>{val}</div>
      <i className={`fa-solid ${icon} fee-card-icon`} />
    </div>
  );
}

function OvCard({ label, labelTone, val, metric, sub, badge, icon, onClick }) {
  return (
    <div className="ov-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined} title={onClick ? 'Click to view schools' : undefined}>
      <div className={`ov-lbl${labelTone ? ` ${labelTone}` : ''}`}>{label}</div>
      <div className="ov-val" data-metric={metric}>{fmtCount(val)}</div>
      <div className="ov-sub">{sub}</div>
      <div className={`ov-badge ov-badge-${badge}`}><i className={`fa-solid ${icon}`} /></div>
    </div>
  );
}

/* ERP | Launch Setup in place of the card's single big number (same height
   as ov-val, so the card does not grow). null → '—', never 0. */
function OvSplit({ tone, id, erp, launch }) {
  return (
    <div className={`ov-split ov-split-${tone}`}>
      <div className="ov-split-col"><div className="ov-split-lbl">ERP</div><div className="ov-split-val" data-split={`${id}.erp`}>{fmtCount(erp)}</div></div>
      <div className="ov-split-col"><div className="ov-split-lbl">Launch Setup</div><div className="ov-split-val" data-split={`${id}.launch`}>{fmtCount(launch)}</div></div>
    </div>
  );
}

function UserCard({ label, iconTone, icon, overall, overallMetric, newSignup, newMetric, signupColor, onClick }) {
  return (
    <div className="user-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined} title={onClick ? 'Click to view school-wise report' : undefined}>
      <div className="user-card-hdr">
        <div className="user-card-lbl">{label}</div>
        <div className={`user-card-icon user-card-icon-${iconTone}`}><i className={`fa-solid ${icon}`} /></div>
      </div>
      <div className="user-card-row">
        <span className="user-card-field">Overall</span>
        <div className="user-card-vals"><span className="user-card-bigval" data-metric={overallMetric}>{fmtCount(overall)}</span></div>
      </div>
      <div className="user-card-row">
        <span className="user-card-field">New Sign Up <span style={{ fontSize: 10, color: 'var(--brand)' }}>(This Month)</span></span>
        <div className="user-card-vals"><span className="user-card-bigval" data-metric={newMetric} style={{ color: signupColor }}>{fmtCount(newSignup)}</span></div>
      </div>
    </div>
  );
}

function BiCard({ tone, icon, label, val, metric, date, hi, hiText, pre, post, onReport }) {
  return (
    <div className={`bi-card bi-card-${tone}`}>
      <div className={`bi-icon bi-icon-${tone}`}><i className={`fa-solid ${icon}`} /></div>
      <div className="bi-lbl">{label}</div>
      <div className="bi-val" data-metric={metric}>{fmtCount(val)}</div>
      <div className="bi-sub">{pre}<span className={`hi-${hi}`}>{hiText}</span>{post}</div>
      <div className="bi-date">{date}</div>
      <button className={`bi-btn bi-btn-${tone}`} onClick={onReport}><i className="fa-solid fa-file-lines" /> View Report</button>
    </div>
  );
}

function DetailRow({ label, val, metric, tone }) {
  return (
    <div className="db-detail-row">
      <span className="db-detail-row-lbl">{label}</span>
      <span className={`db-detail-row-val${tone ? ` ${tone}` : ''}`} data-metric={metric}>{fmtCount(val)}</span>
    </div>
  );
}

function VideoRow({ label, val, metric, category }) {
  return (
    <div className="video-detail-row">
      <span className="video-detail-lbl">{label}</span>
      <span className="video-detail-pill" data-metric={metric} data-video-category={category}>{fmtCount(val)}</span>
    </div>
  );
}

function MonthRow({ label, val, metric, tone }) {
  return (
    <div className="month-row">
      <span className="month-row-lbl">{label}</span>
      <span className={`month-row-val month-val-${tone}`} data-metric={metric}>{fmtCount(val)}</span>
    </div>
  );
}
