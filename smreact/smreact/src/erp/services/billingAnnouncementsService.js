import { buildSuperAdminUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   BILLING ANNOUNCEMENTS — Super Admin → School Payment → Notifications &
   Reminders se jo messages is school ko server (Hangfire) ne bheje, wo
   dashboard ke "School Mentor Announcements" card me.

   GET .../SchoolMentorSuperAdminAPI/get-billing-reminder-delivery-history
       ?pageNumber=1&pageSize=50&branchId=<branchID>
   → { items: [{ id, reminderType (Generated|BeforeDue|Overdue), challanID,
                 amount, dueDate, channel (ERPBanner|NotificationInbox),
                 status (Sent|Failed), messageBody, sentOn }], totalCount }

   Ek message har channel ki alag row hai → challan + type + sentOn (minute)
   par ek kar diya. Sirf Sent. Card ke fields (AdminDashboard liveAnnouncements
   jaisa shape) me map.
   ═══════════════════════════════════════════════════════════════════ */

const TITLE = {
  Generated: 'Invoice Generated',
  BeforeDue: 'Payment Reminder',
  Overdue: 'Payment Overdue',
};

export async function getBillingAnnouncements() {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchId) return [];
  const res = await fetch(
    buildSuperAdminUrl(`/get-billing-reminder-delivery-history?pageNumber=1&pageSize=50&branchId=${branchId}`),
    { method: 'GET', headers: { Accept: '*/*' } },
  );
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  const rows = Array.isArray(json?.items) ? json.items : [];

  const seen = new Set();
  const out = [];
  rows.forEach((r) => {
    if (!r || String(r.status).toLowerCase() !== 'sent' || !r.messageBody) return;
    /* API ab sirf isi branch ki rows deti hai; phir bhi guard. */
    if (r.branchID != null && Number(r.branchID) !== branchId) return;
    const sent = String(r.sentOn || '');
    const key = `${r.challanID}|${r.reminderType}|${sent.slice(0, 16)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const dt = sent ? new Date(sent) : null;
    const ok = dt && !Number.isNaN(+dt);
    out.push({
      id: `bill-${r.id}`,
      sender: 'School Mentor — Billing',
      title: TITLE[r.reminderType] || 'Billing Notice',
      preview: r.messageBody,
      description: r.messageBody,
      category: 'Billing',
      date: ok ? dt.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : sent.slice(0, 10),
      /* sentOn me timezone nahi aata (server clock pakka nahi) — sirf tareekh. */
      time: '',
      status: ok && (Date.now() - dt.getTime()) <= 7 * 86400000 ? 'new' : 'read',
      _ts: ok ? dt.getTime() : 0,
    });
  });
  return out;
}
