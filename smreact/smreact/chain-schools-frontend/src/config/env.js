/* ═══════════════════════════════════════════════════════════════════
   Central config — read Vite env vars in ONE place so the rest of the
   app never touches import.meta.env directly.
   ═══════════════════════════════════════════════════════════════════ */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/* When true, the API service layer returns mock data instead of hitting
   the network — lets the UI run fully before the .NET backend exists. */
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'false') === 'true'

export const APP_NAME = 'School Chain Portal'

/* Chain-Management API (networks + network-schools requests). Default khali =
   apna hi origin, yaani dev me Vite ka proxy aur deploy par server ka rewrite
   (dekhein vite.config.js). Kisi aur host par bhejna ho to VITE_CHAIN_API_BASE
   set karein. */
const trimEnd = (v) => String(v ?? '').trim().replace(/\/+$/, '')

export const CHAIN_API_BASE = trimEnd(import.meta.env.VITE_CHAIN_API_BASE) + '/SchoolmentorChainManagementAPI'

/* Super-Admin API (school module permissions). Wahi usool jo upar hai:
   khali = apna origin → dev me Vite proxy, deploy par server rewrite. */
export const SUPERADMIN_API_BASE = trimEnd(import.meta.env.VITE_SUPERADMIN_API_BASE) + '/SchoolMentorSuperAdminAPI'

/* ERP ka login page. Is portal me apna login form nahi chalta — session hamesha
   ERP ke Network Head Office login se aata hai (URL hash handoff, dekhein
   main.jsx). Is liye sign-out aur "no session" dono wahin wapas bhejte hain.
     • local dev → ERP :3000 (chain :3002 par chalta hai)
     • deploy    → VITE_ERP_URL set karein */
export const ERP_URL = String(
  import.meta.env.VITE_ERP_URL
  || `${window.location.protocol}//${window.location.hostname}:3000`,
).trim().replace(/\/+$/, '') + '/'

/* ERP par wapas bhejte waqt `?acct=network` lagate hain: ERP ka login screen
   ise dekh kar "Network Head Office" tab pehle se select kar deta hai (aur
   signup bhi network wala chalta hai). Warna chain ka user har baar khud tab
   badalta — jabke wo aaya hi network se hai. */
export const ERP_LOGIN_URL = `${ERP_URL}?acct=network`
