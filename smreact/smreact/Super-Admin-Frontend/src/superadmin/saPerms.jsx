import React, { createContext, useContext, useMemo } from 'react';
import { ACTION_LABELS, MODULE_SCREENS, pkey } from './permissionModel';

/* ═══════════════════════════════════════════════════════════════════
   Logged-in Super Admin user ki screen × action permissions (enforcement).

   SuperAdminShell me <SaPermsProvider perms={…}> lagta hai — perms = effective
   map (permissionModel.effectivePermsFromRows) ya null (koi record nahi /
   host-embedded = poori access).

   Module ke andar:
     const P = useSaPerms('networkPermission');
     P.can('network_perms', 'edit')            → boolean
     <button {...P.lock('network_perms', 'edit')} onClick={…}>   → disabled + tooltip
     if (!P.guard('network_perms', 'edit', toast)) return;        → save/handler me double check
     P.canView('challans')                                        → tab dikhana ya nahi
   ═══════════════════════════════════════════════════════════════════ */

const Ctx = createContext(null);

export function SaPermsProvider({ perms, children }) {
  return <Ctx.Provider value={perms ?? null}>{children}</Ctx.Provider>;
}

export const denyMessage = (action) =>
  `You don't have ${ACTION_LABELS[action] || action} permission. Ask an admin to enable it in User Permission.`;

/* Short hover tooltip (data-tip is single-line). */
export const lockTip = (action) => `Enable "${ACTION_LABELS[action] || action}" permission to use this`;

export function useSaPerms(moduleKey) {
  const perms = useContext(Ctx);
  return useMemo(() => {
    const applicable = (screen, action) => {
      const s = MODULE_SCREENS[moduleKey]?.screens.find((x) => x.id === screen);
      return !s || s.actions.includes(action);
    };
    const can = (screen, action) => {
      if (!perms) return true;                         // no record = full access
      /* Screen par ye action lagu nahi (e.g. 'create' on a view/edit screen) → Edit se chalao. */
      if (!applicable(screen, action)) return action !== 'edit' && applicable(screen, 'edit') && !!perms[pkey(moduleKey, screen, 'edit')];
      return !!perms[pkey(moduleKey, screen, action)];
    };
    const canView = (screen) => can(screen, 'view');
    /* Props for a button/input: disabled + hover tooltip when not allowed. */
    const lock = (screen, action, extra = {}) => {
      if (can(screen, action)) return extra;
      return { ...extra, disabled: true, 'data-tip': lockTip(action), 'aria-label': denyMessage(action), style: { ...(extra.style || {}), opacity: 0.5, cursor: 'not-allowed' } };
    };
    /* Handler guard — returns false (and toasts) when not allowed. */
    const guard = (screen, action, toast) => {
      if (can(screen, action)) return true;
      toast?.(denyMessage(action), 'warn');
      return false;
    };
    return { can, canView, lock, guard, restricted: !!perms };
  }, [perms, moduleKey]);
}
