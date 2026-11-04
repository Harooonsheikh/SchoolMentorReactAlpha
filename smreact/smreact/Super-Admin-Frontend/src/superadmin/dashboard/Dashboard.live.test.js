/* ════════════════════════════════════════════════════════════════════
   LIVE API-vs-UI verification (runtime, real backend).

   Skipped unless DASHBOARD_LIVE_API is set, e.g.
       npm run verify:dashboard                       (uses http://localhost:3001)
       DASHBOARD_LIVE_API=http://localhost:3001 DASHBOARD_REPORT_FILE=report.md
   Requires the dev server (its proxy forwards to the API host).

   Renders the real Dashboard in jsdom, routes every fetch to the live API,
   CAPTURES each raw response, and compares every registered metric's
   rendered DOM value with the captured JSON — for every filter.
   ════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import http from 'http';
import https from 'https';
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { DASHBOARD_METRICS } from './metrics';
import { compareMetrics, toMarkdown, readMetric } from './testing/verifyMetrics';
import { inPeriod } from './periods';
import { getContractLog, resetContractLog } from './contract';
import { MISSING } from '../format';
import { periodFromQuick, periodToRange } from '../transactionData';

const BASE = process.env.DASHBOARD_LIVE_API;
const live = BASE ? describe : describe.skip;
jest.setTimeout(10 * 60 * 1000);

const captured = [];   // { url, status, json, body }
const failures = [];

function liveFetch(url, opts = {}) {
  const abs = /^https?:/i.test(url) ? url : `${BASE}${url}`;
  const lib = abs.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(abs, { method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null; try { json = JSON.parse(text); } catch { /* non-JSON */ }
        captured.push({ url: abs, status: res.statusCode, json, body: opts.body });
        if (res.statusCode >= 400) failures.push(`${res.statusCode} ${opts.method || 'GET'} ${abs}`);
        resolve({ ok: res.statusCode < 300, status: res.statusCode, json: async () => JSON.parse(text), text: async () => text });
      });
    });
    req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    req.on('error', (e) => { failures.push(`network ${abs}: ${e.message}`); reject(new TypeError(e.message)); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

const lastJson = (part) => [...captured].reverse().find((c) => c.url.includes(part) && c.json)?.json;
const QUICK = { Today: 'today', Yesterday: 'yesterday', 'This Month': 'thisMonth', 'Last Month': 'lastMonth' };
/* The captured report whose fromDate/toDate is EXACTLY the displayed period
   (responses arrive in any order; the other one is the "vs previous" call). */
const reportFor = (label) => {
  const { fromDate, toDate } = periodToRange(periodFromQuick(QUICK[label]));
  const hit = [...captured].reverse().find((c) => {
    if (!c.url.includes('get_onelink_Report')) return false;
    const q = new URL(c.url).searchParams;
    return q.get('fromDate') === fromDate && q.get('toDate') === toDate;
  });
  return { raw: hit?.json?.data, range: `${fromDate} → ${toDate}` };
};

live('LIVE dashboard — API response vs rendered DOM', () => {
  const sections = [];
  const record = (title, rows) => { sections.push(toMarkdown(rows, title)); return rows; };

  beforeAll(() => { global.fetch = liveFetch; resetContractLog(); });
  afterAll(() => {
    const contract = getContractLog();
    const md = [
      `# Dashboard API vs UI — live run ${new Date().toISOString()}`,
      `API base: ${BASE}`, '',
      ...sections,
      '### API contract log', '',
      contract.length ? contract.map((c) => `- **${c.severity}** \`${c.source} → ${c.path}\`: ${c.issue}`).join('\n') : '- none', '',
      '### Failed requests', '', failures.length ? failures.map((f) => `- ${f}`).join('\n') : '- none', '',
    ].join('\n');
    if (process.env.DASHBOARD_REPORT_FILE) fs.writeFileSync(process.env.DASHBOARD_REPORT_FILE, md);
    // eslint-disable-next-line no-console
    console.log(md);
  });

  /* Inactive / Active Login ERP | Launch Setup — rendered vs an independent
     tally of the raw captured responses (directory launchSetup × each
     school's usertimespend-report totalEntries). */
  test('Inactive / Active Login split = source records', async () => {
    const { unmount } = render(<Dashboard toast={() => {}} />);
    const q = (k) => document.querySelector(`[data-split="${k}"]`)?.textContent;
    await waitFor(() => expect(q('activeLogin.erp')).toBeTruthy(), { timeout: 120000 });
    await waitFor(() => expect(q('activeLogin.erp')).not.toBe(MISSING), { timeout: 600000 });
    const dirJson = lastJson('get-branches-with-permissions');
    const dir = (Array.isArray(dirJson) ? dirJson : dirJson?.data || []).map((r) => r.branch || r);
    const type = {};
    dir.forEach((b) => { if (b.id > 0 && !(b.id in type)) type[b.id] = b.launchSetup; });
    const logins = {};
    captured.filter((c) => c.url.includes('usertimespend-report') && c.json?.data && typeof c.json.data.totalEntries === 'number')
      .forEach((c) => { logins[JSON.parse(c.body).branchID] = c.json.data.totalEntries; });
    const t = { zero: { 1: 0, 0: 0 }, active: { 1: 0, 0: 0 } };
    let unchecked = 0;
    Object.keys(type).forEach((id) => {
      if (!(id in logins)) { unchecked += 1; return; }
      t[logins[id] > 0 ? 'active' : 'zero'][type[id] === 1 ? 1 : 0] += 1;
    });
    const rows = [
      ['Inactive Schools', 'ERP', t.zero[1], q('inactive.erp')],
      ['Inactive Schools', 'Launch Setup', t.zero[0], q('inactive.launch')],
      ['Active Login Schools', 'ERP', t.active[1], q('activeLogin.erp')],
      ['Active Login Schools', 'Launch Setup', t.active[0], q('activeLogin.launch')],
    ];
    sections.push(['### Inactive / Active Login — ERP | Launch Setup', '',
      `Schools in directory: ${Object.keys(type).length} · login checked: ${Object.keys(type).length - unchecked} · unchecked: ${unchecked}`, '',
      '| Card | Category | Source (raw responses) | UI (rendered) | Result |', '|---|---|---:|---:|---|',
      ...rows.map(([c, k, src, ui]) => `| ${c} | ${k} | ${src} | ${ui} | ${String(src) === ui ? 'PASS' : 'FAIL'} |`), ''].join('\n'));
    rows.forEach(([, , src, ui]) => expect(ui).toBe(String(src)));
    unmount();
  });

  test('every metric, every filter', async () => {
    render(<Dashboard toast={() => {}} />);
    await waitFor(() => expect(document.querySelector('[data-metric="schools.active"]')).toBeTruthy(), { timeout: 120000 });
    await waitFor(() => expect(readMetric(document.body, 'onelink.totalTransactions').text).not.toBe(MISSING), { timeout: 120000 });

    const admin = lastJson('admin_dashboard').data;
    const onelinkReqs = () => captured.filter((c) => c.url.includes('get_onelink_Report'));

    let rows = record('Default view (Fee: This Month · Bugs/Improvements: All Time · 1LINK: This Month)',
      compareMetrics(document.body, { adminDashboard: admin, onelinkReport: reportFor('This Month').raw }));
    expect(rows.filter((r) => r.result !== 'PASS')).toEqual([]);
    expect(rows).toHaveLength(DASHBOARD_METRICS.length);

    /* Fee period */
    const feeIds = DASHBOARD_METRICS.filter((m) => m.id.startsWith('fee.')).map((m) => m.id);
    fireEvent.change(document.querySelector('[data-testid="fee-period"]'), { target: { value: 'lastMonth' } });
    rows = record('Fee Analytics — Last Month (not served by admin_dashboard → expected "—")',
      compareMetrics(document.body, { adminDashboard: admin }, { ids: feeIds, unavailable: feeIds }));
    expect(rows.filter((r) => r.result !== 'PASS')).toEqual([]);
    fireEvent.change(document.querySelector('[data-testid="fee-period"]'), { target: { value: 'thisMonth' } });

    /* Bugs / Improvements periods */
    const biIds = DASHBOARD_METRICS.filter((m) => m.periodFiltered).map((m) => m.id);
    for (const p of ['today', 'yesterday', 'thisMonth', 'lastMonth', 'all']) {
      fireEvent.change(document.querySelector('[data-testid="bug-period"]'), { target: { value: p } });
      fireEvent.change(document.querySelector('[data-testid="imp-period"]'), { target: { value: p } });
      rows = record(`Bugs + Improvements — ${p}`, compareMetrics(document.body, { adminDashboard: admin }, { ids: biIds, keepFor: () => inPeriod(p) }));
      expect(rows.filter((r) => r.result !== 'PASS')).toEqual([]);
    }

    /* 1LINK periods */
    for (const label of ['Today', 'Yesterday', 'Last Month', 'This Month']) {
      const before = onelinkReqs().length;
      fireEvent.click([...document.querySelectorAll('.rpt-stab')].find((b) => b.textContent.trim() === label));
      await waitFor(() => {
        expect(document.querySelector('.rpt-filter-bar').textContent).toContain(`Showing: ${label}`);
        expect(onelinkReqs().length).toBeGreaterThanOrEqual(before + 2);
        expect(readMetric(document.body, 'onelink.totalTransactions').text).not.toBe(MISSING);
      }, { timeout: 120000 });
      await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
      const { raw, range } = reportFor(label);
      expect(raw).toBeTruthy();
      rows = record(`1LINK — ${label} (${range})`, compareMetrics(document.body, { onelinkReport: raw }));
      expect(rows.filter((r) => r.result !== 'PASS')).toEqual([]);
    }

    expect(failures).toEqual([]);
    expect(getContractLog().filter((c) => c.severity === 'error')).toEqual([]);
  });
});
