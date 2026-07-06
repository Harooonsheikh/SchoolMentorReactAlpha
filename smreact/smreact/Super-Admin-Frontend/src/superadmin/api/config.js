/* ════════════════════════════════════════════════════════════════════
   SUPER ADMIN — API configuration + runtime bridge

   The Super Admin app runs two ways, both served by the SAME components:
     1. Standalone CRA dev app  → values come from REACT_APP_SA_* env vars.
                                   With no API base URL set, the app stays in
                                   MOCK MODE and serves the bundled demo data,
                                   so it works with zero backend.
     2. Embedded by the host    → the host page (or the .NET MVC view) calls
        (.NET / ERP shell)         window.SchoolMentorSuperAdmin.init({...})
                                   → configureSuperAdmin({ apiBaseUrl, token,
                                     role, userId, name, email }) to inject the
                                     real API URL + bridge JWT at runtime. No
                                     hardcoded URLs, no second login.

   Flip to the live .NET backend by EITHER:
     • setting REACT_APP_SA_API=https://your-host  at build time, or
     • calling configureSuperAdmin({ apiBaseUrl, token }) at runtime.

   This mirrors src/support/config.js on purpose — same mental model for
   whoever wires the backend. Exports are `let` so configureSuperAdmin()
   can update them; ES-module live bindings propagate to every importer.
   ════════════════════════════════════════════════════════════════════ */

const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

const stripTrailingSlash = (u) => (typeof u === 'string' ? u.replace(/\/+$/, '') : u || '');

/* 'true' → force mock, 'false' → force live, anything else → auto-detect. */
const parseFlag = (v) => (v === 'true' ? true : v === 'false' ? false : undefined);

/* Mutable runtime config — defaults from env, overridden by init(). */
const cfg = {
  apiBaseUrl: stripTrailingSlash(env.REACT_APP_SA_API || ''),   // '' → mock mode
  token: env.REACT_APP_SA_TOKEN || null,                        // bridge JWT from host
  useMock: parseFlag(env.REACT_APP_SA_USE_MOCK),                // explicit override
  mockLatency: Number(env.REACT_APP_SA_MOCK_LATENCY || 180),    // simulated network ms
  identity: { role: null, userId: null, name: null, email: null },
  onAuthError: null,   // optional () => void invoked on a 401, e.g. to re-auth
};

/* Live-binding export (updated by configureSuperAdmin). */
export let SA_API_BASE = cfg.apiBaseUrl;

const IDENTITY_KEYS = ['role', 'userId', 'name', 'email'];

/**
 * Apply host-supplied configuration at runtime. Safe to call repeatedly.
 *   configureSuperAdmin({ apiBaseUrl, token, role, userId, name, email, useMock, onAuthError })
 */
export function configureSuperAdmin(opts = {}) {
  if (opts.apiBaseUrl != null) cfg.apiBaseUrl = stripTrailingSlash(opts.apiBaseUrl);
  if (opts.token != null) cfg.token = opts.token;
  if (opts.useMock != null) cfg.useMock = opts.useMock;
  if (typeof opts.onAuthError === 'function') cfg.onAuthError = opts.onAuthError;
  for (const k of IDENTITY_KEYS) if (opts[k] != null) cfg.identity[k] = opts[k];

  SA_API_BASE = cfg.apiBaseUrl;
  return { ...cfg };
}

/** True when the app should serve bundled demo data instead of calling the API. */
export function isMockMode() {
  if (cfg.useMock === true) return true;
  if (cfg.useMock === false) return false;
  return !cfg.apiBaseUrl;            // auto: mock whenever no base URL is configured
}

export const getSuperAdminToken = () => cfg.token;
export const setSuperAdminToken = (t) => { cfg.token = t; };
export const getSuperAdminIdentity = () => ({ ...cfg.identity });
export const getMockLatency = () => cfg.mockLatency;
export const getAuthErrorHandler = () => cfg.onAuthError;

/** Build an absolute URL for a stored file the backend returns as "/files/...". */
export const fileUrl = (relativeOrAbsolute) => {
  if (!relativeOrAbsolute) return '';
  return /^https?:\/\//i.test(relativeOrAbsolute)
    ? relativeOrAbsolute
    : `${cfg.apiBaseUrl}${relativeOrAbsolute}`;
};
