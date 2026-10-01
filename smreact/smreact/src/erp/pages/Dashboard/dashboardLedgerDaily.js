/* ═══════════════════════════════════════════════════════════════════
   Dashboard DAILY reports — REAL branch data.

   Pehle Daily Fee Receiving / Daily Advance Payment / Daily Advance
   Adjustment reports `_forked/services/feeService` (mock/fee.js) ka
   bana-banaya data dikhate the — har branch par wahi jhoote naam aur
   raqam. Ab teeno usi BranchLedger API se chalte hain jis se Fee →
   Reports (Daily Collections, Advance Fee, Advance Adjustment) chalte
   hain:
     GET /api/BranchLedger/get-with-installments?branchId={branchID}&month&year
   (useLedgerReportData → feeService.getMonthChallans), aur class/student
   roster get-class-section-studentlist-by-branch/{branchID} se.
   branchID hamesha sessionStorage se — yani current branch.
   ═══════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from 'react';
import { useLedgerReportData, ledgerAdvanceEvents } from '../../components/Fee';
import * as feeService from '../../services/feeService';

/* Local (Pakistan) date — toISOString() UTC deta hai, raat 12–5 baje
   pichhla din aa jata tha. */
export function localISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Selected date ke mahine se `back` mahine pehle tak + agla 1 mahina
   (advance challan pehle ban sakta hai). Receipt kisi pichhle mahine ke
   challan par bhi ho sakti hai — Fee ki Daily Collections bhi 6 mahine
   pichhe tak load karti hai. */
function periodsAround(dateISO, back) {
  const d = new Date(`${dateISO}T00:00:00`);
  if (!dateISO || isNaN(d.getTime())) return [];
  const out = [];
  for (let i = -back; i <= 1; i += 1) {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push({ month: x.getMonth() + 1, year: x.getFullYear() });
  }
  return out;
}

const isCarryRow = (r) => /previous\s*pending|arrears?/i.test(String(r.subHead || r.head || ''));
const usableRows = (rec) => (rec?.detailRows || []).filter(r => !((+r.challanAmount || 0) < 0 && isCarryRow(r)));
const headName = (r) => String(r.subHead || r.head || '—');

/* Ek challan ki saari wasooliyan, HEAD-wise (Fee Head column ke liye).
   Installments na hon to challan-level receivedDate wala fallback —
   Fee.jsx ke ledgerInstallmentReceipts jaisa. */
function receiptLines(rec) {
  const rows = usableRows(rec);
  const lines = [];
  rows.forEach(r => (r.installments || []).forEach(inst => {
    const amount = +inst.receivedAmount || 0;
    if (!amount) return;
    const created = String(inst.createdAt || '');
    lines.push({
      no: +inst.installmentNo || 1,
      date: String(inst.receivedDate || rec.receivedDate || '').slice(0, 10),
      time: created.length >= 16 ? created.slice(11, 16) : '',
      byId: inst.createdBy || null,
      head: headName(r),
      amount,
    });
  }));
  if (lines.length) return lines;
  const when = String(rec.receivedDate || rec.modifiedAt || '').slice(0, 10);
  const time = String(rec.modifiedAt || '').slice(11, 16);
  rows.forEach(r => {
    const amount = +r.receivedAmount || 0;
    if (amount) lines.push({ no: 1, date: when, time, byId: rec.modifiedBy || null, head: headName(r), amount });
  });
  return lines;
}

const challanPayable = (rec) => Math.round(usableRows(rec).reduce((a, r) => a + ((+r.challanAmount || 0) - (+r.discount || 0)), 0));

/* Ledger + roster ek jagah. `monthsBack` = kitne pichhle mahine load karne. */
export function useDailyLedger(date, monthsBack = 6) {
  const periods = useMemo(() => periodsAround(date, monthsBack), [date, monthsBack]);
  const { allStudents, records, loading, error } = useLedgerReportData(periods);

  /* studentID / applicantsID → { c, s } — Fee ki Daily Collections jaisa. */
  const byStudent = useMemo(() => {
    const m = new Map();
    (allStudents || []).forEach(({ c, s }) => {
      if (s.studentID != null) m.set(String(s.studentID), { c, s });
      if (s.applicantsID != null && !m.has(String(s.applicantsID))) m.set(String(s.applicantsID), { c, s });
    });
    return m;
  }, [allStudents]);

  return { records: records || [], byStudent, loading, error };
}

/* Login user id → employee ka naam ("Received By"). */
export function useLoginNames(ids) {
  const [names, setNames] = useState({});
  const key = [...new Set((ids || []).filter(Boolean).map(String))].sort().join(',');
  useEffect(() => {
    const missing = key ? key.split(',').filter(id => !(id in names)) : [];
    if (!missing.length) return undefined;
    let alive = true;
    Promise.all(missing.map(id => feeService.getEmployeeNameByLoginUser(id).then(n => [id, n]).catch(() => [id, null])))
      .then(pairs => { if (alive) setNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return names;
}

/* ─── 1. Daily Fee Receiving — har (receipt, fee head) ek row ─── */
export function buildDailyReceivingFromLedger(records, byStudent, date) {
  const rows = [];
  const paidStudents = new Set();
  const txns = new Set();
  let totalAmount = 0;
  if (!date) return { rows, totalAmount, studentsPaid: 0, transactions: 0 };

  records.forEach(rec => {
    const who = byStudent.get(String(rec.studentID));
    if (!who) return;
    const method = feeService.paymentMethodDisplay(rec.paymentMethod) || '—';
    receiptLines(rec).forEach(l => {
      if (l.date !== date) return;
      totalAmount += l.amount;
      paidStudents.add(`${who.c.key}|${who.s.reg}`);
      txns.add(`${rec.id}|${l.no}`);
      rows.push({
        reg: who.s.reg, studentName: who.s.name, cls: who.c.cls, sec: who.c.sec,
        head: l.head, amount: Math.round(l.amount), method, byId: l.byId, time: l.time || '—',
      });
    });
  });
  rows.sort((a, b) => String(a.time).localeCompare(String(b.time)) || a.studentName.localeCompare(b.studentName));
  return { rows, totalAmount: Math.round(totalAmount), studentsPaid: paidStudents.size, transactions: txns.size };
}

/* Student-wise challans (advance hamesha student ki poori history par). */
function groupByStudent(records) {
  const g = new Map();
  records.forEach(rec => {
    const k = String(rec.studentID);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(rec);
  });
  return g;
}

/* ─── 2. Daily Advance Payment — us din kitna NAYA advance bana ─── */
export function buildDailyAdvanceFromLedger(records, byStudent, date) {
  const rows = [];
  let totalAmount = 0, transactions = 0;
  if (!date) return { rows, totalAmount, studentsPaid: 0, transactions };

  groupByStudent(records).forEach((recs, sid) => {
    const who = byStudent.get(sid);
    if (!who) return;
    let events = [];
    try { events = (ledgerAdvanceEvents(recs) || {}).events || []; } catch { /* ignore */ }
    const advanceToday = events
      .filter(e => e.type === 'recv' && !e.opening && e.date === date)
      .reduce((a, e) => a + e.amount, 0);
    if (advanceToday <= 0) return;

    /* Us din ki wasooli aur jin challans par hui. */
    let received = 0, payable = 0, last = null, method = '—';
    const txnKeys = new Set();
    recs.forEach(rec => {
      const today = receiptLines(rec).filter(l => l.date === date);
      if (!today.length) return;
      payable += challanPayable(rec);
      method = feeService.paymentMethodDisplay(rec.paymentMethod) || method;
      today.forEach(l => {
        received += l.amount;
        txnKeys.add(`${rec.id}|${l.no}`);
        if (!last || `${l.time}` > `${last.time}`) last = l;
      });
    });
    transactions += txnKeys.size || 1;
    totalAmount += advanceToday;
    rows.push({
      reg: who.s.reg, studentName: who.s.name, cls: who.c.cls, sec: who.c.sec,
      payable: Math.round(payable), amountReceived: Math.round(received), advanceAmount: Math.round(advanceToday),
      method, byId: last?.byId || null, time: last?.time || '—',
    });
  });
  rows.sort((a, b) => a.cls.localeCompare(b.cls) || a.studentName.localeCompare(b.studentName));
  return { rows, totalAmount: Math.round(totalAmount), studentsPaid: rows.length, transactions };
}

/* ─── 3. Daily Advance Adjustment — us din advance kis challan me adjust hua ─── */
export function buildDailyAdjustmentFromLedger(records, byStudent, date) {
  const rows = [];
  let totalAmount = 0;
  if (!date) return { rows, totalAmount, studentsAdjusted: 0 };

  groupByStudent(records).forEach((recs, sid) => {
    const who = byStudent.get(sid);
    if (!who) return;
    let events = [];
    try { events = (ledgerAdvanceEvents(recs) || {}).events || []; } catch { /* ignore */ }
    const adjusted = events.filter(e => e.type === 'adj' && e.date === date).reduce((a, e) => a + e.amount, 0);
    if (adjusted <= 0) return;
    const opening = events.reduce((a, e) => {
      if (!e.date) return a + (e.type === 'recv' ? e.amount : 0);
      return e.date < date ? a + (e.type === 'recv' ? e.amount : -e.amount) : a;
    }, 0);
    const recvSameDay = events.filter(e => e.type === 'recv' && e.date === date).reduce((a, e) => a + e.amount, 0);
    totalAmount += adjusted;
    rows.push({
      reg: who.s.reg, studentName: who.s.name, cls: who.c.cls, sec: who.c.sec,
      previousAdvanceBalance: Math.max(0, Math.round(opening)),
      adjustedAmount: Math.round(adjusted),
      remainingAdvanceBalance: Math.max(0, Math.round(opening + recvSameDay - adjusted)),
    });
  });
  rows.sort((a, b) => a.cls.localeCompare(b.cls) || a.studentName.localeCompare(b.studentName));
  return { rows, totalAmount: Math.round(totalAmount), studentsAdjusted: rows.length };
}
