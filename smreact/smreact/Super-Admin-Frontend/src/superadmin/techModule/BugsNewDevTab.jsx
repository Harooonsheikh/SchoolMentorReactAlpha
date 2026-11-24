import React, { useState } from 'react';
import { TYPE_LABEL, TYPE_BADGE, SOURCE_LABEL, SOURCE_BADGE } from '../techTicketsData';
import useTechDevelopers from './useTechDevelopers';
import TicketCreateForm from './TicketCreateForm';
import LockedCard from '../adminPermissions/LockedCard';
import { useSaPerms } from '../saPerms';

/* ═══════════════════════════════════════════════════════════════════
   BugsNewDevTab — Stage 1 triage queue, rendered twice by TechModule.jsx
   (once for the "Bugs" tab, once for "New Development") with `tickets`
   pre-filtered by type and a `kind` prop for the empty-state copy/create
   form default. Support-reported issues land here unassigned (per spec
   decision — no more skipping straight to In Progress from Support);
   Super Admin/Tech Lead can also create a ticket directly. Assigning a
   developer here moves the ticket to In Progress immediately
   (techTicketsData.assignTicketTo).
   ═══════════════════════════════════════════════════════════════════ */
export default function BugsNewDevTab({ tickets, kind = 'bug', onCreate, onAssign, onViewDetails, toast, canCreate = true, canAssign = true }) {
  const [showCreate, setShowCreate] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const devs = useTechDevelopers();
  const P = useSaPerms('techModule');
  const kindLabel = kind === 'bug' ? 'bug' : 'new development request';
  const assigningTicket = assigningId ? tickets.find((x) => x.id === assigningId) : null;

  return (
    <div className="tm-body-card">
      <div className="tm-body-hd">
        <div>
          <div className="card-title"><i className={`fa-solid ${kind === 'bug' ? 'fa-bug' : 'fa-code-branch'}`} /> {kind === 'bug' ? 'Bug Tickets' : 'New Development Requests'}</div>
          <div className="card-sub">{tickets.length} ticket{tickets.length === 1 ? '' : 's'} awaiting triage/assignment</div>
        </div>
        {canCreate ? (
          <button {...P.lock('bugs_new_dev', 'create', { className: 'btn-primary' })} onClick={() => { if (P.guard('bugs_new_dev', 'create', toast)) setShowCreate(true); }}><i className="fa-solid fa-plus" /> Create New</button>
        ) : <LockedCard compact title="No access to create" />}
      </div>

      <div className="tm-body-pad">
        {tickets.length === 0 ? (
          <div className="tm-empty"><i className="fa-solid fa-inbox" /><div>Nothing in the {kindLabel} queue</div><div style={{ fontSize: 12 }}>New {kindLabel}s reported from Support, schools, or internally will appear here.</div></div>
        ) : (
          <div className="tm-card-list">
            {tickets.map((t) => (
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
                  <span><i className="fa-solid fa-school" /> {t.school.name}{t.school.isTestSchool && ' (Test)'}</span>
                  <span><i className="fa-solid fa-user" /> {t.reportedBy.name}</span>
                  {t.module && <span><i className="fa-solid fa-cube" /> {t.module}</span>}
                  <span><i className="fa-regular fa-clock" /> {new Date(t.reportedAt).toLocaleString()}</span>
                </div>
                <div className="tm-card-actions">
                  <button className="btn-sm" onClick={() => onViewDetails?.(t.id)}><i className="fa-solid fa-eye" /> View Details</button>
                  {canAssign ? (
                    <button {...P.lock('bugs_new_dev', 'assign', { className: 'btn-sm' })} onClick={() => { if (P.guard('bugs_new_dev', 'assign', toast)) setAssigningId(t.id); }}><i className="fa-solid fa-user-plus" /> Assign</button>
                  ) : <LockedCard compact title="No access to assign" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assigningTicket && (
        <AssignDeveloperModal
          ticket={assigningTicket}
          devs={devs}
          canAssign={P.can('bugs_new_dev', 'assign')}
          toast={toast}
          onClose={() => setAssigningId(null)}
          onAssign={(devId) => Promise.resolve(onAssign(assigningTicket.id, devId)).then((ok) => { if (ok !== false) setAssigningId(null); })}
        />
      )}

      {showCreate && (
        <TicketCreateForm
          toast={toast}
          defaultType={kind}
          onClose={() => setShowCreate(false)}
          onCreate={(payload) => onCreate(payload)}
        />
      )}
    </div>
  );
}

/* Assign modal — developer pick + confirm, gated by the "Assigned To"
   permission (Tech Module → Bugs & New Development). No browser alert:
   result is shown as a toast by TechModule.assignTicket. */
function AssignDeveloperModal({ ticket, devs, canAssign, toast, onClose, onAssign }) {
  const [devId, setDevId] = useState('');
  const [busy, setBusy] = useState(false);
  const devName = devs.find((d) => String(d.id) === String(devId))?.name;

  const submit = () => {
    if (!canAssign) { toast?.('You don\'t have Assigned To permission. Ask an admin to enable it in User Permission.', 'warn'); return; }
    if (!devId) { toast?.('Please select a developer to assign', 'warn'); return; }
    setBusy(true);
    Promise.resolve(onAssign(devId)).finally(() => setBusy(false));
  };

  return (
    <div className="tm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="tm-modal" style={{ maxWidth: 480 }}>
        <div className="tm-modal-hd" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
          <div className="tm-modal-hd-ic"><i className="fa-solid fa-user-plus" /></div>
          <div style={{ flex: 1 }}>
            <div className="tm-modal-hd-tt">Assign Ticket</div>
            <div className="tm-modal-hd-sb">{ticket.ticketNumber} — {ticket.title}</div>
          </div>
          <button className="pm-close" onClick={onClose} disabled={busy}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="tm-modal-body">
          <div className="um-field">
            <label className="um-label">Assign To Tech Team <span className="tm-req">*</span></label>
            <select className="um-input" value={devId} disabled={!canAssign || busy} onChange={(e) => setDevId(e.target.value)}
              style={!canAssign ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
              <option value="">Select developer…</option>
              {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {!canAssign
            ? <div className="tm-banner tm-banner-info" style={{ marginTop: 12 }}><i className="fa-solid fa-lock" /> You don't have <b>Assigned To</b> permission.</div>
            : devName && <div className="tm-banner tm-banner-info" style={{ marginTop: 12 }}><i className="fa-solid fa-circle-info" /> {ticket.ticketNumber} will be assigned to <b>{devName}</b> and moved to <b>In Progress</b>.</div>}
        </div>
        <div className="tm-modal-ft">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!canAssign || !devId || busy}>
            <i className="fa-solid fa-user-plus" /> {busy ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
