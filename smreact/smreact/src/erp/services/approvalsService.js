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

/* ERP Accounts requests carry module + requestAction (INSERT/UPDATE/DELETE);
   map the pair to the matching Approvals action type so the list row gets
   the right "Accounts" module label + icon. */
const ACCOUNT_MODULE_ACTIONS = {
  AccountHead:  { INSERT: 'accounts_head',       UPDATE: 'accounts_head',       DELETE: 'accounts_head' },
  AccountEntry: { INSERT: 'accounts_add_entry',  UPDATE: 'accounts_edit_entry', DELETE: 'accounts_delete_entry' },
  AccountBook:  { INSERT: 'accounts_book',       UPDATE: 'accounts_book',       DELETE: 'accounts_book' },
  BookPayment:  { INSERT: 'accounts_book_payment', UPDATE: 'accounts_book_payment', DELETE: 'accounts_book_payment' },
  /* Wallet module strings are best-guess (README doesn't cover wallets);
     harmless if the backend sends different names — the row then falls back
     to the generic label/module. */
  WalletAccount:     { INSERT: 'wallet_account',     UPDATE: 'wallet_account',     DELETE: 'wallet_account' },
  WalletTransaction: { INSERT: 'wallet_transaction', UPDATE: 'wallet_transaction', DELETE: 'wallet_transaction' },
  WalletTransfer:    { INSERT: 'wallet_transfer',    UPDATE: 'wallet_transfer',    DELETE: 'wallet_transfer' },
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

/* Record fields that are plumbing (ids, audit stamps), not meaningful
   "change details" — hidden from the detail card so it stays readable. */
const XML_SKIP_FIELDS = new Set([
  'id', 'branchid', 'createdby', 'modifiedby', 'createdat', 'modifiedat',
  'enteredby', 'isactive', 'isdeleted', 'recordid', 'approvalid', 'requestno',
]);

/* Hide raw identifier fields from the detail card — the user wants names,
   not ids (Ledger Id, Student ID, Grade ID, Section ID …). Matches a
   PascalCase/UPPER "…Id"/"…ID" suffix only, so real words that merely end
   in "id" (Paid, Valid) are kept. Friendly names (studentName / className /
   sectionName) are added from the request row instead (see mapApiRequest). */
function isSkippableTag(tag) {
  const raw = String(tag || '');
  return XML_SKIP_FIELDS.has(raw.toLowerCase()) || /(?:Id|ID)$/.test(raw);
}

/* "AccountHead" / "chequeNo" → "Account Head" / "Cheque No" for labels. */
function humanizeTag(tag) {
  return String(tag || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function xmlNodeToValue(el) {
  const kids = Array.from(el.children || []);
  if (kids.length === 0) return (el.textContent || '').trim();
  const obj = {};
  kids.forEach((c) => {
    if (isSkippableTag(c.tagName)) return;
    const v = xmlNodeToValue(c);
    if (v !== '' && v != null && String(v).toLowerCase() !== 'null') obj[humanizeTag(c.tagName)] = v;
  });
  return obj;
}

/* Parse a request's detailsXml / currentStatusXml (the real record the
   backend ships) into a {label: value} object the detail modal can render.
   Returns null when there's nothing usable, so callers can fall back. */
function parseXmlDetails(xml) {
  if (!xml || typeof xml !== 'string') return null;
  if (typeof window === 'undefined' || !window.DOMParser) return null;
  let doc;
  try { doc = new window.DOMParser().parseFromString(xml, 'application/xml'); }
  catch { return null; }
  if (!doc || doc.getElementsByTagName('parsererror').length || !doc.documentElement) return null;
  const val = xmlNodeToValue(doc.documentElement);
  return val && typeof val === 'object' && Object.keys(val).length ? val : null;
}

/* Requester's display name. The approvals_list API ships only a numeric
   requestedBy id, so: use a name field if the backend ever sends one; else
   if the request is the signed-in user's own, use their session name; else
   fall back to "User #id". (Resolving OTHER users' names needs the backend
   to include requestedByName.) */
function resolveRequesterName(r) {
  const name = r.requestedByName || r.RequestedByName || r.requestedByUser
    || r.requesterName || r.createdByName;
  if (name) return name;
  const myId = currentUserId();
  if (myId && Number(r.requestedBy) === myId) {
    try {
      const myName = sessionStorage.getItem('displayName') || sessionStorage.getItem('userName');
      if (myName) return myName;
    } catch (e) { /* no session */ }
  }
  return r.requestedBy != null ? `User #${r.requestedBy}` : '—';
}

function mapApiRequest(r) {
  const action = String(r.requestAction || '').toUpperCase();
  const acctMap = ACCOUNT_MODULE_ACTIONS[r.module];
  const actionType = MODULE_TO_ACTION[r.module]
    || (acctMap && (acctMap[action] || acctMap.UPDATE))
    || String(r.module || '').toLowerCase();
  const meta = APPROVAL_ACTION_META[actionType] || {};
  const status = String(r.status || 'pending').toLowerCase();
  const reviewed = status !== 'pending';

  let payload;
  let before;
  if (actionType === 'fee_discount') {
    /* Fee discount is the one request whose rich shape the list columns
       carry directly (student / class / head / amount). */
    const headName = r.headName || (r.headID ? `Head #${r.headID}` : '—');
    payload = {
      Student: r.studentName,
      Class: [r.className, r.sectionName && `(${r.sectionName})`].filter(Boolean).join(' '),
      'Fee Head': headName,
      'Discount Amount': fmtRs(r.discountAmount),
    };
    if (r.changedFields) payload['Changed Fields'] = r.changedFields;
    before = action === 'UPDATE' ? { 'Discount Amount': fmtRs(r.oldDiscountAmount) } : null;
  } else {
    /* Every other module (Receive/Create/Delete challan, Grade fee head,
       all Accounts & Wallet actions, HR, Inventory, Students…): build the
       card from the real record the API ships — detailsXml = requested
       values, currentStatusXml = values before. The human-readable summary
       is already shown above the card, so it isn't repeated here. Falls back
       to the changed-fields list + record id when no XML is available. */
    /* Friendly names from the row, shown first in place of the raw ids the
       XML carries (Student name, not Student ID; Class/Section names, etc.). */
    const friendly = {};
    if (r.studentName) friendly.Student = r.studentName;
    if (r.className)   friendly.Class = r.className;
    if (r.sectionName) friendly.Section = r.sectionName;

    const xmlPayload = parseXmlDetails(r.detailsXml);
    payload = { ...friendly, ...(xmlPayload || {}) };
    before  = parseXmlDetails(r.currentStatusXml);
    if (!Object.keys(payload).length) {
      if (r.changedFields) payload['Changed Fields'] = r.changedFields;
      if (r.recordID != null) payload['Record ID'] = r.recordID;
    }
  }

  return {
    id: r.requestNo || String(r.id),      // UI mein "Request" column mein yahi dikhega
    apiId: r.id,
    actionType,
    module: meta.module || r.module,
    actionLabel: meta.label || `${r.module} — ${r.requestAction}`,
    /* Kuch modules (e.g. HREmployee UPDATE) recordID null bhejte hain — record
       ki id sirf detailsXml ke <ID> me hoti hai. Wahan se fallback (0 = naya
       record, us ki koi row nahi, is liye ignore). */
    entityId: r.recordID ?? (Number((String(r.detailsXml || '').match(/<ID>(\d+)<\/ID>/) || [])[1]) || null),
    entitySummary: r.summary || '',
    requestedBy: resolveRequesterName(r),
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
  accounts_head:            'accountHead',
  accounts_add_entry:       'addAccountEntry',
  accounts_edit_entry:      'editAccoutEntry',
  accounts_delete_entry:    'deleteAccountEntry',
  accounts_book:            'accountBook',
  accounts_book_payment:    'bookPayment',
  wallet_account:           'walletAccount',
  wallet_transaction:       'walletTransaction',
  wallet_transfer:          'walletTransfer',
  hr_deduction_waiver:      'payRollDeductionWaiver',
  hr_bonus_award:           'payRollBonusAward',
  hr_salary_update:         'salaryDetailsUpdate',
  hr_leave_update:          'leavePolicyUpdate',
  hr_loan_approval:         'employeeLoanApproval',
  inventory_price_edit:     'inventoryPriceEdit',
  inventory_delete_product: 'deleteInventoryProduct',
  students_mark_inactive:   'markStudentInactive',
  students_reactivate:      'reactivateStudent',
  students_discount:        'studentFeeDiscount',
  students_dues_discount:   'duesSettelmentDiscount',
  fee_create_challan:       'createFeeChallan',
  fee_receive_challan:      'receiveFeeChallan',
  fee_clear_receiving:      'clearFeeReceiving',
  fee_grade_head:           'gradeFeeHead',
  students_preenroll_admission: 'preEnrollStudent',
  preenroll_create_challan:    'preEnrollCreateChallan',
  preenroll_receive_challan:   'preEnrollReceiveChallan',
  preenroll_delete_challan:    'preEnrollDeleteChallan',
  preenroll_clear_receiving:   'preEnrollClearReceiving',
  students_add_edit:           'addEditStudent',
  students_delete:              'deleteStudent',
  fee_transport_setup:          'transportFeeSetup',
  inventory_add_edit_product:   'inventoryProduct',
  hr_loan_repayment:            'loanRepayment',
  hr_payroll_payment:           'payrollPayment',
  hr_delete_payroll:            'deletePayroll',
  hr_add_edit_employee:         'addEditEmployee',
  hr_deactivate_employee:       'deactivateEmployee',
  hr_delete_employee:           'deleteEmployee',
};

/* Every approval switch the backend stores (swagger
   Mdl_AHM_Settings_Approvals). SAVE OVERWRITES the whole row, so any
   switch left out of the body is persisted as false. Several of these
   (createFeeChallan, receiveFeeChallan, clearFeeReceiving, gradeFeeHead,
   wallet*) aren't surfaced as toggles in this UI yet — we still round-trip
   whatever GET returned for them (see lastLoadedFlags) so a SAVE from the
   Approvals settings screen never silently turns them off. */
const ALL_API_FLAGS = [
  'feeDiscount', 'deleteFeeChallan', 'feeHeadUpdate', 'editAccoutEntry', 'deleteAccountEntry',
  'payRollDeductionWaiver', 'payRollBonusAward', 'salaryDetailsUpdate', 'leavePolicyUpdate', 'employeeLoanApproval',
  'inventoryPriceEdit', 'deleteInventoryProduct', 'markStudentInactive', 'reactivateStudent', 'studentFeeDiscount', 'duesSettelmentDiscount',
  'createFeeChallan', 'receiveFeeChallan', 'clearFeeReceiving', 'gradeFeeHead', 'walletTransaction', 'walletAccount',
  'walletTransfer', 'accountHead', 'addAccountEntry', 'accountBook', 'bookPayment', 'preEnrollCreateChallan', 'preEnrollReceiveChallan', 'preEnrollDeleteChallan', 'preEnrollClearReceiving',
  'addEditStudent', 'deleteStudent', 'transportFeeSetup', 'inventoryProduct', 'loanRepayment', 'payrollPayment', 'deletePayroll', 'addEditEmployee', 'deactivateEmployee', 'deleteEmployee',
];

/* Full flag set from the last GET, so SAVE can preserve switches this UI
   doesn't manage. Reset on every getApprovalSettings(). */
let lastLoadedFlags = {};

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
  return ALL_API_FLAGS.reduce((acc, k) => {
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

/* Real "Approver on record" = the branch's School Head (the principal in
   the employee list). Returns '' when it can't be resolved, so the caller
   can fall back. */
export async function getApproverName() {
  try {
    const branchID = currentBranchId();
    const res = await fetch(
      buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchID}`),
      { method: 'GET', headers: settingsAuthHeaders() },
    );
    const json = await res.json().catch(() => null);
    const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
    const p = rows.find((e) => e?.isPrinciple === true || e?.IsPrinciple === true);
    if (!p) return '';
    return p.employeeName || p.EmployeeName || p.name || p.Name || p.fullName || p.FullName
      || [p.firstName || p.FirstName, p.lastName || p.LastName].filter(Boolean).join(' ')
      || '';
  } catch (e) {
    return '';
  }
}

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
  /* Remember every stored flag so a later SAVE can replay the ones this UI
     doesn't expose, instead of letting SAVE's overwrite reset them to false. */
  lastLoadedFlags = {};
  if (row) {
    ALL_API_FLAGS.forEach((k) => { lastLoadedFlags[k] = boolFlag(pick(row, [k]), false); });
    Object.keys(row).forEach((k) => {
      if (typeof row[k] === 'boolean' && k !== 'approvalsActive') lastLoadedFlags[k] = row[k];
    });
  }
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
  /* Start from the full set last loaded so unmanaged switches round-trip,
     then override with the ones this screen controls. SAVE sends all 26. */
  const flags = { ...lastLoadedFlags, ...flagsFromActionTypes(actionTypeEnabled) };
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
  /* Defensive: keep only rows this user actually raised, so a requester's
     "My Requests" (and the History/stats a non-approver derives from it)
     can never show other people's requests even if the endpoint returns
     more than asked. Rows whose requestedBy can't be read are kept. */
  const rows = (Array.isArray(json?.data) ? json.data : [])
    .filter((r) => !userId || r.requestedBy == null || Number(r.requestedBy) === userId);
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

/* History = everything that's no longer pending. The no-status variant of
   approvals_list was returning an error here, so instead we ask for each
   terminal status explicitly (the status-filtered call is the same one
   Pending uses, which works) and merge them. Each is tolerant: if one
   status fails or is empty, the others still show. */
export async function getApprovalHistory() {
  const one = (s) => fetchApprovalsList(s).catch(() => []);
  const [approved, rejected, withdrawn] = await Promise.all([
    one('approved'),
    one('rejected'),
    one('withdrawn'),
  ]);
  const merged = [...approved, ...rejected, ...withdrawn].filter((r) => r.status !== 'pending');
  /* De-dup by request id in case a status appears in more than one list. */
  const seen = new Set();
  const deduped = merged.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
  /* Newest decision first, so a just-approved/rejected request lands on top. */
  return deduped.sort((a, b) => historyTime(b) - historyTime(a));
}

/* Most-recent timestamp for History ordering: when it was decided, else raised. */
export function historyTime(r) {
  const raw = r && (r.reviewedAt || r.requestedAt);
  const t = raw ? new Date(String(raw).replace(' ', 'T')).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
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
