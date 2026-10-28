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
      /* ERP ka API — LaunchSetup (school ki classes + fee heads) isi par hai,
         School Payments ka royalty setup wahin se banta hai. ERP ke apne API
         ka koi prefix nahi, wo seedha `/api` par baitha hai.

         Pehle ye localhost:5000 par jaata tha (us waqt koi call thi hi nahi).
         Ab alphaapi par hai — wahi host jahan baqi dono APIs hain — kyunke
         seedha alphaapi call karne par CORS block karta hai (uska allowlist
         sirf localhost:3000 rakhta hai, ye app 3002 par chalti hai).
         ▶ Local .NET backend par kaam karna ho to yahan target badal lein. */
      /* Default proxy target = sandbox. Override via VITE_DEV_API_PROXY if needed. */
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
      /* Chain-Management API (networks, network-schools). */
      '/SchoolmentorChainManagementAPI': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
      /* Super-Admin API (school module permissions). */
      '/SchoolMentorSuperAdminAPI': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
      /* ERP screen-time — School Progress View Details. */
      '/manage-usertimespend': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
      '/usertimespend-report': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
      '/manage-mobileapp-permission': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
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
    proxy: {
      '/manage-usertimespend': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
      '/usertimespend-report': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
      '/manage-mobileapp-permission': {
        target: process.env.VITE_DEV_API_PROXY || 'https://sandbox-alphaapi.schoolmentor.ai',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
