/* ════════════════════════════════════════════════════════════════════
   Shared display formatters for API-driven figures.

   Rules (see DASHBOARD_DATA_STANDARD.md):
     • Formatting NEVER changes the number — only how it is written.
     • null / undefined / NaN means "the API did not give us this value" and
       is always written as MISSING ('—'), never as 0.
     • A genuine API 0 is written as 0 (or PKR 0.00).
   ════════════════════════════════════════════════════════════════════ */

export const MISSING = '—';

/** true when the value is not a usable finite number. */
export const isMissing = (v) => v == null || typeof v !== 'number' || !Number.isFinite(v);

/** Counts / integers: 39498 → "39,498". */
export const fmtCount = (v) => (isMissing(v) ? MISSING : v.toLocaleString('en-US'));

/** Money: 614661 → "PKR 614,661.00" (always 2 decimals, PKR prefix). */
export const fmtPKR = (v) => (isMissing(v)
  ? MISSING
  : `PKR ${v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/** Money without prefix / decimals, for dense tables: 614661 → "614,661". */
export const fmtAmount = (v) => (isMissing(v) ? MISSING : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));

/** Percentage (value already in percent units): 1 → "1%". */
export const fmtPct = (v) => (isMissing(v) ? MISSING : `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`);

export const FORMATTERS = { count: fmtCount, pkr: fmtPKR, amount: fmtAmount, pct: fmtPct };

/** Format by registry format key ('count' | 'pkr' | 'amount' | 'pct'). */
export const formatAs = (format, v) => (FORMATTERS[format] || fmtCount)(v);

/**
 * Inverse of the formatters — used by the API-vs-UI tests to read a rendered
 * value back into a number. '—' → null. Strips "PKR", thousands separators and
 * "%" without rounding.
 */
export function parseDisplayed(text) {
  const s = String(text ?? '').trim();
  if (!s || s === MISSING) return null;
  const cleaned = s.replace(/^PKR\s*/i, '').replace(/,/g, '').replace(/%$/, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}
