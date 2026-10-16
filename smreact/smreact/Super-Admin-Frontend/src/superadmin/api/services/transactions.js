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
import { INITIAL_TRANSACTIONS } from '../../transactionData';
import { getTransactionRateConfig, saveTransactionRateConfig } from './schoolProgress';

/* NOTE: dono mock factories ab KHALI hain — INITIAL_TRANSACTIONS = [] aur
   rates 0/0. Pehle yahan ek generated demo ledger aata tha jis se dashboard
   par lakhon ki collection/revenue dikhti thi. Ab backend na hone par screen
   saaf 0 dikhati hai, aur base URL set karte hi live route chal padta hai. */
export const listTransactions = (filters) =>
  resolve(() => INITIAL_TRANSACTIONS, () => request(EP.transactions.list(), { query: filters }));

/* Rate config ab LIVE SchoolMentorSuperAdminAPI par hai — AHM_School_Progress
   controller ke get/save routes (dekho schoolProgress service). Baqi Schools
   Progress screen ki tarah ye hamesha asli API par jata hai: GET se saved rate
   mapped UI shape me aati hai, aur save ke baad wahi (naya id samet) wapas
   milti hai, taake modal dobara khulne par fields us data se bhari hui aayein. */
export const getRateConfig = () => getTransactionRateConfig();

export const updateRateConfig = (payload) => saveTransactionRateConfig(payload);
