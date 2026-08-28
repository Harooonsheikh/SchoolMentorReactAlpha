import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildUrl, isViewOnlyAccount } from '../../utils/apiConfig';
import { checkChainBranch } from '../services/chainBranch';
import { MODULE_REGISTRY } from '../config/moduleConfig';

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
     readOnly     — chain/network account: har screen dikhti hai, magar sirf
                    View / Download / Print chalte hain (koi tabdeeli nahi)
     can(menu, sub, action)  — us exact action ka access
     canScreen(menu, sub)    — us screen me koi bhi action allowed?
     canModule(menu)         — us module me koi bhi action allowed?
   ═══════════════════════════════════════════════════════════════════ */

const PermissionsContext = createContext(null);
const norm = (s) => String(s ?? '').trim().toLowerCase();

/* ── Module-level allow-list universe (labels normalised) ──────────────
   EVERY module the app knows about (registry) is permission-gated per
   user: use dikhega sirf tab jab permission response me us module ki koi
   action accessible ho. Response me absent = NO access — backend sirf
   granted rows bhejta hai, poora true/false matrix nahi.

   Note: Settings / User Permissions / Audit Logs permission tree me
   grantable hain (grant hone par API me aate hain). Launch Setup tree
   me hai hi nahi → sirf School Head (fullAccess) ko dikhega. School Head
   aur jin users ka koi permission-data nahi (fail-open) — dono ko poora
   access milta hai, is liye koi lockout nahi. */
const GATEABLE_MODULES = new Set([
  ...MODULE_REGISTRY.map((m) => norm(m.label)),
  /* Dashboard MODULE_REGISTRY me nahi hai (school level par on/off nahi hota),
     magar ab role/user permission me grantable module hai. Yahan rakhna zaroori
     hai taake "response me nahi = access nahi" wala usool is par bhi lage —
     warna canModule('Dashboard') har us user ke liye true ho jata jiske
     permission set me Dashboard hai hi nahi. */
  'dashboard',
]);

const FULL_ACCESS_VALUE = {
  ready: true, fullAccess: true, isSchoolHead: false, readOnly: false,
  can: () => true, canScreen: () => true, canModule: () => true,
};

/* ── View-only (chain) account ───────────────────────────────────────
   Chain/network ka user poora ERP dekh sakta hai — har module, har screen —
   magar koi tabdeeli nahi kar sakta. Is liye module/screen level par usay
   fullAccess milta hai, aur rok sirf ACTION level par lagti hai: yehi teen
   actions guzarte hain, baqi (Create/Edit/Delete/Approve/Assign/Settings) band.
   Doosri parat apiConfig ke fetch guard me hai — dekhein isViewOnlyAccount. */
const VIEW_ACTIONS = new Set(['view', 'download', 'print']);

export function PermissionsProvider({ children }) {
  const accountType = (sessionStorage.getItem('accountType') || '').trim();
  const isSchoolHead = accountType.toLowerCase() === 'school head';
  /* Chain ka pata do tarah se chalta hai:
       • foran — session me pehle se maloom ho (ya account hi chain ka ho)
       • zara der me — Chain-Management API se, pehli load par
     Is liye ye state hai, sirf ek shart nahi. */
  const [readOnly, setReadOnly] = useState(() => isViewOnlyAccount());

  useEffect(() => {
    if (readOnly) return undefined;         // pehle se maloom — dobara poochna bekaar
    let alive = true;
    checkChainBranch()
      .then((isChain) => { if (alive && isChain) setReadOnly(true); })
      .catch(() => { /* chain API na chale to school apna ERP chalata rahe */ });
    return () => { alive = false; };
  }, [readOnly]);

  const [state, setState] = useState(() => ({
    ready: isSchoolHead || isViewOnlyAccount(),        // School Head / chain → foran ready (no fetch)
    fullAccess: isSchoolHead || isViewOnlyAccount(),   // dono ko har screen dikhti hai
    accessible: new Set(),         // `menu||sub||action` jinki isAccessable true
    screens: new Set(),            // `menu||sub` jinme koi action accessible
    modules: new Set(),            // menu jinme koi action accessible
    knownModules: new Set(),       // menu jo API me maujood (governed)
  }));

  useEffect(() => {
    /* School Head → sab allowed; chain → sab dikhega magar chalega kuch nahi.
       Dono soorton me per-user permissions mangane ki zaroorat nahi. */
    if (isSchoolHead || readOnly) return undefined;
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
  }, [isSchoolHead, readOnly]);

  const value = useMemo(() => {
    const { fullAccess, accessible, screens, modules, knownModules, ready } = state;
    const can = (menu, sub, action) => {
      /* Chain account: sirf dekhna, chhapna aur download — koi tabdeeli nahi.
         Ye check fullAccess se PEHLE lagta hai, warna fullAccess ki wajah se
         view-only user ko bhi har action mil jata. */
      if (readOnly) return VIEW_ACTIONS.has(norm(action));
      if (fullAccess) return true;
      const m = norm(menu);
      if (!knownModules.has(m)) return true;         // module governed nahi → allow
      return accessible.has(`${m}||${norm(sub)}||${norm(action)}`);
    };
    /* Chain wale school ko har screen/module DIKHTA hai — rok sirf actions par
       hai. Is liye readOnly yahan fullAccess ki tarah kaam karta hai (chain ka
       pata permissions load hone ke BAAD chale to bhi menu chhupe nahi). */
    const canScreen = (menu, sub) => {
      if (fullAccess || readOnly) return true;
      const m = norm(menu);
      if (!knownModules.has(m)) return true;
      return screens.has(`${m}||${norm(sub)}`);
    };
    const canModule = (menu) => {
      if (fullAccess || readOnly) return true;
      const m = norm(menu);
      /* Registry ka koi bhi module → sirf tab dikhao jab response me is
         module ki koi action accessible ho. Absent = NO access. */
      if (GATEABLE_MODULES.has(m)) return modules.has(m);
      if (!knownModules.has(m)) return true;          // truly uncovered → allow (legacy safety)
      return modules.has(m);
    };
    return { ready, fullAccess, isSchoolHead, readOnly, can, canScreen, canModule };
  }, [state, isSchoolHead, readOnly]);

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
