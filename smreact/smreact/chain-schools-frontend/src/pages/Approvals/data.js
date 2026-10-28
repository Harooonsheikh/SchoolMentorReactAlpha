/* ═══════════════════════════════════════════════════════════════════
   APPROVALS — centralized inbox for requests raised BY schools.

   Mirrors School-Mentor-Front-end's src/mock/approvals.js +
   src/services/approvalsService.js in shape (one generic
   ApprovalRequest store, status lifecycle pending→approved/rejected,
   a requester "revoke" path) and src/components/Approvals.jsx in UI
   (stat strip, tab bar, table, detail modal) — adapted for a chain
   portal that aggregates requests ACROSS many schools rather than one:
   - each request carries which SCHOOL it came from (School-Mentor has
     no chain hierarchy, so this is new)
   - there is no per-action-type mutation handler here — School-
     Mentor's approve/reject wiring is bound one-to-one to its own
     Fee/Accounts/HR/Inventory service functions, which don't exist
     in this app; approving/rejecting here just records the decision,
     same as every other mock write-path in this codebase
   - "who can approve" is a direct list of HR staff (chainApprovers),
     not a role — Roles are out of scope for this port

   Chain Portal does NOT create requests — only a school's own ERP
   (School Mentor) does that. This module is a pure review inbox:
   a request only ever reaches it for schools whose School
   Permissions → Approval Settings is set to "Chain Managed"
   (School Permissions/data.js's `approvalMode`). Schools set to
   "School Managed" review their own requests inside their own ERP
   instance and never surface here; "Disabled" schools raise none.
   That routing is enforced live below (isChainManaged/getChainVisible)
   by reading School Permissions' own store — never duplicated,
   never copied into a second source of truth.
   ═══════════════════════════════════════════════════════════════════ */
import { getSchoolPerms, loadPermStore, savePermStore } from '../SchoolPermissions/data'

const KEY_REQUESTS = 'csp_approval_requests_v5'
const KEY_CHAIN_APPROVERS = 'csp_chain_approvers'

export const APPROVAL_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', REVOKED: 'revoked' }

/* Same 12 modules (+ icons) as the User Permissions matrix's
   MODULE_TREE, minus Dashboard/User Permissions/Approvals itself —
   every module here is a real source a school can raise a request
   from. Kept only for labeling incoming requests (module chip, icon)
   — there is no "raise a request" UI anywhere in this module any
   more, so this is read-only metadata now. */
export const APPROVAL_MODULES = [
  { key: 'fee',           label: 'Student Fee', icon: 'fa-money-bill-wave' },
  { key: 'students',      label: 'Students', icon: 'fa-user-graduate' },
  { key: 'academics',     label: 'Academics', icon: 'fa-graduation-cap' },
  { key: 'schoolperm',    label: 'School Permissions', icon: 'fa-key' },
  { key: 'progress',      label: 'School Progress', icon: 'fa-chart-line' },
  { key: 'payments',      label: 'School Payments', icon: 'fa-credit-card' },
  { key: 'sops',          label: 'Operational SOPs', icon: 'fa-book-open' },
  { key: 'hr',            label: 'Human Resource', icon: 'fa-users-gear' },
  { key: 'accounts',      label: 'Accounts', icon: 'fa-coins' },
  { key: 'attendance',    label: 'Attendance', icon: 'fa-calendar-check' },
  { key: 'inventory',     label: 'Inventory', icon: 'fa-boxes-stacked' },
  { key: 'trainings',     label: 'Trainings', icon: 'fa-chalkboard-user' },
  { key: 'notifications', label: 'Notifications', icon: 'fa-bell' },
  { key: 'settings',      label: 'Settings', icon: 'fa-sliders' },
]
const moduleMeta = (key) => APPROVAL_MODULES.find((m) => m.key === key) || null
export const moduleIcon = (key) => moduleMeta(key)?.icon || 'fa-square-check'
export const moduleLabel = (key) => {
  const hit = moduleMeta(key)
  if (hit) return hit.label
  /* API kabhi naya module bhej de to camelCase → Title Case. */
  return String(key || 'Request')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── Example requests — as if raised from inside each school's own
   ERP, one showcase per module, varied statuses. `schoolId` ties each
   one to a real school from SchoolPermissions/data.js's ERP_SCHOOLS /
   INACTIVE_SCHOOLS so routing (see isChainManaged below) is checked
   against the SAME record the School Permissions modal edits — not a
   parallel copy. Action labels mirror the closest real analogue from
   School-Mentor's own 33-request mock set wherever this app has an
   equivalent capability. ── */
const OXFORD_SCHOOL = 'The Oxford System'
const OXFORD_SCHOOL_ID = 299

const SEED_REQUESTS = [
  /* ── Pending Approvals — ported VERBATIM (same ids, labels, entity
     summaries, requester, dates, comments) from School-Mentor-Front-
     end's own src/mock/approvals.js mockApprovalRequests — every
     entry there with status:'pending', in the same order. School-
     Mentor has no chain hierarchy, so these are all attributed to its
     own demo school, "The Oxford System" (src/pages/Dashboard/
     dashboardData.js), same "Sana Malik" requester School-Mentor uses
     throughout. Module keys map to School-Mentor's own `module` field
     (Fee/Accounts/Human Resource/Inventory/Students). ── */
  {
    id: 'AR-0001', module: 'fee', actionLabel: 'Fee Discount',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'atest Sheikh — Class 1A (B) — Rs. 200 discount on Tuition Fee',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-25T10:15:00', status: 'pending',
    requestComment: 'Merit-based discount approved verbally by Principal.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { classKey: '1A-B', reg: '245-00119', cls: 'Class 1A', sec: 'B', 'Current Discount': {}, 'Requested Discount': { 'Tuition Fee': 200 } },
    before: null,
  },
  {
    id: 'AR-0004', module: 'accounts', actionLabel: 'Edit Accounts Entry',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Stationery & Office Supplies — Rs. 12,500 → Rs. 13,500 (22 Jan 2026)',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-26T14:05:00', status: 'pending',
    requestComment: 'Second batch of stationery was billed under the same entry.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { seg: 'exp', id: 'e-jan-4', headNo: 202, head: 'Stationery & Office Supplies', date: '2026-01-22', month: '2026-01', detail: 'Office stationery — Q1 stock (corrected)', amount: 13500, chqNo: '', chqDate: '', updatedBy: 'Kashif Ali' },
    before: { id: 'e-jan-4', headNo: 202, head: 'Stationery & Office Supplies', date: '2026-01-22', month: '2026-01', detail: 'Office stationery — Q1 stock', amount: 12500, chqNo: '', chqDate: '' },
  },
  {
    id: 'AR-0007', module: 'hr', actionLabel: 'Payroll Bonus Award',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Dr. Islahudin — PKR 5,000 bonus for June 2026',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-24T16:30:00', status: 'pending',
    requestComment: 'Performance bonus for successful annual inspection.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { empId: 1, monthKey: '2026-06', amount: 5000, 'Employee': { Name: 'Dr. Islahudin', Designation: 'Principal', Department: 'Administration' }, 'Bonus': { Month: 'June 2026', 'Requested Amount': 'PKR 5,000' } },
    before: { empId: 1, monthKey: '2026-06', 'Previous Bonus This Month': 'PKR 0' },
  },
  {
    id: 'AR-0010', module: 'students', actionLabel: 'Pre-Enrollment Admission',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Zara Malik — Nursery (B) — admission and fee setup pending review',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-27T09:20:00', status: 'pending',
    requestComment: '',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: {
      preId: 'PRE-2026-0002',
      'Student Details': {
        'Pre-Enrollment ID': 'PRE-2026-0002', 'Student Name': 'Zara Malik', 'Gender': 'Female', 'Date of Birth': '20 June 2021',
        'B-Form / CNIC': '35202-2345678-2', 'Nationality': 'Pakistani', 'Class': 'Nursery (B)',
        'Previous School': '—', 'Previous Grade': '—',
      },
      'Parent / Guardian Details': {
        'Father Name': 'Kashif Malik', 'Father CNIC': '35202-8765432-1', 'Father Occupation': 'Engineer',
        'Father / Mobile Contact': '0301-2345678', 'Mother Name': 'Sana Malik', 'Mother CNIC': '35202-8765432-2',
        'Guardian Name': '—', 'Guardian Contact': '—', 'Email': 'kashif.malik@example.com', 'Address': 'House 45, DHA Phase 3, Lahore',
      },
      'Recurring Fee Structure': [
        { 'Fee Head': 'Tuition Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 5,500', 'Discount': 'Rs. 500', 'Net Payable': 'Rs. 5,000' },
        { 'Fee Head': 'Computer Lab Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 500', 'Discount': '—', 'Net Payable': 'Rs. 500' },
        { 'Fee Head': 'Sports Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 400', 'Discount': '—', 'Net Payable': 'Rs. 400' },
        { 'Fee Head': 'Library Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 200', 'Discount': '—', 'Net Payable': 'Rs. 200' },
        { 'Fee Head': 'Transport Fee', 'Frequency': 'Monthly', 'Standard Amount': 'Rs. 3,000', 'Discount': '—', 'Net Payable': 'Rs. 3,000' },
      ],
      'Fee Summary': { 'Net Payable per Month (after discount)': 'Rs. 9,100', 'Discount / Fee Category': 'Tuition Fee: Rs. 500' },
      'One-Time Admission Challan': { 'Challan Heads': 'Not generated yet', 'Total Challan Amount': '—', 'Amount Received So Far': 'None', 'Remaining Balance': '—' },
    },
    before: null,
  },
  {
    id: 'AR-0012', module: 'fee', actionLabel: 'Delete Fee Challan',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Hina Sheikh — Class 2A (A) — February challan',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-28T10:40:00', status: 'pending',
    requestComment: 'Family requested cancellation — student withdrawing mid-term.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { classKey: '2A-A', reg: '245-00121', monthIdx: 1 },
    before: { name: 'Hina Sheikh', cls: 'Class 2A', sec: 'A', month: 'February', year: 2026, 'Challan Amount': 23000, 'Dues Already Recorded': 0, 'Advance Applied': 0 },
  },
  {
    id: 'AR-0013', module: 'fee', actionLabel: 'Fee Heads Update',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Class 2A (A) — 3 fee head(s) updated',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-29T09:10:00', status: 'pending',
    requestComment: 'Transport Fee revised for the new term.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { classKey: '2A-A', heads: [ { name: 'Tuition Fee', amt: 5800 }, { name: 'Transport Fee', amt: 3200 }, { name: 'Library Fee', amt: 200 } ] },
    before: { classKey: '2A-A', heads: [ { name: 'Tuition Fee', amt: 5800 }, { name: 'Transport Fee', amt: 3000 }, { name: 'Library Fee', amt: 200 } ] },
  },
  {
    id: 'AR-0015', module: 'accounts', actionLabel: 'Delete Accounts Entry',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Electricity Bill — Rs. 38,500 (15 Jan 2026)',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-30T10:20:00', status: 'pending',
    requestComment: 'Entered under the wrong month — will be re-posted correctly.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { seg: 'exp', id: 'e-jan-3' },
    before: { seg: 'exp', id: 'e-jan-3', head: 'Electricity Bill', amount: 38500, date: '2026-01-15' },
  },
  {
    id: 'AR-0016', module: 'hr', actionLabel: 'Payroll Deduction Waiver',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Gamma — Fine Deduction — Rs. 300 waived',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-30T13:00:00', status: 'pending',
    requestComment: 'Late clock-in was due to a school van breakdown, not employee fault.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { empId: 3, monthKey: '2026-05', head: 'Fine Deduction', amount: 300, newAmount: 0 },
    before: { fineDeduct: 300, fineComment: 'Late clock-in — 3 occurrences' },
  },
  {
    id: 'AR-0018', module: 'hr', actionLabel: 'Salary Details Update',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Alpha — Basic Salary Rs. 60,000 → Rs. 65,000',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T09:30:00', status: 'pending',
    requestComment: 'Annual increment as per HR policy.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { empId: 2, 'Current Salary': { basicSalary: 60000, payMethod: 'Bank Transfer', bankName: '—', bankAcc: '—' }, 'Requested Salary': { basicSalary: 65000, payMethod: 'Bank Transfer', bankName: '—', bankAcc: '—' } },
    before: null,
  },
  {
    id: 'AR-0020', module: 'hr', actionLabel: 'Leave Policy Update',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Gamma — Annual leave entitlement 14 → 18 days',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T11:00:00', status: 'pending',
    requestComment: 'Revised per updated HR leave policy for senior staff.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { empId: 3, 'Current Leave Policy': { annual: 14, casual: 10, sick: 8, balance: 9 }, 'Requested Leave Policy': { annual: 18, casual: 10, sick: 8, balance: 13 } },
    before: null,
  },
  {
    id: 'AR-0022', module: 'hr', actionLabel: 'Employee Loan Approval',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Alpha — PKR 30,000 loan request',
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
  {
    id: 'AR-0024', module: 'inventory', actionLabel: 'Inventory Price Edit',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Pencil Box — Rs. 200 → Rs. 220',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T15:00:00', status: 'pending',
    requestComment: 'Vendor cost increased this quarter.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { productId: 5, field: 'price', newValue: 220, 'Product': { Name: 'Pencil Box', Category: 'Stationery', Barcode: 'ST-PBX-005', 'Cost Price': 120, 'Current Stock': 42 } },
    before: { productId: 5, field: 'price', oldValue: 200 },
  },
  {
    id: 'AR-0025', module: 'inventory', actionLabel: 'Delete Inventory Product',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Glue Stick — Stationery',
    requestedBy: 'Sana Malik', requestedAt: '2026-08-31T16:00:00', status: 'pending',
    requestComment: 'Discontinued — switching to a different supplier’s SKU.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { productId: 15 },
    before: { id: 15, name: 'Glue Stick', cat: 'Stationery', barcode: 'ST-GLU-015', stock: 90, low: 25, cost: 35, price: 60, img: null },
  },
  {
    id: 'AR-0026', module: 'students', actionLabel: 'Mark Student Inactive',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Eman Saleem — Nursery (B) — Family relocated',
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
  {
    id: 'AR-0028', module: 'students', actionLabel: 'Student Fee Discount',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Bilal Ahmed — Nursery (A) — Rs. 300 Tuition Fee discount',
    requestedBy: 'Sana Malik', requestedAt: '2026-09-01T10:00:00', status: 'pending',
    requestComment: 'Staff-ward discount as per HR policy.',
    reviewedBy: null, reviewedAt: null, reviewComment: '',
    payload: { classKey: 'c-nur-a', reg: '2025-00003', 'Current Discount': {}, 'Requested Discount': { 'Tuition Fee': 300 } },
    before: { classKey: 'c-nur-a', reg: '2025-00003', 'Current Discount': {} },
  },
  {
    id: 'AR-0030', module: 'students', actionLabel: 'Dues Settlement Discount',
    school: OXFORD_SCHOOL, schoolId: OXFORD_SCHOOL_ID,
    entitySummary: 'Hammad Bhatti — Rs. 1,500 discount on outstanding dues',
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

  /* ── History (Approved/Rejected/Revoked) — this app's own chain-
     level examples across its real schools, kept from before (IDs
     bumped to AR-1xxx so they never collide with the ported School-
     Mentor pending ids above, which keep their original AR-000x ids
     for maximum fidelity). ── */
  {
    id: 'AR-1001', module: 'academics', actionLabel: 'Resource Library Update',
    school: 'Army Public School Nowshera', schoolId: 211,
    entitySummary: 'Add Term 2 Science resource pack to shared library',
    requestedBy: 'Col Asad Khan', requestedAt: '2026-09-05T12:00:00', status: 'approved',
    requestComment: 'Ready for chain-wide access.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-06T09:40:00', reviewComment: 'Reviewed and published.',
  },
  {
    id: 'AR-1002', module: 'schoolperm', actionLabel: 'School Access Control Change',
    school: 'The Creative School', schoolId: 203,
    entitySummary: 'Enable Inventory module access for this school',
    requestedBy: 'Creative Admin', requestedAt: '2026-09-12T15:10:00', status: 'approved',
    requestComment: 'School has started tracking uniform and stationery stock.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-13T09:05:00', reviewComment: 'Access granted.',
  },
  {
    id: 'AR-1003', module: 'payments', actionLabel: 'Payment Setup Change',
    school: 'Lahore Grammar School DHA', schoolId: 207,
    entitySummary: 'Revise monthly royalty plan — Rs. 85,000 → Rs. 78,000',
    requestedBy: 'Ayesha Raza', requestedAt: '2026-09-08T13:00:00', status: 'rejected',
    requestComment: 'Requesting a reduced rate for the new academic year.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-09T10:20:00', reviewComment: 'Hold current plan till the annual review meeting.',
  },
  {
    id: 'AR-1004', module: 'payments', actionLabel: 'Bulk Challan Generation',
    school: 'Roots International School F-10', schoolId: 206,
    entitySummary: 'Generate September royalty challans for all active campuses',
    requestedBy: 'Faisal Qureshi', requestedAt: '2026-09-01T09:00:00', status: 'approved',
    requestComment: 'Standard monthly billing run.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-01T14:30:00', reviewComment: 'Approved — proceed with generation.',
  },
  {
    id: 'AR-1005', module: 'hr', actionLabel: 'Payroll Bonus Award',
    school: 'Roots International School F-10', schoolId: 206,
    entitySummary: 'Faisal Qureshi — PKR 5,000 bonus for August 2026',
    requestedBy: 'Faisal Qureshi', requestedAt: '2026-09-10T09:30:00', status: 'approved',
    requestComment: 'Performance bonus for successful annual inspection.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-11T14:00:00', reviewComment: 'Approved — well deserved.',
  },
  {
    id: 'AR-1006', module: 'hr', actionLabel: 'Employee Loan Approval',
    school: 'Beaconhouse School System Gulberg', schoolId: 204,
    entitySummary: 'PKR 50,000 salary advance loan — 6-month deduction plan',
    requestedBy: 'Tariq Mahmood', requestedAt: '2026-09-02T12:00:00', status: 'rejected',
    requestComment: 'Requested for a family emergency.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-03T09:15:00', reviewComment: 'Exceeds this school’s current loan ceiling — resubmit at a lower amount.',
  },
  {
    id: 'AR-1007', module: 'accounts', actionLabel: 'Wallet Transfer Approval',
    school: 'Lahore Grammar School DHA', schoolId: 207,
    entitySummary: 'Transfer Rs. 200,000 from Operations Wallet to Payroll Wallet',
    requestedBy: 'Ayesha Raza', requestedAt: '2026-08-29T10:00:00', status: 'approved',
    requestComment: 'Payroll wallet running low ahead of month-end salaries.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-08-29T16:45:00', reviewComment: 'Approved.',
  },
  {
    id: 'AR-1008', module: 'inventory', actionLabel: 'Inventory Price Edit',
    school: 'The Creative School', schoolId: 203,
    entitySummary: 'Summer Uniform Set — Rs. 2,200 → Rs. 2,450',
    requestedBy: 'Creative Admin', requestedAt: '2026-09-07T13:20:00', status: 'approved',
    requestComment: 'Vendor cost increase passed on from this term.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-07T17:00:00', reviewComment: 'Approved — within the allowed margin.',
  },
  {
    id: 'AR-1009', module: 'trainings', actionLabel: 'Mark Training Completed',
    school: 'Divisional Public School Rawalpindi', schoolId: 209,
    entitySummary: 'Close out "New Teacher Induction — Batch 4" as completed',
    requestedBy: 'Khalid Mehmood', requestedAt: '2026-09-04T14:00:00', status: 'approved',
    requestComment: 'All 12 enrolled teachers finished the sessions.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-04T18:10:00', reviewComment: 'Confirmed and closed.',
  },
  {
    id: 'AR-1010', module: 'settings', actionLabel: 'Remove Connected School',
    school: 'SPS- Middle Branch', schoolId: 303,
    entitySummary: 'Disconnect this branch — merging into SPS- Middle Section',
    requestedBy: 'Saba Perveen', requestedAt: '2026-09-11T09:45:00', status: 'rejected',
    requestComment: 'Both branches are consolidating operations this term.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-12T08:30:00', reviewComment: 'Hold until student transfer records are fully migrated.',
  },
  {
    id: 'AR-1011', module: 'academics', actionLabel: 'Notebook Plan Approval',
    school: 'Fazaia Inter College Risalpur', schoolId: 210,
    entitySummary: 'Approve Grade 9 English notebook plan — Term 2',
    requestedBy: 'Brig Imran Shah', requestedAt: '2026-09-03T10:00:00', status: 'rejected',
    requestComment: 'Submitted early for review.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-03T15:00:00', reviewComment: 'Resubmit once Term 2 vocabulary list is finalized.',
  },
  {
    id: 'AR-1012', module: 'fee', actionLabel: 'Delete Fee Challan',
    school: 'Beaconhouse School System Gulberg', schoolId: 204,
    entitySummary: 'September challan #FC-3312 — generated against the wrong class section',
    requestedBy: 'Tariq Mahmood', requestedAt: '2026-09-06T09:20:00', status: 'approved',
    requestComment: 'Regenerating under the correct section right after this is cleared.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-09-06T13:00:00', reviewComment: 'Approved — go ahead and regenerate.',
  },
  {
    id: 'AR-1013', module: 'fee', actionLabel: 'Fee Heads Update',
    school: 'Lahore Grammar School DHA', schoolId: 207,
    entitySummary: 'Add new fee head — "Annual Day Fund", Rs. 1,500/term',
    requestedBy: 'Ayesha Raza', requestedAt: '2026-08-30T11:40:00', status: 'rejected',
    requestComment: 'Proposed for this year’s annual day event budget.',
    reviewedBy: 'Chain Admin', reviewedAt: '2026-08-31T09:00:00', reviewComment: 'Fold this into the existing Activity Fund head instead of adding a new one.',
  },
]

/* Every school referenced above — seeded to Chain Managed Approval
   the first time (only if that school has no School Permissions
   record yet, so it never overwrites a Chain Admin's real choice) so
   the inbox is populated out of the box. From then on this is pure
   demonstration data living under School Permissions' own store —
   flip any of these to School Managed / Disabled from School
   Permissions → Approval Settings and its requests disappear from
   here immediately, same live enforcement as any other school. */
const DEMO_CHAIN_SCHOOLS = [
  { id: 202, source: 'erp' }, { id: 203, source: 'erp' }, { id: 204, source: 'erp' }, { id: 205, source: 'erp' },
  { id: 206, source: 'erp' }, { id: 207, source: 'erp' }, { id: 208, source: 'erp' }, { id: 209, source: 'erp' },
  { id: 210, source: 'erp' }, { id: 211, source: 'erp' }, { id: 212, source: 'erp' }, { id: 303, source: 'inactive' },
  { id: OXFORD_SCHOOL_ID, source: 'erp' },
]
function ensureDemoRouting() {
  const store = loadPermStore()
  let changed = false
  DEMO_CHAIN_SCHOOLS.forEach((school) => {
    if (!store[school.id]) { store[school.id] = { ...getSchoolPerms(store, school), approvalMode: 'chain' }; changed = true }
  })
  if (changed) savePermStore(store)
}

/* Is this school currently routed to Chain Managed Approval? Reads
   School Permissions' own live store — the single source of truth for
   `approvalMode` — never a copy kept here. */
export function isChainManaged(schoolId) {
  return (loadPermStore()[schoolId]?.approvalMode) === 'chain'
}

/* Only the requests whose school is currently Chain Managed — this is
   the actual routing gate (Approval Disabled → never reaches Chain;
   School Managed → stays inside the school; Chain Managed → shows
   here). Applied at read time so a school's requests appear/disappear
   immediately if its Approval Settings change, without touching the
   underlying stored request list. */
export const getChainVisible = (requests) => requests.filter((r) => isChainManaged(r.schoolId))

/* ── Storage ── */
const readSeeded = (k, seed) => {
  try { const d = JSON.parse(localStorage.getItem(k)); if (Array.isArray(d)) return d } catch { /* reseed */ }
  localStorage.setItem(k, JSON.stringify(seed))
  return JSON.parse(JSON.stringify(seed))
}
export function loadRequests() {
  ensureDemoRouting()
  return readSeeded(KEY_REQUESTS, SEED_REQUESTS)
}
export const saveRequests = (d) => localStorage.setItem(KEY_REQUESTS, JSON.stringify(d))

export const loadChainApprovers = () => { try { return JSON.parse(localStorage.getItem(KEY_CHAIN_APPROVERS)) || [] } catch { return [] } }
export const saveChainApprovers = (ids) => localStorage.setItem(KEY_CHAIN_APPROVERS, JSON.stringify(ids))

/* ── Reads ── */
export const getPending = (requests) => requests.filter((r) => r.status === APPROVAL_STATUS.PENDING)
export const getHistory = (requests) => requests.filter((r) => r.status !== APPROVAL_STATUS.PENDING)

/* ── Writes — decide only. Chain Portal never creates a request; only
   a school's own ERP does that (see module header). ── */
export function decideRequest(requests, id, decision, { reviewedBy, comment }) {
  return requests.map((r) => {
    if (r.id !== id) return r
    if (r.status !== APPROVAL_STATUS.PENDING) return r
    return {
      ...r,
      status: decision === 'approve' ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED,
      reviewedBy: reviewedBy || 'Chain Admin',
      reviewedAt: new Date().toISOString(),
      reviewComment: comment || '',
    }
  })
}
