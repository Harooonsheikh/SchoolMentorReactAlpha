/* Lesson Plans seed data — sourced from earlier inline INITIAL_* in
   LessonPlans.js. The academicsService re-exposes these via getUnits,
   getNbUnits, getSubLpData, etc. Backend team can swap in real API
   responses without touching the UI. */

export const mockTermBreakupClasses = [
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII',
];

export const mockUnits = [
  {
    id: 0, unitNo: '0', unitName: '',
    lessons: [
      { id: 0, num: '0', topic: '',   source: '',     content: '' },
    ],
  },
];

/* helper used by mockNbUnits below */
const _nbq = (id, typeId, type, mainQ, rows) => ({
  id, typeId, type,
  mainQ, mainQuestion: mainQ,
  rows, items: rows,
  source: 'manual',
});

export const mockNbUnits = [
  {
    id: 0, unitNo: '0', unitName: '',
    questions: [
      _nbq(101, 'word_opposite', 'Word / Opposite', 'Write the opposite of each word', [
      ]),
      _nbq(102, 'singular_plural', 'Singular / Plural', 'Write the plural form of each word', [
      ]),
      _nbq(103, 'word_synonyms', 'Word / Synonyms', 'Write a synonym for each word', [
      ]),
      _nbq(104, 'word_sentences', 'Word Sentences', 'Use each word in a sentence', [
      ]),
      _nbq(105, 'mcqs', 'MCQs Field', 'Choose the correct option', [
      ]),
      _nbq(106, 'fill_blanks', 'Fill in the Blanks', 'Fill in the blanks with the correct word', [
      ]),
      _nbq(107, 'true_false', 'True / False', 'Mark each statement True or False', [
    ]),
      _nbq(108, 'match_columns', 'Match the Columns', 'Match Column A with Column B', [
     ]),
      _nbq(109, 'short_questions', 'Short Questions', 'Answer the following short questions', [
     ]),
      _nbq(110, 'circle_words', 'Circle the Correct Words', 'Circle the correct word in each sentence', [
       ]),
      _nbq(111, 'punctuation', 'Punctuation', 'Add proper punctuation to each sentence', [
      ]),
      _nbq(112, 'long_question', 'Long Question', 'Answer the following long questions in detail', [
      ]),
      _nbq(113, 'paragraph', 'Paragraph Writing', 'Write a short paragraph on each topic', [
      ]),
      _nbq(114, 'comprehension', 'Comprehension Question', "Read the passage about Fizza's family and answer the questions", [
       ]),
      _nbq(115, 'letter', 'Letter', 'Write a letter on each topic', [
      ]),
      _nbq(116, 'application', 'Application', 'Write an application on each topic', [
      ]),
      _nbq(117, 'stories', 'Stories', 'Write short stories on each theme', [
    ]),
      _nbq(118, 'essays', 'Essays', 'Write essays on each topic', [
      ]),
    ],
  },
];

export const mockSubLpData = [
  { id:1,  unitNo:'1', unit:'Unit 1 — Living Things',        topic:'Introduction to Plants',    date:'Jan 5, 2026',  term:'2nd',     status:'submitted', submittedDate:'Jan 10, 2026' },
  { id:2,  unitNo:'1', unit:'Unit 1 — Living Things',        topic:'Parts of a Plant',          date:'Jan 8, 2026',  term:'2nd',     status:'submitted', submittedDate:'Jan 12, 2026' },
  { id:3,  unitNo:'1', unit:'Unit 1 — Living Things',        topic:'Photosynthesis',            date:'Jan 10, 2026', term:'2nd',     status:'submitted', submittedDate:'Jan 15, 2026' },
  { id:4,  unitNo:'2', unit:'Unit 2 — Human Body',           topic:'The Skeletal System',       date:'Jan 15, 2026', term:'2nd',     status:'submitted', submittedDate:'Jan 20, 2026' },
  { id:5,  unitNo:'2', unit:'Unit 2 — Human Body',           topic:'The Digestive System',      date:'Jan 18, 2026', term:'2nd',     status:'submitted', submittedDate:'Jan 24, 2026' },
  { id:6,  unitNo:'2', unit:'Unit 2 — Human Body',           topic:'The Respiratory System',    date:'Jan 20, 2026', term:'2nd',     status:'submitted', submittedDate:'Jan 28, 2026' },
  { id:7,  unitNo:'3', unit:'Unit 3 — Earth & Space',        topic:'Layers of the Earth',       date:'Feb 2, 2026',  term:'2nd',     status:'submitted', submittedDate:'Feb 8, 2026' },
  { id:8,  unitNo:'3', unit:'Unit 3 — Earth & Space',        topic:'Volcanoes and Earthquakes', date:'Feb 5, 2026',  term:'2nd',     status:'submitted', submittedDate:'Feb 10, 2026' },
  { id:9,  unitNo:'3', unit:'Unit 3 — Earth & Space',        topic:'The Solar System',          date:'Feb 8, 2026',  term:'2nd',     status:'pending',   submittedDate:'' },
  { id:10, unitNo:'3', unit:'Unit 3 — Earth & Space',        topic:'Stars and Galaxies',        date:'Feb 10, 2026', term:'2nd',     status:'pending',   submittedDate:'' },
  { id:11, unitNo:'4', unit:'Unit 4 — Forces & Motion',      topic:'Types of Forces',           date:'Mar 2, 2026',  term:'3rd Term',status:'pending',   submittedDate:'' },
  { id:12, unitNo:'4', unit:'Unit 4 — Forces & Motion',      topic:"Newton's Laws",             date:'Mar 5, 2026',  term:'3rd Term',status:'pending',   submittedDate:'' },
  { id:13, unitNo:'4', unit:'Unit 4 — Forces & Motion',      topic:'Friction and Gravity',      date:'Mar 8, 2026',  term:'3rd Term',status:'pending',   submittedDate:'' },
  { id:14, unitNo:'5', unit:'Unit 5 — Energy',               topic:'Forms of Energy',           date:'Mar 15, 2026', term:'3rd Term',status:'pending',   submittedDate:'' },
  { id:15, unitNo:'5', unit:'Unit 5 — Energy',               topic:'Conservation of Energy',    date:'Mar 18, 2026', term:'3rd Term',status:'pending',   submittedDate:'' },
];

export const mockSubNbData = [
  {
    unitId: 'u1', unitNo: '1', unitName: "Fizza's Family",
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
];
