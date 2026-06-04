export function formatNumber(n) {
  if (n == null) return '';
  return Number(n).toLocaleString('en-US');
}

export function formatCurrency(n, currency = 'PKR') {
  if (n == null) return '';
  return `${currency} ${formatNumber(n)}`;
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || `${singular}s`);
}

export function truncate(str, max = 60) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max)}…` : str;
}
