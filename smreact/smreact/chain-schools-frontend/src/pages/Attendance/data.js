/* ═══════════════════════════════════════════════════════════════════
   ATTENDANCE — holidays setup + STAFF attendance + staff reports.
   Student attendance & its reports are intentionally omitted (the head
   office only needs staff attendance). Staff are sourced from HR.
   localStorage-backed demo store.
   ═══════════════════════════════════════════════════════════════════ */
import { loadHr, fullName, desigName, deptName } from '../HumanResource/data'

const KEY = 'csp_attendance'

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const STATUSES = [
  { key: 'present', label: 'Present', color: '#16A34A' },
  { key: 'absent', label: 'Absent', color: '#DC2626' },
  { key: 'leave', label: 'Leave', color: '#D97706' },
]
export const STATUS_COLOR = Object.fromEntries(STATUSES.map((s) => [s.key, s.color]))

const SEED = {
  weeklyOff: [5, 6], // Sat, Sun  (Mon=0 … Sun=6)
  nextHolId: 5,
  holidays: [
    { id: 1, title: 'Defence Day', desc: 'Pakistan Defence Day', from: '2026-09-06', to: '2026-09-06' },
    { id: 2, title: 'Iqbal Day', desc: "Allama Iqbal's birthday", from: '2026-11-09', to: '2026-11-09' },
    { id: 3, title: 'Quaid-e-Azam Day', desc: "Quaid-e-Azam's birthday", from: '2026-12-25', to: '2026-12-26' },
    { id: 4, title: 'Eid ul Fitr', desc: 'Eid holiday', from: '2026-03-30', to: '2026-04-03' },
  ],
  records: {}, // `${empId}|${YYYY-MM-DD}` -> { status, inTime, outTime, markedBy, markedTime }
}

export function loadAtt() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.holidays) return d } catch { /* reseed */ }
  localStorage.setItem(KEY, JSON.stringify(SEED))
  return JSON.parse(JSON.stringify(SEED))
}
export const saveAtt = (d) => localStorage.setItem(KEY, JSON.stringify(d))

/* Staff list comes from the HR module's active employees. */
export function getStaff() {
  const hr = loadHr()
  return hr.emps.filter((e) => e.status === 'Active').map((e) => ({ empId: e.eid, id: e.id, name: fullName(e), desig: desigName(hr, e.desId), dept: deptName(hr, e.dId) }))
}

/* ── date helpers ── */
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const dowMon = (d) => (d.getDay() + 6) % 7 // Mon=0 … Sun=6
export function fmtDate(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return iso } }
export function monthDates(year, month0) { const last = new Date(year, month0 + 1, 0).getDate(); return Array.from({ length: last }, (_, i) => new Date(year, month0, i + 1)) }
export const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function holidayOn(att, iso) {
  return att.holidays.find((h) => iso >= h.from && iso <= h.to)
}
export function dayType(att, d) {
  const iso = isoOf(d)
  if (att.weeklyOff.includes(dowMon(d))) return { type: 'off', label: 'Weekly Off', color: '#94A3B8' }
  const h = holidayOn(att, iso)
  if (h) return { type: 'holiday', label: h.title, color: '#3B82F6' }
  return { type: 'working', label: 'Working Day', color: '#16A34A' }
}
export const recKey = (empId, iso) => `${empId}|${iso}`

/* Time format 24h → 12h. */
export function fmtTime(t) { if (!t || !t.includes(':')) return t || '—'; const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return `${h12}:${String(m).padStart(2, '0')} ${ap}` }
