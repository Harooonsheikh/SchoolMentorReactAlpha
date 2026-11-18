/* ═══════════════════════════════════════════════════════════════════
   LESSON PLANS · CLASS GROUPS — mock store (frontend-only)
   ───────────────────────────────────────────────────────────────────
   Ported from the reference branch's academicsService.getCustomSections
   (mock). Persists the list of sections that have a SEPARATE plan
   (taken out of their class group) in localStorage, scoped per
   branch + academic session, so the Class Groups flow works end to end
   inside the ERP until the backend ships class-group APIs.

   Keys are `${classID}__${sectionID}` using the ERP's real ids.

   BACKEND TODO (no endpoint exists yet):
     GET  /api/lpclassgroups?branchID&sessionID        → [{classID, sectionID}]
     POST /api/lpclassgroupscrud {classID, sectionID, action:'separate'|'rejoin'}
   ═══════════════════════════════════════════════════════════════════ */
import { mockCustomSections } from '../mock/lessonPlansClassGroups';

const STORE_PREFIX = 'sm_lp_class_groups';

export const cgScopeKey = (classID, sectionID) => `${classID}__${sectionID}`;

function storeKey() {
  const branchID = sessionStorage.getItem('branchID') || '';
  const sessionID = sessionStorage.getItem('changeSessionId')
    || sessionStorage.getItem('sessionID')
    || sessionStorage.getItem('SessionID') || '';
  return `${STORE_PREFIX}__${branchID}__${sessionID}`;
}

function read() {
  try {
    const raw = localStorage.getItem(storeKey());
    if (raw == null) return [...mockCustomSections];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(String) : [...mockCustomSections];
  } catch (_) {
    return [...mockCustomSections];
  }
}

function write(list) {
  try { localStorage.setItem(storeKey(), JSON.stringify(list)); } catch (_) { /* storage blocked → in-memory only */ }
}

/** Sections with a separate plan (taken out of their class group). */
export async function getCustomSections() {
  return read();
}

/** Take a section out of its class group. */
export async function separateSection(classID, sectionID) {
  const k = cgScopeKey(classID, sectionID);
  const next = [...read().filter(x => x !== k), k];
  write(next);
  return next;
}

/** Put a section back in its class group. */
export async function rejoinSection(classID, sectionID) {
  const k = cgScopeKey(classID, sectionID);
  const next = read().filter(x => x !== k);
  write(next);
  return next;
}
