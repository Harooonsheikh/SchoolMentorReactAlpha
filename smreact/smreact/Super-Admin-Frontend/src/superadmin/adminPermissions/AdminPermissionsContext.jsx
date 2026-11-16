import React, { createContext, useContext, useState, useCallback } from 'react';
import { INITIAL_ROLES, INITIAL_ROLE_ASSIGNMENTS, effectivePermsForUser } from './adminPermissionsData';

/* ═══════════════════════════════════════════════════════════════════
   AdminPermissionsContext — shared roles + role-assignment store for
   the new RBAC system, mirroring the ERP's PermissionsContext.jsx/
   usePermissionsStore() pattern. Mounted once in SuperAdminShell.jsx;
   consumers pull `roles`/`roleAssignments` from here and call the
   plain `effectivePermsForUser()` helper directly (not a generic
   hook), same as the ERP reference.

   Role assignment is keyed by the EXISTING admin user id from
   userMgmtData.js's INITIAL_USERS — no separate/duplicate user list.
   This is the single source of truth for staff permissions app-wide:
   Dashboard.jsx's "Viewing as" preview and User Management's own User
   Permission tab both read through permsForUser()/effectivePermsForUser()
   here — there is no separate flat allow-list any more.
   ═══════════════════════════════════════════════════════════════════ */

const Ctx = createContext(null);

export function PermissionsProvider({ children }) {
  const [roles, setRoles] = useState(INITIAL_ROLES);
  const [roleAssignments, setRoleAssignments] = useState(INITIAL_ROLE_ASSIGNMENTS);
  /* "Viewing as" preview override for Tech Module enforcement (same
     convention as Dashboard.jsx's existing preview dropdown) — null
     means "no override", which resolves to full Super Admin access. */
  const [viewingAsUserId, setViewingAsUserId] = useState(null);

  const assignRole = useCallback((userId, roleId) => {
    setRoleAssignments((prev) => ({ ...prev, [userId]: { role: roleId, permType: 'role' } }));
  }, []);

  const saveCustomPerms = useCallback((userId, perms) => {
    setRoleAssignments((prev) => ({ ...prev, [userId]: { ...prev[userId], permType: 'custom', customPermissions: perms } }));
  }, []);

  /* Resolve effective perms for a real user object (from userMgmtData's
     users list) by merging in that user's role assignment. */
  const permsForUser = useCallback((user) => {
    if (!user) return {};
    const assignment = roleAssignments[user.id];
    return effectivePermsForUser({ ...user, ...assignment }, roles);
  }, [roleAssignments, roles]);

  const value = {
    roles, setRoles,
    roleAssignments, setRoleAssignments, assignRole, saveCustomPerms,
    viewingAsUserId, setViewingAsUserId,
    permsForUser,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissionsStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePermissionsStore must be used within a PermissionsProvider');
  return ctx;
}
