import React, { useMemo, useState } from 'react';
import { TYPE_LABEL, TYPE_BADGE, SOURCE_LABEL, SOURCE_BADGE } from '../techTicketsData';
import LockedCard from '../adminPermissions/LockedCard';

/* ═══════════════════════════════════════════════════════════════════
   QaReviewTab — Stage 3: QA's Approve/Reject gate. Both decisions
   require comments; Reject additionally requires at least one
   attachment (screenshot/video proof) per spec — Approve's attachment
   stays optional. techTicketsData.submitQaReview stores the full
   history so repeated reject→resubmit cycles are all visible.
   Approve → Ready for Release. Reject → back to In Progress.
   ═══════════════════════════════════════════════════════════════════ */
export default function QaReviewTab({ tickets, onReview, onViewDetails, toast, canApprove = true }) {
  const [reviewing, setReviewing] = useState(null); // { ticket, decision }
  const [type, setType] = useState('all'); // 'all' | 'bug' | 'improvement'

  const filtered = useMemo(() => (type === 'all' ? tickets : tickets.filter((t) => t.type === type)), [tickets, type]);
  const bugCount = tickets.filter((t) => t.type === 'bug').length;
  const impCount = tickets.filter((t) => t.type === 'improvement').length;

  return (
    <div className="tm-body-card">
      <div className="tm-body-hd">
        <div>
          <div className="card-title"><i className="fa-solid fa-vial-circle-check" /> Review &amp; Testing (QA)</div>
          <div className="card-sub">{tickets.length} ticket{tickets.length === 1 ? '' : 's'} awaiting a QA decision</div>
        </div>
      </div>
      <div className="tm-body-pad">
        <div className="tm-subfilter-group">
          <div className="tm-subfilter">
            <button className={`tm-subfilter-btn${type === 'all' ? ' active' : ''}`} onClick={() => setType('all')}>All ({tickets.length})</button>
            <button className={`tm-subfilter-btn${type === 'bug' ? ' active' : ''}`} onClick={() => setType('bug')}><i className="fa-solid fa-bug" /> Bug Testing ({bugCount})</button>
            <button className={`tm-subfilter-btn${type === 'improvement' ? ' active' : ''}`} onClick={() => setType('improvement')}><i className="fa-solid fa-code-branch" /> New Development Testing ({impCount})</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="tm-empty"><i className="fa-solid fa-vial-circle-check" /><div>Nothing awaiting QA</div><div style={{ fontSize: 12 }}>Tickets sent for QA testing will appear here with the developer's testing report.</div></div>
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
                  <span className={`badge ${SOURCE_BADGE[t.source]?.cls}`}><i className={`fa-solid ${SOURCE_BADGE[t.source]?.icon}`} /> {SOURCE_LABEL[t.source]}</span>
                  <span><i className="fa-solid fa-school" /> {t.school.name}</span>
                  <span><i className="fa-solid fa-user-gear" /> {t.assignedTo?.name}</span>
                </div>

                {t.developerTestingReport && (
                  <div style={{ background: 'var(--muted)', borderRadius: 'var(--r-md)', padding: 12, fontSize: 12, color: 'var(--t2)', marginBottom: 10, lineHeight: 1.6 }}>
                    <div><b>Implemented:</b> {t.developerTestingReport.whatImplemented}</div>
                    <div><b>Tested:</b> {t.developerTestingReport.whatTested}</div>
                    <div><b>Results:</b> {t.developerTestingReport.testingResults}</div>
                    {t.developerTestingReport.limitations && <div><b>Limitations:</b> {t.developerTestingReport.limitations}</div>}
                  </div>
                )}

                {t.qaReview.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {t.qaReview.map((r) => (
                      <div key={r.id} className={`tm-banner ${r.decision === 'approved' ? 'tm-banner-info' : 'tm-banner-danger'}`} style={{ marginBottom: 6 }}>
                        <i className={`fa-solid ${r.decision === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                        <div><b>{r.decision === 'approved' ? 'Approved' : 'Rejected'}</b> by {r.reviewedBy} — {r.comments}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="tm-card-actions">
                  <button className="btn-sm" onClick={() => onViewDetails?.(t.id)}><i className="fa-solid fa-eye" /> View Details</button>
                  {canApprove ? (
                    <>
                      <button className="btn-sm" style={{ borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setReviewing({ ticket: t, decision: 'rejected' })}><i className="fa-solid fa-circle-xmark" /> Reject</button>
                      <button className="btn-primary" style={{ height: 32, fontSize: 12.5 }} onClick={() => setReviewing({ ticket: t, decision: 'approved' })}><i className="fa-solid fa-circle-check" /> Approve</button>
                    </>
                  ) : <LockedCard compact title="No access to review" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewing && (
        <ReviewModal
          ticket={reviewing.ticket} decision={reviewing.decision}
          onClose={() => setReviewing(null)}
          onSubmit={(comments, attachments) => { onReview(reviewing.ticket.id, reviewing.decision, comments, attachments); setReviewing(null); toast?.(reviewing.decision === 'approved' ? 'Ticket approved — Ready for Release' : 'Ticket rejected — returned to In Progress', reviewing.decision === 'approved' ? 'success' : 'info'); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function ReviewModal({ ticket, decision, onClose, onSubmit, toast }) {
  const [comments, setComments] = useState('');
  const [attachments, setAttachments] = useState([]);
  const approve = decision === 'approved';

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const staged = files.map((file) => ({ id: `qa-att-${Date.now()}-${file.name}`, name: file.name, type: file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'document', size: `${(file.size / 1024).toFixed(0)} KB` }));
    setAttachments((p) => [...p, ...staged]);
  };
  const removeAttachment = (id) => setAttachments((p) => p.filter((a) => a.id !== id));

  const submit = () => {
    if (!comments.trim()) { toast?.('Comments are required', 'warn'); return; }
    if (!approve && attachments.length === 0) { toast?.('A screenshot or video attachment is required when rejecting', 'warn'); return; }
    onSubmit(comments.trim(), attachments);
  };
  return (
    <div className="tm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tm-modal">
        <div className="tm-modal-hd" style={{ background: approve ? 'linear-gradient(135deg,#22C55E,#15803D)' : 'linear-gradient(135deg,#F43F5E,#BE123C)' }}>
          <div className="tm-modal-hd-ic"><i className={`fa-solid ${approve ? 'fa-circle-check' : 'fa-circle-xmark'}`} /></div>
          <div style={{ flex: 1 }}>
            <div className="tm-modal-hd-tt">{approve ? 'Approve Ticket' : 'Reject Ticket'}</div>
            <div className="tm-modal-hd-sb">{ticket?.ticketNumber} — {ticket?.title}</div>
          </div>
          <button className="pm-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="tm-modal-body">
          {!approve && <div className="tm-banner tm-banner-warn"><i className="fa-solid fa-triangle-exclamation" /> Rejecting will return this ticket to In Progress for the assigned developer.</div>}
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label">Comments <span className="tm-req">*</span></label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={4} autoFocus value={comments} onChange={(e) => setComments(e.target.value)} placeholder={approve ? 'What did you test and confirm?' : 'What needs to be fixed?'} /></div>
          <div className="um-field">
            <label className="um-label">Attachment {!approve && <span className="tm-req">*</span>}{approve && <span style={{ color: 'var(--tm)', fontWeight: 400 }}> (optional)</span>}</label>
            <input type="file" multiple className="um-input" style={{ height: 'auto', padding: '6px 10px' }} onChange={onFiles} />
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {attachments.map((a) => (
                  <span key={a.id} className="badge b-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <i className={`fa-solid ${a.type === 'image' ? 'fa-image' : a.type === 'video' ? 'fa-video' : 'fa-file'}`} /> {a.name}
                    <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => removeAttachment(a.id)} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="tm-modal-ft">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={!approve ? { background: 'linear-gradient(135deg,#DC2626,#B91C1C)' } : undefined} onClick={submit}>
            <i className={`fa-solid ${approve ? 'fa-circle-check' : 'fa-circle-xmark'}`} /> Confirm {approve ? 'Approval' : 'Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}
