/* ═══════════════════════════════════════════════════════════════════
   OPERATIONAL SOPs — Manual Heads (screen par "Manual Head" / category).

     POST {sa}/api/AHM_School_SOPs/manual-head
       body: { action, id, manualHeadName, description, isActive, type,
               totalManuals, createdBy, modifiedBy }

   Aik hi route, kaam `action` se tay hota hai:
     get | insert | update | delete

   KHABARDAR: API ka error message jhoota hai. Wo kehta hai "Valid actions:
   add, update, delete, get, stats", magar `add` bhejne par yahi route
   "Unknown action 'add'" deta hai — naya record sirf `insert` se banta hai.
   (manual-form par bhi yahi haal: message me `add`, chalta `insert` hai.)

   `manualHeadName` har call me lazmi hai — get par bhi khali chalega magar
   field bheja zaroor jaata hai, warna API 400 deti hai.

   Chain portal hamesha `type: "chain"` bhejta hai, taake ye heads sirf isi
   portal ke rahein.

   Baqi Super-Admin calls ki tarah ye bhi axios client se nahi jaati.
   ═══════════════════════════════════════════════════════════════════ */

import { SUPERADMIN_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'

const HEAD_URL = `${SUPERADMIN_API_BASE}/api/AHM_School_SOPs/manual-head`
const DETAIL_URL = `${SUPERADMIN_API_BASE}/api/AHM_School_SOPs/manual-detail`
const FORM_URL = `${SUPERADMIN_API_BASE}/api/AHM_School_SOPs/manual-form`

const userId = () => {
  const u = getStoredUser()
  return Number(u?.id ?? u?.userID ?? u?.userId) || 0
}

/** API row → wohi category shape jo screen padhti hai. */
export function headToCategory(h) {
  return {
    id:     Number(h?.id) || 0,
    title:  String(h?.manualHeadName ?? '').trim(),
    desc:   String(h?.description ?? '').trim(),
    status: h?.isActive === false ? 'inactive' : 'active',
    /* Head ke sath uske manuals ki ginti aati hai — is se chip ka count aur
       "Total Manuals" bina har head ka data load kiye ban jaate hain. */
    totalManuals: Number(h?.totalManuals) || 0,
  }
}

function body(action, { id = 0, title = '', desc = '', status = 'active', totalManuals = 0 } = {}) {
  return {
    action,
    id: Number(id) || 0,
    manualHeadName: title,
    description: desc,
    isActive: status !== 'inactive',
    type: 'chain',
    totalManuals: Number(totalManuals) || 0,
    createdBy: userId(),
    modifiedBy: userId(),
  }
}

async function post(payload, label) {
  const res = await fetch(HEAD_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    /* 400 par API field-wise errors deti hai — pehla wala dikha dete hain. */
    const fieldErr = json?.errors && Object.values(json.errors).flat()[0]
    throw new Error(json?.message || fieldErr || json?.title || `Could not ${label}`)
  }
  return json
}

/** action: get → saare manual heads (mapped). */
export async function listManualHeads() {
  const json = await post(body('get'), 'load manual heads')
  const rows = Array.isArray(json?.data) ? json.data : []
  return rows.map(headToCategory).filter((c) => c.id)
}

/** action: insert | update — `id` ho to update, warna insert. */
export function saveManualHead(form, editId) {
  const isEdit = Number(editId) > 0
  return post(
    body(isEdit ? 'update' : 'insert', { ...form, id: isEdit ? editId : 0 }),
    isEdit ? 'update this manual head' : 'add this manual head',
  )
}

/** action: delete */
export function deleteManualHead(id) {
  return post(body('delete', { id }), 'delete this manual head')
}

/* ═══════════════ MANUAL DETAILS (screen par "Manual") ═══════════════
   POST {sa}/api/AHM_School_SOPs/manual-detail — ye route JSON nahi,
   multipart/form-data leta hai (ManualPDF file field hai) aur field naam
   PascalCase hain. Wahi chaar actions: get | insert | update | delete.

   `get` par ManualHeadID lazmi hai — manuals hamesha kisi aik head ke andar
   hote hain. Jis head me abhi koi manual na ho us par API success:false +
   "No manual details found." deti hai; ye khali haalat hai, ghalti nahi.
   ═══════════════════════════════════════════════════════════════════ */

/* Uploaded file (manual PDF / form document) ka chalne wala URL.
   API path me application root chhoot jaata hai, is liye /Manuals/... wala
   hissa le kar usay Super-Admin root ke saath dobara jorte hain. */
export function sopFileUrl(path) {
  const raw = String(path ?? '').trim()
  if (!raw) return ''
  if (/^data:|^blob:/i.test(raw)) return raw
  let rel = raw
  try { rel = new URL(raw).pathname } catch { /* pehle se relative */ }
  const m = rel.match(/\/SchoolMentorSuperAdminAPI(\/.*)$/i) || rel.match(/(\/Manuals\/.*)$/i)
  const tail = m ? m[1] : (rel.startsWith('/') ? rel : `/${rel}`)
  return `${SUPERADMIN_API_BASE}${tail}`
}

/** Path/URL ke aakhir se file ka naam. */
export function fileNameFrom(path) {
  const p = String(path ?? '').split(/[?#]/)[0]
  try {
    return decodeURIComponent(new URL(p).pathname.split('/').pop() || '')
  } catch {
    return decodeURIComponent(p.split(/[\\/]/).pop() || '')
  }
}

/** API row → wahi manual shape jo screen padhti hai. */
export function manualToUi(m) {
  const pdfPath = String(m?.pdfPath ?? '')
  return {
    id:        Number(m?.id) || 0,
    catId:     Number(m?.manualHeadID ?? m?.manualHeadId) || 0,
    code:      String(m?.manualCode ?? '').trim(),
    title:     String(m?.manualTitle ?? '').trim(),
    desc:      String(m?.shortDescription ?? '').trim(),
    pdfPath,                                 // raw — edit par wapas jaata hai
    pdfUrl:    sopFileUrl(pdfPath),          // kholne ke liye
    pdfName:   fileNameFrom(pdfPath),
    vidTitle:  String(m?.videoTitle ?? '').trim(),
    vidUrl:    String(m?.youtubeURL ?? m?.youtubeUrl ?? '').trim(),
    vidDesc:   String(m?.videoDescription ?? '').trim(),
    vidStatus: m?.tutorialAvailable ? 'available' : 'coming_soon',
    status:    m?.isActive === false ? 'inactive' : 'active',
    createdAt: String(m?.createdAt ?? '').slice(0, 10),
    forms:     (Array.isArray(m?.forms) ? m.forms : []).map(formToUi),
  }
}

/* Har action ka multipart body — backend saare fields expect karta hai. */
function manualForm(action, m = {}) {
  const now = new Date().toISOString()
  const fd = new FormData()
  fd.append('Action', action)
  fd.append('ID', String(Number(m.id) || 0))
  /* Delete/update ka lookup manual detail ki apni id par hota hai — API use
     `ManualDetailID` par bhi padhti hai, is liye dono naam bhejte hain. */
  fd.append('ManualDetailID', String(Number(m.id) || 0))
  fd.append('ManualHeadID', String(Number(m.catId) || 0))
  fd.append('ManualCode', m.code ?? '')
  fd.append('ManualTitle', m.title ?? '')
  fd.append('ShortDescription', m.desc ?? '')
  /* Nayi file chuni ho to wahi bhejo; warna purana path bhej kar file jaisi
     hai waisi rehne do (warna edit par PDF gum ho jaata hai). */
  if (m.pdfFile instanceof File) fd.append('ManualPDF', m.pdfFile, m.pdfFile.name)
  fd.append('PDFPath', m.pdfPath ?? '')
  fd.append('VideoTitle', m.vidTitle ?? '')
  fd.append('YoutubeURL', m.vidUrl ?? '')
  fd.append('VideoDescription', m.vidDesc ?? '')
  fd.append('TutorialAvailable', String(m.vidStatus === 'available'))
  fd.append('IsActive', String(m.status !== 'inactive'))
  fd.append('Type', 'chain')
  fd.append('CreatedAt', now)
  fd.append('CreatedBy', String(userId()))
  fd.append('ModifiedAt', now)
  fd.append('ModifiedBy', String(userId()))
  return fd
}

/* Multipart POST — Content-Type khud set NAHI karte, browser boundary ke
   saath lagata hai. */
async function postForm(url, fd, label) {
  const res = await fetch(url, { method: 'POST', headers: { Accept: '*/*' }, body: fd })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    const err = new Error(json?.message || json?.title || `Could not ${label}`)
    err.status = res.status
    throw err
  }
  return json
}

/* Khali natija ghalti nahi hai: jis head me koi manual na ho (ya jis manual
   ki koi form na ho) API "No … found." ke saath success:false deti hai. */
function isEmptyResult(err) {
  return err?.status === 404 || /no .*(found|records)/i.test(String(err?.message || ''))
}

/** action: get — aik manual head ke saare manuals. */
export async function listManuals(manualHeadId) {
  if (!Number(manualHeadId)) return []
  let json
  try {
    json = await postForm(DETAIL_URL, manualForm('get', { catId: manualHeadId }), 'load manuals')
  } catch (err) {
    if (isEmptyResult(err)) return []
    throw err
  }
  const rows = Array.isArray(json?.data) ? json.data : []
  /* Forms yahan se nahi aatin (manual-detail ka `get` unhe embed nahi karta)
     — screen har manual ki forms alag se, khulne par mangwati hai. */
  return rows.map(manualToUi).filter((m) => m.id)
}

/** action: insert | update — `editId` ho to update. */
export function saveManual(form, editId) {
  const isEdit = Number(editId) > 0
  return postForm(
    DETAIL_URL,
    manualForm(isEdit ? 'update' : 'insert', { ...form, id: isEdit ? editId : 0 }),
    isEdit ? 'update this manual' : 'add this manual',
  )
}

/** action: delete */
export function deleteManual(id, manualHeadId) {
  return postForm(DETAIL_URL, manualForm('delete', { id, catId: manualHeadId }), 'delete this manual')
}

/* ═══════════════ MANUAL FORMS (manual ke sath lagi forms) ═══════════════
   POST {sa}/api/AHM_School_SOPs/manual-form — manual-detail jaisa hi
   multipart route (Document file field), wahi chaar actions.

   Forms manual-detail ke `get` me embedded bhi aati hain, is liye list wahin
   se banti hai; ye route add/edit/delete ke liye hai.
   ═══════════════════════════════════════════════════════════════════ */

/** API form row → screen ka form shape. */
export function formToUi(f) {
  const formPath = String(f?.formPath ?? '')
  const fileName = fileNameFrom(formPath)
  const title = String(f?.formName ?? '').trim()
  return {
    id:       Number(f?.id) || 0,
    manualId: Number(f?.manualDetailID ?? f?.manualDetailId) || 0,
    title,
    /* `get` par formName khali bhi aa sakta hai — list me row khali na lage,
       is liye file ka naam fallback. */
    displayTitle: title || fileName || 'Untitled form',
    code:     String(f?.formCode ?? '').trim(),
    pageRef:  String(f?.reference ?? '').trim(),
    desc:     String(f?.shortDescription ?? '').trim(),
    formPath,
    fileUrl:  sopFileUrl(formPath),
    fileName,
  }
}

function formBody(action, f = {}) {
  const now = new Date().toISOString()
  const fd = new FormData()
  fd.append('Action', action)
  fd.append('ID', String(Number(f.id) || 0))
  fd.append('ManualDetailID', String(Number(f.manualId) || 0))
  fd.append('FormName', f.title ?? '')
  fd.append('FormCode', f.code ?? '')
  fd.append('Reference', f.pageRef ?? '')
  fd.append('ShortDescription', f.desc ?? '')
  if (f.file instanceof File) fd.append('Document', f.file, f.file.name)
  fd.append('FormPath', f.formPath ?? '')
  fd.append('Type', 'chain')
  fd.append('CreatedAt', now)
  fd.append('CreatedBy', String(userId()))
  fd.append('ModifiedAt', now)
  fd.append('ModifiedBy', String(userId()))
  return fd
}

/** action: get — aik manual ki saari forms. ManualDetailID lazmi hai (0 par
    API "Invalid Manual Detail ID." deti hai). */
export async function listForms(manualDetailId) {
  if (!Number(manualDetailId)) return []
  let json
  try {
    json = await postForm(FORM_URL, formBody('get', { manualId: manualDetailId }), 'load forms')
  } catch (err) {
    if (isEmptyResult(err)) return []
    throw err
  }
  const rows = Array.isArray(json?.data) ? json.data : []
  return rows.map(formToUi).filter((f) => f.id)
}

/** action: insert | update — `editId` ho to update. */
export function saveManualFormDoc(form, editId) {
  const isEdit = Number(editId) > 0
  return postForm(
    FORM_URL,
    formBody(isEdit ? 'update' : 'insert', { ...form, id: isEdit ? editId : 0 }),
    isEdit ? 'update this form' : 'add this form',
  )
}

/** action: delete */
export function deleteManualFormDoc(id, manualId) {
  return postForm(FORM_URL, formBody('delete', { id, manualId }), 'delete this form')
}
