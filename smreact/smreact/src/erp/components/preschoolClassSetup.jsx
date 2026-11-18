/* ═══════════════════════════════════════════════════════════════════
   Result Setup → Preschool / Montessori → "Setup Preschool Classes".

   One branch-wide list of which class-sections are assessed as
   Preschool / Montessori and against which SLO level (Playgroup,
   Nursery or KG). Every other class is Grade 1-12. Preschool classes
   are meant to be left out of Combined Assessment Result.

   Persistence: LOCAL-ONLY for now (see services/preschoolClassSetupStore.js
   — no backend endpoint for a school-wide mapping exists yet).
   Class list: live (get-classlist-sectionlist-studentlist-by-branch).
   Edit gate: existing 'Examination' › 'Result Setup' › 'Edit' permission,
   the Examination module read-only flag and the session guard.

   All CSS is scoped under `.preschool-setup` (and
   `.preschool-setup-portal` for the confirm dialog, which otherwise uses
   the Examination module's existing .confirm-* classes).
   ═══════════════════════════════════════════════════════════════════ */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePermissions } from '../context/PermissionsContext';
import { useModuleReadOnly } from '../pages/Settings/settingsStore';
import {
  getPreschoolClassSetup,
  savePreschoolClassSetup,
  loadBranchClassSections,
  preschoolClassKey,
  examSessionLockReason,
} from '../services/preschoolClassSetupStore';

const PSC_CSS = `
.preschool-setup .psc-info {
  display:flex; gap:10px; padding:12px 14px; margin-bottom:14px; border-radius:10px;
  background:rgba(124,58,237,.06); border:1.5px solid rgba(124,58,237,.18);
  font-size:12px; line-height:1.6; color:var(--text-secondary);
}
.preschool-setup .psc-info > i { color:#7C3AED; margin-top:3px; }
.preschool-setup .psc-warn {
  display:flex; gap:10px; padding:10px 14px; margin-bottom:12px; border-radius:10px;
  background:rgba(217,119,6,.07); border:1.5px solid rgba(217,119,6,.22);
  font-size:12px; line-height:1.55; color:var(--text-secondary);
}
.preschool-setup .psc-warn > i { color:#D97706; margin-top:2px; }
.preschool-setup .psc-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.preschool-setup .psc-search { flex:1; min-width:200px; position:relative; }
.preschool-setup .psc-search i {
  position:absolute; left:12px; top:50%; transform:translateY(-50%);
  font-size:12px; color:var(--text-muted);
}
.preschool-setup .psc-search input {
  width:100%; box-sizing:border-box; height:38px; padding:0 12px 0 34px;
  border:1.5px solid var(--border-light); border-radius:9px;
  background:var(--bg-card); color:var(--text-primary);
  font-family:inherit; font-size:13px; outline:none;
}
.preschool-setup .psc-search input:focus { border-color:var(--brand-primary, #1E40AF); }
.preschool-setup .psc-filter {
  display:flex; gap:4px; padding:4px; border-radius:10px;
  background:var(--bg-card); border:1.5px solid var(--border-light);
}
.preschool-setup .psc-filter-btn {
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 12px; border-radius:7px; border:none; cursor:pointer;
  background:transparent; color:var(--text-muted);
  font-family:inherit; font-size:12px; font-weight:700; white-space:nowrap;
}
.preschool-setup .psc-filter-btn span {
  min-width:18px; padding:0 5px; border-radius:999px;
  background:var(--bg-muted); color:var(--text-secondary); font-size:10.5px;
}
.preschool-setup .psc-filter-btn:hover:not(.active) { color:var(--text-primary); }
.preschool-setup .psc-filter-btn.active { background:var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF)); color:#fff; }
.preschool-setup .psc-filter-btn.active span { background:rgba(255,255,255,.22); color:#fff; }
.preschool-setup .psc-table {
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:14px; overflow:hidden; box-shadow:var(--shadow-sm);
}
.preschool-setup .psc-head, .preschool-setup .psc-row {
  display:grid; grid-template-columns:56px minmax(140px,1.4fr) 110px minmax(200px,1fr) minmax(170px,1fr);
  align-items:center; gap:12px; padding:0 20px;
}
.preschool-setup .psc-head {
  min-height:44px; background:var(--bg-muted);
  font-size:10.5px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; color:var(--text-secondary);
}
.preschool-setup .psc-row { min-height:58px; border-top:1px solid var(--border-light); transition:background .15s ease; }
.preschool-setup .psc-row.on { background:rgba(124,58,237,.04); }
.preschool-setup .psc-sno {
  width:28px; height:28px; border-radius:8px;
  display:inline-flex; align-items:center; justify-content:center;
  background:var(--bg-muted); color:var(--brand-primary, #1E40AF); font-size:12px; font-weight:800;
}
.preschool-setup .psc-cls { font-size:13px; font-weight:700; color:var(--text-primary); }
.preschool-setup .psc-sec {
  display:inline-flex; padding:2px 10px; border-radius:999px;
  background:rgba(124,58,237,.08); border:1px solid rgba(124,58,237,.25);
  color:#7C3AED; font-size:11.5px; font-weight:700;
}
.preschool-setup .psc-type { display:flex; align-items:center; gap:10px; }
.preschool-setup .psc-switch {
  position:relative; width:38px; height:22px; flex-shrink:0;
  border-radius:999px; border:none; padding:0; cursor:pointer;
  background:#CBD5E1; transition:background .18s ease;
}
.preschool-setup .psc-switch:disabled { cursor:not-allowed; opacity:.5; }
.preschool-setup .psc-switch-knob {
  position:absolute; top:3px; left:3px; width:16px; height:16px;
  border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25);
  transition:transform .18s ease;
}
.preschool-setup .psc-row.on .psc-switch { background:#7C3AED; }
.preschool-setup .psc-row.on .psc-switch-knob { transform:translateX(16px); }
.preschool-setup .psc-switch:focus-visible { outline:2px solid #7C3AED; outline-offset:2px; }
.preschool-setup .psc-badge {
  display:inline-flex; align-items:center; gap:6px;
  padding:4px 10px; border-radius:999px; white-space:nowrap;
  font-size:11px; font-weight:700; line-height:1.4;
}
.preschool-setup .psc-badge i { font-size:10px; }
.preschool-setup .psc-badge.grade { background:rgba(var(--brand-primary-rgb, 30,58,138), .1); color:var(--brand-solid, #1E40AF); }
.preschool-setup .psc-badge.preschool { background:rgba(124,58,237,.1); color:#7C3AED; }
.preschool-setup .psc-level { width:100%; max-width:220px; height:34px; padding-top:0; padding-bottom:0; }
.preschool-setup .psc-tag { font-size:12px; color:var(--text-muted); }
.preschool-setup .psc-empty { padding:28px; text-align:center; font-size:12.5px; color:var(--text-muted); }
.preschool-setup .psc-savebar {
  position:sticky; bottom:12px; z-index:5;
  display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:wrap;
  margin-top:14px; padding:12px 16px; border-radius:12px;
  background:var(--bg-card); border:1.5px solid rgba(124,58,237,.3);
  box-shadow:0 10px 30px rgba(15,23,42,.14);
}
.preschool-setup .psc-savebar > span { margin-right:auto; font-size:12.5px; font-weight:600; color:var(--text-secondary); }
.preschool-setup .psc-savebar > span i { color:#D97706; margin-right:6px; }
[data-theme="dark"] .preschool-setup .psc-switch { background:#334155; }
[data-theme="dark"] .preschool-setup .psc-row.on .psc-switch { background:#7C3AED; }
[data-theme="dark"] .preschool-setup .psc-sec { color:#C4B5FD; border-color:rgba(167,139,250,.35); }
[data-theme="dark"] .preschool-setup .psc-badge.preschool { background:rgba(167,139,250,.14); color:#C4B5FD; }
@media (max-width: 768px) {
  .preschool-setup .psc-head { display:none; }
  .preschool-setup .psc-row {
    grid-template-columns:36px 1fr auto; grid-template-areas:"no cls sec" "type type type" "lvl lvl lvl";
    padding:12px 14px; row-gap:10px;
  }
  .preschool-setup .psc-row > :nth-child(1) { grid-area:no; }
  .preschool-setup .psc-row > :nth-child(2) { grid-area:cls; }
  .preschool-setup .psc-row > :nth-child(3) { grid-area:sec; }
  .preschool-setup .psc-row > :nth-child(4) { grid-area:type; }
  .preschool-setup .psc-row > :nth-child(5) { grid-area:lvl; }
  .preschool-setup .psc-level { max-width:none; }
  .preschool-setup .psc-savebar > span { width:100%; }
}
.preschool-setup-portal .confirm-ring::before { border-top-color:#7C3AED; border-right-color:#7C3AED; }
.preschool-setup-portal .confirm-icon-wrap { box-shadow:0 8px 24px rgba(124,58,237,.2); }
`;

/* Best guess of a level from a class name, used when a row is switched on. */
function guessLevel(name, pLevels) {
  const k = String(name || '').toLowerCase().replace(/\s+/g, '');
  const ids = (pLevels || []).map(l => l.id);
  const pick = id => (ids.includes(id) ? id : null);
  if (k.includes('play') || k.includes('pg') || k.includes('pre1')) return pick('pg') || ids[0] || 'pg';
  if (k.includes('nur') || k.includes('pre2')) return pick('nur') || ids[0] || 'nur';
  if (k.includes('kg') || k.includes('kinder') || k.includes('prep') || k.includes('pre3')) return pick('kg') || ids[0] || 'kg';
  return ids[0] || 'kg';
}

const sameMap = (a, b) => JSON.stringify(Object.entries(a || {}).sort()) === JSON.stringify(Object.entries(b || {}).sort());

/* Read-only Grade / Preschool badge for Single Assessment Result rows
   (inline styles so it needs no stylesheet wherever it is dropped in). */
export function PreschoolTypeBadge({ preschool, levelName }) {
  const on = !!preschool;
  return (
    <span
      title={on ? `Preschool / Montessori${levelName ? ` · ${levelName}` : ''} (set in Result Setup → Setup Preschool Classes)` : 'Grade 1-12 (marks-based)'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
        whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, lineHeight: 1.4,
        background: on ? 'rgba(124,58,237,.1)' : 'rgba(var(--brand-primary-rgb, 30,58,138), .1)',
        color: on ? '#7C3AED' : 'var(--brand-solid, #1E40AF)',
      }}
    >
      <i className={`fa-solid ${on ? 'fa-shapes' : 'fa-graduation-cap'}`} style={{ fontSize: 10 }}></i>
      {on ? 'Preschool' : 'Grade 1-12'}
    </span>
  );
}

export default function PreschoolClassSetup({ pLevels = [], toast = () => {}, onCountChange }) {
  const { can } = usePermissions();
  const moduleReadOnly = useModuleReadOnly('exam');
  const lockReason = moduleReadOnly ? 'Examination is view-only for your account.' : examSessionLockReason();
  const canEdit = can('Examination', 'Result Setup', 'Edit') && !lockReason;

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | preschool | grade
  const [saving, setSaving] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null); // { key, name, toPreschool }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [list, map] = await Promise.all([
          loadBranchClassSections().catch(e => { if (alive) setLoadError(e.message || 'Could not load classes'); return []; }),
          getPreschoolClassSetup(),
        ]);
        if (!alive) return;
        setClasses(list);
        setSaved(map);
        setDraft(map);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (onCountChange) onCountChange(Object.keys(saved).length); }, [saved, onCountChange]);

  const levelName = id => (pLevels.find(l => l.id === id) || {}).name || id;

  const rows = useMemo(() => classes.map(c => ({
    ...c,
    key: preschoolClassKey(c.classID, c.sectionID),
    name: `${c.className}${c.sectionName ? ` - ${c.sectionName}` : ''}`,
  })), [classes]);

  const q = search.trim().toLowerCase();
  const markedCount = rows.filter(r => draft[r.key]).length;
  const shown = rows.filter(r =>
    (!q || r.name.toLowerCase().includes(q)) &&
    (filter === 'all' || (filter === 'preschool') === !!draft[r.key])
  );
  const dirty = !sameMap(draft, saved);

  const guardEdit = () => {
    if (lockReason) { toast(lockReason, 'error'); return false; }
    if (!can('Examination', 'Result Setup', 'Edit')) { toast('You do not have permission to edit Result Setup', 'error'); return false; }
    return true;
  };

  const toggle = row => setDraft(d => {
    const next = { ...d };
    if (next[row.key]) delete next[row.key];
    else next[row.key] = guessLevel(row.className, pLevels);
    return next;
  });

  const save = async () => {
    if (!guardEdit()) return;
    setSaving(true);
    try {
      const fresh = await savePreschoolClassSetup(draft);
      setSaved(fresh);
      setDraft(fresh);
      const n = Object.keys(fresh).length;
      toast(`${n} class${n === 1 ? '' : 'es'} set as Preschool / Montessori (saved on this device)`, 'success');
    } catch (e) {
      toast(e.message || 'Save failed, please try again', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="preschool-setup">
      <style>{PSC_CSS}</style>

      <div className="psc-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Switch on every class &amp; section that should get a <strong>Preschool / Montessori</strong> result and pick its SLO level.
          These classes are assessed with Preschool skills in <strong>Single Assessment Result</strong> and are left out of <strong>Combined Assessment Result</strong>.
          All other classes use Grade 1-12 marks.
        </span>
      </div>

      <div className="psc-warn">
        <i className="fa-solid fa-triangle-exclamation"></i>
        <span>This list is saved on this device only for now (per branch). It is not yet stored on the server.</span>
      </div>

      {lockReason && (
        <div className="psc-warn">
          <i className="fa-solid fa-lock"></i>
          <span>{lockReason}</span>
        </div>
      )}

      <div className="psc-toolbar">
        <div className="psc-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search class or section" aria-label="Search class or section" />
        </div>
        <div className="psc-filter" role="tablist" aria-label="Filter classes">
          {[
            { k: 'all', l: 'All', n: rows.length },
            { k: 'preschool', l: 'Preschool', n: markedCount },
            { k: 'grade', l: 'Grade 1-12', n: rows.length - markedCount },
          ].map(f => (
            <button key={f.k} type="button" role="tab" aria-selected={filter === f.k}
              className={`psc-filter-btn${filter === f.k ? ' active' : ''}`} onClick={() => setFilter(f.k)}>
              {f.l} <span>{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="psc-table">
        <div className="psc-head">
          <div>#</div>
          <div>Class</div>
          <div>Section</div>
          <div>Result Type</div>
          <div>SLO Level</div>
        </div>
        {loading && <div className="psc-empty"><i className="fa-solid fa-spinner fa-spin"></i> Loading classes…</div>}
        {!loading && loadError && <div className="psc-empty">{loadError}</div>}
        {!loading && !loadError && shown.length === 0 && (
          <div className="psc-empty">{q ? `No classes match "${search}"` : 'No classes in this view'}</div>
        )}
        {!loading && shown.map((r, i) => {
          const on = !!draft[r.key];
          return (
            <div key={r.key} className={`psc-row${on ? ' on' : ''}`}>
              <div><span className="psc-sno">{i + 1}</span></div>
              <div className="psc-cls">{r.className}</div>
              <div>{r.sectionName ? <span className="psc-sec">{r.sectionName}</span> : <span className="psc-tag">—</span>}</div>
              <div className="psc-type">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Mark ${r.name} as Preschool`}
                  className="psc-switch"
                  disabled={!canEdit}
                  title={!canEdit ? (lockReason || 'You do not have permission to edit Result Setup') : undefined}
                  onClick={() => { if (guardEdit()) setConfirmRow({ key: r.key, row: r, name: r.name, toPreschool: !on }); }}
                >
                  <span className="psc-switch-knob" />
                </button>
                <span className={`psc-badge ${on ? 'preschool' : 'grade'}`}>
                  <i className={`fa-solid ${on ? 'fa-shapes' : 'fa-graduation-cap'}`}></i>
                  {on ? 'Preschool' : 'Grade 1-12'}
                </span>
              </div>
              <div>
                {on ? (
                  <select
                    className="rs-input psc-level"
                    value={draft[r.key]}
                    disabled={!canEdit}
                    onChange={e => { const v = e.target.value; setDraft(d => ({ ...d, [r.key]: v })); }}
                    aria-label={`SLO level for ${r.name}`}
                  >
                    {pLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                ) : <span className="psc-tag">—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {confirmRow && createPortal(
        <div className="confirm-overlay open preschool-setup-portal" onClick={e => { if (e.target === e.currentTarget) setConfirmRow(null); }}>
          <div className="confirm-dialog">
            <div className="confirm-glow" style={{ background: confirmRow.toPreschool
              ? 'linear-gradient(90deg,#6D28D9,#7C3AED,#6D28D9)'
              : 'var(--brand-gradient, linear-gradient(90deg,#1E3A8A,#1E40AF,#1E3A8A))' }} />
            <div className="confirm-hero" style={{ background: 'none' }}>
              <div className="confirm-ring">
                <div className="confirm-icon-wrap" style={{
                  background: confirmRow.toPreschool ? 'rgba(124,58,237,.12)' : 'rgba(var(--brand-primary-rgb, 30,58,138), .1)',
                  color: confirmRow.toPreschool ? '#7C3AED' : 'var(--brand-solid, #1E40AF)',
                }}>
                  <i className={`fa-solid ${confirmRow.toPreschool ? 'fa-shapes' : 'fa-graduation-cap'}`}></i>
                </div>
              </div>
            </div>
            <div className="confirm-body">
              <div className="confirm-title">Are you sure?</div>
              <div className="confirm-msg">
                {confirmRow.toPreschool
                  ? <>Mark <strong>{confirmRow.name}</strong> as a <strong>Preschool / Montessori</strong> class?</>
                  : <>Change <strong>{confirmRow.name}</strong> back to a <strong>Grade 1-12</strong> class?</>}
              </div>
              <div className="confirm-hint" style={{
                background: 'rgba(var(--brand-primary-rgb, 30,58,138), .06)',
                borderColor: 'rgba(var(--brand-primary-rgb, 30,58,138), .18)',
                color: 'var(--brand-solid, #1E3A8A)',
              }}>
                <i className="fa-solid fa-circle-info" style={{ color: 'var(--brand-solid, #1E40AF)' }}></i>
                <span>{confirmRow.toPreschool
                  ? `It will be rated against the ${levelName(guessLevel(confirmRow.row.className, pLevels))} SLOs (you can change the level) and left out of Combined Assessment Result.`
                  : 'Its results will be entered as Grade 1-12 marks.'}
                </span>
              </div>
            </div>
            <div className="confirm-footer">
              <button type="button" className="confirm-btn confirm-btn--cancel" onClick={() => setConfirmRow(null)}>Cancel</button>
              <button
                type="button"
                className="confirm-btn confirm-btn--confirm"
                style={{ background: confirmRow.toPreschool ? '#7C3AED' : 'var(--brand-solid, #1E40AF)', color: '#fff' }}
                onClick={() => { toggle(confirmRow.row); setConfirmRow(null); }}
              >
                {confirmRow.toPreschool ? 'Yes, Mark as Preschool' : 'Yes, Change to Grade 1-12'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {dirty && (
        <div className="psc-savebar">
          <span><i className="fa-solid fa-circle-exclamation"></i> You have unsaved changes · {markedCount} Preschool class{markedCount === 1 ? '' : 'es'}</span>
          <button type="button" className="exam-cancel-btn" onClick={() => setDraft({ ...saved })}>Discard</button>
          <button type="button" className="exam-submit-btn" disabled={saving || !canEdit} onClick={save}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i> Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
