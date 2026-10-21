import { useEffect } from 'react';
import SchoolMentorShell from './components/App';
import { ModuleProvider, useModules } from './context/ModuleContext';
import { PermissionsProvider, usePermissions  } from './context/PermissionsContext';
import { setErpNavHandlers } from './utils/auth';


function ShellGate() {
  const { ready: modulesReady } = useModules();
  const { ready: permsReady } = usePermissions();
  if (!modulesReady || !permsReady) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg-base, #F0F4FF)' }}>
        <div className="shell-spinner" aria-label="Loading" />
      </div>
    );
  }
  return <SchoolMentorShell />;
}


function App({ onExitToSetup, onLogout }) {
  // Register the host's in-app navigation callbacks so the ERP's logout /
  // "Launch Setup" actions switch screens instead of redirecting to another port.
  useEffect(() => {
    setErpNavHandlers({ onExitToSetup, onLogout });
  }, [onExitToSetup, onLogout]);

  return (
    <ModuleProvider>
      <PermissionsProvider>
        <ShellGate />
      </PermissionsProvider>
    </ModuleProvider>
  );
}

export default App;
