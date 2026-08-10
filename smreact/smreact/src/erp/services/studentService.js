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
import { buildUrl, apiMessage, resolveMediaUrl } from '../../utils/apiConfig';

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

/* Uploaded file (picture / document) ka URL browser ke qabil banao.

   Backend absolute URL bhejta hai, magar host WOHI hota hai jahan wo khud chal
   raha hota hai — is liye records me "http://localhost:4100/UploadedDocuments/…"
   aa jata hai. User ke browser me wo localhost user ka apna computer hai, jahan
   koi server nahi — image chup-chaap load hone me nakaam ho jati hai aur screen
   par kuch nahi aata. Aise loopback URLs ko configured API base par dobara joad
   dete hain; baqi (sahi host ya data:) jaise hain waise rehte hain. */
export function stuFileUrl(u) {
  const v = String(u || '').trim();
  if (/^blob:/i.test(v)) return v;          // just-picked local file, not from the API
  /* Rewriting a loopback URL onto the API base is not enough: the app's own
     origin does not serve /UploadedImages or /UploadedDocuments (they fall
     through to the SPA and come back as index.html). resolveMediaUrl puts them
     on the media host, the same way branch logos are handled. */
  return resolveMediaUrl(v);
}

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
    const path = stuFileUrl(pick(d, 'documentPath', 'path') || '');
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
    photo:    stuFileUrl(pick(st, 'picture')) || null,
    isActive: st?.isActive !== false,
    reason:   pick(st, 'inactiveReason', 'reason'),   // struck-off reason (Inactive tab)
    /* Kab inactive kiya gaya. Backend "2026-07-31 12:52:14" bhejta hai; sirf
       tareekh rakhte hain. `createdAt` ISKE liye ghalat field hai — wo record
       banne ki tareekh hai (student pehle admit hota hai, inactive baad me
       hota hai). Na mile to khali — report me `—` dikhega. */
    inactiveDate: dateOnly(pick(st, 'inactiveDate', 'inActiveDate', 'dateOfInactive')) || '',
    /* Fee discounts alag API me rehti hain (Fee module wali) — yahan khali
       shuru hoti hain aur fetchClassSectionStudents() unhein bhar deta hai. */
    _disc:    {},
    stdDocs,
    docs,
    _raw:     st,
  };
}

/* ─── FEE DISCOUNTS ───────────────────────────────────────────────────
   Student ke discounts student record ke saath NAHI aate; Fee module ki
   apni API se aate hain:
     GET /api/Student/get-fee-discounts-by-grade/{branchId}/{gradeId}
     → data: [ { id, gradeID, sectionID, headID, headName, discountAmount,
                 studentID, studentName, isActive } ]
   Isi liye Students tab ka "Fee Discounts" card hamesha 0 dikhata tha aur
   students par red-corner nishan bhi nahi aata tha — record me `_disc`
   khali reh jata tha.

   Per-student wali route (get-fee-discounts-by-student) yahan mehanga
   parti — har student par ek call. By-grade se ek class ki saari discounts
   ek hi call me aa jati hain. */
async function fetchGradeDiscounts(gradeId) {
  const branchID = sessionStorage.getItem('branchID') || 0;
  try {
    const res  = await fetch(buildUrl(`/api/Student/get-fee-discounts-by-grade/${branchID}/${gradeId}`), {
      headers: { Accept: '*/*' },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    return Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  } catch {
    return [];                 // discounts best-effort — student list phir bhi chale
  }
}

/**
 * Diye gaye grades ki saari fee discounts → { [studentID]: { [headName]: amount } }
 * (wahi shape jo UI ka `_disc` istemal karta hai: head ke naam par raqam).
 */
export async function getStuDiscountMap(gradeIds = []) {
  const ids = [...new Set(gradeIds.filter(Boolean).map(Number))];
  if (!ids.length) return {};
  const lists = await Promise.all(ids.map(fetchGradeDiscounts));
  const map = {};
  lists.flat().forEach(r => {
    if (r?.isActive === false) return;                 // hataayi hui discount
    const sid    = String(pick(r, 'studentID', 'studentId', 'applicantsID') || '');
    const amount = Number(pick(r, 'discountAmount', 'amount') || 0);
    const head   = String(pick(r, 'headName', 'feeHeadName', 'head') || '').trim();
    if (!sid || !head || !(amount > 0)) return;
    if (!map[sid]) map[sid] = {};
    map[sid][head] = (map[sid][head] || 0) + amount;    // ek head par ek se ziyada rows
  });
  return map;
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

  /* Har class ki fee discounts (Fee module ki API) laa kar students par chipka
     do — ek call per grade, sab parallel. Isi se "Fee Discounts" KPI, student
     par red-corner nishan, class report ka ✓ column aur edit modal ka Fee tab
     sab khud-ba-khud sahi ho jate hain. Discount API fail ho to student list
     phir bhi normal chalti hai (bas discounts khali). */
  const discMap = await getStuDiscountMap(rows.map(r => r._gradeId));
  if (Object.keys(discMap).length) {
    rows.forEach(r => {
      r.students = r.students.map(st => {
        const d = discMap[String(st._id)];
        return d ? { ...st, _disc: d } : st;
      });
    });
  }
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
    photo:      stuFileUrl(pick(s, 'picture')) || null,
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

/* Grades (classes) in the SCHOOL'S proper sequence, each with its own sections —
   Promote modal ke "To Class" (sahi order) aur "To Section" (usi class ke against)
   ke liye. GET /api/LaunchSetup/get-grades-by-branch/{branchID}. */
export async function getStuGrades() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load classes');
  const rows = Array.isArray(json?.data) ? json.data : [];
  /* School ki apni tarteeb `orderBy` me hai (Nursery → Prep → 1 → 2 …), naam ki
     alphabetical tarteeb me NAHI. Launch Setup (src/tabs/ClassesTab.jsx) bhi
     isi field par sort karta hai — wahi yahan bhi, taake har jagah classes ek
     hi tarteeb me dikhein. orderBy barabar ho to API ka apna order chalta hai. */
  return rows
    .map((g, i) => ({
      id:      Number(g.id ?? g.gradeID ?? g.gradeId ?? 0),
      name:    g.name ?? g.gradeName ?? g.className ?? '—',
      orderBy: Number(g.orderBy ?? 0) || 0,
      _i:      i,
      sections: (Array.isArray(g.sections) ? g.sections : []).map(s => ({
        id:   Number(s.sectionID ?? s.id ?? s.sectionId ?? 0),
        name: s.sectionName ?? s.name ?? '—',
      })),
    }))
    .sort((a, b) => a.orderBy - b.orderBy || a._i - b._i)
    .map(({ _i, ...g }) => g);
}

/* Branch ka ACTIVE academic session (read-only display ke liye) — session yahin
   se aata hai, change sirf Settings me hota hai.
   GET /api/Setting/get-academic-active-sessions-by-branch/{branchID}. */
export async function getStuActiveSession() {
  const branchID = sessionStorage.getItem('branchID') || 0;
  try {
    const res  = await fetch(buildUrl(`/api/Setting/get-academic-active-sessions-by-branch/${branchID}`), {
      headers: { Accept: '*/*' },
    });
    const json = await res.json().catch(() => null);
    const first = Array.isArray(json?.data) ? json.data[0] : null;
    return {
      id:   Number(first?.ID ?? first?.id ?? sessionStorage.getItem('sessionID') ?? 0) || 0,
      name: first?.SessionName ?? first?.sessionName ?? sessionStorage.getItem('sessionName') ?? '',
    };
  } catch (e) {
    return { id: Number(sessionStorage.getItem('sessionID')) || 0, name: sessionStorage.getItem('sessionName') || '' };
  }
}

/* Promote ONE student to a new class/section. isCarryForward=true → agar from-class aur
   to-class ke fee-heads ka number same ho to us student ke discounts/financial settings bhi
   move ho jate hain; false → sirf student move hota hai (backend ye logic handle karta hai).
   POST /api/Student/promote-student. */
export async function promoteStuStudent({ studentID, oldGradeID, oldSectionID, newGradeID, newSectionID, sessionYearID, isCarryForward } = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const now      = new Date().toISOString();
  const body = {
    id:            0,
    branchID,
    oldGradeID:    Number(oldGradeID) || 0,
    oldSectionID:  Number(oldSectionID) || 0,
    newGradeID:    Number(newGradeID) || 0,
    newSectionID:  Number(newSectionID) || 0,
    studentID:     Number(studentID) || 0,
    sessionYearID: Number(sessionYearID) || 0,
    isActive:      false,                 // promotion record: hamesha false
    isCarryForward: !!isCarryForward,     // checkbox: unchecked → false, checked → true
    createdBy:     userID,
    createdAt:     now,
    modifiedBy:    userID,
    modifiedAt:    now,
  };
  const res  = await fetch(buildUrl('/api/Student/promote-student'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not promote student');
  return json;
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
  // Serve the logo from the https media host regardless of what host the API
  // stamped on it (IP:4100 / app origin), so it isn't blocked as mixed content
  // and doesn't resolve to the app origin. (resolveMediaUrl stuFileUrl se ziyada
  // mukammal hai: mixed-content aur app-origin dono soorton ko sambhalta hai.)
  return resolveMediaUrl(raw);
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
