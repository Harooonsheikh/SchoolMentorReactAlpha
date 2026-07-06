/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD — live aggregation (frontend only)

   The dashboard does not own any data. It derives every figure from the
   other Super Admin modules' demo data so the overview always matches
   what those screens show:
     • Schools / students / staff / onboarding → statusData
     • Fee analytics + current-month table       → paymentData
     • Video breakdown                           → etubeData
     • Bugs summary                              → statusData enquiries
   Where a metric has no backing module yet (e.g. Improvements, the
   mobile-app user split), it is computed as 0 / derived and flagged.
   Replace these imports with API calls during integration.
   ═══════════════════════════════════════════════════════════════════ */
import { INITIAL_LAUNCH, INITIAL_ERP, INITIAL_INACTIVE, INITIAL_ENQUIRIES } from './statusData';
import { PAY_SCHOOLS, INITIAL_PAY_SETUP, monthlyCharge } from './paymentData';
import { INITIAL_VIDS, INITIAL_SCHOOL_VIDS } from './etubeData';

export const fmt = (n) => Number(n || 0).toLocaleString('en-US');

/* The month this overview reports on (matches the page subtitle). */
export const REF_MONTH = '2026-06';

/* Sum a numeric field across a list. */
const sumBy = (list, key) => list.reduce((a, s) => a + (Number(s[key]) || 0), 0);

/* Count schools whose signup landed in the reporting month. */
const newThisMonth = (list) => list.filter((s) => (s.signupDate || '').slice(0, 7) === REF_MONTH).length;

export function buildDashboard() {
  const launch = INITIAL_LAUNCH, erp = INITIAL_ERP, inactive = INITIAL_INACTIVE;
  const allSchools = [...launch, ...erp, ...inactive];

  /* ── School overview ── */
  const schools = {
    total: allSchools.length,
    erp: erp.length,
    launch: launch.length,
    inactive: inactive.length,
    active: launch.length + erp.length,                       // non-inactive
    activeLogin: erp.filter((s) => (s.logins || 0) > 0).length, // logged in ≥ once
    newLaunch: newThisMonth(launch),
    newErp: newThisMonth(erp),
  };

  /* ── Onboarding (from ERP schools) ── */
  const totalModules = Math.max(...erp.map((s) => s.onboarding?.total || 0), 0) || 15;
  const fullyTrained = erp.filter((s) => s.onboarding && s.onboarding.completed >= s.onboarding.total).length;
  const inProcess = erp.filter((s) => s.onboarding && s.onboarding.completed > 0 && s.onboarding.completed < s.onboarding.total).length;
  const obPct = erp.length
    ? Math.round((erp.reduce((a, s) => a + (s.onboarding ? s.onboarding.completed / s.onboarding.total : 0), 0) / erp.length) * 100)
    : 0;

  /* ── Students / staff ── */
  const students = {
    total: sumBy(allSchools, 'students'),
    newSignup: sumBy(allSchools, 'stuSignup'),
  };
  const staff = {
    total: sumBy(allSchools, 'staff'),
    newSignup: sumBy(allSchools, 'staffSignup'),
  };

  /* ── Fee analytics (from payment setup → monthly charge per school) ── */
  const feeRows = PAY_SCHOOLS.map((s) => {
    const setup = INITIAL_PAY_SETUP[s.id];
    const challan = setup ? monthlyCharge(s, setup) : 0;
    const prevDues = 0;            // no receiving history seeded yet
    const discount = 0;
    const receivable = challan - discount;
    const received = 0;
    const pending = receivable + prevDues - received;
    return { id: s.id, name: s.name, prevDues, challan, discount, receivable, received, pending };
  }).filter((r) => r.challan > 0);

  const feeTotals = feeRows.reduce((t, r) => ({
    prevDues: t.prevDues + r.prevDues,
    challan: t.challan + r.challan,
    discount: t.discount + r.discount,
    receivable: t.receivable + r.receivable,
    received: t.received + r.received,
    pending: t.pending + r.pending,
  }), { prevDues: 0, challan: 0, discount: 0, receivable: 0, received: 0, pending: 0 });

  /* ── Video breakdown (E-Tube) ── */
  const videoCats = {};
  INITIAL_VIDS.forEach((v) => { videoCats[v.cat] = (videoCats[v.cat] || 0) + 1; });
  const videos = {
    total: INITIAL_VIDS.length + INITIAL_SCHOOL_VIDS.length,
    ho: INITIAL_VIDS.length,
    school: INITIAL_SCHOOL_VIDS.length,
    byCat: videoCats,
  };

  /* ── Bugs summary (School Status → enquiries) ── */
  const allBugs = Object.values(INITIAL_ENQUIRIES).flat();
  const bugs = {
    total: allBugs.length,
    resolved: allBugs.filter((b) => b.status === 'resolved').length,
    pending: allBugs.filter((b) => b.status === 'open').length,
  };

  /* ── Improvements — no module yet; surfaced as zero so the section is
        honest rather than faked. Wire to a real source when available. ── */
  const improvements = { total: 0, completed: 0, pending: 0 };

  return { schools, onboarding: { totalModules, fullyTrained, inProcess, pct: obPct }, students, staff, feeRows, feeTotals, videos, bugs, improvements };
}
