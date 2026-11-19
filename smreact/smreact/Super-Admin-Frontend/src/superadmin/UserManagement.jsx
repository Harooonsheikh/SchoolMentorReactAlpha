import React, { useEffect, useState } from 'react';
import { userInitials, pageButtons } from './userMgmtData';
import { INITIAL_LAUNCH, INITIAL_ERP } from './statusData';
import { authApi, schoolProgressApi } from './api';
import UserPermissionMatrix from './UserPermissionMatrix';
import { useSaPerms } from './saPerms';
import { isHeadUser, roleLabel } from './permissionModel';


/* ═══════════════════════════════════════════════════════════════════
   USER MANAGEMENT — Super Admin module (frontend only)

   Three tabs:
     • User Registration — add / edit / delete admin users (paginated)
     • Assign School     — assign launch / ERP schools to a user
     • User Permission   — toggle per-user menu access
   All state is in-component demo state (see ./userMgmtData). No backend.
   ═══════════════════════════════════════════════════════════════════ */

/* screen = permissionModel MODULE_SCREENS.userManagement ka id */
const TABS = [
  { id: 'reg',    name: 'User Registration', icon: 'fa-user-plus',     screen: 'registration' },
  { id: 'assign', name: 'Assign School',     icon: 'fa-school',        screen: 'assign' },
  { id: 'perm',   name: 'User Permission',   icon: 'fa-shield-halved', screen: 'permissions' },
];

export default function UserManagement({ toast, users, setUsers, reloadUsers, setPerms, onPermsSaved }) {
  const [tabSel, setTab] = useState('reg');
  const [modal, setModal] = useState(null);

  /* View permission na ho to tab chhupa do; current tab chhupa ho to pehla visible. */
  const P = useSaPerms('userManagement');
  const visibleTabs = TABS.filter((t) => P.canView(t.screen));
  const tab = visibleTabs.some((t) => t.id === tabSel) ? tabSel : visibleTabs[0]?.id;

  /* Add User → POST /api/Auth/signup, phir list GET /api/Auth/get-all-users se taza.
     true lautata hai jab user ban gaya (form tab hi saaf hota hai). */
  const addUser = async (form) => {
    if (!P.guard('registration', 'create', toast)) return false;
    const { firstName, lastName } = form;
    try {
      /* Admin tick = Head (isAdmin true), bina tick = Teacher (isAdmin false). */
      await authApi.signup({ firstName, lastName, userName: form.userName, password: form.password, isAdmin: !!form.isAdmin });
    } catch (err) {
      toast?.(err?.message || 'Could not create user', 'error');
      return false;
    }
    toast?.(`${form.fullName} added successfully`, 'success');
    await reloadUsers?.();
    return true;
  };
  /* Save Changes → PUT /api/Auth/update-user. "Active" ka tick hataya ho to
     saath me deactivate-user bhi. Kamyabi par list API se taza. */
  const saveUser = async (id, patch) => {
    if (!P.guard('registration', 'edit', toast)) return false;
    const user = users.find((u) => u.id === id) || {};
    try {
      await authApi.updateUser({
        id,
        firstName: patch.firstName,
        lastName:  patch.lastName,
        userName:  patch.userName,
        password:  patch.password,
        isAdmin:   patch.isAdmin ?? user.isAdmin,
      });
      if (user.active !== false && patch.active === false) await authApi.deactivateUser(id);
      else if (user.active === false && patch.active === true) await authApi.activateUser(id);
    } catch (err) {
      toast?.(err?.message || 'Could not update user', 'error');
      return false;
    }
    setModal(null); toast?.('User updated', 'success');
    await reloadUsers?.();
    return true;
  };
  /* Delete → PUT /api/Auth/deactivate-user/{id} (user band hota hai, mitaya nahi jata). */
  const deleteUser = async (id) => {
    if (!P.guard('registration', 'delete', toast)) return false;
    try {
      await authApi.deactivateUser(id);
    } catch (err) {
      toast?.(err?.message || 'Could not deactivate user', 'error');
      return false;
    }
    /* List se hatate nahi — get-all-users ab isActive bhejti hai, to user
       "Inactive" status ke saath list me rehta hai. */
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: false } : u));
    setModal(null); toast?.('User deactivated', 'info');
    await reloadUsers?.();
    return true;
  };
  /* Inactive user → PUT /api/Auth/activate-user/{id}. */
  const activateUser = async (u) => {
    if (!P.guard('registration', 'edit', toast)) return false;
    try {
      await authApi.activateUser(u.id);
    } catch (err) {
      toast?.(err?.message || 'Could not activate user', 'error');
      return false;
    }
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, active: true } : x));
    toast?.(`${u.fullName} activated`, 'success');
    await reloadUsers?.();
    return true;
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-users-gear" /></div>
          <div>
            <div className="page-title">User Management</div>
            <div className="page-sub">Manage admin users, assign schools, and control module permissions.</div>
          </div>
        </div>
      </div>

      <div className="um-tabs">
        {visibleTabs.map((t) => <button key={t.id} className={`um-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}><i className={`fa-solid ${t.icon}`} /> {t.name}</button>)}
      </div>

      {!tab && (
        <div className="section-card" style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: 26, opacity: 0.3, display: 'block', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>You don't have permission to view this</div>
        </div>
      )}
      {tab === 'reg' && (
        <RegistrationTab users={users} onAdd={addUser}
          onEdit={(u) => { if (P.guard('registration', 'edit', toast)) setModal({ type: 'edit', user: u }); }}
          onDelete={(u) => { if (P.guard('registration', 'delete', toast)) setModal({ type: 'del', user: u }); }}
          onActivate={activateUser} toast={toast} />
      )}
      {tab === 'assign' && <AssignTab users={users} toast={toast} />}
      {tab === 'perm' && <UserPermissionMatrix users={users} setPerms={setPerms} toast={toast} onPermsSaved={onPermsSaved} />}

      {modal?.type === 'edit' && <EditUserModal user={modal.user} onClose={() => setModal(null)} onSave={saveUser} toast={toast} />}
      {modal?.type === 'del' && <DeleteUserModal user={modal.user} onClose={() => setModal(null)} onConfirm={() => deleteUser(modal.user.id)} />}
    </div>
  );
}

/* ═══════════════════════ REGISTRATION TAB ═══════════════════════ */
function RegistrationTab({ users, onAdd, onEdit, onDelete, onActivate: activate, toast }) {
  const EMPTY = { firstName: '', lastName: '', phone: '', password: '', active: true, isAdmin: false };
  const P = useSaPerms('userManagement');
  const [activatingId, setActivatingId] = useState(null);
  const onActivate = async (u) => {
    if (activatingId) return;
    setActivatingId(u.id);
    try { await activate?.(u); } finally { setActivatingId(null); }
  };
  const [form, setForm] = useState(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* Address + Display Picture + User Name hide hain. Phone No. hi login id hai —
     signup me user_Name = phone jata hai. */
  const submit = async () => {
    if (saving) return;
    /* Backend: "FirstName and LastName are required." — dono lazmi. */
    if (!form.firstName.trim()) { toast?.('Please enter first name', 'warn'); return; }
    if (!form.lastName.trim()) { toast?.('Please enter last name', 'warn'); return; }
    if (!form.phone.trim()) { toast?.('Please enter phone number', 'warn'); return; }
    if (!form.password.trim()) { toast?.('Please enter password', 'warn'); return; }
    setSaving(true);
    const phone = form.phone.trim();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const ok = await onAdd({ firstName, lastName, fullName: `${firstName} ${lastName}`, userName: phone, phone, password: form.password.trim(), active: form.active, isAdmin: form.isAdmin });
    setSaving(false);
    if (ok) setForm(EMPTY);
  };

  const q = search.toLowerCase();
  const filtered = users.filter((u) =>
    (u.fullName || '').toLowerCase().includes(q) || (u.userName || '').toLowerCase().includes(q) || (u.phone || '').includes(search));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const cur = Math.min(page, totalPages);
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage);
  const start = total ? (cur - 1) * perPage + 1 : 0;
  const end = Math.min(cur * perPage, total);

  return (
    <div className="um-panel">
      {/* Add user form */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-user-plus" /> Add User</div></div>
        <div style={{ padding: 20 }}>
          <div className="um-form-grid">
            <div className="um-field"><label className="um-label">First Name</label><input className="um-input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Enter First Name" /></div>
            <div className="um-field"><label className="um-label">Last Name</label><input className="um-input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Enter Last Name" /></div>
            <div className="um-field"><label className="um-label">Phone No.</label><input className="um-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Enter Phone No." /></div>
            <div className="um-field"><label className="um-label">Password</label>
              <div className="um-pw-wrap"><input className="um-input" type={showPw ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Enter Password" /><button className="um-pw-eye" type="button" data-tip="Show password" onClick={() => setShowPw((s) => !s)}><i className={`fa-regular ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} /></button></div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            {/* "Active" checkbox hata diya — naya user hamesha Active banta hai (EMPTY.active = true). */}
            {/* Admin tick = Head (poori access), bina tick = Teacher (User Permission se chalta hai). */}
            <div className="um-checkbox-row"><input type="checkbox" id="um-admin" checked={!!form.isAdmin} onChange={(e) => set('isAdmin', e.target.checked)} /><label htmlFor="um-admin">Admin</label></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button {...P.lock('registration', 'create', { className: 'btn-primary', disabled: saving })} onClick={submit}><i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-user-plus'}`} /> {saving ? 'Adding…' : 'Add User'}</button></div>
        </div>
      </div>

      {/* Users table */}
      <div className="section-card">
        <div className="card-header">
          <div><div className="card-title"><i className="fa-solid fa-users" /> Registered Users</div><div className="card-sub">{total} user{total !== 1 ? 's' : ''} registered</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--tm)' }}>Show</div>
            <select className="f-input" style={{ width: 80, height: 34 }} value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select>
            <div style={{ fontSize: 13, color: 'var(--tm)' }}>entries</div>
            <div style={{ marginLeft: 12, fontSize: 13, color: 'var(--tm)' }}>Search:</div>
            <div className="search-box" style={{ width: 180 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" /></div>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="um-table">
            <thead><tr><th style={{ width: 60 }}>Sr.No</th><th>Name</th><th style={{ width: 130 }}>Phone</th><th style={{ width: 90, textAlign: 'center' }}>Role</th><th style={{ width: 70, textAlign: 'center' }}>Status</th><th style={{ width: 130, textAlign: 'center' }}>Action</th></tr></thead>
            <tbody>
              {slice.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 36, color: 'var(--tm)' }}><i className="fa-solid fa-users" style={{ fontSize: 26, opacity: 0.2, display: 'block', marginBottom: 8 }} /><div style={{ fontSize: 13, fontWeight: 700 }}>No users found</div></td></tr> : slice.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{(cur - 1) * perPage + i + 1}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div className="um-avatar">{u.pic ? <img src={u.pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : userInitials(u.fullName)}</div>
                    <div style={{ fontWeight: 700, color: 'var(--t1)' }}>{u.fullName}</div>
                  </div></td>
                  {/* user_Name hi phone number hai */}
                  <td>{u.phone || u.userName || '—'}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${isHeadUser(u) ? 'b-blue' : 'b-gray'}`}>{roleLabel(u)}</span></td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${u.active ? 'b-green' : 'b-gray'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                      <button {...P.lock('registration', 'edit', { className: 'btn-sm', style: { height: 28, fontSize: 11.5 } })} onClick={() => onEdit(u)}><i className="fa-solid fa-pen" /> Edit</button>
                      {u.active ? (
                        <button {...P.lock('registration', 'delete', { className: 'btn-sm', style: { height: 28, fontSize: 11.5, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' } })} onClick={() => onDelete(u)}><i className="fa-solid fa-trash-can" /> Delete</button>
                      ) : (
                        /* Deactivated user — dobara chalu karne ka rasta (PUT activate-user). Activate = Edit permission. */
                        <button {...P.lock('registration', 'edit', { className: 'btn-sm', style: { height: 28, fontSize: 11.5, borderColor: '#16A34A', color: '#16A34A', background: 'rgba(22,163,74,.06)' }, disabled: activatingId === u.id })} onClick={() => onActivate(u)}><i className={`fa-solid ${activatingId === u.id ? 'fa-spinner fa-spin' : 'fa-rotate-left'}`} /> Activate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > perPage && <Pagination cur={cur} totalPages={totalPages} start={start} end={end} total={total} onGo={setPage} />}
      </div>
    </div>
  );
}

/* ═══════════════════════ ASSIGN SCHOOL TAB ═══════════════════════ */
function AssignTab({ users, toast }) {
  const [userId, setUserId] = useState('');
  const [schoolType, setSchoolType] = useState('launch');
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(null);   // working copy of assigned ids for selected user
  const [saving, setSaving] = useState(false);
  const P = useSaPerms('userManagement');

  /* Asli assignments — manage_assignedUser (action GET): branchId → { id, userId }.
     Ek branch ka ek hi user hota hai (UPSERT branchID par chalta hai). */
  const [assignMap, setAssignMap] = useState({});
  const loadAssignments = async () => {
    try {
      const rows = await schoolProgressApi.listAssignedUsers();
      const m = {};
      rows.forEach((r) => { m[r.branchId] = { id: r.id, userId: r.userId }; });
      setAssignMap(m);
      return m;
    } catch (err) {
      toast?.(err?.message || 'Could not load assignments', 'warn');
      return null;
    }
  };
  useEffect(() => { loadAssignments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const idsForUser = (uid, m = assignMap) => Object.entries(m)
    .filter(([, v]) => String(v.userId) === String(uid)).map(([bid]) => Number(bid));
  const assignedForUser = userId ? idsForUser(userId) : [];
  const selected = draft != null ? draft : assignedForUser;

  /* Schools — wahi lists jo Schools Progress ke Launch Setup / ERP tabs me hain
     (branch-report API: launchSetup=0 / 1). API na chale to demo list. */
  const [lists, setLists] = useState({ launch: [], erp: [] });
  const [loadingSchools, setLoadingSchools] = useState(true);
  useEffect(() => {
    let alive = true;
    schoolProgressApi.listSchoolProgress()
      .then(({ launch, erp }) => {
        if (!alive) return;
        if ((launch || []).length || (erp || []).length) setLists({ launch: launch || [], erp: erp || [] });
        else { setLists({ launch: INITIAL_LAUNCH, erp: INITIAL_ERP }); toast?.('No schools returned — showing sample data', 'warn'); }
      })
      .catch((err) => {
        if (!alive) return;
        setLists({ launch: INITIAL_LAUNCH, erp: INITIAL_ERP });
        toast?.(err?.message || 'Could not load schools — showing sample data', 'warn');
      })
      .finally(() => { if (alive) setLoadingSchools(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onUser = (id) => { setUserId(id); setDraft(null); setPage(1); };
  const schools = schoolType === 'launch' ? lists.launch : lists.erp;
  const filtered = schools.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const cur = Math.min(page, totalPages);
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage);
  const start = total ? (cur - 1) * perPage + 1 : 0;
  const end = Math.min(cur * perPage, total);

  const toggle = (sid) => setDraft((prev) => { const base = prev || []; return base.includes(sid) ? base.filter((x) => x !== sid) : [...base, sid]; });
  const allOnPage = slice.length > 0 && slice.every((s) => selected.includes(s.id));
  const toggleAll = (checked) => setDraft((prev) => {
    const base = prev || []; const pageIds = slice.map((s) => s.id);
    return checked ? Array.from(new Set([...base, ...pageIds])) : base.filter((x) => !pageIds.includes(x));
  });

  /* Save Assignment → POST /api/AHM_School_Progress/manage_assignedUser
       • naya check hua school  → UPSERT { branchID, userID, launchSetup }
       • uncheck hua school     → DELETE (soft) us branch ki row
     launchSetup: ERP list ka school 1, Launch Setup ka 0. */
  const save = async () => {
    if (saving) return;
    if (!P.guard('assign', 'edit', toast)) return;
    if (!userId) { toast?.('Please select a user first', 'warn'); return; }
    const want = new Set((draft || assignedForUser).map(Number));
    const had = new Set(assignedForUser.map(Number));
    const toAdd = [...want].filter((b) => !had.has(b));
    const toRemove = [...had].filter((b) => !want.has(b));
    if (!toAdd.length && !toRemove.length) { toast?.('No changes to save', 'info'); return; }

    const erpIds = new Set(lists.erp.map((s) => Number(s.id)));
    const ls = (bid) => (erpIds.has(bid) ? 1 : 0);
    setSaving(true);
    const results = await Promise.allSettled([
      ...toAdd.map((bid) => schoolProgressApi.saveAssignedUser({
        id: assignMap[bid]?.id || 0, branchId: bid, userId: Number(userId), launchSetup: ls(bid),
      })),
      ...toRemove.map((bid) => schoolProgressApi.clearAssignedUser({
        id: assignMap[bid]?.id || 0, branchId: bid, launchSetup: ls(bid),
      })),
    ]);
    const failed = results.filter((r) => r.status === 'rejected');
    await loadAssignments();
    setDraft(null);
    setSaving(false);
    if (failed.length) {
      toast?.(`${results.length - failed.length} saved, ${failed.length} failed: ${failed[0].reason?.message || 'error'}`, 'error');
    } else {
      toast?.(`School assignment saved (${toAdd.length} assigned, ${toRemove.length} removed)`, 'success');
    }
  };

  return (
    <div className="um-panel">
      <div className="section-card">
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-school" /> Assign School</div></div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 6 }}><i className="fa-solid fa-user" style={{ color: 'var(--brand)', marginRight: 4 }} /> Assign User</label>
            <select className="um-user-select" value={userId} onChange={(e) => onUser(e.target.value)}><option value="">Select User</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
          </div>

          <div className="um-school-tabs">
            <button className={`um-stab${schoolType === 'launch' ? ' active' : ''}`} onClick={() => { setSchoolType('launch'); setPage(1); }}><i className="fa-solid fa-rocket" /> Launch Setup ({lists.launch.length})</button>
            <button className={`um-stab${schoolType === 'erp' ? ' active' : ''}`} onClick={() => { setSchoolType('erp'); setPage(1); }}><i className="fa-solid fa-server" /> ERP ({lists.erp.length})</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--tm)' }}>Show <select className="f-input" style={{ width: 70, height: 30, display: 'inline-block', margin: '0 4px' }} value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}><option>10</option><option>25</option><option>50</option><option value={999}>All</option></select> entries</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13, color: 'var(--tm)' }}>Search:</span><div className="search-box" style={{ width: 200 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search school…" /></div></div>
          </div>

          <div className="tbl-wrap">
            <table className="um-assign-table">
              <thead><tr><th style={{ width: 60 }}>Sr #</th><th style={{ width: 50 }}><input type="checkbox" checked={allOnPage} onChange={(e) => toggleAll(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#fff', cursor: 'pointer' }} /></th><th>School Name</th></tr></thead>
              <tbody>
                {loadingSchools ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" /> Loading schools…</td></tr>
                  : slice.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>No schools found</td></tr> : slice.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{(cur - 1) * perPage + i + 1}</td>
                    <td><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: 'pointer' }} /></td>
                    <td style={{ fontWeight: 600, color: 'var(--t1)' }}>
                      {s.name}
                      {(() => {
                        const a = assignMap[s.id];
                        if (!a || !a.userId || String(a.userId) === String(userId)) return null;
                        const who = users.find((u) => String(u.id) === String(a.userId));
                        return <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--tm)' }}>
                          (Assigned to {who ? who.fullName : `User #${a.userId}`}{selected.includes(s.id) ? ' — will be reassigned' : ''})
                        </span>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > perPage && <Pagination cur={cur} totalPages={totalPages} start={start} end={end} total={total} onGo={setPage} />}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button {...P.lock('assign', 'edit', { className: 'btn-primary', disabled: saving })} onClick={save}><i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Assignment'}</button></div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ PERMISSION TAB ═══════════════════════ */
/* ERP jaisa design — users table + Edit Permissions modal (module rail +
   screens × actions). Dekhein ./UserPermissionMatrix.jsx. */

/* ═══════════════════════ SHARED ═══════════════════════ */
function Pagination({ cur, totalPages, start, end, total, onGo }) {
  return (
    <div className="um-pagination">
      <div className="um-pag-info">Showing {start} to {end} of {total} entries</div>
      <div className="um-pag-btns">
        <button className="um-pag-btn" disabled={cur === 1} onClick={() => onGo(cur - 1)}>Previous</button>
        {pageButtons(cur, totalPages).map((p, i) => p === '…'
          ? <button key={`e${i}`} className="um-pag-btn" disabled>…</button>
          : <button key={p} className={`um-pag-btn${p === cur ? ' active' : ''}`} onClick={() => onGo(p)}>{p}</button>)}
        <button className="um-pag-btn" disabled={cur === totalPages} onClick={() => onGo(cur + 1)}>Next</button>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSave, toast }) {
  /* Phone No. = user_Name (login id) — alag User Name field nahi. */
  /* First / Last Name alag — API ke firstName / lastName. Purane (demo) users
     ke liye fullName ko pehle space par tod kar bhar do. */
  const parts = String(user.fullName || '').trim().split(/\s+/).filter(Boolean);
  const [f, setF] = useState({
    firstName: user.firstName ?? parts[0] ?? '',
    lastName:  user.lastName ?? parts.slice(1).join(' '),
    phone: user.phone || user.userName || '', password: '', active: user.active,
    isAdmin: isHeadUser(user),
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (saving) return;
    if (!f.firstName.trim()) { toast?.('First name is required', 'warn'); return; }
    if (!f.lastName.trim()) { toast?.('Last name is required', 'warn'); return; }
    if (!f.phone.trim()) { toast?.('Phone number is required', 'warn'); return; }
    const firstName = f.firstName.trim();
    const lastName = f.lastName.trim();
    const patch = { firstName, lastName, fullName: `${firstName} ${lastName}`, userName: f.phone.trim(), phone: f.phone.trim(), active: f.active, isAdmin: !!f.isAdmin };
    if (f.password.trim()) patch.password = f.password.trim();
    setSaving(true);
    try { await onSave(user.id, patch); } finally { setSaving(false); }
  };
  return (
    <div className="um-edit-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="um-edit-modal">
        <div className="sop-modal-hdr" style={{ borderRadius: 'var(--r-xl) var(--r-xl) 0 0' }}>
          <div className="sop-modal-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-user-pen" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>Edit User</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>{user.fullName}</div></div>
          <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div style={{ padding: 22 }}>
          <div className="um-form-grid-2">
            <div className="um-field"><label className="um-label">First Name</label><input className="um-input" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Enter First Name" /></div>
            <div className="um-field"><label className="um-label">Last Name</label><input className="um-input" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Enter Last Name" /></div>
            <div className="um-field"><label className="um-label">Phone No.</label><input className="um-input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          </div>
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label">New Password <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(leave blank to keep current)</span></label>
            <div className="um-pw-wrap"><input className="um-input" type={showPw ? 'text' : 'password'} value={f.password} onChange={(e) => set('password', e.target.value)} placeholder="Enter new password" /><button className="um-pw-eye" type="button" data-tip="Show password" onClick={() => setShowPw((s) => !s)}><i className={`fa-regular ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} /></button></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            {/* "Active" checkbox hata diya — status table ke Delete (deactivate) / Activate buttons se badalta hai.
                f.active user ki maujooda value hi rehti hai, is liye Save par status nahi badalta. */}
            <div className="um-checkbox-row"><input type="checkbox" id="um-edit-admin" checked={!!f.isAdmin} onChange={(e) => set('isAdmin', e.target.checked)} /><label htmlFor="um-edit-admin">Admin</label></div>
          </div>
        </div>
        <div className="sop-modal-foot">
          <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)', boxShadow: '0 4px 14px rgba(3,105,161,.28)' }} onClick={save} disabled={saving}><i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({ user, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <div className="um-del-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="um-del-modal">
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-trash-can" /></div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Delete User?</div>
        <div style={{ fontSize: 13, color: 'var(--tm)', marginBottom: 20, lineHeight: 1.6 }}>"{user.fullName}" will be deactivated and will no longer be able to log in.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-danger" onClick={confirm} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} /> {busy ? 'Deleting…' : 'Delete User'}</button></div>
      </div>
    </div>
  );
}
