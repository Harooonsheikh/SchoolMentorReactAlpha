import { buildSuperAdminUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   Super Admin → School Payment → Billing Automation ka restriction.

   GET /api/BillingAutoSetup (SuperAdmin API) saari saved setups ka BARE
   array deta hai (har Save Changes nayi row insert karta hai) — is liye
   sab se nayi (highest id) row hi current setup hai.

     restrictedAccess false        → koi rok nahi
     restrictedMode "read_only"    → ERP sirf dekhne ke liye
     restrictedMode "full"         → ERP band, sirf "restricted" popup
   ═══════════════════════════════════════════════════════════════════ */

/** @returns {Promise<'read_only'|'full'|null|undefined>} undefined = call fail
    (caller pichli state rakhe). */
export async function fetchBillingRestriction() {
  try {
    const res = await fetch(buildSuperAdminUrl('/api/BillingAutoSetup'), {
      headers: { Accept: '*/*' },
    });
    if (!res.ok) return undefined;
    const json = await res.json().catch(() => null);
    const raw = json && json.data !== undefined ? json.data : json;
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
    const row = list
      .filter((r) => r && typeof r === 'object' && r.isActive !== false)
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
    if (!row || !row.restrictedAccess) return null;
    const mode = String(row.restrictedMode || '').trim().toLowerCase();
    if (mode === 'full') return 'full';
    if (mode === 'read_only') return 'read_only';
    return null;
  } catch (e) {
    /* Network / API fail → jo state thi wahi rahe (pehli dafa me: koi rok nahi). */
    return undefined;
  }
}
