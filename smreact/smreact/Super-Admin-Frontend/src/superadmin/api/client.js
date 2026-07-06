/* ════════════════════════════════════════════════════════════════════
   SUPER ADMIN — REST client

   Thin fetch wrapper that attaches the bridge JWT, parses ASP.NET Core
   ProblemDetails on errors, and throws ApiError(status) so callers can
   tell "backend down" (status 0) from "unauthorized" (401) from a 4xx.

   In MOCK MODE (no API base URL configured) every service delegates to
   `mock(...)`, which resolves the bundled demo data after a small delay —
   so the UI exercises the exact same async code path it will use live.
   ════════════════════════════════════════════════════════════════════ */
import {
  SA_API_BASE, getSuperAdminToken, isMockMode, getMockLatency, getAuthErrorHandler,
} from './config';

export class ApiError extends Error {
  constructor(message, status, problem) {
    super(message);
    this.name = 'ApiError';
    this.status = status;        // 0 = network/CORS/down, else HTTP status
    this.problem = problem;      // raw ProblemDetails body, when present
  }
}

const safeJson = (text) => { try { return JSON.parse(text); } catch { return null; } };

/** Serialize a params object to a query string, skipping null/undefined/''. */
export function buildQuery(params = {}) {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
}

/** Core JSON request. `query` is an optional params object appended to path. */
export async function request(path, { method = 'GET', body, query, signal } = {}) {
  const token = getSuperAdminToken();
  const url = `${SA_API_BASE}${path}${query ? buildQuery(query) : ''}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }

  if (res.status === 401) {
    const handler = getAuthErrorHandler();
    if (handler) try { handler(); } catch { /* ignore */ }
  }
  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const detail = data?.detail || data?.title || `Request failed (${res.status})`;
    throw new ApiError(detail, res.status, data);
  }
  return data;
}

/** multipart/form-data upload (video files, SOP PDFs, profile pictures). */
export async function upload(path, formData, { method = 'POST', signal } = {}) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_API_BASE}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, // browser sets boundary
      body: formData,
      signal,
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const detail = data?.detail || data?.title || `Upload failed (${res.status})`;
    throw new ApiError(detail, res.status, data);
  }
  return data;
}

/* ── Mock helpers ──────────────────────────────────────────────────────
   Resolve bundled demo data after a simulated delay, deep-cloned so callers
   can mutate the result without corrupting the shared seed objects. */
const clone = (v) => {
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); }
};

export function mock(valueOrFactory) {
  const v = typeof valueOrFactory === 'function' ? valueOrFactory() : valueOrFactory;
  return new Promise((resolve) => setTimeout(() => resolve(clone(v)), getMockLatency()));
}

/**
 * The one-liner every service method uses:
 *   resolve(() => DEMO_DATA, () => request('/api/...'))
 * Picks the mock factory in demo mode, the live factory against the backend.
 */
export function resolve(mockFactory, liveFactory) {
  return isMockMode() ? mock(mockFactory) : liveFactory();
}
