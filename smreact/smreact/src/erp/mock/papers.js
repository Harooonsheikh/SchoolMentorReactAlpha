export const mockPaperClasses = [
  { name: 'class 1A',   section: 'B',       subjects: ['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies'] },
  { name: 'class 1A',   section: 'C',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'class 1A',   section: 'D',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'class 1A',   section: 'Green f', subjects: ['English', 'Urdu'] },
  { name: 'class 1A',   section: 'New',     subjects: ['English', 'Urdu'] },
  { name: 'II-Pre',     section: 'A',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'III-Pre',    section: '2',       subjects: ['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies'] },
  { name: 'I',          section: 'White',   subjects: ['English', 'Urdu'] },
  { name: 'I',          section: 'Green',   subjects: ['English', 'Urdu'] },
  { name: 'II',         section: 'B',       subjects: ['Mathematics', 'Science'] },
  { name: 'II',         section: 'A',       subjects: ['Mathematics', 'Science'] },
  { name: 'III',        section: 'A',       subjects: ['Urdu'] },
  { name: 'IV',         section: 'A',       subjects: ['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies'] },
  { name: 'V',          section: 'A',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'VI',         section: 'A',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'VII',        section: 'A',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'VIII',       section: 'A',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'IX',         section: 'A',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'IX',         section: 'B',       subjects: ['English', 'Urdu', 'Mathematics', 'Science'] },
  { name: 'Pre-Year 1', section: 'A',       subjects: ['English', 'Urdu'] },
];

export const mockPapers = (() => {
  const out = {};
  out['class1A_B'] = [
    { subj: 'English',     title: 'Monthly Test Paper',           date: '2026-04-15', time: '10:00 AM', by: 'Admin',   type: 'both',       format: 'with',    objMarks: 20, subjMarks: 30, objTime: 30, subjTime: 50 },
    { subj: 'Science',     title: 'Unit 1 Assessment',            date: '2026-04-20', time: '2:30 PM',  by: 'Ahmad',   type: 'objective',  format: 'with',    objMarks: 25, subjMarks: 0,  objTime: 40, subjTime: 0  },
    { subj: 'Mathematics', title: 'Weekly Quiz No. 3',            date: '2026-04-28', time: '11:15 AM', by: 'Admin',   type: 'objective',  format: 'without', objMarks: 15, subjMarks: 0,  objTime: 25, subjTime: 0  },
    { subj: 'Urdu',        title: 'Monthly Imtahan — April 2026', date: '2026-04-30', time: '9:00 AM',  by: 'Teacher', type: 'subjective', format: 'without', objMarks: 0,  subjMarks: 40, objTime: 0,  subjTime: 60 },
  ];
  out['II-Pre_A'] = [
    { subj: 'English', title: 'Testing Paper',        date: '2026-04-09', time: '7:13 PM', by: 'Ahmad', type: 'both',       format: 'with',    objMarks: 20, subjMarks: 30, objTime: 30, subjTime: 50 },
    { subj: 'Science', title: 'Science Sample Paper', date: '2026-04-10', time: '5:12 PM', by: 'Ahmad', type: 'subjective', format: 'with',    objMarks: 0,  subjMarks: 50, objTime: 0,  subjTime: 60 },
    { subj: 'English', title: 'Final Term Paper',     date: '2026-04-14', time: '2:22 PM', by: 'Ahmad', type: 'objective',  format: 'without', objMarks: 30, subjMarks: 0,  objTime: 40, subjTime: 0  },
  ];
  out['IV_A'] = Array.from({ length: 6 }, (_, i) => {
    const subs = ['English', 'Urdu', 'Mathematics', 'Science'];
    const s = subs[i % 4];
    return {
      subj: s,
      title: `Paper ${i + 1}`,
      date: `2026-04-${String(10 + i).padStart(2, '0')}`,
      time: '3:00 PM',
      by: 'Admin',
      type: 'both',
      format: i % 2 === 0 ? 'with' : 'without',
      objMarks: 20, subjMarks: 30, objTime: 30, subjTime: 50,
    };
  });
  return out;
})();
