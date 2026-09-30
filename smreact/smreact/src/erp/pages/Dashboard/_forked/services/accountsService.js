import {
  mockAccTypes,
  mockAccNextHeadNo,
  mockAccTxns,
  mockAccUsers,
  mockAccCurrentUser,
  mockAccSchool,
  mockAccBooks,
  mockFinAccounts,
  mockTransfers,
} from '../mock/accounts';
import { delay, clone } from './_http';

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getAccTypes()       { await delay(); return clone(mockAccTypes); }
export async function getAccNextHeadNo()  { await delay(); return mockAccNextHeadNo; }
export async function getAccTxns()        { await delay(); return clone(mockAccTxns); }
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
/* Applies a txn create/update against the live mockAccTxns[seg] array.
   Shared by the direct-save path (saveAccTxn) and the Approvals engine's
   post-approval handler (applyApprovedTxnEdit) so both perform the same
   real mutation instead of one being a no-op stub. */
function writeAccTxn({ seg, id, ...fields }) {
  const list = mockAccTxns[seg] || (mockAccTxns[seg] = []);
  const idx = id ? list.findIndex(x => x.id === id) : -1;
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...fields, id: list[idx].id };
    return list[idx];
  }
  const record = { id: id || `${seg}-${list.length + 1}`, ...fields };
  list.push(record);
  return record;
}

/* Splices a txn out of the live mockAccTxns[seg] array. Shared by the
   direct-delete path (deleteAccTxn) and the Approvals engine's
   post-approval handler (applyApprovedTxnDelete). */
function removeAccTxn({ seg, id }) {
  const list = mockAccTxns[seg] || [];
  const idx = list.findIndex(x => x.id === id);
  if (idx >= 0) list.splice(idx, 1);
  return { seg, id, deleted: true };
}

export async function saveAccTxn(payload) {
  await delay();
  const record = writeAccTxn(payload);
  return clone({ ...record, ok: true });
}
export async function deleteAccTxn({ seg, id }) {
  await delay();
  return removeAccTxn({ seg, id });
}

/* ── Approvals engine handlers ────────────────────────────────────────
   Called ONLY by approvalsService.approveRequest(), with ONLY the
   payload captured at the request's creation time. Names must match
   exactly what approvalsService's ACTION_HANDLERS map references. */
export async function applyApprovedTxnEdit(payload) {
  await delay();
  const record = writeAccTxn(payload);
  return clone({ ...record, ok: true });
}
export async function applyApprovedTxnDelete(payload) {
  await delay();
  return removeAccTxn(payload);
}

/* Account Books APIs */
export async function getAccBooks()                       { await delay(); return clone(mockAccBooks); }
export async function saveAccBook(payload)                { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteAccBook({ bookId })           { await delay(); return { bookId, deleted: true }; }
export async function saveAccBookTxn({ bookId, ...rest }) { await delay(); return clone({ bookId, ...rest, ok: true }); }
export async function deleteAccBookTxn({ bookId, txnId }) { await delay(); return { bookId, txnId, deleted: true }; }

/* ── Financial Accounts (Accounts Management) ────────────────────────
   Where the school's money physically sits (cash/bank/owner/other) —
   separate from Chart of Accounts heads and from Account Books'
   payable/receivable ledgers. Balances are always derived, never
   stored, via computeFinAccountBalance() below, so create/edit only
   ever writes the account's own fields. */
export async function getFinAccounts() { await delay(); return clone(mockFinAccounts); }

export async function saveFinAccount(payload, id) {
  await delay();
  const idx = id ? mockFinAccounts.findIndex(a => a.id === id) : -1;
  if (idx >= 0) {
    // The default account's status can never be changed via this path either —
    // mirrors the UI's own disabled Status control when editing it.
    const isDefault = mockFinAccounts[idx].isDefault;
    mockFinAccounts[idx] = { ...mockFinAccounts[idx], ...payload, status: isDefault ? 'active' : payload.status };
    return clone(mockFinAccounts[idx]);
  }
  const record = { id: `ac_${Date.now()}`, isDefault: false, status: 'active', bankName: '', accountNo: '', description: '', ...payload };
  mockFinAccounts.push(record);
  return clone(record);
}

export async function setFinAccountStatus({ id, status }) {
  await delay();
  const acct = mockFinAccounts.find(a => a.id === id);
  if (!acct) return { id, ok: false };
  if (acct.isDefault) return { id, ok: false, reason: 'default-account' };
  acct.status = status;
  return clone(acct);
}

export async function getTransfers() { await delay(); return clone(mockTransfers); }

export async function saveTransfer(payload) {
  await delay();
  const record = { id: `tr_${Date.now()}`, at: new Date().toISOString(), ...payload };
  mockTransfers.push(record);
  return clone(record);
}

export async function deleteTransfer({ id }) {
  await delay();
  const idx = mockTransfers.findIndex(t => t.id === id);
  if (idx >= 0) mockTransfers.splice(idx, 1);
  return { id, deleted: true };
}

/* Single source of truth for a Financial Account's balance — the
   account cards, the per-account Statement, and the Accounts Summary
   report all call this instead of each re-deriving the formula.
     balance = opening
       + revenue txns where (txn.acctId || defaultId) === account.id
       − expense txns where (txn.acctId || defaultId) === account.id
       + transfers.amount where transfer.toId === account.id
       − transfers.amount where transfer.fromId === account.id
   The `txn.acctId || defaultId` fallback is what makes every existing
   transaction (none of which have an acctId) count toward the default
   account automatically — no one-time data migration needed. */
export function computeFinAccountBalance(account, txns, transfers, defaultId) {
  let bal = Number(account.opening) || 0;
  (txns?.rev || []).forEach((t) => { if ((t.acctId || defaultId) === account.id) bal += Number(t.amount) || 0; });
  (txns?.exp || []).forEach((t) => { if ((t.acctId || defaultId) === account.id) bal -= Number(t.amount) || 0; });
  (transfers || []).forEach((tr) => {
    if (tr.toId === account.id) bal += Number(tr.amount) || 0;
    if (tr.fromId === account.id) bal -= Number(tr.amount) || 0;
  });
  return bal;
}
