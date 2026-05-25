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
