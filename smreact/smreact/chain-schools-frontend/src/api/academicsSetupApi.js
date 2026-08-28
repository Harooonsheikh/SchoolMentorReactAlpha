/* ═══════════════════════════════════════════════════════════════════
   NETWORK ACADEMIC STRUCTURE — chain ki apni classes (grades) aur unke
   subjects, sab networkID ki base par.

   ERP ka LaunchSetup hi ye tables rakhta hai; farq sirf itna hai ke school
   ki rows `branchID` se bandhi hoti hain aur chain (head office) ki rows
   `networkID` se. Is liye yahan har save me branchID: 0 aur networkID =
   logged-in network jata hai:

     POST   /api/LaunchSetup/save-grade
     GET    /api/LaunchSetup/get-grades-by-network/{networkId}
     DELETE /api/LaunchSetup/delete-grade/{id}
     POST   /api/LaunchSetup/save-subject
     GET    /api/LaunchSetup/get-subjects-by-network-grade/{networkId}/{gradeId}
     DELETE /api/LaunchSetup/delete-subject/{id}

   Ye axios client (src/api/client.js) se nahi jata: wo apna Bearer token
   lagata hai aur 401 par logout kar deta hai, jabke LaunchSetup khula hua
   hai — bilkul waise hi jaise schoolPaymentsApi ka fee-heads wala call.
   ═══════════════════════════════════════════════════════════════════ */

import { ERP_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${ERP_API_BASE}/api/LaunchSetup`

export { currentNetworkId }

/* createdBy / modifiedBy — ERP handoff me network user ki id `id` par aati
   hai (dekhein main.jsx), wahi network id bhi hai. */
const currentUserId = () => {
  const u = getStoredUser()
  return Number(u?.id ?? u?.userID ?? u?.userId) || 0
}

/* LaunchSetup hamesha { success, message, data } deta hai — success:false
   bhi 200 ke saath aa sakta hai, is liye dono check hote hain. */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body
      ? { Accept: '*/*', 'Content-Type': 'application/json' }
      : { Accept: '*/*' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || 'Request failed')
  }
  return json
}

const rows = (json) => (Array.isArray(json?.data) ? json.data : [])

/* ─────────────────────────── Classes (grades) ─────────────────────────── */

/** Is network ki classes. GET response me networkID null aata hai (SP wo
    column wapas nahi karta) — us par bharosa na karein, filter server par
    hi ho chuka hai. */
export async function fetchNetworkClasses(networkId = currentNetworkId()) {
  if (!networkId) return []
  const json = await call(`/get-grades-by-network/${networkId}`)
  return rows(json)
    .map((g) => ({
      id: Number(g.id) || 0,
      name: String(g.name ?? '').trim() || `Class #${g.id}`,
      orderBy: Number(g.orderBy) || 0,
    }))
    .filter((c) => c.id)
    .sort((a, b) => (a.orderBy - b.orderBy) || (a.id - b.id))
}

/** id: 0 = nayi class, warna wahi row update hoti hai.
    Response me `data` nayi gradeID hoti hai. */
export async function saveNetworkClass({ id = 0, name, orderBy = 0 }, networkId = currentNetworkId()) {
  const now = new Date().toISOString()
  const uid = currentUserId()
  const json = await call('/save-grade', {
    method: 'POST',
    body: {
      id: Number(id) || 0,
      name: String(name ?? '').trim(),
      branchID: 0,                      // network-level class — kisi ek school ki nahi
      createdAt: now,
      createdBy: uid,
      modifiedAt: now,
      modifiedBy: uid,
      isActive: true,
      networkID: Number(networkId) || 0,
      orderBy: Number(orderBy) || 0,
      sections: [],
    },
  })
  return Number(json?.data) || Number(id) || 0
}

export const deleteNetworkClass = (id) => call(`/delete-grade/${id}`, { method: 'DELETE' })

/* ─────────────────────────── Subjects ─────────────────────────── */

/** Aik class ke subjects (isi network ke). */
export async function fetchClassSubjects(classId, networkId = currentNetworkId()) {
  if (!networkId || !classId) return []
  const json = await call(`/get-subjects-by-network-grade/${networkId}/${classId}`)
  return rows(json)
    .map((s) => ({
      id: Number(s.subjectID) || 0,
      name: String(s.subjectName ?? '').trim(),
      classId: Number(s.gradeID) || Number(classId),
    }))
    .filter((s) => s.id && s.name)
}

/** id: 0 = naya subject us class ke neeche, warna usi row ka naam badalta hai. */
export async function saveNetworkSubject({ id = 0, name, classId }, networkId = currentNetworkId()) {
  const now = new Date().toISOString()
  const uid = currentUserId()
  const json = await call('/save-subject', {
    method: 'POST',
    body: {
      subjectID: Number(id) || 0,
      subjectName: String(name ?? '').trim(),
      gradeID: Number(classId) || 0,
      sectionID: 0,                     // network level par sections nahi hote
      branchID: 0,
      book_Title: '',
      createdAt: now,
      createdBy: uid,
      modifiedAt: now,
      modifiedBy: uid,
      isActive: true,
      networkID: Number(networkId) || 0,
    },
  })
  return Number(json?.data) || Number(id) || 0
}

export const deleteNetworkSubject = (id) => call(`/delete-subject/${id}`, { method: 'DELETE' })

/* ─────────────────────────── Poora dhancha aik saath ─────────────────────────── */

/** Classes + har class ke subject rows. Subjects ka koi network-level
    "master" endpoint nahi hai — wo hamesha class ke neeche hi rehte hain,
    is liye har class ke liye aik call jati hai (parallel). */
export async function fetchNetworkAcademics(networkId = currentNetworkId()) {
  const classes = await fetchNetworkClasses(networkId)
  const lists = await Promise.all(
    classes.map((c) => fetchClassSubjects(c.id, networkId).catch(() => [])),
  )
  return { classes, subjectRows: lists.flat() }
}
