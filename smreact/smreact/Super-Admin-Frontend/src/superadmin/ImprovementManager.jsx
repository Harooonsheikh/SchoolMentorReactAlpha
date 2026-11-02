import React, { useMemo, useState } from 'react';
import { schoolProgressApi } from './api';
import { getSuperAdminIdentity } from './api/config';
import { composeImprovementDetail, IMP_STATUS } from './api/services/dashboard';
import { Modal } from './OneLinkSection';
import { BUG_MODULES, BUG_SEVERITIES, Pill, sevTone, isoToday, UNASSIGNED } from './BugManager';

/* ═══════════════════════════════════════════════════════════════════
   IMPROVEMENT MANAGER — Dashboard ▸ Improvements Summary ka Add / Edit /
   Complete / Reopen / Delete aur "Improvement Reports" table.

   Bug Manager hi ka namoona, magar alag entity: wahi school-enquiries-
   bugs-action table, jahan Support pehle se improvements "[Improvement]"
   tag ke saath save karta hai — admin_dashboard ki `Bugs` list me yehi tag
   kind = 'improvement' banata hai, is liye bug aur improvement kabhi
   aapas me nahi milte.

   Table ke khane: branchID, module (Affected Module), developer (Assigned
   To), bugDetail, date (Date Submitted), isSolved (Completed). Baqi khane
   bugDetail ki aakhri lineon me (dekho composeImprovementDetail). Status:
     Completed              → isSolved true
     New / Pending / In Progress → isSolved false + "Status: …" line
   Screenshot ka koi khana table me nahi, is liye attachment nahi liya jata.
   ═══════════════════════════════════════════════════════════════════ */

export const IMP_CATEGORIES = ['UI / UX', 'Performance', 'Functionality', 'Reporting', 'Security', 'Data & Integration', 'Other'];
export const IMP_TYPES = ['New Feature', 'Enhancement', 'Optimization', 'Integration', 'Other'];
const STATUSES = [IMP_STATUS.new, IMP_STATUS.pending, IMP_STATUS.progress, IMP_STATUS.completed];
const STATUS_TONE = {
  [IMP_STATUS.new]: '#1E40AF', [IMP_STATUS.pending]: '#D97706',
  [IMP_STATUS.progress]: '#0284C7', [IMP_STATUS.completed]: '#16A34A',
};

/* Cards ke "View Report" isi ko set karte hain. 'open' = New + Pending +
   In Progress (Pending card ka wahi hisaab: total − completed). */
export const IMP_SCOPE = { all: '', open: 'open' };
const SCOPE_TITLE = {
  '': 'Improvement Reports — All Improvements',
  open: 'Pending Improvements Report',
  [IMP_STATUS.new]: 'Improvement Reports — New',
  [IMP_STATUS.pending]: 'Improvement Reports — Pending',
  [IMP_STATUS.progress]: 'Improvement Reports — In Progress',
  [IMP_STATUS.completed]: 'Completed Improvements Report',
};
const inScope = (r, scope) => (!scope ? true
  : scope === IMP_SCOPE.open ? r.status !== IMP_STATUS.completed
    : r.status === scope);

const clean = (v) => (v && v !== '—' ? String(v) : '');
const myName = () => getSuperAdminIdentity().name || '';

/* Ek record poora dobara jata hai (update) — status badalne par bhi. */
function saveRecord(row, patch = {}) {
  const v = { ...row, ...patch };
  return schoolProgressApi.saveEnquiry({
    id: v.recordId || 0,
    branchId: v.branchId,
    module: clean(v.module) || 'Other',
    developer: clean(v.developer) || UNASSIGNED,
    bugDetail: composeImprovementDetail({
      title: v.title, description: v.descriptionText, category: v.category, type: v.type,
      targetDate: v.targetDate, implementation: v.implementation, outcome: v.outcome,
      completionDate: v.completionDate, completedBy: v.completedBy, evidence: v.evidence,
      reportedBy: v.reportedBy, status: v.status, priority: v.priority,
    }),
    date: v.date,
    isSolved: v.status === IMP_STATUS.completed,
  });
}

const withExtra = (list, v) => (!v || list.includes(v) ? list : [...list, v]);

/* ── Add / Edit ─────────────────────────────────────────────────── */
export function ImprovementFormModal({ item, schools, toast, onSaved, onClose }) {
  const editing = Boolean(item && item.recordId);
  const [form, setForm] = useState(() => ({
    title: item?.title || '',
    description: item?.descriptionText || '',
    category: item?.category || IMP_CATEGORIES[0],
    module: clean(item?.module) || BUG_MODULES[0],
    type: item?.type || IMP_TYPES[1],
    reportedBy: item?.reportedBy || (editing ? '' : myName()),
    developer: clean(item?.developer) === UNASSIGNED ? '' : clean(item?.developer),
    branchId: item?.branchId ? String(item.branchId) : '',
    priority: item?.priority || 'Medium',
    date: item?.date || isoToday(),
    targetDate: item?.targetDate || '',
    status: item?.status || IMP_STATUS.new,
    implementation: item?.implementation || '',
    outcome: item?.outcome || '',
    completionDate: item?.completionDate || '',
    completedBy: item?.completedBy || '',
    evidence: item?.evidence || '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const done = form.status === IMP_STATUS.completed;

  const save = async () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Improvement title is required';
    if (!form.description.trim()) e.description = 'Improvement description is required';
    if (!Number(form.branchId)) e.branchId = 'Select the school';
    if (!form.date) e.date = 'Date submitted is required';
    if (form.targetDate && form.date && form.targetDate < form.date) e.targetDate = 'Target date cannot be before the submitted date';
    if (form.completionDate && form.date && form.completionDate < form.date) e.completionDate = 'Completion date cannot be before the submitted date';
    setErrors(e);
    if (Object.keys(e).length || saving) return;
    setSaving(true);
    try {
      await saveRecord({
        ...form,
        recordId: editing ? item.recordId : 0,
        branchId: Number(form.branchId),
        title: form.title.trim(),
        descriptionText: form.description.trim(),
        /* Completed bina tareekh ke save ho to aaj ki tareekh. */
        completionDate: done ? (form.completionDate || isoToday()) : form.completionDate,
        completedBy: done ? (form.completedBy.trim() || myName()) : form.completedBy.trim(),
      });
      toast?.(editing ? 'Improvement updated' : 'Improvement added', 'success');
      onClose();
      await onSaved?.();
    } catch (err) {
      toast?.(err?.message || 'Could not save this improvement', 'error');
    } finally {
      setSaving(false);
    }
  };

  const err = (k) => errors[k] && <div className="bm-err">{errors[k]}</div>;
  const inv = (k) => (errors[k] ? ' bm-invalid' : '');
  const sel = (k, list) => (
    <select className="f-input" value={form[k]} onChange={(ev) => set(k, ev.target.value)}>
      {withExtra(list, form[k]).map((o) => <option key={o}>{o}</option>)}
    </select>
  );
  return (
    <Modal title={editing ? 'Edit Improvement' : 'Add Improvement'} sub="Saved to the School Enquiries tracker as an improvement" icon={editing ? 'fa-pen' : 'fa-lightbulb'}
      large onClose={onClose} closeDisabled={saving}
      footer={<>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <i className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Improvement'}
        </button>
      </>}>
      <div className="im-sec-ttl"><i className="fa-solid fa-circle-info" /> Basic Information</div>
      <div className="modal-grid bm-form">
        <div className="f-field span2">
          <label className="f-label">Improvement Title <span className="bm-req">*</span></label>
          <input className={`f-input${inv('title')}`} value={form.title} maxLength={200} onChange={(ev) => set('title', ev.target.value)} placeholder="Short summary of the improvement" />
          {err('title')}
        </div>
        <div className="f-field span2">
          <label className="f-label">Improvement Description <span className="bm-req">*</span></label>
          <textarea className={`f-input bm-textarea${inv('description')}`} value={form.description} onChange={(ev) => set('description', ev.target.value)} placeholder="What should change and why…" />
          {err('description')}
        </div>
        <div className="f-field">
          <label className="f-label">School <span className="bm-req">*</span></label>
          <select className={`f-input${inv('branchId')}`} value={form.branchId} onChange={(ev) => set('branchId', ev.target.value)}>
            <option value="">{schools.length ? 'Select school…' : 'Loading schools…'}</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {err('branchId')}
        </div>
        <div className="f-field"><label className="f-label">Improvement Category</label>{sel('category', IMP_CATEGORIES)}</div>
        <div className="f-field"><label className="f-label">Affected Module</label>{sel('module', BUG_MODULES)}</div>
        <div className="f-field"><label className="f-label">Improvement Type</label>{sel('type', IMP_TYPES)}</div>
        <div className="f-field">
          <label className="f-label">Reported By</label>
          <input className="f-input" value={form.reportedBy} onChange={(ev) => set('reportedBy', ev.target.value)} placeholder="Name of requester" />
        </div>
        <div className="f-field">
          <label className="f-label">Assigned To / Responsible Person</label>
          <input className="f-input" value={form.developer} onChange={(ev) => set('developer', ev.target.value)} placeholder={UNASSIGNED} />
        </div>
      </div>

      <div className="im-sec-ttl"><i className="fa-solid fa-list-check" /> Planning &amp; Execution</div>
      <div className="modal-grid bm-form">
        <div className="f-field"><label className="f-label">Priority</label>{sel('priority', BUG_SEVERITIES)}</div>
        <div className="f-field"><label className="f-label">Status</label>{sel('status', STATUSES)}</div>
        <div className="f-field">
          <label className="f-label">Date Submitted <span className="bm-req">*</span></label>
          <input type="date" className={`f-input${inv('date')}`} value={form.date} onChange={(ev) => set('date', ev.target.value)} />
          {err('date')}
        </div>
        <div className="f-field">
          <label className="f-label">Target Completion Date</label>
          <input type="date" className={`f-input${inv('targetDate')}`} value={form.targetDate} min={form.date || undefined} onChange={(ev) => set('targetDate', ev.target.value)} />
          {err('targetDate')}
        </div>
        <div className="f-field span2">
          <label className="f-label">Implementation Details</label>
          <textarea className="f-input bm-textarea" value={form.implementation} onChange={(ev) => set('implementation', ev.target.value)} placeholder="Approach, steps, affected screens…" />
        </div>
        <div className="f-field span2">
          <label className="f-label">Expected Outcome</label>
          <textarea className="f-input bm-textarea im-short" value={form.outcome} onChange={(ev) => set('outcome', ev.target.value)} placeholder="What will be better once this ships…" />
        </div>
      </div>

      <div className="im-sec-ttl"><i className="fa-solid fa-flag-checkered" /> Completion Information</div>
      <div className="modal-grid bm-form">
        <div className="f-field">
          <label className="f-label">Completion Date</label>
          <input type="date" className={`f-input${inv('completionDate')}`} value={form.completionDate} min={form.date || undefined} onChange={(ev) => set('completionDate', ev.target.value)} />
          {err('completionDate')}
        </div>
        <div className="f-field">
          <label className="f-label">Completed By</label>
          <input className="f-input" value={form.completedBy} onChange={(ev) => set('completedBy', ev.target.value)} placeholder={done ? (myName() || 'Name') : 'Name'} />
        </div>
        <div className="f-field span2">
          <label className="f-label">Evidence / Implementation Notes</label>
          <textarea className="f-input bm-textarea im-short" value={form.evidence} onChange={(ev) => set('evidence', ev.target.value)} placeholder="Release / PR reference, verification notes…" />
        </div>
      </div>
      <div className="im-note"><i className="fa-solid fa-circle-info" /> Attachments are not supported — the improvement tracker has no file storage.</div>
    </Modal>
  );
}

/* ── Improvement Reports table ─────────────────────────────────── */
/**
 * @param rows   is period ki improvement rows (cards bhi inhi se bante hain)
 * @param scope  status filter ('' | 'open' | New | Pending | In Progress | Completed) — parent ka
 */
export function ImprovementReportsSection({ rows, periodLabel, scope = '', onScope, schoolName, canEdit, loading, error, onRetry, onEdit, onChanged, toast }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [mod, setMod] = useState('');
  const [pri, setPri] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  const [toggleFor, setToggleFor] = useState(null);
  const [delFor, setDelFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const [lastScope, setLastScope] = useState(scope);
  if (lastScope !== scope) { setLastScope(scope); setPage(1); }

  const categories = useMemo(() => {
    const s = new Set(IMP_CATEGORIES);
    rows.forEach((r) => { if (r.category) s.add(r.category); });
    return [...s];
  }, [rows]);
  const modules = useMemo(() => {
    const s = new Set(BUG_MODULES);
    rows.forEach((r) => { if (clean(r.module)) s.add(r.module); });
    return [...s];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (needle && !String(r.title || '').toLowerCase().includes(needle)) return false;
        if (cat && r.category !== cat) return false;
        if (mod && r.module !== mod) return false;
        if (pri && String(r.priority || '').toLowerCase() !== pri.toLowerCase()) return false;
        if (!inScope(r, scope)) return false;
        if ((from || to) && !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) return false;
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
        return true;
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.recordId - a.recordId));
  }, [rows, q, cat, mod, pri, scope, from, to]);
  const filtersOn = Boolean(q || cat || mod || pri || scope || from || to);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const start = (curPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const resetPage = (fn) => (e) => { fn(e.target.value); setPage(1); };
  const clear = () => { setQ(''); setCat(''); setMod(''); setPri(''); onScope?.(IMP_SCOPE.all); setFrom(''); setTo(''); setPage(1); };

  const run = async (work, ok, fail) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      toast?.(ok, 'success');
      setToggleFor(null); setDelFor(null);
      await onChanged?.();
    } catch (err) {
      toast?.(err?.message || fail, 'error');
    } finally {
      setBusy(false);
    }
  };

  /* Complete par tareekh / naam khali hon to aaj + jo login hai; Reopen par
     completion ki maloomat hata di jati hai (record ab mukammal nahi). */
  const toggle = (row, completing) => saveRecord(row, completing
    ? { status: IMP_STATUS.completed, completionDate: row.completionDate || isoToday(), completedBy: row.completedBy || myName() }
    : { status: IMP_STATUS.pending, completionDate: '', completedBy: '' });

  return (
    <div className="section-card" style={{ marginBottom: 28 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><i className="fa-solid fa-lightbulb" /> {SCOPE_TITLE[scope] || SCOPE_TITLE['']}</div>
          <div className="card-sub" style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 3 }}>
            {periodLabel} · <b className="bm-count">{filtered.length}</b> matching record{filtered.length === 1 ? '' : 's'} of {rows.length}
          </div>
        </div>
        <div className="card-header-right">
          <div className="tbl-show-row">
            Show <select className="tbl-show-sel" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              <option>10</option><option>25</option><option>50</option>
            </select> entries
          </div>
          <div className="tbl-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input type="text" placeholder="Search improvement title..." value={q} onChange={resetPage(setQ)} />
          </div>
        </div>
      </div>

      <div className="bm-filters">
        <select className="tbl-show-sel" value={cat} onChange={resetPage(setCat)} aria-label="Category filter">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="tbl-show-sel" value={mod} onChange={resetPage(setMod)} aria-label="Module filter">
          <option value="">All Modules</option>
          {modules.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className="tbl-show-sel" value={pri} onChange={resetPage(setPri)} aria-label="Priority filter">
          <option value="">All Priorities</option>
          {BUG_SEVERITIES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="tbl-show-sel" value={scope} onChange={(e) => onScope?.(e.target.value)} aria-label="Status filter">
          <option value={IMP_SCOPE.all}>All Statuses</option>
          <option value={IMP_SCOPE.open}>Not Completed (New + Pending + In Progress)</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="bm-date">From <input type="date" className="tbl-show-sel" value={from} max={to || undefined} onChange={resetPage(setFrom)} /></label>
        <label className="bm-date">To <input type="date" className="tbl-show-sel" value={to} min={from || undefined} onChange={resetPage(setTo)} /></label>
        <button className="pag-btn" onClick={clear} disabled={!filtersOn}><i className="fa-solid fa-filter-circle-xmark" /> Clear Filter / Show All</button>
      </div>

      <div className="tbl-wrap">
        <table className="mentor-table bm-table im-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Improvement Title</th>
              <th>Description</th>
              <th>Category</th>
              <th>Affected Module</th>
              <th>Priority</th>
              <th>Reported By</th>
              <th>Assigned To</th>
              <th>Date Submitted</th>
              <th>Target Completion</th>
              <th>Status</th>
              <th style={{ width: 150, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="bm-empty"><i className="fa-solid fa-circle-notch fa-spin" /> Refreshing improvements…</td></tr>
            ) : error ? (
              <tr><td colSpan={12} className="bm-empty" style={{ color: '#DC2626' }}>
                <i className="fa-solid fa-triangle-exclamation" /> {error}{' '}
                {onRetry && <button className="pag-btn" onClick={onRetry}>Retry</button>}
              </td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={12} className="bm-empty">
                {rows.length === 0 ? `No improvements recorded for ${periodLabel}.` : 'No improvements match these filters.'}
              </td></tr>
            ) : pageRows.map((r, i) => (
              <tr key={r.id}>
                <td>{start + i + 1}</td>
                <td className="bm-title">{r.title || '—'}</td>
                <td><div className="bm-desc" title={r.descriptionText}>{r.description || '—'}</div></td>
                <td>{r.category || '—'}</td>
                <td>{r.module}</td>
                <td>{r.priority ? <Pill text={r.priority} color={sevTone(r.priority)} /> : '—'}</td>
                <td>{r.reportedBy || '—'}</td>
                <td>{r.developer}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.date || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.targetDate || '—'}</td>
                <td><Pill text={r.status} color={STATUS_TONE[r.status]} /></td>
                <td>
                  <div className="bm-acts">
                    <button className="bm-act" title="View details" aria-label="View improvement" onClick={() => setView(r)}><i className="fa-solid fa-eye" /></button>
                    {canEdit && r.recordId > 0 && <>
                      <button className="bm-act" title="Edit improvement" aria-label="Edit improvement" onClick={() => onEdit(r)}><i className="fa-solid fa-pen" /></button>
                      {r.status === IMP_STATUS.completed ? (
                        <button className="bm-act bm-act-reopen" title="Reopen improvement" aria-label="Reopen improvement"
                          onClick={() => setToggleFor({ row: r, completing: false })}><i className="fa-solid fa-rotate-left" /></button>
                      ) : (
                        <button className="bm-act bm-act-resolve" title="Mark as completed" aria-label="Mark as completed"
                          onClick={() => setToggleFor({ row: r, completing: true })}><i className="fa-solid fa-check" /></button>
                      )}
                      <button className="bm-act bm-act-del" title="Delete improvement" aria-label="Delete improvement" onClick={() => setDelFor(r)}><i className="fa-solid fa-trash" /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pag-bar">
        <div className="pag-info">
          {filtered.length === 0 ? 'Showing 0 entries' : `Showing ${start + 1} to ${Math.min(start + pageSize, filtered.length)} of ${filtered.length} entries`}
        </div>
        <div className="pag-btns">
          <button className="pag-btn" disabled={curPage <= 1} onClick={() => setPage(Math.max(1, curPage - 1))}>Previous</button>
          {Array.from({ length: totalPages }, (_, k) => k + 1).map((n) => (
            <button key={n} className={`pag-btn${n === curPage ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button className="pag-btn" disabled={curPage >= totalPages} onClick={() => setPage(Math.min(totalPages, curPage + 1))}>Next</button>
        </div>
      </div>

      {view && (
        <Modal title={view.title || 'Improvement details'} sub={`Improvement #${view.recordId || '—'}`} icon="fa-lightbulb" large onClose={() => setView(null)}
          footer={<button className="btn-secondary" onClick={() => setView(null)}>Close</button>}>
          <div className="bm-detail">
            {[
              ['School', schoolName?.(view.branchId) || (view.branchId ? `Branch ${view.branchId}` : '—')],
              ['Category', view.category || '—'],
              ['Affected Module', view.module],
              ['Improvement Type', view.type || '—'],
              ['Priority', view.priority ? <Pill text={view.priority} color={sevTone(view.priority)} /> : '—'],
              ['Status', <Pill text={view.status} color={STATUS_TONE[view.status]} />],
              ['Reported By', view.reportedBy || '—'],
              ['Assigned To', view.developer],
              ['Date Submitted', view.date || '—'],
              ['Target Completion Date', view.targetDate || '—'],
              ['Completion Date', view.completionDate || '—'],
              ['Completed By', view.completedBy || '—'],
            ].map(([k, v]) => <div key={k} className="bm-detail-row"><span>{k}</span><b>{v}</b></div>)}
            {[
              ['Description', view.descriptionText],
              ['Implementation Details', view.implementation],
              ['Expected Outcome', view.outcome],
              ['Evidence / Implementation Notes', view.evidence],
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <div className="f-label" style={{ marginTop: 14 }}>{k}</div>
                <div className="bm-detail-desc">{v || '—'}</div>
              </React.Fragment>
            ))}
          </div>
        </Modal>
      )}

      {toggleFor && (
        <Modal title={toggleFor.completing ? 'Mark as Completed' : 'Reopen Improvement'} icon={toggleFor.completing ? 'fa-circle-check' : 'fa-rotate-left'}
          onClose={() => setToggleFor(null)} closeDisabled={busy}
          footer={<>
            <button className="btn-secondary" onClick={() => setToggleFor(null)} disabled={busy}>Cancel</button>
            <button className={toggleFor.completing ? 'btn-primary bm-btn-green' : 'btn-primary bm-btn-orange'} disabled={busy}
              onClick={() => run(() => toggle(toggleFor.row, toggleFor.completing),
                toggleFor.completing ? 'Improvement marked as completed' : 'Improvement reopened',
                toggleFor.completing ? 'Could not complete this improvement' : 'Could not reopen this improvement')}>
              <i className={`fa-solid ${busy ? 'fa-circle-notch fa-spin' : toggleFor.completing ? 'fa-check' : 'fa-rotate-left'}`} /> {toggleFor.completing ? 'Mark as Completed' : 'Reopen Improvement'}
            </button>
          </>}>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
            {toggleFor.completing
              ? <>Mark <b>{toggleFor.row.title || 'this improvement'}</b> as <Pill text={IMP_STATUS.completed} color={STATUS_TONE[IMP_STATUS.completed]} />? Completion date and Completed By are filled in if empty.</>
              : <>Reopen <b>{toggleFor.row.title || 'this improvement'}</b>? Its status will go back to <Pill text={IMP_STATUS.pending} color={STATUS_TONE[IMP_STATUS.pending]} /> and the completion date is cleared.</>}
            <div style={{ color: 'var(--tm)', fontSize: 12, marginTop: 6 }}>Current status: {toggleFor.row.status}</div>
          </div>
        </Modal>
      )}

      {delFor && (
        <Modal title="Delete Improvement" icon="fa-trash" onClose={() => setDelFor(null)} closeDisabled={busy}
          footer={<>
            <button className="btn-secondary" onClick={() => setDelFor(null)} disabled={busy}>Cancel</button>
            <button className="btn-danger" disabled={busy}
              onClick={() => run(() => schoolProgressApi.deleteEnquiry(delFor.recordId, delFor.branchId), 'Improvement deleted', 'Could not delete this improvement')}>
              <i className={`fa-solid ${busy ? 'fa-circle-notch fa-spin' : 'fa-trash'}`} /> Delete
            </button>
          </>}>
          <div style={{ fontSize: 13, color: 'var(--t2)' }}>
            Permanently delete <b>{delFor.title || 'this improvement'}</b>? It will also be removed from the school's Enquiries tab. This cannot be undone.
          </div>
        </Modal>
      )}
    </div>
  );
}
