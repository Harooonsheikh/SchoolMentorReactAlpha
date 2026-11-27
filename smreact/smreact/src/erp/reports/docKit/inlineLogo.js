/* ═══════════════════════════════════════════════════════════════════
   docKit / inlineLogo — make a school logo safe for the document viewer.

   The viewer draws the logo with crossorigin="anonymous" (needed so the PDF
   export can read its pixels). Media hosts often send no CORS headers, in
   which case the browser blocks the image entirely and no logo shows.
   Fix: download the logo ourselves and embed it as a data URL. Tries the
   direct URL first, then the app's own origin (IIS rule in prod /
   setupProxy in dev serves the same bytes without CORS — the same
   approach utils/officeRender.js uses for Word/Excel).

   Returns { url, noCors }:
     • embedded data URL        → { url: 'data:…', noCors: false }
     • could not read the bytes → { url: <original>, noCors: true }
       (shown without crossorigin; displays fine, PDF export may skip it)
     • no logo                  → { url: '', noCors: false }
   ═══════════════════════════════════════════════════════════════════ */
export async function inlineLogoUrl(logoUrl) {
  const src0 = String(logoUrl || '').trim();
  if (!src0) return { url: '', noCors: false };
  if (/^data:/i.test(src0)) return { url: src0, noCors: false };

  let sameOrigin = '';
  try {
    const u = new URL(src0, window.location.href);
    if (u.origin !== window.location.origin) sameOrigin = window.location.origin + u.pathname + u.search;
  } catch (e) { /* ignore */ }

  for (const src of [src0, sameOrigin].filter(Boolean)) {
    try {
      const res = await fetch(src);
      const blob = res.ok ? await res.blob() : null;
      if (!blob || !/^image\//i.test(blob.type)) continue;
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      if (data) return { url: String(data), noCors: false };
    } catch (e) { /* try next */ }
  }
  return { url: src0, noCors: true };
}
