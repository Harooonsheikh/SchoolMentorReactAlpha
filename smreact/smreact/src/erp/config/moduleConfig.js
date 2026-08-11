/* ═══════════════════════════════════════════════════════════════════
   MODULE REGISTRY — single source of truth for every ERP module.

   The frontend treats this list as the master catalogue: which modules
   exist, which group they belong to in the sidebar, which route they
   live at, and which ones are CORE (must always render — Settings,
   Audit Logs, etc.). At runtime ModuleContext loads the per-school
   activation state on top of this registry; backend will later
   override it via API response. Keep this file pure data — no
   side-effects, no imports.
   ═══════════════════════════════════════════════════════════════════ */

export const MODULE_REGISTRY = [
  /* ── ACADEMICS GROUP ─────────────────────────────────────────── */
  { id: 'academics',        label: 'Academics',         icon: 'fa-book-open-reader', group: 'ACADEMICS',      route: '/academics',          coreLocked: false },
  { id: 'examination',      label: 'Examination',       icon: 'fa-file-pen',         group: 'ACADEMICS',      route: '/examination',        coreLocked: false },
  { id: 'paper_generator',  label: 'Paper Generator',   icon: 'fa-scroll',           group: 'ACADEMICS',      route: '/paper-generator',    coreLocked: false },
  { id: 'attendance',       label: 'Attendance',        icon: 'fa-clipboard-check',  group: 'ACADEMICS',      route: '/attendance',         coreLocked: false },
  { id: 'timetable',        label: 'Timetable',        icon: 'fa-calendar-days',    group: 'ACADEMICS',      route: '/timetable',          coreLocked: false },

  /* ── ACCOUNTS GROUP ──────────────────────────────────────────── */
  { id: 'fee',              label: 'Fee',               icon: 'fa-money-bill-wave',  group: 'ACCOUNTS',       route: '/fee',                coreLocked: false },
  { id: 'accounts',         label: 'Accounts',          icon: 'fa-calculator',       group: 'ACCOUNTS',       route: '/accounts',           coreLocked: false },
  { id: 'inventory',        label: 'Inventory',         icon: 'fa-boxes-stacked',    group: 'ACCOUNTS',       route: '/inventory',          coreLocked: false },

  /* ── ADMINISTRATION GROUP ────────────────────────────────────── */
  { id: 'admission_crm',    label: 'Admission CRM',     icon: 'fa-user-plus',        group: 'ADMINISTRATION', route: '/admission-crm',      coreLocked: false },
  { id: 'students',         label: 'Students',          icon: 'fa-user-graduate',    group: 'ADMINISTRATION', route: '/students',           coreLocked: false },
  { id: 'hr',               label: 'Human Resource',    icon: 'fa-users',            group: 'ADMINISTRATION', route: '/hr',                 coreLocked: false },
  { id: 'networks',         label: 'Networks',          icon: 'fa-circle-nodes',     group: 'ADMINISTRATION', route: '/networks',           coreLocked: true  },
  { id: 'appraisals',       label: 'Staff Appraisals',  icon: 'fa-star-half-stroke', group: 'ADMINISTRATION', route: '/appraisals',         coreLocked: false },

  /* ── SCHOOL MENTOR GROUP ─────────────────────────────────────── */
  { id: 'school_sops',      label: 'School SOPs',       icon: 'fa-book-open',        group: 'SCHOOL MENTOR',  route: '/school-mentor/sops',      coreLocked: false },
  { id: 'teacher_trainings',label: 'Teacher Trainings', icon: 'fa-chalkboard-user',  group: 'SCHOOL MENTOR',  route: '/school-mentor/trainings', coreLocked: false },

  /* ── BASICS GROUP — coreLocked entries cannot be disabled ────── */
  { id: 'launch_setup',     label: 'Launch Setup',      icon: 'fa-rocket',           group: 'BASICS',         route: '/launch-setup',       coreLocked: true  },
  { id: 'audit_logs',       label: 'Audit Logs',        icon: 'fa-clipboard-list',   group: 'BASICS',         route: '/audit-logs',         coreLocked: true  },
  { id: 'settings',         label: 'Settings',          icon: 'fa-gear',             group: 'BASICS',         route: '/settings',           coreLocked: true  },
  { id: 'user_permissions', label: 'User Permissions',  icon: 'fa-shield-halved',    group: 'BASICS',         route: '/user-permissions',   coreLocked: true  },
];

/* ─── Default activation state — every module enabled. */
export const DEFAULT_MODULE_STATE = Object.fromEntries(
  MODULE_REGISTRY.map(m => [m.id, true])
);

/* ─── Pehla paint (backend response se pehle) ka state: sirf coreLocked on.
       Agar yahan sab `true` rakhein to jo module school ne off kiya hai wo
       response aane tak ek pal ke liye sidebar me flash kar jata hai. Isi
       liye default "kuch nahi" hai — API batayegi kya on karna hai. */
export const EMPTY_MODULE_STATE = Object.fromEntries(
  MODULE_REGISTRY.map(m => [m.id, !!m.coreLocked])
);

/* ─── Mapping: backend `module-permission` response field → MODULE_REGISTRY.id.
       GET /api/SchoolPermissions/module-permission/{branchID} ek flat object
       deta hai (academics:true, paperGenerator:false, …). Sirf `true` wale
       module sidebar me dikhne chahiye. Jo registry entry is map se cover
       nahi hoti (launch_setup) wo coreLocked hai — hamesha visible. */
export const API_FIELD_TO_MODULE_MAP = {
  academics:         'academics',
  examination:       'examination',
  paperGenerator:    'paper_generator',
  attendance:        'attendance',
  timeTable:         'timetable',
  fee:               'fee',
  accounts:          'accounts',
  inventory:         'inventory',
  admissionCRM:      'admission_crm',
  students:          'students',
  humanResource:     'hr',
  staffAppraisals:   'appraisals',
  schoolSOPs:        'school_sops',
  teacherTrainings:  'teacher_trainings',
  auditLogs:         'audit_logs',
  settings:          'settings',
  userPermissions:   'user_permissions',
};

/**
 * Backend ka flat permission object → { moduleId: boolean } state map.
 * Field names case-insensitive match hote hain (backend kabhi PascalCase
 * bhejta hai), aur values true/false/1/0/"true" kisi bhi form me ho sakti hain.
 * coreLocked module (Settings/Audit Logs/User Permissions/Launch Setup) kabhi
 * off nahi hote — chahe API false hi kyun na de.
 */
export function mapApiPermissionsToModuleState(payload) {
  if (!payload || typeof payload !== 'object') return null;

  /* Response ki keys lowercase index kar lo taake casing mismatch na tootay. */
  const lowered = {};
  for (const [k, v] of Object.entries(payload)) lowered[k.toLowerCase()] = v;

  const truthy = (v) =>
    v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v) === '1';

  const state = {};
  for (const [field, moduleId] of Object.entries(API_FIELD_TO_MODULE_MAP)) {
    const raw = lowered[field.toLowerCase()];
    if (raw === undefined) continue;      /* API ne bheja hi nahi → chhedo mat */
    state[moduleId] = truthy(raw);
  }

  /* coreLocked hamesha on. */
  for (const m of MODULE_REGISTRY) if (m.coreLocked) state[m.id] = true;

  return state;
}

/* ─── Mapping: MODULE_REGISTRY.id → MODULE_TREE.id prefix
       (used to filter the permission tree by active modules). */
export const MODULE_TO_TREE_MAP = {
  academics:         'academics',
  examination:       'examination',
  paper_generator:   'papers',
  attendance:        'attendance',
  timetable:         'timetable',
  fee:               'fee',
  accounts:          'accounts',
  inventory:         'inventory',
  admission_crm:     'admissions',
  students:          'students',
  hr:                'hr',
  appraisals:        'appraisals',
  school_sops:       'sops',
  teacher_trainings: 'trainings',
  audit_logs:        'auditlogs',
  user_permissions:  'permissions',
  settings:          'settings',
  launch_setup:      'launch',
};

/* ─── Reverse map: MODULE_TREE.id prefix → MODULE_REGISTRY.id
       (handy when working from the permissions side). */
export const TREE_TO_MODULE_MAP = Object.fromEntries(
  Object.entries(MODULE_TO_TREE_MAP).map(([k, v]) => [v, k])
);

/* ─── Mapping: MODULE_REGISTRY.id → sidebar nav id used in App.js.
       The sidebar still uses short legacy IDs (e.g. 'acad', 'crm')
       so this map lets the sidebar filter without breaking existing
       routing. */
export const MODULE_TO_NAV_MAP = {
  academics:         'acad',
  examination:       'exam',
  paper_generator:   'paper',
  attendance:        'att',
  timetable:         'tt',
  fee:               'fee',
  accounts:          'accounts',
  inventory:         'inventory',
  admission_crm:     'crm',
  students:          'students',
  hr:                'hr',
  appraisals:        'appraisal',
  school_sops:       'sops',
  teacher_trainings: 'trainings',
  networks:          'networks',
  audit_logs:        'audit',
  user_permissions:  'perm',
  settings:          'settings',
  launch_setup:      'launch',
};

/* ─── Reverse: sidebar nav id → MODULE_REGISTRY.id. */
export const NAV_TO_MODULE_MAP = Object.fromEntries(
  Object.entries(MODULE_TO_NAV_MAP).map(([k, v]) => [v, k])
);
