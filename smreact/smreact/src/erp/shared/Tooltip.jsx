import React, { useId, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ═══════════════════════════════════════════════════════════════════
   <Tooltip /> — reusable, portal-based, auto-positioning tooltip.

   Usage:
     <Tooltip text="Edit this record">
       <button>...</button>
     </Tooltip>

   Props:
     - text         (string) — required tooltip text
     - placement    'top' | 'bottom' | 'left' | 'right' | 'auto' (default 'top')
                    'auto' picks the side with the most room and flips
                    automatically if the chosen side would clip the viewport.
     - delay        ms before show on hover (default 220)
     - disabled     skip rendering the tooltip entirely.
   ═══════════════════════════════════════════════════════════════════ */

const MARGIN = 12;  // min distance from any viewport edge
const GAP    = 8;   // distance between trigger and tooltip
const ARROW  = 5;   // half-size of the arrow (used to keep it inside the body)

export default function Tooltip({ text, placement = 'top', delay = 220, disabled, children }) {
  /* Stable id so we can wire the trigger to the rendered tip via
     aria-describedby. SR users get the tooltip text as a description on
     focus, in addition to whatever aria-label the trigger already carries. */
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({
    top: 0, left: 0,
    side: placement === 'auto' ? 'top' : placement,
    arrowOffset: 0,
  });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timeoutRef = useRef(null);

  /* Compute position. On the first pass (no rendered tooltip yet) we estimate
     the size from the text length; once mounted we re-measure with the real
     dimensions inside useLayoutEffect so the final placement is pixel-accurate. */
  const measure = useCallback(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const r  = trig.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let tw, th;
    if (tooltipRef.current) {
      const tr = tooltipRef.current.getBoundingClientRect();
      tw = tr.width;
      th = tr.height;
    } else {
      // Pre-mount estimate (refined by the useLayoutEffect second pass). The
      // body width tracks the actual text via `width: max-content` capped by
      // max-width: 360px, so use 360 as the upper bound here too.
      tw = Math.min(360, 28 + (text?.length || 0) * 6.5);
      th = (text?.length || 0) > 50 ? 60 : 30;
    }

    let side = placement === 'auto'
      ? (r.top > vh - r.bottom ? 'top' : 'bottom')
      : placement;

    // Flip if the chosen side would clip the viewport
    if (side === 'top'    && r.top    - th - GAP < MARGIN)      side = 'bottom';
    if (side === 'bottom' && r.bottom + th + GAP > vh - MARGIN) side = 'top';
    if (side === 'left'   && r.left   - tw - GAP < MARGIN)      side = 'right';
    if (side === 'right'  && r.right  + tw + GAP > vw - MARGIN) side = 'left';

    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;

    let top, left, arrowOffset;

    if (side === 'top' || side === 'bottom') {
      top  = side === 'top' ? r.top - GAP - th : r.bottom + GAP;
      left = cx - tw / 2;
      // Clamp so the body never crosses the viewport margin
      if (left < MARGIN)          left = MARGIN;
      if (left + tw > vw - MARGIN) left = vw - MARGIN - tw;
      arrowOffset = cx - left;            // arrow X within body
      const min = ARROW + 4, max = tw - ARROW - 4;
      arrowOffset = Math.max(min, Math.min(max, arrowOffset));
    } else {
      left = side === 'left' ? r.left - GAP - tw : r.right + GAP;
      top  = cy - th / 2;
      if (top < MARGIN)           top = MARGIN;
      if (top + th > vh - MARGIN) top = vh - MARGIN - th;
      arrowOffset = cy - top;             // arrow Y within body
      const min = ARROW + 4, max = th - ARROW - 4;
      arrowOffset = Math.max(min, Math.min(max, arrowOffset));
    }

    setPos({ top, left, side, arrowOffset });
  }, [placement, text]);

  const show = useCallback(() => {
    if (disabled || !text) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      measure();
      setOpen(true);
    }, delay);
  }, [disabled, text, delay, measure]);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setOpen(false);
  }, []);

  // Second-pass measure with real rendered dimensions, before paint
  useLayoutEffect(() => {
    if (open) measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-measure on scroll/resize while open
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => measure();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, measure]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  if (disabled || !text) return children;

  const child = React.Children.only(children);
  /* Only wire aria-describedby while the tip is actually rendered. Preserves
     any consumer-supplied describedby. */
  const existingDescribedBy = child.props['aria-describedby'];
  const describedBy = open
    ? (existingDescribedBy ? `${existingDescribedBy} ${tipId}` : tipId)
    : existingDescribedBy;
  const triggerProps = {
    ref: (el) => {
      triggerRef.current = el;
      const orig = child.ref;
      if (typeof orig === 'function')             orig(el);
      else if (orig && typeof orig === 'object')  orig.current = el;
    },
    onMouseEnter: (e) => { show(); child.props.onMouseEnter && child.props.onMouseEnter(e); },
    onMouseLeave: (e) => { hide(); child.props.onMouseLeave && child.props.onMouseLeave(e); },
    onFocus:      (e) => { show(); child.props.onFocus      && child.props.onFocus(e); },
    onBlur:       (e) => { hide(); child.props.onBlur       && child.props.onBlur(e); },
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    title: undefined,
  };

  const arrowStyle = (pos.side === 'top' || pos.side === 'bottom')
    ? { left: `${pos.arrowOffset}px` }
    : { top:  `${pos.arrowOffset}px` };

  return (
    <>
      {React.cloneElement(child, triggerProps)}
      {open && createPortal(
        <div
          ref={tooltipRef}
          id={tipId}
          className={`erp-tip erp-tip--${pos.side}`}
          style={{ top: pos.top, left: pos.left }}
          role="tooltip"
        >
          <div className="erp-tip-body">{text}</div>
          <div className="erp-tip-arrow" style={arrowStyle} />
        </div>,
        document.body
      )}
    </>
  );
}

/* ─── One-time global stylesheet — appended on first import ──────── */
if (typeof document !== 'undefined' && !document.getElementById('erp-tip-style')) {
  const el = document.createElement('style');
  el.id = 'erp-tip-style';
  el.textContent = `
.erp-tip {
  /* Outer wrapper: shrink-to-fit around the body so the position math and
     the rendered background stay in sync. */
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  animation: erpTipIn .15s cubic-bezier(.4,0,.2,1);
  filter: drop-shadow(0 4px 14px rgba(15,23,42,.25)) drop-shadow(0 1px 3px rgba(15,23,42,.18));
}
.erp-tip-body {
  /* inline-block sizes the body to its own text content (no circular sizing
     loop with the parent), and the dark background always paints behind the
     entire visible text — single line or wrapped. */
  display: inline-block;
  max-width: min(360px, calc(100vw - 24px));
  background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
  background-clip: padding-box;
  color: #fff;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .015em;
  line-height: 1.5;
  padding: 8px 13px;
  border-radius: 8px;
  white-space: normal;
  overflow-wrap: break-word;
  word-break: break-word;
  text-align: center;
  border: 1px solid rgba(255,255,255,.07);
  box-sizing: border-box;
  vertical-align: top;
}
.erp-tip-arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
  border: 1px solid rgba(255,255,255,.07);
}
.erp-tip--top    .erp-tip-arrow { bottom:-5px; transform: translateX(-50%) rotate(45deg); border-top:none; border-left:none; }
.erp-tip--bottom .erp-tip-arrow { top:   -5px; transform: translateX(-50%) rotate(45deg); border-bottom:none; border-right:none; }
.erp-tip--left   .erp-tip-arrow { right: -5px; transform: translateY(-50%) rotate(45deg); border-top:none; border-right:none; }
.erp-tip--right  .erp-tip-arrow { left:  -5px; transform: translateY(-50%) rotate(45deg); border-bottom:none; border-left:none; }
@keyframes erpTipIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
/* Hide tooltips on coarse-pointer devices (no hover) */
@media (hover: none) and (pointer: coarse) {
  .erp-tip { display: none; }
}
  `;
  document.head.appendChild(el);
}
