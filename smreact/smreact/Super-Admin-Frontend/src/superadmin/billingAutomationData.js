/* ═══════════════════════════════════════════════════════════════════
   BILLING AUTOMATION — settings, manual overrides, access audit trail,
   and simulated scheduled-job history (frontend only, mock data).

   Extends the existing Schools Payment module (paymentData.js) rather
   than replacing anything there — challans/receiving/INVOICE_STATUS
   all stay exactly as they are. This file adds the layer the brief's
   own forward-looking contract note in paymentData.js (API CONTRACT,
   `getBillingRestriction()`) describes but never implemented: WHEN an
   unpaid invoice should restrict a school, and the automated billing
   cycle that drives invoice generation/delivery/reminders/restriction.

   HONEST SCOPE NOTE: there is no real backend, cron, payment gateway,
   or email/SMS service anywhere in this app (confirmed — see
   api/config.js's isMockMode()). "Automated billing" here means: a
   deterministic settings+state model that computes what WOULD happen
   (next run date, who's eligible, who gets restricted) exactly the
   way a real scheduler would, plus a "Run Billing Cycle Now" action
   that executes that same logic synchronously against the in-memory
   mock stores, so every screen (and the job-run history) behaves
   exactly as it will once a real backend executes this logic on a
   timer. Nothing here pretends a cron job is actually running in the
   background — see BillingAutomation.jsx's own UI copy for how this
   is communicated to the Super Admin user.

   RESTRICTION DECISION — the single authoritative function is
   computeSchoolRestriction() below. Both this app's own UI (to show
   "Restricted since…") and a documented contract for the ERP app's
   getBillingRestriction() stub call this same logic (or, once a real
   backend exists, a server-side port of it) — "one authoritative
   billing/access state service" per the brief's own instruction, not
   two independently-calculated opinions.
   ═══════════════════════════════════════════════════════════════════ */
import {
  PAY_SCHOOLS, totalPayableOf, isChallanOverdue, fmtDateLong, todayISO,
} from './paymentData';

/* ─── date helpers (additive — paymentData.js has no month-arithmetic
   helpers yet; these are new, not duplicates of anything there). ─── */
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysInMonth(year, month0) { return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate(); }
export function lastDayOfMonth(year, month0) { return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(daysInMonth(year, month0)).padStart(2, '0')}`; }

/* Resolve "billing day N of the given month" to a real calendar date,
   applying the configured fallback policy when the month is shorter
   than N (e.g. day 29 in a non-leap February). */
export function resolveBillingDateForMonth(year, month0, settings) {
  const dim = daysInMonth(year, month0);
  const day = Math.min(settings.billingDay, dim);
  if (day === settings.billingDay) return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // billingDay doesn't exist this month
  if (settings.fallbackPolicy === 'specific_date' && settings.fallbackDate) {
    const fd = Math.min(Number(settings.fallbackDate) || dim, dim);
    return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(fd).padStart(2, '0')}`;
  }
  return lastDayOfMonth(year, month0); // default: last calendar day
}

/* Next scheduled generation date strictly after `fromISO` (defaults to
   today) — walks forward month by month so it's correct right after a
   run too, not just "this month's date even if already past". */
export function computeNextRun(settings, fromISO = todayISO()) {
  if (!settings.enabled) return null;
  let [y, m] = fromISO.split('-').map(Number); m -= 1;
  for (let i = 0; i < 14; i++) {
    const candidate = resolveBillingDateForMonth(y, m, settings);
    if (candidate > fromISO) return candidate;
    m += 1; if (m > 11) { m = 0; y += 1; }
  }
  return null;
}

export function computeSendDate(issueDateISO, settings) {
  return settings.generateSendSameDay ? issueDateISO : addDays(issueDateISO, settings.sendOffsetDays || 0);
}
export function computeDueDate(issueDateISO, settings) {
  return addDays(issueDateISO, settings.dueDays || 0);
}
export function computeGraceEnd(dueDateISO, settings) {
  return addDays(dueDateISO, settings.graceDays || 0);
}
/* Restriction never fires on the grace-end day itself — only the day
   AFTER, at/after the configured cutoff time. Expressed as the first
   restrictable calendar date; the cutoff time is applied by the caller
   when comparing against "now" rather than baked into this date string. */
export function computeRestrictionDate(dueDateISO, settings) {
  return addDays(computeGraceEnd(dueDateISO, settings), 1);
}

/* Human-readable, computed-from-actual-settings summary — never a
   hardcoded example string (per the brief's own "calculate from actual
   saved settings" instruction). */
export function summarizeAutomation(settings) {
  if (!settings.enabled) return 'Automatic billing is currently disabled. No invoices will be generated, sent, or restricted automatically.';
  const fallback = settings.fallbackPolicy === 'specific_date' && settings.fallbackDate
    ? `the ${settings.fallbackDate}${ordinal(Number(settings.fallbackDate))} instead` : 'the last calendar day of that month';
  const sendPart = settings.generateSendSameDay
    ? 'sent the same day they are generated'
    : `sent ${settings.sendOffsetDays} day${settings.sendOffsetDays === 1 ? '' : 's'} after generation`;
  const restrictPart = settings.restrictionEnabled
    ? `Eligible unpaid accounts are restricted (${RESTRICTION_MODE_LABEL[settings.restrictionMode] || settings.restrictionMode}) after the configured cutoff.`
    : 'Access restriction is currently disabled — overdue accounts are flagged but never automatically restricted.';
  return `Automatic billing is enabled. Invoices are generated on the ${settings.billingDay}${ordinal(settings.billingDay)} of each month (or ${fallback} for shorter months), ${sendPart}, due ${settings.dueDays} day${settings.dueDays === 1 ? '' : 's'} after issue, followed by a ${settings.graceDays}-day grace period. ${restrictPart}`;
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export const RESTRICTION_MODE_LABEL = {
  billing_only: 'Billing-only restriction (school can only view/pay invoices)',
  read_only: 'Read-only ERP access',
  full: 'Full ERP access restriction',
};

/* ─── Default settings — disabled by default (brief 4A: enabling is an
   explicit opt-in), sensible values otherwise. ─── */
export const INITIAL_AUTOMATION_SETTINGS = {
  enabled: false,
  billingDay: 29,
  fallbackPolicy: 'last_day',      // 'last_day' | 'specific_date'
  fallbackDate: '',                // used only when fallbackPolicy === 'specific_date'
  generateSendSameDay: true,
  sendOffsetDays: 1,
  dueDays: 7,
  graceDays: 5,
  restrictionCutoffTime: '23:59',
  restrictionEnabled: false,
  restrictionMode: 'full',         // 'billing_only' | 'read_only' | 'full'
  lastRun: null,
  lastRunStatus: null,             // 'success' | 'partial' | 'failed'
  lastRunStats: { generated: 0, sent: 0, failed: 0, skipped: 0 },
};

/* ─── Manual grace/restore overrides — cycle-specific, never carried
   forward automatically (brief §5's explicit rule). `cycleKey` is the
   YYYY-MM the override was granted for; computeSchoolRestriction only
   honors an override whose cycleKey matches the invoice's own billing
   month, so next month's normal policy applies again on its own. ─── */
export const INITIAL_BILLING_OVERRIDES = [];
/* shape: { id, schoolId, invoiceNumber: string|'all', graceDays, expiryDate,
   reason, grantedBy, grantedAt, cycleKey, active } */

/* ─── Access audit trail — every automated or manual restrict/restore. ─── */
export const INITIAL_ACCESS_EVENTS = [];
/* shape: { id, schoolId, type: 'restricted'|'restored'|'override_granted',
   actor, reason, timestamp, invoiceNumber } */

/* ─── Simulated scheduled-job run history ─── */
export const INITIAL_JOB_RUNS = [];
/* shape: { id, runAt, trigger: 'scheduled'|'manual', status: 'success'|'partial'|'failed',
   stats: {schoolsChecked, generated, sent, failed, skipped, remindersSent, restricted, restored},
   log: [{schoolId, schoolName, action, detail}] } */

let _evtSeq = 1, _jobSeq = 1, _ovSeq = 1;
export const nextEventId = () => `evt-${_evtSeq++}`;
export const nextJobId = () => `job-${_jobSeq++}`;
export const nextOverrideId = () => `ov-${_ovSeq++}`;

/* ═══════════════════════════════════════════════════════════════════
   AUTHORITATIVE RESTRICTION DECISION
   ═══════════════════════════════════════════════════════════════════
   Never restricts:
   - an inactive school (no ERP access obligation to begin with)
   - a school with no valid payment setup (nothing to be overdue on)
   - before due date + grace period have elapsed
   - while a matching, still-active manual override exists for this cycle
   Only ever restricts a currently-active, overdue, ineligible-for-
   override school, and only when settings.restrictionEnabled is true. */
export function computeSchoolRestriction({
  school, setup, challan, recv, settings, overrides, isActiveSchool, today = todayISO(),
}) {
  if (!settings.restrictionEnabled) return { restricted: false, reason: null };
  if (!isActiveSchool) return { restricted: false, reason: 'school_inactive' };
  if (!setup) return { restricted: false, reason: 'no_setup' };
  if (!challan) return { restricted: false, reason: 'no_invoice' };

  const payable = totalPayableOf(challan);
  const received = recv ? (recv.receivedAmount || 0) : 0;
  if (payable > 0 && received >= payable) return { restricted: false, reason: 'paid' };
  if (!isChallanOverdue(challan)) return { restricted: false, reason: 'within_due_date' };

  const graceEnd = computeGraceEnd(challan.dueDateRaw, settings);
  if (today <= graceEnd) return { restricted: false, reason: 'within_grace_period', graceEnd };

  const cycleKey = (challan.issueDate ? challan.dueDateRaw : today).slice(0, 7);
  const activeOverride = (overrides || []).find((o) => o.active
    && o.schoolId === school.id
    && (o.invoiceNumber === 'all' || o.invoiceNumber === challan.invoiceNumber)
    && o.cycleKey === cycleKey
    && (!o.expiryDate || today <= o.expiryDate));
  if (activeOverride) return { restricted: false, reason: 'manual_override', override: activeOverride };

  return {
    restricted: true,
    reason: 'overdue_invoice',
    restrictedSince: computeRestrictionDate(challan.dueDateRaw, settings),
    invoiceNumber: challan.invoiceNumber,
    outstandingAmount: payable - received,
    mode: settings.restrictionMode,
  };
}

/* Preview strip for the Automation settings screen (brief §4E): invoice
   date → due date → grace-period end → expected restriction date, for
   a representative "generated today" invoice. */
export function previewTimeline(settings, issueDateISO = todayISO()) {
  const sendDate = computeSendDate(issueDateISO, settings);
  const dueDate = computeDueDate(issueDateISO, settings);
  const graceEnd = computeGraceEnd(dueDate, settings);
  const restrictionDate = computeRestrictionDate(dueDate, settings);
  return {
    issueDate: issueDateISO, issueDateLabel: fmtDateLong(issueDateISO),
    sendDate, sendDateLabel: fmtDateLong(sendDate),
    dueDate, dueDateLabel: fmtDateLong(dueDate),
    graceEnd, graceEndLabel: fmtDateLong(graceEnd),
    restrictionDate, restrictionDateLabel: fmtDateLong(restrictionDate),
  };
}

export { PAY_SCHOOLS };
