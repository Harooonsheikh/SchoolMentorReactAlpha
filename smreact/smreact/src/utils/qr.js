/* ═══════════════════════════════════════════════════════════════════
   QR CODE — minimal, dependency-free encoder that returns an SVG string.

   Challan PSID ke liye banaya gaya. Challan/receipt HTML strings ki soorat
   me banta hai aur print window me chhapta hai, is liye output bhi ek
   self-contained SVG string hai (koi canvas/DOM/library nahi) — warna
   print preview me QR khaali aata.

   Scope jaan-boojh kar chhota rakha hai:
     • Sirf BYTE mode (PSID digits + koi bhi ASCII payload chalta hai).
     • Version 1–10 (max ~270 bytes at ECC M) — PSID ~12 digits hai, is se
       bohat kam. Is se bara payload dene par error throw hota hai.
     • ECC level M (~15% recovery) — bank counter par photocopy/thermal
       print ke liye kaafi.

   Reference: ISO/IEC 18004. Implementation Galois-field arithmetic par
   hai — GF(256) with primitive polynomial 0x11D, jaisa spec kehti hai.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Galois field GF(256) — Reed-Solomon ke liye log/antilog tables ── */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;      // primitive polynomial
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

/* Generator polynomial for `degree` ECC codewords: ∏(x − α^i).
   Coefficients highest-power-first, is liye leading 1 index 0 par hai —
   rsEncode() isi tarteeb par gen[i+1] use karta hai. Dono terms ulat dene
   par ECC bilkul ghalat banti hai (QR banta hai magar scan nahi hota). */
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j]     ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, eccLen) {
  const gen = rsGenerator(eccLen);
  const res = new Array(eccLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < eccLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

/* ── Version tables (ECC level M only), versions 1–10 ──────────────
   Har entry: [total codewords, ecc codewords per block, block count]. */
const VERSIONS_M = {
  1:  { total: 26,  eccPerBlock: 10, blocks: 1 },
  2:  { total: 44,  eccPerBlock: 16, blocks: 1 },
  3:  { total: 70,  eccPerBlock: 26, blocks: 1 },
  4:  { total: 100, eccPerBlock: 18, blocks: 2 },
  5:  { total: 134, eccPerBlock: 24, blocks: 2 },
  6:  { total: 172, eccPerBlock: 16, blocks: 4 },
  7:  { total: 196, eccPerBlock: 18, blocks: 4 },
  8:  { total: 242, eccPerBlock: 22, blocks: 4 },
  9:  { total: 292, eccPerBlock: 22, blocks: 5 },
  10: { total: 346, eccPerBlock: 26, blocks: 5 },
};

/* Alignment-pattern centre coordinates per version. */
const ALIGN_POS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const sizeOf = (version) => version * 4 + 17;

/* Byte-mode capacity = data codewords − 2 (mode nibble + length byte). */
function dataCodewords(version) {
  const v = VERSIONS_M[version];
  return v.total - v.eccPerBlock * v.blocks;
}

function chooseVersion(byteLen) {
  for (let v = 1; v <= 10; v++) {
    /* Version ≥10 me length field 16-bit ho jati hai; 1–9 me 8-bit. */
    const header = v >= 10 ? 3 : 2;
    if (byteLen + header <= dataCodewords(v)) return v;
  }
  throw new Error('QR payload too large (max version 10 supported)');
}

/* ── Bit stream ─────────────────────────────────────────────────── */
function buildBitStream(bytes, version) {
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);                                   // byte mode
  push(bytes.length, version >= 10 ? 16 : 8);        // character count
  for (const b of bytes) push(b, 8);

  const capacityBits = dataCodewords(version) * 8;
  /* Terminator — 4 bits ya jitni jagah bachi ho. */
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);

  /* Pad codewords, spec ke mutabiq alternating. */
  const pad = [0xEC, 0x11];
  for (let i = 0; bits.length < capacityBits; i++) push(pad[i % 2], 8);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  return codewords;
}

/* Data ko blocks me baant kar ECC lagao, phir spec ka interleave order. */
function interleave(codewords, version) {
  const { eccPerBlock, blocks } = VERSIONS_M[version];
  const total = dataCodewords(version);
  const shortLen = Math.floor(total / blocks);
  const longCount = total % blocks;          // in blocks me ek extra codeword

  const dataBlocks = [];
  const eccBlocks = [];
  let offset = 0;
  for (let i = 0; i < blocks; i++) {
    const len = shortLen + (i >= blocks - longCount ? 1 : 0);
    const block = codewords.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    eccBlocks.push(rsEncode(block, eccPerBlock));
  }

  const out = [];
  const maxData = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (const b of eccBlocks) out.push(b[i]);
  }
  return out;
}

/* ── Matrix ─────────────────────────────────────────────────────── */
function createMatrix(version) {
  const size = sizeOf(version);
  const modules = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFn = (r, c, val) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r][c] = val;
    reserved[r][c] = true;
  };

  /* Finder patterns + separators — teen corners. */
  const finder = (top, left) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6))
                    || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setFn(top + r, left + c, inRing || inCore ? 1 : 0);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  /* Timing patterns. */
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    setFn(6, i, bit);
    setFn(i, 6, bit);
  }

  /* Alignment patterns — finder ke oopar nahi lagte. */
  const pos = ALIGN_POS[version];
  for (const r of pos) {
    for (const c of pos) {
      const nearFinder = (r <= 7 && c <= 7)
                      || (r <= 7 && c >= size - 8)
                      || (r >= size - 8 && c <= 7);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const edge = Math.max(Math.abs(dr), Math.abs(dc));
          setFn(r + dr, c + dc, edge === 1 ? 0 : 1);
        }
      }
    }
  }

  /* Dark module — hamesha 1. */
  setFn(size - 8, 8, 1);

  /* Format-info ki jagah reserve karo (values baad me bharti hain). */
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  /* Version info (v7+) — do 3×6 blocks. */
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
    const vinfo = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = (vinfo >> i) & 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFn(b, a, bit);
      setFn(a, b, bit);
    }
  }

  return { modules, reserved, size };
}

/* Zig-zag placement — right to left, columns of two, skipping column 6. */
function placeData(matrix, data) {
  const { modules, reserved, size } = matrix;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;                 // timing column skip
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (reserved[row][col]) continue;
        const byte = data[bitIndex >> 3];
        const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1;
        modules[row][col] = bit;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/* Format info = ECC level M (0b00) + mask, BCH(15,5) + spec mask 0x5412. */
function formatBits(maskIndex) {
  const data = (0b00 << 3) | maskIndex;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function applyFormat(matrix, maskIndex) {
  const { modules, size } = matrix;
  const bits = formatBits(maskIndex);
  for (let i = 0; i < 15; i++) {
    /* Spec me bit 0 sab se BARA (MSB) hai, LSB nahi — is liye 14-i.
       LSB-first lagane par format info ulta chhapta tha aur koi bhi
       scanner QR ko padh hi nahi pata tha. */
    const bit = (bits >> (14 - i)) & 1;
    /* Copy 1 — top-left ke gird. */
    if (i < 6)       modules[8][i] = bit;
    else if (i < 8)  modules[8][i + 1] = bit;
    else if (i === 8) modules[7][8] = bit;
    else             modules[14 - i][8] = bit;
    /* Copy 2 — bottom-left (sirf 7 modules) aur top-right (8 modules).
       Bottom-left run i<7 tak hi jata hai: row size-8 par DARK MODULE
       baitha hai jo hamesha 1 rehta hai. i<8 likhne par wo overwrite ho
       jata tha aur QR invalid ho jata (scanner bilkul nahi parh pata). */
    if (i < 7) modules[size - 1 - i][8] = bit;
    else       modules[8][size - 15 + i] = bit;
  }
}

/* Penalty scoring — spec ke chaar rules; sab se kam score wala mask jeetta. */
function penalty(modules, size) {
  let score = 0;

  /* Rule 1 — 5+ same-colour in a row/column. */
  const runScore = (get) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
  };
  runScore((r, c) => modules[r][c]);
  runScore((c, r) => modules[r][c]);

  /* Rule 2 — 2×2 blocks of one colour. */
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) score += 3;
    }
  }

  /* Rule 3 — finder-lookalike 1:1:3:1:1 patterns. */
  const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (get, a, b) => {
    for (let k = 0; k < 11; k++) {
      const v = get(a, b + k);
      if (v !== p1[k]) { for (let j = 0; j < 11; j++) if (get(a, b + j) !== p2[j]) return false; return true; }
    }
    return true;
  };
  for (let a = 0; a < size; a++) {
    for (let b = 0; b + 11 <= size; b++) {
      if (matches((x, y) => modules[x][y], a, b)) score += 40;
      if (matches((x, y) => modules[y][x], a, b)) score += 40;
    }
  }

  /* Rule 4 — dark/light balance. */
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += modules[r][c];
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

function utf8Bytes(str) {
  const out = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
    else if (cp < 0x10000) out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    else out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
  }
  return out;
}

/* Payload → boolean module grid. */
export function qrMatrix(text) {
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length);
  const codewords = buildBitStream(bytes, version);
  const finalData = interleave(codewords, version);

  const matrix = createMatrix(version);
  placeData(matrix, finalData);

  /* Har mask try karo, penalty ke hisaab se behtareen chuno. */
  const { modules, reserved, size } = matrix;
  const base = modules.map(row => row.slice());
  let best = null;
  for (let m = 0; m < 8; m++) {
    const trial = base.map(row => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && MASKS[m](r, c)) trial[r][c] ^= 1;
      }
    }
    applyFormat({ modules: trial, size }, m);
    const score = penalty(trial, size);
    if (!best || score < best.score) best = { score, modules: trial };
  }

  return best.modules.map(row => row.map(v => v === 1));
}

/* ── SVG output ─────────────────────────────────────────────────────
   Ek hi <path> me saare dark modules — chhota output, aur print engines
   ise hazaaron <rect> se behtar handle karte hain. */
export function qrSvg(text, { size = 52, margin = 2, color = '#111' } = {}) {
  const grid = qrMatrix(text);
  const count = grid.length;
  const total = count + margin * 2;

  let path = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (grid[r][c]) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" `
       + `xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" `
       + `aria-label="QR code">`
       + `<rect width="${total}" height="${total}" fill="#fff"/>`
       + `<path d="${path}" fill="${color}"/></svg>`;
}
