import { buildChainApiUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   CHAIN BRANCH — kya ye school kisi network (chain) ka hissa hai?

   Branch ke apne record me is ka koi khana nahi (dekhein
   /api/Registration/get-branch — wahan sirf school ki tafseel hai).
   Rishta Chain-Management API par rehta hai:

     POST {chain}/api/Network_Setup/network-schools/manage
       { action: "getbybranch", branchID }

   Ye sirf ACCEPTED rows deti hai — yani jawab me koi row aa gayi to
   school kisi network me shamil ho chuka hai. Aisi soorat me ERP
   view-only chalta hai (dekhein PermissionsContext ka readOnly aur
   apiConfig ka fetch guard).

   Jawab session bhar ke liye sambhal lete hain: har screen par dobara
   poochne ki zaroorat nahi, aur page refresh par foran maloom hota hai
   (network call ka intezar nahi).
   ═══════════════════════════════════════════════════════════════════ */

export const CHAIN_BRANCH_KEY = 'sm_chain_branch';   // '1' | '0'

const MANAGE_URL = buildChainApiUrl('/api/Network_Setup/network-schools/manage');

/** Pehle se maloom jawab — '1' / '0', ya null (abhi poocha hi nahi). */
export function cachedChainBranch() {
  try { return sessionStorage.getItem(CHAIN_BRANCH_KEY); }
  catch (e) { return null; }
}

function remember(value) {
  try { sessionStorage.setItem(CHAIN_BRANCH_KEY, value ? '1' : '0'); }
  catch (e) { /* private mode */ }
  return value;
}

/**
 * Mojooda branch chain ka hissa hai ya nahi.
 * Call nakaam ho to `false` — chain API na chalne par school apna ERP
 * chalata rahe, ye screen lock karne ki wajah nahi banti.
 */
export async function checkChainBranch() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchID) return false;

  const cached = cachedChainBranch();
  if (cached != null) return cached === '1';

  try {
    const res = await fetch(MANAGE_URL, {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getbybranch', branchID }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) return false;   // yaad nahi rakhte — agli dafa phir poocho
    const rows = Array.isArray(json.data) ? json.data : [];
    return remember(rows.some((r) => r && r.isAccepted === true));
  } catch (err) {
    console.error('Chain membership check failed:', err);
    return false;
  }
}

/* ───────────────── Ye branch kis network (chain) me hai ───────────────── */

export const CHAIN_NETWORK_KEY = 'sm_chain_network_id';   // '0' = chain me nahi

/** Pehle se maloom network id, ya null (abhi poocha hi nahi). */
export function cachedChainNetworkId() {
  try {
    const v = sessionStorage.getItem(CHAIN_NETWORK_KEY);
    return v == null ? null : (Number(v) || 0);
  } catch (e) { return null; }
}

/**
 * Is school ka network (chain) id — wahi accepted row jis se
 * `checkChainBranch` chain-membership tay karta hai, magar yahan us row ka
 * networkID chahiye. Chain ka hissa na ho (ya call nakaam ho) to 0.
 *
 * Jawab session bhar sambhal lete hain: jo screenein network ke against
 * data mangwati hain (School SOPs, Head Office Releases) wo har dafa yehi
 * sawaal na dohrayen.
 */
export async function fetchBranchNetworkId() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchID) return 0;

  const cached = cachedChainNetworkId();
  if (cached != null) return cached;

  try {
    const res = await fetch(MANAGE_URL, {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getbybranch', branchID }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) return 0;   // yaad nahi rakhte
    const rows = Array.isArray(json.data) ? json.data : [];
    const row = rows.find((r) => r && r.isAccepted === true);
    const id = row ? (Number(row.networkID) || 0) : 0;
    try { sessionStorage.setItem(CHAIN_NETWORK_KEY, String(id)); } catch (e) { /* private mode */ }
    return id;
  } catch (err) {
    console.error('Chain network lookup failed:', err);
    return 0;
  }
}
