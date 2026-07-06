import React, { useMemo, useRef, useState } from 'react';
import {
  TT_CATEGORIES, TT_CAT_LABEL, TT_CAT_FULL, REC_STATUS, UP_STATUS, STATUS_LABEL,
  INITIAL_RECORDED, INITIAL_UPCOMING, initials, fmtDate, embedUrl, currentYearMonth,
} from './trainingsData';

/* ═══════════════════════════════════════════════════════════════════
   TEACHER TRAININGS — Super Admin module (frontend only)

   Two tabs: Recorded Trainings (video sessions) and Upcoming Trainings
   (scheduled live sessions). Category + status filters, search, and full
   CRUD with add/edit modals, a recorded-video viewer, and delete confirm.
   All state is in-component demo state (see ./trainingsData). No backend.
   ═══════════════════════════════════════════════════════════════════ */

export default function TeacherTrainings({ toast }) {
  const [tab, setTab] = useState('recorded');
  const [recorded, setRecorded] = useState(INITIAL_RECORDED);
  const [upcoming, setUpcoming] = useState(INITIAL_UPCOMING);
  const [modal, setModal] = useState(null);
  const seq = useRef(1000);
  const nextId = () => ++seq.current;

  const stats = useMemo(() => {
    const ym = currentYearMonth();
    const monthCount = recorded.filter((r) => r.date && r.date.startsWith(ym)).length + upcoming.filter((u) => u.date && u.date.startsWith(ym)).length;
    return {
      total: recorded.length,
      published: recorded.filter((r) => r.status === 'published').length,
      upcoming: upcoming.filter((u) => u.status === 'scheduled').length,
      month: monthCount,
    };
  }, [recorded, upcoming]);

  /* ── Recorded CRUD ── */
  const saveRecorded = (form, editId) => {
    if (editId) setRecorded((prev) => prev.map((r) => r.id === editId ? { ...r, ...form } : r));
    else setRecorded((prev) => [{ id: nextId(), ...form }, ...prev]);
    setModal(null); toast?.('Recorded training saved!', 'success');
  };
  /* ── Upcoming CRUD ── */
  const saveUpcoming = (form, editId) => {
    if (editId) setUpcoming((prev) => prev.map((u) => u.id === editId ? { ...u, ...form } : u));
    else setUpcoming((prev) => [{ id: nextId(), ...form }, ...prev]);
    setModal(null); toast?.('Upcoming training saved!', 'success');
  };
  const markCompleted = (id) => {
    setUpcoming((prev) => prev.map((u) => u.id === id ? { ...u, status: 'completed' } : u));
    toast?.('Marked as completed', 'success');
  };
  const confirmDelete = ({ kind, id }) => {
    if (kind === 'recorded') setRecorded((prev) => prev.filter((r) => r.id !== id));
    else setUpcoming((prev) => prev.filter((u) => u.id !== id));
    setModal(null); toast?.('Training deleted', 'info');
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-chalkboard-user" /></div>
          <div>
            <div className="page-title">Teacher Trainings</div>
            <div className="page-sub">Manage recorded and upcoming teacher training sessions for schools.</div>
          </div>
        </div>
        <div>
          {tab === 'recorded'
            ? <button className="btn-primary" onClick={() => setModal({ type: 'recorded', item: null })}><i className="fa-solid fa-plus" /> Add Recorded Training</button>
            : <button className="btn-primary" onClick={() => setModal({ type: 'upcoming', item: null })}><i className="fa-solid fa-plus" /> Add Upcoming Training</button>}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-video" /></div><div className="stat-val">{stats.total}</div><div className="stat-lbl">Total Recorded</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-circle-check" /></div><div className="stat-val">{stats.published}</div><div className="stat-lbl">Published Videos</div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background: 'linear-gradient(135deg,#0369a1,#0284c7)' }}><i className="fa-solid fa-calendar-days" /></div><div className="stat-val">{stats.upcoming}</div><div className="stat-lbl">Upcoming Trainings</div></div>
        <div className="stat-card s-warn"><div className="stat-icon"><i className="fa-solid fa-layer-group" /></div><div className="stat-val">{TT_CATEGORIES.length}</div><div className="stat-lbl">Categories</div></div>
        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-calendar-week" /></div><div className="stat-val">{stats.month}</div><div className="stat-lbl">This Month</div></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--bl)', marginBottom: 20 }}>
        <button className={`tt-tab${tab === 'recorded' ? ' active' : ''}`} onClick={() => setTab('recorded')}><i className="fa-solid fa-video" /> Recorded Trainings</button>
        <button className={`tt-tab${tab === 'upcoming' ? ' active' : ''}`} onClick={() => setTab('upcoming')}><i className="fa-solid fa-calendar-days" /> Upcoming Trainings</button>
      </div>

      {tab === 'recorded' && (
        <RecordedPanel rows={recorded}
          onView={(r) => setModal({ type: 'view', item: r })}
          onEdit={(r) => setModal({ type: 'recorded', item: r })}
          onDelete={(r) => setModal({ type: 'del', kind: 'recorded', id: r.id, name: r.title })} />
      )}
      {tab === 'upcoming' && (
        <UpcomingPanel rows={upcoming}
          onEdit={(u) => setModal({ type: 'upcoming', item: u })}
          onDone={markCompleted}
          onDelete={(u) => setModal({ type: 'del', kind: 'upcoming', id: u.id, name: u.title })} />
      )}

      {/* ── MODALS ── */}
      {modal?.type === 'recorded' && <RecordedModal item={modal.item} onClose={() => setModal(null)} onSave={saveRecorded} toast={toast} />}
      {modal?.type === 'upcoming' && <UpcomingModal item={modal.item} onClose={() => setModal(null)} onSave={saveUpcoming} toast={toast} />}
      {modal?.type === 'view' && <ViewModal r={modal.item} onClose={() => setModal(null)} />}
      {modal?.type === 'del' && <DeleteModal name={modal.name} onClose={() => setModal(null)} onConfirm={() => confirmDelete(modal)} />}
    </div>
  );
}

/* ── shared badges ── */
function CatBadge({ cat }) { return <span className={`tt-badge tt-badge-${cat}`}>{TT_CAT_LABEL[cat] || cat}</span>; }
function StatusBadge({ status }) { return <span className={`tt-badge tt-status-${status}`}>{STATUS_LABEL[status] || status}</span>; }
function Meta({ icon, children }) { return <span style={{ fontSize: 12, color: 'var(--tm)' }}><i className={`${icon} fa-xs`} /> {children}</span>; }

/* ═══════════════════════ RECORDED PANEL ═══════════════════════ */
function RecordedPanel({ rows, onView, onEdit, onDelete }) {
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const list = rows.filter((r) =>
    (cat === 'all' || r.cat === cat) &&
    (status === 'all' || r.status === status) &&
    (!search || `${r.title}${r.trainer}${r.cat}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <button className={`tt-cat-btn${cat === 'all' ? ' active' : ''}`} onClick={() => setCat('all')}><i className="fa-solid fa-border-all" /> All</button>
        {TT_CATEGORIES.map((c) => <button key={c.id} className={`tt-cat-btn${cat === c.id ? ' active' : ''}`} onClick={() => setCat(c.id)}><i className={`fa-solid ${c.icon}`} /> {c.label}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tm)', fontSize: 13 }} />
          <input className="sop-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by topic or trainer name..." style={{ paddingLeft: 36 }} />
        </div>
        <select className="sop-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
          <option value="all">All Statuses</option>{REC_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      {list.length === 0 ? (
        <div className="tt-empty"><i className="fa-solid fa-video" /><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No Recorded Trainings Found</div><div style={{ fontSize: 13 }}>Add a new recorded training to get started.</div></div>
      ) : list.map((r) => (
        <div className="tt-card" key={r.id}>
          <div className="tt-card-avatar">{initials(r.trainer)}</div>
          <div className="tt-card-body">
            <div className="tt-card-title">{r.title}</div>
            <div className="tt-card-meta">
              <CatBadge cat={r.cat} /><StatusBadge status={r.status} />
              <Meta icon="fa-solid fa-user">{r.trainer}</Meta>
              {r.date && <Meta icon="fa-regular fa-calendar">{fmtDate(r.date)}</Meta>}
              {r.duration && <Meta icon="fa-regular fa-clock">{r.duration}</Meta>}
            </div>
            {r.desc && <div className="tt-card-desc">{r.desc}</div>}
          </div>
          <div className="tt-card-actions">
            <button className="tt-action-btn" onClick={() => onView(r)}><i className="fa-solid fa-play" /> View</button>
            <button className="tt-action-btn" onClick={() => onEdit(r)}><i className="fa-regular fa-pen-to-square" /> Edit</button>
            <button className="tt-action-btn danger" data-tip="Delete Training" data-tip-pos="left" onClick={() => onDelete(r)}><i className="fa-regular fa-trash-can" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════ UPCOMING PANEL ═══════════════════════ */
function UpcomingPanel({ rows, onEdit, onDone, onDelete }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const list = rows.filter((u) =>
    (cat === 'all' || u.cat === cat) &&
    (status === 'all' || u.status === status) &&
    (!search || `${u.title}${u.trainer}${u.cat}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tm)', fontSize: 13 }} />
          <input className="sop-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by topic or trainer name..." style={{ paddingLeft: 36 }} />
        </div>
        <select className="sop-input" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 180 }}>
          <option value="all">All Categories</option>{TT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="sop-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
          <option value="all">All Statuses</option>{UP_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      {list.length === 0 ? (
        <div className="tt-empty"><i className="fa-solid fa-calendar-days" /><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No Upcoming Trainings Found</div><div style={{ fontSize: 13 }}>Add a new upcoming training to get started.</div></div>
      ) : list.map((u) => (
        <div className="tt-card" key={u.id}>
          <div className="tt-card-avatar" style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)' }}>{initials(u.trainer)}</div>
          <div className="tt-card-body">
            <div className="tt-card-title">{u.title}</div>
            <div className="tt-card-meta">
              <CatBadge cat={u.cat} /><StatusBadge status={u.status} />
              <Meta icon="fa-solid fa-user">{u.trainer}</Meta>
              {u.date && <Meta icon="fa-regular fa-calendar">{fmtDate(u.date)}{u.time ? ` · ${u.time}` : ''}</Meta>}
              {u.duration && <Meta icon="fa-regular fa-clock">{u.duration}</Meta>}
            </div>
            {u.desc && <div className="tt-card-desc" style={{ marginBottom: 8 }}>{u.desc}</div>}
            {u.link && <a href={u.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: 'var(--info)', textDecoration: 'none' }}><i className="fa-solid fa-video" /> Join Meeting</a>}
          </div>
          <div className="tt-card-actions">
            <button className="tt-action-btn" onClick={() => onEdit(u)}><i className="fa-regular fa-pen-to-square" /> Edit</button>
            {u.status === 'scheduled' && <button className="tt-action-btn" style={{ color: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => onDone(u.id)}><i className="fa-solid fa-check" /> Done</button>}
            <button className="tt-action-btn danger" data-tip="Delete Training" data-tip-pos="left" onClick={() => onDelete(u)}><i className="fa-regular fa-trash-can" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════ MODALS ═══════════════════════ */
function Modal({ title, icon, maxWidth = 600, onClose, children, footer, headStyle, closeStyle }) {
  return (
    <div className="ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth }}>
        <div className="modal-head" style={headStyle}>
          <div><div className="modal-title" style={headStyle ? { color: '#fff' } : undefined}><i className={`fa-solid ${icon}`} /> {title}</div></div>
          <button className="modal-close" data-tip="Close" data-tip-pos="bottom" style={closeStyle} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
function Field({ label, children, full }) {
  return <div className="sop-field" style={{ margin: 0, ...(full ? { gridColumn: '1 / -1' } : {}) }}><label>{label}</label>{children}</div>;
}

function RecordedModal({ item, onClose, onSave, toast }) {
  const editing = Boolean(item);
  const [f, setF] = useState({
    cat: item?.cat || '', status: item?.status || 'draft', title: item?.title || '', trainer: item?.trainer || '',
    duration: item?.duration || '', bio: item?.bio || '', desc: item?.desc || '', date: item?.date || '', video: item?.video || '', thumb: item?.thumb || '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.title.trim() || !f.cat || !f.trainer.trim()) { toast?.('Please fill required fields (Category, Title, Trainer)', 'warn'); return; }
    onSave({ ...f, title: f.title.trim(), trainer: f.trainer.trim(), bio: f.bio.trim(), desc: f.desc.trim() }, item?.id);
  };
  return (
    <Modal title={editing ? 'Edit Recorded Training' : 'Add Recorded Training'} icon="fa-video" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Training</button></>}>
      <div className="tt-form-body">
        <div className="tt-2col">
          <Field label="Training Category *"><select className="sop-input" value={f.cat} onChange={(e) => set('cat', e.target.value)}><option value="">Select Category</option>{TT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.full}</option>)}</select></Field>
          <Field label="Status"><select className="sop-input" value={f.status} onChange={(e) => set('status', e.target.value)}>{REC_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        </div>
        <Field label="Training Topic / Title *"><input className="sop-input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Effective Lesson Planning & Instructional Design" /></Field>
        <div className="tt-2col">
          <Field label="Trainer Name *"><input className="sop-input" value={f.trainer} onChange={(e) => set('trainer', e.target.value)} placeholder="e.g. Dr. Sarah Ahmed" /></Field>
          <Field label="Duration"><input className="sop-input" value={f.duration} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 52 min" /></Field>
        </div>
        <Field label="Trainer Profile / Short Bio"><input className="sop-input" value={f.bio} onChange={(e) => set('bio', e.target.value)} placeholder="e.g. Senior Academic Consultant with 18 years of experience..." /></Field>
        <Field label="Training Description"><textarea className="sop-input" rows={3} value={f.desc} onChange={(e) => set('desc', e.target.value)} placeholder="Brief description of what this training covers..." /></Field>
        <Field label="Training Date"><input className="sop-input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Video URL / Embed Link">
          <input className="sop-input" value={f.video} onChange={(e) => set('video', e.target.value)} placeholder="e.g. https://www.youtube.com/embed/..." />
          <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 4 }}><i className="fa-solid fa-circle-info" /> Upload the screen-recorded training video that will be visible on the school side.</div>
        </Field>
        <Field label="Thumbnail / Cover Image URL"><input className="sop-input" value={f.thumb} onChange={(e) => set('thumb', e.target.value)} placeholder="e.g. https://...thumbnail.jpg" /></Field>
      </div>
    </Modal>
  );
}

function UpcomingModal({ item, onClose, onSave, toast }) {
  const editing = Boolean(item);
  const [f, setF] = useState({
    cat: item?.cat || '', status: item?.status || 'scheduled', title: item?.title || '', trainer: item?.trainer || '',
    duration: item?.duration || '', bio: item?.bio || '', desc: item?.desc || '', date: item?.date || '', time: item?.time || '', link: item?.link || '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.title.trim() || !f.cat || !f.trainer.trim()) { toast?.('Please fill required fields (Category, Title, Trainer)', 'warn'); return; }
    onSave({ ...f, title: f.title.trim(), trainer: f.trainer.trim(), bio: f.bio.trim(), desc: f.desc.trim() }, item?.id);
  };
  return (
    <Modal title={editing ? 'Edit Upcoming Training' : 'Add Upcoming Training'} icon="fa-calendar-days" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Training</button></>}>
      <div className="tt-form-body">
        <div className="tt-2col">
          <Field label="Training Category *"><select className="sop-input" value={f.cat} onChange={(e) => set('cat', e.target.value)}><option value="">Select Category</option>{TT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.full}</option>)}</select></Field>
          <Field label="Status"><select className="sop-input" value={f.status} onChange={(e) => set('status', e.target.value)}>{UP_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        </div>
        <Field label="Training Topic / Title *"><input className="sop-input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Classroom Management Strategies" /></Field>
        <div className="tt-2col">
          <Field label="Trainer Name *"><input className="sop-input" value={f.trainer} onChange={(e) => set('trainer', e.target.value)} placeholder="e.g. Usman Khalid" /></Field>
          <Field label="Duration"><input className="sop-input" value={f.duration} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 60 min" /></Field>
        </div>
        <Field label="Trainer Profile / Short Bio"><input className="sop-input" value={f.bio} onChange={(e) => set('bio', e.target.value)} placeholder="e.g. Lead Trainer, School Mentor" /></Field>
        <Field label="Training Description"><textarea className="sop-input" rows={3} value={f.desc} onChange={(e) => set('desc', e.target.value)} placeholder="What will be covered in this training..." /></Field>
        <div className="tt-2col">
          <Field label="Training Date *"><input className="sop-input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Training Time"><input className="sop-input" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></Field>
        </div>
        <Field label="Google Meet / Zoom Link">
          <input className="sop-input" value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="e.g. https://meet.google.com/abc-def-ghi" />
          <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 4 }}><i className="fa-solid fa-circle-info" /> Schools will see this training schedule and joining link on their side.</div>
        </Field>
      </div>
    </Modal>
  );
}

function ViewModal({ r, onClose }) {
  const video = embedUrl(r.video);
  return (
    <Modal title={r.title} icon="fa-video" maxWidth={700} onClose={onClose}
      headStyle={{ background: 'linear-gradient(135deg,var(--brand),var(--brand-mid))', borderRadius: 'var(--r-xl) var(--r-xl) 0 0' }}
      closeStyle={{ color: '#fff', background: 'rgba(255,255,255,.15)' }}
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="tt-form-body" style={{ gap: 16 }}>
        <div style={{ marginTop: -4 }}><span className="tt-badge" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>{TT_CAT_FULL[r.cat] || r.cat}</span></div>
        <div style={{ background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),var(--brand-mid))', color: '#fff', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(r.trainer)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{r.trainer}</div>
            <div style={{ fontSize: 12, color: 'var(--tm)' }}>{r.bio || ''}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'var(--brand-light)', color: 'var(--brand)' }}><i className="fa-regular fa-calendar" /> {fmtDate(r.date)}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(2,132,199,.1)', color: 'var(--info)' }}><i className="fa-regular fa-clock" /> {r.duration || '—'}</span>
            </div>
          </div>
        </div>
        <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#0f172a', aspectRatio: '16 / 9' }}>
          {video
            ? <iframe title="Training" width="100%" height="100%" src={video} frameBorder="0" allowFullScreen style={{ display: 'block', aspectRatio: '16 / 9' }} />
            : <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.6)', gap: 10 }}><i className="fa-solid fa-video" style={{ fontSize: 34, opacity: 0.5 }} /><div style={{ fontSize: 13 }}>No video uploaded yet</div></div>}
        </div>
        <div style={{ background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)', padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--tm)', marginBottom: 6 }}>About This Training</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{r.desc || 'No description provided.'}</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tm)', display: 'flex', alignItems: 'center', gap: 6 }}><i className="fa-solid fa-circle-info" /> <span>Recorded session from {fmtDate(r.date)}</span></div>
      </div>
    </Modal>
  );
}

function DeleteModal({ name, onClose, onConfirm }) {
  return (
    <div className="ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div style={{ padding: '32px 26px', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-trash-can" /></div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Delete Training?</div>
          <div style={{ fontSize: 13, color: 'var(--tm)', marginBottom: 20, lineHeight: 1.6 }}>"{name}" will be permanently deleted. This action cannot be undone.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button></div>
        </div>
      </div>
    </div>
  );
}
