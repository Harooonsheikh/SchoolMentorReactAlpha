/* User Module Access — per-user Super Admin permissions.

   Purana POST /api/UserModuleAccess/manage backend se HATA diya gaya hai
   (404, swagger me nahi). Ab sab kuch Auth ki permission APIs par:
     • POST /api/Auth/save-superadmin-module-permission
         { userID, modifiedBy, permissions:[{ menuName, subMenuName, action, isAccessable }] }
     • GET  /api/Auth/get-superadmin-module-permission-byuserid/{userId}
         → { data:[{ userID, …, permissions:[{ menuName, subMenuName, action, isAccessable, … }] }] }
         404 "No permissions found for this user." = abhi kuch save nahi
     • GET  /api/Auth/get-superadmin-module-permission  → saare users, isi shakal me

   Module flag (sidebar ke liye) = us module (menuName) me koi bhi action
   isAccessable:true. menuName = MODULE_ACCESS_FIELDS ka label. */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken } from '../config';
import { currentUserId } from './auth';
import { EP } from '../endpoints';


/* Har API field → screen ka label + sidebar NAV id (SuperAdminShell).
   `nav: null` = abhi sidebar me us ka koi module nahi (Tech Module). */
export const MODULE_ACCESS_FIELDS = [
  { key: 'dashboard',         label: 'Dashboard',           nav: 'dashboard' },
  { key: 'etubeUploader',     label: 'E-Tube Uploader',     nav: 'etube' },
  { key: 'etubeCategory',     label: 'E-Tube Category',     nav: 'etube' },
  { key: 'networkPermission', label: 'Network Permissions', nav: 'networkPermissions' },
  { key: 'schoolPermission',  label: 'School Permissions',  nav: 'permissions' },
  { key: 'scoolProgress',     label: 'Schools Progress',    nav: 'status' },
  { key: 'schoolPayments',    label: 'Schools Payment',     nav: 'payments' },
  { key: 'policyMenual',      label: 'Policy Manuals',      nav: 'sops' },
  { key: 'mentorAI',          label: 'Mentor AI',           nav: 'mentorAI' },
  { key: 'support',           label: 'Support',             nav: 'support' },
  { key: 'techModule',        label: 'Tech Module',         nav: 'techModule' },
  { key: 'teachersTraining',  label: 'Teachers Training',   nav: 'trainings' },
  { key: 'quizContent',       label: 'Quiz Content',        nav: 'quiz' },
  { key: 'notifications',     label: 'Notifications',       nav: 'notifications' },
  { key: 'userManagement',    label: 'User Management',     nav: 'users' },
];

/* Response me key kabhi camelCase, kabhi PascalCase — dono padho. */
const pick = (row, key) => {
  if (!row) return undefined;
  if (key in row) return row[key];
  const pascal = key[0].toUpperCase() + key.slice(1);
  return row[pascal];
};

/* Login ke foran baad Shell ka effect App ke configureSuperAdmin se PEHLE chalta hai
   (child effects pehle) — tab cfg.token abhi khali hota hai. Is liye login par
   sessionStorage me rakha token fallback. */
function authToken() {
  const t = getSuperAdminToken();
  if (t) return t;
  try { return sessionStorage.getItem('superadmintoken') || null; } catch { return null; }
}

/* ═══════ Screen × action permissions (Auth/…-superadmin-module-permission) ═══════ */

async function authFetch(url, init = {}) {
  const token = authToken();
  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        accept: '*/*',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const raw = await res.text();
  let json = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { /* plain text */ }
  return { res, json, raw };
}

/**
 * Ek user ki saved screen-level permissions.
 * @returns {Promise<Array<{menuName:string, subMenuName:string, action:string, isAccessable:boolean}>|null>}
 *          null = abhi kuch save nahi hua (API 404 "No permissions found…")
 */
export async function getMenuPermissions(userId) {
  const uid = Number(userId) || 0;
  if (!uid) return null;
  const { res, json } = await authFetch(`${SA_ADMIN_API_BASE}${EP.auth.getMenuPermissions(uid)}`);
  if (json && json.success === false) {
    if (res.status === 404 || /no permissions found/i.test(String(json.message || ''))) return null;
    throw new ApiError(json.message || 'Could not load permissions', res.status);
  }
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new ApiError(`Could not load permissions (${res.status})`, res.status);
  }
  const rows = permRowsFrom(json?.data ?? json, uid);
  return rows.length ? rows : null;
}

/* Response ki har shakal se permission rows nikalo:
     data:[{ userID, permissions:[…] }]  (asal shakal)
     data:[…rows]  ya  { permissions:[…] }
   userId diya ho to sirf usi user ki. */
function permRowsFrom(d, userId) {
  const list = Array.isArray(d) ? d : (d && typeof d === 'object' ? [d] : []);
  const out = [];
  list.forEach((item) => {
    const nested = pick(item, 'permissions');
    if (Array.isArray(nested)) {
      const uid = Number(pick(item, 'userID') ?? pick(item, 'userId')) || 0;
      if (userId && uid && uid !== Number(userId)) return;
      nested.forEach((r) => out.push(r));
    } else if (item && pick(item, 'menuName') !== undefined) {
      out.push(item);
    }
  });
  return out.map((r) => ({
    menuName:    String(pick(r, 'menuName') ?? '').trim(),
    subMenuName: String(pick(r, 'subMenuName') ?? '').trim(),
    action:      String(pick(r, 'action') ?? '').trim(),
    isAccessable: Boolean(pick(r, 'isAccessable') ?? pick(r, 'isAccessible')),
  })).filter((r) => r.menuName && r.action);
}

const normKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Permission rows → module flags { dashboard:true, … } (MODULE_ACCESS_FIELDS keys). */
export function flagsFromMenuRows(rows) {
  const flags = {};
  MODULE_ACCESS_FIELDS.forEach((f) => { flags[f.key] = false; });
  (rows || []).forEach((r) => {
    if (!r.isAccessable) return;
    const n = normKey(r.menuName);
    const f = MODULE_ACCESS_FIELDS.find((x) => normKey(x.label) === n || normKey(x.key) === n);
    if (f) flags[f.key] = true;
  });
  return flags;
}

/**
 * Ek user ki module access (sidebar / table ke liye).
 * @returns {Promise<{id:number, flags:Object<string,boolean>, rows:Array}|null>} null = kuch save nahi (poori access)
 */
export async function getModuleAccess(userId) {
  const rows = await getMenuPermissions(userId);
  if (!rows) return null;
  return { id: 0, flags: flagsFromMenuRows(rows), rows };
}

/**
 * Saare users ki permissions ek call me.
 * @returns {Promise<Map<number, Array>>} userID → rows (jis ka record nahi wo map me nahi)
 */
export async function getAllMenuPermissions() {
  const { res, json } = await authFetch(`${SA_ADMIN_API_BASE}${EP.auth.getAllMenuPermissions()}`);
  if (json && json.success === false) {
    if (res.status === 404) return new Map();
    throw new ApiError(json.message || 'Could not load permissions', res.status);
  }
  if (!res.ok) throw new ApiError(`Could not load permissions (${res.status})`, res.status);
  const d = json?.data ?? json;
  const map = new Map();
  (Array.isArray(d) ? d : []).forEach((item) => {
    const uid = Number(pick(item, 'userID') ?? pick(item, 'userId')) || 0;
    if (!uid) return;
    const rows = permRowsFrom([item], uid);
    if (rows.length) map.set(uid, rows);
  });
  return map;
}

/**
 * Poori matrix save (har lagu action, true ya false).
 * @param {{userId:number, permissions:Array<{menuName,subMenuName,action,isAccessable}>}} p
 */
export async function saveMenuPermissions({ userId, permissions }) {
  const body = {
    userID: Number(userId) || 0,
    modifiedBy: currentUserId() || 0,
    permissions: (permissions || []).map((p) => ({
      menuName: p.menuName, subMenuName: p.subMenuName, action: p.action, isAccessable: Boolean(p.isAccessable),
    })),
  };
  const { res, json, raw } = await authFetch(`${SA_ADMIN_API_BASE}${EP.auth.saveMenuPermissions()}`, {
    method: 'POST', body: JSON.stringify(body),
  });
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message || json.title)) || raw || 'Could not save permissions', res.status);
  }
  return json;
}

/** flags → sidebar ke allowed NAV ids. null flags (koi record nahi) = null (sab allowed). */
export function allowedNavIds(flags) {
  if (!flags) return null;
  const s = new Set();
  MODULE_ACCESS_FIELDS.forEach(({ key, nav }) => { if (nav && flags[key]) s.add(nav); });
  return s;
}

/* Dashboard ke purane menu naam (userMgmtData UM_MENUS / DASHBOARD_GATES) — "view as"
   preview inhi naamon par sections chhupata hai. */
export function flagsToLegacyMenus(flags) {
  if (!flags) return null;
  const out = [];
  if (flags.dashboard) out.push('Dashboard');
  if (flags.etubeUploader) out.push('Uploader');
  if (flags.etubeCategory) out.push('Category');
  if (flags.schoolPermission) out.push('School Permissions');
  if (flags.scoolProgress) out.push('School Progress');
  if (flags.schoolPayments) out.push('School Payments');
  if (flags.policyMenual) out.push('Policy Manuals');
  if (flags.userManagement) out.push('User Registration', 'User Assignment');
  return out;
}
