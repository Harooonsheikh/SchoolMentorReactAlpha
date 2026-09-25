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

/* ── Class/section/student roster cache ─────────────────────────────
   getFeeClasses() and getTransportFee() both call this, and Fee.jsx mounts
   6 different sub-views (Challan gen, Fee Challans list, Fee Receiving
   list, Reports, ...) that each call one of those on mount — without this
   cache that's up to 6 duplicate whole-branch roster fetches per page
   load. Cache the in-flight/settled promise per branch so concurrent and
   later callers share one request; invalidateFeeClasses() clears it if a
   caller ever needs a hard refresh. */
let classStudentsCache = null; // { branchID, promise }
export function invalidateFeeClasses() {
  classStudentsCache = null;
}

/* Transport setup uses the same LaunchSetup class/section/student roster. */
function fetchFeeClassStudents() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  if (classStudentsCache && classStudentsCache.branchID === branchID) {
    return classStudentsCache.promise;
  }
  const promise = fetchFeeClassStudentsUncached(branchID);
  classStudentsCache = { branchID, promise };
  promise.catch(() => {
    if (classStudentsCache && classStudentsCache.promise === promise) classStudentsCache = null;
  });
  return promise;
}

async function fetchFeeClassStudentsUncached(branchID) {
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
          /* Student module jaisa contact — Defaulter report / reminders isi se. */
          phone: String(
            pick(st, 'mobileNo', 'mobile', 'phone', 'contactNumber', 'contactNo', 'guardianContact', 'fatherMobile', 'parentMobile') || ''
          ).trim(),
          mobile: String(
            pick(st, 'mobileNo', 'mobile', 'phone', 'contactNumber', 'contactNo') || ''
          ).trim(),
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
  /* Fee Module feature controls. Default ON — ERP multiple receiving, over-payment
     →advance aur OneLink/PSID partial challan allow karta hai. Backend
     FeeChallanSettings ab ye fields bhejta/save karta hai (`psidInstallmentPayments`
     API naam). localStorage sirf tab fallback jab API boolean na de. */
  multipleReceiving:       true,
  advancePaymentReceiving: true,
  psidInstallments:        true,
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
    /* Feature controls — API booleans authority. UI key `psidInstallments`
       ↔ API field `psidInstallmentPayments` (Swagger). */
    multipleReceiving:       (typeof row.multipleReceiving === 'boolean' ? row.multipleReceiving : FEE_SETTINGS_DEFAULTS.multipleReceiving),
    advancePaymentReceiving: (typeof row.advancePaymentReceiving === 'boolean' ? row.advancePaymentReceiving : FEE_SETTINGS_DEFAULTS.advancePaymentReceiving),
    psidInstallments:        (typeof row.psidInstallmentPayments === 'boolean' ? row.psidInstallmentPayments
                              : typeof row.psidInstallments === 'boolean' ? row.psidInstallments
                              : FEE_SETTINGS_DEFAULTS.psidInstallments),
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
    /* Feature controls — API field names (Swagger FeeChallanSettings/save).
       UI key psidInstallments → API psidInstallmentPayments. */
    multipleReceiving:         settings.multipleReceiving !== false,
    advancePaymentReceiving:   settings.advancePaymentReceiving !== false,
    psidInstallmentPayments:   settings.psidInstallments !== false,
    psidInstallments:          settings.psidInstallments !== false, /* alias, harmless */
    createdDate:       settings.createdDate || now,
    modifiedDate:      now,
    createdBy:         Number(settings.createdBy) || userID,
    modifiedBy:        userID,
    isActive:          settings.isActive !== false,
  };
}

/* "Show Bank Details On challan" — API field `bankDetails`. localStorage
   fallback jab get-all me asli boolean na ho. */
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

/* Fee Module feature controls — API ab columns bhejta hai. localStorage
   fallback jab get-all me boolean na ho (purana record / pehli load). */
const FEATURE_TOGGLE_KEYS = ['multipleReceiving', 'advancePaymentReceiving', 'psidInstallments'];
/* UI key → API field name(s) — pehla match jo boolean ho, authority. */
const FEATURE_TOGGLE_API_FIELDS = {
  multipleReceiving:       ['multipleReceiving'],
  advancePaymentReceiving: ['advancePaymentReceiving'],
  psidInstallments:        ['psidInstallmentPayments', 'psidInstallments'],
};
function featureTogglesLsKey() { return `fee.featureToggles.${feeSettingsBranchID()}`; }
function readFeatureTogglesLs() {
  try {
    const raw = localStorage.getItem(featureTogglesLsKey());
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : null;
  } catch { return null; }
}
function writeFeatureTogglesLs(settings) {
  try {
    const out = {};
    FEATURE_TOGGLE_KEYS.forEach(k => { out[k] = settings?.[k] !== false; });
    localStorage.setItem(featureTogglesLsKey(), JSON.stringify(out));
  } catch { /* ignore */ }
}
function apiRowHasFeatureToggle(row, uiKey) {
  if (!row) return false;
  const fields = FEATURE_TOGGLE_API_FIELDS[uiKey] || [uiKey];
  return fields.some(f => typeof row[f] === 'boolean');
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
  /* Feature controls: har toggle par backend boolean na ho to localStorage overlay.
     Default ON hai, is liye LS na ho to settings apne default (true) par rehte hain. */
  const ft = readFeatureTogglesLs();
  FEATURE_TOGGLE_KEYS.forEach(k => {
    if (rows.length && apiRowHasFeatureToggle(rows[0], k)) return; // backend authority
    if (ft && typeof ft[k] === 'boolean') settings[k] = ft[k];
  });
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
  /* Feature controls (Multiple Receiving / Advance Payment Receiving / PSID) bhi
     localStorage me persist — backend in fields ko store karne lage tak yahi authority. */
  writeFeatureTogglesLs(payload);
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
    /previous|pending|arrear|old\s*advance|advance\s*till/i.test(String(r?.subHead || r?.head || ''))
    && (Number(r?.challanAmount) || 0) < 0;
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

/* Jab kisi head par receiving hui magar wo head challan ke detailRows me MAUJOOD NAHI
   (e.g. Transport jo Transport Setup fallback se receiving modal me aata hai) — us ki
   wasooli kahin persist nahi hoti thi (baseRows sirf maujooda rows map karta hai), is
   liye transaction details me us head ka Received 0 reh jaata. Yahan aisi har missing
   head ke liye ek NAYI detailRow (id:0 → backend INSERT) banate hain taake receiving
   ledger me record ho jaye. `newHeads` = [{ name, std, disc, recv }]. */
export function withNewHeadRows(rows, newHeads, { ledgerId, branchId, userId, now } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const adds = (Array.isArray(newHeads) ? newHeads : []).filter(h => h && Math.round(Number(h.recv) || 0) > 0);
  if (!adds.length) return list;
  const stamp = now || new Date().toISOString();
  const blid = Number(ledgerId) || Number(list.find(x => Number(x?.blid))?.blid) || 0;
  const rowBranch = list.find(x => Number(x?.branchId ?? x?.branchID));
  const branch = Number(branchId)
    || Number(rowBranch?.branchId ?? rowBranch?.branchID)
    || Number(sessionStorage.getItem('branchID')) || 1;
  const norm = (s) => String(s || '').toLowerCase().trim();
  const out = [...list];
  adds.forEach(h => {
    const name = String(h.name || '').trim();
    if (!name) return;
    /* Agar is naam ki row is dauran ban chuki (ya pehle se thi) to dobara na banao —
       uske badle usi row me received add kar do. */
    const idx = out.findIndex(r => norm(r.subHead || r.head) === norm(name));
    const std  = Math.max(0, Math.round(Number(h.std) || 0));
    const disc = Math.max(0, Math.round(Number(h.disc) || 0));
    const recv = Math.round(Number(h.recv) || 0);
    if (idx >= 0) {
      const r = out[idx];
      const received = Math.max(0, (Number(r.receivedAmount) || 0) + recv);
      out[idx] = { ...r, receivedAmount: received, pendingorAdv: (Number(r.challanAmount) || 0) - (Number(r.discount) || 0) - received, modifiedAt: stamp, modifiedBy: userId };
      return;
    }
    const received = Math.max(0, recv);
    out.push({
      id: 0,
      blid,
      branchId: branch,
      /* Fee head ka `head` hamesha "Account Payable" hota hai (challan generation jaisa),
         subHead me asal head ka naam (e.g. Transport). */
      head: 'Account Payable',
      subHead: name,
      challanAmount: std,
      discount: disc,
      receivedAmount: received,
      pendingorAdv: (std - disc) - received,
      createdAt: stamp,
      createdBy: userId,
      modifiedAt: stamp,
      modifiedBy: userId,
      isActive: true,
    });
  });
  return out;
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
  /* Two Months+: Due Date UI hide — payload me mat bhejo (server null/default). */
  const dueDate = String(options.type) === '2' || !options.dueDate
    ? null
    : toApiDate(options.dueDate);
  const classDisc = options.discountMap?.[classMeta.key]?.[student.reg] || {};

  /* Backend in fields ko Int32 (nullable) me leta hai — decimal/NaN/Infinity bhejne par
     400 "could not be converted to System.Int32" aata hai. Is liye hamesha ek safe
     WHOLE number bhejo. */
  const int32 = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : 0;
  };

  /* Challan Type — "One Month" (default) ya "Two Months". Installment API
     per-month amounts leta hai aur multi-month range par SERVER multiply
     karta hai — frontend ×2 NAHI karta (warna double-double ho jaata). */
  const isTwoMonths = String(options.type) === '2';

  const makeRow = (subHead, amount, discount = 0) => ({
    id: 0,
    blid: 0,
    branchId: branchID,
    head: 'Account Payable',
    subHead: String(subHead || ''),
    challanAmount: int32(amount),
    discount: int32(discount),
    /* Installment create sirf head/subHead/challanAmount/discount use karta hai.
       pendingorAdv kabhi bhejo mat — server khud calculate karta hai. */
    receivedAmount: 0,
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

  const year = Number(options.year) || new Date().getFullYear();
  const startMonth = Number(monthIdx) + 1;
  const ledger = {
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
    plApplicantID: '',
    /* PSID backend generate karta hai (1Link ke consumer number rules ke
       mutabiq) — frontend khaali bhejta hai aur get-with-installments se
       asli value wapas padhta hai. Dekho: psidOf(). */
    plpsid: '',
    createdAt: now,
    createdBy: userID,
    modifiedAt: now,
    modifiedBy: userID,
    isActive: true,
    detailRows,
  };

  if (isTwoMonths) {
    /* Multi-month: month/year ki jagah start/end range. Server har head
       ko range ke months se multiply karta hai. */
    let endMonth = startMonth + 1;
    let endYear = year;
    if (endMonth > 12) { endMonth = 1; endYear += 1; }
    ledger.startMonth = startMonth;
    ledger.startYear = year;
    ledger.endMonth = endMonth;
    ledger.endYear = endYear;
    ledger.totalMonthChallan = 2;
  } else {
    ledger.month = startMonth;
    ledger.year = year;
  }

  return { ledger };
}

export async function generateChallan(classKey, reg, monthIdx, options = {}) {
  /* Class-wise + family-tree dono installment create endpoint par jaate hain.
     Family mode sirf detailRows build me farq (per-child heads) — dekho
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
      const mo = Number(p.month || p.startMonth) || 0;
      const yr = Number(p.year || p.startYear) || 0;
      if (Number(p.studentID)) challanDateCache.set(`id|${Number(p.studentID)}|${mo}|${yr}`, val);
      if (p.registrationNumber) challanDateCache.set(`reg|${String(p.registrationNumber)}|${mo}|${yr}`, val);
    } catch (e) { /* ignore */ }
    console.log('[create-challan-installment] issue picked:', options.issueDate,
                '→ sent dateofCreattion:', payload.ledger.dateofCreattion,
                '| dueDate:', payload.ledger.dueDate,
                '| range:', payload.ledger.startMonth
                  ? `${payload.ledger.startMonth}/${payload.ledger.startYear}-${payload.ledger.endMonth}/${payload.ledger.endYear}`
                  : `${payload.ledger.month}/${payload.ledger.year}`);
    const res = await fetch(buildUrl('/api/BranchLedger/create-challan-installment'), {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    console.log('[create-challan-installment] response:', json);
    /* 409 = challan already generated — README §3.2: count, don't fail the batch. */
    if (res.status === 409) {
      results.push({
        alreadyGenerated: true,
        success: false,
        message: apiMessage(json) || 'Challan already generated',
        student: student.name || student.reg || '',
      });
      continue;
    }
    if (!res.ok || json?.success === false) {
      results.push({
        failed: true,
        success: false,
        message: apiMessage(json) || `Could not generate challan for ${student.name || student.reg || 'student'}`,
        student: student.name || student.reg || '',
      });
      continue;
    }
    results.push({ ...json, created: true });
  }

  invalidateMonthChallans();
  const created = results.filter(r => r.created).length;
  const alreadyGenerated = results.filter(r => r.alreadyGenerated).length;
  const failed = results.filter(r => r.failed);
  return { classKey, regs, monthIdx, results, created, alreadyGenerated, failed };
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

/* ── Month-challans cache ────────────────────────────────────────────
   Same duplicate-fetch problem as the roster above: the Challans list and
   Receiving list both call getMonthChallans() for the currently open
   month, and switching between class tabs re-renders both without a new
   month, so without a cache they'd re-hit the branch-wide endpoint every
   time. Cached per branch/month/year; any write that can change a
   challan (generate/receive/delete) invalidates it via
   invalidateMonthChallans() so the next read is always fresh. */
const monthChallansCache = new Map(); // `${branchID}|${month}|${year}` -> promise
export function invalidateMonthChallans(month, year) {
  // A write can also change the "previous dues" range totals (ledgerRangeCache
  // below), so both caches are cleared together — same invalidation trigger.
  // ledgerRangeCache is declared further down this file; by the time this
  // function actually runs (a mutation completing) the module has finished
  // initializing, so the reference is always live.
  if (month == null || year == null) {
    monthChallansCache.clear();
  } else {
    const branchID = Number(sessionStorage.getItem('branchID')) || 1;
    monthChallansCache.delete(`${branchID}|${month}|${year}`);
  }
  ledgerRangeCache.clear();
}

/* All students' challans for a branch/month/year (the challan-list source).
   Installment API: get-with-installments — har head ke andar installments[]
   aati hai taake Receiving modal history refresh par bhi dikhe. */
export async function getMonthChallans(month, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const key = `${branchID}|${month}|${year}`;
  if (monthChallansCache.has(key)) return monthChallansCache.get(key);

  const promise = (async () => {
    const res = await fetch(
      buildUrl(`/api/BranchLedger/get-with-installments?branchId=${branchID}&month=${month}&year=${year}`),
      { headers: { Accept: '*/*' } },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) {
      throw new Error(apiMessage(json) || 'Could not load challans');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map(normalizeLedgerInstallments);
  })();

  monthChallansCache.set(key, promise);
  promise.catch(() => { monthChallansCache.delete(key); });
  return promise;
}

/* Null amounts → 0 so UI math (reduce / Math.max) NaN na ho. */
export function normalizeLedgerInstallments(challan) {
  if (!challan || typeof challan !== 'object') return challan;
  const detailRows = Array.isArray(challan.detailRows) ? challan.detailRows.map(row => {
    const installments = Array.isArray(row.installments)
      ? row.installments.map(inst => ({
          ...inst,
          challanAmount: Number(inst.challanAmount) || 0,
          discount: Number(inst.discount) || 0,
          receivedAmount: Number(inst.receivedAmount) || 0,
          recvDiscount: Number(inst.recvDiscount) || 0,
          pendingorAdv: Number(inst.pendingorAdv) || 0,
          advanceAmount: Number(inst.advanceAmount) || 0,
        }))
      : [];
    /* Receiving-time discount (recvDiscount) ko YAHIN ek dafa `discount` me jod do —
       server `discount` me sirf Discount Manager rakhta hai. Is se Receiving, Fee Challan
       list (individual + family), one-month / combined challan print, reports — sab
       ek hi Discount / Net / Remaining dikhate hain. `_mgrDisc` = asal manager discount;
       `_recvFolded` = dobara na jude (withPersistedGiveDisc ise pehchanta hai).
       API ko `discount` wapas kabhi nahi jaata (receive-installment sirf delta bhejta hai). */
    const mgrDisc = Number(row.discount) || 0;
    const recvDisc = Math.max(0, Number(row.recvDiscount) || 0);
    return {
      ...row,
      challanAmount: Number(row.challanAmount) || 0,
      discount: row._recvFolded ? mgrDisc : mgrDisc + recvDisc,
      _mgrDisc: row._recvFolded ? row._mgrDisc : mgrDisc,
      _recvFolded: row._recvFolded || recvDisc > 0,
      receivedAmount: Number(row.receivedAmount) || 0,
      recvDiscount: recvDisc,
      pendingorAdv: Number(row.pendingorAdv) || 0,
      advanceAmount: Number(row.advanceAmount) || 0,
      previousPendingorAdv: Number(row.previousPendingorAdv ?? row.previousPendingOrAdv) || 0,
      installments,
    };
  }) : [];
  return { ...challan, detailRows };
}

/* Nested installments → Receiving UI payment rows (Installment 1..N).
   Group by installmentNo across heads; empty #1 (no money) skip. */
export function installmentsToPayments(challan) {
  if (!challan) return [];
  const groups = new Map();
  (challan.detailRows || []).forEach(row => {
    const headName = String(row.subHead || row.head || '').trim();
    if (!headName) return;
    (row.installments || []).forEach(inst => {
      const recv = Number(inst.receivedAmount) || 0;
      const disc = Number(inst.recvDiscount) || 0;
      if (recv === 0 && disc === 0) return;
      const no = Number(inst.installmentNo) || 0;
      if (!groups.has(no)) {
        /* Method me |#GD# marker ho sakta hai — UI ko clean name chahiye. */
        const rawMethod = String(challan.paymentMethod || 'Cash');
        const gdAt = rawMethod.indexOf('|#GD#');
        const cleanMethod = (gdAt >= 0 ? rawMethod.slice(0, gdAt) : rawMethod).trim() || 'Cash';
        groups.set(no, {
          id: `inst-${challan.id}-${no}`,
          installmentNo: no,
          date: String(inst.receivedDate || challan.receivedDate || '').slice(0, 10),
          method: cleanMethod,
          amount: 0,
          perHead: {},
          giveDisc: {},
          byHeadInstIds: {},
          isReceiving: false,
          source: 'api',
          by: 'Counter',
        });
      }
      const p = groups.get(no);
      p.perHead[headName] = (p.perHead[headName] || 0) + recv;
      if (disc > 0) {
        p.giveDisc[headName] = (p.giveDisc[headName] || 0) + disc;
        p.isReceiving = true;
      }
      if (inst.installmentId) p.byHeadInstIds[headName] = inst.installmentId;
      p.amount += recv;
      if (inst.receivedDate) p.date = String(inst.receivedDate).slice(0, 10);
    });
  });
  if (groups.size) return [...groups.values()].sort((a, b) => a.installmentNo - b.installmentNo);

  /* Legacy / no nested installments: one synthetic payment from detail totals. */
  const perHead = {};
  const giveDisc = {};
  let amount = 0;
  (challan.detailRows || []).forEach(r => {
    const n = String(r.subHead || r.head || '').trim();
    if (!n) return;
    const recv = Number(r.receivedAmount) || 0;
    if (recv) { perHead[n] = (perHead[n] || 0) + recv; amount += recv; }
    const rd = Number(r.recvDiscount) || 0;
    if (rd) giveDisc[n] = (giveDisc[n] || 0) + rd;
  });
  if (amount <= 0 && !Object.keys(giveDisc).length) return [];
  const rawMethod = String(challan.paymentMethod || 'Cash');
  const gdAt = rawMethod.indexOf('|#GD#');
  const cleanMethod = (gdAt >= 0 ? rawMethod.slice(0, gdAt) : rawMethod).trim() || 'Cash';
  return [{
    id: `legacy-${challan.id}`,
    installmentNo: 1,
    date: String(challan.receivedDate || challan.modifiedAt || '').slice(0, 10),
    method: cleanMethod,
    amount,
    perHead,
    giveDisc,
    byHeadInstIds: {},
    isReceiving: Object.keys(giveDisc).length > 0,
    source: 'api',
    by: 'Counter',
  }];
}

/* Full-branch resolution maps for reports/exports (e.g. the Generated Fee
   Challans Excel). Loads the whole class→section→student tree once from the
   same LaunchSetup roster endpoint and returns lookup maps that do NOT depend
   on what the UI has loaded/expanded, and are NOT limited to active students
   (a challan can belong to a since-deactivated student). Students are indexed
   by studentID, applicantsID AND registrationNumber, because a challan may
   reference any of them. Values carry name / father / phone / reg. */
export async function getBranchRosterMaps() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const res = await fetch(
    buildUrl(`/api/LaunchSetup/get-class-section-studentlist-by-branch/${branchID}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load class students');

  const grades = Array.isArray(json?.data) ? json.data : [];
  const classNameById = {};
  const sectionNameById = {};
  const studentById = {};

  /* studentID keys win over applicantsID/reg keys (studentID is put first and
     an existing key is never overwritten), so a collision between one student's
     applicantsID and another's studentID keeps the real studentID mapping. */
  const put = (key, val) => {
    const k = String(key ?? '').trim();
    if (k && k !== '0' && !(k in studentById)) studentById[k] = val;
  };

  grades.forEach(g => {
    const gradeId = pick(g, 'id', 'gradeID', 'gradeId', 'classID') || 0;
    const cls = pick(g, 'name', 'gradeName', 'className') || '';
    if (gradeId) classNameById[String(gradeId)] = cls;

    (Array.isArray(g.sections) ? g.sections : []).forEach(s => {
      const sectionId = pick(s, 'sectionID', 'id', 'sectionId') || 0;
      const sec = pick(s, 'sectionName', 'name') || '';
      if (sectionId) sectionNameById[String(sectionId)] = sec;

      (Array.isArray(s.students) ? s.students : []).forEach(st => {
        const studentID = pick(st, 'id', 'studentID', 'studentId') || 0;
        const applicantsID = Number(pick(st, 'applicantsID', 'applicantID', 'applicantId')) || 0;
        const reg = String(
          pick(st, 'registerNo', 'regNo', 'registrationNo', 'registrationNumber', 'admissionNo', 'previousAdmissionNo') || ''
        ).trim();
        const first = pick(st, 'firstName', 'name', 'studentName');
        const last = pick(st, 'lastName');
        const name = [first, last].filter(Boolean).join(' ').trim() || '';
        const father = pick(st, 'fatherName', 'guardianName') || '';
        const phone = String(
          pick(st, 'mobileNo', 'mobile', 'phone', 'contactNumber', 'contactNo', 'guardianContact', 'fatherMobile', 'parentMobile') || ''
        ).trim();
        /* Address is on this SAME endpoint under postalAddress / permanentAddesss
           (note the typo'd triple-s field the backend actually sends) — the same
           fields studentService.mapStudent() reads. These were missing before, so
           the export's Address column came out blank. */
        const address = String(
          pick(st, 'postalAddress', 'permanentAddesss', 'permanentAddress', 'address', 'homeAddress', 'residentialAddress', 'currentAddress', 'presentAddress', 'studentAddress', 'fullAddress') || ''
        ).trim();
        const val = { name, father, phone, address, reg, studentID, applicantsID };
        put(studentID, val);
        put(applicantsID, val);
        if (reg) put(reg, val);
      });
    });
  });

  return { classNameById, sectionNameById, studentById };
}

/* One student's challans — installment API (README §4.3 open modal refresh).
   GET /get-with-installments?branchId&studentId&month&year */
export async function getStudentChallans(studentId, month, year) {
  const rows = await getWithInstallments({
    studentId,
    month,
    year,
  });
  return Array.isArray(rows) ? rows : [];
}

/* getLedgerRange() is called from 4 different Fee.jsx sub-views (Challan
   gen, Fee Challans list, Fee Receiving list, Reports) with the same
   "previous dues" range on mount — cache it the same way as
   getMonthChallans so those collapse into one branch-wide request instead
   of 4, and clear it on the same mutations. */
const ledgerRangeCache = new Map(); // `${branchID}|${fromMonth}|${fromYear}|${toMonth}|${toYear}` -> promise

/* Every challan in a month range, whole branch, one call.
   GET /api/BranchLedger/get-by-month-range — months are 1-based. */
export async function getLedgerRange(fromMonth, fromYear, toMonth, toYear) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const key = `${branchID}|${fromMonth}|${fromYear}|${toMonth}|${toYear}`;
  if (ledgerRangeCache.has(key)) return ledgerRangeCache.get(key);

  const promise = (async () => {
    const res = await fetch(
      buildUrl(`/api/BranchLedger/get-by-month-range?branchId=${branchID}&fromMonth=${fromMonth}&fromYear=${fromYear}&toMonth=${toMonth}&toYear=${toYear}`),
      { headers: { Accept: '*/*' } },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) {
      throw new Error(apiMessage(json) || 'Could not load ledger history');
    }
    return Array.isArray(json?.data)
      ? json.data.map(normalizeLedgerInstallments)
      : [];
  })();

  ledgerRangeCache.set(key, promise);
  promise.catch(() => { ledgerRangeCache.delete(key); });
  return promise;
}

/* Purane ERP se migrate hua ledger — ek waqt me SIRF ek month.
   GET /api/BranchLedger/oldERPbranchledger?branchId&month&year

   `summary` hi is endpoint ka asal mawad hai (per-student ek row: applicantID,
   gradeID, sectionID, challanAmount, discount, receivedAmount); `data` abhi
   hamesha khali aata hai. Swagger response schema declare nahi karta, is liye
   dono arrays defensive tareeqe se nikaale jaate hain. */
export async function getOldErpLedger(month, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const res = await fetch(
    buildUrl(`/api/BranchLedger/oldERPbranchledger?branchId=${branchID}&month=${month}&year=${year}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load old ERP ledger');
  }
  return {
    data:    Array.isArray(json?.data) ? json.data : [],
    summary: Array.isArray(json?.summary) ? json.summary : [],
  };
}

/* ── Purana ERP ledger, EK class+section ka ────────────────────────────
   GET /api/BranchLedger/oldERPbranchledger_byClassSection
       ?branchId&month&year&gradeId&sectionId

   Branch-wide `oldERPbranchledger` ke bar-aks ye har class+section ka apna
   hissa deta hai. Faida ye ke row ka grade aur section SAWAAL se hi maloom
   hote hain — purane ERP ke apne sectionID naye setup se mel nahi khate
   (branch 220867: hamari section 1661425 wahan 1659330 hai), is liye row par
   jo aata hai us par bharosa nahi kiya ja sakta. Jo request me bheja, wahi
   row par chipka dete hain.

   Jawab ka dhancha wahi hai jo branch-wide route ka: asal mawad `summary` me
   hota hai, `data` abhi khali aata hai — dono defensive tareeqe se. */
export async function getOldErpLedgerByClassSection(month, year, gradeId, sectionId) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  const qs = `branchId=${branchID}&month=${month}&year=${year}&gradeId=${Number(gradeId) || 0}&sectionId=${Number(sectionId) || 0}`;
  const res = await fetch(
    buildUrl(`/api/BranchLedger/oldERPbranchledger_byClassSection?${qs}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load old ERP ledger');
  }
  const stamp = (rows) => (Array.isArray(rows) ? rows : []).map(r => ({
    ...r,
    /* Request ke grade/section hi sach hain — upar wali sharh dekhein. */
    gradeID:   Number(gradeId) || 0,
    sectionID: Number(sectionId) || 0,
  }));
  return { data: stamp(json?.data), summary: stamp(json?.summary) };
}

/* ── Poore branch ka purana ledger — har class+section par ek call ──────
   Ye route sirf ek class+section deta hai, is liye poori tasveer ke liye har
   jori par hit karna parta hai. Aath ek saath: browser ki fi-host limit ~6
   hoti hai, us se zyada bhejna sirf qatar lamba karta hai.

   Ek jori ka fail hona poori screen na roke — us ka hissa khali maan kar
   baqi dikha dete hain (wahi usool jo baqi fee calls par hai). */
export async function getOldErpLedgerForClasses(month, year, pairs = []) {
  const jobs = (Array.isArray(pairs) ? pairs : [])
    .filter(p => Number(p?.gradeId) > 0);
  const out = [];
  const failed = [];
  const LIMIT = 8;
  let next = 0;

  const worker = async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= jobs.length) return;
      const p = jobs[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await getOldErpLedgerByClassSection(month, year, p.gradeId, p.sectionId);
        out.push(...res.summary, ...res.data);
      } catch (e) {
        failed.push(p);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIMIT, jobs.length) }, worker));

  /* Ek hi student do jori me na ginn jaye (misal purani section id ki wajah
     se) — applicantID par pehli row rehti hai. */
  const seen = new Set();
  const rows = [];
  out.forEach(r => {
    const id = String(r?.applicantID ?? r?.applicantsID ?? r?.applicantId ?? r?.studentID ?? '').trim();
    const k = id || `row${rows.length}`;
    if (seen.has(k)) return;
    seen.add(k);
    rows.push(r);
  });
  return { rows, failed: failed.length, total: jobs.length };
}

/* ── Purani ERP row → wahi shape jo getLedgerRange deta hai ─────────────
   History screen har cheez `records` par banati hai: month + year + detailRows
   (har row par challanAmount / discount / receivedAmount). Purana ERP per
   student ek hi jama row deta hai — head-wise breakdown us me hai hi nahi —
   is liye ek hi synthetic detail row banti hai. Ledger Summary (mahina-war
   billed / received / pending) is se poori tarah theek chalti hai; head-wise
   tafseel sirf naye ledger me hoti hai. */
const oldErpRowToRecord = (r, month, year, gradeId, sectionId) => {
  const applicantId = r?.applicantID ?? r?.applicantsID ?? r?.applicantId ?? r?.studentID;
  if (applicantId == null || applicantId === '') return null;
  const challanAmount = Number(r.challanAmount ?? r.challanAmt ?? 0) || 0;
  const discount = Number(r.discount ?? 0) || 0;
  const receivedAmount = Number(r.receivedAmount ?? r.receivedAmt ?? 0) || 0;
  return {
    id: Number(r.id ?? r.ID ?? 0) || 0,
    /* History student ko `studentID` ya `applicantsID` — dono par dhoondti hai
       (dekhein historyFor). Purane ERP ki id applicantsID se milti hai. */
    studentID: applicantId,
    plApplicantID: String(applicantId),
    /* Request ke grade/section hi sach hain — row par jo aata hai wo purane
       ERP ke apne ids hain jo naye setup se mel nahi khate. */
    gradeID: Number(gradeId) || 0,
    sectionID: Number(sectionId) || 0,
    month,
    year: String(year),
    challanNo: r.challanNo ?? r.challanNumber ?? '',
    dueDate: r.dueDate ?? null,
    receivedDate: r.receivedDate ?? r.receivingDate ?? null,
    modifiedAt: r.modifiedAt ?? r.modifiedDate ?? null,
    dateofCreattion: r.dateofCreattion ?? r.createdDate ?? null,
    modifiedBy: r.modifiedBy ?? null,
    createdBy: r.createdBy ?? null,
    _oldErp: true,
    detailRows: [{ head: 'Fee', subHead: '', challanAmount, discount, receivedAmount }],
  };
};

/* ── Poore range ka purana ledger — har MAHINE × har CLASS+SECTION par ek call ──
   `oldERPbranchledger_byClassSection` ek waqt me ek month aur ek class+section
   deta hai, is liye Ledger Summary ke range (misal Jan–Sep) ke liye
   months × classes calls banti hain. Aath ek saath — browser ki fi-host limit
   ~6 hoti hai, us se zyada bhejna sirf qatar lamba karta hai.

   Ek call ka fail hona poori screen na roke: us ka hissa khali maan kar baqi
   dikha dete hain, aur kitni reh gayin wo caller ko bata dete hain. */
export async function getOldErpLedgerRecords(fromMonth, toMonth, year, pairs = []) {
  const from = Number(fromMonth) || 1;
  const to = Math.max(from, Number(toMonth) || from);
  const cls = (Array.isArray(pairs) ? pairs : []).filter(p => Number(p?.gradeId) > 0);

  const jobs = [];
  for (let m = from; m <= to; m += 1) {
    cls.forEach(p => jobs.push({ m, gradeId: p.gradeId, sectionId: p.sectionId }));
  }

  const rows = [];
  let failed = 0;
  const LIMIT = 8;
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= jobs.length) return;
      const j = jobs[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await getOldErpLedgerByClassSection(j.m, year, j.gradeId, j.sectionId);
        [...res.summary, ...res.data].forEach(r => {
          const rec = oldErpRowToRecord(r, j.m, year, j.gradeId, j.sectionId);
          if (rec) rows.push(rec);
        });
      } catch (e) {
        failed += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIMIT, jobs.length) }, worker));

  /* Ek student ka ek mahine me ek hi record — do jori se aa jaye to pehla rehta hai. */
  const seen = new Set();
  return {
    rows: rows.filter(r => {
      const k = `${r.studentID}|${r.month}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
    failed,
    total: jobs.length,
  };
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

/* ═══════════════════════════════════════════════════════════════════
   RECEIVE APIs (installment) — README §2 / §4.3 / §5.4 / §5.9

   Pay Now (modal)     → POST /receive-installment
                         body: delta amounts, installmentId: 0
   Totals (legacy UI)  → POST /receive-payment-installment
                         body: running totals per head (increase only)
   NEVER               → POST /receive-payment  (legacy non-installment)
   ═══════════════════════════════════════════════════════════════════ */

/* Smart router: detailRows with installmentId → delta API; else totals API. */
export async function receivePayment(body) {
  const rows = Array.isArray(body?.detailRows) ? body.detailRows : [];
  const looksLikeDelta = rows.some(r => r && Object.prototype.hasOwnProperty.call(r, 'installmentId'));
  return looksLikeDelta ? receiveInstallment(body) : receivePaymentInstallment(body);
}

/* Totals format — README §5.9. receivedAmount / discount = NEW TOTALS (not delta). */
export async function receivePaymentInstallment(body) {
  const cleaned = stripPendingFromReceiveBody(body);
  const res = await fetch(buildUrl('/api/BranchLedger/receive-payment-installment'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(cleaned),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not record payment');
  }
  invalidateMonthChallans();
  return json;
}

/* Per-installment receive (THIS payment only). installmentId: 0 = new / fill empty.
   README §4.3 / §5.4 — Receiving modal Pay Now uses this. */
export async function receiveInstallment(body) {
  const cleaned = stripPendingFromReceiveBody(body);
  const res = await fetch(buildUrl('/api/BranchLedger/receive-installment'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(cleaned),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not record installment');
  }
  invalidateMonthChallans();
  return json;
}

/* Build Pay Now body for receive-installment (README §4.3).
   perHead / giveDisc = amounts of THIS installment only (not running totals). */
export function buildReceiveInstallmentRequest({
  ledgerId,
  paymentMethod = 'Cash',
  receivedDate = '',
  modifiedBy = 0,
  isReceiving = true,
  detailRows = [],
  perHead = {},
  giveDisc = {},
  fine = 0,
  newHeads = [],
} = {}) {
  const rows = [];
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

  (detailRows || []).forEach(r => {
    if (isLateFineRow(r)) return;
    /* Negative advance rows: skip Pay Now delta (consume via separate flow). */
    if (/previous|pending|arrear|old\s*advance|advance\s*till/i.test(String(r.subHead || r.head || ''))
        && (+r.challanAmount || 0) < 0) return;
    const headName = r.subHead ?? r.head;
    const recvNow = Math.round(Number(perHead?.[headName]) || 0);
    const disc = isReceiving ? Math.max(0, Math.round(Number(giveDisc?.[headName]) || 0)) : 0;
    if (recvNow <= 0 && disc <= 0) return;
    rows.push({
      id: Number(r.id) || 0,
      installmentId: 0,
      receivedAmount: Math.max(0, recvNow),
      discount: disc,
    });
  });

  const fineAmt = Math.max(0, Math.round(Number(fine) || 0));
  if (fineAmt > 0) {
    const fineRow = (detailRows || []).find(isLateFineRow);
    if (fineRow && Number(fineRow.id)) {
      rows.push({
        id: Number(fineRow.id),
        installmentId: 0,
        receivedAmount: fineAmt,
        discount: 0,
      });
    } else {
      rows.push({
        id: 0,
        installmentId: 0,
        receivedAmount: fineAmt,
        discount: 0,
        head: LATE_FINE_HEAD,
        subHead: LATE_FINE_HEAD,
      });
    }
  }

  (Array.isArray(newHeads) ? newHeads : []).forEach(h => {
    const name = h.name || h.subHead || h.head || '';
    const amt = Math.round(Number(h.amount ?? h.receivedAmount ?? perHead?.[name]) || 0);
    if (!name || amt <= 0) return;
    const existing = (detailRows || []).find(r => same(r.subHead || r.head, name));
    rows.push({
      id: existing ? (Number(existing.id) || 0) : 0,
      installmentId: 0,
      receivedAmount: amt,
      discount: 0,
      ...(existing ? {} : { head: 'Account Payable', subHead: name }),
    });
  });

  return {
    ledgerId: Number(ledgerId) || 0,
    paymentMethod: paymentMethod || 'Cash',
    receivedDate: String(receivedDate || '').slice(0, 10),
    modifiedBy: Number(modifiedBy) || 0,
    isReceiving: !!isReceiving,
    detailRows: rows,
  };
}

/* Build totals body for receive-payment-installment (README §5.9).
   detailRows[].receivedAmount / discount = NEW RUNNING TOTALS after this save. */
export function buildReceivePaymentInstallmentRequest({
  ledgerId,
  paymentMethod = 'Cash',
  receivedDate = '',
  modifiedBy = 0,
  isReceiving = true,
  detailRows = [],
} = {}) {
  const rows = (Array.isArray(detailRows) ? detailRows : [])
    .filter(r => r && (Number(r.id) || Number(r.receivedAmount) || Number(r.discount)))
    .map(r => {
      const out = {
        id: Number(r.id) || 0,
        receivedAmount: Math.max(0, Math.round(Number(r.receivedAmount) || 0)),
        discount: Math.max(0, Math.round(Number(r.discount) || 0)),
      };
      if (!out.id && (r.head || r.subHead)) {
        out.head = r.head || '';
        out.subHead = r.subHead || r.head || '';
      }
      return out;
    });
  return {
    ledgerId: Number(ledgerId) || 0,
    paymentMethod: paymentMethod || 'Cash',
    receivedDate: String(receivedDate || '').slice(0, 10),
    modifiedBy: Number(modifiedBy) || 0,
    isReceiving: !!isReceiving,
    detailRows: rows,
  };
}

function stripPendingFromReceiveBody(body) {
  if (!body || typeof body !== 'object') return body;
  const detailRows = Array.isArray(body.detailRows)
    ? body.detailRows.map(r => {
        if (!r || typeof r !== 'object') return r;
        const { pendingorAdv, previousPendingorAdv, previousPendingOrAdv, advanceAmount, ...rest } = r;
        return rest;
      })
    : body.detailRows;
  return { ...body, detailRows };
}

export async function createChallanInstallment(payload) {
  const res = await fetch(buildUrl('/api/BranchLedger/create-challan-installment'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not create challan');
  }
  invalidateMonthChallans();
  return json;
}

export async function getWithInstallments({ branchId, studentId, month, year } = {}) {
  const branchID = Number(branchId) || Number(sessionStorage.getItem('branchID')) || 1;
  const qs = new URLSearchParams({ branchId: String(branchID) });
  if (studentId != null && studentId !== '') qs.set('studentId', String(studentId));
  if (month != null && month !== '') qs.set('month', String(month));
  if (year != null && year !== '') qs.set('year', String(year));
  const res = await fetch(buildUrl(`/api/BranchLedger/get-with-installments?${qs}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load challans');
  }
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(normalizeLedgerInstallments);
}

export async function getInstallments(ledgerId, detailId) {
  const qs = detailId != null && detailId !== '' ? `?detailId=${detailId}` : '';
  const res = await fetch(buildUrl(`/api/BranchLedger/installments/${ledgerId}${qs}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load installments');
  }
  return Array.isArray(json?.data) ? json.data : [];
}

export async function updateInstallment(ledgerId, installmentId, body) {
  const userID = Number(sessionStorage.getItem('UserID')) || 0;
  const payload = {
    modifiedBy: userID,
    ...(body || {}),
  };
  const res = await fetch(
    buildUrl(`/api/BranchLedger/update-installment/${ledgerId}/${installmentId}`),
    {
      method: 'PUT',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not update installment');
  }
  invalidateMonthChallans();
  return json;
}

/* Edit one UI "payment" (may span multiple heads / installment ids). */
export async function editInstallment({ ledgerId, payment, patch } = {}) {
  const id = Number(ledgerId) || 0;
  if (!id) throw new Error('Missing challan id for installment edit');
  const byIds = (payment && payment.byHeadInstIds) || {};
  const heads = Object.keys(byIds);
  if (!heads.length) {
    throw new Error('This payment has no installment ids — reload and try again');
  }
  const userID = Number(sessionStorage.getItem('UserID')) || 0;
  const date = (patch && patch.date) || (payment && payment.date) || '';
  const method = (patch && patch.method) || (payment && payment.method) || 'Cash';
  const results = [];
  for (const headName of heads) {
    const instId = Number(byIds[headName]) || 0;
    if (!instId) continue;
    const receivedAmount = Math.round(Number(patch?.perHead?.[headName]) || 0);
    const recvDiscount = Math.round(Number(patch?.giveDisc?.[headName]) || 0);
    results.push(await updateInstallment(id, instId, {
      receivedAmount,
      recvDiscount,
      receivedDate: date,
      paymentMethod: method,
      modifiedBy: userID,
    }));
  }
  return results;
}

/* ── Give Discount SERVER persist (paymentMethod marker) ───────────────
   Backend aksar detailRows.discount me receiving-time give nahi rakhta, aur
   localStorage logout/login + dusre device par gayab. paymentMethod string
   receive-payment se persist hoti hai — us me compact marker chipka dete hain:
     Cash|#GD#Admission%20Fee=133;Others=30
   UI/reports sirf clean method dikhate hain; reload par marker se giveDisc
   wapas milta hai (mobile/laptop/kisi bhi login par). */
const GD_MARK = '|#GD#';

export function paymentMethodDisplay(raw) {
  const s = String(raw || 'Cash');
  const i = s.indexOf(GD_MARK);
  return (i >= 0 ? s.slice(0, i) : s).trim() || 'Cash';
}

export function parseGiveDiscFromPaymentMethod(raw) {
  const s = String(raw || '');
  const i = s.indexOf(GD_MARK);
  if (i < 0) return { method: s.trim() || 'Cash', giveDisc: {}, isReceiving: false };
  const method = (s.slice(0, i).trim() || 'Cash');
  const giveDisc = {};
  String(s.slice(i + GD_MARK.length) || '').split(';').forEach(pair => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    if (eq < 0) return;
    let name = pair.slice(0, eq);
    try { name = decodeURIComponent(name); } catch { /* keep raw */ }
    const amt = Math.max(0, Math.round(+pair.slice(eq + 1) || 0));
    if (name && amt > 0) giveDisc[name] = (giveDisc[name] || 0) + amt;
  });
  return { method, giveDisc, isReceiving: Object.keys(giveDisc).length > 0 };
}

export function encodePaymentMethodWithGiveDisc(method, giveDisc, isReceiving = true) {
  const base = paymentMethodDisplay(method);
  if (!isReceiving) return base;
  const parts = [];
  Object.entries(giveDisc || {}).forEach(([k, v]) => {
    const amt = Math.max(0, Math.round(+v || 0));
    if (!k || amt <= 0) return;
    parts.push(`${encodeURIComponent(String(k))}=${amt}`);
  });
  if (!parts.length) return base;
  return `${base}${GD_MARK}${parts.join(';')}`;
}

/** Kya is ledger row par ab bhi koi receiving maujood hai?
    delete-receiving har detailRow ka receivedAmount 0 kar deta hai (advance row
    MINUS hoti hai, is liye abs). Ye wahi sawaal hai jis par Give Discount ka
    dikhna mauqoof hai — neeche withPersistedGiveDisc dekhein. */
export function hasLiveReceiving(rec) {
  const rows = Array.isArray(rec?.detailRows) ? rec.detailRows : [];
  return rows.some(r => Math.abs(+r.receivedAmount || 0) > 0);
}

/** Challan reload par Give Discount ko detailRows.discount me fold karo
    (agar pehle se fold na ho). paymentMethod marker + localStorage dono se.

    AHEM: marker par sirf TAB bharosa hota hai jab row par receiving BAQI ho.
    Give Discount receiving ka hissa hai — receive karte waqt wo
    detailRows.discount me POST hoti hai, aur paymentMethod ka |#GD#…
    sirf backup hai (agar API discount wapas na de). delete-receiving
    receivedAmount aur us discount, DONO ko palat deta hai, magar
    paymentMethod jyon ka tyon chhod deta hai — marker samet. Us haalat me
    marker ko wapas fold karna aisi discount paida kar deta tha jo ledger me
    rahi hi nahi: receiving delete karne ke baad bhi list ke Discount column
    aur receiving modal me Give Discount dikhti rehti thi. Receiving nahi to
    Give Discount bhi nahi. (localStorage delete ke waqt saaf hota hai, is
    liye wo yahan se hataya nahi jaata — warna sirf-discount wali receiving
    usi browser me apna column kho deti.) */
export function withPersistedGiveDisc(rec, opts = {}) {
  if (!rec) return rec;
  const live = hasLiveReceiving(rec);
  const fromPm = parseGiveDiscFromPaymentMethod(rec.paymentMethod);
  const fromStore = getStoredGiveDisc(rec.id)?.giveDisc || {};
  const giveDisc = live ? { ...fromStore, ...fromPm.giveDisc } : { ...fromStore };
  const cleanMethod = fromPm.method || paymentMethodDisplay(rec.paymentMethod);
  const keys = Object.keys(giveDisc);
  /* Optimistic UI rows pe Give pehle se discount me fold ho chuka hota hai —
     dobara mat jodo (warna slip Discount ×2: 500→1066, Remaining 8000→6100). */
  const alreadyInDiscount = !!(opts.discountAlreadyIncludesGive || rec._discountIncludesGive);
  /* Server ab har head ka receiving-time discount `recvDiscount` me khud rakhta hai
     (`discount` = sirf Discount Manager). Wo mile to wahi SACH hai — deterministic fold,
     koi heuristic nahi (neeche wala remNo/remWith andaza advance/over-payment par ulta
     faisla karta tha). `_mgrDisc` = asal manager discount (installment slip ke liye);
     `_recvFolded` dobara fold hone se bachata hai. */
  const srvRows = Array.isArray(rec.detailRows) ? rec.detailRows : [];
  const serverGiveTotal = srvRows.reduce((a, r) => a + Math.max(0, +r?.recvDiscount || 0), 0);
  if (serverGiveTotal > 0 && !alreadyInDiscount) {
    const give = {};
    const detailRows = srvRows.map(r => {
      const rd = Math.max(0, +r.recvDiscount || 0);
      if (!rd) return r;
      const name = r.subHead || r.head || '';
      give[name] = (give[name] || 0) + rd;
      if (r._recvFolded) return r;
      return { ...r, _mgrDisc: +r.discount || 0, discount: (+r.discount || 0) + rd, _recvFolded: true };
    });
    return {
      ...rec,
      paymentMethod: cleanMethod,
      _paymentMethodRaw: String(rec._paymentMethodRaw || rec.paymentMethod || ''),
      detailRows,
      _giveDisc: give,
      _isReceivingGive: true,
      _discountIncludesGive: true,
    };
  }
  if (!keys.length) {
    return rec.paymentMethod === cleanMethod
      ? rec
      : { ...rec, paymentMethod: cleanMethod, _giveDisc: {}, _isReceivingGive: false };
  }
  const norm = (s) => String(s || '').trim().toLowerCase();
  const byHead = {};
  keys.forEach(k => { byHead[norm(k)] = (byHead[norm(k)] || 0) + Math.max(0, +giveDisc[k] || 0); });

  const rows0 = Array.isArray(rec.detailRows) ? rec.detailRows : [];
  if (alreadyInDiscount) {
    return {
      ...rec,
      paymentMethod: cleanMethod,
      _paymentMethodRaw: String(rec._paymentMethodRaw || rec.paymentMethod || ''),
      detailRows: rows0,
      _giveDisc: giveDisc,
      _isReceivingGive: true,
      _discountIncludesGive: true,
    };
  }
  /* Fold detect: agar current discount ke sath remaining pehle se ~0 hai to
     give pehle se disc me hai — dobara na jodo. */
  let remNo = 0;
  let remWith = 0;
  rows0.forEach(r => {
    if (isLateFineRow(r)) return;
    const amt = +r.challanAmount || 0;
    const disc = +r.discount || 0;
    const hp = +r.previousPendingorAdv || +r.previousPendingOrAdv || 0;
    const recv = +r.receivedAmount || 0;
    const extra = byHead[norm(r.subHead || r.head)] || 0;
    remNo += (amt - disc + hp) - recv;
    remWith += (amt - disc - extra + hp) - recv;
  });
  /* Receiving na ho to server ka discount hi sach hai (delete use palat chuka
     hai) — us par kuch mat joro; _giveDisc sirf column dikhane ke liye rehti hai. */
  const alreadyFolded = !live || Math.abs(remNo) <= Math.abs(remWith);
  const detailRows = alreadyFolded
    ? rows0
    : rows0.map(r => {
        const extra = byHead[norm(r.subHead || r.head)] || 0;
        if (!extra) return r;
        const discount = (+r.discount || 0) + extra;
        const hp = +r.previousPendingorAdv || +r.previousPendingOrAdv || 0;
        const net = (+r.challanAmount || 0) - discount + hp;
        const received = +r.receivedAmount || 0;
        return { ...r, discount, pendingorAdv: net - received };
      });

  return {
    ...rec,
    paymentMethod: cleanMethod,
    /* Raw method (with |#GD#…) — next save me marker wapas encode karne ke liye. */
    _paymentMethodRaw: String(rec._paymentMethodRaw || rec.paymentMethod || ''),
    detailRows,
    _giveDisc: giveDisc,
    _isReceivingGive: true,
    _discountIncludesGive: !alreadyFolded || alreadyInDiscount,
  };
}

/* ── Give Discount local persist (same-browser cache; server marker primary) ─
   Backend receive-payment aksar detailRows.discount me receiving-time give
   ko wapas nahi rakhta. Session receipts bhi mock/empty hain — tab switch
   par React remount se giveDisc gayab → list Remaining wapas aa jati.
   Is liye ledgerId par localStorage me rakhte hain (branch-scoped). */
const giveDiscStoreKey = () => {
  const branchID = Number(sessionStorage.getItem('branchID')) || 1;
  return `feeGiveDisc|${branchID}`;
};
const readGiveDiscStore = () => {
  try {
    const raw = localStorage.getItem(giveDiscStoreKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch { return {}; }
};
const writeGiveDiscStore = (store) => {
  try { localStorage.setItem(giveDiscStoreKey(), JSON.stringify(store || {})); } catch { /* ignore quota */ }
};

/** Merge / save per-head give discount for a ledger challan. */
export function saveStoredGiveDisc(ledgerId, giveDisc, isReceiving = true) {
  const id = String(ledgerId || '');
  if (!id) return;
  const store = readGiveDiscStore();
  const incoming = {};
  Object.entries(giveDisc || {}).forEach(([k, v]) => {
    const n = Math.max(0, +v || 0);
    if (n > 0) incoming[k] = n;
  });
  if (!isReceiving || !Object.keys(incoming).length) {
    delete store[id];
    writeGiveDiscStore(store);
    return;
  }
  const prev = (store[id] && store[id].giveDisc) ? store[id].giveDisc : {};
  const merged = { ...prev };
  Object.entries(incoming).forEach(([k, v]) => { merged[k] = (merged[k] || 0) + v; });
  store[id] = { giveDisc: merged, isReceiving: true, at: Date.now() };
  writeGiveDiscStore(store);
}

export function getStoredGiveDisc(ledgerId) {
  const id = String(ledgerId || '');
  if (!id) return null;
  const entry = readGiveDiscStore()[id];
  if (!entry || !entry.giveDisc) return null;
  return entry;
}

export function getStoredGiveDiscTotal(ledgerId) {
  const entry = getStoredGiveDisc(ledgerId);
  if (!entry?.giveDisc) return 0;
  return Object.values(entry.giveDisc).reduce((a, v) => a + Math.max(0, +v || 0), 0);
}

export function clearStoredGiveDisc(ledgerId) {
  const id = String(ledgerId || '');
  if (!id) return;
  const store = readGiveDiscStore();
  if (!(id in store)) return;
  delete store[id];
  writeGiveDiscStore(store);
}

/* Reverse the receiving recorded against a challan — the challan itself stays.
   DELETE /api/BranchLedger/clear-receiving/{ledgerId}?modifiedBy=
   (Receiving tab trash). Challan voucher delete = deleteChallanInstallment. */
export async function deleteReceiving(ledgerId) {
  return clearReceiving(ledgerId);
}

export async function clearReceiving(ledgerId) {
  const id = Number(ledgerId) || 0;
  if (!id) throw new Error('Missing challan id to clear receiving');
  const userID = Number(sessionStorage.getItem('UserID')) || 0;
  const qs = userID ? `?modifiedBy=${userID}` : '';
  const res = await fetch(
    buildUrl(`/api/BranchLedger/clear-receiving/${id}${qs}`),
    { method: 'DELETE', headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not clear the receiving');
  }
  /* Give Discount local cache bhi saaf — warna Remaining 0 / zombie disc reh jata. */
  clearStoredGiveDisc(id);
  invalidateMonthChallans();
  return json;
}

/* @deprecated — use clearReceiving; kept as alias for older call sites. */
export async function deleteReceivingInstallment(ledgerId) {
  return clearReceiving(ledgerId);
}

export async function deleteReceivingDetailInstallment(detailId) {
  const userID = Number(sessionStorage.getItem('UserID')) || 0;
  const res = await fetch(
    buildUrl(`/api/BranchLedger/delete-receiving-detail-installment/${detailId}?modifiedBy=${userID}`),
    { method: 'DELETE', headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not reset head receiving');
  }
  invalidateMonthChallans();
  return json;
}

/* Delete a single challan voucher (installment API).
   DELETE /api/BranchLedger/delete-challan-installment/{ledgerId} */
export async function deleteChallanById(id) {
  return deleteChallanInstallment(id);
}

export async function deleteChallanInstallment(ledgerId) {
  const res = await fetch(
    buildUrl(`/api/BranchLedger/delete-challan-installment/${ledgerId}`),
    { method: 'DELETE', headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not delete challan');
  }
  invalidateMonthChallans();
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
