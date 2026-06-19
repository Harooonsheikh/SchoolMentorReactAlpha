// ══════════════════════════════════════════════════
//  School Mentor — API Configuration
//  Single source of truth for all API base URLs.
//  Components should import { getBaseUrl, buildUrl }
//  instead of hardcoding endpoints.
// ══════════════════════════════════════════════════

const STORAGE_KEY = 'sm_api_base_url';
// const DEFAULT_URL  = 'http://210.56.9.60:1123';
const DEFAULT_URL  = 'http://50.190.164.42:4100';

/** Read the saved base URL (falls back to '' if not set) */
export function getBaseUrl() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
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
