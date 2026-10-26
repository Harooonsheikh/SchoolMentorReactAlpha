/* ═══════════════════════════════════════════════════════════════════
   Staff Leave & Absenteeism Reports — new mock data.

   Two real gaps confirmed by inspection before this feature was built:
   mockHrEmployees' own `leaves` object (mock/hr.js) is ENTITLEMENT/
   POLICY ONLY (annual/casual/sick/maternity caps + a running balance) —
   there was no per-application record anywhere (no dates, no approval
   status, nothing to show "took sick leave 20–21 Oct"). And
   mockStaffAttendance (mock/attendance.js) is a single today-only
   snapshot with no `date` field at all — there was no per-day
   attendance history anywhere in the codebase to build a real
   date-range absenteeism report from.

   This file is the honest fix: real, deterministic, seeded data (same
   "consistent synthetic generator" convention as feeHistSeed in
   Fee.jsx and usageEngine.js's PRNG — never random-per-render, always
   reproducible) — not a backend. See this feature's implementation
   report for the exact two backend tables (staff_leave_applications,
   staff_attendance_daily) a real system would need instead.

   Internal consistency is the whole point: an APPROVED leave
   application's date range is what the attendance-history generator
   below reads to mark those exact days 'leave' — never 'absent' — so
   the two datasets can never contradict each other (the brief's own
   "do not count approved leave as unexcused absence" rule is
   structurally impossible to violate here, not just handled by a
   filter later).

   Covers 2024-08-01 (the real current academic session's own start
   date — Settings -> Session Management, settingsStore.js's
   INITIAL_SESSIONS, status 'current' — reused here, not reinvented;
   see the Annual Leave Summary feature this range was widened for)
   through 2026-10-23 (today) for every ACTIVE employee in
   mockHrEmployees — inactive employees are excluded from generation
   entirely (no ongoing attendance/leave obligation), consistent with
   the Employee Attendance Exclusion feature's own reasoning.

   Originally covered only 2026-01-01 onward (enough for the Staff
   Leave & Absenteeism report this file was first built for, which
   only ever looks at "this month"/"this year" relative to today).
   Widened backward — same generator, same rules, not a second dataset
   — once the Annual Leave Summary report needed to scope a whole real
   academic session (Aug 2024 - Jul 2025) that the original range
   didn't reach at all. Extending history is additive; nothing already
   generated for 2026 changed shape or meaning. */

import { mockHrEmployees } from './hr';
import { mockWeeklyOff, mockHolidays } from './attendance';

const RANGE_START = '2024-08-01';
const RANGE_END = '2026-10-23';

function seededRand(str) {
  /* FNV-1a + a Murmur-style finalizer — plain "multiply by 31 and add"
     was tried first and produced badly correlated output for strings
     that differ only in a trailing digit (e.g. "EMP-001-type-0" vs
     "EMP-001-type-1" kept landing in the same bucket), which showed up
     as one employee's 4 leave applications all getting the same type/
     status/paid-or-unpaid. This gives real avalanche behaviour so
     nearby seed strings land nowhere near each other, while staying
     100% deterministic for the same input. */
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296; // deterministic [0,1)
}

function seededShuffle(arr, seedStr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRand(`${seedStr}-shuf-${i}`) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(y, m0, d) { return `${y}-${pad2(m0 + 1)}-${pad2(d)}`; }
function addDaysISO(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
/* Monday-indexed (0=Mon..6=Sun) to match mockWeeklyOff's own stated
   convention ("Sat, Sun (Mon-indexed 0..6)", mock/attendance.js). */
function dayOfWeekMon(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (jsDay + 6) % 7;
}
function isWeekend(dateStr) { return mockWeeklyOff.includes(dayOfWeekMon(dateStr)); }
function isHoliday(dateStr) { return mockHolidays.some(h => dateStr >= h.from && dateStr <= h.to); }
export function isNonWorkingDay(dateStr) { return isWeekend(dateStr) || isHoliday(dateStr); }

const LEAVE_TYPES = ['Casual', 'Sick', 'Annual'];

/* Every {year, m0} month slot from RANGE_START through RANGE_END,
   spanning the multi-year range (previously a flat 0..9 list good for
   a single year only). */
const MONTH_SLOTS = (() => {
  const slots = [];
  const [sy, sm] = RANGE_START.split('-').map(Number);
  const [ey, em] = RANGE_END.split('-').map(Number);
  let y = sy, m0 = sm - 1;
  const endTotal = (ey * 12) + (em - 1);
  while ((y * 12) + m0 <= endTotal) {
    slots.push({ year: y, m0 });
    m0 += 1;
    if (m0 > 11) { m0 = 0; y += 1; }
  }
  return slots;
})();

export const mockStaffLeaveApplications = [];
export const mockStaffAttendanceHistory = [];

let _appSeq = 1;
mockHrEmployees.filter(e => e.status === 'Active').forEach((emp) => {
  /* Roughly one application every ~2.5 months of covered history, so
     density stays realistic whether the range is 10 months or several
     years — scales with MONTH_SLOTS instead of a flat 2-4 regardless
     of range length. */
  const baseApps = Math.max(2, Math.round(MONTH_SLOTS.length / 2.5));
  const numApps = baseApps + Math.floor(seededRand(`${emp.eid}-n`) * 3); // baseApps..baseApps+2
  const months = seededShuffle(MONTH_SLOTS, emp.eid).slice(0, numApps);
  const approvedRanges = []; // { from, to, leaveType, paidUnpaid } — only APPROVED ones ever land here

  months.forEach((slot, i) => {
    const typeRoll = seededRand(`${emp.eid}-type-${i}`);
    const leaveType = typeRoll < 0.4 ? 'Casual' : typeRoll < 0.75 ? 'Sick' : 'Annual';
    const lenRoll = seededRand(`${emp.eid}-len-${i}`);
    const lengthDays = leaveType === 'Casual' ? 1 : leaveType === 'Sick' ? (1 + Math.floor(lenRoll * 3)) : (2 + Math.floor(lenRoll * 3));

    const dayRoll = seededRand(`${emp.eid}-day-${i}`);
    let fromDate = ymd(slot.year, slot.m0, 4 + Math.floor(dayRoll * 18));
    while (isWeekend(fromDate) || isHoliday(fromDate)) fromDate = addDaysISO(fromDate, 1);
    let toDate = fromDate;
    let daysAdded = 1;
    while (daysAdded < lengthDays) {
      toDate = addDaysISO(toDate, 1);
      if (!isWeekend(toDate) && !isHoliday(toDate)) daysAdded += 1;
    }
    if (toDate > RANGE_END) return; // keep every generated application inside the covered range

    const statusRoll = seededRand(`${emp.eid}-status-${i}`);
    const status = statusRoll < 0.72 ? 'approved' : statusRoll < 0.85 ? 'pending' : statusRoll < 0.93 ? 'rejected' : 'cancelled';
    const paidUnpaid = seededRand(`${emp.eid}-paid-${i}`) < 0.15 ? 'unpaid' : 'paid';
    const appliedOn = addDaysISO(fromDate, -(2 + Math.floor(seededRand(`${emp.eid}-applied-${i}`) * 5)));

    const record = {
      id: `lv-${_appSeq++}`,
      empId: emp.eid,
      employeeId: emp.id,
      leaveType,
      paidUnpaid,
      fromDate,
      toDate,
      days: daysAdded,
      appliedOn,
      status, // 'approved' | 'pending' | 'rejected' | 'cancelled'
      approvedBy: status === 'approved' ? 'Dr. Islahudin' : status === 'rejected' ? 'Dr. Islahudin' : null,
      remarks: status === 'rejected' ? 'Insufficient balance for the requested dates.'
        : status === 'cancelled' ? 'Cancelled by employee before approval.' : '',
    };
    mockStaffLeaveApplications.push(record);
    if (status === 'approved') approvedRanges.push({ from: fromDate, to: toDate, leaveType, paidUnpaid });
  });

  let cursor = RANGE_START;
  while (cursor <= RANGE_END) {
    const day = cursor;
    if (!isNonWorkingDay(day)) {
      const onLeave = approvedRanges.find(r => day >= r.from && day <= r.to);
      let status, inTime = null, outTime = null, late = false;
      if (onLeave) {
        status = 'leave';
      } else {
        const r = seededRand(`${emp.eid}-att-${day}`);
        if (r < 0.90) { status = 'present'; inTime = '07:45'; outTime = '14:30'; }
        else if (r < 0.95) { status = 'present'; inTime = '08:15'; outTime = '14:30'; late = true; }
        else { status = 'absent'; }
      }
      mockStaffAttendanceHistory.push({
        empId: emp.eid,
        date: day,
        status, // 'present' | 'absent' | 'leave'
        late,
        inTime,
        outTime,
        leaveType: onLeave ? onLeave.leaveType : null,
        paidUnpaid: onLeave ? onLeave.paidUnpaid : null,
      });
    }
    cursor = addDaysISO(cursor, 1);
  }
});

export { LEAVE_TYPES, RANGE_START, RANGE_END };
