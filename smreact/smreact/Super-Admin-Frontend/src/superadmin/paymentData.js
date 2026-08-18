/* ═══════════════════════════════════════════════════════════════════
   SCHOOLS PAYMENT (Payment Status) — demo data + helpers (frontend only)

   Ported from "User Permission, quiz, SOPs, and PAYMENTS .html". Reuses the
   same school groups as School Status (launch / erp / inactive), then layers
   three stores on top:
     • payStore  — billing setup per school (formula / amounts / trial)
     • chStore   — generated challans
     • recvStore — fee-receiving records (+ history)
   Mock data only — the integrating developer swaps these for API calls.
   ═══════════════════════════════════════════════════════════════════ */
import { INITIAL_LAUNCH, INITIAL_ERP, INITIAL_INACTIVE } from './statusData';

const ini = (name) => name.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'SM';

/* All schools combined for payment, each with a 6-digit code + initials. */
export const PAY_SCHOOLS = [...INITIAL_LAUNCH, ...INITIAL_ERP, ...INITIAL_INACTIVE].map((s) => ({
  id: s.id,
  name: s.name,
  principal: s.principal || '',
  contact: s.contact || '',
  students: s.students || 0,
  initials: s.initials || ini(s.name),
  schoolCode: String(s.id).padStart(6, '0'),
}));

/* Seeded billing setup for the ERP schools (so challans/receiving have data). */
export const INITIAL_PAY_SETUP = {
  201: { formula: 'lumpsum',    lumpAmount: '3000', perStudentRate: '',   studentCount: '4',   freeTrial: false, trialDays: '',   notes: '' },
  202: { formula: 'perstudent', lumpAmount: '',     perStudentRate: '25', studentCount: '18',  freeTrial: false, trialDays: '',   notes: '' },
  203: { formula: 'perstudent', lumpAmount: '',     perStudentRate: '30', studentCount: '89',  freeTrial: false, trialDays: '',   notes: '' },
  204: { formula: 'perstudent', lumpAmount: '',     perStudentRate: '30', studentCount: '210', freeTrial: false, trialDays: '',   notes: '' },
  205: { formula: 'perstudent', lumpAmount: '',     perStudentRate: '25', studentCount: '345', freeTrial: true,  trialDays: '30', notes: 'First year discount' },
  206: { formula: 'lumpsum',    lumpAmount: '8000', perStudentRate: '',   studentCount: '180', freeTrial: false, trialDays: '',   notes: '' },
  207: { formula: 'perstudent', lumpAmount: '',     perStudentRate: '35', studentCount: '420', freeTrial: false, trialDays: '',   notes: 'Premium tier' },
  208: { formula: 'lumpsum',    lumpAmount: '5000', perStudentRate: '',   studentCount: '155', freeTrial: false, trialDays: '',   notes: '' },
  209: { formula: 'perstudent', lumpAmount: '',     perStudentRate: '28', studentCount: '380', freeTrial: false, trialDays: '',   notes: '' },
  210: { formula: 'perstudent', lumpAmount: '',     perStudentRate: '30', studentCount: '290', freeTrial: false, trialDays: '',   notes: '' },
};

export const RECEIVING_METHODS = [
  'Bank Account (School Mentor App-Private Limited)',
  'Cash', 'Easypaisa', 'JazzCash', 'Cheque',
];

/* Monthly charge from a school's billing setup. */
export function monthlyCharge(school, setup) {
  if (!setup) return 0;
  if (setup.formula === 'lumpsum') return parseFloat(setup.lumpAmount || 0) || 0;
  if (setup.formula === 'perstudent') {
    const rate = parseFloat(setup.perStudentRate || 0) || 0;
    const count = parseInt(setup.studentCount || school.students || 0, 10) || 0;
    return rate * count;
  }
  return 0;
}

export const pkr = (v) => `PKR ${Number(v || 0).toLocaleString()}`;
export const kfmt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : Number(v || 0).toLocaleString());

export const fmtDateLong = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
export const fmtDateShort = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
export const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const todayISO = () => new Date().toISOString().slice(0, 10);

/* Derive the full payment row state for a school (used by reports + receiving). */
export function deriveRow(school, setup, challan, recv) {
  /* Summary API apna hisaab `totalAmount` me khud deti hai — jab wo maujood
     ho wahi sach hai, warna formula se nikala jata hai (demo rows / abhi type
     ho raha setup). Wahi qaida Setup tab aur challan slip par bhi hai, taake
     Reports un se kabhi alag na batayein. */
  const fromApi = Number(setup?.totalAmount);
  const monthly = setup ? (fromApi > 0 ? fromApi : monthlyCharge(school, setup)) : 0;
  const payable = challan ? challan.total : monthly;
  const received = recv ? (recv.receivedAmount || 0) : 0;
  const outstanding = recv ? (recv.remainingAmount || 0) : payable;
  let status;
  if (!setup) status = 'no-setup';
  else if (received >= payable && payable > 0) status = 'paid';
  else if (received > 0) status = 'partial';
  else if (payable > 0) status = 'unpaid';
  else status = 'no-setup';
  return { monthly, payable, received, outstanding, status };
}
