/* ═══════════════════════════════════════════════════════════════════
   TECH NOTIFICATIONS — lightweight internal store (frontend only)

   Purely an internal "Tech Module released a ticket → Support should
   relay this to the school" handoff. Deliberately separate from
   Notifications.jsx/notificationsData.js, which is an OUTBOUND MOBILE
   PUSH COMPOSER (Super Admin → school app end-users) — no real channel
   exists from this admin panel to notify a school directly, so this
   surfaces as a panel inside the Support console for an agent to relay
   manually (decision confirmed with the user).
   ═══════════════════════════════════════════════════════════════════ */

/* Seeded with the one already-released mock ticket (IMP-0217, see
   techTicketsData.js's `notifiedSupport: true` example) so the Support
   console's Resolved Issues panel isn't empty on first load. */
let _notifications = [
  {
    id: 'notif-seed-0217',
    audience: 'support',
    type: 'ticket_released',
    ticketId: 't35',
    ticketNumber: 'IMP-0217',
    title: 'New Update Released',
    message: 'Parents can now receive their login OTP via WhatsApp automatically after 2 failed SMS attempts. Please check and confirm with the school.',
    meta: { school: 'Smart School', supportConversationId: 'sess-2002' },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
];

export function getAllNotifications() {
  return _notifications;
}

export function getNotificationsForAudience(audience) {
  return _notifications.filter((n) => n.audience === audience);
}

/* { type:'ticket_released', ticketId, ticketNumber, title, message, meta, audience } */
export function pushNotification(payload) {
  const n = {
    id: `notif-${Date.now()}`,
    audience: payload.audience || 'support',
    type: payload.type,
    ticketId: payload.ticketId,
    ticketNumber: payload.ticketNumber,
    title: payload.title || 'New Update Released',
    message: payload.message,
    meta: payload.meta || {},
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };
  _notifications = [n, ..._notifications];
  return n;
}

export function acknowledgeNotification(id) {
  _notifications = _notifications.map((n) => (n.id === id ? { ...n, acknowledged: true } : n));
  return _notifications.find((n) => n.id === id);
}
