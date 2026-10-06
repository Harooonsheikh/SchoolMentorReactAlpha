/* ════════════════════════════════════════════════════════════════════
   NETWORK WALLETS — chain ke wallets (Main Wallet / Cash / Bank / Owner / Other),
   unke darmiyan transfers aur har wallet ki transactions.

   Endpoints (sab POST + JSON, base: {CHAIN_API_BASE}/api/accounts):
     /manage-wallat        { action, id, networkID, branchID, accountName,
                             accountType, openingBalance, status, description,
                             createdBy, modifiedBy }
     /update-wallat-status { id, status, modifiedBy }
     /manage-transfers     { action, id, networkID, branchID, fromAccountID,
                             toAccountID, amount, date, enteredBy, note }
     /manage-transactions  { action, id, networkID, branchID, accountID }

   ▶ Backend sirf yeh actions leta hai: INSERT, GET, UPDATE, DELETE.
   ▶ branchID: backend 0 qabool nahi karta — null (network level) ya > 0 bhejein.
   ▶ Server kabhi PascalCase aur kabhi camelCase bhejta hai — `pick` dono
     me se pehla non-empty le leta hai.
   ▶ Default wallet hamesha "Main Wallet" naam se, list me sab se pehle.
   ▶ Opening balance fixed rehta hai — debit/credit sirf current balance
     badalte hain: balance = opening + credits − debits ± transfers.
   ════════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${CHAIN_API_BASE}/api/accounts`

/* Wallets network level par hain — branch nahi. Backend 0 reject karta hai. */
const BRANCH_ID = null

/* Default wallet ka naam — UI me hamesha yahi dikhta hai. */
export const DEFAULT_WALLET_NAME = 'Main Wallet'

export const WALLET_ACTIONS = {
  walletList:   'GET',
  walletInsert: 'INSERT',   // naya wallet (id 0)
  walletUpdate: 'UPDATE',   // purana wallet edit (id > 0)
  transferList: 'GET',
  transferSave: 'INSERT',
  transferDel:  'DELETE',
  txnList:      'GET',      // statement of one wallet (accountID)
}

const currentUserId = () => {
  const u = getStoredUser?.() || {}
  return Number(u.id ?? u.ID ?? u.userID ?? u.userId ?? u.UserID) || 0
}
const pick = (o, ...keys) => {
  for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v }
  return undefined
}
const dateOnly = (v) => { const m = String(v ?? '').match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : '' }
const rowsOf = (json) => (Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [])

async function post(path, body) {
  const u = getStoredUser?.() || {}
  const token = u.token || u.accessToken || u.access_token || u.jwt
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { accept: '*/*', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) throw new Error(json?.message || json?.title || `Request failed (${res.status})`)
  return json
}

/* ── API row → UI shapes ── */
const TYPE_KEYS = ['cash', 'bank', 'owner']
const uiType = (s) => { const k = String(s || '').trim().toLowerCase(); return TYPE_KEYS.includes(k) ? k : 'other' }
const apiType = (k) => ({ cash: 'Cash', bank: 'Bank', owner: 'Owner', other: 'Other' }[k] || 'Other')
const uiStatus = (s) => (String(s ?? '').trim().toLowerCase() === 'inactive' || s === false ? 'inactive' : 'active')
const apiStatus = (s) => (s === 'inactive' ? 'Inactive' : 'Active')

/* Default wallet ki pehchan: backend flag, ya naam (Main Wallet / Cash in Hand),
   ya payments ke liye auto-create hua wallet. */
const looksDefault = (name, desc, flag) =>
  !!flag || /^(main wallet|cash in hand)$/i.test(String(name).trim()) || /auto-created for payments/i.test(String(desc))

export function mapWallet(w = {}) {
  const id = pick(w, 'id', 'ID', 'accountID', 'AccountID')
  const bal = pick(w, 'currentBalance', 'CurrentBalance', 'balance', 'Balance')
  const name = pick(w, 'accountName', 'AccountName', 'name') || ''
  const description = pick(w, 'description', 'Description') || ''
  const type = uiType(pick(w, 'accountType', 'AccountType', 'type'))
  return {
    id: String(id ?? ''),
    walletID: Number(id) || 0,
    name,
    type,
    opening: Number(pick(w, 'openingBalance', 'OpeningBalance', 'opening') || 0),
    status: uiStatus(pick(w, 'status', 'Status', 'isActive', 'IsActive')),
    description,
    bankName: pick(w, 'bankName', 'BankName') || '',
    accountNo: pick(w, 'accountNo', 'AccountNo', 'accountNumber', 'AccountNumber') || '',
    isDefault: looksDefault(name, description, pick(w, 'isDefault', 'IsDefault')),
    createdBy: pick(w, 'createdByName', 'CreatedByName', 'createdBy', 'CreatedBy') || '',
    createdAt: dateOnly(pick(w, 'createdAt', 'CreatedAt', 'createdDate', 'CreatedDate', 'createdOn', 'CreatedOn', 'openingDate', 'OpeningDate')) || '',    /* server aggregate — hota hai to UI isi ko balance maanta hai */
    serverBalance: bal != null && bal !== '' ? Number(bal) : null,
    /* credits − debits (opening ke ilawa) — Accounts.jsx reloadWallets bharta hai */
    txnNet: 0,
  }
}

/* Sirf EK default: flag wale me se sab se purana (chhota ID); koi na mile to
   network ka sab se purana wallet. Default ka naam "Main Wallet", hamesha
   Active, aur list me sab se pehle; phir active, phir disabled. */
function applyDefault(list) {
  const byId = (a, b) => a.walletID - b.walletID
  const def = [...list].filter((w) => w.isDefault).sort(byId)[0] || [...list].sort(byId)[0]
  return list
    .map((w) => (w === def
      ? { ...w, isDefault: true, name: DEFAULT_WALLET_NAME, status: 'active' }
      : { ...w, isDefault: false }))
    .sort((a, b) =>
      (Number(b.isDefault) - Number(a.isDefault))
      || ((a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1))
      || byId(a, b))
}

export function mapTransfer(t = {}) {
  return {
    id: String(pick(t, 'id', 'ID', 'transferID', 'TransferID') ?? ''),
    fromId: String(pick(t, 'fromAccountID', 'FromAccountID', 'fromId') ?? ''),
    toId: String(pick(t, 'toAccountID', 'ToAccountID', 'toId') ?? ''),
    amount: Number(pick(t, 'amount', 'Amount') || 0),
    date: dateOnly(pick(t, 'date', 'Date', 'transferDate', 'TransferDate')),
    note: pick(t, 'note', 'Note', 'remark', 'Remark') || '',
    by: pick(t, 'enteredByName', 'EnteredByName', 'enteredBy', 'EnteredBy') || '',
    at: pick(t, 'createdAt', 'CreatedAt', 'date', 'Date') || '',
  }
}

/* Wallet statement row. API Credit / Debit alag bhejti hai (Amount nahi). */
export function mapWalletTxn(t = {}) {
  const typeRaw = String(pick(t, 'type', 'Type', 'transactionType', 'TransactionType') || '')
  const refType = String(pick(t, 'referenceType', 'ReferenceType') || '')
  const credit = Number(pick(t, 'credit', 'Credit') || 0)
  const debit = Number(pick(t, 'debit', 'Debit') || 0)

  let kind, amount
  if (credit > 0 || debit > 0) {
    kind = credit > 0 ? 'credit' : 'debit'
    amount = credit > 0 ? credit : debit
  } else {
    const amt = Number(pick(t, 'amount', 'Amount') || 0)
    kind = /rev|income|credit|received/i.test(typeRaw) || amt > 0 ? 'credit' : 'debit'
    amount = Math.abs(amt)
  }

  return {
    id: String(pick(t, 'id', 'ID') ?? ''),
    date: dateOnly(pick(t, 'date', 'Date', 'entryDate', 'EntryDate')),
    desc: pick(t, 'description', 'Description', 'details', 'Details', 'note', 'Note') || '',
    head: refType || pick(t, 'accountHead', 'AccountHead') || '',
    kind,
    amount,
    /* Opening row — statement apni opening line khud banata hai */
    isOpening: /opening/i.test(refType) || /opening/i.test(typeRaw),
    /* Transfer rows — transfers manage-transfers se alag aate hain, double na hon */
    isTransfer: /transfer/i.test(refType),
  }
}

/* ════════ WALLETS ════════ */
export async function fetchWallets(networkId = currentNetworkId()) {
  const json = await post('/manage-wallat', {
    action: WALLET_ACTIONS.walletList, id: 0, networkID: Number(networkId) || 0, branchID: BRANCH_ID,
    accountName: '', accountType: '', openingBalance: 0, status: '', description: '',
    createdBy: 0, modifiedBy: 0,
  })
  return applyDefault(rowsOf(json).map(mapWallet))
}

/* Add (id 0) / update (id > 0). payload = UI shape (name, type, opening, status, description). */
export async function saveWallet(payload, id = 0, networkId = currentNetworkId()) {
  const uid = currentUserId()
  return post('/manage-wallat', {
    action: Number(id) > 0 ? WALLET_ACTIONS.walletUpdate : WALLET_ACTIONS.walletInsert,
    id: Number(id) || 0,
    networkID: Number(networkId) || 0,
    branchID: BRANCH_ID,
    accountName: payload.name,
    accountType: apiType(payload.type),
    openingBalance: Number(payload.opening) || 0,
    status: apiStatus(payload.status),
    description: payload.description || '',
    createdBy: uid,
    modifiedBy: uid,
  })
}

export async function setWalletStatus(id, status) {
  return post('/update-wallat-status', { id: Number(id) || 0, status: apiStatus(status), modifiedBy: currentUserId() })
}

/* ════════ TRANSFERS ════════ */
export async function fetchTransfers(networkId = currentNetworkId()) {
  const json = await post('/manage-transfers', {
    action: WALLET_ACTIONS.transferList, id: 0, networkID: Number(networkId) || 0, branchID: BRANCH_ID,
    fromAccountID: 0, toAccountID: 0, amount: 0, date: new Date().toISOString(), enteredBy: 0, note: '',
  })
  return rowsOf(json).map(mapTransfer)
}

export async function saveTransfer(payload, networkId = currentNetworkId()) {
  return post('/manage-transfers', {
    action: WALLET_ACTIONS.transferSave, id: 0,
    networkID: Number(networkId) || 0, branchID: BRANCH_ID,
    fromAccountID: Number(payload.fromId) || 0,
    toAccountID: Number(payload.toId) || 0,
    amount: Number(payload.amount) || 0,
    date: payload.date ? new Date(payload.date).toISOString() : new Date().toISOString(),
    enteredBy: currentUserId(),
    note: payload.note || '',
  })
}

export async function deleteTransfer(id, networkId = currentNetworkId()) {
  return post('/manage-transfers', {
    action: WALLET_ACTIONS.transferDel, id: Number(id) || 0,
    networkID: Number(networkId) || 0, branchID: BRANCH_ID,
    fromAccountID: 0, toAccountID: 0, amount: 0, date: new Date().toISOString(), enteredBy: currentUserId(), note: '',
  })
}

/* ════════ WALLET TRANSACTIONS (statement) ════════ */
export async function fetchWalletTransactions(accountId, networkId = currentNetworkId()) {
  const json = await post('/manage-transactions', {
    action: WALLET_ACTIONS.txnList, id: 0,
    networkID: Number(networkId) || 0, branchID: BRANCH_ID, accountID: Number(accountId) || 0,
  })
  return rowsOf(json).map(mapWalletTxn).filter((t) => !t.isOpening && !t.isTransfer)
}

/* Wallet ki credits − debits (opening shamil NAHI). Current balance =
   opening + yeh + transfers in − transfers out. */
export async function fetchWalletNet(accountId, networkId = currentNetworkId()) {
  const txns = await fetchWalletTransactions(accountId, networkId)
  return txns.reduce((s, t) => s + (t.kind === 'credit' ? t.amount : -t.amount), 0)
}
/* ════════ ACCOUNT ENTRY (wallet me entry save) ════════ */
export async function saveAccountEntry(payload, networkId = currentNetworkId()) {
  const uid = currentUserId()
  const iso = (d) => (d ? new Date(d).toISOString() : new Date().toISOString())
  return post('/save-account-entry', {
    id: Number(payload.id) || 0,
    networkID: Number(networkId) || 0,
    branchID: Number(payload.branchId) > 0 ? Number(payload.branchId) : BRANCH_ID,
    branchAccountID: Number(payload.branchAccountId) || 0,
    accountTypeID: Number(payload.accountTypeId) || 0,
    entryDate: iso(payload.date),
    details: payload.details || '',
    amount: Number(payload.amount) || 0,
    wallatID: Number(payload.walletId) || 0,
    chequeDate: iso(payload.chequeDate),
    chequeNo: payload.chequeNo || '',
    enteredBy: uid,
    createdBy: uid,
    modifiedBy: uid,
  })
}