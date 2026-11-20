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

/* ─── Branch grades + employees (LaunchSetup) ─── */
async function fetchBranchGrades() {
  const res = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchIdStr()}`), {
    method: 'GET', headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
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

async function fetchBranchEmployees() {
  const res = await fetch(buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchIdStr()}`), {
    method: 'GET', headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  const list = Array.isArray(json) ? json : (json?.data || json?.Data || json?.result || []);
  return list.map((e) => ({
    empId: e.employeeID ?? e.employeeId ?? e.empID ?? e.id ?? e.EmployeeID,
    name: (e.employeeName ?? e.name ?? e.fullName)
      || (`${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || 'Teacher'),
    designation: e.designation ?? e.designationName ?? e.role ?? '',
  })).filter((e) => e.empId != null);
}

async function fetchClassSubjects(gradeId, sectionId) {
  const res = await fetch(buildUrl(`/api/LaunchSetup/get-subjects/${gradeId}/${sectionId}`), {
    method: 'GET', headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  const list = Array.isArray(json) ? json : (json?.data || []);
  return list
    .map((s) => ({ subjectId: s.subjectID ?? s.subjectId ?? s.id, subjectName: s.subjectName ?? s.name ?? '' }))
    .filter((s) => s.subjectId != null);
}

async function fetchEmployeeSubjects(gradeId, sectionId, empId) {
  const res = await fetch(buildUrl(`/get-subjects_byEmployeeID/${gradeId}/${sectionId}/${empId}`), {
    method: 'GET', headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
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
    const mres = await fetch(
      buildUrl(`/api/getulpfornotebookmaster?branchID=${branchIdStr()}&classID=${classID}&SectionID=${sectionID}&subjectID=${subjectID}&pageNo=1`),
      { method: 'GET', headers: authHeaders() },
    );
    const units = rowsOf(await mres.json().catch(() => ({})));
    return Promise.all(units.map(async (u) => {
      const [dres, checkedSet] = await Promise.all([
        fetch(buildUrl(`/api/getulpfornotebookdetails?masterNoteBookIDs=${u.id}`), { method: 'GET', headers: authHeaders() })
          .then((r) => r.json().catch(() => ({}))),
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
    const mres = await fetch(
      buildUrl(`/api/getulpforclassesmaster?branchID=${branchIdStr()}&classID=${classID}&SectionID=${sectionID}&subjectID=${subjectID}&pageNo=1`),
      { method: 'GET', headers: authHeaders() },
    );
    const masters = rowsOf(await mres.json().catch(() => ({})));
    return Promise.all(masters.map(async (m) => {
      let status = 'pending';
      let submittedDate = '';
      try {
        const dres = await fetch(
          buildUrl(`/api/getulpforclassdetailbytermsubjectandclass?MasterClassesID=${m.id}&classID=${classID}&subjectID=${subjectID}&pageNo=1`),
          { method: 'GET', headers: authHeaders() },
        );
        const d = rowsOf(await dres.json().catch(() => ({})))[0];
        if (d?.id) {
          const sres = await fetch(
            buildUrl(`/api/getulpforclasssuggestion?BranchID=${branchIdStr()}&ClassID=${classID}&SubjectID=${subjectID}&DetailClassID=${d.id}&pageNo=1`),
            { method: 'GET', headers: authHeaders() },
          );
          const s = rowsOf(await sres.json().catch(() => ({})))[0];
          if (s) {
            status = 'submitted';
            submittedDate = iso10(s.createdAt || s.modifiedAt || s.submittedDate || '') || todayIso();
          }
        }
      } catch { /* pending */ }
      return {
        id: m.id,
        unitNo: m.unitNo || '',
        unit: m.unitName ? `Unit ${m.unitNo || ''} — ${m.unitName}`.replace(/\s+/g, ' ').trim() : `Unit ${m.unitNo || m.id}`,
        topic: m.lessonPlanTopic || m.unitName || '(no topic)',
        date: iso10(m.createdAt || m.modifiedAt || '') || '',
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

/* Assignments / cells — light; LP aur NB alag-alag tab pe load hote hain. */
let _assignCache = { key: '', at: 0, promise: null };
function loadAssignmentsBundle() {
  const key = `${branchIdStr()}|${sessionYearId()}`;
  if (_assignCache.promise && _assignCache.key === key && Date.now() - _assignCache.at < 60000) {
    return _assignCache.promise;
  }
  const promise = (async () => {
    const empty = { assignments: [], cells: [], classes: [] };
    try {
      const [grades, employees] = await Promise.all([fetchBranchGrades(), fetchBranchEmployees()]);
      if (!grades.length) return empty;

      const assignments = [];
      const teacherByCell = new Map();
      await mapLimited(employees, 3, async (emp) => {
        for (const g of grades) {
          const secs = g.sections.length ? g.sections : [{ sectionId: 0, sectionName: '' }];
          for (const s of secs) {
            const subs = await fetchEmployeeSubjects(g.gradeId, s.sectionId, emp.empId);
            for (const sub of subs) {
              const cls = classLabel(g.gradeName, s.sectionName);
              assignments.push({
                teacher: emp.name,
                class: cls,
                subject: sub.subjectName,
                gradeId: g.gradeId,
                sectionId: s.sectionId,
                subjectId: sub.subjectId,
              });
              const ck = `${g.gradeId}:${s.sectionId}:${sub.subjectId}`;
              if (!teacherByCell.has(ck)) teacherByCell.set(ck, emp.name);
            }
          }
        }
      });

      const cells = [];
      const seen = new Set();
      await mapLimited(grades, 3, async (g) => {
        const secs = g.sections.length ? g.sections : [{ sectionId: 0, sectionName: '' }];
        for (const s of secs) {
          const subs = await fetchClassSubjects(g.gradeId, s.sectionId);
          for (const sub of subs) {
            const ck = `${g.gradeId}:${s.sectionId}:${sub.subjectId}`;
            if (seen.has(ck)) continue;
            seen.add(ck);
            cells.push({
              classID: g.gradeId,
              sectionID: s.sectionId,
              subjectID: sub.subjectId,
              className: classLabel(g.gradeName, s.sectionName),
              subjectName: sub.subjectName,
              teacher: teacherByCell.get(ck) || '',
            });
          }
        }
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
  })();
  _assignCache = { key, at: Date.now(), promise };
  return promise;
}

let _lpCache = { key: '', at: 0, promise: null };
let _nbCache = { key: '', at: 0, promise: null };

async function loadLpRowsOnly() {
  const key = `${branchIdStr()}|${sessionYearId()}`;
  if (_lpCache.promise && _lpCache.key === key && Date.now() - _lpCache.at < 60000) return _lpCache.promise;
  const promise = (async () => {
    try {
      const { cells } = await loadAssignmentsBundle();
      const lpData = [];
      await mapLimited(cells, 3, async (cell) => {
        lpData.push(...(await loadLpForCell(cell)));
      });
      return lpData;
    } catch (e) {
      console.error('Academics reports: LP load failed', e);
      return [];
    }
  })();
  _lpCache = { key, at: Date.now(), promise };
  return promise;
}

async function loadNbRowsOnly() {
  const key = `${branchIdStr()}|${sessionYearId()}`;
  if (_nbCache.promise && _nbCache.key === key && Date.now() - _nbCache.at < 60000) return _nbCache.promise;
  const promise = (async () => {
    try {
      const { cells } = await loadAssignmentsBundle();
      const nbData = [];
      await mapLimited(cells, 3, async (cell) => {
        nbData.push(...(await loadNbForCell(cell)));
      });
      return nbData;
    } catch (e) {
      console.error('Academics reports: NB load failed', e);
      return [];
    }
  })();
  _nbCache = { key, at: Date.now(), promise };
  return promise;
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

/* ─── LIVE: term breakups (gettermbreakups + details) ─── */
export async function getTermBreakups() {
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
    const out = [];
    await mapLimited(pairs, 2, async (a) => {
      for (const term of termList) {
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
          const res1 = await fetch(buildUrl(`/api/gettermbreakups?${params}`), {
            method: 'GET', headers: authHeaders(),
          });
          if (!res1.ok) continue;
          const list1 = rowsOf(await res1.json().catch(() => ({})));
          const tbId = list1[0]?.id;
          if (!tbId) continue;
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
    return clone(out);
  } catch (e) {
    console.error('Academics reports: term breakups load failed', e);
    return [];
  }
}

/* ─── LIVE: holidays (attendance monthly setup) ─── */
export async function getHolidays() {
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
    return clone(all);
  } catch (e) {
    console.error('Academics reports: holidays load failed', e);
    return [];
  }
}

/* ─── LIVE: student attendance snapshot (today) ─── */
export async function getStudentAttendance() {
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
    await mapLimited(classes, 3, async (c) => {
      const sections = Array.isArray(c.sections) ? c.sections : [];
      for (const s of sections) {
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
          teacher: '',
          markedBy,
          markedFrom,
          markedTime,
          timeOut: '',
        });
      }
    });
    return clone(rows);
  } catch (e) {
    console.error('Academics reports: student attendance load failed', e);
    return [];
  }
}

/* ─── LIVE: staff attendance snapshot (today) ─── */
export async function getStaffAttendance() {
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
    return clone(emps.map((e) => {
      const rec = byEmp.get(String(e.empId));
      const raw = rec ? (rec.status ?? rec.Status) : '';
      const status = ST[String(raw).toLowerCase()] || ST[String(raw)] || (rec ? 'present' : '');
      return {
        name: e.name,
        empId: String(e.empId),
        desig: e.designation || '',
        dept: 'Academics',
        status: status || 'absent',
        inTime: String(rec?.CheckInTime ?? rec?.checkInTime ?? ''),
        outTime: String(rec?.CheckOutTime ?? rec?.checkOutTime ?? ''),
        from: String(rec?.Platform ?? rec?.platform ?? ''),
        marked: !!rec,
      };
    }));
  } catch (e) {
    console.error('Academics reports: staff attendance load failed', e);
    return [];
  }
}

/* ─── LIVE: question papers (getexamqpmasterbyids per class/section) ─── */
export async function getAllPapers() {
  try {
    const bId = sessionStorage.getItem('branchID');
    const empId = sessionStorage.getItem('employee_ID');
    const res = await fetch(buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${bId}/${empId}`), {
      method: 'GET', headers: { Accept: '*/*' },
    });
    const json = await res.json().catch(() => ({}));
    const classList = Array.isArray(json?.data) ? json.data : [];
    const papersByKey = {};
    await mapLimited(classList, 3, async (c) => {
      const sections = Array.isArray(c.sections) ? c.sections : [];
      for (const s of sections) {
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
    return clone(papersByKey);
  } catch (e) {
    console.error('Academics reports: papers load failed', e);
    return {};
  }
}

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
        createdBy: a.createdByName || a.createdByEmployeeName || a.createdBy || '',
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
