/* ═══════════════════════════════════════════════════════════════════
   NETWORK MENU PERMISSIONS — per-staff module→screen→action matrix,
   Chain Management API par. User Permissions → "User Permission" tab
   ka edit-matrix isi se load/save hota hai.

     GET  /api/hr/get-network-menu-permissions/{networkId}?employeeId=
            → is employee ke saved rows [{ menuName, subMenuName,
              action, isAccessable }]
     POST /api/hr/save-network-menu-permissions
            { networkID, employeeID, permissions:[ … ] }

   Bilkul ERP ke /get|save-user-menu-permissions jaisa — sirf branchID
   ki jagah networkID. Field names swagger ke sath 1:1 (isAccessable).

   Auth header nahi lagta (baqi chain /api/hr calls jaisa, dekhein hrApi.js).
   Row na ho → khali array (naya user → sab unchecked).
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${CHAIN_API_BASE}/api/hr`

/* Jawab kis shakal me bhi aaye — { data:{ permissions } }, { data:[ rows ] },
   { data:[ { employeeID, permissions } ] } ya seedha array — permission rows
   nikaal lo. employeeId do to usi ki row chuno. */
function extractPermissions(json, employeeId) {
  const data = json?.data ?? json
  if (Array.isArray(data)) {
    if (data.length && data[0] && typeof data[0] === 'object' && 'permissions' in data[0]) {
      const entry = employeeId != null
        ? data.find((d) => String(d.employeeID) === String(employeeId))
        : data[0]
      return entry?.permissions || []
    }
    return data
  }
  if (data && Array.isArray(data.permissions)) return data.permissions
  return []
}

/**
 * Is employee ki saved menu-permissions → [{ menuName, subMenuName, action, isAccessable }].
 * Kuch saved na ho → []. Call nakaam ho → throw (caller fail karke local par gir sakta hai).
 */
export async function getNetworkMenuPermissions(employeeId, networkId = currentNetworkId()) {
  if (!networkId) return []
  const qs = employeeId != null ? `?employeeId=${encodeURIComponent(employeeId)}` : ''
  const res = await fetch(`${BASE}/get-network-menu-permissions/${networkId}${qs}`, {
    headers: { Accept: '*/*' },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || `Could not load permissions (${res.status})`)
  }
  return extractPermissions(json, employeeId)
}

/**
 * Ek employee ki menu-permissions save karo.
 *   { employeeId, permissions:[{ menuName, subMenuName, action, isAccessable }] }
 * permissions me HAR applicable row bhejo (checked → true, unchecked → false),
 * taake unchecking bhi persist ho.
 */
export async function saveNetworkMenuPermissions({ employeeId, permissions, networkId = currentNetworkId() }) {
  const res = await fetch(`${BASE}/save-network-menu-permissions`, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      networkID: Number(networkId) || 0,
      employeeID: Number(employeeId) || 0,
      permissions: permissions || [],
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || `Could not save permissions (${res.status})`)
  }
  return json
}

/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR GATING — logged-in user ke liye kaunse modules dikhein.

   Login ke baad: Network Head Office (owner) → poora access (koi API nahi,
   uska employeeID hota hi nahi). Baqi har user (staff) → ye API chal kar
   uske granted modules laati hai; jin menuName ki kisi bhi action ki
   isAccessable:true ho WAHI module sidebar me, baqi sab hidden —
   bilkul ERP ki tarah.
   ═══════════════════════════════════════════════════════════════════ */

/* nav.js item key → API `menuName`. Match case-insensitive hoti hai. */
export const NAV_MENU_NAME = {
  dashboard:       'Dashboard',
  academics:       'Academics',
  permissions:     'School Permissions',
  progress:        'School Progress',
  payments:        'School Payments',
  sops:            'Operational SOPs',
  hr:              'Human Resource',
  accounts:        'Accounts',
  attendance:      'Attendance',
  inventory:       'Inventory',
  trainings:       'Trainings',
  notifications:   'Notifications',
  userpermissions: 'User Permissions',
  settings:        'Settings',
}

/* Logged-in user ka employeeID (handoff se csp_user me aata hai). Head Office
   ka 0 hota hai. */
export function currentEmployeeId() {
  const u = getStoredUser()
  return Number(u?.employeeID ?? u?.employee_ID ?? u?.employeeId) || 0
}

/* Head Office (Network Head Office) → per-user permission NAHI lagti. Pehchan:
   role "Network Head Office", ya koi employeeID hi na ho (owner). */
export function isHeadOffice(u = getStoredUser()) {
  if (String(u?.role || '').trim().toLowerCase() === 'network head office') return true
  return currentEmployeeId() === 0
}

const ACCESS_CACHE_KEY = 'csp_user_module_access'

/* Session cache — refresh par sidebar foran sahi dikhe (flicker na ho). */
export function cachedUserModuleAccess() {
  if (isHeadOffice()) return { fullAccess: true }
  try {
    const c = JSON.parse(sessionStorage.getItem(ACCESS_CACHE_KEY) || 'null')
    if (c && c.employeeId === currentEmployeeId()) return { modules: new Set(c.modules) }
  } catch { /* ignore */ }
  return null
}

function rememberAccess(employeeId, modulesSet) {
  try { sessionStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify({ employeeId, modules: [...modulesSet] })) }
  catch { /* private mode — cache optional */ }
}

/**
 * Logged-in user ke accessible modules.
 *   Head Office → { fullAccess: true }  (sab dikhega)
 *   Staff       → { modules: Set<menuName-lowercased> }  (sirf granted)
 * API nakaam ho ya employee/network id na ho → { fullAccess: true } (fail-open,
 * taake API band hone par portal lock na ho).
 */
export async function fetchUserModuleAccess() {
  const u = getStoredUser()
  if (isHeadOffice(u)) return { fullAccess: true }
  const employeeId = currentEmployeeId()
  const networkId = currentNetworkId()
  if (!employeeId || !networkId) return { fullAccess: true }
  try {
    const rows = await getNetworkMenuPermissions(employeeId, networkId)
    const modules = new Set()
    rows.forEach((p) => { if (p?.isAccessable) modules.add(String(p.menuName || '').trim().toLowerCase()) })
    rememberAccess(employeeId, modules)
    return { modules }
  } catch (err) {
    console.error('Could not load user module access:', err)
    return { fullAccess: true }
  }
}

/* Ye nav item dikhana hai? access null (abhi load nahi hua) ya fullAccess →
   dikhao; warna sirf wo jiska menuName granted set me ho. */
export function isUserNavItemAllowed(key, access) {
  if (!access || access.fullAccess) return true
  const menuName = NAV_MENU_NAME[key]
  if (!menuName) return true
  return access.modules.has(menuName.trim().toLowerCase())
}
