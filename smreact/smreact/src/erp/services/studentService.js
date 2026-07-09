import {
  mockStudents,
  mockStudentStats,
  mockRecentAdmissions,
  mockStuInactive,
  mockStuInactiveReasons,
  mockStuNextReg,
  mockStuNextAdm,
  mockStuNextFamId,
} from '../mock/students';
import { delay, clone } from './_http';
import { buildUrl, apiMessage } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   Students Module — real API wiring (LaunchSetup).

   The backend returns grades → sections → students nested, while the
   Students UI works off a flat list of class+section rows that wrap
   their students inline ({ key, cls, sec, students:[…] }). We fetch
   once and project the nested response into that shape, keeping the
   real ids on `_gradeId` / `_sectionId` / `_id` so saves can target
   the right grade, section and record. branchID comes from
   sessionStorage (set at login), same convention as the Launch Setup
   Classes/Students tabs.
   ═══════════════════════════════════════════════════════════════════ */
const pick = (obj, ...keys) => {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  return '';
};

/* Normalize a backend date/datetime to the `yyyy-MM-dd` that <input type="date">
   requires — the API returns full ISO strings ("2010-05-03T00:00:00"), which the
   date input silently rejects (renders blank), breaking edit pre-fill. */
const dateOnly = (v) => {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
};

/* Standard document slots ↔ backend `documentType` strings. The UI keys its
   five fixed document cards by these short keys; the backend stores/returns the
   PascalCase names on the right. Anything else counts as a custom ("Other")
   document and is surfaced by its raw type name. */
export const STU_DOC_TYPES = {
  bform:    'BForm',
  fcnic:    'FatherCNIC',
  mcnic:    'MotherCNIC',
  prevcert: 'PreviousSchoolCertificate',
  birth:    'BirthCertificate',
};
const DOC_TYPE_TO_KEY = Object.fromEntries(
  Object.entries(STU_DOC_TYPES).map(([key, type]) => [type, key]),
);

/* Split a student's backend `documents[]` into the two shapes the UI reads:
   `stdDocs` — a map keyed by the fixed slot key ({ bform: { id, path }, … })
   `docs`    — the leftover custom documents ([{ id, name, path }, …]).
   Both are truthy-safe: the modal/profile just check `stdDocs[key]`. */
function mapStudentDocuments(list) {
  const stdDocs = {};
  const docs = [];
  (Array.isArray(list) ? list : []).forEach(d => {
    const id   = pick(d, 'id', 'documentID', 'documentId') || 0;
    const type = pick(d, 'documentType');
    const path = pick(d, 'documentPath', 'path') || '';
    const key  = DOC_TYPE_TO_KEY[type];
    if (key) stdDocs[key] = { id, path, type };
    else if (type) docs.push({ id, name: type, path });
  });
  return { stdDocs, docs };
}

/* Map one backend student record into the flat shape the UI reads. */
function mapStudent(st) {
  const { stdDocs, docs } = mapStudentDocuments(st?.documents);
  return {
    _id:      pick(st, 'id', 'studentID', 'studentId') || 0,
    reg:      String(pick(st, 'registerNo', 'regNo', 'registrationNo') || ''),
    adm:      String(pick(st, 'admissionNo', 'previousAdmissionNo') || ''),
    first:    pick(st, 'firstName', 'name'),
    last:     pick(st, 'lastName'),
    father:   pick(st, 'fatherName'),
    fcnic:    pick(st, 'fatherCnic'),
    focc:     pick(st, 'fatherOccupation'),
    mother:   pick(st, 'motherName'),
    mcnic:    pick(st, 'motherCnic'),
    guardian: pick(st, 'guardianName'),
    gcontact: pick(st, 'guardianContact', 'emergencyContact'),
    gender:   pick(st, 'gander', 'gender'),
    dob:      dateOnly(pick(st, 'dateOfBirth', 'dob')),
    mobile:   pick(st, 'mobileNo', 'mobile'),
    email:    pick(st, 'email'),
    address:  pick(st, 'postalAddress', 'permanentAddesss', 'permanentAddress', 'address'),
    nat:      pick(st, 'nationality') || 'Pakistani',
    bform:    pick(st, 'bFormNo', 'bform'),
    family:   String(pick(st, 'familyNo') || ''),
    admdate:  dateOnly(pick(st, 'dateOfAdmission', 'admdate')),
    pschool:  pick(st, 'previousSchoolName'),
    pgrade:   pick(st, 'previousSchoolPreviousGrade'),
    pcontact: pick(st, 'previousSchoolContactNo'),
    photo:    pick(st, 'picture') || null,
    isActive: st?.isActive !== false,
    reason:   pick(st, 'inactiveReason', 'reason'),   // struck-off reason (Inactive tab)
    _disc:    {},
    stdDocs,
    docs,
    _raw:     st,
  };
}

/* Fetch grades → sections → students and flatten to class+section rows. */
async function fetchClassSectionStudents() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-class-section-studentlist-by-branch/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load students');
  const grades = Array.isArray(json?.data) ? json.data : [];

  const rows = [];
  grades.forEach(g => {
    const gradeId   = pick(g, 'id', 'gradeID', 'gradeId') || 0;
    const gradeName = pick(g, 'name', 'gradeName', 'className') || '—';
    const sections  = Array.isArray(g.sections) ? g.sections : [];
    sections.forEach(s => {
      const sectionId   = pick(s, 'sectionID', 'id', 'sectionId') || 0;
      const sectionName = pick(s, 'sectionName', 'name') || '—';
      const students    = (Array.isArray(s.students) ? s.students : [])
        .map(mapStudent)
        .filter(st => st.isActive);
      rows.push({
        key:        `g${gradeId}-s${sectionId}`,
        cls:        gradeName,
        sec:        sectionName,
        trend:      'flat',
        _gradeId:   gradeId,
        _sectionId: sectionId,
        students,
      });
    });
  });
  return rows;
}

/* Wahi class-section API — magr INACTIVE students ka FLAT list (har student par
   cls/sec set) — taake Inactive tab bhi Active jaisा class-wise (class ke against
   students) dikha sake. */
async function fetchInactiveStudents() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  // Dedicated inactive list — same nested grades→sections→students shape as the
  // active call, but the backend filters to isActive=false via the query param.
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-class-section-studentlist-by-branch/${branchID}?isActive=false`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load inactive students');
  const grades = Array.isArray(json?.data) ? json.data : [];

  const out = [];
  grades.forEach(g => {
    const gradeName = pick(g, 'name', 'gradeName', 'className') || '—';
    const sections  = Array.isArray(g.sections) ? g.sections : [];
    sections.forEach(s => {
      const sectionName = pick(s, 'sectionName', 'name') || '—';
      // Inactive tab = jinka isActive === false (Active tab ka ulta). Jab kisi student
      // ko "Mark Inactive" kiya jaye (isActive false) to woh yahan class-wise dikhega.
      (Array.isArray(s.students) ? s.students : [])
        .map(mapStudent)
        .filter(st => !st.isActive)
        .forEach(st => out.push({ ...st, cls: gradeName, sec: sectionName }));
    });
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   Family Tree — one action-based endpoint for the whole CRUD.
     POST /api/FamilyTree/familytreecrud
     body: { action: 'get'|'insert'|'update'|'delete', id, branchID,
             familyName, familyDetails, guardianName, contactNumber,
             email, createdBy, modifiedBy }
   'get' returns { data: [ { id, familyName, ..., students:[…] } ] };
   the embedded students become each family's linked members.
   ═══════════════════════════════════════════════════════════════════ */
const FAMILY_URL = '/api/FamilyTree/familytreecrud';

/* One embedded student record → the member shape the Family Tree UI reads. */
function mapFamilyMember(s) {
  return {
    detailID:   pick(s, 'detailID') || 0,
    _id:        pick(s, 'applicantsID', 'applicantsId', 'id') || 0,
    reg:        String(pick(s, 'registerNo', 'regNo') || ''),
    first:      pick(s, 'firstName', 'name'),
    last:       pick(s, 'lastName'),
    photo:      pick(s, 'picture') || null,
    _cls:       pick(s, 'className', 'gradeName') || '',
    _sec:       pick(s, 'sectionName') || '',
    _gradeId:   pick(s, 'gradeID', 'gradeId') || 0,
    _sectionId: pick(s, 'sectionID', 'sectionId') || 0,
    _raw:       s,
  };
}

/* One backend family record → the UI family shape (with members inline). */
function mapFamily(f) {
  return {
    id:       pick(f, 'id', 'ID') || 0,
    branchID: pick(f, 'branchID', 'branchId') || 0,
    name:     pick(f, 'familyName'),
    details:  pick(f, 'familyDetails'),
    guardian: pick(f, 'guardianName'),
    contact:  pick(f, 'contactNumber'),
    email:    pick(f, 'email'),
    created:  String(pick(f, 'createdAt', 'CreatedAt') || '').slice(0, 10),
    members:  (Array.isArray(f.students) ? f.students : []).map(mapFamilyMember),
    _raw:     f,
  };
}

/* POST the CRUD body; the caller supplies the action + fields. */
async function familyCrud(fields = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const body = {
    action:        'get',
    id:            0,
    branchID,
    familyName:    '',
    familyDetails: '',
    guardianName:  '',
    contactNumber: '',
    email:         '',
    createdBy:     userID,
    modifiedBy:    userID,
    ...fields,
  };
  const res  = await fetch(buildUrl(FAMILY_URL), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Family tree request failed');
  return json;
}

/* action:get → mapped family rows (with embedded members). */
async function fetchFamilies() {
  const json = await familyCrud({ action: 'get' });
  const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  return rows.map(mapFamily);
}

/* ─── Family Tree DETAIL (student ↔ family links) ───
   POST /api/FamilyTree/familytreedetailcrud
     body: { action, id, treeID, branchID, applicantsID, gradeID, sectionID, createdBy }
   insert → link a student to a family (treeID = family id, applicantsID = student id);
   delete → remove a link by its detail id. */
async function familyDetailCrud(fields = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const body = {
    action:       'insert',
    id:           0,
    treeID:       0,
    branchID,
    applicantsID: 0,
    gradeID:      0,
    sectionID:    0,
    createdBy:    userID,
    ...fields,
  };
  const res  = await fetch(buildUrl('/api/FamilyTree/familytreedetailcrud'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Family link request failed');
  return json;
}

/* Link a student to a family (Active Students → "Add Student to Family Tree"). */
export async function linkStuToFamily({ treeID, applicantsID, gradeID, sectionID } = {}) {
  return familyDetailCrud({
    action:       'insert',
    id:           0,
    treeID:       Number(treeID) || 0,
    applicantsID: Number(applicantsID) || 0,
    gradeID:      Number(gradeID) || 0,
    sectionID:    Number(sectionID) || 0,
  });
}

/* Unlink a student from a family by its detail id (Family Tree → Unlink). */
export async function unlinkStuFromFamily({ id } = {}) {
  return familyDetailCrud({ action: 'delete', id: Number(id) || 0 });
}

/* ─── Legacy APIs (Dashboard, etc.) — kept unchanged ─── */
export async function getRecentAdmissions() { await delay(); return clone(mockRecentAdmissions); }
export async function getStudents()         { await delay(); return clone(mockStudents); }
export async function getStudentStats()     { await delay(); return clone(mockStudentStats); }
export async function getStudentById(id)    {
  await delay();
  const found = mockStudents.find(s => s.id === id);
  return found ? clone(found) : null;
}

/* ─── Students Module APIs ─── */
export async function getStuClasses() { return fetchClassSectionStudents(); }
export async function getStuInactive()        { return fetchInactiveStudents(); }
export async function getStuFamilies()        { return fetchFamilies(); }
/* Class names for the Add/Edit dropdown — derived from the loaded rows
   so the option labels exactly match the class+section data. */
export async function getStuClassList() {
  const rows = await fetchClassSectionStudents();
  return [...new Set(rows.map(r => r.cls))];
}
export async function getStuSectionList() {
  const rows = await fetchClassSectionStudents();
  return [...new Set(rows.map(r => r.sec))];
}
/* Fee heads for a single grade — the per-class fee structure shown in
   the student's Fee Details tab. */
export async function getStuFeeHeads(gradeId) {
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
    name:   h.headName ?? h.name ?? '',
    amount: Number(h.amount) || 0,
    freq:   h.frequency ?? '',
  }));
}
export async function getStuInactiveReasons() { await delay(); return clone(mockStuInactiveReasons); }

/* Branch staff — used to auto-fill certificate signatures: the Principal
   (isPrinciple) and the teacher assigned to a given class/section.
   GET /api/LaunchSetup/get-employees-by-branch/{branchID}. */
export async function getStuStaff() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load staff');
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(e => ({
    id:          pick(e, 'id') || 0,
    name:        `${pick(e, 'firstName')} ${pick(e, 'lastName')}`.trim(),
    designation: pick(e, 'designationName', 'designation'),
    isPrinciple: e?.isPrinciple === true,
    isTeacher:   e?.isTeacher === true,
    assignments: (Array.isArray(e.assignments) ? e.assignments : []).map(a => ({
      gradeId:   pick(a, 'gradeId', 'gradeID') || 0,
      sectionId: pick(a, 'sectionId', 'sectionID') || 0,
    })),
  }));
}

/* Resolve a branch logo to an absolute URL usable inside a print window
   (data URIs / absolute URLs pass through; relative paths get the API base). */
function branchLogoUrl(raw) {
  if (!raw) return '';
  if (/^(https?:|data:)/i.test(raw)) return raw;
  return buildUrl(raw.startsWith('/') ? raw : `/${raw}`);
}

/* School/branch identity used by EVERY student report (ID cards, certificates,
   profile PDFs, class/inactive/family reports). Real branch details from
   GET /api/Registration/get-branch/{branchID} — name, address, logo, created. */
export async function getStuSchool() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/Registration/get-branch/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load branch details');
  const d = json?.data || json || {};
  const name    = pick(d, 'name', 'branchName') || 'School';
  const address = [pick(d, 'address'), pick(d, 'landmark')].filter(Boolean).join(', ');
  const monogram = name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'SM';
  return {
    id:       pick(d, 'id', 'ID') || 0,
    name,
    campus:   pick(d, 'branchName', 'branchCode') || 'Main Campus',
    monogram,
    address,
    phone:    pick(d, 'branchPhone', 'phone'),
    email:    pick(d, 'branchEmail1', 'email'),
    logo:     branchLogoUrl(pick(d, 'branchLogo', 'logo')),
    session:  pick(d, 'academicSession'),
    created:  String(pick(d, 'createdAt', 'CreatedAt') || '').slice(0, 10),
    _raw:     d,
  };
}
export async function getStuNextReg()         { await delay(); return mockStuNextReg; }
export async function getStuNextAdm()         { await delay(); return mockStuNextAdm; }
export async function getStuNextFamId()       { await delay(); return mockStuNextFamId; }

/* ─── Write APIs ─── */
/* Create / update a student. The backend expects multipart FormData
   (so a photo file can ride along); the caller passes a plain object
   and we marshal it here. id 0 = add, id > 0 = update. */
export async function saveStuStudent(p = {}) {
  const userID = Number(sessionStorage.getItem('UserID')) || 0;
  const now    = new Date().toISOString();
  const fd     = new FormData();
  const set = (k, v) => fd.append(k, v == null ? '' : v);

  set('ID',                          p.id ?? 0);
  set('GradeId',                     p.gradeId ?? 0);
  set('SectionId',                   p.sectionId ?? 0);
  set('BranchId',                    Number(sessionStorage.getItem('branchID')) || 0);
  set('RegisterNo',                  p.reg);
  set('PreviousRegistrationNo',      p.prevReg);
  set('FamilyNo',                    p.family);
  set('DateOfAdmission',             p.admdate);
  set('FirstName',                   p.first);
  set('LastName',                    p.last);
  set('FirstNameInUrdu',             '');
  set('LastNameInUrdu',              '');
  set('FatherName',                  p.father);
  set('FatherCnic',                  p.fcnic);
  set('FatherQualification',         '');
  set('FatherOccupation',            p.focc);
  set('MotherName',                  p.mother);
  set('MotherCnic',                  p.mcnic);
  set('GuardianName',                p.guardian);
  set('GuardianContact',             p.gcontact);
  set('MotherQualification',         '');
  set('MotherOccupation',            '');
  set('Gander',                      p.gender);
  set('DateOfBirth',                 p.dob);
  set('Caste',                       '');
  set('Nationality',                 p.nat);
  set('PostalAddress',               p.address);
  set('PermanentAddesss',            p.address);
  set('MobileNo',                    p.mobile);
  set('MotherMobileNo',              '');
  set('Email',                       p.email);
  set('BFormNo',                     p.bform);
  set('MarksAdmissionTest',          '');
  set('TotalPreviousDues',           Number(p.dues) || 0);
  /* When a new file is posted the backend saves it via PictureFile and Picture
     stays empty; on an edit with no new file, echo the existing picture back so
     the save doesn't blank it. Never echo a base64 preview (data: URI). */
  set('Picture', p.pictureFile ? '' : (/^data:/i.test(p.photo || '') ? '' : (p.photo || '')));
  set('PreviousSchoolName',          p.pschool);
  set('PreviousSchoolFocalPerson',   '');
  set('PreviousSchoolContactNo',     p.pcontact);
  set('PreviousSchoolAddress',       '');
  set('PreviousAdmissionNo',         p.adm);
  set('PreviousSchoolPreviousGrade', p.pgrade);
  set('PreviousSchoolTestOfGrades',  '');
  set('BloodGroup',                  '');
  set('FoodAndDietaryReg',           '');
  set('AllergiesMajorIllness',       '');
  set('ConditionOfChild',            '');
  set('EmergencyContact',            p.gcontact);
  set('InactiveReason',              p.inactiveReason);
  set('InactiveDate',                p.inactiveDate);
  set('CreatedAt',                   now);
  set('CreatedBy',                   userID);
  set('ModifiedAt',                  now);
  set('ModifiedBy',                  userID);
  set('IsActive',                    true);
  if (p.pictureFile) fd.append('PictureFile', p.pictureFile);

  const res  = await fetch(buildUrl('/api/LaunchSetup/save-student'), {
    method: 'POST',
    headers: { Accept: '*/*' },
    body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save student');
  /* API HTTP 200 + top-level "…saved successfully" deta hai, magar ASLI natija
     `data` ke andar hota hai. Duplicate (e.g. reg/mobile) par kai shapes aa
     sakti hain:
        data: 0
        data: [{ Success: 0, Message: "Number already exist" }]
        data: { Success: 0, Message: "..." }
     In sab ko fail treat karo taake caller ka catch sahi error toast dikhaye. */
  const d = json?.data;
  const inner = Array.isArray(d) ? d[0] : (d && typeof d === 'object' ? d : null);
  const innerSuccess = inner ? (inner.Success ?? inner.success) : undefined;
  const isFail =
    innerSuccess === 0 || innerSuccess === false || innerSuccess === '0' ||
    d === 0 || d === '0';
  if (isFail) {
    const msg =
      (inner && (inner.Message ?? inner.message)) ||
      (json?.message && !/success/i.test(json.message) ? json.message : '') ||
      'Number already exist';
    throw new Error(msg);
  }
  return json;
}

/* Pull the (possibly newly-created) student id out of a save-student response —
   used to attach documents right after an add, before the list is reloaded. */
export function studentIdFromSaveResponse(json) {
  const d = json?.data ?? json;
  return Number(pick(d || {}, 'id', 'studentID', 'studentId', 'applicantsID')) || 0;
}

/* Upload/replace just the profile picture (standalone — no full-form resubmit).
   Re-calling for the same id replaces the old picture on the backend. Returns
   the new full picture URL. */
export async function uploadStuStudentPicture(studentId, file) {
  const fd = new FormData();
  fd.append('id', studentId ?? 0);
  fd.append('PictureFile', file);
  const res  = await fetch(buildUrl('/api/LaunchSetup/upload-student-picture'), {
    method: 'POST', headers: { Accept: '*/*' }, body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not upload picture');
  return json?.data?.picture ?? json?.data ?? null;
}

/* Upload (or auto-replace) one student document. Same studentId + documentType
   replaces the previous file on the backend — no separate delete needed.
   `documentType` is one of STU_DOC_TYPES for the fixed cards, or any free-text
   name for an "Other" document. Returns { id, studentId, documentType, documentPath }. */
export async function uploadStuStudentDocument({ studentId, branchId, gradeId, sectionId, documentType, file } = {}) {
  const fd = new FormData();
  fd.append('studentId',    studentId ?? 0);
  fd.append('branchId',     branchId ?? (Number(sessionStorage.getItem('branchID')) || 0));
  fd.append('gradeId',      gradeId ?? 0);
  fd.append('sectionId',    sectionId ?? 0);
  fd.append('documentType', documentType || '');
  fd.append('DocumentFile', file);
  const res  = await fetch(buildUrl('/api/LaunchSetup/upload-student-document'), {
    method: 'POST', headers: { Accept: '*/*' }, body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not upload document');
  return json?.data ?? json;
}

/* Delete one student document by its id. */
export async function deleteStuStudentDocument(documentId) {
  const res  = await fetch(buildUrl(`/api/LaunchSetup/delete-student-document/${documentId || 0}`), {
    method: 'DELETE', headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not delete document');
  return json;
}
/* Mark a student inactive (soft delete). The backend's delete-student endpoint
   flips isActive → false, so the student drops out of the active roster and
   shows up in the inactive list (get-...?isActive=false). The reason rides
   along as a query param. id 0 is a no-op. */
export async function markStuInactive(id, reason = '') {
  const qs   = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  const res  = await fetch(buildUrl(`/api/LaunchSetup/delete-student/${id || 0}${qs}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not mark student inactive');
  return json;
}

/* Restore a student (make active again). The backend's restore-student endpoint
   flips isActive → true, so the student returns to the active roster and leaves
   the inactive list. id 0 is a no-op. */
export async function restoreStuStudent(id) {
  const res  = await fetch(buildUrl(`/api/LaunchSetup/restore-student/${id || 0}`), {
    method: 'PUT',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not restore student');
  return json;
}
export async function deleteStuStudent({ reg }) { await delay(); return { reg, deleted: true }; }
export async function promoteStuStudents(payload) { await delay(); return clone({ ...payload, ok: true }); }
export async function inactivateStuStudent(payload) { await delay(); return clone({ ...payload, ok: true }); }
export async function reactivateStuStudent({ reg }) { await delay(); return { reg, reactivated: true }; }
export async function settleStuDues(payload)    { await delay(); return clone({ ...payload, ok: true }); }
/* Create (id 0 → action:insert) or update (id > 0 → action:update) a family.
   payload = { id, name, guardian, contact, email, details }. */
export async function saveStuFamily(payload = {}) {
  const id = Number(payload.id) || 0;
  return familyCrud({
    action:        id ? 'update' : 'insert',
    id,
    familyName:    payload.name     || '',
    familyDetails: payload.details  || '',
    guardianName:  payload.guardian || '',
    contactNumber: payload.contact  || '',
    email:         payload.email    || '',
  });
}
/* action:delete — remove a family by id (linked students are not deleted). */
export async function deleteStuFamily({ id } = {}) {
  return familyCrud({ action: 'delete', id: Number(id) || 0 });
}
