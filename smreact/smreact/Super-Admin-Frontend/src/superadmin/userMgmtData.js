/* ═══════════════════════════════════════════════════════════════════
   USER MANAGEMENT — demo data (frontend only)

   Ported from "Teacher_Trainings_SuperAdmin (1).html". Admin users plus
   per-user school assignments and per-user menu permissions. The school
   lists for the Assign tab are reused from statusData (launch / erp).
   Mock data only — the integrating developer swaps these for API calls.
   ═══════════════════════════════════════════════════════════════════ */

/* Menus available for per-user permission. */
export const UM_MENUS = [
  'Dashboard', 'Uploader', 'Category', 'School Permissions', 'School Progress',
  'School Payments', 'Operational SOPs', 'User Registration', 'User Assignment',
];

export const INITIAL_USERS = [
  { id: 1,  fullName: 'Romana Shabir',     userName: 'romana',   phone: '03030498528', address: '', password: 'pass123', active: true, pic: '' },
  { id: 2,  fullName: 'Hamza Iftikhar',    userName: 'hamza',    phone: '03114468935', address: '', password: 'pass123', active: true, pic: '' },
  { id: 3,  fullName: 'Abdullah',          userName: 'abdullah', phone: '03116205462', address: '', password: 'pass123', active: true, pic: '' },
  { id: 4,  fullName: 'Arooj Jahanzaib',   userName: 'arooj',    phone: '03114468932', address: '', password: 'pass123', active: true, pic: '' },
  { id: 5,  fullName: 'Dua Fatima',        userName: 'dua',      phone: '03190514512', address: '', password: 'pass123', active: true, pic: '' },
  { id: 6,  fullName: 'Batool Fatima',     userName: 'batool',   phone: '03330343743', address: '', password: 'pass123', active: true, pic: '' },
  { id: 7,  fullName: 'Pakiza Sajid',      userName: 'pakiza',   phone: '03700036867', address: '3rd Floor, Plaza 1, Paradise Commercial, Bahria Town Phase 04.', password: 'pass123', active: true, pic: '' },
  { id: 8,  fullName: 'Mehwish Zulfiqar',  userName: 'mehwish',  phone: '03700036867', address: '3rd Floor, Plaza 1, Paradise Commercial, Bahria Town Phase 04.', password: 'pass123', active: true, pic: '' },
  { id: 9,  fullName: 'Muhammad Abubakar', userName: 'abubakar', phone: '03211597365', address: 'House No 812, Sheikhan Wala Mohallah, Chunian, District kasur', password: 'pass123', active: true, pic: '' },
  { id: 10, fullName: 'Amina Naseem',      userName: 'amina',    phone: '03155861110', address: 'Block B', password: 'pass123', active: true, pic: '' },
  { id: 11, fullName: 'Nimra Fatima',      userName: 'nimra',    phone: '03001234567', address: 'Rawalpindi', password: 'pass123', active: true, pic: '' },
  { id: 12, fullName: 'Neha Bukhari',      userName: 'neha',     phone: '03009876543', address: 'Lahore', password: 'pass123', active: true, pic: '' },
];

/* Seeded per-user menu permissions (userId → [granted menu]). A menu that
   is NOT in a user's list is "inactive" for them, and the Dashboard hides
   every section that depends on it. Super Admin (no user selected) sees all.
   Edit these live in User Management ▸ User Permission. */
export const INITIAL_PERMS = {
  1:  [...UM_MENUS],                                        // Romana   — full access
  2:  [...UM_MENUS],                                        // Hamza    — full access
  3:  UM_MENUS.filter((m) => m !== 'School Payments'),      // Abdullah — no payments
  4:  ['Dashboard', 'School Progress', 'Uploader', 'Category'], // Arooj — schools + videos, no fee
  5:  ['Dashboard', 'School Payments'],                     // Dua      — fee analytics only
  6:  ['Dashboard', 'School Progress'],                     // Batool   — school sections only
  7:  UM_MENUS.filter((m) => m !== 'Dashboard'),            // Pakiza   — no Dashboard access at all
  8:  [...UM_MENUS],                                        // Mehwish  — full access
  9:  ['Dashboard', 'Uploader', 'Category'],                // Abubakar — video details only
  10: [...UM_MENUS],                                        // Amina    — full access
  11: [...UM_MENUS],                                        // Nimra    — full access
  12: ['Dashboard', 'School Progress', 'School Payments'],  // Neha     — schools + fee, no video
};

/* Which menu permission gates each Dashboard domain. */
export const DASHBOARD_GATES = {
  pay:      ['School Payments'],          // Fee Analytics + Current Month Details
  progress: ['School Progress'],          // School Overview, Students/Staff, Bugs, Improvements, details
  video:    ['Uploader', 'Category'],     // Video Details
};

export const userInitials = (name) => (name || '').slice(0, 2).toUpperCase() || 'SM';

/* Build the page-window of numbered pagination buttons (1 … n with ellipses). */
export function pageButtons(current, totalPages) {
  const out = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - current) <= 1) out.push(p);
    else if (Math.abs(p - current) === 2) out.push('…');
  }
  return out;
}
