import mentorAiApi from "./mentorAiApi";
import { WALLET_PLANS, WALLET_FEATURES, WALLET_BANK_DETAILS } from "../mentorAiWalletData";

/* ═══════════════════════════════════════════════════════════════════
   Mentor AI Wallet — live usage from GET /ai/api/wallet/.

   The Wallet screen and the header "tokens left" chip used to read
   src/services/mentorAIWalletService.js, which returns a fixed mock
   snapshot — so the numbers never changed. This service calls the real
   endpoint and maps whatever it returns onto the screen's shape:

     { activePlanId, plans: [{ id, name, tagline, price, totals, used,
       isCurrent, dueDate }], features }

   Plan names/prices/feature cards come from mentorAiWalletData.js
   (display catalogue); the current plan, its limits, usage and due date
   come from the API. If the API already returns that exact shape it is
   used as-is. Field names are matched loosely (snake_case, camelCase,
   "*_used" / "*_limit" / "remaining_*") — see FIELD_ALIASES.
   ═══════════════════════════════════════════════════════════════════ */

const FIELD_ALIASES = {
    chatTokens: ["chatTokens", "chat_tokens", "ai_chat_tokens", "tokens", "token"],
    screens: ["screens", "scans", "screen", "scan", "screens_scans", "images", "image_scans", "image_scan"],
    worksheets: ["worksheets", "worksheet"],
    designPosts: ["designPosts", "design_posts", "design_post", "designs", "design_studio", "posts", "ai_posts", "ai_post"],
};
const zeroUsed = () =>
    Object.fromEntries(Object.keys(FIELD_ALIASES).map(k => [k, 0]));
const num = (v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
};

function pick(obj, aliases, { prefixes = [""], suffixes = [""] } = {}) {
    if (!obj || typeof obj !== "object") return undefined;
    for (const a of aliases) {
        for (const p of prefixes) {
            for (const s of suffixes) {
                const v = num(obj[`${p}${a}${s}`]);
                if (v !== undefined) return v;
                const nested = obj[`${p}${a}${s}`];
                if (nested && typeof nested === "object") {
                    const inner = num(nested.total ?? nested.limit ?? nested.value);
                    if (inner !== undefined) return inner;
                }
            }
        }
    }
    return undefined;
}

function pickUsedFromNested(obj, aliases) {
    for (const a of aliases) {
        const n = obj?.[a];
        if (n && typeof n === "object") {
            const used = num(n.used ?? n.consumed);
            if (used !== undefined) return used;
            const total = num(n.total ?? n.limit);
            const rem = num(n.remaining ?? n.left);
            if (total !== undefined && rem !== undefined) return Math.max(0, total - rem);
        }
    }
    return undefined;
}

function pickTotalFromNested(obj, aliases) {
    for (const a of aliases) {
        const n = obj?.[a];
        if (n && typeof n === "object") {
            const total = num(n.total ?? n.limit ?? n.quota ?? n.max);
            if (total !== undefined) return total;
        }
    }
    return undefined;
}

function planIdFrom(raw, catalogue = WALLET_PLANS) {
    const cands = [raw?.plan_code, raw?.plan?.plan_code, raw?.plan?.code, raw?.plan?.id, raw?.plan?.slug, raw?.plan?.name,
        raw?.subscription?.plan_code, raw?.subscription?.plan?.plan_code, raw?.subscription?.plan?.name, raw?.subscription?.plan,
        raw?.plan_name, raw?.current_plan, raw?.plan_type, raw?.plan, raw?.activePlanId];
    for (const v of cands) {
        if (v == null || typeof v === "object") continue;
        const s = String(v).toLowerCase();
        const hit = catalogue.find(p => s === p.id || s === p.name.toLowerCase())
            || catalogue.find(p => s.includes(p.id) || s.includes(p.name.toLowerCase()));
        if (hit) return hit.id;
    }
    return null;
}

export function normalizeWallet(raw, catalogue = WALLET_PLANS) {
    const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
    const d0 = obj(raw?.data) || raw;
    // Flatten branch "buckets" so chat_tokens / screens / etc. are readable
    const d = { ...d0, ...(obj(d0?.buckets) || {}) };
    // Already in the screen's shape — use as-is.
  // If API already returns plans, still normalize the CURRENT PLAN usage.
// Do not return early because /user-usage/ may contain the live counters.
if (Array.isArray(d?.plans) && d.plans.some(p => p?.totals)) {
    const activePlanId =
        d.activePlanId ||
        planIdFrom(d, catalogue) ||
        d.plans.find(p => p.isCurrent)?.id ||
        catalogue[0]?.id;

    const currentApiPlan =
        d.plans.find(p => p.isCurrent) ||
        d.plans.find(p => p.id === activePlanId);

    const usageObj =
        obj(d?.usage) ||
        obj(d?.used) ||
        obj(d?.consumed);

    const remainingObj =
        obj(d?.remaining) ||
        obj(d?.balance);

    const currentUsed = {};

    Object.entries(FIELD_ALIASES).forEach(([key, aliases]) => {
        const nestedUsed =
            pickUsedFromNested(d, aliases) ??
            pickUsedFromNested(usageObj, aliases);

        const directUsed =
            pick(usageObj, aliases, {
                prefixes: ["", "used_"],
                suffixes: ["", "_used", "_consumed"]
            }) ??
            pick(d, aliases, {
                prefixes: ["used_"],
                suffixes: ["", "_used", "_consumed"]
            });

        const total =
            currentApiPlan?.totals?.[key] ??
            catalogue.find(p => p.id === activePlanId)?.totals?.[key] ??
            0;

        const remaining =
            pick(remainingObj, aliases, {
                prefixes: ["", "remaining_"],
                suffixes: ["", "_remaining", "_left"]
            });

        let used =
            nestedUsed ??
            directUsed;

        if (used === undefined && remaining !== undefined) {
            used = Math.max(0, total - remaining);
        }

        currentUsed[key] = used ?? 0;
    });

    const plans = catalogue.map(p => {
        const apiPlan = d.plans.find(x => x.id === p.id);

        return {
            ...p,
            ...(apiPlan || {}),
            totals: {
                ...p.totals,
                ...(apiPlan?.totals || {})
            },
                  used: p.id === activePlanId
                ? {
                    ...(apiPlan?.used || {}),
                    ...currentUsed
                }
                : zeroUsed(),
            isCurrent: p.id === activePlanId,
            dueDate: apiPlan?.dueDate || null
        };
    });

    return {
        ...d,
        plans,
        features: d.features || WALLET_FEATURES,
        activePlanId,
        _foundUsed: Object.fromEntries(
            Object.keys(FIELD_ALIASES).map(k => [k, currentUsed[k] !== undefined])
        )
    };
}

    const activePlanId = planIdFrom(d, catalogue) || catalogue[0]?.id || "basic";
    // const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
    const limitsObj = obj(d?.limits) || obj(d?.totals) || obj(d?.plan?.limits) || obj(d?.quota) || obj(d?.allowance);
    const usageObj = obj(d?.usage) || obj(d?.used) || obj(d?.consumed);
    const remainingObj = obj(d?.remaining) || obj(d?.balance);
    const LIMIT = { prefixes: ["total_", "max_"], suffixes: ["", "_limit", "_total", "_quota"] };
    const USED = { prefixes: ["used_"], suffixes: ["", "_used", "_consumed"] };
    const LEFT = { prefixes: ["remaining_"], suffixes: ["", "_remaining", "_left"] };

    const totals = {};
    const used = {};
    const foundUsed = {};
    Object.entries(FIELD_ALIASES).forEach(([key, aliases]) => {
        const planTotal = catalogue.find(p => p.id === activePlanId)?.totals?.[key];
        // Explicit containers accept bare keys; flat fields must be labelled.
        const total = pickTotalFromNested(d, aliases) ?? pick(limitsObj, aliases, { prefixes: ["", ...LIMIT.prefixes], suffixes: LIMIT.suffixes })
            ?? pick(d, aliases, { prefixes: LIMIT.prefixes, suffixes: [""] })
            ?? pick(d, aliases, { prefixes: [""], suffixes: ["_limit", "_total", "_quota"] });
        const t = total ?? planTotal;
        let usedVal = pickUsedFromNested(d, aliases)
            ?? pick(usageObj, aliases, { prefixes: ["", ...USED.prefixes], suffixes: USED.suffixes })
            ?? pick(d, aliases, { prefixes: USED.prefixes, suffixes: [""] })
            ?? pick(d, aliases, { prefixes: [""], suffixes: ["_used", "_consumed"] });
        if (usedVal === undefined) {
            const rem = pick(remainingObj, aliases, { prefixes: ["", ...LEFT.prefixes], suffixes: LEFT.suffixes })
                ?? pick(d, aliases, { prefixes: LEFT.prefixes, suffixes: [""] })
                ?? pick(d, aliases, { prefixes: [""], suffixes: ["_remaining", "_left"] });
            if (rem !== undefined && t !== undefined) usedVal = Math.max(0, t - rem);
        }
        totals[key] = t ?? 0;
        used[key] = usedVal ?? 0;
        if (usedVal !== undefined) foundUsed[key] = true;
    });

    const dueDate = String(d?.due_date || d?.dueDate || d?.expiry_date || d?.expires_at || d?.renewal_date
        || d?.valid_till || d?.plan?.expires_at || d?.subscription?.end_date || "").slice(0, 10) || null;

     const plans = catalogue.map(p => (p.id === activePlanId
        ? { ...p, totals: { ...p.totals, ...totals }, used, isCurrent: true, dueDate }
        : { ...p, used: zeroUsed(), isCurrent: false, dueDate: null }));
    return { activePlanId, plans, features: WALLET_FEATURES, _foundUsed: foundUsed };
}

/* GET /ai/api/wallet/plans/ → display catalogue [{ id, name, tagline,
   price, totals }]. Falls back to mentorAiWalletData.js per field. */
export function normalizePlans(raw) {
    const list = Array.isArray(raw) ? raw : (raw?.results || raw?.plans || raw?.data || []);
    if (!Array.isArray(list) || !list.length) return WALLET_PLANS;
    const out = list.map(pl => {
        const code = String(pl?.plan_code ?? pl?.code ?? pl?.slug ?? pl?.id ?? pl?.name ?? "").toLowerCase();
        const local = WALLET_PLANS.find(w => code === w.id || code.includes(w.id) || String(pl?.name || "").toLowerCase() === w.name.toLowerCase());
        const src = pl?.limits || pl?.features || pl?.quota || pl;
        const totals = {};
        Object.entries(FIELD_ALIASES).forEach(([key, aliases]) => {
            const t = pickTotalFromNested(src, aliases)
                ?? pick(src, aliases, { prefixes: ["", "total_", "max_"], suffixes: ["", "_limit", "_total", "_quota"] });
            totals[key] = t ?? local?.totals?.[key] ?? 0;
        });
        const price = num(pl?.price ?? pl?.monthly_price ?? pl?.amount ?? pl?.price_per_month);
        return {
            id: local?.id || code || String(pl?.id),
            name: pl?.name || pl?.title || local?.name || code,
            tagline: pl?.description || pl?.tagline || local?.tagline || "",
            price: price === undefined ? (local?.price ?? null) : (price || null),
            totals,
        };
    });
    const rank = (p) => { const i = WALLET_PLANS.findIndex(w => w.id === p.id); return i === -1 ? 99 : i; };
    return out.sort((x, y) => rank(x) - rank(y) || (x.price || 0) - (y.price || 0));
}

/* Postman "Wallet" folder: /wallet/ (branch wallet: plan, limits, usage),
   /wallet/user-usage/ (usage) and /wallet/plans/ (plan list). Usage is
   taken from /wallet/ when it has it, otherwise from /user-usage/. */
export async function getWalletData() {
    const [w, u, pl] = await Promise.allSettled([
        mentorAiApi.get("/ai/api/wallet/"),
        mentorAiApi.get("/ai/api/wallet/user-usage/"),
        mentorAiApi.get("/ai/api/wallet/plans/"),
    ]);

    if (w.status === "rejected") {
        throw w.reason;
    }

    const wallet = w.value.data;
    const usage = u.status === "fulfilled" ? u.value.data : null;
    const plansRaw = pl.status === "fulfilled" ? pl.value.data : null;
console.log("MENTOR AI WALLET (raw):", {
    wallet,
    userUsage: usage,
    plans: plansRaw
});
    console.log("MENTOR AI WALLET RAW:", wallet);
    console.log("MENTOR AI USER USAGE RAW:", usage);
    console.log("MENTOR AI PLANS RAW:", plansRaw);
    console.log("BUCKETS JSON:", JSON.stringify(wallet?.buckets, null, 2));
console.log("PLAN JSON:", JSON.stringify(wallet?.plan, null, 2));
console.log("USER0 JSON:", JSON.stringify(usage?.users?.[0], null, 2));
console.log("PLANS JSON:", JSON.stringify(plansRaw, null, 2));

    const catalogue = plansRaw
        ? normalizePlans(plansRaw)
        : WALLET_PLANS;

    const main = normalizeWallet(wallet, catalogue);

    /*
     * /wallet/ tells us the current plan.
     * /user-usage/ provides the live counters.
     *
     * Always merge user usage into the CURRENT plan.
     */
    if (usage) {
        const currentPlan = main.plans.find(p => p.isCurrent);
        const users = Array.isArray(usage?.users) ? usage.users : [];

        if (currentPlan) {
            Object.keys(FIELD_ALIASES).forEach(key => {
                // Only fill from users if buckets gave nothing
                if (currentPlan.used[key]) return;
                currentPlan.used[key] = users.reduce((total, u) => {
                    const src = u?.usage || u?.used || u;
                    const v = pickUsedFromNested(src, FIELD_ALIASES[key]) ?? pick(src, FIELD_ALIASES[key], {
                        prefixes: ["", "used_"],
                        suffixes: ["", "_used", "_consumed"],
                    });
                    return total + (v ?? 0);
                }, 0);
            });
        }
    }
    // Force every non-current plan to zero usage
    main.plans = main.plans.map(p =>
        p.isCurrent ? p : { ...p, used: zeroUsed(), dueDate: null }
    );

    console.log("PLANS USED CHECK:", main.plans.map(p => ({
        id: p.id,
        isCurrent: p.isCurrent,
        used: p.used,
    })));

    delete main._foundUsed;

    return main;
}
export async function getBankDetails() {
    return WALLET_BANK_DETAILS;
}