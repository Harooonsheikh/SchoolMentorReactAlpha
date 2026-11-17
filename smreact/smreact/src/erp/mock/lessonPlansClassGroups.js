/* ═══════════════════════════════════════════════════════════════════
   LESSON PLANS · CLASS GROUPS — mock seed (frontend-only)
   ───────────────────────────────────────────────────────────────────
   Ported from the reference branch (academics-class-groups-activity-
   audience, src/mock/lessonPlans.js → mockCustomSections).

   Every section of a class is in that class's group by default and
   shares one plan (Units, Term Breakups, Lesson Plans, Question Bank).
   A section that has been taken out of the group ("separate plan") is
   listed here as `${classID}__${sectionID}` (ERP ids, not names).

   There is NO backend endpoint for this yet — see
   services/lessonPlansClassGroupsService.js, which keeps the list in
   localStorage per branch + session. The ERP seeds it EMPTY (all
   sections grouped); the reference's demo seed ('Class II__C') used
   class names that do not exist in a real branch.
   ═══════════════════════════════════════════════════════════════════ */
export const mockCustomSections = [];
