/* ═══════════════════════════════════════════════════════════════════
   NETWORK ACTIVITY CALENDAR — chain (head office) ki apni activities,
   sab networkID ki base par.

   Wahi ERP wali tables/API hain (dekhein src/erp/components/Academics.js);
   farq sirf itna hai ke school ki rows `branchID` se bandhi hoti hain aur
   chain ki rows `networkID` se. Is liye yahan har call me:

       branchID: 0      →  ye row kisi ek school ki nahi
       sessionYearID: 0 →  network level par session year nahi hota
       networkID        →  logged-in network

     POST /api/activitycalendarcrud                (action: insert|update|delete)
     GET  /api/getactivitycalendarbynetwork?NetworkID&SessionYearID&pageNo
     GET  /api/getactivitycalendarbymonthnetwork?NetworkID&month&SessionYearID&pageNo
     GET  /api/getactivitycalendarbymonthandyearnetwork?NetworkID&month&year&SessionYearID&pageNo

   Ye axios client (src/api/client.js) se nahi jata: wo apna base rakhta hai
   aur 401 par logout kar deta hai — bilkul waise hi jaise academicsSetupApi
   aur schoolPaymentsApi ke calls. Token phir bhi lagta hai (LaunchSetup ke
   bar-aks ye raste khule nahi, bina bearer ke 401 dete hain).
   ═══════════════════════════════════════════════════════════════════ */

import { ERP_API_BASE } from '@/config/env'
import { getToken } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${ERP_API_BASE}/api`

export { currentNetworkId }

/* Network level par ye dono hamesha 0 jate hain — upar wali sharh dekhein. */
export const NETWORK_BRANCH_ID = 0
export const NETWORK_SESSION_YEAR_ID = 0

const authHeaders = (extra = {}) => ({
  Accept: '*/*',
  Authorization: `bearer ${getToken() || ''}`,
  ...extra,
})

/* API hamesha { success, message, data } deti hai — success:false 200 ke
   saath bhi aa sakta hai, is liye dono check hote hain. */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? authHeaders({ 'Content-Type': 'application/json' }) : authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    if (res.status === 401) throw new Error('Session expired — sign in again from the ERP.')
    throw new Error(json?.message || json?.title || 'Request failed')
  }
  return json
}

const rows = (json) => (Array.isArray(json?.data) ? json.data : [])

/* ─────────────────────────── Shape badalna ─────────────────────────── */

/* Screen har jagah date-only ('2026-05-14') se kaam karti hai, jabke API
   poora ISO wapas karti hai. Pehle 10 characters kaat lena timezone se
   mehfooz hai — `new Date(...)` local time me shift kar sakta hai. */
const toDateOnly = (v) => {
  if (!v) return ''
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  if (m) return m[1]
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/* Date-only wapas ISO me — UTC midnight, taake wapas parhte waqt wahi din
   mile jo user ne chuna tha. */
const toIso = (dateOnly) => (dateOnly ? `${dateOnly}T00:00:00.000Z` : '')

const todayOnly = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** ERP jaisa hi hisaab: guzar gayi → completed, chal rahi → ongoing,
    warna upcoming. Status backend me store nahi hota, dates se banta hai. */
export const activityStatus = (start, end) => {
  const today = todayOnly()
  const s = start || ''
  const e = end || s
  if (e && e < today) return 'completed'
  if (s && s <= today && (!e || e >= today)) return 'ongoing'
  return 'upcoming'
}

/** API row → wahi shape jo Activity Calendar screen samajhti hai. */
export function mapActivity(r) {
  const start = toDateOnly(r.startAt ?? r.StartAt ?? r.startDate ?? r.start)
  const end = toDateOnly(r.endAt ?? r.EndAt ?? r.endDate ?? r.end) || start
  return {
    id: Number(r.id ?? r.ID ?? r.Id ?? r.activityID ?? r.activityId ?? r.activityCalendarID ?? 0) || 0,
    name: String(r.name ?? r.activityName ?? r.title ?? '').trim() || 'Activity',
    start,
    end,
    status: activityStatus(start, end),
    purpose: String(r.activityPurpose ?? '').trim(),
    development: String(r.activityDevelopment ?? '').trim(),
    /* Backend ki spelling `resourseMaterial` hai (typo wahin se hai) — screen
       par ye field `resource` kehlati hai. */
    resource: String(r.resourseMaterial ?? '').trim(),
  }
}

const sortByStart = (list) => list.slice().sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : x.id - y.id))

/* ─────────────────────────── Parhna ─────────────────────────── */

/** Poore network ki activities. */
export async function fetchNetworkActivities(networkId = currentNetworkId()) {
  if (!networkId) return []
  const json = await call(`/getactivitycalendarbynetwork?NetworkID=${networkId}&SessionYearID=${NETWORK_SESSION_YEAR_ID}&pageNo=1`)
  return sortByStart(rows(json).map(mapActivity).filter((x) => x.id))
}

/** Sirf aik mahine ki activities — calendar grid ke liye.
    `month` 1–12, `year` poora saal (2026). */
export async function fetchNetworkActivitiesByMonth(month, year, networkId = currentNetworkId()) {
  if (!networkId) return []
  const json = await call(`/getactivitycalendarbymonthandyearnetwork?NetworkID=${networkId}&month=${month}&year=${year}&SessionYearID=${NETWORK_SESSION_YEAR_ID}&pageNo=1`)
  return sortByStart(rows(json).map(mapActivity).filter((x) => x.id))
}

/* ─────────────────────────── Likhna ─────────────────────────── */

/* Update/delete ke liye asli backend id chahiye. Backend ka `id` Int32 hai —
   koi local/fake id (jaise Date.now() ≈ 1.7e12) us me fit nahi hota aur
   "One or more validation errors occurred" wapas aata hai. */
const realId = (id) => {
  const n = Number(id)
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0
}

const crudBody = (act, action, networkId) => ({
  id: action === 'insert' ? 0 : realId(act.id),
  branchID: NETWORK_BRANCH_ID,
  networkID: Number(networkId) || 0,
  sessionYearID: NETWORK_SESSION_YEAR_ID,
  name: String(act.name ?? '').trim(),
  activityPurpose: act.purpose || '',
  activityDevelopment: act.development || '',
  resourseMaterial: act.resource || '',
  startAt: toIso(act.start),
  endAt: toIso(act.end || act.start),
  createdDate: new Date().toISOString(),
  action,
})

/**
 * Nayi activity ya mojooda ki tarmeem. `act.id` khali/0 = insert.
 * Wapas nayi (ya wahi) id aati hai.
 */
export async function saveNetworkActivity(act, networkId = currentNetworkId()) {
  const id = realId(act.id)
  if (act.id && !id) throw new Error('Please refresh the activity list, then edit again.')
  const json = await call('/activitycalendarcrud', {
    method: 'POST',
    body: crudBody(act, id ? 'update' : 'insert', networkId),
  })
  return realId(json?.data?.id ?? json?.data ?? json?.id) || id
}

/** Activity hatana — wahi crud call, sirf action: 'delete'. */
export async function deleteNetworkActivity(act, networkId = currentNetworkId()) {
  if (!realId(act.id)) throw new Error('Please refresh the activity list, then delete again.')
  await call('/activitycalendarcrud', { method: 'POST', body: crudBody(act, 'delete', networkId) })
}
