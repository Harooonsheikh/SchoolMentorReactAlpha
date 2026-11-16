/* ═══════════════════════════════════════════════════════════════════
   TECH MODULE — demo data + helpers (frontend only)

   Seed data + pure helper functions for the Tech Module (formerly "Tech
   Tickets"). Mirrors the shape a real .NET backend would return (see
   api/services/techTickets.js + api/endpoints.js EP.techTickets). UI
   components must not import this file directly — go through the
   service layer.

   MIGRATION NOTE: the module used to run on a single linear `status`
   (reported→assigned→in_progress→fixed→communicated→closed). It now
   runs on a 4-stage `stage` (bugs_new_dev→in_progress→qa_review→
   ready_for_release→released) with mandatory developer/QA sign-off
   steps in between. `status`/`STATUS_FLOW`/`priority` are kept — never
   deleted, still computed — purely so existing consumers that read
   them (Dashboard.jsx's Bug Intelligence card, in particular) keep
   working unchanged; every NEW ticket action also updates `status` via
   STAGE_TO_LEGACY_STATUS so Dashboard's counts stay meaningful for
   tickets created under the new flow too. Priority is no longer
   surfaced anywhere in the UI, but the field/value is never stripped
   off existing records.

   Developer names match the existing DEVELOPERS list already used by
   the Bug/New-Development creation form, so a ticket created from
   Support always resolves to a developer the Tech Module already knows
   about.
   ═══════════════════════════════════════════════════════════════════ */

export const DEVELOPERS = [
  { id: 'dev-ahmed',  name: 'Ahmed Khan',  role: 'Senior Developer' },
  { id: 'dev-bilal',  name: 'Bilal Ahmed', role: 'Developer' },
  { id: 'dev-sara',   name: 'Sara Ali',    role: 'Developer' },
  { id: 'dev-usman',  name: 'Usman Tariq', role: 'Senior Developer' },
];
export const DEVELOPER_NAMES = DEVELOPERS.map((d) => d.name);
const devByName = (name) => DEVELOPERS.find((d) => d.name === name) || null;
const devById = (id) => DEVELOPERS.find((d) => d.id === id) || null;

/* isTestSchool: true — every one of these is a demo/internal test
   account (several even carry login credentials for reproducing an
   issue). "Real member schools" are sourced separately by SchoolPicker
   (see techModule/SchoolPicker.jsx) from statusData.js and tagged
   isTestSchool:false there. */
export const SCHOOLS = [
  { id: 'sch-daffodil', name: 'Daffodil Schools',            branch: 'Tarnol Campus',  contact: 'Dr. Asif Khan',    phone: '0300-1234567', loginId: 'daffodil.admin',  password: 'Daff@2026!', isTestSchool: true },
  { id: 'sch-citygram', name: 'City Grammar School',         branch: 'North Campus',   contact: 'Mr. Imran Yousaf', phone: '0301-2233445', loginId: 'citygrammar.adm', password: 'CityGS#912', isTestSchool: true },
  { id: 'sch-beacon',   name: 'Beacon House',                branch: 'Gulberg Campus', contact: 'Ms. Ayesha Raza',  phone: '0302-3344556', isTestSchool: true },
  { id: 'sch-mps',      name: 'MPS School System',           branch: 'Main Branch',    contact: 'Mr. Bilal Ahmed',  phone: '0303-4455667', loginId: 'mps.principal',  password: 'MpsSys!775', isTestSchool: true },
  { id: 'sch-spirit',   name: 'The Spirit School',           branch: 'Main Campus',    contact: 'Mrs. Hina Pervaiz', phone: '0304-5566778', isTestSchool: true },
  { id: 'sch-smart',    name: 'Smart School',                branch: 'City Campus',    contact: 'Mr. Kamran Akmal', phone: '0305-6677889', isTestSchool: true },
  { id: 'sch-concept',  name: 'Concept School',               branch: 'North Campus',   contact: 'Ms. Sana Mir',     phone: '0306-7788990', isTestSchool: true },
  { id: 'sch-aes',      name: 'AES School System',            branch: 'Main Branch',    contact: 'AES Admin',        phone: '0300-1234001', loginId: 'aes.admin',      password: 'AesSch@88', isTestSchool: true },
  { id: 'sch-creative', name: 'The Creative School',          branch: 'Main Campus',    contact: 'Creative Admin',   phone: '0311-2233445', isTestSchool: true },
  { id: 'sch-cityjohar',name: 'The City School Johar Town',   branch: 'Johar Town',     contact: 'Sana Malik',       phone: '0332-1122334', isTestSchool: true },
];
const schoolByName = (name) => SCHOOLS.find((s) => s.name === name);
const schoolById = (id) => SCHOOLS.find((s) => s.id === id);

/* ─── Legacy status (kept, inert for display, still computed for
   Dashboard.jsx's existing Bug Intelligence card) ────────────────── */
export const STATUS_FLOW = ['reported', 'assigned', 'in_progress', 'fixed', 'communicated', 'closed'];
export const STATUS_LABEL = {
  reported: 'Reported', assigned: 'Assigned', in_progress: 'In Progress',
  fixed: 'Fixed', communicated: 'Communicated to School', closed: 'Closed',
};
export const STATUS_BADGE = {
  reported:     { cls: 'tt-b-slate',  icon: 'fa-inbox' },
  assigned:     { cls: 'tt-b-blue',   icon: 'fa-user-check' },
  in_progress:  { cls: 'tt-b-amber',  icon: 'fa-spinner' },
  fixed:        { cls: 'tt-b-teal',   icon: 'fa-circle-check' },
  communicated: { cls: 'tt-b-purple', icon: 'fa-comment-dots' },
  closed:       { cls: 'tt-b-green',  icon: 'fa-box-archive' },
};

/* Priority — retained on the data model only; not read by any new UI. */
export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
export const PRIORITY_BADGE = {
  low:      { cls: 'tt-b-green' },
  medium:   { cls: 'tt-b-amber' },
  high:     { cls: 'tt-b-red' },
  critical: { cls: 'tt-b-critical' },
};

export const TYPE_LABEL = { bug: 'Bug', improvement: 'New Development' };
export const TYPE_BADGE = {
  bug:         { cls: 'tt-b-red',    icon: 'fa-bug' },
  improvement: { cls: 'tt-b-purple', icon: 'fa-code-branch' },
};

/* Where a ticket originated — shown throughout the Tech Module so a
   developer/QA reviewer immediately knows the reporting context. */
export const SOURCE_LABEL = {
  customer_support:    'Customer Support',
  head_office_internal: 'Head Office / Internal',
  school_direct:        'School Direct',
  development_team:     'Development Team',
};
export const SOURCE_BADGE = {
  customer_support:     { cls: 'tt-b-blue',   icon: 'fa-headset' },
  head_office_internal: { cls: 'tt-b-purple', icon: 'fa-building' },
  school_direct:        { cls: 'tt-b-teal',   icon: 'fa-school' },
  development_team:     { cls: 'tt-b-slate',  icon: 'fa-code' },
};

/* ─── New 4-stage flow ────────────────────────────────────────────── */
export const STAGE_FLOW = ['bugs_new_dev', 'in_progress', 'qa_review', 'ready_for_release', 'released'];
export const STAGE_LABEL = {
  bugs_new_dev:      'Bugs & New Development',
  in_progress:       'In Progress',
  qa_review:         'Review & Testing (QA)',
  ready_for_release: 'Ready for Release',
  released:          'Released',
};
export const STAGE_BADGE = {
  bugs_new_dev:      { cls: 'tt-b-slate',  icon: 'fa-inbox' },
  in_progress:       { cls: 'tt-b-amber',  icon: 'fa-spinner' },
  qa_review:         { cls: 'tt-b-purple', icon: 'fa-vial-circle-check' },
  ready_for_release: { cls: 'tt-b-teal',   icon: 'fa-box-open' },
  released:          { cls: 'tt-b-green',  icon: 'fa-circle-check' },
};

/* Legacy status → new stage, used once at load to migrate every
   existing mock ticket without losing anything (legacyStatus is kept
   on the record so the mapping is always visible/auditable). */
export const LEGACY_STAGE_MAP = {
  reported: 'bugs_new_dev', assigned: 'bugs_new_dev', in_progress: 'in_progress',
  fixed: 'qa_review', communicated: 'ready_for_release', closed: 'released',
};
/* New stage → legacy status, kept in sync going forward so
   Dashboard.jsx's existing byStatus-driven counts stay meaningful for
   tickets created/advanced under the new flow too. */
const STAGE_TO_LEGACY_STATUS = {
  bugs_new_dev: 'reported', in_progress: 'in_progress', qa_review: 'fixed',
  ready_for_release: 'communicated', released: 'closed',
};

const STAGE_TIMESTAMP_FIELD = {
  in_progress: 'startedAt', qa_review: 'fixedAt', ready_for_release: 'communicatedAt', released: 'closedAt',
};

/* Relative-time seed helper — always looks "current" regardless of when
   the demo is opened, instead of baking in a stale hardcoded date. */
const H = 60 * 60 * 1000, D = 24 * H;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function ticket(partial) {
  const school = schoolByName(partial.schoolName);
  const assignedTo = partial.assignedTo ? devByName(partial.assignedTo) : null;
  return {
    id: partial.id,
    ticketNumber: partial.ticketNumber,
    type: partial.type, // 'bug' | 'improvement' — see TYPE_LABEL for the "New Development" display rename
    title: partial.title,
    description: partial.description,
    priority: partial.priority, // retained, unused by new UI
    status: partial.status,     // legacy, retained for Dashboard
    stage: null,                 // stamped by migrateTicket()
    legacyStatus: null,
    platform: partial.platform || null,       // 'mobile' | 'erp' | 'chain_school'
    subPlatform: partial.subPlatform || null, // mobile only
    module: partial.module || null,
    source: partial.source || 'customer_support', // see SOURCE_LABEL — defaults so every existing/Support-created ticket keeps working unchanged
    expectedBehaviour: partial.expectedBehaviour || '',
    actualBehaviour: partial.actualBehaviour || '',
    school: school
      ? { id: school.id, name: school.name, branch: school.branch, contact: school.contact, phone: school.phone, loginId: school.loginId, password: school.password, isTestSchool: school.isTestSchool !== false }
      : { id: 'sch-unknown', name: partial.schoolName, isTestSchool: true },
    supportConversationId: partial.supportConversationId || null,
    reportedBy: { id: 'agent-' + partial.reportedBy.toLowerCase().replace(/\s+/g, '-'), name: partial.reportedBy },
    assignedTo: assignedTo ? { id: assignedTo.id, name: assignedTo.name } : null,
    assignedBy: assignedTo ? { id: 'agent-support-lead', name: 'Support Lead' } : null,
    reportedAt: partial.reportedAt,
    assignedAt: partial.assignedAt || null,
    startedAt: partial.startedAt || null,
    fixedAt: partial.fixedAt || null,
    communicatedAt: partial.communicatedAt || null,
    closedAt: partial.closedAt || null,
    attachments: partial.attachments || [],
    isRecurring: !!partial.isRecurring,
    recurrenceCount: partial.recurrenceCount || 1,
    affectedSchoolsCount: partial.affectedSchoolsCount || 1,
    firstReportedAt: partial.firstReportedAt || partial.reportedAt,
    lastReportedAt: partial.lastReportedAt || partial.reportedAt,
    relatedTicketIds: partial.relatedTicketIds || [],
    activity: partial.activity || [],
    /* Overridable so fully-fleshed mock tickets (see RAW below) can be
       seeded already sitting mid-lifecycle — every real UI action
       (submitDeveloperTestingReport/submitQaReview/releaseTicket) still
       only ever produces this exact same shape going forward. */
    developerTestingReport: partial.developerTestingReport || null,
    qaReview: partial.qaReview || [],
    releaseInfo: partial.releaseInfo || null,
    notifiedSupport: !!partial.notifiedSupport,
    notificationId: partial.notificationId || null,
  };
}

function activityFor(t) {
  const items = [
    { event: 'Reported', person: t.reportedBy.name, personRole: 'Customer Support', at: t.reportedAt },
  ];
  if (t.assignedAt) items.push({ event: `Assigned to ${t.assignedTo?.name || '—'}`, person: t.assignedBy?.name || 'Support Lead', at: t.assignedAt });
  if (t.startedAt) items.push({ event: 'Status changed to In Progress', person: t.assignedTo?.name || '—', at: t.startedAt });
  if (t.fixedAt) items.push({ event: 'Sent for QA Testing', person: t.assignedTo?.name || '—', at: t.fixedAt });
  if (t.communicatedAt) items.push({ event: 'Approved by QA — Ready for Release', person: 'QA Team', at: t.communicatedAt });
  if (t.closedAt) items.push({ event: 'Released', person: 'Super Admin', at: t.closedAt });
  return items;
}

/* A handful of legacy-shaped RAW tickets (below) only set `status` —
   not the full `developerTestingReport` sub-object the new UI reads —
   even though a status of 'fixed'/'communicated'/'closed' means they
   logically already passed the "Send for QA Testing" gate (which
   itself only exists once a report has been submitted, see
   sendForQaTesting below). Without this, QA Review / Ready for Release
   / Released tickets seeded that way would show no Developer Testing
   Report anywhere (the QA Review card, TicketDetailModal's own
   section, everywhere) — plausible but entirely missing test evidence
   for a ticket that's supposedly already been tested. Synthesized only
   as a fallback; any RAW ticket that supplies its own
   developerTestingReport (the fully hand-authored showcase tickets)
   keeps it untouched. */
function synthesizeDeveloperTestingReport(t) {
  const submittedBy = t.assignedTo?.name || 'Developer';
  const submittedAt = t.fixedAt || t.startedAt || t.reportedAt;
  return {
    whatImplemented: t.type === 'bug' ? `Fixed the reported issue: ${t.title}.` : `Implemented: ${t.title}.`,
    whatTested: t.type === 'bug'
      ? 'Reproduced the original issue, applied the fix, then re-tested the same steps on the affected school\'s environment.'
      : 'Manually tested the new functionality end to end on the affected school\'s environment.',
    testingResults: t.type === 'bug' ? 'Issue no longer reproduces — confirmed working as expected.' : 'Feature behaves as expected in testing, no issues found.',
    limitations: '',
    attachments: [],
    submittedBy, submittedAt,
  };
}

/* Same gap as the Developer Testing Report above, one stage later: a
   legacy ticket whose status is 'communicated'/'closed' has already
   been QA-approved (that's the only way to reach Ready for Release/
   Released), but with no `qaReview` entry in its RAW seed there's no
   QA comment to show anywhere — the Ready for Release card's "Approved
   by …" line, and TicketDetailModal's "QA Review History" section,
   both silently have nothing to display. */
function synthesizeQaReview(t) {
  const reviewedAt = t.communicatedAt || t.closedAt || t.fixedAt || t.reportedAt;
  return [{
    id: `qa-legacy-${t.id}`,
    decision: 'approved',
    comments: t.type === 'bug'
      ? 'Retested the reported issue on the affected school\'s environment — confirmed fixed, no regressions found. Approved for release.'
      : 'Tested the new functionality end to end — works as expected. Approved for release.',
    attachments: [],
    reviewedBy: 'QA Team',
    reviewedAt,
  }];
}

/* Same gap one stage further still: a 'closed' legacy ticket has
   already been released (that's what 'closed' means), but with no
   `releaseInfo` in its RAW seed, Ready for Release's "Released
   History" list and TicketDetailModal's "Release Information" section
   have nothing to show — release date, dev time, release notes all
   come back blank. Built from the same qaReview (real or just
   synthesized above) so "Approved By"/"Approval Date" line up. */
function synthesizeReleaseInfo(t, qaReview) {
  const lastApproval = [...qaReview].reverse().find((r) => r.decision === 'approved');
  const releasedAt = t.closedAt || t.communicatedAt || t.fixedAt || t.reportedAt;
  const startMs = new Date(t.assignedAt || t.reportedAt).getTime();
  const devTimeDays = Math.max(1, Math.round((new Date(releasedAt).getTime() - startMs) / D));
  return {
    releasedBy: 'Super Admin',
    releasedAt,
    approvedBy: lastApproval?.reviewedBy || 'QA Team',
    approvalDate: lastApproval?.reviewedAt || releasedAt,
    testingComments: lastApproval?.comments || '',
    releaseNotes: t.type === 'bug' ? `Fixed: ${t.title}.` : `Released: ${t.title}.`,
    deploymentComments: '',
    attachments: [],
    devTimeDays,
  };
}

/* Stamps `stage`/`legacyStatus` on a legacy-shaped ticket. Non-destructive:
   every original field (including `status`) survives untouched, except
   `developerTestingReport`/`qaReview`/`releaseInfo` gain the fallbacks
   above when the ticket's own stage implies they must already exist
   but none were provided. */
function migrateTicket(t) {
  const stage = LEGACY_STAGE_MAP[t.status] || 'bugs_new_dev';
  const needsReport = !t.developerTestingReport && ['qa_review', 'ready_for_release', 'released'].includes(stage);
  const needsQaReview = !(t.qaReview?.length) && ['ready_for_release', 'released'].includes(stage);
  const qaReview = needsQaReview ? synthesizeQaReview(t) : (t.qaReview || []);
  const needsReleaseInfo = !t.releaseInfo && stage === 'released';
  return {
    ...t,
    stage,
    legacyStatus: t.status,
    developerTestingReport: needsReport ? synthesizeDeveloperTestingReport(t) : t.developerTestingReport,
    qaReview,
    releaseInfo: needsReleaseInfo ? synthesizeReleaseInfo(t, qaReview) : t.releaseInfo,
  };
}

const RAW = [
  { id: 't1',  ticketNumber: 'BUG-1024', type: 'bug', title: 'Fee challan not generating for Class 8',
    description: 'Fee challan generation fails silently for Class 8 students since yesterday. Steps: Fee Module → Generate Challan → select Class 8 → nothing happens, no error shown.',
    priority: 'critical', status: 'in_progress', schoolName: 'Daffodil Schools', supportConversationId: 'sess-1042',
    reportedBy: 'Tariq Ahmed', assignedTo: 'Usman Tariq',
    platform: 'erp', module: 'fee',
    expectedBehaviour: 'Clicking Generate Challan produces a challan for every Class 8 student.',
    actualBehaviour: 'Nothing happens — no challan, no error message shown to the user.',
    reportedAt: ago(2 * D + 3 * H), assignedAt: ago(2 * D + 2 * H), startedAt: ago(1 * D + 5 * H),
    attachments: [{ id: 'att1', name: 'error_screenshot.jpg', type: 'image', size: '1.2 MB', uploadedAt: ago(2 * D + 3 * H) }],
    isRecurring: true, recurrenceCount: 4, affectedSchoolsCount: 3, firstReportedAt: ago(21 * D), lastReportedAt: ago(2 * D + 3 * H), relatedTicketIds: ['BUG-0891', 'BUG-0940', 'BUG-1005'] },

  { id: 't2',  ticketNumber: 'BUG-1023', type: 'bug', title: 'OTP not arriving for parent login',
    description: 'Parents report OTP SMS is not being received during login. Confirmed with 3 different parent accounts at City Grammar School.',
    priority: 'high', status: 'assigned', schoolName: 'City Grammar School', supportConversationId: 'sess-1039',
    reportedBy: 'Sara Ali', assignedTo: 'Ahmed Khan',
    platform: 'mobile', subPlatform: 'parent_app', module: 'parent_login',
    expectedBehaviour: 'Parent receives an OTP SMS within a few seconds of requesting login.',
    actualBehaviour: 'No OTP SMS arrives for any of the 3 test accounts.',
    reportedAt: ago(1 * D + 6 * H), assignedAt: ago(1 * D + 4 * H),
    attachments: [] },

  { id: 't3',  ticketNumber: 'IMP-0215', type: 'improvement', title: 'Add bulk result card export to PDF',
    description: 'Schools want to export all result cards for a class in a single PDF instead of one at a time. Would save significant time during result day.',
    priority: 'medium', status: 'reported', schoolName: 'Beacon House', supportConversationId: 'sess-1044',
    reportedBy: 'Tariq Ahmed', reportedAt: ago(5 * H),
    platform: 'erp', module: 'examination' },

  { id: 't4',  ticketNumber: 'BUG-1022', type: 'bug', title: 'Biometric sync stopped working',
    description: 'Biometric attendance device stopped syncing with the ERP after the last update. Attendance not reflecting for the last 2 days.',
    priority: 'high', status: 'fixed', schoolName: 'MPS School System', supportConversationId: 'sess-1038',
    reportedBy: 'Usman Tariq', assignedTo: 'Bilal Ahmed',
    platform: 'erp', module: 'attendance',
    expectedBehaviour: 'Biometric device syncs attendance automatically every few minutes.',
    actualBehaviour: 'No sync has happened in 2 days; attendance register shows no records.',
    reportedAt: ago(4 * D), assignedAt: ago(4 * D - 1 * H), startedAt: ago(3 * D + 4 * H), fixedAt: ago(1 * D + 2 * H) },

  { id: 't5',  ticketNumber: 'IMP-0214', type: 'improvement', title: 'Dark mode for parent mobile app',
    description: 'Multiple schools have requested dark mode support in the parent-facing mobile app.',
    priority: 'low', status: 'in_progress', schoolName: 'The Spirit School', supportConversationId: 'sess-1030',
    reportedBy: 'Sara Ali', assignedTo: 'Sara Ali',
    platform: 'mobile', subPlatform: 'parent_app', module: 'settings',
    reportedAt: ago(6 * D), assignedAt: ago(6 * D - 2 * H), startedAt: ago(4 * D) },

  { id: 't6',  ticketNumber: 'BUG-1021', type: 'bug', title: 'Timetable clashes after bulk update',
    description: 'After using bulk timetable update, several sections show overlapping periods for the same teacher.',
    priority: 'medium', status: 'communicated', schoolName: 'Smart School', supportConversationId: 'sess-1025',
    reportedBy: 'Ahmed Khan', assignedTo: 'Ahmed Khan',
    platform: 'erp', module: 'timetable',
    expectedBehaviour: 'Bulk timetable update should reject/flag overlapping periods for a teacher.',
    actualBehaviour: 'Overlapping periods are saved silently with no warning.',
    reportedAt: ago(7 * D), assignedAt: ago(7 * D - 1 * H), startedAt: ago(6 * D), fixedAt: ago(3 * D), communicatedAt: ago(2 * D + 4 * H) },

  { id: 't7',  ticketNumber: 'BUG-1020', type: 'bug', title: 'Result card margins cut off on print',
    description: 'When printing on A4, the right margin of the result card template is being cut off — roll number column partially hidden.',
    priority: 'medium', status: 'closed', schoolName: 'Beacon House', supportConversationId: 'sess-1018',
    reportedBy: 'Tariq Ahmed', assignedTo: 'Usman Tariq',
    platform: 'erp', module: 'examination',
    expectedBehaviour: 'Result card prints fully within the A4 page margins.',
    actualBehaviour: 'Roll number column is cut off on the right edge when printed.',
    reportedAt: ago(12 * D), assignedAt: ago(12 * D - 1 * H), startedAt: ago(11 * D), fixedAt: ago(9 * D), communicatedAt: ago(8 * D), closedAt: ago(7 * D + 6 * H),
    isRecurring: true, recurrenceCount: 2, affectedSchoolsCount: 2, firstReportedAt: ago(30 * D), lastReportedAt: ago(12 * D), relatedTicketIds: ['BUG-0955'] },

  { id: 't8',  ticketNumber: 'IMP-0213', type: 'improvement', title: 'Add section-wise fee defaulter report',
    description: 'Accounts team wants a section-wise breakdown of fee defaulters instead of only class-wise.',
    priority: 'medium', status: 'assigned', schoolName: 'Concept School', supportConversationId: 'sess-1033',
    reportedBy: 'Sara Ali', assignedTo: 'Bilal Ahmed',
    platform: 'erp', module: 'fee',
    reportedAt: ago(3 * D), assignedAt: ago(2 * D + 8 * H) },

  { id: 't9',  ticketNumber: 'BUG-1019', type: 'bug', title: 'Attendance register date filter resets',
    description: 'The date filter on the attendance register resets to today every time the page is refreshed, losing the selected range.',
    priority: 'low', status: 'closed', schoolName: 'City Grammar School', supportConversationId: 'sess-1010',
    reportedBy: 'Sara Ali', assignedTo: 'Sara Ali',
    platform: 'erp', module: 'attendance',
    expectedBehaviour: 'Selected date range persists across a page refresh.',
    actualBehaviour: 'Date range resets to today on every refresh.',
    reportedAt: ago(15 * D), assignedAt: ago(15 * D - 2 * H), startedAt: ago(14 * D), fixedAt: ago(13 * D), communicatedAt: ago(12 * D), closedAt: ago(12 * D - 3 * H) },

  { id: 't10', ticketNumber: 'BUG-1018', type: 'bug', title: 'SMS sender ID not configured after re-signup',
    description: 'School re-signed up on a new plan and SMS OTP is failing — sender ID from the old account was not migrated.',
    priority: 'high', status: 'fixed', schoolName: 'AES School System', supportConversationId: 'sess-1006',
    reportedBy: 'Usman Tariq', assignedTo: 'Usman Tariq',
    platform: 'erp', module: 'settings',
    expectedBehaviour: 'SMS sender ID carries over automatically on plan re-signup.',
    actualBehaviour: 'OTP SMS fails to send — sender ID missing from the new account config.',
    reportedAt: ago(9 * D), assignedAt: ago(9 * D - 1 * H), startedAt: ago(8 * D), fixedAt: ago(6 * D) },

  { id: 't11', ticketNumber: 'IMP-0212', type: 'improvement', title: 'Allow multiple signatures on HR letters',
    description: 'HR wants to add a second signatory (Vice Principal) on offer/experience letters, currently only one signature slot exists.',
    priority: 'low', status: 'reported', schoolName: 'The Creative School', supportConversationId: 'sess-1046',
    reportedBy: 'Ahmed Khan', reportedAt: ago(2 * H),
    platform: 'erp', module: 'hr' },

  { id: 't12', ticketNumber: 'BUG-1017', type: 'bug', title: 'Class 6 attendance not saving',
    description: 'Marking attendance for Class 6 shows "saved" but reverts to blank on page reload.',
    priority: 'critical', status: 'in_progress', schoolName: 'The City School Johar Town', supportConversationId: 'sess-1041',
    reportedBy: 'Sara Ali', assignedTo: 'Ahmed Khan',
    platform: 'erp', module: 'attendance',
    expectedBehaviour: 'Attendance saved for Class 6 persists after a page reload.',
    actualBehaviour: 'A "saved" toast appears, but the attendance sheet is blank again on reload.',
    reportedAt: ago(1 * D + 1 * H), assignedAt: ago(1 * D), startedAt: ago(18 * H),
    attachments: [{ id: 'att2', name: 'attendance_bug.mp4', type: 'video', size: '4.8 MB', uploadedAt: ago(1 * D + 1 * H) }, { id: 'att3', name: 'console_log.txt', type: 'document', size: '12 KB', uploadedAt: ago(1 * D) }],
    isRecurring: true, recurrenceCount: 6, affectedSchoolsCount: 4, firstReportedAt: ago(25 * D), lastReportedAt: ago(1 * D + 1 * H), relatedTicketIds: ['BUG-0870', 'BUG-0912', 'BUG-0968', 'BUG-1001', 'BUG-1017'] },

  { id: 't13', ticketNumber: 'BUG-1016', type: 'bug', title: 'Fee receipt number duplicated',
    description: 'Two different fee receipts were generated with the same receipt number for different students.',
    priority: 'critical', status: 'assigned', schoolName: 'MPS School System', supportConversationId: 'sess-1040',
    reportedBy: 'Tariq Ahmed', assignedTo: 'Usman Tariq',
    platform: 'erp', module: 'fee',
    reportedAt: ago(20 * H), assignedAt: ago(15 * H) },

  { id: 't14', ticketNumber: 'IMP-0211', type: 'improvement', title: 'Export inventory stock as Excel',
    description: 'Inventory module only supports PDF export currently; store staff want an Excel option for reconciliation.',
    priority: 'low', status: 'closed', schoolName: 'Daffodil Schools', supportConversationId: 'sess-0998',
    reportedBy: 'Sara Ali', assignedTo: 'Bilal Ahmed',
    platform: 'erp', module: 'inventory',
    reportedAt: ago(18 * D), assignedAt: ago(17 * D), startedAt: ago(16 * D), fixedAt: ago(14 * D), communicatedAt: ago(13 * D), closedAt: ago(13 * D - 2 * H) },

  { id: 't15', ticketNumber: 'BUG-1015', type: 'bug', title: 'Teacher can see other section\'s gradebook',
    description: 'A Class 7-A teacher was able to open and view the gradebook of 7-B — potential permissions leak.',
    priority: 'critical', status: 'fixed', schoolName: 'Smart School', supportConversationId: 'sess-1012',
    reportedBy: 'Ahmed Khan', assignedTo: 'Ahmed Khan',
    platform: 'erp', module: 'examination',
    expectedBehaviour: 'A section teacher can only view their own section\'s gradebook.',
    actualBehaviour: 'A 7-A teacher could open and view 7-B\'s gradebook.',
    reportedAt: ago(10 * D), assignedAt: ago(10 * D - 1 * H), startedAt: ago(9 * D + 6 * H), fixedAt: ago(8 * D) },

  { id: 't16', ticketNumber: 'BUG-1014', type: 'bug', title: 'Transport route map not loading',
    description: 'The transport module route map tab shows a blank grey area instead of the map.',
    priority: 'medium', status: 'reported', schoolName: 'Beacon House', supportConversationId: 'sess-1045',
    reportedBy: 'Tariq Ahmed', reportedAt: ago(9 * H),
    platform: 'erp', module: 'transport' },

  { id: 't17', ticketNumber: 'IMP-0210', type: 'improvement', title: 'Add WhatsApp fee reminder templates',
    description: 'Accounts wants pre-built WhatsApp message templates for fee reminders, similar to the SMS templates already available.',
    priority: 'medium', status: 'in_progress', schoolName: 'Concept School', supportConversationId: 'sess-1028',
    reportedBy: 'Sara Ali', assignedTo: 'Sara Ali',
    platform: 'erp', module: 'fee',
    reportedAt: ago(5 * D), assignedAt: ago(5 * D - 3 * H), startedAt: ago(3 * D + 2 * H) },

  { id: 't18', ticketNumber: 'BUG-1013', type: 'bug', title: 'Exam schedule PDF shows wrong session year',
    description: 'Printed exam schedule shows "2024-25" in the header instead of the active "2025-26" session.',
    priority: 'low', status: 'communicated', schoolName: 'The City School Johar Town', supportConversationId: 'sess-1022',
    reportedBy: 'Usman Tariq', assignedTo: 'Bilal Ahmed',
    platform: 'erp', module: 'examination',
    expectedBehaviour: 'Exam schedule PDF header shows the active session year.',
    actualBehaviour: 'PDF header shows the previous session year.',
    reportedAt: ago(8 * D), assignedAt: ago(8 * D - 2 * H), startedAt: ago(7 * D), fixedAt: ago(5 * D), communicatedAt: ago(4 * D) },

  { id: 't19', ticketNumber: 'BUG-1012', type: 'bug', title: 'Staff salary slip shows negative tax',
    description: 'One staff member\'s salary slip is showing tax deduction as a negative number instead of zero.',
    priority: 'high', status: 'assigned', schoolName: 'AES School System', supportConversationId: 'sess-1043',
    reportedBy: 'Ahmed Khan', assignedTo: 'Usman Tariq',
    platform: 'erp', module: 'hr',
    reportedAt: ago(1 * D + 3 * H), assignedAt: ago(22 * H) },

  { id: 't20', ticketNumber: 'IMP-0209', type: 'improvement', title: 'Quick filters on Admissions CRM board',
    description: 'Admissions team wants quick filter chips (This Week / Hot Leads / Follow-up Due) above the CRM kanban board.',
    priority: 'low', status: 'reported', schoolName: 'The Creative School', supportConversationId: 'sess-1047',
    reportedBy: 'Sara Ali', reportedAt: ago(1 * H),
    platform: 'erp', module: 'admissions' },

  { id: 't21', ticketNumber: 'BUG-1011', type: 'bug', title: 'Lesson plan approval notification missing',
    description: 'Coordinators are not receiving a notification when a teacher submits a lesson plan for approval.',
    priority: 'medium', status: 'in_progress', schoolName: 'City Grammar School', supportConversationId: 'sess-1036',
    reportedBy: 'Tariq Ahmed', assignedTo: 'Bilal Ahmed',
    platform: 'erp', module: 'academics',
    reportedAt: ago(2 * D + 8 * H), assignedAt: ago(2 * D + 4 * H), startedAt: ago(1 * D + 10 * H) },

  { id: 't22', ticketNumber: 'BUG-1010', type: 'bug', title: 'Result card GPA calculation off by 0.1',
    description: 'GPA on the final result card is consistently 0.1 lower than the manually calculated value for O-Level sections.',
    priority: 'high', status: 'closed', schoolName: 'Beaconhouse School System Gulberg', supportConversationId: 'sess-0980',
    reportedBy: 'Usman Tariq', assignedTo: 'Ahmed Khan',
    platform: 'erp', module: 'examination',
    expectedBehaviour: 'GPA matches the manually calculated value.',
    actualBehaviour: 'GPA is consistently 0.1 lower for O-Level sections.',
    reportedAt: ago(22 * D), assignedAt: ago(21 * D), startedAt: ago(20 * D), fixedAt: ago(18 * D), communicatedAt: ago(17 * D), closedAt: ago(16 * D) },

  { id: 't23', ticketNumber: 'IMP-0208', type: 'improvement', title: 'Bulk SMS scheduling for holidays',
    description: 'Front office wants to schedule holiday announcement SMS in advance rather than sending them manually on the day.',
    priority: 'low', status: 'fixed', schoolName: 'The Spirit School', supportConversationId: 'sess-1015',
    reportedBy: 'Sara Ali', assignedTo: 'Sara Ali',
    platform: 'erp', module: 'settings',
    reportedAt: ago(11 * D), assignedAt: ago(11 * D - 2 * H), startedAt: ago(10 * D), fixedAt: ago(6 * D + 5 * H) },

  { id: 't24', ticketNumber: 'BUG-1009', type: 'bug', title: 'Inventory stock count negative after transfer',
    description: 'Transferring stock between two campuses left the source campus with a negative stock count for 3 items.',
    priority: 'medium', status: 'assigned', schoolName: 'MPS School System', supportConversationId: 'sess-1037',
    reportedBy: 'Ahmed Khan', assignedTo: 'Bilal Ahmed',
    platform: 'erp', module: 'inventory',
    reportedAt: ago(2 * D + 2 * H), assignedAt: ago(1 * D + 20 * H) },

  { id: 't25', ticketNumber: 'BUG-1008', type: 'bug', title: 'Parent app push notifications delayed by hours',
    description: 'Parents report receiving push notifications for homework/attendance 3-4 hours late, sometimes not at all.',
    priority: 'high', status: 'in_progress', schoolName: 'Daffodil Schools', supportConversationId: 'sess-1034',
    reportedBy: 'Tariq Ahmed', assignedTo: 'Usman Tariq',
    platform: 'mobile', subPlatform: 'parent_app', module: 'notifications',
    expectedBehaviour: 'Push notifications arrive within a minute of the triggering event.',
    actualBehaviour: 'Notifications arrive 3-4 hours late, or not at all.',
    reportedAt: ago(4 * D + 2 * H), assignedAt: ago(4 * D), startedAt: ago(3 * D),
    isRecurring: true, recurrenceCount: 3, affectedSchoolsCount: 5, firstReportedAt: ago(19 * D), lastReportedAt: ago(4 * D + 2 * H), relatedTicketIds: ['BUG-0932', 'BUG-0977'] },

  { id: 't26', ticketNumber: 'IMP-0207', type: 'improvement', title: 'Add class-teacher remarks to report card',
    description: 'Schools want an optional free-text "Class Teacher Remarks" field printed on the report card footer.',
    priority: 'medium', status: 'communicated', schoolName: 'City Grammar School', supportConversationId: 'sess-1020',
    reportedBy: 'Sara Ali', assignedTo: 'Sara Ali',
    platform: 'erp', module: 'examination',
    reportedAt: ago(10 * D), assignedAt: ago(9 * D + 6 * H), startedAt: ago(8 * D), fixedAt: ago(5 * D), communicatedAt: ago(3 * D + 4 * H) },

  { id: 't27', ticketNumber: 'BUG-1007', type: 'bug', title: 'CSV student import ignores middle section header',
    description: 'When importing students via CSV, rows under a repeated header row (multi-sheet export) get skipped silently.',
    priority: 'medium', status: 'reported', schoolName: 'Smart School', supportConversationId: 'sess-1048',
    reportedBy: 'Usman Tariq', reportedAt: ago(30 * (60 * 1000)),
    platform: 'erp', module: 'academics' },

  { id: 't28', ticketNumber: 'BUG-1006', type: 'bug', title: 'Payroll bank file export uses wrong delimiter',
    description: 'The bank transfer file export uses commas but the bank\'s portal expects pipe-delimited — every batch has to be fixed manually.',
    priority: 'high', status: 'closed', schoolName: 'AES School System', supportConversationId: 'sess-0965',
    reportedBy: 'Ahmed Khan', assignedTo: 'Usman Tariq',
    platform: 'erp', module: 'hr',
    expectedBehaviour: 'Bank file export uses the pipe delimiter the bank portal expects.',
    actualBehaviour: 'Export uses commas — every batch must be manually corrected.',
    reportedAt: ago(26 * D), assignedAt: ago(25 * D), startedAt: ago(24 * D), fixedAt: ago(22 * D), communicatedAt: ago(21 * D), closedAt: ago(20 * D) },

  /* ═══ Fully-fleshed mock examples — one per required scenario, so the
     Tech Module is self-explanatory on first load without walking every
     ticket through the flow by hand. Each carries its own hand-authored
     `activity` (see the INITIAL_TICKETS builder below — a ticket that
     supplies its own activity keeps it verbatim instead of having the
     generic activityFor() overwrite it). ═══ */

  /* 1. Bug from Support — sitting in QA Review awaiting a decision. */
  { id: 't29', ticketNumber: 'BUG-1025', type: 'bug', title: 'Attendance sync fails after biometric firmware update',
    description: 'After the biometric device firmware auto-updated, attendance stopped syncing to the ERP for the whole staff room.',
    status: 'fixed', schoolName: 'MPS School System', supportConversationId: 'sess-2001', source: 'customer_support',
    reportedBy: 'Tariq Ahmed', assignedTo: 'Sara Ali', platform: 'erp', module: 'attendance',
    expectedBehaviour: 'Attendance syncs automatically regardless of device firmware version.',
    actualBehaviour: 'No sync at all since the firmware auto-updated two days ago.',
    reportedAt: ago(2 * D), assignedAt: ago(2 * D - 2 * H), startedAt: ago(1 * D + 18 * H), fixedAt: ago(3 * H),
    attachments: [{ id: 'att-1025-1', name: 'device_error.jpg', type: 'image', size: '980 KB', uploadedAt: ago(2 * D) }],
    developerTestingReport: {
      whatImplemented: 'Added a compatibility shim for the new firmware\'s changed payload format.',
      whatTested: 'Re-synced attendance for 3 staff rooms across 2 schools running the updated firmware.',
      testingResults: 'Sync completes within 10 seconds on all 3 test rooms; no data loss observed.',
      limitations: 'Older firmware versions (pre-2024) were not re-tested — should still work via the legacy code path.',
      attachments: [{ id: 'att-1025-2', name: 'sync_success.mp4', type: 'video', size: '3.1 MB', uploadedAt: ago(3 * H) }],
      submittedBy: 'Sara Ali', submittedAt: ago(3 * H),
    },
    activity: [
      { event: 'Reported', person: 'Tariq Ahmed', personRole: 'Customer Support', at: ago(2 * D) },
      { event: 'Assigned to Sara Ali — moved to In Progress', person: 'Super Admin', at: ago(2 * D - 2 * H) },
      { event: 'Status changed to In Progress', person: 'Sara Ali', at: ago(1 * D + 18 * H) },
      { event: 'Developer Testing Report submitted', person: 'Sara Ali', at: ago(3 * H) },
      { event: 'Sent for QA Testing', person: 'Sara Ali', at: ago(3 * H) },
    ] },

  /* 2. Bug from School (direct, no Support conversation) — QA Returned. */
  { id: 't30', ticketNumber: 'BUG-1026', type: 'bug', title: 'Result card shows wrong roll number for merged sections',
    description: 'When two sections are merged for an exam, the printed result card shows the roll number from the original section instead of the merged one.',
    status: 'in_progress', schoolName: 'The City School Johar Town', supportConversationId: null, source: 'school_direct',
    reportedBy: 'Sana Malik', assignedTo: 'Bilal Ahmed', platform: 'erp', module: 'examination',
    expectedBehaviour: 'Result card shows the roll number from the merged section\'s own roll list.',
    actualBehaviour: 'Roll number from the original (pre-merge) section is printed instead.',
    reportedAt: ago(4 * D), assignedAt: ago(4 * D - 3 * H), startedAt: ago(3 * D + 20 * H),
    attachments: [{ id: 'att-1026-1', name: 'wrong_roll_number.png', type: 'image', size: '640 KB', uploadedAt: ago(4 * D) }],
    developerTestingReport: {
      whatImplemented: 'Updated the result card renderer to read roll numbers from the merged-section roster.',
      whatTested: 'Printed result cards for one merged Class 9 section.',
      testingResults: 'Roll numbers looked correct for the 5 students checked.',
      limitations: '',
      attachments: [],
      submittedBy: 'Bilal Ahmed', submittedAt: ago(2 * D),
    },
    qaReview: [
      { id: 'qa-seed-1026', decision: 'rejected', comments: 'Issue still reproducible on the full Class 9 merged section — only a handful of students were checked, several others still show the old roll number.', attachments: [{ id: 'att-1026-2', name: 'still_wrong_full_class.mp4', type: 'video', size: '5.2 MB', uploadedAt: ago(1 * D) }], reviewedBy: 'QA Team', reviewedAt: ago(1 * D) },
    ],
    activity: [
      { event: 'Reported', person: 'Sana Malik', personRole: 'School (Direct)', at: ago(4 * D) },
      { event: 'Assigned to Bilal Ahmed — moved to In Progress', person: 'Super Admin', at: ago(4 * D - 3 * H) },
      { event: 'Status changed to In Progress', person: 'Bilal Ahmed', at: ago(3 * D + 20 * H) },
      { event: 'Developer Testing Report submitted', person: 'Bilal Ahmed', at: ago(2 * D) },
      { event: 'Sent for QA Testing', person: 'Bilal Ahmed', at: ago(2 * D) },
      { event: 'Rejected by QA — returned to developer', person: 'QA Team', at: ago(1 * D), note: 'Issue still reproducible on the full Class 9 merged section.' },
    ] },

  /* 3. Internal Bug — reported by Head Office, unassigned. */
  { id: 't31', ticketNumber: 'BUG-1029', type: 'bug', title: 'Admin panel session times out too quickly on slow connections',
    description: 'Internal QA noticed the Super Admin session expires after ~5 minutes even while actively working, on slower office connections.',
    status: 'reported', schoolName: 'Daffodil Schools', supportConversationId: null, source: 'head_office_internal',
    reportedBy: 'Head Office Coordination', platform: 'erp', module: 'settings',
    expectedBehaviour: 'Session should stay active for at least 30 minutes of activity.',
    actualBehaviour: 'Session expires after ~5 minutes regardless of activity on slow connections.',
    reportedAt: ago(3 * H),
    activity: [
      { event: 'Reported', person: 'Head Office Coordination', personRole: 'Head Office / Internal', at: ago(3 * H) },
    ] },

  /* 4. New Development — reported by Head Office, unassigned. */
  { id: 't32', ticketNumber: 'IMP-0216', type: 'improvement', title: 'Add multi-campus consolidated attendance report',
    description: 'Head Office wants a single report showing attendance % across all campuses of a chain school, instead of pulling each campus separately.',
    status: 'reported', schoolName: 'The Creative School', supportConversationId: null, source: 'head_office_internal',
    reportedBy: 'Head Office Coordination', platform: 'erp', module: 'attendance',
    reportedAt: ago(6 * H),
    activity: [
      { event: 'Reported', person: 'Head Office Coordination', personRole: 'Head Office / Internal', at: ago(6 * H) },
    ] },

  /* 5. Approved Bug (development-team sourced) — Ready for Release, awaiting the Release action. */
  { id: 't33', ticketNumber: 'BUG-1027', type: 'bug', title: 'Payroll bank file uses wrong IBAN format for one bank',
    description: 'The bank transfer file export pads IBANs incorrectly for Bank Alfalah accounts, causing the batch to bounce.',
    status: 'communicated', schoolName: 'AES School System', supportConversationId: null, source: 'development_team',
    reportedBy: 'Usman Tariq', assignedTo: 'Usman Tariq', platform: 'erp', module: 'hr',
    expectedBehaviour: 'IBANs are formatted per Bank Alfalah\'s spec in the export file.',
    actualBehaviour: 'IBAN padding is wrong for that one bank, causing the whole batch to bounce.',
    reportedAt: ago(3 * D), assignedAt: ago(3 * D - 1 * H), startedAt: ago(2 * D + 18 * H), fixedAt: ago(8 * H), communicatedAt: ago(6 * H),
    attachments: [{ id: 'att-1027-1', name: 'bounced_batch_report.pdf', type: 'document', size: '210 KB', uploadedAt: ago(3 * D) }],
    developerTestingReport: {
      whatImplemented: 'Fixed IBAN padding logic specifically for Bank Alfalah\'s 24-character format.',
      whatTested: 'Generated a test batch of 10 accounts across 3 banks including Bank Alfalah.',
      testingResults: 'All 10 IBANs now validate correctly against each bank\'s format checker.',
      limitations: '',
      attachments: [{ id: 'att-1027-2', name: 'validated_batch.xlsx', type: 'document', size: '44 KB', uploadedAt: ago(8 * H) }],
      submittedBy: 'Usman Tariq', submittedAt: ago(8 * H),
    },
    qaReview: [
      { id: 'qa-seed-1027', decision: 'approved', comments: 'Verified against 3 sample bank files, including a real (anonymized) Bank Alfalah batch — all pass validation now.', attachments: [{ id: 'att-1027-3', name: 'qa_validation.mp4', type: 'video', size: '4.4 MB', uploadedAt: ago(6 * H) }], reviewedBy: 'QA Team', reviewedAt: ago(6 * H) },
    ],
    activity: [
      { event: 'Reported', person: 'Usman Tariq', personRole: 'Development Team', at: ago(3 * D) },
      { event: 'Assigned to Usman Tariq — moved to In Progress', person: 'Super Admin', at: ago(3 * D - 1 * H) },
      { event: 'Status changed to In Progress', person: 'Usman Tariq', at: ago(2 * D + 18 * H) },
      { event: 'Developer Testing Report submitted', person: 'Usman Tariq', at: ago(8 * H) },
      { event: 'Sent for QA Testing', person: 'Usman Tariq', at: ago(8 * H) },
      { event: 'Approved by QA — Ready for Release', person: 'QA Team', at: ago(6 * H) },
    ] },

  /* 6. QA Rejected Bug — explicit example matching the reject-flow spec. */
  { id: 't34', ticketNumber: 'BUG-1028', type: 'bug', title: 'Fee challan PDF cuts off the discount line for large families',
    description: 'For families with 4+ children, the discount breakdown line gets cut off at the bottom of the fee challan PDF.',
    status: 'in_progress', schoolName: 'Daffodil Schools', supportConversationId: 'sess-2003', source: 'customer_support',
    reportedBy: 'Tariq Ahmed', assignedTo: 'Ahmed Khan', platform: 'erp', module: 'fee',
    expectedBehaviour: 'Discount breakdown line always fits on the challan regardless of family size.',
    actualBehaviour: 'Line is cut off for families with 4 or more children.',
    reportedAt: ago(5 * D), assignedAt: ago(5 * D - 2 * H), startedAt: ago(4 * D + 20 * H),
    attachments: [{ id: 'att-1028-1', name: 'cut_off_challan.png', type: 'image', size: '510 KB', uploadedAt: ago(5 * D) }],
    developerTestingReport: {
      whatImplemented: 'Reduced font size and line height for the discount section when more than 3 children are listed.',
      whatTested: 'Generated a challan for a 4-child family.',
      testingResults: 'Discount line now fits without overlapping the footer.',
      limitations: 'Did not test 5+ child families.',
      attachments: [],
      submittedBy: 'Ahmed Khan', submittedAt: ago(2 * D),
    },
    qaReview: [
      { id: 'qa-seed-1028', decision: 'rejected', comments: 'Issue still exists after fix — tested with a 5-child family and the line is still cut off.', attachments: [{ id: 'att-1028-2', name: 'bug-reproduction.mp4', type: 'video', size: '6.4 MB', uploadedAt: ago(1 * D + 4 * H) }], reviewedBy: 'QA Team', reviewedAt: ago(1 * D + 4 * H) },
    ],
    activity: [
      { event: 'Reported', person: 'Tariq Ahmed', personRole: 'Customer Support', at: ago(5 * D) },
      { event: 'Assigned to Ahmed Khan — moved to In Progress', person: 'Super Admin', at: ago(5 * D - 2 * H) },
      { event: 'Status changed to In Progress', person: 'Ahmed Khan', at: ago(4 * D + 20 * H) },
      { event: 'Developer Testing Report submitted', person: 'Ahmed Khan', at: ago(2 * D) },
      { event: 'Sent for QA Testing', person: 'Ahmed Khan', at: ago(2 * D) },
      { event: 'Rejected by QA — returned to developer', person: 'QA Team', at: ago(1 * D + 4 * H), note: 'Issue still exists after fix.' },
    ] },

  /* 7. Released Feature — full lifecycle, already released and notified to Support. */
  { id: 't35', ticketNumber: 'IMP-0217', type: 'improvement', title: 'Add WhatsApp OTP fallback for parent login',
    description: 'Parents at schools with poor SMS delivery requested a WhatsApp-based OTP fallback for logging into the parent app.',
    status: 'closed', schoolName: 'Smart School', supportConversationId: 'sess-2002', source: 'customer_support',
    reportedBy: 'Sara Ali', assignedTo: 'Sara Ali', platform: 'mobile', subPlatform: 'parent_app', module: 'parent_login',
    reportedAt: ago(10 * D), assignedAt: ago(10 * D - 2 * H), startedAt: ago(9 * D), fixedAt: ago(5 * D), communicatedAt: ago(4 * D), closedAt: ago(2 * D),
    attachments: [{ id: 'att-0217-1', name: 'feature_request_screenshot.png', type: 'image', size: '320 KB', uploadedAt: ago(10 * D) }],
    developerTestingReport: {
      whatImplemented: 'Added a WhatsApp Business API OTP path, offered automatically after 2 failed SMS attempts.',
      whatTested: 'Logged in via WhatsApp OTP on 4 test parent accounts across 2 devices.',
      testingResults: 'OTP arrives within 5 seconds on WhatsApp in all 4 tests; login succeeds normally.',
      limitations: 'Requires the parent to already have WhatsApp installed with the same registered number.',
      attachments: [{ id: 'att-0217-2', name: 'whatsapp_otp_demo.mp4', type: 'video', size: '5.8 MB', uploadedAt: ago(5 * D) }],
      submittedBy: 'Sara Ali', submittedAt: ago(5 * D),
    },
    qaReview: [
      { id: 'qa-seed-0217', decision: 'approved', comments: 'Tested on iOS and Android, both with and without WhatsApp installed (falls back to SMS correctly). Looks solid.', attachments: [{ id: 'att-0217-3', name: 'qa_regression.mp4', type: 'video', size: '7.1 MB', uploadedAt: ago(4 * D) }], reviewedBy: 'QA Team', reviewedAt: ago(4 * D) },
    ],
    releaseInfo: {
      releasedBy: 'Super Admin', releasedAt: ago(2 * D),
      approvedBy: 'QA Team', approvalDate: ago(4 * D),
      testingComments: 'Passed regression on both platforms.',
      releaseNotes: 'Parents can now receive their login OTP via WhatsApp automatically after 2 failed SMS attempts.',
      deploymentComments: 'Rolled out to all schools on the parent app v3.4.0 release train — no server-side migration required.',
      attachments: [{ id: 'att-0217-4', name: 'release_notes_v3.4.0.pdf', type: 'document', size: '88 KB', uploadedAt: ago(2 * D) }],
      devTimeDays: 8,
    },
    notifiedSupport: true,
    activity: [
      { event: 'Reported', person: 'Sara Ali', personRole: 'Customer Support', at: ago(10 * D) },
      { event: 'Assigned to Sara Ali — moved to In Progress', person: 'Super Admin', at: ago(10 * D - 2 * H) },
      { event: 'Status changed to In Progress', person: 'Sara Ali', at: ago(9 * D) },
      { event: 'Developer Testing Report submitted', person: 'Sara Ali', at: ago(5 * D) },
      { event: 'Sent for QA Testing', person: 'Sara Ali', at: ago(5 * D) },
      { event: 'Approved by QA — Ready for Release', person: 'QA Team', at: ago(4 * D) },
      { event: 'Released', person: 'Super Admin', at: ago(2 * D) },
    ] },
];

/* A ticket that supplies its own hand-authored `activity` (the 7 seeds
   above) keeps it verbatim; every other (legacy) ticket still gets its
   timeline generated from its own timestamp fields, as before. */
export const INITIAL_TICKETS = RAW.map((r) => {
  const t = migrateTicket(ticket(r));
  t.activity = (r.activity && r.activity.length) ? t.activity : activityFor(t);
  return t;
});

/* ═══════════ in-memory "database" ═══════════
   Tech Module is written to from two places (Support's Bug/New-Development
   modal AND the Tech Module's own stage/assignment/testing/QA actions), so
   — unlike the simpler read-only *Data.js seeds elsewhere — this needs a
   session-lived mutable store rather than always recomputing from RAW.
   The api/services/techTickets.js resolve() wrapper reads/writes through
   the functions below; nothing outside this file mutates the array directly. */
let _tickets = INITIAL_TICKETS.slice();

export function getAllTickets() {
  return _tickets;
}

export function getTicketById(id) {
  return _tickets.find((t) => t.id === id || t.ticketNumber === id) || null;
}

/* payload: { type, title, description, expectedBehaviour, actualBehaviour,
   platform, subPlatform, module, schoolId|schoolName, attachments,
   reportedBy, supportConversationId, assignedTo (optional developer name) } */
export function addTicket(payload) {
  const number = nextTicketNumber(payload.type);
  /* `payload.school` (a fully-resolved {id,name,...,isTestSchool} object,
     as produced by techModule/SchoolPicker.jsx for both test AND real
     member schools) takes precedence — it's the only way a real ERP
     school (not present in this file's own SCHOOLS list) resolves
     correctly. Falls back to the legacy schoolId/schoolName lookups so
     Support's existing Bug/Improvement submission keeps working unchanged. */
  const school = payload.school
    || (payload.schoolId && schoolById(payload.schoolId))
    || schoolByName(payload.schoolName)
    || { id: 'sch-unknown', name: payload.schoolName || 'Unknown School', isTestSchool: true };
  const assignedTo = payload.assignedTo ? (devById(payload.assignedTo) || devByName(payload.assignedTo)) : null;
  const now = new Date().toISOString();
  const stage = assignedTo ? 'in_progress' : 'bugs_new_dev';
  const t = {
    id: `t-${number}`,
    ticketNumber: number,
    type: payload.type,
    title: payload.title,
    description: payload.description || '',
    priority: payload.priority || null,
    status: STAGE_TO_LEGACY_STATUS[stage],
    stage,
    legacyStatus: null,
    platform: payload.platform || null,
    subPlatform: payload.subPlatform || null,
    module: payload.module || null,
    source: payload.source || 'customer_support', // see SOURCE_LABEL — Support's own submission never sets this, so it keeps defaulting correctly
    expectedBehaviour: payload.expectedBehaviour || '',
    actualBehaviour: payload.actualBehaviour || '',
    school: { id: school.id, name: school.name, branch: school.branch, contact: school.contact, phone: school.phone, loginId: school.loginId, password: school.password, isTestSchool: school.isTestSchool !== false },
    supportConversationId: payload.supportConversationId || null,
    reportedBy: { id: 'agent-' + (payload.reportedBy || 'agent').toLowerCase().replace(/\s+/g, '-'), name: payload.reportedBy || 'Support Agent' },
    assignedTo: assignedTo ? { id: assignedTo.id, name: assignedTo.name } : null,
    assignedBy: assignedTo ? { id: 'super-admin', name: 'Super Admin' } : null,
    reportedAt: now,
    assignedAt: assignedTo ? now : null,
    startedAt: assignedTo ? now : null, fixedAt: null, communicatedAt: null, closedAt: null,
    attachments: payload.attachments || [],
    isRecurring: false, recurrenceCount: 1, affectedSchoolsCount: 1,
    firstReportedAt: now, lastReportedAt: now, relatedTicketIds: [],
    activity: [],
    developerTestingReport: null,
    qaReview: [],
    releaseInfo: null,
    notifiedSupport: false,
    notificationId: null,
  };
  t.activity = [
    { event: 'Reported', person: t.reportedBy.name, personRole: 'Customer Support', at: now },
    ...(assignedTo ? [{ event: `Assigned to ${assignedTo.name} — moved to In Progress`, person: 'Super Admin', at: now }] : []),
  ];
  _tickets = [t, ..._tickets];
  return t;
}

/* Generic stage transition — used internally by the more specific
   actions below so every path keeps `status` (legacy) in sync too. */
function moveToStage(id, stage, event, person, note) {
  const now = new Date().toISOString();
  _tickets = _tickets.map((t) => {
    if (t.id !== id) return t;
    const next = { ...t, stage, status: STAGE_TO_LEGACY_STATUS[stage] || t.status };
    const field = STAGE_TIMESTAMP_FIELD[stage];
    if (field && !next[field]) next[field] = now;
    next.activity = [...t.activity, { event, person, at: now, note: note || undefined }];
    return next;
  });
  return _tickets.find((t) => t.id === id);
}

export function updateTicketStage(id, stage, note) {
  return moveToStage(id, stage, `Moved to ${STAGE_LABEL[stage] || stage}`, 'Super Admin', note);
}

/* Legacy wrapper — kept so the pre-redesign TechTickets.jsx/TechTicketDetail.jsx
   (still routed until Phase 3's cutover) keep working unchanged; internally
   just moves through the equivalent new stage so `stage` and `status` never
   drift apart. Safe to delete once those two files are replaced. */
export function updateTicketStatus(id, status, note) {
  const stage = LEGACY_STAGE_MAP[status] || status;
  return moveToStage(id, stage, STATUS_LABEL[status] ? `Status changed to ${STATUS_LABEL[status]}` : `Status changed to ${status}`, 'Super Admin', note);
}

/* Legacy/inert — priority is no longer surfaced by the new Tech Module UI,
   but the pre-redesign screens (routed until Phase 3) still call this, and
   the field itself must never be stripped off existing records. */
export function updateTicketPriority(id, priority) {
  _tickets = _tickets.map((t) => (t.id === id ? { ...t, priority } : t));
  return _tickets.find((t) => t.id === id);
}

export function assignTicketTo(id, developerIdOrName, note) {
  const now = new Date().toISOString();
  const dev = devById(developerIdOrName) || devByName(developerIdOrName);
  _tickets = _tickets.map((t) => {
    if (t.id !== id) return t;
    const next = {
      ...t,
      assignedTo: dev ? { id: dev.id, name: dev.name } : null,
      assignedBy: { id: 'super-admin', name: 'Super Admin' },
      assignedAt: now,
      stage: 'in_progress',
      status: STAGE_TO_LEGACY_STATUS.in_progress,
      startedAt: t.startedAt || now,
    };
    next.activity = [...t.activity, { event: `Assigned to ${dev ? dev.name : '—'} — moved to In Progress`, person: 'Super Admin', at: now, note: note || undefined }];
    return next;
  });
  return _tickets.find((t) => t.id === id);
}

/* Mandatory before "Send for QA Testing" — saved independently so a
   developer can fill it in, leave, and come back before sending. */
export function submitDeveloperTestingReport(id, report) {
  const now = new Date().toISOString();
  _tickets = _tickets.map((t) => {
    if (t.id !== id) return t;
    const developerTestingReport = {
      whatImplemented: report.whatImplemented || '',
      whatTested: report.whatTested || '',
      testingResults: report.testingResults || '',
      limitations: report.limitations || '',
      attachments: report.attachments || [],
      submittedBy: report.submittedBy || t.assignedTo?.name || 'Developer',
      submittedAt: now,
    };
    return { ...t, developerTestingReport, activity: [...t.activity, { event: 'Developer Testing Report submitted', person: developerTestingReport.submittedBy, at: now }] };
  });
  return _tickets.find((t) => t.id === id);
}

export function sendForQaTesting(id) {
  const t = getTicketById(id);
  if (!t) return null;
  if (!t.developerTestingReport) throw new Error('A Developer Testing Report is required before sending for QA Testing.');
  return moveToStage(id, 'qa_review', 'Sent for QA Testing', t.assignedTo?.name || 'Developer');
}

/* decision: 'approved' | 'rejected'. Approve → Ready for Release.
   Reject → back to the assigned developer's In Progress. Comments are
   required by the calling UI, not re-validated here. */
export function submitQaReview(id, { decision, comments, attachments, reviewedBy }) {
  const now = new Date().toISOString();
  let updated = null;
  _tickets = _tickets.map((t) => {
    if (t.id !== id) return t;
    const review = { id: `qa-${Date.now()}`, decision, comments: comments || '', attachments: attachments || [], reviewedBy: reviewedBy || 'QA Team', reviewedAt: now };
    const nextStage = decision === 'approved' ? 'ready_for_release' : 'in_progress';
    const next = {
      ...t,
      qaReview: [...t.qaReview, review],
      stage: nextStage,
      status: STAGE_TO_LEGACY_STATUS[nextStage],
      communicatedAt: decision === 'approved' ? (t.communicatedAt || now) : t.communicatedAt,
    };
    next.activity = [...t.activity, { event: decision === 'approved' ? 'Approved by QA — Ready for Release' : 'Rejected by QA — returned to developer', person: review.reviewedBy, at: now, note: comments }];
    updated = next;
    return next;
  });
  return updated;
}

/* Marks the ticket released, computes development time, and returns the
   final ticket so the caller (ReadyForReleaseTab) can push the internal
   Support notification with the exact figures. */
export function releaseTicket(id, { testingComments, releaseNotes, deploymentComments, attachments, releasedBy } = {}) {
  const now = new Date().toISOString();
  let updated = null;
  _tickets = _tickets.map((t) => {
    if (t.id !== id) return t;
    const lastApproval = [...t.qaReview].reverse().find((r) => r.decision === 'approved');
    const startMs = new Date(t.assignedAt || t.reportedAt).getTime();
    const devTimeDays = Math.max(1, Math.round((Date.now() - startMs) / D));
    const releaseInfo = {
      releasedBy: releasedBy || 'Super Admin',
      releasedAt: now,
      approvedBy: lastApproval?.reviewedBy || 'QA Team',
      approvalDate: lastApproval?.reviewedAt || now,
      testingComments: testingComments || lastApproval?.comments || '',
      releaseNotes: releaseNotes || '',
      deploymentComments: deploymentComments || '',
      attachments: attachments || [],
      devTimeDays,
    };
    const next = { ...t, stage: 'released', status: STAGE_TO_LEGACY_STATUS.released, closedAt: t.closedAt || now, releaseInfo };
    next.activity = [...t.activity, { event: 'Released', person: releaseInfo.releasedBy, at: now }];
    updated = next;
    return next;
  });
  return updated;
}

export function markNotified(id, notificationId) {
  _tickets = _tickets.map((t) => (t.id === id ? { ...t, notifiedSupport: true, notificationId } : t));
  return _tickets.find((t) => t.id === id);
}

/* ═══════════ date-range helpers ═══════════ */
export function inRange(iso, range) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!range || !range.from) return true;
  const from = new Date(range.from).getTime();
  const to = range.to ? new Date(range.to).getTime() + (D - 1) : Date.now();
  return t >= from && t <= to;
}

export function rangeForPreset(preset, from, to) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  if (preset === 'today') return { from: startOfDay(now), to: new Date().toISOString() };
  if (preset === 'week') {
    const day = now.getDay(); // 0=Sun
    const start = new Date(now); start.setDate(now.getDate() - day);
    return { from: startOfDay(start), to: new Date().toISOString() };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), to: new Date().toISOString() };
  }
  if (preset === 'custom') return { from: from || null, to: to || null };
  return { from: null, to: null }; // 'all'
}

/* ═══════════ stats / workload helpers (pure — operate on a ticket list) ═══════════ */
export function ticketStats(tickets) {
  const byStatus = {};
  STATUS_FLOW.forEach((s) => { byStatus[s] = 0; });
  const byStage = {};
  STAGE_FLOW.forEach((s) => { byStage[s] = 0; });
  let bugs = 0, improvements = 0, overdue = 0;
  const now = Date.now();
  tickets.forEach((t) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byStage[t.stage] = (byStage[t.stage] || 0) + 1;
    if (t.type === 'bug') bugs++; else improvements++;
    const openMs = now - new Date(t.reportedAt).getTime();
    const isOpen = t.stage !== 'released';
    if (isOpen && openMs > 3 * D) overdue++;
  });
  return { total: tickets.length, bugs, improvements, overdue, byStatus, byStage };
}

export function developerWorkload(tickets) {
  const map = new Map(DEVELOPERS.map((d) => [d.name, { developer: d, total: 0, new: 0, inProgress: 0, awaitingRelease: 0 }]));
  tickets.forEach((t) => {
    if (!t.assignedTo || t.stage === 'released') return;
    const row = map.get(t.assignedTo.name);
    if (!row) return;
    row.total++;
    if (t.stage === 'bugs_new_dev') row.new++;
    if (t.stage === 'in_progress') row.inProgress++;
    if (t.stage === 'qa_review' || t.stage === 'ready_for_release') row.awaitingRelease++;
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function filterTickets(tickets, f = {}) {
  return tickets.filter((t) => {
    if (f.search) {
      const q = f.search.trim().toLowerCase();
      const hay = `${t.ticketNumber} ${t.title} ${t.school.name} ${t.reportedBy.name} ${t.assignedTo?.name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.type && t.type !== f.type) return false;
    if (f.stage && t.stage !== f.stage) return false;
    // Backward-compat: Dashboard.jsx deep-links into this module with a
    // legacy `status` filter (e.g. { status: 'in_progress' }) — honour it
    // by mapping to the equivalent stage rather than touching Dashboard.
    if (f.status && !f.stage) {
      const mappedStage = LEGACY_STAGE_MAP[f.status];
      if (mappedStage && t.stage !== mappedStage) return false;
      if (!mappedStage && t.status !== f.status) return false;
    }
    if (f.developer && t.assignedTo?.name !== f.developer) return false;
    if (f.school && t.school.name !== f.school) return false;
    if (f.recurring === 'recurring' && !t.isRecurring) return false;
    if (f.recurring === 'first' && t.isRecurring) return false;
    if (f.range && f.range.from && !inRange(t.reportedAt, f.range)) return false;
    return true;
  });
}

export function relatedTickets(ids) {
  return INITIAL_TICKETS.filter((t) => ids.includes(t.ticketNumber));
}

/* ═══════════ ticket-number sequencing (for tickets created from Support) ═══════════ */
let bugSeq = Math.max(...INITIAL_TICKETS.filter((t) => t.type === 'bug').map((t) => Number(t.ticketNumber.split('-')[1]))) ;
let impSeq = Math.max(...INITIAL_TICKETS.filter((t) => t.type === 'improvement').map((t) => Number(t.ticketNumber.split('-')[1])));
export function nextTicketNumber(type) {
  if (type === 'bug') { bugSeq += 1; return `BUG-${String(bugSeq).padStart(4, '0')}`; }
  impSeq += 1; return `IMP-${String(impSeq).padStart(4, '0')}`;
}

/* ═══════════ Support Activity — chat-level stats (frontend-only demo) ═══════════
   No backend module tracks chat sessions with timestamps yet (see
   components/AgentSupport.jsx / support/*), so this is a small, clearly
   separate seed of session-level counts the Dashboard "Support Activity"
   card can read today and swap for a real endpoint later. */
const SUPPORT_SESSIONS = [
  { id: 'sess-1048', initiatedAt: ago(30 * 60 * 1000), status: 'open' },
  { id: 'sess-1047', initiatedAt: ago(1 * H), status: 'open' },
  { id: 'sess-1046', initiatedAt: ago(2 * H), status: 'open' },
  { id: 'sess-1045', initiatedAt: ago(9 * H), status: 'open' },
  { id: 'sess-1044', initiatedAt: ago(5 * H), status: 'closed' },
  { id: 'sess-1043', initiatedAt: ago(1 * D + 3 * H), status: 'closed' },
  { id: 'sess-1042', initiatedAt: ago(2 * D + 3 * H), status: 'open' },
  { id: 'sess-1041', initiatedAt: ago(1 * D + 1 * H), status: 'open' },
  { id: 'sess-1040', initiatedAt: ago(20 * H), status: 'closed' },
  { id: 'sess-1039', initiatedAt: ago(1 * D + 6 * H), status: 'open' },
  { id: 'sess-1038', initiatedAt: ago(4 * D), status: 'closed' },
  { id: 'sess-1037', initiatedAt: ago(2 * D + 2 * H), status: 'closed' },
  { id: 'sess-1036', initiatedAt: ago(2 * D + 8 * H), status: 'open' },
  { id: 'sess-1034', initiatedAt: ago(4 * D + 2 * H), status: 'open' },
  { id: 'sess-1033', initiatedAt: ago(3 * D), status: 'closed' },
  { id: 'sess-1030', initiatedAt: ago(6 * D), status: 'closed' },
  { id: 'sess-1028', initiatedAt: ago(5 * D), status: 'open' },
  { id: 'sess-1025', initiatedAt: ago(7 * D), status: 'closed' },
  { id: 'sess-1022', initiatedAt: ago(8 * D), status: 'closed' },
  { id: 'sess-1020', initiatedAt: ago(10 * D), status: 'closed' },
  { id: 'sess-1018', initiatedAt: ago(12 * D), status: 'closed' },
  { id: 'sess-1015', initiatedAt: ago(11 * D), status: 'closed' },
  { id: 'sess-1012', initiatedAt: ago(10 * D), status: 'closed' },
  { id: 'sess-1010', initiatedAt: ago(15 * D), status: 'closed' },
  { id: 'sess-1006', initiatedAt: ago(9 * D), status: 'closed' },
  { id: 'sess-0998', initiatedAt: ago(18 * D), status: 'closed' },
  { id: 'sess-0980', initiatedAt: ago(22 * D), status: 'closed' },
  { id: 'sess-0965', initiatedAt: ago(26 * D), status: 'closed' },
];

export function supportStats(range) {
  const inR = range && range.from ? SUPPORT_SESSIONS.filter((s) => inRange(s.initiatedAt, range)) : SUPPORT_SESSIONS;
  return {
    initiated: inR.length,
    open: inR.filter((s) => s.status === 'open').length,
    closed: inR.filter((s) => s.status === 'closed').length,
  };
}

/* Simple 7-day trend for the optional Dashboard sparkline. */
export function supportTrend() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(); dayStart.setDate(dayStart.getDate() - i); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);
    const count = SUPPORT_SESSIONS.filter((s) => {
      const t = new Date(s.initiatedAt).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    }).length;
    days.push({ label: dayStart.toLocaleDateString('en-US', { weekday: 'short' }), count });
  }
  return days;
}
