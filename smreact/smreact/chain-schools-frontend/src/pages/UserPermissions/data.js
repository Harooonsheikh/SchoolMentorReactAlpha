/* ═══════════════════════════════════════════════════════════════════
   USER MANAGEMENT — admin users, school assignment, module permissions.
   Ported from the Super Admin design and adapted to this app:
   • permission menus are derived from this app's real nav modules
   • school assignment uses this chain's ERP + Inactive schools
   ═══════════════════════════════════════════════════════════════════ */
import { NAV_SECTIONS } from '../../config/nav'
import { INITIAL_ERP, INITIAL_INACTIVE } from '../SchoolStatus/data'

const KEY_USERS = 'csp_um_users'
const KEY_PERMS = 'csp_um_perms'
const KEY_ASSIGN = 'csp_um_assign'

/* Menus available for permission — this app's actual modules. */
export const UM_MENUS = NAV_SECTIONS.flatMap((s) => s.items).map((i) => i.label)

/* Schools available for assignment, split by ERP / Inactive. */
export const ERP_SCHOOLS = INITIAL_ERP.map((s) => ({ id: s.id, name: s.name }))
export const INACTIVE_SCHOOLS = INITIAL_INACTIVE.map((s) => ({ id: s.id, name: s.name }))

const SEED_USERS = [
  { id: 1, fullName: 'Romana Shabir', userName: 'romana', phone: '03030498528', address: 'Rawalpindi', password: 'pass123', active: true, pic: '' },
  { id: 2, fullName: 'Hamza Iftikhar', userName: 'hamza', phone: '03114468935', address: 'Lahore', password: 'pass123', active: true, pic: '' },
  { id: 3, fullName: 'Abdullah', userName: 'abdullah', phone: '03116205462', address: '', password: 'pass123', active: true, pic: '' },
  { id: 4, fullName: 'Arooj Jahanzaib', userName: 'arooj', phone: '03114468932', address: 'Islamabad', password: 'pass123', active: true, pic: '' },
  { id: 5, fullName: 'Dua Fatima', userName: 'dua', phone: '03190514512', address: '', password: 'pass123', active: true, pic: '' },
  { id: 6, fullName: 'Batool Fatima', userName: 'batool', phone: '03330343743', address: '', password: 'pass123', active: false, pic: '' },
  { id: 7, fullName: 'Pakiza Sajid', userName: 'pakiza', phone: '03700036867', address: '3rd Floor, Plaza 1, Paradise Commercial, Bahria Town Phase 04.', password: 'pass123', active: true, pic: '' },
  { id: 8, fullName: 'Mehwish Zulfiqar', userName: 'mehwish', phone: '03700036867', address: '3rd Floor, Plaza 1, Paradise Commercial, Bahria Town Phase 04.', password: 'pass123', active: true, pic: '' },
  { id: 9, fullName: 'Muhammad Abubakar', userName: 'abubakar', phone: '03211597365', address: 'House No 812, Sheikhan Wala Mohallah, Chunian, District Kasur', password: 'pass123', active: true, pic: '' },
  { id: 10, fullName: 'Amina Naseem', userName: 'amina', phone: '03155861110', address: 'Block B', password: 'pass123', active: true, pic: '' },
  { id: 11, fullName: 'Nimra Fatima', userName: 'nimra', phone: '03001234567', address: 'Rawalpindi', password: 'pass123', active: true, pic: '' },
  { id: 12, fullName: 'Neha Bukhari', userName: 'neha', phone: '03009876543', address: 'Lahore', password: 'pass123', active: true, pic: '' },
]

export function loadUsers() {
  try { const d = JSON.parse(localStorage.getItem(KEY_USERS)); if (Array.isArray(d) && d.length) return d } catch { /* reseed */ }
  localStorage.setItem(KEY_USERS, JSON.stringify(SEED_USERS))
  return JSON.parse(JSON.stringify(SEED_USERS))
}
export const saveUsers = (d) => localStorage.setItem(KEY_USERS, JSON.stringify(d))

const readMap = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {} } catch { return {} } }
export const loadPerms = () => readMap(KEY_PERMS)
export const savePerms = (d) => localStorage.setItem(KEY_PERMS, JSON.stringify(d))
export const loadAssign = () => readMap(KEY_ASSIGN)
export const saveAssign = (d) => localStorage.setItem(KEY_ASSIGN, JSON.stringify(d))

export const initialsOf = (name = '') => name.slice(0, 2).toUpperCase()
