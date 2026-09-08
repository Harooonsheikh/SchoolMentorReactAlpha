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

  /* SchoolMentorSuperAdminAPI — School Permissions branch directory + toggles
     (host :4100, own application root). Its CORS allow-list does not include
     this app's dev port (localhost:3001), so in development it can only be
     reached through this proxy. Production calls :4100 directly — see
     .env.production. */
  app.use(
    '/SchoolMentorSuperAdminAPI',
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

  /* ERP screen-time — swagger: https://alphaapi.schoolmentor.ai/manage-usertimespend
     Local 3001 se seedha alphaapi CORS/403 deta hai, is liye same-origin
     proxy. Target swagger wala host hai, :4100 IP nahi (wo 403 de raha tha). */
  app.use(
    '/manage-usertimespend',
    createProxyMiddleware({
      target: 'https://alphaapi.schoolmentor.ai',
      changeOrigin: true,
      secure: false,
    }),
  );

  /* Monthly Progress — swagger: POST /usertimespend-report */
  app.use(
    '/usertimespend-report',
    createProxyMiddleware({
      target: 'https://alphaapi.schoolmentor.ai',
      changeOrigin: true,
      secure: false,
    }),
  );

  /* School Permissions — swagger: POST /manage-mobileapp-permission */
  app.use(
    '/manage-mobileapp-permission',
    createProxyMiddleware({
      target: 'https://alphaapi.schoolmentor.ai',
      changeOrigin: true,
      secure: false,
    }),
  );
};
