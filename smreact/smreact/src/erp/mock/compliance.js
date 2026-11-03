/* ═══════════════════════════════════════════════════════════════════
   SCHOOL COMPLIANCE — checklist templates, generated instances, and
   problem tracking.

   TEMPLATES are the configurable checklist definitions a school can
   turn on/off, reassign, or reschedule from Compliance Setup — the
   daily/weekly/monthly item wording below matches the brief exactly.
   INSTANCES are one real occurrence of a template for a given date
   (daily), week (weekly) or month (monthly) — these are what Daily
   Checks / Weekly Checks / Monthly Review actually display and let a
   user update. Instances are generated deterministically (not
   Math.random, so nothing changes between reloads) from the real
   templates and the real staff identities already established
   elsewhere in this app (the 5 Academics teachers, the ERP admin
   users, and the 2 new Security/Support Staff employees added to
   src/mock/hr.js alongside this file) — not fabricated numbers.

   Nothing here is persisted to a backend — this is a frontend
   prototype. See src/services/complianceService.js for the one
   module-level in-memory store every page reads/writes through, so
   a real API can replace it later without touching any page.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Dashboard-level areas (the 6 "Compliance by Area" buckets) ─── */
export const COMPLIANCE_AREAS = [
  { id: 'academics',     label: 'Academics',              icon: 'fa-book-open-reader' },
  { id: 'cleanliness',   label: 'Cleanliness & Hygiene',   icon: 'fa-pump-soap' },
  { id: 'staff',         label: 'Staff & Attendance',      icon: 'fa-users' },
  { id: 'facilities',    label: 'Building & Facilities',   icon: 'fa-building' },
  { id: 'safety',        label: 'Safety & Security',       icon: 'fa-shield-halved' },
  { id: 'administration',label: 'Administration',          icon: 'fa-folder-open' },
];

/* ─── Assignable roles — mapped to real staff identities at
   generation time (see ROLE_STAFF below), not invented floating
   names. ─── */
const ROLES = {
  PRINCIPAL: 'Principal',
  VP: 'Vice Principal',
  ADMIN: 'Admin Officer',
  TEACHER: 'Teacher',
  SECURITY: 'Security Guard',
  SUPPORT: 'Support Staff',
  ACCOUNTANT: 'Accountant',
};

/* Real names behind each role — reused from identities already
   established elsewhere in this app:
   Principal/VP/Admin Officer/Accountant: the ERP admin users
   (src/pages/AuditLogs/auditLogsData.js's USERS / mobileAppLogsData.js's
   ADMIN_APP_USERS). Teacher: the 5 real Academics teachers
   (src/mock/lessonPlans.js). Security/Support: the 2 new HR employees
   added alongside this file (src/mock/hr.js). */
export const ROLES_LIST = Object.values(ROLES);

export const ROLE_STAFF = {
  [ROLES.PRINCIPAL]:  ['Dr. Islahudin'],
  [ROLES.VP]:         ['Mr. Ahmed Khan'],
  [ROLES.ADMIN]:      ['Ms. Sarah Noor'],
  [ROLES.ACCOUNTANT]: ['Ms. Sarah Noor'],
  [ROLES.TEACHER]:    ['Mr. Ahmed Ali', 'Ms. Fatima Noor', 'Mr. Usman Raza', 'Ms. Ayesha Khan', 'Mr. Bilal Hassan'],
  [ROLES.SECURITY]:   ['Mr. Zahid Mehmood'],
  [ROLES.SUPPORT]:    ['Mr. Rashid Pervez'],
};

/* ─── DAILY CHECKS — 8 areas, worded exactly as specified ─── */
const DAILY_GROUPS = [
  { area: 'opening', areaLabel: 'School Opening', dashArea: 'administration', role: ROLES.ADMIN, items: [
    'School opened on time.',
    'Main gate and entrance checked.',
    'Security staff present.',
    'Teachers and other staff attendance checked.',
    "Absent teachers' substitute arrangements confirmed.",
    'Classrooms and offices ready before students arrive.',
    'Water and electricity supply checked.',
  ] },
  { area: 'assembly', areaLabel: 'Assembly', dashArea: 'academics', role: ROLES.TEACHER, items: [
    'Morning assembly conducted on time.',
    'Students stood in their designated lines.',
    'Attendance or class participation checked as applicable.',
    'National anthem and other planned activities completed.',
    'Students moved to classrooms in an orderly manner.',
  ] },
  { area: 'classrooms', areaLabel: 'Classrooms & Academics', dashArea: 'academics', role: ROLES.TEACHER, items: [
    'Teachers entered their classrooms on time.',
    'Lessons started according to the timetable.',
    'Lesson plans followed.',
    'Classroom boards and teaching materials ready.',
    'Student notebooks checked according to the assigned schedule.',
    'Student diaries checked and homework recorded.',
    'Homework and classwork completion reviewed.',
    'Classrooms clean, organized, and adequately ventilated.',
  ] },
  { area: 'cleanliness', areaLabel: 'Cleanliness & Drinking Water', dashArea: 'cleanliness', role: ROLES.SUPPORT, items: [
    'Washrooms clean and usable.',
    "Washrooms checked at the school's scheduled inspection times.",
    'Drinking water available.',
    'Water dispensers and drinking points clean.',
    'Soap available at handwashing points.',
    'Corridors and stairs clean and free from obstructions.',
    'Dustbins emptied when required.',
    'Waste disposed of properly.',
  ] },
  { area: 'playground', areaLabel: 'Playground & Student Safety', dashArea: 'safety', role: ROLES.SECURITY, items: [
    'Playground checked before student use.',
    'Play equipment appears safe.',
    'Students supervised during breaks.',
    'Staircases, corridors, and emergency exits clear.',
    'Any accident, injury, or safety concern reported.',
  ] },
  { area: 'admin_staff', areaLabel: 'Administration & Staff', dashArea: 'staff', role: ROLES.ADMIN, items: [
    'Staff attendance records completed.',
    'Visitor register maintained where applicable.',
    'Parent complaints and urgent messages reviewed.',
    'Required registers and daily records updated.',
    'Assigned staff duties completed or reported as pending.',
  ] },
  { area: 'labs', areaLabel: 'Labs, Equipment & Facilities', dashArea: 'facilities', role: ROLES.SUPPORT, items: [
    'Computer lab checked when in use.',
    'Science laboratory checked when in use.',
    'Furniture and classroom equipment checked for visible damage.',
    'Lights, fans, ACs, and other equipment checked as required.',
    'Maintenance issues reported and assigned.',
  ] },
  { area: 'closing', areaLabel: 'School Closing', dashArea: 'administration', role: ROLES.SECURITY, items: [
    'Student dismissal completed safely.',
    'School transport departure checked where applicable.',
    'Classrooms and offices inspected.',
    'Lights, fans, ACs, computers, and other appliances switched off where appropriate.',
    'Water taps checked.',
    'Windows, doors, cupboards, and gates secured.',
    'Laboratories and restricted rooms locked.',
    'Final security check completed.',
  ] },
];

/* ─── WEEKLY CHECKS — worded exactly as specified ─── */
const WEEKLY_ITEMS = [
  { label: 'Review teacher punctuality and attendance.',             dashArea: 'staff',      role: ROLES.PRINCIPAL },
  { label: 'Review lesson-plan implementation.',                     dashArea: 'academics',  role: ROLES.VP },
  { label: 'Review notebook and diary checking.',                    dashArea: 'academics',  role: ROLES.VP },
  { label: 'Observe selected classrooms.',                           dashArea: 'academics',  role: ROLES.PRINCIPAL },
  { label: 'Review repeated student absences.',                      dashArea: 'staff',      role: ROLES.ADMIN },
  { label: 'Review student discipline and unresolved parent complaints.', dashArea: 'administration', role: ROLES.PRINCIPAL },
  { label: 'Inspect furniture and damaged equipment.',                dashArea: 'facilities', role: ROLES.SUPPORT },
  { label: 'Check school supplies and cleaning materials.',           dashArea: 'cleanliness',role: ROLES.SUPPORT },
  { label: 'Review pending maintenance requests.',                    dashArea: 'facilities', role: ROLES.ADMIN },
  { label: 'Inspect playground and laboratory safety.',               dashArea: 'safety',     role: ROLES.SECURITY },
  { label: 'Review outstanding daily compliance tasks.',              dashArea: 'administration', role: ROLES.PRINCIPAL },
];

/* ─── MONTHLY REVIEW — 6 categories, worded exactly as specified ─── */
const MONTHLY_GROUPS = [
  { category: 'staff', categoryLabel: 'Staff Planning & Review', dashArea: 'staff', role: ROLES.PRINCIPAL, items: [
    'Review staff attendance and punctuality.',
    'Review teacher performance and responsibilities.',
    'Identify training needs.',
    'Review staff workload and substitute arrangements.',
    "Prepare the next month's staff duty plan.",
  ] },
  { category: 'academic', categoryLabel: 'Academic Review', dashArea: 'academics', role: ROLES.VP, items: [
    'Review syllabus completion.',
    'Review test and examination results.',
    'Identify students needing additional academic support.',
    'Review lesson plans and classroom observations.',
    "Prepare the next month's academic priorities.",
  ] },
  { category: 'meetings', categoryLabel: 'Meetings', dashArea: 'administration', role: ROLES.PRINCIPAL, items: [
    'Conduct the monthly staff meeting.',
    'Record meeting date and attendees.',
    'Record important discussion points.',
    'Assign action items and deadlines.',
    'Review previous meeting action items.',
  ] },
  { category: 'building', categoryLabel: 'Building & Safety', dashArea: 'safety', role: ROLES.ADMIN, items: [
    'Review building maintenance issues.',
    'Inspect furniture and equipment.',
    'Review fire extinguishers and emergency arrangements.',
    'Check emergency contact lists.',
    'Review water-quality testing and maintenance records according to schedule.',
  ] },
  { category: 'records', categoryLabel: 'Administration & Records', dashArea: 'administration', role: ROLES.ADMIN, items: [
    'Review student attendance trends.',
    'Review admissions and required school records.',
    'Review transport documents where applicable.',
    'Review complaints and unresolved issues.',
    'Review stock and inventory records.',
  ] },
  { category: 'finance', categoryLabel: 'Finance & Resources', dashArea: 'administration', role: ROLES.ACCOUNTANT, items: [
    'Review fee collection reports where the user has permission.',
    'Review school expenses and resource requirements.',
    'Review cleaning and stationery supplies.',
    'Record damaged or missing school assets.',
  ] },
];

/* ─── Deterministic hash — same convention used by
   src/mock/teacherPerformanceExtras.js, so starting assignment is
   varied but never random (never changes between reloads). Declared
   above the template arrays below because each template now gets one
   specific, named person assigned at setup time, not a role resolved
   later — see this file's header note on `assignedStaff`. ─── */
function detHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function pick(arr, seed) { return arr[seed % arr.length]; }

/* Every real staff member who can be assigned a task, for Compliance
   Setup's "Assigned To" dropdown and every page's "Assigned Staff"
   filter. */
export const ALL_STAFF = [...new Set(Object.values(ROLE_STAFF).flat())];

/* Max length for a checklist item's task text. The 91 built-in items
   below are all well under this (the longest is ~85 characters) — the
   limit exists for items a school adds itself from Compliance Setup,
   so a long sentence can never overflow a checklist row or a mobile
   card. Exported so the Setup form and its character counter use the
   exact same number. */
export const TASK_LABEL_MAX_LENGTH = 120;

/* Area/category pickers for "Add New Checklist Item" in Compliance
   Setup — same ids and dashArea mapping as the built-in groups above,
   so a school-added item groups and filters exactly like a built-in
   one. Weekly has no sub-areas of its own (see WEEKLY_ITEMS), so a
   new weekly item is grouped straight into one of the 6 dashboard
   areas instead — see COMPLIANCE_AREAS. */
export const DAILY_AREA_OPTIONS = DAILY_GROUPS.map(g => ({ id: g.area, label: g.areaLabel, dashArea: g.dashArea }));
export const MONTHLY_CATEGORY_OPTIONS = MONTHLY_GROUPS.map(g => ({ id: g.category, label: g.categoryLabel, dashArea: g.dashArea }));

/* ─── Flatten into template arrays ───
   Compliance Setup assigns tasks to a specific person (`assignedStaff`),
   not a role — so each template starts with one real name picked from
   the task's natural role group (e.g. a Classrooms task starts with
   one of the 5 real teachers), and that name is what Setup lets a
   school change. `defaultRole` is kept only as a label showing which
   kind of staff member a task is meant for, shown next to the picker
   in Setup; it no longer drives assignment itself. */
export const DAILY_TEMPLATES = DAILY_GROUPS.flatMap((g, gi) => g.items.map((label, i) => {
  const id = `D-${g.area}-${i + 1}`;
  return {
    id,
    frequency: 'daily',
    area: g.area,
    areaLabel: g.areaLabel,
    dashArea: g.dashArea,
    label,
    order: gi * 100 + i,
    defaultRole: g.role,
    assignedStaff: pick(ROLE_STAFF[g.role] || ['Dr. Islahudin'], detHash(id)),
    evidenceAllowed: true,
    verificationRequired: /safety|security|accident|injury/i.test(label),
    active: true,
    custom: false,
  };
}));

export const WEEKLY_TEMPLATES = WEEKLY_ITEMS.map((w, i) => {
  const id = `W-${i + 1}`;
  return {
    id,
    frequency: 'weekly',
    area: 'weekly',
    areaLabel: 'Weekly Review',
    dashArea: w.dashArea,
    label: w.label,
    order: i,
    defaultRole: w.role,
    assignedStaff: pick(ROLE_STAFF[w.role] || ['Dr. Islahudin'], detHash(id)),
    dueDay: 'Friday',
    evidenceAllowed: true,
    verificationRequired: false,
    active: true,
    custom: false,
  };
});

export const MONTHLY_TEMPLATES = MONTHLY_GROUPS.flatMap((g, gi) => g.items.map((label, i) => {
  const id = `M-${g.category}-${i + 1}`;
  return {
    id,
    frequency: 'monthly',
    area: g.category,
    areaLabel: g.categoryLabel,
    dashArea: g.dashArea,
    label,
    order: gi * 100 + i,
    defaultRole: g.role,
    assignedStaff: pick(ROLE_STAFF[g.role] || ['Dr. Islahudin'], detHash(id)),
    evidenceAllowed: g.category !== 'finance',
    verificationRequired: g.category === 'building' || g.category === 'meetings',
    active: true,
    restrictedToPermission: g.category === 'finance' ? 'cmp.finance' : null,
    custom: false,
  };
}));

export const STATUS = {
  NOT_CHECKED: 'not_checked',
  COMPLETED: 'completed',
  ISSUE_FOUND: 'issue_found',
  NOT_APPLICABLE: 'not_applicable',
};
export const STATUS_META = {
  [STATUS.NOT_CHECKED]:    { label: 'Not Checked',    tone: 'gray'  },
  [STATUS.COMPLETED]:      { label: 'Completed',      tone: 'green' },
  [STATUS.ISSUE_FOUND]:    { label: 'Issue Found',    tone: 'red'   },
  [STATUS.NOT_APPLICABLE]: { label: 'Not Applicable', tone: 'gray'  },
};

/* Generates a deterministic status for one template on one date —
   ~68% Completed, ~18% Not Checked (including "overdue" once the due
   time has passed), ~10% Issue Found, ~4% Not Applicable. A fixed
   demo "today" (see complianceService.js's TODAY_ISO) keeps this
   reproducible, same convention as every other mock-data generator
   in this app. */
function statusFor(templateId, periodKey) {
  const h = detHash(`${templateId}|${periodKey}`);
  const r = h % 100;
  if (r < 68) return STATUS.COMPLETED;
  if (r < 86) return STATUS.NOT_CHECKED;
  if (r < 96) return STATUS.ISSUE_FOUND;
  return STATUS.NOT_APPLICABLE;
}

const ISSUE_REMARKS = {
  cleanliness: 'Washroom needs cleaning before next break.',
  playground: 'Swing chain looks worn — needs inspection.',
  labs: 'One classroom fan is not working.',
  classrooms: 'Notebook checking is behind schedule for this class.',
  admin_staff: 'Visitor register not updated since yesterday.',
  closing: 'A classroom door lock needs replacement.',
  opening: 'Water supply was low this morning.',
  assembly: 'PA system was not working during assembly.',
};

/* Builds the real instances for a given set of templates + period
   label (e.g. a date for daily, an ISO week for weekly, a "YYYY-MM"
   for monthly). dueOffset shifts a few items into the past so
   "Overdue" has real examples to show. */
export function generateInstances(templates, periodKey, { dueIso } = {}) {
  return templates.filter(t => t.active).map(t => {
    const status = statusFor(t.id, periodKey);
    /* assignedTo now comes straight from the template's own
       assignedStaff (a specific person set in Compliance Setup), not
       re-picked from a role pool here. */
    const assignedTo = t.assignedStaff || 'Dr. Islahudin';
    const remark = status === STATUS.ISSUE_FOUND ? (ISSUE_REMARKS[t.area] || 'Issue noted during inspection.') : '';
    return {
      id: `I-${t.id}-${periodKey}`,
      templateId: t.id,
      frequency: t.frequency,
      area: t.area,
      areaLabel: t.areaLabel,
      dashArea: t.dashArea,
      label: t.label,
      periodKey,
      dueIso: dueIso || null,
      assignedTo,
      status,
      remark,
      evidence: null,
      verificationRequired: t.verificationRequired,
      verifiedBy: t.verificationRequired && status === STATUS.COMPLETED && detHash(`${t.id}|verify`) % 3 !== 0 ? 'Dr. Islahudin' : null,
      updatedAt: null,
    };
  });
}

/* ─── Problems & Follow-ups — real lifecycle records with activity
   history, some linked to an Issue Found daily instance, some
   reported independently (matching the brief's own example list). ─── */
export const PROBLEM_CATEGORIES = ['Cleanliness', 'Facilities', 'Safety', 'Staff', 'Academics', 'Administration'];
export const PROBLEM_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const PROBLEM_STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Verified and Closed'];

export const COMPLIANCE_PROBLEMS = [
  {
    id: 'P-0001', title: 'Washroom requires cleaning', description: 'Boys washroom near Block A was left unclean after morning break.',
    category: 'Cleanliness', location: 'Block A Washroom', priority: 'Medium',
    reportedBy: 'Ms. Fatima Noor', assignedTo: 'Mr. Rashid Pervez',
    reportDate: '2026-05-28', dueDate: '2026-05-28', status: 'Verified and Closed',
    photo: null, resolutionRemarks: 'Cleaned and re-inspected same day.',
    history: [
      { date: '2026-05-28T08:40:00', by: 'Ms. Fatima Noor', action: 'Reported the problem.' },
      { date: '2026-05-28T08:55:00', by: 'Dr. Islahudin', action: 'Assigned to Mr. Rashid Pervez.' },
      { date: '2026-05-28T10:10:00', by: 'Mr. Rashid Pervez', action: 'Marked In Progress.' },
      { date: '2026-05-28T11:00:00', by: 'Mr. Rashid Pervez', action: 'Marked Resolved — cleaned and restocked.' },
      { date: '2026-05-28T14:30:00', by: 'Dr. Islahudin', action: 'Verified and closed.' },
    ],
  },
  {
    id: 'P-0002', title: 'Drinking water is unavailable', description: 'Water dispenser on the 2nd floor corridor is empty.',
    category: 'Cleanliness', location: '2nd Floor Corridor', priority: 'High',
    reportedBy: 'Mr. Usman Raza', assignedTo: 'Mr. Rashid Pervez',
    reportDate: '2026-05-29', dueDate: '2026-05-29', status: 'Resolved',
    photo: null, resolutionRemarks: 'Refilled and checked other floors too.',
    history: [
      { date: '2026-05-29T09:15:00', by: 'Mr. Usman Raza', action: 'Reported the problem.' },
      { date: '2026-05-29T09:20:00', by: 'Dr. Islahudin', action: 'Assigned to Mr. Rashid Pervez.' },
      { date: '2026-05-29T09:50:00', by: 'Mr. Rashid Pervez', action: 'Marked Resolved — refilled dispenser.' },
    ],
  },
  {
    id: 'P-0003', title: 'Classroom fan is not working', description: 'Ceiling fan in Class VII room is not turning on.',
    category: 'Facilities', location: 'Class VII Room', priority: 'Medium',
    reportedBy: 'Mr. Usman Raza', assignedTo: 'Mr. Rashid Pervez',
    reportDate: '2026-05-30', dueDate: '2026-06-02', status: 'In Progress',
    photo: null, resolutionRemarks: '',
    history: [
      { date: '2026-05-30T11:05:00', by: 'Mr. Usman Raza', action: 'Reported the problem.' },
      { date: '2026-05-30T13:00:00', by: 'Dr. Islahudin', action: 'Assigned to Mr. Rashid Pervez.' },
      { date: '2026-05-31T09:00:00', by: 'Mr. Rashid Pervez', action: 'Marked In Progress — electrician called.' },
    ],
  },
  {
    id: 'P-0004', title: 'Teacher attendance issue', description: 'Repeated late arrival noted for a Class IV teacher this week.',
    category: 'Staff', location: 'Class IV', priority: 'Medium',
    reportedBy: 'Dr. Islahudin', assignedTo: 'Mr. Ahmed Khan',
    reportDate: '2026-05-27', dueDate: '2026-06-01', status: 'Assigned',
    photo: null, resolutionRemarks: '',
    history: [
      { date: '2026-05-27T08:30:00', by: 'Dr. Islahudin', action: 'Reported the problem.' },
      { date: '2026-05-27T08:35:00', by: 'Dr. Islahudin', action: 'Assigned to Mr. Ahmed Khan for follow-up.' },
    ],
  },
  {
    id: 'P-0005', title: 'Student notebook checking is overdue', description: 'Notebook checking for Class VI English is 2 weeks behind schedule.',
    category: 'Academics', location: 'Class VI', priority: 'Medium',
    reportedBy: 'Mr. Ahmed Khan', assignedTo: 'Ms. Fatima Noor',
    reportDate: '2026-05-26', dueDate: '2026-05-30', status: 'Open',
    photo: null, resolutionRemarks: '',
    history: [
      { date: '2026-05-26T12:00:00', by: 'Mr. Ahmed Khan', action: 'Reported the problem.' },
    ],
  },
  {
    id: 'P-0006', title: 'Playground equipment needs repair', description: 'One swing chain is worn and needs inspection before further use.',
    category: 'Safety', location: 'Main Playground', priority: 'High',
    reportedBy: 'Mr. Zahid Mehmood', assignedTo: 'Mr. Rashid Pervez',
    reportDate: '2026-05-31', dueDate: '2026-06-02', status: 'Open',
    photo: null, resolutionRemarks: '',
    history: [
      { date: '2026-05-31T07:45:00', by: 'Mr. Zahid Mehmood', action: 'Reported the problem.' },
    ],
  },
  {
    id: 'P-0007', title: 'A door lock needs replacement', description: 'Computer lab door lock is loose and does not secure properly at closing.',
    category: 'Safety', location: 'Computer Lab', priority: 'Critical',
    reportedBy: 'Mr. Zahid Mehmood', assignedTo: 'Mr. Ahmed Khan',
    reportDate: '2026-05-31', dueDate: '2026-06-01', status: 'Assigned',
    photo: null, resolutionRemarks: '',
    history: [
      { date: '2026-05-31T15:10:00', by: 'Mr. Zahid Mehmood', action: 'Reported the problem.' },
      { date: '2026-05-31T15:30:00', by: 'Dr. Islahudin', action: 'Assigned to Mr. Ahmed Khan — marked Critical, same-day follow-up required.' },
    ],
  },
  {
    id: 'P-0008', title: 'Visitor register not updated', description: 'Front desk visitor register has not been filled in since yesterday.',
    category: 'Administration', location: 'Front Desk', priority: 'Low',
    reportedBy: 'Ms. Sarah Noor', assignedTo: 'Ms. Sarah Noor',
    reportDate: '2026-05-30', dueDate: '2026-05-31', status: 'Resolved',
    photo: null, resolutionRemarks: 'Register updated and reminder given to front desk.',
    history: [
      { date: '2026-05-30T16:00:00', by: 'Ms. Sarah Noor', action: 'Reported the problem.' },
      { date: '2026-05-31T08:10:00', by: 'Ms. Sarah Noor', action: 'Marked Resolved — register updated.' },
    ],
  },
];
