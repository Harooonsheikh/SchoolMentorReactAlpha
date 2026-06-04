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
    { reg: '245-00119', name: 'atest Sheikh',     father: 'Abdul Rauf',     route: 'Route 4 — Satellite Town', transport: 1000, dues:  28855, advance: 0, current:     0 },
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
    { reg: '245-00131', name: 'Bilal Ahmed',    father: 'Saeed Ahmed',    route: '',                          transport:   0, dues: 23000, advance:   0, current:     0 },
    { reg: '245-00132', name: 'Zainab Noor',    father: 'Noor Muhammad',  route: 'Route 5',                  transport: 700, dues:     0, advance:   0, current: 24300 },
    { reg: '245-00135', name: 'Hassan Iqbal',   father: 'Iqbal Hussain',  route: 'Route 2 — City Centre',    transport: 600, dues: 12000, advance:   0, current: 24300 },
    { reg: '245-00136', name: 'Sana Javed',     father: 'Javed Akhtar',   route: '',                          transport:   0, dues:     0, advance:   0, current: 23300 },
    { reg: '245-00137', name: 'Bilal Hanif',    father: 'Hanif Ullah',    route: 'Route 1 — Main Road',      transport: 500, dues: 31000, advance:   0, current: 24300 },
    { reg: '245-00138', name: 'Areeba Malik',   father: 'Shahid Malik',   route: 'Route 5',                  transport: 700, dues:     0, advance:   0, current: 24300 },
  ],
  '1A-D': [
    { reg: '245-00140', name: 'Ayesha Noor',    father: 'Noor Hassan',    route: 'Route 1',                  transport: 900, dues: 23200, advance: 0, current:     0 },
    { reg: '245-00141', name: 'Daniyal Khan',   father: 'Asif Khan',      route: 'Route 1',                  transport: 900, dues:     0, advance: 0, current: 23200 },
    { reg: '245-00142', name: 'Iqra Aslam',     father: 'Aslam Pervez',   route: '',                          transport:   0, dues: 14500, advance: 0, current: 22300 },
    { reg: '245-00143', name: 'Talha Saeed',    father: 'Saeed Anwar',    route: 'Route 3 — North',          transport: 800, dues: 38000, advance: 0, current: 23200 },
    { reg: '245-00144', name: 'Nimra Shahid',   father: 'Shahid Mehmood', route: '',                          transport:   0, dues:     0, advance: 300, current: 22300 },
  ],
  '1A-Green': [
    { reg: '245-00150', name: 'Rohaan Sheikh',   father: 'Imran Sheikh',   route: 'Route 2 — City Centre',    transport:  600, dues:     0, advance: 0, current: 22600 },
    { reg: '245-00151', name: 'Eshaal Fatima',   father: 'Wasim Akram',    route: '',                          transport:    0, dues:  9000, advance: 0, current: 22000 },
    { reg: '245-00152', name: 'Abdullah Yousuf', father: 'Yousuf Raza',    route: 'Route 4 — Satellite Town', transport: 1000, dues: 27000, advance: 0, current: 23000 },
    { reg: '245-00153', name: 'Khadija Bano',    father: 'Rashid Mehmood', route: '',                          transport:    0, dues:     0, advance: 0, current: 22000 },
  ],
};

/* Generated challans — set of "classKey|reg|monthIdx" strings.
   Sample: a handful are already generated for May 2026 (monthIdx 4). */
export const mockGeneratedChallans = new Set([
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
        perHead: { 'Tuition Fee': 1000, 'Stationary Charges': 6000, 'Library Charges': 1200, 'Annual Charges': 1800 } },
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
        perHead: { 'Admission Fee': 21000, 'Tuition Fee': 1000, 'Examination Fee': 1500, 'Computer Fee': 800 } },
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
