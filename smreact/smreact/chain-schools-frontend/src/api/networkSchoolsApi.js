/* ═══════════════════════════════════════════════════════════════════
   NETWORK SCHOOLS — is network me shamil hone ki requests aur shamil ho
   chuke schools.

   Sab kuch aik endpoint se:
     POST {chain}/api/Network_Setup/network-schools/manage
       action: getbynetwork | update | delete
   Response me branch ki tafseel (branchName / branchPhone / branchAddress …)
   sath hi aati hai, is liye school ka naam lene ke liye ERP API ko alag call
   karne ki zaroorat nahi.

   Ye axios client se nahi jaata: wo `/api` par .NET backend ki taraf jaata hai
   aur apna Bearer token lagata hai, jabke ye endpoint alag base par hai.
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'

const MANAGE_URL = `${CHAIN_API_BASE}/api/Network_Setup/network-schools/manage`

/* Logged-in network ki id. ERP handoff `csp_user` me network id `id` par aati
   hai (dekhein main.jsx / LoginScreen ka handoff). */
export function currentNetworkId() {
  const u = getStoredUser()
  const id = u?.id ?? u?.networkID ?? u?.networkId
  return Number(id) || 0
}

async function manage(payload) {
  const res = await fetch(MANAGE_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || 'Request failed')
  }
  return json
}

/* API row → screen row. isAccepted/isRejected se status banta hai:
   accepted → Connected, rejected → Rejected, warna abhi Pending. */
const toSchool = (r) => ({
  id:          r.id,                 // network-school row ki id (accept/reject/delete isi se)
  branchId:    r.branchID,
  name:        r.branchName || `Branch #${r.branchID}`,
  code:        r.branchCode || '',
  phone:       r.branchPhone || '',
  email:       r.branchEmail1 || '',
  address:     r.branchAddress || '',
  logo:        r.branchLogo || '',
  /* Permissions screen ke liye: network ki taraf se di gayi ERP access. */
  networkPermission: !!r.networkPermission,
  isActive:      r.isActive !== false,
  branchIsActive: r.branchIsActive !== false,
  status:      r.isAccepted ? 'Connected' : (r.isRejected ? 'Rejected' : 'Pending'),
  requestedAt: r.requestedDateTime || null,
  decidedAt:   r.acceptedOrRejectedDateTime || null,
})

/* getbynetwork ko isAccepted lazmi chahiye: true = accepted list,
   false = baqi (pending + rejected). */
async function listByNetwork(accepted, networkId) {
  if (!networkId) return []
  const json = await manage({ action: 'getbynetwork', networkID: networkId, isAccepted: !!accepted })
  return (Array.isArray(json?.data) ? json.data : []).map(toSchool)
}

/**
 * Wo schools jo network me shamil ho chuke hain — sirf accepted rows.
 *
 * `isAccepted: true` bhejne ke bawajood server kabhi pending/rejected rows
 * bhi laut deta hai, aur wo Academics ke Master/Sub Release modal me ghair-
 * juri schools dikha deti hain. Is liye jawab ko yahan dobara chhanta jaata
 * hai — Connected ke ilawa kuch is list me na aaye.
 */
export async function fetchConnectedSchools(networkId = currentNetworkId()) {
  const rows = await listByNetwork(true, networkId)
  return rows.filter((r) => r.status === 'Connected')
}

/** Abhi faisla na hui requests, aur reject ki hui requests — aik hi call se. */
export async function fetchSchoolRequests(networkId = currentNetworkId()) {
  const rows = await listByNetwork(false, networkId)
  return {
    pending:  rows.filter((r) => r.status === 'Pending'),
    rejected: rows.filter((r) => r.status === 'Rejected'),
  }
}

/**
 * Request ka faisla — dono aik hi `update` call hain, farq sirf isAccepted ka:
 *   accepted = true  → school network me shamil (Connected list me chala jaata hai)
 *   accepted = false → request reject
 */
/**
 * ERP access on/off — wahi `update` call, sirf networkPermission badalta hai.
 * `row` me network-school row ki id (rowId) aur branchID chahiye; school pehle
 * se accepted hai is liye isAccepted true rehta hai.
 */
export function setSchoolErpAccess(row, allowed, networkId = currentNetworkId()) {
  return manage({
    action:            'update',
    id:                row.rowId ?? row.id,
    networkID:         networkId,
    branchID:          row.branchId ?? row.id,
    networkPermission: !!allowed,
    isActive:          row.isActive !== false,
    isAccepted:        true,
  })
}

export function decideSchoolRequest(row, accepted, networkId = currentNetworkId()) {
  return manage({
    action:            'update',
    id:                row.id,
    networkID:         networkId,
    branchID:          row.branchId,
    networkPermission: true,
    isActive:          true,
    isAccepted:        !!accepted,
  })
}

/**
 * School ko network se nikal dena — `update` nahi, poora row `delete`.
 * (School dobara request bhej sakta hai; ye sirf mojooda taluq khatam
 * karta hai.) Row us se juri hui payment records ki wajah se bandhi ho to
 * API foreign-key ka paighaam wapas karti hai — wahi user tak jaata hai.
 */
export function removeSchoolFromNetwork(row, networkId = currentNetworkId()) {
  return manage({
    action:    'delete',
    id:        row.rowId ?? row.id,
    networkID: networkId,
    branchID:  row.branchId ?? row.id,
  })
}
