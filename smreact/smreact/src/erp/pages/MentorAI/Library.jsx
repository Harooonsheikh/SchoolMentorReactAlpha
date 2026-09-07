import React, { useEffect, useMemo, useState } from 'react';
import * as mentorAiStudioService from '../../services/mentorAiStudioService';

/* ═══════════════════════════════════════════════════════════════════
   Library — saved Worksheets / Design Posts. Ported from the
   prototype's library-screen (2 tabs, search, view/download/delete).
   Lesson Plans aren't listed here — those save directly "to Portal"
   into the real Lesson Plans module instead, per the prototype.
   ═══════════════════════════════════════════════════════════════════ */

export default function Library({ toast }) {
  const [tab, setTab] = useState('worksheet');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const load = () => mentorAiStudioService.getLibraryItems().then(setItems);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => i.kind === tab && (!q || i.title?.toLowerCase().includes(q)));
  }, [items, tab, search]);

  const doDelete = async (id) => {
    await mentorAiStudioService.deleteFromLibrary(id);
    setConfirmId(null);
    load();
    toast?.('Deleted from Library');
  };

  return (
    <div className="msai-library">
      <div className="msai-tabs" style={{ maxWidth: 320 }}>
        <button type="button" className={`msai-tab${tab === 'worksheet' ? ' active' : ''}`} onClick={() => setTab('worksheet')}><i className="fa-solid fa-file-pen" aria-hidden="true" /> Worksheets</button>
        <button type="button" className={`msai-tab${tab === 'design' ? ' active' : ''}`} onClick={() => setTab('design')}><i className="fa-solid fa-palette" aria-hidden="true" /> Design Posts</button>
      </div>

      <div className="msai-lib-toolbar">
        <span>{filtered.length} saved</span>
        <input type="text" placeholder="Search library…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="msai-card msai-lib-empty">
          <i className="fa-regular fa-folder-open" aria-hidden="true" />
          <div>Nothing saved here yet — items you save from {tab === 'worksheet' ? 'Worksheets' : 'Design Studio'} will show up here.</div>
        </div>
      ) : (
        <div className="msai-lib-list">
          {filtered.map(item => (
            <div key={item.id} className="msai-lib-card">
              <div className="msai-lib-thumb"><i className={`fa-solid ${tab === 'worksheet' ? 'fa-file-pen' : 'fa-palette'}`} aria-hidden="true" />{item.pages && <span className="msai-lib-thumb-badge">{item.pages}p</span>}</div>
              <div className="msai-lib-info">
                <div className="msai-lib-title">{item.title}</div>
                <div className="msai-lib-meta">
                  {item.cls && <span>{item.cls}</span>}
                  {item.subject && <span>{item.subject}</span>}
                  {item.category && <span>{item.category}</span>}
                  {item.platform && <span>{item.platform}</span>}
                  <span>{new Date(item.savedAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</span>
                </div>
              </div>
              <div className="msai-lib-actions">
                <button type="button" className="msai-icon-btn" onClick={() => toast?.('Opening…')} aria-label="View"><i className="fa-regular fa-eye" aria-hidden="true" /></button>
                <button type="button" className="msai-icon-btn" onClick={() => toast?.('Downloading…')} aria-label="Download"><i className="fa-solid fa-download" aria-hidden="true" /></button>
                <button type="button" className="msai-icon-btn msai-icon-btn--danger" onClick={() => setConfirmId(item.id)} aria-label="Delete"><i className="fa-solid fa-trash" aria-hidden="true" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmId && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setConfirmId(null); }}>
          <div className="modal modal-sm">
            <div className="msai-panel-head"><span>Delete this item?</span></div>
            <div className="msai-panel-body">
              <p className="msai-resp-text">This can't be undone.</p>
              <div className="msai-editai-actions">
                <button type="button" className="msai-btn-secondary" onClick={() => setConfirmId(null)}>Cancel</button>
                <button type="button" className="msai-btn-primary" style={{ background: '#DC2626' }} onClick={() => doDelete(confirmId)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
