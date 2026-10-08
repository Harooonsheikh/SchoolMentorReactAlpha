/* ═══════════════════════════════════════════════════════════════════
   WORD EXPORT — report HTML → native .docx (WordprocessingML).

   Replaces the old "HTML saved as .doc" / "HTML in an altChunk" exports,
   which relied on Word's legacy HTML importer and lost colours, flex/grid
   layout, cell styling, SVG logos, etc. The report is laid out by the
   browser (see officeRender.js) and written out as real paragraphs, runs
   and tables, so Word shows what the PDF shows. No dependencies.
   ═══════════════════════════════════════════════════════════════════ */
import { layoutFromHtml, saveBlob, withExt } from './officeRender';

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const PX_TW = 15;          // 1 CSS px = 15 twips
const MM_TW = 56.6929;     // 1 mm = 56.69 twips
const PX_EMU = 9525;       // 1 CSS px = 9525 EMU

const xmlEsc = (s) => String(s ?? '')
  // eslint-disable-next-line no-control-regex -- strip characters XML 1.0 forbids
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LATIN_RE = /[A-Za-z]/;

/* ─── tiny STORE-only ZIP writer ─── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
export function zipStore(files, type) {
  const enc = new TextEncoder();
  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
  const local = [], central = [];
  let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const head = new Uint8Array([].concat(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
    ));
    local.push(head, name, data);
    central.push(new Uint8Array([].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
    )), name);
    offset += head.length + name.length + data.length;
  });
  const size = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(size), u32(offset), u16(0)));
  return new Blob([...local, ...central, end], { type });
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ─── WordprocessingML writer ───
   `sx` scales EVERY measure (fonts, spacing, widths, images) uniformly —
   exactly what the browser does when it fits the report onto the printed
   page — so lines wrap where they wrap in the PDF. */
function createWriter(sx) {
  const tw = (px) => Math.round((px || 0) * sx * PX_TW);
  const media = [];
  const mediaByData = new Map();
  let drawingId = 0;

  const borderStyle = (s) => (s === 'dashed' ? 'dashed' : s === 'dotted' ? 'dotted' : s === 'double' ? 'double' : 'single');
  const eighths = (px) => Math.max(2, Math.min(96, Math.round(px * 0.75 * 8)));
  const bdr = (tag, b, withSpace) => (b
    ? `<w:${tag} w:val="${borderStyle(b.style)}" w:sz="${eighths(b.wPx)}" w:space="${withSpace ? Math.min(31, Math.round((b.space || 0) * 0.75)) : 0}" w:color="${b.color}"/>`
    : `<w:${tag} w:val="nil"/>`);

  const rPr = (f, shade, rtl) => {
    const name = xmlEsc(f.name);
    const hp = Math.max(2, Math.round(f.sizePt * sx * 2));
    return '<w:rPr>'
      + `<w:rFonts w:ascii="${name}" w:hAnsi="${name}" w:cs="${name}" w:eastAsia="${name}"/>`
      + (f.bold ? '<w:b/><w:bCs/>' : '')
      + (f.italic ? '<w:i/><w:iCs/>' : '')
      + (f.strike ? '<w:strike/>' : '')
      + `<w:color w:val="${f.color}"/>`
      + `<w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/>`
      + (f.underline ? '<w:u w:val="single"/>' : '')
      + (shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '')
      + (rtl ? '<w:rtl/>' : '')
      + '</w:rPr>';
  };

  const imageRun = (im, availTw) => {
    let w = im.w * sx, h = im.h * sx;
    const maxPx = Math.max(16, availTw / PX_TW);
    if (w > maxPx) { h = h * maxPx / w; w = maxPx; }
    let rid = mediaByData.get(im.b64);
    if (!rid) {
      rid = `rIdImg${media.length + 1}`;
      media.push({ rid, name: `image${media.length + 1}.${im.ext}`, ext: im.ext, b64: im.b64 });
      mediaByData.set(im.b64, rid);
    }
    const id = ++drawingId;
    const cx = Math.max(1, Math.round(w * PX_EMU)), cy = Math.max(1, Math.round(h * PX_EMU));
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>`
      + `<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Picture ${id}"/>`
      + '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
      + `<a:graphic><a:graphicData uri="${NS_PIC}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Picture ${id}"/><pic:cNvPicPr/></pic:nvPicPr>`
      + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
      + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  };

  const runXml = (r, availTw) => {
    if (r.br) return '<w:r><w:br/></w:r>';
    if (r.image) return imageRun(r.image, availTw);
    const rtl = RTL_RE.test(r.text) && !LATIN_RE.test(r.text);
    return `<w:r>${rPr(r.font, r.shade, rtl)}<w:t xml:space="preserve">${xmlEsc(r.text)}</w:t></w:r>`;
  };

  const spacer = (tw) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.max(20, tw)}" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>`;

  /* `area` = the horizontal space blocks live in: total width `w` (twips)
     and the insets `l`/`r` (a cell's side padding). Side padding is applied
     as paragraph/table indentation instead of cell margins, because Word
     2010 shifts a whole table left by its first cell's left margin while
     Word 2013+ does not — indentation renders the same everywhere. */
  const paraXml = (p, area) => {
    const pp = [];
    if (p.borders) {
      const b = p.borders;
      pp.push(`<w:pBdr>${b.top ? bdr('top', b.top, true) : ''}${b.left ? bdr('left', b.left, true) : ''}${b.bottom ? bdr('bottom', b.bottom, true) : ''}${b.right ? bdr('right', b.right, true) : ''}</w:pBdr>`);
    }
    if (p.rtl) pp.push('<w:bidi/>');
    let spacing = `<w:spacing w:before="${tw(p.before)}" w:after="${tw(p.after)}"`;
    if (p.rule) spacing += ' w:line="20" w:lineRule="exact"';
    else if (p.lineH) spacing += ` w:line="${Math.max(20, tw(p.lineH))}" w:lineRule="atLeast"`;
    else spacing += ' w:line="240" w:lineRule="auto"';
    pp.push(`${spacing}/>`);
    let il = area.l + tw(p.indL), ir = area.r + tw(p.indR);
    if (il + ir > area.w - 400) { ir = Math.min(ir, area.r); il = Math.max(0, Math.min(il, area.w - ir - 400)); }
    if (il || ir) pp.push(`<w:ind w:left="${il}" w:right="${ir}"/>`);
    pp.push(`<w:jc w:val="${p.align === 'justify' ? 'both' : p.align}"/>`);
    if (p.rule) pp.push('<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>');
    const inner = Math.max(400, area.w - il - ir);
    return `<w:p><w:pPr>${pp.join('')}</w:pPr>${(p.runs || []).map(r => runXml(r, inner)).join('')}</w:p>`;
  };

  function blocksXml(blocks, area) {
    let xml = '';
    let prevTable = false;
    blocks.forEach(b => {
      if (b.t === 'pb') { xml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; prevTable = false; return; }
      if (b.t === 'p') { xml += paraXml(b, area); prevTable = false; return; }
      if (b.t === 'tbl') {
        const gapTw = tw(b.before);
        /* Word merges back-to-back tables, so always keep a separator. */
        if (gapTw >= 30 || prevTable) xml += spacer(gapTw);
        xml += tableXml(b, area);
        prevTable = true;
      }
    });
    return { xml, endsWithTable: prevTable };
  }

  function cellXml(cell, wTw, span, vmerge) {
    const pad = cell.pad || {};
    const b = cell.borders || {};
    const tcPr = `<w:tcPr><w:tcW w:w="${wTw}" w:type="dxa"/>`
      + (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '')
      + (vmerge === 'restart' ? '<w:vMerge w:val="restart"/>' : vmerge === 'continue' ? '<w:vMerge/>' : '')
      + `<w:tcBorders>${bdr('top', b.top)}${bdr('left', b.left)}${bdr('bottom', b.bottom)}${bdr('right', b.right)}</w:tcBorders>`
      + (cell.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${cell.fill}"/>` : '')
      + `<w:tcMar><w:top w:w="${tw(pad.t)}" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="${tw(pad.b)}" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar>`
      + `<w:vAlign w:val="${cell.valign || 'top'}"/></w:tcPr>`;
    if (vmerge === 'continue' || !cell.content || !cell.content.length) return `<w:tc>${tcPr}${spacer(20)}</w:tc>`;
    let l = tw(pad.l), r = tw(pad.r);
    if (l + r > wTw - 200) { l = Math.max(0, Math.floor((wTw - 200) / 2)); r = l; }
    const { xml, endsWithTable } = blocksXml(cell.content, { w: wTw, l, r });
    return `<w:tc>${tcPr}${xml}${endsWithTable || !xml ? spacer(20) : ''}</w:tc>`;
  }

  function tableXml(t, area) {
    const room = Math.max(400, area.w - area.l - area.r);
    let cols = t.cols.map(c => Math.max(20, tw(c)));
    let total = cols.reduce((a, c) => a + c, 0);
    let ind = Math.max(0, tw(t.left));
    if (ind + total > room) {
      ind = Math.max(0, room - total);
      if (total > room) {
        const k = room / total;
        cols = cols.map(c => Math.max(20, Math.floor(c * k)));
        total = cols.reduce((a, c) => a + c, 0);
      }
    }
    ind += area.l;
    const n = cols.length;
    const starts = t.rows.map(() => new Map());
    const conts = t.rows.map(() => new Map());
    t.rows.forEach((row, ri) => row.cells.forEach(cell => {
      starts[ri].set(cell.col, cell);
      for (let r = ri + 1; r < Math.min(t.rows.length, ri + (cell.rowspan || 1)); r++) conts[r].set(cell.col, cell);
    }));
    const spanW = (c, s) => cols.slice(c, c + s).reduce((a, x) => a + x, 0);

    let rowsXml = '';
    t.rows.forEach((row, ri) => {
      let tcs = '';
      for (let c = 0; c < n;) {
        const st = starts[ri].get(c), ct = conts[ri].get(c);
        if (st) {
          const s = Math.min(st.colspan || 1, n - c);
          tcs += cellXml(st, spanW(c, s), s, (st.rowspan || 1) > 1 ? 'restart' : null);
          c += s;
        } else if (ct) {
          const s = Math.min(ct.colspan || 1, n - c);
          tcs += cellXml(ct, spanW(c, s), s, 'continue');
          c += s;
        } else {
          let e = c + 1;
          while (e < n && !starts[ri].get(e) && !conts[ri].get(e)) e++;
          tcs += cellXml({ content: [] }, spanW(c, e - c), e - c, null);
          c = e;
        }
      }
      /* Word adds cell top/bottom margins on top of the row height, while the
         browser-measured height already includes that padding. */
      const vpad = Math.max(0, ...row.cells.map(c => tw((c.pad && c.pad.t) || 0) + tw((c.pad && c.pad.b) || 0)));
      const h = Math.max(20, tw(row.height) - vpad);
      const trPr = `<w:trPr>${t.data ? '<w:cantSplit/>' : ''}<w:trHeight w:val="${h}" w:hRule="atLeast"/>${row.header && t.data ? '<w:tblHeader/>' : ''}</w:trPr>`;
      rowsXml += `<w:tr>${trPr}${tcs}</w:tr>`;
    });

    return '<w:tbl><w:tblPr>'
      + `<w:tblW w:w="${total}" w:type="dxa"/>`
      + (ind ? `<w:tblInd w:w="${ind}" w:type="dxa"/>` : '')
      + '<w:tblLayout w:type="fixed"/>'
      + '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
      + '</w:tblPr>'
      + `<w:tblGrid>${cols.map(c => `<w:gridCol w:w="${c}"/>`).join('')}</w:tblGrid>`
      + rowsXml
      + '</w:tbl>';
  }

  return { blocksXml, spacer, media };
}

function buildDocxParts(layout, page) {
  const landscape = !!page.landscape;
  const pw = landscape ? 16838 : 11906;
  const ph = landscape ? 11906 : 16838;
  const mm = page.margin || { top: 15, right: 15, bottom: 15, left: 15 };
  const mt = Math.round(mm.top * MM_TW), mr = Math.round(mm.right * MM_TW), mb = Math.round(mm.bottom * MM_TW), ml = Math.round(mm.left * MM_TW);
  const availTw = pw - ml - mr;
  /* Fit the report to the printable width — the same uniform shrink the
     browser applies when it prints the report to PDF. */
  const sx = Math.min(1, availTw / PX_TW / layout.width);
  const W = createWriter(sx);
  const { xml, endsWithTable } = W.blocksXml(layout.blocks, { w: availTw, l: 0, r: 0 });
  const bodyXml = xml + (endsWithTable || !xml ? W.spacer(20) : '');

  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}" xmlns:wp="${NS_WP}" xmlns:a="${NS_A}" xmlns:pic="${NS_PIC}"><w:body>`
    + bodyXml
    + `<w:sectPr><w:pgSz w:w="${pw}" w:h="${ph}"${landscape ? ' w:orient="landscape"' : ''}/>`
    + `<w:pgMar w:top="${mt}" w:right="${mr}" w:bottom="${mb}" w:left="${ml}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`
    + '</w:body></w:document>';

  const bf = layout.bodyFont || { name: 'Arial', sizePt: 10, color: '000000' };
  const fname = xmlEsc(bf.name);
  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<w:styles xmlns:w="${NS_W}"><w:docDefaults><w:rPrDefault><w:rPr>`
    + `<w:rFonts w:ascii="${fname}" w:hAnsi="${fname}" w:cs="${fname}" w:eastAsia="${fname}"/>`
    + `<w:color w:val="${bf.color}"/><w:sz w:val="${Math.round(bf.sizePt * sx * 2)}"/><w:szCs w:val="${Math.round(bf.sizePt * sx * 2)}"/><w:lang w:val="en-US" w:bidi="ur-PK"/>`
    + '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    + '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/>'
    + '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
    + '</w:styles>';

  const settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<w:settings xmlns:w="${NS_W}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>`
    + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';

  const exts = Array.from(new Set(W.media.map(m => m.ext)));
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + exts.map(e => `<Default Extension="${e}" ContentType="image/${e}"/>`).join('')
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + '</Types>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="word/document.xml"/>`
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    + '</Relationships>';

  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rIdStyles" Type="${NS_R}/styles" Target="styles.xml"/>`
    + `<Relationship Id="rIdSettings" Type="${NS_R}/settings" Target="settings.xml"/>`
    + W.media.map(m => `<Relationship Id="${m.rid}" Type="${NS_R}/image" Target="media/${m.name}"/>`).join('')
    + '</Relationships>';

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + `<dc:title>${xmlEsc(layout.title)}</dc:title><dc:creator>School Mentor</dc:creator>`
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>`
    + '</cp:coreProperties>';

  return [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'docProps/core.xml', data: coreXml },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/settings.xml', data: settingsXml },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    ...W.media.map(m => ({ name: `word/media/${m.name}`, data: b64ToBytes(m.b64) })),
  ];
}

/* Report HTML (a full document, exactly what the PDF preview shows) → .docx Blob.
   opts.landscape forces orientation; otherwise the report's @page size is used. */
export async function htmlToDocxBlob(html, opts = {}) {
  const { layout, page } = await layoutFromHtml(html, opts);
  return zipStore(buildDocxParts(layout, page), DOCX_MIME);
}

/* opts.targetDocument: document to trigger the download from (popup previews). */
export async function downloadHtmlAsDocx(html, filename, opts = {}) {
  const blob = await htmlToDocxBlob(html, opts);
  saveBlob(blob, withExt(filename, '.docx'), opts.targetDocument);
  return blob;
}
