/* ═══════════════════════════════════════════════════════════════════
   PRESCHOOL / MONTESSORI RESULT MANAGEMENT — mock data.

   Completely independent of src/mock/exams.js (mockClasses, mockExams,
   mockResultData, RES_SUBJECTS, etc. are never read or written here) —
   the existing Grade 1-12 result system must stay untouched. Read ONLY
   by src/services/preschoolService.js (same "never import mock/*.js
   directly from a UI component" convention used across this project).

   Single Assessment Result has ONE entry point (Term → Exam → class
   list) shared by both systems: each class row carries a small toggle
   deciding whether that row is Grade 1-12 or Preschool/Montessori.
   Because the Grade row key already namespaces by exam
   (`rcls_${examId}_${i}`, see mock/exams.js), every store below is
   keyed directly by that SAME key — no separate Preschool class/exam
   concept is needed, and there is nothing to keep in sync.

   Every mutable object below follows the same "the exported binding IS
   the database" convention already used throughout this app's mock
   layer (e.g. mockRsGrades, mockFeeDiscounts) — a real backend later
   means swapping preschoolService.js's function bodies only.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── 1. Learning Areas / Subjects ───────────────────────────────── */
export const mockLearningAreas = [
  { id: 'la_1',  name: 'English (Phonics & Language)',       icon: 'fa-book-open' },
  { id: 'la_2',  name: 'Urdu',                                icon: 'fa-language' },
  { id: 'la_3',  name: 'Mathematics / Early Numeracy',        icon: 'fa-calculator' },
  { id: 'la_4',  name: 'Islamiyat / Ethics',                  icon: 'fa-mosque' },
  { id: 'la_5',  name: 'General Knowledge',                   icon: 'fa-globe' },
  { id: 'la_6',  name: 'The World Around Us',                 icon: 'fa-tree' },
  { id: 'la_7',  name: 'Montessori Activities',                icon: 'fa-puzzle-piece' },
  { id: 'la_8',  name: 'Art, Craft & Creative Expression',    icon: 'fa-palette' },
  { id: 'la_9',  name: 'Physical Development',                icon: 'fa-person-running' },
  { id: 'la_10', name: 'Personal & Social Development',       icon: 'fa-people-arrows' },
];

/* ─── 2. Assessment Criteria — default 4-band achievement scale,
   school-customizable (label/color/percentage range; 4 codes stay fixed
   since the whole entry/report pipeline is built around exactly
   E/M/A/NY). The range is shown wherever a grade is explained so users
   always know what each level means. ──────────────────────────────── */
export const mockGradingScale = [
  { code: 'E',  label: 'Exceeding Expectations',      color: '#16A34A', range: '90% - 100%' },
  { code: 'M',  label: 'Meeting Expectations',         color: '#1E40AF', range: '75% - 89%' },
  { code: 'A',  label: 'Approaching Expectations',     color: '#D97706', range: '50% - 74%' },
  { code: 'NY', label: 'Not Yet Meeting Expectations', color: '#DC2626', range: 'Below 50%' },
];

/* ─── 3a. Preschool class levels — SLO / Activity-Based Assessment
   statements are set per level (a Play Group child and a KG child are
   assessed against different statements even within the same Learning
   Area), not one global list for every Preschool class. Admin picks
   the level to edit in Result Setup; a class row picks which level's
   statements it uses when toggled to Preschool in Single Assessment
   Result (see mockClassPreschoolLevel below). ──────────────────────── */
export const mockPreschoolLevels = [
  { id: 'pg',  name: 'Play Group / Pre 1' },
  { id: 'nur', name: 'Nursery / Pre 2' },
  { id: 'kg',  name: 'KG / Pre 3' },
];

/* ─── 3b. SLO / Activity-Based Assessment statements — keyed
   { [levelId]: { [learningAreaId]: [{ id, text }] } }. Statement ids
   are globally unique across levels (slo_pg_.., slo_nur_.., slo_..) so
   an already-saved achievement record always resolves to the exact
   statement it was rated against, even if admin edits wording later. ── */
export const mockSloStatements = {
  pg: {
    la_1:  [{ id: 'slo_pg_1_1',  text: 'Enjoys listening to rhymes and stories' }, { id: 'slo_pg_1_2', text: 'Points to familiar pictures when named' }],
    la_2:  [{ id: 'slo_pg_2_1',  text: 'Repeats simple Urdu words' }],
    la_3:  [{ id: 'slo_pg_3_1',  text: 'Sorts objects by colour' }, { id: 'slo_pg_3_2', text: 'Recognises big vs small' }],
    la_4:  [{ id: 'slo_pg_4_1',  text: 'Says Bismillah before eating' }],
    la_5:  [{ id: 'slo_pg_5_1',  text: 'Names immediate family members' }],
    la_6:  [{ id: 'slo_pg_6_1',  text: 'Identifies familiar animals by picture' }],
    la_7:  [{ id: 'slo_pg_7_1',  text: 'Explores practical life materials with guidance' }],
    la_8:  [{ id: 'slo_pg_8_1',  text: 'Scribbles freely with crayons' }],
    la_9:  [{ id: 'slo_pg_9_1',  text: 'Walks and runs with balance' }],
    la_10: [{ id: 'slo_pg_10_1', text: 'Separates from parent without distress' }],
  },
  nur: {
    la_1:  [{ id: 'slo_nur_1_1',  text: 'Recognises a few letter sounds' }, { id: 'slo_nur_1_2', text: 'Speaks in short phrases' }],
    la_2:  [{ id: 'slo_nur_2_1',  text: 'Recognises a few Urdu alphabets' }, { id: 'slo_nur_2_2', text: 'Repeats simple Urdu rhymes' }],
    la_3:  [{ id: 'slo_nur_3_1',  text: 'Counts objects up to 10' }, { id: 'slo_nur_3_2', text: 'Identifies basic shapes' }],
    la_4:  [{ id: 'slo_nur_4_1',  text: 'Recites short Duas with guidance' }],
    la_5:  [{ id: 'slo_nur_5_1',  text: 'Names common community helpers' }],
    la_6:  [{ id: 'slo_nur_6_1',  text: 'Talks about the weather' }],
    la_7:  [{ id: 'slo_nur_7_1',  text: 'Uses practical life materials with some independence' }],
    la_8:  [{ id: 'slo_nur_8_1',  text: 'Uses colours to represent simple objects' }],
    la_9:  [{ id: 'slo_nur_9_1',  text: 'Hops and jumps with control' }],
    la_10: [{ id: 'slo_nur_10_1', text: 'Plays alongside other children' }],
  },
  kg: {
    la_1: [
      { id: 'slo_1_1', text: 'Recognises letter sounds' },
      { id: 'slo_1_2', text: 'Speaks simple sentences' },
      { id: 'slo_1_3', text: 'Pre-writing skills (tracing, holding pencil correctly)' },
      { id: 'slo_1_4', text: 'Listens to and understands short stories' },
    ],
    la_2: [
      { id: 'slo_2_1', text: 'Recognises basic Urdu alphabets' },
      { id: 'slo_2_2', text: 'Repeats simple Urdu words and rhymes' },
    ],
    la_3: [
      { id: 'slo_3_1', text: 'Recognises and names numerals 1 to 20' },
      { id: 'slo_3_2', text: 'Counts objects with one-to-one correspondence' },
      { id: 'slo_3_3', text: 'Identifies basic shapes and colours' },
      { id: 'slo_3_4', text: 'Sorts and compares objects' },
    ],
    la_4: [
      { id: 'slo_4_1', text: 'Recites short Surahs and Duas' },
      { id: 'slo_4_2', text: 'Shows awareness of good manners (adab)' },
    ],
    la_5: [
      { id: 'slo_5_1', text: 'Names family members and their roles' },
      { id: 'slo_5_2', text: 'Identifies common community helpers' },
    ],
    la_6: [
      { id: 'slo_6_1', text: 'Identifies common animals, plants and their habitats' },
      { id: 'slo_6_2', text: 'Observes and talks about the weather and seasons' },
    ],
    la_7: [
      { id: 'slo_7_1', text: 'Uses practical life materials independently' },
      { id: 'slo_7_2', text: 'Completes sensorial activities with focus' },
    ],
    la_8: [
      { id: 'slo_8_1', text: 'Uses colours and materials creatively' },
      { id: 'slo_8_2', text: 'Shows interest and participation in craft activities' },
    ],
    la_9: [
      { id: 'slo_9_1', text: 'Demonstrates balance and coordination in movement' },
      { id: 'slo_9_2', text: 'Participates actively in outdoor/physical play' },
    ],
    la_10: [
      { id: 'slo_10_1', text: 'Interacts positively with peers' },
      { id: 'slo_10_2', text: 'Follows classroom routines' },
    ],
  },
};

/* ─── 4. Personal & Social Development — configurable field list ──── */
export const mockPsdFields = [
  { id: 'psd_1',  label: 'Punctuality' },
  { id: 'psd_2',  label: 'Discipline' },
  { id: 'psd_3',  label: 'Classroom Behaviour' },
  { id: 'psd_4',  label: 'Following Instructions' },
  { id: 'psd_5',  label: 'Teamwork' },
  { id: 'psd_6',  label: 'Confidence' },
  { id: 'psd_7',  label: 'Independence' },
  { id: 'psd_8',  label: 'Cleanliness' },
  { id: 'psd_9',  label: 'Self Care' },
  { id: 'psd_10', label: 'Participation' },
];

/* ─── 5. Per-class assessment type — the per-row Single Assessment
   Result toggle. Keyed directly by the SAME class-row key the Grade
   1-12 system already uses (`rcls_${examId}_${i}`, mock/exams.js), so
   a row is namespaced by exam automatically with no extra join. Sparse:
   a key absent (or 'grade') here means that row stays plain Grade 1-12.

   Seeded with 5 rows — Nursery + Pre Nursery across Monthly (Sept/Oct),
   Term and Annual exams (mock/exams.js's exams #12-#15, purely additive
   there too) — Haroon Sheikh (studentId 2) has all four Nursery rows,
   so his Result History shows the full Monthly → Term → Annual arc
   with a downloadable card in each template out of the box. ────────── */
export const mockClassAssessmentType = {
  rcls_12_0: 'preschool', // Nursery      · September Monthly Assessment
  rcls_13_0: 'preschool', // Nursery      · October Monthly Assessment
  rcls_12_1: 'preschool', // Pre Nursery  · September Monthly Assessment
  rcls_14_0: 'preschool', // Nursery      · Term 1 Report
  rcls_15_0: 'preschool', // Nursery      · Annual Report 2026-2027
};

/* ─── 5b. Per-class SLO level — which of mockPreschoolLevels' statement
   sets a row uses, keyed by the same class-row key. Set the moment a
   class row is toggled to Preschool (the small "which class's SLOs?"
   picker in Single Assessment Result), not editable from anywhere else.
   Seed rows all point at 'kg' since the achievement data already seeded
   for them (Haroon Sheikh, Amna Malik) rates against the original
   slo_1_1-style statement ids, which live under the 'kg' level. ────── */
export const mockClassPreschoolLevel = {
  rcls_12_0: 'kg',
  rcls_13_0: 'kg',
  rcls_12_1: 'kg',
  rcls_14_0: 'kg',
  rcls_15_0: 'kg',
};

/* ─── 6. Result data — keyed directly by that same class-row key
   (not by any separate Preschool "assessment"/class id). Student ids
   1/2/3 match RES_SAMPLE_STUDENTS (Ali Khan, Haroon Sheikh, Amna
   Malik) — the same generic roster every class/exam shares. ───────── */
export const mockPreschoolResultData = {
  rcls_12_0: { // Nursery — September
    released: true,
    students: [
      {
        studentId: 1,
        attendance: { mode: 'auto', workingDays: 22, presentDays: 20, pct: 91 },
        achievements: {
          la_1: { slo_1_1: 'M', slo_1_2: 'M', slo_1_3: 'A', slo_1_4: 'M' },
          la_3: { slo_3_1: 'M', slo_3_2: 'A', slo_3_3: 'M', slo_3_4: 'A' },
          la_7: { slo_7_1: 'A', slo_7_2: 'M' },
        },
        psd: { psd_1: 'M', psd_2: 'M', psd_3: 'A', psd_4: 'M', psd_5: 'A', psd_6: 'M', psd_7: 'A', psd_8: 'M', psd_9: 'M', psd_10: 'A' },
        teacherRemarks: 'Ali is settling in well and enjoys group activities, especially numeracy games.',
        finalRemarks: 'Consistently meeting expectations. Continue building on this steady progress.',
        ptm: { enabled: false, date: '', parentAttendance: false, parentComments: '', teacherComments: '' },
        promotion: { status: null, toClass: '' },
      },
      {
        studentId: 2,
        attendance: { mode: 'auto', workingDays: 22, presentDays: 19, pct: 88 },
        achievements: {
          la_1: { slo_1_1: 'M', slo_1_2: 'E', slo_1_3: 'M', slo_1_4: 'E' },
          la_3: { slo_3_1: 'M', slo_3_2: 'M', slo_3_3: 'E', slo_3_4: 'M' },
          la_7: { slo_7_1: 'M', slo_7_2: 'M' },
        },
        psd: { psd_1: 'E', psd_2: 'M', psd_3: 'M', psd_4: 'M', psd_5: 'E', psd_6: 'M', psd_7: 'M', psd_8: 'E', psd_9: 'M', psd_10: 'M' },
        teacherRemarks: 'Haroon is confident and participates actively, particularly in creative activities.',
        finalRemarks: 'Consistently meeting expectations. Continue building on this steady progress.',
        ptm: { enabled: true, date: '2026-09-18', parentAttendance: true, parentComments: 'Glad to see Haroon enjoying school.', teacherComments: 'Encourage quiet reading time at home.' },
        promotion: { status: null, toClass: '' },
      },
    ],
  },
  rcls_13_0: { // Nursery — October
    released: true,
    students: [
      {
        studentId: 1,
        attendance: { mode: 'auto', workingDays: 22, presentDays: 21, pct: 95 },
        achievements: {
          la_1: { slo_1_1: 'E', slo_1_2: 'M', slo_1_3: 'M', slo_1_4: 'E' },
          la_3: { slo_3_1: 'E', slo_3_2: 'M', slo_3_3: 'E', slo_3_4: 'M' },
          la_7: { slo_7_1: 'M', slo_7_2: 'E' },
        },
        psd: { psd_1: 'E', psd_2: 'M', psd_3: 'M', psd_4: 'E', psd_5: 'M', psd_6: 'M', psd_7: 'A', psd_8: 'E', psd_9: 'M', psd_10: 'E' },
        teacherRemarks: 'Ali has shown great improvement in numeracy and is more confident in group settings.',
        finalRemarks: 'Outstanding progress across most learning areas. Keep encouraging this enthusiasm at home.',
        ptm: { enabled: true, date: '2026-10-12', parentAttendance: true, parentComments: 'Happy with the progress, will practice numbers at home too.', teacherComments: 'Continue reinforcing letter sounds through picture books at home.' },
        promotion: { status: 'promoted', toClass: 'KG' },
      },
      {
        studentId: 2,
        attendance: { mode: 'auto', workingDays: 22, presentDays: 17, pct: 77 },
        achievements: {
          la_1: { slo_1_1: 'A', slo_1_2: 'M', slo_1_3: 'A', slo_1_4: 'M' },
          la_3: { slo_3_1: 'A', slo_3_2: 'A', slo_3_3: 'M', slo_3_4: 'A' },
          la_7: { slo_7_1: 'A', slo_7_2: 'M' },
        },
        psd: { psd_1: 'M', psd_2: 'A', psd_3: 'M', psd_4: 'A', psd_5: 'M', psd_6: 'A', psd_7: 'M', psd_8: 'M', psd_9: 'A', psd_10: 'M' },
        teacherRemarks: 'Haroon needs a bit more focus during table activities this month; attendance also dipped.',
        finalRemarks: 'Approaching expectations — with a little more practice, will catch up quickly.',
        ptm: { enabled: true, date: '2026-10-14', parentAttendance: false, parentComments: '', teacherComments: 'Would like to discuss a consistent home routine to help focus.' },
        promotion: { status: 'retained', toClass: '' },
      },
    ],
  },
  rcls_14_0: { // Nursery — Term 1 Report (Haroon recovering after October's dip)
    released: true,
    students: [
      {
        studentId: 2,
        attendance: { mode: 'auto', workingDays: 44, presentDays: 37, pct: 84 },
        achievements: {
          la_1: { slo_1_1: 'M', slo_1_2: 'M', slo_1_3: 'A', slo_1_4: 'M' },
          la_3: { slo_3_1: 'M', slo_3_2: 'M', slo_3_3: 'E', slo_3_4: 'M' },
          la_7: { slo_7_1: 'M', slo_7_2: 'M' },
          la_9: { slo_9_1: 'M', slo_9_2: 'E' },
        },
        psd: { psd_1: 'M', psd_2: 'M', psd_3: 'M', psd_4: 'A', psd_5: 'M', psd_6: 'M', psd_7: 'A', psd_8: 'M', psd_9: 'M', psd_10: 'M' },
        teacherRemarks: 'Haroon has settled back into a steady routine this term — his focus during table activities has improved a lot since October, and he is especially confident with numbers now.',
        finalRemarks: 'Consistently meeting expectations. Continue building on this steady progress.',
        ptm: { enabled: true, date: '2026-12-18', parentAttendance: true, parentComments: 'Relieved to see Haroon back on track, thank you for the extra attention this term.', teacherComments: 'Keep reinforcing focus-building activities at home, like simple puzzles or matching games.' },
        promotion: { status: null, toClass: '' },
      },
    ],
  },
  rcls_15_0: { // Nursery — Annual Report 2026-2027 (Haroon's year-end result)
    released: true,
    students: [
      {
        studentId: 2,
        attendance: { mode: 'auto', workingDays: 180, presentDays: 158, pct: 88 },
        achievements: {
          la_1: { slo_1_1: 'E', slo_1_2: 'E', slo_1_3: 'M', slo_1_4: 'E' },
          la_3: { slo_3_1: 'E', slo_3_2: 'E', slo_3_3: 'E', slo_3_4: 'M' },
          la_7: { slo_7_1: 'E', slo_7_2: 'M' },
          la_9: { slo_9_1: 'E', slo_9_2: 'E' },
        },
        psd: { psd_1: 'E', psd_2: 'M', psd_3: 'E', psd_4: 'M', psd_5: 'E', psd_6: 'E', psd_7: 'M', psd_8: 'E', psd_9: 'M', psd_10: 'E' },
        teacherRemarks: 'Haroon has made remarkable progress since the start of the year. After a challenging October, he has ended the year as one of the most confident numeracy learners in class, with much-improved focus and independence.',
        finalRemarks: 'Outstanding progress across most learning areas. Keep encouraging this enthusiasm at home.',
        ptm: { enabled: true, date: '2027-06-12', parentAttendance: true, parentComments: 'So proud of how far Haroon has come this year — thank you for your patience.', teacherComments: 'He is ready for KG. Keep encouraging independent reading over the summer.' },
        promotion: { status: 'promoted', toClass: 'KG' },
      },
    ],
  },
  rcls_12_1: { // Pre Nursery — September
    released: true,
    students: [
      {
        studentId: 3,
        attendance: { mode: 'auto', workingDays: 22, presentDays: 21, pct: 95 },
        achievements: {
          la_1: { slo_1_1: 'M', slo_1_2: 'A', slo_1_3: 'M', slo_1_4: 'M' },
          la_9: { slo_9_1: 'E', slo_9_2: 'M' },
        },
        psd: { psd_1: 'M', psd_2: 'M', psd_3: 'M', psd_4: 'A', psd_5: 'M', psd_6: 'A', psd_7: 'A', psd_8: 'M', psd_9: 'M', psd_10: 'M' },
        teacherRemarks: 'Amna is cheerful and adapting well to the classroom routine.',
        finalRemarks: 'Consistently meeting expectations. Continue building on this steady progress.',
        ptm: { enabled: false, date: '', parentAttendance: false, parentComments: '', teacherComments: '' },
        promotion: { status: null, toClass: '' },
      },
    ],
  },
};

/* ─── 7. Result Card visibility toggles — Preschool equivalent of
   mockRcoGeneral/mockRcoSig (src/mock/exams.js). ───────────────────── */
export const mockPRco = [
  { label: 'Show School Logo',                icon: 'fa-school',          on: true },
  { label: 'Show Student Photo',              icon: 'fa-user',            on: true },
  { label: 'Show Attendance Summary',         icon: 'fa-calendar-check',  on: true },
  { label: 'Show Overall Performance Summary', icon: 'fa-chart-simple',   on: true },
  { label: 'Show Performance Chart',          icon: 'fa-chart-pie',       on: true },
  { label: 'Show Subject-wise Assessment',    icon: 'fa-book',            on: true },
  { label: 'Show Personal & Social Development', icon: 'fa-people-arrows', on: true },
  { label: 'Show Teacher Observation Remarks', icon: 'fa-comment-dots',   on: true },
  { label: 'Show Parent Teacher Meeting Section', icon: 'fa-handshake',   on: true },
  { label: 'Show Promotion / Retention Status', icon: 'fa-arrow-up-right-from-square', on: true },
];
