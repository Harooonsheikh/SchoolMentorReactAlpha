/* ═══════════════════════════════════════════════════════════════════
   TEACHER TRAININGS — recorded + upcoming training sessions.
   Ported from the Super Admin design; localStorage-backed demo store.
   ═══════════════════════════════════════════════════════════════════ */
const KEY_REC = 'csp_tt_recorded'
const KEY_UP = 'csp_tt_upcoming'

export const TT_CATS = [
  { key: 'academics', label: 'Academics', full: 'Academics Trainings', icon: 'fa-book-open' },
  { key: 'administrative', label: 'Administrative', full: 'Administrative Trainings', icon: 'fa-building' },
  { key: 'parenting', label: 'Parenting', full: 'Parenting', icon: 'fa-house-chimney-user' },
  { key: 'character', label: 'Character Building', full: 'Character Building', icon: 'fa-heart' },
  { key: 'others', label: 'Others', full: 'Others', icon: 'fa-folder-open' },
]
export const TT_CAT_LABEL = Object.fromEntries(TT_CATS.map((c) => [c.key, c.label]))
export const TT_CAT_FULL = Object.fromEntries(TT_CATS.map((c) => [c.key, c.full]))

export const REC_STATUS = ['published', 'draft', 'hidden']
export const UP_STATUS = ['scheduled', 'completed', 'cancelled', 'hidden']
export const TT_STATUS_LABEL = {
  published: 'Published', draft: 'Draft', hidden: 'Hidden',
  scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled',
}

const SEED_REC = [
  { id: 1, cat: 'academics', title: 'Effective Lesson Planning & Instructional Design', trainer: 'Dr. Sarah Ahmed', bio: 'Senior Academic Consultant with 18 years of experience in curriculum development and teacher training across Pakistan and the UK.', desc: 'This session covers the fundamentals of designing lessons that align with learning outcomes, student engagement techniques, and practical lesson plan templates used in top schools.', date: '2026-05-10', duration: '52 min', video: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumb: '', status: 'published' },
  { id: 2, cat: 'academics', title: 'Classroom Management Strategies for Every Teacher', trainer: 'Usman Khalid', bio: 'Lead Trainer, School Mentor', desc: 'Practical classroom management techniques to improve teacher effectiveness and student discipline.', date: '2026-04-12', duration: '48 min', video: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumb: '', status: 'published' },
  { id: 3, cat: 'administrative', title: 'Fee Management & Challan Generation', trainer: 'Dua Rizvi', bio: 'Senior ERP Trainer · School Mentor Customer Success Team · 3 years experience', desc: 'Complete walkthrough of the fee module including challan generation, discounts, and payment tracking.', date: '2026-03-15', duration: '60 min', video: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumb: '', status: 'published' },
  { id: 4, cat: 'character', title: 'Building Character Through Classroom Routines', trainer: 'Hina Fatima', bio: 'Character Education Specialist', desc: 'How to embed character-building habits into daily classroom activities.', date: '2026-02-20', duration: '45 min', video: '', thumb: '', status: 'draft' },
]
const SEED_UP = [
  { id: 1, cat: 'academics', title: 'Assessment & Result Analysis Workshop', trainer: 'Dr. Sarah Ahmed', bio: 'Senior Academic Consultant', desc: 'Deep dive into result analysis tools and assessment best practices for school leaders.', date: '2026-07-15', time: '10:00', duration: '90 min', link: 'https://meet.google.com/abc-def-ghi', status: 'scheduled' },
  { id: 2, cat: 'administrative', title: 'ERP Advanced Features — HR & Payroll', trainer: 'Dua Rizvi', bio: 'Senior ERP Trainer · School Mentor', desc: 'Training on HR module, payroll generation, leave management, and staff attendance.', date: '2026-08-05', time: '11:00', duration: '75 min', link: 'https://meet.google.com/xyz-uvw-rst', status: 'scheduled' },
]

const read = (key, seed) => {
  try { const d = JSON.parse(localStorage.getItem(key)); if (Array.isArray(d)) return d } catch { /* reseed */ }
  localStorage.setItem(key, JSON.stringify(seed))
  return JSON.parse(JSON.stringify(seed))
}
export const loadRecorded = () => read(KEY_REC, SEED_REC)
export const saveRecorded = (d) => localStorage.setItem(KEY_REC, JSON.stringify(d))
export const loadUpcoming = () => read(KEY_UP, SEED_UP)
export const saveUpcoming = (d) => localStorage.setItem(KEY_UP, JSON.stringify(d))

export const ttInitials = (name = '') => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
export function ttFmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d }
}
/* Normalise a YouTube URL to an embeddable form. */
export function toEmbed(url = '') {
  if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/')
  if (url.includes('youtu.be/')) return 'https://www.youtube.com/embed/' + url.split('youtu.be/')[1]
  return url
}
