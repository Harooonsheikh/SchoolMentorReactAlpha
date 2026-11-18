/* ═══════════════════════════════════════════════════════════════════
   techModuleCatalog — Platform → SubPlatform → Module cascade feeding
   the Bug / New Development creation form (TicketCreateForm.jsx).

   Pure static reference data, no backend dependency yet. Kept separate
   from techTicketsData.js since it describes *what can be selected*
   on a ticket, not the tickets themselves.
   ═══════════════════════════════════════════════════════════════════ */

export const PLATFORMS = [
  {
    id: 'mobile',
    label: 'Mobile App',
    subPlatforms: [
      { id: 'principal_app', label: 'Principal App' },
      { id: 'teacher_app', label: 'Teacher App' },
      { id: 'parent_app', label: 'Parent App' },
    ],
  },
  { id: 'erp', label: 'ERP', subPlatforms: [] },
  { id: 'chain_school', label: 'Chain School', subPlatforms: [] },
];

export const MODULES_BY_PLATFORM = {
  erp: [
    { id: 'Academics', label: 'Academics' },
    { id: 'Examination', label: 'Examination' },
    { id: 'Paper Generator', label: 'Paper Generator' },
    { id: 'Attendance', label: 'Attendance' },
    { id: 'Timetable', label: 'Timetable' },
    { id: 'Fee', label: 'Fee' },
    { id: 'Accounts', label: 'Accounts' },
    { id: 'Inventory', label: 'Inventory' },
    { id: 'Admission CRM', label: 'Admission CRM' },
    { id: 'Students', label: 'Students' },
    { id: 'Human Resource', label: 'Human Resource' },
    { id: 'Networks', label: 'Networks' },
    { id: 'Staff Appraisals', label: 'Staff Appraisals' },
    { id: 'Approvals', label: 'Approvals' },
    { id: 'School Compliance', label: 'School Compliance' },
    { id: 'School SOPs', label: 'School SOPs' },
    { id: 'Teacher Trainings', label: 'Teacher Trainings' },
    { id: 'MentorAI', label: 'MentorAI' },
    { id: 'Launch Setup', label: 'Launch Setup' },
    { id: 'Audit Logs', label: 'Audit Logs' },
    { id: 'Settings', label: 'Settings' },
    { id: 'User Permissions', label: 'User Permissions' },
    { id: 'Other', label: 'Other' },
  ],
  principal_app: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'staff_management', label: 'Staff Management' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'reports', label: 'Reports' },
    { id: 'settings', label: 'Settings' },
    { id: 'other', label: 'Other' },
  ],
  teacher_app: [
    { id: 'attendance', label: 'Attendance' },
    { id: 'marks_uploading', label: 'Marks Uploading' },
    { id: 'preschool_results', label: 'Preschool Results' },
    { id: 'lesson_plans', label: 'Lesson Plans' },
    { id: 'homework', label: 'Homework' },
    { id: 'timetable', label: 'Timetable' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'settings', label: 'Settings' },
    { id: 'other', label: 'Other' },
  ],
  parent_app: [
    { id: 'parent_login', label: 'Login / OTP' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'result_cards', label: 'Result Cards' },
    { id: 'fee', label: 'Fee' },
    { id: 'homework', label: 'Homework' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'settings', label: 'Settings' },
    { id: 'other', label: 'Other' },
  ],
  chain_school: [
    { id: 'multi_campus', label: 'Multi-Campus Management' },
    { id: 'consolidated_reports', label: 'Consolidated Reports' },
    { id: 'central_admissions', label: 'Central Admissions' },
    { id: 'other', label: 'Other' },
  ],
};

export const BUG_TYPES = [
  { id: 'bug', label: 'Bug' },
  { id: 'improvement', label: 'New Development' },
];

/* Where a ticket originates — see techTicketsData.SOURCE_LABEL for the
   display copy. Support's own submission always stamps 'customer_support'
   automatically; this list is what a Tech-Module-side manual create
   (TicketCreateForm) lets Super Admin/Tech Team pick from. */
export const SOURCES = [
  { id: 'customer_support', label: 'Customer Support' },
  { id: 'head_office_internal', label: 'Head Office / Internal' },
  { id: 'school_direct', label: 'School Direct' },
  { id: 'development_team', label: 'Development Team' },
];

/* Given a platform id + optional subPlatform id, returns the module list
   to show in the cascade's final dropdown. */
export function modulesFor(platformId, subPlatformId) {
  if (platformId === 'mobile') return MODULES_BY_PLATFORM[subPlatformId] || [];
  return MODULES_BY_PLATFORM[platformId] || [];
}
