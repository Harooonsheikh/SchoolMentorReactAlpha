/* ═══════════════════════════════════════════════════════════════════
   USER PERMISSIONS — mock data + constants

   Everything here is in-memory. Replace the seed arrays with API calls
   when wiring a backend; the rest of the module is shape-stable.
   ═══════════════════════════════════════════════════════════════════ */

import { MODULE_TO_TREE_MAP } from '../../config/moduleConfig';

/* ─── Supported permission actions ─── */
export const PERMISSION_ACTIONS = [
  'view', 'create', 'edit', 'delete', 'approve',
  'download', 'print', 'import', 'share',
  'assign', 'manage_settings',
];

/* Default visible columns in the matrix; the rest unlock via "More ▼". */
export const PRIMARY_ACTIONS  = ['view', 'create', 'edit', 'delete', 'approve', 'download', 'print'];
export const ADVANCED_ACTIONS = ['import', 'share', 'assign', 'manage_settings'];

export const ACTION_LABELS = {
  view:            'View',
  create:          'Create',
  edit:            'Edit',
  delete:          'Delete',
  approve:         'Approve',
  download:        'Download',
  print:           'Print',
  import:          'Import',
  share:           'Share',
  assign:          'Assign',
  manage_settings: 'Settings',
};

/* ─── Module tree — every module has a flat list of sub-items (screens). ─── */
export const MODULE_TREE = [
  { id: 'academics',   label: 'Academics',         icon: 'fa-book-open-reader',
    children: [
      /* ── Scheme of Studies branch — mirrors the L2 tabs inside the
            "sos" L1 tab of the real Academics module. */
      { id: 'academics.textbooks',    label: 'Textbooks',          group: 'Scheme of Studies' },
      { id: 'academics.terms',        label: 'Term Settings',      group: 'Scheme of Studies' },
      { id: 'academics.acal',         label: 'Academic Calendar',  group: 'Scheme of Studies' },
      { id: 'academics.actcal',       label: 'Activity Calendar',  group: 'Scheme of Studies' },

      /* ── Lesson Plans branch — mirrors the L2 sub-tabs inside the
            "lp" L1 tab (LessonPlans.jsx → tab = session | breakup |
            create | view). */
      { id: 'academics.session',      label: 'Session Settings',     group: 'Lesson Plans' },
      { id: 'academics.breakups',     label: 'Term Breakups',        group: 'Lesson Plans' },
      { id: 'academics.createlp',     label: 'Create Lesson Plans',  group: 'Lesson Plans' },
      { id: 'academics.submissions',  label: 'Submissions',          group: 'Lesson Plans' },
    ] },
  { id: 'examination', label: 'Examination',       icon: 'fa-file-pen',
    children: [
      /* ── L1 tabs that are themselves leaf screens. */
      { id: 'exam.setup',          label: 'Exam Setup' },
      { id: 'exam.datesheet',      label: 'Date Sheet' },
      { id: 'exam.syllabus',       label: 'Syllabus' },

      /* ── Results L1 tab → 5 real sub-tabs (rsTab / rsL2 in
            Examination.jsx). Treated as siblings with a "Results"
            group so the matrix shows them together. */
      { id: 'exam.resultsetup',    label: 'Result Setup',          group: 'Results' },
      { id: 'exam.cardoptions',    label: 'Result Card Options',   group: 'Results' },
      { id: 'exam.singleresult',   label: 'Single Assessment',     group: 'Results' },
      { id: 'exam.combinedresult', label: 'Combined Assessment',   group: 'Results' },
      { id: 'exam.history',        label: 'Result History',        group: 'Results' },
    ] },
  { id: 'papers',      label: 'Paper Generator',   icon: 'fa-scroll',
    children: [
      /* ── Exactly the two L1 tabs in PaperGenerator.jsx
            (tab = 'setup' | 'generator'). */
      { id: 'papers.setup',     label: 'Paper Setup' },
      { id: 'papers.generator', label: 'Paper Generator' },
    ] },
  { id: 'attendance',  label: 'Attendance',        icon: 'fa-clipboard-check',
    children: [
      /* ── Exactly the 4 L1 tabs in Attendance.jsx (TABS array @ 2951).
            Holidays Setup was previously unmapped despite being the
            first tab. */
      { id: 'att.holidays', label: 'Holidays Setup' },
      { id: 'att.student',  label: 'Student Attendance' },
      { id: 'att.staff',    label: 'Staff Attendance' },
      { id: 'att.reports',  label: 'Reports' },
    ] },
  { id: 'timetable',   label: 'Timetable',        icon: 'fa-calendar-days',
    children: [
      /* ── Single screen in TimeTable.jsx:552 — no L1 sub-tabs.
            Old split (tt.view + tt.manage) was artificial. */
      { id: 'tt.timetable', label: 'Timetable' },
    ] },
  { id: 'fee',         label: 'Fee',               icon: 'fa-money-bill-wave',
    children: [
      /* ── 5 L1 tabs (FEE_TABS @ Fee.jsx:50). The first L1 tab
            "Fee Setup & Settings" has 3 distinct sub-segments
            (STRUCTURE_SEGS @ :60) which are treated as separate
            permission screens since they cover different data
            domains. The other L1 tabs do not need granular splits. */

      /* L1 → Fee Setup & Settings (3 segments) */
      { id: 'fee.studentsetup',   label: 'Student Fee Setup',    group: 'Fee Setup & Settings' },
      { id: 'fee.transportsetup', label: 'Transport Fee Setup',  group: 'Fee Setup & Settings' },
      { id: 'fee.settings',       label: 'Fee Challan Settings', group: 'Fee Setup & Settings' },

      /* L1 → Fee Challans (Individual + Family Tree merged) */
      { id: 'fee.challans',       label: 'Fee Challans' },

      /* L1 → Fee Receiving (Individual + Family Tree merged) */
      { id: 'fee.receiving',      label: 'Fee Receiving' },

      /* L1 → Fee History (previously missing from tree) */
      { id: 'fee.history',        label: 'Fee History' },

      /* L1 → Reports */
      { id: 'fee.reports',        label: 'Reports' },
    ] },
  { id: 'accounts',    label: 'Accounts',          icon: 'fa-calculator',
    children: [
      /* ── 4 L1 tabs (ACC_TABS @ Accounts.jsx:18). The old tree was
            missing Chart of Accounts, Transactions, and Account Books
            entirely — only Reports + a non-existent Statements
            screen were mapped. */
      { id: 'acc.coa',     label: 'Chart of Accounts' },
      { id: 'acc.txn',     label: 'Transactions' },
      { id: 'acc.books',   label: 'Account Books' },
      { id: 'acc.reports', label: 'Reports' },
    ] },
  { id: 'inventory',   label: 'Inventory',         icon: 'fa-boxes-stacked',
    children: [
      /* ── 3 L1 tabs (INV_TABS @ Inventory.jsx:662). The POS tab has
            3 sub-tabs (POS_SUBTABS @ :1533) that cover distinct
            workflows (sell vs manage products vs view history) so
            they get separate permissions. */
      { id: 'inv.manage',       label: 'Inventory Management' },
      { id: 'inv.pos.sell',     label: 'POS — New Sale',       group: 'Point of Sale' },
      { id: 'inv.pos.products', label: 'POS — Products',       group: 'Point of Sale' },
      { id: 'inv.pos.history',  label: 'POS — Sales History',  group: 'Point of Sale' },
      { id: 'inv.reports',      label: 'Reports' },
    ] },
  { id: 'admissions',  label: 'Admission CRM',     icon: 'fa-user-plus',
    children: [
      /* ── 4 L1 tabs (CRM_TABS @ AdmissionCrm.jsx:725). The old
            tree had Inquiries/Enrollment that don't exist; the real
            tabs are Lead Setup, Active Leads, Inactive Leads,
            Reports. */
      { id: 'adm.setup',    label: 'Lead Setup' },
      { id: 'adm.active',   label: 'Active Leads' },
      { id: 'adm.inactive', label: 'Inactive Leads' },
      { id: 'adm.reports',  label: 'Reports' },
    ] },
  { id: 'students',    label: 'Students',          icon: 'fa-user-graduate',
    children: [
      /* ── 3 L1 tabs (STU_TABS @ Students.jsx:1040). The old tree
            had standalone "Certificates" and "ID Cards" screens —
            those don't exist as top-level tabs; both are sub-actions
            opened from Active Students per-row menu (cert dropdown +
            Bulk ID button + per-row Download ID Card). */
      { id: 'stu.active',   label: 'Active Students' },
      { id: 'stu.inactive', label: 'Inactive Students' },
      { id: 'stu.family',   label: 'Family Tree' },
    ] },
  { id: 'hr',          label: 'Human Resource',    icon: 'fa-users',
    children: [
      /* ── 4 L1 tabs (HR_TABS @ HumanResource.jsx:42). The old
            6-entry tree split Task Assignment, Letters, Loans into
            standalone screens — those don't exist as top-level
            tabs. Tasks + Letters are per-row actions inside Employee
            Management. Loans surface only as the Loan Ledger report
            inside Reports. */
      { id: 'hr.basics',    label: 'HR Basics' },
      { id: 'hr.employees', label: 'Employee Management' },
      { id: 'hr.finance',   label: 'Financials' },
      { id: 'hr.reports',   label: 'Reports' },
    ] },
  { id: 'appraisals',  label: 'Staff Appraisals',  icon: 'fa-star-half-stroke',
    children: [
      /* ── 3 L1 sub-tabs (APR_SUBTABS @ StaffAppraisal.jsx:26).
            sub = 'setup' | 'conduct' | 'reports'. */
      { id: 'apr.setup',   label: 'Setup' },
      { id: 'apr.run',     label: 'Appraisals' },
      { id: 'apr.reports', label: 'Reports' },
    ] },
  { id: 'sops',        label: 'School SOPs',       icon: 'fa-book-open',
    children: [
      /* ── Single screen (SchoolSOPs.jsx:86) with two
            distinct read-only actions: view manuals and watch the
            tutorial popup. Kept as two permissions so admins can
            grant manual-viewing without tutorial-viewing. */
      { id: 'sop.view',     label: 'View Manuals' },
      { id: 'sop.tutorial', label: 'Watch Tutorials' },
    ] },
  { id: 'trainings',   label: 'Teacher Trainings', icon: 'fa-chalkboard-user',
    children: [
      /* ── Single screen (TeacherTrainings.jsx:117) — read-only
            recorded-workshop library. */
      { id: 'trn.view', label: 'View Trainings' },
    ] },
  { id: 'settings',    label: 'Settings',          icon: 'fa-gear',
    children: [
      /* ── 2 L1 sub-tabs (SETTINGS_SUBTABS @ SettingsModule.jsx:20). */
      { id: 'set.sessions',   label: 'Academic Sessions' },
      { id: 'set.signatures', label: 'Signature Management' },
    ] },
  { id: 'permissions', label: 'User Permissions',  icon: 'fa-shield-halved',
    children: [
      /* ── 4 L1 tabs (TABS @ UserPermissions.jsx:25). */
      { id: 'perm.users',  label: 'Users' },
      { id: 'perm.roles',  label: 'Roles' },
      { id: 'perm.groups', label: 'Permission Groups' },
      { id: 'perm.audit',  label: 'Audit Logs' },
    ] },
  { id: 'auditlogs',   label: 'Audit Logs',        icon: 'fa-clipboard-list',
    children: [
      /* ── Standalone Audit Logs module (AuditLogs.jsx).
            Single read-only screen with filters + table +
            read-only details modal + Reports panel (A4 viewer
            with CSV export + print). Distinct from the
            "Audit Logs" tab inside User Permissions (which only
            shows role/permission changes). */
      { id: 'audit.logs', label: 'Activity Logs' },
    ] },
];

/* ─── Filter MODULE_TREE to only modules that are active in the
       given moduleState. moduleState comes from ModuleContext and
       uses MODULE_REGISTRY.id keys (e.g. 'paper_generator'). The
       MODULE_TO_TREE_MAP translates those to the prefixes used in
       MODULE_TREE.id (e.g. 'papers'). Modules not present in the
       map (or with `active === false`) are filtered out. Never
       mutates MODULE_TREE itself. */
export function getActiveModuleTree(moduleState) {
  if (!moduleState) return MODULE_TREE;
  const activeTreeIds = new Set(
    Object.entries(moduleState)
      .filter(([, active]) => active !== false)
      .map(([id]) => MODULE_TO_TREE_MAP[id])
      .filter(Boolean)
  );
  return MODULE_TREE.filter(m => activeTreeIds.has(m.id));
}

/* ─── Module-wise permission availability map ─────────────────────────
   Lists ONLY the actions that make sense for each screen. Anything not
   in this list is rendered as a disabled (greyed-out) checkbox and is
   excluded from selections, templates, stats and saved state.
   ─────────────────────────────────────────────────────────────────── */
export const MODULE_PERMISSIONS = {
  /* ─── ACADEMICS — derived from real buttons in Academics.js +
         LessonPlans.js (audited 2026-05-31). Each list contains ONLY
         the actions that have a matching button / handler wired in
         the actual UI. Anything missing is intentional and rendered
         disabled by EditPermissionsPanel. */

  /* Scheme of Studies → Textbooks
     TextBooks component (Academics.js:1879)
     Real buttons: PDF download, Word download, expand-collapse.
     No Add, no Edit, no Delete, no Approve. */
  'academics.textbooks':   ['view', 'download'],

  /* Scheme of Studies → Term Settings
     TermSettings component (Academics.js:1599)
     Real buttons: Add new term, Save Term, Delete Term,
                   Save Session (manage_settings sub-tab).
     No PDF/Word, no Approve. */
  'academics.terms':       ['view', 'create', 'edit', 'delete', 'manage_settings'],

  /* Scheme of Studies → Academic Calendar
     AcademicCalendar component (Academics.js:1536)
     Real buttons: Edit (key dates modal), PDF, Word.
     No Add, no Delete, no Approve. */
  'academics.acal':        ['view', 'edit', 'download'],

  /* Scheme of Studies → Activity Calendar
     ActivityCalendar component (Academics.js:856)
     Real buttons: Add Activity, Edit (3-dot menu), Delete (3-dot),
                   PDF, Word.
     No Approve, no Assign. */
  'academics.actcal':      ['view', 'create', 'edit', 'delete', 'download'],

  /* Lesson Plans → Session Settings
     SessionSettings component (LessonPlans.js:384)
     Real buttons: Edit Session, Edit Vacations, multiple PDF report
                   buttons. The whole screen IS settings.
     No Add (single session), no Delete, no Approve. */
  'academics.session':     ['view', 'edit', 'download', 'manage_settings'],

  /* Lesson Plans → Term Breakups
     TermBreakups component (LessonPlans.js:885)
     Real buttons: Update (modal), Delete, PDF, Word.
     Classes are pre-seeded — no Add new class. */
  'academics.breakups':    ['view', 'edit', 'delete', 'download'],

  /* Lesson Plans → Create Lesson Plans
     CreateLessonPlans component (LessonPlans.js:1183)
     Real buttons: Manage Units (add), Edit Lesson, Delete Unit/Lesson,
                   Add Question Type, Edit/Delete Question Type,
                   PDF/Word reports per unit and per lesson.
     No Approve, no Assign. */
  'academics.createlp':    ['view', 'create', 'edit', 'delete', 'download'],

  /* Lesson Plans → Submissions
     Submissions component (LessonPlans.js:1570)
     Real buttons: Submit (flips status), Generate PDF Report,
                   open lesson plan details viewer.
     No explicit Approve workflow, no Create, no Delete. */
  'academics.submissions': ['view', 'edit', 'download'],

  /* ─── EXAMINATION — derived from real buttons in Examination.jsx
         (audited 2026-05-31). The L1 tab list is setup / datesheet /
         syllabus / results, and "results" contains its own 5-tab
         strip (rsTab + rsL2 in source). Each list contains ONLY
         the actions that have a matching button / handler. */

  /* L1 → Exam Setup
     Examination.jsx:566
     Real buttons: Add Exam, Edit, Delete, PDF, Word.
     No Approve at config level, no Print. */
  'exam.setup':          ['view', 'create', 'edit', 'delete', 'download'],

  /* L1 → Date Sheet
     Examination.jsx:731
     Real buttons: Edit (auto-creates if missing), Delete, PDF, Word,
                   Copy to all classes (bulk edit). No Approve. */
  'exam.datesheet':      ['view', 'create', 'edit', 'delete', 'download'],

  /* L1 → Syllabus
     Examination.jsx:901
     Real buttons: Edit (auto-creates if missing), Delete, PDF, Word.
     No Approve, no Assign. */
  'exam.syllabus':       ['view', 'create', 'edit', 'delete', 'download'],

  /* L1 Results → Result Setup → setup sub-panel
     Examination.jsx:1090 (rsTab=resultsetup + rsL2=setup)
     Real buttons: PDF, Edit (opens grades/sigs/remarks/absent modal).
     No Create (one config exists), no Delete, no Approve. */
  'exam.resultsetup':    ['view', 'edit', 'download', 'manage_settings'],

  /* L1 Results → Result Setup → Card Options sub-panel
     Examination.jsx:1222 (rsTab=resultsetup + rsL2=cardoptions)
     Real buttons: Preview template, toggle on/off general items,
                   toggle on/off signature items, Save Preferences.
     No Create, no Delete, no Download, no Approve. */
  'exam.cardoptions':    ['view', 'edit', 'manage_settings'],

  /* L1 Results → Single Assessment
     Examination.jsx:1359 (rsTab=singleassessment)
     Real buttons: Update marks, Add/edit remarks, Edit total marks,
                   Publish/Unpublish, Delete class data,
                   Download class result report, View result card. */
  'exam.singleresult':   ['view', 'create', 'edit', 'delete', 'approve', 'download'],

  /* L1 Results → Combined Assessment
     Examination.jsx:1637 (rsTab=combinedassessment)
     Real buttons: Create new combined assessment, Publish/Unpublish,
                   Delete, Download combined report, View card.
     No direct Edit (data is derived from singles). */
  'exam.combinedresult': ['view', 'create', 'delete', 'approve', 'download'],

  /* L1 Results → Result History
     Examination.jsx:1892 (rsTab=resulthistory)
     Real buttons: View result card, Download (card / progress /
                   comparison / attendance reports).
     History is read-only — no Create, no Edit, no Delete, no Approve. */
  'exam.history':        ['view', 'download'],

  /* ─── PAPER GENERATOR — derived from real buttons in
         PaperGenerator.jsx (audited 2026-05-31). The module has
         exactly two L1 tabs and no further nesting. */

  /* L1 → Paper Setup
     PaperGenerator.jsx:178 (tab=setup)
     Real buttons: Choose template card (radio), Preview template,
                   Global Default segmented (With/Without sheet,
                   Single/Four line), per-class + per-subject format
                   and line dropdowns. No Create, no Delete, no
                   Download (templates are previewed, not exported),
                   no Approve. */
  'papers.setup':       ['view', 'edit', 'manage_settings'],

  /* L1 → Paper Generator
     PaperGenerator.jsx:417 + PapersGrid card actions (line 558)
     Real buttons: Make Paper (create), per-card Edit, Shuffle,
                   Preview (view), Download (PDF/Word), Delete.
     No Approve, no Assign — no approval workflow exists for
     generated papers. No Print button — Download covers PDF/Word. */
  'papers.generator':   ['view', 'create', 'edit', 'delete', 'download'],

  /* ─── ATTENDANCE — derived from real buttons in Attendance.jsx
         (audited 2026-05-31). The module has 4 L1 tabs and no
         further nesting. */

  /* L1 → Holidays Setup
     Attendance.jsx:157 (HolidaysTab)
     Real buttons: Save Weekly Off, Toggle weekly-off day,
                   Add Holiday, Edit Holiday, Delete Holiday,
                   Download Yearly Holiday Report (PDF).
     The weekly-off picker IS a settings panel. */
  'att.holidays':       ['view', 'create', 'edit', 'delete', 'download', 'manage_settings'],

  /* L1 → Student Attendance
     Attendance.jsx:1490 (StudentTab)
     Real buttons: Mark Attendance (first-time = create),
                   Update Attendance (= edit),
                   Download today's PDF (per class),
                   Download monthly PDF (per class + overall).
     No Approve workflow, no Delete, no Print. */
  'att.student':        ['view', 'create', 'edit', 'download'],

  /* L1 → Staff Attendance
     Attendance.jsx:1939 (StaffTab)
     Real buttons: Mark Today's Attendance (= create),
                   Update Today's Attendance (= edit),
                   Download today's PDF (per staff),
                   Download monthly PDF (per staff + overall).
     No Approve, no Delete, no Print. */
  'att.staff':          ['view', 'create', 'edit', 'download'],

  /* L1 → Reports
     Attendance.jsx:2427 (ReportsTab)
     Real buttons: Generate General Report (class-wide + staff-wide),
                   Generate Individual Report (per student / staff).
     Reports are downloaded as PDFs — no Print, no Create/Edit/Delete. */
  'att.reports':        ['view', 'download'],

  /* ─── TIME TABLE — derived from real buttons in TimeTable.jsx
         (audited 2026-05-31). Single screen, no L1 nesting. The
         day selector is just a filter on the same screen. */

  /* L1 → Timetable (single screen)
     TimeTable.jsx:552
     Real buttons: Auto Generate (multi-step wizard creates the
                   full weekly timetable), Delete Day, Download
                   School Report, per-class Update, per-class PDF.
     No Approve, no Assign, no Print, no manage_settings (toolbar
     toggles are inline state, not a settings panel). */
  'tt.timetable':       ['view', 'create', 'edit', 'delete', 'download'],

  /* ─── FEE — derived from real buttons in Fee.jsx (audited
         2026-05-31). The module has 5 L1 tabs; the first one
         ("Fee Setup & Settings") splits into 3 segment screens. */

  /* L1 → Fee Setup & Settings → Student Fee Setup
     Fee.jsx:156 (StudentFeeSetup)
     Real buttons: Edit fee heads (per class), Copy to all classes,
                   Download class PDF.
     No Add (classes pre-exist), no Delete, no Approve. */
  'fee.studentsetup':    ['view', 'edit', 'download'],

  /* L1 → Fee Setup & Settings → Transport Fee Setup
     Fee.jsx:364 (TransportFeeSetup)
     Real buttons: Edit transport fee per student, Download list PDF.
     No Add, no Delete, no Approve. */
  'fee.transportsetup':  ['view', 'edit', 'download'],

  /* L1 → Fee Setup & Settings → Fee Challan Settings
     Fee.jsx:7923 (FeeChallanSettings)
     Real buttons: Toggle fine enabled, Save settings.
     The screen IS a settings panel. */
  'fee.settings':        ['view', 'edit', 'manage_settings'],

  /* L1 → Fee Challans (Individual + Family Tree segments share
                         the same button set)
     Fee.jsx:659 (FeeChallansTab) + 1201 (FeeChallansList) +
                  698 (FamilyTreeChallansList)
     Real buttons: Bulk Generate, Generate individual,
                   Delete generated (bulk + per student),
                   Preview, Download (single + bulk PDF),
                   Apply discount.
     No Approve, no Assign. */
  'fee.challans':        ['view', 'create', 'edit', 'delete', 'download'],

  /* L1 → Fee Receiving (Individual + Family Tree)
     Fee.jsx:3163 (FeeReceivingTab) + 3187 (FeeReceivingIndividual)
     Real buttons: Receive payment (open form), Receive more,
                   View transaction, Download receipt slip,
                   Delete manual receipt, Send reminder.
     No Approve (receipts are recorded directly, no two-step). */
  'fee.receiving':       ['view', 'create', 'edit', 'delete', 'download'],

  /* L1 → Fee History
     Fee.jsx:4873 (FeeHistoryTab)
     Real buttons: View ledger/detail (read-only),
                   Download detailed/ledger PDF.
     History is read-only — no Create/Edit/Delete/Approve. */
  'fee.history':         ['view', 'download'],

  /* L1 → Reports
     Fee.jsx:5928 (FeeReportsTab)
     Real buttons: View report, Preview, Download (PDF / Colorful
                   / Colorless / Excel — depending on report type).
     No Print button explicitly — Preview + Download cover it. */
  'fee.reports':         ['view', 'download'],

  /* ─── ACCOUNTS — derived from real buttons in Accounts.jsx
         (audited 2026-05-31). 4 L1 tabs (ACC_TABS @ :18). */

  /* L1 → Chart of Accounts
     Accounts.jsx:89 (ChartOfAccounts)
     Real buttons: Add new head (per top-level type), Edit head,
                   Delete head, expand/collapse type.
     No Approve, no Download (the COA itself doesn't export). */
  'acc.coa':            ['view', 'create', 'edit', 'delete'],

  /* L1 → Transactions
     Accounts.jsx:553 (Transactions)
     Real buttons: Add Revenue/Expenditure entry, Edit entry,
                   Delete entry, Download voucher (per entry),
                   Download full audit report (PDF/Excel/CSV).
     Segments (rev/exp) share the same button set. */
  'acc.txn':            ['view', 'create', 'edit', 'delete', 'download'],

  /* L1 → Account Books
     Accounts.jsx:2161 (AccountBooks) + 2502 (BookDetail)
     Real buttons: Open new book, Edit book, Delete book,
                   Record new ledger entry, Download A4 ledger PDF. */
  'acc.books':          ['view', 'create', 'edit', 'delete', 'download'],

  /* L1 → Reports
     Accounts.jsx:3475 (Reports)
     Real buttons: Switch report type (revenue/expense/P&L/etc.),
                   Reload, Download (PDF / Excel / CSV).
     Read-only otherwise — no Create/Edit/Delete/Approve/Print. */
  'acc.reports':        ['view', 'download'],

  /* ─── INVENTORY — derived from real buttons in Inventory.jsx
         (audited 2026-05-31). 3 L1 tabs; POS has 3 sub-tabs. */

  /* L1 → Inventory Management
     Inventory.jsx:749 (InventoryManagement)
     Real buttons: Create item, View detail, Edit, Mark Inactive,
                   Restore to active, Delete permanently,
                   Print barcode Label.
     Print IS used here (barcode labels) — first Print button in the
     audit so far. */
  'inv.manage':          ['view', 'create', 'edit', 'delete', 'print'],

  /* L1 POS → New Sale
     Inventory.jsx:1691 (PosSellView)
     Real buttons: Add to cart, Checkout (creates sale + receipt),
                   Print receipt (thermal or A4).
     No Edit (sales finalised on checkout), no Delete. */
  'inv.pos.sell':        ['view', 'create', 'print'],

  /* L1 POS → Products
     Inventory.jsx:2071 (PosProductsView)
     Real buttons: Add product, Edit product, Delete product. */
  'inv.pos.products':    ['view', 'create', 'edit', 'delete'],

  /* L1 POS → Sales History
     Inventory.jsx:2475 (PosSalesView)
     Real buttons: Reprint receipt, Download A4 sales-list PDF
                   (Colorful / Colorless). */
  'inv.pos.history':     ['view', 'download', 'print'],

  /* L1 → Reports
     Inventory.jsx:2868 (InvReports)
     Real buttons: Open report tile, Print, Save as PDF (with
                   Colorful/Colorless toggle). */
  'inv.reports':         ['view', 'download', 'print'],

  /* ─── ADMISSION CRM — derived from real buttons in
         AdmissionCrm.jsx (audited 2026-05-31). 4 L1 tabs. */

  /* L1 → Lead Setup
     AdmissionCrm.jsx:2407 (LeadSetup)
     Real buttons: Add Class, Add uniform/books/fee charges,
                   Edit, Remove per class.
     The screen IS a setup/configuration panel. */
  'adm.setup':          ['view', 'create', 'edit', 'delete', 'manage_settings'],

  /* L1 → Active Leads
     AdmissionCrm.jsx:801 (ActiveLeads)
     Real buttons: Add lead, Edit lead, Set Status (edit),
                   Set Officer (assign), Move to inactive,
                   Download lead PDF, Export bulk (PDF/Excel/CSV),
                   Follow-up, Share fee, Generate admission form. */
  'adm.active':         ['view', 'create', 'edit', 'delete', 'download', 'assign'],

  /* L1 → Inactive Leads
     AdmissionCrm.jsx:3295 (InactiveLeads)
     Real buttons: Download admission/rejection report (A4 PDF),
                   Reactivate (move back to Active),
                   Delete permanently. */
  'adm.inactive':       ['view', 'edit', 'delete', 'download'],

  /* L1 → Reports
     AdmissionCrm.jsx:3650 (CrmReports)
     Real buttons: View report, Download as PDF.
     Read-only otherwise. */
  'adm.reports':        ['view', 'download'],

  /* ─── STUDENTS — derived from real buttons in Students.jsx
         (audited 2026-05-31). 3 L1 tabs only — Certificates and
         ID Cards are sub-actions inside Active Students, not
         standalone screens. */

  /* L1 → Active Students
     Students.jsx:1149 (ActiveStudents)
     Real buttons: Add student, Edit student, Mark Inactive,
                   Promote section, Bulk ID Cards, Download class /
                   whole-school report, Print Admission Form,
                   Download Student Profile, Download ID Card,
                   Generate Certificate (appreciation / character /
                   leaving), Add to family. */
  'stu.active':         ['view', 'create', 'edit', 'delete', 'download', 'print'],

  /* L1 → Inactive Students
     Students.jsx:2362 (InactiveStudents)
     Real buttons: Download all-inactive report, Download group
                   report, Reactivate (move back), Pending dues
                   download, Certificate download, Profile download.
     No Create (students come from Active flow), no permanent
     Delete in this tab. */
  'stu.inactive':       ['view', 'edit', 'download'],

  /* L1 → Family Tree
     Students.jsx:4273 (FamilyTree)
     Real buttons: Add family, Edit family, Delete family.
     Students are linked from Active Students "Add to Family" menu. */
  'stu.family':         ['view', 'create', 'edit', 'delete'],

  /* ─── HUMAN RESOURCE — derived from real buttons in
         HumanResource.jsx (audited 2026-05-31). 4 L1 tabs (HR_TABS
         @ :42). Task Assignment / HR Letters / Advances & Loans are
         sub-actions or report subtypes, not standalone screens. */

  /* L1 → HR Basics
     HumanResource.jsx:186 (HrBasics)
     Real buttons: Add department, Edit department, Delete
                   department, Add designation (per dept),
                   Edit designation, Delete designation. */
  'hr.basics':          ['view', 'create', 'edit', 'delete'],

  /* L1 → Employee Management
     HumanResource.jsx:749 (EmployeeManagement)
     Real buttons: Add employee, Edit employee, Mark Inactive,
                   Mark Active again, Delete permanently,
                   Download profile PDF, Assign task, Issue letter
                   (Experience / Salary / etc.), Reprint letter. */
  'hr.employees':       ['view', 'create', 'edit', 'delete', 'download', 'assign'],

  /* L1 → Financials (Payroll)
     HumanResource.jsx:1641 (Financials)
     Real buttons: Generate Payroll for period (create run),
                   Delete payroll run, Mark Paid (approve),
                   Roll back to Pending (edit), View/Download
                   salary slip, Bulk select + Mark Paid. */
  'hr.finance':         ['view', 'create', 'edit', 'delete', 'approve', 'download'],

  /* L1 → Reports
     HumanResource.jsx:2939 (Reports)
     Real buttons: Open Employee Directory / Salary Register /
                   Loan Ledger reports; each report opens an A4
                   viewer that can be downloaded as PDF. */
  'hr.reports':         ['view', 'download'],

  /* ─── STAFF APPRAISALS — derived from real buttons in
         StaffAppraisal.jsx (audited 2026-05-31). 3 L1 sub-tabs. */

  /* L1 → Setup
     StaffAppraisal.jsx:73 (sub='setup')
     Real buttons: Toggle parent feedback, Toggle/Edit criteria,
                   Restore Default, Reset (discard changes),
                   Save changes.
     The whole screen IS the appraisal framework configuration.
     No Add/Delete — criteria are pre-defined and edited in place. */
  'apr.setup':          ['view', 'edit', 'manage_settings'],

  /* L1 → Appraisals (conduct)
     StaffAppraisal.jsx:80 (sub='conduct')
     Real buttons: Start new appraisal (3-step wizard creates),
                   View details, Edit scores & remarks, Delete,
                   Print (window.print on report viewer),
                   Download A4 report.
     No explicit Approve workflow — Save commits the appraisal. */
  'apr.run':            ['view', 'create', 'edit', 'delete', 'download', 'print'],

  /* L1 → Reports
     StaffAppraisal.jsx (sub='reports')
     Real buttons: View report tile, A4 viewer with Print + Excel
                   export. */
  'apr.reports':        ['view', 'download', 'print'],

  /* ─── SCHOOL SOPs — derived from real buttons in
         SchoolSOPs.jsx (audited 2026-05-31). Module is fully
         read-only — no Create / Edit / Delete / Download anywhere
         (Download was explicitly removed per spec). */

  /* Open SOP document (PDF viewer + Full Screen button). */
  'sop.view':           ['view'],

  /* Watch tutorial popup (YouTube iframe). */
  'sop.tutorial':       ['view'],

  /* ─── TEACHER TRAININGS — derived from real buttons in
         TeacherTrainings.jsx (audited 2026-05-31). Read-only
         recorded-workshop library. */

  /* Watch recorded training (video player modal). */
  'trn.view':           ['view'],

  /* ─── SETTINGS — derived from real buttons in
         SessionManagement.jsx + SignatureManagement.jsx
         (audited 2026-05-31). 2 L1 sub-tabs. */

  /* L1 → Academic Sessions
     SessionManagement.jsx
     Real buttons: Create session, View details, Edit, Set as
                   Current session, Lock/Unlock, Delete.
     Set-current + Lock are config-level operations. */
  'set.sessions':       ['view', 'create', 'edit', 'delete', 'manage_settings'],

  /* L1 → Signature Management
     SignatureManagement.jsx
     Real buttons: Add signature, View preview, Edit, Activate /
                   Deactivate, Delete. */
  'set.signatures':     ['view', 'create', 'edit', 'delete'],

  /* ─── LAUNCH SETUP — sidebar entry exists but the screen has
         NOT been implemented yet (active='launch' falls through to
         NavComingSoon in App.js:386). Per spec: "If a screen does
         not exist: Do NOT create it." The module + its `lnch.wizard`
         entry have been removed from MODULE_TREE; this comment
         placeholder reminds the next sprint to add real permissions
         when Launch Setup ships. */

  /* ─── USER PERMISSIONS — derived from real buttons in
         UserPermissions.jsx + UsersTab.jsx + RolesTab.jsx +
         PermissionGroupsTab.jsx + AuditLogsTab.jsx (audited
         2026-05-31). 4 L1 tabs (TABS @ UserPermissions.jsx:25). */

  /* L1 → Users
     UsersTab.jsx
     Real buttons: View profile, Edit Permissions (opens
                   EditPermissionsPanel), Assign Role (opens
                   AssignRoleModal), Activate / Deactivate.
     No Create (users come from HR/system); no Delete
     (deactivate replaces delete by design). */
  'perm.users':         ['view', 'edit', 'assign'],

  /* L1 → Roles
     RolesTab.jsx
     Real buttons: Create role, Edit role, Clone role, Delete role. */
  'perm.roles':         ['view', 'create', 'edit', 'delete'],

  /* L1 → Permission Groups
     PermissionGroupsTab.jsx
     Real buttons: Create group, Edit group, Delete group. */
  'perm.groups':        ['view', 'create', 'edit', 'delete'],

  /* L1 → Audit Logs (the tab inside User Permissions)
     AuditLogsTab.jsx — read-only list of role/permission audit
     entries. Per spec: audit logs are immutable even for Super
     Admin. */
  'perm.audit':         ['view'],

  /* ─── AUDIT LOGS (standalone module) — derived from real buttons
         in AuditLogs.jsx + LogDetailsModal.jsx + ReportsPanel.jsx
         (audited 2026-05-31). Distinct from the perm.audit tab
         inside User Permissions: this module tracks ALL ERP
         activity (cross-module), while perm.audit tracks ONLY
         permission-related changes.

     Real buttons: View log entry (read-only modal), Filter,
                   Reports dropdown (Audit Summary / User Activity /
                   Module Activity), A4 viewer with Print + Excel
                   (CSV) export.
     Per spec: audit logs are IMMUTABLE — no Create / Edit / Delete
     anywhere, not even for Super Admin. */
  'audit.logs':         ['view', 'download', 'print'],
};

/* Get the list of actions that are applicable for a screen id. */
export function getApplicablePerms(screenId) {
  return MODULE_PERMISSIONS[screenId] || ['view'];
}

/* Is a permission applicable for a screen? */
export function isPermApplicable(screenId, action) {
  return getApplicablePerms(screenId).includes(action);
}

/* ─── Role templates — quick populate the matrix from a preset. ─── */
export const ROLE_TEMPLATES = {
  super_admin:       { label: 'Super Admin', giveAll: true },
  principal:         { label: 'Principal',
    modules: ['academics', 'examination', 'papers', 'attendance', 'timetable', 'fee', 'accounts', 'students', 'hr', 'appraisals', 'admissions', 'sops', 'trainings', 'settings', 'permissions'],
    actions: ['view', 'create', 'edit', 'delete', 'approve', 'download', 'print', 'assign'] },
  teacher:           { label: 'Teacher',
    modules: ['academics', 'attendance', 'timetable', 'sops', 'trainings'],
    actions: ['view', 'create', 'edit'] },
  accountant:        { label: 'Accountant',
    modules: ['fee', 'accounts', 'inventory'],
    actions: ['view', 'create', 'edit', 'print', 'download'] },
  hr_officer:        { label: 'HR Officer',
    modules: ['hr', 'appraisals', 'attendance'],
    actions: ['view', 'create', 'edit', 'approve', 'print'] },
  admission_officer: { label: 'Admission Officer',
    modules: ['admissions', 'students', 'fee'],
    actions: ['view', 'create', 'edit', 'print'] },
  coordinator:       { label: 'Coordinator',
    modules: ['academics', 'examination', 'papers', 'attendance', 'timetable', 'students', 'sops', 'trainings'],
    actions: ['view', 'create', 'edit', 'approve', 'print'] },
  front_desk:        { label: 'Front Desk',
    modules: ['admissions', 'students', 'fee'],
    actions: ['view', 'create'] },
  inventory_officer: { label: 'Inventory Officer',
    modules: ['inventory'],
    actions: ['view', 'create', 'edit', 'delete', 'print'] },
};

/* ─── Available colours when creating / editing a role. ─── */
export const ROLE_COLORS = [
  { id: 'blue',   value: '#1E40AF' },
  { id: 'purple', value: '#7C3AED' },
  { id: 'green',  value: '#16A34A' },
  { id: 'amber',  value: '#D97706' },
  { id: 'red',    value: '#DC2626' },
  { id: 'teal',   value: '#0F766E' },
];

/* ─── Seed: Roles ─── */
export const INITIAL_ROLES = [
  { id: 'r1',  name: 'Super Admin',        description: 'Full access to all ERP modules',  color: '#7C3AED', userCount: 1,  template: 'super_admin'       },
  { id: 'r2',  name: 'Principal',          description: 'School leadership full access',   color: '#1E3A8A', userCount: 1,  template: 'principal'         },
  { id: 'r3',  name: 'Vice Principal',     description: 'Academic and admin oversight',    color: '#0284C7', userCount: 1,  template: 'coordinator'       },
  { id: 'r4',  name: 'Coordinator',        description: 'Academic coordination access',    color: '#16A34A', userCount: 3,  template: 'coordinator'       },
  { id: 'r5',  name: 'Teacher',            description: 'Classroom and academic tools',    color: '#2563EB', userCount: 24, template: 'teacher'           },
  { id: 'r6',  name: 'Admission Officer',  description: 'CRM and enrollment access',       color: '#D97706', userCount: 2,  template: 'admission_officer' },
  { id: 'r7',  name: 'Accountant',         description: 'Fee and accounts access',         color: '#DC2626', userCount: 2,  template: 'accountant'        },
  { id: 'r8',  name: 'HR Officer',         description: 'HR and payroll access',           color: '#7C3AED', userCount: 1,  template: 'hr_officer'        },
  { id: 'r9',  name: 'Front Desk',         description: 'Reception and inquiry handling',  color: '#0284C7', userCount: 2,  template: 'front_desk'        },
  { id: 'r10', name: 'Inventory Officer',  description: 'Inventory management access',     color: '#16A34A', userCount: 1,  template: 'inventory_officer' },
];

/* ─── Seed: Permission Groups ─── */
export const INITIAL_GROUPS = [
  { id: 'g1', name: 'Academic Management',    description: 'Bundle for academic staff',   modules: ['academics', 'examination', 'papers', 'timetable'], userCount: 8  },
  { id: 'g2', name: 'Student Management',     description: 'Student-facing modules',      modules: ['students', 'admissions', 'attendance'],            userCount: 12 },
  { id: 'g3', name: 'Finance Management',     description: 'Money + inventory access',    modules: ['fee', 'accounts', 'inventory'],                     userCount: 4  },
  { id: 'g4', name: 'HR Management',          description: 'People operations bundle',    modules: ['hr', 'appraisals'],                                  userCount: 3  },
  { id: 'g5', name: 'Examination Management', description: 'Exam + paper workflows',      modules: ['examination', 'papers'],                             userCount: 6  },
  { id: 'g6', name: 'Content & Training',     description: 'SOPs and trainings library',  modules: ['sops', 'trainings'],                                 userCount: 28 },
];

/* ─── Seed: Users ─── */
export const INITIAL_USERS = [
  /* `dashboardType` controls which dashboard the user sees:
       'admin'   — school-level KPIs (Principals, VP, Coordinators, HR, Accounts, Admin)
       'teacher' — personal workspace scoped to assigned classes
     Default for new users: 'admin'. Set per-user via the new
     "Set Dashboard" action in the Users tab. */
  { id: 'u1', name: 'Dr. Islahudin',    email: 'principal@oxford.edu.pk',  role: 'r2',  employeeId: 'EMP-001', dept: 'Administration', status: 'Active',   lastLogin: 'Today, 11:42 AM',    permType: 'role',   dashboardType: 'admin'   },
  { id: 'u2', name: 'Mr. Ahmed Khan',   email: 'vp@oxford.edu.pk',         role: 'r3',  employeeId: 'EMP-002', dept: 'Administration', status: 'Active',   lastLogin: 'Today, 09:15 AM',    permType: 'role',   dashboardType: 'admin'   },
  { id: 'u3', name: 'Ms. Sarah Noor',   email: 'hr@oxford.edu.pk',         role: 'r8',  employeeId: 'EMP-010', dept: 'HR',             status: 'Active',   lastLogin: 'Yesterday, 3:20 PM', permType: 'role',   dashboardType: 'admin'   },
  { id: 'u4', name: 'Xi',               email: 'xi@oxford.edu.pk',         role: 'r5',  employeeId: 'EMP-005', dept: 'Academics',      status: 'Active',   lastLogin: 'Today, 08:55 AM',    permType: 'custom', customNote: 'Extra attendance export access', dashboardType: 'teacher' },
  { id: 'u5', name: 'Pi',               email: 'pi@oxford.edu.pk',         role: 'r5',  employeeId: 'EMP-004', dept: 'Academics',      status: 'Active',   lastLogin: 'Yesterday, 4:10 PM', permType: 'role',   dashboardType: 'teacher' },
  { id: 'u6', name: 'Fatima Noor',      email: 'frontdesk@oxford.edu.pk',  role: 'r9',  employeeId: 'EMP-022', dept: 'Admin',          status: 'Active',   lastLogin: '2 days ago',         permType: 'role',   dashboardType: 'admin'   },
  { id: 'u7', name: 'Kashif Ali',       email: 'inventory@oxford.edu.pk',  role: 'r10', employeeId: 'EMP-023', dept: 'Operations',     status: 'Inactive', lastLogin: '1 week ago',         permType: 'role',   dashboardType: 'admin'   },
  { id: 'u8', name: 'Zara Hussain',     email: 'accounts@oxford.edu.pk',   role: 'r7',  employeeId: 'EMP-015', dept: 'Finance',        status: 'Active',   lastLogin: 'Today, 10:30 AM',    permType: 'role',   dashboardType: 'admin'   },
];

/* ─── Seed: Audit log ─── */
export const INITIAL_AUDIT = [
  { id: 'a1', date: '31 May 2026', time: '11:42 AM', user: 'Dr. Islahudin', action: 'Permission Assigned', detail: 'Assigned "Custom Access" to Xi (EMP-005) for Attendance Export', performedBy: 'Dr. Islahudin',  type: 'assign'     },
  { id: 'a2', date: '31 May 2026', time: '09:20 AM', user: 'Fatima Noor',   action: 'Role Changed',        detail: 'Role changed from "Teacher" to "Front Desk"',                    performedBy: 'Dr. Islahudin',  type: 'role'       },
  { id: 'a3', date: '30 May 2026', time: '04:15 PM', user: 'Kashif Ali',    action: 'User Deactivated',    detail: 'User account deactivated — EMP-023',                             performedBy: 'Mr. Ahmed Khan', type: 'deactivate' },
  { id: 'a4', date: '29 May 2026', time: '02:30 PM', user: 'Zara Hussain',  action: 'Permission Assigned', detail: 'Assigned "Finance Management" group permissions',                performedBy: 'Dr. Islahudin',  type: 'assign'     },
  { id: 'a5', date: '28 May 2026', time: '10:00 AM', user: 'Pi',            action: 'Role Changed',        detail: 'Role changed from "Coordinator" to "Teacher"',                   performedBy: 'Mr. Ahmed Khan', type: 'role'       },
  { id: 'a6', date: '27 May 2026', time: '03:45 PM', user: 'New User',      action: 'User Activated',      detail: 'New user account activated — EMP-031',                           performedBy: 'Dr. Islahudin',  type: 'activate'   },
];

/* ─── Helpers used across the module ─── */

/* Initials from a name — strips titles like Dr./Mr./Ms. */
export function initialsOf(name) {
  if (!name) return '?';
  const clean = name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./g, '').trim();
  return clean.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}

/* Resolve a role record by id. */
export function findRole(roles, id) {
  return roles.find(r => r.id === id) || null;
}

/* Translate a ROLE_TEMPLATES entry into a flat permission key map.
   Keys are "{subItemId}.{action}" → true. */
export function permsFromTemplate(templateKey) {
  const out = {};
  const tpl = ROLE_TEMPLATES[templateKey];
  if (!tpl) return out;
  const modules = tpl.giveAll
    ? MODULE_TREE.map(m => m.id)
    : (tpl.modules || []);
  const actions = tpl.giveAll
    ? PERMISSION_ACTIONS
    : (tpl.actions || []);
  modules.forEach(mid => {
    const mod = MODULE_TREE.find(m => m.id === mid);
    if (!mod) return;
    mod.children.forEach(child => {
      actions.forEach(a => { out[`${child.id}.${a}`] = true; });
    });
  });
  return out;
}

/* For a user, compute the *effective* permissions:
     custom override → user.customPermissions
     otherwise        → derived from role.template
*/
export function effectivePermsForUser(user, roles) {
  if (user.permType === 'custom' && user.customPermissions) {
    return user.customPermissions;
  }
  const role = findRole(roles, user.role);
  if (!role) return {};
  return permsFromTemplate(role.template);
}

/* Counts used by the permissions footer + chips.
   Only applicable permissions are counted; non-applicable cells are
   ignored even if they happen to be true in state. */
export function permStats(perms) {
  let modules    = 0;
  let screens    = 0;
  let active     = 0;
  let restricted = 0;

  MODULE_TREE.forEach(mod => {
    let moduleHasAny = false;
    mod.children.forEach(child => {
      const applicable = getApplicablePerms(child.id);
      let screenHasAny = false;
      applicable.forEach(a => {
        if (perms?.[`${child.id}.${a}`]) {
          active += 1;
          screenHasAny = true;
        }
      });
      if (screenHasAny) {
        screens     += 1;
        moduleHasAny = true;
      } else {
        restricted += 1;
      }
    });
    if (moduleHasAny) modules += 1;
  });

  return { modules, screens, active, restricted };
}

/* Build an audit entry from the moment of the change. */
export function nextAuditEntry({ user, action, detail, performedBy = 'Dr. Islahudin', type }) {
  const d = new Date();
  return {
    id:    `a${Date.now()}`,
    date:  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time:  d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }),
    user,
    action,
    detail,
    performedBy,
    type,
  };
}

/* Tone helper for the audit-log action badges. */
export function auditTone(type) {
  switch (type) {
    case 'assign':     return 'blue';
    case 'role':       return 'purple';
    case 'activate':   return 'green';
    case 'deactivate': return 'gray';
    case 'remove':     return 'amber';
    default:           return 'gray';
  }
}
