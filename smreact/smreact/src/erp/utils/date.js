export function parseDDMMYYYY(s) {
  if (!s) return null;
  const [d, m, y] = s.split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export function inputToDDMMYYYY(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function ddmmyyyyToInput(s) {
  if (!s) return '';
  const [d, m, y] = s.split('/');
  return `${y}-${m}-${d}`;
}

export function calcDuration(from, to) {
  const a = parseDDMMYYYY(from);
  const b = parseDDMMYYYY(to);
  if (!a || !b) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function isToday(date) {
  const t = new Date();
  return date.getDate() === t.getDate() &&
         date.getMonth() === t.getMonth() &&
         date.getFullYear() === t.getFullYear();
}
