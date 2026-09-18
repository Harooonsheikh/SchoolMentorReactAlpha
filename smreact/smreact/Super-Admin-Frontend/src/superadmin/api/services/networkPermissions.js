/* ════════════════════════════════════════════════════════════════════
   Network Permissions service — the live network list behind the
   "Network Permissions" screen.

   Backend: SchoolMentorSuperAdminAPI
     GET  .../api/AHM_NetworkUsers
       → { success, message, count, data: [ { id, ownerName, schoolNetwork,
             contactNumber, createdDate, isActive, isAdmin, address, … } ] }
     POST .../api/AHM_NetworkUsers/update-isactive   { network_ID, isActive }

   Network row → table row:
     id            → id
     schoolNetwork → name
     ownerName     → owner
     contactNumber → contact
     isActive      → perms.activeNetwork

   Permissions ka save route abhi nahi hai (dekhein endpoints.js ka note) —
   screen draft ko apni state me rakhti hai.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken } from '../config';
import EP from '../endpoints';
import { ALL_MODULE_KEYS } from '../../permissionsData';

const initials = (name) => String(name || '')
  .replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2)
  .toUpperCase() || 'NW';

/** Naye network ki shuruaati permissions — sab module on, mobile app off. */
export function defaultNetworkPerms(network) {
  return {
    activeNetwork: network ? Boolean(network.isActive) : true,
    chainPortal: network ? Boolean(network.isActive) : true,
    chatMode: 'off',
    mentorAi: { enabled: false, parentsAccess: false },
    etube: { enabled: false, viewing: false, uploading: false },
    mobileAppId: 0,
    modules: Object.fromEntries(ALL_MODULE_KEYS.map((k) => [k, true])),
  };
}

/** One API row → the network shape NetworkPermissions.jsx renders. */
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

/**
 * Live network list + a starting permission map.
 * @returns {Promise<{ networks: Array, permMap: Object }>}
 */
export async function listNetworks() {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.networkPermissions.networks()}`, {
      headers: { accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
 * "Chain Portal Access" card — network ka isActive server par badlo.
 *   POST .../api/AHM_NetworkUsers/update-isactive   { network_ID, isActive }
 */
export async function setNetworkActive(networkId, isActive) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.networkPermissions.updateIsActive()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ network_ID: Number(networkId) || 0, isActive: Boolean(isActive) }),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && json.message) || `Could not update network access (${res.status})`, res.status);
  }
  return json;
}
