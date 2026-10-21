/* ═══════════════════════════════════════════════════════════════════
   CONTENT PERMISSIONS — chain Head Office apne associate school ke liye
   kisi module ke content-types par View / Add / Edit / Delete access deta
   hai. Academics (Activity Planner / Lesson Plan / Notebook) aur
   Examination (Exam Setup / Result Setup) — dono isi aik endpoint par.

     POST {chain}/api/Network_Setup/manage-academics-permission
       swagger: AHM_Chain_Branch_Academics_PermissionModel
       action: save | SAVE | GETBYBRANCH | GETBYNETWORK | GETBYNETWORKANDBRANCH
               (aur kuch nahi — server "Invalid action" wapas karta hai)

   Har checkbox AIK row hai. Save par har (menu × action) combination jata
   hai — checked → isAccessable:true, baqi → false:

     { action:"save", id, networkID, branchID, menu, menuAction,
       isAccessable, createdBy:0, modifiedBy:0 }

   menu       : module ke hisab se slug (activity | lesson | notebook |
                examsetup | resultsetup)
   menuAction : view | add | edit | delete

   Endpoint menu ko validate nahi karta (sirf `action` validate hota hai),
   is liye alag module apne alag menu slugs par usi table me reh sakte hain
   — Academics ki rows aur Examination ki rows menu se alag rehti hain.

   GET jawab me wahi `Action` par aata hai (SAVE ka field `menuAction` hai).
   networkID SAVE par lazmi hai (null → 400 Invalid Network ID). DELETE
   action nahi — access hatane ke liye isAccessable:false se dobara SAVE.

   Ye axios client se nahi jata (wo /api par .NET backend + Bearer token) —
   ye endpoint chain base par hai, bilkul releaseApi / networkSchoolsApi jaisa.
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { currentNetworkId } from './networkSchoolsApi'

const MANAGE_URL = `${CHAIN_API_BASE}/api/Network_Setup/manage-academics-permission`

export { currentNetworkId }

/* Action key (PERMISSION_ACTIONS) → API `menuAction`. */
export const ACTION_LABEL = {
  view:   'view',
  add:    'add',
  edit:   'edit',
  delete: 'delete',
}
const ACTION_KEYS = Object.keys(ACTION_LABEL)

const int = (v) => Number(v) || 0
/* Milaan ke liye: bara/chhota harf, space aur viram-chihn ka farq mita do —
   'Notebook Lesson Plan' / 'notebook' dono aik kunji par aa jate. */
const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/* Save slugs + purane display labels (pehle 'View' save hue ho sakte hain)
   dono GET par map hon. */
const ACT_KEY = new Map([
  ['view', 'view'],
  ['viewonly', 'view'],
  ['add', 'add'],
  ['edit', 'edit'],
  ['update', 'edit'],
  ['delete', 'delete'],
])

async function manage(payload) {
  const res = await fetch(MANAGE_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    const ve = json?.errors ? Object.values(json.errors).flat().join(' ') : ''
    throw new Error(json?.message || ve || json?.title || 'Permission request failed')
  }
  return json
}

function body(action, { id = 0, networkID, branchID, menu = '', menuAction = '', isAccessable = true } = {}) {
  return {
    action,
    id: int(id),
    networkID: int(networkID) || null,
    branchID: int(branchID) || null,
    menu,
    menuAction,
    isAccessable: !!isAccessable,
    createdBy: 0,
    modifiedBy: 0,
  }
}

/* ── Generic content-permissions API factory ─────────────────────────
   menuMap     : { sectionKey: menuSlug } — SAVE par ye slug jata hai.
   menuReverse : Map(normalized-slug → sectionKey) — GET rows ko section par
                 wapas laane ke liye (purane/alt labels ke aliases bhi).
   Dono fetch/save ka shape bilkul aik jaisa hai:
     fetch → { perms: {sectionKey:{view,add,edit,delete}}, ids:{'sec||act':rowId} }
     save  → har (section × action) ke against aik SAVE. */
function makeContentPermissionsApi(menuMap, menuReverse) {
  const SECTION_KEYS = Object.keys(menuMap)
  const menus = SECTION_KEYS.map((k) => menuMap[k])

  const allFalse = () => {
    const out = {}
    SECTION_KEYS.forEach((k) => { out[k] = { view: false, add: false, edit: false, delete: false } })
    return out
  }
  /* Default — View Only (view on, baqi off), jab tak Head Office save na kare. */
  const emptyViewOnly = () => {
    const out = {}
    SECTION_KEYS.forEach((k) => { out[k] = { view: true, add: false, edit: false, delete: false } })
    return out
  }

  async function fetchPerms(branchID, networkID = currentNetworkId()) {
    const bid = int(branchID)
    const nid = int(networkID)
    const ids = {}
    if (!bid) return { perms: emptyViewOnly(), ids }

    /* Har menu ki apni GET, taake view/add/edit/delete ki rows miss na hon.
       Aik jawab me saari rows aa jayein to menu+action se dedupe. */
    const lists = await Promise.all(menus.map((menu) => manage(body(
      nid ? 'GETBYNETWORKANDBRANCH' : 'GETBYBRANCH',
      { networkID: nid, branchID: bid, menu },
    )).catch(() => null)))
    const seen = new Set()
    const rows = []
    lists.forEach((json) => {
      const list = Array.isArray(json?.data) ? json.data
        : Array.isArray(json?.Data) ? json.Data : []
      list.forEach((r) => {
        const key = `${norm(r.Menu ?? r.menu)}|${norm(r.Action ?? r.action ?? r.MenuAction ?? r.menuAction)}`
        if (seen.has(key)) return
        seen.add(key)
        rows.push(r)
      })
    })

    if (!rows.length) return { perms: emptyViewOnly(), ids }

    const perms = allFalse()
    rows.forEach((r) => {
      const secKey = menuReverse.get(norm(r.Menu ?? r.menu))
      const actKey = ACT_KEY.get(norm(r.Action ?? r.action ?? r.MenuAction ?? r.menuAction))
      if (!secKey || !actKey) return   // doosre module ki row → skip
      perms[secKey][actKey] = !!(r.IsAccessable ?? r.isAccessable)
      ids[`${secKey}||${actKey}`] = int(r.ID ?? r.id)
    })
    return { perms, ids }
  }

  async function savePerms(branchID, perms, networkID = currentNetworkId(), ids = {}) {
    const bid = int(branchID)
    const nid = int(networkID)
    if (!bid || !nid) throw new Error('Missing network or branch for permissions')

    for (const secKey of SECTION_KEYS) {
      const sp = perms?.[secKey] || {}
      for (const actKey of ACTION_KEYS) {
        await manage(body('save', {
          id: ids[`${secKey}||${actKey}`],
          networkID: nid,
          branchID: bid,
          menu: menuMap[secKey],
          menuAction: ACTION_LABEL[actKey],
          isAccessable: !!sp[actKey],
        }))
      }
    }
  }

  return { fetchPerms, savePerms, emptyViewOnly }
}

/* ════════════════════════════ ACADEMICS ════════════════════════════
   Section key (data.js → MODULE_ADVANCED_PERMISSIONS.academics) → API `menu`. */
export const ACADEMICS_MENU = {
  activityPlanner:    'activity',
  lessonPlan:         'lesson',
  notebookLessonPlan: 'notebook',
}
const ACADEMICS_REVERSE = new Map([
  ['activity', 'activityPlanner'],
  ['activityplanner', 'activityPlanner'],
  ['lesson', 'lessonPlan'],
  ['lessonplan', 'lessonPlan'],
  /* Lesson Plan ki permission school me Classwork Lesson Plan par lagti hai. */
  ['classwork', 'lessonPlan'],
  ['classworklessonplan', 'lessonPlan'],
  ['classworklesson', 'lessonPlan'],
  ['notebook', 'notebookLessonPlan'],
  ['notebooklessonplan', 'notebookLessonPlan'],
  ['notebookplan', 'notebookLessonPlan'],
])
const academicsApi = makeContentPermissionsApi(ACADEMICS_MENU, ACADEMICS_REVERSE)

export const emptyAcademicsPerms = academicsApi.emptyViewOnly
/**
 * Aik branch ki academics content permissions (GET).
 * Wapas { perms, ids } — perms me enabled wahi jo save hua (warna View Only),
 * ids taake SAVE purani row update kare (nayi duplicate na bane).
 */
export const fetchAcademicsPermissions = academicsApi.fetchPerms
/**
 * Aik branch ki academics content permissions save — har checkbox ke against
 * aik SAVE (checked true, unchecked false). `ids` (GET se) do to update, warna insert.
 */
export const saveAcademicsPermissions = academicsApi.savePerms

/* ════════════════════════════ EXAMINATION ════════════════════════════
   Section key (data.js → MODULE_ADVANCED_PERMISSIONS.examination) → API `menu`.
   Academics jaisa hi flow, bas menu slugs alag — isi liye rows aapas me
   nahi takrati. */
export const EXAMINATION_MENU = {
  examSetup:   'examsetup',
  resultSetup: 'resultsetup',
}
const EXAMINATION_REVERSE = new Map([
  ['examsetup', 'examSetup'],
  ['exam', 'examSetup'],
  ['examination', 'examSetup'],
  ['resultsetup', 'resultSetup'],
  ['result', 'resultSetup'],
])
const examinationApi = makeContentPermissionsApi(EXAMINATION_MENU, EXAMINATION_REVERSE)

export const emptyExaminationPerms = examinationApi.emptyViewOnly
/** Aik branch ki examination content permissions (GET) — { perms, ids }. */
export const fetchExaminationPermissions = examinationApi.fetchPerms
/** Aik branch ki examination content permissions save — academics jaisa. */
export const saveExaminationPermissions = examinationApi.savePerms
