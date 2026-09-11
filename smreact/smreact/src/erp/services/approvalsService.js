import { mockApprovalRequests, mockApprovalCurrentUser, mockApprovalSettings, APPROVAL_STATUS, APPROVAL_ACTION_META } from '../mock/approvals';
import { INITIAL_USERS, INITIAL_ROLES } from '../pages/UserPermissions/permissionsData';
import { delay, clone } from './_http';

/* ═══════════════════════════════════════════════════════════════════
   APPROVALS SERVICE — mock/demo data source.

   The ERP has no backend Approvals API, so this module keeps the same
   self-contained mock convention the sibling app uses: one generic
   ApprovalRequest store (src/erp/mock/approvals.js) mutated in place,
   plus this service layer that the Approvals module + Settings tab call
   through. When a real backend lands, swap the `delay()` + `clone()`
   bodies here for HTTP calls and keep every signature/return shape
   stable (see services/_http.js's own contract header).

   Unlike the sibling, approveRequest() does NOT reach into other module
   services to apply the underlying change — Approvals runs purely on
   mock data here, so approving simply records the decision on the
   request. Wiring the per-action apply handlers is a backend task.
   ═══════════════════════════════════════════════════════════════════ */

/* There is no real session to read "who is logged in" from on the mock
   data path. The approver is resolved in two steps: first honor whatever
   role was explicitly picked as "Approval Authority"
   (mockApprovalSettings.approverRoleId); if none was picked, or no user
   currently holds that role, fall back to whoever holds the Super Admin
   role; if that's unassigned too, fall back to the first seeded user. */
function resolveApprover() {
  if (mockApprovalSettings.approverRoleId) {
    const user = INITIAL_USERS.find(u => u.role === mockApprovalSettings.approverRoleId);
    if (user) return user;
  }
  const superAdminRole = INITIAL_ROLES.find(r => r.template === 'super_admin');
  const user = superAdminRole && INITIAL_USERS.find(u => u.role === superAdminRole.id);
  return user || INITIAL_USERS[0];
}
export async function getCurrentApprover() { await delay(); return clone(resolveApprover()); }
export async function getCurrentUser()     { await delay(); return mockApprovalCurrentUser; }

/* ── Configurable behaviour ────────────────────────────────────────────
   Settings → Approvals reads/writes this. Every module's gated action
   would call isActionEnabled(actionType) before deciding whether to
   raise a request or just apply the change directly. */
export async function getApprovalSettings() { await delay(); return clone(mockApprovalSettings); }

export async function saveApprovalSettings(payload) {
  await delay();
  const { actionTypeEnabled, ...rest } = payload || {};
  Object.assign(mockApprovalSettings, rest);
  if (actionTypeEnabled) {
    Object.assign(mockApprovalSettings.actionTypeEnabled, actionTypeEnabled);
  }
  return clone(mockApprovalSettings);
}

export async function isActionEnabled(actionType) {
  await delay();
  if (!mockApprovalSettings.enabled) return false;
  return mockApprovalSettings.actionTypeEnabled[actionType] !== false;
}

let seq = mockApprovalRequests.length + 1;
const nextId = () => `AR-${String(seq++).padStart(4, '0')}`;

/* ── Reads ─────────────────────────────────────────────────────────── */
export async function getApprovalRequests() { await delay(); return clone(mockApprovalRequests); }

export async function getMyRequests(requestedBy) {
  await delay();
  return clone(mockApprovalRequests.filter(r => r.requestedBy === requestedBy));
}

export async function getPendingApprovals() {
  await delay();
  return clone(mockApprovalRequests.filter(r => r.status === APPROVAL_STATUS.PENDING));
}

export async function getApprovalHistory() {
  await delay();
  return clone(mockApprovalRequests.filter(r => r.status !== APPROVAL_STATUS.PENDING));
}

/* Duplicate-pending-request protection — source modules call this
   before offering "Send for Approval" so the same entity can't have
   two open requests racing each other. */
export async function hasPendingRequest(actionType, entityId) {
  await delay();
  return mockApprovalRequests.some(r =>
    r.actionType === actionType && r.entityId === entityId && r.status === APPROVAL_STATUS.PENDING);
}

/* ── Create ────────────────────────────────────────────────────────── */
export async function createApprovalRequest({ actionType, entityId, entitySummary, requestedBy, requestComment, payload, before }) {
  await delay();
  const dup = mockApprovalRequests.some(r =>
    r.actionType === actionType && r.entityId === entityId && r.status === APPROVAL_STATUS.PENDING);
  if (dup) throw new Error('A request for this item is already pending approval.');

  const meta = APPROVAL_ACTION_META[actionType] || {};
  const record = {
    id: nextId(),
    actionType,
    module: meta.module || '',
    actionLabel: meta.label || actionType,
    entityId,
    entitySummary: entitySummary || '',
    requestedBy: requestedBy || 'Unknown',
    requestedAt: new Date().toISOString(),
    status: APPROVAL_STATUS.PENDING,
    requestComment: requestComment || '',
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: '',
    payload: payload || {},
    before: before || null,
  };
  mockApprovalRequests.unshift(record);
  return clone(record);
}

/* ── Decisions ─────────────────────────────────────────────────────────
   On the mock data path approving only records the decision — the real
   per-action apply (Fee discount, challan delete, etc.) is a backend
   concern and is not wired here. */
export async function approveRequest(id, { reviewedBy, comment } = {}) {
  await delay();
  const record = mockApprovalRequests.find(r => r.id === id);
  if (!record) throw new Error('Approval request not found.');
  if (record.status !== APPROVAL_STATUS.PENDING) throw new Error('This request has already been reviewed.');

  record.status = APPROVAL_STATUS.APPROVED;
  record.reviewedBy = reviewedBy || resolveApprover().name;
  record.reviewedAt = new Date().toISOString();
  record.reviewComment = comment || '';
  return clone(record);
}

export async function rejectRequest(id, { reviewedBy, comment } = {}) {
  await delay();
  const record = mockApprovalRequests.find(r => r.id === id);
  if (!record) throw new Error('Approval request not found.');
  if (record.status !== APPROVAL_STATUS.PENDING) throw new Error('This request has already been reviewed.');

  record.status = APPROVAL_STATUS.REJECTED;
  record.reviewedBy = reviewedBy || resolveApprover().name;
  record.reviewedAt = new Date().toISOString();
  record.reviewComment = comment || '';
  return clone(record);
}

/* Lets the ORIGINAL REQUESTER withdraw their own request before anyone
   has acted on it. Only reachable while still pending; once
   approved/rejected/revoked it's frozen. Kept as its own terminal
   status (not deleted, not lumped in with "rejected") so History still
   shows it happened and who withdrew it. */
export async function revokeRequest(id, { revokedBy } = {}) {
  await delay();
  const record = mockApprovalRequests.find(r => r.id === id);
  if (!record) throw new Error('Approval request not found.');
  if (record.status !== APPROVAL_STATUS.PENDING) throw new Error('Only a pending request can be revoked.');
  if (revokedBy && record.requestedBy !== revokedBy) throw new Error('Only the requester can revoke this request.');

  record.status = APPROVAL_STATUS.REVOKED;
  record.reviewedBy = revokedBy || record.requestedBy;
  record.reviewedAt = new Date().toISOString();
  record.reviewComment = 'Revoked by requester';
  return clone(record);
}
