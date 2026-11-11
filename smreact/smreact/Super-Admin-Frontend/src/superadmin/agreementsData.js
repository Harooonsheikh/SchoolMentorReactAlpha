/* ═══════════════════════════════════════════════════════════════════
   SCHOOL AGREEMENTS & LEGAL DOCUMENTS — static vocabulary

   Sirf constants: categories, file-type filters aur upload limits.
   Yahan koi demo record NAHI hai — har document, aur screen ka har
   aankra, live API se aata hai (see ./api/services/schoolAgreements).
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════ DOCUMENT CATEGORIES — chaar, har school ki apni ═══════════════
   Har school/branch ke documents inhi chaar qismon me bate hain. Server par
   category ek plain string hai (`DocumentCategory`) — wahi `label` save hota
   hai, aur documents hamesha BranchID + category dono se chhante jate hain.

   Purane documents (pehle "Signed Agreement", "School Contract",
   "Memorandum of Understanding (MoU)" waghaira naamon se save hue) DELETE ya
   rename nahi hote: `groupOf()` unhe padhte waqt qareebi qism me dikhata hai
   (MoU → MOU Documents, baaqi sab → Other Documents). */
export const DOC_GROUPS = [
  {
    id: 'mou', label: 'MOU Documents', icon: 'fa-handshake', color: '#7C3AED',
    blurb: 'Memorandums of understanding signed with this school',
  },
  {
    id: 'sales', label: 'Sales Related Documents', icon: 'fa-file-invoice-dollar', color: '#0F766E',
    blurb: 'Quotations, proposals, invoices and sales paperwork',
  },
  {
    id: 'online', label: '1Link Documents', icon: 'fa-link', color: '#0284C7',
    blurb: '1Link agreements and related documents',
  },
  {
    id: 'other', label: 'Other Documents', icon: 'fa-folder', color: '#64748B',
    blurb: 'Everything else held for this school',
  },
];

const GROUP_BY_ID = Object.fromEntries(DOC_GROUPS.map((g) => [g.id, g]));
export const docGroup = (id) => GROUP_BY_ID[id] || GROUP_BY_ID.other;

/** Stored category string → group id. Anjaan / purani qism → 'other'. */
export function groupOf(category) {
  const c = String(category || '').trim().toLowerCase();
  if (!c) return 'other';
  const exact = DOC_GROUPS.find((g) => g.label.toLowerCase() === c);
  if (exact) return exact.id;
  if (/\bmou\b|memorandum/.test(c)) return 'mou';
  if (/\bsales?\b/.test(c)) return 'sales';
  // 1Link — purane 'Online / Link Documents' records bhi isi category me rehte hain.
  if (/1\s*link|\bonline\b|\blinks?\b/.test(c)) return 'online';
  return 'other';
}

/** Upload / edit dropdowns aur document-type filter — chaaron qismein. */
export const DOC_CATEGORIES = DOC_GROUPS.map((g) => g.label);

/** Free-text category ab nahi hoti (chaar fixed qismein) — ye value kisi
    option se kabhi match nahi karti, is liye custom khana band rehta hai. */
export const CUSTOM_CATEGORY = '__custom__';

/* Category → badge ka rang (saStyles ke mojooda .b-* badges). */
const GROUP_BADGE = { mou: 'b-purple', sales: 'b-green', online: 'b-blue', other: 'b-gray' };
export const CATEGORY_BADGE = Object.fromEntries(DOC_GROUPS.map((g) => [g.label, GROUP_BADGE[g.id]]));

/** Online / link document ka URL sirf http(s) — javascript: waghaira kabhi nahi. */
export function validateLink(url) {
  const u = String(url || '').trim();
  if (!u) return 'Enter the document link.';
  let parsed;
  try { parsed = new URL(u); } catch { return `"${u}" is not a valid web address.`; }
  if (!/^https?:$/.test(parsed.protocol)) return 'Only http:// or https:// links can be saved.';
  return '';
}

/** Jo category list me nahi (custom) uska badge. */
export const categoryBadge = (c) => GROUP_BADGE[groupOf(c)] || 'b-gray';

/** Jo formats backend lega — input[accept] aur client-side validation dono. */
export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
export const FILE_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

/** Ek file ki hadd — backend par bhi yehi limit chahiye (handoff doc dekhein). */
export const MAX_FILE_MB = 15;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/* Extension → preview kis tarah hoga, aur list me kaunsa icon lage. */
const EXT_META = {
  pdf:  { kind: 'pdf',   icon: 'fa-file-pdf',   color: '#DC2626' },
  doc:  { kind: 'office', icon: 'fa-file-word',  color: '#2563EB' },
  docx: { kind: 'office', icon: 'fa-file-word',  color: '#2563EB' },
  jpg:  { kind: 'image', icon: 'fa-file-image', color: '#16A34A' },
  jpeg: { kind: 'image', icon: 'fa-file-image', color: '#16A34A' },
  png:  { kind: 'image', icon: 'fa-file-image', color: '#16A34A' },
};

/** "Agreement.PDF" / "/files/a b.docx?x=1" → 'pdf' | 'docx' | '' */
export function extOf(nameOrPath) {
  const clean = String(nameOrPath || '').split(/[?#]/)[0];
  const m = clean.match(/\.([a-z0-9]{1,6})$/i);
  return m ? m[1].toLowerCase() : '';
}

/** Ek file/path ka preview-kind + icon. Anjaan extension → generic file. */
export function fileMeta(nameOrPath) {
  return EXT_META[extOf(nameOrPath)] || { kind: 'other', icon: 'fa-file-lines', color: '#64748B' };
}

/** File-Type filter ka dropdown (category se alag — ye file ki shakal hai). */
export const FILE_TYPE_FILTERS = [
  { value: 'pdf',    label: 'PDF' },
  { value: 'office', label: 'Word (DOC / DOCX)' },
  { value: 'image',  label: 'Image (JPG / PNG)' },
];

/** Bytes → "1.4 MB" (0 bhi asli value hai, is liye khali nahi). */
export function fmtBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Chuni hui file ki jaanch — type aur size dono.
 * @returns {string} khali = theek; warna wo message jo toast par jata hai.
 */
export function validateFile(file) {
  if (!(file instanceof File)) return 'Please choose a file to upload.';
  const ext = extOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `"${file.name}" is not a supported format. Allowed: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" is ${fmtBytes(file.size)} — the limit is ${MAX_FILE_MB} MB.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  return '';
}

/* ═══════════════ AGREEMENT STATUS (asli tareekhon se) ═══════════════
   Chaaron haalatein sirf signingDate / expiryDate dekh kar banti hain —
   koi alag API field nahi, koi farz kiya hua number nahi:

     Pending Signature  signing date hai hi nahi (document chadh gaya,
                        dastkhat ki tareekh abhi darj nahi hui)
     Expired            expiry guzar chuki
     Expiring Soon      expiry aaj se EXPIRY_SOON_DAYS ke andar
     Active             expiry aage hai, ya expiry rakhi hi nahi
                        (open-ended agreement)
   ═══════════════════════════════════════════════════════════════════ */

/** "Expiring Soon" ki hadd — aaj se itne din. */
export const EXPIRY_SOON_DAYS = 60;

export const AGREEMENT_STATUS = {
  active: 'Active',
  soon: 'Expiring Soon',
  expired: 'Expired',
  pending: 'Pending Signature',
};

export const AGREEMENT_STATUS_OPTIONS = [
  { value: 'active',  label: AGREEMENT_STATUS.active,  badge: 'b-green' },
  { value: 'soon',    label: AGREEMENT_STATUS.soon,    badge: 'b-warn' },
  { value: 'expired', label: AGREEMENT_STATUS.expired, badge: 'b-red' },
  { value: 'pending', label: AGREEMENT_STATUS.pending, badge: 'b-gray' },
];

const STATUS_BADGE = Object.fromEntries(AGREEMENT_STATUS_OPTIONS.map((o) => [o.value, o.badge]));
export const statusBadge = (key) => STATUS_BADGE[key] || 'b-gray';
export const statusLabel = (key) => AGREEMENT_STATUS[key] || '';

/** 'YYYY-MM-DD' → din ka farq (today = 0). Khali/ghalat date → null. */
export function daysUntil(ymd, today) {
  const s = String(ymd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const ref = String(today || '').trim();
  const base = /^\d{4}-\d{2}-\d{2}$/.test(ref) ? ref : null;
  const d0 = base ? Date.UTC(+base.slice(0, 4), +base.slice(5, 7) - 1, +base.slice(8, 10))
    : (() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); })();
  const d1 = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d1 - d0) / 86400000);
}

/**
 * Ek document ka agreement status.
 * @param {{signingDate?:string, expiryDate?:string}} doc
 * @param {string} [today] 'YYYY-MM-DD' — test se fix tareekh dene ke liye
 * @returns {'active'|'soon'|'expired'|'pending'}
 */
export function agreementStatus(doc, today) {
  if (!String(doc?.signingDate || '').trim()) return 'pending';
  const left = daysUntil(doc?.expiryDate, today);
  if (left == null) return 'active';          // expiry rakhi hi nahi → open-ended
  if (left < 0) return 'expired';
  if (left <= EXPIRY_SOON_DAYS) return 'soon';
  return 'active';
}

/** Document list → har status ka count (sirf anhi rows se). */
export function countByStatus(docs, today) {
  const out = { active: 0, soon: 0, expired: 0, pending: 0 };
  (Array.isArray(docs) ? docs : []).forEach((d) => { out[agreementStatus(d, today)] += 1; });
  return out;
}
