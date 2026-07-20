/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS — head office announcements sent to chain schools,
   targeted by audience (Principals / Teachers / Parents / All).
   localStorage-backed demo store.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_notifications'

export const AUDIENCES = [
  { key: 'all', label: 'All', icon: 'fa-users', short: 'Everyone' },
  { key: 'principals', label: 'Principals', icon: 'fa-user-tie', short: 'Principals' },
  { key: 'teachers', label: 'Teachers', icon: 'fa-chalkboard-user', short: 'Teachers' },
  { key: 'parents', label: 'Parents', icon: 'fa-house-user', short: 'Parents' },
]
export const AUD_LABEL = Object.fromEntries(AUDIENCES.map((a) => [a.key, a.label]))
export const AUD_ICON = Object.fromEntries(AUDIENCES.map((a) => [a.key, a.icon]))

export const PRIORITIES = ['normal', 'important', 'urgent']
export const PRIORITY_LABEL = { normal: 'Normal', important: 'Important', urgent: 'Urgent' }
export const STATUSES = ['draft', 'scheduled', 'sent']
export const STATUS_LABEL = { draft: 'Draft', scheduled: 'Scheduled', sent: 'Sent' }

const SEED = [
  { id: 1, title: 'New Academic Calendar 2026–27 Published', message: 'The updated academic calendar with term dates, exam schedules and holidays is now available. Principals please review and circulate to your teams.', audience: 'principals', priority: 'important', status: 'sent', date: '2026-06-18', time: '09:30', link: '', createdAt: '2026-06-18' },
  { id: 2, title: 'Parent–Teacher Meeting Guidelines', message: 'Please follow the updated PTM guidelines for the upcoming session. Slots, formats and feedback forms have been revised.', audience: 'teachers', priority: 'normal', status: 'sent', date: '2026-06-15', time: '11:00', link: '', createdAt: '2026-06-15' },
  { id: 3, title: 'Fee Submission Reminder — June', message: 'A gentle reminder that monthly fee submission closes on the 30th. Parents may pay via the school app or bank challan.', audience: 'parents', priority: 'normal', status: 'sent', date: '2026-06-12', time: '08:00', link: '', createdAt: '2026-06-12' },
  { id: 4, title: 'Annual Sports Gala — Save the Date', message: 'Our chain-wide Annual Sports Gala is scheduled for next month. Detailed schedules and participation forms will follow shortly.', audience: 'all', priority: 'important', status: 'scheduled', date: '2026-07-05', time: '10:00', link: '', createdAt: '2026-06-20' },
  { id: 5, title: 'Emergency Drill Protocol Update', message: 'Updated fire and earthquake drill protocols are effective immediately. Principals must ensure all staff are briefed this week.', audience: 'principals', priority: 'urgent', status: 'draft', date: '', time: '', link: '', createdAt: '2026-06-22' },
]

export function loadNotifications() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(d)) return d } catch { /* reseed */ }
  localStorage.setItem(KEY, JSON.stringify(SEED))
  return JSON.parse(JSON.stringify(SEED))
}
export const saveNotifications = (d) => localStorage.setItem(KEY, JSON.stringify(d))

export function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d }
}
