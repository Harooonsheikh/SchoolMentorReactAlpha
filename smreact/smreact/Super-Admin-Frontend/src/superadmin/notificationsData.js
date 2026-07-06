/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS — demo data + helpers (frontend only)

   Ported from "e tube, chat and Notification .html" and adapted so the
   audience has the four targets requested: All, Principal, Teachers,
   Parents. Sends targeted mobile-app push notifications. Mock data only —
   the integrating developer wires this to a real push backend.
   ═══════════════════════════════════════════════════════════════════ */

/* Top-level audience targets. */
export const AUDIENCES = [
  { id: 'all',       label: 'All',       icon: 'fa-bullhorn' },
  { id: 'principal', label: 'Principal', icon: 'fa-user-tie' },
  { id: 'teachers',  label: 'Teachers',  icon: 'fa-chalkboard-user' },
  { id: 'parents',   label: 'Parents',   icon: 'fa-users' },
];

/* Per-audience sub-groups (All + Principal have none). */
export const SUB_AUDIENCES = {
  teachers: [
    { id: 'all-teachers',     label: 'All Teachers' },
    { id: 'specific-teacher', label: 'Specific Member' },
  ],
  parents: [
    { id: 'all-parents',     label: 'All Parents' },
    { id: 'class-wise',      label: 'Class Wise' },
    { id: 'class-section',   label: 'Class + Section' },
    { id: 'specific-parent', label: 'Specific Parent' },
  ],
};

export const SUB_LABEL = {
  'all-teachers': 'All Teachers', 'specific-teacher': 'Specific Member',
  'all-parents': 'All Parents', 'class-wise': 'Class Wise', 'class-section': 'Class + Section', 'specific-parent': 'Specific Parent',
};

export const AUDIENCE_LABEL = { all: 'All', principal: 'Principal', teachers: 'Teachers', parents: 'Parents' };

/* Estimated recipient counts (by sub-audience, or by audience when no sub). */
export const RECIPIENT_COUNTS = {
  all: 432, principal: 1,
  'all-teachers': 28, 'specific-teacher': 1,
  'all-parents': 380, 'class-wise': 32, 'class-section': 16, 'specific-parent': 1,
};

export const NOTIF_TYPES = [
  { id: 'general',   label: 'General',   icon: 'fa-bell' },
  { id: 'important', label: 'Important', icon: 'fa-circle-exclamation' },
  { id: 'reminder',  label: 'Reminder',  icon: 'fa-clock' },
  { id: 'emergency', label: 'Emergency', icon: 'fa-triangle-exclamation' },
];

export const CLASSES = ['Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
export const SECTIONS = ['A', 'B', 'C', 'D'];

export const INITIAL_NOTIFS = [
  { id: 1001, title: 'PTM Reminder — This Friday', body: 'Parent-Teacher Meeting is scheduled for Friday, 27 June 2026 at 9:00 AM. All parents are requested to attend.', audience: 'Parents — All Parents', audienceType: 'parents', subAud: 'all-parents', cls: '', section: '', type: 'reminder', date: '22 Jun 2026', time: '10:00 am', recipients: 380, sentBy: 'Principal' },
  { id: 1002, title: 'School Closed Tomorrow', body: 'Due to heavy rainfall, school will remain closed on Monday, 23 June 2026. Classes will resume on Tuesday.', audience: 'All — Everyone', audienceType: 'all', subAud: '', cls: '', section: '', type: 'important', date: '22 Jun 2026', time: '06:30 pm', recipients: 432, sentBy: 'Admin' },
  { id: 1003, title: 'Staff Meeting — Monday 8 AM', body: 'All teaching staff are required to attend the monthly staff meeting on Monday at 8:00 AM in the conference room.', audience: 'Teachers — All Teachers', audienceType: 'teachers', subAud: 'all-teachers', cls: '', section: '', type: 'general', date: '21 Jun 2026', time: '04:15 pm', recipients: 28, sentBy: 'Principal' },
  { id: 1004, title: 'Fee Submission Last Date', body: 'Last date for June fee submission is 25 June 2026. After this date, a late fine will be charged. Please submit fee on time.', audience: 'Parents — Class Wise · Class 5', audienceType: 'parents', subAud: 'class-wise', cls: 'Class 5', section: '', type: 'reminder', date: '20 Jun 2026', time: '11:00 am', recipients: 32, sentBy: 'Admin' },
  { id: 1005, title: 'EMERGENCY: Gas Leak — Early Dismissal', body: 'Due to a gas supply issue, all students will be dismissed at 12:00 PM today. Parents please arrange pick-up urgently.', audience: 'Parents — All Parents', audienceType: 'parents', subAud: 'all-parents', cls: '', section: '', type: 'emergency', date: '19 Jun 2026', time: '09:45 am', recipients: 380, sentBy: 'Principal' },
  { id: 1006, title: 'New Syllabus Uploaded', body: 'Updated syllabus for Term 2 has been uploaded to the school app. All teachers are requested to review and plan lessons accordingly.', audience: 'Teachers — All Teachers', audienceType: 'teachers', subAud: 'all-teachers', cls: '', section: '', type: 'general', date: '18 Jun 2026', time: '03:00 pm', recipients: 28, sentBy: 'Principal' },
  { id: 1007, title: 'Annual Sports Day — Registration Open', body: 'Annual Sports Day registrations are now open. Parents please register your children via the School Mentor app by 26 June.', audience: 'Parents — All Parents', audienceType: 'parents', subAud: 'all-parents', cls: '', section: '', type: 'general', date: '17 Jun 2026', time: '01:30 pm', recipients: 380, sentBy: 'Admin' },
  { id: 1008, title: 'Monthly Review Meeting', body: 'A monthly performance review meeting has been scheduled. The Principal is requested to confirm availability via the app.', audience: 'Principal', audienceType: 'principal', subAud: '', cls: '', section: '', type: 'general', date: '16 Jun 2026', time: '05:00 pm', recipients: 1, sentBy: 'Admin' },
];

/* The default sub-audience for an audience (or '' when it has none). */
export const defaultSub = (aud) => (SUB_AUDIENCES[aud] ? SUB_AUDIENCES[aud][0].id : '');

/* Recipient estimate for the current audience/sub selection. */
export function estimateRecipients(aud, sub) {
  if (sub && RECIPIENT_COUNTS[sub] != null) return RECIPIENT_COUNTS[sub];
  return RECIPIENT_COUNTS[aud] != null ? RECIPIENT_COUNTS[aud] : 20;
}

/* Human-readable audience label for a selection. */
export function buildAudienceLabel(aud, sub, cls, section) {
  if (aud === 'all') return 'All — Everyone';
  if (aud === 'principal') return 'Principal';
  let lbl = `${AUDIENCE_LABEL[aud]} — ${SUB_LABEL[sub] || sub}`;
  if (sub === 'class-wise' || sub === 'class-section') {
    if (cls) lbl += ` · ${cls}`;
    if (sub === 'class-section' && section) lbl += ` ${section}`;
  }
  return lbl;
}

export function nowDateTime() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = now.getHours(); const m = now.getMinutes();
  return {
    date: `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
    time: `${h % 12 || 12}:${m < 10 ? '0' : ''}${m} ${h >= 12 ? 'pm' : 'am'}`,
  };
}
