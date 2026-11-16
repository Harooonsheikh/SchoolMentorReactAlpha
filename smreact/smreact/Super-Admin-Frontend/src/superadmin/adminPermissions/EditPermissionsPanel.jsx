import React, { useMemo, useState } from 'react';
import {
  MODULE_TREE, PRIMARY_ACTIONS, ADVANCED_ACTIONS, ACTION_LABELS,
  ROLE_TEMPLATES, findRole, permsForRole, getApplicablePerms, isPermApplicable, permStats,
} from './adminPermissionsData';

/* ═══════════════════════════════════════════════════════════════════
   EditPermissionsPanel — fine-grained per-user permission matrix.
   Rebuilt to match the ERP's own EditPermissionsPanel.jsx exactly:
   left module rail (with a live per-module granted-count badge) +
   right master/detail matrix (screens × actions, Primary columns by
   default with a More/Less toggle for the 4 advanced ones), plus the
   same 4 levels of bulk action the ERP has — global Select/Deselect
   All, per-module "Select ALL for this Module", per-module "Apply
   Role Template…", and a per-row Select/Deselect All link — so a
   Super Admin can manage exactly which person can view/create/edit/
   delete/etc. which screen, at the same depth as the ERP.

   Opened from UserManagement.jsx (Registration tab's row action, and
   the dedicated User Permission tab's View/Edit actions). Saving
   always writes a `customPermissions` map (permType:'custom') — same
   convention as the ERP reference: once a user's matrix is hand-
   edited, it diverges from their role's raw template and is tracked
   independently from then on. `readOnly` renders the same matrix with
   every input disabled and no Save button (View Permissions mode).
   ═══════════════════════════════════════════════════════════════════ */
export default function EditPermissionsPanel({ user, assignment, roles, onClose, onSave, toast, readOnly = false }) {
  const startingPerms = useMemo(() => {
    if (assignment?.permType === 'custom' && assignment.customPermissions) return assignment.customPermissions;
    const role = findRole(roles, assignment?.role);
    return permsForRole(role);
  }, [assignment, roles]);

  const [perms, setPerms] = useState(startingPerms);
  const [activeModuleId, setActiveModuleId] = useState(MODULE_TREE[0]?.id);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const mod = MODULE_TREE.find((m) => m.id === activeModuleId) || MODULE_TREE[0];
  const roleName = findRole(roles, assignment?.role)?.name;
  const visibleActions = showAdvanced ? PRIMARY_ACTIONS.concat(ADVANCED_ACTIONS) : PRIMARY_ACTIONS;

  const toggle = (screenId, action) => {
    if (readOnly) return;
    setPerms((prev) => ({ ...prev, [`${screenId}.${action}`]: !prev[`${screenId}.${action}`] }));
  };

  /* Per-module live count — used for the left rail badge, colour-coded
     green (every applicable permission on), blue (some on), grey (none). */
  const moduleStat = (m) => {
    let total = 0, on = 0;
    m.children.forEach((c) => getApplicablePerms(c.id).forEach((a) => {
      total += 1;
      if (perms[`${c.id}.${a}`]) on += 1;
    }));
    return { on, total, allOn: total > 0 && on === total, anyOn: on > 0 };
  };

  const setManyForModule = (m, value) => {
    setPerms((prev) => {
      const next = { ...prev };
      m.children.forEach((c) => getApplicablePerms(c.id).forEach((a) => { next[`${c.id}.${a}`] = value; }));
      return next;
    });
  };

  const globalSelectAll = (value) => {
    if (readOnly) return;
    setPerms((prev) => {
      const next = { ...prev };
      MODULE_TREE.forEach((m) => m.children.forEach((c) => getApplicablePerms(c.id).forEach((a) => { next[`${c.id}.${a}`] = value; })));
      return next;
    });
  };

  const setRowAll = (screenId, value) => {
    if (readOnly) return;
    setPerms((prev) => {
      const next = { ...prev };
      getApplicablePerms(screenId).forEach((a) => { next[`${screenId}.${a}`] = value; });
      return next;
    });
  };

  /* "Apply Role Template…" — scoped only to the currently open module's
     screens, same as the ERP (never touches other modules' state). */
  const applyTemplateToModule = (templateKey) => {
    if (readOnly || !templateKey) return;
    const tpl = ROLE_TEMPLATES[templateKey];
    if (!tpl) return;
    const actions = tpl.giveAll ? PRIMARY_ACTIONS.concat(ADVANCED_ACTIONS) : (tpl.actions || []);
    const moduleIncluded = tpl.giveAll || (tpl.modules || []).includes(mod.id);
    setPerms((prev) => {
      const next = { ...prev };
      mod.children.forEach((c) => {
        getApplicablePerms(c.id).forEach((a) => {
          const fromModule = moduleIncluded && actions.includes(a);
          const fromExtra = tpl.extra?.[c.id]?.includes(a);
          next[`${c.id}.${a}`] = !!(fromModule || fromExtra);
        });
      });
      return next;
    });
  };

  const stats = permStats(perms);
  const modStat = moduleStat(mod);

  const save = () => { onSave(perms); toast?.('Permissions updated', 'success'); };

  return (
    <div className="um-edit-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="um-edit-modal ap-edit-modal">
        <div className="ap-edit-hdr">
          <div className="ap-edit-hdr-ic"><i className={`fa-solid ${readOnly ? 'fa-eye' : 'fa-table-cells-large'}`} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ap-edit-hdr-tt">{readOnly ? 'View Permissions' : 'Edit Permissions'} — {user.fullName}</div>
            <div className="ap-edit-hdr-sb">{roleName ? `Role: ${roleName}` : 'No role assigned'}{assignment?.permType === 'custom' ? ' · Custom overrides applied' : ''}</div>
          </div>
          <button className="pm-close ap-edit-hdr-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="ap-edit-body">
          {!readOnly && (
            <div className="ap-banner"><i className="fa-solid fa-circle-info" /><span>Editing this matrix directly overrides the user's role template for their account only — the role itself is unaffected.</span></div>
          )}

          <div className="ap-edit-layout">
            {/* ── Left rail — module list ── */}
            <aside className="ap-edit-side">
              {!readOnly && (
                <div className="ap-edit-side-top">
                  <button className="btn-sm" style={{ flex: 1 }} onClick={() => globalSelectAll(true)}><i className="fa-solid fa-check-double" /> Select All</button>
                  <button className="btn-sm" style={{ flex: 1 }} onClick={() => globalSelectAll(false)}><i className="fa-solid fa-xmark" /> Deselect All</button>
                </div>
              )}
              <div className="ap-edit-side-list">
                {MODULE_TREE.map((m) => {
                  const st = moduleStat(m);
                  const tone = st.allOn ? 'green' : st.anyOn ? 'blue' : 'gray';
                  return (
                    <button key={m.id} className={`ap-edit-mod${m.id === activeModuleId ? ' on' : ''}`} onClick={() => setActiveModuleId(m.id)}>
                      <span className={`ap-edit-mod-ic ap-edit-mod-ic--${tone}`}><i className={`fa-solid ${m.icon}`} /></span>
                      <span className="ap-edit-mod-label">{m.label}</span>
                      <span className={`ap-edit-mod-count ap-edit-mod-count--${tone}`}>{st.on}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* ── Right pane — module header + matrix ── */}
            <div className="ap-edit-content">
              <div className="ap-edit-mod-h">
                <div className="ap-edit-mod-title"><i className={`fa-solid ${mod.icon}`} /> {mod.label}</div>
                {!readOnly && (
                  <div className="ap-edit-mod-actions">
                    <button className={`ap-edit-mod-toggle${modStat.allOn ? ' on' : ''}`} onClick={() => setManyForModule(mod, !modStat.allOn)}>
                      <i className={`fa-solid ${modStat.allOn ? 'fa-toggle-on' : 'fa-toggle-off'}`} /> Select ALL for this Module
                    </button>
                    <select className="um-input ap-edit-tpl-sel" defaultValue="" onChange={(e) => { applyTemplateToModule(e.target.value); e.target.value = ''; }}>
                      <option value="" disabled>Apply Role Template…</option>
                      {Object.entries(ROLE_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="ap-matrix-wrap">
                <table className="ap-matrix">
                  <thead>
                    <tr>
                      <th className="l">Screen / Section</th>
                      {visibleActions.map((a) => <th key={a}>{ACTION_LABELS[a]}</th>)}
                      <th className="r">
                        <button type="button" className="ap-matrix-more" onClick={() => setShowAdvanced((s) => !s)}>
                          {showAdvanced ? '◀ Less' : 'More ▶'}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mod.children.map((child, i) => {
                      const prevGroup = i > 0 ? mod.children[i - 1].group : undefined;
                      const applicable = getApplicablePerms(child.id);
                      const someOn = applicable.some((a) => perms[`${child.id}.${a}`]);
                      return (
                        <React.Fragment key={child.id}>
                          {child.group && child.group !== prevGroup && (
                            <tr className="ap-matrix-group-row"><td colSpan={visibleActions.length + 2}>{child.group}</td></tr>
                          )}
                          <tr>
                            <td className="l">{child.label}</td>
                            {visibleActions.map((a) => (
                              <td key={a} title={!isPermApplicable(child.id, a) ? 'Not applicable for this screen' : undefined} className={!isPermApplicable(child.id, a) ? 'ap-cell-na' : undefined}>
                                <input
                                  type="checkbox"
                                  disabled={readOnly || !isPermApplicable(child.id, a)}
                                  checked={isPermApplicable(child.id, a) && !!perms[`${child.id}.${a}`]}
                                  onChange={() => toggle(child.id, a)}
                                />
                              </td>
                            ))}
                            <td className="r">
                              {!readOnly && (
                                <button type="button" className="ap-matrix-row-link" onClick={() => setRowAll(child.id, !someOn)}>
                                  {someOn ? 'Deselect' : 'Select All'}
                                </button>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="ap-edit-summary">
                <span className="ap-edit-stat ap-edit-stat--blue"><i className="fa-solid fa-layer-group" /> <b>{stats.modules}</b> modules</span>
                <span className="ap-edit-stat ap-edit-stat--indigo"><i className="fa-solid fa-table-cells-large" /> <b>{stats.screens}</b> screens</span>
                <span className="ap-edit-stat ap-edit-stat--green"><i className="fa-solid fa-circle-check" /> <b>{stats.active}</b> permissions active</span>
                {stats.restricted > 0 && (
                  <span className="ap-edit-stat ap-edit-stat--amber"><i className="fa-solid fa-lock" /> <b>{stats.restricted}</b> screens with no access</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sop-modal-foot">
          {readOnly ? (
            <button className="btn-primary" onClick={onClose}><i className="fa-solid fa-xmark" /> Close</button>
          ) : (
            <>
              <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
              <button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Permissions</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
