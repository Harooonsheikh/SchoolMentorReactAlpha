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
