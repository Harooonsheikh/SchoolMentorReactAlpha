#!/usr/bin/env node
/* Live Dashboard API-vs-UI verification.
     npm run verify:dashboard                 → http://localhost:3001 (dev server must be running)
     npm run verify:dashboard -- http://host  → another base
   Writes dashboard-api-ui-report.md next to package.json. */
const { spawnSync } = require('child_process');
const path = require('path');

const base = process.argv[2] || process.env.DASHBOARD_LIVE_API || 'http://localhost:3001';
const report = path.join(__dirname, '..', 'dashboard-api-ui-report.md');
const r = spawnSync('npx', ['react-scripts', 'test', '--watchAll=false', '--testPathPattern', 'Dashboard.live'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CI: 'true', DASHBOARD_LIVE_API: base, DASHBOARD_REPORT_FILE: report },
});
console.log(`\nReport: ${report}`);
process.exit(r.status ?? 1);
