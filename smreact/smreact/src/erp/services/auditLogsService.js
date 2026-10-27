/* ═══════════════════════════════════════════════════════════════════
   AUDIT LOGS API  —  src/erp/services/auditLogsService.js

   Endpoints (base from getBaseUrl / buildUrl — sandbox or live):
     1. GET /get-audit-log-filters/{branchId}
          → { modules: string[], actions: string[],
              users: [{ userID, userName, role }] }
     2. GET /get-audit-logs-by-branch/{branchId}
          ?pageNumber&pageSize&fromDate&toDate&module&userId&action&search
          → { stats, totalRecords, pageNumber, pageSize, data: [...] }
   ═══════════════════════════════════════════════════════════════════ */
import { buildUrl } from '../../utils/apiConfig';

/* Branch id — same source as the rest of the ERP (sessionStorage.branchID). */
export function getBranchId() {
  try {
    return sessionStorage.getItem('branchID') || 1;
  } catch {
    return 1;
  }
}

/* Empty values are not sent in the query string. */
function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/* The API worked in Swagger without an Authorization header; the token is
   attached only when one exists, matching the other services. */
async function getJson(path, { signal } = {}) {
  let token = null;
  try { token = sessionStorage.getItem('token'); } catch { /* ignore */ }

  const res = await fetch(buildUrl(path), {
    method: 'GET',
    headers: {
      accept: '*/*',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const json = await res.json();
  if (json && json.success === false) {
    throw new Error(json.message || 'Request failed');
  }
  return json;
}

/* ═══════════════════════════════════════════════════════════════════
   1) FILTERS  — Module / User / Action dropdowns
   ═══════════════════════════════════════════════════════════════════ */
export function normalizeAuditFilters(json = {}) {
  const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];
  return {
    modules: uniq(json.modules),
    actions: uniq(json.actions),
    users: (json.users || [])
      .filter((u) => u && u.userName)
      .map((u) => ({
        id:    String(u.userID),
        name:  u.userName,
        role:  u.role || '',
        label: u.role ? `${u.userName} (${u.role})` : u.userName,
      })),
  };
}

export async function getAuditLogFilters(branchId = getBranchId(), opts = {}) {
  const json = await getJson(`/get-audit-log-filters/${branchId}`, opts);
  return normalizeAuditFilters(json);
}

/* ═══════════════════════════════════════════════════════════════════
   2) LOGS  — API row → shape used by AuditLogs.jsx / hydrateLog()
   ═══════════════════════════════════════════════════════════════════ */
const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
};

const pad = (n) => String(n).padStart(2, '0');

/* Candidate names for the row's date/time field. */
const DATE_KEYS = [
  'dateTime', 'createdAt', 'createdDate', 'createdOn', 'timestamp',
  'actionDate', 'logDate', 'activityDate', 'date',
];

function splitDateTime(row) {
  const raw = pick(row, DATE_KEYS);
  const d = raw ? new Date(raw) : null;
  if (d && !Number.isNaN(d.getTime())) {
    const h = d.getHours();
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`,
    };
  }
  return { date: '', time: row.time || '—' };
}

export function mapAuditLogRow(r, i = 0) {
  const { date, time } = splitDateTime(r);
  const module = pick(r, ['module', 'moduleName', 'entity']) || '—';
  return {
    id:          r.id ?? `al-${i}`,
    date,
    time,
    userId:      r.userName,
    userName:    r.userName,
    userRole:    r.role || '—',
    module,
    moduleLabel: module,
    screen:      pick(r, ['screen', 'screenName']) || '—',
    action:      r.action,
    actionLabel: r.action,
    record:      pick(r, ['record', 'recordName', 'recordId']) || r.action,
    /* Backend `details` only — `originalDetails` is intentionally ignored. */
    details:     r.details,
    performedBy: r.userName,
    oldValue:    r.oldValue || '—',
    newValue:    r.newValue || '—',
    ipAddress:   r.ipAddress,
    device:      r.device,
  };
}

/* "2026-10-22" → "2026-10-22T00:00:00" (from) / "…T23:59:59" (to) */
const asFrom = (d) => (d && d.length === 10 ? `${d}T00:00:00` : d);
const asTo   = (d) => (d && d.length === 10 ? `${d}T23:59:59` : d);

export async function getAuditLogsByBranch(
  { branchId = getBranchId(), pageNumber = 1, pageSize = 50,
    fromDate, toDate, module, userId, action, search } = {},
  opts = {},
) {
  const qs = buildQuery({
    pageNumber, pageSize,
    fromDate: asFrom(fromDate), toDate: asTo(toDate),
    module, userId, action, search,
  });
  const json = await getJson(`/get-audit-logs-by-branch/${branchId}${qs}`, opts);
  const s = json.stats || {};
  return {
    rows: (json.data || []).map(mapAuditLogRow),
    totalRecords: json.totalRecords ?? 0,
    stats: {
      today:       s.todayActivities ?? 0,
      week:        s.thisWeek ?? 0,
      month:       s.thisMonth ?? 0,
      total:       s.totalEntries ?? 0,
      activeToday: s.activeUsersToday ?? 0,
    },
  };
}