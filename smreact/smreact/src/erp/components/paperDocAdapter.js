/* ═════════════════════════════════════════════════════════════════
   Question paper → docKit document (kind "paper").

   The saved paper's sections (getexamqpsubmissiondetail, normalised by
   normalizeQpDetail in PaperGenerator.jsx) become docKit question sets, so the
   preview, PDF, Word and print all come from one document — the QP template
   (masthead, pills, student fields, numbered sections, answer sheet, answer
   key) in Colourful or Inkless. Contract: LESSON_DOC_JSON_GUIDE.md §5.

   Answers: a row's `answer` (or the right-hand word / paragraph where the
   saved row has one) is passed through. Nothing is invented: when the server
   does not send an answer, the teacher copy has no answer for that question.
   ═════════════════════════════════════════════════════════════════ */

const UR_SECTION_LETTERS = ['الف', 'ب', 'ج', 'د', 'ہ', 'و', 'ز', 'ح', 'ط', 'ی', 'ک', 'ل'];

/* Same recTitle key the Make Paper / preview code uses. */
const recKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/* Plain text from the saved rich-text cell (tags stripped, entities decoded). */
const plainText = (s) => String(s == null ? '' : s)
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(p|div|h[1-6]|li)>/gi, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim();

/* Main question text of a saved row, whatever its type calls it. */
const rowText = (r) => plainText(
  r.question || r.word || r.sentence || r.statement || r.topic || r.title
  || r.comprehensionStatement || r.subject || r.punctuation || r.mainQuestion || '',
);

const pick = (r, ...keys) => {
  for (const k of keys) {
    const v = plainText(r?.[k]);
    if (v) return v;
  }
  return '';
};

/* Set-level answer value: the server's answer when it sends one, else undefined. */
const answerOf = (r) => {
  const v = r?.answer ?? r?.correctAnswer ?? r?.correctOption;
  return v == null || v === '' ? undefined : v;
};

/* Kind of question set for one saved section. */
function setKind(sec) {
  const k = recKey(sec.recTitle);
  if (k === 'mcqs' || k === 'mcq') return 'mcq';
  if (k === 'matchcolume' || k === 'matchcolumns') return 'match';
  if (k === 'truefalse') return 'true_false';
  if (k === 'fillintheblank' || k === 'fillintheblanks' || k === 'filltheblank' || k === 'filltheblanks') return 'fill_blanks';
  if (k === 'wordsynonyms') return 'word_synonyms';
  if (k === 'wordopposite' || k === 'wordopposites') return 'word_opposite';
  if (k === 'singularplural' || k === 'singularplurals') return 'singular_plural';
  if (k === 'comprehension') return 'comprehension';
  if (k === 'wordsentences') return 'word_sentence';
  if (k === 'punctuation') return 'punctuation';
  if (k === 'paragraph' || k === 'letter' || k === 'letters' || k === 'application' || k === 'stories' || k === 'essays') return 'composition';
  if (k === 'longquetion' || k === 'longquestion' || k === 'longq') return 'long';
  return 'short'; // Question & Answer, short questions and anything else written
}

/* One docKit "questions" block for a saved section. */
function questionBlock(sec, urdu) {
  const kind = setKind(sec);
  const rows = Array.isArray(sec.rows) ? sec.rows : [];
  const perItem = +sec.marks || null;
  const instruction = plainText(sec.mainQuestion) || undefined;
  const base = { type: 'questions', perItem, instruction };

  if (kind === 'mcq') {
    return { ...base, qtype: 'mcq', items: rows.map(r => ({
      text: rowText(r),
      options: ['option1', 'option2', 'option3', 'option4'].map(o => plainText(r[o])).filter(Boolean),
      answer: answerOf(r),
    })) };
  }
  if (kind === 'match') {
    return { ...base, qtype: 'match', items: rows.map(r => ({
      left: pick(r, 'columnA', 'option1'),
      right: pick(r, 'columnB', 'option2'),
      answer: answerOf(r),
    })) };
  }
  if (kind === 'word_synonyms' || kind === 'word_opposite' || kind === 'singular_plural') {
    const cols = urdu
      ? (kind === 'word_synonyms' ? ['لفظ', 'مترادف'] : kind === 'word_opposite' ? ['لفظ', 'متضاد'] : ['واحد', 'جمع'])
      : (kind === 'word_synonyms' ? ['Word', 'Synonym'] : kind === 'word_opposite' ? ['Word', 'Opposite'] : ['Singular', 'Plural']);
    const left = kind === 'singular_plural' ? 'singular' : 'word';
    const right = kind === 'word_synonyms' ? 'synonym' : kind === 'word_opposite' ? 'opposite' : 'plural';
    return { ...base, qtype: 'word_pair', columns: cols, blank: 'b', items: rows.map(r => ({
      a: pick(r, left, 'option1'),
      b: pick(r, right, 'option2', 'answer') || '',
    })) };
  }
  if (kind === 'true_false') {
    return { ...base, qtype: 'true_false', items: rows.map(r => ({
      text: rowText(r),
      answer: answerOf(r),
    })) };
  }
  if (kind === 'fill_blanks') {
    return { ...base, qtype: 'fill_blanks', items: rows.map(r => ({ text: rowText(r), answer: answerOf(r) })) };
  }
  if (kind === 'comprehension') {
    const passage = plainText(rows[0]?.comprehensionStatement);
    return { ...base, qtype: 'passage', passage: passage || undefined, items: rows.map(r => ({
      text: plainText(r.question) || rowText(r),
      answer: answerOf(r),
    })) };
  }
  if (kind === 'composition') {
    return { ...base, qtype: 'composition', items: rows.map(r => {
      const topic = pick(r, 'topic', 'title', 'question', 'mainQuestion');
      const body = plainText(r.paragraph);
      return { text: topic, answer: body && body !== topic ? body : answerOf(r) };
    }) };
  }
  /* short, long, word sentences, punctuation */
  const qtype = kind === 'word_sentence' ? 'word_sentence' : kind === 'punctuation' ? 'punctuation' : kind;
  return { ...base, qtype, items: rows.map(r => ({ text: rowText(r), answer: answerOf(r) })) };
}

/* Build the document. `sections` are normalised saved sections; `meta` holds
   the paper's answer-sheet format and line style; `header` the branch name
   and logo. Objective sections print first (as the saved paper orders them). */
export function buildPaperDoc({ paper, cls, sections = [], meta = {}, header = {} }) {
  const urdu = String(meta.medium || paper?.medium || 'english').toLowerCase() === 'urdu';
  const school = header.branchName || 'School';
  const clsLabel = cls ? `${cls.name || ''}${cls.section ? ` (${cls.section})` : ''}`.trim() : '';
  const minutes = (paper?.objTime || 0) + (paper?.subjTime || 0);
  const objMarks = paper?.objMarks || 0;
  const subjMarks = paper?.subjMarks || 0;
  const total = (objMarks + subjMarks) || 100;
  const dateTxt = paper?.date ? new Date(paper.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const title = paper?.title || (urdu ? 'سوالیہ پرچہ' : 'Question Paper');

  const ordered = [
    ...sections.filter(s => s.qpSubmissionPaperType === 'objective'),
    ...sections.filter(s => s.qpSubmissionPaperType !== 'objective'),
  ];

  let letter = 0;
  const docSections = ordered.map((sec, i) => {
    const L = letter++;
    const label = plainText(sec.mainQuestion) || sec.recTitle || '';
    const firstSubj = i > 0 && ordered[i - 1].qpSubmissionPaperType === 'objective' && sec.qpSubmissionPaperType !== 'objective';
    return {
      title: urdu
        ? `حصہ (${UR_SECTION_LETTERS[L] || L + 1}) · ${sec.recTitle || label}`
        : `Section ${String.fromCharCode(65 + L)} · ${sec.recTitle || label}`,
      newPage: firstSubj,
      blocks: [questionBlock(sec, urdu)],
    };
  });

  const pills = urdu
    ? [`📚 جماعت: ${clsLabel} · مضمون: ${paper?.subj || ''}`, minutes ? `⏱ وقت: ${minutes} منٹ` : null, `⭐ کل نمبر: ${total}`, dateTxt ? `📅 ${dateTxt}` : null]
    : [`📚 ${[clsLabel, paper?.subj].filter(Boolean).join(' · ')}`, minutes ? `⏱ Duration: ${minutes} minutes` : null, `⭐ Total Marks: ${total}`, dateTxt ? `📅 ${dateTxt}` : null];

  return {
    kind: 'paper',
    dir: urdu ? 'rtl' : 'ltr',
    locale: urdu ? 'ur' : 'en',
    school: { name: school, logoUrl: header.logoUrl || '', logoNoCors: !!header.logoNoCors },
    title,
    paper: {
      exam: title,
      subjectLine: [clsLabel, paper?.subj].filter(Boolean).join(' · '),
      pills: pills.filter(Boolean),
      fields: urdu ? ['نام طالب علم', 'رول نمبر', 'سیکشن'] : ['Student Name', 'Roll No.', 'Section'],
      instructions: paper?.instructions || (urdu
        ? 'تمام سوالات کے جوابات دیں۔ ہر سوال کے نمبر بریکٹ میں دیے گئے ہیں۔ صاف اور خوش خط لکھیں۔ موبائل فون کا استعمال سختی سے منع ہے۔'
        : 'Attempt all questions. Marks for each question are shown in brackets. Write neatly and clearly. Use of mobile phones is strictly prohibited.'),
      totalMarks: total,
    },
    sections: docSections,
    footer: { center: `${school} · ${title}${clsLabel ? ` · ${clsLabel}` : ''}` },
  };
}

/* Viewer options for the saved paper: the answer-sheet format and line style. */
export function viewerOptionsFor(meta = {}) {
  return {
    initialAnswers: meta.fmt === 'without' ? 'none' : 'space',
    initialLines: meta.line === 'four' ? 'four' : 'single',
  };
}
