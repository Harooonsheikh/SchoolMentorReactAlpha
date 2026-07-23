/* ════════════════════════════════════════════════════════════════════
   Branches service — the shared school/branch directory + Mentor AI plans.

   Two live sources, both cross-origin (proxied in dev by src/setupProxy.js):

     1. ERP API   GET /api/Registration/old_MISDBBranch
        → { success, message, count,
            data: [ { id, name, address, branchPhone, isActive, ... } ] }
        The branch directory: who the schools/campuses are.

     2. AI/wallet API  GET /ai/api/wallet/admin/branches/subscriptions/
        → { branches: [ { branch, branch_name, plan{code,...},
                          subscription_active, is_expired, is_paid,
                          wallet_enabled, subscription_period_end, ... } ] }
        The Mentor AI plan + subscription state per branch.

   `listBranchesWithPlans()` fetches both, then merges each subscription onto
   its branch (matched by branch id first, then by name) and returns rows in
   the shape the Mentor AI screens already use (school / campus / contact /
   plan / status / due / usage). The caller falls back to bundled demo data
   only if the branch directory itself cannot be loaded.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError } from '../client';
import { ERP_API_BASE, AI_API_BASE, getSuperAdminToken } from '../config';
import EP from '../endpoints';

const EMPTY_USAGE = { tokens: 0, lessons: 0, banks: 0, worksheets: 0, posts: 0 };

/* Subscription plan.code → the Basic/Pro/Premium labels the UI uses. */
const PLAN_LABEL = { basic: 'Basic', pro: 'Pro', premium: 'Premium' };
const toPlanLabel = (code) => PLAN_LABEL[String(code || '').toLowerCase()] || 'Basic';

/* UI plan label ('Basic'/'Pro'/'Premium') → the API's plan_code. */
export const toPlanCode = (label) => String(label || '').toLowerCase();

/* Map a subscription record → { plan, status, due } for the table.

   A branch whose wallet has been switched off (wallet_enabled === false via
   the Block action / POST .../status/) is shown as Blocked FIRST — the admin
   block overrides the subscription state, so a still-active/paid subscription
   with the wallet disabled correctly reads as Blocked (not Active). */
function subToPlanFields(sub) {
  const status = sub.wallet_enabled === false ? 'Blocked'
    : sub.is_expired ? 'Expired'
      : sub.subscription_active ? 'Active'
        : 'Blocked';
  const due = sub.subscription_period_end
    ? String(sub.subscription_period_end).slice(0, 10)
    : 'Free';
  return { plan: toPlanLabel(sub.plan?.code), status, due };
}

/** Map one raw branch record → the "school" row the Mentor AI UI expects.
   `sub` is the subscription that matched this branch on BOTH id and name
   (or undefined). With no exact match the branch is shown as Inactive. */
export function branchToSchool(b, sub) {
  const planFields = sub
    ? subToPlanFields(sub)
    : { plan: 'Basic', status: 'Inactive', due: 'Free' };   // no id+name match → not active
  return {
    id: b.id,
    school: b.name || 'Unnamed Branch',
    campus: b.address || b.branchCode || '—',
    contact: b.branchPhone || '—',
    plan: planFields.plan,
    used: 0,
    status: planFields.status,
    due: planFields.due,
    isPaid: sub ? Boolean(sub.is_paid) : false,
    walletEnabled: sub ? Boolean(sub.wallet_enabled) : true,
    usage: { ...EMPTY_USAGE },
    /* keep both raw records around for anything that needs their fields */
    branch: b,
    subscription: sub || null,
  };
}

/* Shared fetch → JSON helper. Throws ApiError on network/HTTP failure. */
async function getJson(url, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(url, {
      headers: {
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (!res.ok) throw new ApiError(`Failed to load ${label} (${res.status})`, res.status);
  return res.json().catch(() => null);
}

/** Raw branch directory rows from the ERP API. */
async function fetchBranches() {
  const body = await getJson(`${ERP_API_BASE}${EP.registration.branches()}`, 'branches');
  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
}

/** Raw subscription rows from the AI/wallet API.
   GET /ai/api/wallet/admin/branches/subscriptions/  → { total, limit, offset,
   branches: [ { branch, branch_name, plan{...}, subscription_active,
   is_expired, is_paid, wallet_enabled, ... } ] }. (The server only allows GET
   here — a POST returns 405 Method Not Allowed.) */
async function fetchSubscriptions() {
  const body = await getJson(`${AI_API_BASE}${EP.wallet.subscriptions()}`, 'subscriptions');
  return Array.isArray(body?.branches) ? body.branches : Array.isArray(body) ? body : [];
}

/**
 * Branch directory with each branch's Mentor AI plan + subscription state
 * merged in, mapped to the UI's school-row shape.
 *
 * Matching: a subscription maps onto a branch when their ids are equal —
 * branch.id === sub.branch. A branch with no matching subscription is shown
 * as Inactive (no active subscription).
 *
 * Only the branch directory is required; if the subscription call fails
 * every row simply shows as Inactive.
 */
export async function listBranchesWithPlans() {
  const [branches, subs] = await Promise.all([
    fetchBranches(),
    fetchSubscriptions().catch((e) => {
      // plans are best-effort — but log so a failing/blocked call isn't silent
      // (a failure here makes every row fall back to Inactive).
      console.warn('[MentorAI] subscriptions load failed → all rows Inactive:', e?.message || e);
      return [];
    }),
  ]);

  /* Key on branch id only. */
  const subById = new Map();
  for (const s of subs) subById.set(String(s.branch), s);

  return branches.map((b) => {
    const sub = subById.get(String(b.id));
    return branchToSchool(b, sub);
  });
}

/** Branch directory only (no plan merge). Kept for callers that just need names. */
export async function listBranchesAsSchools() {
  const branches = await fetchBranches();
  return branches.map((b) => branchToSchool(b));
}

/**
 * Update (or set) a branch's Mentor AI subscription plan.
 *   POST /ai/api/wallet/admin/branches/{branchId}/subscription/
 *   body: { plan_code: 'basic'|'pro'|'premium', reset_period: true }
 *
 * @param branchId    the branch id (matches sub.branch / the row id)
 * @param plan        'Basic' | 'Pro' | 'Premium' (UI label) OR a raw plan_code
 * @param resetPeriod restart the billing period from now (default true)
 * @returns the API's updated subscription record
 */
export async function updateBranchPlan(branchId, plan, resetPeriod = true) {
  const token = getSuperAdminToken();
  const url = `${AI_API_BASE}${EP.wallet.subscription(branchId)}`;
  const plan_code = toPlanCode(plan);          // 'Basic'|'basic' → 'basic'
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ plan_code, reset_period: resetPeriod }),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (!res.ok) throw new ApiError(`Failed to update plan (${res.status})`, res.status);
  return res.json().catch(() => null);
}

/**
 * Set a branch's wallet enabled flag AND read back its live wallet state.
 *   POST /ai/api/wallet/admin/branches/{branchId}/status/
 *   body: { wallet_enabled: true|false }
 *   → { branch: {...subscription}, wallet: { buckets, is_paid, ... } }
 *
 * There is no GET for the wallet, so this same POST is used both to toggle
 * the wallet and (by passing the branch's CURRENT flag) to read usage.
 *
 * @param branchId  the branch id
 * @param enabled   the wallet_enabled value to set
 * @returns { branch, wallet } as returned by the API
 */
export async function setWalletStatus(branchId, enabled) {
  const token = getSuperAdminToken();
  const url = `${AI_API_BASE}${EP.wallet.status(branchId)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ wallet_enabled: Boolean(enabled) }),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (!res.ok) throw new ApiError(`Failed to update wallet status (${res.status})`, res.status);
  return res.json().catch(() => null);
}

/** Read a branch's live wallet (usage buckets) without changing its state:
   re-post the CURRENT wallet_enabled flag (idempotent). Returns the `wallet`
   object ({ buckets, is_paid, subscription_period_end, ... }) or null. */
export async function getWalletUsage(branchId, currentEnabled) {
  const data = await setWalletStatus(branchId, currentEnabled);
  return data?.wallet || null;
}
