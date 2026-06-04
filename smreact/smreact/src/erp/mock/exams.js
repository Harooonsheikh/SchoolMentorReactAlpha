export const mockExams = [
  { id: 1,  name: 'Final Term',        classes: ['Grade 1 - Section A', 'Grade 2 - Section A', 'Grade 3 - Section A', 'Grade 4 - Section A', 'Grade 5 - Section A'], from: '15/04/2026', to: '17/04/2026', term: '2nd' },
  { id: 2,  name: 'Marketing Exam',    classes: ['Marketing Class (A)', 'class 1A (B)', 'class 1A (C)'], from: '20/04/2026', to: '25/04/2026', term: '2nd' },
  { id: 3,  name: 'Mid Term',          classes: ['Grade 1 - Section A', 'Grade 2 - Section A', 'Grade 3 - Section A', 'Grade 4 - Section A', 'Grade 5 - Section A'], from: '01/05/2026', to: '05/05/2026', term: '2nd' },
  { id: 4,  name: 'Monthly Test',      classes: ['Grade 1 - Section A', 'Grade 2 - Section A', 'Grade 3 - Section A', 'Grade 4 - Section A', 'Grade 5 - Section A'], from: '10/05/2026', to: '15/05/2026', term: '2nd' },
  { id: 5,  name: 'Weekly Quiz',       classes: ['Grade 1 - Section A', 'Grade 2 - Section A', 'Grade 3 - Section A', 'Grade 4 - Section A', 'Grade 5 - Section A'], from: '01/06/2026', to: '10/06/2026', term: '3rd Term' },
  { id: 6,  name: 'Assignment',        classes: ['Grade 1 - Section A', 'Grade 2 - Section A', 'Grade 3 - Section A', 'Grade 4 - Section A', 'Grade 5 - Section A'], from: '05/06/2026', to: '12/06/2026', term: '3rd Term' },
  { id: 7,  name: 'Annual Exam 2026',  classes: ['Grade 1 - Section A', 'Grade 2 - Section A', 'Grade 3 - Section A', 'Grade 4 - Section A', 'Grade 5 - Section A', 'Class 1', 'Class 2', 'Class 3'], from: '15/06/2026', to: '20/06/2026', term: '5th Term' },
  { id: 8,  name: 'checking',          classes: ['Marketing Class (A)'], from: '01/07/2026', to: '07/07/2026', term: 'combined' },
  { id: 9,  name: '1st term',          classes: ['II-Pre (A)', 'III-Pre (2)'], from: '01/06/2026', to: '30/06/2026', term: '2nd' },
  { id: 10, name: 'Anees Test',        classes: ['Marketing Class (A)', 'class 1A (B)'], from: '10/03/2026', to: '10/03/2026', term: '2nd' },
  { id: 11, name: 'Multiple classes',  classes: ['class 1A (B)', 'class 1A (C)', 'class 1A (D)'], from: '20/03/2026', to: '22/03/2026', term: '2nd' },
];

export const mockClasses = [
  'Pre Nursery', 'Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3',
  'Class 4', 'Class 5', 'Grade 1 - Section A', 'Grade 2 - Section A',
  'Grade 3 - Section A', 'Grade 4 - Section A', 'Grade 5 - Section A',
  'Marketing Class (A)', 'class 1A (B)', 'class 1A (C)', 'class 1A (D)',
  'II-Pre (A)', 'III-Pre (2)',
];

export const mockSubjects = [
  'English', 'Urdu', 'Mathematics', 'Science', 'Islamiyat',
  'Social Studies', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'Pak Studies', 'Arabic', 'History', 'Geography', 'Art & Drawing',
];

export const mockSyllabus = {
  1: {
    scls_1_0: [
      { subject: 'English',     content: '<b>Unit 1:</b> Grammar &amp; Comprehension<br><b>Unit 2:</b> Essay Writing<br><b>Unit 3:</b> Poetry', updatedAt: '15/04/2026' },
      { subject: 'Urdu',        content: '<b>سبق 1:</b> نثر<br><b>سبق 2:</b> نظم<br><b>سبق 3:</b> خط نویسی',                                    updatedAt: '15/04/2026' },
      { subject: 'Mathematics', content: '<b>Chapter 1:</b> Number System<br><b>Chapter 2:</b> Algebra',                                          updatedAt: '16/04/2026' },
      { subject: 'Science',     content: '',                                                                                                       updatedAt: '—' },
      { subject: 'Islamiyat',   content: '',                                                                                                       updatedAt: '—' },
    ],
    scls_1_1: [
      { subject: 'English',     content: '<b>Unit 1:</b> Reading Skills<br><b>Unit 2:</b> Grammar<br><b>Unit 3:</b> Creative Writing<br><b>Unit 4:</b> Literature', updatedAt: '15/04/2026' },
      { subject: 'Urdu',        content: '<b>سبق 1:</b> نثر اور نظم<br><b>سبق 2:</b> خط نویسی<br><b>سبق 3:</b> درخواست نویسی',                                     updatedAt: '15/04/2026' },
      { subject: 'Mathematics', content: '<b>Chapter 1:</b> Algebra<br><b>Chapter 2:</b> Geometry<br><b>Chapter 3:</b> Statistics<br><b>Chapter 4:</b> Probability', updatedAt: '16/04/2026' },
      { subject: 'Science',     content: '<b>Chapter 1:</b> Matter &amp; Energy<br><b>Chapter 2:</b> Living Things<br><b>Chapter 3:</b> Earth &amp; Space',          updatedAt: '17/04/2026' },
      { subject: 'Islamiyat',   content: '<b>Lesson 1:</b> Quran Translation<br><b>Lesson 2:</b> Hadith<br><b>Lesson 3:</b> Islamic History',                       updatedAt: '14/04/2026' },
    ],
  },
};

export const mockDateSheets = {
  1: {
    cls_1_0: [
      { subject: 'English',     date: '2026-04-15', timeFrom: '08:00 AM', timeTo: '09:00 AM' },
      { subject: 'Urdu',        date: '2026-04-16', timeFrom: '09:00 AM', timeTo: '10:00 AM' },
      { subject: 'Mathematics', date: '2026-04-17', timeFrom: '08:00 AM', timeTo: '09:30 AM' },
      { subject: 'Science',     date: '2026-04-18', timeFrom: '10:00 AM', timeTo: '11:00 AM' },
      { subject: 'Islamiyat',   date: '2026-04-19', timeFrom: '11:00 AM', timeTo: '12:00 PM' },
    ],
    cls_1_1: [
      { subject: 'English',     date: '2026-04-15', timeFrom: '08:00 AM', timeTo: '09:00 AM' },
      { subject: 'Urdu',        date: '2026-04-16', timeFrom: '09:00 AM', timeTo: '10:00 AM' },
      { subject: 'Mathematics', date: '2026-04-17', timeFrom: '08:00 AM', timeTo: '09:30 AM' },
      { subject: 'Science',     date: '2026-04-18', timeFrom: '10:00 AM', timeTo: '11:00 AM' },
      { subject: 'Islamiyat',   date: '2026-04-19', timeFrom: '11:00 AM', timeTo: '12:00 PM' },
    ],
  },
};

export const mockRsGrades = [
  { id: 1, grade: 'A+', cond: 'gte', pct: '90', comment: 'Outstanding performance' },
  { id: 2, grade: 'A',  cond: 'gte', pct: '80', comment: 'Very Good Work Done' },
  { id: 3, grade: 'B',  cond: 'gte', pct: '70', comment: 'Good Work Done' },
  { id: 4, grade: 'C',  cond: 'gte', pct: '60', comment: 'Satisfactory Work Done' },
  { id: 5, grade: 'D',  cond: 'gte', pct: '50', comment: 'Needs Improvement' },
  { id: 6, grade: 'F',  cond: 'lt',  pct: '50', comment: 'Unsatisfactory' },
];

export const mockRsSigs = [
  { id: 1, name: 'Dr. Islahudin', desig: 'Managing Director', img: '' },
  { id: 2, name: 'Nouman Afzal',  desig: 'CEO',               img: '' },
  { id: 3, name: 'Athar Bashir',  desig: 'Chairman',          img: '' },
];

export const mockRsRemarks = [
  { id: 1, cond: 'gte', pct: '90', text: 'Outstanding performance. Demonstrates excellent understanding, consistency, and academic excellence. Keep up the exceptional work.' },
  { id: 2, cond: 'gte', pct: '80', text: 'Very Good Work Done. Keep Working Hard to Maintain Your Position. All the best for your future endeavors.' },
  { id: 3, cond: 'gte', pct: '70', text: 'Good performance. Concepts are mostly clear with steady effort. Continued practice will lead to further improvement.' },
  { id: 4, cond: 'gte', pct: '60', text: 'Satisfactory progress. Basic understanding is evident. Needs more consistency and focused effort to improve.' },
  { id: 5, cond: 'gte', pct: '50', text: 'Needs improvement. Minimum requirements met, but greater attention, practice, and revision are required.' },
  { id: 6, cond: 'lt',  pct: '50', text: 'Below satisfactory level. Requires serious effort, regular practice, and academic support to meet learning standards.' },
];

export const mockRcoGeneral = [
  { label: 'Show School Logo',         icon: 'fa-school',         on: true  },
  { label: 'Show School Name',         icon: 'fa-heading',        on: true  },
  { label: 'Show Student Photo',       icon: 'fa-user',           on: true  },
  { label: 'Show Student Roll Number', icon: 'fa-hashtag',        on: true  },
  { label: 'Show Class and Section',   icon: 'fa-chalkboard',     on: true  },
  { label: 'Show Subject-wise Marks',  icon: 'fa-book',           on: true  },
  { label: 'Show Total Marks',         icon: 'fa-calculator',     on: true  },
  { label: 'Show Obtained Marks',      icon: 'fa-circle-check',   on: true  },
  { label: 'Show Percentage',          icon: 'fa-percent',        on: true  },
  { label: 'Show Grade',               icon: 'fa-star',           on: true  },
  { label: 'Show Position in Class',   icon: 'fa-trophy',         on: true  },
  { label: 'Show Attendance',          icon: 'fa-calendar-check', on: true  },
];

export const mockRcoSig = [
  { label: 'Show Principal Signature', icon: 'fa-pen-nib',     on: true  },
  { label: 'Show Parent Signature',    icon: 'fa-handshake',   on: false },
  { label: 'Show Final Remarks',       icon: 'fa-comment-dots', on: true },
];

/* Combined Assessment Results — pre-computed scaffold.
   The helpers below mirror the in-component grade-derivation logic
   (RC_GRADE_SETUP + cbrMakeStudents). They live here so the mock is
   self-contained and the component is free of seed-data plumbing. */
const _CBR_GRADE_SETUP = [
  { min: 90, grade: 'A+' }, { min: 80, grade: 'A' }, { min: 70, grade: 'B' },
  { min: 60, grade: 'C'  }, { min: 50, grade: 'D' }, { min:  0, grade: 'F' },
];
const _CBR_GRADE = pct => (_CBR_GRADE_SETUP.find(g => pct >= g.min) || _CBR_GRADE_SETUP[_CBR_GRADE_SETUP.length - 1]).grade;

const _CBR_BASE_STUDENTS = [
  { name: 'Ahmed Raza',   father: 'Muhammad Raza',  rollSfx: '1001' },
  { name: 'Sara Hussain', father: 'Ghulam Hussain', rollSfx: '1002' },
  { name: 'Usman Tariq',  father: 'Tariq Mehmood',  rollSfx: '1003' },
  { name: 'Fatima Noor',  father: 'Noor Ahmad',     rollSfx: '1004' },
  { name: 'Bilal Sheikh', father: 'Khalid Sheikh',  rollSfx: '1005' },
];

function _cbrMakeStudents(prefix, mainScores, subPlan) {
  const built = _CBR_BASE_STUDENTS.map((b, i) => {
    const mainObt = mainScores[i] ?? 150;
    const mainTotal = 200;
    const subs = subPlan.map(sp => {
      const subObt = sp.scores[i] ?? Math.round(sp.origT * 0.7);
      const conv = Math.round((subObt / sp.origT) * sp.weight * 100) / 100;
      return { name: sp.name, origT: sp.origT, subObt, weight: sp.weight, conv };
    });
    const grandTotal = mainTotal + subs.reduce((a, s) => a + s.weight, 0);
    const grandObt   = Math.round((mainObt + subs.reduce((a, s) => a + s.conv, 0)) * 100) / 100;
    const pct        = Math.round((grandObt / grandTotal) * 10000) / 100;
    return {
      name: b.name, father: b.father,
      rollNo: `${prefix}${b.rollSfx.slice(-3)}-2026`,
      mainObt, mainTotal, subs, grandTotal, grandObt, pct,
    };
  });
  const ranked = [...built].sort((a, b) => b.grandObt - a.grandObt);
  return built.map(s => {
    const rankIdx = ranked.findIndex(x => x.rollNo === s.rollNo) + 1;
    const sfx = rankIdx === 1 ? 'st' : rankIdx === 2 ? 'nd' : rankIdx === 3 ? 'rd' : 'th';
    return { ...s, rank: `${rankIdx}${sfx}`, grade: _CBR_GRADE(s.pct) };
  });
}

export const mockCbrResults = [
  // Group A: Mid + Final Combined  (mainExam=Final Term, subs=Mid Term + Monthly Test)
  { id: 'cbr_a_1', name: 'Mid + Final Combined — Grade 1 - Section A', mainExam: 'Final Term', subExams: ['Mid Term', 'Monthly Test'],
    cls: 'Grade 1 - Section A', section: 'A', created: '16/05/2026', published: true,  weights: { 3: 20, 4: 15 },
    students: _cbrMakeStudents('1', [116, 140, 140, 177, 176], [
      { name: 'Mid Term',     origT: 100, weight: 20, scores: [49, 87, 62, 64, 60] },
      { name: 'Monthly Test', origT: 100, weight: 15, scores: [87, 51, 86, 64, 86] },
    ]),
  },
  { id: 'cbr_a_2', name: 'Mid + Final Combined — Grade 2 - Section A', mainExam: 'Final Term', subExams: ['Mid Term', 'Monthly Test'],
    cls: 'Grade 2 - Section A', section: 'A', created: '16/05/2026', published: false, weights: { 3: 20, 4: 15 },
    students: _cbrMakeStudents('2', [171, 124, 144, 186, 118], [
      { name: 'Mid Term',     origT: 100, weight: 20, scores: [89, 56, 85, 93, 54] },
      { name: 'Monthly Test', origT: 100, weight: 15, scores: [80, 42, 40, 54, 45] },
    ]),
  },
  { id: 'cbr_a_3', name: 'Mid + Final Combined — Grade 3 - Section A', mainExam: 'Final Term', subExams: ['Mid Term', 'Monthly Test'],
    cls: 'Grade 3 - Section A', section: 'A', created: '15/05/2026', published: true,  weights: { 3: 20, 4: 15 },
    students: _cbrMakeStudents('3', [184, 131, 157, 103, 148], [
      { name: 'Mid Term',     origT: 100, weight: 20, scores: [87, 88, 59, 92, 63] },
      { name: 'Monthly Test', origT: 100, weight: 15, scores: [67, 53, 61, 66, 79] },
    ]),
  },
  // Group B: Term Performance Evaluation (mainExam=Mid Term, subs=Monthly Test + Weekly Quiz)
  { id: 'cbr_b_1', name: 'Term Performance Evaluation — Grade 1 - Section A', mainExam: 'Mid Term', subExams: ['Monthly Test', 'Weekly Quiz'],
    cls: 'Grade 1 - Section A', section: 'A', created: '14/05/2026', published: false, weights: { 4: 15, 5: 10 },
    students: _cbrMakeStudents('1', [156, 182, 130, 148, 118], [
      { name: 'Monthly Test', origT: 100, weight: 15, scores: [72, 88, 60, 76, 52] },
      { name: 'Weekly Quiz',  origT:  50, weight: 10, scores: [38, 44, 30, 40, 26] },
    ]),
  },
  { id: 'cbr_b_2', name: 'Term Performance Evaluation — Grade 2 - Section A', mainExam: 'Mid Term', subExams: ['Monthly Test', 'Weekly Quiz'],
    cls: 'Grade 2 - Section A', section: 'A', created: '14/05/2026', published: false, weights: { 4: 15, 5: 10 },
    students: _cbrMakeStudents('2', [160, 142, 128, 138, 110], [
      { name: 'Monthly Test', origT: 100, weight: 15, scores: [80, 70, 58, 65, 48] },
      { name: 'Weekly Quiz',  origT:  50, weight: 10, scores: [42, 36, 28, 33, 22] },
    ]),
  },
];

/* Initial scaffold for the Single Assessment result screen.
   Keyed as { [examId]: { [classKey]: { released, totalMarks, students } } }. */
export const mockResultData = {
  1: {
    rcls_1_0: {
      released: false,
      totalMarks: {
        English: 20, Urdu: 20, Mathematics: 20, Science: 20, Islamiyat: 20,
        Computer: 20, 'Social Studies': 20, Quran: 20, 'Art & Craft': 20, 'Physical Education': 20,
      },
      students: [
        { id: 1, rollNo: '245-00072', name: 'Ali Khan',      father: 'Ahmed Khan',
          obtained: { English: 18, Urdu: 16, Mathematics: 20, Science: 17, Islamiyat: 14, Computer: 0, 'Social Studies': 0, Quran: 16, 'Art & Craft': 18, 'Physical Education': 19 },
          absentSubjects: ['Computer', 'Social Studies'], attendance: '92%' },
        { id: 2, rollNo: '245-00073', name: 'Haroon Sheikh', father: 'Abdul Rauf',
          obtained: { English: 15, Urdu: 12, Mathematics: 18, Science: 14, Islamiyat: 13 },
          absentSubjects: [], attendance: '88%' },
        { id: 3, rollNo: '245-00074', name: 'Amna Malik',    father: 'Tariq Malik',
          obtained: {}, absentSubjects: [], attendance: '95%' },
        { id: 4, rollNo: '245-00075', name: 'Zara Ahmed',    father: 'Imran Ahmed',
          obtained: {}, absentSubjects: [], attendance: '90%' },
        { id: 5, rollNo: '245-00076', name: 'Bilal Hussain', father: 'Riaz Hussain',
          obtained: {}, absentSubjects: [], attendance: '91%' },
      ],
    },
  },
};
