/* ════════════════════════════════════════════════════════════════════
   DASHBOARD METRIC REGISTRY — the ONE place that says which API field feeds
   which dashboard value.  (Standard: ../../../DASHBOARD_DATA_STANDARD.md)

   Every number the Dashboard renders has an entry here. The entry declares:
     id       stable key; the rendered value element carries data-metric={id}
     label    the card / row label as shown on screen
     source   which endpoint (SOURCES key) supplies it
     spec     HOW the value is read from that endpoint's raw `data` — a
              declarative spec, never a free-form function:
                { path: 'A.B' }                    → the field itself
                { sum: 'Rows', field: 'X' }        → Σ Rows[].X  (aggregation)
                { add: ['A', 'B'] }                → A + B       (aggregation)
                { pct: 'A', of: ['A', 'B'] }       → round(A / (A+B) × 100)
                { count: 'Bugs', kind, status }    → number of API records
                { count: 'transactions', successful: true }
     format   'count' | 'pkr' | 'amount' | 'pct'  (see ../format.js)
     periods  (optional) filter values this metric is valid for. Outside them
              the screen shows "not provided by the API" instead of a number.
     derived  true when the spec is anything other than a plain `path` — these
              are the only arithmetic the frontend is allowed to do, and each
              is listed in the standard as a backend follow-up.

   The data layer (evaluateMetric) and the API-vs-UI test utility
   (./testing/verifyMetrics) BOTH read these specs — but implement them
   independently, so a mapping bug in one shows up as a test failure.
   ════════════════════════════════════════════════════════════════════ */

export const SOURCES = {
  adminDashboard: 'GET /SchoolMentorSuperAdminAPI/api/AHM_School_Progress/admin_dashboard',
  onelinkReport: 'GET /SchoolMentorSuperAdminAPI/api/AHM_School_Progress/get_onelink_Report?fromDate&toDate',
};

const fee = (id, label, field) => ({
  id, label, section: 'Fee Analytics', source: 'adminDashboard',
  spec: { sum: 'CurrentMonthDetails', field }, format: 'pkr', periods: ['thisMonth'], derived: true,
});

const bug = (id, label, kind, status) => ({
  id, label, section: kind === 'bug' ? 'Bugs Summary' : 'Improvements Summary', source: 'adminDashboard',
  spec: { count: 'Bugs', kind, status }, format: 'count', derived: true, periodFiltered: true,
});

const ol = (id, label, path, format) => ({ id, label, section: '1LINK Overview', source: 'onelinkReport', spec: { path }, format });

export const DASHBOARD_METRICS = [
  /* ── Fee Analytics — Σ of the API's own per-school rows (admin_dashboard is
     current-month only; it has no period parameter). ── */
  fee('fee.prevDues', 'Previous Dues', 'PreviousAmount'),
  fee('fee.challan', 'Fee Challan This Month', 'FeeChallan'),
  fee('fee.discount', 'Fee Discount This Month', 'FeeDiscount'),
  fee('fee.receivable', 'Fee Challan After Discount', 'Receivable'),
  fee('fee.received', 'Fee Received', 'ReceivedAmount'),
  fee('fee.pending', 'Total Pending', 'TotalPending'),

  /* ── School Overview ── */
  { id: 'schools.active', label: 'Active Schools', section: 'School Overview', source: 'adminDashboard', spec: { path: 'ActiveSchools' }, format: 'count' },
  { id: 'schools.newThisMonth', label: 'Active Schools — New this month', section: 'School Overview', source: 'adminDashboard', spec: { add: ['ThisMonthProgress.ERPSchools', 'ThisMonthProgress.LaunchSetupSchools'] }, format: 'count', derived: true },
  { id: 'schools.erp', label: 'ERP Schools', section: 'School Overview', source: 'adminDashboard', spec: { path: 'ERP_Schools' }, format: 'count' },
  { id: 'schools.erpNew', label: 'ERP Schools — New this month', section: 'School Overview', source: 'adminDashboard', spec: { path: 'ThisMonthProgress.ERPSchools' }, format: 'count' },
  { id: 'schools.launch', label: 'Launch Set-Up Schools', section: 'School Overview', source: 'adminDashboard', spec: { path: 'LaunchSetup_Schools' }, format: 'count' },
  { id: 'schools.launchNew', label: 'Launch Set-Up Schools — New this month', section: 'School Overview', source: 'adminDashboard', spec: { path: 'ThisMonthProgress.LaunchSetupSchools' }, format: 'count' },
  /* Inactive / Active Login cards are not registry metrics: admin_dashboard has
     no ERP | Launch Setup split, so they are counted per school (Dashboard.jsx
     loginSplit). Active_Login_Schools is therefore not shown. */
  { id: 'onboarding.fullyTrained', label: 'Fully Trained', section: 'School Onboarding Status', source: 'adminDashboard', spec: { path: 'OnboardingStatus.FullyTrained' }, format: 'count' },
  { id: 'onboarding.inProcess', label: 'In Process', section: 'School Onboarding Status', source: 'adminDashboard', spec: { path: 'OnboardingStatus.InProcess' }, format: 'count' },
  { id: 'onboarding.pct', label: '% Complete', section: 'School Onboarding Status', source: 'adminDashboard', spec: { pct: 'OnboardingStatus.FullyTrained', of: ['OnboardingStatus.FullyTrained', 'OnboardingStatus.InProcess'] }, format: 'pct', derived: true },

  /* ── Students / Staff ── */
  { id: 'students.total', label: 'Total Students — Overall', section: 'Users', source: 'adminDashboard', spec: { path: 'TotalStudents.Overall' }, format: 'count' },
  { id: 'students.new', label: 'Total Students — New Sign Up', section: 'Users', source: 'adminDashboard', spec: { path: 'TotalStudents.NewSignUp' }, format: 'count' },
  { id: 'staff.total', label: 'Total Staff — Overall', section: 'Users', source: 'adminDashboard', spec: { path: 'TotalStaff.Overall' }, format: 'count' },
  { id: 'staff.new', label: 'Total Staff — New Sign Up', section: 'Users', source: 'adminDashboard', spec: { path: 'TotalStaff.NewSignUp' }, format: 'count' },

  /* ── Bugs / Improvements — counts of the API's own `Bugs` records. The
     backend has no "kind" column (improvements are tagged "[Improvement]" in
     BugDetail by this app), so the split is done here and checked against
     BugSummary — see validateBugInvariant(). ── */
  bug('bugs.total', 'Total Bug(s)', 'bug', 'all'),
  bug('bugs.resolved', 'Total Resolved Bug(s)', 'bug', 'solved'),
  bug('bugs.pending', 'Total Pending Bug(s)', 'bug', 'open'),
  bug('improvements.total', 'Total New Improvements', 'improvement', 'all'),
  bug('improvements.completed', 'Total Completed Improvements', 'improvement', 'solved'),
  bug('improvements.pending', 'Total Pending Improvements', 'improvement', 'open'),

  /* ── School Details / User Details ── */
  { id: 'details.totalSchools', label: 'Total Schools', section: 'School Details', source: 'adminDashboard', spec: { add: ['ActiveSchools', 'InActiveSchools'] }, format: 'count', derived: true },
  { id: 'details.inactiveSchools', label: 'In Active Schools', section: 'School Details', source: 'adminDashboard', spec: { path: 'InActiveSchools' }, format: 'count' },
  { id: 'details.activeSchools', label: 'Active Schools', section: 'School Details', source: 'adminDashboard', spec: { path: 'ActiveSchools' }, format: 'count' },
  { id: 'details.launchSchools', label: 'Launch Set-up Schools', section: 'School Details', source: 'adminDashboard', spec: { path: 'LaunchSetup_Schools' }, format: 'count' },
  { id: 'details.erpSchools', label: 'ERP Schools', section: 'School Details', source: 'adminDashboard', spec: { path: 'ERP_Schools' }, format: 'count' },
  { id: 'details.totalUsers', label: 'Total Active Users', section: 'User Details', source: 'adminDashboard', spec: { add: ['TotalStudents.Overall', 'TotalStaff.Overall'] }, format: 'count', derived: true },
  { id: 'details.totalStaff', label: 'Total Staff', section: 'User Details', source: 'adminDashboard', spec: { path: 'TotalStaff.Overall' }, format: 'count' },
  { id: 'details.totalStudents', label: 'Total Students', section: 'User Details', source: 'adminDashboard', spec: { path: 'TotalStudents.Overall' }, format: 'count' },

  /* ── Video Details (categories are a list — verified row by row) ── */
  { id: 'videos.total', label: 'Total Videos', section: 'Video Details', source: 'adminDashboard', spec: { path: 'TotalVideos' }, format: 'count' },

  /* ── This Month Progress ── */
  { id: 'month.newLaunch', label: 'New Schools in Launch Set-Up Tab', section: 'This Month Progress', source: 'adminDashboard', spec: { path: 'ThisMonthProgress.LaunchSetupSchools' }, format: 'count' },
  { id: 'month.newErp', label: 'New Schools in ERP Tab', section: 'This Month Progress', source: 'adminDashboard', spec: { path: 'ThisMonthProgress.ERPSchools' }, format: 'count' },
  { id: 'month.newStaff', label: 'Total New Staff Sign Up', section: 'This Month Progress', source: 'adminDashboard', spec: { path: 'TotalStaff.NewSignUp' }, format: 'count' },
  { id: 'month.newStudents', label: 'Total New Student Sign Up', section: 'This Month Progress', source: 'adminDashboard', spec: { path: 'TotalStudents.NewSignUp' }, format: 'count' },

  /* ── 1LINK Overview (period-filtered endpoint) ── */
  ol('onelink.totalTransactions', 'Total Transactions', 'totals.totalTransactions', 'count'),
  ol('onelink.totalCollection', 'Total Collection', 'totals.totalCollection', 'pkr'),
  ol('onelink.schoolsReceiving', 'Schools Receiving Payments', 'totals.schoolsReceivingPayments', 'count'),
  ol('onelink.enabledSchools', 'Schools Receiving Payments — enabled', 'totals.totalEnabledSchools', 'count'),
  ol('onelink.avgTransaction', 'Avg. Transaction Value', 'totals.avgTransactionValue', 'pkr'),
  { id: 'onelink.successful', label: 'Successful Transactions', section: '1LINK Overview', source: 'onelinkReport', spec: { count: 'transactions', successful: true }, format: 'count', derived: true },
  ol('onelink.customerCharges', 'Customer Charges', 'totals.customerCharges', 'pkr'),
  ol('onelink.providerPayable', 'Provider Payable', 'totals.providerPayable', 'pkr'),
  ol('onelink.revenue', 'School Mentor Revenue', 'totals.schoolMentorRevenue', 'pkr'),
  ol('onelink.marginPerTxn', 'Margin / txn', 'totals.marginPerTxn', 'pkr'),
];

export const METRIC_BY_ID = Object.fromEntries(DASHBOARD_METRICS.map((m) => [m.id, m]));
export const metricsFor = (source) => DASHBOARD_METRICS.filter((m) => m.source === source);

/* ── Evaluation (the data layer's implementation of the specs) ─────── */

/** Dotted path read. Returns undefined when any segment is absent. */
export function readPath(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const asNumber = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/* Improvement records are tagged "[Improvement] …" at the start of BugDetail
   (the backend has no kind column). */
export const bugKindOf = (detail) => (/^\s*\[[^\]]*improve[^\]]*\]/i.test(String(detail ?? '')) ? 'improvement' : 'bug');
export const bugSolved = (row) => row?.IsSolved === true || row?.IsSolved === 1;

/**
 * Evaluate one metric spec against an endpoint's raw `data`.
 * @param {Object} spec
 * @param {Object} raw
 * @param {{ inPeriod?: (dateStr:string)=>boolean }} [ctx]
 * @returns {number|null} null = not provided / not computable (never 0 by default)
 */
export function evaluateSpec(spec, raw, ctx = {}) {
  if (!raw || typeof raw !== 'object') return null;
  if (spec.path) return asNumber(readPath(raw, spec.path));
  if (spec.add) {
    const parts = spec.add.map((p) => asNumber(readPath(raw, p)));
    return parts.some((v) => v === null) ? null : parts.reduce((a, b) => a + b, 0);
  }
  if (spec.sum) {
    const rows = readPath(raw, spec.sum);
    if (!Array.isArray(rows)) return null;
    const vals = rows.map((r) => asNumber(r?.[spec.field]));
    return vals.some((v) => v === null) ? null : vals.reduce((a, b) => a + b, 0);
  }
  if (spec.pct) {
    const num = asNumber(readPath(raw, spec.pct));
    const den = spec.of.map((p) => asNumber(readPath(raw, p)));
    if (num === null || den.some((v) => v === null)) return null;
    const total = den.reduce((a, b) => a + b, 0);
    return total === 0 ? null : Math.round((num / total) * 100);
  }
  if (spec.count) {
    const rows = readPath(raw, spec.count);
    if (!Array.isArray(rows)) return null;
    if (spec.successful) return rows.filter((t) => /^(paid|success|successful|completed)$/i.test(String(t?.status ?? '').trim())).length;
    const inPeriod = ctx.inPeriod || (() => true);
    return rows.filter((r) => bugKindOf(r?.BugDetail) === spec.kind
      && inPeriod(String(r?.Date ?? '').slice(0, 10))
      && (spec.status === 'all' || (spec.status === 'solved') === bugSolved(r))).length;
  }
  return null;
}

/** All metrics of one source → { [id]: number|null }. */
export function evaluateSource(source, raw, ctx) {
  const out = {};
  metricsFor(source).forEach((m) => { out[m.id] = evaluateSpec(m.spec, raw, ctx); });
  return out;
}

/** Every raw field path a source's metrics depend on (feeds the contract). */
export function fieldPathsFor(source) {
  const paths = new Set();
  metricsFor(source).forEach(({ spec }) => {
    if (spec.path) paths.add(spec.path);
    (spec.add || []).forEach((p) => paths.add(p));
    if (spec.pct) { paths.add(spec.pct); spec.of.forEach((p) => paths.add(p)); }
  });
  return [...paths];
}
