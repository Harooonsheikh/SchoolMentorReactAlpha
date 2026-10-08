/* ═══════════════════════════════════════════════════════════════════
   "Download Word" for full-page HTML (fee challans, HR directory, HR
   letters). Kept as the public API those modules import; the work is done
   by the shared native .docx exporter (wordExport.js), which lays the page
   out in the browser and writes real Word paragraphs/tables/images — the
   old altChunk approach left the HTML for Word's importer to interpret and
   lost colours, flex layout, cell styling and logos.
   ═══════════════════════════════════════════════════════════════════ */
import { htmlToDocxBlob, downloadHtmlAsDocx } from './wordExport';

/* Full page HTML → .docx Blob (async). `landscape` forces landscape pages
   (wide challan sheets); otherwise the page's own @page size is used. */
export function buildDocxFromHtml(htmlContent, { landscape } = {}) {
  return htmlToDocxBlob(String(htmlContent || '<html><body></body></html>'), { landscape });
}

/* Build the .docx and hand it to the browser as a download. Never rejects
   (callers fire-and-forget): on failure the raw HTML is saved as .doc. */
export function downloadDocxFromHtml(htmlContent, filename, opts = {}) {
  const html = String(htmlContent || '<html><body></body></html>');
  const name = String(filename || 'document').replace(/\.docx?$/i, '');
  return downloadHtmlAsDocx(html, name, { landscape: opts.landscape })
    .catch((err) => {
      console.error('Word export failed, falling back to HTML .doc', err);
      const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${name}.doc`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
}
