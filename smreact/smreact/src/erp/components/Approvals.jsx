import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import * as approvalsService from '../services/approvalsService';
import { APPROVAL_ACTION_META } from '../mock/approvals';

/* ═══════════════════════════════════════════════════════════════════
   APPROVALS — central review screen for sensitive changes raised
   across Fee, Accounts, Human Resource and Inventory.

   This screen runs on a self-contained mock store
   (src/erp/mock/approvals.js) + a service layer
   (src/erp/services/approvalsService.js), mirroring the sibling app —
   the ERP has no backend Approvals API yet.

   Three views on the same store, gated conceptually by the 'approvals'
   permission module (pages/UserPermissions/permissionsData.js →
   MODULE_TREE → 'approvals.my_requests' / 'approvals.review'):
     - My Requests       — what the current user has raised
     - Pending Approvals — what's waiting on a decision
     - History           — everything already approved/rejected
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'my',      label: 'My Requests',       icon: 'fa-inbox' },
  { id: 'pending', label: 'Pending Approvals',  icon: 'fa-hourglass-half' },
  { id: 'history', label: 'History',            icon: 'fa-clock-rotate-left' },
];

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusBadgeTone(status) {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'revoked') return 'gray';
  return 'amber';
}

function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

export default function Approvals({ toast = () => {} }) {
  const [tab, setTab] = useState('pending');
  const [currentUser, setCurrentUser] = useState('');
  const [approver, setApprover] = useState(null);

  const [myRequests, setMyRequests]   = useState([]);
  const [pending, setPending]         = useState([]);
  const [history, setHistory]         = useState([]);
  const [loading, setLoading]         = useState(true);

  const [selected, setSelected]       = useState(null);   // request under review in the detail modal
  const [reviewMode, setReviewMode]   = useState(null);    // 'approve' | 'reject' | null (view-only)

  const reload = async () => {
    setLoading(true);
    try {
      const user = await approvalsService.getCurrentUser();
      const [mine, pend, hist, appr] = await Promise.all([
        approvalsService.getMyRequests(user),
        approvalsService.getPendingApprovals(),
        approvalsService.getApprovalHistory(),
        approvalsService.getCurrentApprover(),
      ]);
      setCurrentUser(user);
      setMyRequests(mine);
      setPending(pend);
      setHistory(hist);
      setApprover(appr);
    } catch (e) {
      toast(e.message || 'Failed to load approvals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = tab === 'my' ? myRequests : tab === 'pending' ? pending : history;

  const stats = useMemo(() => {
    const all = [...myRequests, ...pending, ...history];
    const byId = new Map(all.map(r => [r.id, r]));
    const unique = Array.from(byId.values());
    return {
      pending: pending.length,
      approved: unique.filter(r => r.status === 'approved').length,
      rejected: unique.filter(r => r.status === 'rejected').length,
      total: unique.length,
    };
  }, [myRequests, pending, history]);

  const openDetail = (req, mode) => { setSelected(req); setReviewMode(mode); };
  const closeDetail = () => { setSelected(null); setReviewMode(null); };

  const handleDecision = async (id, decision, comment) => {
    try {
      if (decision === 'approve') {
        await approvalsService.approveRequest(id, { reviewedBy: approver?.name, comment });
        toast('Request approved', 'success');
      } else if (decision === 'reject') {
        await approvalsService.rejectRequest(id, { reviewedBy: approver?.name, comment });
        toast('Request rejected', 'success');
      } else if (decision === 'revoke') {
        await approvalsService.revokeRequest(id, { revokedBy: currentUser });
        toast('Request revoked', 'success');
      }
      closeDetail();
      reload();
    } catch (e) {
      toast(e.message || 'Could not record decision', 'error');
    }
  };

  return (
    <>
      <style>{AP_CSS}</style>

      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-square-check"></i>
          </div>
          <div>
            <div className="page-title">Approvals</div>
            <div className="page-sub">Review and decide on sensitive changes raised across Fee, Accounts, HR &amp; Inventory</div>
          </div>
        </div>
        <div className="ap-header-meta">
          <Tooltip text="This mock environment has no real login — 'My Requests' shows what this demo user has raised.">
            <div className="ap-approver-chip">
              <span className="up-avatar">{initialsOf(currentUser)}</span>
              <div>
                <div className="ap-approver-name">{currentUser || '—'}</div>
                <div className="ap-approver-role">Requesting as</div>
              </div>
            </div>
          </Tooltip>
          <Tooltip text="This mock environment has no real login — approver identity is derived from whoever holds the Super Admin role in User Permissions.">
            <div className="ap-approver-chip">
              <span className="up-avatar">{initialsOf(approver?.name || '')}</span>
              <div>
                <div className="ap-approver-name">{approver?.name || '—'}</div>
                <div className="ap-approver-role">Approver on record</div>
              </div>
            </div>
          </Tooltip>
        </div>
      </div>

      <div className="al-stats ap-stats">
        <Stat tone="amber"  icon="fa-hourglass-half" label="Pending Approvals" value={stats.pending} sub="Awaiting a decision" />
        <Stat tone="green"  icon="fa-circle-check"   label="Approved"          value={stats.approved} sub="All-time" />
        <Stat tone="red"    icon="fa-circle-xmark"   label="Rejected"          value={stats.rejected} sub="All-time" />
        <Stat tone="blue"   icon="fa-layer-group"    label="Total Requests"    value={stats.total} sub="Across all modules" />
      </div>

      <div className="ap-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`ap-tab${tab === t.id ? ' on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}
            {t.id === 'pending' && stats.pending > 0 && <span className="ap-tab-count">{stats.pending}</span>}
          </button>
        ))}
      </div>

      <div className="al-table-card">
        <div className="al-table-h">
          <div className="al-table-title">
            <i className="fa-solid fa-list-check" aria-hidden="true"></i>
            <span>{TABS.find(t => t.id === tab)?.label}</span>
            <span className="al-count-badge">{rows.length} {rows.length === 1 ? 'request' : 'requests'}</span>
          </div>
        </div>

        {loading ? (
          <div className="up-empty">
            <div className="up-empty-ic"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></div>
            <div className="up-empty-t">Loading…</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="up-empty">
            <div className="up-empty-ic"><i className="fa-solid fa-inbox" aria-hidden="true"></i></div>
            <div className="up-empty-t">
              {tab === 'my' ? 'You haven’t raised any requests yet' : tab === 'pending' ? 'Nothing waiting on a decision' : 'No reviewed requests yet'}
            </div>
            <div className="up-empty-s">
              {tab === 'my'
                ? 'Requests you send for approval from Fee, Accounts, HR or Inventory will show up here.'
                : tab === 'pending'
                ? 'New requests from Fee, Accounts, HR or Inventory will appear here for review.'
                : 'Approved and rejected requests will be listed here for reference.'}
            </div>
          </div>
        ) : (
          <div className="al-table-scroll">
            <table className="al-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Module</th>
                  <th>Details</th>
                  <th>Requested By</th>
                  <th>Requested At</th>
                  <th>Status</th>
                  {tab !== 'pending' && <th>Reviewed By</th>}
                  <th style={{ textAlign: 'right' }}>—</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="al-td-date">{r.id}<div className="ap-action-sub">{r.actionLabel}</div></td>
                    <td>
                      <span className="al-module-chip">
                        <i className={`fa-solid ${APPROVAL_ACTION_META[r.actionType]?.icon || 'fa-square-check'}`} aria-hidden="true"></i> {r.module}
                      </span>
                    </td>
                    <td className="al-td-details">{r.entitySummary}</td>
                    <td>{r.requestedBy}</td>
                    <td className="al-td-time">{fmtDateTime(r.requestedAt)}</td>
                    <td><span className={`up-badge up-badge--${statusBadgeTone(r.status)}`}>{r.status}</span></td>
                    {tab !== 'pending' && <td>{r.reviewedBy || '—'}</td>}
                    <td style={{ textAlign: 'right' }}>
                      {tab === 'pending' ? (
                        <div className="ap-row-actions">
                          <Tooltip text="View details">
                            <button type="button" className="al-icon-btn" onClick={() => openDetail(r, null)}>
                              <i className="fa-solid fa-eye" aria-hidden="true"></i>
                            </button>
                          </Tooltip>
                          <Tooltip text="Approve">
                            <button type="button" className="al-icon-btn ap-icon-btn--green" onClick={() => openDetail(r, 'approve')}>
                              <i className="fa-solid fa-check" aria-hidden="true"></i>
                            </button>
                          </Tooltip>
                          <Tooltip text="Reject">
                            <button type="button" className="al-icon-btn ap-icon-btn--red" onClick={() => openDetail(r, 'reject')}>
                              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                            </button>
                          </Tooltip>
                        </div>
                      ) : (
                        <div className="ap-row-actions">
                          <Tooltip text="View details">
                            <button type="button" className="al-icon-btn" onClick={() => openDetail(r, null)}>
                              <i className="fa-solid fa-eye" aria-hidden="true"></i>
                            </button>
                          </Tooltip>
                          {tab === 'my' && r.status === 'pending' && (
                            <Tooltip text="Revoke your request">
                              <button type="button" className="al-icon-btn ap-icon-btn--gray" onClick={() => openDetail(r, 'revoke')}>
                                <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ApprovalDetailModal
          request={selected}
          mode={reviewMode}
          onClose={closeDetail}
          onDecide={handleDecision}
        />
      )}
    </>
  );
}

function Stat({ tone, icon, label, value, sub }) {
  return (
    <Tooltip text={`${label}: ${value}${sub ? ` — ${sub}` : ''}`} placement="top">
      <div className={`al-stat al-stat--${tone}`}>
        <div className="al-stat-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
        <div className="al-stat-lbl">{label}</div>
        <div className="al-stat-val">{value}</div>
        {sub && <div className="al-stat-sub">{sub}</div>}
      </div>
    </Tooltip>
  );
}

function ApprovalDetailModal({ request, mode, onClose, onDecide }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const isReview = mode === 'approve' || mode === 'reject';

  const submit = async () => {
    setBusy(true);
    await onDecide(request.id, mode, comment.trim());
    setBusy(false);
  };

  const payloadEntries = Object.entries(request.payload || {});
  const beforeEntries  = request.before ? Object.entries(request.before) : [];

  return createPortal(
    <div className="up-modal-back" onClick={onClose}>
      <div className="up-modal up-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className={`fa-solid ${APPROVAL_ACTION_META[request.actionType]?.icon || 'fa-square-check'}`}></i></div>
            <div>
              <div className="up-modal-title">{request.actionLabel}</div>
              <div className="up-modal-sub">{request.id} · {request.module}</div>
            </div>
          </div>
          <button type="button" className="up-modal-x" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="up-modal-body">
          <div className="al-detail-grid">
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Summary</span>
              <span className="al-detail-val">{request.entitySummary}</span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Status</span>
              <span className="al-detail-val"><span className={`up-badge up-badge--${statusBadgeTone(request.status)}`}>{request.status}</span></span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Requested By</span>
              <span className="al-detail-val">{request.requestedBy}</span>
            </div>
            <div className="al-detail-cell">
              <span className="al-detail-lbl">Requested At</span>
              <span className="al-detail-val">{fmtDateTime(request.requestedAt)}</span>
            </div>
            {request.reviewedBy && (
              <>
                <div className="al-detail-cell">
                  <span className="al-detail-lbl">Reviewed By</span>
                  <span className="al-detail-val">{request.reviewedBy}</span>
                </div>
                <div className="al-detail-cell">
                  <span className="al-detail-lbl">Reviewed At</span>
                  <span className="al-detail-val">{fmtDateTime(request.reviewedAt)}</span>
                </div>
              </>
            )}
          </div>

          {request.requestComment && (
            <div className="al-detail-block" style={{ marginBottom: 14 }}>
              <div className="al-detail-lbl">Requester's Note</div>
              <div className="al-detail-val" style={{ marginTop: 4 }}>{request.requestComment}</div>
            </div>
          )}

          {(beforeEntries.length > 0 || payloadEntries.length > 0) && (
            <div className="al-detail-row">
              {beforeEntries.length > 0 && (
                <div className="al-detail-block before">
                  <div className="al-detail-lbl">Current State</div>
                  {beforeEntries.map(([k, v]) => (
                    <div key={k} className="ap-kv"><span>{k}</span><b>{String(v)}</b></div>
                  ))}
                </div>
              )}
              <div className="al-detail-block after">
                <div className="al-detail-lbl">{beforeEntries.length ? 'Requested Change' : 'Change Details'}</div>
                {payloadEntries.map(([k, v]) => (
                  <div key={k} className="ap-kv"><span>{k}</span><b>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</b></div>
                ))}
              </div>
            </div>
          )}

          {request.status !== 'pending' && request.reviewComment && (
            <div className="al-detail-block" style={{ marginTop: 4 }}>
              <div className="al-detail-lbl">Approver's Comment</div>
              <div className="al-detail-val" style={{ marginTop: 4 }}>{request.reviewComment}</div>
            </div>
          )}

          {isReview && (
            <div style={{ marginTop: 16 }}>
              <label className="al-field">
                <span>{mode === 'approve' ? 'Approval Comment (optional)' : 'Reason for Rejection (optional)'}</span>
                <textarea
                  className="up-form-input ap-textarea"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={mode === 'approve' ? 'Add a note for the record…' : 'Let the requester know why…'}
                />
              </label>
            </div>
          )}

          {mode === 'revoke' && (
            <div className="al-detail-block" style={{ marginTop: 16 }}>
              <i className="fa-solid fa-circle-info" aria-hidden="true" style={{ marginRight: 6 }}></i>
              Withdrawing this request removes it from the approver's queue. The original change will not be applied — raise a new request if you still need it.
            </div>
          )}
        </div>

        <div className="up-modal-foot">
          <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>Close</button>
          {mode === 'approve' && (
            <button type="button" className="up-btn ap-btn-approve" disabled={busy} onClick={submit}>
              <i className="fa-solid fa-check" aria-hidden="true"></i> {busy ? 'Approving…' : 'Approve Request'}
            </button>
          )}
          {mode === 'reject' && (
            <button type="button" className="up-btn ap-btn-reject" disabled={busy} onClick={submit}>
              <i className="fa-solid fa-xmark" aria-hidden="true"></i> {busy ? 'Rejecting…' : 'Reject Request'}
            </button>
          )}
          {mode === 'revoke' && (
            <button type="button" className="up-btn ap-btn-revoke" disabled={busy} onClick={submit}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> {busy ? 'Revoking…' : 'Revoke Request'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Module CSS — self-contained (declares its own copies of the shared
   .up-* / .al-* helper classes, same defensive approach AuditLogs.jsx
   takes) plus a small .ap-* set for the tab bar and decision buttons.
   ═══════════════════════════════════════════════════════════════════ */
const AP_CSS = `
:root { --ap-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif; }
@keyframes apFade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
@keyframes apPop  { from { transform: translateY(8px) scale(.985); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

.up-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  font: 600 12px/1 var(--ap-font);
  border-radius: 9px; border: 1px solid transparent;
  cursor: pointer; transition: all .18s ease;
}
.up-btn:disabled { opacity: .5; cursor: not-allowed; }
.up-btn-ghost { background: #fff; color: #475569; border-color: #E2E8F0; }
[data-theme="dark"] .up-btn-ghost { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.up-btn-ghost:hover:not(:disabled) { background: #F1F5F9; border-color: #CBD5E1; color: #1E40AF; }

.up-form-input {
  width: 100%; padding: 10px 12px; font: 500 12.5px/1.4 var(--ap-font);
  color: var(--text-primary);
  background: #fff; border: 1px solid #E2E8F0; border-radius: 9px;
  transition: border-color .18s, box-shadow .18s, background .18s;
}
.up-form-input:focus { outline: none; border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(30, 64, 175, .12); }
[data-theme="dark"] .up-form-input { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
.ap-textarea { resize: vertical; font-family: var(--ap-font); }

.up-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff; font: 700 11px/1 var(--ap-font); flex-shrink: 0;
}

.up-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px;
  font: 700 10.5px/1 var(--ap-font);
  text-transform: uppercase; letter-spacing: .3px; white-space: nowrap;
}
.up-badge--green  { background: rgba(21, 128, 61, .12); color: #15803D; }
.up-badge--red    { background: rgba(220, 38, 38, .12); color: #B91C1C; }
.up-badge--amber  { background: rgba(217, 119, 6, .12); color: #92400E; }
.up-badge--blue   { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.up-badge--gray   { background: rgba(100, 116, 139, .14); color: #475569; }
[data-theme="dark"] .up-badge--green  { background: rgba(74, 222, 128, .18); color: #BBF7D0; }
[data-theme="dark"] .up-badge--red    { background: rgba(248, 113, 113, .18); color: #FECACA; }
[data-theme="dark"] .up-badge--amber  { background: rgba(251, 191, 36, .18); color: #FDE68A; }
[data-theme="dark"] .up-badge--blue   { background: rgba(96, 165, 250, .18); color: #BFDBFE; }
[data-theme="dark"] .up-badge--gray   { background: rgba(148, 163, 184, .18); color: #CBD5E1; }

.up-empty { text-align: center; padding: 60px 24px; animation: apFade .3s ease; }
.up-empty-ic {
  width: 64px; height: 64px; border-radius: 16px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  color: #1E40AF; font-size: 28px; margin-bottom: 14px;
}
.up-empty-t { font: 700 16px/1.4 var(--ap-font); color: var(--text-primary); margin-bottom: 4px; }
.up-empty-s { font: 500 12.5px/1.5 var(--ap-font); color: var(--text-muted, #64748B); max-width: 420px; margin: 0 auto; }

/* ─── Approver identity chip in the header ─── */
.ap-header-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ap-approver-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0); border-radius: 12px;
}
.ap-approver-name { font: 700 12.5px/1.2 var(--ap-font); color: var(--text-primary); }
.ap-approver-role { font: 600 10.5px/1.2 var(--ap-font); color: var(--text-muted, #64748B); margin-top: 2px; }

/* ─── Stat strip (reused .al-stat shape) ─── */
.al-stats.ap-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.al-stat {
  position: relative; padding: 16px 18px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px;
  transition: all .18s ease; animation: apFade .3s ease;
}
.al-stat:hover { border-color: #CBD5E1; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15, 23, 42, .06); }
.al-stat-ic {
  width: 36px; height: 36px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px; margin-bottom: 10px;
}
.al-stat--blue  .al-stat-ic { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.al-stat--green .al-stat-ic { background: rgba(21, 128, 61, .12); color: #15803D; }
.al-stat--red   .al-stat-ic { background: rgba(220, 38, 38, .12); color: #B91C1C; }
.al-stat--amber .al-stat-ic { background: rgba(217, 119, 6, .12); color: #92400E; }
.al-stat-lbl { font: 700 11px/1 var(--ap-font); color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
.al-stat-val { font: 800 26px/1 var(--ap-font); color: var(--text-primary); margin-bottom: 4px; }
.al-stat-sub { font: 500 11px/1.3 var(--ap-font); color: var(--text-muted, #64748B); }

/* ─── Tabs ─── */
.ap-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.ap-tab {
  display: inline-flex; align-items: center; gap: 8px;
  height: 38px; padding: 0 16px;
  font: 700 12.5px/1 var(--ap-font); color: #475569;
  background: var(--bg-card, #fff); border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px;
  cursor: pointer; transition: all .15s;
}
.ap-tab:hover { color: #1E40AF; border-color: #BFDBFE; }
.ap-tab.on { background: linear-gradient(135deg, #1E3A8A, #1E40AF, #2563EB); color: #fff; border-color: transparent; box-shadow: 0 4px 12px rgba(30, 58, 138, .28); }
.ap-tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  background: rgba(255,255,255,.28); border-radius: 999px;
  font: 800 10.5px/1 var(--ap-font);
}
.ap-tab:not(.on) .ap-tab-count { background: rgba(217, 119, 6, .16); color: #92400E; }

/* ─── Table (reused .al-table shape) ─── */
.al-table-card { background: var(--bg-card, #fff); border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px; overflow: hidden; margin-bottom: 18px; }
.al-table-h { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border-light, #E2E8F0); }
.al-table-title { display: inline-flex; align-items: center; gap: 8px; font: 700 13.5px/1 var(--ap-font); color: var(--text-primary); }
.al-table-title i { color: #1E40AF; font-size: 13px; }
.al-count-badge { display: inline-flex; align-items: center; padding: 3px 9px; margin-left: 4px; background: rgba(30, 64, 175, .12); color: #1E40AF; border-radius: 999px; font: 700 10.5px/1 var(--ap-font); }
.al-table-scroll { overflow-x: auto; }
.al-table { width: 100%; border-collapse: collapse; font: 500 12.5px/1.4 var(--ap-font); }
.al-table thead th {
  padding: 10px 12px; text-align: left; background: #F8FAFF;
  font: 700 10.5px/1 var(--ap-font); color: #475569;
  text-transform: uppercase; letter-spacing: .4px;
  border-bottom: 1px solid var(--border-light, #E2E8F0); white-space: nowrap;
}
[data-theme="dark"] .al-table thead th { background: rgba(96, 165, 250, .06); color: var(--text-muted, #94A3B8); }
.al-table tbody tr { border-bottom: 1px solid var(--border-light, #F1F5F9); transition: background .15s; }
.al-table tbody tr:hover { background: #F8FAFF; }
[data-theme="dark"] .al-table tbody tr:hover { background: rgba(96, 165, 250, .06); }
.al-table tbody td { padding: 12px; color: var(--text-primary); vertical-align: middle; }
.al-td-date { white-space: nowrap; font-weight: 700; }
.al-td-time { white-space: nowrap; color: var(--text-muted, #64748B); font-variant-numeric: tabular-nums; }
.al-td-details { color: var(--text-muted, #64748B); max-width: 320px; }
.ap-action-sub { font: 600 10.5px/1.3 var(--ap-font); color: var(--text-muted, #64748B); margin-top: 2px; }

.al-module-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px;
  background: rgba(30, 64, 175, .08); color: #1E40AF; border-radius: 999px;
  font: 700 11px/1 var(--ap-font); white-space: nowrap;
}
[data-theme="dark"] .al-module-chip { background: rgba(96, 165, 250, .15); color: #BFDBFE; }

.al-icon-btn {
  width: 30px; height: 30px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: #EFF6FF; color: #1E40AF; border: 1px solid #DBEAFE;
  cursor: pointer; transition: all .15s;
}
.al-icon-btn:hover { background: #1E40AF; color: #fff; border-color: #1E40AF; transform: translateY(-1px); }
[data-theme="dark"] .al-icon-btn { background: rgba(96, 165, 250, .12); border-color: rgba(96, 165, 250, .26); }
.ap-row-actions { display: inline-flex; gap: 6px; }
.ap-icon-btn--green { background: rgba(21, 128, 61, .1); color: #15803D; border-color: rgba(21, 128, 61, .28); }
.ap-icon-btn--green:hover { background: #15803D; color: #fff; border-color: #15803D; }
.ap-icon-btn--red { background: rgba(220, 38, 38, .1); color: #B91C1C; border-color: rgba(220, 38, 38, .28); }
.ap-icon-btn--red:hover { background: #B91C1C; color: #fff; border-color: #B91C1C; }
.ap-icon-btn--gray { background: rgba(100, 116, 139, .1); color: #475569; border-color: rgba(100, 116, 139, .26); }
.ap-icon-btn--gray:hover { background: #475569; color: #fff; border-color: #475569; }

/* ─── Modal (reused .up-modal-* shape) ─── */
.up-modal-back { position: fixed; inset: 0; z-index: 1000; background: rgba(15, 23, 42, .55); display: flex; align-items: center; justify-content: center; padding: 24px; animation: apFade .2s ease; backdrop-filter: blur(2px); }
.up-modal { background: var(--bg-card, #fff); border-radius: 16px; width: min(640px, 100%); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 48px rgba(15, 23, 42, .22); animation: apPop .28s ease; }
.up-modal--lg { width: min(820px, 100%); }
.up-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: linear-gradient(135deg, #1E3A8A, #1E40AF, #2563EB); color: #fff; flex-shrink: 0; }
.up-modal-head-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.up-modal-icn { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,.18); color: #fff; font-size: 16px; }
.up-modal-title { font: 800 15px/1.2 var(--ap-font); color: #fff; }
.up-modal-sub { font: 600 11.5px/1.2 var(--ap-font); color: rgba(255,255,255,.85); display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.up-modal-x { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,.16); border: none; color: #fff; cursor: pointer; transition: all .15s; }
.up-modal-x:hover { background: rgba(255,255,255,.28); transform: rotate(90deg); }
.up-modal-body { padding: 18px 20px; overflow-y: auto; flex: 1; min-height: 0; }
.up-modal-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--border-light, #E2E8F0); background: #F8FAFF; flex-shrink: 0; }
[data-theme="dark"] .up-modal-foot { background: rgba(96, 165, 250, .04); }
.ap-btn-approve { background: linear-gradient(135deg, #15803D, #16A34A); color: #fff; box-shadow: 0 4px 12px rgba(21, 128, 61, .28); }
.ap-btn-approve:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(21, 128, 61, .38); }
.ap-btn-reject { background: linear-gradient(135deg, #B91C1C, #DC2626); color: #fff; box-shadow: 0 4px 12px rgba(185, 28, 28, .28); }
.ap-btn-reject:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(185, 28, 28, .38); }
.ap-btn-revoke { background: linear-gradient(135deg, #475569, #64748B); color: #fff; box-shadow: 0 4px 12px rgba(71, 85, 105, .28); }
.ap-btn-revoke:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(71, 85, 105, .38); }

.al-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; margin-bottom: 16px; }
.al-detail-cell { display: flex; flex-direction: column; gap: 4px; }
.al-detail-lbl { font: 700 10px/1 var(--ap-font); color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: .5px; }
.al-detail-val { font: 600 12.5px/1.4 var(--ap-font); color: var(--text-primary); word-break: break-word; }
.al-detail-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.al-detail-block { padding: 12px; background: #F8FAFF; border: 1px solid var(--border-light, #DBEAFE); border-radius: 10px; }
[data-theme="dark"] .al-detail-block { background: rgba(96, 165, 250, .05); border-color: var(--border-light); }
.al-detail-block .al-detail-lbl { margin-bottom: 6px; }
.al-detail-block.before .al-detail-lbl { color: #B91C1C; }
.al-detail-block.after  .al-detail-lbl { color: #15803D; }
.ap-kv { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font: 500 12px/1.6 var(--ap-font); color: var(--text-primary); }
.ap-kv span { color: var(--text-muted, #64748B); text-transform: capitalize; }
.ap-kv b { font-weight: 700; text-align: right; word-break: break-word; }

.al-field { display: flex; flex-direction: column; gap: 6px; }
.al-field > span { font: 700 10.5px/1 var(--ap-font); color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: .4px; }

[data-theme="dark"] .al-table-card, [data-theme="dark"] .ap-approver-chip, [data-theme="dark"] .ap-tab { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .al-count-badge { background: rgba(96, 165, 250, .18); color: #BFDBFE; }
[data-theme="dark"] .al-td-time, [data-theme="dark"] .al-td-details, [data-theme="dark"] .ap-action-sub, [data-theme="dark"] .ap-approver-role { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .up-empty-ic { background: rgba(96, 165, 250, .12); color: #BFDBFE; }
[data-theme="dark"] .al-detail-block.before .al-detail-lbl { color: #FECACA; }
[data-theme="dark"] .al-detail-block.after  .al-detail-lbl { color: #BBF7D0; }
[data-theme="dark"] .al-icon-btn:hover { background: #2563EB; color: #fff; border-color: #2563EB; }

@media (max-width: 1180px) { .al-stats.ap-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 820px) {
  .al-detail-grid, .al-detail-row { grid-template-columns: 1fr; }
  .page-header { flex-wrap: wrap; gap: 10px; }
}
@media (max-width: 640px) {
  .al-stats.ap-stats { grid-template-columns: 1fr; }
  .al-table-scroll { overflow-x: auto; }
  .up-modal-back { padding: 12px; }
  .up-modal, .up-modal--lg { max-width: 96vw; width: 96vw !important; max-height: 92vh; }
  .up-modal-head { padding: 12px 14px; }
  .up-modal-body { padding: 14px; }
  .up-modal-foot { padding: 10px 14px; flex-wrap: wrap; }
}
`;
