/* ═══════════════════════════════════════════════════════════════════
   TEACHER TRAININGS — demo data + helpers (frontend only)

   Ported from "Teacher_Trainings_SuperAdmin (1).html". Two collections:
   recorded trainings (video sessions) and upcoming trainings (scheduled
   live sessions). Mock data only — the integrating developer swaps these
   for API calls + real video hosting.
   ═══════════════════════════════════════════════════════════════════ */

export const TT_CATEGORIES = [
  { id: 'academics',      label: 'Academics',          full: 'Academics Trainings',      icon: 'fa-book-open' },
  { id: 'administrative', label: 'Administrative',     full: 'Administrative Trainings', icon: 'fa-building' },
  { id: 'parenting',      label: 'Parenting',          full: 'Parenting',                icon: 'fa-house-chimney-window' },
  { id: 'character',      label: 'Character Building', full: 'Character Building',       icon: 'fa-heart' },
  { id: 'others',         label: 'Others',             full: 'Others',                   icon: 'fa-folder-open' },
];

export const TT_CAT_LABEL = Object.fromEntries(TT_CATEGORIES.map((c) => [c.id, c.label]));
export const TT_CAT_FULL = Object.fromEntries(TT_CATEGORIES.map((c) => [c.id, c.full]));

export const REC_STATUS = [
  { id: 'published', label: 'Published' },
  { id: 'draft',     label: 'Draft' },
  { id: 'hidden',    label: 'Hidden' },
];
export const UP_STATUS = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'hidden',    label: 'Hidden' },
];

export const STATUS_LABEL = {
  published: 'Published', draft: 'Draft', hidden: 'Hidden',
  scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled',
};

export const INITIAL_RECORDED = [
  { id: 1, cat: 'academics', title: 'Effective Lesson Planning & Instructional Design', trainer: 'Dr. Sarah Ahmed', bio: 'Senior Academic Consultant with 18 years of experience in curriculum development and teacher training across Pakistan and the UK.', desc: 'This session covers the fundamentals of designing lessons that align with learning outcomes, student engagement techniques, and practical lesson plan templates used in top schools.', date: '2026-05-10', duration: '52 min', video: '', thumb: '', status: 'published' },
  { id: 2, cat: 'academics', title: 'Classroom Management Strategies for Every Teacher', trainer: 'Usman Khalid', bio: 'Lead Trainer, School Mentor', desc: 'Practical classroom management techniques to improve teacher effectiveness and student discipline.', date: '2026-04-12', duration: '48 min', video: '', thumb: '', status: 'published' },
  { id: 3, cat: 'administrative', title: 'Fee Management & Challan Generation', trainer: 'Dua Rizvi', bio: 'Senior ERP Trainer · School Mentor Customer Success Team · 3 years experience', desc: 'Complete walkthrough of the fee module including challan generation, discounts, and payment tracking.', date: '2026-03-15', duration: '60 min', video: '', thumb: '', status: 'published' },
  { id: 4, cat: 'character', title: 'Building Character Through Classroom Routines', trainer: 'Hina Fatima', bio: 'Character Education Specialist', desc: 'How to embed character-building habits into daily classroom activities.', date: '2026-02-20', duration: '45 min', video: '', thumb: '', status: 'draft' },
];

export const INITIAL_UPCOMING = [
  { id: 1, cat: 'academics', title: 'Assessment & Result Analysis Workshop', trainer: 'Dr. Sarah Ahmed', bio: 'Senior Academic Consultant', desc: 'Deep dive into result analysis tools and assessment best practices for school leaders.', date: '2026-07-15', time: '10:00', duration: '90 min', link: 'https://meet.google.com/abc-def-ghi', status: 'scheduled' },
  { id: 2, cat: 'administrative', title: 'ERP Advanced Features — HR & Payroll', trainer: 'Dua Rizvi', bio: 'Senior ERP Trainer · School Mentor', desc: 'Training on HR module, payroll generation, leave management, and staff attendance.', date: '2026-08-05', time: '11:00', duration: '75 min', link: 'https://meet.google.com/xyz-uvw-rst', status: 'scheduled' },
];

export const initials = (name) => (name || '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'SM';

export const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

/* Normalise a YouTube URL to an embeddable form. */
export function embedUrl(url) {
  if (!url) return '';
  if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/');
  if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1]}`;
  return url;
}

export const currentYearMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
