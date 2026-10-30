/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS & REMINDERS — billing-specific templates, schedules,
   and delivery log (frontend only, mock data).

   Deliberately separate from the existing src/superadmin/Notifications.jsx
   (that module is a mobile-app PUSH composer to parents/teachers/
   principals — ad-hoc, no templates, no scheduling; confirmed via
   audit before building this). This is a different recipient
   (school owners/admins), different purpose (billing reminders +
   global ERP announcements), and needs templating + scheduling that
   module has no concept of — built as its own data model rather than
   bolted onto an unrelated one.

   Two channel types:
   - 'erp_banner'  — the global in-ERP announcement banner (new,
                      School-Mentor-Front-end's BillingAnnouncementBanner).
   - 'inbox'        — the ERP's EXISTING AnnouncementsModal inbox (reused,
                      not duplicated — see School-Mentor-Front-end audit).
   An email channel was deliberately NOT offered here (no real email
   service exists anywhere in either repo, and the option was removed
   from the UI at the product owner's request rather than left visible
   as a non-functional "Not Configured" choice).
   ═══════════════════════════════════════════════════════════════════ */

export const CHANNELS = [
  { id: 'erp_banner', label: 'Global ERP Announcement Banner', configured: true },
  { id: 'inbox', label: 'Notification Inbox (existing)', configured: true },
];

export const PLACEHOLDERS = ['{SchoolName}', '{InvoiceNumber}', '{Amount}', '{DueDate}', '{GracePeriodEnd}', '{RestrictionDate}', '{BillingURL}'];

/** Safe placeholder substitution — escapes nothing further since every
   value here is already server-trusted plain text (school name, a
   formatted amount/date string, invoice number); never evaluates the
   template as HTML. Unknown placeholders are left as-is so a typo is
   visible rather than silently dropped. */
export function renderTemplate(template, values) {
  return (template || '').replace(/\{(\w+)\}/g, (m, key) => (key in values ? String(values[key]) : m));
}

export const DEFAULT_BEFORE_DUE_TEMPLATE =
  'Dear {SchoolName}, this is a friendly reminder that Invoice {InvoiceNumber} for {Amount} is due on {DueDate}. Please complete your payment on time to ensure uninterrupted School Mentor services. View your invoice: {BillingURL}';

export const DEFAULT_OVERDUE_TEMPLATE =
  'Dear {SchoolName}, our records indicate that Invoice {InvoiceNumber} for {Amount} remains outstanding. To avoid any interruption to your School Mentor services after {RestrictionDate}, please complete your payment by {GracePeriodEnd}. If you have already paid, please allow time for verification or contact support. View invoice: {BillingURL}';

export const FREQUENCY_OPTIONS = [
  { id: 'once_daily', label: 'Once Daily' },
  { id: 'every_2_days', label: 'Once Every Two Days' },
  { id: 'twice_daily', label: 'Twice Daily' },
];

export const INITIAL_NOTIFICATION_SETTINGS = {
  timezone: 'Asia/Karachi',
  maxChars: 500,
  beforeDue: {
    enabled: true, template: DEFAULT_BEFORE_DUE_TEMPLATE, frequency: 'once_daily', times: ['09:00'],
    daysBefore: 3, channels: ['erp_banner', 'inbox'],
  },
  overdueWarning: {
    enabled: true, template: DEFAULT_OVERDUE_TEMPLATE, frequency: 'once_daily', times: ['09:00'],
    channels: ['erp_banner', 'inbox'],
  },
  announcement: {
    enabled: true, frequency: 'once_daily', times: ['09:00'], channels: ['erp_banner'],
  },
};

/* ═══ API ↔ UI (Billing Reminder settings — Hangfire backend) ═══
   GET  /get-billing-reminder-settings  → { beforeDue, overdue, general }
   PUT  /save-billing-reminder-settings ← same shape (+ optional updatedBy)
   UI ka apna model (upar INITIAL_NOTIFICATION_SETTINGS) waisa hi rehta hai;
   sirf yahan dono taraf badla jata hai. Casing pakki nahi (camel ya Pascal),
   is liye parhte waqt dono maane jate hain. */
const FREQ_TO_API = { once_daily: 'OnceDaily', every_2_days: 'OnceEveryTwoDays', twice_daily: 'TwiceDaily' };
const FREQ_FROM_API = { oncedaily: 'once_daily', onceeverytwodays: 'every_2_days', twicedaily: 'twice_daily' };

/* camelCase ya PascalCase — jo bhi aaye. */
const pick = (o, key) => {
  if (!o || typeof o !== 'object') return undefined;
  if (o[key] !== undefined) return o[key];
  const pascal = key[0].toUpperCase() + key.slice(1);
  return o[pascal];
};
/* "09:00:00" → "09:00" (input type=time) */
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
/* "09:00" → "09:00:00" */
const hhmmss = (t) => (t ? (String(t).length === 5 ? `${t}:00` : String(t)) : null);

function reminderFromApi(r, base) {
  if (!r || typeof r !== 'object') return { ...base };
  const freq = FREQ_FROM_API[String(pick(r, 'frequency') || '').toLowerCase()] || base.frequency;
  const t1 = hhmm(pick(r, 'sendTime')) || base.times[0] || '09:00';
  const t2 = hhmm(pick(r, 'sendTime2'));
  const channels = [];
  if (pick(r, 'deliveryChannel_ERPBanner')) channels.push('erp_banner');
  if (pick(r, 'deliveryChannel_Inbox')) channels.push('inbox');
  const out = {
    ...base,
    id: pick(r, 'id') ?? base.id ?? null,
    enabled: !!pick(r, 'isEnabled'),
    template: pick(r, 'messageTemplate') ?? base.template,
    frequency: freq,
    times: freq === 'twice_daily' ? [t1, t2 || '17:00'] : [t1],
    channels,
    updatedOn: pick(r, 'updatedOn') || null,
  };
  if ('daysBefore' in base) out.daysBefore = Number(pick(r, 'daysBeforeDueDate')) || base.daysBefore;
  return out;
}

/** API response → UI settings (missing parts fall back to `base`). */
export function notifSettingsFromApi(api, base = INITIAL_NOTIFICATION_SETTINGS) {
  if (!api || typeof api !== 'object') return { ...base };
  const g = pick(api, 'general') || {};
  return {
    ...base,
    generalId: pick(g, 'id') ?? null,
    maxChars: Number(pick(g, 'maxCharacterCount')) || base.maxChars,
    timezone: pick(g, 'applicationTimezone') || base.timezone,
    beforeDue: reminderFromApi(pick(api, 'beforeDue'), base.beforeDue),
    overdueWarning: reminderFromApi(pick(api, 'overdue'), base.overdueWarning),
  };
}

function reminderToApi(v, type) {
  const twice = v.frequency === 'twice_daily';
  return {
    ...(v.id != null ? { id: v.id } : {}),
    reminderType: type,
    isEnabled: !!v.enabled,
    messageTemplate: v.template || '',
    frequency: FREQ_TO_API[v.frequency] || 'OnceDaily',
    sendTime: hhmmss(v.times[0] || '09:00'),
    /* Sirf TwiceDaily par — warna null (guide). */
    sendTime2: twice ? hhmmss(v.times[1]) : null,
    /* Sirf before-due par number; overdue par null. */
    daysBeforeDueDate: type === 'BeforeDue' ? Number(v.daysBefore) || 1 : null,
    deliveryChannel_ERPBanner: v.channels.includes('erp_banner'),
    deliveryChannel_Inbox: v.channels.includes('inbox'),
  };
}

/** UI settings → PUT body. */
export function notifSettingsToApi(f, updatedBy = '') {
  return {
    beforeDue: reminderToApi(f.beforeDue, 'BeforeDue'),
    overdue: reminderToApi(f.overdueWarning, 'Overdue'),
    general: {
      ...(f.generalId != null ? { id: f.generalId } : {}),
      maxCharacterCount: Number(f.maxChars) || 300,
      applicationTimezone: f.timezone || 'Asia/Karachi',
    },
    /* Optional — na bhejo to server login token ka naam leta hai. */
    ...(updatedBy ? { updatedBy: String(updatedBy) } : {}),
  };
}

/** Save se pehle (guide §3B). Pehli ghalti ka paighaam, ya null. */
export function validateNotifSettings(f) {
  const max = Number(f.maxChars) || 0;
  if (!(max >= 1 && max <= 2000)) return 'Maximum character count must be between 1 and 2000.';
  const rules = [['Before-Due Reminder', f.beforeDue], ['Overdue Warning', f.overdueWarning]];
  for (const [name, v] of rules) {
    if (!v.times[0]) return `${name}: send time is required.`;
    if (v.enabled && !(v.template || '').trim()) return `${name}: message template is required.`;
    if (v.frequency === 'twice_daily') {
      if (!v.times[1]) return `${name}: Twice Daily needs a second send time.`;
      if (v.times[1] <= v.times[0]) return `${name}: second send time must be later than the first.`;
    }
    if ((v.template || '').length > max) return `${name}: message is longer than ${max} characters.`;
    if (v.enabled && !v.channels.length) return `${name}: select at least one delivery channel.`;
  }
  if (!(Number(f.beforeDue.daysBefore) >= 1)) return 'Before-Due Reminder: "days before due date" must be 1 or more.';
  return null;
}

/* Delivery history → table labels (guide §3D). */
export const HISTORY_CHANNEL_LABEL = { NotificationInbox: 'Push and Bell', ERPBanner: 'ERP Banner' };
export const HISTORY_TYPE_LABEL = { Generated: 'Invoice generated', BeforeDue: 'Before due', Overdue: 'Overdue' };

/* ─── Global announcements (brief §8F) ─── */
export const INITIAL_ANNOUNCEMENTS = [];
/* shape: { id, title, message, type: 'info'|'due_reminder'|'grace_warning'|'restriction'|'success',
   audience: 'all'|'erp_schools'|'specific', schoolIds: [], startAt, endAt,
   displayFrequency: 'once_per_session'|'every_visit'|'persistent_until_resolved',
   maxChars, active } */

/* ─── Delivery log (brief §8G) ─── */
export const INITIAL_DELIVERY_LOG = [];
/* shape: { id, schoolId, schoolName, invoiceNumber, notifType: 'before_due'|'overdue_warning'|'announcement',
   scheduledAt, sentAt, channel, status: 'sent'|'failed'|'skipped', failureReason, attempt } */

let _annSeq = 1, _logSeq = 1;
export const nextAnnouncementId = () => `ann-${_annSeq++}`;
export const nextDeliveryLogId = () => `dlog-${_logSeq++}`;

/* Per-school/per-notification-type idempotency guard (brief §8D:
   "a school should not receive duplicate reminders merely because a
   scheduled job reruns"). Call before logging a new delivery. */
export function alreadySentToday(deliveryLog, schoolId, notifType, todayISO) {
  return (deliveryLog || []).some((d) => d.schoolId === schoolId && d.notifType === notifType && d.sentAt?.slice(0, 10) === todayISO && d.status === 'sent');
}
