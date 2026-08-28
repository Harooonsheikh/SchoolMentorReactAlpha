import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { saveQuestionRow } from '@/api/lessonPlansApi'
import { AQ_TYPES, AQ_CONFIG, aqEmptyRow, nextRowId, nbTr } from './lessonPlanConfig'
import LpAqRow from './LpAqRow'

/* ═══════════════════════════════════════════════════════════════════
   NOTEBOOK — ADD / EDIT QUESTIONS (ERP ke NbAQModal ka hu-ba-hu port).

   18 question types; har type ka apna layout (LpAqRow) aur apna CRUD
   endpoint (NB_QTYPE_API, lessonPlansApi.js). Ek entry = ek "main
   question" + uski rows.

   Language: unit ke `medium` se — Urdu par sab type labels, field
   headings aur buttons Urdu ho jate hain aur modal RTL ho jata hai.
   Toggle yahan READ-ONLY hai; zaban Manage Units me set hoti hai.

   Save par: recordId wali rows update, bagair recordId ke insert, aur
   edit ke dauran hataayi gayi rows delete hoti hain. Unit ki master id
   hi `notebookID` hai.
   ═══════════════════════════════════════════════════════════════════ */

export default function LpNbAQModal({ ctx, unit, onSave, onClose, toast }) {
  const [activeType, setActiveType] = useState(null)
  const [mainQ, setMainQ] = useState('')
  const [statement, setStatement] = useState('') // comprehension ka statement
  const [rows, setRows] = useState([])
  const [deletedIds, setDeletedIds] = useState([]) // edit ke dauran hataayi rows
  const [saving, setSaving] = useState(false)
  const [lang, setLang] = useState('en')

  const isUrdu = lang === 'ur'
  const dir = isUrdu ? 'rtl' : 'ltr'

  useEffect(() => {
    if (!ctx) return
    setDeletedIds([])
    setLang(unit?.medium === 'urdu' ? 'ur' : 'en')

    const existing = ctx.existing || (ctx.qId && unit ? (unit.questions || []).find((x) => x.id === ctx.qId) : null)

    /* Type id: pehle existing.typeId, warna label ko AQ_CONFIG title se match
       karo (purane saved entries me typeId nahi hota tha). */
    let resolvedTypeId = null
    if (existing) {
      if (existing.typeId && AQ_CONFIG[existing.typeId]) resolvedTypeId = existing.typeId
      else if (existing.type) {
        const hit = Object.entries(AQ_CONFIG).find(([, cfg]) => cfg.title === existing.type)
        if (hit) [resolvedTypeId] = hit
      }
    }

    if (existing && resolvedTypeId) {
      setActiveType(resolvedTypeId)
      setMainQ(existing.mainQ || existing.mainQuestion || '')
      setStatement(existing.statement || '')
      const seeded = (existing.rows && existing.rows.length)
        ? JSON.parse(JSON.stringify(existing.rows)).map((r) => (r._id ? r : { ...r, _id: nextRowId() }))
        : [aqEmptyRow(resolvedTypeId)]
      setRows(seeded)
    } else {
      setActiveType(null)
      setMainQ('')
      setStatement('')
      setRows([])
    }
  }, [ctx, unit])

  if (!ctx) return null

  const isEdit = !!ctx.qId
  const cfg = activeType ? AQ_CONFIG[activeType] : null

  const selectType = (id) => { setActiveType(id); setRows([aqEmptyRow(id)]) }
  const updateRow = (i, key, val) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
  const addRow = () => { if (activeType) setRows((rs) => [...rs, aqEmptyRow(activeType)]) }

  const removeRow = (i) => {
    if (rows.length <= 1) { toast('At least one row required', 'error'); return }
    const row = rows[i]
    if (row?.recordId) setDeletedIds((ids) => [...ids, row.recordId])
    setRows((rs) => rs.filter((_, idx) => idx !== i))
    toast('Row removed', 'info')
  }

  const saveAll = async () => {
    if (!activeType) { toast('Select a question type first', 'error'); return }
    if (!AQ_CONFIG[activeType]) { toast('This question type is not supported yet', 'error'); return }

    const common = { typeId: activeType, notebookID: ctx.unitId, mainQuestion: mainQ.trim(), statement }
    const calls = [
      ...rows.map((row, index) => saveQuestionRow({ ...common, row, index, action: row.recordId ? 'update' : 'insert' })),
      ...deletedIds.map((id) => saveQuestionRow({ ...common, row: { recordId: id }, index: 0, action: 'delete' })),
    ]

    setSaving(true)
    try {
      await Promise.all(calls)
    } catch (e) {
      console.error('Error saving questions:', e)
      toast(e.serverMessage || 'Could not save questions', 'error')
      setSaving(false)
      return
    }
    setSaving(false)
    onSave()
  }

  const addMoreLabel = nbTr(activeType === 'stories' ? '+ Add More Stories' : '+ Add More', isUrdu)

  return createPortal(
    <div className="aq-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`aq-modal${isUrdu ? ' rtl-mode' : ''}`}>

        {/* ── Header ── */}
        <div className="aq-header">
          <div className="aq-header-left">
            <div className="aq-header-icon"><i className="fa-solid fa-circle-question" /></div>
            <div>
              <div className="aq-title">{isEdit ? (cfg?.title || 'Edit Questions') : 'Add Questions'}</div>
              <div className="aq-sub">{unit ? `${unit.unitName} — Unit ${unit.unitNo}` : 'Select unit to add questions'}</div>
            </div>
          </div>
          <button className="aq-close-hover" title="Close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        {/* ── Body ── */}
        <div className="aq-body">

          {/* Type selector — edit mode me chhupa rehta hai */}
          {!isEdit && (
            <div className="aq-type-section">
              <div className="aq-type-label">{nbTr('Select Question Field', isUrdu)}</div>
              <div className="aq-types-grid">
                {AQ_TYPES.map((t) => (
                  <button
                    key={t.id}
                    className={`aq-type-btn-hover${activeType === t.id ? ' active' : ''}`}
                    onClick={() => selectType(t.id)}
                  >
                    <i className={`fa-solid ${t.icon}`} style={{ fontSize: 11 }} /> {nbTr(t.label, isUrdu)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Language — READ-ONLY (unit ki zaban Manage Units me set hoti hai) */}
          <div className="clpm-lang-row" style={{ margin: '2px 0 6px' }}>
            <span className="clpm-lang-label">{nbTr('Language', isUrdu)}</span>
            <div className="clpm-lang-pills clpm-lang-pills--readonly" title="This unit's language is set in Manage Units. It cannot be changed here.">
              <span className={`clpm-lang-pill${lang === 'en' ? ' active' : ''}`}><span className="clpm-lang-flag">🇬🇧</span> English</span>
              <span className={`clpm-lang-pill${lang === 'ur' ? ' active' : ''}`}><span className="clpm-lang-flag">🇵🇰</span> اردو</span>
              <i className="fa-solid fa-lock" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }} />
            </div>
          </div>

          {/* Form area */}
          {activeType && cfg && (
            <div className="aq-form-area">
              <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1.5px solid #BAE6FD', boxShadow: '0 4px 20px rgba(6,182,212,.08)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 22px 16px', borderBottom: '1.5px solid #E0F9FF', background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE)' }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#0C4A6E', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ display: 'inline-block', width: 4, height: 20, background: 'linear-gradient(#0369A1,#06B6D4)', borderRadius: 2, flexShrink: 0 }} />
                    {nbTr(cfg.title, isUrdu)}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 7 }}>{nbTr('Main Question', isUrdu)}</div>
                  <input
                    type="text"
                    className="aq-mq-input"
                    dir={dir}
                    style={{ textAlign: isUrdu ? 'right' : 'left' }}
                    placeholder={nbTr('Enter main question', isUrdu)}
                    value={mainQ}
                    onChange={(e) => setMainQ(e.target.value)}
                  />
                </div>

                {cfg.layout === 'comprehension' && (
                  <div style={{ padding: '12px 22px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 7 }}>{nbTr('Comprehension Statement', isUrdu)}</div>
                    <textarea
                      rows="4"
                      dir={dir}
                      style={{ boxSizing: 'border-box', width: '100%', border: '2px solid #BAE6FD', borderRadius: 13, padding: '10px 16px', fontFamily: 'inherit', fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', resize: 'vertical', lineHeight: 1.6, textAlign: isUrdu ? 'right' : 'left' }}
                      placeholder={nbTr('Enter comprehension statement here…', isUrdu)}
                      value={statement}
                      onChange={(e) => setStatement(e.target.value)}
                    />
                  </div>
                )}

                <div style={{ padding: '14px 18px 4px' }}>
                  {rows.map((row, i) => (
                    <LpAqRow
                      key={row._id || i}
                      i={i}
                      cfg={cfg}
                      row={row}
                      typeId={activeType}
                      dir={dir}
                      isUrdu={isUrdu}
                      onChange={(k, v) => updateRow(i, k, v)}
                      onRemove={() => removeRow(i)}
                      onSaveRow={() => toast(`Row ${i + 1} saved`, 'success')}
                    />
                  ))}
                </div>

                <div style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #E0F2FE' }}>
                  <button className="aq-add-more-hover" onClick={addRow}>{addMoreLabel}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="aq-footer" style={{ display: 'flex', gap: 12, padding: '14px 24px 18px', borderTop: '2px solid #E0F2FE', background: 'var(--bg-card)', flexShrink: 0 }}>
          <button onClick={onClose} className="aq-cancel-hover">Cancel</button>
          <button onClick={saveAll} className="aq-save-all-hover" disabled={saving}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Questions'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
