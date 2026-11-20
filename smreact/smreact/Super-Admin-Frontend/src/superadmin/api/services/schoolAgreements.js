/* ════════════════════════════════════════════════════════════════════
   SCHOOL AGREEMENTS & LEGAL DOCUMENTS service

   BACKEND STATUS — PENDING. Is waqt live SchoolMentorSuperAdminAPI me
   agreements/legal-documents ka KOI route nahi hai (poora swagger check
   kiya gaya: 60 routes, in me se ek bhi per-school document store nahi).
   Neeche jo route likha hai wo abhi backend par banna hai — poori spec
   SCHOOL_AGREEMENTS_API_HANDOFF.md me hai.

   Contract bilkul isi API ke mojooda convention par hai (wahi shakal jo
   AHM_School_SOPs/manual-detail ki hai), taake backend par naya pattern
   na banana pare:

     POST .../api/AHM_School_Agreements/manage_documents
       multipart/form-data, PascalCase fields, ek hi `Action`:
         get | insert | update | delete

     get     -> BranchID ke documents ({ success, count, data: [...] }).
                BranchID = 0 -> POORE network ke documents (summary cards).
     insert  -> naya document (DocumentFile laazmi).
     update  -> metadata badlo; DocumentFile diya ho to file replace,
                warna FilePath wapas bhej kar purani file waisi rehti hai
                (bilkul manual-detail jaisa).
     delete  -> ID par record + file dono hatao.

   Jab tak route live nahi hota, har call ApiError deti hai aur screen us
   par "backend pending" state dikhati hai — demo data kabhi nahi.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminIdentity, getSuperAdminToken } from '../config';
import EP from '../endpoints';
import {
  extOf, fileMeta, validateFile, validateLink, agreementStatus, countByStatus, groupOf, docGroup,
} from '../../agreementsData';

const userId = () => Number(getSuperAdminIdentity().userId) || 0;

/* ── helpers ────────────────────────────────────────────────────── */

/* 'Document_Title' / 'documentTitle' -> 'documenttitle' */
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Pehli mojood value `names` me se — .NET DTOs camelCase/PascalCase mila
    kar bhejti hain, is liye yahan bhi tolerant (schoolPermissions jaisa). */
function pick(obj, names, fallback = undefined) {
  if (!obj) return fallback;
  const map = new Map(Object.keys(obj).map((k) => [norm(k), k]));
  for (const n of names) {
    const key = map.get(norm(n));
    if (key != null && obj[key] != null && obj[key] !== '') return obj[key];
  }
  return fallback;
}

/** API ki date ('2026-03-01T00:00:00' / '3/1/2026') -> 'YYYY-MM-DD' ya ''.
    <input type="date"> aur table dono yehi shakal padhte hain. */
export function toDateInput(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Aaj 'YYYY-MM-DD' me — expiry ka hisab isi se (local date, UTC nahi). */
export function todayInput() {
  const p = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** URL/path ke aakhir se file ka naam (query string hata kar). */
export function fileNameFrom(path) {
  const p = String(path ?? '').split(/[?#]/)[0];
  try {
    return decodeURIComponent(new URL(p).pathname.split('/').pop() || '');
  } catch {
    return decodeURIComponent(p.split(/[\\/]/).pop() || '');
  }
}

/**
 * Server ka stored path -> browser me chalne wala URL.
 *
 * Bilkul sopFileUrl ki tarah: API application root chhor kar path deti hai
 * ("/Agreements/x.pdf"), file asal me SA root ke neeche milti hai. Base khali
 * ho (dev + production) to relative URL banta hai jise setupProxy / IIS
 * rewrite aage bhej dete hain — na CORS, na https par mixed-content.
 */
export function agreementFileUrl(path) {
  const raw = String(path ?? '').trim();
  if (!raw) return '';
  if (/^data:|^blob:/i.test(raw)) return raw;
  /* Jo path file jaisa hi nahi lagta us par KHALI — warna screen "file hai"
     samajh kar viewer khol deti hai aur us me app ka apna page aa jata hai
     (yehi bug SOPs me live data par pakda gaya tha). */
  if (!/^https?:\/\//i.test(raw) && !/\.[a-z0-9]{2,6}(\?|#|$)/i.test(raw)) return '';
  let rel = raw;
  try { rel = new URL(raw).pathname; } catch { /* pehle se relative */ }
  const m = rel.match(/\/SchoolMentorSuperAdminAPI(\/.*)$/i) || rel.match(/(\/Agreements\/.*)$/i);
  const tail = m ? m[1] : (rel.startsWith('/') ? rel : `/${rel}`);
  return `${SA_ADMIN_API_BASE}/SchoolMentorSuperAdminAPI${tail}`;
}

/* ── mapping ────────────────────────────────────────────────────── */

/**
 * API row -> wohi document shape jo screen padhti hai.
 * Koi field ghaayab ho to khali rehta hai — table us par '—' dikhata hai,
 * kuch farz nahi karta.
 */
/** Online document ka bahar wala link (Google Drive, website…) — hamari
    apni stored file NAHI. Stored files ka path hamesha Agreements folder ya
    SA root ke neeche hota hai. */
export function isExternalLink(path, kind) {
  const raw = String(path ?? '').trim();
  if (!/^https?:\/\//i.test(raw)) return false;
  if (String(kind || '').toLowerCase() === 'link') return true;
  return !/\/SchoolMentorSuperAdminAPI\/|\/Agreements\//i.test(raw);
}

export function docToUi(d) {
  const filePath = String(pick(d, ['filePath', 'documentPath', 'path'], '') || '');
  const kind = String(pick(d, ['documentKind', 'kind'], '') || '');
  if (isExternalLink(filePath, kind)) return linkToUi(d, filePath);
  const fileName = String(pick(d, ['fileName', 'originalFileName'], '') || '') || fileNameFrom(filePath);
  const expiry = toDateInput(pick(d, ['expiryDate', 'expireDate']));
  const meta = fileMeta(fileName || filePath);
  return {
    id: Number(pick(d, ['id', 'documentID', 'documentId'])) || 0,
    branchId: Number(pick(d, ['branchID', 'branchId', 'schoolID', 'schoolId'])) || 0,
    title: String(pick(d, ['documentTitle', 'title'], '') || '').trim(),
    category: String(pick(d, ['documentCategory', 'category', 'documentType'], '') || '').trim(),
    signingDate: toDateInput(pick(d, ['signingDate', 'agreementSigningDate'])),
    expiryDate: expiry,
    uploadedDate: toDateInput(pick(d, ['uploadDate', 'uploadedDate', 'createdAt'])),
    description: String(pick(d, ['description', 'notes', 'remarks'], '') || '').trim(),
    /* Optional — document par likha hua reference/registration number. */
    documentNo: String(pick(d, ['documentNo', 'documentNumber', 'docNumber'], '') || '').trim(),
    /* Kis ne chadhaya: id hamesha, naam tab jab API bhejti ho. Naam na ho to
       screen users list se `uploadedBy` par dhoond leti hai. */
    uploadedBy: Number(pick(d, ['uploadedBy', 'createdBy'])) || 0,
    uploadedByName: String(pick(d, ['uploadedByName', 'createdByName'], '') || '').trim(),
    /* filePath bilkul wohi rehta hai jo server ne diya — update par yehi
       wapas jata hai (warna edit par file gum ho jati hai). */
    filePath,
    fileUrl: agreementFileUrl(filePath),
    fileName,
    fileExt: extOf(fileName || filePath),
    fileKind: meta.kind,
    fileIcon: meta.icon,
    fileColor: meta.color,
    fileSize: Number(pick(d, ['fileSize', 'sizeInBytes'])) || 0,
    /* Expiry na ho -> agreement open-ended, yani active. */
    expired: Boolean(expiry) && expiry < todayInput(),
    group: groupOf(String(pick(d, ['documentCategory', 'category', 'documentType'], '') || '')),
    branchName: String(pick(d, ['branchName', 'schoolName'], '') || '').trim(),
    isLink: false,
    raw: d,
  };
}

/* Link document: file nahi, sirf ek web address. Viewer usay naye tab me
   kholta hai (bahar ki site iframe me aksar mana hoti hai). */
function linkToUi(d, url) {
  const category = String(pick(d, ['documentCategory', 'category', 'documentType'], '') || '').trim();
  let host = '';
  try { host = new URL(url).host; } catch { /* save par pehle hi jaancha gaya */ }
  return {
    id: Number(pick(d, ['id', 'documentID', 'documentId'])) || 0,
    branchId: Number(pick(d, ['branchID', 'branchId', 'schoolID', 'schoolId'])) || 0,
    branchName: String(pick(d, ['branchName', 'schoolName'], '') || '').trim(),
    title: String(pick(d, ['documentTitle', 'title'], '') || '').trim() || host || 'Link',
    category,
    group: groupOf(category),
    signingDate: toDateInput(pick(d, ['signingDate', 'agreementSigningDate'])),
    expiryDate: toDateInput(pick(d, ['expiryDate', 'expireDate'])),
    uploadedDate: toDateInput(pick(d, ['uploadDate', 'uploadedDate', 'createdAt'])),
    description: String(pick(d, ['description', 'notes', 'remarks'], '') || '').trim(),
    documentNo: String(pick(d, ['documentNo', 'documentNumber', 'docNumber'], '') || '').trim(),
    uploadedBy: Number(pick(d, ['uploadedBy', 'createdBy'])) || 0,
    uploadedByName: String(pick(d, ['uploadedByName', 'createdByName'], '') || '').trim(),
    filePath: url,
    fileUrl: url,
    fileName: host,
    fileExt: '',
    fileKind: 'link',
    fileIcon: 'fa-link',
    fileColor: docGroup('online').color,
    fileSize: 0,
    expired: false,
    isLink: true,
    raw: d,
  };
}

/* Har action ka poora multipart body — backend saare fields expect karta hai. */
function docForm(action, d = {}) {
  const now = new Date().toISOString();
  const fd = new FormData();
  fd.append('Action', action);
  fd.append('ID', String(Number(d.id) || 0));
  fd.append('BranchID', String(Number(d.branchId) || 0));
  fd.append('DocumentTitle', d.title ?? '');
  fd.append('DocumentCategory', d.category ?? '');
  /* School ka naam, asli file ka naam aur upload ki tareekh — har document
     ke saath record me (BranchID hi asal rishta hai; naam sirf hawale ke liye). */
  fd.append('BranchName', d.branchName ?? '');
  fd.append('OriginalFileName', d.file instanceof File ? d.file.name : (d.fileName ?? ''));
  fd.append('DocumentKind', d.kind === 'link' ? 'link' : 'file');
  fd.append('UploadDate', d.uploadDate || now);
  /* Nayi file chuni ho to wohi bhejo; warna purana path bhej kar file jaisi
     hai waisi rehne do (manual-detail ka wahi tareeqa). */
  if (d.file instanceof File) fd.append('DocumentFile', d.file, d.file.name);
  fd.append('FilePath', d.filePath ?? '');
  /* Khali date '' jati hai — .NET par DateTime? isay null bind karta hai. */
  fd.append('SigningDate', d.signingDate || '');
  fd.append('ExpiryDate', d.expiryDate || '');
  fd.append('DocumentNumber', d.documentNo ?? '');
  fd.append('Description', d.description ?? '');
  fd.append('IsActive', 'true');
  /* Kis ne upload kiya — insert par logged-in Super Admin, update par wohi
     rehta hai jo pehle tha (screen `uploadedBy` wapas bhejti hai). */
  fd.append('UploadedBy', String(Number(d.uploadedBy) || userId()));
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
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.agreements.documents()}`, {
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
    throw new ApiError(
      (json && (json.message || json.Message)) || `Failed to ${label} (${res.status})`,
      res.status,
      json,
    );
  }
  return json;
}

/** Khali natija ghalti nahi hai — jis school ka koi document na ho us par
    API 404 "No documents found" deti hai (SOPs ka bilkul wahi rawaiya). */
export function isEmptyResult(err) {
  return err?.status === 404 && /no .*(found|records)/i.test(String(err?.message || ''));
}

/**
 * Route hi mojood na ho (backend abhi deploy nahi hua) — ye "koi document
 * nahi" se ALAG haalat hai, aur screen dono ko alag dikhati hai. IIS un
 * paths par jo kisi controller se match na karein 404 deta hai, magar us
 * "No documents found" message ke baghair.
 */
export function isMissingEndpoint(err) {
  if (err?.status === 404 && !isEmptyResult(err)) return true;
  return err?.status === 405 || err?.status === 501;
}

/* ── reads ──────────────────────────────────────────────────────── */

function rowsOf(json) {
  return Array.isArray(json?.data) ? json.data
    : Array.isArray(json?.Data) ? json.Data
      : Array.isArray(json) ? json : [];
}

/**
 * action: get — EK school ke saare documents.
 * @param {number} branchId  school / branch id (0 kabhi nahi — warna poora
 *   network aa jata hai; wo listAllDocuments() ka kaam hai)
 */
export async function listSchoolDocuments(branchId) {
  const id = Number(branchId) || 0;
  if (!id) return [];
  let json;
  try {
    json = await postForm(docForm('get', { branchId: id }), 'load documents');
  } catch (err) {
    if (isEmptyResult(err)) return [];        // is school ka abhi koi document nahi
    throw err;
  }
  /* Defence in depth: backend kisi wajah se zaid rows bhej de to bhi screen
     SIRF isi school ke documents dikhaye (dusre school ka document kabhi
     nahi). */
  return rowsOf(json).map(docToUi).filter((d) => d.id && d.branchId === id);
}

/**
 * action: get, BranchID = 0 — poore network ke documents, sirf upar ke chaar
 * summary cards ke liye.
 */
export async function listAllDocuments() {
  let json;
  try {
    json = await postForm(docForm('get', { branchId: 0 }), 'load document summary');
  } catch (err) {
    if (isEmptyResult(err)) return [];
    throw err;
  }
  return rowsOf(json).map(docToUi).filter((d) => d.id);
}

/* ── writes ─────────────────────────────────────────────────────── */

/**
 * action: insert | update — Upload / Save Changes / Replace File.
 * @param branchId  jis school ka document hai (hamesha laazmi)
 * @param form      { title, category, signingDate, expiryDate, description,
 *                    file?, filePath? }
 * @param editId    mojood document ki id -> update; warna insert
 */
export function saveDocument(branchId, form, editId) {
  const id = Number(branchId) || 0;
  if (!id) return Promise.reject(new ApiError('No school selected for this document', 400));
  const isEdit = Number(editId) > 0;
  if (!isEdit && !(form?.file instanceof File)) {
    return Promise.reject(new ApiError('A document file is required', 400));
  }
  if (form?.file instanceof File) {
    const bad = validateFile(form.file);
    if (bad) return Promise.reject(new ApiError(bad, 400));
  }
  return postForm(
    docForm(isEdit ? 'update' : 'insert', { ...form, branchId: id, id: isEdit ? editId : 0 }),
    isEdit ? 'update document' : 'upload document',
  );
}

/**
 * action: insert, ek file — XHR par taake ASLI upload progress mile
 * (fetch upload progress nahi deta). onProgress(0..100) sirf browser ke
 * bheje hue bytes par chalta hai; kaamyabi tabhi jab server success kahe.
 * @param branchId   school / branch id (laazmi)
 * @param form       { file, title, category, branchName, description? }
 */
export function uploadDocument(branchId, form, { onProgress } = {}) {
  const id = Number(branchId) || 0;
  if (!id) return Promise.reject(new ApiError('No school selected for this document', 400));
  const bad = validateFile(form?.file);
  if (bad) return Promise.reject(new ApiError(bad, 400));
  if (!String(form?.category || '').trim()) return Promise.reject(new ApiError('Choose a document category', 400));
  const fd = docForm('insert', { ...form, branchId: id, id: 0, kind: 'file' });
  return sendXhr(fd, 'upload document', onProgress);
}

/** action: insert, Online / Link document — file ki jagah web address. */
export function saveLinkDocument(branchId, form) {
  const id = Number(branchId) || 0;
  if (!id) return Promise.reject(new ApiError('No school selected for this document', 400));
  const bad = validateLink(form?.url);
  if (bad) return Promise.reject(new ApiError(bad, 400));
  if (!String(form?.title || '').trim()) return Promise.reject(new ApiError('Enter a name for this link', 400));
  return postForm(docForm('insert', {
    ...form, branchId: id, id: 0, kind: 'link', filePath: String(form.url).trim(), fileName: '',
  }), 'save link');
}

function sendXhr(fd, label, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SA_ADMIN_API_BASE}${EP.agreements.documents()}`);
    xhr.setRequestHeader('accept', '*/*');
    const token = getSuperAdminToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    }
    xhr.onerror = () => reject(new ApiError('Network error', 0));
    xhr.onload = () => {
      let json = null;
      try { json = JSON.parse(xhr.responseText); } catch { /* JSON nahi aaya */ }
      if (xhr.status < 200 || xhr.status >= 300 || (json && json.success === false)) {
        reject(new ApiError(
          (json && (json.message || json.Message)) || `Failed to ${label} (${xhr.status})`,
          xhr.status, json,
        ));
        return;
      }
      resolve(json);
    };
    xhr.send(fd);
  });
}

/**
 * Stored file ko ASLI bytes ke saath download karo. Pehle file mangwai jati
 * hai aur jaanchi jati hai — khali file, ya server ka HTML page (file ki
 * jagah app ka index.html) aaye to ghalti uthti hai, "downloaded" nahi
 * kaha jata.
 * @returns {Promise<{ name: string, size: number }>}
 */
export async function downloadDocumentFile(doc) {
  if (!doc?.fileUrl) throw new ApiError('This document has no stored file', 400);
  if (doc.isLink) throw new ApiError('Online links cannot be downloaded — open the link instead', 400);
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(doc.fileUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch (err) {
    throw new ApiError(err?.message || 'Network error', 0);
  }
  if (!res.ok) throw new ApiError(`The file could not be downloaded (${res.status})`, res.status);
  const blob = await res.blob();
  const type = String(blob.type || res.headers?.get?.('content-type') || '').toLowerCase();
  if (!blob.size) throw new ApiError('The stored file is empty', 422);
  if (type.includes('text/html')) throw new ApiError('The stored file was not found on the server', 404);
  const name = doc.fileName || `${doc.title || 'document'}${doc.fileExt ? `.${doc.fileExt}` : ''}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { name, size: blob.size };
}

/** action: delete — record aur stored file dono. */
export function deleteDocument(id, branchId) {
  return postForm(docForm('delete', { id, branchId }), 'delete document');
}

/* ── derived figures (sirf asli records se) ─────────────────────── */

/**
 * Upar ke chaar cards. Koi aankra farz nahi hota — list hi se nikalta hai.
 * @param {Array} docs  listAllDocuments() ka natija
 */
export function summarize(docs, today) {
  const list = Array.isArray(docs) ? docs : [];
  const schools = new Set(list.map((d) => d.branchId).filter(Boolean));
  const byStatus = countByStatus(list, today);
  return {
    schoolsWithAgreements: schools.size,
    totalDocuments: list.length,
    /* Active = jo abhi chal raha hai; "Expiring Soon" bhi active hi hai,
       is liye usay yahan Active me gina jata hai aur alag card apna count
       dikhata hai. Pending Signature kisi me nahi — wo abhi chala hi nahi. */
    activeAgreements: byStatus.active + byStatus.soon,
    expiringSoon: byStatus.soon,
    expiredAgreements: byStatus.expired,
    pendingSignature: byStatus.pending,
  };
}

/** Ek document ka agreement status — wrapper, taake screens ko agreementsData
    alag se import na karna pare. */
export const statusOf = (doc, today) => agreementStatus(doc, today);

const schoolAgreementsService = {
  listSchoolDocuments, listAllDocuments, saveDocument, deleteDocument,
  uploadDocument, saveLinkDocument, downloadDocumentFile, isExternalLink,
  docToUi, summarize, statusOf, agreementFileUrl, fileNameFrom, toDateInput,
  todayInput, isEmptyResult, isMissingEndpoint,
};
export default schoolAgreementsService;
