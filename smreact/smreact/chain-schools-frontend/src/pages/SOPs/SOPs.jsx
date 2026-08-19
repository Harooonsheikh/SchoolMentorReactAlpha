import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import { toEmbed } from './data'
import {
  listManualHeads, saveManualHead, deleteManualHead,
  listManuals, listForms, saveManual as saveManualApi, deleteManual,
  saveManualFormDoc, deleteManualFormDoc,
} from '../../api/sopsApi'
import ContentSourceBar from '../../components/ContentSourceBar'
import { loadSource, saveSource } from '../../config/contentSource'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import './SOPs.css'

export default function SOPs() {
  /* Heads, manuals aur unki forms — sab API se (localStorage store nahi). */
  const [cats, setCats] = useState([])
  const [catsLoading, setCatsLoading] = useState(true)
  const [activeCat, setActiveCat] = useState(null)
  const [catBusy, setCatBusy] = useState(false)
  /* Cascade: head chunne par usi ke manuals, aur manual khulne par usi ki
     forms. Dono cache me rehte hain taake wapas aane par dobara call na ho. */
  const [manualsByCat, setManualsByCat] = useState({})   // { [catId]: manual[] }
  const [manualsLoading, setManualsLoading] = useState(false)
  const [formsByManual, setFormsByManual] = useState({}) // { [manualId]: form[] }
  const [formsLoading, setFormsLoading] = useState({})   // { [manualId]: true }
  const [rowBusy, setRowBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [openDd, setOpenDd] = useState(null)

  const [catModal, setCatModal] = useState(null)     // { mode, cat }
  const [manualModal, setManualModal] = useState(null) // { mode, manual }
  const [formModal, setFormModal] = useState(null)   // { mode, manualId, form }
  const [pdfView, setPdfView] = useState(null)       // manual
  const [vidView, setVidView] = useState(null)       // manual
  const [del, setDel] = useState(null)               // { type, id, parentId, name }
  const [toast, setToast] = useState(null)
  const [source, setSource] = useState('custom')
  const readOnly = source === 'mentor'

  const fire = (text, type = 'success') => setToast({ text, type })
  const changeSource = (v) => {
    setSource(v); saveSource('sops', v)
    fire(v === 'mentor' ? "Now showing School Mentor's SOPs to your schools" : 'Now showing your own SOPs to your schools')
  }

  /* Heads dobara load kar ke active selection sambhal lete hain — jo head
     abhi khula hai wo agar reh gaya to wahi rehta hai, warna pehla. */
  const reloadCats = async (preferId) => {
    const rows = await listManualHeads()
    setCats(rows)
    setActiveCat((cur) => {
      const want = Number(preferId) || cur
      return rows.some((c) => c.id === want) ? want : (rows[0]?.id ?? null)
    })
    return rows
  }

  useEffect(() => { setSource(loadSource('sops')) }, [])
  useEffect(() => {
    let alive = true
    setCatsLoading(true)
    listManualHeads()
      .then((rows) => { if (!alive) return; setCats(rows); setActiveCat((cur) => cur ?? rows[0]?.id ?? null) })
      .catch((err) => { if (alive) fire(err.message || 'Could not load manual heads', 'warn') })
      .finally(() => { if (alive) setCatsLoading(false) })
    return () => { alive = false }
  }, [])
  /* Manual head ki base par manuals — jo head khula hai sirf usi ke. */
  const reloadManuals = async (catId = activeCat) => {
    if (!catId) return []
    const rows = await listManuals(catId)
    setManualsByCat((c) => ({ ...c, [catId]: rows }))
    return rows
  }
  useEffect(() => {
    if (!activeCat || manualsByCat[activeCat]) return undefined
    let alive = true
    setManualsLoading(true)
    listManuals(activeCat)
      .then((rows) => { if (alive) setManualsByCat((c) => ({ ...c, [activeCat]: rows })) })
      .catch((err) => { if (alive) fire(err.message || 'Could not load manuals', 'warn') })
      .finally(() => { if (alive) setManualsLoading(false) })
    return () => { alive = false }
  }, [activeCat, manualsByCat])

  /* Manual detail ki base par forms — row khulne (ya viewer/Add Form) par. */
  const formsOf = (manualId) => formsByManual[manualId] || []
  const loadForms = async (manualId, force = false) => {
    if (!manualId || (!force && formsByManual[manualId])) return formsOf(manualId)
    setFormsLoading((f) => ({ ...f, [manualId]: true }))
    try {
      const rows = await listForms(manualId)
      setFormsByManual((f) => ({ ...f, [manualId]: rows }))
      return rows
    } catch (err) {
      fire(err.message || 'Could not load forms', 'warn')
      return []
    } finally {
      setFormsLoading((f) => ({ ...f, [manualId]: false }))
    }
  }

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])
  useEffect(() => { const h = () => setOpenDd(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h) }, [])

  /* ── stats ──
     Manuals ka total heads ke apne `totalManuals` se banta hai (har head ka
     data load kiye baghair). Baqi teen tiles wahi ginte hain jo abhi tak
     load hua hai — head/manual kholte jayein, ye barhte jayenge. */
  const loadedManuals = useMemo(() => Object.values(manualsByCat).flat(), [manualsByCat])
  const stats = useMemo(() => ({
    cats: cats.length,
    manuals: cats.reduce((s, c) => s + (manualsByCat[c.id]?.length ?? c.totalManuals ?? 0), 0),
    pdfs: loadedManuals.filter((m) => m.pdfPath).length,
    forms: Object.values(formsByManual).reduce((s, f) => s + f.length, 0),
    vids: loadedManuals.filter((m) => m.vidUrl && m.vidStatus === 'available').length,
  }), [cats, manualsByCat, loadedManuals, formsByManual])

  const cat = cats.find((c) => c.id === activeCat)
  const manuals = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = manualsByCat[activeCat] || []
    return rows.filter((m) => !q || m.title.toLowerCase().includes(q) || (m.code || '').toLowerCase().includes(q))
  }, [manualsByCat, activeCat, search])

  /* ── actions ── */
  /* action: insert | update — id ho to update. Server ki list hi sach hai,
     is liye save ke baad heads dobara padhte hain. */
  const saveCat = async (payload) => {
    const editId = catModal.mode === 'edit' ? catModal.cat.id : 0
    setCatBusy(true)
    try {
      const totalManuals = manualsByCat[editId]?.length ?? cats.find((c) => c.id === editId)?.totalManuals ?? 0
      await saveManualHead({ ...payload, totalManuals }, editId)
      /* Naya head list me sab se aakhir me aata hai — usi ko khol dete hain. */
      const rows = await reloadCats(editId)
      if (!editId) {
        const added = rows.find((c) => c.title === payload.title)
        if (added) setActiveCat(added.id)
      }
      fire(editId ? 'Manual head updated' : 'Manual head added')
      setCatModal(null)
    } catch (err) {
      fire(err.message || 'Could not save this manual head', 'warn')
    } finally {
      setCatBusy(false)
    }
  }
  /* manual-detail — action: insert | update. PDF sirf tab jaata hai jab nayi
     file chuni ho; warna purana PDFPath waapis bhej kar file barqarar. */
  const saveManual = async (payload) => {
    const editId = manualModal.mode === 'edit' ? manualModal.manual.id : 0
    const fromCat = manualModal.manual?.catId
    setRowBusy(true)
    try {
      await saveManualApi(payload, editId)
      /* Head badal gaya ho to purana bhi refresh — warna wahan bhoot reh jata. */
      if (fromCat && fromCat !== payload.catId) await reloadManuals(fromCat)
      await reloadManuals(payload.catId)
      setActiveCat(payload.catId)
      fire(editId ? 'Manual updated' : 'Manual added')
      setManualModal(null)
    } catch (err) {
      fire(err.message || 'Could not save this manual', 'warn')
    } finally {
      setRowBusy(false)
    }
  }
  /* manual-form — wahi chaar actions, manual ke andar attached forms. */
  const saveForm = async (payload) => {
    const { manualId, mode, form } = formModal
    setRowBusy(true)
    try {
      await saveManualFormDoc({ ...payload, manualId }, mode === 'edit' ? form.id : 0)
      await loadForms(manualId, true)
      fire(mode === 'edit' ? 'Form updated' : 'Form added')
      setFormModal(null)
    } catch (err) {
      fire(err.message || 'Could not save this form', 'warn')
    } finally {
      setRowBusy(false)
    }
  }
  /* Teenon delete aik hi confirm se — sirf route badalta hai. */
  const doDelete = async () => {
    const { type, id, parentId } = del
    const busy = type === 'cat' ? setCatBusy : setRowBusy
    busy(true)
    try {
      if (type === 'cat') {
        await deleteManualHead(id)
        setManualsByCat((c) => { const n = { ...c }; delete n[id]; return n })
        await reloadCats(activeCat === id ? 0 : activeCat)
      } else if (type === 'manual') {
        await deleteManual(id, parentId)
        await reloadManuals(parentId)
        setFormsByManual((f) => { const n = { ...f }; delete n[id]; return n })
      } else {
        await deleteManualFormDoc(id, parentId)
        await loadForms(parentId, true)
      }
      setDel(null); fire('Deleted successfully', 'info')
    } catch (err) {
      fire(err.message || 'Could not delete this record', 'warn')
      setDel(null)
    } finally {
      busy(false)
    }
  }
  /* Row khulte hi usi manual ki forms mangwa lete hain (aik hi dafa). */
  const openForms = (id) => { setExpanded((e) => ({ ...e, [id]: true })); loadForms(id) }
  /* Viewer bhi forms dikhata hai — kholte waqt wo bhi le aate hain. */
  const openManual = (mn) => { setPdfView(mn); loadForms(mn.id) }
  const toggleExpand = (id) => {
    const next = !expanded[id]
    setExpanded((e) => ({ ...e, [id]: next }))
    if (next) loadForms(id)
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-book-open" /></div>
          <div>
            <div className="page-title">Operational SOPs</div>
            <div className="page-sub">Manage school operational manuals, forms, and tutorial videos by category.</div>
          </div>
        </div>
        <TutorialButton />
        {readOnly
          ? <span className="ro-pill"><i className="fa-solid fa-eye" /> View only — School Mentor content</span>
          : <button className="btn-primary" onClick={() => setCatModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add New Manual Head</button>}
      </div>

      <ContentSourceBar kind="sops" label="SOPs" value={source} onChange={changeSource} />

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <Stat icon="fa-layer-group" val={stats.cats} lbl="Manual Categories" />
        <Stat cls="s-green" icon="fa-book" val={stats.manuals} lbl="Total Manuals" />
        <Stat cls="s-warn" icon="fa-file-pdf" iconBg="linear-gradient(135deg,#b91c1c,#dc2626)" val={stats.pdfs} lbl="Uploaded PDFs" />
        <Stat icon="fa-paperclip" iconBg="linear-gradient(135deg,#0369A1,#0284C7)" val={stats.forms} lbl="Attached Forms" />
        <Stat cls="s-green" icon="fa-circle-play" val={stats.vids} lbl="Tutorial Videos" />
      </div>

      {/* Category bar */}
      <div className="sop-cat-bar">
        {catsLoading && <span style={{ fontSize: 12.5, color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" /> Loading manual heads…</span>}
        {!catsLoading && cats.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--tm)' }}><i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />No manual heads yet.</span>}
        {cats.map((c) => {
          /* Load ho chuka ho to asli ginti, warna head ka apna totalManuals. */
          const count = manualsByCat[c.id]?.length ?? c.totalManuals ?? 0
          const isActive = c.id === activeCat
          return (
            <button key={c.id} className={`sop-cat-btn${isActive ? ' active' : ''}`} onClick={() => setActiveCat(c.id)}>
              <i className={`fa-solid fa-folder${isActive ? '-open' : ''}`} /> {c.title}
              <span className="sop-cat-count">{count}</span>
              {!readOnly && <span className="sop-cat-edit-btn" title="Edit category" onClick={(e) => { e.stopPropagation(); setCatModal({ mode: 'edit', cat: c }) }}><i className="fa-solid fa-pen" /></span>}
              {!readOnly && (count === 0
                ? <span className="sop-cat-edit-btn del" title="Delete empty category" onClick={(e) => { e.stopPropagation(); setDel({ type: 'cat', id: c.id, name: c.title }) }}><i className="fa-solid fa-trash-can" /></span>
                : <span className="sop-cat-edit-btn del dis" title={`Cannot delete — has ${count} manual${count !== 1 ? 's' : ''}`} onClick={(e) => e.stopPropagation()}><i className="fa-solid fa-trash-can" /></span>)}
            </button>
          )
        })}
      </div>

      {/* Manuals table */}
      <div className="section-card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-list" /> {cat ? `${cat.title} — Manual Head Details` : 'Manual Head Details'}</div>
            <div className="card-sub">{cat ? cat.desc : 'Select a category above to view its manuals.'}</div>
          </div>
          <div className="pay-cardhdr-actions">
            <div className="search-box" style={{ width: 210 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search manuals…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            {readOnly
              ? <span className="ro-pill"><i className="fa-solid fa-eye" /> View only</span>
              : <button className="btn-primary" onClick={() => setManualModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add New Manual Detail</button>}
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="sop-table">
            <thead><tr><th>S.No.</th><th>Manual Head Title</th><th style={{ width: 140, textAlign: 'center' }}>PDF Manual</th><th style={{ width: 120, textAlign: 'center' }}>Tutorial</th><th style={{ width: 100, textAlign: 'center' }}>Action</th></tr></thead>
            <tbody>
              {manualsLoading ? (
                <tr><td colSpan={5}><div style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, display: 'block', margin: '0 auto 10px' }} /><div style={{ fontSize: 13, fontWeight: 700 }}>Loading manuals…</div></div></td></tr>
              ) : manuals.length === 0 ? (
                <tr><td colSpan={5}><div style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className="fa-solid fa-book" style={{ fontSize: 28, opacity: 0.2, display: 'block', margin: '0 auto 10px' }} /><div style={{ fontSize: 14, fontWeight: 700 }}>No manuals found</div><div style={{ fontSize: 12, marginTop: 4 }}>Click "+ Add New Manual Detail" to add one.</div></div></td></tr>
              ) : manuals.map((mn, idx) => {
                const hasPdf = !!mn.pdfPath
                const rowForms = formsOf(mn.id)
                const hasForms = rowForms.length > 0
                const hasVid = !!(mn.vidUrl && mn.vidStatus === 'available')
                return (
                  <Fragment key={mn.id}>
                    <tr>
                      <td data-label="S.No." style={{ color: 'var(--tm)', fontWeight: 700 }}>{idx + 1}</td>
                      <td data-label="Title">
                        <div className="sop-manual-title" onClick={() => openManual(mn)}>
                          <i className="fa-solid fa-book" style={{ color: 'var(--brand)', fontSize: 11, flexShrink: 0 }} />
                          {mn.title}
                          {mn.code && <span style={{ fontSize: 10, color: 'var(--tm)', fontWeight: 600 }}>{mn.code}</span>}
                          {hasForms && <span className="sop-badge-form"><i className="fa-solid fa-paperclip" style={{ fontSize: 8 }} /> {rowForms.length}</span>}
                        </div>
                        {mn.desc && <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 3, maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mn.desc}</div>}
                      </td>
                      <td data-label="PDF Manual" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                          {hasPdf ? <span className="sop-badge-pdf"><i className="fa-solid fa-file-pdf" style={{ fontSize: 8 }} /> PDF Uploaded</span> : <span className="sop-badge-soon">No PDF</span>}
                          <button className="sop-btn-view" style={{ background: 'linear-gradient(135deg,#b91c1c,#dc2626)', height: 27 }} onClick={() => openManual(mn)}><i className="fa-solid fa-eye" /> View</button>
                        </div>
                      </td>
                      <td data-label="Tutorial" style={{ textAlign: 'center' }}>
                        {hasVid ? <button className="sop-btn-view" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }} onClick={() => setVidView(mn)}><i className="fa-solid fa-circle-play" /> Watch</button> : <span className="sop-badge-soon">Coming Soon</span>}
                      </td>
                      <td data-label="Action" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                          <button className="sop-dots-btn" onClick={(e) => { e.stopPropagation(); setOpenDd(openDd === mn.id ? null : mn.id) }}>
                            <i className="fa-solid fa-ellipsis-vertical" />
                            {openDd === mn.id && (
                              <div className="sop-dropdown" onClick={(e) => e.stopPropagation()}>
                                <div className="sop-dd-item" onClick={() => { setOpenDd(null); openManual(mn) }}><i className="fa-solid fa-eye" /> View Manual</div>
                                {!readOnly && <div className="sop-dd-item" onClick={() => { setOpenDd(null); setManualModal({ mode: 'edit', manual: mn }) }}><i className="fa-solid fa-pen" /> Edit</div>}
                                {!readOnly && <div className="sop-dd-item" onClick={() => { setOpenDd(null); setFormModal({ mode: 'add', manualId: mn.id }) }}><i className="fa-solid fa-paperclip" /> Add Form</div>}
                                <div className="sop-dd-item" onClick={() => { setOpenDd(null); openForms(mn.id) }}><i className="fa-solid fa-list" /> View Forms</div>
                                {hasVid && <div className="sop-dd-item" onClick={() => { setOpenDd(null); setVidView(mn) }}><i className="fa-solid fa-circle-play" /> Watch Tutorial</div>}
                                {!readOnly && <div className="sop-dd-item danger" onClick={() => { setOpenDd(null); setDel({ type: 'manual', id: mn.id, parentId: mn.catId, name: mn.title }) }}><i className="fa-solid fa-trash-can" /> Delete</div>}
                              </div>
                            )}
                          </button>
                          <button className="det-btn" title="Expand forms" onClick={() => toggleExpand(mn.id)}><i className="fa-solid fa-chevron-down" /></button>
                        </div>
                      </td>
                    </tr>
                    {expanded[mn.id] && (
                      <tr key={`${mn.id}-forms`}><td colSpan={5} style={{ padding: 0 }}>
                        <div className="sop-expand-box"><InlineForms manual={mn} forms={rowForms} loading={!!formsLoading[mn.id]} readOnly={readOnly} onAdd={() => setFormModal({ mode: 'add', manualId: mn.id })} onEdit={(form) => setFormModal({ mode: 'edit', manualId: mn.id, form })} onDel={(form) => setDel({ type: 'form', id: form.id, parentId: mn.id, name: form.title })} onToast={fire} /></div>
                      </td></tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODALS ── */}
      {catModal && <CatModal modal={catModal} busy={catBusy} onClose={() => setCatModal(null)} onSave={saveCat} onToast={fire} />}
      {manualModal && <ManualModal modal={manualModal} busy={rowBusy} cats={cats} activeCat={activeCat} onClose={() => setManualModal(null)} onSave={saveManual} onToast={fire} />}
      {formModal && <FormModal modal={formModal} busy={rowBusy} onClose={() => setFormModal(null)} onSave={saveForm} onToast={fire} />}
      {pdfView && <PdfViewer manual={pdfView} forms={formsOf(pdfView.id)} readOnly={readOnly} onClose={() => setPdfView(null)} onEdit={() => { const m = pdfView; setPdfView(null); setManualModal({ mode: 'edit', manual: m }) }} onToast={fire} />}
      {vidView && <VideoModal manual={vidView} onClose={() => setVidView(null)} />}
      {del && <DeleteModal del={del} busy={del.type === 'cat' ? catBusy : rowBusy} onClose={() => setDel(null)} onConfirm={doDelete} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

function Stat({ cls = '', icon, iconBg, val, lbl }) {
  return (
    <div className={`stat-card ${cls}`}>
      <div className="stat-icon" style={iconBg ? { background: iconBg } : undefined}><i className={`fa-solid ${icon}`} /></div>
      <div className="stat-val">{val}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  )
}

function InlineForms({ manual, forms = [], loading, readOnly, onAdd, onEdit, onDel, onToast }) {
  const addBtn = readOnly ? null : <button className="sop-btn-view" style={{ height: 30, fontSize: 11.5, marginBottom: forms.length ? 8 : 0 }} onClick={onAdd}><i className="fa-solid fa-plus" /> Add Form</button>
  if (loading) return <div style={{ fontSize: 12.5, color: 'var(--tm)' }}><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />Loading forms…</div>
  if (!forms.length) return <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ fontSize: 12.5, color: 'var(--tm)' }}><i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />No forms attached yet.</div>{addBtn}</div>
  return (
    <div>
      {addBtn}
      {forms.map((f) => (
        <div className="sop-form-item" key={f.id}>
          <div className="sop-form-icon"><i className="fa-solid fa-file" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sop-form-title">{f.displayTitle || f.title} <span className="sop-form-code">{f.code || ''}</span></div>
            <div style={{ fontSize: 11, color: 'var(--tm)' }}>{f.desc || ''}</div>
          </div>
          {f.pageRef && <span className="sop-form-ref">{f.pageRef}</span>}
          <div style={{ display: 'flex', gap: 5 }}>
            <button className="btn-sm" style={{ height: 26, fontSize: 10.5, borderColor: 'var(--info)', color: 'var(--info)', background: 'rgba(2,132,199,.06)' }} title="View form" onClick={() => openSopFile(f.fileUrl, formPdfHTML(f, manual), onToast)}><i className="fa-solid fa-eye" /> View</button>
            <button className="btn-sm" style={{ height: 26, fontSize: 10.5 }} title="Download / print PDF" onClick={() => openSopFile(f.fileUrl, formPdfHTML(f, manual), onToast)}><i className="fa-solid fa-download" /></button>
            {!readOnly && <button className="btn-sm" style={{ height: 26, fontSize: 10.5 }} onClick={() => onEdit(f)}><i className="fa-solid fa-pen" /></button>}
            {!readOnly && <button className="btn-sm" style={{ height: 26, fontSize: 10.5, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => onDel(f)}><i className="fa-solid fa-trash-can" /></button>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Category modal ── */
function CatModal({ modal, busy, onClose, onSave, onToast }) {
  const cat = modal.cat
  const [name, setName] = useState(cat?.title || '')
  const [desc, setDesc] = useState(cat?.desc || '')
  const [status, setStatus] = useState(cat?.status || 'active')
  const save = () => { if (busy) return; if (!name.trim()) return onToast('Please enter a category name', 'warn'); onSave({ title: name.trim(), desc: desc.trim(), status }) }
  return (
    <PayModal title={modal.mode === 'edit' ? 'Edit Manual Head' : 'Add Manual Head'} icon="fa-layer-group" onClose={onClose} maxWidth={460}
      foot={<><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {busy ? 'Saving…' : modal.mode === 'edit' ? 'Save Changes' : 'Add'}</button></>}>
      <div className="pay-field"><label>Category Name</label><input className="pay-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Academic Manuals" /></div>
      <div className="pay-field"><label>Description</label><input className="pay-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" /></div>
      <div className="pay-field" style={{ marginBottom: 0 }}><label>Status</label><select className="pay-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
    </PayModal>
  )
}

/* ── Manual modal ── */
function ManualModal({ modal, busy, cats, activeCat, onClose, onSave, onToast }) {
  const mn = modal.manual
  const [catId, setCatId] = useState(mn?.catId || activeCat || '')
  const [code, setCode] = useState(mn?.code || '')
  const [title, setTitle] = useState(mn?.title || '')
  const [desc, setDesc] = useState(mn?.desc || '')
  const [pdfName, setPdfName] = useState(mn?.pdfName || '')
  /* Nayi chuni hui file — na chuni ho to purana PDFPath hi waapis jaata hai. */
  const [pdfFile, setPdfFile] = useState(null)
  const [vidTitle, setVidTitle] = useState(mn?.vidTitle || '')
  const [vidUrl, setVidUrl] = useState(mn?.vidUrl || '')
  const [vidDesc, setVidDesc] = useState(mn?.vidDesc || '')
  const [vidStatus, setVidStatus] = useState(mn?.vidStatus || 'coming_soon')
  const [status, setStatus] = useState(mn?.status || 'active')
  const pdfRef = useRef(null)
  const save = () => {
    if (busy) return
    if (!catId) return onToast('Please select a category', 'warn')
    if (!title.trim()) return onToast('Please enter a manual title', 'warn')
    onSave({ catId: Number(catId), title: title.trim(), code: code.trim(), desc: desc.trim(), pdfFile, pdfPath: mn?.pdfPath || '', vidTitle: vidTitle.trim(), vidUrl: vidUrl.trim(), vidDesc: vidDesc.trim(), vidStatus, status })
  }
  return (
    <PayModal title={modal.mode === 'edit' ? 'Edit Manual' : 'Add Manual'} sub={modal.mode === 'edit' ? mn.title : 'Create a new manual under the selected category'} icon="fa-book" onClose={onClose} maxWidth={560}
      foot={<><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {busy ? 'Saving…' : 'Save Manual'}</button></>}>
      <div className="pay-input-row">
        <div className="pay-field"><label>Category</label><select className="pay-input" value={catId} onChange={(e) => setCatId(e.target.value)}><option value="">Select Category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
        <div className="pay-field"><label>Manual Code</label><input className="pay-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ACD-001" /></div>
      </div>
      <div className="pay-field"><label>Manual Title</label><input className="pay-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Manual head title" /></div>
      <div className="pay-field"><label>Description</label><input className="pay-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" /></div>
      <div className="pay-field"><label>PDF Manual</label>
        <div className="sop-upload" onClick={() => pdfRef.current?.click()}>
          <i className="fa-solid fa-cloud-arrow-up" style={{ display: 'block' }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>Click to upload PDF manual</div>
          <div className="sop-upload-name">{pdfName || '20–30+ pages · PDF'}</div>
          <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPdfFile(f); setPdfName(f.name) } }} />
        </div>
      </div>
      <div className="pay-info-box" style={{ marginBottom: 14 }}><i className="fa-solid fa-circle-play" /><p style={{ margin: 0 }}>Tutorial video (optional) — paste a YouTube link and set its availability.</p></div>
      <div className="pay-input-row">
        <div className="pay-field"><label>Tutorial Title</label><input className="pay-input" value={vidTitle} onChange={(e) => setVidTitle(e.target.value)} placeholder="e.g. Orientation Tutorial" /></div>
        <div className="pay-field"><label>Video Status</label><select className="pay-input" value={vidStatus} onChange={(e) => setVidStatus(e.target.value)}><option value="coming_soon">Coming Soon</option><option value="available">Available</option></select></div>
      </div>
      <div className="pay-field"><label>YouTube URL</label><input className="pay-input" value={vidUrl} onChange={(e) => setVidUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" /></div>
      <div className="pay-field" style={{ marginBottom: 0 }}><label>Manual Status</label><select className="pay-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
    </PayModal>
  )
}

/* ── Form modal ── */
function FormModal({ modal, busy, onClose, onSave, onToast }) {
  const fm = modal.form
  const [name, setName] = useState(fm?.title || '')
  const [code, setCode] = useState(fm?.code || '')
  const [page, setPage] = useState(fm?.pageRef || '')
  const [desc, setDesc] = useState(fm?.desc || '')
  const [fileName, setFileName] = useState(fm?.fileName || '')
  const [file, setFile] = useState(null)
  const fileRef = useRef(null)
  const save = () => {
    if (busy) return
    if (!name.trim()) return onToast('Please enter a form name', 'warn')
    onSave({ title: name.trim(), code: code.trim(), pageRef: page.trim(), desc: desc.trim(), file, formPath: fm?.formPath || '' })
  }
  return (
    <PayModal title={modal.mode === 'edit' ? 'Edit Form' : 'Upload Form'} sub={modal.mode === 'edit' ? 'Update form details' : 'Attach a form to this manual'} icon="fa-paperclip" onClose={onClose} maxWidth={480}
      foot={<><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {busy ? 'Saving…' : 'Save Form'}</button></>}>
      <div className="pay-field"><label>Form Name</label><input className="pay-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Student Registration Form" /></div>
      <div className="pay-input-row">
        <div className="pay-field"><label>Form Code</label><input className="pay-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. FORM-001" /></div>
        <div className="pay-field"><label>Page Reference</label><input className="pay-input" value={page} onChange={(e) => setPage(e.target.value)} placeholder="e.g. Page 5" /></div>
      </div>
      <div className="pay-field"><label>Description</label><input className="pay-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" /></div>
      <div className="pay-field" style={{ marginBottom: 0 }}><label>Attach File</label>
        <div className="sop-upload" onClick={() => fileRef.current?.click()}>
          <i className="fa-solid fa-file-arrow-up" style={{ display: 'block' }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>Click to choose file</div>
          <div className="sop-upload-name">{fileName || 'PDF, DOC, DOCX'}</div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setFileName(f.name) } }} />
        </div>
      </div>
    </PayModal>
  )
}

/* ── PDF viewer ── */
function PdfViewer({ manual, forms = [], readOnly, onClose, onEdit, onToast }) {
  const hasPdf = !!manual.pdfPath
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 720 }}>
        <div className="pay-modal-hdr" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
          <div className="pay-modal-av" style={{ background: 'rgba(255,255,255,.15)' }}><i className="fa-solid fa-book" /></div>
          <div><div className="pay-modal-title" style={{ color: '#fff' }}>{manual.title}</div><div className="pay-modal-sub" style={{ color: 'rgba(255,255,255,.8)' }}>{manual.code || ''} · Manual document</div></div>
          <button className="pay-modal-x" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)', color: '#fff' }} onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 12 }}><i className="fa-solid fa-file-pdf" style={{ color: '#DC2626', marginRight: 6 }} /> Manual PDF Document</div>
          {hasPdf ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(220,38,38,.06)', border: '1.5px solid rgba(220,38,38,.25)', borderRadius: 10, padding: '14px 16px', flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg,#b91c1c,#dc2626)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}><i className="fa-solid fa-file-pdf" /></div>
              <div style={{ flex: 1, minWidth: 160 }}><div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>{manual.pdfName || `${manual.title}.pdf`}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>Detailed manual · 20–30+ pages</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ height: 34, background: 'linear-gradient(135deg,#b91c1c,#dc2626)' }} onClick={() => openSopFile(manual.pdfUrl, manualPdfHTML(manual, forms), onToast)}><i className="fa-solid fa-eye" /> Read PDF</button>
                <button className="btn-secondary" style={{ height: 34 }} onClick={() => openSopFile(manual.pdfUrl, manualPdfHTML(manual, forms), onToast)}><i className="fa-solid fa-download" /> Download</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', background: 'var(--muted)', border: '2px dashed var(--bl)', borderRadius: 10, padding: 28 }}>
              <i className="fa-solid fa-file-pdf" style={{ fontSize: 32, color: 'var(--bm)', display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t2)' }}>No PDF Uploaded Yet</div>
              <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 4 }}>{readOnly ? 'This manual has no PDF yet.' : 'Upload a PDF manual, or preview the sample document below.'}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => openSopDoc(manualPdfHTML(manual, forms), onToast)}><i className="fa-solid fa-eye" /> Preview Sample Document</button>
                {!readOnly && <button className="btn-secondary" onClick={onEdit}><i className="fa-solid fa-upload" /> Upload Manual PDF</button>}
              </div>
            </div>
          )}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}><i className="fa-solid fa-align-left" /> Description</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>{manual.desc || 'No description available.'}</div>
          </div>
          {forms.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}><i className="fa-solid fa-paperclip" /> Attached Forms ({forms.length})</div>
              {forms.map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 8, padding: '10px 14px', marginBottom: 7 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#0369A1,#0284C7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}><i className="fa-solid fa-file" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>{f.displayTitle || f.title}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{f.code || ''}{f.pageRef ? ` · ${f.pageRef}` : ''}</div></div>
                  <button className="btn-sm" style={{ height: 28, borderColor: 'var(--info)', color: 'var(--info)', background: 'rgba(2,132,199,.06)' }} onClick={() => openSopFile(f.fileUrl, formPdfHTML(f, manual), onToast)}><i className="fa-solid fa-eye" /> View</button>
                  <button className="btn-sm" style={{ height: 28 }} onClick={() => openSopFile(f.fileUrl, formPdfHTML(f, manual), onToast)}><i className="fa-solid fa-download" /> Download</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pay-modal-foot"><button className="btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Video modal ── */
function VideoModal({ manual, onClose }) {
  return createPortal(
    <div className="sop-vid-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sop-vid-modal">
        <div className="sop-vid-toolbar">
          <div className="sop-vid-title"><i className="fa-solid fa-circle-play" /> {manual.vidTitle || 'Tutorial Video'}</div>
          <button className="sop-vid-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <iframe className="sop-vid-frame" src={toEmbed(manual.vidUrl)} title="Tutorial" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    </div>,
    document.body,
  )
}

/* ── Delete confirm ── */
function DeleteModal({ del, busy, onClose, onConfirm }) {
  const label = del.type === 'cat' ? 'Category' : del.type === 'manual' ? 'Manual' : 'Form'
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">Delete {label}?</div>
          <div className="confirm-sub">“{del.name}” will be permanently deleted. This action cannot be undone.</div>
          <div className="confirm-btns">
            <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-danger" onClick={() => { if (!busy) onConfirm() }} disabled={busy}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} /> {busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Reusable modal shell (reuses the Payments .pay-modal styles) ── */
function PayModal({ title, sub, icon, maxWidth, foot, children, onClose }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av"><i className={`fa-solid ${icon}`} /></div>
          <div><div className="pay-modal-title">{title}</div>{sub && <div className="pay-modal-sub">{sub}</div>}</div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">{children}</div>
        <div className="pay-modal-foot">{foot}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ════════ Branded printable documents — dummy SOP manual & form ════════ */
const sopEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const SOP_DOC_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#e9eef6}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0f172a;line-height:1.5}
.pg{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:18mm 16mm;box-shadow:0 6px 28px rgba(15,23,42,.18)}
.dh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid var(--ac);padding-bottom:14px;margin-bottom:18px}
.dh-brand{display:flex;gap:13px;align-items:center}
.dh-logo{width:56px;height:56px;border-radius:12px;background:var(--ac);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.dh-logo-img{width:56px;height:56px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;flex-shrink:0}
.dh-org{font-size:18px;font-weight:800}
.dh-line{font-size:11px;color:#64748b;margin-top:2px}
.dh-meta{text-align:right;flex-shrink:0}
.dh-tag{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#fff;background:var(--ac);border-radius:99px;padding:3px 11px;margin-bottom:6px}
.dh-title{font-size:17px;font-weight:800;color:var(--ac);max-width:280px}
.dh-code{font-size:11px;color:#64748b;margin-top:3px}
.ctl{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px}
.ctl td{border:1px solid #e2e8f0;padding:7px 10px}
.ctl td.k{background:#f1f5f9;font-weight:800;color:#475569;text-transform:uppercase;font-size:9px;letter-spacing:.4px;width:120px}
.sec{margin-bottom:16px}
.sec-h{font-size:13px;font-weight:800;color:var(--ac);border-left:3px solid var(--ac);padding-left:9px;margin-bottom:7px}
.sec p{font-size:12px;color:#334155;margin-bottom:6px}
.sec ol,.sec ul{margin:4px 0 6px 20px}
.sec li{font-size:12px;color:#334155;margin-bottom:4px}
table.gt{width:100%;border-collapse:collapse;font-size:11.5px;margin:6px 0 4px}
table.gt th{background:var(--ac);color:#fff;padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.4px}
table.gt td{padding:7px 10px;border:1px solid #e2e8f0;color:#1e293b}
.fld{display:grid;grid-template-columns:1fr 1fr;gap:14px 26px;margin:10px 0 16px}
.fld .f .l{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;font-weight:800;margin-bottom:4px}
.fld .f .line{border-bottom:1.5px dotted #94a3b8;height:24px}
.fld .f.full{grid-column:1/-1}
.box{border:1px solid #cbd5e1;border-radius:8px;min-height:90px;padding:10px;font-size:11px;color:#94a3b8;margin-bottom:18px}
.sign{display:flex;justify-content:space-between;gap:40px;margin-top:36px}
.sign div{flex:1;border-top:1.5px solid #94a3b8;padding-top:6px;font-size:10.5px;color:#64748b;text-align:center;font-weight:600}
.foot{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:9px;font-size:9.5px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}
@media print{html,body{background:#fff}.pg{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}@page{size:A4;margin:16mm}}
`

function sopHead(chain, tag, title, code) {
  const logo = chain.logo ? `<img class="dh-logo-img" src="${chain.logo}" alt="">` : `<div class="dh-logo">${sopEsc(chainInitials(chain.chainName))}</div>`
  return `<div class="dh"><div class="dh-brand">${logo}<div><div class="dh-org">${sopEsc(chain.chainName)}</div><div class="dh-line">${sopEsc(chain.address || '')}</div><div class="dh-line">${sopEsc(chain.contact || '')}${chain.email ? ' · ' + sopEsc(chain.email) : ''}</div></div></div>
  <div class="dh-meta"><div class="dh-tag">${sopEsc(tag)}</div><div class="dh-title">${sopEsc(title)}</div><div class="dh-code">${sopEsc(code)}</div></div></div>`
}

/* Asli uploaded file ho to wahi kholte hain; warna neeche wala branded
   sample document (jo pehle se banta aa raha hai). */
function openSopFile(url, fallbackHtml, onToast) {
  if (url) {
    const w = window.open(url, '_blank', 'noopener')
    if (!w) onToast?.('Allow pop-ups to open the document', 'warn')
    return
  }
  openSopDoc(fallbackHtml, onToast)
}

function openSopDoc(html, onToast) {
  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to view / download the document', 'warn'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

function manualPdfHTML(manual, forms = []) {
  const chain = loadChainProfile()
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const code = manual.code || `SOP-${String(manual.id).padStart(3, '0')}`
  const intro = manual.desc || 'This Standard Operating Procedure (SOP) defines the standardised process to be followed across all member schools to ensure consistency, quality and compliance with head-office policy.'
  const formsRows = forms.length
    ? forms.map((f, i) => `<tr><td>${i + 1}</td><td>${sopEsc(f.title)}</td><td>${sopEsc(f.code || '—')}</td><td>${sopEsc(f.pageRef || '—')}</td></tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px">No forms attached to this manual.</td></tr>'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${sopEsc(chain.chainName)} — ${sopEsc(manual.title)}</title><style>${SOP_DOC_CSS}</style></head>
<body><div class="pg" style="--ac:#1E3A8A">
  ${sopHead(chain, 'Operational Manual', manual.title, `${code} · Issued ${dateStr}`)}
  <table class="ctl"><tbody>
    <tr><td class="k">Document Code</td><td>${sopEsc(code)}</td><td class="k">Version</td><td>1.0</td></tr>
    <tr><td class="k">Effective Date</td><td>${sopEsc(dateStr)}</td><td class="k">Review Date</td><td>Annual</td></tr>
    <tr><td class="k">Document Owner</td><td>Head Office — Operations</td><td class="k">Status</td><td>Controlled / Released</td></tr>
  </tbody></table>
  <div class="sec"><div class="sec-h">1. Purpose</div><p>${sopEsc(intro)}</p></div>
  <div class="sec"><div class="sec-h">2. Scope</div><p>This procedure applies to all connected branch schools operating under the ${sopEsc(chain.chainName)} network, and to all staff responsible for the activities described herein.</p></div>
  <div class="sec"><div class="sec-h">3. Responsibilities</div>
    <table class="gt"><thead><tr><th>Role</th><th>Responsibility</th></tr></thead><tbody>
      <tr><td>Branch Principal</td><td>Owns implementation and monitors compliance at the school level.</td></tr>
      <tr><td>Coordinator / In-charge</td><td>Executes the procedure and maintains the related records and forms.</td></tr>
      <tr><td>Head Office</td><td>Issues the manual, audits adherence and approves revisions.</td></tr>
    </tbody></table></div>
  <div class="sec"><div class="sec-h">4. Procedure</div>
    <ol>
      <li>Review this manual and ensure all relevant staff are briefed before execution.</li>
      <li>Follow each step in sequence, using the attached forms to record the required information.</li>
      <li>Verify completion against the checklist and obtain the necessary approvals.</li>
      <li>File the completed forms and submit the summary to Head Office as required.</li>
      <li>Escalate any exceptions or deviations to the Branch Principal and Head Office.</li>
    </ol></div>
  <div class="sec"><div class="sec-h">5. Records &amp; Attached Forms</div>
    <table class="gt"><thead><tr><th>#</th><th>Form Title</th><th>Form Code</th><th>Page Ref</th></tr></thead><tbody>${formsRows}</tbody></table></div>
  <div class="sec"><div class="sec-h">6. References</div><p>Head-Office Policy Handbook · Quality Standards · Applicable regulatory guidelines.</p></div>
  <div class="sign"><div>Prepared By — Head Office</div><div>Approved By — Director Operations</div></div>
  <div class="foot"><span>${sopEsc(chain.chainName)}${chain.website ? ' · ' + sopEsc(chain.website) : ''}</span><span>Controlled document · ${sopEsc(code)} · sample preview</span></div>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>
</body></html>`
}

function formPdfHTML(form, manual) {
  const chain = loadChainProfile()
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const code = form.code || `FRM-${String(form.id).padStart(3, '0')}`
  const blankRows = Array.from({ length: 6 }, (_, i) => `<tr><td>${i + 1}</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${sopEsc(chain.chainName)} — ${sopEsc(form.title)}</title><style>${SOP_DOC_CSS}</style></head>
<body><div class="pg" style="--ac:#0369A1">
  ${sopHead(chain, 'Operational Form', form.title, `${code}${form.pageRef ? ' · ' + form.pageRef : ''}`)}
  <div class="sec"><p style="font-size:11.5px;color:#64748b">Related Manual: <strong>${sopEsc(manual.title)}</strong>${manual.code ? ` (${sopEsc(manual.code)})` : ''} · ${sopEsc(form.desc || 'Complete all fields in block capitals. Submit the signed form to the relevant in-charge.')}</p></div>
  <div class="sec-h">Branch &amp; Submission Details</div>
  <div class="fld">
    <div class="f"><div class="l">Branch / School</div><div class="line"></div></div>
    <div class="f"><div class="l">Date</div><div class="line"></div></div>
    <div class="f"><div class="l">Prepared By</div><div class="line"></div></div>
    <div class="f"><div class="l">Designation</div><div class="line"></div></div>
    <div class="f full"><div class="l">Subject / Reference</div><div class="line"></div></div>
  </div>
  <div class="sec-h">Entries</div>
  <table class="gt"><thead><tr><th style="width:36px">#</th><th>Description / Item</th><th style="width:120px">Details</th><th style="width:110px">Remarks</th></tr></thead><tbody>${blankRows}</tbody></table>
  <div class="sec-h" style="margin-top:16px">Remarks / Notes</div>
  <div class="box">&nbsp;</div>
  <div class="sign"><div>Prepared By (Signature &amp; Date)</div><div>Verified By</div><div>Approved By</div></div>
  <div class="foot"><span>${sopEsc(chain.chainName)}${chain.website ? ' · ' + sopEsc(chain.website) : ''}</span><span>Form ${sopEsc(code)} · ${sopEsc(dateStr)} · sample preview</span></div>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>
</body></html>`
}
