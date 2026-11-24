/* ═══════════════════════════════════════════════════════════════════
   Fee challan barcode — payload + parser (shared by the challan slip and
   the Dashboard scan/lookup box).

   Payload format:  <ledgerId>-<studentId>      e.g.  10452-1783
   - ledgerId  = BranchLedger challan record id (the row's `id`)
   - studentId = student's studentID (the id the fee APIs use)
   Only digits and '-' → typed with no Shift, so keyboard-wedge scanners
   (SpeedX speed-x-8500 etc.) type it exactly as printed.

   Parser also accepts a bare ledger id ("10452") typed by hand.
   ═══════════════════════════════════════════════════════════════════ */

/* Challan barcode ki value. ledgerId na ho to '' (barcode nahi banega). */
export function challanBarcodeValue({ ledgerId, studentId } = {}) {
  const l = Number(ledgerId) || 0;
  const s = Number(studentId) || 0;
  if (!l) return '';
  return s ? `${l}-${s}` : String(l);
}

/* Scanner / typed text → { ledgerId, studentId|null }, ya null agar format galat ho. */
export function parseChallanBarcode(raw) {
  const text = String(raw == null ? '' : raw).trim();
  const m = text.match(/^(\d{1,12})(?:-(\d{1,12}))?$/);
  if (!m) return null;
  const ledgerId = Number(m[1]);
  if (!ledgerId) return null;
  return { ledgerId, studentId: m[2] ? Number(m[2]) : null };
}
