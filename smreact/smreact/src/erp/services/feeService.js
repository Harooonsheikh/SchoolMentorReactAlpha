import {
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

function mapFeeSettingsToApi(settings = {}) {
  const now = new Date().toISOString();
  const id = Number(settings.id) || 0;
  const userID = feeSettingsUserID();

  return {
    id,
    branchID:          Number(settings.branchID ?? feeSettingsBranchID()) || 0,
    showDiscount:      settings.showDiscount !== false,
    showPSDCode:       settings.showPsd !== false,
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
  return mapFeeSettingsFromApi(rows[0] || { id: 0, branchID });
}

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
const toApiDate = (value) => {
  if (!value) return new Date().toISOString();
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

function buildLedgerChallanPayload({ classMeta = {}, student = {}, heads = [], monthIdx = 0, options = {} }) {
  const now = new Date().toISOString();
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const userID = Number(sessionStorage.getItem('UserID')) || 1;
  const issueDate = toApiDate(options.issueDate);
  const dueDate = toApiDate(options.dueDate);
  const classDisc = options.discountMap?.[classMeta.key]?.[student.reg] || {};

  const makeRow = (subHead, amount, discount = 0) => ({
    id: 0,
    blid: 0,
    branchId: branchID,
    head: 'Account Payable',
    subHead: String(subHead || ''),
    challanAmount: Number(amount) || 0,
    discount: Number(discount) || 0,
    receivedAmount: 0,
    pendingorAdv: 0,
    createdAt: now,
    createdBy: userID,
    modifiedAt: now,
    modifiedBy: userID,
    isActive: true,
  });

  const detailRows = heads.map(h =>
    makeRow(h.name || h.headName, h.amt ?? h.amount, classDisc[h.name])
  );
  /* Auto-add the student's transport fee (from Transport Setup) as its own
     challan head — subHead "Transport", head "Account Payable". */
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
  if (options.familyMode) {
    await delay();
    return clone({ classKey, reg, monthIdx, ...options });
  }

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
    const res = await fetch(buildUrl('/api/BranchLedger/create-challan'), {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
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
