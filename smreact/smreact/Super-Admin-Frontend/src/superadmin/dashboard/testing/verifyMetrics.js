/* ════════════════════════════════════════════════════════════════════
   API-vs-UI verification utility (tests only).

   For every registered metric:
     1. compute the value straight from the RAW API response — with this
        file's OWN implementation of the registry spec (deliberately not the
        data layer's evaluateSpec, so a mapping bug cannot verify itself);
     2. read the RENDERED value from the DOM element data-metric="<id>";
     3. parse the text back to a number (only formatting is stripped);
     4. compare → PASS / FAIL.

   Adding a card = add a registry entry + data-metric on its element; the
   suites in ../Dashboard.apiui.test.js and ../Dashboard.live.test.js then
   cover it automatically.
   ════════════════════════════════════════════════════════════════════ */
import { DASHBOARD_METRICS } from '../metrics';
import { parseDisplayed } from '../../format';

const get = (obj, path) => {
  let cur = obj;
  for (const k of String(path).split('.')) { if (cur == null || typeof cur !== 'object') return undefined; cur = cur[k]; }
  return cur;
};
const n = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Independent spec reader. `keep(dateStr)` = period predicate for Bugs. */
export function expectedFromApi(spec, raw, { keep = () => true } = {}) {
  if (!raw) return null;
  if ('path' in spec) return n(get(raw, spec.path));
  if ('add' in spec) {
    let total = 0;
    for (const p of spec.add) { const x = n(get(raw, p)); if (x === null) return null; total += x; }
    return total;
  }
  if ('sum' in spec) {
    const rows = get(raw, spec.sum);
    if (!Array.isArray(rows)) return null;
    let total = 0;
    for (const r of rows) { const x = n(r && r[spec.field]); if (x === null) return null; total += x; }
    return total;
  }
  if ('pct' in spec) {
    const a = n(get(raw, spec.pct));
    const parts = spec.of.map((p) => n(get(raw, p)));
    if (a === null || parts.includes(null)) return null;
    const d = parts.reduce((x, y) => x + y, 0);
    return d ? Math.round((100 * a) / d) : null;
  }
  if ('count' in spec) {
    const rows = get(raw, spec.count);
    if (!Array.isArray(rows)) return null;
    if (spec.successful) return rows.filter((t) => ['paid', 'success', 'successful', 'completed'].includes(String(t && t.status).trim().toLowerCase())).length;
    return rows.filter((r) => {
      const isImp = /^\s*\[[^\]]*improve/i.test(String((r && r.BugDetail) || ''));
      if ((spec.kind === 'improvement') !== isImp) return false;
      if (!keep(String((r && r.Date) || '').slice(0, 10))) return false;
      const solved = r.IsSolved === true || r.IsSolved === 1;
      return spec.status === 'all' || (spec.status === 'solved' ? solved : !solved);
    }).length;
  }
  return null;
}

export const describeField = (spec) => {
  if ('path' in spec) return spec.path;
  if ('add' in spec) return spec.add.join(' + ');
  if ('sum' in spec) return `Σ ${spec.sum}[].${spec.field}`;
  if ('pct' in spec) return `round(${spec.pct} / (${spec.of.join(' + ')}) × 100)`;
  if ('count' in spec) return spec.successful ? `count(${spec.count}[] where status = Paid)` : `count(${spec.count}[] kind=${spec.kind}, ${spec.status})`;
  return '?';
};

/** Rendered text of a metric → { el, text, value }. */
export function readMetric(container, id) {
  const els = container.querySelectorAll(`[data-metric="${id}"]`);
  if (els.length !== 1) return { el: null, text: null, value: null, count: els.length };
  const text = els[0].textContent.trim();
  return { el: els[0], text, value: parseDisplayed(text), count: 1 };
}

const sameNumber = (a, b, format) => {
  if (a === null || b === null) return a === b;
  /* Money is displayed to 2 decimals — compare at that precision only. */
  return format === 'pkr' || format === 'amount' ? Math.round(a * 100) === Math.round(b * 100) : a === b;
};

/**
 * Compare rendered metrics against raw API responses.
 * @param {HTMLElement} container
 * @param {{ adminDashboard?: Object, onelinkReport?: Object }} raws  raw `data` per source
 * @param {{ ids?: string[], keepFor?: (metric)=>Function, unavailable?: string[] }} [opts]
 *        unavailable: metric ids expected to show '—' because the selected
 *        period is not served by the API.
 */
export function compareMetrics(container, raws, { ids, keepFor, unavailable = [] } = {}) {
  const list = DASHBOARD_METRICS.filter((m) => (!ids || ids.includes(m.id)) && raws[m.source] !== undefined);
  return list.map((m) => {
    const api = unavailable.includes(m.id) ? null : expectedFromApi(m.spec, raws[m.source], { keep: keepFor ? keepFor(m) : undefined });
    const ui = readMetric(container, m.id);
    let result;
    if (ui.count !== 1) result = ui.count === 0 ? 'FAIL (not rendered)' : `FAIL (${ui.count} elements)`;
    else if (ui.text !== '—' && ui.value === null) result = `FAIL (unparseable "${ui.text}")`;
    else result = sameNumber(api, ui.value, m.format) ? 'PASS' : 'FAIL';
    return { id: m.id, label: m.label, section: m.section, source: m.source, field: describeField(m.spec), api, uiText: ui.text, ui: ui.value, result };
  });
}

export const allPass = (rows) => rows.every((r) => r.result === 'PASS');

/** Markdown table (printed on failure, written by the live run). */
export function toMarkdown(rows, title = '') {
  const head = '| Metric | API field | API value | UI value (rendered) | Result |\n|---|---|---:|---:|---|';
  const body = rows.map((r) => `| ${r.label} | \`${r.field}\` | ${r.api === null ? '— (null)' : r.api} | ${r.uiText ?? '(absent)'} | ${r.result} |`).join('\n');
  return `${title ? `### ${title}\n\n` : ''}${head}\n${body}\n`;
}
