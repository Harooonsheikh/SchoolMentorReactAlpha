/* ═══════════════════════════════════════════════════════════════════
   QUIZ CONTENT — demo data (frontend only)

   Ported from "User Permission, quiz, SOPs, and PAYMENTS .html". Classes →
   Subjects → MCQs (with options, correct answer, difficulty, marks). Mock
   data only — the integrating developer swaps this for API calls.
   ═══════════════════════════════════════════════════════════════════ */

export const INITIAL_QUIZ = {
  classSeq: 12, subjectSeq: 12, mcqSeq: 15,
  classes: [
    { id: 1, name: 'Grade 1', order: 1, status: 'active' },
    { id: 2, name: 'Grade 2', order: 2, status: 'active' },
    { id: 3, name: 'Grade 3', order: 3, status: 'active' },
    { id: 4, name: 'Grade 4', order: 4, status: 'active' },
    { id: 5, name: 'Grade 5', order: 5, status: 'active' },
    { id: 6, name: 'Grade 6', order: 6, status: 'active' },
    { id: 7, name: 'Grade 7', order: 7, status: 'active' },
    { id: 8, name: 'Grade 8', order: 8, status: 'active' },
    { id: 9, name: 'Grade 9', order: 9, status: 'active' },
    { id: 10, name: 'Grade 10', order: 10, status: 'active' },
    { id: 11, name: 'Grade 11', order: 11, status: 'active' },
    { id: 12, name: 'Grade 12', order: 12, status: 'active' },
  ],
  subjects: [
    { id: 1, classId: 1, name: 'English', icon: '📖', order: 1, status: 'active' },
    { id: 2, classId: 1, name: 'Maths', icon: '🔢', order: 2, status: 'active' },
    { id: 3, classId: 1, name: 'Science', icon: '🔬', order: 3, status: 'active' },
    { id: 4, classId: 1, name: 'General Knowledge', icon: '🌍', order: 4, status: 'active' },
    { id: 5, classId: 1, name: 'Islamic Studies', icon: '📿', order: 5, status: 'active' },
    { id: 6, classId: 2, name: 'English', icon: '📖', order: 1, status: 'active' },
    { id: 7, classId: 2, name: 'Maths', icon: '🔢', order: 2, status: 'active' },
    { id: 8, classId: 2, name: 'Computer', icon: '💻', order: 3, status: 'active' },
    { id: 9, classId: 2, name: 'Science', icon: '🔬', order: 4, status: 'active' },
    { id: 10, classId: 3, name: 'English', icon: '📖', order: 1, status: 'active' },
    { id: 11, classId: 3, name: 'Maths', icon: '🔢', order: 2, status: 'active' },
    { id: 12, classId: 3, name: 'General Knowledge', icon: '🌍', order: 3, status: 'active' },
  ],
  mcqs: [
    { id: 1, classId: 1, subjectId: 1, question: 'Which word starts with the letter K?', a: 'Apple', b: 'Ball', c: 'Kangaroo', d: 'Sun', correct: 'C', difficulty: 'Easy', marks: 1, explanation: 'Kangaroo starts with the letter K.', status: 'active', createdAt: '2026-01-10' },
    { id: 2, classId: 1, subjectId: 1, question: 'Which word means the opposite of big?', a: 'Small', b: 'Hot', c: 'Fast', d: 'Cold', correct: 'A', difficulty: 'Easy', marks: 1, explanation: 'Small is the antonym of big.', status: 'active', createdAt: '2026-01-10' },
    { id: 3, classId: 1, subjectId: 1, question: 'What is the opposite of up?', a: 'Down', b: 'Left', c: 'Right', d: 'Near', correct: 'A', difficulty: 'Easy', marks: 1, explanation: 'The opposite of up is down.', status: 'active', createdAt: '2026-01-11' },
    { id: 4, classId: 1, subjectId: 1, question: 'Which of these is a noun?', a: 'Run', b: 'Happy', c: 'School', d: 'Quickly', correct: 'C', difficulty: 'Medium', marks: 1, explanation: 'School is a noun — a name of a place.', status: 'active', createdAt: '2026-01-12' },
    { id: 5, classId: 1, subjectId: 2, question: 'What is 5 + 3?', a: '7', b: '8', c: '9', d: '6', correct: 'B', difficulty: 'Easy', marks: 1, explanation: '5 plus 3 equals 8.', status: 'active', createdAt: '2026-01-12' },
    { id: 6, classId: 1, subjectId: 2, question: 'What is 10 - 4?', a: '5', b: '7', c: '6', d: '8', correct: 'C', difficulty: 'Easy', marks: 1, explanation: '10 minus 4 equals 6.', status: 'active', createdAt: '2026-01-13' },
    { id: 7, classId: 1, subjectId: 2, question: 'What is 3 x 4?', a: '10', b: '14', c: '12', d: '9', correct: 'C', difficulty: 'Medium', marks: 1, explanation: '3 multiplied by 4 equals 12.', status: 'active', createdAt: '2026-01-14' },
    { id: 8, classId: 1, subjectId: 3, question: 'Which planet is closest to the Sun?', a: 'Earth', b: 'Mars', c: 'Venus', d: 'Mercury', correct: 'D', difficulty: 'Medium', marks: 1, explanation: 'Mercury is the closest planet to the Sun.', status: 'active', createdAt: '2026-01-15' },
    { id: 9, classId: 1, subjectId: 3, question: 'How many legs does a spider have?', a: '6', b: '8', c: '4', d: '10', correct: 'B', difficulty: 'Easy', marks: 1, explanation: 'Spiders have 8 legs, unlike insects which have 6.', status: 'active', createdAt: '2026-01-16' },
    { id: 10, classId: 1, subjectId: 4, question: 'What is the capital of Pakistan?', a: 'Lahore', b: 'Karachi', c: 'Peshawar', d: 'Islamabad', correct: 'D', difficulty: 'Easy', marks: 1, explanation: 'Islamabad is the capital city of Pakistan.', status: 'active', createdAt: '2026-01-17' },
    { id: 11, classId: 1, subjectId: 4, question: 'How many continents are there on Earth?', a: '5', b: '6', c: '7', d: '8', correct: 'C', difficulty: 'Easy', marks: 1, explanation: 'There are 7 continents on Earth.', status: 'active', createdAt: '2026-01-17' },
    { id: 12, classId: 2, subjectId: 6, question: 'What is the plural of "child"?', a: 'Childs', b: 'Childen', c: 'Children', d: 'Childre', correct: 'C', difficulty: 'Easy', marks: 1, explanation: 'The plural of child is children — irregular plural.', status: 'active', createdAt: '2026-01-18' },
    { id: 13, classId: 2, subjectId: 7, question: 'What is 25 ÷ 5?', a: '4', b: '5', c: '6', d: '7', correct: 'B', difficulty: 'Easy', marks: 1, explanation: '25 divided by 5 equals 5.', status: 'active', createdAt: '2026-01-19' },
    { id: 14, classId: 2, subjectId: 8, question: 'What does CPU stand for?', a: 'Central Processing Unit', b: 'Computer Personal Unit', c: 'Central Personal Unit', d: 'Central Power Unit', correct: 'A', difficulty: 'Medium', marks: 1, explanation: 'CPU stands for Central Processing Unit, the brain of the computer.', status: 'active', createdAt: '2026-01-20' },
    { id: 15, classId: 2, subjectId: 8, question: 'Which device is used to type text into a computer?', a: 'Mouse', b: 'Monitor', c: 'Keyboard', d: 'Speaker', correct: 'C', difficulty: 'Easy', marks: 1, explanation: 'A keyboard is the primary input device for typing text.', status: 'inactive', createdAt: '2026-01-20' },
  ],
};

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

/* Excel bulk-upload template columns (used by the bulk modal). */
export const BULK_COLUMNS = [
  'Class', 'Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D',
  'Correct Answer (A/B/C/D)', 'Difficulty (Easy/Medium/Hard)', 'Marks', 'Explanation', 'Status (active/inactive)',
];

export const diffClass = (d) => (d === 'Easy' ? 'b-easy' : d === 'Medium' ? 'b-medium' : 'b-hard');
export const todayISO = () => new Date().toISOString().slice(0, 10);
