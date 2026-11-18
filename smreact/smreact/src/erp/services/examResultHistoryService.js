/* ═══════════════════════════════════════════════════════════════════
   EXAM RESULT HISTORY — LIVE data helpers for the report exports
   (Download All Cards / Comparison Report / Preschool Comparison).

   Every call goes to the same live endpoints Examination already uses:
     • /api/getsasubjectbybranchclassandterm            (via combinedAssessmentService.getMainExamSubjects)
     • /api/getsauploadmarksbyclassandtermandexamandsubject  (per-subject marks, totals, remark)
     • /api/getremarksbystudentfilters                   (final remark)
     • /api/sauploadmarksGetvisibility                   (publish state of a single assessment)
     • preschooling-marks-get-by-all                     (via preschoolService.getStudentSloAssessments)

   GAP: the ERP has no "published on" timestamp for a result (only the
   isResultVisibleToParents flag). The published date shown on cards is the
   result's own `publishedDate` when the caller has one, else the exam date.
   ═══════════════════════════════════════════════════════════════════ */
import { buildUrl } from '../../utils/apiConfig';
import * as cbrApi from './combinedAssessmentService';
import * as preschoolService from './preschoolService';
import { examR1, examParseDate, examFormatDate, examDefaultGrade } from '../components/examReportCommon';

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`, Accept: 'application/json' });

/* Preschool achievement code → skill-level % (same midpoints Examination uses). */
export const EXAM_P_LEVEL_PCT = { E: 95, M: 82, A: 62, NY: 35 };

/* ── Publish state ─────────────────────────────────────────────────
   Single assessments: /api/sauploadmarksGetvisibility (class+section row with
   isResultVisibleToParents). Combined results: `result.published` as already
   carried by the Result History row (null when unknown). Returns true / false /
   null (null = could not tell). */
async function fetchVisibilityList(termID, selectExam, preschool = false) {
  const params = new URLSearchParams({
    termID: String(termID ?? ''), examID: String(selectExam ?? ''), branchID: String(sessionStorage.getItem('branchID') || ''),
  });
  const path = preschool ? '/api/sauploadmarksPreschoolingGetvisibility' : '/api/sauploadmarksGetvisibility';
  try {
    const r = await fetch(buildUrl(`${path}?${params}`), { headers: authHeaders() });
    const d = r.ok ? await r.json() : [];
    return Array.isArray(d) ? d : (d?.data || []);
  } catch (e) { return []; }
}

/** Annotate each result with `published` (boolean|null). Does not mutate input. */
export async function fetchResultsPublishState(student, results, { preschool = false } = {}) {
  const cache = new Map();
  const out = [];
  for (const r of results || []) {
    if (r.type === 'combined' || r.combinedId != null) {
      out.push({ ...r, published: r.published === undefined ? null : !!r.published });
      continue;
    }
    const key = `${r.termID}|${r.selectExam}`;
    if (!cache.has(key)) cache.set(key, fetchVisibilityList(r.termID, r.selectExam, preschool));
    const list = await cache.get(key);
    const classID = r.classID ?? student?.gradeId ?? student?.classID;
    const sectionID = r.sectionID ?? student?.sectionId ?? student?.sectionID;
    const hit = list.find(it => Number(it.classID) === Number(classID) && Number(it.sectionID) === Number(sectionID));
    out.push({ ...r, published: hit ? !!hit.isResultVisibleToParents : null });
  }
  return out;
}

/* ── One student's marks for one single/combined result ───────────
   Same live calls as Examination's result-history card download.
   Returns { subjects:[name], totals:{name:n}, obtained:{name:n}, remarks:{name:text}, finalRemark }.
   Combined results have no per-subject split in the live API → subjects [] (the
   overall % comes from the result row). */
export async function fetchStudentResultData(student, result) {
  const empty = { subjects: [], totals: {}, obtained: {}, remarks: {}, finalRemark: '' };
  if (!student || !result) return empty;
  if (result.type === 'combined' || result.combinedId != null) return empty;
  const classID = result.classID ?? student.gradeId ?? student.classID;
  const sectionID = result.sectionID ?? student.sectionId ?? student.sectionID;
  const examID = result.selectExam;
  const termID = result.termID;
  const branchID = sessionStorage.getItem('branchID');
  const headers = authHeaders();
  const data = { ...empty, subjects: [], totals: {}, obtained: {}, remarks: {} };
  try {
    const subs = (await cbrApi.getMainExamSubjects({ classID, sectionID, termID, examID }).catch(() => [])) || [];
    const seen = new Set();
    const uniq = subs.filter(s => {
      const nm = String(s.subjectName || '').trim();
      if (!nm || seen.has(nm.toLowerCase())) return false;
      seen.add(nm.toLowerCase());
      return true;
    });
    data.subjects = uniq.map(s => s.subjectName);
    await Promise.all(uniq.map(async su => {
      try {
        const p = new URLSearchParams({
          classID: String(classID), termID: String(termID ?? ''), ExamID: String(examID),
          SubjectID: String(su.subjectID), StudentID: String(student.id), sectionID: String(sectionID), pageNo: '1',
        });
        const rr = await fetch(buildUrl(`/api/getsauploadmarksbyclassandtermandexamandsubject?${p}`), { headers });
        const d = await rr.json();
        const rec = Array.isArray(d) ? d[0] : (d?.data?.[0] || null);
        data.obtained[su.subjectName] = Number(rec?.obtainMarks ?? rec?.obtainedMarks ?? 0) || 0;
        data.totals[su.subjectName] = Number(rec?.totalMarks ?? su.totalMarks ?? 0) || 0;
        if (rec?.remarks) data.remarks[su.subjectName] = rec.remarks;
      } catch (e) { /* skip subject */ }
    }));
    try {
      const fp = new URLSearchParams({
        branchID: String(branchID), classID: String(classID), sectionID: String(sectionID),
        examID: String(examID), termID: String(termID ?? ''), studentID: String(student.id), pageNo: '1', pageCount: '20',
      });
      const fr = await fetch(buildUrl(`/api/getremarksbystudentfilters?${fp}`), { headers });
      const fd = await fr.json();
      const frec = Array.isArray(fd?.data) ? fd.data[0] : (Array.isArray(fd) ? fd[0] : null);
      data.finalRemark = frec?.remarks || '';
    } catch (e) { /* no final remark */ }
  } catch (e) { console.error('examResultHistoryService: could not load result data', e); }
  return data;
}

/* ── Entries for the Progress Summary / Comparison Report ─────────
   results: Result History rows ({ exam, type, date, pct, rank, selectExam, termID, … }).
   Only PUBLISHED rows are kept (published === false is dropped; null/undefined is
   kept unless `strict`). Sorted by date. Subject values are % (obtained ÷ total).
   → { entries, cardData }  — cardData[i] is the raw fetchStudentResultData for entries[i],
   so Download All Cards can render each card without a second round-trip.
   entry: { name, kind, kindTone, published (display date), pct, grade, rank, values:{subject:%|null}, result } */
export async function buildGradeEntries(student, results, { gradeFn = examDefaultGrade, strict = false, loadData = fetchStudentResultData } = {}) {
  const keep = (results || []).filter(r => (strict ? r.published === true : r.published !== false));
  keep.sort((a, b) => examParseDate(a.date) - examParseDate(b.date));
  const cardData = await Promise.all(keep.map(r => loadData(student, r)));
  const entries = keep.map((r, i) => {
    const cd = cardData[i];
    const values = {};
    (cd.subjects || []).forEach(s => {
      const tot = Number(cd.totals?.[s]) || 0;
      values[s] = tot > 0 ? examR1(((Number(cd.obtained?.[s]) || 0) / tot) * 100) : null;
    });
    const combined = r.type === 'combined' || r.combinedId != null;
    const g = gradeFn(r.pct, 100);
    return {
      name: r.exam,
      kind: combined ? 'COMBINED' : 'SINGLE',
      kindTone: combined ? 'purple' : 'blue',
      published: examFormatDate(r.publishedDate || r.date),
      // API me publish timestamp nahi — exam date dikhe to label "Exam date" ho,
      // "Published on" nahi (warna exam start date publish date lagti thi).
      publishedLabel: r.publishedDate ? 'Published on' : 'Exam date',
      pct: Number(r.pct) || 0,
      grade: g ? g.grade : '—',
      rank: r.rank,
      values,
      result: r,
    };
  });
  return { entries, cardData };
}

/* ── Preschool: learning-area skill % per assessment ──────────────
   exams: [{ examId, termId, name, date, gradeId, sectionId, published? }]
   student: { id, … }. Uses live learning areas + grading scale + the child's
   saved SLO ratings. Overall % = midpoint average of every rating; grade = most
   frequent code. */
export async function fetchPreschoolComparisonEntries(student, exams, { learningAreas, gradingScale } = {}) {
  const [la, gs] = await Promise.all([
    learningAreas || preschoolService.getLearningAreas().catch(() => []),
    gradingScale || preschoolService.getGradingScale().catch(() => []),
  ]);
  const keep = (exams || []).filter(e => e.published !== false)
    .sort((a, b) => examParseDate(a.date) - examParseDate(b.date));
  const entries = [];
  for (const ex of keep) {
    let map = {};
    try {
      map = await preschoolService.getStudentSloAssessments({
        gradeId: ex.gradeId ?? student.gradeId, sectionId: ex.sectionId ?? student.sectionId,
        studentId: student.id, examId: ex.examId, termId: ex.termId,
      });
    } catch (e) { map = {}; }
    const values = {};
    let sum = 0, n = 0;
    const counts = {};
    (la || []).forEach(a => {
      const codes = Object.values(map[String(a.dbId ?? a.id)] || {}).map(x => x.code).filter(Boolean);
      values[a.name] = codes.length
        ? Math.round(codes.reduce((s, c) => s + (EXAM_P_LEVEL_PCT[c] ?? 50), 0) / codes.length)
        : null;
      codes.forEach(c => { sum += EXAM_P_LEVEL_PCT[c] ?? 50; n += 1; counts[c] = (counts[c] || 0) + 1; });
    });
    if (!n) continue; // nothing rated for this assessment
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    entries.push({
      name: ex.name,
      published: examFormatDate(ex.publishedDate || ex.date),
      pct: Math.round(sum / n),
      grade: top,
      gradeColor: (gs || []).find(g => g.code === top)?.color,
      values,
    });
  }
  return entries;
}
