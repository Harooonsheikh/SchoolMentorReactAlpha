import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';
import { getEmployeesByBranch } from '../../services/attendanceService';
import { deleteHrEmployee, restoreHrEmployee } from '../../services/hrService';
import { buildUrl } from '../../../utils/apiConfig';
import {
  getRolesByBranch,
  saveRole,
  getUserRole,
  deleteRole as deleteRoleApi,
  assignRoleToUser,
} from '../../services/rolesService';
import UsersTab from './UsersTab';
import RolesTab from './RolesTab';
import PermissionGroupsTab from './PermissionGroupsTab';
import AuditLogsTab from './AuditLogsTab';
import { usePermissions } from '../../context/PermissionsContext';
import {
  INITIAL_GROUPS,
  INITIAL_AUDIT,
  ROLE_COLORS,
  normalizeApiRole,
  findRole,
  nextAuditEntry,
} from './permissionsData';

/* ═══════════════════════════════════════════════════════════════════
   USER PERMISSIONS — top-level module

   Holds the master state for users / roles / groups / auditLog and
   exposes mutation handlers down to every tab + modal. Every change
   that touches a user (role swap, perm edit, activate/deactivate)
   auto-appends an entry to the audit log via `logAudit`.
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'users',  icon: 'fa-users',           label: 'Users'             },
  { id: 'roles',  icon: 'fa-id-badge',        label: 'Roles'             },
 /* { id: 'groups', icon: 'fa-layer-group',     label: 'Permission Groups' },*/
  { id: 'audit',  icon: 'fa-clipboard-list',  label: 'Audit Logs'        },
];

/* get-employees-by-branch ki employee row ko Users-tab wali user shape me map karo.
   UI same rehti hai — sirf real employee data dikhta hai. */
const EMPTY_TEXT = new Set(['', 'string', 'n/a']);
const cleanVal = (v) => {
  const s = String(v ?? '').trim();
  return EMPTY_TEXT.has(s.toLowerCase()) ? '' : s;
};
/* isActive backend se boolean / 0-1 / "true"-"false" — kisi bhi form me aa sakta hai.
   Sirf saaf-saaf false-ish ko INACTIVE maano, warna active. */
const empIsActive = (v) => {
  if (v == null) return true;
  if (typeof v === 'string') { const s = v.trim().toLowerCase(); return !(s === 'false' || s === '0' || s === 'no'); }
  return !!v;
};
function mapEmployeeToUser(e) {
  const name = `${cleanVal(e.firstName)} ${cleanVal(e.lastName)}`.trim() || 'Unnamed';
  const email = cleanVal(e.email);
  /* Role = jo flag true ho (Principal > Teacher > Parent priority). */
  const roleInfo = e.isPrinciple ? { label: 'Principal', color: '#7C3AED' }
    : e.isTeacher ? { label: 'Teacher', color: '#1E40AF' }
    : e.isParent ? { label: 'Parent', color: '#15803D' }
    : { label: '—', color: '#64748B' };
  return {
    id: `emp-${e.id}`,
    empId: e.id,
    name,
    email: email || '—',
    role: undefined,                       // app-role id nahi; label/color neeche diye hain
    roleLabel: roleInfo.label,
    roleColor: roleInfo.color,
    employeeId: `EMP-${String(e.id).padStart(3, '0')}`,
    dept: cleanVal(e.departmentName),
    designation: cleanVal(e.designationName),
    status: empIsActive(e.isActive) ? 'Active' : 'Inactive',
    lastLogin: '—',
    permType: 'custom',
    /* Teacher (magar principal nahi) → teacher dashboard, warna admin. */
    dashboardType: (e.isTeacher && !e.isPrinciple) ? 'teacher' : 'admin',
    _employee: e,                          // raw employee (future use)
  };
}

/* get-roles-by-branch ka row → Roles-tab card shape. Shared normalizer
   permissionsData.js me hai (normalizeApiRole) taake modal bhi wahi use kare. */

/* /get-user-role response row → { roleId, roleName, color }. Field naam
   vary kar sakte hain is liye defensive fallbacks. Kuch na mile to null. */
function extractUserRole(d) {
  const row = Array.isArray(d) ? d[0] : d;
  if (!row) return null;
  const roleId   = row.roleID ?? row.RoleID ?? row.roleId ?? row.id ?? row.ID ?? null;
  const roleName = row.roleName ?? row.RoleName ?? row.name ?? '';
  const color    = row.color ?? row.Color ?? '';
  if (roleId == null && !roleName) return null;
  return { roleId, roleName, color };
}

export default function UserPermissions({ toast = () => {} }) {
  const { can } = usePermissions();
  const visibleTabs = TABS.filter(t => can('User Permissions', t.label, 'View'));
  const canUsersEdit    = can('User Permissions', 'Users', 'Edit');
  const canUsersAssign  = can('User Permissions', 'Users', 'Assign');
  const canRolesCreate  = can('User Permissions', 'Roles', 'Create');
  const canRolesEdit    = can('User Permissions', 'Roles', 'Edit');
  const canRolesDelete  = can('User Permissions', 'Roles', 'Delete');
  const canGroupsCreate = can('User Permissions', 'Permission Groups', 'Create');
  const canGroupsEdit   = can('User Permissions', 'Permission Groups', 'Edit');
  const canGroupsDelete = can('User Permissions', 'Permission Groups', 'Delete');
  const [tab,      setTab]      = useState('users');
  /* Koi static data nahi — asli staff API se aata hai; tab tak loader chalta hai. */
  const [users,    setUsers]    = useState([]);
  /* Roles ab API se aate hain (/get-roles-by-branch) — koi static seed nahi. */
  const [roles,    setRoles]    = useState([]);
  const [groups,   setGroups]   = useState(INITIAL_GROUPS);
  const [auditLog, setAuditLog] = useState(INITIAL_AUDIT);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);

  /* Users tab active hote hi real employees API se laa kar map karo (ek dafa). */
  useEffect(() => {
    if (tab !== 'users' || usersLoaded) return undefined;
    let alive = true;
    setUsersLoading(true);
    /* Active + inactive dono laao taake deactivate kiya user reload ke baad
       bhi list me (Inactive badge ke saath) dikhe. Id par dedupe — LEKIN conflict
       par DEACTIVATED (isActive:false) copy ko jitao. Warna agar active-call stale
       `isActive:true` laut de (ya employee dono lists me aa jaye) to deactivate
       refresh par wapas Active dikhne lagta tha — yahi bug tha. */
    Promise.all([
      getEmployeesByBranch(true).catch(() => []),
      getEmployeesByBranch(false).catch(() => []),
    ])
      .then(([act, inact]) => {
        /* isActive kabhi boolean false, kabhi 0/"false"/"0" (backend inconsistent) aata
           hai — sab ko sahi INACTIVE samjho. */
        const isInactive = (e) => {
          const v = e?.isActive;
          if (v == null) return false;                 // missing → default active (na todo)
          if (typeof v === 'string') { const s = v.trim().toLowerCase(); return s === 'false' || s === '0' || s === 'no'; }
          return !v;                                   // boolean false / number 0
        };
        const byId = new Map();
        [...(act || []), ...(inact || [])].forEach((e) => {
          const prev = byId.get(e.id);
          /* Conflict par DEACTIVATED copy jitao — active-call ki stale copy override na kare. */
          if (!prev || isInactive(e)) byId.set(e.id, e);
        });
        return [...byId.values()];
      })
      .then(async (list) => {
        if (!alive) return;
        const mapped = (list || []).map(mapEmployeeToUser);
        /* Table foran dikhao (loader band), roles beech me merge karte rahenge. */
        setUsers(mapped);
        setUsersLoading(false);
        /* Har user ka assigned role /get-user-role se laa kar Role column
           bharo. Ek user fail ho to sirf usko chhodo, baaki chalein. */
        const withRoles = await Promise.all(mapped.map(async (u) => {
          try {
            const info = extractUserRole(await getUserRole(u.empId));
            if (!info) return u;
            return {
              ...u,
              role:      info.roleId ?? u.role,
              roleLabel: info.roleName || u.roleLabel,
              roleColor: info.color || u.roleColor,
            };
          } catch (err) {
            return u;
          }
        }));
        if (!alive) return;
        setUsers(withRoles);
        /* usersLoaded ab set karo — pehle karte to effect dobara chal kar
           in-flight role fetch ko cancel kar deta (alive=false). */
        setUsersLoaded(true);
      })
      .catch((err) => {
        console.error('Could not load employees for User Permissions:', err);
        if (alive) { setUsersLoaded(true); setUsersLoading(false); }
      });
    return () => { alive = false; };
  }, [tab, usersLoaded]);

  /* ─── Roles: branch ke saved roles API se laao (list + card details). ─── */
  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const list = await getRolesByBranch();
      setRoles((list || []).map(normalizeApiRole));
    } catch (err) {
      console.error('Could not load roles:', err);
    } finally {
      setRolesLoaded(true);
      setRolesLoading(false);
    }
  }, []);

  /* Roles tab pehli dafa khulte hi (ya AssignRole ke liye) fetch. */
  useEffect(() => {
    if (rolesLoaded) return;
    loadRoles();
  }, [rolesLoaded, loadRoles]);

  /* ─── Audit helper ─── */
  const logAudit = useCallback((entry) => {
    setAuditLog(prev => [nextAuditEntry(entry), ...prev]);
  }, []);

  /* ─── User mutations ─── */
  const updateUser = useCallback((id, patch) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const assignRole = useCallback((userId, newRoleId) => {
    const user = users.find(u => u.id === userId);
    const newRole = findRole(roles, newRoleId);
    if (!user || !newRole) return;
    const prevRoleLabel = findRole(roles, user.role)?.name || '—';
    setUsers(prev => prev.map(u => (
      u.id === userId
        ? { ...u, role: newRoleId, permType: 'role', customPermissions: undefined }
        : u
    )));
    logAudit({
      user: user.name,
      action: 'Role Changed',
      detail: `Role changed from "${prevRoleLabel}" to "${newRole.name}"`,
      type: 'role',
    });
    toast(`Role updated to ${newRole.name}`, 'success');
  }, [users, roles, logAudit, toast]);

  const updateUserPermissions = useCallback((userId, perms, summary) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setUsers(prev => prev.map(u => (
      u.id === userId
        ? { ...u, customPermissions: perms, permType: 'custom' }
        : u
    )));
    logAudit({
      user: user.name,
      action: 'Permission Assigned',
      detail: `Custom permissions updated · ${summary}`,
      type: 'assign',
    });
    /* "Permissions updated for …" toast band — modal ka band ho jana hi
       kaafi ishara hai, aur role badalne par "Role updated to …" pehle hi
       aa jata hai (do toasts ek saath aate the). Audit log waise hi chalta
       rahega. */
  }, [users, logAudit]);

  const setDashboardType = useCallback((userId, dashboardType) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const prev = user.dashboardType === 'teacher' ? 'Teacher' : 'Admin';
    const next = dashboardType === 'teacher' ? 'Teacher' : 'Admin';
    setUsers(p => p.map(u => (u.id === userId ? { ...u, dashboardType } : u)));
    logAudit({
      user: user.name,
      action: 'Dashboard Changed',
      detail: `Dashboard type changed from "${prev}" to "${next}"`,
      type: 'role',
    });
    toast(`${user.name} → ${next} Dashboard`, 'success');
  }, [users, logAudit, toast]);

  /* Deactivate par user ki SAARI saved menu-permissions backend par
     isAccessable:false karke save karo — yani har checked module/screen
     uncheck ho kar ERP access khatam. Pehle current permissions laao
     (get-user-menu-permissions-by-branch), phir wahi list false ke saath
     /save-user-menu-permissions par bhejo. */
  const revokeAllPermissions = useCallback(async (user) => {
    const branchId = sessionStorage.getItem('branchID') || '1';
    const token = sessionStorage.getItem('token');
    const headers = { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch(buildUrl(`/get-user-menu-permissions-by-branch/${branchId}`), { headers });
    const json = await res.json().catch(() => null);
    const entry = (json?.data || []).find(d => String(d.employeeID) === String(user.empId));
    const current = entry?.permissions || [];
    if (!current.length) return;                 // kuch granted hi nahi — revoke ki zaroorat nahi
    const payload = {
      branchID: Number(branchId) || 0,
      employeeID: Number(user.empId) || 0,
      permissions: current.map(p => ({
        menuName: p.menuName,
        subMenuName: p.subMenuName,
        action: p.action,
        isAccessable: false,
      })),
    };
    const save = await fetch(buildUrl('/save-user-menu-permissions'), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const sj = await save.json().catch(() => null);
    if (!save.ok || (sj && sj.success === false)) {
      throw new Error((sj && (sj.message || sj.Message)) || 'Could not revoke permissions');
    }
  }, []);

  const setUserStatus = useCallback(async (userId, status) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    /* Deactivate → (1) saare permission checks uncheck, (2) assigned role
       unassign, (3) employee backend par inactive (delete-employee soft
       delete) — tabhi reload ke baad bhi status Inactive rehta hai.
       Activate → restore-employee se backend par active. */
    if (status !== 'Active') {
      /* CORE action PEHLE — employee ko backend par inactive karo (delete-employee soft
         delete). Yahi isActive=false persist karta hai; refresh par Inactive rehne ke
         liye zaroori hai. Pehle revoke-permissions pehle chalta tha jo fail hone par
         EARLY-RETURN kar deta tha aur delete-employee call HI nahi hota tha (bug). */
      try {
        await deleteHrEmployee({ id: user.empId });
      } catch (err) {
        console.error('Could not mark employee inactive:', err);
        toast('Could not deactivate the account. Please try again.', 'error');
        return;
      }
      /* Ab BEST-EFFORT: permissions uncheck + role unassign. In me se koi fail ho to bhi
         deactivation ho chuki hai — isliye rukna nahi (sirf warn). */
      try {
        await revokeAllPermissions(user);
      } catch (err) {
        console.warn('Could not revoke permissions on deactivate (non-fatal):', err);
      }
      if (user.role != null) {
        try {
          const res = await assignRoleToUser({
            employeeID: Number(user.empId) || 0,
            roleID:     0,
            branchID:   Number(sessionStorage.getItem('branchID')) || 0,
            createdBy:  Number(sessionStorage.getItem('UserID')) || 0,
          });
          if (res && (res.success === false || res.status === false)) {
            throw new Error(res.message || res.Message || 'Unassign failed');
          }
        } catch (err) {
          console.warn('Could not unassign role on deactivate (non-fatal):', err);
        }
      }
    } else {
      try {
        await restoreHrEmployee({ id: user.empId });
      } catch (err) {
        console.error('Could not restore employee:', err);
        toast('Could not activate the account. Please try again.', 'error');
        return;
      }
    }
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      if (status === 'Active') return { ...u, status };
      /* Deactivate → role wapas employee-flag wale label par (app-role hat
         gaya), perms clear. */
      const e = u._employee || {};
      const flag = e.isPrinciple ? { label: 'Principal', color: '#7C3AED' }
        : e.isTeacher ? { label: 'Teacher', color: '#1E40AF' }
        : e.isParent ? { label: 'Parent', color: '#15803D' }
        : { label: '—', color: '#64748B' };
      return {
        ...u,
        status,
        role: undefined,
        roleLabel: flag.label,
        roleColor: flag.color,
        customPermissions: {},
        permType: 'custom',
      };
    }));
    logAudit({
      user: user.name,
      action: status === 'Active' ? 'User Activated' : 'User Deactivated',
      detail: status === 'Active'
        ? `User account activated — ${user.employeeId}`
        : `User account deactivated — role unassigned, all module permissions revoked — ${user.employeeId}`,
      type: status === 'Active' ? 'activate' : 'deactivate',
    });
    toast(
      status === 'Active'
        ? `${user.name} activated`
        : `${user.name} deactivated — role and module access removed`,
      'success',
    );
  }, [users, logAudit, toast, revokeAllPermissions]);

  /* ─── Role mutations ─── */
  /* Create/Update dono /save-role par jaate hain (id:0 → create).
     Success par branch roles dobara fetch → cards + modal list refresh.
     Error par throw taake modal khula rahe. */
  const handleSaveRole = useCallback(async (formData, mode) => {
    const payload = {
      id:          Number(formData.id) || 0,
      branchID:    Number(sessionStorage.getItem('branchID')) || 0,
      roleName:    formData.name,
      description: formData.description || '',
      color:       formData.color || ROLE_COLORS[0].value,
      modules:     formData.modules || [],
      createdBy:   Number(sessionStorage.getItem('UserID')) || 0,
      modifiedBy:  Number(sessionStorage.getItem('UserID')) || 0,
    };
    let res;
    try {
      res = await saveRole(payload);
    } catch (err) {
      console.error('Could not save role:', err);
      toast('Could not save role. Please try again.', 'error');
      throw err;
    }
    if (res && (res.status === false || res.success === false)) {
      toast(res.message || res.Message || 'Could not save role', 'error');
      throw new Error(res.message || 'Save failed');
    }
    toast(
      mode === 'edit'  ? `Role "${formData.name}" updated`
      : mode === 'clone' ? `Role "${formData.name}" cloned`
      : `Role "${formData.name}" created`,
      'success',
    );
    await loadRoles();
  }, [toast, loadRoles]);

  /* Delete → /delete-role/{id}. Success par branch roles dobara fetch.
     Error par throw taake confirm dialog khula rahe. */
  const deleteRole = useCallback(async (roleId) => {
    const role = roles.find(r => r.id === roleId);
    let res;
    try {
      res = await deleteRoleApi(roleId);
    } catch (err) {
      console.error('Could not delete role:', err);
      toast('Could not delete role. Please try again.', 'error');
      throw err;
    }
    if (res && (res.status === false || res.success === false)) {
      toast(res.message || res.Message || 'Could not delete role', 'error');
      throw new Error(res.message || 'Delete failed');
    }
    toast(`Role "${role?.name || ''}" deleted`, 'success');
    await loadRoles();
  }, [roles, toast, loadRoles]);

  const cloneRole = useCallback((roleId) => roles.find(r => r.id === roleId), [roles]);

  /* ─── Group mutations ─── */
  const upsertGroup = useCallback((payload) => {
    setGroups(prev => {
      if (payload.id && prev.find(g => g.id === payload.id)) {
        return prev.map(g => (g.id === payload.id ? { ...g, ...payload } : g));
      }
      const id = payload.id || `g${Date.now()}`;
      return [...prev, { userCount: 0, ...payload, id }];
    });
  }, []);

  const deleteGroup = useCallback((groupId) => {
    const group = groups.find(g => g.id === groupId);
    setGroups(prev => prev.filter(g => g.id !== groupId));
    if (group) toast(`Group "${group.name}" deleted`, 'success');
  }, [groups, toast]);

  /* ─── Stat counters for the page header strip ─── */
  const stats = useMemo(() => ({
    totalUsers:   users.length,
    activeRoles:  roles.length,
    permGroups:   groups.length,
    auditEvents:  auditLog.length,
  }), [users, roles, groups, auditLog]);

  /* Active tab hidden ho to pehle visible tab par snap kar do. */
  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some(t => t.id === tab)) {
      setTab(visibleTabs[0].id);
    }
  }, [visibleTabs, tab]);

  return (
    <>
      <style>{UP_CSS}</style>

      {/* Page header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <div className="page-title">User Permissions</div>
            <div className="page-sub">Manage roles, access control, and audit trail</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the User Permissions module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
            aria-label="Open User Permissions tutorials"
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* Stat strip */}
      <div className="up-stats">
        <Stat tone="blue"   icon="fa-users"           label="Total Users"        value={stats.totalUsers}
              sub={stats.totalUsers === 1 ? '1 active account' : `${stats.totalUsers} active accounts`} />
        <Stat tone="indigo" icon="fa-id-badge"        label="Active Roles"       value={stats.activeRoles}
              sub="Available role definitions" />
        <Stat tone="green"  icon="fa-layer-group"     label="Permission Groups"  value={stats.permGroups}
              sub="Reusable access bundles" />
        <Stat tone="amber"  icon="fa-clipboard-list"  label="Audit Events"       value={stats.auditEvents}
              sub="Last 30 days" />
      </div>

      {/* Tab bar */}
      <div className="up-tabs" role="tablist" aria-label="User Permissions sections">
        {visibleTabs.map(t => (
          <Tooltip key={t.id} text={t.label} placement="bottom">
            <button
              type="button"
              className={`up-tab${tab === t.id ? ' on' : ''}`}
              role="tab"
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
            >
              <i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {tab === 'users'  && (
          <UsersTab
            users={users}
            roles={roles}
            assignRole={assignRole}
            setUserStatus={setUserStatus}
            updateUserPermissions={updateUserPermissions}
            updateUser={updateUser}
            setDashboardType={setDashboardType}
            toast={toast}
            loading={usersLoading}
            canEdit={canUsersEdit}
            canAssign={canUsersAssign}
          />
        )}
        {tab === 'roles'  && (
          <RolesTab
            roles={roles}
            onSaveRole={handleSaveRole}
            deleteRole={deleteRole}
            cloneRole={cloneRole}
            toast={toast}
            loading={rolesLoading}
            canCreate={canRolesCreate}
            canEdit={canRolesEdit}
            canDelete={canRolesDelete}
          />
        )}
        {tab === 'groups' && (
          <PermissionGroupsTab
            groups={groups}
            upsertGroup={upsertGroup}
            deleteGroup={deleteGroup}
            toast={toast}
            canCreate={canGroupsCreate}
            canEdit={canGroupsEdit}
            canDelete={canGroupsDelete}
          />
        )}
        {tab === 'audit'  && (
          <AuditLogsTab
            auditLog={auditLog}
          />
        )}
      </div>

      <TutorialModal
        open={tutorialOpen}
        moduleKey="userPermissions"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

function Stat({ tone, icon, label, value, sub }) {
  return (
    <Tooltip text={sub ? `${label}: ${value} — ${sub}` : `${label}: ${value}`}>
      <div className={`up-stat up-stat--${tone}`}>
        <div className="up-stat-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
        <div className="up-stat-lbl">{label}</div>
        <div className="up-stat-val">{value}</div>
        {sub && <div className="up-stat-sub">{sub}</div>}
      </div>
    </Tooltip>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Module CSS — all classes self-contained, dark-mode aware
   ═══════════════════════════════════════════════════════════════════ */
const UP_CSS = `
:root { --up-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif; }
@keyframes upFade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
@keyframes upPop  { from { transform: translateY(8px) scale(.985); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

/* ─── Stat strip ─── */
.up-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.up-stat {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  transition: all .2s ease;
  display: flex; flex-direction: column; gap: 4px;
}
[data-theme="dark"] .up-stat { background: var(--bg-card, #0F172A); border-color: var(--border-light, rgba(255,255,255,.08)); }
.up-stat:hover { border-color: #CBD5E1; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15, 23, 42, .06); }
.up-stat-ic {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px; margin-bottom: 6px;
}
.up-stat--blue   .up-stat-ic { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.up-stat--green  .up-stat-ic { background: rgba(21, 128, 61, .12);  color: #15803D; }
.up-stat--indigo .up-stat-ic { background: rgba(67, 56, 202, .12);  color: #4338CA; }
.up-stat--amber  .up-stat-ic { background: rgba(217, 119, 6, .12);  color: #92400E; }
.up-stat-lbl {
  font-family: var(--up-font);
  font-size: 11px; font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase; letter-spacing: .06em; line-height: 1;
}
.up-stat-val {
  font-family: var(--up-font);
  font-size: 22px; font-weight: 800;
  color: #0F172A;
  letter-spacing: -.02em; line-height: 1.15;
  margin: 2px 0; word-break: break-word;
}
[data-theme="dark"] .up-stat-val { color: var(--text-primary, #E2E8F0); }
.up-stat-sub {
  font-family: var(--up-font);
  font-size: 11.5px; font-weight: 500;
  color: #64748B; line-height: 1.3;
}

/* ─── Tab bar (matches hr-tabs / apr-subtabs / settings-tabs) ─── */
.up-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 4px;
  margin-bottom: 18px;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, .04));
}
[data-theme="dark"] .up-tabs { background: var(--bg-card, #0F172A); }
.up-tab {
  flex: 1; min-width: 160px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px 14px;
  border: none; background: transparent;
  border-radius: var(--radius-md, 12px);
  font-family: var(--up-font);
  font-size: 13px; font-weight: 700;
  color: var(--text-muted, #64748B);
  cursor: pointer;
  transition: all .2s ease;
}
.up-tab:hover:not(.on) { background: var(--bg-muted, #F8FAFF); color: #1E40AF; }
.up-tab.on {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 6px 20px rgba(30, 58, 138, .4), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.up-tab:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .25); }
.up-tab i { font-size: 12px; }

/* ─── Info banner (used by Groups tab) ─── */
.up-banner {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px; align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  margin-bottom: 14px;
}
.up-banner-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .28);
}
.up-banner-body {
  font-family: var(--up-font);
  font-size: 13px; font-weight: 500;
  color: #1E3A5F; line-height: 1.55;
}
[data-theme="dark"] .up-banner-body { color: #BFDBFE; }

/* ─── Filter bar ─── */
.up-filters {
  display: grid;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.up-filters.up-filters--users    { grid-template-columns: 1fr 180px 160px 180px auto; }
.up-filters.up-filters--audit    { grid-template-columns: 1fr 180px 180px 180px; }
.up-filters.up-filters--groups   { grid-template-columns: 1fr auto; }
.up-search { position: relative; display: flex; align-items: center; }
.up-search-ic { position: absolute; left: 13px; color: #94A3B8; font-size: 12px; pointer-events: none; }
.up-search-input {
  width: 100%; height: 38px;
  padding: 0 36px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  background: #fff;
  color: #0F172A;
  font-family: var(--up-font);
  font-size: 13px; font-weight: 500;
  transition: all .15s ease;
}
[data-theme="dark"] .up-search-input { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.up-search-input::placeholder { color: #94A3B8; }
.up-search-input:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30, 58, 138, .12); }
.up-search-clear {
  position: absolute; right: 7px;
  width: 24px; height: 24px;
  border: none; background: #F1F5F9; border-radius: 6px;
  color: #64748B; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; transition: all .15s ease;
}
.up-search-clear:hover { background: #E2E8F0; color: #0F172A; }
.up-select, .up-input {
  height: 38px;
  padding: 0 30px 0 12px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  color: #0F172A;
  font-family: var(--up-font);
  font-size: 13px; font-weight: 600;
  cursor: pointer; appearance: none; -webkit-appearance: none;
  transition: all .15s ease;
}
.up-input {
  background-image: none;
  padding: 0 12px;
  cursor: text;
  font-weight: 500;
}
[data-theme="dark"] .up-select, [data-theme="dark"] .up-input { background-color: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.up-select:focus, .up-input:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30, 58, 138, .12); }

/* ─── Buttons ─── */
.up-btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 38px; padding: 0 16px;
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: var(--up-font);
  font-size: 13px; font-weight: 700;
  letter-spacing: -.005em;
  cursor: pointer;
  transition: all .18s ease;
  white-space: nowrap;
}
.up-btn-sm { height: 32px; padding: 0 12px; font-size: 11.5px; }
.up-btn i { font-size: 11px; }
.up-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .28); }
.up-btn:disabled { opacity: .5; cursor: not-allowed; }
.up-btn-primary {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .28), inset 0 1px 0 rgba(255, 255, 255, .14);
}
.up-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(30, 58, 138, .38); }
.up-btn-ghost {
  background: #fff; color: #1E293B; border-color: #E2E8F0;
}
[data-theme="dark"] .up-btn-ghost { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.up-btn-ghost:hover { background: #F1F5F9; border-color: #CBD5E1; color: #1E40AF; }
.up-btn-danger {
  background: linear-gradient(135deg, #B91C1C, #DC2626);
  color: #fff;
  box-shadow: 0 4px 12px rgba(220, 38, 38, .28);
}
.up-btn-danger:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(220, 38, 38, .38); }
.up-btn-del {
  background: #fff; color: #B91C1C; border-color: #FECACA;
}
.up-btn-del:hover { background: #FEF2F2; border-color: #DC2626; color: #DC2626; }

/* ─── Table ─── */
.up-table {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
[data-theme="dark"] .up-table { background: var(--bg-card); border-color: var(--border-light); }
.up-table-head {
  display: grid;
  gap: 12px;
  padding: 12px 16px;
  background: #F8FAFF;
  border-bottom: 1px solid #E2E8F0;
  font-family: var(--up-font);
  font-size: 10.5px; font-weight: 700;
  color: #64748B;
  text-transform: uppercase; letter-spacing: .06em; line-height: 1;
}
[data-theme="dark"] .up-table-head { background: rgba(255,255,255,.03); border-color: var(--border-light); }
.up-table-head .th.c { text-align: center; }
.up-table-row {
  display: grid;
  gap: 12px; align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #F1F5F9;
  min-height: 64px;
  transition: background .15s ease;
}
[data-theme="dark"] .up-table-row { border-color: var(--border-light); }
.up-table-row:last-child { border-bottom: none; }
.up-table-row:hover { background: #FAFBFF; }
[data-theme="dark"] .up-table-row:hover { background: rgba(255,255,255,.03); }
.up-table-row .td.c { text-align: center; display: flex; align-items: center; justify-content: center; }

/* Avatar */
.up-emp { display: flex; align-items: center; gap: 11px; min-width: 0; }
.up-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--up-font);
  font-size: 11px; font-weight: 800;
  letter-spacing: .02em;
  flex-shrink: 0; box-shadow: 0 2px 6px rgba(30, 64, 175, .2);
}
.up-avatar--sm { width: 28px; height: 28px; font-size: 10px; }
.up-avatar--lg { width: 48px; height: 48px; font-size: 14px; box-shadow: 0 4px 12px rgba(30, 64, 175, .25); }
.up-emp-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.up-emp-name {
  font-family: var(--up-font);
  font-size: 13px; font-weight: 700;
  color: #0F172A;
  letter-spacing: -.01em; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-theme="dark"] .up-emp-name { color: var(--text-primary, #E2E8F0); }
.up-emp-meta {
  font-family: var(--up-font);
  font-size: 11px; font-weight: 500;
  color: #64748B; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Badges */
.up-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-family: var(--up-font);
  font-size: 11px; font-weight: 800;
  letter-spacing: .02em; line-height: 1; white-space: nowrap;
}
.up-badge i { font-size: 9px; }
.up-badge--green  { background: rgba(21, 128, 61, .12);  color: #15803D; }
.up-badge--blue   { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.up-badge--gray   { background: rgba(100, 116, 139, .12); color: #475569; }
.up-badge--amber  { background: rgba(217, 119, 6, .12);  color: #92400E; }
.up-badge--red    { background: rgba(220, 38, 38, .12);  color: #B91C1C; }
.up-badge--purple { background: rgba(124, 58, 237, .12); color: #6D28D9; }

/* Role color pill — uses the role.color as background tint */
.up-role-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-family: var(--up-font);
  font-size: 11px; font-weight: 800;
  letter-spacing: .02em; line-height: 1; white-space: nowrap;
}
.up-role-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Action buttons */
.up-actions { display: inline-flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
.up-act {
  width: 30px; height: 30px;
  border: 1px solid #E2E8F0;
  background: #fff;
  border-radius: 8px;
  color: #64748B;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
  font-size: 12px;
}
[data-theme="dark"] .up-act { background: var(--bg-card); border-color: var(--border-light); }
.up-act:hover { border-color: #1E40AF; color: #1E40AF; background: rgba(30, 64, 175, .04); }
.up-act:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .25); }
.up-act--danger:hover { border-color: #DC2626; color: #DC2626; background: rgba(220, 38, 38, .04); }
.up-act:disabled { opacity: .4; cursor: not-allowed; }

/* Empty state */
.up-empty {
  padding: 48px 24px;
  text-align: center;
  background: #fff;
  border: 1.5px dashed #CBD5E1;
  border-radius: 14px;
}
[data-theme="dark"] .up-empty { background: var(--bg-card); border-color: var(--border-light); }
.up-empty-ic {
  width: 56px; height: 56px;
  margin: 0 auto 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(30, 64, 175, .12), rgba(30, 64, 175, .04));
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.up-empty-title {
  font-family: var(--up-font);
  font-size: 15px; font-weight: 800;
  color: #0F172A; letter-spacing: -.01em;
}
[data-theme="dark"] .up-empty-title { color: var(--text-primary, #E2E8F0); }
.up-empty-sub {
  font-family: var(--up-font);
  font-size: 12.5px; font-weight: 500;
  color: #64748B;
  margin: 6px auto 0; max-width: 420px;
}

/* ═══ ROLE CARDS GRID ═══ */
.up-roles-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 14px; flex-wrap: wrap;
}
.up-roles-toolbar-l { font-family: var(--up-font); font-size: 13px; font-weight: 500; color: #64748B; }
.up-roles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.up-role-card {
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  transition: all .18s ease;
  display: flex; flex-direction: column; gap: 10px;
}
[data-theme="dark"] .up-role-card { background: var(--bg-card); border-color: var(--border-light); }
.up-role-card:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(30, 58, 138, .12); }
.up-role-head {
  display: flex; align-items: center; gap: 10px;
}
.up-role-head-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.up-role-name {
  font-family: var(--up-font);
  font-size: 14px; font-weight: 800;
  color: #0F172A; letter-spacing: -.01em;
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-theme="dark"] .up-role-name { color: var(--text-primary, #E2E8F0); }
.up-role-desc {
  font-family: var(--up-font);
  font-size: 12px; font-weight: 500;
  color: #64748B; line-height: 1.5;
}
.up-role-chips {
  display: inline-flex; flex-wrap: wrap; gap: 5px;
}
.up-role-foot {
  display: flex; gap: 6px;
  padding-top: 10px;
  border-top: 1px dashed #E2E8F0;
}
[data-theme="dark"] .up-role-foot { border-color: var(--border-light); }
.up-role-foot .up-btn { flex: 1; justify-content: center; }

/* ═══ MODAL SHELL ═══ */
.up-modal-back {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 26, .55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  animation: upFade .14s ease-out;
}
.up-modal {
  width: min(620px, 100%);
  max-height: 92vh;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(8, 13, 26, .35);
  display: flex; flex-direction: column;
  overflow: hidden;
  font-family: var(--up-font);
  animation: upPop .18s cubic-bezier(.2, .8, .2, 1);
}
[data-theme="dark"] .up-modal { background: var(--bg-card, #0F172A); }
.up-modal--lg { width: min(820px, 100%); }
.up-modal--xl { width: min(1000px, 100%); height: 90vh; max-height: 90vh; }
.up-modal--sm { width: min(480px, 100%); border-radius: 18px; }
.up-modal-head {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 16px 22px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  flex-shrink: 0;
}
.up-modal-head-l { display: flex; align-items: center; gap: 14px; min-width: 0; }
.up-modal-icn {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .15);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
}
.up-modal-title {
  font-family: var(--up-font);
  font-size: 16px; font-weight: 800;
  letter-spacing: -.01em; line-height: 1.3;
  word-break: break-word;
}
.up-modal-sub {
  font-family: var(--up-font);
  font-size: 12px; font-weight: 500;
  color: rgba(255, 255, 255, .85);
  margin-top: 3px;
  display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap;
}
.up-modal-sub .up-badge,
.up-modal-sub .up-role-pill { background: rgba(255, 255, 255, .25); color: #fff; }
.up-modal-x {
  width: 34px; height: 34px;
  border: none;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
  transition: background .15s ease;
}
.up-modal-x:hover { background: rgba(255, 255, 255, .22); }
.up-modal-body {
  flex: 1; overflow-y: auto;
  padding: 18px 22px;
  background: #F0F4FF;
}
[data-theme="dark"] .up-modal-body { background: rgba(255,255,255,.03); }
.up-modal-body--row {
  display: flex; flex-direction: row;
  gap: 0;
  padding: 0;
  background: transparent;
}
.up-modal-foot {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 22px;
  background: #fff;
  border-top: 1px solid #E2E8F0;
  flex-shrink: 0; flex-wrap: wrap;
}
[data-theme="dark"] .up-modal-foot { background: var(--bg-card); border-color: var(--border-light); }
.up-modal-foot--split { justify-content: space-between; align-items: center; }
.up-modal-foot--center { justify-content: center; }
.up-modal-foot-l { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.up-modal-foot-r { display: inline-flex; gap: 10px; }

/* ─── Form fields inside modals ─── */
.up-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.up-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.up-field.span2 { grid-column: span 2; }
.up-field > label {
  font-family: var(--up-font);
  font-size: 11px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .04em;
  color: #64748B; line-height: 1;
}
.up-field-req { color: #DC2626; margin-left: 3px; }
.up-form-input {
  height: 38px;
  padding: 0 12px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #fff;
  font-family: var(--up-font);
  font-size: 13px; font-weight: 500;
  color: #0F172A;
  transition: all .15s ease;
}
[data-theme="dark"] .up-form-input { background: var(--bg-card); color: var(--text-primary); }
.up-form-input:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30, 58, 138, .1); }
.up-form-input.has-error { border-color: #DC2626; }
.up-form-textarea {
  min-height: 64px;
  padding: 10px 12px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #fff;
  font-family: var(--up-font);
  font-size: 13px; font-weight: 500;
  color: #0F172A;
  line-height: 1.5;
  resize: vertical;
  transition: all .15s ease;
}
[data-theme="dark"] .up-form-textarea { background: var(--bg-card); color: var(--text-primary); }
.up-form-textarea:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30, 58, 138, .1); }

/* Color swatches */
.up-color-swatches { display: inline-flex; gap: 8px; align-items: center; }
.up-color-swatch {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all .15s ease;
  position: relative;
}
.up-color-swatch:hover { transform: scale(1.1); }
.up-color-swatch.on {
  border-color: #fff;
  box-shadow: 0 0 0 2px currentColor;
}
.up-color-swatch.on::after {
  content: '\\f00c';
  font-family: 'Font Awesome 6 Free';
  font-weight: 900;
  color: #fff;
  position: absolute;
  inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px;
}

/* Template pills */
.up-templates {
  display: inline-flex; flex-wrap: wrap; gap: 6px;
}
.up-template-pill {
  padding: 6px 12px;
  background: #F1F5F9;
  border: 1.5px solid #E2E8F0;
  color: #475569;
  border-radius: 999px;
  font-family: var(--up-font);
  font-size: 11.5px; font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
}
[data-theme="dark"] .up-template-pill { background: rgba(255,255,255,.04); border-color: var(--border-light); color: var(--text-secondary); }
.up-template-pill:hover { background: #EFF6FF; border-color: #BFDBFE; color: #1E40AF; }

/* Checkbox grid */
.up-checks-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}
.up-checks-counter {
  font-family: var(--up-font);
  font-size: 11.5px; font-weight: 500;
  color: #64748B;
}
.up-checks-counter b { color: #1E3A8A; font-weight: 800; }
.up-checks-toggle {
  background: none; border: none; color: #1E40AF;
  font-family: var(--up-font);
  font-size: 11.5px; font-weight: 700;
  cursor: pointer; padding: 4px 8px; border-radius: 6px;
  transition: background .15s ease;
}
.up-checks-toggle:hover { background: rgba(30, 64, 175, .08); }
.up-checks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
}
[data-theme="dark"] .up-checks { background: var(--bg-card); border-color: var(--border-light); }
.up-check {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 0;
  cursor: pointer;
  font-family: var(--up-font);
  font-size: 12.5px; font-weight: 600;
  color: #1E3A5F; line-height: 1.3;
  user-select: none;
}
[data-theme="dark"] .up-check { color: var(--text-secondary, #BFDBFE); }
.up-check input[type="checkbox"] {
  appearance: none; -webkit-appearance: none;
  width: 16px; height: 16px;
  border: 2px solid #CBD5E1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: all .15s ease;
}
[data-theme="dark"] .up-check input[type="checkbox"] { background: var(--bg-card); border-color: var(--border-light); }
.up-check input[type="checkbox"]:checked {
  background: #1E40AF; border-color: #1E40AF;
}
.up-check input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 4px; top: 0;
  width: 5px; height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.up-check-ic {
  width: 22px; height: 22px;
  border-radius: 6px;
  background: rgba(30, 64, 175, .12);
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
}

/* Alert / warning box */
.up-alert {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 10px 13px;
  background: #FFF7ED;
  border: 1px solid #FED7AA;
  border-radius: 10px;
  font-family: var(--up-font);
  font-size: 12px; font-weight: 600;
  color: #92400E; line-height: 1.5;
}
.up-alert i { color: #D97706; font-size: 13px; margin-top: 1px; flex-shrink: 0; }

/* Confirm dialog (small) */
.up-confirm-ic {
  width: 64px; height: 64px;
  margin: 0 auto 14px;
  border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 24px;
}
.up-confirm-ic--red  { background: rgba(220, 38, 38, .12); color: #DC2626; }
.up-confirm-ic--blue { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.up-confirm-body {
  text-align: center;
  padding: 28px 28px 16px;
  background: #fff;
}
[data-theme="dark"] .up-confirm-body { background: var(--bg-card); }
.up-confirm-title {
  font-family: var(--up-font);
  font-size: 17px; font-weight: 800;
  color: #0F172A; letter-spacing: -.01em;
  margin-bottom: 10px;
}
[data-theme="dark"] .up-confirm-title { color: var(--text-primary); }
.up-confirm-text {
  font-family: var(--up-font);
  font-size: 13px; font-weight: 500;
  color: #475569; line-height: 1.55;
}
.up-confirm-text b { color: #0F172A; font-weight: 700; }

/* Role select cards (used by AssignRoleModal) */
.up-role-radios { display: flex; flex-direction: column; gap: 8px; }
.up-role-radio {
  display: grid;
  grid-template-columns: 16px 12px 1fr auto;
  gap: 10px; align-items: center;
  padding: 10px 12px;
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  cursor: pointer;
  transition: all .15s ease;
}
[data-theme="dark"] .up-role-radio { background: var(--bg-card); border-color: var(--border-light); }
.up-role-radio:hover { border-color: #BFDBFE; }
.up-role-radio.on {
  border-color: #1E40AF;
  background: linear-gradient(135deg, rgba(30, 64, 175, .04), #fff);
  box-shadow: 0 4px 10px rgba(30, 64, 175, .08);
}
.up-role-radio-dot {
  width: 16px; height: 16px;
  border-radius: 50%;
  border: 2px solid #CBD5E1;
  position: relative;
  transition: all .15s ease;
}
.up-role-radio.on .up-role-radio-dot { border-color: #1E40AF; }
.up-role-radio.on .up-role-radio-dot::after {
  content: '';
  position: absolute; inset: 2px;
  border-radius: 50%; background: #1E40AF;
}
.up-role-radio-color {
  width: 12px; height: 12px;
  border-radius: 50%;
}
.up-role-radio-info { min-width: 0; }
.up-role-radio-name {
  font-family: var(--up-font);
  font-size: 13px; font-weight: 800;
  color: #0F172A; letter-spacing: -.005em;
}
[data-theme="dark"] .up-role-radio-name { color: var(--text-primary); }
.up-role-radio-desc {
  font-family: var(--up-font);
  font-size: 11.5px; font-weight: 500;
  color: #64748B;
  margin-top: 2px;
}
.up-role-radio-count {
  font-family: var(--up-font);
  font-size: 10.5px; font-weight: 800;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .04em;
}

/* ═══ EDIT PERMISSIONS PANEL ═══ */
.up-edit-side {
  width: 260px;
  border-right: 1px solid #E2E8F0;
  background: #F8FAFF;
  flex-shrink: 0;
  display: flex; flex-direction: column;
  overflow: hidden;
}
[data-theme="dark"] .up-edit-side { background: rgba(255,255,255,.03); border-color: var(--border-light); }
.up-edit-side-h {
  padding: 14px 14px 8px;
  font-family: var(--up-font);
  font-size: 10px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .06em;
  color: #64748B; line-height: 1;
}
.up-edit-side-top {
  padding: 0 14px 12px;
  border-bottom: 1px solid #E2E8F0;
}
[data-theme="dark"] .up-edit-side-top { border-color: var(--border-light); }
.up-edit-side-list {
  flex: 1; overflow-y: auto;
  padding: 8px 8px;
}
.up-edit-mod {
  display: grid;
  grid-template-columns: 22px 24px 1fr 14px;
  gap: 8px; align-items: center;
  width: 100%; padding: 8px 10px;
  border: none; background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--up-font);
  font-size: 12.5px; font-weight: 700;
  color: #1E293B;
  text-align: left;
  transition: all .15s ease;
  border-left: 3px solid transparent;
  margin-bottom: 2px;
}
[data-theme="dark"] .up-edit-mod { color: var(--text-primary); }
.up-edit-mod:hover { background: #EFF6FF; }
.up-edit-mod.on {
  background: #EFF6FF;
  border-left-color: #1E3A8A;
  color: #1E3A8A;
}
[data-theme="dark"] .up-edit-mod.on { background: rgba(30, 64, 175, .12); color: #93C5FD; }
.up-edit-mod-chev { color: #94A3B8; font-size: 9px; }
.up-edit-mod-ic {
  width: 24px; height: 24px;
  border-radius: 6px;
  background: rgba(30, 64, 175, .1);
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
}
.up-edit-content {
  flex: 1; overflow-y: auto;
  padding: 18px 22px;
  background: #F0F4FF;
  display: flex; flex-direction: column; gap: 14px;
  min-width: 0;
}
[data-theme="dark"] .up-edit-content { background: rgba(255,255,255,.02); }
.up-edit-mod-h {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap;
}
.up-edit-mod-title {
  font-family: var(--up-font);
  font-size: 16px; font-weight: 800;
  color: #0F172A; letter-spacing: -.01em;
  display: inline-flex; align-items: center; gap: 10px;
}
[data-theme="dark"] .up-edit-mod-title { color: var(--text-primary); }
.up-edit-mod-title-ic {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: rgba(30, 64, 175, .12);
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.up-edit-mod-actions {
  display: inline-flex; gap: 8px; align-items: center;
}
.up-edit-mod-toggle {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: #fff;
  border: 1.5px solid #BFDBFE;
  border-radius: 999px;
  font-family: var(--up-font);
  font-size: 11.5px; font-weight: 700;
  color: #1E40AF;
  cursor: pointer;
  transition: all .15s ease;
}
[data-theme="dark"] .up-edit-mod-toggle { background: var(--bg-card); border-color: var(--border-light); }
.up-edit-mod-toggle:hover { background: #EFF6FF; }
.up-edit-mod-toggle.on { background: #1E40AF; color: #fff; border-color: #1E40AF; }

/* Permission matrix */
.up-matrix {
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
  overflow: hidden;
}
[data-theme="dark"] .up-matrix { background: var(--bg-card); border-color: var(--border-light); }
.up-matrix-scroll { overflow-x: auto; }
.up-matrix-head, .up-matrix-row {
  display: grid;
  gap: 8px; align-items: center;
  padding: 9px 12px;
  min-width: 660px;
}
.up-matrix-head {
  background: #F8FAFF;
  border-bottom: 1px solid #BFDBFE;
  font-family: var(--up-font);
  font-size: 9.5px; font-weight: 800;
  color: #64748B;
  text-transform: uppercase; letter-spacing: .06em;
  line-height: 1;
}
[data-theme="dark"] .up-matrix-head { background: rgba(255,255,255,.03); border-color: var(--border-light); }
.up-matrix-row {
  border-bottom: 1px solid #F1F5F9;
  transition: background .15s ease;
}
[data-theme="dark"] .up-matrix-row { border-color: var(--border-light); }
.up-matrix-row:last-child { border-bottom: none; }
.up-matrix-row:hover { background: #FAFBFF; }
[data-theme="dark"] .up-matrix-row:hover { background: rgba(255,255,255,.03); }
.up-matrix-h-cell { text-align: center; }
.up-matrix-h-cell.l { text-align: left; }
.up-matrix-h-cell.r { text-align: right; }
.up-matrix-screen {
  font-family: var(--up-font);
  font-size: 12.5px; font-weight: 700;
  color: #0F172A;
}
[data-theme="dark"] .up-matrix-screen { color: var(--text-primary); }
.up-matrix-cell {
  display: flex; align-items: center; justify-content: center;
}
.up-matrix-row-link {
  background: none; border: none;
  color: #1E40AF;
  font-family: var(--up-font);
  font-size: 10.5px; font-weight: 700;
  cursor: pointer;
  padding: 4px 8px; border-radius: 6px;
  transition: all .15s ease;
  white-space: nowrap;
}
.up-matrix-row-link:hover { background: rgba(30, 64, 175, .08); }

.up-cb {
  appearance: none; -webkit-appearance: none;
  width: 18px; height: 18px;
  border: 2px solid #CBD5E1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  position: relative;
  transition: all .15s ease;
}
[data-theme="dark"] .up-cb { background: var(--bg-card); border-color: var(--border-light); }
.up-cb:checked { background: #1E40AF; border-color: #1E40AF; }
.up-cb:checked::after {
  content: '';
  position: absolute;
  left: 5px; top: 1px;
  width: 5px; height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.up-edit-summary {
  font-family: var(--up-font);
  font-size: 12px; font-weight: 600;
  color: #64748B; line-height: 1.4;
}

/* Extra dark-mode polish — covers classes that previously had no explicit dark rule. */
[data-theme="dark"] .up-banner { background: linear-gradient(135deg, rgba(30,58,138,.18), rgba(30,64,175,.12)); border-color: rgba(191,219,254,.18); }
[data-theme="dark"] .up-roles-toolbar-l { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .up-roles-toolbar-l b { color: #93C5FD; }
[data-theme="dark"] .up-role-desc { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .up-search-clear { background: rgba(255,255,255,.06); color: var(--text-secondary, #CBD5E1); }
[data-theme="dark"] .up-search-clear:hover { background: rgba(255,255,255,.12); color: var(--text-primary, #fff); }
[data-theme="dark"] .up-emp-meta { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .up-btn-ghost:hover { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.18); color: #93C5FD; }
[data-theme="dark"] .up-btn-del { background: var(--bg-card); color: #FCA5A5; border-color: rgba(248,113,113,.4); }
[data-theme="dark"] .up-btn-del:hover { background: rgba(220,38,38,.15); border-color: #DC2626; color: #FCA5A5; }
[data-theme="dark"] .up-act:hover { background: rgba(30,64,175,.18); color: #93C5FD; border-color: rgba(30,64,175,.5); }
[data-theme="dark"] .up-act--danger:hover { background: rgba(220,38,38,.16); color: #FCA5A5; border-color: rgba(220,38,38,.5); }
[data-theme="dark"] .up-checks-counter { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .up-checks-counter b { color: #93C5FD; }
[data-theme="dark"] .up-checks-toggle { color: #93C5FD; }
[data-theme="dark"] .up-checks-toggle:hover { background: rgba(30,64,175,.18); }
[data-theme="dark"] .up-alert { background: rgba(217,119,6,.1); border-color: rgba(217,119,6,.32); color: #FCD34D; }
[data-theme="dark"] .up-alert i { color: #F59E0B; }
[data-theme="dark"] .up-confirm-text { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .up-confirm-text b { color: var(--text-primary, #E2E8F0); }
[data-theme="dark"] .up-role-radio:hover { border-color: rgba(30,64,175,.45); }
[data-theme="dark"] .up-role-radio.on { background: linear-gradient(135deg, rgba(30,64,175,.18), rgba(15,23,42,.4)); border-color: #2563EB; }
[data-theme="dark"] .up-role-radio-desc { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .up-role-radio-count { color: var(--text-muted, #64748B); }
[data-theme="dark"] .up-edit-side-h { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .up-edit-mod:hover { background: rgba(30,64,175,.12); }
[data-theme="dark"] .up-edit-mod-toggle:hover { background: rgba(30,64,175,.18); }
[data-theme="dark"] .up-matrix-screen { color: var(--text-primary, #E2E8F0); }
[data-theme="dark"] .up-matrix-row-link:hover { background: rgba(30,64,175,.18); }
[data-theme="dark"] .up-edit-summary { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .up-empty-sub { color: var(--text-secondary, #94A3B8); }

/* ─── Responsive ─── */
@media (max-width: 1180px) {
  .up-stats { grid-template-columns: repeat(2, 1fr); }
  .up-roles-grid { grid-template-columns: repeat(2, 1fr); }
  .up-filters.up-filters--users { grid-template-columns: 1fr 1fr; }
  .up-filters.up-filters--users > .up-btn-primary { grid-column: span 2; justify-self: stretch; justify-content: center; }
  .up-filters.up-filters--audit { grid-template-columns: 1fr 1fr; }
}
/* Tablet — let wide tables scroll horizontally rather than crushing columns. */
@media (max-width: 900px) {
  .up-tabs { gap: 2px; }
  .up-tab { min-width: 140px; padding: 9px 10px; font-size: 12px; }
  .up-roles-toolbar { gap: 8px; }
  .up-table { overflow-x: auto; }
  .up-table-head, .up-table-row { min-width: 760px; }
  .up-roles-grid { gap: 10px; }
  .up-role-card { padding: 14px 16px; }
  .up-role-foot { flex-wrap: wrap; }
  .up-role-foot .up-btn { flex: 1 1 calc(50% - 6px); justify-content: center; }
  .up-banner { grid-template-columns: 32px 1fr; padding: 10px 12px; }
  .up-modal { width: 96vw; }
  .up-modal--lg, .up-modal--xl { width: 96vw; }
  .up-form-grid { gap: 10px; }
  .up-checks { grid-template-columns: repeat(2, 1fr); }
  .up-modal-head { padding: 14px 16px; }
  .up-modal-body { padding: 14px 16px; }
  .up-modal-foot { padding: 12px 16px; gap: 8px; }
  .up-modal-foot--split { flex-direction: column; align-items: stretch; }
  .up-modal-foot-l, .up-modal-foot-r { justify-content: center; }
}
@media (max-width: 820px) {
  .up-stats { grid-template-columns: 1fr; }
  .up-roles-grid { grid-template-columns: 1fr; }
  .up-form-grid { grid-template-columns: 1fr; }
  .up-field.span2 { grid-column: span 1; }
  .up-checks { grid-template-columns: repeat(2, 1fr); }
  .up-tab { min-width: 100%; flex-basis: 100%; }
  .up-filters.up-filters--users,
  .up-filters.up-filters--audit { grid-template-columns: 1fr; }
  .up-filters.up-filters--users > .up-btn-primary,
  .up-filters.up-filters--audit > .up-select { grid-column: auto; }
  .up-modal-back { padding: 0; }
  .up-modal, .up-modal--lg, .up-modal--xl { max-height: 100vh; height: 100vh; border-radius: 0; width: 100%; }
  .up-modal--sm { border-radius: 0; }
  .up-modal-body--row { flex-direction: column; }
  .up-edit-side {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #E2E8F0;
    max-height: 200px;
  }
  .up-edit-side-list { padding: 6px; }
}
/* Mobile — single-column everything, ensure no overflow, and let modal footers stack. */
@media (max-width: 600px) {
  .up-checks { grid-template-columns: 1fr; }
  .up-roles-toolbar { flex-direction: column; align-items: stretch; }
  .up-roles-toolbar .up-btn { width: 100%; justify-content: center; }
  .up-role-foot { gap: 4px; }
  .up-role-foot .up-btn { flex: 1 1 100%; }
  .up-banner { grid-template-columns: 1fr; text-align: left; }
  .up-banner-ic { display: none; }
  .up-modal-head { gap: 8px; padding: 12px 14px; }
  .up-modal-title { font-size: 14px; }
  .up-modal-sub { font-size: 11px; }
  .up-modal-icn { width: 36px; height: 36px; font-size: 14px; }
  .up-modal-body { padding: 12px 14px; }
  .up-modal-foot { padding: 10px 14px; flex-direction: column-reverse; }
  .up-modal-foot .up-btn { width: 100%; justify-content: center; }
  .up-modal-foot-l, .up-modal-foot-r { width: 100%; justify-content: center; flex-wrap: wrap; }
  .up-modal-foot-r { flex-direction: column-reverse; align-items: stretch; }
  .up-modal-foot-r .up-btn { width: 100%; }
  .up-color-swatches { flex-wrap: wrap; gap: 6px; }
  .up-templates { gap: 4px; flex-wrap: wrap; }
  .up-template-pill { font-size: 11px; padding: 5px 10px; }
  .up-edit-side { max-height: 160px; }
  .up-edit-mod-h { padding: 10px 12px !important; gap: 6px !important; }
  .up-edit-mod-actions { flex-wrap: wrap !important; }
  .up-stat { padding: 12px 14px; }
  .up-stat-val { font-size: 19px; }
  .up-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .up-tabs::-webkit-scrollbar { display: none; }
  .up-tab {
    min-width: max-content;
    flex-basis: auto;
    flex-shrink: 0;
    white-space: nowrap;
    padding: 9px 12px;
    font-size: 12px;
  }
  .up-filters { gap: 8px; }
  .up-role-card { padding: 12px 14px; }
  .up-edit-side-list { padding: 4px; }

  /* ═══════════════════════════════════════════════════════════════════
     USER PERMISSIONS — convert all .up-table rows to compact mobile cards
     Cancels the 900px horizontal-scroll trap + 760px min-width rule.
     Three tables (Users, Audit, Permission Groups) share .up-table-row
     and are differentiated by their inline gridTemplateColumns strings.
     ═══════════════════════════════════════════════════════════════════ */

  /* Cancel horizontal scroll + min-width on tables */
  .up-table { overflow-x: visible !important; }
  .up-table-head { display: none !important; }
  .up-table-row { min-width: 0 !important; }

  /* Card foundation */
  .up-table-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    grid-template-columns: none !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 12px 14px !important;
    min-height: 0 !important;
  }
  .up-table-row > .td {
    padding: 0 !important;
    min-width: 0 !important;
    text-align: left !important;
  }
  .up-table-row > .td.c { justify-content: flex-start !important; }

  /* ── Users table (8 cells, has '200px' for the actions column) ──
       Row 1: avatar + name+email                     [Status badge]
       Row 2: Employee ID · Role pill · Perm Type · Dashboard
       Row 3: Last login                              (small grey)
       Row 4: 5 icon actions, right-aligned */
  .up-table-row[style*="200px"] > .td:nth-of-type(1) { order: 1; flex: 1 1 auto !important; }
  .up-table-row[style*="200px"] > .td:nth-of-type(6) {
    order: 2; flex: 0 0 auto !important; margin-left: auto !important;
  }
  .up-table-row[style*="200px"]::after {
    content: ""; flex: 1 1 100%; height: 0; order: 2.5;
  }
  .up-table-row[style*="200px"] > .td:nth-of-type(2),
  .up-table-row[style*="200px"] > .td:nth-of-type(3),
  .up-table-row[style*="200px"] > .td:nth-of-type(4),
  .up-table-row[style*="200px"] > .td:nth-of-type(5) {
    order: 3; flex: 0 0 auto !important;
  }
  .up-table-row[style*="200px"] > .td:nth-of-type(7) {
    order: 4; flex: 1 1 100% !important;
    font-size: 11px; color: var(--text-muted, #64748B);
  }
  .up-table-row[style*="200px"] > .td:nth-of-type(7)::before {
    content: "Last login: "; color: var(--text-muted); margin-right: 4px;
  }
  .up-table-row[style*="200px"] > .td:nth-of-type(8) {
    order: 5; flex: 1 1 100% !important;
    justify-content: flex-end !important;
    gap: 6px !important; flex-wrap: wrap !important;
  }

  /* ── Audit Log table (5 cells, has '170px' AND '2fr' but NOT '200px') ──
       Row 1: Date+time     User (avatar+name)          [Action badge]
       Row 2: Detail text (italic, wraps)
       Row 3: Performed By                              (right) */
  .up-table-row[style*="170px"][style*="2fr"]:not([style*="200px"]) > .td:nth-of-type(1) {
    order: 1; flex: 0 0 auto !important;
    font-size: 11.5px;
  }
  .up-table-row[style*="170px"][style*="2fr"]:not([style*="200px"]) > .td:nth-of-type(2) {
    order: 2; flex: 1 1 auto !important;
  }
  .up-table-row[style*="170px"][style*="2fr"]:not([style*="200px"]) > .td:nth-of-type(3) {
    order: 3; flex: 0 0 auto !important; margin-left: auto !important;
  }
  .up-table-row[style*="170px"][style*="2fr"]:not([style*="200px"])::after {
    content: ""; flex: 1 1 100%; height: 0; order: 3.5;
  }
  .up-table-row[style*="170px"][style*="2fr"]:not([style*="200px"]) > .td:nth-of-type(4) {
    order: 4; flex: 1 1 100% !important;
    font-size: 11.5px !important;
    word-break: normal; overflow-wrap: break-word; hyphens: none;
  }
  .up-table-row[style*="170px"][style*="2fr"]:not([style*="200px"]) > .td:nth-of-type(5) {
    order: 5; flex: 1 1 100% !important;
    justify-content: flex-end !important;
  }

  /* ── Permission Groups table (4 cells, '1.4fr 2fr 130px 160px') ──
       Row 1: Group name + description                [users badge]
       Row 2: Modules badges (flex-wrap)
       Row 3: actions right */
  .up-table-row[style*="1.4fr 2fr 130px 160px"] > .td:nth-of-type(1) {
    order: 1; flex: 1 1 auto !important;
  }
  .up-table-row[style*="1.4fr 2fr 130px 160px"] > .td:nth-of-type(3) {
    order: 2; flex: 0 0 auto !important; margin-left: auto !important;
  }
  .up-table-row[style*="1.4fr 2fr 130px 160px"]::after {
    content: ""; flex: 1 1 100%; height: 0; order: 2.5;
  }
  .up-table-row[style*="1.4fr 2fr 130px 160px"] > .td:nth-of-type(2) {
    order: 3; flex: 1 1 100% !important;
  }
  .up-table-row[style*="1.4fr 2fr 130px 160px"] > .td:nth-of-type(4) {
    order: 4; flex: 1 1 100% !important;
    justify-content: flex-end !important;
    gap: 6px !important; flex-wrap: wrap !important;
  }

  /* Tighten inner pieces shared across all three tables */
  .up-emp { gap: 9px; }
  .up-avatar { width: 32px; height: 32px; font-size: 11px; }
  .up-avatar--sm { width: 26px; height: 26px; font-size: 10px; }
  .up-emp-name {
    font-size: 12.5px; line-height: 1.3;
    white-space: normal;
    word-break: normal; overflow-wrap: break-word;
  }
  .up-emp-meta { font-size: 10.5px; }
  .up-badge { font-size: 10.5px; padding: 3px 8px; }
  .up-role-pill { font-size: 10.5px; padding: 3px 8px; }
  .up-actions { gap: 4px !important; }
  .up-act { width: 30px; height: 30px; font-size: 11px; }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW / EDIT Permissions Modal — fit viewport on phones
     EditPermissionsPanel uses state (mobilePanelView) to render ONLY
     ONE side at a time on mobile, so we MUST NOT cap .up-edit-side or
     force flex-direction: column on the body — both would leave the
     visible panel with a clipped fixed height + huge empty space.
     Each panel, when rendered, should take the full available height.
     ═══════════════════════════════════════════════════════════════════ */

  /* Backdrop padding tighter; modal sizing handled by JSX inline style */
  .up-modal-back { padding: 4px !important; }
  .up-modal--sm { border-radius: 12px !important; max-width: 96vw !important; }

  /* Body fills available height; vertical scroll only */
  .up-modal-body {
    -webkit-overflow-scrolling: touch;
  }
  /* The body--row has inline flex+row from JSX; only one child renders
     on mobile so it naturally fills width. Just ensure both panels can
     grow to full height + scroll internally. */
  .up-edit-side {
    flex: 1 1 auto !important;
    max-height: none !important;
    width: 100% !important;
    border-right: none !important;
  }
  .up-edit-content {
    flex: 1 1 auto !important;
    width: 100% !important;
    min-height: 0;
  }

  /* Sidebar Select All / Deselect All — already full-width via inline JSX */

  /* Module-row sticky header inside content area */
  .up-edit-mod-h {
    flex-wrap: wrap !important;
    gap: 8px !important;
    padding: 10px 12px !important;
  }
  .up-edit-mod-actions {
    flex-wrap: wrap !important;
    gap: 6px !important;
    width: 100%;
    justify-content: flex-end;
  }
  .up-edit-mod-actions .up-btn,
  .up-edit-mod-actions .up-select { flex: 1 1 auto; min-width: 0; }

  /* ═══════════════════════════════════════════════════════════════════
     PERMISSIONS MATRIX — convert table-style rows into card layout
     The cells use inline width/minWidth/maxWidth, so every override here
     uses !important. The matrix already has overflow-x: auto inline, so
     killing min-widths simply lets it shrink to viewport with no scroll.
     ═══════════════════════════════════════════════════════════════════ */

  /* Cancel the inline minWidth: max-content that forces horizontal scroll */
  .up-matrix-scroll,
  .up-matrix-head,
  .up-matrix-row { min-width: 0 !important; width: 100% !important; }

  /* Cancel inline fixed widths on every header + data cell */
  .up-matrix-h-cell,
  .up-matrix-cell,
  .up-matrix-screen {
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    flex: 0 0 auto !important;
  }

  /* Hide the column header — cards label cells inline via ::before */
  .up-matrix-head { display: none !important; }

  /* Each .up-matrix-row → flex-wrap card */
  .up-matrix-row {
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 6px !important;
    row-gap: 6px !important;
    padding: 10px 12px !important;
    min-height: 0 !important;
  }

  /* Row 1 — screen name (left) + Select All link (right) */
  .up-matrix-row > .up-matrix-screen {
    order: 1 !important;
    flex: 1 1 auto !important;
    padding: 0 !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
  }
  .up-matrix-row > .up-matrix-cell:last-child {
    order: 2 !important;
    flex: 0 0 auto !important;
    margin-left: auto !important;
    padding: 0 !important;
  }

  /* Wrap break — pushes the permission chips onto Row 2 */
  .up-matrix-row::after {
    content: "";
    flex: 1 1 100%;
    height: 0;
    order: 2.5;
  }

  /* Row 2 — permission chips: 2 per row with inline labels */
  .up-matrix-row > .up-matrix-cell:not(:last-child) {
    order: 3 !important;
    flex: 0 0 calc(50% - 3px) !important;
    justify-content: space-between !important;
    padding: 7px 9px !important;
    border: 1px solid var(--border-light, #E2E8F0) !important;
    border-radius: 8px !important;
    background: var(--bg-muted, #F8FAFF);
    gap: 8px;
  }

  /* Label each permission cell via ::before (order matches PRIMARY +
     ADVANCED action lists). Cells with disabled checkboxes still render
     with the same label — their disabled state is unchanged. */
  .up-matrix-row > .up-matrix-cell:not(:last-child)::before {
    flex: 1 1 auto;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary, #475569);
    text-align: left;
  }
  .up-matrix-row > .up-matrix-cell:nth-child(2)::before  { content: "View"; }
  .up-matrix-row > .up-matrix-cell:nth-child(3)::before  { content: "Create"; }
  .up-matrix-row > .up-matrix-cell:nth-child(4)::before  { content: "Edit"; }
  .up-matrix-row > .up-matrix-cell:nth-child(5)::before  { content: "Delete"; }
  .up-matrix-row > .up-matrix-cell:nth-child(6)::before  { content: "Approve"; }
  .up-matrix-row > .up-matrix-cell:nth-child(7)::before  { content: "Download"; }
  .up-matrix-row > .up-matrix-cell:nth-child(8)::before  { content: "Print"; }
  .up-matrix-row > .up-matrix-cell:nth-child(9)::before  { content: "Import"; }
  .up-matrix-row > .up-matrix-cell:nth-child(10)::before { content: "Share"; }
  .up-matrix-row > .up-matrix-cell:nth-child(11)::before { content: "Assign"; }
  .up-matrix-row > .up-matrix-cell:nth-child(12)::before { content: "Settings"; }

  /* Disabled cells fade — preserve existing disabled state visual */
  .up-matrix-row > .up-matrix-cell:not(:last-child):has(input:disabled) {
    opacity: .55;
    background: var(--bg-card, #fff);
  }

  /* Matrix outer container — drop inline width-calc trap, let it fit */
  .up-matrix {
    margin: 0 12px 10px !important;
    width: calc(100% - 24px) !important;
    overflow-x: hidden !important;
  }

  /* Footer — summary + Cancel/Save */
  .up-modal-foot {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
    padding: 10px 12px !important;
  }
  .up-modal-foot--split { flex-direction: column !important; }
  .up-modal-foot-l, .up-modal-foot-r {
    width: 100% !important;
    justify-content: center !important;
    flex-wrap: wrap !important;
  }
  .up-modal-foot-r { flex-direction: row !important; gap: 8px; }
  .up-modal-foot-r .up-btn { flex: 1 1 0 !important; min-width: 0; }
  .up-edit-summary {
    flex-wrap: wrap !important;
    gap: 4px 8px !important;
    padding: 8px 12px !important;
    font-size: 11px;
    line-height: 1.4;
  }
}
@media (max-width: 480px) {
  .up-stat-val { font-size: 18px; }
  .up-tab { padding: 8px 10px; font-size: 11.5px; }
  .up-modal-title { font-size: 13.5px; }
  .up-template-pill { font-size: 10.5px; padding: 4px 8px; }
}
`;
