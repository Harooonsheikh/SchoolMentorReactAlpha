/* ═══════════════════════════════════════════════════════════════════
   HUMAN RESOURCE — chain (head office) ka HR, Chain Management API par.
   UI wahi purana chain wala (pages/HumanResource) — ye file sirf us ki
   shakal (depts / desigs / emps) me data lati aur save karti hai.

     POST   /api/hr/save-department               GET /api/hr/get-departments-by-network/{nid}
     DELETE /api/hr/delete-department/{id}        (designations departments ke andar nested)
     POST   /api/hr/save-department-designation   DELETE /api/hr/delete-designation/{id}
     POST   /api/hr/save-employee (multipart)     GET /api/hr/get-employees-by-network/{nid}?isActive=
     PUT    /api/hr/update-employee-employment    PUT /api/hr/update-employee-salary
     DELETE /api/hr/delete-employee/{id}          (soft → inactive)
     DELETE /api/hr/delete-employee-permanent/{id}
     POST   /api/hr/save-salary-head              DELETE /api/hr/delete-salary-head/{id}
     POST   /api/hr/save-leave-settings           GET /api/hr/get-leave-settings-by-network/{nid}

   Live test kiye hue usool:
     • Har response { success, message, count?, data }.
     • branchID KABHI 0 na bhejein — FK_AHM_Branch toot jata hai. JSON me
       null, multipart me field hi nahi lagti.
     • save-employee sirf personal fields rakhta hai — department, joining,
       salary null reh jate hain. Is liye ERP wala 3-step flow:
       save-employee → update-employee-employment → update-employee-salary.
     • Duplicate phone par HTTP 200 + data[0] = { Success:0, Message:"Number
       already exist" } — isay error mana jata hai.
     • Backend naam Title Case kar deta hai; qualificationName save nahi hota.

   Jo chain API me NAHI hai:
     • Custom salary heads ka GET → save API par, aur ek local mirror taake
       edit karte waqt wapas dikhein.
     • restore-employee → update-employee-employment isActive:true se koshish,
       phir active list se tasdeeq.
     • Payroll + loans → pehle ki tarah UI ka apna localStorage (data.js).
   Auth header nahi lagta (academicsSetupApi jaisa).
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE, ERP_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${CHAIN_API_BASE}/api/hr`

/* createdBy / modifiedBy — ERP handoff me user id `id` par aati hai. */
const currentUserId = () => {
  const u = getStoredUser()
  return Number(u?.id ?? u?.userID ?? u?.userId) || 0
}

function apiMessage(json) {
  if (!json || typeof json !== 'object') return null
  return json.message || json.Message || json.title || null
}

/* JSON body ya FormData. success:false bhi 200 ke saath aa sakta hai. */
async function call(path, { method = 'GET', body, form, fallback = 'Request failed' } = {}) {
  const headers = { Accept: '*/*' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    const msg = apiMessage(json) || fallback
    if (/REFERENCE constraint|FK_/i.test(msg)) throw new Error('Cannot delete — related records still use it.')
    throw new Error(msg)
  }
  return json
}

const rows = (json) => (Array.isArray(json?.data) ? json.data : [])
const str = (v) => (v == null ? '' : String(v))
const dateOnly = (v) => String(v || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ''
const idOrNull = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
/* Date-only ("YYYY-MM-DD") ya kuch bhi → backend ke liye poora ISO. */
const toIso = (v) => { const d = v ? new Date(v) : new Date(); return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString() }
/* Response ka casing pakka nahi (camelCase / PascalCase) — pehla mojood le lo. */
const pick = (o, ...keys) => { for (const k of keys) { const val = o?.[k]; if (val !== undefined && val !== null) return val } return undefined }

/* Save response se naya id (data: 12 | {id} | [{ID}]). */
function idFromResponse(json) {
  const d = json?.data ?? json
  if (Array.isArray(d)) return Number(d[0]?.ID ?? d[0]?.id) || 0
  if (d && typeof d === 'object') return Number(d.id ?? d.ID) || 0
  return Number(d) || 0
}

/* Backend ke teen fixed allowance columns ↔ UI ke salary head naam. */
const FIXED_HEADS = [
  ['Medical Allowance', 'medicalAllowanace'],
  ['Rent Allowance', 'rentAllowance'],
  ['Transport Allowance', 'transportAllowance'],
]
const isFixed = (name) => FIXED_HEADS.some(([n]) => n.toLowerCase() === String(name || '').trim().toLowerCase())
const fixedAmount = (heads, name) => Number((heads || []).find((h) => h.type !== 'deduct'
  && String(h.name).trim().toLowerCase() === name.toLowerCase())?.amount) || 0

/* ── local mirror (API gaps) — per network ── */
const mirrorKey = () => `csp_hr_api_${currentNetworkId() || 0}`
function loadMirror() {
  let m = null
  try { m = JSON.parse(localStorage.getItem(mirrorKey())) } catch { /* naya */ }
  return { heads: {}, inactive: {}, deptDesc: {}, ...(m && typeof m === 'object' ? m : {}) }
}
function saveMirror(m) { try { localStorage.setItem(mirrorKey(), JSON.stringify(m)) } catch { /* quota */ } }

/* ═══════════════════ Qualifications (ERP LaunchSetup, sirf read) ═══════════════════
   GET /api/LaunchSetup/get-qualifications/0 → [{ id, qualificationName }].
   Chain API qualificationName wapas null deti hai — naam isi list se id par. */
let qualsPromise = null
export function getHrQualifications() {
  if (!qualsPromise) {
    qualsPromise = fetch(`${ERP_API_BASE}/api/LaunchSetup/get-qualifications/0`, { headers: { Accept: '*/*' } })
      .then((r) => r.json())
      .then((j) => (Array.isArray(j?.data) ? j.data : []).map((q) => ({ id: Number(q.id), name: str(q.qualificationName) })))
      .catch(() => { qualsPromise = null; return [] })
  }
  return qualsPromise
}
const qualName = (quals, id, fallback = '') => quals.find((q) => q.id === Number(id))?.name || str(fallback)

/* ═══════════════════ Departments & designations ═══════════════════ */

/** { depts: [{ id, name, desc }], desigs: [{ id, dId, name, qualId, qual, desc }], quals } */
export async function getHrBasics() {
  const [json, quals] = await Promise.all([
    call(`/get-departments-by-network/${currentNetworkId()}`, { fallback: 'Could not load departments' }),
    getHrQualifications(),
  ])
  const data = rows(json)
  /* API me department ka description column nahi — local mirror se uthao. */
  const mirror = loadMirror()
  return {
    depts: data.map((d) => ({ id: d.id, name: str(d.departmentName), desc: str(mirror.deptDesc?.[d.id] || '') })),
    desigs: data.flatMap((d) => (d.designations || []).map((g) => ({
      id: g.designationID,
      dId: g.branchDepartmentID ?? d.id,
      name: str(g.designationName),
      qualId: Number(g.qualificationID) || '',
      qual: qualName(quals, g.qualificationID, g.qualificationName),
      desc: str(g.description),
    }))),
    quals,
  }
}

export async function saveHrDept({ id = 0, name, desc = '' }) {
  const uid = currentUserId()
  const json = await call('/save-department', {
    method: 'POST',
    fallback: 'Could not save department',
    body: { id: Number(id) || 0, networkID: currentNetworkId(), departmentName: name, createdBy: uid, modifiedBy: uid, designations: [] },
  })
  /* API me department description nahi — nayi/mojooda id par local mirror me rakho. */
  const savedId = Number(id) || idFromResponse(json)
  if (savedId) {
    const m = loadMirror()
    if (desc) m.deptDesc[savedId] = desc
    else delete m.deptDesc[savedId]
    saveMirror(m)
  }
  return json
}

export async function deleteHrDept(id) {
  const json = await call(`/delete-department/${id}`, { method: 'DELETE', fallback: 'Could not delete department' })
  const m = loadMirror()
  delete m.deptDesc[id]
  saveMirror(m)
  return json
}

export function saveHrDesig({ id = 0, dId, name, qualId = 0, qual = '', desc = '' }) {
  const uid = currentUserId()
  return call('/save-department-designation', {
    method: 'POST',
    fallback: 'Could not save designation',
    body: {
      designationID: Number(id) || 0,
      networkID: currentNetworkId(),
      branchDepartmentID: Number(dId) || 0,
      designationName: name,
      description: desc,
      qualificationID: Number(qualId) || 0,
      qualificationName: qual,
      createdBy: uid,
      modifiedBy: uid,
    },
  })
}

export function deleteHrDesig(id) {
  return call(`/delete-designation/${id}`, { method: 'DELETE', fallback: 'Could not delete designation' })
}

/* ═══════════════════ Employees ═══════════════════ */

const lastRaw = new Map()   // id → API row (restore ke liye)

/* Leave record na ho to sab khaali — koi farzi default (20/8/6 …) nahi. */
function leaveToForm(l) {
  if (!l) return { annual: '', casual: '', sick: '', balance: '', policy: '', absentDed: '', unpaidDed: '', _leaveId: 0 }
  /* GET response PascalCase deta hai (AnnualPaidLeaves…) — dono casing le lo. */
  return {
    annual: pick(l, 'annualPaidLeaves', 'AnnualPaidLeaves') ?? '',
    casual: pick(l, 'casualLeaves', 'CasualLeaves') ?? '',
    sick: pick(l, 'sickLeaves', 'SickLeaves') ?? '',
    balance: pick(l, 'leaveBalance', 'LeaveBalance') ?? '',
    policy: pick(l, 'leavePolicy', 'LeavePolicy') ?? '',
    absentDed: pick(l, 'deductionOneDayAbsent', 'DeductionOneDayAbsent') ?? '',
    unpaidDed: pick(l, 'deductionUnpaidLeaves', 'DeductionUnpaidLeaves') ?? '',
    _leaveId: pick(l, 'id', 'ID') ?? 0,
  }
}
const LEAVE_KEYS = ['annual', 'casual', 'sick', 'balance', 'policy', 'absentDed', 'unpaidDed']

function toEmp(e, leave, mirror, quals) {
  const fixed = FIXED_HEADS
    .map(([name, key]) => ({ name, type: 'allow', amount: Number(e[key]) || 0 }))
    .filter((h) => h.amount > 0)
  const custom = (mirror.heads[e.id] || []).filter((h) => !isFixed(h.name))
  const inact = mirror.inactive[e.id] || {}
  return {
    id: e.id,
    eid: `EMP-${String(e.id).padStart(3, '0')}`,
    firstName: str(e.firstName),
    lastName: str(e.lastName),
    fn: str(e.fatherName),
    cnic: str(e.cnic),
    dob: dateOnly(e.dateOfBirth),
    gender: e.gender || 'Male',
    marital: e.maritalStatus || 'Single',
    phone: str(e.phone),
    email: str(e.email).toUpperCase() === 'N/A' ? '' : str(e.email),
    blood: str(e.bloodGroup).toUpperCase() === 'N/A' ? '' : str(e.bloodGroup),
    emergency: str(e.emergencyContact),
    address: str(e.address),
    dId: e.departmentID ?? '',
    desId: e.designationID ?? '',
    join: dateOnly(e.dateOfJoining),
    type: e.employmentType || 'Permanent',
    status: e.isActive === false ? 'Inactive' : 'Active',
    ...(e.isActive === false ? { inactiveDate: inact.date, inactiveReason: inact.reason } : {}),
    manager: str(e.reportingManagerName),
    qualId: Number(e.qualificationID) || '',
    qual: qualName(quals, e.qualificationID, e.qualificationName),
    exp: str(e.experience),
    shift: str(e.shiftDutyTime),
    city: str(e.cityName),
    role: str(e.responsibilities),
    basicSalary: Number(e.basicSalary) || 0,
    payMethod: e.paymentMethod || 'Bank Transfer',
    bankName: str(e.bankName),
    bankAcc: str(e.accountNumber),
    salaryHeads: [...fixed, ...custom],
    leaves: leaveToForm(leave),
    financial: { salaryAdvance: 0, loanBalance: 0, securityDeposit: 0, clearanceStatus: 'pending' },
  }
}

/** Active + inactive dono, UI ki emp shakal me. */
export async function getHrEmployees() {
  const nid = currentNetworkId()
  const list = (isActive) => call(`/get-employees-by-network/${nid}?isActive=${isActive}`, { fallback: 'Could not load employees' }).then(rows)
  const [active, inactive, leaves, quals] = await Promise.all([
    list(true), list(false),
    call(`/get-leave-settings-by-network/${nid}`).then(rows).catch(() => []),
    getHrQualifications(),
  ])
  const mirror = loadMirror()
  /* Har employee ka sab se naya leave record. */
  const leaveOf = (id) => leaves.filter((l) => Number(pick(l, 'employeeID', 'EmployeeID')) === Number(id))
    .reduce((a, b) => (!a || Number(pick(b, 'id', 'ID')) > Number(pick(a, 'id', 'ID')) ? b : a), null)
  const seen = new Set()
  lastRaw.clear()
  return [...active, ...inactive]
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .map((e) => { lastRaw.set(Number(e.id), e); return toEmp(e, leaveOf(e.id), mirror, quals) })
}

/* update-employee-employment / update-employee-salary ka JSON body. */
function employmentBody(v, id, empImage) {
  const now = new Date().toISOString()
  const uid = currentUserId()
  return {
    id,
    networkID: currentNetworkId(),
    cnic: v.cnic || '',
    firstName: v.firstName || '',
    lastName: v.lastName || '',
    fatherName: v.fn || '',
    gender: v.gender || '',
    maritalStatus: v.marital || '',
    countryID: null, provinceID: null, cityID: null,
    address: v.address || '',
    phone: v.phone || '',
    emergencyContact: v.emergency || '',
    dateOfBirth: v.dob || null,
    dateOfJoining: v.join || null,
    experience: String(v.exp ?? ''),
    bloodGroup: v.blood || '',
    departmentID: idOrNull(v.dId),
    designationID: idOrNull(v.desId),
    qualificationID: idOrNull(v.qualId),
    empImage: empImage || '',
    basicSalary: Number(v.basicSalary) || 0,
    medicalAllowanace: fixedAmount(v.salaryHeads, 'Medical Allowance'),
    rentAllowance: fixedAmount(v.salaryHeads, 'Rent Allowance'),
    transportAllowance: fixedAmount(v.salaryHeads, 'Transport Allowance'),
    paymentMethod: v.payMethod || '',
    bankName: v.bankName || '',
    accountNumber: v.bankAcc || '',
    reportingManagerName: v.manager || '',
    employmentType: v.type || '',
    shiftDutyTime: v.shift || '',
    responsibilities: v.role || '',
    isPrinciple: false,
    isTeacher: false,   // head office staff — teacher nahi
    isParent: false,
    email: v.email || '',
    createdAt: now, createdBy: uid, modifiedAt: now, modifiedBy: uid,
    isActive: true,
  }
}

async function saveLeaves(employeeID, l = {}) {
  const uid = currentUserId()
  return call('/save-leave-settings', {
    method: 'POST',
    fallback: 'Could not save leave settings',
    body: {
      id: Number(l._leaveId) || 0,
      employeeID,
      networkID: currentNetworkId(),
      annualPaidLeaves: Number(l.annual) || 0,
      casualLeaves: Number(l.casual) || 0,
      sickLeaves: Number(l.sick) || 0,
      maternityPaternityLeaves: 0,
      leaveBalance: Number(l.balance) || 0,
      leavePolicy: l.policy || '',
      enableLeaveDeduction: true,
      deductionOneDayAbsent: Number(l.absentDed) || 0,
      deductionUnpaidLeaves: Number(l.unpaidDed) || 0,
      createdBy: uid,
      modifiedBy: uid,
    },
  })
}

/* Custom (non-fixed) salary heads: hataye gaye delete, baqi save. Mirror
   isliye ke API in ka GET nahi deti. */
async function syncCustomHeads(employeeID, heads, previous) {
  const uid = currentUserId()
  const nid = currentNetworkId()
  const custom = (heads || []).filter((h) => h.name && !isFixed(h.name))
  const keep = new Set(custom.map((h) => String(h.id)).filter((x) => x !== 'undefined'))
  for (const old of (previous || []).filter((h) => !isFixed(h.name))) {
    if (Number(old.id) > 0 && !keep.has(String(old.id))) {
      try { await call(`/delete-salary-head/${old.id}`, { method: 'DELETE' }) } catch { /* reload me dikh jayega */ }
    }
  }
  const saved = []
  for (const h of custom) {
    const json = await call('/save-salary-head', {
      method: 'POST',
      fallback: 'Could not save salary head',
      body: {
        id: Number(h.id) > 0 ? Number(h.id) : 0,
        employeeID, networkID: nid,
        headName: h.name, amount: Number(h.amount) || 0, isAllowance: h.type !== 'deduct',
        createdBy: uid, modifiedBy: uid,
      },
    })
    saved.push({ id: idFromResponse(json) || h.id || 0, name: h.name, type: h.type, amount: Number(h.amount) || 0 })
  }
  const m = loadMirror()
  m.heads[employeeID] = saved
  saveMirror(m)
}

/**
 * Add / edit — `v` = EmployeeModal ki values. `previous` = edit se pehle ka emp
 * (hataye gaye salary heads ke liye). Flow:
 *   1) save-employee (multipart) → id   2) update-employee-employment
 *   3) update-employee-salary           4) salary heads   5) leave settings
 */
export async function saveHrEmployee(v, previous = null) {
  const uid = currentUserId()
  const now = new Date().toISOString()
  const id0 = Number(previous?.id) || 0

  const fd = new FormData()
  const set = (k, val) => { if (val !== undefined && val !== null) fd.append(k, val) }
  set('ID', id0)
  set('NetworkID', currentNetworkId())
  set('CNIC', v.cnic)
  set('FirstName', v.firstName)
  set('LastName', v.lastName)
  set('FatherName', v.fn)
  set('Gender', v.gender)
  set('MaritalStatus', v.marital || 'N/A')
  set('Address', v.address)
  set('Phone', v.phone)
  set('EmergencyContact', v.emergency)
  set('DateOfBirth', v.dob || now)
  set('DateOfJoining', v.join || null)
  set('Experience', String(v.exp ?? ''))
  set('Email', v.email || 'N/A')
  set('EmpImage', 'N/A')
  set('BloodGroup', v.blood || 'N/A')
  set('DepartmentID', idOrNull(v.dId))
  set('DesignationID', idOrNull(v.desId))
  set('QualificationID', idOrNull(v.qualId))
  set('BasicSalary', Number(v.basicSalary) || 0)
  set('PaymentMethod', v.payMethod)
  set('BankName', v.bankName)
  set('AccountNumber', v.bankAcc)
  set('EmploymentType', v.type)
  set('ReportingManagerName', v.manager)
  set('ShiftDutyTime', v.shift)
  set('Responsibilities', v.role)
  set('IsPrinciple', 'false')
  set('IsTeacher', 'false')
  set('IsParent', 'false')
  set('CreatedAt', now)
  set('CreatedBy', uid)
  set('ModifiedAt', now)
  set('ModifiedBy', uid)
  set('IsActive', 'true')

  const json = await call('/save-employee', { method: 'POST', form: fd, fallback: 'Could not save employee' })
  const inner = Array.isArray(json?.data) ? json.data[0] : null
  if (inner && (inner.Success === 0 || inner.Success === false)) {
    throw new Error(inner.Message || 'Could not save employee')
  }
  const id = idFromResponse(json) || id0
  if (!id) throw new Error('Employee saved but the server did not return its id')

  const img = inner?.EmpImage ?? lastRaw.get(id)?.empImage
  const body = employmentBody(v, id, img && String(img).toUpperCase() !== 'N/A' ? img : '')
  await call('/update-employee-employment', { method: 'PUT', body, fallback: 'Could not update employment details' })
  await call('/update-employee-salary', { method: 'PUT', body, fallback: 'Could not update salary details' })

  await syncCustomHeads(id, v.salaryHeads, previous?.salaryHeads)
  /* Leave tab bilkul khaali chhora ho (aur pehle se record na ho) to kuch mat bhejo. */
  const l = v.leaves
  if (l && (Number(l._leaveId) > 0 || LEAVE_KEYS.some((k) => String(l[k] ?? '').trim() !== ''))) await saveLeaves(id, l)
  return { id }
}

/* Soft delete → inactive. Reason/date API nahi rakhti — mirror me. */
export async function markHrEmployeeInactive(id, { reason = '', date = '' } = {}) {
  await call(`/delete-employee/${id}`, { method: 'DELETE', fallback: 'Could not mark employee inactive' })
  const m = loadMirror()
  m.inactive[id] = { reason, date: date || new Date().toISOString().slice(0, 10) }
  saveMirror(m)
}

/* Chain API me restore-employee nahi — record isActive:true ke saath dobara
   bhejo, phir active list se tasdeeq. */
export async function restoreHrEmployee(id) {
  const raw = lastRaw.get(Number(id))
  if (!raw) throw new Error('Employee not loaded — refresh and try again')
  const body = { ...raw, id: Number(id), networkID: currentNetworkId(), isActive: true, modifiedBy: currentUserId(), modifiedAt: new Date().toISOString() }
  delete body.branchID
  await call('/update-employee-employment', { method: 'PUT', body, fallback: 'Could not reactivate employee' })
  const active = rows(await call(`/get-employees-by-network/${currentNetworkId()}?isActive=true`))
  if (!active.some((e) => Number(e.id) === Number(id))) {
    throw new Error('Reactivating an employee is not supported by the chain API yet.')
  }
  const m = loadMirror()
  delete m.inactive[id]
  saveMirror(m)
}

export async function deleteHrEmployeePermanent(id) {
  await call(`/delete-employee-permanent/${id}`, { method: 'DELETE', fallback: 'Could not delete employee' })
  const m = loadMirror()
  delete m.heads[id]; delete m.inactive[id]
  saveMirror(m)
}

/* ═══════════════════ Advance / Loans ═══════════════════
   ERP (src/erp/services/hrService.js) ke loan flow ki chain shakal.
     POST /api/hr/save-employee-loan             POST /api/hr/save-employee-loan-repayment
     GET  /api/hr/get-employee-loans/{empId}/{nid}?branchId=
   Chain me branch nahi — branchID hamesha null (API 0 ko rad karti hai:
   "Branch ID must be null or greater than zero"), is liye GET me branchId
   query lagate hi nahi. Chain API me mark-returned endpoint nahi — poora
   remaining ki ek repayment daal kar loan band hota hai (UI wahi karta tha). */

/* API "One Time" deti/leti hai; UI "Lump Sum" dikhati hai. Read par ulta map. */
const displayRepaymentType = (t) => { const s = String(t || '').trim().toLowerCase(); return s ? (s === 'installment' ? 'Installment' : 'Lump Sum') : '' }

/* Aik backend loan row → Advance/Loan modal ki shakal (data.js empLoans).
   Casing/enrichment pakki nahi, is liye camelCase/PascalCase dono, aur
   remaining/status na aayein to khud hisaab. */
function mapApiLoan(l = {}, idx = 0) {
  const amount = Number(pick(l, 'loanAmount', 'LoanAmount', 'amount', 'Amount')) || 0
  const rawReceived = pick(l, 'repayments', 'Repayments', 'received') || []
  const received = (Array.isArray(rawReceived) ? rawReceived : []).map((r) => ({
    amount: Number(pick(r, 'amount', 'Amount')) || 0,
    date: dateOnly(pick(r, 'repaymentDate', 'RepaymentDate', 'date')),
    comment: str(pick(r, 'comments', 'Comments', 'comment')),
  }))
  const repaid = received.reduce((a, r) => a + r.amount, 0)
  const remRaw = pick(l, 'remaining', 'Remaining', 'outstanding', 'Outstanding')
  const remaining = remRaw != null ? Number(remRaw) || 0 : Math.max(0, amount - repaid)
  const statusRaw = String(pick(l, 'status', 'Status') || '').toLowerCase()
  const status = statusRaw ? (statusRaw === 'active' ? 'active' : 'returned') : (amount > 0 && remaining <= 0 ? 'returned' : 'active')
  return {
    id: Number(pick(l, 'id', 'ID')) || 0,
    loanNumber: pick(l, 'loanNo', 'LoanNo', 'loanNumber') ?? (idx + 1),
    amount,
    comment: str(pick(l, 'comments', 'Comments', 'comment')) || 'N/A',
    repaymentType: displayRepaymentType(pick(l, 'repaymentType', 'RepaymentType')),
    deductDate: dateOnly(pick(l, 'repaymentDate', 'RepaymentDate')),
    installmentType: pick(l, 'installmentType', 'InstallmentType') || null,
    installmentAmount: Number(pick(l, 'installmentAmount', 'InstallmentAmount')) || 0,
    status,
    remaining,
    received,
    createdAt: dateOnly(pick(l, 'createdAt', 'CreatedAt')),
  }
}

/** Aik employee ke saare loans (+ repayments), UI ki shakal me. */
export async function getHrEmployeeLoans(employeeId) {
  const json = await call(`/get-employee-loans/${Number(employeeId) || 0}/${currentNetworkId()}`, { fallback: 'Could not load loans' })
  const list = pick(json, 'loans', 'Loans') || rows(json)
  return (Array.isArray(list) ? list : []).map(mapApiLoan)
}

/* API sirf "One Time" / "Installment" qubool karti hai (purani UI "Lump Sum"
   bhejti thi → 400). Installment ke ilawa sab ko "One Time" bana do. */
const normRepaymentType = (t) => (String(t).trim().toLowerCase() === 'installment' ? 'Installment' : 'One Time')

/** Naya loan / advance. `p`: { employeeID, loanAmount, comments, repaymentType,
    repaymentDate, installmentType, installmentAmount }. */
export function saveHrEmployeeLoan(p = {}) {
  const uid = currentUserId()
  return call('/save-employee-loan', {
    method: 'POST',
    fallback: 'Could not save loan',
    body: {
      id: Number(p.id) || 0,
      employeeID: Number(p.employeeID) || 0,
      networkID: currentNetworkId(),
      branchID: null,
      loanAmount: Number(p.loanAmount) || 0,
      comments: p.comments || '',
      repaymentType: normRepaymentType(p.repaymentType),
      repaymentDate: toIso(p.repaymentDate),
      installmentType: p.installmentType || '',
      installmentAmount: Number(p.installmentAmount) || 0,
      createdBy: uid,
      modifiedBy: uid,
    },
  })
}

/** Loan par repayment. `p`: { loanID, amount, repaymentDate, comments }. */
export function saveHrEmployeeLoanRepayment(p = {}) {
  const uid = currentUserId()
  return call('/save-employee-loan-repayment', {
    method: 'POST',
    fallback: 'Could not save repayment',
    body: {
      id: Number(p.id) || 0,
      loanID: Number(p.loanID) || 0,
      networkID: currentNetworkId(),
      branchID: null,
      amount: Number(p.amount) || 0,
      repaymentDate: toIso(p.repaymentDate),
      comments: p.comments || '',
      createdBy: uid,
      modifiedBy: uid,
    },
  })
}

/* ═══════════════════ Payroll ═══════════════════
     POST /api/hr/payroll-setup            POST /api/hr/save-payroll-payment
     GET  /api/hr/get-payroll-payments-by-network/{nid}
   Chain API me get-payroll-by-network (net payable/deductions/status) NAHI —
   record ka hisaab UI khud karta hai; API se sirf setup + payments jaate hain
   aur payments wapas paid/status jodne ke liye aate hain. branchID null. */

/** Aik employee/month ka payroll setup. `p` PayRoll modal ke setup fields.
    Response se payrollID (payment isi par lagti hai) — payrollIdFromResponse. */
export function saveHrPayrollSetup(p = {}) {
  const uid = currentUserId()
  return call('/payroll-setup', {
    method: 'POST',
    fallback: 'Could not save payroll setup',
    body: {
      employeeID: Number(p.employeeID) || 0,
      networkID: currentNetworkId(),
      branchID: null,
      payrollMonth: Number(p.payrollMonth) || 0,
      payrollYear: Number(p.payrollYear) || 0,
      bonus: Number(p.bonus) || 0,
      loanDeduction: Number(p.loanDeduction) || 0,
      customLoanAmount: Number(p.customLoanAmount) || 0,
      fineDeduction: Number(p.fineDeduction) || 0,
      fineComment: p.fineComment || '',
      leaveCount: Number(p.leaveCount) || 0,
      leaveDeduction: Number(p.leaveDeduction) || 0,
      leaveComment: p.leaveComment || '',
      absentCount: Number(p.absentCount) || 0,
      absentDeduction: Number(p.absentDeduction) || 0,
      absentComment: p.absentComment || '',
      createdBy: uid,
      modifiedBy: uid,
    },
  })
}

/** payroll-setup ke response me se naya/mojooda payrollID. */
export const payrollIdFromResponse = (json) => idFromResponse(json)

/** Payroll record par payment. `p`: { payrollID, amount, comment, paymentDate }. */
export function saveHrPayrollPayment(p = {}) {
  const uid = currentUserId()
  return call('/save-payroll-payment', {
    method: 'POST',
    fallback: 'Could not record payment',
    body: {
      payrollID: Number(p.payrollID) || 0,
      networkID: currentNetworkId(),
      branchID: null,
      amount: Number(p.amount) || 0,
      comment: p.comment || '',
      paymentDate: toIso(p.paymentDate),
      createdBy: uid,
    },
  })
}

/** Poore network ki payroll payments — { payrollID, amount, comment, date }[]. */
export async function getHrPayrollPayments() {
  const json = await call(`/get-payroll-payments-by-network/${currentNetworkId()}`, { fallback: 'Could not load payroll payments' })
  const list = pick(json, 'payments', 'Payments') || rows(json)
  return (Array.isArray(list) ? list : []).map((p) => ({
    payrollID: Number(pick(p, 'payrollID', 'PayrollID')) || 0,
    amount: Number(pick(p, 'amount', 'Amount')) || 0,
    comment: str(pick(p, 'comment', 'Comment')),
    date: dateOnly(pick(p, 'paymentDate', 'PaymentDate')),
  }))
}
