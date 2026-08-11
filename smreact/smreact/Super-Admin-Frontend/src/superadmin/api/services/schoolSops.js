/* ════════════════════════════════════════════════════════════════════
   Operational SOPs service — Manual Heads (screen par "Category").

     POST .../api/AHM_School_SOPs/manual-head
       body: { action, id, manualHeadName, description, isActive,
               totalManuals, createdBy, modifiedBy }

   Ek hi route, kaam `action` se tay hota hai:
     get    → saare manual heads         → { success, message, count, data: [...] }
     insert → naya head
     update → mojooda head (id ke saath)
     delete → head hatao (id ke saath)

   UI ka category shape { id, title, desc, status } hai, is liye mapping
   sirf `headToCategory()` me rakhi hai.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminIdentity, getSuperAdminToken } from '../config';
import EP from '../endpoints';

const userId = () => Number(getSuperAdminIdentity().userId) || 0;

/** API row → wohi category shape jo screen padhti hai. */
export function headToCategory(h) {
  return {
    id:      Number(h?.id) || 0,
    title:   String(h?.manualHeadName ?? h?.title ?? '').trim(),
    desc:    String(h?.description ?? '').trim(),
    status:  h?.isActive === false ? 'inactive' : 'active',
    /* API khud batati hai is head me kitne manuals hain — screen ka apna
       count sirf loaded manuals ka hota hai, is liye ye alag rakha. */
    totalManuals: Number(h?.totalManuals) || 0,
    raw: h,
  };
}

/* Har action ki poori body — backend saare fields expect karta hai. */
function body(action, { id = 0, title = '', desc = '', status = 'active', totalManuals = 0 } = {}) {
  const now = new Date().toISOString();
  return {
    action,
    id: Number(id) || 0,
    manualHeadName: title,
    description: desc,
    isActive: status !== 'inactive',
    totalManuals: Number(totalManuals) || 0,
    createdAt: now,
    createdBy: userId(),
    modifiedAt: now,
    modifiedBy: userId(),
  };
}

async function post(payload, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.sops.manualHead()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message)) || `Failed to ${label}`, res.status);
  }
  return json;
}

/** action: get → saare manual heads (mapped). */
export async function listManualHeads() {
  const json = await post(body('get'), 'load manual heads');
  const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  return rows.map(headToCategory).filter((c) => c.id);
}

/** action: insert | update — `id` ho to update, warna insert. */
export function saveManualHead(form, editId) {
  const isEdit = Number(editId) > 0;
  return post(
    body(isEdit ? 'update' : 'insert', { ...form, id: isEdit ? editId : 0 }),
    isEdit ? 'update manual head' : 'add manual head',
  );
}

/** action: delete */
export function deleteManualHead(id) {
  return post(body('delete', { id }), 'delete manual head');
}

/* ═══════════════════════ MANUAL DETAILS (manuals) ═══════════════════════
   POST .../api/AHM_School_SOPs/manual-detail — ye route JSON nahi,
   multipart/form-data leta hai (ManualPDF ek file field hai) aur field
   naam PascalCase hain. Wohi ek `Action`: get | insert | update | delete.

   `get` ke liye ManualHeadID laazmi hai (0 bhejne par API "Invalid Manual
   Head ID" deti hai) — yani manuals hamesha kisi ek head ke andar aate hain.
   ═══════════════════════════════════════════════════════════════════════ */

/* API row → wohi manual shape jo screen padhti hai (sopData jaisa). */
export function manualToUi(m) {
  return {
    id:       Number(m?.id) || 0,
    catId:    Number(m?.manualHeadID ?? m?.manualHeadId) || 0,
    code:     String(m?.manualCode ?? '').trim(),
    title:    String(m?.manualTitle ?? '').trim(),
    desc:     String(m?.shortDescription ?? '').trim(),
    /* pdfPath server par pada hua file path hai — screen `pdfName` par
       "PDF hai ya nahi" decide karti hai, is liye dono set karte hain. */
    pdfPath:  String(m?.pdfPath ?? ''),      // raw — edit par wapas jata hai
    pdfUrl:   sopFileUrl(m?.pdfPath),        // kholne ke liye
    pdfName:  fileNameFrom(m?.pdfPath),
    vidTitle: String(m?.videoTitle ?? '').trim(),
    vidUrl:   String(m?.youtubeURL ?? m?.youtubeUrl ?? '').trim(),
    vidDesc:  String(m?.videoDescription ?? '').trim(),
    vidStatus: m?.tutorialAvailable ? 'available' : 'coming_soon',
    status:   m?.isActive === false ? 'inactive' : 'active',
    createdAt: String(m?.createdAt ?? '').slice(0, 10),
    /* Embedded forms bhi wahi mapping se — naam na ho to file ka naam. */
    forms: (Array.isArray(m?.forms) ? m.forms : []).map(formToUi),
    raw: m,
  };
}

/* Har action ka multipart body — backend saare fields expect karta hai. */
function manualForm(action, m = {}) {
  const now = new Date().toISOString();
  const fd = new FormData();
  fd.append('Action', action);
  fd.append('ID', String(Number(m.id) || 0));
  fd.append('ManualHeadID', String(Number(m.catId) || 0));
  fd.append('ManualCode', m.code ?? '');
  fd.append('ManualTitle', m.title ?? '');
  fd.append('ShortDescription', m.desc ?? '');
  /* Nayi file chuni ho to wohi bhejo; warna purana path bhej kar file
     jaisi hai waisi rehne do (warna edit par PDF gum ho jata). */
  if (m.pdfFile instanceof File) fd.append('ManualPDF', m.pdfFile, m.pdfFile.name);
  fd.append('PDFPath', m.pdfPath ?? '');
  fd.append('VideoTitle', m.vidTitle ?? '');
  fd.append('YoutubeURL', m.vidUrl ?? '');
  fd.append('VideoDescription', m.vidDesc ?? '');
  fd.append('TutorialAvailable', String(m.vidStatus === 'available'));
  fd.append('IsActive', String(m.status !== 'inactive'));
  fd.append('CreatedAt', now);
  fd.append('CreatedBy', String(userId()));
  fd.append('ModifiedAt', now);
  fd.append('ModifiedBy', String(userId()));
  return fd;
}

async function postForm(fd, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.sops.manualDetail()}`, {
      method: 'POST',
      /* Content-Type jaan-boojh kar set NAHI karte — browser khud multipart
         boundary ke saath lagata hai. */
      headers: { accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message)) || `Failed to ${label}`, res.status);
  }
  return json;
}

/* Khali natija ghalti nahi hai.
   Jis head me abhi koi manual na ho, us par API 404 + success:false deti hai
   ("No manual details found."); yehi haal us manual ka hai jiski koi form na
   ho ("No forms found for the specified manual detail.") — dono live check
   kiye. Ye sirf khali halat hai, is liye screen ko error toast nahi, khali
   list milni chahiye. Baqi har nakaami waise hi upar jati hai. */
function isEmptyResult(err) {
  return err?.status === 404 || /no .*(found|records)/i.test(String(err?.message || ''));
}

/** action: get — ek manual head ke saare manuals (mapped). */
export async function listManuals(manualHeadId) {
  if (!Number(manualHeadId)) return [];
  let json;
  try {
    json = await postForm(manualForm('get', { catId: manualHeadId }), 'load manuals');
  } catch (err) {
    if (isEmptyResult(err)) return [];         // is head me abhi koi manual nahi
    throw err;
  }
  const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  return rows.map(manualToUi).filter((m) => m.id);
}

/**
 * Har head ke manuals ki ginti — sidebar ke badges aur "delete empty category"
 * guard ke liye. Screen ke paas sirf khuli hui head ke manuals hote hain, is
 * liye baqi heads ki ginti yahan se aati hai (sab calls parallel).
 * @returns {Promise<Object>} { [manualHeadId]: count }
 */
export async function listManualCounts(headIds = []) {
  const ids = [...new Set(headIds.map(Number).filter(Boolean))];
  const lists = await Promise.all(ids.map((id) => listManuals(id).catch(() => [])));
  const out = {};
  ids.forEach((id, i) => { out[id] = lists[i].length; });
  return out;
}

/** action: insert | update — `editId` ho to update. */
export function saveManual(form, editId) {
  const isEdit = Number(editId) > 0;
  return postForm(
    manualForm(isEdit ? 'update' : 'insert', { ...form, id: isEdit ? editId : 0 }),
    isEdit ? 'update manual' : 'add manual',
  );
}

/** action: delete */
export function deleteManual(id, manualHeadId) {
  return postForm(manualForm('delete', { id, catId: manualHeadId }), 'delete manual');
}

/* ═══════════════════════ MANUAL FORMS ═══════════════════════
   POST .../api/AHM_School_SOPs/manual-form — manual-detail ki tarah
   multipart/form-data (Document ek file field hai), PascalCase fields,
   aur wohi `Action`: get | insert | update | delete.

   Forms manual-detail ke `get` response me embedded bhi aati hain, is liye
   screen unhi se dikhti hai; ye route add/edit/delete ke liye hai (aur
   `listForms` un jagahon ke liye jahan sirf ek manual ki forms chahiye). */

/* Uploaded file (manual PDF / form document) ka chalne wala URL.

   API jo `pdfPath` / `formPath` deti hai us me application root CHHOOT jata
   hai — wo "http://<host>:4100/Manuals/Forms/x.pdf" bhejti hai, jab ke file
   asal me "http://<host>:4100/SchoolMentorSuperAdminAPI/Manuals/Forms/x.pdf"
   par milti hai (pehla 404, doosra 200 — dono live check kiye). Is liye path
   ka /Manuals/... hissa le kar usay SA root ke saath dobara jodte hain.

   SA_ADMIN_API_BASE khali ho (dev + production) to relative URL banta hai,
   jise setupProxy / IIS rewrite khud aage bhej dete hain — na CORS ka masla,
   na https par mixed-content ka. */
export function sopFileUrl(path) {
  const raw = String(path ?? '').trim();
  if (!raw) return '';
  if (/^data:|^blob:/i.test(raw)) return raw;
  let rel = raw;
  try { rel = new URL(raw).pathname; } catch { /* pehle se relative */ }
  /* Root ke baad wala hissa (agar path me pehle se root hai to double na lage). */
  const m = rel.match(/\/SchoolMentorSuperAdminAPI(\/.*)$/i) || rel.match(/(\/Manuals\/.*)$/i);
  const tail = m ? m[1] : (rel.startsWith('/') ? rel : `/${rel}`);
  return `${SA_ADMIN_API_BASE}/SchoolMentorSuperAdminAPI${tail}`;
}

/** URL/path ke aakhir se file ka naam (query string hata kar). */
export function fileNameFrom(path) {
  const p = String(path ?? '').split(/[?#]/)[0];
  try {
    /* Absolute URL ho to sirf pathname se naam lo (aur %20 waghera decode). */
    return decodeURIComponent(new URL(p).pathname.split('/').pop() || '');
  } catch {
    return decodeURIComponent(p.split(/[\\/]/).pop() || '');
  }
}

/** API form row → screen ka form shape.
   NOTE: `get` sirf id / manualDetailID / formPath deta hai — formName,
   formCode, reference, shortDescription is response me aate HI nahi.

   `title` bilkul wohi rehta hai jo server ne diya (khali bhi ho sakta hai) —
   Edit modal isi ko dikhata hai, warna Form Name me file ka naam bhar jata
   tha. List ke liye alag `displayTitle` hai jo khali hone par file ke naam
   par gir jata hai, taake row khali na lage. */
export function formToUi(f) {
  /* `formPath` bilkul wohi rakhte hain jo server ne diya (edit par yahi
     wapas jata hai), aur kholne ke liye alag `fileUrl` banate hain. */
  const formPath = String(f?.formPath ?? '');
  const fileName = fileNameFrom(formPath);
  const title = String(f?.formName ?? '').trim();
  return {
    id:       Number(f?.id) || 0,
    manualId: Number(f?.manualDetailID ?? f?.manualDetailId) || 0,
    title,                                   // raw — Edit modal isi ko bharta hai
    displayTitle: title || fileName || 'Untitled form',   // sirf list dikhane ke liye
    code:     String(f?.formCode ?? '').trim(),
    pageRef:  String(f?.reference ?? '').trim(),
    desc:     String(f?.shortDescription ?? '').trim(),
    formPath,
    fileUrl: sopFileUrl(formPath),          // browser me kholne ke liye
    fileName,
    raw: f,
  };
}

function formBody(action, f = {}) {
  const now = new Date().toISOString();
  const fd = new FormData();
  fd.append('Action', action);
  fd.append('ID', String(Number(f.id) || 0));
  fd.append('ManualDetailID', String(Number(f.manualId) || 0));
  fd.append('FormName', f.title ?? '');
  fd.append('FormCode', f.code ?? '');
  fd.append('Reference', f.pageRef ?? '');
  fd.append('ShortDescription', f.desc ?? '');
  /* Nayi file ho to bhejo; warna purana path bhej kar file waisi rehne do. */
  if (f.file instanceof File) fd.append('Document', f.file, f.file.name);
  fd.append('FormPath', f.formPath ?? '');
  fd.append('CreatedAt', now);
  fd.append('CreatedBy', String(userId()));
  fd.append('ModifiedAt', now);
  fd.append('ModifiedBy', String(userId()));
  return fd;
}

async function postFormRoute(fd, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.sops.manualForm()}`, {
      method: 'POST',
      headers: { accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message)) || `Failed to ${label}`, res.status);
  }
  return json;
}

/** action: get — ek manual ki saari forms. */
export async function listForms(manualDetailId) {
  if (!Number(manualDetailId)) return [];
  let json;
  try {
    json = await postFormRoute(formBody('get', { manualId: manualDetailId }), 'load forms');
  } catch (err) {
    if (isEmptyResult(err)) return [];         // is manual ki abhi koi form nahi
    throw err;
  }
  const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  return rows.map(formToUi).filter((f) => f.id);
}

/** action: insert | update — Upload / Save Changes. */
export function saveForm(manualId, form, editId) {
  const isEdit = Number(editId) > 0;
  return postFormRoute(
    formBody(isEdit ? 'update' : 'insert', { ...form, manualId, id: isEdit ? editId : 0 }),
    isEdit ? 'update form' : 'add form',
  );
}

/** action: delete */
export function deleteForm(id, manualId) {
  return postFormRoute(formBody('delete', { id, manualId }), 'delete form');
}

const schoolSopsService = {
  listManualHeads, saveManualHead, deleteManualHead, headToCategory,
  listManuals, listManualCounts, saveManual, deleteManual, manualToUi,
  listForms, saveForm, deleteForm, formToUi,
};
export default schoolSopsService;
