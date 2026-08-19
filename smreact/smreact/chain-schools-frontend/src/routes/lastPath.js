/* ═══════════════════════════════════════════════════════════════════
   LAST VISITED PATH — sessionStorage me rakha jata hai.

   Maqsad: reload karne par ya ERP se dobara aane par user wahin wapas
   pohanche jahan wo tha, /dashboard par nahi.

   sessionStorage (localStorage nahi) is liye ke ye sirf isi tab ke liye
   hai — naya tab ya browser band karne ke baad taza shuruaat honi chahiye.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_last_path'

/* Ye raaste kabhi yaad nahi rakhne — login par wapas bhejna bemani hai,
   aur 404 par bhejna ghalat. */
const SKIP = ['/login', '/logout']

export function saveLastPath(path) {
  try {
    if (!path || SKIP.includes(path)) return
    sessionStorage.setItem(KEY, path)
  } catch {
    /* private mode / quota — path yaad na rakhna koi khata nahi */
  }
}

export function readLastPath() {
  try {
    const p = sessionStorage.getItem(KEY)
    // Sirf app-internal path hi qubool — "//evil.com" jaisa kuch nahi.
    if (!p || !p.startsWith('/') || p.startsWith('//')) return null
    return SKIP.includes(p) ? null : p
  } catch {
    return null
  }
}

export function clearLastPath() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}
