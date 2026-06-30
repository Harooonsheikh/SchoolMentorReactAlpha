import {
  mockStudents,
  mockStudentStats,
  mockRecentAdmissions,
  mockStuInactive,
  mockStuFamilies,
  mockStuInactiveReasons,
  mockStuSchool,
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

/* Map one backend student record into the flat shape the UI reads. */
function mapStudent(st) {
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
    gender:   pick(st, 'gander', 'gender'),
    dob:      pick(st, 'dateOfBirth', 'dob'),
    mobile:   pick(st, 'mobileNo', 'mobile'),
    email:    pick(st, 'email'),
    address:  pick(st, 'postalAddress', 'permanentAddesss', 'permanentAddress', 'address'),
    nat:      pick(st, 'nationality') || 'Pakistani',
    bform:    pick(st, 'bFormNo', 'bform'),
    family:   String(pick(st, 'familyNo') || ''),
    admdate:  pick(st, 'dateOfAdmission', 'admdate'),
    pschool:  pick(st, 'previousSchoolName'),
    pgrade:   pick(st, 'previousSchoolPreviousGrade'),
    pcontact: pick(st, 'previousSchoolContactNo'),
    photo:    pick(st, 'picture') || null,
    isActive: st?.isActive !== false,
    _disc:    {},
    stdDocs:  {},
    docs:     [],
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
export async function getStuInactive()        { await delay(); return clone(mockStuInactive); }
export async function getStuFamilies()        { await delay(); return clone(mockStuFamilies); }
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
export async function getStuSchool()          { await delay(); return clone(mockStuSchool); }
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
  set('Picture',                     '');
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
  return json;
}
export async function deleteStuStudent({ reg }) { await delay(); return { reg, deleted: true }; }
export async function promoteStuStudents(payload) { await delay(); return clone({ ...payload, ok: true }); }
export async function inactivateStuStudent(payload) { await delay(); return clone({ ...payload, ok: true }); }
export async function reactivateStuStudent({ reg }) { await delay(); return { reg, reactivated: true }; }
export async function settleStuDues(payload)    { await delay(); return clone({ ...payload, ok: true }); }
export async function saveStuFamily(payload)    { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteStuFamily({ id })   { await delay(); return { id, deleted: true }; }
