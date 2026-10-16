/*
  Real HTTP layer for the Preschool module's CRUD endpoints
  (https://alphaapi.schoolmentor.ai/api/preschooling-*-crud).

  Kept separate from preschoolService.js (and from the shared _http.js,
  which other modules also import for delay/clone) so this module's
  request/auth plumbing — its own base URL, dev-fallback token/branch —
  stays scoped to Preschool only and never leaks into other services.
  Every *-crud endpoint takes the same shape:
    { id, branchID, ...fields, isActive, action: 'insert'|'update'|'delete'|'get' }
  and returns { success, message, id }.

  getAuthToken()/getBranchId() below are placeholders: swap them for
  however the rest of the app already reads the logged-in user's token
  and branch (session/localStorage key names, a shared auth module,
  etc.) once this module is wired into the real app shell. Until then
  they fall back to browser storage and, failing that, to the sample
  token/branch given for this module — DEV ONLY, replace before
  shipping to production.
*/

const API_BASE = 'https://alphaapi.schoolmentor.ai/api';

// DEV-ONLY fallback — the sample token/branch supplied with this module's
// API docs. Swap getAuthToken()/getBranchId() for real session lookups.
const DEV_FALLBACK_TOKEN =
  'eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTUxMiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiMDMwMDg0MTEwNDUiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjIxOCIsIkFjY291bnRUeXBlSUQiOiIxIiwiQnJhbmNoSUQiOiIxIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiQWRtaW4iLCJleHAiOjE3OTE5NzA2MDR9.tJBZVS-qQpLSMMS8rHO9NjTnADHYBbx2luw2UA6LdDw12FRMYaCqyQ0IVAuto7x5cNqfBBL4X7rfndgPVgO-Uw';
const DEV_FALLBACK_BRANCH_ID = 1; // "branch id session id me hoti hai, wahan 1 hai" per module notes

function readStorage(key) {
  try {
    return (
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem(key)) ||
      null
    );
  } catch {
    return null; // storage can throw (private mode, SSR, etc.)
  }
}

// TODO: point this at the app's real logged-in-user token accessor.
export function getAuthToken() {
  return readStorage('token') || DEV_FALLBACK_TOKEN;
}

// TODO: point this at the app's real session/branch accessor.
export function getBranchId() {
  const n = parseInt(readStorage('branchID'), 10);
  return Number.isFinite(n) ? n : DEV_FALLBACK_BRANCH_ID;
}

/**
 * POSTs to one of the preschooling-*-crud endpoints and returns the
 * parsed JSON body ({ success, message, id }). Throws on a network
 * error, a non-2xx response, or `{ success: false }` so callers can
 * surface it the same way the existing useAsync hook surfaces mock
 * errors.
 */
export async function apiPost(endpoint, payload) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
      Authorization: `bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(payload),
  });

  let body = null;
  try { body = await res.json(); } catch { /* non-JSON / empty body */ }

  if (!res.ok || (body && body.success === false)) {
    const msg = (body && body.message) || `${endpoint} request failed (${res.status})`;
    throw new Error(msg);
  }
  return body || { success: true };
}

/**
 * GETs a preschooling read endpoint. `params` → query string. Same
 * auth + { success, message, data } handling as apiPost.
 */
export async function apiGet(endpoint, params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const res = await fetch(`${API_BASE}/${endpoint}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: { accept: '*/*', Authorization: `bearer ${getAuthToken()}` },
  });

  let body = null;
  try { body = await res.json(); } catch { /* non-JSON / empty body */ }

  if (!res.ok || (body && body.success === false)) {
    const msg = (body && body.message) || `${endpoint} request failed (${res.status})`;
    throw new Error(msg);
  }
  return body || { success: true };
}