/* ═══════════════════════════════════════════════════════════════════
   HR Annual Leave Summary & Individual Statement — computation service.

   Reuses, never duplicates:
   - mockHrEmployees' own `leaves` object (mock/hr.js) for entitlement
     (`leaves.annual`) AND the existing deduction configuration
     (`leaves.deductEn`, `leaves.absentDed`) — see the honest mapping
     note below, nothing new is added to the employee model.
   - mockStaffLeaveApplications / mockStaffAttendanceHistory
     (mock/staffLeaveAbsenteeism.js) — the SAME dataset the Staff Leave
     & Absenteeism report (Attendance module) already uses. That file's
     date range was widened (not duplicated into a second dataset) to
     also cover the real academic session this report must scope to —
     see its own header comment.
   - fullName/deptName/desigName/overlaps/activeEmployees/
     scheduledWorkingDays/classify from staffLeaveAbsenteeismService.js
     — exported from there specifically so this file doesn't reimplement
     them.
   - Session start/end dates come from the real Settings module
     (src/pages/Settings/settingsStore.js's useSettings()/currentSession)
     — passed into every function below as plain {sessionStart,
     sessionEnd} strings so this file stays decoupled from React context
     itself (the UI layer reads useSettings() and passes the dates in).

   HONEST FIELD-MAPPING NOTE (confirmed by inspecting PayRollModal in
   HumanResource.jsx before writing this): the employee's existing
   `leaves.absentDed` / `leaves.unpaidDed` fields are real, but neither
   is actually "a deduction rate per excess annual leave day" in the
   codebase today — PayRollModal applies `absentDed` x a manually-typed
   monthly "leave count" and `unpaidDed` x a manually-typed monthly
   "absent count", with zero link to `leaves.annual`/entitlement, and
   `deductEn` is displayed but never actually gates that calculation.
   There is no "excess leave" concept anywhere before this feature.
   This report reuses the EXISTING `absentDed` field as its "deduction
   rate per excess annual leave day" (its on-screen label is "Deduction
   of one day", its typical configured value of PKR 100 matches this
   brief's own worked example exactly — PKR 100 x 5 excess days = PKR
   500), and DOES properly gate on `deductEn` (unlike the existing
   payroll calculation) since this brief explicitly asks for that. This
   is a new, additive calculation built on the existing configured
   rate — not a new deduction field, and not a change to
   PayRollModal's own existing (differently-wired) calculation, which
   is left completely untouched. */

import { mockHrEmployees, mockHrDepts, mockHrDesigs } from '../mock/hr';
import { mockStaffLeaveApplications, mockStaffAttendanceHistory, isNonWorkingDay } from '../mock/staffLeaveAbsenteeism';
import {
  fullName, deptName, desigName, overlaps, activeEmployees, scheduledWorkingDays, classify,
} from './staffLeaveAbsenteeismService';
import { delay, clone } from './_http';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dayName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return DAY_NAMES[(jsDay + 6) % 7];
}
function addDaysISO(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export async function getAnnualLeaveFilterOptions() {
  await delay();
  const emps = activeEmployees().map(e => ({
    id: e.id, eid: e.eid, name: fullName(e), dId: e.dId, desId: e.desId,
    deptName: deptName(e.dId), desigName: desigName(e.desId),
  }));
  return clone({
    employees: emps,
    departments: mockHrDepts.map(d => ({ id: d.id, name: d.name })),
    designations: mockHrDesigs.map(d => ({ id: d.id, dId: d.dId, name: d.name })),
  });
}

/* Core per-employee annual-leave + deduction row — shared by both
   Report 1 (one row per employee) and Report 2 (this employee's own
   entitlement section), so the two screens can never disagree. */
function annualRowForEmployee(emp, sessionStart, sessionEnd) {
  const annualApps = mockStaffLeaveApplications.filter(a => a.empId === emp.eid
    && a.leaveType === 'Annual'
    && overlaps(a.fromDate, a.toDate, sessionStart, sessionEnd));
  const approved = annualApps.filter(a => a.status === 'approved');
  const pending = annualApps.filter(a => a.status === 'pending');

  const annualLeavesAllowed = emp.leaves?.annual == null ? null : emp.leaves.annual;
  const annualLeavesAvailed = approved.reduce((s, a) => s + a.days, 0);
  const annualLeavesRemaining = annualLeavesAllowed == null ? null : Math.max(0, annualLeavesAllowed - annualLeavesAvailed);
  const excessLeaves = annualLeavesAllowed == null ? 0 : Math.max(0, annualLeavesAvailed - annualLeavesAllowed);
  const pendingRequests = pending.reduce((s, a) => s + a.days, 0);

  const absenceDays = mockStaffAttendanceHistory.filter(r => r.empId === emp.eid
    && r.date >= sessionStart && r.date <= sessionEnd && r.status === 'absent').length;

  const deductionEnabled = !!emp.leaves?.deductEn;
  const deductionRate = Number(emp.leaves?.absentDed) || 0;
  const totalDeductionAmount = deductionEnabled ? excessLeaves * deductionRate : 0;

  return {
    employeeId: emp.id,
    employeeName: fullName(emp),
    employeeEid: emp.eid,
    department: deptName(emp.dId),
    designation: desigName(emp.desId),
    annualLeavesAllowed,
    annualLeavesAvailed,
    annualLeavesRemaining,
    excessLeaves,
    absenceDays,
    paidUnpaidAbsenceStatus: absenceDays > 0 ? 'Unpaid' : '—', // this app's attendance model has no separate "paid absence" concept — an unexcused absence is, by definition, unpaid
    deductionEnabled,
    deductionRate,
    totalDeductionAmount,
    pendingRequests,
  };
}

export async function computeAnnualLeaveSummary({
  sessionStart, sessionEnd, employeeIds, department, status, query,
} = {}) {
  await delay();
  let emps = activeEmployees();
  if (employeeIds && employeeIds.length) { const idSet = new Set(employeeIds); emps = emps.filter(e => idSet.has(e.id)); }
  if (department) emps = emps.filter(e => e.dId === department);
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    emps = emps.filter(e => `${fullName(e)} ${e.eid}`.toLowerCase().includes(q));
  }

  let rows = emps.map(e => annualRowForEmployee(e, sessionStart, sessionEnd));
  if (status === 'exceeded') rows = rows.filter(r => r.excessLeaves > 0);
  else if (status === 'within') rows = rows.filter(r => r.excessLeaves === 0);

  const summary = rows.reduce((a, r) => ({
    totalActiveEmployees: a.totalActiveEmployees + 1,
    totalAllowed: a.totalAllowed + (r.annualLeavesAllowed || 0),
    totalAvailed: a.totalAvailed + r.annualLeavesAvailed,
    totalRemaining: a.totalRemaining + (r.annualLeavesRemaining || 0),
    employeesExceeded: a.employeesExceeded + (r.excessLeaves > 0 ? 1 : 0),
    totalDeduction: a.totalDeduction + r.totalDeductionAmount,
  }), { totalActiveEmployees: 0, totalAllowed: 0, totalAvailed: 0, totalRemaining: 0, employeesExceeded: 0, totalDeduction: 0 });

  return clone({ rows, summary, sessionStart, sessionEnd });
}

/* Report 2 — full per-employee statement: header info, entitlement
   section, attendance breakdown, month-wise table, and day-wise
   history, all scoped to [sessionStart, sessionEnd]. */
export async function computeIndividualAnnualLeaveStatement({ employeeId, sessionStart, sessionEnd }) {
  await delay();
  const emp = mockHrEmployees.find(e => e.id === employeeId);
  if (!emp) return null;

  const annual = annualRowForEmployee(emp, sessionStart, sessionEnd);
  const scheduled = scheduledWorkingDays(sessionStart, sessionEnd);
  const empRows = mockStaffAttendanceHistory.filter(r => r.empId === emp.eid && r.date >= sessionStart && r.date <= sessionEnd);
  const presentDays = empRows.filter(r => r.status === 'present').length;
  const approvedLeaveDaysAll = empRows.filter(r => r.status === 'leave').length; // every leave type, not just Annual — "Approved Leave Days Availed" card
  const absentDays = empRows.filter(r => r.status === 'absent').length;
  const attendancePercentage = scheduled > 0 ? Math.round((presentDays / scheduled) * 1000) / 10 : null;
  const absenteeismPercentage = scheduled > 0 ? Math.round((absentDays / scheduled) * 1000) / 10 : null;

  const statusMessage = annual.annualLeavesAllowed == null
    ? 'No annual leave entitlement has been configured for this employee yet.'
    : annual.excessLeaves > 0
      ? `You have been allocated ${annual.annualLeavesAllowed} annual leaves. You have availed ${annual.annualLeavesAvailed} leaves, exceeding your entitlement by ${annual.excessLeaves} day${annual.excessLeaves === 1 ? '' : 's'}.`
        + (annual.deductionEnabled
          ? ` Based on your configured deduction policy, the applicable deduction is PKR ${annual.totalDeductionAmount.toLocaleString('en-PK')}.`
          : ' Leave deduction is not enabled for this employee, so no deduction applies.')
      : `You have been allocated ${annual.annualLeavesAllowed} annual leaves. You have availed ${annual.annualLeavesAvailed} leaves, and ${annual.annualLeavesRemaining} leave${annual.annualLeavesRemaining === 1 ? ' is' : 's are'} remaining.`;

  /* Month-wise table — only months that actually fall inside the
     session, computed from the session's own real dates rather than a
     fixed Jan-Dec year. */
  const months = [];
  let cursor = `${sessionStart.slice(0, 7)}-01`;
  while (cursor <= sessionEnd) {
    const [y, m] = cursor.split('-').map(Number);
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const from = cursor > sessionStart ? cursor : sessionStart;
    const to = monthEnd < sessionEnd ? monthEnd : sessionEnd;
    const mScheduled = scheduledWorkingDays(from, to);
    const mRows = empRows.filter(r => r.date >= from && r.date <= to);
    const mPresent = mRows.filter(r => r.status === 'present').length;
    const mAbsent = mRows.filter(r => r.status === 'absent').length;
    const mLeave = mRows.filter(r => r.status === 'leave').length;
    months.push({
      month: `${MONTH_NAMES[m - 1]} ${y}`,
      scheduledWorkingDays: mScheduled,
      presentDays: mPresent,
      absentDays: mAbsent,
      halfDays: 0, // this app's attendance model has no half-day status yet — shown as 0, not omitted, so the column stays meaningful if/when it's added
      approvedLeaveDays: mLeave,
      attendancePercentage: mScheduled > 0 ? Math.round((mPresent / mScheduled) * 1000) / 10 : null,
      absenteeismPercentage: mScheduled > 0 ? Math.round((mAbsent / mScheduled) * 1000) / 10 : null,
    });
    cursor = addDaysISO(monthEnd, 1);
  }

  /* Day-wise detailed history — every working day in range that has
     EITHER a real attendance row OR falls inside the session (so "No
     Record" days are visible too, never silently skipped as if they
     were non-working days). */
  const history = [];
  let d = sessionStart;
  while (d <= sessionEnd) {
    const day = d;
    if (!isNonWorkingDay(day)) {
      const row = empRows.find(r => r.date === day);
      const leaveApp = row?.status === 'leave'
        ? mockStaffLeaveApplications.find(a => a.empId === emp.eid && day >= a.fromDate && day <= a.toDate && a.status === 'approved')
        : null;
      history.push({
        date: day,
        day: dayName(day),
        status: row ? row.status : null,
        inTime: row?.inTime || null,
        outTime: row?.outTime || null,
        leaveType: row?.leaveType || null,
        approvalStatus: leaveApp ? leaveApp.status : null,
        classification: classify(row),
        remarks: leaveApp?.remarks || '',
      });
    }
    d = addDaysISO(d, 1);
  }

  return clone({
    employee: {
      id: emp.id, eid: emp.eid, name: fullName(emp), department: deptName(emp.dId), designation: desigName(emp.desId),
      joinDate: emp.join, status: emp.status,
    },
    sessionStart,
    sessionEnd,
    annual,
    attendance: {
      scheduledWorkingDays: scheduled, presentDays, absentDays, halfDays: 0,
      approvedLeaveDays: approvedLeaveDaysAll, attendancePercentage, absenteeismPercentage,
    },
    statusMessage,
    months,
    history: history.reverse(),
  });
}
