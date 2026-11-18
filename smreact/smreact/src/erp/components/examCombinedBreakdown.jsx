/* ═══════════════════════════════════════════════════════════════════
   EXAM — Combined Assessment "How the final score is calculated" table
   Shared by the Classic, Insight and Portfolio result cards (combined mode).
   Design ported from School-Mentor-Front-end PortfolioResultCard.

   Data: ONLY the card's own `cb` (student._combined) — the live combined
   result built in Examination.jsx from getcastudentexamresult / cbrRecalc
   (mainObt, mainTotal, subBreakdown[{name, subObt, origT, weight, conv}],
   grandObt, grandTotal, ovPct). No sample data is used here; the caller
   decides whether a preview card gets SAMPLE_RC_COMBINED.

   Inline styles only (the card is printed / portaled outside .exam-root).
   ═══════════════════════════════════════════════════════════════════ */
import React from 'react';

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

const PAL_COLOR = {
  textP: '#0F172A', textM: '#64748B', bdr: '#E2E8F0',
  blu: '#1E40AF', bluL: '#EFF6FF', bluBdr: '#BFDBFE',
  pur: '#7C3AED', purL: '#F5F3FF', purBdr: 'rgba(124,58,237,.22)',
  grn: '#16A34A', grnL: '#F0FDF4', grnBdr: 'rgba(22,163,74,.22)',
  rowA: '#fff', rowB: '#F8FAFF',
};
const PAL_PLAIN = {
  textP: '#0F172A', textM: '#4B5563', bdr: '#D1D5DB',
  blu: '#374151', bluL: '#F9FAFB', bluBdr: '#D1D5DB',
  pur: '#374151', purL: '#F9FAFB', purBdr: '#D1D5DB',
  grn: '#111827', grnL: '#F9FAFB', grnBdr: '#D1D5DB',
  rowA: '#fff', rowB: '#F9FAFB',
};

/** Rows for the breakdown: main exam first, then each weighted sub exam. */
export function examCombinedRows(cb) {
  if (!cb) return [];
  const rows = [];
  if (cb.mainExName || Number(cb.mainTotal) > 0 || Number(cb.mainObt) > 0) {
    rows.push({
      name: cb.mainExName || 'Main Exam', isMain: true,
      obt: r2(cb.mainObt), outOf: r2(cb.mainTotal), weight: r2(cb.mainTotal), conv: r2(cb.mainObt),
    });
  }
  (cb.subBreakdown || []).forEach(sb => {
    rows.push({
      name: sb.name || 'Sub Exam', isMain: false,
      obt: r2(sb.subObt), outOf: r2(sb.origT), weight: r2(sb.weight), conv: r2(sb.conv),
    });
  });
  return rows;
}

/**
 * props:
 *   cb       — student._combined (live)
 *   isColor  — Colorful / Colorless
 *   pct      — final combined % shown on the card (defaults to cb.ovPct)
 *   grade    — final combined grade label shown on the card ('' → '—')
 *   pal      — optional palette override (Portfolio passes its own C)
 *   padding  — outer padding (template-specific)
 */
export default function ExamCombinedBreakdown({ cb, isColor = true, pct, grade, pal, padding = '12px 18px', title = 'Combined Result · How the final score is calculated' }) {
  if (!cb) return null;
  const C = { ...(isColor ? PAL_COLOR : PAL_PLAIN), ...(pal || {}) };
  const rows = examCombinedRows(cb);
  const finalPct = pct != null ? pct : r2(cb.ovPct);
  const thP = { padding: '6px 8px', fontSize: 8.5, fontWeight: 800, color: C.pur, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `2px solid ${C.purBdr}`, textAlign: 'center', whiteSpace: 'nowrap' };
  const tdP = { padding: '6px 8px', borderBottom: `1px solid ${C.bdr}`, fontSize: 10.5, textAlign: 'center', verticalAlign: 'middle' };

  return (
    <div className="rc-combined-breakdown" style={{ padding, background: '#fff', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: C.textM, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 12, borderRadius: 2, background: C.pur }} />
        <i className="fa-solid fa-layer-group" style={{ color: C.pur, fontSize: 9 }}></i>
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '10px 12px', fontSize: 10.5, color: C.textM, border: `1px dashed ${C.purBdr}`, borderRadius: 8 }}>
          No combined marks recorded for this student yet.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${C.purBdr}`, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '30%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} /><col style={{ width: '12%' }} /><col style={{ width: '23%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: C.purL }}>
              <th style={{ ...thP, textAlign: 'left' }}>Exam</th>
              <th style={thP}>Type</th>
              <th style={thP}>Obtained</th>
              <th style={thP}>Out of</th>
              <th style={thP}>Weightage</th>
              <th style={thP}>Counts as</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const share = r.weight ? Math.max(0, Math.min(100, (r.conv / r.weight) * 100)) : 0;
              const tone = r.isMain ? C.blu : C.pur;
              return (
                <tr key={`cbr-${i}-${r.name}`} style={{ background: i % 2 === 0 ? C.rowA : C.rowB }}>
                  <td style={{ ...tdP, textAlign: 'left', fontWeight: 700, color: C.textP, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</td>
                  <td style={tdP}>
                    <span style={{ fontSize: 8.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', background: r.isMain ? C.bluL : C.purL, color: tone, border: `1px solid ${r.isMain ? C.bluBdr : C.purBdr}` }}>{r.isMain ? 'MAIN' : 'SUB'}</span>
                  </td>
                  <td style={{ ...tdP, fontWeight: 700, color: C.textP }}>{r.obt}</td>
                  <td style={{ ...tdP, color: C.textM }}>{r.outOf}</td>
                  <td style={{ ...tdP, color: C.textM }}>{r.isMain ? 'Full' : r.weight}</td>
                  <td style={tdP}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.bluL, border: `1px solid ${C.bdr}`, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${share}%`, background: tone, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: tone, whiteSpace: 'nowrap' }}>{r.conv}<span style={{ color: C.textM, fontWeight: 600 }}>/{r.weight}</span></span>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: C.grnL }}>
              <td colSpan={4} style={{ padding: '7px 8px', fontSize: 11, fontWeight: 900, color: C.textP, borderTop: `2px solid ${C.grnBdr}` }}>
                Combined Total
                <span style={{ display: 'block', fontSize: 8.5, fontWeight: 600, color: C.textM, marginTop: 1 }}>Sub exam marks are scaled: Obtained ÷ Out of × Weightage</span>
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: C.textM, borderTop: `2px solid ${C.grnBdr}` }}>
                Grade<div style={{ fontSize: 13, fontWeight: 900, color: C.grn }}>{grade || '—'}</div>
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'center', fontSize: 12, fontWeight: 900, color: C.grn, borderTop: `2px solid ${C.grnBdr}`, whiteSpace: 'nowrap' }}>
                {r2(cb.grandObt)}/{r2(cb.grandTotal)} · {finalPct}%
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
