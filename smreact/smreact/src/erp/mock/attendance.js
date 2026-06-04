export const mockWeeklyOff = [5, 6]; // Sat, Sun (Mon-indexed 0..6)

export const mockHolidays = [
  { id: 1, month: 8,  title: 'Defence Day',      desc: 'Pakistan Defence Day',          from: '2025-09-06', to: '2025-09-06', classes: ['Whole School'] },
  { id: 2, month: 10, title: 'Iqbal Day',        desc: "Allama Iqbal's birthday",       from: '2025-11-09', to: '2025-11-09', classes: ['Whole School'] },
  { id: 3, month: 11, title: 'Quaid-e-Azam Day', desc: "Quaid-e-Azam's birthday",       from: '2025-12-25', to: '2025-12-26', classes: ['Whole School'] },
  { id: 4, month: 2,  title: 'Eid ul Fitr',      desc: 'Eid holiday',                   from: '2026-03-30', to: '2026-04-03', classes: ['Whole School'] },
];

export const mockStudentAttendanceClasses = [
  { cls: 'Class I',   sec: 'Red',   total: 38, present: 34, absent: 2, leave: 2, marked: true,  teacher: 'Ms. Ayesha Raza', markedBy: 'Ms. Ayesha Raza', markedFrom: 'ERP',         markedTime: '07:58 AM' },
  { cls: 'Class I',   sec: 'Blue',  total: 36, present: 32, absent: 3, leave: 1, marked: true,  teacher: 'Ms. Ayesha Raza', markedBy: 'Ms. Ayesha Raza', markedFrom: 'Mobile App',  markedTime: '08:05 AM' },
  { cls: 'Class II',  sec: 'Red',   total: 40, present: 0,  absent: 0, leave: 0, marked: false, teacher: 'Mr. Bilal Ahmed', markedBy: '',                markedFrom: '',            markedTime: '' },
  { cls: 'Class II',  sec: 'Blue',  total: 35, present: 31, absent: 3, leave: 1, marked: true,  teacher: 'Mr. Bilal Ahmed', markedBy: 'Mr. Bilal Ahmed', markedFrom: 'ERP',         markedTime: '08:10 AM' },
  { cls: 'Class III', sec: 'White', total: 42, present: 0,  absent: 0, leave: 0, marked: false, teacher: 'Ms. Sana Tariq',  markedBy: '',                markedFrom: '',            markedTime: '' },
  { cls: 'Class IV',  sec: 'Green', total: 39, present: 35, absent: 3, leave: 1, marked: true,  teacher: 'Ms. Sana Tariq',  markedBy: 'Ms. Sana Tariq',  markedFrom: 'Biometric',   markedTime: '08:02 AM' },
];

export const mockStaffAttendance = [
  { name: 'Ms. Ayesha Raza', empId: 'EMP-001', desig: 'Head Teacher',    dept: 'Primary',   status: 'present', inTime: '07:45', outTime: '14:30', from: 'ERP',        marked: true  },
  { name: 'Mr. Bilal Ahmed', empId: 'EMP-002', desig: 'Science Teacher', dept: 'Secondary', status: 'present', inTime: '08:00', outTime: '14:30', from: 'Mobile App', marked: true  },
  { name: 'Ms. Fatima Khan', empId: 'EMP-003', desig: 'Math Teacher',    dept: 'Primary',   status: 'absent',  inTime: '',      outTime: '',      from: 'ERP',        marked: true  },
  { name: 'Mr. Hassan Ali',  empId: 'EMP-004', desig: 'English Teacher', dept: 'Secondary', status: 'leave',   inTime: '',      outTime: '',      from: 'ERP',        marked: true  },
  { name: 'Ms. Sana Tariq',  empId: 'EMP-005', desig: 'Urdu Teacher',    dept: 'Primary',   status: 'present', inTime: '07:55', outTime: '14:30', from: 'Biometric',  marked: true  },
  { name: 'Mr. Usman Shah',  empId: 'EMP-006', desig: 'PE Teacher',      dept: 'Primary',   status: 'present', inTime: '08:10', outTime: '14:30', from: 'Biometric',  marked: true  },
  { name: 'Ms. Zara Malik',  empId: 'EMP-007', desig: 'Art Teacher',     dept: 'Secondary', status: '',        inTime: '',      outTime: '',      from: '',           marked: false },
];
