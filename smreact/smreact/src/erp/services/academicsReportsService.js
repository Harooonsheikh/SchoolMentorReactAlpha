import { buildUrl, activeSessionName, readStoredActiveSession } from '../../utils/apiConfig';
import { clone } from './_http';
import * as hrService from './hrService';
import * as attendanceService from './attendanceService';
import * as resourceLibraryService from './resourceLibraryService';

/* ═══════════════════════════════════════════════════════════════════
   ACADEMICS → REPORTS SERVICE (LIVE ONLY)

   Academics › Reports tab + Teacher Performance report. Koi mock/static
   seed nahi — API fail / empty ho to empty array/object. Same endpoints
   Lesson Plans › Submissions / Paper Generator / Attendance use karte hain.
   ═══════════════════════════════════════════════════════════════════ */

const authHeaders = (extra = {}) => ({
  Accept: '*/*',
  Authorization: `bearer ${sessionStorage.getItem('token') || ''}`,
  ...extra,
});
const branchId = () => Number(sessionStorage.getItem('branchID')) || 0;
const branchIdStr = () => String(sessionStorage.getItem('branchID') || '');
const sessionYearId = () =>
  sessionStorage.getItem('changeSessionId')
  || sessionStorage.getItem('SessionID')
  || sessionStorage.getItem('sessionID')
  || '';
const rowsOf = (json) => (Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []));
const iso10 = (d) => (d ? String(d).slice(0, 10) : '');
const todayIso = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

async function mapLimited(items, limit, mapper) {
  const list = Array.isArray(items) ? items : [];
  const out = new Array(list.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, list.length || 1)).fill(0).map(async () => {
    while (cursor < list.length) {
      const i = cursor++;
      out[i] = await mapper(list[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/* GET JSON with one retry on network error / 429 / 5xx — bahut saari parallel
   calls me kabhi kabhi server throttle karta tha aur report khali (0) aa jati thi. */
async function getJsonRetry(path, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(buildUrl(path), { method: 'GET', headers: authHeaders() });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return await res.json().catch(() => ({}));
    } catch (e) {
      lastErr = e;
      // eslint-disable-next-line no-await-in-loop
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

/* ─── Branch grades + employees (LaunchSetup) ─── */
async function fetchBranchGrades() {
  const json = await getJsonRetry(`/api/LaunchSetup/get-grades-by-branch/${branchIdStr()}`);
  const list = Array.isArray(json) ? json : (json?.data || json?.Data || json?.result || []);
  return list.map((g) => ({
    gradeId: g.gradeID ?? g.gradeId ?? g.id ?? g.classID ?? g.ClassID,
    gradeName: g.gradeName ?? g.name ?? g.className ?? g.grade ?? g.Name ?? `Grade ${g.gradeID ?? g.id ?? ''}`,
    sections: (g.sections || g.sectionList || g.Sections || []).map((s) => ({
      sectionId: s.sectionID ?? s.sectionId ?? s.id ?? s.SectionID,
      sectionName: s.sectionName ?? s.name ?? s.section ?? s.SectionName ?? '',
    })).filter((s) => s.sectionId != null),
  })).filter((g) => g.gradeId != null);
}

/* Employee list already carries its subject assignments (same field HR's
   mapApiEmployeeToEmp reads). `assignments` = null → field absent in the API,
   caller falls back to per-section get-subjects_byEmployeeID calls. */
function employeeAssignmentRows(e) {
  const rows = e.assignments ?? e.subjectAssignments ?? e.employeeSubjects ?? e.subjects;
  if (!Array.isArray(rows)) return null;
  return rows.map((a) => ({
    gradeId: a.gradeId ?? a.gradeID ?? a.grade_id ?? a.classID,
    sectionId: a.sectionId ?? a.sectionID ?? a.section_id,
    subjectId: a.subjectId ?? a.subjectID ?? a.subject_id,
    subjectName: a.subjectName ?? a.subject ?? '',
  })).filter((a) => a.gradeId != null && a.sectionId != null && a.subjectId != null);
}

async function fetchBranchEmployees() {
  const json = await getJsonRetry(`/api/LaunchSetup/get-employees-by-branch/${branchIdStr()}`);
  const list = Array.isArray(json) ? json : (json?.data || json?.Data || json?.result || []);
  return list.map((e) => ({
    empId: e.employeeID ?? e.employeeId ?? e.empID ?? e.id ?? e.EmployeeID,
    name: (e.employeeName ?? e.name ?? e.fullName)
      || (`${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || 'Teacher'),
    designation: e.designation ?? e.designationName ?? e.role ?? '',
    assignments: employeeAssignmentRows(e),
  })).filter((e) => e.empId != null);
}

async function fetchClassSubjects(gradeId, sectionId) {
  const json = await getJsonRetry(`/api/LaunchSetup/get-subjects/${gradeId}/${sectionId}`).catch(() => ({}));
  const list = Array.isArray(json) ? json : (json?.data || []);
  return list
    .map((s) => ({ subjectId: s.subjectID ?? s.subjectId ?? s.id, subjectName: s.subjectName ?? s.name ?? '' }))
    .filter((s) => s.subjectId != null);
}

async function fetchEmployeeSubjects(gradeId, sectionId, empId) {
  const json = await getJsonRetry(`/get-subjects_byEmployeeID/${gradeId}/${sectionId}/${empId}`).catch(() => ({}));
  const list = (json?.success && Array.isArray(json.data))
    ? json.data
    : (Array.isArray(json) ? json : (json?.data || []));
  return list
    .map((s) => ({ subjectId: s.subjectID ?? s.subjectId ?? s.id, subjectName: s.subjectName ?? s.name ?? '' }))
    .filter((s) => s.subjectId != null);
}

function classLabel(gradeName, sectionName) {
  const g = (gradeName || '').trim();
  const s = (sectionName || '').trim();
  return s ? `${g} - ${s}` : g;
}

/* ─── Shared LP + NB + assignments bundle (cached ~60s) ─── */
const NB_CATS = [
  { key: 'wordOpposite', typeId: 'word_opposite', recTitle: 'Wordopposite', preview: (r) => `${r.word || ''} → ${r.opposite || ''}` },
  { key: 'singularPlural', typeId: 'singular_plural', recTitle: 'Singularplural', preview: (r) => `${r.singular || ''} → ${r.plural || ''}` },
  { key: 'wordSynonym', typeId: 'word_synonyms', recTitle: 'wordSynonyms', preview: (r) => `${r.word || ''} → ${r.synonym || ''}` },
  { key: 'wordSentences', typeId: 'word_sentences', recTitle: 'WordSentences', preview: (r) => `${r.word || ''}: ${r.sentences || ''}` },
  { key: 'mcQs', typeId: 'mcqs', recTitle: 'MCQs', preview: (r) => `${r.question || ''}` },
  { key: 'fillTheBlanks', typeId: 'fill_blanks', recTitle: 'FillintheBlank', preview: (r) => `${r.question || ''}` },
  { key: 'trueFalseQuestions', typeId: 'true_false', recTitle: 'TrueFalse', preview: (r) => `${r.question || ''}` },
  { key: 'matchColumns', typeId: 'match_columns', recTitle: 'MatchColume', preview: (r) => `${r.columnA || ''} ↔ ${r.columnB || ''}` },
  { key: 'questionAnswers', typeId: 'short_questions', recTitle: 'QuestionAns', preview: (r) => `${r.question || ''}` },
  { key: 'longQuestion', typeId: 'long_question', recTitle: 'LongQuetion', preview: (r) => `${r.question || ''}` },
  { key: 'comprehensionQuestions', typeId: 'comprehension', recTitle: 'Comprehension', preview: (r) => `${r.question || ''}` },
  { key: 'punctuation', typeId: 'punctuation', recTitle: 'Punctuation', preview: (r) => `${r.punctuation || ''}` },
  { key: 'circleCorrectWord', typeId: 'circle_words', recTitle: 'CircleCorrectWord', preview: (r) => `${r.question || ''}` },
  { key: 'mdlParagraph', typeId: 'paragraph', recTitle: 'Paragraph', preview: (r) => `${r.topic || ''}` },
  { key: 'stories', typeId: 'stories', recTitle: 'stories', preview: (r) => `${r.subject || ''}` },
  { key: 'letters', typeId: 'letter', recTitle: 'letters', preview: (r) => `${r.subject || ''}` },
  { key: 'applications', typeId: 'application', recTitle: 'application', preview: (r) => `${r.subject || ''}` },
  { key: 'essays', typeId: 'essays', recTitle: 'essays', preview: (r) => `${r.subject || ''}` },
];

async function fetchNbCheckedSet(notebookID, gradeID, subjectID) {
  const set = new Set();
  try {
    const res = await fetch(
      buildUrl(`/api/getqpselectiondetail?notebookID=${notebookID}&gradeID=${gradeID}&subjectID=${subjectID}`),
      { method: 'GET', headers: authHeaders() },
    );
    const json = await res.json().catch(() => ({}));
    const list = Array.isArray(json) ? json
      : (json?.data || json?.mdlQPSelectionDetails || json?.qpSelectionDetails || []);
    (list || []).forEach((s) => {
      const rt = (s.recTitle ?? s.recordTitle ?? s.RecTitle ?? '').toString().trim().toLowerCase();
      const rid = s.recID ?? s.recId ?? s.recordID ?? s.recordId ?? s.RecID;
      if (rt && rid != null) set.add(`${rt}__${rid}`);
    });
  } catch { /* empty set */ }
  return set;
}

async function loadNbForCell({ classID, sectionID, subjectID, className, subjectName, teacher }) {
  try {
    const units = rowsOf(await getJsonRetry(
      `/api/getulpfornotebookmaster?branchID=${branchIdStr()}&classID=${classID}&SectionID=${sectionID}&subjectID=${subjectID}&pageNo=1`,
    ));
    return Promise.all(units.map(async (u) => {
      const [dres, checkedSet] = await Promise.all([
        getJsonRetry(`/api/getulpfornotebookdetails?masterNoteBookIDs=${u.id}`).catch(() => ({})),
        fetchNbCheckedSet(u.id, classID, subjectID),
      ]);
      const questionTypes = [];
      NB_CATS.forEach((c) => {
        const apiRows = dres?.[c.key];
        if (!Array.isArray(apiRows) || !apiRows.length) return;
        const rtNorm = c.recTitle.toLowerCase();
        const items = apiRows.map((r) => ({
          id: r.id,
          preview: c.preview(r) || String(r.id),
          status: checkedSet.has(`${rtNorm}__${r.id}`) ? 'submitted' : 'pending',
        }));
        questionTypes.push({ typeId: c.typeId, mainQ: apiRows[0]?.mainQuestion || '', items });
      });
      return {
        unitId: u.id,
        unitNo: u.unitNo || '',
        unitName: u.unitName || '(no name)',
        class: className,
        subject: subjectName,
        teacher: teacher || '',
        questionTypes,
      };
    }));
  } catch (e) {
    console.error('Academics reports: NB cell load failed', { classID, sectionID, subjectID }, e);
    return [];
  }
}

async function loadLpForCell({ classID, sectionID, subjectID, className, subjectName, teacher }) {
  try {
    const masters = rowsOf(await getJsonRetry(
      `/api/getulpforclassesmaster?branchID=${branchIdStr()}&classID=${classID}&SectionID=${sectionID}&subjectID=${subjectID}&pageNo=1`,
    ));
    return Promise.all(masters.map(async (m) => {
      let status = 'pending';
      let submittedDate = '';
      try {
        const d = rowsOf(await getJsonRetry(
          `/api/getulpforclassdetailbytermsubjectandclass?MasterClassesID=${m.id}&classID=${classID}&subjectID=${subjectID}&pageNo=1`,
        ))[0];
        if (d?.id) {
          const s = rowsOf(await getJsonRetry(
            `/api/getulpforclasssuggestion?BranchID=${branchIdStr()}&ClassID=${classID}&SubjectID=${subjectID}&DetailClassID=${d.id}&pageNo=1`,
          ))[0];
          if (s) {
            status = 'submitted';
            /* Asli date na mile to khali — "aaj" lagane se date filter galat match karta tha. */
            submittedDate = iso10(s.submittedDate || s.createdAt || s.createdDate || s.createdOn
              || s.modifiedAt || s.modifiedDate || '');
          }
        }
      } catch { /* pending */ }
      return {
        id: m.id,
        unitNo: m.unitNo || '',
        unit: m.unitName ? `Unit ${m.unitNo || ''} — ${m.unitName}`.replace(/\s+/g, ' ').trim() : `Unit ${m.unitNo || m.id}`,
        topic: m.lessonPlanTopic || m.unitName || '(no topic)',
        date: iso10(m.lessonDate || m.date || m.createdAt || m.createdDate || m.createdOn || m.CreatedAt
          || m.CreatedDate || m.modifiedAt || m.modifiedDate || m.updatedAt || '') || '',
        term: m.termName || m.term || '',
        status,
        submittedDate,
        class: className,
        subject: subjectName,
        teacher: teacher || '',
      };
    }));
  } catch (e) {
    console.error('Academics reports: LP cell load failed', { classID, sectionID, subjectID }, e);
    return [];
  }
}

/* Assignments / cells — light; LP aur NB alag-alag tab pe load hote hain.
   Cache 5 min; khali / fail result cache NAHI hota (agli dafa dobara try). */
const CACHE_MS = 5 * 60 * 1000;
const cacheKey = () => `${branchIdStr()}|${sessionYearId()}`;
function cached(slot, build, isGood) {
  const key = cacheKey();
  if (slot.promise && slot.key === key && Date.now() - slot.at < CACHE_MS) return slot.promise;
  const promise = build();
  Object.assign(slot, { key, at: Date.now(), promise });
  promise.then((v) => { if (!isGood(v) && slot.promise === promise) slot.promise = null; })
    .catch(() => { if (slot.promise === promise) slot.promise = null; });
  return promise;
}

const _assignCache = { key: '', at: 0, promise: null };
function loadAssignmentsBundle() {
  return cached(_assignCache, async () => {
    const empty = { assignments: [], cells: [], classes: [] };
    try {
      const [grades, employees] = await Promise.all([fetchBranchGrades(), fetchBranchEmployees()]);
      if (!grades.length) return empty;

      /* Every class-section (flat) — parallel, not grade-by-grade. */
      const sectionsFlat = grades.flatMap((g) => (g.sections.length ? g.sections : [{ sectionId: 0, sectionName: '' }])
        .map((s) => ({ g, s, cls: classLabel(g.gradeName, s.sectionName) })));
      const sectionKey = (gid, sid) => `${gid}:${sid}`;
      const sectionByKey = new Map(sectionsFlat.map((x) => [sectionKey(x.g.gradeId, x.s.sectionId), x]));

      /* 1) Class subjects (cells) */
      const subjectsBySection = new Map();
      await mapLimited(sectionsFlat, 8, async (x) => {
        subjectsBySection.set(sectionKey(x.g.gradeId, x.s.sectionId), await fetchClassSubjects(x.g.gradeId, x.s.sectionId));
      });
      const subjectName = (gid, sid, subId, fallback) => {
        const hit = (subjectsBySection.get(sectionKey(gid, sid)) || []).find((s) => String(s.subjectId) === String(subId));
        return hit?.subjectName || fallback || '';
      };

      /* 2) Teacher assignments — employee list se (1 call). Agar API ne field
         nahi bheji / sab khali hai to purana per-section fallback (8 parallel). */
      const assignments = [];
      const teacherByCell = new Map();
      const addAssignment = (emp, gid, sid, subId, subName) => {
        const sec = sectionByKey.get(sectionKey(gid, sid));
        if (!sec) return; // is branch ki class/section nahi
        const name = subjectName(gid, sid, subId, subName);
        assignments.push({
          teacher: emp.name, class: sec.cls, subject: name,
          gradeId: sec.g.gradeId, sectionId: sec.s.sectionId, subjectId: subId,
        });
        const ck = `${gid}:${sid}:${subId}`;
        if (!teacherByCell.has(ck)) teacherByCell.set(ck, emp.name);
      };
      const listHasAssignments = employees.some((e) => e.assignments && e.assignments.length);
      if (listHasAssignments) {
        employees.forEach((emp) => (emp.assignments || []).forEach((a) => (
          addAssignment(emp, a.gradeId, a.sectionId, a.subjectId, a.subjectName)
        )));
      } else {
        const jobs = employees.flatMap((emp) => sectionsFlat.map((x) => ({ emp, x })));
        await mapLimited(jobs, 8, async ({ emp, x }) => {
          const subs = await fetchEmployeeSubjects(x.g.gradeId, x.s.sectionId, emp.empId);
          subs.forEach((sub) => addAssignment(emp, x.g.gradeId, x.s.sectionId, sub.subjectId, sub.subjectName));
        });
      }

      const cells = [];
      const seen = new Set();
      sectionsFlat.forEach((x) => {
        (subjectsBySection.get(sectionKey(x.g.gradeId, x.s.sectionId)) || []).forEach((sub) => {
          const ck = `${x.g.gradeId}:${x.s.sectionId}:${sub.subjectId}`;
          if (seen.has(ck)) return;
          seen.add(ck);
          cells.push({
            classID: x.g.gradeId,
            sectionID: x.s.sectionId,
            subjectID: sub.subjectId,
            className: x.cls,
            subjectName: sub.subjectName,
            teacher: teacherByCell.get(ck) || '',
          });
        });
      });

      const classMap = new Map();
      assignments.forEach((a) => {
        if (!classMap.has(a.class)) classMap.set(a.class, new Set());
        classMap.get(a.class).add(a.subject);
      });
      const classes = Array.from(classMap.entries()).map(([name, subs]) => ({
        name,
        subjects: Array.from(subs),
      }));

      return { assignments, cells, classes };
    } catch (e) {
      console.error('Academics reports: assignments load failed', e);
      return empty;
    }
  }, (v) => v && v.cells && v.cells.length > 0);
}

const _lpCache = { key: '', at: 0, promise: null };
const _nbCache = { key: '', at: 0, promise: null };

function loadLpRowsOnly() {
  return cached(_lpCache, async () => {
    try {
      const { cells } = await loadAssignmentsBundle();
      const parts = await mapLimited(cells, 8, (cell) => loadLpForCell(cell));
      return parts.flat(); // cell order stable (pehle push order random tha)
    } catch (e) {
      console.error('Academics reports: LP load failed', e);
      return [];
    }
  }, (v) => Array.isArray(v) && v.length > 0);
}

function loadNbRowsOnly() {
  return cached(_nbCache, async () => {
    try {
      const { cells } = await loadAssignmentsBundle();
      const parts = await mapLimited(cells, 6, (cell) => loadNbForCell(cell));
      return parts.flat();
    } catch (e) {
      console.error('Academics reports: NB load failed', e);
      return [];
    }
  }, (v) => Array.isArray(v) && v.length > 0);
}

/* Reports tab khulte hi background me shuru — user jab tak panel kholay, data tayyar. */
export function prefetchAcademicsReports() {
  loadAssignmentsBundle();
  loadLpRowsOnly();
}

export async function getSubLpData() {
  return clone(await loadLpRowsOnly());
}
export async function getSubNbData() {
  return clone(await loadNbRowsOnly());
}
export async function getAcademicsTeacherAssignments() {
  return clone((await loadAssignmentsBundle()).assignments);
}
export async function getAcademicsClasses() {
  return clone((await loadAssignmentsBundle()).classes);
}

/* Units catalog / allocations — Reports UI inhein use nahi karti; empty. */
export async function getUnitsCatalog() { return []; }
export async function getTermBreakupAllocations() { return []; }

/* Simple per-branch/session memo for the Teacher Performance loaders — panel
   dobara kholne par ya do jagah se call hone par APIs phir se na chalein. */
function memoLoader(build, isGood = (v) => (Array.isArray(v) ? v.length > 0 : !!v && Object.keys(v).length > 0)) {
  const slot = { key: '', at: 0, promise: null };
  return async () => clone(await cached(slot, build, isGood));
}

/* ─── LIVE: term breakups (gettermbreakups + details) ─── */
async function loadTermBreakups() {
  try {
    /* assignments only — LP/NB bundle yahan use nahi (tab-wise load). */
    const [terms, bundle] = await Promise.all([fetchTerms(), loadAssignmentsBundle()]);
    const termList = (terms || []).map((t) => ({ id: t.id, name: t.term || '' })).filter((t) => t.id);
    const pairs = [];
    const seen = new Set();
    (bundle.assignments || []).forEach((a) => {
      if (a.gradeId == null || a.subjectId == null) return;
      const k = `${a.gradeId}:${a.sectionId}:${a.subjectId}:${a.teacher}`;
      if (seen.has(k)) return;
      seen.add(k);
      pairs.push(a);
    });
    /* Pehle har pair ke terms ek ek karke, sirf 2 pairs saath — bahut slow tha.
       Ab pair × term flat list, 8 saath. */
    const jobs = pairs.flatMap((a) => termList.map((term) => ({ a, term })));
    const out = [];
    await mapLimited(jobs, 8, async ({ a, term }) => {
      {
        try {
          const params = new URLSearchParams({
            branchID: branchIdStr(),
            classID: String(a.gradeId),
            sectionID: String(a.sectionId ?? ''),
            subjectID: String(a.subjectId),
            termID: String(term.id),
            sessionID: String(sessionYearId()),
            pageNo: '1',
          });
          const list1 = rowsOf(await getJsonRetry(`/api/gettermbreakups?${params}`));
          const tbId = list1[0]?.id;
          if (!tbId) return;
          const res2 = await fetch(buildUrl('/api/lptermbreakupdetailscrud'), {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              id: tbId, termBreakupID: tbId, unitNumber: '', unitName: '',
              weekRequired: '', subTopic: '', periodRequired: '', type: '', action: 'get',
            }),
          });
          const json2 = await res2.json().catch(() => ({}));
          const rows = Array.isArray(json2) ? json2 : rowsOf(json2);
          rows.forEach((r, i) => {
            out.push({
              id: r.id ?? `${tbId}-${i}`,
              class: a.class,
              subject: a.subject,
              teacher: a.teacher,
              term: term.name,
              unitNum: r.unitNumber || r.unitNo || '',
              unitName: r.unitName || '',
              weeksRequired: String(r.weekRequired ?? r.weeksRequired ?? ''),
              topicsCount: Array.isArray(r.topics) ? r.topics.length : (r.subTopic ? 1 : 0),
            });
          });
        } catch { /* skip cell */ }
      }
    });
    return out;
  } catch (e) {
    console.error('Academics reports: term breakups load failed', e);
    return [];
  }
}
export const getTermBreakups = memoLoader(loadTermBreakups);

/* ─── LIVE: holidays (attendance monthly setup) ─── */
async function loadHolidays() {
  try {
    const bid = branchId();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const all = [];
    await mapLimited(months, 4, async (month) => {
      try {
        const res = await attendanceService.monthlySetup({
          id: 0,
          branchID: bid,
          dateFrom: '',
          dateTo: '',
          month,
          action: 'get',
          createdBy: 0,
          modifiedBy: 0,
          classIDs: [],
          holiday: true,
        });
        const rows = rowsOf(res);
        rows.forEach((r, i) => {
          const from = iso10(r.dateFrom || r.fromDate || r.from || r.startDate || r.DateFrom);
          const to = iso10(r.dateTo || r.toDate || r.to || r.endDate || r.DateTo || from);
          if (!from || from <= '0001-01-01') return;
          all.push({
            id: r.id ?? r.ID ?? `${month}-${i}`,
            month,
            title: r.title || r.holidayName || r.name || 'Holiday',
            desc: r.description || r.desc || '',
            from,
            to: to || from,
            classes: ['Whole School'],
          });
        });
      } catch { /* skip month */ }
    });
    return all;
  } catch (e) {
    console.error('Academics reports: holidays load failed', e);
    return [];
  }
}
export const getHolidays = memoLoader(loadHolidays);

/* ─── LIVE: student attendance snapshot (today) ─── */
async function loadStudentAttendance() {
  try {
    const bId = sessionStorage.getItem('branchID');
    const empId = sessionStorage.getItem('employee_ID');
    const sid = Number(sessionYearId()) || 0;
    const date = todayIso();
    const res = await fetch(buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${bId}/${empId}`), {
      method: 'GET', headers: { Accept: '*/*' },
    });
    const json = await res.json().catch(() => ({}));
    const classes = Array.isArray(json?.data) ? json.data : [];
    const rows = [];
    const secJobs = classes.flatMap((c) => (Array.isArray(c.sections) ? c.sections : []).map((s) => ({ c, s })));
    await mapLimited(secJobs, 8, async ({ c, s }) => {
      {
        const students = Array.isArray(s.students) ? s.students : (Array.isArray(s.studentList) ? s.studentList : []);
        const total = students.length;
        let present = 0; let absent = 0; let leave = 0; let late = 0; let marked = false;
        let markedBy = ''; let markedTime = ''; let markedFrom = '';
        try {
          const att = await attendanceService.studentAttendance({
            id: 0, branchID: branchId(), studentID: 0, sessionID: sid,
            classID: c.id, sectionID: s.sectionID ?? s.sectionId ?? 0,
            attendanceDate: date, status: '', platform: 'ERP',
            isNotificationGen: false, action: 'get', createdBy: 0, modifiedBy: 0,
          });
          const recs = (att?.data || []).filter((rec) =>
            String(rec.AttendanceDate ?? rec.attendanceDate ?? '').slice(0, 10) === date
          );
          if (recs.length) marked = true;
          const ST = { 1: 'present', 2: 'absent', 3: 'leave', 4: 'late', present: 'present', absent: 'absent', leave: 'leave', late: 'late' };
          recs.forEach((rec) => {
            const st = ST[String(rec.status ?? rec.Status).toLowerCase()] || ST[String(rec.status ?? rec.Status)] || '';
            if (st === 'present') present += 1;
            else if (st === 'absent') absent += 1;
            else if (st === 'leave') leave += 1;
            else if (st === 'late') late += 1;
            markedFrom = String(rec.Platform ?? rec.platform ?? markedFrom);
            const t = rec.CheckInTime ?? rec.checkInTime ?? '';
            if (t && !markedTime) markedTime = String(t);
          });
        } catch { /* unmarked */ }
        rows.push({
          cls: c.name || '',
          sec: s.sectionName || s.name || '',
          total,
          present,
          absent,
          leave,
          late,
          marked,
          /* Class teacher — API jo bhi naam field bheje. */
          teacher: String(s.classTeacherName ?? s.classTeacher ?? s.teacherName ?? s.inchargeName
            ?? c.classTeacherName ?? c.teacherName ?? '').trim(),
          markedBy,
          markedFrom,
          markedTime,
          timeOut: '',
        });
      }
    });
    return rows;
  } catch (e) {
    console.error('Academics reports: student attendance load failed', e);
    return [];
  }
}
export const getStudentAttendance = memoLoader(loadStudentAttendance);

/* ─── LIVE: staff attendance snapshot (today) ─── */
async function loadStaffAttendance() {
  try {
    const date = todayIso();
    const [emps, att] = await Promise.all([
      fetchBranchEmployees(),
      attendanceService.staffAttendance({
        id: 0, branchID: branchId(), employeeID: 0, sessionID: Number(sessionYearId()) || 0,
        attendanceDate: date, status: '', platform: 'ERP',
        isNotificationGen: false, action: 'get', createdBy: 0, modifiedBy: 0,
      }).catch(() => ({ data: [] })),
    ]);
    const byEmp = new Map();
    (att?.data || []).forEach((r) => {
      const id = String(r.employeeID ?? r.EmployeeID ?? r.empID ?? '');
      if (id) byEmp.set(id, r);
    });
    const ST = { 1: 'present', 2: 'absent', 3: 'leave', 4: 'late', present: 'present', absent: 'absent', leave: 'leave', late: 'late' };
    return emps.map((e) => {
      const rec = byEmp.get(String(e.empId));
      const raw = rec ? (rec.status ?? rec.Status) : '';
      const status = ST[String(raw).toLowerCase()] || ST[String(raw)] || (rec ? 'present' : '');
      return {
        name: e.name,
        empId: String(e.empId),
        desig: e.designation || '',
        dept: 'Academics',
        /* Aaj ka record hi nahi to "absent" nahi — "not marked". */
        status: status || 'not marked',
        inTime: String(rec?.CheckInTime ?? rec?.checkInTime ?? ''),
        outTime: String(rec?.CheckOutTime ?? rec?.checkOutTime ?? ''),
        from: String(rec?.Platform ?? rec?.platform ?? ''),
        marked: !!rec,
      };
    });
  } catch (e) {
    console.error('Academics reports: staff attendance load failed', e);
    return [];
  }
}
export const getStaffAttendance = memoLoader(loadStaffAttendance);

/* ─── LIVE: question papers (getexamqpmasterbyids per class/section) ─── */
async function loadAllPapers() {
  try {
    const bId = sessionStorage.getItem('branchID');
    const empId = sessionStorage.getItem('employee_ID');
    const res = await fetch(buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${bId}/${empId}`), {
      method: 'GET', headers: { Accept: '*/*' },
    });
    const json = await res.json().catch(() => ({}));
    const classList = Array.isArray(json?.data) ? json.data : [];
    const papersByKey = {};
    const secJobs = classList.flatMap((c) => (Array.isArray(c.sections) ? c.sections : []).map((s) => ({ c, s })));
    await mapLimited(secJobs, 8, async ({ c, s }) => {
      {
        const gradeId = c.id;
        const sectionID = s.sectionID ?? s.sectionId ?? 0;
        const secName = s.sectionName || s.name || 'A';
        const key = `${(c.name || 'Class').replace(/\s+/g, '_')}_${secName}`;
        try {
          const pr = await fetch(
            buildUrl(`/api/getexamqpmasterbyids?branchID=${branchIdStr()}&gradeId=${gradeId}&sectionID=${sectionID}&pageNo=1`),
            { method: 'GET', headers: authHeaders() },
          );
          const list = rowsOf(await pr.json().catch(() => ({})));
          papersByKey[key] = list.map((p) => {
            const created = String(p.createdDate || '').trim();
            const [datePart = '', ...timeParts] = created.split(' ');
            return {
              ...p,
              subj: p.subjectName || p.subj || '—',
              title: p.paperTitle || p.title || 'Untitled Paper',
              type: p.paperType || p.type || 'both',
              format: p.paperFormate || p.format || 'with',
              objMarks: +p.marksforobject || 0,
              objTime: +p.timeforobject || 0,
              subjMarks: +p.marksforsubjective || 0,
              subjTime: +p.timeforsubjective || 0,
              date: datePart || '—',
              time: timeParts.join(' ') || '',
              by: p.createdByName || p.createdBy || p.by || 'Admin',
              teacher: p.teacherName || p.createdByName || p.createdBy || '',
            };
          });
        } catch {
          papersByKey[key] = [];
        }
      }
    });
    return papersByKey;
  } catch (e) {
    console.error('Academics reports: papers load failed', e);
    return {};
  }
}
export const getAllPapers = memoLoader(loadAllPapers);

/* ─── LIVE: resource library (worksheets etc.) ─── */
export async function getTeacherResources() {
  try {
    const rows = await resourceLibraryService.fetchBranchResources(branchId());
    return clone(rows.map((r) => ({
      id: r.id,
      className: r.className || '',
      subjectName: r.subjectName || '',
      category: r.category || '',
      title: r.title || '',
      uploadedAt: r.uploadedAt || '',
      /* Live resource rows usually have no uploader name — leave blank
         rather than inventing demo teachers. */
      uploadedBy: r.uploadedBy || r.createdByName || '',
    })));
  } catch (e) {
    console.error('Academics reports: resources load failed', e);
    return [];
  }
}

/* ─── LIVE: weekly-off days (Mon-indexed 0..6) ─── */
const DAYS_F = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export async function getWeeklyOff() {
  try {
    const response = await attendanceService.getWeeklyOffSetup();
    const data = Array.isArray(response?.data) ? response.data : [];
    return data.map((item) => DAYS_F.indexOf(item.WeekDay ?? item.weekDay)).filter((i) => i !== -1);
  } catch (e) {
    console.error('Academics reports: weekly-off load failed', e);
    return [];
  }
}

/* ─── LIVE: HR employees (join date + leaves) ─── */
export async function getHrEmployees() {
  let live = [];
  try { live = await hrService.getHrEmployees(); }
  catch (e) { console.error('Academics reports: HR employees load failed', e); }
  const norm = (e) => {
    const l = e.leaves || {};
    const n = (v) => (v === '' || v == null ? 0 : Number(v) || 0);
    return {
      ...e,
      leaves: {
        ...l,
        annual: n(l.annual), casual: n(l.casual), sick: n(l.sick), maternity: n(l.maternity),
        balance: l.balance === '' || l.balance == null ? undefined : Number(l.balance),
      },
    };
  };
  return clone(live.map(norm));
}

/* ─── LIVE: academic session + vacations (one shared fetch) ─── */
function computeSession(base, vacations = []) {
  const wpw = Number(base.workingDaysPerWeek) || 0;
  const parseDate = (d) => {
    if (!d) return null;
    const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
    if (!y || !m || !day) return null;
    return new Date(Date.UTC(y, m - 1, day));
  };
  const s = parseDate(base.start);
  const e = parseDate(base.end);
  let totalDays = 0; let grossWorkingDays = 0; let weeklyHolidays = 0;
  if (s && e && e >= s) {
    totalDays = Math.round((e - s) / 86400000) + 1;
    grossWorkingDays = Math.round((totalDays / 7) * wpw);
    weeklyHolidays = totalDays - grossWorkingDays;
  }
  const vacDays = vacations.reduce((sum, v) => {
    const vs = parseDate(v.start); const ve = parseDate(v.end);
    return sum + (vs && ve && ve >= vs ? Math.round((ve - vs) / 86400000) + 1 : 0);
  }, 0);
  const workingDays = Math.max(0, grossWorkingDays - vacDays);
  return {
    ...base, workingDaysPerWeek: wpw, totalOnDays: totalDays, workingDays,
    workingWeeks: wpw > 0 ? Number((workingDays / wpw).toFixed(2)) : 0,
    holidays: weeklyHolidays + vacDays, vacationDays: vacDays,
  };
}

let _summaryCache = { key: '', at: 0, promise: null };
function loadSessionSummary() {
  const sid = sessionYearId();
  const key = `${branchId()}|${sid}`;
  if (_summaryCache.promise && _summaryCache.key === key && Date.now() - _summaryCache.at < 15000) return _summaryCache.promise;
  const promise = (async () => {
    const active = readStoredActiveSession() || {};
    const year = activeSessionName() || '';
    const emptySession = {
      year, start: iso10(active.startDate), end: iso10(active.endDate),
      workingDaysPerWeek: 0, totalOnDays: 0, workingDays: 0, workingWeeks: 0, holidays: 0,
    };
    if (!sid) return { session: emptySession, vacations: [] };
    try {
      const res = await fetch(
        buildUrl(`/api/getsessionsummarybybranchid?branchID=${branchId()}&sessionID=${sid}&pageNo=1`),
        { method: 'GET', headers: authHeaders() },
      );
      const json = await res.json().catch(() => ({}));
      const rows = rowsOf(json);
      if (!rows.length) return { session: emptySession, vacations: [] };
      const palette = ['#1E40AF', '#22C55E', '#F59E0B', '#7C3AED', '#EF4444', '#0EA5E9'];
      const vacations = rows
        .filter((r) => r.vacationName && r.vacationName !== 'string' && iso10(r.vacationStart) > '0001-01-01')
        .map((r, i) => ({
          id: r.detailID ?? i, name: r.vacationName,
          start: iso10(r.vacationStart), end: iso10(r.vacationEnd), color: palette[i % palette.length],
        }));
      const first = rows[0];
      const session = computeSession({
        id: first.id, year,
        start: iso10(first.sessionStart) || emptySession.start,
        end: iso10(first.sessionEnd) || emptySession.end,
        workingDaysPerWeek: Number(first.workingDaysPerWeek) || 0,
      }, vacations);
      return { session, vacations };
    } catch (e) {
      console.error('Academics reports: session summary load failed', e);
      return { session: emptySession, vacations: [] };
    }
  })();
  _summaryCache = { key, at: Date.now(), promise };
  return promise;
}

export async function getSession() { return clone((await loadSessionSummary()).session); }
export async function getVacations() { return clone((await loadSessionSummary()).vacations); }

/* ─── LIVE: terms + calendar key-dates ─── */
async function fetchTerms() {
  const res = await fetch(buildUrl('/api/termscrud'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: 0, branchID: branchId(), term: 'string', sessionYearID: sessionYearId(), action: 'get',
    }),
  });
  return rowsOf(await res.json().catch(() => ({})));
}
export async function getTermData() {
  try {
    return (await fetchTerms()).map((t) => ({
      id: t.id, name: t.term || '', start: iso10(t.startDate), end: iso10(t.endDate),
    }));
  } catch (e) {
    console.error('Academics reports: terms load failed', e);
    return [];
  }
}
export async function getTerms() {
  try {
    const [termList, kdRes] = await Promise.all([
      fetchTerms(),
      fetch(buildUrl(`/api/getkeydatesybranchid?branchID=${branchId()}&pageNo=1`), {
        method: 'GET', headers: authHeaders(),
      }).then((r) => r.json().catch(() => ({}))),
    ]);
    const keyDates = rowsOf(kdRes);
    return termList.map((t) => ({
      id: t.id,
      label: t.term || 'Unnamed',
      entries: keyDates
        .filter((k) => String(k.terms) === String(t.id))
        .map((k) => ({ id: k.id, heading: k.head || '', date: k.value || '' })),
    }));
  } catch (e) {
    console.error('Academics reports: calendar load failed', e);
    return [];
  }
}

/* ─── LIVE: activity calendar ─── */
const ACT_COLORS = ['#1E40AF', '#16A34A', '#D97706', '#7C3AED', '#1E40AF', '#E11D48'];
const actStatus = (startAt, endAt) => {
  const now = new Date();
  const s = new Date(startAt); const e = new Date(endAt);
  if (!isNaN(e) && e < now) return 'completed';
  if (!isNaN(s) && s <= now && (isNaN(e) || e >= now)) return 'ongoing';
  return 'upcoming';
};
export async function getActivities() {
  try {
    const res = await fetch(
      buildUrl(`/api/getactivitycalendarbyid?BranchID=${branchId()}&SessionYearID=${sessionYearId()}&pageNo=1`),
      { method: 'GET', headers: authHeaders() },
    );
    const rows = rowsOf(await res.json().catch(() => ({})));
    /* createdBy aksar employee ID (number) hota hai — Teacher Performance naam se
       match karta hai, is liye ID ko employee ke naam me badlo. */
    let empName = new Map();
    if (rows.some((a) => !a.createdByName && !a.createdByEmployeeName && /^\d+$/.test(String(a.createdBy ?? '')))) {
      try { empName = new Map((await fetchBranchEmployees()).map((e) => [String(e.empId), e.name])); } catch { /* ids stay */ }
    }
    return rows.map((a, i) => {
      const rawStart = a.startAt || a.startDate || a.start || a.fromDate || a.activityDate || a.date || '';
      const rawEnd = a.endAt || a.endDate || a.end || a.toDate || a.activityDate || a.date || rawStart;
      return {
        id: a.id ?? a.ID ?? a.activityID ?? a.activityCalendarID ?? i,
        name: a.name || a.activityName || a.title || 'Activity',
        start: iso10(rawStart), end: iso10(rawEnd),
        color: ACT_COLORS[i % ACT_COLORS.length],
        status: actStatus(rawStart, rawEnd),
        purpose: a.activityPurpose || '',
        development: a.activityDevelopment || '',
        resource: a.resourseMaterial || '',
        createdBy: a.createdByName || a.createdByEmployeeName
          || empName.get(String(a.createdBy ?? '')) || a.createdBy || '',
      };
    });
  } catch (e) {
    console.error('Academics reports: activities load failed', e);
    return [];
  }
}

/* ─── LIVE: classes + textbooks (Academic Setup report) ─── */
export async function getClassesWithSubjects() {
  if (!sessionStorage.getItem('sessionID') && !sessionStorage.getItem('SessionID') && !sessionStorage.getItem('changeSessionId')) return [];
  const bId = sessionStorage.getItem('branchID');
  const empId = sessionStorage.getItem('employee_ID');
  try {
    const res = await fetch(buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${bId}/${empId}`), {
      method: 'GET', headers: { Accept: '*/*' },
    });
    const json = await res.json();
    const classes = Array.isArray(json?.data) ? json.data : [];
    return await Promise.all(classes.map(async (c) => {
      const sections = Array.isArray(c.sections) && c.sections.length ? c.sections : [{ sectionID: 0 }];
      const perSection = await Promise.all(sections.map(async (s) => {
        try {
          const r = await fetch(buildUrl(`/api/LaunchSetup/get-subjects/${c.id}/${s.sectionID ?? 0}`), {
            method: 'GET', headers: { Accept: '*/*' },
          });
          const j = await r.json();
          return j?.success && Array.isArray(j.data) ? j.data : [];
        } catch { return []; }
      }));
      const byName = new Map();
      perSection.flat().forEach((sub) => {
        const name = (sub.subjectName || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const prev = byName.get(key);
        if (!prev || (!prev.book && sub.book_Title)) byName.set(key, { name, book: sub.book_Title || '' });
      });
      return { id: c.id, name: c.name, subjects: Array.from(byName.values()) };
    }));
  } catch (e) {
    console.error('Academics reports: classes load failed', e);
    return [];
  }
}
