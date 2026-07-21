import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import EditPermissionsPanel from './EditPermissionsPanel';
import AssignRoleModal from './AssignRoleModal';
import DashboardTypeModal from './DashboardTypeModal';
import { assignRoleToUser, saveUserMenuPermissions } from '../../services/rolesService';
import {
  findRole,
  initialsOf,
  permsFromModules,
  apiPermissionsFromPerms,
} from './permissionsData';

/* ═══════════════════════════════════════════════════════════════════
   USERS TAB — filter bar + table + per-row actions
   ═══════════════════════════════════════════════════════════════════ */
export default function UsersTab({
  users, roles, assignRole, setUserStatus, updateUserPermissions,
  setDashboardType, toast, loading = false,
  canEdit = true, canAssign = true,
}) {
  const [search,    setSearch]    = useState('');
  const [fRole,     setFRole]     = useState('all');
  const [fStatus,   setFStatus]   = useState('all');
  const [fPerm,     setFPerm]     = useState('all');

  const [editFor,   setEditFor]   = useState(null); // user being edited
  const [assignFor, setAssignFor] = useState(null); // user whose role is being changed
  const [dashFor,   setDashFor]   = useState(null); // user whose dashboard type is being set
  const [confirmCfg, setConfirmCfg] = useState(null); // {user, nextStatus}

  /* Filtered + role-enriched list. */
  const rows = useMemo(() => users.map(u => {
    const role = findRole(roles, u.role);
    /* App-role mile to wahi, warna user ka apna roleLabel/roleColor (e.g. employee
       flags se derive kiya Principal/Teacher/Parent), warna '—'. */
    return {
      ...u,
      roleLabel: role?.name || u.roleLabel || '—',
      roleColor: role?.color || u.roleColor || '#64748B',
    };
  }).filter(u => {
    /* Role filter ab label par match karta hai (app-role id ya employee-flag role). */
    if (fRole !== 'all' && u.role !== fRole && u.roleLabel !== fRole) return false;
    if (fStatus !== 'all' && u.status !== fStatus) return false;
    if (fPerm !== 'all' && u.permType !== fPerm) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${u.name} ${u.email} ${u.employeeId}`.toLowerCase().includes(q);
  }), [users, roles, search, fRole, fStatus, fPerm]);

  /* Role dropdown ke options — jo roles asal me users me maujood hain (Principal /
     Teacher / Parent, ya app-roles jab wo use hon). Distinct + '—' hataya. */
  const roleOptions = useMemo(() => {
    const seen = new Map(); // value → label
    users.forEach(u => {
      const r = findRole(roles, u.role);
      if (r) { seen.set(r.id, r.name); return; }
      const lbl = u.roleLabel;
      if (lbl && lbl !== '—') seen.set(lbl, lbl);
    });
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [users, roles]);

  const onStatusToggleAsk = (user) => {
    if (user.status === 'Active') {
      setConfirmCfg({ user, nextStatus: 'Inactive' });
    } else {
      /* Activation is a low-risk action — no confirm needed. */
      setUserStatus(user.id, 'Active');
    }
  };

  /* Assign Role → /assign-role-to-user par POST, phir role ke modules ko
     user ki menu-permissions me sync, phir local state + audit.
     Error par throw taake modal khula rahe. */
  const handleAssignRole = async (user, newRoleId) => {
    const branchID   = Number(sessionStorage.getItem('branchID')) || 0;
    const employeeID = Number(user.empId ?? user.employeeId) || 0;
    const payload = {
      employeeID,
      roleID:    Number(newRoleId) || 0,
      branchID,
      createdBy: Number(sessionStorage.getItem('UserID')) || 0,
    };
    let res;
    try {
      res = await assignRoleToUser(payload);
    } catch (err) {
      console.error('Could not assign role:', err);
      toast('Could not assign role. Please try again.', 'error');
      throw err;
    }
    if (res && (res.success === false || res.status === false)) {
      toast(res.message || res.Message || 'Could not assign role', 'error');
      throw new Error(res.message || 'Assign failed');
    }

    /* Role change ke baad Edit Permissions me role ke modules hi dikhne
       chahiye — is liye role ke modules ko user ki menu-permissions me
       reset kar do (full tree, taake purane custom/removed modules false
       ho jayein). Fail ho to non-fatal (role assign ho chuka). */
    const role = findRole(roles, newRoleId);
    if (role && Array.isArray(role.modules)) {
      try {
        const perms = permsFromModules(role.modules);
        await saveUserMenuPermissions({
          branchID,
          employeeID,
          permissions: apiPermissionsFromPerms(perms),
        });
      } catch (err) {
        console.error('Could not sync menu permissions for assigned role:', err);
      }
    }

    /* Local table + audit + success toast (assignRole khud toast karta hai). */
    assignRole(user.id, newRoleId);
  };

  return (
    <>
      <div className="up-filters up-filters--users">
        <div className="up-search">
          <i className="fa-solid fa-magnifying-glass up-search-ic" aria-hidden="true"></i>
          <input
            type="text"
            className="up-search-input"
            placeholder="Search by name, email or EID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
          {search && (
            <Tooltip text="Clear search">
              <button type="button" className="up-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          )}
        </div>
        <select className="up-select" value={fRole} onChange={(e) => setFRole(e.target.value)} aria-label="Filter by role">
          <option value="all">All Roles</option>
          {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select className="up-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select className="up-select" value={fPerm} onChange={(e) => setFPerm(e.target.value)} aria-label="Filter by permission type">
          <option value="all">All Permissions</option>
          <option value="role">Role Based</option>
          <option value="custom">Custom Access</option>
        </select>
        <span /> {/* keep grid column count */}
      </div>

      {loading ? (
        <div className="up-empty">
          <div className="up-empty-ic"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></div>
          <div className="up-empty-title">Loading staff details…</div>
          <div className="up-empty-sub">Fetching users from the server, please wait.</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="up-empty">
          <div className="up-empty-ic"><i className="fa-solid fa-user-slash" aria-hidden="true"></i></div>
          <div className="up-empty-title">No users match the current filters</div>
          <div className="up-empty-sub">Try clearing the search or filter dropdowns.</div>
        </div>
      ) : (
        <div className="up-table">
          <div className="up-table-head" style={{ gridTemplateColumns: '1.4fr 100px 1fr 120px 130px 90px 130px 200px' }}>
            <div className="th">User</div>
            <div className="th">Employee ID</div>
            <div className="th">Role</div>
            <div className="th c">Perm Type</div>
            <div className="th c">Dashboard</div>
            <div className="th c">Status</div>
            <div className="th">Last Login</div>
            <div className="th c">Actions</div>
          </div>
          {rows.map(u => (
            <div key={u.id} className="up-table-row" style={{ gridTemplateColumns: '1.4fr 100px 1fr 120px 130px 90px 130px 200px' }}>
              <div className="td up-emp">
                <Tooltip text={`${u.name} · ${u.email}`}>
                  <div className="up-avatar">{initialsOf(u.name)}</div>
                </Tooltip>
                <div className="up-emp-text">
                  <div className="up-emp-name">{u.name}</div>
                  <div className="up-emp-meta">{u.email}</div>
                </div>
              </div>
              <div className="td">
                <Tooltip text={`Employee ID: ${u.employeeId}`}>
                  <span className="up-badge up-badge--gray">{u.employeeId}</span>
                </Tooltip>
              </div>
              <div className="td">
                <Tooltip text={`Role: ${u.roleLabel}`}>
                  <span
                    className="up-role-pill"
                    style={{ background: `${u.roleColor}1A`, color: u.roleColor }}
                  >
                    <span className="up-role-dot" style={{ background: u.roleColor }} />
                    {u.roleLabel}
                  </span>
                </Tooltip>
              </div>
              <div className="td c">
                {u.permType === 'custom' ? (
                  <Tooltip text={u.customNote || 'Custom permissions applied'}>
                    <span className="up-badge up-badge--purple">
                      <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Custom Access
                    </span>
                  </Tooltip>
                ) : (
                  <span className="up-badge up-badge--blue">Role Based</span>
                )}
              </div>
              <div className="td c">
                {u.dashboardType === 'teacher' ? (
                  <Tooltip text="Teacher — personal workspace scoped to assigned classes">
                    <span className="up-badge up-badge--purple">
                      <i className="fa-solid fa-chalkboard-user" aria-hidden="true"></i> Teacher
                    </span>
                  </Tooltip>
                ) : (
                  <Tooltip text="Admin — school-level dashboard with KPIs and analytics">
                    <span className="up-badge up-badge--blue">
                      <i className="fa-solid fa-chart-line" aria-hidden="true"></i> Admin
                    </span>
                  </Tooltip>
                )}
              </div>
              <div className="td c">
                <Tooltip text={u.status === 'Active' ? 'User is active and can sign in' : 'User is deactivated and cannot sign in'}>
                  <span className={`up-badge up-badge--${u.status === 'Active' ? 'green' : 'gray'}`}>
                    <i className={`fa-solid ${u.status === 'Active' ? 'fa-circle-check' : 'fa-circle-minus'}`} aria-hidden="true"></i>
                    {u.status}
                  </span>
                </Tooltip>
              </div>
              <Tooltip text={`Last login: ${u.lastLogin}`}>
                <div className="td up-emp-meta">{u.lastLogin}</div>
              </Tooltip>
              <div className="td c up-actions">
                <Tooltip text={u.roleLabel === 'Principal' ? 'Not available for Principal' : 'View read-only summary'}>
                  <button
                    className="up-act"
                    onClick={() => setEditFor({ user: u, readOnly: true })}
                    disabled={u.roleLabel === 'Principal'}
                    aria-label="View permissions"
                  >
                    <i className="fa-solid fa-eye" aria-hidden="true"></i>
                  </button>
                </Tooltip>
                {canEdit && (
                  <Tooltip text={u.roleLabel === 'Principal' ? 'Not available for Principal' : 'Edit permissions'}>
                    <button
                      className="up-act"
                      onClick={() => setEditFor({ user: u, readOnly: false })}
                      disabled={u.roleLabel === 'Principal'}
                      aria-label="Edit permissions"
                    >
                      <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                )}
                {canAssign && (
                  <Tooltip text={u.roleLabel === 'Principal' ? 'Not available for Principal' : 'Assign role'}>
                    <button className="up-act" onClick={() => setAssignFor(u)} disabled={u.roleLabel === 'Principal'} aria-label="Assign role">
                      <i className="fa-solid fa-user-tag" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                )}
              {/*  <Tooltip text={u.roleLabel === 'Principal' ? 'Not available for Principal' : 'Set Dashboard type (Admin / Teacher)'}>
                  <button className="up-act" onClick={() => setDashFor(u)} disabled={u.roleLabel === 'Principal'} aria-label="Set dashboard type">
                    <i className="fa-solid fa-gauge-high" aria-hidden="true"></i>
                  </button>
                </Tooltip> */}
                {canEdit && (
                  <Tooltip text={u.roleLabel === 'Principal' ? 'Not available for Principal' : (u.status === 'Active' ? 'Deactivate user' : 'Activate user')}>
                    <button
                      className={`up-act${u.status === 'Active' ? ' up-act--danger' : ''}`}
                      onClick={() => onStatusToggleAsk(u)}
                      disabled={u.roleLabel === 'Principal'}
                      aria-label={u.status === 'Active' ? 'Deactivate' : 'Activate'}
                    >
                      <i className={`fa-solid ${u.status === 'Active' ? 'fa-ban' : 'fa-check'}`} aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {editFor && (
        <EditPermissionsPanel
          user={editFor.user}
          roles={roles}
          readOnly={editFor.readOnly}
          onClose={() => setEditFor(null)}
          onSave={(perms, summary) => {
            updateUserPermissions(editFor.user.id, perms, summary);
            setEditFor(null);
          }}
          toast={toast}
        />
      )}
      {assignFor && (
        <AssignRoleModal
          user={assignFor}
          roles={roles}
          onClose={() => setAssignFor(null)}
          onConfirm={async (newRoleId) => {
            await handleAssignRole(assignFor, newRoleId);
            setAssignFor(null);
          }}
        />
      )}
      {dashFor && (
        <DashboardTypeModal
          user={dashFor}
          onClose={() => setDashFor(null)}
          onConfirm={(type) => {
            setDashboardType(dashFor.id, type);
            setDashFor(null);
          }}
        />
      )}
      {confirmCfg && (
        <DeactivateDialog
          user={confirmCfg.user}
          onCancel={() => setConfirmCfg(null)}
          onConfirm={() => {
            setUserStatus(confirmCfg.user.id, confirmCfg.nextStatus);
            setConfirmCfg(null);
          }}
        />
      )}
    </>
  );
}

/* ─── Small inline deactivate confirm dialog ─── */
function DeactivateDialog({ user, onCancel, onConfirm }) {
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
            <i className="fa-solid fa-ban" aria-hidden="true"></i>
          </div>
          <div className="up-confirm-title">Deactivate {user.name}?</div>
          <div className="up-confirm-text">
            This user will lose access to the ERP immediately. Their data will be preserved. You can reactivate at any time.
          </div>
        </div>
        <div className="up-modal-foot up-modal-foot--center">
          <button type="button" className="up-btn up-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="up-btn up-btn-danger" onClick={onConfirm}>
            <i className="fa-solid fa-ban" aria-hidden="true"></i> Deactivate
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
