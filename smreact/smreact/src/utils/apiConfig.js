// ══════════════════════════════════════════════════
//  School Mentor — API Configuration
//  Single source of truth for all API base URLs.
//  Components should import { getBaseUrl, buildUrl }
//  instead of hardcoding endpoints.
// ══════════════════════════════════════════════════

const STORAGE_KEY = 'sm_api_base_url';

const stripSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

// Where the API lives, per build:
//   dev  (npm start)      → the API box directly over http; nothing in front of it.
//   prod (npm run build)  → same origin as the site. The site is https, and a
//     browser blocks an http request made from an https page (mixed content), so
//     the API cannot be called at http://IP:4100 from production. IIS rewrites
//     /api/* to the API on localhost:4100 — see the proxy rule in public/web.config.
//   Override either with REACT_APP_API_BASE_URL (see .env.production).
// const DEV_URL = 'http://210.56.9.60:1123';
const DEV_URL  = 'http://50.190.164.42:4100';
const PROD_URL = 'https://erp.schoolmentor.ai';

const DEFAULT_URL = stripSlash(process.env.REACT_APP_API_BASE_URL)
  || (process.env.NODE_ENV === 'production' ? PROD_URL : DEV_URL);

/** Read the saved base URL (falls back to the build default) */
export function getBaseUrl() {
  const saved = stripSlash(localStorage.getItem(STORAGE_KEY));
  // A plain-http override saved before the site moved to https would make every
  // call fail as mixed content, so it is ignored rather than silently breaking.
  const insecure = typeof window !== 'undefined'
    && window.location.protocol === 'https:'
    && saved.startsWith('http://');
  return (saved && !insecure) ? saved : DEFAULT_URL;
}

/** Persist a new base URL */
export function saveBaseUrl(url) {
  const trimmed = url.trim().replace(/\/+$/, ''); // strip trailing slashes
  localStorage.setItem(STORAGE_KEY, trimmed);
  return trimmed;
}

/** Clear the saved base URL */
export function clearBaseUrl() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Build a full endpoint URL.
 * @param {string} path  – e.g. '/api/students'
 * @returns {string}     – e.g. 'https://api.example.com/api/students'
 */
export function buildUrl(path = '') {
  const base = getBaseUrl();
  if (!base) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

// ── Super-Admin API ─────────────────────────────────────────────
// School/branch-level configuration (module activation waghera) alag
// Super-Admin service par rehti hai, jiska apna base path hai:
//   {host}/SchoolMentorSuperAdminAPI/api/...
// Isi liye buildUrl() se ye call nahi ban sakti — wo sirf host lagata hai.

const SUPER_ADMIN_PREFIX = '/SchoolMentorSuperAdminAPI';

/**
 * Build a Super-Admin API endpoint URL.
 * @param {string} path – e.g. '/api/SchoolPermissions/module-permission/1'
 */
export function buildSuperAdminUrl(path = '') {
  const base = getBaseUrl();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${SUPER_ADMIN_PREFIX}${suffix}`;
}

// ── Session guard ───────────────────────────────────────────────
// Many CRUD POSTs are scoped to the active academic session and send it as
// `sessionID`/`sessionYearID`. If no session is selected, those calls must be
// blocked with a clear message instead of silently posting an empty/0 session.

export const NO_SESSION_MSG = 'No current session is selected';

/**
 * Pull a human-readable message out of an API response body, if any. Backends
 * return referential-constraint errors here (e.g. "Term cannot be deleted as it
 * is referenced in the Exam.") which should be surfaced to the user verbatim.
 */
export function apiMessage(json) {
  if (!json || typeof json !== 'object') return null;
  return json.message || json.Message || json.title || json.error || json.Error || null;
}

/** The active session id: user-switched (changeSessionId) → login session. */
export function activeSessionId() {
  return sessionStorage.getItem('changeSessionId')
    || sessionStorage.getItem('SessionID')
    || sessionStorage.getItem('sessionID')
    || '';
}

// A toast callback registered by the app so the guard can surface the error
// from non-React module code (the POST wrappers).
let _sessionToast = null;
export function registerSessionToast(fn) { _sessionToast = fn; }

/**
 * Guard a session-scoped POST payload. If the payload carries a session field
 * (sessionID/sessionYearID/SessionID) but it's empty or 0, toast the error and
 * throw so the calling POST aborts. Delete actions are exempt (keyed by id).
 * Errors thrown here have `.isSessionError = true` so callers can avoid showing
 * a second, generic toast.
 */
export function assertSessionPayload(payload) {
  // Only guard data-changing posts; reads ('get') and deletes (keyed by id) are exempt.
  if (!payload || payload.action === 'delete' || payload.action === 'get') return;
  const hasKey = 'sessionID' in payload || 'sessionYearID' in payload || 'SessionID' in payload;
  if (!hasKey) return;
  const val = payload.sessionID ?? payload.sessionYearID ?? payload.SessionID;
  if (!val || String(val) === '0') {
    if (_sessionToast) _sessionToast(NO_SESSION_MSG, 'error');
    const err = new Error(NO_SESSION_MSG);
    err.isSessionError = true;
    throw err;
  }
}
