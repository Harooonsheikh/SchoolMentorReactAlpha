/* ═══════════════════════════════════════════════════════════════════
   ACADEMICS → REPORTS — MOCK data for the data areas that have NO live
   ERP service yet. Ported from the demo app (School-Mentor-Front-end,
   commit b027114: mock/attendance.js, hr.js, papers.js, exams.js and the
   RL_SEED worksheets in Academics.js), trimmed to the rows the Teacher
   Performance & Activity report actually reads. Every row is keyed to the
   5 demo Academics teachers in academicsReportsLessonPlans.js.

   Live-vs-mock per data area is documented in
   services/academicsReportsService.js.
   ═══════════════════════════════════════════════════════════════════ */

/* Mon-indexed weekly-off fallback (Sat, Sun) — only used if the live
   attendance-weekly-setup call fails. */
export const mockWeeklyOff = [5, 6];

export const mockHolidays = [
  { id: 1, month: 8,  title: 'Defence Day',      desc: 'Pakistan Defence Day',    from: '2025-09-06', to: '2025-09-06', classes: ['Whole School'] },
  { id: 2, month: 10, title: 'Iqbal Day',        desc: "Allama Iqbal's birthday", from: '2025-11-09', to: '2025-11-09', classes: ['Whole School'] },
  { id: 3, month: 11, title: 'Quaid-e-Azam Day', desc: "Quaid-e-Azam's birthday", from: '2025-12-25', to: '2025-12-26', classes: ['Whole School'] },
  { id: 4, month: 2,  title: 'Eid ul Fitr',      desc: 'Eid holiday',             from: '2026-03-30', to: '2026-04-03', classes: ['Whole School'] },
];

export const mockStudentAttendanceClasses = [
  { cls: 'Class IV',   sec: 'B', total: 34, present: 31, absent: 2, leave: 1, late: 2, marked: true,  teacher: 'Ms. Ayesha Khan',  markedBy: 'Ms. Ayesha Khan',  markedFrom: 'ERP',        markedTime: '08:01 AM', timeOut: '02:00 PM' },
  { cls: 'Class V',    sec: 'A', total: 37, present: 33, absent: 3, leave: 1, late: 1, marked: true,  teacher: 'Mr. Ahmed Ali',    markedBy: 'Mr. Ahmed Ali',    markedFrom: 'ERP',        markedTime: '07:55 AM', timeOut: '02:00 PM' },
  { cls: 'Class VI',   sec: 'A', total: 33, present: 0,  absent: 0, leave: 0, late: 0, marked: false, teacher: 'Ms. Fatima Noor',  markedBy: '',                 markedFrom: '',           markedTime: '',         timeOut: '' },
  { cls: 'Class VII',  sec: 'A', total: 30, present: 27, absent: 2, leave: 1, late: 3, marked: true,  teacher: 'Mr. Usman Raza',   markedBy: 'Mr. Usman Raza',   markedFrom: 'Mobile App', markedTime: '08:12 AM', timeOut: '02:00 PM' },
  { cls: 'Class VIII', sec: 'A', total: 28, present: 25, absent: 2, leave: 1, late: 2, marked: true,  teacher: 'Mr. Bilal Hassan', markedBy: 'Mr. Bilal Hassan', markedFrom: 'Biometric',  markedTime: '08:06 AM', timeOut: '02:00 PM' },
];

/* The teachers' OWN personal attendance today. */
export const mockStaffAttendance = [
  { name: 'Mr. Ahmed Ali',    empId: 'EMP-011', desig: 'Science Teacher', dept: 'Academics', status: 'present', inTime: '07:50', outTime: '14:30', from: 'ERP',        marked: true },
  { name: 'Ms. Fatima Noor',  empId: 'EMP-012', desig: 'English Teacher', dept: 'Academics', status: 'present', inTime: '07:58', outTime: '14:30', from: 'Mobile App', marked: true },
  { name: 'Mr. Usman Raza',   empId: 'EMP-013', desig: 'Math Teacher',    dept: 'Academics', status: 'leave',   inTime: '',      outTime: '',      from: 'ERP',        marked: true },
  { name: 'Ms. Ayesha Khan',  empId: 'EMP-014', desig: 'Urdu Teacher',    dept: 'Academics', status: 'present', inTime: '08:03', outTime: '14:30', from: 'Biometric',  marked: true },
  { name: 'Mr. Bilal Hassan', empId: 'EMP-015', desig: 'SST Teacher',     dept: 'Academics', status: 'absent',  inTime: '',      outTime: '',      from: 'ERP',        marked: true },
];

/* Minimal HR rows (join date + leave balance only — the only fields the
   report reads; no salary/payroll). Same shape as hrService.getHrEmployees. */
const hrTeacher = (id, name, join, balance, maternity = 0) => ({
  id, eid: `EMP-${String(id).padStart(3, '0')}`, firstName: name, lastName: '', join, status: 'Active',
  leaves: { annual: 20, casual: 10, sick: 8, maternity, balance },
});
export const mockTeacherHrEmployees = [
  hrTeacher(11, 'Mr. Ahmed Ali',    '2022-03-01', 14),
  hrTeacher(12, 'Ms. Fatima Noor',  '2021-08-15', 18),
  hrTeacher(13, 'Mr. Usman Raza',   '2023-01-10', 9),
  hrTeacher(14, 'Ms. Ayesha Khan',  '2020-06-01', 21, 2),
  hrTeacher(15, 'Mr. Bilal Hassan', '2019-09-01', 5),
];

/* Teacher-attributed question papers, keyed by class_section like the
   demo's paperService.getAllPapers(). */
export const mockPapers = {
  IV_A: [
    { subj: 'Urdu', title: 'Paper 2', date: '2026-04-11', time: '3:00 PM', by: 'Admin', teacher: 'Ms. Ayesha Khan', type: 'both', format: 'without', objMarks: 20, subjMarks: 30, objTime: 30, subjTime: 50 },
    { subj: 'Urdu', title: 'Paper 6', date: '2026-04-15', time: '3:00 PM', by: 'Admin', teacher: 'Ms. Ayesha Khan', type: 'both', format: 'with',    objMarks: 20, subjMarks: 30, objTime: 30, subjTime: 50 },
  ],
  V_A:   [{ subj: 'Science',     title: 'Unit 2 Assessment', date: '2026-05-05', time: '11:00 AM', by: 'Mr. Ahmed Ali',   teacher: 'Mr. Ahmed Ali',   type: 'objective',  format: 'with',    objMarks: 25, subjMarks: 0,  objTime: 35, subjTime: 0  }],
  VI_A:  [{ subj: 'English',     title: 'Grammar Test',      date: '2026-05-08', time: '10:30 AM', by: 'Ms. Fatima Noor', teacher: 'Ms. Fatima Noor', type: 'subjective', format: 'without', objMarks: 0,  subjMarks: 30, objTime: 0,  subjTime: 40 }],
  VII_A: [{ subj: 'Mathematics', title: 'Algebra Quiz',      date: '2026-05-11', time: '9:45 AM',  by: 'Mr. Usman Raza',  teacher: 'Mr. Usman Raza',  type: 'objective',  format: 'without', objMarks: 20, subjMarks: 0,  objTime: 30, subjTime: 0  }],
};

/* Teacher-attributed Resource Library worksheets (the live Resource
   Library records carry no uploader name, so worksheet attribution per
   teacher can only be mock for now). */
export const mockTeacherResources = [
  { id: 4, className: 'class 1A', subjectName: 'Science', category: 'worksheet', title: 'Science Worksheet — Photosynthesis', uploadedAt: '2026-06-18', uploadedBy: 'Mr. Ahmed Ali' },
  { id: 5, className: 'class 1A', subjectName: 'English', category: 'worksheet', title: 'English Worksheet — Comprehension',  uploadedAt: '2026-06-20', uploadedBy: 'Ms. Fatima Noor' },
];
