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
export async function getHrEmployees()   { await delay(); return clone(mockHrEmployees); }
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
export async function saveHrEmployee(payload) { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteHrEmployee({ id }){ await delay(); return { id, deleted: true }; }

/* ─── HR Module — Payroll (Step 5) ─── */
export async function getHrPayroll()           { await delay(); return clone(mockHrPayroll); }
export async function getHrNextPayrollId()     { await delay(); return mockHrNextPayrollId; }
export async function saveHrPayrollRun(run)    { await delay(); return clone({ ...run, ok: true }); }
export async function deleteHrPayrollRun({ id }){ await delay(); return { id, deleted: true }; }
export async function markHrPayrollPaid(p)     { await delay(); return clone({ ...p, ok: true }); }

/* ─── HR Module — Letters (Step 7) ─── */
export async function saveHrLetter(payload)    { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteHrLetter({ empId, letterId }) { await delay(); return { empId, letterId, deleted: true }; }
