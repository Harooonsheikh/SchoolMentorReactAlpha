/* Schools Payment service — billing setup, challan generation, receiving
   and the monthly report. */
import { resolve, request } from '../client';
import EP from '../endpoints';
import { PAY_SCHOOLS, INITIAL_PAY_SETUP, monthlyCharge } from '../../paymentData';

export const listPaySchools = () =>
  resolve(() => PAY_SCHOOLS, () => request(EP.payments.schools()));

export const getSetup = (schoolId) =>
  resolve(() => INITIAL_PAY_SETUP[schoolId] || null, () => request(EP.payments.setup(schoolId)));

export const saveSetup = (schoolId, setup) =>
  resolve(() => setup, () => request(EP.payments.setup(schoolId), { method: 'PUT', body: setup }));

export const generateChallan = (challan) =>
  resolve(() => ({ id: Date.now(), ...challan }), () => request(EP.payments.challans(), { method: 'POST', body: challan }));

export const generateBulkChallans = (payload) =>
  resolve(() => ({ created: (payload.schoolIds || []).length }), () => request(EP.payments.bulkChallans(), { method: 'POST', body: payload }));

export const recordReceiving = (receiving) =>
  resolve(() => ({ id: Date.now(), ...receiving }), () => request(EP.payments.receiving(), { method: 'POST', body: receiving }));

export const getChallans = (month) =>
  resolve(() => [], () => request(EP.payments.challans(), { query: { month } }));

export const getReport = (month) =>
  resolve(
    () => PAY_SCHOOLS.map((s) => {
      const setup = INITIAL_PAY_SETUP[s.id];
      return { schoolId: s.id, name: s.name, monthly: setup ? monthlyCharge(s, setup) : 0 };
    }),
    () => request(EP.payments.report(), { query: { month } }),
  );
