import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Import from "@/..." instead of long relative paths.
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Own port so this app runs alongside the ERP (3000) and Super-Admin.
    // strictPort = fail loudly instead of silently hopping to another port.
    port: 3002,
    strictPort: true,
    open: false,
    proxy: {
      // Dev proxy: the browser calls "/api/..." (same origin) and Vite
      // forwards it to the .NET backend — no CORS setup needed in dev.
      // ▶ Change `target` to wherever your .NET API runs (e.g. the
      //   Kestrel http/https port from launchSettings.json).
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      /* Chain-Management API (networks, network-schools). Seedha alphaapi call
         nahi kar sakte: uska CORS allowlist sirf localhost:3000 (ERP) rakhta
         hai, ye app 3002 par chalti hai — browser block kar deta. Proxy se
         request same-origin ho jaati hai, koi CORS nahi.
         Deploy par bhi yahi rewrite chahiye (ERP ke public/web.config jaisa). */
      '/SchoolmentorChainManagementAPI': {
        target: 'https://alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
      /* Super-Admin API (school module permissions) — wahi CORS wajah. */
      '/SchoolMentorSuperAdminAPI': {
        target: 'https://alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // `vite preview` (npm run preview) serves the production build on the same
  // port, so a quick local check matches the deployed static-serve port.
  preview: {
    port: 3002,
    strictPort: true,
  },
})
