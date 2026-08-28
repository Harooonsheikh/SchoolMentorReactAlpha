/* ═══════════════════════════════════════════════════════════════════
   Central registry of API paths (relative to API_BASE_URL).

   Keeping every route here means wiring the real .NET endpoints is a
   one-file change — no hunting through components. Each module currently
   persists to localStorage (see its data.js / *Store.js). To go live:
     1. Point these paths at your real controllers.
     2. In each module's data loader, swap the localStorage read/write for
        `api.get/post(...)` using the shared client (src/api/client.js),
        gated by USE_MOCK so the UI keeps working until the API is ready.
   Path builders (e.g. byId) take the id and return the URL string.
   ═══════════════════════════════════════════════════════════════════ */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    refresh: '/auth/refresh',
  },

  dashboard: {
    summary: '/dashboard/summary',
    school: (id) => `/dashboard/schools/${id}`,
  },

  schools: {
    list: '/schools',
    byId: (id) => `/schools/${id}`,
    permissions: (id) => `/schools/${id}/permissions`,
    progress: (id) => `/schools/${id}/progress`,
  },

  payments: {
    setup: '/payments/setup',
    setupBySchool: (id) => `/payments/setup/${id}`,
    challans: '/payments/challans',
    challanBySchool: (id) => `/payments/challans/${id}`,
    bulkGenerate: '/payments/challans/bulk',
    receiving: '/payments/receiving',
    receivingBySchool: (id) => `/payments/receiving/${id}`,
    feeHeads: (id) => `/schools/${id}/fee-heads`,
  },

  accounts: {
    heads: '/accounts/heads',
    transactions: '/accounts/transactions',
    transactionById: (id) => `/accounts/transactions/${id}`,
    books: '/accounts/books',
  },

  inventory: {
    items: '/inventory/items',
    itemById: (id) => `/inventory/items/${id}`,
    sales: '/inventory/sales',
  },

  hr: {
    employees: '/hr/employees',
    employeeById: (id) => `/hr/employees/${id}`,
    payroll: '/hr/payroll',
    loans: (empId) => `/hr/employees/${empId}/loans`,
    departments: '/hr/departments',
    designations: '/hr/designations',
  },

  attendance: {
    holidays: '/attendance/holidays',
    staff: '/attendance/staff',
    byMonth: (month) => `/attendance/staff?month=${month}`,
  },

  academics: {
    settings: '/academics/settings',
    classes: '/academics/classes',
    subjects: '/academics/subjects',
    textbooks: '/academics/textbooks',
    lessonPlans: '/academics/lesson-plans',
    notebookPlans: '/academics/notebook-plans',
    termBreakups: '/academics/term-breakups',
    calendar: '/academics/calendar',
    release: '/academics/release',
  },

  sops: {
    categories: '/sops/categories',
    manuals: '/sops/manuals',
    manualById: (id) => `/sops/manuals/${id}`,
    forms: (manualId) => `/sops/manuals/${manualId}/forms`,
  },

  trainings: {
    recorded: '/trainings/recorded',
    upcoming: '/trainings/upcoming',
    byId: (id) => `/trainings/${id}`,
  },

  notifications: {
    list: '/notifications',
    byId: (id) => `/notifications/${id}`,
    send: '/notifications/send',
  },

  userPermissions: {
    users: '/user-permissions/users',
    roles: '/user-permissions/roles',
    assign: '/user-permissions/assign',
  },

  settings: {
    chainProfile: '/settings/chain-profile',
    connectedSchools: '/settings/connected-schools',
    contentSource: '/settings/content-source',
  },

  /* ERP ka LaunchSetup — Settings ▸ Classes & Subjects yahan LIVE hai.
     Ye raste ERP_API_BASE par jate hain (axios client par nahi), dekhein
     src/api/academicsSetupApi.js. Classes/subjects networkID ki base par
     save aur load hoti hain; branchID wale raste school ke apne data ke
     liye hain (School Payments ka fee-head setup). */
  launchSetup: {
    saveGrade: '/api/LaunchSetup/save-grade',
    gradesByNetwork: (networkId) => `/api/LaunchSetup/get-grades-by-network/${networkId}`,
    gradesByBranch: (branchId) => `/api/LaunchSetup/get-grades-by-branch/${branchId}`,
    deleteGrade: (id) => `/api/LaunchSetup/delete-grade/${id}`,
    saveSubject: '/api/LaunchSetup/save-subject',
    subjectsByNetworkGrade: (networkId, gradeId) => `/api/LaunchSetup/get-subjects-by-network-grade/${networkId}/${gradeId}`,
    deleteSubject: (id) => `/api/LaunchSetup/delete-subject/${id}`,
  },

  /* ERP ka Activity Calendar — Academics ▸ Activity Calendar yahan LIVE hai.
     Ye raste bhi ERP_API_BASE par jate hain (axios client par nahi), dekhein
     src/api/activityCalendarApi.js. Chain ki activities networkID ki base par
     chalti hain: har call me branchID aur sessionYearID 0 jate hain, aur
     parhne ke liye `...network` wale GET raste. branchID/SessionYearID wale
     raste school ke apne calendar ke liye hain (ERP khud unhi ko use karta hai). */
  activityCalendar: {
    crud: '/api/activitycalendarcrud',
    byNetwork: (networkId, sessionYearId = 0, pageNo = 1) => `/api/getactivitycalendarbynetwork?NetworkID=${networkId}&SessionYearID=${sessionYearId}&pageNo=${pageNo}`,
    byMonthNetwork: (networkId, month, sessionYearId = 0, pageNo = 1) => `/api/getactivitycalendarbymonthnetwork?NetworkID=${networkId}&month=${month}&SessionYearID=${sessionYearId}&pageNo=${pageNo}`,
    byMonthAndYearNetwork: (networkId, month, year, sessionYearId = 0, pageNo = 1) => `/api/getactivitycalendarbymonthandyearnetwork?NetworkID=${networkId}&month=${month}&year=${year}&SessionYearID=${sessionYearId}&pageNo=${pageNo}`,
  },
}
