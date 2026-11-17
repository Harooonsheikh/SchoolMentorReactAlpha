/* ═══════════════════════════════════════════════════════════════════
   EXAM COMPARISON REPORTS — parent-friendly Comparison Report (Grade 1-12)
   and Preschool Comparison Report.

   Pure HTML builders in the ERP report-kit chrome. The data (entries) comes
   from the live services in services/examResultHistoryService.js:
     buildGradeEntries(...)              → Grade 1-12, subject % per exam
     fetchPreschoolComparisonEntries(...) → Preschool, learning-area % per assessment

   entry: { name, published, pct, grade, gradeColor?, rank?, values: { [row]: % | null } }
   ═══════════════════════════════════════════════════════════════════ */
import {
  examEsc, examR1, examPalette, examWrapReport, examTrendChartSvg, examDeliver,
} from './examReportCommon';
import { fetchReportHeader } from '../../utils/pdfReports';
import {
  fetchResultsPublishState, buildGradeEntries, fetchPreschoolComparisonEntries,
} from '../services/examResultHistoryService';

const BAND = 2; // a change of 2% or less counts as "about the same"

/* Core body — shared by both reports. → { body, subline } */
export function buildComparisonBody({ student, entries, rowLabel = 'Subject', isColor = true, sessionLabel }) {
  const p = examPalette(isColor);
  const E = examEsc;
  const name = student?.name || 'Student';
  const subline = [E(name), E(student?.cls || ''), sessionLabel ? E(sessionLabel) : ''].filter(Boolean).join(' &middot; ');
  const firstName = String(name).split(' ')[0];
  const th = (txt, align = 'center') => `<th style="padding:8px 9px;font-size:10px;font-weight:700;color:${p.accent};text-align:${align};text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">${txt}</th>`;
  const tdS = `padding:8px 9px;border-bottom:1px solid ${p.accBdr};font-size:12px`;
  const secTitle = (txt, col) => `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:${p.tMuted};margin:0 0 10px;display:flex;align-items:center;gap:8px"><div style="width:3px;height:14px;border-radius:2px;background:${col}"></div>${txt}</div>`;

  if (!entries || entries.length < 2) {
    const only = entries && entries[0];
    const body = `<div style="padding:24px 16px;text-align:center;font-size:13px;color:#334155;line-height:1.7">
      ${only ? `${E(firstName)} scored <b>${only.pct}%</b> in <b>${E(only.name)}</b>.<br>` : 'No published results found for this session.<br>'}
      The comparison will appear once at least two exam results are published.</div>`;
    return { body, subline };
  }

  const first = entries[0], last = entries[entries.length - 1];
  const delta = examR1(last.pct - first.pct);
  const dir = delta > BAND ? 'up' : delta < -BAND ? 'down' : 'flat';
  const col = dir === 'up' ? p.grn : dir === 'down' ? p.red : p.accent;
  const verdict = dir === 'up' ? (delta >= 5 ? 'a clear improvement' : 'a small improvement')
    : dir === 'down' ? (delta <= -5 ? 'a clear drop' : 'a small drop') : 'about the same';
  const arrow = dir === 'up' ? '&uarr;' : dir === 'down' ? '&darr;' : '&rarr;';

  const headline = `<div style="display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:12px;border:1.5px solid ${p.accBdr};background:${p.accBg}">
    <div style="width:54px;height:54px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:#fff;background:${col}">${arrow}</div>
    <div style="font-size:13.5px;line-height:1.6;color:#1F2937">
      ${E(firstName)}'s overall score went from <b>${first.pct}%</b> in ${E(first.name)} to <b>${last.pct}%</b> in ${E(last.name)}.
      <br>That is <b style="color:${col}">${verdict}${dir === 'flat' ? '' : ` (${delta > 0 ? '+' : ''}${delta}%)`}</b>.
    </div>
  </div>`;

  const tiles = [
    [`First exam &middot; ${E(first.name)}`, `${first.pct}%`, p.accent],
    [`Latest exam &middot; ${E(last.name)}`, `${last.pct}%`, p.accent],
    ['Change', `${delta > 0 ? '+' : ''}${delta}%`, col],
  ].map(([k, v, c]) => `<div style="flex:1;min-width:0;padding:12px 10px;text-align:center;border:1px solid ${p.accBdr};border-radius:10px">
      <div style="font-size:22px;font-weight:900;color:${c}">${v}</div>
      <div style="font-size:10px;font-weight:700;color:${p.tMuted};margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${k}</div></div>`).join('');

  const rowNames = [];
  entries.forEach(e => Object.keys(e.values || {}).forEach(k => { if (!rowNames.includes(k)) rowNames.push(k); }));
  const rows = rowNames.map(nm => {
    const vals = entries.map(e => (e.values?.[nm] ?? null));
    const known = vals.filter(v => v !== null);
    if (known.length < 2) return null;
    const change = examR1(known[known.length - 1] - known[0]);
    return { name: nm, vals, change, latest: known[known.length - 1], dir: change > BAND ? 'up' : change < -BAND ? 'down' : 'flat' };
  }).filter(Boolean);
  const resultCell = r => {
    if (r.dir === 'up') return `<span style="font-weight:800;color:${p.grn}">&uarr; Better by ${r.change}%</span>`;
    if (r.dir === 'down') return `<span style="font-weight:800;color:${p.red}">&darr; Lower by ${Math.abs(r.change)}%</span>`;
    return `<span style="font-weight:700;color:${p.tMuted}">&rarr; About the same</span>`;
  };
  const tableRows = rows.map((r, i) => `<tr style="background:${i % 2 ? p.rowEv : '#fff'}">
      <td style="${tdS};font-weight:700">${E(r.name)}</td>
      ${r.vals.map((v, j) => `<td style="${tdS};text-align:center;${j === r.vals.length - 1 ? 'font-weight:800' : ''}">${v === null ? '&mdash;' : `${v}%`}</td>`).join('')}
      <td style="${tdS};text-align:left">${resultCell(r)}</td>
    </tr>`).join('');

  const better = rows.filter(r => r.dir === 'up').sort((a, b) => b.change - a.change);
  const attention = rows.filter(r => r.dir === 'down' || r.latest < 60).sort((a, b) => a.change - b.change);
  const box = (title, c, bg, items, empty) => `<div style="flex:1;min-width:0;padding:12px 14px;border-radius:10px;border:1px solid ${p.accBdr};background:${isColor ? bg : '#fff'}">
      <div style="font-size:11px;font-weight:800;color:${c};margin-bottom:6px">${title}</div>
      ${items.length ? `<ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.7;color:#1F2937">${items.join('')}</ul>` : `<div style="font-size:12px;color:${p.tMuted}">${empty}</div>`}</div>`;
  const join = arr => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
  const nm = list => list.map(r => r.name);
  const tip = attention.length
    ? `Please spend a little extra time with ${firstName} on ${join(nm(attention).slice(0, 3))}${better.length ? `, and praise the progress in ${join(nm(better).slice(0, 3))}` : ''}.`
    : `Great work - ${firstName} is doing well. Keep encouraging the same routine at home.`;

  const body = `<div style="padding:16px 16px 6px">
    ${headline}
    <div style="display:flex;gap:10px;margin:14px 0 18px">${tiles}</div>

    ${secTitle('Score in each exam', p.accent)}
    <div style="border:1px solid ${p.accBdr};border-radius:10px;padding:10px;background:#fff;margin-bottom:18px">
      ${examTrendChartSvg(entries.map(e => ({ label: e.name, pct: e.pct, sub: e.grade ? `Grade ${e.grade}` : e.published })), p)}
    </div>

    ${rows.length ? `${secTitle(`${E(rowLabel)} by ${E(rowLabel.toLowerCase())}`, p.pur)}
    <table style="width:100%;border:1px solid ${p.accBdr};border-collapse:collapse;margin-bottom:18px">
      <thead><tr style="background:${p.accBg}">${th(E(rowLabel), 'left')}${entries.map(e => th(E(e.name))).join('')}${th('Result', 'left')}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <div style="display:flex;gap:12px;margin-bottom:12px">
      ${box('Doing better in', p.grn, '#F0FDF4', better.map(r => `<li>${E(r.name)} <b style="color:${p.grn}">+${r.change}%</b></li>`), 'No big changes yet.')}
      ${box('Needs more attention', p.amb, '#FFFBEB', attention.map(r => `<li>${E(r.name)} <b style="color:${r.change < 0 ? p.red : p.amb}">${r.change < 0 ? `${r.change}%` : `${r.latest}%`}</b></li>`), 'Nothing - well done!')}
    </div>
    <div style="padding:12px 14px;border-radius:10px;border:1px solid ${p.accBdr};background:${p.accBg};font-size:12.5px;line-height:1.6;color:#1F2937">
      <b style="color:${p.accent}">Tip for parents:</b> ${E(tip)}
    </div>` : `<div style="padding:12px 14px;border-radius:10px;border:1px solid ${p.accBdr};background:${p.accBg};font-size:12px;color:${p.tMuted}">${E(rowLabel)}-level marks are not available for these exams, so only the overall score is compared.</div>`}
  </div>`;
  return { body, subline };
}

/** Grade 1-12 parent-friendly Comparison Report → full HTML document.
    student: { name, cls, … }  entries: from buildGradeEntries()  branch: fetchReportHeader() result. */
export function buildComparisonReportHtml({ student, entries, branch, isColor = true, format = 'pdf', sessionLabel, includeToolbar = true }) {
  const { body, subline } = buildComparisonBody({ student, entries, rowLabel: 'Subject', isColor, sessionLabel });
  return examWrapReport({ title: `Comparison Report — ${student?.name || ''}`, subline, bodyHtml: body, branch, format, isColor, includeToolbar });
}

/** Preschool Comparison Report → full HTML document (learning areas instead of subjects). */
export function buildPreschoolComparisonReportHtml({ student, entries, branch, isColor = true, format = 'pdf', sessionLabel, includeToolbar = true }) {
  const { body, subline } = buildComparisonBody({ student, entries, rowLabel: 'Learning Area', isColor, sessionLabel });
  return examWrapReport({ title: `Preschool Comparison Report — ${student?.name || ''}`, subline, bodyHtml: body, branch, format, isColor, includeToolbar });
}

/** Live: load published results' data and return the Grade 1-12 report HTML.
    results = Result History rows (st.results). gradeFn = Examination's rcGetGrade. */
export async function loadComparisonReportHtml({ student, results, isColor = true, format = 'pdf', sessionLabel, gradeFn, branch, includeToolbar = true }) {
  const [hdr, withPub] = await Promise.all([
    branch ? Promise.resolve(branch) : fetchReportHeader(),
    fetchResultsPublishState(student, results),
  ]);
  const { entries } = await buildGradeEntries(student, withPub, { gradeFn });
  return buildComparisonReportHtml({ student, entries, branch: hdr, isColor, format, sessionLabel, includeToolbar });
}

/** Live: Preschool report HTML. exams = [{ examId, termId, name, date, gradeId, sectionId, published? }]. */
export async function loadPreschoolComparisonReportHtml({ student, exams, isColor = true, format = 'pdf', sessionLabel, branch, includeToolbar = true, learningAreas, gradingScale }) {
  const [hdr, entries] = await Promise.all([
    branch ? Promise.resolve(branch) : fetchReportHeader(),
    fetchPreschoolComparisonEntries(student, exams, { learningAreas, gradingScale }),
  ]);
  return buildPreschoolComparisonReportHtml({ student, entries, branch: hdr, isColor, format, sessionLabel, includeToolbar });
}

/** One-call download: build + deliver (pdf | word | excel). Opens the window
    synchronously (popup-blocker safe) for pdf/word. */
export async function downloadComparisonReport({ student, results, isColor = true, format = 'pdf', sessionLabel, gradeFn, branch }) {
  const win = format === 'excel' ? null : window.open('', '_blank', 'width=950,height=900');
  const html = await loadComparisonReportHtml({ student, results, isColor, format, sessionLabel, gradeFn, branch });
  examDeliver(`Comparison Report - ${student?.name || ''}`, format, html, { win });
}
export async function downloadPreschoolComparisonReport({ student, exams, isColor = true, format = 'pdf', sessionLabel, branch }) {
  const win = format === 'excel' ? null : window.open('', '_blank', 'width=950,height=900');
  const html = await loadPreschoolComparisonReportHtml({ student, exams, isColor, format, sessionLabel, branch });
  examDeliver(`Preschool Comparison Report - ${student?.name || ''}`, format, html, { win });
}
