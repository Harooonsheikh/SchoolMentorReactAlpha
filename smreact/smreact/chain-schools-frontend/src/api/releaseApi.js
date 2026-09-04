/* ═══════════════════════════════════════════════════════════════════
   ACADEMICS RELEASE — Master Release aur Sub Release, dono ek hi
   endpoint par:

     POST {chain}/api/Network_Setup/manage-release
       action: insert | update | delete | get   (aur kuch nahi — server
               "Invalid @Action value" wapas karta hai)

   Master aur Sub ka farq sirf DO cheezon me hai:
     • releaseType — 'Release' = Master, 'SubRelease' = Sub. (Server in
       do ke ilawa koi value qubool nahi karta.)
     • child1      — Master me network ke SAB connected schools ki
       branchID jati hai; Sub me sirf chuni hui schools ki.

   child2 me wo content jata hai jo release ho raha hai. Har row:
       type   — Activity | Lesson Plan | NoteBook Plan | Resource File
                (parhte waqt purani spelling bhi chal jati hai — dekhein
                CHILD_TYPE ke neeche TYPE_ALIASES)
       typeID — usi content ki ASLI id (activity id, ULP master id,
                notebook master id, resource id)
       gradeID / subjectID — us content ki class aur subject

   ── Server ki paband-iyan (live API par jaanch kar likhi gayi hain) ──
     • releaseType, dueDate, creationDate aur duration HAR action par lazmi
       hain — delete aur get par bhi, warna 400 (validation) aata hai.
     • child1.branchID par foreign key hai (AHM_Branch).
     • child2.gradeID / subjectID par bhi foreign key hai
       (AHM_Branch_Grades / AHM_Grade_Subjects). 0 bhejna FK todta hai
       aur POORA insert fail ho jata hai — is liye Activity Calendar
       (jiska koi class/subject hota hi nahi) me ye dono NULL jate hain,
       jo FK qubool kar leti hai.
     • typeID par FK nahi hai — us ki sehat hamare paas hi banti hai.
     • `get` apni `id` nazarandaz karta hai: poore network ke sab
       releases ek saath wapas aate hain.

   Ye axios client se nahi jata — wo `/api` par .NET backend ki taraf
   jata hai aur apna Bearer token lagata hai, jabke ye endpoint chain
   base par hai (bilkul networkSchoolsApi ki tarah).
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { currentNetworkId } from './networkSchoolsApi'
import { mapActivity } from './activityCalendarApi'
import { mapResource } from './resourceLibraryApi'

const MANAGE_URL = `${CHAIN_API_BASE}/api/Network_Setup/manage-release`

export { currentNetworkId }

/** Server ke qubool kiye hue do hi releaseType. */
export const RELEASE_TYPE = { MASTER: 'Release', SUB: 'SubRelease' }

/** child2 ka `type` — jo server ko bheja jata hai. */
export const CHILD_TYPE = {
  activity: 'Activity',
  notebook: 'NoteBook Plan',
  lesson: 'Lesson Plan',
  resource: 'Resource File',
}

/* Parhte waqt purani spelling bhi chalti hai: jo releases pehle ban chuke
   hain wo DB me 'ActivityCalendar' / 'classworklessonplan' waghera ke sath
   pade hain, aur unhein tootna nahi chahiye. Milaan se pehle sirf harf-o-adad
   rakhe jate hain, is liye bara/chhota harf, space aur singular/plural ka
   koi farq nahi parta. */
const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const TYPE_ALIASES = {
  activity: ['Activity', 'Activities', 'ActivityCalendar'],
  lesson: ['Lesson Plan', 'Lesson Plans', 'classworklessonplan'],
  notebook: ['NoteBook Plan', 'NoteBook Plans', 'notebooklessonplan'],
  resource: ['Resource File', 'Resource Files', 'resourcelibrary'],
}
const TYPE_KEY = new Map()
Object.entries(TYPE_ALIASES).forEach(([key, names]) => names.forEach((n) => TYPE_KEY.set(norm(n), key)))

/** Server ka `type` → hamari kunji: 'activity' | 'lesson' | 'notebook' | 'resource'. */
export const childTypeKey = (raw) => TYPE_KEY.get(norm(raw)) || ''

const int = (v) => Number(v) || 0
/* FK wali id: 0 / khali ko NULL banao — 0 foreign key todta hai. */
const fk = (v) => (Number(v) > 0 ? Number(v) : null)

/* dueDate server ko ISO chahiye. 'YYYY-MM-DD' aaye to use din ki shuruaat
   maan lo, warna jo mila usi ko ISO me badal do. */
const isoDate = (d) => {
  if (!d) return new Date().toISOString()
  const s = String(d)
  if (s.length === 10) return `${s}T00:00:00.000Z`
  const t = new Date(s)
  return Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString()
}

async function manage(payload) {
  const res = await fetch(MANAGE_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    /* 400 par .NET ModelState `errors` deta hai (message nahi) — us se bhi
       kuch parhne laayak nikaal lo. */
    const ve = json?.errors ? Object.values(json.errors).flat().join(' ') : ''
    throw new Error(json?.message || ve || json?.title || 'Release request failed')
  }
  return json
}

/* Har call par jane wale lazmi fields — dekhein upar wali sharh.
   creationDate bhi HAR action par lazmi hai: na jaye to 400 aata hai
   ("The CreationDate field is required.") — delete aur get par bhi.
   Jo maloom ho wo bhejo, warna aaj ka din. */
const envelope = ({ action, id = 0, releaseType, dueDate, duration, creationDate, networkId }) => ({
  action,
  id: int(id),
  releaseType: releaseType || RELEASE_TYPE.MASTER,
  dueDate: isoDate(dueDate),
  creationDate: isoDate(creationDate),
  duration: String(duration ?? ''),
  networkID: int(networkId),
})

/* Khali release rokne ka paighaam — UI isi ko toast me dikhata hai. */
export const NO_CONTENT_MSG = 'Nothing to release — no activities, lesson plans, notebook plans or resource files are available.'

/**
 * Ek release bhejna (insert) ya mojooda badalna (update).
 *
 *   isMaster   true → releaseType 'Release', false → 'SubRelease'
 *   branchIds  jin schools ko ja raha hai (Master = sab, Sub = chune hue)
 *   items      child2 rows: { type, typeID, gradeID, subjectID }
 *   duration   validity days (server par string column hai)
 *
 * Wapas nayi (ya wahi) master id.
 */
export async function saveRelease(
  { id = 0, isMaster, dueDate, duration, creationDate, branchIds = [], items = [] },
  networkId = currentNetworkId(),
) {
  const nid = int(networkId)
  /* Khali release ka koi matlab nahi — schools ko kuch milta hi nahi, magar
     "Currently Live" me ek tile aa jati hai. UI pehle hi rok deta hai; ye
     aakhri parat hai taake kisi bhi raaste se contentless release na bane. */
  const rows = items.filter((it) => int(it.typeID) > 0)
  if (rows.length === 0) throw new Error(NO_CONTENT_MSG)
  const json = await manage({
    ...envelope({
      action: int(id) > 0 ? 'update' : 'insert',
      id,
      releaseType: isMaster ? RELEASE_TYPE.MASTER : RELEASE_TYPE.SUB,
      dueDate,
      duration,
      /* update par purani tareekh (fetchReleases se) wapas bhejo, warna
         server use aaj ki bana dega. insert par khali = aaj. */
      creationDate,
      networkId: nid,
    }),
    child1: [...new Set(branchIds.map(int).filter(Boolean))].map((branchID) => ({
      id: 0, branchID, networkID: nid,
    })),
    child2: rows.map((it) => ({
      id: 0,
      type: it.type,
      typeID: int(it.typeID),
      networkID: nid,
      gradeID: fk(it.gradeID),
      subjectID: fk(it.subjectID),
    })),
  })
  return int(json?.data?.id) || int(id)
}

/** Release wapas lena — master ke saath uske dono child set bhi jate hain. */
export function deleteRelease(id, { isMaster = true, dueDate, duration, creationDate } = {}, networkId = currentNetworkId()) {
  return manage(envelope({
    action: 'delete',
    id,
    releaseType: isMaster ? RELEASE_TYPE.MASTER : RELEASE_TYPE.SUB,
    dueDate,
    duration,
    creationDate,
    networkId,
  }))
}

const list = (v) => (Array.isArray(v) ? v : [])

/* ── Release ka APNA content ────────────────────────────────────────
   `get` sirf child2 ki ids nahi deta — us ke saath har release ka poora
   content bhi aata hai: Activity, LessonPlanMaster, NoteBookPlansMaster
   aur ResourceFile, har row par apna MasterID.

   Ye ASAL jawab hai ke "is release me kya gaya tha". Pehle screen ye baat
   dobara nikalti thi: release ki ids le kar Head Office ke MOJOODA index me
   se chhaanti thi. Jo cheez us index me na rahe (release hone ke baad wahan
   se nikal jaye, ya kisi aur wajah se na aaye) wo release ki tafseel me
   ZERO ban jati thi — "0 Activities" aur "2 released items are no longer
   available", halanke server par dono rows maujood thin. Ab wahi rows
   seedhi yahan se aati hain, is liye tafseel kabhi khali nahi hoti.

   Lesson/Notebook master rows PascalCase me aati hain (ID/ClassID/…), is
   liye alag mapper — lessonPlansApi ka masterRow sirf camelCase parhta hai. */
const relMaster = (r) => ({
  id: int(r.ID ?? r.id),
  classID: int(r.ClassID ?? r.classID),
  subjectID: int(r.SubjectID ?? r.subjectID),
  unitNo: r.UnitNumber ?? r.unitNo ?? '',
  unitName: r.UnitName ?? r.unitName ?? '',
  topic: r.LessonPlanTopic ?? r.lessonPlanTopic ?? '',
  medium: r.Medium ?? r.medium ?? '',
})

/* Child rows ko unke MasterID par jama karta hai. */
const groupByMaster = (arr) => {
  const m = new Map()
  list(arr).forEach((r) => {
    const k = int(r.MasterID ?? r.masterID)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  })
  return (id) => m.get(int(id)) || []
}

/**
 * Is network ke sab releases. `get` apni id nahi dekhta, is liye ek hi call
 * me poori list aa jati hai — har master ke saath uske branch aur content rows.
 */
export async function fetchReleases(networkId = currentNetworkId()) {
  const nid = int(networkId)
  if (!nid) return []
  const json = await manage(envelope({
    action: 'get',
    id: 0,
    releaseType: RELEASE_TYPE.MASTER,
    /* get par bhi ye teenon lazmi hain magar natije par asar nahi dalte. */
    dueDate: new Date().toISOString(),
    creationDate: new Date().toISOString(),
    duration: '0',
    networkId: nid,
  }))
  const d = json?.data || {}
  const branchesOf = groupByMaster(d.Child1)
  const itemsOf = groupByMaster(d.Child2Raw)
  /* Har release ka apna content — upar wali sharh dekhein. */
  const activitiesOf = groupByMaster(d.Activity)
  const lessonsOf = groupByMaster(d.LessonPlanMaster)
  const notebooksOf = groupByMaster(d.NoteBookPlansMaster)
  const resourcesOf = groupByMaster(d.ResourceFile)

  return list(d.Master).map((m) => {
    const id = int(m.ID ?? m.id)
    const items = itemsOf(id).map((r) => {
      const type = String(r.Type ?? r.type ?? '')
      return {
        rowId: int(r.ID ?? r.id),
        type,
        /* Milaan hamesha isi kunji par — kacchi `type` string purani ho ya
           nayi, dono is ek hi kunji par aa jati hain. */
        typeKey: childTypeKey(type),
        typeID: int(r.TypeID ?? r.typeID),
        gradeID: int(r.GradeID ?? r.gradeID),
        subjectID: int(r.SubjectID ?? r.subjectID),
      }
    })
    const countOf = (key) => items.filter((x) => x.typeKey === key).length
    /* Wahi shape jo releaseContent ke helpers (summarizeReleaseContent) parhte
       hain — is liye release ki tafseel bina kisi tarjuma ke ban jati hai. */
    const content = {
      activities: activitiesOf(id).map(mapActivity).filter((x) => x.id),
      lessons: lessonsOf(id).map(relMaster).filter((x) => x.id),
      notebooks: notebooksOf(id).map(relMaster).filter((x) => x.id),
      resources: resourcesOf(id).map(mapResource).filter((x) => x.id),
    }
    return {
      id,
      content,
      isMaster: String(m.ReleaseType ?? m.releaseType ?? '').toLowerCase() !== 'subrelease',
      releaseType: String(m.ReleaseType ?? m.releaseType ?? RELEASE_TYPE.MASTER),
      dueDate: String(m.DueDate ?? m.dueDate ?? '').slice(0, 10) || null,
      /* update par jyon ka tyon wapas jata hai — server is ke baghair 400 deta hai. */
      creationDate: String(m.CreationDate ?? m.creationDate ?? '') || null,
      duration: String(m.Duration ?? m.duration ?? ''),
      branchIds: branchesOf(id).map((r) => int(r.BranchID ?? r.branchID)).filter(Boolean),
      items,
      counts: {
        activities: countOf('activity'),
        notebooks: countOf('notebook'),
        lessons: countOf('lesson'),
        resources: countOf('resource'),
      },
    }
  })
}
