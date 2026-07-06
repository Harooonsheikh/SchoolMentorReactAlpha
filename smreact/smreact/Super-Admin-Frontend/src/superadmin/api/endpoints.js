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

  /* ── School Permissions (per-school module toggles) ── */
  schoolPermissions: {
    get: (schoolId) => `${ROOT}/school-permissions/${schoolId}`,
    update: (schoolId) => `${ROOT}/school-permissions/${schoolId}`,
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
    branches: () => `/api/Registration/get-all-branches`,
  },

  /* ── AI / wallet (per-branch Mentor AI plan + subscription state). ── */
  wallet: {
    subscriptions: () => `/ai/api/wallet/admin/branches/subscriptions/`,
    subscription: (branchId) => `/ai/api/wallet/admin/branches/${branchId}/subscription/`,
    status: (branchId) => `/ai/api/wallet/admin/branches/${branchId}/status/`,
  },
};

export default EP;
