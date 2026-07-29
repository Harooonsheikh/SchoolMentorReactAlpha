import {
  mockFeeSettings,
  mockChallans,
  mockReceipts,
  mockFeeHistory,
  mockGeneratedChallans,
  mockGeneratedFamilyChallans,
  mockFamilyReceipts,
} from '../mock/fee';
import { delay, clone } from './_http';
import { buildUrl, apiMessage } from '../../utils/apiConfig';

const pick = (obj, ...keys) => keys.map(k => obj?.[k]).find(v => v !== undefined && v !== null && v !== '');

export async function getReportHeader() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const res = await fetch(buildUrl(`/report-header/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load report header');
  }
  return json?.data || null;
}

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
          applicantsID: Number(pick(st, 'applicantsID', 'applicantID', 'applicantId', 'studentID', 'studentId', 'id')) || studentID,
          gradeID: gradeId,
          sectionID: sectionId,
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

/* Student-specific fee discount (Fee Challans → Discount Manager → Save).
   One record per fee head: POST /api/Student/save-fee-discount. */
export async function saveFeeDiscount({ id = 0, gradeID = 0, sectionID = 0, headID = 0, headName = '', discountAmount = 0, studentID = 0, studentName = '' } = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const now      = new Date().toISOString();
  const body = {
    id:             Number(id) || 0,   // >0 → us record ko update; 0 → insert
    branchID,
    gradeID:        Number(gradeID) || 0,
    headID:         Number(headID) || 0,
    headName:       String(headName || ''),
    discountAmount: Number(discountAmount) || 0,
    studentID:      Number(studentID) || 0,
    studentName:    String(studentName || ''),
    sectionID:      Number(sectionID) || 0,
    createdAt:      now,
    createdBy:      userID,
    modifiedAt:     now,
    modifiedBy:     userID,
    isActive:       true,
  };
  const res = await fetch(buildUrl('/api/Student/save-fee-discount'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not save fee discount');
  }
  return json;
}

/* Saved fee discounts for ONE student — used to pre-fill the Discount Manager.
   GET /api/Student/get-fee-discounts-by-student/{studentId}.
   Returns only that student's rows: { headID, discountAmount, ... }. */
export async function getFeeDiscountsByStudent(studentId) {
  if (!studentId) return [];
  const res = await fetch(buildUrl(`/api/Student/get-fee-discounts-by-student/${studentId}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load fee discounts');
  }
  return Array.isArray(json?.data) ? json.data : [];
}

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getFeeClasses()   { const data = await fetchFeeClassStudents(); return data.classes; }
export async function getFeeHeads() {
  const grades = await getFeeGrades();
  return Object.fromEntries(
    grades.map(g => [g.key, clone(g.heads || [])])
  );
}
export async function getChallans()     { await delay(); return clone(mockChallans); }
export async function getReceipts()     { await delay(); return clone(mockReceipts); }
export async function getFeeHistory()   { await delay(); return clone(mockFeeHistory); }

const transportFeeBranchID = () => Number(sessionStorage.getItem('branchID')) || 1;
const transportFeeUserID = () => Number(sessionStorage.getItem('UserID')) || 1;

function mapTransportSetupFromApi(row = {}) {
  return {
    id:           Number(row.id ?? row.ID ?? 0) || 0,
    branchID:     Number(row.branchID ?? row.branchId ?? transportFeeBranchID()) || 0,
    applicantsID: Number(row.applicantsID ?? row.applicantID ?? row.applicantId ?? 0) || 0,
    gradeID:      Number(row.gradeID ?? row.gradeId ?? 0) || 0,
    sectionID:    Number(row.sectionID ?? row.sectionId ?? 0) || 0,
    amount:       Number(row.amount ?? row.transport ?? 0) || 0,
    createdDate:  row.createdDate ?? null,
    modifiedDate: row.modifiedDate ?? null,
    createdBy:    row.createdBy ?? null,
    modifiedBy:   row.modifiedBy ?? null,
    isActive:     row.isActive !== false,
  };
}

function mapTransportSetupToApi(payload = {}) {
  const now = new Date().toISOString();
  const id = Number(payload.id ?? payload.transportSetupId) || 0;
  const userID = transportFeeUserID();

  return {
    id,
    branchID:     Number(payload.branchID ?? transportFeeBranchID()) || 0,
    applicantsID: Number(payload.applicantsID ?? payload.studentID) || 0,
    gradeID:      Number(payload.gradeID ?? payload._gradeId) || 0,
    sectionID:    Number(payload.sectionID ?? payload._sectionId) || 0,
    createdDate:  payload.createdDate || now,
    modifiedDate: now,
    createdBy:    Number(payload.createdBy) || userID,
    modifiedBy:   userID,
    amount:       Number(payload.amount ?? payload.transport) || 0,
    isActive:     payload.isActive !== false,
  };
}

export async function getTransportFeeSetups() {
  const branchID = transportFeeBranchID();
  const res = await fetch(buildUrl(`/api/TransportFeeSetup/get-all?branchId=${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load transport fee setup');
  }
  return (Array.isArray(json?.data) ? json.data : []).map(mapTransportSetupFromApi);
}

export async function getTransportFeeSetup(id) {
  if (!id) return null;
  const res = await fetch(buildUrl(`/api/TransportFeeSetup/get/${id}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load transport fee setup record');
  }
  return mapTransportSetupFromApi(json?.data || {});
}

export async function getTransportFee() {
  const data = await fetchFeeClassStudents();
  const setups = await getTransportFeeSetups();
  const byApplicantClass = new Map();
  const byApplicant = new Map();

  setups.forEach(row => {
    const classKey = `${row.applicantsID}|${row.gradeID}|${row.sectionID}`;
    byApplicantClass.set(classKey, row);
    if (!byApplicant.has(String(row.applicantsID))) byApplicant.set(String(row.applicantsID), row);
  });

  return Object.fromEntries(Object.entries(data.studentsMap).map(([classKey, rows]) => [
    classKey,
    rows.map(st => {
      const setup =
        byApplicantClass.get(`${st.applicantsID}|${st.gradeID}|${st.sectionID}`) ||
        byApplicant.get(String(st.applicantsID));
      if (!setup) return st;
      return {
        ...st,
        transportSetupId: setup.id,
        transport: setup.amount,
        transportSetup: setup,
      };
    }),
  ]));
}

const feeSettingsBranchID = () => Number(sessionStorage.getItem('branchID')) || 1;
const feeSettingsUserID = () => Number(sessionStorage.getItem('UserID')) || 1;

const apiFineToUi = (fineType) => (
  String(fineType || '').toLowerCase().includes('day') ? 'daily' : 'fixed'
);

const uiFineToApi = (fineType) => (
  fineType === 'daily' ? 'Per Day Fine' : 'Fixed Amount'
);

const apiPrintSizeToUi = (size) => (
  String(size || '').toLowerCase().includes('thermal') ? 'thermal' : 'a4'
);

const uiPrintSizeToApi = (size) => (
  size === 'thermal' ? 'Thermal' : 'A4'
);

function mapFeeSettingsFromApi(row = {}) {
  return {
    ...clone(mockFeeSettings),
    id:                 Number(row.id ?? row.ID ?? 0) || 0,
    branchID:           Number(row.branchID ?? row.branchId ?? feeSettingsBranchID()) || 0,
    showDiscount:       row.showDiscount ?? mockFeeSettings.showDiscount,
    showPsd:            row.showPSDCode ?? row.showPsd ?? mockFeeSettings.showPsd,
    prevMonthChallan:   row.previousMonthFeeChallan ?? row.prevMonthChallan ?? mockFeeSettings.prevMonthChallan,
    nextMonthChallan:   row.nextMonthFeeChallan ?? row.nextMonthChallan ?? mockFeeSettings.nextMonthChallan,
    fineEnabled:        row.fineStatusEnabled ?? row.fineEnabled ?? mockFeeSettings.fineEnabled,
    fineType:           apiFineToUi(row.fineType ?? mockFeeSettings.fineType),
    fineAmt:            Number(row.fineAmountRs ?? row.fineAmt ?? mockFeeSettings.fineAmt) || 0,
    printSize:          apiPrintSizeToUi(row.defaultPrintSize ?? row.printSize ?? mockFeeSettings.printSize),
    createdDate:        row.createdDate ?? null,
    modifiedDate:       row.modifiedDate ?? null,
    createdBy:          row.createdBy ?? null,
    modifiedBy:         row.modifiedBy ?? null,
    isActive:           row.isActive ?? true,
  };
}

/* No saved record for this branch yet. Every toggle starts OFF — the mock
   defaults are all-on, and inheriting those would show the user features as
   enabled that the server has never been told about. */
function blankFeeSettings() {
  return {
    ...clone(mockFeeSettings),
    id:               0,
    branchID:         feeSettingsBranchID(),
    showDiscount:     false,
    showPsd:          false,
    prevMonthChallan: false,
    nextMonthChallan: false,
    fineEnabled:      false,
    fineAmt:          0,
    createdDate:  null,
    modifiedDate: null,
    createdBy:    null,
    modifiedBy:   null,
    isActive:     true,
  };
}

function mapFeeSettingsToApi(settings = {}) {
  const now = new Date().toISOString();
  const id = Number(settings.id) || 0;
  const userID = feeSettingsUserID();

  return {
    id,
    branchID:          Number(settings.branchID ?? feeSettingsBranchID()) || 0,
    showDiscount:      settings.showDiscount !== false,
    showPSDCode:       settings.showPsd !== false,
    previousMonthFeeChallan: settings.prevMonthChallan !== false,
    nextMonthFeeChallan:     settings.nextMonthChallan !== false,
    fineStatusEnabled: settings.fineEnabled !== false,
    fineType:          uiFineToApi(settings.fineType),
    fineAmountRs:      Number(settings.fineAmt) || 0,
    defaultPrintSize:  uiPrintSizeToApi(settings.printSize),
    createdDate:       settings.createdDate || now,
    modifiedDate:      now,
    createdBy:         Number(settings.createdBy) || userID,
    modifiedBy:        userID,
    isActive:          settings.isActive !== false,
  };
}

export async function getFeeSettings() {
  const branchID = feeSettingsBranchID();
  const res = await fetch(buildUrl(`/api/FeeChallanSettings/get-all?branchId=${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load fee challan settings');
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  /* Empty data = branch has never saved its challan settings → everything off. */
  return rows.length ? mapFeeSettingsFromApi(rows[0]) : blankFeeSettings();
}

/* Generated-challans set is returned as a fresh Set so callers can
   add / delete locally without disturbing the seed. */
export async function getGeneratedChallans() {
  await delay();
  return new Set(mockGeneratedChallans);
}

/* Family-tree challan readers.

   Real API: POST /api/FamilyTree/familytreecrud with action:'get' returns
   every family for the branch, each with a nested `students` array. We
   project that into the { key, name, guardian, children:[…] } shape the
   Family Tree Challans table reads. Fee/transport/discount figures aren't
   part of the family-tree payload (they live in the challan/fee-setup data),
   so they default to 0 until a challan is generated. */
function mapFamilyFromApi(fam) {
  const students = Array.isArray(fam?.students) ? fam.students : [];
  return {
    key: `fam${fam?.id}`,
    id: fam?.id,
    branchID: fam?.branchID,
    name: fam?.familyName || '—',
    familyDetails: fam?.familyDetails || '',
    guardian: fam?.guardianName || '—',
    contactNumber: fam?.contactNumber || '',
    email: fam?.email || '',
    children: students.map(st => ({
      reg: st?.registerNo || '',
      name: `${st?.firstName || ''} ${st?.lastName || ''}`.trim() || '—',
      father: fam?.guardianName || '',
      cls: st?.className || '',
      sec: st?.sectionName || '',
      picture: st?.picture || '',
      /* ids carried through for challan generation / detail lookups */
      detailID: st?.detailID,
      applicantsID: st?.applicantsID,
      gradeID: st?.gradeID,
      sectionID: st?.sectionID,
      /* money fields aren't in the family-tree payload yet */
      fee: 0, transport: 0, discount: 0, dues: 0, advance: 0,
    })),
  };
}

export async function getFamilies() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const res = await fetch(buildUrl('/api/FamilyTree/familytreecrud'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get',
      id: 0,
      branchID,
      familyName: '',
      familyDetails: '',
      guardianName: '',
      contactNumber: '',
      email: '',
      createdBy: 0,
      modifiedBy: 0,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load family trees');
  }
  const data = Array.isArray(json?.data) ? json.data : [];
  return data.map(mapFamilyFromApi);
}
export async function getGeneratedFamilyChallans() {
  await delay();
  return new Set(mockGeneratedFamilyChallans);
}

/* Class-wise fee heads for the branch — used to populate the Family Tree
   Challans "Select Fee Heads" dropdown. Returns { [classId]: [headName, …] }. */
export async function getClassFeeHeadsMap() {
  const branchID = sessionStorage.getItem('branchID');
  const empID    = sessionStorage.getItem('employee_ID');
  const token    = sessionStorage.getItem('token');
  const res = await fetch(buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${branchID}/${empID}`), {
    method: 'GET',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load class fee heads');
  }
  const data = Array.isArray(json?.data) ? json.data : [];
  const map = {};
  data.forEach(cls => {
    map[cls.id] = (Array.isArray(cls.feeHeads) ? cls.feeHeads : [])
      .map(h => h.headName)
      .filter(Boolean);
  });
  return map;
}

/* Class-wise fee-structure heads (full objects) for the branch — same source
   as above but keeps feeStructureID + amount. Used to resolve fee discounts
   (discount.headID ↔ feeStructureID) and to render the Discount Manager rows.
   Returns { [classId/gradeId]: [{ feeStructureID, name, amt }] }. */
export async function getClassFeeStructureMap() {
  const branchID = sessionStorage.getItem('branchID');
  const empID    = sessionStorage.getItem('employee_ID');
  const token    = sessionStorage.getItem('token');
  const res = await fetch(buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${branchID}/${empID}`), {
    method: 'GET',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load class fee heads');
  }
  const data = Array.isArray(json?.data) ? json.data : [];
  const map = {};
  data.forEach(cls => {
    map[cls.id] = (Array.isArray(cls.feeHeads) ? cls.feeHeads : []).map(h => ({
      feeStructureID: h.feeStructureID ?? h.id ?? 0,
      name:           h.headName ?? h.name ?? '',
      amt:            Number(h.amount ?? h.amt) || 0,
    }));
  });
  return map;
}

/* Write APIs — in-memory only until backend wires real endpoints. */
export async function saveFeeHeads(classKey, heads) { await delay(); return clone({ classKey, heads }); }
export async function saveTransportFee(classKey, rows) { await delay(); return clone({ classKey, rows }); }
export async function saveStudentTransport(classKey, reg, payload) {
  const body = mapTransportSetupToApi(payload);
  const res = await fetch(buildUrl('/api/TransportFeeSetup/save'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not save transport fee setup');
  }

  let returnedId = Number(json?.data?.id ?? json?.id ?? body.id) || 0;
  if (!returnedId) {
    const rows = await getTransportFeeSetups();
    const match = rows.find(row =>
      row.applicantsID === body.applicantsID &&
      row.gradeID === body.gradeID &&
      row.sectionID === body.sectionID
    );
    returnedId = match?.id || 0;
  }
  const saved = returnedId ? await getTransportFeeSetup(returnedId) : mapTransportSetupFromApi(json?.data || body);
  return { classKey, reg, ...saved };
}
export async function saveFeeSettings(payload) {
  const body = mapFeeSettingsToApi(payload);
  const res = await fetch(buildUrl('/api/FeeChallanSettings/save'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not save fee challan settings');
  }

  return getFeeSettings();
}
/* "YYYY-MM-DD" (date picker) → API datetime string.

   NOTE: toISOString() yahan NAHI chal sakta — wo LOCAL midnight ko UTC me badal
   deta hai, aur Pakistan (UTC+5) me 27 July 00:00 → "2025-07-26T19:00:00Z" ban
   jaata tha, yaani challan par ek din PEECHE ki date chhapti thi. Is liye wahi
   calendar date bina timezone suffix ke bheji jaati hai. */
const toApiDate = (value) => {
  const localToday = () => {
    const n = new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
  };
  const s = String(value || '').slice(0, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : localToday();
  return `${day}T00:00:00`;
};

/* ═══════════════════════════════════════════════════════════════════
   LATE FINE — challan due date ke BAAD receive karne par jurmana.

   Rule: base date = jo Receiving Date modal me DAALI gayi hai (system ka
   "aaj" nahi). daysLate = receivingDate − dueDate (poore din). Due date
   khud par 0 din — fine agle din se shuru hoti hai.
     fixed  → ek baar flat fineAmt
     daily  → fineAmt × daysLate
   ═══════════════════════════════════════════════════════════════════ */
export const LATE_FINE_HEAD = 'Late Fine';

/* Ledger ki wo detailRow jo late fine hai (backend persist kare to isse match ho). */
export function isLateFineRow(r) {
  const n = String(r?.subHead || r?.sub || r?.head || r?.name || '').trim().toLowerCase();
  return n === 'late fine' || n === 'fine';
}

/* Receiving ke waqt li gayi late fine ko ledger me PERSIST karne ke liye uski
   apni detailRow. Pehle fine ki row maujood ho (backend ne save ki thi) to usi
   me amount add hoti hai; warna nayi row (id: 0) bana kar bheji jaati hai.

   Is ke baghair wasool shuda fine kahin record nahi hoti thi: cash drawer aur
   ledger mismatch ho jaate the, aur reports ko fine har baar dobara compute
   karni parti thi (jo fine settings badalne par purane challans bhi badal
   deti thi).

   `blid` = parent challan (ledger) ki id — baaki detailRows ki tarah. Ye 0
   chala jaaye to row kisi challan se link nahi hoti aur backend usay reject/
   orphan kar deta hai. */
export function withLateFineRow(rows, fineAmount, { ledgerId, branchId, userId, now } = {}) {
  const fine = Math.round(Number(fineAmount) || 0);
  const list = Array.isArray(rows) ? rows : [];
  if (fine <= 0) return list;

  const stamp = now || new Date().toISOString();
  const idx = list.findIndex(isLateFineRow);
  /* blid caller se, warna kisi maujooda row se (sab ka blid ek hi challan hai). */
  const blid = Number(ledgerId) || Number(list.find(r => Number(r?.blid))?.blid) || 0;
  /* Branch bhi USI challan ka — pehle caller, phir uski apni detailRows, aur
     aakhir me logged-in branch. Multi-branch me sessionStorage par bharosa
     karna ghalat row bana sakta hai agar challan kisi aur branch ka ho. */
  const rowBranch = list.find(r => Number(r?.branchId ?? r?.branchID));
  const branch = Number(branchId)
    || Number(rowBranch?.branchId ?? rowBranch?.branchID)
    || Number(sessionStorage.getItem('branchID'))
    || 1;

  if (idx >= 0) {
    /* Maujooda fine row — challan aur received dono me abhi wali fine add karo. */
    const r = list[idx];
    const billed   = (Number(r.challanAmount) || 0) + fine;
    const received = (Number(r.receivedAmount) || 0) + fine;
    const next = [...list];
    next[idx] = {
      ...r,
      challanAmount: billed,
      receivedAmount: received,
      pendingorAdv: billed - (Number(r.discount) || 0) - received,
      modifiedAt: stamp,
      modifiedBy: userId,
    };
    return next;
  }

  /* id: 0 → backend ke liye "ye nayi row hai, INSERT karo" (challan generate
     karte waqt bhi rows isi tarah jaati hain). blid parent challan ki id. */
  return [...list, {
    id: 0,
    blid,
    branchId: branch,
    head: 'Account Payable',
    subHead: LATE_FINE_HEAD,
    challanAmount: fine,
    discount: 0,
    receivedAmount: fine,       // fine hamesha poori wasool hoti hai
    pendingorAdv: 0,
    createdAt: stamp,
    createdBy: userId,
    modifiedAt: stamp,
    modifiedBy: userId,
    isActive: true,
  }];
}

const dayMs = 24 * 60 * 60 * 1000;
const dayStart = (v) => {
  const s = String(v || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/* Due date ke baad kitne poore din guzre. Due se pehle/us din → 0. */
export function daysLate(dueDate, receivingDate) {
  const due = dayStart(dueDate);
  const rec = dayStart(receivingDate);
  if (due == null || rec == null) return 0;
  return Math.max(0, Math.floor((rec - due) / dayMs));
}

/* Is challan par is receiving date tak banti kul fine. */
export function computeFine({ dueDate, receivingDate, settings } = {}) {
  if (!settings?.fineEnabled) return 0;
  const amt = Number(settings.fineAmt) || 0;
  if (amt <= 0) return 0;
  const late = daysLate(dueDate, receivingDate);
  if (late <= 0) return 0;
  const total = settings.fineType === 'daily' ? amt * late : amt;
  return Math.max(0, Math.round(total));
}

/* Generate ke waqt select ki hui Issue/Due date ka session cache — key: studentID|month|year.
   Reload par backend record me date galat aaye to preview/download is se sahi date lete hain. */
export const challanDateCache = new Map();

function buildLedgerChallanPayload({ classMeta = {}, student = {}, heads = [], monthIdx = 0, options = {} }) {
  const now = new Date().toISOString();
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const userID = Number(sessionStorage.getItem('UserID')) || 1;
  const issueDate = toApiDate(options.issueDate);
  const dueDate = toApiDate(options.dueDate);
  const classDisc = options.discountMap?.[classMeta.key]?.[student.reg] || {};

  /* Backend in fields ko Int32 (nullable) me leta hai — decimal/NaN/Infinity bhejne par
     400 "could not be converted to System.Int32" aata hai. Is liye hamesha ek safe
     WHOLE number bhejo. */
  const int32 = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : 0;
  };

  const makeRow = (subHead, amount, discount = 0) => ({
    id: 0,
    blid: 0,
    branchId: branchID,
    head: 'Account Payable',
    subHead: String(subHead || ''),
    challanAmount: int32(amount),
    discount: int32(discount),
    receivedAmount: 0,
    pendingorAdv: 0,
    createdAt: now,
    createdBy: userID,
    modifiedAt: now,
    modifiedBy: userID,
    isActive: true,
  });

  const headName = (h) => h.name ?? h.headName ?? '';
  const headAmt  = (h) => Number(h.amt ?? h.amount) || 0;
  const rowsFromHeads = (list) => list.map(h => makeRow(headName(h), headAmt(h), classDisc[headName(h)]));

  /* Selected fee-head names from the "Select Fee Heads" picker (deduped, so one
     entry per common head name). Empty → use all of the student's heads. */
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const pickedNames = Array.isArray(options.selectedHeadNames) ? options.selectedHeadNames : [];
  const keepPicked  = (list) => (pickedNames.length
    ? list.filter(h => pickedNames.some(n => sameName(n, headName(h))))
    : list);

  /* Class mode: one row per selected class fee head.
     Family: build head-by-head from EACH child's OWN grade heads (student.heads),
     so a common head selected in bulk sends each student's own amount. Only heads
     with a real amount are used; if none resolve, fall back to a combined
     "Tuition Fee" row so a challan is never generated empty. */
  let detailRows;
  if (!options.familyMode) {
    detailRows = rowsFromHeads(heads);
  } else {
    const childHeads = Array.isArray(student.heads) ? student.heads : heads;
    const useHeads   = keepPicked(childHeads).filter(h => headAmt(h) > 0);
    detailRows = useHeads.length
      ? rowsFromHeads(useHeads)
      : [makeRow('Tuition Fee', student.fee, student.discount)];
  }
  /* Auto-add the student's transport fee (from Transport Setup / family figures)
     as its own challan head — subHead "Transport", head "Account Payable". */
  if (Number(student.transport) > 0) {
    detailRows.push(makeRow('Transport', student.transport));
  }

  return {
    ledger: {
      id: 0,
      dateofCreattion: issueDate,
      dueDate,
      studentID: Number(student.studentID) || 0,
      branchID,
      gradeID: Number(student.gradeID || classMeta._gradeId) || 0,
      sectionID: Number(student.sectionID || classMeta._sectionId) || 0,
      registrationNumber: String(student.reg || ''),
      tranType: '',
      paymentMethod: '',
      month: Number(monthIdx) + 1,
      year: Number(options.year) || new Date().getFullYear(),
      plApplicantID: '',
      plpsid: '',
      createdAt: now,
      createdBy: userID,
      modifiedAt: now,
      modifiedBy: userID,
      isActive: true,
      detailRows,
    },
  };
}

export async function generateChallan(classKey, reg, monthIdx, options = {}) {
  /* Both class-wise and family-tree challans post to the same BranchLedger
     create-challan endpoint. Family mode differs only in how detailRows are
     built (per-child fee/transport instead of shared class heads) — see
     buildLedgerChallanPayload. */
  const regs = Array.isArray(reg) ? reg : [reg];
  const students = Array.isArray(options.students) && options.students.length
    ? options.students
    : regs.map(r => ({ reg: r }));
  const heads = Array.isArray(options.heads) ? options.heads : [];

  const results = [];
  for (const student of students) {
    const payload = buildLedgerChallanPayload({
      classMeta: options.classMeta,
      student,
      heads,
      monthIdx,
      options,
    });
    /* Selected Issue/Due date ko cache karo — reload par backend record me kabhi-kabhi
       dateofCreattion galat (server today) aata hai; preview/download tab is cache se
       ASLI selected date dikhate hain. Key: studentID|month|year. */
    try {
      const p = payload.ledger || {};
      const val = {
        issueISO: String(p.dateofCreattion || '').slice(0, 10),
        dueISO:   String(p.dueDate || '').slice(0, 10),
      };
      const mo = Number(p.month) || 0, yr = Number(p.year) || 0;
      /* studentID + registrationNumber dono par store — reload record kis key se
         match ho ye guarantee ke liye. */
      if (Number(p.studentID)) challanDateCache.set(`id|${Number(p.studentID)}|${mo}|${yr}`, val);
      if (p.registrationNumber) challanDateCache.set(`reg|${String(p.registrationNumber)}|${mo}|${yr}`, val);
    } catch (e) { /* ignore */ }
    /* Debug: Issue Date backend tak sahi ja rahi hai ya nahi — console me dekho. */
    console.log('[create-challan] issue picked:', options.issueDate,
                '→ sent dateofCreattion:', payload.ledger.dateofCreattion,
                '| dueDate:', payload.ledger.dueDate);
    const res = await fetch(buildUrl('/api/BranchLedger/create-challan'), {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    console.log('[create-challan] response:', json);
    if (!res.ok || json?.success === false) {
      throw new Error(apiMessage(json) || `Could not generate challan for ${student.name || student.reg || 'student'}`);
    }
    results.push(json);
  }

  return { classKey, regs, monthIdx, results };
}
export async function deleteChallan(classKey, reg, monthIdx) {
  await delay();
  return { classKey, reg, monthIdx, deleted: true };
}
export async function deleteClassChallans(classKey, monthIdx) {
  await delay();
  return { classKey, monthIdx, cleared: true };
}

/* ═══════════════════════════════════════════════════════════════════
   BranchLedger challans — real API reads/deletes.
   month is 1-based (July = 7); callers pass monthIdx + 1.
   ═══════════════════════════════════════════════════════════════════ */

/* All students' challans for a branch/month/year (the challan-list source). */
export async function getMonthChallans(month, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const res = await fetch(
    buildUrl(`/api/BranchLedger/get-by-month?branchId=${branchID}&month=${month}&year=${year}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load challans');
  }
  return Array.isArray(json?.data) ? json.data : [];
}

/* One student's challans for a branch/month/year. */
export async function getStudentChallans(studentId, month, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const res = await fetch(
    buildUrl(`/api/BranchLedger/get-all?branchId=${branchID}&studentId=${studentId}&month=${month}&year=${year}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load student challans');
  }
  return Array.isArray(json?.data) ? json.data : [];
}

/* Every challan in a month range, whole branch, one call.
   GET /api/BranchLedger/get-by-month-range — months are 1-based. */
export async function getLedgerRange(fromMonth, fromYear, toMonth, toYear) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const res = await fetch(
    buildUrl(`/api/BranchLedger/get-by-month-range?branchId=${branchID}&fromMonth=${fromMonth}&fromYear=${fromYear}&toMonth=${toMonth}&toYear=${toYear}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load ledger history');
  }
  return Array.isArray(json?.data) ? json.data : [];
}

/* The ledger stamps createdBy/modifiedBy with the LOGIN user id, which is not
   an employee id — nothing in get-employees-by-branch joins to it, so the name
   has to come from /api/HR/get-employee-by-loginuser/{loginUserId}.

   The in-flight promise is cached (misses included, as null) so a month range
   full of the same cashier costs exactly one request per distinct user. */
const loginUserNameCache = new Map();
export async function getEmployeeNameByLoginUser(loginUserId) {
  const id = Number(loginUserId) || 0;
  if (!id) return null;
  if (loginUserNameCache.has(id)) return loginUserNameCache.get(id);

  const token = sessionStorage.getItem('token');
  const p = (async () => {
    try {
      const res = await fetch(buildUrl(`/api/HR/get-employee-by-loginuser/${id}`), {
        headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false || !json?.data) return null;
      const e = json.data;
      return [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || null;
    } catch (err) {
      return null;
    }
  })();

  loginUserNameCache.set(id, p);
  return p;
}

/* Record a payment against a challan. body:
   { ledgerId (challan id), paymentMethod, modifiedBy, detailRows:[...] }.
   The caller fills each detailRow's receivedAmount / pendingorAdv. */
export async function receivePayment(body) {
  const res = await fetch(buildUrl('/api/BranchLedger/receive-payment'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not record payment');
  }
  return json;
}

/* Reverse the receiving recorded against a challan — the challan itself stays,
   its heads go back to unpaid. DELETE /api/BranchLedger/delete-receiving/{ledgerId}
   This is the Receiving tab's delete; deleteChallanById (below) is the Challans
   tab's, and destroys the challan itself. */
export async function deleteReceiving(ledgerId) {
  const userID = Number(sessionStorage.getItem('UserID')) || 0;
  const res = await fetch(
    buildUrl(`/api/BranchLedger/delete-receiving/${ledgerId}?modifiedBy=${userID}`),
    { method: 'DELETE', headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not delete the receiving');
  }
  return json;
}

/* Delete a single challan record by its BranchLedger id. */
export async function deleteChallanById(id) {
  const res = await fetch(buildUrl(`/api/BranchLedger/delete/${id}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not delete challan');
  }
  return json;
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

/* Remove a child from a family (Family Tree Challans → "Remove child from family").
   Real API: POST /api/FamilyTree/familytreedetailcrud with action:'delete'.
   `id` = the family-tree DETAIL record id (child link) to delete. */
export async function deleteFamilyTreeDetail({ id, treeID = 0, applicantsID = 0, gradeID = 0, sectionID = 0 } = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const body = {
    action:       'delete',
    id:           Number(id) || 0,
    treeID:       Number(treeID) || 0,
    branchID,
    applicantsID: Number(applicantsID) || 0,
    gradeID:      Number(gradeID) || 0,
    sectionID:    Number(sectionID) || 0,
    createdBy:    userID,
  };
  const res  = await fetch(buildUrl('/api/FamilyTree/familytreedetailcrud'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not remove child from family');
  }
  return json;
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
