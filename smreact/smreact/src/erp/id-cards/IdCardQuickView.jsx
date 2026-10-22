import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveCardTheme } from './idCardThemes';
import { resolveDisplayFields } from './idCardFields';
import { getSchoolBranding, getIdCardDesign } from './idCardService';
import { generateQrDataUrl, generateBarcodeDataUrl } from './idCardCodes';
import { renderCardFaceHtml, buildSingleCardDocument } from './idCardPrint';
import IdCardFace from './IdCardFace';

/* ═══════════════════════════════════════════════════════════════════
   ID CARD QUICK VIEW — read-only "view + download" panel embedded in
   an individual student/employee's own profile/details view. Loads
   whatever design was saved from the shared Designer (ID Cards →
   Settings) for this school/kind and renders it for THIS ONE person,
   with no editing controls at all — that setup happens once, in the
   Designer, not per-profile.
   ═══════════════════════════════════════════════════════════════════ */

function todayIso() { return new Date().toISOString().slice(0, 10); }
function plusOneYearIso() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function IdCardQuickView({ kind, entity, ctx = {}, idValue, displayName, school, onClose, toast }) {
  const [loading, setLoading] = useState(true);
  const [design, setDesign] = useState(null);
  const [branding, setBranding] = useState(null);
  const [qrSrc, setQrSrc] = useState(null);
  const [barcodeSrc, setBarcodeSrc] = useState(null);
  const schoolName = school?.name;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, b] = await Promise.all([getIdCardDesign(kind, schoolName), getSchoolBranding()]);
      if (cancelled) return;
      setDesign(d); setBranding(b); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [kind, schoolName]);

  const theme = useMemo(() => (design ? resolveCardTheme(design) : null), [design]);
  const qrShowOn = { front: !!design?.qr?.showFront, back: !!design?.qr?.showBack };
  const barcodeShowOn = { front: !!design?.barcode?.showFront, back: !!design?.barcode?.showBack };
  const qrEnabled = qrShowOn.front || qrShowOn.back;
  const barcodeEnabled = barcodeShowOn.front || barcodeShowOn.back;
  const showPhoto = !!design?.fields.includes('photo');

  useEffect(() => {
    if (!design) return undefined;
    let cancelled = false;
    if (qrEnabled) generateQrDataUrl(idValue, { dark: design.branding.primaryColor }).then((src) => { if (!cancelled) setQrSrc(src); });
    else setQrSrc(null);
    if (barcodeEnabled) setBarcodeSrc(generateBarcodeDataUrl(idValue, { color: design.branding.primaryColor }));
    else setBarcodeSrc(null);
    return () => { cancelled = true; };
  }, [design, qrEnabled, barcodeEnabled, idValue]);

  if (loading || !design || !theme || !branding) {
    return createPortal((
      <div className="idcqv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="idcqv-modal idcqv-loading"><i className="fa-solid fa-spinner fa-spin"></i> Loading ID card…</div>
        <style>{IDCQV_CSS}</style>
      </div>
    ), document.body);
  }

  /* Designer me chuni hui tareekhein; na chuni hon to aaj / aaj + 1 saal. */
  const issueDate = design.issueDate || todayIso();
  const expiryDate = design.expiryDate || plusOneYearIso();
  const fullCtx = { ...ctx, school: branding, issueDate, expiryDate };
  const rows = resolveDisplayFields(kind, design.fields, entity, fullCtx);
  const backRows = resolveDisplayFields(kind, design.backFields || [], entity, fullCtx);
  const backHasContent = qrShowOn.back || barcodeShowOn.back
    || design.backOptions?.showBanner !== false
    || design.backOptions?.showIdText !== false
    || (design.backFields || []).length > 0
    || design.branding.showAddress || design.branding.showContact;

  const faceProps = (faceName) => ({
    theme, orientation: design.orientation, face: faceName,
    photoShape: design.photoShape, photoSizePct: design.photoSizePct,
    photoDataUrl: entity?.photo || null,
    logoDataUrl: branding.logo || null,
    branding: design.branding, school: branding,
    rows, qrSrc, barcodeSrc, qrShowOn, barcodeShowOn,
    qrPosition: design.qr?.position || 'bottom-right',
    backQrPosition: design.qr?.backPosition || 'center',
    qrSizePct: design.qr?.sizePct || 100,
    idText: idValue, showPhoto,
    /* Student ID card par QR ke neeche registration number NAHI chahiye
       (front par pehle se hai + QR usi value ko encode karta hai). Sirf
       student ke liye showIdText off — employee/applicant jaise hain. */
    backOptions: kind === 'student'
      ? { ...design.backOptions, showIdText: false }
      : design.backOptions,
    backRows,
  });

  const handleDownload = () => {
    const frontHtml = renderCardFaceHtml(faceProps('front'));
    const backHtml = backHasContent ? renderCardFaceHtml(faceProps('back')) : '';
    const html = buildSingleCardDocument({
      title: `ID Card — ${displayName}`, sizeId: design.sizeId, orientation: design.orientation,
      frontHtml, backHtml,
    });
    const w = window.open('', '_blank');
    if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch { /* ignore */ } };
  };

  return createPortal((
    <div className="idcqv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="idcqv-modal">
        <div className="idcqv-head">
          <div className="idcqv-title"><i className="fa-solid fa-id-card"></i> {displayName}'s ID Card</div>
          <button type="button" className="idcqv-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="idcqv-body">
          <div className="idcqv-facewrap"><IdCardFace {...faceProps('front')} /></div>
          {backHasContent && <div className="idcqv-facewrap"><IdCardFace {...faceProps('back')} /></div>}
        </div>
        <div className="idcqv-foot">
          <button type="button" className="idcqv-btn" onClick={handleDownload}>
            <i className="fa-solid fa-download"></i> Download ID Card
          </button>
        </div>
      </div>
      <style>{IDCQV_CSS}</style>
    </div>
  ), document.body);
}

const IDCQV_CSS = `
.idcqv-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:3000;padding:20px;backdrop-filter:blur(2px)}
.idcqv-modal{background:#fff;border-radius:16px;max-width:520px;width:100%;box-shadow:0 30px 70px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column}
.idcqv-loading{padding:40px;text-align:center;font-weight:700;color:#475569;font-size:14px}
.idcqv-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #E5E7EB}
.idcqv-title{font-size:15px;font-weight:800;color:#0F172A;display:flex;align-items:center;gap:8px}
.idcqv-close{width:32px;height:32px;border-radius:9px;border:1.5px solid #E5E7EB;background:#fff;color:#64748B;cursor:pointer}
.idcqv-close:hover{background:#1E3A8A;color:#fff;border-color:#1E3A8A}
.idcqv-body{padding:22px;display:flex;flex-direction:column;align-items:center;gap:16px;background:#F8FAFC;max-height:70vh;overflow-y:auto}
.idcqv-facewrap{display:flex;justify-content:center;width:100%}
.idcqv-foot{padding:14px 18px;border-top:1px solid #E5E7EB;display:flex;justify-content:flex-end}
.idcqv-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;border:none;background:#1E3A8A;color:#fff;font-weight:700;font-size:13px;cursor:pointer}
.idcqv-btn:hover{background:#1E40AF}
`;
