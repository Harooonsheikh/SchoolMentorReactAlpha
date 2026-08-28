import { useEffect, useRef, useState } from 'react'
import { insertMath } from './lpMath'
import { createPortal } from 'react-dom'

/* ═══════════════════════════════════════════════════════════════════
   RICH-TEXT EDITOR — ERP ke Lesson/Notebook editors wala hi editor.

   Saari operations chalti hain: undo/redo, size, B/U/I/S, colour,
   align + justify, lists, table, link, image (upload + resize/align
   overlay), clear formatting.

   Do ahem cheezein jo ERP se aayi hain:
     • range CLONE — popup (link/image) focus le to live range collapse
       ho jata hai; cloned range restore karne par hi insert theek jagah
       hota hai.
     • image overlay <body> me portal — modal ka backdrop-filter
       position:fixed ka containing block ban jata hai aur overlay image
       se detach ho kar khisak jata hai.

   ∑ (math formula) button MathLive par chalta hai — dekhein lpMath.js.
   ═══════════════════════════════════════════════════════════════════ */

const TB_BTN = {
  border: 'none', background: 'transparent', color: '#E2E8F0', cursor: 'pointer',
  fontSize: 12, padding: '3px 6px', borderRadius: 5, fontFamily: 'inherit', lineHeight: 1,
}

const ALIGN_BTNS = [
  { tip: 'Align left',   cmd: 'justifyLeft',   icon: 'fa-align-left' },
  { tip: 'Align center', cmd: 'justifyCenter', icon: 'fa-align-center' },
  { tip: 'Align right',  cmd: 'justifyRight',  icon: 'fa-align-right' },
  { tip: 'Justify',      cmd: 'justifyFull',   icon: 'fa-align-justify' },
]

const TABLE_HTML = '<table style="border-collapse:collapse;width:100%;margin:8px 0"><tr><td style="border:1px solid #BFDBFE;padding:6px 10px">Col 1</td><td style="border:1px solid #BFDBFE;padding:6px 10px">Col 2</td></tr><tr><td style="border:1px solid #BFDBFE;padding:6px 10px">Row 2</td><td style="border:1px solid #BFDBFE;padding:6px 10px">Row 2</td></tr></table>'

/* Selected image ke upar ka align/resize toolbar — editor aur lesson modal
   dono isay use karte hain, is liye export. */
export function ImageOverlay({ img, onAlign, onNudge, onWidth, onDone }) {
  const r = img.getBoundingClientRect()
  return createPortal(
    <div
      className="clpm-img-overlay"
      style={{ position: 'fixed', top: r.top, left: r.left, width: r.width, height: r.height, border: '2px solid #1E40AF', boxSizing: 'border-box', zIndex: 100000, pointerEvents: 'none' }}
    >
      <div
        style={{ position: 'absolute', top: -36, left: 0, display: 'flex', alignItems: 'center', gap: 2, background: '#1E293B', borderRadius: 8, padding: '3px 5px', pointerEvents: 'auto', boxShadow: '0 4px 14px rgba(0,0,0,.3)', whiteSpace: 'nowrap' }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <button style={TB_BTN} title="Align left" onClick={() => onAlign('left')}><i className="fa-solid fa-align-left" /></button>
        <button style={TB_BTN} title="Center" onClick={() => onAlign('center')}><i className="fa-solid fa-align-center" /></button>
        <button style={TB_BTN} title="Align right" onClick={() => onAlign('right')}><i className="fa-solid fa-align-right" /></button>
        <span style={{ width: 1, height: 16, background: '#475569', margin: '0 3px' }} />
        <button style={TB_BTN} title="Smaller" onClick={() => onNudge(-30)}><i className="fa-solid fa-minus" /></button>
        <button style={TB_BTN} title="Bigger" onClick={() => onNudge(30)}><i className="fa-solid fa-plus" /></button>
        <span style={{ width: 1, height: 16, background: '#475569', margin: '0 3px' }} />
        <button style={TB_BTN} title="25%" onClick={() => onWidth(25)}>25%</button>
        <button style={TB_BTN} title="50%" onClick={() => onWidth(50)}>50%</button>
        <button style={TB_BTN} title="100%" onClick={() => onWidth(100)}>100%</button>
        <span style={{ width: 1, height: 16, background: '#475569', margin: '0 3px' }} />
        <button style={TB_BTN} title="Done" onClick={onDone}><i className="fa-solid fa-xmark" /></button>
      </div>
    </div>,
    document.body,
  )
}

/* Selected image ko align/resize karne wale helpers — dono editors share karte
   hain. `after` har badlaav ke baad chalta hai (re-measure + content commit). */
export function imageActions(getImg, after) {
  const align = (mode) => {
    const img = getImg(); if (!img) return
    if (mode === 'inline') {
      img.style.display = 'inline'; img.style.marginLeft = ''; img.style.marginRight = ''
    } else {
      img.style.display = 'block'
      img.style.marginLeft = (mode === 'center' || mode === 'right') ? 'auto' : '0'
      img.style.marginRight = (mode === 'center' || mode === 'left') ? 'auto' : '0'
    }
    after()
  }
  const width = (pct) => {
    const img = getImg(); if (!img) return
    img.style.width = `${pct}%`; img.style.height = 'auto'; img.style.maxWidth = '100%'
    after()
  }
  const nudge = (deltaPx) => {
    const img = getImg(); if (!img) return
    const w = Math.max(40, Math.round((img.getBoundingClientRect().width || 0) + deltaPx))
    img.style.width = `${w}px`; img.style.height = 'auto'; img.style.maxWidth = '100%'
    after()
  }
  return { align, width, nudge }
}

/* Image select rehte hue scroll/resize par overlay ko saath rakho; bahar click
   ya Escape par de-select. */
export function useImageOverlay(imgSel, setImgSel, retick) {
  useEffect(() => {
    if (!imgSel) return undefined
    const reposition = () => retick()
    const onDocDown = (e) => {
      if (e.target.closest && e.target.closest('.clpm-img-overlay')) return
      if (e.target.tagName === 'IMG') return
      setImgSel(null)
    }
    const onKey = (e) => { if (e.key === 'Escape') setImgSel(null) }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDocDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDocDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [imgSel, setImgSel, retick])
}

/* Device se image chun kar `insert(dataUri)` bulao. */
export function pickImage(insert) {
  const f = document.createElement('input')
  f.type = 'file'; f.accept = 'image/*'; f.style.display = 'none'
  document.body.appendChild(f)
  f.addEventListener('change', () => {
    const file = f.files && f.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => insert(ev.target.result)
      reader.readAsDataURL(file)
    }
    f.remove()
  })
  f.click()
}

export default function LpRichTextEditor({ value, onChange, placeholder, minHeight = 90, dir = 'ltr' }) {
  const editorRef = useRef(null)
  const savedRangeRef = useRef(null)
  const [imgSel, setImgSel] = useState(null)
  const [, setImgTick] = useState(0)
  const retick = () => setImgTick((t) => t + 1)

  /* Initial HTML sirf ek dafa set (caret jump se bachne ke liye). */
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = () => { if (editorRef.current) onChange(editorRef.current.innerHTML) }

  const saveSelection = () => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }
  const restoreSelection = () => {
    const ed = editorRef.current
    if (!ed) return false
    ed.focus()
    const r = savedRangeRef.current
    if (r) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r) }
    return true
  }

  const exec = (cmd, val) => {
    restoreSelection()
    document.execCommand(cmd, false, val !== undefined ? val : null)
    saveSelection()
    commit()
  }

  const insertTable = () => {
    restoreSelection()
    document.execCommand('insertHTML', false, TABLE_HTML)
    saveSelection()
    commit()
  }

  const insertLink = () => {
    const url = window.prompt('Enter URL', 'https://')
    if (!url) return
    restoreSelection()
    document.execCommand('createLink', false, url)
    saveSelection()
    commit()
  }

  const insertImage = (src) => {
    restoreSelection()
    const img = document.createElement('img')
    img.src = src
    img.className = 'clpm-img'
    img.style.maxWidth = '100%'; img.style.height = 'auto'; img.style.cursor = 'pointer'
    const sel = window.getSelection()
    const ed = editorRef.current
    if (sel && sel.rangeCount && ed && ed.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0)
      range.deleteContents(); range.insertNode(img)
      range.setStartAfter(img); range.collapse(true)
      sel.removeAllRanges(); sel.addRange(range)
    } else if (ed) {
      ed.appendChild(img)
    }
    /* data-URI decode hone ke baad overlay dobara measure kare (warna height 0). */
    img.addEventListener('load', retick)
    saveSelection(); commit(); setImgSel(img)
  }

  const isEditorImg = (n) => n && n.tagName === 'IMG' && editorRef.current && editorRef.current.contains(n)
  const onEditorClick = (e) => { saveSelection(); setImgSel(isEditorImg(e.target) ? e.target : null) }

  const imgOps = imageActions(() => imgSel, () => { retick(); commit() })
  useImageOverlay(imgSel, setImgSel, retick)

  return (
    <div style={{ border: '1.5px solid var(--border-med)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
      <div className="clpm-rte-toolbar">
        <button className="clpm-tb-btn" title="Undo" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('undo')}><i className="fa-solid fa-rotate-left" /></button>
        <button className="clpm-tb-btn" title="Redo" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('redo')}><i className="fa-solid fa-rotate-right" /></button>
        <div className="clpm-tb-divider" />
        <select
          className="clpm-tb-select" title="Font size" defaultValue=""
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => { if (e.target.value) { exec('fontSize', e.target.value); e.target.value = '' } }}
        >
          <option value="">Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>
        <div className="clpm-tb-divider" />
        <button className="clpm-tb-btn" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}><b>B</b></button>
        <button className="clpm-tb-btn" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}><u>U</u></button>
        <button className="clpm-tb-btn" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}><i>I</i></button>
        <button className="clpm-tb-btn" title="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('strikeThrough')}><s>S</s></button>
        <label className="clpm-tb-btn" title="Text colour" onMouseDown={(e) => { e.preventDefault(); saveSelection() }} style={{ position: 'relative', color: '#DC2626' }}>
          <b>A</b>
          <input
            type="color" defaultValue="#DC2626"
            onMouseDown={saveSelection}
            onChange={(e) => exec('foreColor', e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          />
        </label>
        <div className="clpm-tb-divider" />
        {ALIGN_BTNS.map((a) => (
          <button
            key={a.cmd} className="clpm-tb-btn" title={a.tip} onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              restoreSelection()
              /* styleWithCSS on — alignment inline style ban kar lagti hai, jo
                 report/export me zyada portable hai. */
              try { document.execCommand('styleWithCSS', false, true) } catch { /* purane browsers */ }
              document.execCommand(a.cmd, false, null)
              saveSelection(); commit()
            }}
          >
            <i className={`fa-solid ${a.icon}`} />
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
        {/* Math formula (∑) — MathLive popup; Insert par rendered HTML editor me. */}
        <button
          className="clpm-tb-btn" title="Insert math formula"
          onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
          style={{ fontWeight: 800, fontSize: 14 }}
          onClick={() => insertMath(editorRef, savedRangeRef, () => { saveSelection(); commit() })}
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
        ref={editorRef}
        className="clpm-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        dir={dir}
        spellCheck={false}
        style={{ minHeight, padding: '10px 13px', fontSize: 14, lineHeight: 1.6, outline: 'none', textAlign: dir === 'rtl' ? 'right' : undefined }}
        onInput={commit}
        onBlur={commit}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        onClick={onEditorClick}
      />

      {imgSel && (
        <ImageOverlay
          img={imgSel}
          onAlign={imgOps.align}
          onNudge={imgOps.nudge}
          onWidth={imgOps.width}
          onDone={() => setImgSel(null)}
        />
      )}
    </div>
  )
}
