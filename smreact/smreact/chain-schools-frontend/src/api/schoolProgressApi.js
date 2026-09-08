

import { SUPERADMIN_API_BASE, ERP_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { USAGE_MODULES, emptyMobileMods } from '@/pages/SchoolStatus/data'

const URL = `${SUPERADMIN_API_BASE}/api/AHM_School_Progress/branch-report`
const CARD_URL = `${SUPERADMIN_API_BASE}/api/AHM_School_Progress/followup/onboarding-card-action`

/* API "5/20/2026 4:11:12 PM" bhejti hai → YYYY-MM-DD. Jo samajh na aaye
   use jaisa hai waisa hi chhor dete hain. */
function toDateOnly(v) {
  if (!v) return ''
  const [datePart] = String(v).trim().split(' ')
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return datePart
  const [, mm, dd, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

/* Screen ke badge do hi haalat jaanta hai. */
const state = (v) => (v ? 'Entered' : 'Not Entered')

/* API row → is screen ki shape (data.js ke toProgressRow jaisi keys). */
function toReport(r) {
  const g = r?.generalDetails || {}
  const s = r?.stateDetails || {}
  const c = r?.compulsionDetails || {}
  return {
    branchId:    r?.branchID,
    name:        (r?.branchName || '').trim(),
    principal:   g.principalName || '',
    contact:     g.principalPhone || '',
    students:    g.totalStudents ?? r?.totalStudents ?? 0,
    staff:       g.totalStaff ?? r?.totalStaff ?? 0,
    stuSignup:   g.studentSignUp ?? 0,
    staffSignup: g.staffSignUp ?? 0,
    signupDate:  toDateOnly(g.createdAt),
    logins:      r?.totalLogins ?? 0,
    assignedTo:  r?.assignedTo ?? 0,
    tabs: {
      school:    state(s.schoolTab),
      classes:   state(s.classTab),
      student:   state(s.studentTab),
      dept:      state(s.departmentTab),
      staff:     state(s.staffTab),
      syllabus:  state(s.syllabusTab),
      timetable: state(s.timeTableTab),
    },
    comp: {
      staffContact:    state(c.staffContact),
      parentContact:   state(c.parentContact),
      subjectAssigned: state(c.subjectAssigned),
      /* API me spelling `previousDeus` hai. */
      prevDues:        state(c.previousDeus ?? c.previousDues),
    },
  }
}

/**
 * Saare branches ka progress — `branchID → row` map me.
 * Call nakaam ho to khali map: screen schools ki list par chalti rehti hai,
 * bas metrics 0 rehte hain.
 */
export async function fetchBranchReport({ isActive = true, launchSetup = 1, type = 'chain' } = {}) {
  const qs = `isActive=${isActive}&launchSetup=${launchSetup}&type=${type}`
  const res = await fetch(`${URL}?${qs}`, { headers: { Accept: '*/*' } })
  if (!res.ok) return {}
  const json = await res.json().catch(() => null)
  const rows = Array.isArray(json?.data) ? json.data : []
  return Object.fromEntries(rows.filter((r) => r?.branchID != null).map((r) => [r.branchID, toReport(r)]))
}

/**
 * Har haalat ke branches aik map me — `isActive` aur `launchSetup` dono par
 * API filter karti hai, is liye sirf aik combination maangne se doosri
 * haalat wale branches (jaise Inactive tab ke schools) response me aate hi
 * nahi the aur unke staff/students 0 dikhte the.
 *
 * Chaaron combination parallel jaati hain aur pehla jawab jeetta hai —
 * launchSetup=1 pehle, taake active school ka data wahi rahe.
 */
export async function fetchBranchReportAll() {
  const buckets = [
    { isActive: true,  launchSetup: 1 },
    { isActive: true,  launchSetup: 0 },
    { isActive: false, launchSetup: 1 },
    { isActive: false, launchSetup: 0 },
  ]
  const maps = await Promise.all(buckets.map((b) => fetchBranchReport(b).catch(() => ({}))))
  const out = {}
  maps.forEach((m) => {
    Object.entries(m).forEach(([id, row]) => { if (!out[id]) out[id] = row })
  })
  return out
}

/* ═══════════════ FOLLOW-UP CARD (notes / calls / messages) ═══════════════
   POST {sa}/api/AHM_School_Progress/followup/onboarding-card-action
     body: { action, id, branchID, headType, subHeadType, commentDetail,
             date, type, userId }

   Aik hi route, sirf `action` badalta hai — API khud kehti hai:
   "Valid actions: get, add, update, delete" (yaani naye record par "insert"
   nahi, `add`).

   headType   → 'Follow-up Card' (Onboarding Card isi route par hai, wahan
                subHeadType module ka naam hota hai)
   subHeadType→ 'Notes' | 'Calls' | 'Messages'

   `get` PascalCase keys deta hai: ID, BranchID, HeadType, SubHeadType,
   CommentDetail, Date, CreatedBy, CreatedAt.
   ═══════════════════════════════════════════════════════════════════ */

export const CARD_HEADS = { followup: 'Follow-up Card', onboarding: 'Onboarding Card' }
export const CARD_SUBS = { notes: 'Notes', calls: 'Calls', messages: 'Messages' }

/* Logged-in user — API `userId` par isi ka id rakhti hai, aur card par isi ka
   naam dikhta hai. */
function currentUser() {
  const u = getStoredUser()
  /* Wahi tarteeb jo sidebar par hai: ERP handoff `displayName` bhejta hai,
     API `name`. */
  return {
    id: Number(u?.id ?? u?.userID ?? u?.userId) || 0,
    name: u?.displayName || u?.name || 'Chain Admin',
  }
}

export const currentUserName = () => currentUser().name

/* API row → screen ki shape. */
export function cardRowToUi(r) {
  return {
    id:          Number(r?.ID ?? r?.id) || 0,
    branchId:    Number(r?.BranchID ?? r?.branchID) || 0,
    headType:    String(r?.HeadType ?? r?.headType ?? ''),
    subHeadType: String(r?.SubHeadType ?? r?.subHeadType ?? ''),
    comment:     String(r?.CommentDetail ?? r?.commentDetail ?? ''),
    date:        String(r?.Date ?? r?.date ?? ''),
    /* API abhi banane wale ka naam nahi bhejti (sirf CreatedBy id). Jo naam
       aa jaye wo dikhate hain, warna logged-in user ka naam — entry usi ne
       ki hoti hai. */
    user:        String(r?.CreatedByName ?? r?.createdByName ?? '') || currentUser().name,
  }
}

async function cardAction(fields, label) {
  const body = {
    action:        fields.action,
    id:            Number(fields.id) || 0,
    branchID:      Number(fields.branchId) || 0,
    headType:      fields.headType || '',
    subHeadType:   fields.subHeadType || '',
    commentDetail: fields.commentDetail || '',
    date:          fields.date || '',
    type:          'chain',
    userId:        currentUser().id,
  }
  const res = await fetch(CARD_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || `Could not ${label}`)
  }
  return json
}

/** Aik branch ke follow-up cards (chahein to aik hi sub-head ke). */
export async function listCardActions({ branchId, headType = CARD_HEADS.followup, subHeadType = '' } = {}) {
  const json = await cardAction({ action: 'get', id: 0, branchId, headType, subHeadType }, 'load follow-up cards')
  const rows = Array.isArray(json?.data) ? json.data : []
  return rows.map(cardRowToUi).filter((r) => r.id)
}

/** Naya entry ya maujooda ki tarmeem — `id` ho to update, warna add. */
export function saveCardAction({ branchId, headType = CARD_HEADS.followup, subHeadType, commentDetail, date, id = 0 } = {}) {
  const isEdit = Number(id) > 0
  return cardAction(
    { action: isEdit ? 'update' : 'add', id, branchId, headType, subHeadType, commentDetail, date },
    isEdit ? 'update this entry' : 'save this entry',
  )
}

/** Aik entry hatao. */
export function deleteCardAction(id, branchId) {
  return cardAction({ action: 'delete', id, branchId }, 'delete this entry')
}

/** Rows → wahi teen counters jo school card ke chips par chahiye. */
export function countCardRows(rows = []) {
  const n = (name) => rows.filter((r) => r.subHeadType === name).length
  return { notes: n(CARD_SUBS.notes), calls: n(CARD_SUBS.calls), messages: n(CARD_SUBS.messages) }
}

/**
 * Kai branches ke counters — branch-report in me se koi nahi deti, is liye
 * har branch ke cards aik dafa padhte hain. Aik waqt me 6 calls, aur har
 * branch ka jawab aate hi `onResult(branchID, counts)` — list ruki nahi
 * rehti, chips ek ek kar ke bhar jaate hain.
 */
export async function fetchCardCountsEach(branchIds, onResult) {
  const ids = [...new Set((branchIds || []).map(Number).filter(Boolean))]
  let next = 0
  const runners = Array.from({ length: Math.min(6, ids.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= ids.length) return
      const id = ids[i]
      const rows = await listCardActions({ branchId: id }).catch(() => [])
      onResult(id, countCardRows(rows))
    }
  })
  await Promise.all(runners)
}

/* ═══════════════ USER TIME SPEND (ERP screen usage) ═══════════════
   Today:  POST {erp}/manage-usertimespend  { action: "get", date, type: "erp", … }
   Month:  POST {erp}/usertimespend-report  { branchID, month: "YYYY-MM", type: "erp" }
     → { totalEntries, screenTime: [{ ScreenName, TotalSeconds, TotalTime }] } */

/* Swagger: POST https://alphaapi.schoolmentor.ai/manage-usertimespend
            POST https://alphaapi.schoolmentor.ai/usertimespend-report
   Chain :3002 par seedha alphaapi CORS block karta hai (allowlist ~:3000).
   Is liye hamesha same-origin relative path: local Vite proxy, deploy IIS rewrite. */
const TIME_URL = `${ERP_API_BASE}/manage-usertimespend`
const REPORT_URL = `${ERP_API_BASE}/usertimespend-report`

const SCREEN_TO_KEY = {
  dashboard: 'dashboard', 'mentor ai': 'mentorai', academics: 'academics',
  examination: 'exam', attendance: 'attendance', timetable: 'timetable',
  'time table': 'timetable', 'paper generator': 'paper', fee: 'fee',
  accounts: 'accounts', inventory: 'inventory', students: 'students',
  'human resource': 'hr', hr: 'hr', 'staff appraisals': 'appraisal',
  'admission crm': 'admissions', 'admissions crm': 'admissions',
  'school sops': 'sop', sops: 'sop', 'teacher trainings': 'trainings',
  'e-tube': 'etube', etube: 'etube', chat: 'chat',
  notifications: 'notifications', 'launch setup': 'launch', settings: 'settings',
  'user permissions': 'permissions', 'audit logs': 'audit', reports: 'reports',
}

function pad2(n) { return String(n).padStart(2, '0') }
function formatDateYmd(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function parseHms(raw) {
  const p = String(raw || '0').split(':').map((x) => Number(x) || 0)
  if (p.length >= 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return p[0] || 0
}
function formatHms(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0))
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`
}
function screenKey(name) {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return ''
  if (n.startsWith('launch setup')) return 'launch'
  return SCREEN_TO_KEY[n] || n.replace(/\s+/g, '')
}
function formatMonthYm(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function rowsToUsage(rows = []) {
  const byKey = {}
  let totalSec = 0
  let logins = 0
  ;(Array.isArray(rows) ? rows : []).forEach((r) => {
    const name = r?.ScreenName ?? r?.screenName ?? ''
    const key = screenKey(name)
    if (!key) return
    const sec = parseHms(r?.TimeSpend ?? r?.timeSpend)
    if (!byKey[key]) byKey[key] = { l: 0, sec: 0 }
    byKey[key].l += 1
    byKey[key].sec += sec
    totalSec += sec
    logins += 1
  })
  const mods = USAGE_MODULES.map((m) => ({
    ...m,
    l: byKey[m.key]?.l || 0,
    t: formatHms(byKey[m.key]?.sec || 0),
  }))
  Object.keys(byKey).forEach((k) => {
    if (USAGE_MODULES.some((m) => m.key === k)) return
    mods.push({ key: k, name: k, icon: 'fa-layer-group', l: byKey[k].l, t: formatHms(byKey[k].sec) })
  })
  return { mods, logins, time: formatHms(totalSec) }
}

function reportToUsage(report = {}) {
  const rows = report?.screenTime ?? report?.ScreenTime ?? []
  const byKey = {}
  let totalSec = 0
  ;(Array.isArray(rows) ? rows : []).forEach((r) => {
    const name = r?.ScreenName ?? r?.screenName ?? ''
    const key = screenKey(name)
    if (!key) return
    const sec = Number(r?.TotalSeconds ?? r?.totalSeconds)
      || parseHms(r?.TotalTime ?? r?.totalTime ?? r?.TimeSpend ?? r?.timeSpend)
    if (!byKey[key]) byKey[key] = { sec: 0 }
    byKey[key].sec += sec
    totalSec += sec
  })
  const mods = USAGE_MODULES.map((m) => ({
    ...m,
    l: 0,
    t: formatHms(byKey[m.key]?.sec || 0),
  }))
  Object.keys(byKey).forEach((k) => {
    if (USAGE_MODULES.some((m) => m.key === k)) return
    mods.push({ key: k, name: k, icon: 'fa-layer-group', l: 0, t: formatHms(byKey[k].sec) })
  })
  return {
    mods,
    logins: Number(report?.totalEntries ?? report?.TotalEntries ?? 0) || 0,
    time: formatHms(totalSec),
  }
}

const MOBILE_SCREEN_TO_KEY = {
  dashboard: 'dashboard', quiz: 'quiz', 'lesson plan': 'lessonplan', lessonplan: 'lessonplan',
  'dlp submission': 'dlp', dlp: 'dlp', academics: 'academics',
  'home work': 'homework', homework: 'homework', worksheet: 'worksheet',
  'date sheet': 'datesheet', datesheet: 'datesheet', syllabus: 'syllabus',
  results: 'results', 'notebook work': 'notebookwork', notebookwork: 'notebookwork',
  'time table': 'timetable', timetable: 'timetable',
  'notice board': 'noticeboard', noticeboard: 'noticeboard',
  suggestions: 'suggestions', 'e-tube': 'etube', etube: 'etube',
  notifications: 'notifications', chats: 'chats', chat: 'chats',
  reports: 'reports', meetings: 'meetings', tasks: 'tasks',
  attendance: 'attendance', financials: 'financials',
  'staff leaves': 'staffleaves', staffleaves: 'staffleaves', fee: 'fee',
  'ai chat': 'aichat', aichat: 'aichat',
  'ai lesson plan': 'ailessonplan', ailessonplan: 'ailessonplan',
  'notebook lesson plan ai': 'notebooklp', 'notebook lesson plan': 'notebooklp',
  notebooklp: 'notebooklp',
  'ai worksheets': 'aiworksheet', 'ai worksheet': 'aiworksheet', aiworksheet: 'aiworksheet',
  'ai design studio': 'aidesignstudio', aidesignstudio: 'aidesignstudio',
}

function mobileScreenKey(name) {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return ''
  return MOBILE_SCREEN_TO_KEY[n] || n.replace(/\s+/g, '')
}

function rowsToMobileUsage(rows = []) {
  const mods = emptyMobileMods()
  let totalSec = 0
  let logins = 0
  ;(Array.isArray(rows) ? rows : []).forEach((r) => {
    const name = r?.ScreenName ?? r?.screenName ?? ''
    const key = mobileScreenKey(name)
    if (!key) return
    const sec = parseHms(r?.TimeSpend ?? r?.timeSpend)
    if (!mods[key]) mods[key] = { l: 0, t: '00:00:00' }
    mods[key].l += 1
    mods[key].t = formatHms(parseHms(mods[key].t) + sec)
    totalSec += sec
    logins += 1
  })
  return { mods, logins, time: formatHms(totalSec) }
}

function reportToMobileUsage(report = {}) {
  const rows = report?.screenTime ?? report?.ScreenTime ?? []
  const mods = emptyMobileMods()
  let totalSec = 0
  ;(Array.isArray(rows) ? rows : []).forEach((r) => {
    const name = r?.ScreenName ?? r?.screenName ?? ''
    const key = mobileScreenKey(name)
    if (!key) return
    const sec = Number(r?.TotalSeconds ?? r?.totalSeconds)
      || parseHms(r?.TotalTime ?? r?.totalTime ?? r?.TimeSpend ?? r?.timeSpend)
    if (!mods[key]) mods[key] = { l: 0, t: '00:00:00' }
    mods[key].t = formatHms(parseHms(mods[key].t) + sec)
    totalSec += sec
  })
  return {
    mods,
    logins: Number(report?.totalEntries ?? report?.TotalEntries ?? 0) || 0,
    time: formatHms(totalSec),
  }
}

export async function listUserTimeSpend({ branchId, date, type = 'erp' } = {}) {
  const body = {
    action: 'get',
    branchID: Number(branchId) || 0,
    userID: 0,
    screenName: '',
    startTime: '',
    endTime: '',
    timeSpend: '',
    date: date || formatDateYmd(),
    type,
    ipAddress: '',
  }
  const res = await fetch(TIME_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || 'Could not load screen time')
  }
  return Array.isArray(json?.data) ? json.data : []
}

function parseReportPayload(json) {
  const data = json?.data ?? json?.Data ?? {}
  if (Array.isArray(data)) return { totalEntries: data.length, screenTime: data }
  return {
    totalEntries: data.totalEntries ?? data.TotalEntries ?? 0,
    screenTime: data.screenTime ?? data.ScreenTime ?? [],
  }
}

export async function listUserTimeSpendReport({ branchId, month, type = 'erp' } = {}) {
  const body = {
    branchID: Number(branchId) || 0,
    month: month || formatMonthYm(),
    type,
  }
  const res = await fetch(REPORT_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || 'Could not load monthly screen time')
  }
  return parseReportPayload(json)
}

/** Aaj = daily GET; mahina = /usertimespend-report. type erp + mobilePhone. */
export async function fetchUserTimeSpend(branchId, date) {
  const todayYmd = date || formatDateYmd()
  const month = String(todayYmd).slice(0, 7)
  const [todayRows, report, mobileTodayRows, mobileReport] = await Promise.all([
    listUserTimeSpend({ branchId, date: todayYmd, type: 'erp' }).catch(() => []),
    listUserTimeSpendReport({ branchId, month, type: 'erp' }).catch(() => ({ totalEntries: 0, screenTime: [] })),
    listUserTimeSpend({ branchId, date: todayYmd, type: 'mobilePhone' }).catch(() => []),
    listUserTimeSpendReport({ branchId, month, type: 'mobilePhone' }).catch(() => ({ totalEntries: 0, screenTime: [] })),
  ])
  const todayU = rowsToUsage(todayRows)
  const monthU = reportToUsage(report)
  const mobileTodayU = rowsToMobileUsage(mobileTodayRows)
  const mobileMonthU = reportToMobileUsage(mobileReport)
  return {
    todayLogins: todayU.logins,
    todayTime: todayU.time,
    todayMods: todayU.mods,
    monthLogins: monthU.logins,
    monthTime: monthU.time,
    monthMods: monthU.mods,
    todayMobileLogins: mobileTodayU.logins,
    todayMobileTime: mobileTodayU.time,
    todayMobileMods: mobileTodayU.mods,
    monthMobileLogins: mobileMonthU.logins,
    monthMobileTime: mobileMonthU.time,
    monthMobileMods: mobileMonthU.mods,
  }
}
