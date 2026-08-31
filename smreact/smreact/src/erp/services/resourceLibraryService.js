import { buildUrl, resolveMediaUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   RESOURCE LIBRARY — school ke apne class/subject-wise PDF resources,
   sab branchID ki base par.

   Poora CRUD aik hi route par hai; kaam `Action` field se tay hota hai:

     POST /api/manage-resource-library   (multipart/form-data)
       Action: insert | update | delete | getbybranch | getbynetwork | getbyid

   Route JSON nahi, multipart leta hai (PdfFile file field hai) aur field
   naam PascalCase hain.

   ── Scoping: branchID vs networkID ──
   Yehi table chain portal bhi use karta hai (dekhein chain-schools-frontend
   ka src/api/resourceLibraryApi.js), farq sirf scope ka hai:

       school (yahan) → BranchID = logged-in branch, NetworkID = 0
       chain          → NetworkID = network,         BranchID = 0

   aur parhne ke liye yahan hamesha `getbybranch`. Server 0 ko null rakh
   deta hai, is liye dono taraf ki rows aapas me nahi milti — branch 1 ki
   list me sirf branch 1 ki rows aati hain.

   ClassID / SubjectID / SectionID par asli foreign keys hain — wahi ids
   chalti hain jo LaunchSetup deta hai:
     /api/LaunchSetup/get-grades-by-branch/{branchId}   → grade.id + sections
     /api/LaunchSetup/get-subjects/{gradeId}/{sectionId} → subjectID

   ClassName/SectionName/SubjectName bhejne parte hain, magar list par
   server khud join kar ke deta hai — card ko koi lookup nahi karna parta.

   ── Jo backend me hai hi nahi ──
   Table me upload ki tareekh ka column nahi, is liye card par date tab tak
   nahi aati jab tak API createdAt na dene lage. `Category` free-text hai,
   is liye hum apni hi keys (worksheet | summer | qpaper | other) bhejte
   hain aur parhte waqt unhe wapas normalize kar lete hain.
   ═══════════════════════════════════════════════════════════════════ */

const URL_ = () => buildUrl('/api/manage-resource-library');

/** Logged-in school ki branch — har call isi ke against jati hai. */
export const currentBranchId = () => Number(sessionStorage.getItem('branchID')) || 0;

/* School level par network ka koi taalluq nahi — hamesha 0 (server null
   rakh deta hai, aur NetworkID par FK sirf non-zero par lagti hai). */
const BRANCH_NETWORK_ID = 0;

/* ─────────────────────────── File ka URL ─────────────────────────── */

/* PDF `/ResourceLibrary/` me jati hai. Folder par match karna (sirf host par
   nahi) hi wo cheez hai jo har haal me chalti hai — chahe API ne IP stamp
   kiya ho, localhost, ya apna origin. */
const UPLOAD_FOLDERS = /\/(ResourceLibrary|Uploads|UploadedFiles|UploadedImages|UploadedDocuments)\/.*/i;

/* DB me file ka RELATIVE path hota hai; API parhte waqt us par apna base URL
   chipka deti hai. Is liye update par poora URL wapas bhejna ghalat hai —
   backend usay dobara prefix kar deta hai aur path kharab ho jata hai:

     https://alphaapi.schoolmentor.aihttps://alphaapi.schoolmentor.ai/Resour…

   Screen isi liye raw absolute URL nahi, sirf storage path yaad rakhti hai
   aur wahi update me wapas bhejti hai. (Aisa doubled URL agar pehle se DB me
   pada ho to folder wala match usay bacha leta hai.) */
function storagePath(raw) {
  const u = String(raw ?? '').trim();
  if (!u || u.toUpperCase() === 'N/A') return '';
  const m = u.match(UPLOAD_FOLDERS);
  if (m) return m[0];
  try { return new URL(u).pathname; } catch { return u.startsWith('/') ? u : `/${u}`; }
}

/* Stamped host kabhi bhi kaam ka nahi hota (wo API ka apna host hai —
   aksar localhost proxy ke peeche), is liye baqi uploads ki tarah ye bhi
   resolveMediaUrl se guzarta hai. */
export const resourceFileUrl = (raw) => resolveMediaUrl(storagePath(raw));

/* Save par backend har file ke aage aik GUID laga deta hai taake naam
   takraye na — "…/ResourceLibrary/be245dce-…-400e0ab88946_t.pdf". Card par
   user ko uska apna naam dikhana hai, is liye ye prefix kaat dete hain. */
const GUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i;

/** Path/URL ke aakhir se file ka (user wala) naam. */
export function fileNameFrom(path) {
  const p = String(path ?? '').split(/[?#]/)[0];
  let name;
  try { name = decodeURIComponent(new URL(p).pathname.split('/').pop() || ''); }
  catch { name = decodeURIComponent(p.split(/[\\/]/).pop() || ''); }
  return name.replace(GUID_PREFIX, '');
}

/* ─────────────────────────── Shape badalna ─────────────────────────── */

const CATEGORY_KEYS = ['worksheet', 'summer', 'qpaper', 'other'];

/* Category column free-text hai. Hum apni key bhejte hain, magar purana ya
   haath se dala hua data label ki shakal me bhi ho sakta hai — is liye
   parhte waqt dono suraton ko normalize karte hain. */
const CATEGORY_ALIASES = {
  worksheet: 'worksheet', worksheets: 'worksheet',
  summer: 'summer', 'summer packs': 'summer', 'summer vacation work': 'summer',
  qpaper: 'qpaper', 'question paper': 'qpaper', 'question papers': 'qpaper',
  other: 'other', others: 'other',
};
export function normalizeCategory(v) {
  const k = String(v ?? '').trim().toLowerCase();
  if (!k) return 'other';
  if (CATEGORY_KEYS.includes(k)) return k;
  return CATEGORY_ALIASES[k] || CATEGORY_ALIASES[k.replace(/[\s_-]+/g, '')] || 'other';
}

/* Response ki casing tay nahi (kuch raste camelCase dete hain, kuch
   PascalCase) — is liye har field defensively padhi jati hai. */
const pick = (r, ...keys) => {
  for (const k of keys) {
    const v = r?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};
const num = (v) => Number(v) || 0;
const str = (v) => String(v ?? '').trim();

/* Screen date-only se kaam karti hai jabke API poora ISO deti hai. Pehle 10
   characters kaatna timezone se mehfooz hai — `new Date(...)` local time me
   din shift kar sakta hai. */
const toDateOnly = (v) => {
  if (!v) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v));
  if (m) return m[1];
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** API row → wahi shape jo Resource Library screen padhti hai. */
export function mapResource(r = {}) {
  const raw = str(pick(r, 'uploadedPDF', 'UploadedPDF', 'uploadedPdf', 'pdfPath', 'PDFPath'));
  const filePath = storagePath(raw);
  return {
    id:          num(pick(r, 'id', 'ID', 'Id', 'resourceID', 'resourceLibraryID')),
    classId:     num(pick(r, 'classID', 'ClassID', 'classId', 'gradeID')),
    subjectId:   num(pick(r, 'subjectID', 'SubjectID', 'subjectId')),
    sectionId:   num(pick(r, 'sectionID', 'SectionID', 'sectionId')),
    className:   str(pick(r, 'className', 'ClassName')),
    subjectName: str(pick(r, 'subjectName', 'SubjectName')),
    sectionName: str(pick(r, 'sectionName', 'SectionName')),
    category:    normalizeCategory(pick(r, 'category', 'Category')),
    title:       str(pick(r, 'resourceTitle', 'ResourceTitle', 'title')),
    description: str(pick(r, 'resourceDescription', 'ResourceDescription', 'description')),
    filePath,                              // storage path — edit par wapas jata hai
    fileUrl:     resourceFileUrl(raw),     // kholne ke liye
    fileName:    fileNameFrom(filePath),
    uploadedAt:  toDateOnly(pick(r, 'createdAt', 'CreatedAt', 'createdDate', 'CreatedDate')),
  };
}

/* ─────────────────────────── Call ─────────────────────────── */

/* Multipart POST — Content-Type khud set NAHI karte, browser boundary ke
   saath lagata hai. */
async function postForm(fd, label) {
  const token = sessionStorage.getItem('token');
  const res = await fetch(URL_(), {
    method: 'POST',
    headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    const err = new Error(json?.message || json?.Message || json?.title || `Could not ${label}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

const rows = (json) => (Array.isArray(json?.data) ? json.data : []);

/* Har call saare fields bhejti hai — backend inhi naamon par padhta hai. */
function form(action, r = {}, branchId = currentBranchId()) {
  const fd = new FormData();
  fd.append('Action', action);
  fd.append('ID', String(num(r.id)));
  fd.append('BranchID', String(num(branchId)));
  fd.append('NetworkID', String(BRANCH_NETWORK_ID));
  fd.append('ClassID', String(num(r.classId)));
  fd.append('SubjectID', String(num(r.subjectId)));
  fd.append('SectionID', String(num(r.sectionId)));
  fd.append('Category', r.category ?? '');
  fd.append('ResourceTitle', r.title ?? '');
  fd.append('ResourceDescription', r.description ?? '');
  /* Nayi file chuni ho to wahi bhejo; warna purana path bhej kar file jaisi
     hai waisi rehne do (warna edit par PDF gum ho jati hai). */
  if (r.pdfFile instanceof File) fd.append('PdfFile', r.pdfFile, r.pdfFile.name);
  fd.append('UploadedPDF', r.filePath ?? '');
  fd.append('ClassName', r.className ?? '');
  fd.append('SubjectName', r.subjectName ?? '');
  fd.append('SectionName', r.sectionName ?? '');
  return fd;
}

/* Update/delete ke liye asli backend id chahiye. Backend ka ID Int32 hai —
   koi local/fake id (jaise Date.now() ≈ 1.7e12) us me fit nahi hota. */
const realId = (id) => {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0;
};

/* ─────────────────────────── Parhna ─────────────────────────── */

/** Is school (branch) ke saare resources — naye pehle. */
export async function fetchBranchResources(branchId = currentBranchId()) {
  if (!branchId) return [];
  const json = await postForm(form('getbybranch', {}, branchId), 'load resources');
  return rows(json).map(mapResource).filter((r) => r.id).sort((a, b) => b.id - a.id);
}

/* ─────────────────────────── Likhna ─────────────────────────── */

/**
 * Naya resource ya mojooda ki tarmeem. `r.id` khali/0 = insert.
 * `r.pdfFile` File ho to nayi PDF chadhti hai, warna `r.filePath` wali
 * purani file jaisi hai waisi rehti hai.
 */
export async function saveBranchResource(r, branchId = currentBranchId()) {
  const id = realId(r.id);
  if (r.id && !id) throw new Error('Please refresh the resource list, then edit again.');
  const json = await postForm(
    form(id ? 'update' : 'insert', { ...r, id }, branchId),
    id ? 'update this resource' : 'upload this resource',
  );
  return realId(json?.data?.id ?? json?.data?.ID ?? json?.data ?? json?.id) || id;
}

/** Resource hatana — wahi route, sirf Action: 'delete'. */
export async function deleteBranchResource(r, branchId = currentBranchId()) {
  const id = realId(r?.id ?? r);
  if (!id) throw new Error('Please refresh the resource list, then delete again.');
  await postForm(form('delete', { ...(typeof r === 'object' ? r : {}), id }, branchId), 'delete this resource');
}

/* ───────────────────── Class ke subjects (asli ids ke saath) ─────────────────────
   Textbooks wala hi endpoint, magar yahan sirf naam nahi — subjectID bhi
   chahiye, kyunke API par SubjectID ki FK lagti hai. */
export async function fetchClassSubjects(gradeId, sectionId) {
  if (!gradeId || !sectionId) return [];
  try {
    const res = await fetch(buildUrl(`/api/LaunchSetup/get-subjects/${gradeId}/${sectionId}`), { headers: { Accept: '*/*' } });
    const json = await res.json();
    const arr = json?.data || (Array.isArray(json) ? json : []);
    const byId = new Map();
    arr.forEach((s) => {
      const id = Number(s.subjectID ?? s.subjectId ?? s.id) || 0;
      const name = String(s.subjectName ?? s.name ?? '').trim();
      if (id && name && !byId.has(id)) byId.set(id, { id, name });
    });
    return [...byId.values()];
  } catch { return []; }
}
