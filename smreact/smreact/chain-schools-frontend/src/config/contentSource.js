/* ═══════════════════════════════════════════════════════════════════
   Content source per content type (SOPs / Trainings).
   'mentor' → the chain's schools see School Mentor's official library.
   'custom' → the chain's schools see what the head office uploads here.
   localStorage-backed; swap for an API call later.
   ═══════════════════════════════════════════════════════════════════ */
const KEYS = { sops: 'csp_sops_source', trainings: 'csp_trainings_source', notifications: 'csp_notifications_source' }

export const loadSource = (kind) => (localStorage.getItem(KEYS[kind]) === 'mentor' ? 'mentor' : 'custom')
export const saveSource = (kind, val) => localStorage.setItem(KEYS[kind], val)
