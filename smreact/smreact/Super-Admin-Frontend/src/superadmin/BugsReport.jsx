import React from 'react';
import { ReportShell, KpiRow, sectionTtl, th, td } from './OneLinkReports';

/* ═══════════════════════════════════════════════════════════════════
   BUGS / IMPROVEMENTS — print-preview report documents.

   Dashboard ke Bugs Summary aur Improvements Summary par chhe "View
   Report" buttons hain. Pehle wo sirf ek toast dikhate thay ("Opening
   bugs report…") aur kuch khulta hi nahi tha. Ab har button apni asal
   report kholta hai.

   Data ka source wahi EK call hai jo poori screen chalati hai:
   GET .../api/AHM_School_Progress/admin_dashboard ka `Bugs` array,
   parse ho kar api/services/dashboard.js me (kind / title / description
   / priority / module / developer / date / solved / branchId). Yahan
   koi alag call nahi jati aur koi demo row nahi hai — jo card par gina
   gaya wohi report me chhapta hai.

   Report ka daayra card ke mutabiq hota hai:
     kind   'bug' | 'improvement'          — kaunsa section
     status 'all' | 'resolved' | 'pending' — kaunsa card
     period card ke apne period selector se aata hai
   ═══════════════════════════════════════════════════════════════════ */

/* Card → report ka unwan. `resolved` ka lafz dono sections me alag hai:
   bug "resolved" hota hai, improvement "completed". */
const TITLES = {
  bug: { all: 'Bugs Report', resolved: 'Resolved Bugs Report', pending: 'Pending Bugs Report' },
  improvement: {
    all: 'Improvements Report',
    resolved: 'Completed Improvements Report',
    pending: 'Pending Improvements Report',
  },
};

const PRIORITY_TONE = { high: '#DC2626', medium: '#D97706', low: '#0284C7' };
const toneOf = (p) => PRIORITY_TONE[String(p || '').toLowerCase()] || '#64748B';

function Pill({ text, color, solid }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 800,
      letterSpacing: '.3px', textTransform: 'uppercase', whiteSpace: 'nowrap',
      color: solid ? '#fff' : color,
      background: solid ? color : `${color}1A`,
      border: solid ? 'none' : `1px solid ${color}40`,
    }}>{text}</span>
  );
}

/**
 * @param kind       'bug' | 'improvement'
 * @param status     'all' | 'resolved' | 'pending' — kis card se khuli
 * @param period     { label } — card ka chuna hua arsa
 * @param rows       is card ki rows (pehle se chhani hui)
 * @param allOfKind  isi kind ki SARI rows us arse me — KPI band ke liye,
 *                   taake "Pending" report me bhi poora manzar dikhe
 * @param schoolName (branchId) => school ka naam, ya '' jab maloom na ho
 */
export default function BugsReport({ kind, status, period, rows, allOfKind = [], schoolName }) {
  const isBug = kind === 'bug';
  const title = (TITLES[kind] || TITLES.bug)[status] || TITLES.bug.all;
  const doneWord = isBug ? 'Resolved' : 'Completed';

  const done = allOfKind.filter((r) => r.solved).length;
  const open = allOfKind.length - done;

  /* Module-wise breakdown — kis module par sab se zyada kaam pending hai,
     yeh report ka sab se kaam ka hissa hai. */
  const byModule = [];
  const idx = new Map();
  rows.forEach((r) => {
    const key = r.module || '—';
    if (!idx.has(key)) { idx.set(key, byModule.length); byModule.push({ module: key, total: 0, done: 0 }); }
    const e = byModule[idx.get(key)];
    e.total += 1;
    if (r.solved) e.done += 1;
  });
  byModule.sort((a, b) => b.total - a.total);

  const sorted = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <ReportShell
      icon={isBug ? 'fa-bug' : 'fa-lightbulb'}
      title={title}
      period={period}
      footNote={`School Mentor · Super Admin · ${isBug ? 'Bug' : 'Improvement'} Tracking`}
      meta={[`${rows.length} record${rows.length === 1 ? '' : 's'}`, `Source: admin_dashboard`]}
    >
      <KpiRow items={[
        [`Total ${isBug ? 'Bugs' : 'Improvements'}`, allOfKind.length],
        [doneWord, done, '#16A34A'],
        ['Pending', open, '#D97706'],
        ['In This Report', rows.length, '#1E3A8A'],
      ]} />

      {byModule.length > 0 && (
        <>
          <div style={sectionTtl}>Module-wise breakdown</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 26 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
                <th style={{ ...th, width: 34 }}>#</th>
                <th style={th}>Module</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>Total</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>{doneWord}</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {byModule.map((m, i) => (
                <tr key={m.module}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{m.module}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{m.total}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#16A34A', fontWeight: 700 }}>{m.done}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#D97706', fontWeight: 700 }}>{m.total - m.done}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={sectionTtl}>{isBug ? 'Bug' : 'Improvement'} details</div>
      {sorted.length === 0 ? (
        <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748B', fontSize: 12 }}>
          No {isBug ? 'bugs' : 'improvements'} recorded for {period.label}.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
              <th style={{ ...th, width: 30 }}>#</th>
              <th style={{ ...th, width: 110 }}>Module</th>
              <th style={th}>Detail</th>
              <th style={{ ...th, width: 74 }}>Priority</th>
              <th style={{ ...th, width: 96 }}>Developer</th>
              <th style={{ ...th, width: 120 }}>School</th>
              <th style={{ ...th, width: 78 }}>Date</th>
              <th style={{ ...th, width: 76, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 ? '#F8FAFC' : '#fff' }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.module}</td>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{r.title || '—'}</div>
                  {r.description && <div style={{ color: '#64748B', fontSize: 9.5, marginTop: 2 }}>{r.description}</div>}
                </td>
                <td style={td}>{r.priority ? <Pill text={r.priority} color={toneOf(r.priority)} /> : '—'}</td>
                <td style={td}>{r.developer}</td>
                {/* Branch directory load na ho saki to kam se kam id dikhe. */}
                <td style={td}>{schoolName?.(r.branchId) || (r.branchId ? `Branch ${r.branchId}` : '—')}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.date || '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <Pill text={r.solved ? doneWord : 'Pending'} color={r.solved ? '#16A34A' : '#D97706'} solid />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ReportShell>
  );
}
