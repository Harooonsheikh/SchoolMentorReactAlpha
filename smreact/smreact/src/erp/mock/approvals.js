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
  STUDENTS_PREENROLL_ADMISSION: 'students_preenroll_admission',
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
  students_preenroll_admission: { label: 'Pre-Enrollment Admission', module: 'Students', icon: 'fa-user-graduate' },
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
    students_preenroll_admission: true,
  },
};

/* Seeded so the Approvals page + KPI strip aren't empty on first load,
   AND so every one of the 16 action types has a COMPLETE-DETAIL example
   in every relevant tab: at least one Pending Approvals example and one
   History example (approved, and rejected for the one workflow — Pre-
   Enrollment Admission — where rejection is itself a distinct outcome
   worth showing), per type. Every request here is authored by
   mockApprovalCurrentUser, so the same seeds also populate "My
   Requests" — one screen a developer can open to see every workflow in
   every state without hunting through each module. entityId/payload/
   before shapes below match exactly what each module's real
   applyApproved* handler expects (see
   src/services/{fee,accounts,hr,inventory,student,preEnrollment}Service.js),
   using real ids from each module's own mock data so approving/
   rejecting a seed request actually applies a correct, visible change. */
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
    payload: {
      classKey: '1A-B', reg: '245-00119', cls: 'Class 1A', sec: 'B',
      'Current Discount': {},
      'Requested Discount': { 'Tuition Fee': 200 },
    },
    before: null,
  },
  {
    id: 'AR-0002',
    actionType: 'fee_delete_challan',
    module: 'Fee',
    actionLabel: 'Delete Fee Challan',
    entityId: '245-00119-0',
    entitySummary: 'atest Sheikh — Class 1A (B) — January challan',
    requestedBy: 'Sana Malik',
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
    requestedBy: 'Sana Malik',
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
    requestedBy: 'Sana Malik',
    requestedAt: '2026-08-24T16:30:00',
    status: 'pending',
    requestComment: 'Performance bonus for successful annual inspection.',
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: '',
    payload: {
      empId: 1, monthKey: '2026-06', amount: 5000,
      'Employee': { Name: 'Dr. Islahudin', Designation: 'Principal', Department: 'Administration' },
      'Bonus': { Month: 'June 2026', 'Requested Amount': 'PKR 5,000' },
    },
    before: { empId: 1, monthKey: '2026-06', 'Previous Bonus This Month': 'PKR 0' },
  },
  {
    id: 'AR-0008',
    actionType: 'inventory_price_edit',
    module: 'Inventory',
    actionLabel: 'Inventory Price Edit',
    entityId: 2,
    entitySummary: 'School Diary — Rs. 150 → Rs. 130',
    requestedBy: 'Sana Malik',
    requestedAt: '2026-08-22T11:00:00',
    status: 'rejected',
    requestComment: 'Vendor cost dropped, wants to pass on the saving.',
    reviewedBy: 'Dr. Islahudin',
    reviewedAt: '2026-08-22T16:40:00',
    reviewComment: 'Hold current pricing till term-end stock clears.',
    payload: {
      productId: 2, field: 'price', newValue: 130,
      'Product': { Name: 'School Diary', Category: 'Stationery', Barcode: 'ST-DRY-002', 'Cost Price': 90, 'Current Stock': 140 },
    },
    before: { productId: 2, field: 'price', oldValue: 150 },
  },
  {
    id: 'AR-0009',
    actionType: 'inventory_delete_product',
    module: 'Inventory',
    actionLabel: 'Delete Inventory Product',
    entityId: 7,
    entitySummary: 'Eraser — Stationery',
    requestedBy: 'Sana Malik',
    requestedAt: '2026-08-10T12:00:00',
    status: 'revoked',
    requestComment: 'Discontinuing this SKU, replacing with a bulk pack.',
    reviewedBy: 'Sana Malik',
    reviewedAt: '2026-08-10T15:45:00',
    reviewComment: 'Revoked by requester',
    payload: { productId: 7 },
    before: { id: 7, name: 'Eraser', cat: 'Stationery', barcode: 'ST-ERS-007', stock: 5, low: 30, cost: 5, price: 15, img: null },
  },
  {
    id: 'AR-0010',
    actionType: 'students_preenroll_admission',
    module: 'Students',
    actionLabel: 'Pre-Enrollment Admission',
    entityId: 'PRE-2026-0002',
    entitySummary: 'Zara Malik — Nursery (B) — admission and fee setup pending review',
    requestedBy: 'Sana Malik',
    requestedAt: '2026-08-27T09:20:00',
    status: 'pending',
    requestComment: '',
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: '',
    /* Keys whose value is a plain object or an array of plain objects
       render as their own titled section/table in Approvals.jsx's
       ApprovalDetailModal (GroupCard) — matches the shape
       PreEnrolledStudents' handleSendForApproval builds in
       Students.jsx, so this seed stays a realistic stand-in for a
       freshly-raised request. */
    payload: {
      preId: 'PRE-2026-0002',
      'Student Details': {
        'Pre-Enrollment ID': 'PRE-2026-0002',
        'Student Name': 'Zara Malik',
        'Gender': 'Female',
        'Date of Birth': '20 June 2021',
        'B-Form / CNIC': '35202-2345678-2',
        'Nationality': 'Pakistani',
        'Class': 'Nursery (B)',
        'Previous School': '—',
        'Previous Grade': '—',
      },
      'Parent / Guardian Details': {
        'Father Name': 'Kashif Malik',
        'Father CNIC': '35202-8765432-1',
        'Father Occupation': 'Engineer',
        'Father / Mobile Contact': '0301-2345678',
        'Mother Name': 'Sana Malik',
        'Mother CNIC': '35202-8765432-2',
        'Guardian Name': '—',
        'Guardian Contact': '—',
        'Email': 'kashif.malik@example.com',
        'Address': 'House 45, DHA Phase 3, Lahore',
      },
      'Recurring Fee Structure': [
        { 'Fee Head': 'Tuition Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 5,500', 'Discount': 'Rs. 500', 'Net Payable': 'Rs. 5,000' },
        { 'Fee Head': 'Computer Lab Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 500', 'Discount': '—', 'Net Payable': 'Rs. 500' },
        { 'Fee Head': 'Sports Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 400', 'Discount': '—', 'Net Payable': 'Rs. 400' },
        { 'Fee Head': 'Library Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 200', 'Discount': '—', 'Net Payable': 'Rs. 200' },
        { 'Fee Head': 'Transport Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 3,000', 'Discount': '—', 'Net Payable': 'Rs. 3,000' },
      ],
      'Fee Summary': {
        'Net Payable per Month (after discount)': 'Rs. 9,100',
        'Discount / Fee Category': 'Tuition Fee: Rs. 500',
      },
      'One-Time Admission Challan': {
        'Challan Heads': 'Not generated yet',
        'Total Challan Amount': '—',
        'Amount Received So Far': 'None',
        'Remaining Balance': '—',
      },
    },
    before: null,
  },

  /* ── AR-0011 onward: one PENDING + one History (approved/rejected)
     example for every action type not already covered above, so every
     scenario has a complete-detail example visible in Pending Approvals
     AND History — and, since every request here is authored by
     mockApprovalCurrentUser, also in My Requests. Real ids (empId,
     reg, productId, entry id) are reused from each module's own mock
     data so approving/rejecting these seeds applies a real, visible
     change, exactly like AR-0001 – AR-0010 above. */

  // fee_discount — history (approved) counterpart to AR-0001 (pending)
  {
    id: 'AR-0011', actionType: 'fee_discount', module: 'Fee', actionLabel: 'Fee Discount',
    entityId: '245-00120', entitySummary: 'Bilal Raza — Class 1A (B) — Rs. 300 discount on Tuition Fee',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-05T10:00:00', status: 'approved',
    requestComment: 'Sibling discount policy — second child in the family.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-05T15:30:00', reviewComment: 'Confirmed sibling record — approved.',
    payload: { classKey: '1A-B', reg: '245-00120', cls: 'Class 1A', sec: 'B', 'Current Discount': {}, 'Requested Discount': { 'Tuition Fee': 300 } },
    before: null,
  },
  // fee_delete_challan — pending counterpart to AR-0002 (history)
  {
    id: 'AR-0012', actionType: 'fee_delete_challan', module: 'Fee', actionLabel: 'Delete Fee Challan',
    entityId: '245-00121-1', entitySummary: 'Hina Sheikh — Class 2A (A) — February challan',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-28T10:40:00', status: 'pending',
    requestComment: 'Family requested cancellation — student withdrawing mid-term.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { classKey: '2A-A', reg: '245-00121', monthIdx: 1 },
    before: { name: 'Hina Sheikh', cls: 'Class 2A', sec: 'A', month: 'February', year: 2026, 'Challan Amount': 23000, 'Dues Already Recorded': 0, 'Advance Applied': 0 },
  },
  // fee_heads_update — pending counterpart to AR-0003 (history)
  {
    id: 'AR-0013', actionType: 'fee_heads_update', module: 'Fee', actionLabel: 'Fee Heads Update',
    entityId: '2A-A', entitySummary: 'Class 2A (A) — 3 fee head(s) updated',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-29T09:10:00', status: 'pending',
    requestComment: 'Transport Fee revised for the new term.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { classKey: '2A-A', heads: [ { name: 'Tuition Fee', amt: 5800 }, { name: 'Transport Fee', amt: 3200 }, { name: 'Library Fee', amt: 200 } ] },
    before: { classKey: '2A-A', heads: [ { name: 'Tuition Fee', amt: 5800 }, { name: 'Transport Fee', amt: 3000 }, { name: 'Library Fee', amt: 200 } ] },
  },
  // accounts_edit_entry — history (approved) counterpart to AR-0004 (pending)
  {
    id: 'AR-0014', actionType: 'accounts_edit_entry', module: 'Accounts', actionLabel: 'Edit Accounts Entry',
    entityId: 'e-jan-1', entitySummary: 'Salary Payment — Rs. 180,000 → Rs. 182,500 (03 Jan 2026)',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-06T11:15:00', status: 'approved',
    requestComment: 'Missed a late-joiner’s pro-rated salary in the original entry.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-06T16:00:00', reviewComment: 'Verified against payroll sheet — approved.',
    payload: { seg: 'exp', id: 'e-jan-1', headNo: 206, head: 'Salary Payment', date: '2026-01-03', month: '2026-01', detail: 'Monthly salary — teaching staff (Jan), incl. late joiner', amount: 182500, chqNo: 'CHQ-43101', chqDate: '2026-01-03', updatedBy: 'Sana Malik' },
    before: { id: 'e-jan-1', headNo: 206, head: 'Salary Payment', date: '2026-01-03', month: '2026-01', detail: 'Monthly salary — teaching staff (Jan)', amount: 180000, chqNo: 'CHQ-43101', chqDate: '2026-01-03' },
  },
  // accounts_delete_entry — pending counterpart to AR-0005 (history)
  {
    id: 'AR-0015', actionType: 'accounts_delete_entry', module: 'Accounts', actionLabel: 'Delete Accounts Entry',
    entityId: 'e-jan-3', entitySummary: 'Electricity Bill — Rs. 38,500 (15 Jan 2026)',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-30T10:20:00', status: 'pending',
    requestComment: 'Entered under the wrong month — will be re-posted correctly.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { seg: 'exp', id: 'e-jan-3' },
    before: { seg: 'exp', id: 'e-jan-3', head: 'Electricity Bill', amount: 38500, date: '2026-01-15' },
  },
  // hr_deduction_waiver — pending counterpart to AR-0006 (history/revoked)
  {
    id: 'AR-0016', actionType: 'hr_deduction_waiver', module: 'Human Resource', actionLabel: 'Payroll Deduction Waiver',
    entityId: '3-2026-05-fineDeduct', entitySummary: 'Gamma — Fine Deduction — Rs. 300 waived',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-30T13:00:00', status: 'pending',
    requestComment: 'Late clock-in was due to a school van breakdown, not employee fault.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { empId: 3, monthKey: '2026-05', head: 'Fine Deduction', amount: 300, newAmount: 0 },
    before: { fineDeduct: 300, fineComment: 'Late clock-in — 3 occurrences' },
  },
  // hr_bonus_award — history (approved) counterpart to AR-0007 (pending)
  {
    id: 'AR-0017', actionType: 'hr_bonus_award', module: 'Human Resource', actionLabel: 'Payroll Bonus Award',
    entityId: '2-2026-05-bonus', entitySummary: 'Alpha — PKR 3,000 bonus for May 2026',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-07T10:00:00', status: 'approved',
    requestComment: 'Extra hours covering exam-week administration.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-07T14:40:00', reviewComment: 'Approved — well deserved.',
    payload: {
      empId: 2, monthKey: '2026-05', amount: 3000,
      'Employee': { Name: 'Alpha', Designation: 'Principal', Department: 'Administration' },
      'Bonus': { Month: 'May 2026', 'Requested Amount': 'PKR 3,000' },
    },
    before: { empId: 2, monthKey: '2026-05', 'Previous Bonus This Month': 'PKR 0' },
  },
  // hr_salary_update — pending
  {
    id: 'AR-0018', actionType: 'hr_salary_update', module: 'Human Resource', actionLabel: 'Salary Details Update',
    entityId: '2', entitySummary: 'Alpha — Basic Salary Rs. 60,000 → Rs. 65,000',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T09:30:00', status: 'pending',
    requestComment: 'Annual increment as per HR policy.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: {
      empId: 2,
      'Current Salary':   { basicSalary: 60000, payMethod: 'Bank Transfer', bankName: '—', bankAcc: '—' },
      'Requested Salary': { basicSalary: 65000, payMethod: 'Bank Transfer', bankName: '—', bankAcc: '—' },
    },
    before: null,
  },
  // hr_salary_update — history (approved)
  {
    id: 'AR-0019', actionType: 'hr_salary_update', module: 'Human Resource', actionLabel: 'Salary Details Update',
    entityId: '3', entitySummary: 'Gamma — Basic Salary Rs. 55,000 → Rs. 58,000',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-08T09:00:00', status: 'approved',
    requestComment: 'Mid-year increment following performance review.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-08T15:00:00', reviewComment: 'Performance review confirmed — approved.',
    payload: {
      empId: 3,
      'Current Salary':   { basicSalary: 55000, payMethod: 'Bank Transfer', bankName: '—', bankAcc: '—' },
      'Requested Salary': { basicSalary: 58000, payMethod: 'Bank Transfer', bankName: '—', bankAcc: '—' },
    },
    before: null,
  },
  // hr_leave_update — pending
  {
    id: 'AR-0020', actionType: 'hr_leave_update', module: 'Human Resource', actionLabel: 'Leave Policy Update',
    entityId: '3', entitySummary: 'Gamma — Annual leave entitlement 14 → 18 days',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T11:00:00', status: 'pending',
    requestComment: 'Revised per updated HR leave policy for senior staff.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: {
      empId: 3,
      'Current Leave Policy':   { annual: 14, casual: 10, sick: 8, balance: 9 },
      'Requested Leave Policy': { annual: 18, casual: 10, sick: 8, balance: 13 },
    },
    before: null,
  },
  // hr_leave_update — history (approved)
  {
    id: 'AR-0021', actionType: 'hr_leave_update', module: 'Human Resource', actionLabel: 'Leave Policy Update',
    entityId: '2', entitySummary: 'Alpha — Casual leave entitlement 10 → 12 days',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-09T09:00:00', status: 'approved',
    requestComment: 'Adjustment agreed after HR review meeting.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-09T14:20:00', reviewComment: 'Approved as discussed.',
    payload: {
      empId: 2,
      'Current Leave Policy':   { annual: 14, casual: 10, sick: 8, balance: 12 },
      'Requested Leave Policy': { annual: 14, casual: 12, sick: 8, balance: 14 },
    },
    before: null,
  },
  // hr_loan_approval — pending
  {
    id: 'AR-0022', actionType: 'hr_loan_approval', module: 'Human Resource', actionLabel: 'Employee Loan Approval',
    entityId: '2-loan-request', entitySummary: 'Alpha — PKR 30,000 loan request',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T14:00:00', status: 'pending',
    requestComment: 'Medical emergency in the family.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: {
      empId: 2,
      'New Loan Request': { Amount: 30000, 'Repayment Type': 'Installment', 'Deduction Date': '2026-09-05', 'Installment Type': 'Fixed Months', 'Installment Amount': 5000, Comment: 'Medical emergency in the family.' },
      'Employee\'s Existing Loan Exposure': { 'Active Loans': 0, 'Total Remaining Across Active Loans': 0, 'Current Monthly Loan Deduction': 0, 'Basic Salary': 60000 },
    },
    before: null,
  },
  // hr_loan_approval — history (approved)
  {
    id: 'AR-0023', actionType: 'hr_loan_approval', module: 'Human Resource', actionLabel: 'Employee Loan Approval',
    entityId: '3-loan-request-aug', entitySummary: 'Gamma — PKR 20,000 loan request',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-10T10:00:00', status: 'approved',
    requestComment: 'Requested for house rent security deposit.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-10T16:10:00', reviewComment: 'Approved — standard installment terms.',
    payload: {
      empId: 3,
      'New Loan Request': { Amount: 20000, 'Repayment Type': 'Installment', 'Deduction Date': '2026-08-15', 'Installment Type': 'Fixed Months', 'Installment Amount': 4000, Comment: 'House rent security deposit.' },
      'Employee\'s Existing Loan Exposure': { 'Active Loans': 0, 'Total Remaining Across Active Loans': 0, 'Current Monthly Loan Deduction': 0, 'Basic Salary': 55000 },
    },
    before: null,
  },
  // inventory_price_edit — pending counterpart to AR-0008 (history)
  {
    id: 'AR-0024', actionType: 'inventory_price_edit', module: 'Inventory', actionLabel: 'Inventory Price Edit',
    entityId: 5, entitySummary: 'Pencil Box — Rs. 200 → Rs. 220',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T15:00:00', status: 'pending',
    requestComment: 'Vendor cost increased this quarter.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: {
      productId: 5, field: 'price', newValue: 220,
      'Product': { Name: 'Pencil Box', Category: 'Stationery', Barcode: 'ST-PBX-005', 'Cost Price': 120, 'Current Stock': 42 },
    },
    before: { productId: 5, field: 'price', oldValue: 200 },
  },
  // inventory_delete_product — pending counterpart to AR-0009 (history)
  {
    id: 'AR-0025', actionType: 'inventory_delete_product', module: 'Inventory', actionLabel: 'Delete Inventory Product',
    entityId: 15, entitySummary: 'Glue Stick — Stationery',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T16:00:00', status: 'pending',
    requestComment: 'Discontinued — switching to a different supplier’s SKU.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { productId: 15 },
    before: { id: 15, name: 'Glue Stick', cat: 'Stationery', barcode: 'ST-GLU-015', stock: 90, low: 25, cost: 35, price: 60, img: null },
  },
  // students_mark_inactive — pending
  {
    id: 'AR-0026', actionType: 'students_mark_inactive', module: 'Students', actionLabel: 'Mark Student Inactive',
    entityId: '2025-00004', entitySummary: 'Eman Saleem — Nursery (B) — Family relocated',
    requestedBy: 'Sana Malik', requestedAt: '2026-09-01T09:00:00', status: 'pending',
    requestComment: 'Parents confirmed relocation to Karachi, withdrawing admission.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: {
      classKey: 'c-nur-b', reg: '2025-00004',
      snapshot: {
        reg: '2025-00004', adm: '1004', first: 'Eman', last: 'Saleem', father: 'Saleem Khan', gender: 'Female',
        dob: '2022-07-15', mobile: '0301-1112266', cls: 'Nursery', sec: 'B',
        reason: 'Family relocated', inactiveDate: '2026-09-01',
        dues: { total: 5500, heads: [{ name: 'Tuition Fee', amount: 5500 }], session: '2025-2026', months: 'Aug 2026', history: [] },
      },
    },
    before: { classKey: 'c-nur-b', reg: '2025-00004', cls: 'Nursery', sec: 'B' },
  },
  // students_mark_inactive — history (approved)
  {
    id: 'AR-0027', actionType: 'students_mark_inactive', module: 'Students', actionLabel: 'Mark Student Inactive',
    entityId: '2025-00005', entitySummary: 'Hamza Mehmood — Nursery (B) — Withdrawn — admission elsewhere',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-11T09:30:00', status: 'approved',
    requestComment: 'Family chose a school closer to their new residence.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-11T14:00:00', reviewComment: 'Confirmed with parents — approved.',
    payload: {
      classKey: 'c-nur-b', reg: '2025-00005',
      snapshot: {
        reg: '2025-00005', adm: '1005', first: 'Hamza', last: 'Mehmood', father: 'Mehmood Khan', gender: 'Male',
        dob: '2022-08-10', mobile: '0301-1112277', cls: 'Nursery', sec: 'B',
        reason: 'Withdrawn — admission elsewhere', inactiveDate: '2026-08-11',
        dues: { total: 0, heads: [], session: '2025-2026', months: '', history: [] },
      },
    },
    before: { classKey: 'c-nur-b', reg: '2025-00005', cls: 'Nursery', sec: 'B' },
  },
  // students_discount — pending
  {
    id: 'AR-0028', actionType: 'students_discount', module: 'Students', actionLabel: 'Student Fee Discount',
    entityId: '2025-00003', entitySummary: 'Bilal Ahmed — Nursery (A) — Rs. 300 Tuition Fee discount',
    requestedBy: 'Sana Malik', requestedAt: '2026-09-01T10:00:00', status: 'pending',
    requestComment: 'Staff-ward discount as per HR policy.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { classKey: 'c-nur-a', reg: '2025-00003', 'Current Discount': {}, 'Requested Discount': { 'Tuition Fee': 300 } },
    before: { classKey: 'c-nur-a', reg: '2025-00003', 'Current Discount': {} },
  },
  // students_discount — history (approved)
  {
    id: 'AR-0029', actionType: 'students_discount', module: 'Students', actionLabel: 'Student Fee Discount',
    entityId: '2025-00002', entitySummary: 'Aisha Tariq — Nursery (A) — Rs. 500 → Rs. 700 Tuition Fee discount',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-12T10:00:00', status: 'approved',
    requestComment: 'Discount increased — second sibling now also enrolled.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-12T15:30:00', reviewComment: 'Sibling enrollment confirmed — approved.',
    payload: { classKey: 'c-nur-a', reg: '2025-00002', 'Current Discount': { 'Tuition Fee': 500 }, 'Requested Discount': { 'Tuition Fee': 700 } },
    before: { classKey: 'c-nur-a', reg: '2025-00002', 'Current Discount': { 'Tuition Fee': 500 } },
  },
  // students_dues_discount — pending
  {
    id: 'AR-0030', actionType: 'students_dues_discount', module: 'Students', actionLabel: 'Dues Settlement Discount',
    entityId: '2024-00435', entitySummary: 'Hammad Bhatti — Rs. 1,500 discount on outstanding dues',
    requestedBy: 'Sana Malik', requestedAt: '2026-09-01T11:00:00', status: 'pending',
    requestComment: 'Family facing financial hardship — partial waiver requested alongside cash settlement.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: {
      reg: '2024-00435', discount: 1500, mode: 'Cash', notes: 'Financial hardship — partial waiver alongside cash settlement.',
      'Student': { Name: 'Hammad Bhatti', Registration: '2024-00435', Class: 'Class 5 (B)' },
      'Settlement': { 'Total Outstanding (Before)': 'Rs. 5,500', 'Cash Received Now': 'Rs. 2,500', 'Requested Discount': 'Rs. 1,500', 'Remaining After Discount': 'Rs. 1,500', 'Mode': 'Cash' },
      'Notes': 'Financial hardship — partial waiver alongside cash settlement.',
    },
    before: { reg: '2024-00435', duesTotal: 'Rs. 5,500' },
  },
  // students_dues_discount — history (approved)
  {
    id: 'AR-0031', actionType: 'students_dues_discount', module: 'Students', actionLabel: 'Dues Settlement Discount',
    entityId: '2024-00410', entitySummary: 'Awais Sohail — Rs. 2,500 discount on outstanding dues',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-13T10:00:00', status: 'approved',
    requestComment: 'Final settlement before closing the student file — Head Office approved a goodwill discount.',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-13T15:00:00', reviewComment: 'Approved — final settlement.',
    payload: {
      reg: '2024-00410', discount: 2500, mode: 'Bank Transfer', notes: 'Final settlement — goodwill discount approved by Head Office.',
      'Student': { Name: 'Awais Sohail', Registration: '2024-00410', Class: 'Class 4 (B)' },
      'Settlement': { 'Total Outstanding (Before)': 'Rs. 12,500', 'Cash Received Now': 'Rs. 10,000', 'Requested Discount': 'Rs. 2,500', 'Remaining After Discount': 'Rs. 0', 'Mode': 'Bank Transfer' },
      'Notes': 'Final settlement — goodwill discount approved by Head Office.',
    },
    before: { reg: '2024-00410', duesTotal: 'Rs. 12,500' },
  },
  // students_preenroll_admission — history (approved), reusing Hamza
  // Sheikh's already-approved pre-enrollment record (PRE-2026-0001) so
  // the challan/payment figures shown are the real seeded numbers.
  {
    id: 'AR-0032', actionType: 'students_preenroll_admission', module: 'Students', actionLabel: 'Pre-Enrollment Admission',
    entityId: 'PRE-2026-0001', entitySummary: 'Hamza Sheikh — Class 3 (A) — admission and fee setup pending review',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-05T09:30:00', status: 'approved',
    requestComment: '',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-05T14:00:00', reviewComment: 'Documents verified — approved for enrollment.',
    payload: {
      preId: 'PRE-2026-0001',
      'Student Details': {
        'Pre-Enrollment ID': 'PRE-2026-0001', 'Student Name': 'Hamza Sheikh', 'Gender': 'Male', 'Date of Birth': '12 March 2017',
        'B-Form / CNIC': '35202-1234567-1', 'Nationality': 'Pakistani', 'Class': 'Class 3 (A)',
        'Previous School': 'Beaconhouse', 'Previous Grade': 'Class 2',
      },
      'Parent / Guardian Details': {
        'Father Name': 'Imran Sheikh', 'Father CNIC': '35202-7654321-1', 'Father Occupation': 'Businessman',
        'Father / Mobile Contact': '0300-1234567', 'Mother Name': 'Ayesha Sheikh', 'Mother CNIC': '35202-7654321-2',
        'Guardian Name': '—', 'Guardian Contact': '—', 'Email': 'imran.sheikh@example.com', 'Address': 'House 12, Model Town, Lahore',
      },
      'One-Time Admission Challan': {
        'Challan Heads': 'Prospectus / Registration Fee: Rs. 2,000, Admission Fee: Rs. 21,000',
        'Total Challan Amount': 'Rs. 23,000', 'Amount Received So Far': 'Rs. 2,000', 'Remaining Balance': 'Rs. 21,000',
      },
    },
    before: null,
  },
  // students_preenroll_admission — history (rejected), reusing Bilal
  // Ahmed's already-rejected pre-enrollment record (PRE-2026-0003).
  {
    id: 'AR-0033', actionType: 'students_preenroll_admission', module: 'Students', actionLabel: 'Pre-Enrollment Admission',
    entityId: 'PRE-2026-0003', entitySummary: 'Bilal Ahmed — Class 5 (B) — admission and fee setup pending review',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-19T09:00:00', status: 'rejected',
    requestComment: '',
    reviewedBy: 'Dr. Islahudin', reviewedAt: '2026-08-19T13:30:00', reviewComment: 'Previous school leaving certificate not yet submitted.',
    payload: {
      preId: 'PRE-2026-0003',
      'Student Details': {
        'Pre-Enrollment ID': 'PRE-2026-0003', 'Student Name': 'Bilal Ahmed', 'Gender': 'Male', 'Date of Birth': '2 November 2015',
        'B-Form / CNIC': '35202-3456789-3', 'Nationality': 'Pakistani', 'Class': 'Class 5 (B)',
        'Previous School': 'The City School', 'Previous Grade': 'Class 4',
      },
      'Parent / Guardian Details': {
        'Father Name': 'Waqas Ahmed', 'Father CNIC': '35202-9876543-1', 'Father Occupation': 'Doctor',
        'Father / Mobile Contact': '0302-3456789', 'Mother Name': 'Rabia Ahmed', 'Mother CNIC': '35202-9876543-2',
        'Guardian Name': '—', 'Guardian Contact': '—', 'Email': 'waqas.ahmed@example.com', 'Address': 'House 7, Johar Town, Lahore',
      },
      'One-Time Admission Challan': {
        'Challan Heads': 'Prospectus / Registration Fee: Rs. 2,000',
        'Total Challan Amount': 'Rs. 2,000', 'Amount Received So Far': 'None', 'Remaining Balance': 'Rs. 2,000',
      },
    },
    before: null,
  },
];
