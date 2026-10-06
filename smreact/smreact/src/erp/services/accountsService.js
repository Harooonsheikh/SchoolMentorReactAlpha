import { delay, clone } from './_http';
import { buildUrl, buildChainApiUrl, apiMessage } from '../../utils/apiConfig';

const pick = (obj, ...keys) => keys.map(k => obj?.[k]).find(v => v !== undefined && v !== null && v !== '');

function mapAccEntry(e = {}) {
  const rawDate = pick(e, 'entryDate', 'EntryDate', 'transactionDate', 'TransactionDate', 'date', 'Date') || '';
  const date = rawDate ? String(rawDate).slice(0, 10) : '';
  return {
    id:        pick(e, 'id', 'ID'),
    recordId:  pick(e, 'id', 'ID'),
    branchAccountID: pick(e, 'branchAccountID', 'BranchAccountID', 'accountID', 'AccountID') || '',
    headNo:    pick(e, 'accountID', 'AccountID', 'accountHeadID', 'AccountHeadID') || '',
    head:      pick(e, 'accountHead', 'AccountHead', 'headName', 'HeadName') || '',
    date,
    month:     date.slice(0, 7),
    detail:    pick(e, 'details', 'Details', 'description', 'Description', 'detail', 'Detail') || '',
    amount:    Number(pick(e, 'amount', 'Amount') || 0),
    chqNo:     pick(e, 'chequeNo', 'ChequeNo', 'chqNo') || '',
    chqDate:   pick(e, 'chequeDate', 'ChequeDate') ? String(pick(e, 'chequeDate', 'ChequeDate')).slice(0, 10) : '',
    createdBy: pick(e, 'createdByName', 'CreatedByName', 'createdBy', 'CreatedBy') || '',
    createdAt: pick(e, 'createdAt', 'CreatedAt') || '',
    updatedBy: pick(e, 'modifiedByName', 'ModifiedByName', 'modifiedBy', 'ModifiedBy') || null,
    updatedAt: pick(e, 'modifiedAt', 'ModifiedAt') || null,
    walletId:  String(pick(e, 'wallatID', 'WallatID', 'walletID', 'walletId', 'WalletID') ?? ''),
    acctId:    String(pick(e, 'wallatID', 'WallatID', 'walletID', 'walletId', 'WalletID') ?? ''),
  };
}

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getAccTypes() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const tRes  = await fetch(buildUrl('/get-account-types'), { headers: { Accept: '*/*' } });
  const tJson = await tRes.json().catch(() => null);
  if (!tRes.ok) throw new Error(apiMessage(tJson) || 'Could not load account types');
  const types = Array.isArray(tJson?.data) ? tJson.data : [];

  return Promise.all(types.map(async (at) => {
    const id = Number(at.ID ?? at.id ?? at.accountTypeID ?? 0);
    const name = at.AccountTypeName ?? at.accountTypeName ?? at.name ?? '';
    let heads = [];
    try {
      const hRes  = await fetch(buildUrl(`/get-accountsHeads-by-branch/${branchID}/${id}`), { headers: { Accept: '*/*' } });
      const hJson = await hRes.json().catch(() => null);
      if (hRes.ok) {
        heads = (hJson?.data || []).map(h => ({
          no:       h.accountID ?? h.AccountID ?? h.id ?? h.ID,
          recordId: h.id ?? h.ID,
          name:     h.accountHead ?? h.AccountHead ?? h.headName ?? h.HeadName ?? '',
          desc:     h.description ?? h.Description ?? '',
          typeID:   h.accountTypeID ?? h.AccountTypeID ?? id,
        }));
      }
    } catch (e) {
      heads = [];
    }
    const key = id === 1 || /revenue|income/i.test(name) ? 'rev'
      : id === 2 || /expense|expenditure/i.test(name) ? 'exp'
      : String(id);
    return { key, id, name, heads };
  }));
}
export async function getAccEntriesByMonth(seg, ym) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const [y, m] = String(ym || '').split('-');
  if (!y || !m) return [];
  const accountTypeID = seg === 'rev' ? 1 : 2;
  const res = await fetch(
    buildUrl(`/get-account-entries-by-branch-month/${branchID}/${accountTypeID}/${Number(m)}/${Number(y)}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load account entries');
  return (json?.data || []).map(mapAccEntry);
}

export async function getAccEntriesForMonths(months = []) {
  const uniqMonths = Array.from(new Set(months.filter(Boolean)));
  const [revRows, expRows] = await Promise.all([
    Promise.all(uniqMonths.map(m => getAccEntriesByMonth('rev', m))),
    Promise.all(uniqMonths.map(m => getAccEntriesByMonth('exp', m))),
  ]);
  return { rev: revRows.flat(), exp: expRows.flat() };
}

/* Is mahine ki entries (Universal Search ke liye). API na chale to KHALI —
   pehle yahan mock ke voucher gir jate thay aur search me aise entries aati
   thin jo kisi khaate me hain hi nahi. */
export async function getAccTxns() {
  const ym = new Date().toISOString().slice(0, 7);
  return getAccEntriesForMonths([ym]).catch(() => ({ rev: [], exp: [] }));
}

/* Write APIs — in-memory only until backend wires real endpoints. */
export async function saveAccHead({ typeKey, no, name, desc }) {
  await delay();
  return clone({ typeKey, no, name, desc, ok: true });
}
export async function deleteAccHead({ typeKey, no }) {
  await delay();
  return { typeKey, no, deleted: true };
}
export async function saveAccTxn(payload) {
  await delay();
  return clone({ ...payload, ok: true });
}
export async function deleteAccTxn({ seg, id }) {
  await delay();
  return { seg, id, deleted: true };
}

/* ═══════════════════════════════════════════════════════════════════
   Account Books — real API wiring.

   The backend uses PascalCase fields and a two-value PaymentType /
   BookType vocabulary. These mappers project the API shapes onto the
   local UI model used across Accounts.jsx:
     • BookType  'Receivable' | 'Payable'  ↔  type 'receivable' | 'payable'
     • PaymentType 'Received' | 'Paid'      ↔  txn type 'received' | 'returned'
   branchID / UserID come from sessionStorage (set at login).
   ═══════════════════════════════════════════════════════════════════ */

/* API book → local book. Server aggregate totals (TotalReceived /
   TotalReturned / CurrentBalance) are kept so the list cards & stats are
   correct without loading every ledger entry — bookCalc() prefers them
   when a book has no txns loaded. */
function mapBook(b = {}) {
  return {
    id:             String(b.ID),
    bookID:         b.ID,
    name:           b.BookTitle || '',
    party:          b.Party || '',
    desc:           b.Description || '',
    type:           b.BookType === 'Receivable' ? 'receivable' : 'payable',
    opening:        Number(b.OpeningAmount) || 0,
    openDate:       (b.OpeningDate || '').slice(0, 10),
    status:         b.IsActive === false ? 'closed' : 'active',
    includeInCash:  !!b.IsCashInHand,
    createdBy:      b.CreatedBy,
    serverReceived: Number(b.TotalReceived) || 0,
    serverReturned: Number(b.TotalReturned) || 0,
    serverBalance:  Number(b.CurrentBalance) || 0,
    txns:           [],
  };
}

/* API transaction → local ledger entry. Attachment is a URL string; only
   surface it as a real attachment when it points at an uploaded file
   (placeholder values like "…4100nothing" are ignored). */
function mapTxn(t = {}) {
  const rawUrl = t.Attachment || '';
  const url    = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : (rawUrl.startsWith('/') ? buildUrl(rawUrl) : rawUrl);
  const valid  = /\/UploadedImages\//i.test(rawUrl) || /\.(png|jpe?g|gif|webp|pdf)(\?|$)/i.test(rawUrl);
  const isPdf  = /\.pdf(\?|$)/i.test(rawUrl);
  const attachments = valid
    ? [{ name: url.split('/').pop() || 'attachment', size: '', kind: isPdf ? 'pdf' : 'img', data: url, url }]
    : [];
  return {
    id:           t.ID,
    type:         t.PaymentType === 'Received' ? 'received' : 'returned',
    amount:       Number(t.Amount) || 0,
    date:         (t.PaymentDate || '').slice(0, 10),
    notes:        t.Remark || '',
    enteredBy:    t.EnteredBy || '',
    at:           t.CreatedAt || '',
    balanceAfter: Number(t.BalanceAfter) || 0,
    attachments,
  };
}

/* List all books for the active branch. */
export async function getAccBooks() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const res  = await fetch(buildUrl(`/get-account-book-list/${branchID}`), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load account books');
  return (json?.books || []).map(mapBook);
}

/* One book with its full transaction ledger. */
export async function getAccBookDetail(bookId) {
  const res  = await fetch(buildUrl(`/get-account-book-detail/${bookId}`), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not load account book');
  const book = mapBook(json?.book || {});
  book.txns  = (json?.transactions || []).map(mapTxn);
  return book;
}

/* Add (bookID 0) or update (>0) an account book.
   The current user's id is sent as both createdBy and modifiedBy.
   bookType is sent as the API's two labels: 'Payable' | 'Receivable'. */
export async function saveAccBook(payload) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const res = await fetch(buildUrl('/saveupdate-account-book'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookID:        payload.bookID || 0,
      branchID,
      bookTitle:     payload.name || '',
      party:         payload.party || '',
      description:   payload.desc || '',
      isCashInHand:  !!payload.includeInCash,
      bookType:      payload.type === 'payable' ? 'Payable' : 'Receivable',
      openingAmount: Number(payload.opening) || 0,
      openingDate:   payload.openDate ? new Date(payload.openDate).toISOString() : new Date().toISOString(),
      createdBy:     userID,
      modifiedBy:    userID,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save account book');
  return json;
}

/* Delete a book — the backend cascades, removing all its payments first. */
export async function deleteAccBook(bookId) {
  const res  = await fetch(buildUrl(`/delete-account-book/${bookId}`), { method: 'DELETE', headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not delete account book');
  return json;
}

/* Add (ID 0) or update (>0) a ledger entry / payment. Sent as
   multipart/form-data so an optional AttachmentFile can ride along.
   `attachments` carries the local uploader items; the first one holding a
   raw File is uploaded, and any existing remote URL is preserved. */
export async function saveAccBookTxn({ bookId, id = 0, type, amount, date, notes, attachments = [] }) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const userID   = Number(sessionStorage.getItem('UserID')) || 0;
  const fileAtt  = attachments.find(a => a && a.file);
  const urlAtt   = attachments.find(a => a && a.url);

  const fd = new FormData();
  fd.append('ID',          String(id || 0));
  fd.append('BranchID',    String(branchID));
  fd.append('EntryID',     String(bookId));
  fd.append('PaymentType', type === 'received' ? 'Received' : 'Paid');
  fd.append('Amount',      String(Number(amount) || 0));
  fd.append('Remark',      notes || '');
  fd.append('PaymentDate', date ? new Date(date).toISOString() : new Date().toISOString());
  fd.append('Attachment',  urlAtt?.url || '');
  fd.append('CreatedBy',   String(userID));
  fd.append('ModifiedBy',  String(userID));
  if (fileAtt?.file) fd.append('AttachmentFile', fileAtt.file);

  // No Content-Type header — the browser sets the multipart boundary.
  const res  = await fetch(buildUrl('/save-book-entry-payment'), { method: 'POST', headers: { Accept: '*/*' }, body: fd });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not save transaction');
  return json;
}

/* Delete a single ledger entry / payment by its record id. */
export async function deleteAccBookTxn(txnId) {
  const res  = await fetch(buildUrl(`/delete-book-entry-payment/${txnId}`), { method: 'DELETE', headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiMessage(json) || 'Could not delete transaction');
  return json;
}

/* ─── Day Book ka "Created By" ───────────────────────────────────────
   Users ki list aur mojooda user pehle mock/accounts.js se aate thay
   (banawate naam). Ab mojooda user login se aata hai — jo sach hai — aur
   list me bhi wahi ek naam, taake dropdown khali na rahe aur koi ajnabi
   naam bhi na dikhe. */

export async function getAccCurrentUser() {
  try {
    return sessionStorage.getItem('displayName')
      || sessionStorage.getItem('userName')
      || '';
  } catch (e) {
    return '';
  }
}

export async function getAccUsers() {
  const me = await getAccCurrentUser();
  return me ? [me] : [];
}

/* ═══════════════════════════════════════════════════════════════════
   WALLETS (Financial Accounts) + account-to-account TRANSFERS — real API.

   Chain-Management service (not the ERP host), so URLs are built with
   buildChainApiUrl():
     POST /api/accounts/manage-wallat        { action: get | add | update … }
     POST /api/accounts/manage-transactions  { action: get, accountID }
     POST /api/accounts/manage-transfers     { action: get | add | delete … }
     POST /api/accounts/update-wallat-status { id, status, modifiedBy }

   Per product decision: networkID is always null (a wallet belongs to a
   branch, not a network) and branchID is the CURRENT branch (sessionStorage).

   IDs: the API uses numbers, the UI compares/keeps them as strings (select
   values), so rows are mapped to String ids and converted back with Number()
   on the way out.

   The `action` strings for write calls are the only guesses in this file —
   Swagger only documents "get". They are all in WALLET_ACTIONS below so a
   mismatch is a one-line fix.
   ═══════════════════════════════════════════════════════════════════ */
const WALLET_ACTIONS = {
  list: 'GET',
  add: 'INSERT',
  update: 'UPDATE',
  transfersList: 'GET',
  transferAdd: 'INSERT',
  transferDelete: 'DELETE',
  txnList: 'GET',
};

/* Wire value for the status endpoints, and the words we accept back. */
const WALLET_STATUS_WIRE = { active: 'Active', inactive: 'Inactive' };

const sessNum = (key) => Number(sessionStorage.getItem(key)) || 0;

/* One POST helper for all four endpoints. Throws on HTTP / success:false. */
async function chainPost(path, body) {
  const res = await fetch(buildChainApiUrl(path), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false || json?.isSuccess === false) {
    /* ASP.NET validation errors: show the real field messages, not just the generic title. */
    const detail = json?.errors && typeof json.errors === 'object'
      ? Object.values(json.errors).flat().join(' ')
      : '';
    throw new Error(detail || apiMessage(json) || json?.message || json?.title || 'Request failed');
  }
  return json;
}

/* Rows can come back bare, or wrapped as { data | result | items | records }. */
function unwrapRows(json) {
  if (Array.isArray(json)) return json;
  for (const k of ['data', 'result', 'results', 'items', 'records']) {
    const v = json?.[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return [v];
  }
  return [];
}

/* Common envelope — networkID is ALWAYS null, branchID is the current branch. */
/* Backend model declares networkID as a non-nullable Int32, so JSON null is rejected
   (400 "could not be converted to System.Int32"). 0 = "no network" — the wallet
   belongs to the current branch only. */
const scope = () => ({ networkID: null, branchID: sessNum('branchID') });/* DateTime is non-nullable too — list/delete calls send "now" instead of null. */
const nowISO = () => new Date().toISOString();

const toDateOnly = (v) => (v ? String(v).slice(0, 10) : '');

/* ── Wallets ── */
function normalizeWalletType(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (!t) return 'other';
  if (t.includes('cash')) return 'cash';
  if (t.includes('bank')) return 'bank';
  if (t.includes('owner') || t.includes('investor')) return 'owner';
  return 'other';
}
const WALLET_TYPE_WIRE = { cash: 'Cash', bank: 'Bank', owner: 'Owner', other: 'Other' };

function normalizeWalletStatus(raw) {
  if (raw === true || raw === 1) return 'active';
  if (raw === false || raw === 0) return 'inactive';
  const s = String(raw ?? '').trim().toLowerCase();
  if (['inactive', 'disabled', 'disable', 'closed', 'false', '0', 'blocked'].includes(s)) return 'inactive';
  return 'active';
}

function mapWallet(w = {}) {
  const bal = pick(w, 'currentBalance', 'CurrentBalance', 'balance', 'Balance', 'availableBalance', 'AvailableBalance', 'closingBalance');
  return {
    id:          String(pick(w, 'id', 'ID', 'accountID', 'AccountID')),
    name:        pick(w, 'accountName', 'AccountName', 'name') || '',
    type:        normalizeWalletType(pick(w, 'accountType', 'AccountType', 'type')),
    opening:     Number(pick(w, 'openingBalance', 'OpeningBalance', 'opening') || 0),
    bankName:    pick(w, 'bankName', 'BankName') || '',
    accountNo:   pick(w, 'accountNo', 'AccountNo', 'accountNumber', 'AccountNumber') || '',
    description: pick(w, 'description', 'Description') || '',
    status:      normalizeWalletStatus(pick(w, 'status', 'Status', 'isActive', 'IsActive')),
    isDefault:   pick(w, 'isDefault', 'IsDefault') === true,
    createdBy:   pick(w, 'createdByName', 'CreatedByName', 'createdBy', 'CreatedBy') || '',
    createdAt:   pick(w, 'createdAt', 'CreatedAt', 'createdDate') || '',
    /* Server-calculated balance when the API sends one; null → computed locally. */
    serverBalance: bal === undefined ? null : Number(bal),
  };
}

export async function getFinAccounts() {
  const json = await chainPost('/api/accounts/manage-wallat', {
    action: WALLET_ACTIONS.list,
    id: 0,
    ...scope(),
    accountName: '',
    accountType: '',
    openingBalance: 0,
    status: '',
    description: '',
    createdBy: 0,
    modifiedBy: 0,
  });
  return unwrapRows(json).map(mapWallet).filter((w) => w.id && w.id !== 'undefined');
}

/* Add (no id) or update (id) a wallet. Callers reload the list afterwards —
   the write response is not relied upon to carry the saved row. */
export async function saveFinAccount(payload, id) {
  const userID = sessNum('UserID');
  const isEdit = !!id;
  return chainPost('/api/accounts/manage-wallat', {
    action: isEdit ? WALLET_ACTIONS.update : WALLET_ACTIONS.add,
    id: isEdit ? Number(id) : 0,
    ...scope(),
    accountName: payload.name || '',
    accountType: WALLET_TYPE_WIRE[payload.type] || 'Other',
    openingBalance: Number(payload.opening) || 0,
    status: WALLET_STATUS_WIRE[payload.status] || WALLET_STATUS_WIRE.active,
    description: payload.description || '',
    /* Not part of the documented contract (ignored by the server today);
       sent so bank details persist the moment the backend accepts them. */
    bankName: payload.bankName || '',
    accountNo: payload.accountNo || '',
    createdBy: userID,
    modifiedBy: userID,
  });
}

export async function setFinAccountStatus({ id, status }) {
  return chainPost('/api/accounts/update-wallat-status', {
    id: Number(id),
    status: WALLET_STATUS_WIRE[status] || WALLET_STATUS_WIRE.active,
    modifiedBy: sessNum('UserID'),
  });
}

/* ── Transfers ── */
function mapTransfer(t = {}) {
  const date = toDateOnly(pick(t, 'date', 'Date', 'transferDate', 'TransferDate'));
  const at   = pick(t, 'createdAt', 'CreatedAt', 'enteredAt', 'date', 'Date') || date;
  return {
    id:     String(pick(t, 'id', 'ID')),
    fromId: String(pick(t, 'fromAccountID', 'FromAccountID', 'fromAccountId')),
    toId:   String(pick(t, 'toAccountID', 'ToAccountID', 'toAccountId')),
    amount: Number(pick(t, 'amount', 'Amount') || 0),
    date,
    note:   pick(t, 'note', 'Note', 'remark', 'Remark') || '',
    by:     pick(t, 'enteredByName', 'EnteredByName', 'enteredBy', 'EnteredBy') || '',
    at:     String(at),
  };
}

export async function getTransfers() {
  const json = await chainPost('/api/accounts/manage-transfers', {
    action: WALLET_ACTIONS.transfersList,
    id: 0,
    ...scope(),
    fromAccountID: 0,
    toAccountID: 0,
    amount: 0,
    date: nowISO(),
    enteredBy: 0,
    note: '',
  });
  return unwrapRows(json).map(mapTransfer).filter((t) => t.id && t.id !== 'undefined');
}

export async function saveTransfer(payload) {
  return chainPost('/api/accounts/manage-transfers', {
    action: WALLET_ACTIONS.transferAdd,
    id: 0,
    ...scope(),
    fromAccountID: Number(payload.fromId),
    toAccountID: Number(payload.toId),
    amount: Number(payload.amount) || 0,
    date: payload.date ? new Date(payload.date).toISOString() : new Date().toISOString(),
    enteredBy: sessNum('UserID'),
    note: payload.note || '',
  });
}

export async function deleteTransfer({ id }) {
  await chainPost('/api/accounts/manage-transfers', {
    action: WALLET_ACTIONS.transferDelete,
    id: Number(id),
    ...scope(),
    fromAccountID: 0,
    toAccountID: 0,
    amount: 0,
    date: nowISO(),
    enteredBy: sessNum('UserID'),
    note: '',
  });
  return { id, deleted: true };
}

/* ── Wallet transactions (statement ledger) ──
   Each row is projected onto the statement's move shape:
   { date, desc, ref, cat: 'revenue'|'expense'|'transfer', kind: 'credit'|'debit', amount } */
function mapWalletTxn(t = {}) {
  const rawAmt = Number(pick(t, 'amount', 'Amount') || 0);
  const credit = Number(pick(t, 'credit', 'Credit', 'creditAmount', 'CreditAmount') || 0);
  const debit  = Number(pick(t, 'debit', 'Debit', 'debitAmount', 'DebitAmount') || 0);
  const typeStr = String(pick(t, 'transactionType', 'TransactionType', 'type', 'Type', 'entryType', 'drCr', 'direction') || '').toLowerCase();
  const refStr  = String(pick(t, 'referenceType', 'ReferenceType', 'source', 'Source', 'category', 'Category') || '');

  let kind;
  let amount = Math.abs(rawAmt);
  if (credit || debit) { kind = credit >= debit ? 'credit' : 'debit'; amount = credit || debit; }
  else if (/credit|\bcr\b|\bin\b|receiv|deposit|income|revenue/.test(typeStr)) kind = 'credit';
  else if (/debit|\bdr\b|\bout\b|paid|withdraw|expense|payment/.test(typeStr)) kind = 'debit';
  else kind = rawAmt < 0 ? 'debit' : 'credit';

  const isTransfer = /transfer/.test(typeStr) || /transfer/i.test(refStr);
  /* Wallet create hone par server ek ACCOUNT_OPENING row bhi bhejta hai; statement
     apni Opening Balance row khud banata hai, is liye isay skip karna hai. */
  const isOpening = /opening/i.test(refStr) || /opening/.test(typeStr);  const desc = pick(t, 'description', 'Description', 'details', 'Details', 'note', 'Note', 'remark', 'Remark') || '';
  return {
    date:   toDateOnly(pick(t, 'date', 'Date', 'transactionDate', 'TransactionDate', 'entryDate', 'createdAt')),
    desc,
    ref:    refStr || (isTransfer ? 'Transfer' : (kind === 'credit' ? 'Revenue' : 'Expense')),
    cat:    isTransfer ? 'transfer' : (kind === 'credit' ? 'revenue' : 'expense'),
      kind,
    amount,
    isOpening,
  };
}
export async function getWalletTransactions(accountId) {
  const json = await chainPost('/api/accounts/manage-transactions', {
    action: WALLET_ACTIONS.txnList,
    id: 0,
    ...scope(),
    accountID: Number(accountId),
  });
  return unwrapRows(json).map(mapWalletTxn).filter((m) => m.date && !m.isOpening);}

/* Server balance when the wallet API sends one; otherwise
   balance = opening + revenue(acctId||default) − expense(acctId||default)
            + transfers-in − transfers-out. */
export function computeFinAccountBalance(account, txns, transfers, defaultId) {
  if (account && account.serverBalance != null && Number.isFinite(account.serverBalance)) return account.serverBalance;
  let bal = Number(account.opening) || 0;
  (txns?.rev || []).forEach((t) => { if ((t.acctId || defaultId) === account.id) bal += Number(t.amount) || 0; });
  (txns?.exp || []).forEach((t) => { if ((t.acctId || defaultId) === account.id) bal -= Number(t.amount) || 0; });
  (transfers || []).forEach((tr) => {
    if (tr.toId === account.id) bal += Number(tr.amount) || 0;
    if (tr.fromId === account.id) bal -= Number(tr.amount) || 0;
  });
  return bal;
}