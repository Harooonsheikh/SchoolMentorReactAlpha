/* ═══════════════════════════════════════════════════════════════════
   docKit / adapters — Lesson Plans & Question Bank data → document JSON.

   A lesson's content can arrive in ANY shape per section:
     contentMap: {
       slo:      '<ol><li>…</li></ol>'          (rich-text editor HTML)
       intro:    { minutes: 5, content: [blocks] }
       devel:    [ { type:'subsection', title, minutes, blocks:[…] }, … ]
       support:  { Support: '…', Extension: '…' }   (labelled items)
       resources:['Whiteboard', 'Cue cards']
       homework: ['Prepare a 45-second talk…', …]
       video:    [{ title, url }]
       anyNewKey: …                                 (rendered with its key as title)
     }
   or the backend can send a complete document: lesson.doc = { sections:[…] }.
   ═══════════════════════════════════════════════════════════════════ */
import { REPORT_SCHOOL_NAME } from '../reportKit';

export function currentSchool() {
  const name = (typeof document !== 'undefined' && document.querySelector('.school-name')?.textContent?.trim()) || REPORT_SCHOOL_NAME;
  return { name, tagline: 'Excellence · Integrity · Knowledge' };
}
const sessionYear = () => new Date().getFullYear();
const pad2 = (n) => String(n).padStart(2, '0');

/* Known lesson sections, in print order. `as` forces a block style for
   plain arrays (resources → 2-column bullets, homework → numbered circles). */
export const LESSON_SECTION_SPEC = [
  { key: 'slo', title: 'Student Learning Outcomes', tone: 'navy', ordered: true },
  { key: 'objectives', title: 'Learning Objectives', tone: 'navy', ordered: true },
  { key: 'intro', title: 'Introduction', tone: 'gold', mins: 5 },
  { key: 'devel', title: 'Development', tone: 'navy', mins: 20 },
  { key: 'activities', title: 'Activities', tone: 'navy' },
  { key: 'support', title: 'Support & Extension', tone: 'blue' },
  { key: 'differentiation', title: 'Differentiation', tone: 'blue' },
  { key: 'resources', title: 'Resource Material', tone: 'gold', as: 'resources' },
  { key: 'assessment', title: 'Assessment', tone: 'teal' },
  { key: 'recap', title: 'Recap & Consolidation', tone: 'navy', mins: 10, ordered: true },
  { key: 'homework', title: 'Suggested Homework', tone: 'blue', as: 'numbered' },
  { key: 'video', title: 'Video Resource', tone: 'red', as: 'video' },
  { key: 'videos', title: 'Video Resources', tone: 'red', as: 'video' },
  { key: 'reflection', title: 'Teacher Reflection', tone: 'gold' },
];
const UR_TITLES = { slo: 'طلباء کا سیکھنے کا مقصد', intro: 'سبق کا تعارف', devel: 'ترقی / مرکزی تدریس', recap: 'خلاصہ / اعادہ', homework: 'تجویز کردہ ہوم ورک', resources: 'تدریسی مواد', support: 'معاونت و توسیع' };
const TONES = ['navy', 'gold', 'blue', 'teal', 'navy'];
const titleCase = (k) => String(k).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());

const isEmpty = (v) => v == null || (typeof v === 'string' && !v.replace(/<[^>]*>|&nbsp;/g, '').trim()) || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

/* Section value → { minutes, content } then shape plain arrays per spec */
function sectionFrom(spec, value, urdu) {
  let minutes = null;
  let content = value;
  if (value && typeof value === 'object' && !Array.isArray(value) && !value.type && ('content' in value || 'blocks' in value)) {
    minutes = value.minutes ?? value.duration ?? null;
    content = value.content ?? value.blocks;
  }
  const plainList = Array.isArray(content) && content.every(x => x == null || typeof x !== 'object' || (x.title && x.url));
  if (plainList && spec.as === 'resources') content = [{ type: 'resources', items: content }];
  else if (plainList && spec.as === 'numbered') content = [{ type: 'numbered', items: content }];
  else if (spec.as === 'video') {
    const arr = Array.isArray(content) ? content : [content];
    if (arr.every(x => typeof x === 'string' || (x && x.url))) content = arr.map(x => (typeof x === 'string' ? { type: 'video', url: x, title: x } : { type: 'video', ...x }));
  } else if (plainList && spec.ordered && content.every(x => typeof x !== 'object')) content = [{ type: 'list', ordered: true, items: content }];
  return {
    title: (urdu && UR_TITLES[spec.key]) || spec.title,
    tone: spec.tone,
    minutes: minutes ?? null,
    content,
  };
}

export function lessonSections(lesson, { urdu = false, defaultMinutes = true } = {}) {
  if (lesson?.doc?.sections) return lesson.doc.sections;
  const map = lesson?.contentMap || {};
  const mins = lesson?.sectionMinutes || {};
  const out = [];
  const known = new Set();
  LESSON_SECTION_SPEC.forEach((spec) => {
    known.add(spec.key);
    if (isEmpty(map[spec.key])) return;
    const s = sectionFrom(spec, map[spec.key], urdu);
    if (s.minutes == null) s.minutes = mins[spec.key] ?? (defaultMinutes ? spec.mins ?? null : null);
    out.push(s);
  });
  Object.keys(map).forEach((k, i) => {
    if (known.has(k) || isEmpty(map[k])) return;
    out.push(sectionFrom({ key: k, title: titleCase(k), tone: TONES[i % TONES.length] }, map[k], urdu));
  });
  return out;
}

const lessonMinutes = (lesson, sections) => {
  if (lesson?.duration) return /\d+\s*$/.test(String(lesson.duration)) ? `${lesson.duration} minutes` : String(lesson.duration);
  const sum = sections.reduce((a, s) => a + (+s.minutes || 0), 0);
  return sum ? `${sum} minutes` : '';
};

/** One lesson → document (Lesson Plan PDF layout). */
export function lessonDoc({ lesson, unit, ctx = {}, index = 0, total = 1 }) {
  const urdu = /urdu/i.test(ctx.subject || unit?.subject || '') || lesson?.lang === 'ur';
  const sections = lessonSections(lesson, { urdu });
  const duration = lessonMinutes(lesson, sections);
  const school = currentSchool();
  return {
    kind: 'lesson',
    school,
    docType: 'Lesson Plan',
    docSub: 'Academic Document',
    meta: [
      { label: 'Grade', value: ctx.className || unit?.class || '' },
      { label: 'Subject', value: ctx.subject || unit?.subject || '' },
      { label: 'Unit', value: unit ? (unit.unitName || `Unit ${unit.unitNo}`) : '' },
      { label: 'Session', value: `${pad2(index + 1)} of ${pad2(total)}` },
    ],
    kicker: `Lesson Plan ${pad2(lesson?.num || index + 1)}`,
    title: lesson?.topic || 'Untitled lesson',
    subtitleBits: [duration, lesson?.source === 'mentorai' ? 'Mentor AI generated' : ''].filter(Boolean),
    durationFirst: !!duration,
    sections: sections.length ? sections : [{ title: 'Lesson content', content: [], emptyText: 'No content has been added to this lesson yet.' }],
    footer: { brand: 'Mentor AI', center: `${school.name}  ·  Academic Session ${sessionYear()}` },
  };
}

/** Whole unit → one document, each lesson starts on a new page. */
export function unitDoc({ unit, ctx = {} }) {
  const school = currentSchool();
  const lessons = unit?.lessons || [];
  const urdu = /urdu/i.test(ctx.subject || unit?.subject || '');
  const ai = lessons.filter(l => l.source === 'mentorai' || l.source === 'ai').length;
  const sections = [];
  lessons.forEach((lesson, li) => {
    const secs = lessonSections(lesson, { urdu });
    const duration = lessonMinutes(lesson, secs);
    const header = { kicker: `Lesson Plan ${pad2(lesson.num || li + 1)}`, title: lesson.topic || 'Untitled lesson', duration, badge: lesson.source === 'mentorai' || lesson.source === 'ai' ? 'Mentor AI' : 'Manual' };
    if (!secs.length) sections.push({ lessonTitle: header, newPage: li > 0, title: '', content: [], emptyText: 'No content has been added to this lesson yet.' });
    secs.forEach((s, si) => sections.push({ ...s, ...(si === 0 ? { lessonTitle: header, newPage: li > 0 } : {}) }));
  });
  return {
    kind: 'lesson',
    school,
    docType: 'Unit Lesson Plan',
    docSub: 'Academic Document',
    meta: [
      { label: 'Grade', value: ctx.className || unit?.class || '' },
      { label: 'Subject', value: ctx.subject || unit?.subject || '' },
      { label: 'Unit', value: `${pad2(unit?.unitNo || 1)}` },
      { label: 'Lessons', value: `${lessons.length} (${ai} Mentor AI · ${lessons.length - ai} manual)` },
    ],
    kicker: `Unit ${pad2(unit?.unitNo || 1)} · Full Lesson Plan`,
    title: unit?.unitName || 'Unit',
    subtitleBits: [],
    sections: sections.length ? sections : [{ title: 'Lessons', content: [], emptyText: 'No lessons have been added to this unit yet.' }],
    footer: { brand: 'Mentor AI', center: `${school.name}  ·  Academic Session ${sessionYear()}` },
  };
}

/* ── Question Bank (unit.questions = { [typeId]: { mainQ, rows, groups? } }) ── */
const PAIR_COLS = { word_opposite: ['Word', 'Opposite'], singular_plural: ['Singular', 'Plural'], word_synonyms: ['Word', 'Synonym'] };
const COMPOSITION = { paragraph: ['title', 'body'], letter: ['subject', 'body'], application: ['subject', 'body'], stories: ['title', 'body', 'moral'], essays: ['title', 'body', 'conclusion'] };

function parseChoices(statement) {
  const m = String(statement || '').match(/\(([^()]+\/[^()]+)\)/);
  if (!m) return { text: statement, options: [] };
  return { text: String(statement).replace(m[0], '________'), options: m[1].split('/').map(s => s.trim()).filter(Boolean) };
}

export function questionSetFromBank(typeId, set, label) {
  const rows = set.rows || [];
  const base = { type: 'questions', title: label, instruction: set.mainQ || '' };
  if (PAIR_COLS[typeId]) {
    const [k1, k2] = typeId === 'singular_plural' ? ['singular', 'plural'] : typeId === 'word_synonyms' ? ['word', 'synonym'] : ['word', 'opposite'];
    return { ...base, qtype: 'word_pair', columns: PAIR_COLS[typeId], items: rows.map(r => ({ a: r[k1], b: r[k2] })) };
  }
  switch (typeId) {
    case 'word_sentences': return { ...base, qtype: 'word_sentence', items: rows.map(r => ({ text: r.word, answer: r.sentence })) };
    case 'mcqs': return { ...base, qtype: 'mcq', items: rows.map(r => ({ text: r.question, options: [r.opt1, r.opt2, r.opt3, r.opt4].filter(x => x != null && x !== ''), answer: r.correct })) };
    case 'fill_blanks': return { ...base, qtype: 'fill_blanks', items: rows.map(r => ({ text: r.question, answer: r.answer })) };
    case 'true_false': return { ...base, qtype: 'true_false', items: rows.map(r => ({ text: r.question, answer: r.answer })) };
    case 'match_columns': return { ...base, qtype: 'match', items: rows.map(r => ({ left: r.colA, right: r.colB })) };
    case 'short_questions': return { ...base, qtype: 'short', items: rows.map(r => ({ text: r.question, answer: r.answer })) };
    case 'long_question': return { ...base, qtype: 'long', items: rows.map(r => ({ text: r.question, answer: r.answer })) };
    case 'circle_words': return { ...base, qtype: 'circle', items: rows.map(r => ({ ...parseChoices(r.statement), answer: r.answer })) };
    case 'punctuation': return { ...base, qtype: 'punctuation', items: rows.map(r => ({ text: r.question, answer: r.answer })) };
    case 'comprehension': return { ...base, qtype: 'passage', instruction: 'Read the passage carefully and answer the questions.', passage: set.mainQ || '', items: rows.map(r => ({ text: r.question, answer: r.answer })) };
    default: {
      if (COMPOSITION[typeId]) {
        const [tk, ...rest] = COMPOSITION[typeId];
        return { ...base, qtype: 'composition', items: rows.map(r => ({ text: r[tk], answer: rest.map(k => r[k]).filter(Boolean).join('<br><br>') })) };
      }
      return { ...base, qtype: 'short', items: rows.map(r => ({ text: r.question || r.statement || Object.values(r).filter(v => typeof v === 'string')[0] || '', answer: r.answer || '' })) };
    }
  }
}

export function questionBankDoc({ unit, ctx = {}, labelOf = (t) => titleCase(t), setsOf }) {
  const school = currentSchool();
  const blocks = [];
  let items = 0;
  Object.entries(unit?.questions || {}).forEach(([typeId, sec]) => {
    const sets = setsOf ? setsOf(sec) : [{ mainQ: sec.mainQ, rows: sec.rows || [] }];
    sets.forEach((st, i) => {
      if (!st.rows || !st.rows.length) return;
      items += st.rows.length;
      blocks.push(questionSetFromBank(typeId, st, `${labelOf(typeId)}${sets.length > 1 ? ` — Set ${i + 1}` : ''}`));
    });
  });
  return {
    kind: 'question_bank',
    school,
    docType: 'Question Bank',
    docSub: 'Practice & Assessment',
    meta: [
      { label: 'Grade', value: ctx.className || unit?.class || '' },
      { label: 'Subject', value: ctx.subject || unit?.subject || '' },
      { label: 'Unit', value: pad2(unit?.unitNo || 1) },
      { label: 'Questions', value: String(items) },
    ],
    kicker: `Unit ${pad2(unit?.unitNo || 1)} · Question Bank`,
    title: unit?.unitName || 'Question Bank',
    subtitleBits: [`${blocks.length} question set${blocks.length === 1 ? '' : 's'}`, `${items} question${items === 1 ? '' : 's'}`],
    studentInfo: true,
    sections: [{ title: '', content: blocks, emptyText: 'No questions have been added to this unit yet.' }],
    footer: { brand: 'Mentor AI', center: `${school.name}  ·  Academic Session ${sessionYear()}` },
  };
}
