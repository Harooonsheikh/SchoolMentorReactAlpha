import { buildSuperAdminUrl } from '../../utils/apiConfig';
import { getPaymentLedger, getPaymentReceivings } from './billingService';

/* ═══════════════════════════════════════════════════════════════════
   Super Admin → School Payment → Billing Automation ka restriction.

   GET /api/BillingAutoSetup (SuperAdmin API) saari saved setups ka BARE
   array deta hai (har Save Changes nayi row insert karta hai) — is liye
   sab se nayi (highest id) row hi current setup hai.

     restrictedAccess false        → koi rok nahi
     restrictedMode "read_only"    → ERP sirf dekhne ke liye
     restrictedMode "full"         → ERP band, sirf "restricted" popup

   Restriction ON hona kaafi NAHI — Super Admin (billingAutomationData
   computeSchoolRestriction) jaisa: is branch ka koi UNPAID challan ho aur
   due date + gracePeriod ke AGLE din restrictionCutOff ka waqt guzar chuka
   ho (us se baad ke din poora din). Warna koi rok nahi.
   ═══════════════════════════════════════════════════════════════════ */

const pad = (n) => String(n).padStart(2, '0');
const todayLocalISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/* "11" (sirf ghanta) ya "23:59" → minutes; khaali → 0 (din shuru hote hi). */
const cutoffMinutes = (v) => {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?/);
  return m ? Number(m[1]) * 60 + Number(m[2] || 0) : 0;
};

/** Is branch ka koi unpaid challan restriction ki hadd paar kar chuka hai? */
async function hasRestrictableChallan(setupRow) {
  const graceDays = Number(setupRow.gracePeriod) || 0;
  const cutoff = cutoffMinutes(setupRow.restrictionCutOff);
  const [ledger, recvs] = await Promise.all([
    getPaymentLedger({ challanType: 'Monthly' }),
    getPaymentReceivings().catch(() => []),
  ]);
  const today = todayLocalISO();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return ledger.some((c) => {
    if (!c.dueDate || c.total <= 0) return false;
    const recv = recvs.find((r) => Number(r.ledgerId) === Number(c.id));
    const received = Math.max(Number(c.credit) || 0, recv ? Number(recv.received) || 0 : 0);
    if (received >= c.total || (recv && recv.remaining <= 0)) return false;   // paid
    const restrictDay = addDaysISO(addDaysISO(c.dueDate, graceDays), 1);
    return today > restrictDay || (today === restrictDay && nowMin >= cutoff);
  });
}

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
    if (mode !== 'full' && mode !== 'read_only') return null;
    return (await hasRestrictableChallan(row)) ? mode : null;
  } catch (e) {
    /* Network / API fail → jo state thi wahi rahe (pehli dafa me: koi rok nahi). */
    return undefined;
  }
}
