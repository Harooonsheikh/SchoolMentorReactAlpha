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
  // 'percentage' (royalty) is collection-based → no fixed monthly figure.
  return 0
}

/* Kitne class/fee-head jodon par royalty % lagi hai.
   (Setup me sirf wohi rows aati hain jin par % > 0 hai — dekhein
   schoolPaymentsApi.js ka royaltyDetails — magar modal se seedha aane wale
   setup me 0 bhi ho sakta hai, is liye filter yahan bhi lagta hai.) */
export function royaltyCount(setup) {
  return (setup?.royaltyRows || []).filter((r) => Number(r.pct) > 0).length
}

export const PKR = (n) => `PKR ${Number(n || 0).toLocaleString()}`
export const todayPlus = (days) => {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
export const PAY_METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'JazzCash / Easypaisa', 'Online']
