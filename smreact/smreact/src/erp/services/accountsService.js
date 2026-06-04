import {
  mockAccTypes,
  mockAccNextHeadNo,
  mockAccTxns,
  mockAccUsers,
  mockAccCurrentUser,
  mockAccSchool,
  mockAccBooks,
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
export async function saveAccTxn(payload) {
  await delay();
  return clone({ ...payload, ok: true });
}
export async function deleteAccTxn({ seg, id }) {
  await delay();
  return { seg, id, deleted: true };
}

/* Account Books APIs */
export async function getAccBooks()                       { await delay(); return clone(mockAccBooks); }
export async function saveAccBook(payload)                { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteAccBook({ bookId })           { await delay(); return { bookId, deleted: true }; }
export async function saveAccBookTxn({ bookId, ...rest }) { await delay(); return clone({ bookId, ...rest, ok: true }); }
export async function deleteAccBookTxn({ bookId, txnId }) { await delay(); return { bookId, txnId, deleted: true }; }
