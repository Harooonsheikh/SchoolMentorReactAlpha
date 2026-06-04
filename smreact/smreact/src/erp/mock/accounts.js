/* Accounts module mock data — filled incrementally as each screen is built.
   Mirrors the HTML reference shape (acc-types with nested heads). */

export const mockAccTypes = [
  {
    key: 'exp', name: 'Expenses', icon: 'fa-arrow-trend-down', cls: 'exp',
    heads: [
      { no: 202, name: 'Stationery & Office Supplies',  desc: 'Day-to-day stationery, registers, printer cartridges and consumables.' },
      { no: 203, name: 'Building rent upper',           desc: 'Upper portion building rent (monthly).' },
      { no: 204, name: 'Plumber',                       desc: 'Routine plumbing maintenance and emergency repairs.' },
      { no: 205, name: 'Electricity Bill',              desc: 'Utility bill paid to the distribution company every month.' },
      { no: 206, name: 'Salary Payment',                desc: 'Monthly salary disbursement for teaching + non-teaching staff.' },
      { no: 207, name: 'Generator Fuel',                desc: 'Diesel for the backup generator during load-shedding.' },
      { no: 208, name: 'Examination Materials',         desc: 'Answer sheets, exam stationery and printing of question papers.' },
      { no: 209, name: 'Transport Fuel',                desc: 'Diesel / petrol for school vans on routes.' },
    ],
  },
  {
    key: 'rev', name: 'Revenue', icon: 'fa-arrow-trend-up', cls: 'rev',
    heads: [
      { no: 219, name: 'Fee Payment',     desc: 'Monthly tuition + transport fee collected from students.' },
      { no: 220, name: 'Admission Fee',   desc: 'One-time admission fee charged at the time of enrolment.' },
      { no: 221, name: 'Canteen Rent',    desc: 'Monthly rent received from the canteen contractor.' },
    ],
  },
];

/* Next-head counter — keeps subsequent head numbers monotonically
   increasing across both types. */
export const mockAccNextHeadNo = 222;

/* Transactions — keyed by 'rev' / 'exp' segments. Each entry carries an
   audit trail (createdBy, createdAt, optional updatedBy/updatedAt) so the
   row's audit-detail panel can show full provenance. */
export const mockAccTxns = {
  rev: [
    /* ─── January 2026 ─── */
    { id: 'r-jan-1', headNo: 219, head: 'Fee Payment',   date: '2026-01-06', month: '2026-01', detail: 'Monthly fee collection — Primary section (Jan)',         amount: 412000, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-01-06T10:15:00', updatedBy: null,         updatedAt: null },
    { id: 'r-jan-2', headNo: 219, head: 'Fee Payment',   date: '2026-01-14', month: '2026-01', detail: 'Monthly fee collection — Middle section (Jan)',          amount: 285000, chqNo: '',          chqDate: '',          createdBy: 'Front Desk', createdAt: '2026-01-14T13:30:00', updatedBy: null,         updatedAt: null },
    { id: 'r-jan-3', headNo: 220, head: 'Admission Fee', date: '2026-01-20', month: '2026-01', detail: 'New admissions — 4 students Grade 2-5',                  amount:  60000, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-01-20T09:45:00', updatedBy: null,         updatedAt: null },
    { id: 'r-jan-4', headNo: 221, head: 'Canteen Rent',  date: '2026-01-28', month: '2026-01', detail: 'Canteen rent — January',                                  amount:  25000, chqNo: 'CHQ-90112',  chqDate: '2026-01-28', createdBy: 'Ali Khan',   createdAt: '2026-01-28T15:00:00', updatedBy: null,         updatedAt: null },

    /* ─── February 2026 ─── */
    { id: 'r-feb-1', headNo: 219, head: 'Fee Payment',   date: '2026-02-05', month: '2026-02', detail: 'Monthly fee collection — Primary section (Feb)',         amount: 425000, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-02-05T10:20:00', updatedBy: null,         updatedAt: null },
    { id: 'r-feb-2', headNo: 219, head: 'Fee Payment',   date: '2026-02-12', month: '2026-02', detail: 'Monthly fee collection — Middle section (Feb)',          amount: 298000, chqNo: '',          chqDate: '',          createdBy: 'Front Desk', createdAt: '2026-02-12T13:10:00', updatedBy: null,         updatedAt: null },
    { id: 'r-feb-3', headNo: 220, head: 'Admission Fee', date: '2026-02-22', month: '2026-02', detail: 'Transfer admission — Grade 8 (2 students)',              amount:  40000, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-02-22T10:30:00', updatedBy: null,         updatedAt: null },
    { id: 'r-feb-4', headNo: 221, head: 'Canteen Rent',  date: '2026-02-26', month: '2026-02', detail: 'Canteen rent — February',                                 amount:  25000, chqNo: 'CHQ-90245',  chqDate: '2026-02-26', createdBy: 'Ali Khan',   createdAt: '2026-02-26T14:40:00', updatedBy: null,         updatedAt: null },

    /* ─── March 2026 ─── */
    { id: 'r-mar-1', headNo: 219, head: 'Fee Payment',   date: '2026-03-04', month: '2026-03', detail: 'Monthly fee collection — Primary section (Mar)',         amount: 438000, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-03-04T10:00:00', updatedBy: null,         updatedAt: null },
    { id: 'r-mar-2', headNo: 219, head: 'Fee Payment',   date: '2026-03-11', month: '2026-03', detail: 'Monthly fee collection — Middle + Senior (Mar)',         amount: 512000, chqNo: '',          chqDate: '',          createdBy: 'Front Desk', createdAt: '2026-03-11T13:20:00', updatedBy: 'Sana Malik', updatedAt: '2026-03-13T09:15:00' },
    { id: 'r-mar-3', headNo: 220, head: 'Admission Fee', date: '2026-03-18', month: '2026-03', detail: 'Mid-session admissions (3 students)',                    amount:  45000, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-03-18T11:05:00', updatedBy: null,         updatedAt: null },
    { id: 'r-mar-4', headNo: 221, head: 'Canteen Rent',  date: '2026-03-27', month: '2026-03', detail: 'Canteen rent — March',                                    amount:  25000, chqNo: 'CHQ-90378',  chqDate: '2026-03-27', createdBy: 'Ali Khan',   createdAt: '2026-03-27T14:55:00', updatedBy: null,         updatedAt: null },

    /* ─── April 2026 ─── */
    { id: 'r-apr-1', headNo: 219, head: 'Fee Payment',   date: '2026-04-03', month: '2026-04', detail: 'Monthly fee collection — Primary section (Apr)',         amount: 448000, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-04-03T10:10:00', updatedBy: null,         updatedAt: null },
    { id: 'r-apr-2', headNo: 219, head: 'Fee Payment',   date: '2026-04-10', month: '2026-04', detail: 'Monthly fee collection — Middle + Senior (Apr)',         amount: 528000, chqNo: '',          chqDate: '',          createdBy: 'Front Desk', createdAt: '2026-04-10T13:40:00', updatedBy: null,         updatedAt: null },
    { id: 'r-apr-3', headNo: 220, head: 'Admission Fee', date: '2026-04-15', month: '2026-04', detail: 'New admissions — Grade 1 (5 students)',                   amount:  75000, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-04-15T09:25:00', updatedBy: null,         updatedAt: null },
    { id: 'r-apr-4', headNo: 221, head: 'Canteen Rent',  date: '2026-04-28', month: '2026-04', detail: 'Canteen rent — April',                                    amount:  25000, chqNo: 'CHQ-90495',  chqDate: '2026-04-28', createdBy: 'Ali Khan',   createdAt: '2026-04-28T15:10:00', updatedBy: null,         updatedAt: null },

    /* ─── May 2026 ─── */
    { id: 'r1', headNo: 219, head: 'Fee Payment',  date: '2026-05-06', month: '2026-05', detail: 'Fee Paid of Amount: 193700 out of 193700 with Discount of 1100.0 by CDy YDy — Class: 1A',     amount: 193700, chqNo: '',        chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-05-06T10:24:00', updatedBy: null,         updatedAt: null },
    { id: 'r2', headNo: 219, head: 'Fee Payment',  date: '2026-05-07', month: '2026-05', detail: 'Fee Paid of Amount: 27800 out of 40000 with Discount of 0.0 by Ali Khan — Class: III',         amount:  27800, chqNo: '',        chqDate: '',          createdBy: 'Front Desk', createdAt: '2026-05-07T13:45:00', updatedBy: 'Sana Malik', updatedAt: '2026-05-09T09:12:00' },
    { id: 'r3', headNo: 219, head: 'Fee Payment',  date: '2026-05-08', month: '2026-05', detail: 'Fee Paid of Amount: 221420 out of 221420 with Discount of 0.0 by Ahmed Raza — Class: 1A',      amount: 221420, chqNo: '',        chqDate: '',          createdBy: 'Ali Khan',   createdAt: '2026-05-08T08:55:00', updatedBy: null,         updatedAt: null },
    { id: 'r4', headNo: 219, head: 'Fee Payment',  date: '2026-05-08', month: '2026-05', detail: 'Fee Paid of Amount: 6500 out of 21940 with Discount of 1012.0 by Test 2 — Class: Ahmad Testing', amount:   6500, chqNo: '',        chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-05-08T15:20:00', updatedBy: null,         updatedAt: null },
    { id: 'r5', headNo: 220, head: 'Admission Fee', date: '2026-05-10', month: '2026-05', detail: 'New admission — Grade 3 (Maryam Khan)',                                                          amount:  15000, chqNo: '',        chqDate: '',          createdBy: 'Front Desk', createdAt: '2026-05-10T11:05:00', updatedBy: null,         updatedAt: null },
    { id: 'r6', headNo: 221, head: 'Canteen Rent', date: '2026-05-12', month: '2026-05', detail: 'Monthly canteen rent — Bismillah Caterers',                                                       amount:  25000, chqNo: 'CHQ-91827', chqDate: '2026-05-12', createdBy: 'Sana Malik', createdAt: '2026-05-12T14:30:00', updatedBy: null,         updatedAt: null },
  ],
  exp: [
    /* ─── January 2026 ─── */
    { id: 'e-jan-1', headNo: 206, head: 'Salary Payment',       date: '2026-01-03', month: '2026-01', detail: 'Monthly salary — teaching staff (Jan)',          amount: 180000, chqNo: 'CHQ-43101', chqDate: '2026-01-03', createdBy: 'Ali Khan',   createdAt: '2026-01-03T11:00:00', updatedBy: null, updatedAt: null },
    { id: 'e-jan-2', headNo: 203, head: 'Building rent upper', date: '2026-01-05', month: '2026-01', detail: 'Upper portion building rent for January',          amount:  45000, chqNo: 'CHQ-43115', chqDate: '2026-01-05', createdBy: 'Front Desk', createdAt: '2026-01-05T09:20:00', updatedBy: null, updatedAt: null },
    { id: 'e-jan-3', headNo: 205, head: 'Electricity Bill',     date: '2026-01-15', month: '2026-01', detail: 'WAPDA bill — January',                            amount:  38500, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-01-15T14:50:00', updatedBy: null, updatedAt: null },
    { id: 'e-jan-4', headNo: 202, head: 'Stationery & Office Supplies', date: '2026-01-22', month: '2026-01', detail: 'Office stationery — Q1 stock',           amount:  12500, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-01-22T13:30:00', updatedBy: null, updatedAt: null },

    /* ─── February 2026 ─── */
    { id: 'e-feb-1', headNo: 206, head: 'Salary Payment',       date: '2026-02-03', month: '2026-02', detail: 'Monthly salary — teaching staff (Feb)',          amount: 182000, chqNo: 'CHQ-43210', chqDate: '2026-02-03', createdBy: 'Ali Khan',   createdAt: '2026-02-03T11:05:00', updatedBy: null, updatedAt: null },
    { id: 'e-feb-2', headNo: 203, head: 'Building rent upper', date: '2026-02-05', month: '2026-02', detail: 'Upper portion building rent for February',         amount:  45000, chqNo: 'CHQ-43225', chqDate: '2026-02-05', createdBy: 'Front Desk', createdAt: '2026-02-05T09:25:00', updatedBy: null, updatedAt: null },
    { id: 'e-feb-3', headNo: 205, head: 'Electricity Bill',     date: '2026-02-16', month: '2026-02', detail: 'WAPDA bill — February',                          amount:  41200, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-02-16T14:30:00', updatedBy: null, updatedAt: null },
    { id: 'e-feb-4', headNo: 204, head: 'Plumber',              date: '2026-02-19', month: '2026-02', detail: 'Plumbing repair — rooftop tank',                  amount:   8500, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-02-19T16:00:00', updatedBy: null, updatedAt: null },

    /* ─── March 2026 ─── */
    { id: 'e-mar-1', headNo: 206, head: 'Salary Payment',       date: '2026-03-03', month: '2026-03', detail: 'Monthly salary — teaching staff (Mar)',          amount: 184000, chqNo: 'CHQ-43320', chqDate: '2026-03-03', createdBy: 'Ali Khan',   createdAt: '2026-03-03T11:00:00', updatedBy: null, updatedAt: null },
    { id: 'e-mar-2', headNo: 203, head: 'Building rent upper', date: '2026-03-05', month: '2026-03', detail: 'Upper portion building rent for March',           amount:  45000, chqNo: 'CHQ-43335', chqDate: '2026-03-05', createdBy: 'Front Desk', createdAt: '2026-03-05T09:30:00', updatedBy: null, updatedAt: null },
    { id: 'e-mar-3', headNo: 205, head: 'Electricity Bill',     date: '2026-03-16', month: '2026-03', detail: 'WAPDA bill — March',                             amount:  46800, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-03-16T14:35:00', updatedBy: null, updatedAt: null },
    { id: 'e-mar-4', headNo: 207, head: 'Generator Fuel',       date: '2026-03-20', month: '2026-03', detail: 'Diesel — backup generator (180 L)',              amount:  38000, chqNo: '',          chqDate: '',          createdBy: 'Front Desk', createdAt: '2026-03-20T08:45:00', updatedBy: null, updatedAt: null },

    /* ─── April 2026 ─── */
    { id: 'e-apr-1', headNo: 206, head: 'Salary Payment',       date: '2026-04-03', month: '2026-04', detail: 'Monthly salary — teaching staff (Apr)',          amount: 185000, chqNo: 'CHQ-43420', chqDate: '2026-04-03', createdBy: 'Ali Khan',   createdAt: '2026-04-03T11:10:00', updatedBy: null, updatedAt: null },
    { id: 'e-apr-2', headNo: 203, head: 'Building rent upper', date: '2026-04-05', month: '2026-04', detail: 'Upper portion building rent for April',           amount:  45000, chqNo: 'CHQ-43435', chqDate: '2026-04-05', createdBy: 'Front Desk', createdAt: '2026-04-05T09:30:00', updatedBy: null, updatedAt: null },
    { id: 'e-apr-3', headNo: 205, head: 'Electricity Bill',     date: '2026-04-16', month: '2026-04', detail: 'WAPDA bill — April',                             amount:  52500, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-04-16T14:40:00', updatedBy: null, updatedAt: null },
    { id: 'e-apr-4', headNo: 202, head: 'Stationery & Office Supplies', date: '2026-04-24', month: '2026-04', detail: 'Office stationery + exam stationery',    amount:  18500, chqNo: 'CHQ-43488', chqDate: '2026-04-24', createdBy: 'Sana Malik', createdAt: '2026-04-24T13:45:00', updatedBy: null, updatedAt: null },

    /* ─── May 2026 ─── */
    { id: 'e1', headNo: 206, head: 'Salary Payment',      date: '2026-05-03', month: '2026-05', detail: 'Monthly salary disbursement — teaching staff', amount: 185000, chqNo: 'CHQ-44120', chqDate: '2026-05-03', createdBy: 'Ali Khan',   createdAt: '2026-05-03T11:10:00', updatedBy: null,         updatedAt: null },
    { id: 'e2', headNo: 203, head: 'Building rent upper', date: '2026-05-05', month: '2026-05', detail: 'Upper portion building rent for May',          amount:  45000, chqNo: 'CHQ-44135', chqDate: '2026-05-05', createdBy: 'Front Desk', createdAt: '2026-05-05T09:30:00', updatedBy: 'Ali Khan',   updatedAt: '2026-05-06T14:02:00' },
    { id: 'e3', headNo: 204, head: 'Plumber',             date: '2026-05-09', month: '2026-05', detail: 'Plumbing repair — ground floor washrooms',     amount:   6500, chqNo: '',          chqDate: '',          createdBy: 'Sana Malik', createdAt: '2026-05-09T16:45:00', updatedBy: null,         updatedAt: null },
    { id: 'e4', headNo: 207, head: 'Generator Fuel',      date: '2026-05-14', month: '2026-05', detail: 'Diesel — backup generator (200 L)',            amount:  42000, chqNo: '',          chqDate: '',          createdBy: 'Front Desk', createdAt: '2026-05-14T08:20:00', updatedBy: null,         updatedAt: null },
    { id: 'e5', headNo: 202, head: 'Stationery & Office Supplies', date: '2026-05-18', month: '2026-05', detail: 'Office stationery & printer cartridges', amount: 14500, chqNo: 'CHQ-44210', chqDate: '2026-05-18', createdBy: 'Sana Malik', createdAt: '2026-05-18T13:55:00', updatedBy: null,         updatedAt: null },
  ],
};

export const mockAccUsers       = ['Sana Malik', 'Ali Khan', 'Front Desk', 'Online Portal'];
export const mockAccCurrentUser = 'Sana Malik';

/* School identity reused by voucher slip + report headers */
export const mockAccSchool = {
  name:     'The Oxford System, Lahore Campus',
  monogram: 'OS',
};

/* Account Books — running ledgers with suppliers/vendors/owners.
   Each book carries an `opening` balance, an `openDate`, a `type`
   (payable / receivable), an `includeInCash` flag, and a list of
   transactions (received / returned / adjustment). */
export const mockAccBooks = [
  {
    id: 'bk1', name: 'Owner / Investor Account', party: 'Mr. Muaz (Owner)',
    desc: 'Operational funding contributed by the school owner. Cash is physically held by the school.',
    type: 'payable', opening: 300000, openDate: '2026-01-10', status: 'active',
    includeInCash: true, createdBy: 'Sana Malik',
    txns: [
      { id: 'bt1', type: 'returned', amount:  60000, date: '2026-02-05', notes: 'Repaid to owner — installment 1',                 enteredBy: 'Sana Malik', at: '2026-02-05T11:20:00', attachments: [] },
      { id: 'bt2', type: 'received', amount: 100000, date: '2026-03-18', notes: 'Further contribution for new branch setup',       enteredBy: 'Sana Malik', at: '2026-03-18T09:45:00', attachments: [] },
      { id: 'bt3', type: 'returned', amount:  40000, date: '2026-04-22', notes: 'Repaid to owner — installment 2',                 enteredBy: 'Ali Khan',   at: '2026-04-22T15:10:00', attachments: [] },
    ],
  },
  {
    id: 'bk2', name: 'Crescent Uniforms — Supplier', party: 'Crescent Uniforms & Tailors',
    desc: 'Running payable account with the school uniform supplier. Uniforms bought on credit, paid in installments.',
    type: 'payable', opening: 0, openDate: '2026-02-12', status: 'active',
    includeInCash: false, createdBy: 'Front Desk',
    txns: [
      { id: 'bt10', type: 'received', amount: 120000, date: '2026-02-12', notes: 'Summer uniforms purchased on credit (120 sets + 40 sports kits)', enteredBy: 'Front Desk', at: '2026-02-12T10:30:00', attachments: [] },
      { id: 'bt11', type: 'returned', amount:  60000, date: '2026-04-18', notes: 'Part payment to supplier — bank transfer',                       enteredBy: 'Sana Malik', at: '2026-04-18T13:05:00', attachments: [] },
      { id: 'bt12', type: 'received', amount:  35000, date: '2026-05-06', notes: 'Winter uniforms purchased on credit',                            enteredBy: 'Front Desk', at: '2026-05-06T12:00:00', attachments: [] },
    ],
  },
  {
    id: 'bk3', name: 'Ilm Books & Stationers — Supplier', party: 'Ilm Books & Stationers (Pvt) Ltd',
    desc: 'Main textbook and workbook supplier. Goods purchased on credit through the year and settled in partial payments.',
    type: 'payable', opening: 0, openDate: '2026-03-05', status: 'active',
    includeInCash: false, createdBy: 'Sana Malik',
    txns: [
      { id: 'bt20', type: 'received',   amount: 180000, date: '2026-03-05', notes: 'Textbooks Grade 1-5 (500) + workbooks (300) on credit', enteredBy: 'Sana Malik', at: '2026-03-05T09:15:00', attachments: [] },
      { id: 'bt21', type: 'returned',   amount:  50000, date: '2026-03-20', notes: 'Partial payment — cheque #44120',                      enteredBy: 'Ali Khan',   at: '2026-03-20T14:40:00', attachments: [] },
      { id: 'bt22', type: 'received',   amount:  42000, date: '2026-04-02', notes: 'Additional reference books on credit',                 enteredBy: 'Sana Malik', at: '2026-04-02T11:00:00', attachments: [] },
      { id: 'bt23', type: 'returned',   amount:  80000, date: '2026-04-15', notes: 'Partial payment — bank transfer',                     enteredBy: 'Sana Malik', at: '2026-04-15T10:25:00', attachments: [] },
      { id: 'bt24', type: 'received',   amount:  28000, date: '2026-04-28', notes: 'Exam stationery & answer sheets on credit',           enteredBy: 'Front Desk', at: '2026-04-28T16:10:00', attachments: [] },
      { id: 'bt25', type: 'returned',   amount:  30000, date: '2026-05-08', notes: 'Partial payment — cash',                              enteredBy: 'Ali Khan',   at: '2026-05-08T09:50:00', attachments: [] },
      { id: 'bt26', type: 'adjustment', amount:  -5000, date: '2026-05-12', notes: 'Discount adjustment for damaged stock returned',      enteredBy: 'Sana Malik', at: '2026-05-12T13:30:00', attachments: [] },
      { id: 'bt27', type: 'received',   amount:  15000, date: '2026-05-18', notes: 'Library books purchased on credit',                   enteredBy: 'Front Desk', at: '2026-05-18T11:45:00', attachments: [] },
      { id: 'bt28', type: 'returned',   amount:  40000, date: '2026-05-22', notes: 'Partial payment — pending balance carried forward',   enteredBy: 'Sana Malik', at: '2026-05-22T15:00:00', attachments: [] },
    ],
  },
  {
    id: 'bk4', name: 'Al-Madina Stationery — Vendor', party: 'Al-Madina Stationery Mart',
    desc: 'Day-to-day office and classroom stationery supplier.',
    type: 'payable', opening: 0, openDate: '2026-04-10', status: 'settled',
    includeInCash: false, createdBy: 'Front Desk',
    txns: [
      { id: 'bt40', type: 'received', amount: 18000, date: '2026-04-10', notes: 'Office stationery & registers on credit', enteredBy: 'Front Desk', at: '2026-04-10T10:00:00', attachments: [] },
      { id: 'bt41', type: 'returned', amount: 18000, date: '2026-05-02', notes: 'Full payment — cash, account cleared',    enteredBy: 'Sana Malik', at: '2026-05-02T12:30:00', attachments: [] },
    ],
  },
  {
    id: 'bk5', name: 'Canteen Contractor — Receivable', party: 'Bismillah Caterers',
    desc: 'Monthly canteen rent receivable from the canteen contractor.',
    type: 'receivable', opening: 50000, openDate: '2026-03-01', status: 'active',
    includeInCash: false, createdBy: 'Sana Malik',
    txns: [
      { id: 'bt50', type: 'returned', amount: 25000, date: '2026-04-05', notes: 'Rent received for March', enteredBy: 'Sana Malik', at: '2026-04-05T10:15:00', attachments: [] },
    ],
  },
];
