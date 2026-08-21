/* ════════════════════════════════════════════════════════════════════
   E-TUBE service — LIVE SchoolMentorSuperAdminAPI.

   Do routes, dono POST, dono me kaam `action` se tay hota hai
   (get | insert | update | delete) — bilkul School SOPs jaisa:

     POST .../api/AHM_Etube/manage_categories   → application/json
       body: { action, id, categoryName, description, icon, color,
               createdBy, createdAt, modifiedBy, modifiedAt }

     POST .../api/AHM_Etube/manage_videos       → multipart/form-data
       fields (PascalCase): Action, ID, VideoTitle, Description, CategoryID,
         CategoryName, Thumbnail, VideoFile, Status, CreatedBy, CreatedAt,
         ModifiedBy, ModifiedAt
       files: ThumbnailFile (binary), VideoFileUpload (binary)

   Jawab hamesha ek hi envelope me: { success, message, data }.
     get    → data: [ ...rows ]     (khali ho to [])
     insert → data: { id }

   ⚠ manage_videos par ye PAANCH string fields [Required] hain — khali
   bhejne par 400 "The X field is required" aata hai, chahe action get ya
   delete hi kyun na ho: VideoTitle, Description, CategoryName, Thumbnail,
   VideoFile. Is liye jahan value nahi hoti wahan PLACEHOLDER ('-') jata hai
   (live verify kiya: Action=get + '-' se 200 aata hai).

   Screen ke shapes (ETube.jsx / etubeData.js) waise hi rehte hain, mapping
   sirf yahan hai:
     category → { id, name, desc, icon, color }
     video    → { id, title, desc, cat, catId, status, date, views, ... }

   Reviews aur "Other Schools" videos ki abhi koi API nahi — wo demo data
   par hain aur yahan se sirf pass-through hote hain.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken } from '../config';
import { currentUserId } from './auth';
import EP from '../endpoints';
import { INITIAL_REVS, INITIAL_SCHOOL_VIDS } from '../../etubeData';

/* CreatedBy / ModifiedBy — login wali id. currentUserId() runtime identity ke
   sath sessionStorage par bhi girta hai, is liye page reload ke foran baad
   bhi API ko 0 nahi jata. */
const userId = () => currentUserId();
const nowIso = () => new Date().toISOString();

/* API row ka `data` nikaalne ka ek hi tareeqa (kabhi { data: [...] },
   kabhi seedha array). */
const rowsOf = (json) =>
  (Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []));

/* Khali natija ghalti nahi hai — jaise SOPs me, khali list par API 404 +
   success:false de sakti hai. Screen ko error toast nahi, khali list chahiye. */
function isEmptyResult(err) {
  return err?.status === 404 || /no .*(found|records)/i.test(String(err?.message || ''));
}

/* ═══════════════════════ CATEGORIES (JSON) ═══════════════════════ */

/** API row → wohi category shape jo screen padhti hai. */
export function categoryToUi(c) {
  return {
    id:    Number(c?.id) || 0,
    name:  String(c?.categoryName ?? c?.name ?? '').trim(),
    desc:  String(c?.description ?? '').trim(),
    icon:  String(c?.icon ?? '').trim() || 'fa-layer-group',
    color: String(c?.color ?? '').trim() || '#1E40AF',
    raw:   c,
  };
}

/* Har action ki poori body — backend saare fields expect karta hai. */
function categoryBody(action, { id = 0, name = '', desc = '', icon = '', color = '' } = {}) {
  const now = nowIso();
  return {
    action,
    id: Number(id) || 0,
    categoryName: name,
    description: desc,
    icon,
    color,
    createdBy: userId(),
    createdAt: now,
    modifiedBy: userId(),
    modifiedAt: now,
  };
}

async function postCategory(payload, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.etube.categories()}`, {
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
    throw new ApiError((json && (json.message || json.Message)) || `Failed to ${label}`, res.status, json);
  }
  return json;
}

/** action: get — saari categories (mapped, bina naam wali rows chhod kar). */
export async function listCategories() {
  let json;
  try {
    json = await postCategory(categoryBody('get'), 'load categories');
  } catch (err) {
    if (isEmptyResult(err)) return [];
    throw err;
  }
  return rowsOf(json).map(categoryToUi).filter((c) => c.id && c.name);
}

/** action: insert | update — `editId` ho to update, warna insert. */
export function saveCategory(form, editId) {
  const isEdit = Number(editId) > 0;
  return postCategory(
    categoryBody(isEdit ? 'update' : 'insert', { ...form, id: isEdit ? editId : 0 }),
    isEdit ? 'update category' : 'add category',
  );
}

/** action: delete */
export function deleteCategory(id) {
  return postCategory(categoryBody('delete', { id }), 'delete category');
}

/* ═══════════════════════ VIDEOS (multipart) ═══════════════════════ */

/* [Required] string fields ke liye placeholder — dekho file ke shuru ka note. */
const REQ = (v) => {
  const s = String(v ?? '').trim();
  return s || '-';
};

/* Optional int fields (ID / CategoryID) — koi asli id na ho to KHALI jata
   hai, 0 nahi.

   Wajah: 0 aur khali ka matlab backend par alag hai. SP ka filter
   (@ID IS NULL OR ID = @ID) khali ko "sab do" samajhta hai, jab ke 0 ek
   asli id samajh kar dhoondta hai — aur 0 naam ki koi row hoti nahi, is
   liye GET hamesha khali list deta tha. Isi liye Videos tab khali rehti
   thi (pehle ise backend ka bug samjha gaya tha). */
const OPT_ID = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
};

/** Uploaded file (thumbnail / video) ka chalne wala URL.

    WAHI USOOL JO MANUALS / SOP FILES KA HAI — dekho
    services/schoolSops.js → sopFileUrl.

    API file ka URL apne REQUEST host se banati hai aur us me application
    root CHHOOT jata hai. Manuals par ye live tasdeeq shuda hai:

      API deti hai : http://50.190.164.42:4100/Manuals/Forms/f77c….pdf   → 404
      file milti hai: /SchoolMentorSuperAdminAPI/Manuals/Forms/f77c….pdf → 200

    Is liye yahan bhi: jo bhi host API ne lagaya ho use phenk do, path ka
    /Etube/... wala hissa lo, aur usay app root ke saath dobara joro.

    SA_ADMIN_API_BASE khali hai (dev + prod) → relative URL banta hai, jise
    dev par setupProxy aur prod par IIS rewrite khud aage bhej dete hain —
    na CORS ka masla, na https par mixed-content ka. */
export function etubeFileUrl(path) {
  const raw = String(path ?? '').trim();
  if (!raw || raw === '-') return '';
  if (/^data:|^blob:/i.test(raw)) return raw;

  let rel = raw;
  try { rel = new URL(raw).pathname; } catch { /* pehle se relative */ }

  /* Path me app root pehle se ho to dobara na lage. */
  const ROOT = '/SchoolMentorSuperAdminAPI';
  const at = rel.toLowerCase().indexOf(ROOT.toLowerCase());
  const tail = at >= 0
    ? rel.slice(at + ROOT.length)
    : (rel.startsWith('/') ? rel : `/${rel}`);
  return `${SA_ADMIN_API_BASE}${ROOT}${tail}`;
}

/** '2026-08-19T03:28:14.667' → '19 Aug 2026' (screen isi format me dikhati hai). */
function dateLabel(iso) {
  const d = new Date(String(iso ?? ''));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** API row → wohi video shape jo screen padhti hai.

    `status` API par boolean hai (published ya nahi). Screen ke teen haal
    hain — Live / Processing / Draft — jin me Processing sirf upload ke doran
    ka client-side haal hai, is liye yahan se sirf Live/Draft aata hai. */
export function videoToUi(v) {
  const thumbnail = String(v?.thumbnail ?? v?.Thumbnail ?? '');
  const videoFile = String(v?.videoFile ?? v?.VideoFile ?? '');
  const createdAt = v?.createdAt ?? v?.CreatedAt ?? '';
  return {
    id:        Number(v?.id ?? v?.ID) || 0,
    title:     String(v?.videoTitle ?? v?.VideoTitle ?? '').trim(),
    desc:      String(v?.description ?? v?.Description ?? '').trim(),
    catId:     Number(v?.categoryID ?? v?.categoryId ?? v?.CategoryID) || 0,
    cat:       String(v?.categoryName ?? v?.CategoryName ?? '').trim(),
    status:    v?.status === false ? 'Draft' : 'Live',
    vis:       'all',
    /* Views ka koi column API par nahi — screen ko number chahiye. */
    views:     Number(v?.views ?? 0) || 0,
    date:      dateLabel(createdAt),
    createdAt: String(createdAt || ''),
    /* Raw paths edit par wapas jate hain, URLs sirf dikhane ke liye. */
    thumbnail,
    videoFile,
    thumbUrl:  etubeFileUrl(thumbnail),
    videoUrl:  etubeFileUrl(videoFile),
    raw: v,
  };
}

/* Har action ka multipart body — backend saare fields expect karta hai.

   Nayi file chuni ho to file jati hai; warna purana path bhej kar file
   jaisi hai waisi rehne di jati hai (SOP ke PDFPath wala hi usool). */
function videoForm(action, v = {}) {
  const now = nowIso();
  const fd = new FormData();
  fd.append('Action', action);
  fd.append('ID', OPT_ID(v.id));
  fd.append('VideoTitle', REQ(v.title));
  fd.append('Description', REQ(v.desc));
  fd.append('CategoryID', OPT_ID(v.catId));
  fd.append('CategoryName', REQ(v.cat));
  fd.append('Thumbnail', REQ(v.thumbnail));
  fd.append('VideoFile', REQ(v.videoFile));
  fd.append('Status', String(v.status !== 'Draft'));
  fd.append('CreatedAt', now);
  fd.append('CreatedBy', String(userId()));
  fd.append('ModifiedAt', now);
  fd.append('ModifiedBy', String(userId()));
  if (v.thumbFile instanceof File) fd.append('ThumbnailFile', v.thumbFile, v.thumbFile.name);
  if (v.videoUpload instanceof File) fd.append('VideoFileUpload', v.videoUpload, v.videoUpload.name);
  return fd;
}

/**
 * multipart POST — fetch ki jagah XHR, sirf is liye ke video 500 MB tak ka
 * ho sakta hai aur `xhr.upload.onprogress` se screen asli percentage dikha
 * sakti hai (fetch me upload progress ka koi zariya nahi).
 * Content-Type jaan-boojh kar set nahi karte — browser boundary khud lagata hai.
 */
function postVideoForm(fd, label, onProgress) {
  const token = getSuperAdminToken();
  const url = `${SA_ADMIN_API_BASE}${EP.etube.videos()}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('accept', '*/*');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (typeof onProgress === 'function' && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onerror = () => reject(new ApiError('Network error', 0));
    xhr.ontimeout = () => reject(new ApiError('Upload timed out', 0));
    xhr.onload = () => {
      let json = null;
      try { json = JSON.parse(xhr.responseText); } catch { /* HTML/khali jawab */ }
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok || (json && json.success === false)) {
        reject(new ApiError(
          (json && (json.message || json.Message || json.title)) || `Failed to ${label}`,
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
 * action: get — videos (mapped).
 *
 * ID KHALI jata hai, 0 nahi — 0 ek asli id samjhi jati hai aur GET hamesha
 * khali list deta tha (isi wajah se Videos tab khali rehti thi; pehle ise
 * backend ka bug likha gaya tha). Wahi baat CategoryID par bhi lagti hai:
 * koi category chuni na ho to khali. Dekho OPT_ID.
 *
 * @param {number} [categoryId] sirf ek category ke videos chahiye to.
 */
export async function listVideos(categoryId) {
  let json;
  try {
    json = await postVideoForm(videoForm('get', { catId: categoryId }), 'load videos');
  } catch (err) {
    if (isEmptyResult(err)) return [];
    throw err;
  }
  return rowsOf(json).map(videoToUi).filter((v) => v.id);
}

/**
 * action: insert | update — Upload / Save Changes.
 * @param {object} form { title, desc, cat, catId, status, thumbnail, videoFile,
 *                        thumbFile: File, videoUpload: File }
 * @param {number} [editId] ho to update
 * @param {(pct:number)=>void} [onProgress] upload percentage
 */
export function saveVideo(form, editId, onProgress) {
  const isEdit = Number(editId) > 0;
  return postVideoForm(
    videoForm(isEdit ? 'update' : 'insert', { ...form, id: isEdit ? editId : 0 }),
    isEdit ? 'update video' : 'upload video',
    onProgress,
  );
}

/** action: delete */
export function deleteVideo(id) {
  return postVideoForm(videoForm('delete', { id }), 'delete video');
}

/* ═══════════════ REVIEWS / SCHOOL VIDEOS — abhi demo data ═══════════════
   In dono ki koi API SchoolMentorSuperAdminAPI par mojood nahi hai. Screen
   ka code inhi functions ko bulata hai, taake API aane ke din sirf yahan
   asli call lagani pare — baaki kuch na badle. */

const later = (v) => new Promise((res) => setTimeout(() => res(v), 120));

export const listReviews = () => later(INITIAL_REVS.map((r) => ({ ...r })));
export const setReviewStatus = (id, status) => later({ id, status });
export const listSchoolVideos = () => later(INITIAL_SCHOOL_VIDS.map((v) => ({ ...v })));
export const setSchoolVideoStatus = (id, status) => later({ id, status });
export const deleteSchoolVideo = (id) => later({ id });

const etubeService = {
  listCategories, saveCategory, deleteCategory, categoryToUi,
  listVideos, saveVideo, deleteVideo, videoToUi, etubeFileUrl,
  listReviews, setReviewStatus,
  listSchoolVideos, setSchoolVideoStatus, deleteSchoolVideo,
};
export default etubeService;
