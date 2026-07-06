import React, { useMemo, useRef, useState } from 'react';
import {
  ET_CM, catMeta, INITIAL_CATS, INITIAL_VIDS, INITIAL_REVS, INITIAL_SCHOOL_VIDS,
  UPLOAD_CATEGORIES, REJECT_REASONS, CATEGORY_COLORS, todayLabel,
} from './etubeData';

/* ═══════════════════════════════════════════════════════════════════
   E-TUBE — Super Admin module (frontend only)

   Head Office educational video studio. Five inner tabs:
     Dashboard · Reviews · Videos · Upload · Categories
   All data is in-component demo state (see ./etubeData). No backend.
   Faithful port of "Super_admin_with_ETube (17).html".
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'dashboard',  name: 'Dashboard',  icon: 'fa-gauge-high' },
  { id: 'reviews',    name: 'Reviews',    icon: 'fa-star-half-stroke', badge: true },
  { id: 'videos',     name: 'Videos',     icon: 'fa-photo-film' },
  { id: 'upload',     name: 'Upload',     icon: 'fa-cloud-arrow-up' },
  { id: 'categories', name: 'Categories', icon: 'fa-layer-group' },
];

/* ── Small presentational helpers ── */
function CatBadge({ cat }) {
  const m = catMeta(cat);
  return (
    <span className="et-cb" style={{ background: m.bg, color: m.c, borderColor: `${m.c}33` }}>
      <i className={`fa-solid ${m.i}`} /> {cat}
    </span>
  );
}
function StatusBadge({ status }) {
  if (status === 'Live') return <span className="et-sb et-live"><i className="fa-solid fa-circle-check" /> Live</span>;
  if (status === 'Processing') return <span className="et-sb et-proc"><i className="fa-solid fa-hourglass-half" /> Processing</span>;
  return <span className="et-sb et-draft">Draft</span>;
}
function SchoolStatusBadge({ status }) {
  if (status === 'Approved') return <span className="et-sb et-live"><i className="fa-solid fa-circle-check" /> Approved</span>;
  if (status === 'Pending') return <span className="et-sb et-proc"><i className="fa-solid fa-hourglass-half" /> Pending</span>;
  return <span className="et-sb et-draft"><i className="fa-solid fa-ban" /> Rejected</span>;
}
function RevBadge({ status }) {
  if (status === 'Pending') return <span className="rv-badge-pending"><i className="fa-solid fa-hourglass-half" style={{ fontSize: 8 }} /> Pending Review</span>;
  if (status === 'Approved') return <span className="rv-badge-approved"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Approved</span>;
  if (status === 'Rejected') return <span className="rv-badge-rejected"><i className="fa-solid fa-ban" style={{ fontSize: 8 }} /> Rejected</span>;
  return null;
}
function Thumb({ cls, cat, dotCls }) {
  const m = catMeta(cat);
  return (
    <div className={cls} style={{ background: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)' }}>
      <div className={dotCls}><i className="fa-solid fa-play" /></div>
      <i className={`fa-solid ${m.i}`} style={{ color: m.c, opacity: 0.5, fontSize: 12 }} />
    </div>
  );
}

export default function ETube({ toast }) {
  const [tab, setTab] = useState('dashboard');

  const [vids, setVids] = useState(INITIAL_VIDS);
  const [cats, setCats] = useState(INITIAL_CATS);
  const [revs, setRevs] = useState(INITIAL_REVS);
  const [schoolVids, setSchoolVids] = useState(INITIAL_SCHOOL_VIDS);
  const catSeq = useRef(8);
  const vidSeq = useRef(11);

  const [modal, setModal] = useState(null);   // { type, ... }

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const live = vids.filter((v) => v.status === 'Live').length;
    const proc = vids.filter((v) => v.status === 'Processing').length;
    const views = vids.reduce((a, v) => a + v.views, 0);
    const mon = vids.filter((v) => v.date.includes('Jun 2026')).length;
    const pending = revs.filter((r) => r.status === 'Pending').length;
    return {
      total: vids.length, live, proc, views, mon, pending,
      hoVids: vids.length, schVids: schoolVids.length,
      revApproved: revs.filter((r) => r.status === 'Approved').length,
      revRejected: revs.filter((r) => r.status === 'Rejected').length,
    };
  }, [vids, revs, schoolVids]);

  /* ── Video CRUD ── */
  const saveEdit = (id, patch) => {
    setVids((prev) => prev.map((v) => v.id === id ? { ...v, ...patch } : v));
    setModal(null); toast?.('Video updated', 'success');
  };
  const deleteVid = (id) => {
    setVids((prev) => prev.filter((v) => v.id !== id));
    setModal(null); toast?.('Video deleted', 'info');
  };
  const publishVid = (data) => {
    setVids((prev) => [{ id: vidSeq.current++, ...data, vis: 'all', status: 'Live', date: todayLabel(), views: 0 }, ...prev]);
    toast?.('Video published live on the School Mentor app!', 'success');
  };

  /* ── Category CRUD ── */
  const saveCat = (form, editId) => {
    if (editId) {
      setCats((prev) => prev.map((c) => c.id === editId ? { ...c, ...form } : c));
      toast?.('Category updated', 'success');
    } else {
      ET_CM[form.name] = { i: form.icon, c: form.color, bg: `${form.color}22` };
      setCats((prev) => [...prev, { id: catSeq.current++, ...form }]);
      toast?.('Category added', 'success');
    }
    setModal(null);
  };
  const deleteCat = (id) => {
    setCats((prev) => prev.filter((c) => c.id !== id));
    setModal(null); toast?.('Category deleted', 'info');
  };

  /* ── Reviews ── */
  const setRevStatus = (id, status, rejectReason) => {
    setRevs((prev) => prev.map((r) => r.id === id ? { ...r, status, ...(rejectReason ? { rejectReason } : {}) } : r));
  };
  const approveRev = (id) => {
    setRevStatus(id, 'Approved'); setModal(null); toast?.('Review approved and published!', 'success');
  };
  const rejectRev = (id, reason, note) => {
    setRevStatus(id, 'Rejected', note ? `${reason} — ${note}` : reason);
    setModal(null); toast?.('Review rejected. School has been notified.', 'info');
  };

  /* ── School videos ── */
  const deleteSchoolVid = (id) => {
    setSchoolVids((prev) => prev.filter((v) => v.id !== id));
    setModal(null); toast?.('School video deleted permanently', 'info');
  };

  const goReviews = () => setTab('reviews');
  const goUpload = () => setTab('upload');

  return (
    <div className="page-content">
      {/* PAGE HEADER */}
      <div className="et-ph">
        <div className="et-ph-icon"><i className="fa-solid fa-circle-play" style={{ color: '#fff', fontSize: 22 }} /></div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.02em' }}>E-Tube</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 3, opacity: 0.8 }}>Head Office · Educational Video Studio</div>
          <div style={{ fontSize: 13, color: 'var(--tm)', marginTop: 4 }}>Upload and publish educational videos directly to the School Mentor app. Head Office videos go live after processing — no review required.</div>
        </div>
      </div>

      {/* L1 TABS */}
      <div className="et-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`et-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <i className={`fa-solid ${t.icon}`} /> {t.name}
            {t.badge && <span className="et-tab-badge">{stats.pending}</span>}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <Dashboard stats={stats} vids={vids} revs={revs} goReviews={goReviews} setTab={setTab} />
      )}
      {tab === 'reviews' && (
        <Reviews stats={stats} revs={revs} setModal={setModal} />
      )}
      {tab === 'videos' && (
        <Videos vids={vids} schoolVids={schoolVids} setModal={setModal} goUpload={goUpload} />
      )}
      {tab === 'upload' && (
        <Upload onPublish={publishVid} toast={toast} />
      )}
      {tab === 'categories' && (
        <Categories cats={cats} vids={vids} setModal={setModal} />
      )}

      {/* ── MODALS ── */}
      {modal?.type === 'viewVid' && <ViewVideoModal vid={modal.vid} onClose={() => setModal(null)} />}
      {modal?.type === 'editVid' && <EditVideoModal vid={modal.vid} onSave={saveEdit} onClose={() => setModal(null)} />}
      {modal?.type === 'delVid' && <DeleteVideoModal vid={modal.vid} onConfirm={() => deleteVid(modal.vid.id)} onClose={() => setModal(null)} />}
      {modal?.type === 'cat' && <CategoryModal cat={modal.cat} onSave={saveCat} onClose={() => setModal(null)} />}
      {modal?.type === 'delCat' && <DeleteCategoryModal cat={modal.cat} onConfirm={() => deleteCat(modal.cat.id)} onClose={() => setModal(null)} />}
      {modal?.type === 'revDetails' && <ReviewDetailsModal rev={modal.rev} onApprove={() => setModal({ type: 'approveRev', rev: modal.rev })} onReject={() => setModal({ type: 'rejectRev', rev: modal.rev })} onClose={() => setModal(null)} />}
      {modal?.type === 'approveRev' && <ApproveModal rev={modal.rev} onConfirm={() => approveRev(modal.rev.id)} onClose={() => setModal(null)} />}
      {modal?.type === 'rejectRev' && <RejectModal rev={modal.rev} onConfirm={(reason, note) => rejectRev(modal.rev.id, reason, note)} onClose={() => setModal(null)} />}
      {modal?.type === 'schVid' && <SchoolVideoModal vid={modal.vid} onDelete={() => setModal({ type: 'delSchVid', vid: modal.vid })} onClose={() => setModal(null)} />}
      {modal?.type === 'delSchVid' && <DeleteSchoolVideoModal vid={modal.vid} onConfirm={() => deleteSchoolVid(modal.vid.id)} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ═══════════════════════ DASHBOARD ═══════════════════════ */
function Dashboard({ stats, vids, revs, goReviews, setTab }) {
  const top = [...vids].filter((v) => v.status === 'Live').sort((a, b) => b.views - a.views).slice(0, 5);
  const pending = revs.filter((r) => r.status === 'Pending');
  const openVideosHO = () => setTab('videos');
  return (
    <div className="et-panel active">
      <div className="et-stats">
        <Stat icon="fa-photo-film" iColor="#1E40AF" iBg="rgba(30,58,138,.1)" val={stats.total} lbl="Total Videos" />
        <Stat icon="fa-circle-check" iColor="#16A34A" iBg="rgba(22,163,74,.1)" val={stats.live} lbl="Live Videos" />
        <Stat icon="fa-hourglass-half" iColor="#0284C7" iBg="rgba(2,132,199,.1)" val={stats.proc} lbl="Processing" />
        <Stat icon="fa-eye" iColor="#1E40AF" iBg="rgba(30,58,138,.1)" val={stats.views.toLocaleString()} lbl="Total Views" />
      </div>

      <div className="et-stats">
        <Stat icon="fa-building-shield" iColor="#1E40AF" iBg="rgba(30,58,138,.1)" val={stats.hoVids} lbl="School Mentor Videos" hint="Click to view →" hintColor="var(--brand)" onClick={openVideosHO} />
        <Stat icon="fa-school" iColor="#7C3AED" iBg="rgba(124,58,237,.1)" val={stats.schVids} lbl="Other Schools Videos" hint="Click to view →" hintColor="#7C3AED" onClick={openVideosHO} />
        <Stat icon="fa-arrow-trend-up" iColor="#00897B" iBg="rgba(0,191,165,.12)" val={stats.mon} lbl="This Month" />
        <Stat icon="fa-hourglass-half" iColor="#D97706" iBg="rgba(217,119,6,.1)" val={stats.pending} lbl="Pending Reviews" hint="Click to review →" hintColor="#D97706" onClick={goReviews} />
      </div>

      {/* Top Performing */}
      <div className="et-card" style={{ marginBottom: 16 }}>
        <div className="et-ch"><div className="et-chl"><div className="et-ci" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}><i className="fa-solid fa-fire" /></div><div><div className="et-ct">Top Performing Videos</div><div className="et-cs">Most viewed this month</div></div></div></div>
        <div className="et-ml">
          {top.length === 0 ? <div className="et-empty"><div className="et-es">No live videos yet.</div></div> : top.map((v) => (
            <div className="et-mr" key={v.id}>
              <Thumb cls="et-mt" cat={v.cat} dotCls="et-mp" />
              <div className="et-mb"><div className="et-mtitle">{v.title}</div><div className="et-mmeta">{v.cat} · {v.date}</div></div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}><i className="fa-solid fa-eye" /> {v.views.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Videos Awaiting Review */}
      <div className="et-card">
        <div className="et-ch">
          <div className="et-chl"><div className="et-ci" style={{ background: 'rgba(217,119,6,.1)', color: '#D97706' }}><i className="fa-solid fa-shield-halved" /></div><div><div className="et-ct">Videos Awaiting Review</div><div className="et-cs">School-submitted videos pending your approval</div></div></div>
          <button className="btn-secondary" style={{ height: 30 }} onClick={goReviews}><i className="fa-solid fa-arrow-right" /> Go to Reviews</button>
        </div>
        <div className="et-ml">
          {pending.length === 0 ? (
            <div className="et-empty"><div className="et-ei"><i className="fa-solid fa-circle-check" /></div><div className="et-et">No pending reviews</div><div className="et-es">All school video submissions have been reviewed.</div></div>
          ) : pending.map((r) => {
            const m = catMeta(r.cat);
            return (
              <div className="et-mr" key={r.id}>
                <div className="et-mt" style={{ background: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)' }}>
                  <div className="et-mp"><i className="fa-solid fa-play" /></div>
                  <i className={`fa-solid ${m.i}`} style={{ color: m.c, opacity: 0.45, fontSize: 11 }} />
                </div>
                <div className="et-mb">
                  <div className="et-mtitle">{r.vt}</div>
                  <div className="et-mmeta"><span className="rv-school" style={{ fontSize: 9.5 }}><i className="fa-solid fa-school" style={{ fontSize: 8 }} /> {r.school}</span> &nbsp;·&nbsp; {r.cat} &nbsp;·&nbsp; {r.date}</div>
                </div>
                <button className="btn-secondary" style={{ height: 30, flexShrink: 0 }} onClick={goReviews}><i className="fa-solid fa-eye" /> View</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, iColor, iBg, val, lbl, hint, hintColor, onClick }) {
  return (
    <div className="et-stat" style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
      <div className="et-si" style={{ background: iBg, color: iColor }}><i className={`fa-solid ${icon}`} /></div>
      <div>
        <div className="et-sv">{val}</div>
        <div className="et-sl">{lbl}</div>
        {hint && <div style={{ fontSize: 9, color: hintColor, fontWeight: 600, marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════ REVIEWS ═══════════════════════ */
function Reviews({ stats, revs, setModal }) {
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');
  const list = revs.filter((r) =>
    (!search || r.school.toLowerCase().includes(search.toLowerCase()) || r.vt.toLowerCase().includes(search.toLowerCase()) || r.txt.toLowerCase().includes(search.toLowerCase())) &&
    (!statusF || r.status === statusF));
  return (
    <div className="et-panel active">
      <div className="rv-stats">
        <RvStat icon="fa-hourglass-half" iColor="#D97706" iBg="rgba(217,119,6,.1)" val={stats.pending} lbl="Awaiting Review" />
        <RvStat icon="fa-circle-check" iColor="#16A34A" iBg="rgba(22,163,74,.1)" val={stats.revApproved} lbl="Approved" />
        <RvStat icon="fa-ban" iColor="#DC2626" iBg="rgba(220,38,38,.08)" val={stats.revRejected} lbl="Rejected" />
      </div>

      <div className="et-card">
        <div className="et-ch">
          <div className="et-chl"><div className="et-ci" style={{ background: 'rgba(217,119,6,.1)', color: '#D97706' }}><i className="fa-solid fa-shield-halved" /></div><div><div className="et-ct">Reviews Awaiting Approval</div><div className="et-cs">Approve to acknowledge, or reject with a reason</div></div></div>
        </div>

        <div className="et-toolbar">
          <div className="et-srch" style={{ flex: 1 }}>
            <i className="fa-solid fa-magnifying-glass" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by school, video title, review text…" />
          </div>
          <select className="et-sel" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="">All Status</option>
            <option value="Pending">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="rv-list">
          {list.length === 0 ? (
            <div className="et-empty"><div className="et-ei"><i className="fa-solid fa-circle-check" /></div><div className="et-et">{revs.length ? 'No results found' : 'No reviews yet'}</div><div className="et-es">{revs.length ? 'Try a different search or filter.' : 'School reviews will appear here once submitted.'}</div></div>
          ) : list.map((r) => {
            const m = catMeta(r.cat);
            return (
              <div className="rv-item" key={r.id}>
                <div className="rv-thumb">
                  <div className="rv-play"><i className="fa-solid fa-play" /></div>
                  <i className={`fa-solid ${m.i}`} style={{ color: m.c, opacity: 0.4, fontSize: 18 }} />
                </div>
                <div className="rv-body">
                  <div className="rv-title">{r.vt}</div>
                  <div className="rv-meta">
                    <span><i className="fa-solid fa-layer-group" style={{ fontSize: 9 }} /> {r.cat}</span>
                    <span className="rv-school"><i className="fa-solid fa-school" style={{ fontSize: 9 }} /> {r.school}</span>
                    <span><i className="fa-solid fa-user" style={{ fontSize: 9 }} /> {r.by}</span>
                    <span><i className="fa-solid fa-calendar-day" style={{ fontSize: 9 }} /> {r.date}</span>
                    <RevBadge status={r.status} />
                  </div>
                  <div className="rv-desc"><i className="fa-solid fa-film" style={{ fontSize: 9, color: 'var(--brand)', opacity: 0.65, flexShrink: 0, marginTop: 2 }} /><span>{r.vd}</span></div>
                  <div className="rv-comment"><i className="fa-solid fa-quote-left" style={{ fontSize: 9, color: 'var(--brand)', opacity: 0.5, flexShrink: 0, marginTop: 3 }} /><span>{r.txt}</span></div>
                </div>
                <div className="rv-actions">
                  <button className="rv-btn rv-btn-det" onClick={() => setModal({ type: 'revDetails', rev: r })}><i className="fa-solid fa-eye" /> Details</button>
                  <button className="rv-btn rv-btn-approve" disabled={r.status === 'Approved'} onClick={() => setModal({ type: 'approveRev', rev: r })}><i className="fa-solid fa-check" /> Approve</button>
                  <button className="rv-btn rv-btn-reject" disabled={r.status === 'Rejected'} onClick={() => setModal({ type: 'rejectRev', rev: r })}><i className="fa-solid fa-ban" /> Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function RvStat({ icon, iColor, iBg, val, lbl }) {
  return (
    <div className="rv-stat">
      <div className="rv-stat-icon" style={{ background: iBg, color: iColor }}><i className={`fa-solid ${icon}`} /></div>
      <div><div className="rv-stat-val">{val}</div><div className="rv-stat-lbl">{lbl}</div></div>
    </div>
  );
}

/* ═══════════════════════ VIDEOS ═══════════════════════ */
function Videos({ vids, schoolVids, setModal, goUpload }) {
  const [sub, setSub] = useState('ho');     // 'ho' | 'schools'

  /* HO filters */
  const [hSearch, setHSearch] = useState('');
  const [hCat, setHCat] = useState('');
  const [hStatus, setHStatus] = useState('');
  const hoRows = vids.filter((v) =>
    (!hSearch || v.title.toLowerCase().includes(hSearch.toLowerCase()) || v.desc.toLowerCase().includes(hSearch.toLowerCase())) &&
    (!hCat || v.cat === hCat) && (!hStatus || v.status === hStatus));

  /* School filters */
  const [sSearch, setSSearch] = useState('');
  const [sCat, setSCat] = useState('');
  const [sStatus, setSStatus] = useState('');
  const schRows = schoolVids.filter((v) =>
    (!sSearch || v.title.toLowerCase().includes(sSearch.toLowerCase()) || v.school.toLowerCase().includes(sSearch.toLowerCase()) || v.desc.toLowerCase().includes(sSearch.toLowerCase())) &&
    (!sCat || v.cat === sCat) && (!sStatus || v.status === sStatus));

  return (
    <div className="et-panel active">
      <div className="et-vid-subtabs">
        <button className={`et-vid-stab${sub === 'ho' ? ' active' : ''}`} onClick={() => setSub('ho')}><i className="fa-solid fa-building-shield" /> School Mentor's Videos</button>
        <button className={`et-vid-stab${sub === 'schools' ? ' active' : ''}`} onClick={() => setSub('schools')}><i className="fa-solid fa-school" /> Other Schools</button>
      </div>

      {sub === 'ho' && (
        <div className="et-card">
          <div className="et-toolbar">
            <div className="et-srch"><i className="fa-solid fa-magnifying-glass" /><input value={hSearch} onChange={(e) => setHSearch(e.target.value)} placeholder="Search by title or description…" /></div>
            <select className="et-sel" value={hCat} onChange={(e) => setHCat(e.target.value)}><option value="">All Categories</option>{UPLOAD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="et-sel" value={hStatus} onChange={(e) => setHStatus(e.target.value)}><option value="">All Status</option><option value="Live">Live</option><option value="Processing">Processing</option><option value="Draft">Draft</option></select>
            <button className="btn-primary" onClick={goUpload}><i className="fa-solid fa-cloud-arrow-up" /> Upload</button>
          </div>
          <div className="et-vth"><div className="et-th">Thumb</div><div className="et-th">Title &amp; Desc</div><div className="et-th">Category</div><div className="et-th">Status</div><div className="et-th" style={{ textAlign: 'right' }}>Views</div><div className="et-th" style={{ textAlign: 'right' }}>Actions</div></div>
          <div>
            {hoRows.length === 0 ? (
              <div className="et-empty"><div className="et-ei"><i className="fa-solid fa-photo-film" /></div><div className="et-et">No videos found</div><div className="et-es">Try a different filter or upload a new video.</div><button className="btn-primary" style={{ marginTop: 12 }} onClick={goUpload}><i className="fa-solid fa-cloud-arrow-up" /> Upload Video</button></div>
            ) : hoRows.map((v) => (
              <div className="et-vr" key={v.id}>
                <div className="et-td"><Thumb cls="et-vth2" cat={v.cat} dotCls="et-vp" /></div>
                <div className="et-td" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}><div className="et-vtt">{v.title}</div><div className="et-vtd">{v.desc}</div></div>
                <div className="et-td"><CatBadge cat={v.cat} /></div>
                <div className="et-td"><StatusBadge status={v.status} /></div>
                <div className="et-td" style={{ justifyContent: 'flex-end', fontWeight: 800, color: 'var(--brand)' }}>{v.views.toLocaleString()}</div>
                <div className="et-td et-va">
                  <button className="et-ab" data-tip="View" data-tip-pos="left" onClick={() => setModal({ type: 'viewVid', vid: v })}><i className="fa-solid fa-eye" /></button>
                  <button className="et-ab" data-tip="Edit" data-tip-pos="left" onClick={() => setModal({ type: 'editVid', vid: v })}><i className="fa-solid fa-pen" /></button>
                  <button className="et-ab d" data-tip="Delete" data-tip-pos="left" onClick={() => setModal({ type: 'delVid', vid: v })}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === 'schools' && (
        <div className="et-card">
          <div className="et-toolbar">
            <div className="et-srch" style={{ flex: 1.5 }}><i className="fa-solid fa-magnifying-glass" /><input value={sSearch} onChange={(e) => setSSearch(e.target.value)} placeholder="Search by school name, video title…" /></div>
            <select className="et-sel" value={sCat} onChange={(e) => setSCat(e.target.value)}><option value="">All Categories</option>{UPLOAD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="et-sel" value={sStatus} onChange={(e) => setSStatus(e.target.value)}><option value="">All Status</option><option value="Approved">Approved</option><option value="Pending">Pending</option><option value="Rejected">Rejected</option></select>
          </div>
          <div className="et-vth" style={{ gridTemplateColumns: '80px 2fr 1.2fr 1fr 1fr 80px 90px' }}>
            <div className="et-th">Thumb</div><div className="et-th">Title &amp; Desc</div><div className="et-th">School</div><div className="et-th">Category</div><div className="et-th">Status</div><div className="et-th" style={{ textAlign: 'right' }}>Views</div><div className="et-th" style={{ textAlign: 'right' }}>Actions</div>
          </div>
          <div>
            {schRows.length === 0 ? (
              <div className="et-empty"><div className="et-ei"><i className="fa-solid fa-school" /></div><div className="et-et">No school videos found</div><div className="et-es">Approved videos from member schools will appear here.</div></div>
            ) : schRows.map((v) => (
              <div className="et-vr" key={v.id} style={{ gridTemplateColumns: '80px 2fr 1.2fr 1fr 1fr 80px 90px' }}>
                <div className="et-td"><Thumb cls="et-vth2" cat={v.cat} dotCls="et-vp" /></div>
                <div className="et-td" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                  <div className="et-vtt">{v.title}</div><div className="et-vtd">{v.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 2 }}><i className="fa-solid fa-user" style={{ fontSize: 8 }} /> {v.by}</div>
                </div>
                <div className="et-td"><span className="rv-school" style={{ fontSize: 10 }}><i className="fa-solid fa-school" style={{ fontSize: 9 }} /> {v.school}</span></div>
                <div className="et-td"><CatBadge cat={v.cat} /></div>
                <div className="et-td"><SchoolStatusBadge status={v.status} /></div>
                <div className="et-td" style={{ justifyContent: 'flex-end', fontWeight: 800, color: 'var(--brand)' }}>{v.views.toLocaleString()}</div>
                <div className="et-td et-va">
                  <button className="et-ab" data-tip="View" data-tip-pos="left" onClick={() => setModal({ type: 'schVid', vid: v })}><i className="fa-solid fa-eye" /></button>
                  <button className="et-ab d" data-tip="Delete" data-tip-pos="left" onClick={() => setModal({ type: 'delSchVid', vid: v })}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ UPLOAD ═══════════════════════ */
function Upload({ onPublish, toast }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('School Mentor');
  const [phase, setPhase] = useState('idle');   // idle | uploading | processing | ready | publishing | published
  const timers = useRef([]);

  const after = (ms, fn) => { const id = setTimeout(fn, ms); timers.current.push(id); };

  const stepState = (n) => {
    // returns 'done' | 'cur' | ''
    const map = {
      idle:       { 1: 'done', 2: 'cur', 3: '', 4: '' },
      uploading:  { 1: 'done', 2: 'cur', 3: '', 4: '' },
      processing: { 1: 'done', 2: 'cur', 3: '', 4: '' },
      ready:      { 1: 'done', 2: 'done', 3: 'cur', 4: '' },
      publishing: { 1: 'done', 2: 'done', 3: 'done', 4: 'cur' },
      published:  { 1: 'done', 2: 'done', 3: 'done', 4: 'done' },
    };
    return map[phase][n] || '';
  };

  const doUpload = () => {
    if (!title.trim()) { toast?.('Please enter a video title', 'warn'); return; }
    setPhase('uploading');
    after(2000, () => {
      setPhase('processing');
      after(3000, () => setPhase('ready'));
    });
  };

  const doPublish = () => {
    onPublish({ title: title.trim() || 'Untitled Video', desc: desc.trim() || 'No description.', cat });
    setPhase('publishing');
    after(1200, () => {
      setPhase('idle'); setTitle(''); setDesc('');
    });
  };

  const dot = (n, content) => {
    const st = stepState(n);
    return (
      <div className={`et-step${st ? ` ${st}` : ''}`}>
        <div className="et-dot">{st === 'done' ? <i className="fa-solid fa-check" /> : n === 4 ? <i className="fa-solid fa-mobile-screen" /> : n}</div>
        {n !== 4 && <div className="et-line" />}
        <div className="et-slbl">{['Upload', 'Processing', 'Publish', 'Live on App'][n - 1]}</div>
      </div>
    );
  };

  const uploading = phase === 'uploading' || phase === 'processing';
  const showPub = phase === 'ready' || phase === 'publishing';

  return (
    <div className="et-panel active">
      <div className="et-card">
        <div className="et-ch"><div className="et-chl"><div className="et-ci" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}><i className="fa-solid fa-cloud-arrow-up" /></div><div><div className="et-ct">Upload New Video</div><div className="et-cs">Videos go live automatically after processing — no review needed</div></div></div></div>
        <div className="et-ug">
          <div>
            <div className="et-hlp"><i className="fa-solid fa-circle-info" style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 1 }} /> Head Office videos are published directly after processing. No approval workflow.</div>
            <div className="et-fg"><label className="et-fl">Video Title <span style={{ color: 'var(--err)' }}>*</span></label><input className="et-fi" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to the Solar System" /></div>
            <div className="et-fg"><label className="et-fl">Description</label><textarea className="et-fta" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description students will see below the video…" /></div>
            <div className="et-fg"><label className="et-fl">Category <span style={{ color: 'var(--err)' }}>*</span></label><select className="et-fi" value={cat} onChange={(e) => setCat(e.target.value)}>{UPLOAD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div>
            <div className="et-fg"><label className="et-fl">Thumbnail</label><div className="et-dz" onClick={() => toast?.('Thumbnail picker — demo', 'info')}><i className="fa-solid fa-image" /><div className="et-dz-t">Upload Thumbnail</div><div className="et-dz-s">JPG or PNG · 1280×720</div></div></div>
            <div className="et-fg"><label className="et-fl">Video File <span style={{ color: 'var(--err)' }}>*</span></label><div className="et-dz" onClick={() => toast?.('Video picker — demo', 'info')}><i className="fa-solid fa-film" /><div className="et-dz-t">Drag &amp; drop or click to upload</div><div className="et-dz-s">MP4 / MOV / WEBM · max 500 MB</div></div></div>
            <div className="et-fg"><label className="et-fl" style={{ marginBottom: 8 }}>HO Publish Flow</label>
              <div className="et-step-wrap">{dot(1)}{dot(2)}{dot(3)}{dot(4)}</div>
            </div>
            {!showPub && (
              <button className="et-up-btn" disabled={uploading} onClick={doUpload}>
                {uploading ? <><i className="fa-solid fa-spinner fa-spin" /> {phase === 'processing' ? 'Uploaded' : 'Uploading…'}</> : <><i className="fa-solid fa-cloud-arrow-up" /> Upload Video</>}
              </button>
            )}
            {showPub && (
              <button className="et-pub-btn" disabled={phase === 'publishing'} onClick={doPublish}>
                {phase === 'publishing' ? <><i className="fa-solid fa-check" /> Published!</> : <><i className="fa-solid fa-rocket" /> Publish Live</>}
              </button>
            )}
            {phase === 'processing' && (
              <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 'var(--r-md)', background: 'rgba(2,132,199,.08)', border: '1px solid rgba(2,132,199,.2)', fontSize: 12, color: '#0284C7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}><i className="fa-solid fa-spinner fa-spin" /> Processing video… please wait.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ CATEGORIES ═══════════════════════ */
function Categories({ cats, vids, setModal }) {
  return (
    <div className="et-panel active">
      <div className="et-card">
        <div className="et-ch">
          <div className="et-chl"><div className="et-ci" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}><i className="fa-solid fa-layer-group" /></div><div><div className="et-ct">Video Categories</div><div className="et-cs">These appear as tabs in the School Mentor mobile app</div></div></div>
          <button className="btn-primary" onClick={() => setModal({ type: 'cat', cat: null })}><i className="fa-solid fa-plus" /> Add Category</button>
        </div>
        <div className="et-cg">
          {cats.map((c) => {
            const tot = vids.filter((v) => v.cat === c.name).length;
            const lv = vids.filter((v) => v.cat === c.name && v.status === 'Live').length;
            const pr = vids.filter((v) => v.cat === c.name && v.status === 'Processing').length;
            return (
              <div className="et-cc" key={c.id}>
                <div className="et-ctx"><div className="et-cci" style={{ background: `${c.color}22`, color: c.color }}><i className={`fa-solid ${c.icon}`} /></div><div><div className="et-ccn">{c.name}</div><div className="et-ccd">{c.desc || '—'}</div></div></div>
                <div className="et-ccs">
                  <div className="et-cst"><div className="et-csv">{tot}</div><div className="et-csl">Total</div></div>
                  <div className="et-cst"><div className="et-csv" style={{ color: '#16A34A' }}>{lv}</div><div className="et-csl">Live</div></div>
                  <div className="et-cst"><div className="et-csv" style={{ color: '#0284C7' }}>{pr}</div><div className="et-csl">Proc</div></div>
                </div>
                <div className="et-cca">
                  <button className="et-cab" onClick={() => setModal({ type: 'cat', cat: c })}><i className="fa-solid fa-pen" /> Edit</button>
                  <button className="et-cab d" onClick={() => setModal({ type: 'delCat', cat: c })}><i className="fa-solid fa-trash-can" /> Delete</button>
                </div>
              </div>
            );
          })}
          <div className="et-add-cc" onClick={() => setModal({ type: 'cat', cat: null })}><i className="fa-solid fa-plus" /><span>Add New Category</span></div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ MODALS ═══════════════════════ */
function Modal({ title, sub, icon, iconColor, titleColor, maxWidth, onClose, footer, children, bodyStyle }) {
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-head">
          <div>
            <div className="modal-title" style={titleColor ? { color: titleColor } : undefined}>
              {icon && <i className={`fa-solid ${icon}`} style={iconColor ? { color: iconColor } : undefined} />} {title}
            </div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button className="modal-close" data-tip="Close" data-tip-pos="bottom" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="modal-body" style={bodyStyle}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function ViewVideoModal({ vid, onClose }) {
  return (
    <Modal title={vid.title} sub="Video details" icon="fa-circle-play" onClose={onClose}
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div style={{ borderRadius: 'var(--r-lg)', height: 160, background: 'linear-gradient(135deg,#1E3A8A,#0284C7)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(0,191,165,.9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}><i className="fa-solid fa-play" /></div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}><CatBadge cat={vid.cat} /> <StatusBadge status={vid.status} /></div>
      <div className="modal-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="f-field"><label className="f-label">Upload Date</label><input className="f-input" readOnly value={vid.date} /></div>
        <div className="f-field"><label className="f-label">Views</label><input className="f-input" readOnly value={vid.views.toLocaleString()} /></div>
      </div>
      <div className="f-field" style={{ marginTop: 12 }}><label className="f-label">Description</label><div style={{ fontSize: 13, color: 'var(--t2)', padding: 10, borderRadius: 'var(--r-md)', background: 'var(--muted)', border: '1px solid var(--bl)', lineHeight: 1.6, marginTop: 4 }}>{vid.desc}</div></div>
    </Modal>
  );
}

function EditVideoModal({ vid, onSave, onClose }) {
  const [form, setForm] = useState({ title: vid.title, desc: vid.desc, cat: vid.cat });
  return (
    <Modal title="Edit Video" icon="fa-pen" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => onSave(vid.id, { title: form.title.trim() || vid.title, desc: form.desc.trim(), cat: form.cat })}><i className="fa-solid fa-floppy-disk" /> Save</button></>}>
      <div className="f-field"><label className="f-label">Title</label><input className="f-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="f-field" style={{ marginTop: 12 }}><label className="f-label">Description</label><textarea className="f-textarea" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></div>
      <div className="f-field" style={{ marginTop: 12 }}><label className="f-label">Category</label><select className="f-input" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>{UPLOAD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
    </Modal>
  );
}

function DeleteVideoModal({ vid, onConfirm, onClose }) {
  return (
    <Modal title="Delete Video" icon="fa-trash-can" iconColor="var(--err)" maxWidth={460} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button></>}
      bodyStyle={{ textAlign: 'center', padding: '26px 22px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(220,38,38,.1)', color: 'var(--err)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 12px' }}><i className="fa-solid fa-trash-can" /></div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>Delete this video?</div>
      <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6 }}>This will permanently remove the video from E-Tube and the app.</div>
      <div style={{ marginTop: 12, padding: '11px 13px', background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)', textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{vid.title}</div>
        <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{vid.cat} · {vid.status}</div>
      </div>
    </Modal>
  );
}

function CategoryModal({ cat, onSave, onClose }) {
  const editing = Boolean(cat);
  const [form, setForm] = useState({
    name: cat?.name || '', desc: cat?.desc || '',
    icon: cat?.icon || 'fa-layer-group', color: cat?.color || '#1E40AF',
  });
  const submit = () => {
    if (!form.name.trim()) return;
    onSave({ name: form.name.trim(), desc: form.desc.trim(), icon: form.icon.trim() || 'fa-layer-group', color: form.color }, cat?.id);
  };
  return (
    <Modal title={editing ? 'Edit Category' : 'Add Category'} sub={editing ? 'Update category details' : 'Create a new E-Tube category'}
      icon={editing ? 'fa-pen' : 'fa-layer-group'} maxWidth={500} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}><i className="fa-solid fa-floppy-disk" /> {editing ? 'Update' : 'Save Category'}</button></>}>
      <div className="f-field"><label className="f-label">Category Name <span style={{ color: 'var(--err)' }}>*</span></label><input className="f-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" style={{ marginTop: 4 }} /></div>
      <div className="f-field" style={{ marginTop: 12 }}><label className="f-label">Description</label><textarea className="f-textarea" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Short description…" style={{ marginTop: 4, minHeight: 65 }} /></div>
      <div className="modal-grid" style={{ marginTop: 12 }}>
        <div className="f-field"><label className="f-label">Icon (FA class)</label><input className="f-input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="fa-book-open" style={{ marginTop: 4 }} /></div>
        <div className="f-field"><label className="f-label">Color</label><select className="f-input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ marginTop: 4 }}>{CATEGORY_COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
      </div>
    </Modal>
  );
}

function DeleteCategoryModal({ cat, onConfirm, onClose }) {
  return (
    <Modal title="Delete Category" icon="fa-trash-can" iconColor="var(--err)" maxWidth={420} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button></>}
      bodyStyle={{ textAlign: 'center', padding: 22 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(220,38,38,.1)', color: 'var(--err)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto 10px' }}><i className="fa-solid fa-trash-can" /></div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>Delete "{cat.name}"?</div>
      <div style={{ fontSize: 12.5, color: 'var(--tm)', lineHeight: 1.6 }}>Existing videos will not be deleted but will lose this category assignment.</div>
    </Modal>
  );
}

function ReviewDetailsModal({ rev, onApprove, onReject, onClose }) {
  const m = catMeta(rev.cat);
  return (
    <Modal title={rev.vt} sub="Video details" maxWidth={600} onClose={onClose}
      bodyStyle={{ padding: '16px 22px 22px' }}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Close</button>
        <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)', borderColor: '#16A34A' }} onClick={onApprove}><i className="fa-solid fa-check" /> Approve</button>
        <button className="btn-danger" onClick={onReject}><i className="fa-solid fa-ban" /> Reject</button>
      </>}>
      <div style={{ borderRadius: 12, height: 200, background: 'linear-gradient(135deg,#1E3A8A 0%,#1565C0 50%,#0284C7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#00BFA5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}><i className="fa-solid fa-play" /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <span className="et-cb" style={{ background: m.bg, color: m.c, borderColor: `${m.c}33` }}><i className={`fa-solid ${m.i}`} /> {rev.cat}</span>
        <RevBadge status={rev.status} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <InfoBox icon="fa-calendar-day" label="Upload Date" value={rev.date} />
        <InfoBox icon="fa-eye" label="Views" value="0" />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tm)', letterSpacing: '.3px', textTransform: 'uppercase', marginBottom: 6 }}>Description</div>
      <div style={{ fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.65 }}>{rev.vd}</div>
      <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(30,58,138,.04)', border: '1px solid rgba(30,58,138,.12)', borderRadius: 'var(--r-md)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 5 }}><i className="fa-solid fa-quote-left" style={{ fontSize: 9 }} /> REVIEW / FEEDBACK — {rev.school}</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, fontStyle: 'italic' }}>{rev.txt}</div>
        <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 6 }}><i className="fa-solid fa-user" style={{ fontSize: 9 }} /> {rev.by}</div>
      </div>
    </Modal>
  );
}
function InfoBox({ icon, label, value }) {
  return (
    <div style={{ border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '12px 14px', background: 'var(--muted)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tm)', letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><i className={`fa-solid ${icon}`} style={{ color: 'var(--brand)' }} /> {label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{value}</div>
    </div>
  );
}

function ApproveModal({ rev, onConfirm, onClose }) {
  return (
    <Modal title="Approve Video" titleColor="#16A34A" maxWidth={480} onClose={onClose}
      bodyStyle={{ textAlign: 'center', padding: '24px 28px' }}
      footer={<div style={{ display: 'flex', justifyContent: 'center', gap: 10, width: '100%' }}>
        <button className="btn-secondary" style={{ minWidth: 100 }} onClick={onClose}>Cancel</button>
        <button style={{ minWidth: 160, padding: '10px 20px', borderRadius: 'var(--r-md)', border: 'none', background: '#16A34A', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 3px 10px rgba(22,163,74,.35)' }} onClick={onConfirm}><i className="fa-solid fa-check" /> Approve &amp; Publish</button>
      </div>}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(22,163,74,.12)', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px', border: '2px solid rgba(22,163,74,.25)' }}><i className="fa-solid fa-circle-check" /></div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Approve this video?</div>
      <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 18 }}>Once approved, this video will become visible in the student app according to its visibility setting.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--muted)', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', textAlign: 'left' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(30,58,138,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className="fa-solid fa-photo-film" style={{ color: 'var(--brand)', fontSize: 13 }} /></div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)' }}>{rev.vt}</div>
      </div>
    </Modal>
  );
}

function RejectModal({ rev, onConfirm, onClose }) {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [note, setNote] = useState('');
  return (
    <Modal title="Reject Video" titleColor="#DC2626" sub={<>Rejecting: {rev.vt}</>} maxWidth={480} onClose={onClose}
      bodyStyle={{ padding: '18px 22px 22px' }}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button style={{ padding: '9px 18px', borderRadius: 'var(--r-md)', border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(220,38,38,.3)' }} onClick={() => onConfirm(reason, note.trim())}><i className="fa-solid fa-ban" /> Reject Video</button>
      </>}>
      <div className="f-field" style={{ marginBottom: 14 }}>
        <label className="f-label" style={{ fontSize: 12.5 }}>Rejection Reason <span style={{ color: 'var(--err)' }}>*</span></label>
        <select className="f-input" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: 6, height: 44 }}>{REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
      </div>
      <div className="f-field" style={{ marginBottom: 14 }}>
        <label className="f-label" style={{ fontSize: 12.5 }}>Additional Note</label>
        <textarea className="f-textarea" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 6, minHeight: 90 }} placeholder="Explain why this video was rejected so the uploader can fix it…" />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 13px', background: 'rgba(217,119,6,.06)', border: '1px solid rgba(217,119,6,.22)', borderRadius: 'var(--r-md)', fontSize: 12.5, color: '#92400E', lineHeight: 1.55 }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ color: '#D97706', marginTop: 1, flexShrink: 0 }} />
        The uploader will see this reason and can re-submit after making changes.
      </div>
    </Modal>
  );
}

function SchoolVideoModal({ vid, onDelete, onClose }) {
  const m = catMeta(vid.cat);
  return (
    <Modal title={vid.title} sub="Video details — uploaded by school" maxWidth={600} onClose={onClose}
      bodyStyle={{ padding: '16px 22px 22px' }}
      footer={<><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-danger" onClick={onDelete}><i className="fa-solid fa-trash-can" /> Delete Video</button></>}>
      <div style={{ borderRadius: 12, height: 190, background: 'linear-gradient(135deg,#1E3A8A 0%,#1565C0 55%,#0284C7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#00BFA5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}><i className="fa-solid fa-play" /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <span className="et-cb" style={{ background: m.bg, color: m.c, borderColor: `${m.c}33` }}><i className={`fa-solid ${m.i}`} /> {vid.cat}</span>
        <span className="rv-school"><i className="fa-solid fa-school" style={{ fontSize: 9 }} /> {vid.school}</span>
        <SchoolStatusBadge status={vid.status} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <InfoBox icon="fa-calendar-day" label="Upload Date" value={vid.date} />
        <InfoBox icon="fa-eye" label="Views" value={vid.views.toLocaleString()} />
        <InfoBox icon="fa-school" label="School" value={vid.school} />
      </div>
      <div style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--tm)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="fa-solid fa-user" style={{ color: 'var(--brand)', fontSize: 11 }} /> Uploaded by: <strong style={{ color: 'var(--t1)' }}>{vid.by}</strong>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm)', letterSpacing: '.3px', textTransform: 'uppercase', marginBottom: 6 }}>Description</div>
      <div style={{ fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.65, padding: '12px 14px', background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)' }}>{vid.desc}</div>
    </Modal>
  );
}

function DeleteSchoolVideoModal({ vid, onConfirm, onClose }) {
  return (
    <Modal title="Delete School Video" icon="fa-trash-can" iconColor="var(--err)" maxWidth={460} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button></>}
      bodyStyle={{ textAlign: 'center', padding: '26px 22px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(220,38,38,.1)', color: 'var(--err)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 12px' }}><i className="fa-solid fa-trash-can" /></div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>Delete this school video?</div>
      <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6 }}>This will permanently remove the video from the E-Tube library. This action cannot be undone.</div>
      <div style={{ marginTop: 12, padding: '11px 13px', background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)', textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{vid.title}</div>
        <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{vid.school} · {vid.cat}</div>
      </div>
    </Modal>
  );
}
