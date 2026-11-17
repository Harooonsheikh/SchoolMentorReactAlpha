/* ═══════════════════════════════════════════════════════════════════
   EXAM — "DOWNLOAD ALL CARDS"
   One document: Session Progress Summary first, then every PUBLISHED result
   card of the selected session (date order, one per page). Each card shows
   its published date. Cards carry NO signatures.

   Data flow (all live, see services/examResultHistoryService.js):
     fetchResultsPublishState → keeps published rows
     buildGradeEntries        → entries (% per subject) + per-card marks data
   Card rendering reuses the caller's own card generator when given
   (`renderCard`), otherwise the built-in single-card layout below — the same
   layout/data Examination's single result-card report uses.
   ═══════════════════════════════════════════════════════════════════ */
import {
  examEsc, examR1, examSigned, examTrend, examPalette, examGradeColor, examDefaultGrade,
  examSchoolName, examYearLabel, examDeliver,
} from './examReportCommon';
import { fetchReportHeader } from '../../utils/pdfReports';
import { fetchResultsPublishState, buildGradeEntries } from '../services/examResultHistoryService';

/* ── Progress Summary (cover page) ─────────────────────────────────
   entries: [{ name, kind, kindTone, published, pct, grade, values:{row:%|null} }] */
export function buildProgressSummaryHtml({ student, entries, sessionLabel, schoolName, rowLabel = 'Subject', valuesNote = 'score %', isColor = true, fmtValue = v => `${v}%`, fmtChange = c => `${examSigned(c)}%` }) {
  const p = examPalette(isColor);
  const E = examEsc;
  const C = {
    navy: isColor ? '#1E3A8A' : '#FFFFFF', hdrFg: isColor ? '#fff' : '#111', blu: p.accent, bluL: p.accBg, bluBdr: p.accBdr,
    grn: p.grn, red: p.red, amb: p.amb, textM: p.tMuted, bdr: isColor ? '#E2E8F0' : '#DDD', rowB: p.rowEv,
  };
  const trendCol = { up: C.grn, down: C.red, flat: C.textM };
  const trendWord = { up: 'Improved', down: 'Declined', flat: 'Steady' };
  const trendIcon = { up: '&uarr;', down: '&darr;', flat: '&ndash;' };
  const kindTone = { blue: [C.bluL, C.blu], purple: [isColor ? '#F5F3FF' : '#F5F5F5', p.pur], green: [isColor ? '#F0FDF4' : '#F5F5F5', C.grn], amber: [isColor ? '#FFFBEB' : '#F5F5F5', C.amb] };

  const list = entries || [];
  if (!list.length) {
    return `<div style="padding:40px;text-align:center;color:${C.textM};font-size:13px">No published results to summarise.</div>`;
  }
  const first = list[0], last = list[list.length - 1];
  const multi = list.length > 1;
  const delta = examR1(last.pct - first.pct);
  const overall = multi ? examTrend(delta) : 'flat';
  const avg = examR1(list.reduce((a, e) => a + e.pct, 0) / list.length);
  const best = list.reduce((b, e) => (e.pct > b.pct ? e : b), list[0]);

  const rowNames = [];
  list.forEach(e => Object.keys(e.values || {}).forEach(k => { if (!rowNames.includes(k)) rowNames.push(k); }));
  const rows = rowNames.map(name => {
    const vals = list.map(e => (e.values?.[name] ?? null));
    const known = vals.filter(v => v !== null);
    const change = known.length > 1 ? examR1(known[known.length - 1] - known[0]) : 0;
    return { name, vals, change, trend: known.length > 1 ? examTrend(change) : 'flat', comparable: known.length > 1, hasData: known.length > 0 };
  }).filter(r => r.hasData);
  const comparable = rows.filter(r => r.comparable);
  const improved = [...comparable].sort((a, b) => b.change - a.change)[0];
  const declined = [...comparable].sort((a, b) => a.change - b.change)[0];

  const th = (t, al = 'center', w = '') => `<th style="padding:7px 8px;font-size:8.5px;font-weight:800;color:${C.blu};text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${C.bluBdr};text-align:${al};background:${C.bluL};${w}">${t}</th>`;
  const td = (extra = '') => `padding:7px 8px;border-bottom:1px solid ${C.bdr};font-size:10.5px;text-align:center;${extra}`;
  const chip = t => `display:inline-block;padding:2px 8px;border-radius:999px;font-size:9.5px;font-weight:800;background:${isColor ? (t === 'up' ? '#F0FDF4' : t === 'down' ? '#FEF2F2' : '#F1F5F9') : '#F5F5F5'};color:${trendCol[t]};white-space:nowrap`;
  const sec = (t, col) => `<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${C.textM};margin:0 0 8px;display:flex;align-items:center;gap:8px"><span style="width:3px;height:12px;border-radius:2px;background:${col};display:inline-block"></span>${t}</div>`;

  const kpis = [
    [`First &middot; ${E(first.name)}`, `${first.pct}%`, '#374151'],
    [`Latest &middot; ${E(last.name)}`, `${last.pct}%`, C.blu],
    ['Change', multi ? `${examSigned(delta)}%` : '&mdash;', trendCol[overall]],
    ['Average', `${avg}%`, '#374151'],
    [`Best &middot; ${E(best.name)}`, `${best.pct}%`, C.grn],
  ].map((k, i) => `<td style="padding:12px 8px;text-align:center;${i < 4 ? `border-right:1px solid ${C.bdr}` : ''}"><div style="font-size:18px;font-weight:900;color:${k[2]}">${k[1]}</div><div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:${C.textM};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${k[0]}</div></td>`).join('');

  const examRows = list.map((e, i) => {
    const d = i ? examR1(e.pct - list[i - 1].pct) : null;
    const t = d === null ? null : examTrend(d);
    const [kBg, kCol] = kindTone[e.kindTone] || kindTone.blue;
    return `<tr style="background:${i % 2 ? C.rowB : '#fff'}">
      <td style="${td(`color:${C.textM};font-weight:700`)}">${i + 1}</td>
      <td style="${td('text-align:left;font-weight:700')}">${E(e.name)}</td>
      <td style="${td()}">${e.kind ? `<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:999px;background:${kBg};color:${kCol};white-space:nowrap">${E(e.kind)}</span>` : ''}</td>
      <td style="${td(`color:${C.textM};white-space:nowrap`)}">${E(e.published || '')}</td>
      <td style="${td(`font-weight:900;color:${C.blu}`)}">${e.pct}%</td>
      <td style="${td('font-weight:800')}">${E(e.grade || '—')}</td>
      <td style="${td()}">${t ? `<span style="${chip(t)}">${trendIcon[t]} ${examSigned(d)}%</span>` : `<span style="color:${C.textM};font-size:9.5px">First exam</span>`}</td>
    </tr>`;
  }).join('');

  const rowTable = rows.length ? `<div style="padding:14px 24px 6px">
      ${sec(`${E(rowLabel)} by ${E(rowLabel.toLowerCase())}${valuesNote ? ` <span style="text-transform:none;letter-spacing:0;font-weight:600">&middot; ${E(valuesNote)}</span>` : ''}`, p.pur)}
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.bluBdr};table-layout:fixed">
        <thead><tr>${th(E(rowLabel), 'left', 'width:26%')}${list.map(e => th(`<span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(e.name)}</span>`)).join('')}${th('Change', 'center', 'width:13%')}${th('Trend', 'center', 'width:16%')}</tr></thead>
        <tbody>${rows.map((r, i) => {
    let prev = null;
    return `<tr style="background:${i % 2 ? C.rowB : '#fff'}">
            <td style="${td('text-align:left;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}">${E(r.name)}</td>
            ${r.vals.map((v, j) => {
    const up = v !== null && prev !== null && v > prev;
    const dn = v !== null && prev !== null && v < prev;
    if (v !== null) prev = v;
    return `<td style="${td(`font-weight:${j === r.vals.length - 1 ? 800 : 600};color:${up ? C.grn : dn ? C.red : '#374151'}`)}">${v === null ? '&mdash;' : fmtValue(v)}</td>`;
  }).join('')}
            <td style="${td(`font-weight:800;color:${trendCol[r.trend]}`)}">${r.comparable ? fmtChange(r.change) : '&mdash;'}</td>
            <td style="${td()}"><span style="${chip(r.trend)}">${trendIcon[r.trend]} ${trendWord[r.trend]}</span></td>
          </tr>`;
  }).join('')}</tbody>
      </table>
      <div style="font-size:8.5px;color:${C.textM};margin-top:6px">Green / red values show a rise / fall against the previous exam. Change compares the first and latest exam.</div>
    </div>` : `<div style="padding:14px 24px;font-size:11px;color:${C.textM}">${E(rowLabel)}-level marks are not available for these exams; only overall scores are summarised.</div>`;

  const callouts = multi && comparable.length ? `<div style="display:flex;gap:12px;padding:12px 24px 18px">
      <div style="flex:1;padding:10px 12px;border-radius:10px;background:${isColor ? '#F0FDF4' : '#fff'};border:1px solid ${isColor ? 'rgba(22,163,74,.22)' : '#ddd'}">
        <div style="font-size:9px;font-weight:800;color:${C.grn};text-transform:uppercase;letter-spacing:.5px">Most improved</div>
        <div style="font-size:12.5px;font-weight:800;margin-top:4px">${improved && improved.change > 0 ? `${E(improved.name)} (${fmtChange(improved.change)})` : 'Nothing improved yet'}</div></div>
      <div style="flex:1;padding:10px 12px;border-radius:10px;background:${isColor ? (declined && declined.change < 0 ? '#FEF2F2' : '#FFFBEB') : '#fff'};border:1px solid ${isColor ? 'rgba(217,119,6,.22)' : '#ddd'}">
        <div style="font-size:9px;font-weight:800;color:${declined && declined.change < 0 ? C.red : C.amb};text-transform:uppercase;letter-spacing:.5px">Needs attention</div>
        <div style="font-size:12.5px;font-weight:800;margin-top:4px">${declined && declined.change < 0 ? `${E(declined.name)} (${fmtChange(declined.change)})` : 'Nothing declined'}</div></div>
    </div>` : '';

  return `<div style="font-family:'Segoe UI',Arial,sans-serif;background:#fff;width:100%;max-width:720px;margin:0 auto;color:#0F172A">
    <div style="background:${C.navy};color:${C.hdrFg};padding:22px 26px;${isColor ? '' : `border-bottom:2px solid #111`}">
      <table style="width:100%"><tr>
        <td style="vertical-align:top"><div style="font-size:15px;font-weight:900">${E(schoolName || '')}</div>
        <div style="font-size:10px;opacity:.75;margin-top:2px">Session Progress Summary${sessionLabel ? ` &middot; ${E(sessionLabel)}` : ''} &middot; Published results</div></td>
        ${multi ? `<td style="text-align:right;vertical-align:top"><div style="display:inline-block;text-align:center;border:1px solid ${isColor ? 'rgba(255,255,255,.3)' : '#999'};border-radius:12px;padding:8px 14px"><div style="font-size:18px;font-weight:900">${trendIcon[overall]} ${examSigned(delta)}%</div><div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.75">${trendWord[overall]} this session</div></div></td>` : ''}
      </tr></table>
      <div style="margin-top:16px"><span style="font-size:22px;font-weight:900">${E(student?.name || '')}</span>
      <span style="font-size:10.5px;opacity:.8;margin-left:10px">${[student?.father, student?.rollNo ? `Roll ${student.rollNo}` : '', student?.cls].filter(Boolean).map(E).join(' &middot; ')}</span></div>
    </div>
    <table style="width:100%;border-bottom:1px solid ${C.bdr};table-layout:fixed"><tr>${kpis}</tr></table>
    <div style="padding:16px 24px 6px">
      ${sec('Exam by exam', C.blu)}
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.bluBdr}">
        <thead><tr>${th('#')}${th('Exam', 'left')}${th('Type')}${th('Published')}${th('Score')}${th('Grade')}${th('vs Previous')}</tr></thead>
        <tbody>${examRows}</tbody>
      </table>
    </div>
    ${rowTable}
    ${callouts}
    <div style="padding:8px 24px;background:${C.bluL};border-top:1px solid ${C.bluBdr};font-size:8.5px;color:${C.textM}">${list.length} result card${list.length === 1 ? '' : 's'} follow on the next pages</div>
  </div>`;
}

/* ── One result card (built-in layout, no signatures) ───────────────
   data: { subjects, totals, obtained, remarks, finalRemark } from
   fetchStudentResultData; entry: from buildGradeEntries. */
export function buildResultCardHtml({ student, entry, data, branch, isColor = true, gradeFn = examDefaultGrade, finalRemarkFn, useAutoComment = false }) {
  const p = examPalette(isColor);
  const E = examEsc;
  const d = data || {};
  const subjects = d.subjects || [];
  const subjTotal = subjects.reduce((a, s) => a + (Number(d.totals?.[s]) || 0), 0);
  const subjObt = subjects.reduce((a, s) => a + (Number(d.obtained?.[s]) || 0), 0);
  const hasMarks = subjects.length > 0 && subjTotal > 0;
  const ovPct = hasMarks ? examR1((subjObt / subjTotal) * 100) : entry.pct;
  const g = hasMarks ? gradeFn(subjObt, subjTotal) : gradeFn(entry.pct, 100);
  const gradeStr = g ? g.grade : (entry.grade || '—');
  const finalRem = d.finalRemark || (finalRemarkFn ? finalRemarkFn(ovPct) : '');

  const cell = (extra = '') => `padding:7px 10px;border-bottom:1px solid ${p.accBdr};${extra}`;
  const rows = subjects.map((s, i) => {
    const tot = Number(d.totals?.[s]) || 0;
    const obt = Number(d.obtained?.[s]) || 0;
    const pct = tot ? Math.round((obt / tot) * 100) : 0;
    const sg = (obt > 0 && tot) ? gradeFn(obt, tot) : null;
    const cmt = (!useAutoComment && d.remarks?.[s]) || (sg ? sg.comment : '') || '';
    return `<tr style="background:${i % 2 === 0 ? '#fff' : p.rowEv}">
      <td style="${cell(`text-align:center;color:${p.tMuted};font-weight:700`)}">${i + 1}</td>
      <td style="${cell('font-weight:700;color:#0F172A')}">${E(s)}</td>
      <td style="${cell(`text-align:center;color:${p.tMuted}`)}">${tot}</td>
      <td style="${cell(`text-align:center;font-weight:800;color:${p.accent}`)}">${obt}</td>
      <td style="${cell(`text-align:center;font-weight:700;color:${pct >= 80 ? p.grn : pct >= 60 ? p.amb : p.red}`)}">${pct}%</td>
      <td style="${cell('text-align:center')}"><span style="display:inline-block;min-width:22px;padding:2px 7px;border-radius:5px;background:${examGradeColor(sg ? sg.grade : 'F', isColor)};color:#fff;font-size:10px;font-weight:800">${sg ? E(sg.grade) : '&mdash;'}</span></td>
      <td style="${cell(`font-size:10px;color:${p.tMuted}`)}"><em>${E(String(cmt).slice(0, 60))}</em></td>
    </tr>`;
  }).join('');

  const hth = (t, al = 'center') => `<th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:${al};text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">${t}</th>`;
  const info = [
    ['Student', student?.name], ['Father', student?.father], ['Class', student?.cls],
    ['Exam', entry.name], ['Type', entry.kind === 'COMBINED' ? 'Combined Assessment' : 'Single Assessment'],
  ].filter(([, v]) => v).map(([k, v]) => `<td style="padding:8px 14px;border-right:1px solid ${p.accBdr}"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${p.tMuted};margin-bottom:2px">${k}</div><div style="font-size:12px;font-weight:800;color:${p.accent}">${E(v)}</div></td>`).join('');

  return `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#0F172A">
    <div style="background:${isColor ? '#1E3A8A' : '#fff'};color:${isColor ? '#fff' : '#111'};padding:16px 22px;${isColor ? '' : 'border-bottom:2px solid #111'}">
      <table style="width:100%"><tr>
        <td><div style="font-size:15px;font-weight:900">${E(examSchoolName(branch))}</div>
        <div style="font-size:10px;opacity:.75;margin-top:2px">Result Card${examYearLabel(branch) ? ` &middot; ${E(examYearLabel(branch))}` : ''}</div></td>
        <td style="text-align:right;font-size:10px;opacity:.9">Published on<br><b style="font-size:12px">${E(entry.published || '—')}</b></td>
      </tr></table>
    </div>
    <table style="width:100%;border:1px solid ${p.accBdr};margin:14px 0"><tr>${info}</tr></table>
    ${hasMarks ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${p.tMuted};margin-bottom:8px">Subject-wise result</div>
    <table style="width:100%;border:1px solid ${p.accBdr};border-collapse:collapse;table-layout:fixed">
      <colgroup><col style="width:28px"><col><col style="width:62px"><col style="width:74px"><col style="width:58px"><col style="width:62px"><col></colgroup>
      <thead><tr style="background:${p.accBg}">${hth('#')}${hth('Subject', 'left')}${hth('Total')}${hth('Obtained')}${hth('%')}${hth('Grade')}${hth('Comment', 'left')}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:${p.accBg}">
        <td colspan="2" style="padding:7px 9px;font-size:11px;font-weight:800;color:${p.accent};border-top:2px solid ${p.accBdr}">Grand Total</td>
        <td style="padding:7px 9px;text-align:center;font-weight:800;color:${p.accent};border-top:2px solid ${p.accBdr}">${subjTotal}</td>
        <td style="padding:7px 9px;text-align:center;font-weight:900;color:${p.accent};border-top:2px solid ${p.accBdr}">${subjObt}</td>
        <td style="padding:7px 9px;text-align:center;font-weight:900;color:${p.grn};border-top:2px solid ${p.accBdr}">${ovPct}%</td>
        <td style="padding:7px 9px;text-align:center;border-top:2px solid ${p.accBdr}"><span style="display:inline-block;min-width:24px;padding:3px 9px;border-radius:6px;background:${examGradeColor(gradeStr, isColor)};color:#fff;font-size:11px;font-weight:800">${E(gradeStr)}</span></td>
        <td style="border-top:2px solid ${p.accBdr}"></td>
      </tr></tfoot>
    </table>` : `<div style="padding:18px;border:1px solid ${p.accBdr};border-radius:8px;background:${p.accBg};text-align:center">
      <div style="font-size:26px;font-weight:900;color:${p.accent}">${ovPct}%</div>
      <div style="font-size:12px;font-weight:700;margin-top:4px">Overall grade ${E(gradeStr)}</div>
      <div style="font-size:10.5px;color:${p.tMuted};margin-top:6px">Subject-wise marks are not available for this assessment.</div></div>`}
    ${finalRem ? `<div style="margin-top:12px;padding:10px 14px;border:1px solid ${p.accBdr};border-radius:8px;background:${p.accBg}">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${p.tMuted};margin-bottom:4px">Final Remarks</div>
      <div style="font-size:11.5px;line-height:1.55">${E(String(finalRem).slice(0, 240))}</div></div>` : ''}
  </div>`;
}

/* ── Bundle: summary page + one page per card, in one print document ──
   pages: array of inner HTML strings. The toolbar uses window.print() so the
   ERP's deliverReport can turn the same document into the Word preview. */
export function buildBundleHtml({ title, pages, includeToolbar = true }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${examEsc(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;font-family:'Segoe UI',Arial,sans-serif;color:#0F172A}
@page{size:A4 portrait;margin:12mm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}
.wrap{width:100%;max-width:210mm;margin:0 auto}
.rc-page{break-before:page;page-break-before:always}
@media screen{.rc-page{margin-top:24px}}
.rc-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.rc-bar button{background:#1E40AF;color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.rc-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
</style></head><body>
${pages.map((h, i) => `<div class="wrap${i ? ' rc-page' : ''}">${h}</div>`).join('\n')}
${includeToolbar ? `<div class="rc-bar no-print"><button onclick="window.print()">🖨 Print / Save as PDF</button><button class="close-btn" onclick="window.close()">Close</button></div>` : ''}
</body></html>`;
}

/** Build the whole "Download All Cards" HTML (live data).
    student: { id, name, father, rollNo, cls, gradeId, sectionId }
    results: Result History rows for the selected SESSION (caller filters by session).
    Options: gradeFn (Examination's rcGetGrade), finalRemarkFn (rcGetFinalRemarks),
    renderCard(entry, data, ctx) → html | falsy  (use to plug Examination's own
    Classic/Insight card via renderToStaticMarkup; falsy → built-in card),
    strict (true → only results confirmed published; default also keeps unknown).
    Returns { html, count, skipped } — count 0 means nothing published. */
export async function buildAllCardsHtml({ student, results, sessionLabel, isColor = true, gradeFn = examDefaultGrade, finalRemarkFn, renderCard, branch, strict = false, includeToolbar = true, useAutoComment = false }) {
  const [hdr, withPub] = await Promise.all([
    branch ? Promise.resolve(branch) : fetchReportHeader(),
    fetchResultsPublishState(student, results || []),
  ]);
  const { entries, cardData } = await buildGradeEntries(student, withPub, { gradeFn, strict });
  const skipped = (results || []).length - entries.length;
  if (!entries.length) return { html: '', count: 0, skipped };
  const summary = buildProgressSummaryHtml({
    student, entries, sessionLabel, schoolName: examSchoolName(hdr), isColor,
    rowLabel: 'Subject', valuesNote: 'marks as % of total',
  });
  const cards = entries.map((entry, i) => {
    const custom = renderCard ? renderCard(entry, cardData[i], { student, branch: hdr, isColor, sessionLabel }) : null;
    if (custom) {
      return `<div style="font-size:10px;color:#64748B;text-align:right;margin-bottom:4px">Published on <b>${examEsc(entry.published)}</b></div>${custom}`;
    }
    return buildResultCardHtml({ student, entry, data: cardData[i], branch: hdr, isColor, gradeFn, finalRemarkFn, useAutoComment });
  });
  const html = buildBundleHtml({
    title: `All Result Cards — ${student?.name || ''}`,
    pages: [summary, ...cards],
    includeToolbar,
  });
  return { html, count: entries.length, skipped };
}

/** One call: build + open (format 'pdf' | 'word'). Returns { count } or null when
    nothing is published (caller should toast). The window opens synchronously so
    pop-up blockers allow it. */
export async function downloadAllCards({ student, results, sessionLabel, isColor = true, format = 'pdf', gradeFn, finalRemarkFn, renderCard, branch, strict = false, useAutoComment = false, onEmpty }) {
  const win = window.open('', '_blank', 'width=960,height=820');
  const out = await buildAllCardsHtml({ student, results, sessionLabel, isColor, gradeFn, finalRemarkFn, renderCard, branch, strict, useAutoComment });
  if (!out.count) {
    if (win) { try { win.close(); } catch (e) { /* ignore */ } }
    if (onEmpty) onEmpty();
    return null;
  }
  examDeliver(`All Result Cards - ${student?.name || ''}`, format === 'word' ? 'word' : 'pdf', out.html, { win, width: 960, height: 820 });
  return { count: out.count, skipped: out.skipped };
}
