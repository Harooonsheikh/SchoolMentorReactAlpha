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
//   prod (npm run build)  → the app's OWN origin (https://erp.schoolmentor.ai, set
//     via REACT_APP_API_BASE_URL in .env.production). The browser blocks calling
//     http://IP:4100 from an https page (mixed content), and alphaapi sends no CORS
//     for this origin — so the app calls /api/…, /SchoolMentorSuperAdminAPI/…, /get-…
//     on its own origin and IIS reverse-proxies those to https://alphaapi.schoolmentor.ai
//     (see the rewrite rules in public/web.config). No mixed content, no CORS.
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

// ── Chain Management API (Network Head Office) ──────────────────
// School-network ka login/signup/OTP ERP ki API par nahi, apni alag service par
// hai — apne host AUR apne base path ke sath:
//   https://alphaapi.schoolmentor.ai/SchoolmentorChainManagementAPI/api/...
// Is liye buildUrl() se ye call nahi ban sakti (wo ERP ka host lagata hai, jahan
// ye endpoints 404 dete hain). Host override karna ho to REACT_APP_CHAIN_API_BASE.

const CHAIN_API_PREFIX = '/SchoolmentorChainManagementAPI';

export const CHAIN_API_HOST = stripSlash(
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_CHAIN_API_BASE)
  || 'https://alphaapi.schoolmentor.ai',
);

/**
 * Build a Chain-Management API endpoint URL.
 * @param {string} path – e.g. '/api/AHM_Login_Users/network-login'
 */
export function buildChainApiUrl(path = '') {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${CHAIN_API_HOST}${CHAIN_API_PREFIX}${suffix}`;
}

// ── Uploaded media (branch logos etc.) ──────────────────────────
// The API stamps a branch logo URL from the request host, so it can come back
// as http://IP:4100/UploadedImages/... (blocked as mixed content on our https
// site) or with the app's OWN origin (which does not serve /UploadedImages, so
// it 404s / resolves to localhost). resolveMediaUrl() keeps the exact storage
// path the API returned but serves it from the https media host, so the image
// always loads. Override the host with REACT_APP_MEDIA_BASE if it ever moves.
export const MEDIA_BASE = stripSlash(
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_MEDIA_BASE)
  || 'https://alphaapi.schoolmentor.ai',
);

export function resolveMediaUrl(raw) {
  if (!raw) return '';
  const u = String(raw).trim();
  if (u.startsWith('data:')) return u;                 // inline data URI — leave it
  const m = u.match(/\/UploadedImages\/.*/i);          // pull the stored path
  if (m) return `${MEDIA_BASE}${m[0]}`;                // serve it from the media host
  if (/^https?:\/\//i.test(u)) return u;               // some other absolute URL
  return `${MEDIA_BASE}${u.startsWith('/') ? u : `/${u}`}`;
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

// ── Global session guard ──────────────────────────────────────────
// If the login session is cleared (token / branchID removed from
// sessionStorage), the ERP must not keep firing identity-less API calls
// and rendering broken screens. Instead, the next API action bounces the
// user to login with a "session ended" toast. installSessionGuard() wraps
// window.fetch ONCE so this covers every module without touching call sites.

// The keys that must exist for a live session. Add 'employee_ID' / 'UserID'
// here if you want those treated as required too.
export const SESSION_KEYS = ['token', 'branchID'];

/** True only when every required session key is present. */
export function hasValidSession() {
  try { return SESSION_KEYS.every((k) => !!sessionStorage.getItem(k)); }
  catch (e) { return false; }
}

/** Does this URL look like an ERP backend call (vs a static asset)? */
function isApiUrl(url) {
  const u = String(url || '');
  const base = getBaseUrl();
  if (base && u.startsWith(base)) return true;
  return /(^|\/)(api|SchoolMentorSuperAdminAPI)\//i.test(u)
    || /(^|\/)((get|save|saveupdate|delete|assign)-|report-header)/i.test(u);
}

/** Auth / pre-login endpoints — never blocked by the guard (login, signup,
    token refresh run with no session by definition). */
function isAuthUrl(url) {
  /* `[/-]` (sirf `/` nahi) — network ke endpoints path ke beech me hyphen ke sath
     aate hain: /api/AHM_Login_Users/network-login, network-signup, network-send-otp.
     Purana regex sirf "/login" pakadta tha, is liye guard inhe block kar deta tha
     aur network login/signup chalte hi nahi thay. */
  return /\/(Auth|Account)\/|[/-](login|signin|signup|register|refresh|forgot|reset|send-otp)/i.test(String(url || ''));
}

/** Turn the guard's enforcement on/off. The ERP switches it OFF when it
    unmounts so the login/signup screens (no session yet) aren't affected. */
export function setSessionGuardActive(on) {
  if (typeof window !== 'undefined') window.__smSessionGuardActive = !!on;
}

/**
 * Wrap window.fetch once. While active, an API call attempted with no valid
 * session — or a 401 from the server — invokes onExpired() (toast + redirect
 * to login) and aborts the request. Auth endpoints are always allowed. Safe to
 * call repeatedly: it installs the wrapper once and just re-activates after.
 */
export function installSessionGuard({ onExpired } = {}) {
  if (typeof window === 'undefined') return;
  window.__smSessionGuardActive = true;
  if (window.__smSessionGuard) return;   // already wrapped — just re-activated above
  window.__smSessionGuard = true;
  const origFetch = window.fetch.bind(window);
  let firing = false;
  const trigger = () => {
    if (firing) return;
    firing = true;
    try { if (onExpired) onExpired(); } finally { setTimeout(() => { firing = false; }, 2000); }
  };
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (window.__smSessionGuardActive && isApiUrl(url) && !isAuthUrl(url) && !hasValidSession()) {
      trigger();
      const err = new Error('Your session has ended');
      err.isSessionExpired = true;
      throw err;
    }
    const res = await origFetch(input, init);
    try { if (res && res.status === 401 && window.__smSessionGuardActive && isApiUrl(url) && !isAuthUrl(url)) trigger(); }
    catch (e) { /* ignore */ }
    return res;
  };
}
