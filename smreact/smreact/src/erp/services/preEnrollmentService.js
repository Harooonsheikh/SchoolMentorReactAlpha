import { mockPreEnrollFeeHeads } from '../mock/preEnrollment';
import { delay, clone } from './_http';
import { buildUrl, apiMessage } from '../../utils/apiConfig';
import { stuFileUrl } from './studentService';

/* ═══════════════════════════════════════════════════════════════════
   Pre-Enrollment — real API wiring.

   Base URL yahan hardcode NAHI hota — baqi services ki tarah buildUrl()
   (utils/apiConfig) se aata hai:
     dev  → http://<api box>:4100
     prod → app ka apna origin (IIS web.config alphaapi ko proxy karta hai)
   Isi liye https://alphaapi.schoolmentor.ai seedha call karna prod me CORS
   se block ho jata — hamesha buildUrl() se jao.

   Endpoints (PreEnrollmentStudent controller):
     GET    get-class-section-prestudentlist-by-branch/{branchId}?isActive=
     POST   save-prestudent                 (multipart/form-data, ID 0 = add)
     DELETE delete-prestudent/{id}?reason=  (soft delete → isActive=false)
     PUT    restore-prestudent/{id}
     DELETE delete-prestudent-permanent/{id}

   branchID sessionStorage se aata hai (login par set), same convention jo
   studentService me hai.

   Abhi MOCK: fee heads, challan, receiving — inke liye koi endpoint nahi
   mila. Ye sirf UI state me chalte hain (refresh par chale jate hain).
   ═══════════════════════════════════════════════════════════════════ */
const BASE = '/api/PreEnrollmentStudent';

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  return '';
};

/* API full ISO datetime bhejti hai; <input type="date"> ko yyyy-MM-dd chahiye. */
const dateOnly = (v) => {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
};

/* Ek backend pre-student record → wohi flat shape jo Students UI parhta hai. */
function mapPreStudent(st, ctx) {
  const id = Number(pick(st, 'id', 'studentID', 'studentId')) || 0;
  return {
    _id:        id,
    preId:      `PRE-${String(id).padStart(4, '0')}`,   // UI key / display fallback
    _gradeId:   ctx.gradeId,
    _sectionId: ctx.sectionId,
    cls:        ctx.gradeName,
    sec:        ctx.sectionName,
    reg:        String(pick(st, 'registerNo', 'regNo', 'registrationNo') || ''),
    adm:        String(pick(st, 'previousAdmissionNo', 'admissionNo') || ''),
    first:      pick(st, 'firstName', 'name'),
    last:       pick(st, 'lastName'),
    father:     pick(st, 'fatherName'),
    fcnic:      pick(st, 'fatherCnic'),
    focc:       pick(st, 'fatherOccupation'),
    mother:     pick(st, 'motherName'),
    mcnic:      pick(st, 'motherCnic'),
    guardian:   pick(st, 'guardianName'),
    gcontact:   pick(st, 'guardianContact', 'emergencyContact'),
    gender:     pick(st, 'gander', 'gender'),
    dob:        dateOnly(pick(st, 'dateOfBirth', 'dob')),
    mobile:     pick(st, 'mobileNo', 'mobile'),
    email:      pick(st, 'email'),
    address:    pick(st, 'postalAddress', 'permanentAddesss', 'permanentAddress', 'address'),
    nat:        pick(st, 'nationality') || 'Pakistani',
    bform:      pick(st, 'bFormNo', 'bform'),
    family:     String(pick(st, 'familyNo') || ''),
    admdate:    dateOnly(pick(st, 'dateOfAdmission', 'admdate')),
    pschool:    pick(st, 'previousSchoolName'),
    pgrade:     pick(st, 'previousSchoolPreviousGrade'),
    pcontact:   pick(st, 'previousSchoolContactNo'),
    photo:      stuFileUrl(pick(st, 'picture')) || null,
    isActive:   st?.isActive !== false,
    reason:     pick(st, 'inactiveReason', 'reason'),
    createdAt:  dateOnly(pick(st, 'createdAt')),
    /* Challan / payments ki API nahi — UI me khali shuru hote hain. */
    challan:    null,
    payments:   [],
    stdDocs:    {},
    docs:       [],
    _disc:      {},
    _raw:       st,
  };
}

/* ─── READ ─── */
export async function getPreEnrollFeeHeads() { await delay(); return clone(mockPreEnrollFeeHeads); }

/* Grades → sections → students nested aata hai; flat list bana kar deta hai
   (har student par cls/sec + _gradeId/_sectionId). */
export async function getPreEnrollStudents(isActive = true) {
  const branchID = sessionStorage.getItem('branchID') || 0;
  const res  = await fetch(
    buildUrl(`${BASE}/get-class-section-prestudentlist-by-branch/${branchID}?isActive=${isActive}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load pre-enrolled students');
  const grades = Array.isArray(json?.data) ? json.data : [];

  const out = [];
  grades.forEach(g => {
    const gradeId   = pick(g, 'id', 'gradeID', 'gradeId') || 0;
    const gradeName = pick(g, 'name', 'gradeName', 'className') || '—';
    (Array.isArray(g.sections) ? g.sections : []).forEach(s => {
      const sectionId   = pick(s, 'sectionID', 'id', 'sectionId') || 0;
      const sectionName = pick(s, 'sectionName', 'name') || '—';
      (Array.isArray(s.students) ? s.students : []).forEach(st => {
        const rec = mapPreStudent(st, { gradeId, gradeName, sectionId, sectionName });
        if (rec.isActive === !!isActive) out.push(rec);
      });
    });
  });
  return out;
}

/* ─── WRITE ─── */

/* Create / update. Backend multipart FormData maangta hai (photo file ke liye).
   p.id 0 = add, > 0 = update. Field names backend ke hain — spelling waisi hi
   rakhni hai (Gander, PermanentAddesss). */
export async function savePreEnrollStudent(p = {}) {
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
  /* Nayi file par backend PictureFile se save karta hai aur Picture khali
     rehta hai; edit me nayi file na ho to purani picture wapas bhejo taake
     blank na ho. base64 preview (data:) kabhi echo nahi karna. */
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

  const res  = await fetch(buildUrl(`${BASE}/save-prestudent`), {
    method: 'POST',
    headers: { Accept: '*/*' },     // Content-Type khud browser (boundary ke sath) lagata hai
    body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save pre-enrolled student');

  /* Student save API ki tarah: HTTP 200 par bhi asli natija `data` me ho sakta
     hai (duplicate reg/mobile waghera → Success 0 / data 0). Inhe fail samjho. */
  const d = json?.data;
  const inner = Array.isArray(d) ? d[0] : (d && typeof d === 'object' ? d : null);
  const innerSuccess = inner ? (inner.Success ?? inner.success) : undefined;
  const isFail =
    innerSuccess === 0 || innerSuccess === false || innerSuccess === '0' ||
    d === 0 || d === '0';
  if (isFail) {
    throw new Error((inner && (inner.Message ?? inner.message)) || 'Number already exist');
  }
  return json;
}

async function callById(method, path, failMsg) {
  const res  = await fetch(buildUrl(`${BASE}/${path}`), { method, headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || failMsg);
  return json;
}
/* ─── Pre-Enrollment Challan APIs ─────────────────────────────────── */
const PE_BASE = '/api/PreEnrollmentStudent';

/* TODO: apne existing session helpers se replace karein */
const peBranchId = () =>
  Number(sessionStorage.getItem('branchID') || localStorage.getItem('branchId')) || 0;
const peUserId = () => {
  const direct = Number(sessionStorage.getItem('UserID'));
  if (direct) return direct;
  try { return Number(JSON.parse(localStorage.getItem('user') || '{}')?.id) || 0; }
  catch { return 0; }
};

async function peRequest(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const res = await fetch(buildUrl(`${PE_BASE}${path}`), {
    method,
    headers: {
      accept: '*/*',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok || data?.isSuccess === false || data?.success === false) {
    throw new Error(data?.message || data?.title || `Request failed (${res.status})`);
  }
  return data;
}

const peDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}T00:00:00`;
};
const PE_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* get-all ka response → UI ka challan shape { id, heads, month, year, total, payments } */
export function normalizePreEnrollChallan(raw) {
  const top  = raw?.data ?? raw?.result ?? raw;
  const list = Array.isArray(top) ? top : (top ? [top] : []);
  const L0   = list.find(Boolean);
  if (!L0) return null;
  const L = L0.ledger || L0;
  if (!L?.id) return null;

  const rows  = L.detailRows || L.details || L.detailList || [];
  const heads = rows.map(r => ({
    detailId: r.id,
    head:     r.head || '',
    subHead:  r.subHead || '',
    name:     r.subHead || r.head || 'Fee',
    amt:      Number(r.challanAmount ?? r.amount ?? 0),
    received: Number(r.receivedAmount ?? r.receivingAmount ?? r.paidAmount ?? 0),
  }));
  const total    = heads.reduce((a, h) => a + h.amt, 0);
  const received = heads.reduce((a, h) => a + h.received, 0);

  /* Server par jo receiving hui hai usay ek payment row bana kar dikhate hain */
  const perHead = {};
  heads.forEach(h => { if (h.received > 0) perHead[h.name] = h.received; });
  const payments = received > 0 ? [{
    id: `srv-${L.id}`,
    date: String(L.modifiedAt || L.dateofCreattion || '').slice(0, 10),
    method: L.paymentMethod || 'Cash',
    ref: '', txn: '',
    amount: received,
    perHead,
  }] : [];

  return {
    id: L.id,
    heads,
    month: PE_MONTHS[(Number(L.month) || 1) - 1],
    monthNo: Number(L.month) || 0,
    year: Number(L.year) || 0,
    dueDate: L.dueDate,
    total,
    payments,
    generatedAt: L.createdAt || L.dateofCreattion,
  };
}

/* GET get-all → ek student ka challan (month/year ke hisaab se) */
export async function getPreEnrollChallan({ studentId, month, year }) {
  const now = new Date();
  const q = new URLSearchParams({
    branchId:  String(peBranchId()),
    studentId: String(studentId),
    month:     String(month || now.getMonth() + 1),
    year:      String(year || now.getFullYear()),
  });
  const data = await peRequest(`/get-all?${q}`);
  return normalizePreEnrollChallan(data);
}

/* POST create-challan */
export async function createPreEnrollChallan({ student, heads, dueInDays = 10 }) {
  const now = new Date();
  const due = new Date(now.getTime() + dueInDays * 86400000);
  const uid = peUserId();
  const branchId = peBranchId();
  return peRequest('/create-challan', {
    method: 'POST',
    body: {
      ledger: {
        id: 0,
        dateofCreattion: peDay(now),
        dueDate: peDay(due),
        studentID: Number(student._id) || 0,
        branchID: branchId,
        gradeID: Number(student._gradeId) || 0,
        sectionID: Number(student._sectionId) || 0,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        registrationNumber: String(student.reg || student.preId || ''),
        paymentMethod: '',
        plApplicantID: '',
        plpsid: '',
        tranType: '',
        isActive: true,
        createdBy: uid,
        createdAt: now.toISOString(),
        modifiedBy: uid,
        modifiedAt: now.toISOString(),
        detailRows: heads.map(h => ({
          id: 0,
          blid: 0,
          branchId,
          head: h.head || 'Account Payable',
          subHead: h.subHead || h.name,
          challanAmount: Number(h.amt) || 0,
        })),
      },
    },
  });
}

/* DELETE delete/{id} → poora challan delete */
export function deletePreEnrollChallan(challanId) {
  return peRequest(`/delete/${challanId}`, { method: 'DELETE' });
}

/* DELETE delete-receiving-detail/{id}?modifiedBy= → receiving reset */
export function resetPreEnrollReceiving(challanId) {
  return peRequest(`/delete-receiving-detail/${challanId}?modifiedBy=${peUserId()}`, { method: 'DELETE' });
}
/* POST receive-payment → challan ke heads par payment receive karo.
   Payload create-challan jaisa hai; ledger.id = challan id,
   detailRows = challan ke heads, challanAmount = abhi receive hone wali raqam. */
/* POST receive-payment — flat body (ledger wrapper NAHI).
   Required: detailRows, receivedDate, paymentMethod. */
export async function receivePreEnrollPayment({ student, heads, payment }) {
  const now = new Date();
  const uid = peUserId();
  const branchId = peBranchId();
  const payDate = payment.date ? new Date(payment.date) : now;

  const detailRows = (heads || [])
    .filter(h => Number(payment.perHead?.[h.name] || 0) > 0)
    .map(h => {
      const amt = Number(payment.perHead[h.name]) || 0;

      return {
        id: h.detailId || 0,
        blid: Number(payment.challanId || 0),
        branchId,
        head: h.head || 'Account Payable',
        subHead: h.subHead || h.name,
        challanAmount: Number(h.amt) || 0,
        receivedAmount: amt,
        amount: amt,
      };
    });

  if (!detailRows.length) {
    throw new Error('No matching class heads found for this payment');
  }

  return peRequest('/receive-payment', {
    method: 'POST',
    body: {
      id: 0,
      ledgerId: Number(payment.challanId || 0),
      blid: Number(payment.challanId || 0),

      studentID: Number(student._id) || 0,
      branchID: branchId,
      gradeID: Number(student._gradeId) || 0,
      sectionID: Number(student._sectionId) || 0,

      registrationNumber: String(
        student.reg || student.preId || ''
      ),

      receivedDate: peDay(payDate),
      paymentMethod: payment.method || 'Cash',
      referenceNo: payment.ref || '',
      transactionNo: payment.txn || '',

      totalAmount: Number(payment.amount) || 0,

      createdBy: uid,
      modifiedBy: uid,

      detailRows,
    },
  });
}

/* Soft delete (isActive → false); reason query param me jata hai. */
export function removePreEnrollStudent(id, reason = '') {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  return callById('DELETE', `delete-prestudent/${id || 0}${qs}`, 'Could not remove pre-enrolled student');
}

export function restorePreEnrollStudent(id) {
  return callById('PUT', `restore-prestudent/${id || 0}`, 'Could not restore pre-enrolled student');
}

/* Hard delete — record hamesha ke liye khatam, restore nahi hota. */
export function removePreEnrollStudentPermanent(id) {
  return callById('DELETE', `delete-prestudent-permanent/${id || 0}`, 'Could not permanently delete pre-enrolled student');
}

/* ─── Abhi bhi mock (endpoint nahi mila) — sirf UI state ─── */
export async function savePreEnrollChallan({ preId, challan }) {
  await delay();
  return clone({ preId, challan, ok: true });
}

export async function savePreEnrollReceiving({ preId, payment }) {
  await delay();
  return clone({ preId, payment, ok: true });
}