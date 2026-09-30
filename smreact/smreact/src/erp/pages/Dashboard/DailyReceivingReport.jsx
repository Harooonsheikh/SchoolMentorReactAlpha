import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DASH_MODAL_CSS } from './dashModalCss';
import { feeDashReportHTML } from './AdminDashboard';

/* ═══════════════════════════════════════════════════════════════════
   DAILY RECEIVING REPORT MODAL — attached to the Fee Analytics
   "Fee Received" card's new "Daily Receiving Report" button.

   The Fee Received card itself (and every other Fee Analytics card)
   is locked to a single selected MONTH via feeExtras/computeFeeDashboard
   Extras — that pipeline can't answer "what was received on exactly
   this one day", since it only ever filters by `rec.monthIdx`. This
   modal instead flattens ALL of `receipts` (every monthIdx) and
   filters each individual payment by `p.date === date` directly —
   the same single-date-equality approach Fee.jsx's own report panels
   (Collection Report's "Daily" segment, OneLink Report's "Single
   Date" segment) already use, just applied across the whole ledger
   instead of one pre-selected month.

   Student Name / Class / Section are joined from `classes` +
   `studentsMap` exactly like feeDashboardExtra.js's own
   `classesByKey`/`studentLookup` construction, so a school's real
   totals always agree between this report and the Fee Received card.
   A single payment can cover several fee heads (`payments[].perHead`)
   so — to match the requested "Fee Head" column — rows are flattened
   one-per-(payment, fee head), same pattern already used for
   `discPerHead` in feeDashboardExtra.js's Card 6.

   "View Report" renders the table inline (in-ERP preview, no new
   window); "Download Report" reuses the exact same
   window.open + write + print() mechanism the Fee Received card's own
   existing Download Report button already uses, via the SAME shared
   `feeReportShellCSS`/`repHeadHTML` shell every other dashboard
   report builder is built from — genuinely reusing the existing
   reporting system rather than inventing a new one. */

const todayISO = () => new Date().toISOString().slice(0, 10);

/* Mirrors Fee.jsx's own `receivedBy` helper / feeDashboardExtra.js's
   `receivedByLabel` — explicit on the payment, otherwise derived from
   its source. Kept as its own copy here, same self-contained-module
   convention already used by every other file in this folder. */
function receivedByLabel(p) {
  if (!p) return '—';
  if (p.by) return p.by;
  if (p.source === 'onelink' || p.source === 'bank') return 'OneLink / Bank';
  return 'Front Desk';
}

function buildDailyRows({ receipts = [], classes = [], studentsMap = {}, date }) {
  if (!date) return { rows: [], totalAmount: 0, studentsPaid: 0, transactions: 0 };

  const classesByKey = {};
  classes.forEach((c) => { classesByKey[c.key] = c; });
  const studentLookup = {};
  classes.forEach((c) => (studentsMap[c.key] || []).forEach((s) => {
    studentLookup[`${c.key}|${s.reg}`] = s;
  }));

  const rows = [];
  const matchedRegs = new Set();
  let totalAmount = 0;
  let transactions = 0;

  receipts.forEach((rec) => {
    const s = studentLookup[`${rec.classKey}|${rec.reg}`];
    if (!s) return;
    (rec.payments || []).forEach((p) => {
      if (p.date !== date) return;
      transactions += 1;
      matchedRegs.add(rec.reg);
      totalAmount += (+p.amount || 0);

      const cls = classesByKey[rec.classKey]?.cls || rec.classKey;
      const sec = classesByKey[rec.classKey]?.sec || '';
      const method = p.method || '—';
      const by = receivedByLabel(p);
      const time = p.time || '—';
      const heads = Object.entries(p.perHead || {});

      if (heads.length === 0) {
        rows.push({ reg: rec.reg, studentName: s.name, cls, sec, head: '—', amount: +p.amount || 0, method, by, time });
      } else {
        heads.forEach(([head, amt]) => {
          rows.push({ reg: rec.reg, studentName: s.name, cls, sec, head, amount: +amt || 0, method, by, time });
        });
      }
    });
  });

  return { rows, totalAmount, studentsPaid: matchedRegs.size, transactions };
}

function buildDailyReceivingReportHTML({ rows, date, totalAmount, studentsPaid, transactions }) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const accent = '#16A34A';
  const dateLabel = date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(r.studentName)}</b></td>
      <td>${esc(r.reg)}</td>
      <td>${esc(r.cls)}</td>
      <td>${esc(r.sec)}</td>
      <td>${esc(r.head)}</td>
      <td style="text-align:right;font-weight:700;color:${accent}">${r.amount.toLocaleString('en-PK')}</td>
      <td>${esc(r.method)}</td>
      <td>${esc(r.by)}</td>
      <td>${esc(r.time)}</td>
    </tr>`).join('');
  const inner = `
    <div class="rep-filters"><span><b>Date:</b> ${esc(dateLabel)}</span><span><b>Students Paid:</b> ${studentsPaid}</span><span><b>Transactions:</b> ${transactions}</span><span><b>Total Received:</b> Rs. ${totalAmount.toLocaleString('en-PK')}</span></div>
    <div class="kpi-row">
      <div class="kpi"><div class="l">Total Amount Received</div><div class="v">Rs. ${totalAmount.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Total Students Paid</div><div class="v">${studentsPaid}</div></div>
      <div class="kpi"><div class="l">Number of Transactions</div><div class="v">${transactions}</div></div>
    </div>
    <div class="rep-secttl">Fee Receiving — ${esc(dateLabel)}</div>
    <table class="rep-tbl">
      <thead><tr><th>#</th><th>Student Name</th><th>Student ID</th><th>Class</th><th>Section</th><th>Fee Head</th><th style="text-align:right">Received Amount</th><th>Payment Method</th><th>Received By</th><th>Receiving Time</th></tr></thead>
      <tbody>${body || '<tr><td colspan="10" style="text-align:center;color:#94A3B8;padding:20px">No fee receiving found for this date.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="6" style="text-align:right">Total Amount Received</td><td style="text-align:right;color:${accent}">Rs. ${totalAmount.toLocaleString('en-PK')}</td><td colspan="3"></td></tr></tfoot>
    </table>`;
  return feeDashReportHTML({ accent, title: 'Daily Fee Receiving Report', innerHtml: inner });
}

export default function DailyReceivingReportModal({ receipts = [], classes = [], studentsMap = {}, onClose, toast = () => {} }) {
  const [date, setDate] = useState(todayISO());
  const [viewed, setViewed] = useState(false);

  const report = useMemo(
    () => buildDailyRows({ receipts, classes, studentsMap, date }),
    [receipts, classes, studentsMap, date]
  );

  const handleDateChange = (e) => {
    setDate(e.target.value);
    setViewed(false); // picking a new date hides the old preview until re-viewed
  };

  const handleView = () => {
    if (!date) { toast('Please select a date first', 'error'); return; }
    setViewed(true);
  };

  const handleDownload = () => {
    if (!date) { toast('Please select a date first', 'error'); return; }
    const html = buildDailyReceivingReportHTML({ ...report, date });
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast('Daily Fee Receiving Report — sent to print.', 'success');
  };

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="drr-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--xl">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-calendar-day" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="drr-modal-title">Daily Fee Receiving Report</div>
              <div className="up-modal-sub">View or download all fee receiving transactions for a single day</div>
            </div>
          </div>
          <button className="up-modal-x" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="up-modal-body">
          <div className="drr-controls">
            <label className="drr-field">
              <span className="drr-label">Select Date</span>
              <input
                type="date"
                className="drr-input"
                value={date}
                max={todayISO()}
                onChange={handleDateChange}
                aria-label="Select Date"
              />
            </label>
            <div className="drr-actions">
              <button type="button" className="up-btn up-btn-ghost" onClick={handleView} disabled={!date}>
                <i className="fa-solid fa-eye" aria-hidden="true"></i> View Report
              </button>
              <button type="button" className="up-btn up-btn-primary" onClick={handleDownload} disabled={!date}>
                <i className="fa-solid fa-download" aria-hidden="true"></i> Download Report
              </button>
            </div>
          </div>

          {viewed && (
            report.rows.length === 0 ? (
              <div className="up-empty">
                <div className="up-empty-ic"><i className="fa-solid fa-receipt" aria-hidden="true"></i></div>
                <div className="up-empty-t">No fee receiving found for this date.</div>
                <div className="up-empty-s">Try picking a different date, or check back once payments are received.</div>
              </div>
            ) : (
              <>
                <div className="drr-summary">
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Total Amount Received</span>
                    <span className="drr-summary-val drr-summary-val--green">PKR {report.totalAmount.toLocaleString('en-PK')}</span>
                  </div>
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Total Students Paid</span>
                    <span className="drr-summary-val">{report.studentsPaid}</span>
                  </div>
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Number of Transactions</span>
                    <span className="drr-summary-val">{report.transactions}</span>
                  </div>
                </div>

                <div className="drr-table-wrap">
                  <table className="drr-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Student Name</th><th>Student ID</th><th>Class</th><th>Section</th>
                        <th>Fee Head</th><th style={{ textAlign: 'right' }}>Received Amount</th>
                        <th>Payment Method</th><th>Received By</th><th>Receiving Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><b>{r.studentName}</b></td>
                          <td>{r.reg}</td>
                          <td>{r.cls}</td>
                          <td>{r.sec}</td>
                          <td>{r.head}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>{r.amount.toLocaleString('en-PK')} PKR</td>
                          <td>{r.method}</td>
                          <td>{r.by}</td>
                          <td>{r.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </div>

        <div className="up-modal-foot">
          <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true"></i> Close
          </button>
        </div>
      </div>

      <style>{DASH_MODAL_CSS}</style>
      <style>{DRR_CSS}</style>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   DAILY ADVANCE PAYMENT REPORT MODAL — attached to the Fee Analytics
   "Advance Payments Received" card. Same single-day pattern as
   DailyReceivingReportModal above, but for that card's own concept:
   for a specific day, how much of that day's payment(s) pushed a
   student's cumulative amount paid THIS MONTH beyond what was
   payable — i.e. how much NEW advance was created on exactly that
   day (mirrors feeDashboardExtra.js's `advanceRows`, which only
   answers this for a whole month). Payable uses the exact same
   formula as Card 6 / Fee Receiving itself (prev dues + this month's
   heads − approved discount − existing static advance), scoped to
   whichever month the selected day falls in. */
function buildDailyAdvanceRows({ receipts = [], classes = [], studentsMap = {}, headsMap = {}, discMap = {}, generatedSet = new Set(), date }) {
  if (!date) return { rows: [], totalAmount: 0, studentsPaid: 0, transactions: 0 };
  const dateMonthIdx = new Date(date).getMonth();

  const classesByKey = {};
  classes.forEach((c) => { classesByKey[c.key] = c; });
  const studentLookup = {};
  classes.forEach((c) => (studentsMap[c.key] || []).forEach((s) => {
    studentLookup[`${c.key}|${s.reg}`] = s;
  }));

  const rows = [];
  let totalAmount = 0;
  let transactions = 0;

  receipts.forEach((rec) => {
    const s = studentLookup[`${rec.classKey}|${rec.reg}`];
    if (!s) return;
    const monthPayments = (rec.payments || []).filter((p) => new Date(p.date).getMonth() === dateMonthIdx);
    const todaysPayments = monthPayments.filter((p) => p.date === date);
    if (!todaysPayments.length) return;

    const generated = generatedSet.has(`${rec.classKey}|${rec.reg}|${dateMonthIdx}`);
    const discForStudent = discMap[rec.classKey]?.[rec.reg];
    const heads = (headsMap[rec.classKey] || []).map((h) => {
      const std = +h.amt || 0;
      const disc = Math.min(+(discForStudent?.[h.name]) || 0, std);
      return { std, disc };
    });
    if (generated && +s.transport > 0) heads.push({ std: +s.transport, disc: 0 });
    const prev = +s.dues || 0;
    const staticAdvance = +s.advance || 0;
    const thisMonthHeads = generated ? heads.reduce((a, h) => a + h.std, 0) : 0;
    const discBaked = generated ? heads.reduce((a, h) => a + h.disc, 0) : 0;
    const payable = Math.max(0, prev + thisMonthHeads - discBaked - staticAdvance);

    /* Advance created TODAY = how much today's payment(s) pushed the
       month's cumulative-paid-so-far past payable, beyond whatever had
       already crossed that line on earlier days this month. */
    const cumBeforeToday = monthPayments.filter((p) => p.date < date).reduce((a, p) => a + (+p.amount || 0), 0);
    const todaysTotal = todaysPayments.reduce((a, p) => a + (+p.amount || 0), 0);
    const cumThroughToday = cumBeforeToday + todaysTotal;
    const advanceCreatedToday = Math.max(0, cumThroughToday - payable) - Math.max(0, cumBeforeToday - payable);
    if (advanceCreatedToday <= 0) return;

    const last = todaysPayments[todaysPayments.length - 1];
    transactions += 1;
    totalAmount += advanceCreatedToday;
    rows.push({
      reg: rec.reg,
      studentName: s.name,
      cls: classesByKey[rec.classKey]?.cls || rec.classKey,
      sec: classesByKey[rec.classKey]?.sec || '',
      payable,
      amountReceived: todaysTotal,
      advanceAmount: advanceCreatedToday,
      method: last?.method || '—',
      by: receivedByLabel(last),
      time: last?.time || '—',
    });
  });

  return { rows, totalAmount, studentsPaid: rows.length, transactions };
}

function buildDailyAdvanceReportHTML({ rows, totalAmount, studentsPaid, transactions }, date) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const accent = '#7C3AED';
  const dateLabel = date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(r.studentName)}</b></td>
      <td>${esc(r.reg)}</td>
      <td>${esc(r.cls)}</td>
      <td>${esc(r.sec)}</td>
      <td style="text-align:right">${r.payable.toLocaleString('en-PK')}</td>
      <td style="text-align:right">${r.amountReceived.toLocaleString('en-PK')}</td>
      <td style="text-align:right;font-weight:700;color:${accent}">${r.advanceAmount.toLocaleString('en-PK')}</td>
      <td>${esc(r.method)}</td>
      <td>${esc(r.by)}</td>
      <td>${esc(r.time)}</td>
    </tr>`).join('');
  const inner = `
    <div class="rep-filters"><span><b>Date:</b> ${esc(dateLabel)}</span><span><b>Students Paid in Advance:</b> ${studentsPaid}</span><span><b>Transactions:</b> ${transactions}</span><span><b>Total New Advance:</b> Rs. ${totalAmount.toLocaleString('en-PK')}</span></div>
    <div class="kpi-row">
      <div class="kpi"><div class="l">Total New Advance Created</div><div class="v">Rs. ${totalAmount.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Students Paid in Advance</div><div class="v">${studentsPaid}</div></div>
      <div class="kpi"><div class="l">Number of Transactions</div><div class="v">${transactions}</div></div>
    </div>
    <div class="rep-secttl">Advance Payments Created — ${esc(dateLabel)}</div>
    <table class="rep-tbl">
      <thead><tr><th>#</th><th>Student Name</th><th>Student ID</th><th>Class</th><th>Section</th><th style="text-align:right">Current Challan Amount</th><th style="text-align:right">Amount Received</th><th style="text-align:right">Advance Amount</th><th>Payment Method</th><th>Received By</th><th>Time</th></tr></thead>
      <tbody>${body || '<tr><td colspan="11" style="text-align:center;color:#94A3B8;padding:20px">No advance payments created on this date.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="7" style="text-align:right">Total New Advance</td><td style="text-align:right;color:${accent}">Rs. ${totalAmount.toLocaleString('en-PK')}</td><td colspan="3"></td></tr></tfoot>
    </table>`;
  return feeDashReportHTML({ accent, title: 'Daily Advance Payment Report', innerHtml: inner });
}

export function DailyAdvancePaymentReportModal({ receipts = [], classes = [], studentsMap = {}, headsMap = {}, discMap = {}, generatedSet = new Set(), onClose, toast = () => {} }) {
  const [date, setDate] = useState(todayISO());
  const [viewed, setViewed] = useState(false);

  const report = useMemo(
    () => buildDailyAdvanceRows({ receipts, classes, studentsMap, headsMap, discMap, generatedSet, date }),
    [receipts, classes, studentsMap, headsMap, discMap, generatedSet, date]
  );

  const handleDateChange = (e) => { setDate(e.target.value); setViewed(false); };
  const handleView = () => { if (!date) { toast('Please select a date first', 'error'); return; } setViewed(true); };
  const handleDownload = () => {
    if (!date) { toast('Please select a date first', 'error'); return; }
    const html = buildDailyAdvanceReportHTML(report, date);
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast('Daily Advance Payment Report — sent to print.', 'success');
  };

  return createPortal((
    <div className="up-modal-back" role="dialog" aria-modal="true" aria-labelledby="dap-modal-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="up-modal up-modal--xl">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-piggy-bank" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="dap-modal-title">Daily Advance Payment Report</div>
              <div className="up-modal-sub">View or download new advance payments created on a single day</div>
            </div>
          </div>
          <button className="up-modal-x" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="up-modal-body">
          <div className="drr-controls">
            <label className="drr-field">
              <span className="drr-label">Select Date</span>
              <input type="date" className="drr-input" value={date} max={todayISO()} onChange={handleDateChange} aria-label="Select Date" />
            </label>
            <div className="drr-actions">
              <button type="button" className="up-btn up-btn-ghost" onClick={handleView} disabled={!date}>
                <i className="fa-solid fa-eye" aria-hidden="true"></i> View Report
              </button>
              <button type="button" className="up-btn up-btn-primary" onClick={handleDownload} disabled={!date}>
                <i className="fa-solid fa-download" aria-hidden="true"></i> Download Report
              </button>
            </div>
          </div>

          {viewed && (
            report.rows.length === 0 ? (
              <div className="up-empty">
                <div className="up-empty-ic"><i className="fa-solid fa-piggy-bank" aria-hidden="true"></i></div>
                <div className="up-empty-t">No advance payments created on this date.</div>
                <div className="up-empty-s">Try picking a different date, or check back once an overpayment is received.</div>
              </div>
            ) : (
              <>
                <div className="drr-summary">
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Total New Advance Created</span>
                    <span className="drr-summary-val drr-summary-val--purple">PKR {report.totalAmount.toLocaleString('en-PK')}</span>
                  </div>
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Students Paid in Advance</span>
                    <span className="drr-summary-val">{report.studentsPaid}</span>
                  </div>
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Number of Transactions</span>
                    <span className="drr-summary-val">{report.transactions}</span>
                  </div>
                </div>

                <div className="drr-table-wrap">
                  <table className="drr-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Student Name</th><th>Student ID</th><th>Class</th><th>Section</th>
                        <th style={{ textAlign: 'right' }}>Current Challan Amount</th><th style={{ textAlign: 'right' }}>Amount Received</th>
                        <th style={{ textAlign: 'right' }}>Advance Amount</th><th>Payment Method</th><th>Received By</th><th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><b>{r.studentName}</b></td>
                          <td>{r.reg}</td>
                          <td>{r.cls}</td>
                          <td>{r.sec}</td>
                          <td style={{ textAlign: 'right' }}>{r.payable.toLocaleString('en-PK')} PKR</td>
                          <td style={{ textAlign: 'right' }}>{r.amountReceived.toLocaleString('en-PK')} PKR</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#7C3AED' }}>{r.advanceAmount.toLocaleString('en-PK')} PKR</td>
                          <td>{r.method}</td>
                          <td>{r.by}</td>
                          <td>{r.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </div>

        <div className="up-modal-foot">
          <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true"></i> Close
          </button>
        </div>
      </div>

      <style>{DASH_MODAL_CSS}</style>
      <style>{DRR_CSS}</style>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   DAILY ADVANCE ADJUSTMENT REPORT MODAL — attached to the Fee
   Analytics "Advance Adjustments" card. Same single-day pattern
   again, but reading directly from the advance ledger (mirrors
   feeDashboardExtra.js's own `advanceAdjustmentRows`, which only
   answers this for a whole month) — filters `mockAdvanceLedger`'s
   'adjusted' entries to exactly the selected date instead of a whole
   month. */
function buildDailyAdvanceAdjustmentRows({ advanceLedger = [], classes = [], studentsMap = {}, date }) {
  if (!date) return { rows: [], totalAmount: 0, studentsAdjusted: 0 };

  const rows = [];
  let totalAmount = 0;

  classes.forEach((c) => {
    (studentsMap[c.key] || []).forEach((s) => {
      const entries = advanceLedger.filter((e) => e.classKey === c.key && e.reg === s.reg);
      const opening = Math.max(0, entries
        .filter((e) => e.date < date)
        .reduce((sum, e) => sum + (e.type === 'received' ? e.amount : -e.amount), 0));
      const todaysAdjusted = entries.filter((e) => e.type === 'adjusted' && e.date === date);
      const adjustedAmount = todaysAdjusted.reduce((a, e) => a + e.amount, 0);
      if (adjustedAmount <= 0) return;
      const remainingAdvanceBalance = Math.max(0, opening - adjustedAmount);
      rows.push({
        reg: s.reg, studentName: s.name, cls: c.cls, sec: c.sec,
        previousAdvanceBalance: opening,
        adjustedAmount,
        remainingAdvanceBalance,
      });
      totalAmount += adjustedAmount;
    });
  });

  return { rows, totalAmount, studentsAdjusted: rows.length };
}

function buildDailyAdvanceAdjustmentReportHTML({ rows, totalAmount, studentsAdjusted }, date) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const accent = '#7C3AED';
  const dateLabel = date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(r.studentName)}</b></td>
      <td>${esc(r.cls)}</td>
      <td>${esc(r.sec)}</td>
      <td style="text-align:right">${r.previousAdvanceBalance.toLocaleString('en-PK')}</td>
      <td style="text-align:right;font-weight:700;color:${accent}">${r.adjustedAmount.toLocaleString('en-PK')}</td>
      <td style="text-align:right">${r.remainingAdvanceBalance.toLocaleString('en-PK')}</td>
      <td>${esc(dateLabel)}</td>
    </tr>`).join('');
  const inner = `
    <div class="rep-filters"><span><b>Date:</b> ${esc(dateLabel)}</span><span><b>Students Adjusted:</b> ${studentsAdjusted}</span><span><b>Total Adjusted:</b> Rs. ${totalAmount.toLocaleString('en-PK')}</span></div>
    <div class="kpi-row">
      <div class="kpi"><div class="l">Total Amount Adjusted</div><div class="v">Rs. ${totalAmount.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Students Adjusted</div><div class="v">${studentsAdjusted}</div></div>
      <div class="kpi"><div class="l">Adjustment Date</div><div class="v">${esc(dateLabel)}</div></div>
    </div>
    <div class="rep-secttl">Advance Adjustments — ${esc(dateLabel)}</div>
    <table class="rep-tbl">
      <thead><tr><th>#</th><th>Student Name</th><th>Class</th><th>Section</th><th style="text-align:right">Previous Advance Balance</th><th style="text-align:right">Adjusted Amount</th><th style="text-align:right">Remaining Advance Balance</th><th>Adjustment Date</th></tr></thead>
      <tbody>${body || '<tr><td colspan="8" style="text-align:center;color:#94A3B8;padding:20px">No advance adjustments on this date.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right">Total Amount Adjusted</td><td style="text-align:right;color:${accent}">Rs. ${totalAmount.toLocaleString('en-PK')}</td><td colspan="2"></td></tr></tfoot>
    </table>`;
  return feeDashReportHTML({ accent, title: 'Daily Advance Adjustment Report', innerHtml: inner });
}

export function DailyAdvanceAdjustmentReportModal({ advanceLedger = [], classes = [], studentsMap = {}, onClose, toast = () => {} }) {
  const [date, setDate] = useState(todayISO());
  const [viewed, setViewed] = useState(false);

  const report = useMemo(
    () => buildDailyAdvanceAdjustmentRows({ advanceLedger, classes, studentsMap, date }),
    [advanceLedger, classes, studentsMap, date]
  );

  const handleDateChange = (e) => { setDate(e.target.value); setViewed(false); };
  const handleView = () => { if (!date) { toast('Please select a date first', 'error'); return; } setViewed(true); };
  const handleDownload = () => {
    if (!date) { toast('Please select a date first', 'error'); return; }
    const html = buildDailyAdvanceAdjustmentReportHTML(report, date);
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast('Daily Advance Adjustment Report — sent to print.', 'success');
  };

  return createPortal((
    <div className="up-modal-back" role="dialog" aria-modal="true" aria-labelledby="daa-modal-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="up-modal up-modal--xl">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-arrow-right-arrow-left" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="daa-modal-title">Daily Advance Adjustment Report</div>
              <div className="up-modal-sub">View or download advance balance adjustments for a single day</div>
            </div>
          </div>
          <button className="up-modal-x" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="up-modal-body">
          <div className="drr-controls">
            <label className="drr-field">
              <span className="drr-label">Select Date</span>
              <input type="date" className="drr-input" value={date} max={todayISO()} onChange={handleDateChange} aria-label="Select Date" />
            </label>
            <div className="drr-actions">
              <button type="button" className="up-btn up-btn-ghost" onClick={handleView} disabled={!date}>
                <i className="fa-solid fa-eye" aria-hidden="true"></i> View Report
              </button>
              <button type="button" className="up-btn up-btn-primary" onClick={handleDownload} disabled={!date}>
                <i className="fa-solid fa-download" aria-hidden="true"></i> Download Report
              </button>
            </div>
          </div>

          {viewed && (
            report.rows.length === 0 ? (
              <div className="up-empty">
                <div className="up-empty-ic"><i className="fa-solid fa-arrow-right-arrow-left" aria-hidden="true"></i></div>
                <div className="up-empty-t">No advance adjustments on this date.</div>
                <div className="up-empty-s">Try picking a different date, or check back once a challan consumes a student's advance balance.</div>
              </div>
            ) : (
              <>
                <div className="drr-summary">
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Total Amount Adjusted</span>
                    <span className="drr-summary-val drr-summary-val--purple">PKR {report.totalAmount.toLocaleString('en-PK')}</span>
                  </div>
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Students Adjusted</span>
                    <span className="drr-summary-val">{report.studentsAdjusted}</span>
                  </div>
                  <div className="drr-summary-item">
                    <span className="drr-summary-lbl">Adjustment Date</span>
                    <span className="drr-summary-val">{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="drr-table-wrap">
                  <table className="drr-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Student Name</th><th>Class</th><th>Section</th>
                        <th style={{ textAlign: 'right' }}>Previous Advance Balance</th>
                        <th style={{ textAlign: 'right' }}>Adjusted Amount</th>
                        <th style={{ textAlign: 'right' }}>Remaining Advance Balance</th>
                        <th>Adjustment Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><b>{r.studentName}</b></td>
                          <td>{r.cls}</td>
                          <td>{r.sec}</td>
                          <td style={{ textAlign: 'right' }}>{r.previousAdvanceBalance.toLocaleString('en-PK')} PKR</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#7C3AED' }}>{r.adjustedAmount.toLocaleString('en-PK')} PKR</td>
                          <td style={{ textAlign: 'right' }}>{r.remainingAdvanceBalance.toLocaleString('en-PK')} PKR</td>
                          <td>{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </div>

        <div className="up-modal-foot">
          <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true"></i> Close
          </button>
        </div>
      </div>

      <style>{DASH_MODAL_CSS}</style>
      <style>{DRR_CSS}</style>
    </div>
  ), document.body);
}

const DRR_CSS = `
.drr-controls {
  display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap;
  padding: 14px 16px; margin-bottom: 16px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
}
.drr-field { display: flex; flex-direction: column; gap: 6px; }
.drr-label {
  font: 700 10.5px/1 var(--dm-font);
  color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .4px;
}
.drr-input {
  height: 36px; padding: 0 12px;
  font: 600 12.5px/1 var(--dm-font); color: var(--text-primary);
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 8px;
  min-width: 180px;
}
.drr-input:focus { outline: none; border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(30, 64, 175, .12); }
.drr-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.drr-summary {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  margin-bottom: 16px;
}
.drr-summary-item {
  display: flex; flex-direction: column; gap: 6px;
  padding: 14px 16px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
}
.drr-summary-lbl {
  font: 700 10.5px/1 var(--dm-font);
  color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .4px;
}
.drr-summary-val { font: 800 20px/1 var(--dm-font); color: var(--text-primary); }
.drr-summary-val--green { color: #16A34A; }
.drr-summary-val--purple { color: #7C3AED; }

.drr-table-wrap {
  overflow-x: auto;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
}
.drr-table { width: 100%; border-collapse: collapse; font: 500 12px/1.4 var(--dm-font); }
.drr-table thead th {
  padding: 10px 12px; text-align: left; background: #F8FAFF;
  font: 700 10px/1 var(--dm-font); color: #475569;
  text-transform: uppercase; letter-spacing: .3px;
  border-bottom: 1px solid var(--border-light, #E2E8F0); white-space: nowrap;
}
.drr-table tbody td {
  padding: 10px 12px; color: var(--text-primary);
  border-bottom: 1px solid var(--border-light, #F1F5F9); white-space: nowrap;
}
.drr-table tbody tr:last-child td { border-bottom: none; }
.drr-table tbody tr:hover { background: #F8FAFF; }
[data-theme="dark"] .drr-input { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .drr-controls,
[data-theme="dark"] .drr-summary-item,
[data-theme="dark"] .drr-table-wrap { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .drr-table thead th { background: rgba(96, 165, 250, .06); color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .drr-table tbody tr:hover { background: rgba(96, 165, 250, .06); }

@media (max-width: 640px) {
  .drr-summary { grid-template-columns: 1fr; }
  .drr-controls { flex-direction: column; align-items: stretch; }
  .drr-actions { flex-direction: column; }
  .drr-actions .up-btn { width: 100%; justify-content: center; }
}
`;
