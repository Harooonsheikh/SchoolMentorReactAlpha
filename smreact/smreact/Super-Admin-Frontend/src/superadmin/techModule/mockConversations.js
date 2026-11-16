/* ═══════════════════════════════════════════════════════════════════
   mockConversations — demo-only inline chat transcripts for the Tech
   Module's "Customer Conversation" section. Purely frontend/mock —
   the real conversation (when a live backend session exists) is still
   reached via the existing "Open Support Conversation" button
   (onOpenSupportSession → AgentSupport.jsx), unchanged.

   Explicit transcripts are keyed by supportConversationId for the
   hand-authored mock tickets; getConversation() falls back to a
   generic, still-plausible transcript (built from the ticket's own
   title/description/school) for every other ticket that has a
   supportConversationId but no hand-authored one — so the section
   never renders empty when a conversation id exists.
   ═══════════════════════════════════════════════════════════════════ */

const CONVERSATIONS = {
  /* BUG-1025 — Attendance sync fails after biometric firmware update */
  'sess-2001': [
    { sender: 'customer', name: 'MPS School System — Admin Office', time: '9:02 AM', text: 'Attendance is not syncing at all since yesterday\'s firmware update on our biometric device.' },
    { sender: 'support', name: 'Tariq Ahmed', time: '9:05 AM', text: 'Thanks for the report — could you share a screenshot of what the device shows?' },
    { sender: 'customer', name: 'MPS School System — Admin Office', time: '9:08 AM', text: 'Here you go.', attachment: { type: 'image', name: 'device_error.jpg' } },
    { sender: 'support', name: 'Tariq Ahmed', time: '9:12 AM', text: 'Got it, this looks like a compatibility issue with the new firmware payload. I\'ve created ticket BUG-1025 for our dev team to fix this.' },
    { sender: 'customer', name: 'MPS School System — Admin Office', time: '9:13 AM', text: 'Thank you, please let us know once it\'s fixed.' },
  ],
  /* BUG-1028 — Fee challan PDF cuts off the discount line for large families */
  'sess-2003': [
    { sender: 'customer', name: 'Daffodil Schools — Accounts', time: '2:14 PM', text: 'The fee challan for one of our families with 5 kids is cutting off the discount line at the bottom.' },
    { sender: 'support', name: 'Tariq Ahmed', time: '2:17 PM', text: 'Could you send a copy of the challan so I can see exactly where it\'s cut off?' },
    { sender: 'customer', name: 'Daffodil Schools — Accounts', time: '2:20 PM', text: 'Attached.', attachment: { type: 'image', name: 'cut_off_challan.png' } },
    { sender: 'support', name: 'Tariq Ahmed', time: '2:24 PM', text: 'Thanks, I can see it now. I\'ve logged this as BUG-1028 for the dev team.' },
  ],
  /* IMP-0217 — Add WhatsApp OTP fallback for parent login */
  'sess-2002': [
    { sender: 'customer', name: 'Smart School — Front Desk', time: '11:40 AM', text: 'A lot of our parents complain the login OTP SMS never arrives. Any chance of a WhatsApp option instead?' },
    { sender: 'support', name: 'Sara Ali', time: '11:44 AM', text: 'That\'s a great suggestion — I\'ll submit this as a development request for our team to look into.' },
    { sender: 'customer', name: 'Smart School — Front Desk', time: '11:45 AM', text: 'Appreciate it, this would really help our parents.' },
    { sender: 'support', name: 'Sara Ali', time: '2 days ago', text: 'Good news — this has been developed, tested, and released! Parents can now use WhatsApp OTP automatically after 2 failed SMS attempts.' },
  ],
};

const FALLBACK_SUPPORT_LINES = [
  (t) => `We're seeing an issue: ${t.title}.`,
  () => 'Thanks for flagging this — could you share a bit more detail or a screenshot?',
  (t) => `Sure, here's what's happening: ${t.description || t.title}`,
  (t) => `Got it, I've logged this as ${t.ticketNumber} for our development team.`,
];

/* Deterministic-enough fallback so a given ticket always renders the
   same fallback transcript across renders (no Math.random on every
   paint), without needing a real per-ticket authored script. */
export function getConversation(conversationId, ticket) {
  if (conversationId && CONVERSATIONS[conversationId]) return CONVERSATIONS[conversationId];
  if (!ticket) return [];
  const schoolLabel = `${ticket.school?.name || 'School'} — Front Desk`;
  return [
    { sender: 'customer', name: schoolLabel, time: 'Earlier', text: FALLBACK_SUPPORT_LINES[0](ticket) },
    { sender: 'support', name: ticket.reportedBy?.name || 'Support Agent', time: 'Earlier', text: FALLBACK_SUPPORT_LINES[1](ticket) },
    { sender: 'customer', name: schoolLabel, time: 'Earlier', text: FALLBACK_SUPPORT_LINES[2](ticket) },
    { sender: 'support', name: ticket.reportedBy?.name || 'Support Agent', time: 'Earlier', text: FALLBACK_SUPPORT_LINES[3](ticket) },
  ];
}
