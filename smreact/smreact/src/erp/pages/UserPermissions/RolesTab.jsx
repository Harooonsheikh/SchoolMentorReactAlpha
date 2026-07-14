import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import RoleFormModal from './RoleFormModal';

/* ═══════════════════════════════════════════════════════════════════
   ROLES TAB — card grid + Create / Edit / Clone / Delete
   ═══════════════════════════════════════════════════════════════════ */
export default function RolesTab({
  roles, upsertRole, deleteRole, toast,
  canCreate = true, canEdit = true, canDelete = true,
}) {
  const [formCfg,    setFormCfg]    = useState(null);   // { mode, role? }
  const [deleteFor,  setDeleteFor]  = useState(null);

  return (
    <>
      <div className="up-roles-toolbar">
        <div className="up-roles-toolbar-l">
          <b style={{ color: '#1E3A8A', fontWeight: 800 }}>{roles.length}</b> roles configured
        </div>
        {canCreate && (
          <Tooltip text="Create a new role from scratch or from a template">
            <button
              type="button"
              className="up-btn up-btn-primary"
              onClick={() => setFormCfg({ mode: 'create' })}
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i> Create Role
            </button>
          </Tooltip>
        )}
      </div>

      {roles.length === 0 ? (
        <div className="up-empty">
          <div className="up-empty-ic"><i className="fa-solid fa-id-badge" aria-hidden="true"></i></div>
          <div className="up-empty-title">No roles defined yet</div>
          <div className="up-empty-sub">Click "Create Role" above to add your first role.</div>
        </div>
      ) : (
        <div className="up-roles-grid">
          {roles.map(r => (
            <div className="up-role-card" key={r.id}>
              <div className="up-role-head">
                <Tooltip text={`Role color: ${r.color}`}>
                  <span className="up-role-head-dot" style={{ background: r.color }} />
                </Tooltip>
                <span className="up-role-name">{r.name}</span>
                <Tooltip text={`${r.userCount} ${r.userCount === 1 ? 'user has' : 'users have'} this role`}>
                  <span className="up-badge up-badge--gray">
                    {r.userCount} {r.userCount === 1 ? 'user' : 'users'}
                  </span>
                </Tooltip>
              </div>
              <div className="up-role-desc">{r.description}</div>
              <div className="up-role-chips">
                <Tooltip text="Number of top-level ERP modules this role can access">
                  <span className="up-badge up-badge--blue">
                    <i className="fa-solid fa-bolt" aria-hidden="true"></i>
                    {moduleCountForTemplate(r.template)} modules
                  </span>
                </Tooltip>
              </div>
              <div className="up-role-foot">
                {canEdit && (
                  <Tooltip text="Edit this role">
                    <button
                      className="up-btn up-btn-ghost up-btn-sm"
                      onClick={() => setFormCfg({ mode: 'edit', role: r })}
                    >
                      <i className="fa-solid fa-pen" aria-hidden="true"></i> Edit
                    </button>
                  </Tooltip>
                )}
                {canCreate && (
                  <Tooltip text="Clone this role as a starting point">
                    <button
                      className="up-btn up-btn-ghost up-btn-sm"
                      onClick={() => setFormCfg({ mode: 'clone', role: r })}
                    >
                      <i className="fa-solid fa-copy" aria-hidden="true"></i> Clone
                    </button>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip text="Delete this role">
                    <button
                      className="up-btn up-btn-del up-btn-sm"
                      onClick={() => setDeleteFor(r)}
                    >
                      <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {formCfg && (
        <RoleFormModal
          mode={formCfg.mode}
          role={formCfg.role}
          onClose={() => setFormCfg(null)}
          onSave={(payload) => {
            upsertRole(payload);
            toast(
              formCfg.mode === 'edit'  ? `Role "${payload.name}" updated`
              : formCfg.mode === 'clone' ? `Role "${payload.name}" cloned`
              : `Role "${payload.name}" created`,
              'success',
            );
            setFormCfg(null);
          }}
          toast={toast}
        />
      )}
      {deleteFor && (
        <RoleDeleteDialog
          role={deleteFor}
          onCancel={() => setDeleteFor(null)}
          onConfirm={() => {
            deleteRole(deleteFor.id);
            setDeleteFor(null);
          }}
        />
      )}
    </>
  );
}

/* Helper — how many top-level modules the template covers, used for the
   summary chip on the card. */
function moduleCountForTemplate(templateKey) {
  if (!templateKey) return 0;
  /* Lazy-imported via direct lookup so we don't pull MODULE_TREE here. */
  // eslint-disable-next-line global-require
  const { ROLE_TEMPLATES, MODULE_TREE } = require('./permissionsData');
  const tpl = ROLE_TEMPLATES[templateKey];
  if (!tpl) return 0;
  return tpl.giveAll ? MODULE_TREE.length : (tpl.modules?.length || 0);
}

/* ─── Role delete confirm dialog ─── */
function RoleDeleteDialog({ role, onCancel, onConfirm }) {
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
          <div className="up-confirm-title">Delete "{role.name}"?</div>
          <div className="up-confirm-text">
            Users assigned this role will lose access until you reassign them to another role. This cannot be undone.
          </div>
        </div>
        <div className="up-modal-foot up-modal-foot--center">
          <button type="button" className="up-btn up-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="up-btn up-btn-danger" onClick={onConfirm}>
            <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete Role
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
