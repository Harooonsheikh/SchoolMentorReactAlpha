import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   PERMISSIONS CONTEXT — logged-in user ki menu/screen/action access.

   • accountType === "School Head" → poora access (koi API call NAHI).
   • warna GET /get-user-menu-permissions/{branchID}/{UserID} se
     permissions laao aur menu/submenu/action level par enforce karo:
       isAccessable true  → allowed (enable)
       isAccessable false → denied  (disable)
   • Jo menu API response me hai HI nahi (governed nahi) → allow (taake
     purane/uncovered screens na tootein).
   • Network/data fail → fail-open (fullAccess) taake app lock na ho.

   API surface (usePermissions):
     ready        — permissions load ho chuki hain
     fullAccess   — sab allowed (School Head / uncovered / fail-open)
     isSchoolHead
     can(menu, sub, action)  — us exact action ka access
     canScreen(menu, sub)    — us screen me koi bhi action allowed?
     canModule(menu)         — us module me koi bhi action allowed?
   ═══════════════════════════════════════════════════════════════════ */

const PermissionsContext = createContext(null);
const norm = (s) => String(s ?? '').trim().toLowerCase();

const FULL_ACCESS_VALUE = {
  ready: true, fullAccess: true, isSchoolHead: false,
  can: () => true, canScreen: () => true, canModule: () => true,
};

export function PermissionsProvider({ children }) {
  const accountType = (sessionStorage.getItem('accountType') || '').trim();
  const isSchoolHead = accountType.toLowerCase() === 'school head';

  const [state, setState] = useState(() => ({
    ready: isSchoolHead,           // School Head → foran ready (no fetch)
    fullAccess: isSchoolHead,      // School Head → sab allowed
    accessible: new Set(),         // `menu||sub||action` jinki isAccessable true
    screens: new Set(),            // `menu||sub` jinme koi action accessible
    modules: new Set(),            // menu jinme koi action accessible
    knownModules: new Set(),       // menu jo API me maujood (governed)
  }));

  useEffect(() => {
    if (isSchoolHead) return undefined;    // School Head → API hit hi nahi karni
    let alive = true;
    const branchId = sessionStorage.getItem('branchID') || '1';
    const userId = sessionStorage.getItem('UserID') || '';
    const token = sessionStorage.getItem('token');
    if (!userId) { setState((s) => ({ ...s, ready: true, fullAccess: true })); return undefined; }

    fetch(buildUrl(`/get-user-menu-permissions/${branchId}/${userId}`), {
      method: 'GET',
      headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        const perms = json?.data?.permissions;
        if (!Array.isArray(perms) || !perms.length) {
          // Koi permission data nahi → fail-open (app usable rahe)
          setState((s) => ({ ...s, ready: true, fullAccess: true }));
          return;
        }
        const accessible = new Set();
        const screens = new Set();
        const modules = new Set();
        const knownModules = new Set();
        perms.forEach((p) => {
          const m = norm(p.menuName);
          const sub = norm(p.subMenuName);
          const act = norm(p.action);
          knownModules.add(m);
          if (p.isAccessable) {
            accessible.add(`${m}||${sub}||${act}`);
            screens.add(`${m}||${sub}`);
            modules.add(m);
          }
        });
        setState({ ready: true, fullAccess: false, accessible, screens, modules, knownModules });
      })
      .catch((err) => {
        console.error('Could not load user permissions:', err);
        if (alive) setState((s) => ({ ...s, ready: true, fullAccess: true })); // fail-open
      });
    return () => { alive = false; };
  }, [isSchoolHead]);

  const value = useMemo(() => {
    const { fullAccess, accessible, screens, modules, knownModules, ready } = state;
    const can = (menu, sub, action) => {
      if (fullAccess) return true;
      const m = norm(menu);
      if (!knownModules.has(m)) return true;         // module governed nahi → allow
      return accessible.has(`${m}||${norm(sub)}||${norm(action)}`);
    };
    const canScreen = (menu, sub) => {
      if (fullAccess) return true;
      const m = norm(menu);
      if (!knownModules.has(m)) return true;
      return screens.has(`${m}||${norm(sub)}`);
    };
    const canModule = (menu) => {
      if (fullAccess) return true;
      const m = norm(menu);
      if (!knownModules.has(m)) return true;
      return modules.has(m);
    };
    return { ready, fullAccess, isSchoolHead, can, canScreen, canModule };
  }, [state, isSchoolHead]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  /* Provider ke bahar (ya mount se pehle) safe default: sab allowed. */
  return ctx || FULL_ACCESS_VALUE;
}
