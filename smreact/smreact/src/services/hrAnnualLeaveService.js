/* HR → Reports → Annual Leave Summary — REAL data (no mock).
   Leave availed = staff attendance me "Leave" mark din
   Absent        = staff attendance me "Absent" mark din
   Working days  = weekly-off + holidays setup se */
  
import { buildUrl } from '../../utils/apiConfig';
import { getHrLeaveSettings } from './hrService';
import { getWeeklyOffSetup, monthlySetup } from './attendanceService';

const DAYS_MON0 = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUS_CODE = { 1: 'present', 2: 'absent', 3: 'leave', 4: 'late' };
const CHUNK = 12;
const CACHE_TTL_MS = 5 * 60 * 1000;

const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
const fromISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => toISO(new Date());
const dowMon0 = (iso) => (fromISO(iso).getDay() + 6) % 7;
export const dayName = (iso) => DAYS_MON0[dowMon0(iso)];

function datesBetween(from, to) {
  const out = [];
  for (let d = fromISO(from), end = fromISO(to); d <= end; d.setDate(d.getDate() + 1)) out.push(toISO(d));
  return out;
}
const timeVal = (v) => {
  if (v == null || typeof v === 'object') return '';
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${pad2(m[1])}:${m[2]}` : String(v);
};
const normStatus = (raw) => { const s = String(raw ?? '').trim().toLowerCase(); return STATUS_CODE[s] || s; };

/* Weekly off + holidays */
async function loadNonWorking(sessionStart, sessionEnd, sessionId) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  let weeklyOff = [];
  try {
    const res = await getWeeklyOffSetup();
    weeklyOff = (res?.data || []).map((r) => DAYS_MON0.indexOf(r.WeekDay ?? r.weekDay)).filter((i) => i !== -1);
  } catch (e) { console.error('Annual leave: weekly-off load failed', e); }

  const months = [];
  for (let d = fromISO(`${sessionStart.slice(0, 7)}-01`), end = fromISO(sessionEnd); d <= end; d.setMonth(d.getMonth() + 1)) months.push(d.getMonth() + 1);
  const holidays = new Map();
  await Promise.all([...new Set(months)].map(async (month) => {
    try {
      const res = await monthlySetup({
        id: 0, branchID, sessionID: Number(sessionId) || 0, holidayTitle: '', description: '',
        dateFrom: '', dateTo: '', month, action: 'get', createdBy: 0, modifiedBy: 0, classIDs: [],
      });
      (res?.data || []).forEach((h) => {
        const from = String(h.DateFrom ?? h.dateFrom ?? '').slice(0, 10);
        const to = String(h.DateTo ?? h.dateTo ?? '').slice(0, 10);
        if (!from || !to) return;
        datesBetween(from, to).forEach((d) => { if (d >= sessionStart && d <= sessionEnd) holidays.set(d, h.HolidayTitle ?? h.holidayTitle ?? 'Holiday'); });
      });
    } catch (e) { console.error(`Annual leave: holidays load failed (month ${month})`, e); }
  }));
  return { weeklyOff, holidays };
}

/* Ek din ki staff attendance (saare staff) */
async function fetchStaffAttendanceDay(dateStr, branchID, token) {
  const res = await fetch(buildUrl('/api/staff-attendance'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      id: 0, staffID: 0, branchID, attendanceDate: dateStr, checkInTime: '', checkOutTime: '',
      status: '', platform: '', isNotificationGen: false, action: 'get', createdBy: 0, modifiedBy: 0,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json().catch(() => null);
  const byStaff = new Map();
  (json?.data || []).forEach((r) => {
    if (String(r.AttendanceDate ?? r.attendanceDate ?? '').slice(0, 10) !== dateStr) return;
    byStaff.set(String(r.StaffID ?? r.staffID), {
      status: normStatus(r.Status ?? r.status),
      inTime: timeVal(r.CheckInTime ?? r.checkInTime),
      outTime: timeVal(r.CheckOutTime ?? r.checkOutTime),
      platform: r.Platform ?? r.platform ?? '',
    });
  });
  return byStaff;
}

const _cache = new Map();

export async function loadSessionAttendance({ sessionStart, sessionEnd, sessionId, force = false } = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const key = `${branchID}|${sessionId}|${sessionStart}|${sessionEnd}`;
  const hit = _cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const token = sessionStorage.getItem('token');
  const today = todayISO();
  const effectiveEnd = sessionEnd < today ? sessionEnd : today;
  const nonWorking = await loadNonWorking(sessionStart, sessionEnd, sessionId);
  const isOff = (d) => nonWorking.weeklyOff.includes(dowMon0(d)) || nonWorking.holidays.has(d);
  const workingDates = sessionStart > effectiveEnd ? [] : datesBetween(sessionStart, effectiveEnd).filter((d) => !isOff(d));

  const byDate = new Map();
  let failedDays = 0;
  for (let i = 0; i < workingDates.length; i += CHUNK) {
    // eslint-disable-next-line no-await-in-loop
    const results = await Promise.all(workingDates.slice(i, i + CHUNK).map(async (d) => {
      try { return [d, await fetchStaffAttendanceDay(d, branchID, token)]; }
      catch (e) { failedDays += 1; return [d, new Map()]; }
    }));
    results.forEach(([d, m]) => byDate.set(d, m));
  }
  const data = { sessionStart, sessionEnd, effectiveEnd, workingDates, nonWorking, byDate, failedDays };
  _cache.set(key, { at: Date.now(), data });
  return data;
}

/* Leave settings (quota + rates) */
const hasLeaveSettings = (lv) => lv && lv.annual !== '' && lv.annual != null;
export async function loadLeaveSettings(emps = []) {
  const out = new Map();
  const missing = [];
  emps.forEach((e) => { if (hasLeaveSettings(e.leaves)) out.set(e.id, e.leaves); else missing.push(e); });
  for (let i = 0; i < missing.length; i += 8) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(missing.slice(i, i + 8).map(async (e) => {
      try { out.set(e.id, (await getHrLeaveSettings(e.id)) || e.leaves || null); }
      catch { out.set(e.id, e.leaves || null); }
    }));
  }
  return out;
}

const numOrNull = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

function tallyEmployee(empId, dataset, from, to) {
  const sid = String(empId);
  const t = { scheduled: 0, marked: 0, present: 0, late: 0, absent: 0, leave: 0, notMarked: 0 };
  dataset.workingDates.forEach((d) => {
    if ((from && d < from) || (to && d > to)) return;
    t.scheduled += 1;
    const rec = dataset.byDate.get(d)?.get(sid);
    if (!rec) { t.notMarked += 1; return; }
    t.marked += 1;
    if (rec.status === 'absent') t.absent += 1;
    else if (rec.status === 'leave') t.leave += 1;
    else if (rec.status === 'late') { t.late += 1; t.present += 1; }
    else t.present += 1;
  });
  return t;
}

export function annualRow(emp, leaves, dataset, { getDeptName, getDesigName } = {}) {
  const lv = leaves || {};
  const t = tallyEmployee(emp.id, dataset);
  const allowed = numOrNull(lv.annual);
  const availed = t.leave;
  const remaining = allowed == null ? null : Math.max(0, allowed - availed);
  const excess = allowed == null ? 0 : Math.max(0, availed - allowed);
  const deductionEnabled = lv.deductEn !== false && lv.deductEn !== 'false' && lv.deductEn !== 0;
  const leaveRate = Number(lv.unpaidDed) || 0;
  const absentRate = Number(lv.absentDed) || 0;
  const excessDeduction = deductionEnabled ? excess * leaveRate : 0;
  const absentDeduction = deductionEnabled ? t.absent * absentRate : 0;
  return {
    employeeId: emp.id,
    employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || `Employee #${emp.id}`,
    employeeEid: emp.eid || `EMP-${pad2(emp.id)}`,
    department: getDeptName ? (getDeptName(emp.dId) || '—') : '—',
    designation: getDesigName ? (getDesigName(emp.desId) || '—') : '—',
    joinDate: emp.join || '',
    status: emp.status || '',
    annualLeavesAllowed: allowed,
    annualLeavesAvailed: availed,
    annualLeavesRemaining: remaining,
    excessLeaves: excess,
    absenceDays: t.absent,
    presentDays: t.present,
    lateDays: t.late,
    notMarkedDays: t.notMarked,
    scheduledWorkingDays: t.scheduled,
    attendancePercentage: pct(t.present, t.marked),
    deductionEnabled,
    deductionRate: leaveRate,
    paidUnpaidAbsenceStatus: t.absent > 0 ? 'Unpaid' : '—',
    excessDeduction,
    absentDeduction,
    totalDeductionAmount: excessDeduction + absentDeduction,
  };
}

function summarizeRows(rows) {
  return rows.reduce((a, r) => ({
    totalActiveEmployees: a.totalActiveEmployees + 1,
    totalAllowed: a.totalAllowed + (r.annualLeavesAllowed || 0),
    totalAvailed: a.totalAvailed + r.annualLeavesAvailed,
    totalRemaining: a.totalRemaining + (r.annualLeavesRemaining || 0),
    employeesExceeded: a.employeesExceeded + (r.excessLeaves > 0 ? 1 : 0),
    totalDeduction: a.totalDeduction + r.totalDeductionAmount,
  }), { totalActiveEmployees: 0, totalAllowed: 0, totalAvailed: 0, totalRemaining: 0, employeesExceeded: 0, totalDeduction: 0 });
}

/* Report 1 — All Employees */
export async function computeAnnualLeaveSummary({
  emps = [], getDeptName, getDesigName, sessionId, sessionStart, sessionEnd, department, status, query, force,
} = {}) {
  const active = (emps || []).filter((e) => e.status === 'Active');
  const [dataset, leavesMap] = await Promise.all([
    loadSessionAttendance({ sessionStart, sessionEnd, sessionId, force }),
    loadLeaveSettings(active),
  ]);
  let list = active;
  if (department) list = list.filter((e) => Number(e.dId) === Number(department));
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter((e) => `${e.firstName || ''} ${e.lastName || ''} ${e.eid || ''}`.toLowerCase().includes(q));
  }
  let rows = list.map((e) => annualRow(e, leavesMap.get(e.id), dataset, { getDeptName, getDesigName }));
  if (status === 'exceeded') rows = rows.filter((r) => r.excessLeaves > 0);
  else if (status === 'within') rows = rows.filter((r) => r.excessLeaves === 0);
  return { rows, summary: summarizeRows(rows), sessionStart, sessionEnd, failedDays: dataset.failedDays };
}

/* Report 2 — Individual Statement */
export async function computeIndividualAnnualLeaveStatement({
  employeeId, emps = [], getDeptName, getDesigName, sessionId, sessionStart, sessionEnd,
} = {}) {
  const emp = (emps || []).find((e) => Number(e.id) === Number(employeeId));
  if (!emp) return null;
  const [dataset, leavesMap] = await Promise.all([
    loadSessionAttendance({ sessionStart, sessionEnd, sessionId }),
    loadLeaveSettings([emp]),
  ]);
  const a = annualRow(emp, leavesMap.get(emp.id), dataset, { getDeptName, getDesigName });
  const sid = String(emp.id);

  const months = [];
  if (sessionStart <= dataset.effectiveEnd) {
    for (let d = fromISO(`${sessionStart.slice(0, 7)}-01`), end = fromISO(dataset.effectiveEnd); d <= end; d.setMonth(d.getMonth() + 1)) {
      const y = d.getFullYear(); const m = d.getMonth();
      const t = tallyEmployee(emp.id, dataset, `${y}-${pad2(m + 1)}-01`, toISO(new Date(y, m + 1, 0)));
      months.push({
        month: `${MONTH_NAMES[m]} ${y}`,
        scheduledWorkingDays: t.scheduled,
        presentDays: t.present,
        absentDays: t.absent,
        halfDays: t.late,
        approvedLeaveDays: t.leave,
        attendancePercentage: pct(t.present, t.marked),
        absenteeismPercentage: pct(t.absent, t.marked),
      });
    }
  }

  const history = dataset.workingDates.map((d) => {
    const rec = dataset.byDate.get(d)?.get(sid);
    const st = rec?.status || '';
    const classification = !rec ? 'No Record'
      : st === 'absent' ? 'Unexcused Absence'
        : st === 'leave' ? 'Approved Leave'
          : st === 'late' ? 'Present (Late)' : 'Present';
    return {
      date: d, day: dayName(d),
      status: !rec ? null : (st === 'late' ? 'present' : st),
      inTime: rec?.inTime || '', outTime: rec?.outTime || '',
      leaveType: st === 'leave' ? 'Annual' : null, approvalStatus: null, classification,
      remarks: rec?.platform ? `Marked from ${rec.platform}` : '',
    };
  }).reverse();

  let statusMessage;
  if (a.annualLeavesAllowed == null) {
    statusMessage = `Annual leave quota is not configured for ${a.employeeName}. Set it in Employee → Leaves.`;
  } else if (a.excessLeaves > 0) {
    statusMessage = `${a.employeeName} was allocated ${a.annualLeavesAllowed} annual leaves and has availed ${a.annualLeavesAvailed}, exceeding the entitlement by ${a.excessLeaves} day${a.excessLeaves === 1 ? '' : 's'}.`
      + (a.deductionEnabled ? '' : ' Leave deduction is disabled for this employee, so no deduction applies.');
  } else {
    statusMessage = `${a.employeeName} was allocated ${a.annualLeavesAllowed} annual leaves, has availed ${a.annualLeavesAvailed}, and ${a.annualLeavesRemaining} ${a.annualLeavesRemaining === 1 ? 'is' : 'are'} remaining.`;
  }

  return {
    employee: { id: emp.id, eid: a.employeeEid, name: a.employeeName, department: a.department, designation: a.designation, joinDate: a.joinDate || '—', status: a.status },
    sessionStart, sessionEnd,
    annual: a,
    attendance: {
      scheduledWorkingDays: a.scheduledWorkingDays, presentDays: a.presentDays, absentDays: a.absenceDays,
      halfDays: 0, approvedLeaveDays: a.annualLeavesAvailed, attendancePercentage: a.attendancePercentage,
    },
    statusMessage,
    months,
    history,
  };
}