import { delay, clone } from './_http';
import { buildUrl, apiMessage, resolveMediaUrl } from '../../utils/apiConfig';

const pick = (obj, ...keys) => keys.map(k => obj?.[k]).find(v => v !== undefined && v !== null && v !== '');

/* ── 1Link PSID ──────────────────────────────────────────────────────
   PSID har challan ka apna hota hai — backend `create-challan` par usay
   generate/store karta hai aur get-by-month / get-all me wapas bhejta hai.
   Casing backend ke hisaab se badalti rehti hai (plpsid / plPsid / PLPSID),
   is liye padhte waqt saari shaklein dekho.

   Sirf digits rakhe jaate hain: banking app me PSID digits hi enter hota
   hai, aur QR/barcode bhi isi plain form par bante hain. */
export function psidOf(rec) {
  const raw = pick(rec || {}, 'plpsid', 'plPsid', 'plPSID', 'PLPSID', 'psid', 'PSID');
  const digits = String(raw ?? '').replace(/\D/g, '');
  /* Sirf-sifr value (backend kabhi 0 bhejta hai jab PSID set hi nahi hua)
     asli PSID nahi hai — usay khaali samjho, warna challan par "0" chhap
     jata aur uska QR/barcode bhi ban jata. */
  if (!digits || !/[1-9]/.test(digits)) return '';
  return digits;
}

/* Challan par PSID plain digits me chhapta hai — koi dash/space nahi.

   Pehle yahan 4-4 ke groups (3-0003-2607-1662-4083) bante the, magar banking
   app me PSID bilkul waise hi enter hota hai jaise hai; dashes dekh kar log
   unhe bhi type kar dete the ya digits count karne me ghalti karte the. */
export function formatPsid(psid) {
  return String(psid || '').replace(/\D/g, '');
}

export async function getReportHeader() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const res = await fetch(buildUrl(`/report-header/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load report header');
  }
  const data = json?.data || null;
  // Serve the branch logo from the https media host so it loads on the fee
  // challans / receipts / share regardless of the host the API stamped on it.
  if (data && data.branchLogo) data.branchLogo = resolveMediaUrl(data.branchLogo);
  return data;
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
export async function saveFeeDiscount({ id = 0, gradeID = 0, sectionID = 0, headID = 0, headName = '', discountAmount = 0, studentID = 0, studentName = '', isActive = true } = {}) {
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
    /* isActive:false → discount clear/deactivate (get isActive!==false ko filter kar
       deta hai). Backend 0 amount reject karta hai, is liye clear karte waqt caller
       asal (>0) amount ke saath isActive:false bhejta hai. */
    isActive:       isActive !== false,
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
    route:        row.route ?? '',
    vehicleID:    Number(row.vehicleID ?? row.vehicleId ?? 0) || 0,
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
    route:        payload.route ?? '',
    vehicleID:    Number(payload.vehicleId ?? payload.vehicleID ?? 0) || 0,
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
        route: setup.route || '',
        vehicleId: setup.vehicleID ? String(setup.vehicleID) : '',
        transportSetup: setup,
      };
    }),
  ]));
}

// ── Transport vehicles (fleet) ──────────────────────────────────────
// Ek hi endpoint sab kaam karta hai — action se:
//   POST /api/TransportFeeSetup/manage_vehicle
//   { action: 'insert'|'update'|'delete'|'get', id, branchID,
//     vehicleName, vehicleNumber, assignRoute, createdBy, modifiedBy }
//   • insert → id 0. update/delete → id bhejo. get → branchID ke saare vehicle.
// UI ka vehicle shape { id, name, regNo, route } — mapping neeche.
function mapVehicleFromApi(row = {}) {
  return {
    id:    Number(row.id ?? row.ID ?? row.vehicleID ?? row.vehicleId ?? 0) || 0,
    name:  row.vehicleName ?? row.VehicleName ?? row.name ?? '',
    regNo: row.vehicleNumber ?? row.VehicleNumber ?? row.regNo ?? '',
    route: row.assignRoute ?? row.AssignRoute ?? row.route ?? '',
  };
}

async function manageVehicle(payload) {
  const res = await fetch(buildUrl('/api/TransportFeeSetup/manage_vehicle'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Vehicle request failed');
  }
  return json;
}

export async function getVehicles() {
  const json = await manageVehicle({
    action: 'get', id: 0, branchID: transportFeeBranchID(),
    vehicleName: '', vehicleNumber: '', assignRoute: '', createdBy: 0, modifiedBy: 0,
  });
  const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  /* id ke hisaab se ASCENDING — nayi entry (sabse bari id) hamesha LIST ke AAKHIR me
     aaye, warna API newest-first deta hai to naya vehicle upar chala jaata tha. */
  return rows
    .map(mapVehicleFromApi)
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
}

export async function saveVehicle(vehicle) {
  const userID = transportFeeUserID();
  const numId  = Number(vehicle.id) || 0;              // temp `veh-…` id → 0 (insert)
  const isNew  = !numId;
  const json = await manageVehicle({
    action: isNew ? 'insert' : 'update',
    id: numId,
    branchID: transportFeeBranchID(),
    vehicleName: vehicle.name || '',
    vehicleNumber: vehicle.regNo || '',
    assignRoute: vehicle.route || '',
    createdBy: userID,
    modifiedBy: userID,
  });
  return json?.data ? mapVehicleFromApi(json.data) : { ...vehicle, id: numId };
}

export async function deleteVehicle(id) {
  await manageVehicle({
    action: 'delete', id: Number(id) || 0, branchID: transportFeeBranchID(),
    vehicleName: '', vehicleNumber: '', assignRoute: '', createdBy: 0, modifiedBy: transportFeeUserID(),
  });
  return { id, deleted: true };
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

/* ── Fee settings ke default ──────────────────────────────────────────
   Ye data nahi, SETTINGS ka dhancha hai: kaunse toggle mojood hain aur
   kis shakl ke hain. Asli qadrein API se aati hain; koi field na aaye to
   yahan se bhar jati hai.

   Har toggle OFF se shuru hota hai. Pehle ye mock/fee.js me sab ON thay,
   is liye jis branch ka record abhi bana hi nahi tha uski screen features
   ko "on" dikha deti thi jo server ne kabhi suna hi nahi. */
const FEE_SETTINGS_DEFAULTS = {
  showDiscount:     false,
  showPsd:          false,
  showBankDetails:  false,
  prevMonthChallan: false,
  nextMonthChallan: false,
  fineEnabled:      false,
  fineType:         'fixed',
  fineAmt:          0,
  printSize:        'a4',
};

const uiPrintSizeToApi = (size) => (
  size === 'thermal' ? 'Thermal' : 'A4'
);

function mapFeeSettingsFromApi(row = {}) {
  return {
    ...clone(FEE_SETTINGS_DEFAULTS),
    id:                 Number(row.id ?? row.ID ?? 0) || 0,
    branchID:           Number(row.branchID ?? row.branchId ?? feeSettingsBranchID()) || 0,
    showDiscount:       row.showDiscount ?? FEE_SETTINGS_DEFAULTS.showDiscount,
    showPsd:            row.showPSDCode ?? row.showPsd ?? FEE_SETTINGS_DEFAULTS.showPsd,
    /* Show Bank Details On challan — backend get-all me ye field "bankDetails" ke
       naam se aata hai (bool). Sirf ASLI boolean ko authority maano; abhi tak wo
       null aata hai (backend ne save wire nahi kiya) is liye us soorat me niche
       localStorage fallback lagta hai. */
    showBankDetails:    (typeof row.bankDetails === 'boolean' ? row.bankDetails
                         : typeof row.showBankDetails === 'boolean' ? row.showBankDetails
                         : typeof row.showBankDetailsOnChallan === 'boolean' ? row.showBankDetailsOnChallan
                         : typeof row.showBankDetail === 'boolean' ? row.showBankDetail
                         : FEE_SETTINGS_DEFAULTS.showBankDetails),
    prevMonthChallan:   row.previousMonthFeeChallan ?? row.prevMonthChallan ?? FEE_SETTINGS_DEFAULTS.prevMonthChallan,
    nextMonthChallan:   row.nextMonthFeeChallan ?? row.nextMonthChallan ?? FEE_SETTINGS_DEFAULTS.nextMonthChallan,
    fineEnabled:        row.fineStatusEnabled ?? row.fineEnabled ?? FEE_SETTINGS_DEFAULTS.fineEnabled,
    fineType:           apiFineToUi(row.fineType ?? FEE_SETTINGS_DEFAULTS.fineType),
    fineAmt:            Number(row.fineAmountRs ?? row.fineAmt ?? FEE_SETTINGS_DEFAULTS.fineAmt) || 0,
    printSize:          apiPrintSizeToUi(row.defaultPrintSize ?? row.printSize ?? FEE_SETTINGS_DEFAULTS.printSize),
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
    ...clone(FEE_SETTINGS_DEFAULTS),
    id:               0,
    branchID:         feeSettingsBranchID(),
    showDiscount:     false,
    showPsd:          false,
    showBankDetails:  false,
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
    /* Bank details toggle — backend field ka naam "bankDetails" hai (get-all me
       wahi aata hai), is liye usi naam se bhejte hain. Purana naam bhi saath rakha
       (harmless) taake dono soorton me chale. Default OFF → explicit true par hi. */
    bankDetails:       settings.showBankDetails === true,
    showBankDetails:   settings.showBankDetails === true,
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

/* "Show Bank Details On challan" toggle — backend FeeChallanSettings me abhi ye
   field nahi hai. Jab tak backend add na kare, iska value localStorage me rakhte
   hain (per-branch) taake toggle persist ho aur challan tak pahunche. Backend jab
   ye field bhejne lage to WAHI authority hoga (LS overlay skip ho jaata hai). */
function bankDetailsLsKey() { return `fee.showBankDetails.${feeSettingsBranchID()}`; }
function readBankDetailsLs() {
  try { const v = localStorage.getItem(bankDetailsLsKey()); return v == null ? null : (v === '1' || v === 'true'); }
  catch { return null; }
}
function writeBankDetailsLs(on) {
  try { localStorage.setItem(bankDetailsLsKey(), on ? '1' : '0'); } catch { /* ignore */ }
}
function apiRowHasBankField(row) {
  if (!row) return false;
  /* Sirf ASLI boolean ko backend-authority maano — `bankDetails: null` (jab tak
     backend save wire nahi karta) ko nahi, warna localStorage fallback nazar-andaaz
     ho kar toggle hamesha OFF padh jaata. */
  return [row.bankDetails, row.showBankDetails, row.showBankDetailsOnChallan, row.showBankDetail]
    .some(v => typeof v === 'boolean');
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
  const settings = rows.length ? mapFeeSettingsFromApi(rows[0]) : blankFeeSettings();
  /* Bank-details toggle: backend field na ho to localStorage se overlay. */
  if (!rows.length || !apiRowHasBankField(rows[0])) {
    const ls = readBankDetailsLs();
    if (ls != null) settings.showBankDetails = ls;
  }
  return settings;
}

/* Kaunse challan ban chuke hain — ye khali Set se shuru hota hai aur screen
   apne live data se bharti hai. Pehle yahan mock ka seed tha, is liye kuch
   classon par "challan generated" ka nishan lagta tha jab ke bana hi nahi
   hota tha. */
export async function getGeneratedChallans() {
  return new Set();
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
/* Wahi baat family challans ke liye. */
export async function getGeneratedFamilyChallans() {
  return new Set();
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
  return {
    classKey, reg, ...saved,
    route: saved.route || payload.route || '',
    vehicleId: saved.vehicleID ? String(saved.vehicleID) : (payload.vehicleId || ''),
  };
}
export async function saveFeeSettings(payload) {
  /* Bank-details toggle localStorage me bhi save — backend field aane tak persist rahe. */
  writeBankDetailsLs(payload?.showBankDetails === true);
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
export function withLateFineRow(rows, fineAmount, { ledgerId, branchId, userId, now, billedAmount } = {}) {
  const fine = Math.round(Number(fineAmount) || 0);
  /* BILLED aur RECEIVED alag alag hain: cashier poori fine bill hone ke bawajood
     us me se kuch hi (ya bilkul nahi) le sakta hai. `fineAmount` = ab li gayi
     raqam; `billedAmount` = kul waajib fine. billedAmount na aaye to purana
     behaviour (jitni li, utni hi billed). */
  const billed = Math.max(0, Math.round(Number(billedAmount ?? fine) || 0));
  const list = Array.isArray(rows) ? rows : [];
  /* Fine bill honi chahiye chahe ab wasool na ho — warna baqaya fine ledger me
     kahin darj hi nahi hoti aur agli baar gayab mil jaati hai. */
  if (fine <= 0 && billed <= 0) return list;

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
    /* Maujooda fine row — abhi wasool ki gayi fine add karo.

       AHEM: `fine` yahan hamesha fineOWED aata hai (= fineDue − finePaid), yani
       sirf wo hissa jo IS receiving me liya gaya. Jo pehle wasool ho chuki wo
       row me already mojood hai. Is liye billed ko bhi bara-bar barhana ghalat
       hai jab row ka challanAmount pehle se poori fine rakhta ho — warna
       "Receive More" par fine dobara bill ho jaati thi (700 → 1400).
       challanAmount ko max() par rakho: fine kabhi neeche nahi jaati, magar
       already-billed hissa dobara nahi jurta. */
    const r = list[idx];
    /* `fine` MINUS bhi ho sakta hai (cashier fine kam kar raha = correction). Received
       0 se neeche na jaye. */
    const received = Math.max(0, (Number(r.receivedAmount) || 0) + fine);
    /* Billed kabhi neeche nahi jaati, aur wasooli se kam bhi nahi ho sakti. */
    const rowBilled = Math.max(Number(r.challanAmount) || 0, billed, received);
    const next = [...list];
    next[idx] = {
      ...r,
      challanAmount: rowBilled,
      receivedAmount: received,
      pendingorAdv: rowBilled - (Number(r.discount) || 0) - received,
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
    challanAmount: Math.max(billed, fine, 0),
    discount: 0,
    receivedAmount: Math.max(0, fine),       // sirf jitni AB wasool hui (0 se neeche nahi)
    pendingorAdv: Math.max(billed, fine, 0) - Math.max(0, fine),
    createdAt: stamp,
    createdBy: userId,
    modifiedAt: stamp,
    modifiedBy: userId,
    isActive: true,
  }];
}

/* Receiving ke waqt laga pichhla ADVANCE credit ko ledger me PERSIST karta hai: ek
   NEGATIVE "Previous Pending" row jiska received bhi minus (= consume hua advance) hota
   hai (net 0). Is ke baghair advance sirf cash kam karta magar ledger me consume na hota
   → fee head poora received ho kar remaining minus (over-payment) reh jaata.

   `advApplied` = IS receiving me laga advance (cumulative, pehle se consume shuda ke
   ILAWA). Maujooda negative row ho to usme add hota hai (double-count nahi), warna nayi
   row banti hai. */
export function withAdvanceRow(rows, advApplied, advName, { ledgerId, branchId, userId, now } = {}) {
  const applied = Math.round(Number(advApplied) || 0);
  const list = Array.isArray(rows) ? rows : [];
  if (applied <= 0) return list;
  const isAdvRow = (r) =>
    /previous|pending|arrear/i.test(String(r?.subHead || r?.head || '')) && (Number(r?.challanAmount) || 0) < 0;
  const stamp = now || new Date().toISOString();
  const idx = list.findIndex(isAdvRow);
  if (idx >= 0) {
    const r = list[idx];
    const consumed = Math.abs(Number(r.receivedAmount) || 0) + applied;   // cumulative
    const next = [...list];
    next[idx] = {
      ...r,
      challanAmount: -consumed,
      receivedAmount: -consumed,
      pendingorAdv: 0,
      modifiedAt: stamp,
      modifiedBy: userId,
    };
    return next;
  }
  const blid = Number(ledgerId) || Number(list.find(x => Number(x?.blid))?.blid) || 0;
  const rowBranch = list.find(x => Number(x?.branchId ?? x?.branchID));
  const branch = Number(branchId)
    || Number(rowBranch?.branchId ?? rowBranch?.branchID)
    || Number(sessionStorage.getItem('branchID')) || 1;
  return [...list, {
    id: 0,
    blid,
    branchId: branch,
    head: 'Account Payable',
    subHead: advName || 'Previous Pending',
    challanAmount: -applied,
    discount: 0,
    receivedAmount: -applied,   // consume hua advance (MINUS)
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
      /* PSID backend generate karta hai (1Link ke consumer number rules ke
         mutabiq) — frontend khaali bhejta hai aur response/get-by-month se
         asli value wapas padhta hai. Dekho: psidOf(). */
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
   { ledgerId (challan id), paymentMethod, receivedDate, modifiedBy, detailRows:[...] }.
   The caller fills each detailRow's receivedAmount / pendingorAdv.

   receivedDate = cashier ki modal me chuni hui receiving date (YYYY-MM-DD).
   Ye modifiedAt (server ka "abhi") se ALAG hai: back-dated receiving par dono
   farq karte hain, aur reports/slip me receiving date wahi dikhni chahiye jo
   cashier ne chuni. Ledger ise wapas receivedDate par bhejta hai — reports
   usay padhti hain, modifiedAt sirf fallback hai. */
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
export async function saveFamilyReceipt(payload) {
  await delay();
  return clone({ id: `frcv-${Date.now()}`, ...payload });
}

/* ─── Receipts ───────────────────────────────────────────────────────
   Pehle ye mock/fee.js ki bani banai rasidein lautate thay, jo Fee ki teen
   screenon par aur Admin Dashboard par asli rasidon jaisi nazar aati thin.

   Asli rasidein screen apne live calls se lati hai (receivePayment /
   getLedgerRange / getStudentChallans). Ye do sirf ibtidai list dete hain,
   is liye ab khali. */

export async function getReceipts() { return []; }
export async function getFamilyReceipts() { return []; }
