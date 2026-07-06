/* ═══════════════════════════════════════════════════════════════════
   MENTOR AI — demo data + helpers (frontend only)

   Ported verbatim from "Super Admin Support .html". This is mock data
   so the Super Admin Mentor AI screens are fully interactive without a
   backend. The integrating developer should replace `INITIAL_SCHOOLS`
   / `INITIAL_PAYMENTS` with API calls and wire the action handlers
   (plan change, block/unblock, receive payment) to real endpoints.
   ═══════════════════════════════════════════════════════════════════ */

export const planLimits = {
  Basic:   { tokens: 100000,  lessons: 50,  banks: 10,  worksheets: 20,  posts: 10 },
  Pro:     { tokens: 500000,  lessons: 150, banks: 100, worksheets: 150, posts: 50 },
  Premium: { tokens: 1000000, lessons: 250, banks: 200, worksheets: 300, posts: 100 },
};

export const INITIAL_SCHOOLS = [
  { id: 1, school: 'Daffodil Schools',        campus: 'Tarnol Campus',  contact: '03498327846', plan: 'Basic',   used: 42150,  status: 'Active',  due: 'Free',       usage: { tokens: 42150,  lessons: 18,  banks: 4,   worksheets: 7,   posts: 3  } },
  { id: 2, school: 'The Spirit School',       campus: 'Main Campus',    contact: '03001234567', plan: 'Pro',     used: 235000, status: 'Active',  due: '2026-07-15', usage: { tokens: 235000, lessons: 71,  banks: 32,  worksheets: 88,  posts: 24 } },
  { id: 3, school: 'Smart School Talagang',   campus: 'City Campus',    contact: '03114567890', plan: 'Premium', used: 612400, status: 'Active',  due: '2026-08-01', usage: { tokens: 612400, lessons: 142, banks: 120, worksheets: 210, posts: 61 } },
  { id: 4, school: 'Faith Montessori Centre', campus: 'Junior Branch',  contact: '03339876543', plan: 'Basic',   used: 98000,  status: 'Expired', due: '2026-06-05', usage: { tokens: 98000,  lessons: 49,  banks: 10,  worksheets: 19,  posts: 10 } },
  { id: 5, school: 'Concept School',          campus: 'North Campus',   contact: '03215550990', plan: 'Pro',     used: 190000, status: 'Blocked', due: '2026-07-25', usage: { tokens: 190000, lessons: 55,  banks: 20,  worksheets: 64,  posts: 12 } },
  { id: 6, school: 'MPS School System',       campus: 'Main Branch',    contact: '03005551122', plan: 'Premium', used: 740000, status: 'Active',  due: '2026-09-10', usage: { tokens: 740000, lessons: 201, banks: 155, worksheets: 242, posts: 82 } },
];

/* Generate a dummy SVG proof "screenshot" as a data URI. */
export function makeDummyProof(method, amount, ref, date, school) {
  const colors = {
    'Bank Transfer': ['#1E3A8A', '#DBEAFE', 'HBL Bank', 'Account Transfer'],
    'JazzCash':      ['#C2185B', '#FCE4EC', 'JazzCash', 'Mobile Wallet'],
    'EasyPaisa':     ['#2E7D32', '#E8F5E9', 'EasyPaisa', 'Mobile Account'],
    'Cash':          ['#5D4037', '#EFEBE9', 'Cash Receipt', 'Manual Entry'],
    'Cheque':        ['#37474F', '#ECEFF1', 'Cheque', 'Bank Cheque'],
  }[method] || ['#1E3A8A', '#DBEAFE', 'Payment', 'Transfer'];
  const [bg, light, brand, type] = colors;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" font-family="Arial,sans-serif">
  <rect width="360" height="520" fill="#f8fafc" rx="12"/>
  <rect width="360" height="100" fill="${bg}" rx="12"/>
  <rect y="88" width="360" height="12" fill="${bg}"/>
  <text x="180" y="38" text-anchor="middle" fill="white" font-size="18" font-weight="bold">${brand}</text>
  <text x="180" y="60" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="12">${type} Receipt</text>
  <text x="180" y="82" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="10">${date}</text>
  <circle cx="180" cy="130" r="30" fill="${light}" stroke="${bg}" stroke-width="2"/>
  <text x="180" y="138" text-anchor="middle" fill="${bg}" font-size="22">✓</text>
  <text x="180" y="178" text-anchor="middle" fill="${bg}" font-size="14" font-weight="bold">Transaction Successful</text>
  <rect x="40" y="195" width="280" height="70" fill="${light}" rx="10"/>
  <text x="180" y="222" text-anchor="middle" fill="${bg}" font-size="12">Amount Transferred</text>
  <text x="180" y="252" text-anchor="middle" fill="${bg}" font-size="26" font-weight="bold">PKR ${Number(amount).toLocaleString()}</text>
  <line x1="40" y1="285" x2="320" y2="285" stroke="#e2e8f0" stroke-width="1"/>
  <text x="50" y="308" fill="#64748b" font-size="11">Reference No.</text>
  <text x="310" y="308" text-anchor="end" fill="#0f172a" font-size="11" font-weight="bold">${ref}</text>
  <line x1="40" y1="320" x2="320" y2="320" stroke="#f1f5f9" stroke-width="1"/>
  <text x="50" y="343" fill="#64748b" font-size="11">Sender</text>
  <text x="310" y="343" text-anchor="end" fill="#0f172a" font-size="11" font-weight="bold">${String(school).substring(0, 22)}</text>
  <line x1="40" y1="355" x2="320" y2="355" stroke="#f1f5f9" stroke-width="1"/>
  <text x="50" y="378" fill="#64748b" font-size="11">Payment Method</text>
  <text x="310" y="378" text-anchor="end" fill="#0f172a" font-size="11" font-weight="bold">${method}</text>
  <line x1="40" y1="390" x2="320" y2="390" stroke="#f1f5f9" stroke-width="1"/>
  <text x="50" y="413" fill="#64748b" font-size="11">Date &amp; Time</text>
  <text x="310" y="413" text-anchor="end" fill="#0f172a" font-size="11" font-weight="bold">${date} 14:32</text>
  <line x1="40" y1="425" x2="320" y2="425" stroke="#e2e8f0" stroke-width="1.5"/>
  <rect x="40" y="445" width="280" height="36" fill="${bg}" rx="8"/>
  <text x="180" y="468" text-anchor="middle" fill="white" font-size="11" font-weight="bold">School Mentor · Mentor AI Subscription</text>
  <text x="180" y="504" text-anchor="middle" fill="#94a3b8" font-size="9">This is an auto-generated receipt for record purposes.</text>
</svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

export const INITIAL_PAYMENTS = [
  { id: 1001, schoolId: 2, school: 'The Spirit School',     campus: 'Main Campus',  currentPlan: 'Pro',     paymentPlan: 'Pro',     amount: 25000, date: '2026-05-10', method: 'Bank Transfer', receivedBy: 'Admin Tariq',  reference: 'TRX-001923', status: 'Received',             notes: 'Renewal for Q3',        proofUrl: makeDummyProof('Bank Transfer', 25000, 'TRX-001923', '2026-05-10', 'The Spirit School') },
  { id: 1002, schoolId: 3, school: 'Smart School Talagang', campus: 'City Campus',  currentPlan: 'Premium', paymentPlan: 'Premium', amount: 50000, date: '2026-05-18', method: 'JazzCash',      receivedBy: 'Super Admin',  reference: 'JZ-449812',  status: 'Received',             notes: '',                      proofUrl: makeDummyProof('JazzCash', 50000, 'JZ-449812', '2026-05-18', 'Smart School Talagang') },
  { id: 1003, schoolId: 4, school: 'Faith Montessori Centre', campus: 'Junior Branch', currentPlan: 'Basic', paymentPlan: 'Pro',  amount: 20000, date: '2026-06-01', method: 'Cash',          receivedBy: 'Admin Noman',  reference: 'CASH-003',   status: 'Pending Verification', notes: 'Upgrade requested',     proofUrl: '' },
  { id: 1004, schoolId: 5, school: 'Concept School',        campus: 'North Campus', currentPlan: 'Pro',     paymentPlan: 'Pro',     amount: 25000, date: '2026-05-28', method: 'EasyPaisa',     receivedBy: 'Admin Haroon', reference: 'EP-771233',  status: 'Rejected',             notes: 'Transaction not verified', proofUrl: '' },
  { id: 1005, schoolId: 2, school: 'The Spirit School',     campus: 'Main Campus',  currentPlan: 'Pro',     paymentPlan: 'Pro',     amount: 25000, date: '2026-04-12', method: 'JazzCash',      receivedBy: 'Admin Tariq',  reference: 'JZ-334421',  status: 'Received',             notes: 'April renewal',         proofUrl: makeDummyProof('JazzCash', 25000, 'JZ-334421', '2026-04-12', 'The Spirit School') },
  { id: 1006, schoolId: 2, school: 'The Spirit School',     campus: 'Main Campus',  currentPlan: 'Pro',     paymentPlan: 'Pro',     amount: 25000, date: '2026-03-08', method: 'EasyPaisa',     receivedBy: 'Admin Tariq',  reference: 'EP-229001',  status: 'Received',             notes: 'March payment',         proofUrl: makeDummyProof('EasyPaisa', 25000, 'EP-229001', '2026-03-08', 'The Spirit School') },
  { id: 1007, schoolId: 2, school: 'The Spirit School',     campus: 'Main Campus',  currentPlan: 'Pro',     paymentPlan: 'Pro',     amount: 25000, date: '2026-02-15', method: 'Bank Transfer', receivedBy: 'Super Admin',  reference: 'TRX-110034', status: 'Received',             notes: 'Feb payment',           proofUrl: makeDummyProof('Bank Transfer', 25000, 'TRX-110034', '2026-02-15', 'The Spirit School') },
  { id: 1008, schoolId: 6, school: 'MPS School System',     campus: 'Main Branch',  currentPlan: 'Premium', paymentPlan: 'Premium', amount: 50000, date: '2026-05-05', method: 'Cheque',        receivedBy: 'Admin Haroon', reference: 'CHQ-00881',  status: 'Received',             notes: '',                      proofUrl: makeDummyProof('Cheque', 50000, 'CHQ-00881', '2026-05-05', 'MPS School System') },
];

/* ─── Helpers ─── */
export const fmt = (n) => Number(n).toLocaleString('en-US');
export const today = () => new Date().toISOString().slice(0, 10);

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
export function monthLabel(yyyymm) {
  if (!yyyymm) return '—';
  const [y, m] = yyyymm.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

export const PLAN_BADGE = {
  Basic:   { cls: 'b-blue',   icon: 'fa-cube' },
  Pro:     { cls: 'b-blue',   icon: 'fa-cubes' },
  Premium: { cls: 'b-purple', icon: 'fa-crown' },
};

export const STATUS_BADGE = {
  'Active':               { cls: 'b-green', icon: 'fa-circle-check' },
  'Expired':              { cls: 'b-warn',  icon: 'fa-clock' },
  'Blocked':              { cls: 'b-red',   icon: 'fa-ban' },
  'Received':             { cls: 'b-green', icon: 'fa-check' },
  'Pending Verification': { cls: 'b-warn',  icon: 'fa-hourglass-half' },
  'Rejected':             { cls: 'b-red',   icon: 'fa-xmark' },
};

export const ACTION_ICON = {
  Pro: 'fa-arrow-up', Premium: 'fa-crown', Basic: 'fa-arrow-down',
  block: 'fa-ban', unblock: 'fa-lock-open', history: 'fa-clock-rotate-left', usage: 'fa-chart-pie',
};

/* Build the Actions dropdown contents for a school row. */
export function actionsFor(s) {
  if (s.status === 'Blocked')
    return [['unblock', 'Unblock Mentor AI'], ['history', 'View Payment History'], ['usage', 'View Usage Details']];
  if (s.plan === 'Basic')
    return [['Pro', 'Upgrade to Pro'], ['Premium', 'Upgrade to Premium'], ['block', 'Block Mentor AI'], ['history', 'View Payment History'], ['usage', 'View Usage Details']];
  if (s.plan === 'Pro')
    return [['Premium', 'Upgrade to Premium'], ['Basic', 'Downgrade to Basic'], ['block', 'Block Mentor AI'], ['history', 'View Payment History'], ['usage', 'View Usage Details']];
  return [['Pro', 'Downgrade to Pro'], ['Basic', 'Downgrade to Basic'], ['block', 'Block Mentor AI'], ['history', 'View Payment History'], ['usage', 'View Usage Details']];
}
