/* ═══════════════════════════════════════════════════════════════════
   AUDIT LOGS — constants, demo data, and read-only helpers

   This module is *append-only* by design — no edit/delete primitives
   are exported. The seed array below is a representative snapshot of
   typical ERP activity over the last ~30 days; replace with API calls
   when wiring a backend (`fetchLogs(filters)` returns the same shape).
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Module catalogue — drives the Module filter + report grouping. ─── */
export const MODULES = [
  { id: 'academics',   label: 'Academics',         icon: 'fa-book-open-reader' },
  { id: 'examination', label: 'Examination',       icon: 'fa-file-pen' },
  { id: 'papers',      label: 'Paper Generator',   icon: 'fa-scroll' },
  { id: 'attendance',  label: 'Attendance',        icon: 'fa-clipboard-check' },
  { id: 'timetable',   label: 'Timetable',        icon: 'fa-calendar-days' },
  { id: 'fee',         label: 'Fee',               icon: 'fa-money-bill-wave' },
  { id: 'accounts',    label: 'Accounts',          icon: 'fa-calculator' },
  { id: 'inventory',   label: 'Inventory',         icon: 'fa-boxes-stacked' },
  { id: 'admissions',  label: 'Admission CRM',     icon: 'fa-user-plus' },
  { id: 'students',    label: 'Students',          icon: 'fa-user-graduate' },
  { id: 'hr',          label: 'HR',                icon: 'fa-users' },
  { id: 'appraisals',  label: 'Appraisals',        icon: 'fa-star-half-stroke' },
  { id: 'sops',        label: 'School SOPs',       icon: 'fa-book-open' },
  { id: 'trainings',   label: 'Teacher Trainings', icon: 'fa-chalkboard-user' },
  { id: 'permissions', label: 'User Permissions',  icon: 'fa-shield-halved' },
  { id: 'settings',    label: 'Settings',          icon: 'fa-gear' },
  { id: 'launch',      label: 'Launch Setup',      icon: 'fa-rocket' },
];

/* ─── Action catalogue — drives the Action filter + colour-tone of the
       action badge in the table. */
export const ACTIONS = [
  { id: 'created',    label: 'Created',    tone: 'green'  },
  { id: 'updated',    label: 'Updated',    tone: 'blue'   },
  { id: 'deleted',    label: 'Deleted',    tone: 'red'    },
  { id: 'viewed',     label: 'Viewed',     tone: 'gray'   },
  { id: 'downloaded', label: 'Downloaded', tone: 'teal'   },
  { id: 'printed',    label: 'Printed',    tone: 'teal'   },
  { id: 'approved',   label: 'Approved',   tone: 'green'  },
  { id: 'assigned',   label: 'Assigned',   tone: 'purple' },
  { id: 'login',      label: 'Login',      tone: 'blue'   },
  { id: 'logout',     label: 'Logout',     tone: 'gray'   },
  { id: 'permission', label: 'Permission', tone: 'amber'  },
];

/* ─── User catalogue — drives the User filter + the "Active Users Today"
       summary card. */
export const USERS = [
  { id: 'u1', name: 'Dr. Islahudin',  role: 'Principal',          email: 'principal@oxford.edu.pk' },
  { id: 'u2', name: 'Mr. Ahmed Khan', role: 'Vice Principal',     email: 'vp@oxford.edu.pk'         },
  { id: 'u3', name: 'Ms. Sarah Noor', role: 'HR Officer',         email: 'hr@oxford.edu.pk'         },
  { id: 'u4', name: 'Xi',             role: 'Teacher',            email: 'xi@oxford.edu.pk'         },
  { id: 'u5', name: 'Pi',             role: 'Teacher',            email: 'pi@oxford.edu.pk'         },
  { id: 'u6', name: 'Fatima Noor',    role: 'Front Desk',         email: 'frontdesk@oxford.edu.pk'  },
  { id: 'u7', name: 'Kashif Ali',     role: 'Inventory Officer',  email: 'inventory@oxford.edu.pk'  },
  { id: 'u8', name: 'Zara Hussain',   role: 'Accountant',         email: 'accounts@oxford.edu.pk'   },
  { id: 'u9', name: 'Hassan Raza',    role: 'Admission Officer',  email: 'admissions@oxford.edu.pk' },
  { id: 'u10',name: 'Amna Tariq',     role: 'Coordinator',        email: 'coord@oxford.edu.pk'      },
];

/* ─── Tone resolver for the action badge. */
export function actionTone(actionId) {
  return ACTIONS.find(a => a.id === actionId)?.tone || 'gray';
}

/* ─── Lookup helpers used by the table, modal, and report viewer. */
export function findUser(id)    { return USERS.find(u => u.id === id);     }
export function findModule(id)  { return MODULES.find(m => m.id === id);   }
export function findAction(id)  { return ACTIONS.find(a => a.id === id);   }

/* ─── Seed log entries — ~85 records spanning May 2026.
       Each entry is read-only; no helper here mutates it. */
export const INITIAL_LOGS = [
  /* ── Today — 2026-05-31 ── */
  { id: 'L0001', date: '2026-05-31', time: '11:42 AM', userId: 'u1',  module: 'examination', screen: 'Exam Setup',        action: 'approved',   record: 'Final Term 2026 — Class 9',          details: 'Approved Final Term 2026 exam schedule for Class 9',                        oldValue: 'Status: Pending Review',     newValue: 'Status: Approved' },
  { id: 'L0002', date: '2026-05-31', time: '11:25 AM', userId: 'u4',  module: 'academics',   screen: 'Lesson Plans',      action: 'created',    record: 'Week 21 — Mathematics, Grade 9',     details: 'Created Week 21 Lesson Plan for Mathematics (Grade 9)',                     oldValue: '—',                          newValue: 'Topic: Quadratic Equations · Submitted' },
  { id: 'L0003', date: '2026-05-31', time: '11:10 AM', userId: 'u8',  module: 'fee',         screen: 'Fee Structure',     action: 'updated',    record: 'Class 10 Fee Structure',             details: 'Updated tuition + transport for Class 10 (effective June 2026)',           oldValue: 'Tuition: PKR 12,000 · Transport: PKR 3,500', newValue: 'Tuition: PKR 13,500 · Transport: PKR 3,800' },
  { id: 'L0004', date: '2026-05-31', time: '10:55 AM', userId: 'u9',  module: 'admissions',  screen: 'Inquiries',         action: 'created',    record: 'Inquiry #INQ-2026-0231',             details: 'Created new admission inquiry for Grade 6 from website form',              oldValue: '—',                          newValue: 'Source: Website · Status: New' },
  { id: 'L0005', date: '2026-05-31', time: '10:42 AM', userId: 'u3',  module: 'hr',          screen: 'Employee Management', action: 'updated',  record: 'Employee EMP-018 — Amina Aslam',     details: 'Updated employee profile — phone + emergency contact',                      oldValue: 'Phone: 03000000000',          newValue: 'Phone: 03021234567' },
  { id: 'L0006', date: '2026-05-31', time: '10:30 AM', userId: 'u8',  module: 'accounts',    screen: 'Financial Reports', action: 'downloaded', record: 'May 2026 P&L Statement',             details: 'Downloaded May 2026 Profit & Loss statement (PDF)',                         oldValue: '—',                          newValue: 'Format: PDF · Pages: 4' },
  { id: 'L0007', date: '2026-05-31', time: '10:15 AM', userId: 'u1',  module: 'permissions', screen: 'Manage Users',      action: 'permission', record: 'Xi (EMP-005)',                       details: 'Assigned "Custom Access" — Attendance Export rights granted',              oldValue: 'Role-based · Teacher',        newValue: 'Custom · Teacher + Att Export' },
  { id: 'L0008', date: '2026-05-31', time: '10:00 AM', userId: 'u5',  module: 'attendance',  screen: 'Student Attendance', action: 'created',    record: 'Class 8-A — 31 May 2026',            details: 'Submitted student attendance for Class 8-A (28/30 present)',               oldValue: '—',                          newValue: 'Present: 28 · Absent: 2 · Late: 0' },
  { id: 'L0009', date: '2026-05-31', time: '09:45 AM', userId: 'u4',  module: 'attendance',  screen: 'Student Attendance', action: 'created',    record: 'Class 9-B — 31 May 2026',            details: 'Submitted student attendance for Class 9-B (26/29 present)',               oldValue: '—',                          newValue: 'Present: 26 · Absent: 3 · Late: 0' },
  { id: 'L0010', date: '2026-05-31', time: '09:30 AM', userId: 'u2',  module: 'sops',        screen: 'View Manuals',      action: 'viewed',     record: 'Discipline & Safety Manual',         details: 'Viewed Discipline & Safety SOP manual',                                     oldValue: '—',                          newValue: 'Pages read: 12 of 28' },
  { id: 'L0011', date: '2026-05-31', time: '09:15 AM', userId: 'u1',  module: 'permissions', screen: 'Audit Logs',        action: 'login',      record: 'Session — Web',                       details: 'User signed in via web browser',                                            oldValue: '—',                          newValue: 'IP: 39.45.118.224 · Web' },
  { id: 'L0012', date: '2026-05-31', time: '08:55 AM', userId: 'u4',  module: 'permissions', screen: 'Audit Logs',        action: 'login',      record: 'Session — Web',                       details: 'User signed in via web browser',                                            oldValue: '—',                          newValue: 'IP: 192.168.10.45 · Web' },

  /* ── Yesterday — 2026-05-30 ── */
  { id: 'L0013', date: '2026-05-30', time: '04:25 PM', userId: 'u1',  module: 'appraisals',  screen: 'Run Appraisals',    action: 'approved',   record: 'Q2 2026 Appraisal — Pi',             details: 'Approved Q2 2026 staff appraisal for Pi (Teacher)',                         oldValue: 'Status: Pending',             newValue: 'Status: Approved · Score: 88/100' },
  { id: 'L0014', date: '2026-05-30', time: '04:10 PM', userId: 'u3',  module: 'hr',          screen: 'Payroll & Salary',  action: 'created',    record: 'May 2026 Payroll Run',               details: 'Generated May 2026 payroll for 47 staff members',                          oldValue: '—',                          newValue: 'Total: PKR 4,860,000 · 47 slips' },
  { id: 'L0015', date: '2026-05-30', time: '03:50 PM', userId: 'u8',  module: 'fee',         screen: 'Receive Fee',       action: 'created',    record: 'Receipt #FR-2026-1042',              details: 'Recorded fee payment for STU-0231 (Grade 7-A)',                            oldValue: '—',                          newValue: 'Amount: PKR 18,500 · Cash' },
  { id: 'L0016', date: '2026-05-30', time: '03:20 PM', userId: 'u2',  module: 'examination', screen: 'Date Sheet',        action: 'updated',    record: 'Final Term Date Sheet',              details: 'Updated Final Term date sheet — Physics shifted to 12 June',               oldValue: 'Physics: 10 Jun 2026',        newValue: 'Physics: 12 Jun 2026' },
  { id: 'L0017', date: '2026-05-30', time: '02:45 PM', userId: 'u7',  module: 'inventory',   screen: 'Inventory Items',   action: 'updated',    record: 'Item INV-244 — Whiteboard Markers',  details: 'Adjusted stock count after physical audit',                                  oldValue: 'Stock: 42 boxes',             newValue: 'Stock: 38 boxes' },
  { id: 'L0018', date: '2026-05-30', time: '02:30 PM', userId: 'u6',  module: 'admissions',  screen: 'Inquiries',         action: 'assigned',   record: 'Inquiry #INQ-2026-0229',             details: 'Assigned inquiry to Hassan Raza for follow-up',                            oldValue: 'Assignee: —',                 newValue: 'Assignee: Hassan Raza' },
  { id: 'L0019', date: '2026-05-30', time: '01:55 PM', userId: 'u4',  module: 'academics',   screen: 'Syllabus',          action: 'printed',    record: 'Mathematics Grade 9 — Term 3',       details: 'Printed Mathematics Grade 9 Term 3 syllabus',                              oldValue: '—',                          newValue: 'Pages: 6 · Copies: 1' },
  { id: 'L0020', date: '2026-05-30', time: '12:40 PM', userId: 'u10', module: 'timetable',   screen: 'Manage Timetable',  action: 'updated',    record: 'Class 8-A Timetable',                details: 'Swapped Period 4 (Maths) and Period 5 (Science) on Wednesdays',           oldValue: 'P4: Maths · P5: Science',     newValue: 'P4: Science · P5: Maths' },
  { id: 'L0021', date: '2026-05-30', time: '11:30 AM', userId: 'u1',  module: 'examination', screen: 'Results',           action: 'approved',   record: 'Mid-Term Results — Grade 6',         details: 'Approved Mid-Term results for Grade 6 (3 sections)',                       oldValue: 'Status: Pending',             newValue: 'Status: Published' },
  { id: 'L0022', date: '2026-05-30', time: '10:10 AM', userId: 'u3',  module: 'hr',          screen: 'HR Letters',        action: 'created',    record: 'Experience Letter — EMP-022',        details: 'Generated experience letter for Fatima Noor',                              oldValue: '—',                          newValue: 'Type: Experience · Pages: 1' },
  { id: 'L0023', date: '2026-05-30', time: '09:25 AM', userId: 'u5',  module: 'attendance',  screen: 'Student Attendance', action: 'created',    record: 'Class 7-C — 30 May 2026',            details: 'Submitted student attendance for Class 7-C',                                oldValue: '—',                          newValue: 'Present: 30 · Absent: 1 · Late: 0' },

  /* ── 2026-05-29 ── */
  { id: 'L0024', date: '2026-05-29', time: '05:15 PM', userId: 'u8',  module: 'fee',         screen: 'Fee Reports',       action: 'downloaded', record: 'May 2026 Defaulters Report',         details: 'Downloaded fee defaulters report for May 2026',                            oldValue: '—',                          newValue: 'Format: Excel · 38 defaulters' },
  { id: 'L0025', date: '2026-05-29', time: '04:30 PM', userId: 'u9',  module: 'admissions',  screen: 'Enrollment',        action: 'created',    record: 'STU-0240 — Aisha Khan',              details: 'Enrolled new student into Grade 6-B for June 2026 session',                oldValue: '—',                          newValue: 'Grade: 6-B · Roll: 18' },
  { id: 'L0026', date: '2026-05-29', time: '04:05 PM', userId: 'u4',  module: 'papers',      screen: 'Generate Papers',   action: 'created',    record: 'Paper — Maths Grade 9 Mid-Term',     details: 'Generated Maths Grade 9 mid-term paper (50 marks · 90 mins)',              oldValue: '—',                          newValue: 'Questions: 18 · Difficulty: Mixed' },
  { id: 'L0027', date: '2026-05-29', time: '03:40 PM', userId: 'u4',  module: 'papers',      screen: 'Generate Papers',   action: 'printed',    record: 'Paper — Maths Grade 9 Mid-Term',     details: 'Printed Maths Grade 9 mid-term paper (45 copies)',                         oldValue: '—',                          newValue: 'Copies: 45' },
  { id: 'L0028', date: '2026-05-29', time: '02:15 PM', userId: 'u1',  module: 'appraisals',  screen: 'Appraisal Setup',   action: 'updated',    record: 'Q3 2026 Appraisal Setup',            details: 'Updated KPI weightage for Q3 2026 staff appraisal cycle',                  oldValue: 'Lesson Quality: 25%',         newValue: 'Lesson Quality: 30%' },
  { id: 'L0029', date: '2026-05-29', time: '01:30 PM', userId: 'u2',  module: 'students',    screen: 'Active Students',   action: 'viewed',     record: 'Student STU-0188 — Daniyal Mir',     details: 'Viewed student profile',                                                    oldValue: '—',                          newValue: '—' },
  { id: 'L0030', date: '2026-05-29', time: '12:20 PM', userId: 'u10', module: 'academics',   screen: 'Scheme of Studies', action: 'updated',    record: 'Grade 8 Science Scheme',             details: 'Updated Grade 8 Science scheme of studies for Term 3',                     oldValue: 'Chapters: 8',                 newValue: 'Chapters: 9' },
  { id: 'L0031', date: '2026-05-29', time: '11:00 AM', userId: 'u8',  module: 'accounts',    screen: 'Statements',        action: 'printed',    record: 'Bank Reconciliation — Apr 2026',     details: 'Printed bank reconciliation statement for April 2026',                     oldValue: '—',                          newValue: 'Pages: 2' },

  /* ── 2026-05-28 ── */
  { id: 'L0032', date: '2026-05-28', time: '04:45 PM', userId: 'u3',  module: 'hr',          screen: 'Advances & Loans',  action: 'approved',   record: 'Loan Request LR-2026-007 — EMP-015', details: 'Approved staff loan request for Zara Hussain',                             oldValue: 'Status: Pending',             newValue: 'Status: Approved · PKR 75,000' },
  { id: 'L0033', date: '2026-05-28', time: '03:25 PM', userId: 'u1',  module: 'settings',    screen: 'Academic Sessions', action: 'created',    record: 'Session 2026-27',                    details: 'Created new academic session — runs Aug 2026 to May 2027',                 oldValue: '—',                          newValue: 'Start: 01 Aug 2026 · End: 31 May 2027' },
  { id: 'L0034', date: '2026-05-28', time: '02:50 PM', userId: 'u6',  module: 'admissions',  screen: 'Inquiries',         action: 'updated',    record: 'Inquiry #INQ-2026-0218',             details: 'Updated inquiry follow-up notes',                                          oldValue: 'Status: New',                 newValue: 'Status: Contacted' },
  { id: 'L0035', date: '2026-05-28', time: '01:15 PM', userId: 'u7',  module: 'inventory',   screen: 'Assets & POS',      action: 'created',    record: 'Asset AST-0089 — Smart Board',        details: 'Added new asset record for Smart Board (Grade 6 lab)',                     oldValue: '—',                          newValue: 'Cost: PKR 145,000 · Vendor: Tech Bazaar' },
  { id: 'L0036', date: '2026-05-28', time: '11:45 AM', userId: 'u5',  module: 'academics',   screen: 'Homework Diary',    action: 'created',    record: 'Homework — Class 8-A Maths',         details: 'Posted homework diary entry for 28 May 2026',                              oldValue: '—',                          newValue: 'Subject: Maths · Due: 30 May' },
  { id: 'L0037', date: '2026-05-28', time: '10:30 AM', userId: 'u4',  module: 'trainings',   screen: 'View Trainings',    action: 'viewed',     record: 'Bloom\'s Taxonomy Workshop',         details: 'Watched recorded training session',                                        oldValue: '—',                          newValue: 'Watch time: 38 min' },
  { id: 'L0038', date: '2026-05-28', time: '09:50 AM', userId: 'u8',  module: 'fee',         screen: 'Generate Challans', action: 'created',    record: 'June 2026 Challan Batch',            details: 'Generated June 2026 fee challan batch (612 students)',                     oldValue: '—',                          newValue: 'Total: PKR 11,340,000 · 612 challans' },

  /* ── 2026-05-27 ── */
  { id: 'L0039', date: '2026-05-27', time: '05:00 PM', userId: 'u1',  module: 'permissions', screen: 'Manage Roles',      action: 'permission', record: 'Role — Coordinator',                  details: 'Updated Coordinator role permissions — added Reports module access',       oldValue: 'Modules: 7',                  newValue: 'Modules: 8' },
  { id: 'L0040', date: '2026-05-27', time: '04:15 PM', userId: 'u2',  module: 'examination', screen: 'Result Reports',    action: 'downloaded', record: 'Mid-Term Result Sheet — Grade 7',    details: 'Downloaded Mid-Term result sheet for Grade 7',                             oldValue: '—',                          newValue: 'Format: PDF · 3 sections' },
  { id: 'L0041', date: '2026-05-27', time: '03:30 PM', userId: 'u9',  module: 'admissions',  screen: 'CRM Reports',       action: 'viewed',     record: 'May 2026 Conversion Report',         details: 'Viewed conversion funnel report',                                          oldValue: '—',                          newValue: '—' },
  { id: 'L0042', date: '2026-05-27', time: '02:00 PM', userId: 'u10', module: 'timetable',   screen: 'View Timetable',    action: 'printed',    record: 'Class 7-A Timetable',                details: 'Printed Class 7-A weekly timetable',                                       oldValue: '—',                          newValue: 'Copies: 35' },
  { id: 'L0043', date: '2026-05-27', time: '11:25 AM', userId: 'u3',  module: 'hr',          screen: 'Task Assignment',   action: 'assigned',   record: 'Task — Submit June Roster',           details: 'Assigned roster submission task to Amna Tariq',                            oldValue: 'Assignee: —',                 newValue: 'Assignee: Amna Tariq · Due: 30 May' },
  { id: 'L0044', date: '2026-05-27', time: '10:10 AM', userId: 'u4',  module: 'permissions', screen: 'Audit Logs',        action: 'login',      record: 'Session — Web',                       details: 'User signed in via web browser',                                            oldValue: '—',                          newValue: 'IP: 192.168.10.45 · Web' },

  /* ── 2026-05-26 ── */
  { id: 'L0045', date: '2026-05-26', time: '05:20 PM', userId: 'u8',  module: 'fee',         screen: 'Discount Manager',  action: 'created',    record: 'Sibling Discount Policy',            details: 'Created sibling discount policy — 15% off for 2nd child',                  oldValue: '—',                          newValue: 'Type: Sibling · Discount: 15%' },
  { id: 'L0046', date: '2026-05-26', time: '04:00 PM', userId: 'u1',  module: 'examination', screen: 'Exam Setup',        action: 'created',    record: 'Final Term 2026 — Grade 10',          details: 'Created Final Term exam configuration for Grade 10',                       oldValue: '—',                          newValue: 'Subjects: 8 · Duration: 3 hr' },
  { id: 'L0047', date: '2026-05-26', time: '02:35 PM', userId: 'u5',  module: 'academics',   screen: 'Lesson Plans',      action: 'updated',    record: 'Week 20 — Science, Grade 8',         details: 'Updated Week 20 lesson plan — added practical activity',                    oldValue: 'Activities: 2',               newValue: 'Activities: 3' },
  { id: 'L0048', date: '2026-05-26', time: '01:20 PM', userId: 'u7',  module: 'inventory',   screen: 'Inventory Items',   action: 'deleted',    record: 'Item INV-198 — Old Posters',          details: 'Deleted obsolete inventory item record',                                    oldValue: 'Stock: 0',                    newValue: 'Removed from catalogue' },
  { id: 'L0049', date: '2026-05-26', time: '11:55 AM', userId: 'u2',  module: 'students',    screen: 'ID Cards',          action: 'printed',    record: 'ID Cards Batch — Grade 6',            details: 'Printed ID cards for Grade 6 (95 cards)',                                  oldValue: '—',                          newValue: 'Copies: 95' },

  /* ── 2026-05-25 ── */
  { id: 'L0050', date: '2026-05-25', time: '04:30 PM', userId: 'u3',  module: 'hr',          screen: 'Departments',       action: 'updated',    record: 'Department — Junior School',         details: 'Updated department head + member count',                                    oldValue: 'Head: —',                     newValue: 'Head: Ms. Sarah Noor' },
  { id: 'L0051', date: '2026-05-25', time: '03:10 PM', userId: 'u4',  module: 'sops',        screen: 'View Manuals',      action: 'viewed',     record: 'Classroom Management Manual',        details: 'Viewed Classroom Management SOP',                                          oldValue: '—',                          newValue: 'Pages read: 24 of 32' },
  { id: 'L0052', date: '2026-05-25', time: '02:20 PM', userId: 'u9',  module: 'admissions',  screen: 'Inquiries',         action: 'created',    record: 'Inquiry #INQ-2026-0215',             details: 'Created admission inquiry (referral)',                                     oldValue: '—',                          newValue: 'Source: Referral · Status: New' },
  { id: 'L0053', date: '2026-05-25', time: '01:45 PM', userId: 'u10', module: 'attendance',  screen: 'Staff Attendance',  action: 'approved',   record: 'Staff Attendance — Week 21',         details: 'Approved staff attendance for week 21',                                    oldValue: 'Status: Pending',             newValue: 'Status: Approved' },
  { id: 'L0054', date: '2026-05-25', time: '11:30 AM', userId: 'u1',  module: 'launch',      screen: 'Setup Wizard',      action: 'updated',    record: 'Branding — Logo + Header',           details: 'Updated school logo and header colours in Launch Setup',                   oldValue: 'Primary: #1E40AF',            newValue: 'Primary: #1E3A8A' },

  /* ── 2026-05-24 ── */
  { id: 'L0055', date: '2026-05-24', time: '04:50 PM', userId: 'u6',  module: 'admissions',  screen: 'Inquiries',         action: 'updated',    record: 'Inquiry #INQ-2026-0210',             details: 'Updated inquiry — moved to Visit Scheduled',                                oldValue: 'Status: Contacted',           newValue: 'Status: Visit Scheduled' },
  { id: 'L0056', date: '2026-05-24', time: '03:15 PM', userId: 'u8',  module: 'fee',         screen: 'Receive Fee',       action: 'created',    record: 'Receipt #FR-2026-1018',              details: 'Recorded fee payment for STU-0156 (Grade 9-A)',                            oldValue: '—',                          newValue: 'Amount: PKR 22,000 · Online' },
  { id: 'L0057', date: '2026-05-24', time: '01:30 PM', userId: 'u4',  module: 'academics',   screen: 'Lesson Plans',      action: 'created',    record: 'Week 21 — English, Grade 9',         details: 'Created Week 21 Lesson Plan for English (Grade 9)',                        oldValue: '—',                          newValue: 'Topic: Persuasive Writing · Submitted' },
  { id: 'L0058', date: '2026-05-24', time: '11:10 AM', userId: 'u5',  module: 'attendance',  screen: 'Student Attendance', action: 'updated',    record: 'Class 7-B — 24 May 2026',            details: 'Corrected attendance record — STU-0177 marked late instead of absent',     oldValue: 'STU-0177: Absent',            newValue: 'STU-0177: Late' },

  /* ── 2026-05-23 ── */
  { id: 'L0059', date: '2026-05-23', time: '04:00 PM', userId: 'u2',  module: 'examination', screen: 'Results',           action: 'updated',    record: 'Mid-Term Result — STU-0145',         details: 'Updated re-checked Physics marks for STU-0145',                            oldValue: 'Physics: 64',                 newValue: 'Physics: 71' },
  { id: 'L0060', date: '2026-05-23', time: '02:45 PM', userId: 'u3',  module: 'hr',          screen: 'Employee Management', action: 'created', record: 'Employee EMP-051 — Bilal Saleem',    details: 'Onboarded new teaching staff — Math Department',                            oldValue: '—',                          newValue: 'Designation: Math Teacher · Dept: Junior School' },
  { id: 'L0061', date: '2026-05-23', time: '01:10 PM', userId: 'u7',  module: 'inventory',   screen: 'Inventory Items',   action: 'updated',    record: 'Item INV-211 — A4 Paper Reams',      details: 'Updated stock after delivery from vendor',                                  oldValue: 'Stock: 18 reams',             newValue: 'Stock: 60 reams' },
  { id: 'L0062', date: '2026-05-23', time: '10:30 AM', userId: 'u10', module: 'sops',        screen: 'Watch Tutorials',   action: 'viewed',     record: 'Tutorial — Lesson Planning Best Practice', details: 'Watched lesson planning tutorial video',                              oldValue: '—',                          newValue: 'Watch time: 22 min' },

  /* ── 2026-05-22 ── */
  { id: 'L0063', date: '2026-05-22', time: '04:25 PM', userId: 'u8',  module: 'accounts',    screen: 'Financial Reports', action: 'viewed',     record: 'YTD P&L Statement',                  details: 'Viewed YTD profit and loss statement',                                     oldValue: '—',                          newValue: '—' },
  { id: 'L0064', date: '2026-05-22', time: '02:55 PM', userId: 'u1',  module: 'permissions', screen: 'Permission Groups', action: 'created',    record: 'Group — Examination Management',      details: 'Created new permission group — Examination Management',                    oldValue: '—',                          newValue: 'Modules: 2 · Members: 6' },
  { id: 'L0065', date: '2026-05-22', time: '01:30 PM', userId: 'u4',  module: 'attendance',  screen: 'Attendance Reports', action: 'downloaded', record: 'Monthly Attendance — Grade 9-B',     details: 'Downloaded monthly attendance report for Grade 9-B',                       oldValue: '—',                          newValue: 'Format: PDF · 4 pages' },
  { id: 'L0066', date: '2026-05-22', time: '11:05 AM', userId: 'u9',  module: 'admissions',  screen: 'Enrollment',        action: 'updated',    record: 'STU-0238 — Hina Aslam',              details: 'Updated enrollment status after fee payment',                              oldValue: 'Status: Pending Fee',         newValue: 'Status: Enrolled' },

  /* ── 2026-05-21 ── */
  { id: 'L0067', date: '2026-05-21', time: '05:10 PM', userId: 'u1',  module: 'appraisals',  screen: 'Appraisal Reports', action: 'downloaded', record: 'Q1 2026 Appraisal Summary',          details: 'Downloaded Q1 2026 staff appraisal summary',                               oldValue: '—',                          newValue: 'Format: Excel · 47 staff' },
  { id: 'L0068', date: '2026-05-21', time: '03:35 PM', userId: 'u5',  module: 'papers',      screen: 'Templates',         action: 'updated',    record: 'Template — Science MCQ',             details: 'Updated Science MCQ template — added explanation field',                    oldValue: 'Fields: 4',                   newValue: 'Fields: 5' },
  { id: 'L0069', date: '2026-05-21', time: '02:00 PM', userId: 'u6',  module: 'students',    screen: 'Certificates',      action: 'downloaded', record: 'Bonafide Certificate — STU-0167',    details: 'Downloaded bonafide certificate',                                          oldValue: '—',                          newValue: 'Format: PDF' },
  { id: 'L0070', date: '2026-05-21', time: '10:45 AM', userId: 'u3',  module: 'hr',          screen: 'Payroll & Salary',  action: 'approved',   record: 'April 2026 Payroll',                 details: 'Approved April 2026 payroll for disbursement',                             oldValue: 'Status: Pending Approval',    newValue: 'Status: Approved' },

  /* ── 2026-05-19 ── */
  { id: 'L0071', date: '2026-05-19', time: '04:15 PM', userId: 'u7',  module: 'inventory',   screen: 'Assets & POS',      action: 'updated',    record: 'Asset AST-0042 — Projector',          details: 'Updated asset condition after maintenance',                                 oldValue: 'Condition: Needs Repair',     newValue: 'Condition: Working' },
  { id: 'L0072', date: '2026-05-19', time: '02:40 PM', userId: 'u10', module: 'timetable',   screen: 'Manage Timetable',  action: 'created',    record: 'Class 6-B Timetable',                details: 'Created weekly timetable for Class 6-B',                                   oldValue: '—',                          newValue: '40 periods · 6 days' },
  { id: 'L0073', date: '2026-05-19', time: '12:20 PM', userId: 'u8',  module: 'fee',         screen: 'Fee Reports',       action: 'printed',    record: 'Daily Collection Report — 19 May',   details: 'Printed daily fee collection report',                                      oldValue: '—',                          newValue: 'Total: PKR 248,500 · Pages: 1' },

  /* ── 2026-05-18 ── */
  { id: 'L0074', date: '2026-05-18', time: '04:45 PM', userId: 'u1',  module: 'permissions', screen: 'Manage Users',      action: 'permission', record: 'User — Fatima Noor (EMP-022)',       details: 'Changed role from Teacher to Front Desk',                                  oldValue: 'Role: Teacher',               newValue: 'Role: Front Desk' },
  { id: 'L0075', date: '2026-05-18', time: '03:15 PM', userId: 'u2',  module: 'examination', screen: 'Result Reports',    action: 'printed',    record: 'Mid-Term Result Sheet — Grade 8',    details: 'Printed Mid-Term result sheet for Grade 8',                                oldValue: '—',                          newValue: 'Copies: 90' },
  { id: 'L0076', date: '2026-05-18', time: '01:00 PM', userId: 'u4',  module: 'permissions', screen: 'Audit Logs',        action: 'logout',     record: 'Session — Web',                       details: 'User signed out',                                                          oldValue: '—',                          newValue: 'Session duration: 4 hr 12 min' },

  /* ── 2026-05-15 ── */
  { id: 'L0077', date: '2026-05-15', time: '03:50 PM', userId: 'u3',  module: 'hr',          screen: 'HR Letters',        action: 'downloaded', record: 'Appointment Letter — EMP-049',       details: 'Downloaded appointment letter for new hire',                               oldValue: '—',                          newValue: 'Format: PDF' },
  { id: 'L0078', date: '2026-05-15', time: '02:30 PM', userId: 'u9',  module: 'admissions',  screen: 'Inquiries',         action: 'deleted',    record: 'Inquiry #INQ-2026-0163',             details: 'Deleted duplicate inquiry record',                                          oldValue: 'Status: New',                 newValue: 'Removed' },
  { id: 'L0079', date: '2026-05-15', time: '11:50 AM', userId: 'u5',  module: 'trainings',   screen: 'View Trainings',    action: 'viewed',     record: 'Differentiated Instruction Workshop', details: 'Watched recorded training session',                                       oldValue: '—',                          newValue: 'Watch time: 45 min' },

  /* ── 2026-05-12 ── */
  { id: 'L0080', date: '2026-05-12', time: '04:30 PM', userId: 'u8',  module: 'fee',         screen: 'Fee Structure',     action: 'created',    record: 'Class 11 Fee Structure',             details: 'Created new fee structure for Class 11 (introduced this session)',         oldValue: '—',                          newValue: 'Tuition: PKR 15,500 · Lab Fee: PKR 2,000' },
  { id: 'L0081', date: '2026-05-12', time: '02:00 PM', userId: 'u1',  module: 'settings',    screen: 'Signature Management', action: 'updated', record: 'Principal Signature',                details: 'Updated principal signature image for letter templates',                    oldValue: 'Uploaded: 12 Feb 2026',       newValue: 'Uploaded: 12 May 2026' },
  { id: 'L0082', date: '2026-05-12', time: '10:15 AM', userId: 'u7',  module: 'permissions', screen: 'Audit Logs',        action: 'login',      record: 'Session — Web',                       details: 'User signed in via web browser',                                            oldValue: '—',                          newValue: 'IP: 192.168.10.51 · Web' },

  /* ── 2026-05-08 ── */
  { id: 'L0083', date: '2026-05-08', time: '04:00 PM', userId: 'u10', module: 'academics',   screen: 'Scheme of Studies', action: 'approved',   record: 'Grade 7 English Scheme',             details: 'Approved Grade 7 English scheme of studies for Term 3',                    oldValue: 'Status: Pending',             newValue: 'Status: Approved' },
  { id: 'L0084', date: '2026-05-08', time: '01:25 PM', userId: 'u3',  module: 'hr',          screen: 'Task Assignment',   action: 'created',    record: 'Task — Conduct Parent Meetings',     details: 'Created task — schedule parent-teacher meetings for May',                   oldValue: '—',                          newValue: 'Due: 20 May · Assignees: 6 teachers' },
  { id: 'L0085', date: '2026-05-03', time: '11:00 AM', userId: 'u1',  module: 'launch',      screen: 'Setup Wizard',      action: 'viewed',     record: 'Launch Setup Wizard',                details: 'Reviewed Launch Setup wizard progress',                                    oldValue: '—',                          newValue: 'Completion: 100%' },
];

/* ─── Hydrate a log entry with user, role, module label, action label,
       tone, and placeholders for IP / Device. The raw seed only stores
       ids and a couple of strings — this helper denormalises them at
       render time so the table / modal / report can use the labels
       directly. */
export function hydrateLog(log) {
  const user      = findUser(log.userId);
  const module    = findModule(log.module);
  const actionObj = findAction(log.action);
  return {
    ...log,
    userName:   user?.name || '—',
    userRole:   user?.role || '—',
    userEmail:  user?.email || '',
    moduleLabel: module?.label || log.module,
    moduleIcon:  module?.icon || 'fa-circle',
    actionLabel: actionObj?.label || log.action,
    actionTone:  actionObj?.tone  || 'gray',
    ipAddress:  log.ipAddress  || '—',
    device:     log.device     || '—',
  };
}

/* ─── Pure filter — every clause is optional. The order matches the
       filter bar (most-specific first to short-circuit early). */
export function filterLogs(logs, f = {}) {
  return logs.filter(l => {
    if (f.fromDate && l.date < f.fromDate) return false;
    if (f.toDate   && l.date > f.toDate)   return false;
    if (f.module   && l.module !== f.module)   return false;
    if (f.user     && l.userId !== f.user)     return false;
    if (f.action   && l.action !== f.action)   return false;
    if (f.search) {
      const needle = f.search.toLowerCase();
      const hay = [
        l.record, l.details, l.screen, l.action, l.module,
        findUser(l.userId)?.name, findUser(l.userId)?.role,
      ].join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

/* ─── Stat helpers used by the summary cards. */
export function isoToday() {
  const d = new Date('2026-05-31T00:00:00');   /* fixed clock for the demo */
  return d.toISOString().slice(0, 10);
}
export function isoDaysAgo(n) {
  const d = new Date('2026-05-31T00:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function summaryStats(logs) {
  const today        = isoToday();
  const weekAgo      = isoDaysAgo(6);          /* incl. today → last 7 days */
  const monthFirst   = today.slice(0, 7) + '-01';

  const todayLogs    = logs.filter(l => l.date === today);
  const weekLogs     = logs.filter(l => l.date >= weekAgo);
  const monthLogs    = logs.filter(l => l.date >= monthFirst);

  const activeToday  = new Set(todayLogs.map(l => l.userId)).size;
  return {
    today:        todayLogs.length,
    week:         weekLogs.length,
    month:        monthLogs.length,
    total:        logs.length,
    activeToday,
  };
}

/* ─── Quick-range presets used by the filter bar pills. Each returns
       { fromDate, toDate } strings in YYYY-MM-DD. */
export function quickRange(preset) {
  const today = isoToday();
  switch (preset) {
    case 'today':     return { fromDate: today,            toDate: today };
    case 'yesterday': return { fromDate: isoDaysAgo(1),    toDate: isoDaysAgo(1) };
    case 'last7':     return { fromDate: isoDaysAgo(6),    toDate: today };
    case 'last30':    return { fromDate: isoDaysAgo(29),   toDate: today };
    case 'thisMonth': return { fromDate: today.slice(0,7) + '-01', toDate: today };
    default:          return { fromDate: '',               toDate: '' };
  }
}

/* ─── Format YYYY-MM-DD → "31 May 2026". */
export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

/* ─── Report aggregator — group logs by user or module for reports. */
export function aggregateByUser(logs) {
  const map = new Map();
  logs.forEach(l => {
    const k = l.userId;
    if (!map.has(k)) {
      const u = findUser(l.userId);
      map.set(k, { user: u, total: 0, byAction: {} });
    }
    const row = map.get(k);
    row.total += 1;
    row.byAction[l.action] = (row.byAction[l.action] || 0) + 1;
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}
export function aggregateByModule(logs) {
  const map = new Map();
  logs.forEach(l => {
    const k = l.module;
    if (!map.has(k)) {
      const m = findModule(l.module);
      map.set(k, { module: m, total: 0, byAction: {} });
    }
    const row = map.get(k);
    row.total += 1;
    row.byAction[l.action] = (row.byAction[l.action] || 0) + 1;
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/* ─── Pure initials helper for user avatars. */
export function initialsOf(name) {
  if (!name) return '?';
  const clean = name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./g, '').trim();
  return clean.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}
