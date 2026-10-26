/* Staff Leave & Absenteeism Reports — computation service */

import { mockHrEmployees, mockHrDepts, mockHrDesigs } from '../mock/hr';
import {
  mockStaffLeaveApplications, mockStaffAttendanceHistory, isNonWorkingDay, RANGE_START, RANGE_END,
} from '../mock/staffLeaveAbsenteeism';
import { delay, clone } from './_http';

const LEAVE_TYPES = ['Casual', 'Sick', 'Annual'];

export function fullName(e) { return `${e.firstName || ''} ${e.lastName || ''}`.trim(); }
export function deptName(dId) { return mockHrDepts.find(d => d.id === dId)?.name || '—'; }
export function desigName(desId) { return mockHrDesigs.find(d => d.id === desId)?.name || '—'; }
export function overlaps(aFrom, aTo, bFrom, bTo) { return aFrom <= bTo && aTo >= bFrom; }

export function activeEmployees() {
  return mockHrEmployees.filter(e => e.status === 'Active');
}

export async function getStaffLeaveAbsenteeismFilterOptions() {
  await delay();
  const emps = activeEmployees().map(e => ({
    id: e.id,
    eid: e.eid,
    name: fullName(e),
    dId: e.dId,
    desId: e.desId,
    deptName: deptName(e.dId),
    desigName: desigName(e.desId),
  }));
  return clone({
    employees: emps,
    departments: mockHrDepts.map(d => ({ id: d.id, name: d.name })),
    designations: mockHrDesigs.map(d => ({ id: d.id, dId: d.dId, name: d.name })),
    leaveTypes: LEAVE_TYPES,
  });
}

function resolveEmployees({ employeeIds, department, designation }) {
  let list = activeEmployees();
  if (employeeIds && employeeIds.length) {
    const idSet = new Set(employeeIds);
    list = list.filter(e => idSet.has(e.id));
  }
  if (department) list = list.filter(e => e.dId === department);
  if (designation) list = list.filter(e => e.desId === designation);
  return list;
}

export function scheduledWorkingDays(fromDate, toDate) {
  let n = 0;
  let d = fromDate;
  while (d <= toDate) {
    if (!isNonWorkingDay(d)) n += 1;
    const [y, m, dd] = d.split('-').map(Number);
    d = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
  }
  return n;
}

function applicationsFor(eid, fromDate, toDate, leaveType, status) {
  return mockStaffLeaveApplications.filter(a => a.empId === eid
    && overlaps(a.fromDate, a.toDate, fromDate, toDate)
    && (!leaveType || a.leaveType === leaveType)
    && (!status || a.status === status));
}

function leaveTypeRowsForEmployee(emp, fromDate, toDate, leaveTypeFilter, statusFilter) {
  const entitlement = emp.leaves || {};
  const typesToShow = [...LEAVE_TYPES, ...(entitlement.maternity != null && entitlement.maternity > 0 ? ['Maternity'] : [])]
    .filter(t => !leaveTypeFilter || t === leaveTypeFilter);

  return typesToShow.map((type) => {
    const apps = applicationsFor(emp.eid, fromDate, toDate, type, null);
    const approved = apps.filter(a => a.status === 'approved' && (!statusFilter || statusFilter === 'approved'));
    const pending = apps.filter(a => a.status === 'pending' && (!statusFilter || statusFilter === 'pending'));
    const paidDays = approved.filter(a => a.paidUnpaid === 'paid').reduce((s, a) => s + a.days, 0);
    const unpaidDays = approved.filter(a => a.paidUnpaid === 'unpaid').reduce((s, a) => s + a.days, 0);
    const pendingDays = pending.reduce((s, a) => s + a.days, 0);
    const cap = entitlement[type.toLowerCase()];
    const totalAllowed = cap == null ? null : cap;
    const totalAvailed = paidDays + unpaidDays;
    const remainingBalance = totalAllowed == null ? null : Math.max(0, totalAllowed - totalAvailed);
    return {
      leaveType: type,
      totalAllowed,
      paidLeavesAllowed: totalAllowed,
      paidLeavesAvailed: paidDays,
      unpaidLeavesAvailed: unpaidDays,
      totalLeavesAvailed: totalAvailed,
      remainingBalance,
      pendingRequests: pendingDays,
    };
  }).filter(r => (statusFilter ? (r.totalLeavesAvailed > 0 || r.pendingRequests > 0) : true));
}

export async function computeStaffLeaveReport({ employeeIds, fromDate, toDate, department, designation, leaveType, status } = {}) {
  await delay();
  const emps = resolveEmployees({ employeeIds, department, designation });

  const rows = [];
  emps.forEach((emp) => {
    leaveTypeRowsForEmployee(emp, fromDate, toDate, leaveType, status).forEach((r) => {
      rows.push({
        employeeId: emp.id,
        employeeName: fullName(emp),
        employeeEid: emp.eid,
        department: deptName(emp.dId),
        designation: desigName(emp.desId),
        ...r,
      });
    });
  });

  const summary = rows.reduce((a, r) => ({
    totalEntitlement: a.totalEntitlement + (r.totalAllowed || 0),
    totalAvailed: a.totalAvailed + r.totalLeavesAvailed,
    paidAvailed: a.paidAvailed + r.paidLeavesAvailed,
    unpaidAvailed: a.unpaidAvailed + r.unpaidLeavesAvailed,
    remainingBalance: a.remainingBalance + (r.remainingBalance || 0),
    pendingRequests: a.pendingRequests + r.pendingRequests,
  }), { totalEntitlement: 0, totalAvailed: 0, paidAvailed: 0, unpaidAvailed: 0, remainingBalance: 0, pendingRequests: 0 });

  const history = emps.map((emp) => ({
    employeeId: emp.id,
    employeeName: fullName(emp),
    employeeEid: emp.eid,
    applications: applicationsFor(emp.eid, fromDate, toDate, leaveType, status)
      .slice()
      .sort((a, b) => b.fromDate.localeCompare(a.fromDate))
      .map(a => ({ ...a, employeeName: fullName(emp) })),
  }));

  return clone({
    employeeCount: emps.length,
    isAggregate: emps.length > 1,
    summary,
    rows,
    history,
  });
}

export function classify(row) {
  if (!row) return 'No Record';
  if (row.status === 'leave') return 'Approved Leave';
  if (row.status === 'absent') return 'Unexcused Absence';
  if (row.status === 'present' && row.late) return 'Present (Late)';
  return 'Present';
}

export async function computeStaffAbsenteeismReport({ employeeIds, fromDate, toDate, department, designation, attendanceStatus } = {}) {
  await delay();
  const emps = resolveEmployees({ employeeIds, department, designation });
  const scheduled = scheduledWorkingDays(fromDate, toDate);

  const rows = emps.map((emp) => {
    const empRows = mockStaffAttendanceHistory.filter(r => r.empId === emp.eid && r.date >= fromDate && r.date <= toDate);
    const presentDays = empRows.filter(r => r.status === 'present').length;
    const approvedLeaveDays = empRows.filter(r => r.status === 'leave').length;
    const unexcusedAbsentDays = empRows.filter(r => r.status === 'absent').length;
    const lateArrivals = empRows.filter(r => r.late).length;
    const attendancePercentage = scheduled > 0 ? Math.round((presentDays / scheduled) * 1000) / 10 : null;
    const absenteeismRate = scheduled > 0 ? Math.round((unexcusedAbsentDays / scheduled) * 1000) / 10 : null;
    return {
      employeeId: emp.id,
      employeeName: fullName(emp),
      employeeEid: emp.eid,
      department: deptName(emp.dId),
      designation: desigName(emp.desId),
      scheduledWorkingDays: scheduled,
      presentDays,
      approvedLeaveDays,
      unexcusedAbsentDays,
      lateArrivals,
      attendancePercentage,
      absenteeismRate,
    };
  }).filter(r => !attendanceStatus
    || (attendanceStatus === 'absent' && r.unexcusedAbsentDays > 0)
    || (attendanceStatus === 'leave' && r.approvedLeaveDays > 0)
    || (attendanceStatus === 'late' && r.lateArrivals > 0));

  const summary = rows.reduce((a, r) => ({
    scheduledWorkingDays: scheduled,
    presentDays: a.presentDays + r.presentDays,
    approvedLeaveDays: a.approvedLeaveDays + r.approvedLeaveDays,
    unexcusedAbsentDays: a.unexcusedAbsentDays + r.unexcusedAbsentDays,
    lateArrivals: a.lateArrivals + r.lateArrivals,
  }), { scheduledWorkingDays: scheduled, presentDays: 0, approvedLeaveDays: 0, unexcusedAbsentDays: 0, lateArrivals: 0 });
  const totalPossible = scheduled * rows.length;
  summary.absenteeismRate = totalPossible > 0 ? Math.round((summary.unexcusedAbsentDays / totalPossible) * 1000) / 10 : null;

  const history = emps.map((emp) => {
    const days = [];
    let d = fromDate;
    while (d <= toDate) {
      const day = d;
      if (!isNonWorkingDay(day)) {
        const row = mockStaffAttendanceHistory.find(r => r.empId === emp.eid && r.date === day);
        days.push({
          date: day,
          employeeName: fullName(emp),
          status: row ? row.status : null,
          late: !!row?.late,
          leaveType: row?.leaveType || null,
          classification: classify(row),
        });
      }
      const [y, m, dd] = d.split('-').map(Number);
      d = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
    }
    return { employeeId: emp.id, employeeName: fullName(emp), employeeEid: emp.eid, days: days.reverse() };
  });

  return clone({
    employeeCount: emps.length,
    isAggregate: emps.length > 1,
    summary,
    rows,
    history,
  });
}
