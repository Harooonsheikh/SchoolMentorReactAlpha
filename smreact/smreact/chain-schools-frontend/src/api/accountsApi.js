/* ═══════════════════════════════════════════════════════════════════
   NETWORK ACCOUNTS — chain (head-office) ke account books, transactions
   (revenue / expense entries) aur unke account heads, sab networkID ki
   base par (branchID null).

   Wahi Accounts controller jo ERP use karta hai (dekhein ERP ka
   src/erp/services/accountsService.js) — farq sirf itna ke school ki
   rows branchID se bandhi hoti hain aur chain ki rows networkID se. Is
   liye har call me networkID = logged-in network jata hai aur branchID
   chhoot jata hai (null), bilkul inventoryApi ki tarah.

   ── Account Books ──────────────────────────────────────────────────
     GET    /api/accounts/get-account-book-list/{networkId}
     GET    /api/accounts/get-account-book-detail/{bookId}/{networkId}
     POST   /api/accounts/saveupdate-account-book        (JSON)
     DELETE /api/accounts/delete-account-book/{bookId}/{networkId}
     POST   /api/accounts/save-book-entry-payment        (multipart)
     DELETE /api/accounts/delete-book-entry-payment/{id}/{networkId}

   ── Transactions (Revenue / Expense entries) ───────────────────────
     GET    /api/accounts/get-account-types
     GET    /api/accounts/get-account-heads-by-network/{networkId}/{typeId}
     GET    /api/accounts/get-account-entries-by-network/{networkId}/{typeId}
     GET    /api/accounts/get-account-entries-by-network-month/{networkId}/{typeId}/{m}/{y}
     POST   /api/accounts/save-account-entry             (JSON)
     DELETE /api/accounts/delete-account-entry/{id}/{networkId}

   Backend PascalCase fields aur do-value vocabulary use karta hai:
     • BookType    'Payable' | 'Receivable'  ↔  type 'payable' | 'receivable'
     • PaymentType 'Received' | 'Paid'        ↔  txn type 'received' | 'returned'
     • accountTypeID  1 = Revenue,  2 = Expense (seg 'rev' | 'exp')
   List cards server ke aggregate totals (TotalReceived / TotalReturned /
   CurrentBalance) par chalte hain, is liye har book ka poora ledger load
   kiye baghair bhi balance sahi dikhta hai (dekhein data.js bookCalc).
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${CHAIN_API_BASE}/api/accounts`

const currentUserId = () => {
  const u = getStoredUser()
  return Number(u?.id ?? u?.userID ?? u?.userId) || 0
}

/* Server kabhi PascalCase (ID, BookTitle) aur kabhi camelCase (bookID,
   bookTitle) bhejta hai — dono me se pehla non-empty le lo. */
const pick = (o, ...keys) => {
  for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v }
  return undefined
}
const dateOnly = (v) => { const m = String(v ?? '').match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : '' }
const nowISO = () => new Date().toISOString()
const rowsOf = (json) => (Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [])

/* JSON call — save/delete jaise endpoints ke liye. `success:false` ko
   error mana jata hai (message user tak jata hai). Read-lists isay use
   NAHI karti: wahan khaali natija aik jaayaz haalat hai, error nahi. */
async function callJson(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { Accept: '*/*', 'Content-Type': 'application/json' } : { Accept: '*/*' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) throw new Error(json?.message || json?.title || 'Request failed')
  return json
}

/* ════════ ACCOUNT BOOKS ════════ */

/* ─── API row → chain UI shapes ─── */
function mapBook(b = {}) {
  const id = pick(b, 'bookID', 'BookID', 'ID', 'id')
  const isActive = pick(b, 'isActive', 'IsActive')
  const balance = pick(b, 'currentBalance', 'CurrentBalance', 'balance', 'Balance')
  return {
    id:             String(id ?? ''),
    bookID:         Number(id) || 0,
    name:           pick(b, 'bookTitle', 'BookTitle', 'name') || '',
    party:          pick(b, 'party', 'Party') || '',
    desc:           pick(b, 'description', 'Description') || '',
    type:           String(pick(b, 'bookType', 'BookType') || '').toLowerCase() === 'receivable' ? 'receivable' : 'payable',
    opening:        Number(pick(b, 'openingAmount', 'OpeningAmount') || 0),
    openDate:       dateOnly(pick(b, 'openingDate', 'OpeningDate')),
    status:         isActive === false ? 'closed' : 'active',
    includeInCash:  !!pick(b, 'isCashInHand', 'IsCashInHand'),
    createdBy:      pick(b, 'createdByName', 'CreatedByName', 'createdBy', 'CreatedBy') || '',
    /* server aggregates — bookCalc list cards par inhi par chalta hai */
    serverReceived: Number(pick(b, 'totalReceived', 'TotalReceived') || 0),
    serverReturned: Number(pick(b, 'totalReturned', 'TotalReturned') || 0),
    serverBalance:  balance != null ? Number(balance) : null,
    txns:           [],
  }
}

/* API payment/transaction → chain ledger entry. Attachment aik URL string
   hai; usay sirf tab dikhao jab wo asal uploaded file ki taraf ho. */
function mapBookTxn(t = {}) {
  const rawUrl = String(pick(t, 'attachment', 'Attachment') || '')
  const isUrl = /^https?:\/\//i.test(rawUrl)
  const valid = /\/UploadedImages\//i.test(rawUrl) || /\.(png|jpe?g|gif|webp|pdf)(\?|$)/i.test(rawUrl)
  const isPdf = /\.pdf(\?|$)/i.test(rawUrl)
  const url = isUrl ? rawUrl : ''
  return {
    id:        pick(t, 'id', 'ID'),
    type:      String(pick(t, 'paymentType', 'PaymentType') || '').toLowerCase() === 'received' ? 'received' : 'returned',
    amount:    Number(pick(t, 'amount', 'Amount') || 0),
    date:      dateOnly(pick(t, 'paymentDate', 'PaymentDate')),
    notes:     pick(t, 'remark', 'Remark', 'notes') || '',
    enteredBy: pick(t, 'enteredByName', 'EnteredByName', 'enteredBy', 'EnteredBy', 'createdByName', 'CreatedByName') || '',
    at:        pick(t, 'createdAt', 'CreatedAt') || '',
    attachments: valid ? [{ name: (url || rawUrl).split('/').pop() || 'attachment', kind: isPdf ? 'pdf' : 'img', url: url || rawUrl }] : [],
  }
}

/* List all account books for the active network. "No books" → [] (not an error). */
export async function fetchAccountBooks(networkId = currentNetworkId()) {
  if (!networkId) return []
  const res = await fetch(`${BASE}/get-account-book-list/${networkId}`, { headers: { Accept: '*/*' } })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || json?.title || 'Could not load account books')
  const rows = Array.isArray(json?.books) ? json.books
    : Array.isArray(json?.data?.books) ? json.data.books : rowsOf(json)
  return rows.map(mapBook)
}

/* One book with its full transaction ledger. */
export async function fetchAccountBookDetail(bookId, networkId = currentNetworkId()) {
  const res = await fetch(`${BASE}/get-account-book-detail/${bookId}/${networkId}`, { headers: { Accept: '*/*' } })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || json?.title || 'Could not load account book')
  const raw = json?.book || json?.data?.book || (json?.data && !Array.isArray(json.data) ? json.data : null)
  if (!raw || json?.success === false) throw new Error(json?.message || 'Could not load account book')
  const book = mapBook(raw)
  const txnRows = json?.transactions || json?.data?.transactions || raw?.transactions || raw?.payments || []
  book.txns = (Array.isArray(txnRows) ? txnRows : []).map(mapBookTxn)
  return book
}

/* Add (bookID 0) or update (>0) an account book. */
export async function saveAccountBook(payload, networkId = currentNetworkId()) {
  const uid = currentUserId()
  return callJson('/saveupdate-account-book', {
    method: 'POST',
    body: {
      bookID:        payload.bookID || 0,
      networkID:     Number(networkId) || 0,
      branchID:      null,
      bookTitle:     payload.name || '',
      party:         payload.party || '',
      description:   payload.desc || '',
      isCashInHand:  !!payload.includeInCash,
      bookType:      payload.type === 'payable' ? 'Payable' : 'Receivable',
      openingAmount: Number(payload.opening) || 0,
      openingDate:   payload.openDate ? new Date(payload.openDate).toISOString() : nowISO(),
      createdBy:     uid,
      modifiedBy:    uid,
    },
  })
}

/* Delete a book — backend cascades, removing all its payments first. */
export async function deleteAccountBook(bookId, networkId = currentNetworkId()) {
  return callJson(`/delete-account-book/${bookId}/${networkId}`, { method: 'DELETE' })
}

/* Add (id 0) or update (>0) a ledger entry / payment. multipart/form-data
   taake aik optional AttachmentFile bhi sath ja sake. EntryID = book ki id. */
export async function saveAccountBookTxn(
  { bookId, id = 0, type, amount, date, notes, attachments = [] },
  networkId = currentNetworkId(),
) {
  const uid = currentUserId()
  const fileAtt = attachments.find((a) => a && a.file)
  const urlAtt = attachments.find((a) => a && a.url)

  const fd = new FormData()
  fd.append('ID',          String(id || 0))
  fd.append('EntryID',     String(bookId))
  fd.append('NetworkID',   String(Number(networkId) || 0))
  fd.append('PaymentType', type === 'received' ? 'Received' : 'Paid')
  fd.append('Amount',      String(Number(amount) || 0))
  fd.append('Remark',      notes || '')
  fd.append('PaymentDate', date ? new Date(date).toISOString() : nowISO())
  fd.append('Attachment',  urlAtt?.url || '')
  fd.append('CreatedBy',   String(uid))
  fd.append('ModifiedBy',  String(uid))
  if (fileAtt?.file) fd.append('AttachmentFile', fileAtt.file)

  // No Content-Type header — browser sets the multipart boundary.
  const res = await fetch(`${BASE}/save-book-entry-payment`, { method: 'POST', headers: { Accept: '*/*' }, body: fd })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) throw new Error(json?.message || json?.title || 'Could not save transaction')
  return json
}

/* Delete a single ledger entry / payment by its record id. */
export async function deleteAccountBookTxn(txnId, networkId = currentNetworkId()) {
  return callJson(`/delete-book-entry-payment/${txnId}/${networkId}`, { method: 'DELETE' })
}

/* ════════ TRANSACTIONS — types, heads & revenue/expense entries ════════ */

const segTypeId = (seg) => (seg === 'rev' ? 1 : 2)

function mapHead(h = {}) {
  return {
    // Entry save me branchAccountID = head ki apni record ID (get-account-heads
    // response ka `ID`, e.g. 2004), NOT `AccountID` (733) — warna entry save nahi hoti.
    no:       pick(h, 'ID', 'id', 'accountHeadID', 'AccountHeadID'),
    recordId: pick(h, 'id', 'ID'),
    name:     pick(h, 'accountHead', 'AccountHead', 'headName', 'HeadName') || '',
    desc:     pick(h, 'description', 'Description') || '',
    typeID:   pick(h, 'accountTypeID', 'AccountTypeID'),
  }
}

/* API entry row → chain transaction row. */
function mapEntry(e = {}) {
  const date = dateOnly(pick(e, 'entryDate', 'EntryDate', 'transactionDate', 'TransactionDate', 'date', 'Date'))
  return {
    id:        pick(e, 'id', 'ID'),
    /* Network-level entry (chain head office ka apna) → BranchID null. Koi
       BranchID ho to wo kisi SCHOOL ki apni entry hai jo backend cross-post
       karta hai (jaise school payment receiving → us branch ki books me
       Expense) — chain ki list me ye nahi aani chahiye. */
    branchID:  pick(e, 'branchID', 'BranchID') ?? null,
    headNo:    pick(e, 'branchAccountID', 'BranchAccountID', 'accountID', 'AccountID', 'accountHeadID', 'AccountHeadID') || '',
    head:      pick(e, 'accountHead', 'AccountHead', 'headName', 'HeadName') || '',
    date,
    month:     date.slice(0, 7),
    detail:    pick(e, 'details', 'Details', 'description', 'Description', 'detail', 'Detail') || '',
    amount:    Number(pick(e, 'amount', 'Amount') || 0),
    chqNo:     pick(e, 'chequeNo', 'ChequeNo', 'chqNo') || '',
    chqDate:   dateOnly(pick(e, 'chequeDate', 'ChequeDate')),
    createdBy: pick(e, 'createdByName', 'CreatedByName', 'createdBy', 'CreatedBy', 'enteredByName', 'EnteredByName') || '',
    createdAt: pick(e, 'createdAt', 'CreatedAt') || '',
    updatedBy: pick(e, 'modifiedByName', 'ModifiedByName', 'modifiedBy', 'ModifiedBy') || null,
    updatedAt: pick(e, 'modifiedAt', 'ModifiedAt') || null,
  }
}

/* Account types with their heads (each type: { key, id, name, icon, heads }).
   key: 'rev' (type 1 / Revenue) | 'exp' (type 2 / Expense). */
export async function fetchAccountTypes(networkId = currentNetworkId()) {
  const tRes = await fetch(`${BASE}/get-account-types`, { headers: { Accept: '*/*' } })
  const tJson = await tRes.json().catch(() => null)
  if (!tRes.ok) throw new Error(tJson?.message || 'Could not load account types')
  const types = rowsOf(tJson)
  return Promise.all(types.map(async (at) => {
    const id = Number(pick(at, 'ID', 'id', 'accountTypeID') || 0)
    const name = pick(at, 'AccountTypeName', 'accountTypeName', 'name') || ''
    let heads = []
    if (networkId) {
      try {
        const hRes = await fetch(`${BASE}/get-account-heads-by-network/${networkId}/${id}`, { headers: { Accept: '*/*' } })
        const hJson = await hRes.json().catch(() => null)
        if (hRes.ok) heads = rowsOf(hJson).map(mapHead)
      } catch { heads = [] }
    }
    const key = id === 1 || /revenue|income/i.test(name) ? 'rev'
      : id === 2 || /expense|expenditure/i.test(name) ? 'exp' : String(id)
    return { key, id, name, icon: key === 'rev' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down', heads }
  }))
}

/* Revenue ('rev') or Expense ('exp') entries for one month (YYYY-MM). */
export async function fetchAccountEntriesByMonth(seg, ym, networkId = currentNetworkId()) {
  if (!networkId) return []
  const [y, m] = String(ym || '').split('-')
  if (!y || !m) return []
  const res = await fetch(
    `${BASE}/get-account-entries-by-network-month/${networkId}/${segTypeId(seg)}/${Number(m)}/${Number(y)}`,
    { headers: { Accept: '*/*' } },
  )
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || 'Could not load account entries')
  /* Sirf network-level (BranchID null) — branch ki apni entries (backend ka
     school-side cross-post, e.g. school payment ka Expense) chain ki list se
     bahar. Warna ek hi school payment Revenue (chain) aur Expense (branch)
     dono me dikhta hai. */
  return rowsOf(json).map(mapEntry).filter((e) => e.branchID == null)
}

/* ALL entries for a segment (used by Reports for arbitrary date ranges —
   filtered client-side). */
export async function fetchAllAccountEntries(seg, networkId = currentNetworkId()) {
  if (!networkId) return []
  const res = await fetch(`${BASE}/get-account-entries-by-network/${networkId}/${segTypeId(seg)}`, { headers: { Accept: '*/*' } })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || 'Could not load account entries')
  /* Sirf network-level (BranchID null) — upar wali fetch jaisa. */
  return rowsOf(json).map(mapEntry).filter((e) => e.branchID == null)
}

/* Add (id 0) or update (>0) a revenue/expense entry. */
export async function saveAccountEntry(seg, payload, networkId = currentNetworkId()) {
  const uid = currentUserId()
  return callJson('/save-account-entry', {
    method: 'POST',
    body: {
      id:              payload.id || 0,
      networkID:       Number(networkId) || 0,
      branchID:        null,
      branchAccountID: Number(payload.headNo) || 0,
      accountTypeID:   segTypeId(seg),
      entryDate:       payload.date ? new Date(payload.date).toISOString() : nowISO(),
      details:         payload.detail || '',
      amount:          Number(payload.amount) || 0,
      chequeNo:        payload.chqNo || '',
      chequeDate:      payload.chqDate ? new Date(payload.chqDate).toISOString() : null,
      enteredBy:       uid,
      createdBy:       uid,
      modifiedBy:      uid,
    },
  })
}

/* Delete a revenue/expense entry by id. */
export async function deleteAccountEntry(id, networkId = currentNetworkId()) {
  return callJson(`/delete-account-entry/${id}/${networkId}`, { method: 'DELETE' })
}

/* ════════ AUTO-POST — fee → Revenue head, salary → Expense head ════════
   ERP me yeh cross-posting backend karta hai; chain ke payments/HR backend
   nahi karte, is liye wahan successful receiving/payroll ke baad frontend se
   yeh helper Accounts me entry daal deta hai. seg 'rev' (school payment) |
   'exp' (HR salary). Head naam se match hota hai (fee/salary jaisa), warna us
   type ka pehla head; koi head na ho to chup-chaap skip (reason:'no-head').

   AHAM: payment ko kabhi fail nahi karta — caller is ko try/catch me rakhe.
   Note: yeh sirf aage barhne wali posting hai — payment baad me edit/delete ho
   to account entry khud reverse NAHI hoti (backend parity na hone ki wajah). */
const _segHeadsCache = {}
async function segmentHeads(seg, networkId) {
  const hit = _segHeadsCache[`${networkId}:${seg}`]
  if (hit) return hit
  const types = await fetchAccountTypes(networkId)
  for (const t of types) _segHeadsCache[`${networkId}:${t.key}`] = t.heads || []
  return _segHeadsCache[`${networkId}:${seg}`] || []
}
/* Jab Accounts tab me koi head add/delete ho to cache saaf karein taake
   agli auto-post taza heads dekhe. */
export function clearAccountHeadCache() {
  for (const k of Object.keys(_segHeadsCache)) delete _segHeadsCache[k]
}

export async function postAutoAccountEntry(seg, { amount, date, detail } = {}, networkId = currentNetworkId()) {
  const amt = Number(amount) || 0
  if (!networkId || amt <= 0) return { posted: false, reason: 'skip' }
  const heads = await segmentHeads(seg, networkId)
  if (!heads.length) return { posted: false, reason: 'no-head' }
  /* Head naam se match. Revenue → "school payment" jaisa head (chain me fee
     head nahi hota — wo ERP ki misaal thi). Expense → HR/salary jaisa head. */
  const kw = seg === 'rev'
    ? /school|payment|revenue|income/i
    : /salary|payroll|wage|staff|\bhr\b|expense/i
  const head = heads.find((h) => kw.test(h.name)) || heads[0]
  await saveAccountEntry(seg, { headNo: head.no, date, detail, amount: amt }, networkId)
  return { posted: true, head: head.name }
}
