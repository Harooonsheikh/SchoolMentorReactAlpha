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
function LivePaperQBody({ typeKey, tab }) {
  const items   = +tab.items   || 0;
  const choices = +tab.choices || 0;
  const visible = Math.max(0, items - choices);
  const k = pgLineStyle(typeKey);
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
    (block?.tabs || []).forEach(tab => { if (+tab.items > 0) out.push({ t, tab }); });
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

export function LivePaperSection({ letter, name, entries, used, target, onMove, labelOf }) {
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
            <LivePaperQBody typeKey={e.t.key} tab={e.tab} />
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
