import React, { useEffect, useMemo, useState } from 'react';
import { fmt } from './dashboardData';
import { DASHBOARD_GATES } from './userMgmtData';
import { fetchDashboard } from './api';

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

const VIDEO_CATS = ['School Mentor', 'Science', 'Technology', 'Business', 'Books', 'Universe', 'History'];

/* "Jun 25, 2026" for the badge dates. */
const todayLabel = () => {
  const d = new Date();
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export default function Dashboard({ toast, users = [], perms = {} }) {
  const [d, setD] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewAs, setViewAs] = useState('');   // '' = Super Admin; else a user id
  const today = todayLabel();

  /* Load the overview through the API service. In mock mode this resolves
     the bundled demo data; once a .NET base URL is configured it calls
     GET /api/superadmin/dashboard. See ./api + SUPERADMIN_API_GUIDE.md. */
  useEffect(() => {
    let on = true;
    setLoadErr(null);
    fetchDashboard()
      .then((res) => { if (on) setD(res); })
      .catch((e) => { if (on) setLoadErr(e); });
    return () => { on = false; };
  }, []);

  /* Fee table source — safe to compute before data arrives. */
  const filtered = useMemo(() => {
    const rows = d?.feeRows || [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [d, search]);

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
    if (!canPay) hidden.push('Fee Analytics');
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
          <div className="page-sub">Platform overview &amp; analytics — June 2026</div>
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
          <div className="section-hdr">
            <div className="section-hdr-icon"><i className="fa-solid fa-chart-bar" /></div>
            <div className="section-hdr-title">Fee Analytics</div>
          </div>
          <div className="fee-grid">
            <FeeCard tone="red"    icon="fa-circle-exclamation" label="Previous Dues"           val={`${fmt(d.feeTotals.prevDues)} PKR`} />
            <FeeCard tone="teal"   icon="fa-file-invoice"       label="Fee Challan This Month"  val={`${fmt(d.feeTotals.challan)} PKR`} />
            <FeeCard tone="orange" icon="fa-percent"            label="Fee Discount This Month" val={`${fmt(d.feeTotals.discount)} PKR`} />
          </div>
          <div className="fee-grid-2">
            <FeeCard tone="slate" icon="fa-percent"           label="Fee Challan After Discount" val={`${fmt(d.feeTotals.receivable)} PKR`} />
            <FeeCard tone="green" icon="fa-money-bill-wave"    label="Fee Received"               val={`${fmt(d.feeTotals.received)} PKR`} />
            <FeeCard tone="red2"  icon="fa-circle-exclamation" label="Total Pending"              val={`${fmt(d.feeTotals.pending)} PKR`} />
          </div>
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
                  <div className="onboard-num-val" style={{ color: 'var(--t1)' }}>{d.onboarding.totalModules}</div>
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
              <select className="bi-period-sel" defaultValue="This Month"><option>This Month</option><option>Last Month</option><option>All Time</option></select>
              <select className="bi-period-sel" defaultValue="June 2026"><option>June 2026</option><option>May 2026</option><option>April 2026</option></select>
            </div>
          </div>
          <div className="bi-grid" style={{ marginBottom: 28 }}>
            <BiCard tone="red"    icon="fa-bug"          label="Total Bug(s)"          val={d.bugs.total}    date={today} hi="red"    hiText="reported"           pre="Total bugs " post=" from 1st of this month to today" onReport={() => toast('Opening bugs report…', 'info')} />
            <BiCard tone="green"  icon="fa-circle-check" label="Total Resolved Bug(s)" val={d.bugs.resolved} date={today} hi="green"  hiText="resolved & closed"  pre="Bugs successfully " post=" this month"                  onReport={() => toast('Opening resolved bugs report…', 'info')} />
            <BiCard tone="orange" icon="fa-clock"        label="Total Pending Bug(s)"  val={d.bugs.pending}  date={today} hi="orange" hiText="awaiting resolution" pre="Bugs currently " post=" this month"                    onReport={() => toast('Opening pending bugs report…', 'info')} />
          </div>

          {/* ─── IMPROVEMENTS SUMMARY ─── */}
          <div className="section-hdr" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="section-hdr-icon" style={{ background: 'linear-gradient(135deg,#B45309,#D97706)' }}><i className="fa-solid fa-lightbulb" /></div>
              <div className="section-hdr-title">Improvements Summary</div>
            </div>
            <div className="bi-period-bar">
              <span className="bi-period-lbl">PERIOD:</span>
              <select className="bi-period-sel" defaultValue="This Month"><option>This Month</option><option>Last Month</option></select>
              <select className="bi-period-sel" defaultValue="June 2026"><option>June 2026</option><option>May 2026</option></select>
            </div>
          </div>
          <div className="bi-grid" style={{ marginBottom: 28 }}>
            <BiCard tone="blue"   icon="fa-arrow-up"       label="Total New Improvements"       val={d.improvements.total}     date={today} hi="blue"   hiText="submitted"              pre="New improvements " post=" this month" onReport={() => toast('Opening improvements report…', 'info')} />
            <BiCard tone="green"  icon="fa-circle-check"   label="Total Completed Improvements" val={d.improvements.completed} date={today} hi="green"  hiText="completed & deployed"   pre="Improvements " post=" this month"      onReport={() => toast('Opening completed improvements report…', 'info')} />
            <BiCard tone="orange" icon="fa-hourglass-half" label="Total Pending Improvements"   val={d.improvements.pending}   date={today} hi="orange" hiText="pending implementation" pre="Improvements " post=" this month"      onReport={() => toast('Opening pending improvements report…', 'info')} />
          </div>
        </>
      )}

      {/* ─── CURRENT MONTH DETAILS TABLE ─── */}
      {canPay && (
        <div className="section-card">
          <div className="card-header">
            <div className="card-title"><i className="fa-solid fa-table-list" /> Current Month Details</div>
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
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: '24px' }}>No schools match your search.</td></tr>
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
              {VIDEO_CATS.map((c) => (
                <VideoRow key={c} label={`${c}:`} val={d.videos.byCat[c] || 0} />
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
