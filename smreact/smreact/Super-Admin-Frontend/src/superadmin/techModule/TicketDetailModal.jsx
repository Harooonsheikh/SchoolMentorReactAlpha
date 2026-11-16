import React, { useState } from 'react';
import {
  TYPE_LABEL, TYPE_BADGE, STAGE_LABEL, STAGE_BADGE, SOURCE_LABEL, SOURCE_BADGE, relatedTickets,
} from '../techTicketsData';
import { getConversation } from './mockConversations';

/* ═══════════════════════════════════════════════════════════════════
   TicketDetailModal — the comprehensive "View Details" screen, reused
   from every stage's tab (Bugs, New Development, In Progress, QA
   Review, Ready for Release). Restores + enhances the information
   architecture of the pre-redesign TechTicketDetail.jsx (recovered
   from git history for reference): School Info w/ password reveal,
   Report Info w/ conversation link, Attachments, Recurrence, Activity
   Timeline — plus new sections this module didn't have before:
   Customer Conversation inline preview, Development Activity/time,
   Developer Testing Report, QA Review History, Release Information.

   Priority is deliberately NOT shown here — removed app-wide earlier
   in this project and confirmed to stay removed even while restoring
   the rest of the old detail view's depth.
   ═══════════════════════════════════════════════════════════════════ */

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function attIcon(type) {
  return type === 'image' ? 'fa-image' : type === 'video' ? 'fa-video' : type === 'document' ? 'fa-file-lines' : 'fa-file';
}
function elapsedLabel(fromIso, toIso) {
  if (!fromIso) return '—';
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const hrs = Math.max(0, Math.round((to - from) / (60 * 60 * 1000)));
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'}`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export default function TicketDetailModal({ ticket: t, onClose, onOpenSupportSession, onOpenRelated }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [schoolExpanded, setSchoolExpanded] = useState(false);

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(t.school.password || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard permission denied — non-critical */ }
  };

  const related = t.relatedTicketIds?.length ? relatedTickets(t.relatedTicketIds) : [];
  const conversation = t.supportConversationId ? getConversation(t.supportConversationId, t) : null;

  /* Merge every attachment ever added to this ticket (initial report +
     developer testing report + each QA review round) into one list, so
     "Attachments" is the single place to see everything. */
  const allAttachments = [
    ...(t.attachments || []),
    ...(t.developerTestingReport?.attachments || []),
    ...(t.qaReview || []).flatMap((r) => r.attachments || []),
    ...(t.releaseInfo?.attachments || []),
  ];

  const workStarted = t.startedAt;
  const fixCompleted = t.fixedAt;

  return (
    <div className="tm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tm-modal tm-modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="tm-modal-hd" style={{ background: 'linear-gradient(120deg,#1E3A8A,#4F46E5,#7C3AED)' }}>
          <div className="tm-modal-hd-ic"><i className="fa-solid fa-ticket" /></div>
          <div style={{ flex: 1 }}>
            <div className="tm-modal-hd-tt">{t.ticketNumber}</div>
            <div className="tm-modal-hd-sb">{t.title}</div>
          </div>
          <button className="pm-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="tm-modal-body" style={{ overflow: 'auto', flex: 1 }}>
          {/* Header badges */}
          <div className="tm-card-meta" style={{ marginBottom: 16 }}>
            <span className={`badge ${TYPE_BADGE[t.type]?.cls}`}><i className={`fa-solid ${TYPE_BADGE[t.type]?.icon}`} /> {TYPE_LABEL[t.type]}</span>
            <span className={`badge ${STAGE_BADGE[t.stage]?.cls}`}><i className={`fa-solid ${STAGE_BADGE[t.stage]?.icon}`} /> {STAGE_LABEL[t.stage]}</span>
            <span className={`badge ${SOURCE_BADGE[t.source]?.cls}`}><i className={`fa-solid ${SOURCE_BADGE[t.source]?.icon}`} /> {SOURCE_LABEL[t.source]}</span>
          </div>

          {/* 1. Ticket Overview */}
          <Section icon="fa-circle-info" title="Ticket Overview" color="linear-gradient(135deg,#1E3A8A,#1E40AF)">
            <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: t.type === 'bug' ? 12 : 0 }}>{t.description || 'No description provided.'}</p>
            {t.type === 'bug' && (t.expectedBehaviour || t.actualBehaviour) && (
              <div className="tm-grid" style={{ marginBottom: 0 }}>
                {t.expectedBehaviour && <Field label="Expected Behaviour" val={t.expectedBehaviour} />}
                {t.actualBehaviour && <Field label="Actual Behaviour" val={t.actualBehaviour} />}
              </div>
            )}
            {t.module && <Field label="Module" val={t.module} />}
          </Section>

          {/* 2. Reporting & Source */}
          <Section icon="fa-file-lines" title="Reporting &amp; Source" color="linear-gradient(135deg,#4F46E5,#4338CA)">
            <div className="tm-fields-grid">
              <Field label="Source" val={SOURCE_LABEL[t.source]} />
              <Field label="Reported By" val={t.reportedBy?.name} />
              <Field label="School" val={t.school?.name} />
              <Field label="Reported Date &amp; Time" val={fmtDateTime(t.reportedAt)} />
            </div>
          </Section>

          {/* 3. School Information */}
          <Section icon="fa-school" title="School Information" color="linear-gradient(135deg,#0D9488,#0F766E)">
            <div className="tm-fields-grid">
              <Field label="School Name" val={t.school?.name} />
              {t.school?.branch && <Field label="Branch" val={t.school.branch} />}
              {t.school?.contact && <Field label="Contact Person" val={t.school.contact} />}
              {t.school?.phone && <Field label="Contact Number" val={t.school.phone} />}
            </div>
            {t.school?.loginId && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ color: 'var(--tm)', fontWeight: 700 }}>Login ID:</span> <span>{t.school.loginId}</span>
              </div>
            )}
            {t.school?.password && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ color: 'var(--tm)', fontWeight: 700 }}>Password:</span>
                <span style={{ fontFamily: 'monospace' }}>{showPassword ? t.school.password : '••••••••••'}</span>
                <button className="btn-sm" style={{ height: 24, width: 24, padding: 0 }} onClick={() => setShowPassword((s) => !s)}><i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} /></button>
                <button className="btn-sm" style={{ height: 24, width: 24, padding: 0 }} onClick={copyPassword}><i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} /></button>
              </div>
            )}
            <button className="btn-sm" style={{ marginTop: 12 }} onClick={() => setSchoolExpanded((s) => !s)}>
              <i className={`fa-solid ${schoolExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} /> {schoolExpanded ? 'Hide' : 'View'} School Profile
            </button>
            {schoolExpanded && (
              <div className="tm-fields-grid" style={{ marginTop: 10 }}>
                <Field label="School ID" val={t.school?.id} />
                <Field label="Account Type" val={t.school?.isTestSchool ? 'Test / Demo Account' : 'Live Member School'} />
              </div>
            )}
          </Section>

          {/* 4. Customer Conversation */}
          {conversation && (
            <Section icon="fa-comments" title="Customer Conversation" color="linear-gradient(135deg,#0891B2,#0E7490)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {conversation.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender === 'support' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '80%', background: m.sender === 'support' ? 'rgba(30,58,138,.08)' : 'var(--muted)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tm)', marginBottom: 3 }}>{m.name} · {m.time}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--t1)' }}>{m.text}</div>
                      {m.attachment && (
                        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--brand)' }}>
                          <i className={`fa-solid ${attIcon(m.attachment.type)}`} /> {m.attachment.name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {t.supportConversationId && onOpenSupportSession && (
                <button className="btn-secondary" onClick={() => onOpenSupportSession(t.supportConversationId)}><i className="fa-solid fa-headset" /> Open Support Conversation</button>
              )}
            </Section>
          )}

          {/* 5. Attachments */}
          {allAttachments.length > 0 && (
            <Section icon="fa-paperclip" title={`Attachments (${allAttachments.length})`} color="linear-gradient(135deg,#7C3AED,#6D28D9)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allAttachments.map((a, i) => (
                  <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-md)', background: 'var(--muted)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', flexShrink: 0 }}><i className={`fa-solid ${attIcon(a.type)}`} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--tm)' }}>{a.size || ''}{a.uploadedAt ? ` · ${fmtDateTime(a.uploadedAt)}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 6. Assignment Information */}
          <Section icon="fa-user-gear" title="Assignment Information" color="linear-gradient(135deg,#D97706,#B45309)">
            <div className="tm-fields-grid">
              <Field label="Assigned To" val={t.assignedTo ? t.assignedTo.name : 'Unassigned'} />
              <Field label="Assigned By" val={t.assignedBy ? t.assignedBy.name : '—'} />
              <Field label="Assigned Date" val={fmtDateTime(t.assignedAt)} />
            </div>
          </Section>

          {/* 7. Development Activity */}
          {t.assignedAt && (
            <Section icon="fa-code" title="Development Activity" color="linear-gradient(135deg,#EA580C,#C2410C)">
              <div className="tm-fields-grid">
                <Field label="Reported" val={fmtDateTime(t.reportedAt)} />
                <Field label="Assigned Developer" val={t.assignedTo?.name || '—'} />
                <Field label="Work Started" val={fmtDateTime(workStarted)} />
                <Field label="Fix Completed" val={fixCompleted ? fmtDateTime(fixCompleted) : '—'} />
                <Field label="Development Time" val={elapsedLabel(workStarted, fixCompleted)} />
              </div>
            </Section>
          )}

          {/* 8. Developer Testing Report */}
          {t.developerTestingReport && (
            <Section icon="fa-file-pen" title="Developer Testing Report" color="linear-gradient(135deg,#F59E0B,#D97706)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6 }}>
                <div><b>What Was Implemented:</b> {t.developerTestingReport.whatImplemented}</div>
                <div><b>What Was Tested:</b> {t.developerTestingReport.whatTested}</div>
                <div><b>Testing Results:</b> {t.developerTestingReport.testingResults}</div>
                {t.developerTestingReport.limitations && <div><b>Limitations:</b> {t.developerTestingReport.limitations}</div>}
                <div style={{ fontSize: 11, color: 'var(--tm)' }}>Submitted by {t.developerTestingReport.submittedBy} on {fmtDateTime(t.developerTestingReport.submittedAt)}</div>
              </div>
            </Section>
          )}

          {/* 9. QA Review History */}
          {t.qaReview?.length > 0 && (
            <Section icon="fa-vial-circle-check" title="QA Review History" color="linear-gradient(135deg,#8B5CF6,#7C3AED)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {t.qaReview.map((r) => (
                  <div key={r.id} className={`tm-banner ${r.decision === 'approved' ? 'tm-banner-info' : 'tm-banner-danger'}`} style={{ marginBottom: 0 }}>
                    <i className={`fa-solid ${r.decision === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                    <div>
                      <div><b>{r.decision === 'approved' ? 'Approved' : 'Rejected'}</b> by {r.reviewedBy} · {fmtDateTime(r.reviewedAt)}</div>
                      <div style={{ marginTop: 3 }}>{r.comments}</div>
                      {r.attachments?.length > 0 && <div style={{ marginTop: 4, fontSize: 11 }}>{r.attachments.map((a) => a.name).join(', ')}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 10. Release Information */}
          {t.releaseInfo && (
            <Section icon="fa-rocket" title="Release Information" color="linear-gradient(135deg,#10B981,#059669)">
              <div className="tm-fields-grid">
                <Field label="Released By" val={t.releaseInfo.releasedBy} />
                <Field label="Released At" val={fmtDateTime(t.releaseInfo.releasedAt)} />
                <Field label="Approved By" val={t.releaseInfo.approvedBy} />
                <Field label="Approval Date" val={fmtDateTime(t.releaseInfo.approvalDate)} />
                <Field label="Development Time" val={`${t.releaseInfo.devTimeDays} day${t.releaseInfo.devTimeDays === 1 ? '' : 's'}`} />
              </div>
              {t.releaseInfo.releaseNotes && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--t2)' }}><b>Release Notes:</b> {t.releaseInfo.releaseNotes}</div>}
              {t.releaseInfo.deploymentComments && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--t2)' }}><b>Deployment:</b> {t.releaseInfo.deploymentComments}</div>}
              {t.releaseInfo.testingComments && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--t2)' }}><b>Testing Comments:</b> {t.releaseInfo.testingComments}</div>}
            </Section>
          )}

          {/* 11. Recurrence */}
          <Section icon="fa-rotate" title="Recurrence" color="linear-gradient(135deg,#EC4899,#DB2777)">
            {t.isRecurring ? (
              <>
                <div className="tm-banner tm-banner-warn" style={{ marginBottom: 10 }}>
                  <i className="fa-solid fa-triangle-exclamation" /> Recurring Issue · Reported {t.recurrenceCount} times
                </div>
                <div className="tm-fields-grid">
                  <Field label="Affected Schools" val={t.affectedSchoolsCount} />
                  <Field label="First Reported" val={fmtDateTime(t.firstReportedAt)} />
                  <Field label="Last Reported" val={fmtDateTime(t.lastReportedAt)} />
                </div>
                {related.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {related.map((r) => (
                      <button key={r.id} className="btn-sm" onClick={() => onOpenRelated?.(r.ticketNumber)}>{r.ticketNumber} · {r.school.name}</button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--t2)' }}><i className="fa-solid fa-circle-check" style={{ color: 'var(--success)', marginRight: 6 }} /> First Time — no earlier reports of this issue.</div>
            )}
          </Section>

          {/* 12. Activity Timeline (Ticket Journey) */}
          <Section icon="fa-timeline" title="Ticket Journey" color="linear-gradient(135deg,#6366F1,#4F46E5)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {t.activity.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i === t.activity.length - 1 ? 0 : 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
                    {i < t.activity.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--bl)', marginTop: 2 }} />}
                  </div>
                  <div style={{ paddingBottom: 2 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>{ev.event}</div>
                    <div style={{ fontSize: 11, color: 'var(--tm)' }}>{fmtDateTime(ev.at)} · {ev.person}</div>
                    {ev.note && <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 2, fontStyle: 'italic' }}>&ldquo;{ev.note}&rdquo;</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children, color = 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }) {
  return (
    <div className="tm-detail-section" style={{ paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--bl)' }}>
      <div className="section-hdr" style={{ marginBottom: 10 }}>
        <div className="section-hdr-icon" style={{ background: color }}><i className={`fa-solid ${icon}`} /></div>
        <span className="section-hdr-title">{title}</span>
      </div>
      {children}
    </div>
  );
}
function Field({ label, val }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600, lineHeight: 1.4 }}>{val || '—'}</div>
    </div>
  );
}
