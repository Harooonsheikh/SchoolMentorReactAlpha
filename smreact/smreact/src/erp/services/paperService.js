import { mockPapers, mockPaperClasses } from '../mock/papers';
import { delay, clone } from './_http';

export async function getPaperClasses() {
  await delay();
  return clone(mockPaperClasses);
}

export async function getAllPapers() {
  await delay();
  return clone(mockPapers);
}

export async function getPapersForClass(classKey) {
  await delay();
  return clone(mockPapers[classKey] || []);
}

export async function createPaper(classKey, payload) {
  await delay();
  return clone({ ...payload, classKey });
}

export async function updatePaper(classKey, index, payload) {
  await delay();
  return clone({ ...payload, classKey, index });
}

export async function deletePaper(classKey, index) {
  await delay();
  return { classKey, index, deleted: true };
}

export async function shufflePaper(classKey, index) {
  await delay();
  return { classKey, index, shuffled: true };
}
