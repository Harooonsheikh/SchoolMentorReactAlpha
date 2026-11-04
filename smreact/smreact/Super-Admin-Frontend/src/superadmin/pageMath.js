/* ════════════════════════════════════════════════════════════════════
   Pagination — the ONE implementation of page math for Super Admin tables.
   UI: ./Pagination.jsx (component). Used by Dashboard (Current Month Details), Bug /
   Improvement Manager, 1LINK School-Wise Performance, User Management.

   Client-side tables (whole list already in one API response) slice with
   paginate(); a server-paged table passes the API's totalCount instead of
   rows.length and requests that page — the math is the same.
   ════════════════════════════════════════════════════════════════════ */

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const ELLIPSIS = '…';

const toInt = (v, fallback) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Page window for `total` records.
 * @returns {{ page:number, pageSize:number, total:number, totalPages:number,
 *             start:number, end:number, from:number, to:number }}
 *   page   requested page clamped to 1…totalPages
 *   start/end  slice indices (end exclusive);  from/to  1-based for display
 *   (0 / 0 when there are no records). totalPages is ≥ 1.
 */
export function paginate(total, page, pageSize) {
  const t = Math.max(0, toInt(total, 0));
  const size = Math.max(1, toInt(pageSize, 10));
  const totalPages = Math.max(1, Math.ceil(t / size));
  const p = Math.min(Math.max(1, toInt(page, 1)), totalPages);
  const start = (p - 1) * size;
  const end = Math.min(start + size, t);
  return { page: p, pageSize: size, total: t, totalPages, start, end, from: t ? start + 1 : 0, to: end };
}

/**
 * Page buttons: first, last, and a window of `span` pages around the current
 * one; skipped ranges become ELLIPSIS (a gap of exactly one page shows the
 * page instead — "1 … 3" would hide nothing).
 *   pageItems(1, 14)  → 1 2 3 4 5 … 14
 *   pageItems(7, 14)  → 1 … 5 6 7 8 9 … 14
 *   pageItems(14, 14) → 1 … 10 11 12 13 14
 */
export function pageItems(current, totalPages, span = 5) {
  const last = Math.max(1, toInt(totalPages, 1));
  const cur = Math.min(Math.max(1, toInt(current, 1)), last);
  if (last <= span + 2) return Array.from({ length: last }, (_, i) => i + 1);
  const from = Math.max(1, Math.min(cur - Math.floor(span / 2), last - span + 1));
  const to = Math.min(last, from + span - 1);
  const out = [];
  if (from > 1) out.push(1);
  if (from === 3) out.push(2); else if (from > 3) out.push(ELLIPSIS);
  for (let n = from; n <= to; n++) out.push(n);
  if (to === last - 2) out.push(last - 1); else if (to < last - 2) out.push(ELLIPSIS);
  if (to < last) out.push(last);
  return out;
}
