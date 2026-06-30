import {
  mockFeeHeads,
  mockFeeSettings,
  mockChallans,
  mockReceipts,
  mockFeeHistory,
  mockGeneratedChallans,
  mockFamilies,
  mockGeneratedFamilyChallans,
  mockFamilyReceipts,
} from '../mock/fee';
import { delay, clone } from './_http';
import { buildUrl, apiMessage } from '../../utils/apiConfig';

const pick = (obj, ...keys) => keys.map(k => obj?.[k]).find(v => v !== undefined && v !== null && v !== '');

/* ═══════════════════════════════════════════════════════════════════
   Student Fee Setup — real API wiring (LaunchSetup).

   Fee heads are defined per grade (class). The grades endpoint returns
   each grade with its fee heads nested; we project that into the flat
   { key, cls, _gradeId, heads:[{ feeStructureID, name, amt }] } rows the
   Fee Setup table reads. Add / edit / delete of individual heads go
   through the same per-head endpoints used by the Launch Setup Classes
   tab. branchID / UserID come from sessionStorage (set at login).
   ═══════════════════════════════════════════════════════════════════ */
export async function getFeeGrades() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const [gradesRes, sectionsRes] = await Promise.all([
    fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), {
      headers: { Accept: '*/*' },
    }),
    fetch(buildUrl(`/api/LaunchSetup/get-class-section-studentlist-by-branch/${branchID}`), {
      headers: { Accept: '*/*' },
    }),
  ]);
  const gradesJson = await gradesRes.json().catch(() => null);
  const sectionsJson = await sectionsRes.json().catch(() => null);
  if (!gradesRes.ok) throw new Error(apiMessage(gradesJson) || 'Could not load classes');
  if (!sectionsRes.ok) throw new Error(apiMessage(sectionsJson) || 'Could not load class sections');

  const gradesData = Array.isArray(gradesJson?.data) ? gradesJson.data : [];
  const sectionsData = Array.isArray(sectionsJson?.data) ? sectionsJson.data : [];
  const sectionsByGrade = new Map();
  sectionsData.forEach(g => {
    const gradeId = pick(g, 'id', 'gradeID', 'gradeId', 'classID');
    sectionsByGrade.set(String(gradeId), Array.isArray(g.sections) ? g.sections : []);
  });

  return [...gradesData]
    .sort((a, b) => (a.orderBy || 0) - (b.orderBy || 0))
    .flatMap(g => {
      const gradeId = pick(g, 'id', 'gradeID', 'gradeId', 'classID') || 0;
      const cls = g.name ?? g.gradeName ?? '-';
      const heads = (g.feeHeads || []).map(h => ({
        feeStructureID: h.feeStructureID ?? h.id ?? 0,
        name:           h.headName ?? h.name ?? '',
        amt:            Number(h.amount ?? h.amt) || 0,
      }));
      const sections = sectionsByGrade.get(String(gradeId)) || [];
      if (!sections.length) {
        return [{
          key:        `g${gradeId}-s0`,
          cls,
          sec:        'No Section',
          _gradeId:   gradeId,
          _sectionId: 0,
          heads,
        }];
      }
      return sections.map(s => {
        const sectionId = pick(s, 'sectionID', 'id', 'sectionId') || 0;
        return {
          key:        `g${gradeId}-s${sectionId}`,
          cls,
          sec:        pick(s, 'sectionName', 'name') || '-',
          _gradeId:   gradeId,
          _sectionId: sectionId,
          heads,
        };
      });
    });
}

async function getFeeGradesByGradeOnly() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load classes');
  const data = Array.isArray(json?.data) ? json.data : [];
  return [...data]
    .sort((a, b) => (a.orderBy || 0) - (b.orderBy || 0))
    .map(g => ({
      key:      `g${g.id}`,
      cls:      g.name ?? g.gradeName ?? '—',
      sec:      'No Section',
      _gradeId: g.id,
      heads:    (g.feeHeads || []).map(h => ({
        feeStructureID: h.feeStructureID ?? h.id ?? 0,
        name:           h.headName ?? h.name ?? '',
        amt:            Number(h.amount ?? h.amt) || 0,
      })),
    }));
}

/* Transport setup uses the same LaunchSetup class/section/student roster. */
async function fetchFeeClassStudents() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-class-section-studentlist-by-branch/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load class students');

  const grades = Array.isArray(json?.data) ? json.data : [];
  const classes = [];
  const studentsMap = {};

  grades.forEach(g => {
    const gradeId = pick(g, 'id', 'gradeID', 'gradeId', 'classID') || 0;
    const cls = pick(g, 'name', 'gradeName', 'className') || '-';
    const sections = Array.isArray(g.sections) ? g.sections : [];

    sections.forEach(s => {
      const sectionId = pick(s, 'sectionID', 'id', 'sectionId') || 0;
      const sec = pick(s, 'sectionName', 'name') || '-';
      const key = `g${gradeId}-s${sectionId}`;
      const students = (Array.isArray(s.students) ? s.students : []).map(st => {
        const studentID = pick(st, 'id', 'studentID', 'studentId') || 0;
        const reg = String(
          pick(st, 'registerNo', 'regNo', 'registrationNo', 'admissionNo', 'previousAdmissionNo') ||
          studentID ||
          ''
        );
        const first = pick(st, 'firstName', 'name', 'studentName');
        const last = pick(st, 'lastName');
        const fullName = [first, last].filter(Boolean).join(' ').trim();
        return {
          studentID,
          reg,
          name: fullName || '-',
          father: pick(st, 'fatherName', 'guardianName') || '-',
          route: pick(st, 'route', 'transportRoute', 'area', 'transportArea') || '',
          transport: Number(pick(st, 'transportFee', 'transportFeeAmount', 'transportAmount', 'transport')) || 0,
          dues: Number(pick(st, 'dues', 'pendingDues')) || 0,
          advance: Number(pick(st, 'advance', 'advanceAmount')) || 0,
          current: Number(pick(st, 'current', 'currentFee')) || 0,
          isActive: st?.isActive !== false,
          _raw: st,
        };
      }).filter(st => st.isActive);

      classes.push({
        key,
        cls,
        sec,
        strength: students.length,
        _gradeId: gradeId,
        _sectionId: sectionId,
      });
      studentsMap[key] = students;
    });
  });

  return { classes, studentsMap };
}

/* Authoritative fee heads for one grade. */
export async function getFeeGradeHeads(gradeId) {
  if (!gradeId) return [];
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-grade-feeheads/${branchID}/${gradeId}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load fee heads');
  const data = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  return data.map(h => ({
    feeStructureID: h.id ?? h.feeStructureID ?? 0,
    name:           h.headName ?? h.name ?? '',
    amt:            Number(h.amount) || 0,
  }));
}

/* Add (feeStructureID 0) or update (>0) a single fee head. */
export async function saveFeeHead({ feeStructureID = 0, gradeId, name, amt }) {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const now      = new Date().toISOString();
  const res  = await fetch(buildUrl('/api/LaunchSetup/save-grade-feehead'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:         feeStructureID || 0,
      branchID,
      gradeID:    gradeId,
      headID:     0,
      headName:   name,
      amount:     amt,
      createdAt:  now,
      createdBy:  userID,
      modifiedAt: now,
      modifiedBy: userID,
      isActive:   true,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save fee head');
  return json;
}

export async function deleteFeeHead(feeStructureID) {
  const res  = await fetch(buildUrl(`/api/LaunchSetup/delete-grade-feehead/${feeStructureID}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not delete fee head');
  return json;
}

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getFeeClasses()   { const data = await fetchFeeClassStudents(); return data.classes; }
export async function getFeeHeads()     { await delay(); return clone(mockFeeHeads); }
export async function getTransportFee() { const data = await fetchFeeClassStudents(); return data.studentsMap; }
export async function getFeeSettings()  { await delay(); return clone(mockFeeSettings); }
export async function getChallans()     { await delay(); return clone(mockChallans); }
export async function getReceipts()     { await delay(); return clone(mockReceipts); }
export async function getFeeHistory()   { await delay(); return clone(mockFeeHistory); }

/* Generated-challans set is returned as a fresh Set so callers can
   add / delete locally without disturbing the seed. */
export async function getGeneratedChallans() {
  await delay();
  return new Set(mockGeneratedChallans);
}

/* Family-tree challan readers. */
export async function getFamilies() { await delay(); return clone(mockFamilies); }
export async function getGeneratedFamilyChallans() {
  await delay();
  return new Set(mockGeneratedFamilyChallans);
}

/* Write APIs — in-memory only until backend wires real endpoints. */
export async function saveFeeHeads(classKey, heads) { await delay(); return clone({ classKey, heads }); }
export async function saveTransportFee(classKey, rows) { await delay(); return clone({ classKey, rows }); }
export async function saveStudentTransport(classKey, reg, payload) { await delay(); return clone({ classKey, reg, ...payload }); }
export async function saveFeeSettings(payload) { await delay(); return clone({ ...mockFeeSettings, ...payload }); }
export async function generateChallan(classKey, reg, monthIdx, options) {
  await delay();
  return clone({ classKey, reg, monthIdx, ...options });
}
export async function deleteChallan(classKey, reg, monthIdx) {
  await delay();
  return { classKey, reg, monthIdx, deleted: true };
}
export async function deleteClassChallans(classKey, monthIdx) {
  await delay();
  return { classKey, monthIdx, cleared: true };
}
export async function generateFamilyChallan(famKey, regs, monthIdx, options) {
  await delay();
  return clone({ famKey, regs, monthIdx, ...options });
}
export async function deleteFamilyChallan(famKey, reg, monthIdx) {
  await delay();
  return { famKey, reg, monthIdx, deleted: true };
}
export async function removeFamilyChild(famKey, reg) {
  await delay();
  return { famKey, reg, removed: true };
}

/* Fee Receiving APIs. */
export async function saveReceipt(payload) {
  await delay();
  return clone({ id: `rcv-${Date.now()}`, ...payload });
}
export async function sendFeeReminder(payload) {
  await delay();
  return clone({ ok: true, sentAt: new Date().toISOString(), ...payload });
}
export async function getFamilyReceipts() { await delay(); return clone(mockFamilyReceipts); }
export async function saveFamilyReceipt(payload) {
  await delay();
  return clone({ id: `frcv-${Date.now()}`, ...payload });
}
