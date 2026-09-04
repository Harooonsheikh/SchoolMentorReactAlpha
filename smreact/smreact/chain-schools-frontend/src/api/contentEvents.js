/* ═══════════════════════════════════════════════════════════════════
   ACADEMIC CONTENT CHANGED — chhota sa signal.

   Release ka faisla (button khula ya band, aur kitna content jayega)
   `fetchReleaseContent` par bana hai, jo chaar alag alag API se poora
   index laata hai. Wo index Academics screen par sirf MOUNT par load
   hota tha — is liye ek nayi activity (ya lesson / notebook /
   resource) add karne ke baad bhi Release Control purani ginti par
   khada rehta tha aur "Create Master Release" band hi dikhta tha; sahi
   haalat sirf page refresh par aati thi.

   Ab har likhne wali call kaamyab hone par yahan se ek event nikalta
   hai aur Academics screen use sun kar index dobara laa leti hai. Event
   API layer me hai (screens me nahi) taake koi bhi naya raasta —
   modal, bulk action, kahin se bhi — apne aap is me aa jaye.

   Sunne wale ke liye: `onAcademicContentChanged(fn)` — wapas ek
   unsubscribe function.
   ═══════════════════════════════════════════════════════════════════ */

export const ACADEMIC_CONTENT_CHANGED = 'sm:academic-content-changed'

/**
 * Content badal gaya — sunne walon ko batao.
 * `kind` sirf debugging/logging ke liye hai: 'activity' | 'lesson' |
 * 'notebook' | 'resource' | 'release'.
 */
export function emitAcademicContentChanged(kind) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(ACADEMIC_CONTENT_CHANGED, { detail: { kind } }))
  } catch {
    /* Event dispatch kabhi kisi save ko na todey. */
  }
}

/** Content badalne par `fn` chalao. Wapas unsubscribe. */
export function onAcademicContentChanged(fn) {
  if (typeof window === 'undefined') return () => {}
  const handler = (e) => fn(e?.detail?.kind)
  window.addEventListener(ACADEMIC_CONTENT_CHANGED, handler)
  return () => window.removeEventListener(ACADEMIC_CONTENT_CHANGED, handler)
}

/**
 * Kisi likhne wali API function ko lapet do — kaamyabi par event khud
 * nikal jayega, nakaami par nahi (warna galat waqt par refetch hota).
 */
export function withContentChanged(kind, fn) {
  return async (...args) => {
    const out = await fn(...args)
    emitAcademicContentChanged(kind)
    return out
  }
}
