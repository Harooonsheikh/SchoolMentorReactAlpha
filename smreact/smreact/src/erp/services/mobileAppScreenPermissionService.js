import { buildUrl } from '../../utils/apiConfig';
import {
  ADMIN_APP_GROUPS,
  TEACHER_APP_GROUPS,
  emptyMobileApiFlags,
  flagsFromFeatureBag,
  featureBagFromFlags,
  mobileAppTypeApi,
  mobileAccountType,
  roleFromAppType,
  defaultMobileAppAccess,
} from '../pages/UserPermissions/mobileAppPermissionsData';

/* ═══════════════════════════════════════════════════════════════════
   USER PERMISSIONS — Mobile App Access
   POST /manage-mobileapp-screen-permission

     action: GET | SAVE
     appType: "Admin" | "Teacher"
     appAccess: enable checkbox → true / false
     accountID: us user ki employee id
     accountType: "Teacher" | "Administrator"
     baqi booleans: jo screens checked hain → true, unchecked → false
   ═══════════════════════════════════════════════════════════════════ */

const ENDPOINT = '/manage-mobileapp-screen-permission';

function pick(obj, names, fallback) {
  if (!obj) return fallback;
  const map = new Map(Object.keys(obj).map((k) => [String(k).toLowerCase(), k]));
  for (const n of names) {
    const key = map.get(String(n).toLowerCase());
    if (key != null && obj[key] != null && obj[key] !== '') return obj[key];
  }
  return fallback;
}

function boolFlag(v, fallback = false) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'y', 'yes'].includes(s)) return true;
  if (['false', '0', 'n', 'no'].includes(s)) return false;
  return fallback;
}

function authHeaders() {
  const token = sessionStorage.getItem('token');
  return {
    Accept: '*/*',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function postScreenPermission(body) {
  const res = await fetch(buildUrl(ENDPOINT), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || 'Could not save mobile app access');
  }
  return json;
}

function extractRows(json) {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.Data)) return json.Data;
  if (json?.data && typeof json.data === 'object') return [json.data];
  if (json && typeof json === 'object' && (json.accountID != null || json.AccountID != null || json.appType || json.AppType)) {
    return [json];
  }
  return [];
}

export function rowToMobileAppState(row, current = defaultMobileAppAccess()) {
  if (!row) return { ...current, screenPermId: 0 };
  const role = roleFromAppType(pick(row, ['appType', 'AppType'], '')) || current.role;
  const next = {
    ...current,
    screenPermId: Number(pick(row, ['id', 'ID'], 0)) || 0,
    enabled: boolFlag(pick(row, ['appAccess', 'AppAccess'], false), false),
    role,
  };
  if (role === 'admin') {
    next.adminApp = featureBagFromFlags(row, ADMIN_APP_GROUPS);
  } else if (role === 'teacher') {
    next.teacherApp = featureBagFromFlags(row, TEACHER_APP_GROUPS);
  }
  return next;
}

export async function listMobileAppScreenPermission({ branchId, accountId, accountType, appType = '' } = {}) {
  const json = await postScreenPermission({
    action: 'GET',
    id: 0,
    branchID: Number(branchId) || 0,
    appType: appType || '',
    appAccess: false,
    accountID: Number(accountId) || 0,
    accountType: accountType || '',
    ...emptyMobileApiFlags(),
  });
  const rows = extractRows(json);
  const aid = Number(accountId) || 0;
  const match = rows.find((r) => Number(pick(r, ['accountID', 'AccountID'], 0)) === aid) || rows[0] || null;
  return match;
}

export async function saveMobileAppScreenPermission(user, mobileApp) {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  const accountId = Number(user?.empId ?? user?.employeeId) || 0;
  const roleKey = mobileApp.role === 'teacher' ? 'teacher' : (mobileApp.role === 'admin' ? 'admin' : '');
  const bag = roleKey === 'teacher' ? mobileApp.teacherApp : mobileApp.adminApp;
  const flags = mobileApp.enabled && roleKey ? flagsFromFeatureBag(bag) : emptyMobileApiFlags();
  const json = await postScreenPermission({
    action: 'SAVE',
    id: Number(mobileApp.screenPermId) || 0,
    branchID: branchId,
    appType: mobileAppTypeApi(roleKey) || 'Admin',
    appAccess: Boolean(mobileApp.enabled),
    accountID: accountId,
    accountType: mobileAccountType(user),
    ...flags,
  });
  const newId = Number(json?.data?.id ?? json?.data?.ID ?? json?.id) || Number(mobileApp.screenPermId) || 0;
  return { ...mobileApp, screenPermId: newId };
}
