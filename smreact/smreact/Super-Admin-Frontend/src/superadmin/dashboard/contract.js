/* ════════════════════════════════════════════════════════════════════
   API CONTRACT VALIDATION for the Dashboard's endpoints.

   Runs on every response. A violation is never "fixed up" silently:
     severity 'error'   → the affected value is shown as '—' and the
                          Dashboard shows a contract banner.
     severity 'warning' → the value is shown exactly as the API sent it, but
                          looks suspicious (negative money, broken invariant);
                          listed in the banner's details + console.

   Required fields are DERIVED from the metric registry (fieldPathsFor), so a
   new card automatically extends the contract.
   ════════════════════════════════════════════════════════════════════ */
import { fieldPathsFor, readPath, evaluateSpec, METRIC_BY_ID } from './metrics';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkNumber(out, path, v, { integer = false, nonNegative = false } = {}) {
  if (v === undefined) { out.push({ path, issue: 'missing', severity: 'error' }); return; }
  if (v === null) { out.push({ path, issue: 'null', severity: 'error' }); return; }
  if (!isNum(v)) { out.push({ path, issue: `expected number, got ${typeof v}`, value: v, severity: 'error' }); return; }
  if (integer && !Number.isInteger(v)) out.push({ path, issue: 'expected integer', value: v, severity: 'error' });
  if (nonNegative && v < 0) out.push({ path, issue: 'negative count', value: v, severity: 'error' });
}

function checkArray(out, path, v) {
  if (v === undefined) { out.push({ path, issue: 'missing', severity: 'error' }); return false; }
  if (!Array.isArray(v)) { out.push({ path, issue: `expected array, got ${v === null ? 'null' : typeof v}`, severity: 'error' }); return false; }
  return true;
}

const MONEY_FIELDS = ['PreviousAmount', 'FeeChallan', 'FeeDiscount', 'Receivable', 'ReceivedAmount', 'TotalPending'];

/** @returns {Array<{path, issue, severity, value?}>} */
export function validateAdminDashboard(raw) {
  const out = [];
  if (!raw || typeof raw !== 'object') return [{ path: 'data', issue: 'response has no data object', severity: 'error' }];

  fieldPathsFor('adminDashboard').forEach((p) => checkNumber(out, p, readPath(raw, p), { integer: true, nonNegative: true }));

  if (checkArray(out, 'CurrentMonthDetails', raw.CurrentMonthDetails)) {
    raw.CurrentMonthDetails.forEach((r, i) => {
      if (typeof r?.SchoolName !== 'string' || !r.SchoolName.trim()) out.push({ path: `CurrentMonthDetails[${i}].SchoolName`, issue: 'missing school name', severity: 'warning' });
      MONEY_FIELDS.forEach((f) => {
        const p = `CurrentMonthDetails[${i}].${f}`;
        checkNumber(out, p, r?.[f]);
        if (isNum(r?.[f]) && r[f] < 0) out.push({ path: p, issue: `negative amount (${r.SchoolName || 'row'})`, value: r[f], severity: 'warning' });
      });
    });
  }
  if (checkArray(out, 'Bugs', raw.Bugs)) {
    raw.Bugs.forEach((b, i) => {
      if (!isNum(b?.ID)) out.push({ path: `Bugs[${i}].ID`, issue: 'missing record id', severity: 'error' });
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(b?.Date ?? ''))) out.push({ path: `Bugs[${i}].Date`, issue: 'missing or invalid date (record excluded from period filters)', value: b?.Date, severity: 'warning' });
      if (typeof b?.IsSolved !== 'boolean' && b?.IsSolved !== 0 && b?.IsSolved !== 1) out.push({ path: `Bugs[${i}].IsSolved`, issue: 'expected boolean', value: b?.IsSolved, severity: 'error' });
    });
  }
  if (checkArray(out, 'VideoCategories', raw.VideoCategories)) {
    raw.VideoCategories.forEach((c, i) => checkNumber(out, `VideoCategories[${i}].VideoCount`, c?.VideoCount, { integer: true, nonNegative: true }));
  }

  /* Cross-field invariants — the backend's own totals must agree with its own
     parts. Shown as warnings (the values are still the API's). */
  const n = (p) => readPath(raw, p);
  if (isNum(n('ActiveSchools')) && isNum(n('ERP_Schools')) && isNum(n('LaunchSetup_Schools'))
    && n('ERP_Schools') + n('LaunchSetup_Schools') !== n('ActiveSchools')) {
    out.push({ path: 'ActiveSchools', issue: `ERP_Schools + LaunchSetup_Schools = ${n('ERP_Schools') + n('LaunchSetup_Schools')}, but ActiveSchools = ${n('ActiveSchools')}`, severity: 'warning' });
  }
  out.push(...validateBugInvariant(raw));
  return out;
}

/** Bug + improvement record counts (All Time) must equal the API BugSummary. */
export function validateBugInvariant(raw) {
  const out = [];
  const pairs = [['TotalBugs', 'total', 'all'], ['ResolvedBugs', 'resolved', 'solved'], ['PendingBugs', 'pending', 'open']];
  if (!Array.isArray(raw?.Bugs) || !raw?.BugSummary) return out;
  pairs.forEach(([field, , status]) => {
    const api = raw.BugSummary[field];
    const bugs = evaluateSpec({ count: 'Bugs', kind: 'bug', status }, raw);
    const imps = evaluateSpec({ count: 'Bugs', kind: 'improvement', status }, raw);
    if (isNum(api) && bugs + imps !== api) {
      out.push({ path: `BugSummary.${field}`, issue: `Bugs list has ${bugs} bug(s) + ${imps} improvement(s) = ${bugs + imps}, but BugSummary.${field} = ${api}`, severity: 'warning' });
    }
  });
  return out;
}

export function validateOnelinkReport(raw) {
  const out = [];
  if (!raw || typeof raw !== 'object') return [{ path: 'data', issue: 'response has no data object', severity: 'error' }];
  fieldPathsFor('onelinkReport').forEach((p) => {
    const counts = ['totals.totalTransactions', 'totals.schoolsReceivingPayments', 'totals.totalEnabledSchools'];
    checkNumber(out, p, readPath(raw, p), counts.includes(p) ? { integer: true, nonNegative: true } : {});
  });
  checkArray(out, 'transactions', raw.transactions);
  checkArray(out, 'branches', raw.branches);
  const t = raw.totals || {};
  if (isNum(t.totalTransactions) && Array.isArray(raw.transactions) && raw.transactions.length !== t.totalTransactions) {
    out.push({ path: 'transactions', issue: `${raw.transactions.length} transaction rows but totals.totalTransactions = ${t.totalTransactions}`, severity: 'warning' });
  }
  if (isNum(t.totalCollection) && t.totalCollection < 0) {
    out.push({ path: 'totals.totalCollection', issue: 'negative total collection', value: t.totalCollection, severity: 'warning' });
  }
  return out;
}

/* ── Reporting ────────────────────────────────────────────────────── */
const seen = new Set();
const log = [];

/** Log each distinct violation once (console + in-memory log for tests). */
export function reportContractViolations(source, violations = []) {
  violations.forEach((v) => {
    const key = `${source}|${v.path}|${v.issue}`;
    if (seen.has(key)) return;
    seen.add(key);
    log.push({ source, ...v });
    // eslint-disable-next-line no-console
    (v.severity === 'error' ? console.error : console.warn)(`[API contract] ${source} → ${v.path}: ${v.issue}`);
  });
  return violations;
}
export const getContractLog = () => [...log];
export const resetContractLog = () => { seen.clear(); log.length = 0; };

/** Which registered metrics a set of violations makes unavailable. */
export function metricsAffectedBy(violations) {
  return violations.filter((v) => v.severity === 'error').map((v) => v.path)
    .flatMap((p) => Object.values(METRIC_BY_ID).filter((m) => JSON.stringify(m.spec).includes(p.split('[')[0])).map((m) => m.label));
}
