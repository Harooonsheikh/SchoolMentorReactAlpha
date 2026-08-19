

import { SUPERADMIN_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'

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
