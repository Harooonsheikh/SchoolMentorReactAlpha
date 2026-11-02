/* Create-React-App automatically loads this file in development (`npm start`)
   and mounts the middleware on the dev server. It does nothing in a production
   build — prod is covered by the matching rewrite rules in public/web.config.
   http-proxy-middleware ships with react-scripts, so this adds no dependency.

   WHY THIS EXISTS — the branch logo on a report.
   Uploaded media (branch logos, staff/student photos, documents) is served by
   the media host at https://alphaapi.schoolmentor.ai/UploadedImages/... The app
   loads it cross-origin for DISPLAY, which works. But the Word (.docx) and Excel
   (.xlsx) exporters must RE-READ the logo's pixels to embed it in the file, and
   that host sends no CORS headers, so a cross-origin <img> both blocks `fetch`
   and taints the canvas. officeRender.js (`sameOriginMedia`) works around this
   by re-pointing the media URL at the app's OWN origin and relying on a reverse
   proxy to serve the same bytes same-origin. In production that is web.config;
   in development it is this file. Without it the logo was silently dropped from
   downloaded Word/Excel reports. */
const { createProxyMiddleware } = require('http-proxy-middleware');

// Same default/override as utils/apiConfig.js MEDIA_BASE.
const MEDIA_BASE = (process.env.REACT_APP_MEDIA_BASE || 'https://alphaapi.schoolmentor.ai')
  .trim()
  .replace(/\/+$/, '');

module.exports = function setupProxy(app) {
  app.use(
    ['/UploadedImages', '/UploadedDocuments', '/Uploads'],
    createProxyMiddleware({
      target: MEDIA_BASE,
      changeOrigin: true,
      secure: true,
    }),
  );
};
