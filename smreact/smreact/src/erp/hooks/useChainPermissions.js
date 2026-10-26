import { useEffect, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   CHAIN (Head Office) PERMISSIONS — School-side consumer.

   The Chain School Portal (Head Office / Franchise controller) decides,
   per associate school, which Academics / Examination actions this
   school may perform (View Only / Add / Edit / Delete per content
   section). The two apps are separate frontends with no shared backend
   yet, so the Chain Portal exports a JSON payload that a Chain Admin
   pastes into this ERP (Settings → Chain School). It is stored here
   under `sm_chain_permissions`, and this hook reads it to gate the
   relevant UI.

   Payload shape (mirrors the Chain Portal's per-school map):
     {
       source: 'chain-school-portal', version, schoolId, schoolName, schoolCode,
       modules: { academics: bool, examination: bool },
       modulePermissions: {
         academics:   { manageTerms: {view,add,edit,delete}, ... },
         examination: { examSetup: {...}, resultSetup: {...} },
       },
       centralClasses: [{ id, name }],   // e.g. [{id:1,name:'Nursery'}, {id:3,name:'Class 1'}, ...]
     }

   centralClasses is the exact { id, name } list and id space the Chain
   Portal's own exam editor selects "Applicable classes" from — Settings
   → Branch Class Mapping maps this school's local classes against these
   same ids, so Head Office assigning an exam to a central class id
   resolves to the right local class here with no name-matching
   guesswork. Absent (no payload, or an old payload from before this
   field existed) ⇒ no central classes are available yet — Branch Class
   Mapping shows an honest "not connected / payload out of date" state
   rather than inventing a class list.

   DEFAULT WHEN ABSENT = FULL ACCESS. A school with no Head-Office payload
   (not chain-connected, or nothing configured) is completely unrestricted
   — so nothing changes for standalone schools. Restriction only applies
   where a payload explicitly defines a section's action map.

   Swap the localStorage read/write for a real API call when the backend
   lands — the hook's surface stays the same.
   ═══════════════════════════════════════════════════════════════════ */

export const CHAIN_PERMS_KEY = 'sm_chain_permissions';
const CHANGE_EVENT = 'sm-chain-perms-changed';

const FULL = { view: true, add: true, edit: true, delete: true, restricted: false };

export function loadChainPermissions() {
  try { return JSON.parse(localStorage.getItem(CHAIN_PERMS_KEY)) || null; } catch { return null; }
}

export function saveChainPermissions(payload) {
  localStorage.setItem(CHAIN_PERMS_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearChainPermissions() {
  localStorage.removeItem(CHAIN_PERMS_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/* Resolve one content section's allowed actions. Returns
   {view,add,edit,delete,restricted}. `restricted` is true only when a
   Head-Office payload actually governs this section — the UI uses it to
   decide whether to show the "controlled by Head Office" messaging. */
export function resolveSectionPerm(payload, moduleKey, sectionKey) {
  if (!payload || !payload.modulePermissions) return FULL;
  const mp = payload.modulePermissions[moduleKey];
  if (!mp) return FULL;
  const sp = mp[sectionKey];
  if (!sp) return FULL;
  return {
    view: sp.view !== false,   // View is implied whenever any access is granted
    add: !!sp.add,
    edit: !!sp.edit,
    delete: !!sp.delete,
    restricted: true,
  };
}

export function useChainPermissions() {
  const [payload, setPayload] = useState(loadChainPermissions);

  useEffect(() => {
    const sync = () => setPayload(loadChainPermissions());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync); // other tabs / windows
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  /* sectionPerm(moduleKey, sectionKey) → {view,add,edit,delete,restricted} */
  const sectionPerm = (moduleKey, sectionKey) => resolveSectionPerm(payload, moduleKey, sectionKey);

  /* Head Office exam package carried in the same payload (read-only here):
       examinations: live exams for this school ({ id, name, term, classes, from, to, managedBy, version })
       resultPolicies: one live policy per result system, like the school's own Result Setup:
         grade     → { name, absentMode, grades, remarks, managedBy, version }        (Grade 1–12)
         preschool → { name, learningAreas, gradingScale, slo, psdFields, cardOptions,
                       managedBy, version }                                           (Preschool / Montessori)
     Absent ⇒ nothing is managed. */
  const managedExams = Array.isArray(payload?.examinations) ? payload.examinations : [];
  const headOfficeGradePolicy = payload?.resultPolicies?.grade || null;
  const headOfficePreschoolPolicy = payload?.resultPolicies?.preschool || null;
  const centralClasses = Array.isArray(payload?.centralClasses) ? payload.centralClasses : [];

  return { payload, sectionPerm, managedExams, headOfficeGradePolicy, headOfficePreschoolPolicy, centralClasses };
}
