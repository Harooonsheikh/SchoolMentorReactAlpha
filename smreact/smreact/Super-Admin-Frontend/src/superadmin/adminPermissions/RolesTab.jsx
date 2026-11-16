import React, { useState } from 'react';
import { MODULE_TREE, PERMISSION_ACTIONS, ACTION_LABELS, ROLE_COLORS, permsFromModuleSelection, modulesGrantedIn, permStats } from './adminPermissionsData';

/* ═══════════════════════════════════════════════════════════════════
   RolesTab — card-grid role CRUD, module-level checkbox scope. New tab
   inside UserManagement.jsx. Fine-grained per-submodule×action editing
   lives in EditPermissionsPanel.jsx instead — this tab only decides
   "which modules, which actions, globally" for a role.
   ═══════════════════════════════════════════════════════════════════ */

/* Scoped CSS-in-JS for this new tab + its sibling EditPermissionsPanel/
   ResetPasswordModal — module convention (TT_CSS-style), not added to
   the shared saStyles.js. Injected once from UserManagement.jsx. */
export const AP_CSS = `
.ap-banner{display:flex;align-items:flex-start;gap:9px;padding:11px 14px;border-radius:var(--r-md);background:rgba(30,58,138,.06);border:1px solid rgba(30,58,138,.18);color:var(--t2);font-size:12px;line-height:1.55;margin-bottom:16px}
.ap-banner i{color:var(--brand);margin-top:1px;flex-shrink:0}
.ap-role-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.ap-role-card{background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--s-sm);transition:var(--tr)}
.ap-role-card:hover{box-shadow:var(--s-md);transform:translateY(-1px)}
.ap-role-top{display:flex;align-items:center;gap:10px}
.ap-role-swatch{width:38px;height:38px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px}
.ap-role-name{font-size:14px;font-weight:800;color:var(--t1)}
.ap-role-count{font-size:11px;color:var(--tm);font-weight:600}
.ap-role-desc{font-size:12px;color:var(--t2);line-height:1.5;min-height:32px}
.ap-role-stats{display:flex;gap:14px;font-size:11px;color:var(--tm);border-top:1px dashed var(--bl);padding-top:10px}
.ap-role-stats b{color:var(--t1);font-weight:800}
.ap-role-actions{display:flex;gap:8px;margin-top:2px}
.ap-mod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:16px}
.ap-mod-chip{display:flex;align-items:center;gap:8px;padding:9px 11px;border:1.5px solid var(--bl);border-radius:var(--r-md);cursor:pointer;font-size:12.5px;font-weight:600;color:var(--t1);transition:var(--tr)}
.ap-mod-chip.on{border-color:var(--brand);background:rgba(30,58,138,.06)}
.ap-mod-chip input{width:15px;height:15px;accent-color:var(--brand);cursor:pointer}
.ap-act-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.ap-act-chip{display:flex;align-items:center;gap:6px;padding:7px 12px;border:1.5px solid var(--bl);border-radius:999px;cursor:pointer;font-size:12px;font-weight:700;color:var(--t1)}
.ap-act-chip.on{border-color:var(--brand);background:var(--brand);color:#fff}
.ap-act-chip input{width:13px;height:13px;accent-color:#fff;cursor:pointer}
.ap-matrix-wrap{max-height:420px;overflow:auto;border:1.5px solid var(--bl);border-radius:var(--r-md)}
.ap-matrix{width:100%;border-collapse:collapse;font-size:12.5px}
.ap-matrix th,.ap-matrix td{padding:9px 10px;text-align:center;border-bottom:1px solid var(--bl)}
.ap-matrix th{background:linear-gradient(135deg,rgba(79,70,229,.08),rgba(30,58,138,.05));position:sticky;top:0;font-weight:800;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--t2);z-index:1}
.ap-matrix td:first-child,.ap-matrix th:first-child{text-align:left;font-weight:600;color:var(--t1)}
.ap-matrix th.l,.ap-matrix td.l{text-align:left}
.ap-matrix th.r,.ap-matrix td.r{text-align:right}
.ap-matrix tbody tr{transition:var(--tr)}
.ap-matrix tbody tr:hover{background:rgba(79,70,229,.045)}
.ap-matrix input[type=checkbox]{appearance:none;-webkit-appearance:none;width:19px;height:19px;border-radius:6px;border:1.5px solid var(--bl);background:var(--card);cursor:pointer;position:relative;transition:var(--tr);vertical-align:middle}
.ap-matrix input[type=checkbox]:checked{background:linear-gradient(135deg,#4F46E5,#4338CA);border-color:#4338CA}
.ap-matrix input[type=checkbox]:checked::after{content:'';position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.ap-matrix input[type=checkbox]:hover:not(:disabled){border-color:#4F46E5}
.ap-matrix input[type=checkbox]:disabled{opacity:.25;cursor:not-allowed}
.ap-cell-na{background:repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(148,163,184,.08) 5px,rgba(148,163,184,.08) 10px)}
.ap-matrix-more{background:none;border:none;color:var(--brand);font-weight:700;font-size:11px;cursor:pointer;padding:2px 4px}
.ap-matrix-row-link{background:none;border:none;color:var(--brand);font-weight:700;font-size:11px;cursor:pointer;white-space:nowrap}
.ap-matrix-row-link:hover{text-decoration:underline}
.ap-matrix-group-row td{background:var(--muted);color:var(--tm);font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;text-align:left!important;padding:6px 10px;border-bottom:1px solid var(--bl)}

/* ── EditPermissionsPanel — master/detail layout (module rail + matrix) ── */
.ap-edit-modal{max-width:980px!important}
.ap-edit-hdr{display:flex;align-items:center;gap:13px;padding:18px 22px;border-radius:var(--r-xl) var(--r-xl) 0 0;background:linear-gradient(120deg,#4F46E5,#4338CA);position:sticky;top:0;z-index:5}
.ap-edit-hdr-ic{width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(4px);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.ap-edit-hdr-tt{font-size:14.5px;font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ap-edit-hdr-sb{font-size:11.5px;color:rgba(255,255,255,.85);margin-top:2px}
.ap-edit-hdr-close.pm-close{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.3);color:#fff}
.ap-edit-hdr-close.pm-close:hover{background:rgba(255,255,255,.28)}
.ap-edit-body{padding:20px;max-height:72vh;overflow:auto}
.ap-edit-layout{display:grid;grid-template-columns:230px 1fr;gap:16px;align-items:start}
.ap-edit-side{display:flex;flex-direction:column;gap:8px}
.ap-edit-side-top{display:flex;gap:6px}
.ap-edit-side-list{display:flex;flex-direction:column;gap:4px;max-height:460px;overflow:auto}
.ap-edit-mod{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:1.5px solid transparent;border-radius:var(--r-md);background:transparent;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--t2);text-align:left;transition:var(--tr)}
.ap-edit-mod:hover{background:var(--muted)}
.ap-edit-mod.on{background:rgba(79,70,229,.08);border-color:#4F46E5;color:var(--t1);box-shadow:var(--s-xs)}
.ap-edit-mod-ic{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11.5px;flex-shrink:0;color:#fff}
.ap-edit-mod-ic--green{background:linear-gradient(135deg,#16A34A,#15803D)}
.ap-edit-mod-ic--blue{background:linear-gradient(135deg,#4F46E5,#4338CA)}
.ap-edit-mod-ic--gray{background:linear-gradient(135deg,#94A3B8,#64748B)}
.ap-edit-mod-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ap-edit-mod-count{font-size:10.5px;font-weight:800;flex-shrink:0;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center}
.ap-edit-mod-count--green{background:rgba(22,163,74,.12);color:#15803D}
.ap-edit-mod-count--blue{background:rgba(79,70,229,.12);color:#4338CA}
.ap-edit-mod-count--gray{background:rgba(148,163,184,.15);color:#64748B}
.ap-edit-content{min-width:0}
.ap-edit-mod-h{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px}
.ap-edit-mod-title{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:800;color:var(--t1)}
.ap-edit-mod-title i{color:#4F46E5}
.ap-edit-mod-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ap-edit-mod-toggle{display:flex;align-items:center;gap:6px;padding:6px 11px;border:1.5px solid var(--bl);border-radius:999px;background:var(--card);color:var(--t2);font-size:11.5px;font-weight:700;cursor:pointer;transition:var(--tr)}
.ap-edit-mod-toggle i{font-size:15px}
.ap-edit-mod-toggle.on{border-color:#4F46E5;background:linear-gradient(135deg,rgba(79,70,229,.12),rgba(67,56,202,.1));color:#4338CA}
.ap-edit-tpl-sel{height:32px;width:auto;font-size:11.5px}
.ap-edit-summary{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
.ap-edit-stat{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700}
.ap-edit-stat b{font-weight:800}
.ap-edit-stat--blue{background:rgba(30,58,138,.08);color:#1E40AF}
.ap-edit-stat--indigo{background:rgba(79,70,229,.1);color:#4338CA}
.ap-edit-stat--green{background:rgba(22,163,74,.1);color:#15803D}
.ap-edit-stat--amber{background:rgba(217,119,6,.1);color:#B45309}
@media (max-width:760px){ .ap-edit-layout{grid-template-columns:1fr} .ap-edit-side-list{max-height:180px} }
`;

const emptyForm = () => ({ name: '', description: '', color: ROLE_COLORS[0].value, moduleIds: [], actions: ['view'] });

export default function RolesTab({ roles, setRoles, toast }) {
  const [modal, setModal] = useState(null); // { mode:'create'|'edit', role? }
  const [delRole, setDelRole] = useState(null);

  const openCreate = () => setModal({ mode: 'create' });
  const openEdit = (role) => setModal({ mode: 'edit', role });

  const saveRole = (form, roleId) => {
    const perms = permsFromModuleSelection(form.moduleIds, form.actions);
    if (roleId) {
      setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, name: form.name, description: form.description, color: form.color, customPerms: perms, template: undefined } : r)));
      toast?.('Role updated', 'success');
    } else {
      const id = `role-${Date.now()}`;
      setRoles((prev) => [...prev, { id, name: form.name, description: form.description, color: form.color, userCount: 0, customPerms: perms, isDefault: false }]);
      toast?.('Role created', 'success');
    }
    setModal(null);
  };

  const deleteRole = (role) => {
    setRoles((prev) => prev.filter((r) => r.id !== role.id));
    setDelRole(null);
    toast?.('Role deleted', 'info');
  };

  return (
    <div className="um-panel">
      <div className="ap-banner"><i className="fa-solid fa-circle-info" /><span>Roles bundle module + action access for User Permission assignment. The 5 default roles below can be edited but not deleted; create additional roles as needed.</span></div>
      <div className="section-card">
        <div className="card-header">
          <div><div className="card-title"><i className="fa-solid fa-user-shield" /> Roles</div><div className="card-sub">{roles.length} role{roles.length !== 1 ? 's' : ''} configured</div></div>
          <button className="btn-primary" onClick={openCreate}><i className="fa-solid fa-plus" /> Create Role</button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="ap-role-grid">
            {roles.map((role) => {
              const perms = role.customPerms || (role.template ? undefined : {});
              const stats = perms ? permStats(perms) : null;
              return (
                <div key={role.id} className="ap-role-card">
                  <div className="ap-role-top">
                    <div className="ap-role-swatch" style={{ background: role.color }}><i className="fa-solid fa-user-shield" /></div>
                    <div style={{ flex: 1 }}>
                      <div className="ap-role-name">{role.name}</div>
                      <div className="ap-role-count">{role.userCount || 0} user{role.userCount === 1 ? '' : 's'}{role.isDefault ? ' · Default role' : ''}</div>
                    </div>
                  </div>
                  <div className="ap-role-desc">{role.description}</div>
                  {stats && <div className="ap-role-stats"><span><b>{stats.modules}</b> modules</span><span><b>{stats.screens}</b> screens</span><span><b>{stats.active}</b> permissions</span></div>}
                  <div className="ap-role-actions">
                    <button className="btn-sm" style={{ flex: 1 }} onClick={() => openEdit(role)}><i className="fa-solid fa-pen" /> Edit</button>
                    {!role.isDefault && <button className="btn-sm" style={{ borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDelRole(role)}><i className="fa-solid fa-trash-can" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modal && <RoleFormModal mode={modal.mode} role={modal.role} onClose={() => setModal(null)} onSave={saveRole} toast={toast} />}
      {delRole && (
        <div className="um-del-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) setDelRole(null); }}>
          <div className="um-del-modal">
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-trash-can" /></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Delete Role?</div>
            <div style={{ fontSize: 13, color: 'var(--tm)', marginBottom: 20, lineHeight: 1.6 }}>"{delRole.name}" will be permanently deleted. Users on this role should be reassigned first.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}><button className="btn-secondary" onClick={() => setDelRole(null)}>Cancel</button><button className="btn-danger" onClick={() => deleteRole(delRole)}><i className="fa-solid fa-trash-can" /> Delete Role</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleFormModal({ mode, role, onClose, onSave, toast }) {
  const [f, setF] = useState(() => {
    if (mode === 'edit' && role) {
      return {
        name: role.name, description: role.description, color: role.color,
        moduleIds: role.customPerms ? modulesGrantedIn(role.customPerms) : [],
        actions: role.customPerms ? PERMISSION_ACTIONS.filter((a) => Object.keys(role.customPerms).some((k) => k.endsWith(`.${a}`) && role.customPerms[k])) : ['view'],
      };
    }
    return emptyForm();
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleModule = (mid) => setF((p) => ({ ...p, moduleIds: p.moduleIds.includes(mid) ? p.moduleIds.filter((x) => x !== mid) : [...p.moduleIds, mid] }));
  const toggleAction = (a) => setF((p) => ({ ...p, actions: p.actions.includes(a) ? p.actions.filter((x) => x !== a) : [...p.actions, a] }));

  const save = () => {
    if (!f.name.trim()) { toast?.('Please enter a role name', 'warn'); return; }
    if (mode === 'edit' && role?.template && role.moduleIds === undefined) {
      // Editing a default template-based role for the first time — fine, it just becomes a custom role now.
    }
    onSave(f, role?.id);
  };

  return (
    <div className="um-edit-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="um-edit-modal" style={{ maxWidth: 640 }}>
        <div className="sop-modal-hdr" style={{ borderRadius: 'var(--r-xl) var(--r-xl) 0 0' }}>
          <div className="sop-modal-icon"><i className="fa-solid fa-user-shield" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{mode === 'edit' ? 'Edit Role' : 'Create Role'}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>Choose the modules and actions this role can access</div></div>
          <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div style={{ padding: 22, maxHeight: '65vh', overflow: 'auto' }}>
          <div className="um-form-grid-2">
            <div className="um-field"><label className="um-label">Role Name</label><input className="um-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Finance Officer" /></div>
            <div className="um-field"><label className="um-label">Color</label>
              <div style={{ display: 'flex', gap: 6 }}>{ROLE_COLORS.map((c) => (
                <button key={c.id} type="button" onClick={() => set('color', c.value)} style={{ width: 26, height: 26, borderRadius: '50%', background: c.value, border: f.color === c.value ? '2.5px solid var(--t1)' : '2px solid transparent', cursor: 'pointer' }} />
              ))}</div>
            </div>
          </div>
          <div className="um-field" style={{ marginBottom: 16 }}><label className="um-label">Description</label><input className="um-input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description of this role" /></div>

          <label className="um-label" style={{ display: 'block', marginBottom: 8 }}>Modules</label>
          <div className="ap-mod-grid">
            {MODULE_TREE.map((m) => (
              <label key={m.id} className={`ap-mod-chip${f.moduleIds.includes(m.id) ? ' on' : ''}`}>
                <input type="checkbox" checked={f.moduleIds.includes(m.id)} onChange={() => toggleModule(m.id)} />
                <i className={`fa-solid ${m.icon}`} /> {m.label}
              </label>
            ))}
          </div>

          <label className="um-label" style={{ display: 'block', marginBottom: 8 }}>Actions</label>
          <div className="ap-act-row">
            {PERMISSION_ACTIONS.map((a) => (
              <label key={a} className={`ap-act-chip${f.actions.includes(a) ? ' on' : ''}`}>
                <input type="checkbox" checked={f.actions.includes(a)} onChange={() => toggleAction(a)} /> {ACTION_LABELS[a]}
              </label>
            ))}
          </div>
        </div>
        <div className="sop-modal-foot">
          <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> {mode === 'edit' ? 'Save Changes' : 'Create Role'}</button>
        </div>
      </div>
    </div>
  );
}
