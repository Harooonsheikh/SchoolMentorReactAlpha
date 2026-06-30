import {
  mockAccNextHeadNo,
  mockAccTxns,
  mockAccUsers,
  mockAccCurrentUser,
  mockAccSchool,
} from '../mock/accounts';
import { delay, clone } from './_http';
import { buildUrl, apiMessage } from '../../utils/apiConfig';

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
export async function getAccNextHeadNo()  { await delay(); return mockAccNextHeadNo; }
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

export async function getAccTxns() {
  const ym = new Date().toISOString().slice(0, 7);
  return getAccEntriesForMonths([ym]).catch(async () => {
    await delay();
    return clone(mockAccTxns);
  });
}
export async function getAccUsers()       { await delay(); return clone(mockAccUsers); }
export async function getAccCurrentUser() { await delay(); return mockAccCurrentUser; }
export async function getAccSchool()      { await delay(); return clone(mockAccSchool); }

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
