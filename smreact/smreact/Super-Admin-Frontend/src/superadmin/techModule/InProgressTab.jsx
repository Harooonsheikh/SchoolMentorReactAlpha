import React, { useMemo, useState } from 'react';
import { TYPE_LABEL, TYPE_BADGE, SOURCE_LABEL, SOURCE_BADGE } from '../techTicketsData';
import LockedCard from '../adminPermissions/LockedCard';

/* ═══════════════════════════════════════════════════════════════════
   InProgressTab — Stage 2: the assigned developer works the ticket.
   "Send for QA Testing" is the single action here — clicking it opens
   the Developer Testing Report modal (pre-filled if one already exists,
   e.g. a QA Returned ticket); submitting that report both saves it AND
   sends the ticket for QA Testing in one step (onSubmitAndSendForQa).
   There is no separate "Submit Testing Report" button any more.

   Two-level sub-split (no new field — derived from existing data):
     Developer Tasks (fresh work) vs QA Returned (last qaReview entry
     was a rejection), each further split into Bugs / New Development.
   ═══════════════════════════════════════════════════════════════════ */
const wasReturnedFromQa = (t) => t.qaReview?.length > 0 && t.qaReview[t.qaReview.length - 1].decision === 'rejected';

export default function InProgressTab({ tickets, onSubmitAndSendForQa, onViewDetails, toast, canEdit = true }) {
  const [reportingId, setReportingId] = useState(null);
  const [group, setGroup] = useState('all');   // 'all' | 'developer' | 'returned'
  const [type, setType] = useState('all');     // 'all' | 'bug' | 'improvement'

  const filtered = useMemo(() => tickets.filter((t) => {
    if (group === 'developer' && wasReturnedFromQa(t)) return false;
    if (group === 'returned' && !wasReturnedFromQa(t)) return false;
    if (type !== 'all' && t.type !== type) return false;
    return true;
  }), [tickets, group, type]);

  const developerCount = tickets.filter((t) => !wasReturnedFromQa(t)).length;
  const returnedCount = tickets.filter(wasReturnedFromQa).length;

  return (
    <div className="tm-body-card">
      <div className="tm-body-hd">
        <div>
          <div className="card-title"><i className="fa-solid fa-spinner" /> In Progress</div>
          <div className="card-sub">{tickets.length} ticket{tickets.length === 1 ? '' : 's'} being actively developed</div>
        </div>
      </div>
      <div className="tm-body-pad">
        <div className="tm-subfilter-group">
          <div className="tm-subfilter-group-lbl">Group</div>
          <div className="tm-subfilter">
            <button className={`tm-subfilter-btn${group === 'all' ? ' active' : ''}`} onClick={() => setGroup('all')}>All ({tickets.length})</button>
            <button className={`tm-subfilter-btn${group === 'developer' ? ' active' : ''}`} onClick={() => setGroup('developer')}><i className="fa-solid fa-user-gear" /> Developer Tasks ({developerCount})</button>
            <button className={`tm-subfilter-btn${group === 'returned' ? ' active' : ''}`} onClick={() => setGroup('returned')}><i className="fa-solid fa-rotate-left" /> QA Returned ({returnedCount})</button>
          </div>
        </div>
        <div className="tm-subfilter-group">
          <div className="tm-subfilter-group-lbl">Type</div>
          <div className="tm-subfilter">
            <button className={`tm-subfilter-btn${type === 'all' ? ' active' : ''}`} onClick={() => setType('all')}>All</button>
            <button className={`tm-subfilter-btn${type === 'bug' ? ' active' : ''}`} onClick={() => setType('bug')}>Bugs</button>
            <button className={`tm-subfilter-btn${type === 'improvement' ? ' active' : ''}`} onClick={() => setType('improvement')}>New Development</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="tm-empty"><i className="fa-solid fa-spinner" /><div>Nothing here</div><div style={{ fontSize: 12 }}>Assigned tickets being actively developed will appear here.</div></div>
        ) : (
          <div className="tm-card-list">
            {filtered.map((t) => (
              <div key={t.id} className={`tm-card tm-card-${t.type}`}>
                <div className="tm-card-top">
                  <div>
                    <div className="tm-card-num">{t.ticketNumber}</div>
                    <div className="tm-card-title">{t.title}</div>
                  </div>
                  <span className={`badge ${TYPE_BADGE[t.type]?.cls}`}><i className={`fa-solid ${TYPE_BADGE[t.type]?.icon}`} /> {TYPE_LABEL[t.type]}</span>
                </div>
                <div className="tm-card-meta">
                  {wasReturnedFromQa(t) && <span className="badge tt-b-amber"><i className="fa-solid fa-rotate-left" /> Returned from QA</span>}
                  <span className={`badge ${SOURCE_BADGE[t.source]?.cls}`}><i className={`fa-solid ${SOURCE_BADGE[t.source]?.icon}`} /> {SOURCE_LABEL[t.source]}</span>
                  <span><i className="fa-solid fa-school" /> {t.school.name}</span>
                  <span><i className="fa-solid fa-user-gear" /> {t.assignedTo?.name || 'Unassigned'}</span>
                  {t.module && <span><i className="fa-solid fa-cube" /> {t.module}</span>}
                </div>

                {t.developerTestingReport ? (
                  <div className="tm-banner tm-banner-info" style={{ marginBottom: 0 }}>
                    <i className="fa-solid fa-circle-check" />
                    <div><b>Developer Testing Report submitted</b> by {t.developerTestingReport.submittedBy} on {new Date(t.developerTestingReport.submittedAt).toLocaleString()}.</div>
                  </div>
                ) : (
                  <div className="tm-banner tm-banner-warn" style={{ marginBottom: 0 }}>
                    <i className="fa-solid fa-triangle-exclamation" /> A Developer Testing Report is required before this ticket can be sent for QA Testing.
                  </div>
                )}

                <div className="tm-card-actions">
                  <button className="btn-sm" onClick={() => onViewDetails?.(t.id)}><i className="fa-solid fa-eye" /> View Details</button>
                  {canEdit ? (
                    <button className="btn-primary" style={{ height: 32, fontSize: 12.5 }} onClick={() => setReportingId(t.id)}>
                      <i className="fa-solid fa-paper-plane" /> Send for QA Testing
                    </button>
                  ) : <LockedCard compact title="No access" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reportingId && (
        <DevReportModal
          ticket={tickets.find((t) => t.id === reportingId)}
          onClose={() => setReportingId(null)}
          onSubmit={(report) => { onSubmitAndSendForQa(reportingId, report); setReportingId(null); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function DevReportModal({ ticket, onClose, onSubmit, toast }) {
  const r = ticket?.developerTestingReport;
  const [f, setF] = useState({
    whatImplemented: r?.whatImplemented || '', whatTested: r?.whatTested || '',
    testingResults: r?.testingResults || '', limitations: r?.limitations || '',
    submittedBy: r?.submittedBy || ticket?.assignedTo?.name || '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.whatImplemented.trim() || !f.whatTested.trim() || !f.testingResults.trim()) { toast?.('Please fill in what was implemented, tested, and the results', 'warn'); return; }
    onSubmit({ ...f, attachments: [] });
  };
  return (
    <div className="tm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tm-modal tm-modal-lg">
        <div className="tm-modal-hd" style={{ background: 'linear-gradient(135deg,#F59E0B,#B45309)' }}>
          <div className="tm-modal-hd-ic"><i className="fa-solid fa-file-pen" /></div>
          <div style={{ flex: 1 }}>
            <div className="tm-modal-hd-tt">Developer Testing Report</div>
            <div className="tm-modal-hd-sb">{ticket?.ticketNumber} — {ticket?.title}</div>
          </div>
          <button className="pm-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="tm-modal-body">
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label">What Was Implemented <span className="tm-req">*</span></label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={3} value={f.whatImplemented} onChange={(e) => set('whatImplemented', e.target.value)} /></div>
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label">What Was Tested <span className="tm-req">*</span></label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={3} value={f.whatTested} onChange={(e) => set('whatTested', e.target.value)} /></div>
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label">Testing Results <span className="tm-req">*</span></label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={2} value={f.testingResults} onChange={(e) => set('testingResults', e.target.value)} /></div>
          <div className="um-field"><label className="um-label">Known Limitations <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(optional)</span></label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={2} value={f.limitations} onChange={(e) => set('limitations', e.target.value)} /></div>
        </div>
        <div className="tm-modal-ft">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}><i className="fa-solid fa-paper-plane" /> Submit Report &amp; Send for QA Testing</button>
        </div>
      </div>
    </div>
  );
}
