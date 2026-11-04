import React, { useMemo, useState } from 'react';
import Pagination from './Pagination';
import { paginate, PAGE_SIZE_OPTIONS } from './pageMath';
import { schoolProgressApi } from './api';
import { getSuperAdminIdentity } from './api/config';
import { composeBugDetail, BUG_STATUS } from './api/services/dashboard';
import { Modal } from './OneLinkSection';

/* ═══════════════════════════════════════════════════════════════════
   BUG MANAGER — Dashboard ▸ Bugs Summary ka Add / Edit / Status / Delete
   aur "Bug Reports" table.

   Koi naya backend nahi: wahi school-enquiries-bugs-action (AHM_School_
   Progress) jis par Support aur Schools Progress ▸ Enquiries pehle se bug
   save karte hain, aur jiski saari rows admin_dashboard ke `Bugs` me aati
   hain. Is liye yahan ka bug un dono screens par bhi dikhta hai.

   Table ke khane: branchID, module, developer, bugDetail, date, isSolved.
   Title / description / reported-by / severity / "In Progress" bugDetail
   ki lineon me jate hain (dekho composeBugDetail, dashboard.js). Status:
     Resolved     → isSolved true
     Pending      → isSolved false
     In Progress  → isSolved false + "Status: In Progress" line
   Screenshot ka koi khana table me nahi, is liye attachment nahi liya jata.

   Har save / delete ke baad parent admin_dashboard dobara mangwata hai —
   cards aur table hamesha saved records se bante hain, koi counter nahi.
   ═══════════════════════════════════════════════════════════════════ */

export const BUG_MODULES = ['Dashboard', 'School Permissions', 'Network Permissions', 'Schools Payment', 'Mentor AI', 'E-Tube', 'Support', 'Other'];
export const BUG_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = [BUG_STATUS.pending, BUG_STATUS.progress, BUG_STATUS.resolved];

const SEV_TONE = { critical: '#991B1B', high: '#DC2626', medium: '#D97706', low: '#0284C7' };
const STATUS_TONE = { [BUG_STATUS.pending]: '#D97706', [BUG_STATUS.progress]: '#0284C7', [BUG_STATUS.resolved]: '#16A34A' };
export const sevTone = (s) => SEV_TONE[String(s || '').toLowerCase()] || '#64748B';

export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* API ka developer khana [Required] hai — khali bhejne par 400. */
export const UNASSIGNED = 'Unassigned';

export function Pill({ text, color }) {
  return <span className="bm-pill" style={{ color, background: `${color}14`, borderColor: `${color}40` }}>{text}</span>;
}

/* Ek record ko poora dobara bhejna padta hai (update) — status badalne par bhi. */
function saveRecord(row, patch = {}) {
  const v = { ...row, ...patch };
  return schoolProgressApi.saveEnquiry({
    id: v.recordId || 0,
    branchId: v.branchId,
    module: v.module,
    developer: String(v.developer || '').trim() && v.developer !== '—' ? v.developer : UNASSIGNED,
    bugDetail: composeBugDetail({
      title: v.title, description: v.descriptionText, reportedBy: v.reportedBy,
      status: v.status, severity: v.priority,
    }),
    date: v.date,
    isSolved: v.status === BUG_STATUS.resolved,
  });
}

/* ── Add / Edit ─────────────────────────────────────────────────── */
export function BugFormModal({ bug, schools, toast, onSaved, onClose }) {
  const editing = Boolean(bug && bug.recordId);
  const [form, setForm] = useState(() => ({
    title: bug?.title || '',
    description: bug?.descriptionText || '',
    reportedBy: bug?.reportedBy || (editing ? '' : (getSuperAdminIdentity().name || '')),
    branchId: bug?.branchId ? String(bug.branchId) : '',
    module: bug?.module && bug.module !== '—' ? bug.module : BUG_MODULES[0],
    priority: bug?.priority || 'Medium',
    status: bug?.status || BUG_STATUS.pending,
    developer: bug?.developer && bug.developer !== '—' && bug.developer !== UNASSIGNED ? bug.developer : '',
    date: bug?.date || isoToday(),
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  /* Purane record ka module list me na ho to bhi dropdown me rahe. */
  const modules = BUG_MODULES.includes(form.module) ? BUG_MODULES : [...BUG_MODULES, form.module];
  const severities = !form.priority || BUG_SEVERITIES.includes(form.priority) ? BUG_SEVERITIES : [...BUG_SEVERITIES, form.priority];

  const save = async () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Bug title is required';
    if (!form.description.trim()) e.description = 'Bug description is required';
    if (!Number(form.branchId)) e.branchId = 'Select the affected school';
    if (!form.date) e.date = 'Date is required';
    setErrors(e);
    if (Object.keys(e).length || saving) return;
    setSaving(true);
    try {
      await saveRecord({
        recordId: editing ? bug.recordId : 0,
        branchId: Number(form.branchId),
        module: form.module,
        developer: form.developer.trim(),
        title: form.title.trim(),
        descriptionText: form.description.trim(),
        reportedBy: form.reportedBy.trim(),
        priority: form.priority,
        status: form.status,
        date: form.date,
      });
      toast?.(editing ? 'Bug updated' : 'Bug added', 'success');
      onClose();
      await onSaved?.();
    } catch (err) {
      toast?.(err?.message || 'Could not save this bug', 'error');
    } finally {
      setSaving(false);
    }
  };

  const err = (k) => errors[k] && <div className="bm-err">{errors[k]}</div>;
  return (
    <Modal title={editing ? 'Edit Bug' : 'Add New Bug'} sub="Saved to the School Enquiries bug tracker" icon={editing ? 'fa-pen' : 'fa-bug'}
      onClose={onClose} closeDisabled={saving}
      footer={<>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <i className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Bug'}
        </button>
      </>}>
      <div className="modal-grid bm-form">
        <div className="f-field span2">
          <label className="f-label">Bug Title <span className="bm-req">*</span></label>
          <input className={`f-input${errors.title ? ' bm-invalid' : ''}`} value={form.title} maxLength={200}
            onChange={(e) => set('title', e.target.value)} placeholder="Short summary of the problem" />
          {err('title')}
        </div>
        <div className="f-field span2">
          <label className="f-label">Bug Description <span className="bm-req">*</span></label>
          <textarea className={`f-input bm-textarea${errors.description ? ' bm-invalid' : ''}`} value={form.description}
            onChange={(e) => set('description', e.target.value)} placeholder="Steps to reproduce, expected vs. actual behaviour…" />
          {err('description')}
        </div>
        <div className="f-field">
          <label className="f-label">School <span className="bm-req">*</span></label>
          <select className={`f-input${errors.branchId ? ' bm-invalid' : ''}`} value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>
            <option value="">{schools.length ? 'Select school…' : 'Loading schools…'}</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {err('branchId')}
        </div>
        <div className="f-field">
          <label className="f-label">Reported By</label>
          <input className="f-input" value={form.reportedBy} onChange={(e) => set('reportedBy', e.target.value)} placeholder="Name of reporter" />
        </div>
        <div className="f-field">
          <label className="f-label">Affected Module</label>
          <select className="f-input" value={form.module} onChange={(e) => set('module', e.target.value)}>
            {modules.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="f-field">
          <label className="f-label">Bug Severity</label>
          <select className="f-input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {severities.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="f-field">
          <label className="f-label">Status</label>
          <select className="f-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="f-field">
          <label className="f-label">Assigned Developer / Team</label>
          <input className="f-input" value={form.developer} onChange={(e) => set('developer', e.target.value)} placeholder={UNASSIGNED} />
        </div>
        <div className="f-field">
          <label className="f-label">Date Reported <span className="bm-req">*</span></label>
          <input type="date" className={`f-input${errors.date ? ' bm-invalid' : ''}`} value={form.date} onChange={(e) => set('date', e.target.value)} />
          {err('date')}
        </div>
      </div>
    </Modal>
  );
}

/* ── Bug Reports table ─────────────────────────────────────────── */
/* Status ka daayra — summary cards ke "View Report" isi ko set karte hain.
   'open' = Pending + In Progress (Pending card ka wahi hisaab: total − resolved). */
export const BUG_SCOPE = { all: '', open: 'open' };
const SCOPE_TITLE = {
  '': 'Bug Reports — All Bugs',
  open: 'Pending Bugs Report',
  [BUG_STATUS.pending]: 'Bug Reports — Pending',
  [BUG_STATUS.progress]: 'Bug Reports — In Progress',
  [BUG_STATUS.resolved]: 'Resolved Bugs Report',
};
const inScope = (r, scope) => (!scope ? true
  : scope === BUG_SCOPE.open ? r.status !== BUG_STATUS.resolved
    : r.status === scope);

/**
 * @param rows        is period ke bug rows (cards bhi inhi se bante hain)
 * @param periodLabel Bugs Summary ka chuna hua arsa
 * @param scope       status filter ('' | 'open' | Pending | In Progress | Resolved) — parent ka
 * @param onScope     scope badlo (dropdown / Show All)
 * @param schoolName  (branchId) => naam
 * @param canEdit     sirf Super Admin (Viewing as kisi aur user par nahi)
 * @param onEdit      (row) => Add/Edit modal kholo
 * @param onChanged   save/delete ke baad admin_dashboard dobara
 */
export function BugReportsSection({ rows, periodLabel, scope = '', onScope, schoolName, canEdit, loading, error, onRetry, onEdit, onChanged, toast }) {
  const [q, setQ] = useState('');
  const [mod, setMod] = useState('');
  const [sev, setSev] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  /* Mark as Resolved / Reopen ki tasdeeq: { row, next } */
  const [toggleFor, setToggleFor] = useState(null);
  const [delFor, setDelFor] = useState(null);
  const [busy, setBusy] = useState(false);

  /* Card se naya daayra aaye to pehle safhe se. */
  const [lastScope, setLastScope] = useState(scope);
  if (lastScope !== scope) { setLastScope(scope); setPage(1); }

  const modules = useMemo(() => {
    const set = new Set(BUG_MODULES);
    rows.forEach((r) => { if (r.module && r.module !== '—') set.add(r.module); });
    return [...set];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (needle && !String(r.title || '').toLowerCase().includes(needle)) return false;
        if (mod && r.module !== mod) return false;
        if (sev && String(r.priority || '').toLowerCase() !== sev.toLowerCase()) return false;
        if (!inScope(r, scope)) return false;
        if ((from || to) && !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) return false;
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
        return true;
      })
      /* Naye pehle — tareekh, phir record id. */
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.recordId - a.recordId));
  }, [rows, q, mod, sev, scope, from, to]);
  const filtersOn = Boolean(q || mod || sev || scope || from || to);

  const pg = paginate(filtered.length, page, pageSize);
  const pageRows = filtered.slice(pg.start, pg.end);
  const resetPage = (fn) => (e) => { fn(e.target.value); setPage(1); };
  const clear = () => { setQ(''); setMod(''); setSev(''); onScope?.(BUG_SCOPE.all); setFrom(''); setTo(''); setPage(1); };

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

  return (
    <div className="section-card" style={{ marginBottom: 28 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><i className="fa-solid fa-list-check" /> {SCOPE_TITLE[scope] || SCOPE_TITLE['']}</div>
          <div className="card-sub" style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 3 }}>
            {periodLabel} · <b className="bm-count">{filtered.length}</b> matching record{filtered.length === 1 ? '' : 's'} of {rows.length}
          </div>
        </div>
        <div className="card-header-right">
          <div className="tbl-show-row">
            Show <select className="tbl-show-sel" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select> entries
          </div>
          <div className="tbl-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input type="text" placeholder="Search bug title..." value={q} onChange={resetPage(setQ)} />
          </div>
        </div>
      </div>

      <div className="bm-filters">
        <select className="tbl-show-sel" value={mod} onChange={resetPage(setMod)}>
          <option value="">All Modules</option>
          {modules.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className="tbl-show-sel" value={sev} onChange={resetPage(setSev)}>
          <option value="">All Severities</option>
          {BUG_SEVERITIES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="tbl-show-sel" value={scope} onChange={(e) => onScope?.(e.target.value)} aria-label="Status filter">
          <option value={BUG_SCOPE.all}>All Statuses</option>
          <option value={BUG_SCOPE.open}>Pending + In Progress</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="bm-date">From <input type="date" className="tbl-show-sel" value={from} max={to || undefined} onChange={resetPage(setFrom)} /></label>
        <label className="bm-date">To <input type="date" className="tbl-show-sel" value={to} min={from || undefined} onChange={resetPage(setTo)} /></label>
        <button className="pag-btn" onClick={clear} disabled={!filtersOn}><i className="fa-solid fa-filter-circle-xmark" /> Clear Filter / Show All</button>
      </div>

      <div className="tbl-wrap">
        <table className="mentor-table bm-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Bug Title</th>
              <th>Description</th>
              <th>Module</th>
              <th>Severity</th>
              <th>Reported By</th>
              <th>Assigned To</th>
              <th>Date Reported</th>
              <th>Status</th>
              <th style={{ width: 150, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="bm-empty"><i className="fa-solid fa-circle-notch fa-spin" /> Refreshing bugs…</td></tr>
            ) : error ? (
              <tr><td colSpan={10} className="bm-empty" style={{ color: '#DC2626' }}>
                <i className="fa-solid fa-triangle-exclamation" /> {error}{' '}
                {onRetry && <button className="pag-btn" onClick={onRetry}>Retry</button>}
              </td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={10} className="bm-empty">
                {rows.length === 0 ? `No bugs recorded for ${periodLabel}.` : 'No bugs match these filters.'}
              </td></tr>
            ) : pageRows.map((r, i) => (
              <tr key={r.id}>
                <td>{pg.start + i + 1}</td>
                <td className="bm-title">{r.title || '—'}</td>
                <td><div className="bm-desc" title={r.descriptionText}>{r.description || '—'}</div></td>
                <td>{r.module}</td>
                <td>{r.priority ? <Pill text={r.priority} color={sevTone(r.priority)} /> : '—'}</td>
                <td>{r.reportedBy || '—'}</td>
                <td>{r.developer}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.date || '—'}</td>
                <td><Pill text={r.status} color={STATUS_TONE[r.status]} /></td>
                <td>
                  <div className="bm-acts">
                    <button className="bm-act" title="View bug" aria-label="View bug" onClick={() => setView(r)}><i className="fa-solid fa-eye" /></button>
                    {canEdit && r.recordId > 0 && <>
                      <button className="bm-act" title="Edit bug" aria-label="Edit bug" onClick={() => onEdit(r)}><i className="fa-solid fa-pen" /></button>
                      {r.status === BUG_STATUS.resolved ? (
                        <button className="bm-act bm-act-reopen" title="Reopen bug" aria-label="Reopen bug"
                          onClick={() => setToggleFor({ row: r, next: BUG_STATUS.pending })}><i className="fa-solid fa-rotate-left" /></button>
                      ) : (
                        <button className="bm-act bm-act-resolve" title="Mark as resolved" aria-label="Mark as resolved"
                          onClick={() => setToggleFor({ row: r, next: BUG_STATUS.resolved })}><i className="fa-solid fa-check" /></button>
                      )}
                      <button className="bm-act bm-act-del" title="Delete bug" aria-label="Delete bug" onClick={() => setDelFor(r)}><i className="fa-solid fa-trash" /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination {...pg} onPageChange={setPage} />

      {view && (
        <Modal title={view.title || 'Bug details'} sub={`Bug #${view.recordId || '—'}`} icon="fa-bug" onClose={() => setView(null)}
          footer={<button className="btn-secondary" onClick={() => setView(null)}>Close</button>}>
          <div className="bm-detail">
            {[
              ['School', schoolName?.(view.branchId) || (view.branchId ? `Branch ${view.branchId}` : '—')],
              ['Module', view.module],
              ['Severity', view.priority ? <Pill text={view.priority} color={sevTone(view.priority)} /> : '—'],
              ['Status', <Pill text={view.status} color={STATUS_TONE[view.status]} />],
              ['Reported By', view.reportedBy || '—'],
              ['Assigned To', view.developer],
              ['Date Reported', view.date || '—'],
            ].map(([k, v]) => <div key={k} className="bm-detail-row"><span>{k}</span><b>{v}</b></div>)}
            <div className="f-label" style={{ marginTop: 14 }}>Description</div>
            <div className="bm-detail-desc">{view.descriptionText || '—'}</div>
          </div>
        </Modal>
      )}

      {toggleFor && (() => {
        const resolving = toggleFor.next === BUG_STATUS.resolved;
        return (
          <Modal title={resolving ? 'Mark as Resolved' : 'Reopen Bug'} icon={resolving ? 'fa-circle-check' : 'fa-rotate-left'}
            onClose={() => setToggleFor(null)} closeDisabled={busy}
            footer={<>
              <button className="btn-secondary" onClick={() => setToggleFor(null)} disabled={busy}>Cancel</button>
              <button className={resolving ? 'btn-primary bm-btn-green' : 'btn-primary bm-btn-orange'} disabled={busy}
                onClick={() => run(() => saveRecord(toggleFor.row, { status: toggleFor.next }),
                  resolving ? 'Bug marked as resolved' : 'Bug reopened', resolving ? 'Could not resolve this bug' : 'Could not reopen this bug')}>
                <i className={`fa-solid ${busy ? 'fa-circle-notch fa-spin' : resolving ? 'fa-check' : 'fa-rotate-left'}`} /> {resolving ? 'Mark as Resolved' : 'Reopen Bug'}
              </button>
            </>}>
            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
              {resolving
                ? <>Mark <b>{toggleFor.row.title || 'this bug'}</b> as <Pill text={BUG_STATUS.resolved} color={STATUS_TONE[BUG_STATUS.resolved]} />?</>
                : <>Reopen <b>{toggleFor.row.title || 'this bug'}</b>? Its status will go back to <Pill text={BUG_STATUS.pending} color={STATUS_TONE[BUG_STATUS.pending]} />.</>}
              <div style={{ color: 'var(--tm)', fontSize: 12, marginTop: 6 }}>Current status: {toggleFor.row.status}</div>
            </div>
          </Modal>
        );
      })()}

      {delFor && (
        <Modal title="Delete Bug" icon="fa-trash" onClose={() => setDelFor(null)} closeDisabled={busy}
          footer={<>
            <button className="btn-secondary" onClick={() => setDelFor(null)} disabled={busy}>Cancel</button>
            <button className="btn-danger" disabled={busy}
              onClick={() => run(() => schoolProgressApi.deleteEnquiry(delFor.recordId, delFor.branchId), 'Bug deleted', 'Could not delete this bug')}>
              <i className={`fa-solid ${busy ? 'fa-circle-notch fa-spin' : 'fa-trash'}`} /> Delete
            </button>
          </>}>
          <div style={{ fontSize: 13, color: 'var(--t2)' }}>
            Permanently delete <b>{delFor.title || 'this bug'}</b>? It will also be removed from the school's Enquiries tab. This cannot be undone.
          </div>
        </Modal>
      )}
    </div>
  );
}
