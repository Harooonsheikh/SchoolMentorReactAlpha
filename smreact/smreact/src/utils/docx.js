/* ═══════════════════════════════════════════════════════════════════
   Minimal, dependency-free .docx (OOXML) generator so "Download Word"
   yields a REAL .docx (not HTML renamed .doc/.docx). A .docx is a ZIP of
   a few XML parts; the ZIP is built with the STORE method (no
   compression) so no zip library is needed.
   ═══════════════════════════════════════════════════════════════════ */

function docxCrc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    let c = (crc ^ bytes[i]) & 0xFF;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function docxZip(files) {
  const enc = new TextEncoder();
  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
  const local = [], central = [];
  let offset = 0;
  files.forEach((f) => {
    const nameB = enc.encode(f.name);
    const data  = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc   = docxCrc32(data);
    const size  = data.length;
    const lh = new Uint8Array([].concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameB.length), u16(0),
    ));
    local.push(lh, nameB, data);
    central.push(new Uint8Array([].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size),
      u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
    )), nameB);
    offset += lh.length + nameB.length + size;
  });
  const cdStart = offset;
  const cdSize  = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([].concat(
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cdSize), u32(cdStart), u16(0),
  ));
  return new Blob([...local, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/* Wrap FULL page HTML (letterhead, colours, borders — the exact same markup
   the PDF/preview uses) inside a .docx via an altChunk part. Word converts the
   embedded HTML on open, so the .docx looks identical to the PDF instead of a
   plain-text transcription.

   `landscape` widens the page and swaps the margins — used by wide challan
   sheets that would otherwise wrap. */
export function buildDocxFromHtml(htmlContent, { landscape = false } = {}) {
  const pgSz = landscape
    ? `<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>`
    : `<w:pgSz w:w="11906" w:h="16838"/>`;
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>` +
    `<w:altChunk r:id="htmlChunk"/>` +
    `<w:sectPr>${pgSz}<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>` +
    `</w:body></w:document>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/afchunk.html" ContentType="text/html"/></Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/></Relationships>`;
  return docxZip([
    { name: '[Content_Types].xml',            data: contentTypes },
    { name: '_rels/.rels',                    data: rels },
    { name: 'word/document.xml',              data: documentXml },
    { name: 'word/_rels/document.xml.rels',   data: docRels },
    { name: 'word/afchunk.html',              data: String(htmlContent || '<html><body></body></html>') },
  ]);
}

/* Build the .docx and hand it to the browser as a download. */
export function downloadDocxFromHtml(htmlContent, filename, opts) {
  const blob = buildDocxFromHtml(htmlContent, opts);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = String(filename || 'document').replace(/\.docx?$/i, '') + '.docx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
