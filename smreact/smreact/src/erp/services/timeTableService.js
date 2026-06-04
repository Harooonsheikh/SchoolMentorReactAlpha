import { mockTimeTable, mockTimeTableClasses } from '../mock/timetable';
import { delay, clone } from './_http';

export async function getTimeTable() {
  await delay();
  return clone(mockTimeTable);
}

export async function getTimeTableForDay(day) {
  await delay();
  return clone(mockTimeTable[day] || {});
}

export async function getTimeTableClasses() {
  await delay();
  return clone(mockTimeTableClasses);
}

export async function saveTimeTable(day, classKey, periods) {
  await delay();
  return { day, classKey, periods: clone(periods) };
}

export async function deleteDayTimeTable(day) {
  await delay();
  return { day, cleared: true };
}

export async function autoGenerateTimeTable(config) {
  await delay(400);
  return { generated: true, config: clone(config) };
}
