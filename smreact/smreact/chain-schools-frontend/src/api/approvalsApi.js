/* ═══════════════════════════════════════════════════════════════════
   NETWORK APPROVALS — schools ke ERP se aayi hui requests ka chain inbox.

     GET  /api/Approvals/approvals_list_network?networkId=&status=
          status: pending | approved | rejected | withdrawn
     POST /api/Approvals/process
          { approvalId, status: 'Approved'|'Rejected', modifiedBy }

   ERP Approvals controller hi hai (alphaapi `/api`), bas list network
   scope par hai. Mapping ERP ke approvalsService.mapApiRequest jaisi
   hai — detailsXml / currentStatusXml se detail card banta hai, aur
   row fields (summary, branchName, requestedByName) table columns
   fill karte hain.
   ═══════════════════════════════════════════════════════════════════ */

import { ERP_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'
import { fetchApprovalTypesMap } from './schoolPermissionsApi'

const LIST_URL = `${ERP_API_BASE}/api/Approvals/approvals_list_network`
const PROCESS_URL = `${ERP_API_BASE}/api/Approvals/process`

const currentUserId = () => {
  const u = getStoredUser()
  return Number(u?.id ?? u?.userID ?? u?.userId) || 0
}

const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`

/* API module string → chain UI module key (Approvals/data.js chips). */
const MODULE_UI = {
  FeeDiscount: 'fee',
  FeeChallan: 'fee',
  FeeHead: 'fee',
  CreateFeeChallan: 'fee',
  ReceiveFeeChallan: 'fee',
  ClearFeeReceiving: 'fee',
  GradeFeeHead: 'fee',
  FamilyTree: 'fee',
  TransportFee: 'fee',
  PreEnrollStudent: 'students',
  PreEnrollCreateChallan: 'students',
  PreEnrollReceiveChallan: 'students',
  PreEnrollDeleteChallan: 'students',
  PreEnrollClearReceiving: 'students',
  PreEnrollment: 'students',
  Student: 'students',
  AccountHead: 'accounts',
  AccountEntry: 'accounts',
  AccountBook: 'accounts',
  BookPayment: 'accounts',
  WalletAccount: 'accounts',
  WalletTransaction: 'accounts',
  WalletTransfer: 'accounts',
  HREmployee: 'hr',
  HRLoan: 'hr',
  HRPayroll: 'hr',
  HRLeave: 'hr',
  Department: 'hr',
  Designation: 'hr',
  InventoryItem: 'inventory',
  InventoryProduct: 'inventory',
}

/* API module + requestAction → human action label for the table. */
const MODULE_ACTION_LABEL = {
  FeeDiscount: { INSERT: 'Fee Discount', UPDATE: 'Fee Discount', DELETE: 'Remove Fee Discount' },
  FamilyTree: { INSERT: 'New Family', UPDATE: 'Edit Family', DELETE: 'Delete Family' },
  HREmployee: { INSERT: 'New Employee', UPDATE: 'Edit Employee', DELETE: 'Delete Employee' },
  HRLoan: { INSERT: 'Employee Loan', UPDATE: 'Edit Loan', DELETE: 'Delete Loan' },
  InventoryItem: { INSERT: 'New Inventory Item', UPDATE: 'Edit Inventory Item', DELETE: 'Delete Inventory Item' },
  AccountBook: { INSERT: 'New Account Book', UPDATE: 'Edit Account Book', DELETE: 'Delete Account Book' },
  AccountHead: { INSERT: 'New Account Head', UPDATE: 'Edit Account Head', DELETE: 'Delete Account Head' },
  AccountEntry: { INSERT: 'New Accounts Entry', UPDATE: 'Edit Accounts Entry', DELETE: 'Delete Accounts Entry' },
  PreEnrollClearReceiving: { CLEAR_ROW: 'Clear Receiving (Pre-Enrollment)', UPDATE: 'Clear Receiving (Pre-Enrollment)', DELETE: 'Clear Receiving (Pre-Enrollment)' },
  PreEnrollCreateChallan: { INSERT: 'Create Challan (Pre-Enrollment)' },
  PreEnrollReceiveChallan: { INSERT: 'Receive Challan (Pre-Enrollment)', UPDATE: 'Receive Challan (Pre-Enrollment)' },
  PreEnrollDeleteChallan: { DELETE: 'Delete Challan (Pre-Enrollment)' },
  PreEnrollStudent: { INSERT: 'Admission (Pre-Enrollment)', UPDATE: 'Edit Pre-Enrollment' },
}

const XML_SKIP = new Set([
  'id', 'branchid', 'createdby', 'modifiedby', 'createdat', 'modifiedat',
  'enteredby', 'isactive', 'isdeleted', 'recordid', 'approvalid', 'requestno',
  'userid', 'showispos', 'showsaleprice', 'showname', 'showtext', 'showamount',
])

function isSkippableTag(tag) {
  const raw = String(tag || '')
  return XML_SKIP.has(raw.toLowerCase()) || /(?:Id|ID)$/.test(raw)
}

function humanizeTag(tag) {
  return String(tag || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

function xmlNodeToValue(el) {
  const kids = Array.from(el.children || [])
  if (kids.length === 0) return (el.textContent || '').trim()
  const obj = {}
  kids.forEach((c) => {
    if (isSkippableTag(c.tagName)) return
    const v = xmlNodeToValue(c)
    if (v !== '' && v != null && String(v).toLowerCase() !== 'null') obj[humanizeTag(c.tagName)] = v
  })
  return obj
}

function parseXmlDetails(xml) {
  if (!xml || typeof xml !== 'string') return null
  if (typeof window === 'undefined' || !window.DOMParser) return null
  let doc
  try { doc = new window.DOMParser().parseFromString(xml, 'application/xml') }
  catch { return null }
  if (!doc || doc.getElementsByTagName('parsererror').length || !doc.documentElement) return null
  const val = xmlNodeToValue(doc.documentElement)
  return val && typeof val === 'object' && Object.keys(val).length ? val : null
}

function actionLabelOf(r) {
  const action = String(r.requestAction || '').toUpperCase()
  const byMod = MODULE_ACTION_LABEL[r.module]
  if (byMod?.[action]) return byMod[action]
  if (byMod?.UPDATE) return byMod.UPDATE
  const mod = humanizeTag(r.module || 'Request')
  if (action === 'INSERT') return `New ${mod}`
  if (action === 'DELETE') return `Delete ${mod}`
  if (action === 'UPDATE') return `Edit ${mod}`
  if (action === 'CLEAR_ROW') return `Clear ${mod}`
  return action ? `${mod} — ${action}` : mod
}

function statusOf(raw) {
  const s = String(raw || 'pending').toLowerCase()
  if (s === 'approved') return 'approved'
  if (s === 'rejected') return 'rejected'
  if (s === 'withdrawn' || s === 'revoked') return 'revoked'
  return 'pending'
}

/** API row → Approvals table / detail modal shape. */
export function mapNetworkApproval(r) {
  const action = String(r.requestAction || '').toUpperCase()
  const status = statusOf(r.status)
  const reviewed = status !== 'pending'
  const moduleKey = MODULE_UI[r.module] || String(r.module || 'settings').toLowerCase()

  let payload
  let before
  if (r.module === 'FeeDiscount') {
    const headName = r.headName || (r.headID ? `Head #${r.headID}` : '—')
    payload = {
      Student: r.studentName,
      Class: [r.className, r.sectionName && `(${r.sectionName})`].filter(Boolean).join(' '),
      'Fee Head': headName,
      'Discount Amount': fmtRs(r.discountAmount),
    }
    if (r.changedFields) payload['Changed Fields'] = r.changedFields
    before = action === 'UPDATE' ? { 'Discount Amount': fmtRs(r.oldDiscountAmount) } : null
  } else {
    const friendly = {}
    if (r.studentName) friendly.Student = r.studentName
    if (r.className) friendly.Class = r.className
    if (r.sectionName) friendly.Section = r.sectionName
    if (r.branchName) friendly.School = r.branchName
    payload = { ...friendly, ...(parseXmlDetails(r.detailsXml) || {}) }
    before = parseXmlDetails(r.currentStatusXml)
    if (!Object.keys(payload).length) {
      if (r.changedFields) payload['Changed Fields'] = r.changedFields
      if (r.recordID != null) payload['Record ID'] = r.recordID
    }
  }

  return {
    id: r.requestNo || String(r.id),
    apiId: r.id,
    schoolId: r.branchID,
    school: r.branchName || (r.branchID != null ? `Branch #${r.branchID}` : '—'),
    module: moduleKey,
    actionLabel: actionLabelOf(r),
    entitySummary: r.summary || '',
    requestedBy: r.requestedByName || (r.requestedBy != null ? `User #${r.requestedBy}` : '—'),
    requestedAt: r.requestedAt,
    status,
    /* One `comment` field: the requester's note while pending, the
       approver's note once decided. */
    requestComment: reviewed ? '' : (r.comment || ''),
    reviewedBy: reviewed ? (r.modifiedByName || (r.modifiedBy != null ? `User #${r.modifiedBy}` : null)) : null,
    reviewedAt: reviewed ? r.modifiedAt : null,
    reviewComment: reviewed ? (r.comment || '') : '',
    payload,
    before,
  }
}

/**
 * Network ke liye approval requests.
 * @param {'pending'|'approved'|'rejected'|'withdrawn'} [status]
 * @returns {Promise<{ rows: object[], pendingCount: number, count: number }>}
 */
export async function fetchNetworkApprovals(status = 'pending', networkId = currentNetworkId()) {
  if (!networkId) return { rows: [], pendingCount: 0, count: 0 }
  const qs = new URLSearchParams({ networkId: String(networkId) })
  if (status) qs.set('status', status)
  const res = await fetch(`${LIST_URL}?${qs}`, { headers: { Accept: '*/*' } })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.Message || `Could not load ${status || ''} approvals`)
  }
  const raw = Array.isArray(json?.data) ? json.data : []
  return {
    rows: raw.map(mapNetworkApproval),
    pendingCount: Number(json?.pendingCount ?? 0),
    count: Number(json?.count ?? raw.length),
  }
}

/**
 * Pending + history, phir sirf un branches ki rows rakho jinka
 * module-permission.approvalType = Chain. School / Disable / missing
 * branches ki requests chain inbox me nahi aatin.
 */
export async function fetchAllNetworkApprovals(networkId = currentNetworkId()) {
  const one = (s) => fetchNetworkApprovals(s, networkId).then((r) => r.rows).catch(() => [])
  const [pending, approved, rejected, withdrawn] = await Promise.all([
    one('pending'),
    one('approved'),
    one('rejected'),
    one('withdrawn'),
  ])
  const merged = [...pending, ...approved, ...rejected, ...withdrawn]
  const seen = new Set()
  const deduped = merged.filter((r) => {
    const key = r.apiId ?? r.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const branchIds = [...new Set(deduped.map((r) => Number(r.schoolId)).filter(Boolean))]
  const modes = await fetchApprovalTypesMap(branchIds)
  const rows = deduped.filter((r) => modes[Number(r.schoolId)] === 'chain')
  return {
    rows,
    pendingCount: rows.filter((r) => r.status === 'pending').length,
    approvalModes: modes,
  }
}

/** Approve/Reject se pehle — School-managed branch block + toaster copy. */
export function approvalGateMessage(mode, schoolName) {
  const name = schoolName || 'This school'
  if (mode === 'school') {
    return `${name}'s approvals are controlled by the school. Chain users cannot accept or reject these requests.`
  }
  if (mode === 'disabled') {
    return `${name} has approvals disabled. No chain review is available for this branch.`
  }
  return null
}

/** Approve / Reject — ERP process endpoint. */
export async function processNetworkApproval(apiId, decision, comment = '') {
  const status = decision === 'approve' ? 'Approved' : 'Rejected'
  const res = await fetch(PROCESS_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approvalId: Number(apiId),
      status,
      modifiedBy: currentUserId(),
      comment: comment || '',
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.Message || `Could not mark request as ${status}`)
  }
  return json
}

export { fetchApprovalType } from './schoolPermissionsApi'
