import React, { useMemo, useState } from 'react';
import useAsync from '../../hooks/useAsync';
import * as complianceService from '../../services/complianceService';
import { FilterBar, Field, ProblemModal, ProblemStatusBadge, PriorityBadge, EmptyState, initials } from './ComplianceShared';
import { PROBLEM_CATEGORIES, PROBLEM_PRIORITIES, ROLE_STAFF } from '../../mock/compliance';

const ALL_STAFF = [...new Set(Object.values(ROLE_STAFF).flat())];

/* ═══════════════════════════════════════════════════════════════════
   PROBLEMS & FOLLOW-UPS — full lifecycle: Open → Assigned →
   In Progress → Resolved → Verified and Closed. Every status change
   appends to the problem's own `history` array (complianceService's
   updateProblem), so the activity trail shown when a row expands is
   real, not decorative. Critical problems get their own banner on
   Overview and are never folded into the completion percentage.
   ═══════════════════════════════════════════════════════════════════ */
export default function Problems({ toast }) {
  const { data: problems = [], refetch } = useAsync(complianceService.getProblems, []);

  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const filtered = useMemo(() => problems.filter(p => {
    if (category && p.category !== category) return false;
    if (priority && p.priority !== priority) return false;
    if (status && p.status !== status) return false;
    if (search) {
      const needle = search.toLowerCase();
      if (!`${p.title} ${p.description} ${p.location} ${p.assignedTo}`.toLowerCase().includes(needle)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate)), [problems, category, priority, status, search]);

  const advance = async (p, nextStatus, extra = {}) => {
    const actionText = {
      'Assigned': `Assigned to ${extra.assignedTo || p.assignedTo}.`,
      'In Progress': 'Marked In Progress.',
      'Resolved': `Marked Resolved${extra.resolutionRemarks ? ` — ${extra.resolutionRemarks}` : '.'}`,
      'Verified and Closed': 'Verified and closed.',
    }[nextStatus];
    await complianceService.updateProblem(p.id, { status: nextStatus, ...extra }, { by: 'Dr. Islahudin', action: actionText });
    refetch();
    toast(`"${p.title}" ${nextStatus.toLowerCase()}.`, 'success');
  };

  const saveNewProblem = async (payload) => {
    await complianceService.createProblem({ ...payload, reportedBy: 'Dr. Islahudin' });
    setReportOpen(false);
    refetch();
    toast('Problem reported.', 'success');
  };

  return (
    <>
      <div className="cmp-card-h" style={{ marginBottom: 14 }}>
        <div className="cmp-card-title"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Problems &amp; Follow-ups</div>
        <button type="button" className="btn btn-primary" onClick={() => setReportOpen(true)}>
          <i className="fa-solid fa-flag" aria-hidden="true"></i> Report a Problem
        </button>
      </div>

      <FilterBar>
        <Field label="Category">
          <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {PROBLEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="">All Priorities</option>
            {PROBLEM_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['Open', 'Assigned', 'In Progress', 'Resolved', 'Verified and Closed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Search">
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, location, staff…" />
        </Field>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState icon="fa-circle-check" title="No problems match these filters" />
      ) : (
        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead><tr><th></th><th>Problem</th><th>Category</th><th>Priority</th><th>Reported By</th><th>Assigned To</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <React.Fragment key={p.id}>
                  <tr onClick={() => setExpanded(e => e === p.id ? null : p.id)} style={{ cursor: 'pointer' }}>
                    <td><i className={`fa-solid fa-chevron-${expanded === p.id ? 'down' : 'right'}`} style={{ fontSize: 10, color: 'var(--text-muted)' }} aria-hidden="true"></i></td>
                    <td><b>{p.title}</b><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.location}</div></td>
                    <td>{p.category}</td>
                    <td><PriorityBadge priority={p.priority} /></td>
                    <td>{p.reportedBy}</td>
                    <td><span className="cmp-avatar">{initials(p.assignedTo)}</span> {p.assignedTo}</td>
                    <td>{p.dueDate}</td>
                    <td><ProblemStatusBadge status={p.status} /></td>
                  </tr>
                  {expanded === p.id && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--bg-muted)' }}>
                        <div style={{ padding: '12px 4px' }}>
                          <div style={{ marginBottom: 10 }}><b>Description:</b> {p.description}</div>
                          {p.resolutionRemarks && <div style={{ marginBottom: 10 }}><b>Resolution Remarks:</b> {p.resolutionRemarks}</div>}
                          {p.photo && <div style={{ marginBottom: 10 }}><img src={p.photo} alt="Evidence" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1.5px solid var(--border-light)' }} /></div>}

                          <div className="cmp-mini-h">Activity History</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                            {p.history.map((h, i) => (
                              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{new Date(h.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> — <b>{h.by}</b>: {h.action}
                              </div>
                            ))}
                          </div>

                          <ProblemActions p={p} onAdvance={advance} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProblemModal
        open={reportOpen} initial={null}
        categories={PROBLEM_CATEGORIES} staffOptions={ALL_STAFF}
        onClose={() => setReportOpen(false)} onSave={saveNewProblem}
      />
    </>
  );
}

function ProblemActions({ p, onAdvance }) {
  const [remarks, setRemarks] = useState(p.resolutionRemarks || '');
  if (p.status === 'Verified and Closed') return <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 700 }}><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Verified and closed.</div>;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {p.status === 'Open' && (
        <button type="button" className="btn btn-secondary" onClick={() => onAdvance(p, 'Assigned')}>Assign</button>
      )}
      {(p.status === 'Open' || p.status === 'Assigned') && (
        <button type="button" className="btn btn-secondary" onClick={() => onAdvance(p, 'In Progress')}>Mark In Progress</button>
      )}
      {(p.status === 'Assigned' || p.status === 'In Progress') && (
        <>
          <input className="form-input" style={{ minWidth: 220 }} placeholder="Resolution remarks…" value={remarks} onChange={e => setRemarks(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={() => onAdvance(p, 'Resolved', { resolutionRemarks: remarks })}>Mark Resolved</button>
        </>
      )}
      {p.status === 'Resolved' && (
        <button type="button" className="btn btn-primary" onClick={() => onAdvance(p, 'Verified and Closed')}>
          <i className="fa-solid fa-stamp" aria-hidden="true"></i> Verify &amp; Close
        </button>
      )}
    </div>
  );
}
