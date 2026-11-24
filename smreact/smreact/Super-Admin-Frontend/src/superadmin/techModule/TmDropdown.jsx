import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* ═══════════════════════════════════════════════════════════════════
   TmDropdown — dropdowns for the Tech Module forms that ALWAYS open
   downward (a native <select> lets the browser flip it upward when
   space is short, and its list cannot be styled).

   • The menu is portalled to the nearest .sa-root (keeps the theme
     variables) with position:fixed, so the modal's scroll box never
     clips it.
   • If there isn't enough room below the field, the modal is scrolled
     (and padded at the bottom when it can't scroll further) so the
     list still opens below the field.

   useDownwardMenu — the positioning hook (also used by SchoolPicker).
   TmSelect        — drop-in replacement for <select className="um-input">.
   ═══════════════════════════════════════════════════════════════════ */

const GAP = 4;
const EDGE = 12;     // keep this much space from the bottom of the window
const MIN_ROOM = 220; // try to make at least this much room below the field

function scrollParentOf(el) {
  let p = el?.parentElement;
  while (p && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight >= p.clientHeight) return p;
    p = p.parentElement;
  }
  return null;
}

export function useDownwardMenu({ open, onClose, triggerRef, menuRef, maxHeight = 280 }) {
  const [pos, setPos] = useState(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const el = triggerRef.current;
    if (!el) return undefined;

    /* Make room below the field before the menu is shown. */
    const need = Math.min(maxHeight, MIN_ROOM);
    const sp = scrollParentOf(el);
    const prevPad = sp ? sp.style.paddingBottom : '';
    const room = () => window.innerHeight - el.getBoundingClientRect().bottom - EDGE - GAP;
    if (sp && room() < need) {
      const short = need - room();
      const canScroll = sp.scrollHeight - sp.clientHeight - sp.scrollTop;
      if (canScroll < short) sp.style.paddingBottom = `${short - canScroll + (parseFloat(getComputedStyle(sp).paddingBottom) || 0)}px`;
      sp.scrollTop += short;
    }

    const place = () => {
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - EDGE - GAP;
      setPos({ top: r.bottom + GAP, left: r.left, width: r.width, maxHeight: Math.max(96, Math.min(maxHeight, below)) });
    };
    place();

    const onDown = (e) => {
      if (el.contains(e.target) || menuRef.current?.contains(e.target)) return;
      closeRef.current?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); el.focus?.(); } };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      if (sp) sp.style.paddingBottom = prevPad;
    };
  }, [open, maxHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Portal target: nearest .sa-root so CSS variables / dark theme still apply. */
  const host = triggerRef.current?.closest('.sa-root') || (typeof document !== 'undefined' ? document.body : null);
  const portal = (children) => (open && pos && host ? createPortal(children, host) : null);
  return { pos, portal };
}

/**
 * Downward-only select.
 * options: [{ value, label }] · value: current value · onChange(value)
 * placeholder: label for the empty value ('' option) — omit to have no empty option.
 * triggerProps: extra props for the trigger (e.g. P.lock(...) → disabled + data-tip).
 */
export default function TmSelect({ value, onChange, options, placeholder, disabled = false, triggerProps = {}, maxHeight = 280 }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const isDisabled = disabled || triggerProps.disabled;

  const items = placeholder != null ? [{ value: '', label: placeholder, empty: true }, ...options] : options;
  const current = items.find((o) => String(o.value) === String(value ?? ''));
  const { pos, portal } = useDownwardMenu({ open, onClose: () => setOpen(false), triggerRef, menuRef, maxHeight });

  /* Highlight the selected option and keep it in view when the menu opens / moves. */
  useEffect(() => { if (open) setActive(Math.max(0, items.findIndex((o) => String(o.value) === String(value ?? '')))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || active < 0) return;
    menuRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, pos]);

  const pick = (o) => { onChange?.(o.value); setOpen(false); triggerRef.current?.focus(); };
  const onKeyDown = (e) => {
    if (isDisabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (items[active]) pick(items[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const { className: extraCls = '', style: extraStyle, ...restTrigger } = triggerProps;
  return (
    <>
      <button
        type="button"
        {...restTrigger}
        ref={triggerRef}
        disabled={isDisabled}
        className={`um-input tm-sel${open ? ' open' : ''} ${extraCls.replace('um-input', '')}`.trim()}
        style={extraStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { if (!isDisabled) setOpen((o) => !o); }}
        onKeyDown={onKeyDown}
      >
        <span className={`tm-sel-val${!current || current.empty ? ' ph' : ''}`}>{current ? current.label : (placeholder || 'Select…')}</span>
        <i className="fa-solid fa-chevron-down tm-sel-chev" />
      </button>
      {portal(
        <div ref={menuRef} className="tm-sel-menu" role="listbox"
          style={{ top: pos?.top, left: pos?.left, width: pos?.width, maxHeight: pos?.maxHeight }}>
          {items.map((o, i) => {
            const sel = String(o.value) === String(value ?? '');
            return (
              <div key={`${o.value}-${i}`} data-idx={i} role="option" aria-selected={sel}
                className={`tm-sel-opt${sel ? ' sel' : ''}${i === active ? ' act' : ''}${o.empty ? ' ph' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}>
                <span>{o.label}</span>
                {sel && !o.empty && <i className="fa-solid fa-check" />}
              </div>
            );
          })}
        </div>,
      )}
    </>
  );
}
