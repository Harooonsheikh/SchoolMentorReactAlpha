import { useEffect, useState } from 'react';
import SuperAdminShell from './superadmin/SuperAdminShell';
import AgentSupport from './components/AgentSupport';

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

function App() {
  const hash = useHashRoute();
  if (hash === '#agent') return <AgentSupport />;
  return <SuperAdminShell />;
}

export default App;
