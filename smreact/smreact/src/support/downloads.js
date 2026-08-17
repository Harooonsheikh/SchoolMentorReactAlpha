/* ════════════════════════════════════════════════════════════════════
   Kaunsi attachment download ho chuki — sirf dikhane ke liye.

   Server par is ka koi record nahi (na koi API), aur browser ye bhi nahi bata
   sakta ke user ne file kholi ya nahi. Is liye jab user download par click
   karta hai to hum wahi yaad rakh lete hain, taake bubble par download ka icon
   "ho gaya" wale nishan me badal jaye. localStorage me rakhne se refresh ke
   baad bhi yaad rehta hai.

   Key file ka URL hai (har attachment ka apna GUID hota hai), warna message id
   + naam. Ye per-browser hai — doosri machine par nishan nahi hoga, jo theek
   hai kyunki download bhi usi machine par hua tha.
   ════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'sm_support_downloaded';

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = new Set(Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []);
  } catch (e) {
    cache = new Set();
  }
  return cache;
}

/** Is attachment ka pehchan — URL behtar hai (har file ka alag). */
export const downloadKey = (url, fallback) => String(url || fallback || '');

export function isDownloaded(key) {
  return Boolean(key) && load().has(String(key));
}

export function markDownloaded(key) {
  if (!key) return;
  const set = load();
  if (set.has(String(key))) return;
  set.add(String(key));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch (e) { /* storage band ho to sirf is session me yaad rahega */ }
}
