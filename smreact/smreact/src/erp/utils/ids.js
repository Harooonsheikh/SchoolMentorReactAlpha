export function nextId(items, key = 'id') {
  if (!items || !items.length) return 1;
  return Math.max(...items.map(it => it[key] || 0)) + 1;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
