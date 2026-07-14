import { useEffect } from 'react';
import SchoolMentorShell from './components/App';
import { ModuleProvider } from './context/ModuleContext';
import { PermissionsProvider } from './context/PermissionsContext';
import { setErpNavHandlers } from './utils/auth';

function App({ onExitToSetup, onLogout }) {
  // Register the host's in-app navigation callbacks so the ERP's logout /
  // "Launch Setup" actions switch screens instead of redirecting to another port.
  useEffect(() => {
    setErpNavHandlers({ onExitToSetup, onLogout });
  }, [onExitToSetup, onLogout]);

  return (
    <ModuleProvider>
      <PermissionsProvider>
        <SchoolMentorShell />
      </PermissionsProvider>
    </ModuleProvider>
  );
}

export default App;
