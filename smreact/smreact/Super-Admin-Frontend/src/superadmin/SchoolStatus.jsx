import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_LAUNCH, INITIAL_ERP, INITIAL_INACTIVE,
  buildSchoolDetail, moduleMeta,
} from './statusData';
import { schoolProgressApi, schoolPermissionsApi, authApi } from './api';

/* Assign dropdown ka pehla option — branch kisi ko assign na ho to yehi. */
const UNASSIGNED = '-- Unassigned --';

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
  const [launch, setLaunch] = useState([]);
  const [erp, setErp] = useState([]);
  const [inactive, setInactive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erpSub, setErpSub] = useState('progress');   // 'progress' | 'enquiries'

  /* Toast ka taza reference, taake loader parent ke har render par dobara na chale. */
  const toastRef = useRef(toast);
  toastRef.current = toast;

  /* Screen khulte hi (sidebar par "Schools Progress" click) branch-report API:
       Launch Setup → isActive=true&launchSetup=0
       ERP          → isActive=true&launchSetup=1
       Inactive     → isActive=false
     API na chale to bundled demo data — screen kabhi khali nahi rehti. */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { launch: l, erp: e, inactive: i } = await schoolProgressApi.listSchoolProgress();
      if (l.length || e.length || i.length) {
        setLaunch(l); setErp(e); setInactive(i);
      } else {
        setLaunch(INITIAL_LAUNCH); setErp(INITIAL_ERP); setInactive(INITIAL_INACTIVE);
        toastRef.current?.('No schools returned — showing sample data', 'warn');
      }
    } catch (err) {
      setLaunch(INITIAL_LAUNCH); setErp(INITIAL_ERP); setInactive(INITIAL_INACTIVE);
      toastRef.current?.(err?.message || 'Could not load schools — showing sample data', 'warn');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Users directory — GET /api/Auth/get-all-users.
     Screen ke saare "Assigned To" / "Select User" dropdown isi se bharte hain:
     dikhta naam (firstName + lastName) hai, aur rows par assignedId wahi `id`
     rehti hai jo API bhejti/leti hai. */
  const [users, setUsers] = useState([]);
  useEffect(() => {
    let alive = true;
    authApi.listUsers()
      .then((rows) => { if (alive) setUsers(rows); })
      .catch((err) => toastRef.current?.(err?.message || 'Could not load users', 'warn'));
    return () => { alive = false; };
  }, []);

  /* id → naam. List abhi na aayi ho to row ka apna label (e.g. "User #4"). */
  const userName = useCallback((id, fallback) => {
    const u = users.find((x) => x.id === Number(id));
    return u ? u.name : (fallback || UNASSIGNED);
  }, [users]);

  /* Rows par `assigned` ab asli naam — table, ERP card, enquiry modal, sab ek
     hi jagah se. (Enquiries loader neeche RAW `erp` par chalta hai, taake har
     naam-resolve par woh dobara na chale.) */
  const named = useCallback((rows) => rows.map((s) => ({ ...s, assigned: userName(s.assignedId, s.assigned) })), [userName]);
  const launchRows = useMemo(() => named(launch), [named, launch]);

  /* ── ERP card ke counters ──
     branch-report sirf totalLogins deti hai; Notes/Calls/Messages aur
     onboarding ka "completed" follow-up/onboarding-card-action se aate hain.
     Ye map wahan se bharta hai — bulk loader se (list khulte hi) aur detail
     modal se (har save/delete ke baad), taake card foran sahi ginti dikhaye. */
  const [cardCounts, setCardCounts] = useState({});   // { [branchId]: { notes, calls, messages, onboardingDone } }
  const setCountsFor = useCallback((branchId, counts) => {
    setCardCounts((prev) => ({ ...prev, [branchId]: counts }));
  }, []);

  const erpRows = useMemo(() => named(erp).map((s) => {
    const c = cardCounts[s.id];
    if (!c) return s;
    return {
      ...s,
      notes: c.notes,
      calls: c.calls,
      messages: c.messages,
      onboarding: { ...s.onboarding, completed: c.onboardingDone },
    };
  }), [named, erp, cardCounts]);

  /* Ek hi ERP list ke liye ek hi baar — 18 calls baar baar nahi jaatin. */
  const cardsLoadedFor = useRef(null);
  useEffect(() => {
    if (tab !== 'erp' || !erp.length) return;
    if (cardsLoadedFor.current === erp) return;
    cardsLoadedFor.current = erp;
    schoolProgressApi.listCardCounts(erp.map((s) => s.id))
      .then(setCardCounts)
      .catch(() => { /* counters optional — card baqi sab kuch dikhata rahe */ });
  }, [tab, erp]);

  /* Per-ERP-school detail (lazy-built) + enquiries, lifted so modal edits persist. */
  const [details, setDetails] = useState({});

  /* ── School Enquiries (bug tracker) ──
     POST .../school-enquiries-bugs-action, action `get`, ek branch ke liye
     (API branchID ke baghair get nahi karti) — is liye ERP tab ka enquiries
     sub-tab khulte hi har ERP school ke liye ek call, sab parallel.
     Har mutation ke baad us branch ki list dobara mangwa lete hain, taake
     screen wahi dikhaye jo server par hai. */
  const [enquiries, setEnquiries] = useState({});   // { [branchId]: rows[] }
  const [enqLoading, setEnqLoading] = useState(false);

  const refreshEnquiries = useCallback(async (branchId) => {
    try {
      const rows = await schoolProgressApi.listEnquiries(branchId);
      setEnquiries((prev) => ({ ...prev, [branchId]: rows }));
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not reload enquiries', 'warn');
    }
  }, []);

  const loadAllEnquiries = useCallback(async (rows) => {
    setEnqLoading(true);
    try {
      const lists = await Promise.all(rows.map((s) => schoolProgressApi.listEnquiries(s.id).catch(() => [])));
      const next = {};
      rows.forEach((s, i) => { next[s.id] = lists[i]; });
      setEnquiries(next);
    } finally {
      setEnqLoading(false);
    }
  }, []);

  /* Ek hi ERP list ke liye ek hi baar — sub-tab aage peeche karne par dobara
     18 calls nahi jaatin (mutations khud apni branch refresh kar leti hain). */
  const enqLoadedFor = useRef(null);
  useEffect(() => {
    if (tab !== 'erp' || erpSub !== 'enquiries' || !erp.length) return;
    if (enqLoadedFor.current === erp) return;
    enqLoadedFor.current = erp;
    loadAllEnquiries(erp);
  }, [tab, erpSub, erp, loadAllEnquiries]);

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

  /* ── assign ──
     Dropdown me user ki `id` chalti hai (wahi jo get-all-users deti hai aur
     branch-report `assignedTo` me lautati hai); screen par uska naam.

     Har badlav server par jata hai:
       POST .../manage_assignedUser  action UPSERT  (pehli baar insert, phir
       update — dono wahi ek action), aur "-- Unassigned --" par DELETE.
     Screen foran badalti hai, magar call fail ho to purani value wapas — warna
     dropdown kuch aur dikhata aur database me kuch aur hota. */
  const [assignMap, setAssignMap] = useState({});   // branchId → { id, userId }
  const [assignBusy, setAssignBusy] = useState(0);  // branchId jiska save chal raha hai

  useEffect(() => {
    let alive = true;
    schoolProgressApi.listAssignedUsers()
      .then((rows) => {
        if (!alive) return;
        const m = {};
        rows.forEach((r) => { m[r.branchId] = { id: r.id, userId: r.userId }; });
        setAssignMap(m);
      })
      .catch(() => { /* branch-report ka assignedTo phir bhi sahi user dikhata hai */ });
    return () => { alive = false; };
  }, []);

  const assign = async (group, branchId, userId) => {
    const uid = Number(userId) || 0;
    const launchSetup = group === 'launch' ? 0 : 1;
    const setter = group === 'launch' ? setLaunch : setErp;
    const before = (group === 'launch' ? launch : erp).find((s) => s.id === branchId);
    const row = assignMap[branchId];
    const label = uid ? userName(uid) : UNASSIGNED;

    setter((prev) => prev.map((s) => s.id === branchId ? { ...s, assignedId: uid, assigned: label } : s));
    setAssignBusy(branchId);
    try {
      if (uid) {
        const { id } = await schoolProgressApi.saveAssignedUser({ id: row?.id || 0, branchId, userId: uid, launchSetup });
        setAssignMap((m) => ({ ...m, [branchId]: { id: id || row?.id || 0, userId: uid } }));
        toast?.(`Assigned to: ${label}`, 'success');
      } else if (row?.id) {
        await schoolProgressApi.clearAssignedUser({ id: row.id, branchId, launchSetup });
        setAssignMap((m) => { const next = { ...m }; delete next[branchId]; return next; });
        toast?.('Assignment cleared', 'info');
      }
    } catch (err) {
      setter((prev) => prev.map((s) => s.id === branchId
        ? { ...s, assignedId: before?.assignedId || 0, assigned: before?.assigned || UNASSIGNED }
        : s));
      toast?.(err?.message || 'Could not save the assignment', 'error');
    } finally {
      setAssignBusy(0);
    }
  };

  /* ── activate / deactivate ──
     Dono ka faisla server par hota hai:
       PUT /api/SchoolPermissions/ToggleBranchStatus/{branchID}?isActive=true|false
     API kaamyab ho tab hi row ek group se doosre me jati hai — warna screen
     kuch aur dikhati aur backend me kuch aur hota. */
  const [busy, setBusy] = useState(false);

  const confirmDeactivate = async (group, id) => {
    const list = group === 'launch' ? launch : erp;
    const s = list.find((x) => x.id === id);
    setBusy(true);
    try {
      await schoolPermissionsApi.setBranchStatus(id, false);
      if (s) {
        (group === 'launch' ? setLaunch : setErp)((prev) => prev.filter((x) => x.id !== id));
        setInactive((prev) => [...prev, { ...s, staffSignup: s.staffSignup ?? 0, stuSignup: s.stuSignup ?? 0 }]);
      }
      setModal(null);
      toast?.(`${s?.name || 'School'} moved to Inactive`, 'info');
    } catch (err) {
      toast?.(err?.message || 'Could not deactivate this school', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmActivate = async (id) => {
    const s = inactive.find((x) => x.id === id);
    setBusy(true);
    try {
      await schoolPermissionsApi.setBranchStatus(id, true);
      if (s) { setInactive((prev) => prev.filter((x) => x.id !== id)); setLaunch((prev) => [...prev, s]); }
      setModal(null);
      toast?.(`${s?.name || 'School'} reactivated successfully!`, 'success');
    } catch (err) {
      toast?.(err?.message || 'Could not reactivate this school', 'error');
    } finally {
      setBusy(false);
    }
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
          <button className="btn-sm" style={{ marginLeft: 'auto', height: 34 }} onClick={load} disabled={loading} data-tip="Reload from API">
            <i className={`fa-solid fa-rotate${loading ? ' fa-spin' : ''}`} /> Refresh
          </button>
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
        <LaunchPanel rows={launchRows} users={users} assignBusy={assignBusy} loading={loading} onAssign={(id, v) => assign('launch', id, v)}
          onDeactivate={(s) => setModal({ type: 'deactivate', group: 'launch', school: s })}
          onDetails={(s) => setModal({ type: 'details', school: s })} />
      )}
      {tab === 'erp' && (
        <ErpPanel rows={erpRows} users={users} assignBusy={assignBusy} loading={loading} sub={erpSub} setSub={setErpSub}
          onAssign={(id, v) => assign('erp', id, v)}
          onDeactivate={(s) => setModal({ type: 'deactivate', group: 'erp', school: s })}
          onDetails={(s) => { ensureDetail(s); setModal({ type: 'erpDetail', school: s }); }}
          enquiries={enquiries} enqLoading={enqLoading}
          onEnqAdd={(s) => setModal({ type: 'enqEdit', school: s, bug: null })}
          onEnqDetail={(s) => setModal({ type: 'enqDetail', school: s })} />
      )}
      {tab === 'inactive' && (
        <InactivePanel rows={inactive} loading={loading}
          onActivate={(s) => setModal({ type: 'activate', school: s })}
          onDetails={(s) => setModal({ type: 'details', school: s })} />
      )}

      {/* ── MODALS ── */}
      {modal?.type === 'details' && <BranchDetailsModal school={modal.school} onClose={() => setModal(null)} />}
      {modal?.type === 'deactivate' && (
        <ConfirmModal tone="warn" icon="fa-triangle-exclamation" title="Are you sure?"
          sub="Do you really want to deactivate this school? It will be moved to Inactive Schools and lose ERP access."
          confirmText="OK, Deactivate" confirmClass="btn-danger" confirmIcon="fa-moon"
          busy={busy}
          onConfirm={() => confirmDeactivate(modal.group, modal.school.id)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'activate' && (
        <ConfirmModal tone="green" icon="fa-circle-check" title="Reactivate School?"
          sub="This school will be moved back to active Launch Setup Schools and regain system access."
          confirmText="Make Active" confirmClass="btn-success" confirmIcon="fa-circle-check"
          busy={busy}
          onConfirm={() => confirmActivate(modal.school.id)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'erpDetail' && (
        <ErpDetailModal school={modal.school} detail={ensureDetail(modal.school)} patchDetail={patchDetail}
          onCounts={setCountsFor} toast={toast} onClose={() => setModal(null)} />
      )}
      {/* onAdd: jo tab khula hai wahi naye bug ka status tay karta hai —
          Open tab → isSolved false, Resolved tab → isSolved true. */}
      {modal?.type === 'enqDetail' && (
        <EnquiryDetailModal school={modal.school} bugs={enquiries[modal.school.id] || []}
          onRefresh={refreshEnquiries} toast={toast}
          onAdd={(activeTab) => setModal({ type: 'enqEdit', school: modal.school, bug: null, back: true, solved: activeTab === 'resolved' })}
          onEdit={(bug) => setModal({ type: 'enqEdit', school: modal.school, bug, back: true })}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === 'enqEdit' && (
        <EnquiryEditModal school={modal.school} bug={modal.bug} defaultSolved={Boolean(modal.solved)}
          onRefresh={refreshEnquiries} toast={toast}
          onClose={() => setModal(modal.back ? { type: 'enqDetail', school: modal.school } : null)} />
      )}
    </div>
  );
}

/* ═══════════════════════ LAUNCH PANEL ═══════════════════════ */
function FilterBar({ children }) { return <div className="filter-bar">{children}</div>; }
/* Assign dropdown — value hamesha user ki `id` (0 = unassigned), text uska naam.
   `users` /api/Auth/get-all-users se aati hai. */
function AssignSelect({ value, users, fallbackLabel, busy, onChange }) {
  const uid = Number(value) || 0;
  /* Branch kisi aisi id par assigned ho jo list me na ho (user hata diya gaya,
     ya list abhi load na hui) to usay bhi ek option bana do — warna select
     chup-chaap "-- Unassigned --" dikhane lagta hai. */
  const missing = uid > 0 && !users.some((u) => u.id === uid);
  return (
    <select className="assign-select" value={uid} disabled={busy} onChange={(e) => onChange(Number(e.target.value) || 0)}>
      <option value={0}>{UNASSIGNED}</option>
      {missing && <option value={uid}>{fallbackLabel || `User #${uid}`}</option>}
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}

/* Filter bar ka "Select User" — value id, "" = sab. */
function UserFilterSelect({ value, users, onChange }) {
  return (
    <select className="f-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select User or All</option>
      {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
    </select>
  );
}
function EmptyRow({ cols, icon, msg }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className={`fa-solid fa-${icon}`} style={{ fontSize: 28, display: 'block', margin: '0 auto 12px', opacity: 0.3 }} /><div style={{ fontSize: 14, fontWeight: 700 }}>{msg}</div></td></tr>;
}
/* Loading TABLE ke andar dikhta hai — bilkul wahi shakl jo School Permissions
   par hai. Pehle poori screen ki jagah ek card aa jata tha aur table ghayab
   ho jati thi; ab headers apni jagah rehte hain aur sirf body badalti hai. */
function LoadingRow({ cols, msg = 'Loading schools…' }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, display: 'block', margin: '0 auto 12px', opacity: 0.5 }} /><div style={{ fontSize: 14, fontWeight: 700 }}>{msg}</div></td></tr>;
}

function LaunchPanel({ rows, users, assignBusy, loading, onAssign, onDeactivate, onDetails }) {
  const [q, setQ] = useState('');
  const [color, setColor] = useState('');
  const [user, setUser] = useState('');   // user id (string), '' = sab
  const list = rows.filter((s) => (!q || s.name.toLowerCase().includes(q.toLowerCase())) && (!color || s.color === color) && (!user || String(s.assignedId) === user));
  return (
    <div className="ss-panel">
      <div className="section-card">
        <FilterBar>
          <div className="f-field"><label className="f-label"><i className="fa-solid fa-palette" style={{ color: 'var(--brand)', fontSize: 10 }} /> Select Branches Color</label>
            <select className="f-input" value={color} onChange={(e) => setColor(e.target.value)}><option value="">All Colors</option><option>Red</option><option>Green</option><option>Blue</option></select></div>
          <div className="f-field"><label className="f-label"><i className="fa-solid fa-user" style={{ color: 'var(--brand)', fontSize: 10 }} /> Select User</label>
            <UserFilterSelect value={user} users={users} onChange={setUser} /></div>
          <div className="f-field-grow"><label className="f-label"><i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--brand)', fontSize: 10 }} /> Search</label>
            <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools…" /></div></div>
        </FilterBar>
        <div className="tbl-wrap">
          <table className="mentor-table">
            <thead><tr><th style={{ width: 48 }}>#</th><th>Branch Name</th><th style={{ width: 90, textAlign: 'center' }}>Total Staff</th><th style={{ width: 100, textAlign: 'center' }}>Total Students</th><th style={{ width: 130 }}>Data Status</th><th style={{ width: 190 }}>Assigned To</th><th style={{ width: 145 }}>Action</th><th style={{ width: 75, textAlign: 'center' }}>Details</th></tr></thead>
            <tbody>
              {loading ? <LoadingRow cols={8} />
                : list.length === 0 ? <EmptyRow cols={8} icon="school" msg="No schools found" /> : list.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: 'var(--tm)', textAlign: 'center' }}>{i + 1}</td>
                  <td className="td-bold">{s.name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.staff}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--t1)' }}>{s.students}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td><AssignSelect value={s.assignedId} users={users} fallbackLabel={s.assigned} busy={assignBusy === s.id} onChange={(v) => onAssign(s.id, v)} /></td>
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
function ErpPanel({ rows, users, assignBusy, loading, sub, setSub, onAssign, onDeactivate, onDetails, enquiries, enqLoading, onEnqAdd, onEnqDetail }) {
  const [q, setQ] = useState('');
  const [user, setUser] = useState('');   // user id (string), '' = sab
  const list = rows.filter((s) => (!q || s.name.toLowerCase().includes(q.toLowerCase())) && (!user || String(s.assignedId) === user));
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
            <UserFilterSelect value={user} users={users} onChange={setUser} /></div>
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
        loading ? (
          <div style={{ padding: 44, textAlign: 'center', color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, display: 'block', margin: '0 auto 12px', opacity: 0.5 }} /><div style={{ fontSize: 14, fontWeight: 700 }}>Loading schools…</div></div>
        ) : list.length === 0 ? (
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
                <AssignSelect value={s.assignedId} users={users} fallbackLabel={s.assigned} busy={assignBusy === s.id} onChange={(v) => onAssign(s.id, v)} />
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
          {enqLoading ? (
            <div className="enq-empty"><i className="fa-solid fa-spinner fa-spin" /><div className="enq-empty-t">Loading enquiries…</div><div className="enq-empty-s">Fetching open and resolved bugs for every ERP school.</div></div>
          ) : enqRows.length === 0 ? (
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
function InactivePanel({ rows, loading, onActivate, onDetails }) {
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
              {loading ? <LoadingRow cols={8} />
                : list.length === 0 ? <EmptyRow cols={8} icon="moon" msg="No inactive schools" /> : list.map((s, i) => (
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
            {/* Card ke andar Launch Setup ke tabs ki halat hai, is liye title
                bhi wahi — pehle "Date & State" likha tha jo kisi tareekh ya
                state ki taraf ishara karta tha, jo yahan hai hi nahi. */}
            <div className="detail-card-title"><i className="fa-solid fa-rocket" /> Launch Setup Data</div>
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
function ConfirmModal({ tone, icon, title, sub, confirmText, confirmClass, confirmIcon, onConfirm, onClose, busy = false }) {
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
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={confirmClass} onClick={onConfirm} disabled={busy}>
            <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : confirmIcon}`} /> {busy ? 'Saving…' : confirmText}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ═══════════════════════ ERP DETAIL MODAL ═══════════════════════ */
function ErpDetailModal({ school: s, detail, patchDetail, onCounts, toast, onClose }) {
  const [sect, setSect] = useState('progress');
  const [follow, setFollow] = useState('notes');
  const [addType, setAddType] = useState(null);     // 'note' | 'call' | 'message'
  const [editItem, setEditItem] = useState(null);   // edit ho rahi entry (warna null)
  const [histIdx, setHistIdx] = useState(null);
  const [savingCard, setSavingCard] = useState(false);
  /* Onboarding grid me 15 cards hain — spinner sirf usi module par chale jo
     abhi save ho raha hai, is liye yahan boolean nahi, module ki key rakhi
     jati hai (savingCard sab par ek saath spinner chala deta tha). */
  const [savingOb, setSavingOb] = useState(null);

  /* Follow-up Card aur Onboarding Card dono ek hi API par jate hain:
       POST /api/AHM_School_Progress/followup/onboarding-card-action
     headType = kaunsa card, subHeadType = uska sub-tab (Notes/Calls/
     Messages) ya onboarding module ka naam. branchID isi school ka. */
  const saveCard = async ({ headType, subHeadType, commentDetail, date, id = 0 }) => {
    await schoolProgressApi.saveCardAction({
      branchId: s.id, headType, subHeadType, commentDetail, date, id,
    });
  };

  /* Modal khulte hi is school ke saare cards API se — notes/calls/messages
     aur onboarding comments. Pehle ye demo state se aate the aur refresh par
     gayab ho jate the. */
  const loadCards = useCallback(async () => {
    try {
      const rows = await schoolProgressApi.listCardActions({ branchId: s.id });
      /* Wahi rows list ke chips bhi chalate hain — har save/delete ke baad
         card ki ginti server ke sath sync ho jati hai. */
      onCounts?.(s.id, schoolProgressApi.countCardRows(rows));
      const H = schoolProgressApi.CARD_HEADS;
      const pick = (sub) => rows
        .filter((r) => r.headType === H.followup && r.subHeadType === sub)
        .map((r) => ({ id: r.id, text: r.comment, detail: r.comment, date: r.date, dateTime: r.date, user: 'schoolmentoradmin' }));
      const obRows = rows.filter((r) => r.headType === H.onboarding);
      patchDetail(s.id, (cur) => ({
        ...cur,
        notes:    pick('Notes'),
        calls:    pick('Calls'),
        messages: pick('Messages'),
        /* Har module ka aakhri comment card par, poori list history me. */
        obModules: cur.obModules.map((m) => {
          const mine = obRows.filter((r) => r.subHeadType === m.name);
          if (!mine.length) return { ...m, done: false, comment: '', date: '', history: [] };
          const last = mine[mine.length - 1];
          return {
            ...m,
            done: true,
            comment: last.comment,
            date: last.date,
            _cardId: last.id,
            history: mine.map((r) => ({ id: r.id, comment: r.comment, date: r.date, user: 'schoolmentoradmin' })),
          };
        }),
      }));
    } catch (err) {
      toast?.(err?.message || 'Could not load follow-up / onboarding cards', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.id]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const d = detail;
  const tabKeys = ['school', 'classes', 'student', 'dept', 'staff', 'syllabus', 'timetable'];
  const tabLabels = { school: 'School Tab', classes: 'Classes Tab', student: 'Student Tab', dept: 'Department', staff: 'Staff', syllabus: 'Syllabus', timetable: 'Time Table' };

  /* Delete server par (action:delete) — kaamyabi par hi list se hatao. */
  const delItem = async (type, id) => {
    if (savingCard) return;
    setSavingCard(true);
    try {
      await schoolProgressApi.deleteCardAction(id, s.id);
      patchDetail(s.id, (cur) => {
        const k = type === 'note' ? 'notes' : type === 'call' ? 'calls' : 'messages';
        return { ...cur, [k]: cur[k].filter((x) => x.id !== id) };
      });
      /* Upar wala patch sirf foran ka feedback hai; asli ginti (aur list ke
         chips) server se dobara padh kar hi set hoti hai — jaise save karta hai. */
      await loadCards();
      toast?.('Deleted', 'info');
    } catch (err) {
      toast?.(err?.message || 'Could not delete', 'error');
    } finally {
      setSavingCard(false);
    }
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
                {/* Yahan bhi Launch Setup hi ke tabs hain (School Tab, Classes,
                    Student, Department, Staff, Syllabus, Time Table). */}
                <div className="em-ic-title"><i className="fa-solid fa-rocket" /> Launch Setup Data</div>
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
              onAdd={() => { setEditItem(null); setAddType(follow === 'notes' ? 'note' : follow === 'calls' ? 'call' : 'message'); }}
              onEdit={(item) => { setEditItem(item); setAddType(follow === 'notes' ? 'note' : follow === 'calls' ? 'call' : 'message'); }}
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
                <ObCard key={m.key} m={m} idx={i} saving={savingOb === m.key}
                  onSave={async (comment, date) => {
                    if (!comment && !date) { toast?.('Enter comment or date first', 'warn'); return; }
                    if (savingOb) return;
                    setSavingOb(m.key);
                    try {
                      /* Sub-head = isi module ka naam (Academics, Examination, …).
                         `id` isi module ki mojooda entry ka — loadCards use
                         `_cardId` me rakhta hai. Iske baghair saveCardAction har
                         baar action 'add' bhejta tha, is liye edit karne par
                         entry update hone ki jagah nayi row ban jati thi. */
                      await saveCard({
                        headType: schoolProgressApi.CARD_HEADS.onboarding,
                        subHeadType: m.name,
                        commentDetail: comment,
                        date,
                        id: m._cardId || 0,
                      });
                    } catch (err) {
                      toast?.(err?.message || 'Could not save', 'error');
                      setSavingOb(null);
                      return;
                    }
                    /* Cards dobara API se — comment/date/history server ke
                       mutabiq (local copy banane ki zaroorat nahi). */
                    await loadCards();
                    setSavingOb(null);
                    toast?.(`${m.name} saved!`, 'success');
                  }}
                  onHistory={() => setHistIdx(i)} />
              ))}
            </div>
          </div>
        )}

        {/* ── TRAINING ── */}
        {sect === 'training' && <TrainingSection branchId={s.id} toast={toast} />}
      </div>

      {/* Add follow-up popup */}
      {addType && (
        <AddFollowModal type={addType} saving={savingCard} initial={editItem}
          onClose={() => { setAddType(null); setEditItem(null); }}
          onSave={async (text, dateStr) => {
            if (savingCard) return;
            setSavingCard(true);
            try {
              /* Sub-head wahi jo abhi khula sub-tab hai (Notes/Calls/Messages).
                 Edit ho to usi entry ka id — API khud `update` kar deti hai. */
              await saveCard({
                headType: schoolProgressApi.CARD_HEADS.followup,
                subHeadType: addType === 'note' ? 'Notes' : addType === 'call' ? 'Calls' : 'Messages',
                commentDetail: text,
                date: dateStr,
                id: editItem?.id || 0,
              });
            } catch (err) {
              toast?.(err?.message || 'Could not save', 'error');
              setSavingCard(false);
              return;
            }
            /* List dobara API se — taake har entry ka asli id mile (delete/edit
               usi id par chalte hain). */
            await loadCards();
            setSavingCard(false);
            const wasEdit = Boolean(editItem);
            setAddType(null);
            setEditItem(null);
            toast?.(`${addType.charAt(0).toUpperCase() + addType.slice(1)} ${wasEdit ? 'updated' : 'added'}`, 'success');
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

function FollowList({ type, items, onAdd, onEdit, onDelete, toast }) {
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
                  {/* tip-pos="left": .fu-card is overflow:hidden, so the
                      default upward tooltip gets clipped inside the card —
                      same reason every other action button here points left. */}
                  <button className="fu-act-btn edit" data-tip="Edit" data-tip-pos="left" onClick={() => onEdit?.(item)}><i className="fa-solid fa-pen" /></button>
                  <button className="fu-act-btn del" data-tip="Delete" data-tip-pos="left" onClick={() => onDelete(item.id)}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddFollowModal({ type, saving = false, initial = null, onClose, onSave }) {
  const cfg = {
    note: { title: 'Add Note', icon: 'fa-note-sticky', fl: 'Note', dl: 'Date', sl: 'Save Note', dt: 'date', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' },
    call: { title: 'Add Call Log', icon: 'fa-phone', fl: 'Call Detail', dl: 'Date & Time', sl: 'Save Call', dt: 'datetime-local', grad: 'linear-gradient(135deg,#15803D,#16A34A)' },
    message: { title: 'Add Message', icon: 'fa-comment-dots', fl: 'Message Detail', dl: 'Date & Time', sl: 'Save Message', dt: 'datetime-local', grad: 'linear-gradient(135deg,#0369A1,#0284C7)' },
  }[type];
  /* Edit ho to mojooda entry se bhar do (text list me `text` ya `detail` me
     hota hai, aur date `date`/`dateTime` me — dono jagah wahi raw value). */
  const editing = Boolean(initial);
  const [text, setText] = useState(initial ? (initial.text ?? initial.detail ?? '') : '');
  const [date, setDate] = useState(initial ? (initial.date ?? initial.dateTime ?? '') : '');
  return (
    <Overlay cls="em-add-ov" onClose={onClose} wrapCls="em-add-box">
      <div className="em-add-hdr" style={{ background: cfg.grad }}>
        <div className="em-add-title"><i className={`fa-solid ${cfg.icon}`} /> {editing ? cfg.title.replace('Add', 'Edit') : cfg.title}</div>
        <button className="em-add-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="em-add-body">
        <div className="em-add-f"><label>{cfg.fl}</label><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write here..." /></div>
        <div className="em-add-f"><label>{cfg.dl}</label><input type={cfg.dt} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="em-add-foot">
        <button className="btn-secondary" style={{ height: 34, padding: '0 14px', fontSize: 12.5 }} onClick={onClose}>Cancel</button>
        {/* Sirf bilkul khali entry rukti hai. Detail khali chhod kar sirf date
            badalna bhi ek valid edit hai (pehle `!text.trim()` har aisi save ko
            chupchaap gira deta tha — button dabta tha aur kuch hota hi nahi),
            wahi rule jo onboarding card par chalta hai: comment ya date, koi ek. */}
        <button className="btn-primary" style={{ height: 34, padding: '0 16px', fontSize: 12.5 }} disabled={saving} onClick={() => { if (saving || (!text.trim() && !date)) return; onSave(text.trim(), date); }}><i className={`fa-${saving ? 'solid fa-spinner fa-spin' : 'regular fa-floppy-disk'}`} /> {saving ? 'Saving…' : (editing ? 'Update' : cfg.sl)}</button>
      </div>
    </Overlay>
  );
}

function ObCard({ m, idx, saving = false, onSave, onHistory }) {
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
        <button className="em-ob-save-btn" disabled={saving} onClick={() => { if (!saving) onSave(comment.trim(), date); }}><i className={`fa-${saving ? 'solid fa-spinner fa-spin' : 'regular fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

/* Khali form ki halat — add ke baad aur Cancel par isi par wapas jate hain. */
const BLANK_TRAINING = { participants: '', date: '', names: '', certs: '', desc: '' };

/* '2026-06-14' → '14 June 2026'. Khali/galat value par khali string, taake
   card me "Invalid Date" na chhape. */
function trainingDate(iso) {
  const d = new Date(`${String(iso || '').slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ''
    : `${d.getDate()} ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
}

/* Session ki editing modal me hoti hai — bilkul Follow-up card wali tarz par
   (dekhein AddFollowModal). Neeche wala form sirf NAYA session add karta hai,
   is liye add aur update aapas me nahi ulajhte. */
function TrainingModal({ session, saving = false, onClose, onSave }) {
  const [form, setForm] = useState({
    participants: session.participants ? String(session.participants) : '',
    date: session.date || '',
    names: session.names || '',
    certs: session.certs || '',
    desc: session.desc || '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Overlay cls="em-add-ov" onClose={onClose} wrapCls="em-add-box">
      <div className="em-add-hdr">
        <div className="em-add-title"><i className="fa-solid fa-chalkboard-user" /> Edit Training Session</div>
        <button className="em-add-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="em-add-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="em-add-f"><label>Number of Participants</label><input type="number" placeholder="e.g. 5" value={form.participants} onChange={(e) => set('participants', e.target.value)} /></div>
          <div className="em-add-f"><label>Training Date</label><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
        </div>
        <div className="em-add-f"><label>Participant Names</label><input type="text" placeholder="e.g. Mr. Ahmed, Ms. Sara" value={form.names} onChange={(e) => set('names', e.target.value)} /></div>
        <div className="em-add-f"><label>Certificates / Notes</label><input type="text" placeholder="Certificate issued? Notes..." value={form.certs} onChange={(e) => set('certs', e.target.value)} /></div>
        <div className="em-add-f"><label>Description / Coordination Note</label><textarea placeholder="Add coordination notes or follow-up actions..." value={form.desc} onChange={(e) => set('desc', e.target.value)} /></div>
      </div>
      <div className="em-add-foot">
        <button className="btn-secondary" style={{ height: 34, padding: '0 14px', fontSize: 12.5 }} onClick={onClose}>Cancel</button>
        <button className="btn-primary" style={{ height: 34, padding: '0 16px', fontSize: 12.5 }} disabled={saving} onClick={() => { if (!saving) onSave(form); }}>
          <i className={`fa-${saving ? 'solid fa-spinner fa-spin' : 'regular fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Update'}
        </button>
      </div>
    </Overlay>
  );
}

/* ── Training ────────────────────────────────────────────────────────
   Pehle upar ek hardcoded "Monthly Training Topic" block tha (topic,
   trainer, bio, description — sab JSX me likhe hue) aur neeche ka form
   hamesha usi ek record ko update karta tha, is liye doosra session add
   ho hi nahi sakta tha.

   Ab: upar sirf wahi sessions dikhte hain jo is school ke liye add kiye gaye
   (training-session-action, action:get), neeche ka form SIRF naya session
   add karta hai, aur kisi card par Edit dabane se TrainingModal khulta hai
   jahan se update hota hai. */
function TrainingSection({ branchId, toast }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(BLANK_TRAINING);
  const [editSession, setEditSession] = useState(null);  // modal khuli ho to wo session
  const [savingEdit, setSavingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(0);      // jis card par delete chal rahi hai
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toastRef = useRef(toast);
  toastRef.current = toast;

  const load = useCallback(async () => {
    if (!branchId) { setSessions([]); return; }
    setLoading(true);
    try {
      setSessions(await schoolProgressApi.listTrainingSessions(branchId));
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not load training sessions', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  /* Add aur update dono yahin se jate hain — farq sirf `id` ka hai (0 → add). */
  const persist = (values, id) => schoolProgressApi.saveTrainingSession({
    branchId,
    participants: values.participants,
    date: values.date,
    names: (values.names || '').trim(),
    certs: (values.certs || '').trim(),
    desc: (values.desc || '').trim(),
    id,
  });

  const isBlank = (v) => !v.participants && !v.date && !(v.names || '').trim();

  /* Neeche wala form — hamesha NAYA session (id: 0). */
  const add = async () => {
    if (saving) return;
    if (isBlank(form)) { toast?.('Fill participation details first', 'warn'); return; }
    setSaving(true);
    try {
      await persist(form, 0);
      toast?.('Training session added', 'success');
      setForm(BLANK_TRAINING);      // form khali, taake agla naya add ho
      await load();
    } catch (err) {
      toast?.(err?.message || 'Could not add training session', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* Modal se update — mojooda session ki id ke sath. */
  const saveEdit = async (values) => {
    if (savingEdit || !editSession) return;
    if (isBlank(values)) { toast?.('Fill participation details first', 'warn'); return; }
    setSavingEdit(true);
    try {
      await persist(values, editSession.id);
      toast?.('Training session updated', 'success');
      setEditSession(null);
      await load();
    } catch (err) {
      toast?.(err?.message || 'Could not update training session', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const del = async (s) => {
    if (busyId) return;
    setBusyId(s.id);
    try {
      await schoolProgressApi.deleteTrainingSession(s.id, branchId);
      toast?.('Training session deleted', 'info');
      await load();
    } catch (err) {
      toast?.(err?.message || 'Could not delete this session', 'error');
    } finally {
      setBusyId(0);
    }
  };

  return (
    <div className="em-sect active">
      {loading && (
        <div className="em-tr-empty"><i className="fa-solid fa-spinner fa-spin" /> Loading training sessions…</div>
      )}
      {!loading && !sessions.length && (
        <div className="em-tr-empty">
          <i className="fa-solid fa-chalkboard-user" style={{ marginRight: 5 }} />
          No training session added yet — use the form below to add the first one.
        </div>
      )}
      {!loading && sessions.map((s) => (
        <div className="em-tr-overview" key={s.id}>
          <div className="em-tr-header">
            <div className="em-tr-icon"><i className="fa-solid fa-chalkboard-user" /></div>
            <div style={{ minWidth: 0 }}>
              <div className="em-tr-title">{trainingDate(s.date) || 'Training Session'}</div>
              <div className="em-tr-sub">{s.participants || 0} participant{s.participants === 1 ? '' : 's'}</div>
            </div>
            <div className="em-tr-acts">
              <button className="em-tr-act" data-tip="Edit this session" disabled={busyId === s.id} onClick={() => setEditSession(s)}>
                <i className="fa-solid fa-pen" />
              </button>
              <button className="em-tr-act danger" data-tip="Delete this session" disabled={busyId === s.id} onClick={() => del(s)}>
                <i className={`fa-solid ${busyId === s.id ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} />
              </button>
            </div>
          </div>
          <div className="em-tr-meta">
            <div className="em-tr-field"><div className="em-tr-fl"><i className="fa-solid fa-calendar-day" style={{ color: 'var(--brand)', marginRight: 3 }} /> Training Date</div><div className="em-tr-fv">{trainingDate(s.date) || '—'}</div></div>
            <div className="em-tr-field"><div className="em-tr-fl"><i className="fa-solid fa-users" style={{ color: 'var(--brand)', marginRight: 3 }} /> Participants</div><div className="em-tr-fv">{s.participants || '—'}</div></div>
            <div className="em-tr-field" style={{ gridColumn: 'span 2' }}><div className="em-tr-fl"><i className="fa-solid fa-user-tie" style={{ color: 'var(--brand)', marginRight: 3 }} /> Participant Names</div><div className="em-tr-fv">{s.names || '—'}</div></div>
            <div className="em-tr-field" style={{ gridColumn: 'span 2' }}><div className="em-tr-fl"><i className="fa-solid fa-certificate" style={{ color: 'var(--brand)', marginRight: 3 }} /> Certificates / Notes</div><div className="em-tr-fv" style={{ fontWeight: 500, fontSize: 12, color: 'var(--tm)' }}>{s.certs || '—'}</div></div>
            <div className="em-tr-field" style={{ gridColumn: 'span 2' }}><div className="em-tr-fl"><i className="fa-solid fa-align-left" style={{ color: 'var(--brand)', marginRight: 3 }} /> Description / Coordination Note</div><div className="em-tr-fv" style={{ fontWeight: 500, fontSize: 12, color: 'var(--tm)', lineHeight: 1.55 }}>{s.desc || '—'}</div></div>
          </div>
        </div>
      ))}
      <div className="em-tr-part">
        <div className="em-tr-part-title"><i className="fa-solid fa-plus" /> Add Training Session</div>
        <div className="em-tr-row">
          <div className="em-tr-fg"><label>Number of Participants</label><input className="em-tr-input" type="number" placeholder="e.g. 5" value={form.participants} onChange={(e) => set('participants', e.target.value)} /></div>
          <div className="em-tr-fg"><label>Training Date</label><input className="em-tr-input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
        </div>
        <div className="em-tr-fg" style={{ marginBottom: 11 }}><label>Participant Names</label><input className="em-tr-input" type="text" placeholder="e.g. Mr. Ahmed, Ms. Sara" value={form.names} onChange={(e) => set('names', e.target.value)} /></div>
        <div className="em-tr-fg" style={{ marginBottom: 11 }}><label>Certificates / Notes</label><input className="em-tr-input" type="text" placeholder="Certificate issued? Notes..." value={form.certs} onChange={(e) => set('certs', e.target.value)} /></div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Description / Coordination Note</label>
        <textarea className="em-tr-textarea" placeholder="Add coordination notes or follow-up actions..." value={form.desc} onChange={(e) => set('desc', e.target.value)} />
        <div className="em-tr-save">
          <button className="em-tr-save-btn" disabled={saving} onClick={add}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-plus'}`} />
            {saving ? ' Adding…' : ' Add Session'}
          </button>
        </div>
      </div>

      {editSession && (
        <TrainingModal
          session={editSession}
          saving={savingEdit}
          onClose={() => { if (!savingEdit) setEditSession(null); }}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ ENQUIRIES ═══════════════════════
   Sab kuch school-enquiries-bugs-action par: `isSolved` false wala bug Open
   me, true wala Resolved me. Mark Resolved / Reopen dono `update` hain
   (poora record dobara jata hai, sirf isSolved badalta hai). */
function EnquiryDetailModal({ school: s, bugs, onRefresh, toast, onAdd, onEdit, onClose }) {
  const [tab, setTab] = useState('open');
  const open = bugs.filter((b) => b.status === 'open');
  const res = bugs.filter((b) => b.status === 'resolved');
  const list = tab === 'open' ? open : res;

  /* Kis bug par abhi call chal rahi hai — us card ke buttons band. */
  const [busyId, setBusyId] = useState(0);

  const run = async (bug, fn, okMsg, tone) => {
    setBusyId(bug.id);
    try {
      await fn();
      await onRefresh?.(s.id);
      toast?.(okMsg, tone);
    } catch (err) {
      toast?.(err?.message || 'Something went wrong', 'error');
    } finally {
      setBusyId(0);
    }
  };

  const markResolved = (bug) => run(bug, () => schoolProgressApi.setEnquirySolved(bug, true), 'Bug marked as resolved', 'success');
  const reopen = (bug) => run(bug, () => schoolProgressApi.setEnquirySolved(bug, false), 'Bug reopened', 'info');
  const del = (bug) => run(bug, () => schoolProgressApi.deleteEnquiry(bug.id, s.id), 'Bug deleted', 'info');

  return (
    <Overlay cls="enq-ov" onClose={onClose} wrapCls="enq-modal">
      <div className="enq-modal-hdr">
        <div className="enq-modal-av">{s.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="enq-modal-school-name">{s.name}</div>
          <div className="enq-modal-sub">Assigned: {s.assigned} · {s.staff} Staff · {s.students} Students</div>
        </div>
        <button className="enq-add-btn" style={{ height: 34, fontSize: 12 }} onClick={() => onAdd?.(tab)}><i className="fa-solid fa-plus" /> Add Bug</button>
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
                        ? <button className="enq-resolve-btn" disabled={busyId === bug.id} onClick={() => markResolved(bug)}><i className={`fa-solid ${busyId === bug.id ? 'fa-spinner fa-spin' : 'fa-circle-check'}`} style={{ fontSize: 9 }} /> Mark Resolved</button>
                        : <button className="enq-reopen-btn" disabled={busyId === bug.id} onClick={() => reopen(bug)}><i className={`fa-solid ${busyId === bug.id ? 'fa-spinner fa-spin' : 'fa-rotate-left'}`} style={{ fontSize: 9 }} /> Reopen</button>}
                    </div>
                  </div>
                  <div className="enq-bug-actions">
                    <button className="enq-iact" data-tip="Edit" data-tip-pos="left" disabled={busyId === bug.id} onClick={() => onEdit?.(bug)}><i className="fa-solid fa-pen" /></button>
                    <button className="enq-iact del" data-tip="Delete" data-tip-pos="left" disabled={busyId === bug.id} onClick={() => del(bug)}><i className="fa-solid fa-trash-can" /></button>
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

function EnquiryEditModal({ school: s, bug, defaultSolved = false, onRefresh, toast, onClose }) {
  const editing = Boolean(bug);
  const [form, setForm] = useState({ module: bug?.module || '', developer: bug?.developer || '', detail: bug?.detail || '', date: bug?.date || '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* Developer aur Date bhi backend par [Required] hain — khali chhode to 400
     aata hai, is liye Save se pehle chaaron ki jaanch yahin. */
  const save = async () => {
    if (!form.module.trim() || !form.detail.trim()) { toast?.('Module and bug detail are required', 'warn'); return; }
    if (!form.developer.trim()) { toast?.('Developer is required', 'warn'); return; }
    if (!form.date) { toast?.('Date is required', 'warn'); return; }
    setSaving(true);
    try {
      await schoolProgressApi.saveEnquiry({
        id: editing ? bug.id : 0,
        branchId: s.id,
        module: form.module.trim(),
        developer: form.developer.trim(),
        bugDetail: form.detail.trim(),
        date: form.date,
        /* Naya bug us tab me jata hai jahan se add kiya gaya: Resolved tab
           khula tha to isSolved true, warna false. Edit par jo tha wahi rehta
           hai (status sirf Mark Resolved / Reopen se badalta hai). */
        isSolved: editing ? Boolean(bug.isSolved) : Boolean(defaultSolved),
      });
      await onRefresh?.(s.id);
      toast?.(editing ? 'Bug updated' : 'Bug added', 'success');
      onClose();
    } catch (err) {
      toast?.(err?.message || 'Could not save this enquiry', 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Overlay cls="enq-add-ov" onClose={onClose} wrapCls="enq-add-box">
      <div className="enq-add-hdr">
        <div className="enq-add-title">
          <i className={`fa-solid ${editing ? 'fa-pen' : 'fa-plus'}`} /> {editing ? 'Edit' : 'Add'} Bug — {s.name}
          {/* Resolved tab se add kiya ja raha hai to yehi batao — save hote hi
              bug Resolved me jayega, Open me nahi. */}
          {!editing && defaultSolved && <span className="badge-resolved" style={{ marginLeft: 8 }}><i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} /> Resolved</span>}
        </div>
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
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <i className={saving ? 'fa-solid fa-spinner fa-spin' : 'fa-regular fa-floppy-disk'} /> {saving ? 'Saving…' : (editing ? 'Update Bug' : 'Save Bug')}
        </button>
      </div>
    </Overlay>
  );
}
