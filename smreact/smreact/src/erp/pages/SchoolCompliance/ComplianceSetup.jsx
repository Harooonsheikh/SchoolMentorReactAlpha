import React, { useMemo, useState } from 'react';
import { COMPLIANCE_AREAS, MONTHLY_CATEGORY_OPTIONS, DAILY_AREA_OPTIONS, TASK_LABEL_MAX_LENGTH } from '../../mock/compliance';
import { FilterBar, Field, EmptyState, ConfirmDialog } from './ComplianceShared';
import {
  addArea, taskAction, toTemplate, norm, areasOfType, WEEKLY_AREA_NAME, getBranchEmployees,
} from '../../services/complianceApi';

const FREQ_TABS = [
  { id: 'daily', label: 'Daily Checks' },
  { id: 'weekly', label: 'Weekly Checks' },
  { id: 'monthly', label: 'Monthly Review' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* HTML escape — ConfirmDialog message dangerouslySetInnerHTML use karta hai */
const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Area dropdown ke options — Add aur Edit dono isi ko use karte hain */
/* Ek naam ke kai area records hon (duplicate) to hamesha pehla / sab se
   purana (choti id) lo — taake usi naam ke saare tasks ek hi area mein jayen */
function uniqueAreasByName(areas) {
  const byName = new Map();
  [...areas].sort((a, b) => Number(a.id) - Number(b.id)).forEach(a => {
    const key = norm(a.name);
    if (key && !byName.has(key)) byName.set(key, a);
  });
  return [...byName.values()];
}

/* Har tab (daily / weekly / monthly) ka dropdown sirf APNE type ke areas
   dikhata hai — backend area ka `type` (areaTypeOf). Custom area ki id
   wahi key hai jo toTemplate us ke tasks ko deta hai (`area-<naam>`). */
const customKeyOf = (name) => `area-${norm(name)}`;

function buildAreaOptions(freq, areas) {
  const unique = uniqueAreasByName(areasOfType(areas, freq));

  if (freq === 'daily') {
    return unique.map(a => {
      const local = DAILY_AREA_OPTIONS.find(o => norm(o.label) === norm(a.name));
      return { id: local?.id ?? customKeyOf(a.name), label: a.name, dashArea: local?.dashArea ?? 'administration', backendId: a.id };
    });
  }

  if (freq === 'monthly') {
    const idByName = new Map(unique.map(a => [norm(a.name), a.id]));
    const fixed = MONTHLY_CATEGORY_OPTIONS.map(o => ({ ...o, backendId: idByName.get(norm(o.label)) }));
    const fixedNames = new Set(MONTHLY_CATEGORY_OPTIONS.map(o => norm(o.label)));
    const custom = unique
      .filter(a => !fixedNames.has(norm(a.name)))
      .map(a => ({ id: customKeyOf(a.name), label: a.name, dashArea: 'administration', backendId: a.id }));
    return [...fixed, ...custom];
  }

  /* weekly: 6 fixed dashboard areas ("Weekly Review" backend area mein save
     hote hain) + school ki apni weekly categories (apne backend area mein) */
  const weeklyReview = unique.find(a => norm(a.name) === norm(WEEKLY_AREA_NAME));
  const fixed = COMPLIANCE_AREAS.map(a => ({ id: a.id, label: a.label, dashArea: a.id, backendId: weeklyReview?.id }));
  const custom = unique
    .filter(a => a !== weeklyReview)
    .map(a => ({ id: customKeyOf(a.name), label: a.name, dashArea: customKeyOf(a.name), backendId: a.id }));
  return [...fixed, ...custom];
}

/* Edit mode mein task ka current area dhoondna */
function findInitialAreaId(freq, options, editing) {
  if (!editing) return options[0]?.id || '';
  const match = freq === 'weekly'
    ? options.find(o => o.id === editing.dashArea)
    : (options.find(o => o.backendId === editing.areaId)
      || options.find(o => norm(o.label) === norm(editing.areaLabel)));   // duplicate area record ho to naam se
  return (match || options[0])?.id || '';
}

/* "Add New Checklist Item" / "Edit Checklist Item" — `editing` mile to
   edit mode, warna add mode. Task text par hard maxLength
   (TASK_LABEL_MAX_LENGTH) aur live counter. */
/* Edit mode mein current assignee — pehle id se, warna naam se match */
function findInitialAssignee(employees, editing) {
  if (!editing) return '';
  const byId = employees.find(e => e.id === Number(editing.assignedTo));
  if (byId) return String(byId.id);
  const byName = employees.find(e => norm(e.name) === norm(editing.assignedStaff));
  return byName ? String(byName.id) : '';
}

function ItemModal({ open, freq, areas = [], employees = [], employeesLoading = false, editing = null, onClose, onSave }) {
  const isEdit = !!editing;
  const areaOptions = buildAreaOptions(freq, areas);

  const [areaId, setAreaId] = useState('');
  const [label, setLabel] = useState('');
  const [assignedTo, setAssignedTo] = useState('');   // employee id (string)
  const [dueDay, setDueDay] = useState('Friday');
  const [evidenceAllowed, setEvidenceAllowed] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setAreaId(findInitialAreaId(freq, areaOptions, editing));
    setLabel(editing?.label || '');
    setAssignedTo(findInitialAssignee(employees, editing));
    setDueDay(editing?.dueDay || 'Friday');
    setEvidenceAllowed(editing ? editing.evidenceAllowed !== false : true);
    setErr('');
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, freq, editing]);

  /* Employees modal khulne ke baad load hon to edit wala assignee set karo */
  React.useEffect(() => {
    if (open && editing && !assignedTo && employees.length) {
      setAssignedTo(findInitialAssignee(employees, editing));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  if (!open) return null;

  const chosenArea = areaOptions.find(a => a.id === areaId) || areaOptions[0];

  const submit = async () => {
    const text = label.trim();
    if (!text) { setErr('Please enter the task.'); return; }
    if (text.length > TASK_LABEL_MAX_LENGTH) { setErr(`Please keep the task under ${TASK_LABEL_MAX_LENGTH} characters.`); return; }
    if (!chosenArea?.backendId) { setErr('Please select an area.'); return; }
    const assignee = employees.find(e => String(e.id) === String(assignedTo));
    if (!assignee) { setErr('Please select an employee to assign.'); return; }

    const payload = {
      assignedTo: assignee.id,
      assignedStaff: assignee.name,
      areaId: chosenArea.backendId,
      area: freq === 'weekly' && chosenArea.id === chosenArea.dashArea && COMPLIANCE_AREAS.some(a => a.id === chosenArea.id) ? 'weekly' : chosenArea.id,
      areaLabel: freq === 'weekly' && COMPLIANCE_AREAS.some(a => a.id === chosenArea.id) ? WEEKLY_AREA_NAME : chosenArea.label,
      dashArea: chosenArea.dashArea,
      label: text, evidenceAllowed,
      ...(freq === 'weekly' ? { dueDay } : {}),
    };
    setSaving(true);
    try {
      await onSave(payload);
    } catch (e) {
      setErr(e?.message || 'Could not save the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <i className={`fa-solid ${isEdit ? 'fa-pen' : 'fa-plus'}`} style={{ marginRight: 8 }}></i>
              {isEdit ? 'Edit Checklist Item' : 'Add New Checklist Item'}
            </div>
            <div className="modal-sub">
              {isEdit ? 'Changes apply to this task from now on.' : 'Added next to the existing checklist — nothing already there is changed or removed.'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body">
          <label className="form-group">
            <span className="form-label">{freq === 'weekly' ? 'Dashboard Area' : freq === 'daily' ? 'Area' : 'Category'}</span>
            <select className="form-input" value={chosenArea?.id ?? ''} onChange={e => setAreaId(e.target.value)}>
              {areaOptions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Task</span>
            <textarea className="cmp-textarea" rows={2} maxLength={TASK_LABEL_MAX_LENGTH} value={label} onChange={e => setLabel(e.target.value)} placeholder="Describe the task to check…" />
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label.length} / {TASK_LABEL_MAX_LENGTH} characters</div>
          </label>
          <div className="cmp-filter-grid" style={{ marginBottom: 6 }}>
            <label className="form-group cmp-field">
              <span className="form-label">Assigned To</span>
              <select
                className="form-input"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                disabled={employeesLoading}
              >
                <option value="">
                  {employeesLoading ? 'Loading employees…' : employees.length ? 'Select employee' : 'No employees found'}
                </option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </label>
            {freq === 'weekly' && (
              <label className="form-group cmp-field">
                <span className="form-label">Due Day</span>
                <select className="form-input" value={dueDay} onChange={e => setDueDay(e.target.value)}>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            )}
            <label className="form-group cmp-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={evidenceAllowed} onChange={e => setEvidenceAllowed(e.target.checked)} />
              <span className="form-label" style={{ margin: 0 }}>Evidence (Photo) Allowed</span>
            </label>
          </div>
          {err && <div className="cmp-field-err"><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {err}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            <i className={`fa-solid ${isEdit ? 'fa-floppy-disk' : 'fa-plus'}`} aria-hidden="true"></i>{' '}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

const AREA_NAME_MAX = 60;

function AddAreaModal({ open, freqLabel = '', existingNames = [], onClose, onSave }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) { setName(''); setErr(''); setSaving(false); }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const text = name.trim();
    if (!text) { setErr('Please enter the category name.'); return; }
    if (existingNames.some(n => n.trim().toLowerCase() === text.toLowerCase())) {
      setErr('This category already exists.'); return;
    }
    setSaving(true);
    try {
      await onSave(text);
    } catch (e) {
      setErr(e.message || 'Could not save the category.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fa-solid fa-plus" style={{ marginRight: 8 }}></i>Add New Category</div>
            <div className="modal-sub">
              This category is added to <b>{freqLabel}</b> only and will appear in its list when you add a checklist item there.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body">
          <label className="form-group">
            <span className="form-label">Category Name</span>
            <input
              className="form-input"
              maxLength={AREA_NAME_MAX}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="e.g. Transport & Bus Safety"
              autoFocus
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{name.length} / {AREA_NAME_MAX} characters</div>
          </label>
          {err && <div className="cmp-field-err"><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {err}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            <i className="fa-solid fa-plus" aria-hidden="true"></i> {saving ? 'Saving…' : 'Add Category'}
          </button>
        </div>
      </div>
    </div>
  );
}

const iconBtn = { height: 32, width: 32, padding: 0, justifyContent: 'center' };

/* ═══════════════════════════════════════════════════════════════════
   COMPLIANCE SETUP — tasks backend (task-list) se aate hain.
   Add / edit / delete task-action se hota hai. Ab har task (built-in
   ho ya custom) edit aur delete ho sakta hai.
   ═══════════════════════════════════════════════════════════════════ */
export default function ComplianceSetup({
  toast,
  areas = [],
  tasks = null,
  onAreasChange = () => {},
  onTasksChange = () => {},
}) {
  const [freq, setFreq] = useState('daily');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);   // jis task ko edit kar rahe hain
  const [areaOpen, setAreaOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  /* Branch ke employees — Assigned To dropdown ke liye (ek dafa load) */
  React.useEffect(() => {
    let alive = true;
    getBranchEmployees()
      .then(list => { if (alive) setEmployees(list); })
      .catch(e => { if (alive) toast(e.message || 'Could not load employees.', 'error'); })
      .finally(() => { if (alive) setEmployeesLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* task-list ke rows ko daily / weekly / monthly mein baantna */
  const all = useMemo(() => {
    if (!tasks) return null;
    const areaMap = new Map(areas.map(a => [a.id, a.name]));
    const list = tasks.map(t => toTemplate(t, areaMap));
    return {
      daily:   list.filter(t => t.frequency === 'daily'),
      weekly:  list.filter(t => t.frequency === 'weekly'),
      monthly: list.filter(t => t.frequency === 'monthly'),
    };
  }, [tasks, areas]);

  const saveArea = async (name) => {
    await addArea(name, freq);  // jis tab par hain usi ka type — fail ho to modal mein error dikhega
    await onAreasChange();      // dropdown ke liye list dobara lo
    setAreaOpen(false);
    toast(`Category "${name}" added to ${FREQ_TABS.find(f => f.id === freq)?.label || freq}.`, 'success');
  };

  const filtered = useMemo(() => {
    const list = all?.[freq] || [];
    const q = search.toLowerCase();
    return q
      ? list.filter(t => t.label.toLowerCase().includes(q) || t.areaLabel.toLowerCase().includes(q))
      : list;
  }, [all, freq, search]);

  /* Backend kabhi assignedToName khali bhejta hai — tab employee id se naam lo */
  const employeeNameById = useMemo(() => new Map(employees.map(e => [e.id, e.name])), [employees]);
  const assigneeName = (t) => t.assignedStaff || employeeNameById.get(Number(t.assignedTo)) || '—';

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(t => {
      if (!map.has(t.area)) map.set(t.area, { area: t.area, areaLabel: t.areaLabel, items: [] });
      map.get(t.area).items.push(t);
    });
    return [...map.values()];
  }, [filtered]);

  const patch = async (t, p) => {
    try {
      await taskAction('update', { ...t, ...p });
      await onTasksChange();
      return true;
    } catch (e) {
      toast(e.message || 'Update failed.', 'error');
      return false;
    }
  };

  const toggleActive = async (t) => {
    if (await patch(t, { active: !t.active })) {
      toast(`"${t.label}" ${t.active ? 'disabled' : 'enabled'}.`, 'success');
    }
  };

  const addItem = async (payload) => {
    try {
      await taskAction('insert', { ...payload, frequency: freq, active: true });
      setAddOpen(false);
      await onTasksChange();
      toast('New checklist item added.', 'success');
    } catch (e) { toast(e.message || 'Item not saved', 'error'); }
  };

  /* Edit — error modal ke andar dikhe, is liye yahan throw hone dete hain */
  const saveEdit = async (payload) => {
    await taskAction('update', { ...editing, ...payload });
    setEditing(null);
    await onTasksChange();
    toast('Checklist item updated.', 'success');
  };

  const removeItem = async (t) => {
    try {
      await taskAction('delete', t);
      await onTasksChange();
      toast(`"${t.label}" removed.`, 'success');
    } catch (e) { toast(e.message || 'Delete not allowed', 'error'); }
  };

  const askRemove = (t) => setConfirm({
    title: 'Delete this task?',
    message: `<b>${esc(t.label)}</b> will be removed from <b>${esc(t.areaLabel)}</b>.`,
    hint: t.custom ? '' : 'This is a built-in task. If you only want to pause it, turn it off with the Active switch instead.',
    confirmLabel: 'Delete',
    icon: 'fa-trash',
    onConfirm: () => removeItem(t),
  });

  return (
    <>
      <div className="cmp-card cmp-intro">
        <div className="cmp-card-title"><i className="fa-solid fa-circle-info" aria-hidden="true"></i> What is Compliance Setup</div>
        <div className="cmp-intro-grid">
          <div className="cmp-intro-item">
            <div className="cmp-intro-item-h"><i className="fa-solid fa-clipboard-check" aria-hidden="true"></i> What this module does</div>
            <p>School Compliance helps you track the tasks every school needs to finish on time, every day, every week and every month. This includes opening the school safely, keeping it clean, checking student safety, and reviewing staff work each month.</p>
          </div>
          <div className="cmp-intro-item">
            <div className="cmp-intro-item-h"><i className="fa-solid fa-gears" aria-hidden="true"></i> How it works</div>
            <p>Every task has a simple status. Not Checked means it still needs to be done. Completed means it is finished. Issue Found means something needs attention, and it is added to Problems and Follow ups so it can be tracked until it is fixed. Not Applicable means the task does not apply today.</p>
          </div>
          <div className="cmp-intro-item">
            <div className="cmp-intro-item-h"><i className="fa-solid fa-shield-halved" aria-hidden="true"></i> What matters most</div>
            <p>Safety tasks are the most important ones. They need a short note before they can be marked Completed, and some of them also need the Principal to verify them. Below, you can turn any task on or off, edit or delete it, and decide if it needs a photo or verification.</p>
          </div>
        </div>
      </div>

      <div className="cmp-tabs" style={{ marginBottom: 16 }}>
        {FREQ_TABS.map(f => (
          <button key={f.id} type="button" className={`cmp-tab${freq === f.id ? ' active' : ''}`} onClick={() => setFreq(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <FilterBar>
        <Field label="Search Checklist Items">
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by task or area…" />
        </Field>
        <Field label=" ">
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 38, flex: 1, justifyContent: 'center' }}
              onClick={() => setAreaOpen(true)}
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i> Add New Category
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ height: 38, flex: 1, justifyContent: 'center' }}
              onClick={() => setAddOpen(true)}
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i> Add New Checklist Item
            </button>
          </div>
        </Field>
      </FilterBar>

      <ItemModal open={addOpen} freq={freq} areas={areas} employees={employees} employeesLoading={employeesLoading} onClose={() => setAddOpen(false)} onSave={addItem} />
      <ItemModal open={!!editing} freq={freq} areas={areas} employees={employees} employeesLoading={employeesLoading} editing={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      <AddAreaModal
        open={areaOpen}
        freqLabel={FREQ_TABS.find(f => f.id === freq)?.label || ''}
        existingNames={[
          ...buildAreaOptions(freq, areas).map(o => o.label),
          ...(freq === 'weekly' ? [WEEKLY_AREA_NAME] : []),
        ]}
        onClose={() => setAreaOpen(false)}
        onSave={saveArea}
      />
      <ConfirmDialog cfg={confirm} onClose={() => setConfirm(null)} />

      {!all ? (
        <div className="cmp-card">Loading checklist…</div>
      ) : grouped.length === 0 ? (
        <EmptyState icon="fa-sliders" title="No checklist items match your search" />
      ) : grouped.map(g => (
        <div key={g.area} className="cmp-card">
          <div className="cmp-card-title" style={{ marginBottom: 10 }}>{g.areaLabel}</div>
          <div className="cmp-table-wrap">
            <table className="cmp-table" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: 150 }} />
                {freq === 'weekly' && <col style={{ width: 140 }} />}
                <col style={{ width: 150 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 96 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Task</th><th>Assigned To</th>
                  {freq === 'weekly' && <th>Due Day</th>}
                  <th>Evidence Required</th><th>Active</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map(t => (
                  <tr key={t.id}>
                    <td style={{ opacity: t.active ? 1 : .5 }}>
                      {t.label}
                      {t.custom && <span className="cmp-badge cmp-badge--purple" style={{ marginLeft: 8 }}>Custom</span>}
                      {t.restrictedToPermission && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Visible based on your permissions</div>}
                    </td>
                    <td style={{ opacity: t.active ? 1 : .5 }}>{assigneeName(t)}</td>
                    {freq === 'weekly' && (
                      <td>
                        <select className="form-input" style={{ height: 32, fontSize: 11.5 }} value={t.dueDay} onChange={e => patch(t, { dueDay: e.target.value })}>
                          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                    )}
                    <td>
                      <input type="checkbox" checked={t.evidenceAllowed} disabled title="Backend support coming soon" />
                    </td>
                    <td>
                      <label className="cmp-switch">
                        <input type="checkbox" checked={t.active} onChange={() => toggleActive(t)} />
                        <span />
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" style={iconBtn} title="Edit this task" aria-label={`Edit ${t.label}`} onClick={() => setEditing(t)}>
                          <i className="fa-solid fa-pen" aria-hidden="true"></i>
                        </button>
                        <button type="button" className="btn btn-secondary" style={{ ...iconBtn, color: '#DC2626' }} title="Delete this task" aria-label={`Delete ${t.label}`} onClick={() => askRemove(t)}>
                          <i className="fa-solid fa-trash" aria-hidden="true"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}