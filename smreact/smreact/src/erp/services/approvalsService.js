import { mockApprovalRequests, mockApprovalCurrentUser, mockApprovalSettings, APPROVAL_STATUS, APPROVAL_ACTION_META } from '../mock/approvals';
import { INITIAL_USERS, INITIAL_ROLES } from '../pages/UserPermissions/permissionsData';
import { delay, clone } from './_http';
import { buildUrl } from '../../utils/apiConfig';

/* Settings → Approvals  POST /api/Setting/manage-settings-approvals
     action: GET | SAVE
     UI action keys → swagger Mdl_AHM_Settings_Approvals field names.
     `editAccoutEntry` / `duesSettelmentDiscount` API ki spelling hain. */
const SETTINGS_APPROVALS_ENDPOINT = '/api/Setting/manage-settings-approvals';
/* ── My Requests → GET /api/Approvals/approvals_by_user ── */
const MY_REQUESTS_ENDPOINT = '/api/Approvals/approvals_by_user';

/* API "module" → UI actionType (APPROVAL_ACTION_META ki key).
   Baqi modules ke liye yahan entries add karte jayein. */
const MODULE_TO_ACTION = {
  FeeDiscount: 'fee_discount',
};

/* NOTE: login ke baad userId sessionStorage mein jis key se save hota hai
   wahi yahan rakhein — neeche common names try ho rahe hain. */
function currentUserId() {
  for (const k of ['userID', 'userId', 'UserID', 'user_id']) {
    const v = sessionStorage.getItem(k);
    if (v) return Number(v) || 0;
  }
  return 0;
}

const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`;

function mapApiRequest(r) {
  const actionType = MODULE_TO_ACTION[r.module] || String(r.module || '').toLowerCase();
  const meta = APPROVAL_ACTION_META[actionType] || {};
  const status = String(r.status || 'pending').toLowerCase();
  const reviewed = status !== 'pending';
  const headName = r.headName || (r.headID ? `Head #${r.headID}` : '—');

  const payload = {
    Student: r.studentName,
    Class: [r.className, r.sectionName && `(${r.sectionName})`].filter(Boolean).join(' '),
    'Fee Head': headName,
    'Discount Amount': fmtRs(r.discountAmount),
  };
  if (r.changedFields) payload['Changed Fields'] = r.changedFields;

  const before = r.requestAction === 'UPDATE'
    ? { 'Discount Amount': fmtRs(r.oldDiscountAmount) }
    : null;

  return {
    id: r.requestNo || String(r.id),      // UI mein "Request" column mein yahi dikhega
    apiId: r.id,
    actionType,
    module: meta.module || r.module,
    actionLabel: meta.label || `${r.module} — ${r.requestAction}`,
    entityId: r.recordID,
    entitySummary: r.summary || '',
    requestedBy: r.requestedByName || `User #${r.requestedBy}`,
    requestedAt: r.requestedAt,
    status,
    requestComment: '',
    reviewedBy: reviewed ? (r.reviewedByName || `User #${r.modifiedBy}`) : null,
    reviewedAt: reviewed ? r.modifiedAt : null,
    reviewComment: '',
    payload,
    before,
  };
}

const ACTION_TO_API = {
  fee_discount:             'feeDiscount',
  fee_delete_challan:       'deleteFeeChallan',
  fee_heads_update:         'feeHeadUpdate',
  accounts_edit_entry:      'editAccoutEntry',
  accounts_delete_entry:    'deleteAccountEntry',
  hr_deduction_waiver:      'payRollDeductionWaiver',
  hr_bonus_award:           'payRollBonusAward',
  hr_salary_update:         'salaryDetailsUpdate',
  hr_leave_update:          'leavePolicyUpdate',
  hr_loan_approval:         'employeeLoanApproval',
  inventory_price_edit:     'inventoryPriceEdit',
  inventory_delete_product: 'deleteInventoryProduct',
  students_mark_inactive:   'markStudentInactive',
  students_discount:        'studentFeeDiscount',
  students_dues_discount:   'duesSettelmentDiscount',
};

function currentBranchId() {
  return Number(sessionStorage.getItem('branchID')) || 0;
}

function settingsAuthHeaders() {
  const token = sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Accept: '*/*',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function pick(obj, names, fallback) {
  if (!obj) return fallback;
  const map = new Map(Object.keys(obj).map((k) => [String(k).toLowerCase(), k]));
  for (const n of names) {
    const key = map.get(String(n).toLowerCase());
    if (key != null && obj[key] != null && obj[key] !== '') return obj[key];
  }
  return fallback;
}

function boolFlag(v, fallback = false) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'y', 'yes'].includes(s)) return true;
  if (['false', '0', 'n', 'no'].includes(s)) return false;
  return fallback;
}

function emptyApiFlags(value = false) {
  return Object.values(ACTION_TO_API).reduce((acc, k) => {
    acc[k] = Boolean(value);
    return acc;
  }, {});
}

function flagsFromActionTypes(actionTypeEnabled = {}) {
  const flags = {};
  Object.entries(ACTION_TO_API).forEach(([uiKey, apiKey]) => {
    flags[apiKey] = actionTypeEnabled[uiKey] !== false;
  });
  return flags;
}

function extractRows(json) {
  const d = json?.data ?? json?.Data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') return [d];
  return [];
}

function actionTypesFromRow(row) {
  const actionTypeEnabled = { ...mockApprovalSettings.actionTypeEnabled };
  Object.entries(ACTION_TO_API).forEach(([uiKey, apiKey]) => {
    actionTypeEnabled[uiKey] = boolFlag(pick(row, [apiKey]), actionTypeEnabled[uiKey] !== false);
  });
  return actionTypeEnabled;
}

function rowToSettings(row) {
  return {
    id: Number(pick(row, ['id', 'ID'], 0)) || 0,
    enabled: boolFlag(pick(row, ['approvalsActive']), true),
    approverRoleId: mockApprovalSettings.approverRoleId,
    actionTypeEnabled: actionTypesFromRow(row),
  };
}

function syncMockSettings(settings) {
  mockApprovalSettings.enabled = settings.enabled;
  Object.assign(mockApprovalSettings.actionTypeEnabled, settings.actionTypeEnabled);
}

async function postSettingsApprovals(body, failMsg) {
  const res = await fetch(buildUrl(SETTINGS_APPROVALS_ENDPOINT), {
    method: 'POST',
    headers: settingsAuthHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || failMsg);
  }
  return json;
}

/* ═══════════════════════════════════════════════════════════════════
   APPROVALS SERVICE

   Settings → Approvals GET/SAVE hit POST /api/Setting/manage-settings-approvals.
   Approval request queue (list / approve / reject / revoke) abhi mock
   store (src/erp/mock/approvals.js) par chalti hai.
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
export async function getApprovalSettings() {
  const branchID = currentBranchId();
  const json = await postSettingsApprovals(
    { action: 'GET', id: 0, branchID, approvalsActive: false, ...emptyApiFlags(false) },
    'Could not load approval settings',
  );
  const rows = extractRows(json);
  const row = rows.find((r) => Number(pick(r, ['branchID', 'BranchID'], 0)) === branchID) || rows[0];
  const settings = row
    ? rowToSettings(row)
    : {
        id: 0,
        enabled: true,
        approverRoleId: mockApprovalSettings.approverRoleId,
        actionTypeEnabled: { ...mockApprovalSettings.actionTypeEnabled },
      };
  syncMockSettings(settings);
  return settings;
}

export async function saveApprovalSettings({ enabled, actionTypeEnabled, id = 0 } = {}) {
  const branchID = currentBranchId();
  const flags = flagsFromActionTypes(actionTypeEnabled);
  const json = await postSettingsApprovals(
    {
      action: 'SAVE',
      id: Number(id) || 0,
      branchID,
      approvalsActive: Boolean(enabled),
      ...flags,
    },
    'Could not save approval settings',
  );
  const row = extractRows(json)[0];
  let newId = Number(pick(row, ['id', 'ID'], 0)) || Number(json?.id) || Number(id) || 0;
  if (!newId) {
    try { newId = (await getApprovalSettings()).id; } catch { /* save ho chuka hai */ }
  }
  const settings = {
    id: newId,
    enabled: Boolean(enabled),
    approverRoleId: mockApprovalSettings.approverRoleId,
    actionTypeEnabled: { ...mockApprovalSettings.actionTypeEnabled, ...(actionTypeEnabled || {}) },
  };
  syncMockSettings(settings);
  return settings;
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

export async function getMyRequests() {
  const branchId = currentBranchId();
  const userId = currentUserId();
  const res = await fetch(
    buildUrl(`${MY_REQUESTS_ENDPOINT}?branchId=${branchId}&userId=${userId}`),
    { method: 'GET', headers: settingsAuthHeaders() },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || 'Could not load your requests');
  }
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(mapApiRequest);
}


/* ── Pending / History → GET /api/Approvals/approvals_list?branchId=&status= ── */
const APPROVALS_LIST_ENDPOINT = '/api/Approvals/approvals_list';

async function fetchApprovalsList(status) {
  const branchId = currentBranchId();
  const qs = status
    ? `branchId=${branchId}&status=${status}`
    : `branchId=${branchId}`;
  const res = await fetch(
    buildUrl(`${APPROVALS_LIST_ENDPOINT}?${qs}`),
    { method: 'GET', headers: settingsAuthHeaders() },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || `Could not load ${status || 'history'} approvals`);
  }
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(mapApiRequest);
}

export async function getPendingApprovals() { return fetchApprovalsList('pending'); }
export async function getApprovalHistory() {
  const rows = await fetchApprovalsList('');
  return rows.filter((r) => r.status !== 'pending');
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
/* ── Approve / Reject → POST /api/Approvals/process ── */
const PROCESS_ENDPOINT = '/api/Approvals/process';

async function processApproval(apiId, status) {
  const res = await fetch(buildUrl(PROCESS_ENDPOINT), {
    method: 'POST',
    headers: settingsAuthHeaders(),
    body: JSON.stringify({
      approvalId: Number(apiId),
      status,                       // 'Approved' | 'Rejected'
      modifiedBy: currentUserId(),  // jis user ne tick/cross kiya
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || `Could not mark request as ${status}`);
  }
  return json;
}

export async function approveRequest(apiId) { return processApproval(apiId, 'Approved'); }
export async function rejectRequest(apiId)  { return processApproval(apiId, 'Rejected'); }

/* ── Withdraw (requester apni PENDING request khud wapas le) ──
   POST /api/Approvals/withdraw { approvalId, userId }. apiId numeric ApprovalID
   hai (requestNo nahi). Real endpoint — pehle wali mock revokeRequest ki jagah. */
const WITHDRAW_ENDPOINT = '/api/Approvals/withdraw';
export async function withdrawRequest(apiId) {
  const res = await fetch(buildUrl(WITHDRAW_ENDPOINT), {
    method: 'POST',
    headers: settingsAuthHeaders(),
    body: JSON.stringify({ approvalId: Number(apiId) || 0, userId: currentUserId() }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || 'Could not withdraw request');
  }
  return json;
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
