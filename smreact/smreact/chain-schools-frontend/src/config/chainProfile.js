/* ═══════════════════════════════════════════════════════════════════
   Chain / head-office profile — single source of truth shared between
   Settings (where it is edited, incl. the logo) and anything that needs
   to brand output (e.g. printed reports). localStorage-backed for now;
   swap for an API call later.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_chain_profile'

export const DEFAULT_CHAIN_PROFILE = {
  chainName: 'Mentor Education Group',
  logo: null, // data URL, set when a logo is uploaded in Settings
  address: 'Plot 12, Bahria Town Phase 4, Rawalpindi, Punjab, Pakistan',
  contact: '+92 300 1234567',
  email: 'admin@mentoredu.pk',
  website: 'https://www.mentoredu.pk',
}

export function loadChainProfile() {
  try {
    return { ...DEFAULT_CHAIN_PROFILE, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }
  } catch {
    return { ...DEFAULT_CHAIN_PROFILE }
  }
}

export function saveChainProfile(profile) {
  localStorage.setItem(KEY, JSON.stringify(profile))
}

export const chainInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'SC'
