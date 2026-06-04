// ══════════════════════════════════════════════════
//  Phone number normalization (Pakistan)
//  Users may type a number with the +92 country code; the backend
//  expects the local 0-prefixed form, so +923001234567 -> 03001234567.
// ══════════════════════════════════════════════════

/**
 * Replace a leading Pakistani country code (+92 or 0092) with a local 0.
 * Anything that doesn't start with that prefix is returned unchanged, so it's
 * safe to call on plain usernames too.
 * @param {string} value
 * @returns {string}
 */
export function normalizePkPhone(value) {
  if (typeof value !== 'string') return value;
  const v = value.trimStart();
  if (v.startsWith('+92')) return '0' + v.slice(3).trimStart();
  if (v.startsWith('0092')) return '0' + v.slice(4).trimStart();
  return value;
}
