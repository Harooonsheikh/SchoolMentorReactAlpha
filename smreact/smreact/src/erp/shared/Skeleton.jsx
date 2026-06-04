import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   <Skeleton /> — shimmering placeholder for content that's still loading.

   Three composable primitives so any module can build a layout-faithful
   skeleton without hand-writing CSS:

     <Skeleton width="60%" height={14} />
     <Skeleton.Text lines={3} />
     <Skeleton.Circle size={44} />

   The shimmer is purely CSS (no JS animation) so it costs almost nothing
   to render. The base color uses design tokens so it adapts to dark mode.

   role="presentation" tells AT it's decorative — the surrounding
   <DataState> region carries the aria-busy semantics for screen readers.
   ═══════════════════════════════════════════════════════════════════ */

function Block({
  width = '100%',
  height = 14,
  radius = 6,
  style,
  className = '',
}) {
  const style$ = {
    width:        typeof width  === 'number' ? `${width}px`  : width,
    height:       typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
    ...(style || {}),
  };
  return <span className={`erp-skel ${className}`} style={style$} role="presentation" />;
}

function SkelText({ lines = 3, lastWidth = '60%' }) {
  return (
    <span className="erp-skel-text" role="presentation">
      {Array.from({ length: lines }).map((_, i) => (
        <Block
          key={i}
          width={i === lines - 1 ? lastWidth : '100%'}
          height={10}
          radius={4}
        />
      ))}
    </span>
  );
}

function SkelCircle({ size = 32 }) {
  return <Block width={size} height={size} radius="50%" />;
}

function SkelRow({ cols = 4, height = 14 }) {
  return (
    <span className="erp-skel-row" role="presentation">
      {Array.from({ length: cols }).map((_, i) => (
        <Block key={i} height={height} radius={4} />
      ))}
    </span>
  );
}

const Skeleton = Block;
Skeleton.Text   = SkelText;
Skeleton.Circle = SkelCircle;
Skeleton.Row    = SkelRow;

export default Skeleton;

/* ─── One-time global stylesheet ─────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('erp-skeleton-style')) {
  const el = document.createElement('style');
  el.id = 'erp-skeleton-style';
  el.textContent = `
.erp-skel {
  display: inline-block;
  background: linear-gradient(
    90deg,
    var(--bg-muted, #F1F5F9) 0%,
    rgba(255,255,255,.65) 50%,
    var(--bg-muted, #F1F5F9) 100%
  );
  background-size: 200% 100%;
  animation: erpSkelShimmer 1.4s linear infinite;
  vertical-align: middle;
}
[data-theme="dark"] .erp-skel {
  background: linear-gradient(
    90deg,
    var(--bg-muted, #1E293B) 0%,
    rgba(255,255,255,.06) 50%,
    var(--bg-muted, #1E293B) 100%
  );
  background-size: 200% 100%;
}
@keyframes erpSkelShimmer {
  from { background-position: 200% 0; }
  to   { background-position:  -200% 0; }
}
.erp-skel-text { display: flex; flex-direction: column; gap: 7px; width: 100%; }
.erp-skel-row  { display: flex; gap: 12px; width: 100%; }
.erp-skel-row .erp-skel { flex: 1; }
@media (prefers-reduced-motion: reduce) {
  .erp-skel { animation: none; opacity: .85; }
}
  `;
  document.head.appendChild(el);
}
