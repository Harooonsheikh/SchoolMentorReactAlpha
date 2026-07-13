import { buildUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   TIME TABLE SERVICE — real API (POST /api/branch-timetable)

   The single CRUD endpoint switches on `action`:
     • 'get'    → all rows for the branch (classID/sectionId 0)
     • 'insert' → add one period row (id 0)
     • 'update' → edit one period row (id > 0)
     • 'delete' → remove one row by id

   Classes come from get-classlist-sectionlist-studentlist-by-branch and
   teachers from LaunchSetup/get-employees-by-branch. The POST body has no
   `subject` field, so subject is a UI-only field (not persisted); only the
   teacher (an employee id) is saved per period.
   ═══════════════════════════════════════════════════════════════════ */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* Break/Recess ke pass koi real subject id nahi hota (subjectId 0). Backend sirf
   `period` (subjectId) persist karta hai — subject text nahi — is liye 0 par break
   aur empty period ek jaise ho jate hain aur reload par break gum ho jata tha.
   Break ko is sentinel id se save karte hain aur load par wapas 'Break' bana lete
   hain, taake manual save, auto-generate aur reports sab me break persist rahe. */
export const TT_BREAK_SUBJECT_ID = -1;
const isBreakPeriod = (p) =>
  String(p?.subject ?? p?.Subject ?? p?.subjectName ?? p?.SubjectName ?? '').trim().toLowerCase() === 'break'
  || Number(p?.subjectId ?? p?.subjectID) === TT_BREAK_SUBJECT_ID;

const ss = (k) => sessionStorage.getItem(k) || '';
const branchID = () => ss('branchID') || '1';
const empID = () => ss('employee_ID') || '';
const authHeaders = (extra = {}) => {
  const t = ss('token');
  return { Accept: 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
};

/* "08:00:00" / "08:00 AM" → "08:00" for <input type="time">. */
function normTime(t) {
  if (!t) return '';
  const s = String(t).trim();
  const ampm = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(s);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const p = ampm[3].toUpperCase();
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const m = /(\d{1,2}):(\d{2})/.exec(s);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s;
}

/* Flatten the class list into one row per class × section:
   { id: classID, name, sectionID, section }. */
export async function getTimeTableClasses() {
  try {
    const res = await fetch(
      buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${branchID()}/${empID()}`),
      { headers: authHeaders() },
    );
    const json = await res.json();
    const arr = Array.isArray(json) ? json : (json?.data || []);
    const out = [];
    arr.forEach((cls) => {
      const cid = cls.id ?? cls.gradeID ?? cls.classID;
      const name = cls.name || cls.gradeName || cls.className || '';
      const secs = cls.sections || [];
      if (secs.length) {
        secs.forEach((s) => out.push({
          id: cid, name,
          sectionID: s.sectionID ?? s.sectionId ?? 0,
          section: s.sectionName || s.name || '',
        }));
      } else {
        out.push({ id: cid, name, sectionID: 0, section: '' });
      }
    });
    return out;
  } catch (e) {
    console.error('Could not load timetable classes:', e);
    return [];
  }
}

/* Real subjects for a class × section (for the period Subject dropdown):
   [{ id: subjectID, name: subjectName }]. */
export async function getSubjectsForClass(classID, sectionID) {
  try {
    const res = await fetch(
      buildUrl(`/get-subjects_byEmployeeID/${classID}/${sectionID}/${empID()}`),
      { headers: authHeaders() },
    );
    const json = await res.json();
    const arr = (json && json.data) || (Array.isArray(json) ? json : []);
    return (arr || [])
      .map((s) => ({ id: s.subjectID ?? s.id ?? 0, name: s.subjectName ?? s.name ?? s.subject ?? '' }))
      .filter((s) => s.name);
  } catch (e) {
    console.error('Could not load class subjects:', e);
    return [];
  }
}

/* Branch employees for the teacher dropdown: { id, name, designation }. */
export async function getTeachers() {
  try {
    const res = await fetch(
      buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchID()}`),
      { headers: authHeaders() },
    );
    const json = await res.json();
    const arr = Array.isArray(json) ? json : (json?.data || []);
    return arr
      .filter((e) => e.isActive !== false)
      .map((e) => ({
        id: e.id ?? e.employeeID ?? e.userID,
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || `Employee #${e.id}`,
        designation: e.designationName || e.designation || '',
      }));
  } catch (e) {
    console.error('Could not load teachers:', e);
    return [];
  }
}

/* Branch report header (school name + logo + address + academic session) for
   report headers/footers — same /report-header API the other reports use. */
export async function getReportHeader() {
  try {
    const res = await fetch(buildUrl(`/report-header/${branchID()}`), { headers: { Accept: '*/*' } });
    const json = await res.json();
    const d = (json && json.data) || {};
    return {
      name: d.branchName || 'School Mentor',
      logo: d.branchLogo || '',
      address: d.address || '',
      session: d.academicSession || '',
      generatedDate: d.generatedDate || '',
    };
  } catch (e) {
    console.error('Could not load report header:', e);
    return { name: 'School Mentor', logo: '', address: '', session: '', generatedDate: '' };
  }
}

function ttPost(body) {
  return fetch(buildUrl('/api/branch-timetable'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: 0, branchId: Number(branchID()) || 1,
      classID: 0, sectionId: 0, classOrder: 0, dayOrder: 0,
      day: '', startTime: '', endTime: '', period: 0, teacher: 0,
      action: 'get', createdBy: 0, modifiedBy: 0,
      ...body,
    }),
  }).then((r) => r.json().catch(() => ({})));
}

/* action:'get' → grouped { [dayIndex]: { [classID_sectionID]: periods[] } }.
   Each period: { id, startTime, endTime, teacherId, teacher(name), subject, period }.
   Teacher names are resolved from the employees list. */
export async function getTimeTable() {
  const teachers = await getTeachers().catch(() => []);
  const tMap = {};
  teachers.forEach((t) => { tMap[String(t.id)] = t.name; });

  /* GET is per-day — the `day` field must be set. Fetch every day and combine.
     Each returned row is tagged with the queried day index (__di) as a fallback. */
  const perDay = await Promise.all(
    DAYS.map((dayName, di) => ttPost({ action: 'get', day: dayName, dayOrder: di }).catch(() => [])),
  );
  try { console.log('🗓️ TimeTable GET raw (per-day) →', perDay.map((raw, di) => ({ day: DAYS[di], raw }))); } catch (e) { /* no-op */ }
  const rows = [];
  const seenIds = new Set();
  perDay.forEach((raw, di) => {
    const list = Array.isArray(raw) ? raw : (raw?.data || raw?.Data || raw?.result || raw?.Result || []);
    (list || []).forEach((r) => {
      const rid = r.id ?? r.ID ?? r.Id;
      if (rid != null && seenIds.has(rid)) return; // avoid dups if the API ignores the day filter
      if (rid != null) seenIds.add(rid);
      rows.push({ ...r, __di: di });
    });
  });
  try { console.log('🗓️ TimeTable GET rows →', rows); } catch (e) { /* no-op */ }

  /* The `period` field carries the SUBJECT ID. Resolve subject names by fetching
     each involved class's subject list once, then building a subjectId → name map. */
  const classKeys = [...new Set((rows || []).map((r) => {
    const cid = r.classID ?? r.ClassID ?? r.classId ?? r.gradeID ?? r.GradeID;
    const sec = r.sectionId ?? r.sectionID ?? r.SectionID ?? r.SectionId ?? 0;
    return `${cid}_${sec}`;
  }))];
  const subjMap = {};
  await Promise.all(classKeys.map(async (ck) => {
    const [cid, sid] = ck.split('_');
    const subs = await getSubjectsForClass(cid, sid).catch(() => []);
    subs.forEach((s) => { subjMap[String(s.id)] = s.name; });
  }));

  const data = {};
  (rows || []).forEach((r) => {
    /* Read every field in both camelCase and PascalCase so the mapping works
       regardless of how the backend serialises the response. */
    const cid = r.classID ?? r.ClassID ?? r.classId ?? r.gradeID ?? r.GradeID;
    const sec = r.sectionId ?? r.sectionID ?? r.SectionID ?? r.SectionId ?? 0;
    const dn = String(r.day ?? r.Day ?? '').trim();
    let di = DAYS.findIndex((d) => d.toLowerCase() === dn.toLowerCase());
    if (di < 0) di = Number(r.dayOrder ?? r.DayOrder ?? r.__di) || 0;
    const key = `${cid}_${sec}`;
    const tid = r.teacher ?? r.Teacher ?? r.teacherId ?? r.TeacherID;
    /* subjectID is stored in the `period` field. */
    const subjId = r.period ?? r.Period ?? r.subjectID ?? r.SubjectID ?? 0;
    /* Break row → sentinel id (ya subject text 'Break') se pehchano. */
    const brk = Number(subjId) === TT_BREAK_SUBJECT_ID
      || String(r.subject ?? r.Subject ?? r.subjectName ?? r.SubjectName ?? '').trim().toLowerCase() === 'break';
    if (!data[di]) data[di] = {};
    if (!data[di][key]) data[di][key] = [];
    data[di][key].push({
      id: r.id ?? r.ID ?? r.Id,
      startTime: normTime(r.startTime ?? r.StartTime),
      endTime: normTime(r.endTime ?? r.EndTime),
      teacherId: brk ? 0 : tid,
      teacher: brk ? '' : (tMap[String(tid)] || ''),
      subjectId: brk ? TT_BREAK_SUBJECT_ID : subjId,
      subject: brk ? 'Break' : (subjMap[String(subjId)] || r.subject || r.Subject || r.subjectName || r.SubjectName || ''),
    });
  });
  // Keep each class's periods in start-time order.
  Object.values(data).forEach((dayObj) =>
    Object.values(dayObj).forEach((list) =>
      list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))));
  try { console.log('🗓️ TimeTable grouped →', Object.entries(data).map(([d, o]) => ({ day: d, keys: Object.keys(o) }))); } catch (e) { /* no-op */ }
  return data;
}

/* Insert (id 0) or update (id > 0) one period row. */
export async function saveTimeTablePeriod({ dayIndex, classID, sectionID, classOrder = 0, periodIndex, period }) {
  const brk = isBreakPeriod(period);
  /* `period` field carries the SUBJECT ID. Break → sentinel id (warna 0 par reload
     par break pehchana nahi jata). */
  const periodVal = brk ? TT_BREAK_SUBJECT_ID : (Number(period.subjectId) || 0);
  const payload = {
    id: period.id || 0,
    classID: Number(classID) || 0,
    sectionId: Number(sectionID) || 0,
    classOrder: Number(classOrder) || 0,
    dayOrder: Number(dayIndex) || 0,
    day: DAYS[dayIndex] || '',
    startTime: period.startTime || '',
    endTime: period.endTime || '',
    /* `period` field carries the SUBJECT ID (backend has no separate subject column). */
    period: periodVal,
    teacher: brk ? 0 : (Number(period.teacherId) || 0),
    /* Also send subject fields (harmless if the backend ignores them). */
    subject: brk ? 'Break' : (period.subject || ''),
    subjectName: brk ? 'Break' : (period.subject || ''),
    subjectID: periodVal,
    action: period.id ? 'update' : 'insert',
  };
  const resp = await ttPost(payload);
  if (resp && (resp.success === false || resp.Success === false)) {
    console.error('🗓️ TimeTable save FAILED:', resp.message || resp.Message || resp, '| payload:', payload);
  } else {
    console.log('🗓️ TimeTable save OK:', resp);
  }
  return resp;
}

/* Delete one period row by id. */
export async function deleteTimeTablePeriod(id) {
  const resp = await ttPost({ id: Number(id) || 0, action: 'delete' });
  if (resp && (resp.success === false || resp.Success === false)) {
    console.error('🗓️ TimeTable delete FAILED (id ' + id + '):', resp.message || resp.Message || resp);
  } else {
    console.log('🗓️ TimeTable delete OK (id ' + id + '):', resp);
  }
  return resp;
}

/* Replace a class's periods for a day: delete the existing rows, then insert
   the new list (delete-all-then-insert keeps the backend in exact sync with
   what the editor shows). */
export async function replaceClassDayTimeTable({ dayIndex, classID, sectionID, classOrder = 0, oldPeriods = [], periods = [] }) {
  await Promise.all((oldPeriods || []).filter((p) => p.id).map((p) => deleteTimeTablePeriod(p.id)));
  await Promise.all((periods || []).map((p, i) =>
    saveTimeTablePeriod({ dayIndex, classID, sectionID, classOrder, periodIndex: i, period: { ...p, id: 0 } })));
  return { ok: true };
}

/* Delete all of a class's period rows for a day (by their ids). */
export async function deleteClassDayTimeTable(oldPeriods = []) {
  const ids = (oldPeriods || []).filter((p) => p.id).map((p) => p.id);
  console.log('🗓️ TimeTable deleting ids →', ids, '(from', (oldPeriods || []).length, 'periods)');
  await Promise.all(ids.map((id) => deleteTimeTablePeriod(id)));
  return { ok: true };
}
/* Report header (school name, logo, address, session) for PDF reports */
// export async function getReportHeader() {
//   const res = await fetch(`${API_BASE}/report-header/${BRANCH_ID}`, { headers: authHeaders() });
//   const json = await res.json();
//   return json?.success ? json.data : null;
// }
