/* ════════════════════════════════════════════════════════════════
   PRESCHOOL CLASS SETUP STORE — Result Setup → Preschool / Montessori
   → "Setup Preschool Classes".

   ⚠️ LOCAL-ONLY (no backend yet). The backend has NO school-wide
   "this class-section is Preschool at level X" endpoint. The only live
   preschool flag is PER EXAM (`addexam-preschooling-crud`, read back
   through getclassesinexam's isPreSchooling / preLevelName), which the
   Single Assessment Result screen in Examination.jsx already uses.

   So the class → SLO-level mapping is kept in this browser's
   localStorage, keyed by BRANCH:
       sm.exam.preschoolClassSetup.v1.b<branchID>
       → { "<classID>_<sectionID>": "pg" | "nur" | "kg" }
   Level ids are the same ones preschoolService.getPreschoolLevels()
   returns (pg / nur / kg = Playgroup / Nursery / KG).

   When a real endpoint exists, replace getPreschoolClassSetup /
   savePreschoolClassSetup below — every caller goes through them.

   Helpers exported for the rest of the Examination module:
     • excludePreschoolClasses(list, map) — drop Preschool class-sections
       from a list (used to keep them out of Combined Assessment Result).
     • isPreschoolClassSection(map, classID, sectionID)
     • preschoolLevelFor(map, classID, sectionID)
     • syncExamPreschoolFlag(...) — OPTIONAL: pushes the mapping for one
       class into one exam through the EXISTING addexam-preschooling-crud
       endpoint, with the exact payload Examination.jsx already sends
       from its per-row toggle. Not called automatically.
   ════════════════════════════════════════════════════════════════ */

import { apiPost, getBranchId } from './api';
import { buildUrl } from '../../utils/apiConfig';

export const PRESCHOOL_CLASS_SETUP_EVENT = 'sm:preschool-class-setup-changed';

/* Same canonical API strings preschoolService / Examination.jsx use for
   `changePreSchoolingClassName`. */
const API_LEVEL_NAME = { pg: 'PlayGroup/Pre1', nur: 'Nursery/Pre2', kg: 'KG/Pre3' };

const storageKey = () => `sm.exam.preschoolClassSetup.v1.b${getBranchId()}`;

export const preschoolClassKey = (classID, sectionID) => `${classID ?? ''}_${sectionID ?? ''}`;

function readMap() {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/* { "<classID>_<sectionID>": levelId } for the current branch. */
export async function getPreschoolClassSetup() {
  return { ...readMap() };
}

/* Replaces the whole map for the current branch. Returns the saved map. */
export async function savePreschoolClassSetup(map) {
  const clean = {};
  Object.entries(map || {}).forEach(([k, v]) => { if (k && v) clean[k] = String(v); });
  try {
    localStorage.setItem(storageKey(), JSON.stringify(clean));
  } catch (e) {
    throw new Error('Could not save on this device (browser storage is unavailable).');
  }
  try {
    window.dispatchEvent(new CustomEvent(PRESCHOOL_CLASS_SETUP_EVENT, { detail: { ...clean } }));
  } catch { /* old browsers — ignore */ }
  return { ...clean };
}

/* Synchronous read for render-time filters. */
export function readPreschoolClassSetupSync() {
  return { ...readMap() };
}

const rowClassId = r => r?.classID ?? r?.ClassID ?? r?.gradeID ?? r?.GradeID ?? r?.gradeId;
const rowSectionId = r => r?.sectionID ?? r?.SectionID ?? r?.sectionId;

export function isPreschoolClassSection(map, classID, sectionID) {
  const m = map || readMap();
  return !!m[preschoolClassKey(classID, sectionID)];
}

export function preschoolLevelFor(map, classID, sectionID) {
  const m = map || readMap();
  return m[preschoolClassKey(classID, sectionID)] || '';
}

/* Removes every Preschool class-section from a list of
   { classID|gradeID, sectionID } rows. Rows without ids are kept. */
export function excludePreschoolClasses(list, map) {
  const m = map || readMap();
  if (!Array.isArray(list) || !Object.keys(m).length) return Array.isArray(list) ? list : [];
  return list.filter(r => {
    const c = rowClassId(r);
    const s = rowSectionId(r);
    if (c == null || s == null) return true;
    return !m[preschoolClassKey(c, s)];
  });
}

/* Branch class + section list (same live endpoint the Examination
   module already uses for its class pickers). Flat list. */
export async function loadBranchClassSections() {
  const branchID = sessionStorage.getItem('branchID');
  const empID = sessionStorage.getItem('employee_ID');
  const token = sessionStorage.getItem('token');
  const r = await fetch(
    buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${branchID}/${empID}`),
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!r.ok) throw new Error(`Could not load classes (${r.status})`);
  const data = await r.json();
  const grades = Array.isArray(data) ? data : (data?.data || []);
  const flat = [];
  grades.forEach(g => {
    (g.sections || []).forEach(sec => {
      const classID = g.id ?? g.gradeID;
      const sectionID = sec.sectionID ?? sec.id;
      if (classID == null || sectionID == null) return;
      flat.push({
        classID, sectionID,
        className: g.name ?? g.gradeName ?? '',
        sectionName: sec.sectionName ?? sec.name ?? '',
      });
    });
  });
  return flat;
}

/* Same edit guard the Examination module applies (session mismatch /
   not current / outside dates). Returns a reason string or null. */
export function examSessionLockReason() {
  try {
    const viewing = sessionStorage.getItem('changeSessionId') || sessionStorage.getItem('SessionID') || sessionStorage.getItem('sessionID') || '';
    const login = sessionStorage.getItem('SessionID') || sessionStorage.getItem('sessionID') || '';
    if (viewing && login && String(viewing) !== String(login)) return 'You are viewing a session other than your login session.';
    if ((sessionStorage.getItem('sessionStatus') || '') !== 'Current') return 'This session is not the current session, so changes are not allowed.';
    const now = new Date();
    const sStart = new Date(sessionStorage.getItem('sessionStartDate'));
    const sEnd = new Date(sessionStorage.getItem('sessionEndDate'));
    if (now < sStart || now > sEnd) return 'Today is outside this session\'s start and end dates, so changes are not allowed.';
  } catch { /* storage unavailable — do not block */ }
  return null;
}

/* OPTIONAL bridge to the live per-exam flag. Sends the exact payload the
   Single Assessment Result toggle sends today. levelId '' → Grade 1-12. */
export async function syncExamPreschoolFlag({ termID, selectExam, classID, sectionID, levelId }) {
  const isPre = !!levelId;
  const payload = {
    id: 0,
    branchID: getBranchId(),
    termID: Number(termID) || 0,
    selectExam: String(selectExam ?? ''),
    classID: String(classID ?? ''),
    sectionID: String(sectionID ?? ''),
    dateFrom: new Date().toISOString(),
    dateTo: new Date().toISOString(),
    isPreSchooling: isPre,
    changePreSchoolingClassName: isPre ? (API_LEVEL_NAME[levelId] || '') : '',
    action: 'save',
  };
  if (!payload.termID || !payload.selectExam || !payload.classID || !payload.sectionID || (isPre && !payload.changePreSchoolingClassName)) {
    throw new Error('Missing exam, term, class, section, or preschool level details');
  }
  return apiPost('addexam-preschooling-crud', payload);
}
