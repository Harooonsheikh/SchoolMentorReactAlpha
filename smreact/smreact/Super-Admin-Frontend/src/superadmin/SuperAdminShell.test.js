import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import SuperAdminShell from './SuperAdminShell';
import { adminDashboardToUi } from './api/services/dashboard';
import { INITIAL_TRANSACTIONS, calculateSchoolWiseSummary } from './transactionData';
import { isMockMode } from './api';

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

let realFetch;

/* jsdom doesn't ship matchMedia or ResizeObserver; recharts + the theme
   boot read them. Polyfill so the QA smoke test isn't a flaky shim chase. */
beforeAll(() => {
  realFetch = global.fetch;
  global.fetch = (url, opts) => (String(url).includes('admin_dashboard')
    ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(DASHBOARD_PAYLOAD) })
    : (realFetch ? realFetch(url, opts) : Promise.reject(new Error('no network in jsdom'))));

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
  'E-Tube', 'School Permissions', 'Schools Progress', 'Schools Payment',
  'Operational SOPs', 'Mentor AI', 'Support', 'Teachers Training',
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

  /* Jo screen par asal me chalta hai: admin_dashboard ka jawab → wohi shape
     jo Dashboard.jsx padhta hai. */
  test('admin_dashboard response maps onto the dashboard shape', () => {
    const d = adminDashboardToUi(DASHBOARD_PAYLOAD.data);

    expect(d.schools).toMatchObject({ active: 71, erp: 38, launch: 33, inactive: 2, activeLogin: 6 });
    expect(d.schools.total).toBe(73);                 // active + inactive
    expect(d.schools.newErp).toBe(18);                // ThisMonthProgress
    expect(d.schools.newLaunch).toBe(29);
    expect(d.staff).toEqual({ total: 506, newSignup: 2 });
    expect(d.students).toEqual({ total: 0, newSignup: 0 });
    expect(d.bugs).toEqual({ total: 6, resolved: 2, pending: 4 });
    expect(d.videos.total).toBe(1);
    expect(d.videos.byCat['Science Blocks']).toBe(1);

    // Fee cards table ka jama hain — dono kabhi alag na batayein.
    expect(d.feeTotals.challan).toBe(4900);
    expect(d.feeTotals.received).toBe(4900);
    expect(d.feeRows[0].name).toBe('Beacon Public School');

    // "Total Modules" API me nahi — banaya nahi jata.
    expect(d.onboarding.totalModules).toBeNull();
    expect(d.onboarding.inProcess).toBe(6);

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

  /* Chhe "View Report" buttons pehle sirf ek toast dikhate thay. Ab har
     button asal report kholta hai, usi `Bugs` list se jo card ne ginin. */
  test('the bugs card opens a real report, not a toast', async () => {
    render(<SuperAdminShell />);
    await screen.findByText('Bugs Summary');

    clickReport('Total Bug(s)');

    // Report ka dhaancha + API se aayi asal row.
    expect(await screen.findByText('Module-wise breakdown')).toBeInTheDocument();
    expect(screen.getByText('Check pleaase leasson plan moudle')).toBeInTheDocument();
    // Module-wise breakdown me bhi, details table me bhi — dono jagah.
    expect(screen.getAllByText('Acdemics Module').length).toBeGreaterThan(1);
    // Improvement wali entry bugs report me nahi aani chahiye.
    expect(screen.queryByText('improvemment')).not.toBeInTheDocument();
  });

  test('the improvements card reports improvements only', async () => {
    render(<SuperAdminShell />);
    await screen.findByText('Improvements Summary');

    clickReport('Total New Improvements');

    expect(await screen.findByText('improvemment')).toBeInTheDocument();
    expect(screen.queryByText('Check pleaase leasson plan moudle')).not.toBeInTheDocument();
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
