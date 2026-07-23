import { buildUrl } from '../../utils/apiConfig';
import {
  mockWeeklyOff,
  mockHolidays,
  mockStudentAttendanceClasses,
  mockStaffAttendance,
} from '../mock/attendance';
import { delay, clone } from './_http';

export async function getWeeklyOff() {
  await delay();
  return clone(mockWeeklyOff);
}
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
// Active academic session ID for the branch — same API examination uses.
// Returns the active session's ID (row.ID), or 0 if none is active.
export async function getActiveSessionID() {
  const token = sessionStorage.getItem("token");
  const branchID = sessionStorage.getItem("branchID");

  const response = await fetch(
    buildUrl(`/api/Setting/get-academic-active-sessions-by-branch/${branchID}`),
    {
      method: "GET",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  const data = json?.data;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.ID || 0;
}

// Full active-session row (ID + SessionName + dates) for the branch.
export async function getActiveSession() {
  const token = sessionStorage.getItem("token");
  const branchID = sessionStorage.getItem("branchID");

  const response = await fetch(
    buildUrl(`/api/Setting/get-academic-active-sessions-by-branch/${branchID}`),
    { method: "GET", headers: { Accept: "*/*", Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  const data = json?.data;
  return (Array.isArray(data) ? data[0] : data) || null;
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
    logo: d.branchLogo || "",
    address: d.address || "",
    session: d.academicSession || "",
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
export async function getHolidays() {
  await delay();
  return clone(mockHolidays);
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

export async function getStudentAttendance(month) {
  await delay();
  return clone(mockStudentAttendanceClasses);
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

export async function getStaffAttendance(month) {
  await delay();
  return clone(mockStaffAttendance);
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
