import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/* ═══════════════════════════════════════════════════════════════════
   App-wide styled tooltips.

   Mounted once at the app root. Uses event delegation so EVERY element
   that already carries a `title` (or `data-tip`) attribute — across all
   modules — gets a themed tooltip with zero per-component changes. The
   native `title` is migrated to `data-tip` on first hover so the browser's
   default tooltip never double-shows.
   ═══════════════════════════════════════════════════════════════════ */
const SEL = '[data-tip], [title]'

export default function GlobalTooltip() {
  const [tip, setTip] = useState(null) // { text, rect, above }
  const activeRef = useRef(null)

  useEffect(() => {
    const resolveText = (el) => {
      let text = el.getAttribute('data-tip')
      if (!text) {
        const t = el.getAttribute('title')
        if (t && t.trim()) { text = t; el.setAttribute('data-tip', t); el.removeAttribute('title') }
      }
      return text && text.trim() ? text.trim() : null
    }
    const show = (el) => {
      const text = resolveText(el)
      if (!text) return
      activeRef.current = el
      const r = el.getBoundingClientRect()
      const above = r.top > 52
      setTip({ text, rect: r, above })
    }
    const hide = () => { activeRef.current = null; setTip(null) }

    const onOver = (e) => {
      const el = e.target.closest?.(SEL)
      if (el && el !== activeRef.current) show(el)
    }
    const onOut = (e) => {
      const el = e.target.closest?.(SEL)
      if (el && el === activeRef.current) {
        const to = e.relatedTarget
        if (!to || !el.contains(to)) hide()
      }
    }
    const onFocus = (e) => { const el = e.target.closest?.(SEL); if (el) show(el) }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', hide)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    document.addEventListener('click', hide, true)
    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', hide)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('click', hide, true)
    }
  }, [])

  if (!tip) return null
  const r = tip.rect
  const left = Math.min(Math.max(r.left + r.width / 2, 72), window.innerWidth - 72)
  const top = tip.above ? r.top : r.bottom
  return createPortal(
    <div className={`tt-pop ${tip.above ? 'above' : 'below'}`} style={{ left, top }} role="tooltip">{tip.text}</div>,
    document.body,
  )
}
