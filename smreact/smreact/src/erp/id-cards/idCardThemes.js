/* ═══════════════════════════════════════════════════════════════════
   ID CARD THEMES — centralized theme registry shared by the Student
   and Staff ID Card Designer. Each theme is a real, distinct layout
   (not a palette swap of one template) — `layout` selects which
   branch IdCardFace renders. To add a 7th theme later: add an entry
   here, a thumbnail swatch below, and a case in IdCardFace/idCardPrint.
   ═══════════════════════════════════════════════════════════════════ */

export const ID_CARD_THEMES = [
  {
    id: 'classic',
    name: 'Classic Corporate',
    tagline: 'Clean, professional, boardroom-ready',
    layout: 'classic',
    defaultOrientation: 'horizontal',
    defaultPhotoShape: 'rounded',
    colors: { primary: '#1E3A8A', secondary: '#2563EB', ink: '#0F172A', bg: '#FFFFFF', surface: '#F8FAFF', border: '#DBEAFE', onPrimary: '#FFFFFF' },
  },
  {
    id: 'gradient',
    name: 'Modern Gradient',
    tagline: 'Bold, contemporary gradient wash',
    layout: 'gradient',
    defaultOrientation: 'horizontal',
    defaultPhotoShape: 'rounded',
    colors: { primary: '#7C3AED', secondary: '#2563EB', ink: '#FFFFFF', bg: '#4C1D95', surface: 'rgba(255,255,255,.16)', border: 'rgba(255,255,255,.3)', onPrimary: '#FFFFFF' },
  },
  {
    id: 'minimal',
    name: 'Minimal Elegant',
    tagline: 'Understated, refined, compact',
    layout: 'minimal',
    defaultOrientation: 'horizontal',
    defaultPhotoShape: 'square',
    colors: { primary: '#0F172A', secondary: '#64748B', ink: '#0F172A', bg: '#FFFFFF', surface: '#FAFAFA', border: '#E5E7EB', onPrimary: '#FFFFFF' },
  },
  {
    id: 'executive',
    name: 'Premium Executive',
    tagline: 'Sophisticated dark navy, gold accents',
    layout: 'executive',
    defaultOrientation: 'horizontal',
    defaultPhotoShape: 'rounded',
    colors: { primary: '#D4AF37', secondary: '#B8860B', ink: '#F8FAFC', bg: '#0B1220', surface: 'rgba(255,255,255,.06)', border: 'rgba(212,175,55,.35)', onPrimary: '#0B1220' },
  },
  {
    id: 'colorful',
    name: 'Colorful Academic',
    tagline: 'Vibrant, friendly, education-first',
    layout: 'colorful',
    defaultOrientation: 'horizontal',
    defaultPhotoShape: 'circle',
    colors: { primary: '#F97316', secondary: '#7C3AED', ink: '#0F172A', bg: '#FFFFFF', surface: '#FFF7ED', border: '#FED7AA', onPrimary: '#FFFFFF' },
  },
  {
    id: 'vertical',
    name: 'Vertical Modern',
    tagline: 'Portrait-first, photo-forward',
    layout: 'vertical',
    defaultOrientation: 'vertical',
    defaultPhotoShape: 'rounded',
    colors: { primary: '#0E7490', secondary: '#0891B2', ink: '#0F172A', bg: '#FFFFFF', surface: '#ECFEFF', border: '#A5F3FC', onPrimary: '#FFFFFF' },
  },
];

export function getTheme(id) {
  return ID_CARD_THEMES.find((t) => t.id === id) || ID_CARD_THEMES[0];
}

/* Physical card size — CR80 is the near-universal standard; horizontal
   and vertical simply swap width/height. Kept as a table so a future
   custom size just adds another entry. */
export const CARD_SIZES = {
  cr80: { id: 'cr80', label: 'Standard CR80 (85.6 × 53.98 mm)', wMm: 85.6, hMm: 53.98 },
};

export const PHOTO_SHAPES = [
  { id: 'circle', label: 'Circular' },
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded Corners' },
  { id: 'portrait', label: 'Rectangular Portrait' },
];

export function photoRadius(shape, orientation) {
  if (shape === 'circle') return '50%';
  if (shape === 'square') return '4px';
  if (shape === 'portrait') return '8px';
  return orientation === 'vertical' ? '14px' : '10px'; // rounded
}

export function photoBoxAspect(shape) {
  return shape === 'portrait' ? '3 / 4' : '1 / 1';
}

/* QR badge placement — an overlay pinned on top of the card via
   position:absolute, independent of each theme's own layout (front used
   to hardcode one fixed spot per theme: inline in Classic's header,
   bottom-right elsewhere; back always centered it in its own stack).
   A full 8-point compass (corners + edge midpoints) rather than just the
   4 corners, so a QR can also sit centered along the top/bottom edge or
   vertically centered along a side. Front always uses one of these 8
   (no "inline" option — there is no natural in-flow spot for it). Back
   defaults to its original centered-in-the-stack look ('center', not a
   real overlay position) but can also be pinned anywhere on the
   compass like the front, freeing up the stack for the banner/ID
   text/extra fields alone. */
export const QR_POSITIONS = [
  { id: 'top-left', label: 'Top Left' },
  { id: 'top-center', label: 'Top Center' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'middle-left', label: 'Middle Left' },
  { id: 'middle-right', label: 'Middle Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-center', label: 'Bottom Center' },
  { id: 'bottom-right', label: 'Bottom Right' },
];

export const BACK_QR_POSITIONS = [
  { id: 'center', label: 'Centered (Default)' },
  ...QR_POSITIONS,
];

/* Returns null for 'center' (or no position at all) — caller keeps
   rendering the QR inline wherever it already sits (front has no such
   case; back's centered stack is the inline case). Otherwise returns
   the absolute overlay style — 'top'/'bottom' pin to that edge (pad
   inset), 'middle' centers vertically; 'left'/'right' pin to that edge,
   'center' centers horizontally — combined via transform where needed. */
export function qrPositionStyle(position, pad = 10) {
  if (!position || position === 'center') return null;
  const [vert, horiz] = String(position).split('-');
  const style = { position: 'absolute' };
  if (vert === 'top') style.top = pad;
  else if (vert === 'bottom') style.bottom = pad;
  else style.top = '50%';
  if (horiz === 'left') style.left = pad;
  else if (horiz === 'right') style.right = pad;
  else style.left = '50%';
  const transforms = [];
  if (vert === 'middle') transforms.push('translateY(-50%)');
  if (horiz === 'center') transforms.push('translateX(-50%)');
  if (transforms.length) style.transform = transforms.join(' ');
  return style;
}

export function qrPositionCss(position, pad = 10) {
  const style = qrPositionStyle(position, pad);
  if (!style) return '';
  return Object.entries(style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${typeof v === 'number' ? `${v}px` : v}`)
    .join(';') + ';';
}

/* Scales a theme's own base QR pixel size (each of the 6 layouts, plus
   the back face's inline/corner spots, has its own base size tuned to
   look right in that specific slot) by the user's chosen percentage —
   same "base size × sizePct/100" pattern as photoSizePct/logoSizePct. */
export function scalePx(base, pct = 100) {
  return Math.round(base * ((pct || 100) / 100));
}

/* #RGB / #RRGGBB -> rgba(r,g,b,alpha) — used to derive a light tint of
   a custom accent color for border/surface, instead of leaving those
   pinned to the original theme's own hex values once the user picks a
   different accent. Shared by IdCardDesigner (editing) and
   IdCardQuickView (read-only profile preview) so both render a saved
   design identically. */
export function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return hex;
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Resolve a saved `design` into the fully-colored theme object IdCardFace
   / idCardPrint expect — primary/secondary come from design.branding,
   falling back to the theme preset; border/surface get re-tinted from a
   custom primary only for layouts using a plain surface (gradient/
   executive intentionally keep their own translucent "glass" look). */
export function resolveCardTheme(design) {
  const base = getTheme(design.themeId);
  const primary = design.branding?.primaryColor || base.colors.primary;
  const secondary = design.branding?.secondaryColor || base.colors.secondary;
  const customized = primary !== base.colors.primary || secondary !== base.colors.secondary;
  const colors = { ...base.colors, primary, secondary };
  if (customized && !['gradient', 'executive'].includes(base.layout)) {
    colors.border = hexToRgba(primary, 0.35);
    colors.surface = hexToRgba(primary, 0.08);
  }
  return { ...base, colors };
}
