import { mockPreEnrollStudents, mockPreEnrollFeeHeads } from '../mock/preEnrollment';
import { delay, clone } from './_http';

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getPreEnrollFeeHeads() { await delay(); return clone(mockPreEnrollFeeHeads); }
export async function getPreEnrollStudents() { await delay(); return clone(mockPreEnrollStudents); }

/* Write APIs — mutate the shared array in place so the list stays
   consistent across re-fetches within the same session. */
export async function savePreEnrollStudent(payload) {
  await delay();
  const record = { challan: null, payments: [], ...payload };
  mockPreEnrollStudents.push(record);
  return clone(record);
}

export async function savePreEnrollChallan({ preId, challan }) {
  await delay();
  const record = mockPreEnrollStudents.find(s => s.preId === preId);
  if (!record) throw new Error(`Pre-enrolled student ${preId} not found`);
  record.challan = challan;
  return clone(record);
}

export async function savePreEnrollReceiving({ preId, payment }) {
  await delay();
  const record = mockPreEnrollStudents.find(s => s.preId === preId);
  if (!record) throw new Error(`Pre-enrolled student ${preId} not found`);
  record.payments = [...(record.payments || []), payment];
  return clone(record);
}

export async function removePreEnrollStudent(preId) {
  await delay();
  const idx = mockPreEnrollStudents.findIndex(s => s.preId === preId);
  if (idx >= 0) mockPreEnrollStudents.splice(idx, 1);
  return { preId, removed: true };
}
