import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import SuperAdminShell from './SuperAdminShell';
import { buildDashboard } from './dashboardData';
import { isMockMode } from './api';

/* jsdom doesn't ship matchMedia or ResizeObserver; recharts + the theme
   boot read them. Polyfill so the QA smoke test isn't a flaky shim chase. */
beforeAll(() => {
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

  test('dashboard metrics are derived consistently from module data', () => {
    const d = buildDashboard();
    expect(d.schools.total).toBe(d.schools.launch + d.schools.erp + d.schools.inactive);
    expect(d.bugs.total).toBe(d.bugs.resolved + d.bugs.pending);
    expect(d.feeRows.length).toBeGreaterThan(0);
    expect(d.feeTotals.challan).toBeGreaterThan(0);
    expect(d.videos.total).toBeGreaterThanOrEqual(d.videos.ho);
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
