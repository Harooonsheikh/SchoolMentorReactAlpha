/* ═══════════════════════════════════════════════════════════════════
   RELEASE CONTENT INDEX — jo kuch is network me bana hua hai aur
   release ho sakta hai, ek jagah.

   Release ka child2 sirf ASLI server ids par chalta hai (typeID, aur
   FK wali gradeID/subjectID — dekhein releaseApi.js). Wo ids sirf usi
   API ke paas hain jis ne content banaya tha, is liye chaaron section
   apne apne live endpoint se yahan aate hain:

     Activity Calendar      → activityCalendarApi   (class/subject hoti hi nahi)
     Classwork Lesson Plans → ULP class master rows  (har row = ek lesson)
     Notebook Lesson Plans  → ULP notebook master rows
     Resource Library       → manage-resource-library

   Classes/subjects ke naam LaunchSetup se aate hain — store ki
   `a.subjects` naam se bani hui id rakhti hai jo API par nahi chalti.
   ═══════════════════════════════════════════════════════════════════ */

import { currentNetworkId } from './networkSchoolsApi'
import { fetchNetworkActivities } from './activityCalendarApi'
import { fetchAllNetworkLessonMasters, fetchAllNetworkNotebookMasters } from './lessonPlansApi'
import { fetchNetworkResources } from './resourceLibraryApi'
import { fetchNetworkAcademics } from './academicsSetupApi'
import { CHILD_TYPE } from './releaseApi'

export const EMPTY_CONTENT = {
  activities: [], lessons: [], notebooks: [], resources: [], classes: [], subjects: [],
}

/**
 * Poore network ka releasable content. Har section apni alag call par hai —
 * ek section ka API gir jaye to baqi phir bhi release ho sakein, is liye har
 * ek ka apna catch hai (khali list).
 */
export async function fetchReleaseContent(networkId = currentNetworkId()) {
  if (!networkId) return { ...EMPTY_CONTENT }
  const [activities, lessons, notebooks, resources, setup] = await Promise.all([
    fetchNetworkActivities(networkId).catch(() => []),
    fetchAllNetworkLessonMasters(networkId).catch(() => []),
    fetchAllNetworkNotebookMasters(networkId).catch(() => []),
    fetchNetworkResources(networkId).catch(() => []),
    fetchNetworkAcademics(networkId).catch(() => ({ classes: [], subjectRows: [] })),
  ])
  return {
    activities,
    lessons,
    notebooks,
    resources: resources.filter((r) => r.id),
    classes: setup.classes || [],
    subjects: setup.subjectRows || [],
  }
}

/**
 * Poore index me se sirf wo content jo `pick` me hai.
 *
 * `pick` ek purane release ki id-lists hoti hain (activities / lessons /
 * notebooks / resources). Sub Release "kisi purane release me se" banaya ja
 * sakta hai — us soorat me modal ki ginti aur child2 ka payload DONO isi
 * chhaant par bante hain, is liye jo dikhta hai wahi jata hai.
 * `pick` na ho to poora index (= Current Draft, sab kuch).
 */
export function filterReleaseContent(content = EMPTY_CONTENT, pick) {
  if (!pick) return content
  const has = (set, id) => !set || set.has(Number(id))
  return {
    ...content,
    activities: content.activities.filter((x) => has(pick.activities, x.id)),
    lessons: content.lessons.filter((x) => has(pick.lessons, x.id)),
    notebooks: content.notebooks.filter((x) => has(pick.notebooks, x.id)),
    resources: content.resources.filter((x) => has(pick.resources, x.id)),
  }
}

/** Ek purane release ki id-lists → `filterReleaseContent` ka `pick`. */
export function idSetsOf(release) {
  if (!release) return null
  const set = (v) => new Set((v || []).map(Number))
  return {
    activities: set(release.activityIds),
    lessons: set(release.lessonPlanIds),
    notebooks: set(release.notebookPlanIds),
    resources: set(release.resourceLibraryIds),
  }
}

/**
 * Content index → manage-release ka child2.
 *
 * Activity Calendar ki koi class/subject hoti hi nahi, aur gradeID/subjectID
 * par FK lagi hai — is liye un rows me dono 0 jate hain, jinhein releaseApi
 * NULL bana deta hai (0 bhejna poora insert fail kar deta hai).
 */
export function releaseItemsOf(content = EMPTY_CONTENT) {
  return [
    ...content.activities.map((x) => ({
      type: CHILD_TYPE.activity, typeID: x.id, gradeID: 0, subjectID: 0,
    })),
    ...content.lessons.map((x) => ({
      type: CHILD_TYPE.lesson, typeID: x.id, gradeID: x.classID, subjectID: x.subjectID,
    })),
    ...content.notebooks.map((x) => ({
      type: CHILD_TYPE.notebook, typeID: x.id, gradeID: x.classID, subjectID: x.subjectID,
    })),
    ...content.resources.map((x) => ({
      type: CHILD_TYPE.resource, typeID: x.id, gradeID: x.classId, subjectID: x.subjectId,
    })),
  ].filter((it) => it.typeID > 0)
}

/**
 * Release modal / Release Control ka summary — wahi shape jo screen pehle
 * store se banati thi, magar ab ASLI server content par:
 *   { totals, classes: [{ classId, name, lessons, notebooks, resourcesTotal, … }] }
 */
export function summarizeReleaseContent(content = EMPTY_CONTENT) {
  const subjName = new Map(content.subjects.map((s) => [Number(s.id), s.name]))
  const byClass = new Map()
  const bucket = (classId) => {
    const key = Number(classId) || 0
    if (!byClass.has(key)) {
      byClass.set(key, {
        classId: key,
        name: content.classes.find((c) => c.id === key)?.name || `Class #${key}`,
        lessons: 0, notebooks: 0, resourcesTotal: 0,
        lessonsBySubj: {}, notebooksBySubj: {}, resByCat: {},
      })
    }
    return byClass.get(key)
  }
  const bump = (row, key, subjectId) => {
    row[key] += 1
    const map = key === 'lessons' ? row.lessonsBySubj : row.notebooksBySubj
    const sid = Number(subjectId) || 0
    map[sid] = (map[sid] || 0) + 1
  }

  content.lessons.forEach((x) => bump(bucket(x.classID), 'lessons', x.subjectID))
  content.notebooks.forEach((x) => bump(bucket(x.classID), 'notebooks', x.subjectID))
  content.resources.forEach((x) => {
    const row = bucket(x.classId)
    row.resourcesTotal += 1
    const cat = x.category || 'other'
    row.resByCat[cat] = (row.resByCat[cat] || 0) + 1
  })

  const classes = [...byClass.values()]
    .map((c) => ({ ...c, total: c.lessons + c.notebooks + c.resourcesTotal }))
    .filter((c) => c.classId && c.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  const activities = content.activities.length
  return {
    classes,
    subjectName: (id) => subjName.get(Number(id)) || `Subject #${id}`,
    totals: {
      classes: classes.length,
      lessons: classes.reduce((n, c) => n + c.lessons, 0),
      notebooks: classes.reduce((n, c) => n + c.notebooks, 0),
      resourceFiles: classes.reduce((n, c) => n + c.resourcesTotal, 0),
      activities,
    },
    general: { activities },
  }
}
