/* ═══════════════════════════════════════════════════════════════════
   PAYMENTS — school rows + billing helpers.

   Schools Chain-Management API se aate hain (network-schools/manage →
   accepted rows) — ViewProvider ke zariye, bilkul School Permissions /
   School Progress ki tarah. Yahan sirf unhe is screen ki shape me dhalte
   hain.

   Setup, Challans aur Receiving teenon ab Super-Admin API par hain (dekhein
   api/schoolPaymentsApi.js) — is screen par localStorage ka koi store nahi
   bacha.
   ═══════════════════════════════════════════════════════════════════ */

/* ViewContext ka connected-school row → is screen ki row.
   (ViewProvider `id` par branchID rakhta hai, `rowId` par network-school id.) */
export function toPaymentRow(s) {
  const name = s.name || `Branch #${s.id}`
  return {
    id: s.id,                                   // branchID — payment setup isi se store hota hai
    rowId: s.rowId,
    name,
    schoolCode: s.code || String(s.id ?? ''),
    principal: s.principal || s.email || '',    // API abhi principal nahi deti — email fallback
    contact: s.phone || '',
    address: s.address || '',
    initials: name.slice(0, 2).toUpperCase(),
    students: Number(s.students) || 0,
    isActive: s.isActive !== false,
    branchIsActive: s.branchIsActive !== false,
  }
}

export function toPaymentRows(schools) {
  return (schools || []).map(toPaymentRow)
}

export function monthlyCharge(school, setup) {
  if (!setup) return 0
  if (setup.formula === 'lumpsum') return parseFloat(setup.lumpAmount || 0)
  if (setup.formula === 'perstudent') {
    const rate = parseFloat(setup.perStudentRate || 0)
    const count = parseInt(setup.studentCount || school?.students || 0, 10)
    return rate * count
  }
  /* 'percentage' (royalty): har chune hue fee head par uski royalty banti
     hai (headAmount × pct / 100 — backend ise `calculatedHeadAmount` par
     save karta hai). Mahana raqam un sab ka jama hai.

     Pehle yahan 0 return hota tha "collection-based hai" keh kar — us se
     Monthly Amount aur challan dono PKR 0 bante the, jabke setup me raqam
     mehfooz thi. */
  return (setup.royaltyRows || [])
    .filter((r) => Number(r.pct) > 0)
    .reduce((sum, r) => sum + (Number(r.amount) || Math.round(((Number(r.headAmount) || 0) * (Number(r.pct) || 0)) / 100)), 0)
}

/* Kitne class/fee-head jodon par royalty % lagi hai.
   (Setup me sirf wohi rows aati hain jin par % > 0 hai — dekhein
   schoolPaymentsApi.js ka royaltyDetails — magar modal se seedha aane wale
   setup me 0 bhi ho sakta hai, is liye filter yahan bhi lagta hai.) */
export function royaltyCount(setup) {
  return (setup?.royaltyRows || []).filter((r) => Number(r.pct) > 0).length
}

/* ── Free trial kab tak hai / kab khatam hua ──────────────────────────
   API par trial ki apni koi tareekh nahi — sirf `duration` (kitne din) hai.
   Is liye ginti setup banne ke din se hoti hai (summary ka `createdAt`):
   trial usi din shuru hota hai jab setup pehli baar save hua.

   `createdAt` na ho (abhi abhi modal se save hua setup, jo API se dobara
   padha nahi gaya) to sirf muddat maloom hoti hai — us soorat me daysLeft
   null rehta hai aur screen purani tarah "Nd trial" dikhati hai.

   Wahi hisaab Super-Admin ke School Payment par bhi hai, taake dono screenein
   ek hi din ko trial ka aakhri din kahein. */
export function trialInfo(setup) {
  if (!setup || !setup.freeTrial) return null
  const days = parseInt(setup.trialDays, 10) || 0
  if (days <= 0) return null

  const start = dayStart(setup.createdAt)
  if (!start) return { days, startISO: '', endISO: '', endLabel: '', daysLeft: null, ended: false }

  const end = new Date(start.getTime())
  end.setDate(end.getDate() + days)
  const today = dayStart(new Date())
  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000)
  const endISO = isoDay(end)
  return {
    days,
    startISO: isoDay(start),
    endISO,
    endLabel: fmtDateShort(endISO),
    daysLeft,
    /* Aakhri din guzar gaya = trial khatam. */
    ended: daysLeft <= 0,
    /* Khatam hue kitne din ho gaye (card par "X days ago"). */
    daysAgo: daysLeft <= 0 ? Math.abs(daysLeft) : 0,
  }
}

/* "2026-08-19T14:03:11" ya Date → usi din ki aadhi raat (local). Sirf date
   ka hissa padha jata hai, is liye timestamp ka format/timezone maayne nahi
   rakhta. */
function dayStart(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? null
    : new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const isoDay = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

export const fmtDateShort = (iso) =>
  (iso ? new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '')

export const PKR = (n) => `PKR ${Number(n || 0).toLocaleString()}`
export const todayPlus = (days) => {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
export const PAY_METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'JazzCash / Easypaisa', 'Online']

/* ── Challan ka mahina ──
   Ledger table me month/year ka apna koi khana nahi hai (receiving me hai),
   is liye challan ka mahina do jagah rehta hai: `challanType` par
   "monthly-YYYY-MM" ki soorat me, aur issue/due dates usi mahine ke andar.
   Screen har jagah yahi label dikhati hai. */
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const pad2 = (n) => String(n).padStart(2, '0')

export const monthLabel = (m, y) => (m ? `${MONTHS[Number(m) - 1] || ''} ${y || ''}`.trim() : '')

/* Chune hue mahine ka pehla / aakhri din — date inputs ki hadd bhi yahi hai,
   taake challan ki tareekh kisi aur mahine me na chali jaye. */
export const monthStart = (m, y) => `${y}-${pad2(m)}-01`
export const monthEnd = (m, y) => `${y}-${pad2(m)}-${pad2(new Date(Number(y), Number(m), 0).getDate())}`

/* Mahine ke andar rehte hue nth din — mahina chhota ho to aakhri din par ruk
   jaata hai (February me 30 tareekh nahi hoti). */
export const monthDay = (m, y, day) => {
  const last = new Date(Number(y), Number(m), 0).getDate()
  return `${y}-${pad2(m)}-${pad2(Math.min(Math.max(1, day), last))}`
}

/* Year dropdown — pichla saal, mojooda, aur agle do. Guzre mahine ka challan
   banana aam hai, is liye pichla saal bhi list me rehta hai. */
export function challanYears(now = new Date()) {
  const y = now.getFullYear()
  return [y - 1, y, y + 1, y + 2]
}
