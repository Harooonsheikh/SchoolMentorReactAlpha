/* ════════════════════════════════════════════════════════════════════
   CRA dev-server proxy.

   The shared ERP API (branch directory at /api/Registration/*) lives on a
   different host and does NOT send CORS headers for http://localhost:3001,
   so a direct browser fetch is blocked even though the server replies 200.

   In development we therefore call our OWN origin with a relative path and
   let the dev server forward the request to the ERP host server-to-server,
   where the browser's CORS policy does not apply. This file is picked up
   automatically by react-scripts (no import needed).

   Override the target with REACT_APP_SA_ERP_API when the ERP host changes.
   ════════════════════════════════════════════════════════════════════ */
const { createProxyMiddleware } = require('http-proxy-middleware');

const ERP_TARGET = process.env.REACT_APP_SA_ERP_API || 'http://50.190.164.42:4100';
const AI_TARGET = process.env.REACT_APP_SA_AI_API || 'http://50.190.164.42:8000';

module.exports = function (app) {
  /* ERP API — branch directory (host :4100). */
  app.use(
    '/api/Registration',
    createProxyMiddleware({
      target: ERP_TARGET,
      changeOrigin: true,
    }),
  );

  /* AI / wallet API — plan + subscription state per branch (host :8000). */
  app.use(
    '/ai',
    createProxyMiddleware({
      target: AI_TARGET,
      changeOrigin: true,
    }),
  );
};
