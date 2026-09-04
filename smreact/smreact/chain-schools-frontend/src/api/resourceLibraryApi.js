/* ═══════════════════════════════════════════════════════════════════
   RESOURCE LIBRARY — chain (head office) ke class/subject-wise PDF
   resources, sab networkID ki base par.

   Poora CRUD aik hi route par hai; kaam `Action` field se tay hota hai:

     POST /api/manage-resource-library   (multipart/form-data)
       Action: insert | update | delete | getbynetwork | getbybranch | getbyid

   Route JSON nahi, multipart leta hai (PdfFile file field hai) aur field
   naam PascalCase hain — bilkul Super-Admin ke manual-detail jaisa
   (dekhein src/api/sopsApi.js).

   ── Scoping: networkID vs branchID ──
   Wahi usool jo baqi Academics API modules me hai: school ki rows
   `branchID` se bandhi hoti hain aur chain (head office) ki rows
   `networkID` se. Is liye har call me:

       BranchID:  0  →  ye row kisi ek school ki nahi
       SectionID: 0  →  network level par sections hote hi nahi
       NetworkID     →  logged-in network

   aur parhne ke liye hamesha `getbynetwork`.

   ClassID/SubjectID par asli foreign keys hain (AHM_Branch_Grades aur
   subjects) — yaani wahi ids chalti hain jo LaunchSetup deta hai. Store ki
   `a.subjects` wali id NAAM se banti hai (dekhein academicsStore ka
   subjectIdOf) aur yahan nahi chalti; is liye screen dropdowns seedhe
   academicsSetupApi se bharti hai.

   ClassName/SubjectName bhejna parta hai magar list par server khud join
   kar ke deta hai — is liye card ko koi lookup nahi karna parta.

   ── Jo backend me hai hi nahi ──
   Table me status ka koi column nahi (Draft/Published/Hidden) — screen har
   row ko `published` dikhati hai (modal me status ka control waise bhi nahi
   tha). Upload date ka bhi column nahi, is liye card par date chip tab tak
   nahi aati jab tak API createdAt na dene lage. Aur `Category` free-text
   hai, is liye hum apni hi keys (worksheet | summer | qpaper | other)
   bhejte hain aur parhte waqt unhe wapas normalize kar lete hain.

   Baqi ERP calls ki tarah ye bhi axios client (src/api/client.js) se nahi
   jata: wo apna base rakhta hai aur 401 par logout kar deta hai.
   ═══════════════════════════════════════════════════════════════════ */

import { ERP_API_BASE, MEDIA_BASE } from '@/config/env'
import { getToken } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'
import { emitAcademicContentChanged } from './contentEvents'

const URL_ = `${ERP_API_BASE}/api/manage-resource-library`

export { currentNetworkId }

/* Network level par ye dono hamesha 0 jate hain — upar wali sharh dekhein. */
export const NETWORK_BRANCH_ID = 0
export const NETWORK_SECTION_ID = 0

/* ─────────────────────────── File ka URL ─────────────────────────── */

/* Jin folders se API uploads serve karti hai — PDF `/ResourceLibrary/` me
   jaati hai. Folder par match karna (sirf host par nahi) hi wo cheez hai jo
   har haal me chalti hai — chahe API ne IP stamp kiya ho, localhost, ya
   apna origin. */
const UPLOAD_FOLDERS = /\/(ResourceLibrary|Uploads|UploadedFiles|UploadedImages|UploadedDocuments|Resources)\/.*/i
const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?)$/i

/* DB me file ka RELATIVE path hota hai; API parhte waqt us par apna base URL
   chipka deti hai. Is liye update par poora URL wapas bhejna ghalat hai —
   backend usay dobara prefix kar deta hai aur path kharab ho jata hai:

     https://alphaapi.schoolmentor.aihttps://alphaapi.schoolmentor.ai/Resource…

   Screen isi liye raw absolute URL nahi, sirf storage path yaad rakhti hai
   aur wahi update me wapas bhejti hai. (Aisa doubled URL agar pehle se DB me
   pada ho to folder wala match usay bacha leta hai.) */
function storagePath(raw) {
  const u = String(raw ?? '').trim()
  if (!u || u.toUpperCase() === 'N/A') return ''
  const m = u.match(UPLOAD_FOLDERS)
  if (m) return m[0]
  try { return new URL(u).pathname } catch { return u.startsWith('/') ? u : `/${u}` }
}

/** Stored path/URL → browser me khulne wala URL. */
export function resourceFileUrl(raw) {
  const u = String(raw ?? '').trim()
  if (!u || u.toUpperCase() === 'N/A') return ''
  if (/^data:|^blob:/i.test(u)) return u          // abhi chuni hui local file
  const m = u.match(UPLOAD_FOLDERS)
  if (m) return `${MEDIA_BASE}${m[0]}`            // storage path media host se
  if (/^https?:\/\//i.test(u)) {
    /* Absolute URL jis ka host API ka apna hai (localhost/IP) — user ke
       browser me wo uska apna computer hai, wahan kuch nahi. Sirf path
       rakh kar media host par bhej do. */
    try {
      const p = new URL(u)
      if (LOOPBACK.test(p.hostname)) return `${MEDIA_BASE}${p.pathname}${p.search}`
    } catch { /* parse na ho to jaisa hai waisa hi */ }
    return u
  }
  return `${MEDIA_BASE}${u.startsWith('/') ? u : `/${u}`}`
}

/* Save par backend har file ke aage aik GUID laga deta hai taake naam takraye
   na — "…/ResourceLibrary/be245dce-…-400e0ab88946_t.pdf". Card par user ko
   uska apna naam dikhana hai, is liye ye prefix kaat dete hain. */
const GUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i

/** Path/URL ke aakhir se file ka (user wala) naam. */
export function fileNameFrom(path) {
  const p = String(path ?? '').split(/[?#]/)[0]
  let name
  try {
    name = decodeURIComponent(new URL(p).pathname.split('/').pop() || '')
  } catch {
    name = decodeURIComponent(p.split(/[\\/]/).pop() || '')
  }
  return name.replace(GUID_PREFIX, '')
}

/* ─────────────────────────── Shape badalna ─────────────────────────── */

const CATEGORY_KEYS = ['worksheet', 'summer', 'qpaper', 'other']

/* Category column free-text hai. Hum apni key bhejte hain, magar purana ya
   haath se dala hua data label ki shakal me bhi ho sakta hai — is liye
   parhte waqt dono suraton ko normalize karte hain. */
const CATEGORY_ALIASES = {
  worksheet: 'worksheet', worksheets: 'worksheet',
  summer: 'summer', 'summer vacation work': 'summer', summervacationwork: 'summer',
  qpaper: 'qpaper', 'question paper': 'qpaper', 'question papers': 'qpaper', questionpaper: 'qpaper',
  other: 'other', others: 'other',
}
export function normalizeCategory(v) {
  const k = String(v ?? '').trim().toLowerCase()
  if (!k) return 'other'
  if (CATEGORY_KEYS.includes(k)) return k
  return CATEGORY_ALIASES[k] || CATEGORY_ALIASES[k.replace(/[\s_-]+/g, '')] || 'other'
}

/* Response ki casing tay nahi (kuch raste camelCase dete hain, kuch
   PascalCase) — is liye har field defensively padhi jati hai. */
const pick = (r, ...keys) => {
  for (const k of keys) {
    const v = r?.[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

const num = (v) => Number(v) || 0
const str = (v) => String(v ?? '').trim()

/* Screen date-only ('2026-06-10') se kaam karti hai jabke API poora ISO
   deti hai. Pehle 10 characters kaatna timezone se mehfooz hai —
   `new Date(...)` local time me din shift kar sakta hai. */
const toDateOnly = (v) => {
  if (!v) return ''
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  if (m) return m[1]
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** API row → wahi shape jo Resource Library screen padhti hai. */
export function mapResource(r = {}) {
  const raw = str(pick(r, 'uploadedPDF', 'UploadedPDF', 'uploadedPdf', 'uploadedPDFPath', 'pdfPath', 'PDFPath'))
  const filePath = storagePath(raw)
  return {
    id: num(pick(r, 'id', 'ID', 'Id', 'resourceID', 'resourceId', 'resourceLibraryID')),
    classId: num(pick(r, 'classID', 'ClassID', 'classId', 'gradeID')),
    subjectId: num(pick(r, 'subjectID', 'SubjectID', 'subjectId')),
    sectionId: num(pick(r, 'sectionID', 'SectionID', 'sectionId')),
    clsName: str(pick(r, 'className', 'ClassName')),
    subName: str(pick(r, 'subjectName', 'SubjectName')),
    secName: str(pick(r, 'sectionName', 'SectionName')),
    category: normalizeCategory(pick(r, 'category', 'Category')),
    title: str(pick(r, 'resourceTitle', 'ResourceTitle', 'title')),
    desc: str(pick(r, 'resourceDescription', 'ResourceDescription', 'description')),
    filePath,                             // storage path — edit par wapas jata hai
    fileUrl: resourceFileUrl(raw),        // kholne ke liye
    fileName: fileNameFrom(filePath),
    /* Table me upload ki tareekh ka column nahi — jab tak API ye field nahi
       deti, card par date chip nahi aati. */
    uploadDate: toDateOnly(pick(r, 'createdAt', 'CreatedAt', 'createdDate', 'CreatedDate', 'modifiedAt', 'ModifiedAt')),
    /* Backend me status ka column nahi — screen har row ko published dikhati
       hai (upar wali sharh dekhein). */
    status: 'published',
  }
}

/* ─────────────────────────── Call ─────────────────────────── */

/* Multipart POST — Content-Type khud set NAHI karte, browser boundary ke
   saath lagata hai. Token phir bhi lagta hai (baqi ERP raston ki tarah). */
async function postForm(fd, label) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Accept: '*/*', Authorization: `bearer ${getToken() || ''}` },
    body: fd,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    if (res.status === 401) throw new Error('Session expired — sign in again from the ERP.')
    const err = new Error(json?.message || json?.title || `Could not ${label}`)
    err.status = res.status
    throw err
  }
  return json
}

const rows = (json) => (Array.isArray(json?.data) ? json.data : [])

/* Har call saare fields bhejti hai — backend inhi naamon par padhta hai. */
function form(action, r = {}, networkId = currentNetworkId()) {
  const fd = new FormData()
  fd.append('Action', action)
  fd.append('ID', String(num(r.id)))
  fd.append('BranchID', String(NETWORK_BRANCH_ID))
  fd.append('NetworkID', String(num(networkId)))
  fd.append('ClassID', String(num(r.classId)))
  fd.append('SubjectID', String(num(r.subjectId)))
  fd.append('SectionID', String(NETWORK_SECTION_ID))
  fd.append('Category', r.category ?? '')
  fd.append('ResourceTitle', r.title ?? '')
  fd.append('ResourceDescription', r.desc ?? '')
  /* Nayi file chuni ho to wahi bhejo; warna purana path bhej kar file jaisi
     hai waisi rehne do (warna edit par PDF gum ho jata hai). */
  if (r.pdfFile instanceof File) fd.append('PdfFile', r.pdfFile, r.pdfFile.name)
  fd.append('UploadedPDF', r.filePath ?? '')
  fd.append('ClassName', r.clsName ?? '')
  fd.append('SubjectName', r.subName ?? '')
  fd.append('SectionName', r.secName ?? '')
  return fd
}

/* Update/delete ke liye asli backend id chahiye. Backend ka ID Int32 hai —
   koi local/fake id (jaise Date.now() ≈ 1.7e12) us me fit nahi hota. */
const realId = (id) => {
  const n = Number(id)
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0
}

/* ─────────────────────────── Parhna ─────────────────────────── */

/** Is network ke saare resources (naye pehle). */
export async function fetchNetworkResources(networkId = currentNetworkId()) {
  if (!networkId) return []
  const json = await postForm(form('getbynetwork', {}, networkId), 'load resources')
  return rows(json)
    .map(mapResource)
    .filter((r) => r.id)
    .sort((x, y) => y.id - x.id)
}

/* ─────────────────────────── Likhna ─────────────────────────── */

/**
 * Naya resource ya mojooda ki tarmeem. `r.id` khali/0 = insert.
 * `r.pdfFile` File ho to nayi PDF chadhti hai, warna `r.filePath` wali
 * purani file jaisi hai waisi rehti hai.
 */
export async function saveNetworkResource(r, networkId = currentNetworkId()) {
  const id = realId(r.id)
  if (r.id && !id) throw new Error('Please refresh the resource list, then edit again.')
  const json = await postForm(
    form(id ? 'update' : 'insert', { ...r, id }, networkId),
    id ? 'update this resource' : 'upload this resource',
  )
  emitAcademicContentChanged('resource')
  return realId(json?.data?.id ?? json?.data?.ID ?? json?.data ?? json?.id) || id
}

/** Resource hatana — wahi route, sirf Action: 'delete'. */
export async function deleteNetworkResource(r, networkId = currentNetworkId()) {
  const id = realId(r?.id ?? r)
  if (!id) throw new Error('Please refresh the resource list, then delete again.')
  await postForm(form('delete', { ...(typeof r === 'object' ? r : {}), id }, networkId), 'delete this resource')
  emitAcademicContentChanged('resource')
}
