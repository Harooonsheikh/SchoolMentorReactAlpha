export const mockWeeklyOff = [5, 6]; // Sat, Sun (Mon-indexed 0..6)

/* Working Hours & Attendance Rules — Attendance Setup tab. Disabled by
   default so existing manual attendance keeps behaving exactly as
   before until a school administrator turns this on and saves. */
export const mockAttendanceSetup = {
  isEnabled: false,
  schoolStartTime: '08:00',
  schoolEndTime: '14:00',
  attendanceStartTime: '07:30',
  normalTimeInUntil: '08:15',
  lateAfter: '08:15',
  shortLeaveFrom: '12:00',
  fullDayTimeOut: '14:00',

  /* Geo-fenced "Mark My Attendance" (self-attendance for Admin/Teacher
     from the mobile app) — off and unconfigured by default, same
     "nothing changes until a school turns it on" convention as
     isEnabled above. */
  geofenceEnabled: false,
  schoolLocationName: '',
  latitude: null,
  longitude: null,
  geofenceRadiusMeters: 200,
  maxAccuracyMeters: 100,

  /* Working Hours & Attendance Rules — Students. Same 7-field shape as
     the staff rules above (student* prefixed, nothing above renamed),
     so Compliance/Setup can configure students independently of staff
     — a school's class timings are rarely identical to staff timings.
     Off by default, same convention as isEnabled above. */
  studentRulesEnabled: false,
  studentSchoolStartTime: '08:00',
  studentSchoolEndTime: '14:00',
  studentAttendanceStartTime: '07:45',
  studentNormalTimeInUntil: '08:00',
  studentLateAfter: '08:00',
  studentShortLeaveFrom: '12:30',
  studentFullDayTimeOut: '14:00',

  /* Time tracking mode — 'in_out' (default, matches every existing
     report/screen exactly as before) or 'in_only'. When a school only
     wants Time In, Time Out stops being shown anywhere for that
     audience — the marking screens, the staff list, and every report.
     Independent per audience since a school may track staff in/out
     but only take a single student register time, or vice versa. */
  staffTrackingMode: 'in_out',
  studentTrackingMode: 'in_out',
};

export const mockHolidays = [
  { id: 1, month: 8,  title: 'Defence Day',      desc: 'Pakistan Defence Day',          from: '2025-09-06', to: '2025-09-06', classes: ['Whole School'] },
  { id: 2, month: 10, title: 'Iqbal Day',        desc: "Allama Iqbal's birthday",       from: '2025-11-09', to: '2025-11-09', classes: ['Whole School'] },
  { id: 3, month: 11, title: 'Quaid-e-Azam Day', desc: "Quaid-e-Azam's birthday",       from: '2025-12-25', to: '2025-12-26', classes: ['Whole School'] },
  { id: 4, month: 2,  title: 'Eid ul Fitr',      desc: 'Eid holiday',                   from: '2026-03-30', to: '2026-04-03', classes: ['Whole School'] },
];

/* `late` (additive — nothing below renamed) is a count within `present`,
   not on top of it: a late student is still present for the day, same
   convention as a teacher marking "Present, but came in late" rather
   than a separate attendance outcome. `timeOut` (additive, blank by
   default) is the class's own single dismissal time, parallel to
   markedTime already being the class's Time In — set only when a
   school's Student Time Tracking Mode is "Time In & Time Out". */
export const mockStudentAttendanceClasses = [
  { cls: 'Class I',   sec: 'Red',   total: 38, present: 34, absent: 2, leave: 2, late: 3, marked: true,  teacher: 'Ms. Ayesha Raza', markedBy: 'Ms. Ayesha Raza', markedFrom: 'ERP',         markedTime: '07:58 AM', timeOut: '02:00 PM' },
  { cls: 'Class I',   sec: 'Blue',  total: 36, present: 32, absent: 3, leave: 1, late: 1, marked: true,  teacher: 'Ms. Ayesha Raza', markedBy: 'Ms. Ayesha Raza', markedFrom: 'Mobile App',  markedTime: '08:05 AM', timeOut: '02:00 PM' },
  { cls: 'Class II',  sec: 'Red',   total: 40, present: 0,  absent: 0, leave: 0, late: 0, marked: false, teacher: 'Mr. Bilal Ahmed', markedBy: '',                markedFrom: '',            markedTime: '',        timeOut: '' },
  { cls: 'Class II',  sec: 'Blue',  total: 35, present: 31, absent: 3, leave: 1, late: 2, marked: true,  teacher: 'Mr. Bilal Ahmed', markedBy: 'Mr. Bilal Ahmed', markedFrom: 'ERP',         markedTime: '08:10 AM', timeOut: '02:00 PM' },
  { cls: 'Class III', sec: 'White', total: 42, present: 0,  absent: 0, leave: 0, late: 0, marked: false, teacher: 'Ms. Sana Tariq',  markedBy: '',                markedFrom: '',            markedTime: '',        timeOut: '' },
  { cls: 'Class IV',  sec: 'Green', total: 39, present: 35, absent: 3, leave: 1, late: 4, marked: true,  teacher: 'Ms. Sana Tariq',  markedBy: 'Ms. Sana Tariq',  markedFrom: 'Biometric',   markedTime: '08:02 AM', timeOut: '02:00 PM' },

  /* Additive rows (not a rename of anything above) for the 5 real
     Academics teachers (see mock/lessonPlans.js's header comment), so
     the Teacher Performance & Activity Report's "Student Attendance
     Marked by the Teacher" section has a real, attributable row for
     each of them. Classes V-VIII didn't have any attendance snapshot
     row at all before this; Class IV gets a second section (Section B)
     alongside the existing Ms. Sana Tariq / Green row, which is left
     untouched. */
  { cls: 'Class IV',   sec: 'B', total: 34, present: 31, absent: 2, leave: 1, late: 2, marked: true,  teacher: 'Ms. Ayesha Khan',  markedBy: 'Ms. Ayesha Khan',  markedFrom: 'ERP',        markedTime: '08:01 AM', timeOut: '02:00 PM' },
  { cls: 'Class V',    sec: 'A', total: 37, present: 33, absent: 3, leave: 1, late: 1, marked: true,  teacher: 'Mr. Ahmed Ali',    markedBy: 'Mr. Ahmed Ali',    markedFrom: 'ERP',        markedTime: '07:55 AM', timeOut: '02:00 PM' },
  { cls: 'Class VI',   sec: 'A', total: 33, present: 0,  absent: 0, leave: 0, late: 0, marked: false, teacher: 'Ms. Fatima Noor',  markedBy: '',                 markedFrom: '',           markedTime: '',        timeOut: '' },
  { cls: 'Class VII',  sec: 'A', total: 30, present: 27, absent: 2, leave: 1, late: 3, marked: true,  teacher: 'Mr. Usman Raza',   markedBy: 'Mr. Usman Raza',   markedFrom: 'Mobile App', markedTime: '08:12 AM', timeOut: '02:00 PM' },
  { cls: 'Class VIII', sec: 'A', total: 28, present: 25, absent: 2, leave: 1, late: 2, marked: true,  teacher: 'Mr. Bilal Hassan', markedBy: 'Mr. Bilal Hassan', markedFrom: 'Biometric',  markedTime: '08:06 AM', timeOut: '02:00 PM' },
];

export const mockStaffAttendance = [
  { name: 'Ms. Ayesha Raza', empId: 'EMP-001', desig: 'Head Teacher',    dept: 'Primary',   status: 'present', inTime: '07:45', outTime: '14:30', from: 'ERP',        marked: true  },
  { name: 'Mr. Bilal Ahmed', empId: 'EMP-002', desig: 'Science Teacher', dept: 'Secondary', status: 'present', inTime: '08:00', outTime: '14:30', from: 'Mobile App', marked: true  },
  { name: 'Ms. Fatima Khan', empId: 'EMP-003', desig: 'Math Teacher',    dept: 'Primary',   status: 'absent',  inTime: '',      outTime: '',      from: 'ERP',        marked: true  },
  { name: 'Mr. Hassan Ali',  empId: 'EMP-004', desig: 'English Teacher', dept: 'Secondary', status: 'leave',   inTime: '',      outTime: '',      from: 'ERP',        marked: true  },
  { name: 'Ms. Sana Tariq',  empId: 'EMP-005', desig: 'Urdu Teacher',    dept: 'Primary',   status: 'present', inTime: '07:55', outTime: '14:30', from: 'Biometric',  marked: true  },
  { name: 'Mr. Usman Shah',  empId: 'EMP-006', desig: 'PE Teacher',      dept: 'Primary',   status: 'present', inTime: '08:10', outTime: '14:30', from: 'Biometric',  marked: true  },
  { name: 'Ms. Zara Malik',  empId: 'EMP-007', desig: 'Art Teacher',     dept: 'Secondary', status: '',        inTime: '',      outTime: '',      from: '',           marked: false },
  { name: 'Dr. Islahudin',   empId: 'EMP-008', desig: 'Principal',       dept: 'Administration', status: 'present', inTime: '07:40', outTime: '15:00', from: 'ERP',       marked: true  },
  { name: 'Ms. Iqra Yousaf', empId: 'EMP-009', desig: 'Accountant',      dept: 'Administration', status: 'present', inTime: '08:05', outTime: '14:30', from: 'ERP',       marked: true  },
  { name: 'Mr. Junaid Sheikh', empId: 'EMP-010', desig: 'Librarian',     dept: 'Support Staff',  status: 'present', inTime: '08:00', outTime: '14:30', from: 'Biometric', marked: true  },

  /* Additive rows (new EMP-0xx ids, nothing above renamed) for the 5
     real Academics teachers — their OWN personal attendance, for the
     Teacher Performance & Activity Report's "Teacher's Personal
     Attendance" section. See mock/hr.js's matching new mockHrEmployees
     rows (same names, same EMP ids) for their leave balances. */
  { name: 'Mr. Ahmed Ali',    empId: 'EMP-011', desig: 'Science Teacher', dept: 'Academics', status: 'present', inTime: '07:50', outTime: '14:30', from: 'ERP',       marked: true  },
  { name: 'Ms. Fatima Noor',  empId: 'EMP-012', desig: 'English Teacher', dept: 'Academics', status: 'present', inTime: '07:58', outTime: '14:30', from: 'Mobile App', marked: true  },
  { name: 'Mr. Usman Raza',   empId: 'EMP-013', desig: 'Math Teacher',    dept: 'Academics', status: 'leave',   inTime: '',      outTime: '',      from: 'ERP',       marked: true  },
  { name: 'Ms. Ayesha Khan',  empId: 'EMP-014', desig: 'Urdu Teacher',    dept: 'Academics', status: 'present', inTime: '08:03', outTime: '14:30', from: 'Biometric', marked: true  },
  { name: 'Mr. Bilal Hassan', empId: 'EMP-015', desig: 'SST Teacher',     dept: 'Academics', status: 'absent',  inTime: '',      outTime: '',      from: 'ERP',       marked: true  },
];
