import {
  mockStudents,
  mockStudentStats,
  mockRecentAdmissions,
  mockStuClasses,
  mockStuInactive,
  mockStuFamilies,
  mockStuClassList,
  mockStuSectionList,
  mockStuFeeHeads,
  mockStuInactiveReasons,
  mockStuSchool,
  mockStuNextReg,
  mockStuNextAdm,
  mockStuNextFamId,
} from '../mock/students';
import { delay, clone } from './_http';

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
export async function getStuClasses()         { await delay(); return clone(mockStuClasses); }
export async function getStuInactive()        { await delay(); return clone(mockStuInactive); }
export async function getStuFamilies()        { await delay(); return clone(mockStuFamilies); }
export async function getStuClassList()       { await delay(); return clone(mockStuClassList); }
export async function getStuSectionList()     { await delay(); return clone(mockStuSectionList); }
export async function getStuFeeHeads()        { await delay(); return clone(mockStuFeeHeads); }
export async function getStuInactiveReasons() { await delay(); return clone(mockStuInactiveReasons); }
export async function getStuSchool()          { await delay(); return clone(mockStuSchool); }
export async function getStuNextReg()         { await delay(); return mockStuNextReg; }
export async function getStuNextAdm()         { await delay(); return mockStuNextAdm; }
export async function getStuNextFamId()       { await delay(); return mockStuNextFamId; }

/* ─── Write APIs (in-memory only) ─── */
export async function saveStuStudent(payload)   { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteStuStudent({ reg }) { await delay(); return { reg, deleted: true }; }
export async function promoteStuStudents(payload) { await delay(); return clone({ ...payload, ok: true }); }
export async function inactivateStuStudent(payload) { await delay(); return clone({ ...payload, ok: true }); }
export async function reactivateStuStudent({ reg }) { await delay(); return { reg, reactivated: true }; }
export async function settleStuDues(payload)    { await delay(); return clone({ ...payload, ok: true }); }
export async function saveStuFamily(payload)    { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteStuFamily({ id })   { await delay(); return { id, deleted: true }; }
