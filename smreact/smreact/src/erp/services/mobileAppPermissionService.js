import { buildUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   MOBILE APP PERMISSION — POST /manage-mobileapp-permission

   Super Admin (School Permissions → Manage Mobile App) isay SAVE karta
   hai. ERP yahan GET karta hai taake Chat / Mentor AI / eTube us school
   ke flags maanein.

     { action: "GET", branchID, chatType, mentorAI, parentAccess,
       etube, etubeView, etubeUpload }

   JWT mat bhejo — ERP swagger API us par 403 deti hai.
   ═══════════════════════════════════════════════════════════════════ */

const ENDPOINT = '/manage-mobileapp-permission';

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
  if (['true', '1', 'y', 'yes', 'active'].includes(s)) return true;
  if (['false', '0', 'n', 'no', 'inactive'].includes(s)) return false;
  return fallback;
}

export function emptyMobileAppPerms() {
  return {
    hasRow: false,
    mobileAppId: 0,
    chatMode: 'off',
    mentorAi: { enabled: false, parentsAccess: false },
    etube: { enabled: false, viewing: false, uploading: false },
  };
}

export function rowToMobileAppPerms(row) {
  if (!row || typeof row !== 'object') return emptyMobileAppPerms();
  const chatType = String(pick(row, ['chatType', 'ChatType'], 'off') || 'off');
  return {
    hasRow: true,
    mobileAppId: Number(pick(row, ['id', 'ID'], 0)) || 0,
    chatMode: chatType || 'off',
    mentorAi: {
      enabled: boolFlag(pick(row, ['mentorAI', 'MentorAI']), false),
      parentsAccess: boolFlag(pick(row, ['parentAccess', 'ParentAccess']), false),
    },
    etube: {
      enabled: boolFlag(pick(row, ['etube', 'Etube']), false),
      viewing: boolFlag(pick(row, ['etubeView', 'EtubeView']), false),
      uploading: boolFlag(pick(row, ['etubeUpload', 'EtubeUpload']), false),
    },
  };
}

async function postMobileAppPermission(body) {
  const res = await fetch(buildUrl(ENDPOINT), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || 'Could not load mobile app permissions');
  }
  return json;
}

export async function listMobileAppPermission(branchId) {
  const json = await postMobileAppPermission({
    action: 'GET',
    id: 0,
    branchID: Number(branchId) || 0,
    chatType: '',
    mentorAI: false,
    parentAccess: false,
    etube: false,
    etubeView: false,
    etubeUpload: false,
  });
  const rows = Array.isArray(json?.data) ? json.data
    : Array.isArray(json?.Data) ? json.Data
      : (json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? [json.data] : []);
  return rows[0] ? rowToMobileAppPerms(rows[0]) : emptyMobileAppPerms();
}
