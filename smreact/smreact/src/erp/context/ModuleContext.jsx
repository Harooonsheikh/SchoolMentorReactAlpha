import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_MODULE_STATE, MODULE_REGISTRY } from '../config/moduleConfig';

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

export function ModuleProvider({ children }) {
  const [moduleState, setModuleState] = useState(() => {
    /* Future: replace with API call result.
       const saved = localStorage.getItem('erp_module_state');
       return saved ? JSON.parse(saved) : DEFAULT_MODULE_STATE; */
    return DEFAULT_MODULE_STATE;
  });

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

  const isActive = useCallback((moduleId) => {
    return moduleState[moduleId] !== false;   /* default true if missing */
  }, [moduleState]);

  const activateAll = useCallback(() => {
    setModuleState(Object.fromEntries(MODULE_REGISTRY.map(m => [m.id, true])));
  }, []);

  const getActiveModules = useCallback(() => {
    return MODULE_REGISTRY.filter(m => moduleState[m.id] !== false);
  }, [moduleState]);

  /* Future-ready hook for the backend round-trip. */
  const loadFromBackend = useCallback((backendConfig) => {
    setModuleState({ ...DEFAULT_MODULE_STATE, ...backendConfig });
  }, []);

  const value = useMemo(() => ({
    moduleState,
    toggleModule,
    isActive,
    activateAll,
    getActiveModules,
    loadFromBackend,
    allModules: MODULE_REGISTRY,
  }), [moduleState, toggleModule, isActive, activateAll, getActiveModules, loadFromBackend]);

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
