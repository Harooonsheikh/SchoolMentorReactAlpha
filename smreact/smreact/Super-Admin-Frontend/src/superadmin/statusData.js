/* ═══════════════════════════════════════════════════════════════════
   SCHOOL STATUS (Schools Progress) — demo data + helpers (frontend only)

   Ported from "User Permission, quiz, SOPs, and PAYMENTS .html". Three
   school groups (Launch Setup / ERP / Inactive) plus per-ERP-school detail
   (follow-up notes/calls/messages, onboarding cards, today/month module
   activity) and per-school enquiries (bugs). Mock data only — the
   integrating developer swaps these for API calls.
   ═══════════════════════════════════════════════════════════════════ */

export const ASSIGNEES = ['Dua Rizvi', 'Neha Bukhari', 'Nimra Fatima'];

export const INITIAL_LAUNCH = [
  { id: 1,  name: 'Mumtaz School System Madhora kalan', staff: 1, students: 0, status: 'Inserted', assigned: '-- Unassigned --', color: 'Red',   principal: 'Mumtaz Hussian', contact: '03446352668', stuSignup: 0, staffSignup: 0, signupDate: '2026-06-24', tabs: { school: 'Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 2,  name: 'STEM Learning Hub',                  staff: 1, students: 0, status: 'Inserted', assigned: 'Dua Rizvi',         color: 'Red',   principal: 'Ahmed Khan',     contact: '03001234567', stuSignup: 0, staffSignup: 0, signupDate: '2026-06-20', tabs: { school: 'Entered', classes: 'Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 3,  name: 'Al Asad College',                    staff: 1, students: 0, status: 'Inserted', assigned: 'Neha Bukhari',      color: 'Red',   principal: 'Sara Ali',       contact: '03211111111', stuSignup: 0, staffSignup: 0, signupDate: '2026-06-18', tabs: { school: 'Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Not Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Not Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 4,  name: 'Al Asad School System Tangi',        staff: 2, students: 0, status: 'Inserted', assigned: 'Nimra Fatima',      color: 'Green', principal: 'Bilal Hassan',   contact: '03331234567', stuSignup: 0, staffSignup: 0, signupDate: '2026-06-15', tabs: { school: 'Entered', classes: 'Entered', student: 'Not Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Entered', parentContact: 'Not Entered', subjectAssigned: 'Entered', prevDues: 'Not Entered' } },
  { id: 5,  name: 'MY SCHOOL HARIPUR CAMPUSE',          staff: 1, students: 0, status: 'Inserted', assigned: 'Dua Rizvi',         color: 'Red',   principal: 'Hina Malik',     contact: '03451234567', stuSignup: 0, staffSignup: 0, signupDate: '2026-06-14', tabs: { school: 'Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 6,  name: 'Nexus',                              staff: 1, students: 0, status: 'Inserted', assigned: 'Dua Rizvi',         color: 'Red',   principal: 'Nexus Admin',    contact: '03001112222', stuSignup: 0, staffSignup: 0, signupDate: '2026-06-12', tabs: { school: 'Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Not Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Not Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 10, name: 'STARS SCHOOL SYSTEM Nowshera virkan', staff: 14, students: 225, status: 'Completed', assigned: 'Dua Rizvi',     color: 'Green', principal: 'Zainab Noor',    contact: '03001111111', stuSignup: 50, staffSignup: 10, signupDate: '2026-05-01', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Entered' } },
  { id: 11, name: 'World E Education Islamic School',    staff: 1,  students: 4,   status: 'Completed', assigned: '-- Unassigned --', color: 'Green', principal: 'Omar Farooq',  contact: '03129999999', stuSignup: 4, staffSignup: 1, signupDate: '2026-05-15', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Entered' } },
  { id: 13, name: 'The spirit school',                  staff: 1,  students: 0,   status: 'Inserted', assigned: '-- Unassigned --', color: 'Red',   principal: 'Spirit Admin',   contact: '03221234321', stuSignup: 0, staffSignup: 0, signupDate: '2026-06-05', tabs: { school: 'Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Not Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Not Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
];

export const INITIAL_ERP = [
  { id: 201, name: 'AES School System',                 initials: 'AS', staff: 2,  students: 4,   assigned: 'Dua Rizvi',    color: 'Red',   logins: 31,  workTime: '0:20:30',  notes: 0, calls: 0, messages: 0, onboarding: { completed: 0,  total: 15 }, principal: 'AES Admin',      contact: '03001234001', stuSignup: 4,   staffSignup: 2,  signupDate: '2025-09-10', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 202, name: 'Jinnah Educational Complex School', initials: 'JE', staff: 6,  students: 18,  assigned: 'Dua Rizvi',    color: 'Red',   logins: 69,  workTime: '4:36:35',  notes: 0, calls: 0, messages: 0, onboarding: { completed: 5,  total: 15 }, principal: 'JE Admin',       contact: '03009876543', stuSignup: 18,  staffSignup: 6,  signupDate: '2025-10-15', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Not Entered' } },
  { id: 203, name: 'The Creative School',               initials: 'TC', staff: 12, students: 89,  assigned: 'Neha Bukhari', color: 'Green', logins: 142, workTime: '12:45:00', notes: 3, calls: 2, messages: 7, onboarding: { completed: 10, total: 15 }, principal: 'Creative Admin', contact: '03112233445', stuSignup: 89,  staffSignup: 12, signupDate: '2025-08-01', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Entered' } },
  { id: 204, name: 'Beaconhouse School System Gulberg', initials: 'BG', staff: 18, students: 210, assigned: 'Dua Rizvi',    color: 'Green', logins: 95,  workTime: '8:10:22',  notes: 1, calls: 0, messages: 2, onboarding: { completed: 12, total: 15 }, principal: 'Tariq Mahmood',  contact: '03214567890', stuSignup: 210, staffSignup: 18, signupDate: '2025-07-15', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Entered' } },
  { id: 205, name: 'The City School Johar Town',        initials: 'CJ', staff: 22, students: 345, assigned: 'Neha Bukhari', color: 'Green', logins: 188, workTime: '15:44:00', notes: 4, calls: 3, messages: 9, onboarding: { completed: 14, total: 15 }, principal: 'Sana Malik',     contact: '03321122334', stuSignup: 345, staffSignup: 22, signupDate: '2025-06-01', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Entered' } },
  { id: 206, name: 'Roots International School F-10',    initials: 'RF', staff: 15, students: 180, assigned: 'Dua Rizvi',    color: 'Green', logins: 72,  workTime: '6:30:15',  notes: 2, calls: 1, messages: 3, onboarding: { completed: 9,  total: 15 }, principal: 'Faisal Qureshi', contact: '03451234567', stuSignup: 180, staffSignup: 15, signupDate: '2025-08-20', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Not Entered' } },
  { id: 207, name: 'Lahore Grammar School DHA',         initials: 'LD', staff: 30, students: 420, assigned: 'Nimra Fatima', color: 'Green', logins: 210, workTime: '22:15:40', notes: 6, calls: 4, messages: 11, onboarding: { completed: 15, total: 15 }, principal: 'Ayesha Raza',    contact: '03001112222', stuSignup: 420, staffSignup: 30, signupDate: '2025-05-10', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Entered' } },
  { id: 208, name: 'Allied School Gulshan Campus',      initials: 'AG', staff: 11, students: 155, assigned: 'Neha Bukhari', color: 'Red',   logins: 44,  workTime: '3:50:10',  notes: 0, calls: 1, messages: 2, onboarding: { completed: 7,  total: 15 }, principal: 'Usman Ghani',    contact: '03339988776', stuSignup: 155, staffSignup: 11, signupDate: '2025-09-30', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 209, name: 'Divisional Public School Rawalpindi', initials: 'DR', staff: 25, students: 380, assigned: 'Dua Rizvi',  color: 'Green', logins: 130, workTime: '11:20:00', notes: 3, calls: 2, messages: 5, onboarding: { completed: 13, total: 15 }, principal: 'Khalid Mehmood', contact: '03125556677', stuSignup: 380, staffSignup: 25, signupDate: '2025-07-01', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Entered' } },
  { id: 210, name: 'Fazaia Inter College Risalpur',     initials: 'FR', staff: 20, students: 290, assigned: 'Nimra Fatima', color: 'Green', logins: 88,  workTime: '7:45:30',  notes: 1, calls: 2, messages: 4, onboarding: { completed: 11, total: 15 }, principal: 'Brig Imran Shah', contact: '03009887766', stuSignup: 290, staffSignup: 20, signupDate: '2025-08-05', tabs: { school: 'Entered', classes: 'Entered', student: 'Entered', dept: 'Entered', staff: 'Entered', syllabus: 'Entered', timetable: 'Entered' }, comp: { staffContact: 'Entered', parentContact: 'Entered', subjectAssigned: 'Entered', prevDues: 'Entered' } },
];

export const INITIAL_INACTIVE = [
  { id: 301, name: 'Daffodils School',                  staff: 1, students: 0, staffSignup: 0, stuSignup: 0, principal: 'Ali Ahmed',    contact: '03001111111', signupDate: '2026-01-10', tabs: { school: 'Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Not Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Not Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 302, name: 'Saeed Public School (High Section)', staff: 0, students: 0, staffSignup: 0, stuSignup: 0, principal: 'Saeed Khan',  contact: '03012222222', signupDate: '2026-02-05', tabs: { school: 'Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Not Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Not Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 303, name: 'SPS- Middle Branch',                staff: 0, students: 0, staffSignup: 0, stuSignup: 0, principal: 'Saba Perveen', contact: '03023333333', signupDate: '2026-03-12', tabs: { school: 'Not Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Not Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Not Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
  { id: 304, name: 'SPS- Middle Section',               staff: 0, students: 0, staffSignup: 0, stuSignup: 0, principal: 'Nadia Butt',   contact: '03034444444', signupDate: '2026-03-15', tabs: { school: 'Not Entered', classes: 'Not Entered', student: 'Not Entered', dept: 'Not Entered', staff: 'Not Entered', syllabus: 'Not Entered', timetable: 'Not Entered' }, comp: { staffContact: 'Not Entered', parentContact: 'Not Entered', subjectAssigned: 'Not Entered', prevDues: 'Not Entered' } },
];

/* Onboarding / module-activity catalogue (15 modules). */
export const EM_MODULES = [
  { key: 'academics',   name: 'Academics',        icon: 'fa-graduation-cap' },
  { key: 'exam',        name: 'Examination',      icon: 'fa-file-alt' },
  { key: 'attendance',  name: 'Attendance',       icon: 'fa-clipboard-check' },
  { key: 'fee',         name: 'Fee',              icon: 'fa-money-bill-wave' },
  { key: 'accounts',    name: 'Accounts',         icon: 'fa-calculator' },
  { key: 'students',    name: 'Students',         icon: 'fa-user-graduate' },
  { key: 'hr',          name: 'Human Resource',   icon: 'fa-people-group' },
  { key: 'timetable',   name: 'Time Table',       icon: 'fa-calendar-days' },
  { key: 'launch',      name: 'Launch Setup',     icon: 'fa-rocket' },
  { key: 'inventory',   name: 'Inventory',        icon: 'fa-boxes-stacking' },
  { key: 'admissions',  name: 'Admissions CRM',   icon: 'fa-user-plus' },
  { key: 'reports',     name: 'Reports',          icon: 'fa-chart-bar' },
  { key: 'permissions', name: 'User Permissions', icon: 'fa-key' },
  { key: 'sop',         name: 'SOPs',             icon: 'fa-book-open' },
  { key: 'settings',    name: 'Settings',         icon: 'fa-gear' },
];

/* Build the per-ERP-school detail object (follow-up, onboarding, activity). */
export function buildSchoolDetail(s) {
  const completed = s.onboarding ? s.onboarding.completed : 0;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return {
    notes: [{ id: 1, text: 'Called regarding ERP follow-up and discussed fee module configuration.', date: '06/06/2026', user: 'schoolmentoradmin' }],
    calls: [
      { id: 1, detail: 'Call them for challan payment — no response at 10am.', dateTime: '20/06/2026, 10:28 AM', user: 'Muniba Ijaz' },
      { id: 2, detail: 'No response on call.', dateTime: '22/06/2026, 12:06 PM', user: 'Muniba Ijaz' },
    ],
    messages: [
      { id: 1, detail: 'Discussion via messages regarding ERP onboarding timeline.', dateTime: '06/06/2026, 10:22 AM', user: 'schoolmentoradmin' },
      { id: 2, detail: 'Sent reminder for challan payment and account setup.', dateTime: '20/06/2026, 10:29 AM', user: 'Muniba Ijaz' },
    ],
    obModules: EM_MODULES.map((m, i) => ({
      ...m,
      done: i < completed,
      comment: i < completed ? 'Training completed successfully.' : '',
      date: i < completed ? `2026-06-${pad(i + 1)}` : '',
      history: i < completed ? [{ comment: 'Training completed.', date: `2026-06-${pad(i + 1)}`, user: 'Dua Rizvi' }] : [],
    })),
    todayLogins: 0, todayTime: '00:00:00',
    monthLogins: s.logins || 0, monthTime: s.workTime || '00:00:00',
    todayMods: {
      academics: { l: 0, t: '00:00:00' }, exam: { l: 0, t: '00:00:00' }, attendance: { l: 0, t: '00:00:00' },
      fee: { l: 0, t: '00:00:00' }, accounts: { l: 0, t: '00:00:00' }, students: { l: 0, t: '00:00:00' },
      hr: { l: 0, t: '00:00:00' }, timetable: { l: 0, t: '00:00:00' }, launch: { l: 0, t: '00:00:00' },
    },
    monthMods: {
      academics: { l: 1, t: '0:00:10' }, exam: { l: 0, t: '00:00:00' }, attendance: { l: 0, t: '00:00:00' },
      fee: { l: 5, t: '0:06:05' }, accounts: { l: 4, t: '0:00:52' }, students: { l: 2, t: '0:00:23' },
      hr: { l: 0, t: '00:00:00' }, timetable: { l: 2, t: '0:00:12' }, launch: { l: s.logins || 16, t: s.workTime || '0:12:41' },
    },
  };
}

/* Per-school enquiry (bug) seed, keyed by ERP school id. */
export const INITIAL_ENQUIRIES = {
  201: [
    { id: 1, module: 'Fee', developer: 'Muaz', detail: 'School wants to receive fee multiple times per month from parents and enable option of multiple times fee receiving.', date: '10/06/2026', user: 'Dua Rizvi', status: 'open' },
    { id: 2, module: 'Attendance', developer: 'Usman', detail: 'Attendance export to Excel not working for classes with 50+ students.', date: '15/06/2026', user: 'Muniba Ijaz', status: 'resolved' },
  ],
  202: [
    { id: 1, module: 'Examination', developer: 'Muaz', detail: 'Date sheet PDF generation fails when subjects exceed 12 per class.', date: '08/06/2026', user: 'Dua Rizvi', status: 'open' },
    { id: 2, module: 'Accounts', developer: 'Sara', detail: 'Monthly financial report shows incorrect totals for June 2026.', date: '12/06/2026', user: 'Dua Rizvi', status: 'open' },
    { id: 3, module: 'HR', developer: 'Usman', detail: 'Payroll slip not generating for staff with advance loan deductions.', date: '18/06/2026', user: 'Muniba Ijaz', status: 'resolved' },
  ],
  203: [
    { id: 1, module: 'Fee', developer: 'Muaz', detail: 'Challan printing cuts off school logo on A5 paper size.', date: '05/06/2026', user: 'Neha Bukhari', status: 'resolved' },
    { id: 2, module: 'Students', developer: 'Sara', detail: 'Bulk student import from CSV drops phone numbers with leading zeros.', date: '10/06/2026', user: 'Neha Bukhari', status: 'resolved' },
    { id: 3, module: 'Academics', developer: 'Muaz', detail: 'Lesson plan submission notification not reaching teachers.', date: '20/06/2026', user: 'Muniba Ijaz', status: 'open' },
  ],
};

export const moduleMeta = (key) => EM_MODULES.find((m) => m.key === key) || { name: key, icon: 'fa-layer-group' };
