import { useEffect, useState } from 'react';

/*
  useUiPref — persist a small UI-only preference (theme, sidebar collapsed,
  active tab, etc.) in localStorage. NEVER use this for ERP business data —
  that goes through services/ and the backend.
*/
export default function useUiPref(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota or privacy-mode errors */
    }
  }, [key, value]);

  return [value, setValue];
}
