import {
  mockLearningAreas, mockGradingScale, mockSloStatements, mockPsdFields,
  mockClassAssessmentType, mockClassPreschoolLevel, mockPreschoolLevels,
  mockPreschoolResultData, mockPRco,
} from '../mock/preschool';
import { delay, clone } from './_http';

export async function getLearningAreas() { await delay(); return clone(mockLearningAreas); }
export async function saveLearningAreas(list) {
  await delay();
  mockLearningAreas.length = 0;
  mockLearningAreas.push(...(list || []).map(x => ({ ...x })));
  return clone(mockLearningAreas);
}

export async function getGradingScale() { await delay(); return clone(mockGradingScale); }
export async function saveGradingScale(list, renameMap) {
  await delay();
  mockGradingScale.length = 0;
  mockGradingScale.push(...(list || []).map(x => ({ ...x })));
  if (renameMap && Object.keys(renameMap).length) {
    Object.values(mockPreschoolResultData).forEach(bucket => {
      (bucket.students || []).forEach(rec => {
        Object.values(rec.achievements || {}).forEach(area => {
          Object.keys(area).forEach(sloId => {
            if (renameMap[area[sloId]]) area[sloId] = renameMap[area[sloId]];
          });
        });
        Object.keys(rec.psd || {}).forEach(fieldId => {
          if (renameMap[rec.psd[fieldId]]) rec.psd[fieldId] = renameMap[rec.psd[fieldId]];
        });
      });
    });
  }
  return clone(mockGradingScale);
}

export async function getPreschoolLevels() { await delay(); return clone(mockPreschoolLevels); }

export async function getSloStatements() { await delay(); return clone(mockSloStatements); }
export async function saveSloStatements(levelId, learningAreaId, statements) {
  await delay();
  if (!mockSloStatements[levelId]) mockSloStatements[levelId] = {};
  mockSloStatements[levelId][learningAreaId] = (statements || []).map(x => ({ ...x }));
  return clone(mockSloStatements[levelId][learningAreaId]);
}
export async function copyLevelSlo(fromLevel, toLevel) {
  await delay();
  const source = mockSloStatements[fromLevel] || {};
  const copy = {};
  Object.keys(source).forEach(laId => {
    copy[laId] = (source[laId] || []).map((s, i) => ({ id: `slo_${toLevel}_${laId}_${i}`, text: s.text }));
  });
  mockSloStatements[toLevel] = copy;
  return clone(mockSloStatements);
}

export async function getPsdFields() { await delay(); return clone(mockPsdFields); }
export async function savePsdFields(list) {
  await delay();
  mockPsdFields.length = 0;
  mockPsdFields.push(...(list || []).map(x => ({ ...x })));
  return clone(mockPsdFields);
}

export async function getClassAssessmentTypes() { await delay(); return clone(mockClassAssessmentType); }
export async function setClassAssessmentType(key, type) {
  await delay();
  if (type === 'preschool') mockClassAssessmentType[key] = 'preschool';
  else delete mockClassAssessmentType[key];
  return clone(mockClassAssessmentType);
}

export async function getClassPreschoolLevels() { await delay(); return clone(mockClassPreschoolLevel); }
export async function setClassPreschoolLevel(key, levelId) {
  await delay();
  if (levelId) mockClassPreschoolLevel[key] = levelId;
  else delete mockClassPreschoolLevel[key];
  return clone(mockClassPreschoolLevel);
}

export async function getPreschoolResultData() { await delay(); return clone(mockPreschoolResultData); }

function ensureClassBucket(key) {
  if (!mockPreschoolResultData[key]) mockPreschoolResultData[key] = { released: false, students: [] };
  return mockPreschoolResultData[key];
}

export async function saveStudentAssessment(key, studentId, patch) {
  await delay();
  const bucket = ensureClassBucket(key);
  const idx = bucket.students.findIndex(s => String(s.studentId) === String(studentId));
  if (idx >= 0) bucket.students[idx] = { ...bucket.students[idx], ...patch };
  else bucket.students.push({ studentId, attendance: { workingDays: 0, presentDays: 0 }, achievements: {}, psd: {}, teacherRemarks: '', ptm: null, ...patch });
  return clone(bucket.students.find(s => String(s.studentId) === String(studentId)));
}

export async function publishClass(key, released) {
  await delay();
  const bucket = ensureClassBucket(key);
  bucket.released = !!released;
  return clone(bucket);
}

export async function getPRco() { await delay(); return clone(mockPRco); }
export async function savePRco(list) {
  await delay();
  mockPRco.length = 0;
  mockPRco.push(...(list || []).map(x => ({ ...x })));
  return clone(mockPRco);
}
