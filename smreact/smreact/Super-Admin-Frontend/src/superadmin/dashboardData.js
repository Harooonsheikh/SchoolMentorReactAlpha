/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD — shared formatting helper.

   Yahan pehle buildDashboard() tha, jo doosre modules ki DEMO rows
   (statusData / paymentData / etubeData) jama kar ke poora overview
   "banata" tha. Screen kab ki live ja chuki hai —
   GET .../api/AHM_School_Progress/admin_dashboard, mapping
   api/services/dashboard.js me — is liye wo builder sirf demo aankron
   ka zinda source reh gaya tha. Hata diya gaya.

   Ab is file me sirf wo formatter hai jo screen har number par lagati
   hai (1,234 style).
   ═══════════════════════════════════════════════════════════════════ */

export const fmt = (n) => Number(n || 0).toLocaleString('en-US');
