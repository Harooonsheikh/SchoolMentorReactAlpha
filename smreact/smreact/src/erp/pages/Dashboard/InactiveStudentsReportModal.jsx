import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DASH_MODAL_CSS } from './dashModalCss';
import { computeInactiveFeeImpact } from './inactiveFeeImpact';
import { buildStandardReportHtml, buildReportTableHtml, openReportWindow } from '../../reports/reportKit';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => `PKR ${(Number(n) || 0).toLocaleString('en-PK')}`;

export default function InactiveStudentsReportModal({ feeData, monthIdx, onClose, toast = () => {} }) {
  const [mode, setMode] = useState('month');
  const [day, setDay] = useState(todayISO());
  const [month, setMonth] = useState(`2026-${String(monthIdx + 1).padStart(2, '0')}`);
  const [from, setFrom] = useState('2026-05-01');
  const [to, setTo] = useState('2026-05-31');

  const range = useMemo(() => {
    if (mode === 'day') return { from: day, to: day, label: new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) };
    if (mode === 'month') {
      const [y, m] = month.split('-').map(Number);
      const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const start = `${month}-01`;
      return { from: start, to: end, label: new Date(`${start}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
    }
    const f = from <= to ? from : to, t = from <= to ? to : from;
    const lbl = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return { from: f, to: t, label: `${lbl(f)} – ${lbl(t)}` };
  }, [mode, day, month, from, to]);

  const report = useMemo(() => computeInactiveFeeImpact({ ...feeData, monthIdx, from: range.from, to: range.to }), [feeData, monthIdx, range]);

  const handleDownload = () => {
    const columns = [
      { key: 'name', label: 'Student Name' }, { key: 'reg', label: 'Admission No.' },
      { key: 'cls', label: 'Class' }, { key: 'sec', label: 'Section' }, { key: 'inactiveDate', label: 'Deactivation Date' },
      { key: 'currentChallanExcluded', label: 'Current Challan' }, { key: 'previousDuesExcluded', label: 'Previous Dues' },
      { key: 'feeReceivedExcluded', label: 'Fee Received' }, { key: 'receivingDiscountExcluded', label: 'Receiving Discount' },
      { key: 'advanceAdjustmentExcluded', label: 'Advance Adjustment' }, { key: 'unusedAdvanceBalance', label: 'Unused Advance' },
      { key: 'netImpact', label: 'Net Fee Impact' },
    ];
    const rows = report.rows.map(r => ({
      ...r,
      currentChallanExcluded: fmt(r.currentChallanExcluded), previousDuesExcluded: fmt(r.previousDuesExcluded),
      feeReceivedExcluded: fmt(r.feeReceivedExcluded), receivingDiscountExcluded: fmt(r.receivingDiscountExcluded),
      advanceAdjustmentExcluded: fmt(r.advanceAdjustmentExcluded), unusedAdvanceBalance: fmt(r.unusedAdvanceBalance),
      netImpact: fmt(r.netImpact),
    }));
    const bodyHtml = buildReportTableHtml({ columns, rows, isColor: true, emptyText: 'No students were inactivated during this period.' });
    const html = buildStandardReportHtml({ title: 'Inactive Students — Fee Impact Report', subtitleLine: range.label, format: 'pdf', isColor: true, bodyHtml, orientation: 'landscape' });
    openReportWindow(html);
    toast('Inactive Students Report — sent to print.', 'success');
  };

  return createPortal((
    <div className="up-modal-back" role="dialog" aria-modal="true" aria-labelledby="isr-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="up-modal up-modal--xl">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-user-slash" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="isr-modal-title">Inactive Students Report</div>
              <div className="up-modal-sub">Students whose status changed to inactive during the selected period</div>
            </div>
          </div>
          <button className="up-modal-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>

        <div className="up-modal-body">
          <div className="drr-controls">
            <div className="drr-seg">
              <button type="button" className={`drr-seg-btn${mode === 'day' ? ' active' : ''}`} onClick={() => setMode('day')}>Day</button>
              <button type="button" className={`drr-seg-btn${mode === 'month' ? ' active' : ''}`} onClick={() => setMode('month')}>Month</button>
              <button type="button" className={`drr-seg-btn${mode === 'range' ? ' active' : ''}`} onClick={() => setMode('range')}>Custom Date Range</button>
            </div>
            {mode === 'day' && (
              <label className="drr-field"><span className="drr-label">Select Date</span>
                <input type="date" className="drr-input" value={day} max={todayISO()} onChange={e => setDay(e.target.value)} />
              </label>
            )}
            {mode === 'month' && (
              <label className="drr-field"><span className="drr-label">Select Month</span>
                <input type="month" className="drr-input" value={month} onChange={e => setMonth(e.target.value)} />
              </label>
            )}
            {mode === 'range' && (
              <>
                <label className="drr-field"><span className="drr-label">From</span>
                  <input type="date" className="drr-input" value={from} onChange={e => setFrom(e.target.value)} />
                </label>
                <label className="drr-field"><span className="drr-label">To</span>
                  <input type="date" className="drr-input" value={to} onChange={e => setTo(e.target.value)} />
                </label>
              </>
            )}
            <div className="drr-actions">
              <button type="button" className="up-btn up-btn-primary" onClick={handleDownload}>
                <i className="fa-solid fa-download" aria-hidden="true"></i> Download Report
              </button>
            </div>
          </div>

          <div className="isr-period"><i className="fa-solid fa-calendar-check" aria-hidden="true"></i> {range.label}</div>

          {report.studentsInactivated === 0 ? (
            <div className="up-empty">
              <div className="up-empty-ic"><i className="fa-solid fa-circle-check" aria-hidden="true"></i></div>
              <div className="up-empty-t">No students were inactivated during this period.</div>
              <div className="up-empty-s">Try a different date, month or range.</div>
            </div>
          ) : (
            <>
              <div className="drr-summary">
                <div className="drr-summary-item">
                  <span className="drr-summary-lbl">Students Affected</span>
                  <span className="drr-summary-val">{report.studentsInactivated}</span>
                </div>
                <div className="drr-summary-item">
                  <span className="drr-summary-lbl">Total Fee Amount Excluded</span>
                  <span className="drr-summary-val drr-summary-val--green">{fmt(report.totalFeeAmountExcluded)}</span>
                </div>
                <div className="drr-summary-item">
                  <span className="drr-summary-lbl">Unused Advance Balance</span>
                  <span className="drr-summary-val drr-summary-val--purple">{fmt(report.unusedAdvanceBalance)}</span>
                </div>
              </div>

              <div className="drr-table-wrap">
                <table className="drr-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Student Name</th><th>Admission No.</th><th>Class</th><th>Section</th><th>Deactivation Date</th>
                      <th style={{ textAlign: 'right' }}>Current Challan</th><th style={{ textAlign: 'right' }}>Previous Dues</th>
                      <th style={{ textAlign: 'right' }}>Fee Received</th><th style={{ textAlign: 'right' }}>Receiving Discount</th>
                      <th style={{ textAlign: 'right' }}>Advance Adjustment</th><th style={{ textAlign: 'right' }}>Unused Advance</th>
                      <th style={{ textAlign: 'right' }}>Net Fee Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td><td><b>{r.name}</b></td><td>{r.reg}</td><td>{r.cls}</td><td>{r.sec}</td><td>{r.inactiveDate}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(r.currentChallanExcluded)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(r.previousDuesExcluded)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(r.feeReceivedExcluded)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(r.receivingDiscountExcluded)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(r.advanceAdjustmentExcluded)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(r.unusedAdvanceBalance)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>{fmt(r.netImpact)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="up-modal-foot">
          <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true"></i> Close
          </button>
        </div>
      </div>

      <style>{DASH_MODAL_CSS}</style>
      <style>{ISR_CSS}</style>
    </div>
  ), document.body);
}

const ISR_CSS = `
.drr-controls {
  display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap;
  padding: 14px 16px; margin-bottom: 14px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
}
.drr-field { display: flex; flex-direction: column; gap: 6px; }
.drr-label { font: 700 10.5px/1 var(--dm-font); color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: .4px; }
.drr-input { height: 36px; padding: 0 12px; font: 600 12.5px/1 var(--dm-font); color: var(--text-primary); background: var(--bg-card, #fff); border: 1px solid var(--border-light, #E2E8F0); border-radius: 8px; min-width: 150px; }
.drr-input:focus { outline: none; border-color: var(--brand-solid, #1E40AF); box-shadow: var(--shadow-flatten, 0 0 0 3px rgba(var(--brand-dark-rgb), .12)); }
.drr-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-left: auto; }
.drr-seg { display: flex; gap: 3px; background: var(--bg-muted, #F8FAFF); border-radius: 9px; padding: 3px; }
.drr-seg-btn { padding: 8px 13px; border: none; border-radius: 7px; background: transparent; font: 700 11.5px/1 var(--dm-font); color: var(--text-muted, #64748B); cursor: pointer; white-space: nowrap; }
.drr-seg-btn.active { background: var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF)); color: #fff; }
.isr-period { display: inline-flex; align-items: center; gap: 7px; font: 700 12px/1 var(--dm-font); color: var(--brand-solid, #1E40AF); background: rgba(var(--brand-dark-rgb), .08); padding: 7px 13px; border-radius: 999px; margin-bottom: 14px; }
.drr-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
.drr-summary-item { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; background: var(--bg-card, #fff); border: 1px solid var(--border-light, #E2E8F0); border-radius: 12px; }
.drr-summary-lbl { font: 700 10.5px/1 var(--dm-font); color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: .4px; }
.drr-summary-val { font: 800 20px/1 var(--dm-font); color: var(--text-primary); }
.drr-summary-val--green { color: #16A34A; }
.drr-summary-val--purple { color: #7C3AED; }
.drr-table-wrap { overflow-x: auto; background: var(--bg-card, #fff); border: 1px solid var(--border-light, #E2E8F0); border-radius: 12px; }
.drr-table { width: 100%; border-collapse: collapse; font: 500 12px/1.4 var(--dm-font); }
.drr-table thead th { padding: 10px 12px; text-align: left; background: #F8FAFF; font: 700 10px/1 var(--dm-font); color: #475569; text-transform: uppercase; letter-spacing: .3px; border-bottom: 1px solid var(--border-light, #E2E8F0); white-space: nowrap; }
.drr-table tbody td { padding: 10px 12px; color: var(--text-primary); border-bottom: 1px solid var(--border-light, #F1F5F9); white-space: nowrap; }
.drr-table tbody tr:last-child td { border-bottom: none; }
.drr-table tbody tr:hover { background: #F8FAFF; }
[data-theme="dark"] .drr-input { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .drr-controls, [data-theme="dark"] .drr-summary-item, [data-theme="dark"] .drr-table-wrap { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .drr-table thead th { background: rgba(96, 165, 250, .06); color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .drr-table tbody tr:hover { background: rgba(96, 165, 250, .06); }
@media (max-width: 640px) {
  .drr-summary { grid-template-columns: 1fr; }
  .drr-controls { flex-direction: column; align-items: stretch; }
  .drr-actions { flex-direction: column; margin-left: 0; }
  .drr-actions .up-btn { width: 100%; justify-content: center; }
}
`;
