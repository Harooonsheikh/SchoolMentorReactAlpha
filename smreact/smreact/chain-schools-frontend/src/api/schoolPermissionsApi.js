
import { SUPERADMIN_API_BASE, ERP_API_BASE } from '@/config/env'

const BASE = `${SUPERADMIN_API_BASE}/api/SchoolPermissions`

/* UI ki module key → API ka field. Tarteeb screen jaisi hai (17 modules). */
export const MODULE_FIELDS = {
  academics:        'academics',
  examination:      'examination',
  papergenerator:   'paperGenerator',
  attendance:       'attendance',
  timetable:        'timeTable',
  fee:              'fee',
  accounts:         'accounts',
  inventory:        'inventory',
  admissioncrm:     'admissionCRM',
  students:         'students',
  hr:               'humanResource',
  staffappraisals:  'staffAppraisals',
  schoolsops:       'schoolSOPs',
  teachertrainings: 'teacherTrainings',
  auditlogs:        'auditLogs',
  settings:         'settings',
  userpermissions:  'userPermissions',
}

const UI_KEYS = Object.keys(MODULE_FIELDS)

/* ── Cache (sessionStorage) ──
   Super-Admin API ki har call 2–7 second leti hai, aur ye screen par 2 calls
   per school hain. Is liye jo aik dafa aa jaaye wo tab tak sambhal kar rakhte
   hain jab tak tab khuli hai: dobara screen par aate hi purana data foran
   dikh jaata hai (spinner nahi), aur peeche background me taza ho jaata hai.
   localStorage nahi — logout/dusre network par basi data nahi rehna chahiye. */

const CACHE_KEY = 'sp-cache-v1'

function readCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY)) || { erp: {}, mods: {} } }
  catch { return { erp: {}, mods: {} } }
}

function writeCache(bucket, id, value) {
  try {
    const c = readCache()
    c[bucket] = { ...c[bucket], [id]: value }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch { /* storage full / private mode — cache optional hai */ }
}

/** Pichli dafa ka data (agar hai) — screen isse foran bhar leti hai. */
export function cachedPermissions() {
  const c = readCache()
  return { erp: c.erp || {}, mods: c.mods || {} }
}

/** Save ke baad cache bhi wahi dikhaye jo abhi bheja gaya. */
export function cachePermissions(branchID, { modules, erpAccess } = {}) {
  if (modules) writeCache('mods', branchID, modules)
  if (erpAccess !== undefined) writeCache('erp', branchID, !!erpAccess)
}

/* ── Aik hi call do dafa nahi ──
   Ye screen React StrictMode me effect do baar chalati hai, aur Manage
   khulte waqt bhi wahi id dobara maangi ja sakti hai. Jab tak aik request
   chal rahi hai, usi id ki dusri request nayi fetch nahi karti — wahi
   promise share ho jaata hai (Network tab me duplicate rows khatam). */
const inFlight = new Map()

function once(key, fn) {
  const running = inFlight.get(key)
  if (running) return running
  const p = fn().finally(() => inFlight.delete(key))
  inFlight.set(key, p)
  return p
}

/** Sab modules off — jab branch ki koi row hi na ho. */
export function emptyModules() {
  return Object.fromEntries(UI_KEYS.map((k) => [k, false]))
}

/* API row → UI modules object. */
function toModules(row) {
  return Object.fromEntries(UI_KEYS.map((k) => [k, !!row?.[MODULE_FIELDS[k]]]))
}

/**
 * Aik branch ki module permissions.
 * Row na ho (ya call nakaam ho) to sab off — screen khali nahi tootti.
 */
export function fetchModulePermissions(branchID) {
  if (!branchID) return Promise.resolve(emptyModules())
  return once(`mods:${branchID}`, () => fetchModulePermissionsNow(branchID))
}

async function fetchModulePermissionsNow(branchID) {
  const res = await fetch(`${BASE}/module-permission/${branchID}?type=chain`, {
    headers: { Accept: '*/*' },
  })
  /* 404 / plain-text "No module permission found …" = abhi kuch set nahi hua. */
  if (!res.ok) return emptyModules()
  const text = await res.text()
  try {
    return toModules(JSON.parse(text))
  } catch {
    return emptyModules()
  }
}

/**
 * Kai branches ki module permissions — list ke counts ke liye.
 * ERP access ki tarah ye bhi table render hone ke BAAD background me chalti
 * hai aur har jawab alag se `onResult(branchID, modules)` par deti hai.
 */
export function fetchModulePermissionsEach(branchIDs, onResult) {
  return mapLimit(branchIDs, 12, (id) => fetchModulePermissions(id).catch(() => emptyModules()), (id, mods) => {
    writeCache('mods', id, mods)
    onResult(id, mods)
  })
}

/**
 * Kai ids par aik kaam — aik waqt me sirf `limit` calls chalti hain, taake
 * bara network (100+ schools) browser ki request queue block na kare.
 * Har result milte hi `onResult(id, value)` chal jaata hai — screen sab ka
 * intezaar nahi karti, jaise jaise jawab aate hain waise bharti jaati hai.
 */
async function mapLimit(ids, limit, worker, onResult) {
  const list = ids || []
  let next = 0
  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= list.length) return
      const id = list[i]
      const value = await worker(id)
      onResult(id, value)
    }
  })
  await Promise.all(runners)
}

/* ── ERP Access (Launch Setup) ──
   Chain portal ka "ERP Access" toggle isi par chalta hai:
     GET {sa}/api/SchoolPermissions/launchsetup?branchId={id}   → data.launchSetup
     PUT {sa}/api/SchoolPermissions/toggle-launch-setup/{id}?launchSetup=1|0
   1 = access on, 0 = off. */

/** Aik branch ka ERP access (launch setup) — na milay to off. */
export function fetchLaunchSetup(branchID) {
  if (!branchID) return Promise.resolve(false)
  return once(`erp:${branchID}`, () => fetchLaunchSetupNow(branchID))
}

async function fetchLaunchSetupNow(branchID) {
  const res = await fetch(`${BASE}/launchsetup?branchId=${branchID}`, { headers: { Accept: '*/*' } })
  if (!res.ok) return false
  const json = await res.json().catch(() => null)
  return !!json?.data?.launchSetup
}

/**
 * Kai branches ka ERP access — list ke badges/stats/filter ke liye.
 *
 * Ye call table render hone ke BAAD background me chalti hai, is liye har
 * jawab alag se `onResult(branchID, on)` par diya jaata hai: badge us school
 * ka jawab aate hi bhar jaata hai, poori list ka intezaar nahi hota.
 */
export function fetchLaunchSetupEach(branchIDs, onResult) {
  return mapLimit(branchIDs, 12, (id) => fetchLaunchSetup(id).catch(() => false), (id, on) => {
    writeCache('erp', id, !!on)
    onResult(id, on)
  })
}

/**
 * ERP access on/off — 1 = on, 0 = off.
 *
 * `body: ''` zaroori hai: IIS body-less PUT ko 411 (Length Required) de deta
 * hai. Khali string se Content-Length: 0 lag jaata hai (ye header khud set
 * karna fetch me mana hai).
 */
export async function setLaunchSetup(branchID, on) {
  const res = await fetch(`${BASE}/toggle-launch-setup/${branchID}?launchSetup=${on ? 1 : 0}`, {
    method: 'PUT',
    headers: { Accept: '*/*' },
    body: '',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || 'Could not update ERP access')
  }
  return json
}

/** Save — poora set bhejta hai (API insert/update dono isi se karta hai). */
export async function saveModulePermissions(branchID, modules) {
  const body = { branchID: Number(branchID), type: 'chain', createdBy: 0, modifiedBy: 0 }
  UI_KEYS.forEach((k) => { body[MODULE_FIELDS[k]] = !!modules[k] })

  const res = await fetch(`${BASE}/save-modulePermission`, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || 'Could not save module permissions')
  }
  return json
}

/* ═══════════════════ MOBILE APP PERMISSION (ERP swagger) ═══════════════════
   POST /manage-mobileapp-permission
     action: SAVE | GET | DELETE
     chatType = Chat card ki selected type (off / staffOnly / …)
     booleans = toggle on → true, off → false
   JWT mat bhejo. Chain :3002 CORS-block karta hai — same-origin relative path. */

const MOBILE_PERM_URL = `${ERP_API_BASE}/manage-mobileapp-permission`

function pick(obj, names, fallback) {
  if (!obj) return fallback
  const map = new Map(Object.keys(obj).map((k) => [String(k).toLowerCase(), k]))
  for (const n of names) {
    const key = map.get(String(n).toLowerCase())
    if (key != null && obj[key] != null && obj[key] !== '') return obj[key]
  }
  return fallback
}

function boolFlag(v, fallback = false) {
  if (v == null || v === '') return fallback
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['true', '1', 'y', 'yes', 'active'].includes(s)) return true
  if (['false', '0', 'n', 'no', 'inactive'].includes(s)) return false
  return fallback
}

export function emptyMobileAppPerms() {
  return {
    mobileAppId: 0,
    chatMode: 'off',
    mentorAi: { enabled: false, parentsAccess: false },
    etube: { enabled: false, viewing: false, uploading: false },
  }
}

export function rowToMobileAppPerms(row) {
  if (!row || typeof row !== 'object') return emptyMobileAppPerms()
  const chatType = String(pick(row, ['chatType', 'ChatType'], 'off') || 'off')
  return {
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
  }
}

async function postMobileAppPermission(body) {
  const res = await fetch(MOBILE_PERM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || 'Could not save mobile app permissions')
  }
  return json
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
  })
  const rows = Array.isArray(json?.data) ? json.data
    : Array.isArray(json?.Data) ? json.Data
      : (json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? [json.data] : [])
  return rows[0] ? rowToMobileAppPerms(rows[0]) : emptyMobileAppPerms()
}

export async function saveMobileAppPermission(branchId, perms = {}) {
  const mentorOn = Boolean(perms.mentorAi?.enabled)
  const etubeOn = Boolean(perms.etube?.enabled)
  const json = await postMobileAppPermission({
    action: 'SAVE',
    id: Number(perms.mobileAppId) || 0,
    branchID: Number(branchId) || 0,
    chatType: String(perms.chatMode || 'off'),
    mentorAI: mentorOn,
    parentAccess: mentorOn && Boolean(perms.mentorAi?.parentsAccess),
    etube: etubeOn,
    etubeView: etubeOn && Boolean(perms.etube?.viewing),
    etubeUpload: etubeOn && Boolean(perms.etube?.uploading),
  })
  const newId = Number(json?.data?.id ?? json?.data?.ID ?? json?.id) || Number(perms.mobileAppId) || 0
  return { ...perms, mobileAppId: newId }
}
