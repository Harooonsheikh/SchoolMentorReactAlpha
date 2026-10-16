/* ════════════════════════════════════════════════════════════════
    PRESCHOOL SERVICE — kahan kya laga hai, ek nazar mein:

    ✅ REAL API PE (4 cheezein) — Learning Areas, Grading Scale,
       SLO Statements, PSD Fields. In chaaron ke confirmed endpoints
       mil chuke thay (naam + response shape), isliye ye poori tarah
       backend se wired hain — insert/update/delete sab asal API hit
       karte hain. Delete sirf UN rows ke liye hoti hai jo UI me
       explicitly "Remove" (trash icon) se hataye gaye — unki dbId
       `removedDbIds` me collect hoke save ke sath backend ko jaati
       hai. Kuch bhi silently delete nahi hota.

    🟡 ABHI MOCK PE (3 cheezein) — neeche "STILL MOCKED" wale section
       me hain:
         1. getPreschoolResultData / saveStudentAssessment / publishClass
            → student ki achievements/PSD/attendance/remarks/PTM/
            promotion. YE SABSE ZAROORI HISSA HAI (asal bachon ka
            data) — bina confirmed endpoint ke ise API pe lagana
            risky hai (ghalat field names se data corrupt/lost ho
            sakta hai).
         2. getPRco / savePRco → result card visibility toggles.
         3. getPreschoolLevels → PG/Nursery/KG master list.

       In teeno ko API pe lagane ke liye chahiye: (a) endpoint ka
       naam, (b) action values (get/insert/update/delete ya kuch
       alag), (c) ek sample `action:'get'` response taake field
       mapping pata chale. Jab ye mil jaye, isi file me neeche diye
       gaye TODO blocks ko bhar dena — baaqi functions ka exact wahi
       pattern follow karna hai jo upar wali 4 cheezon me hai.

    🟡 DRAFT / UNCONFIRMED (1 cheez) — Class Assessment Type +
       Class Preschool Level (`preschooling-resultcard-crud`). Is
       endpoint ka structure tumne diya tha, isliye best-effort draft
       likha hai, lekin 4 cheezein abhi tak confirm nahi huin:
         1. classID/sectionID — numeric DB IDs hain ya naam-string?
         2. selectExam — exam ka id (number) ya name (string)?
         3. Grade 1-12 pe wapis laane ke liye action 'delete' hai ya
            'update' with isPreSchooling:false?
         4. action:'get' ka exact response shape kya hai?
       Jab tak ye confirm na ho, is function ko use na karna — abhi
       ke liye mock wale getClassAssessmentTypes/setClassAssessmentType
       wagera hi active hain (neeche "STILL MOCKED" section).
   ════════════════════════════════════════════════════════════════ */

import {
  mockPreschoolLevels, mockPreschoolResultData, mockPRco,
} from '../mock/preschool';
import { delay, clone } from './_http';
import { apiPost, getBranchId } from './api';

/* ════════════════════════════════════════════════════════════════
   IMPORTANT: delete sirf EXPLICITLY batayi gayi dbIds ke liye hoti
   hai (removedDbIds param) — kisi cache/diff se infer nahi hoti.
   Har save call pe list ka HAR item insert (naya) ya update (dbId
   wala) ho jata hai; kuch bhi silently delete nahi hota.

   Delete ke waqt payload me sirf id + isActive:false + action:'delete'
   nahi bhejte — har "section" ki apni cache se us row ki ASAL field
   values (naam/label/color/range) nikaal ke wahi dubara bhejte hain,
   taake agar backend delete ke waqt bhi non-empty fields validate
   karta ho to woh na toote. Cache GET call pe bharti hai aur har
   successful save ke baad refresh hoti hai.
   ════════════════════════════════════════════════════════════════ */
let _laCache = [];       // [{ id, dbId, name, icon }]
let _gradingCache = [];  // [{ id, dbId, code, label, range, color }]
let _sloCache = {};      // { [levelId]: { [laId]: [{ id, dbId, text }] } }
let _psdCache = [];      // [{ id, dbId, label }]

/* ════════════════════════════════════════════════════════════════
   ✅ 1. Learning Areas — REAL API (preschooling-learningareas-crud)
   ════════════════════════════════════════════════════════════════ */
   /* ════════════════════════════════════════════════════════════════
   🟡 3. Preschool Levels (PG/Nursery/KG) — STILL MOCKED.
   ════════════════════════════════════════════════════════════════ */
export async function getPreschoolLevels() {
  await delay();
  return clone(mockPreschoolLevels);
}
export async function getLearningAreas() {
  const res = await apiPost('preschooling-learningareas-crud', {
    id: 0, branchID: getBranchId(), action: 'get',
  });
  const list = (res.data || []).map(row => ({
    id: String(row.id), dbId: row.id, name: row.subjectName, icon: 'fa-book',
  }));
  _laCache = list;
  return clone(list);
}

export async function saveLearningAreas(list, removedDbIds = []) {
  const ops = [];

  (removedDbIds || []).forEach(dbId => {
    if (!dbId) return;
    const original = _laCache.find(x => x.dbId === dbId);
    ops.push(apiPost('preschooling-learningareas-crud', {
      id: dbId, branchID: getBranchId(),
      subjectName: original?.name || '',
      isActive: false, action: 'delete',
    }).then(() => null));
  });

  (list || []).forEach(item => {
    if (item.dbId) {
      ops.push(apiPost('preschooling-learningareas-crud', {
        id: item.dbId, branchID: getBranchId(), subjectName: item.name, isActive: true, action: 'update',
      }).then(() => item));
    } else {
      ops.push(apiPost('preschooling-learningareas-crud', {
        id: 0, branchID: getBranchId(), subjectName: item.name, isActive: true, action: 'insert',
      }).then(res => ({ ...item, dbId: res.id })));
    }
  });

  const saved = (await Promise.all(ops)).filter(Boolean);
  _laCache = saved;
  return clone(saved);
}

/* ════════════════════════════════════════════════════════════════
   ✅ 2. Assessment Criteria / Grading Scale — REAL API
   (preschooling-assessmentcriteria-crud)
   ════════════════════════════════════════════════════════════════ */
export async function getGradingScale() {
  const res = await apiPost('preschooling-assessmentcriteria-crud', {
    id: 0, branchID: getBranchId(), action: 'get',
  });
  const list = (res.data || []).map(row => ({
    id: String(row.id), dbId: row.id,
    label: row.assessmentName, range: row.percentage, color: row.color,
    code: deriveCodeFromLabel(row.assessmentName),
  }));
  _gradingCache = list;
  return clone(list);
}

export async function saveGradingScale(list, renameMap, removedDbIds = []) {
  const ops = [];

  (removedDbIds || []).forEach(dbId => {
    if (!dbId) return;
    const original = _gradingCache.find(x => x.dbId === dbId);
    ops.push(apiPost('preschooling-assessmentcriteria-crud', {
      id: dbId, branchID: getBranchId(),
      assessmentName: original?.label || '',
      percentage: original?.range || '',
      color: original?.color || '',
      isActive: false, action: 'delete',
    }).then(() => null));
  });

  (list || []).forEach(item => {
    if (item.dbId) {
      ops.push(apiPost('preschooling-assessmentcriteria-crud', {
        id: item.dbId, branchID: getBranchId(), assessmentName: item.label, percentage: item.range || '', color: item.color, isActive: true, action: 'update',
      }).then(() => item));
    } else {
      ops.push(apiPost('preschooling-assessmentcriteria-crud', {
        id: 0, branchID: getBranchId(), assessmentName: item.label, percentage: item.range || '', color: item.color, isActive: true, action: 'insert',
      }).then(res => ({ ...item, dbId: res.id })));
    }
  });

  const saved = (await Promise.all(ops)).filter(Boolean);
  _gradingCache = saved;

  if (renameMap && Object.keys(renameMap).length) {
    Object.values(mockPreschoolResultData).forEach(bucket => {
      (bucket.students || []).forEach(rec => {
        Object.values(rec.achievements || {}).forEach(area => {
          Object.keys(area).forEach(sloId => { if (renameMap[area[sloId]]) area[sloId] = renameMap[area[sloId]]; });
        });
        Object.keys(rec.psd || {}).forEach(fieldId => { if (renameMap[rec.psd[fieldId]]) rec.psd[fieldId] = renameMap[rec.psd[fieldId]]; });
      });
    });
  }
  return clone(saved);
}

function deriveCodeFromLabel(label) {
  const words = (label || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return words.map(w => w[0].toUpperCase()).join('');
}

/* ════════════════════════════════════════════════════════════════
   🟡 3. Preschool Levels (PG/Nursery/KG) — STILL MOCKED.
   ════════════════════════════════════════════════════════════════ */
export async function getSloStatements() {
  const [levels, areas] = await Promise.all([
    getPreschoolLevels(),
    _laCache.length ? Promise.resolve(_laCache) : getLearningAreas(),
  ]);
  const norm = s => String(s || '').trim().toLowerCase();
  const levelByName = new Map(levels.map(l => [norm(l.name), l.id]));
  const laByName = new Map(areas.map(a => [norm(a.name), a.id]));

  const res = await apiPost('preschooling-slos-crud', { id: 0, branchID: getBranchId(), action: 'get' });
  const nested = {};
  (res.data || []).forEach(row => {
    const levelId = levelByName.get(norm(row.class));
    const laId = laByName.get(norm(row.subject));
    if (!levelId || !laId) return;
    if (!nested[levelId]) nested[levelId] = {};
    if (!nested[levelId][laId]) nested[levelId][laId] = [];
    nested[levelId][laId].push({ id: String(row.id), dbId: row.id, text: row.assessmentName });
  });
  _sloCache = nested;
  return clone(nested);
}

export async function saveSloStatements(levelId, learningAreaId, statements, removedDbIds = []) {
  const levels = await getPreschoolLevels();
  const areas = _laCache.length ? _laCache : await getLearningAreas();
  const levelName = levels.find(l => l.id === levelId)?.name;
  const laName = areas.find(a => a.id === learningAreaId)?.name;
  const original = (_sloCache[levelId] && _sloCache[levelId][learningAreaId]) || [];

  const ops = [];

  (removedDbIds || []).forEach(dbId => {
    if (!dbId) return;
    const orig = original.find(x => x.dbId === dbId);
    ops.push(apiPost('preschooling-slos-crud', {
      id: dbId, branchID: getBranchId(), class: levelName, subject: laName,
      assessmentName: orig?.text || '',
      isActive: false, action: 'delete',
    }).then(() => null));
  });

  (statements || []).forEach(item => {
    if (item.dbId) {
      ops.push(apiPost('preschooling-slos-crud', {
        id: item.dbId, branchID: getBranchId(), class: levelName, subject: laName, assessmentName: item.text, isActive: true, action: 'update',
      }).then(() => item));
    } else {
      ops.push(apiPost('preschooling-slos-crud', {
        id: 0, branchID: getBranchId(), class: levelName, subject: laName, assessmentName: item.text, isActive: true, action: 'insert',
      }).then(res => ({ ...item, dbId: res.id })));
    }
  });

  const saved = (await Promise.all(ops)).filter(Boolean);
  if (!_sloCache[levelId]) _sloCache[levelId] = {};
  _sloCache[levelId][learningAreaId] = saved;
  return clone(saved);
}

export async function copyLevelSlo(fromLevel, toLevel) {
  const levels = await getPreschoolLevels();
  const toLevelName = levels.find(l => l.id === toLevel)?.name;
  const source = _sloCache[fromLevel] || {};
  const areas = _laCache.length ? _laCache : await getLearningAreas();
  const copy = {};

  for (const laId of Object.keys(source)) {
    const laName = areas.find(a => a.id === laId)?.name;
    const inserted = [];
    for (const s of source[laId] || []) {
      const res = await apiPost('preschooling-slos-crud', {
        id: 0, branchID: getBranchId(), class: toLevelName, subject: laName, assessmentName: s.text, isActive: true, action: 'insert',
      });
      inserted.push({ id: String(res.id), dbId: res.id, text: s.text });
    }
    copy[laId] = inserted;
  }
  _sloCache[toLevel] = copy;
  return clone(_sloCache);
}

/* ════════════════════════════════════════════════════════════════
   ✅ 5. Personal & Social Development Fields — REAL API
   (preschooling-personalsocial-crud)
   ════════════════════════════════════════════════════════════════ */
export async function getPsdFields() {
  const res = await apiPost('preschooling-personalsocial-crud', {
    id: 0, branchID: getBranchId(), action: 'get',
  });
  const list = (res.data || []).map(row => ({
    id: String(row.id), dbId: row.id, label: row.fieldName,
  }));
  _psdCache = list;
  return clone(list);
}

export async function savePsdFields(list, removedDbIds = []) {
  const ops = [];

  (removedDbIds || []).forEach(dbId => {
    if (!dbId) return;
    const original = _psdCache.find(x => x.dbId === dbId);
    ops.push(apiPost('preschooling-personalsocial-crud', {
      id: dbId, branchID: getBranchId(),
      fieldName: original?.label || '',
      isActive: false, action: 'delete',
    }).then(() => null));
  });

  (list || []).forEach(item => {
    if (item.dbId) {
      ops.push(apiPost('preschooling-personalsocial-crud', {
        id: item.dbId, branchID: getBranchId(), fieldName: item.label, isActive: true, action: 'update',
      }).then(() => item));
    } else {
      ops.push(apiPost('preschooling-personalsocial-crud', {
        id: 0, branchID: getBranchId(), fieldName: item.label, isActive: true, action: 'insert',
      }).then(res => ({ ...item, dbId: res.id })));
    }
  });

  const saved = (await Promise.all(ops)).filter(Boolean);
  _psdCache = saved;
  return clone(saved);
}

/* ════════════════════════════════════════════════════════════════
   🟡 STILL MOCKED — Student Data, Publish, etc.
   ════════════════════════════════════════════════════════════════ */
export async function getPreschoolResultData() { await delay(); return clone(mockPreschoolResultData); }

function ensureClassBucket(key) {
  if (!mockPreschoolResultData[key]) mockPreschoolResultData[key] = { released: false, students: [] };
  return mockPreschoolResultData[key];
}

export async function saveStudentAssessment(key, studentId, patch) {
  await delay();
  const bucket = ensureClassBucket(key);
  const idx = bucket.students.findIndex(s => String(s.studentId) === String(studentId));
  if (idx >= 0) bucket.students[idx] = { ...bucket.students[idx], ...patch };
  else bucket.students.push({ studentId, attendance: { workingDays: 0, presentDays: 0 }, achievements: {}, psd: {}, teacherRemarks: '', ptm: null, ...patch });
  return clone(bucket.students.find(s => String(s.studentId) === String(studentId)));
}

export async function publishClass(key, released) {
  await delay();
  const bucket = ensureClassBucket(key);
  bucket.released = !!released;
  return clone(bucket);
}

/* ════════════════════════════════════════════════════════════════
   ✅ 6. Result Card Options (PRco) — REAL API
   (preschooling-resultcard-crud)
   ════════════════════════════════════════════════════════════════ */
const PRCO_FIELD_MAP = [
  { label: 'Show School Logo', field: 'showSchoolLogo' },
  { label: 'Show Student Photo', field: 'showStudentPhoto' },
  { label: 'Show Attendance Summary', field: 'showAttendanceSummary' },
  { label: 'Show Overall Performance Summary', field: 'showOverallPerformanceSummary' },
  { label: 'Show Performance Chart', field: 'showPerformanceChart' },
  { label: 'Show Subject-wise Assessment', field: 'showSubjectWiseAssessment' },
  { label: 'Show Personal & Social Development', field: 'showPersonalAndSocialDevelopment' },
  { label: 'Show Teacher Observation Remarks', field: 'showTeacherObservationRemarks' },
  { label: 'Show Parent Teacher Meeting Section', field: 'showParentTeacherMeetingSection' },
  { label: 'Show Promotion / Retention Status', field: 'showPromotionRetentionStatus' },
];

let _prcoDbId = 0;

export async function getPRco() {
  const res = await apiPost('preschooling-resultcard-crud', {
    id: 0, branchID: getBranchId(), action: 'get',
  });
  const row = res?.data || {};
  _prcoDbId = row.id || 0;

  const iconByLabel = {
    'Show School Logo': 'fa-school',
    'Show Student Photo': 'fa-user',
    'Show Attendance Summary': 'fa-calendar-check',
    'Show Overall Performance Summary': 'fa-chart-simple',
    'Show Performance Chart': 'fa-chart-pie',
    'Show Subject-wise Assessment': 'fa-book',
    'Show Personal & Social Development': 'fa-people-arrows',
    'Show Teacher Observation Remarks': 'fa-comment-dots',
    'Show Parent Teacher Meeting Section': 'fa-handshake',
    'Show Promotion / Retention Status': 'fa-arrow-up-right-from-square',
  };
  const toggles = PRCO_FIELD_MAP.map(({ label, field }) => ({
    label, icon: iconByLabel[label], on: !!row[field],
  }));

  return { toggles: clone(toggles), reportType: row.reportType || 'monthly' };
}

export async function savePRco(list, reportType) {
  const byLabel = {};
  (list || []).forEach(item => { byLabel[item.label] = item.on; });

  const payload = { id: _prcoDbId, branchID: getBranchId(), reportType: reportType || 'monthly', action: 'save' };
  PRCO_FIELD_MAP.forEach(({ label, field }) => { payload[field] = !!byLabel[label]; });

  const res = await apiPost('preschooling-resultcard-crud', payload);
  if (res?.id) _prcoDbId = res.id;
  return clone(list);
}

/* ════════════════════════════════════════════════════════════════
   ✅ Class Assessment Type / Class Preschool Level — REAL API & LocalStorage
   ════════════════════════════════════════════════════════════════ */
export async function getClassAssessmentTypesForExam(examClasses, termID, examID, keyBuilder) {
  if (!examClasses || !examClasses.length) return { types: {}, levels: {} };

  const res = await apiPost('addexam-preschooling-crud', {
    id: 0,
    branchID: getBranchId(),
    termID: Number(termID) || 0,
    selectExam: String(examID ?? ''),
    action: 'get',
  });

  const rows = Array.isArray(res) ? res
    : Array.isArray(res?.data) ? res.data
    : Array.isArray(res?.Data) ? res.Data
    : [];

  const levels = await getPreschoolLevels();
  const levelIdByName = new Map(
    levels.map(l => [String(l.name || '').trim().toLowerCase(), l.id])
  );

  const types = {};
  const levelsOut = {};

  rows.forEach(row => {
    const rClassID   = row.classID ?? row.ClassID ?? row.gradeID ?? row.GradeID;
    const rSectionID = row.sectionID ?? row.SectionID;
    const isPre      = row.isPreSchooling ?? row.IsPreSchooling ?? row.isPreschool ?? row.IsPreschool;
    const levelName  = row.changePreSchoolingClassName ?? row.ChangePreSchoolingClassName
                     ?? row.preSchoolingClassName ?? row.levelName ?? row.LevelName ?? '';

    if (!isPre || rClassID == null || rSectionID == null) return;

    const idx = examClasses.findIndex(c =>
      String(c.classID) === String(rClassID) && String(c.sectionID) === String(rSectionID)
    );
    if (idx === -1) return;
    const key = keyBuilder ? keyBuilder(examClasses[idx], idx) : `rcls_${examID}_${examClasses[idx].sectionID}_${idx}`;

    types[key] = 'preschool';

    const levelId = levelIdByName.get(String(levelName).trim().toLowerCase());
    if (levelId) levelsOut[key] = levelId;
  });

  return { types, levels: levelsOut };
}

const PCLS_TYPES_KEY = 'sm.preschool.classTypes';
const PCLS_LEVELS_KEY = 'sm.preschool.classLevels';

function _readLocalMap(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function _writeLocalMap(storageKey, map) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Ignore storage errors.
  }
}

export async function getClassAssessmentTypes() {
  await delay();
  return clone(_readLocalMap(PCLS_TYPES_KEY));
}

export async function setClassAssessmentType(key, type) {
  await delay();
  const map = _readLocalMap(PCLS_TYPES_KEY);

  if (type === 'preschool') {
    map[key] = 'preschool';
  } else {
    delete map[key];
  }

  _writeLocalMap(PCLS_TYPES_KEY, map);
  return clone(map);
}

export async function getClassPreschoolLevels() {
  await delay();
  return clone(_readLocalMap(PCLS_LEVELS_KEY));
}

export async function setClassPreschoolLevel(key, levelId) {
  await delay();
  const map = _readLocalMap(PCLS_LEVELS_KEY);

  if (levelId) {
    map[key] = levelId;
  } else {
    delete map[key];
  }

  _writeLocalMap(PCLS_LEVELS_KEY, map);
  return clone(map);
}
/* ════════════════════════════════════════════════════════════════
   ✅ 7. Student SLO Assessment (EE/ME/AE/NYME per subject+SLO) — REAL API
   Endpoint name ASSUMED 'preschooling-studentassessment-crud' — agar
   backend ka naam alag hai to sirf neeche ye ek constant badal dein.
   Is schema mein examId/termId nahi hai — ye student ki CURRENT
   rating store karta hai (har subject+SLO ke liye ek row).
   ════════════════════════════════════════════════════════════════ */
const SLO_ASSESS_ENDPOINT = 'preschooling-marks-crud';

export async function getStudentSloAssessments({ gradeId, sectionId, studentId }) {
  const res = await apiPost(SLO_ASSESS_ENDPOINT, {
    id: 0,
    branchId: getBranchId(),
    gradeId: Number(gradeId) || 0,
    sectionId: Number(sectionId) || 0,
    studentId: Number(studentId) || 0,
    preSubjectId: 0,
    preSLOId: 0,
    studentAssessment: '',
    action: 'get',
  });
  const rows = Array.isArray(res) ? res : (res?.data || res?.Data || []);
  // { [preSubjectId]: { [preSLOId]: { id, code } } }
  const map = {};
  rows.forEach(row => {
    const subId = String(row.preSubjectId ?? row.PreSubjectId ?? '');
    const sloId = String(row.preSLOId ?? row.PreSLOId ?? '');
    if (!subId || !sloId) return;
    if (!map[subId]) map[subId] = {};
    map[subId][sloId] = {
      id: row.id ?? row.Id ?? 0,
      code: row.studentAssessment ?? row.StudentAssessment ?? '',
    };
  });
  return map;
}
export async function saveSloAssessment({ id, gradeId, sectionId, studentId, preSubjectId, preSLOId, code }) {
  const isUpdate = !!id;
  const now = new Date().toISOString();
  const payload = {
    id: isUpdate ? id : 0,
    branchId: getBranchId(),
    gradeId: Number(gradeId) || 0,
    sectionId: Number(sectionId) || 0,
    studentId: Number(studentId) || 0,
    preSubjectId: Number(preSubjectId) || 0,
    preSLOId: Number(preSLOId) || 0,
    studentAssessment: code,          // yahi EE / ME / AE / NYME code jaata hai
    createdBy: 0,
    createdAt: now,
    modifiedBy: 0,
    modifiedAt: now,
    action: isUpdate ? 'update' : 'insert',
  };
  const res = await apiPost(SLO_ASSESS_ENDPOINT, payload);
  return res?.id ?? res?.Id ?? id ?? 0;
}