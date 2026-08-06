import { buildSuperAdminUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   SCHOOL SOPs — read-only wiring to the Super Admin SOP APIs.

   Super Admin panel me manual heads / manuals / forms banaye jate hain;
   ERP unhi ko sirf DIKHATA hai. Teeno routes wahi hain, sirf `action: get`:

     POST {SA}/api/AHM_School_SOPs/manual-head     → manual heads (categories)
     POST {SA}/api/AHM_School_SOPs/manual-detail   → ek head ke manuals
     POST {SA}/api/AHM_School_SOPs/manual-form     → ek manual ki forms

   manual-head JSON leta hai; baqi dono multipart/form-data (un me file
   fields hain). Yahan se sirf `get` chalta hai — ERP kuch likhta nahi.
   ═══════════════════════════════════════════════════════════════════ */

const HEAD_URL   = () => buildSuperAdminUrl('/api/AHM_School_SOPs/manual-head');
const DETAIL_URL = () => buildSuperAdminUrl('/api/AHM_School_SOPs/manual-detail');
const FORM_URL   = () => buildSuperAdminUrl('/api/AHM_School_SOPs/manual-form');

const authHeaders = () => {
  const token = sessionStorage.getItem('token');
  return { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

async function readJson(res, label) {
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || `Could not load ${label}`);
  }
  return Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
}

/* Head ke naam se ek munasib icon (API icon nahi bhejti). */
const ICONS = [
  [/academ|teach|curricul|lesson/i, 'fa-graduation-cap'],
  [/admin|office|complian/i,        'fa-building'],
  [/hr|staff|human/i,               'fa-users'],
  [/health|safety|emergen/i,        'fa-kit-medical'],
  [/financ|fee|account|budget/i,    'fa-coins'],
  [/operation|facilit|logistic/i,   'fa-gears'],
];
export const iconForHead = (name) => (ICONS.find(([re]) => re.test(String(name || '')))?.[1]) || 'fa-folder-open';

/* URL/path ke aakhir se file ka naam. */
export function fileNameFrom(path) {
  const p = String(path ?? '').split(/[?#]/)[0];
  try { return decodeURIComponent(new URL(p).pathname.split('/').pop() || ''); }
  catch { return decodeURIComponent(p.split(/[\\/]/).pop() || ''); }
}

/* Uploaded file (manual PDF / form document) ka URL.

   API ab poora absolute URL bhejti hai (e.g.
   "https://alphaapi.schoolmentor.ai/Manuals/Forms/x.docx") — wohi authority
   hai, is liye usay chherte nahi. Sirf do soorton me haath lagate hain:
     • relative path aaye  → API host ke saath joad do
     • http URL ho aur page https par ho → https kar do, warna browser
       "mixed content" keh kar block kar deta hai
   NOTE: agar file kabhi 404 de to wo backend ka masla hai (file serve hi
   nahi ho rahi), URL ka nahi — dono ko alag rakhna zaroori hai. */
export function sopFileUrl(path) {
  const raw = String(path ?? '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) {
    return buildSuperAdminUrl(raw.startsWith('/') ? raw : `/${raw}`).replace('/SchoolMentorSuperAdminAPI/Manuals', '/Manuals');
  }
  try {
    const u = new URL(raw);
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && u.protocol === 'http:') {
      u.protocol = 'https:';
      u.port = '';                       // https par 4100 jaisa http port nahi chalta
      return u.toString();
    }
  } catch { /* parse na ho to jaisa hai waisa */ }
  return raw;
}

/* YouTube ka koi bhi link → embed URL.

   API share-link deti hai ("https://youtu.be/hqSq54V9rO0?si=…"), aur YouTube
   aise link ko iframe me chalne NAHI deta (X-Frame-Options) — modal khali
   reh jata hai. Video id nikal kar /embed/ wala URL banana zaroori hai.
   Non-YouTube link jaisa hai waisa hi chala jata hai. */
export function toEmbedUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  let id = '';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be')                 id = u.pathname.slice(1);
    else if (/youtube\.com$/.test(host)) {
      if (u.pathname === '/watch')           id = u.searchParams.get('v') || '';
      else if (u.pathname.startsWith('/embed/'))  return raw;      // pehle se embed
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || '';
      else if (u.pathname.startsWith('/live/'))   id = u.pathname.split('/')[2] || '';
    } else return raw;                                            // koi aur video host
  } catch {
    return raw;
  }
  id = id.split(/[?&/]/)[0];
  return id ? `https://www.youtube.com/embed/${id}` : raw;
}

/** Manual heads → category tabs ({ id, label, icon, totalManuals }). */
export async function getManualHeads() {
  const res = await fetch(HEAD_URL(), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get', id: 0, manualHeadName: '', description: '',
      isActive: true, totalManuals: 0, createdBy: 0, modifiedBy: 0,
    }),
  });
  const rows = await readJson(res, 'manual heads');
  return rows
    .filter((h) => h?.isActive !== false)
    .map((h) => ({
      id:    Number(h?.id) || 0,
      label: String(h?.manualHeadName ?? '').trim() || 'Untitled',
      desc:  String(h?.description ?? '').trim(),
      icon:  iconForHead(h?.manualHeadName),
      totalManuals: Number(h?.totalManuals) || 0,
    }))
    .filter((h) => h.id);
}

/* multipart body — manual-detail / manual-form dono isi shakl me lete hain. */
function fd(fields) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v == null ? '' : String(v)));
  return form;
}

/** Ek head ke manuals → wahi shape jo SchoolSOPs page padhta hai. */
export async function getManuals(headId) {
  if (!Number(headId)) return [];
  const res = await fetch(DETAIL_URL(), {
    method: 'POST',
    headers: authHeaders(),                     // Content-Type browser khud lagata hai
    body: fd({ Action: 'get', ID: 0, ManualHeadID: headId }),
  });
  const rows = await readJson(res, 'manuals');
  return rows
    .filter((m) => m?.isActive !== false)
    .map((m, i) => ({
      id:       Number(m?.id) || 0,
      sno:      i + 1,
      title:    String(m?.manualTitle ?? '').trim() || 'Untitled manual',
      code:     String(m?.manualCode ?? '').trim(),
      category: Number(m?.manualHeadID ?? headId) || 0,
      description: String(m?.shortDescription ?? '').trim(),
      pdfUrl:   sopFileUrl(m?.pdfPath),
      pdfName:  fileNameFrom(m?.pdfPath),
      hasTutorial: Boolean(m?.tutorialAvailable) && Boolean(String(m?.youtubeURL ?? '').trim()),
      videoUrl: toEmbedUrl(m?.youtubeURL),      // share-link → embed URL
      videoLink: String(m?.youtubeURL ?? '').trim(),   // asli link (naye tab me kholne ke liye)
      videoTitle: String(m?.videoTitle ?? '').trim(),
      videoDesc:  String(m?.videoDescription ?? '').trim(),
      lastUpdated: fmtDate(m?.modifiedAt || m?.createdAt),
      forms: (Array.isArray(m?.forms) ? m.forms : []).map(mapForm),
    }))
    .filter((m) => m.id);
}

/**
 * Ek manual ke saath kitni forms judi hain.
 * Jis manual ki koi form na ho us par API 404 + success:false deti hai
 * ("No forms found…") — wo ghalti nahi, sirf khali halat hai, is liye 0.
 */
export async function getFormsCount(manualId) {
  try {
    return (await getForms(manualId)).length;
  } catch {
    return 0;
  }
}

/** Ek manual ki forms. */
export async function getForms(manualId) {
  if (!Number(manualId)) return [];
  const res = await fetch(FORM_URL(), {
    method: 'POST',
    headers: authHeaders(),
    body: fd({ Action: 'get', ID: 0, ManualDetailID: manualId }),
  });
  const rows = await readJson(res, 'forms');
  return rows.map(mapForm).filter((f) => f.id);
}

function mapForm(f) {
  const path = String(f?.formPath ?? '');
  const fileName = fileNameFrom(path);
  const title = String(f?.formName ?? '').trim();
  return {
    id:       Number(f?.id) || 0,
    manualId: Number(f?.manualDetailID ?? f?.manualDetailId) || 0,
    title:    title || fileName || 'Untitled form',
    code:     String(f?.formCode ?? '').trim(),
    pageRef:  String(f?.reference ?? '').trim(),
    desc:     String(f?.shortDescription ?? '').trim(),
    fileUrl:  sopFileUrl(path),
    fileName,
  };
}

/* "2026-08-06T00:43:02.06" → "06 Aug 2026" (page isi andaz me dikhata hai). */
function fmtDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
