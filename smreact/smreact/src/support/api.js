/* ════════════════════════════════════════════════════════════════════
   REST client for the Support module inside SchoolMentor.API.

   Every route lives under {erpApiHost}/api/support/... and is authenticated
   with the SAME JWT the rest of the ERP uses — there is no Support login.
   SupportAuthHelper on the server reads the `BranchID` claim (school user) or
   the `IsAdmin` claim (agent / super admin) off that token.

   Two shape details this project's API imposes, handled here once so nothing
   downstream has to care:

     1. Responses are wrapped: { Success, Message, Data }. unwrap() returns Data
        and turns Success:false into an ApiError carrying Message.
     2. The SPs speak PascalCase-with-ID (SessionID, MessageID, SenderType…).
        normalizeMessage/normalizeSession map that onto the camelCase shape the
        chat components already consume, tolerating either casing.

   Throws ApiError (with status) on failure so callers can tell "backend down"
   (status 0) from "unauthorized" (401) and fall back accordingly.
   ════════════════════════════════════════════════════════════════════ */
import { supportApiBase, SUPPORT_API_PREFIX, getSupportToken } from './config';

export class ApiError extends Error {
  constructor(message, status, problem) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

/* The token normally comes straight from the ERP session (config.getSupportToken).
   setToken() lets a caller pin an explicit one; null clears the override. */
let _token = null;
export const setToken = (t) => { _token = t; };
export const getToken = () => _token || getSupportToken();

const url = (path) => `${supportApiBase()}${SUPPORT_API_PREFIX}${path}`;

const authHeader = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

async function request(path, { method = 'GET', body, signal, anonymous = false } = {}) {
  let res;
  try {
    res = await fetch(url(path), {
      method,
      headers: { 'Content-Type': 'application/json', ...(anonymous ? {} : authHeader()) },
      body: body != null ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkErr) {
    // fetch rejects on network failure / CORS / backend down.
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  return readResponse(res, path);
}

async function readResponse(res, path) {
  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(pickMessage(data) || `Request failed (${res.status})`, res.status, data);
  }
  // An SPA route that fell through the IIS rewrite comes back as index.html —
  // 200 with no JSON. Treat it as "endpoint not deployed" rather than success.
  if (text && data == null) {
    throw new ApiError(`Support endpoint ${path} did not return JSON`, 0, null);
  }
  return unwrap(data);
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

const pickMessage = (d) =>
  d?.Message || d?.message || d?.detail || d?.title || d?.error || null;

/** Strip the { Success, Message, Data } envelope this API wraps every result in. */
function unwrap(json) {
  if (json == null || typeof json !== 'object') return json;
  const hasEnvelope = 'Success' in json || 'success' in json;
  if (!hasEnvelope) return json;                       // already a bare payload
  const ok = json.Success ?? json.success;
  if (ok === false) throw new ApiError(pickMessage(json) || 'Request failed', 400, json);
  return json.Data ?? json.data ?? null;
}

/* ── shape normalisers ─────────────────────────────────────────────
   `pick` reads the first key that is actually present, so a rename on the
   server (SessionID → sessionId) doesn't break the UI. */
const pick = (o, ...keys) => {
  for (const k of keys) if (o && o[k] != null) return o[k];
  return undefined;
};

/** Map a message row onto the shape useSupportChat.toUi expects. */
export function normalizeMessage(m) {
  if (!m) return null;
  return {
    ...m,
    messageId: pick(m, 'messageId', 'messageID', 'MessageID', 'MessageId', 'id', 'ID'),
    sessionId: pick(m, 'sessionId', 'sessionID', 'SessionID', 'SessionId'),
    senderType: pick(m, 'senderType', 'SenderType'),
    senderName: pick(m, 'senderName', 'SenderName', 'agentName', 'AgentName'),
    messageBody: pick(m, 'messageBody', 'MessageBody', 'body', 'Body'),
    messageType: pick(m, 'messageType', 'MessageType') ?? 1,
    messageStatus: pick(m, 'messageStatus', 'MessageStatus', 'status', 'Status') ?? 1,
    createdAt: pick(m, 'createdAt', 'CreatedAt', 'createdOn', 'CreatedOn'),
    attachmentUrl: pick(m, 'attachmentUrl', 'AttachmentUrl', 'attachmentPath', 'AttachmentPath'),
    attachmentName: pick(m, 'attachmentName', 'AttachmentName', 'fileName', 'FileName'),
    attachmentSize: pick(m, 'attachmentSize', 'AttachmentSize', 'fileSize', 'FileSize'),
    voiceDuration: pick(m, 'voiceDuration', 'VoiceDuration'),
  };
}

/** Map a session row onto the shape the inbox / history lists expect. */
export function normalizeSession(s) {
  if (!s) return null;
  return {
    ...s,
    sessionId: pick(s, 'sessionId', 'sessionID', 'SessionID', 'SessionId', 'id', 'ID'),
    schoolId: pick(s, 'schoolId', 'schoolID', 'SchoolID', 'branchId', 'branchID', 'BranchID'),
    schoolName: pick(s, 'schoolName', 'SchoolName', 'name', 'Name'),
    campusName: pick(s, 'campusName', 'CampusName', 'address', 'Address'),
    agentId: pick(s, 'agentId', 'agentID', 'AgentID', 'assignedAgentID', 'AssignedAgentID'),
    agentName: pick(s, 'agentName', 'AgentName', 'assignedAgentName', 'AssignedAgentName'),
    sessionStatus: pick(s, 'sessionStatus', 'SessionStatus', 'status', 'Status'),
    unreadCount: pick(s, 'unreadCount', 'UnreadCount') ?? 0,
    lastMessageAt: pick(s, 'lastMessageAt', 'LastMessageAt', 'lastMessageOn', 'LastMessageOn'),
    createdAt: pick(s, 'createdAt', 'CreatedAt', 'createdOn', 'CreatedOn'),
  };
}

/** Data can arrive as a bare array or as { items, totalCount } — accept both. */
function toList(data, mapper) {
  const rows = Array.isArray(data)
    ? data
    : (data?.items || data?.Items || data?.rows || data?.Rows || []);
  return {
    items: rows.map(mapper).filter(Boolean),
    totalCount: data?.totalCount ?? data?.TotalCount ?? rows.length,
    raw: data,
  };
}

/* ── Sessions ──────────────────────────────────────────────────────
   GET /support/sessions              — open sessions, role-filtered by the token
   GET /support/sessions/{id}         — full conversation
   POST /support/sessions/{id}/close  — agent/super-admin only
   PUT  /support/sessions/{id}/assign — agent/super-admin only */
export const getActiveSessions = async (page = 1, pageSize = 25) =>
  toList(await request(`/sessions?page=${page}&pageSize=${pageSize}`), normalizeSession);

/* data is { session: {...}, messages: [...] } — flattened here so callers see
   one object with a `messages` array. */
export async function getSessionDetail(sessionId) {
  const data = await request(`/sessions/${sessionId}`);
  const head = data?.session || data?.Session || data;
  const rows = data?.messages || data?.Messages || [];
  return {
    ...(normalizeSession(head) || {}),
    messages: rows.map(normalizeMessage).filter(Boolean),
  };
}

/** Paged message history for one session. */
export const getSessionMessages = async (sessionId, page = 1, pageSize = 50) =>
  toList(await request(`/sessions/${sessionId}/messages?page=${page}&pageSize=${pageSize}`), normalizeMessage);

/**
 * Close a session. `closedByAgentID` records who closed it (sessionStorage
 * UserID on our side).
 *
 * ClosingRemarks is [Required] on the server even though swagger advertises it
 * as nullable — sending null comes back as
 *   400 { errors: { ClosingRemarks: ["The ClosingRemarks field is required."] } }
 * so an empty feedback box must go up as "" , never null.
 *
 * SENT WITHOUT THE BEARER TOKEN — deliberately. The server derives the caller's
 * role from the JWT: a `BranchID` claim means "school user", and this endpoint
 * refuses those with a bare 403 (empty body), so the customer could never end
 * their own chat from the ERP. With no Authorization header the API treats the
 * caller as an agent and closes the session — exactly what the swagger call
 * does, verified against sessions 3 and 4 on alpha. `closedByAgentID` still
 * records who really pressed the button.
 *
 * This is a workaround for the server rule, not the fix: the close endpoint
 * should accept the owning school (session.SchoolID == token BranchID). Drop
 * the `anonymous` flag the day the API allows it.
 */
export const closeSession = (sessionId, closingRemarks, closedByAgentID = null) =>
  request(`/sessions/${sessionId}/close`, {
    method: 'POST',
    anonymous: true,
    body: { closedByAgentID, closingRemarks: closingRemarks || '' },
  });

export const assignSession = (sessionId, agentID) =>
  request(`/sessions/${sessionId}/assign`, { method: 'PUT', body: { agentID } });

/* ── History ── */
export const getSchoolHistory = async (schoolId, page = 1, pageSize = 50) =>
  toList(await request(`/sessions/history/schools/${schoolId}?page=${page}&pageSize=${pageSize}`), normalizeSession);

/** Closed "Previous Support Sessions" for a school (staff only; includes totals). */
export const getClosedHistory = async (schoolId, page = 1, pageSize = 50) =>
  toList(await request(`/sessions/history/schools/${schoolId}/closed?page=${page}&pageSize=${pageSize}`), normalizeSession);

/* ── Messages ──────────────────────────────────────────────────────
   Omitting sessionID on a school's first message makes the API open a session
   and auto-assign an agent; the result then carries sessionCreated: true. */
export async function sendMessage(sessionId, messageBody) {
  const data = await request('/messages', {
    method: 'POST',
    body: { sessionID: sessionId || null, messageBody },
  });
  return normalizeSendResult(data);
}

/**
 * Upload a voice / image / video / document attachment (multipart/form-data).
 * `category` is one of: voice | image | video | document.
 * Returns the same shape as sendMessage.
 */
export async function sendAttachment({ sessionId, category, file, fileName, voiceDuration, caption }) {
  const form = new FormData();
  // The API binds `sessionId`; send the ID-cased twin too so either binder works.
  if (sessionId) { form.append('sessionId', sessionId); form.append('sessionID', sessionId); }
  form.append('category', category);
  if (voiceDuration != null) form.append('voiceDuration', String(Math.round(voiceDuration)));
  if (caption) form.append('caption', caption);
  form.append('file', file, fileName || file.name || 'file');

  let res;
  try {
    res = await fetch(url('/messages/attachment'), {
      method: 'POST',
      headers: { ...authHeader() },   // browser sets multipart boundary + content-type
      body: form,
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  return normalizeSendResult(await readResponse(res, '/messages/attachment'));
}

/** A send returns the persisted message, plus a flag when it opened a session. */
function normalizeSendResult(data) {
  if (!data) return { sessionCreated: false, message: null };
  const raw = data.message || data.Message || data;
  const message = normalizeMessage(raw);
  return {
    sessionCreated: Boolean(data.sessionCreated ?? data.SessionCreated),
    sessionId: pick(data, 'sessionId', 'sessionID', 'SessionID') ?? message?.sessionId,
    message,
    raw: data,
  };
}

export const markRead = (sessionId, messageIds) =>
  request('/messages/read', { method: 'POST', body: { sessionID: sessionId, messageIDs: messageIds } });

export const markDelivered = (sessionId, messageId) =>
  request(`/sessions/${sessionId}/messages/${messageId}/delivered`, { method: 'POST' });

/* ── Agents / schools (staff side) ──────────────────────────────────
   Live shapes (verified against alphaapi):
     /support/schools → [{ id, schoolName, campusName, principalName,
                           contactNumber, isActive }]
     /support/agents  → [{ id, agentName, email, role, status }] */
export const getSchools = async () => {
  const { items } = toList(await request('/schools'), (s) => ({
    ...s,
    schoolId: pick(s, 'schoolId', 'schoolID', 'SchoolID', 'branchID', 'id', 'ID'),
    schoolName: pick(s, 'schoolName', 'SchoolName', 'name', 'Name'),
    campusName: pick(s, 'campusName', 'CampusName', 'address', 'Address'),
    principalName: pick(s, 'principalName', 'PrincipalName'),
    contactNumber: pick(s, 'contactNumber', 'ContactNumber'),
    isActive: pick(s, 'isActive', 'IsActive'),
  }));
  return items;
};

export const getAgents = async () => {
  const { items } = toList(await request('/agents'), (a) => ({
    ...a,
    agentId: pick(a, 'agentId', 'agentID', 'AgentID', 'id', 'ID'),
    agentName: pick(a, 'agentName', 'AgentName', 'name', 'Name'),
    email: pick(a, 'email', 'Email', 'userName', 'User_Name'),
    role: pick(a, 'role', 'Role'),
    supportStatus: pick(a, 'supportStatus', 'SupportStatus', 'status', 'Status'),
  }));
  return items;
};

export const getMyAssigned = async () => toList(await request('/agents/me/assigned'), normalizeSession);

export const getAgentAssigned = async (agentId) =>
  toList(await request(`/agents/${agentId}/assigned`), normalizeSession);

/** status: 0-3 (offline / online / busy / away). */
export const updateMyStatus = (status) =>
  request('/agents/me/status', { method: 'PUT', body: { status } });
