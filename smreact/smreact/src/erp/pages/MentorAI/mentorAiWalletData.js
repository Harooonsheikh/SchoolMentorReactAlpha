/* ═══════════════════════════════════════════════════════════════════
   MENTOR AI WALLET — mock data.

   Read ONLY by src/services/mentorAIWalletService.js (never import this
   directly from UI components — same convention as every other
   mock/*Data.js file in this project).

   Ported from the Mentor AI mobile app's Wallet screens (reference
   screenshots). Kept in its OWN dedicated data file / service pair —
   separate from mentorAiStudioData.js's PLAN_TIERS (which still backs
   the live per-generation token counters used internally by Chat /
   Lesson Plans / Worksheets / Design Studio's consume() calls) — so
   this redesign never touches that existing consumption wiring. The
   numbers here are a realistic fixed snapshot matching the mobile
   screenshots exactly, ready to be swapped for a real usage endpoint
   later without any component change.
   ═══════════════════════════════════════════════════════════════════ */

export const WALLET_PLANS = [
  { id: 'basic', name: 'Basic', tagline: 'Essential AI tools to get started', price: null,
    totals: { chatTokens: 1000000, screens: 100, worksheets: 25, designPosts: 15 } },
  { id: 'pro', name: 'Pro', tagline: 'Advanced tools for established schools', price: 5000,
    totals: { chatTokens: 5000000, screens: 300, worksheets: 70, designPosts: 50 } },
  { id: 'premium', name: 'Premium', tagline: 'Full power for large, multi-campus schools', price: 12000,
    totals: { chatTokens: 10000000, screens: 600, worksheets: 150, designPosts: 100 } },
];

/* The active plan's current-cycle usage — matches the reference
   screenshots exactly (453,603 / 5,000,000 = 9.1%, 153 / 300 = 51.0%,
   33 / 70 = 47.1%, 16 / 50 = 32.0%). */
export const WALLET_USED_SNAPSHOT = { chatTokens: 453603, screens: 153, worksheets: 33, designPosts: 16 };
export const WALLET_DUE_DATE = '2026-09-06'; // displayed as 06-Sep-2026

/* Card definitions — order, copy and per-card row labels exactly as
   specced. Only the first two cards carry an info tooltip. */
export const WALLET_FEATURES = [
  { key: 'chatTokens', title: 'AI Chat Tokens', icon: 'fa-bolt',
    totalLabel: 'Total Tokens', usedLabel: 'Used Tokens',
    tooltip: 'AI Chat Tokens are used for AI Chat Assistant and Lesson Plan generation. Whenever you generate lesson plans or chat with Mentor AI, tokens are consumed from this balance.' },
  { key: 'screens', title: 'Screens / Scans', icon: 'fa-images',
    totalLabel: 'Total Screens', usedLabel: 'Used',
    tooltip: 'Screens / Scans are counted when you upload or scan images in AI Chat, Lesson Plans, Worksheets, or Design Studio. One uploaded image or screenshot counts as one screen.' },
  { key: 'worksheets', title: 'Worksheets', icon: 'fa-file-pen',
    totalLabel: 'Total / Month', usedLabel: 'Used',
    tooltip: null },
  { key: 'designPosts', title: 'Design Studio', icon: 'fa-palette',
    totalLabel: 'Posts / Month', usedLabel: 'Used',
    tooltip: null },
];

export const WALLET_BANK_DETAILS = {
  bankName: 'Meezan Bank',
  accountTitle: 'School Mentor (Pvt.) Ltd.',
  accountNo: '0123-4567890-01',
  iban: 'PK36 MEZN 0001 2304 5678 9001',
  whatsapp: '+92 300 1234567',
};
