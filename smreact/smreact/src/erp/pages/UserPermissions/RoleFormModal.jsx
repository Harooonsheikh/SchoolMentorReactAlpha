import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import {
  MODULE_TREE,
  ROLE_COLORS,
  ROLE_TEMPLATES,
} from './permissionsData';

/* ═══════════════════════════════════════════════════════════════════
   ROLE FORM MODAL — Create / Edit / Clone

   The matrix in this modal is a "quick" view — checkboxes per module
   (not per sub-item × action). The fine-grained matrix lives in
   EditPermissionsPanel.
   ═══════════════════════════════════════════════════════════════════ */
export default function RoleFormModal({ mode, role, onClose, onSave, toast }) {
  const isEdit  = mode === 'edit';
  const isClone = mode === 'clone';

  const seedName        = isClone ? `${role?.name || ''} (Copy)` : (role?.name || '');
  const seedDesc        = role?.description || '';
  const seedColor       = role?.color       || ROLE_COLORS[0].value;
  const seedTemplate    = role?.template    || '';
  const seedModules     = seedTemplate ? modulesFromTemplate(seedTemplate) : [];

  const [name,        setName]        = useState(seedName);
  const [description, setDescription] = useState(seedDesc);
  const [color,       setColor]       = useState(seedColor);
  const [template,    setTemplate]    = useState(seedTemplate);
  const [modules,     setModules]     = useState(seedModules);
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
    if (!name.trim())     e.name    = 'Role name is required';
    if (modules.length === 0) e.modules = 'Pick at least one module';
    return e;
  }, [name, modules]);
  const hasErr = Object.keys(errors).length > 0;

  /* Apply a template's module list. */
  const applyTemplate = (key) => {
    setTemplate(key);
    setModules(modulesFromTemplate(key));
  };

  const toggleMod = (id) => setModules(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  const all = modules.length === MODULE_TREE.length;

  const onSubmit = () => {
    setTouched(true);
    if (hasErr) { toast('Please fix the highlighted fields', 'error'); return; }
    onSave({
      id:          isEdit ? role?.id : undefined,
      name:        name.trim(),
      description: description.trim(),
      color,
      template:    template || 'teacher',     // fallback so EditPermissionsPanel can render something
      modules,                                /* persist directly too — useful for the role card chip count */
      userCount:   isEdit ? role?.userCount : 0,
    });
  };

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="up-role-form-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--lg">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn">
              <i className={`fa-solid ${isEdit ? 'fa-pen' : isClone ? 'fa-copy' : 'fa-id-badge'}`} aria-hidden="true"></i>
            </div>
            <div>
              <div className="up-modal-title" id="up-role-form-title">
                {isEdit ? 'Edit Role' : isClone ? 'Clone Role' : 'Create Role'}
              </div>
              <div className="up-modal-sub">
                {isEdit ? `Updating "${role.name}"` : isClone ? `Cloning from "${role.name}"` : 'Define a new role with module access'}
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
            <div className="up-field">
              <label>Role Name <span className="up-field-req">*</span></label>
              <input
                type="text"
                className={`up-form-input${touched && errors.name ? ' has-error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Senior Coordinator"
              />
            </div>
            <div className="up-field">
              <label>Color</label>
              <div className="up-color-swatches">
                {ROLE_COLORS.map(c => (
                  <Tooltip key={c.id} text={c.id.charAt(0).toUpperCase() + c.id.slice(1)}>
                    <button
                      type="button"
                      className={`up-color-swatch${color === c.value ? ' on' : ''}`}
                      style={{ background: c.value, color: c.value }}
                      onClick={() => setColor(c.value)}
                      aria-label={`Pick ${c.id} colour`}
                    />
                  </Tooltip>
                ))}
              </div>
            </div>

            <div className="up-field span2">
              <label>Description</label>
              <textarea
                className="up-form-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this role do?"
              />
            </div>

            <div className="up-field span2">
              <label>Start From Template</label>
              <div className="up-templates">
                {Object.entries(ROLE_TEMPLATES).map(([key, tpl]) => (
                  <Tooltip key={key} text={`Seed modules from the ${tpl.label} template`}>
                    <button
                      type="button"
                      className="up-template-pill"
                      onClick={() => applyTemplate(key)}
                      style={template === key ? { background: '#EFF6FF', borderColor: '#1E40AF', color: '#1E40AF' } : undefined}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6, fontSize: 10 }}></i>
                      {tpl.label}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>

            <div className="up-field span2">
              <label>Modules <span className="up-field-req">*</span></label>
              <div className="up-checks-head">
                <span className="up-checks-counter">
                  <b>{modules.length}</b> / {MODULE_TREE.length} selected
                </span>
                <Tooltip text={all ? 'Clear every selected module' : 'Select every available module'}>
                  <button
                    type="button"
                    className="up-checks-toggle"
                    onClick={() => setModules(all ? [] : MODULE_TREE.map(m => m.id))}
                  >
                    <i className={`fa-solid ${all ? 'fa-square' : 'fa-square-check'}`} style={{ marginRight: 5 }}></i>
                    {all ? 'Deselect All' : 'Select All Modules'}
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
          <Tooltip text={isEdit ? 'Save updates to this role' : isClone ? 'Save the cloned role' : 'Create this role'}>
            <button type="button" className="up-btn up-btn-primary" onClick={onSubmit}>
              <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Role
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}

function modulesFromTemplate(key) {
  const tpl = ROLE_TEMPLATES[key];
  if (!tpl) return [];
  return tpl.giveAll ? MODULE_TREE.map(m => m.id) : (tpl.modules || []);
}
