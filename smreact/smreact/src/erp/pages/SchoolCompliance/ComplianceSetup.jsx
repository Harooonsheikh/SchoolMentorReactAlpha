import React, { useMemo, useState } from 'react';
import { ALL_STAFF, COMPLIANCE_AREAS, DAILY_AREA_OPTIONS, MONTHLY_CATEGORY_OPTIONS, TASK_LABEL_MAX_LENGTH } from '../../mock/compliance';
import { FilterBar, Field, EmptyState } from './ComplianceShared';
import {
  addArea, taskAction, toTemplate, norm, isDailyArea, WEEKLY_AREA_NAME,
} from '../../services/complianceApi';

const FREQ_TABS = [
  { id: 'daily', label: 'Daily Checks' },
  { id: 'weekly', label: 'Weekly Checks' },
  { id: 'monthly', label: 'Monthly Review' },
];

/* "Add New Checklist Item" — lets a school add its own task on top of
   the built-in ones, which are never changed or removed by this. The
   task text has a hard maxLength (TASK_LABEL_MAX_LENGTH), with a live
   counter, so a long sentence can never overflow a checklist row here
   or a card on the mobile app later. */
function AddItemModal({ open, freq, areas = [], onClose, onSave }) {
  const idByName = new Map(areas.map(a => [norm(a.name), a.id]));
  const weeklyAreaId = idByName.get(norm(WEEKLY_AREA_NAME));

  const areaOptions = freq === 'daily'
    ? [...new Map(areas.filter(isDailyArea).map(a => [a.name, a])).values()].map(a => {
        const local = DAILY_AREA_OPTIONS.find(o => o.label === a.name);
        return { id: local?.id ?? String(a.id), label: a.name, dashArea: local?.dashArea ?? 'administration', backendId: a.id };
      })
    : freq === 'monthly'
      ? MONTHLY_CATEGORY_OPTIONS.map(o => ({ ...o, backendId: idByName.get(norm(o.label)) }))
      : COMPLIANCE_AREAS.map(a => ({ id: a.id, label: a.label, dashArea: a.id, backendId: weeklyAreaId }));

  const [areaId, setAreaId] = useState(areaOptions[0]?.id || '');
  const [label, setLabel] = useState('');
  const [assignedStaff, setAssignedStaff] = useState(ALL_STAFF[0] || '');
  const [dueDay, setDueDay] = useState('Friday');
  const [evidenceAllowed, setEvidenceAllowed] = useState(true);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setAreaId(areaOptions[0]?.id || '');
    setLabel('');
    setAssignedStaff(ALL_STAFF[0] || '');
    setDueDay('Friday');
    setEvidenceAllowed(true);
    setVerificationRequired(false);
    setErr('');
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, freq]);

  if (!open) return null;

  const chosenArea = areaOptions.find(a => a.id === areaId) || areaOptions[0];

  const submit = async () => {
    const text = label.trim();
    if (!text) { setErr('Please enter the task.'); return; }
    if (text.length > TASK_LABEL_MAX_LENGTH) { setErr(`Please keep the task under ${TASK_LABEL_MAX_LENGTH} characters.`); return; }
    if (!chosenArea?.backendId) { setErr('Please select an area.'); return; }

    const payload = {
      areaId: chosenArea.backendId,
      area: freq === 'weekly' ? 'weekly' : chosenArea.id,
      areaLabel: freq === 'weekly' ? 'Weekly Review' : chosenArea.label,
      dashArea: chosenArea.dashArea,
      label: text, assignedStaff, evidenceAllowed, verificationRequired,
      ...(freq === 'weekly' ? { dueDay } : {}),
    };
    setSaving(true);
    try { await onSave(payload); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fa-solid fa-plus" style={{ marginRight: 8 }}></i>Add New Checklist Item</div>
            <div className="modal-sub">Added next to the existing checklist — nothing already there is changed or removed.</div>
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
              <select className="form-input" value={assignedStaff} onChange={e => setAssignedStaff(e.target.value)}>
                {ALL_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            {freq === 'weekly' && (
              <label className="form-group cmp-field">
                <span className="form-label">Due Day</span>
                <select className="form-input" value={dueDay} onChange={e => setDueDay(e.target.value)}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            )}
            <label className="form-group cmp-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={evidenceAllowed} onChange={e => setEvidenceAllowed(e.target.checked)} />
              <span className="form-label" style={{ margin: 0 }}>Evidence (Photo) Allowed</span>
            </label>
            <label className="form-group cmp-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
              <input type="checkbox" checked={verificationRequired} onChange={e => setVerificationRequired(e.target.checked)} />
              <span className="form-label" style={{ margin: 0 }}>Needs Verification (Safety)</span>
            </label>
          </div>
          {err && <div className="cmp-field-err"><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {err}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            <i className="fa-solid fa-plus" aria-hidden="true"></i> {saving ? 'Saving…' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

const AREA_NAME_MAX = 60;

function AddAreaModal({ open, existingNames = [], onClose, onSave }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) { setName(''); setErr(''); setSaving(false); }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const text = name.trim();
    if (!text) { setErr('Please enter the area name.'); return; }
    if (existingNames.some(n => n.trim().toLowerCase() === text.toLowerCase())) {
      setErr('This area already exists.'); return;
    }
    setSaving(true);
    try {
      await onSave(text);
    } catch (e) {
      setErr(e.message || 'Could not save the area.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fa-solid fa-plus" style={{ marginRight: 8 }}></i>Add New Area</div>
            <div className="modal-sub">The new area will appear in the Area list when you add a checklist item.</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal-body">
          <label className="form-group">
            <span className="form-label">Area Name</span>
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
            <i className="fa-solid fa-plus" aria-hidden="true"></i> {saving ? 'Saving…' : 'Add Area'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPLIANCE SETUP — tasks ab backend (task-list) se aate hain.
   Add / update / delete task-action se hota hai.
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
  const [areaOpen, setAreaOpen] = useState(false);

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
    await addArea(name);        // fail ho to modal mein error dikhega
    await onAreasChange();      // dropdown ke liye list dobara lo
    setAreaOpen(false);
    toast(`Area "${name}" added.`, 'success');
  };

  const filtered = useMemo(() => {
    const list = all?.[freq] || [];
    return search
      ? list.filter(t => t.label.toLowerCase().includes(search.toLowerCase()) || t.areaLabel.toLowerCase().includes(search.toLowerCase()))
      : list;
  }, [all, freq, search]);

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
    } catch (e) { toast(e.message || 'Update failed.', 'error'); }
  };

  const toggleActive = async (t) => {
    await patch(t, { active: !t.active });
    toast(`"${t.label}" ${t.active ? 'disabled' : 'enabled'}.`, 'success');
  };

  const addItem = async (payload) => {
    try {
      await taskAction('insert', { ...payload, frequency: freq, active: true });
      setAddOpen(false);
      await onTasksChange();
      toast('New checklist item added.', 'success');
    } catch (e) { toast(e.message || 'Item not saved', 'error'); }
  };

  const removeItem = async (t) => {
    try {
      await taskAction('delete', t);
      await onTasksChange();
      toast(`"${t.label}" removed.`, 'success');
    } catch (e) { toast(e.message || 'Delete not allowed', 'error'); }
  };

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
            <p>Safety tasks are the most important ones. They need a short note before they can be marked Completed, and some of them also need the Principal to verify them. Below, you can turn any task on or off, choose who is responsible for it, and decide if it needs a photo or verification.</p>
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
              <i className="fa-solid fa-plus" aria-hidden="true"></i> Add New Area
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

      <AddItemModal open={addOpen} freq={freq} areas={areas} onClose={() => setAddOpen(false)} onSave={addItem} />
      <AddAreaModal
        open={areaOpen}
        existingNames={areas.map(a => a.name)}
        onClose={() => setAreaOpen(false)}
        onSave={saveArea}
      />

      {!all ? (
        <div className="cmp-card">Loading checklist…</div>
      ) : grouped.length === 0 ? (
        <EmptyState icon="fa-sliders" title="No checklist items match your search" />
      ) : grouped.map(g => (
        <div key={g.area} className="cmp-card">
          <div className="cmp-card-title" style={{ marginBottom: 10 }}>{g.areaLabel}</div>
          <div className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Task</th><th>Assigned To</th>
                  {freq === 'weekly' && <th>Due Day</th>}
                  <th>Evidence Required</th><th>Verification Required</th><th>Active</th><th></th>
                </tr>
              </thead>
              <tbody>
                {g.items.map(t => (
                  <tr key={t.id} style={{ opacity: t.active ? 1 : .5 }}>
                    <td>
                      {t.label}
                      {t.custom && <span className="cmp-badge cmp-badge--purple" style={{ marginLeft: 8 }}>Custom</span>}
                      {t.restrictedToPermission && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Visible based on your permissions</div>}
                    </td>
                    <td>{t.assignedStaff || '—'}</td>
                    {freq === 'weekly' && (
                      <td>
                        <select className="form-input" style={{ height: 32, fontSize: 11.5 }} value={t.dueDay} onChange={e => patch(t, { dueDay: e.target.value })}>
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                    )}
                    <td>
                      <input type="checkbox" checked={t.evidenceAllowed} disabled title="Backend support coming soon" />
                    </td>
                    <td>
                      <input type="checkbox" checked={t.verificationRequired} onChange={e => patch(t, { verificationRequired: e.target.checked })} />
                    </td>
                    <td>
                      <label className="cmp-switch">
                        <input type="checkbox" checked={t.active} onChange={() => toggleActive(t)} />
                        <span />
                      </label>
                    </td>
                    <td>
                      {t.custom && (
                        <button type="button" className="btn btn-secondary" style={{ height: 32, width: 32, padding: 0 }} title="Remove this item" onClick={() => removeItem(t)}>
                          <i className="fa-solid fa-trash" aria-hidden="true"></i>
                        </button>
                      )}
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