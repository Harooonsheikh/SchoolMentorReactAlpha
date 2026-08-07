import { useCallback, useEffect, useState } from 'react';
import SuperAdminShell from './superadmin/SuperAdminShell';
import SuperAdminLogin from './superadmin/SuperAdminLogin';
import AgentSupport from './components/AgentSupport';
import { configureSuperAdmin, setSuperAdminToken } from './superadmin/api';
import { clearStoredSession, hasStoredSession } from './superadmin/api/services/auth';

/* Hash routing keeps the Super Admin app and the standalone Support console
   in one bundle:
     • (default) / #superadmin → the Super Admin app
     • #agent                  → the full-screen Support console
   The Support tab inside the Super Admin shell reuses the same console. */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

/* ── Session ───────────────────────────────────────────────────────
   Bilkul ERP ka format (src/App.js ka AuthGate): session SIRF sessionStorage
   me rehti hai. sessionStorage har tab ki apni hoti hai, is liye:
     • URL naye tab me paste karo  → login screen (wahan koi session nahi)
     • tab band                     → session khatam
   Isi liye "Keep me signed in" (jo session localStorage me rakhta tha aur
   saari tabs me share ho jati thi) login screen se hata diya gaya hai.

   When the console is embedded in a host app the host supplies the token
   through configureSuperAdmin() instead and REACT_APP_SA_TOKEN is set — in
   that case there is nothing to sign in to and the shell renders directly. */
const SESSION_KEY = 'sa-session';

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      /* Signed-in tab wahi hai jahan sessionStorage me superadminid AUR
         superadmintoken dono mojood hon — ek bhi na ho to sab saaf aur
         login screen. */
      if (parsed?.token && hasStoredSession()) return parsed;
    }
  } catch { /* storage blocked or corrupt entry — treat as signed out */ }
  clearSession();
  return null;
}

function writeSession(session) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
  /* Purani builds "Keep me signed in" par ise localStorage me rakhti thin —
     wo baqiya yahan se hamesha ke liye hata do. */
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function clearSession() {
  for (const store of [localStorage, sessionStorage]) {
    try { store.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }
  /* Login ke waqt jo superadmin* keys likhi thin (id/username/token waghera)
     wo bhi hata do — warna logout ke baad session storage me pari rehti hain. */
  clearStoredSession();
}

function App() {
  const hash = useHashRoute();
  const [session, setSession] = useState(readSession);

  /* Push the token into the API layer so every service call carries it, and
     restore it after a reload. */
  useEffect(() => {
    if (session?.token) {
      configureSuperAdmin({
        token: session.token,
        name: session.user?.name || null,
        email: session.user?.email || null,
        role: session.user?.role || null,
        userId: session.user?.id ?? null,
      });
    } else {
      setSuperAdminToken(null);
    }
  }, [session]);

  const handleLogin = useCallback((next) => {
    writeSession(next);
    setSession(next);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  /* The support console keeps its own entry point — agents reach it directly
     at #agent and are not necessarily Super Admin users, so it stays ungated. */
  if (hash === '#agent') return <AgentSupport />;

  if (!session) return <SuperAdminLogin onLogin={handleLogin} />;

  return <SuperAdminShell user={session.user} onLogout={handleLogout} />;
}

export default App;
