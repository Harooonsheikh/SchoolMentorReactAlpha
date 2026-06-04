// ══════════════════════════════════════════════════
//  School Mentor ERP — auth / navigation helper
//  This ERP is now merged into the Launch-Setup app and runs in the SAME
//  React app (one port). Navigation (logout / back to setup) is handled
//  in-app by the host, which registers callbacks via setErpNavHandlers().
//  The window.location fallbacks below only run if no handler is registered.
// ══════════════════════════════════════════════════

// In-app navigation handlers, injected once by the host (src/erp/App.js).
let handlers = { onLogout: null, onExitToSetup: null };

/** Host registers in-app navigation callbacks here. */
export function setErpNavHandlers(next) {
  handlers = { ...handlers, ...next };
}

/** Log out: hand back to the host (clears session + shows login). */
export function logout() {
  if (handlers.onLogout) { handlers.onLogout(); return; }
  // Fallback (standalone use only)
  try { sessionStorage.clear(); } catch (e) { /* ignore */ }
  window.location.href = '/';
}

/** Leave the ERP and go back to the Launch-Setup screen (in-app). */
export function goToLaunchSetup() {
  if (handlers.onExitToSetup) { handlers.onExitToSetup(); return; }
  // Fallback (standalone use only)
  window.location.href = '/';
}
