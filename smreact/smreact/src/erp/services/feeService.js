import {
  mockFeeClasses,
  mockFeeHeads,
  mockTransportFee,
  mockFeeSettings,
  mockChallans,
  mockReceipts,
  mockFeeHistory,
  mockGeneratedChallans,
  mockFamilies,
  mockGeneratedFamilyChallans,
  mockFamilyReceipts,
} from '../mock/fee';
import { delay, clone } from './_http';

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getFeeClasses()   { await delay(); return clone(mockFeeClasses); }
export async function getFeeHeads()     { await delay(); return clone(mockFeeHeads); }
export async function getTransportFee() { await delay(); return clone(mockTransportFee); }
export async function getFeeSettings()  { await delay(); return clone(mockFeeSettings); }
export async function getChallans()     { await delay(); return clone(mockChallans); }
export async function getReceipts()     { await delay(); return clone(mockReceipts); }
export async function getFeeHistory()   { await delay(); return clone(mockFeeHistory); }

/* Generated-challans set is returned as a fresh Set so callers can
   add / delete locally without disturbing the seed. */
export async function getGeneratedChallans() {
  await delay();
  return new Set(mockGeneratedChallans);
}

/* Family-tree challan readers. */
export async function getFamilies() { await delay(); return clone(mockFamilies); }
export async function getGeneratedFamilyChallans() {
  await delay();
  return new Set(mockGeneratedFamilyChallans);
}

/* Write APIs — in-memory only until backend wires real endpoints. */
export async function saveFeeHeads(classKey, heads) { await delay(); return clone({ classKey, heads }); }
export async function saveTransportFee(classKey, rows) { await delay(); return clone({ classKey, rows }); }
export async function saveStudentTransport(classKey, reg, payload) { await delay(); return clone({ classKey, reg, ...payload }); }
export async function saveFeeSettings(payload) { await delay(); return clone({ ...mockFeeSettings, ...payload }); }
export async function generateChallan(classKey, reg, monthIdx, options) {
  await delay();
  return clone({ classKey, reg, monthIdx, ...options });
}
export async function deleteChallan(classKey, reg, monthIdx) {
  await delay();
  return { classKey, reg, monthIdx, deleted: true };
}
export async function deleteClassChallans(classKey, monthIdx) {
  await delay();
  return { classKey, monthIdx, cleared: true };
}
export async function generateFamilyChallan(famKey, regs, monthIdx, options) {
  await delay();
  return clone({ famKey, regs, monthIdx, ...options });
}
export async function deleteFamilyChallan(famKey, reg, monthIdx) {
  await delay();
  return { famKey, reg, monthIdx, deleted: true };
}
export async function removeFamilyChild(famKey, reg) {
  await delay();
  return { famKey, reg, removed: true };
}

/* Fee Receiving APIs. */
export async function saveReceipt(payload) {
  await delay();
  return clone({ id: `rcv-${Date.now()}`, ...payload });
}
export async function sendFeeReminder(payload) {
  await delay();
  return clone({ ok: true, sentAt: new Date().toISOString(), ...payload });
}
export async function getFamilyReceipts() { await delay(); return clone(mockFamilyReceipts); }
export async function saveFamilyReceipt(payload) {
  await delay();
  return clone({ id: `frcv-${Date.now()}`, ...payload });
}
