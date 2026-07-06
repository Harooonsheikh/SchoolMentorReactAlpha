import React, { useRef, useState } from 'react';
import { UM_MENUS, INITIAL_USERS, userInitials, pageButtons } from './userMgmtData';
import { INITIAL_LAUNCH, INITIAL_ERP } from './statusData';

/* ═══════════════════════════════════════════════════════════════════
   USER MANAGEMENT — Super Admin module (frontend only)

   Three tabs:
     • User Registration — add / edit / delete admin users (paginated)
     • Assign School     — assign launch / ERP schools to a user
     • User Permission   — toggle per-user menu access
   All state is in-component demo state (see ./userMgmtData). No backend.
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'reg',    name: 'User Registration', icon: 'fa-user-plus' },
  { id: 'assign', name: 'Assign School',     icon: 'fa-school' },
  { id: 'perm',   name: 'User Permission',   icon: 'fa-shield-halved' },
];

export default function UserManagement({ toast, users, setUsers, perms, setPerms }) {
  const [tab, setTab] = useState('reg');
  const [assignments, setAssignments] = useState({});   // userId → [schoolId]
  const [modal, setModal] = useState(null);
  const seq = useRef(Math.max(...INITIAL_USERS.map((u) => u.id), 0));

  const addUser = (form) => {
    setUsers((prev) => [...prev, { id: ++seq.current, ...form, pic: '' }]);
    toast?.(`${form.fullName} added successfully`, 'success');
  };
  const saveUser = (id, patch) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...patch } : u));
    setModal(null); toast?.('User updated', 'success');
  };
  const deleteUser = (id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setModal(null); toast?.('User deleted', 'info');
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
        {TABS.map((t) => <button key={t.id} className={`um-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}><i className={`fa-solid ${t.icon}`} /> {t.name}</button>)}
      </div>

      {tab === 'reg' && (
        <RegistrationTab users={users} onAdd={addUser}
          onEdit={(u) => setModal({ type: 'edit', user: u })}
          onDelete={(u) => setModal({ type: 'del', user: u })} toast={toast} />
      )}
      {tab === 'assign' && <AssignTab users={users} assignments={assignments} setAssignments={setAssignments} toast={toast} />}
      {tab === 'perm' && <PermissionTab users={users} perms={perms} setPerms={setPerms} toast={toast} />}

      {modal?.type === 'edit' && <EditUserModal user={modal.user} onClose={() => setModal(null)} onSave={saveUser} toast={toast} />}
      {modal?.type === 'del' && <DeleteUserModal user={modal.user} onClose={() => setModal(null)} onConfirm={() => deleteUser(modal.user.id)} />}
    </div>
  );
}

/* ═══════════════════════ REGISTRATION TAB ═══════════════════════ */
function RegistrationTab({ users, onAdd, onEdit, onDelete, toast }) {
  const [form, setForm] = useState({ fullName: '', userName: '', phone: '', address: '', password: '', active: true });
  const [showPw, setShowPw] = useState(false);
  const [pic, setPic] = useState('');
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!form.fullName.trim()) { toast?.('Please enter full name', 'warn'); return; }
    if (!form.userName.trim()) { toast?.('Please enter user name', 'warn'); return; }
    if (!form.phone.trim()) { toast?.('Please enter phone number', 'warn'); return; }
    if (!form.password.trim()) { toast?.('Please enter password', 'warn'); return; }
    onAdd({ fullName: form.fullName.trim(), userName: form.userName.trim(), phone: form.phone.trim(), address: form.address.trim(), password: form.password.trim(), active: form.active });
    setForm({ fullName: '', userName: '', phone: '', address: '', password: '', active: true }); setPic('');
  };

  const filtered = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search) || (u.address || '').toLowerCase().includes(search.toLowerCase()));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const cur = Math.min(page, totalPages);
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage);
  const start = total ? (cur - 1) * perPage + 1 : 0;
  const end = Math.min(cur * perPage, total);

  const onPic = (e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => setPic(ev.target.result); r.readAsDataURL(file); };

  return (
    <div className="um-panel">
      {/* Add user form */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-user-plus" /> Add User</div></div>
        <div style={{ padding: 20 }}>
          <div className="um-form-grid">
            <div className="um-field"><label className="um-label">Full Name</label><input className="um-input" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Enter Full Name" /></div>
            <div className="um-field"><label className="um-label">User Name</label><input className="um-input" value={form.userName} onChange={(e) => set('userName', e.target.value)} placeholder="Enter User Name" /></div>
            <div className="um-field"><label className="um-label">Phone No.</label><input className="um-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Enter Phone No." /></div>
            <div className="um-field"><label className="um-label">Address</label><input className="um-input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Enter Address" /></div>
            <div className="um-field"><label className="um-label">Password</label>
              <div className="um-pw-wrap"><input className="um-input" type={showPw ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Enter Password" /><button className="um-pw-eye" type="button" data-tip="Show password" onClick={() => setShowPw((s) => !s)}><i className={`fa-regular ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} /></button></div>
            </div>
            <div className="um-field"><label className="um-label">Display Picture</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input className="um-input" type="file" accept="image/*" style={{ height: 'auto', padding: '6px 10px', fontSize: 12 }} onChange={onPic} />
                <div className="um-img-preview">{pic ? <img src={pic} alt="" /> : <i className="fa-solid fa-image" />}</div>
              </div>
            </div>
          </div>
          <div className="um-checkbox-row"><input type="checkbox" id="um-active" checked={form.active} onChange={(e) => set('active', e.target.checked)} /><label htmlFor="um-active">Active</label></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn-primary" onClick={submit}><i className="fa-solid fa-user-plus" /> Add User</button></div>
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
            <thead><tr><th style={{ width: 60 }}>Sr.No</th><th>Name</th><th style={{ width: 130 }}>Phone</th><th>Address</th><th style={{ width: 70, textAlign: 'center' }}>Status</th><th style={{ width: 130, textAlign: 'center' }}>Action</th></tr></thead>
            <tbody>
              {slice.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 36, color: 'var(--tm)' }}><i className="fa-solid fa-users" style={{ fontSize: 26, opacity: 0.2, display: 'block', marginBottom: 8 }} /><div style={{ fontSize: 13, fontWeight: 700 }}>No users found</div></td></tr> : slice.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{(cur - 1) * perPage + i + 1}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div className="um-avatar">{u.pic ? <img src={u.pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : userInitials(u.fullName)}</div>
                    <div><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{u.fullName}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>@{u.userName}</div></div>
                  </div></td>
                  <td>{u.phone}</td>
                  <td style={{ fontSize: 12 }}>{u.address || '—'}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${u.active ? 'b-green' : 'b-gray'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                      <button className="btn-sm" style={{ height: 28, fontSize: 11.5 }} onClick={() => onEdit(u)}><i className="fa-solid fa-pen" /> Edit</button>
                      <button className="btn-sm" style={{ height: 28, fontSize: 11.5, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => onDelete(u)}><i className="fa-solid fa-trash-can" /> Delete</button>
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
function AssignTab({ users, assignments, setAssignments, toast }) {
  const [userId, setUserId] = useState('');
  const [schoolType, setSchoolType] = useState('launch');
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(null);   // working copy of assigned ids for selected user

  const assignedForUser = userId ? (assignments[userId] || []) : [];
  const selected = draft != null ? draft : assignedForUser;

  const onUser = (id) => { setUserId(id); setDraft(id ? (assignments[id] || []) : []); setPage(1); };
  const schools = schoolType === 'launch' ? INITIAL_LAUNCH : INITIAL_ERP;
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

  const save = () => {
    if (!userId) { toast?.('Please select a user first', 'warn'); return; }
    setAssignments((prev) => ({ ...prev, [userId]: draft || [] }));
    toast?.('School assignment saved', 'success');
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
            <button className={`um-stab${schoolType === 'launch' ? ' active' : ''}`} onClick={() => { setSchoolType('launch'); setPage(1); }}><i className="fa-solid fa-rocket" /> Launch Setup ({INITIAL_LAUNCH.length})</button>
            <button className={`um-stab${schoolType === 'erp' ? ' active' : ''}`} onClick={() => { setSchoolType('erp'); setPage(1); }}><i className="fa-solid fa-server" /> ERP ({INITIAL_ERP.length})</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--tm)' }}>Show <select className="f-input" style={{ width: 70, height: 30, display: 'inline-block', margin: '0 4px' }} value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}><option>10</option><option>25</option><option>50</option><option value={999}>All</option></select> entries</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13, color: 'var(--tm)' }}>Search:</span><div className="search-box" style={{ width: 200 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search school…" /></div></div>
          </div>

          <div className="tbl-wrap">
            <table className="um-assign-table">
              <thead><tr><th style={{ width: 60 }}>Sr #</th><th style={{ width: 50 }}><input type="checkbox" checked={allOnPage} onChange={(e) => toggleAll(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#fff', cursor: 'pointer' }} /></th><th>School Name</th></tr></thead>
              <tbody>
                {slice.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>No schools found</td></tr> : slice.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{(cur - 1) * perPage + i + 1}</td>
                    <td><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: 'pointer' }} /></td>
                    <td style={{ fontWeight: 600, color: 'var(--t1)' }}>{s.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > perPage && <Pagination cur={cur} totalPages={totalPages} start={start} end={end} total={total} onGo={setPage} />}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Assignment</button></div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ PERMISSION TAB ═══════════════════════ */
function PermissionTab({ users, perms, setPerms, toast }) {
  const [userId, setUserId] = useState('');
  const [draft, setDraft] = useState([]);

  const onUser = (id) => { setUserId(id); setDraft(id ? (perms[id] || []) : []); };
  const toggle = (menu) => setDraft((prev) => prev.includes(menu) ? prev.filter((m) => m !== menu) : [...prev, menu]);
  const allChecked = UM_MENUS.every((m) => draft.includes(m));
  const toggleAll = (checked) => setDraft(checked ? [...UM_MENUS] : []);
  const save = () => { if (!userId) { toast?.('Please select a user first', 'warn'); return; } setPerms((prev) => ({ ...prev, [userId]: draft })); toast?.('Permissions updated', 'success'); };

  return (
    <div className="um-panel">
      <div className="section-card">
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-shield-halved" /> User Permission</div></div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 6 }}><i className="fa-solid fa-user" style={{ color: 'var(--brand)', marginRight: 4 }} /> Select User</label>
            <select className="um-user-select" value={userId} onChange={(e) => onUser(e.target.value)}><option value="">Select User</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
          </div>
          <div className="tbl-wrap">
            <table className="um-perm-table">
              <thead><tr><th style={{ width: 60 }}>Sr.No</th><th>Menu</th><th style={{ width: 140 }}><label className="um-select-all-th"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /> Select All</label></th></tr></thead>
              <tbody>
                {UM_MENUS.map((menu, i) => (
                  <tr key={menu}>
                    <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: 'var(--t1)' }}>{menu}</td>
                    <td><input type="checkbox" checked={draft.includes(menu)} onChange={() => toggle(menu)} style={{ width: 16, height: 16, accentColor: 'var(--brand)', cursor: 'pointer' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Update Status</button></div>
        </div>
      </div>
    </div>
  );
}

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
  const [f, setF] = useState({ fullName: user.fullName, userName: user.userName, phone: user.phone, address: user.address || '', password: '', active: user.active });
  const [showPw, setShowPw] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.fullName.trim() || !f.phone.trim()) { toast?.('Name and phone required', 'warn'); return; }
    const patch = { fullName: f.fullName.trim(), userName: f.userName.trim(), phone: f.phone.trim(), address: f.address.trim(), active: f.active };
    if (f.password.trim()) patch.password = f.password.trim();
    onSave(user.id, patch);
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
            <div className="um-field"><label className="um-label">Full Name</label><input className="um-input" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></div>
            <div className="um-field"><label className="um-label">User Name</label><input className="um-input" value={f.userName} onChange={(e) => set('userName', e.target.value)} /></div>
            <div className="um-field"><label className="um-label">Phone No.</label><input className="um-input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div className="um-field"><label className="um-label">Address</label><input className="um-input" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
          </div>
          <div className="um-field" style={{ marginBottom: 14 }}><label className="um-label">New Password <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(leave blank to keep current)</span></label>
            <div className="um-pw-wrap"><input className="um-input" type={showPw ? 'text' : 'password'} value={f.password} onChange={(e) => set('password', e.target.value)} placeholder="Enter new password" /><button className="um-pw-eye" type="button" data-tip="Show password" onClick={() => setShowPw((s) => !s)}><i className={`fa-regular ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} /></button></div>
          </div>
          <div className="um-checkbox-row"><input type="checkbox" id="um-edit-active" checked={f.active} onChange={(e) => set('active', e.target.checked)} /><label htmlFor="um-edit-active">Active</label></div>
        </div>
        <div className="sop-modal-foot">
          <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)', boxShadow: '0 4px 14px rgba(3,105,161,.28)' }} onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({ user, onClose, onConfirm }) {
  return (
    <div className="um-del-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="um-del-modal">
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-trash-can" /></div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Delete User?</div>
        <div style={{ fontSize: 13, color: 'var(--tm)', marginBottom: 20, lineHeight: 1.6 }}>"{user.fullName}" will be permanently deleted.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete User</button></div>
      </div>
    </div>
  );
}
