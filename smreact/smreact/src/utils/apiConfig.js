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
const DEV_URL  =  'http://50.190.164.42:4100';
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
// School-network ka login/signup/OTP ERP ki API ke base path par nahi, apne
// alag base path par hai:
//   {host}/SchoolmentorChainManagementAPI/api/...
// Is liye buildUrl() se ye call nahi ban sakti — wo sirf host lagata hai.
//
// HOST kaun sa:
//   dev  → seedha alphaapi.
//   prod → apna hi origin (khali string), bilkul baqi APIs ki tarah. Yahan
//     alphaapi ko SEEDHA call karna kaam NAHI karta: wo host is origin ke liye
//     koi CORS header nahi bhejta (preflight 204 aata hai magar bina
//     Access-Control-Allow-Origin ke), is liye browser network-login ki request
//     block kar deta hai. IIS /SchoolmentorChainManagementAPI/* ko usi API par
//     forward karta hai — dekho public/web.config. Same origin, koi CORS nahi.
// Kisi khaas host par bhejna ho to REACT_APP_CHAIN_API_BASE set kar do.

const CHAIN_API_PREFIX = '/SchoolmentorChainManagementAPI';

/* Bare `process` browser bundle me nahi hota — sirf `process.env` ko webpack
   inline karta hai. `typeof process` par shart lagane se prod build me value
   gayab ho jati thi. */
const CHAIN_API_ENV = process.env.REACT_APP_CHAIN_API_BASE;

export const CHAIN_API_HOST = stripSlash(
  CHAIN_API_ENV != null && CHAIN_API_ENV !== ''
    ? CHAIN_API_ENV
    : (process.env.NODE_ENV === 'production' ? '' : 'https://alphaapi.schoolmentor.ai'),
);

/**
 * Build a Chain-Management API endpoint URL.
 * @param {string} path – e.g. '/api/AHM_Login_Users/network-login'
 */
export function buildChainApiUrl(path = '') {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${CHAIN_API_HOST}${CHAIN_API_PREFIX}${suffix}`;
}

// ── Uploaded media (branch logos, staff photos, documents) ──────
// The API stamps every file URL from the REQUEST host, so what comes back is
// only ever right by accident:
//   • called directly at the IP  → http://IP:4100/UploadedImages/...
//                                  (blocked as mixed content on our https site)
//   • called through the IIS proxy → http://localhost:4100/UploadedImages/...
//                                  (in a browser "localhost" is the user's OWN
//                                   machine — nothing is there, so it 404s)
// resolveMediaUrl() throws the stamped host away and keeps only the storage
// path, serving it from the https media host — so the file loads whatever the
// API stamped. EVERY file path from the API must go through it.
// Override the host with REACT_APP_MEDIA_BASE if it ever moves.
export const MEDIA_BASE = stripSlash(
  process.env.REACT_APP_MEDIA_BASE || 'https://alphaapi.schoolmentor.ai',
);

/* Every folder the API serves uploads from. /UploadedImages holds branch logos
   and staff/student photos; /UploadedDocuments holds employee documents and
   issue letters. Matching on the folder (not just the host) is what makes this
   work no matter which host the API stamped — IP, localhost, or our own origin. */
const UPLOAD_FOLDERS = /\/(UploadedImages|UploadedDocuments|Uploads)\/.*/i;

export function resolveMediaUrl(raw) {
  if (!raw) return '';
  const u = String(raw).trim();
  if (!u || u.toUpperCase() === 'N/A') return '';      // API's "no file" placeholder
  if (u.startsWith('data:')) return u;                 // inline data URI — leave it
  const m = u.match(UPLOAD_FOLDERS);                   // pull the stored path
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

// Kitni der (ms) baad kisi ERP API call ko "slow" samjha jaye — is par window
// par `sm:slow` event fire hota hai (SystemDialogs use kar ke slow banner dikhata).
const SM_SLOW_MS = 6000;

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

// ── Chain (view-only) account ─────────────────────────────────────
// Chain / network ka account poora ERP DEKH sakta hai, magar us me koi
// tabdeeli nahi kar sakta. Rok do jagah lagti hai:
//   1. UI par  — PermissionsContext ka `readOnly` (buttons band)
//   2. Yahan   — koi bhi likhne wali API call chalti hi nahi, chahe kisi
//                screen ka button permission check kiye baghair chalta ho.
// Doosri parat is liye zaroori hai ke ERP ke saare modules abhi permission
// gating par nahi aaye — un par bhi "koi action perform na ho" pura ho.

export const READ_ONLY_MSG = 'View only — a chain account cannot make changes here.';

/** Kya mojooda session view-only hai? Do soortein: */
export function isViewOnlyAccount() {
  try {
    /* 1. BRANCH chain ka hissa hai — asal wajah. Chain-Management API se
          pata chalta hai aur session me sambhal liya jata hai (dekhein
          erp/services/chainBranch.js). Branch ke apne record me is ka koi
          khana nahi, is liye `accountType` par bharosa nahi kiya ja sakta:
          chain wale school ka user bhi "School Head" hi hota hai. */
    if (sessionStorage.getItem('sm_chain_branch') === '1') return true;

    /* 2. Khud chain/network ka account ERP me aa jaye. */
    const acct = String(sessionStorage.getItem('accountType') || '').trim().toLowerCase();
    if (/\b(chain|network)\b/.test(acct)) return true;
    /* Network login apni keys `net_` prefix ke sath rakhta hai (dekhein LoginScreen). */
    return String(sessionStorage.getItem('net_accountType') || '').trim().toLowerCase() === 'network';
  } catch (e) { return false; }
}

/* Padhne wale POST — har POST likhta nahi hai. ERP ke kai "manage" endpoints
   POST par `action:"get"` bhejte hain, aur kuch reports filters POST karti hain.
   Inhe rokna view-only user ko khali screen dikha deta, is liye teen soorton
   me POST bhi guzarne diya jaata hai. */
const READ_ACTIONS = /^(get|getall|getbyid|getbybranch|getbynetwork|list|search|view|report|load|fetch|summary)/i;
/* Sirf tab jab raste ka koi HISSA in lafzon se SHURU ho — `/get-…`, `/report-header`.
   Beech me aane wala lafz nahi ginta, warna `/save-fee-report` jaisa likhne wala
   endpoint bhi "read" ban jata. */
const READ_URLS = /(^|\/)(get|report|search|list|summary|dashboard|view|export|print|download)[a-z0-9_-]*(\/|\?|$)/i;

function isReadRequest(url, init) {
  const method = String((init && init.method) || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  if (READ_URLS.test(String(url || ''))) return true;
  const body = init && init.body;
  if (typeof body === 'string' && body.length < 100000) {
    try {
      const parsed = JSON.parse(body);
      const action = parsed && parsed.action;
      if (action && READ_ACTIONS.test(String(action))) return true;
    } catch (e) { /* JSON nahi (FormData / plain text) → likhne wali samjho */ }
  }
  return false;
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
  if (onExpired) _onExpired = onExpired;
  ensureFetchWrapper();
}

/**
 * View-only rok ko alag se on/off karna.
 *
 * Ye session guard se JUDA hai kyunke Launch Setup ERP shell se BAHAR chalta
 * hai — wahan session guard band hota hai (`setSessionGuardActive(false)` ERP
 * ke unmount par), magar chain wale school par likhne ki rok wahan bhi lagni
 * chahiye.
 */
export function setViewOnlyActive(on) {
  if (typeof window === 'undefined') return;
  window.__smViewOnlyActive = !!on;
  if (on) ensureFetchWrapper();
}

/* Session khatam hone par kya karna hai — install ke waqt nahi, module par
   rakha jata hai. Wrapper ek hi dafa lagta hai (chahe pehle view-only ne
   lagaya ho), aur ERP baad me apna handler yahan de deta hai. */
let _onExpired = null;

function ensureFetchWrapper() {
  if (typeof window === 'undefined') return;
  if (window.__smSessionGuard) return;   // pehle se wrapped
  window.__smSessionGuard = true;
  const origFetch = window.fetch.bind(window);
  let firing = false;
  const trigger = () => {
    if (firing) return;
    firing = true;
    try { if (_onExpired) _onExpired(); } finally { setTimeout(() => { firing = false; }, 2000); }
  };
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (window.__smSessionGuardActive && isApiUrl(url) && !isAuthUrl(url) && !hasValidSession()) {
      trigger();
      const err = new Error('Your session has ended');
      err.isSessionExpired = true;
      throw err;
    }
    /* Chain account — dekhna sab kuch, badalna kuch nahi. Likhne wali har call
       yahin ruk jaati hai (toast ke sath), server tak jaati hi nahi. */
    if (window.__smViewOnlyActive && isApiUrl(url) && !isAuthUrl(url)
        && !isReadRequest(url, init) && isViewOnlyAccount()) {
      try { if (_sessionToast) _sessionToast(READ_ONLY_MSG, 'error'); } catch (e) { /* ignore */ }
      const err = new Error(READ_ONLY_MSG);
      err.isReadOnly = true;
      throw err;
    }
    /* Network monitor — sirf ERP API calls par. Agar response SM_SLOW_MS se zyada
       le to `sm:slow` event, aur agar 5xx aaye to `sm:server-error` event fire karo.
       SystemDialogs (ERP shell me mounted) inhe sun kar real slow/500 surfaces dikhata. */
    const monitored = isApiUrl(url);
    const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
    let slowTimer = null;
    if (monitored) {
      slowTimer = setTimeout(() => {
        try {
          /* Offline par fetch der tak hang karta hai — is soorat me Slow ke bajaye
             Offline event bhejo (warna galti se "Slow internet" dikh jata hai). */
          window.dispatchEvent(new CustomEvent(isOffline() ? 'sm:offline' : 'sm:slow'));
        } catch (e) { /* ignore */ }
      }, SM_SLOW_MS);
    }
    try {
      const res = await origFetch(input, init);
      if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
      try {
        if (res && res.status === 401 && window.__smSessionGuardActive && isApiUrl(url) && !isAuthUrl(url)) trigger();
        if (monitored && res && res.status >= 500) {
          window.dispatchEvent(new CustomEvent('sm:server-error', { detail: { status: res.status } }));
        }
        /* Pehle offline the aur ab koi API kamyab ho gayi → connection wapas aa gaya,
           Offline surface hata do (browser 'online' event kabhi na aaye tab bhi). */
        if (monitored && res && window.__smWasOffline) {
          window.__smWasOffline = false;
          window.dispatchEvent(new CustomEvent('sm:online'));
        }
      } catch (e) { /* ignore */ }
      return res;
    } catch (err) {
      if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
      /* Fetch reject = API tak request pahunchi hi nahi (network down / server band).
         navigator.onLine bharosemand nahi, is liye kisi bhi monitored API ki
         network-failure par Offline surface dikhao (abort ko chhod kar). */
      try {
        if (monitored && err && err.name !== 'AbortError' && !err.isSessionExpired) {
          window.__smWasOffline = true;
          window.dispatchEvent(new CustomEvent('sm:offline'));
        }
      } catch (e) { /* ignore */ }
      throw err;
    }
  };
}
