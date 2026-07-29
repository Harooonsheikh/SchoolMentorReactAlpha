/* ═══════════════════════════════════════════════════════════════════
   CODE 128 (subset C) — numeric barcode as a self-contained SVG string.

   Challan ke PSID ke liye. QR ki tarah ye bhi string HTML me embed hota
   hai (print window), is liye output plain SVG markup hai.

   Subset C har do digits ko ek symbol me pack karta hai — PSID jaise
   even-length numeric payload ke liye sab se compact aur bank scanners
   ka standard.
   ═══════════════════════════════════════════════════════════════════ */

/* Code 128 patterns 0..106 — har entry 6 numbers: bar,space,bar,space,bar,space
   widths (modules). Index 105 = Start C, 106 = Stop. */
const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

/* Numeric payload → Code 128-C SVG. Odd-length input ko leading 0 se
   pad kiya jata hai (subset C sirf digit PAIRS encode karta hai). */
export function code128Svg(value, { width = 110, height = 20, color = '#444' } = {}) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length % 2) digits = `0${digits}`;

  const codes = [105];                        // Start C
  for (let i = 0; i < digits.length; i += 2) {
    codes.push(Number(digits.slice(i, i + 2)));
  }

  /* Checksum = (start + Σ code_i × position) mod 103. */
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  codes.push(sum % 103);
  codes.push(106);                            // Stop

  /* Patterns ko bar/space widths me kholo. */
  const widths = [];
  for (const c of codes) {
    for (const ch of PATTERNS[c]) widths.push(Number(ch));
  }

  const totalModules = widths.reduce((a, b) => a + b, 0);
  let x = 0;
  let path = '';
  widths.forEach((w, i) => {
    if (i % 2 === 0) path += `M${x} 0h${w}v${height}h-${w}z`;   // even index = bar
    x += w;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${totalModules} ${height}" `
       + `xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" `
       + `shape-rendering="crispEdges" role="img" aria-label="Barcode ${digits}">`
       + `<rect width="${totalModules}" height="${height}" fill="#fff"/>`
       + `<path d="${path}" fill="${color}"/></svg>`;
}
