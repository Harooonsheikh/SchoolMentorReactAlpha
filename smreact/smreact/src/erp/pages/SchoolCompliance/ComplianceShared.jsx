import React, { useState } from 'react';
import Tooltip from '../../components/Tooltip';
import { STATUS, STATUS_META } from '../../mock/compliance';

/* ═══════════════════════════════════════════════════════════════════
   Reusable School Compliance building blocks — SummaryCard,
   StatusBadge, ChecklistGroup/ChecklistRow (the core daily/weekly/
   monthly interaction), ConfirmDialog (same shape Academics.js's own
   openConfirm/ConfirmDialog already uses elsewhere in this app, kept
   local here so this module has no import-order dependency on
   Academics.js), and PriorityBadge for Problems & Follow-ups.
   ═══════════════════════════════════════════════════════════════════ */

export function initials(name) {
  if (!name) return '?';
  return name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./g, '').trim().split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function SummaryCard({ icon, label, value, tone = 'brand', sub }) {
  return (
    <div className={`cmp-stat cmp-stat--${tone}`}>
      <div className="cmp-stat-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
      <div className="cmp-stat-val">{value}</div>
      <div className="cmp-stat-lbl">{label}</div>
      {sub && <div className="cmp-stat-sub">{sub}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META[STATUS.NOT_CHECKED];
  return <span className={`cmp-badge cmp-badge--${m.tone}`}>{m.label}</span>;
}

export function PriorityBadge({ priority }) {
  const tone = priority === 'Critical' ? 'red' : priority === 'High' ? 'amber' : priority === 'Medium' ? 'blue' : 'gray';
  return <span className={`cmp-badge cmp-badge--${tone}`}>{priority}</span>;
}

export function ProblemStatusBadge({ status }) {
  const tone = status === 'Verified and Closed' ? 'green' : status === 'Resolved' ? 'teal' : status === 'In Progress' ? 'blue' : status === 'Assigned' ? 'purple' : 'red';
  return <span className={`cmp-badge cmp-badge--${tone}`}>{status}</span>;
}

/* ─── ConfirmDialog — same cfg shape as Academics.js's own
   openConfirm/ConfirmDialog ({title,message,hint,confirmLabel,
   confirmStyle,icon,iconBg,iconColor,onConfirm}), built on the
   globally-defined .modal-overlay/.modal chrome (App.js) rather than
   Academics.js's own locally-scoped .confirm-* classes, so this
   module has no CSS dependency on Academics.js ever mounting. */
export function ConfirmDialog({ cfg, onClose }) {
  if (!cfg) return null;
  const { title, message, hint, confirmLabel = 'Confirm', confirmStyle = 'danger', icon = 'fa-triangle-exclamation', iconBg = 'rgba(220,38,38,.1)', iconColor = '#DC2626', onConfirm } = cfg;
  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-md" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', paddingTop: 28 }}>
          <div className="cmp-confirm-icon" style={{ background: iconBg, color: iconColor }}>
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <div className="cmp-confirm-title">{title}</div>
          <div className="cmp-confirm-msg" dangerouslySetInnerHTML={{ __html: message }} />
          {hint && <div className="cmp-confirm-hint">{hint}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={`btn ${confirmStyle === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Photo attachment — same FileReader.readAsDataURL pattern
   Academics.js's ResourceModal already uses for file uploads, just
   scoped to images here. ─── */
export function PhotoAttach({ value, onChange }) {
  const onFile = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(f);
  };
  return (
    <div className="cmp-photo">
      {value ? (
        <div className="cmp-photo-preview">
          <img src={value} alt="Evidence" />
          <button type="button" className="cmp-photo-remove" onClick={() => onChange(null)} aria-label="Remove photo">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      ) : (
        <label className="cmp-photo-upload">
          <i className="fa-solid fa-camera" aria-hidden="true"></i> Add Photo
          <input type="file" accept="image/*" onChange={onFile} hidden />
        </label>
      )}
    </div>
  );
}

/* ─── ChecklistRow — the core interaction: 4-status control, remark,
   optional photo, and (when Issue Found) a "Report Problem" action.
   Safety-critical items (verificationRequired) cannot be saved as
   Completed without a remark, and show a "Needs Verification" chip
   until verified. ─── */
export function ChecklistRow({ item, onUpdate, onReportProblem }) {
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState(item.remark || '');
  const [photo, setPhoto] = useState(item.evidence || null);
  const [err, setErr] = useState('');

  const save = (status) => {
    if (status === STATUS.ISSUE_FOUND && !remark.trim()) { setErr('Please describe the issue in the remark before saving.'); return; }
    if (status === STATUS.COMPLETED && item.verificationRequired && !remark.trim()) { setErr('This is a safety-related check — please add a short remark before marking it Completed.'); return; }
    setErr('');
    onUpdate(item.id, { status, remark: remark.trim(), evidence: photo });
    if (status === STATUS.ISSUE_FOUND) onReportProblem(item, remark.trim(), photo);
  };

  return (
    <div className={`cmp-row${open ? ' open' : ''}`}>
      <div className="cmp-row-main" onClick={() => setOpen(o => !o)}>
        <div className="cmp-row-main-l">
          <div className="cmp-row-label">{item.label}</div>
          <div className="cmp-row-meta">
            <span className="cmp-row-assignee"><span className="cmp-avatar">{initials(item.assignedTo)}</span> {item.assignedTo}</span>
            {item.verificationRequired && <span className="cmp-chip cmp-chip--safety"><i className="fa-solid fa-shield-halved" aria-hidden="true"></i> Safety Check</span>}
            {item.verificationRequired && item.status === STATUS.COMPLETED && !item.verifiedBy && <span className="cmp-chip cmp-chip--warn">Needs Verification</span>}
          </div>
        </div>
        <div className="cmp-row-main-r">
          <StatusBadge status={item.status} />
          <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} cmp-row-chev`} aria-hidden="true"></i>
        </div>
      </div>

      {open && (
        <div className="cmp-row-body" onClick={e => e.stopPropagation()}>
          <div className="cmp-seg cmp-seg-4">
            {[STATUS.NOT_CHECKED, STATUS.COMPLETED, STATUS.ISSUE_FOUND, STATUS.NOT_APPLICABLE].map(s => (
              <button key={s} type="button" className={`cmp-seg-btn${item.status === s ? ' active' : ''}`} onClick={() => save(s)}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <div className="cmp-row-fields">
            <label className="form-group" style={{ flex: 1 }}>
              <span className="form-label">Remark</span>
              <textarea className="cmp-textarea" rows={2} value={remark} onChange={e => setRemark(e.target.value)} placeholder="Optional remark…" />
            </label>
            <PhotoAttach value={photo} onChange={setPhoto} />
          </div>
          {err && <div className="cmp-field-err"><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {err}</div>}
          {item.verificationRequired && item.status === STATUS.COMPLETED && (
            item.verifiedBy
              ? <div className="cmp-verified"><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Verified by {item.verifiedBy}</div>
              : (
                <button type="button" className="btn btn-secondary cmp-verify-btn" onClick={() => onUpdate(item.id, { verifiedBy: 'Dr. Islahudin' })}>
                  <i className="fa-solid fa-stamp" aria-hidden="true"></i> Verify Completion
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}

export function ChecklistGroup({ group, onUpdate, onReportProblem, defaultOpen = false }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const done = group.items.filter(i => i.status === STATUS.COMPLETED || i.status === STATUS.NOT_APPLICABLE).length;
  return (
    <div className="cmp-group">
      <button type="button" className="cmp-group-h" onClick={() => setExpanded(e => !e)}>
        <div className="cmp-group-h-l">
          <i className={`fa-solid fa-chevron-${expanded ? 'down' : 'right'}`} aria-hidden="true"></i>
          <span className="cmp-group-title">{group.areaLabel}</span>
        </div>
        <span className="cmp-group-count">{done} / {group.items.length} done</span>
      </button>
      {expanded && (
        <div className="cmp-group-body">
          {group.items.map(item => (
            <ChecklistRow key={item.id} item={item} onUpdate={onUpdate} onReportProblem={onReportProblem} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Empty state (matches up-empty's role from AuditLogs, kept local
   under a cmp- prefix so this module stays self-contained). ─── */
export function EmptyState({ icon = 'fa-clipboard-check', title, sub, action }) {
  return (
    <div className="cmp-empty">
      <div className="cmp-empty-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
      <div className="cmp-empty-t">{title}</div>
      {sub && <div className="cmp-empty-s">{sub}</div>}
      {action}
    </div>
  );
}

export function FilterBar({ children }) {
  return <div className="cmp-filter-card"><div className="cmp-filter-grid">{children}</div></div>;
}

export function Field({ label, children }) {
  return <label className="form-group cmp-field"><span className="form-label">{label}</span>{children}</label>;
}

/* ─── ProblemModal — reused by the "Report a Problem" flow from
   checklist rows (pre-filled from the triggering task) AND by
   Problems & Follow-ups' own standalone "Report a Problem" button
   (opened with no pre-fill). Uses the same global .modal-* chrome +
   .form-group/.form-label/.form-input as the rest of the ERP. ─── */
export function ProblemModal({ open, initial, categories, staffOptions, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories?.[0] || 'Facilities');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [assignedTo, setAssignedTo] = useState(staffOptions?.[0] || '');
  const [dueDate, setDueDate] = useState('');
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState('');

  React.useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || '');
    setDescription(initial?.description || '');
    setCategory(initial?.category || categories?.[0] || 'Facilities');
    setLocation(initial?.location || '');
    setPriority(initial?.priority || 'Medium');
    setAssignedTo(staffOptions?.[0] || '');
    setDueDate('');
    setPhoto(initial?.photo || null);
    setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;

  const submit = () => {
    if (!title.trim()) { setErr('Please enter a problem title.'); return; }
    if (!description.trim()) { setErr('Please describe the problem.'); return; }
    if (!dueDate) { setErr('Please choose a due date.'); return; }
    onSave({ title: title.trim(), description: description.trim(), category, location: location.trim(), priority, assignedTo, dueDate, photo });
  };

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>Report a Problem</div>
            <div className="modal-sub">This will create a trackable follow-up task.</div>
          </div>
          <Tooltip text="Close"><button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="modal-body">
          <label className="form-group">
            <span className="form-label">Problem Title</span>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Washroom requires cleaning" />
          </label>
          <label className="form-group">
            <span className="form-label">Description</span>
            <textarea className="cmp-textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what you found…" />
          </label>
          <div className="cmp-filter-grid" style={{ marginBottom: 14 }}>
            <label className="form-group cmp-field">
              <span className="form-label">Category</span>
              <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                {(categories || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="form-group cmp-field">
              <span className="form-label">Location / Room</span>
              <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Class VII Room" />
            </label>
            <label className="form-group cmp-field">
              <span className="form-label">Priority</span>
              <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
                {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="form-group cmp-field">
              <span className="form-label">Assign To</span>
              <select className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                {(staffOptions || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="form-group cmp-field">
              <span className="form-label">Due Date</span>
              <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </label>
          </div>
          <span className="form-label">Photo (optional)</span>
          <div style={{ marginTop: 6 }}><PhotoAttach value={photo} onChange={setPhoto} /></div>
          {err && <div className="cmp-field-err" style={{ marginTop: 10 }}><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {err}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit}><i className="fa-solid fa-flag" aria-hidden="true"></i> Report Problem</button>
        </div>
      </div>
    </div>
  );
}

export { Tooltip };
