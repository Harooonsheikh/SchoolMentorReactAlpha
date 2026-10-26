import React, { useMemo, useState } from 'react';
import { AnimatedNumber } from './MentorAIResponseParts';
import { FeeAnalyticsInfoButton } from './FeeAnalyticsInfo';
import { computeInactiveFeeImpact } from './inactiveFeeImpact';
import InactiveStudentsReportModal from './InactiveStudentsReportModal';

const IFI_CSS = `
.ifi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin:14px 0 4px; }
.ifi-cell { display:flex; flex-direction:column; gap:3px; padding:10px 12px; border-radius:9px; background:var(--bg-muted,#F8FAFF); border:1px solid var(--border-light,#E2E8F0); }
[data-theme="dark"] .ifi-cell { background:rgba(96,165,250,.05); border-color:#1F3158; }
.ifi-cell-lbl { font:700 9.5px/1.3 var(--dash-font); color:var(--text-muted,#64748B); text-transform:uppercase; letter-spacing:.3px; }
.ifi-cell-val { font:800 13.5px/1.2 var(--dash-font); color:var(--text-primary); letter-spacing:-.01em; }
`;

export default function InactiveFeeImpactCard({ feeData, monthIdx, monthLabel, duration = 900 }) {
  const [reportOpen, setReportOpen] = useState(false);

  const cardRange = useMemo(() => {
    const from = `2026-${String(monthIdx + 1).padStart(2, '0')}-01`;
    const to = new Date(2026, monthIdx + 1, 0).toISOString().slice(0, 10);
    return { from, to };
  }, [monthIdx]);

  const cardImpact = useMemo(() => {
    return computeInactiveFeeImpact({ ...feeData, monthIdx, ...cardRange });
  }, [feeData, monthIdx, cardRange]);

  return (
    <>
      <style>{IFI_CSS}</style>
      <div className="stat-card fee-card fa-card fa-large fc-tone--slate fc-bordered">
        <div className="fc-header">
          <div className="fc-icon-chip"><i className="fa-solid fa-user-slash" aria-hidden="true"></i></div>
          <div className="fc-title">Inactive Students | Fee Impact</div>
          <FeeAnalyticsInfoButton cardKey="inactiveFeeImpact" />
        </div>

        <div className="fc-amount fa-amount--xl"><AnimatedNumber value={`${cardImpact.studentsInactivated}`} duration={duration} /></div>
        <div className="fa-formula">
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>Students Inactivated This Month — {monthLabel}</span>
        </div>

        <div className="fc-divider" />
        <div className="fa-meta-rows">
          <div className="fa-meta-row">
            <span className="fa-meta-lbl"><i className="fa-solid fa-hourglass-half" aria-hidden="true"></i> Total Fee Amount Excluded</span>
            <span className="fa-meta-val"><span className="fc-highlight">PKR {cardImpact.totalFeeAmountExcluded.toLocaleString()}</span></span>
          </div>
        </div>

        <div className="ifi-grid">
          <Cell label="Current-Month Challans" value={cardImpact.currentChallanExcluded} />
          <Cell label="Previous Dues" value={cardImpact.previousDuesExcluded} />
          <Cell label="Fee Received" value={cardImpact.feeReceivedExcluded} />
          <Cell label="Receiving Discounts" value={cardImpact.receivingDiscountExcluded} />
          <Cell label="Advance Adjustments" value={cardImpact.advanceAdjustmentExcluded} />
        </div>

        <div className="fa-advance-note">
          <div className="fa-advance-note-top">
            <span className="fa-advance-note-lbl"><i className="fa-solid fa-piggy-bank" aria-hidden="true"></i> Unused Advance Balance</span>
            <span className="fa-advance-note-val"><AnimatedNumber value={`PKR ${cardImpact.unusedAdvanceBalance.toLocaleString()}`} duration={duration} /></span>
          </div>
          <div className="fa-advance-note-cap">Remaining advance credit for these students. Not part of the total above, and not a liability or pending fee.</div>
        </div>

        <div className="adm-tc-foot">
          <button type="button" className="adm-tc-btn adm-tc-btn--full" onClick={() => setReportOpen(true)}>
            <i className="fa-solid fa-table-list" aria-hidden="true"></i> View Inactive Students Report
          </button>
        </div>
      </div>

      {reportOpen && <InactiveStudentsReportModal feeData={feeData} monthIdx={monthIdx} onClose={() => setReportOpen(false)} />}
    </>
  );
}

function Cell({ label, value }) {
  return (
    <div className="ifi-cell">
      <span className="ifi-cell-lbl">{label}</span>
      <span className="ifi-cell-val">PKR {value.toLocaleString()}</span>
    </div>
  );
}
