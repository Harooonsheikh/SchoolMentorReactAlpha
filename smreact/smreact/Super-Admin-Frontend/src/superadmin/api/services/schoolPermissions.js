/* ════════════════════════════════════════════════════════════════════
   School Permissions service — the live branch list behind the
   "School Permissions" screen.

   Backend: SchoolMentorSuperAdminAPI (its own IIS application root)
     swagger  /SchoolMentorSuperAdminAPI/swagger/index.html
     GET      .../api/SchoolPermissions/get-branches-with-permissions
       → [ { branch: { id, name, branchCode, description, address,
                       branchOwner, branchEmail1, branchPhone, isActive,
                       launchSetup, academicSession, branchLogo, bank fields,
                       city/province/countryID, audit stamps, … },
             modulePermission: { branchID, academics, examination,
                                 paperGenerator, …, userPermissions } | null } ]

   Branch → table row / core cards:
     id          → id
     name        → name
     branchCode  → schoolCode          (the real code, not the id)
     branchOwner → principal
     branchPhone → contact
     launchSetup → perms.erpAccess     ("ERP Access" card + "ERP Status" pill)
     isActive    → perms.activeBranch  ("Active Branch" card)

   modulePermission → the modal's module switches, verbatim: a true flag opens
   its toggle, false closes it. `modulePermission: null` means the branch has
   no saved row yet → EVERY module defaults to ON, matching what the ERP does
   with the same missing row (module-permission/{branchID} answers 404 there,
   and the ERP then applies no school-level restriction).

   The older get-branch route (branch directory only, no module flags) is still
   mapped by the same code — a plain branch row falls back to the seeded
   defaults, since it carries no permission data to honour.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError, buildQuery } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken, getSuperAdminIdentity } from '../config';
import EP from '../endpoints';
import { ALL_MODULE_KEYS, defaultPerms } from '../../permissionsData';

/* ── field readers ──────────────────────────────────────────────── */

/* 'Branch_Name' / 'branchName' / 'BRANCHNAME' → 'branchname' */
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

/** First present value among `names` on `obj`, matched case-insensitively.
   Kept tolerant because .NET DTOs here mix camelCase and PascalCase. */
function pick(obj, names, fallback = undefined) {
  if (!obj) return fallback;
  const map = new Map(Object.keys(obj).map((k) => [norm(k), k]));
  for (const n of names) {
    const key = map.get(norm(n));
    if (key != null && obj[key] != null && obj[key] !== '') return obj[key];
  }
  return fallback;
}

/** Coerce the shapes a .NET flag arrives in (true / 1 / "1" / "true" / "Y"). */
function bool(v, fallback = false) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'y', 'yes', 'active'].includes(s)) return true;
  if (['false', '0', 'n', 'no', 'inactive'].includes(s)) return false;
  return fallback;
}

/* ModulePermission property → the UI module key, where they differ. */
const MODULE_ALIAS = {
  humanresource: 'hr', humanresources: 'hr',
  staffappraisal: 'staffappraisals',
  schoolsop: 'schoolsops',
  teachertraining: 'teachertrainings',
  auditlog: 'auditlogs',
  userpermission: 'userpermissions',
  timetables: 'timetable',
};

const MODULE_BY_NORM = new Map(ALL_MODULE_KEYS.map((k) => [norm(k), k]));

/** Resolve one API property name → a UI module key, or null if it isn't one.
   'paperGenerator' → papergenerator, 'timeTable' → timetable,
   'humanResource' → hr, 'isAcademics' → academics. */
function toModuleKey(rawKey) {
  const k = norm(rawKey).replace(/^(is|has|allow|enable|enabled|can)/, '');
  return MODULE_BY_NORM.get(k) || MODULE_ALIAS[k] || null;
}

const allModules = (value) => Object.fromEntries(ALL_MODULE_KEYS.map((k) => [k, value]));

/**
 * A saved ModulePermission row → the modal's module switches.
 *
 * A saved row is authoritative: a true flag opens its toggle, false closes it.
 * `null` (no row for this branch yet) opens ALL of them — an unconfigured
 * school is unrestricted, exactly how the ERP reads the same missing row.
 * The DTO's non-module fields (id, branchID, createdAt, createdBy, …) are
 * ignored by `toModuleKey`.
 */
export function readModulePermission(mp) {
  if (!mp || typeof mp !== 'object') return allModules(true);
  const out = allModules(false);

  /* Array form: ['Academics', …] or [{ moduleName, isAccessable }, …]. */
  if (Array.isArray(mp)) {
    mp.forEach((entry) => {
      const name = typeof entry === 'string'
        ? entry
        : pick(entry, ['moduleName', 'menuName', 'name', 'module', 'key']);
      const key = toModuleKey(name);
      if (!key) return;
      out[key] = typeof entry === 'string'
        ? true
        : bool(pick(entry, ['isAccessable', 'isAccessible', 'isActive', 'active', 'enabled', 'value']), true);
    });
    return out;
  }

  /* Object form: the ModulePermission DTO ({ academics: true, … }). */
  Object.keys(mp).forEach((rawKey) => {
    const key = toModuleKey(rawKey);
    if (key) out[key] = bool(mp[rawKey], false);
  });
  return out;
}

/**
 * Module toggles for a payload that isn't the wrapper shape (the legacy
 * get-branch rows): read a nested permission object if one is there, and
 * otherwise keep the seeded defaults — a branch row on its own carries no
 * permission data, so blanking the modal would be a lie either way.
 */
export function readModules(row, base) {
  const nested = pick(row, ['modulePermission', 'modulePermissions', 'modules', 'permissions']);
  if (!nested || typeof nested !== 'object') return { ...base };
  return readModulePermission(nested);
}

/* ── row mapping ────────────────────────────────────────────────── */

const initials = (name) => String(name || '')
  .replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2)
  .toUpperCase() || 'SM';

/**
 * One API entry → { school, perms } for SchoolPermissions.jsx.
 * Accepts the wrapper `{ branch, modulePermission }` from
 * get-branches-with-permissions, or a bare branch row from get-branch.
 */
export function branchToSchoolPerm(entry) {
  const wrapped = Boolean(entry && typeof entry === 'object' && entry.branch && typeof entry.branch === 'object');
  const row = wrapped ? entry.branch : entry;

  const id = pick(row, ['id', 'branchID', 'branchId']);
  const name = pick(row, ['name', 'branchName', 'schoolName'], 'Unnamed Branch');
  const erpAccess = bool(pick(row, ['launchSetup', 'erpAccess']), false);
  const activeBranch = bool(pick(row, ['isActive', 'active']), false);
  /* The table's source pill: live branches read as ERP, the rest Inactive. */
  const source = activeBranch ? 'erp' : 'inactive';

  const school = {
    id,
    name,
    principal: pick(row, ['branchOwner', 'principal', 'ownerName', 'owner'], ''),
    contact: String(pick(row, ['branchPhone', 'contact', 'phone', 'mobile'], '') || ''),
    source,
    initials: initials(name),
    schoolCode: String(pick(row, ['branchCode', 'schoolCode', 'code'], id ?? '')),
    email: pick(row, ['branchEmail1', 'branchEmail', 'email'], ''),
    address: pick(row, ['address'], ''),
    session: pick(row, ['academicSession'], ''),
    description: pick(row, ['description'], ''),
    logo: pick(row, ['branchLogo'], ''),
    /* whether this branch has a saved permission row at all */
    hasPermissionRow: wrapped ? Boolean(entry.modulePermission) : undefined,
    /* Branch ki apni bank details — yeh isi route par aati hain, aur Schools
       Payment ki challan slip ("Payment Method — Bank Transfer") inhi ko
       dikhati hai. Khali fields '' rehti hain; slip un par '—' dikhata hai. */
    bank: {
      bankName: pick(row, ['bankName'], ''),
      accountTitle: pick(row, ['accountTitle'], ''),
      accountNo: String(pick(row, ['bankAccountno', 'bankAccountNo', 'accountNo'], '') || ''),
      branchName: pick(row, ['bankBranchName'], ''),
      iban: pick(row, ['iban'], ''),
      note: pick(row, ['accountDesc'], ''),
    },
    raw: row,
  };

  const perms = {
    erpAccess,
    activeBranch,
    /* wrapper payload → the saved row decides (null = everything off);
       bare branch row → nothing to honour, fall back to the defaults. */
    modules: wrapped
      ? readModulePermission(entry.modulePermission)
      : readModules(row, defaultPerms({ source }).modules),
  };

  return { school, perms };
}

/* ── fetch ──────────────────────────────────────────────────────── */

async function getJson(url, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(url, {
      headers: {
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (!res.ok) throw new ApiError(`Failed to load ${label} (${res.status})`, res.status);
  return res.json().catch(() => null);
}

/**
 * Live school list + saved module permissions for the School Permissions screen.
 *   GET .../api/SchoolPermissions/get-branches-with-permissions
 *   → [ { branch, modulePermission }, … ]  (a bare array; the older
 *     { data: [...] } envelope is still unwrapped for the legacy route)
 * @returns {Promise<{ schools: Array, permMap: Object }>} — `schools` in table
 *   order, `permMap` keyed by school id (exactly what the screen holds).
 */
export async function listPermissionBranches() {
  const body = await getJson(
    `${SA_ADMIN_API_BASE}${EP.schoolPermissions.branchesWithPermissions()}`,
    'school permissions',
  );
  const rows = Array.isArray(body) ? body
    : Array.isArray(body?.data) ? body.data
      : Array.isArray(body?.result) ? body.result : [];

  const schools = [];
  const permMap = {};
  rows.forEach((row) => {
    const { school, perms } = branchToSchoolPerm(row);
    if (school.id == null) return;              // unusable without a key
    schools.push(school);
    permMap[school.id] = perms;
  });
  return { schools, permMap };
}

/**
 * Sirf bank details, branch id se keyed — Schools Payment ki challan slip ke
 * liye (wahi get-branches-with-permissions call, koi naya endpoint nahi).
 * @returns {Promise<Object>} { [branchId]: { bankName, accountTitle,
 *   accountNo, branchName, iban, note } }
 */
export async function listBranchBanks() {
  const { schools } = await listPermissionBranches();
  const out = {};
  schools.forEach((s) => { if (s.bank) out[s.id] = s.bank; });
  return out;
}

/* ── save ───────────────────────────────────────────────────────── */

/* UI module key → the ModulePermission property the API expects. */
const MODULE_API_FIELD = {
  academics: 'academics',
  examination: 'examination',
  papergenerator: 'paperGenerator',
  attendance: 'attendance',
  timetable: 'timeTable',
  fee: 'fee',
  accounts: 'accounts',
  inventory: 'inventory',
  admissioncrm: 'admissionCRM',
  students: 'students',
  hr: 'humanResource',
  staffappraisals: 'staffAppraisals',
  schoolsops: 'schoolSOPs',
  teachertrainings: 'teacherTrainings',
  auditlogs: 'auditLogs',
  settings: 'settings',
  userpermissions: 'userPermissions',
};

async function sendJson(url, method, body, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (!res.ok) throw new ApiError(`Failed to ${label} (${res.status})`, res.status);
  return res.json().catch(() => null);
}

/** The ModulePermission body for one branch, built from the modal's toggles. */
export function toModulePermissionBody(branchId, modules) {
  const userId = Number(getSuperAdminIdentity().userId) || 0;
  const body = { branchID: Number(branchId) || 0, createdBy: userId, modifiedBy: userId };
  Object.entries(MODULE_API_FIELD).forEach(([uiKey, apiKey]) => {
    body[apiKey] = Boolean(modules?.[uiKey]);
  });
  return body;
}

/**
 * Save the modal's module toggles.
 *   POST /api/SchoolPermissions/save-modulePermission
 *   body: { branchID, academics, examination, paperGenerator, …, createdBy, modifiedBy }
 */
export function saveModulePermission(branchId, modules) {
  return sendJson(
    `${SA_ADMIN_API_BASE}${EP.schoolPermissions.saveModulePermission()}`,
    'POST',
    toModulePermissionBody(branchId, modules),
    'save module permissions',
  );
}

/* Both toggle routes carry their value in the QUERY string and take no body —
   but IIS answers a body-less PUT with 411 Length Required, so an empty JSON
   object is sent purely to give the request a Content-Length. (Verified
   against the live API: without it 411, with it 200.) */
const NO_BODY = {};

/**
 * The "ERP Access" card.
 *   PUT /api/SchoolPermissions/toggle-launch-setup/{branchID}?launchSetup=1|0
 * The value is an INT — 1 when the switch is on, 0 when off.
 */
export function setLaunchSetup(branchId, enabled) {
  const url = `${SA_ADMIN_API_BASE}${EP.schoolPermissions.toggleLaunchSetup(branchId)}`
    + buildQuery({ launchSetup: enabled ? 1 : 0 });
  return sendJson(url, 'PUT', NO_BODY, 'update ERP access');
}

/**
 * The "Active Branch" card.
 *   PUT /api/SchoolPermissions/ToggleBranchStatus/{branchID}?isActive=true|false
 * The value is a BOOL — true when the switch is on, false when off.
 */
export function setBranchStatus(branchId, active) {
  const url = `${SA_ADMIN_API_BASE}${EP.schoolPermissions.toggleBranchStatus(branchId)}`
    + buildQuery({ isActive: active ? 'true' : 'false' });
  return sendJson(url, 'PUT', NO_BODY, 'update branch status');
}

/**
 * "Save Permissions" in the modal — all three writes for one branch:
 *   1. POST save-modulePermission     (every module switch)
 *   2. PUT  toggle-launch-setup       (ERP Access → launchSetup 1/0)
 *   3. PUT  ToggleBranchStatus        (Active Branch → isActive true/false)
 *
 * Sequential on purpose: the first failure surfaces as the error the modal
 * shows, instead of three racing calls with a half-applied result.
 *
 * @param branchId  the branch id
 * @param perms     the modal draft { erpAccess, activeBranch, modules }
 */
export async function savePermissions(branchId, perms) {
  await saveModulePermission(branchId, perms.modules);
  await setLaunchSetup(branchId, perms.erpAccess);
  await setBranchStatus(branchId, perms.activeBranch);
}

const schoolPermissionsService = {
  listPermissionBranches,
  branchToSchoolPerm,
  readModules,
  readModulePermission,
  toModulePermissionBody,
  saveModulePermission,
  setLaunchSetup,
  setBranchStatus,
  savePermissions,
};
export default schoolPermissionsService;
