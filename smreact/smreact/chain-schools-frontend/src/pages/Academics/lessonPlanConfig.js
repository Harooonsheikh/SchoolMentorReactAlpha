/* ═══════════════════════════════════════════════════════════════════
   CREATE LESSON PLAN — constants (ERP ke src/erp/components/LessonPlans.js
   se hu-ba-hu port).

   • AQ_TYPES / AQ_CONFIG — Notebook ke 18 question types aur unka layout
   • NB_UR / nbTr        — English → Urdu (Noori Nastaliq) headings/labels
   • LESSON_SECTIONS_*   — lesson plan ke 4 rich-text sections (EN + UR)

   Unit ki language (medium) Manage Units me set hoti hai; lesson aur
   question dono modals us se apni zaban lete hain aur read-only dikhate
   hain — bilkul ERP jaisa.
   ═══════════════════════════════════════════════════════════════════ */

export const AQ_TYPES = [
  { id: 'word_opposite',   label: 'Word/Opposite',            icon: 'fa-arrows-left-right' },
  { id: 'singular_plural', label: 'Singular/Plural',          icon: 'fa-clone' },
  { id: 'word_synonyms',   label: 'Word/Synonyms',            icon: 'fa-spell-check' },
  { id: 'word_sentences',  label: 'Word Sentences',           icon: 'fa-pen-line' },
  { id: 'mcqs',            label: 'MCQs Field',               icon: 'fa-list-ol' },
  { id: 'fill_blanks',     label: 'Fill in the Blanks',       icon: 'fa-underline' },
  { id: 'true_false',      label: 'True / False',             icon: 'fa-check-to-slot' },
  { id: 'match_columns',   label: 'Match the Columns',        icon: 'fa-table-columns' },
  { id: 'short_questions', label: 'Short Questions',          icon: 'fa-comment-dots' },
  { id: 'circle_words',    label: 'Circle the Correct Words', icon: 'fa-circle-dot' },
  { id: 'punctuation',     label: 'Punctuation',              icon: 'fa-exclamation' },
  { id: 'long_question',   label: 'Long Question',            icon: 'fa-align-left' },
  { id: 'paragraph',       label: 'Paragraph Writing',        icon: 'fa-paragraph' },
  { id: 'comprehension',   label: 'Comprehension',            icon: 'fa-book-open' },
  { id: 'letter',          label: 'Letter',                   icon: 'fa-envelope' },
  { id: 'application',     label: 'Application',              icon: 'fa-file-pen' },
  { id: 'stories',         label: 'Stories',                  icon: 'fa-book-bookmark' },
  { id: 'essays',          label: 'Essays',                   icon: 'fa-feather-pointed' },
]

export const AQ_CONFIG = {
  word_opposite:   { title: 'Word / Opposite',          fields: [{ key: 'word', label: 'Word', ph: 'e.g. Big' }, { key: 'opposite', label: 'Opposite', ph: 'e.g. Small' }],       layout: 'two-col', arrow: '→' },
  singular_plural: { title: 'Singular / Plural',        fields: [{ key: 'singular', label: 'Singular', ph: 'e.g. Cat' }, { key: 'plural', label: 'Plural', ph: 'e.g. Cats' }],    layout: 'two-col', arrow: '→' },
  word_synonyms:   { title: 'Word / Synonyms',          fields: [{ key: 'word', label: 'Word', ph: 'e.g. Happy' }, { key: 'synonym', label: 'Synonym', ph: 'e.g. Joyful' }],      layout: 'two-col', arrow: '=' },
  word_sentences:  { title: 'Word Sentences',           layout: 'word-sentence' },
  mcqs:            { title: 'MCQs Field',               layout: 'mcq' },
  fill_blanks:     { title: 'Fill in the Blanks',       layout: 'fill-blanks' },
  true_false:      { title: 'True / False',             layout: 'true_false' },
  match_columns:   { title: 'Match the Columns',        layout: 'match' },
  short_questions: { title: 'Short Questions',          layout: 'short-q' },
  circle_words:    { title: 'Circle the Correct Words', layout: 'circle' },
  punctuation:     { title: 'Punctuation',              layout: 'punctuation' },
  long_question:   { title: 'Long Question',            layout: 'long' },
  paragraph:       { title: 'Paragraph Writing',        fields: [{ key: 'title', label: 'Title', ph: 'Enter title', rte: true }, { key: 'body', label: 'Paragraph Body', ph: 'Write paragraph here…', rte: true }], layout: 'vertical-expand' },
  comprehension:   { title: 'Comprehension Question',   layout: 'comprehension' },
  /* Letter/Application: Subject aur Body ab ek hi field hai — teacher poora khat
     (subject line samet) ek editor me likhta hai. Backend abhi bhi alag subject/
     body leta hai; wo split save par hota hai (splitLetter, lessonPlansApi.js). */
  letter:          { title: 'Letter',                   fields: [{ key: 'body', label: 'Letter', ph: 'Write the letter here…', rte: true }],       layout: 'vertical-expand' },
  application:     { title: 'Application',              fields: [{ key: 'body', label: 'Application', ph: 'Write the application here…', rte: true }], layout: 'vertical-expand' },
  stories:         { title: 'Stories',                  fields: [{ key: 'title', label: 'Title', ph: 'Enter story title', rte: true }, { key: 'body', label: 'Story Body', ph: 'Write the story…', rte: true }, { key: 'moral', label: 'Moral', ph: 'Moral of the story…', rte: true }], layout: 'vertical-expand' },
  essays:          { title: 'Essays',                   fields: [{ key: 'title', label: 'Title', ph: 'Enter essay title', rte: true }, { key: 'body', label: 'Essay Body', ph: 'Write the essay…', rte: true }, { key: 'conclusion', label: 'Conclusion', ph: 'Write conclusion…', rte: true }], layout: 'vertical-expand' },
}

/* Notebook Add-Questions modal — English → Urdu (Noori Nastaliq) headings/labels.
   Unit ka medium Urdu ho to sari question-type labels aur field headings
   translate ho jati hain. */
export const NB_UR = {
  // Question-type labels (AQ_TYPES)
  'Word/Opposite': 'لفظ / متضاد',
  'Singular/Plural': 'واحد / جمع',
  'Word/Synonyms': 'لفظ / مترادف',
  'Word Sentences': 'الفاظ اور جملے',
  'MCQs Field': 'کثیر الانتخابی سوالات',
  'Fill in the Blanks': 'خالی جگہ پُر کریں',
  'True / False': 'صحیح / غلط',
  'Match the Columns': 'کالم ملائیں',
  'Short Questions': 'مختصر سوالات',
  'Circle the Correct Words': 'درست الفاظ پر دائرہ لگائیں',
  'Punctuation': 'رموزِ اوقاف',
  'Long Question': 'طویل سوال',
  'Paragraph Writing': 'پیراگراف نویسی',
  'Comprehension': 'فہمِ عبارت',
  'Letter': 'خط',
  'Application': 'درخواست',
  'Stories': 'کہانیاں',
  'Essays': 'مضامین',
  // Config titles (jahan type label se mukhtalif)
  'Word / Opposite': 'لفظ / متضاد',
  'Singular / Plural': 'واحد / جمع',
  'Word / Synonyms': 'لفظ / مترادف',
  'Comprehension Question': 'فہمِ عبارت کا سوال',
  // Field labels
  'Word': 'لفظ',
  'Opposite': 'متضاد',
  'Singular': 'واحد',
  'Plural': 'جمع',
  'Synonym': 'مترادف',
  'Sentence': 'جملہ',
  'Question': 'سوال',
  'Answer': 'جواب',
  'Title': 'عنوان',
  'Body': 'متن',
  'Paragraph Body': 'پیراگراف کا متن',
  'Story Body': 'کہانی کا متن',
  'Essay Body': 'مضمون کا متن',
  'Moral': 'اخلاقی سبق',
  'Conclusion': 'اختتامیہ',
  'Subject': 'موضوع',
  // Section / inline headings
  'Select Question Field': 'سوال کی قسم منتخب کریں',
  'Main Question': 'بنیادی سوال',
  'Comprehension Statement': 'عبارت',
  'Language': 'زبان',
  'Column A': 'کالم الف',
  'Column B (Correct Match)': 'کالم ب (درست جوڑ)',
  'CORRECT ANSWER': 'درست جواب',
  'Statement (use ___ for blank)': 'جملہ (خالی جگہ کے لیے ___ لکھیں)',
  'Blank Answer:': 'خالی جگہ کا جواب:',
  'Statement / Sentence with word choices': 'جملہ / بیان (الفاظ کے انتخاب کے ساتھ)',
  'Correct Word to Circle': 'دائرہ لگانے والا درست لفظ',
  'Unpunctuated Sentence': 'بغیر رموز کے جملہ',
  'Correctly Punctuated (Answer)': 'درست رموز کے ساتھ (جواب)',
  'Answer / Model Answer': 'جواب / نمونہ جواب',
  // Buttons
  'Remove': 'حذف کریں',
  'Save': 'محفوظ کریں',
  '+ Add More': '+ مزید شامل کریں',
  '+ Add More Stories': '+ مزید کہانیاں شامل کریں',
  // Option (MCQ) prefix
  'Option': 'آپشن',
  // Placeholders
  'A / B / C / D or exact text': 'A / B / C / D یا درست متن',
  'One word…': 'ایک لفظ…',
  'Enter main question': 'بنیادی سوال لکھیں',
  'Enter comprehension statement here…': 'یہاں عبارت لکھیں…',
  // Lesson-plan section terms
  'Student Learning Objective': 'طلباء کا سیکھنے کا مقصد',
  'Lesson Introduction': 'سبق کا تعارف',
  'Development / Main Teaching': 'ترقی / مرکزی تدریس',
  'Recap / Consolidation': 'خلاصہ / اعادہ',
  'mins': 'منٹ',
  'True': 'صحیح',
  'False': 'غلط',
}

export const nbTr = (s, isUrdu) => (isUrdu ? (NB_UR[s] || s) : s)

/* Lesson plan ke 4 rich-text sections — ERP ke CLPM_SECTIONS / CLPM_SECTIONS_URDU. */
export const LESSON_SECTIONS_EN = [
  { key: 'slo',   title: '🎯 Student Learning Objective', hint: 'What will students be able to do by the end of this lesson?', mins: '05' },
  { key: 'intro', title: '📖 Lesson Introduction',         hint: "How will you start the lesson to grab students' attention?", mins: '05' },
  { key: 'devel', title: '🔬 Development / Main Teaching', hint: 'Step-by-step explanation of the new concept or skill',       mins: '20' },
  { key: 'recap', title: '✅ Recap / Consolidation',        hint: 'How will you check what students have learned today?',       mins: '10' },
]

export const LESSON_SECTIONS_UR = [
  { key: 'slo',   title: '🎯 طلباء کا سیکھنے کا مقصد', hint: 'اس سبق کے اختتام پر طلباء کیا کر سکیں گے؟',                    mins: '05' },
  { key: 'intro', title: '📖 سبق کا تعارف',            hint: 'آپ طلباء کی توجہ حاصل کرنے کے لیے سبق کا آغاز کیسے کریں گے؟', mins: '05' },
  { key: 'devel', title: '🔬 ترقی / مرکزی تدریس',      hint: 'نئے مفہوم یا مہارت کی مرحلہ وار وضاحت',                        mins: '20' },
  { key: 'recap', title: '✅ خلاصہ / اعادہ',            hint: 'آپ کیسے جانچیں گے کہ طلباء نے آج کیا سیکھا؟',                  mins: '10' },
]

export const DOT_CLASSES = [
  'clpm-rte-section-dot--purple',
  'clpm-rte-section-dot--blue',
  'clpm-rte-section-dot--orange',
  'clpm-rte-section-dot--green',
]

/* Section timings user khud set karta hai; save par sum === Time Duration. */
export const onlyNum = (v) => String(v ?? '').replace(/[^0-9]/g, '')

export const aqOrdinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)

/* Har row ko ek stable key chahiye (React list) — index se nahi, warna row
   hataane par editors ka content khisak jata hai. */
let rowCounter = 0
export const nextRowId = () => `aqr_${(rowCounter += 1)}`

export function aqEmptyRow(typeId) {
  const cfg = AQ_CONFIG[typeId]
  const _id = nextRowId()
  if (!cfg) return { _id }
  if (cfg.layout === 'mcq')           return { _id, question: '', opt1: '', opt2: '', opt3: '', opt4: '', correct: '' }
  if (cfg.layout === 'true_false')    return { _id, question: '', answer: '' }
  if (cfg.layout === 'match')         return { _id, colA: '', colB: '' }
  if (cfg.layout === 'comprehension') return { _id, question: '', answer: '' }
  if (cfg.layout === 'word-sentence') return { _id, word: '', sentence: '' }
  if (cfg.layout === 'fill-blanks')   return { _id, question: '', answer: '' }
  if (cfg.layout === 'short-q')       return { _id, question: '', answer: '' }
  if (cfg.layout === 'circle')        return { _id, statement: '', answer: '' }
  if (cfg.layout === 'punctuation')   return { _id, question: '', answer: '' }
  if (cfg.layout === 'long')          return { _id, question: '', answer: '' }
  const row = { _id }
  ;(cfg.fields || []).forEach((f) => { row[f.key] = '' })
  return row
}
