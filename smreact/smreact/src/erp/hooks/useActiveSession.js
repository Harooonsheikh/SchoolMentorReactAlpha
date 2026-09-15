import { useCallback, useEffect, useState } from 'react';
import { activeSessionId, activeSessionName, SESSION_CHANGE_EVENT } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   useActiveSessionName — the academic session every module should show.

   Reads the ONE stored session (see utils/apiConfig) and re-renders when
   it changes: the app-wide bootstrap resolving it, the Settings screen
   making another session current, or the user switching sessions in
   Academics / Examination / Paper Generator. Cross-tab edits arrive via
   the native `storage` event.

   Modules used to read sessionStorage once during render — so whichever
   module mounted before the session was resolved kept rendering its own
   hardcoded fallback year for the rest of the visit. That is the bug this
   hook exists to close. It returns '' (never an invented year) while the
   session is still unknown; render that as "—".
   ═══════════════════════════════════════════════════════════════════ */
/** { id, name } of the active session, kept in sync with the store. */
export function useActiveSession() {
  const read = useCallback(
    () => ({ id: activeSessionId(), name: activeSessionName() }),
    [],
  );
  const [sess, setSess] = useState(read);

  useEffect(() => {
    const sync = () => setSess(prev => {
      const next = read();
      /* Same values → same object, so subscribers don't re-render on every
         notify (the event fires on any session key write). */
      return (prev.id === next.id && prev.name === next.name) ? prev : next;
    });
    sync();                                   /* catch a change we missed while unmounted */
    window.addEventListener(SESSION_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [read]);

  return sess;
}

/** Just the display name — what almost every caller wants. */
export function useActiveSessionName() {
  return useActiveSession().name;
}

export default useActiveSessionName;
