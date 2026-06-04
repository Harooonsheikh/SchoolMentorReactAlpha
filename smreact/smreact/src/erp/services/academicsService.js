import {
  mockTerms,
  mockTermData,
  mockActivities,
  mockTextBooks,
  mockSession,
  mockVacations,
} from '../mock/academics';
import {
  mockTermBreakupClasses,
  mockUnits,
  mockNbUnits,
  mockSubLpData,
  mockSubNbData,
} from '../mock/lessonPlans';
import { delay, clone } from './_http';

export async function getTermBreakupClasses() { await delay(); return clone(mockTermBreakupClasses); }
export async function getUnits()              { await delay(); return clone(mockUnits); }
export async function getNbUnits()            { await delay(); return clone(mockNbUnits); }
export async function getSubLpData()          { await delay(); return clone(mockSubLpData); }
export async function getSubNbData()          { await delay(); return clone(mockSubNbData); }

export async function getSession() {
  await delay();
  return clone(mockSession);
}

export async function saveSession(payload) {
  await delay();
  return clone({ ...mockSession, ...payload });
}

export async function getVacations() {
  await delay();
  return clone(mockVacations);
}

export async function saveVacations(vacations) {
  await delay();
  return clone(vacations);
}

export async function getTerms() {
  await delay();
  return clone(mockTerms);
}

export async function getTermData() {
  await delay();
  return clone(mockTermData);
}

export async function saveTerm(id, payload) {
  await delay();
  return clone({ ...payload, id });
}

export async function deleteTerm(id) {
  await delay();
  return { id, deleted: true };
}

export async function getActivities() {
  await delay();
  return clone(mockActivities);
}

export async function createActivity(payload) {
  await delay();
  return clone({ ...payload, id: Date.now() });
}

export async function updateActivity(id, payload) {
  await delay();
  return clone({ ...payload, id });
}

export async function deleteActivity(id) {
  await delay();
  return { id, deleted: true };
}

export async function getTextBooks() {
  await delay();
  return clone(mockTextBooks);
}
