import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';

/* ═══════════════════════════════════════════════════════════════════
   E-TUBE — school-side educational video channel

   Ported from "e tube, chat and Notification .html". Schools upload
   educational videos which are submitted to Head Office for review
   before going live on the School Mentor mobile app.

   Three tabs: Dashboard (stats + lists), Videos (table + upload/edit/
   delete), Categories (per-category breakdown). All state is in-component
   demo state — a developer wires this to the API later.
   ═══════════════════════════════════════════════════════════════════ */

const CAT_META = {
  'My School':  { icon: 'fa-school',         c: '#1E40AF', bg: 'rgba(30,58,138,.1)' },
  'Science':    { icon: 'fa-flask',          c: '#16A34A', bg: 'rgba(22,163,74,.1)' },
  'Technology': { icon: 'fa-microchip',      c: '#0284C7', bg: 'rgba(2,132,199,.1)' },
  'Business':   { icon: 'fa-briefcase',      c: '#D97706', bg: 'rgba(217,119,6,.1)' },
  'Books':      { icon: 'fa-book',           c: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
  'Universe':   { icon: 'fa-meteor',         c: '#1E40AF', bg: 'rgba(30,58,138,.1)' },
  'History':    { icon: 'fa-landmark-dome',  c: '#B45309', bg: 'rgba(180,83,9,.1)' },
};
const CATEGORIES = Object.keys(CAT_META);

const INITIAL_VIDEOS = [
  { id: 1,  title: 'School Info & Introduction', desc: 'A walkthrough of school facilities, vision and culture for new parents.', cat: 'My School', vis: 'Public', status: 'Published', date: '12 Jun 2026', views: 1240 },
  { id: 2,  title: 'Inside Our Classrooms', desc: 'How interactive learning happens day to day at our campus.', cat: 'My School', vis: 'Only My School', status: 'Published', date: '10 Jun 2026', views: 860 },
  { id: 3,  title: 'Day and Night Explained', desc: 'Why day turns into night — a simple science explainer for young learners.', cat: 'Science', vis: 'Public', status: 'Published', date: '08 Jun 2026', views: 3420 },
  { id: 4,  title: 'The Digestive System', desc: 'How the human body breaks down food, explained with visuals.', cat: 'Science', vis: 'Public', status: 'Published', date: '06 Jun 2026', views: 2110 },
  { id: 5,  title: 'States of Matter', desc: 'Solid, liquid and gas — states of matter for grade school.', cat: 'Science', vis: 'Only My School', status: 'Pending', date: '14 Jun 2026', views: 0 },
  { id: 6,  title: 'Coder vs Programmer vs Developer', desc: 'Understanding the difference between coding roles in tech.', cat: 'Technology', vis: 'Public', status: 'Published', date: '04 Jun 2026', views: 1980 },
  { id: 7,  title: 'Cyber Security Basics', desc: 'Staying safe online — passwords, phishing and privacy for students.', cat: 'Technology', vis: 'Public', status: 'Pending', date: '13 Jun 2026', views: 0 },
  { id: 8,  title: 'Introduction to E-Commerce', desc: 'How online businesses work, explained for beginners.', cat: 'Business', vis: 'Public', status: 'Published', date: '02 Jun 2026', views: 740 },
  { id: 9,  title: 'Our Solar System Tour', desc: 'A journey through the planets of our solar system.', cat: 'Universe', vis: 'Public', status: 'Pending', date: '13 Jun 2026', views: 0 },
  { id: 10, title: 'Reading Habits That Stick', desc: 'Building a daily reading routine — tips for students.', cat: 'Books', vis: 'Only My School', status: 'Published', date: '01 Jun 2026', views: 520 },
  { id: 11, title: 'Ancient Civilisations', desc: 'A short look at early human civilisations and their legacy.', cat: 'History', vis: 'Public', status: 'Rejected', date: '30 May 2026', views: 0, reject: 'Audio quality too low — please re-upload with clearer narration.' },
  { id: 12, title: 'Photosynthesis Made Simple', desc: 'How plants make their own food using sunlight.', cat: 'Science', vis: 'Public', status: 'Pending', date: '14 Jun 2026', views: 0 },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const kfmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);
const todayStr = () => { const d = new Date(); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const thisMonthYear = () => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

/* ── small presentational helpers ── */
const StatusBadge = ({ status }) => {
  const map = {
    Published: ['status-published', 'fa-circle-check', 'Published'],
    Pending:   ['status-pending', 'fa-hourglass-half', 'Pending Review'],
    Rejected:  ['status-rejected', 'fa-ban', 'Rejected'],
  };
  const [cls, icon, label] = map[status] || ['status-draft', '', 'Draft'];
  return <span className={`status-badge ${cls}`}><i className={`fa-solid ${icon}`} /> {label}</span>;
};
const VisBadge = ({ vis }) => (vis === 'Public'
  ? <span className="vis-badge vis-public"><i className="fa-solid fa-globe" /> Public</span>
  : <span className="vis-badge vis-school"><i className="fa-solid fa-school-flag" /> Only My School</span>);
const CatBadge = ({ cat }) => {
  const m = CAT_META[cat];
  return <span className="cat-badge" style={{ background: m.bg, color: m.c, borderColor: `${m.c}33` }}><i className={`fa-solid ${m.icon}`} /> {cat}</span>;
};
const Thumb = ({ cls, cat }) => {
  const m = CAT_META[cat];
  return (
    <div className={cls}>
      <div className="vid-thumb-play"><i className="fa-solid fa-play" /></div>
      <i className={`fa-solid ${m.icon}`} style={{ color: m.c, opacity: 0.55, fontSize: 16 }} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════ */
export default function ETube({ toast = () => {} }) {
  const [tab, setTab] = useState('dashboard');
  const [videos, setVideos] = useState(INITIAL_VIDEOS);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(null);   // { type, video }
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const stats = useMemo(() => {
    const my = thisMonthYear();
    return {
      total: videos.length,
      published: videos.filter(v => v.status === 'Published').length,
      pending: videos.filter(v => v.status === 'Pending').length,
      rejected: videos.filter(v => v.status === 'Rejected').length,
      privateCount: videos.filter(v => v.vis === 'Only My School').length,
      publicCount: videos.filter(v => v.vis === 'Public').length,
      views: videos.reduce((a, v) => a + v.views, 0),
      thisMonth: videos.filter(v => (v.date || '').endsWith(my)).length,
    };
  }, [videos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return videos.filter(v =>
      (!q || v.title.toLowerCase().includes(q)) &&
      (!catFilter || v.cat === catFilter) &&
      (!statusFilter || v.status === statusFilter));
  }, [videos, search, catFilter, statusFilter]);

  const recent = useMemo(() => videos.slice(0, 5), [videos]);
  const top = useMemo(() => [...videos].sort((a, b) => b.views - a.views).slice(0, 5), [videos]);
  const pending = useMemo(() => videos.filter(v => v.status === 'Pending'), [videos]);

  /* mutations */
  const addVideo = (form) => {
    const newId = videos.length ? Math.max(...videos.map(v => v.id)) + 1 : 1;
    setVideos(prev => [{ id: newId, title: form.title, desc: form.desc || 'No description provided.', cat: form.cat, vis: form.vis, status: 'Pending', date: todayStr(), views: 0 }, ...prev]);
    toast('Video submitted to Head Office for review!', 'success');
  };
  const saveVideo = (id, patch) => {
    setVideos(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));
    toast('Video updated successfully!', 'success');
  };
  const removeVideo = (id) => {
    setVideos(prev => prev.filter(v => v.id !== id));
    toast('Video deleted from your E-Tube channel.', 'info');
  };

  return (
    <>
      <style>{ETUBE_CSS}</style>

      {/* ── Page header ── */}
      <div className="et-page-header">
        <div className="et-ph-icon">
          <i className="fa-solid fa-circle-play" style={{ color: '#fff', fontSize: 20 }} />
        </div>
        <div className="et-ph-text">
          <div className="page-title et-ph-title">E-Tube</div>
          <div className="et-ph-kicker">Educational Tube</div>
          <div className="page-sub" style={{ marginTop: 4 }}>Upload educational videos for your school. Submitted videos are reviewed by Head Office before going live on the School Mentor mobile app.</div>
        </div>
        <Tooltip text="Play a short tutorial for the E-Tube module">
          <button
            className="tutorial-btn page-tutorial-btn et-ph-tutorial"
            onClick={() => setTutorialOpen(true)}
            aria-label="Open E-Tube tutorials"
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }} /></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* ── L1 tabs ── */}
      <div className="l1-tabs">
        <button className={`l1-tab${tab === 'dashboard' ? ' active' : ''}`} onClick={() => setTab('dashboard')}><i className="fa-solid fa-gauge-high" /> Dashboard</button>
        <button className={`l1-tab${tab === 'videos' ? ' active' : ''}`} onClick={() => setTab('videos')}><i className="fa-solid fa-photo-film" /> Videos</button>
        <button className={`l1-tab${tab === 'categories' ? ' active' : ''}`} onClick={() => setTab('categories')}><i className="fa-solid fa-layer-group" /> Categories</button>
      </div>

      {/* ════ DASHBOARD ════ */}
      {tab === 'dashboard' && (
        <>
          <div className="stats-strip">
            <Stat icon="fa-photo-film"      ibg="rgba(30,58,138,.1)" ic="#1E40AF" val={stats.total}            label="Total Videos" />
            <Stat icon="fa-circle-check"    ibg="rgba(22,163,74,.1)" ic="#16A34A" val={stats.published}        label="Published Videos" />
            <Stat icon="fa-hourglass-half"  ibg="rgba(217,119,6,.1)" ic="#D97706" val={stats.pending}          label="Pending Review" />
            <Stat icon="fa-lock"            ibg="rgba(124,58,237,.1)" ic="#7C3AED" val={stats.privateCount}     label="Private Videos" />
          </div>
          <div className="stats-strip">
            <Stat icon="fa-globe"           ibg="rgba(2,132,199,.1)" ic="#0284C7" val={stats.publicCount}      label="Public Videos" />
            <Stat icon="fa-eye"             ibg="rgba(30,58,138,.1)" ic="#1E40AF" val={kfmt(stats.views)}      label="Total Views" />
            <Stat icon="fa-arrow-trend-up"  ibg="rgba(0,191,165,.12)" ic="#00897B" val={stats.thisMonth}       label="This Month Uploads" />
            <Stat icon="fa-ban"             ibg="rgba(220,38,38,.08)" ic="#DC2626" val={stats.rejected}        label="Rejected Videos" />
          </div>

          <div className="dash-grid">
            <div className="section-card">
              <div className="card-header"><div className="card-header-left"><div className="card-icon" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}><i className="fa-solid fa-clock-rotate-left" /></div><div><div className="card-title">Recent Uploads</div><div className="card-sub">Latest videos added to your channel</div></div></div></div>
              <div className="mini-list">{recent.map(v => <MiniRow key={v.id} v={v} />)}</div>
            </div>
            <div className="section-card">
              <div className="card-header"><div className="card-header-left"><div className="card-icon" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}><i className="fa-solid fa-fire" /></div><div><div className="card-title">Top Performing Videos</div><div className="card-sub">Most viewed this month</div></div></div></div>
              <div className="mini-list">{top.map(v => <MiniRow key={v.id} v={v} showViews />)}</div>
            </div>
          </div>

          <div className="section-card" style={{ marginTop: 16 }}>
            <div className="card-header"><div className="card-header-left"><div className="card-icon" style={{ background: 'rgba(217,119,6,.1)', color: '#D97706' }}><i className="fa-solid fa-hourglass-half" /></div><div><div className="card-title">Videos Submitted for Review</div><div className="card-sub">These videos are awaiting approval by Head Office before going live on the School Mentor app</div></div></div></div>
            {pending.length ? (
              <div className="mini-list">{pending.map(v => <MiniRow key={v.id} v={v} submitted />)}</div>
            ) : (
              <div className="empty-state" style={{ padding: 30 }}>
                <div className="empty-icon"><i className="fa-solid fa-circle-check" /></div>
                <div className="empty-title">No videos pending</div>
                <div className="empty-sub">All your uploaded videos have been reviewed by Head Office.</div>
              </div>
            )}
            <div style={{ padding: '10px 20px 14px' }}>
              <div className="helper-text"><i className="fa-solid fa-circle-info" /> Approvals are handled by Head Office. You will be notified once a video is approved or if changes are required.</div>
            </div>
          </div>
        </>
      )}

      {/* ════ VIDEOS ════ */}
      {tab === 'videos' && (
        <>
          <div className="section-card" style={{ marginBottom: 14 }}>
            <div style={{ padding: '14px 20px' }}>
              <div className="helper-text"><i className="fa-solid fa-circle-info" /> <strong>Videos uploaded by your school will be submitted to Head Office for review.</strong>&nbsp;Approved videos will be published on the School Mentor mobile app.</div>
            </div>
          </div>
          <div className="section-card">
            <div className="toolbar">
              <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input placeholder="Search videos by title..." value={search} onChange={e => setSearch(e.target.value)} /></div>
              <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="Published">Published</option>
                <option value="Pending">Pending Review</option>
                <option value="Rejected">Rejected</option>
              </select>
              <button className="btn btn-primary" onClick={() => setModal({ type: 'upload' })}><i className="fa-solid fa-cloud-arrow-up" /> Upload Video</button>
            </div>
            <div className="vid-table-head">
              <div className="th">Thumbnail</div><div className="th">Title</div><div className="th">Category</div>
              <div className="th">Visibility</div><div className="th">Status</div><div className="th">Upload Date</div>
              <div className="th" style={{ textAlign: 'right' }}>Views</div><div className="th" style={{ textAlign: 'right' }}>Actions</div>
            </div>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><i className="fa-solid fa-photo-film" /></div>
                <div className="empty-title">No videos found</div>
                <div className="empty-sub">Try a different search or filter, or upload a new video for your school.</div>
                <button className="btn btn-primary" onClick={() => setModal({ type: 'upload' })}><i className="fa-solid fa-cloud-arrow-up" /> Upload Video</button>
              </div>
            ) : filtered.map(v => (
              <VideoRow key={v.id} v={v}
                onView={() => setModal({ type: 'view', video: v })}
                onEdit={() => setModal({ type: 'edit', video: v })}
                onDelete={() => setModal({ type: 'delete', video: v })} />
            ))}
          </div>
        </>
      )}

      {/* ════ CATEGORIES ════ */}
      {tab === 'categories' && (
        <>
          <div className="section-card" style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 20px' }}>
              <div className="helper-text"><i className="fa-solid fa-circle-info" /> These are the fixed educational categories used across E-Tube. Videos are organised under these and appear as tabs in the School Mentor mobile app.</div>
            </div>
          </div>
          <div className="cat-grid">
            {CATEGORIES.map(c => {
              const m = CAT_META[c];
              const total = videos.filter(v => v.cat === c).length;
              const pub = videos.filter(v => v.cat === c && v.status === 'Published').length;
              const pend = videos.filter(v => v.cat === c && v.status === 'Pending').length;
              return (
                <div className="cat-card" key={c}>
                  <div className="cat-card-top"><div className="cat-card-icon" style={{ background: m.bg, color: m.c }}><i className={`fa-solid ${m.icon}`} /></div><div className="cat-card-name">{c}</div></div>
                  <div className="cat-card-stats">
                    <div className="cat-stat"><div className="cat-stat-val">{total}</div><div className="cat-stat-lbl">Total</div></div>
                    <div className="cat-stat"><div className="cat-stat-val" style={{ color: '#16A34A' }}>{pub}</div><div className="cat-stat-lbl">Published</div></div>
                    <div className="cat-stat"><div className="cat-stat-val" style={{ color: '#D97706' }}>{pend}</div><div className="cat-stat-lbl">Pending</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════ MODALS ════ */}
      {modal?.type === 'upload' && <UploadModal onClose={() => setModal(null)} onSubmit={addVideo} toast={toast} />}
      {modal?.type === 'view'   && <ViewModal video={modal.video} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'edit', video: modal.video })} />}
      {modal?.type === 'edit'   && <EditModal video={modal.video} onClose={() => setModal(null)} onSave={saveVideo} />}
      {modal?.type === 'delete' && <DeleteModal video={modal.video} onClose={() => setModal(null)} onConfirm={() => { removeVideo(modal.video.id); setModal(null); }} />}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="etube"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ── Stat card ── */
function Stat({ icon, ibg, ic, val, label }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: ibg, color: ic }}><i className={`fa-solid ${icon}`} /></div>
      <div><div className="stat-val">{val}</div><div className="stat-label">{label}</div></div>
    </div>
  );
}

/* ── Mini list row (dashboard) ── */
function MiniRow({ v, showViews, submitted }) {
  return (
    <div className="mini-row">
      <Thumb cls="mini-thumb" cat={v.cat} />
      <div className="mini-body">
        <div className="mini-title">{v.title}</div>
        <div className="mini-meta">{submitted ? `${v.cat} · submitted ${v.date}` : `${v.cat} · ${v.date} · ${v.status}`}</div>
      </div>
      {showViews
        ? <div className="mini-views"><i className="fa-solid fa-eye" /> {v.views.toLocaleString()}</div>
        : <StatusBadge status={v.status} />}
    </div>
  );
}

/* ── Video row (desktop + mobile card) ── */
function VideoRow({ v, onView, onEdit, onDelete }) {
  return (
    <>
      <div className="vid-row">
        <div className="td"><Thumb cls="vid-thumb" cat={v.cat} /></div>
        <div className="td" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <div className="vid-title-txt">{v.title}</div><div className="vid-desc-txt">{v.desc}</div>
        </div>
        <div className="td"><CatBadge cat={v.cat} /></div>
        <div className="td"><VisBadge vis={v.vis} /></div>
        <div className="td"><StatusBadge status={v.status} /></div>
        <div className="td" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.date}</div>
        <div className="td" style={{ justifyContent: 'flex-end', fontWeight: 800, color: 'var(--brand-primary)' }}>{v.views.toLocaleString()}</div>
        <div className="td vid-act">
          <Tooltip text="View video details"><button className="act-btn" onClick={onView}><i className="fa-solid fa-eye" /></button></Tooltip>
          <Tooltip text="Edit video"><button className="act-btn" onClick={onEdit}><i className="fa-solid fa-pen" /></button></Tooltip>
          <Tooltip text="Delete video"><button className="act-btn danger" onClick={onDelete}><i className="fa-solid fa-trash-can" /></button></Tooltip>
        </div>
      </div>
      <div className="vid-mobile-card">
        <div className="vmc-top">
          <Thumb cls="vmc-thumb" cat={v.cat} />
          <div className="vmc-body">
            <div className="vid-title-txt" style={{ whiteSpace: 'normal' }}>{v.title}</div>
            <div className="vid-desc-txt" style={{ whiteSpace: 'normal' }}>{v.desc}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-primary)', marginTop: 5 }}><i className="fa-solid fa-eye" /> {v.views.toLocaleString()} · <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{v.date}</span></div>
          </div>
        </div>
        <div className="vmc-badges"><CatBadge cat={v.cat} /> <VisBadge vis={v.vis} /> <StatusBadge status={v.status} /></div>
        <div className="vmc-actions">
          <Tooltip text="View video details"><button className="act-btn" onClick={onView}><i className="fa-solid fa-eye" /></button></Tooltip>
          <Tooltip text="Edit video"><button className="act-btn" onClick={onEdit}><i className="fa-solid fa-pen" /></button></Tooltip>
          <Tooltip text="Delete video"><button className="act-btn danger" onClick={onDelete}><i className="fa-solid fa-trash-can" /></button></Tooltip>
        </div>
      </div>
    </>
  );
}

/* ── Modal shell ── */
function ModalShell({ size = 'modal-md', children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return createPortal(
    <div className="modal-overlay open" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size}`}>{children}</div>
    </div>,
    document.body,
  );
}

/* ── Upload modal ── */
function UploadModal({ onClose, onSubmit, toast }) {
  const [f, setF] = useState({ title: '', desc: '', cat: 'My School', vis: 'Only My School' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.title.trim()) { toast('Please enter a video title.', 'warn'); return; }
    onSubmit({ ...f, title: f.title.trim(), desc: f.desc.trim() });
    onClose();
  };
  return (
    <ModalShell size="modal-lg" onClose={onClose}>
      <div className="modal-header">
        <div><div className="modal-title"><i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: 6 }} />Upload New Video</div><div className="modal-sub">Add an educational video to your school's E-Tube channel</div></div>
        <Tooltip text="Close"><button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></Tooltip>
      </div>
      <div className="modal-body">
        <div className="helper-text warn" style={{ marginBottom: 16 }}><i className="fa-solid fa-circle-info" /> <strong>Videos uploaded by your school will be submitted to Head Office for review.</strong>&nbsp;Approved videos will be published on the School Mentor mobile app.</div>
        <div className="upload-grid">
          <div>
            <div className="form-group"><label className="form-label">Video Title <span className="req-star">*</span></label><input className="form-input" placeholder="e.g. Introduction to the Solar System" value={f.title} onChange={e => set('title', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Video Description</label><textarea className="form-textarea" placeholder="Write a short description students will see under the video..." value={f.desc} onChange={e => set('desc', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Category <span className="req-star">*</span></label>
                <select className="form-input" value={f.cat} onChange={e => set('cat', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <div className="form-group"><label className="form-label">Visibility <span className="req-star">*</span></label>
                <select className="form-input" value={f.vis} onChange={e => set('vis', e.target.value)}><option>Only My School</option><option>Public</option></select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Visibility Detail</label>
              <div className="radio-cards">
                <div className={`radio-card${f.vis === 'Only My School' ? ' selected' : ''}`} onClick={() => set('vis', 'Only My School')}><div className="radio-card-icon" style={{ background: 'rgba(124,58,237,.1)', color: '#7C3AED' }}><i className="fa-solid fa-school-flag" /></div><div><div className="radio-card-title">Only My School</div><div className="radio-card-sub">Visible to your students only</div></div></div>
                <div className={`radio-card${f.vis === 'Public' ? ' selected' : ''}`} onClick={() => set('vis', 'Public')}><div className="radio-card-icon" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}><i className="fa-solid fa-globe" /></div><div><div className="radio-card-title">Public</div><div className="radio-card-sub">Visible to all app users</div></div></div>
              </div>
            </div>
          </div>
          <div>
            <div className="form-group"><label className="form-label">Thumbnail Upload</label>
              <div className="dropzone thumb" onClick={() => toast('Thumbnail picker (demo only)', 'info')}><i className="fa-solid fa-image" /><div className="dropzone-title">Upload Thumbnail</div><div className="dropzone-sub">JPG or PNG · 1280×720 recommended</div></div>
            </div>
            <div className="form-group"><label className="form-label">Video Upload <span className="req-star">*</span></label>
              <div className="dropzone" onClick={() => toast('Video picker (demo only)', 'info')}><i className="fa-solid fa-film" /><div className="dropzone-title">Drag &amp; drop or click to upload</div><div className="dropzone-sub">MP4 / MOV / WEBM · up to 500 MB</div></div>
            </div>
            <div style={{ marginTop: 4 }}>
              <div className="form-label" style={{ marginBottom: 10 }}>Submission Flow</div>
              <div className="status-stepper">
                <div className="step done"><div className="step-dot"><i className="fa-solid fa-check" /></div><div className="step-line" /><div className="step-label">Upload</div></div>
                <div className="step done"><div className="step-dot"><i className="fa-solid fa-check" /></div><div className="step-line" /><div className="step-label">Processing</div></div>
                <div className="step current"><div className="step-dot">3</div><div className="step-line" /><div className="step-label">HO Review</div></div>
                <div className="step"><div className="step-dot">4</div><div className="step-line" /><div className="step-label">Approved</div></div>
                <div className="step"><div className="step-dot"><i className="fa-solid fa-mobile-screen" /></div><div className="step-label">Live on App</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-secondary" onClick={() => toast('Draft saved (demo)', 'info')}><i className="fa-regular fa-floppy-disk" /> Save Draft</button>
        <button className="btn btn-primary" onClick={submit}><i className="fa-solid fa-paper-plane" /> Submit for Review</button>
      </div>
    </ModalShell>
  );
}

/* ── View modal ── */
function ViewModal({ video, onClose, onEdit }) {
  return (
    <ModalShell size="modal-md" onClose={onClose}>
      <div className="modal-header"><div><div className="modal-title">{video.title}</div><div className="modal-sub">Video details</div></div><Tooltip text="Close"><button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></Tooltip></div>
      <div className="modal-body">
        <div style={{ borderRadius: 'var(--radius-lg)', height: 200, background: 'linear-gradient(135deg,#1E3A8A,#0284C7)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(0,191,165,.92)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}><i className="fa-solid fa-play" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}><CatBadge cat={video.cat} /> <VisBadge vis={video.vis} /> <StatusBadge status={video.status} /></div>
        <div className="info-grid" style={{ padding: 0, gridTemplateColumns: '1fr 1fr' }}>
          <div className="info-field"><div className="info-label"><i className="fa-solid fa-calendar-day" /> Upload Date</div><div className="info-value">{video.date}</div></div>
          <div className="info-field"><div className="info-label"><i className="fa-solid fa-eye" /> Views</div><div className="info-value">{video.views.toLocaleString()}</div></div>
        </div>
        <div className="form-group" style={{ marginTop: 14 }}><label className="form-label">Description</label><div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{video.desc}{video.reject ? `  —  Rejection reason: ${video.reject}` : ''}</div></div>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={onEdit}><i className="fa-solid fa-pen" /> Edit</button></div>
    </ModalShell>
  );
}

/* ── Edit modal ── */
function EditModal({ video, onClose, onSave }) {
  const [f, setF] = useState({ title: video.title, desc: video.desc, cat: video.cat, vis: video.vis });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <ModalShell size="modal-md" onClose={onClose}>
      <div className="modal-header"><div><div className="modal-title">Edit — {video.title}</div><div className="modal-sub">Update video details</div></div><Tooltip text="Close"><button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></Tooltip></div>
      <div className="modal-body">
        <div className="form-group"><label className="form-label">Video Title</label><input className="form-input" value={f.title} onChange={e => set('title', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={f.desc} onChange={e => set('desc', e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Category</label><select className="form-input" value={f.cat} onChange={e => set('cat', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Visibility</label><select className="form-input" value={f.vis} onChange={e => set('vis', e.target.value)}><option>Only My School</option><option>Public</option></select></div>
        </div>
        <div className="helper-text warn" style={{ marginTop: 4 }}><i className="fa-solid fa-circle-info" /> Editing a published video does not require re-review unless you change the video file.</div>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => { onSave(video.id, { title: f.title.trim() || video.title, desc: f.desc.trim(), cat: f.cat, vis: f.vis }); onClose(); }}><i className="fa-regular fa-floppy-disk" /> Save Changes</button></div>
    </ModalShell>
  );
}

/* ── Delete modal ── */
function DeleteModal({ video, onClose, onConfirm }) {
  return (
    <ModalShell size="modal-sm" onClose={onClose}>
      <div className="modal-header"><div><div className="modal-title">Delete Video</div></div><Tooltip text="Close"><button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></Tooltip></div>
      <div className="modal-body">
        <div className="confirm-icon danger"><i className="fa-solid fa-trash-can" /></div>
        <div className="confirm-title">Delete this video?</div>
        <div className="confirm-sub">This will permanently remove the video from your E-Tube channel. This action cannot be undone.</div>
        <div className="confirm-detail">
          <div className="confirm-detail-row"><i className="fa-solid fa-photo-film" /> <span>{video.title}</span></div>
          <div className="confirm-detail-row"><i className="fa-solid fa-layer-group" /> <span>{video.cat}</span></div>
        </div>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete Video</button></div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CSS — ported from the design (uses the ERP design tokens directly)
   ═══════════════════════════════════════════════════════════════════ */
const ETUBE_CSS = `
@keyframes etFadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
@keyframes etModalIn { from{opacity:0;transform:scale(.95) translateY(10px)} to{opacity:1;transform:none} }

/* Page header (class-based so it can flex/shrink on small screens) */
.et-page-header { display:flex; align-items:flex-start; gap:16px; margin-bottom:22px; }
.et-ph-icon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#1E3A8A,#2563EB); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 14px rgba(30,58,138,.3); }
.et-ph-text { flex:1; min-width:0; }
.et-ph-title { font-size:27px; font-weight:800; line-height:1.15; letter-spacing:-.03em; }
.et-ph-kicker { font-size:12px; font-weight:700; color:var(--brand-primary); letter-spacing:.04em; text-transform:uppercase; margin-top:3px; opacity:.8; }

.l1-tabs { display:flex; gap:4px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:var(--radius-lg); padding:5px; margin-bottom:20px; box-shadow:var(--shadow-sm); overflow-x:auto; flex-wrap:nowrap; }
.l1-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:11px 18px; border-radius:var(--radius-md); border:none; background:transparent; font-family:var(--font-body); font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; transition:var(--tr); white-space:nowrap; flex-shrink:0; }
.l1-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }
.l1-tab.active { background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%); color:#fff; box-shadow:0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2); }
[data-theme="dark"] .l1-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .l1-tab:hover:not(.active) { background:var(--bg-card); color:#93C5FD; }

.section-card { background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--border-light); box-shadow:var(--shadow-sm); overflow:visible; animation:etFadeSlide .25s ease both; }
.card-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid var(--border-light); background:linear-gradient(135deg,rgba(30,58,138,.03),transparent); }
.card-header-left { display:flex; align-items:center; gap:10px; }
.card-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.card-title { font-size:14px; font-weight:800; color:var(--text-primary); }
.card-sub { font-size:11px; color:var(--text-muted); margin-top:1px; }

.stats-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
.stat-card { background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:14px 16px; display:flex; align-items:center; gap:12px; box-shadow:var(--shadow-xs); transition:var(--tr); cursor:default; }
.stat-card:hover { box-shadow:var(--shadow-sm); transform:translateY(-1px); }
.stat-icon { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0; }
.stat-val { font-size:24px; font-weight:800; color:var(--text-primary); line-height:1; }
.stat-label { font-size:11px; color:var(--text-muted); margin-top:2px; font-weight:500; }

.toolbar { display:flex; align-items:center; gap:10px; padding:14px 20px; border-bottom:1px solid var(--border-light); flex-wrap:wrap; }
.search-box { display:flex; align-items:center; gap:8px; flex:1; min-width:200px; border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:0 12px; background:var(--input-bg); height:38px; transition:var(--tr); }
.search-box:focus-within { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.08); }
.search-box i { color:var(--text-muted); font-size:12px; flex-shrink:0; }
.search-box input { border:none; outline:none; background:transparent; font-family:var(--font-body); font-size:13px; color:var(--text-primary); width:100%; }
.search-box input::placeholder { color:var(--text-muted); }
.filter-select { height:38px; border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:0 10px; font-family:var(--font-body); font-size:12.5px; font-weight:600; color:var(--text-secondary); background:var(--input-bg); outline:none; cursor:pointer; transition:var(--tr); }
.filter-select:focus { border-color:var(--brand-primary); }

.btn { display:inline-flex; align-items:center; gap:7px; border-radius:var(--radius-md); font-family:var(--font-body); font-weight:600; cursor:pointer; transition:var(--tr); border:none; font-size:13px; white-space:nowrap; }
.btn-primary { background:linear-gradient(135deg,#1E40AF,#1E3A8A); color:#fff; padding:0 18px; height:38px; box-shadow:0 4px 14px rgba(30,58,138,.28); }
.btn-primary:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(30,58,138,.38); }
.btn-secondary { background:transparent; color:var(--text-secondary); border:1.5px solid var(--border-light); padding:0 16px; height:38px; }
.btn-secondary:hover { background:var(--bg-muted); border-color:var(--border-med); }
.btn-danger { background:rgba(220,38,38,.08); color:var(--error,#DC2626); border:1.5px solid rgba(220,38,38,.25); padding:0 16px; height:38px; }
.btn-danger:hover { background:rgba(220,38,38,.14); }

.status-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:var(--radius-full); font-size:10.5px; font-weight:700; white-space:nowrap; }
.status-published { background:rgba(22,163,74,.1);  color:#16A34A; border:1px solid rgba(22,163,74,.25); }
.status-pending   { background:rgba(217,119,6,.1);  color:#D97706; border:1px solid rgba(217,119,6,.25); }
.status-rejected  { background:rgba(220,38,38,.08); color:#DC2626; border:1px solid rgba(220,38,38,.2); }
.status-draft     { background:rgba(100,116,139,.1); color:#64748B; border:1px solid rgba(100,116,139,.25); }
.vis-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:var(--radius-full); font-size:10.5px; font-weight:700; white-space:nowrap; }
.vis-public { background:rgba(30,58,138,.07); color:#1E40AF; border:1px solid rgba(30,58,138,.15); }
.vis-school { background:rgba(124,58,237,.1); color:#7C3AED; border:1px solid rgba(124,58,237,.25); }
.cat-badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:var(--radius-full); font-size:10.5px; font-weight:700; border:1px solid; }

.vid-table-head { display:grid; grid-template-columns:90px 2.2fr 1fr 1.1fr 1.1fr 1fr 0.8fr 100px; background:var(--bg-muted); border-bottom:1px solid var(--border-light); padding:0 16px; }
.th { padding:10px 8px; font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:.6px; text-transform:uppercase; }
.vid-row { display:grid; grid-template-columns:90px 2.2fr 1fr 1.1fr 1.1fr 1fr 0.8fr 100px; padding:10px 16px; align-items:center; transition:var(--tr); border-bottom:1px solid var(--border-light); }
.vid-row:last-child { border-bottom:none; }
.vid-row:hover { background:rgba(30,58,138,.04); }
[data-theme="dark"] .vid-row:hover { background:rgba(59,130,246,.06); }
.vid-row .td { padding:6px 8px; font-size:12.5px; color:var(--text-secondary); display:flex; align-items:center; gap:5px; min-width:0; }
.vid-thumb { width:72px; height:46px; border-radius:8px; flex-shrink:0; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#DBEAFE,#BFDBFE); }
.vid-thumb-play { position:absolute; width:22px; height:22px; border-radius:50%; background:rgba(0,191,165,.92); color:#fff; display:flex; align-items:center; justify-content:center; font-size:9px; }
.vid-title-txt { font-size:13px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.vid-desc-txt { font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; max-width:100%; }
.vid-act { display:flex; gap:5px; justify-content:flex-end; }
.act-btn { width:30px; height:30px; border-radius:8px; border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; transition:var(--tr); }
.act-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.act-btn.danger:hover { border-color:var(--error,#DC2626); color:var(--error,#DC2626); background:rgba(220,38,38,.06); }
[data-theme="dark"] .act-btn { background:var(--bg-muted); border-color:var(--border-light); }
.vid-mobile-card { display:none; }

.info-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; padding:18px 22px; }
.info-field { background:var(--bg-muted); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:12px 14px; }
.info-label { font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; display:flex; align-items:center; gap:5px; }
.info-label i { color:var(--brand-primary); }
.info-value { font-size:14px; font-weight:700; color:var(--text-primary); }

.cat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
.cat-card { background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:16px; box-shadow:var(--shadow-xs); transition:var(--tr); }
.cat-card:hover { box-shadow:var(--shadow-sm); transform:translateY(-2px); }
.cat-card-top { display:flex; align-items:center; gap:11px; margin-bottom:14px; }
.cat-card-icon { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
.cat-card-name { font-size:14.5px; font-weight:800; color:var(--text-primary); }
.cat-card-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.cat-stat { text-align:center; background:var(--bg-muted); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:8px 4px; }
.cat-stat-val { font-size:17px; font-weight:800; color:var(--text-primary); line-height:1; }
.cat-stat-lbl { font-size:9px; font-weight:600; color:var(--text-muted); margin-top:3px; text-transform:uppercase; letter-spacing:.3px; }

.upload-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:20px; }
.dropzone { border:2px dashed var(--border-med); border-radius:var(--radius-lg); padding:30px 18px; text-align:center; cursor:pointer; transition:var(--tr); background:var(--bg-muted); }
.dropzone:hover { border-color:var(--brand-primary); background:var(--brand-light); }
.dropzone i { font-size:30px; color:var(--brand-primary); margin-bottom:10px; }
.dropzone-title { font-size:13.5px; font-weight:700; color:var(--text-primary); }
.dropzone-sub { font-size:11.5px; color:var(--text-muted); margin-top:4px; }
.dropzone.thumb { padding:18px; }
.status-stepper { display:flex; align-items:center; gap:0; margin-top:6px; }
.step { display:flex; flex-direction:column; align-items:center; flex:1; position:relative; }
.step-dot { width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; border:2px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); z-index:2; transition:var(--tr); }
.step.done .step-dot { background:linear-gradient(135deg,#16A34A,#15803D); border-color:transparent; color:#fff; }
.step.current .step-dot { background:linear-gradient(135deg,#1E40AF,#2563EB); border-color:transparent; color:#fff; box-shadow:0 0 0 4px rgba(30,58,138,.15); }
.step-line { position:absolute; top:15px; left:50%; right:-50%; height:2px; background:var(--border-light); z-index:1; }
.step.done .step-line { background:linear-gradient(90deg,#16A34A,#15803D); }
.step:last-child .step-line { display:none; }
.step-label { font-size:10px; font-weight:700; color:var(--text-muted); margin-top:7px; text-align:center; }
.step.current .step-label, .step.done .step-label { color:var(--text-secondary); }

.helper-text { display:flex; align-items:flex-start; gap:6px; padding:10px 12px; background:rgba(30,58,138,.05); border:1px solid rgba(30,58,138,.12); border-radius:var(--radius-md); font-size:11.5px; color:#1E40AF; line-height:1.5; }
.helper-text i { font-size:11px; margin-top:1px; flex-shrink:0; }
.helper-text.warn { background:rgba(217,119,6,.06); border-color:rgba(217,119,6,.2); color:#B45309; }
[data-theme="dark"] .helper-text { color:#93C5FD; }

.mini-list { display:flex; flex-direction:column; }
.mini-row { display:flex; align-items:center; gap:12px; padding:11px 20px; border-bottom:1px solid var(--border-light); transition:var(--tr); }
.mini-row:last-child { border-bottom:none; }
.mini-row:hover { background:rgba(30,58,138,.03); }
.mini-thumb { width:56px; height:36px; border-radius:7px; flex-shrink:0; overflow:hidden; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#DBEAFE,#BFDBFE); position:relative; }
.mini-body { flex:1; min-width:0; }
.mini-title { font-size:12.5px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mini-meta { font-size:10.5px; color:var(--text-muted); margin-top:1px; }
.mini-views { font-size:12px; font-weight:800; color:var(--brand-primary); display:flex; align-items:center; gap:4px; flex-shrink:0; }

.dash-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

.modal-overlay { position:fixed; inset:0; background:rgba(10,20,40,.5); backdrop-filter:blur(4px); z-index:1000; display:none; align-items:center; justify-content:center; padding:20px; }
.modal-overlay.open { display:flex; }
.modal { background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-xl); width:100%; max-height:90vh; overflow-y:auto; box-shadow:var(--shadow-xl); animation:etModalIn .28s cubic-bezier(.34,1.26,.64,1) both; }
.modal.modal-sm { max-width:460px; }
.modal.modal-md { max-width:620px; }
.modal.modal-lg { max-width:800px; }
.modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 24px 0; position:sticky; top:0; background:var(--bg-card); z-index:5; }
.modal-title { font-size:16px; font-weight:800; color:var(--brand-primary); letter-spacing:-.01em; }
.modal-sub { font-size:12px; color:var(--text-muted); margin-top:2px; }
.modal-close { width:30px; height:30px; border-radius:8px; border:none; background:var(--bg-muted); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:13px; transition:var(--tr); flex-shrink:0; }
.modal-close:hover { background:rgba(220,38,38,.1); color:var(--error,#DC2626); }
.modal-body { padding:18px 24px 24px; }
.modal-footer { display:flex; gap:9px; justify-content:flex-end; padding:16px 24px; border-top:1px solid var(--border-light); }

.form-group { display:flex; flex-direction:column; gap:5px; margin-bottom:14px; }
.form-label { font-size:11.5px; font-weight:600; color:var(--text-secondary); letter-spacing:.2px; }
.req-star { color:var(--error,#DC2626); }
.form-input { height:42px; border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:0 12px; font-family:var(--font-body); font-size:13px; color:var(--text-primary); background:var(--input-bg); outline:none; transition:var(--tr); width:100%; }
.form-input:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.1); }
.form-textarea { border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:10px 12px; font-family:var(--font-body); font-size:13px; color:var(--text-primary); background:var(--input-bg); outline:none; transition:var(--tr); width:100%; resize:vertical; min-height:80px; }
.form-textarea:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.1); }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }

.radio-cards { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.radio-card { border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:12px 14px; cursor:pointer; transition:var(--tr); display:flex; align-items:flex-start; gap:10px; background:var(--bg-card); }
.radio-card:hover { border-color:var(--border-med); }
.radio-card.selected { border-color:var(--brand-primary); background:rgba(30,58,138,.04); box-shadow:0 0 0 2px rgba(30,58,138,.08); }
.radio-card-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.radio-card-title { font-size:12.5px; font-weight:700; color:var(--text-primary); }
.radio-card-sub { font-size:10.5px; color:var(--text-muted); margin-top:2px; }

.confirm-icon { width:56px; height:56px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:22px; margin:0 auto 16px; }
.confirm-icon.danger { background:rgba(220,38,38,.1); color:#DC2626; }
.confirm-title { font-size:18px; font-weight:800; color:var(--text-primary); text-align:center; }
.confirm-sub { font-size:13px; color:var(--text-muted); text-align:center; margin-top:6px; line-height:1.6; }
.confirm-detail { background:var(--bg-muted); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:12px 16px; margin-top:16px; }
.confirm-detail-row { display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--text-secondary); margin-bottom:6px; }
.confirm-detail-row:last-child { margin-bottom:0; }
.confirm-detail-row i { color:var(--brand-primary); width:14px; flex-shrink:0; }

.empty-state { padding:50px 20px; text-align:center; }
.empty-icon { width:64px; height:64px; border-radius:20px; background:var(--bg-muted); border:2px solid var(--border-light); display:flex; align-items:center; justify-content:center; font-size:26px; color:var(--text-muted); margin:0 auto 14px; }
.empty-title { font-size:16px; font-weight:800; color:var(--text-primary); margin-bottom:6px; }
.empty-sub { font-size:13px; color:var(--text-muted); max-width:320px; margin:0 auto 18px; line-height:1.55; }

@media(max-width:1100px){
  .stats-strip { grid-template-columns:repeat(2,1fr); }
  .dash-grid { grid-template-columns:1fr; }
  .upload-grid { grid-template-columns:1fr; }
}
@media(max-width:768px){
  .l1-tabs { padding:3px; gap:2px; }
  .l1-tab { font-size:11px; padding:8px 8px; }
  .l1-tab i { display:none; }
  .stats-strip { grid-template-columns:1fr 1fr; gap:8px; }
  .vid-table-head { display:none; }
  .vid-row { display:none; }
  .vid-mobile-card { display:flex; flex-direction:column; gap:10px; padding:14px; border-bottom:1px solid var(--border-light); }
  .vmc-top { display:flex; gap:12px; }
  .vmc-thumb { width:96px; height:60px; border-radius:9px; flex-shrink:0; overflow:hidden; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#DBEAFE,#BFDBFE); position:relative; }
  .vmc-body { flex:1; min-width:0; }
  .vmc-badges { display:flex; flex-wrap:wrap; gap:6px; }
  .vmc-actions { display:flex; gap:7px; }
  .vmc-actions .act-btn { flex:1; }
  .cat-grid { grid-template-columns:1fr; }
  .modal-overlay { align-items:flex-end; padding:0; }
  .modal { border-radius:var(--radius-xl) var(--radius-xl) 0 0; max-width:100% !important; }
  .modal-body { max-height:72vh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .modal-footer { flex-wrap:wrap; }
  .modal-footer .btn { flex:1 1 auto; justify-content:center; }
  .form-row, .radio-cards { grid-template-columns:1fr; }
  .upload-grid { grid-template-columns:1fr; }

  /* Toolbar → stack each control full width so nothing is cramped/clipped */
  .toolbar { flex-direction:column; align-items:stretch; gap:9px; }
  .toolbar .search-box { min-width:0; width:100%; }
  .toolbar .filter-select { width:100%; }
  .toolbar .btn { width:100%; }

  /* View-modal detail grid → 2-up stays readable */
  .info-grid { grid-template-columns:1fr 1fr !important; padding:14px 16px; gap:10px; }
}
@media(max-width:600px){
  /* Page header: shrink title, drop the Tutorial button to its own row */
  .et-page-header { flex-wrap:wrap; gap:12px; }
  .et-ph-icon { width:46px; height:46px; }
  .et-ph-title { font-size:21px; }
  .et-ph-tutorial { order:3; width:100%; justify-content:center; }

  /* Submission-flow stepper: let it scroll rather than overlap if tight */
  .status-stepper { overflow-x:auto; gap:2px; padding-bottom:4px; -webkit-overflow-scrolling:touch; }
  .step { min-width:58px; }
}
@media(max-width:480px){
  .stats-strip { grid-template-columns:1fr 1fr; }
  .step-label { font-size:8.5px; }
  .info-grid { grid-template-columns:1fr !important; }
  .modal-body { max-height:78vh; }
}
`;
