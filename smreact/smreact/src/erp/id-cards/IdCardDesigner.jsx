import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ID_CARD_THEMES, getTheme, CARD_SIZES, PHOTO_SHAPES, QR_POSITIONS, BACK_QR_POSITIONS } from './idCardThemes';
import { fieldGroups, allFields, resolveDisplayFields, splitFieldKinds, DEFAULT_FIELD_ORDER } from './idCardFields';
import { getSchoolBranding, saveSchoolBranding, getIdCardDesign, saveIdCardDesign, resetIdCardDesign, defaultDesign } from './idCardService';
import { generateQrDataUrl, generateBarcodeDataUrl } from './idCardCodes';
import { renderCardFaceHtml, buildSingleCardDocument, buildBulkSheetDocument } from './idCardPrint';
import IdCardFace from './IdCardFace';

/* ═══════════════════════════════════════════════════════════════════
   ID CARD DESIGNER — shared modal for both the Students and HR
   modules. `kind` ('student' | 'staff') selects the field catalog and
   id-value resolver; everything else (themes, layout, branding, live
   preview, save/print) is identical for both, per the "reuse, don't
   duplicate" requirement.

   `entities`: [{ entity, ctx, idValue, displayName }] — one or more
   selected students/employees, already resolved by the caller (each
   module knows its own data shape; the Designer only needs a uniform
   shape). `idValue` is what gets encoded into the QR/barcode (reg no.
   / employee code — never a name, CNIC, phone or address).
   ═══════════════════════════════════════════════════════════════════ */

/* #RGB / #RRGGBB -> rgba(r,g,b,alpha) — used to derive a light tint of
   a custom accent color for border/surface (see the `theme` useMemo
   below), instead of leaving those pinned to the original theme's own
   hex values once the user picks a different accent. */
function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return hex;
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function openPrintWindow(html, toast) {
  const w = window.open('', '_blank');
  if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
}

function todayIso() { return new Date().toISOString().slice(0, 10); }
function plusOneYearIso() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/* Sample data used only when the Designer is opened in "Settings" mode
   (one-time theme/field/branding setup, no real student/employee
   picked yet) — lets the live preview render something meaningful
   without needing a real entity, while Generate/Bulk actions stay
   hidden since there's nothing real to generate for. */
function samplePlaceholderEntity(kind) {
  if (kind === 'staff') {
    return {
      entity: { firstName: 'Jordan', lastName: 'Smith', eid: 'EMP-001', type: 'Permanent', join: '2024-01-15', gender: 'Male', blood: 'O+', phone: '0300-1234567', email: 'sample@school.edu', photo: null },
      ctx: { deptName: 'Sample Department', desigName: 'Sample Designation' },
      idValue: 'EMP-001', displayName: 'Jordan Smith (sample)',
    };
  }
  return {
    entity: { first: 'Sample', last: 'Student', reg: '2026-0001', adm: 'ADM-0001', gender: 'Male', dob: '2015-05-10', father: "Father's Name", mother: "Mother's Name", gcontact: '0300-1234567', address: 'Sample Address', photo: null },
    ctx: { cls: { cls: 'Sample Class', sec: 'A' } },
    idValue: '2026-0001', displayName: 'Sample Student',
  };
}

export default function IdCardDesigner({ kind, entities: entitiesProp, school: schoolProp, onClose, toast, settingsOnly = false }) {
  const entities = useMemo(
    () => (entitiesProp && entitiesProp.length ? entitiesProp : [samplePlaceholderEntity(kind)]),
    [entitiesProp, kind]
  );
  const [tab, setTab] = useState('theme');
  /* Remembers whichever front-side tab was open before switching to
     "Back" in the preview, so clicking "Front" again returns the
     controls panel there instead of leaving it stuck on Back Card —
     which is exactly what made edits after switching back to Front
     keep landing on the back-card config instead. */
  const [lastFrontTab, setLastFrontTab] = useState('theme');
  const [loading, setLoading] = useState(true);
  const [design, setDesign] = useState(() => defaultDesign(kind));
  const [branding, setBranding] = useState(schoolProp || {});
  const [face, setFace] = useState('front');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState('auto'); // bulk A4 sheet: 'auto' or a number
  const [qrSrc, setQrSrc] = useState(null);
  const [barcodeSrc, setBarcodeSrc] = useState(null);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef(null);

  const schoolName = branding?.name;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [b, d] = await Promise.all([getSchoolBranding(), getIdCardDesign(kind, schoolProp?.name)]);
      if (cancelled) return;
      setBranding((prev) => ({ ...b, ...prev }));
      setDesign(d);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The Branding panel's Primary/Secondary color pickers must actually
     recolor the card — override the selected theme's own colors with
     whatever the user picked (falling back to the theme's defaults),
     so every layout in IdCardFace/idCardPrint, which all read
     theme.colors.primary/secondary, picks the change up automatically. */
  const theme = useMemo(() => {
    const base = getTheme(design.themeId);
    const primary = design.branding.primaryColor || base.colors.primary;
    const secondary = design.branding.secondaryColor || base.colors.secondary;
    /* Swapping just primary/secondary and leaving border/surface pinned
       to the theme's own original hex values is what made the color
       scheme look "not properly applied" — a custom red primary next to
       the old theme's blue-tinted border/surface reads as broken, not
       recolored. Only re-derive border/surface from the custom color
       when it's ACTUALLY been customized away from the theme's default
       (a cheap string comparison), so a school that never touches the
       color pickers sees the theme exactly as designed. */
    const customized = primary !== base.colors.primary || secondary !== base.colors.secondary;
    /* Gradient/Executive already recolor their dominant surface (the
       gradient itself, or the dark navy body) directly from primary/
       secondary — their border/surface tokens are deliberately
       white-based translucent "glass" overlays that should stay white
       regardless of accent color. Only the light-background themes
       (Classic/Minimal/Colorful/Vertical) tint border/surface FROM the
       primary color in the first place, so only those need re-deriving. */
    const tintable = customized && !['gradient', 'executive'].includes(base.layout);
    return {
      ...base,
      colors: {
        ...base.colors,
        primary,
        secondary,
        border: tintable ? hexToRgba(primary, 0.35) : base.colors.border,
        surface: tintable ? hexToRgba(primary, 0.08) : base.colors.surface,
      },
    };
  }, [design.themeId, design.branding.primaryColor, design.branding.secondaryColor]);
  const current = entities[Math.min(previewIdx, entities.length - 1)] || entities[0];
  /* Issue / Expiry date — user Designer me khud chun sakta hai (design me save hoti hain).
     Khali ho to purana default: aaj ki tareekh aur aaj se 1 saal baad. */
  const issueDate = design.issueDate || todayIso();
  const expiryDate = design.expiryDate || plusOneYearIso();

  const rows = useMemo(() => {
    if (!current) return [];
    const ctx = { ...current.ctx, school: branding, issueDate, expiryDate };
    return resolveDisplayFields(kind, design.fields, current.entity, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [current, design.fields, branding, kind, issueDate, expiryDate]);

  /* Back-of-card extra fields — independent selection/order from the
     front's `rows`, same resolver + same catalog (a school might want
     Father's Name on the front and Emergency Contact on the back). */
  const backRows = useMemo(() => {
    if (!current) return [];
    const ctx = { ...current.ctx, school: branding, issueDate, expiryDate };
    return resolveDisplayFields(kind, design.backFields || [], current.entity, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [current, design.backFields, branding, kind, issueDate, expiryDate]);

  /* QR/barcode each have independent Front/Back visibility (design.qr /
     design.barcode) — "enabled" just means at least one side wants it,
     so the (slightly expensive, async) image only gets generated once
     and IdCardFace/renderCardFaceHtml decide per-face whether to
     actually show it. Photo visibility is still plain field membership. */
  const qrShowOn = { front: !!design.qr?.showFront, back: !!design.qr?.showBack };
  const barcodeShowOn = { front: !!design.barcode?.showFront, back: !!design.barcode?.showBack };
  const qrEnabled = qrShowOn.front || qrShowOn.back;
  const barcodeEnabled = barcodeShowOn.front || barcodeShowOn.back;
  const showPhoto = design.fields.includes('photo');

  useEffect(() => {
    let cancelled = false;
    if (!current) return undefined;
    if (qrEnabled) {
      generateQrDataUrl(current.idValue, { dark: design.branding.primaryColor }).then((src) => { if (!cancelled) setQrSrc(src); });
    } else setQrSrc(null);
    if (barcodeEnabled) {
      setBarcodeSrc(generateBarcodeDataUrl(current.idValue, { color: design.branding.primaryColor }));
    } else setBarcodeSrc(null);
    return () => { cancelled = true; };
  }, [current, qrEnabled, barcodeEnabled, design.branding.primaryColor]);

  if (!current) return null;

  const patchDesign = (patch) => setDesign((d) => ({ ...d, ...patch }));
  const patchBrandingCfg = (patch) => setDesign((d) => ({ ...d, branding: { ...d.branding, ...patch } }));
  const patchQr = (patch) => setDesign((d) => ({ ...d, qr: { ...d.qr, ...patch } }));
  const patchBarcode = (patch) => setDesign((d) => ({ ...d, barcode: { ...d.barcode, ...patch } }));

  const toggleField = (key) => {
    setDesign((d) => {
      const has = d.fields.includes(key);
      return { ...d, fields: has ? d.fields.filter((k) => k !== key) : [...d.fields, key] };
    });
  };

  /* One-click starting points, so a first-time user gets a working card
     immediately instead of having to make ~15 individual checkbox
     decisions before anything looks right. Still fully editable
     afterwards via the normal add/remove/reorder controls below. */
  const FIELD_PRESETS = {
    essential: kind === 'staff' ? ['photo', 'fullName', 'eid', 'designation'] : ['photo', 'fullName', 'reg', 'classSection'],
    standard: DEFAULT_FIELD_ORDER[kind] || [],
    everything: allFields(kind).filter((f) => !f.unavailable).map((f) => f.key),
  };
  const applyPreset = (presetKey) => setDesign((d) => ({ ...d, fields: [...(FIELD_PRESETS[presetKey] || [])] }));
  /* Reorders `key` relative to the OTHER orderable (non-photo/logo/qr/
     barcode) fields only, by swapping its absolute position with the
     next orderable field's — so special fields interspersed in
     design.fields never shift, and the visible order-list (which only
     shows orderable fields) reorders exactly as clicked. */
  const moveField = (key, dir) => {
    setDesign((d) => {
      const { orderable } = splitFieldKinds(kind, d.fields);
      const idx = orderable.indexOf(key);
      const nextIdx = idx + dir;
      if (idx < 0 || nextIdx < 0 || nextIdx >= orderable.length) return d;
      const otherKey = orderable[nextIdx];
      const arr = [...d.fields];
      const posA = arr.indexOf(key);
      const posB = arr.indexOf(otherKey);
      [arr[posA], arr[posB]] = [arr[posB], arr[posA]];
      return { ...d, fields: arr };
    });
  };

  const patchBackOptions = (patch) => setDesign((d) => ({ ...d, backOptions: { ...d.backOptions, ...patch } }));
  const toggleBackField = (key) => {
    setDesign((d) => {
      const list = d.backFields || [];
      const has = list.includes(key);
      return { ...d, backFields: has ? list.filter((k) => k !== key) : [...list, key] };
    });
  };
  const moveBackField = (key, dir) => {
    setDesign((d) => {
      const list = d.backFields || [];
      const { orderable } = splitFieldKinds(kind, list);
      const idx = orderable.indexOf(key);
      const nextIdx = idx + dir;
      if (idx < 0 || nextIdx < 0 || nextIdx >= orderable.length) return d;
      const otherKey = orderable[nextIdx];
      const arr = [...list];
      const posA = arr.indexOf(key);
      const posB = arr.indexOf(otherKey);
      [arr[posA], arr[posB]] = [arr[posB], arr[posA]];
      return { ...d, backFields: arr };
    });
  };

  const onLogoPick = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please pick an image file', 'error'); return; }
    if (file.size > 1.5 * 1024 * 1024) { toast('Logo image must be under 1.5 MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => setBranding((b) => ({ ...b, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveIdCardDesign(kind, schoolName, design),
        saveSchoolBranding({ logo: branding.logo, email: branding.email, website: branding.website, campus: branding.campus }),
      ]);
      toast(`${kind === 'staff' ? 'Staff' : 'Student'} ID card design saved`, 'success');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const fresh = await resetIdCardDesign(kind, schoolName);
    setDesign(fresh);
    toast('Design reset to default', 'success');
  };

  const buildFaceCtx = (item, faceName) => ({
    theme, orientation: design.orientation, face: faceName,
    photoShape: design.photoShape, photoSizePct: design.photoSizePct,
    photoDataUrl: item.entity.photo || null,
    logoDataUrl: branding.logo || null,
    branding: design.branding,
    school: branding,
    rows: resolveDisplayFields(kind, design.fields, item.entity, { ...item.ctx, school: branding, issueDate, expiryDate }),
    qrSrc, // regenerated per-item at build time for bulk (see below); IdCardFace/renderCardFaceHtml apply qrShowOn per-face themselves
    barcodeSrc,
    qrShowOn, barcodeShowOn,
    qrPosition: design.qr?.position || 'bottom-right',
    backQrPosition: design.qr?.backPosition || 'center',
    qrSizePct: design.qr?.sizePct || 100,
    idText: item.idValue,
    showPhoto,
    /* Student ID card par QR ke neeche koi number (idText) nahi dikhana —
       preview, Generate aur Bulk Sheet sabhi isi buildFaceCtx se bante hain. */
    backOptions: kind === 'student'
      ? { ...design.backOptions, showIdText: false }
      : design.backOptions,
    backRows: resolveDisplayFields(kind, design.backFields || [], item.entity, { ...item.ctx, school: branding, issueDate, expiryDate }),
  });

  /* A back page is worth printing whenever it would show SOMETHING —
     QR/barcode ON THE BACK specifically, the banner, the ID text, extra
     back fields, or the address/contact footer — not just whenever
     QR/barcode happen to be on somewhere (they might be front-only),
     otherwise a school that customized the back with only text fields
     (no QR/barcode) would silently lose their back page in the PDF. */
  const backHasContent = qrShowOn.back || barcodeShowOn.back
    || design.backOptions?.showBanner !== false
    || design.backOptions?.showIdText !== false
    || (design.backFields || []).length > 0
    || design.branding.showAddress || design.branding.showContact;

  const generateCards = async () => {
    const pages = [];
    for (const item of entities) {
      const itemQr = qrEnabled ? await generateQrDataUrl(item.idValue, { dark: design.branding.primaryColor }) : null;
      const itemBarcode = barcodeEnabled ? generateBarcodeDataUrl(item.idValue, { color: design.branding.primaryColor }) : null;
      const frontHtml = renderCardFaceHtml({ ...buildFaceCtx(item, 'front'), qrSrc: itemQr, barcodeSrc: itemBarcode });
      const backHtml = backHasContent
        ? renderCardFaceHtml({ ...buildFaceCtx(item, 'back'), qrSrc: itemQr, barcodeSrc: itemBarcode })
        : null;
      pages.push({ frontHtml, backHtml });
    }
    const title = entities.length === 1 ? `ID Card — ${entities[0].displayName}` : `ID Cards — ${entities.length} ${kind === 'staff' ? 'Employees' : 'Students'}`;
    const html = buildSingleCardDocument({
      title, sizeId: design.sizeId, orientation: design.orientation,
      frontHtml: pages.map((p) => p.frontHtml).join(''),
      backHtml: pages.filter((p) => p.backHtml).map((p) => p.backHtml).join(''),
    });
    openPrintWindow(html, toast);
  };

  const generateBulkSheet = async () => {
    /* Every card's BOTH sides go into the sheet now — all fronts first,
       then all backs in the same order — so cutting/laminating a batch
       never silently loses the back (previously only fronts printed at
       all here, on the assumption a shared A4 sheet couldn't fit backs;
       it can, as a second block of pages right after the fronts). The
       back block is only added when the design's back actually shows
       something (backHasContent), same rule as the single-card print. */
    const cardsHtml = [];
    const backCardsHtml = [];
    for (const item of entities) {
      const itemQr = qrEnabled ? await generateQrDataUrl(item.idValue, { dark: design.branding.primaryColor }) : null;
      const itemBarcode = barcodeEnabled ? generateBarcodeDataUrl(item.idValue, { color: design.branding.primaryColor }) : null;
      cardsHtml.push(renderCardFaceHtml({ ...buildFaceCtx(item, 'front'), qrSrc: itemQr, barcodeSrc: itemBarcode }));
      if (backHasContent) {
        backCardsHtml.push(renderCardFaceHtml({ ...buildFaceCtx(item, 'back'), qrSrc: itemQr, barcodeSrc: itemBarcode }));
      }
    }
    const html = buildBulkSheetDocument({ title: `ID Cards Sheet — ${entities.length} ${kind === 'staff' ? 'Employees' : 'Students'}`, sizeId: design.sizeId, orientation: design.orientation, cardsHtml, backCardsHtml, perPage: cardsPerPage });
    openPrintWindow(html, toast);
  };

  /* Fewer, more logical tabs (5 instead of 7) — Layout+Photo merge into
     one "Design" tab, and Fields+QR/Barcode merge into one "Content"
     tab, since they were really the same decision ("what shows on the
     card") split across two places for no real reason. */
  /* A guided, numbered flow, not a flat tab rail: pick a theme, pick
     the layout, then customize the front (everything that shows on it,
     including its colors), then the back — matching how a school
     naturally thinks about designing a card, step by step. Branding's
     logo/name/colors moved into "Front" (they're front-of-card
     decisions); address/contact moved into "Back" (they only ever
     print on the back). Still freely clickable, not locked — a step
     number can be clicked directly to jump there. */
  const STEP_ORDER = ['theme', 'layout', 'front', 'back'];
  const tabs = [
    { id: 'theme',  label: 'Theme',  icon: 'fa-palette' },
    { id: 'layout', label: 'Layout', icon: 'fa-crop-simple' },
    { id: 'front',  label: 'Front Side', icon: 'fa-id-card' },
    { id: 'back',   label: 'Back Side',  icon: 'fa-clone' },
  ];
  const goToStep = (id) => { setTab(id); if (id === 'back') setFace('back'); else { setLastFrontTab(id); setFace('front'); } };
  const goNextStep = () => {
    const idx = STEP_ORDER.indexOf(tab);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) goToStep(STEP_ORDER[idx + 1]);
  };

  return createPortal(
    <div className="idcd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{IDCD_CSS}</style>
      <div className="idcd-modal">
        <div className="idcd-head">
          <div className="idcd-head-left">
            <div className="idcd-head-icon"><i className="fa-solid fa-id-card-clip" aria-hidden="true"></i></div>
            <div>
              <div className="idcd-title">{kind === 'staff' ? 'Staff' : 'Student'} ID Card Designer</div>
              <div className="idcd-sub">
                {settingsOnly
                  ? 'Settings — one-time setup, previewed on sample data'
                  : (entities.length === 1 ? entities[0].displayName : `${entities.length} ${kind === 'staff' ? 'employees' : 'students'} selected`)}
              </div>
            </div>
          </div>
          <button type="button" className="idcd-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>

        {loading ? (
          <div className="idcd-loading"><div className="idcd-spinner"></div> Loading design…</div>
        ) : (
          <div className="idcd-body">
            {/* ── Controls ── */}
            <div className="idcd-controls">
              <div className="idcd-tabs idcd-steps">
                {tabs.map((t, i) => (
                  <button
                    key={t.id} type="button" className={`idcd-tab idcd-step${tab === t.id ? ' active' : ''}${STEP_ORDER.indexOf(tab) > i ? ' done' : ''}`}
                    onClick={() => goToStep(t.id)}
                  >
                    <span className="idcd-step-num">{STEP_ORDER.indexOf(tab) > i ? <i className="fa-solid fa-check" aria-hidden="true"></i> : i + 1}</span>
                    <span><i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}</span>
                  </button>
                ))}
              </div>

              <div className="idcd-panel">
                {tab === 'theme' && (
                  <div className="idcd-theme-grid">
                    {ID_CARD_THEMES.map((t) => (
                      <button
                        key={t.id} type="button"
                        className={`idcd-theme-card${design.themeId === t.id ? ' active' : ''}`}
                        onClick={() => patchDesign({ themeId: t.id, branding: { ...design.branding, primaryColor: t.colors.primary, secondaryColor: t.colors.secondary } })}
                      >
                        <div className="idcd-theme-swatch" style={{ background: t.layout === 'gradient' ? `linear-gradient(135deg,${t.colors.primary},${t.colors.secondary})` : t.colors.bg, border: `1px solid ${t.colors.border}` }}>
                          <div style={{ height: 6, background: t.colors.primary, borderRadius: 2, width: '70%' }} />
                          <div style={{ width: 18, height: 18, borderRadius: t.defaultPhotoShape === 'circle' ? '50%' : 4, background: t.colors.secondary, marginTop: 6 }} />
                        </div>
                        <div className="idcd-theme-name">{t.name}</div>
                        <div className="idcd-theme-tagline">{t.tagline}</div>
                        {design.themeId === t.id && <div className="idcd-theme-check"><i className="fa-solid fa-check" aria-hidden="true"></i></div>}
                      </button>
                    ))}
                  </div>
                )}
                {tab === 'theme' && (
                  <button type="button" className="idcd-btn idcd-btn-primary idcd-next-step" onClick={goNextStep}>
                    Next: Layout <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                  </button>
                )}

                {tab === 'layout' && (
                  <>
                    <div className="idcd-field-label">Orientation</div>
                    <div className="idcd-chip-row">
                      {['horizontal', 'vertical'].map((o) => (
                        <button key={o} type="button" className={`idcd-chip${design.orientation === o ? ' active' : ''}`} onClick={() => patchDesign({ orientation: o })}>
                          <i className={`fa-solid ${o === 'horizontal' ? 'fa-id-card' : 'fa-mobile-screen'}`} aria-hidden="true"></i> {o === 'horizontal' ? 'Horizontal' : 'Vertical'}
                        </button>
                      ))}
                    </div>
                    <div className="idcd-field-label" style={{ marginTop: 16 }}>Card Size</div>
                    <div className="idcd-chip-row">
                      {Object.values(CARD_SIZES).map((s) => (
                        <button key={s.id} type="button" className={`idcd-chip${design.sizeId === s.id ? ' active' : ''}`} onClick={() => patchDesign({ sizeId: s.id })}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="idcd-btn idcd-btn-primary idcd-next-step" onClick={goNextStep}>
                      Next: Design the Front <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </button>
                  </>
                )}

                {tab === 'front' && (
                  <>
                    <div className="idcd-field-label">Quick Start</div>
                    <div className="idcd-hint" style={{ marginBottom: 8 }}>Pick a starting point, then fine-tune below — nothing here is final.</div>
                    <div className="idcd-chip-row" style={{ marginBottom: 18 }}>
                      <button type="button" className="idcd-chip" onClick={() => applyPreset('essential')}>Essential</button>
                      <button type="button" className="idcd-chip" onClick={() => applyPreset('standard')}>Standard</button>
                      <button type="button" className="idcd-chip" onClick={() => applyPreset('everything')}>Show Everything</button>
                    </div>

                    <div className="idcd-field-label">On the Card (use the arrows to reorder)</div>
                    <div className="idcd-hint" style={{ marginBottom: 8 }}>Photo, logo and QR/barcode each have a fixed spot in every theme, so only text fields are reorderable here.</div>
                    <div className="idcd-order-list">
                      {(() => {
                        const { orderable } = splitFieldKinds(kind, design.fields);
                        if (orderable.length === 0) return <div className="idcd-empty-hint">No text fields selected yet — add some below.</div>;
                        return orderable.map((key, i) => {
                          const f = allFields(kind).find((x) => x.key === key);
                          if (!f) return null;
                          return (
                            <div key={key} className="idcd-order-row">
                              <span className="idcd-order-label">{f.label}</span>
                              <div className="idcd-order-btns">
                                <button type="button" disabled={i === 0} onClick={() => moveField(key, -1)} aria-label="Move up"><i className="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
                                <button type="button" disabled={i === orderable.length - 1} onClick={() => moveField(key, 1)} aria-label="Move down"><i className="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
                                <button type="button" onClick={() => toggleField(key)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Only fields NOT already added show up here — once you add
                        one, it moves into the list above and disappears from
                        this pool, so there's only ever one place to look for
                        "is this field on the card yet or not". */}
                    <div className="idcd-field-label" style={{ marginTop: 16 }}>Add More Fields</div>
                    {fieldGroups(kind).map((g) => {
                      const available = g.fields.filter((f) => !design.fields.includes(f.key));
                      if (available.length === 0) return null;
                      return (
                        <div key={g.id} className="idcd-group">
                          <div className="idcd-group-title">{g.label}</div>
                          {available.map((f) => (
                            <label key={f.key} className={`idcd-check-row${f.unavailable ? ' disabled' : ''}`} title={f.unavailable ? 'No data available for this field yet' : ''}>
                              <input
                                type="checkbox"
                                disabled={f.unavailable}
                                checked={false}
                                onChange={() => toggleField(f.key)}
                              />
                              {f.label}
                              {f.unavailable && <span className="idcd-unavail">no data</span>}
                            </label>
                          ))}
                        </div>
                      );
                    })}

                    <div className="idcd-field-label" style={{ marginTop: 18 }}>Issue &amp; Expiry Date</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
                        Issue Date
                        <input type="date" value={issueDate}
                          onChange={(e) => patchDesign({ issueDate: e.target.value })}
                          style={{ height: 34, padding: '0 8px', border: '1px solid var(--border-light, #E2E8F0)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
                        Expiry Date
                        <input type="date" value={expiryDate} min={issueDate}
                          onChange={(e) => patchDesign({ expiryDate: e.target.value })}
                          style={{ height: 34, padding: '0 8px', border: '1px solid var(--border-light, #E2E8F0)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
                      </label>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #64748B)', marginTop: 6 }}>
                      To show these on the card, tick Issue Date / Expiry Date under "Add More Fields → Additional Information".
                      {(design.issueDate || design.expiryDate) && (
                        <button type="button" onClick={() => patchDesign({ issueDate: '', expiryDate: '' })}
                          style={{ marginLeft: 6, border: 'none', background: 'none', color: 'var(--brand-primary, #2563EB)', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>
                          Reset to default
                        </button>
                      )}
                    </div>

                    <div className="idcd-field-label" style={{ marginTop: 18 }}>Photo</div>
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={showPhoto} onChange={() => toggleField('photo')} />
                      Show {kind === 'staff' ? 'employee' : 'student'} photo
                    </label>
                    {showPhoto && (
                      <>
                        <div className="idcd-chip-row" style={{ marginTop: 8 }}>
                          {PHOTO_SHAPES.map((s) => (
                            <button key={s.id} type="button" className={`idcd-chip${design.photoShape === s.id ? ' active' : ''}`} onClick={() => patchDesign({ photoShape: s.id })}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                        <div className="idcd-slider-row" style={{ marginTop: 10 }}>
                          <span>Photo size</span>
                          <input type="range" min="70" max="140" value={design.photoSizePct} onChange={(e) => patchDesign({ photoSizePct: Number(e.target.value) })} />
                        </div>
                      </>
                    )}
                    <div className="idcd-hint">The existing profile photo is used automatically — no need to upload it again here.</div>

                    <div className="idcd-field-label" style={{ marginTop: 18 }}>School Logo</div>
                    <div className="idcd-logo-row">
                      <div className="idcd-logo-preview">
                        {branding.logo ? <img src={branding.logo} alt="School logo" /> : <i className="fa-solid fa-school" aria-hidden="true"></i>}
                      </div>
                      <div>
                        <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onLogoPick(e.target.files?.[0])} />
                        <button type="button" className="idcd-btn idcd-btn-ghost" onClick={() => logoInputRef.current?.click()}>
                          <i className="fa-solid fa-upload" aria-hidden="true"></i> {branding.logo ? 'Replace Logo' : 'Upload Logo'}
                        </button>
                        {branding.logo && (
                          <button type="button" className="idcd-btn idcd-btn-text" onClick={() => setBranding((b) => ({ ...b, logo: null }))}>Remove</button>
                        )}
                      </div>
                    </div>
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={design.branding.showLogo} onChange={(e) => patchBrandingCfg({ showLogo: e.target.checked })} />
                      Show school logo
                    </label>
                    {design.branding.showLogo && (
                      <div className="idcd-slider-row">
                        <span>Logo size</span>
                        <input type="range" min="60" max="160" value={design.branding.logoSizePct} onChange={(e) => patchBrandingCfg({ logoSizePct: Number(e.target.value) })} />
                      </div>
                    )}
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={design.branding.showSchoolName} onChange={(e) => patchBrandingCfg({ showSchoolName: e.target.checked })} />
                      Show school name
                    </label>

                    <div className="idcd-field-label" style={{ marginTop: 16 }}>Accent Colors</div>
                    <div className="idcd-color-row">
                      <label>Primary <input type="color" value={design.branding.primaryColor} onChange={(e) => patchBrandingCfg({ primaryColor: e.target.value })} /></label>
                      <label>Secondary <input type="color" value={design.branding.secondaryColor} onChange={(e) => patchBrandingCfg({ secondaryColor: e.target.value })} /></label>
                    </div>

                    <div className="idcd-field-label" style={{ marginTop: 18 }}>QR Code &amp; Barcode (Front)</div>
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={qrShowOn.front} onChange={(e) => patchQr({ showFront: e.target.checked })} />
                      Show QR code on the front
                    </label>
                    {qrShowOn.front && (
                      <div className="idcd-qrpos-row">
                        {QR_POSITIONS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={`idcd-qrpos-btn${(design.qr?.position || 'bottom-right') === p.id ? ' on' : ''}`}
                            onClick={() => patchQr({ position: p.id })}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {(qrShowOn.front || qrShowOn.back) && (
                      <div className="idcd-qrsize-row">
                        <span>QR Code Size</span>
                        <input
                          type="range" min="60" max="160" step="5"
                          value={design.qr?.sizePct || 100}
                          onChange={(e) => patchQr({ sizePct: +e.target.value })}
                        />
                        <span className="idcd-qrsize-val">{design.qr?.sizePct || 100}%</span>
                      </div>
                    )}
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={barcodeShowOn.front} onChange={(e) => patchBarcode({ showFront: e.target.checked })} />
                      Show barcode on the front
                    </label>
                    <div className="idcd-hint" style={{ marginBottom: 12 }}>Front and back are independent — a code can show on one, both, or neither. Set the back's copy on the next step. QR size is shared between both sides.</div>

                    <button type="button" className="idcd-btn idcd-btn-primary idcd-next-step" onClick={goNextStep}>
                      Next: Design the Back <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </button>
                  </>
                )}

                {tab === 'back' && (
                  <>
                    <div className="idcd-field-label">Back Card Elements</div>
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={design.backOptions?.showBanner !== false} onChange={(e) => patchBackOptions({ showBanner: e.target.checked })} />
                      Show banner
                    </label>
                    {design.backOptions?.showBanner !== false && (
                      <input
                        className="idcd-text-input"
                        value={design.backOptions?.bannerText ?? ''}
                        placeholder="If found, please return to school office"
                        onChange={(e) => patchBackOptions({ bannerText: e.target.value })}
                        maxLength={80}
                      />
                    )}
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={design.backOptions?.showIdText !== false} onChange={(e) => patchBackOptions({ showIdText: e.target.checked })} />
                      Show {kind === 'staff' ? 'employee code' : 'registration number'} text
                    </label>

                    <div className="idcd-field-label" style={{ marginTop: 16 }}>Extra Fields on the Back</div>
                    <div className="idcd-hint" style={{ marginBottom: 8 }}>Add, remove or reorder additional information shown below the QR/barcode on the back — independent from the front.</div>
                    <div className="idcd-order-list">
                      {(() => {
                        const { orderable } = splitFieldKinds(kind, design.backFields || []);
                        if (orderable.length === 0) return <div className="idcd-empty-hint">No extra back fields yet — add some below.</div>;
                        return orderable.map((key, i) => {
                          const f = allFields(kind).find((x) => x.key === key);
                          if (!f) return null;
                          return (
                            <div key={key} className="idcd-order-row">
                              <span className="idcd-order-label">{f.label}</span>
                              <div className="idcd-order-btns">
                                <button type="button" disabled={i === 0} onClick={() => moveBackField(key, -1)} aria-label="Move up"><i className="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
                                <button type="button" disabled={i === orderable.length - 1} onClick={() => moveBackField(key, 1)} aria-label="Move down"><i className="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
                                <button type="button" onClick={() => toggleBackField(key)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    <div className="idcd-field-label" style={{ marginTop: 16 }}>Add More Fields</div>
                    {fieldGroups(kind).map((g) => {
                      const available = g.fields.filter((f) => !f.kind && !(design.backFields || []).includes(f.key));
                      if (available.length === 0) return null;
                      return (
                        <div key={g.id} className="idcd-group">
                          <div className="idcd-group-title">{g.label}</div>
                          {available.map((f) => (
                            <label key={f.key} className={`idcd-check-row${f.unavailable ? ' disabled' : ''}`} title={f.unavailable ? 'No data available for this field yet' : ''}>
                              <input
                                type="checkbox"
                                disabled={f.unavailable}
                                checked={false}
                                onChange={() => toggleBackField(f.key)}
                              />
                              {f.label}
                              {f.unavailable && <span className="idcd-unavail">no data</span>}
                            </label>
                          ))}
                        </div>
                      );
                    })}

                    <div className="idcd-field-label" style={{ marginTop: 18 }}>School Info Footer</div>
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={design.branding.showAddress} onChange={(e) => patchBrandingCfg({ showAddress: e.target.checked })} />
                      Show school address
                    </label>
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={design.branding.showContact} onChange={(e) => patchBrandingCfg({ showContact: e.target.checked })} />
                      Show school contact number
                    </label>

                    <div className="idcd-field-label" style={{ marginTop: 18 }}>QR Code &amp; Barcode (Back)</div>
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={qrShowOn.back} onChange={(e) => patchQr({ showBack: e.target.checked })} />
                      Show QR code on the back
                    </label>
                    {qrShowOn.back && (
                      <div className="idcd-qrpos-row">
                        {BACK_QR_POSITIONS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={`idcd-qrpos-btn${(design.qr?.backPosition || 'center') === p.id ? ' on' : ''}`}
                            onClick={() => patchQr({ backPosition: p.id })}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {(qrShowOn.front || qrShowOn.back) && (
                      <div className="idcd-qrsize-row">
                        <span>QR Code Size</span>
                        <input
                          type="range" min="60" max="160" step="5"
                          value={design.qr?.sizePct || 100}
                          onChange={(e) => patchQr({ sizePct: +e.target.value })}
                        />
                        <span className="idcd-qrsize-val">{design.qr?.sizePct || 100}%</span>
                      </div>
                    )}
                    <div className="idcd-hint" style={{ marginBottom: 10 }}>Encodes the {kind === 'staff' ? 'employee code' : 'registration number'} only — no personal details.</div>
                    <label className="idcd-check-row">
                      <input type="checkbox" checked={barcodeShowOn.back} onChange={(e) => patchBarcode({ showBack: e.target.checked })} />
                      Show barcode on the back
                    </label>
                  </>
                )}
              </div>

              <div className="idcd-controls-foot">
                <button type="button" className="idcd-btn idcd-btn-ghost" onClick={handleReset}><i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Reset to Default</button>
                <button type="button" className="idcd-btn idcd-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : <><i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Design</>}
                </button>
              </div>
            </div>

            {/* ── Live preview ── */}
            <div className="idcd-preview-pane">
              <div className="idcd-preview-toolbar">
                {entities.length > 1 && (
                  <div className="idcd-preview-nav">
                    <button type="button" disabled={previewIdx === 0} onClick={() => setPreviewIdx((i) => i - 1)}><i className="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
                    <span>{previewIdx + 1} / {entities.length} · {current.displayName}</span>
                    <button type="button" disabled={previewIdx === entities.length - 1} onClick={() => setPreviewIdx((i) => i + 1)}><i className="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
                  </div>
                )}
                <div className="idcd-preview-actions">
                  <button
                    type="button" className={`idcd-face-toggle${face === 'front' ? ' active' : ''}`}
                    onClick={() => goToStep(lastFrontTab)}
                  >
                    Front
                  </button>
                  <button
                    type="button" className={`idcd-face-toggle${face === 'back' ? ' active' : ''}`}
                    onClick={() => goToStep('back')}
                  >
                    Back
                  </button>
                  <div className="idcd-zoom">
                    <button type="button" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))}><i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i></button>
                    <button type="button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
                    <button type="button" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(1)))}><i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i></button>
                  </div>
                </div>
              </div>

              <div className="idcd-preview-stage">
                <div
                  className="idcd-preview-frame"
                  style={{ transform: `scale(${zoom})` }}
                >
                  <IdCardFace
                    theme={theme}
                    orientation={design.orientation}
                    face={face}
                    photoShape={design.photoShape}
                    photoSizePct={design.photoSizePct}
                    photoDataUrl={current.entity.photo || null}
                    logoDataUrl={branding.logo || null}
                    branding={design.branding}
                    school={branding}
                    rows={rows}
                    qrSrc={qrSrc}
                    barcodeSrc={barcodeSrc}
                    qrShowOn={qrShowOn}
                    barcodeShowOn={barcodeShowOn}
                    qrPosition={design.qr?.position || 'bottom-right'}
                    backQrPosition={design.qr?.backPosition || 'center'}
                    qrSizePct={design.qr?.sizePct || 100}
                    idText={current.idValue}
                    showPhoto={showPhoto}
                    backOptions={design.backOptions}
                    backRows={backRows}
                  />
                </div>
              </div>

              <div className="idcd-preview-foot">
                {settingsOnly ? (
                  <div className="idcd-hint">This is a sample preview. Save the design here, then use <b>ID Cards → Classwise &amp; Bulk Generation</b> to pick real {kind === 'staff' ? 'employees' : 'students'} and generate/download their cards.</div>
                ) : (
                  <>
                    <button type="button" className="idcd-btn idcd-btn-primary" onClick={generateCards}>
                      <i className="fa-solid fa-file-pdf" aria-hidden="true"></i> {entities.length > 1 ? `Generate ${entities.length} Cards` : 'Download / Print Card'}
                    </button>
                    {entities.length > 1 && (
                      <>
                        <select
                          className="idcd-perpage-select"
                          value={cardsPerPage}
                          onChange={(e) => setCardsPerPage(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                          title="Cards per printed A4 sheet"
                        >
                          <option value="auto">Auto-fit per page</option>
                          <option value="1">1 per page</option>
                          <option value="2">2 per page</option>
                          <option value="4">4 per page</option>
                          <option value="6">6 per page</option>
                          <option value="8">8 per page</option>
                        </select>
                        <button type="button" className="idcd-btn idcd-btn-ghost" onClick={generateBulkSheet}>
                          <i className="fa-solid fa-table-cells" aria-hidden="true"></i> Bulk A4 Sheet
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const IDCD_CSS = `
.idcd-overlay{position:fixed;inset:0;z-index:9800;background:rgba(10,22,40,.68);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
.idcd-modal{width:100%;max-width:1180px;height:min(880px,94vh);background:#fff;border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
.idcd-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #E5E7EB;flex-shrink:0}
.idcd-head-left{display:flex;align-items:center;gap:12px}
.idcd-head-icon{width:38px;height:38px;border-radius:10px;background:var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF));color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px}
.idcd-title{font-size:15px;font-weight:800;color:#0F172A}
.idcd-sub{font-size:11.5px;color:#64748B;margin-top:1px}
.idcd-close{width:34px;height:34px;border-radius:9px;border:1.5px solid #E5E7EB;background:transparent;color:#64748B;cursor:pointer}
.idcd-close:hover{border-color:#94A3B8;color:#0F172A}
.idcd-loading{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;color:#64748B;font-size:13px}
.idcd-spinner{width:22px;height:22px;border-radius:50%;border:3px solid #DBEAFE;border-top-color:#1E3A8A;animation:idcdspin .8s linear infinite}
@keyframes idcdspin{to{transform:rotate(360deg)}}
.idcd-body{flex:1;display:flex;min-height:0}
.idcd-controls{width:360px;flex-shrink:0;border-right:1px solid #E5E7EB;display:flex;flex-direction:column;min-height:0}
.idcd-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:10px;border-bottom:1px solid #E5E7EB;flex-shrink:0}
.idcd-tab{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:8px;border:1px solid transparent;background:transparent;color:#64748B;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}
.idcd-tab:hover{background:#F8FAFF}
.idcd-tab.active{background:#EFF6FF;color:#1E3A8A;border-color:#DBEAFE}
.idcd-steps{flex-wrap:nowrap;gap:2px}
.idcd-step{flex:1;flex-direction:column;gap:4px;padding:8px 4px;text-align:center}
.idcd-step-num{width:20px;height:20px;border-radius:50%;background:#E5E7EB;color:#64748B;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center}
.idcd-step.active .idcd-step-num{background:#1E3A8A;color:#fff}
.idcd-step.done .idcd-step-num{background:#16A34A;color:#fff}
.idcd-step span:last-child{font-size:9.5px;white-space:nowrap}
.idcd-next-step{width:100%;margin-top:18px}
.idcd-qrpos-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:2px 0 10px 22px}
.idcd-qrpos-btn{padding:7px 8px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;color:#475569;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}
.idcd-qrpos-btn.on{border-color:#1E3A8A;background:#DBEAFE;color:#1E3A8A}
.idcd-qrsize-row{display:flex;align-items:center;gap:10px;margin:2px 0 10px 22px}
.idcd-qrsize-row span:first-child{font-size:11px;font-weight:700;color:#475569;white-space:nowrap}
.idcd-qrsize-row input[type="range"]{flex:1}
.idcd-qrsize-val{font-size:11px;font-weight:800;color:#1E3A8A;min-width:34px;text-align:right}
.idcd-panel{flex:1;overflow-y:auto;padding:16px}
.idcd-controls-foot{display:flex;gap:8px;padding:14px 16px;border-top:1px solid #E5E7EB;flex-shrink:0}
.idcd-field-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#64748B;margin-bottom:8px}
.idcd-theme-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.idcd-theme-card{position:relative;border:1.5px solid #E5E7EB;border-radius:12px;padding:10px;background:#fff;cursor:pointer;text-align:left;font-family:inherit}
.idcd-theme-card:hover{border-color:#94A3B8}
.idcd-theme-card.active{border-color:#1E3A8A;box-shadow:0 0 0 3px rgba(30,58,138,.12)}
.idcd-theme-swatch{height:56px;border-radius:8px;padding:8px;display:flex;flex-direction:column;margin-bottom:8px}
.idcd-theme-name{font-size:11.5px;font-weight:800;color:#0F172A}
.idcd-theme-tagline{font-size:9.5px;color:#94A3B8;margin-top:2px;line-height:1.3}
.idcd-theme-check{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:#1E3A8A;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px}
.idcd-chip-row{display:flex;flex-wrap:wrap;gap:8px}
.idcd-chip{padding:7px 12px;border-radius:999px;border:1.5px solid #E5E7EB;background:#fff;color:#64748B;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.idcd-chip.active{border-color:#1E3A8A;color:#1E3A8A;background:rgba(30,58,138,.06)}
.idcd-logo-row{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.idcd-logo-preview{width:60px;height:60px;border-radius:10px;border:1.5px dashed #CBD5E1;background:#F8FAFF;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.idcd-logo-preview img{max-width:100%;max-height:100%;object-fit:contain}
.idcd-logo-preview i{font-size:20px;color:#94A3B8}
.idcd-check-row{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#0F172A;padding:6px 0;cursor:pointer}
.idcd-check-row.disabled{color:#CBD5E1;cursor:not-allowed}
.idcd-unavail{font-size:9px;color:#CBD5E1;font-weight:700;text-transform:uppercase;margin-left:auto}
.idcd-slider-row{display:flex;align-items:center;gap:10px;font-size:11.5px;color:#64748B;margin:6px 0}
.idcd-slider-row input{flex:1;accent-color:#1E3A8A}
.idcd-color-row{display:flex;gap:16px}
.idcd-color-row label{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#64748B;font-weight:700}
.idcd-order-list{display:flex;flex-direction:column;gap:6px;margin-bottom:6px}
.idcd-order-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;background:#F8FAFF;border:1px solid #EFF2FA}
.idcd-order-label{font-size:12px;font-weight:700;color:#0F172A}
.idcd-order-btns{display:flex;gap:2px}
.idcd-order-btns button{width:24px;height:24px;border-radius:6px;border:1px solid #E5E7EB;background:#fff;color:#64748B;cursor:pointer;font-size:10px}
.idcd-order-btns button:disabled{opacity:.35;cursor:not-allowed}
.idcd-empty-hint{font-size:11.5px;color:#94A3B8;font-style:italic;padding:6px 0}
.idcd-group{margin-bottom:10px}
.idcd-group-title{font-size:10.5px;font-weight:800;color:#1E3A8A;text-transform:uppercase;letter-spacing:.4px;margin:10px 0 4px}
.idcd-hint{font-size:11px;color:#94A3B8;line-height:1.5}
.idcd-text-input{width:100%;padding:8px 10px;border-radius:8px;border:1.5px solid #E5E7EB;font-size:12px;font-family:inherit;color:#0F172A;margin:4px 0 10px;box-sizing:border-box}
.idcd-text-input:focus{outline:none;border-color:#1E3A8A}
.idcd-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid transparent}
.idcd-btn:disabled{opacity:.6;cursor:not-allowed}
.idcd-btn-primary{background:var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF));color:#fff;flex:1}
.idcd-btn-ghost{background:#F8FAFF;color:#1E3A8A;border-color:#DBEAFE}
.idcd-btn-text{background:transparent;color:#DC2626;padding:9px 6px}
.idcd-preview-pane{flex:1;display:flex;flex-direction:column;min-width:0;background:#F1F5F9}
.idcd-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-bottom:1px solid #E2E8F0;flex-wrap:wrap}
.idcd-preview-nav{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#475569;font-weight:700}
.idcd-preview-nav button{width:26px;height:26px;border-radius:7px;border:1px solid #E2E8F0;background:#fff;color:#475569;cursor:pointer}
.idcd-preview-nav button:disabled{opacity:.4;cursor:not-allowed}
.idcd-preview-actions{display:flex;align-items:center;gap:8px}
.idcd-face-toggle{padding:6px 12px;border-radius:999px;border:1.5px solid #E2E8F0;background:#fff;color:#64748B;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}
.idcd-face-toggle.active{background:#1E3A8A;border-color:#1E3A8A;color:#fff}
.idcd-zoom{display:flex;align-items:center;gap:4px;background:#fff;border:1px solid #E2E8F0;border-radius:999px;padding:3px}
.idcd-zoom button{width:26px;height:26px;border-radius:999px;border:none;background:transparent;color:#475569;font-size:10.5px;font-weight:700;cursor:pointer}
.idcd-preview-stage{flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;padding:24px}
.idcd-preview-frame{flex-shrink:0}
.idcd-preview-foot{display:flex;gap:10px;padding:14px 16px;border-top:1px solid #E2E8F0;background:#fff;flex-wrap:wrap}
.idcd-perpage-select{padding:9px 10px;border-radius:10px;border:1.5px solid #DBEAFE;font-size:12px;font-family:inherit;color:#1E3A8A;background:#F8FAFF}
@media (max-width:860px){
  .idcd-modal{max-width:100%;height:100%;border-radius:0}
  .idcd-body{flex-direction:column;overflow-y:auto}
  .idcd-controls{width:100%;border-right:none;border-bottom:1px solid #E5E7EB}
  .idcd-panel{max-height:300px}
  .idcd-preview-stage{padding:16px}
}
`;
