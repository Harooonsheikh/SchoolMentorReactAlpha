import { buildUrl, resolveMediaUrl, activeSessionName, readStoredActiveSession } from '../../utils/apiConfig';
import { delay, clone } from './_http';
import { DEFAULT_ATTENDANCE_SETUP, isGeofenceConfigured } from '../utils/attendanceRules';

// src/services/attendanceService.js

export async function getWeeklyOffSetup() {
  const token = sessionStorage.getItem("token");
  const branchID = Number(sessionStorage.getItem("branchID"));

  const response = await fetch(buildUrl("/api/attendance-weekly-setup"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: 0,
      weekDay: "",
      branchID: branchID,
      holiday: true,
      action: "get",
      createdBy: 0,
      createdAt: "",
      modifiedBy: 0,
      modifiedAt: ""
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
// src/services/attendanceService.js
export async function deleteWeeklyOff(payload) {
  const token = sessionStorage.getItem("token");

  const response = await fetch(buildUrl("/api/attendance-weekly-setup"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
export async function saveWeeklyOff(payload) {
  const token = sessionStorage.getItem("token");

  const response = await fetch(buildUrl("/api/attendance-weekly-setup"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return await response.json();
}
// Active academic session ID — stored at login (and refreshed when a session
// is saved). Does not call the API again.
export async function getActiveSessionID() {
  const row = readStoredActiveSession();
  return Number(row?.ID ?? row?.id ?? sessionStorage.getItem('sessionID')) || 0;
}

// Full active-session row (ID + SessionName + dates) from the login snapshot.
export async function getActiveSession() {
  return readStoredActiveSession();
}

// All academic sessions for the branch (for the session dropdown).
export async function getSessionsForBranch() {
  const token = sessionStorage.getItem("token");
  const branchID = sessionStorage.getItem("branchID");

  const response = await fetch(
    buildUrl(`/api/Setting/get-academic-sessions-by-branch/${branchID}`),
    { method: "GET", headers: { Accept: "*/*", Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json?.data || [];
}

// Branch header (name / logo / address / academic session) for report headers.
// Same /report-header API the Examination reports use.
export async function getReportHeader() {
  const branchID = sessionStorage.getItem("branchID");

  const response = await fetch(buildUrl(`/report-header/${branchID}`), {
    headers: { Accept: "*/*" },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  const d = json?.data || {};
  return {
    name: d.branchName || "",
    logo: resolveMediaUrl(d.branchLogo),
    address: d.address || "",
    /* The ERP's own active session wins over the branch header's
       `academicSession` string: the header is a branch-profile field that is
       not updated when the school rolls over to a new session (or when the
       user switches sessions), so trusting it first is how a report ends up
       stamped with last year's session. */
    session: activeSessionName() || d.academicSession || "",
  };
}

// Classes + sections list for the current branch (used by the Holiday modal).
// Returns a FLAT list — one entry per class+section pair.
export async function getClassesForBranch() {
  const token = sessionStorage.getItem("token");
  const branchID = sessionStorage.getItem("branchID");
  const empID = sessionStorage.getItem("employee_ID");

  const response = await fetch(
    buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${branchID}/${empID}`),
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const grades = data?.data || [];

  const flat = [];
  grades.forEach((grade) => {
    (grade.sections || []).forEach((sec) => {
      flat.push({
        classID: grade.id,
        sectionID: sec.sectionID,
        className: grade.name,
        sectionName: sec.sectionName,
        label: `${grade.name} - ${sec.sectionName}`,
      });
    });
  });

  return flat;
}

// Generic monthly-holiday setup endpoint → /api/attendance-monthly-setup
// One endpoint for every operation; only `action` changes:
//   get · insert · update · delete
export async function monthlySetup(payload) {
  const token = sessionStorage.getItem("token");

  const response = await fetch(buildUrl("/api/attendance-monthly-setup"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
// attendanceService.js

// ✅ Staff Attendance Update/Get ke liye function
export async function staffAttendance(payload) {
  const token = sessionStorage.getItem("token");

  const response = await fetch(buildUrl("/api/staff-attendance"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

/* ── Previous Days Attendance setting ──
   POST /api/settings-approvals-previous-days-attendance
   action "save" → persist { branchID, previousDaysAttendance } in DB.
   action "get"  → return the stored value for this branch.
   Controls whether the user can mark/edit attendance for PAST dates. */
/* Recursively find the first value whose KEY matches `keyRe`, at any depth,
   through objects and arrays — so the flag is found no matter how the API
   nests/cases it (root, data{}, data[0], etc.). */
function deepFindFlag(node, keyRe, depth = 0) {
  if (node == null || depth > 6) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const v = deepFindFlag(item, keyRe, depth + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  if (typeof node === "object") {
    for (const [k, val] of Object.entries(node)) {
      if (keyRe.test(k)) return val;
    }
    for (const val of Object.values(node)) {
      const v = deepFindFlag(val, keyRe, depth + 1);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

export async function getPreviousDaysAttendance() {
  const token = sessionStorage.getItem("token");
  const branchID = Number(sessionStorage.getItem("branchID")) || 0;
  const response = await fetch(buildUrl("/api/settings-approvals-previous-days-attendance"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "*/*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "get", branchID }),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const json = await response.json().catch(() => null);
  /* Deep-search the response for the previousDaysAttendance flag regardless of
     casing / nesting (root, data{}, data[0], deeper) — the GET returns it as
     e.g. PreviousDaysAttendance inside data[]. Accept bool / "true" / 1. */
  const raw = deepFindFlag(json, /^previous[_\s]?days[_\s]?attendance$/i);
  return raw === true || raw === 1 || raw === "1" || String(raw).toLowerCase() === "true";
}

export async function savePreviousDaysAttendance(previousDaysAttendance) {
  const token = sessionStorage.getItem("token");
  const branchID = Number(sessionStorage.getItem("branchID")) || 0;
  const response = await fetch(buildUrl("/api/settings-approvals-previous-days-attendance"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "*/*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "save", branchID, previousDaysAttendance: !!previousDaysAttendance }),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json().catch(() => ({}));
}

export async function createHoliday(payload) {
  await delay();
  return clone({ ...payload, id: Date.now() });
}

export async function updateHoliday(id, payload) {
  await delay();
  return clone({ ...payload, id });
}

export async function deleteHoliday(id) {
  await delay();
  return { id, deleted: true };
}


// Real class → section → student list for the branch.
// Flattens each grade×section into one row with its student roster
// (shape matches what the Student Attendance table + mark modal expect).
export async function getClassStudentList() {
  const token = sessionStorage.getItem("token");
  const branchID = sessionStorage.getItem("branchID");

  const response = await fetch(
    buildUrl(`/api/LaunchSetup/get-class-section-studentlist-by-branch/${branchID}`),
    { method: "GET", headers: { Accept: "*/*", Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  const grades = json?.data || [];

  const rows = [];
  grades.forEach((grade) => {
    (grade.sections || []).forEach((section) => {
      const students = (section.students || []).map((st, j) => ({
        idx: j + 1,
        id: st.id,
        reg: st.registerNo || "—",
        name: `${st.firstName || ""} ${st.lastName || ""}`.trim() || "—",
        father: st.fatherName || "—",
      }));
      rows.push({
        classID: grade.id,
        sectionID: section.sectionID,
        cls: grade.name,
        sec: section.sectionName,
        teacher: "—", // not provided by this API
        total: students.length,
        marked: false,
        present: 0, absent: 0, leave: 0,
        students,
      });
    });
  });

  return rows;
}


// All employees for the branch (with class/section assignments).
// Used for Staff Attendance rows + Student Attendance class-teacher lookup.
export async function getEmployeesByBranch(isActive) {
  const token = sessionStorage.getItem("token");
  const branchID = sessionStorage.getItem("branchID");

  /* Bina param → default (active) list, boolean do to ?isActive= filter. */
  const qs = typeof isActive === "boolean" ? `?isActive=${isActive}` : "";
  const response = await fetch(
    buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchID}${qs}`),
    { method: "GET", headers: { Accept: "*/*", Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json?.data || [];
}

// Student attendance endpoint → /api/student-attendance
// Same endpoint for every op; only `action` changes: get · insert.
export async function studentAttendance(payload) {
  const token = sessionStorage.getItem("token");

  const response = await fetch(buildUrl("/api/student-attendance"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

export async function markStudentAttendance(classId, records) {
  await delay();
  return { classId, marked: records.length };
}

export async function markStaffAttendance(records) {
  await delay();
  return { marked: records.length };
}

/* ─── Attendance Setup — Working Hours & Attendance Rules + Geofence ──
   The one combined `setup` object the Attendance Setup tab reads/writes
   maps onto THREE real per-branch backend endpoints, each an
   action-driven CRUD row (actions: Get / Insert / Update / Delete,
   case-insensitive):

     Staff Working Hours & Rules   → POST /api/staff-attendance-rules     (MdlAHM_AttendanceRules)
     Student Working Hours & Rules → POST /api/student-attendance-rules   (same model)
     Geo-fenced Attendance         → POST /api/geo-fenced-attendance      (MdlAHM_Geo_Fenced_Attendance)

   The rules model is one flat row per branch:
     attendanceRules(bool) · trackingType · startTime · endTime ·
     attendanceStart · normalTimeIn · lateAfter · shortLeaver · timeOut
   GET returns it inside data[0] in PascalCase (AttendanceRules, StartTime …),
   times as "HH:MM"; 404 when the branch has none yet (→ seed defaults).

   The geofence model has NO "enabled" flag and NO location-name column —
   only latitude/longitude/geofenceRadius/maximumGPSAccuracy. So
   `geofenceEnabled` is derived on load from whether usable coordinates
   exist (isGeofenceConfigured), and `schoolLocationName` is a local-only
   label that does not round-trip (stays blank after a reload). */

const STAFF_RULES_URL   = "/api/staff-attendance-rules";
const STUDENT_RULES_URL = "/api/student-attendance-rules";
const GEOFENCE_URL      = "/api/geo-fenced-attendance";

/* combined-setup field  ←→  API field, per audience. Staff and student
   rules are the SAME API model; only which combined keys feed it differ. */
const STAFF_MAP = {
  enabled: 'isEnabled', tracking: 'staffTrackingMode',
  start: 'schoolStartTime', end: 'schoolEndTime', attStart: 'attendanceStartTime',
  normal: 'normalTimeInUntil', late: 'lateAfter', short: 'shortLeaveFrom', out: 'fullDayTimeOut',
};
const STUDENT_MAP = {
  enabled: 'studentRulesEnabled', tracking: 'studentTrackingMode',
  start: 'studentSchoolStartTime', end: 'studentSchoolEndTime', attStart: 'studentAttendanceStartTime',
  normal: 'studentNormalTimeInUntil', late: 'studentLateAfter', short: 'studentShortLeaveFrom', out: 'studentFullDayTimeOut',
};

/* One POST to an action-driven config endpoint. Never throws — returns
   { ok, status, json } so callers can tell 404 "none yet" (ok:false) from
   a real success, and a network blip just reads as ok:false. */
async function callConfig(url, body) {
  try {
    const token = sessionStorage.getItem("token");
    const res = await fetch(buildUrl(url), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "*/*", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

const branchID = () => Number(sessionStorage.getItem("branchID")) || 0;
const actorID  = () => Number(sessionStorage.getItem("employee_ID")) || 0;

/* The stored row — data[0] — of a successful config response, else null. */
const rowOf = (json) => (json && json.success && Array.isArray(json.data) ? json.data[0] : null) || null;
/* Case-insensitive key read (API returns PascalCase, e.g. StartTime). */
const ci = (row, name) => {
  if (!row || typeof row !== "object") return undefined;
  const hit = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
  return hit ? row[hit] : undefined;
};
/* "HH:MM" for <input type=time>; trims a seconds suffix, falls back when absent. */
const normTime = (v, fallback) => (typeof v === "string" && v.includes(":") ? v.slice(0, 5) : fallback);
const asBool = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";

/* One rules endpoint's GET response → the combined-setup slice for that
   audience. Missing row (404 / brand-new branch) → {} so the defaults in
   getAttendanceSetup's spread stand. */
function parseRules(json, map, d) {
  const row = rowOf(json);
  if (!row) return {};
  return {
    [map.enabled]:  asBool(ci(row, "attendanceRules")),
    [map.tracking]: String(ci(row, "trackingType") ?? "").toLowerCase() === "in_only" ? "in_only" : "in_out",
    [map.start]:    normTime(ci(row, "startTime"),       d[map.start]),
    [map.end]:      normTime(ci(row, "endTime"),         d[map.end]),
    [map.attStart]: normTime(ci(row, "attendanceStart"), d[map.attStart]),
    [map.normal]:   normTime(ci(row, "normalTimeIn"),    d[map.normal]),
    [map.late]:     normTime(ci(row, "lateAfter"),       d[map.late]),
    [map.short]:    normTime(ci(row, "shortLeaver"),     d[map.short]),
    [map.out]:      normTime(ci(row, "timeOut"),         d[map.out]),
  };
}

/* Geofence GET response → combined-setup geofence slice. `geofenceEnabled`
   is inferred from usable coordinates (no backend flag). */
function parseGeofence(json, d) {
  const row = rowOf(json);
  if (!row) return {};
  const lat = ci(row, "latitude"), lng = ci(row, "longitude");
  const radius = Number(ci(row, "geofenceRadius")), acc = Number(ci(row, "maximumGPSAccuracy"));
  const latOk = lat != null && lat !== "" && Number.isFinite(Number(lat));
  const lngOk = lng != null && lng !== "" && Number.isFinite(Number(lng));
  const radOk = Number.isFinite(radius) && radius > 0;
  return {
    latitude:  latOk ? String(lat) : null,
    longitude: lngOk ? String(lng) : null,
    geofenceRadiusMeters: radOk ? radius : d.geofenceRadiusMeters,
    maxAccuracyMeters: Number.isFinite(acc) && acc > 0 ? acc : d.maxAccuracyMeters,
    geofenceEnabled: latOk && lngOk && radOk,
    schoolLocationName: '',
  };
}

/* combined-setup → a rules request body (action added by the caller). */
function rulesBody(setup, map) {
  const uid = actorID();
  return {
    branchID: branchID(),
    attendanceRules: !!setup[map.enabled],
    trackingType: setup[map.tracking] || "in_out",
    startTime:       setup[map.start]    || "",
    endTime:         setup[map.end]      || "",
    attendanceStart: setup[map.attStart] || "",
    normalTimeIn:    setup[map.normal]   || "",
    lateAfter:       setup[map.late]     || "",
    shortLeaver:     setup[map.short]    || "",
    timeOut:         setup[map.out]      || "",
    createdBy: uid, modifiedBy: uid,
  };
}

/* combined-setup → a geofence request body (action added by the caller). */
function geofenceBody(setup) {
  const uid = actorID();
  const num = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    branchID: branchID(),
    latitude:  setup.latitude  == null || setup.latitude  === "" ? "" : String(setup.latitude),
    longitude: setup.longitude == null || setup.longitude === "" ? "" : String(setup.longitude),
    geofenceRadius: num(setup.geofenceRadiusMeters),
    maximumGPSAccuracy: num(setup.maxAccuracyMeters),
    createdBy: uid, modifiedBy: uid,
  };
}

/* Upsert: the backend rejects Insert when a row already exists and Update
   when none does, so a quick Get decides which to send. */
async function upsertConfig(url, body) {
  const exists = (await callConfig(url, { action: "Get", branchID: body.branchID })).ok;
  const res = await callConfig(url, { ...body, action: exists ? "Update" : "Insert" });
  if (!res.ok) throw new Error(res.json?.message || `HTTP error! status: ${res.status}`);
  return res.json;
}

export async function getAttendanceSetup() {
  const d = DEFAULT_ATTENDANCE_SETUP;
  const get = { action: "Get", branchID: branchID() };
  const [staff, student, geo] = await Promise.all([
    callConfig(STAFF_RULES_URL, get),
    callConfig(STUDENT_RULES_URL, get),
    callConfig(GEOFENCE_URL, get),
  ]);
  return {
    ...d,
    ...parseRules(staff.json, STAFF_MAP, d),
    ...parseRules(student.json, STUDENT_MAP, d),
    ...parseGeofence(geo.json, d),
    /* Always-on: the Attendance Setup enable/disable toggles were removed, so
       all three sections are treated as enabled regardless of any stored flag.
       (The stored times/coords are still read above — only the on/off state is
       forced on.) */
    isEnabled: true,
    studentRulesEnabled: true,
    geofenceEnabled: true,
  };
}

export async function saveAttendanceSetup(setup) {
  const tasks = [
    upsertConfig(STAFF_RULES_URL, rulesBody(setup, STAFF_MAP)),
    upsertConfig(STUDENT_RULES_URL, rulesBody(setup, STUDENT_MAP)),
  ];
  /* Only touch the geofence row when there is something real to store —
     the backend has no "disabled" state, so an unconfigured geofence is
     simply left absent rather than written as an empty row. */
  if (setup.geofenceEnabled || isGeofenceConfigured(setup)) {
    tasks.push(upsertConfig(GEOFENCE_URL, geofenceBody(setup)));
  }
  await Promise.all(tasks);
  /* Echo the saved draft back so the screen keeps exactly what was set,
     including the two local-only fields the backend has no column for. */
  return clone(setup);
}

/* Per-section saves — each Attendance Setup card has its own Save button and
   persists ONLY its own endpoint, so saving Staff never rewrites the Student
   or Geofence rows (and vice versa). Each takes the full combined draft and
   sends just its slice. */
export async function saveStaffAttendanceRules(setup) {
  await upsertConfig(STAFF_RULES_URL, rulesBody(setup, STAFF_MAP));
  return clone(setup);
}
export async function saveStudentAttendanceRules(setup) {
  await upsertConfig(STUDENT_RULES_URL, rulesBody(setup, STUDENT_MAP));
  return clone(setup);
}
export async function saveGeofenceAttendance(setup) {
  await upsertConfig(GEOFENCE_URL, geofenceBody(setup));
  return clone(setup);
}
