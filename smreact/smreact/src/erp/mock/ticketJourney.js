/* ═══════════════════════════════════════════════════════════════════
   MY TICKETS — demo data (frontend only)

   IMPORTANT: these records are deliberately in the INTERNAL Tech Module
   shape (the same field names the Super Admin repo uses in
   src/superadmin/techTicketsData.js: stage, reportedAt, assignedAt,
   fixedAt, communicatedAt, closedAt, …) — NOT the shape the school
   sees. ticketJourneyService.toSchoolTicket() converts each one into
   the school-safe DTO, exactly the way the .NET backend must.

   That way a backend developer can read one file and see:
     • every internal state a ticket can be in, and
     • what the school is (and is NOT) allowed to see for it.

   Scenarios covered (one ticket each):
     IMP-0231  Just reported — not yet scheduled            → received
     BUG-1044  Reported yesterday — not yet assigned         → received
     BUG-1041  Assigned to a developer in Sprint 24         → in_sprint
     BUG-1037  Developer finished, QA testing now           → testing
     BUG-1033  QA REJECTED, back with developer             → testing  (school never sees the rejection)
     IMP-0224  QA approved, waiting for next release        → approved
     BUG-1019  Released 5 days ago (unseen update)          → released
     IMP-0198  Released 3 weeks ago                         → released
     BUG-1002  Released 6 weeks ago (two QA rounds)         → released
     BUG-1040  Head-office internal ticket                  → HIDDEN (source is internal)
     BUG-1038  Ticket of ANOTHER school                     → HIDDEN (different schoolId)

   expectedDays = the expected time to release that Customer Support
   enters in Super Admin when assigning the developer (Tech Module →
   Assign). BUG-1033 is deliberately past its expected date.

   Times are relative to "now" so the demo always looks current.
   ═══════════════════════════════════════════════════════════════════ */

const H = 60 * 60 * 1000, D = 24 * H;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

/* The logged-in school. In production this comes from the JWT
   (SchoolId claim) — the frontend never sends it as a parameter. */
export const CURRENT_SCHOOL = {
  id: 'sch-oxford-lahore',
  name: 'The Oxford System',
  branch: 'Lahore Campus',
};

/* Sprints as the Tech team plans them. If the backend has no sprint
   entity yet, return sprint: null — the UI then says "development queue". */
const SPRINT_22 = { id: 'spr-22', name: 'Sprint 22', startsAt: ago(44 * D), endsAt: ago(30 * D) };
const SPRINT_23 = { id: 'spr-23', name: 'Sprint 23', startsAt: ago(26 * D), endsAt: ago(12 * D) };
const SPRINT_24 = { id: 'spr-24', name: 'Sprint 24', startsAt: ago(9 * D),  endsAt: ago(-5 * D) };

const OXFORD = { id: CURRENT_SCHOOL.id, name: CURRENT_SCHOOL.name, branch: CURRENT_SCHOOL.branch };

/* activity[].visibleToSchool — ONLY entries flagged true are ever sent to
   the school (as "updates from the School Mentor team"). Everything else
   (developer names, QA rejections, internal notes) stays internal. */
export const mockInternalTickets = [
  /* ── 1. Just reported ─────────────────────────────────────────── */
  {
    id: 't-231', ticketNumber: 'IMP-0231', type: 'improvement', source: 'customer_support',
    title: 'Class-wise fee defaulter summary on the Dashboard',
    description: 'At the start of every month our accounts team builds the list of fee defaulters by hand from the Fee module, class by class, and then shares it with the class teachers.\n\nIt would help a lot if the Dashboard showed a small summary card with the number of defaulters and the outstanding amount for each class, with a click-through to the full list.',
    expectedBehaviour: 'A Dashboard card shows defaulters and outstanding amount per class for the current month. Clicking a class opens its defaulter list in the Fee module.',
    actualBehaviour: 'We have to open the Fee module, filter each class one by one and add up the totals manually.',
    module: 'fee', school: OXFORD, reportedByName: 'Mrs. Nadia Hussain (Accounts)',
    stage: 'bugs_new_dev', assignedTo: null, sprint: null,
    reportedAt: ago(3 * H), assignedAt: null, firstSentToQaAt: null, fixedAt: null, communicatedAt: null, closedAt: null,
    releaseNotes: '', lastSchoolViewedAt: null,
    activity: [
      { event: 'Reported', person: 'Tariq Ahmed', at: ago(3 * H) },
      { event: 'Support reply', person: 'Tariq Ahmed', at: ago(2 * H + 40 * 60 * 1000), visibleToSchool: true,
        note: 'Thank you for the suggestion! We have shared it with our product team and will update you here once it is planned.' },
    ],
  },

  /* ── 1b. Also just reported — logged a day ago, still waiting to be
         assigned to a developer / planned into a sprint. No support
         note yet, so the school only sees the "Reported" step done. ── */
  {
    id: 't-1044', ticketNumber: 'BUG-1044', type: 'bug', source: 'customer_support',
    title: 'Teacher names cut off on printed timetable',
    description: 'On the printed class timetable, long teacher names are cut off after about 12 letters, so teachers with similar names cannot be told apart.',
    stepsToReproduce: ['Open Time Table → Class Timetable.', 'Select Class 9-A and click Print.'],
    expectedBehaviour: 'The full teacher name is shown, wrapping onto a second line if needed.',
    actualBehaviour: 'Names are cut off, e.g. "Muhammad Abdu…".',
    module: 'timetable', school: OXFORD, reportedByName: 'Mr. Kashif Raza (Coordinator)',
    stage: 'bugs_new_dev', assignedTo: null, sprint: null,
    reportedAt: ago(1 * D + 4 * H), assignedAt: null, firstSentToQaAt: null, fixedAt: null, communicatedAt: null, closedAt: null,
    releaseNotes: '', lastSchoolViewedAt: ago(20 * H),
    activity: [
      { event: 'Reported', person: 'Sara Ali', at: ago(1 * D + 4 * H) },
    ],
  },

  /* ── 2. In sprint — developer working on it ───────────────────── */
  {
    id: 't-1041', ticketNumber: 'BUG-1041', type: 'bug', source: 'customer_support',
    title: 'Attendance report counts half-day as full absent',
    description: 'In the monthly attendance report, students marked "Half Day" are counted as absent for the whole day, so the percentage comes out lower than it should.',
    stepsToReproduce: ['Mark a student as Half Day on any date.', 'Open Attendance → Reports → Monthly Attendance.', 'Check that student’s attendance percentage for the month.'],
    expectedBehaviour: 'A half day counts as 0.5 day present.',
    actualBehaviour: 'A half day counts as a full day absent.',
    module: 'attendance', school: OXFORD, reportedByName: 'Mr. Kashif Raza (Coordinator)',
    stage: 'in_progress', assignedTo: { id: 'dev-sara', name: 'Sara Ali' }, sprint: SPRINT_24,
    reportedAt: ago(3 * D + 5 * H), assignedAt: ago(2 * D + 20 * H), expectedDays: 7, firstSentToQaAt: null, fixedAt: null, communicatedAt: null, closedAt: null,
    releaseNotes: '', lastSchoolViewedAt: ago(1 * D),
    activity: [
      { event: 'Reported', person: 'Sana Malik', at: ago(3 * D + 5 * H) },
      { event: 'Assigned to Sara Ali — moved to In Progress', person: 'Super Admin', at: ago(2 * D + 20 * H) },
      { event: 'Developer note', person: 'Sara Ali', at: ago(1 * D + 2 * H), note: 'Root cause found in the half-day weightage.' }, // internal only
    ],
  },

  /* ── 3. Development done — QA testing ─────────────────────────── */
  {
    id: 't-1037', ticketNumber: 'BUG-1037', type: 'bug', source: 'customer_support',
    title: 'Result card shows wrong position when two students tie',
    description: 'When two students get the same total marks, the result card gives one of them position 2 and the other position 3 instead of both getting position 2.',
    stepsToReproduce: ['Enter marks so that two students in Class 7-B have the same total.', 'Generate result cards for Class 7-B.'],
    expectedBehaviour: 'Both students get position 2 and the next student gets position 4.',
    actualBehaviour: 'One student gets position 2 and the other gets position 3.',
    module: 'examination', school: OXFORD, reportedByName: 'Ms. Ayesha Tariq (Exam Cell)',
    stage: 'qa_review', assignedTo: { id: 'dev-ahmed', name: 'Ahmed Khan' }, sprint: SPRINT_24,
    reportedAt: ago(6 * D + 2 * H), assignedAt: ago(5 * D + 22 * H), expectedDays: 10, firstSentToQaAt: ago(7 * H), fixedAt: ago(7 * H), communicatedAt: null, closedAt: null,
    releaseNotes: '', lastSchoolViewedAt: ago(2 * D),
    activity: [
      { event: 'Reported', person: 'Tariq Ahmed', at: ago(6 * D + 2 * H) },
      { event: 'Assigned to Ahmed Khan — moved to In Progress', person: 'Super Admin', at: ago(5 * D + 22 * H) },
      { event: 'Developer Testing Report submitted', person: 'Ahmed Khan', at: ago(7 * H + 10 * 60 * 1000) },
      { event: 'Sent for QA Testing', person: 'Ahmed Khan', at: ago(7 * H) },
    ],
  },

  /* ── 4. QA rejected → back with developer.
         Internally stage is 'in_progress' again, but because it has
         already been through development once (firstSentToQaAt is set)
         the school keeps seeing "Under testing". We never show a
         rejection or a step going backwards to the customer. ───────── */
  {
    id: 't-1033', ticketNumber: 'BUG-1033', type: 'bug', source: 'school_direct',
    title: 'Staff salary slip PDF cuts off allowances column',
    description: 'When a staff member has more than 4 allowances, the salary slip PDF cuts off the last column and the net salary is not visible.\n\nThis affects our senior teachers and coordinators, who usually have house rent, conveyance, medical, utility, a subject allowance and sometimes an extra-duty allowance. Because the net salary column is cut off, staff come to the accounts office every month asking for their exact salary, and we have to read it out from the payroll screen.\n\nWe tried printing in landscape and on legal-size paper. Landscape shows one more column but the net salary is still missing when there are 6 allowances. Legal size works but our printers only have A4 paper loaded.\n\nThis started after the payroll update last month. Before that, the slip moved the allowances into a second row when there were too many of them.',
    stepsToReproduce: ['Open Human Resource → Payroll → Salary Slips.', 'Select a staff member with 5 or more allowances (e.g. Mr. Adnan, Senior Teacher).', 'Click Download PDF and open it.', 'Print it on A4 paper.'],
    expectedBehaviour: 'All allowances, deductions and the net salary fit on one A4 page.',
    actualBehaviour: 'The right side of the table is cut off and the net salary column is not visible.',
    module: 'hr', school: OXFORD, reportedByName: 'Mr. Faisal Iqbal (Admin)',
    stage: 'in_progress', assignedTo: { id: 'dev-bilal', name: 'Bilal Ahmed' }, sprint: SPRINT_24,
    reportedAt: ago(8 * D + 4 * H), assignedAt: ago(7 * D + 1 * H), expectedDays: 7, firstSentToQaAt: ago(3 * D + 6 * H), fixedAt: ago(3 * D + 6 * H), communicatedAt: null, closedAt: null,
    releaseNotes: '', lastSchoolViewedAt: ago(3 * D),
    activity: [
      { event: 'Reported', person: 'Head Office', at: ago(8 * D + 4 * H) },
      { event: 'Assigned to Bilal Ahmed — moved to In Progress', person: 'Super Admin', at: ago(7 * D + 1 * H) },
      { event: 'Sent for QA Testing', person: 'Bilal Ahmed', at: ago(3 * D + 6 * H) },
      { event: 'Rejected by QA — returned to developer', person: 'QA Team', at: ago(1 * D + 9 * H),
        note: 'Still cut off with 6 allowances on A4.' }, // internal — school must NOT see
      { event: 'Support update', person: 'Tariq Ahmed', at: ago(1 * D + 8 * H), visibleToSchool: true,
        note: 'Our quality team is double-checking this with staff who have many allowances, so the fix works for everyone.' },
    ],
  },

  /* ── 5. QA approved — waiting for release ─────────────────────── */
  {
    id: 't-224', ticketNumber: 'IMP-0224', type: 'improvement', source: 'customer_support',
    title: 'Auto SMS to parents of absent students',
    description: 'We would like the system to automatically send an SMS to parents when their child is marked absent, instead of our staff sending it manually every morning.',
    expectedBehaviour: 'As soon as attendance is submitted, parents of absent students get an SMS with the date and class.',
    actualBehaviour: 'Our front desk sends the messages one by one every morning.',
    module: 'attendance', school: OXFORD, reportedByName: 'Mrs. Rubina Akhtar (Principal)',
    stage: 'ready_for_release', assignedTo: { id: 'dev-usman', name: 'Usman Tariq' }, sprint: SPRINT_23,
    reportedAt: ago(24 * D), assignedAt: ago(22 * D), expectedDays: 25, firstSentToQaAt: ago(4 * D), fixedAt: ago(4 * D), communicatedAt: ago(11 * H), closedAt: null,
    releaseNotes: '', lastSchoolViewedAt: ago(2 * D),
    activity: [
      { event: 'Reported', person: 'Sara Ali', at: ago(24 * D) },
      { event: 'Assigned to Usman Tariq — moved to In Progress', person: 'Super Admin', at: ago(22 * D) },
      { event: 'Sent for QA Testing', person: 'Usman Tariq', at: ago(4 * D) },
      { event: 'Approved by QA — Ready for Release', person: 'QA Team', at: ago(11 * H) },
    ],
  },

  /* ── 6. Released recently — school hasn't opened it yet ───────── */
  {
    id: 't-1019', ticketNumber: 'BUG-1019', type: 'bug', source: 'customer_support',
    title: 'Fee challan printing previous month as due month',
    description: 'Challans generated on the 1st of the month still show the previous month as the due month.',
    stepsToReproduce: ['On the 1st of any month, open Fee → Generate Challan.', 'Generate challans for any class and print one.'],
    expectedBehaviour: 'The challan shows the current month as the due month.',
    actualBehaviour: 'The challan shows the previous month.',
    module: 'fee', school: OXFORD, reportedByName: 'Mrs. Nadia Hussain (Accounts)',
    stage: 'released', assignedTo: { id: 'dev-ahmed', name: 'Ahmed Khan' }, sprint: SPRINT_23,
    reportedAt: ago(16 * D + 3 * H), assignedAt: ago(15 * D + 6 * H), expectedDays: 14, firstSentToQaAt: ago(10 * D), fixedAt: ago(10 * D), communicatedAt: ago(7 * D), closedAt: ago(5 * D + 2 * H),
    releaseNotes: 'Challans generated on the first day of a month now always show the correct due month. Already-generated challans were corrected automatically.',
    lastSchoolViewedAt: ago(8 * D),
    activity: [
      { event: 'Reported', person: 'Tariq Ahmed', at: ago(16 * D + 3 * H) },
      { event: 'Assigned to Ahmed Khan — moved to In Progress', person: 'Super Admin', at: ago(15 * D + 6 * H) },
      { event: 'Sent for QA Testing', person: 'Ahmed Khan', at: ago(10 * D) },
      { event: 'Approved by QA — Ready for Release', person: 'QA Team', at: ago(7 * D) },
      { event: 'Released', person: 'Super Admin', at: ago(5 * D + 2 * H) },
    ],
  },

  /* ── 7. Released improvement ──────────────────────────────────── */
  {
    id: 't-198', ticketNumber: 'IMP-0198', type: 'improvement', source: 'customer_support',
    title: 'Dark mode for the ERP',
    description: 'Our staff work late during result season. A dark theme would be much easier on the eyes.',
    module: 'general', school: OXFORD, reportedByName: 'Mr. Kashif Raza (Coordinator)',
    stage: 'released', assignedTo: { id: 'dev-sara', name: 'Sara Ali' }, sprint: SPRINT_22,
    reportedAt: ago(52 * D), assignedAt: ago(43 * D), expectedDays: 21, firstSentToQaAt: ago(31 * D), fixedAt: ago(31 * D), communicatedAt: ago(26 * D), closedAt: ago(21 * D),
    releaseNotes: 'You can now switch the ERP to dark mode from the moon icon in the top bar. Your choice is remembered on this device.',
    lastSchoolViewedAt: ago(20 * D),
    activity: [
      { event: 'Reported', person: 'Sara Ali', at: ago(52 * D) },
      { event: 'Assigned to Sara Ali — moved to In Progress', person: 'Super Admin', at: ago(43 * D) },
      { event: 'Sent for QA Testing', person: 'Sara Ali', at: ago(31 * D) },
      { event: 'Approved by QA — Ready for Release', person: 'QA Team', at: ago(26 * D) },
      { event: 'Released', person: 'Super Admin', at: ago(21 * D) },
    ],
  },

  /* ── 8. Released after two QA rounds ─────────────────────────────
         Development Complete date = FIRST time it reached QA (36 days
         ago), not the second submission — see firstSentToQaAt. ─────── */
  {
    id: 't-1002', ticketNumber: 'BUG-1002', type: 'bug', source: 'customer_support',
    title: 'Student ID card photo stretched',
    description: 'Student photos on the printed ID card look stretched sideways.',
    stepsToReproduce: ['Open Students → ID Cards.', 'Print the card of a student whose photo was taken on a mobile phone.'],
    expectedBehaviour: 'The photo keeps its proportions.',
    actualBehaviour: 'The photo is stretched to fill the frame.',
    module: 'students', school: OXFORD, reportedByName: 'Mr. Faisal Iqbal (Admin)',
    stage: 'released', assignedTo: { id: 'dev-bilal', name: 'Bilal Ahmed' }, sprint: SPRINT_22,
    reportedAt: ago(45 * D), assignedAt: ago(42 * D), expectedDays: 10, firstSentToQaAt: ago(36 * D), fixedAt: ago(33 * D), communicatedAt: ago(32 * D), closedAt: ago(30 * D),
    releaseNotes: 'Photos on student ID cards now keep their original proportions and are centred in the frame.',
    lastSchoolViewedAt: ago(29 * D),
    activity: [
      { event: 'Reported', person: 'Tariq Ahmed', at: ago(45 * D) },
      { event: 'Assigned to Bilal Ahmed — moved to In Progress', person: 'Super Admin', at: ago(42 * D) },
      { event: 'Sent for QA Testing', person: 'Bilal Ahmed', at: ago(36 * D) },
      { event: 'Rejected by QA — returned to developer', person: 'QA Team', at: ago(35 * D) },
      { event: 'Sent for QA Testing', person: 'Bilal Ahmed', at: ago(33 * D) },
      { event: 'Approved by QA — Ready for Release', person: 'QA Team', at: ago(32 * D) },
      { event: 'Released', person: 'Super Admin', at: ago(30 * D) },
    ],
  },

  /* ── 9. HIDDEN — created internally by Head Office (Tech Module
         "New ticket"). Not something this school reported. ─────────── */
  {
    id: 't-1040', ticketNumber: 'BUG-1040', type: 'bug', source: 'head_office_internal',
    title: 'Slow query on fee defaulters report',
    description: 'Internal performance ticket.',
    module: 'fee', school: OXFORD, reportedByName: 'Head Office',
    stage: 'in_progress', assignedTo: { id: 'dev-usman', name: 'Usman Tariq' }, sprint: SPRINT_24,
    reportedAt: ago(2 * D), assignedAt: ago(2 * D), expectedDays: 5, firstSentToQaAt: null, fixedAt: null, communicatedAt: null, closedAt: null,
    releaseNotes: '', lastSchoolViewedAt: null, activity: [],
  },

  /* ── 10. HIDDEN — belongs to a different school. ──────────────── */
  {
    id: 't-1038', ticketNumber: 'BUG-1038', type: 'bug', source: 'customer_support',
    title: 'Timetable clash warning not showing',
    description: 'Another school’s ticket.',
    module: 'timetable', school: { id: 'sch-beacon', name: 'Beacon House', branch: 'Gulberg Campus' }, reportedByName: 'Ms. Ayesha Raza',
    stage: 'qa_review', assignedTo: { id: 'dev-sara', name: 'Sara Ali' }, sprint: SPRINT_24,
    reportedAt: ago(5 * D), assignedAt: ago(4 * D), expectedDays: 4, firstSentToQaAt: ago(1 * D), fixedAt: ago(1 * D), communicatedAt: null, closedAt: null,
    releaseNotes: '', lastSchoolViewedAt: null, activity: [],
  },
];
