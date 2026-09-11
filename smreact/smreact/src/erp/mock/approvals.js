/* Approvals mock data.

   Single generic ApprovalRequest store — one shape for every workflow
   (Fee discount, Fee challan delete, Accounts entry edit/delete, HR
   deduction waiver, Inventory price edit/product delete) rather than a
   table per module. Module-level mutable array (mirrors mockAccTxns'
   pattern) so requests survive across tab/module remounts within a
   session. */

/* Demo "current user" for requests raised from any module — same
   single-actor convention already used by mockAccCurrentUser
   (accounts.js) and mockInvCurrentUser (inventory.js), so requests
   created from those modules line up with the same name here. */
export const mockApprovalCurrentUser = 'Sana Malik';

export const APPROVAL_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVOKED:  'revoked',
};

export const APPROVAL_ACTION_TYPES = {
  FEE_DISCOUNT:             'fee_discount',
  FEE_DELETE_CHALLAN:       'fee_delete_challan',
  FEE_HEADS_UPDATE:         'fee_heads_update',
  ACCOUNTS_EDIT_ENTRY:      'accounts_edit_entry',
  ACCOUNTS_DELETE_ENTRY:    'accounts_delete_entry',
  HR_DEDUCTION_WAIVER:      'hr_deduction_waiver',
  HR_BONUS_AWARD:           'hr_bonus_award',
  HR_SALARY_UPDATE:         'hr_salary_update',
  HR_LEAVE_UPDATE:          'hr_leave_update',
  HR_LOAN_APPROVAL:         'hr_loan_approval',
  INVENTORY_PRICE_EDIT:     'inventory_price_edit',
  INVENTORY_DELETE_PRODUCT: 'inventory_delete_product',
  STUDENTS_MARK_INACTIVE:   'students_mark_inactive',
  STUDENTS_DISCOUNT:        'students_discount',
  STUDENTS_DUES_DISCOUNT:   'students_dues_discount',
};

/* Display metadata per action type — drives the Approvals page's
   module/action columns and filters without hardcoding labels there. */
export const APPROVAL_ACTION_META = {
  fee_discount:             { label: 'Fee Discount',             module: 'Fee',             icon: 'fa-percent' },
  fee_delete_challan:       { label: 'Delete Fee Challan',       module: 'Fee',             icon: 'fa-file-invoice' },
  fee_heads_update:         { label: 'Fee Heads Update',         module: 'Fee',             icon: 'fa-list-ul' },
  accounts_edit_entry:      { label: 'Edit Accounts Entry',      module: 'Accounts',        icon: 'fa-pen' },
  accounts_delete_entry:    { label: 'Delete Accounts Entry',    module: 'Accounts',        icon: 'fa-trash' },
  hr_deduction_waiver:      { label: 'Payroll Deduction Waiver', module: 'Human Resource',  icon: 'fa-hand-holding-dollar' },
  hr_bonus_award:           { label: 'Payroll Bonus Award',      module: 'Human Resource',  icon: 'fa-gift' },
  hr_salary_update:         { label: 'Salary Details Update',    module: 'Human Resource',  icon: 'fa-money-bill-wave' },
  hr_leave_update:          { label: 'Leave Policy Update',      module: 'Human Resource',  icon: 'fa-plane-departure' },
  hr_loan_approval:         { label: 'Employee Loan Approval',   module: 'Human Resource',  icon: 'fa-sack-dollar' },
  inventory_price_edit:     { label: 'Inventory Price Edit',     module: 'Inventory',       icon: 'fa-tag' },
  inventory_delete_product: { label: 'Delete Inventory Product', module: 'Inventory',       icon: 'fa-box-open' },
  students_mark_inactive:   { label: 'Mark Student Inactive',    module: 'Students',        icon: 'fa-user-slash' },
  students_discount:        { label: 'Student Fee Discount',     module: 'Students',        icon: 'fa-percent' },
  students_dues_discount:   { label: 'Dues Settlement Discount', module: 'Students',        icon: 'fa-hand-holding-dollar' },
};

/* Configurable Approvals behaviour — edited from Settings → Approval
   Settings (master on/off + per-action-type toggles) and User
   Permissions → Approval Authority (which role reviews requests).
   `enabled: false` turns the ENTIRE gating mechanism off everywhere —
   every module's gated action falls back to applying directly, same
   as before Approvals existed. `actionTypeEnabled[actionType] = false`
   turns off gating for just that one action; missing keys default to
   enabled (see approvalsService.isActionEnabled). `approverRoleId:
   null` means "no explicit choice yet" — resolveApprover() falls back
   to whoever holds the Super Admin role. */
export const mockApprovalSettings = {
  enabled: true,
  approverRoleId: null,
  actionTypeEnabled: {
    fee_discount: true,
    fee_delete_challan: true,
    fee_heads_update: true,
    accounts_edit_entry: true,
    accounts_delete_entry: true,
    hr_deduction_waiver: true,
    hr_bonus_award: true,
    hr_salary_update: true,
    hr_leave_update: true,
    hr_loan_approval: true,
    inventory_price_edit: true,
    inventory_delete_product: true,
    students_mark_inactive: true,
    students_discount: true,
    students_dues_discount: true,
  },
};

/* Seeded so the Approvals page + KPI strip aren't empty on first load,
   AND so every status (pending/approved/rejected/revoked) has at least
   one example on both sides — the requester's ("My Requests", all
   authored by mockApprovalCurrentUser so that tab shows all four
   scenarios) and the approver's (Pending Approvals / History, authored
   by other staff) — plus one example per action type across all four
   modules. */
export const mockApprovalRequests = [
  {
    id: 'AR-0001',
    actionType: 'fee_discount',
    module: 'Fee',
    actionLabel: 'Fee Discount',
    entityId: '245-00119',
    entitySummary: 'atest Sheikh — Class 1A (B) — Rs. 200 discount on Tuition Fee',
    requestedBy: 'Sana Malik',
    requestedAt: '2026-08-25T10:15:00',
    status: 'pending',
    requestComment: 'Merit-based discount approved verbally by Principal.',
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: '',
    payload: { classKey: '1A-B', reg: '245-00119', cls: 'Class 1A', sec: 'B', perHead: { 'Tuition Fee': 200 } },
    before: null,
  },
  {
    id: 'AR-0002',
    actionType: 'fee_delete_challan',
    module: 'Fee',
    actionLabel: 'Delete Fee Challan',
    entityId: '245-00119-0',
    entitySummary: 'atest Sheikh — Class 1A (B) — January challan',
    requestedBy: 'Zara Hussain',
    requestedAt: '2026-08-18T11:20:00',
    status: 'approved',
    requestComment: 'Challan generated twice by mistake for the same month.',
    reviewedBy: 'Dr. Islahudin',
    reviewedAt: '2026-08-18T15:00:00',
    reviewComment: 'Confirmed duplicate — approved.',
    payload: { classKey: '1A-B', reg: '245-00119', monthIdx: 0 },
    before: { name: 'atest Sheikh', cls: 'Class 1A', sec: 'B', month: 'January', year: 2026, amount: 23000 },
  },
  {
    id: 'AR-0003',
    actionType: 'fee_heads_update',
    module: 'Fee',
    actionLabel: 'Fee Heads Update',
    entityId: '1A-C',
    entitySummary: 'Class 1A (C) — 4 fee head(s) updated',
    requestedBy: 'Sana Malik',
    requestedAt: '2026-08-15T09:40:00',
    status: 'rejected',
    requestComment: 'Tuition Fee needs a small increase this term.',
    reviewedBy: 'Dr. Islahudin',
    reviewedAt: '2026-08-15T13:10:00',
    reviewComment: 'Hold current fee structure till next academic session.',
    payload: {
      classKey: '1A-C',
      heads: [
        { name: 'Admission Fee', amt: 21000 },
        { name: 'Tuition Fee', amt: 1200 },
        { name: 'Examination Fee', amt: 1500 },
        { name: 'Computer Fee', amt: 800 },
      ],
    },
    before: {
      classKey: '1A-C',
      heads: [
        { name: 'Admission Fee', amt: 21000 },
        { name: 'Tuition Fee', amt: 1000 },
        { name: 'Examination Fee', amt: 1500 },
        { name: 'Computer Fee', amt: 800 },
      ],
    },
  },
  {
    id: 'AR-0004',
    actionType: 'accounts_edit_entry',
    module: 'Accounts',
    actionLabel: 'Edit Accounts Entry',
    entityId: 'e-jan-4',
    entitySummary: 'Stationery & Office Supplies — Rs. 12,500 → Rs. 13,500 (22 Jan 2026)',
    requestedBy: 'Kashif Ali',
    requestedAt: '2026-08-26T14:05:00',
    status: 'pending',
    requestComment: 'Second batch of stationery was billed under the same entry.',
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: '',
    payload: { seg: 'exp', id: 'e-jan-4', headNo: 202, head: 'Stationery & Office Supplies', date: '2026-01-22', month: '2026-01', detail: 'Office stationery — Q1 stock (corrected)', amount: 13500, chqNo: '', chqDate: '', updatedBy: 'Kashif Ali' },
    before: { id: 'e-jan-4', headNo: 202, head: 'Stationery & Office Supplies', date: '2026-01-22', month: '2026-01', detail: 'Office stationery — Q1 stock', amount: 12500, chqNo: '', chqDate: '' },
  },
  {
    id: 'AR-0005',
    actionType: 'accounts_delete_entry',
    module: 'Accounts',
    actionLabel: 'Delete Accounts Entry',
    entityId: 'e-jan-2',
    entitySummary: 'Building rent upper — Rs. 45,000 (05 Jan 2026)',
    requestedBy: 'Sana Malik',
    requestedAt: '2026-08-20T09:30:00',
    status: 'approved',
    requestComment: 'Duplicate entry, posted twice by mistake.',
    reviewedBy: 'Dr. Islahudin',
    reviewedAt: '2026-08-20T14:05:00',
    reviewComment: 'Confirmed duplicate — approved.',
    payload: { seg: 'exp', id: 'e-jan-2' },
    before: { seg: 'exp', id: 'e-jan-2', head: 'Building rent upper', amount: 45000, date: '2026-01-05' },
  },
  {
    id: 'AR-0006',
    actionType: 'hr_deduction_waiver',
    module: 'Human Resource',
    actionLabel: 'Payroll Deduction Waiver',
    entityId: '1-2026-04-fineDeduct',
    entitySummary: 'Dr. Islahudin — Fine Deduction — Rs. 500 waived',
    requestedBy: 'Sana Malik',
    requestedAt: '2026-08-12T10:00:00',
    status: 'revoked',
    requestComment: 'Late report was due to a system outage, requesting waiver.',
    reviewedBy: 'Sana Malik',
    reviewedAt: '2026-08-13T09:15:00',
    reviewComment: 'Revoked by requester',
    payload: { empId: 1, monthKey: '2026-04', head: 'Fine Deduction', amount: 500, newAmount: 0 },
    before: { fineDeduct: 500, fineComment: 'Late report submission' },
  },
  {
    id: 'AR-0007',
    actionType: 'hr_bonus_award',
    module: 'Human Resource',
    actionLabel: 'Payroll Bonus Award',
    entityId: '1-2026-06-bonus',
    entitySummary: 'Dr. Islahudin — PKR 5,000 bonus for June 2026',
    requestedBy: 'Zara Hussain',
    requestedAt: '2026-08-24T16:30:00',
    status: 'pending',
    requestComment: 'Performance bonus for successful annual inspection.',
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: '',
    payload: { empId: 1, monthKey: '2026-06', amount: 5000 },
    before: { empId: 1, monthKey: '2026-06', amount: 0 },
  },
  {
    id: 'AR-0008',
    actionType: 'inventory_price_edit',
    module: 'Inventory',
    actionLabel: 'Inventory Price Edit',
    entityId: 2,
    entitySummary: 'School Diary — Rs. 150 → Rs. 130',
    requestedBy: 'Kashif Ali',
    requestedAt: '2026-08-22T11:00:00',
    status: 'rejected',
    requestComment: 'Vendor cost dropped, wants to pass on the saving.',
    reviewedBy: 'Dr. Islahudin',
    reviewedAt: '2026-08-22T16:40:00',
    reviewComment: 'Hold current pricing till term-end stock clears.',
    payload: { productId: 2, field: 'price', newValue: 130 },
    before: { productId: 2, field: 'price', oldValue: 150 },
  },
  {
    id: 'AR-0009',
    actionType: 'inventory_delete_product',
    module: 'Inventory',
    actionLabel: 'Delete Inventory Product',
    entityId: 7,
    entitySummary: 'Eraser — Stationery',
    requestedBy: 'Zara Hussain',
    requestedAt: '2026-08-10T12:00:00',
    status: 'revoked',
    requestComment: 'Discontinuing this SKU, replacing with a bulk pack.',
    reviewedBy: 'Zara Hussain',
    reviewedAt: '2026-08-10T15:45:00',
    reviewComment: 'Revoked by requester',
    payload: { productId: 7 },
    before: { id: 7, name: 'Eraser', cat: 'Stationery', barcode: 'ST-ERS-007', stock: 5, low: 30, cost: 5, price: 15, img: null },
  },
];
