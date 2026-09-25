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

/* ── Log ka waqt ──
   API `timestamp` bina timezone ke bhejti hai ("2026-09-24T05:54:27") aur ye
   SERVER ka local waqt hai — server US Pacific (PDT/PST) par chalta hai.
   Tasdeeq: 24-09 ko 12:54 UTC (5:54 PM PKT) par sab se nayi row "05:54" thi.
   new Date() ise user (Pakistan) ka waqt samajhta tha — dono me theek 12
   ghante ka farq, is liye AM wala PM aur PM wala AM dikhta tha.
   Is liye: timezone-less string ko Pacific wall-clock maan kar asal lamha
   nikalo; DST (−7/−8) Intl khud sambhalta hai. 'Z' / +05:00 wali string
   jaisi hai waisi. */
const SERVER_TIME_ZONE = 'America/Los_Angeles';

/** `timeZone` ka UTC se farq (ms) us lamhe par. */
function tzOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - Math.floor(utcMs / 1000) * 1000;
}

export function parseServerTimestamp(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/);
  if (!m) return new Date(s);                       // timezone wali ya koi aur shakal
  const [, y, mo, da, h, mi, se = '0', frac = '0'] = m;
  const wall = Date.UTC(+y, +mo - 1, +da, +h, +mi, +se, Math.round(Number(`0.${frac}`) * 1000));
  try {
    /* Do dafa — DST badalne wale din pehla andaza ek ghanta hil sakta hai. */
    let utc = wall - tzOffsetMs(wall, SERVER_TIME_ZONE);
    utc = wall - tzOffsetMs(utc, SERVER_TIME_ZONE);
    return new Date(utc);
  } catch (_) {
    return new Date(s);                             // Intl timezone support na ho
  }
}

/* ── Log row → ERP ki screen ──
   API koi screen field nahi bhejti — sirf backend ka `module` (controller
   ka naam, jaise "AcademicCalendar", "AccountsController") aur `action`
   (method, jaise "StaffAttendance:get"). In dono se ERP sidebar ka naam
   aur us ke andar ki screen banate hain: "Attendance › Staff Attendance".
   Har module ke rules upar se neeche — pehla milne wala regex jeet-ta hai. */
const ERP_SCREEN_RULES = {
  academics:          ['Academics', [[/subject/i, 'Subjects'], [/student/i, 'Class & Section List']]],
  academiccalendar:   ['Academics', [[/./, 'Academic Calendar']]],
  activitycalendar:   ['Academics', [[/./, 'Activity Calendar']]],
  assignhomework:     ['Academics', [[/./, 'Homework']]],
  lessonplan:         ['Academics', [[/termbreakup/i, 'Term Breakup'], [/countforsubject/i, 'Subject Counts'],
                        [/session/i, 'Session Summary'], [/./, 'Lesson Plans']]],
  noticeboard:        ['Academics', [[/./, 'Notice Board']]],
  examination:        ['Examination', [[/grading/i, 'Result Grading'], [/ranking/i, 'Student Rankings'],
                        [/visibility/i, 'Result Visibility'], [/result/i, 'Results'],
                        [/syllabus/i, 'Syllabus'], [/terms/i, 'Terms'], [/exam/i, 'Exams']]],
  attendance:         ['Attendance', [[/staff/i, 'Staff Attendance'], [/student/i, 'Student Attendance'],
                        [/weekly/i, 'Weekly Setup'], [/monthly/i, 'Monthly Setup']]],
  leaves:             ['Attendance', [[/student/i, 'Student Leaves'], [/./, 'Staff Leaves']]],
  timetable:          ['Timetable', []],
  accounts:           ['Accounts', [[/entr/i, 'Account Entries'], [/./, 'Chart of Accounts']]],
  accountscontroller: ['Accounts', [[/entr/i, 'Account Entries'], [/./, 'Chart of Accounts']]],
  branchledger:       ['Accounts', [[/./, 'Branch Ledger']]],
  feechallansettings: ['Fee', [[/./, 'Challan Settings']]],
  transportfeesetup:  ['Fee', [[/./, 'Transport Fee Setup']]],
  students:           ['Students', [[/discount/i, 'Fee Discounts']]],
  familytree:         ['Students', [[/./, 'Family Tree']]],
  'pre-enrollment':   ['Admission CRM', [[/./, 'Pre Enrollment']]],
  hr:                 ['Human Resource', []],
  'launch-setup':     ['Launch Setup', [[/fee/i, 'Fee Heads'], [/subject/i, 'Subjects'], [/department/i, 'Departments'],
                        [/employee/i, 'Employees'], [/student/i, 'Students'], [/grade/i, 'Classes']]],
  settings:           ['Settings', [[/signature/i, 'Signatures'], [/session/i, 'Academic Sessions']]],
  registration:       ['Settings', [[/./, 'School Profile']]],
  userpermissions:    ['User Permissions', [[/activitylog/i, 'Audit Logs'], [/role/i, 'Roles'],
                        [/mobileapp/i, 'Mobile App Permissions'], [/timespend/i, 'Time Tracking']]],
  dashboard:          ['Dashboard', []],
  notification:       ['Notifications', []],
  suggestion:         ['Suggestions', []],
  supportsessions:    ['Support', [[/./, 'Support Sessions']]],
  shared:             ['Reports', [[/./, 'Report Header']]],
  googleplay:         ['Mobile App', [[/./, 'App Version']]],
};

/** "Module › Screen" — module pehchana na jaye to backend ka naam hi
    padhne layak bana kar ("SomeThing" → "Some Thing"). */
export function resolveErpScreen(module, action) {
  const key = String(module || '').trim().toLowerCase();
  if (!key) return '';
  const rule = ERP_SCREEN_RULES[key];
  if (!rule) {
    return String(module).replace(/Controller$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  }
  const [erpModule, screens] = rule;
  const hit = screens.find(([re]) => re.test(String(action || '')));
  return hit ? `${erpModule} › ${hit[1]}` : erpModule;
}

/** Ek API row → neutral shape. Audit Logs module aur User Permissions ka
    Audit tab dono isi se apni apni shakal banate hain, taake field-guessing
    ek hi jagah rahe. */
export function normalizeActivityLog(row, idx = 0) {
  const raw = pickLogField(row, [
    'createdDate', 'CreatedDate', 'date', 'Date', 'logDate', 'LogDate',
    'createdOn', 'CreatedOn', 'timestamp', 'Timestamp', 'activityDate', 'ActivityDate',
  ]);
  const d = raw ? parseServerTimestamp(raw) : null;
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
    /* userName kai rows me null aata hai (jaise userID 1) — tab "User ID 1". */
    user: String(pickLogField(row, ['userName', 'UserName', 'user', 'User',
      'employeeName', 'EmployeeName', 'targetUser', 'TargetUser', 'accountName'], '')
      || (pickLogField(row, ['userID', 'UserID', 'userId'], '') ? `User ID ${pickLogField(row, ['userID', 'UserID', 'userId'], '')}` : '—')),
    action: String(pickLogField(row, ['action', 'Action', 'actionType', 'ActionType',
      'activity', 'Activity', 'event', 'Event'], '—')),
    detail: String(pickLogField(row, ['detail', 'Detail', 'details', 'Details',
      'description', 'Description', 'message', 'Message', 'remarks', 'Remarks'], '')),
    /* API alag performedBy nahi bhejti — log ki row us user ki hai jis ne
       kaam kiya (userName). Naam null ho to kam az kam "User ID 206". */
    performedBy: String(pickLogField(row, ['performedBy', 'PerformedBy', 'createdByName',
      'CreatedByName', 'actorName', 'ActorName', 'userName', 'UserName'], '')
      || (pickLogField(row, ['userID', 'UserID', 'userId'], '') ? `User ID ${pickLogField(row, ['userID', 'UserID', 'userId'], '')}` : '—')),
    module: String(pickLogField(row, ['module', 'Module', 'moduleName', 'ModuleName',
      'menuName', 'MenuName'], '')),
    screen: String(pickLogField(row, ['screen', 'Screen', 'screenName', 'ScreenName',
      'subMenuName', 'SubMenuName', 'page', 'Page'], ''))
      || resolveErpScreen(
        pickLogField(row, ['module', 'Module', 'moduleName', 'ModuleName'], ''),
        pickLogField(row, ['action', 'Action', 'actionType', 'ActionType'], ''),
      ),
    /* `role` ab API bhejti hai (Accountant, Parent…); purani rows par null. */
    role: String(pickLogField(row, ['role', 'Role', 'roleName', 'RoleName', 'userRole', 'UserRole'], '')),
    /* API alag record field nahi bhejti — `result` ("INSERT completed
       successfully", "Employees retrieved successfully") hi record hai. */
    record: String(pickLogField(row, ['record', 'Record', 'recordName', 'RecordName',
      'entity', 'Entity', 'reference', 'Reference', 'result', 'Result'], '')),
    oldValue: String(pickLogField(row, ['oldValue', 'OldValue', 'previousValue', 'PreviousValue', 'before', 'Before'], '')),
    newValue: String(pickLogField(row, ['newValue', 'NewValue', 'currentValue', 'CurrentValue', 'after', 'After'], '')),
    ipAddress: String(pickLogField(row, ['ipAddress', 'IPAddress', 'ip', 'IP'], '')),
    device: String(pickLogField(row, ['device', 'Device', 'userAgent', 'UserAgent'], '')),
    _raw: row,
  };
}

/* ── Streaming JSON reader ──
   Jawab ki shakal: { success, message, count, …, data: [ {row}, {row}, … ] }.
   Poora jawab 7–26 MB hai aur server use ~70 KB/s par bhejta hai (pehla
   byte 2–4s me aa jaata hai, baqi minton me). Poore ka intezar karein to
   screen minton khaali rehti hai — is liye `data` array ki har row jaise hi
   poori utarti hai, parse karke aage de dete hain. */
function createRowStreamParser(onRow) {
  let buf = '';
  let inData = false;
  let head = '';          // `data` se pehle ka hissa — error jawab ke liye
  let done = false;

  /* buf[start] === '{' — matching '}' ka index, ya -1 agar abhi adhoora. */
  const objectEnd = (start) => {
    let depth = 0;
    let inStr = false;
    for (let i = start; i < buf.length; i++) {
      const c = buf.charCodeAt(i);
      if (inStr) {
        if (c === 92) i++;               // backslash — agla char escape
        else if (c === 34) inStr = false; // "
      } else if (c === 34) inStr = true;
      else if (c === 123) depth++;        // {
      else if (c === 125 && --depth === 0) return i;  // }
    }
    return -1;
  };

  return {
    push(text) {
      if (done) return;
      buf += text;
      if (!inData) {
        const m = buf.match(/"data"\s*:\s*\[/i);
        if (!m) { head = buf; return; }
        head = buf.slice(0, m.index);
        buf = buf.slice(m.index + m[0].length);
        inData = true;
      }
      let pos = 0;
      for (;;) {
        while (pos < buf.length && /[\s,]/.test(buf[pos])) pos++;
        if (pos >= buf.length) break;
        if (buf[pos] === ']') { done = true; break; }
        if (buf[pos] !== '{') { pos++; continue; }
        const end = objectEnd(pos);
        if (end < 0) break;               // row abhi adhoori — agle chunk ka intezar
        try { onRow(JSON.parse(buf.slice(pos, end + 1))); } catch (_) { /* kharab row chhor do */ }
        pos = end + 1;
      }
      buf = buf.slice(pos);
    },
    /** Stream khatam — `data` mila hi nahi to poora jawab (error waghera). */
    finish() {
      if (inData) return null;
      try { return JSON.parse(head || buf); } catch (_) { return null; }
    },
  };
}

/**
 * Ek date range ke activity logs — STREAMING.
 * @param {string} fromDate 'yyyy-MM-dd' (ya koi bhi parseable date)
 * @param {string} toDate   'yyyy-MM-dd'
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]  range badle / screen band → download band
 * @param {(rows:Array)=>void} [opts.onRows]  rows ke batch jaise hi utrein
 *        (normalizeActivityLog() se guzri hui) — screen foran bharti hai
 * @param {number} [opts.stallMs]  itni der koi byte na aaye to nakaam
 * @returns {Promise<Array>} saari rows (normalizeActivityLog() shakal)
 */
export async function getActivityLogsByDateRange(fromDate, toDate, { signal, onRows, stallMs = 60000 } = {}) {
  const from = toApiLogDate(fromDate);
  const to = toApiLogDate(toDate);
  /* Range ke baghair call hi mat karo — warna wahi poori-branch wali slow
     query chal padti hai jis se bachne ke liye ye endpoint laaya gaya. */
  if (!from || !to) return [];

  /* Server din bhi APNE (US Pacific) waqt se kaat-ta hai. Pakistan ka din
     server ke do dino me bat jaata hai — PKT subah (school ka waqt) server
     ki PICHLI tareekh hai. Is liye server se ek din pehle se mangwao, aur
     rows ko user ke local din se chhaant kar sirf chuni hui range rakho. */
  const fromIso = from.split('-').reverse().join('-');     // dd-MM-yyyy → yyyy-MM-dd
  const toIso = to.split('-').reverse().join('-');
  const prev = new Date(`${fromIso}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const serverFrom = toApiLogDate(prev.toISOString().slice(0, 10));
  const inRange = (row) => !row.dateISO || (row.dateISO >= fromIso && row.dateISO <= toIso);

  /* Kul waqt ki hadd NAHI (aaj ka din hi ~100s leta hai) — sirf "atak
     gaya" ki hadd: `stallMs` tak ek byte bhi na aaye to band. */
  const ctrl = new AbortController();
  let stalled = false;
  let timer = null;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { stalled = true; ctrl.abort(); }, stallMs);
  };
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const all = [];
  let pending = [];
  let lastFlush = 0;
  const flush = (force = false) => {
    if (!pending.length || !onRows) return;
    const now = Date.now();
    if (!force && now - lastFlush < 400) return;   // har row par re-render nahi
    lastFlush = now;
    const batch = pending;
    pending = [];
    onRows(batch);
  };
  const parser = createRowStreamParser((raw) => {
    const row = normalizeActivityLog(raw, all.length);
    if (!inRange(row)) return;
    all.push(row);
    pending.push(row);
  });

  const token = sessionStorage.getItem('token');
  const branchID = sessionStorage.getItem('branchID');
  try {
    arm();
    const response = await fetch(
      buildUrl(`/get-activity-logs-by-date-range/${branchID}/${serverFrom}/${to}`),
      {
        method: 'GET',
        signal: ctrl.signal,
        headers: {
          Accept: '*/*',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        arm();
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
        flush();
      }
      parser.push(decoder.decode());
    } else {
      parser.push(await response.text());   // purane browser — stream nahi
    }
    flush(true);

    /* `data` array mila hi nahi → ye error jawab tha ({ success:false, message }).
       Wahi message aage do, warna user ko sirf "HTTP 500" nazar aata hai. */
    const json = parser.finish();
    if (!response.ok || json?.success === false) {
      throw new Error(
        json?.message || json?.Message || `Could not load activity logs (HTTP ${response.status})`
      );
    }
    return all;
  } catch (err) {
    if (stalled) {
      throw new Error('The server stopped responding while loading activity logs. Please try again or choose a shorter date range.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}
