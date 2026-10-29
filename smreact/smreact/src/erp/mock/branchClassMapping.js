/* Class names this school teaches (same list as the Students mock). */
const LOCAL_CLASS_NAMES = [
  'Grade 9 – A',
  'Grade 8 – B',
  'Grade 10 – A',
  'Grade 7 – C',
  'Grade 11 – A',
  'Nursery',
  'Prep',
  'Class 1',
  'Class 3',
  'Class 5',
  'Class 4',
  'Class 6',
];

/* ═══════════════════════════════════════════════════════════════════
   BRANCH CLASS MAPPING — mock data.

   Lets this school map its own locally-named classes (e.g. "Grade 1",
   "Class I") to the standard "central academic classes" the Chain
   School Portal uses (e.g. "Class 1"), so Head Office can create an
   exam against a central class and this school's matching local class
   is found automatically — see Settings → Branch Class Mapping.

   LOCAL_CLASSES is never hand-typed here — it's derived from this
   school's own real enrolled classes (mock/students.js's
   mockStuClasses, the same source Students/Admissions/etc. already
   treat as the school's real class list), deduplicated by class name
   (sections aren't mapped — Head Office assigns exams to a class as a
   whole, not a section) with a stable id per class name so a mapping
   survives a class being renamed later.

   Central classes are NOT mirrored here — they only ever come from
   the Chain Portal's own payload (src/hooks/useChainPermissions.js's
   `centralClasses`), because inventing a second, disconnected list
   would defeat the point: a school not yet connected to a chain (or
   whose pasted payload predates this field) genuinely has no central
   classes to map against yet, and Branch Class Mapping says so plainly
   instead of pretending otherwise.
   ═══════════════════════════════════════════════════════════════════ */

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const LOCAL_CLASSES = LOCAL_CLASS_NAMES.map(name => ({ id: `loc-${slugify(name)}`, name }));

export const MAPPING_STATUS = {
  MAPPED: 'mapped',
  REQUIRED: 'required',
};

/* One row per mapped local class per academic session (sessionId
   matches settingsStore.js's INITIAL_SESSIONS ids — 1 = 2023–2024,
   2 = 2024–2025 (current), 3 = 2025–2026). A local class with no row
   for a session is simply unmapped there — rendered as "Mapping
   Required", not stored as an empty placeholder row.

   Seeded for session 2 (the current session) against the real central
   class ids this school's Head Office would actually use (1 Nursery,
   2 KG, 3 Class 1 — matching chain-schools-frontend's own
   academicsStore.js CLASSES ids exactly) — loc-class-3 and
   loc-class-5 are deliberately left unmapped so "Mapping Required"
   has a real example to show. */
/* Mappings now use the school's REAL local class ids and the network's REAL
   class ids (both fetched live in branchClassMappingService), so the old
   fake-id seed is cleared — the in-memory store starts empty until the user
   maps classes. */
export const mockBranchClassMappings = [];
