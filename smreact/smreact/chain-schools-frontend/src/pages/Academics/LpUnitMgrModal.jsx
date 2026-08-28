import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  saveLessonMaster, saveNotebookMaster, deleteLessonMasterCascade, crudFailure,
} from '@/api/lessonPlansApi'

/* ═══════════════════════════════════════════════════════════════════
   MANAGE UNITS — Lesson Plans aur Notebook Plans dono ke units yahin
   se bante/badalte/hatate hain (ERP ke UnitMgrModal se hu-ba-hu port).

   Har unit ki apni LANGUAGE (medium) hai — EN / اردو. Wahi language
   aage lesson editor aur Add-Questions modal me read-only dikhti hai,
   aur wahi `medium` ban kar API ko jati hai.

   Save par draft ko us list se diff kiya jata hai jo modal khulte waqt
   thi: nayi rows → insert, naam/number/medium badla → update, hataayi
   gayi rows → delete.

   ⚠ Lesson side par unit ka `id` ek synthetic key hai ("unitNo__unitName"),
   asli master record id nahi — ek unit dar-asl kai master rows ka group
   hai (har lesson ki apni row). Is liye rename/renumber par unit ki HAR
   row apni id se update hoti hai.
   ═══════════════════════════════════════════════════════════════════ */

export default function LpUnitMgrModal({ open, source, units, ctx = {}, onSave, onClose, confirm, toast }) {
  const [draft, setDraft] = useState([])
  const [snoTarget, setSnoTarget] = useState(null) // { id, currentIdx, next? }
  const [origIds, setOrigIds] = useState(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(units.map((u) => ({ ...u, lessons: [...(u.lessons || [])], questions: [...(u.questions || [])] })))
    setOrigIds(new Set(units.map((u) => u.id)))
  }, [open, units])

  if (!open) return null

  const base = { classID: ctx.classID, subjectID: ctx.subjectID }
  const changed = (o, u) => (
    String(o.unitNo) !== String(u.unitNo)
    || (o.unitName || '') !== (u.unitName || '')
    || (o.medium || 'english') !== (u.medium || 'english')
  )

  /* Notebook: ek unit = ek master row (id = asli record id). */
  const saveNotebookUnits = async () => {
    const origById = new Map(units.map((u) => [u.id, u]))
    const draftIds = new Set(draft.map((u) => u.id))
    const rid = (u) => { const n = Number(u.id); return Number.isFinite(n) ? n : u.id }

    const calls = [
      ...draft.filter((u) => !origIds.has(u.id) && (u.unitNo || u.unitName))
        .map((u) => saveNotebookMaster({ ...base, id: 0, unitNo: u.unitNo, unitName: u.unitName, lessonPlanTopic: '', medium: u.medium, action: 'insert' })),
      ...draft.filter((u) => { const o = origById.get(u.id); return o && changed(o, u) })
        .map((u) => saveNotebookMaster({ ...base, id: rid(u), unitNo: u.unitNo, unitName: u.unitName, lessonPlanTopic: u.record?.lessonPlanTopic ?? u.lessonPlanTopic ?? '', medium: u.medium, action: 'update' })),
      ...[...origById.values()].filter((u) => !draftIds.has(u.id))
        .map((u) => saveNotebookMaster({ ...base, id: rid(u), unitNo: '', unitName: '', lessonPlanTopic: '', medium: u.medium, action: 'delete' })),
    ]
    return Promise.all(calls)
  }

  const saveLessonUnits = async () => {
    const origById = new Map(units.map((u) => [u.id, u]))
    const draftIds = new Set(draft.map((u) => u.id))
    const recId = (l) => l?.id ?? l?.record?.id ?? l?.recordId
    const calls = []

    /* Naye units — ek master row khaali topic ke saath insert. */
    draft.filter((u) => !origIds.has(u.id) && (u.unitNo || u.unitName)).forEach((u) => {
      calls.push(saveLessonMaster({ ...base, id: 0, unitNo: u.unitNo, unitName: u.unitName, lessonPlanTopic: '', medium: u.medium, action: 'insert' }))
    })

    /* Rename / renumber / language badli — unit ki har lesson-row update. */
    draft.filter((u) => { const o = origById.get(u.id); return o && changed(o, u) }).forEach((u) => {
      (u.lessons || []).forEach((l) => {
        const id = recId(l)
        if (id == null) return
        calls.push(saveLessonMaster({
          ...base, id, unitNo: u.unitNo, unitName: u.unitName,
          lessonPlanTopic: l.record?.lessonPlanTopic ?? l.topic ?? '',
          medium: u.medium, action: 'update',
        }))
      })
    })

    /* Hataye gaye units — har lesson-row ka child DETAIL pehle, phir master
       (FK constraint: detail master ko reference karta hai). */
    ;[...origById.values()].filter((u) => !draftIds.has(u.id)).forEach((u) => {
      (u.lessons || []).forEach((l) => {
        const id = recId(l)
        if (id == null) return
        calls.push(deleteLessonMasterCascade({
          id,
          unitNo: l.record?.unitNo ?? u.unitNo ?? '',
          unitName: l.record?.unitName ?? u.unitName ?? '',
          lessonPlanTopic: l.record?.lessonPlanTopic ?? l.topic ?? '',
          medium: u.medium,
        }, base))
      })
    })

    return Promise.all(calls)
  }

  const save = async () => {
    if (!ctx.classID || !ctx.subjectID) { toast('Select a class and subject first', 'error'); return }
    setSaving(true)
    try {
      const results = source === 'notebook' ? await saveNotebookUnits() : await saveLessonUnits()
      /* API 200 de sakti hai magar asli natija `data` me chhupa hota hai —
         `data: 0` = fail. Isay pakdo warna insert "saved" dikhta hai par
         actually persist nahi hota. */
      const bad = (results || []).map(crudFailure).find(Boolean)
      if (bad) { toast(bad, 'error'); setSaving(false); return }
    } catch (e) {
      console.error('Error saving units:', e)
      toast(e.serverMessage || e.message || 'Could not save units', 'error')
      setSaving(false)
      return
    }
    setSaving(false)
    onSave(draft)
  }

  const update = (id, key, val) => setDraft((d) => d.map((u) => (u.id === id ? { ...u, [key]: val } : u)))

  const remove = (id) => {
    const u = draft.find((x) => x.id === id)
    confirm({
      title: 'Delete Unit?',
      message: `Unit "${u?.unitName || u?.unitNo}" will be removed from the list.`,
      hint: 'Save changes to persist the deletion.',
      confirmLabel: 'Yes, Delete',
      onConfirm: () => setDraft((d) => d.filter((x) => x.id !== id)),
    })
  }

  const add = () => setDraft((d) => [...d, {
    id: `new-${Date.now()}-${d.length}`,
    unitNo: String(d.length + 1),
    unitName: '',
    medium: 'english', // naya unit → default English; toggle se badal sakte hain
    lessons: source === 'lesson' ? [] : undefined,
    questions: source === 'notebook' ? [] : undefined,
  }])

  const reorder = (toIdx) => {
    if (snoTarget == null) return
    const fromIdx = draft.findIndex((u) => u.id === snoTarget.id)
    if (fromIdx < 0 || fromIdx === toIdx) { setSnoTarget(null); return }
    const next = [...draft]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setDraft(next)
    setSnoTarget(null)
    toast('Order updated', 'success')
  }

  return createPortal(
    <div className="lp-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="lp-modal" style={{ maxWidth: 720 }}>
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-icon"><i className="fa-solid fa-layer-group" /></div>
            <div>
              <div className="lp-modal-title">Manage Units</div>
              <div className="lp-modal-sub">{source === 'lesson' ? 'Lesson Plans' : 'Notebook Plans'} — add, edit, reorder or remove units</div>
            </div>
          </div>
          <button className="lp-modal-close" title="Close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="lp-modal-body">
          {draft.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              <i className="fa-solid fa-layer-group" style={{ fontSize: 30, marginBottom: 10, display: 'block', opacity: 0.3 }} />
              No units yet. Click <strong style={{ color: '#1E40AF' }}>+ Add New Unit</strong> below.
            </div>
          )}

          {draft.map((u, i) => (
            <div key={u.id} className="umgr-unit-row">
              <span className="umgr-drag-handle" title="Drag to reorder"><i className="fa-solid fa-grip-vertical" /></span>
              <button className="umgr-sno-badge" title="Click to change serial number" onClick={() => setSnoTarget({ id: u.id, currentIdx: i })}>#{i + 1}</button>
              <input
                className="umgr-no-input" type="text" maxLength={3}
                value={u.unitNo} placeholder={String(i + 1)}
                onChange={(e) => update(u.id, 'unitNo', e.target.value.replace(/[^0-9]/g, ''))}
              />
              <input
                className="umgr-name-input" type="text"
                value={u.unitName} placeholder="Unit name…"
                onChange={(e) => update(u.id, 'unitName', e.target.value)}
              />
              <span className="umgr-lesson-count">
                <i className="fa-solid fa-book" style={{ fontSize: 9 }} />{' '}
                {(u.lessons || u.questions || []).length}
              </span>

              {/* Per-unit language — yahan jo chuna jaye wahi lesson/question
                  modal ke andar read-only dikhta hai. */}
              <div className="umgr-lang-toggle">
                <button
                  type="button" title="Set this unit's language to English"
                  className={`umgr-lang-pill${(u.medium || 'english') !== 'urdu' ? ' active' : ''}`}
                  onClick={() => update(u.id, 'medium', 'english')}
                >EN</button>
                <button
                  type="button" title="Set this unit's language to Urdu"
                  className={`umgr-lang-pill umgr-lang-pill--ur${(u.medium || 'english') === 'urdu' ? ' active' : ''}`}
                  onClick={() => update(u.id, 'medium', 'urdu')}
                >اردو</button>
              </div>

              <button className="umgr-del-btn" title="Delete unit" onClick={() => remove(u.id)}>
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          ))}

          <button className="lp-add-row" title="Add a new unit" onClick={add}>
            <i className="fa-solid fa-circle-plus" /> Add New Unit
          </button>
        </div>

        <div className="lp-modal-footer">
          <button className="lp-btn ghost" title="Discard changes and close" onClick={onClose}>Close</button>
          <button className="lp-btn primary" title="Save unit order and changes" onClick={save} disabled={saving}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Serial-number reorder */}
      {snoTarget != null && (
        <div className="lp-overlay open" style={{ zIndex: 5000 }} onClick={(e) => { if (e.target === e.currentTarget) setSnoTarget(null) }}>
          <div className="lp-modal" style={{ maxWidth: 380 }}>
            <div className="lp-modal-header">
              <div className="lp-modal-title-row">
                <div className="lp-modal-icon"><i className="fa-solid fa-arrows-up-down" /></div>
                <div>
                  <div className="lp-modal-title">Change Serial</div>
                  <div className="lp-modal-sub">Move this unit to a new position</div>
                </div>
              </div>
              <button className="lp-modal-close" title="Close" onClick={() => setSnoTarget(null)} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="lp-modal-body">
              <label className="form-label">Move to position</label>
              <input
                type="number" className="form-input" min={1} max={draft.length}
                defaultValue={snoTarget.currentIdx + 1}
                onChange={(e) => setSnoTarget((s) => ({ ...s, next: +e.target.value }))}
              />
            </div>
            <div className="lp-modal-footer">
              <button className="lp-btn ghost" onClick={() => setSnoTarget(null)}>Cancel</button>
              <button
                className="lp-btn primary"
                onClick={() => {
                  const target = (snoTarget.next ?? (snoTarget.currentIdx + 1)) - 1
                  reorder(Math.min(Math.max(target, 0), draft.length - 1))
                }}
              >
                <i className="fa-solid fa-check" /> Reorder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
