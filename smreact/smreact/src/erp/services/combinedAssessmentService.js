// ══════════════════════════════════════════════════════════════════
//  Combined Assessment Result — API service
//  All endpoints from the Combined Assessment Result module README.
//  Uses buildUrl (configured base) + bearer token from sessionStorage.
// ══════════════════════════════════════════════════════════════════
import { buildUrl } from '../../utils/apiConfig';

const token     = () => sessionStorage.getItem('token') || '';
const branchID  = () => Number(sessionStorage.getItem('branchID')) || 0;
const authHeaders = (extra = {}) => ({ Accept: '*/*', Authorization: `bearer ${token()}`, ...extra });

async function readJson(res, label) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.title || data.error)) || `${label} failed: ${res.status}`;
    const err = new Error(msg);
    err.serverMessage = data && (data.message || data.title);
    err.status = res.status;
    throw err;
  }
  return data;
}

const getJson  = (path)        => fetch(buildUrl(path), { method: 'GET',    headers: authHeaders() }).then(r => readJson(r, `GET ${path}`));
const postJson = (path, body)  => fetch(buildUrl(path), { method: 'POST',   headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) }).then(r => readJson(r, `POST ${path}`));
const delJson  = (path)        => fetch(buildUrl(path), { method: 'DELETE', headers: authHeaders() }).then(r => readJson(r, `DELETE ${path}`));

/* examIDs are repeated query params: examIDs=2&examIDs=3 */
const examIdsQS = (ids = []) => ids.map(id => `examIDs=${encodeURIComponent(id)}`).join('&');

/* ── List (page load) ──
   The endpoint's model marks CombinedResultName / SubExams / ClassSectionIDs as
   required for every action, so they must be sent (with defaults) even for get. */
export const listCombinedResults = () =>
  postJson('/api/combinedassessmentcrud', {
    action: 'get',
    branchID: branchID(),
    combinedResultName: 'get',
    mainExamID: 0,
    subExams: [],
    classSectionIDs: [],
  });

/* ── Create modal ── */
export const getExamsForModal = (termID, empID) =>
  getJson(`/api/getexamsbybranchidtermid?branchID=${branchID()}&termID=${termID}&empID=${empID}`);

/* The dedicated getsubexamtotalmarks endpoint 404s; instead derive the original
   total the same way Single Assessment does — sum of subject totals from
   getsasubjectbybranchclassandtermtotalsum (totalMarksSum on the first row, or
   sum the per-subject totals as a fallback). */
export const getSubExamTotalMarks = async (examID, classID, sectionID, termID) => {
  const params = new URLSearchParams({
    branchID:  String(branchID()),
    classID:   String(classID),
    termID:    String(termID ?? ''),
    ExamID:    String(examID),
    sectionID: String(sectionID),
    pageNo:    '1',
  });
  const json = await getJson(`/api/getsasubjectbybranchclassandtermtotalsum?${params.toString()}`);
  const subjects = Array.isArray(json) ? json : (json?.data || []);
  let originalTotalMarks = Number(subjects[0]?.totalMarksSum) || 0;
  if (!originalTotalMarks && subjects.length) {
    originalTotalMarks = subjects.reduce((a, s) => a + (Number(s.totalMarks ?? s.totalmarks ?? s.marks ?? 0) || 0), 0);
  }
  return { examID, originalTotalMarks };
};

export const getCommonClasses = (examIDs) =>
  getJson(`/api/getcommonclassesbyexams?branchID=${branchID()}&${examIdsQS(examIDs)}`);

/* payload: { combinedResultName, mainExamID, subExams:[{examID,weightage}], classSectionIDs:[{classID,sectionID}] } */
export const createCombinedResult = (payload) =>
  postJson('/api/combinedassessmentcrud', { action: 'insert', branchID: branchID(), ...payload });

/* ── Publish / Unpublish ── */
export const publishCombinedResult = ({ combinedResultID, classID, sectionID, isPublished }) =>
  postJson('/api/publishcombinedresult', { combinedResultID, classID, sectionID, isPublished });

/* ── Student table (call both, match by studentID) ── */
export const getCaObtainedMarks = (subExamIDs, gradeID, sectionID) =>
  getJson(`/api/getcaobtainedmarkssumbyexamids?${examIdsQS(subExamIDs)}&gradeID=${gradeID}&sectionID=${sectionID}`);

export const getSaTotalMarks = (mainExamIDs, gradeID, sectionID) =>
  getJson(`/api/getsatotalsumbymultiexamids?${examIdsQS(mainExamIDs)}&branchID=${branchID()}&gradeID=${gradeID}&sectionID=${sectionID}`);

/* ── Main-exam per-subject marks (for the card's subject table) ── */
export const getMainExamSubjects = ({ classID, sectionID, termID, examID }) => {
  const params = new URLSearchParams({
    branchID: String(branchID()), classID: String(classID), termID: String(termID ?? ''),
    ExamID: String(examID), sectionID: String(sectionID), pageNo: '1',
  });
  return getJson(`/api/getsasubjectbybranchclassandterm?${params.toString()}`).then(j => {
    const list = Array.isArray(j) ? j : (j?.data || []);
    return list.map(it => ({
      subjectID:   it.subjectID ?? it.SubjectID,
      subjectName: it.subjectName ?? it.name ?? it.subject ?? it.SubjectName ?? '',
      totalMarks:  Number(it.totalMarks ?? it.TotalMarks ?? 0) || 0,
    }));
  });
};

export const getStudentSubjectMark = ({ classID, sectionID, termID, examID, subjectID, studentID }) => {
  const params = new URLSearchParams({
    classID: String(classID), termID: String(termID ?? ''), ExamID: String(examID),
    SubjectID: String(subjectID), StudentID: String(studentID), sectionID: String(sectionID), pageNo: '1',
  });
  return getJson(`/api/getsauploadmarksbyclassandtermandexamandsubject?${params.toString()}`).then(j => {
    const rec = Array.isArray(j) ? j[0] : (j?.data?.[0] || null);
    return rec ? (Number(rec.obtainedMarks ?? rec.obtainMarks ?? rec.marks ?? rec.ObtainedMarks ?? 0) || 0) : 0;
  });
};

/* ── Student result card ── */
export const getStudentCard = ({ studentID, subExamIDs, classID, sectionID, mainExamID }) =>
  getJson(`/api/getcastudentexamresult?studentID=${studentID}&${examIdsQS(subExamIDs)}&branchID=${branchID()}&classID=${classID}&sectionID=${sectionID}&mainExamID=${mainExamID}`);

/* ── Remarks ── */
export const getRemarks = ({ classID, sectionID, examID, termID, studentID }) =>
  getJson(`/api/getremarksbystudentfiltersnew?branchID=${branchID()}&classID=${classID}&sectionID=${sectionID}&examID=${examID}&termID=${termID}&studentID=${studentID}&pageNo=1`);

/* payload: { action:'insert'|'update', id?, classID, sectionID, examID, termID, studentID, remarks } */
export const saveRemarks = (payload) =>
  postJson('/api/remarksforstudentcrudnew', { branchID: branchID(), ...payload });

/* ── Delete a class row ── */
export const deleteClassRow = ({ combinedResultID, gradeID, sectionID }) =>
  delJson(`/api/deletecombineassessment?combinedResultID=${combinedResultID}&gradeID=${gradeID}&sectionID=${sectionID}`);

/* ── Download a student result ── */
export const getDownloadLink = ({ subExamIDs, studentID }) =>
  getJson(`/api/getcaexaminationresultdownloadmobile?${examIdsQS(subExamIDs)}&studentID=${studentID}&branchID=${branchID()}`);

/* Map the list (get) response into the flat per-class-section rows the
   Combined Assessment UI renders. */
export function mapCombinedResults(apiList) {
  const out = [];
  (apiList || []).forEach(item => {
    const subExamNames = (item.subExams || []).map(s => s.examName);
    const subExamIDs   = (item.subExams || []).map(s => s.examID);
    const created = item.createdDate ? new Date(item.createdDate).toLocaleDateString('en-GB') : '';
    (item.classSections || []).forEach(cs => {
      out.push({
        id:               `${item.id}_${cs.classID}_${cs.sectionID}`,
        combinedResultID: item.id,
        name:             item.combinedResultName,
        cls:              cs.className,
        section:          cs.sectionName,
        classID:          cs.classID,
        sectionID:        cs.sectionID,
        mainExam:         item.mainExamName,
        mainExamID:       item.mainExamID,
        subExams:         subExamNames,
        subExamIDs,
        subExamMeta:      item.subExams || [],
        created,
        published:        !!cs.isPublished,
        studentCount:     cs.studentCount ?? 0,
        students:         [],   // loaded on row expand (Stage 3)
      });
    });
  });
  return out;
}
