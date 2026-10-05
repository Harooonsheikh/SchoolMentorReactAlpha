/* ═══════════════════════════════════════════════════════════════════
   Chain / head-office profile — single source of truth shared between
   Settings (where it is edited, incl. the logo) and anything that needs
   to brand output (e.g. printed reports).

   • Koi static/dummy data NAHI — sab khali shuru hota hai.
   • Logged-in network ka data: chainName/email login (csp_user) se prefill
     hote hain (backend par chain-profile ki alag API abhi nahi hai).
   • localStorage PER-NETWORK key par hai (csp_chain_profile_<networkId>) —
     taake har network ko SIRF apna data mile, kisi doosre/purane global
     data ka bleed na ho. Backend endpoint milne par swap kar dena.
   ═══════════════════════════════════════════════════════════════════ */
import { getStoredUser } from '../auth/tokenStorage'

const KEY_PREFIX = 'csp_chain_profile'

export const DEFAULT_CHAIN_PROFILE = {
  chainName: '',
  logo: null, // data URL, set when a logo is uploaded in Settings
  address: '',
  contact: '',
  email: '',
  website: '',
}

/* Logged-in network id — storage key isi par scope hoti hai. */
function currentNetworkId() {
  const u = getStoredUser()
  return u?.networkID ?? u?.networkId ?? u?.id ?? 'anon'
}

function storageKey() {
  return `${KEY_PREFIX}_${currentNetworkId()}`
}

export function loadChainProfile() {
  const u = getStoredUser() || {}
  let saved = {}
  try {
    saved = JSON.parse(localStorage.getItem(storageKey())) || {}
  } catch {
    saved = {}
  }
  /* Saved value pehle; na ho to login se (network name / email); warna khali. */
  return {
    ...DEFAULT_CHAIN_PROFILE,
    chainName: saved.chainName || u.schoolNetwork || u.displayName || u.name || '',
    email:     saved.email || u.email || '',
    logo:      saved.logo ?? null,
    address:   saved.address || '',
    contact:   saved.contact || '',
    website:   saved.website || '',
  }
}

export function saveChainProfile(profile) {
  localStorage.setItem(storageKey(), JSON.stringify(profile))
}

export const chainInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'SC'
