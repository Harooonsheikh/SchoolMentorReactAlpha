import React, { useCallback, useEffect, useState } from 'react';
import { usePermissions } from '../../context/PermissionsContext';import {
  listLibraryPage, getLibraryItem, renameLibraryItem, deleteLibraryItem,  onLibraryChange, getLibraryBackend,
} from './services/mentorAILibraryService';
import MarkdownMessage, { InlineMarkdown } from './MarkdownMessage';
import { WorksheetPages } from './Worksheets';
import { downloadFile } from './MentorAIShared';
import { secureMentorUrl } from './services/mentorAiApi';
/* ═══════════════════════════════════════════════════════════════════
   Library — everything saved with "Save to Library": lesson plans,
   worksheets and design posts (chats are not kept here). Backed by
   services/mentorAILibraryService.js (server library, per user; this
   device's storage until the server endpoint exists). Loads on open,
   refreshes itself whenever anything is saved/renamed/deleted, and
   "Open" re-reads the stored item so it shows exactly what was saved.
   ═══════════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 20;

// Works with: plain array (local backend) OR paginated server response
const normalizeList = (res) => ({ items: res?.items || [], total: res?.total ?? 0 });

const TABS = [  { id: 'lessonplan', label: 'Lesson Plans', icon: 'fa-chalkboard-user', from: 'Lesson Plans' },
  { id: 'worksheet', label: 'Worksheets', icon: 'fa-file-pen', from: 'Worksheets' },
  { id: 'design', label: 'Designs', icon: 'fa-palette', from: 'Design Studio' },
];

export default function Library({ toast }) {
  const { can } = usePermissions();
  const canRename = can('Mentor AI', 'Library', 'edit');
  const canDownload = can('Mentor AI', 'Library', 'download');
  const canDelete = can('Mentor AI', 'Library', 'delete');
  const [tab, setTab] = useState('lessonplan');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tabTotals, setTabTotals] = useState({});
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(null); // { id, title }
  const [savingName, setSavingName] = useState(false);
  const [viewer, setViewer] = useState(null);     // { status, item, error }

  // search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // tab ya search badle to page 1 par jao
  useEffect(() => { setPage(1); }, [tab, debouncedSearch]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus('loading');
    try {
      const res = await listLibraryPage({ type: tab, page, limit: PAGE_SIZE, search: debouncedSearch });
      const data = normalizeList(res);
      const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (page > pages) { setPage(pages); return; }
      setItems(data.items);
      setTotal(data.total);
      if (!debouncedSearch) setTabTotals(t => ({ ...t, [tab]: data.total }));
      setStatus('ready');
    } catch (e) {
      setLoadError(e?.message || 'Could not load your Library.');
      setStatus('error');
    }
  }, [tab, page, debouncedSearch]);

  const loadTabTotals = useCallback(async () => {
    try {
      const results = await Promise.all(TABS.map(t =>
        listLibraryPage({ type: t.id, page: 1, limit: 1 })
          .then(r => [t.id, normalizeList(r).total])
      ));
      setTabTotals(Object.fromEntries(results));
    } catch { /* badges optional */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTabTotals(); }, [loadTabTotals]);
  useEffect(() => onLibraryChange(() => { load({ quiet: true }); loadTabTotals(); }), [load, loadTabTotals]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeTab = TABS.find(t => t.id === tab);
  const open = async (item) => {
    setViewer({ status: 'loading', item });
    try {
      const fresh = await getLibraryItem(item.id);
      setViewer({ status: 'ready', item: fresh });
    } catch (e) {
      setViewer({ status: 'error', item, error: e?.message || 'Could not open this item.' });
    }
  };

  const doDelete = async (id) => {
    if (deleting) return;
    setDeleting(true);
    try {
       await deleteLibraryItem(id);
      setConfirmId(null);
      if (viewer?.item?.id === id) setViewer(null);
      load({ quiet: true });
      loadTabTotals();
      toast?.('Deleted from Library');
    } catch (e) {
      toast?.(e?.message || 'Could not delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const doRename = async () => {
    if (!renaming || savingName) return;
    const title = renaming.title.trim();
    if (!title) { toast?.('Title can\'t be empty.'); return; }
    setSavingName(true);
    try {
      const updated = await renameLibraryItem(renaming.id, title);
      setItems(prev => prev.map(i => (i.id === updated.id ? { ...i, title: updated.title, updatedAt: updated.updatedAt } : i)));
      if (viewer?.item?.id === updated.id) setViewer(v => ({ ...v, item: { ...v.item, title: updated.title } }));
      setRenaming(null);
      toast?.('Renamed');
    } catch (e) {
      toast?.(e?.message || 'Could not rename. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="msai-library">
      <div className="msai-tabs">
        {TABS.map(t => (
          <button key={t.id} type="button" className={`msai-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <i className={`fa-solid ${t.icon}`} aria-hidden="true" /> {t.label}
{tabTotals[t.id] > 0 ? <span className="msai-lib-count">{tabTotals[t.id]}</span> : null}          </button>
        ))}
      </div>

      <div className="msai-lib-toolbar">
<span>{status === 'ready' ? `${total} saved` : ' '}</span>
        <input type="text" placeholder="Search library…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search library" />
      </div>

      {status === 'ready' && getLibraryBackend() === 'local' && (
        <div className="msai-lib-note"><i className="fa-solid fa-circle-info" aria-hidden="true" /> Items are saved on this device for your account.</div>
      )}

      {status === 'loading' && (
        <div className="msai-lib-list" aria-busy="true">
          {[0, 1, 2].map(k => <div key={k} className="msai-lib-card msai-lib-skeleton" />)}
        </div>
      )}

      {status === 'error' && (
        <div className="msai-card msai-lib-empty">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <div>{loadError}</div>
          <button type="button" className="msai-btn-primary" onClick={() => load()}><i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try again</button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
                <div className="msai-card msai-lib-empty">
          <i className="fa-regular fa-folder-open" aria-hidden="true" />
          <div>{search.trim()
            ? `No saved ${activeTab.label.toLowerCase()} match “${search.trim()}”.`
            : `Nothing saved here yet — use “Save to Library” in ${activeTab.from} and it will show up here.`}</div>
        </div>
      )}

      {status === 'ready' && items.length > 0 && (
        <div className="msai-lib-list">
          {items.map(item => (
            <div key={item.id} className="msai-lib-card">
              <button type="button" className="msai-lib-thumb" onClick={() => open(item)} aria-label={`Open ${item.title}`}>
                <Thumb item={item} icon={activeTab.icon} />
              </button>
              <div className="msai-lib-info">
                <button type="button" className="msai-lib-title" onClick={() => open(item)} title={item.title}>{item.title}</button>
                <div className="msai-lib-meta">
                  {metaOf(item).map(m => <span key={m}>{m}</span>)}
                  {item.createdAt && <span>{formatDate(item.createdAt)}</span>}
                </div>
              </div>
              <div className="msai-lib-actions">
                <button type="button" className="msai-icon-btn" onClick={() => open(item)} aria-label="Open"><i className="fa-regular fa-eye" aria-hidden="true" /></button>
                <button type="button" className="msai-icon-btn" onClick={() => setRenaming({ id: item.id, title: item.title })} aria-label="Rename"><i className="fa-solid fa-pen" aria-hidden="true" /></button>
                <button type="button" className="msai-icon-btn" onClick={() => downloadItem(item, toast)} aria-label="Download"><i className="fa-solid fa-download" aria-hidden="true" /></button>
                <button type="button" className="msai-icon-btn msai-icon-btn--danger" onClick={() => setConfirmId(item.id)} aria-label="Delete"><i className="fa-solid fa-trash" aria-hidden="true" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'ready' && totalPages > 1 && (
        <div className="msai-lib-pager">
          <button type="button" className="msai-btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <i className="fa-solid fa-chevron-left" aria-hidden="true" /> Prev
          </button>
          <span>Page {page} of {totalPages} · Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
          <button type="button" className="msai-btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}

      {viewer && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setViewer(null); }}>
          <div className="modal msai-lib-viewer" role="dialog" aria-modal="true" aria-label={viewer.item?.title}>
            <div className="msai-panel-head">
              <span className="msai-lib-viewer-title">{viewer.item?.title}</span>
              <button type="button" className="msai-icon-btn" onClick={() => setViewer(null)} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
            <div className="msai-panel-body">
              {viewer.status === 'loading' && <div className="msai-lib-empty"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Opening…</div>}
              {viewer.status === 'error' && (
                <div className="msai-lib-empty">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  <div>{viewer.error}</div>
                  <button type="button" className="msai-btn-primary" onClick={() => open(viewer.item)}>Try again</button>
                </div>
              )}
              {viewer.status === 'ready' && <ItemView item={viewer.item} />}
            </div>
          </div>
        </div>
      )}

      {renaming && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget && !savingName) setRenaming(null); }}>
          <div className="modal modal-sm">
            <div className="msai-panel-head"><span>Rename</span></div>
            <form className="msai-panel-body" onSubmit={e => { e.preventDefault(); doRename(); }}>
              <input
                className="msai-mode-search"
                type="text"
                value={renaming.title}
                maxLength={200}
                autoFocus
                onChange={e => setRenaming(r => ({ ...r, title: e.target.value }))}
                aria-label="New title"
              />
              <div className="msai-editai-actions">
                <button type="button" className="msai-btn-secondary" onClick={() => setRenaming(null)} disabled={savingName}>Cancel</button>
                <button type="submit" className="msai-btn-primary" disabled={savingName || !renaming.title.trim()}>{savingName ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmId && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget && !deleting) setConfirmId(null); }}>
          <div className="modal modal-sm">
            <div className="msai-panel-head"><span>Delete this item?</span></div>
            <div className="msai-panel-body">
              <p className="msai-resp-text">This can't be undone.</p>
              <div className="msai-editai-actions">
                <button type="button" className="msai-btn-secondary" onClick={() => setConfirmId(null)} disabled={deleting}>Cancel</button>
                <button type="button" className="msai-btn-primary" style={{ background: '#DC2626' }} onClick={() => doDelete(confirmId)} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── helpers ─── */

function formatDate(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function metaOf(item) {
  const c = item.content || {};
  if (item.type === 'lessonplan') {
    const p = c.plan || {};
    return [p.cls, p.subject, p.duration ? `${p.duration} min` : ''].filter(Boolean);
  }
  if (item.type === 'worksheet') {
    const w = c.worksheet || {};
    return [w.cls, w.subject, w.pageContent?.length ? `${w.pageContent.length}p` : ''].filter(Boolean);
  }
  if (item.type === 'design') {
    const p = c.post || {};
    return [p.categoryName, p.platformName].filter(Boolean);
  }
  return [];
}

function Thumb({ item, icon }) {
  const img = item.type === 'design' ? item.content?.post?.imageUrl : null;
  if (img) return <img src={img} alt="" className="msai-lib-thumb-img" />;
  return <i className={`fa-solid ${icon}`} aria-hidden="true" />;
}

function ItemView({ item }) {
  const c = item.content || {};
  if (item.type === 'lessonplan') {
    const p = c.plan || {};
    return (
      <div className="msai-lp-result">
        <div className="msai-lp-meta">{[p.cls, p.section ? `Section ${p.section}` : '', p.subject, p.unit, p.duration ? `${p.duration} minutes` : ''].filter(Boolean).join(' · ')}</div>
        {(p.sections || []).map(sec => (
          <div key={sec.key} className="msai-lp-section">
            <div className="msai-lp-section-h"><span>{sec.title}</span>{sec.mins ? <span className="msai-duration-pill msai-duration-pill--sm">{sec.mins} min</span> : null}</div>
            {sec.type === 'numbered'
              ? <ol className="msai-resp-numbered">{(sec.items || []).map((it, i) => <li key={i}><InlineMarkdown text={typeof it === 'string' ? it : JSON.stringify(it)} /></li>)}</ol>
              : <MarkdownMessage text={sec.text || ''} />}
          </div>
        ))}
      </div>
    );
  }
  if (item.type === 'worksheet') {
    const w = c.worksheet || {};
    const pdf = w.pdfUrl || w.pdf_url;
    return (
      <div className="msai-ws-result">
        <WorksheetPages worksheet={{ ...w, pageContent: Array.isArray(w.pageContent) ? w.pageContent : [] }} />
        {pdf && <div className="msai-result-actions"><a className="msai-btn-primary" href={pdf} target="_blank" rel="noreferrer"><i className="fa-regular fa-file-pdf" aria-hidden="true" /> View PDF</a></div>}
      </div>
    );
  }
  if (item.type === 'design') {
    const p = c.post || {};
    const url = p.imageUrl || p.pdfUrl;
    return (
      <div className="msai-lib-design">
        {url ? <img src={url} alt={p.headline || 'Saved design'} /> : <div className="msai-lib-empty">No image was saved with this design.</div>}
        {p.headline && <div className="msai-step-title">{p.headline}</div>}
        {p.subtext && <p className="msai-resp-text">{p.subtext}</p>}
      </div>
    );
  }
  return <pre className="msai-md-math-pending">{JSON.stringify(c, null, 2)}</pre>;
}

/* ─── Lesson plan → PDF (jsPDF) ───
   Lesson plans have no server file, so the PDF is built in the browser
   and saved straight to Downloads. Needs:  npm install jspdf  */
function plainText(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*\n?/g, ''))   // code fences → text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')                                         // any html tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                            // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                         // links → text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')                              // # headings
    .replace(/^\s*>\s?/gm, '')                                       // > quotes
    .replace(/^\s*[-*+]\s+\[( |x|X)\]\s+/gm, '• ')                   // task list
    .replace(/^\s*[-*+]\s+/gm, '• ')                                 // bullets
    .replace(/(\*\*|__)(.*?)\1/g, '$2')                              // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')                                 // italic
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$\$?([^$]+)\$\$?/g, '$1')                             // math → raw
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function downloadLessonPlanPdf(item) {
  const { jsPDF } = await import('jspdf');
  const p = item.content?.plan || {};
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const width = pageW - M * 2;
  let y = M;

  const ensure = (h) => { if (y + h > pageH - M) { doc.addPage(); y = M; } };
  const write = (text, { size = 11, bold = false, color = [15, 23, 42], gap = 4, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lh = size * 1.35;
    doc.splitTextToSize(String(text), width - indent).forEach(line => {
      ensure(lh);
      doc.text(line, M + indent, y + size);
      y += lh;
    });
    y += gap;
  };

  // Title + meta
  write(p.title || item.title || 'Lesson Plan', { size: 18, bold: true, color: [30, 58, 138], gap: 2 });
  const meta = [p.cls, p.section ? `Section ${p.section}` : '', p.subject, p.unit, p.duration ? `${p.duration} minutes` : ''].filter(Boolean).join('  |  ');
  if (meta) write(meta, { size: 10, color: [100, 116, 139], gap: 8 });
  doc.setDrawColor(191, 219, 254);
  doc.line(M, y, pageW - M, y);
  y += 14;

  // Sections
  (p.sections || []).forEach(sec => {
    ensure(40);
    write(`${sec.title || ''}${sec.mins ? `  (${sec.mins} min)` : ''}`, { size: 13, bold: true, color: [30, 64, 175], gap: 4 });
    if (sec.type === 'numbered') {
      (sec.items || []).forEach((it, i) => {
        write(`${i + 1}. ${plainText(typeof it === 'string' ? it : JSON.stringify(it))}`, { indent: 10, gap: 3 });
      });
    } else {
      plainText(sec.text).split('\n').forEach(line => {
        if (!line.trim()) { y += 4; return; }
        write(line, { indent: line.startsWith('• ') ? 10 : 0, gap: 2 });
      });
    }
    y += 10;
  });

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Mentor AI  ·  Page ${i} of ${pages}`, pageW / 2, pageH - 24, { align: 'center' });
  }

  const name = String(item.title || 'lesson-plan').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'lesson-plan';
  doc.save(`${name}.pdf`);   // saves straight to Downloads
}

function downloadItem(item, toast) {
  const c = item.content || {};
  const url = item.type === 'worksheet' ? (c.worksheet?.pdfUrl || c.worksheet?.pdf_url)
    : item.type === 'design' ? (c.post?.imageUrl || c.post?.pdfUrl) : null;
  if (url) {
    toast?.('Downloading…');
    downloadFile(url, `${item.title || 'mentor-ai'}${item.type === 'worksheet' ? '.pdf' : ''}`)
      .then(r => { if (r === 'opened') toast?.('Opened in a new tab — use Save there to keep it.'); });
    return;
  }
  if (item.type === 'worksheet' || item.type === 'design') { toast?.('No downloadable file was saved with this item.'); return; }
  if (item.type === 'lessonplan') {
    toast?.('Preparing PDF…');
    downloadLessonPlanPdf(item).catch(err => {
      console.error('Lesson plan PDF failed:', err);
      toast?.('Could not create the PDF. Please try again.');
    });
    return;
  }
  toast?.('This item cannot be downloaded.');
}
