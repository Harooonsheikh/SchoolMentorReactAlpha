import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import SuperAdminShell from './SuperAdminShell';
import { adminDashboardToUi, dashboardBugToUi, composeImprovementDetail, IMP_STATUS } from './api/services/dashboard';
import { INITIAL_TRANSACTIONS, calculateSchoolWiseSummary } from './transactionData';
import { isMockMode } from './api';
import { onelinkReportToUi } from './api/services/schoolProgress';
import { feeRowOf, remainingDuesOf } from './api/services/payments';
import { loadSchoolDirectory } from './api/services/dashboard';

/* Dashboard ab hamesha LIVE chalti hai:
   GET .../api/AHM_School_Progress/admin_dashboard. jsdom me koi backend nahi,
   is liye SIRF usi URL ka jawab yahan se de dete hain — baqi har call pehle
   ki tarah fail ho kar apne module ke demo data par gir jati hai. */
const DASHBOARD_PAYLOAD = {
  success: true,
  data: {
    ActiveSchools: 71, ERP_Schools: 38, LaunchSetup_Schools: 33,
    InActiveSchools: 2, Active_Login_Schools: 6,
    TotalStudents: { Overall: 0, NewSignUp: 0 },
    TotalStaff: { Overall: 506, NewSignUp: 2 },
    OnboardingStatus: { FullyTrained: 0, InProcess: 6 },
    BugSummary: { TotalBugs: 6, ResolvedBugs: 2, PendingBugs: 4 },
    Bugs: [
      { ID: 11, BranchID: 1, Module: 'mmm', Developer: 'string string', BugDetail: `[Improvement] improvemment
descriyion
Priority: Medium`, Date: '2026-08-12', IsSolved: false },
      { ID: 7, BranchID: 15, Module: 'Acdemics Module', Developer: 'Qasim', BugDetail: 'Check pleaase leasson plan moudle', Date: '2026-08-10', IsSolved: true },
    ],
    TotalVideos: 1,
    VideoCategories: [{ CategoryID: 1, CategoryName: 'Science Blocks', VideoCount: 1 }],
    ThisMonthProgress: { ERPSchools: 18, LaunchSetupSchools: 29 },
    CurrentMonthDetails: [
      { SchoolName: 'Beacon Public School', PreviousAmount: 0, FeeChallan: 4900, FeeDiscount: 0, Receivable: 4900, ReceivedAmount: 4900, TotalPending: 0 },
    ],
  },
};

/* get_onelink_Report — bilkul sandbox ke asal jawab ki shakal (naam, types,
   "Paid" status, 0-transaction branches samet). */
const ONELINK_PAYLOAD = {
  success: true,
  data: {
    totals: {
      totalCollection: 40.0, totalTransactions: 3, schoolsReceivingPayments: 2, totalEnabledSchools: 46,
      avgTransactionValue: 13.33, customerCharges: 1500.0, providerPayable: 440.0, schoolMentorRevenue: 1060.0,
      customerChargePerTxn: 500.0, providerCostPerTxn: 200.0, marginPerTxn: 300.0,
      fromDate: '2026-11-01T00:00:00', toDate: '2026-11-30T00:00:00',
    },
    branches: [
      { schoolID: 221117, schoolName: 'Airborne Educational System', totalTransactions: 0, totalCollection: 0.0, providerPayable: 0.0, customerCharges: 0.0, schoolMentorRevenue: 0.0 },
      { schoolID: 210813, schoolName: 'Islamia Public School', totalTransactions: 1, totalCollection: 10.0, providerPayable: 40.0, customerCharges: 500.0, schoolMentorRevenue: 460.0 },
      { schoolID: 21, schoolName: 'The Learning School  ( Sir Syed Campus )', totalTransactions: 2, totalCollection: 30.0, providerPayable: 400.0, customerCharges: 1000.0, schoolMentorRevenue: 600.0 },
    ],
    transactions: [
      { schoolID: 210813, schoolName: 'Islamia Public School', txnID: 1, oneLinkRef: '10234020002610141280438', txnDate: '2026-10-14T00:00:00', txnTime: '08:03:50', studentName: 'Testing', admissionNo: null, feeType: 'Online Fee', amount: 10.0, status: 'Paid' },
      { schoolID: 21, schoolName: 'The Learning School  ( Sir Syed Campus )', txnID: 2, oneLinkRef: '10234020022610261289303', txnDate: '2026-10-26T00:00:00', txnTime: '19:47:52', studentName: '', admissionNo: null, feeType: 'Online Fee', amount: 20.0, status: 'Paid' },
      { schoolID: 21, schoolName: 'The Learning School  ( Sir Syed Campus )', txnID: 3, oneLinkRef: '10234020022610261289304', txnDate: '2026-10-27T00:00:00', txnTime: '10:00:00', studentName: 'Ali', admissionNo: '77', feeType: 'Online Fee', amount: 10.0, status: 'Failed' },
    ],
  },
};

let realFetch;

/* jsdom doesn't ship matchMedia or ResizeObserver; recharts + the theme
   boot read them. Polyfill so the QA smoke test isn't a flaky shim chase. */
beforeAll(() => {
  realFetch = global.fetch;
  const okJson = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  global.fetch = (url, opts) => (String(url).includes('admin_dashboard') ? okJson(DASHBOARD_PAYLOAD)
    : String(url).includes('get_onelink_Report') ? okJson(ONELINK_PAYLOAD)
      /* Baqi har route foran 503 — jsdom me network hai hi nahi, aur asli
         fetch ki der se aane wali "Network request failed" kisi AGLE test par
         gir kar use fail kar deti thi. Screen in par apni error state dikhati hai. */
      : Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ success: false, message: 'no network in jsdom' }) }));

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
  }
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
});

afterAll(() => { global.fetch = realFetch; });

/* The interface modules a user can navigate to (sidebar labels). */
const INTERFACE_MODULES = [
  'E-Tube', 'Network Permissions', 'School Permissions', 'Schools Progress', 'Schools Payment',
  'Policy Manuals', 'Mentor AI', 'Support', 'Teachers Training',
  'Quiz Content', 'Notifications', 'User Management',
];

const clickNav = (name) => {
  const sidebar = document.querySelector('.sidebar');
  fireEvent.click(within(sidebar).getByText(name));
};

describe('Super Admin — data layer', () => {
  test('starts in mock mode so the demo works with no backend', () => {
    expect(isMockMode()).toBe(true);
  });

  /* 1LINK ka koi bundled ledger nahi hona chahiye: jab tak backend
     transaction route nahi deta, har aankra 0 dikhta hai — demo payments
     nahi. */
  test('1LINK ships no bundled transaction ledger', () => {
    expect(INITIAL_TRANSACTIONS).toEqual([]);
  });

  /* School-Wise Performance poora network dikhati hai, sirf wo schools nahi
     jinki is period me koi transaction thi. */
  test('school-wise summary zero-fills every school in the roster', () => {
    const roster = [
      { id: 1, name: 'Beacon Public School', schoolCode: '5790', address: 'Chunian' },
      { id: 15, name: "Mughal's System", schoolCode: '1234', address: 'Lahore' },
    ];
    const rows = [{ schoolId: 1, schoolName: 'Beacon Public School', branch: 'Chunian', schoolCode: '5790', amount: 500 }];
    const out = calculateSchoolWiseSummary(rows, { customerCharge: 0, providerCost: 0 }, roster);

    expect(out).toHaveLength(2);                       // dono schools, ek hi ki txn ke bawajood
    expect(out.find((r) => r.schoolId === 1)).toMatchObject({ transactions: 1, collection: 500 });
    expect(out.find((r) => r.schoolId === 15)).toMatchObject({ transactions: 0, collection: 0, smRevenue: 0 });
  });

  /* Improvement ke zaid khane bugDetail ki lineon me — wapas wahi nikalne chahiye. */
  test('improvement detail round-trips through bugDetail', () => {
    const detail = composeImprovementDetail({
      title: 'Faster reports', description: 'Line one\nLine two', category: 'Performance', type: 'Optimization',
      targetDate: '2026-12-01', implementation: 'Step 1\nStep 2 \\ done', outcome: 'Half the load time',
      completionDate: '', completedBy: '', evidence: '', reportedBy: 'Sara', status: IMP_STATUS.progress, priority: 'High',
    });
    const r = dashboardBugToUi({ ID: 3, BranchID: 4, Module: 'Dashboard', Developer: 'Team A', BugDetail: detail, Date: '2026-11-02', IsSolved: false }, 0);
    expect(r).toMatchObject({
      kind: 'improvement', title: 'Faster reports', descriptionText: 'Line one\nLine two', category: 'Performance',
      type: 'Optimization', targetDate: '2026-12-01', implementation: 'Step 1\nStep 2 \\ done', outcome: 'Half the load time',
      reportedBy: 'Sara', priority: 'High', status: IMP_STATUS.progress,
    });
    expect(dashboardBugToUi({ ID: 3, BugDetail: detail, IsSolved: true }, 0).status).toBe(IMP_STATUS.completed);
    // Bug par improvement wale khane nahi padhe jaate.
    expect(dashboardBugToUi({ ID: 4, BugDetail: 'Broken grid\nType: something' }, 0).description).toBe('Type: something');
  });

  /* Jo screen par asal me chalta hai: admin_dashboard ka jawab → wohi shape
     jo Dashboard.jsx padhta hai. */
  test('admin_dashboard response maps onto the dashboard shape', () => {
    const d = adminDashboardToUi(DASHBOARD_PAYLOAD.data);
    const v = d.values;

    expect(v).toMatchObject({
      'schools.active': 71, 'schools.erp': 38, 'schools.launch': 33,
      'details.inactiveSchools': 2,
      'details.totalSchools': 73,                    // ActiveSchools + InActiveSchools
      'schools.erpNew': 18, 'schools.launchNew': 29, // ThisMonthProgress
      'staff.total': 506, 'staff.new': 2,
      'students.total': 0, 'students.new': 0,        // a genuine API 0 stays 0
      'videos.total': 1,
    });
    expect(d.videoCategories).toEqual([{ id: 1, name: 'Science Blocks', count: 1 }]);

    // Fee cards = Σ of the API's CurrentMonthDetails rows (same rows as the table).
    expect(v['fee.challan']).toBe(4900);
    expect(v['fee.received']).toBe(4900);
    expect(d.feeRows[0].name).toBe('Beacon Public School');

    // No "Total Modules" in the API — not in the registry, never invented.
    expect(v['onboarding.totalModules']).toBeUndefined();
    expect(v['onboarding.inProcess']).toBe(6);

    // BugDetail parse: tag, unwan, tafseel aur priority alag alag.
    expect(d.bugList).toHaveLength(2);
    expect(d.bugList[0]).toMatchObject({
      kind: 'improvement', title: 'improvemment', description: 'descriyion',
      priority: 'Medium', solved: false, module: 'mmm',
    });
    expect(d.bugList[1]).toMatchObject({ kind: 'bug', title: 'Check pleaase leasson plan moudle', priority: '', solved: true });
  });
});

describe('Super Admin — shell & modules', () => {
  test('boots on the Dashboard once data loads', async () => {
    render(<SuperAdminShell />);
    expect(await screen.findByText(/Platform overview/i)).toBeInTheDocument();
    // Live-derived figures render (Fee Analytics section present for Super Admin).
    expect(await screen.findByText('Fee Analytics')).toBeInTheDocument();
  });

  test('every interface module renders without crashing', async () => {
    render(<SuperAdminShell />);
    await screen.findByText(/Platform overview/i);
    for (const name of INTERFACE_MODULES) {
      clickNav(name);
      // Each module mounts its own .page-content; reaching here without a
      // thrown render error is the smoke-test pass condition.
      await waitFor(() => expect(document.querySelector('.page-content')).toBeInTheDocument());
    }
  });

  test('returning to the Dashboard re-renders the overview', async () => {
    render(<SuperAdminShell />);
    await screen.findByText(/Platform overview/i);
    clickNav('User Management');
    await screen.findByText(/Manage admin users, assign schools/i);
    const sidebar = document.querySelector('.sidebar');
    fireEvent.click(within(sidebar).getByText('Dashboard'));
    expect(await screen.findByText(/Platform overview/i)).toBeInTheDocument();
  });
});

describe('Super Admin — Bugs / Improvements reports', () => {
  /* Card ke apne "View Report" par click — index se nahi, taake cards ki
     tarteeb badalne par test jhoot na bole. */
  const clickReport = (cardLabel) => {
    const card = screen.getByText(cardLabel).closest('.bi-card');
    fireEvent.click(within(card).getByText(/View Report/i));
  };

  /* Bugs Summary ke teeno "View Report" ab Bug Reports table hi ko us card
     ke status par chhaan dete hain — alag report dataset nahi. Payload me
     ek hi bug hai (Resolved); improvement entry table me kabhi nahi aati. */
  const bugTable = () => within(document.querySelector('.bm-table'));
  test('bug cards filter the Bug Reports table by status', async () => {
    render(<SuperAdminShell />);
    await screen.findByText('Bugs Summary');

    clickReport('Total Resolved Bug(s)');
    expect(await screen.findByText('Resolved Bugs Report')).toBeInTheDocument();
    expect(bugTable().getByText('Check pleaase leasson plan moudle')).toBeInTheDocument();

    clickReport('Total Pending Bug(s)');
    expect(await screen.findByText('Pending Bugs Report')).toBeInTheDocument();
    expect(bugTable().queryByText('Check pleaase leasson plan moudle')).not.toBeInTheDocument();
    expect(bugTable().getByText('No bugs match these filters.')).toBeInTheDocument();

    clickReport('Total Bug(s)');
    expect(await screen.findByText('Bug Reports — All Bugs')).toBeInTheDocument();
    expect(bugTable().getByText('Check pleaase leasson plan moudle')).toBeInTheDocument();
    expect(bugTable().queryByText('improvemment')).not.toBeInTheDocument();

    // Clear Filter / Show All daayra wapas sab par.
    clickReport('Total Pending Bug(s)');
    const bugCard = (await screen.findByText('Pending Bugs Report')).closest('.section-card');
    fireEvent.click(within(bugCard).getByText(/Clear Filter \/ Show All/));
    expect(await screen.findByText('Bug Reports — All Bugs')).toBeInTheDocument();
  });

  /* Reopen → wahi record (same ID) update, isSolved false, aur phir
     admin_dashboard dobara (cards + table usi se). */
  test('reopening a bug updates the same record and refreshes the dashboard', async () => {
    const calls = [];
    const prev = global.fetch;
    global.fetch = (url, opts) => {
      calls.push({ url: String(url), body: opts?.body ? JSON.parse(opts.body) : null });
      if (String(url).includes('school-enquiries-bugs-action')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
      }
      return prev(url, opts);
    };
    try {
      render(<SuperAdminShell />);
      await screen.findByText('Bugs Summary');
      // getByRole is bahut bare DOM par seconds leta hai — seedha aria-label.
      const reopen = await waitFor(() => {
        const el = document.querySelector('.bm-table [aria-label="Reopen bug"]');
        if (!el) throw new Error('no reopen action yet');
        return el;
      });
      fireEvent.click(reopen);
      const modal = (await screen.findByText(/Its status will go back to/)).closest('.modal');
      const dashCallsBefore = calls.filter((c) => c.url.includes('admin_dashboard')).length;
      fireEvent.click(modal.querySelector('.modal-foot .btn-primary'));

      await waitFor(() => expect(calls.some((c) => c.url.includes('school-enquiries-bugs-action'))).toBe(true));
      const save = calls.find((c) => c.url.includes('school-enquiries-bugs-action')).body;
      expect(save).toMatchObject({ action: 'update', id: 7, branchID: 15, isSolved: false, module: 'Acdemics Module', developer: 'Qasim' });
      expect(save.bugDetail).toBe('Check pleaase leasson plan moudle');
      await waitFor(() => expect(calls.filter((c) => c.url.includes('admin_dashboard')).length).toBeGreaterThan(dashCallsBefore));
    } finally {
      global.fetch = prev;
    }
  });

  /* Improvement cards ab Improvement Reports table ko chhaante hain. Payload
     me ek improvement hai (Pending, Support wali purani entry) aur ek bug. */
  const impTable = () => within(document.querySelector('.im-table'));
  test('improvement cards are live and filter the Improvement Reports table', async () => {
    render(<SuperAdminShell />);
    await screen.findByText('Improvements Summary');
    const cardVal = (label) => screen.getByText(label).closest('.bi-card').querySelector('.bi-val').textContent;
    expect([cardVal('Total New Improvements'), cardVal('Total Completed Improvements'), cardVal('Total Pending Improvements')]).toEqual(['1', '0', '1']);

    clickReport('Total New Improvements');
    expect(await screen.findByText('Improvement Reports — All Improvements')).toBeInTheDocument();
    expect(impTable().getByText('improvemment')).toBeInTheDocument();
    expect(impTable().queryByText('Check pleaase leasson plan moudle')).not.toBeInTheDocument();

    clickReport('Total Completed Improvements');
    expect(await screen.findByText('Completed Improvements Report')).toBeInTheDocument();
    expect(impTable().getByText('No improvements match these filters.')).toBeInTheDocument();

    clickReport('Total Pending Improvements');
    expect(await screen.findByText('Pending Improvements Report')).toBeInTheDocument();
    expect(impTable().getByText('improvemment')).toBeInTheDocument();
  });

  test('marking an improvement completed updates the same record', async () => {
    const calls = [];
    const prev = global.fetch;
    global.fetch = (url, opts) => {
      calls.push({ url: String(url), body: opts?.body ? JSON.parse(opts.body) : null });
      if (String(url).includes('school-enquiries-bugs-action')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
      }
      return prev(url, opts);
    };
    try {
      render(<SuperAdminShell />);
      await screen.findByText('Improvements Summary');
      const btn = await waitFor(() => {
        const el = document.querySelector('.im-table [aria-label="Mark as completed"]');
        if (!el) throw new Error('no complete action yet');
        return el;
      });
      fireEvent.click(btn);
      const modal = (await screen.findByText(/Completion date and Completed By are filled in/)).closest('.modal');
      fireEvent.click(modal.querySelector('.modal-foot .btn-primary'));

      await waitFor(() => expect(calls.some((c) => c.url.includes('school-enquiries-bugs-action'))).toBe(true));
      const save = calls.find((c) => c.url.includes('school-enquiries-bugs-action')).body;
      expect(save).toMatchObject({ action: 'update', id: 11, branchID: 1, isSolved: true, module: 'mmm' });
      expect(save.bugDetail.startsWith('[Improvement] improvemment\ndescriyion\n')).toBe(true);
      expect(save.bugDetail).toMatch(/\nCompletion Date: \d{4}-\d{2}-\d{2}\n/);
      expect(save.bugDetail.endsWith('\nPriority: Medium')).toBe(true);
      expect(save.bugDetail).not.toMatch(/Status:/);
    } finally {
      global.fetch = prev;
    }
  });
});

describe('Super Admin — Dashboard permission gating', () => {
  const viewAs = (id) => {
    const select = screen.getByText('Super Admin (full access)').closest('select');
    fireEvent.change(select, { target: { value: String(id) } });
  };

  test('a fee-only user hides school sections but keeps Fee Analytics', async () => {
    render(<SuperAdminShell />);
    await screen.findByText('Fee Analytics');
    viewAs(5); // Dua Fatima — perms: Dashboard + School Payments only
    expect(await screen.findByText('Fee Analytics')).toBeInTheDocument();
    expect(screen.queryByText('School Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Video Details')).not.toBeInTheDocument();
  });

  test('a user without the Dashboard menu is fully blocked', async () => {
    render(<SuperAdminShell />);
    await screen.findByText('Fee Analytics');
    viewAs(7); // Pakiza Sajid — Dashboard menu inactive
    expect(await screen.findByText(/has no Dashboard access/i)).toBeInTheDocument();
    expect(screen.queryByText('Fee Analytics')).not.toBeInTheDocument();
  });
});

describe('Super Admin — 1LINK Overall Performance', () => {
  /* Live jawab ke naam (txnID / txnDate / txnTime / "Paid") sahi map hon. */
  test('1LINK report maps the live response shape', () => {
    const r = onelinkReportToUi(ONELINK_PAYLOAD.data);
    expect(r.totals).toMatchObject({ totalTransactions: 3, totalCollection: 40, providerPayable: 440, schoolMentorRevenue: 1060, marginPerTxn: 300 });
    expect(r.schoolWise).toHaveLength(3);
    expect(r.transactions[0]).toMatchObject({ txnId: '1', date: '2026-10-14', time: '08:03:50', status: 'Paid', successful: true, admissionNo: '' });
    expect(r.transactions[2]).toMatchObject({ status: 'Failed', successful: false });
  });

  /* Pehle EP.schoolProgress.onelinkReport tha hi nahi — call TypeError par
     girti aur table "No schools loaded yet." dikhati thi. */
  test('school-wise table shows only schools with transactions, server totals, and drills down', async () => {
    render(<SuperAdminShell />);
    const card = (await screen.findByText('School-Wise Performance')).closest('.section-card');
    const t = within(card);
    expect(await t.findByText('Islamia Public School')).toBeInTheDocument();
    expect(t.getByText(/The Learning School/)).toBeInTheDocument();
    expect(t.queryByText('Airborne Educational System')).not.toBeInTheDocument();
    expect(t.queryByText('No schools loaded yet.')).not.toBeInTheDocument();
    // Server ka per-school provider payable (40, flat 200 nahi).
    const islamia = within(t.getByText('Islamia Public School').closest('tr'));
    expect(islamia.getByText('PKR 40.00')).toBeInTheDocument();
    expect(islamia.getByText('PKR 460.00')).toBeInTheDocument();
    expect(t.getByText(/TOTALS \(2 schools\)/)).toBeInTheDocument();

    // Successful = sirf "Paid" (Failed wali nahi): 2 of 3.
    const succ = screen.getByText('Successful Transactions').closest('.rpt-stat');
    expect(within(succ).getByText('2')).toBeInTheDocument();
    const total = screen.getByText('Total Transactions').closest('.rpt-stat');
    expect(within(total).getByText('3')).toBeInTheDocument();

    // Search by ID.
    fireEvent.change(t.getByPlaceholderText(/Search by school name, ID or branch/), { target: { value: '210813' } });
    expect(t.queryByText(/The Learning School/)).not.toBeInTheDocument();

    // Row click → transaction detail with real date / time / Txn ID.
    fireEvent.click(t.getByText('Islamia Public School'));
    const modal = within((await screen.findByText('10234020002610141280438')).closest('.modal'));
    expect(modal.getByText('2026-10-14')).toBeInTheDocument();
    expect(modal.getByText('08:03:50')).toBeInTheDocument();
    expect(modal.getByText('Paid')).toBeInTheDocument();
  });
});

describe('Dashboard data audit — shared fee rule & school directory', () => {
  /* Challan ka `total` me pichhle dues pehle se jude hote hain (Generate
     Challan = monthly + prevDues). Fee line sirf `monthly` ko challan ginti
     hai — warna previous dues do baar jud jate thay (837,067 vs 615,421). */
  test('feeRowOf counts the challan monthly charge, not its total', () => {
    const row = feeRowOf({
      prevDues: 1500,
      challan: { monthly: 1500, total: 3000 },
      recv: { discount: 200, receivedAmount: 1000 },
    });
    expect(row).toEqual({ prevDues: 1500, challan: 1500, discount: 200, received: 1000, receivable: 2800, pending: 1800 });
  });

  test('remainingDuesOf: no challan → 0, unpaid → total, received → remaining', () => {
    expect(remainingDuesOf(null, null)).toBe(0);
    expect(remainingDuesOf({ total: 2500 }, null)).toBe(2500);
    expect(remainingDuesOf({ total: 2500 }, { remainingAmount: 300 })).toBe(300);
    expect(remainingDuesOf({ total: 2500 }, { remainingAmount: -50 })).toBe(0);
  });

  test('loadSchoolDirectory classifies by directory isActive + launchSetup and keeps branches missing from branch-report', async () => {
    const prev = global.fetch;
    const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    const br = (id, name) => ({ branchID: id, branchName: name, totalStudents: 10, totalStaff: 2, generalDetails: { createdAt: '5/20/2026 4:11:12 PM' }, stateDetails: {}, compulsionDetails: {} });
    global.fetch = (url) => {
      const u = String(url);
      if (u.includes('get-branches-with-permissions')) {
        return ok([
          { branch: { id: 1, name: 'ERP Active', isActive: true, launchSetup: 1, createdAt: '2026-05-20T10:00:00' } },
          { branch: { id: 2, name: 'Launch Active', isActive: true, launchSetup: 0, createdAt: '2026-06-01T10:00:00' } },
          { branch: { id: 3, name: 'ERP Inactive', isActive: false, launchSetup: 1, createdAt: '2026-06-01T10:00:00' } },
          { branch: { id: 4, name: 'Not In Report', isActive: true, launchSetup: 1, createdAt: '2026-06-01T10:00:00' } },
        ]);
      }
      if (u.includes('branch-report')) {
        if (u.includes('isActive=false')) return ok({ data: [br(3, 'ERP Inactive')] });
        return ok({ data: u.includes('launchSetup=1') ? [br(1, 'ERP Active')] : [br(2, 'Launch Active')] });
      }
      return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
    };
    try {
      const d = await loadSchoolDirectory();
      expect(d.erp.map((r) => r.id)).toEqual([1, 4]);
      expect(d.launch.map((r) => r.id)).toEqual([2]);
      expect(d.inactive).toEqual([expect.objectContaining({ id: 3, setupType: 'erp' })]);
      expect(d.enriched).toBe(true);
      expect(d.erp.find((r) => r.id === 4).students).toBe(0);
    } finally {
      global.fetch = prev;
    }
  });
});
