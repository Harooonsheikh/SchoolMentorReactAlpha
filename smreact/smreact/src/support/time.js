/* ════════════════════════════════════════════════════════════════════
   Support ke timestamps ko sahi waqt par lana — MOJOODA API KI KHARABI KA HAAL.

   Masla (live naapa gaya):
     Server ka Date header : Wed, 12 Aug 2026 11:07 GMT  →  4:07 PM (PKT)
     Usi lamhe bheja message: "createdAt": "2026-08-12T04:07:21.22"
   Farq theek 12 ghante ka hai — timezone ka nahi (timezone hota to 11:07 aata).
   Aur poore data me kisi bhi timestamp ka ghanta 12 se zyada hai hi nahi
   (session ke 32 messages: 01,02,03,04,07 — koi 13/16/19 nahi). Yani API waqt
   12-ghante ki clock (`hh`) me likhti hai aur AM/PM gira deti hai, bagair kisi
   offset ke.

   Is ka matlab: har timestamp ke DO imkaan hain — T aur T+12h. Yahan wo chunte
   hain jo abhi ke waqt se mail khata ho: jo guzar chuka ho (aane wala na ho)
   aur "ab" ke zyada qareeb ho. Taza guftagu — yani jo screen par nazar aati
   hai — is se hamesha durust dikhti hai.

   HAD (jaan bujh kar): agar koi paighaam WAQAI subah aaya ho aur usay 12 ghante
   baad dekha jaye, to wo shaam ka dikhega. Ye maloomat server par mit chuki
   hai; "04:07" se ye jaanne ka koi tareeqa nahi ke 4 baje subah thi ya shaam.

   ASAL HAL (backend): waqt `HH` (24-ghante) me likhein — behtar ye ke
   GETUTCDATE() se UTC store karein aur ISO-8601 me `Z`/offset ke sath wapas
   bhejein. Us din ye poori file hata di jaye aur seedha `new Date(iso)` chale.
   ════════════════════════════════════════════════════════════════════ */

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
/* Client aur server ki ghari me thora farq mumkin hai — abhi abhi bheja hua
   paighaam "aane wala" na gina jaye. */
const CLOCK_SKEW_MS = 2 * 60 * 1000;

/**
 * API ka timestamp → sahi Date.
 * Bina offset wali string ko browser local (PKT) samajhta hai, jo hamare liye
 * theek hai; sirf AM/PM wapas lagana hota hai.
 */
export function serverDate(iso) {
  if (!iso) return null;
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) return null;
  /* Pehle se offset/Z ke sath aaye (yani backend theek ho chuka ho) to haath
     mat lagao — tab timestamp me koi ambiguity hai hi nahi. */
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(String(iso).trim())) return base;
  const shifted = new Date(base.getTime() + TWELVE_HOURS_MS);
  return shifted.getTime() <= Date.now() + CLOCK_SKEW_MS ? shifted : base;
}

/** "04:07 PM" */
export function formatServerTime(iso) {
  const d = serverDate(iso);
  return d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Aug 2026" */
export function formatServerDate(iso) {
  const d = serverDate(iso);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2 min ago" — list me aakhri activity ke liye. */
export function serverSince(iso) {
  const d = serverDate(iso);
  if (!d) return '—';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
