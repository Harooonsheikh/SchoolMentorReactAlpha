import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

/* ═══════════════════════════════════════════════════════════════════
   QR / Barcode generation for ID cards. No such capability existed
   anywhere in this app (the only prior "QR" on any document — Fee.jsx's
   FEE_QR_SVG — is a purely decorative static SVG, not an encoder), so
   two small, well-maintained, dependency-free libraries were added:
   `qrcode` and `jsbarcode`. Both produce genuinely scannable output —
   nothing here is a mock image.

   The encoded value is always just the student's registration number
   or the employee's ID (already-public identifiers used throughout
   this app's own UI), never a name, CNIC, phone number or address.
   ═══════════════════════════════════════════════════════════════════ */

export async function generateQrDataUrl(text, opts = {}) {
  const value = String(text || '').trim();
  if (!value) return null;
  try {
    return await QRCode.toDataURL(value, {
      margin: 1,
      width: opts.width || 256,
      color: { dark: opts.dark || '#0F172A', light: '#FFFFFF' },
    });
  } catch (e) {
    return null;
  }
}

export function generateBarcodeDataUrl(text, opts = {}) {
  const value = String(text || '').trim();
  if (!value) return null;
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 6,
      height: opts.height || 46,
      width: opts.width || 2,
      background: '#FFFFFF',
      lineColor: opts.color || '#0F172A',
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}
