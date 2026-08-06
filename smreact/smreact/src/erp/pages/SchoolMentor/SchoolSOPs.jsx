import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import ModuleTutorialModal from '../../components/TutorialModal';
import { usePermissions } from '../../context/PermissionsContext';
import { getManualHeads, getManuals, getForms, getFormsCount } from '../../services/sopsService';

/* ═══════════════════════════════════════════════════════════════════
   SCHOOL SOPs — Centralised SOP & School Manual Library

   Self-contained module with:
     • Page header (Reports dropdown + Tutorial button)
     • Info banner
     • 4 stat cards
     • 4 category tabs
     • Filter bar (search + status)
     • Expandable manual table with PDF + Tutorial actions
     • PDF viewer modal (iframe)
     • Tutorial modal (YouTube embed)
     • Reports modal (A4 printable Manual / Tutorial Inventory)

   Brand-blue palette, Plus Jakarta Sans, mirrors the design language
   of every other ERP module. No global CSS touched.
   ═══════════════════════════════════════════════════════════════════ */

/* Categories (manual heads), manuals aur unki forms — teeno ab Super Admin
   ke SOP module se aati hain (src/erp/services/sopsService.js). Pehle yahan
   CATEGORY_OPTIONS + MANUALS ki hardcoded list thi. */

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function SchoolSOPs({ toast = () => {} }) {
  const { can } = usePermissions();
  const canViewManuals    = can('School SOPs', 'View Manuals', 'View');
  const canWatchTutorials = can('School SOPs', 'Watch Tutorials', 'View');
  const [cat,    setCat]    = useState(null);      // selected manual head id
  const [search, setSearch] = useState('');
  const [pdfFor, setPdfFor] = useState(null);
  const [tutFor, setTutFor] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* ── Live data — Super Admin ke SOP module se (sirf padhne ke liye).
        Manual heads → categories, phir chuni hui head ke manuals. Pehle ye
        list file me hardcoded thi. ── */
  const [heads,   setHeads]   = useState([]);
  const [manuals, setManuals] = useState([]);
  const [headsLoading,   setHeadsLoading]   = useState(true);
  const [manualsLoading, setManualsLoading] = useState(false);

  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let alive = true;
    setHeadsLoading(true);
    getManualHeads()
      .then((list) => {
        if (!alive) return;
        setHeads(list);
        setCat((cur) => (list.some((h) => h.id === cur) ? cur : (list[0]?.id ?? null)));
      })
      .catch((err) => { if (alive) toastRef.current?.(err.message || 'Could not load manual categories', 'error'); })
      .finally(() => { if (alive) setHeadsLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!cat) { setManuals([]); return undefined; }
    let alive = true;
    setManualsLoading(true);
    getManuals(cat)
      .then(async (list) => {
        if (!alive) return;
        /* Manual ke saath uski head ka NAAM bhi rakho — API sirf id deti hai,
           aur modal me badge par id ("4") dikhna bekar lagta hai. */
        const headName = heads.find((h) => h.id === cat)?.label || '';
        const withHead = list.map((m) => ({ ...m, categoryLabel: headName }));
        setManuals(withHead);
        /* Har manual ke against kitni forms hain — manual-detail ka `forms`
           array khali aata hai, is liye ginti manual-form se laate hain
           (sab parallel). Ye table ke Pages column me dikhti hai. */
        const counts = await Promise.all(list.map((m) => getFormsCount(m.id)));
        if (!alive) return;
        setManuals(withHead.map((m, i) => ({ ...m, formsCount: counts[i] })));
      })
      .catch((err) => {
        if (!alive) return;
        setManuals([]);
        toastRef.current?.(err.message || 'Could not load manuals', 'error');
      })
      .finally(() => { if (alive) setManualsLoading(false); });
    return () => { alive = false; };
  }, [cat, heads]);

  /* Live-filtered manuals (list pehle hi chuni hui head ki hai). */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return manuals;
    return manuals.filter(m => `${m.title} ${m.code} ${m.description}`.toLowerCase().includes(q));
  }, [manuals, search]);

  /* Headline stats. */
  const stats = useMemo(() => ({
    totalManuals:   heads.reduce((s, h) => s + (h.totalManuals || 0), 0) || manuals.length,
    totalTutorials: manuals.filter(m => m.hasTutorial).length,
    recentlyAdded:  manuals.length,
    mostViewed:     manuals[0]?.title || '—',
  }), [heads, manuals]);

  return (
    <>
      <style>{SOPS_CSS}</style>

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-book-open"></i>
          </div>
          <div>
            <div className="page-title">School SOPs</div>
            <div className="page-sub">Centralized SOP &amp; School Manual Library</div>
          </div>
        </div>

        {canWatchTutorials && (
        <Tooltip text="Play a short tutorial for the School SOPs module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
            aria-label="Open School SOPs tutorials"
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
        )}
      </div>

      {/* ── Info banner ── */}
      <div className="sops-banner">
        <div className="sops-banner-ic"><i className="fa-solid fa-circle-info" aria-hidden="true"></i></div>
        <div className="sops-banner-body">
          Access school manuals and training tutorials from one place.
          Select a category to filter manuals.
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="sops-stats">
        <Stat tone="blue"   icon="fa-book-open"        label="Total Manuals"    value={stats.totalManuals}
              sub={`Across ${heads.length} categor${heads.length === 1 ? 'y' : 'ies'}`} />
        <Stat tone="green"  icon="fa-play-circle"      label="Total Tutorials"  value={stats.totalTutorials}
              sub={`${Math.round((stats.totalTutorials / stats.totalManuals) * 100)}% of manuals`} />
        <Stat tone="amber"  icon="fa-clock-rotate-left" label="Recently Added"  value={stats.recentlyAdded}
              sub="This month" />
        <Stat tone="indigo" icon="fa-fire"             label="Most Viewed"      value={stats.mostViewed}
              sub="Academic" />
      </div>

      {/* ── Category tabs ── */}
      <div className="sops-cats" role="tablist" aria-label="Manual categories">
        {headsLoading && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B', padding: '8px 4px' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} aria-hidden="true"></i> Loading categories…
          </span>
        )}
        {!headsLoading && heads.length === 0 && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B', padding: '8px 4px' }}>
            No manual categories published yet.
          </span>
        )}
        {!headsLoading && heads.map(c => {
          const count = c.id === cat ? manuals.length : c.totalManuals;
          return (
            <Tooltip key={c.id} text={`Filter by ${c.label} (${count})`}>
              <button
                type="button"
                className={`sops-cat${cat === c.id ? ' on' : ''}`}
                role="tab"
                aria-selected={cat === c.id}
                tabIndex={cat === c.id ? 0 : -1}
                onClick={() => setCat(c.id)}
              >
                <i className={`fa-solid ${c.icon}`} aria-hidden="true"></i>
                <span>{c.label}</span>
                <span className="sops-cat-count">{count}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* ── Filter bar ── */}
      <div className="sops-filters">
        <div className="sops-search">
          <i className="fa-solid fa-magnifying-glass sops-search-ic" aria-hidden="true"></i>
          <input
            type="text"
            className="sops-search-input"
            placeholder="Search by title or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search manuals"
          />
          {search && (
            <Tooltip text="Clear search">
              <button type="button" className="sops-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Manual list ── */}
      {manualsLoading ? (
        <div className="sops-empty">
          <div className="sops-empty-ic"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></div>
          <div className="sops-empty-title">Loading manuals…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sops-empty">
          <div className="sops-empty-ic"><i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i></div>
          <div className="sops-empty-title">No manuals found</div>
          <div className="sops-empty-sub">Try adjusting your search or filters.</div>
        </div>
      ) : (
        <div className="sops-table">
          <div className="sops-table-head">
            <div className="th c" style={{ width: 50 }}>S.No</div>
            <div className="th">Title</div>
            <div className="th c" style={{ width: 70 }}>Pages</div>
            <div className="th" style={{ width: 130 }}>Last Updated</div>
            <div className="th c" style={{ width: 220 }}>Actions</div>
          </div>
          {filtered.map(m => (
            <ManualRow
              key={m.id}
              manual={m}
              onView={() => setPdfFor(m)}
              onTutorial={() => setTutFor(m)}
              canViewManuals={canViewManuals}
              canWatchTutorials={canWatchTutorials}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {pdfFor && (
        <PDFViewerModal
          manual={pdfFor}
          onClose={() => setPdfFor(null)}
        />
      )}
      {tutFor && (
        <TutorialModal
          manual={tutFor}
          onClose={() => setTutFor(null)}
        />
      )}

      <ModuleTutorialModal
        open={tutorialOpen}
        moduleKey="schoolSops"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════════ */
function Stat({ tone, icon, label, value, sub }) {
  return (
    <Tooltip text={`${label}: ${value}${sub ? ` — ${sub}` : ''}`}>
      <div className={`sops-stat sops-stat--${tone}`}>
        <div className="sops-stat-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
        <div className="sops-stat-lbl">{label}</div>
        <div className="sops-stat-val">{value}</div>
        {sub && <div className="sops-stat-sub">{sub}</div>}
      </div>
    </Tooltip>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MANUAL ROW — simple, no expansion
   ═══════════════════════════════════════════════════════════════════ */
function ManualRow({ manual, onView, onTutorial, canViewManuals = true, canWatchTutorials = true }) {
  return (
    <div className="sops-rowwrap">
      <div className="sops-row">
        <div className="td c sops-sno-cell">{manual.sno}</div>
        <div className="td sops-title-cell">
          <span className="sops-title-text">{manual.title}</span>
          {manual.code && <span className="sops-badge sops-badge--blue" style={{ marginLeft: 8 }}>{manual.code}</span>}
        </div>
        {/* "Pages" column me is manual ki forms ki tadaad aati hai (manual-form
            API se) — API manual ka page count bhejti hi nahi. Count aane tak `…`. */}
        <div className="td c sops-pages">{manual.formsCount ?? '…'}</div>
        <div className="td sops-updated">{manual.lastUpdated}</div>
        <div className="td c sops-actions">
          {canViewManuals && (
          <Tooltip text="Open SOP document">
            <button
              type="button"
              className="sops-btn sops-btn-primary sops-btn-sm"
              onClick={onView}
            >
              <i className="fa-solid fa-file-pdf" aria-hidden="true"></i>
              View Manual
            </button>
          </Tooltip>
          )}
          {canWatchTutorials && (
          <Tooltip text={manual.hasTutorial ? 'Watch training tutorial' : 'No tutorial available for this manual'}>
            <button
              type="button"
              className="sops-btn sops-btn-ghost sops-btn-sm"
              onClick={onTutorial}
              disabled={!manual.hasTutorial}
              aria-disabled={!manual.hasTutorial}
            >
              <i className="fa-solid fa-play" aria-hidden="true"></i>
              Tutorial
            </button>
          </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PDF VIEWER MODAL — with full-screen toggle
   ═══════════════════════════════════════════════════════════════════ */
function PDFViewerModal({ manual, onClose }) {
  const [loading,    setLoading]    = useState(true);
  const [fullScreen, setFullScreen] = useState(false);

  /* Agar PDF kisi wajah se load hi na ho (galat path, file gayab), to spinner
     hamesha ke liye ghoomta na rahe — thodi der baad khud hata do. */
  useEffect(() => {
    if (!manual.pdfUrl) { setLoading(false); return undefined; }
    const t = setTimeout(() => setLoading(false), 15000);
    return () => clearTimeout(t);
  }, [manual.pdfUrl]);

  /* Is manual ke saath attached forms (manual-form, action:get). Manual ke
     response me bhi aati hain, magar yahan taza laate hain taake Super Admin
     me abhi abhi add ki gayi form bhi foran dikhe. */
  const [forms, setForms] = useState(manual.forms || []);
  const [formsLoading, setFormsLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setFormsLoading(true);
    getForms(manual.id)
      .then((list) => { if (alive) setForms(list); })
      .catch(() => { /* forms best-effort — manual phir bhi khulta rahe */ })
      .finally(() => { if (alive) setFormsLoading(false); });
    return () => { alive = false; };
  }, [manual.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      /* In full-screen mode, Esc exits full-screen first. A second Esc
         closes the modal entirely. */
      if (fullScreen) setFullScreen(false);
      else            onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, fullScreen]);

  return createPortal((
    <div
      className={`sops-modal-back${fullScreen ? ' sops-modal-back--fs' : ''}`}
      role="dialog" aria-modal="true" aria-labelledby="sops-pdf-title"
      onMouseDown={(e) => { if (!fullScreen && e.target === e.currentTarget) onClose(); }}
    >
      <div className={`sops-modal sops-modal--lg${fullScreen ? ' sops-modal--fs' : ''}`}>
        <div className="sops-modal-head" style={{ background: 'linear-gradient(135deg,#7F1D1D,#B91C1C)' }}>
          <div className="sops-modal-head-l">
            <div className="sops-modal-icn"><i className="fa-solid fa-file-pdf" aria-hidden="true"></i></div>
            <div>
              <div className="sops-modal-title" id="sops-pdf-title">{manual.title}</div>
              <div className="sops-modal-sub">
                <span className="sops-badge sops-badge--blue">{manual.categoryLabel || ""}</span>
              </div>
            </div>
          </div>
          <Tooltip text={fullScreen ? 'Exit full screen (Esc)' : 'Close (Esc)'}>
            <button className="sops-modal-x" onClick={fullScreen ? () => setFullScreen(false) : onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="sops-modal-body">
          {/* Meta — Pages + Last Updated. "Pages" khane me is manual ki forms
              ki tadaad aati hai (API page count bhejti hi nahi). */}
          {!fullScreen && (
            <div className="sops-pdf-meta">
              <div className="sops-pdf-meta-item">
                <span className="sops-pdf-meta-lbl">Pages</span>
                <span className="sops-pdf-meta-val">{forms.length}</span>
              </div>
              <div className="sops-pdf-meta-item">
                <span className="sops-pdf-meta-lbl">Last Updated</span>
                <span className="sops-pdf-meta-val">{manual.lastUpdated}</span>
              </div>
            </div>
          )}

          {/* ── Attached forms (manual-form API) ── */}
          {!fullScreen && (
            <div style={{ margin: '0 0 14px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                <i className="fa-solid fa-paperclip" style={{ marginRight: 6, color: '#1E40AF' }} aria-hidden="true"></i>
                Attached Forms
              </div>
              {formsLoading ? (
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} aria-hidden="true"></i> Loading forms…
                </div>
              ) : forms.length === 0 ? (
                <div style={{ fontSize: 12, color: '#64748B' }}>No forms attached to this manual.</div>
              ) : forms.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 6, background: '#F8FAFC' }}>
                  <i className="fa-solid fa-file-lines" style={{ color: '#1E40AF' }} aria-hidden="true"></i>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.title}{f.code ? ` · ${f.code}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.desc || f.fileName}{f.pageRef ? ` · ${f.pageRef}` : ''}
                    </div>
                  </div>
                  {f.fileUrl && (
                    <Tooltip text="Open / download this form">
                      <a className="sops-btn sops-btn-ghost" href={f.fileUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                        <i className="fa-solid fa-download" aria-hidden="true"></i>
                      </a>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PDF area — PDF na ho to iframe lagate hi nahi, warna uska `onLoad`
              kabhi nahi chalta aur spinner hamesha ghoomta rehta hai. */}
          <div className="sops-pdf-area">
            {!manual.pdfUrl ? (
              <div className="sops-pdf-loading">
                <i className="fa-solid fa-file-circle-xmark" style={{ fontSize: 26, opacity: 0.35 }} aria-hidden="true"></i>
                <span>No PDF uploaded for this manual yet.</span>
              </div>
            ) : (
              <>
                {loading && (
                  <div className="sops-pdf-loading">
                    <div className="sops-spinner" aria-hidden="true"></div>
                    <span>Loading PDF…</span>
                  </div>
                )}
                <iframe
                  className="sops-pdf-frame"
                  src={manual.pdfUrl}
                  title={`${manual.title} PDF preview`}
                  onLoad={() => setLoading(false)}
                  onError={() => setLoading(false)}
                />
              </>
            )}
          </div>
        </div>

        <div className="sops-modal-foot">
          {fullScreen ? (
            <Tooltip text="Exit full screen view (Esc)">
              <button
                type="button"
                className="sops-btn sops-btn-primary"
                onClick={() => setFullScreen(false)}
              >
                <i className="fa-solid fa-compress" aria-hidden="true"></i> Exit Full Screen
              </button>
            </Tooltip>
          ) : (
            <>
              <Tooltip text="Close manual viewer">
                <button type="button" className="sops-btn sops-btn-ghost" onClick={onClose}>Close</button>
              </Tooltip>
              <Tooltip text="Expand the PDF to full screen">
                <button
                  type="button"
                  className="sops-btn sops-btn-primary"
                  onClick={() => setFullScreen(true)}
                >
                  <i className="fa-solid fa-expand" aria-hidden="true"></i> View Full Screen
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   TUTORIAL MODAL
   ═══════════════════════════════════════════════════════════════════ */
function TutorialModal({ manual, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!manual.hasTutorial) return null;

  return createPortal((
    <div
      className="sops-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="sops-tut-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sops-modal">
        <div className="sops-modal-head" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
          <div className="sops-modal-head-l">
            <div className="sops-modal-icn"><i className="fa-solid fa-play-circle" aria-hidden="true"></i></div>
            <div>
              <div className="sops-modal-title" id="sops-tut-title">{manual.title} — Tutorial</div>
              <div className="sops-modal-sub">{manual.categoryLabel ? `${manual.categoryLabel} · ` : ""}Video walkthrough</div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="sops-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="sops-modal-body">
          {/* 16:9 video */}
          <div className="sops-video-wrap">
            <iframe
              className="sops-video"
              /* Video ka link manual ke apne record se (Super Admin me set hota
                 hai) — pehle yahan ek fixed demo link laga hua tha. */
              src={manual.videoUrl}
              title={`${manual.title} tutorial`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Below video — title/description manual ke apne record se. */}
          <div className="sops-tut-info">
            <div className="sops-tut-h">
              <span className="sops-tut-title">{manual.videoTitle || manual.title}</span>
              {manual.videoLink && (
                <a className="sops-tut-chip" href={manual.videoLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <i className="fa-solid fa-up-right-from-square" aria-hidden="true"></i> Open on YouTube
                </a>
              )}
            </div>
            <div className="sops-tut-body">
              {manual.videoDesc || 'This tutorial walks you through the procedure covered in this manual.'}
            </div>
          </div>
        </div>

        <div className="sops-modal-foot">
          <Tooltip text="Close tutorial">
            <button type="button" className="sops-btn sops-btn-ghost" onClick={onClose}>Close</button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}


/* ═══════════════════════════════════════════════════════════════════
   Module CSS — self-contained brand-blue chrome
   ═══════════════════════════════════════════════════════════════════ */
const SOPS_CSS = `
:root {
  --sops-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
}

@keyframes sopsFade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }

/* ─── Info banner ─── */
.sops-banner {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  margin-bottom: 14px;
}
.sops-banner-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .28);
}
.sops-banner-body {
  font-family: var(--sops-font);
  font-size: 13px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.55;
}
[data-theme="dark"] .sops-banner-body { color: #BFDBFE; }

/* ─── Stats ─── */
.sops-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.sops-stat {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  transition: all .2s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
[data-theme="dark"] .sops-stat {
  background: var(--bg-card, #0F172A);
  border-color: var(--border-light, rgba(255,255,255,.08));
}
.sops-stat:hover { border-color: #CBD5E1; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15, 23, 42, .06); }
.sops-stat-ic {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  margin-bottom: 6px;
}
.sops-stat--blue   .sops-stat-ic { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.sops-stat--green  .sops-stat-ic { background: rgba(21, 128, 61, .12); color: #15803D; }
.sops-stat--amber  .sops-stat-ic { background: rgba(217, 119, 6, .12); color: #92400E; }
.sops-stat--indigo .sops-stat-ic { background: rgba(67, 56, 202, .12); color: #4338CA; }
.sops-stat-lbl {
  font-family: var(--sops-font);
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
.sops-stat-val {
  font-family: var(--sops-font);
  font-size: 22px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.02em;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  margin: 2px 0;
  word-break: break-word;
}
[data-theme="dark"] .sops-stat-val { color: var(--text-primary, #E2E8F0); }
.sops-stat-sub {
  font-family: var(--sops-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.3;
}

/* ─── Category tabs ─── */
.sops-cats {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 4px;
  margin-bottom: 14px;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, .04));
}
[data-theme="dark"] .sops-cats { background: var(--bg-card, #0F172A); }
.sops-cat {
  flex: 1; min-width: 160px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-family: var(--sops-font);
  font-size: 13px;
  font-weight: 700;
  color: #64748B;
  cursor: pointer;
  transition: all .2s ease;
}
.sops-cat:hover:not(.on) { background: #F8FAFF; color: #1E40AF; }
[data-theme="dark"] .sops-cat:hover:not(.on) { background: rgba(255,255,255,.03); }
.sops-cat.on {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 6px 20px rgba(30, 58, 138, .4), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.sops-cat i { font-size: 12px; }
.sops-cat-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(100, 116, 139, .14);
  color: #475569;
  font: 700 10.5px/1 var(--sops-font);
  letter-spacing: .02em;
}
.sops-cat.on .sops-cat-count { background: rgba(255, 255, 255, .25); color: #fff; }

/* ─── Filter bar ─── */
.sops-filters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.sops-search {
  position: relative;
  display: flex;
  align-items: center;
}
.sops-search-ic {
  position: absolute;
  left: 13px;
  color: #94A3B8;
  font-size: 12px;
  pointer-events: none;
}
.sops-search-input {
  width: 100%;
  height: 38px;
  padding: 0 36px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  background: #fff;
  color: #0F172A;
  font-family: var(--sops-font);
  font-size: 13px;
  font-weight: 500;
  transition: all .15s ease;
}
[data-theme="dark"] .sops-search-input {
  background: var(--bg-card, #0F172A);
  color: var(--text-primary, #E2E8F0);
  border-color: var(--border-light, rgba(255,255,255,.08));
}
.sops-search-input::placeholder { color: #94A3B8; }
.sops-search-input:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30, 58, 138, .12); }
.sops-search-clear {
  position: absolute;
  right: 7px;
  width: 24px; height: 24px;
  border: none;
  background: #F1F5F9;
  border-radius: 6px;
  color: #64748B;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all .15s ease;
}
.sops-search-clear:hover { background: #E2E8F0; color: #0F172A; }
.sops-select {
  height: 38px;
  padding: 0 30px 0 12px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  color: #0F172A;
  font-family: var(--sops-font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: all .15s ease;
}
[data-theme="dark"] .sops-select {
  background-color: var(--bg-card, #0F172A);
  color: var(--text-primary, #E2E8F0);
  border-color: var(--border-light, rgba(255,255,255,.08));
}
.sops-select:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30, 58, 138, .12); }

/* ─── Buttons ─── */
.sops-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: var(--sops-font);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: -.005em;
  cursor: pointer;
  transition: all .18s ease;
  white-space: nowrap;
}
.sops-btn-sm { height: 32px; padding: 0 12px; font-size: 11.5px; }
.sops-btn i { font-size: 11px; }
.sops-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .28); }
.sops-btn-primary {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .28), inset 0 1px 0 rgba(255, 255, 255, .14);
}
.sops-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(30, 58, 138, .38);
}
.sops-btn-ghost {
  background: #fff;
  color: #1E293B;
  border-color: #E2E8F0;
}
[data-theme="dark"] .sops-btn-ghost { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.sops-btn-ghost:hover:not(:disabled) { background: #F1F5F9; border-color: #CBD5E1; color: #1E40AF; }
.sops-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ─── Table ─── */
.sops-table {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
[data-theme="dark"] .sops-table {
  background: var(--bg-card, #0F172A);
  border-color: var(--border-light, rgba(255,255,255,.08));
}
.sops-table-head {
  display: grid;
  grid-template-columns: 50px 1fr 70px 130px 220px;
  gap: 12px;
  padding: 12px 16px;
  background: #F8FAFF;
  border-bottom: 1px solid #E2E8F0;
  font-family: var(--sops-font);
  font-size: 10.5px;
  font-weight: 700;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
[data-theme="dark"] .sops-table-head { background: rgba(255,255,255,.03); border-color: var(--border-light); }
.sops-table-head .th.c { text-align: center; }

.sops-rowwrap {
  border-bottom: 1px solid #F1F5F9;
  transition: background .15s ease;
}
[data-theme="dark"] .sops-rowwrap { border-color: var(--border-light); }
.sops-rowwrap:last-child { border-bottom: none; }
.sops-rowwrap:hover { background: #FAFBFF; }
[data-theme="dark"] .sops-rowwrap:hover { background: rgba(255,255,255,.03); }
.sops-rowwrap.open { background: #F8FAFF; }
[data-theme="dark"] .sops-rowwrap.open { background: rgba(255,255,255,.04); }

.sops-row {
  display: grid;
  grid-template-columns: 50px 1fr 70px 130px 220px;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  min-height: 58px;
}
.sops-row .td.c { text-align: center; display: flex; align-items: center; justify-content: center; }
.sops-sno-cell {
  font-family: var(--sops-font);
  font-size: 12px;
  font-weight: 700;
  color: #94A3B8;
}
.sops-title-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}
.sops-title-text {
  font-family: var(--sops-font);
  font-size: 13px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -.01em;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
}
[data-theme="dark"] .sops-title-text { color: var(--text-primary, #E2E8F0); }
.sops-pages { font-family: var(--sops-font); font-size: 12px; font-weight: 600; color: #64748B; }
.sops-updated { font-family: var(--sops-font); font-size: 12px; font-weight: 500; color: #64748B; }
.sops-actions { display: inline-flex; gap: 6px; justify-content: flex-end; }

/* ─── Category badge (only chip still used — in PDF modal header) ─── */
.sops-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-family: var(--sops-font);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .03em;
  line-height: 1;
  white-space: nowrap;
}
.sops-badge--blue  { background: rgba(30, 64, 175, .14); color: #1E40AF; }

/* ─── Empty state ─── */
.sops-empty {
  padding: 48px 24px;
  text-align: center;
  background: #fff;
  border: 1.5px dashed #CBD5E1;
  border-radius: 14px;
}
[data-theme="dark"] .sops-empty { background: var(--bg-card, #0F172A); border-color: var(--border-light, rgba(255,255,255,.08)); }
.sops-empty-ic {
  width: 56px; height: 56px;
  margin: 0 auto 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(30, 64, 175, .12), rgba(30, 64, 175, .04));
  color: #1E40AF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.sops-empty-title {
  font-family: var(--sops-font);
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
}
[data-theme="dark"] .sops-empty-title { color: var(--text-primary, #E2E8F0); }
.sops-empty-sub {
  font-family: var(--sops-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #64748B;
  margin: 6px auto 0;
  max-width: 380px;
}

/* ─── Modal shell ─── */
.sops-modal-back {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 26, .55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: sopsFade .14s ease-out;
}
.sops-modal {
  width: min(720px, 100%);
  max-height: 92vh;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(8, 13, 26, .35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--sops-font);
  animation: sopsPop .18s cubic-bezier(.2, .8, .2, 1);
}
[data-theme="dark"] .sops-modal { background: var(--bg-card, #0F172A); }
.sops-modal--lg { width: min(860px, 100%); }

/* Full-screen mode — modal grows to fill the viewport edge-to-edge,
   iframe fills the body so reading is comfortable. */
.sops-modal-back--fs { padding: 0; }
.sops-modal--fs {
  width: 100% !important;
  height: 100vh;
  max-height: 100vh;
  border-radius: 0;
}
.sops-modal--fs .sops-modal-body { padding: 14px 22px; }
.sops-modal--fs .sops-pdf-area { min-height: 0; height: 100%; flex: 1; }
.sops-modal--fs .sops-pdf-frame { height: 100%; min-height: calc(100vh - 180px); }
@keyframes sopsPop {
  from { transform: translateY(8px) scale(.985); opacity: 0; }
  to   { transform: translateY(0)   scale(1);    opacity: 1; }
}
.sops-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 22px;
  color: #fff;
  flex-shrink: 0;
}
.sops-modal-head-l { display: flex; align-items: center; gap: 14px; min-width: 0; }
.sops-modal-icn {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .15);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
}
.sops-modal-title {
  font-family: var(--sops-font);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -.01em;
  line-height: 1.3;
  word-break: break-word;
}
.sops-modal-sub {
  font-family: var(--sops-font);
  font-size: 11.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, .85);
  margin-top: 4px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.sops-modal-sub .sops-badge { background: rgba(255, 255, 255, .25); color: #fff; }
.sops-modal-x {
  width: 34px; height: 34px;
  border: none;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  transition: background .15s ease;
}
.sops-modal-x:hover { background: rgba(255, 255, 255, .22); }
.sops-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  background: #F0F4FF;
}
[data-theme="dark"] .sops-modal-body { background: rgba(255,255,255,.03); }
.sops-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  background: #fff;
  border-top: 1px solid #E2E8F0;
  flex-shrink: 0;
}
[data-theme="dark"] .sops-modal-foot { background: var(--bg-card); border-color: var(--border-light); }
.sops-modal-foot--split { justify-content: space-between; align-items: center; }
.sops-foot-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #EFF6FF;
  border-radius: 8px;
  font-family: var(--sops-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #1E40AF;
}
[data-theme="dark"] .sops-foot-note { background: rgba(30, 64, 175, .14); color: #93C5FD; }
.sops-foot-note i { font-size: 11px; }

/* PDF meta + iframe */
.sops-pdf-meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
  margin-bottom: 12px;
}
[data-theme="dark"] .sops-pdf-meta { background: var(--bg-card); border-color: var(--border-light); }
.sops-pdf-meta-item { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sops-pdf-meta-lbl {
  font-family: var(--sops-font);
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #94A3B8;
  line-height: 1;
}
.sops-pdf-meta-val {
  font-family: var(--sops-font);
  font-size: 12.5px;
  font-weight: 700;
  color: #0F172A;
}
[data-theme="dark"] .sops-pdf-meta-val { color: var(--text-primary); }

.sops-pdf-area {
  position: relative;
  background: #F8FAFF;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
  overflow: hidden;
  min-height: 520px;
}
[data-theme="dark"] .sops-pdf-area { background: rgba(255,255,255,.03); border-color: var(--border-light); }
.sops-pdf-frame {
  width: 100%;
  height: 520px;
  border: none;
  display: block;
}
.sops-pdf-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: var(--sops-font);
  font-size: 12.5px;
  font-weight: 600;
  color: #64748B;
  background: rgba(248, 250, 255, .92);
  pointer-events: none;
}
[data-theme="dark"] .sops-pdf-loading { background: rgba(15, 23, 42, .92); color: #94A3B8; }
[data-theme="dark"] .sops-spinner { border-color: rgba(147, 197, 253, .2); border-top-color: #93C5FD; }
[data-theme="dark"] .sops-pdf-meta-lbl { color: #94A3B8; }
[data-theme="dark"] .sops-pdf-area .sops-pdf-frame { background: #fff; }
[data-theme="dark"] .sops-banner { background: linear-gradient(135deg, rgba(30, 64, 175, .14), rgba(30, 64, 175, .08)); border-color: rgba(147, 197, 253, .18); }
[data-theme="dark"] .sops-search-clear { background: rgba(255,255,255,.06); color: #CBD5E1; }
[data-theme="dark"] .sops-search-clear:hover { background: rgba(255,255,255,.12); color: #fff; }
[data-theme="dark"] .sops-stat-lbl { color: #94A3B8; }
[data-theme="dark"] .sops-stat-sub { color: #94A3B8; }
[data-theme="dark"] .sops-pages, [data-theme="dark"] .sops-updated { color: #CBD5E1; }
[data-theme="dark"] .sops-tut-chip { background: rgba(30, 64, 175, .22); color: #93C5FD; }
[data-theme="dark"] .sops-empty-sub { color: #94A3B8; }
.sops-spinner {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 3px solid rgba(30, 64, 175, .2);
  border-top-color: #1E40AF;
  animation: sopsSpin .9s linear infinite;
}
@keyframes sopsSpin { to { transform: rotate(360deg); } }

/* Tutorial video */
.sops-video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: #0F172A;
  margin-bottom: 14px;
}
.sops-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}
.sops-tut-info {
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
  padding: 14px 16px;
}
[data-theme="dark"] .sops-tut-info { background: var(--bg-card); border-color: var(--border-light); }
.sops-tut-h {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.sops-tut-title {
  font-family: var(--sops-font);
  font-size: 14px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
}
[data-theme="dark"] .sops-tut-title { color: var(--text-primary); }
.sops-tut-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  background: #EFF6FF;
  color: #1E40AF;
  font-family: var(--sops-font);
  font-size: 10.5px;
  font-weight: 800;
}
.sops-tut-chip--auto { background: rgba(21, 128, 61, .14); color: #15803D; }
.sops-tut-chip i { font-size: 9px; }
.sops-tut-body {
  font-family: var(--sops-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.6;
}
[data-theme="dark"] .sops-tut-body { color: #CBD5E1; }

/* ═══ Report viewer ═══ */
.sops-rv {
  position: fixed;
  inset: 0;
  background: var(--bg-page, #F0F4FF);
  z-index: 9000;
  overflow-y: auto;
  font-family: var(--sops-font);
}
[data-theme="dark"] .sops-rv { background: var(--bg-page, #0B1220); }
.sops-rv-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  background: #fff;
  border-bottom: 1px solid #E2E8F0;
  position: sticky;
  top: 0;
  z-index: 5;
}
[data-theme="dark"] .sops-rv-toolbar { background: var(--bg-card); border-color: var(--border-light); }
.sops-rv-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: 1.5px solid #E2E8F0;
  background: #fff;
  color: #475569;
  border-radius: 999px;
  font-family: var(--sops-font);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
}
[data-theme="dark"] .sops-rv-back { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.sops-rv-back:hover { border-color: #1E40AF; color: #1E40AF; background: #EFF6FF; }
.sops-rv-title {
  flex: 1;
  text-align: center;
  font-family: var(--sops-font);
  font-size: 14px;
  font-weight: 800;
  color: #0F172A;
}
[data-theme="dark"] .sops-rv-title { color: var(--text-primary); }
.sops-rv-actions { display: inline-flex; gap: 8px; align-items: center; }
.sops-rv-bw {
  display: inline-flex;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 3px;
}
[data-theme="dark"] .sops-rv-bw { background: rgba(255,255,255,.04); border-color: var(--border-light); }
.sops-rv-bw-btn {
  height: 26px;
  padding: 0 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-family: var(--sops-font);
  font-size: 11.5px;
  font-weight: 700;
  color: #64748B;
  cursor: pointer;
  transition: all .15s ease;
}
.sops-rv-bw-btn.on { background: #fff; color: #1E40AF; box-shadow: 0 1px 3px rgba(15, 23, 42, .08); }
[data-theme="dark"] .sops-rv-bw-btn.on { background: var(--bg-card); color: #93C5FD; }
.sops-rv-print {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  font-family: var(--sops-font);
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  box-shadow: 0 3px 8px rgba(30, 58, 138, .25);
  transition: all .15s ease;
}
.sops-rv-print:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(30, 58, 138, .35); }
.sops-rv-print i { font-size: 11px; }

.sops-rv-sheet-wrap {
  display: flex;
  justify-content: center;
  padding: 18px 12px 32px;
}
.sops-rv-sheet {
  width: 794px;
  max-width: 100%;
  min-height: 1123px;
  background: #fff;
  padding: 48px 52px;
  color: #0F172A;
  font-family: var(--sops-font);
  font-size: 12px;
  box-shadow: 0 10px 40px rgba(30, 58, 138, .18);
  border-radius: 4px;
  line-height: 1.5;
}
.sops-rv-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid #1E3A8A;
  padding-bottom: 16px;
  margin-bottom: 20px;
}
.sops-rv-head-l { display: flex; align-items: center; gap: 14px; }
.sops-rv-logo {
  width: 54px; height: 54px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1a237e, #283593);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.sops-rv-school { font-size: 20px; font-weight: 800; color: #1E3A8A; letter-spacing: -.01em; }
.sops-rv-campus { font-size: 11px; font-weight: 500; color: #64748B; margin-top: 3px; }
.sops-rv-head-r { text-align: right; }
.sops-rv-rtitle { font-size: 15px; font-weight: 800; color: #0F172A; letter-spacing: -.01em; }
.sops-rv-rgen { font-size: 10px; font-weight: 500; color: #64748B; margin-top: 4px; }
.sops-rv-meta {
  background: #F0F4FF;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px 20px;
}
.sops-rv-meta-item { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.sops-rv-meta-lbl {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #64748B;
  line-height: 1;
}
.sops-rv-meta-val { font-size: 12.5px; font-weight: 700; color: #0F172A; line-height: 1.3; }

.sops-rv-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}
.sops-rv-table thead th {
  background: #1E3A8A;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  padding: 10px 14px;
  line-height: 1.2;
  text-align: left;
}
.sops-rv-table thead th.c { text-align: center; }
.sops-rv-table thead th.r { text-align: right; }
.sops-rv-table tbody td {
  padding: 9px 14px;
  border-bottom: 1px solid #E2E8F0;
  font-size: 11.5px;
  color: #1E3A5F;
  font-weight: 500;
  vertical-align: top;
}
.sops-rv-table tbody td.c { text-align: center; }
.sops-rv-table tbody td.r { text-align: right; }
.sops-rv-table tbody td b { color: #0F172A; font-weight: 700; }
.sops-rv-table tbody tr:nth-child(even) td { background: #F8FAFF; }
.sops-rv-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: .04em;
}
.sops-rv-pill--green { background: rgba(21, 128, 61, .14); color: #15803D; }
.sops-rv-pill--blue  { background: rgba(30, 64, 175, .14); color: #1E40AF; }
.sops-rv-pill--amber { background: rgba(217, 119, 6, .14); color: #92400E; }
.sops-rv-pill--gray  { background: rgba(100, 116, 139, .14); color: #475569; }
.sops-rv-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #E2E8F0;
  margin-top: 30px;
  padding-top: 12px;
  font-size: 9.5px;
  font-weight: 500;
  color: #94A3B8;
}

/* ─── Responsive ─── */
@media (max-width: 1180px) {
  .sops-stats { grid-template-columns: repeat(2, 1fr); }
  .sops-table-head, .sops-row {
    grid-template-columns: 50px 1fr 110px 200px;
  }
  .sops-table-head > .th:nth-child(3),
  .sops-row > .td:nth-child(3) { display: none; }
}
@media (max-width: 1024px) {
  .sops-cats { gap: 3px; }
  .sops-cat { min-width: 140px; padding: 9px 12px; font-size: 12.5px; }
  .sops-rv-meta { grid-template-columns: repeat(2, 1fr); }
  .sops-pdf-meta { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .sops-stats { grid-template-columns: repeat(2, 1fr); }
  .sops-cats { flex-wrap: wrap; }
  .sops-cat { min-width: calc(50% - 4px); flex-basis: calc(50% - 4px); }
  .sops-filters { grid-template-columns: 1fr; }
  .sops-rv-toolbar { flex-wrap: wrap; gap: 10px; padding: 10px 14px; }
  .sops-rv-title { order: -1; width: 100%; text-align: left; font-size: 13px; }
  .sops-rv-sheet { padding: 32px 28px; }
  .sops-modal { width: 96vw; }
  .sops-modal--lg { width: 96vw; }
  .sops-pdf-meta { grid-template-columns: repeat(2, 1fr); }
  .sops-pdf-area { min-height: 460px; }
  .sops-pdf-frame { height: 460px; }
  .sops-tut-h { gap: 6px; }
}
@media (max-width: 720px) {
  .sops-stats { grid-template-columns: 1fr; }
  .sops-cat { min-width: 100%; flex-basis: 100%; }
  .sops-table-head { display: none; }
  .sops-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 12px 14px;
  }
  .sops-row .td.c { justify-content: flex-start; text-align: left; }
  .sops-title-cell { order: 1; }
  .sops-sno-cell {
    order: 0; align-self: flex-start;
    padding: 2px 9px; background: #F1F5F9; border-radius: 999px;
    font-size: 10.5px; font-weight: 700; color: #475569;
  }
  .sops-actions { order: 5; width: 100%; justify-content: stretch; }
  .sops-actions .sops-btn { flex: 1; justify-content: center; }
  .sops-modal-back { padding: 0; }
  .sops-modal, .sops-modal--lg { max-height: 100vh; border-radius: 0; width: 100%; }
  .sops-pdf-frame { height: 420px; }
}
@media (max-width: 600px) {
  .sops-banner { grid-template-columns: 32px 1fr; padding: 10px 12px; }
  .sops-banner-ic { width: 32px; height: 32px; font-size: 12px; }
  .sops-banner-body { font-size: 12px; }
  .sops-stats { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .sops-stat { padding: 12px 14px; }
  .sops-stat-val { font-size: 19px; }
  .sops-cats {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .sops-cats::-webkit-scrollbar { display: none; }
  .sops-cat {
    min-width: max-content;
    flex-basis: auto;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .sops-filters { grid-template-columns: 1fr; gap: 8px; }
  .sops-rv-toolbar { padding: 10px 12px; gap: 8px; }
  .sops-rv-actions { width: 100%; flex-wrap: wrap; }
  .sops-modal-head { padding: 14px 16px; gap: 10px; }
  .sops-modal-title { font-size: 14.5px; }
  .sops-modal-icn { width: 38px; height: 38px; font-size: 14px; }
  .sops-modal-body { padding: 14px 16px; }
  .sops-modal-foot { padding: 12px 16px; flex-wrap: wrap; }
  .sops-modal-foot .sops-btn { flex: 1; justify-content: center; }
  .sops-pdf-meta { grid-template-columns: 1fr; }
  .sops-pdf-area { min-height: 380px; }
  .sops-pdf-frame { height: 380px; }
  .sops-rv-sheet-wrap { padding: 12px 6px 24px; }
  .sops-rv-sheet { padding: 24px 18px; }
  .sops-rv-head { flex-direction: column; align-items: flex-start; gap: 10px; }
  .sops-rv-head-r { text-align: left; }
  .sops-rv-meta { grid-template-columns: 1fr; gap: 10px; padding: 12px 14px; }
  .sops-tut-info { padding: 12px 14px; }
  .sops-tut-title { font-size: 13px; }
}
@media (max-width: 480px) {
  .sops-stats { grid-template-columns: 1fr; }
  .sops-cat { padding: 9px 10px; font-size: 12px; }
  .sops-cat-count { min-width: 20px; height: 18px; font-size: 10px; }
  .sops-search-input { font-size: 12.5px; }
  .sops-actions { flex-direction: column; gap: 6px; }
  .sops-actions .sops-btn { width: 100%; }
  .sops-pdf-frame { height: 320px; }
  .sops-pdf-area { min-height: 320px; }
  .sops-video-wrap { border-radius: 10px; }
  .sops-modal-x { width: 30px; height: 30px; font-size: 12px; }
  .sops-rv-back { padding: 0 10px; font-size: 11.5px; }
  .sops-rv-print { padding: 0 10px; font-size: 11.5px; }
  .sops-rv-bw-btn { padding: 0 8px; font-size: 11px; }
}
`;
