import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Tooltip from './Tooltip';
import { buildChainApiUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   NETWORKS — join / manage the school's network memberships.
   Ported (redesigned to the ERP design system) from the old
   theschoolmentor.online "Network Request" screen:
     • Join a Network  → pick a network, send a join invite, track the
                          request status (Pending / Accepted / Rejected).
     • My Networks     → the networks this school already belongs to.

   Dropdown ki list ab Chain-Management API se aati hai (pehle hard-coded
   naamon ki list thi). Join-request bhejne ka apna endpoint abhi nahi hai,
   is liye requests filhal sirf is screen par rehti hain.
   ═══════════════════════════════════════════════════════════════════ */

const STATUS_TONE = {
  Accepted: { bg: 'rgba(22,163,74,.10)',  fg: '#15803D', bd: 'rgba(22,163,74,.28)',  ic: 'fa-circle-check' },
  Pending:  { bg: 'rgba(217,119,6,.10)',  fg: '#B45309', bd: 'rgba(217,119,6,.28)',  ic: 'fa-clock' },
  Rejected: { bg: 'rgba(220,38,38,.10)',  fg: '#B91C1C', bd: 'rgba(220,38,38,.28)',  ic: 'fa-circle-xmark' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* API se aane wali date-time ko "24 Nov 2025" bana do. */
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/* API ke error messages "Error in ManageNetworkSchoolAsync: …" ki shakl me aate
   hain — method ka naam user ke kaam ki cheez nahi, sirf asal jumla dikhao. */
const cleanApiMessage = (raw, fallback) => {
  const msg = String(raw || '').replace(/^\s*error in\s+\w+\s*:\s*/i, '').trim();
  if (!msg) return fallback;
  return msg.charAt(0).toUpperCase() + msg.slice(1);
};

/* network-schools/manage — add / update / delete / getbybranch / getbynetwork.
   (Swagger ka sample "insert" likhta hai, magar API sirf "add" leta hai.) */
const manageNetworkSchool = async (payload) => {
  const res  = await fetch(buildChainApiUrl('/api/Network_Setup/network-schools/manage'), {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || json?.title || 'Request failed');
  }
  return json;
};

/* API row → screen row.

   Abhi faisla na hui request par teenon khaane khali hote hain (isAccepted:
   null, isRejected: null, acceptedOrRejectedDateTime: null). Reject hone par
   backend `isRejected` lagata hai — magar kuch rows par sirf isAccepted=false
   aur faisle ka waqt milta hai, is liye dono soortein reject ginte hain.
   Sirf `isAccepted === false` par bharosa nahi karte: pending row me bhi wo
   khali (false jaisa) aa sakta hai, aur tab tak koi faisla hua hi nahi. */
const toRequest = (r) => {
  const decidedAt = r.acceptedOrRejectedDateTime;
  const rejected  = !!r.isRejected || (r.isAccepted === false && !!decidedAt);
  return {
    id:        r.id,
    networkId: r.networkID,
    status:    r.isAccepted ? 'Accepted' : (rejected ? 'Rejected' : 'Pending'),
    date:      fmtDate(decidedAt || r.requestedDateTime),
  };
};

const TABS = [
  { id: 'mine', label: 'My Networks',    icon: 'fa-diagram-project' },
  { id: 'join', label: 'Join a Network', icon: 'fa-circle-nodes' },
];

/* `embedded` — jab ye screen Settings ke "Networks" tab ke andar khulti hai.
   Wahan Settings ka apna page header pehle se mojood hai, is liye apna
   header nahi dikhate; alag module ke taur par khule to poora header aata
   hai (filhal wo raasta band hai — dekhein App.js ka RETIRED_NAV). */
export default function Networks({ toast = () => {}, embedded = false }) {
  const [tab, setTab] = useState('mine');
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState('');          // selected network id (string)

  /* Saare networks — Chain-Management API se. */
  const [networks, setNetworks] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState('');

  const loadNetworks = useCallback(async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const res  = await fetch(buildChainApiUrl('/api/Network_Setup/get_all_networks'), {
        headers: { Accept: '*/*' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || 'Could not load networks');
      /* API row: { id, schoolNetwork, ownerName, contactNumber, isActive, … }.
         Naam schoolNetwork me hai; be-naam ya inactive rows dropdown me nahi
         dikhani chahiyen. */
      const list = (Array.isArray(json?.data) ? json.data : [])
        .filter((n) => n && n.isActive !== false && String(n.schoolNetwork || '').trim())
        .map((n) => ({
          id:      n.id,
          name:    String(n.schoolNetwork).trim(),
          owner:   String(n.ownerName || '').trim(),
          contact: String(n.contactNumber || '').trim(),
        }));
      setNetworks(list);
    } catch (err) {
      console.error('Networks load failed:', err);
      setNetworks([]);
      setLoadErr(cleanApiMessage(err?.message, 'Could not load networks'));
    } finally {
      setLoading(false);
    }
  }, []);

  /* Is branch ki join-requests. */
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  const [sending,  setSending]  = useState(false);
  const [busyId,   setBusyId]   = useState(null);   // jis request par delete chal rahi hai

  /* API ka `getbybranch` sirf ACCEPTED rows lautata hai — abhi bheji hui pending
     request us list me nahi aati (pending sirf network ki taraf `getbynetwork`
     se dikhti hai). Is liye pending rows ki asli id yahan cache hoti hai, warna
     user ko apni bheji hui request hi nazar na aaye aur delete bhi na kar sake.
     Jaise hi network accept kar de, wo server list me aa jaati hai aur yahan se
     hat jaati hai. */
  const pendingKey = `sm_net_pending_${branchId}`;
  const readPending = useCallback(() => {
    try { const v = JSON.parse(localStorage.getItem(pendingKey) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  }, [pendingKey]);
  const writePending = useCallback((list) => {
    try { localStorage.setItem(pendingKey, JSON.stringify(list)); } catch { /* storage full / blocked */ }
  }, [pendingKey]);

  /* Aik cache ki hui request ka asli haal network ki apni list se.
       getbynetwork + isAccepted:false = us network ki wo rows jo abhi
       accepted nahi (yani pending AUR rejected dono).
     Wapsi:
       row  → wahi taza status (Pending ya Rejected)
       null → row ab wahan hai hi nahi, network ne hata di */
  const statusFromNetwork = useCallback(async (req) => {
    const json = await manageNetworkSchool({
      action:     'getbynetwork',
      networkID:  req.networkId,
      isAccepted: false,
    });
    const row = (Array.isArray(json?.data) ? json.data : [])
      .find((r) => String(r.branchID) === String(branchId));
    return row ? toRequest(row) : null;
  }, [branchId]);

  const loadRequests = useCallback(async () => {
    if (!branchId) { setRequests([]); return; }
    try {
      const json   = await manageNetworkSchool({ action: 'getbybranch', branchID: branchId });
      const server = (Array.isArray(json?.data) ? json.data : []).map(toRequest);
      /* Jo pending server par accept ho chuki, wo ab server list me hai — cache se nikal do. */
      let pending = readPending().filter(
        (p) => !server.some((s) => String(s.networkId) === String(p.networkId)),
      );

      /* Baqi cached rows ka faisla abhi ho sakta hai — reject bhi.
         `getbybranch` sirf ACCEPTED rows deta hai, is liye rejected row kabhi
         wapas nahi aati thi aur screen par hamesha "Pending" hi likha rehta
         tha. Ab har cached request ka haal us network ki apni list se pooch
         lete hain. (Aik waqt me sirf aik khuli request hoti hai, is liye ye
         aam tor par aik hi extra call hai.) */
      if (pending.length) {
        const checked = await Promise.all(pending.map(
          (p) => statusFromNetwork(p).catch(() => p),   // call nakaam → jo maloom tha wahi
        ));
        pending = checked.filter(Boolean);
        writePending(pending);
      }

      setRequests([...pending, ...server]);
    } catch (err) {
      console.error('Network requests load failed:', err);
      setRequests(readPending());
    }
  }, [branchId, readPending, writePending, statusFromNetwork]);

  useEffect(() => { loadNetworks(); loadRequests(); }, [loadNetworks, loadRequests]);

  /* Request rows me sirf networkID aata hai — naam networks list se milta hai. */
  const nameOf = useCallback(
    (networkId) => networks.find((n) => String(n.id) === String(networkId))?.name || `Network #${networkId}`,
    [networks],
  );

  const requestedIds = useMemo(() => new Set(requests.map((r) => String(r.networkId))), [requests]);
  const options = useMemo(
    () => networks.filter((n) => !requestedIds.has(String(n.id))),
    [networks, requestedIds],
  );
  const mine = useMemo(() => requests.filter((r) => r.status === 'Accepted'), [requests]);

  /* ── Aik waqt me sirf AIK khuli request ──
     School aik saath kai networks ko request nahi bhej sakta: jab tak aik
     request ka faisla na ho jaye (Pending), doosri nahi jaati; aur jis
     network me shamil ho chuka ho (Accepted), us haalat me nayi request ka
     matlab hi nahi banta — pehle wo taluq khatam karna parega.

     Ye rok yahan (screen par) lagti hai — API khud rokti nahi, is liye
     button band karne ke saath sendInvite me bhi check hai. */
  const openReq = useMemo(
    () => requests.find((r) => r.status === 'Pending') || requests.find((r) => r.status === 'Accepted') || null,
    [requests],
  );
  const blockedMsg = openReq && (openReq.status === 'Pending'
    ? `You already have a pending request with ${nameOf(openReq.networkId)}. Wait for its decision, or remove it to request another network.`
    : `This school is already part of ${nameOf(openReq.networkId)}. Leave that network first to join another one.`);

  const sendInvite = async () => {
    if (!selected) { toast('Please select a network first', 'warning'); return; }
    if (requestedIds.has(String(selected))) { toast('You already have a request for this network', 'info'); return; }
    /* Aik hi khuli request ki hadd — button band hone ke bawajood dobara
       check, kyunke list background me badal sakti hai. */
    if (openReq) { toast(blockedMsg, 'warning'); return; }
    if (!branchId) { toast('No branch is selected — please sign in again', 'error'); return; }
    const net = networks.find((n) => String(n.id) === String(selected));
    if (!net) { toast('Please select a network first', 'warning'); return; }

    setSending(true);
    try {
      const json = await manageNetworkSchool({
        action:            'add',
        id:                0,
        networkID:         net.id,
        branchID:          branchId,
        networkPermission: true,
        isActive:          true,
        isAccepted:        false,   // network ka admin accept karega
      });
      /* Server jo row banata hai wohi (asli id ke sath) cache karo — delete isi id se hota hai. */
      const created = json?.data;
      if (created?.id) writePending([toRequest(created), ...readPending()]);
      setSelected('');
      await loadRequests();
      toast('Invite sent — awaiting the network’s approval', 'success');
    } catch (err) {
      console.error('Send invite failed:', err);
      toast(cleanApiMessage(err?.message, 'Could not send the invite'), 'error');
    } finally {
      setSending(false);
    }
  };

  /* Network apni taraf se request accept/reject karta hai (action:"update",
     isAccepted:true). Wo yahan tabhi dikhta hai jab list dobara maangi jaye —
     is liye manual refresh. */
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = async () => {
    setRefreshing(true);
    try { await Promise.all([loadNetworks(), loadRequests()]); }
    finally { setRefreshing(false); }
  };

  /* Server par se record hat jaata hai — accepted membership bhi khatam ho
     jaati hai, is liye pehle tasdeeq (browser ka confirm() nahi, ERP ka apna modal). */
  const [confirmRow, setConfirmRow] = useState(null);

  const removeRequest = async (row) => {
    setConfirmRow(null);
    setBusyId(row.id);
    try {
      await manageNetworkSchool({ action: 'delete', id: row.id });
      writePending(readPending().filter((p) => String(p.id) !== String(row.id)));
      await loadRequests();
      toast('Request removed', 'success');
    } catch (err) {
      console.error('Delete request failed:', err);
      toast(cleanApiMessage(err?.message, 'Could not remove the request'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <style>{NET_CSS}</style>

      {/* ── Page header — Settings ke andar nahi, wahan Settings ka apna hai ── */}
      {!embedded && (
        <div className="net-head">
          <div className="net-head-l">
            <div className="net-head-ic"><i className="fa-solid fa-circle-nodes" /></div>
            <div>
              <div className="net-head-t">Networks</div>
              <div className="net-head-s">Join school networks and manage your memberships &amp; requests</div>
            </div>
          </div>
        </div>
      )}

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
            <div className="net-sec-actions">
              <span className="net-count">{mine.length} joined</span>
              <Tooltip text="Check for newly accepted networks">
                <button className="net-refresh" onClick={refreshAll} disabled={refreshing}>
                  <i className={`fa-solid fa-rotate-right${refreshing ? ' fa-spin' : ''}`} /> Refresh
                </button>
              </Tooltip>
            </div>
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
                  <div className="net-card-ic">{nameOf(n.networkId).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                  <div className="net-card-body">
                    <div className="net-card-name">{nameOf(n.networkId)}</div>
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
              <span>Select a network and send a join request. The network’s admin will accept or reject it. Only one request can be open at a time.</span>
            </div>
            {blockedMsg && (
              <div className="net-error">
                <i className="fa-solid fa-circle-exclamation" />
                <span>{blockedMsg}</span>
              </div>
            )}
            {loadErr && (
              <div className="net-error">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>{loadErr}</span>
                <button className="net-retry" onClick={loadNetworks}>
                  <i className="fa-solid fa-rotate-right" /> Retry
                </button>
              </div>
            )}
            <div className="net-join-row">
              <div className="net-field">
                <span className="net-label">
                  Select Network
                  {!loading && !loadErr && <span className="net-label-hint"> · {networks.length} available</span>}
                </span>
                <div className="net-select-wrap">
                  <select
                    className="net-select"
                    value={selected}
                    disabled={loading || !!loadErr || networks.length === 0 || !!openReq}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">
                      {loading ? 'Loading networks…'
                        : loadErr ? 'Networks unavailable'
                        : networks.length === 0 ? 'No networks found'
                        : openReq ? (openReq.status === 'Pending' ? 'A request is already pending' : 'Already in a network')
                        : options.length === 0 ? 'All networks already requested'
                        : '— Select Network —'}
                    </option>
                    {options.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}{n.owner ? ` — ${n.owner}` : ''}
                      </option>
                    ))}
                  </select>
                  <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-chevron-down'}`} />
                </div>
              </div>
              <Tooltip text={blockedMsg || 'Send a join request to the selected network'}>
                <button className="net-btn net-btn-primary" onClick={sendInvite} disabled={loading || sending || !selected || !!openReq}>
                  <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
                  {sending ? 'Sending…' : 'Send Invite'}
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="net-section">
            <div className="net-sec-head">
              <div className="net-sec-title"><i className="fa-solid fa-list-check" /> Network Requests</div>
              <div className="net-sec-actions">
                <span className="net-count">{requests.length} total</span>
                <Tooltip text="Check for accepted / updated requests">
                  <button className="net-refresh" onClick={refreshAll} disabled={refreshing}>
                    <i className={`fa-solid fa-rotate-right${refreshing ? ' fa-spin' : ''}`} /> Refresh
                  </button>
                </Tooltip>
              </div>
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
                        <td><b>{nameOf(r.networkId)}</b></td>
                        <td className="net-center">
                          <span className="net-badge" style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}>
                            <i className={`fa-solid ${tone.ic}`} /> {r.status}
                          </span>
                        </td>
                        <td className="net-center">{r.date}</td>
                        <td className="net-center">
                          <Tooltip text={r.status === 'Accepted' ? 'Leave this network' : 'Remove this request'}>
                            <button
                              className="net-iconbtn danger"
                              onClick={() => setConfirmRow(r)}
                              disabled={busyId === r.id}
                              aria-label="Remove request"
                            >
                              <i className={`fa-solid ${busyId === r.id ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} />
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

      {/* ── Confirm dialog — leave network / remove request ── */}
      {confirmRow && (
        <div className="net-modal-back" onClick={() => setConfirmRow(null)}>
          <div className="net-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="net-modal-ic"><i className="fa-solid fa-triangle-exclamation" /></div>
            <div className="net-modal-t">
              {confirmRow.status === 'Accepted' ? 'Leave this network?' : 'Remove this request?'}
            </div>
            <div className="net-modal-s">
              {confirmRow.status === 'Accepted'
                ? <>Your school will be removed from <b>{nameOf(confirmRow.networkId)}</b>. To rejoin, you’ll have to send a new request and wait for approval.</>
                : <>The pending join request for <b>{nameOf(confirmRow.networkId)}</b> will be withdrawn. You can send it again later.</>}
            </div>
            <div className="net-modal-btns">
              <button className="net-btn net-btn-ghost" onClick={() => setConfirmRow(null)}>Cancel</button>
              <button className="net-btn net-btn-danger" onClick={() => removeRequest(confirmRow)}>
                <i className="fa-solid fa-trash-can" />
                {confirmRow.status === 'Accepted' ? 'Leave Network' : 'Remove Request'}
              </button>
            </div>
          </div>
        </div>
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
.net-sec-actions { display:flex; align-items:center; gap:8px; }
.net-refresh { display:inline-flex; align-items:center; gap:6px; border:1.5px solid var(--border-light,#BFDBFE); background:var(--bg-card,#fff); color:var(--text-secondary,#1E3A5F); font-family:inherit; font-size:12px; font-weight:700; padding:5px 12px; border-radius:8px; cursor:pointer; transition:all .2s; }
.net-refresh:hover:not(:disabled) { background:var(--bg-muted,#EFF6FF); border-color:#2563EB; color:#1E40AF; }
.net-refresh:disabled { opacity:.6; cursor:not-allowed; }
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

.net-label-hint { font-weight:600; color:var(--text-muted,#64748B); }
.net-select:disabled { background:var(--bg-muted,#F1F5F9); color:var(--text-muted,#64748B); cursor:not-allowed; }

.net-error { display:flex; align-items:center; gap:10px; background:rgba(220,38,38,.07); border:1.5px solid rgba(220,38,38,.25); border-radius:10px; padding:11px 14px; font-size:12.5px; color:#B91C1C; font-weight:600; margin-bottom:14px; }
.net-error i { color:#DC2626; }
.net-retry { margin-left:auto; display:inline-flex; align-items:center; gap:6px; border:1.5px solid rgba(220,38,38,.35); background:#fff; color:#B91C1C; font-family:inherit; font-size:12px; font-weight:700; padding:5px 12px; border-radius:8px; cursor:pointer; }
.net-retry:hover { background:rgba(220,38,38,.06); }

.net-btn:disabled { opacity:.55; cursor:not-allowed; transform:none; box-shadow:none; }
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

.net-modal-back { position:fixed; inset:0; z-index:1200; background:rgba(15,23,42,.55); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; padding:20px; animation:netFade .15s ease; }
.net-modal { width:100%; max-width:420px; background:var(--bg-card,#fff); border-radius:16px; padding:24px 22px 18px; text-align:center; box-shadow:0 24px 60px rgba(15,23,42,.35); animation:netPop .18s cubic-bezier(.4,0,.2,1); }
.net-modal-ic { width:52px; height:52px; margin:0 auto 14px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:22px; color:#DC2626; background:rgba(220,38,38,.10); border:1.5px solid rgba(220,38,38,.22); }
.net-modal-t { font-size:17px; font-weight:800; color:var(--text-primary,#0F172A); margin-bottom:7px; }
.net-modal-s { font-size:13px; line-height:1.55; color:var(--text-muted,#64748B); margin-bottom:20px; }
.net-modal-s b { color:var(--text-primary,#0F172A); font-weight:700; }
.net-modal-btns { display:flex; gap:10px; }
.net-modal-btns .net-btn { flex:1; }
.net-btn-ghost { background:var(--bg-card,#fff); color:var(--text-secondary,#1E3A5F); border:1.5px solid var(--border-light,#BFDBFE); }
.net-btn-ghost:hover { background:var(--bg-muted,#EFF6FF); }
.net-btn-danger { background:linear-gradient(135deg,#DC2626,#B91C1C); color:#fff; box-shadow:0 4px 14px rgba(220,38,38,.30); }
.net-btn-danger:hover { transform:translateY(-1px); box-shadow:0 8px 22px rgba(220,38,38,.38); }
@keyframes netFade { from { opacity:0 } to { opacity:1 } }
@keyframes netPop { from { opacity:0; transform:translateY(10px) scale(.97) } to { opacity:1; transform:none } }

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
