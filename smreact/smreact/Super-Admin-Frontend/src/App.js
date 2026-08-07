import { useCallback, useEffect, useState } from 'react';
import SuperAdminShell from './superadmin/SuperAdminShell';
import SuperAdminLogin from './superadmin/SuperAdminLogin';
import AgentSupport from './components/AgentSupport';
import { configureSuperAdmin, setSuperAdminToken } from './superadmin/api';
import { clearStoredSession, hasStoredSession, restoreStoredSession } from './superadmin/api/services/auth';

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
   "Keep me signed in" decides the store: localStorage survives a browser
   restart, sessionStorage dies with the tab. Both are read on boot so the
   choice made at sign-in is the one that applies.

   When the console is embedded in a host app the host supplies the token
   through configureSuperAdmin() instead and REACT_APP_SA_TOKEN is set — in
   that case there is nothing to sign in to and the shell renders directly. */
const SESSION_KEY = 'sa-session';

function readSession() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) {
          /* Signed-in tab hi maana jayega jab sessionStorage me superadminid
             AUR superadmintoken dono hon. "Keep me signed in" wali session
             localStorage me hoti hai (tab band hone par sessionStorage keys
             gum ho jati hain) — is liye pehle unhe session se restore karne
             ki koshish, aur na ban sakein to sab saaf kar ke login page. */
          if (hasStoredSession() || restoreStoredSession(parsed)) return parsed;
          clearSession();
          return null;
        }
      }
    } catch { /* storage blocked or corrupt entry — treat as signed out */ }
  }
  return null;
}

function writeSession(session, remember) {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  try { target.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
  try { other.removeItem(SESSION_KEY); } catch { /* ignore */ }
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

  const handleLogin = useCallback((next, { remember } = {}) => {
    writeSession(next, remember);
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
