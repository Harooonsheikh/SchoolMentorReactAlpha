import { buildUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   ROLES SERVICE — User Permissions ▸ Roles tab

   Two endpoints:
     • GET  /get-roles-by-branch/{branchId}   → list branch roles
     • POST /save-role                         → create (id:0) / update (id>0)

   branchID / user id come from sessionStorage (same as the rest of the ERP).
   ═══════════════════════════════════════════════════════════════════ */

/* All roles configured for the current branch. Returns the raw `data`
   array from the API (see mapApiRole in UserPermissions for the card shape). */
export async function getRolesByBranch() {
  const token = sessionStorage.getItem('token');
  const branchID = sessionStorage.getItem('branchID');

  const response = await fetch(
    buildUrl(`/get-roles-by-branch/${branchID}`),
    {
      method: 'GET',
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json?.data || [];
}

/* Create or update a role. Payload shape expected by /save-role:
     { id, branchID, roleName, description, color, modules[], createdBy, modifiedBy }
   id === 0 → create, id > 0 → update.
   Body har haal me parse karo — backend success:false + message kabhi
   non-200 status ke saath aata hai, wo message toaster tak pahunchna chahiye. */
export async function saveRole(payload) {
  const token = sessionStorage.getItem('token');

  const response = await fetch(buildUrl('/save-role'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok && !json) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return json;
}

/* The role currently assigned to an employee → GET
   /get-user-role/{employeeId}/{branchId}. Returns the raw `data` (role row)
   or null. branchId sessionStorage se. */
export async function getUserRole(employeeId) {
  const token = sessionStorage.getItem('token');
  const branchID = sessionStorage.getItem('branchID');

  const response = await fetch(
    buildUrl(`/get-user-role/${employeeId}/${branchID}`),
    {
      method: 'GET',
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json?.data ?? null;
}

/* HR employee id → login user id, get-meeting-teachers/{branchId} ki
   { empid, userId } jodi se. Na mile to null. */
async function resolveLoginUserId(employeeId, branchId, headers) {
  try {
    const res = await fetch(buildUrl(`/get-meeting-teachers/${branchId}`), { headers });
    const json = await res.json().catch(() => null);
    const rows = Array.isArray(json) ? json : (json?.data || []);
    const hit = rows.find((r) => String(r.empid ?? r.empId ?? r.employeeId) === String(employeeId));
    return Number(hit?.userId) || null;
  } catch (_) {
    return null;
  }
}

/* Ek user ki SAVED menu permissions → [{ menuName, subMenuName, action, isAccessable }].
     GET /get-user-menu-permissions/{branchId}/{userId}
   Ye route LOGIN user id leta hai (UserID 213 → employeeID 78 ki row), is liye
   pehle login id nikalte hain: jo caller de (get-user-role ka UserID), warna
   get-meeting-teachers se. Jawab ka employeeID is employee se na mile to wo
   kisi aur ki row hai — use nahi lete. Kuch na mile to purana
   get-user-menu-permissions-by-branch raasta. */
export async function getUserMenuPermissions({ employeeId, loginUserId }) {
  const token = sessionStorage.getItem('token');
  const branchId = sessionStorage.getItem('branchID') || '1';
  const headers = { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const userId = Number(loginUserId) || await resolveLoginUserId(employeeId, branchId, headers);
  if (userId) {
    try {
      const res = await fetch(buildUrl(`/get-user-menu-permissions/${branchId}/${userId}`), { headers });
      const json = await res.json().catch(() => null);
      const data = json?.data;
      const sameEmployee = data?.employeeID == null || String(data.employeeID) === String(employeeId);
      if (res.ok && sameEmployee && Array.isArray(data?.permissions) && data.permissions.length) {
        return data.permissions;
      }
    } catch (_) { /* neeche by-branch par girte hain */ }
  }

  const res = await fetch(buildUrl(`/get-user-menu-permissions-by-branch/${branchId}`), { headers });
  const json = await res.json().catch(() => null);
  const entry = (json?.data || []).find((d) => String(d.employeeID) === String(employeeId));
  return entry?.permissions || [];
}

/* Delete a role → DELETE /delete-role/{id}.
   Body har haal me parse karo — role kisi user ko assigned ho to backend
   success:false + message deta hai (kabhi non-200 ke saath), aur wohi
   message toaster me dikhana hai. */
export async function deleteRole(id) {
  const token = sessionStorage.getItem('token');

  const response = await fetch(buildUrl(`/delete-role/${id}`), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await response.json().catch(() => null);
  if (!response.ok && !json) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return json;
}

/* Assign a role to a user (employee). Payload shape expected by
   /assign-role-to-user:
     { employeeID, roleID, branchID, createdBy } */
export async function assignRoleToUser(payload) {
  const token = sessionStorage.getItem('token');

  const response = await fetch(buildUrl('/assign-role-to-user'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok && !json) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return json;
}

/* Save a user's menu permissions → POST /save-user-menu-permissions.
   Payload: { branchID, employeeID, permissions[] }. Assign-role ke baad
   role ke modules ko user ki menu-permissions me sync karne ke liye. */
export async function saveUserMenuPermissions(payload) {
  const token = sessionStorage.getItem('token');

  const response = await fetch(buildUrl('/save-user-menu-permissions'), {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json().catch(() => null);
}

/* ── Activity (audit) logs ────────────────────────────────────────────
   GET /get-activity-logs-by-date-range/{branchId}/{fromDate}/{toDate}

   Pehle sirf /get-activity-logs-by-branch/{branchId} tha — wo poori branch
   ka saara record ek saath laata tha aur itna slow ho chuka hai ke request
   aksar timeout kar jati hai (server khud connection-pool khatam hone ki
   shikayat karta hai). Ab har call ek DATE RANGE par mehdood hai. */

/** Default range: aaj se `days` din pehle tak. Dono screens isi se khulti
    hain — bina range ke poori branch mangwana hi asal masla tha. */
export function logRangeLastDays(days = 30) {
  const p = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - Math.max(0, days - 1));
  return { from: iso(from), to: iso(to) };
}

/** UI ki 'yyyy-MM-dd' ko API ki 'dd-MM-yyyy' me badlo.
    API is par sakht hai — ghalat format par 400 aur saaf message:
    "Invalid fromDate. Use dd-MM-yyyy format." */
export function toApiLogDate(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);            // yyyy-MM-dd
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;                // pehle se dd-MM-yyyy
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Field ko har naming/casing shakal me dhoondo — API rows ki casing
    endpoint dar endpoint badalti rehti hai. */
function pickLogField(row, names, fallback = '') {
  if (!row || typeof row !== 'object') return fallback;
  const map = new Map(Object.keys(row).map((k) => [String(k).toLowerCase(), k]));
  for (const n of names) {
    const key = map.get(String(n).toLowerCase());
    if (key != null && row[key] != null && row[key] !== '') return row[key];
  }
  return fallback;
}

/** Ek API row → neutral shape. Audit Logs module aur User Permissions ka
    Audit tab dono isi se apni apni shakal banate hain, taake field-guessing
    ek hi jagah rahe. */
export function normalizeActivityLog(row, idx = 0) {
  const raw = pickLogField(row, [
    'createdDate', 'CreatedDate', 'date', 'Date', 'logDate', 'LogDate',
    'createdOn', 'CreatedOn', 'timestamp', 'Timestamp', 'activityDate', 'ActivityDate',
  ]);
  const d = raw ? new Date(raw) : null;
  const ok = d && Number.isFinite(d.getTime());
  const p = (n) => String(n).padStart(2, '0');
  return {
    id: pickLogField(row, ['id', 'ID', 'logID', 'LogID', 'activityLogId'], `al-${idx}`),
    /* 'yyyy-MM-dd' — Audit Logs ka filterLogs isi par string-compare karta hai. */
    dateISO: ok ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` : '',
    dateLabel: ok
      ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : String(pickLogField(row, ['dateStr', 'dateText'], raw || '')),
    time: String(pickLogField(row, ['time', 'Time', 'logTime', 'LogTime'],
      ok ? d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }) : '')),
    user: String(pickLogField(row, ['userName', 'UserName', 'user', 'User',
      'employeeName', 'EmployeeName', 'targetUser', 'TargetUser', 'accountName'], '—')),
    action: String(pickLogField(row, ['action', 'Action', 'actionType', 'ActionType',
      'activity', 'Activity', 'event', 'Event'], '—')),
    detail: String(pickLogField(row, ['detail', 'Detail', 'details', 'Details',
      'description', 'Description', 'message', 'Message', 'remarks', 'Remarks'], '')),
    performedBy: String(pickLogField(row, ['performedBy', 'PerformedBy', 'createdByName',
      'CreatedByName', 'createdBy', 'CreatedBy', 'actorName', 'ActorName', 'modifiedBy', 'ModifiedBy'], '—')),
    module: String(pickLogField(row, ['module', 'Module', 'moduleName', 'ModuleName',
      'menuName', 'MenuName'], '')),
    screen: String(pickLogField(row, ['screen', 'Screen', 'screenName', 'ScreenName',
      'subMenuName', 'SubMenuName', 'page', 'Page'], '')),
    record: String(pickLogField(row, ['record', 'Record', 'recordName', 'RecordName',
      'entity', 'Entity', 'reference', 'Reference'], '')),
    oldValue: String(pickLogField(row, ['oldValue', 'OldValue', 'previousValue', 'PreviousValue', 'before', 'Before'], '')),
    newValue: String(pickLogField(row, ['newValue', 'NewValue', 'currentValue', 'CurrentValue', 'after', 'After'], '')),
    ipAddress: String(pickLogField(row, ['ipAddress', 'IPAddress', 'ip', 'IP'], '')),
    device: String(pickLogField(row, ['device', 'Device', 'userAgent', 'UserAgent'], '')),
    _raw: row,
  };
}

/**
 * Ek date range ke activity logs.
 * @param {string} fromDate 'yyyy-MM-dd' (ya koi bhi parseable date)
 * @param {string} toDate   'yyyy-MM-dd'
 * @returns {Promise<Array>} normalizeActivityLog() se guzri hui rows
 */
export async function getActivityLogsByDateRange(fromDate, toDate) {
  const from = toApiLogDate(fromDate);
  const to = toApiLogDate(toDate);
  /* Range ke baghair call hi mat karo — warna wahi poori-branch wali slow
     query chal padti hai jis se bachne ke liye ye endpoint laaya gaya. */
  if (!from || !to) return [];

  const token = sessionStorage.getItem('token');
  const branchID = sessionStorage.getItem('branchID');
  const response = await fetch(
    buildUrl(`/get-activity-logs-by-date-range/${branchID}/${from}/${to}`),
    {
      method: 'GET',
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  const json = await response.json().catch(() => null);
  /* Galti par API 4xx/5xx ke sath { success:false, message } bhejti hai —
     wahi message aage do, warna user ko sirf "HTTP 500" nazar aata hai. */
  if (!response.ok || json?.success === false) {
    throw new Error(
      json?.message || json?.Message || `Could not load activity logs (HTTP ${response.status})`
    );
  }
  const rows = Array.isArray(json) ? json
    : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.Data) ? json.Data
        : [];
  return rows.map(normalizeActivityLog);
}
