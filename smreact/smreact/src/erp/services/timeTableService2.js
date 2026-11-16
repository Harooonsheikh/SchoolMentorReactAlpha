import { buildUrl, resolveMediaUrl, activeSessionName } from '../../utils/apiConfig';

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
const authHeaders = (extra = {}) => {
  const t = ss('token');
  return { Accept: 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
};

/* ═══════════════ REQUEST CACHE — sirf Timetable screen ke khule rehne tak ═══════════════
   Classes, employees, subjects aur report header is screen par badalte nahi,
   magar pehle har jagah se alag alag mangwaye jate the: getTimeTable ke andar
   bhi aur component me bhi (employees 4×), Update modal kholne par subjects
   dobara, Auto Generate kholne par sab dobara, aur StrictMode (dev) me har
   cheez 2×. Ab:
     • ek hi request chal rahi ho to dusra caller USI promise ko leta hai
       (in-flight dedupe — StrictMode ka double mount bhi isi se ek ho jata hai);
     • jawab screen ke khule rehne tak yaad rehta hai (retainTimeTableCache);
       screen band hote hi cache saaf — wapas aane par sab TAZA aata hai,
       purana data nahi.
   Timetable ki rows kabhi cache nahi hotin — sirf in-flight dedupe. Har likhne
   (insert/update/delete) par in-flight rows bhi bhula di jati hain, taake likhne
   se pehle shuru hui GET ka purana jawab dobara istemal na ho. */
const refCache = new Map();      // key -> promise (reference data)
const dayInflight = new Map();   // key -> promise (timetable rows, sirf chalte hue)
let holders = 0;
let clearTimer = null;

/** Screen mount par bulao; jo function lautta hai woh unmount par. Cache sirf
    tab tak rehta hai jab tak koi Timetable screen khuli ho. StrictMode ka
    unmount→remount ek hi tick me hota hai, is liye safai agle tick par hoti
    hai aur remount use cancel kar deta hai. */
export function retainTimeTableCache() {
  holders += 1;
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders <= 0) {
      holders = 0;
      clearTimer = setTimeout(() => { clearTimer = null; if (holders === 0) refCache.clear(); }, 0);
    }
  };
}

/** Tests ke liye. */
export function __resetTimeTableCache() {
  refCache.clear();
  dayInflight.clear();
  holders = 0;
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
}

/* Screen khuli ho to yaad rakho; warna (masalan global search se) har baar
   seedha mangwao — pehle jaisa. Nakaami kabhi yaad nahi rehti. */
function cachedRef(key, loader) {
  const k = `${branchID()}|${key}`;
  if (refCache.has(k)) return refCache.get(k);
  const p = loader();
  if (holders > 0) {
    refCache.set(k, p);
    p.catch(() => { if (refCache.get(k) === p) refCache.delete(k); });
  }
  return p;
}

const getJson = (path) => fetch(buildUrl(path), { headers: authHeaders() }).then((res) => res.json());

/* Branch employees ka raw jawab — teacher dropdown aur auto-generate ki
   subject→teacher assignments dono isi EK request se bante hain. */
const loadEmployeesRaw = () => cachedRef('employees', () => getJson(`/api/LaunchSetup/get-employees-by-branch/${branchID()}`));

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
    /* Branch-scoped class list — Fee wala hi endpoint. Purana
       /get-classlist-sectionlist-studentlist-by-branch/{branch}/{empID}
       tab 0 classes deta tha jab logged-in user (admin/school-head) ka
       employee_ID khaali/0 hota — is se timetable ki table poori khaali
       reh jati thi. Ye branch-only endpoint har account type ke liye
       classes deta hai, employee_ID ki zarurat nahi. */
    const json = await cachedRef('classes', () => getJson(`/api/LaunchSetup/get-class-section-studentlist-by-branch/${branchID()}`));
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
   [{ id: subjectID, name: subjectName }].
   GET /api/LaunchSetup/get-subjects/{gradeId}/{sectionId} — class ke SAARE
   subjects. Pehle get-subjects_byEmployeeID tha jo sirf logged-in employee
   ke subjects deta tha; timetable poori class ka banta hai. */
export async function getSubjectsForClass(classID, sectionID) {
  try {
    const json = await cachedRef(`subjects:${classID}_${sectionID}`, () => getJson(`/api/LaunchSetup/get-subjects/${classID}/${sectionID}`));
    const arr = (json && json.data) || (Array.isArray(json) ? json : []);
    return (arr || [])
      .filter((s) => s.isActive !== false)
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
    const json = await loadEmployeesRaw();
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

/* gradeId_sectionId_subjectId → [employeeId, …] for auto-generate teacher pick. */
export async function getSubjectTeacherAssignments(branchId) {
  const bid = branchId ?? branchID();
  const json = String(bid) === String(branchID())
    ? await loadEmployeesRaw()
    : await getJson(`/api/LaunchSetup/get-employees-by-branch/${bid}`);
  const map = {};
  (json?.data || []).forEach((emp) => {
    if (!emp.isActive) return;
    (emp.assignments || []).forEach((a) => {
      const k = `${a.gradeId}_${a.sectionId}_${a.subjectId}`;
      if (!map[k]) map[k] = [];
      if (!map[k].includes(emp.id)) map[k].push(emp.id);
    });
  });
  return map;
}

/* Branch report header (school name + logo + address + academic session) for
   report headers/footers — same /report-header API the other reports use. */
export async function getReportHeader() {
  try {
    const json = await cachedRef('report-header', () =>
      fetch(buildUrl(`/report-header/${branchID()}`), { headers: { Accept: '*/*' } }).then((res) => res.json()));
    const d = (json && json.data) || {};
    return {
      name: d.branchName || 'School Mentor',
      logo: resolveMediaUrl(d.branchLogo),
      address: d.address || '',
    /* The ERP's own active session wins over the branch header's
       `academicSession` string: the header is a branch-profile field that is
       not updated when the school rolls over to a new session (or when the
       user switches sessions), so trusting it first is how a report ends up
       stamped with last year's session. */
      session: activeSessionName() || d.academicSession || '',
      generatedDate: d.generatedDate || '',
    };
  } catch (e) {
    console.error('Could not load report header:', e);
    return { name: 'School Mentor', logo: '', address: '', session: activeSessionName(), generatedDate: '' };
  }
}

function ttPost(body, { signal } = {}) {
  /* Koi bhi likhna → chalti hui GETs bhula do (unka jawab likhne se pehle ka ho sakta hai). */
  if (body && body.action && body.action !== 'get') dayInflight.clear();
  return fetch(buildUrl('/api/branch-timetable'), {
    method: 'POST',
    signal,
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

/* Ek din ki rows — ek hi waqt me usi din ki dusri GET chal rahi ho to wahi
   promise (StrictMode / do callers). Signal wali call apni alag request
   bhejti hai taake usay cancel kiya ja sake. */
function getDayRows(dayName, di, signal) {
  const send = () => ttPost({ action: 'get', day: dayName, dayOrder: di }, { signal });
  if (signal) return send();
  const k = `${branchID()}|${di}`;
  if (dayInflight.has(k)) return dayInflight.get(k);
  const p = send();
  dayInflight.set(k, p);
  const done = () => { if (dayInflight.get(k) === p) dayInflight.delete(k); };
  p.then(done, done);
  return p;
}

/* action:'get' → grouped { [dayIndex]: { [classID_sectionID]: periods[] } }.
   Each period: { id, startTime, endTime, teacherId, teacher(name), subject, period }.
   Teacher names are resolved from the employees list. */
export function getTimeTable() {
  return getTimeTableDays(DAYS.map((_, di) => di));
}

/**
 * Sirf diye gaye dinon ki rows mangwao — save/delete ke baad sirf wahi din
 * taaza hota hai jo badla, poora hafta nahi. Har mangwaya hua din natije me
 * hota hai (khaali ho to {}), taake purana data us din ka mit jaye.
 * Ek din ki GET nakaam ho to wo din natije me NAHI hota — screen par us din
 * ka pichhla data rehta hai (khaali dikha kar dhoka nahi).
 * @param {number[]} dayIndices  0 = Monday … 5 = Saturday
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function getTimeTableDays(dayIndices, { signal } = {}) {
  const wanted = [...new Set((dayIndices || []).map(Number))].filter((di) => DAYS[di]);
  const teachers = await getTeachers().catch(() => []);
  const tMap = {};
  teachers.forEach((t) => { tMap[String(t.id)] = t.name; });

  /* GET is per-day — the `day` field must be set. Fetch every day and combine.
     Each returned row is tagged with the queried day index (__di) as a fallback. */
  const failed = new Set();
  const perDay = await Promise.all(
    wanted.map((di) => getDayRows(DAYS[di], di, signal).catch((e) => {
      if (e && e.name === 'AbortError') throw e;
      failed.add(di);
      return [];
    })),
  );
  try { console.log('🗓️ TimeTable GET raw (per-day) →', perDay.map((raw, i) => ({ day: DAYS[wanted[i]], raw }))); } catch (e) { /* no-op */ }
  const rows = [];
  const seenIds = new Set();
  perDay.forEach((raw, i) => {
    const di = wanted[i];
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
  wanted.forEach((di) => { if (!failed.has(di)) data[di] = {}; });
  (rows || []).forEach((r) => {
    /* Read every field in both camelCase and PascalCase so the mapping works
       regardless of how the backend serialises the response. */
    const cid = r.classID ?? r.ClassID ?? r.classId ?? r.gradeID ?? r.GradeID;
    const sec = r.sectionId ?? r.sectionID ?? r.SectionID ?? r.SectionId ?? 0;
    const dn = String(r.day ?? r.Day ?? '').trim();
    let di = DAYS.findIndex((d) => d.toLowerCase() === dn.toLowerCase());
    if (di < 0) di = Number(r.dayOrder ?? r.DayOrder ?? r.__di) || 0;
    /* Jo din mangwaya hi nahi (API ne zaid row bhej di) us par kuch na likho. */
    if (!wanted.includes(di) || failed.has(di)) return;
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

/* Do period lists ek jaisi hain? (wahi waqt, subject aur teacher, wahi tarteeb)
   Jo class/din bilkul nahi badla us par koi request nahi jati. */
const periodSig = (p) => {
  const brk = isBreakPeriod(p);
  return [
    normTime(p?.startTime), normTime(p?.endTime),
    brk ? TT_BREAK_SUBJECT_ID : (Number(p?.subjectId) || 0),
    brk ? 0 : (Number(p?.teacherId) || 0),
  ].join('|');
};
export function samePeriods(a = [], b = []) {
  if ((a || []).length !== (b || []).length) return false;
  return (a || []).every((p, i) => periodSig(p) === periodSig(b[i]));
}

/* Replace a class's periods for a day: delete the existing rows, then insert
   the new list (delete-all-then-insert keeps the backend in exact sync with
   what the editor shows). */
export async function replaceClassDayTimeTable({ dayIndex, classID, sectionID, classOrder = 0, oldPeriods = [], periods = [] }) {
  /* Kuch badla hi nahi → server ko kuch bhejne ki zarurat nahi. */
  if (samePeriods(oldPeriods, periods) && (oldPeriods || []).every((p) => p.id)) return { ok: true, unchanged: true };
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
