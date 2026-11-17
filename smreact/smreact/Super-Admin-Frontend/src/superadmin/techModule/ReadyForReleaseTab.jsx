import React, { useState } from 'react';
import { TYPE_LABEL, TYPE_BADGE, SOURCE_LABEL, SOURCE_BADGE } from '../techTicketsData';
import LockedCard from '../adminPermissions/LockedCard';

/* ═══════════════════════════════════════════════════════════════════
   ReadyForReleaseTab — Stage 4: history + release action. Releasing
   computes devTimeDays (assignedAt → releasedAt, done in
   techTicketsData.releaseTicket), then pushes an internal notification
   for Support's own "Resolved Issues" panel using the exact message
   format from spec. The full "Ticket Journey" timeline lives in
   TicketDetailModal (View Details) rather than duplicated inline here.
   ═══════════════════════════════════════════════════════════════════ */
export default function ReadyForReleaseTab({ tickets, onRelease, onViewDetails, toast, canRelease = true }) {
  const [releasing, setReleasing] = useState(null);

  const pending = tickets.filter((t) => t.stage === 'ready_for_release');
  const released = tickets.filter((t) => t.stage === 'released');

  return (
    <div className="tm-body-card">
      <div className="tm-body-hd">
        <div>
          <div className="card-title"><i className="fa-solid fa-box-open" /> Ready for Release</div>
          <div className="card-sub">{pending.length} awaiting release · {released.length} released</div>
        </div>
      </div>
      <div className="tm-body-pad">
      <div className="section-hdr"><i className="fa-solid fa-box-open section-hdr-icon" /><span className="section-hdr-title">Awaiting Release</span></div>
      {pending.length === 0 ? (
        <div className="tm-empty" style={{ padding: '24px 20px' }}><i className="fa-solid fa-box-open" /><div>Nothing awaiting release</div></div>
      ) : (
        <div className="tm-card-list" style={{ marginBottom: 24 }}>
          {pending.map((t) => {
            const lastApproval = [...t.qaReview].reverse().find((r) => r.decision === 'approved');
            return (
              <div key={t.id} className={`tm-card tm-card-${t.type}`}>
                <div className="tm-card-top">
                  <div><div className="tm-card-num">{t.ticketNumber}</div><div className="tm-card-title">{t.title}</div></div>
                  <span className={`badge ${TYPE_BADGE[t.type]?.cls}`}><i className={`fa-solid ${TYPE_BADGE[t.type]?.icon}`} /> {TYPE_LABEL[t.type]}</span>
                </div>
                <div className="tm-card-meta">
                  <span className={`badge ${SOURCE_BADGE[t.source]?.cls}`}><i className={`fa-solid ${SOURCE_BADGE[t.source]?.icon}`} /> {SOURCE_LABEL[t.source]}</span>
                  <span><i className="fa-solid fa-school" /> {t.school.name}</span>
                  <span><i className="fa-solid fa-user-gear" /> {t.assignedTo?.name}</span>
                  {lastApproval && <span><i className="fa-solid fa-user-check" /> Approved by {lastApproval.reviewedBy}</span>}
                </div>
                <div className="tm-card-actions">
                  <button className="btn-sm" onClick={() => onViewDetails?.(t.id)}><i className="fa-solid fa-eye" /> View Details</button>
                  {canRelease ? (
                    <button className="btn-primary" style={{ height: 32, fontSize: 12.5 }} onClick={() => setReleasing(t)}><i className="fa-solid fa-rocket" /> Release</button>
                  ) : <LockedCard compact title="No access to release" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-hdr"><i className="fa-solid fa-circle-check section-hdr-icon" /><span className="section-hdr-title">Released History</span></div>
      {released.length === 0 ? (
        <div className="tm-empty" style={{ padding: '24px 20px' }}><i className="fa-solid fa-circle-check" /><div>No releases yet</div></div>
      ) : (
        <div className="tm-card-list">
          {released.map((t) => (
            <div key={t.id} className={`tm-card tm-card-${t.type}`} style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.45)' }}>
              <div className="tm-card-top">
                <div><div className="tm-card-num">{t.ticketNumber}</div><div className="tm-card-title">{t.title}</div></div>
                <span className="badge tt-b-green"><i className="fa-solid fa-circle-check" /> Released</span>
              </div>
              <div className="tm-card-meta">
                <span className={`badge ${SOURCE_BADGE[t.source]?.cls}`}><i className={`fa-solid ${SOURCE_BADGE[t.source]?.icon}`} /> {SOURCE_LABEL[t.source]}</span>
                <span><i className="fa-solid fa-school" /> {t.school.name}</span>
                <span><i className="fa-solid fa-user" /> {t.releaseInfo?.releasedBy}</span>
                <span><i className="fa-regular fa-clock" /> {t.releaseInfo?.devTimeDays} day{t.releaseInfo?.devTimeDays === 1 ? '' : 's'} dev time</span>
                {t.notifiedSupport && <span className="badge tt-b-blue"><i className="fa-solid fa-bell" /> Support notified</span>}
              </div>
              <div className="tm-card-actions">
                <button className="btn-sm" onClick={() => onViewDetails?.(t.id)}><i className="fa-solid fa-eye" /> View Details</button>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      {releasing && (
        <ReleaseModal ticket={releasing} onClose={() => setReleasing(null)} toast={toast}
          onConfirm={(payload) => { onRelease(releasing.id, payload); setReleasing(null); toast?.('Ticket released — Support has been notified', 'success'); }} />
      )}
    </div>
  );
}

function ReleaseModal({ ticket, onClose, onConfirm, toast }) {
  const [testingComments, setTestingComments] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [deploymentComments, setDeploymentComments] = useState('');
  const [attachments, setAttachments] = useState([]);

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const staged = files.map((file) => ({ id: `rel-att-${Date.now()}-${file.name}`, name: file.name, type: file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'document', size: `${(file.size / 1024).toFixed(0)} KB` }));
    setAttachments((p) => [...p, ...staged]);
  };
  const removeAttachment = (id) => setAttachments((p) => p.filter((a) => a.id !== id));

  const submit = () => {
    if (!releaseNotes.trim()) { toast?.('Please enter release notes describing what was fixed/added', 'warn'); return; }
    onConfirm({ testingComments: testingComments.trim(), releaseNotes: releaseNotes.trim(), deploymentComments: deploymentComments.trim(), attachments });
  };

  return (
    <div className="tm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tm-modal tm-modal-lg">
        <div className="tm-modal-hd" style={{ background: 'linear-gradient(135deg,#14B8A6,#0E7490)' }}>
          <div className="tm-modal-hd-ic"><i className="fa-solid fa-rocket" /></div>
          <div style={{ flex: 1 }}>
            <div className="tm-modal-hd-tt">Release Ticket</div>
            <div className="tm-modal-hd-sb">{ticket.ticketNumber} — {ticket.title}</div>
          </div>
          <button className="pm-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="tm-modal-body">
          <div className="tm-banner tm-banner-info"><i className="fa-solid fa-circle-info" /> Releasing will mark this ticket Released and hand it off to Customer Support with an auto-generated "New Update Released" notification for the reporting school.</div>
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label"><i className="fa-solid fa-note-sticky" style={{ color: '#0D9488', marginRight: 5 }} /> Release Notes <span className="tm-req">*</span></label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={3} value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="What was fixed or added, in plain language for the school…" /></div>
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label"><i className="fa-solid fa-server" style={{ color: '#7C3AED', marginRight: 5 }} /> Deployment Comments <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(optional)</span></label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={2} value={deploymentComments} onChange={(e) => setDeploymentComments(e.target.value)} placeholder="Which server/release train, migration notes, etc." /></div>
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label"><i className="fa-solid fa-vial" style={{ color: '#D97706', marginRight: 5 }} /> Final Testing Comments <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(optional)</span></label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={2} value={testingComments} onChange={(e) => setTestingComments(e.target.value)} placeholder="Anything Support should know…" /></div>
          <div className="um-field">
            <label className="um-label"><i className="fa-solid fa-paperclip" style={{ color: 'var(--brand)', marginRight: 5 }} /> Attachment <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(optional)</span></label>
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
          <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#0F766E,#14B8A6)' }} onClick={submit}><i className="fa-solid fa-rocket" /> Confirm Release</button>
        </div>
      </div>
    </div>
  );
}
