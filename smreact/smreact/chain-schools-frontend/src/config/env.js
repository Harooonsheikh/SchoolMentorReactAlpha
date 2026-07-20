/* ═══════════════════════════════════════════════════════════════════
   Central config — read Vite env vars in ONE place so the rest of the
   app never touches import.meta.env directly.
   ═══════════════════════════════════════════════════════════════════ */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/* When true, the API service layer returns mock data instead of hitting
   the network — lets the UI run fully before the .NET backend exists. */
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'false') === 'true'

export const APP_NAME = 'School Chain Portal'
