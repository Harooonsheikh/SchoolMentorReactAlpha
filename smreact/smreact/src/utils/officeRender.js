/* ═══════════════════════════════════════════════════════════════════
   OFFICE EXPORT — shared HTML → layout engine (used by wordExport.js and
   excelExport.js).

   WHY THIS EXISTS
   Every report in the app is an HTML page styled with modern CSS: <style>
   blocks with class/descendant selectors, flexbox/grid layouts, rgba()
   colours, gradients, border-radius, inline SVG logos. The PDF path prints
   that page in the browser, so it looks right. The old Word/Excel paths
   handed the SAME HTML string to Word's / Excel's legacy HTML importers
   (HTML saved as .doc/.xls, or a Word "altChunk"). Those importers only
   understand a small CSS-2 subset, so colours in rgba()/classes, flex and
   grid layouts, gradients, SVG logos, cell padding/borders from class
   rules, etc. were silently dropped — which is the formatting loss users
   saw.

   HOW IT WORKS NOW
   The report HTML is rendered in a hidden, script-less iframe exactly like
   the PDF preview (print-media rules applied). We then read the browser's
   COMPUTED styles and measured geometry for every element and build a
   small, format-neutral layout model:
     • 'p'   paragraphs  → runs (text + resolved font/colour/shading),
                           alignment, indents, spacing, paragraph borders
     • 'tbl' tables      → real <table>s (colspan/rowspan aware) AND
                           flex/grid rows and coloured/bordered "boxes",
                           converted to tables so side-by-side layout,
                           backgrounds, borders and padding survive
     • 'pb'  page breaks
   Images (incl. inline SVG / canvas / remote logos) are rasterised to
   embedded PNG data. Word and Excel writers then emit NATIVE .docx / .xlsx
   from that model, so nothing depends on the Office HTML importers.
   ═══════════════════════════════════════════════════════════════════ */

export const A4 = { portraitPx: 794, landscapePx: 1123 };

/* ─── colours ─── */
const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

export function parseColor(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (m) {
    let a = 1;
    if (m[4] != null) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a: isNaN(a) ? 1 : a };
  }
  const h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (h) {
    const x = h[1].length === 3 ? h[1].split('').map(c => c + c).join('') : h[1];
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: 1 };
  }
  return null;
}

/* Alpha-composite `c` over the (opaque) colour underneath it. */
export function blend(c, under = WHITE) {
  if (!c || c.a <= 0) return under;
  if (c.a >= 1) return { r: c.r, g: c.g, b: c.b, a: 1 };
  return {
    r: c.r * c.a + under.r * (1 - c.a),
    g: c.g * c.a + under.g * (1 - c.a),
    b: c.b * c.a + under.b * (1 - c.a),
    a: 1,
  };
}

export function toHex(c) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return (h(c.r) + h(c.g) + h(c.b)).toUpperCase();
}

/* A gradient becomes the average of its colour stops — the closest solid
   colour Word/Excel can show for a header band painted with a gradient. */
function gradientColor(bgImage, under) {
  if (!bgImage || bgImage === 'none' || !/gradient\(/i.test(bgImage)) return null;
  const stops = (bgImage.match(/rgba?\([^)]*\)/gi) || []).map(parseColor).filter(Boolean).map(c => blend(c, under));
  if (!stops.length) return null;
  const n = stops.length;
  return {
    r: stops.reduce((s, c) => s + c.r, 0) / n,
    g: stops.reduce((s, c) => s + c.g, 0) / n,
    b: stops.reduce((s, c) => s + c.b, 0) / n,
    a: 1,
  };
}

/* ─── fonts ─── */
const GENERIC_FONTS = {
  'sans-serif': 'Arial', serif: 'Times New Roman', monospace: 'Courier New', 'system-ui': 'Segoe UI',
  'ui-sans-serif': 'Arial', 'ui-serif': 'Times New Roman', 'ui-monospace': 'Consolas', cursive: 'Comic Sans MS',
  fantasy: 'Impact', '-apple-system': null, blinkmacsystemfont: null, 'apple color emoji': null,
  'segoe ui emoji': null, 'segoe ui symbol': null, 'noto color emoji': null, emoji: null, math: null,
};
/* Fonts the reports pull from Google Fonts / CDNs. They exist in the browser
   but almost never on the machine that opens the .docx/.xlsx, so the next
   family in the CSS stack (what Office would fall back to anyway) is used. */
const WEB_FONT_RE = /^(plus jakarta sans|inter|poppins|roboto|open sans|lato|montserrat|nunito( sans)?|dm sans|manrope|outfit|raleway|source sans (pro|3)|work sans|mulish|figtree|rubik|karla|ibm plex sans|noto (sans|serif)( .*)?|font awesome.*|fontawesome.*|material (icons|symbols).*|katex.*|mathlive.*)$/i;

function familyList(v) {
  return String(v || '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

/* ─── text helpers ─── */
function applyTransform(t, tt) {
  if (tt === 'uppercase') return t.toUpperCase();
  if (tt === 'lowercase') return t.toLowerCase();
  if (tt === 'capitalize') return t.replace(/(^|[\s\-(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  return t;
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'HEAD', 'BASE']);
const INLINE_DISPLAYS = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid', 'inline-table', 'ruby', 'contents']);
const ZERO_PAD = { t: 0, r: 0, b: 0, l: 0 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ═══════════════════════════════════════════════════════════════════
   1. RENDER — hidden, sandboxed (no scripts → no auto-print, no
      side-effects) iframe at A4 paper width, with @media print rules
      switched on so the result matches the PDF.
   ═══════════════════════════════════════════════════════════════════ */
function flipMedia(text) {
  if (/\bprint\b/i.test(text)) return text.replace(/\bprint\b/gi, 'all');
  if (/\bscreen\b/i.test(text)) return 'not all';
  return text;
}
function applyPrintMedia(doc) {
  const walk = (rules) => {
    Array.from(rules || []).forEach(r => {
      try {
        if (r.media && r.cssRules) { r.media.mediaText = flipMedia(r.media.mediaText); walk(r.cssRules); }
        else if (r.cssRules) walk(r.cssRules);
      } catch (e) { /* read-only rule — ignore */ }
    });
  };
  Array.from(doc.styleSheets || []).forEach(sheet => {
    try {
      if (sheet.media && sheet.media.mediaText) sheet.media.mediaText = flipMedia(sheet.media.mediaText);
      walk(sheet.cssRules);
    } catch (e) { /* cross-origin sheet (e.g. Google Fonts) — nothing to flip */ }
  });
}

function lengthToMm(v) {
  const m = String(v).trim().match(/^(-?[\d.]+)\s*(mm|cm|in|pt|px)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch ((m[2] || 'px').toLowerCase()) {
    case 'mm': return n;
    case 'cm': return n * 10;
    case 'in': return n * 25.4;
    case 'pt': return n * 25.4 / 72;
    default: return n * 25.4 / 96;
  }
}

/* @page { size; margin } — read from the report's own CSS. */
function readPageSetup(doc) {
  let css = '';
  doc.querySelectorAll('style').forEach(s => { css += s.textContent + '\n'; });
  let landscape = false, margin = null;
  (css.match(/@page\s*[^{]*\{[^}]*\}/gi) || []).forEach(block => {
    if (/@page\s*:(first|left|right|blank)/i.test(block)) return;
    const size = block.match(/size\s*:\s*([^;}]+)/i);
    if (size) {
      const sv = size[1];
      if (/landscape/i.test(sv)) landscape = true;
      else if (/portrait/i.test(sv)) landscape = false;
      else {
        const dims = sv.trim().split(/\s+/).map(lengthToMm).filter(x => x != null);
        if (dims.length === 2) landscape = dims[0] > dims[1];
      }
    }
    const mg = block.match(/margin\s*:\s*([^;}]+)/i);
    if (mg) {
      const v = mg[1].trim().split(/\s+/).map(lengthToMm);
      if (v.length && v.every(x => x != null)) {
        const [t, r = t, b = t, l = r] = v;
        margin = { top: t, right: r, bottom: b, left: l };
      }
    }
  });
  return { landscape, margin };
}

export function renderHtmlInFrame(html, { landscape } = {}) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${landscape ? A4.landscapePx : A4.portraitPx}px;height:1200px;border:0;visibility:hidden;pointer-events:none;`;
    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      try {
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        if (!doc || !doc.body) throw new Error('Report could not be rendered for export');
        applyPrintMedia(doc);
        const page = readPageSetup(doc);
        if (landscape != null) page.landscape = !!landscape;
        if (page.landscape) frame.style.width = `${A4.landscapePx}px`;
        try { await Promise.race([doc.fonts && doc.fonts.ready, sleep(3000)]); } catch (e) { /* ignore */ }
        resolve({ frame, doc, win, page, dispose: () => frame.remove() });
      } catch (e) {
        frame.remove();
        reject(e);
      }
    };
    frame.addEventListener('load', finish, { once: true });
    setTimeout(finish, 15000);
    /* Lazy images never load in an off-screen frame. */
    frame.srcdoc = String(html || '').replace(/\sloading\s*=\s*(["'])lazy\1/gi, '');
    document.body.appendChild(frame);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   2. GRAPHICS — every <svg>, <canvas> and non-embedded <img> becomes a
      PNG/JPEG/GIF data-URI <img> of the same on-screen size, so it can
      be embedded in the .docx/.xlsx (neither renders SVG or remote URLs
      reliably).
   ═══════════════════════════════════════════════════════════════════ */
const PORTABLE_IMG_RE = /^data:image\/(png|jpe?g|gif);base64,/i;

function withTimeout(p, ms, fallback = null) {
  return Promise.race([p, sleep(ms).then(() => fallback)]);
}

function rasterUrl(url, w, h, scale = 2) {
  return withTimeout(new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      } catch (e) { resolve(null); }
    };
    im.onerror = () => resolve(null);
    im.src = url;
  }), 5000);
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(typeof fr.result === 'string' ? fr.result : null);
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(blob);
  });
}

/* A cross-origin absolute media URL (e.g. a branch logo on the uploads host)
   re-pointed at the app's OWN origin, so a reverse proxy — the IIS
   web.config rules in prod, src/setupProxy.js in dev — serves the SAME bytes
   from this origin. That is the only way to read a logo's pixels when the
   media host sends no CORS headers (a cross-origin <img> both blocks `fetch`
   and taints the canvas, so the logo was silently dropped from Word/Excel
   while the printed PDF, which only DISPLAYS the image, still showed it).
   Returns null for same-origin or non-http(s) URLs — nothing to re-point. */
function sameOriginMedia(src) {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    const u = new URL(src, window.location.href);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (u.origin === window.location.origin) return null;
    return window.location.origin + u.pathname + u.search;
  } catch (e) { return null; }
}

/* Load a URL into a fresh <img>. `anonymous` requests it with CORS so the
   canvas it is drawn onto is NOT tainted (works only when the host sends CORS
   headers; a host that does not simply fails the load, handled as null). */
function loadImageEl(src, anonymous) {
  return withTimeout(new Promise((resolve) => {
    const im = new Image();
    if (anonymous) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  }), 6000);
}

/* Draw any already-loaded image source to a PNG data-URI. Returns null if the
   canvas is tainted (cross-origin pixels that were never CORS-cleared). */
function drawToPng(source, w, h, scale = 1) {
  try {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((w || 1) * scale));
    c.height = Math.max(1, Math.round((h || 1) * scale));
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch (e) { return null; }
}

/* Fetch a URL and return it as a portable (png/jpeg/gif) data-URI, rasterising
   SVG/WebP/AVIF to PNG. Non-image responses (e.g. the SPA's index.html when a
   same-origin proxy is absent) return null so the next strategy is tried. */
async function fetchImagePortable(url, img, rect) {
  try {
    const res = await withTimeout(fetch(url), 8000);
    if (res && res.ok) {
      const blob = await res.blob();
      if (!/^image\//i.test(blob.type)) return null;
      if (/^image\/(png|jpeg|gif)$/i.test(blob.type)) return await blobToDataUrl(blob);
      const objUrl = URL.createObjectURL(blob);
      try {
        const isSvg = /svg/i.test(blob.type);
        const w = isSvg ? rect.width : (img.naturalWidth || rect.width);
        const h = isSvg ? rect.height : (img.naturalHeight || rect.height);
        return await rasterUrl(objUrl, w, h, isSvg ? 2 : 1);
      } finally { URL.revokeObjectURL(objUrl); }
    }
  } catch (e) { /* CORS / network — caller tries the next strategy */ }
  return null;
}

function sizeLike(img, from, rect, win) {
  const s = win.getComputedStyle(from);
  img.setAttribute('width', String(Math.round(rect.width)));
  img.setAttribute('height', String(Math.round(rect.height)));
  img.style.cssText = `width:${rect.width}px;height:${rect.height}px;display:${s.display === 'inline' ? 'inline-block' : s.display};vertical-align:${s.verticalAlign};margin:${s.margin};`;
}

async function portableImage(img, rect) {
  const src = img.currentSrc || img.src;

  /* 1. Direct fetch — succeeds for a same-origin image or a media host that
        sends CORS headers. */
  const direct = await fetchImagePortable(src, img, rect);
  if (direct) return direct;

  /* 2. Re-point a cross-origin media URL at our own origin so the reverse
        proxy serves the bytes without CORS (the reliable logo path in prod). */
  const proxied = sameOriginMedia(src);
  if (proxied) {
    const viaProxy = await fetchImagePortable(proxied, img, rect);
    if (viaProxy) return viaProxy;
  }

  /* 3. Reload with crossorigin=anonymous and rasterise — works when the host
        DOES return CORS headers (the original <img>, loaded without it, left
        the canvas tainted). */
  const anon = await loadImageEl(src, true);
  if (anon) {
    const data = drawToPng(anon, anon.naturalWidth || rect.width, anon.naturalHeight || rect.height);
    if (data) return data;
  }

  /* 4. Reload the same-origin proxied URL (no taint, no CORS needed) and
        rasterise — covers SVG/WebP logos served through the proxy. */
  if (proxied) {
    const el = await loadImageEl(proxied, false);
    if (el) {
      const data = drawToPng(el, el.naturalWidth || rect.width, el.naturalHeight || rect.height);
      if (data) return data;
    }
  }

  /* 5. Last resort — the already-decoded pixels. Fine for a same-origin image;
        null when a cross-origin image tainted the canvas. */
  return drawToPng(img, img.naturalWidth || rect.width, img.naturalHeight || rect.height);
}

export async function inlineGraphics(doc, win) {
  Array.from(doc.querySelectorAll('canvas')).forEach(cv => {
    try {
      const rect = cv.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const img = doc.createElement('img');
      img.src = cv.toDataURL('image/png');
      sizeLike(img, cv, rect, win);
      cv.replaceWith(img);
    } catch (e) { /* tainted canvas — leave it */ }
  });

  const svgs = Array.from(doc.querySelectorAll('svg')).filter(s => !(s.parentElement && s.parentElement.closest('svg')));
  await Promise.all(svgs.map(async (svg) => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    try {
      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(rect.width));
      clone.setAttribute('height', String(rect.height));
      clone.style.color = win.getComputedStyle(svg).color; // currentColor
      const xml = new XMLSerializer().serializeToString(clone);
      const data = await rasterUrl('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml), rect.width, rect.height, 2);
      if (!data) return;
      const img = doc.createElement('img');
      img.src = data;
      sizeLike(img, svg, rect, win);
      svg.replaceWith(img);
    } catch (e) { /* leave the svg; it is skipped later */ }
  }));

  await Promise.all(Array.from(doc.images).map(async (img) => {
    const src = img.currentSrc || img.src || '';
    if (!src || PORTABLE_IMG_RE.test(src)) return;
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const data = await portableImage(img, rect);
    if (!data) return;
    /* Freeze the on-screen box first so a re-encoded (e.g. 2× SVG raster)
       image does not change the layout we are about to measure. */
    img.style.width = `${rect.width}px`;
    img.style.height = `${rect.height}px`;
    img.src = data;
  }));

  await Promise.all(Array.from(doc.images).map(img => withTimeout(img.decode ? img.decode().catch(() => null) : Promise.resolve(), 4000)));
}

/* ═══════════════════════════════════════════════════════════════════
   3. LAYOUT MODEL — computed styles + geometry → blocks.
   All horizontal/vertical measures are CSS px; writers convert.
   ═══════════════════════════════════════════════════════════════════ */
function createStyles(doc, win) {
  const csMemo = new WeakMap(), effMemo = new WeakMap(), opMemo = new WeakMap(), fontMemo = new WeakMap(), shadeMemo = new WeakMap();
  const famMemo = new Map();
  const webFonts = new Set();
  try { doc.fonts.forEach(f => webFonts.add(String(f.family).replace(/["']/g, '').toLowerCase())); } catch (e) { /* ignore */ }

  const cs = (el) => {
    let s = csMemo.get(el);
    if (!s) { s = win.getComputedStyle(el); csMemo.set(el, s); }
    return s;
  };
  const isRoot = (el) => !el || el === doc.body || el === doc.documentElement || el.nodeType !== 1;

  const opacity = (el) => {
    if (isRoot(el)) return 1;
    if (opMemo.has(el)) return opMemo.get(el);
    const o = parseFloat(cs(el).opacity);
    const v = (isNaN(o) ? 1 : o) * opacity(el.parentElement);
    opMemo.set(el, v);
    return v;
  };

  /* Effective (painted) background behind an element's content. */
  const eff = (el) => {
    if (isRoot(el)) return { c: WHITE, own: false };
    let m = effMemo.get(el);
    if (m) return m;
    const parent = eff(el.parentElement);
    const s = cs(el);
    let c = parent.c, own = false;
    const bg = parseColor(s.backgroundColor);
    if (bg && bg.a > 0.01) {
      const o = parseFloat(s.opacity);
      c = blend({ ...bg, a: bg.a * (isNaN(o) ? 1 : o) }, parent.c);
      own = true;
    }
    const g = gradientColor(s.backgroundImage, c);
    if (g) { c = g; own = true; }
    m = { c, own };
    effMemo.set(el, m);
    return m;
  };

  const resolveFamily = (list) => {
    if (famMemo.has(list)) return famMemo.get(list);
    let out = null;
    for (const fam of familyList(list)) {
      const k = fam.toLowerCase();
      if (k in GENERIC_FONTS) { if (GENERIC_FONTS[k]) { out = GENERIC_FONTS[k]; break; } continue; }
      if (webFonts.has(k) || WEB_FONT_RE.test(k)) continue;
      out = fam;
      break;
    }
    out = out || 'Arial';
    famMemo.set(list, out);
    return out;
  };

  /* text-decoration paints onto descendants without being inherited. */
  const decoration = (el) => {
    let underline = false, strike = false;
    for (let n = el; n && !isRoot(n); n = n.parentElement) {
      const line = cs(n).textDecorationLine || cs(n).textDecoration || '';
      if (/underline/.test(line)) underline = true;
      if (/line-through/.test(line)) strike = true;
      if (n !== el && !INLINE_DISPLAYS.has(cs(n).display)) break;
    }
    return { underline, strike };
  };

  const fontFrom = (s, el, deco) => {
    const col = parseColor(s.color) || BLACK;
    const size = parseFloat(s.fontSize) || 13;
    const w = parseInt(s.fontWeight, 10) || (/bold/.test(s.fontWeight) ? 700 : 400);
    return {
      name: resolveFamily(s.fontFamily),
      sizePt: Math.max(1, Math.round(size * 0.75 * 2) / 2),
      bold: w >= 600,
      italic: /italic|oblique/.test(s.fontStyle),
      underline: deco.underline,
      strike: deco.strike,
      color: toHex(blend({ ...col, a: col.a * opacity(el) }, eff(el).c)),
    };
  };

  const font = (el) => {
    let f = fontMemo.get(el);
    if (!f) { f = fontFrom(cs(el), el, decoration(el)); fontMemo.set(el, f); }
    return f;
  };

  /* Inline background (pills, highlighted words) → run shading. */
  const shade = (el) => {
    if (shadeMemo.has(el)) return shadeMemo.get(el);
    let v = null;
    for (let n = el; n && !isRoot(n); n = n.parentElement) {
      if (!INLINE_DISPLAYS.has(cs(n).display)) break;
      if (eff(n).own) { v = toHex(eff(n).c); break; }
    }
    shadeMemo.set(el, v);
    return v;
  };

  const borders = (el) => {
    const s = cs(el), out = {};
    const under = eff(el.parentElement).c;
    ['top', 'right', 'bottom', 'left'].forEach(side => {
      const w = parseFloat(s.getPropertyValue(`border-${side}-width`)) || 0;
      const st = s.getPropertyValue(`border-${side}-style`);
      const col = parseColor(s.getPropertyValue(`border-${side}-color`));
      if (w > 0 && st && st !== 'none' && st !== 'hidden' && col && col.a > 0.01) {
        out[side] = { wPx: w, style: st, color: toHex(blend(col, under)) };
      }
    });
    return out;
  };

  const padding = (el) => {
    const s = cs(el);
    return { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 };
  };

  const contentBox = (el) => {
    const r = el.getBoundingClientRect(), s = cs(el);
    const bl = parseFloat(s.borderLeftWidth) || 0, br = parseFloat(s.borderRightWidth) || 0;
    const bt = parseFloat(s.borderTopWidth) || 0, bb = parseFloat(s.borderBottomWidth) || 0;
    const p = padding(el);
    return { left: r.left + bl + p.l, right: r.right - br - p.r, top: r.top + bt + p.t, bottom: r.bottom - bb - p.b };
  };

  const isHidden = (el) => {
    if (el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.namespaceURI && el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return true;
    if (el.classList && (el.classList.contains('no-print') || el.classList.contains('np'))) return true;
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return true;
    if (parseFloat(s.opacity) === 0) return true;
    /* Absolutely-positioned decoration (bubbles/circles on header bands). */
    if ((s.position === 'absolute' || s.position === 'fixed') && el.tagName !== 'IMG'
        && !el.textContent.trim() && !el.querySelector('img')) return true;
    return false;
  };

  const isBlockLevel = (el) => !INLINE_DISPLAYS.has(cs(el).display);

  const pseudo = (el, which) => {
    let p;
    try { p = win.getComputedStyle(el, which); } catch (e) { return null; }
    if (!p || p.display === 'none' || p.position === 'absolute' || p.position === 'fixed') return null;
    const m = String(p.content || '').match(/^"((?:[^"\\]|\\.)*)"$/);
    if (!m) return null;
    const text = m[1].replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (x, e) => (/^[0-9a-fA-F]/.test(e) && e.trim().length > 1 ? String.fromCodePoint(parseInt(e, 16)) : e));
    if (!text.trim() || /[-]/.test(text)) return null; // icon-font glyphs
    return { text: applyTransform(text, p.textTransform), font: fontFrom(p, el, decoration(el)), shade: shade(el) };
  };

  return { cs, eff, font, shade, borders, padding, contentBox, isHidden, isBlockLevel, pseudo, origin: 0 };
}

const mapAlign = (ta, dir) => {
  if (/center/.test(ta)) return 'center';
  if (/justify/.test(ta)) return 'justify';
  if (ta === 'right' || (ta === 'end' && dir !== 'rtl') || (ta === 'start' && dir === 'rtl')) return 'right';
  return 'left';
};
const mapVAlign = (va) => (va === 'middle' ? 'center' : va === 'bottom' ? 'bottom' : 'top');
const mapAlignItems = (ai) => (/center/.test(ai) ? 'center' : /end/.test(ai) ? 'bottom' : 'top');

function romanize(n) {
  const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  map.forEach(([v, s]) => { while (n >= v) { out += s; n -= v; } });
  return out;
}

export function buildLayout(doc, win) {
  const S = createStyles(doc, win);
  const body = doc.body;

  const childList = (el) => {
    const out = [];
    Array.from(el.childNodes).forEach(n => {
      if (n.nodeType === 1 && !S.isHidden(n) && S.cs(n).display === 'contents') out.push(...childList(n));
      else out.push(n);
    });
    return out;
  };

  /* Page root = the union of the top-level visible boxes (usually the
     report's .page / .a4 wrapper). */
  let L = Infinity, R = -Infinity, T = Infinity;
  childList(body).forEach(n => {
    if (n.nodeType !== 1 || S.isHidden(n)) return;
    const r = n.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return;
    L = Math.min(L, r.left); R = Math.max(R, r.right); T = Math.min(T, r.top);
  });
  if (!isFinite(L)) { const r = body.getBoundingClientRect(); L = r.left; R = r.right; T = r.top; }
  S.origin = L;

  const gap = (ctx, top) => {
    if (ctx.afterBreak) { ctx.afterBreak = false; return 0; }
    return Math.max(0, top - ctx.cursor);
  };

  const imageOf = (img) => {
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const m = (img.getAttribute('src') || '').match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
    if (!m) return null;
    let w = rect.width, h = rect.height;
    const fit = S.cs(img).objectFit;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (/contain|scale-down/.test(fit) && nw && nh) {
      const k = Math.min(w / nw, h / nh);
      w = nw * k; h = nh * k;
    }
    const ext = m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase();
    return { ext, b64: m[2], w, h, x: rect.left - S.origin + (rect.width - w) / 2 };
  };

  const collectRuns = (n, runs) => {
    if (n.nodeType === 3) {
      const pe = n.parentElement;
      if (!pe) return;
      const s = S.cs(pe);
      let t = n.data;
      if (!t) return;
      const pre = /^(pre|pre-wrap|break-spaces)$/.test(s.whiteSpace);
      const preLine = s.whiteSpace === 'pre-line';
      if (!pre && !preLine) t = t.replace(/[ \t\n\r\f]+/g, ' ');
      else if (preLine) t = t.replace(/[ \t\f]+/g, ' ');
      t = applyTransform(t, s.textTransform);
      const f = S.font(pe), sh = S.shade(pe);
      if (pre || preLine) {
        t.replace(/\r\n?/g, '\n').split('\n').forEach((part, i) => {
          if (i) runs.push({ br: true });
          if (part) runs.push({ text: part, font: f, shade: sh, keep: pre });
        });
      } else runs.push({ text: t, font: f, shade: sh });
      return;
    }
    if (n.nodeType !== 1 || S.isHidden(n)) return;
    const tag = n.tagName;
    if (tag === 'BR') { runs.push({ br: true }); return; }
    if (tag === 'IMG') { const im = imageOf(n); if (im) runs.push({ image: im }); return; }
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      let v = '';
      if (tag === 'SELECT') v = n.selectedOptions && n.selectedOptions[0] ? n.selectedOptions[0].text : '';
      else if (n.type === 'checkbox' || n.type === 'radio') v = n.checked ? '☑' : '☐';
      else v = n.value || '';
      if (v) runs.push({ text: v, font: S.font(n), shade: S.shade(n) });
      return;
    }
    const block = S.isBlockLevel(n);
    if (block) runs.push({ br: true, soft: true });
    const b = S.pseudo(n, '::before');
    if (b) runs.push(b);
    childList(n).forEach(c => collectRuns(c, runs));
    const a = S.pseudo(n, '::after');
    if (a) runs.push(a);
    if (block) runs.push({ br: true, soft: true });
  };

  const fontKey = (r) => `${JSON.stringify(r.font)}|${r.shade || ''}`;
  const normalizeRuns = (runs) => {
    const out = [];
    let prevSpace = true;
    const trimEnd = () => {
      for (;;) {
        const last = out[out.length - 1];
        if (!last || last.image || last.br) return;
        if (last.keep) return;
        last.text = last.text.replace(/ +$/, '');
        if (last.text) return;
        out.pop();
      }
    };
    runs.forEach(r => {
      if (r.br) {
        if (r.soft && (!out.length || out[out.length - 1].br)) return;
        trimEnd();
        out.push({ br: true });
        prevSpace = true;
        return;
      }
      if (r.image) { out.push(r); prevSpace = false; return; }
      let t = r.text;
      if (!r.keep && prevSpace) t = t.replace(/^ +/, '');
      if (!t) return;
      out.push({ text: t, font: r.font, shade: r.shade, keep: r.keep });
      prevSpace = !r.keep && / $/.test(t);
    });
    for (;;) {
      trimEnd();
      if (out.length && out[out.length - 1].br) { out.pop(); continue; }
      break;
    }
    const merged = [];
    out.forEach(r => {
      const last = merged[merged.length - 1];
      if (last && r.text != null && last.text != null && fontKey(last) === fontKey(r)) last.text += r.text;
      else merged.push(r);
    });
    return merged;
  };

  const hasContent = (runs) => runs.some(r => r.image || (r.text && r.text.trim()));

  const emitInline = (nodes, container, ctx) => {
    let runs = [];
    if (ctx.marker) { runs.push({ text: ctx.marker, font: S.font(container), shade: null }); ctx.marker = null; }
    nodes.forEach(n => collectRuns(n, runs));
    runs = normalizeRuns(runs);
    if (!hasContent(runs)) return null;
    let r = null;
    try {
      const range = doc.createRange();
      range.setStartBefore(nodes[0]);
      range.setEndAfter(nodes[nodes.length - 1]);
      r = range.getBoundingClientRect();
    } catch (e) { /* ignore */ }
    if (!r || (!r.width && !r.height)) r = container.getBoundingClientRect();
    const s = S.cs(container);
    const cb = S.contentBox(container);
    const lh = s.lineHeight === 'normal' ? null : parseFloat(s.lineHeight) || null;
    let align = mapAlign(s.textAlign, s.direction);
    /* Text centred by flexbox (e.g. initials inside a logo box). */
    if (align === 'left' && (s.display === 'flex' || s.display === 'inline-flex')) {
      const prop = /column/.test(s.flexDirection) ? s.alignItems : s.justifyContent;
      if (/center/.test(prop)) align = 'center';
      else if (/flex-end|^end|right/.test(prop)) align = 'right';
    }
    const p = {
      t: 'p', runs,
      align,
      indL: Math.max(0, cb.left - ctx.root.left),
      indR: Math.max(0, ctx.root.right - cb.right),
      before: gap(ctx, r.top), after: 0,
      lineH: lh, rtl: s.direction === 'rtl',
      height: r.height, x: cb.left - S.origin, width: cb.right - cb.left,
    };
    ctx.out.push(p);
    ctx.cursor = r.bottom;
    return p;
  };

  const emitChildren = (el, ctx) => {
    let group = [];
    const flush = () => { if (group.length) emitInline(group, el, ctx); group = []; };
    childList(el).forEach(n => {
      if (n.nodeType === 3) { group.push(n); return; }
      if (n.nodeType !== 1 || S.isHidden(n)) return;
      if (S.isBlockLevel(n)) { flush(); emitElement(n, ctx); }
      else group.push(n);
    });
    flush();
  };

  const visibleBorderCount = (b) => ['top', 'right', 'bottom', 'left'].filter(k => b[k]).length;
  const hasVisual = (el) => !!(el.textContent.trim() || el.querySelector('img'));

  const isBox = (el) => {
    if (/^(TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|IMG|HR|LI)$/.test(el.tagName)) return false;
    if (!S.isBlockLevel(el)) return false;
    const e = S.eff(el);
    const parentHex = toHex(S.eff(el.parentElement).c);
    if (e.own && toHex(e.c) !== parentHex) return true;
    return visibleBorderCount(S.borders(el)) >= 2;
  };

  const isDivider = (el, rect) => {
    if (hasVisual(el) || rect.height <= 0 || rect.height > 6 || rect.width < 16) return false;
    const b = S.borders(el);
    return S.eff(el).own || !!(b.top || b.bottom);
  };

  const layoutChildren = (el) => {
    const out = [];
    childList(el).forEach(n => {
      if (n.nodeType === 3) {
        if (!n.data.trim()) return;
        try {
          const range = doc.createRange();
          range.selectNode(n);
          const rect = range.getBoundingClientRect();
          if (rect.width || rect.height) out.push({ node: n, text: true, rect });
        } catch (e) { /* ignore */ }
        return;
      }
      if (n.nodeType !== 1 || S.isHidden(n)) return;
      const pos = S.cs(n).position;
      if (pos === 'absolute' || pos === 'fixed') return;
      const rect = n.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      out.push({ node: n, text: false, rect });
    });
    return out;
  };

  /* Split flex/grid items into visual rows (wrapping flex, multi-row grids). */
  const visualRows = (kids) => {
    const sorted = kids.slice().sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
    const rows = [];
    sorted.forEach(k => {
      const row = rows[rows.length - 1];
      if (row && k.rect.top < row.bottom - 2) { row.items.push(k); row.bottom = Math.max(row.bottom, k.rect.bottom); }
      else rows.push({ items: [k], top: k.rect.top, bottom: k.rect.bottom });
    });
    rows.forEach(r => { r.top = Math.min(...r.items.map(k => k.rect.top)); });
    return rows;
  };

  const isRowLayout = (el) => {
    const s = S.cs(el);
    const flex = s.display === 'flex' && !/column/.test(s.flexDirection);
    const grid = s.display === 'grid';
    if (!flex && !grid) return false;
    const kids = layoutChildren(el);
    if (kids.length < 2) return false;
    return visualRows(kids).some(r => r.items.length > 1);
  };

  const makeBoxCell = (el) => {
    const e = S.eff(el);
    const s = S.cs(el);
    const flexRow = s.display === 'flex' && !/column/.test(s.flexDirection);
    const valign = flexRow ? mapAlignItems(s.alignItems) : (s.display === 'flex' ? mapAlignItems(s.justifyContent) : 'top');
    return { fill: e.own ? toHex(e.c) : null, borders: S.borders(el), pad: S.padding(el), valign, content: [] };
  };

  const emitContent = (el, ctx) => { if (isRowLayout(el)) emitRow(el, ctx); else emitChildren(el, ctx); };

  const dropFirstGap = (cell) => {
    if (cell.valign !== 'top' && cell.content[0]) cell.content[0].before = 0;
  };

  const kidCell = (k, valign, parentEl) => {
    if (k.text) {
      const cell = { fill: null, borders: {}, pad: ZERO_PAD, valign, content: [] };
      emitInline([k.node], parentEl, { root: k.rect, cursor: k.rect.top, out: cell.content });
      dropFirstGap(cell);
      return cell;
    }
    const el = k.node;
    const self = S.cs(el).alignSelf;
    const va = self && self !== 'auto' && self !== 'normal' ? mapAlignItems(self) : valign;
    if (isBox(el)) {
      const cell = makeBoxCell(el);
      if (cell.valign === 'top') cell.valign = va;
      const cb = S.contentBox(el);
      emitContent(el, { root: cb, cursor: cb.top, out: cell.content });
      dropFirstGap(cell);
      return cell;
    }
    const cell = { fill: null, borders: {}, pad: ZERO_PAD, valign: va, content: [] };
    const r = k.rect;
    emitElement(el, { root: { left: r.left, right: r.right, top: r.top }, cursor: r.top, out: cell.content });
    dropFirstGap(cell);
    return cell;
  };

  function emitRow(el, ctx) {
    const s = S.cs(el);
    const cb = S.contentBox(el);
    const valign = mapAlignItems(s.alignItems);
    visualRows(layoutChildren(el)).forEach(vr => {
      const items = vr.items.slice().sort((a, b) => a.rect.left - b.rect.left);
      const cols = [], cells = [];
      const addGap = (w) => {
        cols.push(w);
        cells.push({ col: cols.length - 1, colspan: 1, rowspan: 1, fill: null, borders: {}, pad: ZERO_PAD, valign: 'top', content: [], gap: true });
      };
      let x = cb.left;
      items.forEach(k => {
        const l = Math.max(k.rect.left, x);
        if (l - x >= 3) addGap(l - x);
        const w = Math.max(2, k.rect.right - l);
        cols.push(w);
        cells.push({ ...kidCell(k, valign, el), col: cols.length - 1, colspan: 1, rowspan: 1 });
        x = l + w;
      });
      if (cb.right - x >= 3) addGap(cb.right - x);
      /* Office fonts measure slightly wider than the browser's, so give each
         shrink-wrapped item some of the empty space that follows it (and let
         a trailing plain item take the rest of the row) to avoid new wraps. */
      const plain = (c) => !c.fill && !Object.keys(c.borders || {}).length;
      for (let i = 0; i < cells.length - 1; i++) {
        if (cells[i].gap || !cells[i + 1].gap) continue;
        const last = i + 1 === cells.length - 1;
        const give = last && plain(cells[i]) ? cols[i + 1] : Math.min(cols[i + 1] * 0.6, cols[i] * 0.2);
        cols[i] += give;
        cols[i + 1] -= give;
      }
      /* A trailing item pushed to the right edge (space-between / flex-end)
         stays flush right and may grow leftwards into the gap before it. */
      const li = cells.length - 1;
      if (li > 0 && !cells[li].gap && cells[li - 1].gap && plain(cells[li]) && /space-between|flex-end|end|right/.test(s.justifyContent)) {
        const give = Math.min(cols[li - 1] * 0.6, cols[li] * 0.5);
        cols[li] += give;
        cols[li - 1] -= give;
        cells[li].content.forEach(b => { if (b.t === 'p' && b.align === 'left') b.align = 'right'; });
      }
      for (let i = cells.length - 1; i >= 0; i--) {
        if (cells[i].gap && cols[i] < 1) { cols.splice(i, 1); cells.splice(i, 1); }
      }
      cells.forEach((c, i) => { c.col = i; });
      ctx.out.push({
        t: 'tbl', layout: true,
        before: gap(ctx, vr.top),
        left: cb.left - ctx.root.left, x: cb.left - S.origin,
        cols, rows: [{ height: vr.bottom - vr.top, cells }],
      });
      ctx.cursor = vr.bottom;
    });
  }

  function emitBox(el, ctx) {
    const rect = el.getBoundingClientRect();
    const cell = makeBoxCell(el);
    const cb = S.contentBox(el);
    emitContent(el, { root: cb, cursor: cb.top, out: cell.content });
    dropFirstGap(cell);
    ctx.out.push({
      t: 'tbl', layout: true, box: true,
      before: gap(ctx, rect.top),
      left: rect.left - ctx.root.left, x: rect.left - S.origin,
      cols: [rect.width],
      rows: [{ height: rect.height, cells: [{ ...cell, col: 0, colspan: 1, rowspan: 1 }] }],
    });
    ctx.cursor = rect.bottom;
  }

  function emitRule(el, ctx, rect) {
    const b = S.borders(el);
    let color, w;
    if (el.tagName === 'HR') {
      const side = b.top || b.bottom;
      color = side ? side.color : 'CCCCCC';
      w = side ? side.wPx : 1;
    } else {
      const e = S.eff(el);
      const side = b.bottom || b.top;
      color = e.own ? toHex(e.c) : (side ? side.color : 'CCCCCC');
      w = Math.max(1, e.own ? rect.height : (side ? side.wPx : 1));
    }
    ctx.out.push({
      t: 'p', runs: [], rule: true, align: 'left',
      indL: Math.max(0, rect.left - ctx.root.left), indR: Math.max(0, ctx.root.right - rect.right),
      before: gap(ctx, rect.top), after: 0, lineH: null,
      height: rect.height, x: rect.left - S.origin, width: rect.width,
      borders: { bottom: { wPx: Math.min(w, 6), style: 'solid', color, space: 0 } },
    });
    ctx.cursor = rect.bottom;
  }

  function tableCell(td, table, ri, c, nrows, ncols) {
    const s = S.cs(td);
    const e = S.eff(td);
    const outer = S.eff(table.parentElement);
    const fill = e.own || toHex(e.c) !== toHex(outer.c) ? toHex(e.c) : null;
    const b = S.borders(td);
    const trb = td.parentElement ? S.borders(td.parentElement) : {};
    const tb = S.borders(table);
    if (!b.top && trb.top) b.top = trb.top;
    if (!b.bottom && trb.bottom) b.bottom = trb.bottom;
    if (!b.top && ri === 0 && tb.top) b.top = tb.top;
    if (!b.bottom && ri === nrows - 1 && tb.bottom) b.bottom = tb.bottom;
    if (!b.left && c === 0 && tb.left) b.left = tb.left;
    if (!b.right && c === ncols - 1 && tb.right) b.right = tb.right;
    const cb = S.contentBox(td);
    const cell = { fill, borders: b, pad: S.padding(td), valign: mapVAlign(s.verticalAlign), content: [] };
    emitChildren(td, { root: cb, cursor: cb.top, out: cell.content });
    if (cell.content[0]) cell.content[0].before = 0;
    return cell;
  }

  function emitTable(el, ctx) {
    const trect = el.getBoundingClientRect();
    const trs = Array.from(el.rows || [])
      .filter(tr => !S.isHidden(tr) && !(tr.parentElement && S.isHidden(tr.parentElement)))
      .map((tr, i) => ({ tr, i, rect: tr.getBoundingClientRect() }))
      .sort((a, b) => (a.rect.top - b.rect.top) || (a.i - b.i));
    if (!trs.length) return;
    const occ = [], placed = [];
    let ncols = 0;
    trs.forEach((row, ri) => {
      occ[ri] = occ[ri] || [];
      let c = 0;
      Array.from(row.tr.cells).forEach(td => {
        if (S.isHidden(td)) return;
        while (occ[ri][c]) c++;
        const cs = Math.max(1, td.colSpan || 1);
        const rs = td.rowSpan === 0 ? trs.length - ri : Math.max(1, Math.min(td.rowSpan || 1, trs.length - ri));
        for (let r = ri; r < ri + rs; r++) { occ[r] = occ[r] || []; for (let k = c; k < c + cs; k++) occ[r][k] = true; }
        placed.push({ td, ri, c, cs, rs, rect: td.getBoundingClientRect() });
        c += cs;
        ncols = Math.max(ncols, c);
      });
    });
    if (!ncols) return;

    /* Column boundaries from the rendered cells (single-span cells first). */
    const bx = new Array(ncols + 1).fill(null);
    [true, false].forEach(singleOnly => placed.forEach(p => {
      if (singleOnly && p.cs !== 1) return;
      if (bx[p.c] == null) bx[p.c] = p.rect.left;
      if (bx[p.c + p.cs] == null) bx[p.c + p.cs] = p.rect.right;
    }));
    if (bx[0] == null) bx[0] = trect.left;
    if (bx[ncols] == null) bx[ncols] = trect.right;
    for (let k = 1; k < ncols; k++) {
      if (bx[k] != null) continue;
      let j = k + 1;
      while (bx[j] == null) j++;
      bx[k] = bx[k - 1] + (bx[j] - bx[k - 1]) / (j - k + 1);
    }
    for (let k = 1; k <= ncols; k++) bx[k] = Math.max(bx[k], bx[k - 1] + 1);
    const cols = [];
    for (let k = 0; k < ncols; k++) cols.push(bx[k + 1] - bx[k]);

    const rows = trs.map(row => ({
      height: row.rect.height,
      header: !!(row.tr.parentElement && row.tr.parentElement.tagName === 'THEAD'),
      cells: [],
    }));
    placed.forEach(p => {
      rows[p.ri].cells.push({ ...tableCell(p.td, el, p.ri, p.c, trs.length, ncols), col: p.c, colspan: p.cs, rowspan: p.rs });
    });
    /* A one-column table whose cells hold block content is a page wrapper
       (repeating header/footer trick), not tabular data. */
    const wrapper = placed.some(p => p.td.querySelector('table'))
      || (ncols === 1 && placed.some(p => Array.from(p.td.children).some(ch => !S.isHidden(ch) && S.isBlockLevel(ch))));
    ctx.out.push({
      t: 'tbl', layout: wrapper, data: !wrapper,
      before: gap(ctx, trect.top),
      left: bx[0] - ctx.root.left, x: bx[0] - S.origin,
      cols, rows,
    });
    ctx.cursor = trect.bottom;
  }

  function emitFlow(el, ctx) {
    const s = S.cs(el);
    const start = ctx.out.length;
    const cursor0 = ctx.cursor;
    if (s.display === 'list-item') ctx.marker = listMarker(el, s);
    emitChildren(el, ctx);
    ctx.marker = null;
    const b = S.borders(el);
    if (!b.top && !b.bottom && !b.left && !b.right) return;
    const paras = ctx.out.slice(start).filter(x => x.t === 'p');
    if (!paras.length) return;
    const pad = S.padding(el), rect = el.getBoundingClientRect();
    if (b.top) {
      paras[0].borders = { ...paras[0].borders, top: { ...b.top, space: pad.t } };
      paras[0].before = Math.max(0, rect.top - cursor0);
    }
    if (b.bottom && paras[paras.length - 1] === ctx.out[ctx.out.length - 1]) {
      paras[paras.length - 1].borders = { ...paras[paras.length - 1].borders, bottom: { ...b.bottom, space: pad.b } };
      ctx.cursor = rect.bottom;
    }
    if (b.left) paras.forEach(p => { p.borders = { ...p.borders, left: { ...b.left, space: pad.l } }; });
    if (b.right) paras.forEach(p => { p.borders = { ...p.borders, right: { ...b.right, space: pad.r } }; });
  }

  function listMarker(li, s) {
    const type = s.listStyleType;
    if (!type || type === 'none') return null;
    if (/disc/.test(type)) return '•  ';
    if (/circle/.test(type)) return '◦  ';
    if (/square/.test(type)) return '▪  ';
    const list = li.parentElement;
    let n = list && list.tagName === 'OL' ? (parseInt(list.getAttribute('start'), 10) || 1) : 1;
    for (let p = li.previousElementSibling; p; p = p.previousElementSibling) if (p.tagName === 'LI' && !S.isHidden(p)) n++;
    if (/lower-alpha|lower-latin/.test(type)) return `${String.fromCharCode(96 + ((n - 1) % 26) + 1)}.  `;
    if (/upper-alpha|upper-latin/.test(type)) return `${String.fromCharCode(64 + ((n - 1) % 26) + 1)}.  `;
    if (/lower-roman/.test(type)) return `${romanize(n)}.  `;
    if (/upper-roman/.test(type)) return `${romanize(n).toUpperCase()}.  `;
    return `${n}.  `;
  }

  function emitElement(el, ctx) {
    const s = S.cs(el);
    const rect = el.getBoundingClientRect();
    if (s.breakBefore === 'page' || s.pageBreakBefore === 'always') { ctx.out.push({ t: 'pb' }); ctx.afterBreak = true; }
    const tag = el.tagName;
    if (tag === 'TABLE') emitTable(el, ctx);
    else if (tag === 'IMG') {
      const p = emitInline([el], el.parentElement || el, ctx);
      if (p) { p.indL = Math.max(0, rect.left - ctx.root.left); p.align = 'left'; }
    } else if (tag === 'HR' || isDivider(el, rect)) emitRule(el, ctx, rect);
    else if (isBox(el)) emitBox(el, ctx);
    else if (isRowLayout(el)) {
      /* A row's own top/bottom rule (e.g. the line under a report header). */
      const b = S.borders(el);
      const lineAt = (side, y) => {
        ctx.out.push({
          t: 'p', runs: [], rule: true, align: 'left',
          indL: Math.max(0, rect.left - ctx.root.left), indR: Math.max(0, ctx.root.right - rect.right),
          before: gap(ctx, y), after: 0, lineH: null, height: 0, x: rect.left - S.origin, width: rect.width,
          borders: { bottom: { ...side, space: 0 } },
        });
        ctx.cursor = y;
      };
      if (b.top) lineAt(b.top, rect.top);
      emitRow(el, ctx);
      if (b.bottom) lineAt(b.bottom, rect.bottom);
    } else emitFlow(el, ctx);
    if (s.breakAfter === 'page' || s.pageBreakAfter === 'always') { ctx.out.push({ t: 'pb' }); ctx.afterBreak = true; }
  }

  const ctx = { root: { left: L, right: R, top: T }, cursor: T, out: [] };
  emitChildren(body, ctx);
  return { blocks: ctx.out, width: Math.max(1, R - L), bodyFont: S.font(body), title: doc.title || '' };
}

/* ─── shared download helpers ─── */
export function withExt(name, ext) {
  return String(name || 'report').replace(/\.(docx?|xlsx?|html?)$/i, '') + ext;
}

/* `doc` lets a popup preview window trigger the download from itself. */
export function saveBlob(blob, filename, doc = document) {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* Render → rasterise graphics → layout, in one call. */
export async function layoutFromHtml(html, opts = {}) {
  const r = await renderHtmlInFrame(html, opts);
  try {
    await inlineGraphics(r.doc, r.win);
    return { layout: buildLayout(r.doc, r.win), page: r.page };
  } finally {
    r.dispose();
  }
}
