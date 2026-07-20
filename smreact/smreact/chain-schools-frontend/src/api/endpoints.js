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
}
