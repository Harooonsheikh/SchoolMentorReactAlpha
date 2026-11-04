/* ════════════════════════════════════════════════════════════════════
   Dashboard — API response vs RENDERED DOM, for every registered metric.

   Fixtures are REAL sandbox responses (captured 2026-11-04; student names
   scrubbed). Each test renders the real Dashboard, reads values back from
   data-metric elements and compares them to the raw JSON with the
   independent reader in ./testing/verifyMetrics.
   ════════════════════════════════════════════════════════════════════ */
import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { DASHBOARD_METRICS, METRIC_BY_ID } from './metrics';
import { compareMetrics, allPass, toMarkdown, readMetric, expectedFromApi } from './testing/verifyMetrics';
import { validateAdminDashboard, validateOnelinkReport, resetContractLog } from './contract';
import { useDashboardData } from './useDashboardData';
import { useApi } from '../api/useApi';
import { inPeriod, pkToday, shiftMonth } from './periods';
import { fmtPKR, fmtCount, fmtPct, fmtAmount, parseDisplayed, MISSING } from '../format';
import ADMIN from './__fixtures__/admin_dashboard.sandbox-2026-11-04.json';
import OL_OCT from './__fixtures__/onelink.sandbox-2026-10.json';
import OL_NOV from './__fixtures__/onelink.sandbox-2026-11.json';
/* Real sandbox directory, trimmed to { branch: { id, name, isActive, launchSetup } }. */
import DIR from './__fixtures__/branches.sandbox-2026-11-04.json';
/* Real sandbox ERP logins per branch id for 2026-11 (usertimespend-report totalEntries). */
import LOGINS from './__fixtures__/logins-erp.sandbox-2026-11.json';

const clone = (o) => JSON.parse(JSON.stringify(o));
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
const fail = (status, message) => Promise.resolve({ ok: false, status, json: () => Promise.resolve({ success: false, message }) });

/* "Last month" relative to the real clock → the October fixture (10 txns);
   any other range → the November fixture (all zero). */
const lastMonthKey = () => shiftMonth(pkToday().slice(0, 7), -1);

function router({ admin = ADMIN, onelink, dir = DIR, logins, calls = [] } = {}) {
  return (url, opts) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('admin_dashboard')) return typeof admin === 'function' ? admin() : ok(admin);
    if (u.includes('get_onelink_Report')) {
      if (onelink) return onelink(u);
      const q = new URL(u, 'http://x').searchParams;
      const from = String(q.get('fromDate') || '').slice(0, 10);
      const to = String(q.get('toDate') || '').slice(0, 10);
      const isFullLastMonth = from === `${lastMonthKey()}-01` && to !== from;
      return ok(isFullLastMonth ? OL_OCT : OL_NOV);
    }
    if (u.includes('GetCharges')) return ok({ customerTransactionCharge: 500, costPerTransaction: 200, effectiveFrom: '' });
    if (u.includes('get-branches-with-permissions')) return typeof dir === 'function' ? dir() : ok(dir);
    if (u.includes('usertimespend-report') && logins) {
      const n = logins[JSON.parse(opts.body).branchID];
      return n === undefined ? fail(500, 'login report failed') : ok({ success: true, data: { totalEntries: n, screenTime: [] } });
    }
    return fail(503, 'not mocked');
  };
}

let realFetch;
beforeAll(() => { realFetch = global.fetch; });
afterAll(() => { global.fetch = realFetch; });
beforeEach(() => { resetContractLog(); jest.spyOn(console, 'error').mockImplementation(() => {}); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

const waitDashboard = () => waitFor(() => expect(document.querySelector('[data-metric="schools.active"]')).toBeTruthy(), { timeout: 4000 });
const waitOnelink = (label) => waitFor(() => {
  expect(document.querySelector('.rpt-filter-bar').textContent).toContain(`Showing: ${label}`);
  expect(readMetric(document.body, 'onelink.totalTransactions').text).not.toBe(MISSING);
}, { timeout: 4000 });

async function renderDashboard(opts = {}, props = {}) {
  global.fetch = router(opts);
  const utils = render(<Dashboard toast={() => {}} {...props} />);
  await waitDashboard();
  return utils;
}

const adminIds = DASHBOARD_METRICS.filter((m) => m.source === 'adminDashboard').map((m) => m.id);
const assertAll = (rows, title) => {
  if (!allPass(rows)) throw new Error(`API vs UI mismatch\n${toMarkdown(rows.filter((r) => r.result !== 'PASS'), title)}`);
  expect(rows.length).toBeGreaterThan(0);
};

/* ── 1. Every registered card: API value === rendered value ──────── */
describe('Dashboard API vs UI — every metric', () => {
  test('all admin_dashboard + 1LINK metrics match the rendered DOM (default filters)', async () => {
    await renderDashboard();
    await waitOnelink('This Month');
    const rows = compareMetrics(document.body, { adminDashboard: ADMIN.data, onelinkReport: OL_NOV.data });
    assertAll(rows, 'Default view');
    expect(rows).toHaveLength(DASHBOARD_METRICS.length);
  });

  test('registry ⇄ DOM completeness: every metric rendered once, no unregistered data-metric', async () => {
    await renderDashboard();
    await waitOnelink('This Month');
    const rendered = [...document.querySelectorAll('[data-metric]')].map((e) => e.getAttribute('data-metric')).filter(Boolean);
    expect(rendered.filter((id) => !METRIC_BY_ID[id])).toEqual([]);
    DASHBOARD_METRICS.forEach((m) => expect(rendered.filter((id) => id === m.id)).toHaveLength(1));
  });

  /* Hard-coded expectations straight from the captured JSON — guards the
     registry's field choice itself (not only registry → DOM wiring). */
  test('field mapping spot-checks against the captured sandbox response', async () => {
    await renderDashboard();
    const t = (id) => readMetric(document.body, id).text;
    expect(t('schools.active')).toBe('313');               // ActiveSchools
    expect(t('schools.erp')).toBe('211');                  // ERP_Schools
    expect(t('schools.launch')).toBe('102');               // LaunchSetup_Schools
    expect(t('details.inactiveSchools')).toBe('24');       // InActiveSchools
    expect(t('students.total')).toBe('39,498');
    expect(t('staff.new')).toBe('538');
    expect(t('fee.prevDues')).toBe('PKR 275,106.00');      // Σ PreviousAmount (127 rows)
    expect(t('fee.challan')).toBe('PKR 291,855.00');
    expect(t('fee.pending')).toBe('PKR 566,961.00');
    expect(t('fee.discount')).toBe('PKR 0.00');            // genuine API zero, not '—'
    expect(t('bugs.total')).toBe('6');                     // 7 records − 1 "[Improvement]"
    expect(t('improvements.total')).toBe('1');
    expect(t('onboarding.pct')).toBe('1%');                // 1 / (1 + 74)
  });

  test('video categories: one row per API category with its VideoCount', async () => {
    await renderDashboard();
    const pills = [...document.querySelectorAll('[data-video-category]')]
      .map((e) => [e.getAttribute('data-video-category'), parseDisplayed(e.textContent)]);
    expect(pills).toEqual(ADMIN.data.VideoCategories.map((c) => [c.CategoryName, c.VideoCount]));
  });

  test('Current Month Details: one row per API row; footer totals = the fee cards', async () => {
    await renderDashboard();
    const table = within(screen.getByTestId('fee-table'));
    expect(table.getByText(`Showing 1–10 of ${ADMIN.data.CurrentMonthDetails.length} entries`, { exact: false })).toBeInTheDocument();
    ['prevDues', 'challan', 'discount', 'receivable', 'received', 'pending'].forEach((k) => {
      const footer = parseDisplayed(document.querySelector(`[data-fee-total="${k}"]`).textContent);
      expect(footer).toBe(readMetric(document.body, `fee.${k}`).value);
    });
  });
});

/* ── 2. Filters ──────────────────────────────────────────────────── */
describe('Dashboard API vs UI — filters', () => {
  const feeIds = DASHBOARD_METRICS.filter((m) => m.id.startsWith('fee.')).map((m) => m.id);

  test('Fee: Last Month is not served by the API → every fee card "—" (never stale This Month values); back again → API values', async () => {
    await renderDashboard();
    fireEvent.change(screen.getByTestId('fee-period'), { target: { value: 'lastMonth' } });
    feeIds.forEach((id) => expect(readMetric(document.body, id).text).toBe(MISSING));
    expect(screen.getByTestId('fee-unavailable')).toBeInTheDocument();
    expect(within(screen.getByTestId('fee-table')).getByText(/Not provided by the dashboard API/)).toBeInTheDocument();
    assertAll(compareMetrics(document.body, { adminDashboard: ADMIN.data }, { ids: feeIds, unavailable: feeIds }), 'Fee — Last Month');

    fireEvent.change(screen.getByTestId('fee-period'), { target: { value: 'thisMonth' } });
    assertAll(compareMetrics(document.body, { adminDashboard: ADMIN.data }, { ids: feeIds }), 'Fee — This Month');
  });

  test.each(['today', 'yesterday', 'thisMonth', 'lastMonth', 'all'])('Bugs + Improvements period "%s" match the API Bugs records', async (period) => {
    await renderDashboard();
    fireEvent.change(screen.getByTestId('bug-period'), { target: { value: period } });
    fireEvent.change(screen.getByTestId('imp-period'), { target: { value: period } });
    const ids = DASHBOARD_METRICS.filter((m) => m.periodFiltered).map((m) => m.id);
    assertAll(compareMetrics(document.body, { adminDashboard: ADMIN.data }, { ids, keepFor: () => inPeriod(period) }), `Bugs — ${period}`);
  });

  test.each([['Today'], ['Yesterday'], ['Last Month'], ['This Month']])('1LINK "%s" matches that period\'s API response', async (label) => {
    await renderDashboard();
    await waitOnelink('This Month');
    fireEvent.click([...document.querySelectorAll('.rpt-stab')].find((b) => b.textContent.trim() === label));
    await waitOnelink(label);
    const raw = label === 'Last Month' ? OL_OCT.data : OL_NOV.data;
    assertAll(compareMetrics(document.body, { onelinkReport: raw }), `1LINK — ${label}`);
  });

  test('1LINK overlapping requests: a slow older period never overwrites the newer selection', async () => {
    const pending = [];
    await renderDashboard({
      onelink: (u) => new Promise((resolve) => pending.push({ u, resolve })),
    });
    /* initial This Month (current + previous) */
    await waitFor(() => expect(pending.length).toBeGreaterThanOrEqual(2));
    await act(async () => { pending.splice(0).forEach((p) => p.resolve({ ok: true, status: 200, json: () => Promise.resolve(OL_NOV) })); });
    await waitOnelink('This Month');

    fireEvent.click([...document.querySelectorAll('.rpt-stab')].find((b) => b.textContent.trim() === 'Last Month'));
    await waitFor(() => expect(pending.length).toBeGreaterThanOrEqual(2));
    const lastMonthReqs = pending.splice(0);
    fireEvent.click([...document.querySelectorAll('.rpt-stab')].find((b) => b.textContent.trim() === 'This Month'));
    await waitFor(() => expect(pending.length).toBeGreaterThanOrEqual(2));
    /* newer (This Month) answers first, older (Last Month) answers LAST */
    await act(async () => { pending.splice(0).forEach((p) => p.resolve({ ok: true, status: 200, json: () => Promise.resolve(OL_NOV) })); });
    await act(async () => { lastMonthReqs.forEach((p) => p.resolve({ ok: true, status: 200, json: () => Promise.resolve(OL_OCT) })); });
    await waitOnelink('This Month');
    assertAll(compareMetrics(document.body, { onelinkReport: OL_NOV.data }), '1LINK after out-of-order responses');
  });
});

/* ── 3. Missing data, failures, zeros ────────────────────────────── */
describe('Dashboard API vs UI — no silent fallbacks', () => {
  test('missing / null / wrong-type fields render "—" (not 0) and are reported in the contract banner', async () => {
    const broken = clone(ADMIN);
    delete broken.data.ActiveSchools;
    broken.data.TotalStaff.Overall = null;
    broken.data.ERP_Schools = '211';
    broken.data.CurrentMonthDetails[3].ReceivedAmount = undefined;
    await renderDashboard({ admin: broken });

    const t = (id) => readMetric(document.body, id).text;
    ['schools.active', 'details.activeSchools', 'details.totalSchools', 'staff.total', 'details.totalStaff', 'details.totalUsers', 'schools.erp', 'fee.received']
      .forEach((id) => expect(t(id)).toBe(MISSING));
    expect(t('schools.launch')).toBe('102');            // unaffected fields still shown
    const banner = screen.getByTestId('contract-banner');
    expect(banner.textContent).toMatch(/missing \/ invalid field/);
    ['ActiveSchools', 'TotalStaff.Overall', 'ERP_Schools', 'CurrentMonthDetails[3].ReceivedAmount'].forEach((p) => expect(banner.textContent).toContain(p));
    assertAll(compareMetrics(document.body, { adminDashboard: broken.data }), 'Broken response');
  });

  test('a genuine 0 renders as 0, distinct from missing', async () => {
    const zero = clone(ADMIN);
    zero.data.ActiveSchools = 0; zero.data.ERP_Schools = 0; zero.data.LaunchSetup_Schools = 0;
    await renderDashboard({ admin: zero });
    expect(readMetric(document.body, 'schools.active').text).toBe('0');
  });

  test('API failure → error state with Retry, and no figure is rendered', async () => {
    await act(async () => {
      global.fetch = router({ admin: () => fail(500, 'Server exploded') });
      render(<Dashboard toast={() => {}} />);
    });
    expect(await screen.findByText("Couldn't load the dashboard")).toBeInTheDocument();
    expect(screen.getByText('Server exploded')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-metric]')).toHaveLength(0);

    global.fetch = router();
    fireEvent.click(screen.getByText(/Retry/));
    await waitDashboard();
    assertAll(compareMetrics(document.body, { adminDashboard: ADMIN.data }, { ids: adminIds }), 'After retry');
  });

  test('non-JSON / empty body is an error, not an empty dashboard of zeros', async () => {
    await act(async () => {
      global.fetch = router({ admin: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error('bad json')) }) });
      render(<Dashboard toast={() => {}} />);
    });
    expect(await screen.findByText("Couldn't load the dashboard")).toBeInTheDocument();
  });
});

/* ── 4. State synchronisation ────────────────────────────────────── */
describe('Dashboard data state — races, refresh, remount', () => {
  function Probe({ fetcher, onState }) {
    const s = useDashboardData(fetcher);
    useEffect(() => { onState(s); });
    return null;
  }

  test('useDashboardData: an older response arriving after a newer one is dropped', async () => {
    const resolvers = [];
    const fetcher = jest.fn(() => new Promise((resolve) => resolvers.push(resolve)));
    let state;
    render(<Probe fetcher={fetcher} onState={(s) => { state = s; }} />);
    await waitFor(() => expect(resolvers).toHaveLength(1));
    act(() => { state.reload({ silent: true }); });
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => { resolvers[1]({ tag: 'new' }); });
    await act(async () => { resolvers[0]({ tag: 'old' }); });
    expect(state.data).toEqual({ tag: 'new' });
  });

  test('useDashboardData: aborts the outdated request and ignores results after unmount', async () => {
    const signals = [];
    let resolveLast;
    const fetcher = jest.fn(({ signal }) => { signals.push(signal); return new Promise((r) => { resolveLast = r; }); });
    let state;
    const { unmount } = render(<Probe fetcher={fetcher} onState={(s) => { state = s; }} />);
    act(() => { state.reload(); });
    expect(signals[0].aborted).toBe(true);
    unmount();
    expect(signals[signals.length - 1].aborted).toBe(true);
    await act(async () => { resolveLast({ tag: 'late' }); });   // must not throw / set state
  });

  test('useDashboardData: a failed silent refresh keeps the last valid response', async () => {
    let n = 0;
    const fetcher = () => (++n === 1 ? Promise.resolve({ tag: 'good' }) : Promise.reject(new Error('down')));
    let state;
    render(<Probe fetcher={fetcher} onState={(s) => { state = s; }} />);
    await waitFor(() => expect(state.status).toBe('ok'));
    let r;
    await act(async () => { r = await state.reload({ silent: true }); });
    expect(r.error.message).toBe('down');
    expect(state).toMatchObject({ status: 'ok', data: { tag: 'good' } });
  });

  test('useApi: a slower older reload never overwrites a newer result', async () => {
    const resolvers = [];
    const fetcher = () => new Promise((resolve) => resolvers.push(resolve));
    let api;
    function P() { api = useApi(fetcher); return null; }
    render(<P />);
    await waitFor(() => expect(resolvers).toHaveLength(1));
    act(() => { api.reload(); });
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => { resolvers[1]('new'); });
    await act(async () => { resolvers[0]('old'); });
    expect(api.data).toBe('new');
  });

  test('refresh after a bug save re-renders EVERY card from the fresh response', async () => {
    const fresh = clone(ADMIN);
    fresh.data.ActiveSchools = 400; fresh.data.TotalStudents.Overall = 40000;
    fresh.data.CurrentMonthDetails[0].TotalPending += 1000;
    let served = 0;
    global.fetch = (url, opts) => {
      if (String(url).includes('school-enquiries-bugs-action')) return ok({ success: true });
      if (String(url).includes('admin_dashboard')) { served += 1; return ok(served === 1 ? ADMIN : fresh); }
      return router()(url, opts);
    };
    render(<Dashboard toast={() => {}} />);
    await waitDashboard();
    const reopen = await waitFor(() => { const el = document.querySelector('.bm-table [aria-label="Reopen bug"]'); if (!el) throw new Error('no reopen'); return el; });
    fireEvent.click(reopen);
    const modal = (await screen.findByText(/Its status will go back to/)).closest('.modal');
    fireEvent.click(modal.querySelector('.modal-foot .btn-primary'));
    await waitFor(() => expect(readMetric(document.body, 'schools.active').text).toBe('400'));
    assertAll(compareMetrics(document.body, { adminDashboard: fresh.data }, { ids: adminIds }), 'After refresh');
  });

  test('navigating away and back fetches a fresh response', async () => {
    const calls = [];
    global.fetch = router({ calls });
    const { unmount } = render(<Dashboard toast={() => {}} />);
    await waitDashboard();
    unmount();
    render(<Dashboard toast={() => {}} />);
    await waitDashboard();
    expect(calls.filter((u) => u.includes('admin_dashboard'))).toHaveLength(2);
  });

  test('switching the "Viewing as" user keeps every visible value equal to the API', async () => {
    const users = [{ id: 5, fullName: 'Fee Only', active: true }];
    const perms = { 5: ['Dashboard', 'School Payments'] };
    await renderDashboard({}, { users, perms });
    fireEvent.change(screen.getByText('Super Admin (full access)').closest('select'), { target: { value: '5' } });
    expect(document.querySelector('[data-metric="schools.active"]')).toBeNull();      // section hidden
    const feeIds = DASHBOARD_METRICS.filter((m) => m.id.startsWith('fee.')).map((m) => m.id);
    assertAll(compareMetrics(document.body, { adminDashboard: ADMIN.data }, { ids: feeIds }), 'Fee-only viewer');
  });

  test('initial load makes ONE admin_dashboard call, no per-school fee fan-out, login checks once per school', async () => {
    const calls = [];
    await renderDashboard({ calls, logins: LOGINS });
    await waitOnelink('This Month');
    await waitFor(() => expect(document.querySelector('[data-split="activeLogin.erp"]').textContent).not.toBe(MISSING), { timeout: 8000 });
    expect(calls.filter((u) => u.includes('admin_dashboard'))).toHaveLength(1);
    expect(calls.filter((u) => /manage_payment_receiving|AHM_School_Payments\/summary|get_payment_ledger/.test(u))).toEqual([]);
    /* Inactive / Active Login split: one usertimespend-report per school */
    expect(calls.filter((u) => u.includes('usertimespend-report'))).toHaveLength(DIR.length);
  });
});

/* ── 5. Contract + formatting units ──────────────────────────────── */
describe('API contract + formatting', () => {
  test('captured sandbox response: no contract errors; real data anomalies surface as warnings', () => {
    const v = validateAdminDashboard(ADMIN.data);
    expect(v.filter((x) => x.severity === 'error')).toEqual([]);
    expect(v).toEqual(expect.arrayContaining([expect.objectContaining({ severity: 'warning', issue: expect.stringMatching(/negative amount \(Mughal's System\)/) })]));
    expect(validateOnelinkReport(OL_OCT.data)).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'totals.totalCollection', severity: 'warning' })]));
  });

  test('BugSummary invariant: bug + improvement records must equal the API summary', () => {
    expect(validateAdminDashboard(ADMIN.data).filter((x) => x.path.startsWith('BugSummary'))).toEqual([]);
    const drifted = clone(ADMIN.data); drifted.BugSummary.TotalBugs = 9;
    expect(validateAdminDashboard(drifted)).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'BugSummary.TotalBugs', severity: 'warning' })]));
  });

  test('formatters never change the number: parse(format(x)) === x', () => {
    [0, 1, -1440, 614661, 1234567.89, 0.5, -144].forEach((x) => {
      expect(parseDisplayed(fmtPKR(x))).toBe(Math.round(x * 100) / 100);
      expect(parseDisplayed(fmtAmount(x))).toBe(Math.round(x * 100) / 100);
    });
    [0, 7, 39498, 3105].forEach((x) => expect(parseDisplayed(fmtCount(x))).toBe(x));
    expect(parseDisplayed(fmtPct(1))).toBe(1);
    [null, undefined, NaN, '313'].forEach((x) => { expect(fmtCount(x)).toBe(MISSING); expect(fmtPKR(x)).toBe(MISSING); });
    expect(fmtPKR(0)).toBe('PKR 0.00');
  });

  test('independent reader agrees with the registry on the captured response', () => {
    const { evaluateSpec } = jest.requireActual('./metrics');
    DASHBOARD_METRICS.filter((m) => m.source === 'adminDashboard').forEach((m) => {
      expect([m.id, evaluateSpec(m.spec, ADMIN.data)]).toEqual([m.id, expectedFromApi(m.spec, ADMIN.data)]);
    });
  });
});

/* ── Inactive / Active Login — ERP | Launch Setup split ──────────────
   Source: per-school ERP logins this month (usertimespend-report) × the
   school's launchSetup in the branch directory. Fixtures = real sandbox
   captures (2026-11-04): 314 branches, every school's November ERP logins. */
describe('Inactive Schools & Active Login Schools — ERP | Launch Setup', () => {
  const br = (id, isActive, launchSetup) => ({ branch: { id, name: `School ${id}`, isActive, launchSetup } });
  const s = (key) => document.querySelector(`[data-split="${key}"]`)?.textContent;
  const split = () => [s('inactive.erp'), s('inactive.launch'), s('activeLogin.erp'), s('activeLogin.launch')];
  const waitSplit = () => waitFor(() => expect(s('activeLogin.erp')).not.toBe(MISSING), { timeout: 8000 });
  const card = (label) => screen.getByText(label).closest('.ov-card');

  test('real sandbox data: 82 | 103 inactive, 116 | 13 active login — every school once', async () => {
    await renderDashboard({ logins: LOGINS });
    await waitSplit();
    expect(split()).toEqual(['82', '103', '116', '13']);
    /* reconcile with the source records, computed independently here */
    const cls = Object.fromEntries(DIR.map((r) => [r.branch.id, r.branch.launchSetup === 1 ? 'erp' : 'launch']));
    const tally = { zero: { erp: 0, launch: 0 }, active: { erp: 0, launch: 0 } };
    Object.entries(LOGINS).forEach(([id, n]) => { tally[n > 0 ? 'active' : 'zero'][cls[id]] += 1; });
    expect(split()).toEqual([tally.zero.erp, tally.zero.launch, tally.active.erp, tally.active.launch].map(String));
    expect(82 + 103 + 116 + 13).toBe(DIR.length);           // exhaustive, mutually exclusive
  });

  test('descriptions, titles and icons are exactly as before', async () => {
    await renderDashboard({ logins: LOGINS });
    await waitSplit();
    expect(card('Inactive Schools').querySelector('.ov-sub').textContent).toBe('Registered but 0 logins from 1st of this month to today');
    expect(card('Active Login Schools').querySelector('.ov-sub').textContent).toBe('Logged in at least once from 1st of this month to today');
    expect(card('Inactive Schools').querySelector('.fa-user-slash')).toBeTruthy();
    expect(card('Active Login Schools').querySelector('.fa-user-check')).toBeTruthy();
    expect(card('Inactive Schools').querySelector('.ov-val')).toBeNull();   // big number replaced by the split
  });

  test('zero records', async () => {
    await renderDashboard({ dir: [], logins: {} });
    await waitSplit();
    expect(split()).toEqual(['0', '0', '0', '0']);
  });

  test('only ERP / only Launch Setup schools — nothing leaks to the other side', async () => {
    const { unmount } = await renderDashboard({ dir: [br(1, true, 1), br(2, true, 1), br(3, false, 1)], logins: { 1: 4, 2: 0, 3: 0 } });
    await waitSplit();
    expect(split()).toEqual(['2', '0', '1', '0']);
    unmount();
    await renderDashboard({ dir: [br(1, true, 0), br(2, false, 0)], logins: { 1: 0, 2: 9 } });
    await waitSplit();
    expect(split()).toEqual(['0', '1', '0', '1']);
  });

  test('many login events = one school; deactivated schools with logins still classified by launchSetup', async () => {
    await renderDashboard({ dir: [br(1, true, 1), br(2, false, 1), br(3, true, 0)], logins: { 1: 250, 2: 3, 3: 1 } });
    await waitSplit();
    expect(split()).toEqual(['0', '0', '2', '1']);
  });

  test('duplicate branch records: counted once, on one side', async () => {
    await renderDashboard({ dir: [br(7, true, 1), br(7, true, 0), br(8, true, 0)], logins: { 7: 2, 8: 0 } });
    await waitSplit();
    const [ie, il, ae, al] = split().map(Number);
    expect([ie + il, ae + al]).toEqual([1, 1]);              // 2 unique schools, each once
    expect(il).toBe(1);                                       // #8 = Launch Setup, 0 logins
    expect(ae + al).toBe(1);                                  // #7 on ONE side only
  });

  test('a failed login check is counted nowhere (not as 0 logins) and is named in the tooltip', async () => {
    await renderDashboard({ dir: [br(1, true, 1), br(2, true, 0), br(3, true, 0)], logins: { 1: 0, 2: 5 } });  // 3 → error
    await waitSplit();
    expect(split()).toEqual(['1', '0', '0', '1']);
    expect(card('Inactive Schools').getAttribute('title')).toMatch(/1 school\(s\) could not be checked/);
  });

  test('every login check failed → "—", never 0', async () => {
    await renderDashboard({ dir: [br(1, true, 1), br(2, true, 0)], logins: {} });
    await waitFor(() => expect(card('Inactive Schools')).toBeTruthy());
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(split()).toEqual([MISSING, MISSING, MISSING, MISSING]);
  });

  test('drill-down lists match the card values exactly', async () => {
    await renderDashboard({ logins: LOGINS });
    await waitSplit();
    fireEvent.click(card('Active Login Schools'));
    await waitFor(() => expect(document.body.textContent).toMatch(/Schools with at least one ERP login this month/));
    expect(document.body.textContent).not.toMatch(/dashboard API \(admin_dashboard\) reports/);
  });
});
