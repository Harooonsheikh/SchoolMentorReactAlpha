/* ═══════════════════════════════════════════════════════════════════
   ADMIN PERMISSIONS — Role/Permission system for the Super Admin app.

   Same shape/helper names as the sibling ERP's own reference
   implementation (School-Mentor-Front-end/src/pages/UserPermissions/
   permissionsData.js) — MODULE_TREE / MODULE_PERMISSIONS / ROLE_TEMPLATES
   / effectivePermsForUser() / permsFromTemplate() — but this is its own
   file describing THIS app's modules. Deliberately lives under
   adminPermissions/ rather than next to the existing (unrelated)
   src/superadmin/permissionsData.js, which is the School Permissions
   module's per-school toggle data — never touch that file for this.

   Mock/in-memory only, same "swap the seed for an API call later"
   contract as every other *Data.js file in this app.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Supported permission actions — same 11-action vocabulary as the
   ERP's own reference implementation (permissionsData.js), so a role
   built here means exactly the same thing a School Mentor ERP role
   does. PRIMARY_ACTIONS are the 7 columns the matrix shows by default;
   ADVANCED_ACTIONS (import/share/assign/manage_settings) sit behind a
   "More ▶" toggle in EditPermissionsPanel — same split as the ERP. ─── */
export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'download', 'print', 'import', 'share', 'assign', 'manage_settings'];
export const PRIMARY_ACTIONS  = ['view', 'create', 'edit', 'delete', 'approve', 'download', 'print'];
export const ADVANCED_ACTIONS = ['import', 'share', 'assign', 'manage_settings'];

export const ACTION_LABELS = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve',
  download: 'Download', print: 'Print', import: 'Import', share: 'Share',
  assign: 'Assign', manage_settings: 'Settings',
};

/* ─── Module tree — every module in SuperAdminShell's NAV, each with a
   flat list of its real submodules/screens. A child may carry an
   optional `group` label (same convention as the ERP tree) purely to
   cluster related rows under a sub-heading inside the permission
   matrix — it has no effect on the permission key itself. ─── */
export const MODULE_TREE = [
  /* Dashboard is split into the same 3 sections Dashboard.jsx actually
     gates (Fee Analytics/1LINK, School Overview, Video Details) so
     "View" here is the literal switch that shows/hides each section —
     not just a decorative screen entry. */
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high',
    children: [
      { id: 'dashboard.fee_analytics',    label: 'Fee Analytics & 1LINK Overview' },
      { id: 'dashboard.school_overview',  label: 'School Overview, Bugs & Improvements' },
      { id: 'dashboard.video_details',    label: 'Video Details' },
      { id: 'dashboard.usage_analytics',  label: 'Usage Analytics' },
    ] },
  { id: 'schools', label: 'Schools', icon: 'fa-school',
    children: [
      { id: 'schools.permissions', label: 'School Permissions' },
      { id: 'schools.progress',    label: 'Schools Progress' },
      /* Schools Payment is split into 3 granular nodes (brief §13): viewing/
         generating/sending/receiving day-to-day billing vs. configuring the
         automation policy vs. editing reminder templates are different
         levels of trust — a billing clerk shouldn't need "manage_settings"
         just to generate a challan, and shouldn't be able to change the
         restriction policy that decides when a school loses access. */
      { id: 'schools.payments',             label: 'Schools Payment — Setup, Challans & Receiving' },
      { id: 'schools.billing_automation',   label: 'Schools Payment — Billing Automation Settings' },
      { id: 'schools.billing_notifications', label: 'Schools Payment — Notifications & Reminders' },
    ] },
  { id: 'support', label: 'Support', icon: 'fa-headset',
    children: [
      { id: 'support.overview', label: 'Overview' },
      { id: 'support.inbox',    label: 'Agent Inbox' },
    ] },
  /* ── Tech Module — the flagship RBAC consumer per spec. Each stage is
     its own permission node so a role can be scoped to exactly the
     stage(s) it should touch (e.g. QA only sees qa_review + ready_for_release). */
  { id: 'techmodule', label: 'Tech Module', icon: 'fa-list-check',
    children: [
      { id: 'techmodule.bugs_new_dev',      label: 'Bugs & New Development' },
      { id: 'techmodule.in_progress',       label: 'In Progress' },
      { id: 'techmodule.qa_review',         label: 'Review & Testing (QA)' },
      { id: 'techmodule.ready_for_release', label: 'Ready for Release' },
    ] },
  { id: 'mentorai', label: 'Mentor AI', icon: 'fa-robot',
    children: [
      { id: 'mentorai.plans',    label: 'Plan Management' },
      { id: 'mentorai.payments', label: 'Payments' },
    ] },
  { id: 'notifications', label: 'Notifications', icon: 'fa-bell',
    children: [
      { id: 'notifications.compose', label: 'Compose / Send' },
      { id: 'notifications.sent',    label: 'Sent Notifications' },
    ] },
  { id: 'etube', label: 'E-Tube', icon: 'fa-play-circle',
    children: [
      { id: 'etube.dashboard',  label: 'Dashboard' },
      { id: 'etube.reviews',    label: 'Reviews' },
      { id: 'etube.videos',     label: 'Videos' },
      { id: 'etube.upload',     label: 'Upload' },
      { id: 'etube.categories', label: 'Categories' },
    ] },
  { id: 'sops', label: 'Operational SOPs', icon: 'fa-book-open',
    children: [
      { id: 'sops.view', label: 'View / Manage SOPs' },
    ] },
  { id: 'trainings', label: 'Teacher Trainings', icon: 'fa-chalkboard-user',
    children: [
      { id: 'trainings.view', label: 'View / Manage Trainings' },
    ] },
  { id: 'quiz', label: 'Quiz Content', icon: 'fa-circle-question',
    children: [
      { id: 'quiz.classes',  label: 'Classes' },
      { id: 'quiz.subjects', label: 'Subjects' },
      { id: 'quiz.mcq',      label: 'MCQ Bank' },
    ] },
  /* ── Cross-module reporting/exports (Accounts/Admin role's home). ── */
  { id: 'reports', label: 'Reports', icon: 'fa-chart-line',
    children: [
      { id: 'reports.overview', label: 'Reports Overview' },
    ] },
  { id: 'users', label: 'User Management', icon: 'fa-users-gear',
    children: [
      { id: 'users.registration', label: 'User Registration' },
      { id: 'users.roles',        label: 'Roles' },
      { id: 'users.permissions',  label: 'User Permission' },
    ] },
];

/* ─── Module-wise permission availability map. Anything not listed for
   a screen is rendered disabled/greyed in EditPermissionsPanel and
   excluded from templates/stats/saved state. ─── */
export const MODULE_PERMISSIONS = {
  'dashboard.fee_analytics':   ['view', 'download', 'print'],
  'dashboard.school_overview': ['view', 'download', 'print'],
  'dashboard.video_details':   ['view'],
  'dashboard.usage_analytics': ['view', 'download', 'print'],

  'schools.permissions': ['view', 'edit'],
  'schools.progress':    ['view'],
  /* create = generate a challan / record a manual receiving entry.
     edit = change a school's payment formula/setup.
     approve = grant a manual grace period or restore access (the
     sign-off action brief §13 calls out as its own permission). */
  'schools.payments':              ['view', 'create', 'edit', 'approve', 'download', 'print'],
  'schools.billing_automation':    ['view', 'manage_settings'],
  'schools.billing_notifications': ['view', 'create', 'edit'],

  'support.overview': ['view'],
  'support.inbox':    ['view', 'create', 'edit', 'assign'],

  /* Bugs & New Development — triage queue: view/create (Support/Tech Team
     both report here), assign (hand a ticket to a developer). No delete —
     tickets are never destroyed, only moved through stages. */
  'techmodule.bugs_new_dev':      ['view', 'create', 'assign'],
  /* In Progress — the assigned developer works and submits their Developer
     Testing Report here; no assign (already assigned), no approve. */
  'techmodule.in_progress':       ['view', 'edit'],
  /* QA Review — QA's Approve/Reject gate. */
  'techmodule.qa_review':         ['view', 'approve', 'edit'],
  /* Ready for Release — Super Admin/Tech Lead performs the Release action;
     download/print cover pulling a release-history report. */
  'techmodule.ready_for_release': ['view', 'approve', 'download', 'print'],

  'mentorai.plans':    ['view', 'create', 'edit', 'delete'],
  'mentorai.payments': ['view', 'download', 'print'],

  'notifications.compose': ['view', 'create'],
  'notifications.sent':    ['view', 'edit', 'delete'],

  'etube.dashboard':  ['view'],
  'etube.reviews':    ['view', 'approve'],
  'etube.videos':     ['view', 'edit', 'delete'],
  'etube.upload':     ['view', 'create'],
  'etube.categories': ['view', 'create', 'edit', 'delete'],

  'sops.view': ['view', 'create', 'edit', 'delete'],

  'trainings.view': ['view', 'create', 'edit', 'delete'],

  'quiz.classes':  ['view', 'create', 'edit', 'delete'],
  'quiz.subjects': ['view', 'create', 'edit', 'delete'],
  'quiz.mcq':      ['view', 'create', 'edit', 'delete'],

  'reports.overview': ['view', 'download', 'print'],

  /* Users can view/create/edit accounts + assign a role, but only Super
     Admin ever resets a password — that action isn't in this permission
     list at all (it's not gate-able; it's Super-Admin-only by construction,
     enforced in code, not by a checkbox anyone could grant). */
  'users.registration': ['view', 'create', 'edit', 'assign'],
  'users.roles':        ['view', 'create', 'edit', 'delete'],
  'users.permissions':  ['view', 'edit', 'assign'],
};

export function getApplicablePerms(screenId) {
  return MODULE_PERMISSIONS[screenId] || ['view'];
}
export function isPermApplicable(screenId, action) {
  return getApplicablePerms(screenId).includes(action);
}

/* ─── Role templates — the 5 defaults required by spec, plus the
   general shape (module scope + action scope) any future custom role
   can reuse. ─── */
export const ROLE_TEMPLATES = {
  super_admin: { label: 'Super Admin', giveAll: true },

  tech_team: { label: 'Tech Team',
    modules: ['techmodule'],
    actions: ['view', 'create', 'edit', 'assign'] },

  customer_support: { label: 'Customer Support Team',
    modules: ['support'],
    actions: ['view', 'create', 'edit', 'assign'],
    /* Support also gets a narrow slice of Tech Module — report bugs/new
       dev requests, but not triage/assign/QA/release. */
    extra: { 'techmodule.bugs_new_dev': ['view', 'create'] } },

  qa_team: { label: 'QA Team',
    modules: [],
    actions: [],
    extra: {
      'techmodule.qa_review':         ['view', 'approve'],
      'techmodule.ready_for_release': ['view'],
    } },

  accounts_admin: { label: 'Accounts/Admin',
    modules: ['reports'],
    actions: ['view', 'download', 'print'],
    extra: {
      'schools.payments':         ['view', 'download', 'print'],
      'dashboard.fee_analytics':  ['view', 'download', 'print'],
    } },
};

/* ─── Available colours when creating/editing a role. ─── */
export const ROLE_COLORS = [
  { id: 'blue',   value: '#1E3A8A' },
  { id: 'purple', value: '#7C3AED' },
  { id: 'green',  value: '#16A34A' },
  { id: 'amber',  value: '#D97706' },
  { id: 'red',    value: '#DC2626' },
  { id: 'teal',   value: '#0F766E' },
];

/* ─── Seed: the 5 default roles. ─── */
export const INITIAL_ROLES = [
  { id: 'role-super-admin', name: 'Super Admin',            description: 'Full access to every module and action.',            color: '#7C3AED', userCount: 1, template: 'super_admin',     isDefault: true },
  { id: 'role-tech-team',   name: 'Tech Team',               description: 'Triage, assign, and develop Tech Module tickets.',   color: '#1E3A8A', userCount: 4, template: 'tech_team',       isDefault: true },
  { id: 'role-support',     name: 'Customer Support Team',   description: 'Handles the Support console; reports bugs/new dev.', color: '#0284C7', userCount: 3, template: 'customer_support', isDefault: true },
  { id: 'role-qa',          name: 'QA Team',                 description: 'Reviews and approves/rejects tickets before release.', color: '#16A34A', userCount: 2, template: 'qa_team',         isDefault: true },
  { id: 'role-accounts',    name: 'Accounts/Admin',          description: 'Views fee/payment data and cross-module reports.',   color: '#D97706', userCount: 1, template: 'accounts_admin',  isDefault: true },
];

/* ─── Role assignment — keyed by the REAL admin user id from
   userMgmtData.js's INITIAL_USERS (reuse, don't duplicate the user
   list). { [userId]: { role: roleId, permType:'role'|'custom',
   customPermissions? } }. A user with no entry here has no RBAC role
   yet (treated as no access until a Super Admin assigns one). This is
   the only permission store in the app — Dashboard.jsx's "Viewing as"
   preview and User Management's User Permission tab both resolve
   through effectivePermsForUser() against this same map. Seeded
   against the first few of the 12 existing users so the Roles/
   Permissions UI has real data to show immediately. */
export const INITIAL_ROLE_ASSIGNMENTS = {
  1: { role: 'role-super-admin', permType: 'role' }, // Romana Shabir
  2: { role: 'role-tech-team',   permType: 'role' }, // Hamza Iftikhar
  3: { role: 'role-tech-team',   permType: 'role' }, // Abdullah
  4: { role: 'role-support',     permType: 'role' }, // Arooj Jahanzaib
  5: { role: 'role-support',     permType: 'role' }, // Dua Fatima
  6: { role: 'role-qa',          permType: 'role' }, // Batool Fatima
  9: { role: 'role-accounts',    permType: 'role' }, // Muhammad Abubakar
};

/* Passwords are never part of a user record's readable state beyond
   the existing plaintext demo seed in userMgmtData.js — going forward,
   every password set/change/reset happens exclusively via
   ResetPasswordModal, triggered only by a Super Admin (never
   self-service; see that module's own doc comment). */

/* ─── Helpers ─── */
export function findRole(roles, id) {
  return roles.find((r) => r.id === id) || null;
}

/* Translate a ROLE_TEMPLATES entry into a flat "{screenId}.{action}":true
   permission map — the module-scope/action-scope grant, plus any `extra`
   fine-grained grants the template lists individually. */
export function permsFromTemplate(templateKey) {
  const out = {};
  const tpl = ROLE_TEMPLATES[templateKey];
  if (!tpl) return out;
  if (tpl.giveAll) {
    MODULE_TREE.forEach((m) => m.children.forEach((c) => {
      getApplicablePerms(c.id).forEach((a) => { out[`${c.id}.${a}`] = true; });
    }));
    return out;
  }
  (tpl.modules || []).forEach((mid) => {
    const mod = MODULE_TREE.find((m) => m.id === mid);
    if (!mod) return;
    mod.children.forEach((child) => {
      (tpl.actions || []).forEach((a) => {
        if (getApplicablePerms(child.id).includes(a)) out[`${child.id}.${a}`] = true;
      });
    });
  });
  if (tpl.extra) {
    Object.entries(tpl.extra).forEach(([screenId, actions]) => {
      actions.forEach((a) => { out[`${screenId}.${a}`] = true; });
    });
  }
  return out;
}

/* A role created/edited via RolesTab carries its own explicit
   `customPerms` map (module-level checkbox grid → flat perm keys);
   one of the 5 seeded defaults instead points at a ROLE_TEMPLATES
   preset via `template`. This resolves either shape to a flat map. */
export function permsForRole(role) {
  if (!role) return {};
  if (role.customPerms) return role.customPerms;
  return permsFromTemplate(role.template);
}

/* For a user, compute effective permissions: a custom override
   (user.customPermissions) wins; otherwise derive from their role. */
export function effectivePermsForUser(user, roles) {
  if (!user) return {};
  if (user.permType === 'custom' && user.customPermissions) return user.customPermissions;
  const role = findRole(roles, user.role);
  if (!role) return {};
  return permsForRole(role);
}

/* Build a flat perms map from a RolesTab-style selection: which module
   ids are checked, and which actions are checked globally — used when
   creating/editing a role from the UI (not from a fixed template). */
export function permsFromModuleSelection(moduleIds, actions) {
  const out = {};
  (moduleIds || []).forEach((mid) => {
    const mod = MODULE_TREE.find((m) => m.id === mid);
    if (!mod) return;
    mod.children.forEach((child) => {
      (actions || []).forEach((a) => {
        if (getApplicablePerms(child.id).includes(a)) out[`${child.id}.${a}`] = true;
      });
    });
  });
  return out;
}

/* Inverse of the above — which top-level module ids currently have at
   least one granted permission, for pre-checking RolesTab's grid when
   editing an existing custom role. */
export function modulesGrantedIn(perms) {
  if (!perms) return [];
  return MODULE_TREE.filter((m) => m.children.some((c) => Object.keys(perms).some((k) => k.startsWith(`${c.id}.`) && perms[k]))).map((m) => m.id);
}

/* Counts used by a permissions summary footer/chips — only applicable
   permissions are counted. */
export function permStats(perms) {
  let modules = 0, screens = 0, active = 0, restricted = 0;
  MODULE_TREE.forEach((mod) => {
    let moduleHasAny = false;
    mod.children.forEach((child) => {
      let screenHasAny = false;
      getApplicablePerms(child.id).forEach((a) => {
        if (perms?.[`${child.id}.${a}`]) { active += 1; screenHasAny = true; }
      });
      if (screenHasAny) { screens += 1; moduleHasAny = true; } else { restricted += 1; }
    });
    if (moduleHasAny) modules += 1;
  });
  return { modules, screens, active, restricted };
}

export const userInitials = (name) => (name || '').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2) || '?';
