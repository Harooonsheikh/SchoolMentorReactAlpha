/* ═══════════════════════════════════════════════════════════════════
   USER PERMISSIONS — module → screen → action matrix.

   Mirrors School-Mentor-Front-end's src/pages/UserPermissions/
   permissionsData.js exactly in shape and behavior: MODULE_TREE (every
   module's real screens), MODULE_PERMISSIONS (only the actions that
   have a matching real button per screen — everything else renders
   disabled/greyed, never hidden), PRIMARY_ACTIONS/ADVANCED_ACTIONS,
   getApplicablePerms/isPermApplicable, permStats.

   Scoped down per spec: no roles, no role templates, no permission
   groups, no audit trail. Every user's permissions are simply their
   own custom {screen.action:true} map, edited directly in the matrix
   and stored per employee id — the same "permType: custom" path
   School-Mentor's effectivePermsForUser() falls back to when a user
   has no role, just made the only path here.

   Dashboard is a module in this same tree, same as School-Mentor:
   its 4 children are the Head Office Dashboard's real sections
   (Dashboard.jsx), each a read-only view toggle — 'view' is the only
   applicable action, same as School-Mentor's per-card dashboard rows.
   ═══════════════════════════════════════════════════════════════════ */

const KEY_USER_PERMS = 'csp_up_user_perms'

export const PERMISSION_ACTIONS = [
  'view', 'create', 'edit', 'delete', 'approve', 'reject',
  'download', 'print', 'import', 'share',
  'assign', 'manage_settings',
]

/* Default visible columns in the matrix; the rest unlock via "More ▶".
   'reject' sits next to 'approve' — added for the Approvals module so
   Approve and Reject can be granted/withheld independently (School-
   Mentor's own reference has no such split; this app's spec explicitly
   asked for separate Approve/Reject button-level gating). */
export const PRIMARY_ACTIONS  = ['view', 'create', 'edit', 'delete', 'approve', 'reject', 'download', 'print']
export const ADVANCED_ACTIONS = ['import', 'share', 'assign', 'manage_settings']

export const ACTION_LABELS = {
  view:            'View',
  create:          'Create',
  edit:            'Edit',
  delete:          'Delete',
  approve:         'Approve',
  reject:          'Reject',
  download:        'Download',
  print:           'Print',
  import:          'Import',
  share:           'Share',
  assign:          'Assign',
  manage_settings: 'Settings',
}

/* ─── Module tree — every module's real screens, same granularity
       School-Mentor used (major tabs, and grouped sub-tabs where a
       tab has meaningfully distinct sections). ─── */
export const MODULE_TREE = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high',
    children: [
      /* ── The 4 real sections on the Head Office Dashboard
            (Dashboard.jsx → HeadOfficeDashboard). Each is a read-only
            KPI/chart section, not a CRUD entity, so 'view' is the only
            applicable action. When hidden, Dashboard.jsx renders a
            locked placeholder in its place ("Ask your super admin to
            give you access of this card" — same wording School-
            Mentor's AdminDashboard LockedCard uses). */
      { id: 'dashboard.usage',     label: 'Platform Usage Analytics' },
      { id: 'dashboard.chain',     label: 'Chain Overview' },
      { id: 'dashboard.financial', label: 'Financial Overview' },
      { id: 'dashboard.hr',        label: 'HR & Attendance Overview' },
    ] },
  { id: 'academics', label: 'Academics', icon: 'fa-graduation-cap',
    children: [
      { id: 'academics.actcal',        label: 'Activity Calendar' },
      { id: 'academics.lessonplans',   label: 'Lesson Plans' },
      { id: 'academics.notebookplans', label: 'Notebook Plans' },
      { id: 'academics.resources',     label: 'Resource Library' },
      { id: 'academics.releases',      label: 'Release Control (Master/Sub)' },
    ] },
  { id: 'schoolperm', label: 'School Permissions', icon: 'fa-key',
    children: [
      { id: 'schoolperm.access', label: 'School Access Control' },
    ] },
  { id: 'progress', label: 'School Progress', icon: 'fa-chart-line',
    children: [
      { id: 'progress.erp',      label: 'ERP Schools' },
      { id: 'progress.inactive', label: 'Inactive Schools' },
      { id: 'progress.followup', label: 'Follow-up Notes', group: 'School Progress' },
    ] },
  { id: 'payments', label: 'School Payments', icon: 'fa-credit-card',
    children: [
      { id: 'payments.setup',     label: 'Payment Setup' },
      { id: 'payments.challans',  label: 'Challans' },
      { id: 'payments.receiving', label: 'Receiving' },
      { id: 'payments.reports',   label: 'Reports' },
    ] },
  { id: 'sops', label: 'Operational SOPs', icon: 'fa-book-open',
    children: [
      { id: 'sops.categories', label: 'Manual Categories' },
      { id: 'sops.manuals',    label: 'Manuals & Forms' },
    ] },
  { id: 'hr', label: 'Human Resource', icon: 'fa-users-gear',
    children: [
      { id: 'hr.basics',    label: 'HR Basics' },
      { id: 'hr.employees', label: 'Employee Management' },
      { id: 'hr.payroll',   label: 'Payroll' },
      { id: 'hr.reports',   label: 'Reports' },
    ] },
  { id: 'accounts', label: 'Accounts', icon: 'fa-coins',
    children: [
      { id: 'accounts.coa',     label: 'Chart of Accounts' },
      { id: 'accounts.txn',     label: 'Transactions' },
      { id: 'accounts.wallets', label: 'Wallets' },
      { id: 'accounts.books',   label: 'Account Books' },
      { id: 'accounts.reports', label: 'Reports' },
    ] },
  { id: 'attendance', label: 'Attendance', icon: 'fa-calendar-check',
    children: [
      { id: 'attendance.holidays', label: 'Holidays Setup' },
      { id: 'attendance.staff',    label: 'Staff Attendance' },
      { id: 'attendance.reports',  label: 'Reports' },
    ] },
  { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked',
    children: [
      { id: 'inventory.manage',  label: 'Inventory Management' },
      { id: 'inventory.pos',     label: 'Point of Sale' },
      { id: 'inventory.reports', label: 'Reports' },
    ] },
  { id: 'trainings', label: 'Trainings', icon: 'fa-chalkboard-user',
    children: [
      { id: 'trainings.recorded', label: 'Recorded Trainings' },
      { id: 'trainings.upcoming', label: 'Upcoming Trainings' },
    ] },
  { id: 'notifications', label: 'Notifications', icon: 'fa-bell',
    children: [
      { id: 'notifications.manage', label: 'Notifications' },
    ] },
  { id: 'approvals', label: 'Approvals', icon: 'fa-square-check',
    children: [
      { id: 'approvals.myrequests', label: 'My Requests' },
      { id: 'approvals.review',     label: 'Pending Approvals & History' },
      { id: 'approvals.approvers',  label: 'Approver Management' },
    ] },
  { id: 'settings', label: 'Settings', icon: 'fa-sliders',
    children: [
      { id: 'settings.profile', label: 'Chain / Franchise Profile' },
      { id: 'settings.schools', label: 'Connected Schools' },
      { id: 'settings.classes', label: 'Classes & Subjects' },
    ] },
  { id: 'userperm', label: 'User Permissions', icon: 'fa-shield-halved',
    children: [
      { id: 'userperm.assign', label: 'Assign School' },
      { id: 'userperm.perm',   label: 'User Permission' },
    ] },
]

/* ─── Module-wise permission availability map ─────────────────────────
   Lists ONLY the actions that make sense for each screen. Anything not
   in this list is rendered as a disabled (greyed-out) checkbox and is
   excluded from selections, stats and saved state.
   ─────────────────────────────────────────────────────────────────── */
export const MODULE_PERMISSIONS = {
  /* Dashboard — every section is a read-only view toggle. */
  'dashboard.usage':     ['view'],
  'dashboard.chain':     ['view'],
  'dashboard.financial': ['view'],
  'dashboard.hr':        ['view'],

  /* Academics — Add Activity/Edit/Delete/PDF/Word (Academics.jsx) */
  'academics.actcal':        ['view', 'create', 'edit', 'delete', 'download'],
  'academics.lessonplans':   ['view', 'create', 'edit', 'delete', 'download'],
  'academics.notebookplans': ['view', 'create', 'edit', 'delete', 'download'],
  'academics.resources':     ['view', 'create', 'edit', 'delete', 'download'],
  /* Create Master/Sub Release (create), push live to schools (approve), Revoke (delete) */
  'academics.releases':      ['view', 'create', 'approve', 'delete'],

  /* School Permissions — edit ERP/module toggles per school, per-module content-access settings */
  'schoolperm.access': ['view', 'edit', 'manage_settings'],

  /* School Progress — status changes + follow-up notes */
  'progress.erp':      ['view', 'edit'],
  'progress.inactive': ['view', 'edit'],
  'progress.followup': ['view', 'create', 'delete'],

  /* School Payments */
  'payments.setup':     ['view', 'create', 'edit'],
  'payments.challans':  ['view', 'create', 'delete', 'download'],
  'payments.receiving': ['view', 'create', 'delete', 'download'],
  'payments.reports':   ['view', 'download'],

  /* Operational SOPs */
  'sops.categories': ['view', 'create', 'edit', 'delete'],
  'sops.manuals':    ['view', 'create', 'edit', 'delete'],

  /* Human Resource */
  'hr.basics':    ['view', 'create', 'edit', 'delete'],
  'hr.employees': ['view', 'create', 'edit', 'delete', 'download'],
  'hr.payroll':   ['view', 'create', 'edit', 'download'],
  'hr.reports':   ['view', 'download'],

  /* Accounts */
  'accounts.coa':     ['view', 'create', 'edit', 'delete', 'download'],
  'accounts.txn':     ['view', 'create', 'delete', 'download'],
  'accounts.wallets': ['view', 'create', 'edit', 'delete', 'manage_settings'],
  'accounts.books':   ['view', 'create', 'delete', 'download', 'print'],
  'accounts.reports': ['view', 'download'],

  /* Attendance */
  'attendance.holidays': ['view', 'create', 'edit', 'delete', 'download'],
  'attendance.staff':    ['view', 'edit', 'download'],
  'attendance.reports':  ['view', 'download'],

  /* Inventory */
  'inventory.manage':  ['view', 'create', 'edit', 'delete', 'download'],
  'inventory.pos':     ['view', 'create', 'edit', 'delete', 'print'],
  'inventory.reports': ['view', 'download'],

  /* Trainings — Mark Done treated as approve */
  'trainings.recorded': ['view', 'create', 'edit', 'delete'],
  'trainings.upcoming': ['view', 'create', 'edit', 'delete', 'approve'],

  /* Notifications */
  'notifications.manage': ['view', 'create', 'edit', 'delete'],

  /* Approvals — the 5 permissions the spec asks for map directly:
     View Approval, Create Approval Request, Approve Request,
     Reject Request, Manage Approver. */
  'approvals.myrequests': ['view', 'create'],
  'approvals.review':     ['view', 'approve', 'reject'],
  'approvals.approvers':  ['view', 'manage_settings'],

  /* Settings — Accept/Reject invite treated as approve */
  'settings.profile': ['view', 'edit'],
  'settings.schools': ['view', 'approve', 'delete'],
  'settings.classes': ['view', 'create', 'edit', 'delete'],

  /* User Permissions (this module, gating itself) */
  'userperm.assign': ['view', 'edit'],
  'userperm.perm':   ['view', 'edit'],
}

/* Get the list of actions that are applicable for a screen id. */
export function getApplicablePerms(screenId) {
  return MODULE_PERMISSIONS[screenId] || ['view']
}

/* Is a permission applicable for a screen? */
export function isPermApplicable(screenId, action) {
  return getApplicablePerms(screenId).includes(action)
}

/* ─── Storage — one flat {screen.action:true} map per employee id.
       No roles: every user's permissions ARE their custom map, same
       as School-Mentor's `permType: 'custom'` path. ─── */
const readMap = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {} } catch { return {} } }
export function loadAllUserPerms() { return readMap(KEY_USER_PERMS) }
export function saveAllUserPerms(d) { localStorage.setItem(KEY_USER_PERMS, JSON.stringify(d)) }
export function permsForUser(empId) { return loadAllUserPerms()[empId] || {} }
export function saveUserPerms(empId, perms) {
  const all = loadAllUserPerms()
  saveAllUserPerms({ ...all, [empId]: perms })
}

/* ─── API ⇆ matrix converters ─────────────────────────────────────────
   save/get-network-menu-permissions har permission ko
     { menuName, subMenuName, action, isAccessable }
   ke taur par rakhti hai (ERP ke user-menu-permissions jaisa). Yahan
   us shakal aur editor ke flat `${childId}.${actionKey}` map ke beech
   do-tarfa tarjuma hota hai. Label matching case-insensitive + trim;
   jo match na ho wo ignore. ─────────────────────────────────────────── */
const _CHILD_ID_BY_LABEL = (() => {
  const map = {}
  MODULE_TREE.forEach((m) => {
    const menu = String(m.label).trim().toLowerCase()
    m.children.forEach((c) => { map[`${menu}|${String(c.label).trim().toLowerCase()}`] = c.id })
  })
  return map
})()
const _ACTION_KEY_BY_LABEL = (() => {
  const map = {}
  Object.entries(ACTION_LABELS).forEach(([key, label]) => { map[String(label).trim().toLowerCase()] = key })
  return map
})()

/* API rows → editor perm map. Sirf isAccessable:true waale checkbox on karte hain. */
export function permsFromApiPermissions(apiPerms) {
  const out = {}
  ;(apiPerms || []).forEach((p) => {
    if (!p || !p.isAccessable) return
    const menu = String(p.menuName || '').trim().toLowerCase()
    const sub  = String(p.subMenuName || '').trim().toLowerCase()
    const childId = _CHILD_ID_BY_LABEL[`${menu}|${sub}`]
    if (!childId) return
    const rawAct = String(p.action || '').trim().toLowerCase()
    const actKey = _ACTION_KEY_BY_LABEL[rawAct] || rawAct
    if (!actKey) return
    out[`${childId}.${actKey}`] = true
  })
  return out
}

/* Editor perm map → save-network-menu-permissions ka permissions[] array.
   HAR applicable permission apni value ke saath (checked → true, unchecked →
   false), taake unchecking bhi persist ho. */
export function apiPermissionsFromPerms(perms) {
  const out = []
  MODULE_TREE.forEach((m) => {
    m.children.forEach((c) => {
      getApplicablePerms(c.id).forEach((actKey) => {
        out.push({
          menuName: m.label,
          subMenuName: c.label,
          action: ACTION_LABELS[actKey] || actKey,
          isAccessable: !!perms?.[`${c.id}.${actKey}`],
        })
      })
    })
  })
  return out
}

/* Quick single-permission check — used by Dashboard.jsx and any other
   screen that wants to gate on this user's saved matrix. */
export function hasPerm(empId, screenId, action) {
  if (!empId) return true
  return !!permsForUser(empId)[`${screenId}.${action}`]
}

/* Counts used by the permissions footer + chips. Only applicable
   permissions are counted; non-applicable cells are ignored even if
   they happen to be true in stale saved state. */
export function permStats(perms) {
  let modules = 0
  let screens = 0
  let active = 0
  let restricted = 0

  MODULE_TREE.forEach((mod) => {
    let moduleHasAny = false
    mod.children.forEach((child) => {
      const applicable = getApplicablePerms(child.id)
      let screenHasAny = false
      applicable.forEach((a) => {
        if (perms?.[`${child.id}.${a}`]) { active += 1; screenHasAny = true }
      })
      if (screenHasAny) { screens += 1; moduleHasAny = true } else { restricted += 1 }
    })
    if (moduleHasAny) modules += 1
  })

  return { modules, screens, active, restricted }
}
