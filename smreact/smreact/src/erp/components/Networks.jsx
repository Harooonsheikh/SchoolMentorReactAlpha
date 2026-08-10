import React, { useMemo, useState } from 'react';
import Tooltip from './Tooltip';

/* ═══════════════════════════════════════════════════════════════════
   NETWORKS — join / manage the school's network memberships.
   Ported (redesigned to the ERP design system) from the old
   theschoolmentor.online "Network Request" screen:
     • Join a Network  → pick a network, send a join invite, track the
                          request status (Pending / Accepted / Rejected).
     • My Networks     → the networks this school already belongs to.
   Mock data for now — swap the two arrays / handlers for a real API later.
   ═══════════════════════════════════════════════════════════════════ */

/* Networks the school can request to join (the dropdown source). */
const AVAILABLE_NETWORKS = [
  'Punjab Group Of Colleges',
  'Beaconhouse School System',
  'The City School',
  'Allied Schools',
  'Dar-e-Arqam Schools',
  'Roots International Schools',
];

/* Seed requests — matches the old screen's example row. */
const INITIAL_REQUESTS = [
  { id: 1, name: 'Punjab Group Of Colleges', status: 'Accepted', date: '24 Nov 2025' },
];

const STATUS_TONE = {
  Accepted: { bg: 'rgba(22,163,74,.10)',  fg: '#15803D', bd: 'rgba(22,163,74,.28)',  ic: 'fa-circle-check' },
  Pending:  { bg: 'rgba(217,119,6,.10)',  fg: '#B45309', bd: 'rgba(217,119,6,.28)',  ic: 'fa-clock' },
  Rejected: { bg: 'rgba(220,38,38,.10)',  fg: '#B91C1C', bd: 'rgba(220,38,38,.28)',  ic: 'fa-circle-xmark' },
};

const todayLabel = () => {
  const d = new Date();
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
};

const TABS = [
  { id: 'mine', label: 'My Networks',    icon: 'fa-diagram-project' },
  { id: 'join', label: 'Join a Network', icon: 'fa-circle-nodes' },
];

export default function Networks({ toast = () => {} }) {
  const [tab, setTab] = useState('mine');
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [selected, setSelected] = useState('');

  const requestedNames = useMemo(() => new Set(requests.map((r) => r.name)), [requests]);
  const options = useMemo(
    () => AVAILABLE_NETWORKS.filter((n) => !requestedNames.has(n)),
    [requestedNames],
  );
  const mine = useMemo(() => requests.filter((r) => r.status === 'Accepted'), [requests]);

  const sendInvite = () => {
    if (!selected) { toast('Please select a network first', 'warning'); return; }
    if (requestedNames.has(selected)) { toast('You already have a request for this network', 'info'); return; }
    setRequests((prev) => [{ id: Date.now(), name: selected, status: 'Pending', date: todayLabel() }, ...prev]);
    setSelected('');
    toast('Invite sent — awaiting the network’s approval', 'success');
  };

  const removeRequest = (id) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast('Request removed', 'success');
  };

  return (
    <>
      <style>{NET_CSS}</style>

      {/* ── Page header ── */}
      <div className="net-head">
        <div className="net-head-l">
          <div className="net-head-ic"><i className="fa-solid fa-circle-nodes" /></div>
          <div>
            <div className="net-head-t">Networks</div>
            <div className="net-head-s">Join school networks and manage your memberships &amp; requests</div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="net-tabs-row" role="tablist">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            className={`net-tab${tab === tb.id ? ' active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            <i className={`fa-solid ${tb.icon}`} /> {tb.label}
          </button>
        ))}
      </div>

      {/* ── MY NETWORKS ── */}
      {tab === 'mine' && (
        <div className="net-section">
          <div className="net-sec-head">
            <div className="net-sec-title"><i className="fa-solid fa-diagram-project" /> My Networks</div>
            <span className="net-count">{mine.length} joined</span>
          </div>
          <div className="net-info">
            <i className="fa-solid fa-circle-info" />
            <span>Networks your school has joined. To join a new one, open <b>Join a Network</b>.</span>
          </div>
          {mine.length === 0 ? (
            <div className="net-empty">
              <i className="fa-solid fa-circle-nodes" />
              <div>You haven’t joined any network yet.</div>
              <button className="net-btn net-btn-primary" onClick={() => setTab('join')}>
                <i className="fa-solid fa-plus" /> Join a Network
              </button>
            </div>
          ) : (
            <div className="net-cards">
              {mine.map((n) => (
                <div key={n.id} className="net-card">
                  <div className="net-card-ic">{n.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                  <div className="net-card-body">
                    <div className="net-card-name">{n.name}</div>
                    <div className="net-card-sub">Member since {n.date}</div>
                  </div>
                  <span className="net-badge" style={{ background: STATUS_TONE.Accepted.bg, color: STATUS_TONE.Accepted.fg, borderColor: STATUS_TONE.Accepted.bd }}>
                    <i className={`fa-solid ${STATUS_TONE.Accepted.ic}`} /> Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── JOIN A NETWORK ── */}
      {tab === 'join' && (
        <>
          <div className="net-section">
            <div className="net-sec-head">
              <div className="net-sec-title"><i className="fa-solid fa-circle-nodes" /> Join a Network</div>
            </div>
            <div className="net-info">
              <i className="fa-solid fa-circle-info" />
              <span>Select a network and send a join request. The network’s admin will accept or reject it.</span>
            </div>
            <div className="net-join-row">
              <div className="net-field">
                <span className="net-label">Select Network</span>
                <div className="net-select-wrap">
                  <select className="net-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                    <option value="">— Select Network —</option>
                    {options.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down" />
                </div>
              </div>
              <Tooltip text="Send a join request to the selected network">
                <button className="net-btn net-btn-primary" onClick={sendInvite}>
                  <i className="fa-solid fa-paper-plane" /> Send Invite
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="net-section">
            <div className="net-sec-head">
              <div className="net-sec-title"><i className="fa-solid fa-list-check" /> Network Requests</div>
              <span className="net-count">{requests.length} total</span>
            </div>
            <div className="net-table-wrap">
              <table className="net-table">
                <thead>
                  <tr>
                    <th>Network Name</th>
                    <th className="net-center">Status</th>
                    <th className="net-center">Status Date</th>
                    <th className="net-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan="4" className="net-table-empty">No network requests yet.</td></tr>
                  ) : requests.map((r) => {
                    const tone = STATUS_TONE[r.status] || STATUS_TONE.Pending;
                    return (
                      <tr key={r.id}>
                        <td><b>{r.name}</b></td>
                        <td className="net-center">
                          <span className="net-badge" style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}>
                            <i className={`fa-solid ${tone.ic}`} /> {r.status}
                          </span>
                        </td>
                        <td className="net-center">{r.date}</td>
                        <td className="net-center">
                          <Tooltip text="Remove this request">
                            <button className="net-iconbtn danger" onClick={() => removeRequest(r.id)} aria-label="Remove request">
                              <i className="fa-solid fa-trash-can" />
                            </button>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ═══ Module CSS — matches the ERP design system (light + dark) ═══ */
const NET_CSS = `
.net-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
.net-head-l { display:flex; align-items:center; gap:14px; }
.net-head-ic { width:46px; height:46px; border-radius:13px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:20px; color:#fff; background:linear-gradient(135deg,#1E3A8A,#2563EB); box-shadow:0 6px 18px rgba(30,58,138,.30); }
.net-head-t { font-size:22px; font-weight:800; letter-spacing:-.02em; color:var(--text-primary,#0F172A); }
.net-head-s { font-size:13px; color:var(--text-muted,#64748B); margin-top:2px; }

.net-tabs-row { display:flex; gap:4px; background:var(--bg-card,#fff); border:1.5px solid var(--border-light,#BFDBFE); border-radius:14px; padding:5px; margin-bottom:20px; box-shadow:0 2px 6px rgba(30,58,138,.18),0 1px 2px rgba(0,0,0,.05); overflow-x:auto; }
.net-tab { display:flex; align-items:center; justify-content:center; gap:7px; padding:11px 18px; border-radius:10px; border:none; background:transparent; font-family:inherit; font-size:13px; font-weight:600; color:var(--text-muted,#64748B); cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; flex:1; }
.net-tab:hover:not(.active) { background:var(--bg-muted,#EFF6FF); color:var(--text-primary,#0F172A); }
.net-tab.active { background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%); color:#fff; box-shadow:0 6px 20px rgba(30,58,138,.4),inset 0 1px 0 rgba(255,255,255,.2); }
.net-tab i { font-size:12px; }

.net-section { background:var(--bg-card,#fff); border:1.5px solid var(--border-light,#BFDBFE); border-radius:14px; box-shadow:0 2px 6px rgba(30,58,138,.18),0 1px 2px rgba(0,0,0,.05); padding:18px 20px; margin-bottom:16px; }
.net-sec-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
.net-sec-title { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:800; color:var(--text-primary,#0F172A); }
.net-sec-title i { color:var(--brand-mid,#2563EB); }
.net-count { font-size:12px; font-weight:700; color:var(--brand-mid,#2563EB); background:rgba(37,99,235,.08); border:1px solid rgba(37,99,235,.2); padding:3px 10px; border-radius:999px; }

.net-info { display:flex; align-items:center; gap:10px; background:rgba(2,132,199,.07); border:1.5px solid rgba(2,132,199,.22); border-radius:10px; padding:11px 14px; font-size:12.5px; color:var(--text-secondary,#1E3A5F); font-weight:500; margin-bottom:16px; }
.net-info i { color:#0284C7; }

.net-join-row { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; }
.net-field { display:flex; flex-direction:column; gap:6px; flex:1; min-width:240px; }
.net-label { font-size:12px; font-weight:700; color:var(--text-secondary,#1E3A5F); }
.net-select-wrap { position:relative; }
.net-select { width:100%; height:42px; padding:0 38px 0 14px; border:1.5px solid var(--border-light,#BFDBFE); border-radius:10px; background:var(--bg-card,#fff); color:var(--text-primary,#0F172A); font-family:inherit; font-size:13.5px; font-weight:500; outline:none; appearance:none; cursor:pointer; transition:border-color .2s,box-shadow .2s; }
.net-select:focus { border-color:#2563EB; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
.net-select-wrap i { position:absolute; right:14px; top:50%; transform:translateY(-50%); color:var(--text-muted,#64748B); font-size:12px; pointer-events:none; }

.net-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; height:42px; padding:0 20px; border-radius:10px; border:none; font-family:inherit; font-size:13.5px; font-weight:700; cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; }
.net-btn-primary { background:linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB); color:#fff; box-shadow:0 4px 14px rgba(30,58,138,.30); }
.net-btn-primary:hover { transform:translateY(-1px); box-shadow:0 8px 22px rgba(30,58,138,.38); }
.net-btn-primary:active { transform:translateY(0); }

.net-table-wrap { overflow-x:auto; border:1px solid var(--border-light,#BFDBFE); border-radius:12px; }
.net-table { width:100%; border-collapse:collapse; font-size:13px; min-width:520px; }
.net-table thead th { background:linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB); color:#fff; font-weight:700; font-size:12px; text-align:left; padding:12px 16px; white-space:nowrap; }
.net-table thead th:first-child { border-top-left-radius:11px; }
.net-table thead th:last-child { border-top-right-radius:11px; }
.net-table tbody td { padding:12px 16px; border-top:1px solid var(--border-light,#BFDBFE); color:var(--text-primary,#0F172A); }
.net-table tbody tr:hover td { background:var(--bg-muted,#EFF6FF); }
.net-center { text-align:center; }
.net-table-empty { text-align:center; color:var(--text-muted,#64748B); font-style:italic; padding:26px; }

.net-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:999px; font-size:11.5px; font-weight:800; border:1px solid; }

.net-iconbtn { width:34px; height:34px; border-radius:9px; border:1.5px solid var(--border-light,#BFDBFE); background:var(--bg-card,#fff); color:var(--text-muted,#64748B); display:inline-flex; align-items:center; justify-content:center; font-size:13px; cursor:pointer; transition:all .2s; }
.net-iconbtn.danger:hover { border-color:#DC2626; color:#DC2626; background:rgba(220,38,38,.06); }

.net-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
.net-card { display:flex; align-items:center; gap:12px; padding:14px; border:1.5px solid var(--border-light,#BFDBFE); border-radius:12px; background:var(--bg-card,#fff); }
.net-card-ic { width:44px; height:44px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; color:#fff; background:linear-gradient(135deg,#1E3A8A,#2563EB); }
.net-card-body { flex:1; min-width:0; }
.net-card-name { font-size:14px; font-weight:700; color:var(--text-primary,#0F172A); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.net-card-sub { font-size:11.5px; color:var(--text-muted,#64748B); margin-top:2px; }

.net-empty { display:flex; flex-direction:column; align-items:center; gap:12px; padding:40px 20px; color:var(--text-muted,#64748B); text-align:center; }
.net-empty i { font-size:34px; color:var(--border-med,#93C5FD); }

@media (max-width:600px) {
  .net-tab { font-size:12px; padding:9px 12px; }
  .net-join-row { flex-direction:column; align-items:stretch; }
  .net-btn { width:100%; }
}
`;
