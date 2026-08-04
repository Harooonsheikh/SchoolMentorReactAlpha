/* ════════════════════════════════════════════════════════════════════
   SUPER ADMIN — REST endpoint map (the .NET contract)

   Single source of truth for every path the frontend calls. The .NET
   backend implements a controller action per entry below. All paths are
   relative to the configured API base URL and assume a Bearer JWT.

   Conventions:
     • List endpoints accept ?search=&page=&pageSize= and SHOULD return a
       paged envelope { items, total, page, pageSize } (see API guide).
     • Mutations use POST (create), PUT (replace/update), DELETE (remove).
     • IDs are numbers in the demo; the backend may use GUIDs — the client
       treats them as opaque, so either works.
   ════════════════════════════════════════════════════════════════════ */

const ROOT = '/api/superadmin';

/* The LIVE .NET Super Admin API is hosted under its own application root
   (swagger: http://<host>:4100/SchoolMentorSuperAdminAPI/swagger/index.html,
   `servers: [{ url: "/SchoolMentorSuperAdminAPI" }]`), so every real path
   carries this prefix. Services prepend SA_ADMIN_API_BASE — empty in dev, so
   the request goes to our own origin and setupProxy.js forwards it. */
const SA_ROOT = '/SchoolMentorSuperAdminAPI';

export const EP = {
  /* ── Auth (only needed for the standalone app; the host injects a token) ── */
  auth: {
    login: () => `${ROOT}/auth/login`,
    me: () => `${ROOT}/auth/me`,
  },

  /* ── Dashboard ── */
  dashboard: {
    get: () => `${ROOT}/dashboard`,                       // ?month=YYYY-MM
  },

  /* ── User Management ── */
  users: {
    list: () => `${ROOT}/users`,                          // ?search=&page=&pageSize=
    create: () => `${ROOT}/users`,
    update: (id) => `${ROOT}/users/${id}`,
    remove: (id) => `${ROOT}/users/${id}`,
    picture: (id) => `${ROOT}/users/${id}/picture`,       // multipart
    permissions: (id) => `${ROOT}/users/${id}/permissions`,
    assignments: (id) => `${ROOT}/users/${id}/assignments`,
  },

  /* ── Schools Progress (status / onboarding / enquiries / follow-ups) ── */
  schools: {
    list: () => `${ROOT}/schools`,                        // ?group=launch|erp|inactive
    get: (id) => `${ROOT}/schools/${id}`,
    setStatus: (id) => `${ROOT}/schools/${id}/status`,    // { active }
    followups: (id) => `${ROOT}/schools/${id}/followups`, // { kind, text }
    enquiries: (id) => `${ROOT}/schools/${id}/enquiries`,
    updateEnquiry: (id) => `${ROOT}/enquiries/${id}`,     // { status, ... }
  },

  /* ── Schools Payment ── */
  payments: {
    schools: () => `${ROOT}/payments/schools`,
    setup: (schoolId) => `${ROOT}/payments/setup/${schoolId}`,    // GET/PUT
    challans: () => `${ROOT}/payments/challans`,                  // GET ?month= / POST
    bulkChallans: () => `${ROOT}/payments/challans/bulk`,
    receiving: () => `${ROOT}/payments/receiving`,                // POST
    report: () => `${ROOT}/payments/report`,                      // ?month=
  },

  /* ── School Permissions — LIVE SchoolMentorSuperAdminAPI (see SA_ROOT).
     Mirrors the controller exactly, per its swagger. The two toggle routes
     take their value as a QUERY parameter, not a body. ── */
  schoolPermissions: {
    /* GET — what the screen loads: every branch WITH its saved module
       permissions, as [ { branch: {...}, modulePermission: {...} | null } ]. */
    branchesWithPermissions: () => `${SA_ROOT}/api/SchoolPermissions/get-branches-with-permissions`,
    /* GET — branch directory only (no module flags); superseded by the above. */
    branches: () => `${SA_ROOT}/api/SchoolPermissions/get-branch`,
    /* GET — one branch's saved ModulePermission row. */
    modulePermission: (branchId) => `${SA_ROOT}/api/SchoolPermissions/module-permission/${branchId}`,
    /* POST — save every module flag for a branch in one ModulePermission body. */
    saveModulePermission: () => `${SA_ROOT}/api/SchoolPermissions/save-modulePermission`,
    /* PUT ?launchSetup=1|0 — the modal's "ERP Access" card. */
    toggleLaunchSetup: (branchId) => `${SA_ROOT}/api/SchoolPermissions/toggle-launch-setup/${branchId}`,
    /* PUT ?isActive=true|false — the modal's "Active Branch" card. */
    toggleBranchStatus: (branchId) => `${SA_ROOT}/api/SchoolPermissions/ToggleBranchStatus/${branchId}`,
    /* PUT — the older single-purpose launch-setup routes (toggle- replaces them). */
    enableLaunchSetup: (id) => `${SA_ROOT}/api/SchoolPermissions/enable-launch-setup/${id}`,
    disableLaunchSetup: (id) => `${SA_ROOT}/api/SchoolPermissions/disable-launch-setup/${id}`,
  },

  /* ── Schools Progress — LIVE SchoolMentorSuperAdminAPI.
     GET branch-report?isActive=&launchSetup= → har branch ka setup progress:
       { category, branchID, branchName, totalStaff, totalStudents, assignedTo,
         generalDetails{ principalName, principalPhone, totalStudents, totalStaff,
                         studentSignUp, staffSignUp, createdAt },
         stateDetails{ schoolTab, classTab, studentTab, departmentTab, staffTab,
                       syllabusTab, timeTableTab },
         compulsionDetails{ staffContact, subjectAssigned, parentContact,
                            previousDeus } }
     DONO query params LAAZMI hain — ek bhi chhoot jaye to API 0 rows deti hai.
     Screen ke teen tabs isi tarah banate hain:
       Launch Setup → isActive=true&launchSetup=0   (category "LaunchSetup School")
       ERP          → isActive=true&launchSetup=1   (category "ERP Schools")
       Inactive     → isActive=false (dono launchSetup) ── */
  schoolProgress: {
    branchReport: () => `${SA_ROOT}/api/AHM_School_Progress/branch-report`,
  },

  /* ── E-Tube ── */
  etube: {
    videos: () => `${ROOT}/etube/videos`,                 // GET / POST(multipart)
    video: (id) => `${ROOT}/etube/videos/${id}`,          // PUT / DELETE
    categories: () => `${ROOT}/etube/categories`,
    category: (id) => `${ROOT}/etube/categories/${id}`,
    reviews: () => `${ROOT}/etube/reviews`,
    review: (id) => `${ROOT}/etube/reviews/${id}`,        // PUT { status }
    schoolVideos: () => `${ROOT}/etube/school-videos`,
    schoolVideo: (id) => `${ROOT}/etube/school-videos/${id}`,
  },

  /* ── Notifications ── */
  notifications: {
    list: () => `${ROOT}/notifications`,                  // ?audience=&type=&page=
    send: () => `${ROOT}/notifications`,
    update: (id) => `${ROOT}/notifications/${id}`,
    remove: (id) => `${ROOT}/notifications/${id}`,
    recipients: () => `${ROOT}/notifications/recipients`, // ?audience=&sub=&cls=&section=
  },

  /* ── Operational SOPs ── */
  sops: {
    categories: () => `${ROOT}/sops/categories`,
    category: (id) => `${ROOT}/sops/categories/${id}`,
    manuals: () => `${ROOT}/sops/manuals`,                // GET / POST(multipart)
    manual: (id) => `${ROOT}/sops/manuals/${id}`,
  },

  /* ── Quiz Content ── */
  quiz: {
    classes: () => `${ROOT}/quiz/classes`,
    subjects: () => `${ROOT}/quiz/subjects`,              // ?classId=
    mcqs: () => `${ROOT}/quiz/mcqs`,                      // ?subjectId=
    mcq: (id) => `${ROOT}/quiz/mcqs/${id}`,
    bulkUpload: () => `${ROOT}/quiz/mcqs/bulk`,           // multipart (Excel)
  },

  /* ── Teachers Training ── */
  trainings: {
    list: () => `${ROOT}/trainings`,                      // ?status=upcoming|recorded
    create: () => `${ROOT}/trainings`,
    update: (id) => `${ROOT}/trainings/${id}`,
    remove: (id) => `${ROOT}/trainings/${id}`,
  },

  /* ── Mentor AI ── */
  mentor: {
    plans: () => `${ROOT}/mentor/plans`,
    plan: (id) => `${ROOT}/mentor/plans/${id}`,
    payments: () => `${ROOT}/mentor/payments`,
  },

  /* ── Registration (branch directory — lives on the main ERP API, NOT under
     the superadmin root, so services call it with an absolute URL). ── */
  registration: {
    branches: () => `/api/Registration/old_MISDBBranch`,
  },

  /* ── AI / wallet (per-branch Mentor AI plan + subscription state). ── */
  wallet: {
    subscriptions: () => `/ai/api/wallet/admin/branches/subscriptions/`,
    subscription: (branchId) => `/ai/api/wallet/admin/branches/${branchId}/subscription/`,
    status: (branchId) => `/ai/api/wallet/admin/branches/${branchId}/status/`,
  },
};

export default EP;
