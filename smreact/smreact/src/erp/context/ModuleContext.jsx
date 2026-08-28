import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  EMPTY_MODULE_STATE,
  MODULE_REGISTRY,
  mapApiPermissionsToModuleState,
} from '../config/moduleConfig';
import { buildSuperAdminUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   MODULE CONTEXT — runtime activation state for every ERP module.

   Lives at the root of the app (wrapped around <App />). Every part
   of the frontend that needs to know whether a module is on/off
   (sidebar, permission matrix, dashboard widgets) should consume
   this context via `useModules()`.

   API surface:
     moduleState        — full state map { moduleId: boolean }
     toggleModule(id)   — flip a module on/off (no-op for coreLocked)
     isActive(id)       — boolean check (default true if not in map)
     activateAll()      — reset every module to true
     getActiveModules() — array of MODULE_REGISTRY entries that are on
     loadFromBackend(p) — replace local state with backend payload
     allModules         — pass-through to MODULE_REGISTRY
   ═══════════════════════════════════════════════════════════════════ */

const ModuleContext = createContext(null);

const CACHE_KEY = 'moduleState';

/* Cache hamesha { branchID, state } shape me — taake dusre branch ki
   purani state galti se use na ho. */
function readCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (!cached?.state) return null;
    if (String(cached.branchID) !== String(sessionStorage.getItem('branchID'))) return null;
    return cached.state;
  } catch { return null; }
}

function writeCache(state) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      branchID: sessionStorage.getItem('branchID'),
      state,
    }));
  } catch { /* storage full / private mode — cache optional hai */ }
}

export function ModuleProvider({ children }) {
  /* Pehla paint EMPTY state par hota hai (sirf core modules), na ke "sab on"
     par — warna off kiya hua module response aane tak ek second ke liye
     sidebar me flash karta hai. Refresh par cache se seedha asli state
     mil jati hai, to wahan flash ka sawaal hi nahi. */
  const [moduleState, setModuleState] = useState(() => {
    const cached = readCache();
    return cached ? { ...EMPTY_MODULE_STATE, ...cached } : EMPTY_MODULE_STATE;
  });

  /* false jab tak backend se module-permission na aa jaye (ya fail na ho jaye).
     Sidebar isay dekh kar tab tak nav render nahi karta. */
  const [ready, setReady] = useState(() => !!readCache());

  /* ── Backend se per-branch module activation load karo ──────────────
     GET /api/SchoolPermissions/module-permission/{branchID}
     Sirf `true` wale module sidebar me dikhte hain. Call fail ho to sirf
     core modules dikhte hain — flash-free rakhne ke liye ye trade-off
     jaan-boojh kar liya hai (off module dikhane se behtar hai). */
  useEffect(() => {
    const branchID = sessionStorage.getItem('branchID');
    if (!branchID) { setReady(true); return; }

    /* ── Dev/demo override: branch 220941 ko poora sidebar dikhao ──────
       Is branch par module-permission API ko bypass kar ke har module on
       kar dete hain — chahe backend kuch bhi bheje. Sirf isi branch ke
       liye; baqi sab branchen normal API flow par chalti hain. Hataana ho
       to poora block nikaal do. */
    if (String(branchID) === '220941') {
      const allOn = Object.fromEntries(MODULE_REGISTRY.map(m => [m.id, true]));
      setModuleState(allOn);
      writeCache(allOn);
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          buildSuperAdminUrl(`/api/SchoolPermissions/module-permission/${branchID}`),
          { headers: { Accept: '*/*' } }
        );
        if (!res.ok) throw new Error(`module-permission ${res.status}`);
        const data = await res.json();
        const mapped = mapApiPermissionsToModuleState(data);
        if (cancelled || !mapped) return;
        const next = { ...EMPTY_MODULE_STATE, ...mapped };
        setModuleState(next);
        writeCache(next);
      } catch (err) {
        console.error('Module permissions load failed:', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const toggleModule = useCallback((moduleId) => {
    const mod = MODULE_REGISTRY.find(m => m.id === moduleId);
    if (!mod || mod.coreLocked) return;       /* never toggle core modules */
    setModuleState(prev => {
      const next = { ...prev, [moduleId]: !prev[moduleId] };
      /* Future: persist to backend / localStorage here.
         localStorage.setItem('erp_module_state', JSON.stringify(next)); */
      return next;
    });
  }, []);

  /* Jab tak backend ka jawab na aaye, coreLocked ke alawa kuch bhi active
     nahi mana jata — "missing → true" wala purana default off-module ko
     ek pal ke liye dikha deta tha. */
  const isActive = useCallback((moduleId) => {
    if (moduleState[moduleId] !== undefined) return moduleState[moduleId] !== false;
    return !!MODULE_REGISTRY.find(m => m.id === moduleId)?.coreLocked;
  }, [moduleState]);

  const activateAll = useCallback(() => {
    setModuleState(Object.fromEntries(MODULE_REGISTRY.map(m => [m.id, true])));
  }, []);

  const getActiveModules = useCallback(() => {
    return MODULE_REGISTRY.filter(m => moduleState[m.id] !== false);
  }, [moduleState]);

  /* Backend payload (flat permission object ya pehle se mapped state) se
     module state replace karo — LaunchSetup/Settings ke save ke baad kaam aata hai. */
  const loadFromBackend = useCallback((backendConfig) => {
    const mapped = mapApiPermissionsToModuleState(backendConfig) || backendConfig;
    const next = { ...EMPTY_MODULE_STATE, ...mapped };
    setModuleState(next);
    writeCache(next);
    setReady(true);
  }, []);

  const value = useMemo(() => ({
    moduleState,
    ready,
    toggleModule,
    isActive,
    activateAll,
    getActiveModules,
    loadFromBackend,
    allModules: MODULE_REGISTRY,
  }), [moduleState, ready, toggleModule, isActive, activateAll, getActiveModules, loadFromBackend]);

  return (
    <ModuleContext.Provider value={value}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error('useModules must be used inside ModuleProvider');
  return ctx;
}
