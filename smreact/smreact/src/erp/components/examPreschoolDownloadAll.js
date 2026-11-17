/* ═══════════════════════════════════════════════════════════════════
   EXAM — PRESCHOOL "DOWNLOAD ALL CARDS" (data + bundle).

   One PDF: Session Progress Summary first, then every PUBLISHED
   Preschool result card of the student's session, oldest first, one per
   page, NO signatures. Each card is dated with its EXAM date (the ERP has
   no "published on" timestamp; that feature is out of scope).

   Builds on examDownloadAll.js (buildProgressSummaryHtml + buildBundleHtml)
   and examResultHistoryService.js (fetchResultsPublishState with
   { preschool: true }). It does NOT call downloadAllCards/buildAllCardsHtml
   directly because those hard-wire the Grade 1-12 visibility endpoint
   (sauploadmarksGetvisibility) and the marks loader; Preschool needs
   sauploadmarksPreschoolingGetvisibility + SLO ratings.

   All live endpoints, all already used by the Examination module:
     • /get-classlist-sectionlist-studentlist-by-branch  (find the child's class/section)
     • /api/getexamsbybranchclassidsectionid            (the class-section's exams)
     • /api/sauploadmarksPreschoolingGetvisibility      (published flag)
     • preschooling-marks-get-by-all                    (SLO + PSD ratings)
     • preschooling-attendance-remarks-crud (get)       (attendance / remarks / PTM)
   The cards themselves are rendered by PreschoolExam.jsx (same
   <PreschoolResultCard> the viewer shows) and passed in as HTML strings.
   ═══════════════════════════════════════════════════════════════════ */
import { buildUrl, activeSessionName } from '../../utils/apiConfig';
import * as preschoolService from '../services/preschoolService';
import { fetchResultsPublishState, EXAM_P_LEVEL_PCT } from '../services/examResultHistoryService';
import { buildProgressSummaryHtml, buildBundleHtml } from './examDownloadAll';
import { examParseDate, examFormatDate, examSchoolName, examDeliver } from './examReportCommon';

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`, Accept: 'application/json' });
const listOf = d => (Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []));

/* Branch roster → { classID, sectionID, className, sectionName } for a student,
   plus a classID → class-name map (for the promotion "to class" label). */
async function findStudentPlacement(studentId) {
  const branchID = sessionStorage.getItem('branchID');
  const empID = sessionStorage.getItem('employee_ID');
  const r = await fetch(buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${branchID}/${empID}`), { headers: authHeaders() });
  const grades = listOf(await r.json());
  const classNames = {};
  let hit = null;
  grades.forEach(g => {
    const gid = g.id ?? g.gradeID;
    classNames[String(gid)] = g.name ?? g.gradeName ?? '';
    (g.sections || []).forEach(sec => {
      if (hit) return;
      const found = (sec.students || []).some(st => String(st.id ?? st.studentID ?? st.studentId) === String(studentId));
      if (found) hit = { classID: gid, sectionID: sec.sectionID ?? sec.id, className: g.name ?? '', sectionName: sec.sectionName ?? '' };
    });
  });
  return { placement: hit, classNames };
}

async function fetchClassSectionExams(classID, sectionID) {
  const branchID = sessionStorage.getItem('branchID');
  const r = await fetch(buildUrl(`/api/getexamsbybranchclassidsectionid?branchID=${branchID}&classID=${classID}&sectionID=${sectionID}&pageNo=1`), { headers: authHeaders() });
  return listOf(await r.json());
}

/* Same ad shape Examination builds for the single-card viewer (pCardAd). */
function buildAd(studentId, sloMap, attR, psdFields, classNames) {
  const psdIds = new Set((psdFields || []).map(f => String(f.id)));
  const achievements = {};
  const psd = {};
  Object.keys(sloMap || {}).forEach(sub => {
    Object.keys(sloMap[sub]).forEach(slo => {
      const code = sloMap[sub][slo].code;
      if (psdIds.has(String(slo))) { psd[slo] = code; return; }
      (achievements[sub] = achievements[sub] || {})[slo] = code;
    });
  });
  const toClass = attR?.promotedClassId ? (classNames[String(attR.promotedClassId)] || '') : '';
  return {
    studentId,
    achievements, psd,
    attendance: attR ? { workingDays: attR.workingDays, presentDays: attR.presentDays } : null,
    teacherRemarks: attR?.teacherObservation || '',
    finalRemarks: attR?.finalRemarks || '',
    ptm: attR ? { enabled: attR.ptm, date: attR.meetingDate, parentAttendance: attR.parentAttendance, parentComments: attR.parentComment, teacherComments: attR.teacherComment } : null,
    promotion: attR?.promotionDecision ? { status: attR.promotionDecision, toClass } : null,
  };
}

/** Loads everything the bundle needs.
    student: { id, name, father, rollNo }; classID/sectionID optional (looked up
    from the branch roster when missing). Returns
    { items: [{ exam:{name,date,dateLabel,termID,selectExam}, ad, entry }], placement }
    — items are PUBLISHED assessments with at least one rating, date order. */
export async function loadPreschoolAllCardsData({ student, classID, sectionID, learningAreas, psdFields }) {
  let placement = classID != null && sectionID != null ? { classID, sectionID } : null;
  let classNames = {};
  try {
    const found = await findStudentPlacement(student?.id);
    classNames = found.classNames;
    if (!placement) placement = found.placement;
  } catch (e) { /* roster unavailable */ }
  if (!placement) return { items: [], placement: null };

  const exams = await fetchClassSectionExams(placement.classID, placement.sectionID).catch(() => []);
  const rows = exams.map(ex => ({
    exam: ex.examName || '',
    date: ex.dateFrom || ex.dateTo || '',
    termID: ex.termID,
    selectExam: ex.selectExam,
    classID: placement.classID,
    sectionID: placement.sectionID,
  })).filter(r => r.selectExam != null);

  const withPub = await fetchResultsPublishState(
    { id: student?.id, gradeId: placement.classID, sectionId: placement.sectionID }, rows, { preschool: true },
  );
  const published = withPub.filter(r => r.published === true)
    .sort((a, b) => examParseDate(a.date) - examParseDate(b.date));

  const items = [];
  for (const r of published) {
    let sloMap = {};
    let attR = null;
    try {
      [sloMap, attR] = await Promise.all([
        preschoolService.getStudentSloAssessments({ gradeId: r.classID, sectionId: r.sectionID, studentId: student.id, examId: r.selectExam, termId: r.termID }),
        preschoolService.getAttendanceRemarks({ studentId: student.id, classId: r.classID, sectionId: r.sectionID, termId: r.termID, examId: r.selectExam }).catch(() => null),
      ]);
    } catch (e) { sloMap = {}; }
    const ad = buildAd(student.id, sloMap, attR, psdFields, classNames);

    /* Summary row: learning-area skill % (rating midpoints), overall %, top code. */
    const values = {};
    const counts = {};
    let sum = 0, n = 0;
    (learningAreas || []).forEach(a => {
      const codes = Object.values(ad.achievements[String(a.dbId ?? a.id)] || ad.achievements[String(a.id)] || {}).filter(Boolean);
      values[a.name] = codes.length ? Math.round(codes.reduce((s, c) => s + (EXAM_P_LEVEL_PCT[c] ?? 50), 0) / codes.length) : null;
      codes.forEach(c => { sum += EXAM_P_LEVEL_PCT[c] ?? 50; n += 1; counts[c] = (counts[c] || 0) + 1; });
    });
    Object.values(ad.psd).forEach(c => { if (c) { sum += EXAM_P_LEVEL_PCT[c] ?? 50; n += 1; counts[c] = (counts[c] || 0) + 1; } });
    if (!n) continue; // nothing rated → no card
    const top = Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
    const dateLabel = examFormatDate(r.date);
    items.push({
      exam: { name: r.exam, date: r.date, dateLabel, termID: r.termID, selectExam: r.selectExam },
      ad,
      entry: { name: r.exam, kind: 'PRESCHOOL', kindTone: 'purple', published: dateLabel, pct: Math.round(sum / n), grade: top, values },
    });
  }
  return { items, placement };
}

/** Summary + card pages → one PDF (opened in `win`, which the caller opened
    synchronously on click so pop-up blockers allow it). cardHtmls[i] belongs
    to items[i]. Signatures are never included (cards are rendered with none). */
export function deliverPreschoolAllCards({ win, student, items, cardHtmls, school, format = 'pdf' }) {
  const sessionLabel = activeSessionName() || '';
  let summary = buildProgressSummaryHtml({
    student: { name: student?.name, father: student?.father, rollNo: student?.rollNo && student.rollNo !== '—' ? student.rollNo : '', cls: student?.cls },
    entries: items.map(it => it.entry),
    sessionLabel,
    schoolName: examSchoolName(school),
    rowLabel: 'Learning Area',
    valuesNote: 'skill level %',
  });
  /* The summary's date column holds the EXAM date here, not a publish date. */
  summary = summary.replace('>Published</th>', '>Exam Date</th>');
  const pages = [summary, ...cardHtmls.map((h, i) => `<div style="font-size:10px;color:#64748B;text-align:right;margin-bottom:4px">Exam date <b>${String(items[i]?.exam?.dateLabel || '—').replace(/</g, '&lt;')}</b></div>${h}`)];
  const html = buildBundleHtml({ title: `All Preschool Result Cards — ${student?.name || ''}`, pages });
  examDeliver(`All Preschool Result Cards - ${student?.name || ''}`, format === 'word' ? 'word' : 'pdf', html, { win, width: 960, height: 820 });
}
