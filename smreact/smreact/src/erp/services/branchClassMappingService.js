import { LOCAL_CLASSES, mockBranchClassMappings } from '../mock/branchClassMapping';
import { delay, clone } from './_http';

/* ═══════════════════════════════════════════════════════════════════
   BRANCH CLASS MAPPING — in-memory service. Same `await delay();
   return clone(...)` contract as every other service in this app —
   replace the body with real HTTP calls when a backend lands, keep
   the shape identical. See mock/branchClassMapping.js for why
   central classes are never read from here (they only ever come from
   the live Chain Portal payload, via useChainPermissions()).
   ═══════════════════════════════════════════════════════════════════ */

let mappings = clone(mockBranchClassMappings);

export async function getLocalClasses() {
  await delay();
  return clone(LOCAL_CLASSES);
}

export async function getMappings(sessionId) {
  await delay();
  return clone(mappings.filter(m => m.sessionId === sessionId));
}

/* Upsert — one row per (sessionId, localClassId). Saving a local class
   that already has a mapping in this session updates it in place
   (still only ever one central class per local class per session);
   saving one with none yet creates a new row. */
export async function saveMapping({ sessionId, localClassId, centralClassId, updatedBy }) {
  await delay();
  if (!sessionId) throw new Error('An academic session is required.');
  if (!LOCAL_CLASSES.some(c => c.id === localClassId)) {
    throw new Error('That local class was not found for this school.');
  }
  if (!centralClassId) throw new Error('Please choose a central academic class.');

  const idx = mappings.findIndex(m => m.sessionId === sessionId && m.localClassId === localClassId);
  const now = new Date().toISOString();
  if (idx >= 0) {
    mappings[idx] = { ...mappings[idx], centralClassId, updatedAt: now, updatedBy: updatedBy || mappings[idx].updatedBy };
    return clone(mappings[idx]);
  }
  const record = {
    id: `bcm-${Date.now()}`,
    sessionId, localClassId, centralClassId,
    updatedAt: now, updatedBy: updatedBy || 'Admin',
  };
  mappings = [...mappings, record];
  return clone(record);
}

/* Removes a mapping — the local class goes back to "Mapping
   Required" for that session. Never touches other sessions' rows or
   any student's class assignment (mapping is purely a lookup table). */
export async function deleteMapping(id) {
  await delay();
  const idx = mappings.findIndex(m => m.id === id);
  if (idx < 0) throw new Error('Mapping not found.');
  mappings = mappings.filter(m => m.id !== id);
}
