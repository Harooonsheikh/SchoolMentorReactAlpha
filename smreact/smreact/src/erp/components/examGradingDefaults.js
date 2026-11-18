/* ═══════════════════════════════════════════════════════════════════
   EXAM — Grading Setup default wording (Grades 1-12)
   Ported from School-Mentor-Front-end Examination.jsx (RS_AUTO_*).

   Ready-made wording per percentage band, pre-filled in Edit Grading Setup
   so a school gets a sensible starting point and only edits what it wants.

   Persistence: NOTHING is stored here. The text a school saves goes through
   the ERP's existing live save path (gradingcrud `remarks` for grade
   comments, overallgradingcrud `finalRemarks` for final remarks). A saved
   text that still equals one of the defaults below counts as "auto" and is
   re-derived when the percentage / condition changes; any other saved text
   is treated as the school's own wording and is never overwritten.
   ═══════════════════════════════════════════════════════════════════ */

export const EXAM_RS_AUTO_BANDS = [90, 80, 70, 60, 50, 40];

/* Grade comment — kept within the ERP's 28-character comment limit. */
export const EXAM_RS_AUTO_COMMENTS = {
  90: 'Outstanding performance',
  80: 'Excellent work',
  70: 'Very good effort',
  60: 'Good, keep improving',
  50: 'Satisfactory progress',
  40: 'Needs more effort',
  below: 'Needs serious attention',
};

/* Final remark paragraph — kept within the ERP's 200-character remark limit. */
export const EXAM_RS_AUTO_REMARKS = {
  90: 'Outstanding achievement. Demonstrates exceptional understanding, consistent effort and excellent academic skills. A role model for peers. Keep up the remarkable work.',
  80: 'Excellent performance. Shows a strong grasp of concepts and a positive attitude towards learning. With continued focus, even greater success is well within reach.',
  70: 'Very good progress. Understands most concepts well and works with steady effort. Regular revision and active class participation will help reach the next level.',
  60: 'Good effort. Grasps the core concepts but needs more consistency. Extra practice, timely homework and careful revision are recommended to strengthen results.',
  50: 'Satisfactory result. Basic understanding is evident, though several areas need attention. Focused practice and closer guidance at home and school are encouraged.',
  40: 'Fair attempt. Meets the minimum requirements but needs considerable improvement. A structured study plan, regular practice and teacher support are strongly advised.',
  below: 'Below the expected level. Requires serious effort, regular practice and close academic support. We look forward to working with parents to improve these results.',
};

/* Earlier seed wording — still treated as "auto" so it is replaced when the
   percentage changes, instead of being kept as a custom edit. */
const EXAM_RS_LEGACY_AUTO_TEXT = [
  'Very Good Work Done', 'Good Work Done', 'Satisfactory Work Done', 'Needs Improvement', 'Unsatisfactory',
  'Outstanding performance. Demonstrates excellent understanding, consistency, and academic excellence. Keep up the exceptional work.',
  'Very Good Work Done. Keep Working Hard to Maintain Your Position. All the best for your future endeavors.',
  'Good performance. Concepts are mostly clear with steady effort. Continued practice will lead to further improvement.',
  'Satisfactory progress. Basic understanding is evident. Needs more consistency and focused effort to improve.',
  'Needs improvement. Minimum requirements met, but greater attention, practice, and revision are required.',
  'Below satisfactory level. Requires serious effort, regular practice, and academic support to meet learning standards.',
];

const EXAM_RS_AUTO_TEXT_SET = new Set([
  ...Object.values(EXAM_RS_AUTO_COMMENTS),
  ...Object.values(EXAM_RS_AUTO_REMARKS),
  ...EXAM_RS_LEGACY_AUTO_TEXT,
]);

/** Empty or one of the default texts → "auto" (not customised by the school). */
export const examRsIsAutoText = text =>
  !String(text || '').trim() || EXAM_RS_AUTO_TEXT_SET.has(String(text).trim());

/** Band key (90/80/…/'below') for a condition + percentage; null when pct is not a number. */
export function examRsAutoBand(cond, pct) {
  const n = parseFloat(pct);
  if (Number.isNaN(n)) return null;
  if (cond === 'lt' || cond === 'lte') return 'below';
  const hit = EXAM_RS_AUTO_BANDS.find(t => n >= t);
  return hit == null ? 'below' : hit;
}

/** Re-derive the auto text after a cond/pct change, unless the school wrote its own. */
export function examRsWithAutoText(row, field, defaults) {
  if (!row || !examRsIsAutoText(row[field])) return row;
  const band = examRsAutoBand(row.cond, row.pct);
  return band != null ? { ...row, [field]: defaults[band] } : row;
}

/** Default text for a row's band ('' when the percentage is not set yet).
    Used when a school clears its custom text: the band default comes straight
    back and is what gets saved (the live save path needs non-empty text, and a
    default text is recognised as "auto" again, so it keeps following the band). */
export function examRsDefaultText(cond, pct, defaults) {
  const band = examRsAutoBand(cond, pct);
  return band != null ? (defaults[band] || '') : '';
}

/** Percentage must be a number from 0 to 100 (inclusive). */
export function examRsValidPct(pct) {
  const s = String(pct ?? '').trim();
  if (!s) return false;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}
