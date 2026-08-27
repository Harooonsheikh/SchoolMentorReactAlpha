/* ═══════════════════════════════════════════════════════════════════
   1LINK / 1BILL TRANSACTION MONITORING — period model + calculations

   Yahan koi DATA nahi hai, sirf hisaab. Poori screen us ledger par
   chalti hai jo api/services/transactions.js laata hai
   (GET {root}/transactions).

   Pehle yahan ek generated demo ledger tha — 70 din × har school ke
   jhoote payments — jis se dashboard par lakhon rupay ki "collection"
   aur "revenue" dikhti thi jiska koi wujood nahi tha. Wo hata diya
   gaya: jab tak backend transaction route nahi deta, ledger khali
   rehta hai aur har aankra saaf 0 dikhata hai.

   School roster bhi yahan se nahi banta. School-Wise Performance wahi
   LIVE branch directory dikhati hai jo School Permissions screen use
   karti hai (get-branches-with-permissions) — dekhein OneLinkSection.jsx
   aur calculateSchoolWiseSummary() ka teesra parameter.
   ═══════════════════════════════════════════════════════════════════ */

export const TXN_STATUS = { SUCCESS: 'Successful', FAILED: 'Failed', REVERSED: 'Reversed' };
export const TXN_CHANNELS = ['1LINK', '1Bill'];

/* Koi bundled ledger nahi — transactions sirf API se aati hain. */
export const INITIAL_TRANSACTIONS = [];

/* Commercial rate: parent se kitna charge hota hai vs provider ko kitna
   jata hai. Yeh API se aati hai (GET/PUT {root}/transactions/rate-config)
   aur Super Admin "Rates" modal se set kar sakta hai. Jab tak API na de,
   ZERO rehti hai — pehle yahan 40 / 22.5 likha tha, jo screen par asli
   margin (PKR 17.50/txn) ban kar dikhta tha. */
export const TXN_RATE_CONFIG_INITIAL = {
  customerCharge: 0,
  providerCost: 0,
  effectiveFrom: '',
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

/**
 * Per-school breakdown for the School-Wise Performance table.
 *
 * @param rows       is period ki successful transactions
 * @param rateConfig customerCharge / providerCost
 * @param schools    POORA network roster (live branch directory). Diya ho to
 *                   har school pehle 0 se bhar diya jata hai, taake table me
 *                   network ki SARI schools nazar aayen — sirf wo nahi jinki
 *                   is period me koi transaction thi. Na diya jaye to purana
 *                   behaviour (sirf jin schools ki rows hain).
 */
export function calculateSchoolWiseSummary(rows, rateConfig, schools) {
  const map = new Map();

  (schools || []).forEach((s) => {
    if (!s || s.id == null) return;
    map.set(s.id, {
      schoolId: s.id,
      schoolName: String(s.name || s.school || 'Unnamed Branch'),
      branch: String(s.address || s.campus || '—'),
      schoolCode: String(s.schoolCode ?? s.id),
      transactions: 0,
      collection: 0,
    });
  });

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
