import { buildUrl, resolveMediaUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   CHAT — wiring to the API's "Chats" endpoints (swagger tag: Chats).

     GET  /get-chat-contacts/{branchId}/{fromUserId}      → jin se baat ho chuki
     GET  /get-conversation/{fromUserId}/{toUserId}/{branchId}
     POST /post-chat-message                (multipart/form-data)
     POST /mark-messages-seen/{branchId}/{fromUserId}/{toUserId}
     GET  /get-unseen-chat-count/{branchId}/{userId}
     GET  /get-contact-list/{branchId}/{empID}            → poori directory
     GET  /get-users-fcm-status/{branchID}                → app par logged-in?

   ── Kaun si ID? ──
   Chat ki har ID login response ki `id` hai (sessionStorage `UserID`), HR wala
   employee number NAHI. Misal: Qasim TEST ka UserID 213 hai aur uska HR number
   78 — chat contacts, conversation aur permissions sab 213 par chalte hain
   (`registerationNo` me 78 aata hai). Is liye chatUserId() `UserID` uthata hai.

   ── Contacts me ek hi shakhs ki kai rows ──
   get-chat-contacts har PARENT-STUDENT jodi ki alag row deta hai, is liye ek
   hi walid (userId) 5 baar aa sakta hai — har bachay ke saath. Chat userId par
   hoti hai, bachay par nahi, is liye yahan rows ko userId par merge kiya jata
   hai: unseenCount jama, aur saare bachay `students[]` me.

   ── Attachment: DO call, aur wajah ═══
   post-chat-message akela bhi file qubool kar leta hai, magar jo `attachmentUrl`
   wo row me likhta hai — {host}/APIBeta/Img/ChatAttachments/{messageId} — wo
   404 hai. Poora /APIBeta application hi kisi host par deploy nahi (alphaapi
   aur 50.190.164.42:4100 dono par `/APIBeta` khud 404). Yani file chali to
   jati hai, wapas kabhi nahi milti.

   Is liye backend guide wala tareeqa: pehle file /upload-notice-image par
   chadhao (field ka naam `file`), wahan se `/UploadedImages/…` rasta lo — wo
   200 aur sahi content-type ke saath serve hota hai — aur us raste ko MESSAGE
   ke andar likh do:
       "homework.pdf /UploadedImages/homework_<guid>.pdf"
   Padhte waqt pehle message me se ye rasta nikalte hain (UPLOAD_DIR_RE), na
   mile to hi purane attachmentUrl par girte hain. Mobile app bhi yehi karti
   hai, is liye dono taraf ke bheje huye attachment khulte hain.

   `attachmentType` do shakloon me aata hai — category ("image"/"video"/"pdf"/
   "docx") ya extension ("png"/"mp4"/purana default "dat") — attachKind dono
   samajhta hai, aur tarjeeh asli file ke naam ki extension ko deta hai.
   ═══════════════════════════════════════════════════════════════════ */

const authHeaders = () => {
  const token = sessionStorage.getItem('token');
  return { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

async function readJson(res, label) {
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || `Could not load ${label}`);
  }
  return json;
}

/** Logged-in user ki chat id — login `id`, warna employee_ID par fallback. */
export function chatUserId() {
  const raw = sessionStorage.getItem('UserID') || sessionStorage.getItem('employee_ID');
  return Number(raw) || 0;
}

export function chatBranchId() {
  return Number(sessionStorage.getItem('branchID')) || 0;
}

/* ── helpers ─────────────────────────────────────────────────────── */

/* Mobile app HTML entities ke saath message bhejta hai ("Hello&nbsp;"), is liye
   dikhane se pehle decode. Sirf text nikalte hain — kahin innerHTML nahi hota. */
const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&apos;': "'",
};
function decodeEntities(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, m => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

/* ─── Waqt: server ka time zone → dekhne wale ka local ───
   API "2026-09-07T03:57:43.53" bhejti hai — bina kisi timezone nishan ke. Ye
   UTC NAHI hai: API server US Pacific par chalta hai, is liye ye uska LOCAL
   waqt hai. Browser ise seedha dikhaye to 12 ghante ka farq aata hai —
   Pakistan UTC+5, server UTC−7 — aur 3:57 pm ka message "3:57 am" dikhta hai
   (digits wahi, sirf am/pm ulat). Live tasdeeq (7 Sep 2026):
       PKT 16:01 · UTC 11:01 · Los Angeles 04:01 · DB ka naya message 03:57

   Sirf "UTC maan lena" kaafi nahi hota — us se 03:57 → 8:57 am banta, jo phir
   bhi ghalat hai. Is liye stamp ko SERVER_TIMEZONE me padha jata hai aur asli
   lamha nikaal kar dekhne wale ke apne waqt me dikhaya jata hai. Intl khud DST
   sambhalta hai (PDT −7 / PST −8), koi jama-tafreeq hard-code nahi.

   ── Backend theek ho jaye to? ──
   Jis din API 'Z' ya '+05:00' ke saath bhejne lage, neeche wala check use
   khud pehchan kar seedha parse kar dega — yahan kuch badalna nahi paray ga.
   Aur agar API server kisi aur mulk shift ho jaye to sirf ye ek line badlegi. */
const SERVER_TIMEZONE = 'America/Los_Angeles';

/* Kisi lamhe par us timezone ka offset (ms) — DST samet. */
function tzOffsetMs(instant, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
    );
    return asUtc - instant.getTime();
  } catch (_) {
    return 0;   // Intl na chale to jo hai wohi sahi maan lo
  }
}

function parseDate(raw) {
  if (!raw) return null;
  const text = String(raw).trim();

  // Pehle se timezone likha ho ('Z' ya '+05:00') to browser khud sahi parse karega
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?/);
  if (!m) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h, mi, s = '0', frac = ''] = m;
  const ms = frac ? Number(frac.padEnd(3, '0').slice(0, 3)) : 0;
  /* Pehle in ginti ko UTC maan kar ek lamha banao, phir SERVER_TIMEZONE ka us
     waqt ka offset hata kar asli lamha nikalo. Dobara jaanchte hain taake DST
     badalne wale din bhi theek rahe. */
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms);
  const firstGuess = asUtc - tzOffsetMs(new Date(asUtc), SERVER_TIMEZONE);
  const real = asUtc - tzOffsetMs(new Date(firstGuess), SERVER_TIMEZONE);
  const out = new Date(real);
  return Number.isNaN(out.getTime()) ? null : out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeLabel(d) {
  if (!d) return '';
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}:${m < 10 ? '0' : ''}${m} ${h >= 12 ? 'pm' : 'am'}`;
}

/** Date separator: aaj / kal / "28 Aug 2026". */
function dateLabel(d) {
  if (!d) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const DOC_EXT   = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar'];
const VIDEO_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'amr', 'opus', 'weba'];

/* AttachmentType do shakloon me aata hai: mobile app aur backend guide ki
   "category" (image | video | pdf | docx), aur purani rows ki EXTENSION
   ("png", "mp4", ya default "dat"). Dono ko sambhalte hain. */
const TYPE_CATEGORY = {
  image: 'image', photo: 'image', picture: 'image',
  video: 'video', movie: 'video',
  audio: 'voice', voice: 'voice',
  document: 'doc', file: 'doc',
};

/** Extension ya category → bubble ki qism. URL na ho to koi attachment nahi. */
function attachKind(type, url) {
  if (!url) return null;
  const t = String(type || '').toLowerCase().replace(/^\./, '').trim();
  if (TYPE_CATEGORY[t])  return TYPE_CATEGORY[t];
  if (DOC_EXT.includes(t))   return 'doc';
  if (VIDEO_EXT.includes(t)) return 'video';
  if (AUDIO_EXT.includes(t)) return 'voice';
  return 'image';   // jpg/png/… aur mobile ka default "dat"
}

/** File ke naam ki extension. */
function fileExt(file) {
  const name = (typeof file === 'string' ? file : (file && file.name)) || '';
  const m = name.match(/\.([A-Za-z0-9]+)(?:$|\?)/);
  return m ? m[1].toLowerCase() : '';
}

/* Bhejte waqt AttachmentType — file ki EXTENSION.
   Backend guide "image | pdf | docx | video" kehti hai, magar live test ne
   dikhaya ke backend un naamon ko sambhalta nahi: AttachmentType=image bheja
   to row me "dat" mehfooz hua (message 757), jab ke extension bhejne par wo
   jyun ki tyun rehti hai ("png" → 751, "mp4" → 753). Is liye extension, jo
   ziada maloomat deti hai aur wapas bhi sahi milti hai. Padhne wala (attachKind)
   dono shaklein samajhta hai, aur waise bhi qism ka faisla pehle asli file ke
   naam se hota hai — is liye "dat" aa jaye to bhi kuch bigadta nahi. */
function attachmentTypeFor(file) {
  return fileExt(file);
}

/* ── contacts ────────────────────────────────────────────────────── */

/* Parent row me `name` BACHAY ka naam hota hai (designation "Parent"), staff row
   me khud staff ka. Khali naam wali rows bhi aati hain — inhe skip kar ke pehla
   maujood naam liya jata hai. */
function contactLabel(row) {
  return String(row.name || '').trim();
}

/* Contact ki `picture` hamesha /APIBeta/Img/Image/{id} hoti hai — wahi application
   jo kisi host par deploy nahi (404). Us par request bhejne ka koi faida nahi:
   har avatar console me ek nakaam call chhorta hai aur dikhta phir bhi initials
   hi hai. Is liye aisi URL yahin gira dete hain. Jis din backend ye route bana
   dega, sirf ye check hatana hoga. */
const BROKEN_MEDIA_RE = /\/APIBeta\/Img\//i;
const contactPicture = (raw) => (raw && !BROKEN_MEDIA_RE.test(String(raw)) ? resolveMediaUrl(raw) : '');

/* Parent hai ya staff?
   API do khaane deti hai aur dono ki lugat thodi mukhtalif hai:
     parent  → designation "Parent",  status "Parent" (chat contacts)
                                   ya "Student" (contact list — row bachay ki hai)
     staff   → designation "Class Teacher"/"Head Teacher"/…,
               status "Staff" / "Teacher" / "School Head"
   App-status (FCM) ka nishan sirf parents par dikhana hai, is liye ye flag. */
const isParentRow = (row) => {
  const desig = String(row.designation || '').trim().toLowerCase();
  const status = String(row.status || '').trim().toLowerCase();
  return desig === 'parent' || status === 'parent' || status === 'student';
};

function groupLabel(row) {
  const grade = String(row.grade || '').trim();
  const section = String(row.section || '').trim();
  if (grade) return section ? `${grade} - ${section}` : grade;
  return String(row.designation || row.status || '').trim() || '—';
}

/** Kai rows (ek hi userId, alag bachay) ko ek contact me merge karo. */
function mergeContacts(rows) {
  const byUser = new Map();
  (rows || []).forEach(row => {
    const userId = Number(row.userId ?? row.employeeId) || 0;
    if (!userId) return;
    const student = {
      name: contactLabel(row),
      grade: String(row.grade || '').trim(),
      section: String(row.section || '').trim(),
      regNo: String(row.registerationNo || '').trim(),
    };
    const prev = byUser.get(userId);
    if (!prev) {
      byUser.set(userId, {
        userId,
        name: student.name,
        father: String(row.fatherName || '').trim(),
        rel: String(row.designation || '').trim() || String(row.status || '').trim(),
        status: String(row.status || '').trim(),
        isParent: isParentRow(row),
        group: groupLabel(row),
        picture: contactPicture(row.picture),
        unread: Number(row.unseenCount) || 0,
        students: student.name ? [student] : [],
      });
      return;
    }
    /* unseenCount JODI (from-user → to-user) par nikalta hai aur har duplicate
       row par wahi number dobara aata hai — is liye jama nahi, sab se bara. */
    prev.unread = Math.max(prev.unread, Number(row.unseenCount) || 0);
    if (!prev.name && student.name) { prev.name = student.name; prev.group = groupLabel(row); }
    if (!prev.picture) prev.picture = contactPicture(row.picture);
    if (student.name && !prev.students.some(s => s.name === student.name)) prev.students.push(student);
  });
  // Jis row ka naam kisi bhi bachay se na mila us par walid ka naam dikhao.
  return [...byUser.values()].map(c => ({
    ...c,
    name: c.name || (c.father ? `Parent of ${c.father}` : `User ${c.userId}`),
  }));
}

/** Jin se pehle baat ho chuki — sidebar ki recent list. */
export async function fetchChatContacts(branchId, userId) {
  const res = await fetch(buildUrl(`/get-chat-contacts/${branchId}/${userId}`), { headers: authHeaders() });
  const json = await readJson(res, 'chat contacts');
  return mergeContacts(json?.data);
}

/**
 * Poori directory — "New Chat" ke liye (parents + staff).
 * Yahan rows MERGE nahi hotin: browse class-wise hota hai, is liye ek hi walid
 * ke do bachay do alag class me alag alag dikhne chahiyen. Chat phir bhi `userId`
 * par hi khulti hai (jo dono rows me ek hi hai).
 */
export async function fetchContactList(branchId, userId) {
  const res = await fetch(buildUrl(`/get-contact-list/${branchId}/${userId}`), { headers: authHeaders() });
  const json = await readJson(res, 'contact list');
  return (json?.data || []).map(row => {
    const id = Number(row.userId ?? row.employeeId) || 0;
    const name = contactLabel(row);
    const father = String(row.fatherName || '').trim();
    return {
      userId: id,
      name: name || (father ? `Parent of ${father}` : `User ${id}`),
      father,
      rel: String(row.designation || '').trim() || String(row.status || '').trim(),
      status: String(row.status || '').trim(),
      isParent: isParentRow(row),
      group: groupLabel(row),
      grade: String(row.grade || '').trim(),
      section: String(row.section || '').trim(),
      regNo: String(row.registerationNo || '').trim(),
      picture: contactPicture(row.picture),
    };
  }).filter(r => r.userId);
}

/** Un users ke ids jinke paas FCM token hai (yani app par logged in hain). */
export async function fetchAppUserIds(branchId) {
  try {
    const res = await fetch(buildUrl(`/get-users-fcm-status/${branchId}`), { headers: authHeaders() });
    const json = await readJson(res, 'app users');
    return new Set((json?.data || []).filter(r => Number(r.hasFcmToken) === 1)
      .map(r => Number(r.employee_ID)).filter(Boolean));
  } catch (_) {
    return new Set();   // sirf "app par hai ya nahi" ka nishan hai — chat phir bhi chalti hai
  }
}

/**
 * Read receipt (blue tick) ke liye: contact ne MERI kitni messages abhi tak
 * nahi dekhin.
 *
 * get-conversation me koi seen/unseen khana nahi hai, is liye ye ULTA raste se
 * nikalta hai — contact ki apni chat list maango aur us me MERI row ka
 * unseenCount dekho. Tasdeeq shuda: user 218 ki list me 213 ka unseenCount 1
 * tha aur wahi 1 message (id 725, 213 → 218) sab se aakhri tha.
 *
 * Duplicate rows par wahi number dobara aata hai, is liye MAX (jama nahi).
 * Pata na chal sake to `null` — us surat me UI blue tick nahi dikhata.
 */
export async function fetchUnseenFromMe(branchId, contactUserId, meId) {
  try {
    const res = await fetch(buildUrl(`/get-chat-contacts/${branchId}/${contactUserId}`), { headers: authHeaders() });
    const json = await readJson(res, 'read receipts');
    const mine = (json?.data || []).filter(r => Number(r.userId ?? r.employeeId) === Number(meId));
    if (!mine.length) return 0;   // contact ki list me hoon hi nahi → kuch pending nahi
    return mine.reduce((max, r) => Math.max(max, Number(r.unseenCount) || 0), 0);
  } catch (_) {
    return null;
  }
}

/**
 * Bhejte hi dikhne wala local bubble (server ka jawab aane se pehle) — isi par
 * single grey tick chalta hai. File ho to preview local object URL se banta hai;
 * bhejne ke baad caller usay revoke kar deta hai.
 */
export function pendingMessage({ text = '', file = null }) {
  const now = new Date();
  const ext = file ? fileExt(file) : '';
  const url = file ? URL.createObjectURL(file) : '';
  const kind = attachKind(ext, url);
  return {
    id: `tmp_${now.getTime()}`,
    type: 'sent',
    text: String(text || '').trim(),
    attach: kind,
    url,
    ext,
    docName: kind === 'doc' ? (file.name || `Attachment.${ext}`) : '',
    label: '',
    time: timeLabel(now),
    date: dateLabel(now),
    at: now.getTime(),
    pending: true,
  };
}

/** Nav badge ke liye total unseen. */
export async function fetchUnseenCount(branchId, userId) {
  try {
    const res = await fetch(buildUrl(`/get-unseen-chat-count/${branchId}/${userId}`), { headers: authHeaders() });
    const json = await readJson(res, 'unseen count');
    return Number(json?.unseenChatCount) || 0;
  } catch (_) {
    return 0;
  }
}

/* ── conversation ────────────────────────────────────────────────── */

/* ─── Attachment ka asli rasta ───
   API jo `attachmentUrl` bhejti hai (…/APIBeta/Img/ChatAttachments/{id}) wo
   404 deta hai — us naam ka koi route server par hai hi nahi (dono hosts par
   tasdeeq shuda). Jo cheez waqai chalti hai wo `/UploadedImages/…` hai, aur
   mobile app usay MESSAGE ke andar likh kar bhejti hai:
       "homework.pdf /UploadedImages/homework_abc123.pdf"
   Is liye padhte waqt pehle message me se ye rasta nikalte hain; na mile to
   hi purane attachmentUrl par girte hain. Yehi tareeqa mobile app ka hai. */
/* Rasta message ke AAKHIR me hota hai, is liye folder milte hi wahan se aakhir
   tak sab kuch le lete hain — "pehla space aane tak" NAHI. File ke naam me
   space aam hai ("Screenshot 2026-07-23 151237_<guid>.png") aur space par rukne
   se URL kat jata tha (/UploadedImages/Screenshot → 404), jab ke poori encoded
   URL 200 deti hai. */
const UPLOAD_DIR_RE = /\/(?:UploadedImages|UploadedDocuments|Uploads)\//i;

/* URL me space waghera bhejna galat hai — har hissa encode karo. Pehle decode
   karte hain taake jo naam pehle se encoded ho wo dobara encode na ho jaye. */
function encodePath(path) {
  return String(path).split('/').map(seg => {
    let raw = seg;
    try { raw = decodeURIComponent(seg); } catch (_) { /* adhoora % — jyun ka tyun */ }
    return encodeURIComponent(raw);
  }).join('/');
}

/* "Photo" / "Video" jaise aam label sirf is liye bhejay jate hain ke message
   khaali na ho — bubble me tasveer ke neeche inhe dikhane ka koi faida nahi.
   Asli caption ("dekhein zara") phir bhi dikhta hai. */
const GENERIC_LABELS = new Set([
  'photo', 'image', 'picture', 'video', 'voice message', 'voice note',
  'audio', 'attachment', 'file', 'document',
]);

/* Upload par backend naam ke saath GUID laga deta hai
   ("homework_c3841409-….pdf") — dikhane ke liye wo GUID hata dete hain. */
const prettyFileName = (path) => {
  const raw = decodeURIComponent(String(path || '').split('/').pop() || '');
  return raw.replace(/_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\.[^.]*$)/i, '');
};

/** Ek message row → bubble ka shape (MessageBubble isi ko samajhta hai). */
function mapMessage(row, meId) {
  const at = parseDate(row.createdDateTime);
  const message = decodeEntities(row.message);

  const pathAt = message.search(UPLOAD_DIR_RE);
  const path = pathAt >= 0 ? message.slice(pathAt).trim() : '';
  /* Rasta text me se nikaal do — user ko sirf uska likha hua label dikhe. */
  const label = (pathAt >= 0 ? message.slice(0, pathAt) : message).replace(/\s+/g, ' ').trim();

  const url = path ? resolveMediaUrl(encodePath(path)) : resolveMediaUrl(row.attachmentUrl);
  /* Qism pehle asli file ke naam se (sab se bharosemand), warna API ke
     attachmentType se — wo "png", "pdf", "image", ya default "dat" ho sakta hai. */
  const ext = fileExt(path) || String(row.attachmentType || '').toLowerCase().replace(/^\./, '');
  const kind = attachKind(fileExt(path) || row.attachmentType, url);

  /* Doc bubble par file ka naam: agar label khud file-naam jaisa hai (mobile
     yehi bhejti hai) to wohi, warna uploaded file ka saaf kiya hua naam. */
  const labelLooksLikeFile = /\.[A-Za-z0-9]{2,5}$/.test(label);
  const docName = kind !== 'doc' ? ''
    : (labelLooksLikeFile ? label : (prettyFileName(path) || `Attachment-${row.id}.${ext || 'pdf'}`));

  /* Caption: aam label ("Photo") aur wo naam jo doc bubble par pehle hi dikh
     raha hai — dono chhod do. Text-only message hamesha jyun ka tyun. */
  const caption = !kind ? label
    : (kind === 'doc' && labelLooksLikeFile) ? ''
    : GENERIC_LABELS.has(label.toLowerCase()) ? ''
    : label;

  return {
    id: row.id,
    type: Number(row.fromUserID) === Number(meId) ? 'sent' : 'recv',
    text: caption,
    attach: kind,
    url,
    ext,
    docName,
    label: kind === 'image' || kind === 'video' ? caption : '',
    time: timeLabel(at),
    date: dateLabel(at),
    at: at ? at.getTime() : 0,
  };
}

/** Do users ke darmiyan poori guftagu (waqt ke hisaab se sorted). */
export async function fetchConversation(meId, otherId, branchId) {
  const res = await fetch(buildUrl(`/get-conversation/${meId}/${otherId}/${branchId}`), { headers: authHeaders() });
  const json = await readJson(res, 'conversation');
  return (json?.data || []).map(row => mapMessage(row, meId)).sort((a, b) => a.at - b.at);
}

/**
 * File ko asli file-host par chadhao aur uska chalne wala rasta lo.
 *   POST /upload-notice-image   (multipart, field ka naam: `file`)
 *   → { success, message, path: "/UploadedImages/homework_<guid>.pdf" }
 * Live tasdeeq: path 200 aur sahi content-type ke saath serve hota hai; PDF
 * bhi qubool hai (jawab ka "Image uploaded successfully" har qism par aata hai).
 */
async function uploadChatFile(file) {
  const form = new FormData();
  /* Backend file ko usi naam se rakhta hai jo hum bhejte hain, is liye naam
     pehle hi saaf kar dete hain: space aur URL me phansne wale characters
     underscore me. ("Screenshot 2026-07-23 151237.png" jaise naam se URL me
     space aa jata tha.) Extension jyun ki tyun rehti hai. */
  const safeName = String(file.name || 'attachment')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_(?=\.)/g, '');
  form.append('file', file, safeName || 'attachment');
  const res = await fetch(buildUrl('/upload-notice-image'), {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  const json = await res.json().catch(() => null);
  const path = json?.path || json?.Path || json?.data?.path;
  if (!res.ok || !path) {
    throw new Error((json && (json.message || json.Message)) || 'File could not be uploaded');
  }
  return String(path);
}

/**
 * Message bhejo.
 *
 * File ke saath DO call hoti hain, aur ye majboori hai: post-chat-message akela
 * bhi row bana deta hai, magar us row ka attachmentUrl (…/ChatAttachments/{id})
 * 404 hai — file kabhi wapas nahi milti. Is liye pehle file ko
 * /upload-notice-image par chadhate hain aur uska `/UploadedImages/…` rasta
 * MESSAGE ke andar likh dete hain ("label /UploadedImages/x.png"). Padhne wala
 * (ERP ho ya mobile app) wahin se file uthata hai.
 */
export async function postChatMessage({ fromUserId, toUserId, branchId, message = '', file = null }) {
  let text = String(message || '').trim();

  if (file) {
    const path = await uploadChatFile(file);
    /* Message = "label rasta". Label user ka caption hai; na ho to mobile app
       jaisa aam naam ("Photo" / "Video" / "Voice message"), aur document par
       file ka apna naam — kyunki doc bubble wahi naam dikhata hai. */
    const kind = attachKind(fileExt(file), path);
    const fallbackLabel = kind === 'image' ? 'Photo'
      : kind === 'video' ? 'Video'
      : kind === 'voice' ? 'Voice message'
      : (file.name || 'Attachment');
    text = `${text || fallbackLabel} ${path}`.trim();
  }

  const form = new FormData();
  form.append('FromUserID', String(fromUserId));
  form.append('ToUserID', String(toUserId));
  form.append('Message', text);
  form.append('BranchID', String(branchId));
  if (file) {
    form.append('AttachmentType', attachmentTypeFor(file));
    form.append('Attachment', file, file.name);
  }
  const res = await fetch(buildUrl('/post-chat-message'), {
    method: 'POST',
    headers: authHeaders(),   // Content-Type FormData khud lagata hai (boundary ke saath)
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || 'Message could not be sent');
  }
  return json;
}

/**
 * Contact ke bheje huay messages ko "seen" karo (chat kholte waqt).
 * Route {branchId}/{fromUserId}/{toUserId} hai — fromUserId wo hai jis ne
 * message bheja (contact), toUserId logged-in user.
 * NOTE: body khali hoti hai magar bhejni ZAROORI hai — bina Content-Length ke
 * IIS is POST ko 411 (Length Required) kar deta hai.
 */
export async function markMessagesSeen(branchId, contactUserId, meId) {
  try {
    const res = await fetch(buildUrl(`/mark-messages-seen/${branchId}/${contactUserId}/${meId}`), {
      method: 'POST',
      headers: authHeaders(),
      body: '',
    });
    const json = await res.json().catch(() => null);
    return Number(json?.updatedRows) || 0;
  } catch (_) {
    return 0;   // seen na ho paye to chat phir bhi khulni chahiye
  }
}
