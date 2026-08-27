import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ET_CM, catMeta, INITIAL_REVS, INITIAL_SCHOOL_VIDS,
  UPLOAD_CATEGORIES, REJECT_REASONS, CATEGORY_COLORS,
} from './etubeData';
import { etubeApi } from './api';

/* ═══════════════════════════════════════════════════════════════════
   E-TUBE — Super Admin module

   Head Office educational video studio. Inner tabs:
     Videos · Upload · Categories
   (Dashboard aur Reviews filhaal band hain — dekho SHOW_DASHBOARD_REVIEWS.)

   Videos aur Categories ab LIVE SchoolMentorSuperAdminAPI par hain
   (api/services/etube.js):
     Categories tab  → /api/AHM_Etube/manage_categories  (get/insert/update/delete)
     Upload + Videos → /api/AHM_Etube/manage_videos      (multipart, wohi actions)

   Reviews aur "Other Schools" videos ki abhi koi API nahi — wo do screens
   demo data par hi hain (./etubeData). Baqi UI wohi hai jo
   "Super_admin_with_ETube (17).html" me tha.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Dashboard + Reviews filhaal band ──────────────────────────────────
   Dono screens abhi mukammal nahi hain (Reviews ki to koi API bhi nahi, wo
   demo data par chal rahi thi), is liye tab bar se hata di gayi hain. Unka
   saara code — Dashboard / Reviews components, review modals, approve /
   reject ka amal — jyun ka tyun mojood hai; wapas laane ke liye sirf yeh
   ek line true kar dein, aur kuch nahi badalna parega.

   (Comment kar ke hatane ke bajaye switch is liye rakha hai ke un dono
   components ka code bhi "istemal me" gina jata rahe — warna build par
   "defined but never used" warnings aa jate hain.) */
const SHOW_DASHBOARD_REVIEWS = false;

/* ── Videos ▸ "Other Schools" sub-tab filhaal band ────────────────────
   Wahi wajah jo Reviews ki thi: is screen ki koi API nahi hai. Poori list
   etubeData ke INITIAL_SCHOOL_VIDS (demo rows) se banti hai, aur View /
   Delete sirf screen par asar karte hain — backend par kuch nahi jata. Live
   module me banawati videos dikhana ghalat fehmi paida karta hai, is liye
   sub-tab bar se hata di gayi hai.

   Sirf yeh line true kar dein aur sub-tab wapas aa jayega — panel, filters,
   modals sab jyun ke tyun mojood hain. (SHOW_DASHBOARD_REVIEWS ki tarah
   switch hi rakha hai, comment kar ke nahi hataya: warna Thumb/CatBadge
   jaise components "defined but never used" ban jate hain.) */
const SHOW_OTHER_SCHOOLS = false;

const TABS = [
  ...(SHOW_DASHBOARD_REVIEWS ? [
    { id: 'dashboard',  name: 'Dashboard',  icon: 'fa-gauge-high' },
    { id: 'reviews',    name: 'Reviews',    icon: 'fa-star-half-stroke', badge: true },
  ] : []),
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
/* Views ka number.

   manage_videos par views ka koi column HAI HI NAHI — jo rows aati hain un
   me `views` field hoti hi nahi, is liye har video ke saamne pakka 0 lagta
   tha. Sifar ek asli ginti lagti hai ("kisi ne dekha hi nahi"), jab ke sach
   ye hai ke ginti rakhi hi nahi ja rahi. Is liye 0 par "—" — jis din API
   asli count bhejne lagegi, wahi apne aap dikhne lagega. */
const viewsLabel = (n) => (Number(n) > 0 ? Number(n).toLocaleString() : '—');

/* Video ka thumbnail. `src` ho to asli tasveer, warna wahi purana
   category-rang wala khaka (demo HTML se aaya hua) — jo ab tak HAR row par
   lagta tha, chahe API ne asli thumbnail bheji ho. */
function Thumb({ cls, cat, dotCls, src }) {
  const m = catMeta(cat);
  return (
    <div className={cls} style={{ background: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)' }}>
      {src && (
        <img
          src={src}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          /* File gayab ho to khaka wapas — toota hua icon se behtar hai. */
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className={dotCls}><i className="fa-solid fa-play" /></div>
      {!src && <i className={`fa-solid ${m.i}`} style={{ color: m.c, opacity: 0.5, fontSize: 12 }} />}
    </div>
  );
}

export default function ETube({ toast }) {
  const [tab, setTab] = useState(SHOW_DASHBOARD_REVIEWS ? 'dashboard' : 'videos');

  /* Videos + categories API se aate hain; reviews aur school videos ki abhi
     koi API nahi, is liye wo demo data par hain. */
  const [vids, setVids] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);          // ek waqt me ek write
  const [revs, setRevs] = useState(INITIAL_REVS);
  const [schoolVids, setSchoolVids] = useState(INITIAL_SCHOOL_VIDS);

  const [modal, setModal] = useState(null);   // { type, ... }

  const toastRef = useRef(toast);
  toastRef.current = toast;

  /* ── Live load ── */
  const loadCats = useCallback(async () => {
    try {
      const rows = await etubeApi.listCategories();
      /* CatBadge / Thumb apna icon-rang ET_CM se uthate hain, is liye live
         categories wahan register kar dete hain — warna har nayi category
         default icon par gir jati hai. */
      rows.forEach((c) => { ET_CM[c.name] = { i: c.icon, c: c.color, bg: `${c.color}22` }; });
      setCats(rows);
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not load categories', 'error');
    }
  }, []);

  const loadVids = useCallback(async () => {
    try {
      setVids(await etubeApi.listVideos());
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not load videos', 'error');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadCats(), loadVids()]);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [loadCats, loadVids]);

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const live = vids.filter((v) => v.status === 'Live').length;
    const proc = vids.filter((v) => v.status === 'Processing').length;
    const views = vids.reduce((a, v) => a + (v.views || 0), 0);
    /* "This month" ab chalte mahine se — pehle 'Jun 2026' hardcoded tha,
       jo live dates ke saath hamesha 0 deta. */
    const thisMonth = new Date().toISOString().slice(0, 7);
    const mon = vids.filter((v) => String(v.createdAt || '').slice(0, 7) === thisMonth).length;
    const pending = revs.filter((r) => r.status === 'Pending').length;
    return {
      total: vids.length, live, proc, views, mon, pending,
      hoVids: vids.length, schVids: schoolVids.length,
      revApproved: revs.filter((r) => r.status === 'Approved').length,
      revRejected: revs.filter((r) => r.status === 'Rejected').length,
    };
  }, [vids, revs, schoolVids]);

  /* ── Video CRUD — manage_videos (update / delete) ──
     Update par poora row wapas jata hai (sirf badla hua hissa nahi), warna
     Thumbnail / VideoFile ke stored paths khali chale jate aur file gum ho
     jati — wohi usool jo SOP ke PDFPath par hai. */
  const saveEdit = async (id, patch) => {
    if (busy) return;
    setBusy(true);
    try {
      const cur = vids.find((v) => v.id === id) || {};
      await etubeApi.saveVideo({ ...cur, ...patch }, id);
      toast?.('Video updated', 'success');
      setModal(null);
      await loadVids();
    } catch (err) {
      toast?.(err?.message || 'Could not update video', 'error');
    } finally {
      setBusy(false);
    }
  };
  const deleteVid = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      await etubeApi.deleteVideo(id);
      toast?.('Video deleted', 'info');
      setModal(null);
      await loadVids();
    } catch (err) {
      toast?.(err?.message || 'Could not delete video', 'error');
    } finally {
      setBusy(false);
    }
  };
  /* Upload panel khud API par file bhejta hai; yahan sirf list taza karni hai. */
  const onUploaded = async () => { await loadVids(); };

  /* ── Category CRUD — manage_categories (insert / update / delete) ── */
  const saveCat = async (form, editId) => {
    if (busy) return;
    setBusy(true);
    try {
      await etubeApi.saveCategory(form, editId);
      toast?.(editId ? 'Category updated' : 'Category added', 'success');
      setModal(null);
      await loadCats();
    } catch (err) {
      toast?.(err?.message || 'Could not save category', 'error');
    } finally {
      setBusy(false);
    }
  };
  const deleteCat = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      await etubeApi.deleteCategory(id);
      toast?.('Category deleted', 'info');
      setModal(null);
      await loadCats();
    } catch (err) {
      toast?.(err?.message || 'Could not delete category', 'error');
    } finally {
      setBusy(false);
    }
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

      {SHOW_DASHBOARD_REVIEWS && tab === 'dashboard' && (
        <Dashboard stats={stats} vids={vids} revs={revs} goReviews={goReviews} setTab={setTab} />
      )}
      {SHOW_DASHBOARD_REVIEWS && tab === 'reviews' && (
        <Reviews stats={stats} revs={revs} setModal={setModal} />
      )}
      {tab === 'videos' && (
        <Videos vids={vids} cats={cats} schoolVids={schoolVids} loading={loading} setModal={setModal} goUpload={goUpload} />
      )}
      {tab === 'upload' && (
        <Upload cats={cats} onUploaded={onUploaded} toast={toast} />
      )}
      {tab === 'categories' && (
        <Categories cats={cats} vids={vids} loading={loading} setModal={setModal} />
      )}

      {/* ── MODALS ── */}
      {modal?.type === 'viewVid' && <ViewVideoModal vid={modal.vid} onClose={() => setModal(null)} />}
      {modal?.type === 'editVid' && <EditVideoModal vid={modal.vid} cats={cats} busy={busy} onSave={saveEdit} onClose={() => setModal(null)} />}
      {modal?.type === 'delVid' && <DeleteVideoModal vid={modal.vid} busy={busy} onConfirm={() => deleteVid(modal.vid.id)} onClose={() => setModal(null)} />}
      {modal?.type === 'cat' && <CategoryModal cat={modal.cat} busy={busy} onSave={saveCat} onClose={() => setModal(null)} />}
      {modal?.type === 'delCat' && <DeleteCategoryModal cat={modal.cat} busy={busy} onConfirm={() => deleteCat(modal.cat.id)} onClose={() => setModal(null)} />}
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
        <Stat icon="fa-eye" iColor="#1E40AF" iBg="rgba(30,58,138,.1)" val={viewsLabel(stats.views)} lbl="Total Views" />
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
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}><i className="fa-solid fa-eye" /> {viewsLabel(v.views)}</div>
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
function Videos({ vids, cats, schoolVids, loading, setModal, goUpload }) {
  const [sub, setSub] = useState('ho');     // 'ho' | 'schools'

  /* Filter dropdowns live categories se; API se abhi kuch na aaya ho to
     purani tay-shuda list par gir jate hain taake filter khali na lage. */
  const catNames = cats?.length ? cats.map((c) => c.name) : UPLOAD_CATEGORIES;

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
      {/* Other Schools band ho to sirf ek hi sub-tab bachta hai — akela tab
          dikhana bemani hai, is liye poora bar chhupa dete hain. */}
      {SHOW_OTHER_SCHOOLS && (
        <div className="et-vid-subtabs">
          <button className={`et-vid-stab${sub === 'ho' ? ' active' : ''}`} onClick={() => setSub('ho')}><i className="fa-solid fa-building-shield" /> School Mentor's Videos</button>
          <button className={`et-vid-stab${sub === 'schools' ? ' active' : ''}`} onClick={() => setSub('schools')}><i className="fa-solid fa-school" /> Other Schools</button>
        </div>
      )}

      {sub === 'ho' && (
        <div className="et-card">
          <div className="et-toolbar">
            <div className="et-srch"><i className="fa-solid fa-magnifying-glass" /><input value={hSearch} onChange={(e) => setHSearch(e.target.value)} placeholder="Search by title or description…" /></div>
            <select className="et-sel" value={hCat} onChange={(e) => setHCat(e.target.value)}><option value="">All Categories</option>{catNames.map((c) => <option key={c}>{c}</option>)}</select>
            <select className="et-sel" value={hStatus} onChange={(e) => setHStatus(e.target.value)}><option value="">All Status</option><option value="Live">Live</option><option value="Processing">Processing</option><option value="Draft">Draft</option></select>
            <button className="btn-primary" onClick={goUpload}><i className="fa-solid fa-cloud-arrow-up" /> Upload</button>
          </div>
          <div className="et-vth"><div className="et-th">Thumb</div><div className="et-th">Title &amp; Desc</div><div className="et-th">Category</div><div className="et-th">Status</div><div className="et-th" style={{ textAlign: 'right' }}>Actions</div></div>
          <div>
            {hoRows.length === 0 ? (
              loading ? (
                <div className="et-empty"><div className="et-ei"><i className="fa-solid fa-spinner fa-spin" /></div><div className="et-et">Loading videos…</div><div className="et-es">Fetching from E-Tube API.</div></div>
              ) : (
                <div className="et-empty"><div className="et-ei"><i className="fa-solid fa-photo-film" /></div><div className="et-et">No videos found</div><div className="et-es">Try a different filter or upload a new video.</div><button className="btn-primary" style={{ marginTop: 12 }} onClick={goUpload}><i className="fa-solid fa-cloud-arrow-up" /> Upload Video</button></div>
              )
            ) : hoRows.map((v) => (
              <div className="et-vr" key={v.id}>
                <div className="et-td"><Thumb cls="et-vth2" cat={v.cat} dotCls="et-vp" src={v.thumbUrl} /></div>
                <div className="et-td" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}><div className="et-vtt">{v.title}</div><div className="et-vtd">{v.desc}</div></div>
                <div className="et-td"><CatBadge cat={v.cat} /></div>
                <div className="et-td"><StatusBadge status={v.status} /></div>
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

      {SHOW_OTHER_SCHOOLS && sub === 'schools' && (
        <div className="et-card">
          <div className="et-toolbar">
            <div className="et-srch" style={{ flex: 1.5 }}><i className="fa-solid fa-magnifying-glass" /><input value={sSearch} onChange={(e) => setSSearch(e.target.value)} placeholder="Search by school name, video title…" /></div>
            <select className="et-sel" value={sCat} onChange={(e) => setSCat(e.target.value)}><option value="">All Categories</option>{catNames.map((c) => <option key={c}>{c}</option>)}</select>
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
                <div className="et-td" style={{ justifyContent: 'flex-end', fontWeight: 800, color: 'var(--brand)' }}>{viewsLabel(v.views)}</div>
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
/* Asli upload — POST /api/AHM_Etube/manage_videos (Action: insert).

   Purana panel sirf setTimeout se "uploading → processing" ka natak karta
   tha. Ab char qadam asli haal dikhate hain:
     1 Upload      → bytes ja rahe hain (xhr.upload.onprogress ka %)
     2 Processing  → sab bytes chale gaye, ab API ke jawab ka intezaar
     3 Publish     → API ne kaamyabi di
     4 Live on App → row list me aa gayi (Status=true ke saath insert hui)

   HO videos seedha live jati hain — koi approval nahi — is liye Status
   hamesha true bhejte hain. */
function Upload({ cats, onUploaded, toast }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [catId, setCatId] = useState(0);
  const [thumbFile, setThumbFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [phase, setPhase] = useState('idle');   // idle | uploading | processing | published
  const [pct, setPct] = useState(0);
  const thumbRef = useRef(null);
  const videoRef = useRef(null);

  /* Pehli category default — cats API se aate hain, is liye load hone par. */
  useEffect(() => {
    if (!catId && cats?.length) setCatId(cats[0].id);
  }, [cats, catId]);

  const cat = cats?.find((c) => c.id === Number(catId)) || null;
  const busy = phase === 'uploading' || phase === 'processing';

  const stepState = (n) => {
    const map = {
      idle:       { 1: 'cur',  2: '',     3: '',     4: '' },
      uploading:  { 1: 'cur',  2: '',     3: '',     4: '' },
      processing: { 1: 'done', 2: 'cur',  3: '',     4: '' },
      published:  { 1: 'done', 2: 'done', 3: 'done', 4: 'done' },
    };
    return map[phase][n] || '';
  };

  const pickThumb = (f) => {
    if (!f) return;
    if (!/^image\//i.test(f.type)) { toast?.('Thumbnail must be a JPG or PNG image', 'warn'); return; }
    setThumbFile(f);
  };
  const pickVideo = (f) => {
    if (!f) return;
    /* UI ka apna wada: MP4 / MOV / WEBM, max 500 MB. */
    if (f.size > 500 * 1024 * 1024) { toast?.('Video is larger than 500 MB', 'warn'); return; }
    setVideoFile(f);
  };

  const doUpload = async () => {
    if (busy) return;
    if (!title.trim()) { toast?.('Please enter a video title', 'warn'); return; }
    if (!cat) { toast?.('Please add a category first', 'warn'); return; }
    if (!videoFile) { toast?.('Please choose a video file', 'warn'); return; }

    setPhase('uploading'); setPct(0);
    try {
      await etubeApi.saveVideo(
        {
          title: title.trim(),
          desc: desc.trim() || 'No description.',
          catId: cat.id,
          cat: cat.name,
          status: 'Live',                 // HO video seedha live
          thumbFile,
          videoUpload: videoFile,
        },
        0,                                 // insert
        (p) => { setPct(p); if (p >= 100) setPhase('processing'); },
      );
      setPhase('published');
      toast?.('Video published live on the School Mentor app!', 'success');
      await onUploaded?.();
      /* Form khali, taake agli video foran upload ho sake. */
      setTitle(''); setDesc(''); setThumbFile(null); setVideoFile(null); setPct(0);
      if (thumbRef.current) thumbRef.current.value = '';
      if (videoRef.current) videoRef.current.value = '';
      setTimeout(() => setPhase('idle'), 1500);
    } catch (err) {
      setPhase('idle'); setPct(0);
      toast?.(err?.message || 'Could not upload video', 'error');
    }
  };

  const dot = (n) => {
    const st = stepState(n);
    return (
      <div className={`et-step${st ? ` ${st}` : ''}`}>
        <div className="et-dot">{st === 'done' ? <i className="fa-solid fa-check" /> : n === 4 ? <i className="fa-solid fa-mobile-screen" /> : n}</div>
        {n !== 4 && <div className="et-line" />}
        <div className="et-slbl">{['Upload', 'Processing', 'Publish', 'Live on App'][n - 1]}</div>
      </div>
    );
  };

  const fileHint = (f, fallback) => (f ? `${f.name} · ${(f.size / (1024 * 1024)).toFixed(1)} MB` : fallback);

  return (
    <div className="et-panel active">
      <div className="et-card">
        <div className="et-ch"><div className="et-chl"><div className="et-ci" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}><i className="fa-solid fa-cloud-arrow-up" /></div><div><div className="et-ct">Upload New Video</div><div className="et-cs">Videos go live automatically after processing — no review needed</div></div></div></div>
        <div className="et-ug">
          <div>
            <div className="et-hlp"><i className="fa-solid fa-circle-info" style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 1 }} /> Head Office videos are published directly after processing. No approval workflow.</div>
            <div className="et-fg"><label className="et-fl">Video Title <span style={{ color: 'var(--err)' }}>*</span></label><input className="et-fi" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to the Solar System" /></div>
            <div className="et-fg"><label className="et-fl">Description</label><textarea className="et-fta" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description students will see below the video…" /></div>
            <div className="et-fg">
              <label className="et-fl">Category <span style={{ color: 'var(--err)' }}>*</span></label>
              <select className="et-fi" value={catId} onChange={(e) => setCatId(Number(e.target.value))}>
                {!cats?.length && <option value={0}>No categories yet — add one first</option>}
                {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="et-fg">
              <label className="et-fl">Thumbnail</label>
              <input ref={thumbRef} type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => pickThumb(e.target.files?.[0])} />
              <div className="et-dz" onClick={() => !busy && thumbRef.current?.click()} style={thumbFile ? { borderColor: 'var(--brand)' } : undefined}>
                <i className={`fa-solid ${thumbFile ? 'fa-circle-check' : 'fa-image'}`} />
                <div className="et-dz-t">{thumbFile ? 'Thumbnail selected' : 'Upload Thumbnail'}</div>
                <div className="et-dz-s">{fileHint(thumbFile, 'JPG or PNG · 1280×720')}</div>
              </div>
            </div>
            <div className="et-fg">
              <label className="et-fl">Video File <span style={{ color: 'var(--err)' }}>*</span></label>
              <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" style={{ display: 'none' }} onChange={(e) => pickVideo(e.target.files?.[0])} />
              <div className="et-dz" onClick={() => !busy && videoRef.current?.click()} style={videoFile ? { borderColor: 'var(--brand)' } : undefined}>
                <i className={`fa-solid ${videoFile ? 'fa-circle-check' : 'fa-film'}`} />
                <div className="et-dz-t">{videoFile ? 'Video selected' : 'Drag & drop or click to upload'}</div>
                <div className="et-dz-s">{fileHint(videoFile, 'MP4 / MOV / WEBM · max 500 MB')}</div>
              </div>
            </div>
            <div className="et-fg"><label className="et-fl" style={{ marginBottom: 8 }}>HO Publish Flow</label>
              <div className="et-step-wrap">{dot(1)}{dot(2)}{dot(3)}{dot(4)}</div>
            </div>
            <button className="et-up-btn" disabled={busy} onClick={doUpload}>
              {phase === 'uploading' && <><i className="fa-solid fa-spinner fa-spin" /> Uploading… {pct}%</>}
              {phase === 'processing' && <><i className="fa-solid fa-spinner fa-spin" /> Processing…</>}
              {phase === 'published' && <><i className="fa-solid fa-check" /> Published!</>}
              {phase === 'idle' && <><i className="fa-solid fa-cloud-arrow-up" /> Upload &amp; Publish Live</>}
            </button>
            {phase === 'uploading' && (
              <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'var(--muted)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#1E40AF,#0284C7)', transition: 'width .2s' }} />
              </div>
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
function Categories({ cats, vids, loading, setModal }) {
  /* Ginti CategoryID par — naam badal jaye to bhi videos apni category ke
     saath rehti hain. Purani rows jinme ID na ho, naam par gin li jati hain. */
  const ofCat = (c) => vids.filter((v) => (v.catId ? v.catId === c.id : v.cat === c.name));
  return (
    <div className="et-panel active">
      <div className="et-card">
        <div className="et-ch">
          <div className="et-chl"><div className="et-ci" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}><i className="fa-solid fa-layer-group" /></div><div><div className="et-ct">Video Categories</div><div className="et-cs">These appear as tabs in the School Mentor mobile app</div></div></div>
          <button className="btn-primary" onClick={() => setModal({ type: 'cat', cat: null })}><i className="fa-solid fa-plus" /> Add Category</button>
        </div>
        {loading && !cats.length && (
          <div className="et-empty"><div className="et-ei"><i className="fa-solid fa-spinner fa-spin" /></div><div className="et-et">Loading categories…</div></div>
        )}
        <div className="et-cg">
          {cats.map((c) => {
            const mine = ofCat(c);
            const tot = mine.length;
            const lv = mine.filter((v) => v.status === 'Live').length;
            const pr = mine.filter((v) => v.status === 'Processing').length;
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
  /* File server par mojood na ho to <video> chup-chaap kaala box bana kar
     baith jata hai — 0:00, koi paighaam nahi — aur dekhne wale ko lagta hai
     player toota hua hai, jab ke asal me file hi nahi mil rahi. */
  const [videoFailed, setVideoFailed] = useState(false);
  const showPlayer = Boolean(vid.videoUrl) && !videoFailed;
  return (
    <Modal title={vid.title} sub="Video details" icon="fa-circle-play" onClose={onClose}
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      {/* Yahan pehle sirf ek khaka tha — neela box aur play ka nishan — is
          liye "View" par video kabhi chalti hi nahi thi. Ab asli player
          lagta hai; thumbnail poster ban jati hai. Purani rows par
          videoFile null bhi ho sakta hai (upload se pehle wali), un par
          wohi khaka rehta hai. */}
      {showPlayer ? (
        <video
          src={vid.videoUrl}
          poster={vid.thumbUrl || undefined}
          controls
          preload="metadata"
          onError={() => setVideoFailed(true)}
          style={{ width: '100%', maxHeight: 320, borderRadius: 'var(--r-lg)', background: '#000', marginBottom: 14, display: 'block' }}
        >
          Your browser cannot play this video.
        </video>
      ) : (
        <div style={{ borderRadius: 'var(--r-lg)', height: 160, background: 'linear-gradient(135deg,#1E3A8A,#0284C7)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: '#fff' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}><i className="fa-solid fa-video-slash" /></div>
          <div style={{ fontSize: 12.5, fontWeight: 700, opacity: .9 }}>
            {vid.videoUrl
              ? 'Video file could not be loaded from the server'
              : 'No video file on this record'}
          </div>
          {vid.videoUrl && (
            <div style={{ fontSize: 10.5, opacity: .7, wordBreak: 'break-all', textAlign: 'center', padding: '0 16px' }}>
              {vid.videoUrl}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}><CatBadge cat={vid.cat} /> <StatusBadge status={vid.status} /></div>
        <div className="f-field"><label className="f-label">Upload Date</label><input className="f-input" readOnly value={vid.date} /></div>
      <div className="f-field" style={{ marginTop: 12 }}><label className="f-label">Description</label><div style={{ fontSize: 13, color: 'var(--t2)', padding: 10, borderRadius: 'var(--r-md)', background: 'var(--muted)', border: '1px solid var(--bl)', lineHeight: 1.6, marginTop: 4 }}>{vid.desc}</div></div>
    </Modal>
  );
}

function EditVideoModal({ vid, cats, busy, onSave, onClose }) {
  /* Category id se chalti hai (naam sirf dikhane ke liye) — API ko CategoryID
     aur CategoryName dono chahiye, aur naam badal jane par bhi link na toote. */
  const [form, setForm] = useState({
    title: vid.title, desc: vid.desc,
    catId: vid.catId || cats?.find((c) => c.name === vid.cat)?.id || 0,
  });
  const save = () => {
    const cat = cats?.find((c) => c.id === Number(form.catId));
    onSave(vid.id, {
      title: form.title.trim() || vid.title,
      desc: form.desc.trim(),
      catId: cat ? cat.id : vid.catId,
      cat: cat ? cat.name : vid.cat,
    });
  };
  return (
    <Modal title="Edit Video" icon="fa-pen" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="f-field"><label className="f-label">Title</label><input className="f-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="f-field" style={{ marginTop: 12 }}><label className="f-label">Description</label><textarea className="f-textarea" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></div>
      <div className="f-field" style={{ marginTop: 12 }}><label className="f-label">Category</label>
        <select className="f-input" value={form.catId} onChange={(e) => setForm({ ...form, catId: Number(e.target.value) })}>
          {!cats?.length && <option value={0}>{vid.cat || 'No categories'}</option>}
          {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </Modal>
  );
}
function DeleteVideoModal({ vid, busy, onConfirm, onClose }) {
  return (
    <Modal title="Delete Video" icon="fa-trash-can" iconColor="var(--err)" maxWidth={460} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" disabled={busy} onClick={onConfirm}><i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-trash-can"}`} /> {busy ? "Deleting…" : "Delete"}</button></>}
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

function CategoryModal({ cat, busy, onSave, onClose }) {
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
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}><i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-floppy-disk"}`} /> {busy ? "Saving…" : (editing ? "Update" : "Save Category")}</button></>}>
      <div className="f-field"><label className="f-label">Category Name <span style={{ color: 'var(--err)' }}>*</span></label><input className="f-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" style={{ marginTop: 4 }} /></div>
      <div className="f-field" style={{ marginTop: 12 }}><label className="f-label">Description</label><textarea className="f-textarea" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Short description…" style={{ marginTop: 4, minHeight: 65 }} /></div>
      <div className="modal-grid" style={{ marginTop: 12 }}>
        <div className="f-field"><label className="f-label">Icon (FA class)</label><input className="f-input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="fa-book-open" style={{ marginTop: 4 }} /></div>
        <div className="f-field"><label className="f-label">Color</label><select className="f-input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ marginTop: 4 }}>{CATEGORY_COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
      </div>
    </Modal>
  );
}

function DeleteCategoryModal({ cat, busy, onConfirm, onClose }) {
  return (
    <Modal title="Delete Category" icon="fa-trash-can" iconColor="var(--err)" maxWidth={420} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" disabled={busy} onClick={onConfirm}><i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-trash-can"}`} /> {busy ? "Deleting…" : "Delete"}</button></>}
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
        <InfoBox icon="fa-eye" label="Views" value={viewsLabel(vid.views)} />
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

function DeleteSchoolVideoModal({ vid, busy = false, onConfirm, onClose }) {
  return (
    <Modal title="Delete School Video" icon="fa-trash-can" iconColor="var(--err)" maxWidth={460} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" disabled={busy} onClick={onConfirm}><i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-trash-can"}`} /> {busy ? "Deleting…" : "Delete"}</button></>}
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
