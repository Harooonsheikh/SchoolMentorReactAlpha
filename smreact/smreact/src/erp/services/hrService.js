import {
  mockStaff,
  mockHrStats,
  mockHrEmployees,
  mockHrNextDeptId,
  mockHrNextDesigId,
  mockHrNextEmpId,
  mockHrPayroll,
  mockHrNextPayrollId,
} from '../mock/hr';
import { delay, clone } from './_http';
import { buildUrl, apiMessage } from '../../utils/apiConfig';

/* The three allowance heads the backend stores as fixed employee columns
   (basicSalary + these 3 = the "4 basic" salary values). They render as
   non-removable cards in the salary UI; anything else is a custom head that
   lives on the /api/HR/*-salary-head endpoints. */
export const HR_FIXED_HEADS = ['Medical Allowance', 'Rent Allowance', 'Transport Allowance'];

/* Fixed employee document slots ↔ backend `documentType` strings. Anything not
   in this map is a custom ("Other") document surfaced by its raw type name. */
export const HR_EMP_DOC_TYPES = {
  cnic:       'CNIC',
  degree:     'Degree',
  experience: 'ExperienceLetter',
  contract:   'Contract',
  resume:     'Resume',
};
/* Case-insensitive: the backend may store "Cnic" while our constant is "CNIC". */
const EMP_DOC_TYPE_TO_KEY = Object.fromEntries(
  Object.entries(HR_EMP_DOC_TYPES).map(([key, type]) => [type.toLowerCase(), key]),
);

/* Split an employee's documents[] into { stdDocs } (keyed by fixed slot, each
   { id, path }) and { docs } (custom documents [{ id, name, path }]). */
function mapEmployeeDocuments(list) {
  const stdDocs = {};
  const docs = [];
  (Array.isArray(list) ? list : []).forEach(d => {
    const id   = d.id ?? d.ID ?? d.documentID ?? 0;
    const type = d.documentType ?? '';
    const path = d.documentPath ?? d.path ?? '';
    const key  = EMP_DOC_TYPE_TO_KEY[String(type).toLowerCase().trim()];
    if (key) stdDocs[key] = { id, path, type };
    else if (type) docs.push({ id, name: type, path });
  });
  return { stdDocs, docs };
}

/* yyyy-MM-dd for <input type="date"> — the API returns full ISO datetimes,
   which a date input silently rejects (blanks the field on edit). */
const dateOnly = (v) => {
  if (!v) return '';
  const m = String(v).match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : String(v);
};
/* First integer found in a value ("5 years" → 5) for numeric API fields. */
const toInt = (v) => { const m = String(v ?? '').match(/-?\d+/); return m ? Number(m[0]) : 0; };
/* Numeric id or a sensible default when the UI field is free-text/blank. */
const idOr = (v, dflt) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : dflt; };

/* ─── HR Basics — Departments & Designations (real API: LaunchSetup) ───
   The backend returns departments for the active branch with their
   designations nested. The HR Basics UI works off two flat lists
   (depts + desigs joined by dId), so we fetch once and project the
   nested response into each shape. branchID comes from sessionStorage,
   set at login (same convention as DepartmentsTab). */
async function fetchDepartmentsRaw() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-departments-by-branch/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load departments');
  return Array.isArray(json?.data) ? json.data : [];
}

/* ─── Legacy APIs (Dashboard) — unchanged ─── */
export async function getStaff()    { await delay(); return clone(mockStaff); }
export async function getHrStats()  { await delay(); return clone(mockHrStats); }
export async function getStaffById(id) {
  await delay();
  const found = mockStaff.find(s => s.id === id);
  return found ? clone(found) : null;
}

/* ─── HR Module — Read APIs ─── */
export async function getHrDepts() {
  const data = await fetchDepartmentsRaw();
  /* Keep the original API record on `raw` so an edit can preserve the
     department's existing designations in the save payload. */
  return data.map(d => ({ id: d.id, name: d.departmentName, desc: '', raw: d }));
}
export async function getHrDesigs() {
  const data = await fetchDepartmentsRaw();
  return data.flatMap(dep => (dep.designations || []).map(g => ({
    id: g.designationID,
    dId: g.branchDepartmentID,
    name: g.designationName,
    qual: g.qualificationName || '',
    desc: g.description || '',
    qualificationID: g.qualificationID,
  })));
}

export async function getHrNextDeptId()  { await delay(); return mockHrNextDeptId; }
export async function getHrNextDesigId() { await delay(); return mockHrNextDesigId; }
export async function getHrNextEmpId()   { await delay(); return mockHrNextEmpId; }

/* ─── HR Module — Write APIs ─── */
/* Department add + edit share one endpoint; the caller builds the full
   save-department payload (id 0 = add, id > 0 = update). */
export async function saveHrDept(payload) {
  const res  = await fetch(buildUrl('/api/LaunchSetup/save-department'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save department');
  return json;
}
export async function deleteHrDept({ id }) {
  const res  = await fetch(buildUrl(`/api/LaunchSetup/delete-department/${id}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = apiMessage(json) || '';
    if (msg.includes('REFERENCE constraint') || msg.includes('FK_AHM_Department_Designations_Department')) {
      throw new Error('Cannot delete department because it contains designations or related data.');
    }
    throw new Error(msg || 'Could not delete department');
  }
  return json;
}
/* ─── Subject Assignment lookups (real grades/sections/subjects) ───
   Same endpoints the Launch Setup task-assign uses. Normalized to
   { id, name, sections:[{id,name}] } and { id, name }. */
export async function getHrGrades() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load classes');
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(g => ({
    id:   Number(g.id ?? g.gradeID ?? g.gradeId ?? 0),
    name: g.name ?? g.gradeName ?? g.className ?? '—',
    sections: (Array.isArray(g.sections) ? g.sections : []).map(s => ({
      id:   Number(s.sectionID ?? s.id ?? s.sectionId ?? 0),
      name: s.sectionName ?? s.name ?? '—',
    })),
  }));
}
export async function getHrSubjects(gradeId, sectionId) {
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-subjects/${gradeId}/${sectionId}`), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load subjects');
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(s => ({
    id:   Number(s.id ?? s.subjectID ?? s.subjectId ?? 0),
    name: s.name ?? s.subjectName ?? '—',
  }));
}

/* ─── Location lookups (cascading Country → Province → City) ───
   Same /api/Setting endpoints the Launch Setup staff form uses; each returns
   { data: [{ ID, Name }] }. */
export async function getHrCountries() {
  const res  = await fetch(buildUrl('/api/Setting/get-countries'), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load countries');
  return Array.isArray(json?.data) ? json.data : [];
}
export async function getHrProvinces(countryId) {
  if (!countryId) return [];
  const res  = await fetch(buildUrl(`/api/Setting/get-provinces-by-country/${countryId}`), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load provinces');
  return Array.isArray(json?.data) ? json.data : [];
}
export async function getHrCities(provinceId) {
  if (!provinceId) return [];
  const res  = await fetch(buildUrl(`/api/Setting/get-cities-by-province/${provinceId}`), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load cities');
  return Array.isArray(json?.data) ? json.data : [];
}

/* Qualifications for the designation dropdown (id 0 = all). */
export async function getHrQualifications() {
  const res  = await fetch(buildUrl('/api/LaunchSetup/get-qualifications/0'), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load qualifications');
  return Array.isArray(json?.data) ? json.data : [];
}
/* Designation add + edit share one endpoint (designationID 0 = add). */
export async function saveHrDesig(payload) {
  const res  = await fetch(buildUrl('/api/LaunchSetup/save-department-designation'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save designation');
  return json;
}
export async function deleteHrDesig({ id }) {
  const res  = await fetch(buildUrl(`/api/LaunchSetup/delete-designation/${id}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not delete designation');
  return json;
}

/* ─── Employee Management — real API (LaunchSetup) ─── */
/* ─── Employee Management — real API (LaunchSetup) ───
   Backend requires isActive as a query param, so Active + Inactive
   employees come from two separate calls. We fetch both and merge
   them into one flat list — the UI's existing status-based filter
   (Active / Inactive tabs) keeps working unchanged. */
export async function getHrEmployees() {
  const token    = sessionStorage.getItem('token');
  const branchID = sessionStorage.getItem('branchID') || 0;

  const fetchByStatus = async (isActive) => {
    const res = await fetch(
      buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchID}?isActive=${isActive}`),
      {
        method: 'GET',
        headers: {
          Accept: '*/*',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiMessage(json) || 'Could not load employees');
    return Array.isArray(json?.data) ? json.data : [];
  };

  const [activeList, inactiveList] = await Promise.all([
    fetchByStatus(true),
    fetchByStatus(false),
  ]);

  return [...activeList, ...inactiveList].map(mapApiEmployeeToEmp);
}
export async function restoreHrEmployee({ id }) {
  const res  = await fetch(buildUrl(`/api/LaunchSetup/restore-employee/${id}`), {
    method: 'PUT',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not restore employee');
  return json;
}
/* Backend leave-settings shape (api/HR/get-leave-settings-by-employee) → the
   modal's leaves form shape. Missing values stay '' so a new employee's fields
   start blank; `_leaveId` carries the record id so a save updates in place. */
function leaveApiToForm(d = {}) {
  const val = (k) => (d[k] == null ? '' : d[k]);
  return {
    annual:    val('annualPaidLeaves'),
    casual:    val('casualLeaves'),
    sick:      val('sickLeaves'),
    maternity: val('maternityPaternityLeaves'),
    balance:   val('leaveBalance'),
    policy:    'Standard',
    deductEn:  d.enableLeaveDeduction !== false,
    absentDed: val('deductionOneDayAbsent'),
    unpaidDed: val('deductionUnpaidLeaves'),
    _leaveId:  d.id ?? 0,
  };
}

/* GET leave settings for one employee — returns the mapped leaves form object,
   or null when the employee has none yet (so the modal keeps blank fields). */
export async function getHrLeaveSettings(employeeId) {
  if (!employeeId) return null;
  const res  = await fetch(buildUrl(`/api/HR/get-leave-settings-by-employee/${employeeId}`), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) return null;
  const d = json?.data ?? json;
  const rec = Array.isArray(d) ? d[0] : d;
  if (!rec || typeof rec !== 'object') return null;
  return leaveApiToForm(rec);
}

/* Create (id 0) or update leave settings for an employee. */
export async function saveHrLeaveSettings({ id = 0, employeeID, leaves = {} }) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const res  = await fetch(buildUrl('/api/HR/save-leave-settings'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:                       Number(id) || 0,
      employeeID:               Number(employeeID) || 0,
      branchID,
      annualPaidLeaves:         Number(leaves.annual)    || 0,
      casualLeaves:             Number(leaves.casual)    || 0,
      sickLeaves:               Number(leaves.sick)      || 0,
      maternityPaternityLeaves: Number(leaves.maternity) || 0,
      leaveBalance:             Number(leaves.balance)   || 0,
      enableLeaveDeduction:     leaves.deductEn !== false,
      deductionOneDayAbsent:    Number(leaves.absentDed) || 0,
      deductionUnpaidLeaves:    Number(leaves.unpaidDed) || 0,
      createdBy:                userID,
      modifiedBy:               userID,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save leave settings');
  return json;
}

function mapApiEmployeeToEmp(e) {
  const { stdDocs: docStd, docs: docCustom } = mapEmployeeDocuments(e.documents);
  return {
    id:        e.id,
    eid:       `EMP-${String(e.id).padStart(3, '0')}`,
    firstName: e.firstName,
    lastName:  e.lastName,
    fn:        e.fatherName,
    cnic:      e.cnic,
    dob:       dateOnly(e.dateOfBirth),
    gender:    e.gender,
    marital:   e.maritalStatus,
    phone:     e.phone,
    email:     e.email,
    blood:     e.bloodGroup,
    nationality: e.countryName,
    address:   e.address,

    join:      dateOnly(e.dateOfJoining),
    status:    e.isActive ? 'Active' : 'Inactive',

    dId:       e.departmentID,
    desId:     e.designationID,
    qual:      e.qualificationName,
    exp:       e.experience,
    /* Names for display; ids for the edit-form dropdowns + save payload. */
    country:   e.countryName,
    province:  e.provinceName,
    city:      e.cityName,
    countryID:       e.countryID  ?? '',
    provinceID:      e.provinceID ?? '',
    cityID:          e.cityID     ?? '',
    qualificationID: e.qualificationID ?? '',

    basicSalary: e.basicSalary,
    payMethod:   e.paymentMethod || 'Bank Transfer',
    bankName:    e.bankName,
    bankAcc:     e.accountNumber,
    /* Leaves come from a dedicated endpoint (fetched by the modal on edit); the
       list response usually omits them, so default to blank here. */
    leaves:      leaveApiToForm(e.leaveSettings || {}),
    /* Fixed allowance columns first (non-removable), then any custom heads the
       backend returns (each carries its own id so edits/deletes can target it).
       Custom heads that collide with a fixed name are dropped to avoid dupes. */
    salaryHeads: [
      { name: 'Medical Allowance',   amount: e.medicalAllowanace  || 0, type: 'allow', fixed: true },
      { name: 'Rent Allowance',      amount: e.rentAllowance      || 0, type: 'allow', fixed: true },
      { name: 'Transport Allowance', amount: e.transportAllowance || 0, type: 'allow', fixed: true },
      ...(Array.isArray(e.salaryHeads ?? e.salaryHeadsList ?? e.employeeSalaryHeads)
        ? (e.salaryHeads ?? e.salaryHeadsList ?? e.employeeSalaryHeads)
        : [])
        .map(h => ({
          id:     h.id ?? h.ID ?? h.salaryHeadID ?? 0,
          name:   h.headName ?? h.name ?? '',
          amount: Number(h.amount) || 0,
          type:   (h.isAllowance === false) ? 'deduct' : 'allow',
          fixed:  false,
        }))
        .filter(h => h.name && !HR_FIXED_HEADS.includes(h.name)),
    ],

    photo: e.empImage,

    /* Existing subject assignments → { "gradeId_sectionId": [subjectId] }, keyed
       and typed exactly like the assignment tree (real numeric ids) so the saved
       subjects show as checked on edit. Field names vary in casing across the API. */
    subjects: (e.assignments ?? e.subjectAssignments ?? e.employeeSubjects ?? e.subjects ?? []).reduce((acc, a) => {
      const gradeId   = Number(a.gradeId   ?? a.gradeID   ?? a.grade_id   ?? 0);
      const sectionId = Number(a.sectionId ?? a.sectionID ?? a.section_id ?? 0);
      const subjectId = Number(a.subjectId ?? a.subjectID ?? a.subject_id ?? 0);
      if (!gradeId || !sectionId || !subjectId) return acc;
      const key = `${gradeId}_${sectionId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(subjectId);
      return acc;
    }, {}),

    stdDocs: docStd,
    docs:    docCustom,
    tasks: [], letters: [], attendance: [],
  };
}

/* Pull a fixed allowance amount out of the modal's salaryHeads by name. */
function fixedHeadAmount(payload, name) {
  const h = (payload.salaryHeads || []).find(x => x.name === name);
  return Number(h?.amount) || 0;
}

/* The shared employment/salary JSON body (update-employee-employment and
   update-employee-salary take the same shape). Free-text UI fields that the API
   wants as ids fall back to the same defaults the Launch Setup staff form uses. */
function buildEmploymentBody(payload, { branchID, userID, employeeId }) {
  const now = new Date().toISOString();
  return {
    id:                 employeeId,
    cnic:               payload.cnic ?? '',
    firstName:          payload.firstName ?? '',
    lastName:           payload.lastName ?? '',
    fatherName:         payload.fn ?? '',
    gender:             payload.gender ?? '',
    maritalStatus:      payload.marital ?? '',
    countryID:          idOr(payload.countryID ?? payload.country, 4),
    provinceID:         idOr(payload.provinceID ?? payload.province, 13),
    cityID:             idOr(payload.cityID ?? payload.city, 20),
    address:            payload.address ?? '',
    phone:              payload.phone ?? '',
    branchID,
    dateOfBirth:        payload.dob || now,
    dateOfJoining:      payload.join || now,
    experience:         String(payload.exp ?? ''),   // API binds this as a string
    bloodGroup:         payload.blood ?? '',
    departmentID:       Number(payload.dId) || 0,
    designationID:      Number(payload.desId) || 0,
    qualificationID:    idOr(payload.qualificationID, 0) || 0,
    empImage:           typeof payload.photo === 'string' && /^https?:/i.test(payload.photo) ? payload.photo : '',
    basicSalary:        Number(payload.basicSalary) || 0,
    medicalAllowanace:  fixedHeadAmount(payload, 'Medical Allowance'),
    rentAllowance:      fixedHeadAmount(payload, 'Rent Allowance'),
    transportAllowance: fixedHeadAmount(payload, 'Transport Allowance'),
    paymentMethod:      payload.payMethod ?? '',
    bankName:           payload.bankName ?? '',
    accountNumber:      payload.bankAcc ?? '',
    isPrinciple:        !!payload.isPrinciple,
    isTeacher:          payload.isPrinciple ? false : true,
    isParent:           !!payload.isParent,
    email:              payload.email ?? '',
    createdAt:          now,
    createdBy:          userID,
    modifiedAt:         now,
    modifiedBy:         userID,
    isActive:           true,
    departmentName:     'string',
    designationName:    'string',
    qualificationName:  'string',
  };
}

/* Create (id 0) or update a single custom salary head.
   POST /api/HR/save-salary-head — isAllowance flags allowance vs deduction. */
export async function saveHrSalaryHead({ id = 0, employeeID, headName, amount, isAllowance = true }) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const res  = await fetch(buildUrl('/api/HR/save-salary-head'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: Number(id) || 0,
      employeeID: Number(employeeID) || 0,
      branchID,
      headName: headName ?? '',
      amount: Number(amount) || 0,
      isAllowance: !!isAllowance,
      createdBy: userID,
      modifiedBy: userID,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save salary head');
  return json;
}

/* Upload (or auto-replace) one employee document. Same employeeId + documentType
   replaces the previous file on the backend — no delete step needed. documentType
   is one of HR_EMP_DOC_TYPES for the fixed cards, or any free-text "Other" name. */
export async function uploadHrEmployeeDocument({ employeeId, documentType, file }) {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  const fd = new FormData();
  fd.append('employeeId',   employeeId ?? 0);
  fd.append('branchId',     branchId);
  fd.append('documentType', documentType || '');
  fd.append('DocumentFile', file);
  const res  = await fetch(buildUrl('/api/HR/upload-employee-document'), {
    method: 'POST', headers: { Accept: '*/*' }, body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not upload document');
  return json?.data ?? json;
}

/* DELETE /api/HR/delete-employee-document/{id}. */
export async function deleteHrEmployeeDocument(documentId) {
  const res  = await fetch(buildUrl(`/api/HR/delete-employee-document/${documentId || 0}`), {
    method: 'DELETE', headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not delete document');
  return json;
}

/* DELETE /api/HR/delete-salary-head/{id}. */
export async function deleteHrSalaryHead(id) {
  const res  = await fetch(buildUrl(`/api/HR/delete-salary-head/${id || 0}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not delete salary head');
  return json;
}

/* Add / update an employee — mirrors the Launch Setup staff flow:
   1) POST save-employee (multipart, personal + all base fields) → employee id
   2) PUT update-employee-employment (official details)
   3) PUT update-employee-salary   (basic + the 3 fixed allowances)
   4) custom salary heads via the /api/HR/*-salary-head endpoints.
   payload.removedHeadIds carries custom heads the user removed while editing. */
export async function saveHrEmployee(payload = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const now      = new Date().toISOString();

  /* ── 1. Personal / base record (save-employee, multipart) ── */
  const fd  = new FormData();
  const set = (k, v) => fd.append(k, v == null ? '' : v);
  set('ID',                 payload.id ?? 0);
  set('CNIC',               payload.cnic);
  set('FirstName',          payload.firstName);
  set('LastName',           payload.lastName);
  set('FatherName',         payload.fn);
  set('Gender',             payload.gender);
  set('MaritalStatus',      payload.marital || 'N/A');
  set('CountryID',          idOr(payload.countryID ?? payload.country, 4));
  set('ProvinceID',         idOr(payload.provinceID ?? payload.province, 13));
  set('CityID',             idOr(payload.cityID ?? payload.city, 20));
  set('Address',            payload.address);
  set('Phone',              payload.phone);
  set('BranchID',           branchID);
  set('DateOfBirth',        payload.dob || now);
  set('DateOfJoining',      payload.join || '');
  set('experience',         toInt(payload.exp));
  set('Email',              payload.email || 'N/A');
  set('EmpImage',           typeof payload.photo === 'string' && /^https?:/i.test(payload.photo) ? payload.photo : 'N/A');
  set('BloodGroup',         payload.blood || 'N/A');
  set('DepartmentID',       Number(payload.dId) || 0);
  set('DesignationID',      Number(payload.desId) || 0);
  set('QualificationID',    idOr(payload.qualificationID, 0) || 0);
  set('BasicSalary',        Number(payload.basicSalary) || 0);
  set('MedicalAllowanace',  fixedHeadAmount(payload, 'Medical Allowance'));
  set('RentAllowance',      fixedHeadAmount(payload, 'Rent Allowance'));
  set('TransportAllowance', fixedHeadAmount(payload, 'Transport Allowance'));
  set('PaymentMethod',      payload.payMethod);
  set('BankName',           payload.bankName);
  set('AccountNumber',      payload.bankAcc);
  set('IsPrinciple',        !!payload.isPrinciple);
  set('IsTeacher',          payload.isPrinciple ? false : true);
  set('IsParent',           !!payload.isParent);
  set('CreatedAt',          now);
  set('CreatedBy',          userID);
  set('ModifiedAt',         now);
  set('ModifiedBy',         userID);
  set('IsActive',           true);
  set('DepartmentName',     'test');
  set('DesignationName',    'test');
  set('QualificationName',  'test');
  if (payload.photoFile) fd.append('EmpImageFile', payload.photoFile);

  const res1  = await fetch(buildUrl('/api/LaunchSetup/save-employee'), {
    method: 'POST', headers: { Accept: '*/*' }, body: fd,
  });
  const json1 = await res1.json().catch(() => null);
  if (!res1.ok) throw new Error(apiMessage(json1) || 'Could not save employee');

  const d = json1?.data;
  const employeeId =
    (Array.isArray(d) ? (d[0]?.id ?? d[0]?.ID) : (d?.id ?? d?.ID)) ??
    payload.id ?? 0;

  /* ── 2 + 3. Official details, then salary (same body shape) ── */
  const body = buildEmploymentBody(payload, { branchID, userID, employeeId });
  const putJson = async (path) => {
    const res = await fetch(buildUrl(path), {
      method: 'PUT',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // These endpoints sometimes return a non-JSON body on success; only treat a
    // real HTTP error as fatal so the flow can continue to the next step.
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(apiMessage(j) || 'Could not update employee details');
    }
  };
  await putJson('/api/LaunchSetup/update-employee-employment');
  await putJson('/api/LaunchSetup/update-employee-salary');

  /* ── 4. Custom salary heads (non-fixed) via the HR endpoints ── */
  for (const id of (payload.removedHeadIds || [])) {
    if (id) { try { await deleteHrSalaryHead(id); } catch (e) { /* surfaced by caller reload */ } }
  }
  for (const h of (payload.salaryHeads || [])) {
    if (h.fixed) continue;
    if (!h.name || !h.name.trim()) continue;
    await saveHrSalaryHead({
      id: h.id || 0,
      employeeID: employeeId,
      headName: h.name.trim(),
      amount: Number(h.amount) || 0,
      isAllowance: h.type !== 'deduct',
    });
  }

  /* ── 5. Leave settings (own endpoint; id from the fetched record for updates) ── */
  if (payload.leaves) {
    await saveHrLeaveSettings({
      id: payload.leaves._leaveId || 0,
      employeeID: employeeId,
      leaves: payload.leaves,
    });
  }

  /* ── 6. Documents — delete removed, then upload/replace picked files ── */
  for (const id of (payload.removedDocIds || [])) {
    if (id) { try { await deleteHrEmployeeDocument(id); } catch (e) { /* surfaced by reload */ } }
  }
  for (const doc of (payload.docUploads || [])) {
    if (doc?.file && doc?.documentType) {
      try { await uploadHrEmployeeDocument({ employeeId, documentType: doc.documentType, file: doc.file }); }
      catch (e) { /* surfaced by reload */ }
    }
  }

  /* ── 7. Subject assignments — toggle only what changed since open ── */
  await syncSubjectAssignments(employeeId, payload.subjects || {}, payload.subjectsOriginal || {}, branchID);

  return { id: employeeId };
}

/* One subject assignment toggle (assign when isChecked, unassign otherwise). */
export async function toggleHrSubjectAssignment({ employeeId, gradeId, sectionId, subjectId, isChecked, subjectName = '', className = '', sectionName = '' }) {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const now      = new Date().toISOString();
  const res  = await fetch(buildUrl('/api/LaunchSetup/toggle-Employees_Subjects_Assignments'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 0,
      employeId:  Number(employeeId) || 0,
      gradeId:    Number(gradeId) || 0,
      sectionId:  Number(sectionId) || 0,
      subjectId:  Number(subjectId) || 0,
      branchId,
      createdBy:  userID,
      createdAt:  now,
      modifiedBy: userID,
      modifiedAt: now,
      isChecked:  !!isChecked,
      subjectName, className, sectionName,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not update subject assignment');
  return json;
}

/* Diff desired vs original subject maps ({ "gradeId_sectionId": [subjectId] })
   and fire a toggle for each add/remove. */
async function syncSubjectAssignments(employeeId, desired = {}, original = {}, branchID) {
  const toToggle = [];
  const parse = (key) => key.split('_').map(Number);
  Object.keys(desired).forEach(key => {
    const [gradeId, sectionId] = parse(key);
    (desired[key] || []).forEach(subjectId => {
      if (!(original[key] || []).includes(subjectId)) toToggle.push({ gradeId, sectionId, subjectId, isChecked: true });
    });
  });
  Object.keys(original).forEach(key => {
    const [gradeId, sectionId] = parse(key);
    (original[key] || []).forEach(subjectId => {
      if (!(desired[key] || []).includes(subjectId)) toToggle.push({ gradeId, sectionId, subjectId, isChecked: false });
    });
  });
  for (const t of toToggle) {
    try { await toggleHrSubjectAssignment({ employeeId, ...t }); } catch (e) { /* surfaced by reload */ }
  }
}
export async function deleteHrEmployee({ id }) {
  const res  = await fetch(buildUrl(`/api/LaunchSetup/delete-employee/${id}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not mark employee inactive');
  return json;
}

/* ─── HR Module — Payroll (Step 5) ─── */
export async function getHrPayroll()           { await delay(); return clone(mockHrPayroll); }
export async function getHrNextPayrollId()     { await delay(); return mockHrNextPayrollId; }
export async function saveHrPayrollRun(run)    { await delay(); return clone({ ...run, ok: true }); }
export async function deleteHrPayrollRun({ id }){ await delay(); return { id, deleted: true }; }
export async function markHrPayrollPaid(p)     { await delay(); return clone({ ...p, ok: true }); }

/* ─── HR Module — Letters (Step 7) ─── */
export async function saveHrLetter(payload)    { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteHrLetter({ empId, letterId }) { await delay(); return { empId, letterId, deleted: true }; }