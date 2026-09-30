/* Fee module mock data — filled incrementally as each screen is built. */

export const mockFeeClasses = [
  { key: '1A-B',     cls: 'Class 1A', sec: 'B',       strength: 12 },
  { key: '1A-C',     cls: 'Class 1A', sec: 'C',       strength: 7  },
  { key: '1A-D',     cls: 'Class 1A', sec: 'D',       strength: 5  },
  { key: '1A-Green', cls: 'Class 1A', sec: 'Green f', strength: 4  },
];

/* Fee heads per class — { [classKey]: [{ name, amt }] } */
export const mockFeeHeads = {
  '1A-B': [
    { name: 'Admission Fee',       amt: 21000 },
    { name: 'Tuition Fee',         amt: 1000  },
    { name: 'Stationary Charges',  amt: 6000  },
    { name: 'Library Charges',     amt: 1200  },
    { name: 'Annual Charges',      amt: 2000  },
    { name: 'Examination Fee',     amt: 1550  },
  ],
  '1A-C': [
    { name: 'Admission Fee',  amt: 21000 },
    { name: 'Tuition Fee',    amt: 1000  },
    { name: 'Examination Fee', amt: 1500 },
    { name: 'Computer Fee',   amt: 800   },
  ],
  '1A-D': [
    { name: 'Admission Fee', amt: 21000 },
    { name: 'Tuition Fee',   amt: 1000  },
    { name: 'Lab Fee',       amt: 1200  },
  ],
  '1A-Green': [
    { name: 'Admission Fee', amt: 21000 },
    { name: 'Tuition Fee',   amt: 1000  },
  ],
};

/* Per-class student roster — used by Transport Fee Setup AND Fee Challans.
   Shape: { [classKey]: [{ reg, name, father, route, transport, dues, advance, current }] }
   - dues:    outstanding balance carried over from prior months
   - advance: credit applied against next month's challan
   - current: this month's challan fee (sum of fee heads for the class) */
export const mockTransportFee = {
  '1A-B': [
    { reg: '245-00119', name: 'atest Sheikh',     father: 'Abdul Rauf',     route: 'Route 4 — Satellite Town', transport: 1000, dues:  28855, advance: 65500, current:     0 },
    { reg: '245-00121', name: 'CDy YDy',          father: 'Cc',             route: 'Route 2 — City Centre',    transport:  600, dues: 172200, advance: 0, current: 21500 },
    { reg: '245-00122', name: 'D',                father: 'Dd',             route: 'Route 1 — Main Road',      transport:  500, dues: 215000, advance: 0, current: 22500 },
    { reg: '245-00123', name: 'E',                father: 'Ee',             route: '',                          transport:    0, dues:  72000, advance: 0, current: 22000 },
    { reg: '245-00124', name: 'F',                father: 'Ff',             route: 'Route 3 — North',          transport:  800, dues:  98010, advance: 0, current: 22000 },
    { reg: '245-00125', name: 'G',                father: 'Gg',             route: '',                          transport:    0, dues: 221210, advance: 0, current: 22000 },
    { reg: '245-00126', name: 'Ahmed Raza',       father: 'Muhammad Raza',  route: 'Route 1 — Main Road',      transport:  500, dues:      0, advance: 0, current: 31550 },
    { reg: '245-00127', name: 'Fatima Zahra',     father: 'Tariq Mehmood',  route: '',                          transport:    0, dues:      0, advance: 1200, current: 31550 },
    { reg: '245-00128', name: 'Usman Ali',        father: 'Liaqat Ali',     route: 'Route 4 — Satellite Town', transport: 1000, dues:  18000, advance: 0, current: 31550 },
    { reg: '245-00129', name: 'Ayesha Siddiqui',  father: 'Kamran Siddiqui', route: 'Route 2 — City Centre',    transport:  600, dues:      0, advance: 0, current: 31550 },
    { reg: '245-00133', name: 'Hamza Tariq',      father: 'Tariq Jameel',   route: '',                          transport:    0, dues:  46000, advance: 0, current: 30550 },
    { reg: '245-00134', name: 'Maryam Bibi',      father: 'Saleem Akhtar',  route: 'Route 3 — North',          transport:  800, dues:      0, advance: 0, current: 31550 },
  ],
  '1A-C': [
    { reg: '245-00130', name: 'Hira Khan',      father: 'Imran Khan',     route: 'Route 5',                  transport: 700, dues: 24000, advance: 500, current: 22300 },
    { reg: '245-00131', name: 'Bilal Ahmed',    father: 'Saeed Ahmed',    route: '',                          transport:   0, dues: 23000, advance: 72900, current:     0 },
    { reg: '245-00132', name: 'Zainab Noor',    father: 'Noor Muhammad',  route: 'Route 5',                  transport: 700, dues:     0, advance:   0, current: 24300 },
    { reg: '245-00135', name: 'Hassan Iqbal',   father: 'Iqbal Hussain',  route: 'Route 2 — City Centre',    transport: 600, dues: 12000, advance:   0, current: 24300 },
    { reg: '245-00136', name: 'Sana Javed',     father: 'Javed Akhtar',   route: '',                          transport:   0, dues:     0, advance:   0, current: 23300 },
    { reg: '245-00137', name: 'Bilal Hanif',    father: 'Hanif Ullah',    route: 'Route 1 — Main Road',      transport: 500, dues: 31000, advance:   0, current: 24300 },
    { reg: '245-00138', name: 'Areeba Malik',   father: 'Shahid Malik',   route: 'Route 5',                  transport: 700, dues:     0, advance:   0, current: 24300 },
  ],
  '1A-D': [
    { reg: '245-00140', name: 'Ayesha Noor',    father: 'Noor Hassan',    route: 'Route 1',                  transport: 900, dues: 23200, advance: 92800, current:     0 },
    { reg: '245-00141', name: 'Daniyal Khan',   father: 'Asif Khan',      route: 'Route 1',                  transport: 900, dues:     0, advance: 0, current: 23200 },
    { reg: '245-00142', name: 'Iqra Aslam',     father: 'Aslam Pervez',   route: '',                          transport:   0, dues: 14500, advance: 0, current: 22300 },
    { reg: '245-00143', name: 'Talha Saeed',    father: 'Saeed Anwar',    route: 'Route 3 — North',          transport: 800, dues: 38000, advance: 0, current: 23200 },
    { reg: '245-00144', name: 'Nimra Shahid',   father: 'Shahid Mehmood', route: '',                          transport:   0, dues:     0, advance: 300, current: 22300 },
  ],
  '1A-Green': [
    { reg: '245-00150', name: 'Rohaan Sheikh',   father: 'Imran Sheikh',   route: 'Route 2 — City Centre',    transport:  600, dues:     0, advance: 0, current: 22600 },
    { reg: '245-00151', name: 'Eshaal Fatima',   father: 'Wasim Akram',    route: '',                          transport:    0, dues:  9000, advance: 110000, current: 22000 },
    { reg: '245-00152', name: 'Abdullah Yousuf', father: 'Yousuf Raza',    route: 'Route 4 — Satellite Town', transport: 1000, dues: 27000, advance: 0, current: 23000 },
    { reg: '245-00153', name: 'Khadija Bano',    father: 'Rashid Mehmood', route: '',                          transport:    0, dues:     0, advance: 0, current: 22000 },
  ],
};

/* Generated challans — set of "classKey|reg|monthIdx" strings.
   Sample: a handful are already generated for May 2026 (monthIdx 4).
   '1A-B|245-00119|4' generated on purpose (was seeded with a large
   advance:65500 but never flagged generated, so Available Advance
   Balance / Adjust From Advance Balance in Fee Receiving never had a
   generated challan to show against) — this is the FIRST student row
   in the FIRST class, so it's the fastest way to see and verify that
   card/checkbox: Fee Receiving → Individual → Class 1A (B) → first
   row → Fee Receive. */
export const mockGeneratedChallans = new Set([
  '1A-B|245-00119|4',
  '1A-B|245-00121|4', '1A-B|245-00126|4', '1A-B|245-00127|4', '1A-B|245-00128|4',
  '1A-B|245-00129|4', '1A-B|245-00134|4',
  '1A-C|245-00130|4', '1A-C|245-00132|4', '1A-C|245-00135|4', '1A-C|245-00136|4',
  '1A-D|245-00141|4', '1A-D|245-00142|4', '1A-D|245-00144|4',
  '1A-Green|245-00150|4', '1A-Green|245-00151|4', '1A-Green|245-00153|4',
]);

export const mockFeeSettings = {
  showDiscount: true,
  showPsd:      true,
  fineEnabled:  true,
  fineType:     'fixed',
  fineAmt:      100,
  /* Default print size for challans + receiving slips: 'a4' (full page,
     3-copy / multi-column) or 'thermal' (80mm receipt printer). The
     Download picker can still override this on a per-action basis. */
  printSize:    'a4',
  /* Fee Settings — master feature toggles, all default ON (current
     Fee Module behavior). See feeService.js's saveReceipt/generateChallan/
     generatePartialChallan for where each is actually enforced, not
     just displayed. */
  multipleReceiving:       true, // OFF: at most 1 installment per challan
  advancePaymentReceiving: true, // OFF: no new/consumed advance balance
  futureMonthChallan:      true, // OFF: no challan generation beyond the current month
  psidInstallments:        true, // OFF: Generate Partial Payment Challan (OneLink/PSID) unavailable
};

/* Families — used by the Family Tree Challans sub-segment.
   Each child is a roll-up of fee + transport - discount, independent of
   the per-class fee head structure (a family combines siblings across
   classes into a single guardian challan). */
export const mockFamilies = [
  {
    key: 'fam1', name: 'Family 1', guardian: 'Aslam Kathia',
    children: [
      { reg: '12345-001',     name: 'Anam Kathia',   father: 'Aslam Kathia', cls: 'IV',     sec: 'A', fee: 18500, transport:   0, discount:     0, dues: 18500, advance: 0 },
      { reg: '245-00104-ABC', name: 'Abdul Qayyum',  father: 'Qayyum Khan',  cls: 'II-Pre', sec: 'A', fee: 14900, transport: 900, discount: 11000, dues:   500, advance: 0 },
    ],
  },
  {
    key: 'fam2', name: 'Family 2', guardian: 'Tariq Mehmood',
    children: [
      { reg: '245-00200', name: 'Sara Tariq',   father: 'Tariq Mehmood', cls: 'III', sec: 'B', fee: 20000, transport: 600, discount:    0, dues: 20600, advance: 0 },
      { reg: '245-00201', name: 'Hamza Tariq',  father: 'Tariq Mehmood', cls: 'I',   sec: 'A', fee: 19000, transport: 600, discount: 1000, dues: 18600, advance: 0 },
    ],
  },
  {
    key: 'fam3', name: 'Family 3', guardian: 'Imran Sheikh',
    children: [
      { reg: '245-00150', name: 'Rohaan Sheikh',  father: 'Imran Sheikh', cls: '1A', sec: 'Green f', fee: 22000, transport:  600, discount: 0, dues:    0, advance: 0 },
      { reg: '245-00301', name: 'Aiza Sheikh',    father: 'Imran Sheikh', cls: 'II', sec: 'B',       fee: 19500, transport:    0, discount: 0, dues: 5000, advance: 0 },
      { reg: '245-00302', name: 'Hadi Sheikh',    father: 'Imran Sheikh', cls: 'PG', sec: 'A',       fee: 12500, transport:  500, discount: 0, dues:    0, advance: 500 },
    ],
  },
];

/* Generated family challans — Set of "famKey|reg|monthIdx" strings.
   A few are pre-generated for May 2026 to demo the status badge. */
export const mockGeneratedFamilyChallans = new Set([
  'fam1|12345-001|4',
  'fam3|245-00150|4', 'fam3|245-00301|4',
]);

export const mockChallans   = [];

/* OneLink Partial Payment Challans — temporary, PSID-bearing challans a
   parent can pay for LESS than a student's full remaining balance for
   the month, generated from Fee ▸ Fee Challans' "Generate Partial
   Payment Challan" action. Completely separate from the regular
   monthly challan (mockFeeHeads + mockGeneratedChallans, this app's
   only real challan source of truth) — generating one never touches
   either. Multiple partial challans can exist for the same
   {classKey, reg, monthIdx} across separate parent visits (see
   feeService.getChallanSummary/generatePartialChallan/
   deletePartialChallan). Payment status (`status`) is read-only from
   the frontend — it only ever flips to 'paid' via a real OneLink
   payment callback/reconciliation process, never a manual UI action.
   Shape: { id, psid, classKey, reg, monthIdx, originalChallanId,
   amount, status: 'pending' | 'paid', generatedAt, paidAt }. */
export const mockPartialChallans = [];

/* Approved student-specific fee discounts — one row per (classKey, reg,
   head) combination. Populated only by feeService.applyApprovedDiscount()
   once a Super Admin approves a Fee > Discount Manager request (see
   src/services/approvalsService.js); a pending request does NOT touch
   this array, so a discount only becomes visible after approval + a
   remount/refetch of the Challans list. */
export const mockFeeDiscounts = [
  /* Ahmed Raza (1A-B) — full waiver on every head → shows as a Free Student. */
  { classKey: '1A-B', reg: '245-00126', head: 'Admission Fee',      amount: 21000 },
  { classKey: '1A-B', reg: '245-00126', head: 'Tuition Fee',        amount: 1000  },
  { classKey: '1A-B', reg: '245-00126', head: 'Stationary Charges', amount: 6000  },
  { classKey: '1A-B', reg: '245-00126', head: 'Library Charges',    amount: 1200  },
  { classKey: '1A-B', reg: '245-00126', head: 'Annual Charges',     amount: 2000  },
  { classKey: '1A-B', reg: '245-00126', head: 'Examination Fee',    amount: 1550  },
  /* Usman Ali (1A-B) — partial discount across two heads. */
  { classKey: '1A-B', reg: '245-00128', head: 'Tuition Fee',    amount: 500 },
  { classKey: '1A-B', reg: '245-00128', head: 'Annual Charges', amount: 500 },
  /* Maryam Bibi (1A-B) — single fee-head discount. */
  { classKey: '1A-B', reg: '245-00134', head: 'Admission Fee', amount: 5000 },
  /* Hassan Iqbal (1A-C) — partial discount across two heads. */
  { classKey: '1A-C', reg: '245-00135', head: 'Tuition Fee',     amount: 300 },
  { classKey: '1A-C', reg: '245-00135', head: 'Computer Fee',    amount: 200 },
  /* Talha Saeed (1A-D) — full waiver on every head → shows as a Free Student. */
  { classKey: '1A-D', reg: '245-00143', head: 'Admission Fee', amount: 21000 },
  { classKey: '1A-D', reg: '245-00143', head: 'Tuition Fee',   amount: 1000  },
  { classKey: '1A-D', reg: '245-00143', head: 'Lab Fee',       amount: 1200  },
];

/* Fee receipts — per-student per-month payment ledger.
   shape: { classKey, reg, monthIdx, payments: [{ id, date, method, ref, txn,
   amount, perHead, source }] }
   A few sample receipts pre-seeded for May 2026 (monthIdx 4) so the
   Receiving tab opens with realistic Paid / Partial / Pending states. */
export const mockReceipts = [
  {
    classKey: '1A-B', reg: '245-00121', monthIdx: 4,
    payments: [
      { id: 'rcv-1', date: '2026-05-04', time: '10:42', method: 'Cash',          ref: 'CH-2026-051',  txn: '', amount: 10000, source: 'counter', by: 'Front Desk · Hira Khan',
        perHead: { 'Tuition Fee': 1000, 'Stationary Charges': 6000, 'Library Charges': 1200, 'Annual Charges': 1800 },
        /* Manual discount given AT RECEIVING TIME (Fee Analytics dashboard
           card 5 "Discount Given During Receiving") — separate from any
           approved challan-level discount in mockFeeDiscounts. */
        discPerHead: { 'Admission Fee': 12000 },
        /* Late-payment fine actually collected with this installment —
           demo data for the Fee Reports → Fine Collection Report.
           Kept out of `amount`/`perHead` on purpose, same as a real
           fine entered via FeeReceivingModal's "Fine Collected" field. */
        fine: 200 },
    ],
  },
  {
    /* Bank-pull payment via 1Link — protected from manual deletion. */
    classKey: '1A-B', reg: '245-00126', monthIdx: 4,
    payments: [
      { id: 'rcv-2', date: '2026-05-05', time: '15:18', method: 'Bank Transfer', ref: '', txn: 'TXN-99812', amount: 31550, source: 'onelink', by: 'OneLink / Bank',
        perHead: { 'Admission Fee': 21000, 'Tuition Fee': 1000, 'Stationary Charges': 6000, 'Library Charges': 1200, 'Annual Charges': 2000, 'Examination Fee':   350 } },
    ],
  },
  {
    /* 1Link / bank-pull payment — demonstrates the OneLink badge. */
    classKey: '1A-C', reg: '245-00132', monthIdx: 4,
    payments: [
      { id: 'rcv-3', date: '2026-05-06', time: '09:27', method: 'Online / App',  ref: '', txn: 'EP-3399',   amount: 24300, source: 'onelink', by: 'OneLink / Bank',
        perHead: { 'Admission Fee': 21000, 'Tuition Fee': 1000, 'Examination Fee': 1500, 'Computer Fee': 800 },
        discPerHead: { 'Admission Fee': 5000 } },
    ],
  },
  {
    /* Second receiving-time discount — Tuition Fee waived at the counter. */
    classKey: '1A-D', reg: '245-00141', monthIdx: 4,
    payments: [
      { id: 'rcv-4', date: '2026-05-07', time: '11:15', method: 'Cash', ref: 'CH-2026-052', txn: '', amount: 23100, source: 'counter', by: 'Front Desk · Bilal Chaudhry',
        perHead: { 'Admission Fee': 21000, 'Lab Fee': 1200, 'Transport Fee': 900 },
        discPerHead: { 'Tuition Fee': 1000 },
        /* Fine Collection Report demo data — paid after the due date. */
        fine: 500 },
    ],
  },

  /* ── Advance Payments Received demo rows (Fee Analytics dashboard
     card 6) — each student paid MORE than this month's actual payable,
     so the excess shows up as a carried-forward "Future Adjustment
     Balance" instead of reducing Pending Fee. ── */
  {
    classKey: '1A-B', reg: '245-00127', monthIdx: 4,
    payments: [
      /* Payable = 32,750 (heads) − 1,200 (existing static advance credit) = 31,550. Paid 39,550 → 8,000 advance. */
      { id: 'rcv-5', date: '2026-05-08', time: '10:05', method: 'Cash', ref: 'CH-2026-053', txn: '', amount: 39550, source: 'counter', by: 'Front Desk · Hira Khan',
        perHead: { 'Admission Fee': 21000, 'Tuition Fee': 1000, 'Stationary Charges': 6000, 'Library Charges': 1200, 'Annual Charges': 2000, 'Examination Fee': 1550, 'Advance': 6800 } },
    ],
  },
  {
    classKey: '1A-B', reg: '245-00128', monthIdx: 4,
    payments: [
      /* Payable = 33,750 (heads incl. transport) − 1,000 (approved discount) = 32,750. Paid 42,750 → 10,000 advance. */
      { id: 'rcv-6', date: '2026-05-08', time: '14:30', method: 'Bank Transfer', ref: '', txn: 'TXN-99920', amount: 42750, source: 'onelink', by: 'OneLink / Bank',
        perHead: { 'Admission Fee': 21000, 'Tuition Fee': 500, 'Stationary Charges': 6000, 'Library Charges': 1200, 'Annual Charges': 1500, 'Examination Fee': 1550, 'Transport Fee': 1000, 'Advance': 10000 } },
    ],
  },
  {
    classKey: '1A-C', reg: '245-00135', monthIdx: 4,
    payments: [
      /* Payable = 12,000 (dues) + 24,900 (heads incl. transport) − 500 (approved discount) = 36,400. Paid 41,400 → 5,000 advance. */
      { id: 'rcv-7', date: '2026-05-09', time: '09:50', method: 'Cash', ref: 'CH-2026-054', txn: '', amount: 41400, source: 'counter', by: 'Front Desk · Bilal Chaudhry',
        perHead: { 'Previous Dues': 12000, 'Admission Fee': 21000, 'Tuition Fee': 700, 'Examination Fee': 1500, 'Computer Fee': 800, 'Transport Fee': 600, 'Advance': 4800 },
        /* Fine Collection Report demo data — paid after the due date. */
        fine: 300 },
    ],
  },

  /* ── Today's (2026-09-17) fee receiving — demo data for the "Daily
     Receiving Report" (Fee Dashboard → Fee Received card), so its
     default date (today) has real transactions to show instead of the
     empty state. Ordinary recurring monthly fee payments (no admission
     fee), spread across 4 classes and both counter/OneLink sources. ── */
  {
    classKey: '1A-B', reg: '245-00129', monthIdx: 8,
    payments: [
      { id: 'rcv-8', date: '2026-09-17', time: '09:15', method: 'Cash', ref: 'CH-2026-070', txn: '', amount: 2200, source: 'counter', by: 'Front Desk · Hira Khan',
        perHead: { 'Tuition Fee': 1000, 'Library Charges': 1200 } },
    ],
  },
  {
    classKey: '1A-B', reg: '245-00133', monthIdx: 8,
    payments: [
      { id: 'rcv-9', date: '2026-09-17', time: '09:40', method: 'Cash', ref: 'CH-2026-071', txn: '', amount: 3000, source: 'counter', by: 'Front Desk · Bilal Chaudhry',
        perHead: { 'Tuition Fee': 1000, 'Annual Charges': 2000 } },
    ],
  },
  {
    classKey: '1A-B', reg: '245-00134', monthIdx: 8,
    payments: [
      { id: 'rcv-10', date: '2026-09-17', time: '10:10', method: 'Bank Transfer', ref: '', txn: 'TXN-10045', amount: 6000, source: 'onelink', by: 'OneLink / Bank',
        perHead: { 'Stationary Charges': 6000 } },
    ],
  },
  {
    classKey: '1A-C', reg: '245-00130', monthIdx: 8,
    payments: [
      { id: 'rcv-11', date: '2026-09-17', time: '10:35', method: 'Cash', ref: 'CH-2026-072', txn: '', amount: 2500, source: 'counter', by: 'Front Desk · Hira Khan',
        perHead: { 'Tuition Fee': 1000, 'Examination Fee': 1500 } },
    ],
  },
  {
    classKey: '1A-C', reg: '245-00131', monthIdx: 8,
    payments: [
      { id: 'rcv-12', date: '2026-09-17', time: '11:00', method: 'Cash', ref: 'CH-2026-073', txn: '', amount: 1800, source: 'counter', by: 'Front Desk · Bilal Chaudhry',
        perHead: { 'Tuition Fee': 1000, 'Computer Fee': 800 } },
    ],
  },
  {
    classKey: '1A-C', reg: '245-00136', monthIdx: 8,
    payments: [
      { id: 'rcv-13', date: '2026-09-17', time: '11:25', method: 'Online / App', ref: '', txn: 'EP-5521', amount: 1500, source: 'onelink', by: 'OneLink / Bank',
        perHead: { 'Examination Fee': 1500 } },
    ],
  },
  {
    classKey: '1A-D', reg: '245-00140', monthIdx: 8,
    payments: [
      { id: 'rcv-14', date: '2026-09-17', time: '11:50', method: 'Cash', ref: 'CH-2026-074', txn: '', amount: 2200, source: 'counter', by: 'Front Desk · Hira Khan',
        perHead: { 'Tuition Fee': 1000, 'Lab Fee': 1200 } },
    ],
  },
  {
    classKey: '1A-D', reg: '245-00142', monthIdx: 8,
    payments: [
      { id: 'rcv-15', date: '2026-09-17', time: '12:20', method: 'Card', ref: 'CH-2026-076', txn: '', amount: 1200, source: 'counter', by: 'Front Desk · Bilal Chaudhry',
        perHead: { 'Lab Fee': 1200 } },
    ],
  },
  {
    classKey: '1A-Green', reg: '245-00151', monthIdx: 8,
    payments: [
      { id: 'rcv-16', date: '2026-09-17', time: '12:50', method: 'Bank Transfer', ref: '', txn: 'TXN-10098', amount: 1000, source: 'onelink', by: 'OneLink / Bank',
        perHead: { 'Tuition Fee': 1000 } },
    ],
  },
  {
    classKey: '1A-Green', reg: '245-00152', monthIdx: 8,
    payments: [
      { id: 'rcv-17', date: '2026-09-17', time: '13:15', method: 'Cheque', ref: 'CH-2026-075', txn: '', amount: 1000, source: 'counter', by: 'Front Desk · Hira Khan',
        perHead: { 'Tuition Fee': 1000 } },
    ],
  },
];

/* Family-receipt ledger — same shape as mockReceipts, keyed by family.
   shape: { famKey, reg, monthIdx, payments:[...] } */
export const mockFamilyReceipts = [
  {
    famKey: 'fam1', reg: '12345-001', monthIdx: 4,
    payments: [
      { id: 'frcv-1', date: '2026-05-04', time: '11:53', method: 'Cash', ref: '', txn: '', amount: 8000, source: 'counter',
        perHead: { 'Tuition Fee': 7500, 'Previous Dues': 500 } },
    ],
  },
  {
    /* OneLink demo — protected from manual deletion. */
    famKey: 'fam3', reg: '245-00150', monthIdx: 4,
    payments: [
      { id: 'frcv-2', date: '2026-05-05', time: '16:42', method: 'Online / App', ref: '', txn: 'EP-7711', amount: 22600, source: 'onelink',
        perHead: { 'Tuition Fee': 22000, 'Transport Fees': 600 } },
    ],
  },
];

export const mockFeeHistory = [];

/* ═══════════════════════════════════════════════════════════════════
   ADVANCE FEE LEDGER — real transaction history behind the single
   `student.advance` running balance on mockTransportFee. Two event
   types:
   - 'received': advance credited (either backfilled below for a
     pre-existing seed balance, or a genuine overpayment recorded live
     by feeService.saveReceipt when Fee Receiving's Pay Now exceeds
     what's owed for a head — see the "+advance" tag already shown
     there).
   - 'adjusted': advance auto-consumed by feeService.generateChallan
     against a newly generated challan.
   Same "the exported binding IS the database" mutable-array
   convention as mockReceipts/mockFeeDiscounts elsewhere in this file.
   Shape: { id, classKey, reg, type, amount, date, note } */
export const mockAdvanceLedger = [];

/* Backfill: every mockTransportFee student who already has advance > 0
   in the seed data gets one 'received' entry dated before the Fee
   module's own working period (2026-05 onward, per mockReceipts) —
   this documents where their existing balance came from instead of it
   appearing with no source, without inventing any new balances. */
let seedAdvanceLedgerId = 1;
Object.entries(mockTransportFee).forEach(([classKey, students]) => {
  students.forEach(s => {
    if (+s.advance > 0) {
      mockAdvanceLedger.push({
        id: `adv-seed-${seedAdvanceLedgerId++}`,
        classKey, reg: s.reg, type: 'received', amount: +s.advance,
        date: '2026-04-01', note: 'Opening advance balance',
      });
    }
  });
});

/* Demo scenarios: these 4 students already have a challan marked
   generated for monthIdx 4 (see mockGeneratedChallans above) — so,
   consistent with the business rule feeService.generateChallan()
   applies live, that generation is treated as having already
   auto-adjusted their advance, same amount/date shape a real
   generation would produce. This gives the Advance Fee Adjustment
   Report real example data covering full consumption (adjusted ===
   opening, remaining 0) and partial consumption (remaining > 0)
   without requiring a fresh Generate Challan click first. monthlyFee
   for each is the real sum of that class's Fee Heads + transport,
   same formula used everywhere else advance is adjusted. */
[
  { classKey: '1A-B',     reg: '245-00127', monthlyFee: 32750 }, // fully consumed: 1,200 advance, 1,200 adjusted, 0 remaining
  { classKey: '1A-C',     reg: '245-00130', monthlyFee: 25000 }, // fully consumed: 500 advance, 500 adjusted, 0 remaining
  { classKey: '1A-D',     reg: '245-00144', monthlyFee: 23200 }, // fully consumed: 300 advance, 300 adjusted, 0 remaining
  { classKey: '1A-Green', reg: '245-00151', monthlyFee: 22000 }, // partial: 110,000 advance, 22,000 adjusted, 88,000 remaining
].forEach(({ classKey, reg, monthlyFee }) => {
  const student = (mockTransportFee[classKey] || []).find(x => x.reg === reg);
  if (!student) return;
  const advance = +student.advance || 0;
  const adjusted = Math.min(advance, monthlyFee);
  if (adjusted <= 0) return;
  student.advance = advance - adjusted;
  mockAdvanceLedger.push({
    id: `adv-seed-${seedAdvanceLedgerId++}`,
    classKey, reg, type: 'adjusted', amount: adjusted,
    date: '2026-05-01', note: 'May 2026 Challan',
  });
});

/* Transport vehicles — simple fleet roster for the Transport Fee Setup
   "Vehicles" sub-tab. A vehicle can be assigned to many students via
   the student transport record's `vehicleId` (see mockTransportFee —
   existing rows intentionally omit this field so pre-existing records
   stay valid with "no vehicle assigned").
   Shape: [{ id, name, regNo, route }] */
export const mockVehicles = [
  { id: 'veh-1', name: 'Bus 1 — Hino AK1J',     regNo: 'LEA-4021', route: 'Route 1 — Main Road' },
  { id: 'veh-2', name: 'Bus 2 — Hino AK1J',      regNo: 'LEA-4022', route: 'Route 2 — City Centre' },
  { id: 'veh-3', name: 'Van 1 — Toyota Hiace',   regNo: 'LED-9981', route: 'Route 3 — North' },
];
