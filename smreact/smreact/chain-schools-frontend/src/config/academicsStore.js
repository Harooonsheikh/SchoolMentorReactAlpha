/* ═══════════════════════════════════════════════════════════════════
   HEAD-OFFICE ACADEMICS — single source of truth, shared between
   Settings (Classes & Subjects) and the Academics module.
   The Head Office builds academic content once; member schools can then
   fetch it (controlled by the `released` flag) or build their own.
   localStorage-backed; swap for an API later.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_academics'

const DEFAULT = {
  released: false, // Open/Released to member schools vs Closed/Held at HO
  releasedAt: null,
  releaseSeq: 0,    // number of releases made (drives version / batch id)
  releases: [],     // versioned release snapshots (history)
  schema: 6, // bump when lessonPlans / notebookPlans / releases seed changes
  nextClassId: 100, nextSubjectId: 100, nextId: 1000,

  // ── Classes & Subjects (defined in Settings) ──
  subjects: [
    { id: 1, name: 'English' }, { id: 2, name: 'Urdu' }, { id: 3, name: 'Mathematics' },
    { id: 4, name: 'Science' }, { id: 5, name: 'Social Studies' }, { id: 6, name: 'Islamiat' },
    { id: 7, name: 'Computer' }, { id: 8, name: 'Nazra / Quran' }, { id: 9, name: 'General Knowledge' },
  ],
  classes: [
    { id: 1, name: 'Nursery' }, { id: 2, name: 'KG' }, { id: 3, name: 'Class 1' },
    { id: 4, name: 'Class 2' }, { id: 5, name: 'Class 3' }, { id: 6, name: 'Class 4' }, { id: 7, name: 'Class 5' },
  ],
  classSubjects: { // classId -> [subjectId]
    1: [1, 2, 3, 8, 9], 2: [1, 2, 3, 8, 9], 3: [1, 2, 3, 4, 6, 7], 4: [1, 2, 3, 4, 6, 7],
    5: [1, 2, 3, 4, 5, 6, 7], 6: [1, 2, 3, 4, 5, 6, 7], 7: [1, 2, 3, 4, 5, 6, 7],
  },

  // ── Academics content slices (filled module by module) ──
  textbooks: [
    { id: 1001, classId: 3, subjectId: 1, title: 'My English Book 1', author: 'Oxford', publisher: 'Oxford University Press', edition: '2024', isbn: '978-0-19-000001', notes: 'Primary English reader' },
    { id: 1002, classId: 3, subjectId: 3, title: 'New Countdown 1', author: 'Shamlu Dudeja', publisher: 'Oxford University Press', edition: '3rd', isbn: '978-0-19-000002', notes: '' },
    { id: 1003, classId: 5, subjectId: 4, title: 'Science for Class 3', author: 'AFAQ', publisher: 'AFAQ Sun Series', edition: '2023', isbn: '978-9-69-000003', notes: '' },
  ],
  sessionSettings: {
    academicYear: '2026–2027', start: '2026-01-01', end: '2027-01-01', wpw: 5,
    vacations: [
      { id: 1, name: 'Kashmir Day', start: '2026-03-21', end: '2026-03-30' },
      { id: 2, name: 'Eid-ul-Fitr', start: '2026-04-01', end: '2026-04-05' },
      { id: 3, name: 'Summer Break', start: '2026-07-01', end: '2026-07-31' },
    ],
    perWeek: {}, // { classId: { subjectId: periods } }
  },
  terms: [
    { id: 1, name: 'First Term', start: '2026-01-01', end: '2026-04-30' },
    { id: 2, name: 'Mid Term', start: '2026-05-01', end: '2026-08-31' },
    { id: 3, name: 'Final Term', start: '2026-09-01', end: '2026-12-31' },
  ],
  academicCalendar: { // termId -> [{ id, heading, date }]
    1: [{ id: 1, heading: 'Session Opens', date: '2026-01-05' }, { id: 2, heading: 'First Term Exams Begin', date: '2026-04-15' }],
    2: [{ id: 3, heading: 'Mid Term Exams Begin', date: '2026-08-18' }],
    3: [{ id: 4, heading: 'Final Exams Begin', date: '2026-12-01' }, { id: 5, heading: 'Result Day', date: '2026-12-20' }],
  },
  activityCalendar: [
    { id: 1, name: 'Science Fair', start: '2026-05-07', end: '2026-05-09', status: 'ongoing', purpose: 'Showcase student science projects and experiments', development: 'Project registration, mentor assignment, judging criteria', resource: 'Science lab equipment, display boards, judging sheets' },
    { id: 2, name: 'Sports Day', start: '2026-05-17', end: '2026-05-18', status: 'upcoming', purpose: 'Annual inter-house sports competition', development: 'Event planning, team registration, ground preparation', resource: 'Sports equipment, trophies, refreshments' },
    { id: 3, name: 'Book Fair', start: '2026-05-26', end: '2026-05-29', status: 'upcoming', purpose: 'Annual school book fair with publishers', development: 'Publisher invitations, stall allocation', resource: 'Display tables, payment systems' },
    { id: 4, name: 'Parent-Teacher Meet', start: '2026-03-20', end: '2026-03-21', status: 'completed', purpose: 'Progress discussion with parents and guardians', development: 'Schedule appointments, prepare report cards', resource: 'Report cards, feedback forms' },
  ],
  // termBreakups[classId][termId][subjectId] = [{ unitNum, unitName, weeks, topics:[{topic, periods}] }]
  termBreakups: {
    3: { 1: { 1: [
      { unitNum: '1', unitName: 'Unit 1 – Reading Skills', weeks: '2', topics: [{ topic: 'Introduction to Reading', periods: '12' }, { topic: 'Comprehension Basics', periods: '10' }] },
      { unitNum: '2', unitName: 'Unit 2 – Grammar', weeks: '3', topics: [{ topic: 'Nouns & Pronouns', periods: '8' }, { topic: 'Verbs & Tenses', periods: '10' }] },
    ] } },
  },
  // lessonPlans: units → lessons → sections (SLOs / Intro / Development / Recap)
  // [{ id, classId, subjectId, unitNo, unitName, lessons:[{ id, num, topic, source, duration, sections:[{title,mins,content}] }] }]
  lessonPlans: [
    { id: 2001, classId: 3, subjectId: 1, unitNo: '1', unitName: "Fizza's Family", lessons: [
      { id: 1, num: 1, topic: 'Reading', source: 'manual', duration: 45, sections: [
        { title: 'Student Learning Objectives (SLOs)', mins: 5, content: "By the end of this lesson, students will read the passage \"Fizza's Family\" aloud with correct pronunciation, identify the family members in the story, and use new vocabulary — household, relatives, affection — in their own sentences." },
        { title: 'Lesson Introduction', mins: 5, content: 'Warm-up: Ask "How many people are in your family?" Show the picture on page 12 (Fizza with her family). Write "Family" on the board and elicit related words.' },
        { title: 'Development / Main Teaching', mins: 25, content: 'Teacher read-aloud (pg 12-14). Vocabulary table: household, relatives, affection. Comprehension Q&A. Grammar: possessive pronouns (my, his, her, their, our).' },
        { title: 'Recap / Consolidation', mins: 10, content: 'Review game "Family Chain". Exit ticket: 3 sentences using today\'s vocabulary. Homework: draw your family tree and label each person in English.' },
      ] },
      { id: 2, num: 2, topic: 'Describing Family', source: 'ai', duration: 45, sections: [
        { title: 'Student Learning Objectives (SLOs)', mins: 5, content: 'Use descriptive adjectives for family members and construct Subject + Verb + Adjective sentences.' },
        { title: 'Lesson Introduction', mins: 5, content: 'Warm-up with 3 flashcards (tall man, kind grandmother, cheerful child). Recap previous vocabulary.' },
        { title: 'Development / Main Teaching', mins: 25, content: 'Introduce adjectives. Pair activity: write 3 sentences describing a family member. Class sharing and correction on the board.' },
        { title: 'Recap / Consolidation', mins: 10, content: 'Quick recall with flashcards. Written exit task. Homework: 5 sentences about family members, each with an adjective.' },
      ] },
    ] },
  ],
  // notebookPlans: units → question sets (by question type)
  // [{ id, classId, subjectId, unitNo, unitName, questions:[{ id, type, items:[...] }] }]
  notebookPlans: [
    { id: 3001, classId: 3, subjectId: 1, unitNo: '1', unitName: 'Reading Skills', questions: [
      { id: 1, type: 'word_opposite', mainQuestion: 'Write the opposites of the following words:', items: [{ a: 'Big', b: 'Small' }, { a: 'Happy', b: 'Sad' }, { a: 'Day', b: 'Night' }] },
      { id: 2, type: 'short_questions', mainQuestion: 'Answer the following short questions:', items: [{ question: 'Who is the main character of the story?', answer: 'Fizza is the main character.' }, { question: 'Where does the story take place?', answer: "At Fizza's home with her family." }] },
      { id: 3, type: 'fill_blanks', mainQuestion: 'Fill in the blanks with the correct words:', items: [{ question: 'Fizza loves her ____ very much.', answer: 'family' }, { question: 'There are ____ people in the household.', answer: 'six' }] },
    ] },
  ],
}

export const LP_SECTIONS = [
  { title: 'Student Learning Objectives (SLOs)', mins: 5, icon: '🎯', hint: 'What will students be able to do by the end?' },
  { title: 'Lesson Introduction', mins: 5, icon: '📖', hint: 'How will you start and engage the class?' },
  { title: 'Development / Main Teaching', mins: 25, icon: '🔬', hint: 'The core teaching and activities.' },
  { title: 'Recap / Consolidation', mins: 10, icon: '✅', hint: 'How will you check what students learned?' },
]

/* Notebook-plan question types (exact set from the ERP design). */
export const AQ_TYPES = [
  { id: 'word_opposite', label: 'Word / Opposite', icon: 'fa-arrows-left-right' },
  { id: 'singular_plural', label: 'Singular / Plural', icon: 'fa-clone' },
  { id: 'word_synonyms', label: 'Word / Synonyms', icon: 'fa-spell-check' },
  { id: 'word_sentences', label: 'Word Sentences', icon: 'fa-pen-fancy' },
  { id: 'mcqs', label: 'MCQs Field', icon: 'fa-list-ol' },
  { id: 'fill_blanks', label: 'Fill in the Blanks', icon: 'fa-underline' },
  { id: 'true_false', label: 'True / False', icon: 'fa-check-to-slot' },
  { id: 'match_columns', label: 'Match the Columns', icon: 'fa-table-columns' },
  { id: 'short_questions', label: 'Short Questions', icon: 'fa-comment-dots' },
  { id: 'circle_words', label: 'Circle the Correct Words', icon: 'fa-circle-dot' },
  { id: 'punctuation', label: 'Punctuation', icon: 'fa-exclamation' },
  { id: 'long_question', label: 'Long Question', icon: 'fa-align-left' },
  { id: 'paragraph', label: 'Paragraph Writing', icon: 'fa-paragraph' },
  { id: 'comprehension', label: 'Comprehension', icon: 'fa-book-open' },
  { id: 'letter', label: 'Letter', icon: 'fa-envelope' },
  { id: 'application', label: 'Application', icon: 'fa-file-pen' },
  { id: 'stories', label: 'Stories', icon: 'fa-book-bookmark' },
  { id: 'essays', label: 'Essays', icon: 'fa-feather-pointed' },
]
export const AQ_CONFIG = {
  word_opposite: { title: 'Word / Opposite', layout: 'two', a: 'Word', b: 'Opposite', arrow: '↔', icon: 'fa-arrows-left-right' },
  singular_plural: { title: 'Singular / Plural', layout: 'two', a: 'Singular', b: 'Plural', arrow: '→', icon: 'fa-clone' },
  word_synonyms: { title: 'Word / Synonyms', layout: 'two', a: 'Word', b: 'Synonym', arrow: '=', icon: 'fa-spell-check' },
  match_columns: { title: 'Match the Columns', layout: 'match', icon: 'fa-table-columns' },
  word_sentences: { title: 'Word Sentences', layout: 'word-sentence', icon: 'fa-pen-fancy' },
  mcqs: { title: 'MCQs Field', layout: 'mcq', icon: 'fa-list-ol' },
  fill_blanks: { title: 'Fill in the Blanks', layout: 'fill-blanks', icon: 'fa-underline' },
  true_false: { title: 'True / False', layout: 'true-false', icon: 'fa-check-to-slot' },
  short_questions: { title: 'Short Questions', layout: 'qa-rte', qLabel: 'Question', aLabel: 'Answer', icon: 'fa-comment-dots' },
  circle_words: { title: 'Circle the Correct Words', layout: 'circle', icon: 'fa-circle-dot' },
  punctuation: { title: 'Punctuation', layout: 'punctuation', icon: 'fa-exclamation' },
  long_question: { title: 'Long Question', layout: 'qa-rte', qLabel: 'Question', aLabel: 'Answer / Model Answer', icon: 'fa-align-left' },
  comprehension: { title: 'Comprehension', layout: 'qa-rte', qLabel: 'Question', aLabel: 'Answer', icon: 'fa-book-open' },
  paragraph: { title: 'Paragraph Writing', layout: 'rte', fields: [{ key: 'title', label: 'Title' }, { key: 'body', label: 'Paragraph Body' }], icon: 'fa-paragraph' },
  letter: { title: 'Letter', layout: 'rte', fields: [{ key: 'subject', label: 'Subject' }, { key: 'body', label: 'Body' }], icon: 'fa-envelope' },
  application: { title: 'Application', layout: 'rte', fields: [{ key: 'subject', label: 'Subject' }, { key: 'body', label: 'Body' }], icon: 'fa-file-pen' },
  stories: { title: 'Stories', layout: 'rte', fields: [{ key: 'title', label: 'Title' }, { key: 'body', label: 'Story Body' }, { key: 'moral', label: 'Moral' }], icon: 'fa-book-bookmark' },
  essays: { title: 'Essays', layout: 'rte', fields: [{ key: 'title', label: 'Title' }, { key: 'body', label: 'Essay Body' }, { key: 'conclusion', label: 'Conclusion' }], icon: 'fa-feather-pointed' },
}
export const aqLabel = (type) => AQ_CONFIG[type]?.title || type

/* Session day-count maths (mirrors the ERP design). */
export function vacationSpan(v) { const a = new Date(v.start); const b = new Date(v.end); if (Number.isNaN(+a) || Number.isNaN(+b) || b < a) return 0; return Math.round((b - a) / 86400000) + 1 }
export function sessionStats(s = {}) {
  const start = new Date(s.start); const end = new Date(s.end); const wpw = Number(s.wpw) || 5
  if (Number.isNaN(+start) || Number.isNaN(+end) || end <= start) return { totalDays: 0, onDays: 0, vacationDays: 0, workingDays: 0, workingWeeks: 0, wpw }
  const totalDays = Math.round((end - start) / 86400000)
  const onDays = Math.round((totalDays / 7) * wpw)
  const vacationDays = (s.vacations || []).reduce((n, v) => n + vacationSpan(v), 0)
  const workingDays = Math.max(0, onDays - vacationDays)
  return { totalDays, onDays, vacationDays, workingDays, workingWeeks: +(workingDays / wpw).toFixed(2), wpw }
}

export function loadAcademics() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY))
    if (d?.classes) {
      const merged = { ...DEFAULT, ...d }
      // Migrate the lesson/notebook slices whenever their shape changes, so
      // stale localStorage from an older build can't crash the module.
      if (d.schema !== DEFAULT.schema) {
        merged.schema = DEFAULT.schema
        merged.lessonPlans = JSON.parse(JSON.stringify(DEFAULT.lessonPlans))
        merged.notebookPlans = JSON.parse(JSON.stringify(DEFAULT.notebookPlans))
        merged.releases = JSON.parse(JSON.stringify(DEFAULT.releases))
        merged.releaseSeq = DEFAULT.releaseSeq
        merged.released = DEFAULT.released
        merged.releasedAt = DEFAULT.releasedAt
        saveAcademics(merged)
      }
      // Defensive: ensure required arrays/shapes exist.
      merged.releases = merged.releases || []
      merged.lessonPlans = (merged.lessonPlans || []).map((u) => ({ ...u, lessons: u.lessons || [] }))
      merged.notebookPlans = (merged.notebookPlans || []).map((u) => ({ ...u, questions: u.questions || [] }))
      merged.sessionSettings = { ...DEFAULT.sessionSettings, ...(d.sessionSettings || {}), vacations: (d.sessionSettings?.vacations) || DEFAULT.sessionSettings.vacations, perWeek: d.sessionSettings?.perWeek || {} }
      return merged
    }
  } catch { /* reseed */ }
  localStorage.setItem(KEY, JSON.stringify(DEFAULT))
  return JSON.parse(JSON.stringify(DEFAULT))
}
export const saveAcademics = (d) => localStorage.setItem(KEY, JSON.stringify(d))

export const className = (a, id) => a.classes.find((c) => c.id === id)?.name || '—'
export const subjectName = (a, id) => a.subjects.find((s) => s.id === id)?.name || '—'
export const subjectsOfClass = (a, classId) => (a.classSubjects[classId] || []).map((sid) => a.subjects.find((s) => s.id === sid)).filter(Boolean)

/* ═══════════════ Other Academic Resources (class/subject/category PDFs) ═══════════════
   Stored under a separate localStorage key so uploaded PDF data never bloats
   or risks the main academics store. Ready for API: swap load/save with
   GET/POST /academics resources later. */
export const RES_CATEGORIES = [
  { key: 'worksheet', label: 'Worksheets', icon: 'fa-file-lines', color: 'blue' },
  { key: 'summer', label: 'Summer Vacation Work', icon: 'fa-umbrella-beach', color: 'amber' },
  { key: 'qpaper', label: 'Question Papers', icon: 'fa-file-pen', color: 'purple' },
  { key: 'other', label: 'Others', icon: 'fa-folder', color: 'teal' },
]
export const RES_STATUS = {
  draft: { label: 'Draft', badge: 'b-gray' },
  published: { label: 'Published', badge: 'b-green' },
  hidden: { label: 'Hidden', badge: 'b-amber' },
}
export const resCategory = (k) => RES_CATEGORIES.find((c) => c.key === k) || RES_CATEGORIES[3]

const RES_KEY = 'chain-academics-resources'
const DEFAULT_RESOURCES = [
  { id: 1, classId: 3, subjectId: 1, category: 'worksheet', title: 'English Grammar Worksheet — Nouns', desc: 'Practice worksheet on common and proper nouns with examples.', fileName: 'english-nouns-worksheet.pdf', fileData: null, uploadDate: '2026-06-10', status: 'published' },
  { id: 2, classId: 3, subjectId: 2, category: 'summer', title: 'Summer Vacation Work — Urdu', desc: 'Holiday assignment booklet for Urdu reading and writing.', fileName: 'urdu-summer-work.pdf', fileData: null, uploadDate: '2026-06-12', status: 'published' },
  { id: 3, classId: 5, subjectId: 4, category: 'qpaper', title: 'Science Mid-Term Question Paper', desc: 'Sample question paper for the mid-term assessment.', fileName: 'science-midterm-qp.pdf', fileData: null, uploadDate: '2026-06-14', status: 'draft' },
  { id: 4, classId: 6, subjectId: 3, category: 'other', title: 'Maths Reference Sheet', desc: 'Formula and reference sheet for quick revision.', fileName: 'maths-reference.pdf', fileData: null, uploadDate: '2026-06-15', status: 'hidden' },
  { id: 5, classId: 7, subjectId: 4, category: 'worksheet', title: 'Science Worksheet — Living Things', desc: 'Activity worksheet covering plants and animals.', fileName: 'science-living-things.pdf', fileData: null, uploadDate: '2026-06-16', status: 'published' },
]

/* Seed a live Master Release so the "Currently Live for Schools" card has
   content out of the box. Its snapshot is a frozen copy of the seed content. */
const SEED_MASTER_RELEASE = {
  id: 'rel-seed-1',
  releaseType: 'MASTER_RELEASE', releaseTitle: 'Master Release 1', label: 'Master Release 1', releaseNumber: 1, version: 1,
  batchId: 'MR-2026-001', parentReleaseId: null, headOfficeId: 'HO-001',
  appliesToAllSchools: true,
  selectedSchoolIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], schoolCount: 10,
  releasedAt: '2026-06-26T09:00:00.000Z', createdAt: '2026-06-26T09:00:00.000Z', updatedAt: '2026-06-26T09:00:00.000Z',
  validityDays: 30, validUntil: '2026-07-26', dueDate: '2026-07-26',
  releasedBy: 'Head Office', releaseStatus: 'ACTIVE',
  contentSummary: { classes: 1, lessons: 2, notebooks: 1, resourceFiles: DEFAULT_RESOURCES.length, activities: DEFAULT.activityCalendar.length },
  activityIds: DEFAULT.activityCalendar.map((x) => x.id),
  lessonPlanIds: DEFAULT.lessonPlans.map((u) => u.id),
  notebookPlanIds: DEFAULT.notebookPlans.map((u) => u.id),
  resourceLibraryIds: DEFAULT_RESOURCES.map((r) => r.id),
  snapshot: {
    lessonPlans: JSON.parse(JSON.stringify(DEFAULT.lessonPlans)),
    notebookPlans: JSON.parse(JSON.stringify(DEFAULT.notebookPlans)),
    activityCalendar: JSON.parse(JSON.stringify(DEFAULT.activityCalendar)),
    resources: JSON.parse(JSON.stringify(DEFAULT_RESOURCES)),
  },
}
DEFAULT.releases = [SEED_MASTER_RELEASE]
DEFAULT.releaseSeq = 1
DEFAULT.released = true
DEFAULT.releasedAt = '2026-06-26'

export function loadResources() {
  try { const d = JSON.parse(localStorage.getItem(RES_KEY)); if (Array.isArray(d)) return d } catch { /* reseed */ }
  localStorage.setItem(RES_KEY, JSON.stringify(DEFAULT_RESOURCES))
  return JSON.parse(JSON.stringify(DEFAULT_RESOURCES))
}
export function saveResources(list) {
  try { localStorage.setItem(RES_KEY, JSON.stringify(list)); return true } catch { return false }
}
export const nextResourceId = (list) => (list.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1
