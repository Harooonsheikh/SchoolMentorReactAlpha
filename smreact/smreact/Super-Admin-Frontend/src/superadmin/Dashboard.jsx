import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fmt } from './dashboardData';
import { DASHBOARD_GATES } from './userMgmtData';
import { fetchDashboard, schoolPermissionsApi } from './api';
import OneLinkOverviewSection, { Modal } from './OneLinkSection';
import BugsReport from './BugsReport';

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

/* Fee ka apna period bar — yahan "All Time" ka koi matlab nahi (API sirf
   chalte mahine ka fee data deti hai), is liye wo option nahi. */
const FEE_PERIODS = BI_PERIODS.filter((p) => p.id !== 'all');

/* ── Fee Analytics ke chhe card ────────────────────────────────────────
   Faisla (Super Admin ka): ye cards abhi 0 par park hain.

   Wajah yeh hai ke admin_dashboard koi period parameter nahi leta — wo
   hamesha SIRF chalte mahine ka `CurrentMonthDetails` deta hai. Yaani
   Today / Yesterday / Last Month ka fee data mojood hi nahi, aur upar
   lagay period bar ke bawajood cards har arse ka sach nahi bata sakte.
   Aisi soorat me jhoota (ya adhoora) aankra dikhane ke bajaye saaf 0
   dikhaya jata hai.

   JIS DIN backend period-wise fee route de (ya admin_dashboard from/to
   lena shuru kare): sirf yahan `d.feeTotals.<field>` wapas laga dein —
   mapping api/services/dashboard.js me pehle se mojood hai. */
const FEE_CARD_VALUE = 0;

/* ── Improvements Summary ke teen card ────────────────────────────────
   Faisla (Super Admin ka): ye bhi abhi 0 par park hain.

   admin_dashboard me improvements ka apna koi aankra hai hi nahi —
   BugSummary sirf TotalBugs / ResolvedBugs / PendingBugs deti hai, aur
   `Bugs` list me "[Improvement]" tag wali entries bugs ke saath hi
   milti hain. Un se khud gin kar aankra banaya ja sakta hai, magar wo
   API ka apna record nahi — is liye card 0 dikhate hain.

   "View Report" phir bhi asal entries kholta hai (wo API me mojood
   hain), aur jis din API apna improvements block de, sirf yahan wo
   values laga deni hongi. */
const IMPROVEMENT_CARD_VALUE = 0;

/* Local YYYY-MM-DD — toISOString() UTC me badal deta hai, jis se Pakistan
   ke waqt raat ke waqt "Today" ek din peeche chala jata. */
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function inBiPeriod(date, periodId) {
  if (periodId === 'all') return true;
  if (!date) return false;
  const now = new Date();
  if (periodId === 'today') return date === isoOf(now);
  if (periodId === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return date === isoOf(y);
  }
  if (periodId === 'thisMonth') return date.slice(0, 7) === isoOf(now).slice(0, 7);
  if (periodId === 'lastMonth') {
    const l = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.slice(0, 7) === isoOf(l).slice(0, 7);
  }
  return false;
}

/* API ki Bugs list → { total, resolved, pending } for one kind + period.
   `kind` mapping api/services/dashboard.js me hoti hai: jis entry ka
   BugDetail "[Improvement] …" se shuru ho wo improvement hai, baqi bug. */
function countBi(list, kind, periodId) {
  const rows = (list || []).filter((b) => b.kind === kind && inBiPeriod(b.date, periodId));
  const resolved = rows.filter((b) => b.solved).length;
  return { total: rows.length, resolved, pending: rows.length - resolved, rows };
}

/* Card ka "View Report" kis daayre ki report kholta hai. */
const reportRows = (rows, status) => (status === 'resolved' ? rows.filter((r) => r.solved)
  : status === 'pending' ? rows.filter((r) => !r.solved)
    : rows);

export default function Dashboard({ toast, users = [], perms = {} }) {
  const [d, setD] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewAs, setViewAs] = useState('');   // '' = Super Admin; else a user id
  const [feePeriod, setFeePeriod] = useState('thisMonth');
  /* Khuli hui report: { kind, status } — null matlab koi nahi. */
  const [report, setReport] = useState(null);
  /* branchId → school ka naam, report ki "School" column ke liye. Yeh
     directory sirf tab mangwai jati hai jab pehli report khulti hai —
     dashboard ke apne load par ek extra call nahi jati. */
  const [branchNames, setBranchNames] = useState(null);
  /* Default "All Time" — is par cards API ki apni BugSummary dikhate hain. */
  const [bugPeriod, setBugPeriod] = useState('all');
  const [impPeriod, setImpPeriod] = useState('all');
  const today = todayLabel();

  /* Poora overview EK live call se:
     GET .../api/AHM_School_Progress/admin_dashboard (see api/services/dashboard).
     Us call ka mapping wahi shape deta hai jo neeche ka poora JSX padhta hai. */
  useEffect(() => {
    let on = true;
    setLoadErr(null);
    fetchDashboard()
      .then((res) => { if (on) setD(res); })
      .catch((e) => { if (on) setLoadErr(e); });
    return () => { on = false; };
  }, []);

  /* Bugs / Improvements — dono API ki EK hi `Bugs` list se bante hain, kind
     par bant kar aur chune hue arse par chaan kar. (BugSummary bhi jawab me
     aati hai, magar wo all-time hai aur improvements ko bhi bugs me ginti
     hai — is liye cards yeh derived aankre dikhate hain taake dono section
     aapas me mel khayen.) */
  const bugStats = useMemo(() => countBi(d?.bugList, 'bug', bugPeriod), [d, bugPeriod]);
  const impStats = useMemo(() => countBi(d?.bugList, 'improvement', impPeriod), [d, impPeriod]);

  /* Report kholte hi (pehli baar) branch directory — wahi live list jo
     School Permissions screen dikhati hai. Na mile to report BranchID par
     gir jati hai, khulti phir bhi hai. */
  const openReport = useCallback((kind, status) => {
    setReport({ kind, status });
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

  /* Current Month Details ki rows — pehle period, phir search.

     API sirf CHALTE mahine ki rows deti hai (route par koi from/to nahi),
     is liye kisi bhi doosre arse par table khali rehti hai: us arse ka
     record API ke paas hai hi nahi. Purani rows ko "Last Month" ke naam
     se dikhana galat hota. */
  const filtered = useMemo(() => {
    const rows = feePeriod === 'thisMonth' ? (d?.feeRows || []) : [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [d, search, feePeriod]);

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
          <button className="db-retry" onClick={() => { setD(null); setLoadErr(null); fetchDashboard().then(setD).catch(setLoadErr); }}>
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
  const bugCards = bugPeriod === 'all' ? d.bugs : bugStats;

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
            <FeeCard tone="red"    icon="fa-circle-exclamation" label="Previous Dues"           val={`${fmt(FEE_CARD_VALUE)} PKR`} />
            <FeeCard tone="teal"   icon="fa-file-invoice"       label="Fee Challan This Month"  val={`${fmt(FEE_CARD_VALUE)} PKR`} />
            <FeeCard tone="orange" icon="fa-percent"            label="Fee Discount This Month" val={`${fmt(FEE_CARD_VALUE)} PKR`} />
          </div>
          <div className="fee-grid-2">
            <FeeCard tone="slate" icon="fa-percent"           label="Fee Challan After Discount" val={`${fmt(FEE_CARD_VALUE)} PKR`} />
            <FeeCard tone="green" icon="fa-money-bill-wave"    label="Fee Received"               val={`${fmt(FEE_CARD_VALUE)} PKR`} />
            <FeeCard tone="red2"  icon="fa-circle-exclamation" label="Total Pending"              val={`${fmt(FEE_CARD_VALUE)} PKR`} />
          </div>
          {/* Cards 0 kyun hain — screen par bhi likha ho, warna "toota hua"
              lagta hai. Neeche wali table apni asal rows dikhati hai. */}
          <div className="db-locked" style={{ marginTop: -8 }}>
            <i className="fa-solid fa-circle-info" />
            <span>Fee figures are parked at <b>0</b>: <code>admin_dashboard</code> takes no period parameter, so no Today / Yesterday / Last Month fee data exists to report. The Current Month Details table below still lists the current month's rows as the API returns them.</span>
          </div>
        </>
      )}

      {/* ─── 1LINK / 1BILL TRANSACTION MONITORING & REVENUE ─── */}
      {canPay && <OneLinkOverviewSection toast={toast} />}

      {/* ─── SCHOOL OVERVIEW ─── */}
      {canProgress && (
        <>
          <div className="section-hdr">
            <div className="section-hdr-icon"><i className="fa-solid fa-school" /></div>
            <div className="section-hdr-title">School Overview</div>
          </div>
          <div className="overview-grid" style={{ marginBottom: 14 }}>
            <OvCard label="Active Schools"         val={d.schools.active} sub={<><b>↑ {d.schools.newLaunch + d.schools.newErp}</b> &nbsp;New this month</>} badge="blue"   icon="fa-circle-check" />
            <OvCard label="ERP Schools"            val={d.schools.erp}    sub={<><b>↑ {d.schools.newErp}</b> &nbsp;New this month</>}    badge="teal"   icon="fa-database" />
            <OvCard label="Launch Set-Up Schools"  val={d.schools.launch} sub={<><b>↑ {d.schools.newLaunch}</b> &nbsp;New this month</>} badge="purple" icon="fa-rocket" />
          </div>
          <div className="overview-grid" style={{ marginBottom: 28 }}>
            <div className="ov-card">
              <div className="ov-lbl red">Inactive Schools</div>
              <div className="ov-val red">{d.schools.inactive}</div>
              <div className="ov-sub">Registered but <b className="red">0 logins</b> from 1st of this month to today</div>
              <div className="ov-badge ov-badge-red"><i className="fa-solid fa-user-slash" /></div>
            </div>
            <div className="ov-card">
              <div className="ov-lbl green">Active Login Schools</div>
              <div className="ov-val" style={{ color: '#16A34A' }}>{d.schools.activeLogin}</div>
              <div className="ov-sub">Logged in <b style={{ color: '#16A34A' }}>at least once</b> from 1st of this month to today</div>
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
              overall={totalStudents} newSignup={d.students.newSignup} signupColor="#DC2626" />
            <UserCard label="Total Staff" iconTone="blue" icon="fa-user-tie"
              overall={totalStaff} newSignup={d.staff.newSignup} signupColor="#D97706" />
          </div>

          {/* ─── BUGS SUMMARY ─── */}
          <div className="section-hdr" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="section-hdr-icon" style={{ background: 'linear-gradient(135deg,#B91C1C,#DC2626)' }}><i className="fa-solid fa-bug" /></div>
              <div className="section-hdr-title">Bugs Summary</div>
            </div>
            <div className="bi-period-bar">
              <span className="bi-period-lbl">PERIOD:</span>
              <select className="bi-period-sel" value={bugPeriod} onChange={(e) => setBugPeriod(e.target.value)}>
                {BI_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="bi-grid" style={{ marginBottom: 28 }}>
            <BiCard tone="red"    icon="fa-bug"          label="Total Bug(s)"          val={bugCards.total}    date={today} hi="red"    hiText="reported"           pre="Total bugs " post={` — ${biLabel(bugPeriod)}`} onReport={() => openReport('bug', 'all')} />
            <BiCard tone="green"  icon="fa-circle-check" label="Total Resolved Bug(s)" val={bugCards.resolved} date={today} hi="green"  hiText="resolved & closed"  pre="Bugs successfully " post={` — ${biLabel(bugPeriod)}`} onReport={() => openReport('bug', 'resolved')} />
            <BiCard tone="orange" icon="fa-clock"        label="Total Pending Bug(s)"  val={bugCards.pending}  date={today} hi="orange" hiText="awaiting resolution" pre="Bugs currently " post={` — ${biLabel(bugPeriod)}`} onReport={() => openReport('bug', 'pending')} />
          </div>

          {/* ─── IMPROVEMENTS SUMMARY ─── */}
          <div className="section-hdr" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="section-hdr-icon" style={{ background: 'linear-gradient(135deg,#B45309,#D97706)' }}><i className="fa-solid fa-lightbulb" /></div>
              <div className="section-hdr-title">Improvements Summary</div>
            </div>
            <div className="bi-period-bar">
              <span className="bi-period-lbl">PERIOD:</span>
              <select className="bi-period-sel" value={impPeriod} onChange={(e) => setImpPeriod(e.target.value)}>
                {BI_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          {/* Cards 0 kyun hain — screen par bhi likha ho. "View Report"
              phir bhi API ki asal improvement entries kholta hai. */}
          <div className="db-locked" style={{ marginBottom: 10 }}>
            <i className="fa-solid fa-circle-info" />
            <span>Improvement figures are parked at <b>0</b>: <code>admin_dashboard</code> has no improvements block — only <code>BugSummary</code>. Open <b>View Report</b> to see the improvement entries the <code>Bugs</code> list does carry.</span>
          </div>
          <div className="bi-grid" style={{ marginBottom: 28 }}>
            <BiCard tone="blue"   icon="fa-arrow-up"       label="Total New Improvements"       val={IMPROVEMENT_CARD_VALUE}    date={today} hi="blue"   hiText="submitted"              pre="New improvements " post={` — ${biLabel(impPeriod)}`} onReport={() => openReport('improvement', 'all')} />
            <BiCard tone="green"  icon="fa-circle-check"   label="Total Completed Improvements" val={IMPROVEMENT_CARD_VALUE} date={today} hi="green"  hiText="completed & deployed"   pre="Improvements " post={` — ${biLabel(impPeriod)}`} onReport={() => openReport('improvement', 'resolved')} />
            <BiCard tone="orange" icon="fa-hourglass-half" label="Total Pending Improvements"   val={IMPROVEMENT_CARD_VALUE}  date={today} hi="orange" hiText="pending implementation" pre="Improvements " post={` — ${biLabel(impPeriod)}`} onReport={() => openReport('improvement', 'pending')} />
          </div>
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
                {pageRows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: '24px' }}>
                    {feePeriod !== 'thisMonth'
                      ? `The dashboard API only returns the current month — no fee records for ${biLabel(feePeriod)}.`
                      : 'No schools match your search.'}
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
            <DetailRow label="Total Schools:"        val={d.schools.total} />
            <DetailRow label="In Active Schools:"    val={d.schools.inactive} tone="red" />
            <DetailRow label="Active Schools:"       val={d.schools.active} tone="green" />
            <DetailRow label="Launch Set-up Schools:" val={d.schools.launch} />
            <DetailRow label="ERP Schools:"          val={d.schools.erp} />
          </div>
          {/* User Details */}
          <div className="db-detail-card">
            <div className="db-detail-card-hdr">
              <div className="db-detail-card-icon"><i className="fa-solid fa-users" /></div>
              <div className="db-detail-card-title">User Details</div>
            </div>
            <DetailRow label="Total Active Users:" val={totalStudents + totalStaff} />
            <DetailRow label="Total Staff:"        val={totalStaff} />
            <DetailRow label="Total Students:"     val={totalStudents} />
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
              <MonthRow label="New Schools in Launch Set-Up Tab:" val={d.schools.newLaunch} tone="blue" />
              <MonthRow label="New Schools in ERP Tab:"           val={d.schools.newErp}    tone="blue" />
              <MonthRow label="Total New Staff Sign Up:"          val={d.staff.newSignup}   tone="orange" />
              <MonthRow label="Total New Student Sign Up:"        val={d.students.newSignup} tone="red" />
            </div>
          )}
        </div>
      )}

      {/* ─── BUGS / IMPROVEMENTS REPORT ───
          Chhe "View Report" buttons isi ek modal ko kholte hain; kis card se
          khula, wo `report` me hai. Rows wahi hain jo card ne ginin — koi
          alag call nahi jati. */}
      {report && (() => {
        const isBug = report.kind === 'bug';
        const stats = isBug ? bugStats : impStats;
        const periodId = isBug ? bugPeriod : impPeriod;
        const rows = reportRows(stats.rows, report.status);
        return (
          <Modal
            title={`${isBug ? 'Bugs' : 'Improvements'} Report`}
            sub={`${biLabel(periodId)} · ${rows.length} record${rows.length === 1 ? '' : 's'}`}
            icon={isBug ? 'fa-bug' : 'fa-lightbulb'}
            large
            bodyStyle={{ padding: 0, background: '#F0F4FF' }}
            onClose={() => setReport(null)}
            footer={<>
              <button className="btn-secondary" onClick={() => setReport(null)}>Close</button>
              <button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print" /> Print / Save</button>
            </>}
          >
            <div style={{ padding: 20 }}>
              <BugsReport
                kind={report.kind}
                status={report.status}
                period={{ label: biLabel(periodId) }}
                rows={rows}
                allOfKind={stats.rows}
                schoolName={(id) => (branchNames ? branchNames[id] : '') || ''}
              />
            </div>
          </Modal>
        );
      })()}
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

function OvCard({ label, val, sub, badge, icon }) {
  return (
    <div className="ov-card">
      <div className="ov-lbl">{label}</div>
      <div className="ov-val">{fmt(val)}</div>
      <div className="ov-sub">{sub}</div>
      <div className={`ov-badge ov-badge-${badge}`}><i className={`fa-solid ${icon}`} /></div>
    </div>
  );
}

function UserCard({ label, iconTone, icon, overall, newSignup, signupColor }) {
  return (
    <div className="user-card">
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
      <span className={`db-detail-row-val${tone ? ` ${tone}` : ''}`}>{fmt(val)}</span>
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
      <span className={`month-row-val month-val-${tone}`}>{fmt(val)}</span>
    </div>
  );
}
