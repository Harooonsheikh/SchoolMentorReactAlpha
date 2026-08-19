/* ═══════════════════════════════════════════════════════════════════
   OPERATIONAL SOPs — sirf view helper.
   Manual heads, manuals aur forms ab API se aate hain (src/api/sopsApi.js);
   pehle wala localStorage demo store hata diya gaya hai.
   ═══════════════════════════════════════════════════════════════════ */

/* Normalise a YouTube URL to an embeddable form. */
export function toEmbed(url = '') {
  if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/')
  if (url.includes('youtu.be/')) return 'https://www.youtube.com/embed/' + url.split('youtu.be/')[1]
  return url
}
