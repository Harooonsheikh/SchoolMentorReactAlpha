import { buildSuperAdminUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   E-TUBE — read-only wiring to the Super Admin E-Tube APIs.

   Videos aur categories Super Admin panel (E-Tube) me banti hain; ERP unhe
   sirf DIKHATA hai. Dono routes POST hain aur kaam `action` se tay hota hai —
   yahan se sirf `get` chalta hai, ERP kuch likhta nahi:

     POST {SA}/api/AHM_Etube/manage_categories  → application/json
          { action:'get', id, categoryName, description, icon, color, ... }
     POST {SA}/api/AHM_Etube/manage_videos      → multipart/form-data
          Action=get, ID='', CategoryID='', + 5 [Required] string fields

   Jawab: { success, message, data:[...] }. Mapping Super Admin ke
   api/services/etube.js jaisi hi hai taake dono screens ek hi shape padhein.
   ═══════════════════════════════════════════════════════════════════ */

const CATEGORIES_URL = () => buildSuperAdminUrl('/api/AHM_Etube/manage_categories');
const VIDEOS_URL     = () => buildSuperAdminUrl('/api/AHM_Etube/manage_videos');

const token = () => sessionStorage.getItem('token');
const userId = () => Number(sessionStorage.getItem('userID') || sessionStorage.getItem('employee_ID') || 0) || 0;

const rowsOf = (json) =>
  (Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []));

/* Khali list par API 404 / success:false de sakti hai — wo ghalti nahi. */
async function readRows(res, label) {
  const json = await res.json().catch(() => null);
  if (res.status === 404 || /no .*(found|records)/i.test(String(json?.message || ''))) return [];
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message || json.title)) || `Could not load ${label}`);
  }
  return rowsOf(json);
}

/* ── Categories ── */
export function categoryToUi(c) {
  return {
    id:    Number(c?.id) || 0,
    name:  String(c?.categoryName ?? c?.name ?? '').trim(),
    desc:  String(c?.description ?? '').trim(),
    icon:  String(c?.icon ?? '').trim() || 'fa-layer-group',
    color: String(c?.color ?? '').trim() || '#1E40AF',
  };
}

export async function listCategories() {
  const now = new Date().toISOString();
  const res = await fetch(CATEGORIES_URL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: '*/*',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: JSON.stringify({
      action: 'get', id: 0, categoryName: '', description: '', icon: '', color: '',
      createdBy: userId(), createdAt: now, modifiedBy: userId(), modifiedAt: now,
    }),
  });
  const rows = await readRows(res, 'categories');
  return rows.map(categoryToUi).filter((c) => c.id && c.name);
}

/* ── Videos ── */

/* Uploaded file ka chalne wala URL. API path me /SchoolMentorSuperAdminAPI root
   chhor deti hai (SOP files jaisa masla) — host phenk kar /Etube/... wala hissa
   lo aur SA root ke saath jodo. Super Admin ka etubeFileUrl bhi yahi karta hai. */
export function etubeFileUrl(path) {
  const raw = String(path ?? '').trim();
  if (!raw || raw === '-') return '';
  if (/^data:|^blob:/i.test(raw)) return raw;
  let rel = raw;
  try { rel = new URL(raw).pathname; } catch { /* pehle se relative */ }
  const ROOT = '/SchoolMentorSuperAdminAPI';
  const at = rel.toLowerCase().indexOf(ROOT.toLowerCase());
  const tail = at >= 0 ? rel.slice(at + ROOT.length) : (rel.startsWith('/') ? rel : `/${rel}`);
  return buildSuperAdminUrl(tail);
}

function dateLabel(iso) {
  const d = new Date(String(iso ?? ''));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* status API par boolean hai — false = Draft (abhi publish nahi). */
export function videoToUi(v) {
  const thumbnail = String(v?.thumbnail ?? v?.Thumbnail ?? '');
  const videoFile = String(v?.videoFile ?? v?.VideoFile ?? '');
  const createdAt = v?.createdAt ?? v?.CreatedAt ?? '';
  return {
    id:       Number(v?.id ?? v?.ID) || 0,
    title:    String(v?.videoTitle ?? v?.VideoTitle ?? '').trim(),
    desc:     String(v?.description ?? v?.Description ?? '').trim(),
    catId:    Number(v?.categoryID ?? v?.categoryId ?? v?.CategoryID) || 0,
    cat:      String(v?.categoryName ?? v?.CategoryName ?? '').trim(),
    live:     !(v?.status === false || v?.Status === false),
    date:     dateLabel(createdAt),
    createdAt: String(createdAt || ''),
    thumbUrl: etubeFileUrl(thumbnail),
    videoUrl: etubeFileUrl(videoFile),
  };
}

/* [Required] string fields khali hon to backend 400 deta hai — '-' placeholder.
   ID / CategoryID KHALI jate hain (0 nahi), warna SP 0 ko asli id samajh kar
   khali list deta hai. */
export async function listVideos() {
  const now = new Date().toISOString();
  const fd = new FormData();
  fd.append('Action', 'get');
  fd.append('ID', '');
  fd.append('VideoTitle', '-');
  fd.append('Description', '-');
  fd.append('CategoryID', '');
  fd.append('CategoryName', '-');
  fd.append('Thumbnail', '-');
  fd.append('VideoFile', '-');
  fd.append('Status', 'true');
  fd.append('CreatedAt', now);
  fd.append('CreatedBy', String(userId()));
  fd.append('ModifiedAt', now);
  fd.append('ModifiedBy', String(userId()));
  const res = await fetch(VIDEOS_URL(), {
    method: 'POST',
    headers: { Accept: '*/*', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
    body: fd,
  });
  const rows = await readRows(res, 'videos');
  return rows.map(videoToUi).filter((v) => v.id);
}

const etubeService = { listCategories, listVideos, etubeFileUrl, categoryToUi, videoToUi };
export default etubeService;
