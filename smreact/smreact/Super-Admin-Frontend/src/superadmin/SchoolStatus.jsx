import React, { useRef, useState } from 'react';
import {
  ASSIGNEES, INITIAL_LAUNCH, INITIAL_ERP, INITIAL_INACTIVE,
  buildSchoolDetail, INITIAL_ENQUIRIES, moduleMeta,
} from './statusData';

/* ═══════════════════════════════════════════════════════════════════
   SCHOOL STATUS (rendered in the "Schools Progress" tab) — Super Admin.

   Three groups: Launch Setup / ERP / Inactive schools, with assign,
   activate/deactivate, a Branch-Details modal, the big ERP-Detail modal
   (Progress / Follow-up / Onboarding / Training) and School Enquiries
   (bug tracker). Frontend-only demo state (see ./statusData). No backend.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Status badges ── */
function StatusBadge({ status }) {
  if (status === 'Inserted') return <span className="badge b-warn"><i className="fa-solid fa-hourglass-half" style={{ fontSize: 8 }} /> Inserted</span>;
  if (status === 'Completed') return <span className="badge b-green"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Completed</span>;
  if (status === 'Entered') return <span className="badge b-blue"><i className="fa-solid fa-check" style={{ fontSize: 8 }} /> Entered</span>;
  return <span className="badge b-red"><i className="fa-solid fa-xmark" style={{ fontSize: 8 }} /> Not Entered</span>;
}
function StatePill({ entered }) {
  return entered === 'Entered'
    ? <span className="em-pill-green"><i className="fa-solid fa-check" style={{ fontSize: 8 }} /> Entered</span>
    : <span className="em-pill-red"><i className="fa-solid fa-xmark" style={{ fontSize: 8 }} /> Not Entered</span>;
}

export default function SchoolStatus({ toast }) {
  const [tab, setTab] = useState('launch');
  const [launch, setLaunch] = useState(INITIAL_LAUNCH);
  const [erp, setErp] = useState(INITIAL_ERP);
  const [inactive, setInactive] = useState(INITIAL_INACTIVE);
  const [erpSub, setErpSub] = useState('progress');   // 'progress' | 'enquiries'

  /* Per-ERP-school detail (lazy-built) + enquiries, lifted so modal edits persist. */
  const [details, setDetails] = useState({});
  const [enquiries, setEnquiries] = useState(INITIAL_ENQUIRIES);
  const enqSeq = useRef(100);

  const [modal, setModal] = useState(null);   // { type, ... }

  const ensureDetail = (s) => {
    if (details[s.id]) return details[s.id];
    const d = buildSchoolDetail(s);
    setDetails((prev) => ({ ...prev, [s.id]: d }));
    return d;
  };
  const patchDetail = (id, updater) => setDetails((prev) => {
    const cur = prev[id] || buildSchoolDetail(erp.find((x) => x.id === id) || {});
    return { ...prev, [id]: updater(cur) };
  });

  /* ── assign ── */
  const assign = (group, id, val) => {
    const setter = group === 'launch' ? setLaunch : setErp;
    setter((prev) => prev.map((s) => s.id === id ? { ...s, assigned: val } : s));
    toast?.(`Assigned to: ${val}`, 'success');
  };

  /* ── activate / deactivate ── */
  const confirmDeactivate = (group, id) => {
    const list = group === 'launch' ? launch : erp;
    const s = list.find((x) => x.id === id);
    if (s) {
      (group === 'launch' ? setLaunch : setErp)((prev) => prev.filter((x) => x.id !== id));
      setInactive((prev) => [...prev, { ...s, staffSignup: s.staffSignup ?? 0, stuSignup: s.stuSignup ?? 0 }]);
    }
    setModal(null); toast?.('School moved to Inactive', 'info');
  };
  const confirmActivate = (id) => {
    const s = inactive.find((x) => x.id === id);
    if (s) { setInactive((prev) => prev.filter((x) => x.id !== id)); setLaunch((prev) => [...prev, s]); }
    setModal(null); toast?.('School reactivated successfully!', 'success');
  };

  const counts = { launch: launch.length, erp: erp.length, inactive: inactive.length };

  return (
    <div className="page-content">
      {/* HEADER */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-chart-line" /></div>
          <div>
            <div className="page-title">Schools Progress</div>
            <div className="page-sub">Manage school onboarding, ERP access, and inactive branches from one place.</div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-rocket" /></div><div className="stat-val">{counts.launch}</div><div className="stat-lbl">Launch Setup Schools</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-server" /></div><div className="stat-val">{counts.erp}</div><div className="stat-lbl">ERP Schools</div></div>
        <div className="stat-card s-warn"><div className="stat-icon"><i className="fa-solid fa-moon" /></div><div className="stat-val">{counts.inactive}</div><div className="stat-lbl">Inactive Schools</div></div>
      </div>

      {/* TABS */}
      <div className="app-tabs">
        <button className={`app-tab${tab === 'launch' ? ' active' : ''}`} onClick={() => setTab('launch')}><i className="fa-solid fa-rocket" /> Launch Setup Schools <span className="tab-count">{counts.launch}</span></button>
        <button className={`app-tab${tab === 'erp' ? ' active' : ''}`} onClick={() => setTab('erp')}><i className="fa-solid fa-server" /> ERP Schools <span className="tab-count">{counts.erp}</span></button>
        <button className={`app-tab${tab === 'inactive' ? ' active' : ''}`} onClick={() => setTab('inactive')}><i className="fa-solid fa-moon" /> Inactive Schools <span className="tab-count">{counts.inactive}</span></button>
      </div>

      {tab === 'launch' && (
        <LaunchPanel rows={launch} onAssign={(id, v) => assign('launch', id, v)}
          onDeactivate={(s) => setModal({ type: 'deactivate', group: 'launch', school: s })}
          onDetails={(s) => setModal({ type: 'details', school: s })} />
      )}
      {tab === 'erp' && (
        <ErpPanel rows={erp} sub={erpSub} setSub={setErpSub}
          onAssign={(id, v) => assign('erp', id, v)}
          onDeactivate={(s) => setModal({ type: 'deactivate', group: 'erp', school: s })}
          onDetails={(s) => { ensureDetail(s); setModal({ type: 'erpDetail', school: s }); }}
          enquiries={enquiries}
          onEnqAdd={(s) => setModal({ type: 'enqEdit', school: s, bug: null })}
          onEnqDetail={(s) => setModal({ type: 'enqDetail', school: s })} />
      )}
      {tab === 'inactive' && (
        <InactivePanel rows={inactive}
          onActivate={(s) => setModal({ type: 'activate', school: s })}
          onDetails={(s) => setModal({ type: 'details', school: s })} />
      )}

      {/* ── MODALS ── */}
      {modal?.type === 'details' && <BranchDetailsModal school={modal.school} onClose={() => setModal(null)} />}
      {modal?.type === 'deactivate' && (
        <ConfirmModal tone="warn" icon="fa-triangle-exclamation" title="Are you sure?"
          sub="Do you really want to deactivate this school? It will be moved to Inactive Schools and lose ERP access."
          confirmText="OK, Deactivate" confirmClass="btn-danger" confirmIcon="fa-moon"
          onConfirm={() => confirmDeactivate(modal.group, modal.school.id)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'activate' && (
        <ConfirmModal tone="green" icon="fa-circle-check" title="Reactivate School?"
          sub="This school will be moved back to active Launch Setup Schools and regain system access."
          confirmText="Make Active" confirmClass="btn-success" confirmIcon="fa-circle-check"
          onConfirm={() => confirmActivate(modal.school.id)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'erpDetail' && (
        <ErpDetailModal school={modal.school} detail={ensureDetail(modal.school)} patchDetail={patchDetail}
          toast={toast} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'enqDetail' && (
        <EnquiryDetailModal school={modal.school} bugs={enquiries[modal.school.id] || []}
          setEnquiries={setEnquiries} enqSeq={enqSeq} toast={toast}
          onAdd={() => setModal({ type: 'enqEdit', school: modal.school, bug: null, back: true })}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === 'enqEdit' && (
        <EnquiryEditModal school={modal.school} bug={modal.bug} setEnquiries={setEnquiries} enqSeq={enqSeq} toast={toast}
          onClose={() => setModal(modal.back ? { type: 'enqDetail', school: modal.school } : null)} />
      )}
    </div>
  );
}

/* ═══════════════════════ LAUNCH PANEL ═══════════════════════ */
function FilterBar({ children }) { return <div className="filter-bar">{children}</div>; }
function AssignSelect({ value, options, onChange }) {
  return (
    <select className="assign-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}
function EmptyRow({ cols, icon, msg }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className={`fa-solid fa-${icon}`} style={{ fontSize: 28, display: 'block', margin: '0 auto 12px', opacity: 0.3 }} /><div style={{ fontSize: 14, fontWeight: 700 }}>{msg}</div></td></tr>;
}

function LaunchPanel({ rows, onAssign, onDeactivate, onDetails }) {
  const [q, setQ] = useState('');
  const [color, setColor] = useState('');
  const [user, setUser] = useState('');
  const list = rows.filter((s) => (!q || s.name.toLowerCase().includes(q.toLowerCase())) && (!color || s.color === color) && (!user || s.assigned === user));
  return (
    <div className="ss-panel">
      <div className="section-card">
        <FilterBar>
          <div className="f-field"><label className="f-label"><i className="fa-solid fa-palette" style={{ color: 'var(--brand)', fontSize: 10 }} /> Select Branches Color</label>
            <select className="f-input" value={color} onChange={(e) => setColor(e.target.value)}><option value="">All Colors</option><option>Red</option><option>Green</option><option>Blue</option></select></div>
          <div className="f-field"><label className="f-label"><i className="fa-solid fa-user" style={{ color: 'var(--brand)', fontSize: 10 }} /> Select User</label>
            <select className="f-input" value={user} onChange={(e) => setUser(e.target.value)}><option value="">Select User or All</option>{ASSIGNEES.map((a) => <option key={a}>{a}</option>)}</select></div>
          <div className="f-field-grow"><label className="f-label"><i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--brand)', fontSize: 10 }} /> Search</label>
            <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools…" /></div></div>
        </FilterBar>
        <div className="tbl-wrap">
          <table className="mentor-table">
            <thead><tr><th style={{ width: 48 }}>#</th><th>Branch Name</th><th style={{ width: 90, textAlign: 'center' }}>Total Staff</th><th style={{ width: 100, textAlign: 'center' }}>Total Students</th><th style={{ width: 130 }}>Data Status</th><th style={{ width: 190 }}>Assigned To</th><th style={{ width: 145 }}>Action</th><th style={{ width: 75, textAlign: 'center' }}>Details</th></tr></thead>
            <tbody>
              {list.length === 0 ? <EmptyRow cols={8} icon="school" msg="No schools found" /> : list.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: 'var(--tm)', textAlign: 'center' }}>{i + 1}</td>
                  <td className="td-bold">{s.name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.staff}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.students}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td><AssignSelect value={s.assigned} options={['-- Unassigned --', ...ASSIGNEES]} onChange={(v) => onAssign(s.id, v)} /></td>
                  <td><button className="btn-danger" style={{ height: 34, fontSize: 12, padding: '0 12px' }} onClick={() => onDeactivate(s)}><i className="fa-solid fa-moon" /> Make InActive</button></td>
                  <td style={{ textAlign: 'center' }}><button className="det-btn" data-tip="Branch Details" data-tip-pos="left" onClick={() => onDetails(s)}><i className="fa-solid fa-chevron-down" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ ERP PANEL ═══════════════════════ */
function ErpPanel({ rows, sub, setSub, onAssign, onDeactivate, onDetails, enquiries, onEnqAdd, onEnqDetail }) {
  const [q, setQ] = useState('');
  const [user, setUser] = useState('');
  const list = rows.filter((s) => (!q || s.name.toLowerCase().includes(q.toLowerCase())) && (!user || s.assigned === user));
  const [enqQ, setEnqQ] = useState('');
  const [enqFilter, setEnqFilter] = useState('all');

  const openCount = (id) => (enquiries[id] || []).filter((b) => b.status === 'open').length;
  const resCount = (id) => (enquiries[id] || []).filter((b) => b.status === 'resolved').length;
  let enqRows = rows.filter((s) => !enqQ || s.name.toLowerCase().includes(enqQ.toLowerCase()));
  if (enqFilter === 'open') enqRows = enqRows.filter((s) => openCount(s.id) > 0);
  if (enqFilter === 'resolved') enqRows = enqRows.filter((s) => resCount(s.id) > 0);

  return (
    <div className="ss-panel">
      <div className="section-card" style={{ marginBottom: 16 }}>
        <FilterBar>
          <div className="f-field"><label className="f-label"><i className="fa-solid fa-palette" style={{ color: 'var(--brand)', fontSize: 10 }} /> Select Branches Color</label>
            <select className="f-input"><option value="">All Colors</option><option>Red</option><option>Green</option></select></div>
          <div className="f-field"><label className="f-label"><i className="fa-solid fa-user" style={{ color: 'var(--brand)', fontSize: 10 }} /> Select User</label>
            <select className="f-input" value={user} onChange={(e) => setUser(e.target.value)}><option value="">Select User or All</option>{ASSIGNEES.slice(0, 2).map((a) => <option key={a}>{a}</option>)}</select></div>
          <div className="f-field"><label className="f-label"><i className="fa-regular fa-calendar" style={{ color: 'var(--brand)', fontSize: 10 }} /> Select Month</label>
            <select className="f-input"><option>June 2026</option><option>May 2026</option><option>April 2026</option></select></div>
          <div className="f-field-grow"><label className="f-label"><i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--brand)', fontSize: 10 }} /> Search</label>
            <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools…" /></div></div>
        </FilterBar>
      </div>

      <div className="sub-tabs">
        <button className={`sub-tab${sub === 'progress' ? ' active' : ''}`} onClick={() => setSub('progress')}><i className="fa-solid fa-chart-bar" /> School Progress</button>
        <button className={`sub-tab${sub === 'enquiries' ? ' active' : ''}`} onClick={() => setSub('enquiries')}><i className="fa-solid fa-bug" /> School Enquiries</button>
      </div>

      {sub === 'progress' && (
        list.length === 0 ? (
          <div className="section-card" style={{ padding: 44, textAlign: 'center', color: 'var(--tm)' }}><i className="fa-solid fa-server" style={{ fontSize: 28, display: 'block', margin: '0 auto 12px', opacity: 0.3 }} /><div style={{ fontSize: 14, fontWeight: 700 }}>No ERP schools found</div></div>
        ) : list.map((s) => {
          const pct = s.onboarding.total ? Math.round(s.onboarding.completed / s.onboarding.total * 100) : 0;
          return (
            <div className="erp-card" key={s.id}>
              <div className="erp-top">
                <div className="erp-avatar">{s.initials}</div>
                <div className="erp-name">{s.name}</div>
                <div className="erp-stat"><div className="erp-stat-val">{s.staff}</div><div className="erp-stat-lbl">Total Staff</div></div>
                <div className="erp-divider" />
                <div className="erp-stat"><div className="erp-stat-val">{s.students}</div><div className="erp-stat-lbl">Students</div></div>
                <div className="erp-divider" />
                <AssignSelect value={s.assigned} options={ASSIGNEES} onChange={(v) => onAssign(s.id, v)} />
                <button className="btn-danger" style={{ height: 34, fontSize: 12, padding: '0 12px', marginLeft: 10 }} onClick={() => onDeactivate(s)}><i className="fa-solid fa-moon" /> Make InActive</button>
                <button className="det-btn" data-tip="View Details" data-tip-pos="left" style={{ marginLeft: 8 }} onClick={() => onDetails(s)}><i className="fa-solid fa-chevron-down" /></button>
              </div>
              <div className="erp-meta">
                <span className="erp-chip"><i className="fa-solid fa-right-to-bracket" /> {s.logins} Total Logins</span>
                <span className="erp-chip"><i className="fa-regular fa-clock" /> {s.workTime} Working Time</span>
                <span className="erp-chip"><i className="fa-regular fa-note-sticky" /> {s.notes} Notes</span>
                <span className="erp-chip"><i className="fa-solid fa-phone" /> {s.calls} Calls</span>
                <span className="erp-chip"><i className="fa-regular fa-comment" /> {s.messages} Messages</span>
              </div>
              <div className="erp-progress">
                <div className="erp-prog-info">
                  <div className="erp-prog-icon"><i className="fa-solid fa-list-check" /></div>
                  <div><div className="erp-prog-lbl">Onboarding Cards</div><div className="erp-prog-num">{String(s.onboarding.completed).padStart(2, '0')} / {s.onboarding.total}</div></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--tm)', whiteSpace: 'nowrap' }}>{s.onboarding.completed} completed</div>
                <div className="prog-track"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
                <div style={{ fontSize: 11, color: 'var(--tm)', whiteSpace: 'nowrap' }}>{s.onboarding.total - s.onboarding.completed} remaining</div>
                <div className="erp-pct">{pct}%</div>
              </div>
            </div>
          );
        })
      )}

      {sub === 'enquiries' && (
        <div>
          <div className="enq-filter-bar">
            <div className="enq-search-box"><i className="fa-solid fa-magnifying-glass" /><input value={enqQ} onChange={(e) => setEnqQ(e.target.value)} placeholder="Search schools or bugs…" /></div>
            <select className="enq-filter-sel" value={enqFilter} onChange={(e) => setEnqFilter(e.target.value)}>
              <option value="all">All Schools</option><option value="open">Has Open Bugs</option><option value="resolved">Has Resolved Bugs</option>
            </select>
          </div>
          {enqRows.length === 0 ? (
            <div className="enq-empty"><i className="fa-solid fa-bug" /><div className="enq-empty-t">No schools found</div><div className="enq-empty-s">Try adjusting your search or filters.</div></div>
          ) : (
            <div className="enq-section-card">
              <div className="tbl-wrap">
                <table className="enq-tbl">
                  <thead><tr><th style={{ width: 44 }}>#</th><th>School Name</th><th style={{ width: 130, textAlign: 'center' }}>Open Bugs</th><th style={{ width: 140, textAlign: 'center' }}>Resolved Bugs</th><th style={{ width: 130, textAlign: 'center' }}>Action</th><th style={{ width: 60, textAlign: 'center' }}>Details</th></tr></thead>
                  <tbody>
                    {enqRows.map((s, i) => {
                      const open = openCount(s.id), res = resCount(s.id);
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700, color: 'var(--tm)', textAlign: 'center' }}>{i + 1}</td>
                          <td><div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13.5 }}>{s.name}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}><i className="fa-solid fa-user-tie" style={{ fontSize: 9, marginRight: 3 }} />{s.assigned}</div></td>
                          <td style={{ textAlign: 'center' }}><span className={`badge-open${open === 0 ? ' badge-zero' : ''}`}><i className="fa-solid fa-bug" style={{ fontSize: 9 }} />{open} bug{open !== 1 ? 's' : ''}</span></td>
                          <td style={{ textAlign: 'center' }}><span className={`badge-resolved${res === 0 ? ' badge-zero' : ''}`}><i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} />{res} resolved</span></td>
                          <td style={{ textAlign: 'center' }}><button className="enq-add-btn" onClick={() => onEnqAdd(s)}><i className="fa-solid fa-plus" /> Add Inquiry</button></td>
                          <td style={{ textAlign: 'center' }}><button className="enq-det-btn" data-tip="View Enquiries" data-tip-pos="left" onClick={() => onEnqDetail(s)}><i className="fa-solid fa-chevron-down" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ INACTIVE PANEL ═══════════════════════ */
function InactivePanel({ rows, onActivate, onDetails }) {
  const [q, setQ] = useState('');
  const list = rows.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="ss-panel">
      <div className="section-card">
        <FilterBar>
          <div className="f-field"><label className="f-label"><i className="fa-solid fa-list" style={{ color: 'var(--brand)', fontSize: 10 }} /> Show entries</label>
            <select className="f-input"><option>10</option><option>25</option><option>50</option></select></div>
          <div className="f-field-grow"><label className="f-label"><i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--brand)', fontSize: 10 }} /> Search</label>
            <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inactive schools…" /></div></div>
        </FilterBar>
        <div className="tbl-wrap">
          <table className="mentor-table">
            <thead><tr><th style={{ width: 48 }}>#</th><th>Branch Name</th><th style={{ width: 100, textAlign: 'center' }}>Total Staff</th><th style={{ width: 110, textAlign: 'center' }}>Total Students</th><th style={{ width: 110, textAlign: 'center' }}>Staff Sign Up</th><th style={{ width: 120, textAlign: 'center' }}>Student Sign Up</th><th style={{ width: 130 }}>Action</th><th style={{ width: 75, textAlign: 'center' }}>Details</th></tr></thead>
            <tbody>
              {list.length === 0 ? <EmptyRow cols={8} icon="moon" msg="No inactive schools" /> : list.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: 'var(--tm)', textAlign: 'center' }}>{i + 1}</td>
                  <td className="td-bold">{s.name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.staff}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.students}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.staffSignup}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.stuSignup}</td>
                  <td><button className="btn-success" style={{ height: 34, fontSize: 12, padding: '0 12px' }} onClick={() => onActivate(s)}><i className="fa-solid fa-circle-check" /> Make Active</button></td>
                  <td style={{ textAlign: 'center' }}><button className="det-btn" data-tip="Branch Details" data-tip-pos="left" onClick={() => onDetails(s)}><i className="fa-solid fa-chevron-down" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ SHARED MODAL SHELL ═══════════════════════ */
function Overlay({ cls = 'ov', children, onClose, wrapCls = 'modal', wrapStyle }) {
  return (
    <div className={`${cls} open`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={wrapCls} style={wrapStyle}>{children}</div>
    </div>
  );
}

/* ── Branch Details (launch + inactive) ── */
function BranchDetailsModal({ school: s, onClose }) {
  const Row = ({ label, children }) => <div className="detail-row"><span className="detail-label">{label}</span>{children}</div>;
  const tabs = s.tabs || {};
  const comp = s.comp || {};
  return (
    <Overlay onClose={onClose} wrapCls="modal lg">
      <div className="modal-head">
        <div><div className="modal-title"><i className="fa-solid fa-school" /> Branch Details</div><div className="modal-sub">{s.name}</div></div>
        <button className="modal-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="modal-body">
        <div className="detail-grid">
          <div className="detail-card">
            <div className="detail-card-title"><i className="fa-solid fa-circle-info" /> General Details</div>
            <Row label="Principal Name"><span className="detail-val">{s.principal || '—'}</span></Row>
            <Row label="Contact No"><span className="detail-val-pill">{s.contact || '—'}</span></Row>
            <Row label="Total Student"><span className="detail-val-pill">{s.students ?? 0}</span></Row>
            <Row label="Total Staff"><span className="detail-val-pill">{s.staff ?? 0}</span></Row>
            <Row label="Student Sign Up"><span className="detail-val-pill">{s.stuSignup ?? 0}</span></Row>
            <Row label="Staff Sign Up"><span className="detail-val-pill">{s.staffSignup ?? 0}</span></Row>
            <Row label="Sign Up Date"><span className="detail-val-pill">{s.signupDate || '—'}</span></Row>
          </div>
          <div className="detail-card">
            <div className="detail-card-title"><i className="fa-solid fa-calendar-check" /> Date &amp; State</div>
            <Row label="School Tab"><StatusBadge status={tabs.school} /></Row>
            <Row label="Classes Tab"><StatusBadge status={tabs.classes} /></Row>
            <Row label="Student Tab"><StatusBadge status={tabs.student} /></Row>
            <Row label="Department"><StatusBadge status={tabs.dept} /></Row>
            <Row label="Staff"><StatusBadge status={tabs.staff} /></Row>
            <Row label="Syllabus"><StatusBadge status={tabs.syllabus} /></Row>
            <Row label="Time Table"><StatusBadge status={tabs.timetable} /></Row>
          </div>
        </div>
        <div className="detail-card">
          <div className="detail-card-title"><i className="fa-solid fa-triangle-exclamation" /> Compulsions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <Row label="Staff Contact"><StatusBadge status={comp.staffContact} /></Row>
            <Row label="Parent Contact"><StatusBadge status={comp.parentContact} /></Row>
            <Row label="Subject Assigned"><StatusBadge status={comp.subjectAssigned} /></Row>
            <Row label="Previous Dues"><StatusBadge status={comp.prevDues} /></Row>
          </div>
        </div>
      </div>
      <div className="modal-foot"><button className="btn-secondary" onClick={onClose}>Close</button></div>
    </Overlay>
  );
}

/* ── Confirm (deactivate / activate) ── */
function ConfirmModal({ tone, icon, title, sub, confirmText, confirmClass, confirmIcon, onConfirm, onClose }) {
  const toneStyle = tone === 'green'
    ? { background: 'rgba(22,163,74,.1)', border: '2px solid rgba(22,163,74,.25)', color: '#16A34A' }
    : { background: 'rgba(217,119,6,.1)', border: '2px solid rgba(217,119,6,.25)', color: '#D97706' };
  return (
    <Overlay onClose={onClose} wrapStyle={{ maxWidth: 420 }}>
      <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
        <div className="confirm-icon" style={toneStyle}><i className={`fa-solid ${icon}`} /></div>
        <div className="confirm-title">{title}</div>
        <div className="confirm-sub">{sub}</div>
        <div className="confirm-btns">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className={confirmClass} onClick={onConfirm}><i className={`fa-solid ${confirmIcon}`} /> {confirmText}</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ═══════════════════════ ERP DETAIL MODAL ═══════════════════════ */
function ErpDetailModal({ school: s, detail, patchDetail, toast, onClose }) {
  const [sect, setSect] = useState('progress');
  const [follow, setFollow] = useState('notes');
  const [addType, setAddType] = useState(null);     // 'note' | 'call' | 'message'
  const [histIdx, setHistIdx] = useState(null);

  const d = detail;
  const tabKeys = ['school', 'classes', 'student', 'dept', 'staff', 'syllabus', 'timetable'];
  const tabLabels = { school: 'School Tab', classes: 'Classes Tab', student: 'Student Tab', dept: 'Department', staff: 'Staff', syllabus: 'Syllabus', timetable: 'Time Table' };

  const delItem = (type, id) => {
    patchDetail(s.id, (cur) => {
      const k = type === 'note' ? 'notes' : type === 'call' ? 'calls' : 'messages';
      return { ...cur, [k]: cur[k].filter((x) => x.id !== id) };
    });
    toast?.('Deleted', 'info');
  };

  const done = d.obModules.filter((m) => m.done).length;
  const pct = Math.round(done / d.obModules.length * 100);

  return (
    <Overlay cls="ov-erp" onClose={onClose} wrapCls="erp-modal-wrap">
      {/* Header */}
      <div className="em-hdr">
        <div className="em-av">{s.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="em-school-name">{s.name}</div>
          <div className="em-school-meta">
            <span><i className="fa-solid fa-users" style={{ color: 'var(--brand)', fontSize: 9 }} /> <b>{s.staff}</b> Staff</span>
            <span><i className="fa-solid fa-user-graduate" style={{ color: 'var(--brand)', fontSize: 9 }} /> <b>{s.students}</b> Students</span>
            <span><i className="fa-solid fa-user-tie" style={{ color: 'var(--brand)', fontSize: 9 }} /> Assigned: <b>{s.assigned}</b></span>
          </div>
        </div>
        <button className="modal-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>

      {/* Nav */}
      <div className="em-nav">
        {[['progress', 'fa-chart-line', 'School Progress'], ['followup', 'fa-headset', 'Follow-up Card'], ['onboarding', 'fa-list-check', 'Onboarding Card'], ['training', 'fa-chalkboard-user', 'Training Card']].map(([k, ic, lbl]) => (
          <button key={k} className={`em-nav-btn${sect === k ? ' active' : ''}`} onClick={() => setSect(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
        ))}
      </div>

      <div className="em-body">
        {/* ── PROGRESS ── */}
        {sect === 'progress' && (
          <div className="em-sect active">
            <div className="em-info-grid">
              <div className="em-info-card">
                <div className="em-ic-title"><i className="fa-solid fa-circle-info" /> General Details</div>
                <InfoRow label="Principal Name"><span className="em-ic-val">{s.principal || '—'}</span></InfoRow>
                <InfoRow label="Contact No"><span className="em-pill-blue">{s.contact || '—'}</span></InfoRow>
                <InfoRow label="Total Students"><span className="em-pill-blue">{s.students ?? 0}</span></InfoRow>
                <InfoRow label="Total Staff"><span className="em-pill-blue">{s.staff ?? 0}</span></InfoRow>
                <InfoRow label="Student Sign Up"><span className="em-pill-blue">{s.stuSignup ?? 0}</span></InfoRow>
                <InfoRow label="Staff Sign Up"><span className="em-pill-blue">{s.staffSignup ?? 0}</span></InfoRow>
                <InfoRow label="Sign Up Date"><span className="em-pill-blue">{s.signupDate || '—'}</span></InfoRow>
              </div>
              <div className="em-info-card">
                <div className="em-ic-title"><i className="fa-solid fa-calendar-check" /> Date &amp; State</div>
                {tabKeys.map((k) => <InfoRow key={k} label={tabLabels[k]}><StatePill entered={(s.tabs || {})[k] || 'Not Entered'} /></InfoRow>)}
              </div>
            </div>
            <div className="em-comp-card">
              <div className="em-ic-title" style={{ marginBottom: 10 }}><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--warn)' }} /> Compulsions</div>
              <div className="em-comp-grid">
                <InfoRow label="Staff Contact"><StatePill entered={(s.comp || {}).staffContact} /></InfoRow>
                <InfoRow label="Parent Contact"><StatePill entered={(s.comp || {}).parentContact} /></InfoRow>
                <InfoRow label="Subject Assigned"><StatePill entered={(s.comp || {}).subjectAssigned} /></InfoRow>
                <InfoRow label="Previous Dues"><StatePill entered={(s.comp || {}).prevDues} /></InfoRow>
              </div>
            </div>
            <ProgressBlock title="Today's Progress" titleIcon="fa-calendar-day" logins={d.todayLogins} time={d.todayTime} mods={d.todayMods} />
            <ProgressBlock title="Monthly Progress" titleIcon="fa-calendar-check" logins={d.monthLogins} time={d.monthTime} mods={d.monthMods} dimInactive />
          </div>
        )}

        {/* ── FOLLOW-UP ── */}
        {sect === 'followup' && (
          <div className="em-sect active">
            <div className="em-sub-tabs">
              {[['notes', 'fa-note-sticky', 'Notes', d.notes.length], ['calls', 'fa-phone', 'Calls', d.calls.length], ['messages', 'fa-comment', 'Messages', d.messages.length]].map(([k, ic, lbl, cnt]) => (
                <button key={k} className={`em-stab${follow === k ? ' active' : ''}`} onClick={() => setFollow(k)}><i className={`fa-${k === 'notes' || k === 'messages' ? 'regular' : 'solid'} ${ic}`} /> {lbl} <span className="em-stab-cnt">{cnt}</span></button>
              ))}
            </div>
            <FollowList type={follow} items={follow === 'notes' ? d.notes : follow === 'calls' ? d.calls : d.messages}
              onAdd={() => setAddType(follow === 'notes' ? 'note' : follow === 'calls' ? 'call' : 'message')}
              onDelete={(id) => delItem(follow === 'notes' ? 'note' : follow === 'calls' ? 'call' : 'message', id)} toast={toast} />
          </div>
        )}

        {/* ── ONBOARDING ── */}
        {sect === 'onboarding' && (
          <div className="em-sect active">
            <div className="em-ob-summary">
              <div className="em-ob-sum"><div className="em-ob-val">{d.obModules.length}</div><div className="em-ob-lbl">Total Modules</div></div>
              <div className="em-ob-sum" style={{ borderColor: 'rgba(22,163,74,.3)', background: 'rgba(22,163,74,.02)' }}><div className="em-ob-val" style={{ color: '#15803D' }}>{done}</div><div className="em-ob-lbl">Completed</div></div>
              <div className="em-ob-sum" style={{ borderColor: 'rgba(217,119,6,.3)', background: 'rgba(217,119,6,.02)' }}><div className="em-ob-val" style={{ color: '#B45309' }}>{d.obModules.length - done}</div><div className="em-ob-lbl">Pending</div></div>
              <div className="em-ob-sum" style={{ borderColor: 'var(--bm)', background: 'var(--brand-light)' }}><div className="em-ob-val" style={{ color: 'var(--brand)' }}>{pct}%</div><div className="em-ob-lbl">Completion</div></div>
            </div>
            <div className="em-ob-bar-wrap">
              <div className="em-ob-bar-hdr"><span>Onboarding Progress</span><span>{done} of {d.obModules.length} modules</span></div>
              <div className="em-ob-bar"><div className="em-ob-bar-fill" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="em-ob-grid">
              {d.obModules.map((m, i) => (
                <ObCard key={m.key} m={m} idx={i}
                  onSave={(comment, date) => {
                    if (!comment && !date) { toast?.('Enter comment or date first', 'warn'); return; }
                    patchDetail(s.id, (cur) => {
                      const mods = cur.obModules.slice();
                      const cm = { ...mods[i] };
                      if (comment && date) { cm.done = true; cm.comment = comment; cm.date = date; cm.history = [...cm.history, { comment, date, user: 'schoolmentoradmin' }]; }
                      else { cm.comment = comment; cm.date = date; }
                      mods[i] = cm; return { ...cur, obModules: mods };
                    });
                    toast?.(`${m.name} saved!`, 'success');
                  }}
                  onHistory={() => setHistIdx(i)} />
              ))}
            </div>
          </div>
        )}

        {/* ── TRAINING ── */}
        {sect === 'training' && <TrainingSection toast={toast} />}
      </div>

      {/* Add follow-up popup */}
      {addType && (
        <AddFollowModal type={addType} onClose={() => setAddType(null)}
          onSave={(text, dateStr) => {
            const fmt = dateStr ? dateStr.replace('T', ', ').replace(/-/g, '/').slice(0, 16) : '—';
            patchDetail(s.id, (cur) => {
              const id = (cur._seq || 100) + 1;
              if (addType === 'note') return { ...cur, _seq: id, notes: [{ id, text, date: fmt, user: 'schoolmentoradmin' }, ...cur.notes] };
              if (addType === 'call') return { ...cur, _seq: id, calls: [{ id, detail: text, dateTime: fmt, user: 'schoolmentoradmin' }, ...cur.calls] };
              return { ...cur, _seq: id, messages: [{ id, detail: text, dateTime: fmt, user: 'schoolmentoradmin' }, ...cur.messages] };
            });
            setAddType(null);
            toast?.(`${addType.charAt(0).toUpperCase() + addType.slice(1)} added`, 'success');
          }} />
      )}

      {/* Onboarding history popup */}
      {histIdx != null && (
        <Overlay cls="em-ob-hist-ov" onClose={() => setHistIdx(null)} wrapCls="em-ob-hist-box">
          <div className="em-ob-hist-hdr"><div className="em-ob-hist-title"><i className="fa-solid fa-clock-rotate-left" /> {d.obModules[histIdx].name} — History</div><button className="modal-close" data-tip="Close" data-tip-pos="left" onClick={() => setHistIdx(null)}><i className="fa-solid fa-xmark" /></button></div>
          <div className="em-ob-hist-body">
            {d.obModules[histIdx].history.length ? d.obModules[histIdx].history.map((h, j) => (
              <div className="em-ob-h-item" key={j}><div className="em-ob-h-dot" /><div className="em-ob-h-comment">{h.comment}</div><div className="em-ob-h-date">{h.date}</div></div>
            )) : <div className="em-empty"><i className="fa-regular fa-clock" /><div className="em-empty-t">No history</div></div>}
          </div>
        </Overlay>
      )}
    </Overlay>
  );
}
function InfoRow({ label, children }) { return <div className="em-ic-row"><span className="em-ic-label">{label}</span>{children}</div>; }

function ProgressBlock({ title, titleIcon, logins, time, mods, dimInactive }) {
  const keys = Object.keys(mods);
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="em-prog-title"><i className={`fa-regular ${titleIcon}`} /> {title}</div>
      <div className="em-prog-summary">
        <div className="em-prog-card"><div className="em-prog-icon"><i className="fa-solid fa-right-to-bracket" /></div><div><div className="em-prog-val">{logins}</div><div className="em-prog-lbl">Total Logins {title.includes('Today') ? 'Today' : 'This Month'}</div></div></div>
        <div className="em-prog-card"><div className="em-prog-icon"><i className="fa-regular fa-clock" /></div><div><div className="em-prog-val">{time}</div><div className="em-prog-lbl">Total Working Time</div></div></div>
      </div>
      <div className="em-mod-grid">
        {keys.map((k) => {
          const m = moduleMeta(k); const v = mods[k]; const active = v.l > 0;
          return (
            <div className="em-mod-row" key={k} style={dimInactive && active ? { borderColor: 'var(--bm)' } : undefined}>
              <div className="em-mod-icon" style={dimInactive && !active ? { background: 'rgba(100,116,139,.3)' } : undefined}><i className={`fa-solid ${m.icon}`} /></div>
              <div style={{ flex: 1, minWidth: 0 }}><div className="em-mod-name">{m.name}</div><div className="em-mod-time"><i className="fa-regular fa-clock" style={{ fontSize: 8, marginRight: 2 }} />{v.t}</div></div>
              <span className="em-mod-count" style={dimInactive && !active ? { background: 'var(--muted)', color: 'var(--tm)' } : undefined}>{v.l} login{v.l !== 1 ? 's' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FollowList({ type, items, onAdd, onDelete, toast }) {
  const cfg = {
    notes: { icon: 'fa-note-sticky', avatar: 'note', title: 'Notes', sub: 'Internal notes and follow-up reminders', add: 'Add Note', strip: '', tf: 'text', df: 'date' },
    calls: { icon: 'fa-phone', avatar: 'call', title: 'Calls', sub: 'Call logs and phone interaction history', add: 'Add Call', strip: 'call', tf: 'detail', df: 'dateTime' },
    messages: { icon: 'fa-comment-dots', avatar: 'message', title: 'Messages', sub: 'WhatsApp, SMS, and written message logs', add: 'Add Message', strip: 'message', tf: 'detail', df: 'dateTime' },
  }[type];
  const tips = {
    notes: 'Add notes to track important information, tasks, or follow-up actions for this school.',
    calls: 'Log phone calls to keep a record of all communication with this school.',
    messages: 'Record WhatsApp, SMS, or written messages exchanged with this school.',
  };
  return (
    <div className="em-follow-panel active">
      <div className="fu-section-hdr">
        <div className="fu-section-info">
          <div className="fu-section-icon" style={{ background: cfg.avatar === 'note' ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : cfg.avatar === 'call' ? 'linear-gradient(135deg,#15803D,#16A34A)' : 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className={`fa-${type === 'calls' ? 'solid' : 'regular'} ${cfg.icon}`} /></div>
          <div><div className="fu-section-title">{cfg.title}</div><div className="fu-section-sub">{cfg.sub}</div></div>
        </div>
        <button className="fu-add-btn" onClick={onAdd}><i className="fa-solid fa-plus" /> {cfg.add}</button>
      </div>
      {items.length === 0 ? (
        <div className="fu-empty"><div className="fu-empty-icon"><i className={`fa-solid ${cfg.icon}`} /></div><div className="fu-empty-title">No {cfg.title} yet</div><div className="fu-empty-sub">{tips[type]}</div></div>
      ) : (
        <div className="fu-list">
          {items.map((item) => (
            <div className="fu-card" key={item.id}>
              <div className={`fu-card-strip${cfg.strip ? ` ${cfg.strip}` : ''}`} />
              <div className="fu-card-top">
                <div className={`fu-card-avatar ${cfg.avatar}`}><i className={`fa-solid ${cfg.icon}`} /></div>
                <div className="fu-card-body">
                  <div className="fu-card-text">{item[cfg.tf]}</div>
                  <div className="fu-card-meta">
                    <span className="fu-meta-date"><i className="fa-regular fa-calendar" />{item[cfg.df]}</span>
                    <span className="fu-meta-user"><i className="fa-solid fa-user" />{item.user}</span>
                  </div>
                </div>
                <div className="fu-card-actions">
                  <button className="fu-act-btn edit" data-tip="Edit" onClick={() => toast?.('Edit via ERP backend', 'info')}><i className="fa-solid fa-pen" /></button>
                  <button className="fu-act-btn del" data-tip="Delete" onClick={() => onDelete(item.id)}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddFollowModal({ type, onClose, onSave }) {
  const cfg = {
    note: { title: 'Add Note', icon: 'fa-note-sticky', fl: 'Note', dl: 'Date', sl: 'Save Note', dt: 'date', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' },
    call: { title: 'Add Call Log', icon: 'fa-phone', fl: 'Call Detail', dl: 'Date & Time', sl: 'Save Call', dt: 'datetime-local', grad: 'linear-gradient(135deg,#15803D,#16A34A)' },
    message: { title: 'Add Message', icon: 'fa-comment-dots', fl: 'Message Detail', dl: 'Date & Time', sl: 'Save Message', dt: 'datetime-local', grad: 'linear-gradient(135deg,#0369A1,#0284C7)' },
  }[type];
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  return (
    <Overlay cls="em-add-ov" onClose={onClose} wrapCls="em-add-box">
      <div className="em-add-hdr" style={{ background: cfg.grad }}>
        <div className="em-add-title"><i className={`fa-solid ${cfg.icon}`} /> {cfg.title}</div>
        <button className="em-add-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="em-add-body">
        <div className="em-add-f"><label>{cfg.fl}</label><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write here..." /></div>
        <div className="em-add-f"><label>{cfg.dl}</label><input type={cfg.dt} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="em-add-foot">
        <button className="btn-secondary" style={{ height: 34, padding: '0 14px', fontSize: 12.5 }} onClick={onClose}>Cancel</button>
        <button className="btn-primary" style={{ height: 34, padding: '0 16px', fontSize: 12.5 }} onClick={() => { if (!text.trim()) return; onSave(text.trim(), date); }}><i className="fa-regular fa-floppy-disk" /> {cfg.sl}</button>
      </div>
    </Overlay>
  );
}

function ObCard({ m, idx, onSave, onHistory }) {
  const [comment, setComment] = useState(m.comment);
  const [date, setDate] = useState(m.date);
  return (
    <div className={`em-ob-card${m.done ? ' done' : ''}`}>
      <div className={`em-ob-head ${m.done ? 'done' : 'pend'}`}>
        <div className="em-ob-mod-name"><div className="em-ob-mod-icon" style={{ background: m.done ? 'linear-gradient(135deg,#15803D,#16A34A)' : 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className={`fa-solid ${m.icon}`} /></div>{m.name}</div>
        {m.done ? <span className="em-ob-status-done"><i className="fa-solid fa-check" style={{ fontSize: 8 }} /> Done</span> : <span className="em-ob-status-pend"><i className="fa-solid fa-clock" style={{ fontSize: 8 }} /> Pending</span>}
      </div>
      <div className="em-ob-body">
        <div className="em-ob-flbl">Comment</div>
        <textarea className={`em-ob-ta${m.done ? ' done' : ''}`} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add comment..." />
        <div className="em-ob-flbl">Date</div>
        <input type="date" className="em-ob-date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="em-ob-foot">
        {m.done && m.history.length ? <button className="em-ob-view-btn" onClick={onHistory}><i className="fa-solid fa-eye" /> History</button> : <span />}
        <button className="em-ob-save-btn" onClick={() => onSave(comment.trim(), date)}><i className="fa-regular fa-floppy-disk" /> Save</button>
      </div>
    </div>
  );
}

function TrainingSection({ toast }) {
  const [form, setForm] = useState({ participants: '', date: '', names: '', certs: '', desc: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="em-sect active">
      <div className="em-tr-overview">
        <div className="em-tr-header">
          <div className="em-tr-icon"><i className="fa-solid fa-chalkboard-user" /></div>
          <div><div className="em-tr-title">Monthly Training Topic</div><div className="em-tr-sub">June 2026 · School Mentor ERP Training</div></div>
        </div>
        <div className="em-tr-meta">
          <div className="em-tr-field"><div className="em-tr-fl"><i className="fa-solid fa-book" style={{ color: 'var(--brand)', marginRight: 3 }} /> Topic</div><div className="em-tr-fv">ERP Advanced Features — Fee &amp; Accounts Module</div></div>
          <div className="em-tr-field"><div className="em-tr-fl"><i className="fa-solid fa-user-tie" style={{ color: 'var(--brand)', marginRight: 3 }} /> Trainer</div><div className="em-tr-fv">Dua Rizvi</div></div>
          <div className="em-tr-field" style={{ gridColumn: 'span 2' }}><div className="em-tr-fl"><i className="fa-solid fa-id-card" style={{ color: 'var(--brand)', marginRight: 3 }} /> Trainer Profile</div><div className="em-tr-fv" style={{ fontWeight: 500, fontSize: 12, color: 'var(--tm)' }}>Senior ERP Trainer · School Mentor Customer Success Team · 3 years experience</div></div>
          <div className="em-tr-field" style={{ gridColumn: 'span 2' }}><div className="em-tr-fl"><i className="fa-solid fa-align-left" style={{ color: 'var(--brand)', marginRight: 3 }} /> Training Description</div><div className="em-tr-fv" style={{ fontWeight: 500, fontSize: 12, color: 'var(--tm)', lineHeight: 1.55 }}>This month covers advanced Fee and Accounts modules including challan generation, online payments, receipt management, and financial reporting. Schools will learn automated fee reminders and defaulter tracking.</div></div>
        </div>
      </div>
      <div className="em-tr-part">
        <div className="em-tr-part-title"><i className="fa-solid fa-users" /> School Participation Details</div>
        <div className="em-tr-row">
          <div className="em-tr-fg"><label>Number of Participants</label><input className="em-tr-input" type="number" placeholder="e.g. 5" value={form.participants} onChange={(e) => set('participants', e.target.value)} /></div>
          <div className="em-tr-fg"><label>Training Date</label><input className="em-tr-input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
        </div>
        <div className="em-tr-fg" style={{ marginBottom: 11 }}><label>Participant Names</label><input className="em-tr-input" type="text" placeholder="e.g. Mr. Ahmed, Ms. Sara" value={form.names} onChange={(e) => set('names', e.target.value)} /></div>
        <div className="em-tr-fg" style={{ marginBottom: 11 }}><label>Certificates / Notes</label><input className="em-tr-input" type="text" placeholder="Certificate issued? Notes..." value={form.certs} onChange={(e) => set('certs', e.target.value)} /></div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Description / Coordination Note</label>
        <textarea className="em-tr-textarea" placeholder="Add coordination notes or follow-up actions..." value={form.desc} onChange={(e) => set('desc', e.target.value)} />
        <div className="em-tr-save"><button className="em-tr-save-btn" onClick={() => toast?.('Participation details saved', 'success')}><i className="fa-solid fa-floppy-disk" /> Save Participation Details</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════ ENQUIRIES ═══════════════════════ */
function EnquiryDetailModal({ school: s, bugs, setEnquiries, enqSeq, toast, onAdd, onClose }) {
  const [tab, setTab] = useState('open');
  const open = bugs.filter((b) => b.status === 'open');
  const res = bugs.filter((b) => b.status === 'resolved');
  const list = tab === 'open' ? open : res;

  const update = (fn) => setEnquiries((prev) => ({ ...prev, [s.id]: fn(prev[s.id] || []) }));
  const markResolved = (id) => { update((arr) => arr.map((b) => b.id === id ? { ...b, status: 'resolved' } : b)); toast?.('Bug marked as resolved', 'success'); };
  const reopen = (id) => { update((arr) => arr.map((b) => b.id === id ? { ...b, status: 'open' } : b)); toast?.('Bug reopened', 'info'); };
  const del = (id) => { update((arr) => arr.filter((b) => b.id !== id)); toast?.('Bug deleted', 'info'); };

  return (
    <Overlay cls="enq-ov" onClose={onClose} wrapCls="enq-modal">
      <div className="enq-modal-hdr">
        <div className="enq-modal-av">{s.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="enq-modal-school-name">{s.name}</div>
          <div className="enq-modal-sub">Assigned: {s.assigned} · {s.staff} Staff · {s.students} Students</div>
        </div>
        <button className="enq-add-btn" style={{ height: 34, fontSize: 12 }} onClick={onAdd}><i className="fa-solid fa-plus" /> Add Bug</button>
        <button className="enq-modal-close" data-tip="Close" data-tip-pos="left" style={{ marginLeft: 8 }} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="enq-modal-body">
        <div className="enq-summary">
          <div className="enq-sum-card open-card"><div className="enq-sum-icon open-card"><i className="fa-solid fa-bug" /></div><div><div className="enq-sum-val open-card">{open.length}</div><div className="enq-sum-lbl">Open Bugs</div></div></div>
          <div className="enq-sum-card res-card"><div className="enq-sum-icon res-card"><i className="fa-solid fa-circle-check" /></div><div><div className="enq-sum-val res-card">{res.length}</div><div className="enq-sum-lbl">Resolved Bugs</div></div></div>
        </div>
        <div className="enq-dtabs">
          <button className={`enq-dtab${tab === 'open' ? ' active' : ''}`} onClick={() => setTab('open')}><i className="fa-solid fa-bug" /> Open <span className="enq-dtab-cnt">{open.length}</span></button>
          <button className={`enq-dtab${tab === 'resolved' ? ' active' : ''}`} onClick={() => setTab('resolved')}><i className="fa-solid fa-circle-check" /> Resolved <span className="enq-dtab-cnt">{res.length}</span></button>
        </div>
        {list.length === 0 ? (
          <div className="enq-empty"><i className={`fa-solid fa-${tab === 'open' ? 'bug' : 'circle-check'}`} /><div className="enq-empty-t">No {tab === 'open' ? 'open bugs' : 'resolved bugs'} yet</div><div className="enq-empty-s">{tab === 'open' ? 'All bugs have been resolved or none added yet.' : 'No bugs have been resolved yet.'}</div></div>
        ) : (
          <div className="enq-bug-list">
            {list.map((bug) => (
              <div className={`enq-bug-card is-${bug.status}`} key={bug.id}>
                <div className="enq-bug-top">
                  <div className={`enq-bug-av is-${bug.status}`}><i className={`fa-solid fa-${bug.status === 'open' ? 'bug' : 'circle-check'}`} /></div>
                  <div className="enq-bug-body">
                    <span className="enq-bug-module"><i className="fa-solid fa-layer-group" style={{ fontSize: 8 }} /> {bug.module}</span>
                    <div className="enq-bug-desc">{bug.detail}</div>
                    <div className="enq-bug-meta">
                      <span className="enq-bug-date"><i className="fa-regular fa-calendar" style={{ fontSize: 9 }} />{bug.date}</span>
                      <span className="enq-bug-user"><i className="fa-solid fa-user" style={{ fontSize: 9 }} />{bug.user}</span>
                      <span className="enq-bug-date"><i className="fa-solid fa-code" style={{ fontSize: 9 }} />Dev: {bug.developer}</span>
                      {bug.status === 'open'
                        ? <button className="enq-resolve-btn" onClick={() => markResolved(bug.id)}><i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} /> Mark Resolved</button>
                        : <button className="enq-reopen-btn" onClick={() => reopen(bug.id)}><i className="fa-solid fa-rotate-left" style={{ fontSize: 9 }} /> Reopen</button>}
                    </div>
                  </div>
                  <div className="enq-bug-actions">
                    <button className="enq-iact del" data-tip="Delete" data-tip-pos="left" onClick={() => del(bug.id)}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}

function EnquiryEditModal({ school: s, bug, setEnquiries, enqSeq, toast, onClose }) {
  const editing = Boolean(bug);
  const [form, setForm] = useState({ module: bug?.module || '', developer: bug?.developer || '', detail: bug?.detail || '', date: bug?.date || '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.module.trim() || !form.detail.trim()) { toast?.('Module and bug detail are required', 'warn'); return; }
    setEnquiries((prev) => {
      const arr = prev[s.id] || [];
      if (editing) return { ...prev, [s.id]: arr.map((b) => b.id === bug.id ? { ...b, module: form.module.trim(), developer: form.developer.trim() || '—', detail: form.detail.trim(), date: form.date || b.date } : b) };
      const id = enqSeq.current++;
      return { ...prev, [s.id]: [{ id, module: form.module.trim(), developer: form.developer.trim() || '—', detail: form.detail.trim(), date: form.date || new Date().toLocaleDateString('en-GB'), user: 'schoolmentoradmin', status: 'open' }, ...arr] };
    });
    toast?.(editing ? 'Bug updated' : 'Bug added', 'success');
    onClose();
  };
  return (
    <Overlay cls="enq-add-ov" onClose={onClose} wrapCls="enq-add-box">
      <div className="enq-add-hdr">
        <div className="enq-add-title"><i className={`fa-solid ${editing ? 'fa-pen' : 'fa-plus'}`} /> {editing ? 'Edit' : 'Add'} Bug — {s.name}</div>
        <button className="enq-add-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="enq-add-body">
        <div className="enq-f-row">
          <div className="enq-f"><label>Module</label><input value={form.module} onChange={(e) => set('module', e.target.value)} placeholder="e.g. Fee" /></div>
          <div className="enq-f"><label>Developer</label><input value={form.developer} onChange={(e) => set('developer', e.target.value)} placeholder="e.g. Muaz" /></div>
        </div>
        <div className="enq-f"><label>Bug Detail</label><textarea value={form.detail} onChange={(e) => set('detail', e.target.value)} placeholder="Describe the bug or enquiry…" /></div>
        <div className="enq-f"><label>Date</label><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
      </div>
      <div className="enq-add-foot">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}><i className="fa-regular fa-floppy-disk" /> {editing ? 'Update Bug' : 'Save Bug'}</button>
      </div>
    </Overlay>
  );
}
