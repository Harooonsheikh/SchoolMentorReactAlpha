/* ═══════════════════════════════════════════════════════════════════
   QR CODE generator — pure JS, koi npm dependency nahi.
   Byte (8-bit) mode, error-correction level M, version 1–10.
   Output plain SVG markup string hai, is liye ye React preview aur
   print window (jahan sirf HTML string bheji jaati hai) dono jagah
   aik hi tarah kaam karta hai.

   Reference: ISO/IEC 18004.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── GF(256), primitive polynomial 0x11D ─── */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/* Generator polynomial (highest degree first) for `n` EC codewords. */
function rsGenPoly(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const np = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      np[j] ^= poly[j];                       // × x
      np[j + 1] ^= gmul(poly[j], EXP[i]);     // × α^i
    }
    poly = np;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const res = new Array(data.length + ecLen).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (!factor) continue;
    for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], factor);
  }
  return res.slice(data.length);
}

/* ─── Version tables (EC level M only) ───
   [ecCodewordsPerBlock, group1Blocks, group1DataCw, group2Blocks, group2DataCw] */
const EC_M = {
  1:  [10, 1, 16, 0, 0],
  2:  [16, 1, 28, 0, 0],
  3:  [26, 1, 44, 0, 0],
  4:  [18, 2, 32, 0, 0],
  5:  [24, 2, 43, 0, 0],
  6:  [16, 4, 27, 0, 0],
  7:  [18, 4, 31, 0, 0],
  8:  [22, 2, 38, 2, 39],
  9:  [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};

/* Alignment-pattern centre coordinates per version. */
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

/* Remainder bits added after the interleaved codewords. */
const REMAINDER = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

const dataCapacity = (v) => {
  const [, b1, d1, b2, d2] = EC_M[v];
  return b1 * d1 + b2 * d2;
};

/* ─── Bit stream ─── */
function encodeData(bytes, version) {
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };

  push(0b0100, 4);                                  // byte mode
  push(bytes.length, version <= 9 ? 8 : 16);        // character count
  bytes.forEach(b => push(b, 8));

  const capacityBits = dataCapacity(version) * 8;
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);   // terminator
  while (bits.length % 8 !== 0) bits.push(0);

  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  const pads = [0xec, 0x11];
  for (let i = 0; cw.length < dataCapacity(version); i++) cw.push(pads[i % 2]);
  return cw;
}

/* Data + EC codewords ko blocks me tor kar interleave karna. */
function buildCodewords(dataCw, version) {
  const [ecLen, b1, d1, b2, d2] = EC_M[version];
  const blocks = [];
  let pos = 0;
  for (let i = 0; i < b1; i++) { blocks.push(dataCw.slice(pos, pos + d1)); pos += d1; }
  for (let i = 0; i < b2; i++) { blocks.push(dataCw.slice(pos, pos + d2)); pos += d2; }
  const ecBlocks = blocks.map(b => rsEncode(b, ecLen));

  const out = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i++) blocks.forEach(b => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ecLen; i++) ecBlocks.forEach(b => out.push(b[i]));
  return out;
}

/* ─── BCH error correction for format / version info ─── */
function bch(data, generator, glen) {
  let d = data << (glen - 1);
  const gbits = 32 - Math.clz32(generator);
  while (32 - Math.clz32(d) >= gbits) d ^= generator << (32 - Math.clz32(d) - gbits);
  return (data << (glen - 1)) | d;
}

const formatBits = (mask) => bch(0b00 << 3 | mask, 0b10100110111, 11) ^ 0b101010000010010;  // level M
const versionBits = (v) => bch(v, 0b1111100100101, 13);

/* ─── Mask patterns ─── */
const MASKS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

/* ─── Matrix ─── */
function buildMatrix(version, codewords, mask) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));

  const set = (r, c, v) => { m[r][c] = v; fixed[r][c] = true; };

  /* Finder patterns + separators */
  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                   (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(rr, cc, on);
      }
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  /* Timing patterns */
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  /* Alignment patterns */
  const centers = ALIGN[version];
  centers.forEach(r => centers.forEach(c => {
    if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) return;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      }
    }
  }));

  /* Format-info area reserve + dark module */
  for (let i = 0; i < 9; i++) { fixed[8][i] = true; fixed[i][8] = true; }
  for (let i = 0; i < 8; i++) { fixed[8][size - 1 - i] = true; fixed[size - 1 - i][8] = true; }
  set(size - 8, 8, true);

  /* Version info (v ≥ 7) */
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vb >> i) & 1) === 1;
      const a = Math.floor(i / 3), b = i % 3;
      set(a, size - 11 + b, bit);
      set(size - 11 + b, a, bit);
    }
  }

  /* Data placement — do-column zigzag, dayein se bayein, column 6 skip. */
  const bits = [];
  codewords.forEach(b => { for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1); });
  for (let i = 0; i < REMAINDER[version]; i++) bits.push(0);

  let idx = 0, dir = -1, row = size - 1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let k = 0; k < 2; k++) {
        const cc = col - k;
        if (!fixed[row][cc]) {
          let dark = idx < bits.length ? bits[idx++] === 1 : false;
          if (MASKS[mask](row, cc)) dark = !dark;
          m[row][cc] = dark;
        }
      }
      row += dir;
      if (row < 0 || row >= size) { row -= dir; dir = -dir; break; }
    }
  }

  /* Format info — dono copies. i = 0 sab se kam martaba bit hai. */
  const fmt = formatBits(mask);
  for (let i = 0; i < 15; i++) {
    const bit = ((fmt >> i) & 1) === 1;

    /* Ufqi copy: bayein taraf top-left finder ke neeche, dayein taraf kinare par */
    if (i < 8) m[8][size - 1 - i] = bit;
    else if (i === 8) m[8][7] = bit;
    else m[8][14 - i] = bit;

    /* Amudi copy: top-left finder ke dayein, aur neeche wale finder ke upar */
    if (i < 6) m[i][8] = bit;
    else if (i < 8) m[i + 1][8] = bit;
    else m[size - 15 + i][8] = bit;
  }
  m[size - 8][8] = true;

  return m;
}

/* ─── Mask penalty (ISO rules 1–4) ─── */
function penalty(m) {
  const size = m.length;
  let score = 0;

  const runScore = (line) => {
    let s = 0, run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) run++;
      else { if (run >= 5) s += run - 2; run = 1; }
    }
    if (run >= 5) s += run - 2;
    return s;
  };
  for (let i = 0; i < size; i++) {
    score += runScore(m[i]);
    score += runScore(m.map(r => r[i]));
  }

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  const bad = [true, false, true, true, true, false, true, false, false, false, false];
  const hasPattern = (line, start) => bad.every((v, k) => line[start + k] === v);
  const scanPattern = (line) => {
    let s = 0;
    for (let i = 0; i + 11 <= line.length; i++) {
      if (hasPattern(line, i) || hasPattern([...line].slice(i, i + 11).reverse(), 0)) s += 40;
    }
    return s;
  };
  for (let i = 0; i < size; i++) {
    score += scanPattern(m[i]);
    score += scanPattern(m.map(r => r[i]));
  }

  let dark = 0;
  m.forEach(r => r.forEach(v => { if (v) dark++; }));
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

/* ─── Public API ─── */

/* UTF-8 bytes — Urdu/koi bhi text safe rahe. */
function toBytes(text) {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

/**
 * QR code ko SVG markup string ke tor par banata hai.
 * @param {string} text  encode hone wali value
 * @param {{quiet?:number, color?:string, bg?:string}} [opts]
 * @returns {string} SVG markup ('' agar text khali ho)
 */
export function qrSVG(text, opts = {}) {
  const value = String(text ?? '').trim();
  if (!value) return '';

  const { quiet = 2, color = '#111', bg = '#fff' } = opts;
  const bytes = toBytes(value);

  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const headerBytes = 2 + (v <= 9 ? 0 : 1);       // mode+count ≈ 2 bytes (v10 par 1 extra)
    if (bytes.length + headerBytes <= dataCapacity(v)) { version = v; break; }
  }
  if (!version) return '';                          // 10 versions se bara payload — support nahi

  const codewords = buildCodewords(encodeData(bytes, version), version);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(version, codewords, mask);
    const p = penalty(m);
    if (!best || p < best.p) best = { m, p };
  }

  const m = best.m;
  const size = m.length;
  const dim = size + quiet * 2;

  /* Har row ke consecutive dark modules ko aik rect me merge karte hain —
     markup chhota rehta hai (bulk sheet me 100+ cards ho sakte hain). */
  let rects = '';
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!m[r][c]) { c++; continue; }
      let len = 1;
      while (c + len < size && m[r][c + len]) len++;
      rects += `<rect x="${c + quiet}" y="${r + quiet}" width="${len}" height="1"/>`;
      c += len;
    }
  }

  return `<svg viewBox="0 0 ${dim} ${dim}" xmlns="http://www.w3.org/2000/svg" `
    + `shape-rendering="crispEdges" role="img" aria-label="QR code">`
    + `<rect width="${dim}" height="${dim}" fill="${bg}"/>`
    + `<g fill="${color}">${rects}</g></svg>`;
}

export default qrSVG;
