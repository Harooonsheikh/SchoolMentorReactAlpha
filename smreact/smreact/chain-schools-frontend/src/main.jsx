import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/responsive.css' // loaded last so the mobile layer refines every module

/* ─── Purane build ka bacha hua session ───
   Pehle token/user localStorage me rakhe jaate thay. Ab sessionStorage par
   hain, is liye purani copy sirf ek bhoola hua credential hai — pehli hi
   load par hata dete hain. */
;(() => {
  try {
    localStorage.removeItem('csp_token')
    localStorage.removeItem('csp_user')
  } catch { /* storage band ho to koi baat nahi */ }
})()

/* ─── Cross-app logout (FROM the ERP) ───
   ERP se logout hone par (jab session chain ke "Switch to View" se aaya tha) wo
   chain portal ko `#logout` ke sath kholta hai taake chain ka session bhi saaf
   ho jaye. Clear karne ke baad ProtectedRoute khud ERP ke login par bhej deta
   hai. Handoff-in se PEHLE chalna zaroori hai. */
;(() => {
  if (!/[#&]logout(\b|=)/.test(window.location.hash)) return;
  try {
    sessionStorage.removeItem('csp_token');
    sessionStorage.removeItem('csp_user');
    sessionStorage.removeItem('csp_session');
    localStorage.removeItem('chain-active-view');
  } catch { /* storage band — koi baat nahi */ }
  try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* noop */ }
})();

/* ─── Session handoff from the ERP's Network Head Office login ───
   The ERP (different origin in dev: :3000 vs :3002, so browser storage is
   NOT shared) redirects here with the session in the URL hash. A hash is never
   sent to the server; we consume it before React mounts and strip it from
   the URL immediately so the token doesn't linger in the address bar or in
   history. Runs before AuthProvider reads storage, so the session is ready. */
;(() => {
  const hash = window.location.hash
  /* Naya compact format: #t=<raw jwt>&u=<encoded user json>.
     Purana #session=<encoded json> bhi support rehta hai taake koi khula hua
     tab / bookmark achanak na toote. */
  const tok = /[#&]t=([^&]+)/.exec(hash)
  const usr = /[#&]u=([^&]+)/.exec(hash)
  const legacy = /[#&]session=([^&]+)/.exec(hash)
  if (!tok && !legacy) return

  try {
    let token, user
    if (tok) {
      token = tok[1]
      user = usr ? JSON.parse(decodeURIComponent(usr[1])) : null
    } else {
      const p = JSON.parse(decodeURIComponent(legacy[1]))
      token = p.token
      user = p.user
    }
    // Dono ek saath — sirf user (bina token) ek adhoora session hai.
    if (token && user) {
      /* sessionStorage — dekhein auth/tokenStorage.js. Poori app wahin se
         padhti hai, is liye handoff bhi wahin likhta hai. */
      sessionStorage.setItem('csp_token', token)
      sessionStorage.setItem('csp_user', JSON.stringify(user))
    }
  } catch {
    /* malformed handoff — chain app apna login screen dikha dega */
  } finally {
    /* URL har soorat me saaf — chahe handoff parse hua ya toota hua tha.
       `finally` me is liye ke koi throw ho jaye to bhi token address bar me
       na reh jaye. replaceState → history me koi naya entry nahi banti, is liye
       Back dabane par token wala URL wapas nahi aata. */
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }
})()

/* Apply the persisted theme before first paint so dark mode covers the whole
   app (including the Login screen, which renders outside the admin layout). */
document.documentElement.setAttribute('data-theme', localStorage.getItem('chain-theme') === 'dark' ? 'dark' : 'light')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
