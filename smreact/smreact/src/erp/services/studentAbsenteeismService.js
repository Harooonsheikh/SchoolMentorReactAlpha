import * as attendanceService from './attendanceService';

/* ─── Student Absenteeism Report — data + calculation layer ───────────────
   Reuses the existing endpoints only:
     · POST /api/student-attendance  (action "get")   → attendance records
     · /api/attendance-weekly-setup  (action "get")   → weekly-off weekdays
   Nothing here changes any existing service. */

const DAYS_F = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CODE_TO_STATUS = { '1': 'present', '2': 'absent', '3': 'leave', '4': 'late', '5': 'holiday', '6': 'short_leave' };
const KNOWN = new Set(['present', 'absent', 'leave', 'late', 'holiday', 'short_leave']);
const POOL = 6;

const pad = (n) => String(n).padStart(2, '0');
export const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function enumerateDates(from, to) {
  const out = [];
  if (!from || !to) return out;
  const end = new Date(`${to}T00:00:00`);
  for (let d = new Date(`${from}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) out.push(toYmd(d));
  return out;
}

function normStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (CODE_TO_STATUS[s]) return CODE_TO_STATUS[s];
  if (s === 'shortleave') return 'short_leave';
  return KNOWN.has(s) ? s : '';
}

/* Run async tasks with limited concurrency. */
async function runPool(tasks, size = POOL) {
  let i = 0;
  const worker = async () => { while (i < tasks.length) { const t = tasks[i++]; await t(); } };
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
}

/* Weekly-off weekdays as Monday=0 … Sunday=6 (same convention as Attendance.jsx). */
export async function fetchWeeklyOffIdx() {
  try {
    const res = await attendanceService.getWeeklyOffSetup();
    return (res?.data || [])
      .map((x) => DAYS_F.indexOf(x.WeekDay ?? x.weekDay))
      .filter((i) => i >= 0);
  } catch {
    return [];
  }
}

/* De-duplicated roster: one entry per student id (first class wins). */
function buildRoster(classes) {
  const studentClass = new Map(); // studentID → class entry
  const students = [];
  classes.forEach((c) => {
    (c.students || []).forEach((st) => {
      const id = String(st.id);
      if (studentClass.has(id)) return;
      studentClass.set(id, c);
      students.push({ id, name: st.name, reg: st.reg, cls: c });
    });
  });
  return { studentClass, students };
}

/* Fetch attendance for `classes` between from..to (inclusive).
   Returns { map: Map("studentID|date" → status), failed }.
   - Sends startDate + endDate (single day → both equal that day).
   - If the backend honours the range we use one call per class; if it only
     honours attendanceDate we fall back to one call per date.
   - If the backend ignores class/section (returns branch-wide rows) a single
     class call per date/range is enough. */
export async function fetchAbsenteeismRecords({ classes, from, to }) {
  const branchID = Number(sessionStorage.getItem('branchID'));
  const sessionID = await attendanceService.getActiveSessionID();
  const dates = enumerateDates(from, to);
  const { studentClass } = buildRoster(classes);
  const map = new Map();
  let failed = 0;

  const dateOf = (rec) => String(rec.AttendanceDate ?? rec.attendanceDate ?? '').slice(0, 10);
  const sidOf = (rec) => String(rec.StudentID ?? rec.studentID ?? rec.studentId ?? '');

  const call = async (c, attendanceDate, startDate, endDate) => {
    try {
      const res = await attendanceService.studentAttendance({
        id: 0, branchID, studentID: 0, sessionID,
        classID: c.classID, sectionID: c.sectionID,
        attendanceDate, startDate, endDate,
        status: '', platform: 'ERP',
        isNotificationGen: false, action: 'get', createdBy: 0, modifiedBy: 0,
      });
      return res?.data || [];
    } catch (err) {
      failed++;
      console.error('Absenteeism fetch error:', err);
      return [];
    }
  };

  const ingest = (recs) => {
    recs.forEach((rec) => {
      const date = dateOf(rec);
      const sid = sidOf(rec);
      if (!date || date < from || date > to || !studentClass.has(sid)) return;
      const st = normStatus(rec.Status ?? rec.status);
      if (!st) return;
      map.set(`${sid}|${date}`, st);
    });
  };

  /* Probe the first classes: does the API return other dates for a range call,
     and does it return students outside the requested class? */
  let rangeMode = dates.length === 1; // single day: the plain call is the range call
  let branchWide = false;
  let probed = 0;
  for (const c of classes.slice(0, 3)) {
    const recs = await call(c, from, from, to);
    ingest(recs);
    probed++;
    if (recs.length) {
      const own = new Set((c.students || []).map((s) => String(s.id)));
      if (recs.some((r) => !own.has(sidOf(r)))) branchWide = true;
      if (dates.length > 1 && recs.some((r) => dateOf(r) && dateOf(r) !== from)) rangeMode = true;
      break;
    }
  }

  const targets = branchWide ? classes.slice(0, 1) : classes;
  const tasks = [];
  if (rangeMode) {
    // already probed classes[0..probed) in full when not branch-wide
    (branchWide ? [] : classes.slice(probed)).forEach((c) =>
      tasks.push(async () => ingest(await call(c, from, from, to))));
  } else {
    targets.forEach((c) => dates.forEach((d) => {
      tasks.push(async () => ingest(await call(c, d, d, d)));
    }));
  }
  await runPool(tasks);

  return { map, failed };
}

/* Pure calculation — no I/O.
   Working day = a date in range that is NOT a weekly-off weekday and has at
   least one real (non-holiday) attendance mark in scope. Dates with no marks
   (weekends, holidays, not yet marked) are never counted as absences. A
   student with no record on a working day is "Not marked", not absent. */
export function buildAbsenteeismReport({ classes, map, from, to, weeklyOffIdx = [] }) {
  const dates = enumerateDates(from, to);
  const { students } = buildRoster(classes);

  const marked = new Set();
  map.forEach((st, key) => { if (st !== 'holiday') marked.add(key.split('|')[1]); });
  const workingDates = dates.filter((d) => {
    const dow = (new Date(`${d}T00:00:00`).getDay() + 6) % 7;
    return !weeklyOffIdx.includes(dow) && marked.has(d);
  });

  const classAgg = new Map();
  classes.forEach((c) => classAgg.set(`${c.classID}-${c.sectionID}`, {
    key: `${c.classID}-${c.sectionID}`, cls: c.cls, sec: c.sec, label: `${c.cls} - ${c.sec}`,
    total: 0, present: 0, absent: 0, leave: 0, notMarked: 0, withAbsence: 0,
  }));

  const rows = students.map((s) => {
    const r = { present: 0, absent: 0, leave: 0, notMarked: 0 };
    workingDates.forEach((d) => {
      const st = map.get(`${s.id}|${d}`);
      if (!st || st === 'holiday') { r.notMarked++; return; }
      if (st === 'absent') r.absent++;
      else if (st === 'leave') r.leave++;
      else r.present++; // present · late · short_leave = attended
    });
    const recorded = r.present + r.absent + r.leave;
    const a = classAgg.get(`${s.cls.classID}-${s.cls.sectionID}`);
    a.total++; a.present += r.present; a.absent += r.absent; a.leave += r.leave; a.notMarked += r.notMarked;
    if (r.absent > 0) a.withAbsence++;
    return {
      id: s.id, name: s.name, reg: s.reg, classLabel: `${s.cls.cls} - ${s.cls.sec}`,
      ...r, recorded, absentPct: recorded ? Math.round((r.absent / recorded) * 1000) / 10 : 0,
    };
  });

  const pctOf = (o) => {
    const rec = o.present + o.absent + o.leave;
    return rec ? Math.round((o.absent / rec) * 1000) / 10 : 0;
  };
  const classRows = [...classAgg.values()].map((a) => ({ ...a, absentPct: pctOf(a) }));
  const totals = classRows.reduce((t, a) => ({
    total: t.total + a.total, present: t.present + a.present, absent: t.absent + a.absent,
    leave: t.leave + a.leave, notMarked: t.notMarked + a.notMarked, withAbsence: t.withAbsence + a.withAbsence,
  }), { total: 0, present: 0, absent: 0, leave: 0, notMarked: 0, withAbsence: 0 });
  totals.absentPct = pctOf(totals);

  return {
    periodDays: dates.length,
    workingDays: workingDates.length,
    classRows,
    students: rows.sort((x, y) => y.absent - x.absent || x.classLabel.localeCompare(y.classLabel) || x.name.localeCompare(y.name)),
    totals,
  };
}
