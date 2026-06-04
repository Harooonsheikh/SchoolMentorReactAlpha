import {
  mockInvCategories,
  mockInvNextItemId,
  mockInvNextProdId,
  mockInvNextReceiptNo,
  mockInvItems,
  mockInvProducts,
  mockInvSales,
  mockInvUsers,
  mockInvCurrentUser,
  mockInvSchool,
} from '../mock/inventory';
import { delay, clone } from './_http';

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getInvCategories()    { await delay(); return clone(mockInvCategories); }
export async function getInvNextItemId()    { await delay(); return mockInvNextItemId; }
export async function getInvNextProdId()    { await delay(); return mockInvNextProdId; }
export async function getInvNextReceiptNo() { await delay(); return mockInvNextReceiptNo; }
export async function getInvItems()         { await delay(); return clone(mockInvItems); }
export async function getInvProducts()      { await delay(); return clone(mockInvProducts); }
export async function getInvSales()         { await delay(); return clone(mockInvSales); }
export async function getInvUsers()         { await delay(); return clone(mockInvUsers); }
export async function getInvCurrentUser()   { await delay(); return mockInvCurrentUser; }
export async function getInvSchool()        { await delay(); return clone(mockInvSchool); }

/* Write APIs — in-memory only until backend wires real endpoints. */
export async function saveInvItem(payload)    { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteInvItem({ id })   { await delay(); return { id, deleted: true }; }
export async function saveInvProduct(payload) { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteInvProduct({ id }){ await delay(); return { id, deleted: true }; }
export async function saveInvSale(payload)    { await delay(); return clone({ ...payload, ok: true }); }
