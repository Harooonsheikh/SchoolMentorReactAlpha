import { buildUrl, resolveMediaUrl, MEDIA_BASE } from '../../utils/apiConfig';

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
   Chat ki har ID LOGIN user id hai — get-contact-list row ki `userId`
   (employeeId NAHI). Misal: Ahmad Tariq sh userId 141 / employeeId 66,
   ANUS ALi 144 / 69. fromUserId / toUserId / userId — bhejna, conversation,
   seen, contacts aur unseen count — sab isi par.
     apni id     → chatUserId()     = session `UserID`   (141)
     contact id  → row.userId                            (144)
     {empID}     → chatEmployeeId() = session `employee_ID` (66) — SIRF
                   get-contact-list ke liye, swagger bhi `{empID}` kehta hai.

   ── Contacts me ek hi shakhs ki kai rows ──
   get-chat-contacts har PARENT-STUDENT jodi ki alag row deta hai, is liye ek
   hi walid (userId) 5 baar aa sakta hai — har bachay ke saath. Chat userId par
   hoti hai, bachay par nahi, is liye yahan rows ko userId par merge kiya jata
   hai: unseenCount jama, aur saare bachay `students[]` me.

   ── Attachment: sirf post-chat-message ═══
   File (image / video / voice / document) bhi usi EK call me jati hai:
   `Attachment` = file, `AttachmentType` = qism (image | video | voice |
   pdf / docx …). /upload-notice-image ab chat me istemal NAHI hota.
   Backend file rakh kar row ka `attachmentUrl` bharta hai, aur padhte waqt
   wohi istemal hota hai.

   Purane messages (aur mobile app ke kuch) me rasta MESSAGE ke andar likha hota
   hai: "homework.pdf /UploadedImages/homework_<guid>.pdf". Padhte waqt pehle ye
   rasta dhoondte hain (UPLOAD_DIR_RE); na mile to attachmentUrl.

   `attachmentType` do shakloon me aata hai — category ("image"/"video"/"voice"/
   "pdf"/"docx") ya extension ("png"/"mp4"/purana default "dat") — attachKind
   dono samajhta hai.
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

/** Logged-in user ki chat id — login `UserID` (get-contact-list ki `userId`
    jaisi: Ahmad Tariq sh 141, jab ke uska employeeId 66). employee_ID sirf
    get-contact-list ke {empID} me jata hai — chatEmployeeId(). */
export function chatUserId() {
  const raw = sessionStorage.getItem('UserID') || sessionStorage.getItem('employee_ID');
  return Number(raw) || 0;
}

/** get-contact-list ki id — HR wala employee number (`employee_ID`). */
export function chatEmployeeId() {
  const raw = sessionStorage.getItem('employee_ID') || sessionStorage.getItem('UserID');
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

/* Bhejte waqt AttachmentType — file ki EXTENSION (png / mp4 / weba / pdf …).
   Category naam ("image" / "video" / "voice") backend qubool nahi karta: live
   (18-09-2026) messages 936/937/938 un naamon ke saath gaye aur row me "dat"
   mehfooz hua, jab ke 939 par "pdf" jyun ka tyun raha. Voice note ki file
   pehle se ".weba" (ya m4a/ogg) extension ke saath banti hai, is liye wo video
   nahi samjhi jati. Padhne wala (attachKind) extension se qism nikalta hai. */
function attachmentTypeFor(file) {
  const ext = fileExt(file);
  if (ext) return ext;
  const mime = String((file && file.type) || '').toLowerCase();
  const sub = mime.split('/')[1]?.split(';')[0] || '';
  if (mime.startsWith('audio/')) return sub === 'webm' ? 'weba' : (sub || 'weba');
  return sub || 'dat';
}

/* Upload se pehle file ki qism — sirf label chunne ke liye. */
function fileKind(file) {
  const mime = String((file && file.type) || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'voice';
  if (mime.startsWith('video/')) return 'video';
  return attachKind(attachmentTypeFor(file), 'x');
}

/* ── contacts ────────────────────────────────────────────────────── */

/* Parent row me `name` BACHAY ka naam hota hai (designation "Parent"), staff row
   me khud staff ka. Khali naam wali rows bhi aati hain — inhe skip kar ke pehla
   maujood naam liya jata hai. */
function contactLabel(row) {
  return String(row.name || '').trim();
}

/* Row ka `name` khali aaye to uski jaga kya likhein?
   Parent row par walid ka naam sab se behtar pehchan hai ("Parent of Nadeem"),
   magar STAFF row par `fatherName` us mulazim ke APNE walid ka naam hai — us par
   "Parent of …" laga dene se mulazim "New Chat › Staff" ke khane me parent ban
   kar dikhta hai. get-contact-list me aisi rows waqai maujood hain (name "" +
   fatherName "Zulfiqar", status "Staff"). Staff ke liye is liye sirf id, jo har
   row par alag rehti hai; designation waise hi neeche wali line par dikh jata hai. */
function fallbackName(isParent, father, id) {
  if (isParent) return father ? `Parent of ${father}` : `Parent #${id}`;
  return `Staff #${id}`;
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

/* get-chat-contacts ki row ka `userId` wahi id hai jo message table me hai —
   yahi chat id. Staff row ka `registerationNo`/naam backend kisi DOOSRE account
   se jor kar deta hai: live (branch 15) 66 ki list me row `userId 215` (Abid
   Khan, jis ne asal me message bheja) magar `registerationNo 94` + naam
   "aHMAD 5 TEST". Pehle reg ko id maana jata tha, is liye unread badge ghalat
   chat par jata tha. Staff ka sahi naam Chat.jsx directory (get-contact-list)
   se lagata hai. */
function chatIdOf(row) {
  return Number(row.userId ?? row.employeeId) || 0;
}

/** Kai rows (ek hi userId, alag bachay) ko ek contact me merge karo. */
function mergeContacts(rows) {
  const byUser = new Map();
  (rows || []).forEach(row => {
    const userId = chatIdOf(row);
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
    name: c.name || fallbackName(c.isParent, c.father, c.userId),
  }));
}

/** Jin se pehle baat ho chuki — sidebar ki recent list. */
export async function fetchChatContacts(branchId, userId) {
  const res = await fetch(buildUrl(`/get-chat-contacts/${branchId}/${userId}`), { headers: authHeaders() });
  const json = await readJson(res, 'chat contacts');
  return mergeContacts(json?.data);
}

/* Staff rows par do safaiyan. Parents par ye laagu NAHI hotin — ek hi walid
   ke do bachay do alag classon me alag alag dikhne chahiyen, is liye wo
   merge nahi hotin (neeche fetchContactList ka note dekhein).
     1. Jis mulazim ka HR record me naam hi nahi, usay list me mat dikhao —
        us par koi qabil-e-pehchan label banta hi nahi.
     2. Ek hi mulazim ki kai rows — wahi registerationNo, alag userId (API 421
        rows me "test1 test" regNo 19 ki 13 rows deti hai) — sirf ek dafa.
        Pehli row rakhi jati hai; chat waise bhi userId par khulti hai. */

function dedupeStaff(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    if (r.isParent) return true;
    if (!r.hasName) return false;
    const key = r.regNo || `u${r.userId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * "New Chat" ki directory — staff + classes (bachon ke walidain).
 * Classes API khud employee ke hisaab se deti hai (live, branch 15):
 *   School Head 66 → saari 7 classes + Staff
 *   ANUS 69        → sirf assigned "Class 3 - B White" / "Class 3 - A Green" + Staff
 *   Lecturer 94    → sirf Staff
 * Row ki `userId` hi us shakhs ki chat id hai — bhejna, conversation aur seen
 * sab isi par chalte hain (apni id session ke `employee_ID` se, chatUserId()).
 */
export async function fetchContactList(branchId, empId) {
  const res = await fetch(buildUrl(`/get-contact-list/${branchId}/${empId}`), { headers: authHeaders() });
  const json = await readJson(res, 'contact list');
  const rows = (json?.data || []).map(row => {
    const id = Number(row.userId ?? row.employeeId) || 0;
    const name = contactLabel(row);
    const father = String(row.fatherName || '').trim();
    const parent = isParentRow(row);
    return {
      userId: id,
      name: name || fallbackName(parent, father, id),
      hasName: !!name,
      father,
      rel: String(row.designation || '').trim() || String(row.status || '').trim(),
      status: String(row.status || '').trim(),
      isParent: parent,
      group: groupLabel(row),
      grade: String(row.grade || '').trim(),
      section: String(row.section || '').trim(),
      regNo: String(row.registerationNo || '').trim(),
      picture: contactPicture(row.picture),
      /* Parent row bina userId ke — walid ka login account bana hi nahi
         (live, branch 15: Fanan Ahmed "Class II - B", M Rafique "C12 - A Red",
         Qamar Jutt "Class 3 - A Green"). Pehle ye rows gira di jati thin, is
         liye class ka ginti kam aati thi aur jis class me sirf aisa bacha ho
         wo class hi gayab ho jati thi. Ab dikhte hain, magar chat nahi khulti. */
      noAccount: !id,
    };
  }).filter(r => r.userId || r.isParent);
  return dedupeStaff(rows);
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
    const mine = (json?.data || []).filter(r => chatIdOf(r) === Number(meId));
    /* Contact ki list me hoon hi nahi → backend is jodi ko ginta hi nahi
       (live: ANUS 69 → Abid 215, Abid ne dekha nahi, list khaali). Pata nahi
       dekha ya nahi — null = grey double tick, jhoota blue tick nahi. */
    if (!mine.length) return null;
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

/* ─── Chat files: {MEDIA_BASE}/ChatAssests/{fileName} ───
   Backend chat ki file /ChatAssests/ folder me rakhta hai, naam GUID + extension:
     https://alphaapi.schoolmentor.ai/ChatAssests/4f9f224c-…-0bdd3ebb3bd1.png  (200)
   Response me jo bhi file ka naam aaye — alag field me, ya attachmentUrl ke
   aakhri hisse me ("…/4f9f….png", ya poora …/ChatAssests/… rasta) — usay
   ChatAssests ke baad laga dete hain. Host hamesha MEDIA_BASE (https), kyunke
   API url par http://IP:4100 bhi laga deti hai jo https site par block hota.
   Purane rows ka aakhri hissa sirf id hota hai ("…/ChatAttachments/947",
   extension nahi) — un par koi naam nahi banta. (Folder ka naam backend ki
   spelling me hai: "Assests".) */
const CHAT_ASSET_DIR = '/ChatAssests/';
const FILE_NAME_RE = /^[^/\\?#]+\.[A-Za-z0-9]{1,6}$/;

function chatAssetUrl(row) {
  const named = [row.attachmentName, row.fileName, row.attachment, row.attachmentPath, row.attachmentFileName]
    .map(v => String(v || '').trim()).find(Boolean);
  const candidates = [named, String(row.attachmentUrl || '').trim()].filter(Boolean);
  for (const c of candidates) {
    const noQuery = c.split(/[?#]/)[0];
    const at = noQuery.toLowerCase().indexOf(CHAT_ASSET_DIR.toLowerCase());
    const name = at >= 0 ? noQuery.slice(at + CHAT_ASSET_DIR.length) : noQuery.split('/').pop();
    if (name && FILE_NAME_RE.test(name)) return `${MEDIA_BASE}${CHAT_ASSET_DIR}${encodePath(name)}`;
  }
  return '';
}

/** Ek message row → bubble ka shape (MessageBubble isi ko samajhta hai). */
function mapMessage(row, meId) {
  const at = parseDate(row.createdDateTime);
  const message = decodeEntities(row.message);

  const pathAt = message.search(UPLOAD_DIR_RE);
  const path = pathAt >= 0 ? message.slice(pathAt).trim() : '';
  /* Rasta text me se nikaal do — user ko sirf uska likha hua label dikhe. */
  const label = (pathAt >= 0 ? message.slice(0, pathAt) : message).replace(/\s+/g, ' ').trim();

  /* Purana attachmentUrl (…/APIBeta/Img/ChatAttachments/{id}) kisi host par
     chalta nahi (404) — us par request bhejte hi nahi. Qism phir bhi usi se
     pehchani jati hai (attachment hai), bas bubble "unavailable" dikhata hai. */
  const assetUrl = chatAssetUrl(row);
  const rawUrl = path ? resolveMediaUrl(encodePath(path))
    : (assetUrl || resolveMediaUrl(row.attachmentUrl));
  const url = BROKEN_MEDIA_RE.test(rawUrl) ? '' : rawUrl;
  /* Qism pehle asli file ke naam se (sab se bharosemand), warna API ke
     attachmentType se — wo "png", "pdf", "image", ya default "dat" ho sakta hai. */
  const nameExt = fileExt(path) || fileExt(assetUrl);
  const ext = nameExt || String(row.attachmentType || '').toLowerCase().replace(/^\./, '');
  /* "dat" = backend ne qism kho di. Hamara bheja label ("Voice message" /
     "Video") phir bhi bata deta hai ke file kya thi. */
  const typeHint = nameExt || row.attachmentType;
  const labelKind = { 'voice message': 'voice', 'voice note': 'voice', video: 'video' }[label.toLowerCase()];
  const kind = (String(typeHint || '').toLowerCase() === 'dat' && labelKind && rawUrl) ? labelKind : attachKind(typeHint, rawUrl);

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

/** Do users ke darmiyan poori guftagu — BHEJNE ki tarteeb (message id) se.
    Waqt par sort NAHI: backend kabhi kabhi createdDateTime 12 ghante aage likh
    deta hai (live: 946 "Photo" = 18-09 15:18, jab ke us ke BAAD bheja 957 "hi"
    = 04:45). Waqt se sort karne par 946 hamesha sab se neeche aata tha — lagta
    tha har naye message ke saath photo bhi ja rahi hai. Id hamesha barhti hai. */
export async function fetchConversation(meId, otherId, branchId) {
  const res = await fetch(buildUrl(`/get-conversation/${meId}/${otherId}/${branchId}`), { headers: authHeaders() });
  const json = await readJson(res, 'conversation');
  return (json?.data || []).map(row => mapMessage(row, meId))
    .sort((a, b) => ((Number(a.id) || 0) - (Number(b.id) || 0)) || (a.at - b.at));
}

/**
 * Staff ki woh chats jo get-chat-contacts nahi lautata.
 * Live (branch 15): 66 ↔ 69 ki 7 messages get-conversation me maujood hain,
 * phir bhi get-chat-contacts/15/66 khaali aata hai — is liye Ahmad ki left
 * list me ANUS kabhi nahi aata tha. Directory (get-contact-list) ke har staff
 * ki conversation dekh kar jin se messages hain unhe contact bana dete hain.
 * `knownIds` wale chhod diye jate hain — wo pehle hi list me hain.
 * Lautata hai: [{ contact, msgs }].
 */
export async function discoverStaffChats(branchId, meId, empId, knownIds = new Set(), batchSize = 6, directory = null) {
  const staff = (directory || await fetchContactList(branchId, empId))
    .filter(s => !s.isParent && s.userId !== meId && !knownIds.has(s.userId));
  const found = [];
  for (let i = 0; i < staff.length; i += batchSize) {
    const batch = staff.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(s =>
      fetchConversation(meId, s.userId, branchId).then(msgs => ({ s, msgs })).catch(() => null)));
    results.forEach(r => {
      if (!r || !r.msgs.length) return;
      const { s, msgs } = r;
      found.push({
        contact: {
          userId: s.userId, name: s.name, father: s.father, rel: s.rel, status: s.status,
          isParent: s.isParent, group: s.group, picture: s.picture, unread: 0, students: [],
        },
        msgs,
      });
    });
  }
  return found;
}

/* ─── Unread jo backend nahi ginta ───
   get-unseen-chat-count / get-chat-contacts sirf un contacts ka unseen dete
   hain jin ki id backend ke login-users join se mil jaye. ANUS (69) → Ahmad
   (66) ke unseen messages par dono 0 / khaali the (live, branch 15). Is liye
   aise (directory se mile) contacts ka unread yahan ginte hain: har contact
   ka aakhri DEKHA hua message id localStorage me, us ke baad aane wale
   contact ke messages = unread. Kisi contact ka record na ho to MERE aakhri
   bheje message ke baad wale uske messages unread — jawab diya tha to pehle
   wale dekhe hi the. (Pehle "pehli dafa sab dekha hua" maana jata tha; is se
   ANUS → Abid ka "salaam", jo naye code se pehle aaya tha, kabhi gina na gaya.) */
const seenKey = (branchId, meId) => `sm_chat_seen_${branchId}_${meId}`;

function readSeenStore(branchId, meId) {
  try { return JSON.parse(localStorage.getItem(seenKey(branchId, meId)) || 'null'); } catch (_) { return null; }
}
function writeSeenStore(branchId, meId, store) {
  try { localStorage.setItem(seenKey(branchId, meId), JSON.stringify(store)); } catch (_) { /* private mode */ }
}
const lastIncomingId = (msgs) => (msgs || [])
  .filter(m => m.type === 'recv' && Number.isFinite(Number(m.id)))
  .reduce((mx, m) => Math.max(mx, Number(m.id)), 0);

/** Contact ki conversation "dekh li" — aakhri aaya hua message id yaad rakho. */
export function markSeenLocally(branchId, meId, contactId, msgs) {
  const store = readSeenStore(branchId, meId) || { seen: {} };
  const next = Math.max(store.seen[contactId] || 0, lastIncomingId(msgs));
  if (store.seen[contactId] === next) return;
  store.seen[contactId] = next;
  writeSeenStore(branchId, meId, store);
}

/** { [contactId]: unread } — sirf in contacts ke liye jin ki history di gayi. */
export function localUnreadCounts(branchId, meId, historyById) {
  const seen = readSeenStore(branchId, meId)?.seen || {};
  const out = {};
  Object.entries(historyById || {}).forEach(([cid, msgs]) => {
    const list = msgs || [];
    let seenId = seen[cid];
    if (seenId == null) {
      /* record nahi → mera aakhri bheja hua message hi "yahan tak dekha" */
      seenId = list.filter(m => m.type === 'sent' && Number.isFinite(Number(m.id)))
        .reduce((mx, m) => Math.max(mx, Number(m.id)), 0);
    }
    out[cid] = list.filter(m => m.type === 'recv' && Number(m.id) > seenId).length;
  });
  return out;
}

/**
 * Sidebar badge ka total (Chat module band ho tab bhi) — do hisaab, jo bara ho:
 *   A) get-unseen-chat-count  (live: ANUS → Abid ka "salaam" isme 1 aaya,
 *      jab ke get-chat-contacts/15/215 khaali tha)
 *   B) get-chat-contacts ka unseenCount + directory ke staff jin ki chat API
 *      nahi lautati → localUnreadCounts
 */
export async function fetchChatUnreadTotal(branchId, meId, empId) {
  const [apiCount, apiContacts] = await Promise.all([
    fetchUnseenCount(branchId, meId),
    fetchChatContacts(branchId, meId).catch(() => []),
  ]);
  const contactsTotal = apiContacts.reduce((sum, c) => sum + (Number(c.unread) || 0), 0);
  const known = new Set(apiContacts.map(c => c.userId));
  const found = await discoverStaffChats(branchId, meId, empId, known).catch(() => []);
  const history = Object.fromEntries(found.map(({ contact, msgs }) => [contact.userId, msgs]));
  const local = localUnreadCounts(branchId, meId, history);
  return Math.max(apiCount, contactsTotal + Object.values(local).reduce((a, b) => a + b, 0));
}

/* File ka naam saaf karo — space aur URL me phansne wale characters underscore
   me ("Screenshot 2026-07-23 151237.png" jaise naam se URL me space aa jata
   tha). Extension jyun ki tyun rehti hai. */
function safeFileName(file) {
  const safe = String(file.name || 'attachment')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_(?=\.)/g, '');
  return safe || 'attachment';
}

/**
 * Message bhejo — text ho ya file (image / video / voice / document), sirf EK
 * call: POST /post-chat-message (multipart). File `Attachment` me aur uski
 * qism `AttachmentType` me jati hai; backend file khud rakhta hai aur row ka
 * `attachmentUrl` bharta hai. (Pehle file alag se /upload-notice-image par
 * chadhai jati thi — wo ab nahi hota.)
 */
export async function postChatMessage({ fromUserId, toUserId, branchId, message = '', file = null }) {
  let text = String(message || '').trim();

  if (file && !text) {
    /* Message khaali na jaye: mobile app jaisa aam label ("Photo" / "Video" /
       "Voice message"), aur document par file ka apna naam. */
    const kind = fileKind(file);
    text = kind === 'image' ? 'Photo'
      : kind === 'video' ? 'Video'
      : kind === 'voice' ? 'Voice message'
      : (file.name || 'Attachment');
  }

  const form = new FormData();
  form.append('FromUserID', String(fromUserId));
  form.append('ToUserID', String(toUserId));
  form.append('Message', text);
  form.append('BranchID', String(branchId));
  /* Swagger wala payload: text message par bhi AttachmentType=text aur khaali
     Attachment jata hai. Ye na bhejein to backend row me "dat" likh deta hai
     (messages 880/885), jab ke Swagger se bheji rows me "text" (879/884). */
  if (file) {
    form.append('AttachmentType', attachmentTypeFor(file));
    form.append('Attachment', file, safeFileName(file));
  } else {
    form.append('AttachmentType', 'text');
    form.append('Attachment', '');
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
 * Swagger: /mark-messages-seen/{branchId}/{fromUserId}/{toUserId}
 *   fromUserId = logged-in user (meId)   — baqi chat APIs jaisa
 *   toUserId   = contact (contactUserId)   (get-chat-contacts, get-conversation)
 * Pehle contact ki id fromUserId me jati thi → updatedRows 0, unseen badge
 * kabhi saaf nahi hota tha.
 * NOTE: body khali hoti hai magar bhejni ZAROORI hai — bina Content-Length ke
 * IIS is POST ko 411 (Length Required) kar deta hai.
 */
export async function markMessagesSeen(branchId, contactUserId, meId) {
  try {
    const res = await fetch(buildUrl(`/mark-messages-seen/${branchId}/${meId}/${contactUserId}`), {
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
