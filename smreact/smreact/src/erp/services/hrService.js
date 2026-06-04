import {
  mockStaff,
  mockHrStats,
  mockHrDepts,
  mockHrDesigs,
  mockHrEmployees,
  mockHrNextDeptId,
  mockHrNextDesigId,
  mockHrNextEmpId,
  mockHrPayroll,
  mockHrNextPayrollId,
} from '../mock/hr';
import { delay, clone } from './_http';

/* ─── Legacy APIs (Dashboard) — unchanged ─── */
export async function getStaff()    { await delay(); return clone(mockStaff); }
export async function getHrStats()  { await delay(); return clone(mockHrStats); }
export async function getStaffById(id) {
  await delay();
  const found = mockStaff.find(s => s.id === id);
  return found ? clone(found) : null;
}

/* ─── HR Module — Read APIs ─── */
export async function getHrDepts()       { await delay(); return clone(mockHrDepts); }
export async function getHrDesigs()      { await delay(); return clone(mockHrDesigs); }
export async function getHrEmployees()   { await delay(); return clone(mockHrEmployees); }
export async function getHrNextDeptId()  { await delay(); return mockHrNextDeptId; }
export async function getHrNextDesigId() { await delay(); return mockHrNextDesigId; }
export async function getHrNextEmpId()   { await delay(); return mockHrNextEmpId; }

/* ─── HR Module — Write APIs (in-memory) ─── */
export async function saveHrDept(payload)     { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteHrDept({ id })    { await delay(); return { id, deleted: true }; }
export async function saveHrDesig(payload)    { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteHrDesig({ id })   { await delay(); return { id, deleted: true }; }
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
