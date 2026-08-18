/* ═══════════════════════════════════════════════════════════════════
   1LINK / 1BILL TRANSACTION MONITORING — demo data + helpers (frontend only)

   Reuses the same combined school roster as Schools Payment (PAY_SCHOOLS)
   rather than inventing a parallel school list, so every figure this
   module shows stays consistent with School Details / Schools Payment
   elsewhere in the dashboard. In production this scales to the full
   School Mentor network (800+ schools) via the same API — see
   api/services/transactions.js + SUPERADMIN_API_GUIDE.md.

   Mock data only — the integrating developer swaps INITIAL_TRANSACTIONS /
   TXN_RATE_CONFIG_INITIAL for real API responses (resolve() already
   picks live vs mock automatically once a backend is configured).
   ═══════════════════════════════════════════════════════════════════ */
import { PAY_SCHOOLS } from './paymentData';

/* Only schools with active students plausibly collect fees online —
   mirrors how Schools Payment / Fee Analytics already scope themselves. */
export const TXN_SCHOOLS = PAY_SCHOOLS.filter((s) => (s.students || 0) > 0);

export const TXN_STATUS = { SUCCESS: 'Successful', FAILED: 'Failed', REVERSED: 'Reversed' };
export const TXN_CHANNELS = ['1LINK', '1Bill'];

const FEE_TYPES = [
  { name: 'Monthly Fee', min: 2500, max: 6000 },
  { name: 'Tuition Fee', min: 3000, max: 7000 },
  { name: 'Admission Fee', min: 8000, max: 25000 },
  { name: 'Transport Fee', min: 800, max: 2500 },
  { name: 'Examination Fee', min: 1000, max: 3000 },
  { name: 'Annual Charges', min: 1500, max: 4000 },
];
const CLASS_NAMES = ['Play Group', 'Nursery', 'KG', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const FIRST_NAMES = ['Ali', 'Hamza', 'Bilal', 'Zainab', 'Ayesha', 'Fatima', 'Hassan', 'Sara', 'Usman', 'Areeba', 'Talha', 'Nimra', 'Hira', 'Danyal', 'Iqra', 'Omar', 'Mahnoor', 'Rohaan', 'Khadija', 'Sana'];
const LAST_NAMES = ['Ahmed', 'Khan', 'Malik', 'Siddiqui', 'Raza', 'Iqbal', 'Hassan', 'Sheikh', 'Farooq', 'Butt', 'Mehmood', 'Noor', 'Bano', 'Aslam', 'Javed'];

/* Deterministic PRNG (mulberry32) so the demo dataset — and every KPI
   derived from it — is stable across reloads instead of reshuffling
   every time the module is re-imported. */
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260801);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const DAYS_BACK = 70; // covers Today / Yesterday / This Month / Last Month / any custom range within it

function generateTransactions() {
  const out = [];
  let seq = 1;
  const today = new Date();
  for (let dayOffset = 0; dayOffset < DAYS_BACK; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - dayOffset);
    const dateStr = d.toISOString().slice(0, 10);
    for (const s of TXN_SCHOOLS) {
      const weight = Math.max(1, Math.round((s.students || 10) / 25));
      const activityChance = 0.5 + Math.min(weight, 6) * 0.05;
      if (rand() > activityChance) continue; // school had no 1LINK activity that day
      const count = randInt(1, Math.min(6, weight + 1));
      for (let i = 0; i < count; i++) {
        const ft = pick(FEE_TYPES);
        const amount = randInt(ft.min, ft.max);
        const statusRoll = rand();
        const status = statusRoll < 0.05 ? TXN_STATUS.FAILED : statusRoll < 0.08 ? TXN_STATUS.REVERSED : TXN_STATUS.SUCCESS;
        const hh = randInt(8, 19);
        const mm = randInt(0, 59);
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const hh12 = ((hh + 11) % 12) + 1;
        out.push({
          id: `OLTX${String(seq).padStart(6, '0')}`,
          schoolId: s.id,
          schoolName: s.name,
          branch: 'Main Campus',
          schoolCode: s.schoolCode,
          date: dateStr,
          time: `${String(hh12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`,
          txnId: `TXN${String(seq).padStart(6, '0')}`,
          oneLinkRef: `1L-${100000 + seq}`,
          studentName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
          admissionNo: String(1000 + (seq % 4000)),
          className: pick(CLASS_NAMES),
          feeType: ft.name,
          invoiceNo: `INV-${dateStr.replace(/-/g, '')}-${String(seq).padStart(4, '0')}`,
          amount,
          channel: rand() < 0.7 ? '1LINK' : '1Bill',
          status,
        });
        seq++;
      }
    }
  }
  return out;
}

/* Demo transaction ledger — one row per 1LINK/1Bill payment attempt
   (successful, failed or reversed) across the last 70 days. */
export const INITIAL_TRANSACTIONS = generateTransactions();

/* Commercial rate the parent is charged vs what School Mentor pays the
   API/payment provider. NOT hardcoded into calculations anywhere below —
   every revenue figure is derived from this config so Super Admin can
   update it if commercial terms change (see RateConfigModal).

   `effectiveFrom` demonstrates the "rate changes shouldn't rewrite old
   financial history" requirement conceptually: a real backend would
   store a list of {customerCharge, providerCost, effectiveFrom} rows and
   pick the one in force on each transaction's date. This prototype keeps
   a single active rate (the common case — rates rarely change) and
   surfaces effectiveFrom in the UI so the concept is visible; wiring true
   date-versioned rates is a backend/API task noted in the guide. */
export const TXN_RATE_CONFIG_INITIAL = {
  customerCharge: 40,
  providerCost: 22.5,
  effectiveFrom: '2026-08-01',
};

export const marginOf = (rateConfig) => Number(rateConfig.customerCharge || 0) - Number(rateConfig.providerCost || 0);

export const pkr = (v) => `PKR ${Number(v || 0).toLocaleString('en-PK')}`;
export const pkr2 = (v) => `PKR ${Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const kfmt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : Number(v || 0).toLocaleString());

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthOf = (iso) => iso.slice(0, 7);

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (yyyymm) => {
  if (!yyyymm) return '';
  const [y, m] = yyyymm.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};
export const fmtDateLong = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '');

/* ── Reporting period model ─────────────────────────────────────────
   { mode: 'date'|'month'|'range', date?, month?, from?, to?, label }
   Built by the quick-filter row (Today / Yesterday / This Month / Last
   Month) or the Custom picker (Single Date / Month / From–To). Both
   dashboard cards + the school-wise table + both reports all consume
   the SAME period object, so switching the filter once updates
   everything (no separate date pickers to keep in sync). */
export function periodFromQuick(quick) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (quick === 'today') return { mode: 'date', date: iso(today), label: 'Today' };
  if (quick === 'yesterday') {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { mode: 'date', date: iso(y), label: 'Yesterday' };
  }
  if (quick === 'thisMonth') return { mode: 'month', month: ym(today), label: 'This Month' };
  if (quick === 'lastMonth') {
    const l = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { mode: 'month', month: ym(l), label: 'Last Month' };
  }
  return periodFromQuick('today');
}

export function periodFromCustom(customMode, { date, from, to, month }) {
  if (customMode === 'single') return { mode: 'date', date, label: fmtDateLong(date) };
  if (customMode === 'month') return { mode: 'month', month, label: monthLabel(month) };
  return { mode: 'range', from, to, label: `${fmtDateLong(from)} to ${fmtDateLong(to)}` };
}

export function matchesPeriod(t, period) {
  if (!t.date || !period) return false;
  if (period.mode === 'date') return t.date === period.date;
  if (period.mode === 'month') return monthOf(t.date) === period.month;
  if (period.mode === 'range') return period.from && period.to && t.date >= period.from && t.date <= period.to;
  return false;
}

/* Equivalent immediately-preceding period, used for the small
   "+X% vs previous period" comparison badges. */
export function previousPeriodOf(period) {
  if (period.mode === 'date') {
    const d = new Date(period.date); d.setDate(d.getDate() - 1);
    return { mode: 'date', date: d.toISOString().slice(0, 10) };
  }
  if (period.mode === 'month') {
    const [y, m] = period.month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return { mode: 'month', month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
  }
  const from = new Date(period.from);
  const to = new Date(period.to);
  const days = Math.round((to - from) / 86400000) + 1;
  const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { mode: 'range', from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

export const percentChange = (curr, prev) => (prev ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0));

/* ── Calculation functions ──────────────────────────────────────────
   Revenue figures only ever count Successful transactions — Failed /
   Reversed never collected money, so they're excluded from both the
   collections total AND the revenue split, per the "Transaction Status
   Handling" requirement. */
export const isSuccessful = (t) => t.status === TXN_STATUS.SUCCESS;

export function filterTransactions(list, period) {
  return (list || []).filter((t) => isSuccessful(t) && matchesPeriod(t, period));
}

export function calculateTotalTransactions(rows) { return rows.length; }
export function calculateTotalCollections(rows) { return rows.reduce((a, t) => a + Number(t.amount || 0), 0); }
export function calculateActiveSchools(rows) { return new Set(rows.map((t) => t.schoolId)).size; }
export function calculateAvgTransactionValue(rows) {
  const total = calculateTotalCollections(rows);
  return rows.length ? total / rows.length : 0;
}

export function calculateProviderPayable(rows, rateConfig) { return rows.length * Number(rateConfig.providerCost || 0); }
export function calculateCustomerCharges(rows, rateConfig) { return rows.length * Number(rateConfig.customerCharge || 0); }
export function calculateSchoolMentorRevenue(rows, rateConfig) { return rows.length * marginOf(rateConfig); }

export function calculateSchoolWiseSummary(rows, rateConfig) {
  const map = new Map();
  rows.forEach((t) => {
    if (!map.has(t.schoolId)) {
      map.set(t.schoolId, {
        schoolId: t.schoolId, schoolName: t.schoolName, branch: t.branch, schoolCode: t.schoolCode,
        transactions: 0, collection: 0,
      });
    }
    const e = map.get(t.schoolId);
    e.transactions += 1;
    e.collection += Number(t.amount || 0);
  });
  return Array.from(map.values()).map((e) => ({
    ...e,
    customerCharges: e.transactions * Number(rateConfig.customerCharge || 0),
    providerPayable: e.transactions * Number(rateConfig.providerCost || 0),
    smRevenue: e.transactions * marginOf(rateConfig),
  }));
}
