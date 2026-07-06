import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_SCHOOLS, INITIAL_PAYMENTS,
  fmt, today, monthLabel, PLAN_BADGE, STATUS_BADGE, ACTION_ICON, actionsFor,
} from './mentorData';
import { branchesApi } from './api';
import PaymentReport from './PaymentReport';

/* ═══════════════════════════════════════════════════════════════════
   MENTOR AI MANAGEMENT — Super Admin module (frontend only)

   Two inner tabs:
     • Plan Management — subscription plans, tokens, usage per school
     • Payments        — transactions, receive payment, PDF/Word reports
   All data is in-component demo state (see ./mentorData). No backend.
   ═══════════════════════════════════════════════════════════════════ */

function PlanBadge({ plan }) {
  const b = PLAN_BADGE[plan] || { cls: 'b-gray', icon: 'fa-circle' };
  return <span className={`badge ${b.cls}`}><i className={`fa-solid ${b.icon}`} /> {plan}</span>;
}
function StatusBadge({ status }) {
  const b = STATUS_BADGE[status] || { cls: 'b-gray', icon: 'fa-circle' };
  return <span className={`badge ${b.cls}`}><i className={`fa-solid ${b.icon}`} /> {status}</span>;
}

export default function MentorAI({ toast }) {
  const [tab, setTab] = useState('plans');           // 'plans' | 'payments'
  const [schools, setSchools] = useState([]);
  const [payments, setPayments] = useState(INITIAL_PAYMENTS);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const paymentSeq = useRef(1009);

  /* Keep the latest toast in a ref so the loader effect below can call it
     without listing `toast` as a dependency (the parent passes a new
     function each render, which would otherwise re-fire the fetch forever). */
  const toastRef = useRef(toast);
  toastRef.current = toast;

  /* Load the branch directory + subscription state and map it into the plan
     roster. Reused for the initial load AND to refresh after a plan update,
     so the table always reflects the real subscription status from the API. */
  const loadSchools = useCallback(async () => {
    setLoadingSchools(true);
    try {
      const rows = await branchesApi.listBranchesWithPlans();
      setSchools(rows && rows.length ? rows : INITIAL_SCHOOLS);
    } catch {
      setSchools(INITIAL_SCHOOLS);
      toastRef.current?.('Could not load branches — showing sample data', 'warn');
    } finally {
      setLoadingSchools(false);
    }
  }, []);

  /* Fetch once when the screen mounts. */
  useEffect(() => { loadSchools(); }, [loadSchools]);

  const getSchool = (id) => schools.find((s) => s.id === id);

  return (
    <div className="page-content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-robot" /></div>
          <div>
            <div className="page-title">Mentor AI Management</div>
            <div className="page-sub">Manage plans, tokens and payment records for all schools</div>
          </div>
        </div>
      </div>

      {/* MODULE TABS */}
      <div className="app-tabs">
        <button className={`app-tab${tab === 'plans' ? ' active' : ''}`} onClick={() => setTab('plans')}>
          <i className="fa-solid fa-sliders" /> Plan Management
        </button>
        <button className={`app-tab${tab === 'payments' ? ' active' : ''}`} onClick={() => setTab('payments')}>
          <i className="fa-solid fa-money-bill-wave" /> Payments
        </button>
      </div>

      {tab === 'plans' && (
        <PlansPanel schools={schools} setSchools={setSchools} getSchool={getSchool} toast={toast} loading={loadingSchools} reload={loadSchools} />
      )}
      {tab === 'payments' && (
        <PaymentsPanel
          schools={schools} payments={payments} setPayments={setPayments}
          getSchool={getSchool} paymentSeq={paymentSeq} toast={toast}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ PLANS PANEL ═══════════════════════ */
function PlansPanel({ schools, setSchools, getSchool, toast, loading, reload }) {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('All Plans');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openMenu, setOpenMenu] = useState(null);
  const [modal, setModal] = useState(null);          // { type, school, ...form }

  /* Applied filters (Search button commits the live inputs) */
  const [applied, setApplied] = useState({ search: '', plan: 'All Plans', status: 'All' });

  const list = useMemo(() => {
    const q = applied.search.toLowerCase();
    return schools.filter((s) => {
      const mq = !q || s.school.toLowerCase().includes(q) || s.campus.toLowerCase().includes(q) || s.contact.includes(q);
      const mp = applied.plan === 'All Plans' || s.plan === applied.plan;
      const ms = applied.status === 'All' || s.status === applied.status;
      return mq && mp && ms;
    });
  }, [schools, applied]);

  const stats = {
    schools: list.length,
    active: list.filter((s) => s.status === 'Active').length,
    blocked: list.filter((s) => s.status === 'Blocked').length,
    tokens: fmt(list.reduce((a, s) => a + s.used, 0)),
  };

  const applyFilters = () => setApplied({ search, plan: planFilter, status: statusFilter });
  const resetFilters = () => {
    setSearch(''); setPlanFilter('All Plans'); setStatusFilter('All');
    setApplied({ search: '', plan: 'All Plans', status: 'All' });
  };

  const handleAction = (act, id) => {
    setOpenMenu(null);
    const s = getSchool(id);
    if (!s) return;
    if (act === 'block') setModal({ type: 'block', school: s, reason: '', notes: '', effective: today() });
    else if (act === 'unblock') setModal({ type: 'unblock', school: s, restore: s.plan, notes: '', effective: today() });
    else if (act === 'usage') setModal({ type: 'usage', school: s });
    else if (act === 'history') setModal({ type: 'history', school: s });
    else setModal({ type: 'plan', school: s, newPlan: act, effective: today(), due: '', notes: '' });
  };

  const confirmPlan = async () => {
    if (modal.saving) return;                    // guard against double-submit
    setModal((m) => ({ ...m, saving: true }));
    try {
      await branchesApi.updateBranchPlan(modal.school.id, modal.newPlan, true);
      setModal(null);
      toast('Plan updated successfully', 'success');
      /* Re-fetch subscriptions so the row shows the real, server-confirmed
         status/plan/period instead of an optimistic guess. */
      await reload();
    } catch (err) {
      setModal((m) => ({ ...m, saving: false }));
      toast(err?.message || 'Could not update plan', 'error');
    }
  };
  const confirmBlock = () => {
    setSchools((prev) => prev.map((s) => s.id === modal.school.id ? { ...s, status: 'Blocked' } : s));
    setModal(null); toast('School blocked from Mentor AI', 'warn');
  };
  const confirmUnblock = () => {
    setSchools((prev) => prev.map((s) => s.id === modal.school.id ? { ...s, status: 'Active', plan: modal.restore } : s));
    setModal(null); toast('Mentor AI access restored', 'success');
  };

  return (
    <div>
      <div className="stat-grid">
        <StatCard icon="fa-school" val={stats.schools} lbl="Total Schools" />
        <StatCard icon="fa-circle-check" val={stats.active} lbl="Active Plans" tone="s-green" />
        <StatCard icon="fa-ban" val={stats.blocked} lbl="Blocked" tone="s-err" />
        <StatCard icon="fa-coins" val={stats.tokens} lbl="Tokens Used" tone="s-purple" />
      </div>

      <div className="section-card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-table-list" /> Mentor AI Plan Administration</div>
            <div className="card-sub">View and manage AI subscription plans for all registered schools</div>
          </div>
        </div>

        <div className="filter-bar">
          <div className="f-field-grow">
            <label className="f-label">Search School</label>
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass" />
              <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()} placeholder="School name, campus, contact…" />
            </div>
          </div>
          <div className="f-field">
            <label className="f-label">Plan</label>
            <select className="f-input" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option>All Plans</option><option>Basic</option><option>Pro</option><option>Premium</option>
            </select>
          </div>
          <div className="f-field">
            <label className="f-label">Status</label>
            <select className="f-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>All</option><option>Active</option><option>Expired</option><option>Blocked</option><option>Inactive</option>
            </select>
          </div>
          <button className="btn-primary" onClick={applyFilters}><i className="fa-solid fa-magnifying-glass" /> Search</button>
          <button className="btn-secondary" onClick={resetFilters}><i className="fa-solid fa-rotate-left" /> Reset</button>
        </div>

        <div className="export-row">
          <button className="btn-danger" onClick={() => toast('PDF export is wired to the backend in production', 'info')}>
            <i className="fa-solid fa-file-pdf" /> Export PDF Report
          </button>
          <button className="btn-secondary" onClick={() => window.print()}><i className="fa-solid fa-print" /> Print</button>
        </div>

        <div className="tbl-wrap">
          {/* Simplified plan roster — token/usage and due-date columns removed.
             Reduced min-width + balanced column widths keep it clean (not empty)
             now that there are fewer columns. */}
          <table className="mentor-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ width: '26%' }}>School Name</th>
                <th style={{ width: '22%' }}>Campus Name</th>
                <th style={{ width: '16%' }}>Contact</th>
                <th style={{ width: '13%' }}>Current Plan</th>
                <th style={{ width: '13%' }}>Plan Status</th>
                <th style={{ width: 150 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id}>
                  <td className="td-center">{i + 1}</td>
                  <td className="td-bold">{s.school}</td>
                  <td>{s.campus}</td>
                  <td>{s.contact}</td>
                  <td><PlanBadge plan={s.plan} /></td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div className="action-wrap">
                      <button className="action-trigger" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === s.id ? null : s.id); }}>
                        Actions <i className="fa-solid fa-chevron-down" style={{ fontSize: 9 }} />
                      </button>
                      <div className={`action-menu${openMenu === s.id ? ' open' : ''}`}>
                        {actionsFor(s).map(([act, lbl]) => (
                          <button key={act} className={act === 'block' ? 'danger' : ''} onClick={() => handleAction(act, s.id)}>
                            <i className={`fa-solid ${ACTION_ICON[act] || 'fa-circle'}`} />{lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr><td className="td-empty" colSpan={7}><i className="fa-solid fa-spinner fa-spin" />Loading branches…</td></tr>
              )}
              {!loading && list.length === 0 && (
                <tr><td className="td-empty" colSpan={7}><i className="fa-solid fa-inbox" />No schools found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backdrop click closes any open action menu */}
      {openMenu !== null && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpenMenu(null)} />}

      {/* Modals */}
      {modal?.type === 'plan' && (
        <Modal title="Update Mentor AI Plan" sub="Change subscription plan for this school" icon="fa-pen-to-square"
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn-secondary" onClick={() => setModal(null)} disabled={modal.saving}>Cancel</button>
            <button className="btn-primary" onClick={confirmPlan} disabled={modal.saving}>
              <i className={`fa-solid ${modal.saving ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {modal.saving ? 'Updating…' : 'Confirm Update'}
            </button>
          </>}>
          <div className="modal-grid">
            <Field label="School Name"><input className="f-input" value={modal.school.school} readOnly /></Field>
            <Field label="Current Plan"><input className="f-input" value={modal.school.plan} readOnly /></Field>
            <Field label="New Plan">
              <select className="f-input" value={modal.newPlan} onChange={(e) => setModal({ ...modal, newPlan: e.target.value })}>
                <option>Basic</option><option>Pro</option><option>Premium</option>
              </select>
            </Field>
            <Field label="Effective Date"><input type="date" className="f-input" value={modal.effective} onChange={(e) => setModal({ ...modal, effective: e.target.value })} /></Field>
            <Field label="Due Date"><input type="date" className="f-input" value={modal.due} onChange={(e) => setModal({ ...modal, due: e.target.value })} /></Field>
            <Field label="Optional Notes"><textarea className="f-textarea" rows={2} value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      {modal?.type === 'block' && (
        <Modal title="Block Mentor AI Access" sub="Suspend AI access for this school" icon="fa-ban" iconColor="var(--err)"
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-danger" onClick={confirmBlock}><i className="fa-solid fa-ban" /> Block Mentor AI</button>
          </>}>
          <div className="modal-grid">
            <Field label="School Name"><input className="f-input" value={modal.school.school} readOnly /></Field>
            <Field label="Current Plan"><input className="f-input" value={modal.school.plan} readOnly /></Field>
            <Field label="Reason for Blocking"><input className="f-input" value={modal.reason} onChange={(e) => setModal({ ...modal, reason: e.target.value })} placeholder="Payment pending / misuse…" /></Field>
            <Field label="Effective Date"><input type="date" className="f-input" value={modal.effective} onChange={(e) => setModal({ ...modal, effective: e.target.value })} /></Field>
            <Field label="Optional Notes" span2><textarea className="f-textarea" value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      {modal?.type === 'unblock' && (
        <Modal title="Restore Mentor AI Access" sub="Reinstate AI access for this school" icon="fa-lock-open" iconColor="var(--success)"
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-success" onClick={confirmUnblock}><i className="fa-solid fa-lock-open" /> Unblock Mentor AI</button>
          </>}>
          <div className="modal-grid">
            <Field label="School Name"><input className="f-input" value={modal.school.school} readOnly /></Field>
            <Field label="Previous Plan"><input className="f-input" value={modal.school.plan} readOnly /></Field>
            <Field label="Restore Plan">
              <select className="f-input" value={modal.restore} onChange={(e) => setModal({ ...modal, restore: e.target.value })}>
                <option>Basic</option><option>Pro</option><option>Premium</option>
              </select>
            </Field>
            <Field label="Effective Date"><input type="date" className="f-input" value={modal.effective} onChange={(e) => setModal({ ...modal, effective: e.target.value })} /></Field>
            <Field label="Optional Notes" span2><textarea className="f-textarea" value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      {modal?.type === 'usage' && (
        <UsageModal
          school={modal.school}
          toast={toast}
          onWalletChange={(enabled) => setSchools((prev) => prev.map((s) =>
            s.id === modal.school.id ? { ...s, walletEnabled: enabled } : s))}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ PAYMENTS PANEL ═══════════════════════ */
function PaymentsPanel({ schools, payments, setPayments, getSchool, paymentSeq, toast }) {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('All Plans');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [applied, setApplied] = useState({ search: '', plan: 'All Plans', status: 'All', from: '', to: '' });
  const [modal, setModal] = useState(null);
  const [report, setReport] = useState(null);        // { style }
  const [reportPopup, setReportPopup] = useState(null); // type label

  const list = useMemo(() => payments.filter((x) => {
    const q = applied.search.toLowerCase();
    const mq = !q || x.school.toLowerCase().includes(q) || x.campus.toLowerCase().includes(q) || (x.reference || '').toLowerCase().includes(q);
    const mp = applied.plan === 'All Plans' || x.paymentPlan === applied.plan;
    const ms = applied.status === 'All' || x.status === applied.status;
    const mf = !applied.from || x.date.slice(0, 7) >= applied.from;
    const mt = !applied.to || x.date.slice(0, 7) <= applied.to;
    return mq && mp && ms && mf && mt;
  }), [payments, applied]);

  const received = list.filter((x) => x.status === 'Received');
  const sum = (arr) => arr.reduce((a, b) => a + Number(b.amount || 0), 0);

  const applyFilters = () => setApplied({ search, plan: planFilter, status: statusFilter, from: fromMonth, to: toMonth });
  const resetFilters = () => {
    setSearch(''); setPlanFilter('All Plans'); setStatusFilter('All'); setFromMonth(''); setToMonth('');
    setApplied({ search: '', plan: 'All Plans', status: 'All', from: '', to: '' });
  };

  const savePayment = (form) => {
    const s = getSchool(Number(form.schoolId));
    setPayments((prev) => [{
      id: paymentSeq.current++, schoolId: s.id, school: s.school, campus: s.campus, currentPlan: s.plan,
      paymentPlan: form.paymentPlan, amount: Number(form.amount || 0), date: form.date || today(),
      method: form.method, receivedBy: form.receivedBy || 'Super Admin', reference: form.reference || 'N/A',
      status: 'Received', notes: form.notes || '', proofUrl: form.proofUrl || '',
    }, ...prev]);
    setModal(null); toast('Payment recorded successfully', 'success');
  };

  return (
    <div>
      <div className="stat-grid-6">
        <StatCard icon="fa-money-bill-trend-up" val={`${fmt(sum(received))} PKR`} lbl="Total Received" tone="s-green" small />
        <StatCard icon="fa-cube" val={`${fmt(sum(received.filter((x) => x.paymentPlan === 'Basic')))} PKR`} lbl="Basic Plan" small />
        <StatCard icon="fa-cubes" val={`${fmt(sum(received.filter((x) => x.paymentPlan === 'Pro')))} PKR`} lbl="Pro Plan" tone="s-purple" small />
        <StatCard icon="fa-crown" val={`${fmt(sum(received.filter((x) => x.paymentPlan === 'Premium')))} PKR`} lbl="Premium Plan" tone="s-purple" small />
        <StatCard icon="fa-clock" val={list.filter((x) => x.status === 'Pending Verification').length} lbl="Pending Verify" tone="s-warn" />
        <StatCard icon="fa-xmark" val={list.filter((x) => x.status === 'Rejected').length} lbl="Rejected" tone="s-err" />
      </div>

      <div className="section-card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-receipt" /> Mentor AI Payments Management</div>
            <div className="card-sub">Track and manage all payment transactions for Mentor AI subscriptions</div>
          </div>
          <button className="btn-success" onClick={() => setModal({ type: 'receive' })}><i className="fa-solid fa-plus" /> Receive Payment</button>
        </div>

        <div className="filter-bar">
          <div className="f-field-grow">
            <label className="f-label">Search School</label>
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass" />
              <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()} placeholder="School, campus, reference…" />
            </div>
          </div>
          <div className="f-field">
            <label className="f-label">Payment Plan</label>
            <select className="f-input" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option>All Plans</option><option>Basic</option><option>Pro</option><option>Premium</option>
            </select>
          </div>
          <div className="f-field">
            <label className="f-label">Status</label>
            <select className="f-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>All</option><option>Received</option><option>Pending Verification</option><option>Rejected</option>
            </select>
          </div>
          <div className="f-field">
            <label className="f-label">From Month</label>
            <input type="month" className="f-input" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={applyFilters}><i className="fa-solid fa-magnifying-glass" /> Search</button>
        </div>

        <div className="filter-bar" style={{ background: 'var(--muted)' }}>
          <div className="f-field">
            <label className="f-label">To Month</label>
            <input type="month" className="f-input" value={toMonth} onChange={(e) => setToMonth(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={resetFilters}><i className="fa-solid fa-rotate-left" /> Reset</button>
          <button className="btn-danger" onClick={() => setReportPopup('PDF')}><i className="fa-solid fa-file-pdf" /> PDF Report</button>
          <button className="btn-info" onClick={() => setReportPopup('Word')}><i className="fa-solid fa-file-word" /> Word Report</button>
        </div>

        {/* Desktop table */}
        <div className="tbl-wrap payments-table-wrap">
          <table className="mentor-table">
            <thead>
              <tr>
                <th style={{ width: 46 }}>#</th><th>School Name</th><th>Campus</th><th>Current Plan</th><th>Payment Plan</th>
                <th>Amount</th><th>Date</th><th>Method</th><th>Received By</th><th>Reference</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x, i) => (
                <tr key={x.id}>
                  <td className="td-center">{i + 1}</td>
                  <td className="td-bold">{x.school}</td>
                  <td>{x.campus}</td>
                  <td><PlanBadge plan={x.currentPlan} /></td>
                  <td><PlanBadge plan={x.paymentPlan} /></td>
                  <td className="td-bold">{fmt(x.amount)} PKR</td>
                  <td>{x.date}</td>
                  <td>{x.method}</td>
                  <td>{x.receivedBy}</td>
                  <td className="td-ref">{x.reference}</td>
                  <td><StatusBadge status={x.status} /></td>
                  <td>
                    <div className="pay-actions">
                      {x.status === 'Received'
                        ? <button className="btn-sm" style={{ borderColor: '#0284C7', color: '#0284C7', background: 'rgba(2,132,199,.06)' }} onClick={() => setModal({ type: 'proof', payment: x })}><i className="fa-solid fa-image" /> View Proof</button>
                        : <button className="btn-sm" onClick={() => setModal({ type: 'history', schoolId: x.schoolId })}><i className="fa-solid fa-clock-rotate-left" /> History</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td className="td-empty" colSpan={12}><i className="fa-solid fa-inbox" />No payments found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mobile-payment-cards">
          {list.map((x) => (
            <div className="payment-mobile-card" key={x.id}>
              <h3>{x.school}</h3>
              <p><b>Campus:</b> {x.campus}</p>
              <p><b>Plan:</b> {x.paymentPlan} &nbsp;|&nbsp; <b>Amount:</b> {fmt(x.amount)} PKR</p>
              <p><b>Date:</b> {x.date} &nbsp;|&nbsp; <b>Method:</b> {x.method}</p>
              <p><b>Reference:</b> {x.reference}</p>
              <p><b>Status:</b> <StatusBadge status={x.status} /></p>
              <div className="pay-actions"><button className="btn-sm" onClick={() => setModal({ type: 'history', schoolId: x.schoolId })}><i className="fa-solid fa-clock-rotate-left" /> History</button></div>
            </div>
          ))}
        </div>

        {/* Report summary table */}
        <div className="card-header" style={{ borderTop: '1px solid var(--bl)', borderRadius: 0, marginTop: 4 }}>
          <div className="card-title"><i className="fa-solid fa-table" /> Payment Report Summary</div>
        </div>
        <div className="tbl-wrap">
          <table className="mentor-table">
            <thead>
              <tr><th>Date</th><th>School Name</th><th>Campus</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th>Received By</th></tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>{x.date}</td>
                  <td className="td-bold">{x.school}</td>
                  <td>{x.campus}</td>
                  <td><PlanBadge plan={x.paymentPlan} /></td>
                  <td className="td-bold">{fmt(x.amount)} PKR</td>
                  <td>{x.method}</td>
                  <td><StatusBadge status={x.status} /></td>
                  <td>{x.receivedBy}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td className="td-empty" colSpan={8}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'receive' && <ReceivePaymentModal schools={schools} onClose={() => setModal(null)} onSave={savePayment} />}
      {modal?.type === 'history' && <PaymentHistoryModal payments={payments} school={getSchool(modal.schoolId)} schoolId={modal.schoolId} onClose={() => setModal(null)} />}
      {modal?.type === 'proof' && <ProofViewModal payments={payments} clicked={modal.payment} from={applied.from} to={applied.to} onClose={() => setModal(null)} />}

      {reportPopup && (
        <Modal title="Select Report Style" sub={`Choose the style for your ${reportPopup} report.`} icon="fa-file-lines"
          onClose={() => setReportPopup(null)}
          footer={<button className="btn-secondary" onClick={() => setReportPopup(null)}>Cancel</button>}>
          <div className="report-popup-options">
            <div className="report-option" onClick={() => { setReport({ style: 'colorful', list, from: applied.from, to: applied.to }); setReportPopup(null); }}>
              <div className="report-option-icon"><i className="fa-solid fa-palette" /></div>
              <div className="report-option-name">Colorful Report</div>
              <div className="report-option-desc">With School Mentor branded headers and color-coded summary cards.</div>
            </div>
            <div className="report-option" onClick={() => { setReport({ style: 'colorless', list, from: applied.from, to: applied.to }); setReportPopup(null); }}>
              <div className="report-option-icon" style={{ background: 'linear-gradient(135deg,#334155,#475569)' }}><i className="fa-solid fa-print" /></div>
              <div className="report-option-name">Colorless Report</div>
              <div className="report-option-desc">Printer-friendly black and white layout, ideal for official printing.</div>
            </div>
          </div>
        </Modal>
      )}

      {report && (
        <Modal large title="Mentor AI Payment Report" icon="fa-file-lines"
          onClose={() => setReport(null)} bodyStyle={{ padding: 0 }}
          footer={<>
            <button className="btn-secondary" onClick={() => setReport(null)}>Close</button>
            <button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print" /> Print / Save</button>
          </>}>
          <PaymentReport {...report} />
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════ MODAL SUB-COMPONENTS ═══════════════════════ */
/* Wallet bucket → display metadata (label + icon), in display order. */
const WALLET_BUCKETS = [
  ['tokens', 'Tokens', 'fa-coins'],
  ['image_scans', 'Image Scans', 'fa-image'],
  ['worksheets', 'Worksheets', 'fa-file-lines'],
  ['ai_posts', 'AI Posts', 'fa-share-nodes'],
];
/* Bucket state → progress-bar / text colour. */
const BUCKET_STATE_COLOR = {
  healthy: 'var(--success)', warning: 'var(--warn)', critical: 'var(--err)', exhausted: 'var(--err)',
};

function UsageModal({ school, toast, onWalletChange, onClose }) {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [enabled, setEnabled] = useState(Boolean(school.walletEnabled));
  const [toggling, setToggling] = useState(false);

  /* Load the live wallet (usage buckets) by re-posting the current flag. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    branchesApi.getWalletUsage(school.id, Boolean(school.walletEnabled)).then(
      (w) => { if (cancelled) return; setWallet(w); if (w) setEnabled(Boolean(w.wallet_enabled)); setLoading(false); },
      () => { if (cancelled) return; setWallet(null); setLoading(false); },
    );
    return () => { cancelled = true; };
  }, [school.id, school.walletEnabled]);

  const toggleWallet = async () => {
    if (toggling) return;
    const next = !enabled;
    setToggling(true);
    try {
      const res = await branchesApi.setWalletStatus(school.id, next);
      setEnabled(Boolean(res?.wallet?.wallet_enabled ?? next));
      if (res?.wallet) setWallet(res.wallet);
      onWalletChange?.(Boolean(res?.wallet?.wallet_enabled ?? next));
      toast?.(next ? 'Wallet enabled' : 'Wallet disabled', 'success');
    } catch (err) {
      toast?.(err?.message || 'Could not update wallet', 'error');
    } finally {
      setToggling(false);
    }
  };

  const buckets = wallet?.buckets || {};

  return (
    <Modal large title="Mentor AI Usage Details" sub={`Plan: ${school.plan} · Status: ${school.status} · Due: ${school.due}`}
      icon="fa-chart-pie" onClose={onClose}
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>{school.school} — {school.campus}</div>
        <button
          className={enabled ? 'btn-success' : 'btn-secondary'}
          onClick={toggleWallet}
          disabled={toggling || loading}
          data-tip="Toggle wallet access">
          <i className={`fa-solid ${toggling ? 'fa-spinner fa-spin' : enabled ? 'fa-toggle-on' : 'fa-toggle-off'}`} />
          {' '}Wallet {enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--tm)', fontSize: 13, fontWeight: 600 }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, display: 'block', marginBottom: 10 }} />
          Loading wallet usage…
        </div>
      ) : !wallet ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--tm)', fontSize: 13, fontWeight: 600 }}>
          <i className="fa-solid fa-wallet" style={{ fontSize: 32, display: 'block', marginBottom: 10, color: 'var(--bl)' }} />
          No wallet data available for this branch.
        </div>
      ) : (
        <div className="usage-grid">
          {WALLET_BUCKETS.map(([key, label, icon]) => {
            const b = buckets[key] || { used: 0, quota: 0, remaining: 0, percent: 0, unlimited: false, state: 'healthy' };
            const pct = b.unlimited ? 0 : Math.min(100, Math.round(b.percent || 0));
            const color = BUCKET_STATE_COLOR[b.state] || 'var(--brand)';
            return (
              <div className="usage-card" key={key}>
                <div className="usage-title"><i className={`fa-solid ${icon}`} /> {label}</div>
                <div className="usage-stats"><span>Used</span><b>{fmt(b.used || 0)}</b></div>
                <div className="usage-stats"><span>Limit</span><b>{b.unlimited ? '∞' : fmt(b.quota || 0)}</b></div>
                <div className="usage-stats"><span>Remaining</span><b>{b.unlimited ? '∞' : fmt(b.remaining || 0)}</b></div>
                <div className="progress" style={{ height: 8, marginTop: 4 }}>
                  <span style={{ width: `${pct}%`, background: color }} />
                </div>
                <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 700, textTransform: 'capitalize' }}>
                  {b.unlimited ? 'Unlimited' : `${pct}% used · ${b.state || 'healthy'}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function ReceivePaymentModal({ schools, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const s = schools[0] || { id: '', campus: '', plan: 'Basic' };
    return { schoolId: s.id, campus: s.campus, currentPlan: s.plan, paymentPlan: s.plan,
      amount: '', date: today(), method: 'Bank Transfer', reference: '', receivedBy: 'Super Admin', notes: '',
      proofUrl: '', proofName: '', proofIsPdf: false };
  });
  const fileRef = useRef(null);

  const onSchool = (id) => {
    const s = schools.find((x) => x.id === Number(id)) || schools[0];
    setForm((f) => ({ ...f, schoolId: s.id, campus: s.campus, currentPlan: s.plan, paymentPlan: s.plan }));
  };

  const onFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === 'application/pdf') {
      setForm((f) => ({ ...f, proofName: file.name, proofIsPdf: true, proofUrl: '' }));
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setForm((f) => ({ ...f, proofName: file.name, proofIsPdf: false, proofUrl: ev.target.result }));
      reader.readAsDataURL(file);
    }
  };
  const clearProof = () => {
    if (fileRef.current) fileRef.current.value = '';
    setForm((f) => ({ ...f, proofName: '', proofIsPdf: false, proofUrl: '' }));
  };

  return (
    <Modal large title="Receive Mentor AI Payment" sub="Record a new payment from a school" icon="fa-money-bill-wave"
      onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(form)}><i className="fa-solid fa-floppy-disk" /> Save Payment</button>
      </>}>
      <div className="modal-grid">
        <Field label="School Name">
          <select className="f-input" value={form.schoolId} onChange={(e) => onSchool(e.target.value)}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.school}</option>)}
          </select>
        </Field>
        <Field label="Campus Name"><input className="f-input" value={form.campus} readOnly /></Field>
        <Field label="Current Plan"><input className="f-input" value={form.currentPlan} readOnly /></Field>
        <Field label="Payment For Plan">
          <select className="f-input" value={form.paymentPlan} onChange={(e) => setForm({ ...form, paymentPlan: e.target.value })}>
            <option>Basic</option><option>Pro</option><option>Premium</option>
          </select>
        </Field>
        <Field label="Amount Received (PKR)"><input type="number" className="f-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></Field>
        <Field label="Payment Date"><input type="date" className="f-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Payment Method">
          <select className="f-input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option>Bank Transfer</option><option>Cash</option><option>JazzCash</option><option>EasyPaisa</option><option>Cheque</option>
          </select>
        </Field>
        <Field label="Transaction Reference"><input className="f-input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="TRX / Receipt / Bank Ref" /></Field>
        <Field label="Screenshot / Proof" span2>
          <input ref={fileRef} type="file" className="f-file" accept="image/*,.pdf" onChange={onFile} />
          {(form.proofName) && (
            <div className="proof-preview">
              <div className="proof-preview-hd">
                <span className="proof-preview-nm"><i className="fa-solid fa-image" /> {form.proofName}</span>
                <button className="proof-preview-x" onClick={clearProof} data-tip="Remove File"><i className="fa-solid fa-xmark" /></button>
              </div>
              <div style={{ padding: 10, textAlign: 'center' }}>
                {form.proofIsPdf
                  ? <div style={{ padding: 24, color: 'var(--tm)', fontSize: 13, fontWeight: 600 }}><i className="fa-solid fa-file-pdf" style={{ fontSize: 32, color: '#DC2626', display: 'block', marginBottom: 8 }} />PDF uploaded successfully.</div>
                  : <img src={form.proofUrl} alt="" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, objectFit: 'contain', margin: '0 auto' }} />}
              </div>
            </div>
          )}
        </Field>
        <Field label="Received By"><input className="f-input" value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} /></Field>
        <Field label="Notes" span2><textarea className="f-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this payment" /></Field>
      </div>
    </Modal>
  );
}

function PaymentHistoryModal({ payments, school, schoolId, onClose }) {
  const list = payments.filter((x) => x.schoolId === schoolId);
  return (
    <Modal large title="School Payment History" sub={`${school ? `${school.school} — ${school.campus}` : 'School'} · All Payments`}
      icon="fa-clock-rotate-left" onClose={onClose} bodyStyle={{ padding: 0 }}
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="tbl-wrap">
        <table className="mentor-table" style={{ minWidth: 700 }}>
          <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th><th>Received By</th><th>Notes</th></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td>{x.date}</td>
                <td><PlanBadge plan={x.paymentPlan} /></td>
                <td className="td-bold">{fmt(x.amount)} PKR</td>
                <td>{x.method}</td>
                <td className="td-ref">{x.reference}</td>
                <td><StatusBadge status={x.status} /></td>
                <td>{x.receivedBy}</td>
                <td className="td-ref">{x.notes || '—'}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--tm)' }}>No payment history found.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function ProofViewModal({ payments, clicked, from, to, onClose }) {
  const schoolPayments = payments.filter((x) =>
    x.schoolId === clicked.schoolId && x.status === 'Received' &&
    (!from || x.date.slice(0, 7) >= from) && (!to || x.date.slice(0, 7) <= to));
  const byMonth = {};
  schoolPayments.forEach((x) => { const mk = x.date.slice(0, 7); (byMonth[mk] = byMonth[mk] || []).push(x); });
  const months = Object.keys(byMonth).sort();

  const meta = `${clicked.school} · ${clicked.campus}` +
    (months.length > 1 ? ` · ${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}`
      : months.length === 1 ? ` · ${monthLabel(months[0])}` : '');

  return (
    <Modal large title="Payment Proof Screenshots" sub={meta} icon="fa-images" onClose={onClose}
      bodyStyle={{ padding: 16 }}
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      {months.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <i className="fa-solid fa-image" style={{ fontSize: 48, color: 'var(--bl)' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t2)' }}>No Received Payments Found</div>
          <div style={{ fontSize: 12.5, color: 'var(--tm)' }}>No received payments in the selected month range.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: months.length === 1 ? '1fr' : 'repeat(2,1fr)', gap: 16 }}>
          {months.map((mk) => {
            const monthList = byMonth[mk];
            const totalAmt = monthList.reduce((a, b) => a + Number(b.amount || 0), 0);
            const proofP = monthList.find((x) => x.proofUrl);
            return (
              <div className="proof-month" key={mk}>
                <div className="proof-month-hd">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-calendar-check" style={{ color: '#fff', fontSize: 13 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{monthLabel(mk)}</div>
                      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.75)' }}>{monthList.length} payment{monthList.length > 1 ? 's' : ''} · PKR {fmt(totalAmt)}</div>
                    </div>
                  </div>
                  {proofP && <a href={proofP.proofUrl} download={`proof-${mk}.svg`} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} data-tip="Download Proof"><i className="fa-solid fa-download" style={{ color: '#fff', fontSize: 11 }} /></a>}
                </div>
                <div className="proof-month-img">
                  {proofP
                    ? <img src={proofP.proofUrl} alt={`Proof ${monthLabel(mk)}`} />
                    : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20 }}>
                        <i className="fa-solid fa-image" style={{ fontSize: 36, color: 'var(--bl)' }} />
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t2)' }}>No Screenshot</div>
                        <div style={{ fontSize: 11, color: 'var(--tm)' }}>Payment recorded without proof</div>
                      </div>}
                </div>
                <div className="proof-month-rows">
                  {monthList.map((x) => (
                    <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--bl)', fontSize: 12 }}>
                      <span style={{ color: 'var(--tm)', fontWeight: 600 }}>{x.date} · {x.method}</span>
                      <span style={{ fontWeight: 800, color: 'var(--t1)' }}>PKR {fmt(x.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 7, fontSize: 12.5, fontWeight: 800, color: 'var(--brand)' }}>
                    <span>Total</span><span>PKR {fmt(totalAmt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════ SHARED PRIMITIVES ═══════════════════════ */
function StatCard({ icon, val, lbl, tone, small }) {
  return (
    <div className={`stat-card${tone ? ` ${tone}` : ''}`}>
      <div className="stat-icon"><i className={`fa-solid ${icon}`} /></div>
      <div className="stat-val" style={small ? { fontSize: 16 } : undefined}>{val}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  );
}

function Field({ label, span2, children }) {
  return (
    <div className={`f-field${span2 ? ' span2' : ''}`}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, sub, icon, iconColor, large, onClose, footer, children, bodyStyle }) {
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${large ? ' lg' : ''}`}>
        <div className="modal-head">
          <div>
            <div className="modal-title"><i className={`fa-solid ${icon}`} style={iconColor ? { color: iconColor } : undefined} /> {title}</div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button className="modal-close" onClick={onClose} data-tip="Close" data-tip-pos="left"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="modal-body" style={bodyStyle}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
