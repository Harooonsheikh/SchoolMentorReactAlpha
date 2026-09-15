/* ═══════════════════════════════════════════════════════════════════
   STUDENT SEARCH RANKING — shared by every "find a student" box
   (Students active/inactive, Fee tabs, Attendance reports, the global
   UniversalSearch provider).

   WHY THIS EXISTS
   ───────────────
   Every one of those boxes used to be a plain case-insensitive
   `includes()` over one big haystack string, then `.slice(0, 8..30)`.
   That silently loses students whose GR / registration number is one or
   two digits: searching "7" also matches "Class 7", reg "1007",
   admission "0072", mobile "03217…", and even a father named "Haroon"
   is unaffected but dozens of other rows are not — so the row the user
   actually asked for sits at position 40 and gets cut off by the cap.
   The user sees "No students found" (or a list without their student)
   for exactly the short GR numbers that are most common in a new branch.

   THE FIX
   ───────
   Match with a RANK instead of a boolean, then sort by rank before
   capping. An exact GR/registration/admission hit always sorts to the
   top, so a 1- or 2-digit GR is the first row in the dropdown.

   Rank ladder (lower = better):
     0  identifier exact      "7"      → reg "7" / "007" / "0007"
     1  identifier prefix     "10"     → reg "1007"
     2  text prefix           "ahm"    → "Ahmed Raza"
     3  identifier contains   "119"    → reg "245-00119"
     4  text contains         "raza"   → "Ahmed Raza"
    -1  no match
   ═══════════════════════════════════════════════════════════════════ */

const norm = (v) => String(v ?? '').trim().toLowerCase();

/* Collapse an identifier to its comparable core so the separators and leading
   zeros a school stores (or doesn't type) never decide a match: "007", "7" and
   "0007" all key to "7", and "245-00119" keys to "24500119". Ids that carry
   letters keep them (minus punctuation) so "A12" and "B12" stay distinct. */
export function identifierKey(v) {
  const s = norm(v).replace(/[^a-z0-9]/g, '');
  if (!s) return '';
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

/**
 * Rank one record against a query.
 * @param {string} query            raw user input
 * @param {object} fields
 * @param {Array}  fields.ids       identifier-ish values (reg / GR, admission, family no…)
 * @param {string} fields.text      free-text haystack (name, father, class, section…)
 * @returns {number} 0..4 on a match, -1 when the record does not match.
 */
export function studentMatchRank(query, { ids = [], text = '' } = {}) {
  const q = norm(query);
  if (!q) return -1;

  const idVals = ids.filter(v => v != null && v !== '').map(norm);
  const idKeys = idVals.map(identifierKey).filter(Boolean);
  const qKey   = identifierKey(q);

  if (qKey) {
    if (idKeys.some(k => k === qKey))          return 0;
    if (idKeys.some(k => k.startsWith(qKey)))  return 1;
  }
  const t = norm(text);
  if (t.startsWith(q))                         return 2;
  if (idVals.some(v => v.includes(q)))         return 3;
  if (t.includes(q))                           return 4;
  return -1;
}

/** True when the record matches at all — drop-in for the old `includes()`. */
export function studentMatches(query, fields) {
  return studentMatchRank(query, fields) >= 0;
}

/**
 * Filter + rank + (optionally) cap a list in one call.
 *
 * @param {string}   query
 * @param {Array}    rows
 * @param {Function} getFields  row => ({ ids, text })
 * @param {number}   [limit]    cap applied AFTER ranking, so the best hit
 *                              can never be cut off by it
 * @returns {Array} the matching rows, best match first, original order
 *                  preserved inside a rank (stable).
 */
export function rankedMatches(query, rows, getFields, limit) {
  if (!norm(query)) return [];
  const scored = [];
  (rows || []).forEach((row, i) => {
    const rank = studentMatchRank(query, getFields(row, i));
    if (rank >= 0) scored.push({ row, rank, i });
  });
  scored.sort((a, b) => (a.rank - b.rank) || (a.i - b.i));
  const out = scored.map(x => x.row);
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}
