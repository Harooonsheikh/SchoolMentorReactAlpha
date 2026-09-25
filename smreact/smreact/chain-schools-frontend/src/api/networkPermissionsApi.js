import { SUPERADMIN_API_BASE } from '@/config/env'
import { currentNetworkId } from './networkSchoolsApi'

/* ═══════════════════════════════════════════════════════════════════
   NETWORK PERMISSIONS — Super Admin is network ke liye kaunse chain
   modules on/off karta hai (Super Admin → Network Permissions → Manage).

     POST {superadmin}/api/SchoolPermissions/network-permissions
       { action: 'get', id: 0, networkID, …module flags }
       → { success, data: { id, networkID, dashboard, academics, … } }

   Field names swagger ke typos ke sath 1:1 hain (schoolPermisison,
   schoolPAyments, operationlSOP) — rename NAHI kiye.

   Row hi na ho to API { success:false, "No network permissions found…" }
   bhejti hai — matlab Super Admin ne abhi kuch band nahi kiya, sab on.
   ═══════════════════════════════════════════════════════════════════ */

const URL = `${SUPERADMIN_API_BASE}/api/SchoolPermissions/network-permissions`

/* Sidebar item key (config/nav.js) → API ka field. Jo item yahan nahi wo
   hamesha dikhta hai. notifications/settings ke field API me abhi nahi —
   jawab me na hon to "on" (neeche FIELDS loop), backend jode to khud lagenge. */
export const NAV_PERMISSION_FIELD = {
  dashboard:       'dashboard',
  academics:       'academics',
  permissions:     'schoolPermisison',
  progress:        'schoolProgress',
  payments:        'schoolPAyments',
  sops:            'operationlSOP',
  hr:              'hr',
  accounts:        'accounts',
  attendance:      'attendance',
  inventory:       'inventory',
  trainings:       'training',
  userpermissions: 'userPermission',
  notifications:   'notifications',
  settings:        'settings',
}

const FIELDS = [...new Set(Object.values(NAV_PERMISSION_FIELD))]

const allOn = () => Object.fromEntries(FIELDS.map((f) => [f, true]))

/* Session bhar sambhal lete hain — refresh par sidebar foran sahi dikhe.
   Network id key me, taake dusre network ka basi jawab na lage. */
const CACHE_KEY = 'csp_network_perms'

export function cachedNetworkPermissions(networkId = currentNetworkId()) {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
    return c && c.networkId === networkId ? c.flags : null
  } catch { return null }
}

function remember(networkId, flags) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ networkId, flags })) }
  catch { /* private mode — cache optional hai */ }
  return flags
}

/**
 * Is network ke module flags — { dashboard: true, schoolPAyments: false, … }.
 * Row na ho → sab on. Call nakaam ho → throw (caller fail-open rakhta hai).
 */
export async function fetchNetworkPermissions(networkId = currentNetworkId()) {
  if (!networkId) return allOn()
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get', id: 0, networkID: networkId, ...allOn() }),
  })
  const json = await res.json().catch(() => null)
  if (json?.success === false && /no network permissions found/i.test(json.message || '')) {
    return remember(networkId, allOn())
  }
  if (!res.ok || !json || json.success === false) {
    throw new Error(json?.message || `Could not load network permissions (${res.status})`)
  }
  const row = Array.isArray(json.data) ? json.data[0] : json.data
  const flags = allOn()
  FIELDS.forEach((f) => { if (row && row[f] != null) flags[f] = row[f] === true })
  return remember(networkId, flags)
}

/** Sidebar item dikhana hai? Flags abhi na aaye hon (null) to gated item chhupa. */
export function isNavItemAllowed(key, flags) {
  const field = NAV_PERMISSION_FIELD[key]
  if (!field) return true
  if (!flags) return false
  return flags[field] !== false
}
