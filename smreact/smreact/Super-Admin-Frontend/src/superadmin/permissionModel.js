import { MODULE_ACCESS_FIELDS } from './api/services/userModuleAccess';

/* ═══════════════════════════════════════════════════════════════════
   Super Admin screen × action permission model — shared by
   UserPermissionMatrix (editing) and saPerms (enforcement for the
   logged-in user). Module keys = MODULE_ACCESS_FIELDS keys.
   ═══════════════════════════════════════════════════════════════════ */

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'download'];
export const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve', download: 'Download' };

const V = ['view'];
const CRUD = ['view', 'create', 'edit', 'delete'];

/* Har API field (= sidebar module) ke screens aur unke lagu actions. */
export const MODULE_SCREENS = {
  dashboard: { icon: 'fa-gauge-high', screens: [
    { id: 'fee_analytics',   label: 'Fee Analytics & 1LINK Overview', actions: ['view', 'edit', 'download'] },   // edit = 1LINK Rates save
    { id: 'school_overview', label: 'School Overview',                actions: ['view', 'download'] },
    { id: 'bugs_improve',    label: 'Bugs & Improvements',            actions: CRUD },
    { id: 'video_details',   label: 'Video Details',                  actions: V },
  ] },
  etubeUploader: { icon: 'fa-cloud-arrow-up', screens: [
    { id: 'dashboard', label: 'E-Tube Dashboard', actions: V },
    { id: 'upload',    label: 'Upload Video',     actions: ['view', 'create'] },
    { id: 'videos',    label: 'Videos',           actions: ['view', 'edit', 'delete', 'download'] },
    { id: 'reviews',   label: 'Reviews',          actions: ['view', 'approve'] },
  ] },
  etubeCategory: { icon: 'fa-tags', screens: [
    { id: 'categories', label: 'Categories', actions: CRUD },
  ] },
  networkPermission: { icon: 'fa-diagram-project', screens: [
    { id: 'network_perms', label: 'Network Permissions', actions: ['view', 'edit'] },
  ] },
  schoolPermission: { icon: 'fa-shield-halved', screens: [
    { id: 'school_perms', label: 'School Permissions', actions: ['view', 'edit'] },
  ] },
  scoolProgress: { icon: 'fa-chart-line', screens: [
    { id: 'launch_setup', label: 'Launch Setup Schools', actions: ['view', 'create', 'edit', 'delete', 'download'] },
    { id: 'erp_schools',  label: 'ERP Schools',          actions: ['view', 'edit', 'download'] },
  ] },
  schoolPayments: { icon: 'fa-money-bill-wave', screens: [
    { id: 'setup',         label: 'Payment Setup',               actions: ['view', 'create', 'edit', 'delete'] },
    { id: 'challans',      label: 'Challans',                    actions: ['view', 'create', 'edit', 'delete', 'download'] },
    { id: 'receiving',     label: 'Receiving',                   actions: ['view', 'create', 'edit', 'approve', 'download'] },
    { id: 'automation',    label: 'Billing Automation Settings', actions: ['view', 'edit'] },
    { id: 'reminders',     label: 'Notifications & Reminders',   actions: ['view', 'create', 'edit'] },
  ] },
  policyMenual: { icon: 'fa-book-open', screens: [
    { id: 'heads',   label: 'Manual Heads (Categories)', actions: CRUD },
    { id: 'manuals', label: 'Manuals',                   actions: ['view', 'create', 'edit', 'delete', 'download'] },
    { id: 'forms',   label: 'Manual Forms',              actions: ['view', 'create', 'edit', 'delete', 'download'] },
  ] },
  mentorAI: { icon: 'fa-robot', screens: [
    { id: 'plans',    label: 'Plan Management', actions: ['view', 'create', 'edit', 'delete', 'download'] },
    { id: 'payments', label: 'Payments',        actions: ['view', 'approve', 'download'] },
  ] },
  support: { icon: 'fa-headset', screens: [
    { id: 'overview', label: 'Overview',    actions: V },
    { id: 'inbox',    label: 'Agent Inbox', actions: ['view', 'create', 'edit'] },
  ] },
  techModule: { icon: 'fa-list-check', screens: [
    { id: 'bugs_new_dev',      label: 'Bugs & New Development', actions: ['view', 'create', 'edit', 'delete'] },
    { id: 'in_progress',       label: 'In Progress',            actions: ['view', 'edit'] },
    { id: 'qa_review',         label: 'Review & Testing (QA)',  actions: ['view', 'edit', 'approve'] },
    { id: 'ready_for_release', label: 'Ready for Release',      actions: ['view', 'approve', 'download'] },
  ] },
  teachersTraining: { icon: 'fa-chalkboard-user', screens: [
    { id: 'trainings', label: 'Teacher Trainings', actions: ['view', 'create', 'edit', 'delete', 'download'] },
  ] },
  quizContent: { icon: 'fa-circle-question', screens: [
    { id: 'classes',  label: 'Classes',  actions: CRUD },
    { id: 'subjects', label: 'Subjects', actions: CRUD },
    { id: 'mcq',      label: 'MCQ Bank', actions: ['view', 'create', 'edit', 'delete', 'download'] },
  ] },
  notifications: { icon: 'fa-bell', screens: [
    { id: 'compose', label: 'Compose / Send',     actions: ['view', 'create'] },
    { id: 'sent',    label: 'Sent Notifications', actions: ['view', 'edit', 'delete'] },
  ] },
  userManagement: { icon: 'fa-users-gear', screens: [
    { id: 'registration', label: 'User Registration', actions: CRUD },
    { id: 'assign',       label: 'Assign School',     actions: ['view', 'edit'] },
    { id: 'permissions',  label: 'User Permission',   actions: ['view', 'edit'] },
  ] },
};

/* Left rail = API ke 15 fields, isi tarteeb me. */
export const PERM_MODULES = MODULE_ACCESS_FIELDS.map((f) => ({
  key: f.key,
  label: f.label,
  icon: MODULE_SCREENS[f.key]?.icon || 'fa-cube',
  screens: MODULE_SCREENS[f.key]?.screens || [{ id: 'main', label: f.label, actions: V }],
}));

export const TOTAL_PERMS = PERM_MODULES.reduce((t, m) => t + m.screens.reduce((s, sc) => s + sc.actions.length, 0), 0);

export const pkey = (mod, screen, action) => `${mod}.${screen}.${action}`;
export const isOn = (perms, mod, screen, action) => !!perms[pkey(mod, screen, action)];

/* ── perms map ↔ API list ──
   API: [{ menuName, subMenuName, action, isAccessable }]
   menuName = module ka label ("Schools Payment"), subMenuName = screen ka
   label ("Challans"), action = "View" / "Create" / … . Wapas padhte waqt
   label YA key dono se milate hain, chhote-bade huroof ka farq nahi. */
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function permsToApiList(perms) {
  const out = [];
  PERM_MODULES.forEach((m) => m.screens.forEach((s) => s.actions.forEach((a) => {
    out.push({ menuName: m.label, subMenuName: s.label, action: ACTION_LABELS[a], isAccessable: isOn(perms, m.key, s.id, a) });
  })));
  return out;
}

export function apiListToPerms(rows) {
  if (!rows || !rows.length) return null;
  const idx = new Map();
  rows.forEach((r) => idx.set(`${norm(r.menuName)}|${norm(r.subMenuName)}|${norm(r.action)}`, r.isAccessable));
  const out = {};
  PERM_MODULES.forEach((m) => m.screens.forEach((s) => s.actions.forEach((a) => {
    const v = [norm(m.label), norm(m.key)].flatMap((mn) => [norm(s.label), norm(s.id)].flatMap((sn) =>
      [norm(ACTION_LABELS[a]), norm(a)].map((an) => idx.get(`${mn}|${sn}|${an}`))))
      .find((x) => x !== undefined);
    if (v !== undefined) out[pkey(m.key, s.id, a)] = !!v;
  })));
  return out;
}

export function setModule(perms, mod, value) {
  const next = { ...perms };
  mod.screens.forEach((s) => s.actions.forEach((a) => { next[pkey(mod.key, s.id, a)] = value; }));
  return next;
}

/* Starting / effective state.
   • stored (get-superadmin-module-permission) me jis module ki entries hain →
     wahi, bilkul jaisi save hui thin.
   • baqi modules → module flag: on = sab actions on, off = sab off.
     flags null = koi record nahi = poori access (sidebar bhi yahi karta hai). */
export function buildInitialPerms(flags, stored) {
  let perms = {};
  PERM_MODULES.forEach((m) => {
    const storedHasModule = stored && m.screens.some((s) => s.actions.some((a) => stored[pkey(m.key, s.id, a)] !== undefined));
    if (storedHasModule) {
      m.screens.forEach((s) => s.actions.forEach((a) => { perms[pkey(m.key, s.id, a)] = !!stored[pkey(m.key, s.id, a)]; }));
      return;
    }
    perms = setModule(perms, m, flags ? !!flags[m.key] : true);
  });
  return perms;
}

export function moduleStat(perms, m) {
  let total = 0; let on = 0;
  m.screens.forEach((s) => s.actions.forEach((a) => { total += 1; if (isOn(perms, m.key, s.id, a)) on += 1; }));
  return { total, on, allOn: total > 0 && on === total, anyOn: on > 0 };
}

export function overallStats(perms) {
  let modules = 0; let screens = 0; let active = 0; let restricted = 0;
  PERM_MODULES.forEach((m) => {
    let modAny = false;
    m.screens.forEach((s) => {
      const any = s.actions.some((a) => isOn(perms, m.key, s.id, a));
      s.actions.forEach((a) => { if (isOn(perms, m.key, s.id, a)) active += 1; });
      if (any) { screens += 1; modAny = true; } else restricted += 1;
    });
    if (modAny) modules += 1;
  });
  return { modules, screens, active, restricted };
}

/* Role (get-all-users ka isAdmin): true = Head (hamesha poori access, User
   Permission us par lagu nahi), false = Teacher (User Permission se chalta hai). */
export const isHeadUser = (u) => u?.isAdmin === true || String(u?.isAdmin).toLowerCase() === 'true';
export const roleLabel = (u) => (isHeadUser(u) ? 'Head' : 'Teacher');

/* Logged-in user ke saved rows → effective perms map. rows null = full access (null return). */
export function effectivePermsFromRows(flags, rows) {
  if (!flags && !rows) return null;
  return buildInitialPerms(flags || null, rows ? apiListToPerms(rows) : null);
}
