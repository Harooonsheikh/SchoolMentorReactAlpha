import { buildUrl } from '../../utils/apiConfig';
import { PARENT_APP_FLAG_KEYS, parentAppFlags } from '../pages/Settings/parentAppFeatures';

/* ═══════════════════════════════════════════════════════════════════
   PARENTS APP SETTINGS — POST /manage-parent-app-permission

     { action, id, branchID, attendance, homeWork, academicsResults,
       fee, timeTable, suggestions, noticeBoard, notebook, leaves }

     action: GET | SAVE | DELETE   (baqi UserPermissions endpoints jaisa)
     id:     0 → naya row insert, warna GET se aaya hua row id update

   School-level record hai (per-user nahi) — ek branch ka ek row.
   JWT mat bhejo — ERP swagger API us par 403 deti hai
   (dekho mobileAppPermissionService.js).
   ═══════════════════════════════════════════════════════════════════ */

const ENDPOINT = '/manage-parent-app-permission';

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

function currentBranchId() {
  return Number(sessionStorage.getItem('branchID')) || 0;
}

function extractRows(json) {
  const d = json?.data ?? json?.Data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') return [d];
  return [];
}

async function postParentAppPermission(body, failMsg) {
  const res = await fetch(buildUrl(ENDPOINT), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || failMsg);
  }
  return json;
}

/** Row → UI shape. Row ki har missing boolean = off. */
function rowToSettings(row) {
  const featureEnabled = PARENT_APP_FLAG_KEYS.reduce((acc, k) => {
    acc[k] = boolFlag(pick(row, [k, k.charAt(0).toUpperCase() + k.slice(1)]), false);
    return acc;
  }, {});
  return { id: Number(pick(row, ['id', 'ID'], 0)) || 0, featureEnabled };
}

/**
 * Is branch ka parents-app record.
 * Koi row na ho (school ne abhi tak save nahi kiya) → sab features ON,
 * id 0 — pehla SAVE insert kar dega.
 */
export async function getParentAppSettings() {
  const branchID = currentBranchId();
  const json = await postParentAppPermission(
    { action: 'GET', id: 0, branchID, ...parentAppFlags(false) },
    'Could not load parents app settings',
  );
  const rows = extractRows(json);
  const row = rows.find((r) => Number(pick(r, ['branchID', 'BranchID'], 0)) === branchID) || rows[0];
  return row ? rowToSettings(row) : { id: 0, featureEnabled: parentAppFlags(true) };
}

/** Checklist save. Returns updated { id, featureEnabled }. */
export async function saveParentAppSettings({ id = 0, featureEnabled = {} } = {}) {
  const branchID = currentBranchId();
  const flags = PARENT_APP_FLAG_KEYS.reduce((acc, k) => {
    acc[k] = Boolean(featureEnabled[k]);
    return acc;
  }, {});
  const json = await postParentAppPermission(
    { action: 'SAVE', id: Number(id) || 0, branchID, ...flags },
    'Could not save parents app settings',
  );
  const row = extractRows(json)[0];
  let newId = Number(pick(row, ['id', 'ID'], 0)) || Number(json?.id) || Number(id) || 0;
  /* Insert par API sirf success bhejti hai, row nahi — id na mile to wapas
     GET kar ke uthao, warna agla SAVE duplicate row bana dega. */
  if (!newId) {
    try { newId = (await getParentAppSettings()).id; } catch { /* save ho chuka hai */ }
  }
  return { id: newId, featureEnabled: flags };
}
