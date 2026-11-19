import React, { useEffect, useRef, useState } from 'react';
import Tooltip from './Tooltip';

/* ═══════════════════════════════════════════════════════════════════
   MAKE PAPER modal — redesign helpers (ported from School-Mentor-Front-end
   commit 141f4ef). Pure UI: they only READ the MakePaperModal's existing
   blocksState tabs / notebookDetails — no new data model, no API calls.
   ═══════════════════════════════════════════════════════════════════ */

/* How many questions of this type are already added (items>0), and their
   total marks — drives the "✓ N added" badges and "Added so far" chips. */
export function addedOf(sectionState, typeKey) {
  const block = sectionState?.[typeKey];
  let n = 0, m = 0;
  (block?.tabs || []).forEach(t => {
    if (+t.items > 0) {
      n++;
      const visible = Math.max(0, (+t.items || 0) - (+t.choices || 0));
      m += visible * (+t.marks || 0);
    }
  });
  return { n, m };
}

/* Approved-item summary for one question type — same arithmetic as the ERP
   QBlockAccordion badge: API items (notebookDetails[apiKey]) grouped by unit →
   mainQuestion, summing submittedCount once per group; falls back to the
   static unit data when the API returned nothing for this type. */
export function pgTypeApproved(apiItems, staticUnits, typeKey) {
  if (Array.isArray(apiItems) && apiItems.length > 0) {
    const unitMap = {};
    apiItems.forEach(item => {
      const u = item.unitName || 'Unit';
      const mq = item.mainQuestion || 'Section A';
      if (!unitMap[u]) unitMap[u] = {};
      if (!unitMap[u][mq]) unitMap[u][mq] = item.submittedCount || 0;
    });
    const units = Object.values(unitMap);
    const total = units.reduce((s, g) => s + Object.values(g).reduce((a, b) => a + b, 0), 0);
    return { total, units: units.length };
  }
  let total = 0, units = 0;
  (staticUnits || []).forEach(u => {
    const qt = u.qtypes?.[typeKey];
    if (qt) { units++; qt.forEach(q => { total += q.submitted || 0; }); }
  });
  return { total, units };
}

/* ── Live preview ── */
function pgLineStyle(key) {
  return key === 'mcq' ? 'mcq' : key === 'true_false' ? 'tf' : (key === 'fill_blanks' || key === 'circle_word') ? 'blank' : 'line';
}
/* HTML → plain text (live preview ke liye). */
const lpText = (s) => String(s == null ? '' : s)
  .replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|div|h[1-6]|li)>/gi, ' ').replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
const lpRowText = (r) => lpText(r?.question || r?.word || r?.sentence || r?.statement || r?.topic || r?.title
  || r?.comprehensionStatement || r?.subject || r?.punctuation || r?.mainQuestion || '');
const lpHasOpt = (v) => { const t = lpText(v); return !!t && !/^[-–—_.\s]+$/.test(t) && !/^(null|undefined|n\/a)$/i.test(t); };

function LivePaperQBody({ typeKey, tab, sample }) {
  const items   = +tab.items   || 0;
  const choices = +tab.choices || 0;
  const visible = Math.max(0, items - choices);
  const k = pgLineStyle(typeKey);
  /* Asal questions (selected units/main questions ke eligible items) — sath sath preview.
     Items abhi set nahi → jitne eligible hain un mein se pehle chand dikhao. */
  const pool = (sample || []).filter(r => lpRowText(r));
  if (pool.length) {
    const limit = k === 'mcq' ? 3 : 4;
    const want  = visible > 0 ? visible : pool.length;
    const rows  = pool.slice(0, Math.min(want, limit));
    const more  = (visible > 0 ? visible : pool.length) - rows.length;
    return (
      <div className="pgx-p-body">
        {rows.map((r, i) => (
          <div key={i} style={{ margin: '4px 0', fontSize: 11.5, lineHeight: 1.45 }}>
            <div>{i + 1}. {lpRowText(r)}</div>
            {k === 'mcq' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', paddingLeft: 14, fontSize: 11 }}>
                {['option1', 'option2', 'option3', 'option4'].map((o, oi) => (lpHasOpt(r[o]) ? <span key={o}>({String.fromCharCode(65 + oi)}) {lpText(r[o])}</span> : null))}
              </div>
            )}
            {k === 'tf' && <div style={{ paddingLeft: 14, fontSize: 11, opacity: .75 }}>True / False</div>}
          </div>
        ))}
        {more > 0 && <div className="pgx-p-more">+ {more} more question{more !== 1 ? 's' : ''}</div>}
        {visible === 0 && <div className="pgx-p-more">Set the number of questions to finalise this block</div>}
      </div>
    );
  }
  const show = Math.min(visible, k === 'mcq' ? 3 : 4);
  const lines = [];
  for (let i = 1; i <= show; i++) {
    if (k === 'mcq') {
      lines.push(
        <React.Fragment key={i}>
          <div className="pgx-p-line" data-n={i}><i></i></div>
          <div className="pgx-p-opts"><u></u><u></u><u></u><u></u></div>
        </React.Fragment>
      );
    } else {
      lines.push(<div key={i} className={`pgx-p-line${k === 'blank' ? ' blank' : ''}`} data-n={i}><i></i></div>);
    }
  }
  return (
    <div className="pgx-p-body">
      {lines}
      {k === 'tf' && show > 0 && <div className="pgx-p-tf">True / False</div>}
      {visible > show && <div className="pgx-p-more">+ {visible - show} more question{visible - show !== 1 ? 's' : ''}</div>}
    </div>
  );
}

/* Every tab with items>0 across a section's type blocks, in type order. */
export function livePaperEntries(typeDefs, sectionState) {
  const out = [];
  typeDefs.forEach(t => {
    const block = sectionState?.[t.key];
    /* Sath sath preview: block tab bhi dikhe jab units chune hon (items abhi 0 hon tab bhi). */
    (block?.tabs || []).forEach(tab => {
      const hasUnits = Object.keys(tab.unitSelections || {}).length > 0;
      if (+tab.items > 0 || hasUnits) out.push({ t, tab });
    });
  });
  return out;
}
/* Keep the preview's display order in sync with the current entries. */
export function reconcileOrder(order, ids) {
  const filtered = (order || []).filter(id => ids.includes(id));
  ids.forEach(id => { if (!filtered.includes(id)) filtered.push(id); });
  return filtered;
}
export function orderEntries(entries, order) {
  const map = new Map(entries.map(e => [e.tab.entryId, e]));
  return order.map(id => map.get(id)).filter(Boolean);
}

export function LivePaperSection({ letter, name, entries, used, target, onMove, labelOf, sampleOf }) {
  if (!entries.length) return null;
  return (
    <>
      <div className="pgx-p-sec"><span>Section {letter} — {name}</span><span>{used}{target ? ` / ${target}` : ''} marks</span></div>
      {entries.map((e, i) => {
        const visible = Math.max(0, (+e.tab.items || 0) - (+e.tab.choices || 0));
        const marks = visible * (+e.tab.marks || 0);
        const label = labelOf ? labelOf(e.t) : e.t.label;
        return (
          <div key={e.tab.entryId} className="pgx-p-q">
            <div className="pgx-p-qh">
              <b>Q{i + 1}.</b>
              <em className={e.tab.instr ? '' : 'ph'}>{e.tab.instr || `${label} — add instruction`}</em>
              <span>[{marks}]</span>
              <span className="pgx-mvs">
                <Tooltip text="Move up">
                  <button type="button" className="pgx-mv" disabled={i === 0} onClick={() => onMove(e.tab.entryId, -1)}>▲</button>
                </Tooltip>
                <Tooltip text="Move down">
                  <button type="button" className="pgx-mv" disabled={i === entries.length - 1} onClick={() => onMove(e.tab.entryId, 1)}>▼</button>
                </Tooltip>
              </span>
            </div>
            <LivePaperQBody typeKey={e.t.key} tab={e.tab} sample={sampleOf ? sampleOf(e.t.key, e.tab) : null} />
            {+e.tab.choices > 0 && <span className="pgx-p-note">+ {e.tab.choices} choice question{+e.tab.choices !== 1 ? 's' : ''}</span>}
          </div>
        );
      })}
    </>
  );
}

/* Custom "Question type" dropdown — one type is worked on at a time. */
export function PgxTypeDropdown({ options, value, onSelect, placeholder = 'Choose a question type', noneText = 'No items yet' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const current = options.find(o => o.key === value);
  return (
    <div className={`pgx-dd${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className={`pgx-dd-btn${current ? '' : ' empty'}`} onClick={() => setOpen(o => !o)}>
        <span className="l">{current ? current.label : placeholder}</span>
        <i className="pgx-caret"></i>
      </button>
      <div className="pgx-dd-list">
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            className={`pgx-dd-opt${o.key === value ? ' sel' : ''}`}
            disabled={o.disabled}
            onClick={() => { if (!o.disabled) { onSelect(o.key); setOpen(false); } }}
          >
            <span className="l">{o.label}</span>
            <em>{o.added ? `✓ ${o.added} added` : ''}</em>
            <span className={`r${o.disabled ? ' none' : ''}`}>{o.disabled ? noneText : o.countText}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
