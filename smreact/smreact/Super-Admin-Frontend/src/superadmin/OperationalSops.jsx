import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INITIAL_SOP, hasPdf, hasVideo, embedUrl } from './sopData';
import { schoolSopsApi } from './api';

/* ═══════════════════════════════════════════════════════════════════
   OPERATIONAL SOPs — Super Admin module (frontend only)

   Category "manual heads" → manuals → attached forms. Per manual: a PDF
   document, a tutorial video, and forms. Full CRUD for categories,
   manuals and forms, plus detail / PDF-reader / video / delete modals.
   Faithful port of the HTML design; all state is in-component demo state
   (see ./sopData). No backend / file storage.
   ═══════════════════════════════════════════════════════════════════ */

export default function OperationalSops({ toast }) {
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(INITIAL_SOP)));
  const [activeCat, setActiveCat] = useState(1);
  const [search, setSearch] = useState('');
  const [openForms, setOpenForms] = useState({});      // manualId → bool
  const [openDd, setOpenDd] = useState(null);          // manualId with open dots menu
  const [modal, setModal] = useState(null);

  /* (Pehle yahan ek local id-counter tha — ab ids server se aati hain.) */

  /* ── Manual Heads (categories) live API se ────────────────────────
     POST /api/AHM_School_SOPs/manual-head, action = get|insert|update|delete.
     Manuals aur forms abhi demo data hi hain (unki apni routes alag hain),
     is liye sirf `cats` ko API se replace karte hain. */
  const [catsLoading, setCatsLoading] = useState(true);
  const [savingCat, setSavingCat] = useState(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const loadCats = useCallback(async () => {
    setCatsLoading(true);
    try {
      const cats = await schoolSopsApi.listManualHeads();
      setData((d) => ({ ...d, cats }));
      /* Jo category khuli hui thi wo ab na ho to pehli par chale jao. */
      setActiveCat((cur) => (cats.some((c) => c.id === cur) ? cur : (cats[0]?.id ?? null)));
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not load manual heads', 'error');
    } finally {
      setCatsLoading(false);
    }
  }, []);

  useEffect(() => { loadCats(); }, [loadCats]);

  /* ── Manuals bhi live API se (manual-detail, action:get) ──
     Har manual head ke apne manuals hain, is liye category badalte hi
     dobara load hote hain. `data.manuals` me sirf isi head ke manuals
     rakhte hain — screen waise hi activeCat par filter karti hai. */
  const [manualsLoading, setManualsLoading] = useState(false);
  const [savingManual, setSavingManual] = useState(false);

  const loadManuals = useCallback(async (headId) => {
    if (!headId) { setData((d) => ({ ...d, manuals: [] })); return; }
    setManualsLoading(true);
    try {
      const manuals = await schoolSopsApi.listManuals(headId);
      setData((d) => ({ ...d, manuals }));
    } catch (err) {
      setData((d) => ({ ...d, manuals: [] }));
      toastRef.current?.(err?.message || 'Could not load manuals', 'error');
    } finally {
      setManualsLoading(false);
    }
  }, []);

  useEffect(() => { loadManuals(activeCat); }, [activeCat, loadManuals]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    cats: data.cats.length,
    manuals: data.manuals.length,
    pdfs: data.manuals.filter(hasPdf).length,
    forms: data.manuals.reduce((s, m) => s + (m.forms ? m.forms.length : 0), 0),
    vids: data.manuals.filter(hasVideo).length,
  }), [data]);

  const cat = data.cats.find((c) => c.id === activeCat);
  const manuals = data.manuals.filter((m) =>
    m.catId === activeCat &&
    (m.title.toLowerCase().includes(search.toLowerCase()) || (m.code || '').toLowerCase().includes(search.toLowerCase())));

  /* ── Category (Manual Head) CRUD — sab kuch API par ──
     Add → action:insert, Edit → action:update. Kaamyabi par list dobara
     API se laate hain, taake screen wahi dikhaye jo server par hai. */
  const saveCat = async (form, editId) => {
    if (savingCat) return;
    setSavingCat(true);
    try {
      await schoolSopsApi.saveManualHead(form, editId);
      toast?.(editId ? 'Manual head updated' : 'Manual head added', 'success');
      setModal(null);
      await loadCats();
    } catch (err) {
      toast?.(err?.message || 'Could not save manual head', 'error');
    } finally {
      setSavingCat(false);
    }
  };

  /* ── Manual CRUD — manual-detail API (insert / update) ── */
  const saveManual = async (form, editId) => {
    if (savingManual) return;
    setSavingManual(true);
    try {
      await schoolSopsApi.saveManual(form, editId);
      toast?.(editId ? 'Manual updated' : 'Manual added', 'success');
      setModal(null);
      /* Manual doosri category me daala/move kiya gaya ho to wahin chale jao. */
      if (form.catId && form.catId !== activeCat) setActiveCat(form.catId);
      else await loadManuals(activeCat);
      await loadCats();                 // head ka totalManuals refresh
    } catch (err) {
      toast?.(err?.message || 'Could not save manual', 'error');
    } finally {
      setSavingManual(false);
    }
  };

  /* ── Form CRUD — manual-form API (insert / update) ──
     Forms manual-detail ke get response me embedded aati hain, is liye save
     ke baad manuals dobara load kar lete hain. */
  const [savingForm, setSavingForm] = useState(false);

  /* Forms expand karte hi us manual ki forms API se (action:get) — taake
     list hamesha taza ho, chahe manual-detail ka response purana ho.
     Band karne par sirf toggle. */
  const [formsLoading, setFormsLoading] = useState({});   // manualId → bool

  const loadForms = useCallback(async (manualId) => {
    setFormsLoading((s) => ({ ...s, [manualId]: true }));
    try {
      const forms = await schoolSopsApi.listForms(manualId);
      setData((d) => ({ ...d, manuals: d.manuals.map((m) => m.id === manualId ? { ...m, forms } : m) }));
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not load forms', 'error');
    } finally {
      setFormsLoading((s) => ({ ...s, [manualId]: false }));
    }
  }, []);

  const toggleForms = useCallback((manualId) => {
    setOpenForms((o) => {
      const next = !o[manualId];
      if (next) loadForms(manualId);          // khulte waqt hi fetch
      return { ...o, [manualId]: next };
    });
  }, [loadForms]);

  const saveForm = async (manualId, form, editId) => {
    if (savingForm) return;
    setSavingForm(true);
    try {
      await schoolSopsApi.saveForm(manualId, form, editId);
      toast?.(editId ? 'Form updated' : 'Form uploaded', 'success');
      setModal(null);
      setOpenForms((o) => ({ ...o, [manualId]: true }));   // list khuli rahe
      await loadForms(manualId);
    } catch (err) {
      toast?.(err?.message || 'Could not save form', 'error');
    } finally {
      setSavingForm(false);
    }
  };

  /* ── Delete ──
     Manual head server par delete hota hai (action:delete) — kaamyabi par
     list dobara load. Manual/form abhi demo state me hain. */
  const confirmDelete = async ({ type, id, parentId }) => {
    if (type === 'cat') {
      if (savingCat) return;
      setSavingCat(true);
      try {
        await schoolSopsApi.deleteManualHead(id);
        setData((d) => ({ ...d, manuals: d.manuals.filter((m) => m.catId !== id) }));
        setModal(null);
        toast?.('Manual head deleted', 'info');
        await loadCats();
      } catch (err) {
        toast?.(err?.message || 'Could not delete manual head', 'error');
      } finally {
        setSavingCat(false);
      }
      return;
    }
    if (type === 'manual') {
      if (savingManual) return;
      setSavingManual(true);
      try {
        await schoolSopsApi.deleteManual(id, activeCat);
        setModal(null);
        toast?.('Manual deleted', 'info');
        await loadManuals(activeCat);
        await loadCats();               // head ka totalManuals refresh
      } catch (err) {
        toast?.(err?.message || 'Could not delete manual', 'error');
      } finally {
        setSavingManual(false);
      }
      return;
    }
    if (type === 'form') {
      if (savingForm) return;
      setSavingForm(true);
      try {
        await schoolSopsApi.deleteForm(id, parentId);
        setModal(null);
        toast?.('Form deleted', 'info');
        await loadForms(parentId);
      } catch (err) {
        toast?.(err?.message || 'Could not delete form', 'error');
      } finally {
        setSavingForm(false);
      }
      return;
    }
    setModal(null); toast?.('Deleted successfully', 'info');
  };

  const manualCount = (catId) => data.manuals.filter((m) => m.catId === catId).length;

  return (
    <div className="page-content" onClick={() => setOpenDd(null)}>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-book-open" /></div>
          <div>
            <div className="page-title">Operational SOPs</div>
            <div className="page-sub">Manage school operational manuals, forms, and tutorial videos by category.</div>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setModal({ type: 'cat', cat: null })}><i className="fa-solid fa-plus" /> Add New Manual Head</button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-layer-group" /></div><div className="stat-val">{stats.cats}</div><div className="stat-lbl">Manual Categories</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-book" /></div><div className="stat-val">{stats.manuals}</div><div className="stat-lbl">Total Manuals</div></div>
        <div className="stat-card s-warn"><div className="stat-icon" style={{ background: 'linear-gradient(135deg,#b91c1c,#dc2626)' }}><i className="fa-solid fa-file-pdf" /></div><div className="stat-val">{stats.pdfs}</div><div className="stat-lbl">Uploaded PDFs</div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-paperclip" /></div><div className="stat-val">{stats.forms}</div><div className="stat-lbl">Attached Forms</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-circle-play" /></div><div className="stat-val">{stats.vids}</div><div className="stat-lbl">Tutorial Videos</div></div>
      </div>

      {/* Category bar */}
      <div className="sop-cat-bar">
        {catsLoading && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tm)', padding: '8px 4px' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} /> Loading manual heads…
          </span>
        )}
        {!catsLoading && data.cats.length === 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tm)', padding: '8px 4px' }}>
            No manual heads yet — use <b>Add New Manual Head</b> to create one.
          </span>
        )}
        {!catsLoading && data.cats.map((c) => {
          const count = manualCount(c.id);
          const isActive = c.id === activeCat;
          return (
            <button key={c.id} className={`sop-cat-btn${isActive ? ' active' : ''}`} onClick={() => setActiveCat(c.id)}>
              <i className={`fa-solid fa-folder${isActive ? '-open' : ''}`} /> {c.title}
              <span className="sop-cat-count">{count}</span>
              <span className="sop-cat-edit-btn" data-tip="Edit category" onClick={(e) => { e.stopPropagation(); setModal({ type: 'cat', cat: c }); }}><i className="fa-solid fa-pen" /></span>
              {count === 0
                ? <span className="sop-cat-edit-btn" data-tip="Delete empty category" style={{ background: 'rgba(220,38,38,.18)', color: '#fca5a5' }} onClick={(e) => { e.stopPropagation(); setModal({ type: 'del', target: { type: 'cat', id: c.id }, name: c.title, label: 'Category' }); }}><i className="fa-solid fa-trash-can" /></span>
                : <span className="sop-cat-edit-btn" data-tip={`Cannot delete — has ${count} manual${count !== 1 ? 's' : ''}`} style={{ opacity: 0.35, cursor: 'not-allowed' }}><i className="fa-solid fa-trash-can" /></span>}
            </button>
          );
        })}
      </div>

      {/* Manuals table */}
      <div className="section-card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-list" /> {cat ? `${cat.title} — Manual Head Details` : 'Manual Head Details'}</div>
            <div className="card-sub">{cat ? cat.desc : 'Select a category above to view its manuals.'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="search-box" style={{ width: 210 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search manuals…" /></div>
            <button className="btn-primary" onClick={() => setModal({ type: 'manual', manual: null })}><i className="fa-solid fa-plus" /> Add New Manual Detail</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="sop-table">
            <thead><tr><th style={{ width: 44 }}>S.No.</th><th>Manual Head Title</th><th style={{ width: 140, textAlign: 'center' }}>PDF Manual</th><th style={{ width: 120, textAlign: 'center' }}>Tutorial</th><th style={{ width: 100, textAlign: 'center' }}>Action</th></tr></thead>
            <tbody>
              {manualsLoading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, opacity: 0.5, display: 'block', margin: '0 auto 10px' }} /><div style={{ fontSize: 14, fontWeight: 700 }}>Loading manuals…</div></td></tr>
              ) : manuals.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className="fa-solid fa-book" style={{ fontSize: 28, opacity: 0.2, display: 'block', margin: '0 auto 10px' }} /><div style={{ fontSize: 14, fontWeight: 700 }}>No manuals found</div><div style={{ fontSize: 12, marginTop: 4 }}>Click "+ Add New Manual Detail" to add one.</div></td></tr>
              ) : manuals.map((m, idx) => {
                const pdf = hasPdf(m); const vid = hasVideo(m); const formCount = m.forms ? m.forms.length : 0;
                return (
                  <React.Fragment key={m.id}>
                    <tr>
                      <td data-label="S.No." style={{ color: 'var(--tm)', fontWeight: 700 }}>{idx + 1}</td>
                      <td data-label="Title">
                        <div className="sop-manual-title" onClick={() => setModal({ type: 'pdf', manual: m })}>
                          <i className="fa-solid fa-book" style={{ color: 'var(--brand)', fontSize: 11, flexShrink: 0 }} /> {m.title}
                          {m.code && <span style={{ fontSize: 10, color: 'var(--tm)', fontWeight: 600, marginLeft: 6 }}>{m.code}</span>}
                          {formCount > 0 && <span className="sop-badge-form" style={{ marginLeft: 4 }}><i className="fa-solid fa-paperclip" style={{ fontSize: 8 }} /> {formCount}</span>}
                        </div>
                        {m.desc && <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 3, maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.desc}</div>}
                      </td>
                      <td data-label="PDF Manual" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                          {pdf ? <span className="sop-badge-pdf"><i className="fa-solid fa-file-pdf" style={{ fontSize: 8 }} /> PDF Uploaded</span> : <span className="sop-badge-soon">No PDF</span>}
                          <button className="sop-btn-view" style={{ background: 'linear-gradient(135deg,#b91c1c,#dc2626)', height: 27, fontSize: 11 }} onClick={() => setModal({ type: 'pdf', manual: m })}><i className="fa-solid fa-eye" /> View</button>
                        </div>
                      </td>
                      <td data-label="Tutorial" style={{ textAlign: 'center' }}>
                        {vid ? <button className="sop-btn-view" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }} onClick={() => setModal({ type: 'video', manual: m })}><i className="fa-solid fa-circle-play" /> Watch</button> : <span className="sop-badge-soon">Coming Soon</span>}
                      </td>
                      <td data-label="Action" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                          <div style={{ position: 'relative' }}>
                            <button className="sop-dots-btn" data-tip="More actions" onClick={(e) => { e.stopPropagation(); setOpenDd(openDd === m.id ? null : m.id); }}><i className="fa-solid fa-ellipsis-vertical" /></button>
                            {openDd === m.id && (
                              <div className="sop-dropdown open" onClick={(e) => e.stopPropagation()}>
                                <div className="sop-dd-item" onClick={() => { setOpenDd(null); setModal({ type: 'detail', manual: m }); }}><i className="fa-solid fa-circle-info" /> Manual Details</div>
                                <div className="sop-dd-item" onClick={() => { setOpenDd(null); setModal({ type: 'pdf', manual: m }); }}><i className="fa-solid fa-eye" /> View Manual</div>
                                <div className="sop-dd-item" onClick={() => { setOpenDd(null); setModal({ type: 'manual', manual: m }); }}><i className="fa-solid fa-pen" /> Edit</div>
                                <div className="sop-dd-item" onClick={() => { setOpenDd(null); setModal({ type: 'form', manualId: m.id, manualTitle: m.title, form: null }); }}><i className="fa-solid fa-paperclip" /> Add Form</div>
                                <div className="sop-dd-item" onClick={() => { setOpenDd(null); toggleForms(m.id); }}><i className="fa-solid fa-list" /> View Forms</div>
                                {vid && <div className="sop-dd-item" onClick={() => { setOpenDd(null); setModal({ type: 'video', manual: m }); }}><i className="fa-solid fa-circle-play" /> Watch Tutorial</div>}
                                <div className="sop-dd-item danger" onClick={() => { setOpenDd(null); setModal({ type: 'del', target: { type: 'manual', id: m.id }, name: m.title, label: 'Manual' }); }}><i className="fa-solid fa-trash-can" /> Delete</div>
                              </div>
                            )}
                          </div>
                          <button className="det-btn" data-tip="Expand forms" onClick={() => toggleForms(m.id)}><i className="fa-solid fa-chevron-down" /></button>
                        </div>
                      </td>
                    </tr>
                    {openForms[m.id] && (
                      <tr className="sop-expand-row"><td colSpan={5}>
                        <div className="sop-forms-box open">
                          <button className="sop-btn-view" style={{ height: 30, fontSize: 11.5, marginBottom: (m.forms && m.forms.length) ? 8 : 0 }} onClick={() => setModal({ type: 'form', manualId: m.id, manualTitle: m.title, form: null })}><i className="fa-solid fa-plus" /> Add Form</button>
                          {formsLoading[m.id] ? (
                            <span style={{ fontSize: 12.5, color: 'var(--tm)', marginLeft: 12 }}><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 5 }} />Loading forms…</span>
                          ) : (!m.forms || m.forms.length === 0) ? (
                            <span style={{ fontSize: 12.5, color: 'var(--tm)', marginLeft: 12 }}><i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />No forms attached yet.</span>
                          ) : m.forms.map((f) => (
                            <div className="sop-form-item" key={f.id}>
                              <div className="sop-form-icon"><i className="fa-solid fa-file" /></div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* displayTitle: naam na ho to file ka naam (sirf dikhane ke
                                    liye — Edit modal me asli, khali value hi jati hai). */}
                                <div className="sop-form-title">{f.displayTitle || f.title} <span className="sop-form-code">{f.code || ''}</span></div>
                                {/* Description na ho to attached file ka naam — API `get` me
                                    sirf formPath aata hai, is liye row khali na lage. */}
                                <div style={{ fontSize: 11, color: 'var(--tm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {f.desc || (f.fileName ? <><i className="fa-solid fa-paperclip" style={{ marginRight: 4, opacity: 0.7 }} />{f.fileName}</> : '')}
                                </div>
                              </div>
                              {f.pageRef && <span className="sop-form-ref">{f.pageRef}</span>}
                              <div style={{ display: 'flex', gap: 5 }}>
                                <button
                                  className="btn-sm"
                                  data-tip={f.fileUrl ? 'Open / download file' : 'No file attached'}
                                  style={{ height: 26, fontSize: 10.5, opacity: f.fileUrl ? 1 : 0.45, cursor: f.fileUrl ? 'pointer' : 'not-allowed' }}
                                  onClick={() => {
                                    if (!f.fileUrl) { toast?.('No file attached to this form', 'warn'); return; }
                                    window.open(f.fileUrl, '_blank', 'noopener');
                                  }}
                                ><i className="fa-solid fa-download" /></button>
                                <button className="btn-sm" data-tip="Edit form" style={{ height: 26, fontSize: 10.5 }} onClick={() => setModal({ type: 'form', manualId: m.id, manualTitle: m.title, form: f })}><i className="fa-solid fa-pen" /></button>
                                <button className="btn-sm" data-tip="Delete form" style={{ height: 26, fontSize: 10.5, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setModal({ type: 'del', target: { type: 'form', id: f.id, parentId: m.id }, name: f.displayTitle || f.title, label: 'Form' })}><i className="fa-solid fa-trash-can" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODALS ── */}
      {modal?.type === 'cat' && <CategoryModal cat={modal.cat} saving={savingCat} onClose={() => setModal(null)} onSave={saveCat} toast={toast} />}
      {modal?.type === 'manual' && <ManualModal manual={modal.manual} cats={data.cats} activeCat={activeCat} saving={savingManual} onClose={() => setModal(null)} onSave={saveManual} toast={toast} />}
      {modal?.type === 'form' && <FormModal manualId={modal.manualId} manualTitle={modal.manualTitle} form={modal.form} saving={savingForm} onClose={() => setModal(null)} onSave={saveForm} toast={toast} />}
      {modal?.type === 'detail' && <DetailModal m={modal.manual} cats={data.cats} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'manual', manual: modal.manual })} onDelete={() => setModal({ type: 'del', target: { type: 'manual', id: modal.manual.id }, name: modal.manual.title, label: 'Manual' })} onPdf={() => setModal({ type: 'pdf', manual: modal.manual })} onVideo={() => setModal({ type: 'video', manual: modal.manual })} toast={toast} />}
      {modal?.type === 'pdf' && <PdfModal m={modal.manual} onClose={() => setModal(null)} onUpload={() => setModal({ type: 'manual', manual: modal.manual })} toast={toast} />}
      {modal?.type === 'video' && <VideoModal m={modal.manual} onClose={() => setModal(null)} />}
      {modal?.type === 'del' && <DeleteModal label={modal.label} name={modal.name} onClose={() => setModal(null)} onConfirm={() => confirmDelete(modal.target)} />}
    </div>
  );
}

/* ═══════════════════════ SHARED ═══════════════════════ */
function Ov({ cls, wrap, wrapStyle, children, onClose }) {
  return <div className={`${cls} open`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={wrap} style={wrapStyle}>{children}</div></div>;
}
function FileRow({ icon, iconBg, label, sub, fileName, accept, onPick }) {
  const ref = useRef(null);
  return (
    <div className="sop-file-row" onClick={() => ref.current?.click()}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: iconBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}><i className={`fa-solid ${icon}`} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>{fileName || label}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{sub}</div></div>
      {/* Naam ke saath asli File bhi aage bhejo — manual-detail API PDF ko
          multipart file field (ManualPDF) ke tor par leti hai. */}
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onPick(e.target.files[0].name, e.target.files[0])} />
      <i className="fa-solid fa-upload" style={{ color: 'var(--brand)', fontSize: 14 }} />
    </div>
  );
}

/* ═══════════════════════ CATEGORY MODAL ═══════════════════════ */
function CategoryModal({ cat, saving = false, onClose, onSave, toast }) {
  const editing = Boolean(cat);
  const [f, setF] = useState({ title: cat?.title || '', desc: cat?.desc || '', status: cat?.status || 'active' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (saving) return;                       // API chal rahi hai — dobara submit nahi
    if (!f.title.trim()) { toast?.('Please enter a category name', 'warn'); return; }
    onSave({ title: f.title.trim(), desc: f.desc.trim(), status: f.status }, cat?.id);
  };
  return (
    <Ov cls="sop-cat-ov" wrap="sop-cat-modal" onClose={onClose}>
      <div className="sop-modal-hdr" style={{ borderRadius: 'var(--r-xl) var(--r-xl) 0 0' }}>
        <div className="sop-modal-icon"><i className="fa-solid fa-layer-group" /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{editing ? 'Edit Manual Head' : 'Add Manual Head'}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>Create a new category for operational manuals</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div style={{ padding: 22 }}>
        <div className="sop-field"><label><i className="fa-solid fa-heading" style={{ color: 'var(--brand)', marginRight: 4 }} /> Manual Head Name</label><input className="sop-input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Academic Manuals" /></div>
        <div className="sop-field"><label><i className="fa-solid fa-align-left" style={{ color: 'var(--brand)', marginRight: 4 }} /> Description</label><textarea className="sop-textarea" value={f.desc} onChange={(e) => set('desc', e.target.value)} placeholder="Short description of this category…" rows={2} /></div>
        <div className="sop-field"><label>Status</label><select className="sop-input" style={{ cursor: 'pointer' }} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      </div>
      <div className="sop-modal-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Close</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} />
          {saving ? ' Saving…' : (editing ? ' Save Changes' : ' + Add')}
        </button>
      </div>
    </Ov>
  );
}

/* ═══════════════════════ MANUAL MODAL ═══════════════════════ */
function ManualModal({ manual, cats, activeCat, saving = false, onClose, onSave, toast }) {
  const editing = Boolean(manual);
  const [f, setF] = useState({
    catId: manual?.catId || activeCat, code: manual?.code || '', title: manual?.title || '', desc: manual?.desc || '',
    pdfName: manual?.pdfName || '', vidTitle: manual?.vidTitle || '', vidUrl: manual?.vidUrl || '', vidDesc: manual?.vidDesc || '',
    vidStatus: manual?.vidStatus || 'coming_soon', status: manual?.status || 'active',
  });
  /* Chuni hui asli PDF file (agar is baar upload ki gayi ho). */
  const [pdfFile, setPdfFile] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (saving) return;                 // API chal rahi hai
    if (!f.catId) { toast?.('Please select a category', 'warn'); return; }
    if (!f.title.trim()) { toast?.('Please enter a manual title', 'warn'); return; }
    onSave({
      catId: Number(f.catId), title: f.title.trim(), code: f.code.trim(), desc: f.desc.trim(),
      /* Nayi file ho to wo, warna server par pada purana path jyun ka tyun. */
      pdfFile, pdfName: f.pdfName, pdfPath: pdfFile ? '' : (manual?.pdfPath || ''),
      vidTitle: f.vidTitle.trim(), vidUrl: f.vidUrl.trim(), vidDesc: f.vidDesc.trim(), vidStatus: f.vidStatus, status: f.status,
    }, manual?.id);
  };
  return (
    <Ov cls="sop-modal-ov" wrap="sop-modal" onClose={onClose}>
      <div className="sop-modal-hdr">
        <div className="sop-modal-icon"><i className="fa-solid fa-book" /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{editing ? 'Edit Manual' : 'Add Manual'}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>{editing ? manual.title : 'Create a new manual under the selected category'}</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="sop-modal-body">
        <div className="sop-2col">
          <div className="sop-field"><label>Category / Manual Head</label><select className="sop-input" style={{ cursor: 'pointer' }} value={f.catId} onChange={(e) => set('catId', e.target.value)}><option value="">Select Category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
          <div className="sop-field"><label>Manual Code / Number</label><input className="sop-input" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. ACD-001" /></div>
        </div>
        <div className="sop-field"><label>Manual Title</label><input className="sop-input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Teacher Recruitment Manual" /></div>
        <div className="sop-field"><label>Short Description</label><textarea className="sop-textarea" value={f.desc} onChange={(e) => set('desc', e.target.value)} placeholder="Brief description of this manual…" rows={2} /></div>
        <div className="sop-section-divider"><i className="fa-solid fa-file-pdf" /> Manual PDF</div>
        <FileRow icon="fa-file-pdf" iconBg="linear-gradient(135deg,#b91c1c,#dc2626)" label="Click to upload PDF manual (20–30+ pages)" sub="PDF files accepted" fileName={f.pdfName} accept=".pdf" onPick={(n, file) => { set('pdfName', n); setPdfFile(file || null); }} />
        <div className="sop-section-divider" style={{ marginTop: 16 }}><i className="fa-solid fa-circle-play" /> Tutorial Video</div>
        <div className="sop-field"><label>Video Title</label><input className="sop-input" value={f.vidTitle} onChange={(e) => set('vidTitle', e.target.value)} placeholder="e.g. Teacher Recruitment — Tutorial" /></div>
        <div className="sop-field"><label>YouTube / Video URL</label><input className="sop-input" value={f.vidUrl} onChange={(e) => set('vidUrl', e.target.value)} placeholder="https://youtube.com/embed/..." /></div>
        <div className="sop-field"><label>Video Description</label><textarea className="sop-textarea" value={f.vidDesc} onChange={(e) => set('vidDesc', e.target.value)} placeholder="Brief description of tutorial content…" rows={2} /></div>
        <div className="sop-2col" style={{ marginTop: 4 }}>
          <div className="sop-field"><label>Status</label><select className="sop-input" style={{ cursor: 'pointer' }} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          <div className="sop-field"><label>Tutorial Status</label><select className="sop-input" style={{ cursor: 'pointer' }} value={f.vidStatus} onChange={(e) => set('vidStatus', e.target.value)}><option value="available">Available</option><option value="coming_soon">Coming Soon</option></select></div>
        </div>
      </div>
      <div className="sop-modal-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} />
          {saving ? ' Saving…' : ' Save Manual'}
        </button>
      </div>
    </Ov>
  );
}

/* ═══════════════════════ FORM MODAL ═══════════════════════ */
function FormModal({ manualId, manualTitle, form, saving = false, onClose, onSave, toast }) {
  const editing = Boolean(form);
  const [f, setF] = useState({ title: form?.title || '', code: form?.code || '', pageRef: form?.pageRef || '', desc: form?.desc || '', fileName: form?.fileName || '' });
  /* Chuni hui asli file (Document field ke liye). */
  const [file, setFile] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (saving) return;
    if (!f.title.trim()) { toast?.('Please enter a form name', 'warn'); return; }
    onSave(manualId, {
      title: f.title.trim(), code: f.code.trim(), pageRef: f.pageRef.trim(), desc: f.desc.trim(),
      /* Nayi file ho to wo, warna server par pada purana path jyun ka tyun. */
      file, fileName: f.fileName, formPath: file ? '' : (form?.formPath || ''),
    }, form?.id);
  };
  return (
    <Ov cls="sop-form-ov" wrap="sop-form-modal" onClose={onClose}>
      <div className="sop-modal-hdr" style={{ borderRadius: 'var(--r-xl) var(--r-xl) 0 0' }}>
        <div className="sop-modal-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-paperclip" /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{editing ? 'Edit Form' : 'Upload Form'}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>{editing ? 'Update form details' : `Attach form to: ${manualTitle}`}</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div style={{ padding: 22 }}>
        <div className="sop-field"><label>Form Name</label><input className="sop-input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Teacher Interview Scorecard" /></div>
        <div className="sop-2col">
          <div className="sop-field"><label>Form Number / Code</label><input className="sop-input" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. FORM-001" /></div>
          <div className="sop-field"><label>Page Reference</label><input className="sop-input" value={f.pageRef} onChange={(e) => set('pageRef', e.target.value)} placeholder="e.g. Page 18" /></div>
        </div>
        <div className="sop-field"><label>Description</label><textarea className="sop-textarea" value={f.desc} onChange={(e) => set('desc', e.target.value)} placeholder="Brief description of this form…" rows={2} /></div>
        <div className="sop-section-divider"><i className="fa-solid fa-paperclip" /> Attach Document</div>
        <FileRow icon="fa-file" iconBg="linear-gradient(135deg,#0369A1,#0284C7)" label="Click to choose file (PDF, DOC, DOCX)" sub="1–2 page form document" fileName={f.fileName} accept=".pdf,.doc,.docx" onPick={(n, picked) => { set('fileName', n); setFile(picked || null); }} />
      </div>
      <div className="sop-modal-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Close</button>
        <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)', boxShadow: '0 4px 14px rgba(3,105,161,.28)' }} onClick={save} disabled={saving}>
          <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
          {saving ? ' Uploading…' : (editing ? ' Save Changes' : ' Upload')}
        </button>
      </div>
    </Ov>
  );
}

/* ═══════════════════════ DETAIL MODAL ═══════════════════════ */
function DetailModal({ m, cats, onClose, onEdit, onDelete, onPdf, onVideo, toast }) {
  const cat = cats.find((c) => c.id === m.catId);
  const pdf = hasPdf(m); const vid = hasVideo(m); const forms = m.forms || [];
  return (
    <Ov cls="sop-det-ov" wrap="sop-det-modal" onClose={onClose}>
      <div className="sop-det-hdr">
        <div className="sop-det-av"><i className="fa-solid fa-book" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{m.title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span><i className="fa-solid fa-layer-group" style={{ color: 'var(--brand)' }} /> {cat ? cat.title : '—'}</span>
            {m.code && <span><i className="fa-solid fa-hashtag" style={{ color: 'var(--brand)' }} /> {m.code}</span>}
            <span><i className="fa-regular fa-calendar" style={{ color: 'var(--brand)' }} /> {m.createdAt || '—'}</span>
            <span className={`badge ${m.status === 'active' ? 'b-green' : 'b-gray'}`}>{m.status === 'active' ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="sop-det-body">
        <div className="sop-det-section">
          <div className="sop-det-section-title"><i className="fa-solid fa-align-left" /> Description</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>{m.desc || 'No description available.'}</div>
        </div>
        <div className="sop-det-section">
          <div className="sop-det-section-title"><i className="fa-solid fa-file-pdf" /> Manual PDF</div>
          {pdf ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#b91c1c,#dc2626)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}><i className="fa-solid fa-file-pdf" /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>{m.pdfName || 'Manual PDF'}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>Detailed manual document</div></div>
              <button className="sop-btn-view" style={{ background: 'linear-gradient(135deg,#b91c1c,#dc2626)' }} onClick={onPdf}><i className="fa-solid fa-eye" /> View</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--tm)', fontSize: 12.5, background: 'var(--muted)', borderRadius: 'var(--r-md)' }}><i className="fa-solid fa-file-pdf" style={{ opacity: 0.3, fontSize: 22, display: 'block', marginBottom: 6 }} />No PDF uploaded yet. <button className="btn-sm" style={{ height: 26, fontSize: 11, marginLeft: 6 }} onClick={onEdit}><i className="fa-solid fa-upload" /> Upload</button></div>
          )}
        </div>
        <div className="sop-det-section">
          <div className="sop-det-section-title"><i className="fa-solid fa-paperclip" /> Attached Forms</div>
          {forms.length ? forms.map((f) => (
            <div className="sop-form-item" key={f.id}>
              <div className="sop-form-icon"><i className="fa-solid fa-file" /></div>
              <div className="sop-form-title">{f.displayTitle || f.title} <span className="sop-form-code">{f.code || ''}</span></div>
              {f.pageRef && <span className="sop-form-ref">{f.pageRef}</span>}
              <button className="btn-sm" data-tip="Download" style={{ height: 26, fontSize: 10.5 }} onClick={() => toast?.('Download after backend integration', 'info')}><i className="fa-solid fa-download" /></button>
            </div>
          )) : <div style={{ textAlign: 'center', padding: 12, color: 'var(--tm)', fontSize: 12.5 }}>No forms attached.</div>}
        </div>
        <div className="sop-det-section">
          <div className="sop-det-section-title"><i className="fa-solid fa-circle-play" /> Tutorial Video</div>
          {vid ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(22,163,74,.06)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#15803d,#16a34a)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}><i className="fa-solid fa-circle-play" /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>{m.vidTitle || 'Tutorial Video'}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{m.vidDesc || ''}</div></div>
              <button className="sop-btn-view" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }} onClick={onVideo}><i className="fa-solid fa-circle-play" /> Watch</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}><span className="sop-badge-soon"><i className="fa-solid fa-clock" /> Tutorial Coming Soon</span><span style={{ fontSize: 12, color: 'var(--tm)' }}>{m.vidTitle || 'Tutorial not yet available'}</span></div>
          )}
        </div>
      </div>
      <div className="sop-det-foot">
        <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Close</button>
        <button className="btn-sm" onClick={onEdit}><i className="fa-solid fa-pen" /> Edit Manual</button>
        <button className="btn-sm" style={{ borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={onDelete}><i className="fa-solid fa-trash-can" /> Delete</button>
      </div>
    </Ov>
  );
}

/* ═══════════════════════ PDF READER MODAL ═══════════════════════ */
function PdfModal({ m, onClose, onUpload, toast }) {
  const pdf = hasPdf(m); const forms = m.forms || [];
  return (
    <Ov cls="sop-pdf-ov" wrap="sop-pdf-wrap" onClose={onClose}>
      <div className="sop-pdf-toolbar">
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: 7 }}><i className="fa-solid fa-file-pdf" style={{ color: '#DC2626' }} /> {m.title}</div>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => window.print()}><i className="fa-solid fa-print" /> Print</button><button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
      </div>
      <div style={{ background: '#fff', maxHeight: '78vh', overflowY: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', color: '#fff', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}><i className="fa-solid fa-book" /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>{m.title}</div><div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>{m.code || ''}</div></div>
          {m.code && <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>{m.code}</div>}
        </div>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><i className="fa-solid fa-file-pdf" style={{ color: '#DC2626' }} /> Manual PDF Document</div>
          {pdf ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '14px 16px', flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg,#b91c1c,#dc2626)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}><i className="fa-solid fa-file-pdf" /></div>
              <div style={{ flex: 1, minWidth: 160 }}><div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{m.pdfName || `${m.title}.pdf`}</div><div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Detailed manual · 20–30+ pages · School Mentor</div></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => toast?.('PDF opens when a real file is uploaded. Ready for backend.', 'info')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'linear-gradient(135deg,#b91c1c,#dc2626)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><i className="fa-solid fa-eye" /> Read PDF</button>
                <button onClick={() => toast?.('Download available after backend integration', 'info')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: '#f1f5f9', color: '#1E3A8A', border: '1.5px solid #e2e8f0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><i className="fa-solid fa-download" /> Download</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', background: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: 10, padding: 28 }}>
              <i className="fa-solid fa-file-pdf" style={{ fontSize: 32, color: '#cbd5e1', display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>No PDF Uploaded Yet</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Upload a PDF manual to enable reading.</div>
              <button onClick={onUpload} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 16px', borderRadius: 8, background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 14 }}><i className="fa-solid fa-upload" /> Upload Manual PDF</button>
            </div>
          )}
        </div>
        <div style={{ padding: '18px 28px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}><i className="fa-solid fa-align-left" /> Description</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>{m.desc || 'No description available.'}</div>
        </div>
        {forms.length > 0 && (
          <div style={{ padding: '18px 28px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}><i className="fa-solid fa-paperclip" /> Attached Forms ({forms.length})</div>
            {forms.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 7 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#0369A1,#0284C7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}><i className="fa-solid fa-file" /></div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A' }}>{f.displayTitle || f.title}</div><div style={{ fontSize: 11, color: '#64748B' }}>{f.code || ''}{f.pageRef ? ` · ${f.pageRef}` : ''}</div></div>
                <button onClick={() => toast?.('Form download available after backend integration', 'info')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 12px', borderRadius: 7, background: '#EFF6FF', color: '#1E3A8A', border: '1px solid #BFDBFE', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}><i className="fa-solid fa-download" /> Download</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Ov>
  );
}

/* ═══════════════════════ VIDEO MODAL ═══════════════════════ */
function VideoModal({ m, onClose }) {
  return (
    <Ov cls="sop-vid-ov" wrap="sop-vid-modal" onClose={onClose}>
      <div className="sop-vid-toolbar">
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}><i className="fa-solid fa-circle-play" style={{ color: '#16A34A' }} /> {m.vidTitle || 'Tutorial Video'}</div>
        <button onClick={onClose} data-tip="Close" data-tip-pos="left" style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', width: 30, height: 30, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}><i className="fa-solid fa-xmark" /></button>
      </div>
      <iframe className="sop-vid-frame" title="Tutorial" src={embedUrl(m.vidUrl)} allowFullScreen />
    </Ov>
  );
}

/* ═══════════════════════ DELETE MODAL ═══════════════════════ */
function DeleteModal({ label, name, onClose, onConfirm }) {
  return (
    <Ov cls="sop-del-ov" wrap="sop-del-modal" onClose={onClose}>
      <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-trash-can" /></div>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Delete {label}?</div>
      <div style={{ fontSize: 13, color: 'var(--tm)', marginBottom: 20, lineHeight: 1.6 }}>"{name}" will be permanently deleted. This action cannot be undone.</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button></div>
    </Ov>
  );
}
