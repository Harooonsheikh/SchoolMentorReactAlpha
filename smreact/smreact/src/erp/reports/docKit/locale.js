/* ═══════════════════════════════════════════════════════════════════
   docKit / locale — printed labels + numbering for English and Urdu,
   and the answer-space rules (single line vs. 4-line handwriting copy).
   Shared by render.js (preview / PDF) and exportDocx.js (Word) so all
   three always print the same thing.
   ═══════════════════════════════════════════════════════════════════ */

const UR_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const urDigits = (v) => String(v).replace(/\d/g, d => UR_DIGITS[d]);

/* Urdu option / column labels, in the order used in Pakistani papers */
export const UR_LETTERS = ['الف', 'ب', 'ج', 'د', 'ہ', 'و', 'ز', 'ح', 'ط', 'ی', 'ک', 'ل', 'م', 'ن'];
const EN_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];

export const STRINGS = {
  en: {
    answer: 'Answer', answerLbl: 'Answer:', finalAnswer: 'Final Answer:', why: 'Why', circleOne: 'Circle one',
    tTrue: 'True', tFalse: 'False', working: 'Working space:', marks: 'marks', mark: 'mark',
    answerKey: 'Answer Key', total: 'Total', teacherCopy: 'TEACHER COPY', instructions: 'Instructions',
    matchDefault: 'Match Column A with Column B.', passageDefault: 'Read the passage carefully and answer the questions.',
    compositionDefault: 'Write on ONE of the following topics.', diagram: '[ Diagram ]', word: 'Word',
    sentencePrompt: (w) => `Use <b>${w}</b> in a sentence of your own.`,
    compositionKey: 'Marked on content, organisation and language.',
    studentName: 'Student Name', date: 'Date', classSection: 'Class / Section', rollNo: 'Roll No.',
  },
  ur: {
    answer: 'جواب', answerLbl: 'جواب:', finalAnswer: 'حتمی جواب:', why: 'وضاحت', circleOne: 'ایک پر دائرہ لگائیں',
    tTrue: 'درست', tFalse: 'غلط', working: 'حل کی جگہ:', marks: 'نمبر', mark: 'نمبر',
    answerKey: 'جوابات کی کلید', total: 'کل', teacherCopy: 'برائے اساتذہ', instructions: 'ہدایات',
    matchDefault: 'کالم (الف) کو کالم (ب) سے ملائیں۔', passageDefault: 'درج ذیل عبارت غور سے پڑھیں اور سوالات کے جوابات دیں۔',
    compositionDefault: 'درج ذیل میں سے کسی ایک موضوع پر لکھیں۔', diagram: '[ شکل ]', word: 'لفظ',
    sentencePrompt: (w) => `<b>${w}</b> کو اپنے جملے میں استعمال کریں۔`,
    compositionKey: 'مواد، ترتیب اور زبان کی بنیاد پر نمبر دیے جائیں۔',
    studentName: 'نام طالب علم', date: 'تاریخ', classSection: 'جماعت / سیکشن', rollNo: 'رول نمبر',
  },
};

/** Formatter for one document: numbers, option labels, sub-item labels. */
export function makeFormat(locale) {
  const ur = locale === 'ur';
  const T = ur ? STRINGS.ur : STRINGS.en;
  const num = (n) => (ur ? urDigits(n) : String(n));
  return {
    ur,
    T,
    num,
    opt: (i) => `(${ur ? (UR_LETTERS[i] || urDigits(i + 1)) : EN_LETTERS[i]})`,        // (a) / (الف)
    col: (i) => (ur ? (UR_LETTERS[i] || urDigits(i + 1)) : EN_LETTERS[i].toUpperCase()), // A / الف
    sub: (i) => (ur ? urDigits(i + 1) : (ROMAN[i] || String(i + 1))),                  // i / ۱
    marksLabel(set) {
      const count = set.items.length;
      const tot = set.marks != null ? set.marks : (set.perItem ? count * set.perItem : null);
      if (tot == null) return '';
      if (set.perItem && (set.marks == null || set.marks === count * set.perItem)) {
        return ur ? `${num(count)} × ${num(set.perItem)} = ${num(tot)} ${T.marks}` : `${count} × ${set.perItem} = ${tot} ${T.marks}`;
      }
      return ur ? `${num(tot)} ${T.marks}` : `${tot} ${T.marks}`;
    },
  };
}

/**
 * How much writing space a question gets on the answer sheet.
 *   Urdu      → plain single ruled lines (Urdu is not written on a 4-line copy)
 *   'four'    → standard 4-line handwriting bands (school copy ruling)
 *   'single'  → single ruled lines
 * kind: short | long | composition | calculation | passage | word_sentence | fill_blanks | punctuation | other
 */
export function answerSpace(kind, { locale, lines, itemLines } = {}) {
  if (locale === 'ur') {
    const n = { long: 4, composition: 8, calculation: 2 }[kind] || 1;
    return { style: 'single', count: n };
  }
  if (lines === 'four') {
    const n = { long: 3, composition: 5 }[kind] || 1;
    return { style: 'four', count: n };
  }
  const n = itemLines ?? ({ long: 6, composition: 10, calculation: 2, short: 3, word_sentence: 2, passage: 2 }[kind] || 1);
  return { style: 'single', count: n };
}
