/* ═══════════════════════════════════════════════════════════════════
   ACADEMICS CONTENT PERMISSIONS — chain Head Office apne associate school
   ke liye Academics ke content-types (Activity Planner / Lesson Plan /
   Notebook Lesson Plan) par View / Add / Edit / Delete access deta hai.

     POST {chain}/api/Network_Setup/manage-academics-permission
       swagger: AHM_Chain_Branch_Academics_PermissionModel
       action: save | SAVE | GETBYBRANCH | GETBYNETWORK | GETBYNETWORKANDBRANCH
               (aur kuch nahi — server "Invalid action" wapas karta hai)

   Har checkbox AIK row hai. Save par poore 12 combinations (3 menus ×
   4 actions) jate hain — checked → isAccessable:true, baqi → false:

     { action:"save", id, networkID, branchID, menu, menuAction,
       isAccessable, createdBy:0, modifiedBy:0 }

   menu       : activity | lesson | notebook
   menuAction : view | add | edit | delete

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

/* Section key (data.js → MODULE_ADVANCED_PERMISSIONS.academics) → API `menu`. */
export const ACADEMICS_MENU = {
  activityPlanner:    'activity',
  lessonPlan:         'lesson',
  notebookLessonPlan: 'notebook',
}
/* Action key (PERMISSION_ACTIONS) → API `menuAction`. */
export const ACTION_LABEL = {
  view:   'view',
  add:    'add',
  edit:   'edit',
  delete: 'delete',
}

const SECTION_KEYS = Object.keys(ACADEMICS_MENU)
const ACTION_KEYS  = Object.keys(ACTION_LABEL)

const int = (v) => Number(v) || 0
/* Milaan ke liye: bara/chhota harf, space aur viram-chihn ka farq mita do —
   'Notebook Lesson Plan' / 'notebook' dono aik kunji par aa jate. */
const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/* Save slugs + purane display labels (pehle 'Activity Planner' / 'View'
   save hue ho sakte hain) dono GET par map hon. */
const MENU_KEY = new Map([
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
    throw new Error(json?.message || ve || json?.title || 'Academics permission request failed')
  }
  return json
}

function allFalsePerms() {
  const out = {}
  SECTION_KEYS.forEach((k) => { out[k] = { view: false, add: false, edit: false, delete: false } })
  return out
}

/* Default — View Only (view on, baqi off), jab tak Head Office save na kare. */
export function emptyAcademicsPerms() {
  const out = {}
  SECTION_KEYS.forEach((k) => { out[k] = { view: true, add: false, edit: false, delete: false } })
  return out
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

/**
 * Aik branch ki academics content permissions (GET).
 * Wapas { perms, ids }:
 *   perms — { [sectionKey]: { view, add, edit, delete } }. Saved rows hon to
 *           sirf un ka isAccessable overlay hota hai — jo API me nahi, wo
 *           false (checked wahi jo save hua). Koi row na ho to View Only.
 *   ids   — { 'sectionKey||actionKey': rowId } taake SAVE purani row update
 *           kare (nayi duplicate na bane).
 */
export async function fetchAcademicsPermissions(branchID, networkID = currentNetworkId()) {
  const bid = int(branchID)
  const nid = int(networkID)
  const ids = {}
  if (!bid) return { perms: emptyAcademicsPerms(), ids }

  /* Activity Planner, Lesson Plan (classwork) aur Notebook Lesson Plan —
     har menu ki apni GET, taake view/add/edit/delete ki rows miss na hon.
     Aik jawab me saari rows aa jayein to menu+action se dedupe. */
  const menus = ['activity', 'lesson', 'notebook']
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

  if (!rows.length) return { perms: emptyAcademicsPerms(), ids }

  const perms = allFalsePerms()
  rows.forEach((r) => {
    const secKey = MENU_KEY.get(norm(r.Menu ?? r.menu))
    const actKey = ACT_KEY.get(norm(r.Action ?? r.action ?? r.MenuAction ?? r.menuAction))
    if (!secKey || !actKey) return
    perms[secKey][actKey] = !!(r.IsAccessable ?? r.isAccessable)
    ids[`${secKey}||${actKey}`] = int(r.ID ?? r.id)
  })
  return { perms, ids }
}

/**
 * Aik branch ki academics content permissions save.
 * Har checkbox ke against aik SAVE — checked true, unchecked false.
 * `ids` (GET se mila) pass karo to purani rows update hongi, warna id:0
 * insert / upsert.
 */
export async function saveAcademicsPermissions(branchID, perms, networkID = currentNetworkId(), ids = {}) {
  const bid = int(branchID)
  const nid = int(networkID)
  if (!bid || !nid) throw new Error('Missing network or branch for academics permissions')

  for (const secKey of SECTION_KEYS) {
    const sp = perms?.[secKey] || {}
    for (const actKey of ACTION_KEYS) {
      await manage(body('save', {
        id: ids[`${secKey}||${actKey}`],
        networkID: nid,
        branchID: bid,
        menu: ACADEMICS_MENU[secKey],
        menuAction: ACTION_LABEL[actKey],
        isAccessable: !!sp[actKey],
      }))
    }
  }
}
