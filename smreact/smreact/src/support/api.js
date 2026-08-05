/* ════════════════════════════════════════════════════════════════════
   Thin REST client for the Support API. Holds the JWT in memory and attaches
   it to every call. Throws ApiError (with status) on non-2xx so callers can
   distinguish "backend down" from "unauthorized".
   ════════════════════════════════════════════════════════════════════ */
import { SUPPORT_API_BASE } from './config';

export class ApiError extends Error {
  constructor(message, status, problem) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

let _token = null;
export const setToken = (t) => { _token = t; };
export const getToken = () => _token;

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${SUPPORT_API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkErr) {
    // fetch rejects on network failure / CORS / backend down.
    throw new ApiError(networkErr.message || 'Network error', 0);
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

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/* ── Auth ── */
export const schoolLogin = (usernameOrEmail, password) =>
  request('/api/auth/school/login', { method: 'POST', body: { usernameOrEmail, password } });

export const agentLogin = (usernameOrEmail, password) =>
  request('/api/auth/agent/login', { method: 'POST', body: { usernameOrEmail, password } });

export const getMe = () => request('/api/auth/me');

/* ── Sessions ── */
export const getActiveSessions = (page = 1, pageSize = 50) =>
  request(`/api/sessions?page=${page}&pageSize=${pageSize}`);

export const getSessionDetail = (sessionId) =>
  request(`/api/sessions/${sessionId}`);

export const closeSession = (sessionId, closingRemarks) =>
  request(`/api/sessions/${sessionId}/close`, { method: 'POST', body: { closingRemarks } });

export const getSchoolHistory = (schoolId, page = 1, pageSize = 50) =>
  request(`/api/history/schools/${schoolId}?page=${page}&pageSize=${pageSize}`);

/** Closed "Previous Support Sessions" for a school (with message/attachment totals). */
export const getClosedHistory = (schoolId, page = 1, pageSize = 50) =>
  request(`/api/history/schools/${schoolId}/closed?page=${page}&pageSize=${pageSize}`);

/* ── Messages ── */
export const sendMessage = (sessionId, messageBody) =>
  request('/api/messages', { method: 'POST', body: { sessionId, messageBody } });

/**
 * Upload a voice / image / video / document attachment (multipart/form-data).
 * `category` is one of: voice | image | video | document.
 * Returns the same SendMessageResult shape as sendMessage.
 */
export async function sendAttachment({ sessionId, category, file, fileName, voiceDuration, caption }) {
  const form = new FormData();
  if (sessionId) form.append('sessionId', sessionId);
  form.append('category', category);
  if (voiceDuration != null) form.append('voiceDuration', String(Math.round(voiceDuration)));
  if (caption) form.append('caption', caption);
  form.append('file', file, fileName || file.name || 'file');

  let res;
  try {
    res = await fetch(`${SUPPORT_API_BASE}/api/messages/attachment`, {
      method: 'POST',
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: form, // browser sets multipart boundary + content-type
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const detail = data?.detail || data?.title || `Upload failed (${res.status})`;
    throw new ApiError(detail, res.status, data);
  }
  return data;
}

export const markRead = (sessionId, messageIds) =>
  request('/api/messages/read', { method: 'POST', body: { sessionId, messageIds } });

export const markDelivered = (sessionId, messageId) =>
  request(`/api/sessions/${sessionId}/messages/${messageId}/delivered`, { method: 'POST' });

/* ── Agents ── */
export const getMyAssigned = () => request('/api/agents/me/assigned');
export const updateMyStatus = (status) =>
  request('/api/agents/me/status', { method: 'PUT', body: { status } });
