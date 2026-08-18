/* ═══════════════════════════════════════════════════════════════════
   Remembers the last real route the user was on, so a full reload or an
   ERP → portal handoff lands them back where they were instead of always
   on /dashboard. Stored per-browser in localStorage. Login / handoff /
   root paths are never saved, and it's cleared on sign-out.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_last_path'

/** Save the current path — skips the root and the login route. */
export function saveLastPath(path) {
  if (!path || path === '/' || path.startsWith('/login')) return
  try { localStorage.setItem(KEY, path) } catch { /* storage unavailable */ }
}

/** The saved path, or '' if none. */
export function readLastPath() {
  try { return localStorage.getItem(KEY) || '' } catch { return '' }
}

/** Forget the saved path (called on sign-out). */
export function clearLastPath() {
  try { localStorage.removeItem(KEY) } catch { /* storage unavailable */ }
}
