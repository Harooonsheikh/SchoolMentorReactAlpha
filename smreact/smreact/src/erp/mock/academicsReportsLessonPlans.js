/* Lesson Plans seed data — sourced from earlier inline INITIAL_* in
   LessonPlans.js. The academicsService re-exposes these via
   getSubLpData, etc. Backend team can swap in real API responses
   without touching the UI.

   Term Breakups' class list now comes straight from LP_CLASSES in
   LessonPlans.js (same array Units Management uses) instead of a
   separate mockTermBreakupClasses, so the two screens can never show
   different classes or a different order. */

/* ─── Term Breakups — real entries, for the Teacher Performance &
   Activity Report (Academics → Reports) ───
   LessonPlans.js's own Term Breakups screen (TermBreakupModal) never
   actually persists anything — its "Save" button resets to the same
   blank 1-unit scratch form on every open, for every class, and never
   writes to any array or service (confirmed by reading that component:
   no mock import, no setState lifted to a parent, just a toast + close).
   So there was no existing record to read "entries created" from.
   This is a new, genuinely real, additive dataset — not a duplicate of
   anything that already existed — seeded with entries for the 5 real
   Academics teachers' real class/subject assignments, so the Reports
   tab can compute a real count instead of a fabricated one. It does
   NOT change the existing (still cosmetic) Term Breakups screen. */
export const mockTermBreakups = [
  { id: 1, class: 'Class V',    subject: 'Science', teacher: 'Mr. Ahmed Ali',    term: '2nd',      unitNum: '1', unitName: 'Living Things',   weeksRequired: '3', topicsCount: 3 },
  { id: 2, class: 'Class V',    subject: 'Science', teacher: 'Mr. Ahmed Ali',    term: '2nd',      unitNum: '2', unitName: 'Human Body',      weeksRequired: '3', topicsCount: 3 },
  { id: 3, class: 'Class V',    subject: 'English', teacher: 'Mr. Ahmed Ali',    term: '2nd',      unitNum: '1', unitName: 'Reading Skills',  weeksRequired: '2', topicsCount: 4 },
  { id: 4, class: 'Class VI',   subject: 'English', teacher: 'Ms. Fatima Noor',  term: '2nd',      unitNum: '1', unitName: 'Earth & Space',   weeksRequired: '3', topicsCount: 4 },
  { id: 5, class: 'Class VI',   subject: 'English', teacher: 'Ms. Fatima Noor',  term: '3rd Term', unitNum: '2', unitName: 'Grammar Basics',  weeksRequired: '2', topicsCount: 3 },
  { id: 6, class: 'Class VII',  subject: 'Math',     teacher: 'Mr. Usman Raza',  term: '3rd Term', unitNum: '1', unitName: 'Forces & Motion',  weeksRequired: '3', topicsCount: 3 },
  { id: 7, class: 'Class IV',   subject: 'Urdu',     teacher: 'Ms. Ayesha Khan',  term: '3rd Term', unitNum: '1', unitName: 'Energy',          weeksRequired: '2', topicsCount: 2 },
  { id: 8, class: 'Class VIII', subject: 'SST',      teacher: 'Mr. Bilal Hassan', term: '2nd',      unitNum: '1', unitName: 'Our School',      weeksRequired: '2', topicsCount: 3 },
];

/* ─── Units Management / Lesson Plans / Question Bank — ONE shared
   catalog ───
   Backs Academics → Lesson Plans everywhere a class+subject's units are
   shown: the "Units Management" sub-tab, the "Lesson Plan / Question
   Bank" screen (both its Lesson Plans AND Question Bank sub-tabs read
   this SAME array, filtered by class+subject), and feeds the names used
   to seed the Submissions demo data below. There is deliberately no
   second mockUnits/mockNbUnits array any more — every screen that shows
   "the units for Class X, Subject Y" reads this one catalog, so renaming,
   reordering or adding a unit anywhere is automatically reflected
   everywhere else.

   Each entry is { id, class, section, subject, unitNo, unitName,
   lessons, questions } — lessons is the Lesson Plan shape
   (unitNo/topic/source), questions is the Question Bank shape
   ({ [typeId]: {mainQ, rows} }), exactly as QbEditorModal / UnitRow
   already expect. `section` ('A'/'B'/'C') makes every section its own
   fully independent set of units — Section A, B and C each got their
   OWN generated units below, not a shared/derived list, so editing,
   reordering or copying one section's units never touches another's.

   Seeded with 12 units per class+section+subject (classes/subjects
   mirror LP_CLASSES / LP_SUBJECTS_BY_CLASS, sections mirror
   SUB_SECTIONS, both in LessonPlans.js), each with realistic,
   subject-appropriate unit names (from the topic pools below) plus two
   sample lessons (one manual, one Mentor-AI-sourced) and two sample
   Question Bank types (MCQs + Short Questions) — so no unit anywhere
   in the app is ever empty. */
const UC_CLASSES = [
  'Nursery', 'KG-1', 'KG-2',
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII',
  'Class IX Sci', 'Class IX Arts', 'Class X Sci', 'Class X Arts',
  'FSc I Pre-Med', 'FSc I Pre-Eng', 'FSc II Pre-Med', 'FSc II Pre-Eng',
  'O-Levels',
];
/* Mirrors SUB_SECTIONS in LessonPlans.js — every class has 3 sections,
   each with its OWN independent set of units (not shared/derived from
   one another), matching the real ERP's per-section configuration. */
const UC_SECTIONS = ['A', 'B', 'C'];
const UC_SUBJECTS_BY_CLASS = {
  default: ['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies', 'Islamiat'],
  'Nursery': ['English', 'Urdu', 'Numeracy', 'Rhymes'],
  'KG-1': ['English', 'Urdu', 'Numeracy', 'Activities'],
  'KG-2': ['English', 'Urdu', 'Numeracy', 'Activities'],
};
const UC_UNITS_PER_SUBJECT = 12;

/* 12 realistic, curriculum-style unit/topic names per subject. Reused
   across every class that teaches that subject (early-years classes
   repeat the same broad topics, exactly like a real school's scheme of
   studies does across parallel sections/years). */
const UC_TOPIC_POOLS = {
  English: [
    'My Family and I', 'My School', 'My Body', 'Animals Around Us',
    'Healthy Habits', 'Our Community', 'Weather and Seasons', 'Food We Eat',
    'Shapes and Colours', 'Transport and Travel', 'Festivals We Celebrate', 'Helpers Around Us',
  ],
  Urdu: [
    'Urdu Alphabets (حروف)', 'Two-Letter Words', 'Three-Letter Words', 'Imla Practice',
    'Poem Recitation', 'Days of the Week', 'Months of the Year', 'Counting in Urdu',
    'Simple Sentences', 'Story Reading', 'Basic Grammar', 'Urdu Rhymes',
  ],
  Numeracy: [
    'Numbers 1–10', 'Numbers 11–20', 'Counting & Grouping', 'Shapes Recognition',
    'Big & Small', 'More & Less', 'Simple Patterns', 'Addition Basics',
    'Subtraction Basics', 'Days & Calendar', 'Matching & Sorting', 'Number Writing Practice',
  ],
  Rhymes: [
    'Twinkle Twinkle Little Star', 'Baa Baa Black Sheep', 'Jack and Jill', 'Humpty Dumpty',
    'Row Row Row Your Boat', 'Rain Rain Go Away', 'Old MacDonald Had a Farm', 'Hickory Dickory Dock',
    'Incy Wincy Spider', 'Five Little Ducks', 'Johny Johny Yes Papa', 'The Wheels on the Bus',
  ],
  Activities: [
    'Craft Time', 'Colouring Fun', 'Story Time', 'Building Blocks',
    'Puzzle Play', 'Music and Movement', 'Outdoor Play', 'Art and Painting',
    'Role Play', 'Sensory Play', 'Nature Walk', 'Show and Tell',
  ],
  Mathematics: [
    'Numbers and Place Value', 'Addition', 'Subtraction', 'Multiplication',
    'Division', 'Fractions', 'Shapes and Geometry', 'Measurement',
    'Time', 'Money', 'Data Handling', 'Patterns',
  ],
  Science: [
    'Living and Non-Living Things', 'Plants Around Us', 'Animals and Their Homes', 'Human Body',
    'Our Senses', 'Water and Its Uses', 'Air Around Us', 'Weather and Seasons',
    'Food and Nutrition', 'Simple Machines', 'The Solar System', 'Caring for the Environment',
  ],
  'Social Studies': [
    'My Family and Home', 'My Neighbourhood', 'Our School Community', 'Maps and Directions',
    'Our City', 'Our Country Pakistan', 'National Heroes', 'Our Culture and Traditions',
    'Means of Transport', 'Means of Communication', 'Our Festivals', 'Good Citizenship',
  ],
  Islamiat: [
    'Kalima and Its Meaning', 'Short Surahs', 'Daily Duas', 'Names of Allah',
    'The Life of Prophet Muhammad ﷺ', 'Pillars of Islam', 'Importance of Prayer', 'Islamic Manners',
    'Respect for Elders', 'Honesty and Truthfulness', 'Cleanliness in Islam', 'Stories of the Prophets',
  ],
};
function ucTopicFor(subject, n) {
  const pool = UC_TOPIC_POOLS[subject] || UC_TOPIC_POOLS.English;
  return pool[(n - 1) % pool.length];
}

function ucBuildLessons(subject, topic, n) {
  return [
    { id: n * 10 + 1, num: '1', topic: `Introduction to ${topic}`, source: n % 2 === 0 ? 'manual' : 'mentorai', content: '' },
    { id: n * 10 + 2, num: '2', topic: `${topic} — Activity & Practice`, source: n % 2 === 0 ? 'mentorai' : 'manual', content: '' },
  ];
}
function ucBuildQuestions(subject, topic, n) {
  return {
    mcqs: {
      mainQ: `Choose the correct option about ${topic}`,
      rows: [
        { question: `Which of these best relates to "${topic}"?`, opt1: `${topic} — Fact A`, opt2: `${topic} — Fact B`, opt3: `${topic} — Fact C`, opt4: `${topic} — Fact D`, correct: 'A' },
        { question: `"${topic}" is part of which subject?`, opt1: subject, opt2: 'Unrelated Subject', opt3: 'None of these', opt4: 'All of these', correct: 'A' },
        { question: `What is the main idea of Unit ${n} — "${topic}"?`, opt1: 'Understanding the basics', opt2: 'Ignoring the topic', opt3: 'Skipping practice', opt4: 'None of these', correct: 'A' },
      ],
    },
    short_questions: {
      mainQ: `Answer the following short questions about ${topic}`,
      rows: [
        { question: `What did you learn in "${topic}"?`, answer: `We learned the basics of ${topic.toLowerCase()}.` },
        { question: `Why is "${topic}" important?`, answer: `It helps us understand ${subject.toLowerCase()} better.` },
        { question: `Give one example related to "${topic}".`, answer: `An example from "${topic}" discussed in class.` },
      ],
    },
  };
}

function buildMockUnitsCatalog() {
  let id = 1;
  const out = [];
  UC_CLASSES.forEach(cls => {
    const subjects = UC_SUBJECTS_BY_CLASS[cls] || UC_SUBJECTS_BY_CLASS.default;
    UC_SECTIONS.forEach(section => {
      subjects.forEach(subject => {
        for (let n = 1; n <= UC_UNITS_PER_SUBJECT; n++) {
          const topic = ucTopicFor(subject, n);
          out.push({
            id: id++, class: cls, section, subject, unitNo: String(n), unitName: topic,
            lessons: ucBuildLessons(subject, topic, n),
            questions: ucBuildQuestions(subject, topic, n),
          });
        }
      });
    });
  });
  return out;
}

export const mockUnitsCatalog = buildMockUnitsCatalog();


/* ─── Class / Subject / Teacher — real linkage for Submissions tracking ───
   The Submissions screen's own Class/Section/Subject picker above never
   actually filtered mockSubLpData/mockSubNbData (cosmetic only — it just
   showed a toast). These records had no class/subject/teacher field at
   all. Added so the Dashboard's Academics section (teacher-wise and
   class/subject-wise summaries) can compute real numbers instead of
   hand-typed placeholders. Reuses the same teacher/class/subject
   identities already seeded in LessonPlans.js's SUB_ADMIN_TEACHERS for
   consistency, extended with one teacher who teaches two subjects in the
   same class — mirrors a real school's staffing pattern, and is exactly
   the "180 total across two subjects" case a teacher-wise summary needs
   to add up correctly. */
export const mockAcademicsClasses = [
  { name: 'Class IV',   subjects: ['Urdu'] },
  { name: 'Class V',    subjects: ['Science', 'English'] },
  { name: 'Class VI',   subjects: ['English'] },
  { name: 'Class VII',  subjects: ['Math'] },
  { name: 'Class VIII', subjects: ['SST'] },
];

export const mockAcademicsTeacherAssignments = [
  { teacher: 'Mr. Ahmed Ali',    class: 'Class V',    subject: 'Science' },
  { teacher: 'Mr. Ahmed Ali',    class: 'Class V',    subject: 'English' },
  { teacher: 'Ms. Fatima Noor',  class: 'Class VI',   subject: 'English' },
  { teacher: 'Mr. Usman Raza',   class: 'Class VII',  subject: 'Math' },
  { teacher: 'Ms. Ayesha Khan',  class: 'Class IV',   subject: 'Urdu' },
  { teacher: 'Mr. Bilal Hassan', class: 'Class VIII', subject: 'SST' },
];

export const mockSubLpData = [
  { id:1,  unitNo:'1', unit:'Unit 1 — Living Things',        topic:'Introduction to Plants',    date:'Jan 5, 2026',  term:'2nd',     status:'submitted', submittedDate:'Jan 10, 2026', class:'Class V',   subject:'Science', teacher:'Mr. Ahmed Ali' },
  { id:2,  unitNo:'1', unit:'Unit 1 — Living Things',        topic:'Parts of a Plant',          date:'Jan 8, 2026',  term:'2nd',     status:'submitted', submittedDate:'Jan 12, 2026', class:'Class V',   subject:'Science', teacher:'Mr. Ahmed Ali' },
  { id:3,  unitNo:'1', unit:'Unit 1 — Living Things',        topic:'Photosynthesis',            date:'Jan 10, 2026', term:'2nd',     status:'submitted', submittedDate:'Jan 15, 2026', class:'Class V',   subject:'Science', teacher:'Mr. Ahmed Ali' },
  { id:4,  unitNo:'2', unit:'Unit 2 — Human Body',           topic:'The Skeletal System',       date:'Jan 15, 2026', term:'2nd',     status:'submitted', submittedDate:'Jan 20, 2026', class:'Class V',   subject:'English', teacher:'Mr. Ahmed Ali' },
  { id:5,  unitNo:'2', unit:'Unit 2 — Human Body',           topic:'The Digestive System',      date:'Jan 18, 2026', term:'2nd',     status:'submitted', submittedDate:'Jan 24, 2026', class:'Class V',   subject:'English', teacher:'Mr. Ahmed Ali' },
  { id:6,  unitNo:'2', unit:'Unit 2 — Human Body',           topic:'The Respiratory System',    date:'Jan 20, 2026', term:'2nd',     status:'submitted', submittedDate:'Jan 28, 2026', class:'Class V',   subject:'English', teacher:'Mr. Ahmed Ali' },
  { id:7,  unitNo:'3', unit:'Unit 3 — Earth & Space',        topic:'Layers of the Earth',       date:'Feb 2, 2026',  term:'2nd',     status:'submitted', submittedDate:'Feb 8, 2026',  class:'Class VI',  subject:'English', teacher:'Ms. Fatima Noor' },
  { id:8,  unitNo:'3', unit:'Unit 3 — Earth & Space',        topic:'Volcanoes and Earthquakes', date:'Feb 5, 2026',  term:'2nd',     status:'submitted', submittedDate:'Feb 10, 2026', class:'Class VI',  subject:'English', teacher:'Ms. Fatima Noor' },
  { id:9,  unitNo:'3', unit:'Unit 3 — Earth & Space',        topic:'The Solar System',          date:'Feb 8, 2026',  term:'2nd',     status:'pending',   submittedDate:'',             class:'Class VI',  subject:'English', teacher:'Ms. Fatima Noor' },
  { id:10, unitNo:'3', unit:'Unit 3 — Earth & Space',        topic:'Stars and Galaxies',        date:'Feb 10, 2026', term:'2nd',     status:'pending',   submittedDate:'',             class:'Class VI',  subject:'English', teacher:'Ms. Fatima Noor' },
  { id:11, unitNo:'4', unit:'Unit 4 — Forces & Motion',      topic:'Types of Forces',           date:'Mar 2, 2026',  term:'3rd Term',status:'pending',   submittedDate:'',             class:'Class VII', subject:'Math',    teacher:'Mr. Usman Raza' },
  { id:12, unitNo:'4', unit:'Unit 4 — Forces & Motion',      topic:"Newton's Laws",             date:'Mar 5, 2026',  term:'3rd Term',status:'pending',   submittedDate:'',             class:'Class VII', subject:'Math',    teacher:'Mr. Usman Raza' },
  { id:13, unitNo:'4', unit:'Unit 4 — Forces & Motion',      topic:'Friction and Gravity',      date:'Mar 8, 2026',  term:'3rd Term',status:'pending',   submittedDate:'',             class:'Class VII', subject:'Math',    teacher:'Mr. Usman Raza' },
  { id:14, unitNo:'5', unit:'Unit 5 — Energy',               topic:'Forms of Energy',           date:'Mar 15, 2026', term:'3rd Term',status:'pending',   submittedDate:'',             class:'Class IV',  subject:'Urdu',    teacher:'Ms. Ayesha Khan' },
  { id:15, unitNo:'5', unit:'Unit 5 — Energy',               topic:'Conservation of Energy',    date:'Mar 18, 2026', term:'3rd Term',status:'pending',   submittedDate:'',             class:'Class IV',  subject:'Urdu',    teacher:'Ms. Ayesha Khan' },
];

/* ─── Extra classes — a realistic ~20-class school ───
   The 5 classes above are the hand-written, detailed example. A real
   school runs closer to 20 classes/sections, and the Dashboard's
   Academics section (chart + card grids) needs to be checked against
   that scale, not just 5. Each entry below reuses one of the SAME 5
   real teachers, teaching their own subject in more classes — exactly
   how a subject specialist teacher works in a real school, not new
   invented staff. Deterministic (no Math.random), so the numbers never
   change between reloads. */
const EXTRA_CLASS_SUBJECT_TEACHER = [
  { class: 'Nursery',             subject: 'Science', teacher: 'Mr. Ahmed Ali'    },
  { class: 'Prep',                subject: 'Science', teacher: 'Mr. Ahmed Ali'    },
  { class: 'Class I',             subject: 'Science', teacher: 'Mr. Ahmed Ali'    },
  { class: 'KG',                  subject: 'English',  teacher: 'Ms. Fatima Noor'  },
  { class: 'Class II',            subject: 'English',  teacher: 'Ms. Fatima Noor'  },
  { class: 'Class IX',            subject: 'English',  teacher: 'Ms. Fatima Noor'  },
  { class: 'Class III',           subject: 'Math',     teacher: 'Mr. Usman Raza'   },
  { class: 'Class X',             subject: 'Math',     teacher: 'Mr. Usman Raza'   },
  { class: 'Class IV Section B',  subject: 'Math',     teacher: 'Mr. Usman Raza'   },
  { class: 'Class XI',            subject: 'Urdu',     teacher: 'Ms. Ayesha Khan'  },
  { class: 'Class V Section B',   subject: 'Urdu',     teacher: 'Ms. Ayesha Khan'  },
  { class: 'Montessori',          subject: 'Urdu',     teacher: 'Ms. Ayesha Khan'  },
  { class: 'Class XII',           subject: 'SST',      teacher: 'Mr. Bilal Hassan' },
  { class: 'Class VI Section B',  subject: 'SST',      teacher: 'Mr. Bilal Hassan' },
  { class: 'Class VII Section B', subject: 'SST',      teacher: 'Mr. Bilal Hassan' },
];
EXTRA_CLASS_SUBJECT_TEACHER.forEach(a => {
  mockAcademicsTeacherAssignments.push(a);
  mockAcademicsClasses.push({ name: a.class, subjects: [a.subject] });
});

/* 3 lesson plan records per extra assignment (2 submitted, 1 pending —
   deterministic, not random), continuing the id/unitNo sequence above. */
let _extraLpId = mockSubLpData.length;
let _extraUnitNo = 5;
EXTRA_CLASS_SUBJECT_TEACHER.forEach((a) => {
  _extraUnitNo += 1;
  for (let n = 1; n <= 3; n++) {
    _extraLpId += 1;
    const submitted = n <= 2;
    mockSubLpData.push({
      id: _extraLpId,
      unitNo: String(_extraUnitNo),
      unit: `Unit ${_extraUnitNo} ${a.subject} Fundamentals`,
      topic: `${a.subject} Topic ${n}`,
      date: 'Apr 1, 2026', term: '3rd Term',
      status: submitted ? 'submitted' : 'pending',
      submittedDate: submitted ? 'Apr 5, 2026' : '',
      class: a.class, subject: a.subject, teacher: a.teacher,
    });
  }
});

export const mockSubNbData = [
  {
    unitId: 'u1', unitNo: '1', unitName: "Fizza's Family", class: 'Class V', subject: 'Science', teacher: 'Mr. Ahmed Ali',
    questionTypes: [
      { typeId:'word_opposite',   mainQ:'Write the opposite of each word.', items:[
        { id:'wo1', preview:'Big → Small',    status:'submitted' },
        { id:'wo2', preview:'Hot → Cold',     status:'submitted' },
        { id:'wo3', preview:'Happy → Sad',    status:'submitted' },
        { id:'wo4', preview:'Fast → Slow',    status:'pending'   },
        { id:'wo5', preview:'Open → Close',   status:'pending'   },
      ]},
      { typeId:'singular_plural', mainQ:'Write the plural of each word.', items:[
        { id:'sp1', preview:'Cat → Cats',       status:'submitted' },
        { id:'sp2', preview:'Book → Books',     status:'submitted' },
        { id:'sp3', preview:'Child → Children', status:'pending'   },
        { id:'sp4', preview:'Mouse → Mice',     status:'pending'   },
        { id:'sp5', preview:'Foot → Feet',      status:'pending'   },
      ]},
      { typeId:'word_synonyms', mainQ:'Write a synonym for each word.', items:[
        { id:'ws1', preview:'Happy → Joyful',  status:'submitted' },
        { id:'ws2', preview:'Big → Large',     status:'submitted' },
        { id:'ws3', preview:'Smart → Clever',  status:'pending'   },
        { id:'ws4', preview:'Fast → Quick',    status:'pending'   },
        { id:'ws5', preview:'Angry → Furious', status:'pending'   },
      ]},
      { typeId:'mcqs', mainQ:'Choose the correct answer.', items:[
        { id:'m1', preview:'What is the plural of "child"? → Children (B)', status:'submitted' },
        { id:'m2', preview:'Which word means "happy"? → Joyful (C)',        status:'submitted' },
        { id:'m3', preview:'What is the opposite of "hot"? → Cold (B)',     status:'pending'   },
        { id:'m4', preview:'Which is a verb? → Run (B)',                    status:'pending'   },
        { id:'m5', preview:"Fizza's family has how many members? → 5 (C)",  status:'pending'   },
      ]},
      { typeId:'fill_blanks', mainQ:'Fill in the blanks with correct words.', items:[
        { id:'f1', preview:'Fizza loves her ___ very much. → family',             status:'submitted' },
        { id:'f2', preview:'Her mother prepares ___ food every day. → delicious', status:'submitted' },
        { id:'f3', preview:'They live in a ___ and happy home. → peaceful',       status:'pending'   },
        { id:'f4', preview:'Her father goes to ___ every morning. → work',        status:'pending'   },
        { id:'f5', preview:'Fizza plays with her ___ after school. → friends',    status:'pending'   },
      ]},
      { typeId:'true_false', mainQ:'Write True or False for each statement.', items:[
        { id:'t1', preview:'Fizza lives with her family. → True',                       status:'submitted' },
        { id:'t2', preview:'Her father does not go to work. → False',                   status:'submitted' },
        { id:'t3', preview:'A family is made up of people who love each other. → True', status:'pending'   },
        { id:'t4', preview:'Fizza dislikes her home. → False',                          status:'pending'   },
        { id:'t5', preview:'Mother cooks food for the family. → True',                  status:'pending'   },
      ]},
      { typeId:'match_columns', mainQ:'Match Column A with Column B.', items:[
        { id:'mc1', preview:'Mother ↔ Cooks food',                 status:'submitted' },
        { id:'mc2', preview:'Father ↔ Goes to work',               status:'submitted' },
        { id:'mc3', preview:'Fizza ↔ Goes to school',              status:'pending'   },
        { id:'mc4', preview:'Home ↔ Place of love',                status:'pending'   },
        { id:'mc5', preview:'Family ↔ People who love each other', status:'pending'   },
      ]},
      { typeId:'short_questions', mainQ:'Answer the following short questions.', items:[
        { id:'sq1', preview:'Who is Fizza?',             status:'submitted' },
        { id:'sq2', preview:'What does her mother do?',  status:'submitted' },
        { id:'sq3', preview:'Where does her father go?', status:'pending'   },
        { id:'sq4', preview:'What is a family?',         status:'pending'   },
        { id:'sq5', preview:'Why is home important?',    status:'pending'   },
      ]},
    ],
  },
  {
    unitId: 'u2', unitNo: '2', unitName: 'Our School', class: 'Class VIII', subject: 'SST', teacher: 'Mr. Bilal Hassan',
    questionTypes: [
      { typeId:'word_opposite', mainQ:'Write the opposite of each word.', items:[
        { id:'u2wo1', preview:'Clean → Dirty',  status:'submitted' },
        { id:'u2wo2', preview:'Quiet → Noisy',  status:'pending'   },
        { id:'u2wo3', preview:'Near → Far',     status:'pending'   },
      ]},
      { typeId:'mcqs', mainQ:'Choose the correct answer.', items:[
        { id:'u2m1', preview:'What do we use to write on a board? → Chalk', status:'submitted' },
        { id:'u2m2', preview:'Who teaches us at school? → Teacher',          status:'pending'   },
        { id:'u2m3', preview:'Where do we read books? → Library',            status:'pending'   },
      ]},
      { typeId:'short_questions', mainQ:'Answer the following short questions.', items:[
        { id:'u2sq1', preview:'What is a school?',          status:'submitted' },
        { id:'u2sq2', preview:'Why do we go to school?',    status:'pending'   },
      ]},
    ],
  },
  {
    unitId: 'u3', unitNo: '3', unitName: 'Animals Around Us', class: 'Class VI', subject: 'English', teacher: 'Ms. Fatima Noor',
    questionTypes: [
      { typeId:'singular_plural', mainQ:'Write the plural of each word.', items:[
        { id:'u3sp1', preview:'Animal → Animals', status:'submitted' },
        { id:'u3sp2', preview:'Fish → Fish',      status:'submitted' },
        { id:'u3sp3', preview:'Sheep → Sheep',    status:'pending'   },
      ]},
      { typeId:'true_false', mainQ:'Write True or False.', items:[
        { id:'u3t1', preview:'A cow is a domestic animal. → True', status:'submitted' },
        { id:'u3t2', preview:'A lion is a wild animal. → True',    status:'pending'   },
        { id:'u3t3', preview:'Birds cannot fly. → False',          status:'pending'   },
      ]},
      { typeId:'long_question', mainQ:'Answer the following long questions.', items:[
        { id:'u3l1', preview:'Write about animals that live in water.', status:'pending' },
        { id:'u3l2', preview:'Why are animals important to humans?',    status:'pending' },
      ]},
    ],
  },
];

/* One notebook plan unit per extra class/subject assignment (same 15
   from EXTRA_CLASS_SUBJECT_TEACHER above), each with one question type
   and 3 items (2 submitted, 1 pending — deterministic). Keeps the
   Notebook Plans numbers meaningful at the same ~20-class scale as the
   lesson plan records above, instead of only existing for the 3
   original hand-written units. */
let _extraNbUnitNo = 3;
EXTRA_CLASS_SUBJECT_TEACHER.forEach((a, i) => {
  _extraNbUnitNo += 1;
  mockSubNbData.push({
    unitId: `eu${i + 1}`, unitNo: String(_extraNbUnitNo), unitName: `${a.subject} Notebook Unit ${_extraNbUnitNo}`,
    class: a.class, subject: a.subject, teacher: a.teacher,
    questionTypes: [
      { typeId: 'general', mainQ: `${a.subject} practice questions.`, items: [
        { id: `eu${i + 1}q1`, preview: `${a.subject} Question 1`, status: 'submitted' },
        { id: `eu${i + 1}q2`, preview: `${a.subject} Question 2`, status: 'submitted' },
        { id: `eu${i + 1}q3`, preview: `${a.subject} Question 3`, status: 'pending'   },
      ]},
    ],
  });
});

/* ─── Nursery Teacher Submissions — generated straight from
   mockUnitsCatalog ───
   Requirement: Teacher Submissions must show the SAME class/subject/unit
   structure as Units Management, Lesson Plans and Question Bank. Rather
   than hand-typing a second, possibly-drifting copy of Nursery's 4×12
   units, these records are built directly from the Nursery entries
   already in mockUnitsCatalog above — one lesson-plan submission row
   per lesson, and one Question Bank entry per unit (its MCQs + Short
   Questions sets) — so renaming a Nursery unit in Units Management
   automatically renames it here too. */
const NURSERY_TEACHER_BY_SUBJECT = {
  English: 'Ms. Sana Tariq', Urdu: 'Ms. Sana Tariq',
  Numeracy: 'Ms. Hira Malik', Rhymes: 'Ms. Hira Malik',
};
const nurseryUnits = mockUnitsCatalog.filter(u => u.class === 'Nursery');
let _nurseryLpId = mockSubLpData.length + 1000;
nurseryUnits.forEach(u => {
  const teacher = NURSERY_TEACHER_BY_SUBJECT[u.subject] || 'Ms. Sana Tariq';
  u.lessons.forEach((lesson, li) => {
    const submitted = (Number(u.unitNo) + li) % 3 !== 0; // deterministic ~2/3 submitted
    mockSubLpData.push({
      id: _nurseryLpId++,
      catalogUnitId: u.id, // stable link back to mockUnitsCatalog — lets Submissions re-resolve the live unit name/number after a reorder, instead of trusting this snapshot
      unitNo: u.unitNo,
      unit: `Unit ${u.unitNo} — ${u.unitName}`,
      topic: lesson.topic,
      date: 'Apr 10, 2026', term: '1st Term',
      status: submitted ? 'submitted' : 'pending',
      submittedDate: submitted ? 'Apr 14, 2026' : '',
      class: u.class, section: u.section, subject: u.subject, teacher,
    });
  });
  const itemsFor = typeId => u.questions[typeId].rows.map((row, ri) => ({
    id: `nu${u.id}-${typeId}-${ri}`,
    preview: row.question || `${u.unitName} question ${ri + 1}`,
    status: ri < 2 ? 'submitted' : 'pending',
  }));
  mockSubNbData.push({
    unitId: `nu${u.id}`, catalogUnitId: u.id, unitNo: u.unitNo, unitName: u.unitName,
    class: u.class, section: u.section, subject: u.subject, teacher,
    questionTypes: [
      { typeId: 'mcqs',            mainQ: u.questions.mcqs.mainQ,            items: itemsFor('mcqs') },
      { typeId: 'short_questions', mainQ: u.questions.short_questions.mainQ, items: itemsFor('short_questions') },
    ],
  });
});

/* ─── Term Breakups — persisted allocations ───
   Previously TermBreakupModal never persisted anything (every open
   reset to one blank row — see the header comment above
   mockTermBreakups). Now that Term Breakups needs its own per-
   class/section/term/subject configuration AND a Copy Configuration
   feature, there has to be something real to save to and copy from.
   Each row links a unit (by its mockUnitsCatalog id — never a copy of
   the unit's own name/number, so a later rename/reorder in Units
   Management is picked up automatically) to a weeks/topics allocation
   for one class+section+term+subject. Seeded with a worked Nursery ·
   Section A · English example so the Copy Configuration flow has real
   data to copy out of the box. */
export const mockTermBreakupAllocations = [
  { id: 1, class: 'Nursery', section: 'A', term: '2nd', subject: 'English', unitId: 1,
    weeksRequired: '2', topics: [{ id: 1, subTopic: 'Naming family members', periodsRequired: '4' }] },
  { id: 2, class: 'Nursery', section: 'A', term: '2nd', subject: 'English', unitId: 2,
    weeksRequired: '2', topics: [{ id: 2, subTopic: 'Things in the classroom', periodsRequired: '3' }] },
  { id: 3, class: 'Nursery', section: 'A', term: '2nd', subject: 'English', unitId: 3,
    weeksRequired: '2', topics: [{ id: 3, subTopic: 'Naming body parts', periodsRequired: '3' }] },
];
