/* ════════════════════════════════════════════════════════════════════
   Network Permissions service — live network list + chain module flags.

   Backend: SchoolMentorSuperAdminAPI
     GET  .../api/AHM_NetworkUsers
       → { success, message, count, data: [ { id, ownerName, schoolNetwork,
             contactNumber, createdDate, isActive, isAdmin, address, … } ] }
     POST .../api/AHM_NetworkUsers/update-isactive   { network_ID, isActive }
       → modal ka "Active Network" card
     POST .../api/SchoolPermissions/network-permissions
       body Mdl_AHM_NetworkPermissionsAction
         { action: GET|SAVE, id, networkID, dashboard, academics,
           schoolPermisison, schoolProgress, schoolPAyments, operationlSOP,
           hr, accounts, attendance, inventory, training, userPermission }
       Field names swagger ke typos ke sath 1:1 hain — rename nahi kiye.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken } from '../config';
import EP from '../endpoints';

/* Chain portal modules — displayed + commented sidebar items, API keys exact. */
export const NETWORK_MODULE_GROUPS = [
  { label: 'Overview', modules: [
    { key: 'dashboard', name: 'Dashboard', icon: 'fa-gauge-high' },
  ] },
  { label: 'Academics & ERP', modules: [
    { key: 'academics', name: 'Academics', icon: 'fa-graduation-cap' },
    { key: 'schoolPermisison', name: 'School Permissions', icon: 'fa-key' },
    { key: 'schoolProgress', name: 'School Progress', icon: 'fa-chart-line' },
    { key: 'schoolPAyments', name: 'School Payments', icon: 'fa-credit-card' },
    { key: 'operationlSOP', name: 'Policy Manuals', icon: 'fa-book-open' },
  ] },
  { label: 'HR & Finance', modules: [
    { key: 'hr', name: 'Human Resource', icon: 'fa-users-gear' },
    { key: 'accounts', name: 'Accounts', icon: 'fa-coins' },
    { key: 'attendance', name: 'Attendance', icon: 'fa-calendar-check' },
    { key: 'inventory', name: 'Inventory', icon: 'fa-boxes-stacking' },
  ] },
  { label: 'Training & Admin', modules: [
    { key: 'training', name: 'Trainings', icon: 'fa-chalkboard-user' },
    { key: 'userPermission', name: 'User Permissions', icon: 'fa-shield-halved' },
    /* Ye do chain portal me hain magar API model me abhi field NAHI
       (Mdl_AHM_NetworkPermissionsAction). Backend inhi naamon se field
       jod de to save/get khud chal parega; tab tak GET me na hon to "on". */
    { key: 'notifications', name: 'Notifications', icon: 'fa-bell' },
    { key: 'settings', name: 'Settings', icon: 'fa-sliders' },
  ] },
];

export const NETWORK_MODULE_KEYS = NETWORK_MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

const initials = (name) => String(name || '')
  .replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2)
  .toUpperCase() || 'NW';

const bool = (v, fallback = false) => {
  if (v == null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'y', 'yes', 'active'].includes(s)) return true;
  if (['false', '0', 'n', 'no', 'inactive'].includes(s)) return false;
  return fallback;
};

const pick = (obj, names, fallback) => {
  if (!obj) return fallback;
  const map = new Map(Object.keys(obj).map((k) => [String(k).toLowerCase(), k]));
  for (const n of names) {
    const key = map.get(String(n).toLowerCase());
    if (key != null && obj[key] != null && obj[key] !== '') return obj[key];
  }
  return fallback;
};

export function emptyNetworkModules(on = true) {
  return Object.fromEntries(NETWORK_MODULE_KEYS.map((k) => [k, !!on]));
}

/** Naye network ki shuruaati permissions — sab chain modules on. */
export function defaultNetworkPerms(network) {
  return {
    activeNetwork: network ? Boolean(network.isActive) : true,
    permissionId: 0,
    modules: emptyNetworkModules(true),
  };
}

export function toNetwork(row) {
  const name = String(row?.schoolNetwork || row?.ownerName || 'Unnamed Network').trim();
  const created = row?.createdDate ? new Date(row.createdDate) : null;
  return {
    id: row?.id,
    name,
    owner: String(row?.ownerName || '').trim(),
    contact: String(row?.contactNumber || '').trim(),
    address: String(row?.address || '').trim(),
    isActive: Boolean(row?.isActive),
    isAdmin: Boolean(row?.isAdmin),
    createdDate: created && !Number.isNaN(created.getTime()) ? created : null,
    initials: initials(name),
  };
}

function authHeaders(json = false) {
  const token = getSuperAdminToken();
  return {
    accept: '*/*',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function unwrapRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.Data)) return json.Data;
  if (json?.data && typeof json.data === 'object') return [json.data];
  if (json?.Data && typeof json.Data === 'object') return [json.Data];
  if (json && typeof json === 'object' && (json.networkID != null || json.NetworkID != null || json.dashboard != null)) {
    return [json];
  }
  return [];
}

function rowToModules(row) {
  const modules = emptyNetworkModules(false);
  if (!row || typeof row !== 'object') return { permissionId: 0, modules: emptyNetworkModules(true) };
  /* Jo field jawab me hai hi nahi (backend ne abhi column nahi banaya) wo
     "on" — warna naya toggle hamesha band dikhta. */
  NETWORK_MODULE_KEYS.forEach((k) => {
    modules[k] = bool(pick(row, [k]), true);
  });
  const permissionId = Number(pick(row, ['id', 'ID'], 0)) || 0;
  return { permissionId, modules };
}

function modulePayload(modules = {}) {
  return Object.fromEntries(NETWORK_MODULE_KEYS.map((k) => [k, bool(modules[k], false)]));
}

async function postJson(path, body) {
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${path}`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message)) || `Request failed (${res.status})`, res.status);
  }
  return json;
}

/**
 * Live network list + a starting permission map.
 * @returns {Promise<{ networks: Array, permMap: Object }>}
 */
export async function listNetworks() {
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.networkPermissions.networks()}`, {
      headers: authHeaders(),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && json.message) || `Failed to load networks (${res.status})`, res.status);
  }
  const rows = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
  const networks = rows.map(toNetwork).filter((n) => n.id != null);
  const permMap = Object.fromEntries(networks.map((n) => [n.id, defaultNetworkPerms(n)]));
  return { networks, permMap };
}

/**
 * "Active Network" card — network ka isActive server par badlo.
 *   POST .../api/AHM_NetworkUsers/update-isactive   { network_ID, isActive }
 */
export async function setNetworkActive(networkId, isActive) {
  const json = await postJson(EP.networkPermissions.updateIsActive(), {
    network_ID: Number(networkId) || 0,
    isActive: Boolean(isActive),
  });
  return json;
}

/** GET chain module flags for one network. Row na ho to sab on. */
export async function getNetworkPermissions(networkId) {
  let json;
  try {
    json = await postJson(EP.networkPermissions.manage(), {
      action: 'GET',
      id: 0,
      networkID: Number(networkId) || 0,
      ...emptyNetworkModules(false),
    });
  } catch (err) {
    /* Naye network ki abhi koi row nahi — API ise success:false +
       "No network permissions found…" se batati hai. Ye ghalti nahi,
       bas defaults dikhao (toast nahi). */
    if (err?.status === 404 || /no network permissions found/i.test(err?.message || '')) {
      return defaultNetworkPerms({ isActive: true });
    }
    throw err;
  }
  const rows = unwrapRows(json);
  const nid = Number(networkId);
  const row = rows.find((r) => Number(pick(r, ['networkID', 'NetworkID'], NaN)) === nid) || rows[0];
  if (!row) return defaultNetworkPerms({ isActive: true });
  return rowToModules(row);
}

/** SAVE chain module flags. Returns stored permission id. */
export async function saveNetworkPermissions(networkId, perms = {}) {
  const json = await postJson(EP.networkPermissions.manage(), {
    action: 'SAVE',
    id: Number(perms.permissionId) || 0,
    networkID: Number(networkId) || 0,
    ...modulePayload(perms.modules),
  });
  const row = unwrapRows(json)[0] || json?.data || json;
  const permissionId = Number(pick(row, ['id', 'ID'], perms.permissionId)) || Number(perms.permissionId) || 0;
  return { ...perms, permissionId, modules: { ...emptyNetworkModules(false), ...perms.modules } };
}
