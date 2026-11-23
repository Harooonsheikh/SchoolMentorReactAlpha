/* ═══════════════════════════════════════════════════════════════════
   EXAMINATION → REPORTS — live data loader.

   The Reports tab no longer depends on what the user happened to open in the
   other tabs. It pulls, for EVERY term of the session:
     • exams           /api/getexamsbybranchidtermid
     • date sheet      /api/getdatesheetbybranchclassidtermid        (per class)
     • syllabus        /api/getexamsyllabusbybranchclassandterms     (per class)
     • result upload   /api/getstudentsbybranchsectionandgrade
                       /api/getsasubjectbybranchclassandtermtotalsum
                       /api/getsauploadmarksbystudentbranchsum       (per class)
   Read-only: no updaterankings call (that one writes).

   Store keys match Examination's own stores so the report helpers can read
   both:  dateSheets[examId]['cls_<examId>_<sectionID>_<idx>']
          syllabus[examId]['scls_<examId>_<sectionID>_<idx>']
          results['rcls_<examId>_<sectionID>_<idx>'] = { students, subjects, marks }
   ═══════════════════════════════════════════════════════════════════ */
import { buildUrl } from '../../utils/apiConfig';

const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`, Accept: 'application/json' });
const ss = (k) => sessionStorage.getItem(k) || '';
const asList = (d) => (Array.isArray(d) ? d : (d?.data || d?.Data || d?.result || []));

async function getJson(path) {
  const r = await fetch(buildUrl(path), { method: 'GET', headers: headers() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

/* Same grouping as Examination.getExamsByTerm: one exam per examName+term, classes by section. */
export async function fetchExamsForTerm(term) {
  const termID = term?.id ?? term?.termID ?? term;
  const q = new URLSearchParams({ branchID: ss('branchID'), termID: String(termID), empID: ss('employee_ID') });
  let data = [];
  try { data = asList(await getJson(`/api/getexamsbybranchidtermid?${q}`)); } catch (e) { return []; }
  const map = {};
  data.forEach((ex) => {
    const key = `${ex.examName}_${ex.termID}`;
    if (!map[key]) {
      map[key] = {
        id: ex.id, name: ex.examName, termID: ex.termID,
        termName: ex.termName || term?.term || '',
        selectExam: ex.selectExam, from: ex.dateFrom, to: ex.dateTo, gradeName: ex.gradeName,
        classes: new Map(),
      };
    }
    map[key].classes.set(String(ex.sectionID), {
      id: ex.id, classID: ex.classID, sectionID: ex.sectionID, sectionName: ex.sectionName, gradeName: ex.gradeName,
      className: `${ex.gradeName || ''}${ex.sectionName ? ' - ' + ex.sectionName : ''}`.trim(),
    });
  });
  return Object.values(map).map((ex) => ({ ...ex, classes: Array.from(ex.classes.values()) }));
}

async function fetchDateSheet(ex, cls, mapRow) {
  const q = new URLSearchParams({
    branchID: ss('branchID'), classID: String(cls.classID), termID: String(ex.termID),
    ExamID: String(ex.selectExam), sectionID: String(cls.sectionID), empID: ss('employee_ID'),
  });
  const rows = asList(await getJson(`/api/getdatesheetbybranchclassidtermid?${q}`));
  return mapRow ? rows.map(mapRow) : rows;
}

async function fetchSyllabus(ex, cls) {
  const q = new URLSearchParams({
    branchID: ss('branchID'), classID: String(cls.classID), Terms: String(ex.termID),
    ExamID: String(ex.selectExam), sectionID: String(cls.sectionID), pageNo: '1', empID: ss('employee_ID'),
  });
  const rows = asList(await getJson(`/api/getexamsyllabusbybranchclassandterms?${q}`));
  const seen = new Set();
  return rows.reduce((acc, r) => {
    const dk = String(r.subjectName ?? r.subjectID ?? r.subjectDisplayName ?? '');
    if (dk && seen.has(dk)) return acc;
    if (dk) seen.add(dk);
    acc.push({ subject: r.subjectDisplayName || r.subjectName || '', content: r.subjectDetails || '', updatedAt: r.updatedAt || r.UpdatedOn || '—' });
    return acc;
  }, []);
}

async function fetchResultPack(ex, cls) {
  const base = {
    branchID: ss('branchID'), classID: String(cls.classID), termID: String(ex.termID),
    ExamID: String(ex.selectExam), sectionID: String(cls.sectionID), pageNo: '1',
  };
  const [students, subjects, marks] = await Promise.all([
    getJson(`/api/getstudentsbybranchsectionandgrade?branchID=${ss('branchID')}&sectionID=${cls.sectionID}&gradeID=${cls.classID}`).then(asList).catch(() => null),
    getJson(`/api/getsasubjectbybranchclassandtermtotalsum?${new URLSearchParams(base)}`).then(asList).catch(() => []),
    getJson(`/api/getsauploadmarksbystudentbranchsum?${new URLSearchParams(base)}`).then(asList).catch(() => []),
  ]);
  if (!students) return null;
  return { students, subjects, marks };
}

async function pool(jobs, size, run, isCancelled) {
  for (let i = 0; i < jobs.length; i += size) {
    if (isCancelled()) return;
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(jobs.slice(i, i + size).map((j) => run(j).catch(() => {})));
  }
}

/**
 * Load everything the Reports tab shows.
 * @param terms   session terms ({ id, term })
 * @param opts    { mapDateSheetRow, isCancelled, onProgress(done,total) }
 * @returns { exams, dateSheets, syllabus, results }
 */
export async function loadExamReportsData(terms, { mapDateSheetRow, isCancelled = () => false, onProgress } = {}) {
  const termList = (terms || []).filter((t) => t && (t.id ?? t.termID) != null);
  const perTerm = await Promise.all(termList.map((t) => fetchExamsForTerm(t)));
  const exams = perTerm.flat().filter((ex) => ex && ex.id != null);

  const dateSheets = {};
  const syllabus = {};
  const results = {};
  const jobs = [];
  exams.forEach((ex) => {
    dateSheets[ex.id] = {};
    syllabus[ex.id] = {};
    ex.classes.forEach((cls, idx) => {
      if (cls && cls.classID != null) jobs.push({ ex, cls, idx });
    });
  });

  let done = 0;
  if (onProgress) onProgress(0, jobs.length);
  await pool(jobs, 4, async ({ ex, cls, idx }) => {
    const tail = `${ex.id}_${cls.sectionID}_${idx}`;
    const [ds, syl, res] = await Promise.all([
      fetchDateSheet(ex, cls, mapDateSheetRow).catch(() => null),
      fetchSyllabus(ex, cls).catch(() => null),
      fetchResultPack(ex, cls).catch(() => null),
    ]);
    if (ds) dateSheets[ex.id][`cls_${tail}`] = ds;
    if (syl) syllabus[ex.id][`scls_${tail}`] = syl;
    if (res) results[`rcls_${tail}`] = res;
    done += 1;
    if (onProgress) onProgress(done, jobs.length);
  }, isCancelled);

  return { exams, dateSheets, syllabus, results };
}
