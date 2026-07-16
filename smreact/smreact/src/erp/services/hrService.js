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
import { buildUrl, apiMessage, getBaseUrl } from '../../utils/apiConfig';

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
/* A date-ish value ("2026-07-14" or full ISO) → a full ISO datetime string the
   API expects; blank/invalid falls back to now. */
const toIso = (v) => {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
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
/* Backend leave-settings shape → the modal's leaves form shape. Missing values
   stay '' so a new employee's fields start blank; `_leaveId` carries the record
   id so a save updates in place.

   Keys are resolved case-insensitively because the two sources disagree on
   casing: the branch-list endpoint (get-employees-by-branch) returns camelCase
   (`annualPaidLeaves`, `deductionOneDayAbsent`) while the dedicated endpoint
   (get-leave-settings-by-employee) returns PascalCase (`AnnualPaidLeaves`,
   `DeductionOneDayAbsent`). A case-sensitive read left the leaves tab blank. */
function leaveApiToForm(d = {}) {
  const lower = {};
  for (const k in d) lower[k.toLowerCase()] = d[k];
  const val = (k) => { const v = lower[k.toLowerCase()]; return v == null ? '' : v; };
  return {
    annual:    val('annualPaidLeaves'),
    casual:    val('casualLeaves'),
    sick:      val('sickLeaves'),
    maternity: val('maternityPaternityLeaves'),
    balance:   val('leaveBalance'),
    policy:    'Standard',
    deductEn:  lower['enableleavededuction'] !== false,
    absentDed: val('deductionOneDayAbsent'),
    unpaidDed: val('deductionUnpaidLeaves'),
    _leaveId:  val('id') || 0,
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

/* Count a staff member's ABSENT and LEAVE days across a whole calendar year by
   polling the per-date staff-attendance endpoint (the only "get" it exposes —
   one call per day, returning every staff record for that date). Heavy, so
   callers should show a loading state. Returns { absent, leave, present }. */
export async function getHrStaffYearlyAttendance(staffId, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const token    = sessionStorage.getItem('token');
  const CODE     = { '1': 'present', '2': 'absent', '3': 'leave', '4': 'late' };
  const yr       = Number(year) || new Date().getFullYear();

  const dates = [];
  for (let m = 0; m < 12; m++) {
    const days = new Date(yr, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) dates.push(`${yr}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  let absent = 0, leave = 0, present = 0;
  const CHUNK = 12;   // limit concurrency so we don't hammer the server
  for (let i = 0; i < dates.length; i += CHUNK) {
    const chunk = dates.slice(i, i + CHUNK);
    const results = await Promise.all(chunk.map(async (dateStr) => {
      try {
        const res  = await fetch(buildUrl('/api/staff-attendance'), {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ id: 0, staffID: 0, branchID, attendanceDate: dateStr, checkInTime: '', checkOutTime: '', status: '', platform: '', isNotificationGen: false, action: 'get', createdBy: 0, modifiedBy: 0 }),
        });
        const json = await res.json().catch(() => null);
        return { dateStr, recs: json?.data || [] };
      } catch { return { dateStr, recs: [] }; }
    }));
    results.forEach(({ dateStr, recs }) => {
      const found = (recs || []).find(r =>
        String(r.StaffID ?? r.staffID) === String(staffId) &&
        String(r.AttendanceDate ?? r.attendanceDate ?? '').slice(0, 10) === dateStr);
      if (!found) return;
      const raw = String((found.Status ?? found.status) ?? '').toLowerCase();
      const st  = CODE[raw] || raw;
      if (st === 'absent') absent++;
      else if (st === 'leave') leave++;
      else if (st === 'present') present++;
    });
  }
  return { absent, leave, present };
}

/* Calculate this month's chargeable leave/absent counts + deduction amounts for
   one employee. Absents have no quota (every absent day is charged); leaves have
   an annual quota and the server subtracts excess already charged in earlier
   months this year, so ALWAYS call this right before saveHrPayrollSetup for the
   same employee/month/year. POST /api/HR/calculate-leave-absent-deduction.
   Returns the `data` object (annualPaidLeaves, cumulativeLeavesTakenYTD,
   leavesAlreadyDeductedYTD, excessLeavesThisMonth, leaveDeductionAmount,
   absentCountThisMonth, absentDeductionAmount, totalDeductionAmount, …). */
export async function calculateLeaveAbsentDeduction({ employeeID, payrollMonth, payrollYear } = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const res  = await fetch(buildUrl('/api/HR/calculate-leave-absent-deduction'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeID:   Number(employeeID) || 0,
      branchID,
      payrollMonth: Number(payrollMonth) || 0,
      payrollYear:  Number(payrollYear) || 0,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not calculate leave/absent deduction');
  }
  return json?.data ?? json;
}

/* Month index (1–12) → full month name, for the record's `month` field. */
const PAYROLL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* Map one API payroll row (get-payroll-by-branch, PascalCase) → the record shape
   the Financials UI + reports consume (see the demo-seed record in
   HumanResource.jsx). Server-computed totals (TotalGross / TotalDeductions /
   NetPayable) are trusted as-is rather than recomputed. `empHeads` are the
   employee's custom salary heads returned alongside the payroll. Advance/loan
   fields are left to the separate empLoans flow. */
function mapApiPayrollRecord(p, empHeads = []) {
  const paid    = Number(p.PaidSoFar) || 0;
  const payDate = dateOnly(p.ModifiedAt || p.CreatedAt);
  const status  = p.PaymentStatus || (paid > 0 ? 'Partially Paid' : 'Generated');
  return {
    payrollID:          p.PayrollID,
    month:              PAYROLL_MONTH_NAMES[(Number(p.PayrollMonth) || 1) - 1] || '',
    year:               Number(p.PayrollYear) || 0,
    status,
    basicPay:           Number(p.BasicPay) || 0,
    bonus:              Number(p.Bonus) || 0,
    previousArrears:    Number(p.PreviousArrears) || 0,
    houseAllowance:     Number(p.HouseAllowance) || 0,
    transportAllowance: Number(p.TransportAllowance) || 0,
    medicalAllowance:   Number(p.MedicalAllowance) || 0,
    extraAllowances:    Number(p.ExtraAllowances) || 0,
    extraDeductions:    Number(p.ExtraDeductions) || 0,
    totalGross:         Number(p.TotalGross) || 0,
    loanDeduct:         Number(p.LoanDeduction) || 0,
    customLoan:         Number(p.CustomLoanAmount) || 0,
    fineDeduct:         Number(p.FineDeduction) || 0,
    fineComment:        p.FineComment || '',
    leaveCount:         Number(p.LeaveCount) || 0,
    leaveDeduct:        Number(p.LeaveDeduction) || 0,
    leaveComment:       p.LeaveComment || '',
    absentCount:        Number(p.AbsentCount) || 0,
    absentDeduct:       Number(p.AbsentDeduction) || 0,
    absentComment:      p.AbsentComment || '',
    totalDeductions:    Number(p.TotalDeductions) || 0,
    netPayable:         Number(p.NetPayable) || 0,
    paidAmount:         paid,
    payments:           paid > 0 ? [{ amount: paid, date: payDate, comment: 'Payment recorded' }] : [],
    paidDate:           paid > 0 ? payDate : null,
    generatedAt:        dateOnly(p.CreatedAt),
    empSalaryHeads:     empHeads,
  };
}

/* Fetch all saved payroll records for a branch in one month/year and return them
   keyed for merging into the Financials empPayroll state:
     { [employeeID]: { 'YYYY-MM': record } }
   Employees with no payroll that month simply don't appear (→ Not Generated).
   GET /api/HR/get-payroll-by-branch/{branchID}/{month}/{year}. */
export async function getHrPayrollByBranch(month, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const m = Number(month) || 0;
  const y = Number(year)  || 0;
  let json = null;
  try {
    const res = await fetch(buildUrl(`/api/HR/get-payroll-by-branch/${branchID}/${m}/${y}`), { headers: { Accept: '*/*' } });
    json = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) return {};
  } catch {
    return {};
  }
  const rows  = Array.isArray(json?.payroll) ? json.payroll : [];
  const heads = Array.isArray(json?.salaryHeads) ? json.salaryHeads : [];

  /* Group the per-employee custom salary heads by employee id. */
  const headsByEmp = {};
  heads.forEach(h => {
    const eid = Number(h.EmployeeID) || 0;
    (headsByEmp[eid] = headsByEmp[eid] || []).push({
      id:     h.ID ?? h.id ?? 0,
      name:   h.HeadName ?? '',
      amount: Number(h.Amount) || 0,
      type:   (h.IsAllowance === false) ? 'deduct' : 'allow',
    });
  });

  const out = {};
  rows.forEach(p => {
    const eid = Number(p.EmployeeID) || 0;
    const key = `${Number(p.PayrollYear)}-${String(Number(p.PayrollMonth)).padStart(2, '0')}`;
    (out[eid] = out[eid] || {})[key] = mapApiPayrollRecord(p, headsByEmp[eid] || []);
  });
  return out;
}

/* Save the payroll setup for one employee/month (bonus, loan/fine/leave/absent
   deductions + comments). POST /api/HR/payroll-setup. */
export async function saveHrPayrollSetup(p = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const res  = await fetch(buildUrl('/api/HR/payroll-setup'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeID:       Number(p.employeeID) || 0,
      branchID,
      payrollMonth:     Number(p.payrollMonth) || 0,
      payrollYear:      Number(p.payrollYear) || 0,
      bonus:            Number(p.bonus) || 0,
      loanDeduction:    Number(p.loanDeduction) || 0,
      customLoanAmount: Number(p.customLoanAmount) || 0,
      fineDeduction:    Number(p.fineDeduction) || 0,
      fineComment:      p.fineComment || '',
      leaveCount:       Number(p.leaveCount) || 0,
      leaveDeduction:   Number(p.leaveDeduction) || 0,
      leaveComment:     p.leaveComment || '',
      absentCount:      Number(p.absentCount) || 0,
      absentDeduction:  Number(p.absentDeduction) || 0,
      absentComment:    p.absentComment || '',
      createdBy:        userID,
      modifiedBy:       userID,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save payroll setup');
  return json;
}

/* Delete a whole payroll record — the setup AND its payments — for one
   employee/month. Called from the Pay Roll modal's Delete button and the row
   Actions menu. DELETE /api/HR/delete-employee-payroll/{payrollId}?force=...

   When payments (or loan repayments) already exist, the backend refuses a plain
   delete with a 400 whose body is
     { success:false, message, data:{ PaymentCount, PaidAmount, LoanRepaymentCount } }.
   In that case we throw a structured error (err.blocked = true, err.details =
   data) so the UI can show a "payments already recorded — still delete?" popup
   and retry with force:true, which forces the delete through. */
export async function deleteHrPayroll(payrollID, { force = false } = {}) {
  if (!payrollID) throw new Error('Missing payroll id');
  const res = await fetch(
    buildUrl(`/api/HR/delete-employee-payroll/${payrollID}?force=${force ? 'true' : 'false'}`),
    { method: 'DELETE', headers: { Accept: '*/*' } }
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const data = json?.data;
    const hasPayments = data && (Number(data.PaymentCount) > 0 || Number(data.LoanRepaymentCount) > 0);
    if (!force && hasPayments) {
      const err = new Error(apiMessage(json) || 'This payroll already has recorded payments.');
      err.blocked = true;
      err.details = data;
      throw err;
    }
    throw new Error(apiMessage(json) || 'Could not delete payroll');
  }
  return json;
}

/* Pull the payroll record id out of a payroll-setup response (needed to attach
   payments to it). */
export function payrollIdFromSetupResponse(json) {
  const d = json?.data ?? json;
  if (d && typeof d === 'object') return Number(d.id ?? d.payrollID ?? d.ID) || 0;
  return Number(d) || 0;
}

/* Record a payment against a saved payroll record. POST /api/HR/save-payroll-payment. */
export async function saveHrPayrollPayment({ payrollID, amount, comment, paymentDate } = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const res  = await fetch(buildUrl('/api/HR/save-payroll-payment'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payrollID:   Number(payrollID) || 0,
      branchID,
      amount:      Number(amount) || 0,
      comment:     comment || '',
      paymentDate: paymentDate || new Date().toISOString(),
      createdBy:   userID,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not record payment');
  return json;
}

/* ═══════════════════════════════════════════════════════════════════
   ADVANCE / LOAN — /api/HR/*-employee-loan[-repayment] endpoints.
   ═══════════════════════════════════════════════════════════════════ */

/* One backend loan row (get-employee-loans) → the Advance/Loan modal's shape. */
function mapApiLoan(l = {}) {
  return {
    id:                l.ID,
    loanNumber:        l.LoanNo,
    amount:            Number(l.LoanAmount) || 0,
    comment:           l.Comments || '',
    repaymentType:     l.RepaymentType || '',        // 'Installment' | 'OneTime'
    deductDate:        dateOnly(l.RepaymentDate),
    installmentType:   l.InstallmentType || null,    // 'Monthly' | …
    installmentAmount: Number(l.InstallmentAmount) || 0,
    status:            String(l.Status || '').toLowerCase() === 'active' ? 'active' : 'returned',
    remaining:         Number(l.Remaining) || 0,
    createdAt:         dateOnly(l.CreatedAt),
    received: (Array.isArray(l.Repayments) ? l.Repayments : []).map(r => ({
      amount:  Number(r.Amount) || 0,
      date:    dateOnly(r.RepaymentDate),
      comment: r.Comments || '',
      source:  r.Source || '',
    })),
  };
}

/* Load an employee's loans (+ their repayments). GET /api/HR/get-employee-loans/
   {employeeId}?branchId={branchId}. Returns the mapped loan array (the caller
   recomputes the summary from it, matching the server's summary block). */
export async function getHrEmployeeLoans(employeeId) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const res = await fetch(buildUrl(`/api/HR/get-employee-loans/${employeeId}?branchId=${branchID}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load loans');
  return Array.isArray(json?.loans) ? json.loans.map(mapApiLoan) : [];
}

/* Create a new employee loan/advance. POST /api/HR/save-employee-loan. */
export async function saveHrEmployeeLoan(p = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const res = await fetch(buildUrl('/api/HR/save-employee-loan'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:                0,
      employeeID:        Number(p.employeeID) || 0,
      branchID,
      loanAmount:        Number(p.loanAmount) || 0,
      comments:          p.comments || '',
      repaymentType:     p.repaymentType || '',
      repaymentDate:     toIso(p.repaymentDate),
      installmentType:   p.installmentType || '',
      installmentAmount: Number(p.installmentAmount) || 0,
      createdBy:         userID,
      modifiedBy:        userID,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(apiMessage(json) || 'Could not save loan');
  return json;
}

/* Record a repayment against a loan. POST /api/HR/save-employee-loan-repayment. */
export async function saveHrEmployeeLoanRepayment(p = {}) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const res = await fetch(buildUrl('/api/HR/save-employee-loan-repayment'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:            0,
      loanID:        Number(p.loanID) || 0,
      branchID,
      amount:        Number(p.amount) || 0,
      repaymentDate: toIso(p.repaymentDate),
      comments:      p.comments || '',
      createdBy:     userID,
      modifiedBy:    userID,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(apiMessage(json) || 'Could not save repayment');
  return json;
}

/* Mark a loan fully returned. POST /api/HR/mark-employee-loan-returned/{loanId}
   ?modifiedBy={loginUserId}. */
export async function markHrEmployeeLoanReturned(loanId) {
  const userID = Number(sessionStorage.getItem('UserID')) || 0;
  const res = await fetch(buildUrl(`/api/HR/mark-employee-loan-returned/${loanId}?modifiedBy=${userID}`), {
    method: 'POST',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(apiMessage(json) || 'Could not mark loan returned');
  return json;
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
  const assignmentRows = e.assignments ?? e.subjectAssignments ?? e.employeeSubjects ?? e.subjects ?? [];
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
    emergency: e.emergencyContact ?? e.EmergencyContact ?? '',
    email:     e.email,
    blood:     e.bloodGroup,
    nationality: e.countryName,
    address:   e.address,

    join:      dateOnly(e.dateOfJoining),
    status:    e.isActive ? 'Active' : 'Inactive',

    dId:       e.departmentID,
    desId:     e.designationID,
    type:      e.employmentType ?? '',
    manager:   e.reportingManagerName ?? '',
    shift:     e.shiftDutyTime ?? '',
    role:      e.responsibilities ?? '',
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
    subjects: assignmentRows.reduce((acc, a) => {
      const gradeId   = Number(a.gradeId   ?? a.gradeID   ?? a.grade_id   ?? 0);
      const sectionId = Number(a.sectionId ?? a.sectionID ?? a.section_id ?? 0);
      const subjectId = Number(a.subjectId ?? a.subjectID ?? a.subject_id ?? 0);
      if (!gradeId || !sectionId || !subjectId) return acc;
      const key = `${gradeId}_${sectionId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(subjectId);
      return acc;
    }, {}),
    /* Human-readable assignment rows for the detail panel / report (the API
       carries the names alongside the ids, same as the toggle payload). */
    subjectsDisplay: assignmentRows.map(a => ({
      className:   a.className   ?? a.gradeName   ?? a.grade   ?? '',
      sectionName: a.sectionName ?? a.section     ?? '',
      subjectName: a.subjectName ?? a.subject     ?? '',
    })).filter(x => x.subjectName),

    /* Class-attendance assignments → [{ gradeId, sectionId, className, sectionName }]
       (names come straight from the API, same shape as the toggle payload). */
    attendance: (e.classSectionAttendanceAssignments ?? e.attendanceAssignments ?? []).map(a => ({
      gradeId:     Number(a.gradeId   ?? a.gradeID   ?? 0),
      sectionId:   Number(a.sectionId ?? a.sectionID ?? 0),
      className:   a.className   ?? a.gradeName ?? '',
      sectionName: a.sectionName ?? '',
    })).filter(a => a.gradeId && a.sectionId),

    stdDocs: docStd,
    docs:    docCustom,
    tasks: [], letters: [],
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
    emergencyContact:   payload.emergency ?? '',
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
    reportingManagerName: payload.manager ?? '',
    employmentType:       payload.type ?? '',
    shiftDutyTime:        payload.shift ?? '',
    responsibilities:     payload.role ?? '',
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

/* ─── Issue Letters (real API: /api/HR/*-issue-letter*) ───────────────
   save-issue-letter (multipart, uploads the generated letter file),
   get-issue-letters-by-branch/{branchId} (all branch letters) and
   delete-issue-letter/{id}. The save endpoint stores ONLY a file per
   employee — no type/subject/ref columns — so the letter's identity is
   carried in the uploaded file name and re-derived on read. */

/* A stored file path → a browser-openable URL (absolute stays as-is; a
   server-relative path gets the API base prefixed). */
export function hrFileUrl(path) {
  if (!path) return '';
  if (/^https?:/i.test(path)) return path;
  const base = getBaseUrl();
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/* One API issue-letter row → the shape the UI list renders. Field names
   are read defensively because the response casing/keys aren't fixed. */
function mapIssueLetter(l = {}) {
  /* The API stores only a file per employee (no type/subject/ref columns) and
     returns PascalCase keys: { ID, EmployeeID, EmployeeName, IssueLetter, … }.
     IssueLetter is already an absolute URL to the uploaded file. */
  const path =
    l.IssueLetter ?? l.issueLetter ?? l.issueLetterPath ?? l.documentPath ?? l.path ?? '';
  const fileName = String(path).split(/[/\\]/).pop() || '';
  const ext = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] || '').toUpperCase();
  return {
    id:         l.ID ?? l.id ?? l.issueLetterID ?? l.issueLetterId ?? 0,
    employeeId: l.EmployeeID ?? l.employeeID ?? l.employeeId ?? l.EmployeeId ?? 0,
    empName:    l.EmployeeName ?? l.employeeName ?? '',
    path,
    url:        hrFileUrl(path),
    label:      'Issued Letter',
    fileType:   ext,
    fileName,
    date:       dateOnly(l.CreatedAt ?? l.createdAt ?? l.ModifiedAt ?? l.modifiedAt ?? ''),
  };
}

/* Upload one issued letter (the generated letter file) for an employee.
   POST /api/HR/save-issue-letter (multipart). */
export async function saveHrIssueLetter({ employeeId, file } = {}) {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const fd = new FormData();
  fd.append('employeeId',     employeeId ?? 0);
  fd.append('branchId',       branchId);
  fd.append('createdBy',      userID);
  fd.append('modifiedBy',     userID);
  fd.append('IssueLetterFile', file);
  const res  = await fetch(buildUrl('/api/HR/save-issue-letter'), {
    method: 'POST', headers: { Accept: '*/*' }, body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not save issue letter');
  }
  return json?.data ?? json;
}

/* All issue letters for the active branch, mapped. GET
   /api/HR/get-issue-letters-by-branch/{branchId}. */
export async function getHrIssueLettersByBranch(branchId) {
  const bId  = Number(branchId ?? sessionStorage.getItem('branchID')) || 0;
  const res  = await fetch(buildUrl(`/api/HR/get-issue-letters-by-branch/${bId}`), {
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load issue letters');
  const list = Array.isArray(json?.data) ? json.data
             : Array.isArray(json)       ? json
             : Array.isArray(json?.issueLetters) ? json.issueLetters
             : [];
  /* delete-issue-letter is a soft delete (IsActive=false) but the GET still
     returns those rows — drop them so deleted letters disappear from the list. */
  return list
    .filter(l => (l.IsActive ?? l.isActive) !== false)
    .map(mapIssueLetter);
}

/* Issue letters for one employee (filtered from the branch list). */
export async function getHrIssueLettersByEmployee(employeeId) {
  const all = await getHrIssueLettersByBranch();
  return all.filter(l => Number(l.employeeId) === Number(employeeId));
}

/* DELETE /api/HR/delete-issue-letter/{id}. */
export async function deleteHrIssueLetter(id) {
  const res  = await fetch(buildUrl(`/api/HR/delete-issue-letter/${id || 0}`), {
    method: 'DELETE', headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not delete issue letter');
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
  set('EmergencyContact',   payload.emergency);
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
  set('EmploymentType',       payload.type);
  set('ReportingManagerName', payload.manager);
  set('ShiftDutyTime',        payload.shift);
  set('Responsibilities',     payload.role);
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

  /* Duplicate (phone/CNIC) par backend HTTP 200 + data[0] = { Success:0,
     Message:"Number already exist" } deta hai. Isy fail samjho — aur agar number-
     duplicate hai to error par flag lagao taake caller email-popup dikha sake. */
  const inner1 = Array.isArray(json1?.data) ? json1.data[0] : null;
  if (inner1 && (inner1.Success === 0 || inner1.Success === false)) {
    const e = new Error(inner1.Message || apiMessage(json1) || 'Number already exist');
    e.isDuplicatePhone = /exist|number|already/i.test(e.message);
    throw e;
  }

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

  /* ── 8. Class-attendance assignments — toggle only what changed ── */
  await syncAttendanceAssignments(employeeId, payload.attendance || [], payload.attendanceOriginal || []);

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

/* One class-attendance toggle. This endpoint is a true toggle — calling it for
   a class/section that isn't assigned ADDS it; calling again REMOVES it (no
   isChecked flag), so we only fire it for class/sections whose state changed. */
export async function toggleHrAttendanceAssignment({ employeeId, gradeId, sectionId, className = '', sectionName = '' }) {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const now      = new Date().toISOString();
  const res  = await fetch(buildUrl('/api/HR/toggle-Employees_ClassSection_Attendance_Assignments'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 0,
      employeId:  Number(employeeId) || 0,
      gradeId:    Number(gradeId) || 0,
      sectionId:  Number(sectionId) || 0,
      branchId,
      createdBy:  userID,
      createdAt:  now,
      modifiedBy: userID,
      modifiedAt: now,
      className, sectionName,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not update attendance assignment');
  return json;
}

/* Diff desired vs original attendance ([{ gradeId, sectionId, ... }]) and fire a
   toggle for each add/remove (the endpoint flips existence). */
async function syncAttendanceAssignments(employeeId, desired = [], original = []) {
  const key = (a) => `${a.gradeId}_${a.sectionId}`;
  const desiredKeys  = new Set(desired.map(key));
  const originalKeys = new Set(original.map(key));
  const changed = [
    ...desired.filter(a => !originalKeys.has(key(a))),
    ...original.filter(a => !desiredKeys.has(key(a))),
  ];
  for (const a of changed) {
    try { await toggleHrAttendanceAssignment({ employeeId, gradeId: a.gradeId, sectionId: a.sectionId, className: a.className, sectionName: a.sectionName }); }
    catch (e) { /* surfaced by reload */ }
  }
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