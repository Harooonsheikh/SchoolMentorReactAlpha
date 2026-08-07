/* ════════════════════════════════════════════════════════════════════
   SUPER ADMIN — global session guard

   Bilkul wahi tareeqa jo ERP me chal raha hai (src/utils/apiConfig.js ka
   installSessionGuard) — sirf keys Super Admin ki hain:

     superadminid + superadmintoken   (login ke waqt sessionStorage me likhi
                                       jaati hain — dekho SA_SESSION_KEYS)

   Login ke BAAD agar ye keys kisi bhi wajah se ghaayab ho jayein (session
   storage clear, doosri tab se logout, token hata diya gaya), to console ko
   bina pehchan ke API calls maarte rehna nahi chahiye — user ko foran login
   page par wapas jana chahiye.

   Do raaste, dono ek saath (ERP me pehla hai; doosra is liye ke Super Admin
   ki screens API call ke darmiyan der tak khali baithi rehti hain, aur user
   ne "foran" kaha hai):
     1. window.fetch ek dafa wrap — har API call se pehle keys ki jaanch, aur
        server ka 401 bhi. Guard chalte hi request abort.
     2. Halka sa interval — bina kisi API call ke bhi khaali session pakad
        leta hai (setInterval + tab wapas focus hone par).

   Auth endpoints (login waghera) kabhi block nahi hote — un ke waqt session
   hoti hi nahi.
   ════════════════════════════════════════════════════════════════════ */
import { SA_SESSION_KEYS } from './services/auth';

/* Zinda session ke liye jo keys laazmi hain. */
export const SA_REQUIRED_KEYS = [SA_SESSION_KEYS.id, SA_SESSION_KEYS.token];

/** Sirf tab true jab saari laazmi keys sessionStorage me mojood hon. */
export function hasValidSession() {
  try { return SA_REQUIRED_KEYS.every((k) => !!sessionStorage.getItem(k)); }
  catch { return false; }
}

/** Ye URL backend call hai ya koi static asset? */
function isApiUrl(url) {
  const u = String(url || '');
  return /(^|\/)(api|SchoolMentorSuperAdminAPI|ai)\//i.test(u)
    || /(^|\/)((get|save|saveupdate|delete|assign|toggle)-|report-header)/i.test(u);
}

/** Pre-login endpoints — inhe guard kabhi nahi rokta. */
function isAuthUrl(url) {
  return /\/(Auth|Account)\/|[/-](login|signin|signup|register|refresh|forgot|reset|send-otp)/i.test(String(url || ''));
}

/** Guard ki pehredaari on/off. Login screen par OFF (wahan session hoti hi nahi). */
export function setSessionGuardActive(on) {
  if (typeof window !== 'undefined') window.__saSessionGuardActive = !!on;
}

/**
 * Ek dafa window.fetch wrap karo aur ek halka interval chalao.
 * Baar baar call karna mehfooz hai — wrapper sirf pehli martaba lagta hai,
 * aage sirf dobara active ho jata hai.
 *
 * @param {{ onExpired: () => void, pollMs?: number }} opts
 * @returns {() => void} cleanup — interval/listener hata deta hai
 */
export function installSessionGuard({ onExpired, pollMs = 1500 } = {}) {
  if (typeof window === 'undefined') return () => {};
  window.__saSessionGuardActive = true;

  /* Ek hi baar chale — warna toast/logout kai dafa chal jate hain. */
  let firing = false;
  const trigger = () => {
    if (firing || !window.__saSessionGuardActive) return;
    firing = true;
    try { if (onExpired) onExpired(); } finally { setTimeout(() => { firing = false; }, 2000); }
  };
  window.__saSessionExpired = trigger;

  if (!window.__saSessionGuard) {
    window.__saSessionGuard = true;
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (window.__saSessionGuardActive && isApiUrl(url) && !isAuthUrl(url) && !hasValidSession()) {
        window.__saSessionExpired?.();
        const err = new Error('Your session has ended');
        err.isSessionExpired = true;
        throw err;
      }
      const res = await origFetch(input, init);
      try {
        if (res && res.status === 401 && window.__saSessionGuardActive && isApiUrl(url) && !isAuthUrl(url)) {
          window.__saSessionExpired?.();
        }
      } catch { /* ignore */ }
      return res;
    };
  }

  /* API call ka intezaar kiye baghair bhi — keys hatte hi pakad lo. */
  const check = () => { if (window.__saSessionGuardActive && !hasValidSession()) trigger(); };
  const timer = setInterval(check, pollMs);
  window.addEventListener('focus', check);
  window.addEventListener('storage', check);     // doosri tab se logout

  return () => {
    clearInterval(timer);
    window.removeEventListener('focus', check);
    window.removeEventListener('storage', check);
  };
}
