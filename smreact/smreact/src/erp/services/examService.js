import {
  mockExams, mockClasses, mockSubjects,
  mockSyllabus, mockDateSheets,
  mockRsGrades, mockRsSigs, mockRsRemarks,
  mockRcoGeneral, mockRcoSig,
  mockResultData,
  mockCbrResults,
} from '../mock/exams';
import { delay, clone } from './_http';

export async function getResultData()  { await delay(); return clone(mockResultData); }
export async function getCbrResults()  { await delay(); return clone(mockCbrResults); }

export async function getSyllabus()    { await delay(); return clone(mockSyllabus); }
export async function getDateSheets()  { await delay(); return clone(mockDateSheets); }
export async function getRsGrades()    { await delay(); return clone(mockRsGrades); }
export async function getRsSigs()      { await delay(); return clone(mockRsSigs); }
export async function getRsRemarks()   { await delay(); return clone(mockRsRemarks); }
export async function getRcoGeneral()  { await delay(); return clone(mockRcoGeneral); }
export async function getRcoSig()      { await delay(); return clone(mockRcoSig); }

export async function getExams() {
  await delay();
  return clone(mockExams);
}

export async function getExamById(id) {
  await delay();
  const found = mockExams.find(e => e.id === id);
  return found ? clone(found) : null;
}

export async function getExamsByTerm(term) {
  await delay();
  return clone(mockExams.filter(e => e.term === term));
}

export async function createExam(payload) {
  await delay();
  return clone({ ...payload, id: Date.now() });
}

export async function updateExam(id, payload) {
  await delay();
  return clone({ ...payload, id });
}

export async function deleteExam(id) {
  await delay();
  return { id, deleted: true };
}

export async function getClasses() {
  await delay();
  return clone(mockClasses);
}

export async function getSubjects() {
  await delay();
  return clone(mockSubjects);
}
