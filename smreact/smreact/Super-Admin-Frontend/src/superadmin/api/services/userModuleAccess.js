/* User Module Access — per-user Super Admin menu permissions.

   POST {SA_ADMIN_API_BASE}/SchoolMentorSuperAdminAPI/api/UserModuleAccess/manage
     body: { action, id, userID, dashboard, etubeUploader, etubeCategory,
             networkPermission, schoolPermission, scoolProgress, schoolPayments,
             policyMenual, mentorAI, support, techModule, teachersTraining,
             quizContent, notifications, userManagement, actionBy }

   Live check:
     • action sirf "save" | "get" | "delete" ("Invalid action. Allowed values: save, delete, get.")
     • get, jab record na ho → { success:false, message:"No module access record for this user." }
       Is ko error nahi, "abhi koi record nahi" (null) maana jata hai.
   NOTE: field names backend ke spelling me hain (scoolProgress, policyMenual) — mat badlo. */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken } from '../config';
import { currentUserId } from './auth';

const PATH = '/SchoolMentorSuperAdminAPI/api/UserModuleAccess/manage';

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

async function call(body, label) {
  const token = authToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  return { res, json, label };
}

/**
 * Ek user ki saved module access.
 * @returns {Promise<{id:number, flags:Object<string,boolean>}|null>} null = koi record nahi
 */
export async function getModuleAccess(userId) {
  const uid = Number(userId) || 0;
  if (!uid) return null;
  const { res, json } = await call({ action: 'get', id: 0, userID: uid, actionBy: currentUserId() }, 'load permissions');
  if (json && json.success === false) {
    if (/no module access record/i.test(String(json.message || ''))) return null;
    throw new ApiError(json.message || 'Could not load permissions', res.status);
  }
  if (!res.ok) throw new ApiError(`Could not load permissions (${res.status})`, res.status);
  const d = json?.data ?? json;
  const row = Array.isArray(d) ? d[0] : d;
  if (!row || typeof row !== 'object') return null;
  const flags = {};
  MODULE_ACCESS_FIELDS.forEach(({ key }) => { flags[key] = Boolean(pick(row, key)); });
  return { id: Number(pick(row, 'id') ?? pick(row, 'ID')) || 0, flags };
}

/**
 * Save (insert/update) — id 0 = naya record.
 * @param {{userId:number, id?:number, flags:Object<string,boolean>}} p
 */
export async function saveModuleAccess({ userId, id = 0, flags = {} }) {
  const body = { action: 'save', id: Number(id) || 0, userID: Number(userId) || 0, actionBy: currentUserId() };
  MODULE_ACCESS_FIELDS.forEach(({ key }) => { body[key] = Boolean(flags[key]); });
  const { res, json } = await call(body, 'save permissions');
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message)) || 'Could not save permissions', res.status);
  }
  const d = json?.data;
  const row = Array.isArray(d) ? d[0] : d;
  return { id: Number(row?.id ?? row?.ID ?? json?.id) || Number(id) || 0 };
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
