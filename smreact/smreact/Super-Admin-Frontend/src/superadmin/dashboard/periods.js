/* Reporting periods — always in Pakistan time (Asia/Karachi), so "Today" /
   "This Month" are the same day / month the backend and School Payments use,
   whatever timezone the browser is in. */
export const PK_TZ = 'Asia/Karachi';

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today's date in Pakistan as YYYY-MM-DD. `now` is injectable for tests. */
export function pkToday(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: PK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return isoOf(now);
  }
}

export const shiftDay = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };

export const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
];
export const periodLabel = (id) => (PERIODS.find((p) => p.id === id) || PERIODS[2]).label;

/** Predicate: is a YYYY-MM-DD date inside the period (Pakistan time)? */
export function inPeriod(periodId, now = new Date()) {
  const today = pkToday(now);
  return (date) => {
    if (periodId === 'all') return true;
    const d = String(date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    if (periodId === 'today') return d === today;
    if (periodId === 'yesterday') return d === shiftDay(today, -1);
    if (periodId === 'thisMonth') return d.slice(0, 7) === today.slice(0, 7);
    if (periodId === 'lastMonth') return d.slice(0, 7) === shiftMonth(today.slice(0, 7), -1);
    return false;
  };
}

/** { month, year, key } for a month-level period id. */
export function monthOfPeriod(periodId, now = new Date()) {
  const cur = pkToday(now).slice(0, 7);
  const ym = periodId === 'lastMonth' ? shiftMonth(cur, -1) : cur;
  return { month: Number(ym.slice(5, 7)), year: Number(ym.slice(0, 4)), key: ym };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = ({ month, year }) => `${MONTH_NAMES[month - 1]} ${year}`;
