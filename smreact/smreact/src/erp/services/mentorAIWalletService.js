import { delay, clone } from './_http';
import {
  WALLET_PLANS, WALLET_USED_SNAPSHOT, WALLET_DUE_DATE, WALLET_FEATURES, WALLET_BANK_DETAILS,
} from '../pages/MentorAI/mentorAiWalletData';

/* ═══════════════════════════════════════════════════════════════════
   mentorAIWalletService — Mentor AI Wallet (plans, usage, upgrade).

   Dedicated service for the Wallet screen only — kept separate from
   mentorAiStudioService.js's getWalletUsage()/consume(), which still
   power the live per-generation token counters used internally by
   Chat / Lesson Plans / Worksheets / Design Studio. That wiring is
   untouched by this redesign; this service is the single source of
   truth for everything the Wallet UI (and the header/home wallet
   summaries) render.

   getWalletData() is the one call the UI needs — mirrors a realistic
   future REST shape (GET /api/mentor-ai/wallet) so swapping in a real
   backend later means replacing the body of each function only.
   ═══════════════════════════════════════════════════════════════════ */

const KEY_ACTIVE_PLAN = 'msai_wallet_active_plan';

function readActivePlan() {
  try { return localStorage.getItem(KEY_ACTIVE_PLAN) || 'pro'; } catch { return 'pro'; }
}
function writeActivePlan(planId) {
  try { localStorage.setItem(KEY_ACTIVE_PLAN, planId); } catch { /* storage unavailable */ }
}

const emptyUsage = { chatTokens: 0, screens: 0, worksheets: 0, designPosts: 0 };

export async function getWalletData() {
  await delay();
  const activePlanId = readActivePlan();
  const plans = WALLET_PLANS.map(p => ({
    ...p,
    isCurrent: p.id === activePlanId,
    used: p.id === activePlanId ? WALLET_USED_SNAPSHOT : emptyUsage,
    dueDate: WALLET_DUE_DATE,
  }));
  return clone({ activePlanId, plans, features: WALLET_FEATURES });
}

export async function setActivePlan(planId) {
  await delay();
  if (!WALLET_PLANS.some(p => p.id === planId)) throw new Error('Unknown plan');
  writeActivePlan(planId);
  return getWalletData();
}

export async function getBankDetails() {
  await delay();
  return clone(WALLET_BANK_DETAILS);
}
