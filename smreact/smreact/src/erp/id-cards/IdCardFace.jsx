import { photoRadius, photoBoxAspect, qrPositionStyle, scalePx } from './idCardThemes';

/* ═══════════════════════════════════════════════════════════════════
   ID CARD FACE — the live, on-screen React preview. Six genuinely
   different layouts (branch on theme.layout), all driven by the same
   props so the Designer can swap themes without losing field
   selections. idCardPrint.js renders the same six layouts as a static
   HTML string for print/PDF — kept visually in sync by hand since this
   codebase's established convention (Fee.jsx, Examination.jsx, ...) is
   always a React preview + a parallel HTML-string builder for print,
   never one shared renderer between the two.
   ═══════════════════════════════════════════════════════════════════ */

function PhotoBox({ photoDataUrl, shape, orientation, sizePct = 100, theme, fallbackIcon = 'fa-user', show = true }) {
  if (!show) return null;
  const base = orientation === 'vertical' ? 108 : 74;
  const size = Math.round(base * (sizePct / 100));
  return (
    <div
      style={{
        width: shape === 'portrait' ? size * 0.78 : size,
        aspectRatio: photoBoxAspect(shape),
        borderRadius: photoRadius(shape, orientation),
        overflow: 'hidden', flexShrink: 0,
        background: theme.colors.surface,
        border: `1.5px solid ${theme.colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {photoDataUrl
        ? <img src={photoDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <i className={`fa-solid ${fallbackIcon}`} style={{ fontSize: size * 0.32, color: theme.colors.primary, opacity: 0.5 }} aria-hidden="true"></i>}
    </div>
  );
}

function LogoBox({ logoDataUrl, sizePct = 100, round, tone = 'light' }) {
  const size = Math.round(30 * (sizePct / 100));
  if (!logoDataUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: round ? '50%' : 6, background: tone === 'dark' ? 'rgba(255,255,255,.15)' : 'rgba(15,23,42,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className="fa-solid fa-school" style={{ fontSize: size * 0.5, color: tone === 'dark' ? '#fff' : '#64748B' }} aria-hidden="true"></i>
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: round ? 'center' : 'flex-start' }}>
      <img src={logoDataUrl} alt="School logo" style={{ maxWidth: size, maxHeight: size, objectFit: 'contain', borderRadius: round ? '50%' : 0 }} />
    </div>
  );
}

function CodeBox({ src, label, size = 46 }) {
  if (!src) return null;
  return (
    <div style={{ background: '#fff', padding: 4, borderRadius: 6, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <img src={src} alt={label} style={{ width: size, height: label === 'Barcode' ? size * 0.5 : size, objectFit: 'contain' }} />
    </div>
  );
}

function Rows({ rows, size = 9.5, gap = 3, color, muted, dense }) {
  if (!rows.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: dense ? 1.5 : gap, minWidth: 0 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ minWidth: 0 }}>
          <span style={{ fontSize: size - 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', color: muted, marginRight: 5 }}>{r.label}:</span>
          <span style={{ fontSize: size, fontWeight: 700, color, wordBreak: 'break-word' }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* Width always drives the size (via a responsive clamp — shrinks on
   narrow screens, capped on wide ones), height always auto-follows via
   aspect-ratio. Vertical orientation previously did it the other way
   round (width: auto, height: 100% of the parent) — that only works if
   every ancestor up the chain happens to hand down a definite pixel
   height, which is exactly what broke on smaller/responsive layouts.
   Driving from width is the standard, reliably-supported direction and
   needs nothing from any parent container. */
function CardShell({ orientation, children, style }) {
  return (
    <div
      style={{
        position: 'relative', overflow: 'hidden',
        width: orientation === 'vertical' ? 'clamp(170px, 46vw, 214px)' : 'clamp(220px, 86vw, 340px)',
        aspectRatio: orientation === 'vertical' ? '53.98 / 85.6' : '85.6 / 53.98',
        borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.16)',
        fontFamily: "'Plus Jakarta Sans','Segoe UI',Arial,sans-serif",
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* Every piece of the back is now independently switchable: the banner
   (with its own editable text), the printed ID text, and an arbitrary
   set of extra fields (backRows, add/remove + reorder from the same
   catalog as the front) — instead of one fixed, uncustomizable layout. */
function BackFace({ theme, orientation, qrSrc, barcodeSrc, idText, branding, school, backOptions = {}, backRows = [], qrPosition = 'center', qrSizePct = 100 }) {
  const c = theme.colors;
  const showBanner = backOptions.showBanner !== false;
  const showIdText = backOptions.showIdText !== false;
  /* 'center' (the default) keeps the QR inline in the centered stack,
     exactly as before. Any corner choice pulls it OUT of the stack into
     a pinned overlay instead — so it doesn't render twice. */
  const qrCorner = qrSrc ? qrPositionStyle(qrPosition) : null;
  const qrInline = qrSrc && !qrCorner;
  return (
    <CardShell orientation={orientation} style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      {showBanner && (
        <div style={{ background: c.primary, color: c.onPrimary, padding: '8px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          {backOptions.bannerText || 'If found, please return to school office'}
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, overflow: 'hidden' }}>
        {qrInline && <CodeBox src={qrSrc} label="QR" size={scalePx(72, qrSizePct)} />}
        {barcodeSrc && <CodeBox src={barcodeSrc} label="Barcode" size={140} />}
        {showIdText && idText && <div style={{ fontSize: 10.5, fontWeight: 800, color: c.ink, letterSpacing: '.5px' }}>{idText}</div>}
        {backRows.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
            {backRows.map((r) => (
              <div key={r.key} style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', color: '#94A3B8', marginRight: 4 }}>{r.label}:</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: c.ink }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {(branding.showAddress || branding.showContact) && (
        <div style={{ padding: '8px 14px', fontSize: 8.5, color: '#64748B', textAlign: 'center', borderTop: `1px solid ${c.border}` }}>
          {branding.showAddress && school?.address ? school.address : ''}{branding.showAddress && branding.showContact && school?.address && school?.phone ? ' · ' : ''}{branding.showContact && school?.phone ? school.phone : ''}
        </div>
      )}
      {qrCorner && <div style={qrCorner}><CodeBox src={qrSrc} label="QR" size={scalePx(44, qrSizePct)} /></div>}
    </CardShell>
  );
}

export default function IdCardFace({
  theme, orientation, face = 'front', photoShape = 'rounded', photoSizePct = 100,
  photoDataUrl, logoDataUrl, branding, school, rows, qrSrc, barcodeSrc, idText, showPhoto = true,
  backOptions, backRows,
  qrShowOn = { front: false, back: true }, barcodeShowOn = { front: false, back: false },
  qrPosition = 'bottom-right', backQrPosition = 'center', qrSizePct = 100,
}) {
  const c = theme.colors;

  if (face === 'back') {
    return (
      <BackFace
        theme={theme} orientation={orientation}
        qrSrc={qrShowOn.back ? qrSrc : null}
        barcodeSrc={barcodeShowOn.back ? barcodeSrc : null}
        idText={idText} branding={branding} school={school} backOptions={backOptions} backRows={backRows}
        qrPosition={backQrPosition} qrSizePct={qrSizePct}
      />
    );
  }

  /* QR/barcode used to be a single on/off shown on BOTH the front corner
     badge and the back at once — reassigning these two params here (not
     touching any of the six layout branches below, which all just check
     `qrSrc`/`barcodeSrc` truthiness) is what makes "front" independently
     toggleable from "back". */
  qrSrc = qrShowOn.front ? qrSrc : null;
  barcodeSrc = barcodeShowOn.front ? barcodeSrc : null;

  const headerName = branding.showSchoolName ? school?.name : '';

  /* ── Classic Corporate ── */
  if (theme.layout === 'classic') {
    return (
      <CardShell orientation={orientation} style={{ background: c.bg, border: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `3px solid ${c.primary}` }}>
          {branding.showLogo && <LogoBox logoDataUrl={logoDataUrl} sizePct={branding.logoSizePct} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            {headerName && <div style={{ fontSize: 12, fontWeight: 800, color: c.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerName}</div>}
            <div style={{ fontSize: 8.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.6px', marginTop: 1 }}>Identity Card</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: orientation === 'vertical' ? 'column' : 'row', alignItems: orientation === 'vertical' ? 'center' : 'flex-start', gap: 10, padding: 12 }}>
          <PhotoBox show={showPhoto} photoDataUrl={photoDataUrl} shape={photoShape} orientation={orientation} sizePct={photoSizePct} theme={theme} />
          <Rows rows={rows} color={c.ink} muted="#94A3B8" />
        </div>
        {qrSrc && <div style={qrPositionStyle(qrPosition)}><CodeBox src={qrSrc} size={scalePx(30, qrSizePct)} label="QR" /></div>}
      </CardShell>
    );
  }

  /* ── Modern Gradient ── */
  if (theme.layout === 'gradient') {
    return (
      <CardShell orientation={orientation} style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 4px' }}>
          {branding.showLogo && <LogoBox logoDataUrl={logoDataUrl} sizePct={branding.logoSizePct} tone="dark" round />}
          {headerName && <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerName}</div>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: orientation === 'vertical' ? 'column' : 'row', alignItems: orientation === 'vertical' ? 'center' : 'flex-start', gap: 12, padding: 14, overflow: 'hidden' }}>
          <PhotoBox show={showPhoto} photoDataUrl={photoDataUrl} shape={photoShape} orientation={orientation} sizePct={photoSizePct} theme={{ colors: { ...c, surface: 'rgba(255,255,255,.2)', border: 'rgba(255,255,255,.4)', primary: '#fff' } }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
            {rows.slice(0, 1).map((r) => <div key={r.key} style={{ fontSize: 14, fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</div>)}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, overflow: 'hidden' }}>
              {rows.slice(1).map((r) => (
                <span key={r.key} style={{ fontSize: 8.5, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                  {r.label}: {r.value}
                </span>
              ))}
            </div>
          </div>
        </div>
        {qrSrc && <div style={qrPositionStyle(qrPosition)}><CodeBox src={qrSrc} size={scalePx(34, qrSizePct)} label="QR" /></div>}
      </CardShell>
    );
  }

  /* ── Minimal Elegant ── */
  if (theme.layout === 'minimal') {
    return (
      <CardShell orientation={orientation} style={{ background: c.bg, border: `1px solid ${c.border}` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: c.primary }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 14px 10px 18px', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {branding.showLogo && <LogoBox logoDataUrl={logoDataUrl} sizePct={branding.logoSizePct} />}
            {headerName && <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerName}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, overflow: 'hidden' }}>
            <PhotoBox show={showPhoto} photoDataUrl={photoDataUrl} shape={photoShape} orientation={orientation} sizePct={photoSizePct} theme={theme} />
            <div style={{ height: '70%', width: 1, background: c.border, flexShrink: 0 }} />
            <Rows rows={rows} size={9} gap={4} color={c.ink} muted="#9CA3AF" dense />
          </div>
        </div>
        {qrSrc && <div style={qrPositionStyle(qrPosition)}><CodeBox src={qrSrc} size={scalePx(26, qrSizePct)} label="QR" /></div>}
      </CardShell>
    );
  }

  /* ── Premium Executive ── */
  if (theme.layout === 'executive') {
    return (
      <CardShell orientation={orientation} style={{ background: c.bg }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 100% 0%, rgba(212,175,55,.12), transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${c.border}`, position: 'relative' }}>
          {branding.showLogo && <LogoBox logoDataUrl={logoDataUrl} sizePct={branding.logoSizePct} tone="dark" />}
          {headerName && <div style={{ fontSize: 11, fontWeight: 700, color: c.primary, letterSpacing: '.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerName}</div>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: orientation === 'vertical' ? 'column' : 'row', alignItems: orientation === 'vertical' ? 'center' : 'flex-start', gap: 12, padding: 14, position: 'relative', overflow: 'hidden' }}>
          <PhotoBox show={showPhoto} photoDataUrl={photoDataUrl} shape={photoShape} orientation={orientation} sizePct={photoSizePct} theme={{ colors: { ...c, surface: 'rgba(255,255,255,.08)', border: c.primary, primary: c.primary } }} />
          <Rows rows={rows} color="#F1F5F9" muted={c.primary} />
        </div>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${c.primary}, transparent)` }} />
        {qrSrc && <div style={qrPositionStyle(qrPosition)}><CodeBox src={qrSrc} size={scalePx(30, qrSizePct)} label="QR" /></div>}
      </CardShell>
    );
  }

  /* ── Colorful Academic ── */
  if (theme.layout === 'colorful') {
    return (
      <CardShell orientation={orientation} style={{ background: c.bg, border: `2px solid ${c.border}` }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: c.secondary, opacity: 0.15 }} />
        <div style={{ position: 'absolute', bottom: -24, left: -24, width: 80, height: 80, borderRadius: '50%', background: c.primary, opacity: 0.15 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', position: 'relative' }}>
          {branding.showLogo && <LogoBox logoDataUrl={logoDataUrl} sizePct={branding.logoSizePct} round />}
          {headerName && <div style={{ fontSize: 11.5, fontWeight: 900, color: c.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerName}</div>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: orientation === 'vertical' ? 'column' : 'row', alignItems: orientation === 'vertical' ? 'center' : 'flex-start', gap: 12, padding: '4px 14px 10px', position: 'relative', overflow: 'hidden' }}>
          <PhotoBox show={showPhoto} photoDataUrl={photoDataUrl} shape={photoShape} orientation={orientation} sizePct={photoSizePct} theme={theme} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0, overflow: 'hidden' }}>
            {rows.map((r, i) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, minWidth: 0 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: i % 2 === 0 ? c.primary : c.secondary, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
        {qrSrc && <div style={qrPositionStyle(qrPosition)}><CodeBox src={qrSrc} size={scalePx(30, qrSizePct)} label="QR" /></div>}
      </CardShell>
    );
  }

  /* ── Vertical Modern (adapts gracefully to horizontal too) ── */
  const isV = orientation === 'vertical';
  return (
    <CardShell orientation={orientation} style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div style={{ display: 'flex', flexDirection: isV ? 'column' : 'row', height: '100%' }}>
        <div style={{ position: 'relative', background: c.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12, flex: isV ? '0 0 52%' : '0 0 40%', gap: 8 }}>
          {branding.showLogo && (
            <div style={{ position: 'absolute', top: 8, left: 8 }}>
              <LogoBox logoDataUrl={logoDataUrl} sizePct={branding.logoSizePct} />
            </div>
          )}
          <PhotoBox show={showPhoto} photoDataUrl={photoDataUrl} shape={photoShape} orientation="vertical" sizePct={photoSizePct * 1.3} theme={theme} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, gap: 8, minWidth: 0 }}>
          {headerName && <div style={{ fontSize: 9, fontWeight: 700, color: c.primary, textTransform: 'uppercase', letterSpacing: '.5px' }}>{headerName}</div>}
          {rows.slice(0, 1).map((r) => <div key={r.key} style={{ fontSize: 13, fontWeight: 900, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</div>)}
          <Rows rows={rows.slice(1)} size={9} gap={3} color="#0F172A" muted="#94A3B8" dense />
        </div>
      </div>
      {qrSrc && <div style={qrPositionStyle(qrPosition)}><CodeBox src={qrSrc} size={scalePx(40, qrSizePct)} label="QR" /></div>}
    </CardShell>
  );
}
