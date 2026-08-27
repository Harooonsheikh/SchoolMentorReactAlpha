/* 1LINK / 1Bill Transaction Monitoring service — the raw transaction
   ledger + rate configuration. Network summary, school-wise breakdown and
   both reports are derived CLIENT-SIDE from listTransactions() via the
   calculation helpers in ../../transactionData (same approach
   payments.getReport already uses for Schools Payment) rather than
   requiring dedicated summary endpoints — EP.transactions.summary /
   schoolWise / report / revenueReport are documented in endpoints.js as
   the contract for when a backend wants to do that aggregation server-side
   instead (e.g. once the real network is too large to ship the full
   ledger to the client). */
import { resolve, request } from '../client';
import EP from '../endpoints';
import { INITIAL_TRANSACTIONS, TXN_RATE_CONFIG_INITIAL } from '../../transactionData';

/* NOTE: dono mock factories ab KHALI hain — INITIAL_TRANSACTIONS = [] aur
   rates 0/0. Pehle yahan ek generated demo ledger aata tha jis se dashboard
   par lakhon ki collection/revenue dikhti thi. Ab backend na hone par screen
   saaf 0 dikhati hai, aur base URL set karte hi live route chal padta hai. */
export const listTransactions = (filters) =>
  resolve(() => INITIAL_TRANSACTIONS, () => request(EP.transactions.list(), { query: filters }));

export const getRateConfig = () =>
  resolve(() => TXN_RATE_CONFIG_INITIAL, () => request(EP.transactions.rateConfig()));

/* Mock mode just echoes the payload back (the owning component keeps the
   authoritative copy in state, same pattern SchoolPayment.jsx uses for
   payStore after saveSetup()) — live mode persists it via the API. */
export const updateRateConfig = (payload) =>
  resolve(() => payload, () => request(EP.transactions.rateConfig(), { method: 'PUT', body: payload }));
