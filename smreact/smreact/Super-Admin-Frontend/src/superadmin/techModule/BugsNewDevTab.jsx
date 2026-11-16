import React, { useState } from 'react';
import { DEVELOPERS, TYPE_LABEL, TYPE_BADGE, SOURCE_LABEL, SOURCE_BADGE } from '../techTicketsData';
import TicketCreateForm from './TicketCreateForm';
import LockedCard from '../adminPermissions/LockedCard';

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
  const kindLabel = kind === 'bug' ? 'bug' : 'new development request';

  return (
    <div className="tm-body-card">
      <div className="tm-body-hd">
        <div>
          <div className="card-title"><i className={`fa-solid ${kind === 'bug' ? 'fa-bug' : 'fa-code-branch'}`} /> {kind === 'bug' ? 'Bug Tickets' : 'New Development Requests'}</div>
          <div className="card-sub">{tickets.length} ticket{tickets.length === 1 ? '' : 's'} awaiting triage/assignment</div>
        </div>
        {canCreate ? (
          <button className="btn-primary" onClick={() => setShowCreate(true)}><i className="fa-solid fa-plus" /> Create New</button>
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
                    assigningId === t.id ? (
                      <>
                        <select className="um-input" style={{ height: 32, width: 200 }} defaultValue="" onChange={(e) => { if (e.target.value) { onAssign(t.id, e.target.value); setAssigningId(null); } }}>
                          <option value="" disabled>Select developer…</option>
                          {DEVELOPERS.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.role}</option>)}
                        </select>
                        <button className="btn-sm" onClick={() => setAssigningId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn-sm" onClick={() => setAssigningId(t.id)}><i className="fa-solid fa-user-plus" /> Assign</button>
                    )
                  ) : <LockedCard compact title="No access to assign" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <TicketCreateForm
          toast={toast}
          defaultType={kind}
          onClose={() => setShowCreate(false)}
          onCreate={(payload) => { onCreate(payload); setShowCreate(false); }}
        />
      )}
    </div>
  );
}
