import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { MODULE_TREE } from './permissionsData';

/* ═══════════════════════════════════════════════════════════════════
   PERMISSION GROUPS TAB — banner + table + Create/Edit/Delete
   ═══════════════════════════════════════════════════════════════════ */
export default function PermissionGroupsTab({ groups, upsertGroup, deleteGroup, toast }) {
  const [search,    setSearch]    = useState('');
  const [formCfg,   setFormCfg]   = useState(null);   // { mode, group? }
  const [deleteFor, setDeleteFor] = useState(null);

  const moduleName = (id) => MODULE_TREE.find(m => m.id === id)?.label || id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <>
      <div className="up-banner">
        <div className="up-banner-ic"><i className="fa-solid fa-layer-group" aria-hidden="true"></i></div>
        <div className="up-banner-body">
          Permission Groups are reusable bundles of module access. Assign a group to a user instead of selecting permissions one by one.
        </div>
      </div>

      <div className="up-filters up-filters--groups">
        <div className="up-search">
          <i className="fa-solid fa-magnifying-glass up-search-ic" aria-hidden="true"></i>
          <input
            type="text"
            className="up-search-input"
            placeholder="Search by group name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search groups"
          />
          {search && (
            <Tooltip text="Clear search">
              <button type="button" className="up-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          )}
        </div>
        <Tooltip text="Create a brand new permission group">
          <button type="button" className="up-btn up-btn-primary" onClick={() => setFormCfg({ mode: 'create' })}>
            <i className="fa-solid fa-plus" aria-hidden="true"></i> Create Group
          </button>
        </Tooltip>
      </div>

      {filtered.length === 0 ? (
        <div className="up-empty">
          <div className="up-empty-ic"><i className="fa-solid fa-layer-group" aria-hidden="true"></i></div>
          <div className="up-empty-title">No groups match your search</div>
          <div className="up-empty-sub">
            {groups.length === 0
              ? 'Click "Create Group" above to add your first permission group.'
              : 'Try clearing the search to see all groups.'}
          </div>
        </div>
      ) : (
        <div className="up-table">
          <div className="up-table-head" style={{ gridTemplateColumns: '1.4fr 2fr 130px 160px' }}>
            <div className="th">Group Name</div>
            <div className="th">Modules Included</div>
            <div className="th c">Assigned Users</div>
            <div className="th c">Actions</div>
          </div>
          {filtered.map(g => {
            const visible = g.modules.slice(0, 3);
            const overflow = g.modules.length - visible.length;
            return (
              <div key={g.id} className="up-table-row" style={{ gridTemplateColumns: '1.4fr 2fr 130px 160px' }}>
                <div className="td up-emp-text" style={{ gap: 3 }}>
                  <div className="up-emp-name">{g.name}</div>
                  {g.description && <div className="up-emp-meta">{g.description}</div>}
                </div>
                <div className="td" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {visible.map(mid => (
                    <Tooltip key={mid} text={`Module: ${moduleName(mid)}`}>
                      <span className="up-badge up-badge--blue">{moduleName(mid)}</span>
                    </Tooltip>
                  ))}
                  {overflow > 0 && (
                    <Tooltip text={g.modules.slice(3).map(moduleName).join(' · ')}>
                      <span className="up-badge up-badge--gray">+{overflow} more</span>
                    </Tooltip>
                  )}
                </div>
                <div className="td c">
                  <Tooltip text={`${g.userCount} ${g.userCount === 1 ? 'user is' : 'users are'} assigned to this group`}>
                    <span className="up-badge up-badge--green">
                      <i className="fa-solid fa-users" aria-hidden="true"></i> {g.userCount}
                    </span>
                  </Tooltip>
                </div>
                <div className="td c up-actions">
                  <Tooltip text="Edit group">
                    <button className="up-act" onClick={() => setFormCfg({ mode: 'edit', group: g })} aria-label="Edit group">
                      <i className="fa-solid fa-pen" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                  <Tooltip text="Delete group">
                    <button className="up-act up-act--danger" onClick={() => setDeleteFor(g)} aria-label="Delete group">
                      <i className="fa-solid fa-trash" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {formCfg && (
        <GroupFormModal
          mode={formCfg.mode}
          group={formCfg.group}
          onClose={() => setFormCfg(null)}
          onSave={(payload) => {
            upsertGroup(payload);
            toast(
              formCfg.mode === 'edit'
                ? `Group "${payload.name}" updated`
                : `Group "${payload.name}" created`,
              'success',
            );
            setFormCfg(null);
          }}
          toast={toast}
        />
      )}
      {deleteFor && (
        <GroupDeleteDialog
          group={deleteFor}
          onCancel={() => setDeleteFor(null)}
          onConfirm={() => {
            deleteGroup(deleteFor.id);
            setDeleteFor(null);
          }}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GROUP FORM MODAL — create or edit a permission group
   ═══════════════════════════════════════════════════════════════════ */
function GroupFormModal({ mode, group, onClose, onSave, toast }) {
  const isEdit = mode === 'edit';
  const [name,        setName]        = useState(group?.name        || '');
  const [description, setDescription] = useState(group?.description || '');
  const [modules,     setModules]     = useState(group?.modules     || []);
  const [touched,     setTouched]     = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const errors = useMemo(() => {
    const e = {};
    if (!name.trim())     e.name    = 'Group name is required';
    if (modules.length === 0) e.modules = 'Pick at least one module';
    return e;
  }, [name, modules]);
  const hasErr = Object.keys(errors).length > 0;

  const toggleMod = (id) => setModules(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  const all = modules.length === MODULE_TREE.length;

  const onSubmit = () => {
    setTouched(true);
    if (hasErr) { toast('Please fix the highlighted fields', 'error'); return; }
    onSave({
      id:          group?.id,
      name:        name.trim(),
      description: description.trim(),
      modules,
      userCount:   group?.userCount || 0,
    });
  };

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="up-group-form-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--lg">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn">
              <i className={`fa-solid ${isEdit ? 'fa-pen' : 'fa-layer-group'}`} aria-hidden="true"></i>
            </div>
            <div>
              <div className="up-modal-title" id="up-group-form-title">
                {isEdit ? 'Edit Permission Group' : 'Create Permission Group'}
              </div>
              <div className="up-modal-sub">
                {isEdit ? `Updating "${group.name}"` : 'Bundle modules into a reusable group'}
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="up-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="up-modal-body">
          <div className="up-form-grid">
            <div className="up-field span2">
              <label>Group Name <span className="up-field-req">*</span></label>
              <input
                type="text"
                className={`up-form-input${touched && errors.name ? ' has-error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Academic Management"
              />
            </div>
            <div className="up-field span2">
              <label>Description (optional)</label>
              <textarea
                className="up-form-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this group enable?"
              />
            </div>

            <div className="up-field span2">
              <label>Select Modules <span className="up-field-req">*</span></label>
              <div className="up-checks-head">
                <span className="up-checks-counter">
                  <b>{modules.length}</b> / {MODULE_TREE.length} selected
                </span>
                <Tooltip text={all ? 'Clear every module selection' : 'Select every available module'}>
                  <button
                    type="button"
                    className="up-checks-toggle"
                    onClick={() => setModules(all ? [] : MODULE_TREE.map(m => m.id))}
                  >
                    <i className={`fa-solid ${all ? 'fa-square' : 'fa-square-check'}`} style={{ marginRight: 5 }}></i>
                    {all ? 'Deselect All' : 'Select All'}
                  </button>
                </Tooltip>
              </div>
              <div className="up-checks">
                {MODULE_TREE.map(m => (
                  <label key={m.id} className="up-check">
                    <input type="checkbox" checked={modules.includes(m.id)} onChange={() => toggleMod(m.id)} />
                    <span className="up-check-ic"><i className={`fa-solid ${m.icon}`} aria-hidden="true"></i></span>
                    {m.label}
                  </label>
                ))}
              </div>
              {touched && errors.modules && (
                <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }}></i> {errors.modules}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="up-modal-foot">
          <Tooltip text="Discard changes and close">
            <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={isEdit ? 'Save updates to this group' : 'Create this permission group'}>
            <button type="button" className="up-btn up-btn-primary" onClick={onSubmit}>
              <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Group
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ─── Group delete confirm dialog ─── */
function GroupDeleteDialog({ group, onCancel, onConfirm }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onCancel]);
  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="up-modal up-modal--sm">
        <div className="up-confirm-body">
          <div className="up-confirm-ic up-confirm-ic--red">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          </div>
          <div className="up-confirm-title">Delete "{group.name}"?</div>
          <div className="up-confirm-text">
            Users assigned this group will lose the bundled permissions. You can recreate the group later.
          </div>
        </div>
        <div className="up-modal-foot up-modal-foot--center">
          <button type="button" className="up-btn up-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="up-btn up-btn-danger" onClick={onConfirm}>
            <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete Group
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
