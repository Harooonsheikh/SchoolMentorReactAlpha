import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { saveLessonMaster, saveLessonDetail, fetchLessonDetail } from '@/api/lessonPlansApi'
import { LESSON_SECTIONS_EN, LESSON_SECTIONS_UR, DOT_CLASSES, onlyNum } from './lessonPlanConfig'
import { ImageOverlay, imageActions, useImageOverlay, pickImage } from './LpRichTextEditor'
import { insertMath } from './lpMath'

/* ═══════════════════════════════════════════════════════════════════
   EDIT LESSON PLANS FOR UNIT — ERP ke LessonEditModal ka hu-ba-hu port.

   Layout: BAAYAN panel = unit (no./name) + us unit ke sab lessons ka
   navigator; DAAYAN panel = chuni hui lesson ki details aur uske 4
   rich-text sections.

   Language: unit ke `medium` se aati hai (Manage Units me set hoti hai)
   — yahan sirf READ-ONLY dikhti hai. Urdu par sections ke unwan/hints
   Urdu ho jate hain, modal RTL ho jata hai aur editors ka dir="rtl".

   Timings: user khud har section ke minute daalta hai; save par
   sum(sections) === Time Duration hona lazmi hai.

   Persistence do hisson me hai (ERP jaisa hi):
     • topic  → ulpforclassmastercrud   (har lesson ki apni master row)
     • plan   → ulpforclassdetailcrud   (sections + timings, masterClassesID se bandhi)
   ═══════════════════════════════════════════════════════════════════ */

const SECTION_KEYS = ['slo', 'intro', 'devel', 'recap']
const BLANK_MINS = { slo: '', intro: '', devel: '', recap: '' }
const TABLE_HTML = '<table style="border-collapse:collapse;width:100%;margin:8px 0"><tr><td style="border:1px solid #BFDBFE;padding:6px 10px">Col 1</td><td style="border:1px solid #BFDBFE;padding:6px 10px">Col 2</td></tr><tr><td style="border:1px solid #BFDBFE;padding:6px 10px">Row 2</td><td style="border:1px solid #BFDBFE;padding:6px 10px">Row 2</td></tr></table>'

/* Chhota floating input — lesson number / link URL ke liye (ERP jaisa). */
function promptInline({ value = '', placeholder = '', width = 240, onDone }) {
  const inp = document.createElement('input')
  inp.type = 'text'
  inp.value = value
  inp.placeholder = placeholder
  inp.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100001;padding:8px 12px;border:1px solid #CBD5E1;border-radius:8px;font-size:13px;width:${width}px;box-shadow:0 4px 20px rgba(0,0,0,.15)`
  document.body.appendChild(inp)
  inp.focus()
  inp.select()
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { onDone(inp.value); inp.remove() }
    if (e.key === 'Escape') inp.remove()
  })
  inp.addEventListener('blur', () => setTimeout(() => inp.remove(), 200))
}

export default function LpLessonEditModal({ ctx, onSave, onClose, toast }) {
  const [lang, setLang] = useState('en')
  const [unitNo, setUnitNo] = useState('')
  const [unitName, setUnitName] = useState('')
  const [duration, setDuration] = useState('')
  const [secMins, setSecMins] = useState(BLANK_MINS)
  const [lessons, setLessons] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [busy, setBusy] = useState(false)

  const editorRefs = useRef({})
  /* Aakhri selection jo kisi editor ke andar thi. Popup (link/image) focus le
     leta hai aur live range collapse ho jata hai — is liye CLONE rakhte hain
     aur execCommand se pehle wapas bithate hain. */
  const savedRangeRef = useRef(null)
  const savedEditorRef = useRef(null)
  const [imgSel, setImgSel] = useState(null)
  const [, setImgTick] = useState(0)
  const retick = () => setImgTick((t) => t + 1)

  useEffect(() => {
    if (!ctx) return
    /* Language UNIT ke medium se — modal ke andar toggle read-only hai. */
    setLang(ctx.unit?.medium === 'urdu' ? 'ur' : 'en')
    setUnitNo(ctx.unit?.unitNo || '')
    setUnitName(ctx.unit?.unitName || '')

    const d = ctx.detail
    const detailMap = d ? {
      slo: d.learningObjective || '',
      intro: d.lessonIntroduction || '',
      devel: d.development || '',
      recap: d.recap || '',
    } : null

    const unitLessons = (ctx.unit?.lessons || []).map((l) => {
      const isSel = l.id === ctx.lesson?.id
      return {
        id: l.id,
        num: l.num || '',
        topic: (isSel && d) ? (d.lessonPlanTopic ?? l.topic) : (l.topic || ''),
        duration: (isSel && d) ? (d.timeDuration || '') : (l.duration || ''),
        /* Jo timings save thin wahi load karo; nayi lesson me blank. */
        secMins: (isSel && d) ? {
          slo: onlyNum(d.timeForLearning),
          intro: onlyNum(d.timeForLesson),
          devel: onlyNum(d.timeForDevelopment),
          recap: onlyNum(d.timeForRecap),
        } : (l.secMins || null),
        contentMap: (isSel && detailMap) ? detailMap : (l.contentMap || {}),
        source: l.source || 'manual',
        detail: isSel ? d : (l.detail || null),
        record: l.record || null,
      }
    })

    setLessons(unitLessons.length ? unitLessons : [{ id: `new-${Date.now()}`, num: '1', topic: '', duration: '', contentMap: {}, source: 'manual', record: null }])
    const idx = Math.max(0, unitLessons.findIndex((l) => l.id === ctx.lesson?.id))
    setSelectedIdx(idx)
    setDuration(unitLessons[idx]?.duration || ctx.lesson?.duration || '')
  }, [ctx])

  const sections = lang === 'ur' ? LESSON_SECTIONS_UR : LESSON_SECTIONS_EN
  const isUrdu = lang === 'ur'
  const dir = isUrdu ? 'rtl' : 'ltr'
  const currentLesson = lessons[selectedIdx] || { num: '', topic: '', duration: '', contentMap: {} }

  const durationNum = parseInt(duration, 10) || 0
  const sectionsTotal = sections.reduce((a, s) => a + (parseInt(secMins[s.key], 10) || 0), 0)

  /* Editor DOM ko selection / language / content badalne par sync karo. Topic
     input me type karne se contentMap ka reference nahi badalta, is liye
     un-saved editor content clobber nahi hota. */
  useEffect(() => {
    if (!ctx) return
    SECTION_KEYS.forEach((key) => {
      const el = editorRefs.current[key]
      if (el) el.innerHTML = currentLesson.contentMap?.[key] || ''
    })
    setDuration(currentLesson.duration || '')
    setSecMins(currentLesson.secMins || BLANK_MINS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, lang, ctx, currentLesson.contentMap])

  useImageOverlay(imgSel, setImgSel, retick)

  if (!ctx) return null

  const saveSelection = () => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const ed = Object.values(editorRefs.current).find((el) => el && el.contains(range.commonAncestorContainer))
    if (ed) { savedRangeRef.current = range.cloneRange(); savedEditorRef.current = ed }
  }
  const restoreSelection = () => {
    const ed = savedEditorRef.current
    if (!ed) return false
    ed.focus()
    const range = savedRangeRef.current
    if (range) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range) }
    return true
  }

  const exec = (cmd, val) => {
    restoreSelection()
    document.execCommand(cmd, false, val !== undefined ? val : null)
    saveSelection()
  }
  const insertTable = () => {
    restoreSelection()
    document.execCommand('insertHTML', false, TABLE_HTML)
    saveSelection()
  }
  const insertLink = () => {
    saveSelection()
    promptInline({
      value: 'https://',
      placeholder: 'Enter URL',
      width: 320,
      onDone: (url) => { if (url) { restoreSelection(); document.execCommand('createLink', false, url); saveSelection() } },
    })
  }
  const insertImage = (src) => {
    restoreSelection()
    const img = document.createElement('img')
    img.src = src
    img.className = 'clpm-img'
    img.style.maxWidth = '100%'; img.style.height = 'auto'; img.style.cursor = 'pointer'
    const sel = window.getSelection()
    const ed = savedEditorRef.current
    if (sel && sel.rangeCount && ed && ed.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0)
      range.deleteContents(); range.insertNode(img)
      range.setStartAfter(img); range.collapse(true)
      sel.removeAllRanges(); sel.addRange(range)
    } else if (ed) {
      ed.appendChild(img)
    }
    img.addEventListener('load', retick)
    saveSelection()
    setImgSel(img)
  }

  const isEditorImg = (node) => node && node.tagName === 'IMG' && Object.values(editorRefs.current).some((ed) => ed && ed.contains(node))
  const onEditorClick = (e) => { saveSelection(); setImgSel(isEditorImg(e.target) ? e.target : null) }
  const imgOps = imageActions(() => imgSel, () => { retick(); saveSelection() })

  const updateLesson = (idx, patch) => setLessons((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const captureEditors = () => {
    const map = {}
    SECTION_KEYS.forEach((key) => {
      const el = editorRefs.current[key]
      if (el) map[key] = el.innerHTML
    })
    return map
  }

  const saveCurrent = () => {
    updateLesson(selectedIdx, { duration, contentMap: captureEditors(), secMins })
    toast(`Lesson ${currentLesson.num || selectedIdx + 1} saved`, 'success')
  }

  /* Chalti hui edits commit karo, phir doosri lesson par switch. */
  const selectLesson = (idx) => {
    updateLesson(selectedIdx, { duration, contentMap: captureEditors(), secMins })
    setSelectedIdx(idx)
  }

  const applyDetail = (d, masterId) => {
    const contentMap = {
      slo: d.learningObjective || '',
      intro: d.lessonIntroduction || '',
      devel: d.development || '',
      recap: d.recap || '',
    }
    const loadedMins = {
      slo: onlyNum(d.timeForLearning),
      intro: onlyNum(d.timeForLesson),
      devel: onlyNum(d.timeForDevelopment),
      recap: onlyNum(d.timeForRecap),
    }
    setLessons((ls) => ls.map((l) => (l.record?.id === masterId
      ? { ...l, topic: d.lessonPlanTopic ?? l.topic, duration: d.timeDuration || '', secMins: loadedMins, contentMap, detail: d }
      : l)))
    setDuration(d.timeDuration || '')
    setSecMins(loadedMins)
    SECTION_KEYS.forEach((key) => { const el = editorRefs.current[key]; if (el) el.innerHTML = contentMap[key] || '' })
  }

  const loadDetailById = async (masterId) => {
    if (!masterId) return
    try {
      const d = await fetchLessonDetail(masterId, ctx)
      if (d) applyDetail(d, masterId)
    } catch (e) {
      console.error('Error loading lesson detail:', e)
    }
  }

  const addLesson = () => {
    setLessons((ls) => [...ls, { id: `new-${Date.now()}`, num: String(ls.length + 1), topic: '', duration: '', contentMap: {}, source: 'manual', record: null }])
    setSelectedIdx(lessons.length)
  }

  const masterPayload = (l) => ({
    id: l.record ? l.record.id : 0,
    classID: ctx.classID,
    subjectID: ctx.subjectID,
    unitNo,
    unitName,
    lessonPlanTopic: l.topic || '',
    medium: lang === 'ur' ? 'urdu' : 'english',
    action: l.record ? 'update' : 'insert',
  })

  const hasCtx = () => {
    if (ctx.classID && ctx.subjectID) return true
    toast('Missing class/subject context', 'error')
    return false
  }

  /* Ek topic save (mojood ho to update, warna insert). */
  const saveTopic = async (li) => {
    if (!hasCtx()) return
    const l = lessons[li]
    try {
      const result = await saveLessonMaster(masterPayload(l))
      const newId = result?.data?.id ?? result?.data ?? result?.id
      updateLesson(li, { record: { ...(l.record || {}), id: Number(newId) || l.record?.id, unitNo, unitName, lessonPlanTopic: l.topic || '' } })
      toast(l.record ? 'Lesson topic updated' : 'Lesson topic added', 'success')
    } catch (e) {
      console.error('Error saving lesson topic:', e)
      toast(e.serverMessage || 'Could not save lesson topic', 'error')
    }
  }

  /* Unit ka no./naam sab topics par save (mojood update, naye insert). */
  const saveAllTopics = async () => {
    if (!hasCtx()) return
    try {
      const results = await Promise.all(lessons.map((l) => saveLessonMaster(masterPayload(l))
        .then((result) => ({ lid: l.id, result }))
        .catch(() => null)))
      setLessons((ls) => ls.map((l) => {
        const r = results.find((x) => x && x.lid === l.id)
        if (!r) return l
        const newId = r.result?.data?.id ?? r.result?.data ?? r.result?.id
        return { ...l, record: { ...(l.record || {}), id: Number(newId) || l.record?.id, unitNo, unitName, lessonPlanTopic: l.topic || '' } }
      }))
      toast('All lesson topics saved', 'success')
    } catch (e) {
      console.error('Error saving lesson topics:', e)
      toast(e.serverMessage || 'Could not save lesson topics', 'error')
    }
  }

  /* Lesson-plan detail (sections + timings) save. Detail row ki apni id
     update-vs-insert tay karti hai; masterClassesID topic ki master id hai. */
  const saveDetail = async (li) => {
    const l = lessons[li]
    const masterId = l?.record?.id
    if (!masterId) { toast('Save the topic first, then save the plan', 'error'); return false }
    const map = (li === selectedIdx) ? captureEditors() : (l.contentMap || {})
    const dur = (li === selectedIdx) ? duration : (l.duration || '')
    const sm = (li === selectedIdx) ? secMins : (l.secMins || BLANK_MINS)
    const d = l.detail || {}
    try {
      const result = await saveLessonDetail({
        id: d.id || 0,
        termID: d.termID || '',
        slot: d.slot || '',
        classID: ctx.classID,
        subjectID: ctx.subjectID,
        unitNo,
        unitName,
        totalLessonPlans: d.totalLessonPlans || '',
        timeDuration: dur || '',
        lessonPlanTopic: l.topic || '',
        learningObjective: map.slo || '',
        timeForLearning: sm.slo || '',
        lessonIntroduction: map.intro || '',
        timeForLesson: sm.intro || '',
        development: map.devel || '',
        timeForDevelopment: sm.devel || '',
        recap: map.recap || '',
        timeForRecap: sm.recap || '',
        rating: d.rating || '',
        suggestion: d.suggestion || '',
        suggestionDescription: d.suggestionDescription || '',
        masterClassesID: masterId,
        className: ctx.className || '',
        subjectName: ctx.subjectName || '',
        action: d.id ? 'update' : 'insert',
      })
      const newId = result?.data?.id ?? result?.data ?? result?.id
      updateLesson(li, { contentMap: map, duration: dur, detail: { ...d, id: Number(newId) || d.id } })
      toast(d.id ? 'Lesson plan updated' : 'Lesson plan saved', 'success')
      return true
    } catch (e) {
      console.error('Error saving lesson plan detail:', e)
      toast(e.serverMessage || 'Could not save lesson plan', 'error')
      return false
    }
  }

  const saveAndClose = async () => {
    if (!durationNum) { toast('Enter the Time Duration first', 'warn'); return }
    if (sectionsTotal !== durationNum) {
      toast(`Section timings total ${sectionsTotal} mins — must equal Time Duration (${durationNum} mins)`, 'error')
      return
    }
    setBusy(true)
    const ok = await saveDetail(selectedIdx)
    setBusy(false)
    if (!ok) return
    onSave({ ...lessons[selectedIdx], duration, contentMap: captureEditors(), secMins })
  }

  return createPortal(
    <div className="clpm-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`clpm-modal${isUrdu ? ' rtl-mode' : ''}`}>

        {/* ── HEADER ── */}
        <div className="clpm-header">
          <div>
            <div className="clpm-title">Edit Lesson Plans for Unit</div>
            <div className="clpm-header-meta">
              <span className="clpm-header-chip">
                <i className="fa-solid fa-chalkboard" style={{ fontSize: 10, opacity: 0.8 }} />
                {ctx.className || '—'}
              </span>
              <span className="clpm-header-chip">
                <i className="fa-solid fa-book-open" style={{ fontSize: 10, opacity: 0.8 }} />
                {ctx.subjectName || '—'}
              </span>
              <span className="clpm-header-chip clpm-header-chip--accent">
                <i className="fa-solid fa-pen-to-square" style={{ fontSize: 10, opacity: 0.8 }} />
                Unit {unitNo || ctx.unit?.unitNo || '—'} — Edit Lessons
              </span>
            </div>
          </div>
          <button className="clpm-close" title="Close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        {/* ── BODY ── */}
        <div className="clpm-body">

          {/* LEFT — unit + lessons navigator */}
          <div className="clpm-left">
            <div className="clml-unit">
              <div className="clml-unit-hdr">
                <div className="clml-unit-hdr-left">
                  <span className="clml-unit-badge">Unit {unitNo || '—'}</span>
                  <span className="clml-unit-name">{unitName || '(no name)'}</span>
                </div>
                <div className="clml-unit-hdr-right">
                  <span className="clml-lesson-count">{lessons.length} <i className="fa-solid fa-book" style={{ fontSize: 9 }} /></span>
                </div>
              </div>

              <div className="clml-fields" style={{ padding: '8px 12px 4px' }}>
                <div className="clml-field-row">
                  <span className="clml-field-lbl">NO.</span>
                  <input
                    className="clml-field-input" value={unitNo} type="text" inputMode="numeric" placeholder="1"
                    onChange={(e) => setUnitNo(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                  <button className="clml-edit-btn" title="Save unit no. to all topics" aria-label="Save unit number" onClick={saveAllTopics}><i className="fa-solid fa-pen" /></button>
                </div>
                <div className="clml-field-row">
                  <span className="clml-field-lbl">NAME</span>
                  <input
                    className="clml-field-input clml-field-input--grow" value={unitName} placeholder="Unit name"
                    onChange={(e) => setUnitName(e.target.value)}
                  />
                  <button className="clml-edit-btn" title="Save unit name to all topics" aria-label="Save unit name" onClick={saveAllTopics}><i className="fa-solid fa-pen" /></button>
                </div>
              </div>

              <div style={{ padding: '0 10px 8px' }}>
                {lessons.map((l, li) => (
                  <div
                    key={l.id}
                    className="clml-lesson"
                    style={li === selectedIdx ? { borderColor: '#1E40AF', boxShadow: '0 3px 12px rgba(30,64,175,.1)' } : null}
                  >
                    <div className="clml-lesson-hdr">
                      <div className="clml-lesson-tags">
                        <span className="clml-ltag clml-ltag--seq">#{li + 1}</span>
                        <span className="clml-ltag clml-ltag--num">L{l.num || '—'}</span>
                      </div>
                      <button
                        className="clml-edit-btn" title="Edit lesson number"
                        onClick={() => promptInline({ value: l.num || '', placeholder: 'Lesson number', width: 200, onDone: (v) => updateLesson(li, { num: v }) })}
                      >
                        <i className="fa-solid fa-hashtag" />
                      </button>
                    </div>
                    <div className="clml-field-row" style={{ marginBottom: 6 }}>
                      <input
                        className="clml-field-input clml-field-input--grow"
                        value={l.topic} placeholder="Lesson topic…"
                        onChange={(e) => updateLesson(li, { topic: e.target.value })}
                      />
                      <button className="clml-edit-btn" title={l.record ? 'Save topic changes' : 'Insert this topic'} aria-label="Save topic" onClick={() => saveTopic(li)}>
                        <i className="fa-solid fa-pen" />
                      </button>
                    </div>
                    <div className="clml-lesson-actions">
                      <button
                        className="clml-action-btn clml-action-save" title="Save this topic and its editor content"
                        onClick={async () => { if (li === selectedIdx) saveCurrent(); await saveTopic(li); saveDetail(li) }}
                      >
                        <i className="fa-solid fa-floppy-disk" /> Save
                      </button>
                      <button
                        className="clml-action-btn clml-action-fetch" title="Load this lesson's saved plan into the editor"
                        onClick={() => { selectLesson(li); loadDetailById(l.record?.id); toast(`Lesson ${l.num || li + 1} loaded into editor`, 'success') }}
                      >
                        <i className="fa-solid fa-download" /> Fetch
                      </button>
                    </div>
                  </div>
                ))}

                <button className="clml-add-lesson" title="Add a new lesson to this unit" onClick={addLesson}>
                  <i className="fa-solid fa-plus" /> Add Lesson
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT — work area */}
          <div className="clpm-right">
            <div className="clpm-right-topbar">
              <div className="clpm-ctx-row">
                <div className="clpm-ctx-pill clpm-ctx-pill--blue">
                  <div className="clpm-ctx-icon"><i className="fa-solid fa-school" /></div>
                  <div className="clpm-ctx-body">
                    <div className="clpm-ctx-label">Class</div>
                    <div className="clpm-ctx-val">{ctx.className || '—'}</div>
                  </div>
                </div>
                <div className="clpm-ctx-pill clpm-ctx-pill--blue">
                  <div className="clpm-ctx-icon"><i className="fa-solid fa-book-open" /></div>
                  <div className="clpm-ctx-body">
                    <div className="clpm-ctx-label">Subject</div>
                    <div className="clpm-ctx-val">{ctx.subjectName || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="clpm-unit-row">
                <div className="clpm-unit-field-chip">
                  <div className="clpm-ctx-icon clpm-ctx-icon--sm"><i className="fa-solid fa-hashtag" /></div>
                  <div className="clpm-ctx-body">
                    <div className="clpm-ctx-label">Unit No.</div>
                    <input
                      className="clpm-ctx-input" value={unitNo} placeholder="1" type="text" inputMode="numeric"
                      onChange={(e) => setUnitNo(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                </div>
                <div className="clpm-unit-field-chip clpm-unit-field-chip--grow">
                  <div className="clpm-ctx-icon clpm-ctx-icon--sm"><i className="fa-solid fa-layer-group" /></div>
                  <div className="clpm-ctx-body" style={{ flex: 1, minWidth: 0 }}>
                    <div className="clpm-ctx-label">Unit Name</div>
                    <input
                      className="clpm-ctx-input" value={unitName} placeholder="Unit name" style={{ width: '100%' }}
                      onChange={(e) => setUnitName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Language — READ-ONLY. Unit ki zaban Manage Units me set hoti hai. */}
              <div className="clpm-lang-row">
                <span className="clpm-lang-label">Language</span>
                <div className="clpm-lang-pills clpm-lang-pills--readonly" title="This unit's language is set in Manage Units. It cannot be changed here.">
                  <span className={`clpm-lang-pill${lang === 'en' ? ' active' : ''}`}><span className="clpm-lang-flag">🇬🇧</span> English</span>
                  <span className={`clpm-lang-pill${lang === 'ur' ? ' active' : ''}`}><span className="clpm-lang-flag">🇵🇰</span> اردو</span>
                  <i className="fa-solid fa-lock" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }} />
                </div>
              </div>
            </div>

            {/* Lesson details */}
            <div className="clpm-form-area">
              <div className="clpm-step-label">Lesson Details</div>
              <div className="clpm-inputs-row">
                <div className="clpm-field-group">
                  <label className="clpm-field-label">
                    <i className="fa-regular fa-clock" style={{ color: 'var(--text-muted)', fontSize: 10 }} />
                    <span>Time Duration</span> <span className="req">*</span>
                  </label>
                  <div className="clpm-input-with-hint">
                    <input
                      className="clpm-input" value={duration} placeholder="e.g. 45" type="text" inputMode="numeric" maxLength="3"
                      onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                    <span className="clpm-eg">mins</span>
                  </div>
                </div>
                <div className="clpm-field-group">
                  <label className="clpm-field-label">
                    <i className="fa-regular fa-file-lines" style={{ color: 'var(--text-muted)', fontSize: 10 }} />
                    <span>Lesson Topic</span> <span className="req">*</span>
                  </label>
                  <input
                    className="clpm-input" value={currentLesson.topic} placeholder="Enter lesson plan topic"
                    onChange={(e) => updateLesson(selectedIdx, { topic: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* 4 rich-text sections */}
            <div className="clpm-sections-area">
              <div className="clpm-step-label" style={{ paddingTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Lesson Plan Sections</span>
                {durationNum ? (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: sectionsTotal === durationNum ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)',
                    color: sectionsTotal === durationNum ? '#16A34A' : '#DC2626',
                  }}
                  >
                    {sectionsTotal} / {durationNum} mins {sectionsTotal === durationNum ? '✓' : ''}
                  </span>
                ) : null}
              </div>

              <div>
                {sections.map((sec, i) => {
                  const timeInput = (
                    <div className="clpm-time-input-wrap" title={isUrdu ? 'اس حصے کے منٹ خود درج کریں' : 'Enter minutes for this section'}>
                      <i className="fa-regular fa-clock clpm-time-icon" />
                      <input
                        className="clpm-time-input" type="text" inputMode="numeric" maxLength={3} placeholder="0"
                        value={secMins[sec.key] || ''}
                        onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setSecMins((m) => ({ ...m, [sec.key]: v })) }}
                      />
                      <span className="clpm-time-suffix">mins</span>
                    </div>
                  )

                  return (
                    <div key={sec.key} className="clpm-rte-section">
                      {isUrdu ? (
                        <div className="clpm-rte-header clpm-rte-header-ur">
                          {timeInput}
                          <div className="clpm-rte-title-wrap-ur">
                            <span className="clpm-rte-title clpm-rte-title-ur">{sec.title}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="clpm-rte-header">
                          <div className="clpm-rte-title-wrap">
                            <div className={`clpm-rte-section-dot ${DOT_CLASSES[i] || ''}`} />
                            <span className="clpm-rte-title">{sec.title}</span>
                            <span className="clpm-rte-hint-text">{sec.hint}</span>
                          </div>
                          {timeInput}
                        </div>
                      )}

                      <div className="clpm-rte-toolbar">
                        {isUrdu && <div className="clpm-rte-hint-ur" style={{ width: '100%', order: -1, flexBasis: '100%', marginBottom: 0 }}>{sec.hint}</div>}
                        <button className="clpm-tb-btn" title="Undo" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('undo')}><i className="fa-solid fa-rotate-left" /></button>
                        <button className="clpm-tb-btn" title="Redo" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('redo')}><i className="fa-solid fa-rotate-right" /></button>
                        <div className="clpm-tb-divider" />
                        <select
                          className="clpm-tb-select" title="Font size" defaultValue=""
                          onChange={(e) => { exec('fontSize', e.target.value); e.target.value = '' }}
                        >
                          <option value="">Size</option>
                          <option value="1">Small</option>
                          <option value="3">Normal</option>
                          <option value="4">Large</option>
                          <option value="5">X-Large</option>
                        </select>
                        <div className="clpm-tb-divider" />
                        <button className="clpm-tb-btn" title="Bold (Ctrl+B)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}><b>B</b></button>
                        <button className="clpm-tb-btn" title="Underline (Ctrl+U)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}><u>U</u></button>
                        <button className="clpm-tb-btn" title="Italic (Ctrl+I)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}><i>I</i></button>
                        <button className="clpm-tb-btn" title="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('strikeThrough')}><s>S</s></button>
                        <label
                          className="clpm-tb-btn" title="Text colour" onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
                          style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', textDecoration: 'underline', cursor: 'pointer', position: 'relative' }}
                        >
                          A
                          <input
                            type="color" defaultValue="#DC2626"
                            style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                            onChange={(e) => exec('foreColor', e.target.value)}
                          />
                        </label>
                        <div className="clpm-tb-divider" />
                        {[
                          { tip: 'Align left', cmd: 'justifyLeft', icon: 'fa-align-left' },
                          { tip: 'Align center', cmd: 'justifyCenter', icon: 'fa-align-center' },
                          { tip: 'Align right', cmd: 'justifyRight', icon: 'fa-align-right' },
                          { tip: 'Justify', cmd: 'justifyFull', icon: 'fa-align-justify' },
                        ].map(({ tip, cmd, icon }) => (
                          <button
                            key={cmd} className="clpm-tb-btn" title={tip}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              if (!restoreSelection()) return
                              /* styleWithCSS on — alignment inline style ban kar
                                 lagti hai, export me zyada portable. */
                              try { document.execCommand('styleWithCSS', false, true) } catch { /* purane browsers */ }
                              document.execCommand(cmd, false, null)
                              saveSelection()
                            }}
                          >
                            <i className={`fa-solid ${icon}`} />
                          </button>
                        ))}
                        <div className="clpm-tb-divider" />
                        <button className="clpm-tb-btn" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')}><i className="fa-solid fa-list-ol" /></button>
                        <button className="clpm-tb-btn" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')}><i className="fa-solid fa-list-ul" /></button>
                        <button className="clpm-tb-btn" title="Insert table" onMouseDown={(e) => e.preventDefault()} onClick={insertTable}><i className="fa-solid fa-table-cells" /></button>
                        <div className="clpm-tb-divider" />
                        <button className="clpm-tb-btn" title="Insert link" onMouseDown={(e) => e.preventDefault()} onClick={insertLink}><i className="fa-solid fa-link" /></button>
                        <button
                          className="clpm-tb-btn" title="Insert image from your device"
                          onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
                          onClick={() => pickImage(insertImage)}
                        >
                          <i className="fa-regular fa-image" />
                        </button>
                        {/* Math formula (∑) — MathLive popup isi section ke editor me insert karta hai. */}
                        <button
                          className="clpm-tb-btn" title="Insert math formula"
                          onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
                          style={{ fontWeight: 800, fontSize: 14 }}
                          onClick={() => insertMath(editorRefs.current[sec.key], savedRangeRef, () => {
                            saveSelection()
                            /* content sync — onInput handler chalao taake save par capture ho */
                            try { editorRefs.current[sec.key]?.dispatchEvent(new Event('input', { bubbles: true })) } catch { /* ignore */ }
                          })}
                        >
                          ∑
                        </button>
                        <div className="clpm-tb-divider" />
                        <button
                          className="clpm-tb-btn" title="Clear formatting" onMouseDown={(e) => e.preventDefault()}
                          onClick={() => exec('removeFormat')}
                          style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}
                        >
                          Clear
                        </button>
                      </div>

                      <div
                        ref={(el) => { editorRefs.current[sec.key] = el }}
                        className="clpm-editor"
                        contentEditable
                        suppressContentEditableWarning
                        dir={dir}
                        spellCheck={false}
                        onMouseUp={saveSelection}
                        onKeyUp={saveSelection}
                        onFocus={saveSelection}
                        onClick={onEditorClick}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="clpm-footer">
          <div className="clpm-footer-hint">
            <i className="fa-solid fa-circle-info" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            Fill all sections before saving
          </div>
          <div className="clpm-footer-btns">
            <button className="clpm-btn clpm-btn--cancel" onClick={onClose}>Close</button>
            <button className="clpm-btn clpm-btn--save" onClick={saveAndClose} disabled={busy}>
              <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> Save &amp; Close
            </button>
          </div>
        </div>
      </div>

      {imgSel && (
        <ImageOverlay
          img={imgSel}
          onAlign={imgOps.align}
          onNudge={imgOps.nudge}
          onWidth={imgOps.width}
          onDone={() => setImgSel(null)}
        />
      )}
    </div>,
    document.body,
  )
}
