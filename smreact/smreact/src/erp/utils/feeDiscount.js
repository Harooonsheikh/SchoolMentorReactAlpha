/* Shared fee-discount calculation — used by both the Students module
   (Edit Student → Fee Details) and the Fee module (Challan → Discount
   Manager) so the two discount editors stay behaviorally identical
   instead of each re-implementing the same clamp/percentage math. */

export const DISCOUNT_TYPE_AMOUNT = 'amount';
export const DISCOUNT_TYPE_PERCENTAGE = 'percentage';

/* Given a fee head's standard amount and a raw discount entry (either a
   fixed Rs. amount or a 0-100 percentage, depending on `discountType`),
   returns the clamped input value and the resulting discount amount.
     - amount:     clamped to [0, standardFee]
     - percentage: clamped to [0, 100], amount = round(standardFee * pct / 100) */
export function calcDiscount(standardFee, discountType, discountValue) {
  const fee = Math.max(0, Number(standardFee) || 0);
  const raw = Number(discountValue) || 0;

  if (discountType === DISCOUNT_TYPE_PERCENTAGE) {
    const pct = Math.max(0, Math.min(raw, 100));
    const amount = Math.max(0, Math.min(Math.round((fee * pct) / 100), fee));
    return { discountType: DISCOUNT_TYPE_PERCENTAGE, discountValue: pct, discountAmount: amount };
  }

  const amount = Math.max(0, Math.min(raw, fee));
  return { discountType: DISCOUNT_TYPE_AMOUNT, discountValue: amount, discountAmount: amount };
}

export function calcNetPayable(standardFee, discountAmount) {
  return Math.max(0, (Number(standardFee) || 0) - (Number(discountAmount) || 0));
}
