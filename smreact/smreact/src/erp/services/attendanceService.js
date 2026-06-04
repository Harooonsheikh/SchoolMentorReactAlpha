import {
  mockWeeklyOff,
  mockHolidays,
  mockStudentAttendanceClasses,
  mockStaffAttendance,
} from '../mock/attendance';
import { delay, clone } from './_http';

export async function getWeeklyOff() {
  await delay();
  return clone(mockWeeklyOff);
}

export async function saveWeeklyOff(days) {
  await delay();
  return clone(days);
}

export async function getHolidays() {
  await delay();
  return clone(mockHolidays);
}

export async function createHoliday(payload) {
  await delay();
  return clone({ ...payload, id: Date.now() });
}

export async function updateHoliday(id, payload) {
  await delay();
  return clone({ ...payload, id });
}

export async function deleteHoliday(id) {
  await delay();
  return { id, deleted: true };
}

export async function getStudentAttendance(month) {
  await delay();
  return clone(mockStudentAttendanceClasses);
}

export async function getStaffAttendance(month) {
  await delay();
  return clone(mockStaffAttendance);
}

export async function markStudentAttendance(classId, records) {
  await delay();
  return { classId, marked: records.length };
}

export async function markStaffAttendance(records) {
  await delay();
  return { marked: records.length };
}
